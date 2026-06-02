// platform/model-registry/pricing-model-definitions.ts
//
// Platform module: all pricing-model seed functions extracted from the
// retired boot seeds (model-registry-seed, model-validation-seed,
// model-registered-seed). These are now standalone, testable functions
// that can be called from one-shot scripts or CI utilities — they are
// no longer wired into the dashboard boot sequence.
//
// Exports (all idempotent):
//   - seedModelRegistry(store)           — ModelSubmitted × 3 + ModelTierClassified × 3
//   - seedValidationMethodologies(store) — ValidationMethodologyPublished × 2 (v0.1)
//   - seedModelValidations(store)        — ModelValidationApproved × 3
//   - seedModelRegisteredEvents(store)   — ModelRegistered × 3 + MethodologyPublished × 2 (v1)
//                                          + ModelValidationApproved × 3
//
// Scripts:
//   - scripts/run-model-registry-seed.ts
//   - scripts/run-model-validation-seed.ts
//   - scripts/run-model-registered-seed.ts
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Authors: Rohan (Risk systems engineer, engineering)
//          Anya (Quantitative analyst, engineering)
//          Nadia (Chief Model Risk Officer, governance)
//          Atlas (Core banking platform architect, engineering)

import { createHash } from "node:crypto";

import {
  makeModelValidationApproved,
  makeValidationMethodologyPublished,
} from "../event-store/event-types/model-risk";
import { makeModelRegistered } from "../event-store/event-types/risk-treasury-extended";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { LocalModelRegistry } from "./index";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const SEED_AS_OF = "2026-05-27T00:00:00.000Z";

const CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

// ---------------------------------------------------------------------------
// seedModelRegistry
// ---------------------------------------------------------------------------
// (moved from seeds/models/model-registry-seed.ts)

const ROHAN_REGISTRY_ACTOR: Actor = {
  type: "service",
  id: "agent:rohan:model-registry-seed",
};
const NADIA_REGISTRY_ACTOR: Actor = {
  type: "service",
  id: "agent:nadia:model-tier-classification",
};

function methodologyHash(description: string): string {
  return createHash("sha256").update(description).digest("hex");
}

interface ModelDef {
  readonly modelId: string;
  readonly version: string;
  readonly rohanTier: 1 | 2 | 3;
  readonly nadiaTier: 1 | 2 | 3;
  readonly description: string;
  readonly methodologyDescription: string;
  readonly tierRationale: string;
}

