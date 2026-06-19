// platform/model-registry/fx-model-validation-seed.ts
//
// Scoped seeder: lands the FX model-validation-of-record for the two models the
// FX OTC Vanilla NPA cycle's model-risk dimension binds to —
//   - model:fx-forward-irp-v1     (Tier-3 pricing: covered interest-rate parity)
//   - model:market-risk-var-hs-v1 (Tier-1 risk: 99% 1-day historical-simulation VaR)
//
// WHY THIS EXISTS (the gap it closes): the genuine validation-of-record for both
// models — the `ModelSubmitted → ModelTierClassified → ModelValidationApproved`
// triple authored by Rohan (first line) + Nadia (second line) — exists only in
// the shared home store, emitted by the bulk seed functions `seedModelRegistry`
// / `seedModelValidations` (pricing) and `seedCalcModels` (calc). No step in the
// `ci:migrate` chain replays them onto the clean store, so the gated CI store
// carried NO validation-of-record for the FX models. The FX OTC model-risk
// dimension cannot be implementation-attested against a store that lacks the
// approval (tracked gap `fx-model-validation-of-record-not-in-gated-store`).
//
// HONESTY (Engineering Charter cmd 3): this is NOT a fresh validation and NOT a
// hollow stamp. The two FX models were genuinely submitted, tier-classified, and
// validation-approved (see the home store: fx-forward-irp-v1 on 2026-05-27 by
// agent:nadia:model-validation; market-risk-var-hs-v1 on 2026-05-29 by
// agent:nadia:calc-model-validation). This seeder REPRODUCES exactly those
// canonical events — same entity, business-time instant, citations, actors,
// tier, methodology hash, version, and expiry — by reusing the canonical
// definitions and authoring path single-sourced from the pricing/calc modules.
// It does NOT mint a new verdict and does NOT pre-empt the separate, still-open
// `fx-forward-model-revalidation-live-curve` gap (revalidate when the live
// forward-curve feed lands). No `RecordFiled` report is fabricated: none exists
// for these two models in the home store — the typed validation events ARE the
// validation-of-record (Principle 1).
//
// IDEMPOTENT: per-model, skips submit if already submitted, skips tier-classify
// if already classified, skips approval if a ModelValidationApproved already
// exists for the modelId. Re-running `ci:migrate` does not double-emit.
//
// NOT a Decision (Engineering Charter / ci:migrate decision-symmetry lesson):
// the events emitted are validation/attestation events, never a `Decision` —
// recording a Decision in a seed path trips `recon:decision-symmetry`.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//   D-TRUSTED-FIGURES-PROGRAM-V1; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1;
//   D-PRODUCT-CONSTRUCTION-SUBSTRATE; D-NEW-PRODUCT-APPROVAL-POLICY.
// Author: Nadia (Independent-validation engineer, second line).

import type { EventStore } from "../event-store/store";
import {
  MODELS as CALC_MODELS,
  CALC_MODEL_NADIA_ACTOR,
  CALC_MODEL_ROHAN_ACTOR,
  CALC_MODEL_SEED_CONTEXT,
  type CalcModelDef,
  methodologyHash as calcMethodologyHash,
} from "./calc-model-definitions";
import { LocalModelRegistry } from "./index";
import {
  NADIA_REGISTRY_ACTOR,
  NADIA_VALIDATION_ACTOR,
  PRICING_MODEL_SEED_CONTEXT,
  REGISTRY_MODELS,
  ROHAN_REGISTRY_ACTOR,
  VALIDATION_MODELS,
  methodologyHash as pricingMethodologyHash,
} from "./pricing-model-definitions";

// ---------------------------------------------------------------------------
// The two FX models this seeder scopes to.
// ---------------------------------------------------------------------------

/** The FX forward pricing model (Tier-3, covered interest-rate parity). */
export const FX_FORWARD_IRP_MODEL_ID = "model:fx-forward-irp-v1";
/** The market-risk VaR engine (Tier-1, 99% 1-day historical simulation). */
export const FX_MARKET_RISK_VAR_HS_MODEL_ID = "model:market-risk-var-hs-v1";

