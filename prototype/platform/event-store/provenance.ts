// platform/event-store/provenance.ts
//
// D-DATA-PROVENANCE-SUBSTRATE — Slice 1 + Slice 6 (combined).
//
// Typed multi-axis provenance tag carried by every event in the bank's
// event log. The substrate-level boundary between production data and
// simulated data (build phase, scenarios, counterfactuals, rehearsals)
// is encoded in the envelope, enforced at append time, and surfaced
// to every projection consumer at read time.
//
// Authority:
//   - D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10)
//   - Owner Inbox/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md §3, §4, §7
//   - Principle 1 — events are the only source of truth (provenance is a typed
//     envelope dimension, never inferred from payload)
//   - Principle 2 — every action traces to a source (provenance is a queryable
//     citation axis)
//   - Principle 5 — multi-currency / multi-entity / multi-country (provenance
//     is a structurally similar typed dimension at the envelope level)
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

import { z } from "zod";

import type { Brand } from "../types/brand.ts";

// ---------------------------------------------------------------------------
// Branded primitives
// ---------------------------------------------------------------------------

/**
 * Named scenario the event belongs to (e.g. "rehearsal-2026-Q1",
 * "stress-adverse", "01-hello-bank"). Required for `kind: 'simulated'`;
 * rejected for `kind: 'production'`.
 */
export type ScenarioId = Brand<string, "ScenarioId">;

/**
 * Finer-grained sub-classification within a scenario (e.g. "uat",
 * "regression", "counterfactual", "what-if-rate-cut-50bp"). Optional
 * for both kinds.
 */
export type VariantId = Brand<string, "VariantId">;

/**
 * Typed reference identifying the originating system or process
 * (e.g. "synthetic-bank-seed:v3", "scenario-runner:01-hello-bank",
 * "agent-runtime:atlas-2026-05-10", "ceo-decision-record"). Required
 * for both kinds; substrate enforces non-empty + registry-recognised
 * (recon-asserted, soft-fail at runtime).
 */
export type SourceLineageRef = Brand<string, "SourceLineageRef">;

/**
 * Discriminator — production vs simulated vs build-phase-fixture.
 *
 * `build-phase-fixture` is the third class introduced by
 * D-PROVENANCE-BUILD-PHASE-CLASS (CEO-approved 2026-05-22). It models
 * real bank state authored during the pre-commencement build phase —
 * the bank's own opening balances, founding capital, internal trades
 * with itself, build-phase positions — none of which are "production"
 * (no live client trades, no real custody) and none of which are
 * "simulated" (not a scenario, not a rehearsal, not a counterfactual).
 *
 * Lifecycle:
 *   - During build phase: production-grade filters (`mode: production-only`)
 *     accept BOTH `production` AND `build-phase-fixture` events. This is
 *     why BA-325 and other regulatory reports are non-empty before
 *     commencement.
 *   - At commencement-of-trading: `build-phase-fixture` is rejected by
 *     production-grade filters. A separate Slice-3 `ProvenanceReclassified`
 *     event records the in-place reclassification of surviving build-phase
 *     state to `production` at the lifecycle boundary; everything else
 *     becomes historical / archival.
 *
 * The lifecycle indicator today is the `BANK_LIFECYCLE_PHASE` env var
 * (default `"build-phase"`). A proper `bankLifecyclePhase()` query lands
 * in Slice 5.
 */
export type ProvenanceKind = "production" | "simulated" | "build-phase-fixture";

/**
 * Typed provenance tag carried by every event envelope. Mandatory
 * once `provenance-substrate-active` flips true (Slice 6 backfill
 * runs first; flag flips when canonical seeds are tagged). Immutable
 * — set at append time, never mutated thereafter.
 *
 * The type is the Zod-inferred shape (declared below the schema) so
 * the same object can be Zod-parsed and assigned to `Event['provenance']`
 * without casting. Branded primitives (ScenarioId / VariantId /
 * SourceLineageRef) are exposed above for callers that want
 * compile-time discrimination at construction; the on-the-wire JSON
 * is always plain strings.
 */

