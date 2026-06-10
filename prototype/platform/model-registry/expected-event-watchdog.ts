// platform/model-registry/expected-event-watchdog.ts
//
// Expected-event watchdog — the documented Phase-B follow-on of the Trusted-
// Figures Program (objective 4, loud failure modes). The data-failure surface
// (data-failures-view.ts) catches figures that DID compute but landed
// `degraded`/`failed`. It cannot catch the other silent-gap shape: an event
// that should have been emitted this derive cycle but was NOT — e.g. the whole
// `emitCalculationProvenance()` try/catch bails (no CalculationPerformed lands
// at all), or `runDailyPnLReport()` throws-and-warns. In that case there is no
// degraded calc to show; downstream the figure quietly reads from stale/absent
// state instead of a fresh, trustworthy computation. That absence must be loud.
//
// This module declares the set of events that MUST exist for the bank's
// surfaced figures to be trustworthy, checks the live store, and emits a
// `SubstrateAlert{alertClass:"integrity"}` for each gap so the cross-page
// data-failure banner shows it. The calc-bound expectations are DERIVED from
// CALC_BINDINGS (the same source of truth as the Models page + recon:calc-
// model-binding) so a newly-bound figure cannot silently escape the watchdog.
//
// Cadence note (build phase): the bank derives on boot, not on a wall clock,
// so the check is presence ("≥1 such event exists"), not freshness. A freshness
// window (assert the event is no older than the cadence) is a documented future
// extension for when live wall-clock cadence exists.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

import { makeSubstrateAlert } from "../event-store/event-types/platform";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { CALC_BINDINGS } from "./calculation-binding";

const PROGRAM = "D-TRUSTED-FIGURES-PROGRAM-V1";
const ENTITY = "LE-ZA-HOZ-BANK";
const WATCHDOG_ACTOR: Actor = { type: "service", id: "agent:atlas:expected-event-watchdog" };

/**
 * An event that must be present in the store for the surfaced figures to be
 * trustworthy. Absence is a data-integrity fault, not a benign empty state.
 */
export interface ExpectedEvent {
  /** Lowercase-slug id, unique. Forms the SubstrateAlert alertId. */
  readonly id: string;
  /** Event type that must be present. */
  readonly eventType: string;
  /**
   * Optional predicate narrowing to a specific instance of `eventType` (e.g. a
   * particular bound figure's modelId). When omitted, ANY event of `eventType`
   * satisfies the expectation.
   */
  readonly matches?: (payload: Record<string, unknown>) => boolean;
  /** Human label for the missing figure/event. */
  readonly label: string;
  /** Position (+ agent) accountable for this event existing. */
  readonly owningRole: string;
  /** Why this event must exist — the silent gap it guards. */
  readonly rationale: string;
  readonly citation: string;
  /**
   * Optional freshness window, in business days. When set, presence alone is
   * NOT enough: the latest matching event's `as_of` must be no older than this
   * many business days from the check's `asOf`, else the expectation is a gap
   * (a *stale* gap). When omitted, the expectation is presence-only ("≥1 such
   * event exists") — the original build-phase contract.
   *
   * This is the freshness extension the module header flagged as future work:
   * it activates for events with a real wall-clock cadence (e.g. the daily
   * market-risk measure), without changing the presence-only semantics of the
   * existing boot-derive expectations. A freshness check only runs when the
   * caller supplies an `asOf` (e.g. `emitExpectedEventGapAlerts`); a presence-
   * only call (`checkExpectedEvents(store)` with no asOf) treats the figure as
   * present once ≥1 event exists.
   */
  readonly maxAgeBusinessDays?: number;
  /**
   * Optional, dated build-phase deferral. When set, an ABSENT expectation is
   * NOT a silent-red gap: it is a *tracked, dated* deferral — the event's
   * trigger does not yet exist on the live event flow (e.g. no accounting
   * period has closed, or there is no live regulator endpoint until licence-
   * day), so the absence is honest and expected, not a fault. The watchdog
   * still SURFACES it (kind `"deferred"`), so the disposition is visible rather
   * than hidden, but it is counted + rendered distinctly from a genuine
   * absence and raises no `SubstrateAlert{severity:high}`.
   *
   * This is the option-(b) disposition of the Trusted-Figures expected-event
   * surface: where faking the event would be a fabricated record, the watchdog
   * reflects reality ("deferred to <trigger>"), never silent red.
   *
   * A deferral self-clears: once a matching event lands (the trigger fires),
   * the expectation is `present` and the deferral is moot — no code change
   * needed. Reviewed at `reviewBy`; a stale deferral past its review date is a
   * Vera recon finding, not a permanent exemption.
   */
  readonly deferral?: {
    /** ISO date the deferral was recorded. */
    readonly since: string;
    /** When the deferral should be re-reviewed / is expected to clear. */
    readonly reviewBy: string;
    /** What real-world trigger must occur for the event to start landing. */
    readonly clearsWhen: string;
    /** Why deferring is honest rather than a hidden gap. */
    readonly rationale: string;
  };
}

