// platform/reporting/off-balance-sheet-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 9 — JSON renderer for the
// off-balance-sheet (Off-Balance-Sheet Activities) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 9.
// Additional authority: Marc's 2026-05-17 directive.
//
// The render layer takes the typed `OffBalanceSheet` from
// `off-balance-sheet.ts` and produces a JSON document that:
//   - validates against the declared `OffBalanceSheetRenderSchema` (Zod);
//   - is deterministic (same input → byte-identical bytes);
//   - is hash-store-friendly (BLAKE3 over the bytes is the
//     `ReportGenerated` event's `documentHash` per Slice 5);
//   - is the input contract for downstream PDF / HTML / SARB-portal
//     XML renderers.
//
// Architectural placement:
//
//   off-balance-sheet PROJECTION (typed OffBalanceSheet)
//      → THIS RENDERER  → Uint8Array of canonical JSON bytes
//      → RMS DOC STORE (BLAKE3-hashed)
//      → REPORTGENERATED EVENT (Slice 5+; cites the hash + the schema id)
//      → SARB PORTAL XML (future slice; transforms canonical JSON)
//
// Determinism mirror of `ba-100-render.ts` and `ba-110-render.ts`: keys
// sorted via the same `sortKeys` walker so two runs over the same projection
// produce the same bytes (recon exit-criterion).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer + JSON-schema integration)
//   + Kai (Derivatives & structured products engineer, engineering —
//   derivative section review).

import { z } from "zod";

import type { OffBalanceSheet } from "./off-balance-sheet";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba120DerivativeRowSchema = z.object({
  productType: z.enum(["fx", "ir", "equity", "commodity"]),
  maturityBand: z.enum(["lt1y", "1y-to-5y", "gt5y"]),
  notionalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  sourceCount: z.number().int().nonnegative(),
});

const ba120DerivativesSectionSchema = z.object({
  fxRows: z.array(ba120DerivativeRowSchema),
  irRows: z.array(ba120DerivativeRowSchema),
  equityRows: z.array(ba120DerivativeRowSchema),
  commodityRows: z.array(ba120DerivativeRowSchema),
  totalNotionalMinor: z.number().int().nonnegative(),
  coverageNote: z.string().min(1),
});

const ba120GuaranteeRowSchema = z.object({
  guaranteeType: z.enum(["financial", "performance"]),
  maturityBand: z.enum(["lt1y", "1y-to-5y", "gt5y"]),
  nominalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  count: z.number().int().nonnegative(),
});

const ba120GuaranteesSectionSchema = z.object({
  financialGuaranteeRows: z.array(ba120GuaranteeRowSchema),
  performanceGuaranteeRows: z.array(ba120GuaranteeRowSchema),
  totalFinancialNominalMinor: z.number().int().nonnegative(),
  totalPerformanceNominalMinor: z.number().int().nonnegative(),
});

const ba120CommitmentsRowSchema = z.object({
  commitmentType: z.enum(["irrevocable", "revocable"]),
  ccfApplied: z.union([z.literal(0), z.literal(50)]),
  undrawnAmountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  count: z.number().int().nonnegative(),
});

const ba120CommitmentsSectionSchema = z.object({
  rows: z.array(ba120CommitmentsRowSchema),
  totalIrrevocableMinor: z.number().int().nonnegative(),
  totalRevocableMinor: z.number().int().nonnegative(),
  totalUndrawnMinor: z.number().int().nonnegative(),
});

const ba120DocumentarySectionSchema = z.object({
  importLcMinor: z.number().int().nonnegative(),
  exportLcMinor: z.number().int().nonnegative(),
  acceptancesMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  coverageNote: z.string().min(1),
});

const ba120OtherItemSchema = z.object({
  label: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  sourceRef: z.string().min(1).optional(),
});

const ba120OtherSectionSchema = z.object({
  items: z.array(ba120OtherItemSchema),
  totalMinor: z.number().int().nonnegative(),
});

