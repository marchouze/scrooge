// v2-core/eval/exam.ts
//
// V2 S13 — the exam-set REGISTER (the assurance corpus).
//
// An EXAM is a single typed assertion a subject must satisfy: a scenario
// (typed input), an expectation (the invariant / expected outcome the subject
// must produce when run over that scenario), a subjectKind, and a Principle-2
// upward citation. Exams are GROUPED into named exam-sets — one exam-set per
// subject (a FIL-Model, a posture, an agent behaviour).
//
// This generalises Nadia's (Model-validation engineer, governance) one-off
// hand-authored SA-CCR validation (#1299) into a typed, replayable corpus: the
// exam-set is event-sourced (an `ExamRegistered`-class family, registered
// v1-side), not a static fixture, so the standard the bank assures models
// against is itself a query over the event log (Principle 1).
//
// Vera (Internal Audit Engineer, governance) owns the exam content/standard.
//
// PACKAGE BOUNDARY: no v1 imports permitted. The exam-set is a pure shape; the
// v1-side registers `ExamRegistered` in the live event-type registry
// (`platform/event-store/event-types/v2-eval.ts`) the same way posture / FIL-
// model events are registered (v1→v2 only).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W8-POSTURE-REGISTER-SLICE-1;
//   D-W4-MODEL-LIBRARY-PILOT. Principle 1 (events are truth); Principle 2
//   (single-graph discipline — every exam carries an upward citation).
// Author: Vera (Internal Audit Engineer, governance).

import { z } from "zod";
import { type CitationRef, citationRefSchema } from "../fil-core/primitives";

// ---------------------------------------------------------------------------
// Subject kinds
// ---------------------------------------------------------------------------

/**
 * The closed set of subject kinds an exam can target at S13. A FIL-Model
 * (e.g. SA-CCR), a posture (a W8 risk-appetite / procedure-variant stance), or
 * an agent behaviour (token example at S13 — the focus is the FIL-Model pilot).
 */
export const EXAM_SUBJECT_KINDS = ["fil-model", "posture", "agent-behaviour"] as const;
export type ExamSubjectKind = (typeof EXAM_SUBJECT_KINDS)[number];
export const examSubjectKindSchema = z.enum(EXAM_SUBJECT_KINDS);

// ---------------------------------------------------------------------------
// Expectation predicates — the closed, kernel-evaluable assertion vocabulary
// ---------------------------------------------------------------------------

/**
 * The closed set of expectation predicates the harness can evaluate against a
 * subject's observed output. Kept deliberately small and structural: the
 * harness compares a NAMED OUTPUT FIELD the subject reports against a target.
 *
 *   numeric-equals    — |observed[field] − value| ≤ tolerance (numeric).
 *   at-least          — observed[field] ≥ value.
 *   at-most           — observed[field] ≤ value.
 *   equals            — observed[field] === value (primitive deep-equal).
 *   monotonic-nondecreasing
 *                     — the subject reports `field` as a numeric SERIES (array);
 *                       it must be non-decreasing across its elements (a
 *                       monotonicity property over a swept scenario).
 *   invariant-holds   — the subject reports `field` as a boolean that must be
 *                       true (a self-asserted invariant — e.g. RC = max(V−C,0)).
 *
 * Each predicate names the output `field` the subject (via its adapter) must
 * surface. The harness never reaches into the subject's internals — it reads
 * the named field off the observed-output record the adapter returns.
 */
export type ExamExpectation =
  | { readonly kind: "equals"; readonly field: string; readonly value: unknown }
  | {
      readonly kind: "numeric-equals";
      readonly field: string;
      readonly value: number;
      readonly tolerance: number;
    }
  | { readonly kind: "at-least"; readonly field: string; readonly value: number }
  | { readonly kind: "at-most"; readonly field: string; readonly value: number }
  | { readonly kind: "monotonic-nondecreasing"; readonly field: string }
  | { readonly kind: "invariant-holds"; readonly field: string };

export const examExpectationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("equals"), field: z.string().min(1), value: z.unknown() }),
  z.object({
    kind: z.literal("numeric-equals"),
    field: z.string().min(1),
    value: z.number(),
    tolerance: z.number().nonnegative(),
  }),
  z.object({ kind: z.literal("at-least"), field: z.string().min(1), value: z.number() }),
  z.object({ kind: z.literal("at-most"), field: z.string().min(1), value: z.number() }),
  z.object({ kind: z.literal("monotonic-nondecreasing"), field: z.string().min(1) }),
  z.object({ kind: z.literal("invariant-holds"), field: z.string().min(1) }),
]);

// ---------------------------------------------------------------------------
// Exam — a single typed assertion
// ---------------------------------------------------------------------------

