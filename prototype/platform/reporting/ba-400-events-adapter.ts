// platform/reporting/ba-400-events-adapter.ts
//
// BA 400 (Operational Risk return) events-first entry point. Folds primary
// `SubLedgerPostingEmitted` events directly to derive the per-business-line,
// per-fiscal-year gross-income table the BIA / TSA op-risk computation needs —
// rather than accepting a caller-supplied `OpRiskGrossIncomeRow[]`.
//
// Principle 1 (events-are-truth): gross income is a *query* over the GL posting
// stream, not stored state. The caller-supplied `generateBa300OpRisk` accepts a
// hand-built gross-income table; this adapter computes that table from the
// postings that produced it. Authority for the underlying event field:
// `SubLedgerPostingEmitted.baselBusinessLine` (merged PR #1118) — the SLA
// interpreter's product-to-business-line classification carried on each posting.
//
// Gross-income definition per BCBS D196 §650 / Reg 33(2):
//
//   gross income = net interest income
//                + net fee / commission income
//                + net trading income
//                + other operating income
//
//   It is taken GROSS of operating expenses and GROSS of provisions / impairment
//   (these are NOT deducted). It excludes realised profits / losses from the sale
//   of banking-book securities and extraordinary / irregular items.
//
// We approximate this from the GL by folding every posting leg that lands on a
// P&L (income / interest-expense) chart-of-accounts leaf, signing each leg so
// that credits to income accounts are positive and debits (interest expense,
// trading losses) reduce gross income. Provision / impairment accounts
// (`category` prefix `expense-impairment`) are EXCLUDED — they are not deducted
// from gross income (§650).
//
// Business-line attribution comes from the posting's `baselBusinessLine`.
// Postings on P&L accounts that carry NO `baselBusinessLine` are NOT dropped or
// re-attributed: they surface as an explicit "unattributed" line in the output
// so the gap is visible (Principle 1: surface, do not fabricate). The
// unattributed gross income is NOT fed into either the BIA or TSA capital figure
// (it has no β to apply and would distort the bank-aggregate); it is reported as
// `unattributedGrossIncomeMinor` + an explicit `unattributed` folded line + a
// `placeholders` entry so a consumer can see exactly what the capital excludes.
//
// Per-entity. Bank-licence-bound; only Hoz Bank LE-ZA-HOZ-BANK is in scope —
// the per-entity guard is inherited from `generateBa300OpRisk`.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH; brief
//   brief:mira:ws-ba-returns-followon-ba-400-op-risk-events-fir:2026-06-09.
// Citations: Principles/1-events-are-truth.md; D-BA-RETURN-NUMBERING-EXCEL-
//   CANONICAL; BCBS D196 §645–§654; Regulations Relating to Banks Reg 33.
//
// Author: Mira (Regulatory reporting engineer, engineering — reports to Camille
//   CFO; BA-returns sourcing owner).

import { COA_BY_ID } from "../accounting/coa-registry";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import {
  BUSINESS_LINE_BETA,
  type Ba300Output,
  type BaselBusinessLine,
  type OpRiskGrossIncomeRow,
  generateBa300OpRisk,
} from "./ba-400-op-risk";

// ---------------------------------------------------------------------------
// Business-line attribution sentinel
// ---------------------------------------------------------------------------

/**
 * Sentinel business-line key used for P&L postings that carry no
 * `baselBusinessLine`. NOT a real `BaselBusinessLine` — it is surfaced as a
 * distinct line in the output so the attribution gap is visible.
 */
export const UNATTRIBUTED_BUSINESS_LINE = "unattributed" as const;

export type Ba400AttributionKey = BaselBusinessLine | typeof UNATTRIBUTED_BUSINESS_LINE;

/** True iff `bl` is one of the eight Basel business lines (i.e. β-mappable). */
function isBaselBusinessLine(bl: string): bl is BaselBusinessLine {
  return Object.prototype.hasOwnProperty.call(BUSINESS_LINE_BETA, bl);
}

