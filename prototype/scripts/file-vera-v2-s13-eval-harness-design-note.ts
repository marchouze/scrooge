// scripts/file-vera-v2-s13-eval-harness-design-note.ts
//
// One-shot RMS Phase 3 filing for Vera's V2 S13 eval-harness design note.
// Records the exam/eval model, how it generalises Nadia's one-off SA-CCR
// validation, how it composes with the W8 disposal path + the independent
// model-validation plane, and the SA-CCR pilot result. Idempotent — skips if
// already filed.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
// D-W8-POSTURE-REGISTER-SLICE-1; D-RMS-PHASE-3 (active).
// Author: Vera (Internal Audit Engineer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:vera:v2-s13-eval-harness-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-vera-v2-s13-eval-harness-design-note] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S13 — exam-set + eval harness: design note

**Author:** Vera (Internal Audit Engineer, governance), with Sade (AgentOps, operations)
**Date:** 2026-06-13
**Authority:** D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT; D-W8-POSTURE-REGISTER-SLICE-1
**Audience:** Marc (CEO); Nadia (Model-validation engineer, governance); Rohan (Risk engineer, engineering); Atlas (Core banking platform architect, engineering)
**Status:** Implemented — PR feat(v2-s13): exam-set + eval harness

---

## 1. What S13 is

Nadia's SA-CCR validation (#1299) was a one-off, hand-authored review: a human/agent
judgment, recorded once, with no systematic substrate to re-run on the next change. S13
generalises that into a **reusable exam-set + eval harness**: a typed battery of exams a
subject (a FIL-Model, a posture, an agent behaviour) must pass, run systematically,
producing a typed eval verdict-of-record. This is the assurance substrate that lets the W8
learning layer be safe — a proposed change can be **gated on passing its exam-set** before
it is accepted (structured-first: exams gate disposal).

## 2. The exam/eval model

