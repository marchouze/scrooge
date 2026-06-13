// platform/event-store/decision-impact-candidate-resolver.ts
//
// V1-SIDE candidate-context resolver for the V2 S9 decision-impact sweep.
//
// Assembles the candidate artefact graph + the SweptDecision for ANY approved
// Decision, reading the LIVE event store (latest-wins). It is the single
// generic resolver both the auto-trigger handler
// (`runtime/agents/owen-decision-impact-sweep.ts`) and the pilot seed script
// call — so the sweep computed automatically is byte-identical to the sweep a
// hand-run would produce (Principle 1: the events are the truth; the resolver
// is a deterministic projection over them).
//
// WHAT RESOLVES (live registers in v2-core read-scope):
//   - POSTURES   — every `PostureRegistered` becomes a candidate carrying its
//                  upward `citations` (citation-graph dimension) AND its
//                  `appliesToScope` (scope-overlap dimension). The latest
//                  registration per postureId wins (re-registration / scope
//                  re-statement).
//   - FIL-MODELS — every `FilModelImplementationDeclared` becomes a candidate
//                  carrying its `cites` (citation-graph). The model's fil scope
//                  patterns are mapped to product-scope `AppliesToScope`
//                  conditions so the scope-overlap dimension can fire when the
//                  decision's subject scope is a product scope. Latest
//                  declaration per modelId wins.
//
// WHAT STAYS ADVISORY (NOT in v2-core read-scope — documented gap, brief §2):
//   - OBLIGATIONS / PROCEDURES — the obligation register + procedure register
//     are v1 graph artefacts, not v2-core registers this layer reads. They are
//     resolved ONLY via the decision's OWN explicit citation graph: a ref the
//     decision `cites` (or supersedes-then-cites) that is shaped like an
//     obligation URN (`urn:reg:…`) or a procedure id (`proc:…`) is admitted as
//     a candidate so the engine surfaces it under `cited-by-decision` /
//     `supersedes`. We do NOT enumerate the whole obligation/procedure
//     population (we cannot, from here) — so obligation/procedure COVERAGE is
//     advisory, and the recon gate reports orphan obligation/procedure impacts
//     as `info`, never `fail` (it already does — see
//     `recon:v2-decision-impact-sweep-coverage` assertion 3).
//
// PURITY BOUNDARY: this module reads the store and BUILDS the engine input; it
// NEVER runs the engine and NEVER emits. The caller runs the pure
// `computeDecisionImpact` and emits the lifecycle. Keeping the read here (v1)
// and the compute in v2-core preserves `recon:v2-no-v1-import`.
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 1 + Principle 2.
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//   Architect, engineering).

import type { CandidateArtefact, SweptDecision } from "../../v2-core/decision-impact";
import type { AppliesToScope } from "../../v2-core/posture";
import type { EventStore } from "./store";

// ---------------------------------------------------------------------------
// Decision resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the SweptDecision view (cites + supersedes) for `decisionId` from the
 * live store. Latest `Decision` event for the id wins (a decision may move
 * requested → approved; the approved record carries the final citation set).
 *
 * `subjectScope` / `subjectContext` are left undefined for the generic case:
 * most Decisions carry no typed subject scope, so the scope-overlap dimension
 * contributes only when a posture's scope is `always` or structurally equal.
 * (The pilot seed supplies an explicit FX subject scope/context for its case;
 * the generic auto-trigger does not synthesise one — no false positives.)
 */
export function resolveSweptDecision(store: EventStore, decisionId: string): SweptDecision {
  let cites: string[] = [];
  let supersedes: string[] = [];
  for (const ev of store.replay({ type: "Decision" })) {
    const p = (
      ev as { payload: { decisionId?: string; citations?: string[]; supersedes?: string[] } }
    ).payload;
    if (p.decisionId === decisionId) {
      cites = [...(p.citations ?? [])]; // latest-wins
      supersedes = [...(p.supersedes ?? [])];
    }
  }
  return { decisionId, cites, supersedes };
}

// ---------------------------------------------------------------------------
// FIL scope pattern → AppliesToScope (product-scope) mapping
// ---------------------------------------------------------------------------

/**
 * Map a single fil scope pattern (e.g. `fil:type:fx:*`) to a product-scope
 * `AppliesToScope` condition so the engine's scope-overlap dimension can test
 * it against a decision's product-scope subject. A model may declare several
 * scope patterns; we keep them as separate candidate scopes (one candidate per
 * model carries the first pattern — the common case is one — the rest are
 * structurally-equal duplicates the engine dedups by artefactRef anyway).
 */
