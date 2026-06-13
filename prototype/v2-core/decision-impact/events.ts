// v2-core/decision-impact/events.ts
//
// Decision-impact sweep event family (V2 S9) — the governance keystone of the
// W8 layer. When a `Decision` event lands, an automated sweep computes which
// downstream artefacts it affects — postures, FIL-Models, obligations,
// procedures — and emits a typed impact record surfacing what must be
// re-validated, re-distilled, or re-assessed.
//
//   DecisionImpactSweepRequested — a Decision triggers a sweep (decisionId,
//                                   sweptAt, triggeredBy).
//   DecisionImpactAssessed       — the result: the impacted artefacts (each with
//                                   artefactKind / artefactRef / reason / edge)
//                                   + the recommended actions.
//
// Design principle: structured-first (D-W8-DECISION-IMPACT-SWEEP). The sweep
// RECOMMENDS; agents/decisions dispose. The engine (`engine.ts`) is PURE: given
// a Decision + the artefacts that cite it + candidate scopes it computes the
// impact set; the lifecycle events are the only durable record (Principle 1).
// The register projection (`projection.ts`) folds ONLY these two events.
//
// Today a decision's downstream impact lives in an agent's working memory and a
// prose follow-on list — exactly the implicit linkage Principle 2 exists to
// eliminate. S9 turns "what does this decision touch?" into a query over the
// graph, and makes an orphaned impact a recon finding.
//
// COMPOSITION WITH S8: a Decision is one `subjectKind` of applicability-
// assessment trigger (`ApplicabilitySubjectKind = "decision"`). The S9 sweep is
// the auto-trigger that, for the scope-overlap dimension, reuses the same S3
// `AppliesToScope` evaluator the S8 assessment engine uses. S9 records its own
// typed impact family (richer than a single applicability verdict: it carries
// the multi-artefact-kind impact set + recommended actions) and cites the
// decision upward.
//
// PACKAGE BOUNDARY: this file MUST NOT import from v1 (`platform/`, `runtime/`,
// `domains/`, etc.). The no-v1-import gate (`recon:v2-no-v1-import`) enforces
// this. Imports are restricted to `zod` (npm) and intra-package relatives.
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering) on the sweep engine.

import { z } from "zod";
import {
  type CitationRef,
  type Instant,
  citationRefSchema,
  instantSchema,
} from "../fil-core/primitives";

// ---------------------------------------------------------------------------
// Impacted-artefact kinds
// ---------------------------------------------------------------------------

/**
 * The closed set of artefact kinds an S9 sweep can surface as impacted. These
 * are the four W8 artefact families a Decision can touch:
 *   `posture`    — a posture / RAS line in the S3 posture register.
 *   `fil-model`  — a FIL-Model declaration (e.g. SA-CCR).
 *   `obligation` — a regulatory obligation (URN).
 *   `procedure`  — a bank procedure.
 */
export const IMPACTED_ARTEFACT_KINDS = ["posture", "fil-model", "obligation", "procedure"] as const;

export type ImpactedArtefactKind = (typeof IMPACTED_ARTEFACT_KINDS)[number];
export const impactedArtefactKindSchema = z.enum(IMPACTED_ARTEFACT_KINDS);

// ---------------------------------------------------------------------------
// Impact edge — how the decision reaches the artefact
// ---------------------------------------------------------------------------

/**
 * The typed reason the artefact is in the impact set. Mirrors the two dimensions
 * the engine computes (Principle 2 — the edge is the graph link that justifies
 * the impact, never implicit):
 *   `cites-decision`    — the artefact carries an upward citation to the decision
 *                         (downstream consumer; the decision changed under it).
 *   `cited-by-decision` — the decision cites this artefact (the decision derives
 *                         from / supersedes it; it propagates downward).
 *   `scope-overlap`     — the artefact's APPLIES_WHEN scope intersects the
 *                         decision's subject scope (reuses the S3 evaluator).
 *   `supersedes`        — the decision supersedes a decision this artefact cites.
 */
export const IMPACT_EDGES = [
  "cites-decision",
  "cited-by-decision",
  "scope-overlap",
  "supersedes",
] as const;

export type ImpactEdge = (typeof IMPACT_EDGES)[number];
export const impactEdgeSchema = z.enum(IMPACT_EDGES);

// ---------------------------------------------------------------------------
// Recommended actions
// ---------------------------------------------------------------------------

/**
 * The closed set of actions an S9 sweep can RECOMMEND for the impacted set.
 * S9 recommends; it never executes (out of scope — structured-first: a typed
 * decision / agent run disposes the recommendation downstream).
 *   `re-validate` — an impacted FIL-Model / model artefact needs re-validation.
 *   `re-distill`  — an impacted obligation / regulatory artefact needs re-distill.
 *   `re-assess`   — an impacted posture / procedure needs an S8 applicability
 *                   re-assessment over the changed scope.
 *   `none`        — no action recommended (informational impact only).
 */
