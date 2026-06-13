// platform/recon/v2-tier-entitlement-coherence.ts
//
// recon:v2-tier-entitlement-coherence — V2 S16 (ENFORCING).
//
// The tier-entitlement coherence gate. The S5 released-surface gate
// (`recon:v2-released-surface-clean-core`) enforces the surface boundary at the
// code level; THIS gate enforces that the COMMERCIAL PACKAGING (the S16
// K/R/C flat-tier entitlement table) stays coherent with that surface boundary.
// The tier boundary IS the surface boundary — this gate makes that mechanical.
//
// FAILS CI if any of the following do not hold:
//
//   1. SURFACE SCOPE = TIER. Every entitlement's `surfaceScope` equals its
//      `tier` (the tier boundary IS the surface boundary).
//   2. CAPABILITY RESOLVES. Every capability token in every tier resolves to a
//      real released export — it appears in the union of all RELEASED_SURFACE
//      export sets (R ∪ C ∪ K-only). No phantom capabilities.
//   3. WITHIN SCOPE. No tier grants a capability outside its surface scope:
//        - C's capabilities ⊆ the C released surface,
//        - R's capabilities ⊆ the R released surface,
//        - K's capabilities ⊆ the full surface (R ∪ C ∪ K-only).
//      A synthetic over-grant — C entitling a K-only capability — IS CAUGHT
//      here (non-vacuous; exercised in the regression test).
//   4. CONTAINMENT C ⊆ R ⊆ K. Every C capability is also an R capability;
//      every R capability is also a K capability (K is full internal access).
//   5. FLAT-TIER MARKER. Every entitlement carries
//      `subscriptionModel === "flat-tier"` (the CEO Wave-4 posture — no metered
//      / per-seat axis) AND carries NO price-shaped field (selling is gated).
//   6. ANCHOR = K. `ANCHOR_TIER` is "K" (consistent with S14 fleet state —
//      the anchor `tenant:za-bank` is the K tier).
//   7. C-GO-LIVE PRECONDITIONS. The C-tier go-live precondition set is
//      non-empty, includes the second-provider-fallback precondition, and the
//      C tier is NOT go-live-ready while any precondition is unsatisfied
//      (selling is gated; the fallback is not yet implemented).
//
// The pure assertion logic (`assertTierEntitlementCoherence`) is separated from
// the live read so the regression test can drive it with a synthetic
// over-granting manifest and prove the catch is non-vacuous.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse is forbidden). It imports the v2 tier-entitlement
// model + released-surface manifest via the permitted v1→v2 direction.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13);
// D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s16-k-r-c-flat-tier-packaging-tier-entitlemen:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import { RELEASED_SURFACE } from "../../v2-core/released-surface";
import {
  ANCHOR_TIER,
  type CTierGoLivePrecondition,
  C_TIER_GO_LIVE_PRECONDITIONS,
  SECOND_PROVIDER_FALLBACK_PRECONDITION,
  type TierEntitlement,
  isCTierGoLiveReady,
  tierEntitlements,
} from "../../v2-core/tier-entitlement";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// The surface manifest shape this gate reads (plain arrays so tests can pass
// synthetic manifests). Matches RELEASED_SURFACE in v2-core/released-surface.ts.
// ---------------------------------------------------------------------------

export interface SurfaceManifest {
  K: { kOnlyExports: readonly string[] };
  R: { exports: readonly string[] };
  C: { exports: readonly string[] };
}

/** The full set of released export tokens (R ∪ C ∪ K-only) for a manifest. */
function fullSurface(manifest: SurfaceManifest): Set<string> {
  return new Set<string>([
    ...manifest.R.exports,
    ...manifest.C.exports,
    ...manifest.K.kOnlyExports,
  ]);
}

/** The set of tokens a given tier's surface scope permits. */
function scopeFor(manifest: SurfaceManifest, scope: "K" | "R" | "C"): Set<string> {
  if (scope === "K") return fullSurface(manifest);
  if (scope === "R") return new Set<string>(manifest.R.exports);
  return new Set<string>(manifest.C.exports);
}

// ---------------------------------------------------------------------------
// Price-field detection — selling is gated; entitlements carry no commercial
// commitment field. A defensive guard: if a future edit slips a price-shaped
// key onto a TierEntitlement, the gate catches it.
// ---------------------------------------------------------------------------

const PRICE_SHAPED_KEYS = [
  "price",
  "rate",
  "fee",
  "cost",
  "monthlyfee",
  "annualfee",
  "perseat",
  "seatprice",
  "meteredmetric",
  "ratecard",
  "amount",
  "currency",
];

