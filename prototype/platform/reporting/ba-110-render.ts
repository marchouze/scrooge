// platform/reporting/ba-110-render.ts
//
// WS-BA-RETURNS-P1-SOURCING Phase 4 — JSON renderer for the BA 110
// (Off-Balance-Sheet Activities) projection.
//
// Mirrors the determinism contract of `ba-100-render.ts`: keys sorted via
// the same `sortKeys` walker so two runs over the same projection produce
// byte-identical bytes; BLAKE3 over those bytes is the `RecordFiled` /
// `ReportGenerated` document hash downstream.
//
// Authority: D-BA-RETURNS-P1-SOURCING-WORKSTREAM;
//            D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO 2026-06-09).
//
// Author: Mira (Regulatory reporting engineer, engineering — reports to
//   Camille CFO; BA-returns sourcing).

import { z } from "zod";

import type { Ba110OffBalanceSheet } from "./ba-110-off-balance-sheet";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba110ObsLineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  grossAmountMinor: z.number().int().nonnegative(),
  creditConversionFactor: z.number().min(0).max(1),
  ccfWeightedAmountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  sourceRef: z.string().min(1),
  note: z.string().optional(),
});

const ba110ObsSectionSchema = z.object({
  section: z.enum(["derivatives", "securities-financing", "committed-undrawn"]),
  lineItems: z.array(ba110ObsLineItemSchema),
  grossTotalMinor: z.number().int().nonnegative(),
  ccfWeightedTotalMinor: z.number().int().nonnegative(),
});

/**
 * Canonical JSON schema for a rendered BA 110. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard view) validate inputs
 * against this shape.
 */
export const Ba110ObsRenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-110-obs/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 110"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    renderedAt: z.string().min(1),
  }),
  derivatives: ba110ObsSectionSchema,
  securitiesFinancing: ba110ObsSectionSchema,
  committedUndrawn: ba110ObsSectionSchema,
  grossTotalMinor: z.number().int().nonnegative(),
  ccfWeightedTotalMinor: z.number().int().nonnegative(),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba110ObsRender = z.infer<typeof Ba110ObsRenderSchema>;

export const BA_110_OBS_SCHEMA_URL = "https://hoz.bank/schemas/ba-110-obs/v0.1-rehearsal.json";
export const BA_110_OBS_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa110ObsOptions {
  /** ISO-8601 timestamp the render was produced at. Required. */
  readonly renderedAt: string;
}

/**
 * Render the BA 110 projection to a typed JSON object validated against
 * `Ba110ObsRenderSchema`. Pure function; deterministic for fixed `renderedAt`.
 */
export function renderBa110ObsToJson(
  output: Ba110OffBalanceSheet,
  opts: RenderBa110ObsOptions,
): Ba110ObsRender {
  const candidate = {
    $schema: BA_110_OBS_SCHEMA_URL,
    meta: {
      form: output.meta.form,
      formVersion: output.meta.formVersion,
      entity: output.meta.entity,
      asOf: output.meta.asOf,
      functionalCurrency: output.meta.functionalCurrency,
      generatorVersion: output.meta.generatorVersion,
      rendererVersion: BA_110_OBS_RENDERER_VERSION,
      renderedAt: opts.renderedAt,
    },
    derivatives: output.derivatives,
    securitiesFinancing: output.securitiesFinancing,
    committedUndrawn: output.committedUndrawn,
    grossTotalMinor: output.grossTotalMinor,
    ccfWeightedTotalMinor: output.ccfWeightedTotalMinor,
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba110ObsRenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent. Two calls with
 * the same input produce byte-identical output regardless of insertion order.
 */
export function canonicaliseBa110Obs(render: Ba110ObsRender): string {
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

/** One-shot helper: render + canonicalise. */
export function renderBa110ObsCanonical(
  output: Ba110OffBalanceSheet,
  opts: RenderBa110ObsOptions,
): {
  readonly render: Ba110ObsRender;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa110ObsToJson(output, opts);
  const canonicalJson = canonicaliseBa110Obs(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
