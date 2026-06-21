// v2-core/posting-rules/capital.ts
//
// CAPITAL posting rules — the PURE `payload → leg(s)` core of the Capital V2 GL
// posting rules (D-CAPITAL-ASSET-CLASS-V1), living in the canonical
// `v2-core/posting-rules/` spine alongside `fx.ts` / `fx-settlement.ts`.
//
// These functions let the BA-700 / BA-100 capital composition be computed as a
// PURE FOLD over the generic FIL instance lifecycle events (FilInstrumentCreated /
// FilInstrumentAmended / FilInstrumentTerminated) for `capital` asset-class
// instances WITHOUT a stored `GlPostingEmitted` event in the capital read path
// (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST).
//
// IFRS DETERMINATION (the load-bearing accounting point):
//   - Issuance / recognition (FilInstrumentCreated):
//       Dr settlement-cash (the proceeds received)   IAS 32 §22 / IFRS 9 §3.1.1
//       Cr own-funds account (per qualifying tier)    IAS 32 §22 (CET1 equity) /
//                                                     IFRS 9 §4.2.1 (AT1/T2 liability)
//   - Distribution (FilInstrumentAmended w/ a distribution): out of scope of the
//       atomic recognition rule here — dividends on CET1 are an equity charge
//       (IAS 32 §35) recognised by the retained-earnings fold, not a capital-
//       instrument posting; carried as a TRACKED deferred gap (no silent default).
//   - Redemption / call / maturity / cancellation (FilInstrumentTerminated):
//       Dr own-funds account (derecognise the instrument)  IAS 32 §33 (own shares)
//       Cr settlement-cash (the redemption proceeds paid)  / IFRS 9 §3.3.1 (liability)
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY from other
// `v2-core/` modules (control-plane tenant, fil-instances events, core money-wire,
// chart-of-accounts); NO imports from `platform/` (enforced by
// `recon:v2-no-v1-import`).
//
// FAIL-CLOSED (Charter cmd 2): an unknown qualifying-capital tier / sub-category,
// a tier↔sub-category mismatch, or an unresolved own-funds account throws — never
// a silent default into a suspense account.
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
//   D-ACCT-SCHEMA-CANONICAL-HOME; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   IAS-32-§22; IAS-32-§33; IAS-32-§35; IFRS-9-§3.1.1; IFRS-9-§4.2.1; IFRS-9-§3.3.1;
//   urn:reg:za:regs-relating-to-banks:reg38; Banks Act 94 of 1990 §70;
//   urn:reg:bcbs:rbc:20.2; Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { COA_BY_ID } from "../accounting/chart-of-accounts";
import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { MoneyWire } from "../core/money-wire";
import type {
  FilCapitalSubCategory,
  FilCapitalTier,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
  FilQualifyingCapital,
} from "../fil-instances/events";
import { capitalSubCategoryMatchesTier } from "../fil-instances/events";
import { CAPITAL_TYPE_PREFIX } from "../fil-models/capital/types/capital-type-definitions";

// ---------------------------------------------------------------------------
// Capital type taxonomy guard — `fil:type:capital:*`.
// ---------------------------------------------------------------------------

export const CAPITAL_POSTING_TYPE_PREFIX = CAPITAL_TYPE_PREFIX;