- **Exam** — \`{ examId, subjectKind, subjectScope, scenario, expectation, citation }\`.
  The \`scenario\` is a typed input; the \`expectation\` is a kernel-evaluable predicate
  (numeric-equals / at-least / at-most / equals / monotonic-nondecreasing / invariant-holds)
  over a NAMED OUTPUT FIELD the subject reports. Every exam carries a Principle-2 upward
  citation to the provision/methodology it asserts conformance to.
- **Exam-set** — a named, versioned group of exams for one subject (\`examset:<subject>\`).
  Event-sourced via \`ExamSetRegistered\` — the assurance corpus is a query over the log,
  not a static fixture (Principle 1). Well-formedness (schema + intra-set consistency) is a
  precondition both the harness and the recon enforce.
- **Harness** — \`runEval(subject, examSet) → EvalResult\`. SUBJECT-AGNOSTIC and PURE: a
  \`subject\` is an adapter (\`observe(exam) → ObservedOutput\`) that the harness drives. It
  produces a per-exam pass/fail + an overall verdict (passed / failed / passed-with-findings)
  and is deterministic — the same (subject, exam-set) re-run yields a byte-identical result.
- **Event-of-record** — \`EvalRunCompleted\` carries the verdict, the per-exam outcomes, the
  exam-set version, and a \`subjectHash\` (the FIL-Model methodologyHash) so a passing eval is
  BOUND to the exact subject version it ran against. The eval is a load-bearing answer ⇒ it
  lands as an event (the facet discipline).

## 3. How it generalises Nadia's one-off validation

Nadia's review answered "is the SA-CCR model sound, and do I sign off?" — once, by hand.
The harness turns the *mechanical* half of that — "does the subject still satisfy its
specified invariants?" — into a replayable battery the bank runs on EVERY change. The
exam-set IS the codified standard: the invariants Nadia checked once (RC = max(V−C,0),
EAD = 1.4×(RC+PFE), PFE-add-on monotonicity, latest-per-trade MtM) are now typed exams that
re-run deterministically and whose verdicts are auditable events.

## 4. Composition with the independent-validation plane (CRITICAL)

The harness is the **systematic substrate**; it does NOT replace Nadia's independent model
validation. The two planes COMPOSE — they do not collapse:

| Plane | Question | Form |
|---|---|---|
| Systematic gate (S13) | Does the subject still satisfy its specified invariants? | \`evaluateChangeGate\` over a passing \`EvalRunCompleted\` |
| Independent gate (Nadia) | Is the specification itself sound; do I, third-line, sign off on production use? | \`ModelValidationApproved\` / FIL-Model \`validationStatus = "validation-approved"\` |

A change is **adoptable iff BOTH planes clear**. \`evaluateChangeGate(...)\` exposes the
systematic plane and records the independent sign-off as a REQUIRED-BUT-EXTERNAL precondition
(\`independentSignOff\`) it never itself satisfies: \`adoptable = systematicCleared AND
independentSignOff === true\`. The gate is provided + piloted on SA-CCR; it is NOT retrofitted
into every existing model/posture change path this slice (brief §"Out of scope").

## 5. Composition with the W8 disposal path

W8 weights MAY propose a subject change (a FIL-Model adoption — a \`validationStatus\`
transition — or a posture activation). The disposal path CAN call \`evaluateChangeGate\` to
gate the change on a passing eval of the subject's exam-set before accepting it. The S9
decision-impact sweep already surfaces WHICH artefacts a decision touches; S13 is the
complementary "does the touched subject still pass its exams?" gate. Structured-first
throughout: weights propose, exams + independent validation dispose.

## 6. The SA-CCR pilot — the REAL result

The pilot exam-set (\`examset:sa-ccr\`, v1.0, 6 exams) is run by a subject adapter that
drives the **v2-native** \`computeSaCcr\` methodology (no v1 import — \`recon:v2-no-v1-import\`
stays green). The harness runs it for real (not a stubbed green):

| Exam | Asserts | Result |
|---|---|---|
| exam:sa-ccr:rc-floor-vminusc | RC = max(V−C, MTA+TH, 0) — the V−C reading (margined) | PASS |
| exam:sa-ccr:rc-non-negative | RC floored at 0 on adverse MtM | PASS |
| exam:sa-ccr:ead-alpha-composition | EAD = 1.4 × (RC + PFE) | PASS |
| exam:sa-ccr:ead-at-least-rc | EAD ≥ RC (α ≥ 1, PFE ≥ 0) | PASS |
| exam:sa-ccr:pfe-addon-monotonic | aggregated PFE add-on non-decreasing in notional | PASS |
| exam:sa-ccr:latest-per-trade-mtm | netting-set MtM = Σ latest-mark-per-trade (the v1 defect) | PASS |

**Verdict: passed (6/6).** The seed (\`scripts/seed-v2-saccr-exam-set.ts\`) is idempotent:
it registers the exam-set + emits the \`EvalRunCompleted\` verdict, skipping if already
recorded for the same (examSetId, version) + (examSetId, as-of date).

## 7. Recon gate

\`recon:v2-eval-harness-integrity\` (wired into \`ci:recon:infra\`, advisory in S13) asserts:

1. Every \`EvalRunCompleted\` references a REGISTERED exam-set (same id; version mismatch = warn).
2. Every registered exam-set is WELL-FORMED.
3. ENGINE-CONSISTENCY: for a reconstructable subject (the SA-CCR pilot), re-running the
   harness reproduces the recorded verdict + per-exam outcomes. A non-reproducible verdict
   is a hard error (the eval is not replayable — Principle 1 for the assurance plane).
4. Verdict counts are internally consistent (passed + failed == run; verdict matches counts).

## 8. Package boundary

All eval types live in \`v2-core/eval/\` (no v1 imports). The v1-side adapter
(\`platform/event-store/event-types/v2-eval.ts\`) imports FROM \`v2-core\` — the permitted
direction. The \`recon:v2-no-v1-import\` gate enforces the boundary; the SA-CCR adapter
drives the v2-native methodology, so the pilot is REAL without crossing it.

## 9. Substrate gaps (tracked, not hidden)

- **Subject reconstruction in recon is hard-coded to the SA-CCR pilot.** Engine-consistency
  re-runs only subjects the recon can rebuild (currently SA-CCR). Posture / agent-behaviour
  subjects are skipped (advisory warn) until their adapters land. A subject-adapter REGISTRY
  (so the recon can reconstruct any registered subject) is the natural S13+1 follow-on.
- **The change-gate is provided + piloted, not wired into live disposal paths.** Per brief
  scope. Retrofitting it into the FIL-Model adoption + posture activation paths is a separate
  slice.
- **Agent-behaviour exams are a token kind only.** The pilot focuses on the FIL-Model
  exam-set; the agent-behaviour exam vocabulary is declared but unexercised.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-W4-MODEL-LIBRARY-PILOT",
      "D-W8-POSTURE-REGISTER-SLICE-1",
      "D-RMS-PHASE-3",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:vera:internal-audit-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S13 — exam-set + eval harness: design note",
      path: "2026-06-13_vera_v2-s13-eval-harness-design-note.md",
      category: "design-note",
      author: "Vera (Internal Audit Engineer, governance)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
