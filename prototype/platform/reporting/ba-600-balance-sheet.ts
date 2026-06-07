// platform/reporting/ba-600-balance-sheet.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — BA 600 (Balance Sheet) projection.
// Eighth SARB BA-form return rendered end-to-end (after BA 110 / BA 310 /
// BA 300 / BA 100; the BA-quintet batch adds BA 600 + off-balance-sheet + BA 610 +
// BA 610 detail + BA 310).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), extended 2026-05-17 to add the BA-returns
// quintet (Marc's directive — `WS-FINANCE-BA-RETURNS-QUINTET`).
//
// This module is a *pure projection* over the period-close `TrialBalance`
// (Slice 2) plus an explicit BA 600 line-classification map. No event
// side-effects; no document-store writes; no event-store reads. Callers
// (the CLI wrapper at `prototype/scripts/render-ba-600.ts`, downstream
// `ReportGenerated` event emitters) compose the inputs and consume the
// output.
//
// Pipeline (mirrors Slice 4's BA 100 architecture):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PROJECTION RUNTIME    — folds events into balances
//      → PERIOD CLOSE          — Slice 2 — snapshots the trial balance
//      → SEMANTIC LAYER        — IFRS Slice 6 + BA 600 line mapping (caller-side)
//      → BA 600 PROJECTION     — this module — pure function
//      → RENDER + STORE        — `ba-600-render.ts` + RMS doc store
//
// Computation per Banks Act 94 of 1990 §75 + Regulations Relating to
// Banks Reg 32 (monthly returns) + SARB BA 600 published schema:
//
//   assetsTotal       = Σ |amountMinor| over rows classified as `assets/*`
//   liabilitiesTotal  = Σ |amountMinor| over rows classified as `liabilities/*`
//   equityTotal       = Σ |amountMinor| over rows classified as `equity/*`
//
//   Invariant: assetsTotal ≡ liabilitiesTotal + equityTotal (per reporting currency)
//
// The invariant is enforced with a configurable absolute tolerance
// (default: 0 — strict). The generator throws on violation; callers that
// need a soft-fail rehearsal mode can set `tolerateImbalanceMinor`.
//
// Per-entity. Bank-licence-bound; only Hoz Bank `LE-ZA-HOZ-BANK` is in
// scope at v0 (mirrors BA 100's solo-entity caveat). Hoz Securities
// (FAIS-scoped) and Hoz Group (consolidated look-through under Banks Act
// §60) land at later slices once the group-consolidation projection lands
// per `D-REGULATORY-PERIMETER`. The generator throws if asked to produce
// a BA 600 for a non-bank entity.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **BA 600 line-classification map** is supplied externally for now.
//     Chart-of-accounts schema does NOT yet have a `ba100Line` field; the
//     map lives at the call site. Mira's `WS-INSTRUMENT-ANALYSES` should
//     extend to publish SARB BA 600 line mapping; until then the map is
//     authored at the call site.
//   - **Group-consolidated BA 600** (LE-ZA-HOZ-GROUP look-through per
//     Banks Act §60) deferred under `D-REGULATORY-PERIMETER`. Solo entity
//     only at v0.
//   - **SARB BA 600 XML adapter** deferred to a downstream slice; this
//     module emits the canonical JSON contract only (mirrors the BA 110 /
//     BA 100 sequencing — XML adapters landed in a later slice).
//   - **Per-currency disaggregation** is surfaced in the output but the
//     SARB BA 600 form is presented in `functionalCurrency` only at v0;
//     multi-currency rendering tracks the IFRS Slice 6 posture.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration; JSON-schema co-design).

import type { TrialBalanceSnapshotRow } from "../event-store/event-types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * BA 600 top-level section. Each leaf account that contributes to the form
 * is classified into exactly one section; non-classified accounts are
 * silently ignored and surfaced in the `classificationGaps` output field.
 */
export type Ba600Section = "assets" | "liabilities" | "equity";

/**
 * Per-leaf-account BA 600 line classification. An account belongs to one
 * section + one form line (free-form label awaiting Mira's WS-INSTRUMENT-
 * ANALYSES SARB BA 600 published taxonomy ingestion).
 *
 * Sign convention follows the trial-balance convention from Slice 2:
 *   asset      : positive amountMinor = debit balance (typical)
 *   liability  : negative amountMinor = credit balance (typical)
 *   equity     : negative amountMinor = credit balance (typical)
 *
 * The generator takes absolute value (`Math.abs(amountMinor)`) for line-
 * magnitude presentation and flags rows whose sign violates the section
 * convention with a warning note.
 */
