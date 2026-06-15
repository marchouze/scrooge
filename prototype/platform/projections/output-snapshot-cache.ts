// platform/projections/output-snapshot-cache.ts
//
// D-PROJECTION-SNAPSHOT-ADOPTION — generic byte-identical output-snapshot
// cache for the heavy *procedural* read projections.
//
// Why this exists (and why it is NOT `LocalProjector.projectFromSnapshot`).
// The Slice-3 snapshot runtime (`runtime.ts`) caches the *state of a single
// reducer* — a `Projection<S,E>` with one ordered `reduce(state, event)`
// fold. It is the right tool for register-style projections (decisions,
// trial balance) that ARE shaped as a reducer over a single event stream.
//
// The heaviest critical-path reads — `getALMPositionSnapshot`,
// `computeCapitalMetrics`, `computeRwaFromPositions`, and the dashboard
// `bootDerive` folds — are NOT single-reducer projections. Each runs many
// independent type-filtered full scans (HQLA, funding, settlement, ASF, RSF,
// repo, bond, capital, RWA …) and assembles a composite output. Re-shaping
// them into one reducer over the whole log would be a large, behaviour-
// changing rewrite — the opposite of the incremental, reversible,
// byte-identical adoption the decision asks for.
//
// This helper takes the conservative route that GUARANTEES byte-identity:
//   - The snapshot payload caches the *computed output* together with the
//     event-store `count()` it was computed at.
//   - On read, the cache is valid ONLY when (a) a snapshot exists for the
//     exact (stream-key, asOf) and (b) the store has not grown since
//     (`snapshot.count === store.count()`). When valid → return the cached
//     output (O(1), no scan). When invalid (cache miss, stale asOf, or the
//     store advanced) → run the supplied `compute()` UNCHANGED and persist
//     a fresh snapshot on cadence.
//
// Correctness argument. The slow path is the existing function verbatim, so
// any non-cache-hit read is bit-for-bit identical to today. A cache hit is
// only ever taken when the store has the *same* event population (count) and
// the *same* asOf as when the snapshot was written — i.e. the inputs to the
// pure compute() are identical, so the cached output equals a fresh compute()
// by determinism (Principle 1: projections are pure functions of the log).
// The per-projection equality regression test
// (`tests/output-snapshot-cache.test.ts`) asserts this for each adopted call
// site.
//
// `count()`-vs-`highWatermark()`. We deliberately key the freshness witness
// on `count()`, not `highWatermark()`. `count()` is the number of rows the
// pure compute() actually folds; a gap in the sequence (from a rolled-back
// append) leaves `highWatermark()` ahead of `count()` while the folded
// population is unchanged — using `count()` keeps the witness aligned with
// what compute() reads. If the population is identical, the output is
// identical; if any event was added or removed, `count()` differs and we
// recompute. (A pathological add+remove that nets to the same count at the
// same asOf is not reachable in this append-only store — Principle 1; events
// are never deleted in the hot path, only archived to a cold partition which
// the `PartitionedEventStore` still folds.)
//
// Provenance discipline. The base stream key is suffixed with the provenance
// filter digest via `effectiveStreamKey()` (the same pattern the Slice-3
// runtime uses), so a snapshot computed under one provenance mode never
// serves a request under another.
//
// Author: Atlas (Substrate Architect, engineering)

import type { EventStore } from "../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  effectiveStreamKey,
} from "./filter";

/**
 * Envelope persisted in the snapshot payload. `count` is the event-store
 * row count at compute time (the freshness witness); `asOf` is echoed for a
 * defensive equality check; `output` is the JSON-serialised compute() result.
 */
interface CachedOutputEnvelope {
  readonly v: 1;
  readonly count: number;
  readonly asOf: string;
  readonly output: unknown;
}

