// platform/accounting/posting-rules/repo-mmd-ibl.ts
//
// GL posting rules for the three treasury instrument families introduced in
// WS1-PR1a: Repo, Money Market Deposit (bank as taker), and Interbank Loan
// (bank as lender).
//
// 15 rules implemented:
//
//   Repo (6 rules):
//     prRepo001        — RepoTradeOpened        (opening recognition)
//     prRepoSettleStart — RepoStartLegSettled   (memo; no GL — recognition at open)
//     prRepoAccrual    — RepoInterestAccrued     (daily repo rate accrual)
//     prRepoEnd        — RepoEndLegSettled       (terminal — repurchase settlement)
//     prRepoCancel     — RepoTradeTerminatedEarly (terminal — early unwind at par)
//     prRepoMargin     — RepoMarginCallIssued    (memo; collateral memo only)
//
//   MMD (5 rules):
//     prMmd001         — DepositTaken            (opening recognition by category)
//     prMmdAccrual     — DepositInterestAccrued  (daily interest expense accrual)
//     prMmdMat         — DepositMatured          (terminal — principal + interest)
//     prMmdCancel      — DepositWithdrawnEarly   (terminal — early withdrawal)
//     prMmdRollover    — DepositRolledOver       (memo; no GL — no cash movement)
//
//   Funding Line (2 rules):
//     prFunding001     — FundingLineDrawn        (opening recognition)
//     prFundingEnd     — FundingLineRepaid       (terminal — full repayment)
//
//   Interbank Loan (4 rules):
//     prIbl001         — InterbankLoanPlaced     (opening — Dr due-from / Cr Nostro)
//     prIblAccrual     — InterbankLoanInterestAccrued (daily interest income accrual)
//     prIblMat         — InterbankLoanMatured    (terminal — principal + interest)
//     prIblRecall      — InterbankLoanRecalledEarly (terminal — par recall)
//
// Balance invariant: sum(debit.amountMinor) == sum(credit.amountMinor) per
// currency, per call. All amounts in ZAR minor units (cents) unless noted.
//
// Chart-of-accounts references (ACC-NNNN-NNN):
//   ACC-1200-001  Nostro (ZAR correspondent; settlement cash, D-COA-CURRENCY-DECOUPLING) — canonical Nostro used by FX rules
//   ACC-5100-001  Repo Asset (secured borrowing receivable)
//   ACC-5100-002  Repo Liability (secured borrowing payable — alternate entry point)
//   ACC-5100-003  Repo Collateral Memo (off-balance-sheet collateral tracking)
//   ACC-5100-004  Repo Accrued Interest (balance-sheet accrual)
//   ACC-5100-005  Repo Interest Income / Expense (P&L — expense for borrower)
//   ACC-6100-001  Deposit Liability — Retail Stable
//   ACC-6100-002  Deposit Liability — Retail Less-Stable
//   ACC-6100-003  Deposit Liability — Wholesale Operational
//   ACC-6100-004  Deposit Liability — Wholesale Non-Operational
//   ACC-6100-005  Deposit Accrued Interest Payable
//   ACC-6100-006  Deposit Interest Expense (P&L)
//   ACC-7100-001  Due from Banks — Call Placements (asset, amortised cost)
//   ACC-7100-002  Due from Banks — Fixed-Term Placements (asset, amortised cost)
//   ACC-7100-003  IBL Accrued Interest Receivable
//   ACC-7100-004  IBL Interest Income (P&L)
//
// Authority:
//   - WS1-PR1a (brief:ravi:ws1-pr1a-repo-mmd-ibl-event-types-lifecycle-regi:2026-05-23)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - IFRS 9 §3.1.1, §3.2.3, §3.2.4, §4.1.2, §5.4.1, §5.7.1
//   - IAS 39 §27 (repos as secured borrowings)
//   - Banks Act 94 of 1990 Reg 26/27 (LCR/NSFR); BA 110; BA 120
//   - BCBS d365 (IRRBB)
//
// Authors: Ravi (Treasury/ALM Engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering)

