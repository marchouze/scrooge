// platform/reporting/ba-320-credit-risk.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 11 — BA 320 (Credit-Risk
// Loans-and-Advances Breakdown) projection. Monthly SARB return; IFRS 9
// impairment stages 1/2/3 aligned.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 11 + Marc's 2026-05-17 directive.
// Workstream: WS-FINANCE-BA-RETURNS-QUINTET.
//
// This module is a *pure projection* over caller-supplied portfolio data.
// No event-store reads, no trial-balance reads, no document-store writes.
// Callers (the CLI wrapper at `prototype/scripts/render-ba-320.ts`,
// downstream `ReportGenerated` event emitters) compose the inputs and
// consume the output.
//
// Pipeline:
//
//   CALLER-SUPPLIED PORTFOLIO   (loan-level IFRS 9 data)
//      → BA 320 PROJECTION      — this module — pure function
//      → RENDER + STORE         — `ba-320-render.ts` + RMS doc store
//
// Computation per Banks Act 94 of 1990 §73 + Regulations Relating to
// Banks Reg 23 + IFRS 9 §5.5 (impairment):
//
//   IFRS 9 stage definitions (per Procedures/by-policy/ecl-staging-cycle.md):
//     Stage 1 — performing; no Significant Increase in Credit Risk (SICR)
//               → 12-month ECL
//     Stage 2 — SICR but not credit-impaired → lifetime ECL
//     Stage 3 — credit-impaired → lifetime ECL
//
//   ECL invariant (hard assertion):
//     sum(ecl12Month  for stage-1 entries)
//   + sum(eclLifetime for stage-2 + stage-3 entries)
//   == sum(allowanceForCreditLoss for all entries)
//
//   Derived ratios:
//     nplRatio      = Stage-3 grossCarryingAmount / total grossCarryingAmount
//     coverageRatio = Stage-3 allowanceForCreditLoss / Stage-3 grossCarryingAmount
//
// Per-entity. BA 320 is bank-licence-bound. Only LE-ZA-HOZ-BANK is in scope
// at v0. The generator throws on securities or group entities.
// Group-consolidation deferred under D-REGULATORY-PERIMETER.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **No real loans sub-ledger** — v0 takes caller-supplied portfolio
//     (`Ba320LoansPortfolio`). `@platform/projections/ecl-staging` (PLANNED
//     per ecl-staging-cycle.md) will supply this projection at a later slice;
//     the generator's input shape is forward-compatible.
//   - **PD / LGD / EAD models** (Helena / risk team, downstream) — ECL
//     amounts are caller-supplied at v0; real model outputs replace at
//     licence-day. Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
//   - **XML adapter for SARB submission** deferred; build-phase rehearsal
//     produces JSON only. XML adapter lands at Slice 12+ (same pattern as
//     ba-350-xml-adapter + ba-600-xml-adapter).
//   - **Group-consolidated BA 320** deferred under D-REGULATORY-PERIMETER.
//   - **Multi-currency ECL translation** — v0 folds each entry in its
//     reported currency. Currency cross-checks are caller responsibility;
//     the generator asserts that the classification map's BA-row vocabulary
//     covers all productCategories (classificationGaps surfaced for any
//     missing mapping).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration)
//   + Helena (Chief Risk Officer, governance — IFRS 9 staging methodology
//   owner; ECL invariant specification).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * IFRS 9 impairment stage per §5.5.
 *   1 — performing; no SICR → 12-month ECL
 *   2 — SICR, not credit-impaired → lifetime ECL
 *   3 — credit-impaired → lifetime ECL
 *
 * Authority: Procedures/by-policy/ecl-staging-cycle.md
 */
export type Ba320Stage = 1 | 2 | 3;

/**
 * One loan / advance entry in the caller-supplied portfolio.
 *
 * Sign convention: all monetary amounts are in minor units (cents for ZAR,
 * etc.) and **positive**. grossCarryingAmount, ecl12Month, eclLifetime,
 * allowanceForCreditLoss, and netCarryingAmount are positive magnitudes.
 *
 * ECL usage rule:
 *   - stage 1 → ecl12Month is the relevant ECL;  eclLifetime should be 0.
 *   - stage 2 / 3 → eclLifetime is the relevant ECL; ecl12Month should be 0.
 *
 * allowanceForCreditLoss must equal the relevant ECL for each entry.
 * The generator asserts the portfolio-level ECL invariant.
 */
