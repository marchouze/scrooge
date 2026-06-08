// platform/accounting/posting-rules/fx-spot.ts
//
// FX Spot posting rules — pure functions mapping FX lifecycle events to
// balanced double-entry GL postings.
//
// Posting rules implemented (per FX Spec §C):
//   PR-FX-001: fxTradeBookingJournals     — FxTradeExecuted (spot booking)
//   PR-FX-002: fxRevaluationJournals      — FxPositionRevalued (daily FVTPL)
//   PR-FX-003: fxSettlementJournals       — TradeMatured (DEPRECATED
//                                            2026-05-20 — superseded by the
//                                            SLA interpreter's per-leg cash +
//                                            realised-P&L lifecycle rules;
//                                            kept for back-compat with legacy
//                                            test-only emitters of the
//                                            accounting `TradeMatured`
//                                            event-type)
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
//   ACC-2100-005  Unrealised FX P&L — FVTPL (ZAR)
//   ACC-2100-006  Realised FX P&L
//   ACC-2100-010..024  Per-currency FX-spot trading accounts
//                 (GBP/EUR/CHF/AUD/JPY: receivable/payable/unrealised-P&L each)
//                 — D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO, 2026-06-05).
//                 Note: provisioned at 010..024 (not the memo's 008..022) to
//                 clear the live ACC-2100-009 FX remediation suspense.
//   ACC-1200-001  Nostro (ZAR correspondent — FX settlement target for ZAR)
//   ACC-1200-002  Nostro (USD correspondent; ACC-1100-002 merged here)
//   ACC-1200-003  Nostro (EUR correspondent; ACC-1100-003 merged here)
//   ACC-1100-004  FX Settlement Suspense (ZAR)
//   ACC-1100-005  FX Settlement Suspense (USD)
//
//   D-COA-CURRENCY-DECOUPLING (2026-05-30): FX settles through the
//   correspondent nostros (1200 range), never through the central-bank reserve
//   account (ACC-1100-001). The USD/EUR 1100 nostros were duplicates and are
//   merged into the 1200 range; FX_ACCOUNTS now points at the 1200 ids.
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
  FxSettlementFailedPayload,
} from "../../event-store/event-types/fx-accounting";
import type { TradeMaturedFxSpotPayload } from "../../event-store/event-types/trade-matured";
import type { FxLeg, FxTradeExecutedPayload } from "../../markets/cdm/fx";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Types for new posting rules
// ---------------------------------------------------------------------------

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
  // Per-currency FX-spot trading accounts (GBP/EUR/CHF/AUD/JPY) — provisioned
  // under D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO-approved by Camille
  // (Chief Financial Officer, finance), 2026-06-05). These five currencies now
  // book to their OWN dedicated trading receivable/payable, replacing the
  // stop-the-bleeding routing to suspense (ACC-2100-007). Suspense remains the
  // last-resort for any FURTHER unprovisioned currency. Mirrors ZAR/USD.
  // (Provisioned at ACC-2100-010..024 — clearing the live, occupied
  // ACC-2100-009 FX remediation suspense; see coa-registry.ts header.)
  RECEIVABLE_GBP: "ACC-2100-010",
  PAYABLE_GBP: "ACC-2100-011",
  UNREALISED_PNL_GBP: "ACC-2100-012",
  RECEIVABLE_EUR: "ACC-2100-013",
  PAYABLE_EUR: "ACC-2100-014",
  UNREALISED_PNL_EUR: "ACC-2100-015",
  RECEIVABLE_CHF: "ACC-2100-016",
  PAYABLE_CHF: "ACC-2100-017",
  UNREALISED_PNL_CHF: "ACC-2100-018",
  RECEIVABLE_AUD: "ACC-2100-019",
  PAYABLE_AUD: "ACC-2100-020",
  UNREALISED_PNL_AUD: "ACC-2100-021",
  RECEIVABLE_JPY: "ACC-2100-022",
  PAYABLE_JPY: "ACC-2100-023",
  UNREALISED_PNL_JPY: "ACC-2100-024",
  // D-COA-CURRENCY-DECOUPLING (2026-05-30): FX settles through the correspondent
  // nostros (1200 range), NOT the central-bank reserve account (ACC-1100-001).
  // The USD/EUR 1100 nostros were duplicates of the 1200 correspondent nostros
  // and have been merged into the 1200 range; these constants now resolve there.
  NOSTRO_ZAR: "ACC-1200-001",
  NOSTRO_USD: "ACC-1200-002",
  NOSTRO_EUR: "ACC-1200-003",
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

