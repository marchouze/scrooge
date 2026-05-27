// seeds/models/model-validation-seed.ts
//
// Idempotent seed: ValidationMethodologyPublished × 2 + ModelValidationApproved × 3
//
// Emits:
//   - ValidationMethodologyPublished for Tier-2 v0.1 (ZARONIA OIS IRS pricing methodology)
//   - ValidationMethodologyPublished for Tier-3 v0.1 (standard textbook / DCF / FX-forward / SA-CCR)
//   - ValidationFindingRaised for ZARONIA IRS model (medium, non-blocking, SARB data-feed dependency)
//   - ModelValidationApproved for model:sagb-dcf-v1 (Tier-3)
//   - ModelValidationApproved for model:zaronia-ois-irspv-v1 (Tier-2; finding is non-blocking)
//   - ModelValidationApproved for model:fx-forward-irp-v1 (Tier-3)
//
// Pre-condition: seedModelRegistry must have been called first (submit + classifyTier for the
// three models). If models are not registered, seedModelValidations skips gracefully.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//
// Author: Nadia (Independent model-validation engineer)

import { createHash } from "node:crypto";

import { makeValidationMethodologyPublished } from "../../platform/event-store/event-types/model-risk";
import type { EventStore } from "../../platform/event-store/store";
import { LocalModelRegistry } from "../../platform/model-registry/index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEED_AS_OF = "2026-05-27T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const NADIA_ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };
const SEED_CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

// ---------------------------------------------------------------------------
// Methodology definitions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

interface ModelSeedDef {
  modelId: string;
  version: string;
  tier: 2 | 3;
  expiryDate: string;
  description: string;
}

const MODELS: ModelSeedDef[] = [
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
    description: "ZARONIA OIS IRS present-value pricing engine — ZAR fixed vs ZARONIA OIS discounting",
  },
  {
    modelId: "model:fx-forward-irp-v1",
    version: "v1.0",
    tier: 3,
    expiryDate: "2027-05-27",
    description: "FX forward pricing — interest-rate-parity formula (USD/ZAR, textbook IRP)",
  },
];

// ---------------------------------------------------------------------------
// seedValidationMethodologies
// ---------------------------------------------------------------------------

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

    const methodologyHash = createHash("sha256").update(def.hashInput).digest("hex");

    const ev = makeValidationMethodologyPublished({
      asOf: SEED_AS_OF,
      entity: ENTITY,
      actor: NADIA_ACTOR,
      citations: SEED_CITATIONS,
      payload: {
        methodologyId: def.methodologyId,
        tier: def.tier,
        version: def.version,
        publishedBy: def.publishedBy,
        methodologyHash,
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

  for (const def of MODELS) {
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
          actor: NADIA_ACTOR,
          citations: SEED_CITATIONS,
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
        actor: NADIA_ACTOR,
        citations: SEED_CITATIONS,
        modelId: def.modelId,
        version: registered.version,
        approvedBy: "agent:nadia:model-validation",
        validationFindingsResolved: [],
        expiryDate: def.expiryDate,
      });
      approved.push(def.modelId);
    } catch (err) {
      // Log and skip — don't crash the boot sequence.
      // Typical cause: open blocking findings prevent approval.
      console.warn(
        `[model-validation-seed] approveValidation failed for ${def.modelId}: ${(err as Error).message}`,
      );
      skipped.push(def.modelId);
    }
  }

  return { approved, skipped };
}