// ---------------------------------------------------------------------------
// Zod schema — enforces §4.1 cross-axis rules at append time.
// ---------------------------------------------------------------------------

export const provenanceTagSchema = z
  .object({
    kind: z.enum(["production", "simulated", "build-phase-fixture"]),
    scenario: z.string().min(1).optional(),
    variant: z.string().min(1).optional(),
    sourceLineage: z.string().min(1, {
      message:
        "ProvenanceTag.sourceLineage must be non-empty (every event traces to its originating system)",
    }),
    tags: z.array(z.string().min(1)).optional(),
  })
  .superRefine((tag, ctx) => {
    if (tag.kind === "production" && tag.scenario !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenario"],
        message:
          "ProvenanceTag: kind 'production' must not carry a scenario (production is not scenario-bound)",
      });
    }
    if (tag.kind === "simulated" && tag.scenario === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenario"],
        message:
          "ProvenanceTag: kind 'simulated' requires scenario (every simulated event must declare its scenario)",
      });
    }
    if (tag.kind === "build-phase-fixture" && tag.scenario !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenario"],
        message:
          "ProvenanceTag: kind 'build-phase-fixture' must not carry a scenario (build-phase fixtures are real bank state, not scenario-bound)",
      });
    }
  });

export type ProvenanceTag = z.infer<typeof provenanceTagSchema>;
/** @deprecated alias for backwards compatibility — use `ProvenanceTag`. */
export type ProvenanceTagShape = ProvenanceTag;

// ---------------------------------------------------------------------------
// Helpers — typed constructors so callers never hand-roll the brand.
// ---------------------------------------------------------------------------

export function scenarioId(s: string): ScenarioId {
  return s as ScenarioId;
}

export function variantId(s: string): VariantId {
  return s as VariantId;
}

export function sourceLineage(s: string): SourceLineageRef {
  return s as SourceLineageRef;
}

/** Construct a production-kind tag. */
export function productionTag(args: {
  sourceLineage: string;
  variant?: string;
  tags?: ReadonlyArray<string>;
}): ProvenanceTag {
  return {
    kind: "production",
    sourceLineage: args.sourceLineage,
    ...(args.variant !== undefined ? { variant: args.variant } : {}),
    ...(args.tags !== undefined ? { tags: [...args.tags] } : {}),
  };
}

/** Construct a simulated-kind tag. */
export function simulatedTag(args: {
  scenario: string;
  sourceLineage: string;
  variant?: string;
  tags?: ReadonlyArray<string>;
}): ProvenanceTag {
  return {
    kind: "simulated",
    scenario: args.scenario,
    sourceLineage: args.sourceLineage,
    ...(args.variant !== undefined ? { variant: args.variant } : {}),
    ...(args.tags !== undefined ? { tags: [...args.tags] } : {}),
  };
}

/**
 * Construct a build-phase-fixture-kind tag. Used for real bank state
 * authored during the pre-commencement build phase (opening balances,
 * founding capital, internal trades, build-phase positions). See
 * `ProvenanceKind` for the lifecycle semantics.
 */
export function buildPhaseFixtureTag(args: {
  sourceLineage: string;
  variant?: string;
  tags?: ReadonlyArray<string>;
}): ProvenanceTag {
  return {
    kind: "build-phase-fixture",
    sourceLineage: args.sourceLineage,
    ...(args.variant !== undefined ? { variant: args.variant } : {}),
    ...(args.tags !== undefined ? { tags: [...args.tags] } : {}),
  };
}

