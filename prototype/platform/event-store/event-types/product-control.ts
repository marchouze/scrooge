// platform/event-store/event-types/product-control.ts
//
// Product Control event-payload schemas — daily FX P&L report, P&L attribution,
// P&L sign-off, commentary, flash P&L, and flash-vs-actual reconciliation.
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
//   - PnLSignedOff — trader or product-control sign-off on the day's P&L figures.
//   - PnLCommentaryRecorded — threshold-based explain commentary on a breach.
//   - PnLFlashRecorded — T+0 flash P&L estimate (open positions × latest marks).
//   - PnLFlashActualReconciled — T+1 flash-vs-actual comparison with variance.
//
// Authority:
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R1, R4)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - FRTB-PLA (P&L attribution test analogue)
//   - FIN-BSS-01 (balance sheet substantiation policy)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   dispatched under brief:bea:product-control-daily-p-l-engine-report-and-dash:2026-05-19,
//   brief:bea:p-l-attribution-engine-fx-spot-mvp:2026-05-31, and
//   brief:bea:p-l-sign-off-commentary-slice-4:2026-05-31

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Sub-shapes — aggregation slices
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `pnlByCurrencySchema` / `PnLByCurrency` instead.
 * Retained for backward compatibility with old `DailyPnLReportGenerated`
 * snapshot events that pre-date the per-currency ZAR MTM change
 * (brief:bea:per-currency-zar-mtm-bycurrency-aggregation-full:2026-05-31).
 * Old events containing `byPair` still parse via `.passthrough()` on the
 * outer payload schema.
 */
export const pnlByPairSchema = z.object({
  pair: z.string().min(1),
  tradeCount: z.number().int().nonnegative(),
  unrealisedPnlZarMinor: z.number().int(),
  realisedPnlZarMinor: z.number().int(),
});
/** @deprecated See `pnlByPairSchema`. */
export type PnLByPair = z.infer<typeof pnlByPairSchema>;

/**
 * Per-currency P&L aggregation row.
 *
 * Each non-ZAR currency that appears in the book (as base or quote) gets its
 * own row. For a EUR/USD trade, both EUR and USD get separate rows; USD/ZAR
 * gets a USD row only (ZAR is the base currency and is not reported separately
 * since P&L is already expressed in ZAR).
 *
 * Authority: IAS-21-§28, IFRS-9-§5.7.1, CEO instruction 2026-05-31.
 */
export const pnlByCurrencySchema = z.object({
  /** ISO 4217 currency code (non-ZAR currency in the trade book). */
  currency: z.string().min(1),
  /** Number of trades contributing to this currency row. */
  tradeCount: z.number().int().nonnegative(),
  /** Unrealised P&L contribution from this currency leg (ZAR minor units). */
  unrealisedPnlZarMinor: z.number().int(),
  /** Realised P&L contribution from this currency (ZAR minor units). */
  realisedPnlZarMinor: z.number().int(),
});
export type PnLByCurrency = z.infer<typeof pnlByCurrencySchema>;

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
  /**
   * P&L breakdown by non-ZAR currency (per-currency ZAR MTM).
   * Each non-ZAR currency in the book (as base or quote) has its own row,
   * valued against ZAR independently via the CCY/ZAR closing rate.
   * Authority: IAS-21-§28; CEO instruction 2026-05-31.
   */
  byCurrency: z.array(pnlByCurrencySchema),
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
// PnLSignedOff
//
// Emitted when a trader or product-control analyst formally signs off the
// day's P&L figures. Links to the DailyPnLReportGenerated and
// PnLAttributionGenerated events for the same reportDate, and records
// the figures that were signed (to avoid any ambiguity about what state
// was in scope at sign-off time).
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R4)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - FIN-BSS-01 (balance sheet substantiation policy)
// ---------------------------------------------------------------------------

