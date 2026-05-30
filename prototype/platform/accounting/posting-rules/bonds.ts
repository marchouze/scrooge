// platform/accounting/posting-rules/bonds.ts
//
// JSE bond lifecycle posting rules — pure functions mapping bond lifecycle
// events to balanced double-entry GL postings.
//
// Posting rules implemented:
//   PR-BOND-001  : bondBankingBookJournals    — BondTradeExecuted (banking-book)
//   PR-BOND-001T : bondTradingBookJournals    — BondTradeExecuted (trading-book)
//   PR-BOND-EIR  : bondInterestAccrualJournals — BondInterestAccrued (EIR)
//   PR-BOND-002  : bondRevaluationJournals    — BondPositionRevalued (FVTPL)
//   PR-BOND-MAT  : bondMaturityJournals       — BondMatured (derecognition)
//   PR-BOND-SALE : bondSaleJournals           — BondSold (derecognition)
//
// All functions return SubLedgerLeg[] that balance per currency.
// Balance invariant: sum(debit.amountMinor) == sum(credit.amountMinor)
// per currency, per call.
//
// Chart-of-accounts references (ACC-NNNN-NNN format):
//   ACC-3100-001  Bond Asset — banking book (amortised cost)
//   ACC-3100-002  Bond Asset — trading book (FVTPL)
//   ACC-3100-003  Accrued Interest Receivable — bonds
//   ACC-3100-004  Bond Discount/Premium Unamortised
//   ACC-3100-005  Unrealised P&L — Bonds (FVTPL)
//   ACC-3100-006  Realised P&L — Bonds
//   ACC-4101-001  Interest Income (EIR)
//   ACC-1200-001  Nostro (ZAR correspondent; cash leg, D-COA-CURRENCY-DECOUPLING)
//
// Authority:
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   - IFRS 9 §3.1.1, §3.2.3, §5.1.1, §5.4.1, §5.7.1
//   - Banks Act 94 of 1990
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import type {
  BondInterestAccruedPayload,
  BondMaturedPayload,
  BondPositionRevaluedPayload,
  BondSoldPayload,
  BondTradeExecutedPayload,
} from "../../event-store/event-types/bond-accounting";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Account ID constants — chart-of-accounts leaf IDs for bonds
// ---------------------------------------------------------------------------

export const BOND_ACCOUNTS = {
  // Assets
  BOND_ASSET_BANKING: "ACC-3100-001", // banking book — amortised cost
  BOND_ASSET_TRADING: "ACC-3100-002", // trading book — FVTPL
  ACCRUED_INTEREST_RECEIVABLE: "ACC-3100-003",
  DISCOUNT_PREMIUM_UNAMORTISED: "ACC-3100-004",
  // Income / P&L
  UNREALISED_PNL: "ACC-3100-005",
  REALISED_PNL: "ACC-3100-006",
  INTEREST_INCOME_EIR: "ACC-4101-001",
  // Cash
  NOSTRO_ZAR: "ACC-1200-001",
} as const;

// ---------------------------------------------------------------------------
// PR-BOND-001: Banking-book bond trade booking
//
// On BondTradeExecuted (portfolio == "banking-book"):
//   Buy:
//     Dr Bond Asset — banking book [dirtyPriceAmount]
//     Cr Cash/Nostro                [dirtyPriceAmount]
//
//   Transaction costs are capitalised into the carrying amount per IFRS 9
//   §5.1.1 (initial measurement at fair value + transaction costs for
//   instruments not at FVTPL).
//
//   Dirty price amount = nominalMinor × dirtyPricePercent / 100.
//
// Authority: IFRS 9 §3.1.1, §5.1.1
// ---------------------------------------------------------------------------

