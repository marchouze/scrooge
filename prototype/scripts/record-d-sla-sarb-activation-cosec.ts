// prototype/scripts/record-d-sla-sarb-activation-cosec.ts
//
// SARB activation Round 2 — the COSEC HALF of the joint SARB-BA-RETURN
// activation approval (spec §9.5 activation runbook, step 2).
//
// Records `D-SLA-SARB-BA-RETURN-ACTIVATION-COSEC`: Owen (Company Secretary,
// governance) approving — jointly with Camille (CFO, finance), who records the
// CFO half in parallel — the ACTIVATION of the SARB-BA-RETURN parallel
// accounting representation into the production posting path.
//
// This is the CoSec half of the joint approval required by
// `D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL`. The recon
// `recon:sla-approval-workflow` (b) requires BOTH a CFO approved Decision AND a
// CoSec approved Decision present in the store before SARB-BA-RETURN may sit in
// the activated production set. This script supplies the CoSec side. Camille's
// parallel run supplies the CFO side + the four-eyes `SlaRuleApproved` events
// (approver agent:camille ≠ publisher agent:bea) per (a).
//
// SEGREGATION OF DUTIES (D-SLA-APPROVAL-WORKFLOW-SEGREGATION):
//   The activation approver (CoSec, here) is distinct from the rule PUBLISHER
//   (engineering — Bea) and the rule APPROVER (CFO — Camille). No single seat
//   authors, approves, AND activates a posting rule. Owen approves only the
//   representation ACTIVATION, jointly with the CFO; he is not the rule author
//   nor the four-eyes rule approver — no role conflict.
//
// DOES NOT FLIP PRODUCTION. This script records ONLY the CoSec Decision. It does
// NOT touch `PRODUCTION_REPRESENTATIONS`, `package.json`, `ci:migrate`, or the
// `bea-gl-fx-interpreter-cutover.ts` seam — that is Round 3 (engineering). Round 3
// wires this script (and Camille's) into `ci:migrate` so the activation pair
// reproduces deterministically in any fresh store; that wiring is deliberately
// NOT done here to avoid colliding with Camille's parallel run on shared infra.
//
// Idempotent: fixed asOfs ⇒ re-runs dedup on (decisionId, phase, as_of). The
// `requested` and `approved` phases carry DISTINCT asOfs so the decision
// lifecycle is a symmetric chain (recon:decision-symmetry).
//
// Run from prototype/:
//   bun run scripts/record-d-sla-sarb-activation-cosec.ts
// Live home store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-sla-sarb-activation-cosec.ts
//
// Author: Owen (Company Secretary, governance) — the accountable CoSec seat.

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-SLA-SARB-BA-RETURN-ACTIVATION-COSEC";
const TITLE = "SARB-BA-RETURN representation activation — CoSec half of the joint approval";

const CITATIONS = [
  "Principles/1-events-are-truth.md",
  "Principles/6-autonomous-by-default.md",
  "D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL",
  "D-SLA-APPROVAL-WORKFLOW-SEGREGATION",
  "D-SLA-ENGINE-RULES-AS-DATA",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

const RECOMMENDATION =
  "Activate the SARB-BA-RETURN parallel accounting representation into the production " +
  "posting path. As Company Secretary I record the CoSec half of the joint activation " +
  "approval required by D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL; the CFO half is " +
  "recorded in parallel by Camille (Chief Financial Officer, finance). Activation is " +
  "sanctioned only when BOTH halves are on the log AND every SARB-BA-RETURN rule version " +
  "carries a four-eyes SlaRuleApproved (approver ≠ publisher). Engineering (Round 3) then " +
  "flips PRODUCTION_REPRESENTATIONS to include SARB-BA-RETURN; this Decision does not flip " +
  "production by itself.";

const RATIONALE =
  "Governance preconditions confirmed as Company Secretary: (1) all nine SARB-BA-RETURN rule " +
  "versions (PR-FX-001-BA@v1/@v2, PR-FX-002-BA, PR-FX-PRIN-BA, PR-FX-CLOSE-BA, PR-FX-005-BA, " +
  "PR-FX-CANCEL-BA, PR-FX-INSTRUCT-BA, PR-FX-REGREPORT-BA) were published in Round 1 with " +
  "publisher = Bea (the authoring/engineering seat), opening the pending-review queue; (2) the " +
  "approval workflow followed the §9.3 flow (author → publish → independent four-eyes approval → " +
  "eligible); (3) my five segregation-of-duties controls (D-SLA-APPROVAL-WORKFLOW-SEGREGATION) " +
  "hold — author ≠ approver (Bea publishes, Camille four-eyes-approves the rules, Owen+Camille " +
  "jointly approve the activation; no seat does two of the three), attested typed events, an " +
  "append-only audit trail, the Principle-6 rule-level (not per-posting) boundary, and recon " +
  "enforcement via recon:sla-approval-workflow. The activation crosses both the CFO's accounting-" +
  "policy authority and the CoSec's governance-register authority, so neither seat may activate " +
  "alone — hence this CoSec half, joint with the CFO. SARB-BA-RETURN changes what the bank reports " +
  "(the BA-350 net-open-position basis), making joint governance sign-off the correct gate.";

// Distinct asOfs: requested precedes approved; both after the standing-rule
// decisions (08:59:30 / 09:00:30) and after the Round-1 publishes (00:00:00).
const REQUESTED_AS_OF = "2026-06-06T10:00:00.000Z";
const APPROVED_AS_OF = "2026-06-06T10:01:00.000Z";

// Open the lifecycle (CoSec authority).
requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CoSec",
    authorityRef: "owen@bank",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: "Opens the SARB-BA-RETURN activation decision lifecycle (CoSec half).",
    citations: CITATIONS,
    recordedVia: "agent:autonomous",
    actor: { type: "service", id: "agent:owen" },
  },
  REQUESTED_AS_OF,
);

// Approve the activation (CoSec half of the joint approval).
const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CoSec",
    authorityRef: "owen@bank",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "agent:autonomous",
    actor: { type: "service", id: "agent:owen" },
  },
  APPROVED_AS_OF,
);

// eslint-disable-next-line no-console
console.log(
  JSON.stringify({
    ok: true,
    decisionId: DECISION_ID,
    phase: "approved",
    eventId: result.eventId,
    authority: "CoSec",
  }),
);
