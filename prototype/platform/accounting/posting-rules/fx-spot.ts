// platform/accounting/posting-rules/fx-spot.ts
//
// FX Spot posting rules — pure functions mapping FX lifecycle events to
// balanced double-entry GL postings.
//
// Posting rules implemented (per FX Spec §C):
//   PR-FX-001: fxTradeBookingJournals     — FxTradeExecuted (spot booking)
//   PR-FX-002: fxRevaluationJournals      — FxPositionRevalued (daily FVTPL)
//   PR-FX-PRIN: fxPrincipalPaymentJournals — PrincipalPayment
//                                            (per-leg cash at correspondent
//                                             confirmation; GL-significant since
//                                             2026-05-20)
//   PR-FX-LIFECYCLE-CLOSE: fxLifecycleCloseJournals — SettlementConfirmed (CDM)
//                                            (realised-P&L residual; closes the
//                                             trade; GL-significant since
//                                             2026-05-20)
//   PR-FX-003: fxSettlementJournals       — FxSettlementConfirmed (DEPRECATED
//                                            2026-05-20 — superseded by
//                                            PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE;
//                                            kept for back-compat with legacy
//                                            test-only emitters of the
//                                            accounting `FxSettlementConfirmed`
//                                            event-type)
//   PR-FX-REV: fxSettlementReversalJournals — SettlementReversed (mirrors PR-FX-003)
//   PR-FX-CANCEL: fxCancellationJournals  — TradeCancelled (net-zero reversal)
//   PR-FX-AMD: fxAmendmentJournals        — TradeAmended (delta for rate/notional)
//   PR-FX-INSTRUCT: fxSettlementInstructedJournals — FxSettlementInstructed (memo; no GL)
//   PR-FX-REGREPORT: fxTradeReportSubmittedJournals — TradeReportSubmitted (memo)
//   PR-FX-005: fxSettlementFailedJournals — FxSettlementFailed
//                                            (IFRS-9 default-recognition; reclassifies
//                                             defaulted receivable from FVTPL trading
//                                             to amortised-cost settlement-failed
//                                             receivable + 100% Stage-3 ECL on the
//                                             one-leg-delivered Herstatt branch;
//                                             neither-delivered + operational-delay
//                                             produce no GL legs — see header
//                                             docblock for the IFRS scoping reasoning)
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
//   ACC-2300-001  Settlement-Failed Receivable — ZAR (amortised cost, credit-impaired)
//   ACC-2300-002  Settlement-Failed Receivable — USD (amortised cost, credit-impaired)
//   ACC-2300-003  ECL Allowance — Settlement-Failed Receivables (contra-asset, ZAR)
//   ACC-2300-004  Credit Loss Expense — FX Settlement Failures (P&L, ZAR)
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §3.1.1, §4.1.1, §5.7.1
//   - IAS 21 §21, §28
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import type {
  FxPositionRevaluedPayload,
  FxSettlementConfirmedPayload,
  FxSettlementFailedPayload,
} from "../../event-store/event-types/fx-accounting";
import type { TradeReportSubmittedPayload } from "../../event-store/event-types/regulatory-reporting";
import type {
  FxLeg,
  FxSettlementInstructedPayload,
  FxTradeExecutedPayload,
  PrincipalPaymentPayload,
  SettlementConfirmedPayload,
} from "../../markets/cdm/fx";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Types for new posting rules
// ---------------------------------------------------------------------------

export interface FxSettlementReversalInput {
  /** The tradeId of the reversed trade. */
  tradeId: string;
  /** Full payload of the original FxSettlementConfirmed event. */
  originalSettlement: FxSettlementConfirmedPayload;
}

export interface FxCancellationInput {
  /** The tradeId being cancelled. */
  tradeId: string;
  /**
   * Cumulative unrealised P&L (ZAR minor) accumulated across all prior
   * PR-FX-002 revaluation postings since trade date. Pass 0 if no
   * revaluations have been posted.
   */
  cumulativeUnrealisedPnlZarMinor: number;
  /**
   * Original booking legs from PR-FX-001 (the fxTradeBookingJournals output
   * for this trade). Passed in by the engine which has access to the event
   * store.
   */
  bookingLegs: SubLedgerLeg[];
}

/**
 * Input for `fxSettlementFailedJournals` (PR-FX-005).
 *
 * The `FxSettlementFailed` payload itself carries refs + classification but
 * NOT the currency / amount of the failed receive-leg — the same shape
 * issue that `FxCancellationInput` solves for cancellations. The booking
 * context (the receive-leg amount that the bank was due to collect) is
 * supplied by the engine which has access to the originating
 * `FxTradeExecuted` event.
 *
 * Used only by the `one-leg-delivered` branch. For `neither-delivered`
 * and `operational-delay`, the rule returns `[]` and the booking-context
 * fields are ignored.
 */
