// platform/returns/ba320/period-close-subscriber.ts
//
// M3 Slice 5 — AccountingPeriodClosed subscriber that triggers BA 310
// (market risk) generation when an accounting period closes for a
// bank-licence entity.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 5.
//
// ## Design
//
// The subscriber wires the BA 310 generator to the period-close event stream.
// When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK`, the subscriber:
//   1. Folds `FxTradeExecuted` and `TradeMatured` events from the
//      event store for the period window to compute open FX positions
//      (P1-compliant path; see `ba-310-events-adapter.ts`).
//   2. Folds `BondTradeExecuted`, `BondMatured`, and `BondSold` events to
//      derive the IR general maturity-ladder and IR specific-risk rows
//      (P1-compliant path; see `ba-310-bond-events-adapter.ts`).
//      Banking-book bonds are excluded (BA-330 IRRBB, not BA-310).
//   3. Uses caller-supplied equity / commodity inputs (build-phase:
//      placeholder zeros; post-trading-book milestone: event-derived).
//   4. Calls `generateBa310MarketRiskFromEvents` with the composed input.
//   5. Returns the typed `Ba310Output` for the caller to render / store.
//
// ## Principle 1 compliance
//
// FX positions are folded directly from `FxTradeExecuted` events (minus
// `TradeMatured` settled trades) — not from the trial balance.
// Bond IR positions are folded directly from `BondTradeExecuted` events
// (minus `BondMatured`/`BondSold` derecognitions) — not from the trial
// balance. This is the P1-compliant architecture per
// `Principles/1-events-are-truth.md`, P1 fix C-2, and D-MARKETS-CAPITAL-TIME-SHAPE.
//
// Equity and commodity sub-charges remain caller-supplied placeholders
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
  buildBondIrGeneralLadder,
  buildBondIrSpecificRiskRows,
} from "../../reporting/ba-320-bond-events-adapter";
import {
  type Ba310FromEventsInput,
  type Ba310Output,
  generateBa310MarketRiskFromEvents,
} from "../../reporting/ba-320-events-adapter";
import type {
  CommodityPositionRow,
  EquityRow,
  IrMaturityBandRow,
  IrSpecificRiskRow,
} from "../../reporting/ba-320-market-risk";

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

export const BA_310_SUBSCRIBER_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → BA 310 subscriber.
 */
export interface Ba310PeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `BA_310_SUBSCRIBER_ENTITIES`. */
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
   * IR general maturity-ladder rows (optional override). When omitted, the
   * subscriber derives the ladder from BondTradeExecuted events via
   * `buildBondIrGeneralLadder` (P1-compliant path). Supply an explicit value
   * only in tests or when overriding event-derived output.
   *
   * Authority: Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(b);
   * D-MARKETS-CAPITAL-TIME-SHAPE.
   */
  readonly irGeneralMaturityLadder?: readonly IrMaturityBandRow[];
  /**
   * IR specific-risk rows (optional override). When omitted, the subscriber
   * derives rows from BondTradeExecuted events via `buildBondIrSpecificRiskRows`
   * (P1-compliant path). Supply an explicit value only in tests or overrides.
   *
   * Authority: Regulations Relating to Banks Reg 28(3)(b); BCBS D352 §718(c)–(e);
   * D-MARKETS-CAPITAL-TIME-SHAPE.
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
 * Result of the `AccountingPeriodClosed` → BA 310 subscriber.
 */
export interface Ba310PeriodCloseSubscriberResult {
  /** The generated BA 310 projection. Caller renders + stores this. */
  readonly ba310Output: Ba310Output;
  /**
   * True if the entity was not in `BA_310_SUBSCRIBER_ENTITIES` and the
   * subscriber skipped generation.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for BA 310 (market risk) generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: FX positions are derived from `FxTradeExecuted`
 * primary events via `generateBa310MarketRiskFromEvents`, NOT from the trial
 * balance. Bond IR general and IR specific-risk are derived from
 * `BondTradeExecuted` events via `buildBondIrGeneralLadder` and
 * `buildBondIrSpecificRiskRows`. Equity / commodity remain caller-supplied
 * placeholders until the respective event streams are implemented.
 *
 * Citations:
 *   Principles/1-events-are-truth.md (updated 2026-05-12);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10);
 *   D-MARKETS-SCHEMA-FOUNDATION;
 *   D-MARKETS-CAPITAL-TIME-SHAPE;
 *   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 28;
 *   BCBS D352.
 */
export function ba310PeriodCloseSubscriber(
  input: Ba310PeriodCloseSubscriberInput,
): Ba310PeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate BA 310.
  if (!BA_310_SUBSCRIBER_ENTITIES.includes(input.entity)) {
    return {
      ba310Output: null as unknown as Ba310Output,
      skipped: true,
      skipReason: `entity '${input.entity}' is not in BA_310_SUBSCRIBER_ENTITIES (${BA_310_SUBSCRIBER_ENTITIES.join(", ")}); BA 310 not generated`,
    };
  }

  const ccy = input.functionalCurrency ?? "ZAR";
  const periodEnd = input.closedPayload.closedAt;

  // Frozen-cursor bound from AccountingPeriodClosed.
  // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  const untilSequence =
    input.closedPayload.eventSequence !== undefined ? input.closedPayload.eventSequence : undefined;

  // ---- Derive bond IR inputs from events (P1-compliant path) ---------------
  //
  // When the caller does not supply explicit override values, derive both the
  // IR general maturity-ladder and IR specific-risk rows from BondTradeExecuted
  // events via the bond events adapter.  Caller-supplied values take precedence
  // (for testing and edge-case overrides).
  //
  // Authority: Regulations Relating to Banks Reg 28(3)(a)–(b);
  //   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; D-MARKETS-CAPITAL-TIME-SHAPE;
  //   Principles/1-events-are-truth.md.

  const bondAdapterInput = {
    entity: input.entity,
    periodEnd,
    eventStore: input.eventStore,
    ...(untilSequence !== undefined ? { untilSequence } : {}),
  };

  const derivedIrGeneralMaturityLadder =
    input.irGeneralMaturityLadder ?? buildBondIrGeneralLadder(bondAdapterInput);
  const derivedIrSpecificRisk =
    input.irSpecificRisk ?? buildBondIrSpecificRiskRows(bondAdapterInput);

  const fromEventsInput: Ba310FromEventsInput = {
    entity: input.entity,
    asOf: periodEnd,
    periodId: input.closedPayload.periodId,
    functionalCurrency: ccy,
    periodStart: input.periodStart,
    periodEnd,
    zarRates: input.zarRates ?? new Map(),
    irGeneralMaturityLadder: derivedIrGeneralMaturityLadder,
    irSpecificRisk: derivedIrSpecificRisk,
    equity: input.equity ?? [],
    commodity: input.commodity ?? [],
    ...(input.irGeneralDisallowancesMinor !== undefined
      ? { irGeneralDisallowancesMinor: input.irGeneralDisallowancesMinor }
      : {}),
    // Thread the frozen cursor so all replay calls inside the events adapter
    // are bounded to the same event window as the bond adapter above.
    // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
    ...(untilSequence !== undefined ? { untilSequence } : {}),
  };

  const ba310Output = generateBa310MarketRiskFromEvents(input.eventStore, fromEventsInput);

  return {
    ba310Output,
    skipped: false,
  };
}
