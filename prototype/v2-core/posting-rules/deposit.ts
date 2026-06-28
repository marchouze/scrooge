// v2-core/posting-rules/deposit.ts
//
// DEPOSIT posting rules — the PURE `payload → leg(s)` core of the born-V2 deposit
// (bank-as-taker) GL posting rules (D-BA-RETURN-CELL-VALUE-ENGINE; L5-FTR deposit
// instrument slice), living in the canonical `v2-core/posting-rules/` spine
// alongside `capital.ts` / `fx.ts` / `fx-settlement.ts`.
//
// WHY THIS IS THE #1 CROSS-CUTTING CAPABILITY (DISCOVERY-ranked). A deposit is the
// dimension that lights up the most dimension-gated BA-return leaf cells at once:
//   - BA 100 (Balance Sheet) deposit-liability rows R0570–R0620 + the R1010
//     counterparty-sector analysis;
//   - BA 300 (LCR / NSFR) funding-side run-off buckets + ASF bands.
// The deposit FIL *model* already existed (`mm-deposit-model.ts`, amortised-cost
// Valuable + Performable); the deposit-liability CoA accounts already existed
// (ACC-6100-001..004, split by counterparty sector). The GAP this slice closes is
// the born-V2 deposit POSTING RULE + the typed `depositTerms` dimension — so a
// deposit FIL instance is a SELF-DESCRIBING instrument-of-record whose BA 100 /
// BA 300 leaf folds read the line/band directly from the EVENT (sibling-fold
// discipline, Principle 1), not from a coarser CoA proxy.
//
// These functions let the deposit balance-sheet + liquidity contribution be
// computed as a PURE FOLD over the generic FIL instance lifecycle events
// (FilInstrumentCreated / FilInstrumentTerminated) for money-market DEPOSIT
// instances WITHOUT a stored `GlPostingEmitted` event in the read path
// (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST) —
// structurally identical to the capital fold.
//
// IFRS DETERMINATION (the load-bearing accounting point):
//   - Take-on / recognition (FilInstrumentCreated):
//       Dr settlement-cash (the proceeds RECEIVED)   IAS 32 §AG3 / IFRS 9 §3.1.1
//       Cr deposit-liability account (per ctpty sector) IFRS 9 §4.2.1 (financial
//                                                       liability at amortised cost)
//     A deposit is unconditionally a financial liability of the bank to the
//     depositor (the bank owes the cash back) — IAS 32 §11 definition of a
//     financial liability; measured at amortised cost (IFRS 9 §4.2.1, no FVTPL
//     election in the banking book).
//   - Maturity / repayment / early withdrawal (FilInstrumentTerminated):
//       Dr deposit-liability account (derecognise)   IFRS 9 §3.3.1 (extinguishment)
//       Cr settlement-cash (the principal REPAID)
//     The terminal carries no economic terms (no notional), so a bare terminal
//     posts a ZERO-AMOUNT memo (byte-symmetric with the capital / FX close memo);
//     the principal-repayment + accrued-interest legs are a TRACKED deferred gap
//     (ProductDeferredGap) pending a richer FIL terminal event — never a silent
//     omission (Charter cmd 5). The interest-EXPENSE accrual leg is the deposit
//     model's daily-carry concern (Performable), not this recognition rule.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY from other
// `v2-core/` modules (control-plane tenant, fil-instances events, core money-wire,
// chart-of-accounts; enforced by `recon:v2-no-v1-import`).
//
// FAIL-CLOSED (Charter cmd 2): a deposit instance lacking `depositTerms`, an
// unmapped counterparty sector, or an unmapped settlement currency THROWS — never
// a silent default into a suspense account.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST (#1597);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-V1-REMOVAL-PHASE-1 (born-V2, no v1-only emission);
//   IAS-32-§11; IAS-32-§AG3; IFRS-9-§3.1.1; IFRS-9-§4.2.1; IFRS-9-§3.3.1;
//   urn:reg:bcbs:lcr:d238; urn:reg:za:regs-relating-to-banks:reg26;
//   SARB BA 100 (R0570–R0620); SARB BA 300; Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100 / BA 300).

