// prototype/scripts/emit-iasb-reg-intelligence-ingestion-decision.ts
//
// Records the CEO decision to ingest the IASB (IFRS) instrument stack as Plane-A
// graph nodes and wire IASB into the regulatory-intelligence objective layer.
// Marc approved in-session ("continue", 2026-06-10); session-delegation protocol.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-iasb-reg-intelligence-ingestion-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-IASB-REGULATORY-INTELLIGENCE-INGESTION";

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
        "IASB regulatory-intelligence ingestion: model IFRS instruments as graph nodes + wire into the objective layer",
      category: "engineering",
      recommendation:
        "Bring the IASB (International Accounting Standards Board) into the regulatory graph to the same depth as PA/FSCA/FIC/BCBS. (a) Ingest the IFRS instrument stack as Plane-A reference nodes (Regulator REG-IASB -> Document -> Provision -> EXPRESSES -> Obligation): IFRS 7, IFRS 9, IFRS 10, IFRS 13, IFRS 15, IFRS 16, IAS 1, IAS 12, IAS 21, IAS 24, IFRIC 23 — the standards the bank's accounting obligations cite. Bridge the IFRS-cited ORG-AC-* obligations (AC-01..AC-12) plus ORG-GRP-FINREP (IFRS 10) to their source standards via EXPRESSES; leave the non-IASB ORG-AC rows (AC-13 Banks Act, AC-14 Companies Act, AC-15 BCBS 239, AC-16 IRBA) honestly unbridged or bridged to their own regulators. (b) Wire IASB into the objective layer: an IASB mandate (IFRS Foundation Constitution — a single set of high-quality, globally-accepted standards bringing transparency, accountability and efficiency to financial markets) decomposing into transparency (high-quality comparable information), accountability (reduce the information gap between providers and users of capital; stewardship) and market-efficiency (efficient capital allocation); SERVES edges from the IFRS obligations to those objectives; ALIGNS_TO edges from the accounting policies. Mira (Compliance / RegTech Engineer) builds; Camille (Chief Financial Officer) is the accountable accounting/financial-reporting seat.",
      rationale:
        "IASB is the fifth regulator brought to full Regulator->Document->Obligation->Objective depth, completing the accounting axis alongside the prudential (PA/BCBS), conduct (FSCA) and financial-crime (FIC) axes. The IFRS obligations are already authored and in force; modelling the standards as nodes and giving IASB its objectives makes financial-reporting compliance traceable to the IFRS Foundation's stated purpose (transparency, accountability, market efficiency) rather than standard-by-standard.",
      sourceDocHashes: [],
      citations: [
        "D-BCBS-OBJECTIVE-LAYER-INGESTION",
        "D-FIC-REGULATORY-INTELLIGENCE-INGESTION",
        "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
