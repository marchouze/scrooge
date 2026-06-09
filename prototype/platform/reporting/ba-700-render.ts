// platform/reporting/ba-700-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 — JSON renderer for the
// BA 100 (Capital Adequacy Return) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 4, Marc's Q5 default
// (JSON-first; PDF / HTML / SARB-XML are downstream rendering slices).
//
// The render layer takes the typed `Ba100Output` from `ba-100-capital.ts`
// and produces a JSON document that:
//   - validates against the declared `Ba100RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical bytes);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` per Slice 5);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Architectural placement:
//
//   BA 100 PROJECTION (typed Ba100Output)
//      → THIS RENDERER  → Uint8Array of canonical JSON bytes
//      → RMS DOC STORE (BLAKE3-hashed; PR #142 substrate)
//      → REPORTGENERATED EVENT (Slice 5; cites the hash + the schema id)
//      → SARB PORTAL XML (Slice 5; transforms canonical JSON)
//
// Determinism mirror of `ba-110-render.ts`: keys sorted via the same
// `sortKeys` walker so two runs over the same projection produce the
// same bytes (recon exit-criterion).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer + JSON-schema integration)
//   + Atlas (Core banking platform architect, engineering — substrate
//   consult; canonicaliser-contract reviewer).

import { z } from "zod";

import type { Ba100Output } from "./ba-700-capital";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba100LineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  subCategory: z.string().min(1).optional(),
  note: z.string().optional(),
});

const ba100CapitalTierSchema = z.object({
  tier: z.enum(["cet1", "at1", "t2"]),
  grossStockMinor: z.number().int().nonnegative(),
  totalDeductionsMinor: z.number().int().nonnegative(),
  netStockMinor: z.number().int().nonnegative(),
  stockLineItems: z.array(ba100LineItemSchema),
  deductionLineItems: z.array(ba100LineItemSchema),
});

const ba100BufferRequirementsSchema = z.object({
  baseCet1Ratio: z.number().nonnegative().max(1),
  baseTier1Ratio: z.number().nonnegative().max(1),
  baseTotalRatio: z.number().nonnegative().max(1),
  capitalConservationBufferRatio: z.number().nonnegative().max(1),
  counterCyclicalBufferRatio: z.number().nonnegative().max(1),
  dSibSurchargeRatio: z.number().nonnegative().max(1),
  pillar2ASurchargeRatio: z.number().nonnegative().max(1),
});

/**
 * Canonical JSON schema for a rendered BA 100. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard pixel-perfect view)
 * validate inputs against this shape.
 */
export const Ba100RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-100/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 700"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    trialBalanceSnapshotEventId: z.string().min(1).optional(),
    classificationsFingerprint: z.string().min(1),
    deductionsFingerprint: z.string().min(1),
    rwaFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  capitalStack: z.object({
    cet1: ba100CapitalTierSchema,
    at1: ba100CapitalTierSchema,
    t2: ba100CapitalTierSchema,
    netTier1Minor: z.number().int().nonnegative(),
    netTotalCapitalMinor: z.number().int().nonnegative(),
  }),
  rwa: z.object({
    creditRwaMinor: z.number().int().nonnegative(),
    marketRwaMinor: z.number().int().nonnegative(),
    operationalRwaMinor: z.number().int().nonnegative(),
    totalRwaMinor: z.number().int().nonnegative(),
    source: z.string().min(1),
    rwaComputationEventId: z.string().min(1).optional(),
  }),
  bufferRequirements: ba100BufferRequirementsSchema,
  /**
   * Basel III leverage-ratio section (BCBS §147–§165). Present when
   * the generator was supplied an exposure-measure decomposition.
   * Ratio encoded as a string (mirrors RWA-ratio encoding for
   * Infinity safety).
   */
  leverageRatio: z
    .object({
      meta: z.object({
        form: z.literal("Leverage Ratio"),
        formVersion: z.literal("v0.1-rehearsal"),
        entity: z.string().min(1),
        asOf: z.string().min(1),
        periodId: z.string().min(1),
        functionalCurrency: z.string().length(3),
        generatorVersion: z.literal("v0.1"),
        exposureFingerprint: z.string().min(1),
      }),
      tier1CapitalMinor: z.number().int().nonnegative(),
      exposureMeasure: z.object({
        onBalanceSheetExposureMinor: z.number().int().nonnegative(),
        derivativeExposureMinor: z.number().int().nonnegative(),
        sftExposureMinor: z.number().int().nonnegative(),
        offBalanceSheetExposurePostCcfMinor: z.number().int().nonnegative(),
        totalExposureMeasureMinor: z.number().int().nonnegative(),
        source: z.string().min(1),
        saccrEventId: z.string().min(1).optional(),
      }),
      leverageRatio: z.string().min(1),
      leveragePercent: z.string().min(1),
      regulatoryMinimumRatio: z.string().min(1),
      regulatoryMinimumPercent: z.string().min(1),
      compliant: z.boolean(),
      citations: z.array(z.string().min(1)),
      placeholders: z.array(z.string().min(1)),
    })
    .optional(),
  /**
   * Ratios are encoded as strings to preserve `Infinity` (which is not
   * valid JSON) for the divide-by-zero edge case (no RWA). Finite ratios
   * render as `"0.1234"` (4 decimals); the divide-by-zero case as
   * `"infinity"`.
   */
  ratios: z.object({
    cet1Ratio: z.string().min(1),
    cet1Percent: z.string().min(1),
    cet1RatioRequiredMinimum: z.string().min(1),
    cet1RequiredMinimumPercent: z.string().min(1),
    cet1Compliant: z.boolean(),
    tier1Ratio: z.string().min(1),
    tier1Percent: z.string().min(1),
    tier1RatioRequiredMinimum: z.string().min(1),
    tier1RequiredMinimumPercent: z.string().min(1),
    tier1Compliant: z.boolean(),
    totalRatio: z.string().min(1),
    totalPercent: z.string().min(1),
    totalRatioRequiredMinimum: z.string().min(1),
    totalRequiredMinimumPercent: z.string().min(1),
    totalCompliant: z.boolean(),
  }),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba100Render = z.infer<typeof Ba100RenderSchema>;

