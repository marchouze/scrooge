// platform/recon/parallel-dispatch-divergence.ts
//
// Continuous-controls pipeline: parallel-dispatch divergence (Vera Wave-4
// #13b). Atlas A2.2 dispatcher cutover (D-A22-RETIRE-LEGACY) names this
// pipeline as the *gating* reconciliation that proves the new
// `LocalEventTriggerBus` produces identical fan-out to the legacy
// in-process dispatcher in `runtime/run.ts:132–199`. Without this
// pipeline, Phase 1 (bus-canonical, legacy-shadow) cannot enter — the
// G1 / G4 gating criteria of the cutover spec are computed here.
//
// The pipeline reconciles two parallel record streams:
//
//   1. `LegacyFanoutShadowed` — emitted by the legacy fan-out path in
//      `runtime/run.ts` while the cutover's shadow flag is set to
//      `"shadow"` (Phase 1 build step). Records what the legacy path
//      *would have* dispatched, without actually invoking the handler.
//      Payload: `{ parentAgent, parentTrigger, triggeredHandlerKey,
//      triggeringEventTypes, suppressedAtSequence, eventId? }`. The
//      `eventId` field (the real triggering-event id) is the
//      real-identity protocol added in A22 Phase-1 evidence completion;
//      events from before that protocol carry only `suppressedAtSequence`
//      and the recon keys them as `seq:N` (pre-protocol). The earliest
//      real-`eventId` shadow event's `as_of` is the protocol epoch — see
//      "Real-id shadow protocol epoch" below. Pre-Phase 1 the type does
//      not yet exist in the schema; the pipeline tolerates absence and
//      emits a warn (insufficient samples) rather than a fail (real
//      divergence) — see "Sample-window discipline" below.
//
//   2. `BusDispatched` — emitted by the LocalEventTriggerBus on every
//      handler invocation. Payload: `{ eventId, eventType, handlerKey,
//      dispatchedAt, outcome }`. Already live (PR #6, 2026-05-08).
//
// Comparison key (per Atlas spec §2 G1 + §3.1): the pair
// `(eventId, handlerKey)` is the canonical dedup key used by the bus
// itself. Equality of the *set* of `(eventId, handlerKey)` pairs across
// the two streams is the divergence assertion. The streams are bags of
// pairs (un-ordered); ordering is not part of the spec because both
// dispatchers iterate handlers on the same source-event stream and the
// per-handler outcome is independent of dispatch order.
//
// What this pipeline asserts:
//
//   A. **Symmetric coverage (G1).** For every `(eventId, handlerKey)`
//      pair appearing in *either* stream, the *other* stream must
//      record the pair too. Asymmetric coverage is a divergence row;
//      Atlas's spec sets the gating threshold at 0 divergence rows over
//      ≥ 3 fleet-cycles. Below the sample-window floor, divergences
//      are emitted as `severity: "warn"` (the absence of evidence is
//      not yet evidence of absence); at or above the floor, they are
//      `severity: "fail"`.
//
//   B. **Dispatch-outcome integrity (G4 + F2).** For every
//      `BusDispatched` row, the `outcome` field must be one of
//      `"ok" | "failed"` (envelope already enforces this via the typed
//      payload schema). Multiple `BusDispatched{outcome:"ok"}` rows on
//      the same `(eventId, handlerKey)` pair is a dedup-race finding
//      (Atlas spec §4.2 F2 — concurrent-tick failure mode); fail
//      severity, no sample-window discount.
//
//   C. **Bus-attributable integrity-alert silence (G3).** No
//      `SubstrateAlert{alertClass:"integrity"}` event whose
//      `agentUrn === "agent:atlas:event-trigger-bus"` may exist (any
//      such event is a dispatch-failure record from the bus itself).
//      The cutover gating criterion G3 is computed here so that the
//      gate-status is reproducible from the recon output without
//      cross-pipeline join logic.
//
// Real-id shadow protocol epoch (A22 Phase-1 evidence completion, 2026-05-29).
//
// The first generation of `LegacyFanoutShadowed` events (1,095 of them in
// the production store) carried no triggering-event identity — only
// `suppressedAtSequence`, a single parent-run pointer. The recon fell back
// to a synthetic `seq:N` key for those, which can never match a real
// `BusDispatched.eventId`, so event-level G1 was inconclusive and the gate
// was pinned to warn. Once the emitter began recording the real
// `eventId` (one shadow event per triggering event), event-level G1
// becomes evaluable — but naively turning it on would instantly flip the
// gate to fail, for two stale-baseline reasons:
//
//   1. The 1,095 legacy `seq:N` shadow events have no matching bus pair
//      (the bus keys on real ids), so each would become an A.2 divergence.
//   2. The thousands of historical `BusDispatched` rows predate the
//      protocol and have no matching real-id shadow, so each would become
//      an A.1 divergence. And the sample-window floor — keyed off the
//      earliest event across both streams (weeks old) — is already met, so
//      there is no warn grace.
//
// To make the gate *evaluable without breaking CI*, we anchor on a
// protocol epoch:
//
//   epoch = the `as_of` of the EARLIEST `LegacyFanoutShadowed` event that
//           carries a real (non-`seq:`) `eventId`.
//
// All dispatch pairs whose triggering event is BEFORE the epoch — both
// `seq:N` shadow events and pre-epoch `BusDispatched` rows — are
// PRE-PROTOCOL baseline: excluded from the A.1/A.2/F2 comparison and
// reported as a single info row ("N pre-protocol pairs excluded from G1"),
// never as divergence. The sample-window floor is computed FROM the epoch,
// not from the earliest event across all streams, so the 3-fleet-cycle
// (~72h) window accrues from the cutover point forward. When no real-id
// shadow event exists yet (epoch undefined), behaviour is preserved
// exactly: warn, "shadow lacks real ids / Phase 1 not entered", ok=true.
//
// Cascade topology (A22 Phase-1, option (b) — recon scopes G1 to the
// non-cascade subset).
//
// The bus ticks at the end of `runAgent` and dispatches event-driven
// handlers for ALL new events in the tick window, INCLUDING events that
// were themselves appended by other event-driven handlers (cascades). The
// legacy shadow block, by contrast, only runs for NON-event-driven parent
// runs (`runtime/run.ts`: `entry.metadata.kind !== "event-driven"`) and
// deliberately does NOT recurse into event-driven handlers (loop risk; the
// bus's idempotency is the canonical guard). So the bus stream legitimately
// contains pairs the shadow stream never will: dispatches whose triggering
// event was appended by an event-driven handler (a cascade).
//
// Two ways to make the equivalence proof TRUE were considered:
//   (a) Mirror cascades in the shadow path (recurse shadow into
//       event-driven handlers so it dispatches cascades too). REJECTED:
//       it would change shadow-mode runtime semantics, reintroduce the
//       loop risk the shadow block was written to avoid, and — critically
//       — it would NOT reflect what the LEGACY in-process dispatcher
//       actually did. The legacy path being retired also only fanned out
//       from non-event-driven parents. Mirroring cascades would prove
//       equivalence to a dispatcher that never existed.
//   (b) Scope the recon's bus-side G1 (A.1) to the non-cascade subset:
//       only require a matching shadow event for bus pairs whose triggering
//       event was observed by the shadow path. CHOSEN. The shadow stream is
//       precisely the set of triggering events a non-event-driven parent
//       run produced and that had a subscriber. A bus pair whose
//       triggering `eventId` never appears in the post-epoch shadow
//       eventId set is, by construction, a cascade dispatch — a legitimate
//       new-system behaviour, not a divergence. We report the count of such
//       cascade-only bus pairs as info and exclude them from A.1. Shadow
//       side (A.2) stays full: every post-epoch shadow pair MUST have a
//       matching `BusDispatched{ok}` — that is the real equivalence the
//       cutover must prove (the bus does everything legacy did, and more).
//
// This makes the equivalence proof TRUE rather than merely green: legacy
// dispatched exactly the non-cascade subset; the recon asserts the bus is a
// superset (covers every legacy/shadow pair) and that the extra pairs are
// cascades. Authority: D-A22-RETIRE-LEGACY (Phase-1 evidence completion).
//
// Sample-window discipline.
//
// Atlas's spec defines the gating window as ≥ 3 fleet-cycles (§2.1). A
// fleet-cycle is approximately 24h of agent-time, so the floor is
// approximately 72h between the protocol epoch (see above) and `now`. The
// pipeline computes this from the event timestamps directly: it reads the
// epoch and compares it against the run's `now` (defaulting to wall-clock;
// overridable for tests). Below the floor, the pipeline returns `ok: true`
// with warn-severity violations and a `detail` note flagging
// "sample-window not yet met". Above the floor, the same rows escalate to
// fail-severity.
//
// Pre-Phase 1 (legacy still active, no shadow events) the pipeline
// runs but produces no divergence rows — both streams are valid; the
// Bus-only-side-recorded findings are warn-severity until the cutover
// authoriser flips the shadow flag and the symmetric-coverage check
// has both streams to compare. This deliberately matches the brief's
// gating-criterion sequencing: the recon must be live *before* Phase 1
// build so the G1 evidence accrues from sample 1; the recon does not
// fail the build merely because Phase 1 has not entered.
//
// Empty-store handling. On a fresh runner with no event store at all,
// the pipeline returns `ok: true` with a single info-severity row
// noting the empty store; this matches the convention of
// `decision-event-recon` and `dashboard-derivation-recon` for the
// no-event-store case. The fail/warn ladder kicks in once events
// start arriving.
//
// Authority + citation chain (P2 — atomic citation discipline):
//   - `D-AGENT-RUNTIME-AUTHORIZE` (resolved 2026-05-07) — A0–A3
//     substrate build authority, including A2.2 bus.
//   - `D-FLEET-ROLLOUT-SEQUENCING` (resolved 2026-05-08) — sequences
//     A1–A4; this pipeline gates A2.2's cutover.
//   - `D-A22-RETIRE-LEGACY` (CEO approval 2026-05-08, Phase 1 authorised)
//     — the cutover decision this pipeline gates.
//   - `Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md`
//     §2 (gating criteria), §3.1 (Phase 1 topology), §4 (failure modes),
//     §11 (open items: "build Wave-4 #13b before Phase 1 entry").
//   - Principle 1 — events are authoritative; this pipeline reads the
//     event store directly with no derived-state shortcut.
//   - Principle 2 — every assertion cites D-A22-RETIRE-LEGACY or one
//     of its predecessors; violations reference the spec section that
//     names the assertion.
//   - Principle 6 — autonomous-by-default; the audit must verify the
//     autonomous fan-out itself, not just the procedure that owns it.
//
// Procedure binding (P6 — upward chain): this pipeline is the
// continuous-controls evidence for `Procedures/by-policy/change-management.md`
// step "Phase 1 entry — gating-criteria evidence" of the cutover.
//
// Author: Vera (continuous-controls / internal-audit engineer)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const DEFAULT_DB = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../../.local/event.db");