/**
 * A single exam.
 *
 *   examId       — stable slug; convention `exam:<subject-slug>:<short-slug>`.
 *   subjectKind  — fil-model | posture | agent-behaviour.
 *   subjectScope — the subject identity the exam targets (e.g. a model id or a
 *                  postureId). The harness checks the subject it is asked to
 *                  evaluate matches this scope.
 *   scenario     — typed input handed to the subject (opaque to the kernel; its
 *                  shape is the subject adapter's contract).
 *   expectation  — the assertion the subject's observed output must satisfy.
 *   citation     — Principle-2 upward citation (the provision / methodology the
 *                  exam asserts conformance to).
 *   description  — human-readable statement of what the exam asserts.
 */
export interface Exam {
  readonly examId: string;
  readonly subjectKind: ExamSubjectKind;
  readonly subjectScope: string;
  readonly scenario: Readonly<Record<string, unknown>>;
  readonly expectation: ExamExpectation;
  readonly citation: CitationRef;
  readonly description: string;
  /** True if this exam is adversarial — a known-failure / negative-invariant scenario.
   * D-W8-EXAM-GOVERNANCE mandates ≥1 adversarial exam per exam-set. */
  readonly adversarial?: boolean;
}

export const examSchema = z.object({
  examId: z.string().min(1),
  subjectKind: examSubjectKindSchema,
  subjectScope: z.string().min(1),
  scenario: z.record(z.unknown()),
  expectation: examExpectationSchema,
  citation: citationRefSchema,
  description: z.string().min(1),
  adversarial: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// ExamSet — a named group of exams for a single subject
// ---------------------------------------------------------------------------

/**
 * A named exam-set: the battery a single subject must pass.
 *
 *   examSetId    — stable slug; convention `examset:<subject-slug>`.
 *   subjectKind  — the kind of subject this set evaluates (all exams must agree).
 *   subjectScope — the subject identity the set targets.
 *   exams        — the ordered, non-empty list of exams.
 *   version      — the exam-set version (the standard evolves; the version is
 *                  recorded on the EvalRunCompleted event for reproducibility).
 *   citations    — Principle-2 upward citations for the set as a whole.
 */
export interface ExamSet {
  readonly examSetId: string;
  readonly subjectKind: ExamSubjectKind;
  readonly subjectScope: string;
  readonly exams: readonly Exam[];
  readonly version: string;
  readonly citations: readonly CitationRef[];
}

export const examSetSchema = z.object({
  examSetId: z.string().min(1),
  subjectKind: examSubjectKindSchema,
  subjectScope: z.string().min(1),
  exams: z.array(examSchema).min(1),
  version: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// Well-formedness
// ---------------------------------------------------------------------------

/** A well-formedness finding for an exam-set (structural validity). */
export interface ExamSetWellFormednessFinding {
  readonly examSetId: string;
  readonly kind: string;
  readonly message: string;
  readonly severity: "error" | "warn";
}

/**
 * Verify an exam-set is well-formed (the recon engine-consistency precondition):
 *   - parses against the schema (every exam has a scenario + expectation + citation),
 *   - every exam's subjectKind matches the set's subjectKind,
 *   - every exam's subjectScope matches the set's subjectScope,
 *   - examIds are unique within the set.
 * Returns the list of findings (empty ⇒ well-formed).
 */
export function checkExamSetWellFormed(raw: unknown): ExamSetWellFormednessFinding[] {
  const findings: ExamSetWellFormednessFinding[] = [];
  const parsed = examSetSchema.safeParse(raw);
  if (!parsed.success) {
    const id =
      raw !== null && typeof raw === "object" && "examSetId" in raw
        ? String((raw as { examSetId: unknown }).examSetId)
        : "<unparseable>";
    findings.push({
      examSetId: id,
      kind: "schema-parse-failure",
      message: `exam-set failed schema parse: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      severity: "error",
    });
    return findings;
  }
  const set = parsed.data;
  const seen = new Set<string>();
  for (const exam of set.exams) {
    if (exam.subjectKind !== set.subjectKind) {
      findings.push({
        examSetId: set.examSetId,
        kind: "subject-kind-mismatch",
        message: `exam ${exam.examId} subjectKind '${exam.subjectKind}' != set subjectKind '${set.subjectKind}'`,
        severity: "error",
      });
    }
    if (exam.subjectScope !== set.subjectScope) {
      findings.push({
        examSetId: set.examSetId,
        kind: "subject-scope-mismatch",
        message: `exam ${exam.examId} subjectScope '${exam.subjectScope}' != set subjectScope '${set.subjectScope}'`,
        severity: "error",
      });
    }
    if (seen.has(exam.examId)) {
      findings.push({
        examSetId: set.examSetId,
        kind: "duplicate-exam-id",
        message: `duplicate examId '${exam.examId}' within set`,
        severity: "error",
      });
    }
    seen.add(exam.examId);
  }
  // D-W8-EXAM-GOVERNANCE: every exam-set must include at least one adversarial exam.
  const hasAdversarial = set.exams.some((e) => e.adversarial === true);
  if (!hasAdversarial) {
    findings.push({
      examSetId: set.examSetId,
      kind: "no-adversarial-exam",
      message:
        "exam-set must include at least one adversarial exam (adversarial: true) per D-W8-EXAM-GOVERNANCE",
      severity: "error",
    });
  }
  return findings;
}