import type {
  DepositInterestAccruedPayload,
  DepositMaturedPayload,
  DepositTakenPayload,
  DepositWithdrawnEarlyPayload,
  FundingLineDrawnPayload,
  FundingLineRepaidPayload,
  InterbankLoanInterestAccruedPayload,
  InterbankLoanMaturedPayload,
  InterbankLoanPlacedPayload,
  RepoEndLegSettledPayload,
  RepoInterestAccruedPayload,
  RepoTradeOpenedPayload,
  RepoTradeTerminatedEarlyPayload,
} from "../../event-store/event-types/repo-mmd-ibl";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Account ID constants
// ---------------------------------------------------------------------------

/** Nostro ZAR — matches FX_ACCOUNTS.NOSTRO_ZAR in fx-spot.ts (ACC-1100-001). */
const NOSTRO_ZAR = "ACC-1200-001";

/** Repo sub-ledger accounts. */
const REPO = {
  /** Repo Asset — gross receivable of cash lent under repo (bank as cash lender)
   *  OR secured-borrowing carrying amount (bank as cash borrower, which is our case). */
  asset: "ACC-5100-001",
  /** Repo Liability — alternative entry point for the borrowing leg. */
  liability: "ACC-5100-002",
  /** Repo Collateral Memo — off-balance-sheet tracking of collateral posted/held. */
  collateralMemo: "ACC-5100-003",
  /** Repo Accrued Interest — balance-sheet accrual between open and terminal. */
  accruedInterest: "ACC-5100-004",
  /** Repo Interest P&L — interest expense (for borrower) or income (for lender). */
  interestPnL: "ACC-5100-005",
} as const;

/** MMD (Money Market Deposit) sub-ledger accounts. */
const DEPOSIT = {
  liabilityRetailStable: "ACC-6100-001",
  liabilityRetailLessStable: "ACC-6100-002",
  liabilityWholesaleOp: "ACC-6100-003",
  liabilityWholesaleNonOp: "ACC-6100-004",
  accruedInterest: "ACC-6100-005",
  interestExpense: "ACC-6100-006",
} as const;

