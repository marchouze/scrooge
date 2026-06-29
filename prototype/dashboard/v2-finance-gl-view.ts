// dashboard/v2-finance-gl-view.ts
//
// V2 boundary DTOs for the General Ledger oversight surface
// (`/api/v2/finance/gl` + `/api/v2/finance/gl/account/:id`). Part of
// D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22) under D-V2-UI-OVERSIGHT-STANDARD.
//
// This module is the GL slice's OWN view file (kept separate from
// `v2-finance-view.ts`, which the capital slice edits concurrently). It is built
// to the V2 UI human-oversight standard (docs/v2-ui-oversight-standard.md): a
// clean `/api/v2/*` boundary reading canonical projections directly, an explicit
// `pageProvenance`, an HONEST data state (never a silent zero), and drill-through
// from every trial-balance row to its account-ledger detail.
//
// CANONICAL SOURCES (read directly — Charter cmd 4 source-don't-hardcode):
//   - Trial balance + account-master → `computeTrialBalanceV2` /
//     `computeGlAccountsV2` (platform/projections/gl-projection-v2.ts). As of
//     D-V2-UI-VISIBILITY-REMEDIATION these folds are provenance-aware AND fold
//     CAPITAL from the primary capital FIL events (the R300m injection is no
//     longer invisible to the GL — the fold-through fix). The SAME `filter` drives
//     the fold, so under Prod the simulated R300m injection is excluded (honest
//     empty pre-licence) and under +Sim it shows — and the GL Share Capital
//     balance then AGREES with the BA-700 capital numerator under the same lens.
//   - Account ledger (posting legs) → `computeGlEntriesV2`, filtered to the
//     requested account, so each row drills to the source FIL/GL events behind it.
//
// PROVENANCE: the page filter (`{ mode: "production-only" | "combined" }`) is
// passed straight to the projections; `pageProvenance` is the same filter so the
// badge matches the lens exactly.
//
// NAME-FREE (standing policy; feedback_no_agent_names_in_ui): the GL is a numeric
// fold — there is no agent personal name in any field. (No `seatTitle` mapping is
// required; if a future GL panel adds an owning-seat field it MUST route through
// `seatTitle` here.)
//
// BOUNDARY: dashboard layer — MAY import platform projections + v2-core types.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION; D-V2-UI-OVERSIGHT-STANDARD;
//   D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
//   D-V1-REMOVAL-PHASE-4; IFRS-9; Principle 1; Principle 6.
// Author: Atlas (Core banking platform architect, engineering).

import { foldSettledFcyCashCostRates } from "../platform/accounting/posting-rules-v2/fx-cash-reval-fold";
import { fromMinorUnits, roundDecimal, toCanonicalString } from "../platform/core/decimal-engine";
import type { EventStore } from "../platform/event-store/store";
import { type MarketDataStore, lookupQuoteWithInverse } from "../platform/market-data/store";
import type { ProvenanceFilter } from "../platform/projections/filter";
import {
  type GlAccountMasterV2,
  type GlLedgerEntryV2,
  computeGlAccountsV2,
  computeGlEntriesV2,
  computeTrialBalanceV2,
} from "../platform/projections/gl-projection-v2";
import {
  V2_ANCHOR_ENTITY,
  V2_PERIOD_END,
  V2_PERIOD_START,
} from "../platform/projections/v2-read-window";

// ---------------------------------------------------------------------------
// Display helpers (ZAR-centric; the build-phase anchor book is ZAR). Money
// formatting goes through the exact decimal engine — no IEEE float (Charter cmd 6).
// ---------------------------------------------------------------------------

function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a minor-unit amount as "R1,234,567" (no cents). Pass `{ symbol: false }`
 * to omit the currency indicator — used for table amount cells that already sit
 * under a dedicated currency column (CCY) or a currency-labelled header (ZAR), so
 * the indicator would be redundant.
 */
function fmtMinor(minor: number, currency: string, opts?: { symbol?: boolean }): string {
  const withSymbol = opts?.symbol ?? true;
  const major = roundDecimal(fromMinorUnits(BigInt(Math.trunc(minor)), 2), 0, "DOWN");
  const canonical = toCanonicalString(major);
  const negative = canonical.startsWith("-");
  const digits = negative ? canonical.slice(1) : canonical;
  const symbol = !withSymbol ? "" : currency === "ZAR" ? "R" : `${currency} `;
  return `${negative ? "−" : ""}${symbol}${groupThousands(digits)}`;
}

