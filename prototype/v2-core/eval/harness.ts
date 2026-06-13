// v2-core/eval/harness.ts
//
// V2 S13 — the EVAL HARNESS: `runEval(subject, examSet) → EvalResult`.
//
// The harness is SUBJECT-AGNOSTIC and PURE. A `subject` is an adapter — a
// function that, given an exam's scenario, returns an `ObservedOutput` (a flat
// record of named fields). The harness evaluates each exam's `expectation`
// against the named field the subject reports, producing a per-exam pass/fail
// and an overall verdict. The adapter — not the harness — owns the binding to
// the actual subject under test (a FIL-Model's pure compute, a posture's
// scope-evaluation, an agent behaviour). This is what keeps the harness
// v1-import-free: the SA-CCR adapter calls the v2-native `computeSaCcr` (no v1),
// and any v1-side subject would be wrapped by a v1-side adapter that depends on
// the harness (the permitted v1→v2 direction), never the reverse.
//
// Determinism: `runEval` performs NO IO, reads no clock, and is a pure function
// of (subject, examSet). The same (subject, examSet) re-run yields a byte-equal
// EvalResult — the property the integrity recon asserts (engine-consistency).
//
// PACKAGE BOUNDARY: no v1 imports. Imports restricted to `zod` (none needed
// here) and intra-package relatives.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT.
// Principle 1 (the eval is a load-bearing answer ⇒ an event-of-record).
// Author: Vera (Internal Audit Engineer, governance).

import type { Exam, ExamExpectation, ExamSet } from "./exam";
import { checkExamSetWellFormed } from "./exam";

// ---------------------------------------------------------------------------
// Subject contract
// ---------------------------------------------------------------------------

/** A flat record of named output fields the subject reports for a scenario. */
export type ObservedOutput = Readonly<Record<string, unknown>>;

/**
 * A subject-under-test. Given an exam's scenario, the adapter runs the subject
 * and returns the named fields the exams assert against. Pure where the subject
 * allows (the SA-CCR adapter is a pure call into `computeSaCcr`).
 *
 *   subjectKind / subjectScope — the adapter's identity; the harness refuses to
 *     run an exam-set whose subjectScope does not match (a mis-wired eval is a
 *     hard error, never a silent green).
 *   observe(exam) — run the subject over the exam's scenario, return the output.
 */
export interface EvalSubject {
  readonly subjectKind: ExamSet["subjectKind"];
  readonly subjectScope: string;
  observe(exam: Exam): ObservedOutput;
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

/** The overall verdict of an eval run. */
export type EvalVerdict = "passed" | "failed" | "passed-with-findings";

/** Per-exam outcome. */
export interface ExamResult {
  readonly examId: string;
  readonly passed: boolean;
  /** Why the exam failed (null when passed). */
  readonly detail: string | null;
  /** The field the expectation read + the observed value, for audit. */
  readonly observedField: string;
  readonly observedValue: unknown;
}

/** The full eval result — the payload of the `EvalRunCompleted` event. */
export interface EvalResult {
  readonly examSetId: string;
  readonly examSetVersion: string;
  readonly subjectKind: ExamSet["subjectKind"];
  readonly subjectScope: string;
  readonly verdict: EvalVerdict;
  readonly examResults: readonly ExamResult[];
  readonly examsRun: number;
  readonly examsPassed: number;
  readonly examsFailed: number;
}

// ---------------------------------------------------------------------------
// Expectation evaluation
// ---------------------------------------------------------------------------

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return null;
}

/**
 * Evaluate a single expectation against the observed output. Returns `null` on
 * pass, or a human-readable failure detail. A field the subject did not report
 * is a hard failure (never silently treated as a pass).
 */
