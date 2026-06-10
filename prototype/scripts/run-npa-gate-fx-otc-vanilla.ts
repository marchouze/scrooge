// scripts/run-npa-gate-fx-otc-vanilla.ts
//
// D-FX-OTC-NPA-SCOPE-EXPANSION — broaden the FX NPA from the narrow
// single-instrument single-pair `prd:bank:fx:fx-swap-usdzar` to an umbrella
// OTC vanilla FX product covering Spot, Forward and Swap on any currency pair,
// for all counterparty types, OTC only. FX Option is named in the target scope
// but NOT attested at v1.0 (joins at v1.1 once the M5 pricing substrate lands).
//
// Honest attestation: the umbrella spans instruments whose substrate is
// uneven (spot live; forward/swap on a static forward curve with flat-discount
// approximation and no forward-points accrual accounting; "any pair" exceeds
// the seven wired ZAR pairs; "all counterparty types" exceeds the onboarded
// set). Every dimension therefore attests at DESIGN level — the gate clears
// (no failed dimension) and the product is approved, but the implementation
// completion work is tracked in the Part-D roadmap and the `recon:npa-coverage`
// scanner. As each dimension's chain (obligation → policy → procedure →
// capability → UI) goes green, its attestation is upgraded to
// implementation-attested.
//
// On completion the narrow `prd:bank:fx:fx-swap-usdzar` is retired with a
// migration path onto the umbrella, so the register shows one canonical FX
// product.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-npa-gate-fx-otc-vanilla.ts
//
// Authority:
//   - D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { clock, eventStore } from "../platform/composition";
import { makeProductRetired } from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import type { ProductNpaDef } from "../platform/markets/products/npa-attestation-runner";
import { runNpaAttestation } from "../platform/markets/products/npa-attestation-runner";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T00:00:00.000Z";
const UMBRELLA_ID = "prd:bank:fx:otc-vanilla";
const NARROW_ID = "prd:bank:fx:fx-swap-usdzar";
const ENTITY = "LE-ZA-HOZ-BANK";
const DECISION_ID = "D-FX-OTC-NPA-SCOPE-EXPANSION";

const BASE_CHAIN = ["D-FX-OTC-NPA-SCOPE-EXPANSION", "D-NEW-PRODUCT-APPROVAL-POLICY"];

type DimMap = ProductNpaDef["dimensions"];

// ---------------------------------------------------------------------------
// Per-dimension honest assessments for the broadened scope. All design-attested
// at v1.0 — `notes` names the open item the Part-D roadmap closes to reach
// implementation-attested.
// ---------------------------------------------------------------------------

const dimensions: DimMap = {
  "market-risk": {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/market-risk-policy-v1.md", "ORG-MK-09"],
    notes:
      "Spot MTM live. Forward/swap revalue on a static forward curve (flat-discount approximation); multi-pair VaR not proven across all pairs. Upgrade once live OIS discounting + multi-pair VaR land.",
  },
  "credit-risk": {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/credit-risk-policy-v1.md", "PROC-RISK-CLM-01"],
    notes:
      "SA-CCR replacement-cost + PFE wired for FX. Not yet proven across all counterparty types (bank/corporate/PSE/fund). Upgrade once SA-CCR weighting validated per counterparty class.",
  },
  "liquidity-risk": {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/liquidity-risk-policy-v1.md"],
    notes:
      "Spot funding profile understood. Forward/swap settlement-ladder liquidity across any pair pending.",
  },
  "operational-risk": {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "PROC-OPS-SFBCP-01"],
    notes:
      "Booking/settlement controls live for spot. Forward/swap far-leg + NDF cash-settlement runbooks pending across the full pair set.",
  },
  "operational-readiness": {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "PROC-OPS-SFBCP-01"],
    notes:
      "Spot end-to-end live. Forward/swap booking present; per-currency nostro/receivable/payable accounts only for the seven wired pairs — 'any pair' needs suspense-free resolution generalised.",
  },
  accounting: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/accounting-policy-v1.md", "IAS-21", "IFRS-9"],
    notes:
      "Spot posting (PR-FX-001/002/PRIN/CLOSE) live. Missing: forward-points accrual (IAS 21 §28 time-value vs intrinsic) and swap far-leg posting rule. Upgrade once those SLA rules land.",
  },
  capital: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/capital-management-policy-v1.md", "BCBS-SA-CCR"],
    notes:
      "FX RWA folds spot. Forward/swap SA-CCR add-on + multi-pair capital across all counterparty types pending.",
  },
  conduct: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/conduct-of-business-tcf-policy-v1.md", "FAIS-GCC"],
    notes:
      "Institutional conduct controls in place. 'All counterparty types' may include less-sophisticated counterparties — FAIS appropriateness gate required before retail/lower-tier eligibility is exercised.",
  },
  aml: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "Policies/aml-cft-policy-v1.md"],
    notes: "Screening live at the gateway. EDD coverage across all counterparty types pending.",
  },
  "model-risk": {
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "Policies/model-risk-policy-v1.md",
      "BCBS-MODEL-RISK-PRINCIPLES",
    ],
    notes:
      "Spot uses live quoted rate (tier-1). Forward/swap valuation models (forward curve, discounting) require validation; option pricing (Garman-Kohlhagen / vol surface) is the M5 increment.",
  },
  legal: {
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "ISDA-2002-Master-Agreement",
      "Policies/counterparty-policy-v1.md",
    ],
    notes:
      "ISDA 2002 + SA Schedule for institutional. ISDA/CSA coverage across all counterparty classes pending.",
  },
  infosec: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "ORG-CY-01"],
    notes:
      "Threat-model reference held (ORG-CY-01); no instrument-specific delta for the broadened scope.",
  },
  privacy: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "POPIA-s19-22"],
    notes:
      "POPIA posture unchanged by instrument breadth; counterparty-data coverage scales with onboarding.",
  },
  tax: {
    result: "design-attested",
    citationChain: [...BASE_CHAIN, "STT-Act-25-of-2007", "VAT-Act-89-of-1991"],
    notes:
      "FX tax treatment understood for spot. STT/VAT review across all instruments + counterparty types pending.",
  },
};

