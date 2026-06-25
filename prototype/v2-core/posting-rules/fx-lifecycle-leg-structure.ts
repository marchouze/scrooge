// v2-core/posting-rules/fx-lifecycle-leg-structure.ts
//
// The CITED, DECLARATIVE leg-STRUCTURE of the FX V2 GL posting rules, grouped by
// the SAME four contractual-settlement lifecycle stages the NPA "How it works"
// tab renders (a Initiation · b Payment · c Receipt · d Termination) plus daily
// revaluation. For the Accounting / CFO perspective (WS-NPA-PERSPECTIVE-IA
// Slice 2): "what GL postings fire at each lifecycle stage, with the IFRS/IAS
// basis".
//
// WHAT THIS IS — and is NOT
// -------------------------
// This module declares, per FX posting rule, the ORDERED list of Dr/Cr legs by
// ACCOUNT ROLE (receivable / payable / unrealised-pnl / realised-pnl / oci-reserve
// / nostro) + direction + IAS/IFRS citation. It is the STRUCTURE only — NO amounts.
// Amounts are folded at runtime by the pure `postFx*Legs` functions (fx.ts /
// fx-settlement.ts); this declaration mirrors THOSE functions' leg shape so the
// page shows the same Dr/Cr structure the engine posts, account-role for
// account-role, WITHOUT inventing a single figure.
//
// Each entry is CITED to the rule function it mirrors (`derivedFrom`), so the
// claim "PR-FX-001-V2 debits the receivable and credits the payable" traces to
// `postFxInitialRecognitionLegs`. The account ROLES resolve to concrete CoA codes
// at render time via `resolveFxAccountSet(currency)` + the two named-constant
// accounts (`FX_FVOCI_OCI_RESERVE_ACCOUNT`, the nostro per `nostroFor`); the
// codes then resolve to CoA NAMES via `COA_BY_ID`. The de-invention gate
// (`recon:npa-page-no-invented-functionality`) asserts every resolved code is a
// real CoA account and every rule id a real registry entry.
//
// STAGE MAPPING (the four contractual-settlement stages + daily reval):
//   a Initiation        — PR-FX-001-V2 (FilInstrumentCreated): trade-date recognition.
//   revaluation (daily) — PR-FX-REVAL-V2 (FilInstrumentAmended): FVTPL mark-to-market.
//   b Payment           — PR-FX-SETTLE-V2 / PR-FX-SWAP-NEAR-V2 (pay leg of settlement).
//   c Receipt           — PR-FX-SETTLE-V2 / PR-FX-SWAP-FAR-V2 / PR-FX-NDF-FIX-V2 (receive / cash-settle).
//   d Termination       — PR-FX-CLOSE-V2 / PR-FX-FVOCI-RECLASS-V2 (derecognition).
// A rule that settles BOTH the pay and receive movements (PR-FX-SETTLE-V2)
// appears under both Payment and Receipt with the leg subset for that movement.
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports only other v2-core posting-rule
// modules. Pure standing data; empty-store-safe.
//
// Authority: D-V2-UI-OVERSIGHT-STANDARD; D-NPA-PAGE-DE-INVENTION;
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS; D-ACCT-SCHEMA-CANONICAL-HOME;
//   D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL. Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { FX_FVOCI_OCI_RESERVE_ACCOUNT, type FxAccountSet, resolveFxAccountSet } from "./fx";
import { FX_SETTLEMENT_CLEARING_ACCOUNT, nostroFor } from "./fx-settlement";

// ---------------------------------------------------------------------------
// Account roles — the symbolic role each leg posts to. Resolved to a concrete
// CoA code for the product's currency at render time (no hardcoded codes here).
// ---------------------------------------------------------------------------

/** The FX-posting account roles the rules touch (each resolves to a real CoA code). */
export type FxAccountRole =
  | "receivable"
  | "payable"
  | "unrealised-pnl"
  | "realised-pnl"
  | "oci-reserve"
  | "nostro"
  | "settlement-clearing";

/** Human label per account role (small tag on the page). */
export const FX_ACCOUNT_ROLE_LABEL: Readonly<Record<FxAccountRole, string>> = {
  receivable: "FX trading receivable",
  payable: "FX trading payable",
  "unrealised-pnl": "Unrealised FX P&L (FVTPL)",
  "realised-pnl": "Realised FX P&L",
  "oci-reserve": "OCI reserve (FVOCI election)",
  nostro: "Cash / nostro",
  "settlement-clearing": "FX settlement clearing (P&L-neutral)",
};

