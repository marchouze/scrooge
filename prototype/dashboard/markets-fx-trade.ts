// dashboard/markets-fx-trade.ts
//
// FX desk Slice 2 — RFQ → quote → trade-emit pipeline.
//
// Reference: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   pack §6 Slice 2 — RFQ form + trade-emit. Per the dispatch brief
//   (#A3 of the First Dry-Run Scenario, 2026-05-10):
//     • Single currency pair (ZAR/USD spot) for the first dry-run.
//     • Synthetic quote engine (fixed-spread stub; real pricer is Slice 3).
//     • Don't touch event-types.ts — use existing typed FX-CDM event.
//
// The trade-emit endpoint emits an `FxTradeExecuted` event from the
// existing FX CDM (`prototype/platform/markets/cdm/fx.ts`, PR #49 —
// `D-MARKETS-SCHEMA-FOUNDATION`). FxTradeExecuted is the canonical
// FX trade event; one `tradeId`-keyed event covers Spot / Forward /
// Swap / NDF, with `productTaxonomy` as the discriminator. v1 (this
// slice) only emits Spot for ZAR/USD; multi-pair, forwards, NDFs,
// and the full RFQ → quote → order → gateway → trade chain
// (proposed in pack §3 J1–J3 with new `RfqRequested` /
// `QuoteResponded` event types) defer to Slice 3+ behind the
// substrate-gap follow-on for `event-types.ts` additions per
// pack §9 #2.
//
// Provenance (D-DATA-PROVENANCE-SUBSTRATE Slice 6+1, PR #161):
// every trade event is tagged `kind: 'simulated', scenario:
// 'first-dry-run-2026-Q1', sourceLineage: 'agent:kai:fx-rfq'`
// per the dispatch brief. The substrate-active flag is currently
// `false`, so untagged events are tolerated, but we tag now so
// the audit trail is self-describing the moment the flag flips.
//
// Author: Kai (Trading systems engineer, engineering — reports to
//         Saskia, Head of Global Markets) · Saskia (Head of Global
//         Markets, governance) · Anya (Data / analytics engineer,
//         engineering — projection / derivation pattern review).

import {
  type FxTradeExecutedPayload,
  makeFxTradeExecuted,
} from "../platform/markets/cdm/fx";
import type { EventStore } from "../platform/event-store/store";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event, ProvenanceTag } from "../platform/event-store/types";
import { newEventId } from "../platform/core/types";
import { buildCounterpartiesView } from "./markets-fx-counterparties";

// ---------------------------------------------------------------------------
// Public types — request shape, quote shape, and result shape.
// ---------------------------------------------------------------------------

/** Minimal RFQ form input shape. ZAR/USD spot only for the first
 *  dry-run; the schema below validates and rejects anything else. */
export interface RfqInput {
  /** Counterparty id, must exist in the eligibility-passing picker. */
  readonly counterpartyId: string;
  /** Currency pair as "BASE/QUOTE" — first dry-run requires "USD/ZAR". */
  readonly currencyPair: string;
  /** Bank's side. */
  readonly side: "buy" | "sell";
  /** Notional in the base currency, major units (e.g. 1_000_000 USD). */
  readonly notional: number;
  /** Value date as ISO YYYY-MM-DD; spot convention is T+2 in the UI. */
  readonly valueDate: string;
  /** Optional client-supplied RFQ correlation id; the server generates
   *  one if absent. The trade-emit endpoint always returns the id used. */
  readonly rfqId?: string;
}

/** Synthetic quote — fixed mid + symmetric spread per the v1 stub.
 *  Real pricer (Slice 3) replaces the body of `quoteRfq()`. */
