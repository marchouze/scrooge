// v2-core/eval/eval-harness.test.ts
//
// Unit tests for the V2 S13 eval harness: the exam-set well-formedness gate,
// the pure `runEval` harness, the structured-first change-gate, the event
// payload schemas + the EvalRunCompleted builder, and — critically — the REAL
// SA-CCR pilot eval (the harness runs the v2-native `computeSaCcr` over the
// pilot exam-set and the model PASSES every exam). Plus the engine-consistency
// property the integrity recon relies on (re-run yields the identical result).
//
// Pure, no v1 dependency (the v2-core package is self-contained by construction).
//
// Author: Vera (Internal Audit Engineer, governance).

import { describe, expect, it } from "bun:test";
import type { CitationRef, Instant } from "../fil-core/primitives";
import {
  type ExamSet,
  SA_CCR_PILOT_EXAM_SET,
  SA_CCR_SUBJECT_HASH,
  checkExamSetWellFormed,
  evalRunCompletedFromResult,
  evalRunCompletedPayloadSchema,
  evaluateChangeGate,
  examSetRegisteredPayloadSchema,
  makeSaCcrEvalSubject,
  runEval,
} from "./index";

const C = (s: string) => s as CitationRef;

describe("exam-set well-formedness", () => {
  it("accepts the SA-CCR pilot exam-set", () => {
    expect(checkExamSetWellFormed(SA_CCR_PILOT_EXAM_SET)).toEqual([]);
  });

  it("rejects an exam whose subjectKind disagrees with the set", () => {
    const bad: ExamSet = {
      ...SA_CCR_PILOT_EXAM_SET,
      exams: [
        {
          ...(SA_CCR_PILOT_EXAM_SET.exams[0] as ExamSet["exams"][number]),
          subjectKind: "posture",
        },
      ],
    };
    const findings = checkExamSetWellFormed(bad);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.message).toContain("subjectKind");
  });

  it("rejects a set with no exams (schema min(1))", () => {
    const bad = { ...SA_CCR_PILOT_EXAM_SET, exams: [] };
    expect(checkExamSetWellFormed(bad).length).toBeGreaterThan(0);
  });
});

describe("SA-CCR pilot eval — the REAL run", () => {
  const subject = makeSaCcrEvalSubject();
  const result = runEval(subject, SA_CCR_PILOT_EXAM_SET);

  it("runs every exam in the pilot set", () => {
    expect(result.examsRun).toBe(SA_CCR_PILOT_EXAM_SET.exams.length);
    expect(result.examsRun).toBe(6);
  });

  it("PASSES — the SA-CCR model satisfies every invariant", () => {
    // If any exam fails, surface which (so a regression names the broken invariant).
    const failed = result.examResults.filter((r) => !r.passed);
    expect(failed.map((f) => `${f.examId}: ${f.detail}`)).toEqual([]);
    expect(result.verdict).toBe("passed");
    expect(result.examsPassed).toBe(6);
    expect(result.examsFailed).toBe(0);
  });

  it("each individual invariant exam passes", () => {
    const byId = new Map(result.examResults.map((r) => [r.examId, r]));
    for (const id of [
      "exam:sa-ccr:rc-floor-vminusc",
      "exam:sa-ccr:rc-non-negative",
      "exam:sa-ccr:ead-alpha-composition",
      "exam:sa-ccr:ead-at-least-rc",
      "exam:sa-ccr:pfe-addon-monotonic",
      "exam:sa-ccr:latest-per-trade-mtm",
    ]) {
      expect(byId.get(id)?.passed).toBe(true);
    }
  });

  it("is deterministic — re-run yields a byte-identical result (engine-consistency)", () => {
    const rerun = runEval(makeSaCcrEvalSubject(), SA_CCR_PILOT_EXAM_SET);
    expect(JSON.stringify(rerun)).toBe(JSON.stringify(result));
  });
});