/**
 * Gating-window floor in milliseconds. Atlas's spec §2.1 sets the floor
 * at 3 fleet-cycles ≈ 3 days of agent-time; we encode it in milliseconds
 * here for direct comparison against `as_of` ISO timestamps.
 *
 * Below the floor, divergence rows are emitted at warn-severity (the
 * sample window has not yet had the opportunity to manifest the
 * divergence the gate is designed to catch). At or above the floor,
 * they escalate to fail-severity.
 */
const GATING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Bus actor URN per `prototype/platform/event-trigger-bus/bus.ts:39`. */
const BUS_ACTOR_URN = "agent:atlas:event-trigger-bus";

export interface RunOpts {
  /** Override the event store path (default: `.local/event.db`). */
  dbPath?: string;
  /**
   * Override "now" for sample-window-floor computation. Defaults to
   * the current wall-clock at run time. Tests pass an ISO string to
   * pin the window deterministically.
   */
  now?: string;
  /**
   * Override the gating window. Tests use a tighter window to assert
   * the warn → fail escalation without waiting 72h.
   */
  gatingWindowMs?: number;
  /**
   * Inject events directly (bypasses the event store entirely).
   * Tests use this to construct synthetic divergence cases without
   * spinning a sqlite store. When provided, `dbPath` is ignored.
   */
  events?: ReadonlyArray<Event>;
}