export interface FxSettlementFailedInput {
  /** The full FxSettlementFailed payload (carries `failureKind`, refs, legStatus). */
  event: FxSettlementFailedPayload;
  /**
   * Booking context for the failed receive-leg (the leg the bank was due to
   * collect, that the counterparty failed to deliver). Required when
   * `event.failureKind === "one-leg-delivered"`; ignored otherwise.
   *
   * The engine resolves this from the originating `FxTradeExecuted` (PR-FX-001)
   * payload using `event.tradeRef`.
   */
  failedReceiveLeg?: {
    /** ISO-4217 code of the currency the bank was due to receive. */
    currency: string;
    /** Receive-leg notional in minor units of `currency`. */
    amountMinor: number;
    /**
     * Receive-leg notional translated to ZAR minor units at the failure date
     * spot rate (functional-currency ECL allowance basis per IAS 21 §28).
     */
    zarEquivalentMinor: number;
  };
}

export interface FxAmendmentInput {
  /** The tradeId being amended. */
  tradeId: string;
  /** Which field was amended. */
  field: "rate" | "notional" | "settlement-date" | "counterparty";
  /**
   * Delta amount in ZAR minor units (new carrying amount minus old carrying
   * amount). Only relevant for rate/notional amendments; ignored for
   * settlement-date/counterparty.
   */
  deltaZarMinor: number;
}

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
  // Settlement-failed receivable sub-ledger (PR-FX-005; added 2026-05-20).
  // Amortised-cost classification: once a settlement has failed and the
  // counterparty has defaulted on delivery, the receivable is no longer
  // "held for trading" (FVTPL §4.1.5) — it is a defaulted claim held to
  // collect. Reclassification per IFRS 9 §4.4.1 (change in business model
  // for a single instrument because of an objective default event) into
  // amortised cost brings the receivable in-scope for ECL §5.5.
  SETTLEMENT_FAILED_RECEIVABLE_ZAR: "ACC-2300-001",
  SETTLEMENT_FAILED_RECEIVABLE_USD: "ACC-2300-002",
  /** Contra-asset; lifetime ECL allowance on the settlement-failed receivable
   *  sub-ledger (IFRS 9 §5.5.3 — Stage 3 lifetime ECL). Carried in ZAR
   *  (functional currency) per IAS 21 §23 — the allowance is the bank's
   *  exposure measured in its functional currency. */
  ECL_ALLOWANCE_SETTLEMENT_FAILED: "ACC-2300-003",
  /** P&L line — credit-loss expense (IFRS 9 §5.5.8). Distinct from FX P&L
   *  (ACC-2100-005/006) because impairment loss is presented separately
   *  from trading-book FVTPL income per IAS 1 §82(ba). */
  CREDIT_LOSS_EXPENSE_FX: "ACC-2300-004",
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

/**
 * Map a currency code to the Settlement-Failed Receivable account ID
 * (PR-FX-005). Used when a defaulted receive-leg is reclassified from the
 * FVTPL trading receivable to the amortised-cost defaulted-claim sub-ledger.
 */
function settlementFailedReceivableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_USD;
    default:
      // Currencies without a dedicated account fall back to USD slot.
      // Production: add dedicated account per Principle 5 as currencies
      // are onboarded.
      return FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_USD;
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
    //
    // Convention fix (2026-05-20, brief
    // `brief:bea:fix-fx-posting-rule-circularity-pr-fx-prin-becom:2026-05-20`):
    // both currency sub-entries post `Dr Receivable [ccy] / Cr Payable [ccy]`
    // — the natural-side convention (Receivable is a debit-natural asset;
    // Payable is a credit-natural liability). Previously the pay-leg
    // sub-entry inverted this (`Dr Payable / Cr Receivable`), which left
    // unretirable balances when PR-FX-PRIN (Dr Payable / Cr Nostro on the
    // deliver leg) tried to derecognise the liability. The natural-side
    // convention lets PR-FX-PRIN close the active side of each currency:
    // receive-leg Cr's the Receivable; deliver-leg Dr's the Payable.

    // payCcy sub-entry: Dr Receivable [payCcy] / Cr Payable [payCcy]
    legs.push({
      accountId: receivableAccountFor(payCcy),
      debitCredit: "debit",
      amountMinor: payAmount,
      currency: payCcy,
    });
    legs.push({
      accountId: payableAccountFor(payCcy),
      debitCredit: "credit",
      amountMinor: payAmount,
      currency: payCcy,
    });

    // receiveCcy sub-entry: Dr Receivable [receiveCcy] / Cr Payable [receiveCcy]
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
// PR-FX-003: Settlement journals — DEPRECATED 2026-05-20
//
// @deprecated Use PR-FX-PRIN (`fxPrincipalPaymentJournals`) for per-leg cash
//   movements + PR-FX-LIFECYCLE-CLOSE (`fxLifecycleCloseJournals`) for the
//   realised-P&L residual. The accounting `FxSettlementConfirmed` event-type
//   is also deprecated: production paths never emitted it (only test code
//   constructed it), so PR-FX-003 was an unreachable code path. The CEO
//   decision of 2026-05-20 split its responsibilities across the two CDM
//   lifecycle events that ARE emitted by `post-trade-lifecycle.ts` and
//   scenarios 06/07.
//
// This function is kept (a) for backwards compatibility with the rare
// callers that still construct `FxSettlementConfirmed` payloads in tests
// for purposes other than FX accounting (e.g. `ba-325-lcr.test.ts` settled-
// trade detection); and (b) so the `bea-fx-posting-engine` / `bea-gl-
// posting-engine` handlers can continue to route a stray
// `FxSettlementConfirmed` if anything emits one during the deprecation
// window. New authoring must NOT add new emitters of `FxSettlementConfirmed`.
//
// Original posting behaviour (unchanged for back-compat):
//
//   (i) Receive base currency into nostro:
//     Dr  Nostro [base ccy]                            settledBaseCurrencyMinor
//     Cr  FX Trading Receivable [base ccy]             settledBaseCurrencyMinor
//
//   (ii) Deliver quote currency from nostro:
//     Dr  FX Trading Payable [quote ccy]               |settledQuoteCurrencyMinor|
//     Cr  Nostro [quote ccy]                           |settledQuoteCurrencyMinor|
//
//   (iii) Realised P&L residual:
//     If realisedPnlZarMinor > 0: Dr Nostro ZAR / Cr ACC-2100-006
//     If realisedPnlZarMinor < 0: Dr ACC-2100-006 / Cr Nostro ZAR
//
//   Each sub-entry balances in its own currency.
// ---------------------------------------------------------------------------

/** @deprecated 2026-05-20 — use `fxPrincipalPaymentJournals` + `fxLifecycleCloseJournals`. */
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

// ---------------------------------------------------------------------------
// PR-FX-REV: Settlement reversal journals
//
// On SettlementReversed: full mirror of the original PR-FX-003 entries —
// every debit becomes a credit and every credit becomes a debit.
// Re-opens the FX Trading Receivable/Payable that was derecognised.
//
// This is a pure function: it takes the original settlement payload and
// inverts every leg direction.
//
// IFRS authority: IFRS 9 §3.2.1 (derecognition reversed when conditions
// not met for transfer of risks and rewards).
// ---------------------------------------------------------------------------

export function fxSettlementReversalJournals(input: FxSettlementReversalInput): SubLedgerLeg[] {
  // Get the original settlement legs and invert each direction.
  const originalLegs = fxSettlementJournals(input.originalSettlement);

  return originalLegs.map((leg) => ({
    ...leg,
    debitCredit: leg.debitCredit === "debit" ? "credit" : "debit",
  }));
}

// ---------------------------------------------------------------------------
// PR-FX-CANCEL: Trade cancellation journals
//
// On TradeCancelled:
//   (i) Reverse all booking legs (invert each debit/credit in bookingLegs).
//   (ii) Reverse any cumulative unrealised P&L revaluation entries.
//
// Net result: all GL entries from this trade sum to zero per account.
//
// IFRS authority: IFRS 9 §3.2.3 (derecognition when contractual rights/
// obligations extinguished by cancellation).
// ---------------------------------------------------------------------------

export function fxCancellationJournals(input: FxCancellationInput): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];

  // (i) Reverse original booking legs (PR-FX-001 reversal)
  for (const leg of input.bookingLegs) {
    legs.push({
      ...leg,
      debitCredit: leg.debitCredit === "debit" ? "credit" : "debit",
    });
  }

  // (ii) Reverse cumulative unrealised P&L (net of all PR-FX-002 entries)
  // We reverse the net cumulative position: if net was a gain, the reversal
  // is a credit to ZAR receivable and debit to unrealised P&L (and vice versa).
  const cumPnl = input.cumulativeUnrealisedPnlZarMinor;
  if (cumPnl !== 0) {
    const absAmount = Math.abs(cumPnl);
    const wasGain = cumPnl > 0;
    // Original gain entry: Dr RECEIVABLE_ZAR / Cr UNREALISED_PNL
    // Reversal:            Cr RECEIVABLE_ZAR / Dr UNREALISED_PNL
    legs.push({
      accountId: wasGain ? FX_ACCOUNTS.UNREALISED_PNL : FX_ACCOUNTS.RECEIVABLE_ZAR,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: "ZAR",
    });
    legs.push({
      accountId: wasGain ? FX_ACCOUNTS.RECEIVABLE_ZAR : FX_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: "ZAR",
    });
  }

  return legs;
}