export interface Ba320LoanEntry {
  /** Unique counterparty identifier (e.g. from the Party register). */
  readonly counterpartyId: string;
  /**
   * Product category key — must map to a row in the BA 320 classification
   * map. Standard build-phase values: "interbank", "corporate",
   * "sovereign-placeholder". The vocabulary will be extended as Mira's
   * WS-INSTRUMENT-ANALYSES resolves the SARB BA 320 published taxonomy.
   */
  readonly productCategory: string;
  /** Gross carrying amount per IFRS 9 §5.4 (before ECL deduction). */
  readonly grossCarryingAmount: number;
  /** IFRS 9 stage (1 / 2 / 3). */
  readonly stage: Ba320Stage;
  /**
   * 12-month expected credit loss. Non-zero only for stage-1 entries.
   * Set to 0 for stage 2 / 3.
   */
  readonly ecl12Month: number;
  /**
   * Lifetime expected credit loss. Non-zero only for stage-2 / stage-3
   * entries. Set to 0 for stage 1.
   */
  readonly eclLifetime: number;
  /**
   * Allowance for credit loss recognised on the balance sheet.
   * Must equal ecl12Month (stage 1) or eclLifetime (stage 2 / 3).
   * The portfolio-level invariant asserts sum(ACL) == sum(relevant ECL).
   */
  readonly allowanceForCreditLoss: number;
  /** Net carrying amount = grossCarryingAmount − allowanceForCreditLoss. */
  readonly netCarryingAmount: number;
  /** ISO 4217 currency of the loan entry. */
  readonly currency: string;
}

/**
 * Classification map entry: maps a productCategory key to the BA 320
 * form row label. Missing entries are surfaced in `classificationGaps`.
 */
export interface Ba320ClassificationEntry {
  readonly productCategory: string;
  /** BA 320 form row label (e.g. "Loans and advances — corporate"). */
  readonly ba320RowLabel: string;
  /** Optional subsection code for SARB form sub-line reference. */
  readonly ba320SubCode?: string;
}

/**
 * Caller-supplied BA 320 generator input.
 */
export interface Ba320GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank entities. */
  readonly entity: string;
  /** ISO 8601 as-of date (period-end). */
  readonly asOf: string;
  /** Period identifier (e.g. `period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency (for summary totals and ratio sections). */
  readonly functionalCurrency: string;
  /**
   * Loan-level portfolio. Each entry carries IFRS 9 stage + ECL data.
   * v0: caller-supplied. Future: `@platform/projections/ecl-staging` will
   * supply this projection.
   */
  readonly portfolio: readonly Ba320LoanEntry[];
  /**
   * Classification map: productCategory → BA 320 form row.
   * Categories missing from the map are surfaced in `classificationGaps`.
   */
  readonly classificationMap: readonly Ba320ClassificationEntry[];
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Aggregated totals for one product category.
 */
export interface Ba320CategorySection {
  readonly productCategory: string;
  readonly ba320RowLabel: string;
  readonly ba320SubCode?: string;
  readonly totalGrossCarryingAmount: number;
  readonly totalAllowanceForCreditLoss: number;
  readonly totalNetCarryingAmount: number;
  readonly stage1Count: number;
  readonly stage2Count: number;
  readonly stage3Count: number;
  /** Primary currency of entries in this category (majority-by-count). */
  readonly primaryCurrency: string;
}

/**
 * Aggregated totals for one IFRS 9 stage across all categories.
 */
export interface Ba320StageSection {
  readonly stage: Ba320Stage;
  readonly stageLabel: string;
  readonly eclBasis: "12-month" | "lifetime";
  readonly totalGrossCarryingAmount: number;
  readonly totalEcl: number;
  readonly totalAllowanceForCreditLoss: number;
  readonly totalNetCarryingAmount: number;
  readonly entryCount: number;
}