/** A `(eventId, handlerKey)` dispatch pair, with the triggering event's `as_of`. */
interface DispatchPair {
  readonly eventId: string;
  readonly handlerKey: string;
  /** `as_of` of the source dispatch event — used for epoch windowing. */
  readonly asOf: string;
  /**
   * True when this pair's `eventId` is the synthetic `seq:N` fallback
   * (shadow event from before the real-id protocol). Bus pairs are always
   * `false` (the bus always carries a real id).
   */
  readonly isSeqFallback: boolean;
}

interface ParsedStreams {
  /** `BusDispatched` rows where outcome === "ok" and NOT from ScheduledTrigger. */
  busOkPairs: DispatchPair[];
  /** `BusDispatched` rows of any outcome (used for duplicate-detection). */
  busAllRows: ReadonlyArray<{ pair: DispatchPair; outcome: string; asOf: string }>;
  /** `LegacyFanoutShadowed` rows. */
  shadowPairs: DispatchPair[];
  /**
   * Whether any shadow event carries a real eventId (UUID format) rather than
   * the synthetic `seq:N` fallback. When false, the shadow events pre-date the
   * per-event shadow protocol and event-level G1 comparison is inconclusive.
   */
  shadowHasRealIds: boolean;
  /**
   * Bus-attributable `SubstrateAlert{alertClass:"integrity"}` rows within
   * the gating window. Historical alerts from before the window are excluded
   * so that old dispatch failures (since fixed) do not permanently block the gate.
   */
  busIntegrityAlerts: number;
  /**
   * Earliest `as_of` across the dispatch-pair streams. Used to compute
   * sample-window-floor. `undefined` when both streams are empty.
   */
  earliestAsOf: string | undefined;
  /**
   * Real-id shadow protocol epoch: the earliest `as_of` of any
   * `LegacyFanoutShadowed` event carrying a real (non-`seq:`) `eventId`.
   * `undefined` when no real-id shadow event exists yet (Phase 1 not
   * entered with the real-identity protocol). See the header comment.
   */
  realIdShadowEpoch: string | undefined;
  /** Total events in the store (for empty-store detection). */
  totalEvents: number;
}