function priceShapedKeysOn(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => PRICE_SHAPED_KEYS.includes(k.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Pure assertion input + logic (exercised sabotage-proof in the test).
// ---------------------------------------------------------------------------

export interface TierCoherenceInput {
  readonly entitlements: readonly TierEntitlement[];
  readonly manifest: SurfaceManifest;
  readonly anchorTier: string;
  readonly cTierPreconditions: readonly CTierGoLivePrecondition[];
  readonly cTierGoLiveReady: boolean;
}

/**
 * Pure coherence assertion over the entitlement table + surface manifest.
 * Returns the list of fail-severity violations (empty == clean) and the count
 * of checks asserted.
 */
export function assertTierEntitlementCoherence(input: TierCoherenceInput): {
  violations: ReconViolation[];
  asserted: number;
} {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  const { entitlements, manifest, anchorTier, cTierPreconditions, cTierGoLiveReady } = input;

  const fail = (subject: string, message: string): void => {
    violations.push({ subject, message, severity: "fail" });
  };

  const full = fullSurface(manifest);
  const byTier = new Map<string, TierEntitlement>();
  for (const e of entitlements) byTier.set(e.tier, e);

  // --- Per-tier checks 1, 2, 3, 5 ------------------------------------------
  for (const e of entitlements) {
    const scope = e.surfaceScope;

    // Check 1 — surfaceScope === tier.
    asserted += 1;
    if (e.surfaceScope !== e.tier) {
      fail(
        `tier:${e.tier}`,
        `surfaceScope "${e.surfaceScope}" != tier "${e.tier}" — the tier boundary must equal the surface boundary`,
      );
    }

    // surfaceScope must be a known tier letter to scope-check against.
    const validScope = scope === "K" || scope === "R" || scope === "C";
    const permitted = validScope ? scopeFor(manifest, scope) : new Set<string>();

    for (const cap of e.capabilities) {
      // Check 2 — capability resolves to a real released export.
      asserted += 1;
      if (!full.has(cap)) {
        fail(
          `tier:${e.tier}`,
          `capability "${cap}" does not resolve to any released export (phantom capability)`,
        );
      }

      // Check 3 — capability is within the tier's surface scope.
      asserted += 1;
      if (validScope && !permitted.has(cap)) {
        fail(
          `tier:${e.tier}`,
          `capability "${cap}" is OUTSIDE the ${scope}-tier surface scope — a tier may not grant a capability beyond its surface (e.g. C entitling a K-only export)`,
        );
      }
    }

    // Check 5 — flat-tier marker + no price-shaped field.
    asserted += 1;
    if (e.subscriptionModel !== "flat-tier") {
      fail(
        `tier:${e.tier}`,
        `subscriptionModel "${String(e.subscriptionModel)}" != "flat-tier" — the CEO Wave-4 posture mandates a flat tiered subscription (no metered / per-seat axis)`,
      );
    }
    asserted += 1;
    const priceKeys = priceShapedKeysOn(e as unknown as Record<string, unknown>);
    if (priceKeys.length > 0) {
      fail(
        `tier:${e.tier}`,
        `entitlement carries price-shaped field(s) [${priceKeys.join(", ")}] — selling is gated; entitlements are STRUCTURE only, no pricing`,
      );
    }
  }

  // --- Check 4 — containment C ⊆ R ⊆ K -------------------------------------
  const c = byTier.get("C");
  const r = byTier.get("R");
  const k = byTier.get("K");

  if (c && r) {
    const rCaps = new Set(r.capabilities);
    for (const cap of c.capabilities) {
      asserted += 1;
      if (!rCaps.has(cap)) {
        fail(
          "containment:C⊆R",
          `C capability "${cap}" is not in the R capability set — C ⊆ R must hold`,
        );
      }
    }
  }
  if (r && k) {
    const kCaps = new Set(k.capabilities);
    for (const cap of r.capabilities) {
      asserted += 1;
      if (!kCaps.has(cap)) {
        fail(
          "containment:R⊆K",
          `R capability "${cap}" is not in the K capability set — R ⊆ K must hold`,
        );
      }
    }
  }

  // --- Check 6 — anchor = K ------------------------------------------------
  asserted += 1;
  if (anchorTier !== "K") {
    fail(
      "anchor",
      `ANCHOR_TIER is "${anchorTier}" — the anchor (tenant:za-bank, S14 fleet state) must be the K tier`,
    );
  }

  // --- Check 7 — C-tier go-live preconditions ------------------------------
  asserted += 1;
  if (cTierPreconditions.length === 0) {
    fail(
      "c-go-live",
      "C-tier go-live precondition set is empty — there must be at least one standing precondition",
    );
  }
  asserted += 1;
  const hasSecondProvider = cTierPreconditions.some(
    (p) => p.key === SECOND_PROVIDER_FALLBACK_PRECONDITION.key,
  );
  if (!hasSecondProvider) {
    fail(
      "c-go-live",
      `C-tier go-live preconditions do not include the second-provider-fallback constraint ("${SECOND_PROVIDER_FALLBACK_PRECONDITION.key}") — required per D-V2-WAVE4-COMMERCIAL-POSTURE #5`,
    );
  }
  // If any precondition is unsatisfied, C must NOT be reported go-live-ready.
  asserted += 1;
  const anyUnsatisfied = cTierPreconditions.some((p) => !p.satisfied);
  if (anyUnsatisfied && cTierGoLiveReady) {
    fail(
      "c-go-live",
      "C tier is reported go-live-ready while at least one precondition is unsatisfied — selling is gated until every precondition (incl. tested second-provider fallback) is met",
    );
  }

  return { violations, asserted };
}

// ---------------------------------------------------------------------------
// Live read — the real entitlement table + real RELEASED_SURFACE manifest.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult("v2-tier-entitlement-coherence");

  const input: TierCoherenceInput = {
    entitlements: tierEntitlements(),
    manifest: RELEASED_SURFACE as unknown as SurfaceManifest,
    anchorTier: ANCHOR_TIER,
    cTierPreconditions: C_TIER_GO_LIVE_PRECONDITIONS,
    cTierGoLiveReady: isCTierGoLiveReady(),
  };

  const { violations, asserted } = assertTierEntitlementCoherence(input);
  result.asserted = asserted;
  result.violations = violations;
  return { ...result, ok: violations.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(
    `recon:v2-tier-entitlement-coherence — asserted ${r.asserted} check(s) across K/R/C tier entitlements; ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
