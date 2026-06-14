// scripts/seed-v2-posture-exam-set.ts
//
// V2 S13 (W8 Slice B) pilot seed: register the FX VaR posture exam-set + run the
// eval harness over the LIVE posture register, emitting the typed events-of-record.
//
//   ExamSetRegistered  — the posture pilot exam-set enters the assurance corpus.
//                        registeredBy = Helena (Chief Risk Officer, governance) —
//                        D-W8-EXAM-GOVERNANCE assigns posture exam-set ownership
//                        to the CRO.
//   EvalRunCompleted   — the verdict-of-record from running the harness over the
//                        v2-native posture subject (the REAL eval — the adapter
//                        drives the live posture register's scope-evaluation, it
//                        does not stub a green).
//
// The subject posture `posture:risk-appetite:fx-var` is seeded by
// `scripts/seed-v2-helena-ras-postures.ts` (or the existing RAS seed). This
// script folds the live posture register from the event store and runs the
// pilot exam-set against it.
//
// Idempotent: re-running when the exam-set (same examSetId + version) is already
// registered AND an eval run already exists for the same (examSetId, as-of date)
// is a no-op. A new exam-set version or a new run-date emits a fresh pair.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-posture-exam-set.ts
//
// Authority: D-W8-EXAM-GOVERNANCE; D-W8-POSTURE-REGISTER-SLICE-1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RAS. Principle 1 (events are truth).
// Author: Vera (Internal Audit Engineer, governance), exam standard;
//         owner Helena (Chief Risk Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makeEvalRunCompleted,
  makeExamSetRegistered,
} from "../platform/event-store/event-types/v2-eval";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  POSTURE_EXAM_SET_OWNER,
  POSTURE_PILOT_EXAM_SET,
  evalRunCompletedFromResult,
  makePostureEvalSubject,
  runEval,
} from "../v2-core/eval";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";
import { foldPostureRegister } from "../v2-core/posture/projection";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:vera:internal-audit-engineer" };

const CITATIONS = [
  "D-W8-EXAM-GOVERNANCE",
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-RAS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// Integrity anchor for the posture subject under test: the subject's identity is
// fully determined by the postureId + the folded register, so a stable scope tag
// is the auditable anchor (the register itself is event-replayable — Principle 1).
const POSTURE_SUBJECT_HASH = `posture-subject:${POSTURE_PILOT_EXAM_SET.subjectScope}`;

const asOf = clock.now();
const asOfDate = asOf.slice(0, 10);
const examSet = POSTURE_PILOT_EXAM_SET;

// ---------------------------------------------------------------------------
// Fold the LIVE posture register from events.
// ---------------------------------------------------------------------------

const postureEvents: unknown[] = [];
for (const kind of [
  "PostureRegistered",
  "PostureActivated",
  "PostureDeactivated",
  "PostureRevised",
] as const) {
  for (const ev of eventStore.replay({ type: kind })) {
    const p = (ev as { payload: Record<string, unknown> }).payload;
    postureEvents.push({ kind, ...p });
  }
}
const register = foldPostureRegister(postureEvents);

const subjectPosture = register.getPosture(examSet.subjectScope);
if (subjectPosture === null) {
  process.stderr.write(
    `seed:v2-posture-exam-set — subject posture '${examSet.subjectScope}' not found in the live register. Run scripts/seed-v2-helena-ras-postures.ts first.\n`,
  );
  process.exit(1);
}

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
// Run the harness — the REAL eval over the live posture register.
// ---------------------------------------------------------------------------

const result = runEval(makePostureEvalSubject(examSet.subjectScope, register), examSet);
process.stdout.write(
  `seed:v2-posture-exam-set — eval verdict: ${result.verdict} ` +
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
        registeredBy: POSTURE_EXAM_SET_OWNER,
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
    subjectHash: POSTURE_SUBJECT_HASH,
    ranBy: "seed:v2-posture-exam-set",
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
    "seed:v2-posture-exam-set — nothing to emit (exam-set + eval run already recorded)\n",
  );
  process.exit(0);
}

for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit(ev.type) });
}

process.stdout.write(`seed:v2-posture-exam-set — emitted ${batch.length} event(s)\n`);