/** True iff the FIL taxonomy type URN names a capital instrument. */
export function isCapitalPostingInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(CAPITAL_POSTING_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// In-memory capital posting leg — the pure-fold analogue of one GL leg
// (structurally identical to FxPostingLeg).
// ---------------------------------------------------------------------------

export interface CapitalPostingLeg {
  readonly accountCode: string;
  readonly creditDebit: "debit" | "credit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  /** The qualifying-capital tier this leg's own-funds account belongs to. */
  readonly capitalTier: FilCapitalTier;
  /** The own-funds sub-category (CAP definition of capital component). */
  readonly capitalSubCategory: FilCapitalSubCategory;
}

// ---------------------------------------------------------------------------
// Capital V2 posting-rule ids.
// ---------------------------------------------------------------------------

export const CAPITAL_POSTING_RULE_IDS = {
  issuance: "PR-CAP-ISSUE-001-V2",
  adjustment: "PR-CAP-ADJUST-002-V2",
  redemption: "PR-CAP-REDEEM-003-V2",
} as const;

const CAPITAL_IAS_RULES = {
  issuance:
    "IAS 32 §22 (CET1 equity at proceeds) / IFRS 9 §4.2.1 (AT1/T2 liability amortised cost) — own-funds recognition on issuance",
  redemption:
    "IAS 32 §33 (own equity derecognition) / IFRS 9 §3.3.1 (liability extinguishment) — own-funds derecognition on redemption/call/maturity",
} as const;

// ---------------------------------------------------------------------------
// Own-funds account resolution — the qualifying-capital sub-category selects the
// canonical CoA own-funds account. FAIL-CLOSED: an unmapped sub-category throws
// (no silent suspense default — Charter cmd 2). The mapping is asserted against
// the CoA `capitalTier` / `capitalSubCategory` fields so a drift between this map
// and the chart of accounts is caught at fold time (and by the recon gate).
// ---------------------------------------------------------------------------

const OWN_FUNDS_ACCOUNT_BY_SUBCATEGORY: Readonly<Record<FilCapitalSubCategory, string>> = {
  "cet1.paid-up-ordinary-shares": "ACC-5000-001", // Share Capital
  "cet1.share-premium": "ACC-5000-003", // Share Premium
  "cet1.retained-earnings": "ACC-5000-002", // Retained Earnings
  "cet1.oci-reserve": "ACC-5000-004", // Accumulated OCI Reserve — CET1
  "at1.perpetual-noncumulative": "ACC-5050-001", // AT1 instruments
  "t2.subordinated-debt": "ACC-5200-001", // Subordinated Debt — Tier 2
  "t2.qualifying-general-provisions": "ACC-5200-002", // General Provisions — Tier 2
};

/**
 * Resolve the own-funds CoA account for a qualifying-capital block, fail-closed.
 * Verifies (a) the tier↔sub-category coherence, (b) the sub-category maps to an
 * account, and (c) the resolved account's CoA `capitalTier` / `capitalSubCategory`
 * agree with the instance — so the posting code and the chart of accounts can
 * never silently disagree.
 */
export function resolveOwnFundsAccount(qc: FilQualifyingCapital): string {
  if (!capitalSubCategoryMatchesTier(qc.tier, qc.subCategory)) {
    throw new Error(
      `capital posting: qualifying-capital tier ${qc.tier} does not match sub-category ${qc.subCategory} (fail-closed — D-CAPITAL-ASSET-CLASS-V1)`,
    );
  }
  const accountId = OWN_FUNDS_ACCOUNT_BY_SUBCATEGORY[qc.subCategory];
  if (accountId === undefined) {
    throw new Error(
      `capital posting: no own-funds account mapped for sub-category ${qc.subCategory} (fail-closed)`,
    );
  }
  const coa = COA_BY_ID.get(accountId);
  if (coa === undefined) {
    throw new Error(`capital posting: own-funds account ${accountId} not in chart of accounts`);
  }
  if (coa.capitalTier !== qc.tier || coa.capitalSubCategory !== qc.subCategory) {
    throw new Error(
      `capital posting: CoA account ${accountId} (tier ${String(coa.capitalTier)} / ${String(
        coa.capitalSubCategory,
      )}) disagrees with instance (tier ${qc.tier} / ${qc.subCategory}) — fail-closed`,
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Settlement-cash account resolution — the proceeds leg. The cash side of a
// capital raise / redemption settles through the bank's correspondent nostro for
// the currency. Fail-closed to the FX settlement suspense is NOT used here (a
// capital raise is not an FX trade); an unmapped currency throws so the cash leg
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
      `capital posting: no settlement-cash (nostro) account mapped for currency ${currency} (fail-closed — D-CAPITAL-ASSET-CLASS-V1)`,
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

/** Extract the qualifying-capital block, fail-closed (a capital instance MUST carry it). */
function requireQualifyingCapital(
  payload: FilInstrumentCreatedPayload,
  context: string,
): FilQualifyingCapital {
  const qc = payload.economicTerms.qualifyingCapital;
  if (qc === undefined) {
    throw new Error(
      `capital posting (${context}): capital FIL instance carries no economicTerms.qualifyingCapital — cannot resolve the own-funds tier (fail-closed — D-CAPITAL-ASSET-CLASS-V1)`,
    );
  }
  return qc;
}

// ---------------------------------------------------------------------------
// PR-CAP-ISSUE-001-V2 — Own-funds recognition on issuance (FilInstrumentCreated).
// Dr settlement-cash (proceeds) / Cr own-funds account (per qualifying tier).
// IAS 32 §22 (CET1 equity) / IFRS 9 §4.2.1 (AT1/T2 liability).
// ---------------------------------------------------------------------------

export function postCapitalIssuanceLegs(payload: FilInstrumentCreatedPayload): CapitalPostingLeg[] {
  const t = payload.economicTerms;
  const qc = requireQualifyingCapital(payload, "issuance");
  const ownFundsAccount = resolveOwnFundsAccount(qc);
  const settlementCashAccount = resolveSettlementCashAccount(t.notional.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = CAPITAL_IAS_RULES.issuance;
  const postingRuleId = CAPITAL_POSTING_RULE_IDS.issuance;
  const description = `Capital issuance ${qc.tier.toUpperCase()} ${qc.subCategory} ${t.notional.currency} (V2)`;

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
      capitalTier: qc.tier,
      capitalSubCategory: qc.subCategory,
    },
    {
      creditDebit: "credit",
      accountCode: ownFundsAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      capitalTier: qc.tier,
      capitalSubCategory: qc.subCategory,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-CAP-REDEEM-003-V2 — Own-funds derecognition on redemption / call / maturity
// / cancellation (FilInstrumentTerminated). FilInstrumentTerminated carries NO
// economic terms (no notional), so a bare terminal posts a ZERO-AMOUNT memo
// (Dr/Cr the same own-funds account at 0), byte-symmetric with the FX-close memo.
//
// SUBSTRATE GAP (tracked, NOT a silent omission — D-CAPITAL-ASSET-CLASS-V1): a
// proper redemption reverses the prior recognition using the prior notional +
// tier from the Created event; the redemption-proceeds cash leg and any
// premium/discount on early call require economic terms FilInstrumentTerminated
// does not carry. This refinement is recorded as a ProductDeferredGap-class note
// pending a richer FIL terminal event (mirrors the FX PR-FX-CLOSE-V2 history).
// The bare-terminal memo is intentionally tier-agnostic (`cet1.paid-up-ordinary-
// shares` is the documented placeholder) and posts zero, so it neither over- nor
// under-states any tier in the composition.
// ---------------------------------------------------------------------------

export function postCapitalRedemptionLegs(
  payload: FilInstrumentTerminatedPayload,
): CapitalPostingLeg[] {
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = CAPITAL_IAS_RULES.redemption;
  const postingRuleId = CAPITAL_POSTING_RULE_IDS.redemption;
  const description = `Capital derecognition ${payload.terminalStage} (V2 memo — proceeds deferred gap)`;
  // Zero-amount memo in ZAR; tier-agnostic placeholder (posts nothing).
  const zeroAmount: MoneyWire = { __money: "v1" as const, currency: "ZAR", amount: "0" };
  const placeholderAccount = "ACC-5000-001";

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
      capitalTier: "cet1",
      capitalSubCategory: "cet1.paid-up-ordinary-shares",
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
      capitalTier: "cet1",
      capitalSubCategory: "cet1.paid-up-ordinary-shares",
    },
  ];
}
