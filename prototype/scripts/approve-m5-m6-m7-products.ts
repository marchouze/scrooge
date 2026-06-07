// scripts/approve-m5-m6-m7-products.ts
//
// M5–M7 NPA gate walks — PROC-NPA-GATE-01 for treasury products.
//
// Runs the NPA gate for 3 treasury products via `runNpaAttestation`. Idempotent.
//
// Products:
//   prd:bank:treasury:repo-sagb-term  — M5 SAGB-backed term repo
//   prd:bank:treasury:mmd-deposit     — M6 Money Market Deposit
//   prd:bank:treasury:funding-line    — M7 Committed Funding Line
//
// Authority:
//   - D-AGENT-RUNTIME-AUTHORIZE (CEO-approved)
//   - brief:saskia:m5-m7-npa-gate-walks-productapproved-events:2026-05-28
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Reference: `scripts/run-npa-attestation-m2-m4.ts` for the NPA attestation pattern.
//
// Author: Saskia (Head of Global Markets, markets)

import { eventStore } from "../platform/composition";
import type { ProductNpaDef } from "../platform/markets/products/npa-attestation-runner";
import { runNpaAttestation } from "../platform/markets/products/npa-attestation-runner";
import { logger } from "../platform/observability/logger";

const AS_OF = "2026-05-28T00:00:00.000Z";

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

const BASE_CITATIONS = [
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "brief:saskia:m5-m7-npa-gate-walks-productapproved-events:2026-05-28",
];

// ---------------------------------------------------------------------------
// Product definitions
// ---------------------------------------------------------------------------

// Note: M6 and M7 use family "money-market" which is outside the standard
// NpaProductFamily enum (designed for capital-markets products). Treasury
// products enter the NPA gate under "repo" family for runner compatibility;
// the product ID URN is the canonical identifier.

const PRODUCTS: ProductNpaDef[] = [
  // ─── M5: SAGB-backed Term Repo ──────────────────────────────────────────
  {
    productId: "prd:bank:treasury:repo-sagb-term",
    // "repo" is a supported NpaProductFamily value
    family: "repo",
    name: "SAGB-backed Term Repo (M5)",
    version: "1.0.0",
    proposedBy: "agent:saskia:npa-gate-walk",
    dimensions: {
      ...allDesignAttested(BASE_CITATIONS),
      // liquidity: implementation-attested — HQLA-eligible L1 collateral; LCR inflow modelled
      "liquidity-risk": {
        result: "implementation-attested",
        citationChain: [...BASE_CITATIONS, "WS1-PR1a"],
        notes:
          "SAGB collateral is HQLA-eligible L1. Repo cash leg modelled as LCR inflow (BA 110). Funding profile: repo-funded.",
      },
      // accounting: implementation-attested — IFRS 9 §3.2.3 collateral on-balance-sheet; amortised cost
      accounting: {
        result: "implementation-attested",
        citationChain: [...BASE_CITATIONS, "WS1-PR1a"],
        notes:
          "IFRS 9 §3.2.3–3.2.4: collateral not derecognised (no substantive transfer of risks/rewards). Cash leg recognised as secured borrowing at amortised cost. BA600.line.repo-borrowing + BA110.line.hqla-collateral.",
      },
    },
  },

  // ─── M6: Money Market Deposit ─────────────────────────────────────────────
  {
    productId: "prd:bank:treasury:mmd-deposit",
    // Treasury deposits enter NPA gate under "repo" family as closest
    // capital-markets analogue; URN is canonical product identifier.
    family: "repo" as ProductNpaDef["family"],
    name: "Money Market Deposit (M6)",
    version: "1.0.0",
    proposedBy: "agent:saskia:npa-gate-walk",
    dimensions: {
      ...allDesignAttested(BASE_CITATIONS),
      // accounting: implementation-attested — IFRS 9 §4.2.1 liability at amortised cost
      accounting: {
        result: "implementation-attested",
        citationChain: [...BASE_CITATIONS, "WS1-PR1a"],
        notes:
          "Financial liability at amortised cost (IFRS 9 §4.2.1). LCR outflow modelling: BA 110 institutional depositor bucket. BA600.line.deposits + BA110.line.lcr-outflow-institutional.",
      },
      // liquidity: implementation-attested — LCR outflow bucket wired in BA 110
      "liquidity-risk": {
        result: "implementation-attested",
        citationChain: [...BASE_CITATIONS, "WS1-PR1a"],
        notes:
          "Contributes to LCR outflow modelling (BA 110) and NSFR required stable funding (BA 120). Settlement path: SAMOS via correspondent T+0.",
      },
    },
  },

  // ─── M7: Committed Funding Line ───────────────────────────────────────────
  {
    productId: "prd:bank:treasury:funding-line",
    // As with M6, enters NPA gate under "repo" family; URN is canonical.
    family: "repo" as ProductNpaDef["family"],
    name: "Committed Funding Line (M7)",
    version: "1.0.0",
    proposedBy: "agent:saskia:npa-gate-walk",
    dimensions: {
      ...allDesignAttested(BASE_CITATIONS),
      // accounting: implementation-attested — IFRS 9 §4.2.1 liability on drawdown
      accounting: {
        result: "implementation-attested",
        citationChain: [...BASE_CITATIONS, "WS1-PR1a"],
        notes:
          "Financial liability recognised at amortised cost on drawdown (IFRS 9 §4.2.1). 100% LCR outflow (BA 110 Table 2). BA600.line.funding-lines + BA110.line.lcr-outflow-100pct.",
      },
      // liquidity: implementation-attested — 100% LCR outflow; NSFR required stable funding
      "liquidity-risk": {
        result: "implementation-attested",
        citationChain: [...BASE_CITATIONS, "WS1-PR1a"],
        notes:
          "100% LCR outflow (BA 110 Table 2) and required stable funding under NSFR (BA 120). Contingency liquidity management instrument. Settlement: SAMOS via correspondent T+0.",
      },
    },
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
