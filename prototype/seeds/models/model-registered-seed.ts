// seeds/models/model-registered-seed.ts
//
// Idempotent seed: ModelRegistered × 3 + ValidationMethodologyPublished × 2 (v1)
// + ModelValidationApproved × 3 for IRS ZARONIA and FX swap model-risk gap closure.
//
// Emits:
//   - ModelRegistered for model:irs:zaronia-ois-curve (Tier-2, Rohan)
//   - ModelRegistered for model:irs:pv-engine (Tier-2, Anya)
//   - ModelRegistered for model:fx:forward-irp (Tier-3, Rohan)
//   - ValidationMethodologyPublished for validation-methodology:tier-2:v1
//   - ValidationMethodologyPublished for validation-methodology:tier-3:v1
//   - ModelValidationApproved for model:irs:zaronia-ois-curve (Nadia, Tier-2)
//   - ModelValidationApproved for model:irs:pv-engine (Nadia, Tier-2)
//   - ModelValidationApproved for model:fx:forward-irp (Nadia, Tier-3)
//
// Note: these events use the canonical model IDs from the brief's model-risk
// gap closure spec (model:irs:* / model:fx:*). They complement (not replace)
// the earlier model:zaronia-ois-irspv-v1 and model:fx-forward-irp-v1
// ModelSubmitted events in model-registry-seed.ts; those cover the LocalModelRegistry
// projection while these ModelRegistered events satisfy the event-store inventory.
//
// Idempotent: skips any event whose (modelId) or (methodologyId, version) is
// already present in the replay.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//
// Authors: Rohan (Risk systems engineer, engineering) + Anya (Quantitative analyst, engineering)
//          + Nadia (Chief Model Risk Officer, governance)
//          Atlas (substrate)

import { createHash } from "node:crypto";

import {
  makeModelValidationApproved,
  makeValidationMethodologyPublished,
} from "../../platform/event-store/event-types/model-risk";
import { makeModelRegistered } from "../../platform/event-store/event-types/risk-treasury-extended";
import type { EventStore } from "../../platform/event-store/store";
import type { Actor } from "../../platform/event-store/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEED_AS_OF = "2026-05-27T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

const ROHAN_ACTOR: Actor = { type: "service", id: "agent:rohan:model-registered-seed" };
const ANYA_ACTOR: Actor = { type: "service", id: "agent:anya:model-registered-seed" };
const NADIA_ACTOR: Actor = { type: "service", id: "agent:nadia:model-validation" };

const CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// ModelRegistered definitions
// ---------------------------------------------------------------------------

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
    actor: ROHAN_ACTOR,
    registeredBy: "agent:rohan",
    version: "1.0.0",
    owner: "agent:rohan",
  },
  {
    modelId: "model:irs:pv-engine",
    modelName: "IRS Present-Value Engine",
    modelKind: "pricing",
    tier: 2,
    actor: ANYA_ACTOR,
    registeredBy: "agent:anya",
    version: "1.0.0",
    owner: "agent:anya",
  },
  {
    modelId: "model:fx:forward-irp",
    modelName: "FX Forward Interest-Rate Parity",
    modelKind: "pricing",
    tier: 3,
    actor: ROHAN_ACTOR,
    registeredBy: "agent:rohan",
    version: "1.0.0",
    owner: "agent:rohan",
  },
] as const;

// ---------------------------------------------------------------------------
// ValidationMethodologyPublished definitions (v1 series)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ModelValidationApproved definitions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ModelRegisteredSeedResult {
  readonly modelRegistered: string[];
  readonly methodologiesPublished: string[];
  readonly validationsApproved: string[];
  readonly skipped: string[];
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

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
      actor: NADIA_ACTOR,
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
      actor: NADIA_ACTOR,
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