// ---------------------------------------------------------------------------
// Carve-outs (per pack §9 Q-PROV-NEW-2 + dispatch brief).
//
// Two event types tagged `kind: 'production'` from Slice 1 onwards even
// during the build phase, because they are real architectural commitments
// / real instructions:
//   - CeoDecision     → kind: 'production', sourceLineage: 'ceo-decision-record'
//   - AgentBriefIssued → kind: 'production', sourceLineage: 'agent-brief'
//
// Backfill (§7 #6) applies these rules retroactively. New appends without
// an explicit provenance receive these defaults via the carve-out lookup.
// All other untagged events default to the build-phase simulated tag.
// ---------------------------------------------------------------------------

export const PRODUCTION_CARVE_OUTS: Readonly<Record<string, ProvenanceTag>> = {
  CeoDecision: {
    kind: "production",
    sourceLineage: "ceo-decision-record",
  },
  AgentBriefIssued: {
    kind: "production",
    sourceLineage: "agent-brief",
  },
  // D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16) — unified
  // `Decision` event family. Same architectural-commitment provenance
  // carve-out as the legacy `CeoDecision` it subsumes.
  Decision: {
    kind: "production",
    sourceLineage: "decision-record",
  },
};

/**
 * Default tag for events without an explicit provenance during backfill
 * (and as a soft-tagger fallback for legacy appends — used only while
 * the substrate-active flag is `false`).
 */
export const PRE_SUBSTRATE_BACKFILL_TAG: ProvenanceTag = {
  kind: "simulated",
  scenario: "pre-substrate-build-phase",
  sourceLineage: "pre-substrate-backfill",
};

/**
 * Resolve the default provenance tag for an event of `eventType` that
 * was appended without an explicit `provenance` field. Carve-outs first;
 * fall back to the build-phase simulated tag.
 */
export function defaultProvenanceFor(eventType: string): ProvenanceTag {
  return PRODUCTION_CARVE_OUTS[eventType] ?? PRE_SUBSTRATE_BACKFILL_TAG;
}

// ---------------------------------------------------------------------------
// Substrate-active flag (§7 ordering note + dispatch brief).
//
// Slice 1's hard-rejection of untagged events would brick the local event
// store on first run because today's existing emitters do not carry a
// `provenance` field. The spec resolves the ordering: Slice 6 backfill
// ships first (idempotent + soft-tagger that auto-runs on store-open);
// Slice 1's hard-rejection ships second, gated on this flag, which flips
// `true` after the canonical seeds are tagged AND every emitter has been
// migrated to set provenance explicitly (or to use a carve-out type).
//
// Read order:
//   1. process.env.BANK_PROVENANCE_SUBSTRATE_ACTIVE — explicit override
//      ("true" / "1" → on; "false" / "0" → off).
//   2. setProvenanceSubstrateActive(value) — process-local pin (tests).
//   3. Process default — `false`. The combined Slice-6+1 dispatch ships
//      both pieces atomically; flag stays `false` until every emitter
//      migration is in flight (planned per pack §11 / Slices 2-8). The
//      soft-tagger heals every untagged append on the next store-open
//      so the audit-trail integrity does not depend on the flag state.
//
// Tests can pin via setProvenanceSubstrateActive(true) to exercise the
// hard-rejection path; the env var lets operators flip it on once their
// emitters are migrated.
// ---------------------------------------------------------------------------

let SUBSTRATE_ACTIVE_OVERRIDE: boolean | undefined;

export function isProvenanceSubstrateActive(): boolean {
  if (SUBSTRATE_ACTIVE_OVERRIDE !== undefined) return SUBSTRATE_ACTIVE_OVERRIDE;
  const envVal = process.env.BANK_PROVENANCE_SUBSTRATE_ACTIVE;
  if (envVal === "true" || envVal === "1") return true;
  if (envVal === "false" || envVal === "0") return false;
  return false;
}

/** Test/operator hook — pin the flag for the current process. */
export function setProvenanceSubstrateActive(value: boolean | undefined): void {
  SUBSTRATE_ACTIVE_OVERRIDE = value;
}

