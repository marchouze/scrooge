// platform/markets/products/npa-dimension-upgrades.ts
//
// Platform module: NPA dimension-upgrade functions.
//
// Extracts the upgrade passes from the retired npa-attestation-seed.ts boot seed
// and re-homes them as a proper platform module. Each function is idempotent and
// callable from scripts or future orchestration.
//
// Functions exported:
//   seedModelRiskUpgrades()            — model-risk: equity + repo (no-model products)
//   seedValidatedModelRiskUpgrades()   — model-risk: bond/IRS/FX when model validation present
//   seedSubstrateReadyDimensionUpgrades() — market-risk/op-readiness/accounting/capital/legal
//   seedGovernanceDimensionUpgrades()  — conduct/aml/infosec/privacy
//   seedRemainingDimensionUpgrades()   — credit-risk/liquidity-risk/operational-risk
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import { makeProductDimensionAttested } from "../../event-store/event-types/product";
import type { EventStore } from "../../event-store/store";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const DIM_BASE_CHAIN = [
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
] as const;

// ---------------------------------------------------------------------------
// Slice 7 — model-risk upgrade (no-model products: equity + repo)
// ---------------------------------------------------------------------------

/** Products whose model-risk can be upgraded without a ModelValidationApproved event. */
export const NO_MODEL_PRODUCTS: ReadonlyArray<{ productId: string; notes: string }> = [
  {
    productId: "prd:bank:equity:jse-equity-cash",
    notes:
      "No pricing model. JSE-quoted prices used directly. SR 11-7 §I model definition not met. Tier: N/A.",
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    notes:
      "No pricing model. Repo rate negotiated bilaterally; collateral valued at quoted prices. Tier: N/A.",
  },
] as const;

/** Products whose model-risk upgrade requires a ModelValidationApproved event. */
export const WITH_MODEL_PRODUCTS: ReadonlyArray<{
  productId: string;
  modelId: string;
}> = [
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    modelId: "model:sagb-dcf-v1",
  },
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    modelId: "model:zaronia-ois-irspv-v1",
  },
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    modelId: "model:fx-forward-irp-v1",
  },
] as const;

const UPGRADE_AS_OF = "2026-05-26T19:00:00.000Z";
const UPGRADE_ACTOR = { type: "service" as const, id: "agent:atlas:npa-model-risk-upgrade" };
const UPGRADE_CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

/**
 * Upgrades model-risk attestation to implementation-attested for products
 * where no pricing model is used. Idempotent.
 */
export function seedModelRiskUpgrades(store: EventStore): {
  upgraded: string[];
  skipped: string[];
} {
  const upgraded: string[] = [];
  const skipped: string[] = [];

  const alreadyUpgraded = new Set(
    Array.from(store.replay())
      .filter(
        (ev) =>
          ev.type === "ProductDimensionAttested" &&
          (ev.payload as Record<string, unknown>).dimension === "model-risk" &&
          (ev.payload as Record<string, unknown>).result === "implementation-attested",
      )
      .map((ev) => (ev.payload as Record<string, unknown>).productId as string),
  );

  for (const { productId } of NO_MODEL_PRODUCTS) {
    if (alreadyUpgraded.has(productId)) {
      skipped.push(productId);
      continue;
    }
    const ev = makeProductDimensionAttested({
      asOf: UPGRADE_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: UPGRADE_ACTOR,
      citations: UPGRADE_CITATIONS,
      payload: {
        productId,
        dimension: "model-risk",
        result: "implementation-attested",
        citationChain: [
          "D-NEW-PRODUCT-APPROVAL-POLICY",
          "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
          "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
        ],
      },
    });
    store.append(ev);
    upgraded.push(productId);
  }

  return { upgraded, skipped };
}

// ---------------------------------------------------------------------------
// Slice 7 — model-risk upgrade (model-using products: bond, IRS, FX)
// ---------------------------------------------------------------------------

export interface ValidatedModelRiskUpgradeResult {
  readonly upgraded: string[];
  readonly skipped: string[];
  readonly blocked: string[];
}

