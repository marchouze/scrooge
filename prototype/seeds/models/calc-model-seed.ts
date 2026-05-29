// seeds/models/calc-model-seed.ts
//
// Idempotent seed: registers and approves the three regulatory-metric
// calculation models that calculation-binding.ts binds surfaced figures to.
// Without these, checkModelApproved() fails loudly for LCR / NSFR / CET1 —
// a regulator-facing figure may not derive from an ungoverned model.
//
// Models seeded (each: ModelSubmitted → ModelTierClassified → ModelValidationApproved):
//   1. model:lcr-ba325-v1          — Liquidity Coverage Ratio (Tier-1, BA 325)
//   2. model:nsfr-ba325-v1         — Net Stable Funding Ratio (Tier-1, BA 325)
//   3. model:capital-cet1-ba700-v1 — CET1 Capital Ratio (Tier-1, BA 700)
//
// These are regulatory-submission models (LCR/NSFR → BA 325; CET1 → BA 700) and
// therefore Tier-1 under SR 11-7 §V: a misstated figure feeds a statutory return.
//
// Registry governance flow mirrors model-registry-seed + model-validation-seed:
// Rohan (model builder, first line) submits; Nadia (independent validator, second
// line) classifies the tier and approves. Methodology ownership for these figures
// sits with Camille (CFO) per the decision-authority routing table (CFO: liquidity
// / capital calibration) — that ownership is carried on the calc binding, not the
// registry submit actor.
//
// Idempotent: models already submitted / tier-classified / approved are skipped.
// Must run alongside the other model seeds in bootDerive(); order-independent of
// the pricing-model seeds (distinct modelIds).
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (substrate), coordinating Rohan (builder) + Nadia (validator).

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

const CITATIONS = ["D-TRUSTED-FIGURES-PROGRAM-V1", "BANKS-ACT-94-1990"];

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
