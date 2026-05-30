// platform/accounting/posting-rules/ird-swaps.ts
//
// OTC IRD swap lifecycle posting rules.
//
// Events handled:
//   IrdSwapTradeExecuted   → PR-IRS-001 (initial recognition — at-market or off-market)
//   IrdSwapPositionRevalued → PR-IRS-002 (FVTPL NPV re-measurement)
//   IrdSwapCouponSettled   → PR-IRS-003 (net coupon cash settlement)
//   IrdSwapTerminated      → PR-IRS-TERM (derecognition on termination)
//
// All functions return SubLedgerLeg[] for use by the GL posting engine.
// Each returned array is balanced (debits = credits per currency).
// Zero-amount events return [] (no posting needed).
//
// Chart-of-accounts references:
//   ACC-3300-001  Swap Asset — FVTPL (Positive NPV) (asset, debit normal)
//   ACC-3300-002  Swap Liability — FVTPL (Negative NPV) (liability, credit normal)
//   ACC-3300-003  Unrealised P&L — IRD (FVTPL) (income, credit normal)
//   ACC-1200-001  Nostro (ZAR correspondent; settlement cash, D-COA-CURRENCY-DECOUPLING) (asset, debit normal)
//
// IFRS 9 references:
//   §3.2.3   Derecognition of financial assets
//   §4.1.4   FVTPL classification (OTC swaps fail SPPI; always FVTPL)
//   §5.7.1   FVTPL gains/losses through P&L
//
// NPV sign convention:
//   npv > 0  → bank holds net asset (swap has positive value to the bank)
//   npv < 0  → bank holds net liability (swap has negative value to the bank)
//   npv = 0  → at-market (no balance-sheet entry required)
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import type {
  IrdSwapCouponSettledPayload,
  IrdSwapPositionRevaluedPayload,
  IrdSwapTerminatedPayload,
  IrdSwapTradeExecutedPayload,
} from "../../event-store/event-types/ird-accounting";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Account ID constants
// ---------------------------------------------------------------------------

const IRD_ACCOUNTS = {
  SWAP_ASSET_FVTPL: "ACC-3300-001",
  SWAP_LIABILITY_FVTPL: "ACC-3300-002",
  UNREALISED_PNL_IRD: "ACC-3300-003",
  NOSTRO_ZAR: "ACC-1200-001",
} as const;

// ---------------------------------------------------------------------------
// PR-IRS-001: Initial recognition — IFRS 9 §4.1.4, §5.7.1
//
// OTC swaps are FVTPL instruments (SPPI test fails for floating legs).
// At-market swap: npvMinor = 0 → no balance-sheet entry → [] (no posting).
// Off-market swap with positive initial NPV (bank received a credit):
//   Dr Swap Asset / Cr Unrealised P&L (FVTPL)
// Off-market swap with negative initial NPV (bank paid a credit):
//   Dr Unrealised P&L (FVTPL) / Cr Swap Liability
// ---------------------------------------------------------------------------