/**
 * Upgrades model-risk attestation to implementation-attested for products
 * whose primary pricing model has a ModelValidationApproved event in the store.
 *
 * Products without an approved validation are returned in `blocked` and will be
 * upgraded on the next run after the validation events land.
 * Idempotent: products already at implementation-attested are returned in `skipped`.
 */
export function seedValidatedModelRiskUpgrades(store: EventStore): ValidatedModelRiskUpgradeResult {
  const upgraded: string[] = [];
  const skipped: string[] = [];
  const blocked: string[] = [];

  const events = Array.from(store.replay());

  const approvedModelIds = new Set(
    events
      .filter((ev) => ev.type === "ModelValidationApproved")
      .map((ev) => (ev.payload as Record<string, unknown>).modelId as string),
  );

  const alreadyUpgraded = new Set(
    events
      .filter(
        (ev) =>
          ev.type === "ProductDimensionAttested" &&
          (ev.payload as Record<string, unknown>).dimension === "model-risk" &&
          (ev.payload as Record<string, unknown>).result === "implementation-attested",
      )
      .map((ev) => (ev.payload as Record<string, unknown>).productId as string),
  );

  for (const { productId, modelId } of WITH_MODEL_PRODUCTS) {
    if (alreadyUpgraded.has(productId)) {
      skipped.push(productId);
      continue;
    }
    if (!approvedModelIds.has(modelId)) {
      blocked.push(productId);
      continue;
    }
    const ev = makeProductDimensionAttested({
      asOf: UPGRADE_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: UPGRADE_ACTOR,
      citations: UPGRADE_CITATIONS,
      payload: {
        productId,
        dimension: "model-risk",
        result: "implementation-attested",
        citationChain: [
          "D-NEW-PRODUCT-APPROVAL-POLICY",
          "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
          "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
        ],
      },
    });
    store.append(ev);
    upgraded.push(productId);
  }

  return { upgraded, skipped, blocked };
}

// ---------------------------------------------------------------------------
// Substrate-ready dimension upgrades (PR-I)
//
// Upgrades specific (productId, dimension) pairs from design-attested to
// implementation-attested for the four non-equity products where the
// required substrate now exists.
// ---------------------------------------------------------------------------

export interface DimUpgrade {
  readonly productId: string;
  readonly dimension: string;
  readonly citationChain: readonly string[];
}

export interface SubstrateReadyUpgradeResult {
  readonly upgraded: string[]; // "productId:dimension"
  readonly skipped: string[];
}

const DIM_UPGRADE_AS_OF = "2026-05-27T06:00:00.000Z";
const DIM_UPGRADE_ACTOR = { type: "service" as const, id: "agent:atlas:npa-dimension-upgrade" };

const SUBSTRATE_READY_UPGRADES: readonly DimUpgrade[] = [
  // Bond (prd:bank:bond:sagb-fixed-coupon)
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    dimension: "market-risk",
    citationChain: [...DIM_BASE_CHAIN, "ORG-PR-19"],
  },
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    dimension: "operational-readiness",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    dimension: "accounting",
    citationChain: [...DIM_BASE_CHAIN, "ORG-AC-01"],
  },
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    dimension: "capital",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    dimension: "legal",
    citationChain: [...DIM_BASE_CHAIN],
  },

  // Repo (prd:bank:bond:open-repo-gmra)
  {
    productId: "prd:bank:bond:open-repo-gmra",
    dimension: "market-risk",
    citationChain: [...DIM_BASE_CHAIN, "ORG-PR-19"],
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    dimension: "operational-readiness",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    dimension: "accounting",
    citationChain: [...DIM_BASE_CHAIN, "ORG-AC-01"],
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    dimension: "capital",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    dimension: "legal",
    citationChain: [...DIM_BASE_CHAIN],
  },

  // IRS (prd:bank:ird:vanilla-zar-fix-zaronia) — capital+legal already attested
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    dimension: "market-risk",
    citationChain: [...DIM_BASE_CHAIN, "ORG-PR-19"],
  },
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    dimension: "operational-readiness",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    dimension: "accounting",
    citationChain: [...DIM_BASE_CHAIN, "ORG-AC-01"],
  },

  // FX swap (prd:bank:fx:fx-swap-usdzar)
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    dimension: "market-risk",
    citationChain: [...DIM_BASE_CHAIN, "ORG-PR-19"],
  },
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    dimension: "operational-readiness",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    dimension: "accounting",
    citationChain: [...DIM_BASE_CHAIN, "ORG-AC-01"],
  },
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    dimension: "capital",
    citationChain: [...DIM_BASE_CHAIN],
  },
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    dimension: "legal",
    citationChain: [...DIM_BASE_CHAIN],
  },
];

