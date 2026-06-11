// platform/returns/ba330/period-close-subscriber.ts
//
// Wave 2 treasury returns wiring — BA 330 (IRRBB) period-close subscriber.
//
// AccountingPeriodClosed subscriber that triggers BA 330 (Interest Rate Risk
// in the Banking Book) return generation when an accounting period closes for
// a bank-licence entity.
//
// Standing authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//   D-BA-330-REATTRIBUTION-IRRBB (BA 330 = IRRBB, not large-exposures);
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
//
// ## Design
//
// The subscriber wires the BA 330 IRRBB generator to the period-close event
// stream. When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK`, the
// subscriber:
//   1. Folds `IRRBBChecked` events from the event store for the period window
//      (bounded by `AccountingPeriodClosed.closedAt`) to collect the most
//      recent IRRBB sensitivity results per metric/shock pair.
//   2. Calls `generateBa330IrrbbReturn` to structure the data into the BA 330
//      return format.
//   3. Returns the typed `Ba330Output` for the caller to render / store.
//
// ## Source events
//
// `IRRBBChecked` events are emitted by `ravi-alm-run.ts` (the Ravi ALM handler):
//   - 6 EVE events per run (BCBS d365 §4 shock scenarios)
//   - 4 NII events per run (BCBS d365 §5 parallel shocks)
//   - Total: 10 IRRBBChecked events per daily ALM run
//
// ## Principle 1 compliance
//
// IRRBB sensitivity metrics are folded directly from `IRRBBChecked` events
// in the event store. No hardcoded or caller-supplied sensitivity figures
// are used. The fold is bounded by the period window to prevent post-period
// drift. Authority: Principles/1-events-are-truth.md.
//
// ## Build-phase posture
//
// Tier 1 capital is not yet measured (build phase). ΔEVE and ΔNII values
// are zero (zero banking-book positions in the build phase). The outlier
// test result is always "within-threshold". This accurately represents the
// pre-commencement bank — no fabrication, no understatement.
//
// ## What NOT to do
//
// Banking-book bonds and banking-book IRS positions ARE folded by Ravi's ALM
// handler via the repricing gap / EVE / NII engines. BA 320 (market risk)
// EXCLUDES banking-book instruments (handled via the BA-320 subscriber's
// `bankingBookExclusion` guard in `ba-320-bond-events-adapter.ts`). Do NOT
// duplicate BA-320 positions here.
//
// Citation: Principles/1-events-are-truth.md;
//           D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//           D-BA-330-REATTRIBUTION-IRRBB; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
//           Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 27;
//           BCBS d365 ("Interest rate risk in the banking book", Apr 2016).
//
// Author: Mira (Compliance / RegTech engineer, engineering — runtime wiring +
//   returns submission surface; Wave 2 D-TREASURER-WAVE2-SUBSTRATE).

import type { AccountingPeriodClosedPayload } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import {
  BA_330_SUBSCRIBER_ENTITIES,
  type Ba330Output,
  generateBa330IrrbbReturn,
} from "../../reporting/ba-330-irrbb";

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → BA 330 IRRBB subscriber.
 */
export interface Ba330PeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `BA_330_SUBSCRIBER_ENTITIES`. */
  readonly entity: string;
  /**
   * Event store — provides access to `IRRBBChecked` events for the period
   * (emitted by `ravi-alm-run.ts` — 6 EVE + 4 NII per daily ALM run).
   */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically the Mira agent). */
  readonly actor: Actor;
  /**
   * ISO 8601 — start of the accounting period. Used to bound the
   * `IRRBBChecked` event fold so only runs within this period contribute
   * to the return (not runs from prior periods).
   */
  readonly periodStart: string;
}

/**
 * Result of the `AccountingPeriodClosed` → BA 330 IRRBB subscriber.
 */
export interface Ba330PeriodCloseSubscriberResult {
  /** The generated BA 330 return. Caller renders + stores this. */
  readonly ba330Output: Ba330Output;
  /**
   * True if the entity was not in `BA_330_SUBSCRIBER_ENTITIES` and the
   * subscriber skipped generation.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for BA 330 IRRBB generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: IRRBB metrics are derived from `IRRBBChecked`
 * events in the event store — not from caller-supplied sensitivity inputs.
 * The fold is bounded by `periodStart` / `closedAt` to prevent post-period
 * drift. Authority: Principles/1-events-are-truth.md.
 *
 * **Build-phase posture**: Tier 1 capital is not yet measured; ΔEVE and ΔNII
 * are zero (zero banking-book positions). The outlier test always returns
 * "within-threshold". This is an accurate representation of the pre-
 * commencement bank.
 *
 * Citations:
 *   Principles/1-events-are-truth.md;
 *   D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
 *   D-BA-330-REATTRIBUTION-IRRBB; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
 *   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 27;
 *   BCBS d365 ("Interest rate risk in the banking book", Apr 2016).
 */
export function ba330PeriodCloseSubscriber(
  input: Ba330PeriodCloseSubscriberInput,
): Ba330PeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate BA 330.
  if (!BA_330_SUBSCRIBER_ENTITIES.includes(input.entity)) {
    return {
      ba330Output: null as unknown as Ba330Output,
      skipped: true,
      skipReason: `entity '${input.entity}' is not in BA_330_SUBSCRIBER_ENTITIES (${BA_330_SUBSCRIBER_ENTITIES.join(", ")}); BA 330 not generated`,
    };
  }

  const periodEnd = input.closedPayload.closedAt;

  // Generate the BA 330 IRRBB return by folding IRRBBChecked events for the
  // period window. The generator selects the most-recent run per metric/shockLabel
  // pair to avoid double-counting daily ALM runs within one accounting period.
  //
  // Authority: Principles/1-events-are-truth.md; D-TREASURER-WAVE2-SUBSTRATE;
  //   BCBS d365 §4 (EVE) + §5 (NII).
  const ba330Output = generateBa330IrrbbReturn(input.eventStore, {
    entity: input.entity,
    periodId: input.closedPayload.periodId,
    periodEnd,
    periodStart: input.periodStart,
  });

  return {
    ba330Output,
    skipped: false,
  };
}
