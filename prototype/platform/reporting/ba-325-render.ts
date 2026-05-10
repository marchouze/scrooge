// platform/reporting/ba-325-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — JSON renderer for the
// BA 325 (LCR) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 3, Marc's Q5 default
// (JSON-first; PDF / HTML are a downstream rendering slice).
//
// The render layer takes the typed `Ba325Output` from `ba-325-lcr.ts` and
// produces a JSON document that:
//   - validates against the declared `Ba325RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical bytes);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` per Slice 5);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Architectural placement:
//
//   BA 325 PROJECTION (typed Ba325Output)
//      → THIS RENDERER  → Uint8Array of canonical JSON bytes
//      → RMS DOC STORE (BLAKE3-hashed; PR #142 substrate)
//      → REPORTGENERATED EVENT (Slice 5; cites the hash + the schema id)
//      → SARB PORTAL XML (Slice 5; transforms canonical JSON)
//
// Determinism: `JSON.stringify` does not guarantee key ordering. We sort
// keys via a deterministic walker so two runs over the same projection
// produce the same bytes (exit-criterion for the recon test).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer + JSON-schema integration)
//   + Eitan (Treasurer, governance — reports to Camille CFO; LCR-line
//   labelling reviewer).

import { z } from "zod";

import type { Ba325Output } from "./ba-325-lcr";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba325LineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  subCategory: z.string().min(1).optional(),
  note: z.string().optional(),
});

const ba325HqlaLevelSchema = z.object({
  stockMinor: z.number().int().nonnegative(),
  preCapContributionMinor: z.number().int().nonnegative(),
  contributionMinor: z.number().int().nonnegative(),
  capBindingIndicator: z.boolean(),
  lineItems: z.array(ba325LineItemSchema),
});

const ba325HqlaLevel1Schema = z.object({
  stockMinor: z.number().int().nonnegative(),
  contributionMinor: z.number().int().nonnegative(),
  lineItems: z.array(ba325LineItemSchema),
});

/**
 * Canonical JSON schema for a rendered BA 325. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard pixel-perfect view)
 * validate inputs against this shape.
 */
export const Ba325RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-325/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 325"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    trialBalanceSnapshotEventId: z.string().min(1).optional(),
    classificationsFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  hqla: z.object({
    level1: ba325HqlaLevel1Schema,
    level2A: ba325HqlaLevelSchema,
    level2B: ba325HqlaLevelSchema,
    totalStockHqlaMinor: z.number().int().nonnegative(),
  }),
  cashFlows: z.object({
    outflows: z.object({
      grossMinor: z.number().int().nonnegative(),
      lineItems: z.array(ba325LineItemSchema),
    }),
    inflows: z.object({
      grossMinor: z.number().int().nonnegative(),
      cappedMinor: z.number().int().nonnegative(),
      capBindingIndicator: z.boolean(),
      lineItems: z.array(ba325LineItemSchema),
    }),
    netCashOutflowsMinor: z.number().int().nonnegative(),
    netCashOutflowFloorBindingIndicator: z.boolean(),
  }),
  /**
   * LCR encoded as a string to preserve `Infinity` (which is not valid
   * JSON). The renderer encodes finite ratios as `"1.234"` (4 decimals)
   * and the divide-by-zero case as `"infinity"`.
   */
  lcrRatio: z.string().min(1),
  /** Render-side percentage form for the SARB BA 325 cell display. */
  lcrPercent: z.string().min(1),
  lcrCompliant: z.boolean(),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba325Render = z.infer<typeof Ba325RenderSchema>;

export const BA_325_SCHEMA_URL = "https://hoz.bank/schemas/ba-325/v0.1-rehearsal.json";
export const BA_325_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa325Options {
  /**
   * ISO-8601 timestamp the render was produced at. Optional — when
   * omitted, the canonical-bytes form omits the field entirely so two
   * renders of the same generator output across different wall-clocks
   * produce byte-identical bytes (substrate gap: agent-runtime supplies
   * an explicit `renderedAt` from the scenario clock; CLI default is
   * `new Date().toISOString()`).
   */
  readonly renderedAt: string;
}

/**
 * Render the BA 325 projection to a typed JSON object validated against
 * `Ba325RenderSchema`. Pure function; deterministic for fixed
 * `renderedAt`.
 */
export function renderBa325ToJson(output: Ba325Output, opts: RenderBa325Options): Ba325Render {
  const lcrRatio =
    Number.isFinite(output.lcrRatio) ? output.lcrRatio.toFixed(4) : "infinity";
  const lcrPercent =
    Number.isFinite(output.lcrRatio) ? `${(output.lcrRatio * 100).toFixed(2)}%` : "infinity";

  const meta: Ba325Render["meta"] = {
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    entity: output.meta.entity,
    asOf: output.meta.asOf,
    periodId: output.meta.periodId,
    functionalCurrency: output.meta.functionalCurrency,
    generatorVersion: output.meta.generatorVersion,
    rendererVersion: BA_325_RENDERER_VERSION,
    ...(output.meta.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: output.meta.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: output.meta.classificationsFingerprint,
    renderedAt: opts.renderedAt,
  };

  const candidate = {
    $schema: BA_325_SCHEMA_URL,
    meta,
    hqla: output.hqla,
    cashFlows: output.cashFlows,
    lcrRatio,
    lcrPercent,
    lcrCompliant: output.lcrCompliant,
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  // Validate at boundary — render contract is the typed, immutable shape.
  return Ba325RenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent for human
 * readability. Two calls with the same input produce byte-identical
 * output regardless of object-key insertion order.
 *
 * The two-space indent is intentional — the canonical form is the
 * forensic record; pretty-printed JSON makes diffs reviewable. The doc-
 * store hash is over these bytes.
 */
export function canonicaliseBa325(render: Ba325Render): string {
  return JSON.stringify(sortKeys(render), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortKeys(obj[k]);
    return out;
  }
  return value;
}

/**
 * One-shot helper: render + canonicalise. Returns the canonical JSON
 * string (UTF-8 bytes by `new TextEncoder().encode(...)`).
 */
export function renderBa325Canonical(output: Ba325Output, opts: RenderBa325Options): {
  readonly render: Ba325Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa325ToJson(output, opts);
  const canonicalJson = canonicaliseBa325(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
