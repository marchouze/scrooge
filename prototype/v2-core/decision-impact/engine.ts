// v2-core/decision-impact/engine.ts
//
// The decision-impact sweep engine (V2 S9). A pure function: given a Decision
// and the candidate artefacts in the graph, it computes which artefacts the
// decision affects and what actions the sweep recommends.
//
// PURITY: no side effects, no I/O. The caller (a seed script or an autonomous
// agent run) reads the candidate artefacts from the event store, runs the
// engine, and emits the `DecisionImpactSweepRequested` + `DecisionImpactAssessed`
// lifecycle events. The engine NEVER emits and NEVER mutates an impacted
// artefact (Principle 1; structured-first — S9 RECOMMENDS, agents/decisions
// dispose).
//
// IMPACT IS COMPUTED FROM TWO DIMENSIONS (Principle 2 — every impact edge is an
// explicit, citable graph link, never implicit):
//   1. CITATION GRAPH
//      - artefacts that cite the decision (downstream consumers — the decision
//        changed under them)                            → edge `cites-decision`
//      - artefacts the decision cites that propagate     → edge `cited-by-decision`
//      - artefacts that cite a decision THIS decision supersedes
//                                                        → edge `supersedes`
//   2. SCOPE OVERLAP
//      - artefacts whose APPLIES_WHEN scope intersects the decision's subject
//        scope (reuses the S3 `evaluateAppliesToScope` evaluator — the same
//        evaluator the S8 assessment engine uses; a decision is one S8
//        `subjectKind`)                                  → edge `scope-overlap`
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-W8-DECISION-IMPACT-SWEEP; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering).

import { type AppliesToScope, type PostureContext, evaluateAppliesToScope } from "../posture";
import type {
  ImpactEdge,
  ImpactedArtefact,
  ImpactedArtefactKind,
  RecommendedAction,
} from "./events";

// ---------------------------------------------------------------------------
// Engine input — the candidate artefact graph
// ---------------------------------------------------------------------------

/**
 * A candidate artefact the engine evaluates against the decision. The caller
 * builds these by reading the live registers (posture register, FIL-Model
 * registry, obligation register, procedure register) and tagging each with:
 *   - its `artefactKind` + `artefactRef`
 *   - the upward citations it carries (so the engine can test the citation graph)
 *   - optionally its APPLIES_WHEN scope (so the engine can test scope overlap)
 *
 * The engine never reaches into a store — it operates only on this snapshot
 * (purity / replay-safety).
 */
export interface CandidateArtefact {
  readonly artefactKind: ImpactedArtefactKind;
  readonly artefactRef: string;
  /** Upward citations this artefact carries (decision ids, URNs, …). */
  readonly citations: readonly string[];
  /** Optional APPLIES_WHEN scope for the scope-overlap dimension. */
  readonly appliesToScope?: AppliesToScope;
}

/**
 * The decision the sweep is over, reduced to the fields the engine needs.
 * `subjectScope` is the decision's subject APPLIES_WHEN scope (optional — many
 * decisions carry no typed scope; those contribute only the citation-graph
 * dimension). `subjectContext` is the PostureContext the decision's subject
 * sits in, used to test whether a candidate's scope binds the decision's
 * subject (the symmetric overlap direction).
 */
export interface SweptDecision {
  readonly decisionId: string;
  /** Decision ids this decision cites (downward propagation). */
  readonly cites: readonly string[];
  /** Decision ids this decision supersedes. */
  readonly supersedes: readonly string[];
  /** Optional subject scope for the scope-overlap dimension. */
  readonly subjectScope?: AppliesToScope;
  /** Optional subject context for the scope-overlap dimension. */
  readonly subjectContext?: PostureContext;
}

// ---------------------------------------------------------------------------
// Engine output
// ---------------------------------------------------------------------------

export interface DecisionImpactResult {
  /** The computed impact set (deduped by artefactRef+edge, stable order). */
  readonly impacted: readonly ImpactedArtefact[];
  /** The deduped, ordered recommended actions over the impact set. */
  readonly recommendedActions: readonly RecommendedAction[];
  /** Deterministic human-readable summary. */
  readonly rationale: string;
}

