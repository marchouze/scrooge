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

import { z } from "zod";

import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry/index";
import type { EventTypeMetadata } from "../platform/event-store/registry/index";
import type { EventStore } from "../platform/event-store/store";
import { eventMatchesProvenanceFilter } from "../platform/projections/filter";
import type { ProvenanceFilter } from "../platform/projections/filter";

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
      issuer: m.issuer,
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
    issuer: meta.issuer,
    subscribers: [...meta.subscribers].sort(),
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
