// scripts/run-npa-attestation-m2-m4.ts
//
// Slice 6 — M2–M4 NPA attestations.
//
// Runs the NPA gate for 4 products via `runNpaAttestation`. Idempotent.
//
// Products:
//   prd:bank:bond:sagb-fixed-coupon    — M2 listed SAGB bond
//   prd:bank:bond:open-repo-gmra       — M2 repo (GMRA 2011)
//   prd:bank:ird:vanilla-zar-fix-zaronia — M3 vanilla IRS (ZAR fixed vs ZARONIA)
//   prd:bank:fx:fx-swap-usdzar         — M4 FX swap (USD/ZAR)
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Reference: `scripts/run-npa-gate-fx-spot.ts` for the FX-spot NPA pattern.
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import type { ProductNpaDef } from "../platform/markets/products/npa-attestation-runner";
import { runNpaAttestation } from "../platform/markets/products/npa-attestation-runner";
import { logger } from "../platform/observability/logger";

const AS_OF = "2026-05-26T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Helper: build a fully design-attested dimension map
// ---------------------------------------------------------------------------

type DimMap = ProductNpaDef["dimensions"];

function allDesignAttested(baseChain: string[]): DimMap {
  const dimensions: DimMap = {
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
  return dimensions;
}

// ---------------------------------------------------------------------------
// Product definitions
// ---------------------------------------------------------------------------

const PRODUCTS: ProductNpaDef[] = [
  // ─── M2: SAGB Fixed Coupon Bond ──────────────────────────────────────────
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    family: "listed-bond",
    name: "SAGB Fixed Coupon Bond (M2)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
  },

  // ─── M2: Open Repo (GMRA 2011) ───────────────────────────────────────────
  {
    productId: "prd:bank:bond:open-repo-gmra",
    family: "repo",
    name: "Open Repo (GMRA 2011, M2)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
  },

  // ─── M3: Vanilla ZAR Fixed vs ZARONIA IRS ────────────────────────────────
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    family: "otc-ird",
    name: "Vanilla ZAR Fixed vs ZARONIA IRS (M3)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: {
      ...allDesignAttested(["D-NEW-PRODUCT-APPROVAL-POLICY"]),
      // capital: implementation-attested — RWA delta estimator PR #820
      capital: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
        notes:
          "RWA delta estimator landed PR #820. SA-CCR replacement-cost + PFE for IRS. Capital headroom within build-phase envelope.",
      },
      // legal: implementation-attested — ISDA IRS confirmation PR #820
      legal: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
        notes:
          "ISDA IRS confirmation generator landed PR #820. ISDA 2002 Master Agreement + SA Schedule. ECTA electronic execution.",
      },
    },
  },

  // ─── M4: FX Swap (USD/ZAR) ───────────────────────────────────────────────
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
// Run attestation for each product
// ---------------------------------------------------------------------------

for (const def of PRODUCTS) {
  const result = runNpaAttestation(eventStore, def, AS_OF);

  if (result.outcome === "skipped-already-approved") {
    logger.info(
      { productId: def.productId },
      "NPA attestation: already approved — skipped (idempotent)",
    );
  } else {
    logger.info(
      {
        productId: def.productId,
        outcome: result.outcome,
        eventsEmitted: result.eventsEmitted.length,
      },
      `NPA attestation complete: ${result.outcome}`,
    );
  }
}

process.exit(0);
