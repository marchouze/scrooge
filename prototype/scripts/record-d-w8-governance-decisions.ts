// One-shot: record D-W8-PARAMETRIC-TRAINING-POSITION and D-W8-EXAM-GOVERNANCE.
// Authority: CEO session-delegation (Marc approved W8 Next Phase plan 2026-06-14).
// Run with: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-w8-governance-decisions.ts

import { recordDecision } from "../runtime/decisions/record.ts";

const asOf = "2026-06-14T00:00:00.000Z";

const r1 = recordDecision(
  {
    decisionId: "D-W8-PARAMETRIC-TRAINING-POSITION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Standing position: parametric training (LoRA / fine-tune) is permitted only as a proposer layer trained from the structured corpus; it may never be the system of record; verdict disposal is always an event",
    category: "engineering",
    recommendation:
      "Adopt the structured-first position as the canonical standing constraint for all W8 agent-learning work: (1) weights may be used to propose obligation groupings, dimension labels, or applicability verdicts, but only when trained exclusively from artefacts already in the event store or graph.db corpus; (2) every proposal produced by a parametric model must pass through a typed disposal event (ObligationAdopted, ApplicabilityAssessmentConcluded, etc.) before it becomes a fact in the bank's knowledge base; (3) the system of record is always the event log — no weight checkpoint may serve as the authoritative source for any regulatory or operational fact; (4) model checkpoints must be version-anchored to the corpus snapshot (blake3 hash of the corpus files used for training) so staleness is detectable; (5) a parametric model whose training corpus pre-dates a material regulatory change is automatically flagged stale by the posture-drift recon until a new checkpoint is produced.",
    rationale:
      "The W8 architecture paper (PR #1271, D-V2-BBAAS-W8-AGENT-LEARNING) established the 'weights propose, events dispose' design after evaluating LoRA fine-tuning as an alternative to the structured graph. The four disqualifying properties of weights-as-record are: (a) weights cannot carry citations — a fine-tuned weight encoding a BCBS CRE obligation has no URN, no provision reference, and no Principle-2 traceability; (b) no selective staleness — when a PA directive is superseded, a weight encoding that directive cannot be surgically updated without full retraining; (c) gradient leakage across tenant boundaries — in a multi-tenant BBaaS, adapter weights trained on one tenant's adoption history structurally contaminate other tenants, a Competition Act s.4(1) exposure; (d) adapter-rot on API model upgrades — every provider model upgrade potentially invalidates LoRA adapters without warning. The corpus-first design preserves the fine-tune option one-way: the structured corpus can later be used as a training set; the reverse (LoRA-first) forecloses structured citation permanently. Recording this as a standing decision allows the recon:v2-posture-dimension-vocab gate to assert it in CI and allows future FIL-Model submissions to reference it as the binding constraint on parametric assists.",
    sourceDocHashes: [],
    citations: [
      "D-V2-BBAAS-W8-AGENT-LEARNING",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-W8-POSTURE-REGISTER-SLICE-1",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  asOf,
);

console.log("D-W8-PARAMETRIC-TRAINING-POSITION:", JSON.stringify(r1, null, 2));

const r2 = recordDecision(
  {
    decisionId: "D-W8-EXAM-GOVERNANCE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Exam-set authorship, ownership, and adversarial-pass rules for the W8 eval harness",
    category: "engineering",
    recommendation:
      "Establish the following governance rules for the eval harness (v2-core/eval/, S13): (1) AUTHORSHIP BY SEAT — exam-set ownership is assigned by subject kind: Nadia (Head of Model Risk, risk) owns FIL-Model exam-sets; Helena (Chief Risk Officer, governance) owns posture and RAS exam-sets; Vera (Internal Audit Engineer, governance) owns agent-behaviour exam-sets. Authorship is recorded in the ExamSetRegistered event's registeredBy field using the seat's canonical identity string (e.g. 'Nadia (Head of Model Risk, risk)'). (2) REFRESH CADENCE — an exam-set must be refreshed (new ExamSetRegistered with incremented version) on: (a) every FIL-Model version bump (FilModelImplementationDeclared with a new methodologyHash); (b) every PostureRevised event for a posture covered by that exam-set; (c) any material regulatory change (new ObligationAdopted or updated provision text) that affects the subject's cited provisions. The owning seat is responsible for initiating the refresh; the recon:v2-eval-harness-integrity gate surfaces stale exam-sets (subject hash diverged from registered set's anchor). (3) ADVERSARIAL-PASS RULE — every exam-set must contain at least one exam whose expectation exercises a known-failure scenario (a negative invariant): an input that should produce an incorrect result if the subject is broken, verifying the harness can actually detect failure. The ExamSet well-formedness checker (checkExamSetWellFormed) will be extended to assert this rule. (4) INDEPENDENCE — Nadia's independent model validation (ModelValidationApproved) is a separate gate from the systematic exam harness (evaluateChangeGate); both must clear for a FIL-Model to be adoptable (adoptable: status === 'cleared' && independentSignOff === true). The harness does not replace independent validation; it runs in addition to it.",
    rationale:
      "The W8 eval harness (S13, PR #1310) was shipped with the SA-CCR pilot exam-set (6/6 passing) and the change-gate pattern but without governance assignments. Without defined authorship, refresh cadence, and adversarial-pass rules, exam-sets will drift: the SA-CCR set may become stale after a BCBS CRE amendment without a clear seat responsible for updating it; posture exam-sets do not yet exist; agent-behaviour sets are undefined. The adversarial-pass rule closes the most critical gap — an exam-set containing only passing-scenario checks cannot detect a broken subject (it would pass vacuously). This is the exam-governance equivalent of Principle 4 (security designed in): the assurance corpus must include red-team cases from birth. Recording this as a CEO decision (build phase) allows Owen's recon:dispatch-sync-integrity to assert exam-set authorship against the seat roster, and allows Vera's gap-finding mandate to report exam-sets that violate the adversarial-pass rule.",
    sourceDocHashes: [],
    citations: [
      "D-V2-BBAAS-W8-AGENT-LEARNING",
      "D-W8-POSTURE-REGISTER-SLICE-1",
      "D-MODEL-BINDING-CONTRACT-V1",
      "P1-EVENTS-AS-TRUTH",
      "P4-SECURITY-DESIGNED-IN",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  asOf,
);

console.log("D-W8-EXAM-GOVERNANCE:", JSON.stringify(r2, null, 2));