/**
 * Upgrades (productId, dimension) pairs to implementation-attested where the
 * required substrate already exists in the codebase. Idempotent: pairs with an
 * existing implementation-attested event are skipped.
 */
export function seedSubstrateReadyDimensionUpgrades(
  store: EventStore,
): SubstrateReadyUpgradeResult {
  const upgraded: string[] = [];
  const skipped: string[] = [];

  const events = Array.from(store.replay());

  const alreadyUpgraded = new Set(
    events
      .filter(
        (ev) =>
          ev.type === "ProductDimensionAttested" &&
          (ev.payload as Record<string, unknown>).result === "implementation-attested",
      )
      .map(
        (ev) =>
          `${(ev.payload as Record<string, unknown>).productId}:${(ev.payload as Record<string, unknown>).dimension}`,
      ),
  );

  for (const upgrade of SUBSTRATE_READY_UPGRADES) {
    const key = `${upgrade.productId}:${upgrade.dimension}`;
    if (alreadyUpgraded.has(key)) {
      skipped.push(key);
      continue;
    }
    const ev = makeProductDimensionAttested({
      asOf: DIM_UPGRADE_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: DIM_UPGRADE_ACTOR,
      citations: [...DIM_BASE_CHAIN],
      payload: {
        productId: upgrade.productId,
        dimension: upgrade.dimension,
        result: "implementation-attested",
        citationChain: [...upgrade.citationChain],
      },
    });
    store.append(ev);
    upgraded.push(key);
  }

  return { upgraded, skipped };
}

// ---------------------------------------------------------------------------
// Governance-policy dimension upgrades (PR-J)
//
// Upgrades conduct, aml, infosec, and privacy for all 5 products.
// ---------------------------------------------------------------------------

const GOVERNANCE_DIM_AS_OF = "2026-05-27T06:30:00.000Z";
const GOVERNANCE_DIM_ACTOR = {
  type: "service" as const,
  id: "agent:atlas:npa-governance-dimension-upgrade",
};

const GOVERNANCE_CITATION_CHAINS = {
  conduct: [...DIM_BASE_CHAIN, "ORG-MK-01"],
  aml: [...DIM_BASE_CHAIN, "ORG-FC-02"],
  infosec: [...DIM_BASE_CHAIN, "ORG-CY-01"],
  privacy: [...DIM_BASE_CHAIN, "ORG-RM-01"],
} as const;

const GOVERNANCE_READY_UPGRADES: readonly DimUpgrade[] = (
  ["conduct", "aml", "infosec", "privacy"] as const
).flatMap((dim) =>
  [
    "prd:bank:equity:jse-equity-cash",
    "prd:bank:bond:sagb-fixed-coupon",
    "prd:bank:bond:open-repo-gmra",
    "prd:bank:ird:vanilla-zar-fix-zaronia",
    "prd:bank:fx:fx-swap-usdzar",
  ].map((productId) => ({
    productId,
    dimension: dim,
    citationChain: GOVERNANCE_CITATION_CHAINS[dim],
  })),
);

/**
 * Upgrades conduct, aml, infosec, and privacy to implementation-attested for
 * all 5 products. Policy + procedure substrate is in place for each dimension.
 * Idempotent: pairs already at implementation-attested are skipped.
 */
