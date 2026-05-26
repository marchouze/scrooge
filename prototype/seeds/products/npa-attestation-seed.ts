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

  return { approved, skipped };
}

// Re-export definitions for use by test fixtures.
export { PRODUCTS as NPA_ATTESTATION_SEED_PRODUCTS, SEED_AS_OF as NPA_ATTESTATION_SEED_AS_OF };