/** Human label for a CoA category key (e.g. "asset-cash" → "Asset · Cash"). */
function categoryLabel(category: string): string {
  const [head, ...rest] = category.split("-");
  const headLabel = head ? head.charAt(0).toUpperCase() + head.slice(1) : category;
  if (rest.length === 0) return headLabel;
  const tail = rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  return `${headLabel} · ${tail}`;
}

/** Top-level accounting class of a CoA category (drives the totals tiles). */
type GlClass =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense"
  | "off-balance-sheet"
  | "other";

function glClassOf(category: string): GlClass {
  // Off-balance-sheet memorandum accounts (FX trade-date commitment quad,
  // regulatory NOP, …) are EXCLUDED from the on-balance-sheet asset/liability/
  // equity tiles AND from the native in-balance check — they self-balance in
  // their own segregated section. (D-FX-TRADE-DATE-FVTPL-OBS.)
  if (category.startsWith("memorandum") || category.startsWith("off-balance-sheet")) {
    return "off-balance-sheet";
  }
  if (category.startsWith("asset")) return "asset";
  if (category.startsWith("liability")) return "liability";
  if (category === "equity" || category.startsWith("equity")) return "equity";
  if (category.startsWith("income")) return "income";
  if (category.startsWith("expense")) return "expense";
  return "other";
}

/** True iff a CoA category is an off-balance-sheet memorandum class. */
function isOffBalanceSheetCategory(category: string): boolean {
  return glClassOf(category) === "off-balance-sheet";
}

// ---------------------------------------------------------------------------
// Output DTOs (name-free; minor units + formatted display).
// ---------------------------------------------------------------------------

/**
 * Serving state of the GL surface under the active lens.
 *   - "live"  — the folds returned posted balances.
 *   - "empty" — authoritative but data-empty under this lens (the honest absent
 *               state — e.g. Prod pre-licence: no real postings). Never a clean zero.
 */
export type GlDataState = "live" | "empty";

/**
 * One trial-balance row — exactly one row per (account, currency) (NOT one
 * collapsed row per account). Drills to its account ledger. The native Dr/Cr is in
 * the row's own ISO currency (always a real currency — never a "multi" sentinel);
 * the ZAR-equivalent (translated at the latest production spot) is the comparable
 * common-currency column (functional-currency presentation, Principle 5). An
 * account that holds postings in two currencies becomes TWO rows (e.g.
 * realised-FX-P&L USD and realised-FX-P&L ZAR), each with a meaningful native
 * Dr/Cr — cross-currency minor units are never summed into a single meaningless row.
 */
export interface GlTrialBalanceRow {
  readonly accountId: string;
  readonly accountName: string;
  readonly category: string;
  readonly categoryLabel: string;
  /** Native ISO 4217 currency of this (account, currency) row — always a real currency. */
  readonly currency: string;
  /** Debit balance in NATIVE minor units (0 when this row nets credit). */
  readonly debitMinor: number;
  readonly debitFmt: string;
  /** Credit balance in NATIVE minor units (0 when this row nets debit). */
  readonly creditMinor: number;
  readonly creditFmt: string;
  /** Signed NATIVE net in minor units (positive = debit balance). */
  readonly netMinor: number;
  readonly netFmt: string;
  /** Whether a production FX rate was available to translate this currency to ZAR. */
  readonly zarRateAvailable: boolean;
  /** Debit balance translated to ZAR minor units (indicative, @ latest spot). */
  readonly zarDebitMinor: number;
  readonly zarDebitFmt: string;
  /** Credit balance translated to ZAR minor units. */
  readonly zarCreditMinor: number;
  readonly zarCreditFmt: string;
  /** Signed ZAR-equivalent net in minor units. */
  readonly zarNetMinor: number;
  readonly zarNetFmt: string;
  /**
   * True iff this row is an OFF-BALANCE-SHEET memorandum account (FX trade-date
   * commitment quad, regulatory NOP, …) — rendered in a segregated section and
   * EXCLUDED from on-balance-sheet asset/liability/equity totals + the in-balance
   * check. (D-FX-TRADE-DATE-FVTPL-OBS.)
   */
  readonly offBalanceSheet: boolean;
}

