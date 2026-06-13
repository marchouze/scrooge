// platform/event-store/event-types/valuation-adjustment.ts
//
// Valuation-adjustment / prudent-valuation reserve event family.
//
//   - ValuationAdjustmentComputed — ONE event per adjustment type (close-out /
//     bid-offer, day-1-deferral, CVA, market-price-uncertainty AVA, …). Each
//     carries the adjustment's ZAR-minor amount, a `complete` flag + optional
//     `absentReason` (the no-silent-zero contract: an adjustment with a missing
//     input declares itself INCOMPLETE rather than reporting a real-looking 0),
//     the instrument scope it covers, and its IFRS 13 fair-value-hierarchy
//     level. The reserve total consumed by daily P&L is the sum of the
//     *populated* (complete) adjustments.
//   - Day1PnLDeferralRecorded — for an IFRS 13 Level-3 mark whose initial
//     measurement gain/loss is unobservable (the "day-1 P&L" question, IFRS 13
//     B5.1.2A / IFRS 9 B5.1.2A): the gain/loss is DEFERRED until an observable
//     input confirms it, rather than recognised at inception. This event is the
//     deferral record; release is a future event (out of MVP scope).
//   - PrudentValuationAvaAggregated — the prudent-valuation Additional Valuation
//     Adjustment (AVA) umbrella (CRR Art 105 / SA-Basel prudent-valuation
//     equivalent). Sums the populated category AVAs (close-out, market-price-
//     uncertainty, model-risk, …) via the no-silent-zero contract: a category
//     with no eventised input is ABSENT, not 0, and is excluded from the total
//     with its absence recorded. Even when only close-out (+ CVA, + day-1)
//     populate, the umbrella event exists and sums what is present.
//
// NO SILENT ZEROS (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1): every
// adjustment / AVA category is present-with-a-value or explicitly-absent-with-
// a-reason. A missing input is never folded in as a real 0.
//
// Authority:
//   - Camille (CFO) recommendation R2 (valuation-adjustment / reserve framework)
//   - IFRS 13 (fair-value measurement; fair-value hierarchy; day-1 P&L)
//   - accounting-policies-ifrs-v1 §3.3 (valuation adjustments / reserves)
//   - valuation-policy-v1 §7 (prudent valuation)
//   - CRR Art 105 / SA-Basel prudent-valuation equivalent (AVA framework)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no silent zero)
//
// Author: Rohan (Risk engineer, engineering), under
//   brief:rohan:valuation-adjustment-prudent-valuation-reserve-f:2026-05-31
//   (WS-PRODUCT-CONTROL).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared vocabularies
// ---------------------------------------------------------------------------

/**
 * The valuation-adjustment / prudent-valuation AVA categories. Each maps to one
 * `ValuationAdjustmentComputed` event (`adjustmentType`) and to one AVA line on
 * the `PrudentValuationAvaAggregated` umbrella. The MVP populates close-out,
 * day-1-deferral, CVA, and market-price-uncertainty; the remaining categories
 * are declared so the umbrella can record them as ABSENT (no silent zero) until
 * their inputs are eventised.
 */
export const VALUATION_ADJUSTMENT_TYPES = [
  // Close-out / bid-offer cost reserve — the cost of unwinding the position at
  // the bid/offer rather than mid (most material for the FX-spot book).
  "close-out-bid-offer",
  // Day-1 P&L deferral on Level-3 (unobservable) marks (IFRS 13 B5.1.2A).
  "day-1-deferral",
  // Counterparty credit valuation adjustment (folded from the CVA engine).
  "cva",
  // Market-price-uncertainty AVA (CRR Art 105(10)) — fed from IPV variances.
  "market-price-uncertainty",
  // Declared-but-not-yet-eventised AVA categories (recorded as ABSENT until fed).
  "model-risk",
  "concentration",
] as const;
export type ValuationAdjustmentType = (typeof VALUATION_ADJUSTMENT_TYPES)[number];

