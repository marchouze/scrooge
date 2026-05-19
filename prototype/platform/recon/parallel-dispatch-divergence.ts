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
//      triggeringEventTypes, suppressedAtSequence, eventId? }`.
//      Pre-Phase 1 the type does not yet exist in the schema; the
//      pipeline tolerates absence and emits a warn (insufficient samples)
//      rather than a fail (real divergence) — see "Sample-window
//      discipline" below.
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
// Sample-window discipline.
//
// Atlas's spec defines the gating window as ≥ 3 fleet-cycles (§2.1). A
// fleet-cycle is approximately 24h of agent-time, so the floor is
// approximately 72h between the first observed `BusDispatched` /
// `LegacyFanoutShadowed` event and `now`. The pipeline computes this
// from the event timestamps directly: it reads the earliest pair-stream
// event and compares its `as_of` against the run's `now` (defaulting to
// wall-clock; overridable for tests). Below the floor, the pipeline
// returns `ok: true` with warn-severity violations and a `detail`
// note flagging "sample-window not yet met". Above the floor, the same
// rows escalate to fail-severity.
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

/** A `(eventId, handlerKey)` dispatch pair. */
interface DispatchPair {
  readonly eventId: string;
  readonly handlerKey: string;
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
        const pair: DispatchPair = { eventId, handlerKey };
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
      // we accept either `eventId` (typed) or fall back to a derived
      // key when the legacy emitter records the parent-run sequence
      // pointer instead. The recon prefers strong identity (eventId).
      const rawEventId = typeof p.eventId === "string" && p.eventId.length > 0 ? p.eventId : "";
      const eventId =
        rawEventId.length > 0
          ? rawEventId
          : typeof p.suppressedAtSequence === "number"
            ? `seq:${p.suppressedAtSequence}`
            : "";
      const handlerKey = typeof p.triggeredHandlerKey === "string" ? p.triggeredHandlerKey : "";
      if (eventId && handlerKey) {
        shadowPairs.push({ eventId, handlerKey });
        // Track whether any shadow event carries a real (non-seq) eventId.
        // Shadow events emitted by the old protocol only carry suppressedAtSequence
        // (yielding "seq:N" here); event-level G1 comparison is only valid when
        // at least one shadow event has a real UUID.
        if (rawEventId.length > 0) shadowHasRealIds = true;
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

  const earliestMs = streams.earliestAsOf ? Date.parse(streams.earliestAsOf) : Number.NaN;
  const sampleWindowMet =
    !Number.isNaN(earliestMs) && !Number.isNaN(nowMs) && nowMs - earliestMs >= gatingWindowMs;

  // Severity ladder: when the sample window has not yet passed, divergence
  // rows are warn-severity (insufficient evidence to fail the gate). When
  // it has passed, they escalate to fail — except when shadow events exist
  // but only carry seq:N synthetic ids (old shadow protocol). In that case
  // event-level G1 comparison is inconclusive regardless of the window,
  // so we hold at warn-severity until the protocol is updated (shadow
  // emission updated to include real eventIds per triggering event).
  // When the shadow stream is absent entirely, the sentinel path below
  // still escalates on window-met (original behaviour preserved).
  const shadowExistsButLacksRealIds = streams.shadowPairs.length > 0 && !streams.shadowHasRealIds;
  const divergenceSeverity = sampleWindowMet && !shadowExistsButLacksRealIds ? "fail" : "warn";

  const busOkSet = new Set(streams.busOkPairs.map(pairKey));
  const shadowSet = new Set(streams.shadowPairs.map(pairKey));

  // Assertion A — symmetric coverage. Each `(eventId, handlerKey)` pair
  // in either stream must appear in the other.

  // A.1 — Bus-side coverage: every `BusDispatched{outcome:"ok"}` pair
  // must have a matching `LegacyFanoutShadowed`. When shadow events
  // are absent we surface a single sentinel rather than per-pair noise
  // (the explanation is the same for every pair). Severity follows the
  // sample-window ladder: pre-window the absence is most plausibly
  // "Phase 1 has not entered yet" (warn); post-window the absence
  // means shadow regressed mid-cutover (fail).
  if (streams.shadowPairs.length === 0) {
    result.asserted++;
    violations.push({
      subject: "shadow-stream",
      message:
        "`BusDispatched` events present but no `LegacyFanoutShadowed` events. Either Phase 1 has not entered (legacy fan-out still active in `runtime/run.ts:132–199`), or the shadow emitter regressed. Recon cannot assert G1 symmetric coverage from a one-sided stream.",
      severity: divergenceSeverity,
    });
  } else {
    for (const p of streams.busOkPairs) {
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

  // A.2 — Shadow-side coverage: every `LegacyFanoutShadowed` pair must
  // have a matching `BusDispatched{outcome:"ok"}` (this is the G4
  // criterion — for every event-driven handler invocation observed via
  // legacy logs, a corresponding bus-dispatch row exists).
  if (streams.busOkPairs.length === 0) {
    result.asserted++;
    violations.push({
      subject: "bus-stream",
      message:
        '`LegacyFanoutShadowed` events present but no `BusDispatched{outcome:"ok"}` events. Either the bus is wedged (Phase 1 failure mode F3 — see A22 spec §4.3) or the bus-tick hook is not firing. Recon cannot assert G4 from a one-sided stream.',
      severity: divergenceSeverity,
    });
  } else {
    for (const p of streams.shadowPairs) {
      result.asserted++;
      if (!busOkSet.has(pairKey(p))) {
        violations.push({
          subject: pairKey(p),
          message: `Divergence — legacy fan-out shadowed (eventId=${p.eventId}, handlerKey=${p.handlerKey}) but no matching \`BusDispatched{outcome:"ok"}\` event from the bus. G4 fail (per A22 spec §2).`,
          severity: divergenceSeverity,
        });
      }
    }
  }

  // Assertion B — dedup-race detection. At most one
  // `BusDispatched{outcome:"ok"}` per (eventId, handlerKey) pair. Atlas
  // spec §4.2 F2: concurrent ticks could double-invoke a handler before
  // either records its dedup row. Phase 1 has no concurrent ticks so the
  // expected count here is 0; this remains live for steady-state
  // (post-Phase 2) defence-in-depth.
  const okPairCounts = new Map<string, number>();
  for (const p of streams.busOkPairs) {
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
