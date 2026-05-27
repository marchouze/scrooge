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

  return { approved, skipped };
}

// Re-export definitions for use by test fixtures.
export { PRODUCTS as NPA_ATTESTATION_SEED_PRODUCTS, SEED_AS_OF as NPA_ATTESTATION_SEED_AS_OF };
