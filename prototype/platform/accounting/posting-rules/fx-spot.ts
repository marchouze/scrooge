// platform/accounting/posting-rules/fx-spot.ts
//
// FX Spot posting rules — three pure functions mapping FX lifecycle
// events to balanced double-entry GL postings.
//
// Posting rules implemented (per FX Spec §C):
//   PR-FX-001: fxTradeBookingJournals  — FxTradeExecuted (spot booking)
//   PR-FX-002: fxRevaluationJournals   — FxPositionRevalued (daily FVTPL)
//   PR-FX-003: fxSettlementJournals    — FxSettlementConfirmed (T+2 cash)
//
// All functions return SubLedgerLeg[] that balance per currency.
// Balance invariant: sum(debit.amountMinor) == sum(credit.amountMinor)
// per currency, per call. Validated by SubLedgerPostingEmitted schema
// at event-emit time.
//
// Chart-of-accounts references (defined in _chart-of-accounts.md):
//   ACC-2100-001  FX Trading Receivable — ZAR
//   ACC-2100-002  FX Trading Receivable — USD
//   ACC-2100-003  FX Trading Payable    — ZAR
//   ACC-2100-004  FX Trading Payable    — USD
//   ACC-2100-005  Unrealised FX P&L — FVTPL
//   ACC-2100-006  Realised FX P&L
//   ACC-1100-001  Nostro ZAR (SARB operational)
//   ACC-1100-002  Nostro USD (correspondent)
//   ACC-1100-003  Nostro EUR (correspondent)
//   ACC-1100-004  FX Settlement Suspense — ZAR
//   ACC-1100-005  FX Settlement Suspense — USD
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §3.1.1, §4.1.1, §5.7.1
//   - IAS 21 §21, §28
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import type { FxLeg, FxTradeExecutedPayload } from "../../markets/cdm/fx";
import type { SubLedgerLeg } from "../fx-accounting-types";
import type {
  FxPositionRevaluedPayload,
  FxSettlementConfirmedPayload,
} from "../../event-store/event-types/fx-accounting";

// ---------------------------------------------------------------------------
// Account ID constants — chart-of-accounts leaf IDs
// ---------------------------------------------------------------------------

export const FX_ACCOUNTS = {
  RECEIVABLE_ZAR: "ACC-2100-001",
  RECEIVABLE_USD: "ACC-2100-002",
  PAYABLE_ZAR: "ACC-2100-003",
  PAYABLE_USD: "ACC-2100-004",
  UNREALISED_PNL: "ACC-2100-005",
  REALISED_PNL: "ACC-2100-006",
  NOSTRO_ZAR: "ACC-1100-001",
  NOSTRO_USD: "ACC-1100-002",
  NOSTRO_EUR: "ACC-1100-003",
  SUSPENSE_ZAR: "ACC-1100-004",
  SUSPENSE_USD: "ACC-1100-005",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a currency code to the FX Trading Receivable account ID. */
function receivableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.RECEIVABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.RECEIVABLE_USD;
    default:
      // For currencies without a dedicated account, use USD slot as a stub.
      // Production: add dedicated account ID per Principle 5.
      return FX_ACCOUNTS.RECEIVABLE_USD;
  }
}

/** Map a currency code to the FX Trading Payable account ID. */
function payableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.PAYABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.PAYABLE_USD;
    default:
      return FX_ACCOUNTS.PAYABLE_USD;
  }
}

/** Map a currency code to the Nostro account ID. */
export function nostroAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.NOSTRO_ZAR;
    case "USD":
      return FX_ACCOUNTS.NOSTRO_USD;
    case "EUR":
      return FX_ACCOUNTS.NOSTRO_EUR;
    default:
      return FX_ACCOUNTS.NOSTRO_USD;
  }
}