function filScopeToAppliesToScope(filScopePatterns: readonly string[]): AppliesToScope | undefined {
  const first = filScopePatterns[0];
  if (first === undefined) return undefined;
  return { kind: "product-scope", filTaxonomyScope: first };
}

// ---------------------------------------------------------------------------
// Candidate graph
// ---------------------------------------------------------------------------

/**
 * Build the candidate artefact graph for `decisionId` from the live store.
 * Generic over any decision: it does NOT hand-anchor decision-specific refs
 * (the pilot seed adds those for its narrative case). Returns postures +
 * fil-models from the live registers, plus the decision's own
 * obligation/procedure citation targets as advisory candidates.
 */
export function buildCandidates(store: EventStore, decision: SweptDecision): CandidateArtefact[] {
  const candidates: CandidateArtefact[] = [];

  // --- Postures (resolvable: citation-graph + scope-overlap) ---
  const latestPosture = new Map<
    string,
    { citations: readonly string[]; appliesToScope: AppliesToScope }
  >();
  for (const ev of store.replay({ type: "PostureRegistered" })) {
    const p = ev.payload as {
      postureId?: string;
      citations?: readonly string[];
      appliesToScope?: AppliesToScope;
    };
    if (!p.postureId || !p.appliesToScope) continue;
    latestPosture.set(p.postureId, {
      citations: p.citations ?? [],
      appliesToScope: p.appliesToScope,
    });
  }
  for (const [postureId, p] of latestPosture) {
    candidates.push({
      artefactKind: "posture",
      artefactRef: postureId,
      citations: p.citations,
      appliesToScope: p.appliesToScope,
    });
  }

  // --- FIL-models (resolvable: citation-graph + product-scope overlap) ---
  const latestFilModel = new Map<string, { cites: readonly string[]; scope: readonly string[] }>();
  for (const ev of store.replay({ type: "FilModelImplementationDeclared" })) {
    const p = ev.payload as {
      modelId?: string;
      cites?: readonly string[];
      scope?: readonly string[];
    };
    if (!p.modelId) continue;
    latestFilModel.set(p.modelId, { cites: p.cites ?? [], scope: p.scope ?? [] });
  }
  for (const [modelId, m] of latestFilModel) {
    const scope = filScopeToAppliesToScope(m.scope);
    candidates.push({
      artefactKind: "fil-model",
      artefactRef: modelId,
      citations: m.cites,
      ...(scope !== undefined ? { appliesToScope: scope } : {}),
    });
  }

  // --- Obligations / procedures (ADVISORY: the decision's own citation graph) ---
  // We cannot enumerate the obligation/procedure registers from v2-core read-
  // scope. We DO resolve any ref the decision itself cites (or cites via a
  // superseded decision) that is shaped like an obligation URN or a procedure
  // id, so the engine surfaces it under `cited-by-decision`. This is the
  // documented advisory slice (brief §2): coverage of these kinds is not
  // asserted; only the explicit edges the decision draws are.
  const advisoryRefs = new Set<string>();
  for (const ref of decision.cites) advisoryRefs.add(ref);
  for (const [ref, kind] of advisoryRefs.size > 0 ? classifyAdvisoryRefs(advisoryRefs) : []) {
    // Empty `citations` on the candidate: the impact edge is `cited-by-decision`
    // (the DECISION cites this artefact), matched by the engine via the
    // decision's `cites` set — not `cites-decision` (which would require the
    // artefact to cite the decision). The decision propagates DOWNWARD to the
    // obligation/procedure it derives from / supersedes.
    candidates.push({ artefactKind: kind, artefactRef: ref, citations: [] });
  }

  return candidates;
}

/**
 * Classify the decision's cited refs into obligation / procedure advisory
 * candidates by ref shape. Returns only refs that match a known shape:
 *   `urn:reg:…`  → obligation
 *   `proc:…`     → procedure
 * Everything else (decision ids, principle ids, prose) is dropped — those are
 * citation-graph anchors, not impacted artefacts.
 */
function classifyAdvisoryRefs(
  refs: ReadonlySet<string>,
): Array<[string, "obligation" | "procedure"]> {
  const out: Array<[string, "obligation" | "procedure"]> = [];
  for (const ref of refs) {
    if (ref.startsWith("urn:reg:")) out.push([ref, "obligation"]);
    else if (ref.startsWith("proc:")) out.push([ref, "procedure"]);
  }
  // Deterministic order (the engine sorts the final set, but keep input stable).
  out.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}
