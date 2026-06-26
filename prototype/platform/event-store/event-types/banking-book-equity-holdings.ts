// platform/event-store/event-types/banking-book-equity-holdings.ts
//
// Born-V2 BANKING-BOOK equity-holding events for the BA 340 (Equity Risk in the
// Banking Book) simple-risk-weight engine (D-BA-RETURN-SIMULATOR-FIRST, Phase 2c).
//
// ── WHY A DISTINCT EVENT (not the trading-book EquityTradingPositionOpened) ──
// Banking-book equity is ECONOMICALLY DISTINCT from the held-for-trading equity
// Phase 1 seeded:
//   - It is held-to-collect / strategic (long-term investment), NOT held-for-
//     trading. Different IFRS 9 business model, different regulatory treatment.
//   - Its capital charge is the SIMPLE RISK-WEIGHT METHOD (Reg 31(6)(b)(i),
//     Table 1: 300% publicly-traded / 400% other), NOT the BA 320 net-general +
//     gross-specific position charge.
//   - The BA 320 (Market Risk) fold reads ONLY `EquityTradingPositionOpened`, so
//     minting a SEPARATE banking-book event GUARANTEES, by construction, that a
//     banking-book equity holding can NEVER leak into BA 320 trading-book equity
//     risk (the FRTB boundary `recon:frtb-desk-integrity` + the brief's explicit
//     "must NOT leak into BA 320" constraint). One event family per book is the
//     cleanest boundary — there is no shared field whose mis-set could cross it.
//
// ── METHODOLOGY (SARB Regulations Relating to Banks, Reg 31(6)(b)(i), Table 1) ──
// The simple risk-weight method assigns the bank's NET equity position per
// holding class to a Table-1 risk weight:
//   Publicly-traded equity (any equity instrument traded on a licensed
//     exchange) ........................................ 300%
//   Other equity positions (unlisted / not on a licensed exchange) ... 400%
// Footnote 1: the position INCLUDES the absolute values of net short positions
// (a net short |position| is risk-weighted, not netted to zero against the class).
// Risk-weighted exposure = exposure value × risk weight; capital requirement =
// RWE × 8% (the Reg-38 minimum capital ratio). Both books — trading AND banking —
// report equity, but on DIFFERENT returns (BA 320 trading; BA 340 banking).
//
// The internal-models (market-based) approach (Reg 31(6)(b)(ii)) is the
// ALTERNATIVE column (BA 340 R0060–R0080). The build-phase substrate implements
// the simple risk-weight method only; the IMA column is surfaced as an explicit,
// tracked gap (no silent zero) — see the BA 340 cell-assembly + gap-register.
//
// ── HOLDING CLASS ──
// `holdingClass` selects the Table-1 row + risk weight:
//   - "listed"   → publicly-traded equity (300%); BA 340 R0040.
//   - "unlisted" → other equity positions (400%); BA 340 R0050.
// "Speculative unlisted" (BA 340 R0020) and "other equity holdings" (R0021) are
// the phased-in / Reg-38(5)-deduction lines — out of the simple-risk-weight Table-1
// engine scope (they are deducted-or-250%-weighted, not Table-1 risk-weighted); a
// banking-book holding tagged `speculative-unlisted` is folded into its exposure
// line but NOT charged by the Table-1 engine (it routes to the deduction/250%
// regime, which is a separate licence-day fold). Carried for completeness; the
// engine charges only `listed` + `unlisted`.
//
// ── DECIMAL-NATIVE MONEY (D-MONEY-DECIMAL-REDENOMINATION) ────────────────────
// `exposureValue` is MoneyWire (canonical decimal-string MAJOR units), never
// minor-unit integers. The BA 340 fold converts to the engine's minor-unit
// `number` contract at the fold boundary via `minorFromMoneyWire`.
//
// Authority:
//   - D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26)
//   - D-FX-V2-SIMULATOR-FIRST (the simulator-first principle this extends)
//   - D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21) — banking-book desk
//   - D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE
//   - D-MONEY-DECIMAL-REDENOMINATION; D-MONEY-DECIMAL-BUILD-PROCEED
//   - Regulations Relating to Banks Reg 31 (equity risk in the banking book —
//     simple risk-weight method, Table 1: 300% / 400%); Reg 38 (8% min ratio)
//   - Basel CRE (banking-book equity framework)
//   - Principle 1 (events are truth); Principle 2 (single-graph); Principle 5
//     (currency at the type level)
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner).

import { z } from "zod";

import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, type ProvenanceTag, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

/**
 * Banking-book equity holding class — selects the BA 340 simple-risk-weight
 * Table-1 row + risk weight (Reg 31(6)(b)(i)):
 *   - "listed"               — publicly-traded equity (300%); BA 340 R0040.
 *   - "unlisted"             — other equity positions (400%); BA 340 R0050.
 *   - "speculative-unlisted" — phased-in / Reg-38(5) deduction-or-250% regime
 *                              (BA 340 R0020). Carried for the exposure line but
 *                              NOT charged by the Table-1 engine (separate regime).
 */
