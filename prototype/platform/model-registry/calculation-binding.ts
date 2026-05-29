// platform/model-registry/calculation-binding.ts
//
// Binds each financial-calculation engine to a *registered, owned* model.
// Objective 3 of the Trusted-Figures Program: calculations are models,
// owned by an accountable agent, shared and re-used. A figure surfaced to
// the UI (or a regulator) must trace to a model that exists and is
// `approved` in the event-folded model registry — otherwise computing it
// is a loud failure, not a silent number.
//
// This is the link the registry was missing: the registry tracked model
// *governance* (submit / tier / validate / approve) but nothing bound the
// actual calc functions (computeLCR, computeNSFR, computeCapitalMetrics,
// RWA engine) to those governed models. This module is that binding.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (substrate), coordinating Rohan (builder) + Nadia (validator);
//   model ownership per the decision-authority routing table (CFO: liquidity /
//   capital calibration; CRO: RWA / risk).

import type { EventStore } from "../event-store/store";
import { LocalModelRegistry } from "./index";

/** A declared input to a bound calculation. */
export interface CalcInputContract {
  readonly name: string;
  /** Required inputs missing → status `failed` (no output). Optional → `degraded`. */
  readonly required: boolean;
  readonly unit: string;
  /** Where the input is expected to come from (event type / source lineage). */
  readonly expectedFrom: string;
}

/** Binding of a calc engine to an owned, registered model. */
export interface CalcBinding {
  /** Stable key for the calc engine (used by emitters + recon). */
  readonly calcKey: string;
  /** Human-readable figure this engine produces. */
  readonly figure: string;
  /** Registered model in the model registry. */
  readonly modelId: string;
  readonly modelVersion: string;
  /** Agent accountable for the model's methodology (name + position). */
  readonly owningAgent: string;
  readonly outputUnit: string;
  readonly inputContract: readonly CalcInputContract[];
  /** Citations carried on emitted CalculationPerformed events. */
  readonly citations: readonly string[];
}

const PROGRAM = "D-TRUSTED-FIGURES-PROGRAM-V1";

// ---------------------------------------------------------------------------
// Bindings — the canonical registry of "which model computes which figure".
// modelId values must be seeded (seeds/models/calc-model-seed.ts) so that
// assertModelApproved() finds an `approved` model.
// ---------------------------------------------------------------------------