/**
 * IFRS 13 fair-value hierarchy level the adjustment's instruments sit in.
 * `mixed` covers an adjustment spanning more than one level (e.g. a book-wide
 * close-out reserve over both Level-1 and Level-2 instruments).
 */
export const IFRS13_LEVELS = ["level-1", "level-2", "level-3", "mixed"] as const;
export type Ifrs13Level = (typeof IFRS13_LEVELS)[number];

// ---------------------------------------------------------------------------
// ValuationAdjustmentComputed — one per adjustment type
// ---------------------------------------------------------------------------

export const valuationAdjustmentComputedPayloadSchema = z.object({
  /** Stable id — unique per (adjustmentType, asOf) run. */
  adjustmentId: z.string().min(1),
  /** ISO YYYY-MM-DD valuation date this adjustment covers. */
  valuationDate: z.string().min(1),
  /** Which adjustment / AVA category this event carries. */
  adjustmentType: z.enum(VALUATION_ADJUSTMENT_TYPES),
  /**
   * The adjustment magnitude in ZAR minor units, expressed as a POSITIVE
   * reserve (a deduction from fair value / a prudent-value haircut). When
   * `complete` is false this is a PARTIAL sum (the populated instruments only)
   * — never read it as the full figure without checking `complete`.
   */
  amountZarMinor: z.number().int().nonnegative(),
  /**
   * False when ≥1 required input for this adjustment was absent (excluded, NOT
   * zeroed). An incomplete adjustment is excluded from the AVA umbrella total
   * and surfaced as a data failure, never folded in as a real 0.
   */
  complete: z.boolean(),
  /** Why the adjustment is incomplete (present only when complete === false). */
  absentReason: z.string().optional(),
  /** The instrument scope this adjustment covers (e.g. "FX-spot book", "Level-3 marks"). */
  instrumentScope: z.string().min(1),
  /** IFRS 13 fair-value-hierarchy level of the covered instruments. */
  ifrs13Level: z.enum(IFRS13_LEVELS),
  /** Lineage — how the figure was derived (model / inputs / source events). */
  lineage: z.string().min(1),
  /** ISO 8601 timestamp when this adjustment was computed. */
  computedAt: z.string().min(1),
  /** Agent/service that computed this adjustment. */
  computedBy: z.string().min(1),
});

export type ValuationAdjustmentComputedPayload = z.infer<
  typeof valuationAdjustmentComputedPayloadSchema
>;

export function makeValuationAdjustmentComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValuationAdjustmentComputedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "ValuationAdjustmentComputed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValuationAdjustmentComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: valuationAdjustmentComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Day1PnLDeferralRecorded — IFRS 13 Level-3 day-1 P&L deferral
// ---------------------------------------------------------------------------

export const day1PnLDeferralRecordedPayloadSchema = z.object({
  /** Stable id — unique per (instrumentId, valuationDate). */
  deferralId: z.string().min(1),
  /** ISO YYYY-MM-DD valuation date the deferral is recorded on. */
  valuationDate: z.string().min(1),
  /** The instrument / position whose initial measurement gain/loss is deferred. */
  instrumentId: z.string().min(1),
  /** Human-readable instrument descriptor. */
  instrumentDescription: z.string().min(1),
  /**
   * The day-1 (initial-recognition) measurement gain/loss in ZAR minor units,
   * signed: positive = unrecognised gain deferred; negative = unrecognised
   * loss deferred. Deferred (not recognised in P&L) until an observable input
   * confirms the measurement (IFRS 13 B5.1.2A / IFRS 9 B5.1.2A).
   */
  day1PnlZarMinor: z.number().int(),
  /**
   * Why the mark is Level-3 / unobservable (which input is unobservable). The
   * deferral exists precisely because this input is not market-corroborated.
   */
  unobservableInputReason: z.string().min(1),
  /** ISO 8601 timestamp when the deferral was recorded. */
  recordedAt: z.string().min(1),
  /** Agent/service that recorded the deferral. */
  recordedBy: z.string().min(1),
});

