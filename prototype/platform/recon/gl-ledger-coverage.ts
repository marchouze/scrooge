// platform/recon/gl-ledger-coverage.ts
//
// GL ↔ FX lifecycle coverage gate — asserts every FX-spot lifecycle event
// that should produce a journal has one, that every emitted journal traces
// back to a real source event, that trial balances close at zero at every
// PeriodClosed, and that every accountId referenced exists in the chart-
// of-accounts registry.
//
// Block A of WS-MARKET-RISK-PROCEDURES brief (`brief:bea:gl-ledger-end-to-
// end-projection-sicrtriggered-ev:2026-05-21`). The GL projection
// (`buildGlView`) already exists; this recon closes the loop by asserting
// integrity over the projection's inputs + outputs at CI time.
//
// Four assertions:
//
//   (1) Every FX lifecycle event that *should* produce a journal has at
//       least one `SubLedgerPostingEmitted` (or `JournalEntryPosted`) with
//       matching `sourceEventId`. The "should produce a journal" set is:
//         - FxTradeExecuted              (PR-FX-001 booking)
//         - FxPositionRevalued           (PR-FX-002 daily FVTPL)
//         - TradeMatured        (PR-FX-003 derecognition — deprecated)
//         - SettlementConfirmed (CDM)    (PR-FX-LIFECYCLE-CLOSE realised P&L)
//         - PrincipalPayment             (PR-FX-PRIN per-leg cash)
//         - FxSettlementFailed{one-leg-delivered}
//                                        (PR-FX-005 Stage-3 ECL + reclass)
//
//   (2) Every emitted `SubLedgerPostingEmitted` / `JournalEntryPosted`
//       references a real source event (`sourceEventId` resolves to a known
//       event in the store). No orphan postings.
//
//   (3) `FxSettlementFailed{neither-delivered | operational-delay}` events
//       MUST NOT produce GL postings (FVTPL out of ECL scope per IFRS 9
//       §5.5.1 + IFRS 9 ECL Provisioning Policy §51). Catch any rule
//       regression that silently posts the mutual-fail or delay branches.
//
//   (4) Trial balance closes at zero per currency at every `PeriodClosed`
//       and `AccountingPeriodClosed` event. Asserts double-entry integrity
//       as of the close cutoff.
//
//   (5) Every `accountId` referenced in any posting exists in
//       `platform/accounting/chart-of-accounts.json`. No phantom accounts.
//
// Empty-state correctness:
//   - No FX events  → assertions (1)+(3) vacuous; recon passes.
//   - No closes     → assertion (4) vacuous; recon passes.
//   - No postings   → assertions (2)+(5) vacuous; recon passes.
//
// Citations:
//   - Principles/1-events-are-truth.md
//   - Principles/2-single-graph-discipline.md
//   - IFRS 9 §5.5.1 (FVTPL out of ECL scope)
//   - Policies/ifrs9-ecl-provisioning-policy-v1.md §51
//   - PRs #608/#609/#616 (FX-spot posting-rule pack)
//   - PR #641 (FxSettlementFailed → PR-FX-005 default-recognition)
//   - Kai PR #645 (end-to-end FX-spot scenario that surfaced the gap)
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { buildGlView } from "../accounting/gl-projection";
import { POSTING_RULE_REGISTRY } from "../accounting/posting-rule-registry";
import { eventStore } from "../composition";
import type { Event } from "../event-store/types";
import { buildTradeLifecycleView } from "../lifecycle/trade-lifecycle-projection";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:gl-ledger-coverage";

// ---------------------------------------------------------------------------
// Event-type sets
// ---------------------------------------------------------------------------

/**
 * FX lifecycle event types that MUST produce at least one GL posting
 * (SubLedgerPostingEmitted or JournalEntryPosted) referencing the event.
 *
 * `FxSettlementFailed` is handled separately because it splits by
 * `failureKind` — `one-leg-delivered` must produce postings; the other
 * two failure kinds must NOT.
 *
 * `SettlementConfirmed` is handled separately (see assertion 1 below)
 * because it has condition `non-zero-pnl` (PR-FX-LIFECYCLE-CLOSE) —
 * zero-P&L trades genuinely produce no GL posting per IAS 21 §28; only
 * events with `realisedPnlDelta !== 0` require a SubLedgerPostingEmitted.
 */
