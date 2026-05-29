// seeds/models/calc-model-seed.ts
//
// Idempotent seed: registers and approves the three regulatory-metric
// calculation models that calculation-binding.ts binds surfaced figures to.
// Without these, checkModelApproved() fails loudly for LCR / NSFR / CET1 —
// a regulator-facing figure may not derive from an ungoverned model.
//
// Models seeded (each: ModelSubmitted → ModelTierClassified → ModelValidationApproved):
//   1. model:lcr-ba325-v1               — Liquidity Coverage Ratio (Tier-1, BA 325)
//   2. model:nsfr-ba325-v1              — Net Stable Funding Ratio (Tier-1, BA 325)
//   3. model:capital-cet1-ba700-v1      — CET1 Capital Ratio (Tier-1, BA 700)
//   4. model:rwa-sa-v1                  — Risk-Weighted Assets, standardised (Tier-1, BA 700)
//   5. model:ecl-staging-ifrs9-v1       — IFRS 9 staging / SICR (Tier-1, IFRS 9 §B5.5)
//   6. model:ecl-pd-ifrs9-v1            — IFRS 9 12-month PD (Tier-1, IFRS 9 §B5.5)
//   7. model:ecl-lgd-ifrs9-v1           — IFRS 9 LGD (Tier-1, IFRS 9 §B5.5)
//   8. model:ecl-ead-ifrs9-v1           — IFRS 9 EAD (Tier-1, IFRS 9 §B5.5)
//   9. model:ecl-macro-overlay-ifrs9-v1 — IFRS 9 macroeconomic overlay (Tier-1, IFRS 9 §B5.5)
//  10. model:ecl-engine-ifrs9-v1        — IFRS 9 ECL computation engine (Tier-1, IFRS 9 §B5.5)
//
// These are regulatory-submission models (LCR/NSFR → BA 325; CET1/RWA → BA 700) and
// therefore Tier-1 under SR 11-7 §V: a misstated figure feeds a statutory return.
//
// `model:rwa-sa-v1` (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1, CEO session-delegation
// 2026-05-29) makes RWA a first-class governed figure. RWA was previously only an
// *input* to the CET1 binding — the denominator of every capital ratio — but was
// not itself a registered, owned, approved model. Closing that gap removes a live
// control weakness: under D-TRUSTED-FIGURES-PROGRAM-V1 every surfaced figure must
// trace to an approved model, and RWA is the most consequential capital figure the
// bank computes. Methodology ownership for RWA sits with Helena (CRO) per the
// decision-authority routing table (CRO: RWA / risk) — distinct from the CFO-owned
// liquidity/capital-ratio figures above; that ownership is carried on the calc
// binding, not the registry submit actor.
//
// Registry governance flow mirrors model-registry-seed + model-validation-seed:
// Rohan (model builder, first line) submits; Nadia (independent validator, second
// line) classifies the tier and approves. Methodology ownership for the LCR/NSFR/
// CET1 figures sits with Camille (CFO) per the decision-authority routing table
// (CFO: liquidity / capital calibration); RWA ownership sits with Helena (CRO).
// Ownership is carried on the calc binding, not the registry submit actor.
//
// Idempotent: models already submitted / tier-classified / approved are skipped.
// Must run alongside the other model seeds in bootDerive(); order-independent of
// the pricing-model seeds (distinct modelIds).
//
// The six IFRS 9 ECL models (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 2) are the ECL
// governance suite mandated by RISK-MRP-01 (Model Risk Policy v1) §5: staging (SICR),
// PD, LGD, EAD, macroeconomic overlay, and the ECL computation engine. All are Tier-1
// under SR 11-7 §V and RISK-MRP-01 §2.1 — IFRS 9 ECL models affect published financial
// statements and regulatory capital. Methodology accountability sits with Helena (CRO)
// per RISK-MRP-01 §3.4 (Helena approves all Tier-1 model validations); the impairment
// *figure* (the provision booked to the AFS) is owned by Camille (CFO) per the
// decision-authority routing table, and Camille confirms accounting-treatment
// consistency per RISK-MRP-01 §3.4. Only the ECL computation engine is bound as a
// *surfaced* figure in CALC_BINDINGS (calcKey `ecl`); the five component models are
// registered + governed but consumed by the engine, not surfaced directly.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29) — RWA + ECL suite.
// Author: Atlas (substrate), coordinating Rohan (Risk systems engineer, builder)
//   + Nadia (Independent-validation engineer, validator); RWA + ECL-suite slices
//   coordinated by Helena (Chief Risk Officer, governance — model-risk-policy owner),
//   with Camille (Chief Financial Officer, governance) confirming IFRS 9 accounting
//   treatment for the ECL suite.

