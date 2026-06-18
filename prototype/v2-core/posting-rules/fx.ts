// v2-core/posting-rules/fx.ts
//
// LIFTED FX posting rules — the PURE `payload → leg(s)` core of the FX V2 GL
// posting rules. Relocated into the canonical `v2-core/posting-rules/` spine
// (WS-ACCT-FX-COMPLETENESS Slice 2, D-ACCT-SCHEMA-CANONICAL-HOME) from
// `platform/accounting/posting-rules-v2/fx.ts`, which is now a re-export shim.
//
// These functions let the FX trial balance be computed as a PURE FOLD over the
// primary FIL instance events (FilInstrumentCreated / FilInstrumentAmended /
// FilInstrumentTerminated) WITHOUT a stored `GlPostingEmitted` event in the FX
// read path (D-DERIVED-EVENT-IRREDUCIBILITY-TEST). The
// `recon:gl-v2-fold-equivalence-fx` gate proves the in-memory legs reproduce the
// engine-emitted legs byte-for-byte.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY from other
// `v2-core/` modules (control-plane tenant, fil-instances events, core money-
// wire); NO imports from `platform/` (enforced by `recon:v2-no-v1-import`). The
// `MoneyWire` shape is the canonical `v2-core/core/money-wire.MoneyWire`
// (structurally identical to the platform re-export the engine uses).
//
// SCOPE: FX ONLY. Bond / money-market / capital posting rules still emit
// `GlPostingEmitted` and the trial-balance fold serves those from the stored
// event.
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS. Principle 1; Principle 2.
// Author: Atlas (Substrate Architect) + Bea (Accounting & financial reporting engineer).