/** A totals tile (assets / liabilities / equity / in-balance check). */
export interface GlTotalsTile {
  readonly key: string;
  readonly label: string;
  readonly valueFmt: string;
  readonly unit: string;
}

export interface GlView {
  readonly entity: string;
  readonly functionalCurrency: string;
  readonly dataState: GlDataState;
  /** When `empty`, why (never a silent zero). Empty string when `live`. */
  readonly reason: string;
  /** Headline totals tiles (assets, liabilities, equity, in-balance check). */
  readonly tiles: readonly GlTotalsTile[];
  /** The trial-balance rows (one per account/currency), sorted by account then currency. */
  readonly rows: readonly GlTrialBalanceRow[];
  /**
   * Σ native debits over all on-BS rows (minor units), summed per currency then
   * added — a presentation aggregate only. NOT used for the in-balance check (native
   * minor units across currencies are not commensurable); see `inBalance`.
   */
  readonly totalDebitMinor: number;
  readonly totalDebitFmt: string;
  /** Σ native credits over all on-BS rows (minor units) — presentation aggregate only. */
  readonly totalCreditMinor: number;
  readonly totalCreditFmt: string;
  /**
   * True iff ΣDr = ΣCr on the ZAR-EQUIVALENT (functional-currency) on-balance-sheet
   * totals — native minor units cannot be summed across currencies, so the
   * double-entry invariant is asserted in the functional currency (Principle 5;
   * reporting currency is presentation). Honest about missing rates: a row whose
   * currency has no production FX rate is excluded from this check (its ZAR-equiv is
   * unavailable, never a fake zero).
   */
  readonly inBalance: boolean;
  /** Σ debits translated to ZAR (indicative, @ latest spot). */
  readonly zarTotalDebitMinor: number;
  readonly zarTotalDebitFmt: string;
  /** Σ credits translated to ZAR (indicative, @ latest spot). */
  readonly zarTotalCreditMinor: number;
  readonly zarTotalCreditFmt: string;
  /**
   * Off-balance-sheet memorandum Σ debits (native minor) — the segregated OBS
   * section total, EXCLUDED from `totalDebitMinor` / the on-BS in-balance check.
   * (D-FX-TRADE-DATE-FVTPL-OBS.)
   */
  readonly offBalanceSheetDebitMinor: number;
  readonly offBalanceSheetDebitFmt: string;
  /** Off-balance-sheet memorandum Σ credits (native minor). */
  readonly offBalanceSheetCreditMinor: number;
  readonly offBalanceSheetCreditFmt: string;
  /** True iff the OBS section self-balances (ΣDr == ΣCr over memorandum rows). */
  readonly offBalanceSheetInBalance: boolean;
}

// ---------------------------------------------------------------------------
// Trial-balance view builder.
// ---------------------------------------------------------------------------

const FUNCTIONAL_CURRENCY = "ZAR";

/** Settled-cash nostro accounts whose FCY balance is a §23 monetary item carried
 *  at SETTLE-rate COST BASIS — the EOD-MTM reval (ACC-1200-099) carries it to the
 *  closing mark, so the row is shown at cost and the reval-asset holds the delta
 *  (no double-count). All other FCY rows keep the latest-spot translation. */
const NOSTRO_ACCOUNT_PREFIX = "ACC-1200-";

/**
 * Translate a NATIVE minor-unit amount to ZAR minor units. ZAR is the identity.
 *
 * For a SETTLED-FCY-CASH NOSTRO row (`costRate` supplied), the FCY balance is a
 * foreign-currency MONETARY item carried at its SETTLE-rate COST BASIS (IAS 21
 * §23): translate at `costRate`. The EOD-MTM reval (PR-FX-CASH-REVAL-V2) posts the
 * carrying-value adjustment from cost basis to the closing mark into ACC-1200-099,
 * so showing the nostro at cost + the reval-asset at the delta gives the §23
 * closing carrying value WITHOUT double-counting — and makes every entry (the
 * settlement entry @ settle rate, the reval entry in ZAR) balance per-entry in ZAR.
 *
 * For all other FCY rows (`costRate` undefined), translate at the latest PRODUCTION
 * spot (the same mark set V2 valuation/risk read). Returns `null` when no rate is
 * available (honest — never a silent 0). Rates are plain numbers with no money-name
 * token (established V2 reporting-conversion convention; the no-float-money gate
 * does not flag it).
 */
