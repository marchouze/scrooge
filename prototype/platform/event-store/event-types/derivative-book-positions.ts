// platform/event-store/event-types/derivative-book-positions.ts
//
// Born-V2 derivative-book position events for the BA 350 (Derivatives
// Instruments) notional + fair-value inventory grid (D-BA-RETURN-SIMULATOR-FIRST
// Phase 2b). BA 350 is an inventory return over the WHOLE derivative book —
// every exchange-traded (ETD) and over-the-counter (OTC) contract, by
// instrument type, underlying asset class, maturity band, and trading-vs-banking
// book — reporting gross notional and gross/net fair value.
//
// ── WHY THESE EVENTS EXIST ─────────────────────────────────────────────────
// A PARTIAL derivative book already exists in the substrate — FX forwards/swaps
// (FxTradeExecuted term products) and interest-rate swaps (IrsTradeBooked /
// IrdSwapPositionRevalued). But those streams do NOT carry the BA 350 grid
// dimensions an inventory fold needs: they have no ETD-vs-OTC venue flag, no
// BA 350 instrument-type taxonomy (futures / forward-FRA / swap / option
// written-vs-purchased / other), no <1y / 1-5y / >5y maturity band, and no
// trading-vs-banking-book designation in a single foldable shape. Rather than
// widen those broadly-subscribed (and partly v1-only) CDM streams, this
// purpose-built born-V2 position event carries exactly the BA 350 grid axes and
// the two measures BA 350 reports — gross notional and signed fair value — and
// nothing else. The event is the single foldable inventory fact (Principle 1).
//
// This is the EXACT analogue of the BA 320 born-V2 EquityTradingPositionOpened /
// CommodityTradingPositionOpened streams (trading-book-positions.ts) — those
// drive the BA 320 standardised-charge fold; this drives the BA 350 inventory
// fold.
//
// ── BA 350 GRID AXES (Reg-28 / Reg-30 derivative-instruments return) ─────────
//   - assetClass: the underlying-asset column group. BA 350 reports a notional
//     and a fair-value column-pair per asset class (interest-rate, foreign-
//     exchange, equity, commodity, credit, other), each split trading/banking.
//   - instrumentType: the BA 350 row taxonomy. ETD rows: futures (bought/sold),
//     call/put options (written/purchased). OTC rows: forwards-and-FRAs, swaps,
//     call/put options (written/purchased), other. Credit derivatives (CDS,
//     total-return swaps) report in BA 350 Section 2.
//   - venue: exchange-traded (ETD) vs over-the-counter (OTC) — BA 350 segregates
//     the two top-level sections (R0010 ETD; R0130 OTC).
//   - maturityBand: <1y / 1-5y / >5y — the BA 350 residual-maturity ladder
//     (R0250–R0470 etc.). Computed from the contract's remaining term.
//   - bookType: trading vs banking — every BA 350 column is split trading/banking
//     (the FRTB book boundary). Resolved against the canonical FRTB desk roster
//     (`v2-core/desk/roster.ts`); `recon:frtb-desk-integrity` is the runtime
//     authority (the event schema does not import the roster — that would create
//     a v2→v1 cycle — so it does not enforce desk membership at parse time).
//
// ── COUNTERPARTY (for CVA reuse) ────────────────────────────────────────────
// OTC positions carry their counterparty (id / name / jurisdiction). The CVA
// engine (`platform/market-risk/cva-engine.ts`) reuses the SAME derivative book
// to derive per-counterparty EAD — BA 350 inventory and the CVA capital charge
// are two folds over one book.
//
// ── DECIMAL-NATIVE MONEY (D-MONEY-DECIMAL-REDENOMINATION) ────────────────────
// `notional` is an ABSOLUTE MoneyWire (gross notional is always reported as a
// positive magnitude). `fairValue` is a SIGNED MoneyWire — positive = a net
// asset (gross positive fair value) to the bank; negative = a net liability
// (gross negative fair value). The BA 350 fold separates the positive and
// negative fair-value columns on the sign.
//
// Authority:
//   - D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26)
//   - D-FX-V2-SIMULATOR-FIRST (the simulator-first principle this extends)
//   - D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21)
//   - D-MONEY-DECIMAL-REDENOMINATION; D-MONEY-DECIMAL-BUILD-PROCEED
//   - Regulations Relating to Banks Reg 28 / Reg 30 (derivative instruments return)
//   - BCBS d424 MAR50 (CVA risk capital framework — the CVA reuse of this book)
//   - Principle 1 (events are truth); Principle 2 (single-graph); Principle 5
//     (currency at the type level)
//
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, type ProvenanceTag, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared field schemas — the BA 350 grid axes.
// ---------------------------------------------------------------------------

/**
 * FRTB book type. Mirrors `v2-core/desk` `DeskBookType` and the BA 320
 * `tradingBookTypeSchema`. Both legs report on BA 350 (the return is split
 * trading/banking) — UNLIKE BA 320, banking-book derivatives are IN SCOPE here.
 */
export const derivativeBookTypeSchema = z.enum(["trading", "banking-treasury"]);

/**
 * BA 350 underlying-asset column group. Each asset class has a notional +
 * fair-value column pair, split trading/banking.
 */
