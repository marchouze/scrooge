// platform/recon/v2-eval-harness-integrity.ts
//
// `recon:v2-eval-harness-integrity` — the integrity gate for the V2 S13 eval
// harness (the assurance / eval plane).
//
// ADVISORY in S13 (exits 0 unless a HARD structural error is found). Becomes
// enforcing-ready as the eval corpus grows.
//
// Assertions:
//   1. Every `EvalRunCompleted` references a REGISTERED exam-set (an
//      `ExamSetRegistered` with the same examSetId exists; ideally the same
//      version). An eval verdict over an unregistered set is a hard error
//      (a verdict with no auditable standard behind it).
//   2. Every registered exam-set is WELL-FORMED (schema + intra-set
//      consistency — each exam has a scenario + expectation + citation, kinds
//      and scopes agree, examIds unique).
//   3. ENGINE-CONSISTENCY: for an eval run whose subject the recon can
//      reconstruct (the SA-CCR pilot), re-running the harness over the
//      registered exam-set reproduces the RECORDED verdict + per-exam outcomes.
//      A recorded verdict that does not reproduce is a hard error (the eval is
//      not replayable — Principle 1 violated for the assurance plane). Runs
//      whose subject is not reconstructable here are skipped (advisory note).
//   4. The verdict counts on each run are internally consistent
//      (examsPassed + examsFailed == examsRun; verdict matches the counts).
//
// WHY THIS GATE IS V1-SIDE: it needs `node:fs` + the event store + the recon
// `types` — all v1 infrastructure. The dependency direction v1→v2 is the
// permitted one (v2-core imports nothing from v1).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1. Principle 1 (the eval is replayable).
// Author: Vera (Internal Audit Engineer, governance).

import { checkExamSetWellFormed } from "../../v2-core/eval/exam";
import { runEval } from "../../v2-core/eval/harness";
import { SA_CCR_PILOT_EXAM_SET, makeSaCcrEvalSubject } from "../../v2-core/eval/sa-ccr-exam-set";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

interface RegisteredExamSet {
  readonly examSetId: string;
  readonly version: string;
  readonly examSet: unknown;
}

interface RecordedEvalRun {
  readonly evalRunId: string;
  readonly examSetId: string;
  readonly examSetVersion: string;
  readonly subjectScope: string;
  readonly verdict: string;
  readonly examOutcomes: ReadonlyArray<{ examId: string; passed: boolean }>;
  readonly examsRun: number;
  readonly examsPassed: number;
  readonly examsFailed: number;
}

function readRegisteredExamSets(): RegisteredExamSet[] {
  const out: RegisteredExamSet[] = [];
  for (const ev of eventStore.replay({ type: "ExamSetRegistered" })) {
    const p = (ev as { payload: Record<string, unknown> }).payload;
    const examSet = p.examSet as { version?: string } | undefined;
    out.push({
      examSetId: String(p.examSetId ?? ""),
      version: String(examSet?.version ?? ""),
      examSet: p.examSet,
    });
  }
  return out;
}

function readEvalRuns(): RecordedEvalRun[] {
  const out: RecordedEvalRun[] = [];
  for (const ev of eventStore.replay({ type: "EvalRunCompleted" })) {
    const p = (ev as { payload: Record<string, unknown> }).payload;
    out.push({
      evalRunId: String(p.evalRunId ?? ""),
      examSetId: String(p.examSetId ?? ""),
      examSetVersion: String(p.examSetVersion ?? ""),
      subjectScope: String(p.subjectScope ?? ""),
      verdict: String(p.verdict ?? ""),
      examOutcomes: Array.isArray(p.examOutcomes)
        ? (p.examOutcomes as Array<{ examId: string; passed: boolean }>)
        : [],
      examsRun: Number(p.examsRun ?? 0),
      examsPassed: Number(p.examsPassed ?? 0),
      examsFailed: Number(p.examsFailed ?? 0),
    });
  }
  return out;
}

/**
 * Reconstructable subjects the recon can re-run for engine-consistency. Keyed by
 * (examSetId → {subject factory, the in-repo exam-set}). At S13 the SA-CCR pilot
 * is the only reconstructable subject; agent-behaviour / posture subjects are
 * skipped (advisory) until their adapters land.
 */
const RECONSTRUCTABLE = new Map<
  string,
  { subject: () => ReturnType<typeof makeSaCcrEvalSubject>; examSet: typeof SA_CCR_PILOT_EXAM_SET }
>([
  [
    SA_CCR_PILOT_EXAM_SET.examSetId,
    { subject: makeSaCcrEvalSubject, examSet: SA_CCR_PILOT_EXAM_SET },
  ],
]);