export const CALC_BINDINGS: Readonly<Record<string, CalcBinding>> = {
  lcr: {
    calcKey: "lcr",
    figure: "Liquidity Coverage Ratio",
    modelId: "model:lcr-ba325-v1",
    modelVersion: "1.0.0",
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "pct",
    citations: [PROGRAM, "BANKS-ACT-94-1990", "BA-325"],
    inputContract: [
      {
        name: "hqlaZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM HQLA positions (getALMPositionSnapshot)",
      },
      {
        name: "netCashOutflowsZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM funding positions (getALMPositionSnapshot)",
      },
    ],
  },
  nsfr: {
    calcKey: "nsfr",
    figure: "Net Stable Funding Ratio",
    modelId: "model:nsfr-ba325-v1",
    modelVersion: "1.0.0",
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "pct",
    citations: [PROGRAM, "BANKS-ACT-94-1990", "BA-325"],
    inputContract: [
      {
        name: "asfZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM ASF items (getALMPositionSnapshot)",
      },
      {
        name: "rsfZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM RSF items (getALMPositionSnapshot)",
      },
    ],
  },
  "capital-cet1": {
    calcKey: "capital-cet1",
    figure: "CET1 Capital Ratio",
    modelId: "model:capital-cet1-ba700-v1",
    modelVersion: "1.0.0",
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "pct",
    citations: [PROGRAM, "BANKS-ACT-94-1990", "BA-700"],
    inputContract: [
      {
        name: "availableCapitalMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "computeCapitalMetrics (capital events)",
      },
      {
        name: "rwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine (model:rwa-sa-v1)",
      },
    ],
  },
  rwa: {
    calcKey: "rwa",
    figure: "Risk-Weighted Assets",
    modelId: "model:rwa-sa-v1",
    modelVersion: "1.0.0",
    // RWA methodology ownership sits with the CRO per the decision-authority
    // routing table (CRO: RWA / risk) — distinct from the CFO-owned capital-ratio
    // figures above. RWA is the denominator of every capital ratio, so making it a
    // first-class governed figure (rather than an ungoverned input to capital-cet1)
    // closes the D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 control gap.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BA-700"],
    inputContract: [
      {
        name: "creditRwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine credit section (computeRwa: Σ creditExposures EAD × CRE20 RW)",
      },
      {
        name: "marketRwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom:
          "RWA engine market section (computeRwa: 12.5 × Σ tradingBookPositions capital charge)",
      },
      {
        name: "operationalRwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine operational section (computeRwa: 12.5 × BIC × ILM, OPE25)",
      },
      {
        name: "cvaRwaMinor",
        required: false,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine CVA passthrough (computeRwa input cvaRwaMinor; BA 600 owns)",
      },
    ],
  },
  ecl: {
    calcKey: "ecl",
    figure: "IFRS 9 Expected Credit Loss",
    modelId: "model:ecl-engine-ifrs9-v1",
    modelVersion: "1.0.0",
    // ECL is an IFRS 9 impairment figure that lands on the published financial
    // statements — methodology accountability sits with Helena (CRO) per the
    // model-risk policy (RISK-MRP-01 §5: IFRS 9 ECL suite is a sub-domain of the
    // Model Risk Policy), while the impairment *figure* (the provision booked) is
    // owned by Camille (CFO) per the decision-authority routing table (CFO: IFRS
    // accounting policy / AFS). The owningAgent on the binding is the figure
    // owner; the model-registry methodology owner is Helena, carried on the
    // model's tier rationale, not here. Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1.
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "IFRS-9-B5.5", "BANKS-ACT-94-1990"],
    inputContract: [
      {
        // Optional: an empty debt book is a legitimate "no in-scope exposure"
        // state, not a data-integrity fault. An absent EAD degrades the figure
        // (status `degraded`, surfaced loudly) rather than failing it — the
        // ECL is 0 by absence of exposure, never a silently-computed 0.
        name: "eadMinor",
        required: false,
        unit: "ZAR-minor",
        expectedFrom:
          "ECL engine EAD read (model:ecl-ead-ifrs9-v1): Σ |net nominal × clean price| folded per ISIN from BondTradeExecuted",
      },
      {
        name: "pdLgdParameterised",
        required: true,
        unit: "bool",
        expectedFrom:
          "ECL engine PD × LGD parameters (model:ecl-pd-ifrs9-v1, model:ecl-lgd-ifrs9-v1); loud requireWeight lookup by risk bucket",
      },
      {
        name: "stagingClassified",
        required: true,
        unit: "bool",
        expectedFrom:
          "ECL engine staging (model:ecl-staging-ifrs9-v1): assessIfrs9Stage() per in-scope debt exposure",
      },
    ],
  },
  "irrbb-eve": {
    calcKey: "irrbb-eve",
    figure: "IRRBB ΔEVE (Economic Value of Equity sensitivity)",
    modelId: "model:irrbb-eve-engine-v1",
    modelVersion: "1.0.0",
    // ΔEVE is the economic-value (Pillar-2) IRRBB measure: the change in the
    // present value of the banking book under the six BCBS d368 standard rate
    // shocks. Methodology accountability sits with Helena (CRO) per RISK-MRP-01
    // §5 (IRRBB is a declared sub-domain of the Model Risk Policy) — the EVE
    // figure is the risk-measure owner's figure, so the binding owner is Helena.
    // ALM repricing/behavioural assumptions are owned by Eitan (Treasurer),
    // carried on model:irrbb-repricing-v1, not here. Authority:
    // D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D368"],
    inputContract: [
      {
        // Optional: an empty banking book is a legitimate "no repricing-sensitive
        // position" state, not a data-integrity fault. An absent repricing base
        // degrades the figure (status `degraded`, surfaced loudly) rather than
        // failing it — ΔEVE is 0 by absence of positions, never a silent 0.
        name: "repricingBaseZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "IRRBB repricing/behavioural model (model:irrbb-repricing-v1): Σ |bucket net gap| from computeRepricingGap (banking-book RSA − RSL across BCBS buckets)",
      },
      {
        name: "shockScenariosApplied",
        required: true,
        unit: "count",
        expectedFrom:
          "EVE engine (model:irrbb-eve-engine-v1): the six BCBS d368 standard shocks (parallel up/down, steepener, flattener, short up/down)",
      },
    ],
  },
  "irrbb-nii": {
    calcKey: "irrbb-nii",
    figure: "IRRBB ΔNII (12-month Net-Interest-Income sensitivity)",
    modelId: "model:irrbb-nii-engine-v1",
    modelVersion: "1.0.0",
    // ΔNII is the earnings-perspective IRRBB measure: the change in projected
    // 12-month net interest income under parallel rate shocks. The earnings
    // *figure* is owned by Camille (CFO) per the decision-authority routing
    // table (CFO: earnings / financial figures); the methodology accountability
    // sits with Helena (CRO) per RISK-MRP-01 §5, carried on the model registry,
    // and the ALM repricing/behavioural inputs are owned by Eitan (Treasurer)
    // on model:irrbb-repricing-v1. The owningAgent here is the figure owner.
    // Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3.
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D368"],
    inputContract: [
      {
        name: "repricingBaseZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "IRRBB repricing/behavioural model (model:irrbb-repricing-v1): Σ |bucket net gap| from computeRepricingGap over the 12-month NII horizon (RSA − RSL by bucket year-fraction)",
      },
      {
        name: "shockScenariosApplied",
        required: true,
        unit: "count",
        expectedFrom:
          "NII engine (model:irrbb-nii-engine-v1): the parallel rate shocks over the 12-month earnings horizon (BCBS d368 §III earnings measure)",
      },
    ],
  },
} as const;

