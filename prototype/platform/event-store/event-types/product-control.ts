// platform/event-store/event-types/product-control.ts
//
// Product Control event-payload schemas — daily FX P&L report event.
//
//   - DailyPnLReportGenerated — daily aggregated FX P&L report covering
//     unrealised mark-to-market and realised P&L, segmented by currency
//     pair, counterparty, and book.
//
// Authority:
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   dispatched under brief:bea:product-control-daily-p-l-engine-report-and-dash:2026-05-19

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
// Registry
// ---------------------------------------------------------------------------

export const PRODUCT_CONTROL_EVENT_TYPES = ["DailyPnLReportGenerated"] as const;
export type ProductControlEventType = (typeof PRODUCT_CONTROL_EVENT_TYPES)[number];