// ---------------------------------------------------------------------------
// PR-FX-001: Trade booking journals
//
// On FxTradeExecuted (spot leg only — productTaxonomy = "FX-spot"):
//
//   For each leg of the trade:
//   If bank RECEIVES the currency (positive notional = bank buys the currency):
//     Dr  FX Trading Receivable [receive currency]   [counterNotional amount]
//     Cr  FX Trading Payable    [pay currency]        [notional amount]
//
//   The entries are in the respective currencies. The net of these two
//   postings — when translated to ZAR at the agreed rate — is zero
//   (fair value = 0 at inception for an arm's-length deal at mid-market).
//   Bid/offer spread is recognised in Realised P&L at settlement.
//
// Currency convention: each leg posts in its own currency. The double-entry
// balances per currency: the receivable and payable are in different
// currencies, so each currency has one debit and one credit across both legs.
// We achieve this by treating the two-currency trade as two single-currency
// sub-entries:
//
//   ZAR entry: Dr ACC-2100-001 (ZAR receivable) / Cr ACC-2100-003 (ZAR payable)
//              — whichever direction applies
//   USD entry: Dr ACC-2100-002 (USD receivable) / Cr ACC-2100-004 (USD payable)
//              — whichever direction applies
// ---------------------------------------------------------------------------

export function fxTradeBookingJournals(
  event: { tradeId: string; side: string; legs: FxLeg[] } & Pick<
    FxTradeExecutedPayload,
    "currencyPair"
  >,
): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];

  for (const leg of event.legs) {
    if (leg.legKind !== "near") continue; // Spot only handles near leg

    // From the bank's perspective on the near leg:
    //   side = "buy"  → bank pays payCurrency and receives receiveCurrency
    //   (payCurrency is what we give; receiveCurrency is what we get)
    //
    // The FxLeg definition: positive notional = bank receives payCurrency.
    // We interpret: bank "pays" payCurrency leg (credit = payable) and
    // "receives" receiveCurrency leg (debit = receivable).

    const payCcy = leg.payCurrency;
    const receiveCcy = leg.receiveCurrency;
    const payAmount = Math.abs(leg.notional.amountMinor);
    const receiveAmount = Math.abs(leg.counterNotional.amountMinor);

    // Pay leg: bank delivers payCurrency → Cr FX Payable [payCcy], Dr FX Receivable [payCcy] as offset
    // Receive leg: bank receives receiveCcy → Dr FX Receivable [receiveCcy], Cr FX Payable [receiveCcy] as offset

    // ZAR sub-entry (or payCcy sub-entry)
    legs.push({
      accountId: payableAccountFor(payCcy),
      debitCredit: "debit",
      amountMinor: payAmount,
      currency: payCcy,
    });
    legs.push({
      accountId: receivableAccountFor(payCcy),
      debitCredit: "credit",
      amountMinor: payAmount,
      currency: payCcy,
    });

    // receiveCcy sub-entry
    legs.push({
      accountId: receivableAccountFor(receiveCcy),
      debitCredit: "debit",
      amountMinor: receiveAmount,
      currency: receiveCcy,
    });
    legs.push({
      accountId: payableAccountFor(receiveCcy),
      debitCredit: "credit",
      amountMinor: receiveAmount,
      currency: receiveCcy,
    });
  }

  return legs;
}

// ---------------------------------------------------------------------------
// PR-FX-002: Daily revaluation journals
//
// On FxPositionRevalued (emitted daily by Bea's close engine):
//
//   If unrealisedPnlZarMinor > 0 (gain — asset value increased):
//     Dr  ACC-2100-001/002  FX Trading Receivable [ZAR]  [|Δ fair value|]
//     Cr  ACC-2100-005      Unrealised FX P&L             [|Δ fair value|]
//
//   If unrealisedPnlZarMinor < 0 (loss — asset value decreased):
//     Dr  ACC-2100-005      Unrealised FX P&L             [|Δ fair value|]
//     Cr  ACC-2100-001/002  FX Trading Receivable [ZAR]  [|Δ fair value|]
//
//   All revaluation entries are in ZAR (functional currency).
//   No OCI — FVTPL trading book per IFRS 9 §5.7.1.
//
// Zero-delta: if unrealisedPnlZarMinor = 0, returns empty array (no posting).
// ---------------------------------------------------------------------------

