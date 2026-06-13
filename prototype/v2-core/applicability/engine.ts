// v2-core/applicability/engine.ts
//
// The applicability-assessment engine (V2 S8). A pure function: given a
// subject's `AppliesToScope` predicate and a set of candidate contexts (the
// anchor bank's entities / products / jurisdictions), it evaluates applicability
// via the S3 `evaluateAppliesToScope` evaluator and produces a verdict with the
// matched contexts.
//
// PURITY: no side effects, no I/O. The caller (a seed script or an autonomous
// agent run) takes the engine's output and emits the lifecycle events
// (Requested → Performed → Concluded). The engine NEVER emits; it only computes.
//
// The S3 APPLIES_WHEN evaluator is reused unchanged — S8 adds no predicate types.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance),
//         with input from Zara (Chief Compliance Officer, governance).

import { type AppliesToScope, evaluateAppliesToScope } from "../posture";
import type { ApplicabilityVerdict, AssessedContext } from "./events";

// ---------------------------------------------------------------------------
// Engine output
// ---------------------------------------------------------------------------

/**
 * The result of running the engine over a subject's scope and candidate
 * contexts. This is the value the caller threads into the Performed + Concluded
 * lifecycle events.
 */
export interface AssessmentEngineResult {
  /** The candidate context refs whose predicate held (subset of the input). */
  readonly matches: readonly string[];
  /** The derived verdict over the full candidate set. */
  readonly verdict: ApplicabilityVerdict;
  /** A deterministic human-readable rationale derived from the match counts. */
  readonly rationale: string;
}

// ---------------------------------------------------------------------------
// Verdict derivation
// ---------------------------------------------------------------------------

/**
 * Derive the verdict from the match count over the candidate set:
 *   - all matched      → `applies`
 *   - none matched     → `does-not-apply`
 *   - some matched     → `partially-applies`
 *
 * Edge case: an empty candidate set is `does-not-apply` (vacuously nothing to
 * apply to). The engine asserts a non-empty candidate set is supplied; an empty
 * set is a caller error, but the engine resolves it deterministically rather
 * than throwing (replay-safety).
 */
export function deriveVerdict(matchedCount: number, totalCount: number): ApplicabilityVerdict {
  if (totalCount === 0) return "does-not-apply";
  if (matchedCount === 0) return "does-not-apply";
  if (matchedCount === totalCount) return "applies";
  return "partially-applies";
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Assess a subject's `AppliesToScope` against a set of candidate contexts.
 *
 * Pure: evaluates each candidate via `evaluateAppliesToScope` and derives the
 * verdict. Returns the matched context refs (preserving input order), the
 * verdict, and a deterministic rationale.
 *
 * The returned `matches` are the `contextRef`s of the candidates whose predicate
 * held — these become the `appliesToContexts` of the Concluded event. The recon
 * gate re-runs this exact computation over the recorded scope + contexts to
 * confirm the recorded matches are consistent with the evaluator.
 */
export function assessApplicability(
  scope: AppliesToScope,
  candidates: readonly AssessedContext[],
): AssessmentEngineResult {
  const matches: string[] = [];
  for (const candidate of candidates) {
    if (evaluateAppliesToScope(scope, candidate.context)) {
      matches.push(candidate.contextRef);
    }
  }

  const verdict = deriveVerdict(matches.length, candidates.length);
  const rationale = buildRationale(verdict, matches, candidates);

  return { matches, verdict, rationale };
}

/**
 * Deterministic rationale string derived from the verdict and match set. Kept
 * deterministic (no timestamps, no randomness) so the same inputs always
 * produce the same rationale — important for idempotent reseeds.
 */
function buildRationale(
  verdict: ApplicabilityVerdict,
  matches: readonly string[],
  candidates: readonly AssessedContext[],
): string {
  const total = candidates.length;
  const matched = matches.length;
  switch (verdict) {
    case "applies":
      return `Subject scope holds for all ${total} candidate context(s): ${matches.join(", ")}.`;
    case "does-not-apply":
      if (total === 0) {
        return "No candidate contexts supplied; subject applies to nothing in the evaluated set.";
      }
      return `Subject scope holds for none of the ${total} candidate context(s).`;
    case "partially-applies":
      return `Subject scope holds for ${matched} of ${total} candidate context(s): ${matches.join(", ")}.`;
  }
}
