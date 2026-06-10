// prototype/scripts/emit-fic-reg-intelligence-ingestion-decision.ts
//
// Records the CEO decision to ingest the FIC (Financial Intelligence Centre)
// instrument stack as Plane-A graph nodes and wire FIC into the objective layer.
// Marc approved in-session ("go next", 2026-06-10); under the session-delegation
// protocol that approval is the CEO authorisation, recorded here as canonical.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-fic-reg-intelligence-ingestion-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FIC-REGULATORY-INTELLIGENCE-INGESTION";

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
        "FIC regulatory-intelligence ingestion: model FIC instruments as graph nodes + wire into the objective layer",
      category: "engineering",
      recommendation:
        "Bring the FIC (Financial Intelligence Centre) into the regulatory graph to the same depth as BCBS/PA/FSCA. (a) Ingest the FIC instrument stack as Plane-A reference nodes (Regulator REG-FIC -> Document -> Provision -> EXPRESSES -> Obligation): FIC Act 38 of 2001 (principal — ss.21-21H CDD, s.22 records, s.28 CTR, s.28A TPR, s.29 + s.29(3) STR/tipping-off, s.42 RMCP, s.43 training, s.43A MLRO-not-CEO); Money Laundering and Terrorist Financing Control Regulations 2002; FIC Amendment Act 1 of 2017 and General Laws (AML/CFT) Amendment Act 22 of 2022; Schedules 1/2/3; Guidance Note 7 (RMCP/risk-based approach), GN 4A (STR), GN 5 (CTR), GN 6 (TPR); and Public Compliance Communications (incl. PCC 23 targeted financial sanctions). Bridge the 27 existing ORG-FC-* obligations to their FIC source provisions via EXPRESSES; for the handful citing non-FIC sources (FATCA/CRS, POCDATARA, PRECCA, UK Bribery Act, SARB PA Directive 4/2022) bridge to those source documents or leave honestly unbridged rather than force FIC attribution. (b) Wire FIC into the objective layer: a FIC mandate (FIC Act s.3) decomposing into financial-intelligence-to-authorities, customer-due-diligence integrity, targeted-financial-sanctions, and AML/CFT supervision; SERVES edges from the FIC obligations to those objectives; ALIGNS_TO edges from the AML/CFT and sanctions-screening policies. Mira (Compliance / RegTech Engineer) builds; Zara (Chief Compliance Officer) is the accountable conduct/compliance seat.",
      rationale:
        "FIC is the third regulator brought to full Regulator->Document->Obligation->Objective depth after PA and FSCA, completing the financial-crime axis. The 27 ORG-FC-* obligations are already authored and richly cited to FIC Act sections, so the ingestion is high-confidence and the objective wiring (intelligence, CDD, sanctions, supervision) makes AML/CFT compliance traceable to the FIC's statutory purpose rather than rule-by-rule — directly relevant given SA's FATF greylisting remediation.",
      sourceDocHashes: [],
      citations: [
        "D-FSCA-REGULATORY-INTELLIGENCE-INGESTION",
        "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
        "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
