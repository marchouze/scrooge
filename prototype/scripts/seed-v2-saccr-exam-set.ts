// scripts/seed-v2-saccr-exam-set.ts
//
// V2 S13 pilot seed: register the SA-CCR exam-set + run the eval harness over
// the v2-native SA-CCR FIL-Model, emitting the typed events-of-record.
//
//   ExamSetRegistered  — the SA-CCR pilot exam-set enters the assurance corpus.
//   EvalRunCompleted   — the verdict-of-record from running the harness over
//                        the v2-native `computeSaCcr` (the REAL eval — the
//                        adapter drives the model, it does not stub a green).
//
// Idempotent: re-running when the exam-set (same examSetId + version) is already
// registered AND an eval run already exists for the same (examSetId, as-of date)
// is a no-op. A new exam-set version or a new run-date emits a fresh pair.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-saccr-exam-set.ts
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1. Principle 1 (events are truth).
// Author: Vera (Internal Audit Engineer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makeEvalRunCompleted,
  makeExamSetRegistered,
} from "../platform/event-store/event-types/v2-eval";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  SA_CCR_PILOT_EXAM_SET,
  SA_CCR_SUBJECT_HASH,
  evalRunCompletedFromResult,
  makeSaCcrEvalSubject,
  runEval,
} from "../v2-core/eval";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:vera:internal-audit-engineer" };

const CITATIONS = [
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-W4-MODEL-LIBRARY-PILOT",
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "BCBS-SA-CCR-CRE52",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

const asOf = clock.now();
const asOfDate = asOf.slice(0, 10);
const examSet = SA_CCR_PILOT_EXAM_SET;

// ---------------------------------------------------------------------------
// Idempotency probes.
// ---------------------------------------------------------------------------

let examSetAlreadyRegistered = false;
for (const ev of eventStore.replay({ type: "ExamSetRegistered" })) {
  const p = ev.payload as { examSetId?: string; examSet?: { version?: string } };
  if (p.examSetId === examSet.examSetId && p.examSet?.version === examSet.version) {
    examSetAlreadyRegistered = true;
  }
}

const evalRunId = `eval:${examSet.examSetId}:${asOfDate}`;
let evalRunAlreadyExists = false;
for (const ev of eventStore.replay({ type: "EvalRunCompleted" })) {
  const p = ev.payload as { evalRunId?: string };
  if (p.evalRunId === evalRunId) evalRunAlreadyExists = true;
}

// ---------------------------------------------------------------------------
// Run the harness — the REAL eval over the v2-native SA-CCR model.
// ---------------------------------------------------------------------------

const result = runEval(makeSaCcrEvalSubject(), examSet);
process.stdout.write(
  `seed:v2-saccr-exam-set — eval verdict: ${result.verdict} ` +
    `(${result.examsPassed}/${result.examsRun} passed)\n`,
);
for (const r of result.examResults) {
  process.stdout.write(
    `  [${r.passed ? "pass" : "FAIL"}] ${r.examId}${r.detail ? ` — ${r.detail}` : ""}\n`,
  );
}

const batch: Event[] = [];

if (examSetAlreadyRegistered) {
  process.stdout.write(
    `[skip] exam-set ${examSet.examSetId}@${examSet.version} — already registered\n`,
  );
} else {
  batch.push(
    makeExamSetRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        examSetId: examSet.examSetId,
        examSet,
        registeredBy: "Vera (Internal Audit Engineer, governance)",
        registeredAt: asOf as unknown as Instant,
        citations: CITATIONS as unknown as CitationRef[],
      },
    }),
  );
  process.stdout.write(`[queue] ExamSetRegistered ${examSet.examSetId}@${examSet.version}\n`);
}

if (evalRunAlreadyExists) {
  process.stdout.write(`[skip] eval run ${evalRunId} — already recorded for ${asOfDate}\n`);
} else {
  const payload = evalRunCompletedFromResult({
    result,
    subjectHash: SA_CCR_SUBJECT_HASH,
    ranBy: "seed:v2-saccr-exam-set",
    ranAt: asOf as unknown as Instant,
    citations: CITATIONS as unknown as CitationRef[],
    evalRunId,
  });
  batch.push(
    makeEvalRunCompleted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    }),
  );
  process.stdout.write(`[queue] EvalRunCompleted ${evalRunId} — verdict ${result.verdict}\n`);
}

if (batch.length === 0) {
  process.stdout.write(
    "seed:v2-saccr-exam-set — nothing to emit (exam-set + eval run already recorded)\n",
  );
  process.exit(0);
}

for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit(ev.type) });
}

process.stdout.write(`seed:v2-saccr-exam-set — emitted ${batch.length} event(s)\n`);
