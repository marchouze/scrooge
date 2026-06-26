// scripts/record-d-fx-ifrs-review-foundation.ts
//
// Records D-FX-IFRS-REVIEW-FOUNDATION — Marc's in-session approval (2026-06-26)
// of the plan that stands up the IFRS domain-truth FOUNDATION so a review of the
// FX-vanilla NPA accounting is correct *against IFRS*, not merely internally
// consistent. Premise: today a review proves CONSISTENCY not IFRS-TRUTH; the
// existing gates assert debits=credits / registry+CoA resolution / trade-date OBS
// shape / rule==fold==projection byte-equivalence, none of which prove the posting
// RULE is the correct IFRS treatment. D-AGENT-DOMAIN-COMPETENCE / PROC-GOV-ADC-01
// prescribe the fix (§18-20 + golden cases + domain-invariant gates); not yet
// populated for accounting. Scope (items 1-5): IFRS oracle (ingest IAS 21 + tag FX
// paragraphs, fuller ingestion, licensing flag tracked), golden worked-example
// cases, domain-invariant recon gates, written review methodology (PROC), and
// premise-challenge wiring + recon:agent-spec-domain-competence WARN->FAIL for
// Bea+Camille. Out of scope: 5 deferred posting rules, IFRS 13 fair-value-level +
// IAS 21 retranslation-timing gates, live-sim->asserted bridge gate.
// Idempotent on (decisionId, phase, as_of). Scrooge is recording instrument
// (scrooge:session-delegation); Marc is authorizing principal. Build-phase
// engineering-substrate decision -> CEO authority, `engineering` category.
// Authority: CLAUDE.md §"Session delegation"; D-AGENT-DOMAIN-COMPETENCE;
//   PROC-GOV-ADC-01; D-ENGINEERING-INTEGRITY-CHARTER; D-FX-TRADE-DATE-FVTPL-OBS;
//   D-FX-PNL-FCY-EXPOSURE-REVALUATION; Principles 1 & 2.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-26T09:00:00.000Z";
const APPROVED = "2026-06-26T09:05:00.000Z";

const base = {
  decisionId: "D-FX-IFRS-REVIEW-FOUNDATION",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Stand up the IFRS domain-truth foundation for the FX-vanilla NPA accounting review (oracle, golden cases, invariant gates, review methodology, premise-challenge wiring)",
  category: "engineering" as const,
  recommendation:
    "Build the IFRS domain-truth foundation so a review of the FX-vanilla NPA accounting is correct against IFRS, not merely internally consistent: (1) IFRS oracle (ingest IAS 21, tag FX-vanilla governing paragraphs across IFRS 9/13 and IAS 21 plus worked examples, populate Bea/Camille §18 — fuller ingestion with tracked IFRS-Foundation licensing flag); (2) golden worked-example cases asserting byte-match with our FX postings; (3) domain-invariant recon gates (realised FX gain/loss to P&L only; monetary items retranslated at closing rate; FVTPL movement to P&L or OCI only under recorded election; settlement P&L-neutral); (4) written review methodology PROC with Bea reviewer / Camille decider via the sync primitive and Vera third-line audit; (5) premise-challenge wiring in Bea/Camille §20 + ratchet recon:agent-spec-domain-competence WARN->FAIL for Bea+Camille. Defer full-lifecycle closure to a later workstream.",
  rationale:
    "Today an FX-vanilla accounting review proves CONSISTENCY, not IFRS-TRUTH. The bank's own agent-spec-domain-competence recon header states the FX accounting errors were domain-MODEL failures, not engineering failures: the code balanced, compiled, and passed every test yet was IFRS-wrong and unchallenged. The settlement-realisation error originated in a Scrooge brief and was executed unchallenged; the vacuous self-cancelling trade-date pair was caught late by the live simulator, not a gate. D-AGENT-DOMAIN-COMPETENCE / PROC-GOV-ADC-01 prescribe the remedy but it is not yet populated for accounting (Bea.md and Camille.md stop at §17; the gate runs at WARN). Standing up that foundation, specialised to FX vanilla, converts internally-consistent into validated-against-IFRS and wires the seat authority that rejects a wrong premise at source. Aligns with the Engineering Charter and Principle 2.",
  sourceDocHashes: [],
  citations: [
    "D-AGENT-DOMAIN-COMPETENCE",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "D-FX-TRADE-DATE-FVTPL-OBS",
    "D-FX-PNL-FCY-EXPOSURE-REVALUATION",
    "Procedures/by-policy/agent-domain-competence-framework.md",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-FX-IFRS-REVIEW-FOUNDATION" },
    null,
    2,
  ),
);