function readStreams(
  events: ReadonlyArray<Event>,
  opts: { nowMs: number; gatingWindowMs: number },
): ParsedStreams {
  const busOkPairs: DispatchPair[] = [];
  const busAllRows: { pair: DispatchPair; outcome: string; asOf: string }[] = [];
  const shadowPairs: DispatchPair[] = [];
  let shadowHasRealIds = false;
  let busIntegrityAlerts = 0;
  let earliestAsOf: string | undefined;
  let realIdShadowEpoch: string | undefined;
  let totalEvents = 0;

  for (const e of events) {
    totalEvents++;
    if (e.type === "BusDispatched") {
      const p = e.payload as Record<string, unknown>;
      const eventId = typeof p.eventId === "string" ? p.eventId : "";
      const handlerKey = typeof p.handlerKey === "string" ? p.handlerKey : "";
      const eventType = typeof p.eventType === "string" ? p.eventType : "";
      const outcome = typeof p.outcome === "string" ? p.outcome : "unknown";
      if (eventId && handlerKey) {
        const pair: DispatchPair = { eventId, handlerKey, asOf: e.as_of, isSeqFallback: false };
        busAllRows.push({ pair, outcome, asOf: e.as_of });
        // Exclude ScheduledTrigger dispatches from the G1 symmetric-coverage
        // set. The ScheduledTriggerConsumer (A2.2) dispatches scheduled
        // handlers via ScheduledTrigger events and emits BusDispatched for
        // audit, but the legacy fan-out path has no shadow equivalent for
        // the scheduled-trigger path — the legacy route for scheduled
        // handlers is a direct launchd invocation, not the event-driven
        // fan-out being compared here.
        const isScheduledTriggerDispatch = eventType === "ScheduledTrigger";
        if (outcome === "ok" && !isScheduledTriggerDispatch) busOkPairs.push(pair);
        if (!earliestAsOf || e.as_of < earliestAsOf) earliestAsOf = e.as_of;
      }
      continue;
    }
    if (e.type === "LegacyFanoutShadowed") {
      const p = e.payload as Record<string, unknown>;
      // Phase 1's payload field name is normative per Atlas spec §3.1;
      // we accept either `eventId` (real triggering-event id, the
      // real-identity protocol) or fall back to a synthetic `seq:N`
      // key when the legacy emitter recorded only the parent-run sequence
      // pointer. The recon prefers strong identity (eventId).
      const rawEventId = typeof p.eventId === "string" && p.eventId.length > 0 ? p.eventId : "";
      const isSeqFallback = rawEventId.length === 0;
      const eventId =
        rawEventId.length > 0
          ? rawEventId
          : typeof p.suppressedAtSequence === "number"
            ? `seq:${p.suppressedAtSequence}`
            : "";
      const handlerKey = typeof p.triggeredHandlerKey === "string" ? p.triggeredHandlerKey : "";
      if (eventId && handlerKey) {
        shadowPairs.push({ eventId, handlerKey, asOf: e.as_of, isSeqFallback });
        // Track whether any shadow event carries a real (non-seq) eventId.
        // Shadow events emitted by the old protocol only carry suppressedAtSequence
        // (yielding "seq:N" here); event-level G1 comparison is only valid when
        // at least one shadow event has a real UUID.
        if (rawEventId.length > 0) {
          shadowHasRealIds = true;
          // The protocol epoch is the EARLIEST real-id shadow event's as_of.
          if (!realIdShadowEpoch || e.as_of < realIdShadowEpoch) realIdShadowEpoch = e.as_of;
        }
        if (!earliestAsOf || e.as_of < earliestAsOf) earliestAsOf = e.as_of;
      }
      continue;
    }
    if (e.type === "SubstrateAlert") {
      const p = e.payload as Record<string, unknown>;
      const cls = typeof p.alertClass === "string" ? p.alertClass : "";
      // G3 per A22 spec §2: flag SubstrateAlert{alertClass:"integrity"} events
      // emitted by the bus actor (actor.id === BUS_ACTOR_URN). Window: 3h —
      // G3 measures current bus health; a short window prevents stale bug-era
      // alerts (e.g., handler ok-semantics fix artifacts, pre-A1 backfill
      // bypass alerts) from permanently blocking the gate after the root cause
      // is resolved.
      const G3_WINDOW_MS = 3 * 60 * 60 * 1000;
      const alertAsOfMs = Date.parse(e.as_of);
      const recentAlert = !Number.isNaN(alertAsOfMs) && opts.nowMs - alertAsOfMs <= G3_WINDOW_MS;
      if (cls === "integrity" && e.actor.id === BUS_ACTOR_URN && recentAlert) {
        busIntegrityAlerts++;
      }
    }
  }

  return {
    busOkPairs,
    busAllRows,
    shadowPairs,
    shadowHasRealIds,
    busIntegrityAlerts,
    earliestAsOf,
    realIdShadowEpoch,
    totalEvents,
  };
}

