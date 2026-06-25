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

import {
  FX_FVOCI_OCI_RESERVE_ACCOUNT,
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  type FxAccountSet,
  resolveFxAccountSet,
} from "./fx";
import { FX_SETTLEMENT_CLEARING_ACCOUNT, nostroFor } from "./fx-settlement";

// ---------------------------------------------------------------------------
// Account roles — the symbolic role each leg posts to. Resolved to a concrete
// CoA code for the product's currency at render time (no hardcoded codes here).
// ---------------------------------------------------------------------------

/** The FX-posting account roles the rules touch (each resolves to a real CoA code).
 *
 * The OBS-* roles are the trade-date OFF-balance-sheet FX-commitment memorandum
 * block (D-FX-TRADE-DATE-FVTPL-OBS): an at-market FX trade posts NIL on-balance-
 * sheet at inception and records the contractual buy/sell notionals here. The
 * `receivable` / `payable` roles are RETAINED for the historical V1 rule mapping
 * (PR-FX-001 on FxTradeExecuted) but are NO LONGER used by the V2 trade-date rule
 * (PR-FX-001-V2 is OBS-only). */
export type FxAccountRole =
  | "receivable"
  | "payable"
  | "unrealised-pnl"
  | "realised-pnl"
  | "oci-reserve"
  | "nostro"
  | "settlement-clearing"
  | "obs-bought-commitment"
  | "obs-sold-commitment"
  | "obs-commitment-contra";

/** Human label per account role (small tag on the page). */
export const FX_ACCOUNT_ROLE_LABEL: Readonly<Record<FxAccountRole, string>> = {
  receivable: "FX trading receivable",
  payable: "FX trading payable",
  "unrealised-pnl": "Unrealised FX P&L (FVTPL)",
  "realised-pnl": "Realised FX P&L",
  "oci-reserve": "OCI reserve (FVOCI election)",
  nostro: "Cash / nostro",
  "settlement-clearing": "FX settlement clearing (P&L-neutral)",
  "obs-bought-commitment": "OBS FX bought-commitment (memorandum)",
  "obs-sold-commitment": "OBS FX sold-commitment (memorandum)",
  "obs-commitment-contra": "OBS FX commitment contra (memorandum)",
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
    case "obs-bought-commitment":
      return FX_OBS_BOUGHT_COMMITMENT_ACCOUNT;
    case "obs-sold-commitment":
      return FX_OBS_SOLD_COMMITMENT_ACCOUNT;
    case "obs-commitment-contra":
      return FX_OBS_COMMITMENT_CONTRA_ACCOUNT;
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

/** The lifecycle stage a posting rule fires in — aligned to the How-it-works tab.
 * `realisation` is the FCY→ZAR conversion stage (the position is squared back to
 * the reporting currency), the ONLY stage that strikes realised FX P&L under the
 * P&L-neutral-settlement model (D-FX-PNL-FCY-EXPOSURE-REVALUATION). */
export type FxLifecycleStageId = "a" | "revaluation" | "b" | "c" | "d" | "realisation";

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
  initial: "IFRS 9 §3.1.1, §5.1.1, B3.1.2",
  revalFvtpl: "IFRS 9 §5.7.1",
  revalFvoci: "IFRS 9 §5.7.5",
  settleCash: "IAS 21 §23",
  settlePnl: "IAS 21 §28",
  ndf: "IFRS 9 §5.7.1 / IAS 21 §28",
  derecognise: "IFRS 9 §3.2.3",
  fvociReclass: "IFRS 9 §5.7.10–11",
  obsRelease: "IAS 21 §23",
  convert: "IAS 21 §28 / IFRS 9 §5.7.1",
} as const;

const D_COMPLETE = "D-ACCT-FX-IFRS-POSTING-COMPLETENESS";
const D_PNL_FCY = "D-FX-PNL-FCY-EXPOSURE-REVALUATION";

// ---------------------------------------------------------------------------
// The declaration. Each entry mirrors a pure `postFx*Legs` function leg-for-leg.
// ---------------------------------------------------------------------------