export type Day1PnLDeferralRecordedPayload = z.infer<typeof day1PnLDeferralRecordedPayloadSchema>;

export function makeDay1PnLDeferralRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Day1PnLDeferralRecordedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "Day1PnLDeferralRecorded requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "Day1PnLDeferralRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: day1PnLDeferralRecordedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PrudentValuationAvaAggregated — the AVA umbrella
// ---------------------------------------------------------------------------

/**
 * One AVA category line on the umbrella. `present` true ⟹ `amountZarMinor` is
 * a real figure included in the total; `present` false ⟹ the category has no
 * eventised input (ABSENT, not 0) — excluded from the total, `absentReason`
 * records why. This is the no-silent-zero contract at the category level.
 */
export const avaCategoryLineSchema = z.object({
  adjustmentType: z.enum(VALUATION_ADJUSTMENT_TYPES),
  present: z.boolean(),
  /** ZAR minor; the included figure when present, 0 when absent (and excluded). */
  amountZarMinor: z.number().int().nonnegative(),
  /** Why the category is absent (present only when present === false). */
  absentReason: z.string().optional(),
});
export type AvaCategoryLine = z.infer<typeof avaCategoryLineSchema>;

export const prudentValuationAvaAggregatedPayloadSchema = z
  .object({
    /** Stable id — unique per (entity, valuationDate) run. */
    aggregationId: z.string().min(1),
    /** ISO YYYY-MM-DD valuation date this AVA umbrella covers. */
    valuationDate: z.string().min(1),
    /**
     * Total AVA (ZAR minor) — the SUM of the `present` category lines only.
     * Additive invariant: equals Σ of `amountZarMinor` over lines where
     * `present === true`. Absent categories contribute nothing (they are NOT
     * a silent 0 folded into the sum — they are excluded and recorded).
     */
    totalAvaZarMinor: z.number().int().nonnegative(),
    /** Per-category breakdown (present + absent). */
    categories: z.array(avaCategoryLineSchema),
    /** Count of categories with a populated (present) figure. */
    populatedCategories: z.number().int().nonnegative(),
    /** Count of categories recorded as absent (no eventised input). */
    absentCategories: z.number().int().nonnegative(),
    /** ISO 8601 timestamp when the umbrella was aggregated. */
    aggregatedAt: z.string().min(1),
    /** Agent/service that aggregated the umbrella. */
    aggregatedBy: z.string().min(1),
  })
  .refine(
    (p) =>
      p.totalAvaZarMinor ===
      p.categories.filter((c) => c.present).reduce((s, c) => s + c.amountZarMinor, 0),
    {
      message:
        "PrudentValuationAvaAggregated additive invariant violated: totalAvaZarMinor must equal the sum of amountZarMinor over present categories only (absent categories are excluded, never folded in as 0).",
    },
  )
  .refine(
    (p) =>
      p.populatedCategories === p.categories.filter((c) => c.present).length &&
      p.absentCategories === p.categories.filter((c) => !c.present).length,
    {
      message:
        "PrudentValuationAvaAggregated count invariant violated: populatedCategories / absentCategories must match the present/absent split of the categories array.",
    },
  );

export type PrudentValuationAvaAggregatedPayload = z.infer<
  typeof prudentValuationAvaAggregatedPayloadSchema
>;

export function makePrudentValuationAvaAggregated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PrudentValuationAvaAggregatedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PrudentValuationAvaAggregated requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PrudentValuationAvaAggregated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: prudentValuationAvaAggregatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { Money } from "../../core/decimal-money";
import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";

// ── ValuationAdjustmentComputed V2 ──────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by ValuationAdjustmentComputedPayloadV2. */
export type ValuationAdjustmentComputedPayloadLegacy = ValuationAdjustmentComputedPayload;

export interface ValuationAdjustmentComputedPayloadV2
  extends Omit<ValuationAdjustmentComputedPayload, "amountZarMinor"> {
  readonly amountZar: MoneyWire;
}

