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
