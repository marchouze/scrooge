// v2-core/released-surface.ts
//
// The RELEASED_SURFACE manifest — the typed declaration of what each tier in
// the K/R/C tier structure (D-V2-BBAAS-TIER-STRUCTURE) is licensed to access
// from the v2-core package.
//
// Tier semantics:
//   K  (anchor bank)       — full internal access; no restriction on any export.
//   R  (regulated tenant)  — FIL-mediated query surface + control-plane subscription
//                            + posture-read. Constrained subset of K.
//   C  (commercial SaaS)   — most constrained; FIL types + read-only query only.
//                            Constrained subset of R.
//
// The `recon:v2-released-surface-clean-core` gate (platform/recon/v2-released-surface-gate.ts)
// reads this manifest and FAILS CI if:
//   (a) any export tagged `@tier K` in v2-core/index.ts appears in R or C exports, or
//   (b) any export in v2-core/index.ts is unannotated (missing `@tier`).
//
// TOKEN CONVENTION: tokens are the relative path from v2-core/index.ts with the
// leading `./` stripped:
//   `export * from "./fil-core/primitives"` → token `"fil-core/primitives"`
//   `export * from "./fil-facets/facets"`   → token `"fil-facets/facets"`
//   `export * from "./fil-models/registry"` → token `"fil-models/registry"`
//
// Living document: subsequent Wave-1 slices (S1 control-plane, S2 tenant axis,
// S3 posture register, S4 products-as-events) extend this manifest as they
// contribute exports to v2-core/index.ts. The gate continues to pass as long as
// all exports carry a `@tier` annotation.
//
// Authority: D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Vera (Internal Audit Engineer, governance) + Atlas (Substrate Architect, engineering).

/**
 * The canonical surface manifest for the v2-core package.
 *
 * K-tier: no restrictions — full internal access. `kOnlyExports` lists any
 * exports tagged `@tier K` for audit completeness; the gate uses this to verify
 * they do NOT appear in R or C surfaces.
 *
 * R-tier: the regulated-tenant surface. Lists every export token from
 * v2-core/index.ts that R-tier tenants may access.
 *
 * C-tier: the commercial SaaS surface. A constrained subset of R.
 */
export const RELEASED_SURFACE = {
  K: {
    description: "Anchor bank — full internal access; no restriction on any export",
    // K-only exports are those tagged @tier K in v2-core/index.ts.
    // Currently none exist (all S0 exports are R or C accessible).
    // Future K-only exports (e.g. control-plane/internal write surface) are listed here.
    kOnlyExports: [] as string[],
  },
  R: {
    description: "Regulated tenant — FIL-mediated surface + control-plane subscription + posture-read",
    // Tokens: relPath with leading "./" stripped (see token convention above).
    exports: [
      // FIL-Core kernel (full kernel access for regulated tenants)
      "fil-core/primitives",
      "fil-core/taxonomy",
      "fil-core/urn",
      "fil-core/composition",
      "fil-core/lifecycle",
      "fil-core/type-definition",
      // FIL-Facets (the seven facet interfaces)
      "fil-facets/facets",
      // FIL-Models registry (read-only query surface + declaration helpers)
      "fil-models/declaration",
      "fil-models/registry",
      // Wave-1 S2: tenant axis + event envelope (dark, not yet enforced)
      "control-plane/tenant",
      "control-plane/envelope",
    ] as string[],
  },
  C: {
    description: "Commercial SaaS tenant — constrained surface (FIL types + read-only query only)",
    exports: [
      // FIL-Core (taxonomy navigation + URN utilities; no composition/lifecycle builder)
      "fil-core/primitives",
      "fil-core/taxonomy",
      "fil-core/urn",
      // FIL-Facets (the seven facet interfaces — type definitions only)
      "fil-facets/facets",
      // Wave-1 additions for C-tier (if any) will extend this list as slices land.
    ] as string[],
  },
} as const;

/** The set of export tokens accessible to R-tier tenants. */
export type RTierExport = (typeof RELEASED_SURFACE.R.exports)[number];

/** The constrained set of export tokens accessible to C-tier tenants. */
export type CTierExport = (typeof RELEASED_SURFACE.C.exports)[number];