export interface OutputSnapshotCacheOpts<T> {
  /** Event store to read snapshots from / write snapshots to. */
  readonly store: EventStore;
  /**
   * Stable base stream key identifying this projection + its parameters,
   * e.g. `"alm:LE-ZA-HOZ-BANK:h30"`. MUST encode every parameter that
   * changes the output (entity, horizon, …) so two different parameter sets
   * never collide on one snapshot row. The provenance digest is appended
   * automatically.
   */
  readonly streamKey: string;
  /** As-of bound the compute() runs at. Snapshots are keyed per exact asOf. */
  readonly asOf: string;
  /** Pure projection function. Run verbatim on any cache miss. */
  readonly compute: () => T;
  /** Serialise compute() output to a JSON string for the snapshot payload. */
  readonly encode: (output: T) => string;
  /** Re-hydrate compute() output from a snapshot payload string. */
  readonly decode: (payload: string) => T;
  /**
   * Provenance filter under which compute() reads the log. Rides inside the
   * effective snapshot stream key so cross-mode snapshots never collide.
   * Defaults to `defaultProvenanceFilter()` (env-derived).
   */
  readonly provenanceFilter?: ProvenanceFilter;
  /**
   * Snapshot-cadence event-type selector (forwarded to
   * `store.shouldSnapshot`). When omitted the store's default cadence rule
   * applies. The first read always emits a snapshot (`first-snapshot`).
   */
  readonly cadenceEventType?: string;
}

export interface OutputSnapshotCacheResult<T> {
  readonly output: T;
  /** True when the cached snapshot output was returned without recompute. */
  readonly cacheHit: boolean;
  /** True when this read persisted a fresh snapshot. */
  readonly snapshotWritten: boolean;
  /** Event-store count() the output reflects. */
  readonly count: number;
}

/**
 * Read a heavy procedural projection through the byte-identical output-snapshot
 * cache. See module header for the correctness argument.
 */
export function readWithOutputSnapshot<T>(
  opts: OutputSnapshotCacheOpts<T>,
): OutputSnapshotCacheResult<T> {
  const provFilter = opts.provenanceFilter ?? defaultProvenanceFilter();
  const effStream = effectiveStreamKey(opts.streamKey, provFilter);
  const currentCount = opts.store.count();

  // --- Fast path: a snapshot exists at exactly this asOf, taken at the same
  // event population. Return the cached output without any scan.
  const snap = opts.store.loadSnapshot(effStream, opts.asOf);
  if (snap) {
    let envelope: CachedOutputEnvelope | null = null;
    try {
      const parsed = JSON.parse(snap.payload) as unknown;
      if (isCachedOutputEnvelope(parsed)) envelope = parsed;
    } catch {
      // Corrupt / legacy payload — treat as a miss and recompute. We never
      // swallow this silently downstream: the recompute path below rewrites
      // a well-formed snapshot, self-healing the row.
      envelope = null;
    }
    if (envelope && envelope.count === currentCount && envelope.asOf === opts.asOf) {
      return {
        output: opts.decode(encodeEnvelopeOutput(envelope)),
        cacheHit: true,
        snapshotWritten: false,
        count: currentCount,
      };
    }
  }

  // --- Slow path: compute verbatim (byte-identical to the un-cached function)
  // and persist a fresh snapshot when the cadence rule fires.
  const output = opts.compute();
  const envelope: CachedOutputEnvelope = {
    v: 1,
    count: currentCount,
    asOf: opts.asOf,
    output: JSON.parse(opts.encode(output)) as unknown,
  };
  const check = opts.store.shouldSnapshot({
    streamKey: effStream,
    ...(opts.cadenceEventType ? { eventType: opts.cadenceEventType } : {}),
  });
  let snapshotWritten = false;
  if (check.shouldSnapshot) {
    opts.store.snapshot({
      streamKey: effStream,
      asOf: opts.asOf,
      uptoSequence: currentCount,
      payload: JSON.stringify(envelope),
    });
    snapshotWritten = true;
  }
  return { output, cacheHit: false, snapshotWritten, count: currentCount };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isCachedOutputEnvelope(x: unknown): x is CachedOutputEnvelope {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.count === "number" &&
    typeof o.asOf === "string" &&
    "output" in o
  );
}

/**
 * Re-serialise just the cached `output` field of an envelope back into the
 * JSON string shape the consumer's `decode()` expects. The consumer's
 * `encode`/`decode` round-trip operates on the *output* shape, not the
 * envelope, so we hand `decode` the inner output re-stringified.
 */
function encodeEnvelopeOutput(envelope: CachedOutputEnvelope): string {
  return JSON.stringify(envelope.output);
}