export const pnlSignedOffPayloadSchema = z.object({
  /** Stable sign-off identifier — unique per (deskId, reportDate, signedOffBy.agentId) run. */
  signOffId: z.string().min(1),
  /** ISO YYYY-MM-DD date the sign-off covers. */
  reportDate: z.string().min(1),
  /** Desk identifier (e.g. "FX-SPOT"). */
  deskId: z.string().min(1),
  /** Who signed off the figures. */
  signedOffBy: z.object({
    /** Role of the person signing off. */
    role: z.enum(["trader", "product-control"]),
    /** Agent or user identifier. */
    agentId: z.string().min(1),
  }),
  /** The figures that were in scope at sign-off time. */
  figuresSigned: z.object({
    /** Total P&L (ZAR minor) at sign-off — from DailyPnLReportGenerated.totalPnlZarMinor. */
    totalPnlZarMinor: z.number().int(),
    /**
     * True when the unrealised P&L covers every live position (no missing marks).
     * False when ≥1 live position had no mark and was excluded.
     */
    unrealisedComplete: z.boolean(),
    /**
     * True when the attribution was computed and all control-critical components
     * were complete AND the residual is within tolerance.
     */
    attributionComplete: z.boolean(),
  }),
  /**
   * Exceptions noted at sign-off time (e.g. missing marks, residual breaches).
   * Empty when the figures are fully clean.
   */
  exceptions: z.array(z.string()),
  /** ISO 8601 timestamp when the sign-off was recorded. */
  signedOffAt: z.string().min(1),
  /** Agent/service that generated this sign-off record. */
  generatedBy: z.string().min(1),
});

export type PnLSignedOffPayload = z.infer<typeof pnlSignedOffPayloadSchema>;

export function makePnLSignedOff(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PnLSignedOffPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PnLSignedOff requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PnLSignedOff",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pnlSignedOffPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PnLCommentaryRecorded
//
// Emitted when product control records threshold-based explain commentary on
// a P&L attribution breach. Paired with the PnLAttributionExceptionRaised
// event for the same attribution (via linkedAttributionId). Commentary is
// programmatically generated from the exception payload.
//
// Commentary types:
//   - "residual-breach"       — the unexplained residual exceeded tolerance.
//   - "incomplete-inputs"     — ≥1 required input was absent (missing mark).
//   - "large-move"            — the total P&L move exceeded the large-move threshold.
//   - "new-trade-spike"       — a new trade contributed a spike P&L (future use).
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R4)
//   - FRTB-PLA (P&L attribution test analogue)
//   - FIN-BSS-01 (balance sheet substantiation policy)
// ---------------------------------------------------------------------------

export const PNL_COMMENTARY_TYPES = [
  "residual-breach",
  "incomplete-inputs",
  "large-move",
  "new-trade-spike",
] as const;
export type PnLCommentaryType = (typeof PNL_COMMENTARY_TYPES)[number];

export const pnlCommentaryRecordedPayloadSchema = z.object({
  /** Stable commentary identifier. */
  commentaryId: z.string().min(1),
  /** ISO YYYY-MM-DD date this commentary covers. */
  reportDate: z.string().min(1),
  /** Desk identifier (e.g. "FX-SPOT"). */
  deskId: z.string().min(1),
  /** The attribution this commentary qualifies. */
  linkedAttributionId: z.string().min(1),
  /** Why this commentary is being recorded. */
  commentaryType: z.enum(PNL_COMMENTARY_TYPES),
  /**
   * The specific attribution component key (e.g. "marketMove", "residual")
   * or null when the commentary applies to the overall figure (e.g. large-move).
   */
  componentKey: z.string().nullable(),
  /** The relevant amount (ZAR minor) — residual amount for breaches, total P&L for large-move. */
  amountZarMinor: z.number().int(),
  /** The threshold that was breached. */
  threshold: z.object({
    /** Human-readable description of the threshold. */
    description: z.string().min(1),
    /** Threshold value in ZAR minor units. */
    zarMinor: z.number().int().nonnegative(),
  }),
  /** Programmatic commentary string describing the breach and context. */
  commentary: z.string().min(1),
  /** Who recorded this commentary. */
  recordedBy: z.object({
    role: z.literal("product-control"),
    agentId: z.string().min(1),
  }),
  /** ISO 8601 timestamp when this commentary was recorded. */
  recordedAt: z.string().min(1),
});

export type PnLCommentaryRecordedPayload = z.infer<typeof pnlCommentaryRecordedPayloadSchema>;

export function makePnLCommentaryRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PnLCommentaryRecordedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PnLCommentaryRecorded requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PnLCommentaryRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pnlCommentaryRecordedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PnLFlashRecorded
//
// T+0 flash P&L estimate: open positions valued at the most recent
// OfficialMarkAdopted marks available intraday. Not a complete picture —
// unrealised P&L is estimated from available marks; a position with no
// usable mark is excluded (no silent zero, per Trusted-Figures). The
// flash is later reconciled against the actual EOD figure via
// PnLFlashActualReconciled.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R4)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
// ---------------------------------------------------------------------------

