// platform/accounting/posting-rules/equities.ts
//
// JSE equity lifecycle posting rules.
//
// Subscribes to:
//   CDM events (from platform/markets/cdm/equity.ts):
//     EquityTradeExecuted   → PR-EQ-001 (initial recognition at cost)
//     EquityPositionRevalued → PR-EQ-002 (FVTPL P&L revaluation)
//
//   GL-specific events (from platform/event-store/event-types/equity-accounting.ts):
//     EquityDividendAccrued  → PR-EQ-003 (dividend income + WHT)
//     EquitySold             → PR-EQ-004 (derecognition; FVTPL or FVOCI/§5.7.5)
//
// All functions return SubLedgerLeg[] for use by the GL posting engine.
// Each returned array is balanced (debits = credits per currency).
// Zero-amount events return [] (no posting needed).
//
// Chart-of-accounts references:
//   ACC-3200-001  Equity Asset — FVTPL         (asset, debit normal)
//   ACC-3200-002  Equity Asset — FVOCI          (asset, debit normal)
//   ACC-3200-003  Unrealised P&L — Equities (FVTPL) (income, credit normal)
//   ACC-3200-004  OCI Reserve — Equities (FVOCI) (equity, credit normal)
//   ACC-3200-005  Dividend Receivable            (asset, debit normal)
//   ACC-3200-006  Dividend Income                (income, credit normal)
//   ACC-3200-007  Withholding Tax Payable — Dividends (liability, credit normal)
//   ACC-1200-001  Nostro (ZAR correspondent; settlement cash, D-COA-CURRENCY-DECOUPLING) (asset, debit normal)
//   ACC-5000-002  Retained Earnings              (equity, credit normal)
//
// IFRS 9 references:
//   §3.2.3   Derecognition of financial assets
//   §4.1.2A  FVOCI irrevocable election for equity instruments
//   §4.1.4   FVTPL classification (residual)
//   §5.7.1   FVTPL gains/losses through P&L
//   §5.7.1A  Dividends to P&L (even for FVOCI instruments)
//   §5.7.5   FVOCI: no recycling of cumulative OCI to P&L on derecognition
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import type {
  EquityDividendAccruedPayload,
  EquitySoldPayload,
} from "../../event-store/event-types/equity-accounting";
import type {
  EquityPositionRevaluedPayload,
  EquityTradeExecutedPayload,
} from "../../markets/cdm/equity";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Account ID constants
// ---------------------------------------------------------------------------

const EQUITY_ACCOUNTS = {
  EQUITY_ASSET_FVTPL: "ACC-3200-001",
  EQUITY_ASSET_FVOCI: "ACC-3200-002",
  UNREALISED_PNL_FVTPL: "ACC-3200-003",
  OCI_RESERVE_FVOCI: "ACC-3200-004",
  DIVIDEND_RECEIVABLE: "ACC-3200-005",
  DIVIDEND_INCOME: "ACC-3200-006",
  WITHHOLDING_TAX_PAYABLE: "ACC-3200-007",
  NOSTRO_ZAR: "ACC-1200-001",
  RETAINED_EARNINGS: "ACC-5000-002",
} as const;

// ---------------------------------------------------------------------------
// PR-EQ-001: Initial recognition — IFRS 9 §3.1.1, §5.1.1
//
// CDM EquityTradeExecuted carries `consideration: Money` (amortised cost).
// All CDM equity trades are FVTPL (trading-book). FVOCI irrevocable election
// (§4.1.2A) requires a separate EquitySold/revaluation path — not exercised
// in the CDM scaffold.
//
// Dr Equity Asset (FVTPL)  / Cr Nostro ZAR — at consideration (minor units)
// ---------------------------------------------------------------------------

