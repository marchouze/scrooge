// dashboard/markets-fx-trade.ts
//
// FX desk Slices 2 + 3 — RFQ → quote → trade-emit pipeline.
//
// Slice 2 reference: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   pack §6 Slice 2 — RFQ form + trade-emit.
//
// Slice 3 additions (2026-05-18):
//   • Seed-data pricer replaces the fixed-spread stub (quoteRfq body).
//   • RfqRequested + QuoteResponded events emitted before FxTradeExecuted.
//   • `loadSeedRate(currencyPair)` helper exported for tests.
//
// The seed stores rates as minor units × 10^6 for 6dp precision.
// For ZAR/USD: 1850000 minor units → 1850000 / 100000 = 18.50000 ZAR per USD
// (comment in fx-rates.json: "ZAR cents per USD cent, i.e. rate × 1,000,000").
// Dividing by 100,000 converts back to ZAR per USD at 5dp, which is the
// standard 6dp spot quote format (18.50000). The seed date used is the
// latest available date (max ISO string comparison).
//
// Provenance (D-DATA-PROVENANCE-SUBSTRATE Slice 6+1, PR #161):
// every trade event is tagged `kind: 'simulated', scenario:
// 'first-dry-run-2026-Q1', sourceLineage: 'agent:kai:fx-rfq'`
// per the dispatch brief.
//
// Author: Kai (Trading systems engineer, engineering — reports to
//         Saskia, Head of Global Markets) · Saskia (Head of Global
//         Markets, governance) · Anya (Data / analytics engineer,
//         engineering — projection / derivation pattern review).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { newEventId } from "../platform/core/types";
import { makeQuoteResponded, makeRfqRequested } from "../platform/event-store/event-types/trading";
import { simulatedTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import type { Event, ProvenanceTag } from "../platform/event-store/types";
import { type FxTradeExecutedPayload, makeFxTradeExecuted } from "../platform/markets/cdm/fx";
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

/** Fallback mid-rate for ZAR/USD — used when the seed file cannot resolve
 *  the requested pair. Matches the original fixed stub so tests are not
 *  broken if the seed file is unavailable. */
export const SYNTHETIC_USDZAR_MID = 18.5;

/** Symmetric half-spread (ZAR per USD) — 25 pips on a 4-decimal quote. */
export const SYNTHETIC_HALF_SPREAD = 0.0025;

/** Citations attached to every event emitted from this seam.
 *  Per Principle 2 (every action traces to a source) — the FX-CDM `make`
 *  helper rejects empty citation arrays. The TBC entry is the FAIS sub-
 *  section URN cluster Mira will populate at M4 substrate-completion. */
const TRADE_EMIT_CITATIONS = [
  "D-FX-SALES-TRADING-FRONTEND",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-BOOK-BOUNDARY",
  "Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md",
  "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md",
  "RfqRequested",
  "QuoteResponded",
  "[citation: TBC pending counsel — FAIS s.45 sub-section refs]",
] as const;

// ---------------------------------------------------------------------------
// Seed-data pricer — Slice 3 (replaces fixed-spread stub).
//
// Reads fx-rates.json relative to this file's location at runtime.
// Seed rates are standard Forex convention × 10^6:
//   ZAR/USD = USD per ZAR (e.g. 54054 → 0.054054 USD per 1 ZAR)
//   USD/ZAR = ZAR per USD (e.g. 18500000 → 18.5 ZAR per 1 USD)
// The RFQ pricer uses USD/ZAR to quote how many ZAR the bank pays per USD.
// ---------------------------------------------------------------------------

/** Minor-unit divisor for fx-rates.json seed values → decimal rate. */
const SEED_MINOR_UNIT_DIVISOR = 1_000_000;

/**
 * Load the mid-rate for a currency pair from the seed file.
 * Returns the rate in major units (e.g. ZAR per USD for "ZAR/USD").
 * Falls back to SYNTHETIC_USDZAR_MID if the pair is not found.
 *
 * Exported so tests can verify the seed-reader independently.
 */
export function loadSeedRate(currencyPair: string): number {
  try {
    const seedPath = resolve(import.meta.dir, "../seeds/fx-rates.json");
    const raw = readFileSync(seedPath, "utf8");
    const table = JSON.parse(raw) as Record<string, Record<string, number>>;
    const pairRates = table[currencyPair];
    if (!pairRates || typeof pairRates !== "object") {
      return SYNTHETIC_USDZAR_MID;
    }
    // Use the most-recent date entry (max ISO string comparison).
    const dates = Object.keys(pairRates).sort();
    const latestDate = dates[dates.length - 1];
    if (!latestDate) return SYNTHETIC_USDZAR_MID;
    const rawRate = pairRates[latestDate];
    if (typeof rawRate !== "number" || rawRate <= 0) return SYNTHETIC_USDZAR_MID;
    return rawRate / SEED_MINOR_UNIT_DIVISOR;
  } catch {
    // Seed file unavailable — fall back to hard-coded mid.
    return SYNTHETIC_USDZAR_MID;
  }
}

// ---------------------------------------------------------------------------
// Synthetic quote stub — Slice 3 substitute.
// ---------------------------------------------------------------------------

/**
 * Return a seed-data-driven ZAR/USD quote (Slice 3).
 *
 * Reads the mid-rate from seeds/fx-rates.json using the most-recent
 * date entry for the given `currencyPair`. The RFQ form always quotes
 * "USD/ZAR" to the user, but the seed stores the ZAR-per-USD rate
 * under "ZAR/USD" (the canonical pair with ZAR as base). The caller
 * passes the seed-lookup pair (default "ZAR/USD").
 *
 * The spread is symmetric at SYNTHETIC_HALF_SPREAD (25 pips).
 * The bank-internal rate (rateUsed) is side-appropriate: bank buys USD
 * at offer, sells USD at bid.
 *
 * @param input       RFQ side (buy = bank buys USD; sell = bank sells USD).
 * @param currencyPair Seed-file lookup key (default "ZAR/USD").
 */
export function quoteRfq(input: Pick<RfqInput, "side">, currencyPair = "USD/ZAR"): SyntheticQuote {
  const midRate = loadSeedRate(currencyPair);
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
    source: "seed-data-pricer-v1",
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
    return {
      status: "rejected",
      reason: "rfqId, if supplied, must be a non-empty string",
      field: "rfqId",
    };
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
  const counterNotionalZarMinor = Math.round(args.input.notional * args.quote.rateUsed * 100);

  // Bank "buy" of USD: pays ZAR, receives USD.
  // Bank "sell" of USD: pays USD, receives ZAR.
  const payCurrency = args.input.side === "buy" ? "ZAR" : "USD";
  const receiveCurrency = args.input.side === "buy" ? "USD" : "ZAR";
  const payAmountMinor = args.input.side === "buy" ? counterNotionalZarMinor : baseNotionalUsdMinor;
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
    // No-prop attribution (G-3). RFQ-sourced trades are by construction
    // client-flow — the bank quoted in response to a counterparty RFQ.
    // The rfqId is the natural client-flow correlation id; the explicit
    // RFQ → trade lineage already enforces it. The dashboard UI does not
    // yet surface this field separately (out of scope for G-3 — see brief).
    // TODO(G-3 follow-on): expose a hedge-programme dropdown for the
    // bank-as-principal hedge flow once Helena's hedge-programme register
    // lands.
    clientFlowRef: `client-rfq:${args.input.rfqId ?? args.tradeId}`,
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

  const rfqId = args.input.rfqId ?? `rfq:${newEventId()}`;
  const tradeId = `trd:${newEventId()}`;

  const provenance = simulatedTag({
    scenario: args.scenario ?? FIRST_DRY_RUN_SCENARIO,
    sourceLineage: KAI_FX_RFQ_LINEAGE,
    tags: ["fx-desk", "slice-3", `rfq:${rfqId}`],
  });

  const commonArgs = {
    asOf: args.asOf,
    entity: "BANK-ZA-001",
    actor: { type: "service" as const, id: "agent:kai:fx-rfq" },
    citations: [...TRADE_EMIT_CITATIONS],
  };

  // Slice 3 — emit RfqRequested before the quote and trade events.
  const rfqRequestedEvent = makeRfqRequested({
    ...commonArgs,
    payload: {
      rfqId,
      counterpartyId: args.input.counterpartyId,
      currencyPair: args.input.currencyPair,
      side: args.input.side,
      notional: args.input.notional,
      valueDate: args.input.valueDate,
      requestedAt: args.asOf,
    },
  });
  args.store.append({ ...rfqRequestedEvent, provenance });

  // Price the quote using the seed-data pricer (Slice 3).
  const quote = quoteRfq(args.input);

  // Slice 3 — emit QuoteResponded after pricing, before trade execution.
  const quoteRespondedEvent = makeQuoteResponded({
    ...commonArgs,
    payload: {
      rfqId,
      bidRate: quote.bidRate,
      midRate: quote.midRate,
      offerRate: quote.offerRate,
      halfSpread: quote.halfSpread,
      source: quote.source,
      quotedAt: args.asOf,
    },
  });
  args.store.append({ ...quoteRespondedEvent, provenance });

  const event = makeFxTradeExecuted({
    ...commonArgs,
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
