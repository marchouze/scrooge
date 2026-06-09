// platform/reporting/ba-300-lcr-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — JSON renderer for the
// BA 110 (LCR) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 3, Marc's Q5 default
// (JSON-first; PDF / HTML are a downstream rendering slice).
//
// The render layer takes the typed `Ba110Output` from `ba-110-lcr.ts` and
// produces a JSON document that:
//   - validates against the declared `Ba110RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical bytes);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` per Slice 5);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Architectural placement:
//
//   BA 110 PROJECTION (typed Ba110Output)
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

import type { Ba110Output } from "./ba-300-lcr";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba110LineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  subCategory: z.string().min(1).optional(),
  note: z.string().optional(),
});

const ba110HqlaLevelSchema = z.object({
  stockMinor: z.number().int().nonnegative(),
  preCapContributionMinor: z.number().int().nonnegative(),
  contributionMinor: z.number().int().nonnegative(),
  capBindingIndicator: z.boolean(),
  lineItems: z.array(ba110LineItemSchema),
});

const ba110HqlaLevel1Schema = z.object({
  stockMinor: z.number().int().nonnegative(),
  contributionMinor: z.number().int().nonnegative(),
  lineItems: z.array(ba110LineItemSchema),
});

/**
 * G-3 input-completeness meta block (mirrors `Ba110InputCompleteness` from
 * the projection layer). Surfaced in the rendered output so downstream
 * consumers (regulator-portal slice, PDF renderer, dashboard, recon) can
 * distinguish "no-data" from "no-stress" and warn on partial-data renders.
 */
const ba110InputCompletenessSchema = z.object({
  hqlaInputsFound: z.number().int().nonnegative(),
  outflowInputsFound: z.number().int().nonnegative(),
  inflowInputsFound: z.number().int().nonnegative(),
  excludedByFilter: z.number().int().nonnegative(),
  excludedReasons: z.record(z.string(), z.number().int().nonnegative()),
  completenessClass: z.enum(["complete", "partial", "empty"]),
});

/**
 * Canonical JSON schema for a rendered BA 110. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard pixel-perfect view)
 * validate inputs against this shape.
 */
export const Ba110RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-110/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 300"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    trialBalanceSnapshotEventId: z.string().min(1).optional(),
    classificationsFingerprint: z.string().min(1),
    inputCompleteness: ba110InputCompletenessSchema,
    renderedAt: z.string().min(1),
  }),
  hqla: z.object({
    level1: ba110HqlaLevel1Schema,
    level2A: ba110HqlaLevelSchema,
    level2B: ba110HqlaLevelSchema,
    totalStockHqlaMinor: z.number().int().nonnegative(),
  }),
  cashFlows: z.object({
    outflows: z.object({
      grossMinor: z.number().int().nonnegative(),
      lineItems: z.array(ba110LineItemSchema),
    }),
    inflows: z.object({
      grossMinor: z.number().int().nonnegative(),
      cappedMinor: z.number().int().nonnegative(),
      capBindingIndicator: z.boolean(),
      lineItems: z.array(ba110LineItemSchema),
    }),
    netCashOutflowsMinor: z.number().int().nonnegative(),
    netCashOutflowFloorBindingIndicator: z.boolean(),
  }),
  /**
   * LCR encoded as a string to preserve `Infinity` (which is not valid
   * JSON). The renderer encodes finite ratios as `"1.234"` (4 decimals),
   * the divide-by-zero case with HQLA stock as `"infinity"` ("no stress"),
   * and the divide-by-zero case with NO input events at all as `"no-data"`
   * (G-3: distinguishes empty-input from genuinely-stress-free).
   */
  lcrRatio: z.string().min(1),
  /** Render-side percentage form for the SARB BA 110 cell display. */
  lcrPercent: z.string().min(1),
  lcrCompliant: z.boolean(),
  /**
   * G-3: set when `meta.inputCompleteness.completenessClass === "partial"`
   * — the LCR was computed from real inputs but at least one candidate
   * settlement event was excluded by the fold (filter, window, all-foreign
   * legs, or zero-net-cash). Renderers should warn the user / regulator
   * that the displayed ratio may understate stress coverage.
   */
  dataQualityWarning: z.boolean().optional(),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba110Render = z.infer<typeof Ba110RenderSchema>;

export const BA_110_SCHEMA_URL = "https://hoz.bank/schemas/ba-110/v0.1-rehearsal.json";
export const BA_110_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa110Options {
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
 * Render the BA 110 projection to a typed JSON object validated against
 * `Ba110RenderSchema`. Pure function; deterministic for fixed
 * `renderedAt`.
 */
export function renderBa110ToJson(output: Ba110Output, opts: RenderBa110Options): Ba110Render {
  // G-3: when the input set is empty (zero HQLA + zero cash-flow events of
  // any kind passed the fold), encode the ratio as `"no-data"` rather than
  // `"infinity"`. `"infinity"` retains its prior meaning — non-empty HQLA
  // with zero outflows ("no stress to cover").
  const completenessClass = output.meta.inputCompleteness.completenessClass;
  let lcrRatio: string;
  let lcrPercent: string;
  if (completenessClass === "empty") {
    lcrRatio = "no-data";
    lcrPercent = "no-data";
  } else if (Number.isFinite(output.lcrRatio)) {
    lcrRatio = output.lcrRatio.toFixed(4);
    lcrPercent = `${(output.lcrRatio * 100).toFixed(2)}%`;
  } else {
    lcrRatio = "infinity";
    lcrPercent = "infinity";
  }

  const meta: Ba110Render["meta"] = {
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    entity: output.meta.entity,
    asOf: output.meta.asOf,
    periodId: output.meta.periodId,
    functionalCurrency: output.meta.functionalCurrency,
    generatorVersion: output.meta.generatorVersion,
    rendererVersion: BA_110_RENDERER_VERSION,
    ...(output.meta.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: output.meta.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: output.meta.classificationsFingerprint,
    inputCompleteness: {
      hqlaInputsFound: output.meta.inputCompleteness.hqlaInputsFound,
      outflowInputsFound: output.meta.inputCompleteness.outflowInputsFound,
      inflowInputsFound: output.meta.inputCompleteness.inflowInputsFound,
      excludedByFilter: output.meta.inputCompleteness.excludedByFilter,
      excludedReasons: { ...output.meta.inputCompleteness.excludedReasons },
      completenessClass: output.meta.inputCompleteness.completenessClass,
    },
    renderedAt: opts.renderedAt,
  };

  const candidate = {
    $schema: BA_110_SCHEMA_URL,
    meta,
    hqla: output.hqla,
    cashFlows: output.cashFlows,
    lcrRatio,
    lcrPercent,
    lcrCompliant: output.lcrCompliant,
    ...(completenessClass === "partial" ? { dataQualityWarning: true } : {}),
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  // Validate at boundary — render contract is the typed, immutable shape.
  return Ba110RenderSchema.parse(candidate);
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
export function canonicaliseBa110(render: Ba110Render): string {
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
export function renderBa110Canonical(
  output: Ba110Output,
  opts: RenderBa110Options,
): {
  readonly render: Ba110Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa110ToJson(output, opts);
  const canonicalJson = canonicaliseBa110(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