/**
 * Business days elapsed from `earlier` to `later`, counting Mon–Fri only.
 * Weekends do not age a figure (no JSE close → no fresh mark). Public holidays
 * are not netted out — a ≥1-business-day window is forgiving enough that a
 * single holiday cannot trip a false positive (skipping weekends already
 * absorbs it). Returns 0 when `later <= earlier`.
 */
export function businessDaysBetween(earlier: Date, later: Date): number {
  if (later.getTime() <= earlier.getTime()) return 0;
  let count = 0;
  const cursor = new Date(
    Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate()),
  );
  const end = new Date(Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate()));
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

/**
 * Calc-bound expectations, derived from CALC_BINDINGS so the watchdog and the
 * binding registry cannot drift: every bound figure must have emitted at least
 * one CalculationPerformed (matched by its unique modelId).
 */
function calcBoundExpectations(): ExpectedEvent[] {
  return Object.values(CALC_BINDINGS).map((b) => ({
    id: `calc-${b.calcKey}`,
    eventType: "CalculationPerformed",
    matches: (p) => p.modelId === b.modelId,
    label: `${b.figure} calculation-history`,
    owningRole: b.owningAgent,
    rationale: `no CalculationPerformed has ever been emitted for ${b.figure} (model ${b.modelId}) — the figure has no calc-history and would surface from stale/absent state rather than a trustworthy computation`,
    citation: PROGRAM,
  }));
}

/**
 * Standalone periodic events that `bootDerive()` emits inside a silent-skip
 * try/catch — if they throw, no event lands and the failure is only a warn log.
 */
const STANDALONE_EXPECTATIONS: readonly ExpectedEvent[] = [
  {
    id: "daily-pnl",
    eventType: "DailyPnLReportGenerated",
    label: "Daily P&L report",
    owningRole: "Bea (Accounting and financial reporting engineer, engineering)",
    rationale:
      "no DailyPnLReportGenerated exists — the Product Control P&L run was skipped (caught + warned), so the desk P&L surfaces from no fresh report",
    citation: "IFRS-9-5.7.1",
  },
  {
    id: "balance-sheet",
    eventType: "BalanceSheetProjected",
    label: "Balance-sheet projection",
    owningRole: "Bea (Accounting and financial reporting engineer, engineering)",
    rationale:
      "no BalanceSheetProjected exists — the NSFR supplemental ASF/RSF line items (Tier-2, wholesale funding, encumbered assets) have no source, silently understating RSF",
    citation: "BA-326",
  },
  {
    // FX functionality domain review gap #4: the daily VaR / MR-1-FX measure
    // is emitted by Rohan's scheduled rohan:market-risk-measure run (cron
    // `30 18 * * 1-5`). maxAgeBusinessDays 1 makes this a FRESHNESS check, not
    // presence-only: if the latest MarketRiskMeasureComputed is older than one
    // business day, the scheduled run has not fired and Helena's MR-1-FX
    // appetite would be compared against a stale VaR — a loud SubstrateAlert.
    id: "mr-1-fx-var-measure",
    eventType: "MarketRiskMeasureComputed",
    label: "Daily market-risk measure (VaR / MR-1-FX)",
    owningRole: "Rohan (Risk engineer, engineering)",
    rationale:
      "the latest MarketRiskMeasureComputed (1-day 99% VaR / SVaR / ES) is missing or older than one business day — Rohan's daily rohan:market-risk-measure run has not fired, so Helena's MR-1-FX VaR appetite would be compared against a stale figure",
    citation: "D-BRC-INTERIM-MR-1-FX",
    maxAgeBusinessDays: 1,
  },
  {
    // FX functionality domain review gap #1: the BA-310 (market / position
    // risk — FX-NOP) return is generated + its SARB submission recorded by the
    // event-driven `bea:ba310-period-close` handler on every
    // AccountingPeriodClosed. Presence-only ("≥1 BA-310 submission exists"):
    // if no SarbSubmissionAttempted{formId:"BA310"} is in the store, the
    // BA-310 generation/submission path has never fired on the live event flow
    // and there is no automated SARB FX-NOP submission record at all. The
    // per-period completeness assertion (every CLOSED period has its BA-310
    // record) is the bespoke `recon:ba310-submission-completeness` gate; this
    // watchdog expectation guards the coarser "path never fired" shape and
    // surfaces it on the cross-page data-failure banner.
    id: "ba310-fx-nop-submission",
    eventType: "SarbSubmissionAttempted",
    matches: (p) => p.formId === "BA310",
    label: "BA-310 FX-NOP submission record",
    owningRole: "Bea (Accounting and financial reporting engineer, engineering)",
    rationale:
      "no SarbSubmissionAttempted{formId:BA310} exists — the BA-310 (market / position risk, FX-NOP) generation/submission path (bea:ba310-period-close) has never fired, so there is no automated SARB FX-NOP submission record on the live event flow",
    citation: "D-BA-RETURN-FORM-NUMBERING-RECON",
    // OPTION (b) — honest build-phase deferral, NOT a faked event. The
    // bea:ba310-period-close handler is correctly event-driven on
    // AccountingPeriodClosed, but the canonical store has ZERO closed accounting
    // periods (no AccountingPeriodClosed event exists), so the handler has never
    // had a trigger to fire on. Beyond that, the handler's comment is explicit:
    // the actual SARB e-filing TRANSPORT (mutual-TLS POST to the BankServ
    // prudential portal) is a licence-day capability — today there is only the
    // local simulator (submitToSarbPortal, mode "simulator"), "There is NO live
    // SARB filing channel today". Emitting a SarbSubmissionAttempted now would
    // fabricate a submission record for a period that was never closed and a
    // portal that does not exist — exactly the fake the no-silent-zero
    // discipline forbids. So the watchdog reflects reality: the expectation is
    // a tracked, dated deferral that self-clears the moment the first
    // AccountingPeriodClosed for LE-ZA-HOZ-BANK lands and the handler runs.
    // Authority: D-BA-RETURN-FORM-NUMBERING-RECON; D-REPORTING-CAPABILITY-M2-M3-
    // BUILD-PLAN; Principle 3 (cloud-native, licence-day transport swap).
    deferral: {
      since: "2026-06-10",
      reviewBy: "2026-09-10",
      clearsWhen:
        "the first AccountingPeriodClosed for LE-ZA-HOZ-BANK lands (the bea:ba310-period-close handler then generates + records the BA-310 FX-NOP submission via the SARB simulator); the live SARB e-filing transport itself activates at licence-day (M8 cloud migration, Principle 3)",
      rationale:
        "no accounting period has been closed on the canonical store (zero AccountingPeriodClosed events), so the event-driven handler has had no trigger; and the real SARB filing channel is a licence-day capability (build phase uses the local simulator only). Faking the submission event would fabricate a record for a never-closed period against a non-existent portal.",
    },
  },
];

