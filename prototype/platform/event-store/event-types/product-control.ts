// platform/event-store/event-types/product-control.ts
//
// Product Control event-payload schemas — daily FX P&L report + P&L attribution.
//
//   - DailyPnLReportGenerated — daily aggregated FX P&L report covering
//     unrealised mark-to-market and realised P&L, segmented by currency
//     pair, counterparty, and book.
//   - PnLAttributionGenerated — the day-over-day clean-P&L "P&L Explain":
//     the total clean-P&L move decomposed into additive, reconciling
//     components (new-trade, market-move, carry/funding, realised, and an
//     unexplained residual). The additive invariant is enforced both by a
//     zod .refine at construction AND by recon:pnl-attribution-reconciles.
//   - PnLAttributionExceptionRaised — emitted when the residual breaches
//     tolerance OR a required input is incomplete (a missing per-position
//     prior-day mark), so the attribution cannot be read as clean.
//
// Authority:
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R1)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - FRTB-PLA (P&L attribution test analogue)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   dispatched under brief:bea:product-control-daily-p-l-engine-report-and-dash:2026-05-19
//   and brief:bea:p-l-attribution-engine-fx-spot-mvp:2026-05-31

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Sub-shapes — aggregation slices
// ---------------------------------------------------------------------------

export const pnlByPairSchema = z.object({
  pair: z.string().min(1),
  tradeCount: z.number().int().nonnegative(),
  unrealisedPnlZarMinor: z.number().int(),
  realisedPnlZarMinor: z.number().int(),
});
export type PnLByPair = z.infer<typeof pnlByPairSchema>;

export const pnlByCounterpartySchema = z.object({
  counterpartyId: z.string().min(1),
  counterpartyName: z.string(),
  tradeCount: z.number().int().nonnegative(),
  unrealisedPnlZarMinor: z.number().int(),
  realisedPnlZarMinor: z.number().int(),
});
export type PnLByCounterparty = z.infer<typeof pnlByCounterpartySchema>;

export const pnlByBookSchema = z.object({
  bookId: z.string().min(1),
  tradeCount: z.number().int().nonnegative(),
  unrealisedPnlZarMinor: z.number().int(),
  realisedPnlZarMinor: z.number().int(),
});
export type PnLByBook = z.infer<typeof pnlByBookSchema>;

// ---------------------------------------------------------------------------
// DailyPnLReportGenerated
//
// Emitted once per derive cycle by the Product Control engine.
// Summarises the FX desk's unrealised (FVTPL) and realised P&L for
// a given report date, aggregated by pair, counterparty, and book.
//
// IFRS 9 §5.7.1: changes in fair value of FVTPL financial instruments
// recognised in profit or loss.
// ---------------------------------------------------------------------------

export const dailyPnLReportGeneratedPayloadSchema = z.object({
  /** Stable report identifier — unique per (deskId, reportDate) run. */
  reportId: z.string().min(1),
  /** ISO YYYY-MM-DD date this report covers. */
  reportDate: z.string().min(1),
  /** Desk identifier (e.g. "FX-SPOT"). */
  deskId: z.string().min(1),
  /**
   * Total unrealised P&L (ZAR minor units) across all *markable* open
   * positions. NOTE: when `unrealisedComplete` is false this figure EXCLUDES
   * one or more live positions that had no usable mark — it is a partial sum,
   * not a complete one. A consumer must read `unrealisedComplete` before
   * presenting this as the headline; a live-but-unmarkable position must never
   * be read as contributing a real 0 (Trusted-Figures no-silent-zero).
   */
  totalUnrealisedPnlZarMinor: z.number().int(),
  /**
   * False when ≥1 live position could not be marked (markStatus
   * "unavailable") and was therefore excluded from `totalUnrealisedPnlZarMinor`.
   * The aggregate is then *incomplete* (degraded), and the figure must be
   * surfaced via /api/data-failures + the global banner rather than presented
   * as a clean complete number. True when every live position carried a usable
   * mark.
   * Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (no silent zero).
   */
  unrealisedComplete: z.boolean(),
  /** Count of live positions excluded from unrealised P&L for want of a mark. */
  unmarkableLivePositions: z.number().int().nonnegative(),
  /** Trade IDs of the live positions excluded from unrealised P&L. */
  unmarkableLiveTradeIds: z.array(z.string()),
  /** Total realised P&L (ZAR minor units) from confirmed settlements. */
  totalRealisedPnlZarMinor: z.number().int(),
  /** totalUnrealisedPnlZarMinor + totalRealisedPnlZarMinor. */
  totalPnlZarMinor: z.number().int(),
  /** Number of open (unsettled) positions included in unrealised P&L. */
  activePositions: z.number().int().nonnegative(),
  /** Number of trades cancelled (excluded from P&L). */
  cancelledPositions: z.number().int().nonnegative(),
  /** P&L breakdown by currency pair. */
  byPair: z.array(pnlByPairSchema),
  /** P&L breakdown by counterparty. */
  byCounterparty: z.array(pnlByCounterpartySchema),
  /** P&L breakdown by trading book. */
  byBook: z.array(pnlByBookSchema),
  /** ISO 8601 timestamp when this report was generated. */
  generatedAt: z.string().min(1),
  /** Agent/service that generated this report. */
  generatedBy: z.string().min(1),
});

