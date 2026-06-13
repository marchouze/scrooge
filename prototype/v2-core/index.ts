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

/** @tier R — FIL composition factory (S6): typed-spec → composite builder; regulated-tenant surface and above */
export * from "./fil-core/composition-factory";

/** @tier R — FIL composition-factory alias (S6): the swappable construction seam; regulated-tenant surface and above */
export * from "./fil-core/composition-factory-alias";

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

/** @tier R — FX valuation: the second FIL-Model (Valuable + Accountable over
 * fil:type:fx:*) + FCY-cash monetary Valuable + the first real attribution
 * metric (additive FX P&L) + the book:fx-trading slice. Read-only / parallel to
 * v1 (A2); v1 retirement is A4.
 * Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2). */
export * from "./fil-models/fx-valuation";

/** @tier R — Market-risk VaR: the first non-additive (`joint-recompute`)
 * `AttributionMetric`. Historical-simulation VaR/ES over a JOINT member set
 * (ported from v1, no import); proves diversification (group VaR < Σ desk VaRs)
 * + v1 standing-NOP parity at the group node. Read-only / parallel to v1 (A3).
 * Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3); D-VAR-EXPOSURE-INCLUDES-STANDING-NOP. */
export * from "./fil-models/market-risk-var";

// --- Control-plane (Wave 1) ------------------------------------------------

/** @tier R — tenant axis: ANCHOR_TENANT_ID, TenantId, tenantIdSchema, isAnchorTenantEvent (dark, not yet enforced) */
export * from "./control-plane/tenant";

/** @tier R — V2 event envelope: V2Envelope, createV2Envelope (dark, not yet enforced) */
export * from "./control-plane/envelope";

/** @tier R — tenant-axis ENFORCEMENT (S10): per-tenant store routing
 * (resolveTenantStore, TenantScopedStore, makeAnchorOnlyResolver,
 * makeRegistryResolver) + fail-closed resolver seam through the shared
 * alias-registry. Flips the S2 tenant axis from dark → enforced.
 * Authority: D-V2-TENANCY-ARCHITECTURE; D-FIL-SHARED-ALIAS-REGISTRY. */
export * from "./control-plane/tenant-store";

// --- Banking (S4: anchor-bank standing-data events) ------------------------

/** @tier K — anchor-bank standing-data events (product catalogue, CoA, RAS) */
export * from "./banking/events";

// --- FIL instances (materialisation: IR + FX as native fil:inst) -----------

/** @tier K — FIL instance lifecycle event family + live-instance projection
 * (anchor-book materialisation; emitted into BANK_V2_ANCHOR_DB only).
 * Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1. */
export * from "./fil-instances";

// --- FIL attribution (A1 kernel) -------------------------------------------

/** @tier R — dimensional metric-attribution kernel: AttributionDimensions +
 * DimensionHierarchy; the AttributionMetric interface + AggregationSemantics
 * (additive / joint-recompute) + empty metric registry; the Slice / query model;
 * InstrumentDimensionAssigned + SliceDefined event payloads; the tenant-scoped
 * aggregation engine (member selection REUSES the S10 tenant axis — no parallel
 * mechanism). No metrics bound at A1; models register in later slices.
 * Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL. */
export * from "./fil-attribution";

// --- Posture register (W8 Slice 1) -----------------------------------------

/** @tier R — PostureRegistered / Activated / Deactivated / Revised event types; APPLIES_WHEN
 * predicate; PostureRegister projection. Authority: D-W8-POSTURE-REGISTER-SLICE-1. */
export * from "./posture";

// --- Applicability-assessment lifecycle (S8) -------------------------------

/** @tier R — ApplicabilityAssessmentRequested / Performed / Concluded event types; the pure
 * assessment engine (assessApplicability) reusing the S3 APPLIES_WHEN evaluator; AssessmentRegister
 * projection (getAssessment / listAssessments / assessmentsForSubject). Authority:
 * D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS. */
export * from "./applicability";

// --- Decision-impact sweeps (S9) — W8 governance keystone ------------------

/** @tier R — DecisionImpactSweepRequested / DecisionImpactAssessed event types; the pure
 * sweep engine (computeDecisionImpact) computing impacted artefacts via the citation graph +
 * scope overlap (reusing the S3 APPLIES_WHEN evaluator a decision is one S8 subjectKind of);
 * SweepRegister projection (impactsForDecision / listSweeps / getSweep / sweepsForDecision).
 * Authority: D-W8-DECISION-IMPACT-SWEEP; D-V2-BBAAS-BLUEPRINT-SYNTHESIS. */