export function fxRevaluationJournals(event: FxPositionRevaluedPayload): SubLedgerLeg[] {
  const delta = event.unrealisedPnlZarMinor;

  if (delta === 0) return [];

  const absAmount = Math.abs(delta);
  const isGain = delta > 0;

  // Use ZAR receivable account for the revaluation posting (ZAR is functional currency).
  // The receivable is the asset being revalued.
  return [
    {
      accountId: isGain ? FX_ACCOUNTS.RECEIVABLE_ZAR : FX_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
    {
      accountId: isGain ? FX_ACCOUNTS.UNREALISED_PNL : FX_ACCOUNTS.RECEIVABLE_ZAR,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-003: Settlement journals
//
// On FxSettlementConfirmed (T+2 cash exchange):
//
//   (i) Receive base currency into nostro:
//     Dr  Nostro [base ccy]          [settledBaseCurrencyMinor]
//     Cr  FX Trading Receivable [base ccy]  [settledBaseCurrencyMinor]
//
//   (ii) Deliver quote currency from nostro:
//     Dr  FX Trading Payable [quote ccy]  [|settledQuoteCurrencyMinor|]
//     Cr  Nostro [quote ccy]               [|settledQuoteCurrencyMinor|]
//
//   (iii) Realised P&L (if any residual):
//     If realisedPnlZarMinor > 0 (gain):
//       Dr  ACC-1100-001  Nostro ZAR  [realisedPnlZarMinor]
//       Cr  ACC-2100-006  Realised FX P&L  [realisedPnlZarMinor]
//     If realisedPnlZarMinor < 0 (loss):
//       Dr  ACC-2100-006  Realised FX P&L  [|realisedPnlZarMinor|]
//       Cr  ACC-1100-001  Nostro ZAR        [|realisedPnlZarMinor|]
//
//   Each sub-entry balances in its own currency.
// ---------------------------------------------------------------------------

export function fxSettlementJournals(event: FxSettlementConfirmedPayload): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];

  // Determine currencies from the currencyPair field (e.g. "ZAR/USD")
  const [baseCcy, quoteCcy] = event.currencyPair.split("/");
  if (!baseCcy || !quoteCcy) {
    throw new Error(`fxSettlementJournals: invalid currencyPair '${event.currencyPair}'`);
  }

  // (i) Receive base currency (positive = bank received, negative = bank paid)
  const baseAbs = Math.abs(event.settledBaseCurrencyMinor);
  if (baseAbs > 0) {
    const bankReceivesBase = event.settledBaseCurrencyMinor > 0;
    legs.push({
      accountId: bankReceivesBase ? event.nostroAccountBase : receivableAccountFor(baseCcy),
      debitCredit: "debit",
      amountMinor: baseAbs,
      currency: baseCcy,
    });
    legs.push({
      accountId: bankReceivesBase ? receivableAccountFor(baseCcy) : event.nostroAccountBase,
      debitCredit: "credit",
      amountMinor: baseAbs,
      currency: baseCcy,
    });
  }

  // (ii) Deliver/receive quote currency
  const quoteAbs = Math.abs(event.settledQuoteCurrencyMinor);
  if (quoteAbs > 0) {
    const bankReceivesQuote = event.settledQuoteCurrencyMinor > 0;
    legs.push({
      accountId: bankReceivesQuote ? event.nostroAccountQuote : payableAccountFor(quoteCcy),
      debitCredit: "debit",
      amountMinor: quoteAbs,
      currency: quoteCcy,
    });
    legs.push({
      accountId: bankReceivesQuote ? payableAccountFor(quoteCcy) : event.nostroAccountQuote,
      debitCredit: "credit",
      amountMinor: quoteAbs,
      currency: quoteCcy,
    });
  }

  // (iii) Realised P&L residual in ZAR
  const pnl = event.realisedPnlZarMinor;
  if (pnl !== 0) {
    const pnlAbs = Math.abs(pnl);
    const isGain = pnl > 0;
    legs.push({
      accountId: isGain ? FX_ACCOUNTS.NOSTRO_ZAR : FX_ACCOUNTS.REALISED_PNL,
      debitCredit: "debit",
      amountMinor: pnlAbs,
      currency: "ZAR",
    });
    legs.push({
      accountId: isGain ? FX_ACCOUNTS.REALISED_PNL : FX_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: pnlAbs,
      currency: "ZAR",
    });
  }

  return legs;
}