const def: ProductNpaDef = {
  productId: UMBRELLA_ID,
  family: "fx",
  name: "OTC Vanilla FX (Spot, Forward, Swap; Option at M5)",
  version: "1.0.0",
  proposedBy: "agent:saskia:head-global-markets",
  scope: {
    executionVenue: "otc",
    fxInstrumentVariants: ["spot", "forward", "swap"],
    currencyPairs: "any",
    counterpartyEligibility: "all",
  },
  dimensions,
};

// ---------------------------------------------------------------------------
// 1. Record the CEO-delegated decision (session-delegation block).
// ---------------------------------------------------------------------------

recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Broaden FX NPA to umbrella OTC vanilla FX product (Spot/Forward/Swap; Option at M5)",
    category: "product",
    recommendation:
      "Approve one umbrella OTC vanilla FX product (prd:bank:fx:otc-vanilla) covering Spot/Forward/Swap on any currency pair, all counterparty types, OTC only, with typed scope fields; supersede the narrow prd:bank:fx:fx-swap-usdzar. Option declared in target scope, attested at v1.1 once the M5 pricing substrate lands. Attestation is design-level at v1.0; implementation completion tracked in the Part-D roadmap and recon:npa-coverage.",
    rationale:
      "FX NPA must cover the full OTC FX instrument set on any pair for all counterparty types, not a single instrument/pair. Typed scope fields make the coverage queryable (Principle 2). Honest design-level attestation reflects the uneven substrate (spot live; forward/swap on static curve; option not built).",
    citations: BASE_CHAIN,
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

// ---------------------------------------------------------------------------
// 2. Run the umbrella NPA attestation (idempotent).
// ---------------------------------------------------------------------------

const result = runNpaAttestation(eventStore, def, AS_OF);
logger.info(
  { productId: def.productId, outcome: result.outcome, eventsEmitted: result.eventsEmitted.length },
  `Umbrella FX NPA attestation: ${result.outcome}`,
);

// ---------------------------------------------------------------------------
// 3. Supersede the narrow FX swap product (idempotent — skip if already retired).
// ---------------------------------------------------------------------------

let narrowAlreadyRetired = false;
for (const ev of eventStore.replay({ type: "ProductRetired" })) {
  const p = ev.payload as { productId?: string };
  if (p.productId === NARROW_ID) {
    narrowAlreadyRetired = true;
    break;
  }
}

if (!narrowAlreadyRetired) {
  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-retire:${NARROW_ID}`,
    tags: ["npa-gate", "product-retire", NARROW_ID],
  });
  const retired = {
    ...makeProductRetired({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:atlas:npa-attestation-runner" },
      citations: BASE_CHAIN,
      payload: {
        productId: NARROW_ID,
        reason:
          "Superseded by the umbrella OTC vanilla FX product (prd:bank:fx:otc-vanilla) per D-FX-OTC-NPA-SCOPE-EXPANSION. The narrow single-instrument single-pair product is folded into the umbrella scope (instrument variant = swap, pair = USD/ZAR).",
        migrationPath: UMBRELLA_ID,
      },
    }),
    provenance,
  };
  eventStore.append(retired);
  logger.info({ productId: NARROW_ID, successor: UMBRELLA_ID }, "Retired narrow FX swap product");
} else {
  logger.info({ productId: NARROW_ID }, "Narrow FX swap product already retired — skipped");
}

logger.info({ at: clock.now() }, "run-npa-gate-fx-otc-vanilla complete");
process.exit(0);