// ---------------------------------------------------------------------------
// Cross-reference rules (§4.2).
//
// Substrate-level append-time rule (the surface-level case that does not
// require a graph walk):
//
//   - A `kind: 'production'` event MUST NOT reference (in `citations`,
//     `payload.refersTo`, `payload.sourceEventId`, or any structurally-
//     discoverable EventId) a `kind: 'simulated'` event. Audit integrity:
//     production state can never be downstream of a rehearsal.
//   - A `kind: 'simulated'` event MAY reference any kind.
//
// The full graph walk (citation-by-EventId resolution) is Slice 5; this
// module enforces only the trivially-decidable axes: production cannot
// reference an event whose `provenance.kind` is 'simulated' when that
// referenced event is identifiable by id at append time.
//
// In Slice 1 we do *not* walk the existing event store on every append
// (would serialise the substrate against a full replay). The check below
// is exposed so consumers + Slice 5's recon can call it; the runtime
// enforcement of the trivially-decidable case lives in `event-store/store.ts`
// at append time when the caller passes `referencedProvenance`.
// ---------------------------------------------------------------------------

export interface CrossReferenceCheckArgs {
  readonly source: ProvenanceTag;
  readonly target: ProvenanceTag;
}

export interface CrossReferenceCheckResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export function checkCrossReference(args: CrossReferenceCheckArgs): CrossReferenceCheckResult {
  // Production cannot reference simulated (audit integrity).
  if (args.source.kind === "production" && args.target.kind === "simulated") {
    return {
      ok: false,
      reason:
        "Cross-reference rule violation: production event cannot reference a simulated event (audit integrity)",
    };
  }
  // Build-phase-fixture cannot reference simulated either. Build-phase
  // fixture state is real bank state — it cannot be downstream of a
  // rehearsal / counterfactual / scenario. (Build-phase fixtures may
  // reference other build-phase fixtures and may reference production
  // carve-outs such as CeoDecision / AgentBriefIssued.)
  if (args.source.kind === "build-phase-fixture" && args.target.kind === "simulated") {
    return {
      ok: false,
      reason:
        "Cross-reference rule violation: build-phase-fixture event cannot reference a simulated event (audit integrity)",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lifecycle phase indicator — Slice 1 stopgap (D-PROVENANCE-BUILD-PHASE-CLASS).
//
// The bank's commencement-of-trading lifecycle boundary determines whether
// `build-phase-fixture` events are admitted by production-grade filters.
// Slice 5 lands a proper `bankLifecyclePhase()` query backed by the event
// log; for Slice 1 we read an env var (default `"build-phase"`) and expose
// a single process-local override for tests.
//
// Read order:
//   1. setBankLifecyclePhaseOverride(value) — process-local pin (tests).
//   2. process.env.BANK_LIFECYCLE_PHASE — explicit override
//      ("build-phase" or "commencement").
//   3. Default — `"build-phase"`.
//
// TODO (Slice 5): replace this with a `bankLifecyclePhase()` query
// derived from the event log (commencement-of-trading event).
// ---------------------------------------------------------------------------

export type BankLifecyclePhase = "build-phase" | "commencement";

let LIFECYCLE_PHASE_OVERRIDE: BankLifecyclePhase | undefined;

/** Test/operator hook — pin the lifecycle phase for the current process. */
export function setBankLifecyclePhaseOverride(value: BankLifecyclePhase | undefined): void {
  LIFECYCLE_PHASE_OVERRIDE = value;
}

/**
 * Resolve the current bank lifecycle phase.
 *
 * Slice 1 stopgap: env var + override. Slice 5 will replace with a
 * canonical query over the event log.
 */
export function bankLifecyclePhase(): BankLifecyclePhase {
  if (LIFECYCLE_PHASE_OVERRIDE !== undefined) return LIFECYCLE_PHASE_OVERRIDE;
  const envVal = process.env.BANK_LIFECYCLE_PHASE;
  if (envVal === "commencement") return "commencement";
  if (envVal === "build-phase") return "build-phase";
  return "build-phase";
}
