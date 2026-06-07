// platform/reporting/ifrs-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — JSON renderer for the
// IFRS-statement outputs (Balance Sheet / Income Statement / Cash Flow /
// Changes in Equity / Notes skeleton).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 6, Marc's Q5 default (JSON-first; PDF / HTML
// are downstream rendering slices).
//
// Each statement gets its own typed Zod schema; the canonical bundle
// renderer composes all five into one document for the dry-run scenario
// (per pack §6 Slice 6: "Phase C of the dry-run scenario — simulated IFRS
// statements rendered from event-store data"). All JSON is byte-
// deterministic via the same `sortKeys` walker pattern used in BA 100
// Slice 4.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import { z } from "zod";

import type { IfrsBalanceSheetOutput } from "./ifrs-balance-sheet";
import type { IfrsCashFlowOutput } from "./ifrs-cash-flow";
import type { IfrsChangesInEquityOutput } from "./ifrs-changes-in-equity";
import type { IfrsIncomeStatementOutput } from "./ifrs-income-statement";
import type { IfrsNotesOutput } from "./ifrs-notes";
import type { IfrsOutputMeta } from "./ifrs-types";

export const IFRS_RENDERER_VERSION = "v0.1" as const;
export const IFRS_SCHEMA_BASE_URL = "https://hoz.bank/schemas/ifrs" as const;

// ---------------------------------------------------------------------------
// Common sub-schemas
// ---------------------------------------------------------------------------

const ifrsLineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int(),
  comparativeAmountMinor: z.number().int().nullable(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  note: z.string().optional(),
});