/** The full set of events the watchdog asserts must exist. */
export function expectedEvents(): ExpectedEvent[] {
  return [...calcBoundExpectations(), ...STANDALONE_EXPECTATIONS];
}

/** A declared expectation with no matching event in the store. */
export interface ExpectedEventGap {
  readonly id: string;
  readonly eventType: string;
  readonly label: string;
  readonly owningRole: string;
  readonly rationale: string;
  readonly citation: string;
  /**
   * Why the expectation is a gap. `"absent"` — no matching event exists at all
   * and the absence is a genuine fault. `"deferred"` — no matching event exists
   * but the expectation carries a dated `deferral`, so the absence is honest +
   * expected (the trigger does not yet exist on the live event flow), surfaced
   * distinctly and NOT as silent red. `"stale"` — a matching event exists but
   * its `as_of` is older than the expectation's `maxAgeBusinessDays` window
   * (only possible when the caller supplied an `asOf`).
   */
  readonly kind: "absent" | "deferred" | "stale";
  /** For `kind: "stale"`, the `as_of` of the freshest matching event. */
  readonly latestAsOf?: string;
  /** For `kind: "deferred"`, the dated deferral disposition. */
  readonly deferral?: ExpectedEvent["deferral"];
}

/**
 * Every expected event that has no matching instance in the store — or, for an
 * expectation with `maxAgeBusinessDays` set and an `asOf` supplied, whose
 * freshest matching event is older than its business-day window (a *stale*
 * gap). Empty when the bank's derive cycle emitted everything it should, fresh
 * — the trustworthy state.
 *
 * `asOf` is optional: when omitted, freshness windows are NOT evaluated and the
 * check is presence-only (the original build-phase contract). When supplied
 * (e.g. from `emitExpectedEventGapAlerts`), `maxAgeBusinessDays` expectations
 * are graded against it.
 */