export const bankingBookEquityHoldingClassSchema = z.enum([
  "listed",
  "unlisted",
  "speculative-unlisted",
]);

export type BankingBookEquityHoldingClass = z.infer<typeof bankingBookEquityHoldingClassSchema>;

/**
 * Side of the holding from the bank's perspective. Per Reg 31(6)(b)(i)
 * Table-1 footnote 1, a net SHORT position is risk-weighted on its ABSOLUTE
 * value (it is NOT netted to zero), so both sides feed the exposure value.
 */
export const bankingBookEquitySideSchema = z.enum(["long", "short"]);

/**
 * FRTB book type. Banking-book equity is `banking-treasury` — it enters BA 340,
 * NOT BA 320. (The enum mirrors `tradingBookTypeSchema` in trading-book-positions.ts
 * so the desk-roster boundary recon reads a single vocabulary.) A
 * `bookType: "trading"` value here would be a category error (trading-book equity
 * is the separate `EquityTradingPositionOpened` event); the schema admits only
 * `banking-treasury`.
 */
export const bankingBookBookTypeSchema = z.enum(["banking-treasury"]);

// ---------------------------------------------------------------------------
// BankingBookEquityHoldingOpened
//
// A banking-book equity holding (strategic / held-to-collect investment) is
// recognised. Feeds the BA 340 simple-risk-weight engine (Reg 31(6)(b)(i)):
//   risk-weighted exposure = exposure value × {300% listed | 400% unlisted}
//   capital requirement     = RWE × 8%
// ---------------------------------------------------------------------------

export const bankingBookEquityHoldingOpenedPayloadSchema = z.object({
  /** Stable holding identifier (one open holding; closed by a matching close event). */
  holdingId: z.string().min(1),
  /** Instrument identifier — JSE alpha code, ISIN, or an unlisted-entity id. */
  instrumentId: z.string().min(1),
  /** Human-readable instrument / investee name. */
  instrumentName: z.string().min(1),
  /**
   * BA 340 holding class — selects the Table-1 risk weight (Reg 31(6)(b)(i)).
   */
  holdingClass: bankingBookEquityHoldingClassSchema,
  /** Holding side (long / short). A net short is charged on its absolute value. */
  side: bankingBookEquitySideSchema,
  /**
   * Exposure value of the holding (MAJOR-unit decimal money, ABSOLUTE magnitude).
   * Per Reg 31(6)(b)(i) Table-1 footnote 1, the engine takes the absolute value
   * of the position regardless of side. This is the carrying / exposure amount
   * that maps to BA 340 column C0010 (Exposure value).
   */
  exposureValue: moneyWireSchema,
  /** FRTB banking-book desk this holding is booked to (canonical desk roster id). */
  deskId: z.string().min(1),
  /** FRTB book type — banking-book equity is `banking-treasury` (BA 340, not BA 320). */
  bookType: bankingBookBookTypeSchema,
  /** ISO 8601 — date the holding was recognised. */
  openedDate: z.string().min(1),
});

export type BankingBookEquityHoldingOpenedPayload = z.infer<
  typeof bankingBookEquityHoldingOpenedPayloadSchema
>;

export function makeBankingBookEquityHoldingOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankingBookEquityHoldingOpenedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BankingBookEquityHoldingOpened requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankingBookEquityHoldingOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankingBookEquityHoldingOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// BankingBookEquityHoldingClosed — derecognition (disposal / write-off).
// ---------------------------------------------------------------------------

export const bankingBookEquityHoldingClosedPayloadSchema = z.object({
  /** The holding being closed (matches a BankingBookEquityHoldingOpened.holdingId). */
  holdingId: z.string().min(1),
  /** ISO 8601 — date the holding was derecognised. */
  closedDate: z.string().min(1),
});

export type BankingBookEquityHoldingClosedPayload = z.infer<
  typeof bankingBookEquityHoldingClosedPayloadSchema
>;

export function makeBankingBookEquityHoldingClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankingBookEquityHoldingClosedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BankingBookEquityHoldingClosed requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankingBookEquityHoldingClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankingBookEquityHoldingClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// Registry vocabulary
// ---------------------------------------------------------------------------

export const BANKING_BOOK_EQUITY_HOLDING_EVENT_TYPES = [
  "BankingBookEquityHoldingOpened",
  "BankingBookEquityHoldingClosed",
] as const;

export type BankingBookEquityHoldingEventType =
  (typeof BANKING_BOOK_EQUITY_HOLDING_EVENT_TYPES)[number];