const ifrsMetaSchema = z.object({
  statement: z.enum(["SoFP", "P&L", "SCF", "SoCE", "notes"]),
  statementVersion: z.literal("v0.1-rehearsal"),
  entity: z.string().min(1),
  asOf: z.string().min(1),
  periodId: z.string().min(1),
  functionalCurrency: z.string().length(3),
  generatorVersion: z.literal("v0.1"),
  rendererVersion: z.literal("v0.1"),
  renderedAt: z.string().min(1),
  comparativeAsOf: z.string().min(1).optional(),
  trialBalanceSnapshotEventId: z.string().min(1).optional(),
  classificationsFingerprint: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Per-statement schemas
// ---------------------------------------------------------------------------

const balanceSheetSectionSchema = z.object({
  totalMinor: z.number().int(),
  comparativeTotalMinor: z.number().int().nullable(),
  lineItems: z.array(ifrsLineItemSchema),
});

export const IfrsBalanceSheetRenderSchema = z.object({
  $schema: z.literal(`${IFRS_SCHEMA_BASE_URL}/balance-sheet/v0.1-rehearsal.json`),
  meta: ifrsMetaSchema,
  assets: balanceSheetSectionSchema,
  liabilities: balanceSheetSectionSchema,
  equity: balanceSheetSectionSchema,
  accountingEquationCheck: z.object({
    totalAssetsMinor: z.number().int(),
    totalLiabilitiesPlusEquityMinor: z.number().int(),
    differenceMinor: z.number().int(),
    balanced: z.boolean(),
  }),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

const incomeSectionSchema = z.object({
  totalMinor: z.number().int(),
  comparativeTotalMinor: z.number().int().nullable(),
  lineItems: z.array(ifrsLineItemSchema),
});

const totalSchema = z.object({
  amountMinor: z.number().int(),
  comparativeAmountMinor: z.number().int().nullable(),
});

export const IfrsIncomeStatementRenderSchema = z.object({
  $schema: z.literal(`${IFRS_SCHEMA_BASE_URL}/income-statement/v0.1-rehearsal.json`),
  meta: ifrsMetaSchema,
  income: incomeSectionSchema,
  expense: incomeSectionSchema,
  profitOrLoss: totalSchema,
  otherComprehensiveIncome: incomeSectionSchema,
  totalComprehensiveIncome: totalSchema,
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

const cashFlowSectionSchema = z.object({
  netCashMinor: z.number().int(),
  comparativeNetCashMinor: z.number().int().nullable(),
  lineItems: z.array(ifrsLineItemSchema),
});

export const IfrsCashFlowRenderSchema = z.object({
  $schema: z.literal(`${IFRS_SCHEMA_BASE_URL}/cash-flow/v0.1-rehearsal.json`),
  meta: ifrsMetaSchema,
  profitOrLossStartingPoint: totalSchema,
  operating: cashFlowSectionSchema,
  investing: cashFlowSectionSchema,
  financing: cashFlowSectionSchema,
  netChangeInCash: totalSchema,
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

const equityComponentMovementSchema = z.object({
  component: z.enum(["share-capital", "retained-earnings", "oci-reserve", "other-reserves"]),
  openingBalanceMinor: z.number().int(),
  comprehensiveIncomeMinor: z.number().int(),
  ownerTransactionsMinor: z.number().int(),
  closingBalanceMinor: z.number().int(),
});

export const IfrsChangesInEquityRenderSchema = z.object({
  $schema: z.literal(`${IFRS_SCHEMA_BASE_URL}/changes-in-equity/v0.1-rehearsal.json`),
  meta: ifrsMetaSchema,
  openingEquityTotalMinor: z.number().int(),
  profitOrLossMinor: z.number().int(),
  otherComprehensiveIncomeMinor: z.number().int(),
  totalComprehensiveIncomeMinor: z.number().int(),
  ownerTransactionsTotalMinor: z.number().int(),
  closingEquityTotalMinor: z.number().int(),
  components: z.array(equityComponentMovementSchema),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

const ifrsNoteHeadingSchema = z.object({
  noteNumber: z.number().int().positive(),
  title: z.string().min(1),
  ifrsRef: z.string().min(1),
  status: z.literal("skeleton"),
  placeholder: z.string().min(1),
});

export const IfrsNotesRenderSchema = z.object({
  $schema: z.literal(`${IFRS_SCHEMA_BASE_URL}/notes/v0.1-rehearsal.json`),
  meta: ifrsMetaSchema,
  notes: z.array(ifrsNoteHeadingSchema),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export const IfrsBundleRenderSchema = z.object({
  $schema: z.literal(`${IFRS_SCHEMA_BASE_URL}/bundle/v0.1-rehearsal.json`),
  bundleMeta: z.object({
    entity: z.string().min(1),
    asOf: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    rendererVersion: z.literal("v0.1"),
    renderedAt: z.string().min(1),
    comparativeAsOf: z.string().min(1).optional(),
  }),
  balanceSheet: IfrsBalanceSheetRenderSchema,
  incomeStatement: IfrsIncomeStatementRenderSchema,
  cashFlow: IfrsCashFlowRenderSchema,
  changesInEquity: IfrsChangesInEquityRenderSchema,
  notes: IfrsNotesRenderSchema,
});

export type IfrsBalanceSheetRender = z.infer<typeof IfrsBalanceSheetRenderSchema>;
export type IfrsIncomeStatementRender = z.infer<typeof IfrsIncomeStatementRenderSchema>;
export type IfrsCashFlowRender = z.infer<typeof IfrsCashFlowRenderSchema>;
export type IfrsChangesInEquityRender = z.infer<typeof IfrsChangesInEquityRenderSchema>;
export type IfrsNotesRender = z.infer<typeof IfrsNotesRenderSchema>;
export type IfrsBundleRender = z.infer<typeof IfrsBundleRenderSchema>;

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export interface RenderIfrsOptions {
  /** ISO-8601 timestamp the render was produced at. */
  readonly renderedAt: string;
}

function metaWith(meta: IfrsOutputMeta, renderedAt: string): z.infer<typeof ifrsMetaSchema> {
  return {
    ...meta,
    rendererVersion: IFRS_RENDERER_VERSION,
    renderedAt,
  } as z.infer<typeof ifrsMetaSchema>;
}

export function renderIfrsBalanceSheet(
  output: IfrsBalanceSheetOutput,
  opts: RenderIfrsOptions,
): IfrsBalanceSheetRender {
  const candidate = {
    $schema: `${IFRS_SCHEMA_BASE_URL}/balance-sheet/v0.1-rehearsal.json` as const,
    meta: metaWith(output.meta, opts.renderedAt),
    assets: output.assets,
    liabilities: output.liabilities,
    equity: output.equity,
    accountingEquationCheck: output.accountingEquationCheck,
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };
  return IfrsBalanceSheetRenderSchema.parse(candidate);
}

export function renderIfrsIncomeStatement(
  output: IfrsIncomeStatementOutput,
  opts: RenderIfrsOptions,
): IfrsIncomeStatementRender {
  const candidate = {
    $schema: `${IFRS_SCHEMA_BASE_URL}/income-statement/v0.1-rehearsal.json` as const,
    meta: metaWith(output.meta, opts.renderedAt),
    income: output.income,
    expense: output.expense,
    profitOrLoss: output.profitOrLoss,
    otherComprehensiveIncome: output.otherComprehensiveIncome,
    totalComprehensiveIncome: output.totalComprehensiveIncome,
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };
  return IfrsIncomeStatementRenderSchema.parse(candidate);
}

export function renderIfrsCashFlow(
  output: IfrsCashFlowOutput,
  opts: RenderIfrsOptions,
): IfrsCashFlowRender {
  const candidate = {
    $schema: `${IFRS_SCHEMA_BASE_URL}/cash-flow/v0.1-rehearsal.json` as const,
    meta: metaWith(output.meta, opts.renderedAt),
    profitOrLossStartingPoint: output.profitOrLossStartingPoint,
    operating: output.operating,
    investing: output.investing,
    financing: output.financing,
    netChangeInCash: output.netChangeInCash,
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };
  return IfrsCashFlowRenderSchema.parse(candidate);
}

export function renderIfrsChangesInEquity(
  output: IfrsChangesInEquityOutput,
  opts: RenderIfrsOptions,
): IfrsChangesInEquityRender {
  const candidate = {
    $schema: `${IFRS_SCHEMA_BASE_URL}/changes-in-equity/v0.1-rehearsal.json` as const,
    meta: metaWith(output.meta, opts.renderedAt),
    openingEquityTotalMinor: output.openingEquityTotalMinor,
    profitOrLossMinor: output.profitOrLossMinor,
    otherComprehensiveIncomeMinor: output.otherComprehensiveIncomeMinor,
    totalComprehensiveIncomeMinor: output.totalComprehensiveIncomeMinor,
    ownerTransactionsTotalMinor: output.ownerTransactionsTotalMinor,
    closingEquityTotalMinor: output.closingEquityTotalMinor,
    components: [...output.components],
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };
  return IfrsChangesInEquityRenderSchema.parse(candidate);
}

export function renderIfrsNotes(output: IfrsNotesOutput, opts: RenderIfrsOptions): IfrsNotesRender {
  const candidate = {
    $schema: `${IFRS_SCHEMA_BASE_URL}/notes/v0.1-rehearsal.json` as const,
    meta: metaWith(output.meta, opts.renderedAt),
    notes: [...output.notes],
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };
  return IfrsNotesRenderSchema.parse(candidate);
}

// ---------------------------------------------------------------------------
// Bundle render — composes all 5 statements into one document
// ---------------------------------------------------------------------------

export interface IfrsBundleInput {
  readonly balanceSheet: IfrsBalanceSheetOutput;
  readonly incomeStatement: IfrsIncomeStatementOutput;
  readonly cashFlow: IfrsCashFlowOutput;
  readonly changesInEquity: IfrsChangesInEquityOutput;
  readonly notes: IfrsNotesOutput;
}

export function renderIfrsBundle(
  inputs: IfrsBundleInput,
  opts: RenderIfrsOptions,
): IfrsBundleRender {
  // Coherence — all statements must share entity / asOf / periodId / currency.
  const m = inputs.balanceSheet.meta;
  for (const other of [
    inputs.incomeStatement.meta,
    inputs.cashFlow.meta,
    inputs.changesInEquity.meta,
    inputs.notes.meta,
  ]) {
    if (other.entity !== m.entity)
      throw new Error(
        `IFRS bundle: statement entities differ — ${m.entity} vs ${other.entity} on ${other.statement}`,
      );
    if (other.asOf !== m.asOf)
      throw new Error(
        `IFRS bundle: statement asOf differs — ${m.asOf} vs ${other.asOf} on ${other.statement}`,
      );
    if (other.periodId !== m.periodId)
      throw new Error(
        `IFRS bundle: statement periodId differs — ${m.periodId} vs ${other.periodId} on ${other.statement}`,
      );
    if (other.functionalCurrency !== m.functionalCurrency)
      throw new Error(
        `IFRS bundle: statement functionalCurrency differs — ${m.functionalCurrency} vs ${other.functionalCurrency} on ${other.statement}`,
      );
  }

  const candidate = {
    $schema: `${IFRS_SCHEMA_BASE_URL}/bundle/v0.1-rehearsal.json` as const,
    bundleMeta: {
      entity: m.entity,
      asOf: m.asOf,
      periodId: m.periodId,
      functionalCurrency: m.functionalCurrency,
      rendererVersion: IFRS_RENDERER_VERSION,
      renderedAt: opts.renderedAt,
      ...(m.comparativeAsOf ? { comparativeAsOf: m.comparativeAsOf } : {}),
    },
    balanceSheet: renderIfrsBalanceSheet(inputs.balanceSheet, opts),
    incomeStatement: renderIfrsIncomeStatement(inputs.incomeStatement, opts),
    cashFlow: renderIfrsCashFlow(inputs.cashFlow, opts),
    changesInEquity: renderIfrsChangesInEquity(inputs.changesInEquity, opts),
    notes: renderIfrsNotes(inputs.notes, opts),
  };
  return IfrsBundleRenderSchema.parse(candidate);
}

// ---------------------------------------------------------------------------
// Canonicalisation — byte-deterministic
// ---------------------------------------------------------------------------

/**
 * Sort-keyed JSON serialisation. Mirrors `canonicaliseBa100` in
 * `ba-100-render.ts`. Two calls with the same input produce byte-identical
 * output.
 */
export function canonicaliseIfrs<T>(render: T): string {
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
 * One-shot helper: render the full bundle + canonicalise. Returns the
 * canonical JSON string + UTF-8 bytes (the doc-store hash is over these
 * bytes).
 */
export function renderIfrsBundleCanonical(
  inputs: IfrsBundleInput,
  opts: RenderIfrsOptions,
): {
  readonly render: IfrsBundleRender;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderIfrsBundle(inputs, opts);
  const canonicalJson = canonicaliseIfrs(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