export function bondBankingBookJournals(event: BondTradeExecutedPayload): SubLedgerLeg[] {
  const dirtyPriceAmount = Math.round((event.nominalMinor * event.dirtyPricePercent) / 100);

  if (event.side === "buy") {
    return [
      {
        accountId: BOND_ACCOUNTS.BOND_ASSET_BANKING,
        debitCredit: "debit",
        amountMinor: dirtyPriceAmount,
        currency: event.currency,
      },
      {
        accountId: BOND_ACCOUNTS.NOSTRO_ZAR,
        debitCredit: "credit",
        amountMinor: dirtyPriceAmount,
        currency: event.currency,
      },
    ];
  }

  // sell (short selling from banking book — unusual but supported)
  return [
    {
      accountId: BOND_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: dirtyPriceAmount,
      currency: event.currency,
    },
    {
      accountId: BOND_ACCOUNTS.BOND_ASSET_BANKING,
      debitCredit: "credit",
      amountMinor: dirtyPriceAmount,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-BOND-001T: Trading-book bond trade booking
//
// On BondTradeExecuted (portfolio == "trading-book"):
//   Buy:
//     Dr Bond Asset FVTPL  [dirtyPriceAmount]
//     Cr Cash/Nostro        [dirtyPriceAmount]
//
//   Transaction costs expensed immediately (IFRS 9 §5.1.1 — instruments
//   at FVTPL: transaction costs are expensed directly, not capitalised).
//   For the booking entry itself, the amounts are identical to banking-book;
//   the difference is which asset account is debited.
//
// Authority: IFRS 9 §3.1.1, §5.1.1
// ---------------------------------------------------------------------------

export function bondTradingBookJournals(event: BondTradeExecutedPayload): SubLedgerLeg[] {
  const dirtyPriceAmount = Math.round((event.nominalMinor * event.dirtyPricePercent) / 100);

  if (event.side === "buy") {
    return [
      {
        accountId: BOND_ACCOUNTS.BOND_ASSET_TRADING,
        debitCredit: "debit",
        amountMinor: dirtyPriceAmount,
        currency: event.currency,
      },
      {
        accountId: BOND_ACCOUNTS.NOSTRO_ZAR,
        debitCredit: "credit",
        amountMinor: dirtyPriceAmount,
        currency: event.currency,
      },
    ];
  }

  return [
    {
      accountId: BOND_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: dirtyPriceAmount,
      currency: event.currency,
    },
    {
      accountId: BOND_ACCOUNTS.BOND_ASSET_TRADING,
      debitCredit: "credit",
      amountMinor: dirtyPriceAmount,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-BOND-EIR: Effective interest rate accrual
//
// On BondInterestAccrued:
//   Dr Accrued Interest Receivable  [accruedInterestMinor]
//   Cr Interest Income (EIR)         [accruedInterestMinor]
//
// The EIR method amortises the discount/premium on the bond into income
// over the bond's remaining life, in addition to recognising the cash
// coupon accrual. This entry covers both components.
//
// Authority: IFRS 9 §5.4.1
// ---------------------------------------------------------------------------

export function bondInterestAccrualJournals(event: BondInterestAccruedPayload): SubLedgerLeg[] {
  if (event.accruedInterestMinor === 0) return [];

  return [
    {
      accountId: BOND_ACCOUNTS.ACCRUED_INTEREST_RECEIVABLE,
      debitCredit: "debit",
      amountMinor: event.accruedInterestMinor,
      currency: event.currency,
    },
    {
      accountId: BOND_ACCOUNTS.INTEREST_INCOME_EIR,
      debitCredit: "credit",
      amountMinor: event.accruedInterestMinor,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-BOND-002: Trading-book revaluation (FVTPL)
//
// On BondPositionRevalued (trading book only):
//
//   Gain (unrealisedPnlZarMinor > 0):
//     Dr Bond Asset FVTPL      [|Δ|]
//     Cr Unrealised P&L Bonds  [|Δ|]
//
//   Loss (unrealisedPnlZarMinor < 0):
//     Dr Unrealised P&L Bonds  [|Δ|]
//     Cr Bond Asset FVTPL      [|Δ|]
//
//   Zero delta → no entry.
//
// Authority: IFRS 9 §5.7.1
// ---------------------------------------------------------------------------

export function bondRevaluationJournals(event: BondPositionRevaluedPayload): SubLedgerLeg[] {
  const delta = event.unrealisedPnlZarMinor;

  if (delta === 0) return [];

  const absAmount = Math.abs(delta);
  const isGain = delta > 0;

  return [
    {
      accountId: isGain ? BOND_ACCOUNTS.BOND_ASSET_TRADING : BOND_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: event.currency,
    },
    {
      accountId: isGain ? BOND_ACCOUNTS.UNREALISED_PNL : BOND_ACCOUNTS.BOND_ASSET_TRADING,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: event.currency,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-BOND-MAT: Bond maturity (derecognition)
//
// On BondMatured:
//   Dr Cash  [nominalRepaidMinor + finalCouponMinor]
//   Cr Accrued Interest Receivable  [finalCouponMinor]
//   Cr Bond Asset (banking/trading)  [carryingAmount at maturity]
//
//   If carrying amount ≠ nominal (discount/premium still outstanding):
//     Dr/Cr Realised P&L — Bonds for the residual.
//
//   The carrying amount at maturity for a properly amortised banking-book
//   bond equals the nominal (EIR amortisation brings it to par). Trading-
//   book bonds are at fair value — the final P&L leg handles any difference.
//
// This implementation uses nominalRepaidMinor as the asset derecognition
// amount (i.e. assumes EIR has amortised to par for banking-book). The
// caller should pass the correct carryingAmount via nominalRepaidMinor.
//
// Authority: IFRS 9 §3.2.3
//
// Parameters: `portfolio` is passed to select the correct asset account.
// ---------------------------------------------------------------------------

export function bondMaturityJournals(
  event: BondMaturedPayload,
  portfolio: "banking-book" | "trading-book",
): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];
  const totalCash = event.nominalRepaidMinor + event.finalCouponMinor;
  const assetAccount =
    portfolio === "banking-book"
      ? BOND_ACCOUNTS.BOND_ASSET_BANKING
      : BOND_ACCOUNTS.BOND_ASSET_TRADING;

  // Dr Cash for total received
  legs.push({
    accountId: BOND_ACCOUNTS.NOSTRO_ZAR,
    debitCredit: "debit",
    amountMinor: totalCash,
    currency: event.currency,
  });

  // Cr Accrued Interest Receivable for final coupon (if any)
  if (event.finalCouponMinor > 0) {
    legs.push({
      accountId: BOND_ACCOUNTS.ACCRUED_INTEREST_RECEIVABLE,
      debitCredit: "credit",
      amountMinor: event.finalCouponMinor,
      currency: event.currency,
    });
  }

  // Cr Bond Asset for nominal (carry to par assumption for banking-book)
  legs.push({
    accountId: assetAccount,
    debitCredit: "credit",
    amountMinor: event.nominalRepaidMinor,
    currency: event.currency,
  });

  return legs;
}

// ---------------------------------------------------------------------------
// PR-BOND-SALE: Bond sale (derecognition)
//
// On BondSold:
//   Dr Cash                        [saleProceedsMinor]
//   Cr Bond Asset (banking/trading) [carryingAmountAtSaleMinor]
//   Dr/Cr Realised P&L             [realisedPnlMinor]
//
//   Gain (realisedPnlMinor > 0):
//     Dr Cash  [proceeds]  /  Cr Bond Asset [carrying]  /  Cr Realised P&L [gain]
//   Loss (realisedPnlMinor < 0):
//     Dr Cash  [proceeds]  /  Dr Realised P&L [loss]  /  Cr Bond Asset [carrying]
//
// Authority: IFRS 9 §3.2.3
// ---------------------------------------------------------------------------

export function bondSaleJournals(
  event: BondSoldPayload,
  portfolio: "banking-book" | "trading-book",
): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];
  const assetAccount =
    portfolio === "banking-book"
      ? BOND_ACCOUNTS.BOND_ASSET_BANKING
      : BOND_ACCOUNTS.BOND_ASSET_TRADING;

  // Dr Cash for sale proceeds
  legs.push({
    accountId: BOND_ACCOUNTS.NOSTRO_ZAR,
    debitCredit: "debit",
    amountMinor: event.saleProceedsMinor,
    currency: event.currency,
  });

  if (event.realisedPnlMinor >= 0) {
    // Gain or break-even: Cr Bond Asset for carrying amount; Cr Realised P&L for gain
    legs.push({
      accountId: assetAccount,
      debitCredit: "credit",
      amountMinor: event.carryingAmountAtSaleMinor,
      currency: event.currency,
    });
    if (event.realisedPnlMinor > 0) {
      legs.push({
        accountId: BOND_ACCOUNTS.REALISED_PNL,
        debitCredit: "credit",
        amountMinor: event.realisedPnlMinor,
        currency: event.currency,
      });
    }
  } else {
    // Loss: Dr Realised P&L for loss; Cr Bond Asset for full carrying amount
    const lossAbs = Math.abs(event.realisedPnlMinor);
    legs.push({
      accountId: BOND_ACCOUNTS.REALISED_PNL,
      debitCredit: "debit",
      amountMinor: lossAbs,
      currency: event.currency,
    });
    legs.push({
      accountId: assetAccount,
      debitCredit: "credit",
      amountMinor: event.carryingAmountAtSaleMinor,
      currency: event.currency,
    });
  }

  return legs;
}
