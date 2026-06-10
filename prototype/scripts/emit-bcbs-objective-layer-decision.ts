// prototype/scripts/emit-bcbs-objective-layer-decision.ts
//
// Records the CEO decision to give the BCBS its objective layer — wiring the
// Basel Committee's mandate and objectives over the ~1,927 already-ingested BCBS
// obligation nodes. Marc approved in-session ("continue", 2026-06-10); under the
// session-delegation protocol that approval is the CEO authorisation.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-bcbs-objective-layer-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-BCBS-OBJECTIVE-LAYER-INGESTION";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
if (reg.byId.has(DECISION_ID)) {
  console.log(`${DECISION_ID} already recorded — skipping.`);
} else {
  const { eventId } = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "BCBS objective layer: wire Basel mandate + objectives over the existing 1,927 BCBS obligations",
      category: "engineering",
      recommendation:
        "Give the Basel Committee on Banking Supervision (REG-BCBS) its objective layer — the regulator already has ~1,927 obligation nodes from the 16 ingested standards but no objectives. Author a BCBS objective artefact: OBJ-BCBS-MANDATE (BCBS Charter — strengthen the regulation, supervision and practices of banks worldwide, enhancing financial stability) decomposing into capital-adequacy, liquidity-resilience, risk-capture, market-discipline (Pillar 3) and supervisory-review (Pillar 2) objectives; PURSUES from REG-BCBS; SERVES from the existing BCBS obligations mapped by Basel standard family (CAP/RBC -> capital-adequacy; LCR/NSF -> liquidity-resilience; CRE/MAR/OPE/MGN -> risk-capture; DIS -> market-discipline; SCO/BCP/LEX/LEV -> supervisory-review); ALIGNS_TO from the SA prudential policies (capital-management, liquidity-risk) that implement the SA transpositions. SERVES are generated programmatically by standard-prefix so all BCBS obligations gain a traceable purpose, making requirement-objective-linkage meaningful for the largest obligation set in the graph. NCR is explicitly deferred (the wholesale bank has ~1 consumer-credit obligation, near-zero ingestion value).",
      rationale:
        "BCBS is the most load-bearing regulator for a wholesale bank and holds the richest obligation set in the graph (1,927 nodes across CAP/CRE/LCR/MAR/OPE/LEV/LEX/NSF/etc.), yet it is the one regulator with deep obligations and no objective layer. Wiring Basel's mandate and objectives over those obligations completes the mandate -> objective -> requirement -> policy traceability for the prudential core, and lets the objective-coverage recon gates reason about the bulk of the graph rather than only the three SA regulators done so far (PA, FSCA, FIC).",
      sourceDocHashes: [],
      citations: [
        "D-FIC-REGULATORY-INTELLIGENCE-INGESTION",
        "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
        "D-BASEL-CATALOGUE-PILLAR-1",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
