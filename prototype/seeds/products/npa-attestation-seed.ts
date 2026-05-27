// seeds/products/npa-attestation-seed.ts
//
// Consolidated NPA attestation seed — calls `runNpaAttestation` for all 5
// M1–M4 products in sequence. This is the canonical CI seed path.
//
// Products seeded (in order):
//   1. prd:bank:equity:jse-equity-cash        — M1 listed equity (JSE cash)
//   2. prd:bank:bond:sagb-fixed-coupon        — M2 listed bond (SAGB fixed coupon)
//   3. prd:bank:bond:open-repo-gmra           — M2 repo (GMRA 2011)
//   4. prd:bank:ird:vanilla-zar-fix-zaronia   — M3 OTC IRS (ZAR fixed vs ZARONIA)
//   5. prd:bank:fx:fx-swap-usdzar             — M4 FX swap (USD/ZAR)
//
// Treasury products (REPO-ZAR-001, MMD-ZAR-001, IBL-FT-ZAR-001,
// IBL-CALL-ZAR-001, prd:bank:fx:fx-spot-usdzar) are NOT duplicated here;
// they are seeded by `seeds/treasury/npa-approvals-seed.ts` and
// `scripts/run-npa-gate-fx-spot.ts` respectively.
//
// This seed must run BEFORE trade seeds that reference M1–M4 products.
//
// Idempotent: each call to runNpaAttestation skips products that already
// have a ProductApproved event in the store.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import { makeProductDimensionAttested } from "../../platform/event-store/event-types/product";
import type { EventStore } from "../../platform/event-store/store";
import type { ProductNpaDef } from "../../platform/markets/products/npa-attestation-runner";
import { runNpaAttestation } from "../../platform/markets/products/npa-attestation-runner";

// ---------------------------------------------------------------------------
// Seed timestamp
// ---------------------------------------------------------------------------

const SEED_AS_OF = "2026-05-26T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Helper: build a fully design-attested dimension map
// ---------------------------------------------------------------------------

type DimMap = ProductNpaDef["dimensions"];

function allDesignAttested(baseChain: string[]): DimMap {
  return {
    "market-risk": { result: "design-attested", citationChain: baseChain },
    "credit-risk": { result: "design-attested", citationChain: baseChain },
    "liquidity-risk": { result: "design-attested", citationChain: baseChain },
    "operational-risk": { result: "design-attested", citationChain: baseChain },
    "operational-readiness": { result: "design-attested", citationChain: baseChain },
    accounting: { result: "design-attested", citationChain: baseChain },
    capital: { result: "design-attested", citationChain: baseChain },
    conduct: { result: "design-attested", citationChain: baseChain },
    aml: { result: "design-attested", citationChain: baseChain },
    "model-risk": { result: "design-attested", citationChain: baseChain },
    legal: { result: "design-attested", citationChain: baseChain },
    infosec: { result: "design-attested", citationChain: baseChain },
    privacy: { result: "design-attested", citationChain: baseChain },
    tax: { result: "design-attested", citationChain: baseChain },
  };
}

// ---------------------------------------------------------------------------
// All 5 M1–M4 product definitions
// ---------------------------------------------------------------------------

const PRODUCTS: ProductNpaDef[] = [
  // ─── 1. M1: JSE Listed Cash Equity ────────────────────────────────────────
  {
    productId: "prd:bank:equity:jse-equity-cash",
    family: "listed-equity",
    name: "JSE Listed Cash Equity (M1)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: {
      ...allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
      "market-risk": {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "ORG-MK-09"],
      },
      "operational-readiness": {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
      },
      accounting: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "ORG-MK-09"],
      },
      capital: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
      },
      legal: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
      },
    },
  },

  // ─── 2. M2: SAGB Fixed Coupon Bond ────────────────────────────────────────
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    family: "listed-bond",
    name: "SAGB Fixed Coupon Bond (M2)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
  },

  // ─── 3. M2: Open Repo (GMRA 2011) ─────────────────────────────────────────
  {
    productId: "prd:bank:bond:open-repo-gmra",
    family: "repo",
    name: "Open Repo (GMRA 2011, M2)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
  },

  // ─── 4. M3: Vanilla ZAR Fixed vs ZARONIA IRS ──────────────────────────────
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    family: "otc-ird",
    name: "Vanilla ZAR Fixed vs ZARONIA IRS (M3)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: {
      ...allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
      capital: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
      },
      legal: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
      },
    },
  },

  // ─── 5. M4: FX Swap (USD/ZAR) ─────────────────────────────────────────────
  {
    productId: "prd:bank:fx:fx-swap-usdzar",
    family: "fx",
    name: "FX Swap (USD/ZAR, M4)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
  },
];

// ---------------------------------------------------------------------------
// Seed runner — called by the boot sequence
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Slice 7 — model-risk upgrade: no-model products
// ---------------------------------------------------------------------------

