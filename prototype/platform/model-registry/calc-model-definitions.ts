// platform/model-registry/calc-model-definitions.ts
//
// Canonical definitions for the 19 regulatory-metric calculation models that
// calculation-binding.ts binds surfaced figures to. Previously lived in
// seeds/models/calc-model-seed.ts; moved here so the model definitions are a
// first-class platform module rather than a boot-seed artefact.
//
// Models registered (each: ModelSubmitted → ModelTierClassified → ModelValidationApproved):
//   1. model:lcr-ba110-v1               — Liquidity Coverage Ratio (Tier-1, BA 110)
//   2. model:nsfr-ba110-v1              — Net Stable Funding Ratio (Tier-1, BA 110)
//   3. model:capital-cet1-ba100-v1      — CET1 Capital Ratio (Tier-1, BA 100)
//   4. model:rwa-sa-v1                  — Risk-Weighted Assets, standardised (Tier-1, BA 100)
//   5. model:ecl-staging-ifrs9-v1       — IFRS 9 staging / SICR (Tier-1, IFRS 9 §B5.5)
//   6. model:ecl-pd-ifrs9-v1            — IFRS 9 12-month PD (Tier-1, IFRS 9 §B5.5)
//   7. model:ecl-lgd-ifrs9-v1           — IFRS 9 LGD (Tier-1, IFRS 9 §B5.5)
//   8. model:ecl-ead-ifrs9-v1           — IFRS 9 EAD (Tier-1, IFRS 9 §B5.5)
//   9. model:ecl-macro-overlay-ifrs9-v1 — IFRS 9 macroeconomic overlay (Tier-1, IFRS 9 §B5.5)
//  10. model:ecl-engine-ifrs9-v1        — IFRS 9 ECL computation engine (Tier-1, IFRS 9 §B5.5)
//  11. model:irrbb-repricing-v1         — IRRBB repricing/behavioural model (Tier-1, BCBS d368)
//  12. model:irrbb-eve-engine-v1        — IRRBB ΔEVE engine (Tier-1, BCBS d368 §III)
//  13. model:irrbb-nii-engine-v1        — IRRBB ΔNII engine (Tier-1, BCBS d368 §III)
//  14. model:market-risk-pnl-sensitivity-v1 — market-risk P&L/sensitivity (Tier-1, RISK-MRP-01 §1.1)
//  15. model:market-risk-var-hs-v1      — market-risk VaR 99% 1-day HS (Tier-1, BCBS d457 / Basel-2.5)
//  16. model:market-risk-svar-hs-v1     — market-risk Stressed VaR (Tier-1, Basel-2.5 MAR)
//  17. model:market-risk-es-hs-v1       — market-risk Expected Shortfall 97.5% (Tier-1, BCBS d457 MAR33)
//  18. model:cva-exposure-epe-v1        — CVA exposure / EPE sub-model (Tier-1, BCBS d424 BA-CVA)
//  19. model:cva-engine-v1              — counterparty CVA engine (Tier-1, BCBS d424 / IFRS 13)
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (substrate), coordinating Rohan (Risk systems engineer, builder)
//   + Nadia (Independent-validation engineer, validator).

import { createHash } from "node:crypto";

import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { LocalModelRegistry } from "./index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const SEED_AS_OF = "2026-05-29T00:00:00.000Z";

const ROHAN_ACTOR: Actor = { type: "service", id: "agent:rohan:calc-model-seed" };
const NADIA_ACTOR: Actor = { type: "service", id: "agent:nadia:calc-model-validation" };

const CITATIONS = [
  "D-TRUSTED-FIGURES-PROGRAM-V1",
  "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1",
  "BANKS-ACT-94-1990",
];

export function methodologyHash(description: string): string {
  return createHash("sha256").update(description).digest("hex");
}

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