export function irdSwapTradeBookingJournals(event: IrdSwapTradeExecutedPayload): SubLedgerLeg[] {
  const npv = event.npvMinor;
  if (npv === 0) return [];

  const amount = Math.abs(npv);

  if (npv > 0) {
    // Positive NPV → asset side
    return [
      {
        accountId: IRD_ACCOUNTS.SWAP_ASSET_FVTPL,
        debitCredit: "debit" as const,
        amountMinor: amount,
        currency: event.currency,
      },
      {
        accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
        debitCredit: "credit" as const,
        amountMinor: amount,
        currency: event.currency,
      },
    ];
  }

  // Negative NPV → liability side
  return [
    {
      accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
      debitCredit: "debit" as const,
      amountMinor: amount,
      currency: event.currency,
    },
    {
      accountId: IRD_ACCOUNTS.SWAP_LIABILITY_FVTPL,
      debitCredit: "credit" as const,
      amountMinor: amount,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-IRS-002: FVTPL NPV re-measurement — IFRS 9 §5.7.1
//
// npvDeltaMinor: signed change in NPV for the period.
// npvOpeningMinor / npvClosingMinor: used to handle asset↔liability sign flips.
//
// Simple cases (no sign flip):
//   Gain (+delta, position stays asset or moves further positive):
//     Dr Swap Asset (FVTPL) / Cr Unrealised P&L (FVTPL)
//   Loss (-delta, position stays liability or moves further negative):
//     Dr Unrealised P&L (FVTPL) / Cr Swap Liability (FVTPL)
//
// Sign-flip cases (asset→liability or liability→asset):
//   Asset→Liability (opening > 0, closing < 0):
//     Dr Unrealised P&L (for total opening asset, i.e. npvOpeningMinor) / Cr Swap Asset
//     Dr Unrealised P&L (for remaining liability, i.e. |npvClosingMinor|) / Cr Swap Liability
//     (net: Cr P&L = npvDeltaMinor in absolute terms)
//   Liability→Asset (opening < 0, closing > 0):
//     Dr Swap Liability (for total opening liability, i.e. |npvOpeningMinor|) / Cr Unrealised P&L
//     Dr Swap Asset (for new asset value, i.e. npvClosingMinor) / Cr Unrealised P&L
//
// Zero delta: [] (no posting)
// ---------------------------------------------------------------------------

export function irdSwapRevaluationJournals(event: IrdSwapPositionRevaluedPayload): SubLedgerLeg[] {
  const delta = event.npvDeltaMinor;
  if (delta === 0) return [];

  const opening = event.npvOpeningMinor;
  const closing = event.npvClosingMinor;
  const currency = event.currency;

  // Detect sign flip
  const signFlipToLiability = opening > 0 && closing < 0;
  const signFlipToAsset = opening < 0 && closing > 0;

  if (signFlipToLiability) {
    // Close the asset (opening amount), open the liability (closing amount)
    const openingAsset = Math.abs(opening);
    const newLiability = Math.abs(closing);
    return [
      {
        accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
        debitCredit: "debit" as const,
        amountMinor: openingAsset + newLiability,
        currency,
      },
      {
        accountId: IRD_ACCOUNTS.SWAP_ASSET_FVTPL,
        debitCredit: "credit" as const,
        amountMinor: openingAsset,
        currency,
      },
      {
        accountId: IRD_ACCOUNTS.SWAP_LIABILITY_FVTPL,
        debitCredit: "credit" as const,
        amountMinor: newLiability,
        currency,
      },
    ];
  }

  if (signFlipToAsset) {
    // Close the liability (opening amount), open the asset (closing amount)
    const openingLiability = Math.abs(opening);
    const newAsset = Math.abs(closing);
    return [
      {
        accountId: IRD_ACCOUNTS.SWAP_LIABILITY_FVTPL,
        debitCredit: "debit" as const,
        amountMinor: openingLiability,
        currency,
      },
      {
        accountId: IRD_ACCOUNTS.SWAP_ASSET_FVTPL,
        debitCredit: "debit" as const,
        amountMinor: newAsset,
        currency,
      },
      {
        accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
        debitCredit: "credit" as const,
        amountMinor: openingLiability + newAsset,
        currency,
      },
    ];
  }

  // No sign flip — simple gain or loss
  const amount = Math.abs(delta);
  const isGain = delta > 0;

  if (isGain) {
    return [
      {
        accountId: IRD_ACCOUNTS.SWAP_ASSET_FVTPL,
        debitCredit: "debit" as const,
        amountMinor: amount,
        currency,
      },
      {
        accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
        debitCredit: "credit" as const,
        amountMinor: amount,
        currency,
      },
    ];
  }

  return [
    {
      accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
      debitCredit: "debit" as const,
      amountMinor: amount,
      currency,
    },
    {
      accountId: IRD_ACCOUNTS.SWAP_LIABILITY_FVTPL,
      debitCredit: "credit" as const,
      amountMinor: amount,
      currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-IRS-003: Net coupon cash settlement
//
// On each payment date, the fixed and floating legs are netted.
// netCashMinor > 0 → bank receives net cash (fixed receiver / float payer wins)
//   Dr Nostro ZAR / Cr Swap Asset (FVTPL) — cash in, NPV carrying ↓
// netCashMinor < 0 → bank pays net cash
//   Dr Swap Liability (FVTPL) / Cr Nostro ZAR — cash out, NPV carrying ↓
// netCashMinor = 0 → no posting (rare: equal legs net to zero)
// ---------------------------------------------------------------------------

export function irdSwapCouponJournals(event: IrdSwapCouponSettledPayload): SubLedgerLeg[] {
  const net = event.netCashMinor;
  if (net === 0) return [];

  const amount = Math.abs(net);

  if (net > 0) {
    // Bank receives cash
    return [
      {
        accountId: IRD_ACCOUNTS.NOSTRO_ZAR,
        debitCredit: "debit" as const,
        amountMinor: amount,
        currency: event.currency,
      },
      {
        accountId: IRD_ACCOUNTS.SWAP_ASSET_FVTPL,
        debitCredit: "credit" as const,
        amountMinor: amount,
        currency: event.currency,
      },
    ];
  }

  // Bank pays cash
  return [
    {
      accountId: IRD_ACCOUNTS.SWAP_LIABILITY_FVTPL,
      debitCredit: "debit" as const,
      amountMinor: amount,
      currency: event.currency,
    },
    {
      accountId: IRD_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit" as const,
      amountMinor: amount,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-IRS-TERM: Termination / derecognition — IFRS 9 §3.2.3
//
// The swap is closed out. Two steps:
//
// 1. Cash settlement of termination payment:
//    terminationPaymentMinor > 0 (bank receives):
//      Dr Nostro ZAR / Cr Swap Asset (carrying NPV)
//    terminationPaymentMinor < 0 (bank pays):
//      Dr Swap Liability (carrying NPV) / Cr Nostro ZAR
//    terminationPaymentMinor = 0 (no cash, e.g. matured at zero):
//      Dr Swap Asset (carrying NPV) / Cr Unrealised P&L — or reverse if liability
//
// 2. Realised P&L residual:
//    realisedPnlMinor > 0 → Cr Unrealised P&L (FVTPL) — gain
//    realisedPnlMinor < 0 → Dr Unrealised P&L (FVTPL) — loss
//    realisedPnlMinor = 0 → no P&L leg
//
// The carrying NPV may be an asset (> 0), liability (< 0), or zero.
// ---------------------------------------------------------------------------

export function irdSwapTerminationJournals(event: IrdSwapTerminatedPayload): SubLedgerLeg[] {
  const termPayment = event.terminationPaymentMinor;
  const carryingNpv = event.carryingNpvAtTerminationMinor;
  const pnl = event.realisedPnlMinor;
  const currency = event.currency;
  const legs: SubLedgerLeg[] = [];

  if (termPayment === 0 && carryingNpv === 0) {
    // Nothing to settle; swap matured at zero NPV
    return [];
  }

  if (termPayment > 0) {
    // Bank receives cash
    legs.push({
      accountId: IRD_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "debit" as const,
      amountMinor: termPayment,
      currency,
    });
  } else if (termPayment < 0) {
    // Bank pays cash
    legs.push({
      accountId: IRD_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit" as const,
      amountMinor: Math.abs(termPayment),
      currency,
    });
  }

  // Derecognise the carrying NPV from the balance sheet
  if (carryingNpv > 0) {
    // Was an asset — credit the asset to remove it
    legs.push({
      accountId: IRD_ACCOUNTS.SWAP_ASSET_FVTPL,
      debitCredit: "credit" as const,
      amountMinor: carryingNpv,
      currency,
    });
  } else if (carryingNpv < 0) {
    // Was a liability — debit the liability to remove it
    legs.push({
      accountId: IRD_ACCOUNTS.SWAP_LIABILITY_FVTPL,
      debitCredit: "debit" as const,
      amountMinor: Math.abs(carryingNpv),
      currency,
    });
  }

  // Realised P&L balancing leg
  if (pnl > 0) {
    legs.push({
      accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
      debitCredit: "credit" as const,
      amountMinor: pnl,
      currency,
    });
  } else if (pnl < 0) {
    legs.push({
      accountId: IRD_ACCOUNTS.UNREALISED_PNL_IRD,
      debitCredit: "debit" as const,
      amountMinor: Math.abs(pnl),
      currency,
    });
  }

  return legs;
}
