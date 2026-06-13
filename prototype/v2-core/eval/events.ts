// v2-core/eval/events.ts
//
// V2 S13 — eval-harness event family (the assurance plane's event-of-record).
//
//   ExamSetRegistered  — a named exam-set enters the register (the assurance
//                        corpus is event-sourced, not a static fixture). Carries
//                        the full exam-set so the register is reconstructable
//                        from the log alone (Principle 1).
//   EvalRunCompleted   — an eval run's typed verdict-of-record: the exam-set
//                        evaluated, the per-exam pass/fail, the overall verdict.
//                        The eval is a load-bearing answer ⇒ it lands as an
//                        event (the facet discipline). It carries the recorded
//                        EvalResult so the integrity recon can re-run the harness
//                        over the SAME exam-set and assert the same verdict
//                        (engine-consistency).
//
// Design principle: structured-first (D-V2-BBAAS-BLUEPRINT-SYNTHESIS). The eval
// run RECORDS; the change-gate (see `gate.ts`) is the function the disposal /
// model-adoption path CAN call to GATE a change on a passing run. The gate
// composes with — does not replace — Nadia's independent model-validation
// plane: the harness is the systematic substrate; the independent validator's
// sign-off remains a distinct ModelValidationApproved judgment on top.
//
// PACKAGE BOUNDARY: no v1 imports. The v1-side registers these two event kinds
// (`platform/event-store/event-types/v2-eval.ts`) the same way posture /
// FIL-model events are registered (v1→v2 only).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1. Principle 1 (events are truth).
// Author: Vera (Internal Audit Engineer, governance).

import { z } from "zod";
import {
  type CitationRef,
  type Instant,
  citationRefSchema,
  instantSchema,
} from "../fil-core/primitives";
import {
  type Exam,
  type ExamSet,
  type ExamSubjectKind,
  examSetSchema,
  examSubjectKindSchema,
} from "./exam";
import type { EvalResult, EvalVerdict, ExamResult } from "./harness";

// ---------------------------------------------------------------------------
// ExamSetRegistered
// ---------------------------------------------------------------------------

/**
 * `ExamSetRegistered` — a named exam-set enters the register.
 *
 * `examSetId`   — folds the register row (latest-wins per id; a new version is a
 *                 new ExamSetRegistered with the same id + a higher `version`).
 * `examSet`     — the full exam-set (carried so the register is reconstructable
 *                 from the log alone — the corpus is a query, Principle 1).
 * `registeredBy`— who authored/registered the set (Vera owns the standard).
 * `registeredAt`— when.
 * `citations`   — Principle 2 upward citations (the authorising decision + the
 *                 methodology / provisions the set asserts conformance to).
 */
