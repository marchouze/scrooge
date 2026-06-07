// platform/markets/cdm/bond-book.ts
//
// Bond-trade booking input contract. The bond analogue of the FX TradeBookBody.
// Both the `/api/bonds/book-bilateral` HTTP route and the bond market-making
// simulator construct one of these and book through the single `bookBondTrade`
// path (dashboard/bond-gateway.ts), so a simulated counterparty trade books
// exactly like a manual one (BondTradeExecuted → GL → BondSettlementInstructed
// → custodian).
//
// This type lives in the platform layer (not dashboard) so platform-layer
// producers (the bond simulator) can reference it without a layering inversion;
// the dashboard `bookBondTrade` function is the canonical consumer.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MANUAL-TRADE-BOOKING;
//   D-TRADE-LIFECYCLE-IFRS-CHAIN.
// Author: Devon (Chief Operating Officer, engineering)

export interface BondTradeBookBody {
  readonly tradeId: string;
  readonly isin: string;
  readonly side: "buy" | "sell";
  /** Face value in ZAR minor units (cents), positive integer. */
  readonly nominalMinor: number;
  /** Clean price as a percentage of par (e.g. 101.52). */
  readonly cleanPricePct: number;
  /** Accrued interest in ZAR minor units (cents), non-negative integer. */
  readonly accruedInterestMinor: number;
  readonly portfolio: "trading-book" | "banking-book";
  /** Annual coupon rate in decimal form (e.g. 0.105). */
  readonly couponRate: number;
  readonly maturityDate: string;
  readonly counterpartyLei: string;
  /** Settlement date (YYYY-MM-DD). Defaults to T+3 from now when omitted. */
  readonly settlementDate?: string;
  /** Provenance mode — "simulated" tags build-phase, "production" books real. */
  readonly provenanceMode?: "simulated" | "production";
  /** Booking actor. Defaults to the human operator (HTTP route). */
  readonly actor?: { readonly type: "human" | "service" | "system"; readonly id: string };
  /** Trader reference recorded on the lineage tags. */
  readonly traderRef?: string;
}
