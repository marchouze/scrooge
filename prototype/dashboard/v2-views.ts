// dashboard/v2-views.ts
//
// V2 UI — Human-Oversight build, first slice (Schemas & Substrate).
//
// Backs the clean `/api/v2/*` data layer with three projection-style view
// builders that read canonical sources directly (the event-type registry +
// the event store), never V1 dashboard chrome:
//
//   • buildSchemasView      → /api/v2/schemas      — full event-schema browser
//   • buildSchemaDetailView → /api/v2/schemas/:type — one event kind in detail
//   • buildSubstrateView    → /api/v2/substrate     — store + migration health
//
// Provenance: every builder takes a resolved `ProvenanceFilter` (mapped from
// the V2 header Prod / +Sim toggle by the caller) and counts only events that
// satisfy it via `eventMatchesProvenanceFilter`. The recent-event counts and
// store totals therefore reflect the mode the human is viewing.
//
// Reuse (per the approved plan — no rebuilding):
//   • EVENT_TYPE_REGISTRY / lookupEventType — platform/event-store/registry
//   • eventMatchesProvenanceFilter           — platform/projections/filter
//
// Standard: prototype/docs/v2-ui-oversight-standard.md (D-V2-UI-OVERSIGHT-STANDARD).
//
// Author: Atlas (Platform Engineering Lead).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry/index";
import type { EventTypeMetadata } from "../platform/event-store/registry/index";
import type { EventStore } from "../platform/event-store/store";
import { eventMatchesProvenanceFilter } from "../platform/projections/filter";
import type { ProvenanceFilter } from "../platform/projections/filter";
import { ownerSeatTitle, seatTitle, seatTitles } from "./agent-title";
import { getProceduresIndex } from "./procedures-index";
import { DIMENSION_METADATA, type ProductDetailView } from "./products-detail";
import { listPolicies } from "./products-policy-chain";
import { NPA_DIMENSIONS, buildProductListView } from "./products-view";
import type { DashboardState, DecisionDrillDown } from "./types";

// ---------------------------------------------------------------------------
// Zod payload introspection (top-level field shape).
// ---------------------------------------------------------------------------

/** A single top-level payload field, surfaced in the schema browser. */
export interface SchemaField {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
}

/**
 * Unwrap the modifier wrappers (optional / nullable / default / effects) that
 * Zod layers around an inner type, returning the underlying schema. Bounded
 * loop — guards against a pathological wrapper chain.
 */
function unwrapZod(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current: z.ZodTypeAny = schema;
  for (let i = 0; i < 12; i += 1) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault
    ) {
      current = current._def.innerType;
    } else if (current instanceof z.ZodEffects) {
      current = current._def.schema;
    } else {
      break;
    }
  }
  return current;
}

/** Human-readable type label for a payload field (array / enum / union expanded). */
function zodTypeLabel(schema: z.ZodTypeAny): string {
  const s = unwrapZod(schema);
  if (s instanceof z.ZodString) return "string";
  if (s instanceof z.ZodNumber) return "number";
  if (s instanceof z.ZodBoolean) return "boolean";
  if (s instanceof z.ZodDate) return "date";
  if (s instanceof z.ZodLiteral) return `literal(${JSON.stringify(s._def.value)})`;
  if (s instanceof z.ZodEnum) return `enum(${s._def.values.join(" | ")})`;
  if (s instanceof z.ZodNativeEnum) return "enum";
  if (s instanceof z.ZodArray) return `${zodTypeLabel(s._def.type)}[]`;
  if (s instanceof z.ZodObject) return "object";
  if (s instanceof z.ZodRecord) return "record";
  if (s instanceof z.ZodUnion) {
    return s._def.options.map((o: z.ZodTypeAny) => zodTypeLabel(o)).join(" | ");
  }
  if (s instanceof z.ZodTuple) return "tuple";
  // Fallback to the def's typeName (e.g. "ZodAny" → "any").
  const typeName = s._def?.typeName;
  return typeof typeName === "string" ? typeName.replace(/^Zod/, "").toLowerCase() : "unknown";
}

/** True when the field is optional (optional / default wrapper, or Zod reports it). */
function zodIsOptional(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return true;
  return schema.isOptional();
}

