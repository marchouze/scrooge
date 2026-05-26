// scripts/run-npa-attestation-equity.ts
//
// Slice 5 — M1 equity NPA attestation.
//
// Runs the NPA gate for `prd:bank:equity:jse-equity-cash` (M1 listed equity,
// JSE cash equities) via `runNpaAttestation`. Idempotent.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Citations:
//   - ORG-MK-09: Market risk framework for listed equities
//   - D-NEW-PRODUCT-APPROVAL-POLICY: NPA policy
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE: Product substrate
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { runNpaAttestation } from "../platform/markets/products/npa-attestation-runner";
import { logger } from "../platform/observability/logger";

const PRODUCT_ID = "prd:bank:equity:jse-equity-cash";
const AS_OF = "2026-05-26T00:00:00.000Z";

const result = runNpaAttestation(
  eventStore,
  {
    productId: PRODUCT_ID,
    family: "listed-equity",
    name: "JSE Listed Cash Equity (M1)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: {
      "market-risk": {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "ORG-MK-09"],
        notes:
          "FRTB-SA sensitivity engine wired for listed equities; delta/vega/curvature computed at EOD. ORG-MK-09 limit framework active.",
      },
      "credit-risk": {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "Settlement risk only (Strate T+3 DVP). No ongoing bilateral exposure. SA-CCR not applicable for listed equities.",
      },
      "liquidity-risk": {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "Listed JSE equities classified as Level 2B HQLA. LCR/NSFR impact at design level; implementation follows M1-exit.",
      },
      "operational-risk": {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "Strate settlement failure procedures defined at design level. T+3 fail-buy framework documented.",
      },
      "operational-readiness": {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
        notes:
          "JSE equity booking substrate live (PR #822). Trade booking UI operational. Settlement T+3 path wired.",
      },
      accounting: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "ORG-MK-09"],
        notes:
          "IFRS 9 FVTPL classification wired. IFRS 13 Level 1 (exchange-quoted price). IAS 21 monetary item. GL posting rules live.",
      },
      capital: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
        notes:
          "RWA delta estimator landed PR #820. FRTB-SA equity risk weight applied. Capital headroom within pre-licence build-phase envelope.",
      },
      conduct: {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "FAIS treatment: category I FSP activities (acting as principal). Conduct Standard 3 of 2018 applicable. Pre-trade conduct gate designed.",
      },
      aml: {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "CDD pathway via Niko client lifecycle (licence-day activation). Institutional-only counterparty model limits retail AML exposure.",
      },
      "model-risk": {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "Nadia substrate gap: independent model validation not yet active. Compensating control: no mark-to-model for listed equity (exchange-quoted prices only, IFRS 13 Level 1). No proprietary pricing model risk.",
      },
      legal: {
        result: "implementation-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
        notes:
          "ISDA IRS confirmation generator landed PR #820. Equity trading: JSE member agreement in place. ECTA electronic execution path active.",
      },
      infosec: {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "Threat model at design level. PA/FSCA Joint Standard 2 of 2024 security controls mapped. HSM custody deferred to M8 cloud lift.",
      },
      privacy: {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "POPIA s.19-22 controls mapped at design level. Institutional-only model: no natural-person client data in scope for equity trading.",
      },
      tax: {
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        notes:
          "STT applicable: 0.25% on equity purchases per STT Act 25 of 2007. CIT on trading P&L at entity level. VAT exempt (financial service). Yael tax position documented.",
      },
    },
  },
  AS_OF,
);

if (result.outcome === "skipped-already-approved") {
  logger.info(
    { productId: PRODUCT_ID },
    "NPA attestation: already approved — skipped (idempotent)",
  );
} else {
  logger.info(
    {
      productId: PRODUCT_ID,
      outcome: result.outcome,
      eventsEmitted: result.eventsEmitted.length,
    },
    `NPA attestation complete: ${result.outcome}`,
  );
}

process.exit(0);
