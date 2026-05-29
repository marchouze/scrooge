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
}

/**
 * Every expected event that has no matching instance in the store. Empty when
 * the bank's derive cycle emitted everything it should — the trustworthy state.
 */
export function checkExpectedEvents(store: EventStore): ExpectedEventGap[] {
  const gaps: ExpectedEventGap[] = [];
  for (const exp of expectedEvents()) {
    let found = false;
    for (const ev of store.replay({ type: exp.eventType })) {
      if (!exp.matches || exp.matches(ev.payload)) {
        found = true;
        break;
      }
    }
    if (!found) {
      gaps.push({
        id: exp.id,
        eventType: exp.eventType,
        label: exp.label,
        owningRole: exp.owningRole,
        rationale: exp.rationale,
        citation: exp.citation,
      });
    }
  }
  return gaps;
}

/** The alertId a gap raises — stable so emission is idempotent. */
export function gapAlertId(gapId: string): string {
  return `alert:integrity:expected-event-${gapId}`;
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

  for (const gap of checkExpectedEvents(store)) {
    const alertId = gapAlertId(gap.id);
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
