// platform/returns/ba350/period-close-subscriber.ts
//
// M3 Slice 5 — AccountingPeriodClosed subscriber that triggers BA 350
// (market risk) generation when an accounting period closes for a
// bank-licence entity.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 5.
//
// ## Design
//
// The subscriber wires the BA 350 generator to the period-close event stream.
// When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK`, the subscriber:
//   1. Folds `FxTradeExecuted` and `TradeMatured` events from the
//      event store for the period window to compute open FX positions
//      (P1-compliant path; see `ba-350-events-adapter.ts`).
//   2. Uses caller-supplied IR general / IR specific / equity / commodity
//      inputs (build-phase: placeholder zeros; post-trading-book milestone:
//      event-derived).
//   3. Calls `generateBa350MarketRiskFromEvents` with the composed input.
//   4. Returns the typed `Ba350Output` for the caller to render / store.
//
// ## Principle 1 compliance
//
// FX positions are folded directly from `FxTradeExecuted` events (minus
// `TradeMatured` settled trades) — not from the trial balance.
// This is the Principle 1 compliant architecture per
// `Principles/1-events-are-truth.md` and per the P1 fix (C-2) filed at
// `reporting/ba-350-events-adapter.ts`.
//
// IR, equity, and commodity sub-charges remain caller-supplied placeholders
// (zero by default) until the respective trading-book event streams are
// implemented (substrate gap, roadmap item D-MARKETS-CAPITAL-TIME-SHAPE).
//
// Citation: Principles/1-events-are-truth.md; D-MARKETS-SCHEMA-FOUNDATION;
//           D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//           D-MARKETS-CAPITAL-TIME-SHAPE.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + subscriber owner)
//   + Atlas (Core banking platform architect, engineering — reports to
//   Devon COO; P1-fix events-adapter substrate).

import type { AccountingPeriodClosedPayload } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import {
  type Ba350FromEventsInput,
  type Ba350Output,
  generateBa350MarketRiskFromEvents,
} from "../../reporting/ba-350-events-adapter";
import type {
  CommodityPositionRow,
  EquityRow,
  IrMaturityBandRow,
  IrSpecificRiskRow,
} from "../../reporting/ba-350-market-risk";

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

export const BA_350_SUBSCRIBER_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → BA 350 subscriber.
 */
export interface Ba350PeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `BA_350_SUBSCRIBER_ENTITIES`. */
  readonly entity: string;
  /**
   * Event store — provides access to `FxTradeExecuted` and
   * `TradeMatured` events for the P1-compliant FX position fold.
   */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically the Bea agent). */
  readonly actor: Actor;
  /** ISO 8601 — start of the accounting period. */
  readonly periodStart: string;
  /** ISO 4217 functional currency (default "ZAR"). */
  readonly functionalCurrency?: string;
  /**
   * ZAR exchange rates — map from currency code to ZAR per 1 minor unit.
   * Build-phase: caller supplies or leaves empty (zero FX charge if empty).
   */
  readonly zarRates?: ReadonlyMap<string, number>;
  /**
   * IR general maturity-ladder rows (caller-supplied). Build-phase default: [].
   * Populated at D-MARKETS-CAPITAL-TIME-SHAPE milestone.
   * // TODO: derive from BondPositionOpened / BondPositionClosed events.
   */
  readonly irGeneralMaturityLadder?: readonly IrMaturityBandRow[];
  /**
   * IR specific-risk rows (caller-supplied). Build-phase default: [].
   * // TODO: derive from issuer-classification events.
   */
  readonly irSpecificRisk?: readonly IrSpecificRiskRow[];
  /**
   * Equity position rows (caller-supplied). Build-phase default: [].
   * // TODO: derive from EquityPositionOpened events.
   */
  readonly equity?: readonly EquityRow[];
  /**
   * Commodity positions (caller-supplied). Build-phase default: [].
   */
  readonly commodity?: readonly CommodityPositionRow[];
  /** Optional IR disallowances override. */
  readonly irGeneralDisallowancesMinor?: number;
}

/**
 * Result of the `AccountingPeriodClosed` → BA 350 subscriber.
 */
export interface Ba350PeriodCloseSubscriberResult {
  /** The generated BA 350 projection. Caller renders + stores this. */
  readonly ba350Output: Ba350Output;
  /**
   * True if the entity was not in `BA_350_SUBSCRIBER_ENTITIES` and the
   * subscriber skipped generation.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for BA 350 (market risk) generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: FX positions are derived from `FxTradeExecuted`
 * primary events via `generateBa350MarketRiskFromEvents`, NOT from the trial
 * balance. IR / equity / commodity remain caller-supplied placeholders until
 * the respective event streams are implemented.
 *
 * Citations:
 *   Principles/1-events-are-truth.md (updated 2026-05-12);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10);
 *   D-MARKETS-SCHEMA-FOUNDATION;
 *   D-MARKETS-CAPITAL-TIME-SHAPE;
 *   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 28;
 *   BCBS D352.
 */
export function ba350PeriodCloseSubscriber(
  input: Ba350PeriodCloseSubscriberInput,
): Ba350PeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate BA 350.
  if (!BA_350_SUBSCRIBER_ENTITIES.includes(input.entity)) {
    return {
      ba350Output: null as unknown as Ba350Output,
      skipped: true,
      skipReason: `entity '${input.entity}' is not in BA_350_SUBSCRIBER_ENTITIES (${BA_350_SUBSCRIBER_ENTITIES.join(", ")}); BA 350 not generated`,
    };
  }

  const ccy = input.functionalCurrency ?? "ZAR";
  const periodEnd = input.closedPayload.closedAt;

  const fromEventsInput: Ba350FromEventsInput = {
    entity: input.entity,
    asOf: periodEnd,
    periodId: input.closedPayload.periodId,
    functionalCurrency: ccy,
    periodStart: input.periodStart,
    periodEnd,
    zarRates: input.zarRates ?? new Map(),
    irGeneralMaturityLadder: input.irGeneralMaturityLadder ?? [],
    irSpecificRisk: input.irSpecificRisk ?? [],
    equity: input.equity ?? [],
    commodity: input.commodity ?? [],
    ...(input.irGeneralDisallowancesMinor !== undefined
      ? { irGeneralDisallowancesMinor: input.irGeneralDisallowancesMinor }
      : {}),
    // Thread the frozen cursor from AccountingPeriodClosed so all replay
    // calls inside the events adapter are bounded to the same event window.
    // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
    ...(input.closedPayload.eventSequence !== undefined
      ? { untilSequence: input.closedPayload.eventSequence }
      : {}),
  };

  const ba350Output = generateBa350MarketRiskFromEvents(input.eventStore, fromEventsInput);

  return {
    ba350Output,
    skipped: false,
  };
}