/**
 * Resolve an account role to its concrete CoA account code for a currency.
 * Mirrors EXACTLY how the pure rule functions pick accounts: the receivable /
 * payable / unrealised-pnl / realised-pnl come from `resolveFxAccountSet`; the
 * OCI reserve + the settlement clearing are named constants; the nostro is
 * `nostroFor`. Source, don't duplicate (Charter cmd 4).
 */
export function resolveFxAccountRole(role: FxAccountRole, currency: string): string {
  const set: FxAccountSet = resolveFxAccountSet(currency);
  switch (role) {
    case "receivable":
      return set.receivable;
    case "payable":
      return set.payable;
    case "unrealised-pnl":
      return set.unrealisedPnl;
    case "realised-pnl":
      return set.realisedPnl;
    case "oci-reserve":
      return FX_FVOCI_OCI_RESERVE_ACCOUNT;
    case "nostro":
      return nostroFor(currency);
    case "settlement-clearing":
      return FX_SETTLEMENT_CLEARING_ACCOUNT;
  }
}

// ---------------------------------------------------------------------------
// Leg-structure declaration types.
// ---------------------------------------------------------------------------

/** One Dr/Cr leg of a posting rule, by account ROLE (structure, never an amount). */
export interface FxRuleLegStructure {
  readonly accountRole: FxAccountRole;
  readonly drCr: "debit" | "credit";
  /** IAS / IFRS citation backing this leg. */
  readonly iasCite: string;
  /** What the leg IS, in plain terms (no amount). */
  readonly note: string;
}

/** The lifecycle stage a posting rule fires in — aligned to the How-it-works tab. */
export type FxLifecycleStageId = "a" | "revaluation" | "b" | "c" | "d";

/** A posting rule's leg structure, scoped to one lifecycle stage. */
export interface FxRuleStageLegStructure {
  /** Registry posting-rule id (resolves to POSTING_RULE_REGISTRY). */
  readonly postingRuleId: string;
  /** The lifecycle stage this firing belongs to. */
  readonly stage: FxLifecycleStageId;
  /** When the posting is expected (mirrors the registry `condition`). */
  readonly condition: string;
  /** The ordered Dr/Cr legs by account role. */
  readonly legs: readonly FxRuleLegStructure[];
  /** The rule function(s) this structure is mirrored from — traceability. */
  readonly derivedFrom: string;
  /** Citations backing the rule overall. */
  readonly citations: readonly string[];
}

const FX_TS = "v2-core/posting-rules/fx.ts";
const FX_SETTLEMENT_TS = "v2-core/posting-rules/fx-settlement.ts";

const IAS = {
  initial: "IFRS 9 §3.1.1",
  revalFvtpl: "IFRS 9 §5.7.1",
  revalFvoci: "IFRS 9 §5.7.5",
  settleCash: "IAS 21 §23",
  settlePnl: "IAS 21 §28",
  ndf: "IFRS 9 §5.7.1 / IAS 21 §28",
  derecognise: "IFRS 9 §3.2.3",
  fvociReclass: "IFRS 9 §5.7.10–11",
} as const;

const D_COMPLETE = "D-ACCT-FX-IFRS-POSTING-COMPLETENESS";
const D_PNL_FCY = "D-FX-PNL-FCY-EXPOSURE-REVALUATION";

// ---------------------------------------------------------------------------
// The declaration. Each entry mirrors a pure `postFx*Legs` function leg-for-leg.
// ---------------------------------------------------------------------------