function evaluateExpectation(exp: ExamExpectation, observed: ObservedOutput): string | null {
  const value = observed[exp.field];
  if (value === undefined) {
    return `subject did not report field '${exp.field}'`;
  }

  switch (exp.kind) {
    case "equals": {
      // Primitive deep-equal (JSON) — sufficient for the structural fields the
      // exam vocabulary targets.
      const ok = JSON.stringify(value) === JSON.stringify(exp.value);
      return ok
        ? null
        : `expected ${exp.field} === ${JSON.stringify(exp.value)}, got ${JSON.stringify(value)}`;
    }
    case "numeric-equals": {
      const n = asFiniteNumber(value);
      if (n === null)
        return `field '${exp.field}' is not a finite number: ${JSON.stringify(value)}`;
      const ok = Math.abs(n - exp.value) <= exp.tolerance;
      return ok ? null : `expected ${exp.field} ≈ ${exp.value} (±${exp.tolerance}), got ${n}`;
    }
    case "at-least": {
      const n = asFiniteNumber(value);
      if (n === null)
        return `field '${exp.field}' is not a finite number: ${JSON.stringify(value)}`;
      return n >= exp.value ? null : `expected ${exp.field} ≥ ${exp.value}, got ${n}`;
    }
    case "at-most": {
      const n = asFiniteNumber(value);
      if (n === null)
        return `field '${exp.field}' is not a finite number: ${JSON.stringify(value)}`;
      return n <= exp.value ? null : `expected ${exp.field} ≤ ${exp.value}, got ${n}`;
    }
    case "monotonic-nondecreasing": {
      if (!Array.isArray(value)) {
        return `field '${exp.field}' must be a numeric series (array), got ${JSON.stringify(value)}`;
      }
      const series: number[] = [];
      for (const el of value) {
        const n = asFiniteNumber(el);
        if (n === null)
          return `field '${exp.field}' series contains a non-number: ${JSON.stringify(el)}`;
        series.push(n);
      }
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1] as number;
        const cur = series[i] as number;
        if (cur < prev) {
          return `field '${exp.field}' not monotonic non-decreasing at index ${i}: ${prev} → ${cur}`;
        }
      }
      return null;
    }
    case "invariant-holds": {
      if (value !== true) {
        return `expected invariant '${exp.field}' to hold (true), got ${JSON.stringify(value)}`;
      }
      return null;
    }
    default: {
      const exhaustive: never = exp;
      return `unknown expectation kind ${JSON.stringify(exhaustive)}`;
    }
  }
}

// ---------------------------------------------------------------------------
// runEval — the harness entry point
// ---------------------------------------------------------------------------

/**
 * Run an exam-set against a subject.
 *
 * Hard preconditions (throw — a mis-wired eval must never produce a silent
 * verdict):
 *   - the exam-set must be well-formed (schema + intra-set consistency),
 *   - the subject's subjectKind / subjectScope must match the exam-set's.
 *
 * Verdict policy:
 *   - all exams pass                          → "passed"
 *   - any exam fails                          → "failed"
 *   - (reserved) zero exams + non-fatal notes → "passed-with-findings"
 * The `passed-with-findings` verdict is exposed for the change-gate's policy
 * layer (e.g. a posture eval that passes its hard exams but raises advisory
 * findings); S13 SA-CCR exams are all hard, so the pilot resolves to
 * passed/failed.
 */
export function runEval(subject: EvalSubject, examSet: ExamSet): EvalResult {
  const wellFormed = checkExamSetWellFormed(examSet);
  if (wellFormed.length > 0) {
    throw new Error(
      `runEval: exam-set '${examSet.examSetId}' is not well-formed: ${wellFormed
        .map((f) => f.message)
        .join("; ")}`,
    );
  }
  if (subject.subjectKind !== examSet.subjectKind) {
    throw new Error(
      `runEval: subject kind '${subject.subjectKind}' != exam-set kind '${examSet.subjectKind}'`,
    );
  }
  if (subject.subjectScope !== examSet.subjectScope) {
    throw new Error(
      `runEval: subject scope '${subject.subjectScope}' != exam-set scope '${examSet.subjectScope}'`,
    );
  }

  const examResults: ExamResult[] = [];
  for (const exam of examSet.exams) {
    let detail: string | null;
    let observedValue: unknown;
    try {
      const observed = subject.observe(exam);
      observedValue = observed[exam.expectation.field];
      detail = evaluateExpectation(exam.expectation, observed);
    } catch (err) {
      detail = `subject.observe threw: ${(err as Error).message}`;
      observedValue = undefined;
    }
    examResults.push({
      examId: exam.examId,
      passed: detail === null,
      detail,
      observedField: exam.expectation.field,
      observedValue,
    });
  }

  const examsPassed = examResults.filter((r) => r.passed).length;
  const examsFailed = examResults.length - examsPassed;
  const verdict: EvalVerdict = examsFailed > 0 ? "failed" : "passed";

  return {
    examSetId: examSet.examSetId,
    examSetVersion: examSet.version,
    subjectKind: examSet.subjectKind,
    subjectScope: examSet.subjectScope,
    verdict,
    examResults,
    examsRun: examResults.length,
    examsPassed,
    examsFailed,
  };
}
