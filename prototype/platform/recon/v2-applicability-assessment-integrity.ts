// platform/recon/v2-applicability-assessment-integrity.ts
//
// `recon:v2-applicability-assessment-integrity` — the structural gate for the
// V2 S8 applicability-assessment lifecycle.
//
// ADVISORY in S8 (exits 0 unless a HARD structural error is found). Becomes
// enforcing-ready as the assessment population grows.
//
// Assertions:
//   1. No fold violations (orphan Performed / orphan Concluded — a lifecycle
//      event with no matching Requested).
//   2. Every Concluded assessment has a matching Requested (lifecycle complete).
//   3. Every concluded verdict is well-formed (one of the closed verdict set)
//      AND consistent with the recorded scope + contexts: re-running the pure
//      engine over the recorded appliesToScope and contextsEvaluated reproduces
//      the recorded verdict and matched-context set.
//
// WHY THIS GATE IS V1-SIDE: it needs the event store + recon `types` — both v1
// infrastructure. The dependency direction v1→v2 is the permitted one.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Principle 2 (single-graph discipline — the assessment binds the graph: a
// verdict asserts which contexts an obligation/posture applies to).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import {
  type AppliesToScope,
  APPLICABILITY_VERDICTS,
  type ApplicabilityVerdict,
  type AssessedContext,
  type AssessmentRegister,
  assessApplicability,
  foldAssessmentRegister,
} from "../../v2-core/applicability";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Read the register from the live event store
// ---------------------------------------------------------------------------

function readAssessmentRegister(): AssessmentRegister {
  const payloads: unknown[] = [];
  for (const ev of eventStore.replay({ type: "ApplicabilityAssessmentRequested" })) {
    payloads.push({
      kind: "ApplicabilityAssessmentRequested",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "ApplicabilityAssessmentPerformed" })) {
    payloads.push({
      kind: "ApplicabilityAssessmentPerformed",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "ApplicabilityAssessmentConcluded" })) {
    payloads.push({
      kind: "ApplicabilityAssessmentConcluded",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  return foldAssessmentRegister(payloads);
}

const VERDICT_SET = new Set<string>(APPLICABILITY_VERDICTS);

function arraysEqualAsSets(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult("v2-applicability-assessment-integrity");
  const violations: ReconViolation[] = [];

  let register: AssessmentRegister;
  try {
    register = readAssessmentRegister();
  } catch (err) {
    violations.push({
      subject: "AssessmentRegister",
      message: `assessment register fold failed: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  // Assertion 1 — fold violations (orphan Performed / Concluded).
  result.asserted += 1;
  for (const v of register.violations) {
    violations.push({
      subject: v.assessmentId,
      // An orphan lifecycle event is a structural integrity error (a Concluded
      // verdict with no opening Requested is not a replayable assessment).
      message: v.message,
      severity: "fail",
    });
  }

  // Per-assessment assertions.
  for (const a of register.listAssessments()) {
    // Assertion 2 — a concluded assessment must carry a Requested (it does by
    // construction if it is in the register, since only Requested seeds a
    // record; an orphan Concluded is already a violation above). We assert the
    // verdict + engine-consistency only for concluded assessments.
    if (a.stage !== "concluded") continue;

    result.asserted += 1;

    // Verdict well-formedness.
    if (a.verdict === undefined || !VERDICT_SET.has(a.verdict)) {
      violations.push({
        subject: a.assessmentId,
        message: `concluded assessment has malformed verdict: ${String(a.verdict)}`,
        severity: "fail",
      });
      continue;
    }

    // Engine-consistency: re-run the pure engine over the recorded scope +
    // contexts and confirm it reproduces the recorded verdict + matches.
    const scope = a.appliesToScope as AppliesToScope;
    const contexts = (a.contextsEvaluated ?? []) as readonly AssessedContext[];
    if (contexts.length === 0) {
      violations.push({
        subject: a.assessmentId,
        message:
          "concluded assessment has no contextsEvaluated — cannot replay the verdict (missing Performed event)",
        severity: "fail",
      });
      continue;
    }

    let recomputed: { verdict: ApplicabilityVerdict; matches: readonly string[] };
    try {
      recomputed = assessApplicability(scope, contexts);
    } catch (err) {
      violations.push({
        subject: a.assessmentId,
        message: `re-running the assessment engine threw: ${(err as Error).message}`,
        severity: "fail",
      });
      continue;
    }

    if (recomputed.verdict !== a.verdict) {
      violations.push({
        subject: a.assessmentId,
        message: `recorded verdict "${a.verdict}" inconsistent with engine over recorded scope: engine yields "${recomputed.verdict}"`,
        severity: "fail",
      });
    }

    const recordedMatches = a.appliesToContexts ?? [];
    if (!arraysEqualAsSets(recordedMatches, recomputed.matches)) {
      violations.push({
        subject: a.assessmentId,
        message:
          `recorded appliesToContexts [${recordedMatches.join(", ")}] inconsistent with engine ` +
          `matches [${recomputed.matches.join(", ")}]`,
        severity: "fail",
      });
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
    `recon:v2-applicability-assessment-integrity — asserted ${r.asserted} checks; ` +
      `${totalViolations} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