export type DailyPnLReportGeneratedPayload = z.infer<typeof dailyPnLReportGeneratedPayloadSchema>;

export function makeDailyPnLReportGenerated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DailyPnLReportGeneratedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "DailyPnLReportGenerated requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DailyPnLReportGenerated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: dailyPnLReportGeneratedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PnLAttributionGenerated
//
// The day-over-day clean-P&L decomposition ("P&L Explain") for the FX desk.
// The clean-P&L move between two report dates is split into additive,
// reconciling components:
//
//   actualMove === newTrade + marketMove + carry + realised + residual
//
// Each component is a { amountZarMinor, complete, absentReason? } object so a
// component that could not be computed (e.g. no FTP curve for carry, or a
// market-move sum that excludes an unmarkable position) declares itself
// INCOMPLETE rather than reporting a silent 0. The market-move and carry
// components are the no-silent-zero collapse points: a position with no
// prior-day mark is EXCLUDED from market-move and tracked in
// `unattributablePositions`, never folded in as 0.
//
// The component object is deliberately shaped to hold a future risk-factor
// sub-decomposition (non-FX: delta / vega / gamma / theta sub-splits) without
// reshaping the event — see `subComponents` (empty for the FX-spot MVP, which
// uses full-reval / P&L-vector method, not Taylor/Greeks).
// ---------------------------------------------------------------------------

export const ATTRIBUTION_COMPONENT_KINDS = [
  "new-trade",
  "market-move",
  "carry",
  "realised",
  "residual",
] as const;
export type AttributionComponentKind = (typeof ATTRIBUTION_COMPONENT_KINDS)[number];

/**
 * A single additive attribution component. `complete` is false when the
 * component could not be fully computed (a missing input was excluded, NOT
 * zeroed); `absentReason` explains the gap. The `subComponents` array holds a
 * future risk-factor sub-decomposition (delta/vega/gamma/theta) for non-FX
 * products; it is empty for the FX-spot MVP (full-reval method) but the field
 * exists now so the event shape never has to change to carry it.
 */
export const attributionComponentSchema = z.object({
  /** ZAR minor units. For an incomplete component this is the partial sum. */
  amountZarMinor: z.number().int(),
  /** False when ≥1 required input was absent (excluded, not zeroed). */
  complete: z.boolean(),
  /** Why the component is incomplete (present only when complete === false). */
  absentReason: z.string().optional(),
  /**
   * Risk-factor sub-decomposition (non-FX extension). Empty for the FX-spot
   * MVP. Each entry: a named risk factor and its additive ZAR-minor contribution
   * to this component (the sum of subComponents equals amountZarMinor when present).
   */
  subComponents: z
    .array(
      z.object({
        riskFactor: z.string().min(1),
        amountZarMinor: z.number().int(),
      }),
    )
    .default([]),
});
export type AttributionComponent = z.infer<typeof attributionComponentSchema>;