function toZarEquivMinor(
  nativeNet: number,
  currency: string,
  marketDataStore: MarketDataStore,
  costRate?: number,
): number | null {
  if (currency === FUNCTIONAL_CURRENCY) return nativeNet;
  if (costRate !== undefined) {
    if (costRate <= 0) return null;
    return Math.round(nativeNet * costRate);
  }
  const quote = lookupQuoteWithInverse(marketDataStore, `${currency}/${FUNCTIONAL_CURRENCY}`, {
    provenance: "production",
  });
  if (quote === null || quote.rate <= 0) return null;
  const units = nativeNet;
  const converted = units * quote.rate;
  return Math.round(converted);
}

export interface BuildGlViewArgs {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly filter: ProvenanceFilter;
}

/**
 * Build the V2 GL trial-balance view under the active provenance lens. The folds
 * are provenance-aware: a `production-only` filter yields the honest empty state
 * pre-licence; a `combined` filter admits the simulated R300m capital injection
 * (which now folds into the trial balance via the capital fold-through), so Share
 * Capital reconciles with the BA-700 capital page.
 */
export function buildGlView(args: BuildGlViewArgs): GlView {
  const { eventStore, marketDataStore, filter } = args;

  // Account-master (per account/currency, with CoA name + category) — the source
  // for the trial-balance rows + the totals classification.
  const accounts: GlAccountMasterV2[] = computeGlAccountsV2({
    eventStore,
    entity: V2_ANCHOR_ENTITY,
    periodStart: V2_PERIOD_START,
    periodEnd: V2_PERIOD_END,
    filter,
  });

  // Trial balance (signed net per account/currency) — the authoritative net used
  // for the Dr/Cr split + the in-balance check.
  const tb = computeTrialBalanceV2({
    eventStore,
    entity: V2_ANCHOR_ENTITY,
    periodStart: V2_PERIOD_START,
    periodEnd: V2_PERIOD_END,
    filter,
  });

  // Index account metadata (name/category) by accountId for row enrichment.
  const metaByAccount = new Map<string, { name: string; category: string }>();
  for (const a of accounts) {
    metaByAccount.set(a.accountId, { name: a.name, category: a.category });
  }

  // SETTLE-rate COST-BASIS rates for settled FCY cash (IAS 21 §23 monetary item).
  // The FCY nostro rows are carried at their cost basis; the EOD-MTM reval
  // (ACC-1200-099) holds the adjustment to the closing mark — so cost + reval-asset
  // = the §23 closing carrying value WITHOUT double-counting, and every entry
  // (settlement @ settle rate, reval @ ZAR) balances per-entry in ZAR. The reval
  // contribution is already folded into `tb` (computeTrialBalanceV2).
  // Authority: D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1.
  const cashCostRates = foldSettledFcyCashCostRates({
    eventStore,
    periodStart: V2_PERIOD_START,
    periodEnd: V2_PERIOD_END,
    filter,
  });

  // ONE ROW PER (account, currency): emit the `computeTrialBalanceV2` per-(account,
  // currency) fold rows DIRECTLY — no per-account aggregation, no "multi" sentinel.
  // A shared account holding postings in two currencies (e.g. realised-FX-P&L USD +
  // realised-FX-P&L ZAR) becomes TWO rows, each carrying its real native currency
  // and a meaningful native Dr/Cr. Native minor units are NEVER summed across
  // currencies (USD cents ≠ ZAR cents).
  const rows: GlTrialBalanceRow[] = [];

  // ON-BALANCE-SHEET native Dr/Cr totals PER CURRENCY (native minor units cannot be
  // summed across currencies, so we keep one running pair per currency). The native
  // in-balance invariant holds iff every currency self-balances; the headline
  // in-balance check (below) is asserted on the ZAR-EQUIVALENT functional totals.
  const nativeTotalsByCurrency = new Map<string, { debit: number; credit: number }>();
  // ZAR-equivalent functional on-balance-sheet totals — the headline in-balance check.
  let zarTotalDebitMinor = 0;
  let zarTotalCreditMinor = 0;
  const classTotals: Record<GlClass, number> = {
    asset: 0,
    liability: 0,
    equity: 0,
    income: 0,
    expense: 0,
    "off-balance-sheet": 0,
    other: 0,
  };
  // Off-balance-sheet memorandum totals (ZAR-equivalent) — EXCLUDED from the on-BS
  // in-balance check; they self-balance in their own segregated section.
  // (D-FX-TRADE-DATE-FVTPL-OBS.)
  let obsDebitMinor = 0;
  let obsCreditMinor = 0;

  for (const r of tb.rows) {
    const meta = metaByAccount.get(r.leafAccountId);
    const accountId = r.leafAccountId;
    const name = meta?.name ?? r.leafAccountId;
    const category = meta?.category ?? "unknown";
    const currency = r.currency;

    // NATIVE figures — the row's own currency (positive net = debit balance).
    const nativeNet = r.amountMinor;
    const debitMinor = nativeNet >= 0 ? nativeNet : 0;
    const creditMinor = nativeNet < 0 ? -nativeNet : 0;

    // ZAR-EQUIVALENT — translate this single currency leg (honest null on missing
    // rate). A settled-FCY-cash NOSTRO row is carried at its SETTLE-rate COST BASIS
    // (IAS 21 §23 monetary item); the EOD-MTM reval-asset (ACC-1200-099) carries the
    // adjustment to the closing mark. Every other FCY row uses the latest spot.
    const costRate =
      accountId.startsWith(NOSTRO_ACCOUNT_PREFIX) ? cashCostRates.get(currency) : undefined;
    const zar = toZarEquivMinor(nativeNet, currency, marketDataStore, costRate);
    const zarRateAvailable = zar !== null;
    const zarNet = zar ?? 0;
    const zarDebitMinor = zarNet >= 0 ? zarNet : 0;
    const zarCreditMinor = zarNet < 0 ? -zarNet : 0;

    const isObs = isOffBalanceSheetCategory(category);
    if (zarRateAvailable) {
      if (isObs) {
        // OBS memorandum rows accumulate into their own segregated section total.
        obsDebitMinor += zarDebitMinor;
        obsCreditMinor += zarCreditMinor;
      } else {
        zarTotalDebitMinor += zarDebitMinor;
        zarTotalCreditMinor += zarCreditMinor;
        // Native per-currency on-BS running totals (for the per-currency invariant).
        const t = nativeTotalsByCurrency.get(currency) ?? { debit: 0, credit: 0 };
        t.debit += debitMinor;
        t.credit += creditMinor;
        nativeTotalsByCurrency.set(currency, t);
      }
      // Class totals run on the ZAR-equivalent so multi-currency books aggregate.
      classTotals[glClassOf(category)] += zarNet;
    } else if (!isObs) {
      // Honest about a missing rate: still record the native per-currency on-BS
      // pair so a currency with no production rate is visible in the native columns,
      // even though it cannot contribute to the ZAR functional in-balance check.
      const t = nativeTotalsByCurrency.get(currency) ?? { debit: 0, credit: 0 };
      t.debit += debitMinor;
      t.credit += creditMinor;
      nativeTotalsByCurrency.set(currency, t);
    }

    rows.push({
      accountId,
      accountName: name,
      category,
      categoryLabel: categoryLabel(category),
      currency,
      debitMinor,
      // Amount cells sit under the CCY column → no redundant currency indicator.
      debitFmt: debitMinor !== 0 ? fmtMinor(debitMinor, currency, { symbol: false }) : "",
      creditMinor,
      creditFmt: creditMinor !== 0 ? fmtMinor(creditMinor, currency, { symbol: false }) : "",
      netMinor: nativeNet,
      netFmt: fmtMinor(nativeNet, currency),
      zarRateAvailable,
      zarDebitMinor,
      // ZAR amount cells sit under a "(ZAR)"-labelled header → omit the "R" indicator.
      zarDebitFmt: !zarRateAvailable
        ? "rate n/a"
        : zarDebitMinor === 0
          ? ""
          : fmtMinor(zarDebitMinor, FUNCTIONAL_CURRENCY, { symbol: false }),
      zarCreditMinor,
      zarCreditFmt: !zarRateAvailable
        ? "rate n/a"
        : zarCreditMinor === 0
          ? ""
          : fmtMinor(zarCreditMinor, FUNCTIONAL_CURRENCY, { symbol: false }),
      zarNetMinor: zarNet,
      zarNetFmt: !zarRateAvailable ? "rate n/a" : fmtMinor(zarNet, FUNCTIONAL_CURRENCY),
      offBalanceSheet: isObs,
    });
  }

  // Stable order: by account id, then by currency.
  rows.sort(
    (a, b) => a.accountId.localeCompare(b.accountId) || a.currency.localeCompare(b.currency),
  );

  // Native on-balance-sheet Σ Dr / Σ Cr — these are per-currency-summed figures kept
  // for the headline native totals tiles. They MUST NOT drive the in-balance check
  // (USD cents + ZAR cents is meaningless); the in-balance check is on the ZAR
  // functional totals below.
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;
  for (const t of nativeTotalsByCurrency.values()) {
    totalDebitMinor += t.debit;
    totalCreditMinor += t.credit;
  }

  // The on-balance-sheet in-balance check runs on the ZAR-EQUIVALENT (functional)
  // on-BS totals — native minor units cannot be summed across currencies. The OBS
  // memorandum section self-balances on its own ZAR-equivalent totals.
  const inBalance = zarTotalDebitMinor === zarTotalCreditMinor;
  const offBalanceSheetInBalance = obsDebitMinor === obsCreditMinor;
  // Equity stock is a credit balance (negative net); present as a positive figure.
  const assetsMinor = classTotals.asset;
  const liabilitiesMinor = -classTotals.liability;
  const equityMinor = -classTotals.equity;

  const dataState: GlDataState = rows.length > 0 ? "live" : "empty";
  const reason =
    dataState === "empty"
      ? filter.mode === "combined"
        ? "No GL postings folded under the +Sim lens — no simulated trades or capital events in this store."
        : "No real GL postings in the build phase (no real trades or capital pre-licence-day). Switch to + Sim to view the demonstration book — including the R300m capital injection. This is an honest empty state, not a clean zero."
      : "";

  const tiles: GlTotalsTile[] = [
    {
      key: "assets",
      label: "Total assets",
      valueFmt: fmtMinor(assetsMinor, FUNCTIONAL_CURRENCY),
      unit: "Net debit balance",
    },
    {
      key: "liabilities",
      label: "Total liabilities",
      valueFmt: fmtMinor(liabilitiesMinor, FUNCTIONAL_CURRENCY),
      unit: "Net credit balance",
    },
    {
      key: "equity",
      label: "Equity (own funds)",
      valueFmt: fmtMinor(equityMinor, FUNCTIONAL_CURRENCY),
      unit: "Net credit balance",
    },
    {
      key: "in-balance",
      label: "Trial balance",
      valueFmt: inBalance ? "In balance" : "OUT OF BALANCE",
      // The in-balance check is on the ZAR-EQUIVALENT (functional) on-BS totals —
      // native minor units cannot be summed across currencies (Principle 5).
      unit: `ΣDr ${fmtMinor(zarTotalDebitMinor, FUNCTIONAL_CURRENCY)} = ΣCr ${fmtMinor(zarTotalCreditMinor, FUNCTIONAL_CURRENCY)} (ZAR-equiv)`,
    },
  ];

  return {
    entity: V2_ANCHOR_ENTITY,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    dataState,
    reason,
    tiles,
    rows,
    totalDebitMinor,
    totalDebitFmt: fmtMinor(totalDebitMinor, FUNCTIONAL_CURRENCY),
    totalCreditMinor,
    totalCreditFmt: fmtMinor(totalCreditMinor, FUNCTIONAL_CURRENCY),
    inBalance,
    zarTotalDebitMinor,
    // Totals land in the "(ZAR)"-labelled amount columns → bare, matching the rows.
    zarTotalDebitFmt: fmtMinor(zarTotalDebitMinor, FUNCTIONAL_CURRENCY, { symbol: false }),
    zarTotalCreditMinor,
    zarTotalCreditFmt: fmtMinor(zarTotalCreditMinor, FUNCTIONAL_CURRENCY, { symbol: false }),
    offBalanceSheetDebitMinor: obsDebitMinor,
    offBalanceSheetDebitFmt: fmtMinor(obsDebitMinor, FUNCTIONAL_CURRENCY),
    offBalanceSheetCreditMinor: obsCreditMinor,
    offBalanceSheetCreditFmt: fmtMinor(obsCreditMinor, FUNCTIONAL_CURRENCY),
    offBalanceSheetInBalance,
  };
}