// ---------------------------------------------------------------------------
// P&L account classification — gross-income contribution sign
// ---------------------------------------------------------------------------

/**
 * Classify a chart-of-accounts leaf as P&L-gross-income relevant, returning the
 * sign of a CREDIT leg's contribution to gross income (a debit leg is the
 * negation).
 *
 * Per BCBS D196 §650 gross income = net interest + net fee + net trading +
 * other operating income, GROSS of operating expenses and provisions. We
 * therefore include `income-*` categories (credit = positive income) and
 * EXCLUDE provision / impairment accounts (`expense-impairment`). Pure expense
 * categories are not part of gross income and return `undefined` (skip).
 *
 * Returns:
 *   +1  → income account: a credit increases gross income (e.g. interest
 *         income, fee income, trading profit); a debit decreases it (e.g. a
 *         trading loss booked as a debit to the trading-P&L account, or
 *         interest expense booked as a debit to an interest account).
 *   undefined → not a gross-income account; the leg is skipped.
 */
function grossIncomeCreditSign(accountId: string): 1 | undefined {
  const acct = COA_BY_ID.get(accountId);
  if (!acct) return undefined;
  // Income accounts (interest / trading / fee / other) — credit is positive.
  // This naturally captures net interest income (interest expense lands as a
  // debit to an income-interest account, reducing the net) and net trading
  // income (a trading loss lands as a debit).
  if (acct.category.startsWith("income-")) return 1;
  // expense-impairment (provisions) and any other expense category are NOT
  // deducted from gross income per §650 — skip.
  return undefined;
}

// ---------------------------------------------------------------------------
// Fiscal-year derivation
// ---------------------------------------------------------------------------

/**
 * Map an event `as_of` ISO timestamp to a fiscal-year identifier.
 *
 * Build-phase v0: fiscal year == calendar year (the `YYYY` prefix of the ISO
 * date). The SARB / Hoz Bank financial year-end is a licence-day parameter
 * (typically not a 31-Dec calendar year); the fiscal-year boundary is a
 * substrate gap surfaced in `placeholders`. Using the calendar year keeps the
 * fold deterministic and matches the free-form `fiscalYear` string the
 * underlying generator already accepts.
 */
