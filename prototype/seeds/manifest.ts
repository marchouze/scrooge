// seeds/manifest.ts
//
// Canonical inventory of the build-phase boot seeds (objective 1 of
// D-TRUSTED-FIGURES-PROGRAM-V1). Every data-emitting `bootXxx()` function in
// `dashboard/server.ts`'s `bootDerive()` sequence has exactly one entry here.
// This is what makes the seed layer *visible* (the /api/seeds + Seeds page read
// it) and *controllable* (descope reads SeedDescoped, keyed by `seedId`).
//
// Parity is enforced by `recon:seed-manifest-parity`: a boot-seed call in
// `bootDerive()` with no manifest entry — or a manifest entry whose `bootFn`
// is not called in `bootDerive()` — is a violation. A new seed cannot ship
// invisibly.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

/** Classification of what a seed populates. */
export type SeedKind = "treasury-positions";

/** A pointer to the authoring UI that replaces a seed with real-simulated events. */
export interface SeedReplaceTarget {
  /** Display label for the authoring surface. */
  label: string;
  /** Dashboard page that authors the real-simulated equivalent. */
  href: string;
}

export interface SeedManifestEntry {
  /** Stable identifier — the key SeedDescoped / SeedPromotedToSimulated reference. */
  seedId: string;
  /** Name of the boot function in `dashboard/server.ts` that emits this seed. */
  bootFn: string;
  /** Short human title for the Seeds page. */
  title: string;
  /** What the seed populates and why it exists. */
  description: string;
  /** Classification. */
  kind: SeedKind;
  /** Event types this seed emits (for the Seeds page + parity hints). */
  emittedEventTypes: readonly string[];
  /**
   * May an operator descope this at next boot? Data seeds are descopable;
   * structural identity/governance backfills (fleet, party graph) are not —
   * removing them would break the agent/party axes the whole substrate rests on.
   */
  descopable: boolean;
  /** If the seed can be replaced with real-simulated events, the authoring UI. */
  replaceWith?: SeedReplaceTarget;
  /** Citations for the seed's authority. */
  citations: readonly string[];
}

export const SEED_MANIFEST: readonly SeedManifestEntry[] = [];

/** Look up a manifest entry by seedId. */
export function getSeedManifestEntry(seedId: string): SeedManifestEntry | undefined {
  return SEED_MANIFEST.find((e) => e.seedId === seedId);
}

/** All seedIds in the manifest. */
export function allSeedIds(): string[] {
  return SEED_MANIFEST.map((e) => e.seedId);
}