export interface SyntheticQuote {
  /** Mid-rate in quote-currency per base unit (e.g. ZAR per USD). */
  readonly midRate: number;
  /** Bid (bank buys base) — bank quotes the counterparty this rate to sell. */
  readonly bidRate: number;
  /** Offer (bank sells base) — bank quotes the counterparty this rate to buy. */
  readonly offerRate: number;
  /** Half-spread used (in quote-currency per base unit). */
  readonly halfSpread: number;
  /** Quote-currency per base — used for posting amount calculations. */
  readonly rateUsed: number;
  /** Free-text source label so the UI can render "synthetic stub v1". */
  readonly source: string;
}

/** Result of a successful trade-emit. */
export interface TradeEmitOk {
  readonly status: "ok";
  readonly tradeId: string;
  readonly rfqId: string;
  readonly eventId: string;
  readonly eventType: "FxTradeExecuted";
  readonly quote: SyntheticQuote;
  readonly provenance: ProvenanceTag;
  readonly asOf: string;
}

/** Result of a rejected trade-emit. */
export interface TradeEmitErr {
  readonly status: "rejected";
  readonly reason: string;
  readonly field?: string;
}

export type TradeEmitResult = TradeEmitOk | TradeEmitErr;

// ---------------------------------------------------------------------------
// Constants — first-dry-run posture.
// ---------------------------------------------------------------------------

/** Per dispatch brief constraint: only USD/ZAR spot for first-dry-run. */
const ALLOWED_PAIR = { base: "USD", quote: "ZAR" } as const;

/** Provenance scenario id — the named first-dry-run handle per
 *  Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md
 *  (a single canonical scenario id; the calendar Q-id is presentational). */
export const FIRST_DRY_RUN_SCENARIO = "first-dry-run-2026-Q1";

/** Source-lineage token for events emitted by the FX desk RFQ form.
 *  Matches the parameterised pattern `agent-runtime:<...>` registered
 *  in `platform/event-store/provenance-lineage.registry.ts`. */
export const KAI_FX_RFQ_LINEAGE = "agent-runtime:kai-fx-rfq";

/** Synthetic mid-rate stub for ZAR/USD — fixed for determinism in the
 *  first-dry-run. Slice 3 replaces with a market-data-driven quote. */
export const SYNTHETIC_USDZAR_MID = 18.5;

/** Symmetric half-spread (ZAR per USD) — 25 pips on a 4-decimal quote. */
export const SYNTHETIC_HALF_SPREAD = 0.0025;

/** Citations attached to every FxTradeExecuted emitted from this seam.
 *  Per Principle 2 (every action traces to a source) — the FX-CDM `make`
 *  helper rejects empty citation arrays. The TBC entry is the FAIS sub-
 *  section URN cluster Mira will populate at M4 substrate-completion. */
const TRADE_EMIT_CITATIONS = [
  "D-FX-SALES-TRADING-FRONTEND",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-BOOK-BOUNDARY",
  "Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md",
  "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md",
  "[citation: TBC pending counsel — FAIS s.45 sub-section refs]",
] as const;

// ---------------------------------------------------------------------------
// Synthetic quote stub — Slice 3 substitute.
// ---------------------------------------------------------------------------

/**
 * Return a synthetic ZAR/USD quote. Deterministic: mid is fixed and the
 * spread is symmetric. The bank-side rate is the side-appropriate bid /
 * offer; for booking purposes we record the side-appropriate rate as
 * `rateUsed` so the leg notionals reconcile bit-identically downstream.
 *
 * Real pricer (Slice 3) replaces the body — interface stays stable.
 */
export function quoteRfq(input: Pick<RfqInput, "side">): SyntheticQuote {
  const midRate = SYNTHETIC_USDZAR_MID;
  const halfSpread = SYNTHETIC_HALF_SPREAD;
  const bidRate = midRate - halfSpread;
  const offerRate = midRate + halfSpread;
  // Convention: when the bank buys USD (side === 'buy'), it pays the
  // offer (worse for the bank). When the bank sells USD it receives
  // the bid. The bank-internal rate captured on the trade is therefore
  // the side-appropriate rate.
  const rateUsed = input.side === "buy" ? offerRate : bidRate;
  return {
    midRate,
    bidRate,
    offerRate,
    halfSpread,
    rateUsed,
    source: "synthetic-fixed-spread-stub-v1",
  };
}

