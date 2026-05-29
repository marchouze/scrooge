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
export type SeedKind =
  | "model-governance"
  | "treasury-positions"
  | "balance-sheet"
  | "npa-attestation"
  | "party-graph"
  | "fleet-identity";

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

export const SEED_MANIFEST: readonly SeedManifestEntry[] = [
  {
    seedId: "model-registry",
    bootFn: "bootModelRegistry",
    title: "Pricing model registry",
    description:
      "Submits and tier-classifies the 3 build-phase pricing models (SAGB DCF, ZARONIA OIS+IRS-PV, FX forward IRP). Gates the NPA + validation seeds that read model status.",
    kind: "model-governance",
    emittedEventTypes: ["ModelSubmitted", "ModelTierClassified"],
    descopable: true,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8"],
  },
  {
    seedId: "model-validation",
    bootFn: "bootModelValidationSeeds",
    title: "Model validation (v0.1)",
    description:
      "Publishes Tier-2 + Tier-3 validation methodologies (v0.1) and approves the 3 build-phase pricing models so the NPA gate can pass.",
    kind: "model-governance",
    emittedEventTypes: ["ValidationMethodologyPublished", "ModelValidationApproved"],
    descopable: true,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8"],
  },
  {
    seedId: "model-registered",
    bootFn: "bootModelRegisteredSeeds",
    title: "Model registration (IRS/FX gap closure)",
    description:
      "Emits ModelRegistered ×3, methodology v1 ×2, and ModelValidationApproved ×3 for IRS ZARONIA + FX swap model-risk gap closure. Complements the v0.1 validation seed.",
    kind: "model-governance",
    emittedEventTypes: [
      "ModelRegistered",
      "ValidationMethodologyPublished",
      "ModelValidationApproved",
    ],
    descopable: true,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8"],
  },
  {
    seedId: "calc-models",
    bootFn: "bootCalcModels",
    title: "Regulatory-metric calc models (LCR/NSFR/CET1)",
    description:
      "Registers + approves the 3 regulatory-metric models that calculation-binding.ts binds surfaced figures to. Without these, every regulatory figure is a loud unapproved-model failure.",
    kind: "model-governance",
    emittedEventTypes: ["ModelSubmitted", "ModelTierClassified", "ModelValidationApproved"],
    descopable: true,
    citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
  },
  {
    seedId: "npa-attestations",
    bootFn: "bootNpaAttestations",
    title: "NPA product approvals (M1–M4)",
    description:
      "Emits ProductApproved for the 5 core products (equity, bond, repo, IRS, FX swap). Required before trade seeds that reference these products.",
    kind: "npa-attestation",
    emittedEventTypes: ["ProductApproved"],
    descopable: true,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8"],
  },
  {
    seedId: "treasury-positions",
    bootFn: "bootTreasurySeeds",
    title: "Treasury positions (REPO / MMD / IBL)",
    description:
      "Emits repo trades, money-market deposits, interbank placements and funding lines so getALMPositionSnapshot derives live LCR/NSFR values. Superseded automatically if the treasury sim scenario has run.",
    kind: "treasury-positions",
    emittedEventTypes: [
      "RepoTradeOpened",
      "DepositTaken",
      "InterbankLoanPlaced",
      "FundingLineDrawn",
    ],
    descopable: true,
    replaceWith: { label: "Trade book (author real-simulated)", href: "/trade-book.html" },
    citations: ["WS1-PR1a", "WS2"],
  },
  {
    seedId: "balance-sheet-baseline",
    bootFn: "bootBalanceSheetSeed",
    title: "Balance-sheet baseline (NSFR)",
    description:
      "Emits a single BalanceSheetProjected event providing the build-phase NSFR ASF/RSF baseline.",
    kind: "balance-sheet",
    emittedEventTypes: ["BalanceSheetProjected"],
    descopable: true,
    citations: ["D-TREASURY-GAPS-WAVE1"],
  },
  {
    seedId: "fleet-identity",
    bootFn: "bootFleetRegistration",
    title: "Fleet registration (agent identity)",
    description:
      "Registers the team roster through the agent registry / identity issuer / permission publisher. Structural identity backfill — not descopable (the whole agent axis depends on it).",
    kind: "fleet-identity",
    emittedEventTypes: ["AgentRegistered", "IdentityKeyRotated", "PermissionPolicyPublished"],
    descopable: false,
    citations: ["S8-A4"],
  },
  {
    seedId: "party-graph",
    bootFn: "bootPartyBackfill",
    title: "Party graph backfill",
    description:
      "Backfills the unified Party event family (PartyRegistered / PartyRelationshipAsserted / PartyClassified) from legal-entity, counterparty, agent and signatory streams. Structural — not descopable.",
    kind: "party-graph",
    emittedEventTypes: ["PartyRegistered", "PartyRelationshipAsserted", "PartyClassified"],
    descopable: false,
    citations: ["D-PARTY-REGISTER"],
  },
];

/** Look up a manifest entry by seedId. */
export function getSeedManifestEntry(seedId: string): SeedManifestEntry | undefined {
  return SEED_MANIFEST.find((e) => e.seedId === seedId);
}

/** All seedIds in the manifest. */
export function allSeedIds(): string[] {
  return SEED_MANIFEST.map((e) => e.seedId);
}