const ba120TotalSchema = z.object({
  derivativesNotionalMinor: z.number().int().nonnegative(),
  guaranteesNominalMinor: z.number().int().nonnegative(),
  commitmentsUndrawnMinor: z.number().int().nonnegative(),
  documentaryCreditsMinor: z.number().int().nonnegative(),
  otherMinor: z.number().int().nonnegative(),
  grandTotalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

/**
 * Canonical JSON schema for a rendered off-balance-sheet.
 * Downstream consumers (regulator-portal slice, PDF renderer) validate
 * inputs against this shape.
 */
export const OffBalanceSheetRenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/off-balance-sheet/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("off-balance-sheet"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    forwardObligationsSnapshotEventId: z.string().min(1).optional(),
    classificationMapFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  derivatives: ba120DerivativesSectionSchema,
  guarantees: ba120GuaranteesSectionSchema,
  commitments: ba120CommitmentsSectionSchema,
  documentaryCredits: ba120DocumentarySectionSchema,
  other: ba120OtherSectionSchema,
  total: ba120TotalSchema,
  classificationGaps: z.array(z.string().min(1)),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type OffBalanceSheetRender = z.infer<typeof OffBalanceSheetRenderSchema>;

export const OFF_BALANCE_SHEET_SCHEMA_URL =
  "https://hoz.bank/schemas/off-balance-sheet/v0.1-rehearsal.json";
export const OFF_BALANCE_SHEET_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderOffBalanceSheetOptions {
  /**
   * ISO-8601 timestamp the render was produced at. Required — supplied by
   * the agent-runtime substrate from the scenario clock; CLI default is
   * `new Date().toISOString()`.
   */
  readonly renderedAt: string;
}

/**
 * Render the off-balance-sheet projection to a typed JSON object validated against
 * `OffBalanceSheetRenderSchema`. Pure function; deterministic for fixed `renderedAt`.
 */
export function renderOffBalanceSheetToJson(
  output: OffBalanceSheet,
  opts: RenderOffBalanceSheetOptions,
): OffBalanceSheetRender {
  const meta: OffBalanceSheetRender["meta"] = {
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    entity: output.meta.entity,
    asOf: output.meta.asOf,
    periodId: output.meta.periodId,
    functionalCurrency: output.meta.functionalCurrency,
    generatorVersion: output.meta.generatorVersion,
    rendererVersion: OFF_BALANCE_SHEET_RENDERER_VERSION,
    ...(output.meta.forwardObligationsSnapshotEventId
      ? { forwardObligationsSnapshotEventId: output.meta.forwardObligationsSnapshotEventId }
      : {}),
    classificationMapFingerprint: output.meta.classificationMapFingerprint,
    renderedAt: opts.renderedAt,
  };

  const candidate = {
    $schema: OFF_BALANCE_SHEET_SCHEMA_URL,
    meta,
    derivatives: {
      fxRows: [...output.derivatives.fxRows],
      irRows: [...output.derivatives.irRows],
      equityRows: [...output.derivatives.equityRows],
      commodityRows: [...output.derivatives.commodityRows],
      totalNotionalMinor: output.derivatives.totalNotionalMinor,
      coverageNote: output.derivatives.coverageNote,
    },
    guarantees: {
      financialGuaranteeRows: [...output.guarantees.financialGuaranteeRows],
      performanceGuaranteeRows: [...output.guarantees.performanceGuaranteeRows],
      totalFinancialNominalMinor: output.guarantees.totalFinancialNominalMinor,
      totalPerformanceNominalMinor: output.guarantees.totalPerformanceNominalMinor,
    },
    commitments: {
      rows: [...output.commitments.rows],
      totalIrrevocableMinor: output.commitments.totalIrrevocableMinor,
      totalRevocableMinor: output.commitments.totalRevocableMinor,
      totalUndrawnMinor: output.commitments.totalUndrawnMinor,
    },
    documentaryCredits: { ...output.documentaryCredits },
    other: {
      items: [...output.other.items],
      totalMinor: output.other.totalMinor,
    },
    total: { ...output.total },
    classificationGaps: [...output.classificationGaps],
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return OffBalanceSheetRenderSchema.parse(candidate);
}

/**
 * Deterministic JSON serialisation: walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent for human
 * readability. Two calls with the same input produce byte-identical
 * output regardless of object-key insertion order. The doc-store hash
 * is over these bytes.
 *
 * Mirrors the canonicaliser in `ba-100-render.ts`.
 */
export function canonicaliseOffBalanceSheet(render: OffBalanceSheetRender): string {
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
export function renderOffBalanceSheetCanonical(
  output: OffBalanceSheet,
  opts: RenderOffBalanceSheetOptions,
): {
  readonly render: OffBalanceSheetRender;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderOffBalanceSheetToJson(output, opts);
  const canonicalJson = canonicaliseOffBalanceSheet(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