export interface ExamSetRegisteredPayload {
  readonly examSetId: string;
  readonly examSet: ExamSet;
  readonly registeredBy: string;
  readonly registeredAt: Instant;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> for branded-primitive (CitationRef/Instant) + nested exam-set compat with the v2-core families
export const examSetRegisteredPayloadSchema: z.ZodType<any, any, any> = z.object({
  examSetId: z.string().min(1),
  examSet: examSetSchema,
  registeredBy: z.string().min(1),
  registeredAt: instantSchema,
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// EvalRunCompleted
// ---------------------------------------------------------------------------

/** Per-exam outcome carried on the event (mirrors `harness.ExamResult`). */
export interface EvalRunExamOutcome {
  readonly examId: string;
  readonly passed: boolean;
  readonly detail: string | null;
}

/**
 * `EvalRunCompleted` — the typed verdict-of-record of an eval run.
 *
 * `evalRunId`     — stable slug; convention `eval:<examset-id>:<as-of-date>`.
 * `examSetId`     — the exam-set evaluated (MUST reference a registered set —
 *                   the integrity recon enforces this).
 * `examSetVersion`— the version run (recorded for reproducibility).
 * `subjectKind`   — fil-model | posture | agent-behaviour.
 * `subjectScope`  — the subject identity evaluated.
 * `subjectHash`   — an integrity anchor for the subject under test (e.g. a
 *                   FIL-Model methodologyHash) so a passing eval is bound to the
 *                   EXACT subject version it ran against (a later silent change
 *                   to the subject is detectable: its hash no longer matches a
 *                   passing run). Opaque to the kernel.
 * `verdict`       — passed | failed | passed-with-findings.
 * `examOutcomes`  — per-exam pass/fail (+ failure detail).
 * `examsRun/Passed/Failed` — the verdict counts (carried for query convenience).
 * `ranBy`         — who/what ran the eval (an agent run id, or a seed slug).
 * `ranAt`         — when.
 * `citations`     — Principle 2 upward citations.
 */
export interface EvalRunCompletedPayload {
  readonly evalRunId: string;
  readonly examSetId: string;
  readonly examSetVersion: string;
  readonly subjectKind: ExamSubjectKind;
  readonly subjectScope: string;
  readonly subjectHash: string;
  readonly verdict: EvalVerdict;
  readonly examOutcomes: readonly EvalRunExamOutcome[];
  readonly examsRun: number;
  readonly examsPassed: number;
  readonly examsFailed: number;
  readonly ranBy: string;
  readonly ranAt: Instant;
  readonly citations: readonly CitationRef[];
}

export const evalVerdictSchema = z.enum(["passed", "failed", "passed-with-findings"]);

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> for branded-primitive (CitationRef/Instant) compat with the v2-core families
export const evalRunCompletedPayloadSchema: z.ZodType<any, any, any> = z.object({
  evalRunId: z.string().min(1),
  examSetId: z.string().min(1),
  examSetVersion: z.string().min(1),
  subjectKind: examSubjectKindSchema,
  subjectScope: z.string().min(1),
  subjectHash: z.string().min(1),
  verdict: evalVerdictSchema,
  examOutcomes: z
    .array(
      z.object({
        examId: z.string().min(1),
        passed: z.boolean(),
        detail: z.string().nullable(),
      }),
    )
    .min(1),
  examsRun: z.number().int().nonnegative(),
  examsPassed: z.number().int().nonnegative(),
  examsFailed: z.number().int().nonnegative(),
  ranBy: z.string().min(1),
  ranAt: instantSchema,
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// Discriminated union + kinds
// ---------------------------------------------------------------------------

export type EvalEventPayload =
  | ({ readonly kind: "ExamSetRegistered" } & ExamSetRegisteredPayload)
  | ({ readonly kind: "EvalRunCompleted" } & EvalRunCompletedPayload);

export const EVAL_EVENT_KINDS = ["ExamSetRegistered", "EvalRunCompleted"] as const;
export type EvalEventKind = (typeof EVAL_EVENT_KINDS)[number];

// ---------------------------------------------------------------------------
// Builders — map a harness EvalResult into the EvalRunCompleted payload shape.
// ---------------------------------------------------------------------------

/**
 * Build an `EvalRunCompleted` payload from a harness `EvalResult`. The single
 * place that maps the in-memory result into the typed event-of-record, so the
 * seed, the change-gate, and any future caller emit an identical shape.
 */
export function evalRunCompletedFromResult(args: {
  result: EvalResult;
  subjectHash: string;
  ranBy: string;
  ranAt: Instant;
  citations: readonly CitationRef[];
  /** Override the derived id; defaults to `eval:<examSetId>:<ranAt-date>`. */
  evalRunId?: string;
}): EvalRunCompletedPayload {
  const { result } = args;
  const dateOnly = String(args.ranAt).slice(0, 10);
  return {
    evalRunId: args.evalRunId ?? `eval:${result.examSetId}:${dateOnly}`,
    examSetId: result.examSetId,
    examSetVersion: result.examSetVersion,
    subjectKind: result.subjectKind,
    subjectScope: result.subjectScope,
    subjectHash: args.subjectHash,
    verdict: result.verdict,
    examOutcomes: result.examResults.map((r: ExamResult) => ({
      examId: r.examId,
      passed: r.passed,
      detail: r.detail,
    })),
    examsRun: result.examsRun,
    examsPassed: result.examsPassed,
    examsFailed: result.examsFailed,
    ranBy: args.ranBy,
    ranAt: args.ranAt,
    citations: args.citations,
  };
}

/** Re-export the exam types consumers reach for via the events module. */
export type { Exam, ExamSet };
