// prototype/scripts/emit-bcbs-239-rdarr-ingestion-decision.ts
//
// Records the CEO decision to ingest BCBS 239 (Principles for effective risk data
// aggregation and risk reporting) — closing the catalogue gap surfaced by the IASB
// work (ORG-AC-15 cites BCBS 239 but no node existed). Marc approved in-session
// ("do bcbs239", 2026-06-10); session-delegation protocol.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-bcbs-239-rdarr-ingestion-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-BCBS-239-RDARR-INGESTION";

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
        "Ingest BCBS 239 (RDARR) + its SA transposition (PA Directive D2/2015), closing the catalogue gap",
      category: "engineering",
      recommendation:
        "Close the BCBS 239 catalogue gap surfaced by the IASB ingestion (ORG-AC-15 cites BCBS 239 but no node existed). (a) Model BCBS 239 (Principles for effective risk data aggregation and risk reporting) as a Document under REG-BCBS with its 14 principles as Provisions (P1 governance, P2 data architecture/IT, P3 accuracy/integrity, P4 completeness, P5 timeliness, P6 adaptability, P7 reporting accuracy, P8 comprehensiveness, P9 clarity/usefulness, P10 frequency, P11 distribution, P12 supervisory review, P13 remedial actions, P14 cooperation), create the principle-level obligation nodes, and SERVES them to the BCBS objectives (governance + supervisory principles P1/P12-P14 -> supervisory-review; data-aggregation + reporting principles P2-P11 -> risk-capture). Bridge ORG-AC-15 (cites BCBS 239 directly) to the BCBS 239 provisions via EXPRESSES, closing its unbridged status. (b) Model SARB PA Directive D2/2015 as a Document under REG-SARB-PA that TRANSPOSES BCBS 239, and bridge ORG-RM-RDARR-001..008 (which cite D2/2015) to it — demonstrating the cross-jurisdiction transposition chain (international standard -> SA transposition -> bank obligation). Mira (Compliance / RegTech Engineer) builds; Helena (Chief Risk Officer) is the accountable risk-data seat.",
      rationale:
        "BCBS 239 is the one risk-data-aggregation standard the bank's obligations cite (ORG-AC-15 directly; ORG-RM-RDARR-* via its SA transposition D2/2015) but it was never among the 14 ingested Basel standards, leaving ORG-AC-15 unbridgeable. Ingesting it both closes that gap and exercises the TRANSPOSES model (international standard -> national directive) end-to-end, which has been asserted in the architecture but not yet demonstrated for a real cross-jurisdiction pair in this objective-layer workstream.",
      sourceDocHashes: [],
      citations: [
        "D-IASB-REGULATORY-INTELLIGENCE-INGESTION",
        "D-BCBS-OBJECTIVE-LAYER-INGESTION",
        "D-BASEL-CATALOGUE-PILLAR-1",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
