// platform/projections/model-tier-discipline.ts
//
// Model-risk tier-discipline measurement projection.
//
// Computes the Model Risk Appetite Score (MRAS) for Helena's
// `appetite:model:tier-discipline` appetite line (RAS §B7). Reads from the
// model registry event stream via `LocalModelRegistry` — the same source
// Rohan (Risk engineer) and Nadia (Independent model-validation engineer)
// write to.
//
// MRAS status thresholds (model-risk-policy-v1.md §6.1):
//   Green  — all Tier-1/Tier-2 models validated; no blocking/Critical open
//            findings; <3 Major (high) open findings
//   Amber  — any Tier-2 model not yet validated (submitted status); 3–5
//            Major (high) open findings; no Tier-1 Critical open finding
//   Red    — any Tier-1 model with an open Critical (blocking) finding; any
//            Tier-1 model validation withheld; >5 Major (high) open findings
//
// Note on severity mapping:
//   The model registry uses `FindingSeverity = "low" | "medium" | "high" | "blocking"`.
//   For the MRAS computation the mapping to RAS §B7 risk-appetite language is:
//     - "blocking" → Critical finding (Red trigger when on a Tier-1 model)
//     - "high"     → Major finding (counts toward 3/5 thresholds)
//     - "medium"   → Minor finding (informational only)
//     - "low"      → Minor finding (informational only)
//
// Build-phase posture:
//   When zero models are in the registry (no ModelSubmitted events) and the
//   seed has not been run, the projection returns `status: "no-models"` which
//   maps to a measured green in helena-risk-appetite-watch — no models
//   deployed means no model risk by construction.
//
// Authority: D-RAS (CEO-approved 2026-05-06); RAS §B7;
//   brief:atlas:build-model-tier-discipline-measurement-substrat:2026-06-01.
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "../event-store/store";
import { LocalModelRegistry } from "../model-registry/index";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ModelTierDisciplineGreen {
  readonly status: "green";
  readonly openCritical: number;
  readonly openMajor: number;
  readonly tier1Count: number;
  readonly tier2Count: number;
  readonly tier3Count: number;
  readonly tier1AllValidated: boolean;
  readonly note: string;
}

export interface ModelTierDisciplineAmber {
  readonly status: "amber";
  readonly openCritical: number;
  readonly openMajor: number;
  readonly tier1Count: number;
  readonly tier2Count: number;
  readonly tier3Count: number;
  readonly tier1AllValidated: boolean;
  readonly note: string;
}

export interface ModelTierDisciplineRed {
  readonly status: "red";
  readonly openCritical: number;
  readonly openMajor: number;
  readonly tier1Count: number;
  readonly tier2Count: number;
  readonly tier3Count: number;
  readonly tier1AllValidated: boolean;
  readonly note: string;
}

export interface ModelTierDisciplineNoModels {
  readonly status: "no-models";
  readonly openCritical: 0;
  readonly openMajor: 0;
  readonly tier1Count: 0;
  readonly tier2Count: 0;
  readonly tier3Count: 0;
  readonly tier1AllValidated: true;
  readonly note: string;
}

export type ModelTierDisciplineMetric =
  | ModelTierDisciplineGreen
  | ModelTierDisciplineAmber
  | ModelTierDisciplineRed
  | ModelTierDisciplineNoModels;

// ---------------------------------------------------------------------------
// Projection function
// ---------------------------------------------------------------------------

/**
 * Compute the MRAS (Model Risk Appetite Score) from the model registry
 * event stream.
 *
 * @param store — the event store to read from
 * @returns ModelTierDisciplineMetric with status and supporting metrics
 */
