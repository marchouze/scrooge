// platform/reporting/ba-120-render.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — JSON renderer for the BA 610 (Income
// Statement) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10) + Marc's 2026-05-17 directive extending scope.
//
// Determinism mirror of `ba-100-render.ts` / `ba-600-render.ts`.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO).

import { z } from "zod";

import type { Ba610IncomeStatement } from "./ba-120-income-statement";

// ---------------------------------------------------------------------------
// JSON schema — Zod
// ---------------------------------------------------------------------------

const ba300LineItemSchema = z.object({
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  contributingAccounts: z.array(z.string().min(1)),
  subCategory: z.string().min(1).optional(),
  note: z.string().optional(),
});

const ba300CategorySchema = z.object({
  category: z.enum([
    "interest-income",
    "interest-expense",
    "fee-income",
    "trading-pnl",
    "operating-expense",
    "other-income",
    "other-expense",
  ]),
  totalMinor: z.number().int(),
  lineItems: z.array(ba300LineItemSchema),
});

const ba300ClassificationGapSchema = z.object({
  leafAccountId: z.string().min(1),
  currency: z.string().length(3),
  amountMinor: z.number().int(),
});

export const Ba610RenderSchema = z.object({
  $schema: z.literal("https://hoz.bank/schemas/ba-610/v0.1-rehearsal.json"),
  meta: z.object({
    form: z.literal("BA 120"),
    formVersion: z.literal("v0.1-rehearsal"),
    entity: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    periodId: z.string().min(1),
    functionalCurrency: z.string().length(3),
    generatorVersion: z.literal("v0.1"),
    rendererVersion: z.literal("v0.1"),
    trialBalanceSnapshotEventId: z.string().min(1).optional(),
    classificationsFingerprint: z.string().min(1),
    renderedAt: z.string().min(1),
  }),
  interestIncome: ba300CategorySchema,
  interestExpense: ba300CategorySchema,
  netInterestIncomeMinor: z.number().int(),
  feeIncome: ba300CategorySchema,
  tradingProfitLoss: ba300CategorySchema,
  operatingExpenses: ba300CategorySchema,
  otherIncome: ba300CategorySchema,
  otherExpenses: ba300CategorySchema,
  profitBeforeTaxMinor: z.number().int(),
  classificationGaps: z.array(ba300ClassificationGapSchema),
  citations: z.array(z.string().min(1)),
  placeholders: z.array(z.string().min(1)),
});

export type Ba610Render = z.infer<typeof Ba610RenderSchema>;

export const BA_610_SCHEMA_URL = "https://hoz.bank/schemas/ba-610/v0.1-rehearsal.json";
export const BA_610_RENDERER_VERSION = "v0.1" as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderBa610Options {
  readonly renderedAt: string;
}

export function renderBa610ToJson(
  output: Ba610IncomeStatement,
  opts: RenderBa610Options,
): Ba610Render {
  const meta: Ba610Render["meta"] = {
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    entity: output.meta.entity,
    periodStart: output.meta.periodStart,
    periodEnd: output.meta.periodEnd,
    periodId: output.meta.periodId,
    functionalCurrency: output.meta.functionalCurrency,
    generatorVersion: output.meta.generatorVersion,
    rendererVersion: BA_610_RENDERER_VERSION,
    ...(output.meta.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: output.meta.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: output.meta.classificationsFingerprint,
    renderedAt: opts.renderedAt,
  };

  const candidate = {
    $schema: BA_610_SCHEMA_URL,
    meta,
    interestIncome: output.interestIncome,
    interestExpense: output.interestExpense,
    netInterestIncomeMinor: output.netInterestIncomeMinor,
    feeIncome: output.feeIncome,
    tradingProfitLoss: output.tradingProfitLoss,
    operatingExpenses: output.operatingExpenses,
    otherIncome: output.otherIncome,
    otherExpenses: output.otherExpenses,
    profitBeforeTaxMinor: output.profitBeforeTaxMinor,
    classificationGaps: [...output.classificationGaps],
    citations: [...output.citations],
    placeholders: [...output.placeholders],
  };

  return Ba610RenderSchema.parse(candidate);
}

export function canonicaliseBa610(render: Ba610Render): string {
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

export function renderBa610Canonical(
  output: Ba610IncomeStatement,
  opts: RenderBa610Options,
): {
  readonly render: Ba610Render;
  readonly canonicalJson: string;
  readonly canonicalBytes: Uint8Array;
} {
  const render = renderBa610ToJson(output, opts);
  const canonicalJson = canonicaliseBa610(render);
  const canonicalBytes = new TextEncoder().encode(canonicalJson);
  return { render, canonicalJson, canonicalBytes };
}