// ───────────────────────────────────────────────────────────────────────────
// PER-CURRENCY FX-ACCOUNT RESOLUTION (live legacy posting path).
//
// History (two CEO/CFO decisions on the same live path):
//   1. STOP-THE-BLEEDING (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE, 2026-06-05):
//      the original `default → USD slot` fallbacks SILENTLY mis-booked any
//      non-ZAR/USD foreign currency into the USD trading accounts
//      (ACC-2100-002/004) — the Principle-5 blocker behind the 66 mis-booked
//      simulated trades. That silent USD fallback was REPLACED by
//      suspense-on-miss (ACC-2100-007) + a loud urgent-correction alert.
//   2. PER-CURRENCY PROVISIONING (D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING,
//      CFO-approved by Camille (Chief Financial Officer, finance), 2026-06-05):
//      the five actively-traded currencies GBP/EUR/CHF/AUD/JPY now have their
//      OWN dedicated trading accounts (ACC-2100-010..024). The helpers below
//      resolve those five to their proper per-currency accounts — NO LONGER to
//      suspense. This is a LIVE GL BEHAVIOUR IMPROVEMENT: these currencies move
//      from the transient suspense holding-pen to their permanent accounting
//      home (and, byte-for-byte, agree with the corrected SLA interpreter,
//      whose resolver carries the same per-currency rows).
//
// Suspense (ACC-2100-007) REMAINS the last-resort for any FURTHER currency that
// has no dedicated account (e.g. SGD/NOK): such a leg still routes to suspense
// and the engine raises a high-severity urgent-correction `SubstrateAlert` (see
// `detectUnresolvedCurrencyLegs` + the engine wiring). The USD account stays
// USD-ONLY; ZAR/USD resolve EXACTLY as before — byte-for-byte parity for those
// two currencies is untouched.
// ───────────────────────────────────────────────────────────────────────────

/** FX unresolved-currency suspense (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). */
export const FX_UNRESOLVED_CURRENCY_SUSPENSE = "ACC-2100-007";

/** Map a currency code to the FX Trading Receivable account ID (per-currency).
 *  ZAR/USD/GBP/EUR/CHF/AUD/JPY have dedicated accounts; any OTHER currency →
 *  balancing FX unresolved-currency suspense (NEVER the USD slot — the USD
 *  account is USD-only). The caller raises a high-severity urgent-correction
 *  alert (detectUnresolvedCurrencyLegs).
 *  Authority: D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING. */
function receivableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.RECEIVABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.RECEIVABLE_USD;
    case "GBP":
      return FX_ACCOUNTS.RECEIVABLE_GBP;
    case "EUR":
      return FX_ACCOUNTS.RECEIVABLE_EUR;
    case "CHF":
      return FX_ACCOUNTS.RECEIVABLE_CHF;
    case "AUD":
      return FX_ACCOUNTS.RECEIVABLE_AUD;
    case "JPY":
      return FX_ACCOUNTS.RECEIVABLE_JPY;
    default:
      // No dedicated account → balancing FX unresolved-currency suspense.
      return FX_UNRESOLVED_CURRENCY_SUSPENSE;
  }
}

/** Map a currency code to the FX Trading Payable account ID (per-currency).
 *  ZAR/USD/GBP/EUR/CHF/AUD/JPY have dedicated accounts; any OTHER currency →
 *  balancing suspense (NOT the USD slot).
 *  Authority: D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING. */
function payableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.PAYABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.PAYABLE_USD;
    case "GBP":
      return FX_ACCOUNTS.PAYABLE_GBP;
    case "EUR":
      return FX_ACCOUNTS.PAYABLE_EUR;
    case "CHF":
      return FX_ACCOUNTS.PAYABLE_CHF;
    case "AUD":
      return FX_ACCOUNTS.PAYABLE_AUD;
    case "JPY":
      return FX_ACCOUNTS.PAYABLE_JPY;
    default:
      // No dedicated account → balancing suspense (NOT the USD slot).
      return FX_UNRESOLVED_CURRENCY_SUSPENSE;
  }
}

