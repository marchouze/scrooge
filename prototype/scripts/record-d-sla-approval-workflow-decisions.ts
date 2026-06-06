// scripts/record-d-sla-approval-workflow-decisions.ts
//
// Records the two CoSec decisions that govern the Phase-4c SLA rule approval
// workflow:
//
//   D-SLA-APPROVAL-WORKFLOW-SEGREGATION
//     Owen (Company Secretary, governance) — the five segregation-of-duties
//     controls the approval workflow must enforce (author ≠ approver; attested
//     typed event; append-only audit; Principle-6 rule-level boundary;
//     enforced-by-recon).
//
//   D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL
//     Owen (CoSec) — activating a non-IFRS parallel representation into the
//     production posting path requires BOTH a CFO Decision and a CoSec Decision
//     (joint approval). SARB-BA-RETURN is NOT activated in Phase 4c; this is the
//     standing rule the recon enforces.
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of). Both decisions open with a `requested` phase so
// recon:decision-symmetry sees a symmetric chain.
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const CITATIONS = [
  "Principles/1-events-are-truth.md",
  "Principles/6-autonomous-by-default.md",
  "D-SLA-ENGINE-RULES-AS-DATA",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

interface Spec {
  readonly decisionId: string;
  readonly title: string;
  readonly recommendation: string;
  readonly rationale: string;
  readonly requestedAsOf: string;
  readonly approvedAsOf: string;
}

const SPECS: readonly Spec[] = [
  {
    decisionId: "D-SLA-APPROVAL-WORKFLOW-SEGREGATION",
    title: "SLA rule approval workflow — five segregation-of-duties controls",
    recommendation:
      "The SLA rule approval workflow (Phase 4c) MUST enforce five segregation-of-duties controls: " +
      "(i) author ≠ approver — no self-approval; (ii) an attested typed approval event carrying the " +
      "approver name + position, rule_id, version, and reviewed-preview hash; (iii) an append-only, " +
      "immutable audit trail (corrections are new events); (iv) the Principle-6 boundary — approval " +
      "gates the RULE, never individual postings; (v) the workflow is enforced by recon, not aspirational.",
    rationale:
      "A rules-as-data engine where any single seat could author AND activate a posting rule would " +
      "be an unacceptable control gap (a four-eyes failure on the accounting record itself). The five " +
      "controls make the governance gate structural and auditable.",
    requestedAsOf: "2026-06-06T08:59:00.000Z",
    approvedAsOf: "2026-06-06T09:00:00.000Z",
  },
  {
    decisionId: "D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL",
    title: "SLA non-IFRS representation activation — CFO + CoSec joint approval",
    recommendation:
      "Activating a non-IFRS parallel accounting representation (e.g. SARB-BA-RETURN) into the " +
      "PRODUCTION posting path requires BOTH a CFO approved Decision AND a CoSec approved Decision " +
      "(joint approval), in addition to a four-eyes SlaRuleApproved for each activated rule version. " +
      "The recon:sla-approval-workflow gate asserts the CFO+CoSec pair whenever a non-IFRS " +
      "representation is present in the activated production set.",
    rationale:
      "A parallel regulatory/tax basis going live changes what the bank reports; that crosses both the " +
      "CFO's accounting-policy authority and the CoSec's governance-register authority, so neither seat " +
      "may activate it alone. Phase 4c builds the gate but does NOT activate SARB-BA-RETURN — production " +
      "stays IFRS-only until this joint round is run.",
    requestedAsOf: "2026-06-06T08:59:30.000Z",
    approvedAsOf: "2026-06-06T09:00:30.000Z",
  },
];

for (const spec of SPECS) {
  requestDecision(
    {
      decisionId: spec.decisionId,
      authority: "CoSec",
      authorityRef: "owen@bank",
      title: spec.title,
      category: "governance",
      recommendation: spec.recommendation,
      rationale: "Opens the decision lifecycle (CoSec authority).",
      citations: CITATIONS,
      recordedVia: "scrooge:session-delegation",
    },
    spec.requestedAsOf,
  );

  const result = recordDecision(
    {
      decisionId: spec.decisionId,
      phase: "approved",
      authority: "CoSec",
      authorityRef: "owen@bank",
      title: spec.title,
      category: "governance",
      recommendation: spec.recommendation,
      rationale: spec.rationale,
      sourceDocHashes: [],
      citations: CITATIONS,
      recordedVia: "scrooge:session-delegation",
    },
    spec.approvedAsOf,
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, decisionId: spec.decisionId, eventId: result.eventId }));
}