export const FX_RULE_STAGE_LEG_STRUCTURES: readonly FxRuleStageLegStructure[] = [
  // ── a · Initiation — PR-FX-001-V2 (postFxInitialRecognitionLegs) ──────────
  // Long: Dr receivable / Cr payable (short reverses). At inception the
  // derivative fair value ≈ 0, so the two legs are equal-and-opposite.
  {
    postingRuleId: "PR-FX-001-V2",
    stage: "a",
    condition: "always",
    legs: [
      {
        accountRole: "receivable",
        drCr: "debit",
        iasCite: IAS.initial,
        note: "Recognise the bought-leg receivable at the booked rate (long; short reverses).",
      },
      {
        accountRole: "payable",
        drCr: "credit",
        iasCite: IAS.initial,
        note: "Recognise the sold-leg payable at the booked rate (long; short reverses).",
      },
    ],
    derivedFrom: `${FX_TS} · postFxInitialRecognitionLegs`,
    citations: [IAS.initial, D_COMPLETE],
  },

  // ── revaluation (daily) — PR-FX-REVAL-V2 (postFxRevaluationLegs) ──────────
  // FVTPL: Dr receivable / Cr unrealised P&L. FVOCI election routes the credit
  // leg to the OCI reserve instead of P&L (the alternate leg shown as a note).
  {
    postingRuleId: "PR-FX-REVAL-V2",
    stage: "revaluation",
    condition: "non-zero-delta",
    legs: [
      {
        accountRole: "receivable",
        drCr: "debit",
        iasCite: IAS.revalFvtpl,
        note: "Mark the position to the closing rate (the fair-value movement).",
      },
      {
        accountRole: "unrealised-pnl",
        drCr: "credit",
        iasCite: IAS.revalFvtpl,
        note: "FVTPL: the fair-value change hits P&L each day. (FVOCI election routes this leg to the OCI reserve instead — IFRS 9 §5.7.5.)",
      },
    ],
    derivedFrom: `${FX_TS} · postFxRevaluationLegs`,
    citations: [IAS.revalFvtpl, IAS.revalFvoci, D_COMPLETE],
  },

  // ── b · Payment — PR-FX-SETTLE-V2 (pay movement) ──────────────────────────
  // P&L-NEUTRAL settlement (D-FX-PNL-FCY-EXPOSURE-REVALUATION): the sold-leg cash is
  // delivered — Cr nostro (cash paid) / Dr settlement clearing. NO realised P&L
  // (settlement is a change of form, not a realisation) and NO payable touched.
  {
    postingRuleId: "PR-FX-SETTLE-V2",
    stage: "b",
    condition: "always",
    legs: [
      {
        accountRole: "nostro",
        drCr: "credit",
        iasCite: IAS.settleCash,
        note: "Cash paid at the settlement rate (sold-leg cash leaves the nostro).",
      },
      {
        accountRole: "settlement-clearing",
        drCr: "debit",
        iasCite: IAS.settleCash,
        note: "FX settlement clearing — the P&L-neutral contra to the paid cash (no realised P&L; settlement is a change of form).",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxSettlementLegs (pay movement)`,
    citations: [IAS.settleCash, D_PNL_FCY, D_COMPLETE],
  },

  // ── b · Payment — PR-FX-SWAP-NEAR-V2 (near-leg settlement) ────────────────
  {
    postingRuleId: "PR-FX-SWAP-NEAR-V2",
    stage: "b",
    condition: "always",
    legs: [
      {
        accountRole: "nostro",
        drCr: "credit",
        iasCite: IAS.settleCash,
        note: "FX swap near-leg cash movement at the settlement rate.",
      },
      {
        accountRole: "settlement-clearing",
        drCr: "debit",
        iasCite: IAS.settleCash,
        note: "FX settlement clearing — P&L-neutral contra to the near-leg cash.",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxSwapNearLegLegs`,
    citations: [IAS.settleCash, D_PNL_FCY, D_COMPLETE],
  },

  // ── c · Receipt — PR-FX-SETTLE-V2 (receive movement) ──────────────────────
  // P&L-NEUTRAL settlement (D-FX-PNL-FCY-EXPOSURE-REVALUATION): the bought-leg cash
  // is received — Dr nostro (cash in) / Cr settlement clearing. NO realised P&L and
  // NO receivable touched; the FCY cash is then carried at its ZAR cost basis and
  // revalued daily exactly like the open contract.
  {
    postingRuleId: "PR-FX-SETTLE-V2",
    stage: "c",
    condition: "always",
    legs: [
      {
        accountRole: "nostro",
        drCr: "debit",
        iasCite: IAS.settleCash,
        note: "Cash received at the settlement rate (bought-leg cash enters the nostro).",
      },
      {
        accountRole: "settlement-clearing",
        drCr: "credit",
        iasCite: IAS.settleCash,
        note: "FX settlement clearing — the P&L-neutral contra to the received cash (no realised P&L; the exposure stays open as FCY cash).",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxSettlementLegs (receive movement)`,
    citations: [IAS.settleCash, D_PNL_FCY, D_COMPLETE],
  },

  // ── c · Receipt — PR-FX-SWAP-FAR-V2 (far-leg settlement; closes composite) ─
  {
    postingRuleId: "PR-FX-SWAP-FAR-V2",
    stage: "c",
    condition: "always",
    legs: [
      {
        accountRole: "nostro",
        drCr: "debit",
        iasCite: IAS.settleCash,
        note: "FX swap far-leg cash movement at the settlement rate; closes the composite.",
      },
      {
        accountRole: "settlement-clearing",
        drCr: "credit",
        iasCite: IAS.settleCash,
        note: "FX settlement clearing — P&L-neutral contra to the far-leg cash; closes the composite.",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxSwapFarLegLegs`,
    citations: [IAS.settleCash, D_PNL_FCY, D_COMPLETE],
  },

  // ── c · Receipt — PR-FX-NDF-FIX-V2 (cash-settled fixing; no principal) ─────
  {
    postingRuleId: "PR-FX-NDF-FIX-V2",
    stage: "c",
    condition: "non-zero-pnl",
    legs: [
      {
        accountRole: "nostro",
        drCr: "debit",
        iasCite: IAS.ndf,
        note: "NDF net cash difference settled in the settlement currency (no principal exchanges; sign per gain/loss).",
      },
      {
        accountRole: "realised-pnl",
        drCr: "credit",
        iasCite: IAS.ndf,
        note: "Realised P&L on the NDF fixing = notional × (fixing − contracted).",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxNdfFixingLegs`,
    citations: [IAS.ndf, D_COMPLETE],
  },

  // ── d · Termination — PR-FX-CLOSE-V2 (postFxDerecognitionLegs) ────────────
  // Reverse accumulated unrealised reval into realised P&L on derecognition.
  {
    postingRuleId: "PR-FX-CLOSE-V2",
    stage: "d",
    condition: "always",
    legs: [
      {
        accountRole: "unrealised-pnl",
        drCr: "debit",
        iasCite: IAS.derecognise,
        note: "Reverse the accumulated unrealised reval (gain sat as a credit; debit reverses it).",
      },
      {
        accountRole: "realised-pnl",
        drCr: "credit",
        iasCite: IAS.derecognise,
        note: "Recognise the realised result on derecognition (settlement / cancellation).",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxDerecognitionLegs`,
    citations: [IAS.derecognise, D_COMPLETE],
  },

  // ── d · Termination — PR-FX-FVOCI-RECLASS-V2 (postFxFvociReclassLegs) ─────
  // Recycle the accumulated FVOCI OCI reserve into P&L on derecognition.
  {
    postingRuleId: "PR-FX-FVOCI-RECLASS-V2",
    stage: "d",
    condition: "non-zero-pnl",
    legs: [
      {
        accountRole: "oci-reserve",
        drCr: "debit",
        iasCite: IAS.fvociReclass,
        note: "Recycle the accumulated FVOCI OCI reserve (reserve sat as a credit; debit recycles it).",
      },
      {
        accountRole: "realised-pnl",
        drCr: "credit",
        iasCite: IAS.fvociReclass,
        note: "Reclassify the recycled OCI into realised P&L on derecognition.",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxFvociReclassLegs`,
    citations: [IAS.fvociReclass, D_COMPLETE],
  },
];

// ---------------------------------------------------------------------------
// Stage ordering + labels for the page (the five GL-impact groups).
// ---------------------------------------------------------------------------

export interface FxLifecycleStageMeta {
  readonly id: FxLifecycleStageId;
  readonly label: string;
  /** One-line description of what fires at this stage, accounting-side. */
  readonly summary: string;
}

/** Ordered stage metadata — Initiation → Revaluation → Payment → Receipt → Termination. */
export const FX_GL_LIFECYCLE_STAGES: readonly FxLifecycleStageMeta[] = [
  {
    id: "a",
    label: "Initiation",
    summary: "Trade-date recognition — the receivable / payable legs are booked.",
  },
  {
    id: "revaluation",
    label: "Daily revaluation",
    summary:
      "FVTPL mark-to-market — the fair-value change hits P&L (or OCI under an FVOCI election).",
  },
  {
    id: "b",
    label: "Payment",
    summary:
      "Sold leg settles — cash leaves the nostro against FX settlement clearing. P&L-neutral: no realised P&L (settlement is a change of form).",
  },
  {
    id: "c",
    label: "Receipt",
    summary:
      "Bought leg settles — cash enters the nostro against FX settlement clearing. P&L-neutral: the FCY cash is carried at ZAR cost basis and revalued like the open contract.",
  },
  {
    id: "d",
    label: "Termination",
    summary:
      "Derecognition — accumulated unrealised reval (or OCI reserve) is recycled into realised P&L.",
  },
];

/** Whether the FX GL-impact-per-stage walkthrough applies to a product family (FX only). */
const FX_GL_FAMILIES: ReadonlySet<string> = new Set(["fx"]);

/** True iff the product family carries the FX GL-impact-per-lifecycle-stage walkthrough. */
export function familyHasFxGlLifecycle(family: string): boolean {
  return FX_GL_FAMILIES.has(family);
}

/** The distinct posting-rule ids the declaration names (gate resolves them to the registry). */
export const FX_RULE_STAGE_POSTING_RULE_IDS: readonly string[] = [
  ...new Set(FX_RULE_STAGE_LEG_STRUCTURES.map((s) => s.postingRuleId)),
];

/** The distinct account roles the declaration touches (each resolves to a CoA code). */
export const FX_RULE_STAGE_ACCOUNT_ROLES: readonly FxAccountRole[] = [
  ...new Set(FX_RULE_STAGE_LEG_STRUCTURES.flatMap((s) => s.legs.map((l) => l.accountRole))),
];
