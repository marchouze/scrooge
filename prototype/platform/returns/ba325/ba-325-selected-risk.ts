// platform/returns/ba325/ba-325-selected-risk.ts
//
// BA 325 — Selected Risk Exposure Arising from Trading and Treasury Activities.
// SIMULATOR-FIRST TRADING BOOK, Phase 2a (D-BA-RETURN-SIMULATOR-FIRST).
//
// BA 325 is a SUMMARY / MEMORANDUM return: it does NOT re-derive risk charges —
// it ASSEMBLES already-computed figures from the existing driven sub-folds. This
// module is the pure assembly projection. It takes the typed outputs of the four
// source folds (NO re-derivation; the cells reconcile to their sources by
// construction) and emits the BA 325 summary line set.
//
//   ┌───────────────────────────── source fold ─────────────────────────────┐
//   │ R0010–R0060  Market-risk-requirement summary  → BA 320 market-risk fold │
//   │ R0070–R0100  Counterparty-risk memorandum     → SA-CCR EAD cohort       │
//   │              (OTC / SFT / credit-derivative)     (× RW × 8% requirement) │
//   │ R0150–R0170  Liquidity coverage ratio summary → BA 300 LCR fold         │
//   │ R0180–R0230  Standardised-approach position    → BA 320 sub-charges      │
//   │              risk by risk class                                          │
//   │ R0240–R0350  Internal-models-approach VaR/sVaR → VaR engine over the     │
//   │              (+ per-desk memorandum)             trading book            │
//   └────────────────────────────────────────────────────────────────────────┘
//
// GENUINELY-MISSING FOLDS (tracked honestly in gap-register.ts — NOT a silent
// zero, NOT an overclaimed fold — the original BA 325 audit finding):
//   • IRC (incremental risk charge — column C0040): NO engine exists. The IMA
//     IRC cells are surfaced as `absent` (gap: ba325-irc-engine).
//   • SARB-repo liquidity summary (R0110–R0140): no repo-participation fold —
//     a treasury banking-book liquidity line, not one of the four cited folds.
//     Surfaced `absent` (gap: ba325-sarb-repo-liquidity).
//   • Reg-29 foreign-currency residency-segmented detail (R0360–R0790): the
//     aggregate effective NOP is driveable from the FX position fold, but the
//     by-residency / by-counterparty gross-detail block is not folded. Surfaced
//     `absent` (gap: ba325-reg29-fx-residency-detail). The aggregate NOP line
//     (R0750) is sourced from the BA 320 FX sub-fold's net-open-position basis.
//
// PROVENANCE BOUNDARY (the R300m-into-Prod lesson — D-V2-UI-VISIBILITY-
// REMEDIATION): every input fold is read under ONE provenance lens chosen by the
// caller. The PRODUCTION read of all four source folds is empty pre-licence-day
// (no real positions), so every BA 325 summary line folds to ZERO under
// production. The SIMULATED-inclusive read drives the lines to the golden-case
// figures. BA 325 inherits the boundary from its sources — it adds no new event
// reads of its own. Proven by `recon:ba325-selected-risk-sim-drive` + the
// golden-case test.
//
// Pure function — no event side-effects, no store reads. Callers compose the
// source-fold outputs (under the chosen provenance lens) and consume the result.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-PROVENANCE-FILTER-ENFORCEMENT;
//   Regulations Relating to Banks Reg 28 (market / position risk),
//   reg 29 (daily selected-risk: trading & treasury); BCBS MAR; Basel-2.5 MAR.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner).

import { ROUNDING, amountToMinorUnits, money, round } from "../../core/decimal-money";
import type { Currency } from "../../core/types";
import type { CohortVarResult } from "../../market-risk/eod-cohort-var-v2";
import type { Ba300LcrOutput } from "../../reporting/ba-300-lcr";
import type { Ba320Output } from "../../reporting/ba-320-market-risk";
import type { FinancialInput } from "../../types/financial-input";
import { absent, present } from "../../types/financial-input";

