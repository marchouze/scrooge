// platform/returns/ba100/period-close-subscriber.ts
//
// BA 100 period-close subscriber — D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// Slice 4.
//
// Mirrors the BA 110 subscriber pattern: listens for `AccountingPeriodClosed`
// events on the bank entity and triggers the BA 100 Capital Adequacy Return
// generator.
//
// Pattern:
//   AccountingPeriodClosed (for LE-ZA-HOZ-BANK)
//     → subscriber fires
//     → `generateBA700Return(...)` called with the period inputs
//     → `BA700Return` (mission-spec shape) returned as a record
//     → caller may emit a `ReportGenerated` event (Slice 5) with the
//       return as payload
//
// Principle 1 compliance:
//   The subscriber does NOT store derived state. It reads the event store,
//   calls the generator, and hands back the typed return. Callers who need
//   persistence emit a `ReportGenerated` event or write to the RMS document
//   store (Slice 5 territory).
//
// Substrate gap (surfaced per dispatch discipline):
//   The subscriber is currently called manually (in-session runs or test
//   harnesses).  The fully-autonomous version fires from the event-bus
//   trigger (`AccountingPeriodClosed` trigger → subscriber → `ReportGenerated`
//   event).  The event-bus wiring is the M8 autonomous-substrate gap and is
//   not built here.
//
// Citations:
//   Banks Act 94 of 1990 §70
//   Regulations Relating to Banks Reg 38
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   Principles/1-events-are-truth.md
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   capital-stack accountable signer).

import { coaToCapitalClassifications } from "../../accounting/coa-registry";
import type { EventStore } from "../../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../../projections/filter";
import type {
  AccountCapitalClassification,
  BA700Return,
  BufferRequirements,
  RegulatoryDeduction,
  RwaDecomposition,
} from "./generator";
import { generateBA700Return } from "./generator";

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input for `onAccountingPeriodClosed`.  The subscriber receives the
 * `AccountingPeriodClosed` event payload plus the supporting inputs needed
 * by the BA 100 generator (classification map, deductions, RWA).
 *
 * At v0 all classification / deductions / RWA inputs are caller-supplied
 * (fixture-grade rehearsal).  Real inputs wire in as W2 Slice 3 and
 * Slice 6 land.
 */
