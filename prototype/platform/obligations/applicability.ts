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
// ─── SCOPE DERIVATION ─────────────────────────────────────────────────────────
// The obligation's `appliesToScope` is resolved with this precedence:
//   1. an EXPLICIT scope on the obligation (operator-/agent-supplied) wins;
//   2. else the conservative rule-based EXTRACTOR (obligation-scope-extractor.ts)
//      maps unambiguous approach-/permission-specific provenance to a restricting
//      `dimension` scope (e.g. BCBS IRB chapters → approach.credit-rwa=advanced-irb);
//   3. else the flat `{ kind: "jurisdiction", jurisdiction: "ZA" }` predicate.
// The bank's posture context now carries `dimensions` (each HELD posture's
// dimensionKey → dimensionValue), so a dimension-scoped obligation resolves to
// "does-not-apply" when the bank does not hold that posture (e.g. an IRB-only
// rule against a standardised-approach bank). CONSERVATIVE-COMPLIANCE DEFAULT:
// restricting scopes are emitted only when UNAMBIGUOUS — see the extractor.
// FOLLOW-ON (not built): LLM-distill PROPOSES a typed scope per obligation,
// reviewed before it disposes — recorded in the extractor header, not here.
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
  type AssessedContext,
  type AssessmentEngineResult,
  assessApplicability,
} from "../../v2-core/applicability";
import type { AppliesToScope } from "../../v2-core/posture";
import { type PostureRegister, foldPostureRegister } from "../../v2-core/posture/projection";
import type { EventStore } from "../event-store/store";
import { deriveObligationScope } from "./obligation-scope-extractor";

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
 * A single canonical ZA-bank context. `jurisdiction` is fixed "ZA" (build-phase
 * anchor). `entityType` is derived from the ACTIVE `entity.class` dimension
 * posture whose `parameters.held === true` (Slice B seeded
 * `posture:entity.class:bank` with dimensionValue="bank", held=true). If no
 * such held posture is active, fall back to "bank".
 *
 * `dimensions` maps each ACTIVE posture's `parameters.dimensionKey` →
 * `parameters.dimensionValue` for postures the bank HOLDS (`parameters.held ===
 * true`). A dimensionKey with NO held value (e.g. `permission.supervisory`,
 * where every value is held=false) is OMITTED — so a scope requiring it
 * evaluates to `false` → "does-not-apply" (correct: the bank lacks it).
 */
export function buildBankPostureContexts(register: PostureRegister): AssessedContext[] {
  const entityType = deriveHeldEntityClass(register) ?? "bank";
  const dimensions = deriveHeldDimensions(register);
  return [
    {
      contextRef: ANCHOR_CONTEXT_REF,
      context: { jurisdiction: "ZA", entityType, dimensions },
    },
  ];
}

/**
 * Map every ACTIVE+HELD posture's `dimensionKey` → `dimensionValue`. Only
 * postures with `parameters.held === true` contribute, so a dimensionKey for
 * which the bank holds no value (every value held=false) is absent from the
 * map — the conservative "bank lacks this posture" semantics.
 *
 * If two held postures share a dimensionKey (should not happen — held values
 * are mutually exclusive per key), the last-seen wins deterministically by
 * register iteration order; the posture-register-integrity recon asserts the
 * single-held-value invariant upstream.
 */
function deriveHeldDimensions(register: PostureRegister): Record<string, string> {
  const dimensions: Record<string, string> = {};
  for (const posture of register.listPostures()) {
    if (!posture.active) continue;
    const params = posture.parameters as
      | { dimensionKey?: unknown; dimensionValue?: unknown; held?: unknown }
      | undefined;
    if (
      params?.held === true &&
      typeof params.dimensionKey === "string" &&
      params.dimensionKey.length > 0 &&
      typeof params.dimensionValue === "string" &&
      params.dimensionValue.length > 0
    ) {
      dimensions[params.dimensionKey] = params.dimensionValue;
    }
  }
  return dimensions;
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
  /** The obligation's resolved APPLIES_WHEN predicate (explicit > extractor > ZA). */
  readonly appliesToScope: AppliesToScope;
  /** The full candidate context set evaluated (the Performed input). */
  readonly contextsEvaluated: AssessedContext[];
  /** The engine output: verdict + matches + rationale. */
  readonly result: AssessmentEngineResult;
}

/**
 * Resolve the obligation's `appliesToScope` and run the pure S8 engine over the
 * supplied candidate contexts. The caller (the adopt route) threads the result
 * into the Performed + Concluded lifecycle events.
 *
 * Scope-resolution precedence:
 *   1. `args.appliesToScope` — an EXPLICIT operator-/agent-supplied scope wins;
 *   2. else the conservative rule-based extractor over `derivesFrom`/`citation`;
 *   3. (the extractor itself falls back to flat jurisdiction-ZA when ambiguous).
 */
export function assessObligationApplicability(
  args: {
    obligationId: string;
    derivesFrom: string[];
    domain: string;
    citation?: string;
    /** Explicit scope; when present it WINS over the extractor. */
    appliesToScope?: AppliesToScope;
  },
  contexts: AssessedContext[],
): ObligationApplicabilityResult {
  const appliesToScope: AppliesToScope =
    args.appliesToScope ??
    deriveObligationScope({
      obligationId: args.obligationId,
      derivesFrom: args.derivesFrom,
      domain: args.domain,
      ...(args.citation !== undefined ? { citation: args.citation } : {}),
    });
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
