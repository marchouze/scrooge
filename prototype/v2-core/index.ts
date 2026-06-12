// v2-core/index.ts
//
// The v2 core package public surface — the FIL Framework kernel.
//
// PACKAGE BOUNDARY (D-V2-REPO-STRATEGY-REEXAMINATION: mono-repo, two packages).
// This package is a FRESH, FIL-first, entity-generic code-line with a HARD
// no-v1-import boundary: NO file under `v2-core/` may import from `platform/`,
// `runtime/`, `domains/`, `dashboard/`, `projections/`, or `simulators/` (the
// v1 code-line), nor via the `@platform/`/`@domains/`/`@simulators/` aliases.
// The boundary is enforced by `recon:v2-no-v1-import` (see `recon/`).
//
// Everything in Wave 1 (control-plane store, tenant axis, posture register,
// products-as-events, released-surface gate) ADDS to this package.
//
// Authority: D-V2-REPO-STRATEGY-REEXAMINATION; D-FIL-FRAMEWORK-UNIFICATION;
// D-MODEL-BINDING-CONTRACT-V1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Core banking platform architect, engineering).

// --- FIL-Core (kernel) -----------------------------------------------------
export * from "./fil-core/primitives";
export * from "./fil-core/taxonomy";
export * from "./fil-core/urn";
export * from "./fil-core/composition";
export * from "./fil-core/lifecycle";
export * from "./fil-core/type-definition";

// --- FIL-Facets (the seven kernel interfaces) ------------------------------
export * from "./fil-facets/facets";

// --- FIL-Models (registry scaffold) ----------------------------------------
export * from "./fil-models/declaration";
export * from "./fil-models/registry";