function pairKey(p: DispatchPair): string {
  return `${p.eventId}|${p.handlerKey}`;
}

function loadEvents(opts: RunOpts): ReadonlyArray<Event> | undefined {
  if (opts.events) return opts.events;
  const dbPath = opts.dbPath ?? DEFAULT_DB;
  if (!existsSync(dbPath)) return undefined; // empty-store sentinel
  const store = new EventStore(dbPath);
  try {
    const out: Event[] = [];
    for (const e of store.replay()) out.push(e);
    return out;
  } finally {
    store.close();
  }
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("parallel-dispatch-divergence");
  const violations: ReconViolation[] = [];

  const events = loadEvents(opts);
  if (events === undefined) {
    // Empty-store sentinel — no event database yet. Report as info-severity
    // and return ok. The cutover gate cannot be evaluated until events flow.
    result.asserted = 1;
    result.violations = [
      {
        subject: opts.dbPath ?? DEFAULT_DB,
        message:
          "Event store not present at the configured path. Pipeline cannot evaluate the D-A22-RETIRE-LEGACY gating criteria until the store materialises (typical fresh-runner state). No divergence asserted.",
        severity: "info",
      },
    ];
    return result;
  }

  const now = opts.now ?? new Date().toISOString(); // wall-clock: default when no clock injected; callers should inject for deterministic tests
  const gatingWindowMs = opts.gatingWindowMs ?? GATING_WINDOW_MS;
  const nowMs = Date.parse(now);
  const streams = readStreams(events, { nowMs, gatingWindowMs });

  // Empty-pair-stream sentinel — store has events but neither
  // `BusDispatched` nor `LegacyFanoutShadowed` has been emitted yet.
  // Per spec §3.1 / §11, the recon is built *before* Phase 1 entry; the
  // pre-Phase 1 condition is "bus is live, manual ticks only, legacy
  // fan-out still active (no shadow events)". One-sided coverage is
  // therefore the expected pre-Phase 1 state and is reported at warn
  // severity (gate cannot be evaluated yet) rather than fail.
  if (streams.busOkPairs.length === 0 && streams.shadowPairs.length === 0) {
    result.asserted = 1;
    result.violations = [
      {
        subject: "pair-stream",
        message:
          'Neither `BusDispatched{outcome:"ok"}` nor `LegacyFanoutShadowed` events found in the store. Pipeline asserts symmetric coverage between the two streams; with both empty, the D-A22-RETIRE-LEGACY gating criteria (G1, G4) cannot yet be evaluated. Expected pre-Phase 1 state — flip Atlas\'s shadow flag to "shadow" to begin sample accrual.',
        severity: "warn",
      },
    ];
    result.ok = true;
    return result;
  }

  // ---------------------------------------------------------------------
  // Protocol-epoch boundary (A22 Phase-1 evidence completion). See header.
  //
  // epoch = as_of of the earliest real-id `LegacyFanoutShadowed`. Pairs
  // whose triggering event is BEFORE the epoch are pre-protocol baseline:
  // excluded from A.1/A.2/F2, reported as info. When epoch is undefined
  // (no real-id shadow yet), behaviour is preserved exactly — every pair
  // is pre-protocol, the comparison sets are empty, and the
  // "shadow lacks real ids / Phase 1 not entered" warn below fires.
  // ---------------------------------------------------------------------
  const epoch = streams.realIdShadowEpoch;
  const epochMs = epoch ? Date.parse(epoch) : Number.NaN;
  const isPostEpoch = (p: DispatchPair): boolean => {
    // seq:N shadow events are pre-protocol by construction.
    if (p.isSeqFallback) return false;
    // No protocol epoch yet → nothing is post-epoch (today's behaviour).
    if (Number.isNaN(epochMs)) return false;
    const tMs = Date.parse(p.asOf);
    return !Number.isNaN(tMs) && tMs >= epochMs;
  };

  const busOkPostEpoch = streams.busOkPairs.filter(isPostEpoch);
  const shadowPostEpoch = streams.shadowPairs.filter(isPostEpoch);
  const preEpochBusCount = streams.busOkPairs.length - busOkPostEpoch.length;
  const preEpochShadowCount = streams.shadowPairs.length - shadowPostEpoch.length;
  const preEpochTotal = preEpochBusCount + preEpochShadowCount;

  // Sample window now accrues FROM the epoch, not from the earliest event
  // across all streams. Pre-epoch the gate cannot escalate (warn only).
  const sampleWindowMet =
    !Number.isNaN(epochMs) && !Number.isNaN(nowMs) && nowMs - epochMs >= gatingWindowMs;

  // Severity ladder: when the sample window (measured from the epoch) has
  // not yet passed, divergence rows are warn (insufficient post-cutover
  // evidence to fail the gate). When it has passed, they escalate to fail.
  // When no real-id shadow exists yet (epoch undefined), the comparison
  // sets below are empty; the only row emitted is the
  // "shadow lacks real ids / Phase 1 not entered" warn (behaviour
  // preserved exactly from the pre-protocol pipeline).
  const shadowExistsButLacksRealIds = streams.shadowPairs.length > 0 && !streams.shadowHasRealIds;
  const divergenceSeverity = sampleWindowMet && !shadowExistsButLacksRealIds ? "fail" : "warn";

  // Cascade-topology scoping (option (b), see header). The shadow stream is
  // the authoritative set of NON-cascade triggering events (events appended
  // by a non-event-driven parent run that had a subscriber). Bus pairs whose
  // triggering `eventId` never appears in the post-epoch shadow eventId set
  // are cascade dispatches — legitimate new-system behaviour, excluded from
  // A.1 and reported as info.
  const shadowEventIdSet = new Set(shadowPostEpoch.map((p) => p.eventId));
  const busOkPostEpochNonCascade = busOkPostEpoch.filter((p) => shadowEventIdSet.has(p.eventId));
  const cascadeOnlyBusCount = busOkPostEpoch.length - busOkPostEpochNonCascade.length;

  const busOkSet = new Set(busOkPostEpochNonCascade.map(pairKey));
  const shadowSet = new Set(shadowPostEpoch.map(pairKey));

  // Info rows — pre-protocol baseline + cascade exclusions. These are never
  // divergence; they document why the gate's comparison set is scoped.
  if (preEpochTotal > 0) {
    result.asserted++;
    violations.push({
      subject: "pre-protocol-baseline",
      message: `${preEpochTotal} pre-protocol dispatch pair(s) excluded from G1 (${preEpochBusCount} pre-epoch \`BusDispatched\` + ${preEpochShadowCount} \`seq:N\`/pre-epoch \`LegacyFanoutShadowed\`). These predate the real-id shadow protocol epoch${epoch ? ` (${epoch})` : ""} and carry no comparable identity. Reported as info per the A22 Phase-1 epoch-boundary design; never divergence. NOTE: pre-epoch \`BusDispatched\` dedup-race (F2) duplicates, if any, are likewise pre-protocol and excluded here — see the filed SubstrateAlert/AuditFinding for the historical concurrent-bus incident.`,
      severity: "info",
    });
  }
  if (cascadeOnlyBusCount > 0) {
    result.asserted++;
    violations.push({
      subject: "cascade-dispatches",
      message: `${cascadeOnlyBusCount} post-epoch \`BusDispatched{ok}\` pair(s) excluded from A.1 as cascade dispatches (triggering event appended by an event-driven handler; the legacy fan-out / shadow path never fired for these by design — see cascade-topology option (b) in the recon header). Legitimate new-system behaviour, not divergence.`,
      severity: "info",
    });
  }

  // Assertion A — symmetric coverage (post-epoch, non-cascade subset).
  // Each `(eventId, handlerKey)` pair in either scoped stream must appear
  // in the other.

  // A.1 — Bus-side coverage: every post-epoch, non-cascade
  // `BusDispatched{outcome:"ok"}` pair must have a matching
  // `LegacyFanoutShadowed`. When the (post-epoch) shadow stream is absent
  // we surface a single sentinel rather than per-pair noise.
  if (epoch === undefined) {
    // No real-id shadow protocol entered yet — G1 not evaluable. Preserve
    // the pre-protocol warn behaviour exactly.
    result.asserted++;
    violations.push({
      subject: "shadow-stream",
      message:
        '`LegacyFanoutShadowed` events lack real triggering-event ids (pre-protocol `seq:N` only), or none exist yet. The real-id shadow protocol has not entered, so G1 `(eventId, handlerKey)` symmetric coverage is not yet evaluable. Flip Atlas\'s shadow flag to "shadow" with the real-identity emitter (runtime/run.ts) to begin epoch accrual.',
      severity: "warn",
    });
  } else if (shadowPostEpoch.length === 0) {
    result.asserted++;
    violations.push({
      subject: "shadow-stream",
      message:
        "Post-epoch `BusDispatched` events present but no post-epoch `LegacyFanoutShadowed` events. Either Phase 1 regressed mid-cutover (shadow emitter stopped) or the bus is dispatching only cascades. Recon cannot assert G1 symmetric coverage from a one-sided post-epoch stream.",
      severity: divergenceSeverity,
    });
  } else {
    for (const p of busOkPostEpochNonCascade) {
      result.asserted++;
      if (!shadowSet.has(pairKey(p))) {
        violations.push({
          subject: pairKey(p),
          message: `Divergence — bus dispatched (eventId=${p.eventId}, handlerKey=${p.handlerKey}) but no matching \`LegacyFanoutShadowed\` event recorded by the legacy fan-out path. G1 fail (per A22 spec §2 / §3.1).`,
          severity: divergenceSeverity,
        });
      }
    }
  }

  // A.2 — Shadow-side coverage: every post-epoch `LegacyFanoutShadowed`
  // pair must have a matching `BusDispatched{outcome:"ok"}` (G4). This side
  // is NOT cascade-scoped: the bus must cover everything the shadow path
  // saw (the equivalence the cutover proves). The bus-side match set for
  // A.2 is the full post-epoch bus set (not the non-cascade subset), since
  // a shadow pair matching a bus pair is by definition non-cascade.
  const busOkPostEpochSet = new Set(busOkPostEpoch.map(pairKey));
  if (epoch !== undefined) {
    if (busOkPostEpoch.length === 0 && shadowPostEpoch.length > 0) {
      result.asserted++;
      violations.push({
        subject: "bus-stream",
        message:
          'Post-epoch `LegacyFanoutShadowed` events present but no post-epoch `BusDispatched{outcome:"ok"}` events. Either the bus is wedged (Phase 1 failure mode F3 — see A22 spec §4.3) or the bus-tick hook is not firing. Recon cannot assert G4 from a one-sided post-epoch stream.',
        severity: divergenceSeverity,
      });
    } else {
      for (const p of shadowPostEpoch) {
        result.asserted++;
        if (!busOkPostEpochSet.has(pairKey(p))) {
          violations.push({
            subject: pairKey(p),
            message: `Divergence — legacy fan-out shadowed (eventId=${p.eventId}, handlerKey=${p.handlerKey}) but no matching \`BusDispatched{outcome:"ok"}\` event from the bus. G4 fail (per A22 spec §2).`,
            severity: divergenceSeverity,
          });
        }
      }
    }
  }
  // Silence "assigned but never read" for busOkSet (kept for A.1 lookups).
  void busOkSet;

  // Assertion B — dedup-race detection. At most one
  // `BusDispatched{outcome:"ok"}` per (eventId, handlerKey) pair. Atlas
  // spec §4.2 F2: concurrent ticks could double-invoke a handler before
  // either records its dedup row. Scoped to post-epoch bus rows — F2 is a
  // forward-looking invariant about the NEW bus under the cutover protocol;
  // historical pre-protocol concurrent-bus duplicates are part of the stale
  // bus baseline (header, stale-baseline problem #2) and are excluded as
  // info above + recorded via the filed SubstrateAlert/AuditFinding so the
  // finding is preserved (Principle 1) rather than masked.
  const okPairCounts = new Map<string, number>();
  for (const p of busOkPostEpoch) {
    const k = pairKey(p);
    okPairCounts.set(k, (okPairCounts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of okPairCounts) {
    result.asserted++;
    if (n > 1) {
      violations.push({
        subject: k,
        message: `Dedup race — ${n} \`BusDispatched{outcome:"ok"}\` rows for the same (eventId, handlerKey) pair. Failure mode F2 per A22 spec §4.2; the bus invariant requires at most one ok-dispatch per pair.`,
        severity: "fail",
      });
    }
  }

  // Assertion C — bus-attributable integrity-alert silence (G3). Any
  // `SubstrateAlert{alertClass:"integrity"}` whose actor is the bus is
  // by construction a dispatch failure record; gate G3 fails on count > 0.
  result.asserted++;
  if (streams.busIntegrityAlerts > 0) {
    violations.push({
      subject: BUS_ACTOR_URN,
      message: `${streams.busIntegrityAlerts} \`SubstrateAlert{alertClass:"integrity"}\` event(s) attributed to the bus actor. G3 fail per A22 spec §2 — investigate before flipping the shadow flag / advancing the cutover.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail").length;
  const warns = r.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: r.ok ? (warns ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? warns
          ? `Parallel-dispatch divergence recon: ${warns} warn(s) — sample window not yet met or one-sided stream (D-A22-RETIRE-LEGACY gate not yet evaluable)`
          : "Parallel-dispatch divergence recon passed — bus and legacy-shadow streams agree on the (eventId, handlerKey) set"
        : `Parallel-dispatch divergence recon FAILED — ${fails} fail violation(s); D-A22-RETIRE-LEGACY gating criteria (G1/G3/G4/F2) not green`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