import { createHash } from "node:crypto";

import type { EventStore } from "../../platform/event-store/store";
import type { Actor } from "../../platform/event-store/types";
import { LocalModelRegistry } from "../../platform/model-registry/index";

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

function methodologyHash(description: string): string {
  return createHash("sha256").update(description).digest("hex");
}

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

interface CalcModelDef {
  readonly modelId: string;
  readonly version: string;
  readonly tier: 1;
  readonly description: string;
  readonly methodologyDescription: string;
  readonly tierRationale: string;
  readonly expiryDate: string;
}

const MODELS: ReadonlyArray<CalcModelDef> = [
  {
    modelId: "model:lcr-ba325-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Liquidity Coverage Ratio engine (computeLCR). HQLA stock (post-haircut, L1/L2A/L2B " +
      "with caps) over net 30-day stressed cash outflows. Feeds the BA 325 liquidity return.",
    methodologyDescription:
      "lcr-ba325-v1.0-hqla-haircut-l1-l2a-l2b-caps-net-30d-stressed-outflows-runoff-rates",
    tierRationale:
      "Tier-1 under SR 11-7 §V: direct regulatory-submission consequence — the output feeds " +
      "the BA 325 statutory liquidity return to the PA. A misstated LCR is a regulatory " +
      "reporting failure. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:nsfr-ba325-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "Net Stable Funding Ratio engine (computeNSFR). Available Stable Funding over Required " +
      "Stable Funding, factor-weighted by tenor and counterparty class. Feeds the BA 325 return.",
    methodologyDescription: "nsfr-ba325-v1.0-asf-rsf-factor-weighting-tenor-counterparty-class",
    tierRationale:
      "Tier-1 under SR 11-7 §V: direct regulatory-submission consequence — the output feeds " +
      "the BA 325 statutory structural-liquidity return to the PA. Full independent validation applies.",
    expiryDate: "2027-05-29",
  },
  {
    modelId: "model:capital-cet1-ba700-v1",
    version: "1.0.0",
    tier: 1,
    description:
      "CET1 Capital Ratio engine (computeCapitalMetrics). Available CET1 capital over " +
      "risk-weighted assets (RWA engine, model:rwa-sa-v1). Feeds the BA 700 capital-adequacy return.",
    methodologyDescription: "capital-cet1-ba700-v1.0-available-cet1-over-rwa-sa-approach",
    tierRationale:
      "Tier-1 under SR 11-7 §V: direct regulatory-capital consequence — the output feeds the " +
      "BA 700 statutory capital-adequacy return to the PA and gates RAS capital limits. " +
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
      "and feeds the BA 700 capital-adequacy return.",
    methodologyDescription:
      "rwa-sa-v1.0-standardised-credit-cre20-market-mar-pre-frtb-operational-ope25-bic-ilm-cva-placeholder",
    tierRationale:
      "Tier-1 under SR 11-7 §V and Model Risk Policy RISK-MRP-01 §2: RWA is the direct " +
      "denominator of every regulatory capital ratio and feeds the BA 700 statutory " +
      "capital-adequacy return to the PA. A misstated RWA misstates CET1, Tier-1 and total " +
      "capital ratios and the RAS capital limits derived from them — the highest-consequence " +
      "capital figure the bank computes. Full independent validation applies. NOTE: the " +
      "prescribed inputs the engine consumes (SA risk-weight tables, BA 325 haircuts, SA-CCR " +
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
 * Idempotently register + approve the three regulatory-metric calc models that
 * calculation-binding.ts depends on. Submits (Rohan), tier-classifies + approves
 * (Nadia). Already-present steps are skipped per-model.
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