import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { MoneyWire } from "../core/money-wire";
import type {
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../fil-instances/events";

// ---------------------------------------------------------------------------
// FX type taxonomy guard — `fil:type:fx:*`.
// ---------------------------------------------------------------------------

export const FX_TYPE_PREFIX = "fil:type:fx:";

/** True iff the FIL taxonomy type URN names an FX instrument. */
export function isFxInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(FX_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// In-memory FX posting leg — the pure-fold analogue of one GlPostingEmitted leg.
// ---------------------------------------------------------------------------

export interface FxPostingLeg {
  readonly accountCode: string;
  readonly creditDebit: "debit" | "credit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Versioned FX rule selection.
// ---------------------------------------------------------------------------

/** The FX V2 posting-rule ids (mirrors fx-modules.FX_V2_POSTING_RULE_IDS). */
export const FX_POSTING_RULE_IDS = {
  initialRecognition: "PR-FX-001-V2",
  revaluation: "PR-FX-REVAL-V2",
  close: "PR-FX-CLOSE-V2",
} as const;

type FxTriggerKind = "FilInstrumentCreated" | "FilInstrumentAmended" | "FilInstrumentTerminated";

interface FxRuleVersion {
  readonly ruleId: string;
  readonly inForceFrom: string;
}

const FX_RULE_VERSIONS: Readonly<Record<FxTriggerKind, readonly FxRuleVersion[]>> = {
  FilInstrumentCreated: [
    { ruleId: FX_POSTING_RULE_IDS.initialRecognition, inForceFrom: "0000-01-01" },
  ],
  FilInstrumentAmended: [{ ruleId: FX_POSTING_RULE_IDS.revaluation, inForceFrom: "0000-01-01" }],
  FilInstrumentTerminated: [{ ruleId: FX_POSTING_RULE_IDS.close, inForceFrom: "0000-01-01" }],
};

/**
 * Select the FX posting-rule id in force for `triggerKind` at `asOf`. Fail-closed:
 * returns `undefined` rather than silently picking a default if no version is in
 * force at `asOf`.
 */
export function selectFxRule(triggerKind: FxTriggerKind, asOf: string): string | undefined {
  const day = asOf.substring(0, 10);
  const versions = FX_RULE_VERSIONS[triggerKind];
  let selected: FxRuleVersion | undefined;
  for (const v of versions) {
    if (v.inForceFrom <= day) {
      if (selected === undefined || v.inForceFrom > selected.inForceFrom) selected = v;
    }
  }
  return selected?.ruleId;
}

// ---------------------------------------------------------------------------
// COA account resolution — IDENTICAL to gl-posting-engine-v2.resolveFxAccountSet.
// Fail-closed to the FX unresolved-currency suspense (ACC-2100-007).
// ---------------------------------------------------------------------------

export interface FxAccountSet {
  readonly receivable: string;
  readonly payable: string;
  readonly unrealisedPnl: string;
  readonly realisedPnl: string;
}

export function resolveFxAccountSet(currency: string): FxAccountSet {
  switch (currency) {
    case "ZAR":
      return {
        receivable: "ACC-2100-001",
        payable: "ACC-2100-003",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
    case "USD":
      return {
        receivable: "ACC-2100-002",
        payable: "ACC-2100-004",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
    case "GBP":
      return {
        receivable: "ACC-2100-010",
        payable: "ACC-2100-011",
        unrealisedPnl: "ACC-2100-012",
        realisedPnl: "ACC-2100-006",
      };
    case "EUR":
      return {
        receivable: "ACC-2100-013",
        payable: "ACC-2100-014",
        unrealisedPnl: "ACC-2100-015",
        realisedPnl: "ACC-2100-006",
      };
    case "CHF":
      return {
        receivable: "ACC-2100-016",
        payable: "ACC-2100-017",
        unrealisedPnl: "ACC-2100-018",
        realisedPnl: "ACC-2100-006",
      };
    case "AUD":
      return {
        receivable: "ACC-2100-019",
        payable: "ACC-2100-020",
        unrealisedPnl: "ACC-2100-021",
        realisedPnl: "ACC-2100-006",
      };
    case "JPY":
      return {
        receivable: "ACC-2100-022",
        payable: "ACC-2100-023",
        unrealisedPnl: "ACC-2100-024",
        realisedPnl: "ACC-2100-006",
      };
    default:
      return {
        receivable: "ACC-2100-007",
        payable: "ACC-2100-007",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
  }
}

// ---------------------------------------------------------------------------
// Encoding helper — v2-core Money { currency, amount } → MoneyWire.
// ---------------------------------------------------------------------------

function toMoneyWire(money: { currency: string; amount: string }): MoneyWire {
  return { __money: "v1" as const, currency: money.currency, amount: money.amount };
}

const FX_IAS_RULES = {
  initialRecognition: "IFRS 9 §3.1.1 — recognition on trade date",
  revaluation: "IFRS 9 §5.7.1 — FVTPL revaluation",
  revaluationFvoci: "IFRS 9 §5.7.5 — FVOCI election: fair-value movement to OCI",
  close: "IFRS 9 §3.2.3 — derecognition on settlement/cancellation",
} as const;

/** OCI reserve account a per-instrument FVOCI election (IFRS 9 §5.7.5) routes the
 * fair-value movement to, INSTEAD of the FVTPL unrealised-P&L account. */
export const FX_FVOCI_OCI_RESERVE_ACCOUNT = "ACC-2100-008";

/**
 * A resolved per-instance accounting election that overrides the product-default
 * treatment for ONE facet (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). `undefined`
 * (the default) means NO election → product default → byte-identical to the
 * engine's leg output (the golden reference).
 */
export interface FxElectionOverride {
  /** Elected IFRS classification, e.g. `"fvoci"`. */
  readonly ifrsCategory?: "fvtpl" | "fvoci" | "amortised-cost";
}

// ---------------------------------------------------------------------------
// PR-FX-001-V2 — Initial recognition at trade date (FilInstrumentCreated, FX).
// IFRS 9 §3.1.1.
// ---------------------------------------------------------------------------

export function postFxInitialRecognitionLegs(payload: FilInstrumentCreatedPayload): FxPostingLeg[] {
  const t = payload.economicTerms;
  const accounts = resolveFxAccountSet(t.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = FX_IAS_RULES.initialRecognition;
  const postingRuleId = FX_POSTING_RULE_IDS.initialRecognition;
  const description = `FX Initial Recognition ${t.currency} ${t.direction} (V2)`;

  const debitAccount = t.direction === "long" ? accounts.receivable : accounts.payable;
  const creditAccount = t.direction === "long" ? accounts.payable : accounts.receivable;

  return [
    {
      creditDebit: "debit",
      accountCode: debitAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: "credit",
      accountCode: creditAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-REVAL-V2 — FVTPL revaluation (FilInstrumentAmended, FX). IFRS 9 §5.7.1.
// FVOCI election (IFRS 9 §5.7.5) routes the credit leg to the OCI reserve.
// ---------------------------------------------------------------------------

export function postFxRevaluationLegs(
  payload: FilInstrumentAmendedPayload,
  election?: FxElectionOverride,
): FxPostingLeg[] {
  const t = payload.economicTerms;
  const accounts = resolveFxAccountSet(t.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const postingRuleId = FX_POSTING_RULE_IDS.revaluation;

  const isFvoci = election?.ifrsCategory === "fvoci";
  const creditAccount = isFvoci ? FX_FVOCI_OCI_RESERVE_ACCOUNT : accounts.unrealisedPnl;
  const iasRule = isFvoci ? FX_IAS_RULES.revaluationFvoci : FX_IAS_RULES.revaluation;
  const description = isFvoci
    ? `FX Revaluation ${t.currency} (V2 FVOCI election, OCI)`
    : `FX Revaluation ${t.currency} (V2 advisory)`;

  return [
    {
      creditDebit: "debit",
      accountCode: accounts.receivable,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: "credit",
      accountCode: creditAccount,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-CLOSE-V2 — Derecognition on settlement/cancellation
// (FilInstrumentTerminated). FilInstrumentTerminated carries NO economic terms,
// so this posts a ZERO-AMOUNT memo (Dr/Cr ACC-2100-005 ZAR 0), byte-identical to
// gl-posting-engine-v2.postFxClose.
//
// SUBSTRATE GAP (tracked, NOT a silent omission — D-ACCT-FX-IFRS-POSTING-
// COMPLETENESS): a proper derecognition reverses the prior recognition using the
// prior notional from the Created/Amended events; settlement realised-P&L,
// swap-leg, NDF-fixing and FVOCI→P&L reclassification all require economic terms
// FilInstrumentTerminated does not carry. These refinements are recorded as
// ProductDeferredGaps (see fx.ts FX_DEFERRED_POSTING_GAPS) pending a richer FIL
// terminal event.
// ---------------------------------------------------------------------------

export function postFxCloseLegs(payload: FilInstrumentTerminatedPayload): FxPostingLeg[] {
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = FX_IAS_RULES.close;
  const postingRuleId = FX_POSTING_RULE_IDS.close;
  const description = `FX Derecognition ${payload.terminalStage} (V2 advisory)`;
  const zeroAmount: MoneyWire = { __money: "v1" as const, currency: "ZAR", amount: "0" };

  return [
    {
      creditDebit: "debit",
      accountCode: "ACC-2100-005",
      amount: zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: "credit",
      accountCode: "ACC-2100-005",
      amount: zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
  ];
}
