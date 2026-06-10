// prototype/scripts/emit-fsca-reg-intelligence-ingestion-decision.ts
//
// Records the CEO decision to ingest the FSCA instrument stack as Plane-A graph
// nodes and wire FSCA into the regulatory-intelligence objective layer. Marc
// approved in-session (2026-06-10); under the session-delegation protocol that
// approval is the CEO authorisation, recorded here as the canonical Decision event.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-fsca-reg-intelligence-ingestion-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FSCA-REGULATORY-INTELLIGENCE-INGESTION";

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
        "FSCA regulatory-intelligence ingestion: model FSCA instruments as graph nodes + wire into the objective layer",
      category: "engineering",
      recommendation:
        "Bring the FSCA into the regulatory graph to the same depth as BCBS/PA. (a) Ingest the FSCA instrument stack as Plane-A reference nodes (Regulator REG-FSCA -> Document -> Provision -> EXPRESSES -> Obligation): FAIS Act 37 of 2002 + General Code of Conduct (BN 80/2003) + Fit & Proper Determination + Conflict-of-Interest Code; FSCA Conduct Standards 1/2018, 2/2018, 3/2018 (under the FMA); Financial Markets Act 19 of 2012 + FMA Regulations (GN R.98/2018); the PA+FSCA Joint Standards (1/2020 Significant Owners, 1/2023 IT Governance, 2/2024 Cybersecurity); and the forthcoming COFI Bill as monitored. Bridge the ~71 existing FSCA-cited ORG-* obligations to their source provisions via DERIVES_FROM so the register stops being a citation-string scan and becomes a typed Regulator->Document->Obligation query. (b) Wire FSCA into the objective layer: an FSCA mandate (FSR Act s57 / FSCA objectives) decomposing into fair-customer-treatment (TCF), market integrity & efficiency, financial inclusion, and financial education; SERVES edges from the FSCA obligations to those objectives; ALIGNS_TO edges from the conduct policies (FAIS/TCF/Complaints/COI). Mira (Compliance / RegTech engineer) builds the substrate; Zara (Chief Compliance Officer) is the accountable conduct seat for the FSCA domain content.",
      rationale:
        "The obligations register already carries ~71 FSCA-sourced obligations, but the regulatory graph wires only FW-FAIS to REG-FSCA, so FSCA coverage is answerable only by citation-string matching, not by traversal. PA was just brought to full Regulator->Document->Obligation->Objective depth; FSCA is the highest-value next regulator because conduct is a primary domain and the FAIS/Conduct-Standards obligations are already authored. Modelling FSCA instruments as nodes and giving FSCA objectives makes conduct compliance traceable to intent (fair treatment, market integrity) rather than rule-by-rule, and lets the objective-coverage recon gates surface conduct gaps the same way they do for prudential.",
      sourceDocHashes: [],
      citations: [
        "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
        "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
        "P2-SINGLE-GRAPH-DISCIPLINE",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