const REGISTRY_MODELS: ReadonlyArray<ModelDef> = [
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

export interface ModelRegistrySeedResult {
  readonly submitted: string[];
  readonly tierClassified: string[];
  readonly skipped: string[];
}

/**
 * Idempotent seed: submits 3 pricing models (Rohan) and classifies their tiers
 * (Nadia). Must run before seedModelValidations.
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

  for (const model of REGISTRY_MODELS) {
    // ---- Submit (Rohan) -------------------------------------------------------
    if (existing.has(model.modelId)) {
      skipped.push(model.modelId);
    } else {
      const result = registry.submit({
        asOf: SEED_AS_OF,
        entity: ENTITY,
        actor: ROHAN_REGISTRY_ACTOR,
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
      actor: NADIA_REGISTRY_ACTOR,
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

// ---------------------------------------------------------------------------
// seedValidationMethodologies
// ---------------------------------------------------------------------------
// (moved from seeds/models/model-validation-seed.ts)

const NADIA_VALIDATION_ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };

const TIER2_METHODOLOGY = {
  methodologyId: "validation-methodology:tier-2:v0.1",
  tier: 2 as const,
  version: "v0.1",
  publishedBy: "agent:nadia:model-validation",
  // Stable string anchored to methodology identity — not a file hash
  hashInput: "zaronia-ois-irspv-validation-methodology-tier2-v0.1-sr117-ss123",
  effectiveFrom: SEED_AS_OF,
  summary:
    "Tier-2 validation methodology v0.1 — pricing engines, risk sensitivities, behavioural-deposit models. " +
    "Seven dimensions; REQUIRED conceptual soundness + sensitivity analysis + one of benchmark/challenger. " +
    "Approval expiry 18 months. Authority: RAS §B7, SR 11-7 §V, SS 1/23 Principle 4, BCBS CG-Principles 6+8.",
};

const TIER3_METHODOLOGY = {
  methodologyId: "validation-methodology:tier-3:v0.1",
  tier: 3 as const,
  version: "v0.1",
  publishedBy: "agent:nadia:model-validation",
  // Stable string anchored to methodology identity
  hashInput: "standard-textbook-validation-methodology-tier3-v0.1-sr117-ss123",
  effectiveFrom: SEED_AS_OF,
  summary:
    "Tier-3 validation methodology v0.1 — standard textbook models (FX forward IRP, DCF, SA-CCR). " +
    "Two REQUIRED dimensions: conceptual soundness + documentation review. " +
    "Approval expiry 12 months. Authority: RAS §B7, SR 11-7 §V (proportionate), SS 1/23 Principle 4.",
};

export interface MethodologySeedResult {
  published: string[];
  skipped: string[];
}

/**
 * Idempotently emit ValidationMethodologyPublished for Tier-2 v0.1 and Tier-3 v0.1.
 *
 * Idempotency key: (methodologyId, version) — scan replay for existing events with
 * the same combination before emitting.
 */
export function seedValidationMethodologies(store: EventStore): MethodologySeedResult {
  const published: string[] = [];
  const skipped: string[] = [];

  // Build existing (methodologyId, version) pairs from replay.
  const existing = new Set<string>();
  for (const ev of store.replay({ type: "ValidationMethodologyPublished" })) {
    const p = ev.payload as Record<string, unknown>;
    const key = `${String(p.methodologyId ?? "")}:${String(p.version ?? "")}`;
    existing.add(key);
  }

  for (const def of [TIER2_METHODOLOGY, TIER3_METHODOLOGY]) {
    const key = `${def.methodologyId}:${def.version}`;
    if (existing.has(key)) {
      skipped.push(def.methodologyId);
      continue;
    }

    const mHash = createHash("sha256").update(def.hashInput).digest("hex");

    const ev = makeValidationMethodologyPublished({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: NADIA_VALIDATION_ACTOR,
      citations: CITATIONS,
      payload: {
        methodologyId: def.methodologyId,
        tier: def.tier,
        version: def.version,
        publishedBy: def.publishedBy,
        methodologyHash: mHash,
        effectiveFrom: def.effectiveFrom,
        summary: def.summary,
      },
    });

    store.append(ev);
    published.push(def.methodologyId);
  }

  return { published, skipped };
}

// ---------------------------------------------------------------------------
// seedModelValidations
// ---------------------------------------------------------------------------
// (moved from seeds/models/model-validation-seed.ts)

interface ModelSeedDef {
  modelId: string;
  version: string;
  tier: 2 | 3;
  expiryDate: string;
  description: string;
}

const VALIDATION_MODELS: ModelSeedDef[] = [
  {
    modelId: "model:sagb-dcf-v1",
    version: "v1.0",
    tier: 3,
    expiryDate: "2027-05-27",
    description: "SAGB DCF valuation — standard discounted-cash-flow for SA government bonds",
  },
  {
    modelId: "model:zaronia-ois-irspv-v1",
    version: "v1.0",
    tier: 2,
    expiryDate: "2027-11-27",
    description:
      "ZARONIA OIS IRS present-value pricing engine — ZAR fixed vs ZARONIA OIS discounting",
  },
  {
    modelId: "model:fx-forward-irp-v1",
    version: "v1.0",
    tier: 3,
    expiryDate: "2027-05-27",
    description: "FX forward pricing — interest-rate-parity formula (USD/ZAR, textbook IRP)",
  },
];

export interface ModelValidationSeedResult {
  approved: string[];
  skipped: string[];
}

/**
 * Idempotently emit ModelValidationApproved for the three build-phase models.
 *
 * Per-model logic:
 *   1. Check if already approved (scan ModelValidationApproved for modelId) → skip if found.
 *   2. Check if ModelSubmitted exists (registry.list()) → skip gracefully if not registered.
 *   3. For zaronia-ois-irspv-v1 only: raise a medium finding (SARB data-feed dependency)
 *      before approval — idempotent (scan ValidationFindingRaised for findingId first).
 *   4. Call registry.approveValidation().
 *
 * Medium findings are non-blocking per the Tier-2 methodology §3.7; approval proceeds.
 */
export function seedModelValidations(store: EventStore): ModelValidationSeedResult {
  const approved: string[] = [];
  const skipped: string[] = [];

  const registry = new LocalModelRegistry({ eventStore: store });

  // Build set of already-approved modelIds.
  const alreadyApproved = new Set<string>();
  for (const ev of store.replay({ type: "ModelValidationApproved" })) {
    const p = ev.payload as Record<string, unknown>;
    const modelId = String(p.modelId ?? "");
    if (modelId) alreadyApproved.add(modelId);
  }

  // Build set of registered modelIds from the registry.
  const registeredModels = new Map<string, { version: string }>();
  for (const model of registry.list()) {
    registeredModels.set(model.modelId, { version: model.latestVersion });
  }

  // Build set of already-raised findingIds.
  const alreadyRaisedFindings = new Set<string>();
  for (const ev of store.replay({ type: "ValidationFindingRaised" })) {
    const p = ev.payload as Record<string, unknown>;
    const findingId = String(p.findingId ?? "");
    if (findingId) alreadyRaisedFindings.add(findingId);
  }

  for (const def of VALIDATION_MODELS) {
    // Skip if already approved.
    if (alreadyApproved.has(def.modelId)) {
      skipped.push(def.modelId);
      continue;
    }

    // Skip gracefully if model not registered (PR-F may not have run yet).
    const registered = registeredModels.get(def.modelId);
    if (!registered) {
      skipped.push(def.modelId);
      continue;
    }

    // For ZARONIA IRS model: raise medium finding first (idempotent).
    if (def.modelId === "model:zaronia-ois-irspv-v1") {
      const findingId = "finding:zaronia-ois-irspv-v1:sarb-data-feed";
      if (!alreadyRaisedFindings.has(findingId)) {
        registry.raiseFinding({
          asOf: SEED_AS_OF,
          entity: ENTITY,
          actor: NADIA_VALIDATION_ACTOR,
          citations: CITATIONS,
          findingId,
          modelId: def.modelId,
          raisedBy: "agent:nadia:model-validation",
          severity: "medium",
          description:
            "SARB ZARONIA daily-fix data feed dependency not yet registered in the obligations register. " +
            "The OIS discount-curve construction relies on SARB-published ZARONIA fixing data; " +
            "the feed is available via SARB's public data portal but the formal obligations-register " +
            "row (SARB ZARONIA reform citation) is pending Mira's S3 follow-on. " +
            "Non-blocking at Tier-2 per _methodology-tier-2.md §3.7 — medium severity. " +
            "Remediation: route to Mira for obligations-register row creation before next revalidation.",
        });
        alreadyRaisedFindings.add(findingId);
      }
    }

    // Approve the model.
    try {
      registry.approveValidation({
        asOf: SEED_AS_OF,
        entity: ENTITY,
        actor: NADIA_VALIDATION_ACTOR,
        citations: CITATIONS,
        modelId: def.modelId,
        version: registered.version,
        approvedBy: "agent:nadia:model-validation",
        validationFindingsResolved: [],
        expiryDate: def.expiryDate,
      });
      approved.push(def.modelId);
    } catch (err) {
      // Log and skip — don't crash the caller.
      // Typical cause: open blocking findings prevent approval.
      console.warn(
        `[pricing-model-definitions] approveValidation failed for ${def.modelId}: ${(err as Error).message}`,
      );
      skipped.push(def.modelId);
    }
  }

  return { approved, skipped };
}

// ---------------------------------------------------------------------------
// seedModelRegisteredEvents
// ---------------------------------------------------------------------------
// (moved from seeds/models/model-registered-seed.ts)

const ROHAN_REGISTERED_ACTOR: Actor = {
  type: "service",
  id: "agent:rohan:model-registered-seed",
};
const ANYA_REGISTERED_ACTOR: Actor = {
  type: "service",
  id: "agent:anya:model-registered-seed",
};
const NADIA_REGISTERED_ACTOR: Actor = {
  type: "service",
  id: "agent:nadia:model-validation",
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

interface ModelRegisteredDef {
  readonly modelId: string;
  readonly modelName: string;
  readonly modelKind: "risk" | "pricing" | "credit" | "ALM" | "regulatory" | "other";
  readonly tier: 1 | 2 | 3;
  readonly actor: Actor;
  readonly registeredBy: string;
  readonly version: string;
  readonly owner: string;
}

const MODEL_REGISTERED_DEFS: ReadonlyArray<ModelRegisteredDef> = [
  {
    modelId: "model:irs:zaronia-ois-curve",
    modelName: "ZARONIA OIS Bootstrapped Curve",
    modelKind: "pricing",
    tier: 2,
    actor: ROHAN_REGISTERED_ACTOR,
    registeredBy: "agent:rohan",
    version: "1.0.0",
    owner: "agent:rohan",
  },
  {
    modelId: "model:irs:pv-engine",
    modelName: "IRS Present-Value Engine",
    modelKind: "pricing",
    tier: 2,
    actor: ANYA_REGISTERED_ACTOR,
    registeredBy: "agent:anya",
    version: "1.0.0",
    owner: "agent:anya",
  },
  {
    modelId: "model:fx:forward-irp",
    modelName: "FX Forward Interest-Rate Parity",
    modelKind: "pricing",
    tier: 3,
    actor: ROHAN_REGISTERED_ACTOR,
    registeredBy: "agent:rohan",
    version: "1.0.0",
    owner: "agent:rohan",
  },
] as const;

interface MethodologyV1Def {
  readonly methodologyId: string;
  readonly tier: 2 | 3;
  readonly version: string;
  readonly hashInput: string;
  readonly summary: string;
}

const METHODOLOGY_V1_DEFS: ReadonlyArray<MethodologyV1Def> = [
  {
    methodologyId: "validation-methodology:tier-2:v1",
    tier: 2,
    version: "v1",
    hashInput:
      "zaronia-ois-irs-pv-validation-methodology-tier2-v1-sr117-bcbs239-sa-ccr-pricing-engines",
    summary:
      "Tier-2 validation methodology v1 — pricing engines with material curve construction " +
      "(OIS bootstrapping) and bespoke data dependencies. REQUIRED dimensions: conceptual " +
      "soundness, sensitivity analysis, one of benchmark/challenger model comparison. " +
      "Approval expiry 18 months. Standards: SR 11-7, BCBS-239. " +
      "Authority: RAS §B7, SR 11-7 §V, BCBS CG-Principles 6+8.",
  },
  {
    methodologyId: "validation-methodology:tier-3:v1",
    tier: 3,
    version: "v1",
    hashInput:
      "fx-forward-irp-dcf-validation-methodology-tier3-v1-sr117-simplified-bcbs239-standard-textbook",
    summary:
      "Tier-3 validation methodology v1 — standard textbook models with directly observable " +
      "market inputs (FX forward IRP, DCF, SA-CCR). Simplified track: conceptual soundness " +
      "+ documentation review. Approval expiry 12 months. Standards: SR-11-7-SIMPLIFIED, BCBS-239. " +
      "Authority: RAS §B7, SR 11-7 §V (proportionate), BCBS CG-Principle 4.",
  },
] as const;

interface ModelValidationApprovedDef {
  readonly modelId: string;
  readonly version: string;
  readonly tier: 2 | 3;
  readonly expiryDate: string;
  readonly validationNotes: string;
}

const MODEL_VALIDATION_APPROVED_DEFS: ReadonlyArray<ModelValidationApprovedDef> = [
  {
    modelId: "model:irs:zaronia-ois-curve",
    version: "1.0.0",
    tier: 2,
    expiryDate: "2027-11-27",
    validationNotes:
      "Independent replication of ZARONIA OIS bootstrapping performed; curve consistent with " +
      "SARB published daily rates; residuals within tier-2 tolerance bands (±5bps). SR 11-7 compliant.",
  },
  {
    modelId: "model:irs:pv-engine",
    version: "1.0.0",
    tier: 2,
    expiryDate: "2027-11-27",
    validationNotes:
      "PV engine cash-flow schedules validated against ISDA 2006 definitions; fixed leg bond-basis " +
      "day-count confirmed; floating leg ZARONIA compounded-in-arrears verified. " +
      "Residuals within tier-2 tolerance bands (±5bps). SR 11-7 compliant.",
  },
  {
    modelId: "model:fx:forward-irp",
    version: "1.0.0",
    tier: 3,
    expiryDate: "2027-05-27",
    validationNotes:
      "CIP pricing validated against Bloomberg FX forward mid quotes; ZAR basis spread within " +
      "market convention (typically 20–50bps for 1M tenor); tier-3 simplified track sign-off " +
      "per Nadia validation-methodology:tier-3:v1.",
  },
] as const;

export interface ModelRegisteredSeedResult {
  readonly modelRegistered: string[];
  readonly methodologiesPublished: string[];
  readonly validationsApproved: string[];
  readonly skipped: string[];
}

/**
 * Idempotent seed: emits ModelRegistered × 3, ValidationMethodologyPublished × 2 (v1),
 * and ModelValidationApproved × 3 for IRS ZARONIA and FX swap model-risk gap closure.
 *
 * Idempotency:
 *  - ModelRegistered: skips if an event with the same modelId already exists.
 *  - ValidationMethodologyPublished: skips if (methodologyId, version) already exists.
 *  - ModelValidationApproved: skips if a ModelValidationApproved for (modelId) from
 *    "agent:nadia:model-validation" with same version already exists.
 */
export function seedModelRegisteredEvents(store: EventStore): ModelRegisteredSeedResult {
  const modelRegistered: string[] = [];
  const methodologiesPublished: string[] = [];
  const validationsApproved: string[] = [];
  const skipped: string[] = [];

  // Scan for existing ModelRegistered events.
  const existingModelRegistered = new Set<string>();
  for (const ev of store.replay({ type: "ModelRegistered" })) {
    const p = ev.payload as Record<string, unknown>;
    const modelId = String(p.modelId ?? "");
    if (modelId) existingModelRegistered.add(modelId);
  }

  // Emit ModelRegistered events.
  for (const def of MODEL_REGISTERED_DEFS) {
    if (existingModelRegistered.has(def.modelId)) {
      skipped.push(`ModelRegistered:${def.modelId}`);
      continue;
    }

    const ev = makeModelRegistered({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: def.actor,
      citations: CITATIONS,
      payload: {
        modelId: def.modelId,
        modelName: def.modelName,
        modelKind: def.modelKind,
        tier: def.tier,
        registeredBy: def.registeredBy,
        registeredAt: SEED_AS_OF,
        version: def.version,
        owner: def.owner,
      },
    });

    store.append(ev);
    modelRegistered.push(def.modelId);
  }

  // Scan for existing ValidationMethodologyPublished events.
  const existingMethodologies = new Set<string>();
  for (const ev of store.replay({ type: "ValidationMethodologyPublished" })) {
    const p = ev.payload as Record<string, unknown>;
    const key = `${String(p.methodologyId ?? "")}:${String(p.version ?? "")}`;
    existingMethodologies.add(key);
  }

  // Emit ValidationMethodologyPublished events (v1 series).
  for (const def of METHODOLOGY_V1_DEFS) {
    const key = `${def.methodologyId}:${def.version}`;
    if (existingMethodologies.has(key)) {
      skipped.push(`ValidationMethodologyPublished:${def.methodologyId}`);
      continue;
    }

    const ev = makeValidationMethodologyPublished({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: NADIA_REGISTERED_ACTOR,
      citations: CITATIONS,
      payload: {
        methodologyId: def.methodologyId,
        tier: def.tier,
        version: def.version,
        publishedBy: "agent:nadia",
        methodologyHash: sha256(def.hashInput),
        effectiveFrom: SEED_AS_OF,
        summary: def.summary,
      },
    });

    store.append(ev);
    methodologiesPublished.push(def.methodologyId);
  }

  // Scan for existing ModelValidationApproved events emitted for these model IDs.
  const existingValidations = new Set<string>();
  for (const ev of store.replay({ type: "ModelValidationApproved" })) {
    const p = ev.payload as Record<string, unknown>;
    const modelId = String(p.modelId ?? "");
    const version = String(p.version ?? "");
    const key = `${modelId}:${version}`;
    if (key) existingValidations.add(key);
  }

  // Emit ModelValidationApproved events.
  for (const def of MODEL_VALIDATION_APPROVED_DEFS) {
    const key = `${def.modelId}:${def.version}`;
    if (existingValidations.has(key)) {
      skipped.push(`ModelValidationApproved:${def.modelId}`);
      continue;
    }

    const ev = makeModelValidationApproved({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: NADIA_REGISTERED_ACTOR,
      citations: CITATIONS,
      payload: {
        modelId: def.modelId,
        version: def.version,
        approvedBy: "agent:nadia",
        validationFindingsResolved: [],
        expiryDate: def.expiryDate,
      },
    });

    store.append(ev);
    validationsApproved.push(def.modelId);
  }

  return { modelRegistered, methodologiesPublished, validationsApproved, skipped };
}
