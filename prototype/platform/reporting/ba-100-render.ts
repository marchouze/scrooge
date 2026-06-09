// platform/reporting/ba-100-render.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — JSON renderer for the BA 600 (Balance
// Sheet) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10) + Marc's 2026-05-17 directive extending scope
// to the BA-returns quintet.
//
// The render layer takes the typed `Ba600BalanceSheet` from
// `ba-600-balance-sheet.ts` and produces a JSON document that:
//   - validates against the declared `Ba600RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical bytes);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` downstream);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Determinism mirror of `ba-100-render.ts`: keys sorted via the same
// `sortKeys` walker so two runs over the same projection produce the
// same bytes.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   JSON-schema integration).

import { z } from "zod";

import type { Ba600BalanceSheet } from "./ba-100-balance-sheet";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba100LineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  subCategory: z.string().min(1).optional(),
  note: z.string().optional(),
});

const ba100SectionSchema = z.object({
  section: z.enum(["assets", "liabilities", "equity"]),
  totalMinor: z.number().int().nonnegative(),
  lineItems: z.array(ba100LineItemSchema),
});

const ba100PerCurrencyTotalSchema = z.object({
  currency: z.string().length(3),
  assetsMinor: z.number().int().nonnegative(),
  liabilitiesMinor: z.number().int().nonnegative(),
  equityMinor: z.number().int().nonnegative(),
});

const ba100ClassificationGapSchema = z.object({
  leafAccountId: z.string().min(1),
  currency: z.string().length(3),
  amountMinor: z.number().int(),
});

const ba100BalanceCheckSchema = z.object({
  assetsMinor: z.number().int().nonnegative(),
  liabilitiesPlusEquityMinor: z.number().int().nonnegative(),
  differenceMinor: z.number().int(),
  toleranceMinor: z.number().int().nonnegative(),
  balanced: z.boolean(),
});

/**
 * Canonical JSON schema for a rendered BA 600. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard pixel-perfect view)
 * validate inputs against this shape.
 */
export const Ba600RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-600/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 100"),
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
  assets: ba100SectionSchema,
  liabilities: ba100SectionSchema,
  equity: ba100SectionSchema,
  perCurrencyTotals: z.array(ba100PerCurrencyTotalSchema),
  balanceCheck: ba100BalanceCheckSchema,
  classificationGaps: z.array(ba100ClassificationGapSchema),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba600Render = z.infer<typeof Ba600RenderSchema>;

export const BA_600_SCHEMA_URL = "https://hoz.bank/schemas/ba-600/v0.1-rehearsal.json";
export const BA_600_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa600Options {
  /** ISO-8601 timestamp the render was produced at. Required. */
  readonly renderedAt: string;
}

/**
 * Render the BA 600 projection to a typed JSON object validated against
 * `Ba600RenderSchema`. Pure function; deterministic for fixed
 * `renderedAt`.
 */
export function renderBa600ToJson(
  output: Ba600BalanceSheet,
  opts: RenderBa600Options,
): Ba600Render {
  const meta: Ba600Render["meta"] = {
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    entity: output.meta.entity,
    asOf: output.meta.asOf,
    periodId: output.meta.periodId,
    functionalCurrency: output.meta.functionalCurrency,
    generatorVersion: output.meta.generatorVersion,
    rendererVersion: BA_600_RENDERER_VERSION,
    ...(output.meta.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: output.meta.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: output.meta.classificationsFingerprint,
    renderedAt: opts.renderedAt,
  };

  const candidate = {
    $schema: BA_600_SCHEMA_URL,
    meta,
    assets: output.assets,
    liabilities: output.liabilities,
    equity: output.equity,
    perCurrencyTotals: [...output.perCurrencyTotals],
    balanceCheck: output.balanceCheck,
    classificationGaps: [...output.classificationGaps],
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba600RenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent. Two calls
 * with the same input produce byte-identical output regardless of object-
 * key insertion order. The doc-store hash is over these bytes.
 */
export function canonicaliseBa600(render: Ba600Render): string {
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
export function renderBa600Canonical(
  output: Ba600BalanceSheet,
  opts: RenderBa600Options,
): {
  readonly render: Ba600Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa600ToJson(output, opts);
  const canonicalJson = canonicaliseBa600(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