export const pnlAttributionGeneratedPayloadSchema = z
  .object({
    /** Stable attribution identifier — unique per (deskId, reportDate) run. */
    attributionId: z.string().min(1),
    /** ISO YYYY-MM-DD date this attribution explains the move INTO. */
    reportDate: z.string().min(1),
    /** ISO YYYY-MM-DD prior date the move is measured FROM. */
    priorReportDate: z.string().min(1),
    /** Desk identifier (e.g. "FX-SPOT"). */
    deskId: z.string().min(1),
    /**
     * The total clean-P&L move to explain (ZAR minor):
     * totalPnl(reportDate) − totalPnl(priorReportDate).
     */
    actualMoveZarMinor: z.number().int(),
    /** New trades booked on reportDate. */
    newTrade: attributionComponentSchema,
    /** Market move on existing positions (Σ FxPositionRevalued delta on reportDate). */
    marketMove: attributionComponentSchema,
    /** Carry / funding (MVP placeholder; absent when no FTP curve covers the desk). */
    carry: attributionComponentSchema,
    /** Realised increment: totalRealised(reportDate) − totalRealised(priorDate). */
    realised: attributionComponentSchema,
    /** Unexplained residual = actualMove − (newTrade + marketMove + carry + realised). */
    residual: attributionComponentSchema,
    /** True when |residual| ≤ toleranceZarMinor. */
    residualWithinTolerance: z.boolean(),
    /** Residual tolerance applied (ZAR minor) — registry-backed, not a literal. */
    toleranceZarMinor: z.number().int().nonnegative(),
    /**
     * Live position tradeIds with no usable prior-day mark — excluded from
     * marketMove (NOT zeroed). Non-empty ⟹ marketMove.complete === false.
     */
    unattributablePositions: z.array(z.string()),
    /** ISO 8601 timestamp when this attribution was generated. */
    generatedAt: z.string().min(1),
    /** Agent/service that generated this attribution. */
    generatedBy: z.string().min(1),
  })
  .refine(
    (p) =>
      p.actualMoveZarMinor ===
      p.newTrade.amountZarMinor +
        p.marketMove.amountZarMinor +
        p.carry.amountZarMinor +
        p.realised.amountZarMinor +
        p.residual.amountZarMinor,
    {
      message:
        "PnLAttributionGenerated additive invariant violated: actualMoveZarMinor must equal newTrade + marketMove + carry + realised + residual (each component's amountZarMinor). The residual absorbs any gap so the components always sum to the actual move.",
    },
  );

export type PnLAttributionGeneratedPayload = z.infer<typeof pnlAttributionGeneratedPayloadSchema>;

export function makePnLAttributionGenerated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PnLAttributionGeneratedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PnLAttributionGenerated requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PnLAttributionGenerated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pnlAttributionGeneratedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PnLAttributionExceptionRaised
//
// Emitted alongside a PnLAttributionGenerated event when the attribution
// cannot be read as clean. Models on IpvExceptionRaised (mtm.ts): a typed
// exception that pairs with the figure it qualifies. Two breach types:
//   - "residual-breach"     — |residual| exceeded toleranceZarMinor.
//   - "incomplete-inputs"   — ≥1 required input absent (a live position with no
//                             usable prior-day mark excluded from market-move).
// ---------------------------------------------------------------------------

export const ATTRIBUTION_BREACH_TYPES = ["residual-breach", "incomplete-inputs"] as const;
export type AttributionBreachType = (typeof ATTRIBUTION_BREACH_TYPES)[number];

export const pnlAttributionExceptionRaisedPayloadSchema = z.object({
  /** The attribution this exception qualifies (matches PnLAttributionGenerated.attributionId). */
  attributionId: z.string().min(1),
  /** ISO YYYY-MM-DD report date of the attribution. */
  reportDate: z.string().min(1),
  /** Desk identifier (e.g. "FX-SPOT"). */
  deskId: z.string().min(1),
  /** Why the attribution is exceptional. */
  breachType: z.enum(ATTRIBUTION_BREACH_TYPES),
  /** Residual amount (ZAR minor) at the time of the exception. */
  residualZarMinor: z.number().int(),
  /** Residual tolerance applied (ZAR minor). */
  toleranceZarMinor: z.number().int().nonnegative(),
  /** Live position tradeIds with no usable prior-day mark (incomplete-inputs). */
  unattributablePositions: z.array(z.string()),
  /** Human-readable explanation of the breach. */
  detail: z.string().min(1),
});

export type PnLAttributionExceptionRaisedPayload = z.infer<
  typeof pnlAttributionExceptionRaisedPayloadSchema
>;

export function makePnLAttributionExceptionRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PnLAttributionExceptionRaisedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PnLAttributionExceptionRaised requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PnLAttributionExceptionRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pnlAttributionExceptionRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PRODUCT_CONTROL_EVENT_TYPES = [
  "DailyPnLReportGenerated",
  "PnLAttributionGenerated",
  "PnLAttributionExceptionRaised",
] as const;
export type ProductControlEventType = (typeof PRODUCT_CONTROL_EVENT_TYPES)[number];