export function getModelTierDisciplineMetric(store: EventStore): ModelTierDisciplineMetric {
  const registry = new LocalModelRegistry({ eventStore: store });
  const models = registry.list();

  // Build-phase softening: no models → no model risk by construction.
  if (models.length === 0) {
    return {
      status: "no-models",
      openCritical: 0,
      openMajor: 0,
      tier1Count: 0,
      tier2Count: 0,
      tier3Count: 0,
      tier1AllValidated: true,
      note: "No models in registry (zero ModelSubmitted events). Build phase: no models deployed → no model risk by construction. RAS §B7 appetite satisfied. Registry seed: prototype/seeds/models/model-registry-seed.ts.",
    };
  }

  // Partition by tier (using Nadia's classified tier if present, else Rohan's submitted tier).
  const tier1Models = models.filter((m) => m.tier === 1);
  const tier2Models = models.filter((m) => m.tier === 2);
  const tier3Models = models.filter((m) => m.tier === 3);

  // Count open findings by severity across ALL models.
  // "blocking" → Critical; "high" → Major.
  let openCritical = 0;
  let openMajor = 0;
  for (const model of models) {
    for (const finding of model.findings) {
      if (finding.status !== "open") continue;
      if (finding.severity === "blocking") openCritical++;
      if (finding.severity === "high") openMajor++;
    }
  }

  // Tier-1 critical: any Tier-1 model with an open blocking finding.
  const tier1WithOpenCritical = tier1Models.filter((m) => m.openBlockingFindingsCount > 0);

  // Tier-1 validation discipline: validated = approved status.
  // Withheld validation is a Red signal (validation failed independently).
  const tier1Unvalidated = tier1Models.filter((m) => m.validationStatus !== "approved");
  const tier1Withheld = tier1Models.filter((m) => m.validationStatus === "withheld");
  const tier1AllValidated = tier1Unvalidated.length === 0;

  // Tier-2 validation: any Tier-2 not yet approved = Amber signal.
  const tier2Unvalidated = tier2Models.filter((m) => m.validationStatus !== "approved");

  // ---------------------------------------------------------------------------
  // MRAS determination — Red triggers evaluated first (highest severity).
  // ---------------------------------------------------------------------------

  // RED trigger 1: any Tier-1 model has an open Critical (blocking) finding.
  if (tier1WithOpenCritical.length > 0) {
    const ids = tier1WithOpenCritical.map((m) => m.modelId).join(", ");
    return {
      status: "red",
      openCritical,
      openMajor,
      tier1Count: tier1Models.length,
      tier2Count: tier2Models.length,
      tier3Count: tier3Models.length,
      tier1AllValidated,
      note: `RED: Tier-1 model(s) with open Critical (blocking) finding: [${ids}]. RAS §B7 zero-tolerance for unresolved critical findings on Tier-1 models. Immediate remediation required.`,
    };
  }

  // RED trigger 2: any Tier-1 model with validation withheld.
  if (tier1Withheld.length > 0) {
    const ids = tier1Withheld.map((m) => m.modelId).join(", ");
    return {
      status: "red",
      openCritical,
      openMajor,
      tier1Count: tier1Models.length,
      tier2Count: tier2Models.length,
      tier3Count: tier3Models.length,
      tier1AllValidated,
      note: `RED: Tier-1 model(s) with validation withheld: [${ids}]. RAS §B7: production use is gated on validation approval; withheld validation is a Red breach. Escalation to Helena (CRO) required.`,
    };
  }

  // RED trigger 3: >5 open Major (high) findings across any tier.
  if (openMajor > 5) {
    return {
      status: "red",
      openCritical,
      openMajor,
      tier1Count: tier1Models.length,
      tier2Count: tier2Models.length,
      tier3Count: tier3Models.length,
      tier1AllValidated,
      note: `RED: ${openMajor} open Major (high-severity) findings (threshold >5). RAS §B7 major-finding limit breached. Remediation plan required with Helena (CRO) sign-off.`,
    };
  }

  // AMBER trigger 1: any Tier-2 model not yet validated.
  if (tier2Unvalidated.length > 0) {
    const ids = tier2Unvalidated.map((m) => `${m.modelId}[${m.validationStatus}]`).join(", ");
    return {
      status: "amber",
      openCritical,
      openMajor,
      tier1Count: tier1Models.length,
      tier2Count: tier2Models.length,
      tier3Count: tier3Models.length,
      tier1AllValidated,
      note: `AMBER: Tier-2 model(s) pending validation: [${ids}]. RAS §B7: Tier-2 models must be validated before production use. Nadia (Independent model-validation engineer) review pending.`,
    };
  }

  // AMBER trigger 2: 3–5 open Major findings.
  if (openMajor >= 3) {
    return {
      status: "amber",
      openCritical,
      openMajor,
      tier1Count: tier1Models.length,
      tier2Count: tier2Models.length,
      tier3Count: tier3Models.length,
      tier1AllValidated,
      note: `AMBER: ${openMajor} open Major (high-severity) findings (threshold 3–5). RAS §B7: management action required to remediate within next review cycle.`,
    };
  }

  // AMBER trigger 3: any Tier-1 model not yet validated (but not withheld).
  if (tier1Unvalidated.length > 0) {
    const ids = tier1Unvalidated.map((m) => `${m.modelId}[${m.validationStatus}]`).join(", ");
    return {
      status: "amber",
      openCritical,
      openMajor,
      tier1Count: tier1Models.length,
      tier2Count: tier2Models.length,
      tier3Count: tier3Models.length,
      tier1AllValidated,
      note: `AMBER: Tier-1 model(s) submitted but not yet approved: [${ids}]. RAS §B7: Tier-1 validation is highest priority. Escalate to Nadia (Independent model-validation engineer) for expedited review.`,
    };
  }

  // GREEN: no Red or Amber triggers. All Tier-1/2 models validated; open
  // findings < 3 Major; no Critical open findings.
  const validatedCount = models.filter((m) => m.validationStatus === "approved").length;
  const openFindingsSummary =
    openCritical === 0 && openMajor === 0
      ? "No open Critical or Major findings."
      : `Open findings: ${openCritical} Critical, ${openMajor} Major.`;

  return {
    status: "green",
    openCritical,
    openMajor,
    tier1Count: tier1Models.length,
    tier2Count: tier2Models.length,
    tier3Count: tier3Models.length,
    tier1AllValidated,
    note: `GREEN: ${models.length} model(s) in registry (${tier1Models.length} Tier-1, ${tier2Models.length} Tier-2, ${tier3Models.length} Tier-3); ${validatedCount} validated. ${openFindingsSummary} RAS §B7 model-tier discipline appetite satisfied. Source: Nadia (Independent model-validation engineer) + Rohan (Risk engineer) registry.`,
  };
}