export const BA_100_SCHEMA_URL = "https://hoz.bank/schemas/ba-100/v0.1-rehearsal.json";
export const BA_100_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa100Options {
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
 * Render the BA 100 projection to a typed JSON object validated against
 * `Ba100RenderSchema`. Pure function; deterministic for fixed
 * `renderedAt`.
 */
export function renderBa100ToJson(output: Ba100Output, opts: RenderBa100Options): Ba100Render {
  const meta: Ba100Render["meta"] = {
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    entity: output.meta.entity,
    asOf: output.meta.asOf,
    periodId: output.meta.periodId,
    functionalCurrency: output.meta.functionalCurrency,
    generatorVersion: output.meta.generatorVersion,
    rendererVersion: BA_100_RENDERER_VERSION,
    ...(output.meta.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: output.meta.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: output.meta.classificationsFingerprint,
    deductionsFingerprint: output.meta.deductionsFingerprint,
    rwaFingerprint: output.meta.rwaFingerprint,
    renderedAt: opts.renderedAt,
  };

  const leverageRatioRender = output.leverageRatio
    ? {
        meta: output.leverageRatio.meta,
        tier1CapitalMinor: output.leverageRatio.tier1CapitalMinor,
        exposureMeasure: output.leverageRatio.exposureMeasure,
        leverageRatio: ratioToString(output.leverageRatio.leverageRatio),
        leveragePercent: ratioToPercent(output.leverageRatio.leverageRatio),
        regulatoryMinimumRatio: ratioToString(output.leverageRatio.regulatoryMinimumRatio),
        regulatoryMinimumPercent: ratioToPercent(output.leverageRatio.regulatoryMinimumRatio),
        compliant: output.leverageRatio.compliant,
        citations: [...output.leverageRatio.citations],
        placeholders: [...output.leverageRatio.placeholders],
      }
    : undefined;

  const candidate = {
    $schema: BA_100_SCHEMA_URL,
    meta,
    capitalStack: output.capitalStack,
    rwa: output.rwa,
    bufferRequirements: output.bufferRequirements,
    ...(leverageRatioRender ? { leverageRatio: leverageRatioRender } : {}),
    ratios: {
      cet1Ratio: ratioToString(output.ratios.cet1Ratio),
      cet1Percent: ratioToPercent(output.ratios.cet1Ratio),
      cet1RatioRequiredMinimum: ratioToString(output.ratios.cet1RatioRequiredMinimum),
      cet1RequiredMinimumPercent: ratioToPercent(output.ratios.cet1RatioRequiredMinimum),
      cet1Compliant: output.ratios.cet1Compliant,
      tier1Ratio: ratioToString(output.ratios.tier1Ratio),
      tier1Percent: ratioToPercent(output.ratios.tier1Ratio),
      tier1RatioRequiredMinimum: ratioToString(output.ratios.tier1RatioRequiredMinimum),
      tier1RequiredMinimumPercent: ratioToPercent(output.ratios.tier1RatioRequiredMinimum),
      tier1Compliant: output.ratios.tier1Compliant,
      totalRatio: ratioToString(output.ratios.totalRatio),
      totalPercent: ratioToPercent(output.ratios.totalRatio),
      totalRatioRequiredMinimum: ratioToString(output.ratios.totalRatioRequiredMinimum),
      totalRequiredMinimumPercent: ratioToPercent(output.ratios.totalRatioRequiredMinimum),
      totalCompliant: output.ratios.totalCompliant,
    },
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba100RenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent for human
 * readability. Two calls with the same input produce byte-identical
 * output regardless of object-key insertion order. The doc-store hash
 * is over these bytes.
 */
export function canonicaliseBa100(render: Ba100Render): string {
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
export function renderBa100Canonical(
  output: Ba100Output,
  opts: RenderBa100Options,
): {
  readonly render: Ba100Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa100ToJson(output, opts);
  const canonicalJson = canonicaliseBa100(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
