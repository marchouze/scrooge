// prototype/scripts/emit-reg-architecture-two-plane-decision.ts
//
// Records the CEO decision adopting the two-plane regulatory architecture.
// Marc approved the plan in-session (2026-06-04); under the session-delegation
// protocol that approval is the CEO authorisation, recorded here as the
// canonical Decision event.
//
// Idempotent: skips if D-REGULATORY-ARCHITECTURE-TWO-PLANE is already recorded.
// Run once from prototype/: bun run scripts/emit-reg-architecture-two-plane-decision.ts
// Stays in the repo as an audit record.

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-REGULATORY-ARCHITECTURE-TWO-PLANE";

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
      title: "Two-plane regulatory architecture: reference knowledge vs bank-action events",
      category: "engineering",
      recommendation:
        "Adopt a two-plane regulatory architecture. Plane A (Regulatory Knowledge) is reference data — regulations, their LLM/script/agent/human interpretations, and the derived graph — re-derivable and NOT event-sourced, with the regulatory graph as its single canonical representation, fed by pluggable extractors emitting one ontology via one RegulatoryExtraction contract (with provenance). Plane B (Bank Obligations & Action) is event-sourced (Principle 1): the bank's decision to accept a source obligation is an ObligationAdopted event that creates a bank obligation (ORG-*) linked DERIVES_FROM its source obligation, with a lifecycle to completion (policy → procedure → capability → attestation). Single source of truth: the reference graph for what regulation says; the event store for what the bank has accepted and must do. Consolidate the duplicate stores/methodologies/graphs onto these two planes.",
      rationale:
        "Not every real-world datum is an event: regulations and their interpretations are reference data (like a market-data tick), whereas the bank's decision to adopt an obligation is an event (like the adoption of a closing rate) that drives action with a lifecycle. This distinction resolves the current fragmentation (the same regulatory fact stored in up to seven places; two unreconciled obligation universes; three graph-construction paths) into a coherent store -> analyse -> adopt -> cascade pipeline with one clear data source per question.",
      sourceDocHashes: [],
      citations: ["P1-EVENTS-AS-TRUTH", "P2-SINGLE-GRAPH-DISCIPLINE", "D-BASEL-CATALOGUE-PILLAR-1"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