/**
 * Describe a payload schema's top-level fields. Returns null when the schema
 * is absent (envelope-only event) or not a plain object at the top level.
 */
export function describePayloadSchema(
  schema: z.ZodType<Record<string, unknown>> | undefined,
): SchemaField[] | null {
  if (!schema) return null;
  const root = unwrapZod(schema as z.ZodTypeAny);
  if (!(root instanceof z.ZodObject)) return null;
  const shape = root.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape)
    .map(([name, field]) => ({
      name,
      type: zodTypeLabel(field),
      optional: zodIsOptional(field),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Event counting (provenance-filtered).
// ---------------------------------------------------------------------------

interface CountResult {
  readonly total: number;
  readonly byType: ReadonlyMap<string, number>;
  readonly byKind: { production: number; simulated: number; buildPhaseFixture: number };
  readonly byClass: Record<string, number>;
}

/** Single pass over the store, applying the provenance filter once. */
function countEvents(store: EventStore, filter: ProvenanceFilter): CountResult {
  const byType = new Map<string, number>();
  const byKind = { production: 0, simulated: 0, buildPhaseFixture: 0 };
  const byClass: Record<string, number> = {
    runtime: 0,
    markets: 0,
    governance: 0,
    audit: 0,
    unregistered: 0,
  };
  let total = 0;
  for (const e of store.replay({})) {
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    total += 1;
    byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
    const kind = e.provenance?.kind ?? "simulated";
    if (kind === "production") byKind.production += 1;
    else if (kind === "build-phase-fixture") byKind.buildPhaseFixture += 1;
    else byKind.simulated += 1;
    const cls = lookupEventType(e.type)?.class ?? "unregistered";
    byClass[cls] = (byClass[cls] ?? 0) + 1;
  }
  return { total, byType, byKind, byClass };
}

// ---------------------------------------------------------------------------
// /api/v2/schemas — full event-schema browser.
// ---------------------------------------------------------------------------

export interface SchemaRow {
  readonly type: string;
  readonly class: EventTypeMetadata["class"];
  readonly status: "active" | "deprecated";
  readonly supersededBy?: string;
  readonly issuer: string;
  readonly subscriberCount: number;
  readonly replay: EventTypeMetadata["replay"];
  readonly retentionTier: string;
  readonly retentionYears: number;
  readonly citationRef: string;
  readonly v2Status: EventTypeMetadata["v2Status"];
  readonly hasSchema: boolean;
  readonly fieldCount: number | null;
  readonly recentCount: number;
  readonly source: string;
}

export interface SchemasView {
  readonly asOf: string;
  readonly summary: {
    readonly totalKinds: number;
    readonly active: number;
    readonly deprecated: number;
    readonly v2: {
      readonly v1Only: number;
      readonly v2Parallel: number;
      readonly v2Replaced: number;
    };
    readonly withSchema: number;
    readonly withoutSchema: number;
    readonly totalEventsObserved: number;
  };
  readonly eventKinds: readonly SchemaRow[];
}

export function buildSchemasView(
  store: EventStore,
  filter: ProvenanceFilter,
  asOf: string,
): SchemasView {
  const counts = countEvents(store, filter);

  let active = 0;
  let deprecated = 0;
  let withSchema = 0;
  const v2 = { v1Only: 0, v2Parallel: 0, v2Replaced: 0 };

  const eventKinds: SchemaRow[] = EVENT_TYPE_REGISTRY.map((m) => {
    const status = m.status ?? "active";
    if (status === "deprecated") deprecated += 1;
    else active += 1;
    const fields = describePayloadSchema(m.payloadSchema);
    if (fields !== null) withSchema += 1;
    if (m.v2Status === "v1-only") v2.v1Only += 1;
    else if (m.v2Status === "v2-parallel") v2.v2Parallel += 1;
    else v2.v2Replaced += 1;

    return {
      type: m.type,
      class: m.class,
      status,
      ...(m.supersededBy ? { supersededBy: m.supersededBy } : {}),
      issuer: seatTitle(m.issuer),
      subscriberCount: m.subscribers.length,
      replay: m.replay,
      retentionTier: m.retention.archivalTier,
      retentionYears: m.retention.minimumYears,
      citationRef: m.retention.citationRef,
      v2Status: m.v2Status,
      hasSchema: fields !== null,
      fieldCount: fields ? fields.length : null,
      recentCount: counts.byType.get(m.type) ?? 0,
      source: m.source,
    };
  }).sort((a, b) => a.type.localeCompare(b.type));

  return {
    asOf,
    summary: {
      totalKinds: EVENT_TYPE_REGISTRY.length,
      active,
      deprecated,
      v2,
      withSchema,
      withoutSchema: EVENT_TYPE_REGISTRY.length - withSchema,
      totalEventsObserved: counts.total,
    },
    eventKinds,
  };
}

// ---------------------------------------------------------------------------
// /api/v2/schemas/:type — one event kind in detail.
// ---------------------------------------------------------------------------

export interface SchemaDetailView {
  readonly asOf: string;
  readonly type: string;
  readonly class: EventTypeMetadata["class"];
  readonly status: "active" | "deprecated";
  readonly supersededBy?: string;
  readonly issuer: string;
  readonly subscribers: readonly string[];
  readonly replay: EventTypeMetadata["replay"];
  readonly retention: {
    readonly minimumYears: number;
    readonly archivalTier: string;
    readonly citationRef: string;
  };
  readonly v2Status: EventTypeMetadata["v2Status"];
  readonly source: string;
  readonly citationsHint: readonly string[];
  readonly payloadFields: readonly SchemaField[] | null;
  readonly recentCount: number;
  readonly recentExamples: ReadonlyArray<{
    readonly event_id: string;
    readonly as_of: string;
    readonly entity: string;
    readonly actor: { readonly type: string; readonly id: string };
    readonly provenanceKind: string;
    readonly payload: Record<string, unknown>;
  }>;
}

const MAX_EXAMPLES = 3;

export function buildSchemaDetailView(
  store: EventStore,
  type: string,
  filter: ProvenanceFilter,
  asOf: string,
): SchemaDetailView | null {
  const meta = lookupEventType(type);
  if (!meta) return null;

  let recentCount = 0;
  const examples: SchemaDetailView["recentExamples"][number][] = [];
  // Replay this type in sequence order; keep a rolling window of the latest
  // examples that satisfy the provenance filter.
  for (const e of store.replay({ type })) {
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    recentCount += 1;
    examples.push({
      event_id: e.event_id,
      as_of: e.as_of,
      entity: e.entity,
      actor: e.actor,
      provenanceKind: e.provenance?.kind ?? "simulated",
      payload: e.payload,
    });
    if (examples.length > MAX_EXAMPLES) examples.shift();
  }

  return {
    asOf,
    type: meta.type,
    class: meta.class,
    status: meta.status,
    ...(meta.supersededBy ? { supersededBy: meta.supersededBy } : {}),
    issuer: seatTitle(meta.issuer),
    subscribers: seatTitles(meta.subscribers),
    replay: meta.replay,
    retention: {
      minimumYears: meta.retention.minimumYears,
      archivalTier: meta.retention.archivalTier,
      citationRef: meta.retention.citationRef,
    },
    v2Status: meta.v2Status,
    source: meta.source,
    citationsHint: meta.citationsHint ? [...meta.citationsHint] : [],
    payloadFields: describePayloadSchema(meta.payloadSchema),
    recentCount,
    recentExamples: examples.slice().reverse(),
  };
}

// ---------------------------------------------------------------------------
// /api/v2/substrate — store + migration + recon health.
// ---------------------------------------------------------------------------

export interface SubstrateView {
  readonly asOf: string;
  readonly store: {
    readonly totalEvents: number;
    readonly byKind: {
      readonly production: number;
      readonly simulated: number;
      readonly buildPhaseFixture: number;
    };
    readonly byClass: Record<string, number>;
  };
  readonly migration: {
    readonly totalRegistered: number;
    readonly v1Only: number;
    readonly v2Parallel: number;
    readonly v2Replaced: number;
  };
  readonly retentionTiers: ReadonlyArray<{ readonly tier: string; readonly count: number }>;
  readonly recon: {
    readonly pipelines: number;
    readonly passing: number;
    readonly failing: number;
    readonly advisory: number;
    readonly latest: ReadonlyArray<{
      readonly pipeline: string;
      readonly ok: boolean;
      readonly asOf: string;
      readonly failViolations: number;
      readonly warnViolations: number;
    }>;
  };
}

export function buildSubstrateView(
  store: EventStore,
  filter: ProvenanceFilter,
  asOf: string,
): SubstrateView {
  const counts = countEvents(store, filter);

  const migration = {
    totalRegistered: EVENT_TYPE_REGISTRY.length,
    v1Only: 0,
    v2Parallel: 0,
    v2Replaced: 0,
  };
  const tierCounts = new Map<string, number>();
  for (const m of EVENT_TYPE_REGISTRY) {
    if (m.v2Status === "v1-only") migration.v1Only += 1;
    else if (m.v2Status === "v2-parallel") migration.v2Parallel += 1;
    else migration.v2Replaced += 1;
    tierCounts.set(m.retention.archivalTier, (tierCounts.get(m.retention.archivalTier) ?? 0) + 1);
  }

  // Latest ReconResult per pipeline (by as_of). ReconResult is governance —
  // not provenance-narrowed (recon health is a control-plane fact, not a
  // book figure), so we read it unfiltered.
  const latestByPipeline = new Map<
    string,
    { ok: boolean; asOf: string; fail: number; warn: number }
  >();
  for (const e of store.replay({ type: "ReconResult" })) {
    const pipeline = typeof e.payload.pipeline === "string" ? e.payload.pipeline : "(unknown)";
    const prev = latestByPipeline.get(pipeline);
    if (!prev || e.as_of > prev.asOf) {
      latestByPipeline.set(pipeline, {
        ok: e.payload.ok === true,
        asOf: e.as_of,
        fail: typeof e.payload.failViolations === "number" ? e.payload.failViolations : 0,
        warn: typeof e.payload.warnViolations === "number" ? e.payload.warnViolations : 0,
      });
    }
  }
  let passing = 0;
  let failing = 0;
  let advisory = 0;
  const latest = [...latestByPipeline.entries()]
    .map(([pipeline, r]) => {
      if (!r.ok) failing += 1;
      else if (r.warn > 0) advisory += 1;
      else passing += 1;
      return { pipeline, ok: r.ok, asOf: r.asOf, failViolations: r.fail, warnViolations: r.warn };
    })
    .sort((a, b) => {
      // Failing first, then advisory, then by pipeline name.
      if (a.ok !== b.ok) return a.ok ? 1 : -1;
      return a.pipeline.localeCompare(b.pipeline);
    });

  return {
    asOf,
    store: {
      totalEvents: counts.total,
      byKind: counts.byKind,
      byClass: counts.byClass,
    },
    migration,
    retentionTiers: [...tierCounts.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => a.tier.localeCompare(b.tier)),
    recon: {
      pipelines: latestByPipeline.size,
      passing,
      failing,
      advisory,
      latest,
    },
  };
}

// ---------------------------------------------------------------------------
// /api/v2/npa — New Product Approval register (Governance).
// ---------------------------------------------------------------------------
//
// Reuses the canonical buildProductListView projection (15-dimension NPA model,
// D-NEW-PRODUCT-APPROVAL-POLICY) and reshapes it into a register summary + rows.
// The detail page reuses buildProductDetailView directly in the route handler.

export interface NpaRow {
  readonly productId: string;
  readonly name: string;
  readonly family: string;
  readonly lifecycle: string;
  readonly approvalStatus: string;
  readonly attestedCount: number;
  readonly totalDimensions: number;
  readonly gateReady: boolean;
  readonly deferredGapCount: number;
  readonly hasOpenCriticalFinding: boolean;
  readonly origin: string;
}

export interface NpaView {
  readonly asOf: string;
  readonly summary: {
    readonly total: number;
    readonly approved: number;
    readonly pending: number;
    readonly withheld: number;
    readonly launched: number;
    readonly awaitingAttestation: number;
    readonly openDeferredGaps: number;
    readonly openCriticalFindings: number;
    readonly totalDimensions: number;
  };
  readonly products: readonly NpaRow[];
}

export function buildNpaRegisterView(store: EventStore, asOf: string): NpaView {
  const list = buildProductListView(store, asOf);

  let approved = 0;
  let pending = 0;
  let withheld = 0;
  let launched = 0;
  let awaitingAttestation = 0;
  let openDeferredGaps = 0;
  let openCriticalFindings = 0;

  const products: NpaRow[] = list.products.map((p) => {
    if (p.approval.status === "approved") approved += 1;
    else if (p.approval.status === "withheld") withheld += 1;
    else pending += 1;
    if (p.lifecycle === "launched") launched += 1;
    if (!p.npaGateStatus.ready) awaitingAttestation += 1;
    openDeferredGaps += p.deferredGaps.length;
    if (p.hasOpenCriticalFinding) openCriticalFindings += 1;

    return {
      productId: p.productId,
      name: p.name,
      family: p.family,
      lifecycle: p.lifecycle,
      approvalStatus: p.approval.status,
      attestedCount: p.npaGateStatus.attestedCount,
      totalDimensions: p.npaGateStatus.totalDimensions,
      gateReady: p.npaGateStatus.ready,
      deferredGapCount: p.deferredGaps.length,
      hasOpenCriticalFinding: p.hasOpenCriticalFinding,
      origin: p.origin,
    };
  });

  products.sort((a, b) => a.name.localeCompare(b.name));

  return {
    asOf,
    summary: {
      total: products.length,
      approved,
      pending,
      withheld,
      launched,
      awaitingAttestation,
      openDeferredGaps,
      openCriticalFindings,
      totalDimensions: NPA_DIMENSIONS.length,
    },
    products,
  };
}

/**
 * Redact agent personal names from an NPA product-detail view before it crosses
 * the /api/v2 boundary (no-agent-names rule). Keeps role/seat Titles
 * (owner.position, narrative author position) and timestamps; blanks the
 * name-bearing fields (owner.name, attestedBy, narrative author name,
 * finding discoveredBy / reviewedBy) so no client can render a name.
 */
/**
 * Strip the leading agent name from a gap-owner seat string. Owners are authored
 * as "Name (Position, domain)"; the no-agent-names rule keeps only the seat —
 * "(Position, domain)". A bare position passes through unchanged.
 */
function redactGapOwner(owner: string): string {
  const m = owner.match(/^[^(]+\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : owner;
}

/**
 * Agent personal-name → seat-role map, derived from the NPA dimension owners.
 * The first word of each `owner.name` is the agent's personal name; the bare
 * role (the part of `owner.position` before the parenthetical domain) is the
 * seat it redacts to. Used to scrub agent names that are baked into the
 * dimension `artefactRequired` / `failRule` PROSE — those free-text fields are
 * surfaced per-dimension on the V2 NPA page (perspective-switcher dossier), so
 * any name in them would cross the /api/v2 boundary unless stripped here
 * (no-agent-names rule; the structured name fields are blanked separately).
 */
const AGENT_NAME_TO_SEAT: ReadonlyMap<string, string> = new Map(
  DIMENSION_METADATA.flatMap((m) => {
    const personal = m.owner.name.trim().split(/\s+/)[0];
    const role = m.owner.position.replace(/\s*\([^)]*\)\s*$/, "").trim();
    return personal.length > 0 && role.length > 0 ? ([[personal, role]] as [string, string][]) : [];
  }),
);

/**
 * Replace any baked-in agent personal name in a free-text dimension field with
 * its seat role (e.g. "per Nadia methodology" → "per the Model risk engineer
 * methodology"; "Helena's Model Risk Policy" → "the Chief Risk Officer's Model
 * Risk Policy"). Word-boundary match; possessive `'s` preserved. A field with
 * no agent name passes through unchanged.
 */
function redactNamesInProse(text: string): string {
  let out = text;
  for (const [name, seat] of AGENT_NAME_TO_SEAT) {
    // Absorb an optional preceding "the " so "the Nadia methodology" collapses
    // to "the Model risk engineer methodology" (not "the the …"). Case-insensitive
    // on the article only; the name match stays word-bounded.
    out = out.replace(new RegExp(`\\b(?:[Tt]he\\s+)?${name}\\b`, "g"), `the ${seat}`);
  }
  return out;
}

export function redactNpaDetailNames(detail: ProductDetailView): ProductDetailView {
  // The presentation surfaces (overview / variants / componentGraph / lenses)
  // are name-free by construction — desk seats arrive as Titles from the desk
  // roster, and every other field is structural/regulatory. The ONE exception is
  // the valuation-lens gap owner, which is authored name+position → stripped to
  // the seat here. Only the attestation/finding fields carry agent ids besides.
  return {
    ...detail,
    lenses: {
      ...detail.lenses,
      valuation: detail.lenses.valuation.map((dom) =>
        dom.gap ? { ...dom, gap: { ...dom.gap, owner: redactGapOwner(dom.gap.owner) } } : dom,
      ),
    },
    // The Accounting/CFO perspective is name-free by construction (legs / codes /
    // CoA names / IAS cites are all structural); the ONE authored name is a
    // deferred posting rule's tracked-gap owner → stripped to the seat.
    ...(detail.accountingPerspective
      ? {
          accountingPerspective: {
            ...detail.accountingPerspective,
            stages: detail.accountingPerspective.stages.map((st) => ({
              ...st,
              postingRules: st.postingRules.map((pr) =>
                pr.gap
                  ? { ...pr, gap: { ...pr.gap, owner: redactGapOwner(pr.gap.owner) } }
                  : pr,
              ),
            })),
          },
        }
      : {}),
    dimensions: detail.dimensions.map((card) => ({
      ...card,
      owner: { ...card.owner, name: "" },
      // The dimension's free-text artefact / fail-rule prose can name an agent
      // (e.g. "per Nadia methodology"); strip those to the seat role so no name
      // crosses the boundary now that these fields are surfaced per-dimension.
      artefactRequired: redactNamesInProse(card.artefactRequired),
      failRule: redactNamesInProse(card.failRule),
      attestation: { ...card.attestation, attestedBy: undefined },
      narrative: card.narrative ? { ...card.narrative, authorAgentName: "" } : null,
    })),
    postApprovalFindings: detail.postApprovalFindings.map((f) => ({
      ...f,
      discoveredBy: "",
      review: f.review ? { ...f.review, reviewedBy: "" } : undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// /api/v2/decisions — Decision register (Governance).
// ---------------------------------------------------------------------------
//
// Reads the cached DashboardState decision projection (folds Decision +
// legacy CeoDecision events + escalation-derived open items). Owner / actioned-
// by are mapped to seat Titles (no-agent-names rule).

export interface OpenDecisionRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly domainCategory?: string;
  readonly authority: string;
  readonly owner: string;
  readonly decisionForCEO: string;
}

export interface ResolvedDecisionRow {
  readonly id: string;
  readonly title: string;
  readonly actionedAt: string;
  readonly outcome: string;
  readonly domainCategory?: string;
  readonly actionedBy?: string;
}

export interface DecisionsView {
  readonly asOf: string;
  readonly summary: {
    readonly open: number;
    readonly resolved: number;
    readonly authorities: number;
    readonly categories: number;
  };
  readonly open: readonly OpenDecisionRow[];
  readonly resolved: readonly ResolvedDecisionRow[];
}

export function buildDecisionsView(state: DashboardState, asOf: string): DecisionsView {
  const open: OpenDecisionRow[] = state.decisionsOpen.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    ...(d.domainCategory ? { domainCategory: d.domainCategory } : {}),
    authority: d.authority ?? "—",
    owner: ownerSeatTitle(d.owner),
    decisionForCEO: d.decisionForCEO,
  }));
  const resolved: ResolvedDecisionRow[] = state.decisionsResolved
    .map((d) => ({
      id: d.id,
      title: d.title,
      actionedAt: d.actionedAt,
      outcome: d.outcome,
      ...(d.domainCategory ? { domainCategory: d.domainCategory } : {}),
      ...(d.actionedBy ? { actionedBy: ownerSeatTitle(d.actionedBy) } : {}),
    }))
    .sort((a, b) => (a.actionedAt < b.actionedAt ? 1 : -1));

  const authorities = new Set(
    state.decisionsOpen.map((d) => d.authority).filter((a): a is string => Boolean(a)),
  );
  const categories = new Set(
    [
      ...state.decisionsOpen.map((d) => d.domainCategory ?? d.category),
      ...state.decisionsResolved.map((d) => d.domainCategory),
    ].filter((c): c is string => Boolean(c)),
  );

  return {
    asOf,
    summary: {
      open: open.length,
      resolved: resolved.length,
      authorities: authorities.size,
      categories: categories.size,
    },
    open,
    resolved,
  };
}

/**
 * Redact agent personal names from a decision drill-down before it crosses the
 * /api/v2 boundary (no-agent-names rule). Maps owner / actioned-by / comment
 * authors / escalation parties to seat Titles; keeps timestamps, citations,
 * bodies, and outcomes.
 */
export function redactDecisionDetailNames(detail: DecisionDrillDown): DecisionDrillDown {
  return {
    ...detail,
    ...(detail.open ? { open: { ...detail.open, owner: ownerSeatTitle(detail.open.owner) } } : {}),
    ...(detail.resolution
      ? {
          resolution: {
            ...detail.resolution,
            ...(detail.resolution.actionedBy
              ? { actionedBy: ownerSeatTitle(detail.resolution.actionedBy) }
              : {}),
          },
        }
      : {}),
    ...(detail.escalation
      ? {
          escalation: {
            ...detail.escalation,
            raisedBy: ownerSeatTitle(detail.escalation.raisedBy),
            routedTo: ownerSeatTitle(detail.escalation.routedTo),
            currentResponsible: ownerSeatTitle(detail.escalation.currentResponsible),
          },
        }
      : {}),
    comments: detail.comments.map((c) => ({ ...c, author: ownerSeatTitle(c.author), actorId: "" })),
  };
}

// ---------------------------------------------------------------------------
// /api/v2/policies + /api/v2/procedures — governance document viewers.
// ---------------------------------------------------------------------------
//
// Principle 2: policy heads the executable chain → procedure → capability.
// Registers read the filesystem index (listPolicies / getProceduresIndex);
// detail views add the rendered document body + the up/down chain links.
// Owners are mapped to seat Titles (no-agent-names rule); the document body
// itself is rendered verbatim (it is the authored source, not an attribution).

const NO_DOTDOT = (f: string): boolean =>
  !f.includes("/") && !f.includes("\\") && !f.includes("..") && f.toLowerCase().endsWith(".md");

export interface PolicyRow {
  readonly policyId: string;
  readonly filename: string;
  readonly title: string;
  readonly owner: string;
  readonly status: string;
}

export interface PoliciesView {
  readonly asOf: string;
  readonly summary: { readonly total: number; readonly byStatus: Record<string, number> };
  readonly rows: readonly PolicyRow[];
}

export function buildPoliciesView(repoRoot: string, asOf: string): PoliciesView {
  const byStatus: Record<string, number> = {};
  const rows: PolicyRow[] = listPolicies(repoRoot).map((p) => {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    return {
      policyId: p.policyId,
      filename: p.filename,
      title: p.title,
      owner: ownerSeatTitle(p.owner),
      status: p.status,
    };
  });
  return { asOf, summary: { total: rows.length, byStatus }, rows };
}

export interface PolicyDetailView {
  readonly asOf: string;
  readonly meta: PolicyRow;
  readonly markdown: string;
  readonly procedures: ReadonlyArray<{
    readonly file: string;
    readonly title: string;
    readonly owner: string;
    readonly status: string;
  }>;
}

export function buildPolicyDetailView(
  repoRoot: string,
  filename: string,
  asOf: string,
): PolicyDetailView | null {
  if (!NO_DOTDOT(filename)) return null;
  const p = listPolicies(repoRoot).find((x) => x.filename === filename);
  if (!p) return null;
  const path = join(repoRoot, "Policies", filename);
  const markdown = existsSync(path) ? readFileSync(path, "utf8") : "";

  // Child procedures — policyParent referencing this policy's id / title /
  // basename. Loose match (the frontmatter cites whichever form the author used).
  const keys = new Set(
    [p.policyId, p.title, filename.replace(/\.md$/, "")]
      .filter(Boolean)
      .map((k) => k.trim().toLowerCase()),
  );
  const procedures = getProceduresIndex(repoRoot)
    .groups.flatMap((g) => g.rows)
    .filter(
      (r) => r.procedureFile && r.policyParent && keys.has(r.policyParent.trim().toLowerCase()),
    )
    .map((r) => ({
      file: r.procedureFile,
      title: r.procedureTitle || r.procedureLabel || r.procedureFile,
      owner: ownerSeatTitle(r.owner),
      status: r.status,
    }));

  return {
    asOf,
    meta: {
      policyId: p.policyId,
      filename: p.filename,
      title: p.title,
      owner: ownerSeatTitle(p.owner),
      status: p.status,
    },
    markdown,
    procedures,
  };
}

export interface ProcedureViewRow {
  readonly procedureFile: string;
  readonly procedureId: string;
  readonly title: string;
  readonly owner: string;
  readonly status: string;
  readonly policyParent: string;
  readonly lastReviewed: string;
  readonly reconciliationCadence: string;
  readonly orphan: boolean;
  readonly verifyHints: readonly string[];
}

export interface ProceduresView {
  readonly asOf: string;
  readonly summary: {
    readonly count: number;
    readonly authored: number;
    readonly orphans: number;
    readonly statusCounts: Record<string, number>;
  };
  readonly groups: ReadonlyArray<{
    readonly domain: string;
    readonly rows: readonly ProcedureViewRow[];
  }>;
}

export function buildProceduresView(repoRoot: string, asOf: string): ProceduresView {
  const idx = getProceduresIndex(repoRoot);
  return {
    asOf,
    summary: {
      count: idx.count,
      authored: idx.authoredCount,
      orphans: idx.orphanCount,
      statusCounts: idx.statusCounts,
    },
    groups: idx.groups.map((g) => ({
      domain: g.domain,
      rows: g.rows.map((r) => ({
        procedureFile: r.procedureFile,
        procedureId: r.procedureId,
        title: r.procedureTitle || r.procedureLabel || r.procedureFile,
        owner: ownerSeatTitle(r.owner),
        status: r.status,
        policyParent: r.policyParent,
        lastReviewed: r.lastReviewed,
        reconciliationCadence: r.reconciliationCadence,
        orphan: r.orphan,
        verifyHints: r.verifyHints,
      })),
    })),
  };
}

export interface ProcedureDetailView {
  readonly asOf: string;
  readonly meta: ProcedureViewRow & { readonly domain: string };
  readonly markdown: string;
}

export function buildProcedureDetailView(
  repoRoot: string,
  filename: string,
  asOf: string,
): ProcedureDetailView | null {
  if (!NO_DOTDOT(filename)) return null;
  const idx = getProceduresIndex(repoRoot);
  let found: { domain: string; row: ProcedureViewRow } | null = null;
  for (const g of idx.groups) {
    const r = g.rows.find((x) => x.procedureFile === filename && !x.orphan);
    if (r) {
      found = {
        domain: g.domain,
        row: {
          procedureFile: r.procedureFile,
          procedureId: r.procedureId,
          title: r.procedureTitle || r.procedureLabel || r.procedureFile,
          owner: ownerSeatTitle(r.owner),
          status: r.status,
          policyParent: r.policyParent,
          lastReviewed: r.lastReviewed,
          reconciliationCadence: r.reconciliationCadence,
          orphan: r.orphan,
          verifyHints: r.verifyHints,
        },
      };
      break;
    }
  }
  if (!found) return null;
  const path = join(repoRoot, "Procedures", "by-policy", filename);
  const markdown = existsSync(path) ? readFileSync(path, "utf8") : "";
  return { asOf, meta: { ...found.row, domain: found.domain }, markdown };
}

// ---------------------------------------------------------------------------
// Toggle → filter mapping (shared by the route handlers).
// ---------------------------------------------------------------------------

/**
 * Map the V2 header provenance toggle (`prod` | `prod+sim`) to a
 * `ProvenanceFilter`. Default (no/unknown param) is `production-only` —
 * matches the toggle's default state in `_v2-shell.js`.
 */
export function provenanceFilterFromMode(mode: string | null): ProvenanceFilter {
  return mode === "prod+sim" ? { mode: "combined" } : { mode: "production-only" };
}
