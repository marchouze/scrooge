// platform/reporting/ba-320-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 11 — JSON renderer for the
// BA 320 (Credit-Risk Loans-and-Advances Breakdown) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 11 + Marc's 2026-05-17 directive.
// Workstream: WS-FINANCE-BA-RETURNS-QUINTET.
//
// The render layer takes the typed `Ba320CreditRisk` from
// `ba-320-credit-risk.ts` and produces a JSON document that:
//   - validates against the declared `Ba320RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical output);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` per Slice 5);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Determinism mirror of `ba-700-render.ts` + `ba-325-render.ts`: keys are
// sorted via the same `sortKeys` walker so two runs over the same projection
// produce the same bytes (recon exit-criterion).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer + JSON-schema integration)
//   + Helena (Chief Risk Officer, governance — IFRS 9 staging methodology
//   owner).

import { z } from "zod";

import type { Ba320CreditRisk } from "./ba-320-credit-risk";
import {
  ba320CategorySectionSchema,
  ba320StageSectionSchema,
  ba320TotalSchema,
} from "./ba-320-credit-risk";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

/**
 * Canonical JSON schema for a rendered BA 320. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard view) validate inputs
 * against this shape.
 */
export const Ba320RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-320/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 320"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    portfolioFingerprint: z.string().min(1),
    classificationFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  byCategory: z.array(ba320CategorySectionSchema),
  byStage: z.tuple([ba320StageSectionSchema, ba320StageSectionSchema, ba320StageSectionSchema]),
  totalLoansAndAdvances: ba320TotalSchema,
  /**
   * Ratios are encoded as strings to preserve `Infinity` (not valid JSON).
   * Finite ratios render as `"0.1234"` (4 decimals); divide-by-zero as
   * `"infinity"`.
   */
  nplRatio: z.string().min(1),
  nplRatioPercent: z.string().min(1),
  coverageRatio: z.string().min(1),
  coverageRatioPercent: z.string().min(1),
  classificationGaps: z.array(z.string()),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba320Render = z.infer<typeof Ba320RenderSchema>;

export const BA_320_SCHEMA_URL = "https://hoz.bank/schemas/ba-320/v0.1-rehearsal.json";
export const BA_320_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa320Options {
  /**
   * ISO-8601 timestamp the render was produced at. Required — supplied by
   * the agent-runtime substrate from the scenario clock; CLI default is
   * `new Date().toISOString()`.
   */
  readonly renderedAt: string;
}

function ratioToString(r: number): string {
  return Number.isFinite(r) ? r.toFixed(4) : "infinity";
}

function ratioToPercent(r: number): string {
  return Number.isFinite(r) ? `${(r * 100).toFixed(2)}%` : "infinity";
}

/**
 * Render the BA 320 projection to a typed JSON object validated against
 * `Ba320RenderSchema`. Pure function; deterministic for fixed `renderedAt`.
 */
export function renderBa320ToJson(output: Ba320CreditRisk, opts: RenderBa320Options): Ba320Render {
  const candidate = {
    $schema: BA_320_SCHEMA_URL,
    meta: {
      form: output.meta.form,
      formVersion: output.meta.formVersion,
      entity: output.meta.entity,
      asOf: output.meta.asOf,
      periodId: output.meta.periodId,
      functionalCurrency: output.meta.functionalCurrency,
      generatorVersion: output.meta.generatorVersion,
      rendererVersion: BA_320_RENDERER_VERSION,
      portfolioFingerprint: output.meta.portfolioFingerprint,
      classificationFingerprint: output.meta.classificationFingerprint,
      renderedAt: opts.renderedAt,
    },
    byCategory: [...output.byCategory],
    byStage: output.byStage,
    totalLoansAndAdvances: output.totalLoansAndAdvances,
    nplRatio: ratioToString(output.nplRatio),
    nplRatioPercent: ratioToPercent(output.nplRatio),
    coverageRatio: ratioToString(output.coverageRatio),
    coverageRatioPercent: ratioToPercent(output.coverageRatio),
    classificationGaps: [...output.classificationGaps],
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba320RenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent. Two calls
 * with the same input produce byte-identical output regardless of object-
 * key insertion order. The doc-store hash is over these bytes.
 */
export function canonicaliseBa320(render: Ba320Render): string {
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
 * string and UTF-8 bytes.
 */
export function renderBa320Canonical(
  output: Ba320CreditRisk,
  opts: RenderBa320Options,
): {
  readonly render: Ba320Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa320ToJson(output, opts);
  const canonicalJson = canonicaliseBa320(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