/** The two FX models whose validation-of-record this seeder lands. */
export const FX_VALIDATION_OF_RECORD_MODEL_IDS = [
  FX_FORWARD_IRP_MODEL_ID,
  FX_MARKET_RISK_VAR_HS_MODEL_ID,
] as const;

export interface FxModelValidationSeedResult {
  readonly submitted: string[];
  readonly tierClassified: string[];
  readonly approved: string[];
  readonly skipped: string[];
}

// ---------------------------------------------------------------------------
// Helpers — read current store state once.
// ---------------------------------------------------------------------------

function readAlreadyApproved(store: EventStore): Set<string> {
  const approved = new Set<string>();
  for (const ev of store.replay({ type: "ModelValidationApproved" })) {
    const modelId = String((ev.payload as Record<string, unknown>).modelId ?? "");
    if (modelId) approved.add(modelId);
  }
  return approved;
}

// ---------------------------------------------------------------------------
// fx-forward-irp-v1 — pricing-model authoring path (single-sourced).
// ---------------------------------------------------------------------------

function seedFxForwardIrp(
  registry: LocalModelRegistry,
  alreadyApproved: Set<string>,
  out: FxModelValidationSeedResult,
): void {
  // Canonical registry definition (submit + tier rationale + methodology hash).
  const registryDef = REGISTRY_MODELS.find((m) => m.modelId === FX_FORWARD_IRP_MODEL_ID);
  // Canonical validation definition (approval version + expiry + tier).
  const validationDef = VALIDATION_MODELS.find((m) => m.modelId === FX_FORWARD_IRP_MODEL_ID);
  if (!registryDef || !validationDef) {
    // The canonical defs are the source of truth; their absence is a structural
    // defect, not a runtime skip — fail closed (Engineering Charter cmd 2).
    throw new Error(
      `fx-model-validation-seed: canonical pricing definition for ${FX_FORWARD_IRP_MODEL_ID} not found; the seeder must single-source from pricing-model-definitions.`,
    );
  }

  const { entity, asOf, citations } = PRICING_MODEL_SEED_CONTEXT;

  // ---- Submit (Rohan) — idempotent on the registry side ----------------------
  const existing = new Set(registry.list().map((m) => m.modelId));
  if (!existing.has(registryDef.modelId)) {
    const result = registry.submit({
      asOf,
      entity,
      actor: ROHAN_REGISTRY_ACTOR,
      citations,
      modelId: registryDef.modelId,
      submittedBy: "agent:rohan:model-registry-seed",
      version: registryDef.version,
      tier: registryDef.rohanTier,
      methodologyHash: pricingMethodologyHash(registryDef.methodologyDescription),
      description: registryDef.description,
    });
    if (result.status === "submitted") out.submitted.push(registryDef.modelId);
    else out.skipped.push(registryDef.modelId);
  }

  // ---- Classify tier (Nadia) ------------------------------------------------
  const current = registry.list().find((m) => m.modelId === registryDef.modelId);
  if (!current) {
    throw new Error(
      `fx-model-validation-seed: ${registryDef.modelId} not present after submit — cannot classify.`,
    );
  }
  if (!current.tierClassified) {
    registry.classifyTier({
      asOf,
      entity,
      actor: NADIA_REGISTRY_ACTOR,
      citations,
      modelId: registryDef.modelId,
      classifiedBy: "agent:nadia:model-tier-classification",
      tier: registryDef.nadiaTier,
      rationale: registryDef.tierRationale,
    });
    out.tierClassified.push(registryDef.modelId);
  }

  // ---- Approve validation (Nadia) — the validation-of-record ----------------
  if (alreadyApproved.has(validationDef.modelId)) {
    out.skipped.push(validationDef.modelId);
    return;
  }
  registry.approveValidation({
    asOf,
    entity,
    actor: NADIA_VALIDATION_ACTOR,
    citations,
    modelId: validationDef.modelId,
    version: current.latestVersion,
    approvedBy: "agent:nadia:model-validation",
    validationFindingsResolved: [],
    expiryDate: validationDef.expiryDate,
  });
  out.approved.push(validationDef.modelId);
}