export function equityTradeBookingJournals(event: EquityTradeExecutedPayload): SubLedgerLeg[] {
  const amount = event.consideration.amountMinor;
  const currency = event.consideration.currency;
  return [
    {
      accountId: EQUITY_ACCOUNTS.EQUITY_ASSET_FVTPL,
      debitCredit: "debit" as const,
      amountMinor: amount,
      currency,
    },
    {
      accountId: EQUITY_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit" as const,
      amountMinor: amount,
      currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-EQ-002: FVTPL revaluation — IFRS 9 §5.7.1
//
// CDM EquityPositionRevalued carries `unrealisedPnl: Money`.
// Positive = gain; negative = loss.
//
// Gain: Dr Equity Asset (FVTPL) / Cr Unrealised P&L (FVTPL)
// Loss: Dr Unrealised P&L (FVTPL) / Cr Equity Asset (FVTPL)
// Zero: [] (no posting)
// ---------------------------------------------------------------------------

export function equityRevaluationJournals(event: EquityPositionRevaluedPayload): SubLedgerLeg[] {
  const delta = event.unrealisedPnl.amountMinor;
  const currency = event.unrealisedPnl.currency;
  if (delta === 0) return [];

  const amount = Math.abs(delta);
  const isGain = delta > 0;

  return isGain
    ? [
        {
          accountId: EQUITY_ACCOUNTS.EQUITY_ASSET_FVTPL,
          debitCredit: "debit" as const,
          amountMinor: amount,
          currency,
        },
        {
          accountId: EQUITY_ACCOUNTS.UNREALISED_PNL_FVTPL,
          debitCredit: "credit" as const,
          amountMinor: amount,
          currency,
        },
      ]
    : [
        {
          accountId: EQUITY_ACCOUNTS.UNREALISED_PNL_FVTPL,
          debitCredit: "debit" as const,
          amountMinor: amount,
          currency,
        },
        {
          accountId: EQUITY_ACCOUNTS.EQUITY_ASSET_FVTPL,
          debitCredit: "credit" as const,
          amountMinor: amount,
          currency,
        },
      ];
}

// ---------------------------------------------------------------------------
// PR-EQ-003: Dividend accrual — IFRS 9 §5.7.1A; IAS 32 §35
//
// Gross dividend:
//   With WHT:
//     Dr Dividend Receivable (net)     netDividendMinor
//     Dr WHT Payable (tax debit)       withholdingTaxMinor
//     Cr Dividend Income (gross)       grossDividendTotalMinor
//   Without WHT:
//     Dr Dividend Receivable (gross)   grossDividendTotalMinor
//     Cr Dividend Income (gross)       grossDividendTotalMinor
//
// Zero gross dividend → [] (no posting).
// ---------------------------------------------------------------------------

export function equityDividendJournals(event: EquityDividendAccruedPayload): SubLedgerLeg[] {
  if (event.grossDividendTotalMinor === 0) return [];

  if (event.withholdingTaxMinor > 0) {
    return [
      {
        accountId: EQUITY_ACCOUNTS.DIVIDEND_RECEIVABLE,
        debitCredit: "debit" as const,
        amountMinor: event.netDividendMinor,
        currency: event.currency,
      },
      {
        accountId: EQUITY_ACCOUNTS.WITHHOLDING_TAX_PAYABLE,
        debitCredit: "debit" as const,
        amountMinor: event.withholdingTaxMinor,
        currency: event.currency,
      },
      {
        accountId: EQUITY_ACCOUNTS.DIVIDEND_INCOME,
        debitCredit: "credit" as const,
        amountMinor: event.grossDividendTotalMinor,
        currency: event.currency,
      },
    ];
  }

  return [
    {
      accountId: EQUITY_ACCOUNTS.DIVIDEND_RECEIVABLE,
      debitCredit: "debit" as const,
      amountMinor: event.netDividendMinor,
      currency: event.currency,
    },
    {
      accountId: EQUITY_ACCOUNTS.DIVIDEND_INCOME,
      debitCredit: "credit" as const,
      amountMinor: event.grossDividendTotalMinor,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-EQ-004: Sale / derecognition — IFRS 9 §3.2.3
//
// FVTPL sale:
//   Dr Nostro ZAR (proceeds)        saleProceedsMinor
//   Cr Equity Asset (FVTPL)          carryingAmountAtSaleMinor
//   + residual P&L:
//     Gain: Cr Unrealised P&L (FVTPL)  |realisedPnlMinor|
//     Loss: Dr Unrealised P&L (FVTPL)  |realisedPnlMinor|
//     Break-even: 2 legs only
//
// FVOCI sale (§5.7.5 — no recycling to P&L):
//   Dr Nostro ZAR (proceeds)        saleProceedsMinor
//   Cr Equity Asset (FVOCI)          carryingAmountAtSaleMinor
//   + Recognise the realised fair-value gain/loss (proceeds − carrying) in OCI
//     — NOT P&L (§5.7.5). This is the leg that BALANCES the cash-vs-carrying
//     difference. (`realisedPnlMinor` carries proceeds − carrying.)
//     Gain: Cr OCI Reserve (FVOCI)  |realisedPnlMinor|
//     Loss: Dr OCI Reserve (FVOCI)  |realisedPnlMinor|
//   + Reclassify the cumulative OCI to retained earnings (within equity — NOT
//     P&L), leaving net OCI movement zero on the reserve for this disposal:
//     Gain: Dr OCI Reserve (FVOCI) |realisedPnlMinor| / Cr Retained Earnings
//     Loss: Cr OCI Reserve (FVOCI) |realisedPnlMinor| / Dr Retained Earnings
//
// CORRECTNESS FIX (D-SLA-ENGINE-RULES-AS-DATA Batch 2, Bea 2026-06-05): the
// prior FVOCI implementation OMITTED the realised fair-value OCI leg, leaving the
// entry unbalanced by (proceeds − carrying) whenever proceeds ≠ carrying. The
// SLA interpreter's `assert_zero` invariant surfaced it (the parity guard
// rejected the unbalanced legacy output). The fix adds the missing OCI leg so the
// double-entry balances; FVOCI equity sale is not yet wired to any production
// emitter, so no booked journal is affected. The rules-as-data PR-EQ-004 and this
// reference function are now byte-for-byte identical AND balanced.
// ---------------------------------------------------------------------------

export function equitySaleJournals(event: EquitySoldPayload): SubLedgerLeg[] {
  const proceeds = event.saleProceedsMinor;
  const carrying = event.carryingAmountAtSaleMinor;
  const pnl = event.realisedPnlMinor;

  if (event.classification === "fvtpl") {
    const legs: SubLedgerLeg[] = [
      {
        accountId: EQUITY_ACCOUNTS.NOSTRO_ZAR,
        debitCredit: "debit" as const,
        amountMinor: proceeds,
        currency: event.currency,
      },
      {
        accountId: EQUITY_ACCOUNTS.EQUITY_ASSET_FVTPL,
        debitCredit: "credit" as const,
        amountMinor: carrying,
        currency: event.currency,
      },
    ];

    if (pnl > 0) {
      legs.push({
        accountId: EQUITY_ACCOUNTS.UNREALISED_PNL_FVTPL,
        debitCredit: "credit" as const,
        amountMinor: pnl,
        currency: event.currency,
      });
    } else if (pnl < 0) {
      legs.push({
        accountId: EQUITY_ACCOUNTS.UNREALISED_PNL_FVTPL,
        debitCredit: "debit" as const,
        amountMinor: Math.abs(pnl),
        currency: event.currency,
      });
    }

    return legs;
  }

  // FVOCI sale — no recycling to P&L (§5.7.5)
  const legs: SubLedgerLeg[] = [
    {
      accountId: EQUITY_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "debit" as const,
      amountMinor: proceeds,
      currency: event.currency,
    },
    {
      accountId: EQUITY_ACCOUNTS.EQUITY_ASSET_FVOCI,
      debitCredit: "credit" as const,
      amountMinor: carrying,
      currency: event.currency,
    },
  ];

  // Leg that BALANCES the cash-vs-carrying difference: the realised fair-value
  // movement on derecognition is recognised in OCI (§5.7.5 — NOT P&L). A gain
  // (proceeds > carrying) credits the OCI reserve; a loss debits it. When
  // proceeds == carrying this leg is zero and omitted.
  const fairValueDelta = proceeds - carrying;
  if (fairValueDelta > 0) {
    legs.push({
      accountId: EQUITY_ACCOUNTS.OCI_RESERVE_FVOCI,
      debitCredit: "credit" as const,
      amountMinor: fairValueDelta,
      currency: event.currency,
    });
  } else if (fairValueDelta < 0) {
    legs.push({
      accountId: EQUITY_ACCOUNTS.OCI_RESERVE_FVOCI,
      debitCredit: "debit" as const,
      amountMinor: Math.abs(fairValueDelta),
      currency: event.currency,
    });
  }

  // Reclassify the cumulative OCI reserve to retained earnings WITHIN equity
  // (NOT P&L). This pair is self-balancing; `realisedPnlMinor` carries the
  // cumulative OCI balance being reclassified. Omitted when zero.
  if (pnl > 0) {
    legs.push(
      {
        accountId: EQUITY_ACCOUNTS.OCI_RESERVE_FVOCI,
        debitCredit: "debit" as const,
        amountMinor: pnl,
        currency: event.currency,
      },
      {
        accountId: EQUITY_ACCOUNTS.RETAINED_EARNINGS,
        debitCredit: "credit" as const,
        amountMinor: pnl,
        currency: event.currency,
      },
    );
  } else if (pnl < 0) {
    const absLoss = Math.abs(pnl);
    legs.push(
      {
        accountId: EQUITY_ACCOUNTS.RETAINED_EARNINGS,
        debitCredit: "debit" as const,
        amountMinor: absLoss,
        currency: event.currency,
      },
      {
        accountId: EQUITY_ACCOUNTS.OCI_RESERVE_FVOCI,
        debitCredit: "credit" as const,
        amountMinor: absLoss,
        currency: event.currency,
      },
    );
  }

  return legs;
}