export const pnlFlashRecordedPayloadSchema = z.object({
  /** Stable flash identifier — unique per (deskId, reportDate) run. */
  flashId: z.string().min(1),
  /** ISO YYYY-MM-DD date this flash covers. */
  reportDate: z.string().min(1),
  /** Desk identifier (e.g. "FX-SPOT"). */
  deskId: z.string().min(1),
  /** Total flash P&L estimate (ZAR minor) = flashUnrealised + flashRealised. */
  flashTotalZarMinor: z.number().int(),
  /** Flash unrealised P&L estimate (ZAR minor) from open positions × latest marks. */
  flashUnrealisedZarMinor: z.number().int(),
  /** Flash realised P&L (ZAR minor) from confirmed settlements to date. */
  flashRealisedZarMinor: z.number().int(),
  /** ISO 8601 timestamp when this flash was generated. */
  generatedAt: z.string().min(1),
  /** Agent/service that generated this flash estimate. */
  generatedBy: z.string().min(1),
});

export type PnLFlashRecordedPayload = z.infer<typeof pnlFlashRecordedPayloadSchema>;

export function makePnLFlashRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PnLFlashRecordedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PnLFlashRecorded requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PnLFlashRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pnlFlashRecordedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PnLFlashActualReconciled
//
// T+1 flash-vs-actual comparison. Emitted the day after a flash was recorded,
// once the actual EOD P&L figure is available from DailyPnLReportGenerated.
// The variance must equal actualTotal − flashTotal (enforced by zod .refine).
// A large variance indicates that the flash estimate was a poor predictor,
// which may suggest mark staleness or booking delays.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R4)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - FIN-BSS-01 (balance sheet substantiation policy)
// ---------------------------------------------------------------------------

export const pnlFlashActualReconciledPayloadSchema = z
  .object({
    /** Stable reconciliation identifier. */
    reconciliationId: z.string().min(1),
    /** ISO YYYY-MM-DD date being reconciled (the flash date, now at T+1). */
    reportDate: z.string().min(1),
    /** Desk identifier (e.g. "FX-SPOT"). */
    deskId: z.string().min(1),
    /** The flash total P&L (ZAR minor) from the prior day's PnLFlashRecorded. */
    flashTotalZarMinor: z.number().int(),
    /** The actual EOD total P&L (ZAR minor) from DailyPnLReportGenerated. */
    actualTotalZarMinor: z.number().int(),
    /**
     * Variance = actualTotal − flashTotal (ZAR minor).
     * Enforced: varianceZarMinor === actualTotalZarMinor − flashTotalZarMinor.
     */
    varianceZarMinor: z.number().int(),
    /** True when |variance| ≤ toleranceZarMinor. */
    varianceWithinTolerance: z.boolean(),
    /** Tolerance applied (ZAR minor) — registry-backed, not an inline literal. */
    toleranceZarMinor: z.number().int().nonnegative(),
    /** The PnLFlashRecorded event this reconciles. */
    linkedFlashId: z.string().min(1),
    /** The DailyPnLReportGenerated.reportId that provided the actual figure. */
    linkedAttributionId: z.string().min(1),
    /** ISO 8601 timestamp when this reconciliation was generated. */
    reconciledAt: z.string().min(1),
    /** Agent/service that generated this reconciliation. */
    generatedBy: z.string().min(1),
  })
  .refine((p) => p.varianceZarMinor === p.actualTotalZarMinor - p.flashTotalZarMinor, {
    message:
      "PnLFlashActualReconciled invariant violated: varianceZarMinor must equal actualTotalZarMinor − flashTotalZarMinor. Use the helper makePnLFlashActualReconciledPayload to compute the variance correctly.",
  });

export type PnLFlashActualReconciledPayload = z.infer<typeof pnlFlashActualReconciledPayloadSchema>;

export function makePnLFlashActualReconciled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PnLFlashActualReconciledPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PnLFlashActualReconciled requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PnLFlashActualReconciled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: pnlFlashActualReconciledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PRODUCT_CONTROL_EVENT_TYPES = [
  "DailyPnLReportGenerated",
  "PnLAttributionGenerated",
  "PnLAttributionExceptionRaised",
  "PnLSignedOff",
  "PnLCommentaryRecorded",
  "PnLFlashRecorded",
  "PnLFlashActualReconciled",
] as const;
export type ProductControlEventType = (typeof PRODUCT_CONTROL_EVENT_TYPES)[number];
