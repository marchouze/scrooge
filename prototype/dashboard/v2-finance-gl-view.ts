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

import {
  fromMinorUnits,
  roundDecimal,
  toCanonicalString,
} from "../platform/core/decimal-engine";
import type { EventStore } from "../platform/event-store/store";
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

/** Format a minor-unit amount as "R1,234,567" (no cents). */
function fmtMinor(minor: number, currency: string): string {
  const major = roundDecimal(fromMinorUnits(BigInt(Math.trunc(minor)), 2), 0, "DOWN");
  const canonical = toCanonicalString(major);
  const negative = canonical.startsWith("-");
  const digits = negative ? canonical.slice(1) : canonical;
  const symbol = currency === "ZAR" ? "R" : `${currency} `;
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
type GlClass = "asset" | "liability" | "equity" | "income" | "expense" | "other";

function glClassOf(category: string): GlClass {
  if (category.startsWith("asset")) return "asset";
  if (category.startsWith("liability")) return "liability";
  if (category === "equity" || category.startsWith("equity")) return "equity";
  if (category.startsWith("income")) return "income";
  if (category.startsWith("expense")) return "expense";
  return "other";
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

/** One trial-balance row (per account/currency). Drills to its account ledger. */
export interface GlTrialBalanceRow {
  readonly accountId: string;
  readonly accountName: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly currency: string;
  /** Debit balance in minor units (0 when this account nets credit). */
  readonly debitMinor: number;
  readonly debitFmt: string;
  /** Credit balance in minor units (0 when this account nets debit). */
  readonly creditMinor: number;
  readonly creditFmt: string;
  /** Signed net in minor units (positive = debit balance). */
  readonly netMinor: number;
  readonly netFmt: string;
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
  /** The trial-balance rows (one per account/currency), sorted by account. */
  readonly rows: readonly GlTrialBalanceRow[];
  /** Σ debits over all rows (minor units, ZAR build-phase book). */
  readonly totalDebitMinor: number;
  readonly totalDebitFmt: string;
  /** Σ credits over all rows (minor units). */
  readonly totalCreditMinor: number;
  readonly totalCreditFmt: string;
  /** True iff ΣDr = ΣCr (the double-entry invariant holds). */
  readonly inBalance: boolean;
}

// ---------------------------------------------------------------------------
// Trial-balance view builder.
// ---------------------------------------------------------------------------

const FUNCTIONAL_CURRENCY = "ZAR";

export interface BuildGlViewArgs {
  readonly eventStore: EventStore;
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
  const { eventStore, filter } = args;

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

  const rows: GlTrialBalanceRow[] = [];
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;
  const classTotals: Record<GlClass, number> = {
    asset: 0,
    liability: 0,
    equity: 0,
    income: 0,
    expense: 0,
    other: 0,
  };

  for (const r of tb.rows) {
    const meta = metaByAccount.get(r.leafAccountId);
    const name = meta?.name ?? r.leafAccountId;
    const category = meta?.category ?? "unknown";
    // amountMinor is signed: positive = debit balance, negative = credit balance.
    const net = r.amountMinor;
    const debitMinor = net >= 0 ? net : 0;
    const creditMinor = net < 0 ? -net : 0;
    totalDebitMinor += debitMinor;
    totalCreditMinor += creditMinor;
    classTotals[glClassOf(category)] += net;

    rows.push({
      accountId: r.leafAccountId,
      accountName: name,
      category,
      categoryLabel: categoryLabel(category),
      currency: r.currency,
      debitMinor,
      debitFmt: debitMinor === 0 ? "" : fmtMinor(debitMinor, r.currency),
      creditMinor,
      creditFmt: creditMinor === 0 ? "" : fmtMinor(creditMinor, r.currency),
      netMinor: net,
      netFmt: fmtMinor(net, r.currency),
    });
  }

  const inBalance = totalDebitMinor === totalCreditMinor;
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
      unit: `ΣDr ${fmtMinor(totalDebitMinor, FUNCTIONAL_CURRENCY)} = ΣCr ${fmtMinor(totalCreditMinor, FUNCTIONAL_CURRENCY)}`,
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
