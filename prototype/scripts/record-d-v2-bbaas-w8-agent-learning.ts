// scripts/record-d-v2-bbaas-w8-agent-learning.ts
//
// Records D-V2-BBAAS-W8-AGENT-LEARNING — Marc's in-session approval
// (2026-06-12) of adding W8 (agent learning architecture) to the chartered
// WS-V2-BBAAS analysis map and dispatching its analysis paper.
//
// Scope approved:
//   (1) W8 joins the W1–W7 map: design how agents develop a working knowledge
//       base from source regulations, decisions, policies, and procedures —
//       beyond error/exception feedback loops. Canonical motivating cases:
//       (a) applicability reasoning — recognise a Prudential Authority
//       instrument does not bind because it pertains to Internal-Models-
//       Approach banks while this bank uses the Standardised Approach;
//       (b) impact reasoning — recognise from product accounting standards
//       that a proposed decision has unconsidered impacts.
//   (2) Architectural direction (CEO-ratified in-session): structured-first.
//       Knowledge is event-sourced, cited, and staleness-anchored — posture
//       register (RegulatoryElectionDeclared), applicability assessments
//       (ProvisionApplicabilityAssessed w/ posture refs), decision impact
//       sweeps (graph-reachability diff vs decision citations), context
//       packs, counterfactual drills, frozen exam sets, consolidation ticks.
//       Parametric training (LoRA-class fine-tuning) is NOT the system of
//       record: weights cannot cite, cannot selectively expire knowledge,
//       and leak across the tenant boundary via gradient memorisation.
//       "Weights propose, events dispose" — parametric assists may later be
//       trained FROM the event corpus as proposers only.
//   (3) Session deliverable: the W8 analysis paper (Substrate Architect seat
//       authoring, Regulatory Knowledge Engineer seat scope included),
//       filed via RecordFiled and landed by PR. Build slices (posture
//       register etc.) are named in the paper but not built under this
//       decision.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-ANALYSIS-LAUNCH;
// D-V2-BBAAS-W1-DECISION-DISTILLATION (map charter).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T10:40:00.000Z";
const APP = "2026-06-12T10:42:00.000Z";

const base = {
  decisionId: "D-V2-BBAAS-W8-AGENT-LEARNING",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "WS-V2-BBAAS: charter W8 agent learning architecture (structured-first; weights propose, events dispose) and dispatch its analysis paper",
  category: "governance" as const,
  recommendation:
    "Add W8 (agent learning architecture) to the chartered analysis map and dispatch its paper: agents develop a queryable, compounding knowledge base from source regulations, decisions, policies, and procedures. Core mechanisms to design: (1) a bank-posture register (RegulatoryElectionDeclared events: approach elections such as Standardised vs Internal-Models, licence class, jurisdictions, product scope) joined to provisions via APPLIES_WHEN predicates so applicability is a mechanical, citable join; (2) ProvisionApplicabilityAssessed events with posture references and drift anchors so every human correction is a labelled example and posture changes mechanically re-open affected assessments; (3) decision impact sweeps at Decision-requested phase — graph-reachability diff vs the decision's citations surfaces unconsidered impacts pre-approval, with a recon:decision-impact-coverage gate; (4) training mechanisms: per-seat context packs, counterfactual posture drills on scenario stores, adversarial challenge passes over past decisions, frozen exam sets gating seat-spec changes, per-K-event consolidation ticks emitting KnowledgeDistilled playbooks. Architectural direction ratified: structured-first — parametric fine-tuning (LoRA-class) is rejected as the system of record (no citations, no selective staleness, gradient leakage across the tenant boundary, adapter-rot on base-model upgrades); parametric assists may later be trained from the event corpus as proposers only.",
  rationale:
    "Marc identified agent learning as a key success factor for v2: agents must reason over what kind of bank this is (applicability) and over cross-domain consequences (impact), not merely react to errors. Both motivating failures are gaps in structured grounding, not in feedback: the IMA-vs-SA case lacks a machine-readable posture register; the accounting-impact case lacks a graph walk at decision time. The structured-first direction preserves Principles 1 and 2 (every learned item is an event with citations and a staleness anchor), keeps the tenancy boundary auditable (symbolic artifacts generalise through the W3 gate; gradients cannot), stays model-agnostic across API model upgrades, and preserves one-way option value: the correction corpus the mechanisms produce is exactly the training set any future parametric assist would need.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-ANALYSIS-LAUNCH",
    "D-V2-BBAAS-W1-DECISION-DISTILLATION",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
    "Principles/6-autonomous-by-default.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