// ---------------------------------------------------------------------------
// Action mapping — artefact kind → recommended action
// ---------------------------------------------------------------------------

/**
 * Map an impacted artefact kind to the action the sweep recommends for it.
 * Deterministic and total over the closed kind set:
 *   fil-model  → re-validate (independent model validation)
 *   obligation → re-distill  (re-run the obligation distillation)
 *   posture    → re-assess   (re-run the S8 applicability assessment)
 *   procedure  → re-assess   (re-assess the procedure against the changed scope)
 */
export function recommendedActionForKind(kind: ImpactedArtefactKind): RecommendedAction {
  switch (kind) {
    case "fil-model":
      return "re-validate";
    case "obligation":
      return "re-distill";
    case "posture":
      return "re-assess";
    case "procedure":
      return "re-assess";
  }
}

// ---------------------------------------------------------------------------
// Scope-overlap helper
// ---------------------------------------------------------------------------

/**
 * Decide whether a candidate's scope overlaps the decision's subject scope.
 * Reuses the S3 evaluator in both directions where data is present:
 *   - if the decision carries a `subjectContext`, the candidate's scope binds
 *     the decision's subject when `evaluateAppliesToScope(candidateScope, ctx)`.
 *   - if the decision carries a `subjectScope` AND the candidate carries a
 *     scope, we additionally treat them as overlapping when they are
 *     structurally identical (same predicate) — a conservative test that avoids
 *     a full predicate-intersection solver (out of scope for S9) while still
 *     catching the common "same scope" case.
 *
 * Returns `false` when neither side supplies enough data (no false positives).
 */
function scopesOverlap(decision: SweptDecision, candidate: CandidateArtefact): boolean {
  const candidateScope = candidate.appliesToScope;
  if (candidateScope === undefined) return false;

  // Direction 1: does the candidate's scope bind the decision's subject context?
  if (decision.subjectContext !== undefined) {
    if (evaluateAppliesToScope(candidateScope, decision.subjectContext)) return true;
  }

  // Direction 2: structural equality of the two scope predicates.
  if (decision.subjectScope !== undefined) {
    if (scopesStructurallyEqual(candidateScope, decision.subjectScope)) return true;
  }

  return false;
}

/** Deterministic structural equality of two AppliesToScope predicates. */
function scopesStructurallyEqual(a: AppliesToScope, b: AppliesToScope): boolean {
  return canonicalScope(a) === canonicalScope(b);
}

