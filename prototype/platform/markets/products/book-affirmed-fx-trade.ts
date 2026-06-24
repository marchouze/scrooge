// platform/markets/products/book-affirmed-fx-trade.ts
//
// SUT-side FX booking — M3 (WS-FX-V2-SIMULATOR).
//
// Books a FIL FX instrument for an AFFIRMED trade. This is the BANK's own
// internal action: it lives on the SUT side (NOT in the simulator package — the
// simulator↔SUT boundary gate forbids the simulator from emitting
// `FilInstrumentCreated`). Settlement is gated on affirmation: a rejected /
// unconfirmed trade books nothing (fail-closed).
//
// The booking emits `FilInstrumentCreated` (assetClass "fx") so the EOD
// daily-pnl-v2 + var-engine-v2 read the position. The instrument is product-
// agnostic FIL native; the FX type URN binds the spot/forward taxonomy. The
// FilInstrumentCreated provenance is derived by the store's category policy
// (governance/production) — the SUT never hand-tags simulated.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-FIL-FRAMEWORK-UNIFICATION (FIL instance lifecycle).
// Author: Atlas (Core banking platform architect, engineering).

import { mulD, roundDecimal, toDecimal } from "../../../v2-core/fil-core/decimal";
import { moneyFromDecimal } from "../../../v2-core/fil-core/primitives";
import { formatInstanceUrn, formatTypeUrn } from "../../../v2-core/fil-core/urn";
import { filInstrumentCreatedPayloadSchema } from "../../../v2-core/fil-instances/events";
import { makeFilInstrumentCreated } from "../../event-store/event-types/fil-instances";
import { type ProvenanceTag, provenanceForEmit } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

/** Major-unit number → v2 decimal-native Money (2dp HALF_UP), mirroring the FX materialiser. */
function majorNumberToMoney(majorUnits: number, currency: string) {
  return moneyFromDecimal(currency, roundDecimal(toDecimal(String(majorUnits)), 2, "HALF_UP"));
}

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;

const FX_SPOT_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const FX_FORWARD_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "forward",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});

/** The trade detail the SUT booking step needs (subset of ScenarioTradeAction). */
export interface AffirmedFxTrade {
  readonly tradeId: string;
  readonly counterpartyId: string;
  readonly productTaxonomy: "FX-spot" | "FX-forward";
  readonly pair: string;
  readonly side: "buy" | "sell";
  readonly baseNotionalMajor: number;
  /**
   * Agreed all-in rate (quote per 1 base). REQUIRED so the booking site can carry
   * the SYMMETRIC FX agreement quad (D-FX-INSTRUMENT-BUYSELL-QUAD) — the counter
   * (quote-currency) leg is `baseNotionalMajor × rate`. Previously the booking site
   * computed only the base notional and DROPPED this counter amount; sourcing it
   * from the upstream trade (the `rate` on `FxTradeExecuted` / `ScenarioTradeAction`)
   * makes the instrument self-describing rather than recomputing from thin air.
   */
  readonly rate: number;
  readonly settlementDate: string;
}

/**
 * Book a FIL FX instrument for an affirmed trade. Reads `TradeAffirmed` for
 * `trade.tradeId` from the store; if absent (rejected / unconfirmed) books
 * NOTHING and returns false. Idempotent — a re-book is a no-op.
 *
 * Returns true iff a new FilInstrumentCreated was emitted.
 */
