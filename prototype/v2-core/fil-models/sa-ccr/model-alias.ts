// v2-core/fil-models/sa-ccr/model-alias.ts
//
// The SA-CCR MODEL ALIAS — the swappable selection seam for the live SA-CCR
// computation (WS-V2-BBAAS, alias-flip).
//
// ─── WHY THE SEAM EXISTS ────────────────────────────────────────────────────
// The SA-CCR alias-flip made the validated v2 FIL-Model (`computeSaCcr`) the
// SOLE live source of the counterparty-credit-risk events of record, retiring
// the defective v1 `resolveMtm` FX-summing path. That cutover replaced WHICH
// implementation computes RC + PFE + EAD — a model SELECTION. Today the
// selection is implicit: the single emitter
// (`platform/risk/sa-ccr/compute-and-emit.ts`) imports `computeSaCcr` directly.
// This alias makes the selection an EXPLICIT, swappable seam: the emitter
// resolves the SA-CCR model THROUGH the shared FIL alias-registry, so a future
// re-calibration / re-implementation can be swapped behind the same boundary
// (the strangler/cutover pattern) WITHOUT a second emitter — `recon:ccr-single-
// emitter` continues to guard that exactly one module emits the CCR events.
//
// ─── THE MECHANISM ──────────────────────────────────────────────────────────
// This seam resolves through the SHARED FIL alias-registry
// (`../../fil-core/alias-registry.ts`), under the namespaced key
// `fil-models:sa-ccr`. At module load the validated v2 `computeSaCcr` is
// registered EAGERLY as the default, so the alias is live from line one (never
// dangling). The selected implementation is the `SaCcrComputeFn` — the pure
// netting-set-level RC + PFE + EAD composition. The COMPUTATION is unchanged
// (byte-equivalent: `recon:v2-saccr-parity` asserts v1-recompute ↔ v2 equality
// off `computeSaCcr`); this seam only relocates the SELECTION behind the
// registry. NO valuation / lifecycle plumbing here — pure model selection.
//
// NO v1 imports — pure v2-core kernel (enforced by `recon:v2-no-v1-import`).
//
// Authority: D-FIL-SHARED-ALIAS-REGISTRY (CEO-approved 2026-06-13);
//   D-SACCR-V2-CUTOVER-ACCELERATE; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; Nadia MV-SACCR-V2-002/003.
// Brief: brief:atlas:fil-shared-alias-registry-one-substrate-migrate-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import {
  type AliasRestore,
  isAliasRegistered,
  registerAlias,
  resolveAlias,
  swapAlias,
} from "../../fil-core/alias-registry";
import { type SaCcrComputeInput, type SaCcrComputeResult, computeSaCcr } from "./methodology";

/** The pure SA-CCR computation contract — the swappable surface behind the alias. */
export type SaCcrComputeFn = (input: SaCcrComputeInput) => SaCcrComputeResult;

/** The stable alias name — this seam's namespaced key in the shared registry. */
export const SA_CCR_MODEL_ALIAS = "fil-models:sa-ccr" as const;

// ---------------------------------------------------------------------------
// Eager default registration. The validated v2 `computeSaCcr` is the default
// behind the alias, registered at module load so the seam is live from line
// one. Guarded by `isAliasRegistered` so a double-import is a no-op.
// ---------------------------------------------------------------------------

if (!isAliasRegistered(SA_CCR_MODEL_ALIAS)) {
  registerAlias<SaCcrComputeFn>(SA_CCR_MODEL_ALIAS, computeSaCcr);
}

/** A handle returned by a swap, allowing the previous implementation to be restored. */
export type SaCcrModelRestore = AliasRestore;

/**
 * Swap the SA-CCR computation behind the alias (the cutover / rollback / test
 * isolation primitive). Returns a restore handle so the swap can be unwound.
 */
export function registerSaCcrModel(impl: SaCcrComputeFn): SaCcrModelRestore {
  return swapAlias<SaCcrComputeFn>(SA_CCR_MODEL_ALIAS, impl);
}

/** Resolve the SA-CCR computation currently behind the alias. Always defined. */
export function resolveSaCcrModel(): SaCcrComputeFn {
  return resolveAlias<SaCcrComputeFn>(SA_CCR_MODEL_ALIAS);
}

/** Reset the alias to the validated v2 default (test/teardown convenience). */
export function resetSaCcrModel(): void {
  swapAlias<SaCcrComputeFn>(SA_CCR_MODEL_ALIAS, computeSaCcr);
}

/**
 * The one-call computation surface — resolves the alias and delegates. The live
 * emitter calls THIS, so the SA-CCR model selection is swappable without
 * touching the emitter's call-site.
 */
export function computeSaCcrViaAlias(input: SaCcrComputeInput): SaCcrComputeResult {
  return resolveSaCcrModel()(input);
}