/**
 * Convert a reporting-currency MAJOR-unit figure (a float, as the VaR engine
 * produces it) to integer minor units via the DECIMAL ENGINE — no float `× 100`
 * money arithmetic (recon:no-float-money-arithmetic; D-DECIMAL-NATIVE-MONEY-
 * ARITHMETIC). The float's string form is lifted to a decimal Money, rounded to
 * the currency scale (HALF_UP), then lowered to exact minor units.
 */
function majorFloatToMinor(majorValue: number, currency: string): number {
  const m = round(money(String(majorValue), currency as Currency), ROUNDING.SETTLEMENT);
  return Number(amountToMinorUnits(m));
}

// ---------------------------------------------------------------------------
// Inputs — the typed outputs of the four source folds (already computed).
// ---------------------------------------------------------------------------

/**
 * Counterparty-risk-requirement memorandum inputs (R0070–R0100). Derived from
 * the SA-CCR EAD cohort: requirement = EAD × counterparty RW × 8% capital ratio.
 *
 * Each leg is a `FinancialInput` so an absent product class (no SFT, no credit-
 * derivative simulated) is surfaced as an explicit, reasoned absence — never a
 * silent zero that could be confused with a computed zero.
 */
export interface Ba325CounterpartyMemorandum {
  /** OTC-derivative counterparty risk requirement (ZAR minor). */
  readonly otcRequirementMinor: FinancialInput<number>;
  /** Securities-financing-transaction counterparty risk requirement (ZAR minor). */
  readonly sftRequirementMinor: FinancialInput<number>;
  /** Credit-derivative counterparty risk requirement (ZAR minor). */
  readonly creditDerivativeRequirementMinor: FinancialInput<number>;
}

export interface Ba325AssemblyInput {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  /** BA 320 market-risk fold output (Phase 1 driven). Source for R0010–R0060, R0180–R0230. */
  readonly ba320: Ba320Output;
  /** BA 300 LCR fold output. Source for R0150–R0170. */
  readonly ba300Lcr: Ba300LcrOutput;
  /**
   * Simulator-first cohort VaR result over the trading book — the V1-FREE VaR
   * path (`computeCohortVar`, eod-cohort-var-v2). Source for R0240–R0310. Folds
   * the born-V2 FIL cohort, NOT the V1 FxTradeExecuted stream (V1-retirement
   * directive). Figures are in reporting MAJOR units; converted to minor here.
   */
  readonly cohortVar: CohortVarResult;
  /** SA-CCR-derived counterparty-risk-requirement memorandum. Source for R0070–R0100. */
  readonly counterparty: Ba325CounterpartyMemorandum;
  /**
   * Per-desk VaR memorandum (R0320–R0350), keyed by desk label. When the engine
   * has no per-desk decomposition (build phase — a single aggregate book), this
   * is empty and the per-desk rows are surfaced `absent`.
   */
  readonly perDeskVar?: ReadonlyMap<string, FinancialInput<number>>;
}

// ---------------------------------------------------------------------------
// Output line model.
// ---------------------------------------------------------------------------

export interface Ba325Line {
  readonly cellRow: string;
  readonly label: string;
  /** ZAR minor units for money lines; dimensionless for ratio lines. */
  readonly value: FinancialInput<number>;
  /** "money" | "ratio". */
  readonly valueType: "money" | "ratio";
  /** The source fold this line reconciles to (Principle 2 lineage). */
  readonly sourceFold: string;
}

export interface Ba325SelectedRiskOutput {
  readonly meta: {
    readonly form: "BA 325";
    readonly formVersion: "v0.1-simulator-first";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
  };
  /** Market-risk-requirement summary + standardised-approach position risk. */
  readonly marketRiskSummary: readonly Ba325Line[];
  /** Counterparty-risk memorandum (OTC / SFT / credit-derivative). */
  readonly counterpartyMemorandum: readonly Ba325Line[];
  /** Liquidity coverage ratio summary. */
  readonly liquiditySummary: readonly Ba325Line[];
  /** Internal-models-approach VaR / sVaR + per-desk memorandum. */
  readonly internalModelsApproach: readonly Ba325Line[];
  /** Citations carried forward (Principle 2). */
  readonly citations: readonly string[];
  /**
   * Honest gap markers — the genuinely-missing folds. Each names the gap-register
   * id so the recon can assert the gap is tracked, never silently zeroed.
   */
  readonly gaps: readonly string[];
}