export interface PeriodCloseSubscriberInput {
  /** Entity that just closed a period. Subscriber no-ops for non-bank entities. */
  readonly entity: string;
  /** Closed period identifier. */
  readonly periodId: string;
  /** ISO 8601 — when the period was closed (= `AccountingPeriodClosed.closedAt`). */
  readonly closedAt: string;
  /** ISO 8601 — period start from `AccountingPeriodOpened.periodStart`. */
  readonly periodStart: string;
  /** ISO 8601 — period end from `AccountingPeriodOpened.periodEnd`. */
  readonly periodEnd: string;
  /** ISO 4217 functional currency from `AccountingPeriodOpened.functionalCurrency`. */
  readonly functionalCurrency: string;
  /** Event store — required by `generateBA700Return`. */
  readonly eventStore: EventStore;
  /**
   * Per-account capital-tier classification.
   *
   * Defaults to `coaToCapitalClassifications()` — the canonical CET1 + T2
   * account set from the chart-of-accounts `capitalTier` field.
   * Includes ACC-5000-001/002 (CET1) and ACC-5200-001/002 (T2).
   *
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1; coa-registry.ts.
   */
  readonly classifications?: readonly AccountCapitalClassification[];
  /**
   * Regulatory deductions.  Defaults to empty (gross = net).
   */
  readonly deductions?: readonly RegulatoryDeduction[];
  /**
   * RWA decomposition.  Caller-supplied at v0.
   * TODO: wire from RwaComputed event (W2 Slice 3 engine).
   */
  readonly rwa: RwaDecomposition;
  /** Buffer requirements; defaults to build-phase BCBS minimums + 2.5% CCB. */
  readonly bufferRequirements?: BufferRequirements;
  /**
   * Upper bound (inclusive) on the event `sequence` column.
   * Sourced from `AccountingPeriodClosed.eventSequence` (frozen cursor).
   * When supplied, all event-store replays in the BA 100 generator are
   * bounded to prevent divergence from concurrent appends.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

/** Result returned by the subscriber after generating the BA 100 return. */
export interface PeriodCloseSubscriberResult {
  /** Whether the subscriber processed this event (false for non-bank entities). */
  readonly processed: boolean;
  /**
   * The generated BA 100 return.  Present when `processed` is true.
   * Undefined when the entity is not in scope for BA 100 (non-bank entity).
   */
  readonly ba100Return?: BA700Return;
  /**
   * Substrate gap note — the event-bus trigger wiring is not yet built.
   * This string surfaces in the subscriber result for the recon pipeline
   * to track.
   */
  readonly substrateGap: string;
}

// ---------------------------------------------------------------------------
// Bank entity scope guard — mirrors BA_100_BANK_ENTITIES
// ---------------------------------------------------------------------------

/** Bank-licence-bound entity short-ids that trigger BA 100 generation. */
export const BA_100_SUBSCRIBER_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * Handle an `AccountingPeriodClosed` event by generating the BA 100
 * Capital Adequacy Return.
 *
 * **Call discipline:**
 *   This subscriber is called by whatever orchestration layer processes
 *   `AccountingPeriodClosed` events (today: in-session manual invocation
 *   or test harness; future: event-bus trigger wired via M8 substrate).
 *
 * **Non-bank entities:**
 *   Returns `{ processed: false }` for entities outside
 *   `BA_100_SUBSCRIBER_ENTITIES`.  The caller must not pass a non-bank
 *   entity to the BA 100 generator; the subscriber enforces this by
 *   returning early.
 *
 * **Principle 1:**
 *   No derived state is stored.  The subscriber calls `generateBA700Return`
 *   (which folds primary events) and returns the typed result.  Callers
 *   emit `ReportGenerated` for persistence.
 *
 * Citations:
 *   Banks Act 94 of 1990 §70 — capital-adequacy reporting obligation.
 *   Regulations Relating to Banks Reg 38 — BA 100 submission cycle.
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN — Slice 4 authority.
 *   Principles/1-events-are-truth.md — no derived state stored.
 */
export function onAccountingPeriodClosed(
  input: PeriodCloseSubscriberInput,
): PeriodCloseSubscriberResult {
  const SUBSTRATE_GAP =
    "substrate-gap: BA 100 subscriber fires manually in the current substrate; " +
    "autonomous trigger requires event-bus wiring of AccountingPeriodClosed → " +
    "ba100:period-close-subscriber (M8 substrate gap, not yet built). " +
    "Documented in D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 substrate gaps.";

  // Non-bank entities are out of scope.
  if (!BA_100_SUBSCRIBER_ENTITIES.includes(input.entity)) {
    return { processed: false, substrateGap: SUBSTRATE_GAP };
  }

  // Resolve classifications: caller override or canonical COA-derived set.
  // The canonical set includes CET1 + T2 accounts from coaToCapitalClassifications().
  // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  const resolvedClassifications = input.classifications ?? coaToCapitalClassifications();

  const { return: ba100Return } = generateBA700Return({
    entityId: input.entity,
    reportingDate: input.closedAt,
    periodId: input.periodId,
    functionalCurrency: input.functionalCurrency,
    eventStore: input.eventStore,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    classifications: resolvedClassifications,
    deductions: input.deductions ?? [],
    rwa: input.rwa,
    ...(input.bufferRequirements !== undefined
      ? { bufferRequirements: input.bufferRequirements }
      : {}),
    // Thread the frozen cursor so all replays in the BA 100 generator are bounded.
    // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
    ...(input.untilSequence !== undefined ? { untilSequence: input.untilSequence } : {}),
  });

  return { processed: true, ba100Return, substrateGap: SUBSTRATE_GAP };
}

// ---------------------------------------------------------------------------
// replayAndGenerate — convenience helper for catch-up / backfill
// ---------------------------------------------------------------------------

/**
 * Replay all `AccountingPeriodClosed` events for a given entity from the
 * event store and re-generate the BA 100 return for each closed period.
 *
 * Useful for:
 *   - Catch-up generation after a schema / generator upgrade.
 *   - Backfill of `ReportGenerated` events for historical periods.
 *   - Smoke-test harness: assert all closed periods have a valid BA 100.
 *
 * The `classificationFactory` callback receives (entity, periodId) and
 * returns the capital classification map for that period.  At v0 the
 * map is constant; at Slice 6+ it may vary by period if the chart-of-
 * accounts classification was updated between periods.
 *
 * Principle 1: does not store any derived state — callers process the
 * returned array of results.
 */
export function replayAndGenerate(args: {
  readonly entity: string;
  readonly eventStore: EventStore;
  readonly functionalCurrency: string;
  readonly rwa: RwaDecomposition;
  readonly classificationFactory: (
    entity: string,
    periodId: string,
  ) => readonly AccountCapitalClassification[];
  readonly deductionFactory?: (entity: string, periodId: string) => readonly RegulatoryDeduction[];
  readonly bufferRequirements?: BufferRequirements;
}): PeriodCloseSubscriberResult[] {
  if (!BA_100_SUBSCRIBER_ENTITIES.includes(args.entity)) return [];

  const provenanceFilter = defaultProvenanceFilter();
  const results: PeriodCloseSubscriberResult[] = [];

  // Collect all AccountingPeriodClosed events for the entity.
  for (const ev of args.eventStore.replay({
    entity: args.entity,
    type: "AccountingPeriodClosed",
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as {
      periodId: string;
      closedAt: string;
    };
    if (!p.periodId || !p.closedAt) continue;

    // Locate the period open to get periodStart / periodEnd.
    let periodStart: string | undefined;
    let periodEnd: string | undefined;
    for (const oe of args.eventStore.replay({
      entity: args.entity,
      type: "AccountingPeriodOpened",
    })) {
      const op = oe.payload as { periodId: string; periodStart: string; periodEnd: string };
      if (op.periodId === p.periodId) {
        periodStart = op.periodStart;
        periodEnd = op.periodEnd;
      }
    }

    if (!periodStart || !periodEnd) continue;

    const result = onAccountingPeriodClosed({
      entity: args.entity,
      periodId: p.periodId,
      closedAt: p.closedAt,
      periodStart,
      periodEnd,
      functionalCurrency: args.functionalCurrency,
      eventStore: args.eventStore,
      classifications: args.classificationFactory(args.entity, p.periodId),
      deductions: args.deductionFactory?.(args.entity, p.periodId) ?? [],
      rwa: args.rwa,
      ...(args.bufferRequirements !== undefined
        ? { bufferRequirements: args.bufferRequirements }
        : {}),
    });
    results.push(result);
  }

  return results;
}