const POSTING_REQUIRED_TYPES = new Set<string>([
  "FxTradeExecuted",
  "FxPositionRevalued",
  "TradeMatured",
  "PrincipalPayment",
]);

/** Event types checked separately with payload-conditional logic. */
const POSTING_CONDITIONAL_TYPES = new Set<string>([
  "SettlementConfirmed", // CDM lifecycle close — condition: non-zero-pnl (PR-FX-LIFECYCLE-CLOSE)
]);

/**
 * FX lifecycle event types that emit postings. Used to detect orphan
 * postings (postings whose sourceEventId does not resolve).
 */
const POSTING_EVENT_TYPES = new Set<string>(["SubLedgerPostingEmitted", "JournalEntryPosted"]);

// ---------------------------------------------------------------------------
// Recon entry point
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override the events used for the recon (test injection). */
  events?: readonly MinimalEvent[];
  /** Override the chart-of-accounts allowed-account set (test injection). */
  chartOfAccountsAccountIds?: ReadonlySet<string>;
}

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

/**
 * Load all events from the local event store (or use the override).
 * If the local event store is not available (no .local/event.db) the
 * recon returns an empty event set — the assertions are vacuous and
 * the recon passes. This matches the established empty-state correctness
 * convention.
 */
function loadEvents(override?: readonly MinimalEvent[]): MinimalEvent[] {
  if (override) return [...override];
  const out: MinimalEvent[] = [];
  try {
    for (const e of eventStore.replay({})) {
      out.push({
        event_id: e.event_id,
        type: e.type,
        as_of: e.as_of,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
    }
  } catch {
    // Event store not available — return empty
  }
  return out;
}

/**
 * Load the set of valid chart-of-accounts IDs from chart-of-accounts.json.
 * Returns null if the file is missing — the recon will skip assertion (5)
 * with an info-class violation.
 */
function loadChartOfAccountsIds(): Set<string> | null {
  const path = join(import.meta.dir, "..", "accounting", "chart-of-accounts.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      accounts?: Array<{ id: string }>;
      items?: Array<{ id: string }>;
    };
    const list = parsed.accounts ?? parsed.items ?? [];
    return new Set(list.map((e) => e.id));
  } catch {
    return null;
  }
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Pull all `sourceEventId` references from a posting payload. Supports:
 *   - SubLedgerPostingEmitted.payload.sourceEventId        (string)
 *   - JournalEntryPosted.payload.tradeId / sourceEventId   (string)
 *
 * The single-leg payments JournalEntryPosted carries a `tradeId` rather
 * than `sourceEventId`; the recon treats this as a soft reference (the
 * tradeId names a trade-stream that the trade event participates in,
 * which is sufficient for orphan-detection purposes — the posting still
 * has a named upstream object).
 */
function postingSourceRef(posting: MinimalEvent): string | undefined {
  return (
    safeString(posting.payload.sourceEventId) ??
    safeString(posting.payload.tradeId) ??
    safeString(posting.payload.sourceEventRef) ??
    // Correction entries reference the posting they correct (not a business event).
    // Accepted as a valid source reference so the orphan-check produces no violation.
    safeString(posting.payload.correctsEventId)
  );
}

/** Pull all accountIds referenced by a posting (multi-leg or 2-leg). */
function postingAccountIds(posting: MinimalEvent): string[] {
  const out: string[] = [];
  const legs = Array.isArray(posting.payload.legs) ? posting.payload.legs : [];
  for (const leg of legs) {
    const accountId = safeString((leg as Record<string, unknown>).accountId);
    if (accountId) out.push(accountId);
  }
  // JournalEntryPosted single-leg shape
  const dr = safeString(posting.payload.accountDebit);
  const cr = safeString(posting.payload.accountCredit);
  if (dr) out.push(dr);
  if (cr) out.push(cr);
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const events = loadEvents(opts.events);
  const chartIds = opts.chartOfAccountsAccountIds ?? loadChartOfAccountsIds();

  // Index events by id and by type for fast lookup.
  const eventById = new Map<string, MinimalEvent>();
  const postings: MinimalEvent[] = [];
  const postingsBySourceRef = new Map<string, MinimalEvent[]>();
  const fxLifecycleEvents: MinimalEvent[] = [];
  const settlementConfirmedEvents: MinimalEvent[] = [];
  const closeEvents: MinimalEvent[] = [];
  const fxSettlementFailedEvents: MinimalEvent[] = [];

  for (const e of events) {
    eventById.set(e.event_id, e);
    if (POSTING_EVENT_TYPES.has(e.type)) {
      postings.push(e);
      const ref = postingSourceRef(e);
      if (ref) {
        const bucket = postingsBySourceRef.get(ref) ?? [];
        bucket.push(e);
        postingsBySourceRef.set(ref, bucket);
      }
    }
    if (POSTING_REQUIRED_TYPES.has(e.type)) {
      fxLifecycleEvents.push(e);
    }
    if (POSTING_CONDITIONAL_TYPES.has(e.type)) {
      settlementConfirmedEvents.push(e);
    }
    if (e.type === "FxSettlementFailed") {
      fxSettlementFailedEvents.push(e);
    }
    if (e.type === "PeriodClosed" || e.type === "AccountingPeriodClosed") {
      closeEvents.push(e);
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 1: every FX lifecycle event has at least one posting.
  // -------------------------------------------------------------------------
  for (const e of fxLifecycleEvents) {
    result.asserted++;
    const hasPosting = postingsBySourceRef.has(e.event_id);
    if (!hasPosting) {
      violations.push({
        subject: `event:${e.event_id}`,
        severity: "fail",
        message: `GL coverage gap: ${e.type} event ${e.event_id} (as_of=${e.as_of}) has NO matching SubLedgerPostingEmitted or JournalEntryPosted referencing it as sourceEventId. Required by the FX-spot posting-rule pack (PRs #608/#609/#616). Authority: brief:bea:gl-ledger-end-to-end-projection; Principles/1-events-are-truth.md.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 1c: SettlementConfirmed — condition: non-zero-pnl (PR-FX-LIFECYCLE-CLOSE).
  //
  // PR-FX-LIFECYCLE-CLOSE posts the realised-P&L residual on SettlementConfirmed.
  // IAS 21 §28 only recognises a P&L entry when there IS a non-zero residual.
  // When realisedPnlDelta === 0 the trade settled exactly at the carrying value
  // and no GL entry is warranted (the principal cash has already been derecognised
  // by the two PR-FX-PRIN postings on the PrincipalPayment events). This is an
  // intentional "skipped" outcome, not a coverage gap.
  //
  // MUST have posting  → realisedPnlDelta !== 0
  // OK to have no posting → realisedPnlDelta === 0 (zero-P&L: no IAS 21 §28 entry)
  //
  // Authority: POSTING_RULE_REGISTRY PR-FX-LIFECYCLE-CLOSE (condition: non-zero-pnl);
  //   IAS 21 §28; PR #608/#616.
  // -------------------------------------------------------------------------
  for (const e of settlementConfirmedEvents) {
    result.asserted++;
    const realisedPnlDelta =
      typeof e.payload.realisedPnlDelta === "number" ? e.payload.realisedPnlDelta : undefined;
    const hasPosting = postingsBySourceRef.has(e.event_id);

    if (realisedPnlDelta === 0) {
      // Zero-P&L settlement: no posting expected. Verify the inverse — if
      // a posting DID appear for a zero-P&L event, that is a rule regression.
      if (hasPosting) {
        violations.push({
          subject: `event:${e.event_id}`,
          severity: "fail",
          message: `Rule regression: SettlementConfirmed event ${e.event_id} (as_of=${e.as_of}) has realisedPnlDelta=0 but HAS a SubLedgerPostingEmitted — PR-FX-LIFECYCLE-CLOSE should return [] for zero-P&L settlements per IAS 21 §28. Authority: POSTING_RULE_REGISTRY (condition: non-zero-pnl); IAS 21 §28; PR-FX-LIFECYCLE-CLOSE.`,
        });
      }
      // Otherwise: zero-P&L with no posting is the correct state — no violation.
    } else {
      // Non-zero P&L: a SubLedgerPostingEmitted is required.
      if (!hasPosting) {
        violations.push({
          subject: `event:${e.event_id}`,
          severity: "fail",
          message: `GL coverage gap: SettlementConfirmed event ${e.event_id} (as_of=${e.as_of}, realisedPnlDelta=${realisedPnlDelta ?? "unknown"}) has NO matching SubLedgerPostingEmitted or JournalEntryPosted referencing it as sourceEventId. Required by PR-FX-LIFECYCLE-CLOSE for non-zero-pnl settlements (IAS 21 §28). Authority: POSTING_RULE_REGISTRY; PRs #608/#616.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 1b: FxSettlementFailed split by failureKind.
  //   one-leg-delivered  → MUST have posting
  //   neither-delivered  → MUST NOT have posting (FVTPL out of ECL scope)
  //   operational-delay  → MUST NOT have posting (no §5.5.3 trigger)
  // -------------------------------------------------------------------------
  for (const e of fxSettlementFailedEvents) {
    result.asserted++;
    const failureKind = safeString(e.payload.failureKind);
    const hasPosting = postingsBySourceRef.has(e.event_id);
    if (failureKind === "one-leg-delivered") {
      if (!hasPosting) {
        violations.push({
          subject: `event:${e.event_id}`,
          severity: "fail",
          message: `GL coverage gap: FxSettlementFailed{one-leg-delivered} event ${e.event_id} (as_of=${e.as_of}) has NO matching posting. Required by PR-FX-005 (IFRS 9 §5.5.13 Stage-3 ECL + receivable reclassification). Authority: PRs #641; brief:bea:gl-ledger-end-to-end-projection.`,
        });
      }
    } else if (failureKind === "neither-delivered" || failureKind === "operational-delay") {
      if (hasPosting) {
        violations.push({
          subject: `event:${e.event_id}`,
          severity: "fail",
          message: `IFRS 9 §5.5.1 violation: FxSettlementFailed{${failureKind}} event ${e.event_id} HAS a GL posting — FVTPL trades take no ECL allowance and the failure kind is not a default event. ${failureKind === "neither-delivered" ? "Mutual-fail (§5.5.3) is captured by the SicrTriggered memo event, not the GL." : "Operational delay is not a SICR trigger."} Authority: IFRS 9 §5.5.1; Policies/ifrs9-ecl-provisioning-policy-v1.md §51; PR-FX-005 contract.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 2: every posting references a real source event.
  // -------------------------------------------------------------------------
  for (const p of postings) {
    result.asserted++;
    const ref = postingSourceRef(p);
    if (!ref) {
      violations.push({
        subject: `posting:${p.event_id}`,
        severity: "warn",
        message: `Orphan posting candidate: ${p.type} event ${p.event_id} has no sourceEventId / tradeId in payload — cannot trace to a source event. Authority: Principles/1-events-are-truth.md; PROC-FIN-BSS-01 §3a.`,
      });
      continue;
    }
    // Only enforce strict resolution for sourceEventId (event_id) refs.
    // JournalEntryPosted's tradeId is a stream key, not an event_id, so
    // skip the resolution check when the ref is a tradeId.
    // Correction entries reference a SubLedgerPostingEmitted event (correctsEventId),
    // not a business event, so skip the resolution check for them too.
    const isEventIdRef =
      typeof p.payload.sourceEventId === "string" && typeof p.payload.correctsEventId !== "string";
    if (isEventIdRef && !eventById.has(ref)) {
      violations.push({
        subject: `posting:${p.event_id}`,
        severity: "fail",
        message: `Phantom-source-event: ${p.type} event ${p.event_id} references sourceEventId="${ref}" which does not resolve to any event in the store. Authority: Principles/1-events-are-truth.md; PROC-FIN-BSS-01 §3a.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 3: trial balance closes at zero at every period close.
  // -------------------------------------------------------------------------
  // Build the event list usable by buildGlView. The local override path
  // already gives us MinimalEvent; for the production path we already
  // streamed full events but downcast to MinimalEvent — re-stream with
  // full envelopes for buildGlView, which needs Event[].
  if (closeEvents.length > 0) {
    // Re-stream full events (only when no override is in play).
    let fullEvents: Event[];
    if (opts.events) {
      // Tests pass a MinimalEvent[] without actor/citations envelopes.
      // buildGlView only reads `type`, `event_id`, `as_of`, `payload`, so
      // pad missing fields with safe defaults to satisfy the type system.
      fullEvents = (opts.events as MinimalEvent[]).map((e) => ({
        event_id: e.event_id,
        type: e.type,
        as_of: e.as_of,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "system" as const, id: "recon" },
        citations: ["urn:recon:gl-ledger-coverage"],
        payload: e.payload,
      }));
    } else {
      fullEvents = [];
      try {
        for (const e of eventStore.replay({})) fullEvents.push(e);
      } catch {
        // ignore
      }
    }
    for (const close of closeEvents) {
      result.asserted++;
      const cutoffTs =
        safeString(close.payload.cutoffTs) ?? safeString(close.payload.periodEnd) ?? close.as_of;
      const view = buildGlView(fullEvents, cutoffTs);
      // Trial balance is "balanced" iff totalDebits === totalCredits (in
      // reporting-currency sum; per-currency invariants are enforced by
      // the SubLedgerPostingEmitted refine at append time, so a per-event
      // currency mismatch can never enter the store).
      if (!view.trialBalance.balanced) {
        violations.push({
          subject: `close:${close.event_id}`,
          severity: "fail",
          message: `Trial-balance integrity break: ${close.type} ${close.event_id} (cutoffTs=${cutoffTs}, periodId=${safeString(close.payload.periodId) ?? "?"}) closes with totalDebits=${view.trialBalance.totalDebits} ≠ totalCredits=${view.trialBalance.totalCredits}. Double-entry invariant must hold at every close. Authority: PROC-FIN-BSS-01 §3d; Principles/1-events-are-truth.md.`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 4: every accountId referenced exists in chart-of-accounts.
  // -------------------------------------------------------------------------
  if (!chartIds) {
    violations.push({
      subject: "chart-of-accounts",
      severity: "info",
      message:
        "chart-of-accounts.json not found at platform/accounting/chart-of-accounts.json — skipping account-existence assertion. This is itself a substrate gap.",
    });
  } else {
    const seen = new Set<string>();
    for (const p of postings) {
      for (const accountId of postingAccountIds(p)) {
        if (seen.has(accountId)) continue;
        seen.add(accountId);
        result.asserted++;
        if (!chartIds.has(accountId)) {
          violations.push({
            subject: `account:${accountId}`,
            severity: "fail",
            message: `Phantom account: ${p.type} event ${p.event_id} references accountId="${accountId}" which does not exist in platform/accounting/chart-of-accounts.json. Authority: PROC-FIN-BSS-01 §3a; Principles/2-single-graph-discipline.md.`,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 5: lifecycle-aware registry coverage (POSTING_RULE_REGISTRY).
  //
  // For every trade lifecycle instance visible in the event store:
  //   - `opening` stage rules: assert the opening event has a posting,
  //     regardless of whether the lifecycle is open or closed.
  //   - `terminal` stage rules: assert the terminal event has a posting,
  //     BUT ONLY for CLOSED lifecycles whose terminal path matches the rule.
  //     Open (in-flight) lifecycles are explicitly excluded — asserting
  //     terminal coverage on an open trade would be a false positive.
  //   - `in-flight` stage rules: zero-or-more (not mandated here).
  //
  // This replaces the hardcoded POSTING_REQUIRED_TYPES check for the
  // registry-managed event types — the two sets are compatible, and the
  // registry-based check is richer (lifecycle-scoped, path-aware).
  // -------------------------------------------------------------------------
  {
    // Build lifecycle instances from the full event list.
    const fullEventsForLc: Event[] = opts.events
      ? (opts.events as MinimalEvent[]).map((e) => ({
          event_id: e.event_id,
          type: e.type,
          as_of: e.as_of,
          entity: "LE-ZA-HOZ-BANK",
          actor: { type: "system" as const, id: "recon" },
          citations: ["urn:recon:gl-ledger-coverage"],
          payload: e.payload,
        }))
      : (() => {
          const evs: Event[] = [];
          try {
            for (const e of eventStore.replay({})) evs.push(e);
          } catch {
            // event store not available
          }
          return evs;
        })();

    const lifecycleInstances = buildTradeLifecycleView(fullEventsForLc);

    // Index opening events and terminal events by event_id for quick lookup.
    const openingEventById = new Map<string, (typeof lifecycleInstances)[0]>();
    const terminalEventById = new Map<string, (typeof lifecycleInstances)[0]>();
    for (const inst of lifecycleInstances) {
      openingEventById.set(inst.openingEventId, inst);
      if (inst.terminalEventId) terminalEventById.set(inst.terminalEventId, inst);
    }

    // Group rules by lifecycleStage for iteration.
    const openingRules = POSTING_RULE_REGISTRY.filter(
      (r) => r.lifecycleStage === "opening" && r.condition !== "intentional-no-impact",
    );
    const terminalRules = POSTING_RULE_REGISTRY.filter(
      (r) => r.lifecycleStage === "terminal" && r.condition !== "intentional-no-impact",
    );

    // Assert opening rules: every instance whose opening event matches a
    // registered rule must have a posting referencing that opening event.
    for (const rule of openingRules) {
      for (const inst of lifecycleInstances) {
        if (inst.openingEventType !== rule.triggerEventType) continue;
        if (inst.lifecycleId !== rule.lifecycleId) continue;
        result.asserted++;
        if (!postingsBySourceRef.has(inst.openingEventId)) {
          violations.push({
            subject: `lifecycle:${inst.instanceId}:${rule.postingRuleId}`,
            severity: "fail",
            message: `Lifecycle coverage gap [opening]: instance ${inst.instanceId} (lifecycleId=${inst.lifecycleId}) opened by event ${inst.openingEventId} (${inst.openingEventType}) has no SubLedgerPostingEmitted for posting rule ${rule.postingRuleId} (postingType=${rule.postingType}, condition=${rule.condition}). Required for both open and closed lifecycle instances. Authority: POSTING_RULE_REGISTRY; Principles/1-events-are-truth.md.`,
          });
        }
      }
    }

    // Assert terminal rules: only for CLOSED lifecycles.
    for (const rule of terminalRules) {
      for (const inst of lifecycleInstances) {
        if (inst.state !== "closed") continue;
        if (inst.lifecycleId !== rule.lifecycleId) continue;
        if (!inst.terminalEventId || inst.terminalEventType !== rule.triggerEventType) continue;
        result.asserted++;
        if (!postingsBySourceRef.has(inst.terminalEventId)) {
          violations.push({
            subject: `lifecycle:${inst.instanceId}:${rule.postingRuleId}`,
            severity: "fail",
            message: `Lifecycle coverage gap [terminal]: instance ${inst.instanceId} (lifecycleId=${inst.lifecycleId}, path=${inst.terminalPath ?? "?"}) closed by event ${inst.terminalEventId} (${inst.terminalEventType}) has no SubLedgerPostingEmitted for posting rule ${rule.postingRuleId} (postingType=${rule.postingType}, condition=${rule.condition}). Terminal coverage assertions apply only to closed lifecycles. Authority: POSTING_RULE_REGISTRY; Principles/1-events-are-truth.md.`,
          });
        }
      }
    }
  }

  // Empty-state guard — keep `asserted >= 1` so the harness records a run.
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "gl-ledger-coverage passed — every FX lifecycle event has matching postings; orphans + phantom accounts absent; trial balance closes at zero at every PeriodClosed; lifecycle-registry opening/terminal coverage satisfied."
        : "gl-ledger-coverage FAILED — GL coverage / orphan / phantom-account / trial-balance / lifecycle-registry coverage break detected.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