export const FX_RULE_STAGE_LEG_STRUCTURES: readonly FxRuleStageLegStructure[] = [
  // ── a · Initiation — PR-FX-001-V2 (postFxInitialRecognitionLegs) ──────────
  // IFRS 9 FVTPL + OFF-balance-sheet memorandum (D-FX-TRADE-DATE-FVTPL-OBS). An
  // at-market FX trade has fair value ≈ 0 at inception → NIL on-balance-sheet
  // gross-up (the old self-cancelling Dr-receivable/Cr-payable pair is REMOVED —
  // it dropped the counter-currency and inflated BA-100). The contractual buy/sell
  // notionals are recorded OFF-balance-sheet (ACC-9100-*) from the fxAgreement
  // quad, self-balancing PER CURRENCY:
  //   BUY  leg: Dr bought-commitment / Cr contra (bought-currency)
  //   SELL leg: Dr contra            / Cr sold-commitment (sold-currency)
  // Mirrors postFxInitialRecognitionLegs leg-for-leg. The on-balance-sheet position
  // is carried by daily revaluation (PR-FX-REVAL-V2), not by a trade-date gross-up.
  {
    postingRuleId: "PR-FX-001-V2",
    stage: "a",
    condition: "always",
    legs: [
      {
        accountRole: "obs-bought-commitment",
        drCr: "debit",
        iasCite: IAS.initial,
        note: "OFF-balance-sheet: the bought-leg notional the bank will RECEIVE on settlement (memorandum, bought currency). No on-BS gross-up — fair value ≈ 0 at inception.",
      },
      {
        accountRole: "obs-commitment-contra",
        drCr: "credit",
        iasCite: IAS.initial,
        note: "OFF-balance-sheet contra to the bought-leg commitment (same currency; the buy leg self-balances).",
      },
      {
        accountRole: "obs-commitment-contra",
        drCr: "debit",
        iasCite: IAS.initial,
        note: "OFF-balance-sheet contra to the sold-leg commitment (same currency; the sell leg self-balances).",
      },
      {
        accountRole: "obs-sold-commitment",
        drCr: "credit",
        iasCite: IAS.initial,
        note: "OFF-balance-sheet: the sold-leg notional the bank will DELIVER on settlement (memorandum, sold currency).",
      },
    ],
    derivedFrom: `${FX_TS} · postFxInitialRecognitionLegs`,
    citations: [IAS.initial, D_PNL_FCY, D_COMPLETE],
  },

  // ── revaluation (daily) — PR-FX-REVAL-V2 (postFxRevaluationLegs) ──────────
  // FVTPL: Dr position / Cr unrealised P&L — posts the fair-value DELTA since the
  // last measurement, NOT the notional. This is the ON-balance-sheet position
  // carrier: an at-market trade recognised NIL on-BS at inception (PR-FX-001-V2 is
  // OBS-only), so the position and exposure accrue HERE as MtM moves. The position
  // account is the FX-derivative carrying account (resolveFxAccountSet.receivable);
  // FVOCI election routes the credit leg to the OCI reserve instead of P&L.
  {
    postingRuleId: "PR-FX-REVAL-V2",
    stage: "revaluation",
    condition: "non-zero-delta",
    legs: [
      {
        accountRole: "receivable",
        drCr: "debit",
        iasCite: IAS.revalFvtpl,
        note: "Mark the position to the closing rate — the fair-value DELTA since the last measurement (gain shown; a loss flips Dr/Cr). NOT the notional; the position accrues here, the trade-date booking was OBS-only.",
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

  // ── d · Termination — PR-FX-OBS-RELEASE-V2 (postFxObsCommitmentReleaseLegs) ─
  // Release the trade-date OFF-balance-sheet FX-commitment memorandum on
  // settlement/maturity (D-FX-TRADE-DATE-FVTPL-OBS, settlement side). The OBS
  // commitment PR-FX-001-V2 recorded is the equal-and-opposite of those opening
  // legs — the standing commitment to exchange the two currencies is discharged.
  // Mirrors postFxObsCommitmentReleaseLegs (reverses the ACC-9100-* opening subset).
  {
    postingRuleId: "PR-FX-OBS-RELEASE-V2",
    stage: "d",
    condition: "always",
    legs: [
      {
        accountRole: "obs-bought-commitment",
        drCr: "credit",
        iasCite: IAS.obsRelease,
        note: "Release the bought-leg OBS commitment booked at trade date (reverses the Dr; settlement discharges it).",
      },
      {
        accountRole: "obs-commitment-contra",
        drCr: "debit",
        iasCite: IAS.obsRelease,
        note: "Release the bought-leg OBS contra (reverses the Cr; the buy leg release self-balances).",
      },
      {
        accountRole: "obs-commitment-contra",
        drCr: "credit",
        iasCite: IAS.obsRelease,
        note: "Release the sold-leg OBS contra (reverses the Dr; the sell leg release self-balances).",
      },
      {
        accountRole: "obs-sold-commitment",
        drCr: "debit",
        iasCite: IAS.obsRelease,
        note: "Release the sold-leg OBS commitment booked at trade date (reverses the Cr; settlement discharges it).",
      },
    ],
    derivedFrom: `${FX_TS} · postFxObsCommitmentReleaseLegs`,
    citations: [IAS.obsRelease, D_PNL_FCY, D_COMPLETE],
  },

  // ── realisation — PR-FX-CONVERT-V2 (postFxConversionLegs) ──────────────────
  // FCY→ZAR conversion: the ONLY stage that strikes REALISED FX P&L
  // (D-FX-PNL-FCY-EXPOSURE-REVALUATION). Settlement is P&L-neutral — the FCY
  // exposure stays open as FCY cash at its ZAR cost basis; realised P&L arises only
  // when the FCY is converted back to ZAR (the position is squared). (a) recognise
  // the ZAR proceeds, draw down the FCY cash at its ZAR cost basis, the difference
  // being realised P&L; (b) reclassify the cumulative unrealised (ACC-2100-005) into
  // realised (ACC-2100-006) — total P&L unchanged. Mirrors postFxConversionLegs.
  // The reporting-currency nostro (ZAR) and the FCY nostro both resolve through
  // `nostro`; the gate drives the function so the exact (code, drCr) sequence is
  // asserted, not hand-mirrored across two distinct nostros.
  {
    postingRuleId: "PR-FX-CONVERT-V2",
    stage: "realisation",
    condition: "non-zero-pnl",
    legs: [
      {
        accountRole: "nostro",
        drCr: "debit",
        iasCite: IAS.convert,
        note: "Receive the ZAR (reporting-currency) proceeds for the FCY sold.",
      },
      {
        accountRole: "nostro",
        drCr: "credit",
        iasCite: IAS.convert,
        note: "Draw down the FCY cash sold at its ZAR COST BASIS (the booked ZAR given up to acquire it).",
      },
      {
        accountRole: "realised-pnl",
        drCr: "credit",
        iasCite: IAS.convert,
        note: "Realised P&L = ZAR proceeds − ZAR cost basis (gain shown as a credit; a loss flips Dr/Cr).",
      },
      {
        accountRole: "unrealised-pnl",
        drCr: "debit",
        iasCite: IAS.convert,
        note: "Reverse the cumulative UNREALISED P&L accrued on this exposure (it sat as a credit gain in unrealised P&L).",
      },
      {
        accountRole: "realised-pnl",
        drCr: "credit",
        iasCite: IAS.convert,
        note: "Reclassify the reversed unrealised into realised — total P&L unchanged, only its split moves from unrealised to realised.",
      },
    ],
    derivedFrom: `${FX_SETTLEMENT_TS} · postFxConversionLegs`,
    citations: [IAS.convert, D_PNL_FCY, D_COMPLETE],
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

/** Ordered stage metadata — Initiation → Revaluation → Payment → Receipt →
 * Termination → Realisation. */
export const FX_GL_LIFECYCLE_STAGES: readonly FxLifecycleStageMeta[] = [
  {
    id: "a",
    label: "Initiation",
    summary:
      "Trade-date recognition — IFRS 9 FVTPL: NIL on-balance-sheet (fair value ≈ 0 at inception); the contractual buy/sell notionals are recorded OFF-balance-sheet in the FX-commitment memorandum (ACC-9100-*), self-balancing per currency. No receivable/payable gross-up.",
  },
  {
    id: "revaluation",
    label: "Daily revaluation",
    summary:
      "FVTPL mark-to-market — posts the fair-value DELTA (not the notional) to the on-balance-sheet position vs P&L (or OCI under an FVOCI election). The position accrues here; the trade-date booking was OBS-only.",
  },
  {
    id: "b",
    label: "Payment",
    summary:
      "Sold leg settles — cash leaves the nostro against FX settlement clearing. P&L-neutral: no realised P&L (settlement is a change of form), no on-balance-sheet payable touched (trade-date is OBS-only).",
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
      "Derecognition — accumulated unrealised reval (or OCI reserve) is recycled into realised P&L, and the trade-date OFF-balance-sheet commitment (ACC-9100-*) is released.",
  },
  {
    id: "realisation",
    label: "Realisation (FCY→ZAR conversion)",
    summary:
      "The ONLY stage that strikes realised FX P&L — realised P&L = ZAR proceeds − ZAR cost basis when the FCY exposure is converted back to ZAR (the position is squared); the cumulative unrealised is reclassified into realised (total P&L unchanged).",
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
