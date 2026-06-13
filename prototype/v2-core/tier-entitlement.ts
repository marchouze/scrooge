// v2-core/tier-entitlement.ts
//
// V2 S16 — K/R/C flat-tier packaging.
//
// The typed entitlement definition for the three BBaaS subscription tiers
// (K/R/C, D-V2-BBAAS-TIER-STRUCTURE). A tier-entitlement is the COMMERCIAL
// PACKAGING of the S5 released-surface boundary: the set of v2-core surface
// capabilities a tier is licensed to access, expressed as a flat subscription
// level. The tier boundary IS the surface boundary — the clean-core doctrine
// (released-surface.ts) made mechanical at the packaging layer.
//
// CEO WAVE-4 POSTURE (D-V2-WAVE4-COMMERCIAL-POSTURE, CEO-approved 2026-06-13):
//   - FLAT TIERED SUBSCRIPTION. A tier is a flat subscription level, NOT a
//     per-seat / metered-token billing axis. Every entitlement carries the
//     `subscriptionModel: "flat-tier"` marker. (S14 metering stays
//     operations-internal — the billing BASIS, never a billing axis here.)
//   - BUILD MECHANICS NOW; SELLING GATED. This module defines tier STRUCTURE
//     and ENTITLEMENTS only. There are NO price fields, rate-cards, or external
//     commitments anywhere in this file — selling is gated on the anchor
//     PA-approval proof (held as internal IP, not productised).
//   - K → R → C sequencing. Anchor = K.
//
// PURE DATA + PURE FUNCTIONS. This file reads no wall clock and holds no stored
// state: tier capabilities are DERIVED from the RELEASED_SURFACE manifest, so
// the manifest stays the single source of truth and the tier boundary cannot
// drift from the surface boundary (the coherence gate
// `recon:v2-tier-entitlement-coherence` proves this).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. See `recon:v2-no-v1-import`.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13);
// D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s16-k-r-c-flat-tier-packaging-tier-entitlemen:2026-06-13
// Author: Atlas (Substrate Architect, engineering), with PAX (Research) input
// on tier-content mapping.

import { ANCHOR_TENANT_ID, type AnchorTenantId } from "./control-plane/tenant";
import { RELEASED_SURFACE } from "./released-surface";

// ---------------------------------------------------------------------------
// Tier label + subscription model marker
// ---------------------------------------------------------------------------

/**
 * The three BBaaS service tiers. K → R → C is the sequencing; C ⊆ R ⊆ K is the
 * surface-containment relation (most-constrained → least-constrained).
 *
 *   K  — anchor bank (kernel). Full internal access; the seed tenant
 *        `tenant:za-bank`. The anchor tier (S14 fleet state: tier K).
 *   R  — regulated tenant. FIL-mediated surface + control-plane subscription
 *        + posture-read. A constrained subset of K.
 *   C  — commercial SaaS tenant. Most constrained: FIL types + read-only
 *        query. A constrained subset of R.
 */
export type TierLabel = "K" | "R" | "C";

/**
 * The subscription-model marker. Per the CEO Wave-4 posture there is exactly
 * ONE model: a flat tiered subscription. This is a discriminant, not a billing
 * axis — there is intentionally no metered / per-seat variant. The literal
 * exists so every entitlement carries an explicit, gate-checkable marker that
 * the packaging is flat (NOT metered).
 */
export type SubscriptionModel = "flat-tier";

/** The single sanctioned subscription model literal. */
export const SUBSCRIPTION_MODEL_FLAT_TIER: SubscriptionModel = "flat-tier";

// ---------------------------------------------------------------------------
// Tier-entitlement shape
// ---------------------------------------------------------------------------