// ---------------------------------------------------------------------------
// market-risk-var-hs-v1 — calc-model authoring path (single-sourced).
// ---------------------------------------------------------------------------

function seedMarketRiskVarHs(
  registry: LocalModelRegistry,
  alreadyApproved: Set<string>,
  out: FxModelValidationSeedResult,
): void {
  const model: CalcModelDef | undefined = CALC_MODELS.find(
    (m) => m.modelId === FX_MARKET_RISK_VAR_HS_MODEL_ID,
  );
  if (!model) {
    throw new Error(
      `fx-model-validation-seed: canonical calc definition for ${FX_MARKET_RISK_VAR_HS_MODEL_ID} not found; the seeder must single-source from calc-model-definitions.`,
    );
  }

  const { entity, asOf, citations } = CALC_MODEL_SEED_CONTEXT;

  // ---- Submit (Rohan) -------------------------------------------------------
  const existing = new Set(registry.list().map((m) => m.modelId));
  if (!existing.has(model.modelId)) {
    const result = registry.submit({
      asOf,
      entity,
      actor: CALC_MODEL_ROHAN_ACTOR,
      citations,
      modelId: model.modelId,
      submittedBy: "agent:rohan:calc-model-seed",
      version: model.version,
      tier: model.tier,
      methodologyHash: calcMethodologyHash(model.methodologyDescription),
      description: model.description,
    });
    if (result.status === "submitted") out.submitted.push(model.modelId);
    else out.skipped.push(model.modelId);
  }

  // ---- Classify tier (Nadia) ------------------------------------------------
  const current = registry.list().find((m) => m.modelId === model.modelId);
  if (!current) {
    throw new Error(
      `fx-model-validation-seed: ${model.modelId} not present after submit — cannot classify.`,
    );
  }
  if (!current.tierClassified) {
    registry.classifyTier({
      asOf,
      entity,
      actor: CALC_MODEL_NADIA_ACTOR,
      citations,
      modelId: model.modelId,
      classifiedBy: "agent:nadia:calc-model-validation",
      tier: model.tier,
      rationale: model.tierRationale,
    });
    out.tierClassified.push(model.modelId);
  }

  // ---- Approve validation (Nadia) — the validation-of-record ----------------
  if (alreadyApproved.has(model.modelId)) {
    out.skipped.push(model.modelId);
    return;
  }
  registry.approveValidation({
    asOf,
    entity,
    actor: CALC_MODEL_NADIA_ACTOR,
    citations,
    modelId: model.modelId,
    version: current.latestVersion,
    approvedBy: "agent:nadia:calc-model-validation",
    validationFindingsResolved: [],
    expiryDate: model.expiryDate,
  });
  out.approved.push(model.modelId);
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

/**
 * Idempotently land the FX model-validation-of-record for the two FX models the
 * FX OTC Vanilla NPA cycle's model-risk dimension binds to. Reproduces — byte-
 * faithfully — the canonical `ModelSubmitted → ModelTierClassified →
 * ModelValidationApproved` triple already present in the shared home store,
 * single-sourced from the pricing/calc model definitions.
 *
 * Idempotent: already-submitted / already-classified / already-approved steps
 * are skipped per-model. Safe to chain into `ci:migrate`.
 */
export function seedFxModelValidations(store: EventStore): FxModelValidationSeedResult {
  const registry = new LocalModelRegistry({ eventStore: store });
  const alreadyApproved = readAlreadyApproved(store);

  const out: FxModelValidationSeedResult = {
    submitted: [],
    tierClassified: [],
    approved: [],
    skipped: [],
  };

  seedFxForwardIrp(registry, alreadyApproved, out);
  seedMarketRiskVarHs(registry, alreadyApproved, out);

  return out;
}
