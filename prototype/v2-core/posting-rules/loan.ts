// v2-core/posting-rules/loan.ts
//
// LOAN-ORIGINATION posting rules — the PURE `payload → leg(s)` core of the born-V2
// loan-and-advances (bank-as-LENDER) GL posting rules (D-BA-RETURN-CELL-VALUE-
// ENGINE; L5-FTR loan-origination slice; DISCOVERY backlog item #2), living in the
// canonical `v2-core/posting-rules/` spine alongside `capital.ts` / `deposit.ts` /
// `fx.ts`.
//
// WHY THIS IS THE #2 CROSS-CUTTING CAPABILITY (DISCOVERY-ranked). A loan-origination
// instrument is the dimension that lights up the asset side of the balance sheet
// AND the dominant capital denominator at once:
//   - BA 100 (Balance Sheet) loans-and-advances rows R0130–R0230 (homeloans /
//     commercial mortgages / credit cards / lease-instalment / overdrafts / term
//     loans / other);
//   - BA 200 (credit-risk loans-and-advances) — the whole credit return (EAD,
//     gross/net carrying, ECL by IFRS 9 stage + exposure class, NPL / coverage);
//   - BA 700 (capital adequacy) credit-RWA leg — the dominant Pillar-1 denominator.
// The credit MACHINERY already existed (the CRE20 risk-weight table in rwa-engine.ts,
// the IFRS 9 staging engine, the EAD/ECL fold in ecl-engine.ts, the BA 200 generator,
// and the credit-RWA leg in BA 700). The GAP this slice closes is the born-V2 loan
// POSTING RULE + the typed `loanTerms` dimension + a `readDebtExposures` loan fold —
// so a loan FIL instance is a SELF-DESCRIBING instrument-of-record whose BA 100 /
// BA 200 / BA 700 leaf folds read the line / stage / exposure class directly from
// the EVENT (sibling-fold discipline, Principle 1), not from a coarser CoA proxy.
//
// These functions let the loan balance-sheet + credit-RWA contribution be computed
// as a PURE FOLD over the generic FIL instance lifecycle events
// (FilInstrumentCreated / FilInstrumentTerminated) for `credit` loan-advance
// instances WITHOUT a stored `GlPostingEmitted` event in the read path
// (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST) —
// structurally identical to the capital + deposit folds.
//
// IFRS DETERMINATION (the load-bearing accounting point):
//   - Origination / recognition (FilInstrumentCreated):
//       Dr loan-asset (advances, per product sub-type)  IFRS 9 §3.1.1 / §4.1.2
//       Cr settlement-cash (the principal ADVANCED via nostro)  (amortised cost)
//     A loan is a financial ASSET measured at amortised cost (IFRS 9 §4.1.2 — the
//     SPPI banking-book funded advance; no FVTPL designation). The cash leaves the
//     bank to the borrower; the advance is recognised as a receivable.
//   - Repayment / settlement / write-off (FilInstrumentTerminated):
//       Dr settlement-cash (principal REPAID)            IFRS 9 §3.2.3 (derecognition)
//       Cr loan-asset (derecognise the advance)
//     The terminal carries no economic terms (no notional), so a bare terminal posts
//     a ZERO-AMOUNT memo (byte-symmetric with the capital / deposit / FX close memo);
//     the principal-repayment + interest-and-impairment-reversal legs are a TRACKED
//     deferred gap (ProductDeferredGap) pending a richer FIL terminal event — never
//     a silent omission (Charter cmd 5). The interest-INCOME accrual leg + the ECL
//     impairment leg are the loan model's daily-carry concerns, not this recognition
//     rule.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY from other
// `v2-core/` modules (control-plane tenant, fil-instances events, core money-wire,
// chart-of-accounts, fil-models loan type; enforced by `recon:v2-no-v1-import`).
//
// FAIL-CLOSED (Charter cmd 2): a loan instance lacking `loanTerms`, an unmapped
// loan-product sub-type, or an unmapped settlement currency THROWS — never a silent
// default into a suspense account.
//
// BORN-V2 (D-V1-REMOVAL-PHASE-1): emits NO v1-only event type. The loan reuses the
// generic FIL lifecycle events; the natural v1 `LoanBooked` family is NOT used or
// widened.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST (#1597);
//   D-BA-RETURN-SIMULATOR-FIRST; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
//   D-DERIVED-EVENT-IRREDUCIBILITY-TEST; D-V1-REMOVAL-PHASE-1 (born-V2);
//   IFRS-9-§3.1.1; IFRS-9-§4.1.2; IFRS-9-§3.2.3; IFRS-9-§5.5;
//   urn:reg:za:regs-relating-to-banks:reg23; urn:reg:bcbs:cre:20;
//   SARB BA 100 (R0130–R0230); SARB BA 200; SARB BA 700; Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100 / BA 200).