/**
 * The typed entitlement definition for a single tier.
 *
 *   tier               — the tier label (K / R / C).
 *   surfaceScope       — the S5 released-surface tier key this entitlement maps
 *                        to. The tier boundary IS the surface boundary, so this
 *                        is always the same letter as `tier`.
 *   capabilities       — the v2-core surface export tokens this tier is
 *                        licensed to access, DERIVED from RELEASED_SURFACE
 *                        (never hand-maintained — the manifest is the source).
 *                        Token convention matches the surface manifest:
 *                        the v2-core/index.ts relative path minus the leading
 *                        "./" (e.g. "fil-core/primitives").
 *   subscriptionModel  — always "flat-tier" (CEO Wave-4 posture). No price.
 *
 * DELIBERATELY ABSENT: there is no `price`, `rate`, `monthlyFee`, `perSeat`,
 * `meteredMetric`, or any commercial-commitment field. Selling is gated; this
 * is STRUCTURE only. The coherence gate asserts the absence is preserved.
 */
export interface TierEntitlement {
  readonly tier: TierLabel;
  readonly surfaceScope: TierLabel;
  readonly capabilities: readonly string[];
  readonly subscriptionModel: SubscriptionModel;
}

// ---------------------------------------------------------------------------
// Capability derivation from the S5 released-surface manifest
// ---------------------------------------------------------------------------

/**
 * The capability set for the K tier — the ANCHOR. K is full internal access:
 * no restriction on any export. K therefore entitles the UNION of every export
 * surfaced to any tier (R ∪ C) PLUS every K-only export. Because the manifest
 * lists R and C explicitly and the K-only set in `kOnlyExports`, the K
 * capability set is the union of all three. (Every export in v2-core/index.ts
 * is annotated and classified by the S5 gate, so this union is exhaustive.)
 *
 * Returns a sorted, de-duplicated token list.
 */
export function deriveKCapabilities(): string[] {
  const union = new Set<string>([
    ...RELEASED_SURFACE.R.exports,
    ...RELEASED_SURFACE.C.exports,
    ...RELEASED_SURFACE.K.kOnlyExports,
  ]);
  return [...union].sort((a, b) => a.localeCompare(b));
}

/** The R-tier capability set — the regulated-tenant released surface (sorted). */
export function deriveRCapabilities(): string[] {
  return [...RELEASED_SURFACE.R.exports].sort((a, b) => a.localeCompare(b));
}

/** The C-tier capability set — the commercial-SaaS released surface (sorted). */
export function deriveCCapabilities(): string[] {
  return [...RELEASED_SURFACE.C.exports].sort((a, b) => a.localeCompare(b));
}

/**
 * Build the entitlement for a single tier, deriving its capabilities from the
 * S5 released-surface manifest. The tier boundary IS the surface boundary:
 * `surfaceScope === tier` always.
 */
export function buildTierEntitlement(tier: TierLabel): TierEntitlement {
  const capabilities =
    tier === "K"
      ? deriveKCapabilities()
      : tier === "R"
        ? deriveRCapabilities()
        : deriveCCapabilities();
  return {
    tier,
    surfaceScope: tier,
    capabilities,
    subscriptionModel: SUBSCRIPTION_MODEL_FLAT_TIER,
  };
}

/**
 * The canonical tier-entitlement table: K, R, C — each a flat-tier subscription
 * mapped to its S5 surface scope, capabilities derived from the manifest.
 * Ordered K → R → C (the sequencing direction).
 */
export function tierEntitlements(): readonly TierEntitlement[] {
  return [buildTierEntitlement("K"), buildTierEntitlement("R"), buildTierEntitlement("C")];
}

/** Look up the entitlement for a single tier. */
export function tierEntitlement(tier: TierLabel): TierEntitlement {
  return buildTierEntitlement(tier);
}

// ---------------------------------------------------------------------------
// Anchor = K binding (ties to S14 fleet state)
// ---------------------------------------------------------------------------

/**
 * The anchor tenant's tier. The anchor (`tenant:za-bank`, S14 fleet state) is
 * the K tier — full internal access. This constant binds the packaging layer
 * to the tenant axis so the coherence gate can assert anchor=K consistency.
 */
export const ANCHOR_TIER: TierLabel = "K";

/** The anchor tenant id (re-exported as the K-tier subject for convenience). */
export const ANCHOR_TIER_TENANT_ID: AnchorTenantId = ANCHOR_TENANT_ID;

/**
 * Returns `true` iff the given tenant id is the anchor — and therefore on the
 * K tier. A dark-mode helper consistent with `isAnchorTenantEvent`; packaging
 * call-sites use it to confirm the anchor maps to K.
 */