// ---------------------------------------------------------------------------
// Scope guard.
// ---------------------------------------------------------------------------

export const BA_325_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

export class Ba325AssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba325AssemblyError";
  }
}

function assertBankEntity(entity: string): void {
  if (!BA_325_BANK_ENTITIES.includes(entity)) {
    throw new Ba325AssemblyError(
      `BA 325 (selected risk exposure) is bank-licence-bound; entity '${entity}' is not in BA_325_BANK_ENTITIES (${BA_325_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Honest-gap reasons (no silent zeros — gap-register-tracked).
// ---------------------------------------------------------------------------

export const BA325_GAP_IRC = "ba325-irc-engine";
export const BA325_GAP_SARB_REPO = "ba325-sarb-repo-liquidity";
export const BA325_GAP_REG29_FX_DETAIL = "ba325-reg29-fx-residency-detail";

const IRC_ABSENT_REASON =
  "no incremental-risk-charge (IRC) engine exists — the IMA IRC column (C0040) requires a default + migration-risk model the build-phase substrate does not yet implement";
const IRC_ABSENT_FROM = `gap-register: ${BA325_GAP_IRC} (incremental-risk-charge engine)`;

const SARB_REPO_ABSENT_REASON =
  "no SARB-repo-participation liquidity fold exists — the repo participation / preceding-day-liquid-assets summary is a treasury banking-book liquidity line not derived by the BA 320 / BA 300 / SA-CCR / VaR folds";
const SARB_REPO_ABSENT_FROM = `gap-register: ${BA325_GAP_SARB_REPO} (SARB-repo liquidity summary fold)`;

// ---------------------------------------------------------------------------
// Assembly.
// ---------------------------------------------------------------------------

/**
 * Assemble the BA 325 selected-risk-exposure summary from the source-fold
 * outputs. Pure; deterministic. Each line carries the source fold it reconciles
 * to. The caller has already read every source fold under ONE provenance lens
 * (production OR simulated-inclusive) — BA 325 inherits that lens.
 */
export function assembleBa325SelectedRisk(input: Ba325AssemblyInput): Ba325SelectedRiskOutput {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba325AssemblyError(
      `BA 325 assembly: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }

  const b = input.ba320;
  const BA320_FOLD = "ba320-market-risk-fold";
  const lin = "assembled from BA 320 market-risk fold (no re-derivation)";

  // ---- Market-risk-requirement summary (R0010–R0060) + standardised by class ----
  // R0020 Minimum prescribed pillar-1 market-risk requirement = the BA 320
  //   total market-risk CAPITAL (the standardised-approach charge). Pillar-2a /
  //   2b add-ons are RAS/SREP overlays — absent in the build phase (no SREP
  //   determination yet), so R0030/R0040 are surfaced absent, and R0010 (Total)
  //   = R0020 + R0030 + R0040 reconciles to R0020 alone when the add-ons are
  //   absent (the only honest sum).
  const pillar1Minor = b.totalMarketRiskCapitalMinor;
  const ADDON_ABSENT_REASON =
    "no SREP / pillar-2 determination exists in the build phase — the systemic (2a) and bank-specific (2b) market-risk add-ons are set by the supervisor at licence-day";
  const ADDON_ABSENT_FROM = "supervisory SREP determination (licence-day)";

  const marketRiskSummary: Ba325Line[] = [
    {
      cellRow: "R0010",
      label: "Summary of selected information: Market risk requirement / Total",
      // Total = pillar-1 + 2a + 2b. With 2a/2b absent the total IS pillar-1.
      value: present(pillar1Minor, `${lin}; total = pillar-1 (2a/2b add-ons absent)`),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0020",
      label: "Minimum prescribed pillar 1 market risk requirement",
      value: present(pillar1Minor, `${lin}; = totalMarketRiskCapitalMinor`),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0030",
      label: "Systemic risk add-on (pillar 2a) market risk requirement",
      value: absent(ADDON_ABSENT_REASON, ADDON_ABSENT_FROM),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0040",
      label: "Additionally specified bank-specific (pillar 2b) market risk requirement",
      value: absent(ADDON_ABSENT_REASON, ADDON_ABSENT_FROM),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    // Standardised-approach position risk by class (R0180–R0230) — directly the
    // BA 320 sub-charge capital figures, by construction equal to their sources.
    {
      cellRow: "R0180",
      label: "Standardised approach Position risk requirement: Total",
      value: present(pillar1Minor, `${lin}; = totalMarketRiskCapitalMinor`),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0190",
      label: "Interest rate risk",
      value: present(
        b.interestRateGeneral.capitalMinor + b.interestRateSpecific.capitalMinor,
        `${lin}; IR general ${b.interestRateGeneral.capitalMinor} + IR specific ${b.interestRateSpecific.capitalMinor}`,
      ),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0200",
      label: "Equity risk",
      value: present(b.equity.capitalMinor, `${lin}; equity sub-charge`),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0210",
      label: "Foreign exchange risk, including gold",
      value: present(b.fx.capitalMinor, `${lin}; FX sub-charge`),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
    {
      cellRow: "R0220",
      label: "Commodity risk",
      value: present(b.commodity.capitalMinor, `${lin}; commodity sub-charge`),
      valueType: "money",
      sourceFold: BA320_FOLD,
    },
  ];

  // ---- Counterparty-risk memorandum (R0070–R0100) — from SA-CCR ----------
  const SACCR_FOLD = "sa-ccr-ead-cohort";
  const counterpartyMemorandum: Ba325Line[] = [
    {
      cellRow: "R0080",
      label: "Memorandum items: Counterparty risk requirement / OTC",
      value: input.counterparty.otcRequirementMinor,
      valueType: "money",
      sourceFold: SACCR_FOLD,
    },
    {
      cellRow: "R0090",
      label: "Memorandum items: Counterparty risk requirement / SFT",
      value: input.counterparty.sftRequirementMinor,
      valueType: "money",
      sourceFold: SACCR_FOLD,
    },
    {
      cellRow: "R0100",
      label: "Memorandum items: Counterparty risk requirement / Credit-derivative instruments",
      value: input.counterparty.creditDerivativeRequirementMinor,
      valueType: "money",
      sourceFold: SACCR_FOLD,
    },
  ];

  // ---- Liquidity coverage ratio summary (R0150–R0170) — from BA 300 ------
  const BA300_FOLD = "ba300-lcr-fold";
  const lcr = input.ba300Lcr;
  // The cash-flow section carries net cash outflows; the HQLA section carries
  // the post-cap stock. Both are reconciled to the BA 300 fold by construction.
  const hqlaMinor = lcr.hqla.totalStockHqlaMinor;
  const netOutflowsMinor = lcr.cashFlows.netCashOutflowsMinor;
  const liquiditySummary: Ba325Line[] = [
    {
      cellRow: "R0150",
      label: "Liquidity coverage ratio (LCR): High quality liquid assets",
      value: present(hqlaMinor, "assembled from BA 300 LCR fold; post-cap HQLA stock"),
      valueType: "money",
      sourceFold: BA300_FOLD,
    },
    {
      cellRow: "R0160",
      label: "Net cash outflows",
      value: present(netOutflowsMinor, "assembled from BA 300 LCR fold; net cash outflows"),
      valueType: "money",
      sourceFold: BA300_FOLD,
    },
    {
      cellRow: "R0170",
      label: "LCR",
      // Ratio line. When net outflows are zero the BA 300 fold reports +Inf;
      // surface that as an explicit absence (no stress → ratio undefined) rather
      // than a misleading numeric.
      value: Number.isFinite(lcr.lcrRatio)
        ? present(lcr.lcrRatio, "assembled from BA 300 LCR fold; HQLA / net outflows")
        : absent(
            "net cash outflows are zero in the BA 300 fold — the LCR ratio is undefined (no stress), not a numeric figure",
            "BA 300 LCR fold (lcrRatio)",
          ),
      valueType: "ratio",
      sourceFold: BA300_FOLD,
    },
  ];

  // ---- Internal-models-approach VaR / sVaR (R0240–R0310) — from cohort VaR ----
  const VAR_FOLD = "market-risk-cohort-var";
  const cv = input.cohortVar;
  // NO SILENT ZEROS: the cohort engine zeroes its figures and reports a loud
  // status (`no-positions` / `insufficient-history`) when it cannot compute. We
  // mirror that as an explicit `absent` — never a numeric 0 that reads like a
  // computed flat figure.
  const cohortVarLine = (
    majorValue: number,
    measure: "VaR" | "sVaR" | "ES",
  ): FinancialInput<number> => {
    if (cv.status !== "computed") {
      const reason =
        cv.status === "no-positions"
          ? "the trading book is flat — the cohort carries no standing net FX position per currency (NOP basis is zero)"
          : `insufficient market-data return history — ${cv.minObservations} observation(s) for the thinnest risk factor, below the build-phase floor; a ${measure} from a too-short window understates tail risk`;
      return absent(reason, `cohort VaR engine (status=${cv.status})`);
    }
    // computed: reporting MAJOR units → minor (decimal-engine, no float × 100).
    return present(
      majorFloatToMinor(majorValue, input.functionalCurrency),
      `cohort VaR historical-simulation over ${cv.scenarioCount} scenario(s), ${cv.exposures.length} risk factor(s); ${measure}`,
    );
  };

  const internalModelsApproach: Ba325Line[] = [
    {
      cellRow: "R0240",
      label: "Internal models approach Position risk requirement: Total VaR amount",
      value: cohortVarLine(cv.varReporting, "VaR"),
      valueType: "money",
      sourceFold: VAR_FOLD,
    },
    {
      cellRow: "R0310",
      label: "Memorandum items: Total VaR amount (stressed VaR / sVaR)",
      value: cohortVarLine(cv.svarReporting, "sVaR"),
      valueType: "money",
      sourceFold: VAR_FOLD,
    },
    // IRC (column C0040 on R0240/R0250/R0260/R0290) — NO engine. Surfaced absent.
    {
      cellRow: "R0240.C0040",
      label: "Internal models approach: Incremental risk charge (IRC)",
      value: absent(IRC_ABSENT_REASON, IRC_ABSENT_FROM),
      valueType: "money",
      sourceFold: VAR_FOLD,
    },
  ];

  // Per-desk VaR memorandum (R0320–R0350). The cohort engine reports a single
  // aggregate VaR in the build phase (no per-desk decomposition); a caller that
  // has per-desk figures supplies them (reporting MAJOR units → minor here).
  const perDesk = input.perDeskVar ?? new Map<string, FinancialInput<number>>();
  let deskRow = 320;
  for (const [deskLabel, deskVar] of perDesk) {
    internalModelsApproach.push({
      cellRow: `R0${deskRow}`,
      label: `Memorandum items: ${deskLabel} — Total VaR amount`,
      value: deskVar.present
        ? present(majorFloatToMinor(deskVar.value, input.functionalCurrency), deskVar.lineage)
        : deskVar,
      valueType: "money",
      sourceFold: VAR_FOLD,
    });
    deskRow += 10;
  }

  // ---- Honest gaps (no silent zeros; gap-register-tracked) ----------------
  const gaps: string[] = [BA325_GAP_IRC, BA325_GAP_SARB_REPO, BA325_GAP_REG29_FX_DETAIL];
  // SARB-repo liquidity summary (R0110–R0140): no fold — surface as a tracked
  // gap line in the liquidity section so the missing input is loud, not silent.
  liquiditySummary.push({
    cellRow: "R0110",
    label: "Liquidity risk: SARB repo participation",
    value: absent(SARB_REPO_ABSENT_REASON, SARB_REPO_ABSENT_FROM),
    valueType: "money",
    sourceFold: "gap:ba325-sarb-repo-liquidity",
  });

  return {
    meta: {
      form: "BA 325",
      formVersion: "v0.1-simulator-first",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: input.functionalCurrency,
    },
    marketRiskSummary,
    counterpartyMemorandum,
    liquiditySummary,
    internalModelsApproach,
    citations: [
      "D-BA-RETURN-SIMULATOR-FIRST",
      "D-FX-V2-SIMULATOR-FIRST",
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
      "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
      "Regulations Relating to Banks Reg 28",
      "Regulations Relating to Banks Reg 29",
      "BCBS MAR",
    ],
    gaps,
  };
}