export interface CalcModelDef {
  readonly modelId: string;
  readonly version: string;
  readonly tier: 1;
  readonly description: string;
  readonly methodologyDescription: string;
  readonly tierRationale: string;
  readonly expiryDate: string;
}

export const MODELS: ReadonlyArray<CalcModelDef> = [
  {
    modelId: "model:lcr-ba110-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Liquidity Coverage Ratio engine (computeLCR). HQLA stock (post-haircut, L1/L2A/L2B " +
      "with caps) over net 30-day stressed cash outflows. Feeds the BA 110 liquidity return.",
    methodologyDescription:
      "lcr-ba110-v1.0-hqla-haircut-l1-l2a-l2b-caps-net-30d-stressed-outflows-runoff-rates",
    tierRationale:
      "Tier-1 under SR 11-7 §V: direct regulatory-submission consequence — the output feeds " +
      "the BA 110 statutory liquidity return to the PA. A misstated LCR is a regulatory " +
      "reporting failure. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:nsfr-ba110-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Net Stable Funding Ratio engine (computeNSFR). Available Stable Funding over Required " +
      "Stable Funding, factor-weighted by tenor and counterparty class. Feeds the BA 110 return.",
    methodologyDescription: "nsfr-ba110-v1.0-asf-rsf-factor-weighting-tenor-counterparty-class",
    tierRationale:
      "Tier-1 under SR 11-7 §V: direct regulatory-submission consequence — the output feeds " +
      "the BA 110 statutory structural-liquidity return to the PA. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:capital-cet1-ba100-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "CET1 Capital Ratio engine (computeCapitalMetrics). Available CET1 capital over " +
      "risk-weighted assets (RWA engine, model:rwa-sa-v1). Feeds the BA 100 capital-adequacy return.",
    methodologyDescription: "capital-cet1-ba100-v1.0-available-cet1-over-rwa-sa-approach",
    tierRationale:
      "Tier-1 under SR 11-7 §V: direct regulatory-capital consequence — the output feeds the " +
      "BA 100 statutory capital-adequacy return to the PA and gates RAS capital limits. " +
      "Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:rwa-sa-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Risk-Weighted Assets engine (computeRwa), standardised approach. Pillar-1 RWA = credit " +
      "RWA (Σ EAD × standardised risk-weight, CRE20) + market RWA (12.5 × Σ capital charge, " +
      "pre-FRTB Basel-2.5 MAR) + operational RWA (12.5 × BIC × ILM, OPE25) + CVA RWA " +
      "(placeholder). RWA is the direct denominator of every capital ratio (CET1, Tier-1, total) " +
      "and feeds the BA 100 capital-adequacy return.",
    methodologyDescription:
      "rwa-sa-v1.0-standardised-credit-cre20-market-mar-pre-frtb-operational-ope25-bic-ilm-cva-placeholder",
    tierRationale:
      "Tier-1 under SR 11-7 §V and Model Risk Policy RISK-MRP-01 §2: RWA is the direct " +
      "denominator of every regulatory capital ratio and feeds the BA 100 statutory " +
      "capital-adequacy return to the PA. A misstated RWA misstates CET1, Tier-1 and total " +
      "capital ratios and the RAS capital limits derived from them — the highest-consequence " +
      "capital figure the bank computes. Full independent validation applies. NOTE: the " +
      "prescribed inputs the engine consumes (SA risk-weight tables, BA 110 haircuts, SA-CCR " +
      "supervisory factors) are regulatory-prescribed constants, NOT bank models, and are " +
      "intentionally out of model-registry scope.",
    expiryDate: "2027-05-29",
  },
  // -- IFRS 9 ECL governance suite (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 2) ----
  {
    modelId: "model:ecl-staging-ifrs9-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IFRS 9 staging model (assessIfrs9Stage). Classifies each debt exposure into Stage 1 " +
      "(12-month ECL), Stage 2 (lifetime ECL — SICR, not credit-impaired) or Stage 3 " +
      "(credit-impaired) per the Significant Increase in Credit Risk assessment. Quantitative " +
      "(dpd ≥ 30 / ≥ 90, PD migration) and qualitative (restructured, default indicator) " +
      "criteria. IFRS 9 §B5.5.17; default per Regulations Relating to Banks Reg 23.",
    methodologyDescription:
      "ecl-staging-ifrs9-v1.0-sicr-dpd-30-90-restructured-default-stage-1-2-3-ifrs9-b5.5.17",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2.1/§5: the staging model is the most " +
      "judgement-intensive component of the IFRS 9 ECL suite and determines whether an " +
      "exposure carries 12-month or lifetime ECL — a direct published-financial-statement " +
      "and regulatory-capital impact. Methodology accountability: Helena (CRO); accounting " +
      "treatment confirmed by Camille (CFO) per RISK-MRP-01 §3.4. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:ecl-pd-ifrs9-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IFRS 9 12-month PD model. Point-in-time, forward-looking probability of default over " +
      "the 12-month horizon by debt-exposure risk bucket (sovereign-bond, corporate-bond, " +
      "covered-bond, debt-other). Build-phase placeholder parameters consistent with the " +
      "pre-licence risk appetite; SA sovereign carries a non-zero 12-month PD (IFRS 9 has no " +
      "sovereign carve-out).",
    methodologyDescription: "ecl-pd-ifrs9-v1.0-12m-pit-forward-looking-pd-bps-by-risk-bucket",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2.1/§5: the PD parameter feeds the published " +
      "IFRS 9 impairment provision and the ICAAP credit-risk self-assessment. Methodology " +
      "accountability: Helena (CRO). Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:ecl-lgd-ifrs9-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IFRS 9 LGD model. Loss given default as a percentage of EAD by debt-exposure risk " +
      "bucket, reflecting seniority and collateral. Build-phase placeholder uses the " +
      "Basel foundation-IRB senior-unsecured 45% LGD as a conservative proxy for sovereign / " +
      "corporate debt; covered bonds at 25%.",
    methodologyDescription:
      "ecl-lgd-ifrs9-v1.0-lgd-bps-by-risk-bucket-senior-unsecured-45pct-proxy",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2.1/§5: the LGD parameter feeds the published " +
      "IFRS 9 impairment provision. Methodology accountability: Helena (CRO). Full independent " +
      "validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:ecl-ead-ifrs9-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IFRS 9 EAD model. Exposure at default = gross market value of each net debt position in " +
      'minor units, read from the unified-position projection (assetClass:"bond"). The same ' +
      "instrument-level position source the LCR HQLA build folds. Off-balance-sheet credit " +
      "conversion factors are a licence-day extension (no undrawn commitments in the build phase).",
    methodologyDescription:
      "ecl-ead-ifrs9-v1.0-ead-gross-market-value-unified-position-bond-book-minor-units",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2.1/§5: EAD scales the entire IFRS 9 impairment " +
      "provision; a misstated EAD misstates the published provision. Methodology accountability: " +
      "Helena (CRO). Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:ecl-macro-overlay-ifrs9-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IFRS 9 macroeconomic overlay model. Adjusts PD/LGD/EAD parameters for forward-looking " +
      "macroeconomic scenarios (base / upside / downside) with probability weightings. " +
      "Build-phase: registered + governed with a no-op (factor 1.0) overlay pending the scenario " +
      "weight substrate; activates with the credit-portfolio and scenario-engine landing.",
    methodologyDescription:
      "ecl-macro-overlay-ifrs9-v1.0-base-upside-downside-probability-weighted-build-phase-noop-1.0",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2.1/§5: the macroeconomic overlay is the " +
      "forward-looking component IFRS 9 §B5.5 mandates and a published-financial-statement " +
      "driver. Methodology accountability: Helena (CRO); accounting treatment confirmed by " +
      "Camille (CFO). Full independent validation applies. NOTE: the build-phase overlay is a " +
      "no-op (factor 1.0) — the absence of a scenario weighting is governed and explicit, not a " +
      "silent omission.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:ecl-engine-ifrs9-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IFRS 9 ECL computation engine (computeStage1Ecl). Aggregates 12-month Stage-1 ECL = " +
      "Σ (PD × LGD × EAD) over the in-scope debt book, consuming the staging / PD / LGD / EAD / " +
      "macro-overlay component models. Surfaced figure (calcKey `ecl`) in CALC_BINDINGS. When the " +
      "debt book is empty the engine returns a loud `degraded` status (no in-scope exposures), " +
      "never a silent 0. Feeds the IFRS 9 impairment provision on the published AFS.",
    methodologyDescription:
      "ecl-engine-ifrs9-v1.0-12m-stage1-ecl-sum-pd-lgd-ead-debt-book-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2.1/§5: the ECL engine produces the IFRS 9 " +
      "impairment provision booked to the published annual financial statements and feeds " +
      "regulatory capital (the provision adjusts CET1). It is the surfaced figure of the ECL " +
      "suite. Methodology accountability: Helena (CRO); the impairment figure is owned by " +
      "Camille (CFO) per the decision-authority routing table, with Camille confirming " +
      "accounting-treatment consistency per RISK-MRP-01 §3.4. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  // -- IRRBB governance suite (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3) ---------
  {
    modelId: "model:irrbb-repricing-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IRRBB repricing / behavioural model (computeRepricingGap). Assigns every banking-book " +
      "instrument to a BCBS d368 repricing time-bucket (ON, 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, " +
      "10Y+) as rate-sensitive asset (RSA) or liability (RSL): fixed-rate bonds reprice at " +
      "maturity, IRS legs at reset/maturity, repos/deposits/interbank placements at their " +
      "contractual roll dates. Carries the behavioural assumptions — non-maturing-deposit (NMD) " +
      "decay and prepayment treatment — that BCBS d368 §III mandates for the banking book. The " +
      "common repricing base both the ΔEVE and ΔNII engines consume.",
    methodologyDescription:
      "irrbb-repricing-v1.0-bcbs-d368-time-buckets-rsa-rsl-nmd-decay-prepayment-behavioural",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2/§5: the repricing/behavioural model is the " +
      "common base for both IRRBB measures (ΔEVE and ΔNII), which feed Pillar-2 capital, the " +
      "ICAAP and the BA 330 IRRBB return. Its behavioural assumptions (NMD decay, prepayment) " +
      "are the most judgement-intensive IRRBB inputs and drive the entire sensitivity. " +
      "Methodology accountability: Helena (CRO); the repricing/behavioural assumptions are " +
      "owned by Eitan (Treasurer) as the ALM input owner. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:irrbb-eve-engine-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IRRBB ΔEVE engine (computeEVE). Computes the change in the economic value of equity of " +
      "the banking book under the six BCBS d368 §III standard interest-rate shocks (parallel up, " +
      "parallel down, steepener, flattener, short-rate up, short-rate down). ΔEVE = shocked NPV − " +
      "base NPV, discounting each repricing bucket's net cashflow at base vs shocked rates. " +
      "Surfaced figure (calcKey `irrbb-eve`) in CALC_BINDINGS. When the banking book has no " +
      "repricing-sensitive positions the engine returns a loud `zero-positions` status (ΔEVE is 0 " +
      "by absence of exposure), never a silent 0.",
    methodologyDescription:
      "irrbb-eve-engine-v1.0-delta-eve-six-bcbs-d368-shocks-npv-discount-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2/§5: ΔEVE is the economic-value (Pillar-2) IRRBB " +
      "measure feeding the ICAAP, the SARB outlier test (ΔEVE > 15% of Tier-1 capital) and the " +
      "BA 330 IRRBB return. A misstated ΔEVE misstates the Pillar-2 capital add-on. Methodology " +
      "accountability: Helena (CRO); the figure is owned by Helena (CRO) as the risk-measure " +
      "owner; ALM repricing/behavioural inputs are owned by Eitan (Treasurer). Full independent " +
      "validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:irrbb-nii-engine-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "IRRBB ΔNII engine (computeNII). Computes the change in projected 12-month net interest " +
      "income of the banking book under the BCBS d368 §III parallel interest-rate shocks " +
      "(±100 / ±200 bps). ΔNII = shocked NII − base NII, projecting each repricing bucket's net " +
      "gap × rate × in-window year-fraction over the 12-month earnings horizon. Surfaced figure " +
      "(calcKey `irrbb-nii`) in CALC_BINDINGS. When the banking book has no repricing-sensitive " +
      "positions the engine returns a loud `zero-positions` status (ΔNII is 0 by absence of " +
      "exposure), never a silent 0.",
    methodologyDescription:
      "irrbb-nii-engine-v1.0-delta-nii-12m-horizon-bcbs-d368-parallel-shocks-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §2/§5: ΔNII is the earnings-perspective IRRBB " +
      "measure feeding the ICAAP and the BA 330 IRRBB return; a misstated ΔNII misstates the " +
      "earnings-at-risk self-assessment. Methodology accountability: Helena (CRO); the ΔNII " +
      "earnings figure is owned by Camille (CFO) per the decision-authority routing table; ALM " +
      "repricing/behavioural inputs are owned by Eitan (Treasurer). Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  // -- Market-risk governance suite (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4) ---
  {
    modelId: "model:market-risk-pnl-sensitivity-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Market-risk P&L / sensitivity model (deriveRiskFactorExposures). Maps the live trading " +
      "book (FX, bonds, IRS, equity) to a signed net-ZAR-exposure-per-risk-factor vector and " +
      "attaches each factor's historical-return window from the MarketDataStore. The build-phase " +
      "trading book is the FX desk (net open ZAR positions per currency pair from " +
      "fxPositionCalculator over FxTradeExecuted); bonds/IRS/equity legs map to their own risk " +
      "factors as price-history feeds land. This is the common exposure base the VaR / SVaR / ES " +
      "engines all consume.",
    methodologyDescription:
      "market-risk-pnl-sensitivity-v1.0-risk-factor-exposure-vector-fx-net-zar-positions-return-window",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §1.1/§2: the P&L / sensitivity model is the common " +
      "exposure base for every market-risk measure (VaR, SVaR, ES) — a misstated exposure vector " +
      "misstates all three figures and the RAS market-risk limits derived from them. Market-risk " +
      "models are in declared model scope per RISK-MRP-01 §1.1. Methodology accountability: " +
      "Helena (CRO) — market-risk figures are CRO-owned per the decision-authority routing table; " +
      "the historical return window is supplied by Ravi (market-data infrastructure engineer). " +
      "Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:market-risk-var-hs-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Market-risk VaR engine (computeMarketRisk → historicalVaR). 99% 1-day Value-at-Risk by " +
      "historical simulation: the simulated 1-day P&L distribution is built by applying each " +
      "historical scenario's per-factor return to the live exposure vector and summing across " +
      "factors; VaR is the loss at the 99% quantile. A 250-business-day observation window is the " +
      "Basel-2.5 / FRTB standard lookback. Surfaced figure (calcKey `var`) in CALC_BINDINGS. NO " +
      "SILENT ZEROS: a flat book yields `no-positions` and a too-short return window yields " +
      "`insufficient-history` — both loud, output null, never a silent 0.",
    methodologyDescription:
      "market-risk-var-hs-v1.0-99pct-1day-historical-simulation-250d-window-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §1.1/§2: VaR is the headline market-risk measure " +
      "feeding the RAS market-risk limits and potential Pillar-1 / Pillar-2 market-risk capital. A " +
      "misstated VaR misstates the market-risk limit utilisation and the capital self-assessment. " +
      "The bank elects historical simulation (no distributional assumption; captures fat tails " +
      "directly) as the most defensible build-phase method. Methodology accountability + figure " +
      "ownership: Helena (CRO). Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:market-risk-svar-hs-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Market-risk Stressed VaR engine (computeMarketRisk → stress-calibrated historicalVaR). The " +
      "same 99% 1-day historical-simulation VaR calibrated to a window of significant financial " +
      "stress (Basel-2.5 MAR / FRTB ES-stress-period analogue). Build-phase: until a multi-year " +
      "return history exists the stress window is the full available window (SVaR ≥ VaR enforced). " +
      "Surfaced figure (calcKey `svar`) in CALC_BINDINGS. NO SILENT ZEROS: shares the VaR " +
      "`no-positions` / `insufficient-history` loud gates.",
    methodologyDescription:
      "market-risk-svar-hs-v1.0-99pct-1day-stress-calibrated-historical-simulation-svar-gte-var",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §1.1/§2: SVaR is the Basel-2.5 / FRTB stressed " +
      "market-risk capital measure — a stress add-on to the current VaR that feeds market-risk " +
      "capital. A misstated SVaR understates stressed-market capital. Methodology accountability + " +
      "figure ownership: Helena (CRO). Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:market-risk-es-hs-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Market-risk Expected Shortfall engine (computeMarketRisk → historicalES). 97.5% 1-day " +
      "Expected Shortfall (the FRTB d457 / MAR33 prescribed quantile): the mean loss in the tail " +
      "beyond the 97.5% quantile of the simulated 1-day P&L distribution. ES is a coherent risk " +
      "measure that, unlike VaR, captures the magnitude of tail losses and is the FRTB " +
      "internal-model metric. Surfaced figure (calcKey `es`) in CALC_BINDINGS. NO SILENT ZEROS: " +
      "shares the VaR `no-positions` / `insufficient-history` loud gates.",
    methodologyDescription:
      "market-risk-es-hs-v1.0-97.5pct-1day-expected-shortfall-tail-mean-frtb-d457-mar33-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §1.1/§2: ES is the FRTB-prescribed market-risk " +
      "internal-model measure feeding market-risk capital and the RAS market-risk limits. A " +
      "misstated ES misstates the FRTB capital charge. Methodology accountability + figure " +
      "ownership: Helena (CRO). Full independent validation applies. NOTE: the prescribed FRTB " +
      "standardised-approach inputs (risk-weight buckets, correlation parameters) are " +
      "regulatory-prescribed constants, not bank models, and are intentionally out of " +
      "model-registry scope (per the Slice-4 exclusions).",
    expiryDate: "2027-05-29",
  },
  // -- CVA governance suite (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 / FINAL) ---
  {
    modelId: "model:cva-exposure-epe-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "CVA exposure / EPE sub-model (deriveCounterpartyExposures). Maps the live " +
      "uncollateralised OTC derivative book (IRS + FX forward/swap; spot excluded) to a " +
      "per-counterparty netted positive Exposure At Default: EAD_cp = max(0, Σ current MTM) + " +
      "Σ PFE add-on, a single netting set per counterparty. IRS current exposure is the positive " +
      "mark-to-market from the latest IrsPositionRevalued; the PFE add-on is a documented " +
      "notional fraction (proxy for the SA-CCR supervisory factor, which is a prescribed input " +
      "out of model scope). FX forward/swap exposure is the PFE add-on on the |net ZAR notional| " +
      "of the open term legs. This is the common exposure base the CVA engine consumes.",
    methodologyDescription:
      "cva-exposure-epe-v1.0-counterparty-netted-positive-ead-current-mtm-plus-pfe-addon-otc-irs-fx-fwd-swap-spot-excluded",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §1.1/§2: the exposure / EPE model is the common " +
      "base for the CVA figure — a misstated counterparty EAD misstates the CVA and the " +
      "counterparty-credit-risk appetite derived from it. Counterparty-credit-risk / CVA models " +
      "are in declared model scope per RISK-MRP-01 §1.1. Methodology accountability + figure " +
      "ownership: Helena (CRO) — CVA is CRO-owned per the decision-authority routing table; the " +
      "counterparty credit-spread inputs are supplied by Ravi (market-data infrastructure " +
      "engineer). Full independent validation applies. NOTE: the prescribed inputs the engine " +
      "would otherwise consume (SA-CCR supervisory factors, BA 110 haircuts, SA risk-weight " +
      "tables) are regulatory-prescribed constants, NOT bank models, and are intentionally out " +
      "of model-registry scope (per the Slice-5 exclusions).",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:cva-engine-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Counterparty CVA engine (computeCva). Standardised / accounting CVA over the live " +
      "uncollateralised OTC derivative book: CVA = Σ_counterparty LGD × EAD × PD × discount, a " +
      "simple no-hedge no-correlation sum (the build-phase analogue of the Basel BA-CVA " +
      "standardised approach, BCBS d424 MAR50, and the IFRS 13 fair-value CVA). LGD is the " +
      "Basel-CVA standard 60% for senior uncollateralised exposure; PD is derived from a live " +
      "counterparty credit spread via the credit-triangle approximation where one exists, " +
      "falling back to a documented standardised weight by counterparty class (a loud " +
      "requireWeight lookup — an unknown class fails, never a silent 0% PD). Surfaced figure " +
      "(calcKey `cva`) in CALC_BINDINGS. NO SILENT ZEROS: an OTC book with no uncollateralised " +
      "positive exposure yields a loud `no-otc-exposure` status (CVA is 0 by absence of " +
      "exposure), and a counterparty with no resolvable PD yields `insufficient-credit-inputs` — " +
      "both degraded (output null), never a silent 0. Distinct from the `rwa` binding's " +
      "`cvaRwaMinor` passthrough (BA 600 owns the regulatory RWA charge; this is the CVA figure).",
    methodologyDescription:
      "cva-engine-v1.0-standardised-ba-cva-sum-lgd-ead-pd-discount-credit-triangle-fallback-weight-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and RISK-MRP-01 §1.1/§2: CVA is the counterparty-credit-risk " +
      "valuation adjustment feeding the counterparty-credit-risk appetite and the BA-CVA / " +
      "IFRS 13 fair-value adjustment on the published financial statements. A misstated CVA " +
      "misstates the counterparty-credit-risk position and the fair-value adjustment. The bank " +
      "elects the standardised (no-hedge, no-correlation) sum as the most defensible build-phase " +
      "method while the OTC book is small and a full SA-CVA sensitivity engine is not yet built. " +
      "Methodology accountability + figure ownership: Helena (CRO). Full independent validation " +
      "applies. CLOSES WS-MODEL-REGISTRY-SCOPE-CLOSURE — the LAST declared model class in " +
      "RISK-MRP-01 §1.1; every model class is now registered + bound.",
    expiryDate: "2027-05-29",
  },
  // -- Product Control P&L Attribution (brief:bea:p-l-attribution-engine-fx-spot-mvp) --
  {
    modelId: "model:pnl-attribution-fx-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Product Control P&L Attribution engine (computePnLAttribution), FX-spot MVP. Decomposes the " +
      "day-over-day clean-P&L move into additive, reconciling components: new-trade P&L (trades " +
      "booked on reportDate), market-move P&L (Σ FxPositionRevalued delta on reportDate, cross-" +
      "checked against OfficialMarkAdopted per-instrumentKey deltas), carry/funding (MVP placeholder " +
      "— absent when no FTP curve covers the desk funding tenor, never a silent 0), realised P&L " +
      "(settlement increment), and an unexplained residual. The additive invariant " +
      "actualMove === newTrade + marketMove + carry + realised + residual is enforced both by a " +
      "zod .refine at event construction and by recon:pnl-attribution-reconciles. A live position " +
      "with no usable prior-day mark is excluded from market-move (tracked in unattributablePositions), " +
      "never folded in as 0. Full-reval / P&L-vector method (no Greeks); the non-FX extension adds a " +
      "risk-factor sensitivity sub-split on the component object without reshaping the event.",
    methodologyDescription:
      "pnl-attribution-fx-v1.0-additive-newtrade-marketmove-carry-realised-residual-full-reval-no-silent-zero",
    tierRationale:
      "Tier-1 under SR 11-7 §V and D-TRUSTED-FIGURES-PROGRAM-V1: the P&L Explain is the Product " +
      "Control control that validates the daily clean-P&L figure feeding the income statement — an " +
      "unexplained residual beyond tolerance is a loud control signal (FRTB-PLA analogue), and a " +
      "misstated attribution would let a P&L error pass unexplained. Figure ownership: Camille (CFO) " +
      "per the decision-authority routing table (CFO: finance close / P&L). Full independent " +
      "validation applies.",
    expiryDate: "2027-05-31",
  },
] as const;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CalcModelSeedResult {
  readonly submitted: string[];
  readonly tierClassified: string[];
  readonly approved: string[];
  readonly skipped: string[];
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

/**
 * Idempotently register + approve the regulatory-metric calc models that
 * calculation-binding.ts depends on. Submits (Rohan), tier-classifies +
 * approves (Nadia). Already-present steps are skipped per-model.
 */
export function seedCalcModels(store: EventStore): CalcModelSeedResult {
  const registry = new LocalModelRegistry({ eventStore: store });

  const submitted: string[] = [];
  const tierClassified: string[] = [];
  const approved: string[] = [];
  const skipped: string[] = [];

  // Already-approved modelIds (idempotency for the approval step).
  const alreadyApproved = new Set<string>();
  for (const ev of store.replay({ type: "ModelValidationApproved" })) {
    const p = ev.payload as Record<string, unknown>;
    const modelId = String(p.modelId ?? "");
    if (modelId) alreadyApproved.add(modelId);
  }

  for (const model of MODELS) {
    // ---- Submit (Rohan) ------------------------------------------------------
    const existing = new Set(registry.list().map((m) => m.modelId));
    if (existing.has(model.modelId)) {
      skipped.push(model.modelId);
    } else {
      const result = registry.submit({
        asOf: SEED_AS_OF,
        entity: ENTITY,
        actor: ROHAN_ACTOR,
        citations: CITATIONS,
        modelId: model.modelId,
        submittedBy: "agent:rohan:calc-model-seed",
        version: model.version,
        tier: model.tier,
        methodologyHash: methodologyHash(model.methodologyDescription),
        description: model.description,
      });
      if (result.status === "submitted") {
        submitted.push(model.modelId);
      } else {
        skipped.push(model.modelId);
      }
    }

    // ---- Classify tier (Nadia) ----------------------------------------------
    const current = registry.list().find((m) => m.modelId === model.modelId);
    if (!current) continue; // defensive — submit above should guarantee presence

    if (!current.tierClassified) {
      registry.classifyTier({
        asOf: SEED_AS_OF,
        entity: ENTITY,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        modelId: model.modelId,
        classifiedBy: "agent:nadia:calc-model-validation",
        tier: model.tier,
        rationale: model.tierRationale,
      });
      tierClassified.push(model.modelId);
    }

    // ---- Approve validation (Nadia) -----------------------------------------
    if (alreadyApproved.has(model.modelId)) {
      continue;
    }
    registry.approveValidation({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: model.modelId,
      version: current.latestVersion,
      approvedBy: "agent:nadia:calc-model-validation",
      validationFindingsResolved: [],
      expiryDate: model.expiryDate,
    });
    approved.push(model.modelId);
  }

  return { submitted, tierClassified, approved, skipped };
}