export function isAnchorTier(tenantId: string): boolean {
  return tenantId === ANCHOR_TIER_TENANT_ID;
}

// ---------------------------------------------------------------------------
// C-tier go-live preconditions (standing constraints, gated to C-tier)
// ---------------------------------------------------------------------------

/**
 * A standing go-live precondition for the C (commercial SaaS) tier. C-tier is
 * the most externally-exposed tier; before it can go live, a set of standing
 * constraints must be satisfied. Each precondition is a typed, documented
 * marker; the coherence gate asserts that the canonical set is present and
 * well-formed.
 *
 *   key            — stable identifier (kebab-case).
 *   title          — human-readable name.
 *   description    — what must be true before C-tier go-live.
 *   satisfied      — whether the precondition is currently met. Build-phase
 *                    default is `false` for every precondition (selling is
 *                    gated; nothing is satisfied yet). A precondition flips to
 *                    `true` only when its evidence lands in a later workstream.
 *   authority      — the decision / posture that mandates the precondition.
 */
export interface CTierGoLivePrecondition {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly satisfied: boolean;
  readonly authority: string;
}

/**
 * The second-provider-fallback precondition (Wave-4 decision #5). C-tier
 * commercial SaaS cannot go live on a single model/inference provider: a
 * TESTED second-provider fallback must be in place so a primary-provider
 * outage or withdrawal does not take a commercial tenant dark. This is the
 * CONSTRAINT/precondition record only — the actual fallback implementation is
 * a separate, larger workstream. `satisfied: false` until that workstream
 * lands and is tested.
 */
export const SECOND_PROVIDER_FALLBACK_PRECONDITION: CTierGoLivePrecondition = {
  key: "second-provider-fallback",
  title: "Tested second-provider fallback",
  description:
    "C-tier cannot go live without a tested second-provider (model/inference) " +
    "fallback: a primary-provider outage or withdrawal must not take a " +
    "commercial tenant dark. Precondition + gate only here; the fallback " +
    "implementation is a separate workstream.",
  satisfied: false,
  authority: "D-V2-WAVE4-COMMERCIAL-POSTURE",
};

/**
 * The cross-tenant CSI gate precondition (D-W7). C-tier (and any multi-tenant
 * learning) is NOT in the R/C released surface until the cross-tenant CSI gate
 * clears — competition-law keystone. Documented here as a C-go-live
 * precondition so the full C-tier gate-set is in one place. `satisfied: false`
 * until the cross-tenant learning flow is cleared for C.
 */
export const CROSS_TENANT_CSI_PRECONDITION: CTierGoLivePrecondition = {
  key: "cross-tenant-csi-gate-cleared",
  title: "Cross-tenant CSI gate cleared",
  description:
    "Cross-tenant learning is not in the C released surface until the " +
    "cross-tenant CSI (competitively-sensitive-information) gate clears — the " +
    "D-W7 multi-tenant-learning go-live precondition.",
  satisfied: false,
  authority: "D-W7-VENDOR-ENTITY-STRUCTURE",
};

/**
 * The canonical set of C-tier go-live preconditions. The coherence gate
 * asserts (a) the set is non-empty, (b) the second-provider-fallback
 * precondition is present, and (c) C-tier is NOT marked go-live-ready while any
 * precondition is unsatisfied.
 */
export const C_TIER_GO_LIVE_PRECONDITIONS: readonly CTierGoLivePrecondition[] = [
  SECOND_PROVIDER_FALLBACK_PRECONDITION,
  CROSS_TENANT_CSI_PRECONDITION,
];

/**
 * Whether the C tier is cleared to go live: every standing precondition is
 * satisfied. In the build phase this is `false` (selling is gated; the
 * second-provider fallback is not yet implemented). A pure derivation over the
 * precondition set — no stored "go-live" flag exists.
 */
export function isCTierGoLiveReady(
  preconditions: readonly CTierGoLivePrecondition[] = C_TIER_GO_LIVE_PRECONDITIONS,
): boolean {
  return preconditions.length > 0 && preconditions.every((p) => p.satisfied);
}
