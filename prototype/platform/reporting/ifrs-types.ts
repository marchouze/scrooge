// platform/reporting/ifrs-types.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — shared types for the
// IFRS-statement renderer (Balance Sheet / Income Statement / Cash Flow /
// Changes in Equity / Notes skeleton).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 6.
//
// All five statement generators share the same input contract: a per-entity
// trial balance (from Slice 2 period-close), an explicit IFRS-line
// classification map (per-account → SoFP / P&L line + sub-line), and the
// `asOf` / `periodId` / `functionalCurrency` envelope that the period-close
// orchestration carries.
//
// Per Marc's Q1 (rehearsal-grade with placeholders), `[citation: TBC]`
// markers acceptable for IAS line specifics where the published taxonomy
// has not yet been ingested. Camille's accounting-policy adoption choices
// (per `Owner Inbox/2026-05-06_core-policies-finance.md` §§1–3) are cited
// rather than authored here.
//
// Per pack §6 Slice 6: per-entity (Hoz Bank only at v0); consolidated
// (Hoz Group via IFRS 10 elimination) is downstream.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner)
//   + Atlas (Core banking platform architect, engineering — substrate
//   consult; generator-input contract).

import type { TrialBalanceSnapshotRow } from "../event-store/event-types";

// ---------------------------------------------------------------------------
// Account-class taxonomy (the IFRS axis the renderer reads)
// ---------------------------------------------------------------------------

/**
 * High-level account class. Drives whether a leaf account contributes to
 * the asset / liability / equity / income / expense section of the IFRS
 * statements.
 */
export type IfrsAccountClass = "asset" | "liability" | "equity" | "income" | "expense" | "oci";

/**
 * Cash-flow-statement classification per IAS 7 §10–§17. Operating /
 * investing / financing are the three primary buckets; `non-cash` is for
 * accounts whose movement does not affect cash (e.g. depreciation, fair-
 * value remeasurements that route through OCI not cash).
 */
export type IfrsCashFlowClass = "operating" | "investing" | "financing" | "non-cash";

/**
 * Per-leaf-account IFRS classification. Each leaf account gets exactly one
 * `accountClass` (drives SoFP / P&L grouping) and an optional `lineLabel`
 * (the human-readable IFRS-line label the account contributes to). The
 * classification map is supplied at the call site for v0; chart-of-accounts
 * gains an `ifrsAccountClass` field at Slice 7-8 once Mira's
 * WS-INSTRUMENT-ANALYSES finalises the published taxonomy.
 *
 * Sign convention follows the trial-balance convention from Slice 2:
 *   asset / expense    : positive amountMinor = debit balance (typical)
 *   liability / equity / income / oci : negative amountMinor = credit balance (typical)
 *
 * Generators take absolute value when presenting line magnitudes; warning
 * notes flag rows whose sign violates the convention for the class.
 */
export interface IfrsAccountClassification {
  readonly leafAccountId: string;
  readonly accountClass: IfrsAccountClass;
  /**
   * Sub-line label within the account class (e.g. `cash-and-balances-at-sarb`,
   * `loans-and-advances`, `trading-liabilities`, `share-capital`,
   * `retained-earnings`).
   */
  readonly lineLabel?: string;
  /**
   * Cash-flow-statement classification. Required when accountClass is one
   * of `asset`, `liability`, `equity`; optional for income/expense (which
   * always thread through operating cash flow via the indirect-method P&L
   * adjustment).
   */
  readonly cashFlowClass?: IfrsCashFlowClass;
  /**
   * Equity-component label for the SoCE — `share-capital`, `retained-
   * earnings`, `oci-reserve`, `other-reserves`. Required when
   * accountClass is `equity`.
   */
  readonly equityComponent?: "share-capital" | "retained-earnings" | "oci-reserve" | "other-reserves";
}

// ---------------------------------------------------------------------------
// Common generator input
// ---------------------------------------------------------------------------

/**
 * The common envelope every IFRS generator consumes. Mirrors the BA 700
 * generator's input shape so the same period-close artefact can drive
 * both prudential and IFRS renders.
 */
export interface IfrsGeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). The generator throws on non-bank entities at v0. */
  readonly entity: string;
  /** ISO 8601 — the period-end as-of date. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Trial-balance rows from `TrialBalanceSnapshotted.rows` / `closePeriod` result. */
  readonly trialBalance: readonly TrialBalanceSnapshotRow[];
  /** Per-account IFRS classifications. Accounts without an entry are not classified and contribute to a `unclassified` line. */
  readonly classifications: readonly IfrsAccountClassification[];
  /**
   * Optional comparative-period trial balance. When supplied, statements
   * render comparative columns; when absent, comparative renders as
   * `null` placeholders per pack §6 Slice 6 ("Comparative period support
   * if available; placeholder if not").
   */
  readonly comparativeTrialBalance?: readonly TrialBalanceSnapshotRow[];
  /** ISO 8601 — comparative period as-of date, when comparative supplied. */
  readonly comparativeAsOf?: string;
  /** Optional opening-equity input for the SoCE. v0 fixture-grade. */
  readonly openingEquity?: IfrsOpeningEquityComponents;
  /**
   * Optional cite to source `TrialBalanceSnapshotted.event_id` so the
   * downstream `ReportGenerated` event chains back under Principle 1.
   */
  readonly trialBalanceSnapshotEventId?: string;
}