describe("harness preconditions (no silent green)", () => {
  it("throws when the subject scope does not match the exam-set", () => {
    const wrong = {
      subjectKind: "fil-model" as const,
      subjectScope: "not-sa-ccr",
      observe: () => ({}),
    };
    expect(() => runEval(wrong, SA_CCR_PILOT_EXAM_SET)).toThrow(/scope/);
  });

  it("marks an exam failed when the subject throws (never silently passes)", () => {
    const throwing = {
      subjectKind: "fil-model" as const,
      subjectScope: SA_CCR_PILOT_EXAM_SET.subjectScope,
      observe: () => {
        throw new Error("boom");
      },
    };
    const r = runEval(throwing, SA_CCR_PILOT_EXAM_SET);
    expect(r.verdict).toBe("failed");
    expect(r.examResults.every((e) => !e.passed)).toBe(true);
    expect(r.examResults[0]?.detail).toContain("boom");
  });

  it("fails an exam whose asserted field the subject does not report", () => {
    const silent = {
      subjectKind: "fil-model" as const,
      subjectScope: SA_CCR_PILOT_EXAM_SET.subjectScope,
      observe: () => ({}), // reports nothing
    };
    const r = runEval(silent, SA_CCR_PILOT_EXAM_SET);
    expect(r.verdict).toBe("failed");
    expect(r.examResults[0]?.detail).toContain("did not report");
  });
});

describe("change-gate composition with the independent-validation plane", () => {
  const subject = makeSaCcrEvalSubject();
  const passing = runEval(subject, SA_CCR_PILOT_EXAM_SET);

  it("clears the systematic plane on a passing eval", () => {
    const gate = evaluateChangeGate({ eval: passing });
    expect(gate.status).toBe("cleared");
  });

  it("is NOT adoptable on the systematic plane alone (independent sign-off required)", () => {
    const gate = evaluateChangeGate({ eval: passing });
    expect(gate.adoptable).toBe(false);
    expect(gate.independentSignOff).toBeNull();
    expect(gate.reason).toContain("independent");
  });

  it("is adoptable when BOTH planes clear", () => {
    const gate = evaluateChangeGate({ eval: passing, independentSignOff: true });
    expect(gate.status).toBe("cleared");
    expect(gate.adoptable).toBe(true);
  });

  it("is NOT adoptable when independent validation is withheld even if exams pass", () => {
    const gate = evaluateChangeGate({ eval: passing, independentSignOff: false });
    expect(gate.status).toBe("cleared");
    expect(gate.adoptable).toBe(false);
    expect(gate.reason).toContain("WITHHELD");
  });

  it("blocks the systematic plane on a failed eval (and is never adoptable)", () => {
    const failed = { ...passing, verdict: "failed" as const, examsFailed: 1 };
    const gate = evaluateChangeGate({ eval: failed, independentSignOff: true });
    expect(gate.status).toBe("blocked");
    expect(gate.adoptable).toBe(false);
  });
});

describe("event payloads", () => {
  const subject = makeSaCcrEvalSubject();
  const result = runEval(subject, SA_CCR_PILOT_EXAM_SET);
  const ranAt = "2026-06-13T12:00:00.000Z" as Instant;

  it("builds + parses an EvalRunCompleted payload from the result", () => {
    const payload = evalRunCompletedFromResult({
      result,
      subjectHash: SA_CCR_SUBJECT_HASH,
      ranBy: "seed:v2-saccr-exam-set",
      ranAt,
      citations: [C("D-W4-MODEL-LIBRARY-PILOT"), C("BCBS-SA-CCR-CRE52")],
    });
    expect(payload.verdict).toBe("passed");
    expect(payload.examOutcomes.length).toBe(6);
    expect(payload.evalRunId).toBe("eval:examset:sa-ccr:2026-06-13");
    expect(() => evalRunCompletedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("parses an ExamSetRegistered payload carrying the full set", () => {
    const payload = {
      examSetId: SA_CCR_PILOT_EXAM_SET.examSetId,
      examSet: SA_CCR_PILOT_EXAM_SET,
      registeredBy: "agent:vera:internal-audit-engineer",
      registeredAt: ranAt,
      citations: [C("D-W4-MODEL-LIBRARY-PILOT")],
    };
    expect(() => examSetRegisteredPayloadSchema.parse(payload)).not.toThrow();
  });
});