/**
 * Grand totals across all loans and advances.
 */
export interface Ba320Total {
  readonly totalGrossCarryingAmount: number;
  readonly totalAllowanceForCreditLoss: number;
  readonly totalNetCarryingAmount: number;
  readonly totalEcl: number;
  readonly totalEntries: number;
}

/**
 * Full BA 320 output.
 */
export interface Ba320CreditRisk {
  readonly meta: {
    readonly form: "BA 320";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly portfolioFingerprint: string;
    readonly classificationFingerprint: string;
  };
  /** Aggregated view by product category (interbank / corporate / etc.). */
  readonly byCategory: readonly Ba320CategorySection[];
  /** Aggregated view by IFRS 9 stage (1 / 2 / 3). */
  readonly byStage: readonly [Ba320StageSection, Ba320StageSection, Ba320StageSection];
  /** Grand totals. */
  readonly totalLoansAndAdvances: Ba320Total;
  /**
   * NPL (non-performing loan) ratio = Stage-3 gross / total gross.
   * Range [0, 1]. Infinity if total gross is 0.
   */
  readonly nplRatio: number;
  /**
   * Coverage ratio = Stage-3 ACL / Stage-3 gross.
   * Range [0, 1]. Infinity if Stage-3 gross is 0.
   */
  readonly coverageRatio: number;
  /**
   * Product categories present in the portfolio but absent from the
   * classification map. These entries still contribute to stage/total
   * aggregates but cannot be mapped to a BA 320 form row.
   */
  readonly classificationGaps: readonly string[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba320GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba320GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids in scope for BA 320.
 * Only Hoz Bank at v0; group-consolidated BA 320 deferred under
 * D-REGULATORY-PERIMETER.
 */
export const BA_320_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_320_BANK_ENTITIES.includes(entity)) {
    throw new Ba320GeneratorError(
      `BA 320 (Credit-Risk Loans-and-Advances) is bank-licence-bound; entity '${entity}' is not in BA_320_BANK_ENTITIES (${BA_320_BANK_ENTITIES.join(", ")}). Group-consolidated BA 320 is deferred under D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// ECL invariant assertion
// ---------------------------------------------------------------------------

/**
 * Assert the portfolio-level ECL invariant:
 *
 *   sum(ecl12Month  for stage-1 entries)
 * + sum(eclLifetime for stage-2 / stage-3 entries)
 * == sum(allowanceForCreditLoss for all entries)
 *
 * Authority: IFRS 9 §5.5 + Helena (CRO, governance) ECL spec.
 * Throws `Ba320GeneratorError` if the invariant is violated.
 */
function assertEclInvariant(portfolio: readonly Ba320LoanEntry[]): void {
  let sumRelevantEcl = 0;
  let sumAcl = 0;
  for (const entry of portfolio) {
    const relevantEcl = entry.stage === 1 ? entry.ecl12Month : entry.eclLifetime;
    sumRelevantEcl += relevantEcl;
    sumAcl += entry.allowanceForCreditLoss;
  }
  // Floating-point tolerance: allow 1 minor unit of rounding error
  if (Math.abs(sumRelevantEcl - sumAcl) > 1) {
    throw new Ba320GeneratorError(
      `BA 320 ECL invariant violated: sum(relevant ECL) = ${sumRelevantEcl} ≠ sum(allowanceForCreditLoss) = ${sumAcl}. ` +
        `Difference: ${sumRelevantEcl - sumAcl}. ` +
        `Stage-1 entries must use ecl12Month; stage-2/3 entries must use eclLifetime. ` +
        `Authority: IFRS 9 §5.5; Procedures/by-policy/ecl-staging-cycle.md.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<Ba320Stage, string> = {
  1: "Stage 1 — Performing (12-month ECL)",
  2: "Stage 2 — SICR (Lifetime ECL)",
  3: "Stage 3 — Credit-impaired (Lifetime ECL)",
};

const STAGE_ECL_BASIS: Record<Ba320Stage, "12-month" | "lifetime"> = {
  1: "12-month",
  2: "lifetime",
  3: "lifetime",
};

function majorityString(values: string[]): string {
  if (values.length === 0) return "ZAR";
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = 0;
  let winner = values[0] ?? "ZAR";
  for (const [v, c] of counts) {
    if (c > max) {
      max = c;
      winner = v;
    }
  }
  return winner;
}

function fingerprintPortfolio(portfolio: readonly Ba320LoanEntry[]): string {
  // Deterministic: sort by (counterpartyId, productCategory, stage) before JSON
  const sorted = [...portfolio].sort((a, b) => {
    if (a.counterpartyId !== b.counterpartyId)
      return a.counterpartyId < b.counterpartyId ? -1 : 1;
    if (a.productCategory !== b.productCategory)
      return a.productCategory < b.productCategory ? -1 : 1;
    return a.stage - b.stage;
  });
  return JSON.stringify(sorted);
}

function fingerprintClassification(map: readonly Ba320ClassificationEntry[]): string {
  const sorted = [...map].sort((a, b) =>
    a.productCategory < b.productCategory ? -1 : a.productCategory > b.productCategory ? 1 : 0,
  );
  return JSON.stringify(sorted);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 320 (Credit-Risk Loans-and-Advances Breakdown) projection
 * from a caller-supplied portfolio + classification map. Pure function;
 * deterministic.
 *
 * The portfolio is folded by:
 *   (a) product category — producing `byCategory` aggregates for each
 *       distinct category that can be mapped to a BA 320 form row;
 *   (b) IFRS 9 stage — producing `byStage` aggregates (stage 1 / 2 / 3);
 *   (c) grand totals.
 *
 * The ECL invariant is asserted before any aggregation:
 *   sum(ecl12Month for stage-1) + sum(eclLifetime for stage-2/3)
 *   == sum(allowanceForCreditLoss)
 *
 * Validation performed:
 *   - Entity must be in BA_320_BANK_ENTITIES.
 *   - grossCarryingAmount, allowanceForCreditLoss, netCarryingAmount,
 *     ecl12Month, eclLifetime are non-negative.
 *   - netCarryingAmount == grossCarryingAmount − allowanceForCreditLoss
 *     (within 1 minor unit).
 *   - ECL invariant (see `assertEclInvariant`).
 *
 * Missing classification entries are collected in `classificationGaps`;
 * those entries still contribute to stage / total aggregates.
 */
export function generateBa320CreditRisk(input: Ba320GeneratorInput): Ba320CreditRisk {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba320GeneratorError(
      `BA 320 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }

  // Validate entry-level constraints
  for (const entry of input.portfolio) {
    if (
      entry.grossCarryingAmount < 0 ||
      entry.allowanceForCreditLoss < 0 ||
      entry.netCarryingAmount < 0 ||
      entry.ecl12Month < 0 ||
      entry.eclLifetime < 0
    ) {
      throw new Ba320GeneratorError(
        `BA 320 generator: all monetary amounts must be non-negative (counterparty '${entry.counterpartyId}', category '${entry.productCategory}').`,
      );
    }
    const expectedNet = entry.grossCarryingAmount - entry.allowanceForCreditLoss;
    if (Math.abs(entry.netCarryingAmount - expectedNet) > 1) {
      throw new Ba320GeneratorError(
        `BA 320 generator: netCarryingAmount mismatch for counterparty '${entry.counterpartyId}': ` +
          `gross(${entry.grossCarryingAmount}) − acl(${entry.allowanceForCreditLoss}) = ${expectedNet} ≠ net(${entry.netCarryingAmount}).`,
      );
    }
  }

  // ECL invariant assertion (hard — throws if violated)
  assertEclInvariant(input.portfolio);

  // Build classification index
  const classMap = new Map<string, Ba320ClassificationEntry>();
  for (const c of input.classificationMap) {
    classMap.set(c.productCategory, c);
  }

  // -----------------------------------------------------------------------
  // Fold by product category
  // -----------------------------------------------------------------------

  type CategoryAccum = {
    grossCarryingAmount: number;
    allowanceForCreditLoss: number;
    netCarryingAmount: number;
    stage1Count: number;
    stage2Count: number;
    stage3Count: number;
    currencies: string[];
  };

  const categoryAccum = new Map<string, CategoryAccum>();
  const classificationGapSet = new Set<string>();

  for (const entry of input.portfolio) {
    const cat = entry.productCategory;
    if (!classMap.has(cat)) {
      classificationGapSet.add(cat);
    }
    if (!categoryAccum.has(cat)) {
      categoryAccum.set(cat, {
        grossCarryingAmount: 0,
        allowanceForCreditLoss: 0,
        netCarryingAmount: 0,
        stage1Count: 0,
        stage2Count: 0,
        stage3Count: 0,
        currencies: [],
      });
    }
    const acc = categoryAccum.get(cat)!;
    acc.grossCarryingAmount += entry.grossCarryingAmount;
    acc.allowanceForCreditLoss += entry.allowanceForCreditLoss;
    acc.netCarryingAmount += entry.netCarryingAmount;
    if (entry.stage === 1) acc.stage1Count++;
    else if (entry.stage === 2) acc.stage2Count++;
    else acc.stage3Count++;
    acc.currencies.push(entry.currency);
  }

  // Build byCategory — sorted by productCategory for determinism
  const byCategory: Ba320CategorySection[] = Array.from(categoryAccum.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cat, acc]) => {
      const classEntry = classMap.get(cat);
      return {
        productCategory: cat,
        ba320RowLabel: classEntry?.ba320RowLabel ?? `[citation: TBC — ${cat} not in classification map]`,
        ...(classEntry?.ba320SubCode ? { ba320SubCode: classEntry.ba320SubCode } : {}),
        totalGrossCarryingAmount: acc.grossCarryingAmount,
        totalAllowanceForCreditLoss: acc.allowanceForCreditLoss,
        totalNetCarryingAmount: acc.netCarryingAmount,
        stage1Count: acc.stage1Count,
        stage2Count: acc.stage2Count,
        stage3Count: acc.stage3Count,
        primaryCurrency: majorityString(acc.currencies),
      };
    });

  // -----------------------------------------------------------------------
  // Fold by stage
  // -----------------------------------------------------------------------

  type StageAccum = {
    grossCarryingAmount: number;
    ecl: number;
    allowanceForCreditLoss: number;
    netCarryingAmount: number;
    entryCount: number;
  };

  const stageAccum: Record<Ba320Stage, StageAccum> = {
    1: { grossCarryingAmount: 0, ecl: 0, allowanceForCreditLoss: 0, netCarryingAmount: 0, entryCount: 0 },
    2: { grossCarryingAmount: 0, ecl: 0, allowanceForCreditLoss: 0, netCarryingAmount: 0, entryCount: 0 },
    3: { grossCarryingAmount: 0, ecl: 0, allowanceForCreditLoss: 0, netCarryingAmount: 0, entryCount: 0 },
  };

  for (const entry of input.portfolio) {
    const s = stageAccum[entry.stage];
    s.grossCarryingAmount += entry.grossCarryingAmount;
    s.ecl += entry.stage === 1 ? entry.ecl12Month : entry.eclLifetime;
    s.allowanceForCreditLoss += entry.allowanceForCreditLoss;
    s.netCarryingAmount += entry.netCarryingAmount;
    s.entryCount++;
  }

  const byStage: [Ba320StageSection, Ba320StageSection, Ba320StageSection] = [1, 2, 3].map(
    (stageNum) => {
      const s = stageNum as Ba320Stage;
      const acc = stageAccum[s];
      return {
        stage: s,
        stageLabel: STAGE_LABELS[s],
        eclBasis: STAGE_ECL_BASIS[s],
        totalGrossCarryingAmount: acc.grossCarryingAmount,
        totalEcl: acc.ecl,
        totalAllowanceForCreditLoss: acc.allowanceForCreditLoss,
        totalNetCarryingAmount: acc.netCarryingAmount,
        entryCount: acc.entryCount,
      };
    },
  ) as [Ba320StageSection, Ba320StageSection, Ba320StageSection];

  // -----------------------------------------------------------------------
  // Grand totals
  // -----------------------------------------------------------------------

  const totalGross = byStage.reduce((s, x) => s + x.totalGrossCarryingAmount, 0);
  const totalAcl = byStage.reduce((s, x) => s + x.totalAllowanceForCreditLoss, 0);
  const totalNet = byStage.reduce((s, x) => s + x.totalNetCarryingAmount, 0);
  const totalEcl = byStage.reduce((s, x) => s + x.totalEcl, 0);
  const totalEntries = byStage.reduce((s, x) => s + x.entryCount, 0);

  // -----------------------------------------------------------------------
  // Ratios
  // -----------------------------------------------------------------------

  const stage3Gross = stageAccum[3].grossCarryingAmount;
  const stage3Acl = stageAccum[3].allowanceForCreditLoss;

  const nplRatio = totalGross > 0 ? stage3Gross / totalGross : Number.POSITIVE_INFINITY;
  const coverageRatio = stage3Gross > 0 ? stage3Acl / stage3Gross : Number.POSITIVE_INFINITY;

  // -----------------------------------------------------------------------
  // Placeholders
  // -----------------------------------------------------------------------

  const placeholders: string[] = [];
  if (input.portfolio.length === 0) {
    placeholders.push(
      "[citation: TBC — no loan entries supplied; v0 build-phase rehearsal with empty portfolio]",
    );
  }
  if (classificationGapSet.size > 0) {
    placeholders.push(
      `[citation: TBC — ${classificationGapSet.size} product category gap(s) in classification map: ${[...classificationGapSet].sort().join(", ")}; Mira's WS-INSTRUMENT-ANALYSES will resolve to SARB BA 320 published taxonomy]`,
    );
  }
  placeholders.push(
    "[citation: TBC — exact SARB BA 320 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  );
  placeholders.push(
    "[citation: TBC — ECL amounts are caller-supplied at v0; PD/LGD/EAD model outputs replace at licence-day per D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN]",
  );

  return {
    meta: {
      form: "BA 320",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: input.functionalCurrency,
      generatorVersion: "v0.1",
      portfolioFingerprint: fingerprintPortfolio(input.portfolio),
      classificationFingerprint: fingerprintClassification(input.classificationMap),
    },
    byCategory,
    byStage,
    totalLoansAndAdvances: {
      totalGrossCarryingAmount: totalGross,
      totalAllowanceForCreditLoss: totalAcl,
      totalNetCarryingAmount: totalNet,
      totalEcl,
      totalEntries,
    },
    nplRatio,
    coverageRatio,
    classificationGaps: [...classificationGapSet].sort(),
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "Banks Act 94 of 1990 §73",
      "Regulations Relating to Banks Reg 23",
      "IFRS 9 §5.5",
      "Procedures/by-policy/ecl-staging-cycle.md",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// Zod schema for the output (used by the render layer)
// ---------------------------------------------------------------------------

export const ba320CategorySectionSchema = z.object({
  productCategory: z.string().min(1),
  ba320RowLabel: z.string().min(1),
  ba320SubCode: z.string().min(1).optional(),
  totalGrossCarryingAmount: z.number().int().nonnegative(),
  totalAllowanceForCreditLoss: z.number().int().nonnegative(),
  totalNetCarryingAmount: z.number().int(),
  stage1Count: z.number().int().nonnegative(),
  stage2Count: z.number().int().nonnegative(),
  stage3Count: z.number().int().nonnegative(),
  primaryCurrency: z.string().length(3),
});

export const ba320StageSectionSchema = z.object({
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  stageLabel: z.string().min(1),
  eclBasis: z.enum(["12-month", "lifetime"]),
  totalGrossCarryingAmount: z.number().int().nonnegative(),
  totalEcl: z.number().int().nonnegative(),
  totalAllowanceForCreditLoss: z.number().int().nonnegative(),
  totalNetCarryingAmount: z.number().int(),
  entryCount: z.number().int().nonnegative(),
});

export const ba320TotalSchema = z.object({
  totalGrossCarryingAmount: z.number().int().nonnegative(),
  totalAllowanceForCreditLoss: z.number().int().nonnegative(),
  totalNetCarryingAmount: z.number().int(),
  totalEcl: z.number().int().nonnegative(),
  totalEntries: z.number().int().nonnegative(),
});