function fiscalYearOf(asOf: string): string {
  return asOf.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Gross-income fold
// ---------------------------------------------------------------------------

interface FoldedGrossIncome {
  /** Per (businessLineKey, fiscalYear) gross-income accumulator in minor units. */
  readonly byLineYear: Map<string, number>; // key: `${blKey}::${fiscalYear}`
  /** Distinct fiscal years observed. */
  readonly years: Set<string>;
  /** Whether any P&L posting lacked a `baselBusinessLine`. */
  unattributedSeen: boolean;
  /** Currencies other than the functional currency observed on P&L legs. */
  readonly foreignCurrencies: Set<string>;
}

function lineYearKey(blKey: Ba400AttributionKey, fiscalYear: string): string {
  return `${blKey}::${fiscalYear}`;
}

/**
 * Replay `SubLedgerPostingEmitted` events and fold gross income per
 * (business line, fiscal year) over P&L accounts.
 */
function foldGrossIncome(
  eventStore: EventStore,
  entity: string,
  asOf: string,
  functionalCurrency: string,
  untilSequence?: number,
): FoldedGrossIncome {
  const byLineYear = new Map<string, number>();
  const years = new Set<string>();
  const foreignCurrencies = new Set<string>();
  let unattributedSeen = false;

  const provenanceFilter = defaultProvenanceFilter();
  const frozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};

  for (const ev of eventStore.replay({
    entity,
    type: "SubLedgerPostingEmitted",
    asOf,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const payload = ev.payload as {
      legs?: Array<{
        accountId?: string;
        debitCredit?: "debit" | "credit";
        amountMinor?: number;
        currency?: string;
      }>;
      baselBusinessLine?: string;
    };
    if (!Array.isArray(payload.legs)) continue;

    const fiscalYear = fiscalYearOf(ev.as_of);

    // Resolve the posting's business-line attribution once per event.
    const rawBl = payload.baselBusinessLine;
    let blKey: Ba400AttributionKey;
    if (rawBl && isBaselBusinessLine(rawBl)) {
      blKey = rawBl;
    } else {
      // Missing OR a non-canonical string → unattributed (surfaced, never
      // dropped or fabricated into a real business line).
      blKey = UNATTRIBUTED_BUSINESS_LINE;
    }

    let eventTouchedPnl = false;
    for (const leg of payload.legs) {
      const acctId = leg.accountId;
      const ccy = leg.currency;
      if (!acctId || !ccy) continue;
      const creditSign = grossIncomeCreditSign(acctId);
      if (creditSign === undefined) continue; // not a gross-income account
      if (ccy !== functionalCurrency) {
        // Multi-currency gross income is a Slice 6+ extension; surface the
        // foreign-currency P&L leg as a gap rather than silently mixing units.
        foreignCurrencies.add(ccy);
        continue;
      }
      eventTouchedPnl = true;
      const amount = leg.amountMinor ?? 0;
      // Credit increases income (+creditSign); debit decreases it (−creditSign).
      const signed = leg.debitCredit === "credit" ? creditSign * amount : -creditSign * amount;
      const key = lineYearKey(blKey, fiscalYear);
      byLineYear.set(key, (byLineYear.get(key) ?? 0) + signed);
      years.add(fiscalYear);
    }

    if (eventTouchedPnl && blKey === UNATTRIBUTED_BUSINESS_LINE) {
      unattributedSeen = true;
    }
  }

  return { byLineYear, years, unattributedSeen, foreignCurrencies };
}

// ---------------------------------------------------------------------------
// Output extension
// ---------------------------------------------------------------------------

/** One folded gross-income line surfaced for transparency. */
export interface Ba400FoldedGrossIncomeLine {
  readonly businessLine: Ba400AttributionKey;
  readonly fiscalYear: string;
  readonly grossIncomeMinor: number;
  /** True for the `unattributed` sentinel line. */
  readonly unattributed: boolean;
}

/**
 * Events-first BA 400 output. Extends the pure `Ba300Output` with the folded
 * gross-income table (for audit / transparency) and an explicit
 * `unattributedGrossIncomeMinor` total surfacing postings with no business line.
 */
export interface Ba400FromEventsOutput extends Ba300Output {
  /** The per-(business-line, fiscal-year) gross income folded from postings. */
  readonly foldedGrossIncome: readonly Ba400FoldedGrossIncomeLine[];
  /**
   * Total gross income on P&L postings that carried NO `baselBusinessLine`.
   * Folded into the BIA aggregate but excluded from the TSA β-weighting.
   * Non-zero → an attribution gap (NOT a silent drop).
   */
  readonly unattributedGrossIncomeMinor: number;
}

// ---------------------------------------------------------------------------
// Generator — events-first entry point
// ---------------------------------------------------------------------------

/**
 * Generate the BA 400 (Operational Risk) projection by folding primary
 * `SubLedgerPostingEmitted` events directly to derive the gross-income table,
 * then delegating to the unchanged `generateBa300OpRisk` BIA / TSA engine.
 *
 * @param eventStore          the event store to replay
 * @param asOf                ISO 8601 period-end as-of date (inclusive bound)
 * @param entity              legal-entity short-id (`LE-ZA-HOZ-BANK`)
 * @param functionalCurrency  ISO 4217 functional currency (3 chars)
 * @param approach            BIA or TSA (build-phase default: BIA)
 * @param opts                optional period-id + frozen-cursor sequence bound
 */
export function generateBa400OpRiskFromEvents(
  eventStore: EventStore,
  asOf: string,
  entity: string,
  functionalCurrency: string,
  approach: "bia" | "tsa",
  opts?: { readonly periodId?: string; readonly untilSequence?: number },
): Ba400FromEventsOutput {
  const folded = foldGrossIncome(eventStore, entity, asOf, functionalCurrency, opts?.untilSequence);

  // Build the gross-income rows for the underlying generator. The generator's
  // `OpRiskGrossIncomeRow` requires a REAL `BaselBusinessLine`. The unattributed
  // total has no business line, so it cannot be fed to the generator without
  // either (a) fabricating a β (wrong for TSA) or (b) inflating an arbitrary
  // line (wrong for both). We therefore pass ONLY the attributed rows to the
  // generator — so BIA and TSA are both computed from real attributions — and
  // surface the unattributed total separately (`unattributedGrossIncomeMinor` +
  // an explicit `unattributed` folded line + a placeholder). The gap is visible,
  // never silently absorbed (Principle 1: surface, do not fabricate).
  const attributedRows: OpRiskGrossIncomeRow[] = [];
  const foldedLines: Ba400FoldedGrossIncomeLine[] = [];
  let unattributedTotal = 0;

  for (const [key, grossIncomeMinor] of folded.byLineYear.entries()) {
    const sepIdx = key.indexOf("::");
    const blKey = key.slice(0, sepIdx) as Ba400AttributionKey;
    const fiscalYear = key.slice(sepIdx + 2);
    const unattributed = blKey === UNATTRIBUTED_BUSINESS_LINE;
    foldedLines.push({ businessLine: blKey, fiscalYear, grossIncomeMinor, unattributed });
    if (unattributed) {
      unattributedTotal += grossIncomeMinor;
    } else {
      attributedRows.push({
        fiscalYear,
        businessLine: blKey as BaselBusinessLine,
        grossIncomeMinor,
      });
    }
  }

  // Deterministic ordering for stable output / snapshot tests.
  foldedLines.sort((a, b) =>
    a.fiscalYear !== b.fiscalYear
      ? a.fiscalYear < b.fiscalYear
        ? -1
        : 1
      : a.businessLine < b.businessLine
        ? -1
        : a.businessLine > b.businessLine
          ? 1
          : 0,
  );
  attributedRows.sort((a, b) =>
    a.fiscalYear !== b.fiscalYear
      ? a.fiscalYear < b.fiscalYear
        ? -1
        : 1
      : a.businessLine < b.businessLine
        ? -1
        : a.businessLine > b.businessLine
          ? 1
          : 0,
  );

  // Run the unchanged BIA / TSA engine over the attributed rows. Both BIA
  // (bank-aggregate) and TSA (per-business-line β-weighted) are therefore
  // computed from real, β-mappable attributions. The unattributed total is
  // surfaced separately rather than folded into either capital figure.
  const base = generateBa300OpRisk({
    entity,
    asOf,
    periodId: opts?.periodId ?? `period:hoz-bank:asof:${asOf.slice(0, 10)}`,
    functionalCurrency,
    grossIncome: attributedRows,
    approach,
  });

  // Augment placeholders with events-fold-specific gaps.
  const placeholders = [...base.placeholders];
  if (folded.unattributedSeen) {
    placeholders.push(
      `[citation: TBC — ${unattributedTotal} (minor) of gross income on P&L postings carried no baselBusinessLine; surfaced as the 'unattributed' line, excluded from BIA/TSA capital. Source: SLA interpreter product→business-line map coverage gap (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL).]`,
    );
  }
  if (folded.foreignCurrencies.size > 0) {
    placeholders.push(
      `[citation: TBC — P&L postings in non-functional currencies (${[...folded.foreignCurrencies].sort().join(", ")}) excluded from the gross-income fold; multi-currency op-risk gross income is a Slice 6+ extension.]`,
    );
  }
  placeholders.push(
    "[citation: TBC — fiscal year approximated as calendar year (YYYY); SARB/Hoz Bank financial year-end boundary is a licence-day parameter.]",
  );

  return {
    ...base,
    placeholders,
    foldedGrossIncome: foldedLines,
    unattributedGrossIncomeMinor: unattributedTotal,
  };
}