// ---------------------------------------------------------------------------
// Account-ledger detail view (the drill target for a trial-balance row).
// ---------------------------------------------------------------------------

/** One posting leg behind an account balance (the constituent detail). */
export interface GlAccountLedgerLeg {
  /** Source FIL/GL event id this leg was folded from (individually addressable). */
  readonly eventId: string;
  readonly postedAt: string;
  readonly description: string;
  readonly debitCredit: "debit" | "credit";
  readonly amountMinor: number;
  readonly amountFmt: string;
  readonly currency: string;
  /** Originating instrument/source event the posting was derived from. */
  readonly sourceEventId: string;
  /** The IFRS / posting rule that produced this leg (e.g. PR-CAP-ISSUE-001-V2). */
  readonly postingRuleId: string;
}

export interface GlAccountLedgerView {
  readonly entity: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly dataState: GlDataState;
  readonly reason: string;
  /** Per-currency net balance summary for this account. */
  readonly balances: ReadonlyArray<{
    readonly currency: string;
    readonly netMinor: number;
    readonly netFmt: string;
    readonly debitFmt: string;
    readonly creditFmt: string;
  }>;
  /** The posting legs behind the balance, newest first. */
  readonly legs: readonly GlAccountLedgerLeg[];
}

export interface BuildGlAccountLedgerArgs {
  readonly eventStore: EventStore;
  readonly filter: ProvenanceFilter;
  readonly accountId: string;
}

