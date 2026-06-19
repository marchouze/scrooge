// scripts/seed-nadia-fx-model-validations.ts
//
// CI-chained runner for `seedFxModelValidations` — lands the FX model-validation-
// of-record (`ModelValidationApproved` for `model:fx-forward-irp-v1` and
// `model:market-risk-var-hs-v1`, with their `ModelSubmitted` + `ModelTierClassified`
// preconditions) onto whatever store BANK_EVENT_DB points at. Wired into
// `ci:migrate` so the validation-of-record is reproducible on the freshly-migrated
// clean CI store — the gated basis the FX OTC model-risk dimension needs before it
// may be implementation-attested.
//
// Closes the tracked gap `fx-model-validation-of-record-not-in-gated-store`. Does
// NOT pre-empt the separate `fx-forward-model-revalidation-live-curve` gap.
//
// IDEMPOTENT: the seed function dedups per-model (skips already-submitted /
// classified / approved). Re-running `ci:migrate` does not double-emit.
//
// EMITS validation/attestation events ONLY — never a `Decision` (recording a
// Decision in a seed path trips `recon:decision-symmetry`; Engineering Charter +
// the documented ci:migrate decision-symmetry lesson).
//
// STORE POSTURE: like `file:nadia-cash-model-validation`, this script does NOT
// import a boot shim — it uses `platform/composition`'s `eventStore` so the
// emitted events land in the per-worktree store the CI recon reads. For a
// standalone shared-store run, set BANK_EVENT_DB explicitly. No document blob is
// written (the typed events ARE the validation-of-record, Principle 1), so the
// document-store / blob-integrity coupling does not apply here.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//   D-TRUSTED-FIGURES-PROGRAM-V1; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1.
// Author: Nadia (Independent-validation engineer, second line).

import { eventStore } from "../platform/composition";
import { seedFxModelValidations } from "../platform/model-registry/fx-model-validation-seed";

const result = seedFxModelValidations(eventStore);

console.log(
  JSON.stringify(
    {
      ok: true,
      seeder: "seed-nadia-fx-model-validations",
      submitted: result.submitted,
      tierClassified: result.tierClassified,
      approved: result.approved,
      skipped: result.skipped,
    },
    null,
    2,
  ),
);
