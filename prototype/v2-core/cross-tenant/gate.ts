// v2-core/cross-tenant/gate.ts
//
// CROSS-TENANT LEARNING GATE — V2 S12 (the competition-law keystone).
//
// The gate screens any LEARNING FLOW that would use one tenant's data to inform
// another tenant's postures / FIL-models / applicability assessments /
// decision-impact. It is the structural control the Competition Commission
// respects: every cross-tenant crossing passes through one named, reviewable
// screen, and the outcome is a typed, replayable event.
//
// CONTRACT
// --------
// FAIL-CLOSED. A cross-tenant flow is BLOCKED unless it screens clean against
// the active CSI blocklist — i.e. carries ZERO blocklisted category. The gate
// does NOT silently redact-and-proceed (structured-first, consistent with W8):
// a blocked flow is a typed surfaced event (`CrossTenantLearningBlocked`), a
// clean flow is a typed event (`CrossTenantLearningScreened`).
//
// WITHIN-TENANT flows (source tenant == destination tenant) are NOT cross-tenant
// and are passed through unscreened (a tenant learning from its own data is
// always permitted). Only cross-tenant flows are screened. This keeps the gate
// correctness-neutral for the single anchor tenant today, while being ACTIVE
// the moment a second tenant's learning flow appears.
//
// FAIL-CLOSED is enforced in MULTIPLE independent ways so no single bug opens
// a leak:
//   1. A flow that declares ANY CSI category present in the active blocklist is
//      blocked.
//   2. A flow whose `csiCategoriesPresent` is UNKNOWN / unscreenable (the
//      classifier could not categorise the payload) is blocked — the absence of
//      a clean classification is a block, never a pass (fail-closed on doubt).
//   3. An EMPTY blocklist does not silently pass cross-tenant flows: with no
//      categories registered the gate cannot assert a flow is clean, so it
//      blocks (the recon coverage gate also asserts the blocklist is populated).
//
// PACKAGE BOUNDARY: no v1 imports. See `recon:v2-no-v1-import`.
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE (CSI blocklist gate before C-tier
// go-live); D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s12-cross-tenant-learning-gate-csi-blocklist-:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";
import type { Instant } from "../fil-core/primitives";
import { instantSchema } from "../fil-core/primitives";
import { type CsiCategoryClass, csiCategoryClassSchema } from "./csi-blocklist";
import type { CsiBlocklist } from "./projection";

// ---------------------------------------------------------------------------
// Learning-sink kinds — what a cross-tenant flow would inform
// ---------------------------------------------------------------------------

/**
 * The closed set of W8 learning sinks a cross-tenant flow could feed. These are
 * exactly the artefacts the W8 learning layer produces, so the gate sits in
 * front of every learning-derived output:
 *   `posture`              — a posture proposal in the S3 posture register.
 *   `fil-model`            — a FIL-Model calibration / weight proposal.
 *   `applicability`        — an S8 applicability assessment.
 *   `decision-impact`      — an S9 decision-impact sweep recommendation.
 */
export const LEARNING_SINK_KINDS = [
  "posture",
  "fil-model",
  "applicability",
  "decision-impact",
] as const;

export type LearningSinkKind = (typeof LEARNING_SINK_KINDS)[number];
export const learningSinkKindSchema = z.enum(LEARNING_SINK_KINDS);

// ---------------------------------------------------------------------------
// LearningFlow — the descriptor the gate screens
// ---------------------------------------------------------------------------

/**
 * A descriptor of a learning flow presented to the gate.
 *
 * `flowId`               — stable identifier for this flow instance.
 * `sourceTenantId`       — the tenant whose data informs the flow.
 * `destinationTenantId`  — the tenant whose artefact the flow would inform.
 * `sinkKind`             — which W8 sink the flow feeds.
 * `sinkRef`              — the identifier of the artefact being informed.
 * `csiCategoriesPresent` — the CSI category CLASSES the classifier found in the
 *                          flow's payload. `undefined` means UNSCREENED /
 *                          UNKNOWN — the classifier could not categorise the
 *                          payload; the gate treats this as a BLOCK (fail-closed
 *                          on doubt), distinct from an empty array (screened and
 *                          found clean).
 */
export interface LearningFlow {
  readonly flowId: string;
  readonly sourceTenantId: string;
  readonly destinationTenantId: string;
  readonly sinkKind: LearningSinkKind;
  readonly sinkRef: string;
  readonly csiCategoriesPresent?: readonly CsiCategoryClass[];
}

export const learningFlowSchema = z
  .object({
    flowId: z.string().min(1),
    sourceTenantId: z.string().min(1),
    destinationTenantId: z.string().min(1),
    sinkKind: learningSinkKindSchema,
    sinkRef: z.string().min(1),
    csiCategoriesPresent: z.array(csiCategoryClassSchema).optional(),
  })
  .strict() as unknown as z.ZodType<LearningFlow>;

// ---------------------------------------------------------------------------
// Screening outcome
// ---------------------------------------------------------------------------

export const SCREENING_OUTCOMES = ["cleared", "blocked", "within-tenant-pass"] as const;
export type ScreeningOutcome = (typeof SCREENING_OUTCOMES)[number];

/**
 * The typed result of screening a learning flow. Structured-first: this is the
 * payload of either a `CrossTenantLearningScreened` (outcome `cleared` or
 * `within-tenant-pass`) or a `CrossTenantLearningBlocked` (outcome `blocked`)
 * event. The gate NEVER redacts and proceeds — a blocked flow is surfaced.
 *
 * `allowed`            — `true` iff the flow may proceed.
 * `blockedCategories`  — the active-blocklist classes that caused a block
 *                        (empty for cleared / within-tenant / unscreenable).
 * `reason`             — human-readable basis for the outcome.
 */
export interface ScreeningResult {
  readonly flowId: string;
  readonly outcome: ScreeningOutcome;
  readonly allowed: boolean;
  readonly isCrossTenant: boolean;
  readonly blockedCategories: readonly CsiCategoryClass[];
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Screen a learning flow against the active CSI blocklist. FAIL-CLOSED.
 *
 * Decision tree:
 *   1. Within-tenant (source == destination) → `within-tenant-pass`, allowed.
 *      A tenant learning from its own data is always permitted; the gate only
 *      guards CROSS-tenant flows.
 *   2. Cross-tenant + `csiCategoriesPresent` is `undefined` (unscreenable) →
 *      `blocked` (fail-closed on doubt). The classifier MUST positively assert
 *      a clean classification; the absence of one is never a pass.
 *   3. Cross-tenant + active blocklist is EMPTY → `blocked`. With no registered
 *      categories the gate cannot assert the flow is clean, so it blocks.
 *   4. Cross-tenant + any declared category is in the active blocklist →
 *      `blocked`, listing the offending classes.
 *   5. Cross-tenant + screened clean (no declared category is blocklisted) →
 *      `cleared`, allowed.
 *
 * @param flow      - the learning flow to screen
 * @param blocklist - the folded CSI blocklist register (active categories)
 */
export function screenCrossTenantLearningFlow(
  flow: LearningFlow,
  blocklist: CsiBlocklist,
): ScreeningResult {
  // 1. Within-tenant flows are not cross-tenant — pass through.
  if (flow.sourceTenantId === flow.destinationTenantId) {
    return {
      flowId: flow.flowId,
      outcome: "within-tenant-pass",
      allowed: true,
      isCrossTenant: false,
      blockedCategories: [],
      reason: `within-tenant flow (tenant ${flow.sourceTenantId}); not subject to the cross-tenant CSI gate`,
    };
  }

  const activeClasses = blocklist.activeClasses();

  // 2. Unscreenable — fail-closed on doubt.
  if (flow.csiCategoriesPresent === undefined) {
    return {
      flowId: flow.flowId,
      outcome: "blocked",
      allowed: false,
      isCrossTenant: true,
      blockedCategories: [],
      reason:
        "cross-tenant flow carries no CSI classification (unscreenable); FAIL-CLOSED — a flow must be positively screened clean to cross",
    };
  }

  // 3. Empty active blocklist — cannot assert clean, so block.
  if (activeClasses.size === 0) {
    return {
      flowId: flow.flowId,
      outcome: "blocked",
      allowed: false,
      isCrossTenant: true,
      blockedCategories: [],
      reason:
        "cross-tenant flow cannot be screened: the CSI blocklist register is empty (no active categories); FAIL-CLOSED",
    };
  }

  // 4. Any declared category is blocklisted → block.
  const blocked = [...new Set(flow.csiCategoriesPresent)].filter((c) => activeClasses.has(c));
  if (blocked.length > 0) {
    return {
      flowId: flow.flowId,
      outcome: "blocked",
      allowed: false,
      isCrossTenant: true,
      blockedCategories: blocked,
      reason: `cross-tenant flow carries blocklisted CSI categories [${blocked.join(", ")}] into tenant ${flow.destinationTenantId}'s ${flow.sinkKind}; BLOCKED (Competition Act 89/1998 s.4(1))`,
    };
  }

  // 5. Screened clean.
  return {
    flowId: flow.flowId,
    outcome: "cleared",
    allowed: true,
    isCrossTenant: true,
    blockedCategories: [],
    reason: `cross-tenant flow screened clean against ${activeClasses.size} active CSI categories; no blocklisted category present`,
  };
}

// ---------------------------------------------------------------------------
// Typed gate-outcome events (structured-first surfacing)
// ---------------------------------------------------------------------------

/**
 * `CrossTenantLearningScreened` — a cross-tenant (or within-tenant) flow was
 * screened and its outcome recorded. Emitted for `cleared` and
 * `within-tenant-pass` outcomes.
 */
export interface CrossTenantLearningScreenedPayload {
  readonly flowId: string;
  readonly sourceTenantId: string;
  readonly destinationTenantId: string;
  readonly sinkKind: LearningSinkKind;
  readonly sinkRef: string;
  readonly outcome: ScreeningOutcome;
  readonly screenedAt: Instant;
  readonly reason: string;
}

export const crossTenantLearningScreenedPayloadSchema = z
  .object({
    flowId: z.string().min(1),
    sourceTenantId: z.string().min(1),
    destinationTenantId: z.string().min(1),
    sinkKind: learningSinkKindSchema,
    sinkRef: z.string().min(1),
    outcome: z.enum(SCREENING_OUTCOMES),
    screenedAt: instantSchema,
    reason: z.string().min(1),
  })
  .strict() as unknown as z.ZodType<CrossTenantLearningScreenedPayload>;

/**
 * `CrossTenantLearningBlocked` — a cross-tenant flow was BLOCKED by the CSI
 * gate. The structured surfacing of a refused crossing (never a silent redact).
 * Carries the offending categories so the block is fully auditable to the
 * Competition Commission.
 */
export interface CrossTenantLearningBlockedPayload {
  readonly flowId: string;
  readonly sourceTenantId: string;
  readonly destinationTenantId: string;
  readonly sinkKind: LearningSinkKind;
  readonly sinkRef: string;
  readonly blockedCategories: readonly CsiCategoryClass[];
  readonly blockedAt: Instant;
  readonly reason: string;
}

export const crossTenantLearningBlockedPayloadSchema = z
  .object({
    flowId: z.string().min(1),
    sourceTenantId: z.string().min(1),
    destinationTenantId: z.string().min(1),
    sinkKind: learningSinkKindSchema,
    sinkRef: z.string().min(1),
    blockedCategories: z.array(csiCategoryClassSchema),
    blockedAt: instantSchema,
    reason: z.string().min(1),
  })
  .strict() as unknown as z.ZodType<CrossTenantLearningBlockedPayload>;

export type CrossTenantGateEventPayload =
  | ({ readonly kind: "CrossTenantLearningScreened" } & CrossTenantLearningScreenedPayload)
  | ({ readonly kind: "CrossTenantLearningBlocked" } & CrossTenantLearningBlockedPayload);

export const CROSS_TENANT_GATE_EVENT_KINDS = [
  "CrossTenantLearningScreened",
  "CrossTenantLearningBlocked",
] as const;

export type CrossTenantGateEventKind = (typeof CROSS_TENANT_GATE_EVENT_KINDS)[number];

/**
 * Build the typed gate-outcome event payload for a screening result. The caller
 * wraps this into a `V2Envelope` and appends it. This keeps the surfacing
 * structured-first: every screening decision becomes a replayable event.
 */
export function gateOutcomeEvent(
  flow: LearningFlow,
  result: ScreeningResult,
  screenedAt: Instant,
): CrossTenantGateEventPayload {
  if (result.outcome === "blocked") {
    return {
      kind: "CrossTenantLearningBlocked",
      flowId: flow.flowId,
      sourceTenantId: flow.sourceTenantId,
      destinationTenantId: flow.destinationTenantId,
      sinkKind: flow.sinkKind,
      sinkRef: flow.sinkRef,
      blockedCategories: result.blockedCategories,
      blockedAt: screenedAt,
      reason: result.reason,
    };
  }
  return {
    kind: "CrossTenantLearningScreened",
    flowId: flow.flowId,
    sourceTenantId: flow.sourceTenantId,
    destinationTenantId: flow.destinationTenantId,
    sinkKind: flow.sinkKind,
    sinkRef: flow.sinkRef,
    outcome: result.outcome,
    screenedAt,
    reason: result.reason,
  };
}