export function run(): ReconResult {
  const result = emptyResult("v2-eval-harness-integrity");
  const violations: ReconViolation[] = [];

  let registered: RegisteredExamSet[];
  let runs: RecordedEvalRun[];
  try {
    registered = readRegisteredExamSets();
    runs = readEvalRuns();
  } catch (err) {
    violations.push({
      subject: "v2-eval-harness",
      message: `failed to read eval events: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  const registeredById = new Map(registered.map((r) => [r.examSetId, r]));

  // Assertion 2 — every registered exam-set is well-formed.
  for (const r of registered) {
    result.asserted += 1;
    const findings = checkExamSetWellFormed(r.examSet);
    for (const f of findings) {
      violations.push({
        subject: r.examSetId,
        message: `registered exam-set not well-formed: ${f.message}`,
        severity: "fail",
      });
    }
  }

  for (const run of runs) {
    // Assertion 1 — the run references a registered exam-set.
    result.asserted += 1;
    const reg = registeredById.get(run.examSetId);
    if (reg === undefined) {
      violations.push({
        subject: run.evalRunId,
        message: `EvalRunCompleted references unregistered exam-set '${run.examSetId}' — run scripts/seed-v2-saccr-exam-set.ts`,
        severity: "fail",
      });
    } else if (reg.version !== run.examSetVersion) {
      violations.push({
        subject: run.evalRunId,
        message: `eval run exam-set version '${run.examSetVersion}' != registered version '${reg.version}'`,
        severity: "warn",
      });
    }

    // Assertion 4 — verdict counts internally consistent.
    result.asserted += 1;
    if (run.examsPassed + run.examsFailed !== run.examsRun) {
      violations.push({
        subject: run.evalRunId,
        message: `verdict counts inconsistent: ${run.examsPassed} + ${run.examsFailed} != ${run.examsRun}`,
        severity: "fail",
      });
    }
    const verdictMatchesCounts =
      (run.verdict === "passed" && run.examsFailed === 0) ||
      (run.verdict === "passed-with-findings" && run.examsFailed === 0) ||
      (run.verdict === "failed" && run.examsFailed > 0);
    if (!verdictMatchesCounts) {
      violations.push({
        subject: run.evalRunId,
        message: `verdict '${run.verdict}' inconsistent with ${run.examsFailed} failed exam(s)`,
        severity: "fail",
      });
    }

    // Assertion 3 — engine-consistency: re-run reproduces the recorded verdict.
    const reconstructable = RECONSTRUCTABLE.get(run.examSetId);
    if (reconstructable === undefined) {
      violations.push({
        subject: run.evalRunId,
        message: `subject for exam-set '${run.examSetId}' not reconstructable in recon — engine-consistency skipped (advisory)`,
        severity: "warn",
      });
      continue;
    }
    result.asserted += 1;
    let rerunVerdict: string;
    let rerunOutcomes: Map<string, boolean>;
    try {
      const rerun = runEval(reconstructable.subject(), reconstructable.examSet);
      rerunVerdict = rerun.verdict;
      rerunOutcomes = new Map(rerun.examResults.map((r) => [r.examId, r.passed]));
    } catch (err) {
      violations.push({
        subject: run.evalRunId,
        message: `engine-consistency re-run threw: ${(err as Error).message}`,
        severity: "fail",
      });
      continue;
    }
    if (rerunVerdict !== run.verdict) {
      violations.push({
        subject: run.evalRunId,
        message: `engine-consistency FAIL: recorded verdict '${run.verdict}' but re-run yields '${rerunVerdict}' — the eval is not reproducible`,
        severity: "fail",
      });
    }
    for (const outcome of run.examOutcomes) {
      const rerunPassed = rerunOutcomes.get(outcome.examId);
      if (rerunPassed === undefined) {
        violations.push({
          subject: `${run.evalRunId}/${outcome.examId}`,
          message: `recorded exam '${outcome.examId}' absent from re-run — exam-set drift`,
          severity: "fail",
        });
      } else if (rerunPassed !== outcome.passed) {
        violations.push({
          subject: `${run.evalRunId}/${outcome.examId}`,
          message: `engine-consistency FAIL: exam '${outcome.examId}' recorded passed=${outcome.passed}, re-run passed=${rerunPassed}`,
          severity: "fail",
        });
      }
    }
  }

  return {
    ...result,
    violations,
    ok: violations.filter((v) => v.severity === "fail").length === 0,
  };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const totalViolations = r.violations.length;
  const failViolations = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:v2-eval-harness-integrity — asserted ${r.asserted} checks; ` +
      `${totalViolations} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
