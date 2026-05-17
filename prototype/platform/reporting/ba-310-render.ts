// platform/reporting/ba-310-render.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — JSON renderer for the BA 310 (Selected
// Income-Statement Information / Profitability Detail) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), extended 2026-05-17 by Marc's directive.
//
// The render layer takes the typed `Ba310IncomeDetail` from
// `ba-310-income-detail.ts` and produces a JSON document that:
//   - validates against the declared `Ba310RenderSchema` (Zod);
//   - is deterministic (same input → byte-identical bytes);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` per Slice 5);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Architectural placement:
//
//   BA 310 PROJECTION (typed Ba310IncomeDetail)
//      → THIS RENDERER  → Uint8Array of canonical JSON bytes
//      → RMS DOC STORE (BLAKE3-hashed; PR #142 substrate)
//      → REPORTGENERATED EVENT (cites the hash + the schema id)
//      → SARB PORTAL XML (future slice; transforms canonical JSON)
//
// Determinism mirror of `ba-700-render.ts`: keys sorted via the same
// `sortKeys` walker so two runs over the same projection produce the
// same bytes (recon exit-criterion).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer + JSON-schema integration)
//   + Ravi (Treasury & ALM engineer, engineering — FTP + ALM banding
//   substrate consult).

import { z } from "zod";

import type { Ba310IncomeDetail } from "./ba-310-income-detail";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba310LineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  subCategory: z.string().min(1).optional(),
  note: z.string().optional(),
});

const ba310NiiByClassSchema = z.object({
  instrumentClass: z.enum(["interbank", "corporate", "sovereign", "retail-placeholder"]),
  interestIncomeMinor: z.number().int(),
  interestExpenseMinor: z.number().int(),
  netInterestIncomeMinor: z.number().int(),
  lineItems: z.array(ba310LineItemSchema),
});

const ba310NiiByBandSchema = z.object({
  maturityBand: z.enum(["overnight", "1-7d", "8-30d", "1-3m", "3-6m", "6-12m", ">1y"]),
  interestIncomeMinor: z.number().int(),
  interestExpenseMinor: z.number().int(),
  netInterestIncomeMinor: z.number().int(),
  volumeMinor: z.number().int().nonnegative(),
  lineItems: z.array(ba310LineItemSchema),
});

const ba310NiiBreakdownSchema = z.object({
  totalInterestIncomeMinor: z.number().int(),
  totalInterestExpenseMinor: z.number().int(),
  totalNetInterestIncomeMinor: z.number().int(),
  byInstrumentClass: z.array(ba310NiiByClassSchema),
  byMaturityBand: z.array(ba310NiiByBandSchema),
  bandingGaps: z.array(z.string().min(1)),
});

const ba310AlmBandingSchema = z.object({
  totalVolumeMinor: z.number().int().nonnegative(),
  totalNetInterestIncomeMinor: z.number().int(),
  bands: z.array(ba310NiiByBandSchema),
});

const nimRatioString = z.string().min(1).nullable();

const ba310NimBandSchema = z.object({
  maturityBand: z.enum(["overnight", "1-7d", "8-30d", "1-3m", "3-6m", "6-12m", ">1y"]),
  nim: nimRatioString,
  nimBps: z.number().nullable(),
  clientNim: nimRatioString,
  structuralNim: nimRatioString,
  volumeMinor: z.number().int().nonnegative(),
});

const ba310NimSectionSchema = z.object({
  overallNim: nimRatioString,
  overallNimBps: z.number().nullable(),
  overallNimPercent: z.string().nullable(),
  averageEarningAssetsMinor: z.number().int().nonnegative(),
  clientNim: nimRatioString,
  structuralNim: nimRatioString,
  byBand: z.array(ba310NimBandSchema),
});

const ba310NonInterestSectionSchema = z.object({
  feeIncomeMinor: z.number().int(),
  tradingProfitLossMinor: z.number().int(),
  otherIncomeMinor: z.number().int(),
  otherExpenseMinor: z.number().int(),
  totalNonInterestIncomeMinor: z.number().int(),
  lineItems: z.array(ba310LineItemSchema),
});

const ba310EfficiencySectionSchema = z.object({
  costToIncomeRatio: z.string().nullable(),
  costToIncomePercent: z.string().nullable(),
  operatingExpensesMinor: z.number().int(),
  totalOperatingIncomeMinor: z.number().int(),
});

/**
 * Canonical JSON schema for a rendered BA 310. Downstream consumers
 * (regulator-portal slice, PDF renderer, dashboard) validate inputs
 * against this shape.
 */
export const Ba310RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-310/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 310"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    trialBalanceSnapshotEventId: z.string().min(1).optional(),
    ba300ClassificationsFingerprint: z.string().min(1),
    bandingMapFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  netInterestIncome: ba310NiiBreakdownSchema,
  almBanding: ba310AlmBandingSchema,
  netInterestMargin: ba310NimSectionSchema,
  nonInterestIncome: ba310NonInterestSectionSchema,
  operatingEfficiency: ba310EfficiencySectionSchema,
  lineItems: z.array(ba310LineItemSchema),
  classificationGaps: z.array(z.string().min(1)),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  entity: z.string().min(1),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba310Render = z.infer<typeof Ba310RenderSchema>;

