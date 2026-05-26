// platform/markets/products/model-risk-substrate-gaps.ts
//
// Slice 7 — Typed model-risk substrate gap registry for products whose
// model-risk NPA dimension remains design-attested pending Nadia's
// validation-methodology library and the model registry substrate.
//
// These gaps are the authoritative roadmap items required by
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 7 exit criterion:
//   "Each manual-attestation card has a named substrate gap and an owner;
//    gaps are roadmap items in the substrate-completeness budget."
//
// Products with model-risk already implementation-attested (no model used):
//   - prd:bank:equity:jse-equity-cash  (see run-npa-model-risk-upgrade.ts)
//   - prd:bank:bond:open-repo-gmra     (see run-npa-model-risk-upgrade.ts)
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

export type ModelRiskTier = "tier-1" | "tier-2" | "tier-3" | "none";
export type MPhaseTarget = "M2" | "M3" | "M4" | "pre-licence";

export interface ModelRiskSubstrateGap {
  /** Product URN. */
  readonly productId: string;
  /** SR 11-7 / Nadia tier classification for the primary pricing model. */
  readonly modelTier: ModelRiskTier;
  /** One-line description of the model(s) that require validation. */
  readonly modelDescription: string;
  /** Substrate components that must land before implementation-attested. */
  readonly blockers: readonly string[];
  /** Engineering owner for the substrate build. */
  readonly engineeringOwner: string;
  /** Governance authority for the methodology sign-off. */
  readonly governanceOwner: string;
  /** M-phase target for implementation-attested upgrade. */
  readonly targetMPhase: MPhaseTarget;
  /** Citations anchoring the gap. */
  readonly citations: readonly string[];
}

export const MODEL_RISK_SUBSTRATE_GAPS: readonly ModelRiskSubstrateGap[] = [
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    modelTier: "tier-3",
    modelDescription:
      "Fixed-coupon bond DCF valuation using BESA market yield curves. " +
      "Pricing is primarily quote-driven; DCF is used for accrued-interest " +
      "and dirty-price computation. Tier-3 under SR 11-7 (standard, " +
      "well-documented methodology; limited discretion).",
    blockers: [
      "Nadia validation-methodology library: Tier-3 methodology version " +
        "published (ValidationMethodologyPublished event)",
      "Pricing-model registry entry for SAGB DCF model (Rohan + Anya, " + "ModelRegistered event)",
      "Nadia ModelValidationApproved event for the SAGB DCF model",
    ],
    engineeringOwner: "Rohan (Risk systems engineer, engineering)",
    governanceOwner: "Nadia (Independent-validation engineer) / Helena (CRO, governance)",
    targetMPhase: "M2",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
  },
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    modelTier: "tier-2",
    modelDescription:
      "ZARONIA OIS curve construction + standard IRS present-value engine. " +
      "Floating leg resets to SARB-published daily ZARONIA; fixed leg uses " +
      "semi-annual JIHCAL schedule. Tier-2 under SR 11-7 (bespoke curve " +
      "construction; SARB-data dependency; model risk material at pre-licence " +
      "ICAAP rehearsal stage).",
    blockers: [
      "Nadia validation-methodology library: Tier-2 methodology version " +
        "published (ValidationMethodologyPublished event)",
      "Pricing-model registry entry for ZARONIA OIS curve + IRS PV engine " +
        "(Rohan + Anya, ModelRegistered events)",
      "Nadia ModelValidationApproved event for the ZARONIA OIS curve model " +
        "(Tier-2 sign-off; 20 working-day window per Nadia §7)",
      "SARB market-data feed for ZARONIA daily compounded rates " +
        "(Ravi market-data infrastructure)",
    ],
    engineeringOwner: "Rohan (Risk systems engineer, engineering)",
    governanceOwner: "Nadia (Independent-validation engineer) / Helena (CRO, governance)",
    targetMPhase: "M3",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
  },
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    modelTier: "tier-3",
    modelDescription:
      "Forward FX pricing via interest-rate parity (covered IRP). " +
      "Near and far legs priced from USD and ZAR overnight rates; " +
      "no optionality or complex curve construction. Tier-3 under SR 11-7 " +
      "(standard textbook methodology; well-understood market convention).",
    blockers: [
      "Nadia validation-methodology library: Tier-3 methodology version " +
        "published (ValidationMethodologyPublished event)",
      "Pricing-model registry entry for FX forward IRP model " +
        "(Rohan + Anya, ModelRegistered event)",
      "Nadia ModelValidationApproved event for the FX forward model",
    ],
    engineeringOwner: "Rohan (Risk systems engineer, engineering)",
    governanceOwner: "Nadia (Independent-validation engineer) / Helena (CRO, governance)",
    targetMPhase: "M4",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
  },
] as const;
