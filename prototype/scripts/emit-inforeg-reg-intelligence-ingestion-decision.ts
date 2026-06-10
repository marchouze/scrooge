// prototype/scripts/emit-inforeg-reg-intelligence-ingestion-decision.ts
//
// Records the CEO decision to ingest the Information Regulator (POPIA / PAIA)
// instrument stack as Plane-A graph nodes and wire it into the objective layer —
// the last of the six modelled regulators. Marc approved in-session ("continue",
// 2026-06-10); session-delegation protocol.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-inforeg-reg-intelligence-ingestion-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-INFOREG-REGULATORY-INTELLIGENCE-INGESTION";

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
        "Information Regulator (POPIA/PAIA) regulatory-intelligence ingestion: model instruments as graph nodes + wire into the objective layer",
      category: "engineering",
      recommendation:
        "Bring the Information Regulator into the regulatory graph to the same depth as PA/FSCA/FIC/BCBS/IASB — the last of the six modelled regulators. (a) Ingest the data-protection instrument stack as Plane-A reference nodes (Regulator REG-INFO-REG -> Document -> Provision -> EXPRESSES -> Obligation): POPIA (Protection of Personal Information Act 4 of 2013) — the eight processing conditions and key sections the bank's obligations cite (s.11 lawful basis, s.13-15 purpose/further-processing, s.18 notification, ss.19-22 security safeguards + breach notification, s.23-24 access/correction, s.34-35 special/children, ss.55-57 Information Officer + prior authorisation, s.71 automated decisions, s.72 cross-border transfer, s.39 establishment/mandate) + POPIA Regulations; and PAIA (Promotion of Access to Information Act 2 of 2000 — s.51 manual, access requests). Extend the existing partial POPIA representation (REG-INFO-REG + PROV-POPIA-s39 already exist) rather than duplicating. Bridge the ORG-PR(IV)-01..17 obligation family plus ORG-EL-03 and ORG-RM-04 to their POPIA/PAIA source provisions via EXPRESSES. (b) Wire into the objective layer: an Information Regulator mandate (POPIA s.39) decomposing into protection-of-personal-information (privacy), access-to-information (PAIA), and monitoring-and-enforcement; SERVES edges from the obligations to those objectives; ALIGNS_TO from the Information Security & IT Governance policy and any data-protection policy. Mira (Compliance / RegTech Engineer) builds; Rashida (Chief Information Security Officer) is the accountable data-protection/security seat.",
      rationale:
        "The Information Regulator is the sixth and last regulator to bring to full Regulator->Document->Obligation->Objective depth, completing the objective layer across the bank's entire regulator set (prudential PA/BCBS, conduct FSCA, financial-crime FIC, accounting IASB, data-protection INFO-REG). The POPIA/PAIA obligations are already authored and in force (ORG-PR(IV)-01..17), so the ingestion is high-confidence, and wiring the data-protection objectives makes privacy/access compliance traceable to the Regulator's statutory mandate.",
      sourceDocHashes: [],
      citations: [
        "D-BCBS-239-RDARR-INGESTION",
        "D-IASB-REGULATORY-INTELLIGENCE-INGESTION",
        "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