export const derivativeAssetClassSchema = z.enum([
  "interest-rate",
  "foreign-exchange",
  "equity",
  "commodity",
  "credit",
  "other",
]);

export type DerivativeAssetClass = z.infer<typeof derivativeAssetClassSchema>;

/**
 * BA 350 instrument-type row taxonomy. ETD: future-bought / future-sold /
 * call-option-{written,purchased} / put-option-{written,purchased}. OTC:
 * forward-fra / swap / call-option-{written,purchased} / put-option-{written,
 * purchased} / other. Credit derivatives use credit-default-swap /
 * total-return-swap (BA 350 Section 2).
 */
export const derivativeInstrumentTypeSchema = z.enum([
  "future-bought",
  "future-sold",
  "forward-fra",
  "swap",
  "call-option-written",
  "call-option-purchased",
  "put-option-written",
  "put-option-purchased",
  "credit-default-swap",
  "total-return-swap",
  "other",
]);

export type DerivativeInstrumentType = z.infer<typeof derivativeInstrumentTypeSchema>;

/** ETD vs OTC venue — BA 350's two top-level sections. */
export const derivativeVenueSchema = z.enum(["exchange-traded", "over-the-counter"]);

export type DerivativeVenue = z.infer<typeof derivativeVenueSchema>;

/** BA 350 residual-maturity ladder band. */
export const derivativeMaturityBandSchema = z.enum(["lt-1y", "1y-5y", "gt-5y"]);

export type DerivativeMaturityBand = z.infer<typeof derivativeMaturityBandSchema>;

// ---------------------------------------------------------------------------
// DerivativeTradingPositionOpened
//
// One open derivative-book position (ETD or OTC). Feeds the BA 350 inventory
// fold (notional + fair-value grid) and — for OTC positions with a counterparty
// — the CVA capital fold.
// ---------------------------------------------------------------------------

export const derivativePositionOpenedPayloadSchema = z.object({
  /** Stable position identifier (closed by a matching close event). */
  positionId: z.string().min(1),
  /** Instrument identifier — exchange contract code or OTC trade ref. */
  instrumentId: z.string().min(1),
  /** Human-readable instrument name. */
  instrumentName: z.string().min(1),
  /** BA 350 underlying-asset column group. */
  assetClass: derivativeAssetClassSchema,
  /** BA 350 instrument-type row taxonomy. */
  instrumentType: derivativeInstrumentTypeSchema,
  /** ETD vs OTC — BA 350's two top-level sections. */
  venue: derivativeVenueSchema,
  /** BA 350 residual-maturity band (<1y / 1-5y / >5y). */
  maturityBand: derivativeMaturityBandSchema,
  /**
   * Gross notional, ABSOLUTE MoneyWire (always reported positive). BA 350
   * "Notional gross amounts relating to underlying asset".
   */
  notional: moneyWireSchema,
  /**
   * Fair value, SIGNED MoneyWire. Positive = net asset (gross positive fair
   * value to the bank); negative = net liability (gross negative fair value).
   * BA 350 "Fair value of outstanding contracts".
   */
  fairValue: moneyWireSchema,
  /** OTC counterparty id (Party urn). Required for OTC, absent for ETD (CCP-cleared / exchange). */
  counterpartyId: z.string().min(1).optional(),
  /** OTC counterparty name. */
  counterpartyName: z.string().min(1).optional(),
  /** OTC counterparty jurisdiction (ISO 3166 alpha-2). */
  counterpartyJurisdiction: z.string().min(1).optional(),
  /** FRTB desk this position is booked to (canonical desk roster id). */
  deskId: z.string().min(1),
  /** FRTB book type — trading or banking; both report on BA 350. */
  bookType: derivativeBookTypeSchema,
  /** ISO 8601 — date the position was opened. */
  openedDate: z.string().min(1),
  /** ISO 8601 — contract maturity / expiry date. */
  maturityDate: z.string().min(1),
});

export type DerivativePositionOpenedPayload = z.infer<typeof derivativePositionOpenedPayloadSchema>;

export function makeDerivativeTradingPositionOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DerivativePositionOpenedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "DerivativeTradingPositionOpened requires at least one citation (Principle 2).",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DerivativeTradingPositionOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: derivativePositionOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// DerivativeTradingPositionClosed — derecognition (unwind / expiry / settlement).
// ---------------------------------------------------------------------------

export const derivativePositionClosedPayloadSchema = z.object({
  /** The position being closed (matches a DerivativeTradingPositionOpened.positionId). */
  positionId: z.string().min(1),
  /** ISO 8601 — date the position was closed. */
  closedDate: z.string().min(1),
});

export type DerivativePositionClosedPayload = z.infer<typeof derivativePositionClosedPayloadSchema>;

export function makeDerivativeTradingPositionClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DerivativePositionClosedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "DerivativeTradingPositionClosed requires at least one citation (Principle 2).",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DerivativeTradingPositionClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: derivativePositionClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// Registry vocabulary
// ---------------------------------------------------------------------------

export const DERIVATIVE_BOOK_POSITION_EVENT_TYPES = [
  "DerivativeTradingPositionOpened",
  "DerivativeTradingPositionClosed",
] as const;

export type DerivativeBookPositionEventType = (typeof DERIVATIVE_BOOK_POSITION_EVENT_TYPES)[number];