// ---------------------------------------------------------------------------
// Validation — RFQ input shape + first-dry-run constraints.
// ---------------------------------------------------------------------------

const VALUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAIR_RE = /^[A-Z]{3}\/[A-Z]{3}$/;

export function validateRfqInput(input: unknown): TradeEmitErr | null {
  if (!input || typeof input !== "object") {
    return { status: "rejected", reason: "RFQ body must be a JSON object" };
  }
  const i = input as Record<string, unknown>;

  if (typeof i.counterpartyId !== "string" || !i.counterpartyId.trim()) {
    return { status: "rejected", reason: "counterpartyId is required", field: "counterpartyId" };
  }
  if (typeof i.currencyPair !== "string" || !PAIR_RE.test(i.currencyPair)) {
    return {
      status: "rejected",
      reason: "currencyPair must match BASE/QUOTE (3-letter ISO codes)",
      field: "currencyPair",
    };
  }
  if (i.currencyPair !== `${ALLOWED_PAIR.base}/${ALLOWED_PAIR.quote}`) {
    return {
      status: "rejected",
      reason: `first-dry-run accepts only ${ALLOWED_PAIR.base}/${ALLOWED_PAIR.quote} spot (Slice 2 dispatch constraint)`,
      field: "currencyPair",
    };
  }
  if (i.side !== "buy" && i.side !== "sell") {
    return { status: "rejected", reason: "side must be 'buy' or 'sell'", field: "side" };
  }
  if (typeof i.notional !== "number" || !Number.isFinite(i.notional) || i.notional <= 0) {
    return {
      status: "rejected",
      reason: "notional must be a positive finite number",
      field: "notional",
    };
  }
  if (typeof i.valueDate !== "string" || !VALUE_DATE_RE.test(i.valueDate)) {
    return {
      status: "rejected",
      reason: "valueDate must be ISO YYYY-MM-DD",
      field: "valueDate",
    };
  }
  if (i.rfqId !== undefined && (typeof i.rfqId !== "string" || !i.rfqId.trim())) {
    return { status: "rejected", reason: "rfqId, if supplied, must be a non-empty string", field: "rfqId" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Counterparty eligibility gate — pack §3 G1.
//
// We re-check at trade-emit time (not just at picker-load) so a
// counterparty that breached after the form was opened is rejected
// before the trade event is appended. Mirrors the pre-Slice-2 brief.
// ---------------------------------------------------------------------------

export function isCounterpartyEligible(
  store: Pick<EventStore, "replay">,
  counterpartyId: string,
): boolean {
  const view = buildCounterpartiesView(store);
  return view.counterparties.some((c) => c.counterpartyId === counterpartyId);
}

// ---------------------------------------------------------------------------
// Trade-emit — append an FxTradeExecuted event with provenance.
// ---------------------------------------------------------------------------

/** Build the FxTradeExecuted payload for a USD/ZAR spot trade against
 *  the given RFQ + quote. Spot has exactly one "near" leg per the FX
 *  CDM superRefine, with USD as the base notional and ZAR as the
 *  counter-notional. */
export function buildSpotPayload(args: {
  tradeId: string;
  input: RfqInput;
  quote: SyntheticQuote;
  asOfDate: string;
}): FxTradeExecutedPayload {
  const baseNotionalUsdMinor = Math.round(args.input.notional * 100); // USD cents
  const counterNotionalZarMinor = Math.round(
    args.input.notional * args.quote.rateUsed * 100,
  );

  // Bank "buy" of USD: pays ZAR, receives USD.
  // Bank "sell" of USD: pays USD, receives ZAR.
  const payCurrency = args.input.side === "buy" ? "ZAR" : "USD";
  const receiveCurrency = args.input.side === "buy" ? "USD" : "ZAR";
  const payAmountMinor =
    args.input.side === "buy" ? counterNotionalZarMinor : baseNotionalUsdMinor;
  const receiveAmountMinor =
    args.input.side === "buy" ? baseNotionalUsdMinor : counterNotionalZarMinor;

  return {
    tradeId: { scheme: "internal-trade-id", value: args.tradeId },
    productTaxonomy: "FX-spot",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: args.input.side,
    legs: [
      {
        legKind: "near",
        payCurrency,
        receiveCurrency,
        notional: { currency: payCurrency, amountMinor: payAmountMinor },
        counterNotional: { currency: receiveCurrency, amountMinor: receiveAmountMinor },
        rate: { currency: "ZAR", amount: args.quote.rateUsed },
        settlementDate: { iso: args.input.valueDate, calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: args.asOfDate, calendar: "JIHCAL" },
    counterparty: {
      partyId: args.input.counterpartyId,
      name: args.input.counterpartyId,
      role: "counterparty",
      jurisdiction: "ZA",
    },
    venue: "OTC",
    trader: "agent:kai:fx-pricer",
    bookId: "fx-spot-zaru-trading-book-1",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    finsurvCategory: "[citation: TBC]",
  };
}

/** Top-level trade-emit. Validates input, gates on counterparty
 *  eligibility, prices a synthetic quote, builds the FxTradeExecuted
 *  payload, appends the event with the simulated provenance tag, and
 *  returns the rfqId / tradeId / eventId for the UI confirmation. */
export function emitTrade(args: {
  store: Pick<EventStore, "append" | "replay">;
  input: RfqInput;
  asOf: string; // ISO 8601 timestamp
  /** Override scenario id for tests; defaults to the first-dry-run id. */
  scenario?: string;
}): TradeEmitResult {
  const validationError = validateRfqInput(args.input);
  if (validationError) return validationError;

  if (!isCounterpartyEligible(args.store, args.input.counterpartyId)) {
    return {
      status: "rejected",
      reason: `counterparty ${args.input.counterpartyId} is not in the eligibility-passing picker (pack §3 G1)`,
      field: "counterpartyId",
    };
  }

  const quote = quoteRfq(args.input);
  const rfqId = args.input.rfqId ?? `rfq:${newEventId()}`;
  const tradeId = `trd:${newEventId()}`;

  const provenance = simulatedTag({
    scenario: args.scenario ?? FIRST_DRY_RUN_SCENARIO,
    sourceLineage: KAI_FX_RFQ_LINEAGE,
    tags: ["fx-desk", "slice-2", `rfq:${rfqId}`],
  });

  const event = makeFxTradeExecuted({
    asOf: args.asOf,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:kai:fx-rfq" },
    citations: [...TRADE_EMIT_CITATIONS],
    payload: buildSpotPayload({
      tradeId,
      input: args.input,
      quote,
      asOfDate: args.asOf.slice(0, 10),
    }),
  });

  const eventWithProvenance: Event = { ...event, provenance };
  args.store.append(eventWithProvenance);

  return {
    status: "ok",
    tradeId,
    rfqId,
    eventId: event.event_id,
    eventType: "FxTradeExecuted",
    quote,
    provenance,
    asOf: args.asOf,
  };
}

// ---------------------------------------------------------------------------
// Quote-only endpoint (GET-style) — returns a synthetic quote without
// appending. The UI calls this to render the bid/offer panel in the form
// before the user clicks "Trade".
// ---------------------------------------------------------------------------

export interface QuoteOnlyOk {
  readonly status: "ok";
  readonly quote: SyntheticQuote;
  readonly currencyPair: string;
  readonly notional: number;
  readonly side: "buy" | "sell";
}

export function quoteOnly(input: RfqInput): QuoteOnlyOk | TradeEmitErr {
  const validationError = validateRfqInput(input);
  if (validationError) return validationError;
  return {
    status: "ok",
    quote: quoteRfq(input),
    currencyPair: input.currencyPair,
    notional: input.notional,
    side: input.side,
  };
}
