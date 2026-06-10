// prototype/scripts/emit-reg-intelligence-objective-layer-decision.ts
//
// Records the CEO decision adopting the regulatory-intelligence objective/mandate
// layer. Marc approved the plan in-session (2026-06-10); under the session-delegation
// protocol that approval is the CEO authorisation, recorded here as the canonical
// Decision event.
//
// Idempotent: skips if D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER is already recorded.
// Run once from prototype/: bun run scripts/emit-reg-intelligence-objective-layer-decision.ts
// Stays in the repo as an audit record.

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER";

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
        "Regulatory-intelligence objective/mandate layer: model regulator intent as first-class nodes",
      category: "engineering",
      recommendation:
        "Insert an objective/intent layer into the Plane-A regulatory graph between regulators and their requirements. Add one node type (RegulatoryObjective, with level mandate|objective|sub-objective and a sourceCitation) and four edge types: PURSUES (Regulator -> RegulatoryObjective), REFINES (RegulatoryObjective -> RegulatoryObjective), SERVES (Obligation -> RegulatoryObjective, the keystone recording why a requirement exists), and ALIGNS_TO (Policy -> RegulatoryObjective, giving policies a purpose-level citation alongside IMPLEMENTS). Objectives are reference data (re-derivable from the regulator's own statements), not events — consistent with the two-plane split. Land a thin slice wiring the real Prudential Authority vertical end-to-end (mandate from FSR Act 9 of 2017 s33(a)-(d) -> SERVES from existing capital/liquidity/large-exposure obligations -> ALIGNS_TO from existing capital/liquidity policies), and three advisory recon gates (regulator-mandate-coverage, requirement-objective-linkage, objective-policy-alignment) that operationalise the model as continuous controls.",
      rationale:
        "Regulators and regulations have mandates and objectives, communicated through the requirements of the regulations. The graph today records the requirement (the what) but never the objective a requirement serves (the why), and policies cite obligations but never objectives — so the bank can prove it ticks a requirement but not that it advances the purpose behind it. Modelling intent as first-class nodes lets policies align to purpose (not just rules), surfaces literalism (a requirement serving no recorded objective) and gaps (an objective no policy advances), survives regulatory change (the objective persists when a requirement is amended), enables consolidation (requirements sharing an objective -> one coherent policy; cross-regulator shared objectives -> policy synergy), and lets the bank explain compliance to a regulator in its own teleology.",
      sourceDocHashes: [],
      citations: [
        "P2-SINGLE-GRAPH-DISCIPLINE",
        "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
        "D-PRINCIPLE-2-CAPABILITY-LAYER",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
