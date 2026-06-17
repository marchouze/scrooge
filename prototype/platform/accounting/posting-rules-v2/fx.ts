// platform/accounting/posting-rules-v2/fx.ts
//
// LIFTED FX posting rules — the PURE `payload → leg(s)` core of the FX V2 GL
// posting rules, extracted from `gl-posting-engine-v2.ts` so the FX trial
// balance can be computed as a PURE FOLD over the primary FIL instance events
// (FilInstrumentCreated / FilInstrumentAmended / FilInstrumentTerminated) —
// WITHOUT a stored `GlPostingEmitted` event in the FX read path.
//
// WHY THIS EXISTS (D-DERIVED-EVENT-IRREDUCIBILITY-TEST)
// ----------------------------------------------------
// `GlPostingEmitted` is a DERIVED event: every FX leg it carries is a pure
// function of the primary FIL lifecycle event (the FX posting rule). The
// irreducibility test says a derived event that the fold can reproduce from
// primaries adds nothing the log doesn't already hold — so the FX read path
// folds the FIL events through these lifted rules in memory, and the stored
// `GlPostingEmitted` is no longer the FX source of truth.
//
// BYTE-EQUIVALENCE INVARIANT
// --------------------------
// These functions are the EXACT leg logic that `gl-posting-engine-v2.ts`'s
// `postFxInitialRecognition` / `postFxRevaluation` / `postFxClose` apply today
// (same `resolveFxAccountSet`, same direction handling, same posting-date
// derivation `payload.asOf.substring(0,10)`, same PR-FX-CLOSE-V2 zero-amount
// memo). The only difference is the RETURN TYPE: these return plain in-memory
// `FxPostingLeg`s instead of appending `GlPostingEmitted` events. The
// `recon:gl-v2-fold-equivalence-fx` gate proves the in-memory legs reproduce the
// engine-emitted legs byte-for-byte.
//
// SCOPE: FX ONLY. Bond / money-market / capital posting rules are untouched and
// still emit `GlPostingEmitted`; the trial-balance fold keeps serving those from
// the stored event (brief §"CRITICAL SCOPING").
//
// FOLLOW-UP (flagged, NOT applied here): PR-FX-CLOSE-V2 posts a zero-amount memo
// because `FilInstrumentTerminated` carries no economic terms — a proper
// derecognition needs the prior Created/Amended notional. Applying that fix
// would change the legs and break byte-equivalence with today, so it is a
// SEPARATE follow-up (see `gl-posting-engine-v2.ts` PR-FX-CLOSE-V2 note).
//
// PACKAGE BOUNDARY: this file is on the v1 side (`platform/`) so it MAY import
// from `v2-core/` (the permitted v1→v2 direction). v2-core never reaches here.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Principle 1; Principle 2.
// Author: Atlas (Substrate Architect, engineering).

import { ANCHOR_TENANT_ID, type TenantId } from "../../../v2-core/control-plane/tenant";
import type {
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import type { MoneyWire } from "../../core/money-codec";

// ---------------------------------------------------------------------------
// FX type taxonomy guard — `fil:type:fx:*`.
// ---------------------------------------------------------------------------

export const FX_TYPE_PREFIX = "fil:type:fx:";

/** True iff the FIL taxonomy type URN names an FX instrument. */
export function isFxInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(FX_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// In-memory FX posting leg — the pure-fold analogue of one GlPostingEmitted
// leg. Carries exactly the fields the trial-balance / entries / accounts folds
// read off a GlPostingEmitted payload, so the fold path is identical.
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
// Versioned FX rule selection (lightweight, brief step 2).
//
// The FX rule is selected by (trigger kind, fx asset-class) at the rule version
// in force at the instance `asOf`. There is exactly ONE version (v1.0) of each
// FX V2 posting rule today, so the lattice is a single row per trigger; the
// structure is here so a future amended rule version slots in by `asOf` without
// touching the fold. The `ruleId` cross-references the `PR-FX-*-V2` ids declared
// alongside the posting-rule registry and consumed by the FX treatment module
// (`v2-core/reporting-treatments/fx-modules.ts` `FX_V2_POSTING_RULE_IDS`).
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
  /** Inclusive `asOf` lower bound this rule version is in force from (ISO date). */
  readonly inForceFrom: string;
}

/**
 * The FX rule version lattice keyed by trigger kind. Each trigger has the
 * versions known for the FX asset class, ordered newest-first. `selectFxRule`
 * picks the newest version whose `inForceFrom <= asOf`.
 */
const FX_RULE_VERSIONS: Readonly<Record<FxTriggerKind, readonly FxRuleVersion[]>> = {
  FilInstrumentCreated: [
    { ruleId: FX_POSTING_RULE_IDS.initialRecognition, inForceFrom: "0000-01-01" },
  ],
  FilInstrumentAmended: [{ ruleId: FX_POSTING_RULE_IDS.revaluation, inForceFrom: "0000-01-01" }],
  FilInstrumentTerminated: [{ ruleId: FX_POSTING_RULE_IDS.close, inForceFrom: "0000-01-01" }],
};

/**
 * Select the FX posting-rule id in force for `triggerKind` at `asOf`. Fail-closed:
 * if no version is in force at `asOf` (would only happen for a future-dated rule
 * lattice), returns `undefined` rather than silently picking a default.
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
// Lifted verbatim so the legs are byte-identical. Fail-closed to the FX
// unresolved-currency suspense (ACC-2100-007) for unsupported currencies.
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
// IDENTICAL to gl-posting-engine-v2.toMoneyWire.
// ---------------------------------------------------------------------------

function toMoneyWire(money: { currency: string; amount: string }): MoneyWire {
  return { __money: "v1" as const, currency: money.currency, amount: money.amount };
}

const FX_IAS_RULES = {
  initialRecognition: "IFRS 9 §3.1.1 — recognition on trade date",
  revaluation: "IFRS 9 §5.7.1 — FVTPL revaluation",
  close: "IFRS 9 §3.2.3 — derecognition on settlement/cancellation",
} as const;

// ---------------------------------------------------------------------------
// PR-FX-001-V2 — Initial recognition at trade date (FilInstrumentCreated, FX).
// IFRS 9 §3.1.1. Long: Dr receivable / Cr payable. Short: Dr payable / Cr
// receivable. IDENTICAL to gl-posting-engine-v2.postFxInitialRecognition.
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
// PR-FX-REVAL-V2 — FVTPL revaluation (FilInstrumentAmended, FX).
// IFRS 9 §5.7.1. Dr receivable / Cr unrealised P&L on the (advisory) full
// notional basis. IDENTICAL to gl-posting-engine-v2.postFxRevaluation.
// ---------------------------------------------------------------------------

export function postFxRevaluationLegs(payload: FilInstrumentAmendedPayload): FxPostingLeg[] {
  const t = payload.economicTerms;
  const accounts = resolveFxAccountSet(t.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = FX_IAS_RULES.revaluation;
  const postingRuleId = FX_POSTING_RULE_IDS.revaluation;
  const description = `FX Revaluation ${t.currency} (V2 advisory)`;

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
      accountCode: accounts.unrealisedPnl,
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
// so this posts a ZERO-AMOUNT memo (Dr/Cr ACC-2100-005 ZAR 0), identical to
// gl-posting-engine-v2.postFxClose.
//
// FOLLOW-UP (flagged, NOT applied — would break byte-equivalence): a proper
// derecognition reverses the prior recognition using the prior notional read
// from the Created/Amended events. See the engine's PR-FX-CLOSE-V2 note.
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
