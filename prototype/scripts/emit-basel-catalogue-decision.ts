// prototype/scripts/emit-basel-catalogue-decision.ts
//
// Records the CEO decision authorising the Basel Pillar-1 catalogue programme.
// Marc approved the implementation plan in-session (2026-06-04); under the
// session-delegation protocol that approval is the CEO authorisation, recorded
// here as the canonical Decision event (Principle 1 — events are truth).
//
// Idempotent: skips if D-BASEL-CATALOGUE-PILLAR-1 is already recorded.
// Run once from prototype/: bun run scripts/emit-basel-catalogue-decision.ts
// Stays in the repo as an audit record.

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-BASEL-CATALOGUE-PILLAR-1";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const already = reg.byId.has(DECISION_ID);

if (already) {
  console.log(`${DECISION_ID} already recorded — skipping.`);
} else {
  const { eventId } = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Catalogue the Basel Framework as the prudential baseline; localise via typed adoption layer",
      category: "engineering",
      recommendation:
        "Catalogue the BCBS Pillar-1 spine (CAP/CRE/MAR/OPE/LCR/NSF/LEV/LEX) at provision granularity as the baseline framework layer; layer each jurisdiction's adoption over it as typed edges (ADOPTS/MODIFIES/GOLD_PLATES/SUPERSEDES; silence falls back to Basel); link every Basel-derived calibration constant back to its baseline provision; provide a point-in-time resolver. Curate the spine now; defer paragraph-granular LLM extraction and formal RegulatoryInstrumentRegistered emission to the credit-gated extraction pass.",
      rationale:
        "The bank is SARB-licensed but multi-jurisdiction by design (Principle 5); prudential rules are substantially BCBS-derived. Cataloguing Basel once as the baseline and modelling only national deltas makes adding further jurisdictions a delta-mapping exercise rather than a re-catalogue, and makes 'Basel baseline, superseded by local' structurally queryable and auditable. Provenance-layer depth keeps the live calc engines unchanged while making the adoption link load-bearing and recon-gated.",
      sourceDocHashes: [],
      citations: ["P2-SINGLE-GRAPH-DISCIPLINE", "P5-MULTI-CURRENCY-ENTITY-COUNTRY"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