export const RECOMMENDED_ACTIONS = ["re-validate", "re-distill", "re-assess", "none"] as const;

export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];
export const recommendedActionSchema = z.enum(RECOMMENDED_ACTIONS);

// ---------------------------------------------------------------------------
// ImpactedArtefact — a single entry in the impact set
// ---------------------------------------------------------------------------

/**
 * One impacted artefact in the sweep result.
 *
 * `artefactKind` — typed discriminator (posture / fil-model / obligation / procedure).
 * `artefactRef`  — stable identifier for the artefact (posture id, FIL-Model URN,
 *                  obligation URN, procedure id / record ref).
 * `reason`       — human-readable statement of why this artefact is impacted.
 * `edge`         — the typed graph link that justifies the impact.
 */
export interface ImpactedArtefact {
  readonly artefactKind: ImpactedArtefactKind;
  readonly artefactRef: string;
  readonly reason: string;
  readonly edge: ImpactEdge;
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> for branded-primitive (CitationRef/Instant) + exactOptionalPropertyTypes compat with the rest of the v2-core families
export const impactedArtefactSchema: z.ZodType<any, any, any> = z.object({
  artefactKind: impactedArtefactKindSchema,
  artefactRef: z.string().min(1),
  reason: z.string().min(1),
  edge: impactEdgeSchema,
});

// ---------------------------------------------------------------------------
// DecisionImpactSweepRequested
// ---------------------------------------------------------------------------

/**
 * `DecisionImpactSweepRequested` — a Decision triggers a sweep.
 *
 * `sweepId`     — stable slug; convention `sweep:<decision-id>:<as-of-date>`.
 * `decisionId`  — the Decision the sweep is over (the `D-...` id).
 * `sweptAt`     — when the sweep was opened.
 * `triggeredBy` — who/what opened the sweep (an agent run id, or a seed slug).
 * `citations`   — Principle 2 upward citations (at minimum the authorising
 *                 decision for S9 + the swept decision itself).
 */
export interface DecisionImpactSweepRequestedPayload {
  readonly sweepId: string;
  readonly decisionId: string;
  readonly sweptAt: Instant;
  readonly triggeredBy: string;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> for branded-primitive (CitationRef/Instant) input/output compat
export const decisionImpactSweepRequestedPayloadSchema: z.ZodType<any, any, any> = z.object({
  sweepId: z.string().min(1),
  decisionId: z.string().min(1),
  sweptAt: instantSchema,
  triggeredBy: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// DecisionImpactAssessed
// ---------------------------------------------------------------------------

/**
 * `DecisionImpactAssessed` — the sweep result.
 *
 * `sweepId`            — folds onto the opening Requested (same id).
 * `decisionId`         — the swept Decision (carried for query convenience).
 * `impacted`           — the computed impact set (each artefact + reason + edge).
 * `recommendedActions` — the deduped, ordered set of actions the sweep
 *                        recommends over the impact set. `none` appears alone
 *                        (an empty impact set), never alongside a real action.
 * `assessedBy`         — who/what computed the impact (the engine caller).
 * `assessedAt`         — when.
 * `rationale`          — deterministic human-readable summary of the impact set.
 * `citations`          — Principle 2 upward citations.
 */
export interface DecisionImpactAssessedPayload {
  readonly sweepId: string;
  readonly decisionId: string;
  readonly impacted: readonly ImpactedArtefact[];
  readonly recommendedActions: readonly RecommendedAction[];
  readonly assessedBy: string;
  readonly assessedAt: Instant;
  readonly rationale: string;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> for branded-primitive (CitationRef/Instant) input/output compat
export const decisionImpactAssessedPayloadSchema: z.ZodType<any, any, any> = z.object({
  sweepId: z.string().min(1),
  decisionId: z.string().min(1),
  impacted: z.array(impactedArtefactSchema),
  recommendedActions: z.array(recommendedActionSchema),
  assessedBy: z.string().min(1),
  assessedAt: instantSchema,
  rationale: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// Discriminated union of all decision-impact event payloads
// ---------------------------------------------------------------------------

export type DecisionImpactEventPayload =
  | ({ readonly kind: "DecisionImpactSweepRequested" } & DecisionImpactSweepRequestedPayload)
  | ({ readonly kind: "DecisionImpactAssessed" } & DecisionImpactAssessedPayload);

export const DECISION_IMPACT_EVENT_KINDS = [
  "DecisionImpactSweepRequested",
  "DecisionImpactAssessed",
] as const;

export type DecisionImpactEventKind = (typeof DECISION_IMPACT_EVENT_KINDS)[number];
