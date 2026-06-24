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
import {
  type CategoryProvenanceMap,
  DEFAULT_CATEGORY_POLICY,
  categoryForEventType,
} from "./provenance-category.ts";

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

// ---------------------------------------------------------------------------
// Active category policy (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase C).
//
// The settable bank-wide per-category policy is event-sourced (BankModePolicySet,
// projected by projections/bank-mode.ts). To avoid coupling this low-level
// module to the event store, the projection pins the active policy here at boot
// (and on every set) via `setActiveCategoryPolicy`. When unpinned (e.g. during
// the store-open soft-tagger, before boot-sync), the static DEFAULT applies —
// which matches the legacy carve-out behaviour, so the default path is
// behaviour-neutral.
// ---------------------------------------------------------------------------

let ACTIVE_CATEGORY_POLICY: CategoryProvenanceMap | undefined;

/** Pin the active per-category provenance policy (called by the bank-mode boot-sync). */
export function setActiveCategoryPolicy(policy: CategoryProvenanceMap | undefined): void {
  ACTIVE_CATEGORY_POLICY = policy;
}

/** The active per-category policy, or the static default when unpinned. */
export function activeCategoryPolicy(): CategoryProvenanceMap {
  return ACTIVE_CATEGORY_POLICY ?? DEFAULT_CATEGORY_POLICY;
}

/**
 * Resolve the default provenance tag for an event of `eventType` appended
 * without an explicit `provenance` field.
 *
 * The provenance KIND is decided by the active per-category policy
 * (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase C): the event's category
 * (`categoryForEventType`) is looked up in the policy. Production categories
 * (governance / build under the default) return the carve-out tag when one
 * exists (to preserve its sourceLineage) or a generic production tag; simulated
 * (or unmapped) categories return the build-phase simulated tag. This
 * generalises the frozen `PRODUCTION_CARVE_OUTS` map into the settable policy.
 */
export function defaultProvenanceFor(eventType: string): ProvenanceTag {
  const category = categoryForEventType(eventType);
  const provenanceKind = category ? activeCategoryPolicy()[category] : "simulated";
  if (provenanceKind === "production") {
    return (
      PRODUCTION_CARVE_OUTS[eventType] ?? {
        kind: "production",
        sourceLineage: `category:${category}`,
      }
    );
  }
  return PRE_SUBSTRATE_BACKFILL_TAG;
}

// ---------------------------------------------------------------------------
// provenanceForEmit — the single sanctioned way for an emitter to obtain a
// provenance tag (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE, PR6 incremental-
// adoption tail).
//
// An emitter that needs a `ProvenanceTag` calls this instead of hand-rolling
// `productionTag(...)` / `simulatedTag(...)` / `PRODUCTION_CARVE_OUTS.X`.
// The provenance KIND is never chosen by the call-site: it is derived from
// the active per-category policy (`BankModePolicySet` → bank-mode projection
// → `setActiveCategoryPolicy`, falling back to `DEFAULT_CATEGORY_POLICY`).
// The call-site supplies only the axes the policy cannot know:
//
//   - `sourceLineage` — the originating system. Optional when the event type
//     carries a production carve-out (its registered lineage is used) and the
//     policy resolves production; otherwise `category:<category>` /
//     `category:uncategorised` (matching `defaultProvenanceFor`).
//   - `scenario`      — REQUIRED when the policy resolves the event's
//     category to `simulated` (every simulated event must declare its
//     scenario); ignored-with-error otherwise (production tags must not be
//     scenario-bound, so a caller passing a scenario into a production
//     resolution is a category-policy mismatch — fail loud, never drop it).
//   - `variant`/`tags` — optional pass-through on both kinds.
//
// Explicit tags (the legacy constructors) remain available ONLY for genuinely
// legitimate carve-outs — emitters whose kind is fixed by construction, not by
// bank mode (simulators, fixture ingesters, `build-phase-fixture` authors,
// one-shot backfill scripts, scenarios, tests). The static recon
// `recon:provenance-emit-discipline` allowlists exactly those; any NEW
// explicit-provenance call-site in production code is a finding.
// ---------------------------------------------------------------------------

export interface ProvenanceForEmitOpts {
  /** Originating system (e.g. "bank-mode-policy", "decision-record"). */
  readonly sourceLineage?: string;
  /** Scenario id — required iff the active policy resolves to `simulated`. */
  readonly scenario?: string;
  readonly variant?: string;
  readonly tags?: ReadonlyArray<string>;
}

/**
 * Resolve the provenance tag an emitter should attach to an event of
 * `eventType`, routing the production/simulated decision through the active
 * per-category policy. See the block comment above for the contract.
 */
export function provenanceForEmit(
  eventType: string,
  opts: ProvenanceForEmitOpts = {},
): ProvenanceTag {
  const category = categoryForEventType(eventType);
  const provenanceKind = category ? activeCategoryPolicy()[category] : "simulated";

  if (provenanceKind === "production") {
    if (opts.scenario !== undefined) {
      throw new Error(
        `provenanceForEmit: event type "${eventType}" resolves to 'production' under the active category policy (category: ${category ?? "uncategorised"}) — a scenario must not be supplied (production is not scenario-bound). If this emitter is genuinely scenario-bound, it is a carve-out: construct the tag explicitly and allowlist it in recon:provenance-emit-discipline.`,
      );
    }
    const lineage =
      opts.sourceLineage ??
      PRODUCTION_CARVE_OUTS[eventType]?.sourceLineage ??
      `category:${category ?? "uncategorised"}`;
    return productionTag({
      sourceLineage: lineage,
      ...(opts.variant !== undefined ? { variant: opts.variant } : {}),
      ...(opts.tags !== undefined ? { tags: opts.tags } : {}),
    });
  }

  if (opts.scenario === undefined) {
    throw new Error(
      `provenanceForEmit: event type "${eventType}" resolves to 'simulated' under the active category policy (category: ${category ?? "uncategorised"}) — a scenario is required (every simulated event must declare its scenario).`,
    );
  }
  return simulatedTag({
    scenario: opts.scenario,
    sourceLineage: opts.sourceLineage ?? `category:${category ?? "uncategorised"}`,
    ...(opts.variant !== undefined ? { variant: opts.variant } : {}),
    ...(opts.tags !== undefined ? { tags: opts.tags } : {}),
  });
}

