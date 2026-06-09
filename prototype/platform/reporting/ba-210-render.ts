// platform/reporting/ba-210-render.ts
//
// WS-BA-RETURNS-FOLLOWON — JSON renderer for the BA 210 (Credit Concentration
// Risk / Large Exposures, LEX) projection.
//
// The render layer takes the typed `Ba210Output` from
// `ba-210-large-exposures.ts` and produces a JSON document that:
//   - validates against the declared `Ba210RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical output);
//   - is hash-store-friendly (BLAKE3 over the bytes is the `ReportGenerated`
//     event's `documentHash`);
//   - is the input contract for downstream PDF / HTML / SARB-portal XML
//     renderers.
//
// Determinism mirror of `ba-200-render.ts`: percentages are encoded as strings
// (to keep `Infinity` representable) and object keys are sorted via the same
// `sortKeys` walker so two runs over the same projection produce identical bytes.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH;
//   brief:mira:ws-ba-returns-followon-ba-210-large-exposures-le:2026-06-09.
//
// Author: Mira (Regulatory reporting engineer, engineering).

import { z } from "zod";

import type { Ba210Output } from "./ba-210-large-exposures";
import { ba210ObligorExposureSchema } from "./ba-210-large-exposures";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba210RenderObligorSchema = ba210ObligorExposureSchema.extend({
  /** Percentage rendering of `exposurePctOfCapital` (e.g. "12.34%"). */
  exposurePctOfCapitalPercent: z.string().min(1),
});

export const Ba210RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-210/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 210"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    capitalBaseMinor: z.number().int().nonnegative(),
    capitalBaseSource: z.string().min(1),
    exposuresFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  largeExposures: z.array(ba210RenderObligorSchema),
  aggregateLargeExposureMinor: z.number().int().nonnegative(),
  aggregateLargeExposurePctOfCapital: z.string().min(1),
  aggregateLargeExposurePctOfCapitalPercent: z.string().min(1),
  largeExposureCount: z.number().int().nonnegative(),
  breach: z.boolean(),
  breachedObligors: z.array(z.string().min(1)),
  thresholdPct: z.string().min(1),
  thresholdPctPercent: z.string().min(1),
  hardLimitPct: z.string().min(1),
  hardLimitPctPercent: z.string().min(1),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba210Render = z.infer<typeof Ba210RenderSchema>;

export const BA_210_SCHEMA_URL = "https://hoz.bank/schemas/ba-210/v0.1-rehearsal.json";
export const BA_210_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa210Options {
  /** ISO-8601 timestamp the render was produced at. */
  readonly renderedAt: string;
}

function ratioToString(r: number): string {
  return Number.isFinite(r) ? r.toFixed(6) : "infinity";
}

function ratioToPercent(r: number): string {
  return Number.isFinite(r) ? `${(r * 100).toFixed(2)}%` : "infinity";
}

/**
 * Render the BA 210 projection to a typed JSON object validated against
 * `Ba210RenderSchema`. Pure function; deterministic for a fixed `renderedAt`.
 */
export function renderBa210ToJson(output: Ba210Output, opts: RenderBa210Options): Ba210Render {
  const candidate = {
    $schema: BA_210_SCHEMA_URL,
    meta: {
      form: output.meta.form,
      formVersion: output.meta.formVersion,
      entity: output.meta.entity,
      asOf: output.meta.asOf,
      periodId: output.meta.periodId,
      functionalCurrency: output.meta.functionalCurrency,
      generatorVersion: output.meta.generatorVersion,
      rendererVersion: BA_210_RENDERER_VERSION,
      capitalBaseMinor: output.meta.capitalBaseMinor,
      capitalBaseSource: output.meta.capitalBaseSource,
      exposuresFingerprint: output.meta.exposuresFingerprint,
      renderedAt: opts.renderedAt,
    },
    largeExposures: output.largeExposures.map((l) => ({
      obligorPartyId: l.obligorPartyId,
      exposureClass: l.exposureClass,
      exposureMinor: l.exposureMinor,
      exposurePctOfCapital: l.exposurePctOfCapital,
      exposurePctOfCapitalPercent: ratioToPercent(l.exposurePctOfCapital),
      contributingInstruments: [...l.contributingInstruments],
      isLargeExposure: l.isLargeExposure,
      isExempt: l.isExempt,
      isBreach: l.isBreach,
      currency: l.currency,
    })),
    aggregateLargeExposureMinor: output.aggregateLargeExposureMinor,
    aggregateLargeExposurePctOfCapital: ratioToString(output.aggregateLargeExposurePctOfCapital),
    aggregateLargeExposurePctOfCapitalPercent: ratioToPercent(
      output.aggregateLargeExposurePctOfCapital,
    ),
    largeExposureCount: output.largeExposureCount,
    breach: output.breach,
    breachedObligors: [...output.breachedObligors],
    thresholdPct: ratioToString(output.thresholdPct),
    thresholdPctPercent: ratioToPercent(output.thresholdPct),
    hardLimitPct: ratioToString(output.hardLimitPct),
    hardLimitPctPercent: ratioToPercent(output.hardLimitPct),
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba210RenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent.
 */
export function canonicaliseBa210(render: Ba210Render): string {
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
 * One-shot helper: render + canonicalise. Returns the canonical JSON string and
 * UTF-8 bytes.
 */
export function renderBa210Canonical(
  output: Ba210Output,
  opts: RenderBa210Options,
): {
  readonly render: Ba210Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa210ToJson(output, opts);
  const canonicalJson = canonicaliseBa210(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
