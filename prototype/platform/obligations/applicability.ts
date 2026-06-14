// platform/obligations/applicability.ts
//
// W8 Slice C — the distill → applicability closed loop for OBLIGATIONS.
//
// When an obligation is adopted (`ObligationAdopted`), this module derives the
// candidate operating contexts from the bank's active posture register and runs
// the pure S8 applicability engine over the obligation's `appliesToScope`,
// yielding the verdict + matched contexts the adopt route emits as the
// `ApplicabilityAssessment{Requested,Performed,Concluded}` lifecycle.
//
// REUSE, not new types: this wires the EXISTING S8 event family
// (`v2-core/applicability`) with `subjectKind: "obligation"`. No new event type
// is minted — the family was registered (F-032) + provenance-categorised
// (governance) when S8 landed.
//
// ─── SCOPE-DERIVATION LIMITATION (v1, deliberate) ─────────────────────────────
// v1 derives the obligation's `appliesToScope` as a flat
// `{ kind: "jurisdiction", jurisdiction: "ZA" }` predicate. It does NOT inspect
// the requirement prose to discriminate e.g. IRB-vs-SA "does-not-apply" cases.
// That richer discrimination needs per-provision scope extraction (a future
// LLM-distill slice that emits a typed `appliesToScope` per obligation). Slice C
// wires the loop so that when obligation-level scope extraction lands, the
// verdicts sharpen automatically — the engine and lifecycle are already in place
// and the only change is the predicate this helper returns. We deliberately do
// NOT regex / keyword-extract from requirement text (false-precision risk).
// ──────────────────────────────────────────────────────────────────────────────
//
// PACKAGE BOUNDARY: this is a V1-side platform module. It IMPORTS v2-core
// (the permitted dependency direction; the no-v1-import gate only blocks
// v2-core → v1). It does NOT live under v2-core.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; Principle 1 (events are truth),
// Principle 2 (single-graph discipline — the verdict binds the obligation into
// the graph: it asserts which contexts the obligation applies to).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import {
  type AppliesToScope,
  type AssessedContext,
  type AssessmentEngineResult,
  assessApplicability,
} from "../../v2-core/applicability";
import { type PostureRegister, foldPostureRegister } from "../../v2-core/posture/projection";
import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// Posture-register reader (mirrors platform/recon/v2-posture-register-integrity)
// ---------------------------------------------------------------------------

/**
 * Read the V2 posture register from an event store by replaying the four
 * posture lifecycle events and folding them. Exported so the adopt route (and
 * any future obligation-applicability caller) can build the register once and
 * reuse it across a batch of obligations.
 *
 * Mirrors `readPostureRegister()` in
 * `platform/recon/v2-posture-register-integrity.ts` — single fold pattern.
 */