export interface Ba600LineClassification {
  readonly leafAccountId: string;
  readonly section: Ba600Section;
  /**
   * Free-form sub-line label for the BA 600 form (e.g.
   * `assets.cash-and-balances-at-sarb`, `liabilities.deposits-from-banks`,
   * `equity.share-capital`). Mira's `WS-INSTRUMENT-ANALYSES` will resolve
   * the vocabulary to SARB-published labels at a downstream slice.
   */
  readonly lineLabel: string;
  /** Optional sub-category for further grouping within the line. */
  readonly subCategory?: string;
}

/** Caller-supplied classification map for the BA 600 generator. */
export type Ba600ClassificationMap = readonly Ba600LineClassification[];

/**
 * The complete generator input. The trial balance comes from Slice 2's
 * `TrialBalanceSnapshotted` payload (or directly from `closePeriod`'s
 * return value). The classification map comes from the caller. The
 * reporting currency to render in is the entity's functional currency
 * from `AccountingPeriodOpened.functionalCurrency`.
 */
export interface Ba600GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). The generator throws on non-bank entities. */
  readonly entity: string;
  /** ISO 8601 — the period-end as-of date the BA 600 is reported at. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency from `AccountingPeriodOpened.functionalCurrency`. */
  readonly functionalCurrency: string;
  /** Trial-balance rows from `TrialBalanceSnapshotted.rows` / `closePeriod` result. */
  readonly trialBalance: readonly TrialBalanceSnapshotRow[];
  /** Per-account BA 600 line classifications. Accounts without an entry surface in `classificationGaps`. */
  readonly classifications: Ba600ClassificationMap;
  /**
   * Optional: cite the source `TrialBalanceSnapshotted.event_id` so the
   * downstream `ReportGenerated` event can chain back to the trial-balance
   * snapshot under Principle 1.
   */
  readonly trialBalanceSnapshotEventId?: string;
  /**
   * Absolute tolerance (minor units) for the balance-sheet invariant
   * (`assets ≡ liabilities + equity`). Default `0` (strict). Callers can
   * relax to surface imbalances without aborting (a placeholder entry is
   * emitted in that case).
   */
  readonly tolerateImbalanceMinor?: number;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * One line item on the BA 600 form. Lines compose into sections; sections
 * compose into the full return. Per the rehearsal-grade posture,
 * `[citation: TBC]` markers on `lineId` indicate the SARB line numbering
 * is awaiting Mira's `WS-INSTRUMENT-ANALYSES` publication.
 */
export interface Ba600LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly contributingAccounts: readonly string[];
  readonly subCategory?: string;
  readonly note?: string;
}

export interface Ba600Section_Output {
  readonly section: Ba600Section;
  readonly totalMinor: number;
  readonly lineItems: readonly Ba600LineItem[];
}

/** Per-currency total roll-up across the trial balance. */
export interface Ba600PerCurrencyTotal {
  readonly currency: string;
  readonly assetsMinor: number;
  readonly liabilitiesMinor: number;
  readonly equityMinor: number;
}

/**
 * Classification-gap entry: a trial-balance row that has no matching
 * classification. Surfaced so the caller can iteratively resolve the map
 * without the generator throwing on every unmapped account.
 */
export interface Ba600ClassificationGap {
  readonly leafAccountId: string;
  readonly currency: string;
  readonly amountMinor: number;
}

/**
 * Balance-sheet invariant check — recorded on every output for forensic
 * transparency. `balanced` is `true` iff `|difference| ≤ tolerance`.
 */
export interface Ba600BalanceCheck {
  readonly assetsMinor: number;
  readonly liabilitiesPlusEquityMinor: number;
  readonly differenceMinor: number;
  readonly toleranceMinor: number;
  readonly balanced: boolean;
}