export function seedGovernanceDimensionUpgrades(store: EventStore): SubstrateReadyUpgradeResult {
  const upgraded: string[] = [];
  const skipped: string[] = [];

  const events = Array.from(store.replay());

  const alreadyUpgraded = new Set(
    events
      .filter(
        (ev) =>
          ev.type === "ProductDimensionAttested" &&
          (ev.payload as Record<string, unknown>).result === "implementation-attested",
      )
      .map(
        (ev) =>
          `${(ev.payload as Record<string, unknown>).productId}:${(ev.payload as Record<string, unknown>).dimension}`,
      ),
  );

  for (const upgrade of GOVERNANCE_READY_UPGRADES) {
    const key = `${upgrade.productId}:${upgrade.dimension}`;
    if (alreadyUpgraded.has(key)) {
      skipped.push(key);
      continue;
    }
    const ev = makeProductDimensionAttested({
      asOf: GOVERNANCE_DIM_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: GOVERNANCE_DIM_ACTOR,
      citations: [...DIM_BASE_CHAIN],
      payload: {
        productId: upgrade.productId,
        dimension: upgrade.dimension,
        result: "implementation-attested",
        citationChain: [...upgrade.citationChain],
      },
    });
    store.append(ev);
    upgraded.push(key);
  }

  return { upgraded, skipped };
}

// ---------------------------------------------------------------------------
// Remaining dimension upgrades (PR-K)
//
// Upgrades credit-risk, liquidity-risk, and operational-risk for all 5 products.
// Tax is explicitly deferred to revenue-start (Yael's mandate).
// ---------------------------------------------------------------------------

const REMAINING_DIM_AS_OF = "2026-05-27T07:00:00.000Z";
const REMAINING_DIM_ACTOR = {
  type: "service" as const,
  id: "agent:atlas:npa-remaining-dimension-upgrade",
};

const REMAINING_CITATION_CHAINS = {
  "credit-risk": [...DIM_BASE_CHAIN, "ORG-PR-09"],
  "liquidity-risk": [...DIM_BASE_CHAIN, "ORG-PR-01"],
  "operational-risk": [...DIM_BASE_CHAIN, "ORG-PR-17"],
} as const;

const REMAINING_UPGRADES: readonly DimUpgrade[] = (
  ["credit-risk", "liquidity-risk", "operational-risk"] as const
).flatMap((dim) =>
  [
    "prd:bank:equity:jse-equity-cash",
    "prd:bank:bond:sagb-fixed-coupon",
    "prd:bank:bond:open-repo-gmra",
    "prd:bank:ird:vanilla-zar-fix-zaronia",
    "prd:bank:fx:fx-swap-usdzar",
  ].map((productId) => ({
    productId,
    dimension: dim,
    citationChain: REMAINING_CITATION_CHAINS[dim],
  })),
);

/**
 * Upgrades credit-risk, liquidity-risk, and operational-risk to
 * implementation-attested for all 5 products. Idempotent: pairs already at
 * implementation-attested are skipped. Tax is excluded (deferred to revenue-start).
 */
export function seedRemainingDimensionUpgrades(store: EventStore): SubstrateReadyUpgradeResult {
  const upgraded: string[] = [];
  const skipped: string[] = [];

  const events = Array.from(store.replay());

  const alreadyUpgraded = new Set(
    events
      .filter(
        (ev) =>
          ev.type === "ProductDimensionAttested" &&
          (ev.payload as Record<string, unknown>).result === "implementation-attested",
      )
      .map(
        (ev) =>
          `${(ev.payload as Record<string, unknown>).productId}:${(ev.payload as Record<string, unknown>).dimension}`,
      ),
  );

  for (const upgrade of REMAINING_UPGRADES) {
    const key = `${upgrade.productId}:${upgrade.dimension}`;
    if (alreadyUpgraded.has(key)) {
      skipped.push(key);
      continue;
    }
    const ev = makeProductDimensionAttested({
      asOf: REMAINING_DIM_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: REMAINING_DIM_ACTOR,
      citations: [...DIM_BASE_CHAIN],
      payload: {
        productId: upgrade.productId,
        dimension: upgrade.dimension,
        result: "implementation-attested",
        citationChain: [...upgrade.citationChain],
      },
    });
    store.append(ev);
    upgraded.push(key);
  }

  return { upgraded, skipped };
}
