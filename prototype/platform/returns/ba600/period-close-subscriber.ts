// platform/returns/ba600/period-close-subscriber.ts
//
// M3 Slice 5 — AccountingPeriodClosed subscriber that triggers BA 600
// (operational risk) generation when an accounting period closes for a
// bank-licence entity.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 5.
//
// ## Design
//
// The subscriber wires the BA 600 generator to the period-close event stream.
// When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK`, the subscriber:
//   1. Uses caller-supplied annual gross-income rows per business line.
//   2. Calls `generateBa600OpRisk` with the basic indicator approach (BIA)
//      at 15% of 3-year average positive gross income.
//   3. Returns the typed `Ba600Output` for the caller to render / store.
//
// ## Build-phase posture
//
// Gross-income rows are caller-supplied (rehearsal-grade; placeholder zeros
// accepted). Live numbers populate after commencement-of-trading + 3 fiscal
// years of audited gross income. The substrate gap is surfaced in the output
// `placeholders` field.
//
// ## Principle 1 compliance
//
// The BA 600 BIA uses annual gross income — an accounting aggregate that
// is typically derived from the income statement rather than directly from
// primary events. The correct P1-compliant path folds gross-income from
// `RevenueRecognitionEmitted` events (or equivalent); that event stream is
// a substrate gap (roadmap: post-commencement-of-trading). Until it lands,
// the caller supplies gross-income rows from the period's trial-balance
// summary. The subscriber does NOT compute gross income from the trial
// balance directly — that computation belongs to the caller.
//
// Citation: Principles/1-events-are-truth.md; D-REPORTING-CAPABILITY-M2-M3-
//   BUILD-PLAN; Banks Act 94 of 1990 §70; Regulations Relating to Banks
//   Reg 33; BCBS D196.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + subscriber owner)
//   + Helena (Chief Risk Officer, governance — reports to CEO; op-risk
//   methodology owner — citation).

import type {
  AccountingPeriodClosedPayload,
} from "../../event-store/event-types";
import type { Actor } from "../../event-store/types";
import {
  type Ba600GeneratorInput,
  type Ba600Output,
  type OpRiskGrossIncomeRow,
  generateBa600OpRisk,
} from "../../reporting/ba-600-op-risk";

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

export const BA_600_SUBSCRIBER_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → BA 600 subscriber.
 */
export interface Ba600PeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `BA_600_SUBSCRIBER_ENTITIES`. */
  readonly entity: string;
  /** Actor running the subscriber (typically the Bea agent). */
  readonly actor: Actor;
  /** ISO 4217 functional currency (default "ZAR"). */
  readonly functionalCurrency?: string;
  /**
   * Per-business-line annual gross-income rows for up to 3 fiscal years.
   * Build-phase: caller supplies rehearsal-grade values; can be empty (⇒ zero
   * capital). Post-commencement: derived from `RevenueRecognitionEmitted`
   * events (substrate gap).
   *
   * // TODO: derive from RevenueRecognitionEmitted event stream (substrate gap).
   */
  readonly grossIncome: readonly OpRiskGrossIncomeRow[];
  /**
   * Which approach the bank reports under. Build-phase: "bia" (Basic Indicator
   * Approach). "tsa" (Standardised Approach) available when business-line
   * revenue tracking is live.
   */
  readonly approach?: "bia" | "tsa";
}

/**
 * Result of the `AccountingPeriodClosed` → BA 600 subscriber.
 */
export interface Ba600PeriodCloseSubscriberResult {
  /** The generated BA 600 projection. Caller renders + stores this. */
  readonly ba600Output: Ba600Output;
  /**
   * True if the entity was not in `BA_600_SUBSCRIBER_ENTITIES` and the
   * subscriber skipped generation.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for BA 600 (operational risk)
 * generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Build-phase posture**: gross-income rows are caller-supplied (rehearsal-
 * grade). Live values populate post-commencement-of-trading. The generator
 * is deterministic and produces a compliant BA 600 shape regardless of
 * whether the income rows are live or synthetic.
 *
 * Citations:
 *   Principles/1-events-are-truth.md;
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10);
 *   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 33;
 *   BCBS D196 §645–§654.
 */
export function ba600PeriodCloseSubscriber(
  input: Ba600PeriodCloseSubscriberInput,
): Ba600PeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate BA 600.
  if (!BA_600_SUBSCRIBER_ENTITIES.includes(input.entity)) {
    return {
      ba600Output: null as unknown as Ba600Output,
      skipped: true,
      skipReason: `entity '${input.entity}' is not in BA_600_SUBSCRIBER_ENTITIES (${BA_600_SUBSCRIBER_ENTITIES.join(", ")}); BA 600 not generated`,
    };
  }

  const ccy = input.functionalCurrency ?? "ZAR";
  const periodEnd = input.closedPayload.closedAt;
  const approach = input.approach ?? "bia";

  const generatorInput: Ba600GeneratorInput = {
    entity: input.entity,
    asOf: periodEnd,
    periodId: input.closedPayload.periodId,
    functionalCurrency: ccy,
    grossIncome: input.grossIncome,
    approach,
  };

  const ba600Output = generateBa600OpRisk(generatorInput);

  return {
    ba600Output,
    skipped: false,
  };
}