/** Look up a binding by calc key. Throws (loud) on an unknown key. */
export function getCalcBinding(calcKey: string): CalcBinding {
  const binding = CALC_BINDINGS[calcKey];
  if (!binding) {
    throw new Error(
      `calculation-binding: no binding registered for calcKey '${calcKey}'. ` +
        `Every surfaced figure must bind to an owned model (${PROGRAM}).`,
    );
  }
  return binding;
}

export interface ModelApprovalCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Assert that the model bound to `calcKey` exists and is `approved` in the
 * event-folded registry. A missing or unapproved model is a loud failure:
 * a regulator-facing figure may not be derived from an ungoverned model.
 *
 * Returns a structured result rather than throwing so callers can degrade
 * the figure to `status: "failed"` + surface it, rather than crash the
 * whole derive cycle.
 */
export function checkModelApproved(store: EventStore, calcKey: string): ModelApprovalCheck {
  const binding = getCalcBinding(calcKey);
  const registry = new LocalModelRegistry({ eventStore: store });
  const model = registry.list().find((m) => m.modelId === binding.modelId);
  if (!model) {
    return {
      ok: false,
      reason: `bound model '${binding.modelId}' is not registered (figure '${binding.figure}')`,
    };
  }
  if (model.validationStatus !== "approved") {
    return {
      ok: false,
      reason: `bound model '${binding.modelId}' is '${model.validationStatus}', not 'approved' (figure '${binding.figure}')`,
    };
  }
  return { ok: true };
}

/** All registered calc keys (for recon coverage). */
export function allCalcKeys(): string[] {
  return Object.keys(CALC_BINDINGS);
}