/** The full BA 600 generator output. */
export interface Ba600BalanceSheet {
  readonly meta: {
    readonly form: "BA 600";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly trialBalanceSnapshotEventId?: string;
    readonly classificationsFingerprint: string;
  };
  readonly assets: Ba600Section_Output;
  readonly liabilities: Ba600Section_Output;
  readonly equity: Ba600Section_Output;
  readonly perCurrencyTotals: readonly Ba600PerCurrencyTotal[];
  readonly balanceCheck: Ba600BalanceCheck;
  readonly classificationGaps: readonly Ba600ClassificationGap[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba600GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba600GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids that are in scope for BA 600. The
 * Hoz tree has exactly one bank-licensed entity at v0 per
 * `Regulations/_legal-entity-tree.md`. Securities-firm + group-consolidated
 * BA 600 are out of scope at this slice — see `D-REGULATORY-PERIMETER`
 * (CEO-approved 2026-05-10).
 */
export const BA_600_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_600_BANK_ENTITIES.includes(entity)) {
    throw new Ba600GeneratorError(
      `BA 600 (Balance Sheet) is bank-licence-bound; entity '${entity}' is not in BA_600_BANK_ENTITIES (${BA_600_BANK_ENTITIES.join(
        ", ",
      )}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER. Group-consolidated BA 600 lands at a downstream slice.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 600 (Balance Sheet) projection from a trial balance + a
 * caller-supplied line-classification map. Pure function; deterministic.
 *
 * The classification map identifies accounts as assets / liabilities /
 * equity. Trial-balance accounts not in the map are surfaced in the
 * `classificationGaps` output field (non-fatal). Accounts in the map but
 * absent from the trial balance are silently ignored (a classification
 * map can be a superset of the chart-of-accounts).
 *
 * Sign convention: see `Ba600LineClassification`. The generator takes
 * absolute value for line-magnitude presentation and flags sign-violating
 * rows with a `note` on the line item.
 *
 * Multi-currency note: line items are per-functional-currency at v0; a
 * per-currency totals roll-up across the entire trial balance is included
 * for forensic transparency. SARB BA 600 form is functional-currency-only
 * at v0; multi-currency rendering tracks the IFRS Slice 6 posture.
 *
 * Balance invariant: `sum(assets) ≡ sum(liabilities) + sum(equity)`
 * (per reporting currency). Strict by default; `tolerateImbalanceMinor`
 * allows a soft-fail rehearsal mode.
 */
export function generateBa600BalanceSheet(input: Ba600GeneratorInput): Ba600BalanceSheet {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba600GeneratorError(
      `BA 600 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  const tolerance = input.tolerateImbalanceMinor ?? 0;
  if (tolerance < 0 || !Number.isFinite(tolerance)) {
    throw new Ba600GeneratorError(
      `BA 600 generator: tolerateImbalanceMinor must be a finite non-negative integer, got ${tolerance}`,
    );
  }

  const ccy = input.functionalCurrency;

  // Index classifications by leafAccountId — duplicate detection.
  const classMap = new Map<string, Ba600LineClassification>();
  for (const c of input.classifications) {
    if (classMap.has(c.leafAccountId)) {
      throw new Ba600GeneratorError(
        `BA 600 generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    classMap.set(c.leafAccountId, c);
  }

  // Filter trial balance to the functional currency for line-item presentation.
  const tbInCurrency = input.trialBalance.filter((r) => r.currency === ccy);

  // Bucket trial-balance rows by section.
  const assetLines: Ba600LineItem[] = [];
  const liabilityLines: Ba600LineItem[] = [];
  const equityLines: Ba600LineItem[] = [];
  let assetsTotal = 0;
  let liabilitiesTotal = 0;
  let equityTotal = 0;

  const classificationGaps: Ba600ClassificationGap[] = [];

  // Stable iteration — sort by leafAccountId.
  const sorted = [...tbInCurrency].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );

  for (const row of sorted) {
    const c = classMap.get(row.leafAccountId);
    if (!c) {
      classificationGaps.push({
        leafAccountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: row.amountMinor,
      });
      continue;
    }
    const stockMinor = Math.abs(row.amountMinor);
    const note = signWarningForSection(row.amountMinor, c.section);
    const lineItem: Ba600LineItem = {
      lineId: `${c.section}.${row.leafAccountId}`,
      lineLabel: c.lineLabel,
      amountMinor: stockMinor,
      currency: ccy,
      contributingAccounts: [row.leafAccountId],
      ...(c.subCategory ? { subCategory: c.subCategory } : {}),
      ...(note ? { note } : {}),
    };
    if (c.section === "assets") {
      assetLines.push(lineItem);
      assetsTotal += stockMinor;
    } else if (c.section === "liabilities") {
      liabilityLines.push(lineItem);
      liabilitiesTotal += stockMinor;
    } else {
      equityLines.push(lineItem);
      equityTotal += stockMinor;
    }
  }

  // Also pick up rows in non-functional currencies that have no
  // classification — these are gaps even if not in `tbInCurrency`.
  for (const row of input.trialBalance) {
    if (row.currency === ccy) continue;
    if (!classMap.has(row.leafAccountId)) {
      classificationGaps.push({
        leafAccountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: row.amountMinor,
      });
    }
  }

  // Per-currency totals (across all currencies in the trial balance).
  const perCurrencyTotals = computePerCurrencyTotals(input.trialBalance, classMap);

  const liabilitiesPlusEquity = liabilitiesTotal + equityTotal;
  const differenceMinor = assetsTotal - liabilitiesPlusEquity;
  const balanced = Math.abs(differenceMinor) <= tolerance;

  const placeholders: string[] = [];
  if (!balanced && tolerance > 0) {
    placeholders.push(
      `[citation: TBC — BA 600: balance-sheet invariant violated by ${differenceMinor} ${ccy} (cents); tolerance ${tolerance}; surfaced under tolerateImbalanceMinor rehearsal posture]`,
    );
  }
  if (!balanced && tolerance === 0) {
    throw new Ba600GeneratorError(
      `BA 600 generator: balance-sheet invariant violated — assets (${assetsTotal}) ≠ liabilities (${liabilitiesTotal}) + equity (${equityTotal}); difference ${differenceMinor} ${ccy} (cents) exceeds tolerance ${tolerance}. Set tolerateImbalanceMinor to surface as a placeholder instead.`,
    );
  }
  if (classificationGaps.length > 0) {
    placeholders.push(
      `[citation: TBC — BA 600: ${classificationGaps.length} trial-balance rows have no line classification; pending Mira's WS-INSTRUMENT-ANALYSES SARB BA 600 published-schema mapping]`,
    );
  }
  placeholders.push(
    "[citation: TBC — exact SARB BA 600 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  );

  const classificationsFingerprint = fingerprintClassifications(input.classifications);

  return {
    meta: {
      form: "BA 600",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
      classificationsFingerprint,
    },
    assets: {
      section: "assets",
      totalMinor: assetsTotal,
      lineItems: assetLines,
    },
    liabilities: {
      section: "liabilities",
      totalMinor: liabilitiesTotal,
      lineItems: liabilityLines,
    },
    equity: {
      section: "equity",
      totalMinor: equityTotal,
      lineItems: equityLines,
    },
    perCurrencyTotals,
    balanceCheck: {
      assetsMinor: assetsTotal,
      liabilitiesPlusEquityMinor: liabilitiesPlusEquity,
      differenceMinor,
      toleranceMinor: tolerance,
      balanced,
    },
    classificationGaps,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "WS-FINANCE-BA-RETURNS-QUINTET",
      "Banks Act 94 of 1990 §75",
      "Regulations Relating to Banks Reg 32",
      "IAS 1 — Presentation of Financial Statements",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signWarningForSection(amountMinor: number, section: Ba600Section): string | undefined {
  if (amountMinor === 0) return undefined;
  // Asset = debit-typical (positive); liability/equity = credit-typical (negative).
  if (section === "assets" && amountMinor < 0) {
    return "warning: asset account has a credit balance — sign convention violated";
  }
  if ((section === "liabilities" || section === "equity") && amountMinor > 0) {
    return `warning: ${section} account has a debit balance — sign convention violated`;
  }
  return undefined;
}

function computePerCurrencyTotals(
  trialBalance: readonly TrialBalanceSnapshotRow[],
  classMap: Map<string, Ba600LineClassification>,
): readonly Ba600PerCurrencyTotal[] {
  const buckets = new Map<
    string,
    { assetsMinor: number; liabilitiesMinor: number; equityMinor: number }
  >();
  for (const row of trialBalance) {
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;
    const bucket = buckets.get(row.currency) ?? {
      assetsMinor: 0,
      liabilitiesMinor: 0,
      equityMinor: 0,
    };
    const stock = Math.abs(row.amountMinor);
    if (c.section === "assets") bucket.assetsMinor += stock;
    else if (c.section === "liabilities") bucket.liabilitiesMinor += stock;
    else bucket.equityMinor += stock;
    buckets.set(row.currency, bucket);
  }
  const out: Ba600PerCurrencyTotal[] = [];
  for (const [currency, b] of buckets) {
    out.push({ currency, ...b });
  }
  out.sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));
  return out;
}

/**
 * Deterministic fingerprint of a classification map for forensic
 * reproducibility. Sorted-stable JSON. Mirrors BA 100 Slice 4.
 */
function fingerprintClassifications(classifications: Ba600ClassificationMap): string {
  const sorted = [...classifications].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}