/** Canonical, order-insensitive string form of a scope predicate. */
function canonicalScope(scope: AppliesToScope): string {
  switch (scope.kind) {
    case "always":
      return "always";
    case "jurisdiction":
      return `jurisdiction:${scope.jurisdiction}`;
    case "entity-type":
      return `entity-type:${scope.entityType}`;
    case "product-scope":
      return `product-scope:${scope.filTaxonomyScope}`;
    case "regulatory-regime":
      return `regulatory-regime:${scope.regimeId}`;
    case "risk-class":
      return `risk-class:${scope.riskClass}`;
    case "and":
    case "or": {
      const inner = scope.conditions.map(canonicalScope).sort().join(",");
      return `${scope.kind}(${inner})`;
    }
  }
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Compute the impact set for a decision over a candidate artefact graph.
 *
 * Pure. Deterministic. Idempotent for a fixed input (stable ordering; dedup by
 * artefactRef+edge). Returns the impacted artefacts, the recommended actions,
 * and a deterministic rationale.
 *
 * An artefact may appear under at most ONE edge in the result — the first edge
 * matched in precedence order:
 *   cites-decision > supersedes > cited-by-decision > scope-overlap
 * (the most direct linkage wins; the rationale notes the chosen edge).
 */
export function computeDecisionImpact(
  decision: SweptDecision,
  candidates: readonly CandidateArtefact[],
): DecisionImpactResult {
  const decisionId = decision.decisionId;
  const supersededSet = new Set(decision.supersedes);
  const citedSet = new Set(decision.cites);

  // Map artefactRef → chosen impact entry (first edge in precedence wins).
  const chosen = new Map<string, ImpactedArtefact>();

  const consider = (artefact: CandidateArtefact, edge: ImpactEdge, reason: string): void => {
    if (chosen.has(artefact.artefactRef)) return; // precedence: keep first
    chosen.set(artefact.artefactRef, {
      artefactKind: artefact.artefactKind,
      artefactRef: artefact.artefactRef,
      reason,
      edge,
    });
  };

  // Precedence order: most direct linkage first. We pass over the candidates
  // once per edge type, in precedence order, so the FIRST edge that matches an
  // artefact is the one recorded.
  for (const c of candidates) {
    if (c.citations.includes(decisionId)) {
      consider(c, "cites-decision", `Artefact carries an upward citation to ${decisionId}.`);
    }
  }
  for (const c of candidates) {
    const hit = c.citations.find((cit) => supersededSet.has(cit));
    if (hit !== undefined) {
      consider(
        c,
        "supersedes",
        `Artefact cites ${hit}, which ${decisionId} supersedes — the superseding decision propagates to it.`,
      );
    }
  }
  for (const c of candidates) {
    if (citedSet.has(c.artefactRef)) {
      consider(
        c,
        "cited-by-decision",
        `${decisionId} cites this artefact — the decision propagates downward to it.`,
      );
    }
  }
  for (const c of candidates) {
    if (scopesOverlap(decision, c)) {
      consider(
        c,
        "scope-overlap",
        `Artefact's APPLIES_WHEN scope intersects ${decisionId}'s subject scope.`,
      );
    }
  }

  // Stable order: by edge precedence, then artefactKind, then artefactRef.
  const edgeRank: Record<ImpactEdge, number> = {
    "cites-decision": 0,
    supersedes: 1,
    "cited-by-decision": 2,
    "scope-overlap": 3,
  };
  const impacted = Array.from(chosen.values()).sort((a, b) => {
    if (edgeRank[a.edge] !== edgeRank[b.edge]) return edgeRank[a.edge] - edgeRank[b.edge];
    if (a.artefactKind !== b.artefactKind) return a.artefactKind.localeCompare(b.artefactKind);
    return a.artefactRef.localeCompare(b.artefactRef);
  });

  const recommendedActions = deriveRecommendedActions(impacted);
  const rationale = buildRationale(decisionId, impacted);

  return { impacted, recommendedActions, rationale };
}

/**
 * Derive the deduped, ordered recommended-action set from the impact set. An
 * empty impact set yields `["none"]`; otherwise the deduped union of the
 * per-kind actions, ordered by the closed action vocabulary
 * (re-validate, re-distill, re-assess), with `none` never alongside a real one.
 */
export function deriveRecommendedActions(
  impacted: readonly ImpactedArtefact[],
): readonly RecommendedAction[] {
  if (impacted.length === 0) return ["none"];
  const set = new Set<RecommendedAction>();
  for (const a of impacted) set.add(recommendedActionForKind(a.artefactKind));
  set.delete("none");
  const order: RecommendedAction[] = ["re-validate", "re-distill", "re-assess"];
  return order.filter((a) => set.has(a));
}

/** Deterministic rationale string derived from the impact set. */
function buildRationale(decisionId: string, impacted: readonly ImpactedArtefact[]): string {
  if (impacted.length === 0) {
    return `${decisionId} sweep found no impacted artefacts in the candidate graph.`;
  }
  const byKind = new Map<ImpactedArtefactKind, number>();
  for (const a of impacted) byKind.set(a.artefactKind, (byKind.get(a.artefactKind) ?? 0) + 1);
  const parts = Array.from(byKind.entries())
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([kind, n]) => `${n} ${kind}`);
  return `${decisionId} impacts ${impacted.length} artefact(s): ${parts.join(", ")}.`;
}