/**
 * Map a currency code to the Settlement-Failed Receivable account ID
 * (PR-FX-005). Used when a defaulted receive-leg is reclassified from the
 * FVTPL trading receivable to the amortised-cost defaulted-claim sub-ledger.
 * Per-currency; non-ZAR/USD → suspense (never the USD slot).
 *
 * SUBSTRATE GAP: the D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING 15-account
 * block covers the FX TRADING accounts only, NOT the amortised-cost
 * Settlement-Failed Receivable sub-ledger (ACC-2300), which exists for ZAR/USD
 * only. A GBP/EUR/CHF/AUD/JPY Herstatt failure therefore still reclassifies its
 * defaulted receivable to suspense + alert until a per-currency
 * settlement-failed account is provisioned (follow-on CFO call).
 */
function settlementFailedReceivableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_USD;
    default:
      return FX_UNRESOLVED_CURRENCY_SUSPENSE;
  }
}

/**
 * Detect legs that were routed to the FX unresolved-currency suspense account
 * (i.e. a non-ZAR/USD currency with no dedicated account). The live engines
 * call this on the legs returned by the posting-rule functions and raise ONE
 * high-severity urgent-correction `SubstrateAlert` per distinct unresolved
 * currency — so suspense routing is NEVER silent. Returns the distinct
 * unresolved currencies found (empty when every leg resolved exactly).
 */
export function detectUnresolvedCurrencyLegs(legs: ReadonlyArray<SubLedgerLeg>): string[] {
  const unresolved = new Set<string>();
  for (const leg of legs) {
    if (leg.accountId === FX_UNRESOLVED_CURRENCY_SUSPENSE) unresolved.add(leg.currency);
  }
  return [...unresolved];
}

/** Map a currency code to the Nostro (correspondent settlement) account ID
 *  (per-currency). ZAR/USD/EUR have dedicated correspondent nostros
 *  (ACC-1200-001/002/003); any other currency → balancing suspense (NOT the USD
 *  nostro). Same per-currency discipline as the trading-account helpers
 *  (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
 *
 *  SUBSTRATE GAP (flagged under D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING):
 *  the CFO's 15-account provisioning covers the FX TRADING
 *  receivable/payable/unrealised-P&L accounts for GBP/EUR/CHF/AUD/JPY but NOT
 *  the correspondent-nostro (ACC-1200) settlement accounts. So a GBP/CHF/AUD/JPY
 *  trade's TRADING legs now book to dedicated accounts (ACC-2100-010..024),
 *  while its principal-payment (PR-FX-PRIN) NOSTRO leg still routes to suspense
 *  until a correspondent nostro is provisioned for that currency. EUR already
 *  has ACC-1200-003. The corrected SLA resolver agrees (its `fx.nostro` rows
 *  cover only ZAR/USD/EUR), so legacy and interpreter stay in lock-step.
 *  Provisioning GBP/CHF/AUD/JPY nostros is a follow-on CFO/treasury call. */
export function nostroAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.NOSTRO_ZAR;
    case "USD":
      return FX_ACCOUNTS.NOSTRO_USD;
    case "EUR":
      return FX_ACCOUNTS.NOSTRO_EUR;
    default:
      return FX_UNRESOLVED_CURRENCY_SUSPENSE;
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
// @deprecated The SLA interpreter's FX lifecycle rules (per-leg cash on
//   PrincipalPayment + realised-P&L residual on SettlementConfirmed; see
//   `platform/accounting/sla/rules/pr-fx-*` and the interpreter-side suites
//   `tests/sla-fx-lifecycle-interpreter.test.ts`) carry the live settlement
//   accounting. The accounting `TradeMatured` event-type is also deprecated:
//   production paths never emitted it (only test code constructed it), so
//   PR-FX-003 was an unreachable code path. The CEO decision of 2026-05-20
//   split its responsibilities across the two CDM lifecycle events that ARE
//   emitted by `post-trade-lifecycle.ts` and scenarios 06/07.
//
// This function is kept for backwards compatibility with the rare callers
// that still construct `TradeMatured` payloads in tests for purposes other
// than FX accounting (e.g. `ba-110-lcr.test.ts` settled-trade detection).
// New authoring must NOT add new emitters of `TradeMatured`.
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

/** @deprecated 2026-05-20 — live settlement accounting now lives in the SLA interpreter's FX lifecycle rules (`platform/accounting/sla/rules/pr-fx-*`). */
export function fxSettlementJournals(event: TradeMaturedFxSpotPayload): SubLedgerLeg[] {
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