export const BA_310_SCHEMA_URL = "https://hoz.bank/schemas/ba-310/v0.1-rehearsal.json";
export const BA_310_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

export interface RenderBa310Options {
  /**
   * ISO-8601 timestamp the render was produced at. Required — supplied by
   * the agent-runtime substrate from the scenario clock; CLI default is
   * `new Date().toISOString()`.
   */
  readonly renderedAt: string;
}

function nimToString(n: number | null): string | null {
  return n === null ? null : n.toFixed(6);
}

function nimToPercent(n: number | null): string | null {
  return n === null ? null : `${(n * 100).toFixed(4)}%`;
}

function ctrToString(r: number | null): string | null {
  return r === null ? null : r.toFixed(6);
}

/**
 * Render the BA 310 projection to a typed JSON object validated against
 * `Ba310RenderSchema`. Pure function; deterministic for fixed `renderedAt`.
 */
export function renderBa310ToJson(
  output: Ba310IncomeDetail,
  opts: RenderBa310Options,
): Ba310Render {
  const nimSection = output.netInterestMargin;

  const renderedNim = {
    overallNim: nimToString(nimSection.overallNim),
    overallNimBps: nimSection.overallNimBps,
    overallNimPercent: nimToPercent(nimSection.overallNim),
    averageEarningAssetsMinor: nimSection.averageEarningAssetsMinor,
    clientNim: nimToString(nimSection.clientNim),
    structuralNim: nimToString(nimSection.structuralNim),
    byBand: nimSection.byBand.map((b) => ({
      maturityBand: b.maturityBand,
      nim: nimToString(b.nim),
      nimBps: b.nimBps,
      clientNim: nimToString(b.clientNim),
      structuralNim: nimToString(b.structuralNim),
      volumeMinor: b.volumeMinor,
    })),
  };

  const renderedEfficiency = {
    costToIncomeRatio: ctrToString(output.operatingEfficiency.costToIncomeRatio),
    costToIncomePercent: output.operatingEfficiency.costToIncomePercent,
    operatingExpensesMinor: output.operatingEfficiency.operatingExpensesMinor,
    totalOperatingIncomeMinor: output.operatingEfficiency.totalOperatingIncomeMinor,
  };

  const candidate: Ba310Render = {
    $schema: BA_310_SCHEMA_URL,
    meta: {
      form: output.meta.form,
      formVersion: output.meta.formVersion,
      entity: output.meta.entity,
      periodStart: output.meta.periodStart,
      periodEnd: output.meta.periodEnd,
      periodId: output.meta.periodId,
      functionalCurrency: output.meta.functionalCurrency,
      generatorVersion: output.meta.generatorVersion,
      rendererVersion: BA_310_RENDERER_VERSION,
      ...(output.meta.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: output.meta.trialBalanceSnapshotEventId }
        : {}),
      ba300ClassificationsFingerprint: output.meta.ba300ClassificationsFingerprint,
      bandingMapFingerprint: output.meta.bandingMapFingerprint,
      renderedAt: opts.renderedAt,
    },
    netInterestIncome: {
      ...output.netInterestIncome,
      byInstrumentClass: output.netInterestIncome.byInstrumentClass.map((c) => ({
        ...c,
        lineItems: [...c.lineItems].map((l) => ({
          ...l,
          contributingAccounts: [...l.contributingAccounts],
        })),
      })),
      byMaturityBand: output.netInterestIncome.byMaturityBand.map((b) => ({
        ...b,
        lineItems: [...b.lineItems].map((l) => ({
          ...l,
          contributingAccounts: [...l.contributingAccounts],
        })),
      })),
      bandingGaps: [...output.netInterestIncome.bandingGaps],
    },
    almBanding: {
      ...output.almBanding,
      bands: output.almBanding.bands.map((b) => ({
        ...b,
        lineItems: [...b.lineItems].map((l) => ({
          ...l,
          contributingAccounts: [...l.contributingAccounts],
        })),
      })),
    },
    netInterestMargin: renderedNim,
    nonInterestIncome: {
      ...output.nonInterestIncome,
      lineItems: [...output.nonInterestIncome.lineItems].map((l) => ({
        ...l,
        contributingAccounts: [...l.contributingAccounts],
      })),
    },
    operatingEfficiency: renderedEfficiency,
    lineItems: [...output.lineItems].map((l) => ({
      ...l,
      contributingAccounts: [...l.contributingAccounts],
    })),
    classificationGaps: [...output.classificationGaps],
    periodStart: output.periodStart,
    periodEnd: output.periodEnd,
    entity: output.entity,
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba310RenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent. Two calls
 * with the same input produce byte-identical output. The doc-store hash
 * is over these bytes.
 */
export function canonicaliseBa310(render: Ba310Render): string {
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
 * string + Uint8Array bytes.
 */
export function renderBa310Canonical(
  output: Ba310IncomeDetail,
  opts: RenderBa310Options,
): {
  readonly render: Ba310Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa310ToJson(output, opts);
  const canonicalJson = canonicaliseBa310(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