import { COA_BY_ID } from "../accounting/chart-of-accounts";
import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { MoneyWire } from "../core/money-wire";
import type {
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
  FilLoanProductSubType,
  FilLoanTerms,
} from "../fil-instances/events";
import { LOAN_TYPE_PREFIX } from "../fil-models/credit/types/loan-type-definitions";

// ---------------------------------------------------------------------------
// Loan type taxonomy guard — `fil:type:credit:loan.*`.
// ---------------------------------------------------------------------------

export const LOAN_POSTING_TYPE_PREFIX = LOAN_TYPE_PREFIX;

/** True iff the FIL taxonomy type URN names a loan-and-advance instrument. */
export function isLoanPostingInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(LOAN_POSTING_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// In-memory loan posting leg — the pure-fold analogue of one GL leg
// (structurally identical to CapitalPostingLeg / DepositPostingLeg).
// ---------------------------------------------------------------------------

export interface LoanPostingLeg {
  readonly accountCode: string;
  readonly creditDebit: "debit" | "credit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  /** The SARB loan-product sub-type this leg's advances account belongs to. */
  readonly loanProductSubType: FilLoanProductSubType;
}

// ---------------------------------------------------------------------------
// Loan V2 posting-rule ids (born-V2; no v1-only emission).
// ---------------------------------------------------------------------------

export const LOAN_POSTING_RULE_IDS = {
  origination: "PR-LOAN-ORIG-001-V2",
  repayment: "PR-LOAN-REPAY-002-V2",
} as const;

const LOAN_IAS_RULES = {
  origination:
    "IFRS 9 §3.1.1 + §4.1.2 (financial asset at amortised cost) — loan-and-advance recognition on origination/drawdown",
  repayment:
    "IFRS 9 §3.2.3 (financial-asset derecognition) — loan derecognition on repayment/settlement/write-off",
} as const;

// ---------------------------------------------------------------------------
// Loan-asset (advances) account resolution — the SARB loan-product sub-type
// selects the canonical CoA advances account. The sub-type vocabulary is
// byte-aligned to the ACC-7200-001..007 advances sub-accounts (the account IS the
// event's economic dimension). FAIL-CLOSED: an unmapped sub-type throws (no silent
// suspense default — Charter cmd 2). The resolved account is verified to exist + be
// a debit-natural asset so a drift between this map and the chart of accounts is
// caught at fold time.
// ---------------------------------------------------------------------------

const LOAN_ASSET_ACCOUNT_BY_SUBTYPE: Readonly<Record<FilLoanProductSubType, string>> = {
  "home-loan": "ACC-7200-001", // Loans and Advances — Homeloans (BA 100 R0130).
  "commercial-mortgage": "ACC-7200-002", // — Commercial Mortgages (R0140).
  "credit-card": "ACC-7200-003", // — Credit Cards (R0150).
  "lease-instalment": "ACC-7200-004", // — Lease and Instalment Debtors (R0160).
  overdraft: "ACC-7200-005", // — Overdrafts (R0170).
  "term-loan": "ACC-7200-006", // — Term Loans (R0200).
  other: "ACC-7200-007", // — Other (R0230).
};

/**
 * Resolve the loan-asset (advances) CoA account for a SARB loan-product sub-type,
 * fail-closed. Verifies (a) the sub-type maps to an account, (b) the account is in
 * the chart of accounts, and (c) it is a debit-natural asset — so the posting code
 * and the chart of accounts can never silently disagree.
 */
export function resolveLoanAssetAccount(subType: FilLoanProductSubType): string {
  const accountId = LOAN_ASSET_ACCOUNT_BY_SUBTYPE[subType];
  if (accountId === undefined) {
    throw new Error(
      `loan posting: no loan-asset (advances) account mapped for product sub-type ${subType} (fail-closed — D-BA-RETURN-CELL-VALUE-ENGINE)`,
    );
  }
  const coa = COA_BY_ID.get(accountId);
  if (coa === undefined) {
    throw new Error(`loan posting: loan-asset account ${accountId} not in chart of accounts`);
  }
  if (coa.side !== "debit") {
    throw new Error(
      `loan posting: CoA account ${accountId} (side ${coa.side}) is not a debit-natural asset — fail-closed`,
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Settlement-cash account resolution — the principal-advanced leg settles through
// the bank's correspondent nostro for the loan currency. Identical mapping to the
// capital / deposit rules. Fail-closed: an unmapped currency throws so the cash leg
// never silently lands in a wrong account.
// ---------------------------------------------------------------------------

const SETTLEMENT_CASH_ACCOUNT_BY_CURRENCY: Readonly<Record<string, string>> = {
  ZAR: "ACC-1200-001", // ZAR Nostro (correspondent)
  USD: "ACC-1200-002",
  EUR: "ACC-1200-003",
  GBP: "ACC-1200-004",
  JPY: "ACC-1200-005",
  CHF: "ACC-1200-006",
  AUD: "ACC-1200-007",
};

export function resolveSettlementCashAccount(currency: string): string {
  const accountId = SETTLEMENT_CASH_ACCOUNT_BY_CURRENCY[currency];
  if (accountId === undefined) {
    throw new Error(
      `loan posting: no settlement-cash (nostro) account mapped for currency ${currency} (fail-closed — D-BA-RETURN-CELL-VALUE-ENGINE)`,
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Encoding helper — v2-core Money { currency, amount } → MoneyWire.
// ---------------------------------------------------------------------------

function toMoneyWire(money: { currency: string; amount: string }): MoneyWire {
  return { __money: "v1" as const, currency: money.currency, amount: money.amount };
}

/** Extract the loan-terms block, fail-closed (a loan instance MUST carry it). */
export function requireLoanTerms(
  payload: FilInstrumentCreatedPayload,
  context: string,
): FilLoanTerms {
  const lt = payload.economicTerms.loanTerms;
  if (lt === undefined) {
    throw new Error(
      `loan posting (${context}): credit loan FIL instance carries no economicTerms.loanTerms — cannot resolve the loan-asset account (fail-closed — D-BA-RETURN-CELL-VALUE-ENGINE)`,
    );
  }
  return lt;
}

// ---------------------------------------------------------------------------
// PR-LOAN-ORIG-001-V2 — Loan recognition on origination (FilInstrumentCreated).
// Dr loan-asset (advances, per product sub-type) / Cr settlement-cash (principal
// advanced). IFRS 9 §3.1.1 + §4.1.2 (financial asset at amortised cost).
// ---------------------------------------------------------------------------

export function postLoanOriginationLegs(payload: FilInstrumentCreatedPayload): LoanPostingLeg[] {
  const t = payload.economicTerms;
  const lt = requireLoanTerms(payload, "origination");
  const loanAssetAccount = resolveLoanAssetAccount(lt.loanProductSubType);
  const settlementCashAccount = resolveSettlementCashAccount(t.notional.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = LOAN_IAS_RULES.origination;
  const postingRuleId = LOAN_POSTING_RULE_IDS.origination;
  const description = `Loan origination ${lt.loanProductSubType} / ${lt.exposureClass} stage-${lt.ifrs9Stage} ${t.notional.currency} (V2)`;

  return [
    {
      creditDebit: "debit",
      accountCode: loanAssetAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      loanProductSubType: lt.loanProductSubType,
    },
    {
      creditDebit: "credit",
      accountCode: settlementCashAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      loanProductSubType: lt.loanProductSubType,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-LOAN-REPAY-002-V2 — Loan derecognition on repayment / settlement / write-off
// (FilInstrumentTerminated). The terminal carries NO economic terms (no notional),
// so a bare terminal posts a ZERO-AMOUNT memo (Dr/Cr the same loan-asset account at
// 0), byte-symmetric with the capital / deposit / FX close memo.
//
// SUBSTRATE GAP (tracked, NOT a silent omission — Charter cmd 5; surfaced as a
// ProductDeferredGap by the BA 100 / BA 200 leaf-fold registration): a proper
// repayment reverses the prior recognition using the prior notional + sub-type from
// the Created event; the principal-repayment cash leg + any accrued-interest /
// impairment-reversal settlement require economic terms FilInstrumentTerminated does
// not carry. The bare-terminal memo is intentionally sub-type-agnostic (`other` is
// the documented placeholder) and posts zero, so it neither over- nor under-states
// any advances row in the composition.
// ---------------------------------------------------------------------------

export function postLoanRepaymentLegs(payload: FilInstrumentTerminatedPayload): LoanPostingLeg[] {
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = LOAN_IAS_RULES.repayment;
  const postingRuleId = LOAN_POSTING_RULE_IDS.repayment;
  const description = `Loan derecognition ${payload.terminalStage} (V2 memo — principal-repayment deferred gap)`;
  const zeroAmount: MoneyWire = { __money: "v1" as const, currency: "ZAR", amount: "0" };
  const placeholderAccount = LOAN_ASSET_ACCOUNT_BY_SUBTYPE.other;

  return [
    {
      creditDebit: "debit",
      accountCode: placeholderAccount,
      amount: zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      loanProductSubType: "other",
    },
    {
      creditDebit: "credit",
      accountCode: placeholderAccount,
      amount: zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      loanProductSubType: "other",
    },
  ];
}