// Products whose model-risk can be upgraded to implementation-attested
// because no pricing model is used (SR 11-7 model definition not met).
// Products whose model-risk upgrade requires a ModelValidationApproved event
// for the product's primary pricing model. Blocked products are retried on
// every server boot — once Nadia's validation events land in the store the
// upgrade fires automatically.
const WITH_MODEL_PRODUCTS: ReadonlyArray<{
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

const NO_MODEL_PRODUCTS: ReadonlyArray<{ productId: string; notes: string }> = [
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

  // Single scan — check all no-model products in one pass.
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
 * upgraded on the next server boot after Nadia's validation events land.
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
// Upgrades specific (productId, dimension) pairs from design-attested →
// implementation-attested for the four non-equity products where the
// required substrate now exists:
//
//   market-risk:          BESA/JSE quoted prices + BA 325 monitoring (bond,
//                         repo); validated ZARONIA OIS + IRS-PV (IRS);
//                         validated FX IRP + B3 NOP monitoring (FX swap).
//   operational-readiness: trade booking live (PR #822) + ISDA confirm
//                         generator (PR #820) + settlement scheduling.
//   accounting:           IFRS 9 GL posting engine (Bea) + EIR + net-
//                         settlement + MTM mark-to-model entries.
//   capital:              SAGB → 0% SA risk weight (BA 200 standardised);
//                         repo → standard Basel III haircut table;
//                         FX swap → SA-CCR standardised formula.
//   legal:                Bond → BESA market rules (standard terms);
//                         repo → GMRA 2011 executed;
//                         FX swap → ISDA 2002 + FX supplement.
//
// IRS capital + legal: already implementation-attested (PR #824).
// ---------------------------------------------------------------------------

interface DimUpgrade {
  readonly productId: string;
  readonly dimension: string;
  readonly citationChain: readonly string[];
}

const DIM_UPGRADE_AS_OF = "2026-05-27T06:00:00.000Z";
const DIM_UPGRADE_ACTOR = { type: "service" as const, id: "agent:atlas:npa-dimension-upgrade" };
const DIM_BASE_CHAIN = [
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
] as const;

const SUBSTRATE_READY_UPGRADES: readonly DimUpgrade[] = [
  // ── Bond (prd:bank:bond:sagb-fixed-coupon) ─────────────────────────────
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

  // ── Repo (prd:bank:bond:open-repo-gmra) ────────────────────────────────
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

  // ── IRS (prd:bank:ird:vanilla-zar-fix-zaronia) — capital+legal already ✓
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

  // ── FX swap (prd:bank:fx:fx-swap-usdzar) ───────────────────────────────
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

export interface SubstrateReadyUpgradeResult {
  readonly upgraded: string[]; // "productId:dimension"
  readonly skipped: string[];
}

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

  // Build a Set of "productId:dimension" pairs already at implementation-attested.
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
// Upgrades conduct, aml, infosec, and privacy for all 5 products where the
// required policy + procedure substrate is in place:
//
//   conduct:   trading-mandate-v1 (ORG-MK-01 market conduct); insider-
//              trading-pa-dealing-policy (ORG-MK-05); market-abuse controls.
//   aml:       aml-cft-policy-v1; FIC Act obligations (ORG-FC-02/03/04);
//              Mira sanctions-screening + transaction-monitoring live.
//   infosec:   secure-sdlc-policy-v1; PA/FSCA JS-2/2024 (ORG-CY-01/12/13);
//              SIEM + threat-model gate + SBOM substrate.
//   privacy:   popia-privacy-policy-v1; Information Officer appointed;
//              POPIA ss.19–22 data-processing controls in place.
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE + D-NEW-PRODUCT-APPROVAL-POLICY
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

export interface NpaAttestationSeedResult {
  approved: string[];
  skipped: string[];
}

/**
 * Run NPA attestation for all 5 M1–M4 products against the provided store.
 *
 * Idempotent — products with an existing ProductApproved event are skipped.
 * Must be called BEFORE trade seeds that reference M1–M4 products.
 */
export function seedNpaAttestations(store: EventStore): NpaAttestationSeedResult {
  const approved: string[] = [];
  const skipped: string[] = [];

  for (const def of PRODUCTS) {
    const result = runNpaAttestation(store, def, SEED_AS_OF);
    if (result.outcome === "skipped-already-approved") {
      skipped.push(def.productId);
    } else {
      approved.push(def.productId);
    }
  }

  // Slice 7: upgrade model-risk for no-model products (equity, repo).
  seedModelRiskUpgrades(store);

  // Slice 7: upgrade model-risk for model-using products (bond, IRS, FX) once
  // ModelValidationApproved events are present. Blocked products are retried
  // on every boot; no-op if validations have not yet landed.
  seedValidatedModelRiskUpgrades(store);

  // PR-I: upgrade substrate-ready dimensions (market-risk, operational-readiness,
  // accounting, capital, legal) for bond, repo, IRS, FX where the required
  // substrate exists in the codebase.
  seedSubstrateReadyDimensionUpgrades(store);

  // PR-J: upgrade governance-policy dimensions (conduct, aml, infosec, privacy)
  // for all 5 products where policy + procedure substrate is in place.
  seedGovernanceDimensionUpgrades(store);

  return { approved, skipped };
}

// Re-export definitions for use by test fixtures.
export { PRODUCTS as NPA_ATTESTATION_SEED_PRODUCTS, SEED_AS_OF as NPA_ATTESTATION_SEED_AS_OF };
