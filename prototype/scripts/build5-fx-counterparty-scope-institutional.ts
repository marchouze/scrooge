// scripts/build5-fx-counterparty-scope-institutional.ts
//
// "Counterparty types" workstream (D-FX-OTC-NPA-SCOPE-EXPANSION roadmap §3) —
// resolves the franchiseScope-vs-counterpartyEligibility contradiction on the
// umbrella product (CEO-ratified this session: institutional/professional only).
//
// The umbrella fixture declared `franchiseScope: "institutional"` but
// `scope.counterpartyEligibility: "all"` (and the v1.0.0 ProductApproved
// event-of-record carried "all"). CEO decision: the FX OTC product serves
// institutional/professional counterparty classes ONLY (bank / corporate / PSE /
// fund / sovereign); retail/non-professional are OUT of scope. This matches the
// institutional franchise and means NO FAIS retail-appropriateness regime applies
// (the conduct "retail FAIS gate" residual dissolves).
//
// Corrects the event-of-record: a material scope change → ProductVersionPublished
// (1.0.0 → 1.0.1) + a fresh ProductApproved v1.0.1 carrying the corrected scope
// (counterpartyEligibility: "institutional"). The fixture is updated in lockstep
// (fixtures.ts). Per-dimension attestation of credit-risk/legal/conduct under the
// institutional scope is a follow-up end-to-end verification; the one genuine
// engineering residual (SA-CCR per-class supervisory weighting — capital) is
// tracked as CRO backlog, not improvised here.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/build5-fx-counterparty-scope-institutional.ts
//
// Authority: D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL (CEO session-delegation 2026-06-10);
//            D-FX-OTC-NPA-SCOPE-EXPANSION; FAIS s.45 (professional client classification).
// Author: Scrooge-coordinated session for marc@tgv.co.za · Saskia (Head of Global Markets, governance).

import { clock, eventStore } from "../platform/composition";
import {
  type ProductScopeForEvent,
  makeProductApproved,
  makeProductVersionPublished,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const OLD_VERSION = "1.0.0";
const NEW_VERSION = "1.0.1";
const AS_OF = "2026-06-11T08:00:00.000Z";
const DECISION_ID = "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL";

const CORRECTED_SCOPE: ProductScopeForEvent = {
  executionVenue: "otc",
  fxInstrumentVariants: ["spot", "forward", "swap"],
  currencyPairs: "any",
  counterpartyEligibility: "institutional",
};

recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "FX OTC umbrella serves institutional/professional counterparties only (retail out of scope)",
    category: "product",
    recommendation:
      "Resolve the franchiseScope(institutional)-vs-counterpartyEligibility('all') contradiction toward institutional. The umbrella prd:bank:fx:otc-vanilla serves institutional/professional counterparty classes only (bank/corporate/PSE/fund/sovereign); retail/non-professional are OUT of scope. No FAIS retail-appropriateness/TCF-retail regime applies (the existing institutional-eligibility screening governs, per FAIS s.45 professional classification). Correct the scope of record to counterpartyEligibility:'institutional' (version 1.0.1).",
    rationale:
      "Matches the institutional franchise foundation. Retail OTC FX would open a major FAIS appropriateness + TCF + retail-onboarding programme that is not the bank's intent. Credit-risk per-class RWA weights already exist; the residual engineering item is SA-CCR per-class supervisory weighting (capital), tracked as CRO backlog.",
    citations: [DECISION_ID, "D-FX-OTC-NPA-SCOPE-EXPANSION", "FAIS-s45"],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-scope-correction:${PRODUCT_ID}`,
  tags: ["npa-gate", "scope-correction", "counterparty", PRODUCT_ID],
});

// Material scope change → version bump.
eventStore.append({
  ...makeProductVersionPublished({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:saskia:head-global-markets" },
    citations: [DECISION_ID, "D-FX-OTC-NPA-SCOPE-EXPANSION"],
    payload: {
      productId: PRODUCT_ID,
      oldVersion: OLD_VERSION,
      newVersion: NEW_VERSION,
      materialChanges: [
        "counterpartyEligibility corrected 'all' → 'institutional' (retail/non-professional out of scope) per D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL — resolves the franchiseScope contradiction",
      ],
    },
  }),
  provenance,
});

// Re-approve at v1.0.1 carrying the corrected scope of record.
eventStore.append({
  ...makeProductApproved({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:saskia:head-global-markets" },
    citations: [DECISION_ID, "D-FX-OTC-NPA-SCOPE-EXPANSION"],
    payload: {
      productId: PRODUCT_ID,
      version: NEW_VERSION,
      conditions: [],
      approvedBy: "agent:saskia:head-global-markets",
      scope: CORRECTED_SCOPE,
    },
  }),
  provenance,
});

logger.info(
  {
    decision: DECISION_ID,
    productId: PRODUCT_ID,
    version: NEW_VERSION,
    counterpartyEligibility: CORRECTED_SCOPE.counterpartyEligibility,
    at: clock.now(),
  },
  "build-5 (counterparty types): scope corrected to institutional (v1.0.1); retail out of scope; FAIS-retail residual dissolved; SA-CCR per-class weighting tracked as CRO backlog",
);
process.exit(0);