export * from "./decision-impact";

// --- Eval harness (S13) — the assurance / eval plane ------------------------

/** @tier R — exam-set register (Exam / ExamSet / ExamExpectation + schemas + well-formedness);
 * the eval harness (runEval, EvalSubject, EvalResult); the structured-first change-gate
 * (evaluateChangeGate, composes with — does not replace — Nadia's independent-validation plane);
 * ExamSetRegistered / EvalRunCompleted event payloads; the SA-CCR pilot exam-set + subject adapter.
 * Authority: D-W4-MODEL-LIBRARY-PILOT; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W8-POSTURE-REGISTER-SLICE-1. */
export * from "./eval";

// --- Cross-tenant CSI gate (S12) — competition-law keystone ----------------

/** @tier K — CSI blocklist register (CsiCategoryRegistered/Retired, CSI_SEED_CATEGORIES),
 * CsiBlocklist projection, and the fail-closed cross-tenant learning gate
 * (screenCrossTenantLearningFlow, CrossTenantLearningScreened/Blocked). ANCHOR-BANK
 * ONLY: cross-tenant learning is NOT in the R/C released surface until this gate
 * clears (the D-W7 C-tier / multi-tenant-learning go-live precondition).
 * Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE. */
export * from "./cross-tenant";

// --- Control-plane (Wave 1, S1) — fleet store --------------------------------

/** @tier K — control-plane event shapes (TenantRegistered, TenantSurfaceGranted, TenantUpgradeLedgerEntry, TenantMeterEvent); anchor-bank only */
export * from "./control-plane/events";

/** @tier K — control-plane SQLite store factory (openControlPlaneStore, ControlPlaneStore); anchor-bank only */
export * from "./control-plane/store";

/** @tier K — control-plane in-memory projection (ControlPlaneProjection, Tenant, listTenants, getTenant, getMeteringWindow); anchor-bank only */
export * from "./control-plane/projection";

/** @tier K — S14 operational fleet layer (FleetProjection: listFleet, getTenantFleetState, meteringSummary, fleetMeteringSummary, tenantVersion, fleetVersionDrift); AgentOps anchor-bank only */
export * from "./control-plane/fleet";

/** @tier R — S11 tenant-scoped functional-seat model (FunctionalSeatProjection, deriveSeatMap, deriveAndAppendAnchorSeats, seatId, roleSlug, assertSeatRosterParity); seats are tenant-scoped so a second tenant's CRO seat never collides with the anchor's */
export * from "./control-plane/functional-seats";

/** @tier K — S15 tenant onboarding mechanics + onboarding-readiness (runOnboarding, preflightOnboarding,
 * OnboardingPlan, OnboardingResult, assertOnboardingReadiness, foldTenantOnboardingState, checkTenantReadiness,
 * ONBOARDING_STEPS). The onboarding flow PROVISIONS a tenant by wiring the existing substrate (S1 register →
 * S11 seats → S5 surface grant → S14 fleet state); fail-closed (no half-provisioned tenant). Readiness gates
 * a tenant ready ONLY when every step landed + tier preconditions met — the platform can REFUSE incomplete
 * onboarding (a C-tier tenant cannot be ready while S16 C-go-live preconditions are unsatisfied). Provisions
 * TENANCY ONLY — no part of the anchor's PA approval-file IP is packaged/shipped (held as internal IP).
 * Fleet-operator anchor-internal. Authority: D-V2-WAVE4-COMMERCIAL-POSTURE; D-V2-TENANCY-ARCHITECTURE. */
export * from "./control-plane/onboarding";

// --- Tier entitlements (S16) — K/R/C flat-tier packaging --------------------

/** @tier R — S16 K/R/C flat-tier entitlement model (TierEntitlement, tierEntitlements, buildTierEntitlement,
 * deriveK/R/CCapabilities, ANCHOR_TIER, isAnchorTier, SUBSCRIPTION_MODEL_FLAT_TIER) + C-tier go-live
 * preconditions (CTierGoLivePrecondition, SECOND_PROVIDER_FALLBACK_PRECONDITION, C_TIER_GO_LIVE_PRECONDITIONS,
 * isCTierGoLiveReady). Capabilities are DERIVED from the S5 released-surface manifest — the tier boundary IS
 * the surface boundary. Flat-subscription marker only; NO price fields (selling gated). The packaging model
 * is itself R-visible. Authority: D-V2-WAVE4-COMMERCIAL-POSTURE; D-V2-BBAAS-TIER-STRUCTURE. */
export * from "./tier-entitlement";