export function checkExpectedEvents(store: EventStore, asOf?: string): ExpectedEventGap[] {
  const gaps: ExpectedEventGap[] = [];
  const asOfDate = asOf ? new Date(asOf) : null;
  for (const exp of expectedEvents()) {
    // Find the freshest matching event (by as_of) in one pass.
    let latestAsOf: string | null = null;
    for (const ev of store.replay({ type: exp.eventType })) {
      if (exp.matches && !exp.matches(ev.payload)) continue;
      if (latestAsOf === null || ev.as_of > latestAsOf) latestAsOf = ev.as_of;
    }

    if (latestAsOf === null) {
      // No matching event. A dated deferral makes this an honest, tracked
      // "deferred" disposition (the trigger does not yet exist) rather than a
      // genuine "absent" fault — surfaced distinctly, never silent red.
      gaps.push({
        id: exp.id,
        eventType: exp.eventType,
        label: exp.label,
        owningRole: exp.owningRole,
        rationale: exp.deferral
          ? `${exp.rationale} — DEFERRED (since ${exp.deferral.since}, review by ${exp.deferral.reviewBy}): ${exp.deferral.rationale} Clears when: ${exp.deferral.clearsWhen}`
          : exp.rationale,
        citation: exp.citation,
        kind: exp.deferral ? "deferred" : "absent",
        ...(exp.deferral ? { deferral: exp.deferral } : {}),
      });
      continue;
    }

    // Present — apply the freshness window if one is declared and we have an asOf.
    if (
      exp.maxAgeBusinessDays !== undefined &&
      asOfDate !== null &&
      businessDaysBetween(new Date(latestAsOf), asOfDate) > exp.maxAgeBusinessDays
    ) {
      const ageBd = businessDaysBetween(new Date(latestAsOf), asOfDate);
      gaps.push({
        id: exp.id,
        eventType: exp.eventType,
        label: exp.label,
        owningRole: exp.owningRole,
        rationale: `${exp.rationale} (latest as_of ${latestAsOf.slice(0, 10)} is ${ageBd} business day(s) old; window is ${exp.maxAgeBusinessDays})`,
        citation: exp.citation,
        kind: "stale",
        latestAsOf,
      });
    }
  }
  return gaps;
}

/**
 * The alertId an ABSENT gap raises — stable so emission is idempotent (one
 * alert per never-emitted figure).
 */
export function gapAlertId(gapId: string): string {
  return `alert:integrity:expected-event-${gapId}`;
}

/**
 * The alertId a STALE gap raises. Date-stamped (`<asOf YYYY-MM-DD>`) so a
 * freshly-stale business day re-alerts rather than being suppressed by the
 * idempotency guard — staleness is an ongoing condition that must keep
 * surfacing until the scheduled run catches up, unlike a one-shot absence.
 */
export function staleGapAlertId(gapId: string, asOf: string): string {
  return `alert:integrity:expected-event-stale-${gapId}-${asOf.slice(0, 10)}`;
}

/**
 * Emit a `SubstrateAlert{alertClass:"integrity"}` for each open expected-event
 * gap, so the cross-page data-failure banner surfaces it. Idempotent: a gap
 * whose alertId is already in the log is skipped (append-only audit trail; a
 * resolved-then-regressed gap re-alerting is a documented future extension once
 * alert-resolution events exist).
 */
export function emitExpectedEventGapAlerts(
  store: EventStore,
  asOf: string,
): { emitted: string[]; skipped: string[] } {
  const emitted: string[] = [];
  const skipped: string[] = [];

  const existingAlertIds = new Set<string>();
  for (const ev of store.replay({ type: "SubstrateAlert" })) {
    const id = (ev.payload as { alertId?: string }).alertId;
    if (id) existingAlertIds.add(id);
  }

  for (const gap of checkExpectedEvents(store, asOf)) {
    // A DEFERRED gap is an honest, tracked disposition — not a fault. It is
    // surfaced on the data-failure banner with kind "deferred" (so the
    // disposition is visible), but it raises NO severity:high integrity alert:
    // a loud red alert for an expected, dated build-phase deferral would be
    // exactly the false-positive the deferral mechanism exists to prevent. The
    // deferral self-clears when its trigger lands.
    if (gap.kind === "deferred") {
      skipped.push(gap.id);
      continue;
    }
    const alertId = gap.kind === "stale" ? staleGapAlertId(gap.id, asOf) : gapAlertId(gap.id);
    if (existingAlertIds.has(alertId)) {
      skipped.push(gap.id);
      continue;
    }
    store.append(
      makeSubstrateAlert({
        asOf,
        entity: ENTITY,
        actor: WATCHDOG_ACTOR,
        citations: [PROGRAM, gap.citation],
        payload: {
          alertId,
          alertClass: "integrity",
          details: `Expected-event gap: ${gap.label} — ${gap.rationale}. Owner: ${gap.owningRole}.`,
          severity: "high",
        },
      }),
    );
    emitted.push(gap.id);
  }

  return { emitted, skipped };
}