import { COA_BY_ID } from "../accounting/chart-of-accounts";
import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { MoneyWire } from "../core/money-wire";
import type {
  FilDepositCounterpartySector,
  FilDepositTerms,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../fil-instances/events";

// ---------------------------------------------------------------------------
// Deposit type taxonomy guard — `fil:type:ir:money-market.deposit:*`.
// ---------------------------------------------------------------------------

export const DEPOSIT_POSTING_TYPE_PREFIX = "fil:type:ir:money-market.deposit:";

/** True iff the FIL taxonomy type URN names a money-market deposit instrument. */
export function isDepositPostingInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(DEPOSIT_POSTING_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// In-memory deposit posting leg — the pure-fold analogue of one GL leg
// (structurally identical to CapitalPostingLeg).
// ---------------------------------------------------------------------------

export interface DepositPostingLeg {
  readonly accountCode: string;
  readonly creditDebit: "debit" | "credit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  /** The counterparty sector this leg's deposit-liability account belongs to. */
  readonly counterpartySector: FilDepositCounterpartySector;
}

// ---------------------------------------------------------------------------
// Deposit V2 posting-rule ids (born-V2; no v1-only emission).
// ---------------------------------------------------------------------------

export const DEPOSIT_POSTING_RULE_IDS = {
  takeOn: "PR-DEP-TAKEON-001-V2",
  repayment: "PR-DEP-REPAY-002-V2",
} as const;

const DEPOSIT_IAS_RULES = {
  takeOn:
    "IAS 32 §11/§AG3 (financial liability) / IFRS 9 §3.1.1 + §4.2.1 (amortised cost) — deposit recognition on take-on",
  repayment:
    "IFRS 9 §3.3.1 (financial-liability extinguishment) — deposit derecognition on maturity/repayment/early-withdrawal",
} as const;

// ---------------------------------------------------------------------------
// Deposit-liability account resolution — the counterparty sector selects the
// canonical CoA deposit-liability account. The sector vocabulary is byte-identical
// to the ACC-6100-001..004 sub-accounts (the account IS the event's economic
// dimension). FAIL-CLOSED: an unmapped sector throws (no silent suspense default —
// Charter cmd 2). The resolved account is verified to exist + be a liability so a
// drift between this map and the chart of accounts is caught at fold time.
// ---------------------------------------------------------------------------

const DEPOSIT_LIABILITY_ACCOUNT_BY_SECTOR: Readonly<
  Record<FilDepositCounterpartySector, string>
> = {
  "retail-stable": "ACC-6100-001", // Deposit Liability — Retail Stable
  "retail-less-stable": "ACC-6100-002", // Deposit Liability — Retail Less-Stable
  "wholesale-operational": "ACC-6100-003", // Deposit Liability — Wholesale Operational
  "wholesale-non-operational": "ACC-6100-004", // Deposit Liability — Wholesale Non-Operational
};

/**
 * Resolve the deposit-liability CoA account for a counterparty sector, fail-closed.
 * Verifies (a) the sector maps to an account, (b) the account is in the chart of
 * accounts, and (c) it is a credit-natural liability — so the posting code and the
 * chart of accounts can never silently disagree.
 */
export function resolveDepositLiabilityAccount(sector: FilDepositCounterpartySector): string {
  const accountId = DEPOSIT_LIABILITY_ACCOUNT_BY_SECTOR[sector];
  if (accountId === undefined) {
    throw new Error(
      `deposit posting: no deposit-liability account mapped for counterparty sector ${sector} (fail-closed — D-BA-RETURN-CELL-VALUE-ENGINE)`,
    );
  }
  const coa = COA_BY_ID.get(accountId);
  if (coa === undefined) {
    throw new Error(`deposit posting: deposit-liability account ${accountId} not in chart of accounts`);
  }
  if (coa.side !== "credit") {
    throw new Error(
      `deposit posting: CoA account ${accountId} (side ${coa.side}) is not a credit-natural liability — fail-closed`,
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Settlement-cash account resolution — the proceeds leg settles through the bank's
// correspondent nostro for the deposit currency. Identical mapping to the capital
// rule (a take-on receives cash into the same nostro). Fail-closed: an unmapped
// currency throws so the cash leg never silently lands in a wrong account.
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
      `deposit posting: no settlement-cash (nostro) account mapped for currency ${currency} (fail-closed — D-BA-RETURN-CELL-VALUE-ENGINE)`,
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

/** Extract the deposit-terms block, fail-closed (a deposit instance MUST carry it). */
export function requireDepositTerms(
  payload: FilInstrumentCreatedPayload,
  context: string,
): FilDepositTerms {
  const dt = payload.economicTerms.depositTerms;
  if (dt === undefined) {
    throw new Error(
      `deposit posting (${context}): money-market deposit FIL instance carries no economicTerms.depositTerms — cannot resolve the deposit-liability account (fail-closed — D-BA-RETURN-CELL-VALUE-ENGINE)`,
    );
  }
  return dt;
}

// ---------------------------------------------------------------------------
// PR-DEP-TAKEON-001-V2 — Deposit recognition on take-on (FilInstrumentCreated).
// Dr settlement-cash (proceeds received) / Cr deposit-liability (per ctpty sector).
// IAS 32 §11/§AG3 (financial liability) / IFRS 9 §3.1.1 + §4.2.1 (amortised cost).
// ---------------------------------------------------------------------------

export function postDepositTakeOnLegs(payload: FilInstrumentCreatedPayload): DepositPostingLeg[] {
  const t = payload.economicTerms;
  const dt = requireDepositTerms(payload, "take-on");
  const depositLiabilityAccount = resolveDepositLiabilityAccount(dt.counterpartySector);
  const settlementCashAccount = resolveSettlementCashAccount(t.notional.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = DEPOSIT_IAS_RULES.takeOn;
  const postingRuleId = DEPOSIT_POSTING_RULE_IDS.takeOn;
  const description = `Deposit take-on ${dt.depositCategory} / ${dt.counterpartySector} ${t.notional.currency} (V2)`;

  return [
    {
      creditDebit: "debit",
      accountCode: settlementCashAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      counterpartySector: dt.counterpartySector,
    },
    {
      creditDebit: "credit",
      accountCode: depositLiabilityAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      counterpartySector: dt.counterpartySector,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-DEP-REPAY-002-V2 — Deposit derecognition on maturity / repayment / early
// withdrawal (FilInstrumentTerminated). The terminal carries NO economic terms
// (no notional), so a bare terminal posts a ZERO-AMOUNT memo (Dr/Cr the same
// deposit-liability account at 0), byte-symmetric with the capital / FX close
// memo.
//
// SUBSTRATE GAP (tracked, NOT a silent omission — Charter cmd 5; surfaced as a
// ProductDeferredGap by the BA 100 / BA 300 leaf-fold registration): a proper
// repayment reverses the prior recognition using the prior notional + sector from
// the Created event; the principal-repayment cash leg + any accrued-interest
// settlement require economic terms FilInstrumentTerminated does not carry. The
// bare-terminal memo is intentionally sector-agnostic (`wholesale-non-operational`
// is the documented placeholder) and posts zero, so it neither over- nor
// under-states any sector in the composition.
// ---------------------------------------------------------------------------

export function postDepositRepaymentLegs(
  payload: FilInstrumentTerminatedPayload,
): DepositPostingLeg[] {
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = DEPOSIT_IAS_RULES.repayment;
  const postingRuleId = DEPOSIT_POSTING_RULE_IDS.repayment;
  const description = `Deposit derecognition ${payload.terminalStage} (V2 memo — principal-repayment deferred gap)`;
  const zeroAmount: MoneyWire = { __money: "v1" as const, currency: "ZAR", amount: "0" };
  const placeholderAccount = DEPOSIT_LIABILITY_ACCOUNT_BY_SECTOR["wholesale-non-operational"];

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
      counterpartySector: "wholesale-non-operational",
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
      counterpartySector: "wholesale-non-operational",
    },
  ];
}