export function encodeValuationAdjustmentComputed(
  base: Omit<ValuationAdjustmentComputedPayload, "amountZarMinor">,
  amountZar: Money,
): ValuationAdjustmentComputedPayloadV2 {
  return { ...base, amountZar: encodeMoney(amountZar) };
}

export function decodeValuationAdjustmentComputed(
  raw: ValuationAdjustmentComputedPayload,
): ValuationAdjustmentComputedPayloadV2 {
  const { amountZarMinor, ...rest } = raw;
  return { ...rest, amountZar: moneyWireFromMinor(amountZarMinor, "ZAR") };
}

// ── Day1PnLDeferralRecorded V2 ───────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by Day1PnLDeferralRecordedPayloadV2. */
export type Day1PnLDeferralRecordedPayloadLegacy = Day1PnLDeferralRecordedPayload;

export interface Day1PnLDeferralRecordedPayloadV2
  extends Omit<Day1PnLDeferralRecordedPayload, "day1PnlZarMinor"> {
  readonly day1PnlZar: MoneyWire;
}

export function encodeDay1PnLDeferralRecorded(
  base: Omit<Day1PnLDeferralRecordedPayload, "day1PnlZarMinor">,
  day1PnlZar: Money,
): Day1PnLDeferralRecordedPayloadV2 {
  return { ...base, day1PnlZar: encodeMoney(day1PnlZar) };
}

export function decodeDay1PnLDeferralRecorded(
  raw: Day1PnLDeferralRecordedPayload,
): Day1PnLDeferralRecordedPayloadV2 {
  const { day1PnlZarMinor, ...rest } = raw;
  return { ...rest, day1PnlZar: moneyWireFromMinor(day1PnlZarMinor, "ZAR") };
}

// ── AvaCategoryLine V2 ───────────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by AvaCategoryLineV2. */
export type AvaCategoryLineLegacy = AvaCategoryLine;

export interface AvaCategoryLineV2 extends Omit<AvaCategoryLine, "amountZarMinor"> {
  readonly amountZar: MoneyWire;
}

function decodeAvaCategoryLine(raw: AvaCategoryLine): AvaCategoryLineV2 {
  const { amountZarMinor, ...rest } = raw;
  return { ...rest, amountZar: moneyWireFromMinor(amountZarMinor, "ZAR") };
}

// ── PrudentValuationAvaAggregated V2 ─────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by PrudentValuationAvaAggregatedPayloadV2. */
export type PrudentValuationAvaAggregatedPayloadLegacy = PrudentValuationAvaAggregatedPayload;

export interface PrudentValuationAvaAggregatedPayloadV2
  extends Omit<PrudentValuationAvaAggregatedPayload, "totalAvaZarMinor" | "categories"> {
  readonly totalAvaZar: MoneyWire;
  readonly categories: AvaCategoryLineV2[];
}

export function encodePrudentValuationAvaAggregated(
  base: Omit<PrudentValuationAvaAggregatedPayload, "totalAvaZarMinor" | "categories">,
  totalAvaZar: Money,
  categories: AvaCategoryLineV2[],
): PrudentValuationAvaAggregatedPayloadV2 {
  return { ...base, totalAvaZar: encodeMoney(totalAvaZar), categories };
}

export function decodePrudentValuationAvaAggregated(
  raw: PrudentValuationAvaAggregatedPayload,
): PrudentValuationAvaAggregatedPayloadV2 {
  const { totalAvaZarMinor, categories, ...rest } = raw;
  return {
    ...rest,
    totalAvaZar: moneyWireFromMinor(totalAvaZarMinor, "ZAR"),
    categories: categories.map(decodeAvaCategoryLine),
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const VALUATION_ADJUSTMENT_TYPED_EVENT_TYPES = [
  "ValuationAdjustmentComputed",
  "Day1PnLDeferralRecorded",
  "PrudentValuationAvaAggregated",
] as const;
export type ValuationAdjustmentEventType = (typeof VALUATION_ADJUSTMENT_TYPED_EVENT_TYPES)[number];