export function readPostureRegister(store: EventStore): PostureRegister {
  const payloads: unknown[] = [];
  for (const ev of store.replay({ type: "PostureRegistered" })) {
    payloads.push({
      kind: "PostureRegistered",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of store.replay({ type: "PostureActivated" })) {
    payloads.push({
      kind: "PostureActivated",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of store.replay({ type: "PostureDeactivated" })) {
    payloads.push({
      kind: "PostureDeactivated",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of store.replay({ type: "PostureRevised" })) {
    payloads.push({
      kind: "PostureRevised",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  return foldPostureRegister(payloads);
}

// ---------------------------------------------------------------------------
// Candidate-context derivation from the bank's active posture
// ---------------------------------------------------------------------------

/** The canonical anchor-entity context ref the v1 loop evaluates against. */
export const ANCHOR_CONTEXT_REF = "ctx:le-za-hoz-bank";

/**
 * Fold the posture register → the bank's canonical operating context(s) as
 * `AssessedContext[]`, the candidate set the engine evaluates an obligation
 * scope over.
 *
 * v1: a single ZA-bank context. `jurisdiction` is fixed "ZA" (build-phase
 * anchor). `entityType` is derived from the ACTIVE `entity.class` dimension
 * posture whose `parameters.held === true` (Slice B seeded
 * `posture:entity.class:bank` with dimensionValue="bank", held=true). If no
 * such held posture is active, fall back to "bank".
 */
export function buildBankPostureContexts(register: PostureRegister): AssessedContext[] {
  const entityType = deriveHeldEntityClass(register) ?? "bank";
  return [
    {
      contextRef: ANCHOR_CONTEXT_REF,
      context: { jurisdiction: "ZA", entityType },
    },
  ];
}

/**
 * The `dimensionValue` of the ACTIVE `entity.class` dimension posture that the
 * anchor currently HOLDS (`parameters.held === true`). Returns `null` when no
 * such posture is active.
 */
function deriveHeldEntityClass(register: PostureRegister): string | null {
  for (const posture of register.listPostures()) {
    if (!posture.active) continue;
    const params = posture.parameters as
      | { dimensionKey?: unknown; dimensionValue?: unknown; held?: unknown }
      | undefined;
    if (
      params?.dimensionKey === "entity.class" &&
      params.held === true &&
      typeof params.dimensionValue === "string" &&
      params.dimensionValue.length > 0
    ) {
      return params.dimensionValue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The obligation applicability assessment
// ---------------------------------------------------------------------------

export interface ObligationApplicabilityResult {
  /** The obligation's APPLIES_WHEN predicate (v1: flat ZA jurisdiction). */
  readonly appliesToScope: AppliesToScope;
  /** The full candidate context set evaluated (the Performed input). */
  readonly contextsEvaluated: AssessedContext[];
  /** The engine output: verdict + matches + rationale. */
  readonly result: AssessmentEngineResult;
}

/**
 * Derive the obligation's `appliesToScope` (v1: ZA jurisdiction — see the
 * file-header LIMITATION) and run the pure S8 engine over the supplied
 * candidate contexts. The caller (the adopt route) threads the result into the
 * Performed + Concluded lifecycle events.
 *
 * `derivesFrom` and `domain` are accepted on the args for forward-compatibility
 * — when obligation-level scope extraction lands they will inform a richer
 * `appliesToScope`; v1 ignores them and returns the flat jurisdiction predicate.
 */
export function assessObligationApplicability(
  args: { obligationId: string; derivesFrom: string[]; domain: string },
  contexts: AssessedContext[],
): ObligationApplicabilityResult {
  // v1 scope: flat ZA jurisdiction. (See file-header LIMITATION — richer
  // discrimination awaits per-provision scope extraction.)
  const appliesToScope: AppliesToScope = { kind: "jurisdiction", jurisdiction: "ZA" };
  const result = assessApplicability(appliesToScope, contexts);
  return { appliesToScope, contextsEvaluated: contexts, result };
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Stable assessment id for an obligation assessment on a given as-of day.
 * Convention `assessment:obligation:<obligationId-lowercased>:<YYYY-MM-DD>`.
 * Mirrors the owen-decision-impact-sweep `sweep:<id>:<date>` guard so a same-day
 * re-adoption is a no-op while a later-day adoption re-assesses (fresh posture
 * snapshot).
 */
export function obligationAssessmentId(obligationId: string, asOf: string): string {
  return `assessment:obligation:${obligationId.toLowerCase()}:${asOf.slice(0, 10)}`;
}

/**
 * The set of assessmentIds that already have a Concluded event in the store —
 * read once per batch so the route can skip an obligation already assessed on
 * this as-of day (the owen-decision-impact-sweep guard pattern).
 */
export function concludedAssessmentIds(store: EventStore): Set<string> {
  const ids = new Set<string>();
  for (const ev of store.replay({ type: "ApplicabilityAssessmentConcluded" })) {
    const id = (ev.payload as { assessmentId?: string }).assessmentId;
    if (id) ids.add(id);
  }
  return ids;
}