/**
 * Opening-equity components for the SoCE. When omitted, the SoCE assumes
 * the entity is in its first reporting period (opening equity = 0); this
 * matches Hoz Bank's build-phase posture pre-licence-day.
 */
export interface IfrsOpeningEquityComponents {
  readonly shareCapitalMinor: number;
  readonly retainedEarningsMinor: number;
  readonly ociReserveMinor: number;
  readonly otherReservesMinor: number;
}

// ---------------------------------------------------------------------------
// Common output shapes
// ---------------------------------------------------------------------------

/**
 * One line item on an IFRS statement. Lines compose into sections; sections
 * compose into the statement.
 */
export interface IfrsLineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly comparativeAmountMinor: number | null;
  readonly currency: string;
  readonly contributingAccounts: readonly string[];
  readonly note?: string;
}

/**
 * Common output meta — every statement carries this.
 */
export interface IfrsOutputMeta {
  readonly statement: "SoFP" | "P&L" | "SCF" | "SoCE" | "notes";
  readonly statementVersion: "v0.1-rehearsal";
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly generatorVersion: "v0.1";
  readonly comparativeAsOf?: string;
  readonly trialBalanceSnapshotEventId?: string;
  readonly classificationsFingerprint: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class IfrsGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IfrsGeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard — Hoz Bank only at v0
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids in scope for IFRS solo statements at
 * v0. Per pack §6 Slice 6: per-entity (Hoz Bank only initially); consolidated
 * rollup is a downstream slice. Hoz Securities Limited has its own IFRS-solo
 * set (FAIS-related) and lands at a downstream tranche.
 */
export const IFRS_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

export function assertIfrsBankEntity(entity: string): void {
  if (!IFRS_BANK_ENTITIES.includes(entity)) {
    throw new IfrsGeneratorError(
      `IFRS statement generator: entity '${entity}' is not in IFRS_BANK_ENTITIES (${IFRS_BANK_ENTITIES.join(", ")}). Hoz Securities IFRS-solo + Hoz Group consolidated AFS land at a downstream slice. See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

export function assertIso4217(currency: string, label: string): void {
  if (!currency || currency.length !== 3) {
    throw new IfrsGeneratorError(
      `IFRS statement generator: ${label} must be ISO-4217 (3 chars), got '${currency}'`,
    );
  }
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

/**
 * Build an account → classification index, throwing on duplicate
 * registration. Mirrors the pattern in BA 700 (Slice 4).
 */
export function indexClassifications(
  classifications: readonly IfrsAccountClassification[],
): Map<string, IfrsAccountClassification> {
  const map = new Map<string, IfrsAccountClassification>();
  for (const c of classifications) {
    if (map.has(c.leafAccountId)) {
      throw new IfrsGeneratorError(
        `IFRS statement generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    map.set(c.leafAccountId, c);
  }
  return map;
}

/**
 * Deterministic fingerprint of a classification map. Sorted-stable JSON.
 * Mirrors BA 700 Slice 4 fingerprintClassifications.
 */
export function fingerprintIfrsClassifications(
  classifications: readonly IfrsAccountClassification[],
): string {
  const sorted = [...classifications].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}

/**
 * Filter trial balance to a single currency + classification class. Returns
 * rows sorted by leafAccountId for stable iteration.
 */
export function filterByClass(
  trialBalance: readonly TrialBalanceSnapshotRow[],
  classMap: Map<string, IfrsAccountClassification>,
  accountClass: IfrsAccountClass,
  currency: string,
): readonly { row: TrialBalanceSnapshotRow; classification: IfrsAccountClassification }[] {
  const filtered: { row: TrialBalanceSnapshotRow; classification: IfrsAccountClassification }[] = [];
  for (const row of trialBalance) {
    if (row.currency !== currency) continue;
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;
    if (c.accountClass !== accountClass) continue;
    filtered.push({ row, classification: c });
  }
  filtered.sort((a, b) =>
    a.row.leafAccountId < b.row.leafAccountId
      ? -1
      : a.row.leafAccountId > b.row.leafAccountId
        ? 1
        : 0,
  );
  return filtered;
}

/**
 * Standing IFRS citations for the AFS skeleton — every statement carries
 * these in its citations array per Principle 2.
 */
export const IFRS_AFS_BASE_CITATIONS: readonly string[] = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-6",
  "IAS 1 — Presentation of Financial Statements",
  "IAS 7 — Statement of Cash Flows",
  "IFRS 7 — Financial Instruments: Disclosures",
  "IFRS 9 — Financial Instruments",
  "IFRS 13 — Fair Value Measurement",
  "Companies Act 71 of 2008 §§28–30",
];