// ---------------------------------------------------------------------------
// FIL-instance explicit-provenance fail-closed boundary
// (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN harden tail; sequenced under
// D-FX-INSTRUMENT-BUYSELL-QUAD, WS-FX-FIL-INTEGRITY Slice B).
//
// THE PROBLEM (root cause). FIL-instance lifecycle / settlement event types
// (FilInstrumentCreated/Amended/Terminated, FilFxSettlementConfirmed,
// FilNdfFixingObserved, TradeSettlementExecuted) are POLYMORPHIC carriers: the
// SAME type carries real anchor-book capital, real fixtures, and scenario
// stimuli. They map to category `governance` → `production` under the default
// policy, so an UNTAGGED FIL append soft-defaults to `production` —
// fail-OPEN. A throwaway fixture silently becomes production state (the
// 2026-06-22 mis-tagged-FX-fixture incident).
//
// THE FIX (this module's boundary). A FIL emit must carry an EXPLICIT
// provenance tag — never the category soft-default. We make the soft-default
// distinguishable from a real explicit tag by its `sourceLineage`: the
// soft-tagger / `defaultProvenanceFor` produce either the
// `pre-substrate-backfill` sentinel OR the bare `category:<category>` /
// `category:uncategorised` fallback (when `provenanceForEmit` is called with no
// explicit `sourceLineage`). A real emitter ALWAYS supplies a concrete
// originating-system lineage. `isSoftDefaultLineage` is the single predicate
// both the emit-boundary assertion and the `recon:fil-provenance-explicit`
// gate key on, so they cannot drift.
//
// This is FIL-SCOPED and bites NOW, WITHOUT flipping the global
// `BANK_PROVENANCE_SUBSTRATE_ACTIVE` gate (that global flip is a separate later
// follow-on — the build-phase soft-tag default stays the default for every
// non-FIL event).
// ---------------------------------------------------------------------------

/** The FIL instrument/settlement event types that must carry explicit provenance. */
export const FIL_PROVENANCE_REQUIRED_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
  "TradeSettlementExecuted",
] as const;

export type FilProvenanceRequiredEventType = (typeof FIL_PROVENANCE_REQUIRED_EVENT_TYPES)[number];

const FIL_PROVENANCE_REQUIRED_SET: ReadonlySet<string> = new Set(
  FIL_PROVENANCE_REQUIRED_EVENT_TYPES,
);

/** True iff `eventType` is a FIL instrument/settlement carrier requiring explicit provenance. */
export function isFilProvenanceRequiredType(eventType: string): boolean {
  return FIL_PROVENANCE_REQUIRED_SET.has(eventType);
}

/**
 * True iff `sourceLineage` is one of the substrate's soft-default fallbacks —
 * NOT a concrete originating-system lineage. These are the lineages a FIL event
 * acquires when it relies on the category soft-default instead of an explicit
 * emit:
 *   - `pre-substrate-backfill`        — the `PRE_SUBSTRATE_BACKFILL_TAG` sentinel.
 *   - `category:<category>` / `category:uncategorised` — `defaultProvenanceFor`
 *     and `provenanceForEmit`'s no-explicit-lineage production fallback.
 *
 * A real FIL emitter always supplies a concrete lineage (the originating
 * system: the booking engine, the settlement sink, the named seed/backfill
 * script). Both the emit-time assertion and the recon gate fail closed on a
 * soft-default lineage, so they cannot disagree.
 */
export function isSoftDefaultLineage(sourceLineage: string): boolean {
  return (
    sourceLineage === PRE_SUBSTRATE_BACKFILL_TAG.sourceLineage ||
    sourceLineage.startsWith("category:")
  );
}

/**
 * Fail-closed at the FIL emit boundary: a FIL instrument/settlement event MUST
 * carry an EXPLICIT provenance tag with a concrete originating-system lineage.
 * Throws (Engineering Charter cmd 2 — fail-closed, never a silent default) if
 * the resolved tag is a substrate soft-default. Called by the FIL `make*`
 * helpers; never relies on the global substrate-active gate.
 */
export function assertExplicitFilProvenance(eventType: string, tag: ProvenanceTag): void {
  if (isSoftDefaultLineage(tag.sourceLineage)) {
    throw new Error(
      `D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN: FIL event "${eventType}" must carry an EXPLICIT provenance tag — its sourceLineage "${tag.sourceLineage}" is a substrate soft-default (category fallback / pre-substrate-backfill), which fails OPEN for a polymorphic FIL carrier. Resolve via provenanceForEmit("${eventType}", { sourceLineage: "<originating-system>", … }) at the SUT call-site, or supply an explicit fixture/simulated tag (scripts / scenarios). See platform/event-store/provenance.ts (FIL explicit-provenance boundary).`,
    );
  }
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
