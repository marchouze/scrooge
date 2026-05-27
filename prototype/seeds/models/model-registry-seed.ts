// seeds/models/model-registry-seed.ts
//
// Idempotent seed: ModelSubmitted × 3 + ModelTierClassified × 3 for the three
// M2/M3/M4 pricing models that require model-risk validation before their NPA
// model-risk dimension can be upgraded to implementation-attested.
//
// Models seeded:
//   1. model:sagb-dcf-v1          — SAGB fixed-coupon DCF (Tier-3)
//   2. model:zaronia-ois-irspv-v1  — ZARONIA OIS curve + IRS PV engine (Tier-2)
//   3. model:fx-forward-irp-v1    — FX forward interest-rate parity (Tier-3)
//
// Rohan (Risk engineer) submits each model. Nadia (Independent model-validation
// engineer) classifies the tier, confirming or overriding Rohan's submission tier.
//
// Must run BEFORE model-validation-seed.ts (which signs off validations).
// Idempotent: models with an existing ModelSubmitted event are skipped.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Rohan (Risk engineer) + Nadia (Independent model-validation engineer)

import { createHash } from "node:crypto";

import type { EventStore } from "../../platform/event-store/store";
import type { Actor } from "../../platform/event-store/types";
import { LocalModelRegistry } from "../../platform/model-registry/index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const SEED_AS_OF = "2026-05-27T00:00:00.000Z";

const ROHAN_ACTOR: Actor = { type: "service", id: "agent:rohan:model-registry-seed" };
const NADIA_ACTOR: Actor = { type: "service", id: "agent:nadia:model-tier-classification" };

const CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

// Stable methodology hash — sha256 of a canonical description string.
// The hash must be a 64-char lowercase hex sha256.
function methodologyHash(description: string): string {
  return createHash("sha256").update(description).digest("hex");
}

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

interface ModelDef {
  readonly modelId: string;
  readonly version: string;
  readonly rohanTier: 1 | 2 | 3;
  readonly nadiaTier: 1 | 2 | 3;
  readonly description: string;
  readonly methodologyDescription: string;
  readonly tierRationale: string;
}

const MODELS: ReadonlyArray<ModelDef> = [
  {
    modelId: "model:sagb-dcf-v1",
    version: "1.0.0",
    rohanTier: 3,
    nadiaTier: 3,
    description:
      "SAGB fixed-coupon bond DCF valuation. " +
      "BESA market-yield-curve discount; accrued-interest and dirty-price computation. " +
      "Pricing is primarily quote-driven; DCF used for accrued-interest calculation.",
    methodologyDescription: "sagb-dcf-model-v1.0-besa-yield-curve-dcf-accrued-interest-dirty-price",
    tierRationale:
      "Tier-3 under SR 11-7 §V: standard textbook DCF methodology; well-documented market " +
      "convention (JSE/BESA bond math); limited discretion. No regulatory-capital or " +
      "IFRS 9 ECL consequence — Tier-1 criteria not met. No bespoke curve construction — " +
      "Tier-2 criteria not met. Proportionate validation applies per RAS § B7.",
  },
  {
    modelId: "model:zaronia-ois-irspv-v1",
    version: "1.0.0",
    rohanTier: 2,
    nadiaTier: 2,
    description:
      "ZARONIA OIS discount curve construction + standard IRS present-value engine. " +
      "Floating leg resets to SARB-published daily ZARONIA compounded rate. " +
      "Fixed leg uses semi-annual JIHCAL schedule. " +
      "Curve construction uses bootstrap from ZARONIA overnight + tenor instruments.",
    methodologyDescription:
      "zaronia-ois-curve-v1.0-bootstrap-overnight-tenor-irs-pv-fixed-float-zaronia-sarb",
    tierRationale:
      "Tier-2 under SR 11-7 §V: bespoke OIS curve construction (SARB ZARONIA data dependency); " +
      "risk sensitivity material at pre-licence ICAAP rehearsal stage. " +
      "Commercial consequence: mispricing of IRS positions affects P&L and RAS MR-2 limit " +
      "utilisation. No direct regulatory-capital submission — Tier-1 not met. " +
      "RAS § B7: pricing engines → Tier-2 classification.",
  },
  {
    modelId: "model:fx-forward-irp-v1",
    version: "1.0.0",
    rohanTier: 3,
    nadiaTier: 3,
    description:
      "FX forward pricing via covered interest-rate parity (IRP). " +
      "Near and far legs priced from USD and ZAR overnight rates. " +
      "No optionality or complex curve construction.",
    methodologyDescription:
      "fx-forward-covered-irp-v1.0-near-far-leg-usd-zar-overnight-rate-textbook-convention",
    tierRationale:
      "Tier-3 under SR 11-7 §V: standard textbook methodology (covered interest-rate parity); " +
      "well-understood market convention; limited discretion in implementation. " +
      "No regulatory-capital or IFRS 9 consequence — Tier-1 not met. " +
      "No bespoke curve construction — Tier-2 not met. " +
      "Proportionate validation applies per RAS § B7.",
  },
] as const;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ModelRegistrySeedResult {
  readonly submitted: string[];
  readonly tierClassified: string[];
  readonly skipped: string[];
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

/**
 * Idempotent seed: submits 3 pricing models (Rohan) and classifies their tiers
 * (Nadia). Must run before model-validation-seed.ts.
 *
 * Idempotent: models already submitted are skipped; tier classifications already
 * present are skipped.
 */
export function seedModelRegistry(store: EventStore): ModelRegistrySeedResult {
  const registry = new LocalModelRegistry({ eventStore: store });

  const submitted: string[] = [];
  const tierClassified: string[] = [];
  const skipped: string[] = [];

  // Single scan — collect already-submitted modelIds.
  const existing = new Set(registry.list().map((m) => m.modelId));

  for (const model of MODELS) {
    // ---- Submit (Rohan) -------------------------------------------------------
    if (existing.has(model.modelId)) {
      skipped.push(model.modelId);
    } else {
      const result = registry.submit({
        asOf: SEED_AS_OF,
        entity: ENTITY,
        actor: ROHAN_ACTOR,
        citations: CITATIONS,
        modelId: model.modelId,
        submittedBy: "agent:rohan:model-registry-seed",
        version: model.version,
        tier: model.rohanTier,
        methodologyHash: methodologyHash(model.methodologyDescription),
        description: model.description,
      });
      if (result.status === "submitted") {
        submitted.push(model.modelId);
      } else {
        skipped.push(model.modelId);
      }
    }

    // ---- Classify tier (Nadia) -----------------------------------------------
    // Read fresh state after possible submit above.
    const currentModels = registry.list();
    const current = currentModels.find((m) => m.modelId === model.modelId);

    if (!current) {
      // Should not happen after submit above; skip defensively.
      continue;
    }

    if (current.tierClassified) {
      // Tier already classified — idempotent skip.
      continue;
    }

    registry.classifyTier({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: model.modelId,
      classifiedBy: "agent:nadia:model-tier-classification",
      tier: model.nadiaTier,
      rationale: model.tierRationale,
    });
    tierClassified.push(model.modelId);
  }

  return { submitted, tierClassified, skipped };
}