export function bookAffirmedFxTrade(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly reporting: string;
  readonly trade: AffirmedFxTrade;
  /**
   * OPTIONAL explicit provenance. Defaults to the active category policy via
   * `provenanceForEmit` (governance→production) — the normal SUT path. The LIVE
   * third-party simulator (platform/simulation-v2-live/) passes a `simulated` tag
   * so its generated trades are provenance-segregated in the shared event store
   * (V1 `provenanceMode` parity) and never leak into production reads.
   */
  readonly provenance?: ProvenanceTag;
}): boolean {
  const { store, scenarioId, asOf, reporting, trade, provenance } = args;

  // Gate: only book if the counterparty affirmed (settlement gated on affirmation).
  const affirmed = [...store.replay({ type: "TradeAffirmed" })].some(
    (e) => (e.payload as { tradeId?: string }).tradeId === trade.tradeId,
  );
  if (!affirmed) return false;

  const instance = formatInstanceUrn({ tenant: TENANT, instanceId: trade.tradeId });
  const already = [...store.replay({ type: "FilInstrumentCreated" })].some(
    (e) => (e.payload as { instance?: string }).instance === instance,
  );
  if (already) return false;

  const isForward = trade.productTaxonomy === "FX-forward";
  const fxTypeUrn = isForward ? FX_FORWARD_TYPE_URN : FX_SPOT_TYPE_URN;
  const base = splitBase(trade.pair, reporting);
  const quote = splitQuote(trade.pair, reporting);
  const direction: "long" | "short" = trade.side === "buy" ? "long" : "short";
  const nettingSetId = `NS-${trade.counterpartyId}-${reporting}`;

  // SYMMETRIC FX AGREEMENT QUAD (D-FX-INSTRUMENT-BUYSELL-QUAD). An FX trade IS an
  // agreement to BUY one currency and SELL another on the settlement date. Source
  // BOTH legs from the trade: the base-currency amount is `baseNotionalMajor`; the
  // counter (quote) amount is `baseNotionalMajor × rate` (the previously-DROPPED
  // leg, now threaded through `AffirmedFxTrade.rate`). A `buy` from the bank's
  // perspective RECEIVES the base and PAYS the quote; a `sell` does the reverse.
  // `notional` / `direction` above DERIVE from this quad (notional = the base-leg
  // magnitude, in the instrument currency `base`; direction long = bought base).
  // Decimal-native multiply (no float `*` — the no-float-money gate forbids it).
  const baseAmountMajor = Math.abs(trade.baseNotionalMajor);
  const quoteAmount = moneyFromDecimal(
    quote,
    roundDecimal(
      mulD(toDecimal(String(baseAmountMajor)), toDecimal(String(trade.rate))),
      2,
      "HALF_UP",
    ),
  );
  const baseMoney = majorNumberToMoney(baseAmountMajor, base);
  const fxAgreement =
    trade.side === "buy"
      ? { buy: baseMoney, sell: quoteAmount }
      : { buy: quoteAmount, sell: baseMoney };

  store.append(
    makeFilInstrumentCreated({
      asOf,
      entity: ENTITY,
      actor: { type: "service", id: "agent:sut:fx-booking-engine" },
      citations: ["D-FX-V2-SIMULATOR-FIRST", "D-FIL-FRAMEWORK-UNIFICATION"],
      // EXPLICIT provenance (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN): the
      // SUT booking engine is the originating system. The kind is decided by
      // the active category policy (governance→production), NOT the call-site;
      // we only supply the concrete originating-system lineage so the event
      // never relies on the `category:*` soft-default (which fails OPEN).
      provenance:
        provenance ??
        provenanceForEmit("FilInstrumentCreated", {
          sourceLineage: "sut:fx-booking-engine",
        }),
      eventId: `${scenarioId}:${trade.tradeId}:fil-created`,
      payload: filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance,
        type: fxTypeUrn,
        tenant: TENANT,
        asOf,
        originatingEvent: {
          eventType: "TradeAffirmed",
          eventId: `${scenarioId}:${trade.tradeId}:affirmed`,
        },
        initialStage: "active",
        economicTerms: {
          assetClass: "fx",
          notional: majorNumberToMoney(Math.abs(trade.baseNotionalMajor), base),
          direction,
          counterpartyId: trade.counterpartyId,
          nettingSetId,
          currency: base,
          settlementDate: trade.settlementDate,
          hedgingSetTag: trade.pair,
          fxAgreement,
        },
      }),
    }),
  );
  return true;
}

function splitBase(pair: string, reporting: string): string {
  const slash = pair.indexOf("/");
  if (slash <= 0) return pair;
  const base = pair.slice(0, slash);
  return base || reporting;
}

/** The QUOTE currency of a `<base>/<quote>` pair, falling back to reporting. */
function splitQuote(pair: string, reporting: string): string {
  const slash = pair.indexOf("/");
  if (slash <= 0) return reporting;
  const quote = pair.slice(slash + 1);
  return quote || reporting;
}
