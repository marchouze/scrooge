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
// TIER ANNOTATIONS (D-V2-BBAAS-TIER-STRUCTURE): every export is tagged with a
// `@tier` JSDoc comment that declares the minimum tier that may access it:
//   K  — anchor bank only (full internal access; never appears in R/C surface)
//   R  — regulated tenant surface (R + K)
//   C  — commercial SaaS surface (C + R + K; most constrained)
// The `recon:v2-released-surface-clean-core` gate enforces that no K-only
// export appears in the R or C manifest, and that every export is annotated.
//
// Everything in Wave 1 (control-plane store, tenant axis, posture register,
// products-as-events, released-surface gate) ADDS to this package.
//
// Authority: D-V2-REPO-STRATEGY-REEXAMINATION; D-FIL-FRAMEWORK-UNIFICATION;
// D-MODEL-BINDING-CONTRACT-V1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
// D-V2-BBAAS-TIER-STRUCTURE.
// Author: Atlas (Core banking platform architect, engineering).

// --- FIL-Core (kernel) -----------------------------------------------------

/** @tier C — FIL primitive types; available to all tiers */
export * from "./fil-core/primitives";

/** @tier C — FIL taxonomy navigation; available to all tiers */
export * from "./fil-core/taxonomy";

/** @tier C — URN utilities; available to all tiers */
export * from "./fil-core/urn";

/** @tier R — FIL composition engine; regulated-tenant surface and above */
export * from "./fil-core/composition";

/** @tier R — FIL lifecycle state machine; regulated-tenant surface and above */
export * from "./fil-core/lifecycle";

/** @tier R — FIL type-definition builder; regulated-tenant surface and above */
export * from "./fil-core/type-definition";

// --- FIL-Facets (the seven kernel interfaces) ------------------------------

/** @tier C — The seven FIL facet interfaces; available to all tiers */
export * from "./fil-facets/facets";

// --- FIL-Models (registry scaffold) ----------------------------------------

/** @tier R — FIL-Model declaration helpers; regulated-tenant surface and above */
export * from "./fil-models/declaration";

/** @tier R — FIL-Model registry (read-only query surface for R; write surface for K) */
export * from "./fil-models/registry";

/** @tier R — SA-CCR: the first FIL-Model (RiskMeasurable over IR + FX); S7-FIL */
export * from "./fil-models/sa-ccr";

// --- Control-plane (Wave 1) ------------------------------------------------

/** @tier R — tenant axis: ANCHOR_TENANT_ID, TenantId, tenantIdSchema, isAnchorTenantEvent (dark, not yet enforced) */
export * from "./control-plane/tenant";

/** @tier R — V2 event envelope: V2Envelope, createV2Envelope (dark, not yet enforced) */
export * from "./control-plane/envelope";

// --- Banking (S4: anchor-bank standing-data events) ------------------------

/** @tier K — anchor-bank standing-data events (product catalogue, CoA, RAS) */
export * from "./banking/events";

// --- FIL instances (materialisation: IR + FX as native fil:inst) -----------

/** @tier K — FIL instance lifecycle event family + live-instance projection
 * (anchor-book materialisation; emitted into BANK_V2_ANCHOR_DB only).
 * Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1. */
export * from "./fil-instances";

// --- Posture register (W8 Slice 1) -----------------------------------------

/** @tier R — PostureRegistered / Activated / Deactivated / Revised event types; APPLIES_WHEN
 * predicate; PostureRegister projection. Authority: D-W8-POSTURE-REGISTER-SLICE-1. */
export * from "./posture";

// --- Control-plane (Wave 1, S1) — fleet store --------------------------------

/** @tier K — control-plane event shapes (TenantRegistered, TenantSurfaceGranted, TenantUpgradeLedgerEntry, TenantMeterEvent); anchor-bank only */
export * from "./control-plane/events";

/** @tier K — control-plane SQLite store factory (openControlPlaneStore, ControlPlaneStore); anchor-bank only */
export * from "./control-plane/store";

/** @tier K — control-plane in-memory projection (ControlPlaneProjection, Tenant, listTenants, getTenant, getMeteringWindow); anchor-bank only */
export * from "./control-plane/projection";