// ---------------------------------------------------------------------------
// PR-FX-AMD: Trade amendment journals
//
// On TradeAmended:
//   - If field == "rate" or "notional": post the delta in ZAR minor units.
//     A positive delta (new > old) means the carrying amount increased:
//       Dr  FX Trading Receivable ZAR  [deltaZarMinor]
//       Cr  Unrealised FX P&L           [deltaZarMinor]
//     A negative delta (new < old):
//       Dr  Unrealised FX P&L           [|deltaZarMinor|]
//       Cr  FX Trading Receivable ZAR  [|deltaZarMinor|]
//   - If field == "settlement-date" or "counterparty": return empty array
//     (no GL impact).
//
// IFRS authority: IFRS 9 §3.2 (modification not resulting in derecognition
// → adjust carrying amount of the financial instrument).
// ---------------------------------------------------------------------------

export function fxAmendmentJournals(input: FxAmendmentInput): SubLedgerLeg[] {
  // Non-economic amendments: no GL entries.
  if (input.field === "settlement-date" || input.field === "counterparty") {
    return [];
  }

  const delta = input.deltaZarMinor;
  if (delta === 0) return [];

  const absAmount = Math.abs(delta);
  const isIncrease = delta > 0;

  // Increase in carrying amount: Dr RECEIVABLE_ZAR / Cr UNREALISED_PNL
  // Decrease in carrying amount: Dr UNREALISED_PNL  / Cr RECEIVABLE_ZAR
  return [
    {
      accountId: isIncrease ? FX_ACCOUNTS.RECEIVABLE_ZAR : FX_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
    {
      accountId: isIncrease ? FX_ACCOUNTS.UNREALISED_PNL : FX_ACCOUNTS.RECEIVABLE_ZAR,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-INSTRUCT: Settlement-instruction journals
//
// On FxSettlementInstructed (SWIFT MT202 / pacs.009 dispatched to the
// correspondent bank — see CDM schema at markets/cdm/fx.ts:371):
//
//   No GL entries are emitted by this rule.
//
//   Returns: [].
//
// Rationale (intentional no-GL-impact, NOT a substrate gap):
//   - The instruction is a wire-message dispatch event. No cash has moved
//     and no contractual right or obligation has changed. The receivable
//     and payable booked at PR-FX-001 remain in place; settlement-date
//     derecognition occurs only when the correspondent confirms cash
//     movement (PR-FX-003 on FxSettlementConfirmed).
//   - IFRS 9 §3.2.3 derecognition requires that the contractual rights to
//     cash flows have either expired or been transferred such that
//     substantially all risks and rewards have passed. Instructing the
//     correspondent does neither.
//   - IAS 21 §28 attaches any settlement-date FX gain/loss to the
//     settlement event, not the instruction event.
//   - A "suspense at instruction" treatment was considered and rejected:
//     it would introduce a second derecognition timestamp (instruction
//     vs confirmation) with no underlying economic substance, and would
//     proliferate suspense-cleardown postings on every cancelled / failed
//     instruction. The single derecognition at PR-FX-003 is cleaner.
//
// This rule is load-bearing: it declares the GL impact as intentionally
// zero and pairs the event-type with a registered posting-rule code so it
// does not surface in the worked-journal-entries register as
// "missing — substrate gap".
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement default
//   - IFRS 9 §3.2.3 (derecognition criteria)
//   - IAS 21 §28 (settlement-date P&L recognition)
// ---------------------------------------------------------------------------

export function fxSettlementInstructedJournals(
  _event: FxSettlementInstructedPayload,
): SubLedgerLeg[] {
  // Intentional no-GL-impact: instruction-only, no cash moved, no
  // derecognition triggered. See header docblock for full reasoning.
  return [];
}

// ---------------------------------------------------------------------------
// PR-FX-PRIN: Principal-payment journals — GL-significant per-leg cash
//
// On PrincipalPayment (per-leg correspondent confirmation — see CDM schema
// at markets/cdm/fx.ts:464):
//
//   For `legKind === "receive"` (bank receives currency at correspondent):
//     Dr  Nostro [currency]                  |netCash|
//     Cr  FX Trading Receivable [currency]   |netCash|
//
//   For `legKind === "deliver"` (bank pays currency from correspondent):
//     Dr  FX Trading Payable [currency]      |netCash|
//     Cr  Nostro [currency]                  |netCash|
//
//   Each call returns a balanced 2-leg entry in a single currency. Two
//   PrincipalPayment events per Spot trade (one receive, one deliver)
//   therefore post in two different currencies, jointly derecognising
//   the receivable and payable booked at PR-FX-001.
//
// Why this owns the cash GL (not PR-FX-003):
//   - Marc's review of PR #608 surfaced a circularity: PR-FX-003 fires on
//     the accounting `FxSettlementConfirmed` event, but
//     `makeFxSettlementConfirmed(...)` is only called from test code —
//     never from `platform/simulation/post-trade-lifecycle.ts`, scenarios
//     06/07, or any production code path. There is no projection handler
//     that derives the accounting event from the CDM lifecycle. As a
//     result, FX trades were never derecognising their receivable/payable.
//   - CEO decision (2026-05-20, in-session): PR-FX-PRIN becomes the
//     GL-significant rule. Events match reality — cash moved at the
//     correspondent → book the cash leg then. No Principle 1 smell of
//     deriving an event from another event; no missing projection handler.
//   - The accounting `FxSettlementConfirmed` event-type and PR-FX-003
//     are deprecated by this change. See PR-FX-003 docblock for the
//     migration plan and the `@deprecated` tag.
//
// Realised-P&L residual is recognised by PR-FX-LIFECYCLE-CLOSE on the
// CDM `SettlementConfirmed` event, which carries the `realisedPnlDelta`
// in ZAR minor units once both legs have been confirmed.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement
//   - IFRS 9 §3.2.3 (derecognition on transfer of contractual cash flows)
//   - IAS 21 §28 (settlement-date FX gain/loss recognition)
//   - urn:principle:1 — events are reality, not derived from other events
// ---------------------------------------------------------------------------

export function fxPrincipalPaymentJournals(event: PrincipalPaymentPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.netCash);
  if (amount === 0) return [];

  const ccy = event.currency;
  const nostro = nostroAccountFor(ccy);

  if (event.legKind === "receive") {
    // Bank receives currency into nostro; derecognise the FX Trading Receivable.
    return [
      {
        accountId: nostro,
        debitCredit: "debit",
        amountMinor: amount,
        currency: ccy,
      },
      {
        accountId: receivableAccountFor(ccy),
        debitCredit: "credit",
        amountMinor: amount,
        currency: ccy,
      },
    ];
  }

  // legKind === "deliver": bank pays currency from nostro; derecognise the
  // FX Trading Payable.
  return [
    {
      accountId: payableAccountFor(ccy),
      debitCredit: "debit",
      amountMinor: amount,
      currency: ccy,
    },
    {
      accountId: nostro,
      debitCredit: "credit",
      amountMinor: amount,
      currency: ccy,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-LIFECYCLE-CLOSE: CDM settlement-confirmed lifecycle-close journals —
//                        GL-significant realised-P&L residual
//
// On `SettlementConfirmed` (the CDM final-state event — schema at
// markets/cdm/fx.ts:544 — emitted once both `PrincipalPayment` events
// have been recorded):
//
//   If `realisedPnlDelta > 0` (gain — settlement rate above book rate):
//     Dr  Nostro ZAR            realisedPnlDelta
//     Cr  Realised FX P&L       realisedPnlDelta            (ACC-2100-006)
//
//   If `realisedPnlDelta < 0` (loss — settlement rate below book rate):
//     Dr  Realised FX P&L       |realisedPnlDelta|
//     Cr  Nostro ZAR            |realisedPnlDelta|
//
//   If `realisedPnlDelta === 0`: returns `[]` (no posting required).
//
//   The principal cash movements have already been derecognised by the two
//   PR-FX-PRIN postings on the per-leg `PrincipalPayment` events. This rule
//   records the realised-P&L residual — the difference between the
//   carrying amount at the last revaluation and the actual settled cash
//   value — and closes the trade.
//
// Why this owns the realised-P&L residual:
//   - The CDM `SettlementConfirmed` event is the canonical lifecycle-close
//     event emitted by `platform/simulation/post-trade-lifecycle.ts` (and
//     in production by the FX trade lifecycle once both legs confirm).
//     Its payload includes `realisedPnlDelta` (ZAR minor units), which is
//     exactly the residual to be recognised.
//   - PR-FX-PRIN (on PrincipalPayment) cannot recognise the realised P&L
//     because each per-leg event sees only its own currency leg — there
//     is no cross-leg residual computable from a single PrincipalPayment.
//   - The CEO decision of 2026-05-20 retired PR-FX-003 (on accounting
//     `FxSettlementConfirmed`) in favour of this two-tier split: PR-FX-PRIN
//     owns the per-leg cash; PR-FX-LIFECYCLE-CLOSE owns the realised-P&L
//     residual. See PR-FX-PRIN and PR-FX-003 docblocks for rationale.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement
//   - IFRS 9 §3.2.3 (derecognition on transfer of contractual cash flows)
//   - IAS 21 §28 (settlement-date P&L recognition)
//   - urn:principle:1 — events are reality, not derived from other events
// ---------------------------------------------------------------------------

export function fxLifecycleCloseJournals(event: SettlementConfirmedPayload): SubLedgerLeg[] {
  const pnl = event.realisedPnlDelta;
  if (pnl === 0) return [];

  const amount = Math.abs(pnl);
  const isGain = pnl > 0;

  return [
    {
      accountId: isGain ? FX_ACCOUNTS.NOSTRO_ZAR : FX_ACCOUNTS.REALISED_PNL,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: isGain ? FX_ACCOUNTS.REALISED_PNL : FX_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-REGREPORT: Trade-report-submitted journals
//
// On TradeReportSubmitted (SARB FinSurv or DTCC-SAFE dispatch — schema at
// event-store/event-types/regulatory-reporting.ts:36):
//
//   No GL entries are emitted by this rule.
//
//   Returns: [].
//
// Rationale (intentional no-GL-impact, NOT a substrate gap):
//   - `TradeReportSubmitted` records a regulatory dispatch (or its
//     acknowledgement) to SARB FinSurv (per EXCON-SARB-CIRC-3-2020) or to
//     a derivatives trade repository (DTCC-SAFE). It is a reporting-system
//     event: it neither creates nor extinguishes a contractual right or
//     obligation under IFRS 9.
//   - IAS 1 / IAS 8 do not recognise regulatory-dispatch events as
//     accounting transactions. The cost of the regulatory-reporting
//     function is captured as operating expense via the reporting-system
//     run cost; it is not booked per-report.
//   - A `status = "rejected"` outcome may trigger remediation work
//     (re-submission, manual fix-up). That remediation is operationally
//     load-bearing but still does not produce a per-event GL movement;
//     any cost or fine arising is booked via the appropriate operating
//     expense / penalty event-type when it crystallises.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-AD-STATUS — Authorised-Dealer status (Mira)
//   - EXCON-SARB-CIRC-3-2020 — FinSurv reporting obligations
//   - IAS 1 §27 (going-concern recognition basis — reporting dispatch is
//     not a transaction)
// ---------------------------------------------------------------------------

export function fxTradeReportSubmittedJournals(
  _event: TradeReportSubmittedPayload,
): SubLedgerLeg[] {
  // Intentional no-GL-impact: regulator-side dispatch only; no asset,
  // liability, income, or expense recognition is triggered. See header
  // docblock for reasoning.
  return [];
}

// ---------------------------------------------------------------------------
// PR-FX-005: FxSettlementFailed → IFRS-9 default-recognition memo journals
//
// Posts the IFRS-9 §5.5 (Impairment) treatment when a previously instructed
// FX settlement has been reported failed by the correspondent. The
// `FxSettlementFailed` event (event-store/event-types/fx-accounting.ts:454,
// added in PR #638 by Atlas, Markets-substrate engineer) carries a
// three-class `failureKind` taxonomy that maps cleanly onto IFRS-9 ECL
// staging:
//
//   - "one-leg-delivered"  → Herstatt-active. Bank's pay-leg cash has
//     already left the nostro (PR-FX-PRIN deliver leg fired); the
//     counterparty's pay leg (= bank's receive leg) never arrived. The
//     bank is left holding an unrecovered claim against the counterparty
//     equal to the gross receive-leg notional. This is a credit-loss
//     event under IFRS 9 §5.5.1 (default on contractual payment) →
//     Stage 3, lifetime ECL.
//
//   - "neither-delivered"  → mutual fail. Both legs still on the books at
//     PR-FX-001 booking (FVTPL receivable + payable in each currency);
//     no cash has moved. Per IFRS 9 §5.5.1 and the Bank's IFRS 9 ECL
//     Provisioning Policy v1 (see Policies/ifrs9-ecl-provisioning-policy-v1.md
//     §51 — "Out-of-scope instruments: Financial assets measured at FVTPL —
//     ECL is not applied; fair value changes absorb credit risk"), live
//     FVTPL trading instruments do not take an ECL allowance. The Stage-2
//     SICR signal is captured by the upstream `SicrTriggered` event flow
//     (credit-risk-policy-v1 §165), not as a GL movement. PR-FX-005
//     therefore returns `[]` for this branch — the GL is silent and the
//     SICR memo lives in the event log.
//
//   - "operational-delay"  → settlement late but not failed in substance.
//     No default event has occurred; the counterparty's credit profile is
//     unchanged. Stage 1; no GL movement. Returns `[]`.
//
// IFRS-9 reasoning — `one-leg-delivered` branch (Herstatt):
//   Two effects must be booked:
//
//   (a) Reclassify the receive-leg's FX Trading Receivable [receive-ccy]
//       (FVTPL, currently sitting on ACC-2100-001 / -002 from the PR-FX-001
//       booking; not derecognised because PR-FX-PRIN on the receive leg
//       never fired) into the Settlement-Failed Receivable sub-ledger
//       (amortised cost; ACC-2300-001 / -002). The instrument is no
//       longer "held for trading" — the counterparty's failure to deliver
//       is an objective default event; the bank's claim is now a
//       held-to-collect defaulted receivable. Per IFRS 9 §4.4.1, a change
//       in business model warrants reclassification; per IFRS 9 §B4.4.3,
//       a non-recurring event affecting a single instrument can warrant
//       a unit-of-account reclassification in substance. The new
//       sub-ledger brings the instrument in-scope for §5.5 impairment.
//
//       Posting (per receive-leg currency, in the instrument's own
//       currency):
//         Dr  Settlement-Failed Receivable [recv-ccy]   amountMinor
//         Cr  FX Trading Receivable [recv-ccy]           amountMinor
//
//   (b) Recognise Stage-3 lifetime ECL = 100% of the receivable's ZAR-
//       equivalent value (the conservative position: the bank treats a
//       Herstatt-event counterparty as default-certain pending recovery
//       through ISDA §6 close-out or the BCP recovery path — see
//       Procedures/operations/settlement-failure-bcp.md PROC-OPS-SFBCP-01
//       v0.2 step 14). The 100% ECL position is consistent with IFRS 9
//       §5.5.13 (credit-impaired financial asset measured at the present
//       value of expected cash flows; where expected recovery is zero
//       pre-investigation, ECL = gross carrying amount). If recovery is
//       subsequently achieved (counterparty delivers late; ISDA close-out
//       net settlement; cancel-and-rebook with replacement counterparty
//       per step 12), the ECL is reversed via a separate journal — out of
//       scope for this rule.
//
//       Posting (in ZAR functional currency per IAS 21 §23 / IFRS 9 §5.5.17):
//         Dr  Credit Loss Expense — FX Settlement (ACC-2300-004)   zarEqMinor
//         Cr  ECL Allowance — Settlement-Failed (ACC-2300-003)     zarEqMinor
//
//   The pay-leg side requires NO journal under this rule. The pay-leg's
//   PR-FX-PRIN journal already fired at correspondent confirmation:
//     Dr FX Trading Payable [pay-ccy] / Cr Nostro [pay-ccy]
//   That entry is correct and remains correct under a failure scenario:
//   the bank's nostro is empty (cash left); the FX Trading Payable
//   [pay-ccy] is zero (the bank's obligation was discharged by paying).
//   There is no "pay-leg debit" to reclassify out of nostro — that view
//   in the dispatch sketch reflected a pre-PR-#608 mental model where
//   the cash was thought to still be in nostro. Marc (CEO) caught this
//   class of circularity in PR-FX-003 earlier today; the same hygiene
//   applies here. The economic exposure is fully captured by step (a)
//   above: the bank's claim on the counterparty equals the receive-leg
//   it failed to receive.
//
// Idempotency:
//   The function is pure — same input always produces same output. A
//   replay of the `FxSettlementFailed` event will produce the same legs
//   each time; the event store's append-only model + the upstream
//   `bea-gl-posting-engine`'s per-event idempotency guard (keyed on
//   eventId) ensures the legs land in the GL exactly once. The tests
//   below assert pure-function idempotency.
//
// Authority and citations:
//   - IFRS 9 §5.5 (Impairment) — Stage 3 lifetime ECL on credit-impaired
//     assets; §5.5.1 (default trigger); §5.5.13 (measurement of credit-
//     impaired assets); §5.5.17 (forward-looking, probability-weighted).
//   - IFRS 9 §4.1.5 (FVTPL classification of FX trading instruments);
//     §4.4.1 (reclassification on change in business model);
//     §B4.4.3 (unit-of-account reclassification for default events).
//   - IAS 1 §82(ba) (impairment loss presented separately from FVTPL P&L);
//     §54 (separate balance-sheet line for trading vs defaulted receivables).
//   - IAS 21 §23, §28 (functional-currency translation of monetary items
//     and ECL allowance basis).
//   - Bea's existing FX-spot 4-rule pack (PRs #608+#609+#616) — happy-path
//     posting rules this default-flow rule complements:
//       PR-FX-001 (booking), PR-FX-002 (revaluation), PR-FX-PRIN
//       (per-leg cash), PR-FX-LIFECYCLE-CLOSE (realised P&L).
//   - Devon's PROC-OPS-SFBCP-01 v0.2 (PR #636) — settlement-failure BCP
//     procedure that classifies the failure and dispatches the
//     Herstatt-active / mutual-fail / operational-delay branches.
//   - Atlas's FxSettlementFailed event-type pack (PR #638) — the typed
//     event this rule consumes.
//   - Helena (Chief Risk Officer, governance) FX-spot-only market risk
//     scope review (2026-05-20) — confirmed Herstatt failures are
//     market-risk-adjacent but the default-recognition treatment is the
//     IFRS-9 / credit-impairment lane that lands in this rule.
//   - Bank's IFRS 9 ECL Provisioning Policy v1 (Policies/
//     ifrs9-ecl-provisioning-policy-v1.md) §51 (FVTPL out of scope) and
//     the Credit Risk Policy v1 (Policies/credit-risk-policy-v1.md) §166
//     (Stage 3 trigger on default events).
//   - urn:principle:1 — the typed event is reality; this rule is a pure
//     function of the event payload + booking context; balances are queries.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// ---------------------------------------------------------------------------

export function fxSettlementFailedJournals(input: FxSettlementFailedInput): SubLedgerLeg[] {
  const { event, failedReceiveLeg } = input;

  // Branches with no GL impact: see IFRS reasoning in header docblock.
  if (event.failureKind === "neither-delivered") return [];
  if (event.failureKind === "operational-delay") return [];

  // Herstatt-active branch (`one-leg-delivered`).
  if (event.failureKind !== "one-leg-delivered") {
    // Exhaustiveness guard. The `failureKind` enum is checked at the schema
    // boundary; any unknown literal reaching here indicates a schema drift
    // that we should fail loudly on rather than silently no-op.
    throw new Error(
      `fxSettlementFailedJournals: unknown failureKind '${(event as { failureKind: string }).failureKind}'`,
    );
  }

  // Sanity-check the leg-status field: `one-leg-delivered` per the
  // PROC-OPS-SFBCP-01 §2 taxonomy means the bank's pay leg has delivered
  // and the receive leg has not. The schema does not enforce this
  // correlation, so we assert it here — a payload claiming
  // "one-leg-delivered" with both legs delivered (or neither) is a
  // classification bug upstream that we refuse to post against.
  if (!event.legStatus.payLegDelivered || event.legStatus.receiveLegDelivered) {
    throw new Error(
      `fxSettlementFailedJournals: 'one-leg-delivered' requires legStatus.payLegDelivered === true && legStatus.receiveLegDelivered === false; got payLegDelivered=${event.legStatus.payLegDelivered}, receiveLegDelivered=${event.legStatus.receiveLegDelivered}`,
    );
  }

  // The Herstatt-active branch requires booking context — the receive-leg
  // currency / amount / ZAR-equivalent — sourced from the originating
  // FxTradeExecuted (PR-FX-001) by the engine. Without it we cannot post.
  if (!failedReceiveLeg) {
    throw new Error(
      "fxSettlementFailedJournals: 'one-leg-delivered' requires " +
        "input.failedReceiveLeg (currency, amountMinor, zarEquivalentMinor) " +
        "to be supplied by the engine from the originating FxTradeExecuted payload.",
    );
  }

  const { currency, amountMinor, zarEquivalentMinor } = failedReceiveLeg;
  const absAmount = Math.abs(amountMinor);
  const absZar = Math.abs(zarEquivalentMinor);

  const legs: SubLedgerLeg[] = [];

  // (a) Reclassify FVTPL receive-leg receivable → amortised-cost
  //     Settlement-Failed Receivable sub-ledger. Same currency; balanced
  //     within currency.
  if (absAmount > 0) {
    legs.push({
      accountId: settlementFailedReceivableAccountFor(currency),
      debitCredit: "debit",
      amountMinor: absAmount,
      currency,
    });
    legs.push({
      accountId: receivableAccountFor(currency),
      debitCredit: "credit",
      amountMinor: absAmount,
      currency,
    });
  }

  // (b) Recognise Stage-3 lifetime ECL = 100% of receivable's ZAR equivalent.
  //     ZAR functional-currency basis per IAS 21 §23. Balanced within ZAR.
  if (absZar > 0) {
    legs.push({
      accountId: FX_ACCOUNTS.CREDIT_LOSS_EXPENSE_FX,
      debitCredit: "debit",
      amountMinor: absZar,
      currency: "ZAR",
    });
    legs.push({
      accountId: FX_ACCOUNTS.ECL_ALLOWANCE_SETTLEMENT_FAILED,
      debitCredit: "credit",
      amountMinor: absZar,
      currency: "ZAR",
    });
  }

  return legs;
}
