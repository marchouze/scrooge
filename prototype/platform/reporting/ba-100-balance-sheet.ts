// platform/reporting/ba-100-balance-sheet.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — BA 100 (Balance Sheet) projection.
//
// Form-number authority: the SARB Excel form set — BA 100 = "Balance Sheet"
// (workbook tab A1). The prior "BA 600" label was a fabricated numbering
// artefact: BA 600 is actually the Consolidated Return. Re-numbered
// forward-only under D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO 2026-06-09);
// see Regulations/SARB-PA/ba-returns/_canonical-register.md. Internal symbol
// names aligned to `Ba100*` in the canonical symbol-rename pass (harden-only,
// behaviour-identical).
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

import Decimal from "decimal.js";
import { returnContractCitation } from "../../v2-core/regulatory-returns/return-contracts";
import {
  COA_BY_ID,
  COUNTERPARTY_SECTORS,
  type CounterpartySector,
  sectorForAccountId,
} from "../accounting/coa-registry";
import { divD, roundDecimal, toDecimal } from "../core/decimal-engine";
import { type Money, amountToMinorUnits, moneyFromMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import type { TrialBalanceSnapshotRow } from "../event-store/event-types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * BA 600 top-level section. Each leaf account that contributes to the form
 * is classified into exactly one section; non-classified accounts are
 * silently ignored and surfaced in the `classificationGaps` output field.
 */
export type Ba100Section = "assets" | "liabilities" | "equity";

/**
 * True iff a GL account is an OFF-BALANCE-SHEET memorandum account (FX trade-date
 * commitment quad, regulatory NOP, …), resolved from the COA registry category.
 * OBS memorandum accounts are EXCLUDED from BA-100 on-balance-sheet lines — they
 * are not assets, liabilities or equity (D-FX-TRADE-DATE-FVTPL-OBS). An account
 * id not in the registry is treated as on-balance-sheet (false) — the registry is
 * the source of truth and unknown ids surface as classification gaps elsewhere.
 */
export function isOffBalanceSheetAccountId(accountId: string): boolean {
  const cat = COA_BY_ID.get(accountId)?.category;
  if (cat === undefined) return false;
  return cat.startsWith("memorandum") || cat.startsWith("off-balance-sheet");
}

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
export interface Ba100LineClassification {
  readonly leafAccountId: string;
  readonly section: Ba100Section;
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
export type Ba100ClassificationMap = readonly Ba100LineClassification[];

/**
 * The complete generator input. The trial balance comes from Slice 2's
 * `TrialBalanceSnapshotted` payload (or directly from `closePeriod`'s
 * return value). The classification map comes from the caller. The
 * reporting currency to render in is the entity's functional currency
 * from `AccountingPeriodOpened.functionalCurrency`.
 */
export interface Ba100GeneratorInput {
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
  readonly classifications: Ba100ClassificationMap;
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
  /**
   * Per-account signed FUNCTIONAL-currency (ZAR) net in minor units, summed across
   * every currency the account holds (each leg translated leg-by-leg — never a
   * currency sentinel). When SUPPLIED, the generator uses these signed nets as the
   * account's balance INSTEAD of the per-currency `trialBalance` rows, and places
   * each account onto its BA 100 section by category AND SIGN (a debit-natural cash
   * account with a credit/negative net is short funding → a LIABILITY; a credit-
   * natural account with a debit balance is an asset). This is the headline fix for
   * the R790m bug: it (a) folds EUR/GBP/USD nostros in at their functional ZAR cost
   * basis rather than dropping them, and (b) never sign-flips a negative cash
   * account into a positive asset. Totals are SIGNED sums, so `assets ≡
   * liabilities + equity` holds when the books balance. Authority:
   * D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE; D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1.
   *
   * When OMITTED, the legacy per-currency / abs-magnitude path runs unchanged
   * (preserved for callers that pre-classify and present native magnitudes).
   */
  readonly functionalNetByAccount?: ReadonlyMap<string, number>;
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
export interface Ba100LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  /** Decimal-native money — exact major-unit form. Primary source; amountMinor kept for compat. */
  readonly amount: Money<Currency>;
  readonly currency: string;
  readonly contributingAccounts: readonly string[];
  readonly subCategory?: string;
  readonly note?: string;
}

export interface Ba600Section_Output {
  readonly section: Ba100Section;
  readonly totalMinor: number;
  readonly lineItems: readonly Ba100LineItem[];
}

/** Per-currency total roll-up across the trial balance. */
export interface Ba100PerCurrencyTotal {
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
export interface Ba100ClassificationGap {
  readonly leafAccountId: string;
  readonly currency: string;
  readonly amountMinor: number;
  /** Decimal-native money — exact major-unit form. Primary source; amountMinor kept for compat. */
  readonly amount: Money<Currency>;
}

/**
 * Per-sector amount split for a single BA 100 line. The five sector buckets
 * (`bank | corporate | sovereign | retail | other`) sum to the line's
 * `amountMinor`. Unmappable accounts land in `other` — surfaced, never hidden.
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH. Citation: SARB BA 100 (per-line
 * counterparty-sector decomposition); Banks Act 94 of 1990 §75; Reg 32.
 */
export interface Ba100SectorSplit {
  readonly bank: number;
  readonly corporate: number;
  readonly sovereign: number;
  readonly retail: number;
  readonly other: number;
}

/**
 * Counterparty-sector decomposition entry for one BA 100 line. The split is
 * derived at query time from the COA registry (account id → sector); accounts
 * with no clean sector mapping accrue to `other`.
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH. Citation: SARB BA 100.
 */
export interface Ba100LineSectorBreakdown {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly section: Ba100Section;
  /** Total magnitude of the line (== the matching `Ba100LineItem.amountMinor`). */
  readonly amountMinor: number;
  /** Per-sector split; sums to `amountMinor`. */
  readonly bySector: Ba100SectorSplit;
}

/**
 * Section-level + form-level counterparty-sector roll-up. `sectionTotals[s]`
 * sums the section's line-level splits; `formTotal` sums all sections. Each
 * level reconciles to the corresponding section / form magnitude.
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH. Citation: SARB BA 100.
 */
export interface Ba100SectorBreakdown {
  /** Per-line sector splits, in the same stable order as the section line items. */
  readonly lines: readonly Ba100LineSectorBreakdown[];
  /** Per-section sector roll-up (assets / liabilities / equity). */
  readonly sectionTotals: Readonly<Record<Ba100Section, Ba100SectorSplit>>;
  /** Form-level sector roll-up across all sections. */
  readonly formTotal: Ba100SectorSplit;
  /**
   * Reconciliation guard: `true` iff every section's per-sector split sums to
   * that section's `totalMinor`. Always `true` by construction; surfaced for
   * forensic transparency and asserted in tests.
   */
  readonly reconciled: boolean;
}

/**
 * Balance-sheet invariant check — recorded on every output for forensic
 * transparency. `balanced` is `true` iff `|difference| ≤ tolerance`.
 */
export interface Ba100BalanceCheck {
  readonly assetsMinor: number;
  readonly liabilitiesPlusEquityMinor: number;
  readonly differenceMinor: number;
  readonly toleranceMinor: number;
  readonly balanced: boolean;
}

/** The full BA 600 generator output. */
export interface Ba100BalanceSheet {
  readonly meta: {
    readonly form: "BA 100";
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
  /**
   * Counterparty-sector decomposition (bank / corporate / sovereign / retail /
   * other) per BA 100 line, with section + form roll-ups. Derived at query time
   * from the COA registry; reconciles to the section / line magnitudes.
   * Authority: D-BA-RETURNS-FOLLOWON-BATCH; SARB BA 100.
   */
  readonly sectorBreakdown: Ba100SectorBreakdown;
  readonly perCurrencyTotals: readonly Ba100PerCurrencyTotal[];
  readonly balanceCheck: Ba100BalanceCheck;
  readonly classificationGaps: readonly Ba100ClassificationGap[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba100GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba100GeneratorError";
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
export const BA_100_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_100_BANK_ENTITIES.includes(entity)) {
    throw new Ba100GeneratorError(
      `BA 600 (Balance Sheet) is bank-licence-bound; entity '${entity}' is not in BA_100_BANK_ENTITIES (${BA_100_BANK_ENTITIES.join(
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
 * Sign convention: see `Ba100LineClassification`. The generator takes
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
export function generateBa100BalanceSheet(input: Ba100GeneratorInput): Ba100BalanceSheet {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba100GeneratorError(
      `BA 600 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  const tolerance = input.tolerateImbalanceMinor ?? 0;
  if (tolerance < 0 || !Number.isFinite(tolerance)) {
    throw new Ba100GeneratorError(
      `BA 600 generator: tolerateImbalanceMinor must be a finite non-negative integer, got ${tolerance}`,
    );
  }

  const ccy = input.functionalCurrency as Currency;

  // FUNCTIONAL-NET path (the R790m fix). When the caller supplies per-account
  // signed functional-ZAR nets, place each account onto its BA 100 section by
  // category AND SIGN, sum SIGNED, and assert A ≡ L + E. The legacy abs-magnitude /
  // per-currency path runs only when this is omitted.
  if (input.functionalNetByAccount !== undefined) {
    return generateFromFunctionalNet(input, ccy, input.functionalNetByAccount, tolerance);
  }

  // Index classifications by leafAccountId — duplicate detection.
  const classMap = new Map<string, Ba100LineClassification>();
  for (const c of input.classifications) {
    if (classMap.has(c.leafAccountId)) {
      throw new Ba100GeneratorError(
        `BA 600 generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    // Fail-closed: an OFF-BALANCE-SHEET memorandum account can never be classified
    // onto an on-balance-sheet section (assets / liabilities / equity). A map that
    // tries to is a construction defect, not a legitimate state
    // (D-FX-TRADE-DATE-FVTPL-OBS; Engineering Charter cmd 2 — no silent acceptance).
    if (isOffBalanceSheetAccountId(c.leafAccountId)) {
      throw new Ba100GeneratorError(
        `BA 600 generator: off-balance-sheet memorandum account '${c.leafAccountId}' classified onto on-balance-sheet section '${c.section}'. OBS memorandum accounts are excluded from BA-100 on-balance-sheet lines.`,
      );
    }
    classMap.set(c.leafAccountId, c);
  }

  // Filter trial balance to the functional currency for line-item presentation.
  const tbInCurrency = input.trialBalance.filter((r) => r.currency === ccy);

  // Bucket trial-balance rows by section.
  const assetLines: Ba100LineItem[] = [];
  const liabilityLines: Ba100LineItem[] = [];
  const equityLines: Ba100LineItem[] = [];
  let assetsTotal = 0;
  let liabilitiesTotal = 0;
  let equityTotal = 0;

  const classificationGaps: Ba100ClassificationGap[] = [];

  // Stable iteration — sort by leafAccountId.
  const sorted = [...tbInCurrency].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );

  for (const row of sorted) {
    // OFF-BALANCE-SHEET memorandum accounts are excluded from BA-100 on-balance-
    // sheet lines entirely — not assets/liabilities/equity, and NOT a gap to chase
    // (D-FX-TRADE-DATE-FVTPL-OBS).
    if (isOffBalanceSheetAccountId(row.leafAccountId)) continue;
    const c = classMap.get(row.leafAccountId);
    if (!c) {
      classificationGaps.push({
        leafAccountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: row.amountMinor,
        // Convert at ingestion from trial-balance row (emitter migration is later).
        amount: moneyFromMinorUnits(BigInt(row.amountMinor), row.currency as Currency),
      });
      continue;
    }
    const stockMinor = Math.abs(row.amountMinor);
    const note = signWarningForSection(row.amountMinor, c.section);
    const lineItem: Ba100LineItem = {
      lineId: `${c.section}.${row.leafAccountId}`,
      lineLabel: c.lineLabel,
      amountMinor: stockMinor,
      // Convert at ingestion from trial-balance row (emitter migration is later).
      amount: moneyFromMinorUnits(BigInt(stockMinor), ccy),
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
    if (isOffBalanceSheetAccountId(row.leafAccountId)) continue; // OBS — excluded.
    if (!classMap.has(row.leafAccountId)) {
      classificationGaps.push({
        leafAccountId: row.leafAccountId,
        currency: row.currency,
        amountMinor: row.amountMinor,
        amount: moneyFromMinorUnits(BigInt(row.amountMinor), row.currency as Currency),
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
    throw new Ba100GeneratorError(
      `BA 600 generator: balance-sheet invariant violated — assets (${assetsTotal}) ≠ liabilities (${liabilitiesTotal}) + equity (${equityTotal}); difference ${differenceMinor} ${ccy} (cents) exceeds tolerance ${tolerance}. Set tolerateImbalanceMinor to surface as a placeholder instead.`,
    );
  }
  if (classificationGaps.length > 0) {
    // Runtime classification gap (tracked): specific trial-balance rows fell
    // through the line-classification map for THIS period's data. Not a
    // schema-numbering gap (the BA 600 line-numbering is now sourced below) — a
    // data-classification gap surfaced honestly per run. recon:gl-line-classification-coverage
    placeholders.push(
      `[GAP-BA600-ROW-CLASSIFICATION recon:ba-return-cell-contract — BA 600: ${classificationGaps.length} trial-balance row(s) have no line classification this period; surfaced for classification-map extension]`,
    );
  }
  // Line-numbering is no longer TBC: the exact SARB BA 600 cell coordinates are
  // the typed per-cell data-requirement contract. Citation derived from the
  // contract (Engineering-Charter cmd 4 — source, don't hardcode).
  placeholders.push(returnContractCitation("BA600"));

  const classificationsFingerprint = fingerprintClassifications(input.classifications);

  // Counterparty-sector decomposition (SARB BA 100 per-line requirement).
  // Derived at query time from the COA registry; reconciles to line totals.
  const sectorBreakdown = computeSectorBreakdown(
    { assets: assetLines, liabilities: liabilityLines, equity: equityLines },
    { assets: assetsTotal, liabilities: liabilitiesTotal, equity: equityTotal },
  );

  return {
    meta: {
      form: "BA 100",
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
    sectorBreakdown,
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
// FUNCTIONAL-NET generation path (the R790m fix).
//
// Place every balance-sheet account that holds a non-zero functional-ZAR net onto
// a BA 100 section by category AND SIGN. A SARB BA 100 balance sheet presents a
// credit balance on a debit-natural cash account (a nostro overdrawn = short FX
// funding) as a LIABILITY (amounts owed to banks), NOT as a negative asset — and
// never as a sign-flipped positive asset. Totals are SIGNED sums; with the books
// in balance, assets ≡ liabilities + equity holds exactly.
// ---------------------------------------------------------------------------

/** The account's DECLARED on-balance-sheet section from its CoA category. */
function declaredSectionForCategory(category: string): Ba100Section | undefined {
  if (category.startsWith("asset")) return "assets";
  if (category.startsWith("liability")) return "liabilities";
  if (category === "equity") return "equity";
  // Current-year P&L (income / expense) closes to retained earnings WITHIN equity —
  // the current-year accumulated result. Presented in the equity section.
  if (category.startsWith("income") || category.startsWith("expense")) return "equity";
  return undefined; // memorandum / unknown — not a balance-sheet section.
}

/**
 * Is this account DEBIT-natural (a positive signed net is its natural stock)?
 * Assets + expenses are debit-natural; liabilities + equity + income are credit-
 * natural. Sourced from the CoA category, not hand-keyed (Charter cmd 4).
 */
function isDebitNatural(category: string): boolean {
  return category.startsWith("asset") || category.startsWith("expense");
}

/**
 * Resolve the BA 100 section + presented (positive) magnitude for an account from
 * its signed functional-ZAR net. The presented magnitude is always the absolute
 * value; the section is the account's natural section when the balance is on its
 * natural side, and the OPPOSITE section when the balance is contrary (a credit
 * cash nostro → a funding liability; a debit liability → an asset receivable).
 */
function placeBySign(
  category: string,
  signedNetMinor: number,
): { section: Ba100Section; magnitudeMinor: number; contrary: boolean } | undefined {
  const declared = declaredSectionForCategory(category);
  if (declared === undefined) return undefined;
  const magnitudeMinor = Math.abs(signedNetMinor);

  // EQUITY-section accounts (pure equity + income/expense closing to retained
  // earnings) ALWAYS present within equity — a current-year LOSS is a debit P&L
  // result inside equity, NEVER an asset. The asset↔liability sign-flip applies
  // ONLY to asset / liability accounts (a credit nostro = funding owed → liability;
  // a debit payable = receivable → asset). So we flip only when declared is a BS
  // asset/liability section.
  if (declared === "equity") {
    return { section: "equity", magnitudeMinor, contrary: false };
  }

  const debitNatural = isDebitNatural(category);
  // On natural side? debit-natural (asset) → positive net; credit-natural
  // (liability) → negative net.
  const onNaturalSide = debitNatural ? signedNetMinor >= 0 : signedNetMinor <= 0;
  if (onNaturalSide) return { section: declared, magnitudeMinor, contrary: false };
  // Contrary balance: an ASSET with a credit net presents as a LIABILITY (funding
  // owed to banks); a LIABILITY with a debit net presents as an ASSET (receivable).
  const opposite: Ba100Section = declared === "assets" ? "liabilities" : "assets";
  return { section: opposite, magnitudeMinor, contrary: true };
}

function generateFromFunctionalNet(
  input: Ba100GeneratorInput,
  ccy: Currency,
  netByAccount: ReadonlyMap<string, number>,
  tolerance: number,
): Ba100BalanceSheet {
  const assetLines: Ba100LineItem[] = [];
  const liabilityLines: Ba100LineItem[] = [];
  const equityLines: Ba100LineItem[] = [];
  let assetsTotal = 0;
  let liabilitiesTotal = 0;
  let equityTotal = 0;
  const classificationGaps: Ba100ClassificationGap[] = [];

  // Stable iteration over the accounts that carry a net, sorted by account id.
  const accountIds = [...netByAccount.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const accountId of accountIds) {
    const signed = netByAccount.get(accountId) ?? 0;
    if (signed === 0) continue; // zero-net accounts contribute nothing.
    // OFF-balance-sheet memorandum accounts are excluded from BA 100 entirely.
    if (isOffBalanceSheetAccountId(accountId)) continue;
    const coa = COA_BY_ID.get(accountId);
    if (coa === undefined) {
      // An account with a balance but NO CoA entry: never drop it silently. Surface
      // it as a classification gap carrying its signed net (Charter cmd 2 / cmd 5).
      classificationGaps.push({
        leafAccountId: accountId,
        currency: ccy,
        amountMinor: signed,
        amount: moneyFromMinorUnits(BigInt(signed), ccy),
      });
      continue;
    }
    const placement = placeBySign(coa.category, signed);
    if (placement === undefined) {
      // A balance-sheet-resolvable account whose category does not map to a section
      // (should not happen for BS categories) — surfaced as a gap, never dropped.
      classificationGaps.push({
        leafAccountId: accountId,
        currency: ccy,
        amountMinor: signed,
        amount: moneyFromMinorUnits(BigInt(signed), ccy),
      });
      continue;
    }
    const lineItem: Ba100LineItem = {
      lineId: `${placement.section}.${accountId}`,
      lineLabel: `${placement.section}.${coa.name}`,
      amountMinor: placement.magnitudeMinor,
      amount: moneyFromMinorUnits(BigInt(placement.magnitudeMinor), ccy),
      currency: ccy,
      contributingAccounts: [accountId],
      ...(placement.contrary
        ? {
            note: `presented in ${placement.section} by sign — ${coa.category} account carries a contrary (${
              isDebitNatural(coa.category) ? "credit" : "debit"
            }) functional-ZAR balance (e.g. a short-funding nostro shown as amounts owed to banks)`,
          }
        : {}),
    };
    if (placement.section === "assets") {
      assetLines.push(lineItem);
      assetsTotal += placement.magnitudeMinor;
    } else if (placement.section === "liabilities") {
      liabilityLines.push(lineItem);
      liabilitiesTotal += placement.magnitudeMinor;
    } else {
      equityLines.push(lineItem);
      // Equity is accumulated in CREDIT-POSITIVE convention so that A ≡ L + E with
      // A and L as positive natural-side magnitudes: paid-up capital (a credit)
      // ADDS to equity; a trading LOSS (a debit P&L closing to retained earnings)
      // SUBTRACTS. `signed` is the account's debit-positive net; equity in credit-
      // positive terms is therefore the NEGATION of the debit-positive net.
      // (capital ACC-5000-001 signed −300m → +300m equity; trading-P&L loss signed
      // +279.3m → −279.3m equity; net equity +20.69m = total assets.)
      equityTotal += -signed;
    }
  }

  const liabilitiesPlusEquity = liabilitiesTotal + equityTotal;
  const differenceMinor = assetsTotal - liabilitiesPlusEquity;
  const balanced = Math.abs(differenceMinor) <= tolerance;

  const placeholders: string[] = [];
  if (!balanced && tolerance > 0) {
    placeholders.push(
      `[citation: TBC — BA 100: balance-sheet invariant violated by ${differenceMinor} ${ccy} (minor); tolerance ${tolerance}; functional-net path]`,
    );
  }
  if (!balanced && tolerance === 0) {
    throw new Ba100GeneratorError(
      `BA 100 generator (functional-net): balance-sheet invariant violated — assets (${assetsTotal}) ≠ liabilities (${liabilitiesTotal}) + equity (${equityTotal}); difference ${differenceMinor} ${ccy} (minor). Set tolerateImbalanceMinor to surface as a placeholder instead.`,
    );
  }
  if (classificationGaps.length > 0) {
    placeholders.push(
      `[GAP-BA100-FUNCTIONAL-NET-UNMAPPED recon:ba100-cell-values-reconcile — ${classificationGaps.length} account(s) with a functional-ZAR net could not be placed onto a section; surfaced, never dropped]`,
    );
  }
  placeholders.push(returnContractCitation("BA600"));

  const classificationsFingerprint = fingerprintClassifications(input.classifications);
  const sectorBreakdown = computeSectorBreakdown(
    { assets: assetLines, liabilities: liabilityLines, equity: equityLines },
    { assets: assetsTotal, liabilities: liabilitiesTotal, equity: equityTotal },
  );

  // Per-currency totals: in the functional-net path every figure is already in the
  // functional currency, so a single functional-currency bucket carries the totals.
  const perCurrencyTotals: Ba100PerCurrencyTotal[] = [
    {
      currency: ccy,
      assetsMinor: assetsTotal,
      liabilitiesMinor: liabilitiesTotal,
      equityMinor: equityTotal,
    },
  ];

  return {
    meta: {
      form: "BA 100",
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
    assets: { section: "assets", totalMinor: assetsTotal, lineItems: assetLines },
    liabilities: {
      section: "liabilities",
      totalMinor: liabilitiesTotal,
      lineItems: liabilityLines,
    },
    equity: { section: "equity", totalMinor: equityTotal, lineItems: equityLines },
    sectorBreakdown,
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
      "D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE",
      "D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1",
      "Banks Act 94 of 1990 §75",
      "Regulations Relating to Banks Reg 32",
      "IAS 1 — Presentation of Financial Statements",
      "IAS 21 — The Effects of Changes in Foreign Exchange Rates",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signWarningForSection(amountMinor: number, section: Ba100Section): string | undefined {
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

/** Zero-initialised sector split. */
function emptySectorSplit(): Ba100SectorSplit {
  return { bank: 0, corporate: 0, sovereign: 0, retail: 0, other: 0 };
}

/** Sum two sector splits component-wise (returns a fresh object). */
function addSectorSplit(a: Ba100SectorSplit, b: Ba100SectorSplit): Ba100SectorSplit {
  return {
    bank: a.bank + b.bank,
    corporate: a.corporate + b.corporate,
    sovereign: a.sovereign + b.sovereign,
    retail: a.retail + b.retail,
    other: a.other + b.other,
  };
}

/** Total magnitude across a sector split (used for the reconciliation guard). */
function sumSectorSplit(s: Ba100SectorSplit): number {
  return COUNTERPARTY_SECTORS.reduce((acc, k) => acc + s[k], 0);
}

/**
 * Split one BA 100 line's magnitude across counterparty sectors.
 *
 * The line magnitude (`Math.abs(amountMinor)`) is distributed over its
 * contributing accounts by each account's COA-derived sector. In the current
 * build the BA 100 generator emits exactly one contributing account per line, so
 * the whole line lands in that account's sector; the multi-account path is
 * handled for forward-compatibility (it distributes the magnitude evenly across
 * contributing accounts when more than one is present). Accounts with no clean
 * COA sector mapping fall to `other`.
 */
function splitLineBySector(line: Ba100LineItem): Ba100SectorSplit {
  const split: Record<CounterpartySector, number> = {
    bank: 0,
    corporate: 0,
    sovereign: 0,
    retail: 0,
    other: 0,
  };
  const accounts = line.contributingAccounts;
  if (accounts.length === 0) {
    // No contributing account → attribute the whole line to `other` (surfaced).
    split.other += Number(amountToMinorUnits(line.amount));
    return split;
  }
  // Single contributing account (the common case): whole magnitude → its sector.
  if (accounts.length === 1) {
    const account = accounts[0];
    if (account === undefined) {
      split.other += Number(amountToMinorUnits(line.amount));
      return split;
    }
    split[sectorForAccountId(account)] += Number(amountToMinorUnits(line.amount));
    return split;
  }
  // Multi-account line: distribute the magnitude integer-evenly across the
  // contributing accounts, routing the rounding residual to the first account so
  // the per-sector split still reconciles exactly to the line magnitude.
  //
  // Rounding mode DOWN (toward zero) = equivalent to Math.trunc for positive values.
  // Explicit DOWN so the reader can trace the truncation decision.
  // Authority: D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3; brief §"Rounding policy".
  const perD = roundDecimal(
    divD(toDecimal(String(amountToMinorUnits(line.amount))), new Decimal(accounts.length)),
    0, // integer minor-unit result (no decimal places)
    "DOWN", // floor-division toward zero — matches prior Math.trunc for positive amounts
    // Authority: D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3; brief §"Rounding policy"
  );
  const per = Number(BigInt(perD.toFixed(0)));
  let allocated = 0;
  accounts.forEach((account, idx) => {
    const share =
      idx === 0 ? Number(amountToMinorUnits(line.amount)) - per * (accounts.length - 1) : per;
    allocated += share;
    split[sectorForAccountId(account)] += share;
  });
  // Defensive: any residual (should be 0) routes to `other`.
  const residual = Number(amountToMinorUnits(line.amount)) - allocated;
  if (residual !== 0) split.other += residual;
  return split;
}

/**
 * Compute the full counterparty-sector decomposition from the section line
 * items. Per-line splits roll up into per-section totals and a form total; a
 * reconciliation guard asserts every section's split sums to its section total.
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH; SARB BA 100.
 */
function computeSectorBreakdown(
  sections: {
    assets: readonly Ba100LineItem[];
    liabilities: readonly Ba100LineItem[];
    equity: readonly Ba100LineItem[];
  },
  sectionTotalsMinor: Readonly<Record<Ba100Section, number>>,
): Ba100SectorBreakdown {
  const lines: Ba100LineSectorBreakdown[] = [];
  const sectionSplits: Record<Ba100Section, Ba100SectorSplit> = {
    assets: emptySectorSplit(),
    liabilities: emptySectorSplit(),
    equity: emptySectorSplit(),
  };

  const sectionEntries: ReadonlyArray<[Ba100Section, readonly Ba100LineItem[]]> = [
    ["assets", sections.assets],
    ["liabilities", sections.liabilities],
    ["equity", sections.equity],
  ];

  for (const [section, items] of sectionEntries) {
    for (const item of items) {
      const bySector = splitLineBySector(item);
      lines.push({
        lineId: item.lineId,
        lineLabel: item.lineLabel,
        section,
        // Use amountToMinorUnits for accumulation reads — exact bigint.
        amountMinor: Number(amountToMinorUnits(item.amount)),
        bySector,
      });
      sectionSplits[section] = addSectorSplit(sectionSplits[section], bySector);
    }
  }

  const formTotal = addSectorSplit(
    addSectorSplit(sectionSplits.assets, sectionSplits.liabilities),
    sectionSplits.equity,
  );

  // Reconciliation: each section's per-sector split must sum to its section total.
  const reconciled =
    sumSectorSplit(sectionSplits.assets) === sectionTotalsMinor.assets &&
    sumSectorSplit(sectionSplits.liabilities) === sectionTotalsMinor.liabilities &&
    sumSectorSplit(sectionSplits.equity) === sectionTotalsMinor.equity;

  return {
    lines,
    sectionTotals: sectionSplits,
    formTotal,
    reconciled,
  };
}

function computePerCurrencyTotals(
  trialBalance: readonly TrialBalanceSnapshotRow[],
  classMap: Map<string, Ba100LineClassification>,
): readonly Ba100PerCurrencyTotal[] {
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
    // trial-balance row.amountMinor is the source here; convert via Money for decimal-native path.
    const rowMoney = moneyFromMinorUnits(BigInt(row.amountMinor), row.currency as Currency);
    const stock = Number(
      amountToMinorUnits(rowMoney) < 0n
        ? -amountToMinorUnits(rowMoney)
        : amountToMinorUnits(rowMoney),
    );
    if (c.section === "assets") bucket.assetsMinor += stock;
    else if (c.section === "liabilities") bucket.liabilitiesMinor += stock;
    else bucket.equityMinor += stock;
    buckets.set(row.currency, bucket);
  }
  const out: Ba100PerCurrencyTotal[] = [];
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
function fingerprintClassifications(classifications: Ba100ClassificationMap): string {
  const sorted = [...classifications].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}