/**
 * Build the account-ledger detail for one account under the active lens. Reads the
 * entry-level projection (`computeGlEntriesV2`) and filters to the requested
 * account, so every leg carries its source event + IFRS/posting-rule id.
 */
export function buildGlAccountLedger(args: BuildGlAccountLedgerArgs): GlAccountLedgerView {
  const { eventStore, filter, accountId } = args;

  const allEntries: GlLedgerEntryV2[] = computeGlEntriesV2({
    eventStore,
    entity: V2_ANCHOR_ENTITY,
    periodStart: V2_PERIOD_START,
    periodEnd: V2_PERIOD_END,
    filter,
  });
  const entries = allEntries.filter((e) => e.accountId === accountId);

  // Resolve account metadata from the entries (the CoA name/category ride on
  // every entry). Fall back to the account-master if there are no entries.
  let accountName = accountId;
  let category = "unknown";
  if (entries.length > 0) {
    const first = entries[0];
    if (first) {
      accountName = first.accountName;
      category = first.accountCategory;
    }
  } else {
    const accounts = computeGlAccountsV2({
      eventStore,
      entity: V2_ANCHOR_ENTITY,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
      filter,
    });
    const a = accounts.find((x) => x.accountId === accountId);
    if (a) {
      accountName = a.name;
      category = a.category;
    }
  }

  // Per-currency net (signed: positive = debit balance contribution).
  const byCurrency = new Map<string, { net: number; debit: number; credit: number }>();
  for (const e of entries) {
    const cur = byCurrency.get(e.currency) ?? { net: 0, debit: 0, credit: 0 };
    if (e.debitCredit === "debit") {
      cur.net += e.amountMinor;
      cur.debit += e.amountMinor;
    } else {
      cur.net -= e.amountMinor;
      cur.credit += e.amountMinor;
    }
    byCurrency.set(e.currency, cur);
  }

  const balances = [...byCurrency.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([currency, t]) => ({
      currency,
      netMinor: t.net,
      netFmt: fmtMinor(t.net, currency),
      debitFmt: fmtMinor(t.debit, currency),
      creditFmt: fmtMinor(t.credit, currency),
    }));

  const legs: GlAccountLedgerLeg[] = entries
    .map((e) => ({
      eventId: e.eventId,
      postedAt: e.postedAt,
      description: e.description,
      debitCredit: e.debitCredit,
      amountMinor: e.amountMinor,
      amountFmt: fmtMinor(e.amountMinor, e.currency),
      currency: e.currency,
      sourceEventId: e.sourceEventId ?? e.eventId,
      postingRuleId: e.postingRuleId ?? "—",
    }))
    // Newest first for the ledger render.
    .sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0));

  const dataState: GlDataState = legs.length > 0 ? "live" : "empty";
  const reason =
    dataState === "empty"
      ? filter.mode === "combined"
        ? `No posting legs for ${accountId} under the +Sim lens.`
        : `No real posting legs for ${accountId} in the build phase. Switch to + Sim to view the demonstration book. This is an honest empty state, not a clean zero.`
      : "";

  return {
    entity: V2_ANCHOR_ENTITY,
    accountId,
    accountName,
    category,
    categoryLabel: categoryLabel(category),
    dataState,
    reason,
    balances,
    legs,
  };
}