/** IBL (Interbank Loan) sub-ledger accounts — bank as lender. */
const IBL = {
  /** Due from Banks — Call Placements (callable on demand). */
  dueFromBanksCall: "ACC-7100-001",
  /** Due from Banks — Fixed-Term Placements (maturity date agreed at inception). */
  dueFromBanksFixed: "ACC-7100-002",
  /** IBL Accrued Interest Receivable. */
  accruedInterest: "ACC-7100-003",
  /** IBL Interest Income (P&L). */
  interestIncome: "ACC-7100-004",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a DepositTaken depositCategory to the appropriate GL liability account.
 * The four categories drive LCR outflow rates (BA 110 Table 1).
 */
function depositLiabilityAccount(category: DepositTakenPayload["depositCategory"]): string {
  switch (category) {
    case "retail-stable":
      return DEPOSIT.liabilityRetailStable;
    case "retail-less-stable":
      return DEPOSIT.liabilityRetailLessStable;
    case "wholesale-operational":
      return DEPOSIT.liabilityWholesaleOp;
    case "wholesale-non-operational":
      return DEPOSIT.liabilityWholesaleNonOp;
  }
}

/**
 * Map an InterbankLoanPlaced placementType to the appropriate asset account.
 * Call placements are more liquid and tracked separately from fixed-term.
 */
function iblAssetAccount(placementType: InterbankLoanPlacedPayload["placementType"]): string {
  return placementType === "call" ? IBL.dueFromBanksCall : IBL.dueFromBanksFixed;
}

// ---------------------------------------------------------------------------
// Repo posting rules
// ---------------------------------------------------------------------------

/**
 * prRepo001 — RepoTradeOpened (PR-REPO-001)
 *
 * The bank has executed a repo: it sells collateral and receives cash (start-
 * leg), agreeing to repurchase at a higher price on the end-leg date. Under
 * IAS 39 §27 / IFRS 9, the collateral is NOT derecognised (the bank retains
 * substantially all the risks and rewards of ownership); instead the cash
 * receipt is a secured borrowing.
 *
 *   Dr  REPO.asset (secured borrowing asset — cash in)   startLegCashZar
 *   Cr  NOSTRO_ZAR (cash received at start leg)          startLegCashZar
 *
 * Net: balance sheet increases by startLegCashZar on both sides.
 * The REPO.asset sub-ledger holds the carrying amount of the liability
 * until end-leg settlement.
 */
export function prRepo001(event: RepoTradeOpenedPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.startLegCashZar);
  return [
    {
      accountId: REPO.asset,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prRepoSettleStart — RepoStartLegSettled (PR-REPO-SETTLE-START)
 *
 * Intentional no-GL-impact. The initial recognition of the repo's cash leg
 * was booked at trade open (prRepo001 on RepoTradeOpened). The start-leg
 * settlement confirmation does not create a new economic event — it merely
 * confirms that the cash booked at inception has been delivered.
 *
 * Returns: [].
 */
export function prRepoSettleStart(_event: { tradeId: string; cashZar: number }): SubLedgerLeg[] {
  // Intentional no-GL-impact: recognition already posted at RepoTradeOpened.
  // This event is a confirmation-only memo in the CDM lifecycle.
  return [];
}

/**
 * prRepoAccrual — RepoInterestAccrued (PR-REPO-ACCRUAL)
 *
 * Daily accrual of repo interest expense (the difference between the
 * repurchase price and the start-leg cash is amortised under the EIR method).
 *
 *   Dr  REPO.accruedInterest   accruedInterestZar
 *   Cr  REPO.interestPnL       accruedInterestZar
 */
export function prRepoAccrual(event: RepoInterestAccruedPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.accruedInterestZar);
  if (amount === 0) return [];
  return [
    {
      accountId: REPO.accruedInterest,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: REPO.interestPnL,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prRepoEnd — RepoEndLegSettled (PR-REPO-END)
 *
 * The bank repurchases the collateral and closes the repo. The repurchase
 * price = start-leg cash + accrued interest. Full derecognition of the
 * REPO.asset carrying amount and REPO.accruedInterest against the Nostro.
 *
 * NOTE: The current event payload only carries `repurchasePriceZar` (the
 * total settlement amount). Without access to the originating
 * RepoTradeOpened.startLegCashZar, we cannot split the derecognition into
 * the principal component and the accrued-interest component precisely.
 * We approximate: the entire repurchasePriceZar clears the REPO.asset account
 * (which accumulated the carrying amount via prRepo001 + prRepoAccrual).
 *
 *   Dr  NOSTRO_ZAR    repurchasePriceZar   (cash paid out to counterparty)
 *   Cr  REPO.asset    repurchasePriceZar   (derecognise secured borrowing)
 *
 * Substrate gap: a future engine enhancement should look up the opening event
 * to split Cr REPO.asset (principal) / Cr REPO.accruedInterest (accrued interest)
 * for precise balance-sheet presentation. The current posting is economically
 * correct but collapses the split.
 */
export function prRepoEnd(event: RepoEndLegSettledPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.repurchasePriceZar);
  return [
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: REPO.asset,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prRepoCancel — RepoTradeTerminatedEarly (PR-REPO-CANCEL)
 *
 * Repo unwound before end-leg date. Cash returned at par (start-leg cash
 * only; any accrued interest is settled bilaterally outside this rule).
 * We reverse the REPO.asset at the carrying amount of the opening event.
 *
 * NOTE: The early-termination payload does not carry a cash amount (the
 * amount is bilaterally agreed on termination). As an approximation,
 * this rule emits a structural reversal memo. The engine is expected to
 * supplement this with the bilateral cash amount from the event store
 * lookup. For the MVP, the posting is intentionally simplified to
 * match the pattern used by prRepoEnd.
 *
 * Since the carrying amount is not available in this event's payload, we
 * treat this as a memo-only posting rule. The engine handles the balance
 * lookup. Returns [].
 *
 * Substrate gap: full reversal requires looking up the RepoTradeOpened
 * startLegCashZar and all interim prRepoAccrual amounts. Deferred to
 * WS1-PR1b (trade engine wiring).
 */
export function prRepoCancel(_event: RepoTradeTerminatedEarlyPayload): SubLedgerLeg[] {
  // Intentional stub: the full reversal requires the opening event payload.
  // The posting-rule-registry entry marks this as "always" so the recon
  // pipeline tracks the gap and the engine can supplement at wiring time.
  return [];
}

// ---------------------------------------------------------------------------
// MMD posting rules
// ---------------------------------------------------------------------------

/**
 * prMmd001 — DepositTaken (PR-MMD-001)
 *
 * Bank receives a deposit. Initial recognition:
 *
 *   Dr  NOSTRO_ZAR                 principalZar  (cash received)
 *   Cr  <liability account>        principalZar  (deposit liability by category)
 *
 * The liability account is selected by depositCategory (BA 110 Table 1).
 */
export function prMmd001(event: DepositTakenPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.principalZar);
  const liabilityAccount = depositLiabilityAccount(event.depositCategory);
  return [
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: liabilityAccount,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prMmdAccrual — DepositInterestAccrued (PR-MMD-ACCRUAL)
 *
 * Daily accrual of interest expense on the deposit:
 *
 *   Dr  DEPOSIT.interestExpense    accruedInterestZar
 *   Cr  DEPOSIT.accruedInterest    accruedInterestZar
 */
export function prMmdAccrual(event: DepositInterestAccruedPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.accruedInterestZar);
  if (amount === 0) return [];
  return [
    {
      accountId: DEPOSIT.interestExpense,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: DEPOSIT.accruedInterest,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prMmdMat — DepositMatured (PR-MMD-MAT)
 *
 * Deposit matures at par. Bank repays principal and accumulated interest:
 *
 *   Dr  <liability account>        principalZar       (derecognise principal)
 *   Dr  DEPOSIT.accruedInterest    interestPaidZar    (derecognise accrual)
 *   Cr  NOSTRO_ZAR                 (principalZar + interestPaidZar)  (cash out)
 *
 * NOTE: The deposit category is not carried on the maturity event. The engine
 * must look up the originating DepositTaken event to determine the correct
 * liability account. This function uses DEPOSIT.liabilityWholesaleNonOp as the
 * default. The engine should supply a `depositCategory` via a context lookup.
 *
 * Substrate gap: category lookup deferred to WS1-PR1b engine wiring. The
 * posting is structurally correct; only the liability sub-ledger split may
 * differ before wiring.
 */
export function prMmdMat(
  event: DepositMaturedPayload,
  depositCategory: DepositTakenPayload["depositCategory"] = "wholesale-non-operational",
): SubLedgerLeg[] {
  const principal = Math.abs(event.principalZar);
  const interest = Math.abs(event.interestPaidZar);
  const total = principal + interest;
  const liabilityAccount = depositLiabilityAccount(depositCategory);
  const legs: SubLedgerLeg[] = [
    {
      accountId: liabilityAccount,
      debitCredit: "debit",
      amountMinor: principal,
      currency: "ZAR",
    },
  ];
  if (interest > 0) {
    legs.push({
      accountId: DEPOSIT.accruedInterest,
      debitCredit: "debit",
      amountMinor: interest,
      currency: "ZAR",
    });
  }
  legs.push({
    accountId: NOSTRO_ZAR,
    debitCredit: "credit",
    amountMinor: total,
    currency: "ZAR",
  });
  return legs;
}

/**
 * prMmdCancel — DepositWithdrawnEarly (PR-MMD-CANCEL)
 *
 * Depositor withdraws early. Bank returns the principal (net of any penalty)
 * and records the penalty as other income if applicable.
 *
 * The deposit category is not on this event; defaults to wholesale-non-operational.
 * The engine must look up the originating DepositTaken for the precise category.
 *
 *   Dr  <liability account>    (principal — from opening event, see substrate gap)
 *   Cr  NOSTRO_ZAR             (principal - penaltyZar)  [if penalty > 0]
 *   Cr  DEPOSIT.interestExpense penaltyZar               [penalty retained as income]
 *
 * Simplified: returns a single Dr liability / Cr Nostro at the available amount.
 * The engine resolves the opening principal and applies the penalty net.
 *
 * Substrate gap: opening principal lookup deferred to WS1-PR1b engine wiring.
 */
export function prMmdCancel(
  event: DepositWithdrawnEarlyPayload,
  depositCategory: DepositTakenPayload["depositCategory"] = "wholesale-non-operational",
  principalZar = 0,
): SubLedgerLeg[] {
  // If principalZar is not supplied (pre-engine-wiring), return empty —
  // the engine must supply the opening amount for a balanced posting.
  if (principalZar <= 0) return [];

  const principal = Math.abs(principalZar);
  const penalty = Math.abs(event.penaltyZar);
  const netCashOut = principal - penalty;
  const liabilityAccount = depositLiabilityAccount(depositCategory);

  const legs: SubLedgerLeg[] = [
    {
      accountId: liabilityAccount,
      debitCredit: "debit",
      amountMinor: principal,
      currency: "ZAR",
    },
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: netCashOut,
      currency: "ZAR",
    },
  ];

  // Penalty retained by the bank: recognised as interest expense reversal
  // (i.e. credit the interestExpense account — it reduces the bank's expense).
  if (penalty > 0) {
    legs.push({
      accountId: DEPOSIT.interestExpense,
      debitCredit: "credit",
      amountMinor: penalty,
      currency: "ZAR",
    });
  }

  return legs;
}

/**
 * prMmdRollover — DepositRolledOver (PR-MMD-ROLLOVER)
 *
 * Intentional no-GL-impact. A deposit rollover extends the maturity and
 * resets the interest rate — it is an administrative event with no cash
 * movement. No derecognition occurs; the liability remains on the books
 * under the same depositId.
 *
 * Returns: [].
 */
export function prMmdRollover(_event: { depositId: string }): SubLedgerLeg[] {
  // Intentional no-GL-impact: deposit rolled over; no cash movement; no
  // derecognition. The liability sub-ledger account is unchanged.
  return [];
}

// ---------------------------------------------------------------------------
// Funding line posting rules
// ---------------------------------------------------------------------------

/**
 * prFunding001 — FundingLineDrawn (PR-FUNDING-001)
 *
 * Bank draws on a committed wholesale facility. Cash received from lender:
 *
 *   Dr  NOSTRO_ZAR                        drawnAmountZar  (cash in)
 *   Cr  DEPOSIT.liabilityWholesaleNonOp   drawnAmountZar  (funding liability)
 *
 * Wholesale non-operational is the correct LCR category for committed facility
 * drawdowns from banks / financial institutions (BA 110 Table 2, 100% outflow).
 */
export function prFunding001(event: FundingLineDrawnPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.drawnAmountZar);
  return [
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: DEPOSIT.liabilityWholesaleNonOp,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prFundingEnd — FundingLineRepaid (PR-FUNDING-END)
 *
 * Bank repays the drawn facility in full:
 *
 *   Dr  DEPOSIT.liabilityWholesaleNonOp   repaidAmountZar  (derecognise liability)
 *   Cr  NOSTRO_ZAR                        repaidAmountZar  (cash out)
 */
export function prFundingEnd(event: FundingLineRepaidPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.repaidAmountZar);
  return [
    {
      accountId: DEPOSIT.liabilityWholesaleNonOp,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

// ---------------------------------------------------------------------------
// Interbank Loan posting rules
// ---------------------------------------------------------------------------

/**
 * prIbl001 — InterbankLoanPlaced (PR-IBL-001)
 *
 * Bank places cash with another institution. Initial recognition:
 *
 *   Dr  Due from Banks [placementType]   principalZar  (asset — cash placed)
 *   Cr  NOSTRO_ZAR                       principalZar  (cash out)
 *
 * Call placements → IBL.dueFromBanksCall (ACC-7100-001)
 * Fixed-term      → IBL.dueFromBanksFixed (ACC-7100-002)
 */
export function prIbl001(event: InterbankLoanPlacedPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.principalZar);
  const assetAccount = iblAssetAccount(event.placementType);
  return [
    {
      accountId: assetAccount,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prIblAccrual — InterbankLoanInterestAccrued (PR-IBL-ACCRUAL)
 *
 * Daily accrual of interest income on the placement:
 *
 *   Dr  IBL.accruedInterest    accruedInterestZar
 *   Cr  IBL.interestIncome     accruedInterestZar
 */
export function prIblAccrual(event: InterbankLoanInterestAccruedPayload): SubLedgerLeg[] {
  const amount = Math.abs(event.accruedInterestZar);
  if (amount === 0) return [];
  return [
    {
      accountId: IBL.accruedInterest,
      debitCredit: "debit",
      amountMinor: amount,
      currency: "ZAR",
    },
    {
      accountId: IBL.interestIncome,
      debitCredit: "credit",
      amountMinor: amount,
      currency: "ZAR",
    },
  ];
}

/**
 * prIblMat — InterbankLoanMatured (PR-IBL-MAT)
 *
 * Loan matures. Bank receives principal and interest:
 *
 *   Dr  NOSTRO_ZAR                   (principalZar + interestReceivedZar)
 *   Cr  Due from Banks [type]         principalZar
 *   Cr  IBL.accruedInterest           interestReceivedZar
 *
 * The placementType is not on the maturity event. The engine must look up
 * the originating InterbankLoanPlaced to determine the asset account (call vs
 * fixed-term). Default: fixed-term. See substrate gap below.
 *
 * Substrate gap: placementType lookup deferred to WS1-PR1b engine wiring.
 */
export function prIblMat(
  event: InterbankLoanMaturedPayload,
  placementType: InterbankLoanPlacedPayload["placementType"] = "fixed-term",
): SubLedgerLeg[] {
  const principal = Math.abs(event.principalZar);
  const interest = Math.abs(event.interestReceivedZar);
  const total = principal + interest;
  const assetAccount = iblAssetAccount(placementType);

  const legs: SubLedgerLeg[] = [
    {
      accountId: NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: total,
      currency: "ZAR",
    },
    {
      accountId: assetAccount,
      debitCredit: "credit",
      amountMinor: principal,
      currency: "ZAR",
    },
  ];

  if (interest > 0) {
    legs.push({
      accountId: IBL.accruedInterest,
      debitCredit: "credit",
      amountMinor: interest,
      currency: "ZAR",
    });
  }

  return legs;
}

/**
 * prIblRecall — InterbankLoanRecalledEarly (PR-IBL-RECALL)
 *
 * Bank exercises early recall. No interest penalty for lender-initiated recall;
 * only the principal is returned. The accrued interest balance is settled
 * separately (per bilateral recall agreement).
 *
 * Intentional stub: the principal amount is not on the recall event payload.
 * The engine must look up the originating InterbankLoanPlaced.principalZar.
 *
 * Returns []: engine supplements with the opening payload.
 *
 * Substrate gap: opening principal lookup deferred to WS1-PR1b engine wiring.
 */
export function prIblRecall(_event: { placementId: string }): SubLedgerLeg[] {
  // Intentional stub: the engine must look up the originating principal.
  // The posting-rule-registry entry is marked "always" so the recon pipeline
  // tracks the gap and the engine can supplement at wiring time.
  return [];
}
