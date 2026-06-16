// platform/projections/gl-projection-v2.ts
//
// Phase 3A — V2 GL trial-balance projection (D-V1-REMOVAL-PHASE-3A, CEO-approved 2026-06-15).
//
// Reads GlPostingEmitted events (one event = one DR or CR leg) and folds them
// into the same TrialBalance shape that V1's computeTrialBalance returns. This
// enables the recon:gl-v2-parity gate to byte-compare the two paths.
//
// ## Design
//
// GlPostingEmitted is single-leg (unlike the V1 SubLedgerPostingEmitted which
// carries a legs[] array). Each event carries:
//   - accountCode: COA account ID
//   - creditDebit: "credit" | "debit"
//   - amount: MoneyWire (decimal-native; currency + amount string in major units)
//   - postingDate: ISO date (filters against periodStart..periodEnd window)
//
// The fold converts each amount to minor units via amountToMinorUnits (consistent
// with the V1 fold in computeTrialBalanceUncached). The sign convention is:
//   debit  → +minor (positive balance contribution)
//   credit → −minor (negative balance contribution)
//
// ## Output
//
// Returns a TrialBalance (same type as V1's computeTrialBalance). At Phase 3A
// only the FX sub-set has GlPostingEmitted events (PR-FX-001-V2, PR-FX-REVAL-V2,
// PR-FX-CLOSE-V2). Accounts where V1 posts but V2 doesn't → surfaced by the parity
// gate as advisory warnings. Accounts where BOTH post → byte-compared per
// (accountCode, currency) net balance.
//
// ## Caching
//
// Uses readWithOutputSnapshot (same pattern as the V1 computeTrialBalance) with
// stream key "gl-v2-trial-balance:<entity>:<periodStart>..<periodEnd>".
//
// ## Provenance
//
// Applies the same defaultProvenanceFilter as V1 (excludes simulated events from
// production trial-balance runs). Authority: D-PROVENANCE-FILTER-ENFORCEMENT.
//
// Authority: D-V1-REMOVAL-PHASE-3A (CEO-approved 2026-06-15).
// Citations: IFRS-9-§3.1.1; IFRS-9-§5.7.1; IAS-21-§23; P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TrialBalance } from "../accounting/period-close";
import { type Money, amountToMinorUnits } from "../core/decimal-money";
import { type MoneyWire, legAmountMoney } from "../core/money-codec";
import type { TrialBalanceSnapshotRow } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "./filter";
import { readWithOutputSnapshot } from "./output-snapshot-cache";

// ---------------------------------------------------------------------------
// ComputeTrialBalanceV2Args — mirrors the V1 ComputeTrialBalanceArgs interface.
// ---------------------------------------------------------------------------

export interface ComputeTrialBalanceV2Args {
  readonly eventStore: EventStore;
  readonly entity: string;
  /** Inclusive start of the fold window. Convention: AccountingPeriodOpened.periodStart. */
  readonly periodStart: string;
  /** Inclusive end of the fold window. Convention: AccountingPeriodOpened.periodEnd. */
  readonly periodEnd: string;
}

// ---------------------------------------------------------------------------
// GlPostingEmitted leg shape (inline type — avoids importing the full schema).
// ---------------------------------------------------------------------------

interface GlLeg {
  readonly accountCode: string;
  readonly creditDebit: "credit" | "debit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
}

// ---------------------------------------------------------------------------
// computeTrialBalanceV2Uncached — the pure fold over GlPostingEmitted events.
// ---------------------------------------------------------------------------

/**
 * Pure fold over GlPostingEmitted events for `entity` over [periodStart, periodEnd].
 *
 * Each GlPostingEmitted is one leg (DR or CR). The fold accumulates per-
 * (accountCode, currency) signed balances in minor units and derives the
 * per-currency debit/credit totals.
 *
 * Zero-balance accounts are dropped (consistent with the V1 fold).
 */
export function computeTrialBalanceV2Uncached(args: ComputeTrialBalanceV2Args): TrialBalance {
  // Per-(accountCode|currency) signed amount in minor units.
  // Sign convention: positive = debit balance; negative = credit balance.
  const balances = new Map<string, { account: string; currency: string; amount: number }>();
  let uptoSequence = 0;

  // Provenance filter — mirror V1 discipline (exclude simulated events).
  // Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
  const provenanceFilter = defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "GlPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;

    const leg = e.payload as unknown as GlLeg;
    // Date gate: filter against the posting period window.
    if (!leg.postingDate) continue;
    if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;

    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    const row = balances.get(key) ?? {
      account: leg.accountCode,
      currency: leg.amount.currency,
      amount: 0,
    };
    row.amount += leg.creditDebit === "debit" ? legMinor : -legMinor;
    balances.set(key, row);

    // Increment count as sequence proxy (consistent with V1 which uses event count
    // as uptoSequence — "the same N events fold to the same TB").
    uptoSequence += 1;
  }

  // Build sorted rows (drop zero-balance entries — consistent with V1).
  // TrialBalanceSnapshotRow shape: { leafAccountId, currency, amountMinor }
  // where amountMinor is signed: positive = debit balance, negative = credit balance.
  const rows: TrialBalanceSnapshotRow[] = [];

  for (const { account, currency, amount } of balances.values()) {
    if (amount === 0) continue;
    rows.push({ leafAccountId: account, currency, amountMinor: amount });
  }

  // Sort deterministically (leafAccountId, currency) — consistent with V1 sort.
  rows.sort((a, b) => {
    if (a.leafAccountId < b.leafAccountId) return -1;
    if (a.leafAccountId > b.leafAccountId) return 1;
    return a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0;
  });

  // Derive per-currency totals from the post-drop rows (consistent with V1).
  const totalsByCurrency = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const t = totalsByCurrency.get(row.currency) ?? { debit: 0, credit: 0 };
    if (row.amountMinor >= 0) t.debit += row.amountMinor;
    else t.credit += -row.amountMinor;
    totalsByCurrency.set(row.currency, t);
  }
  const perCurrencyTotals = [...totalsByCurrency.entries()]
    .map(([currency, t]) => ({ currency, debitMinor: t.debit, creditMinor: t.credit }))
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));

  return { rows, perCurrencyTotals, uptoSequence };
}

// ---------------------------------------------------------------------------
// computeTrialBalanceV2 — cached entry point (mirrors V1 computeTrialBalance).
// ---------------------------------------------------------------------------

/**
 * Compute the V2 trial balance for `entity` over [periodStart, periodEnd].
 *
 * Uses the output-snapshot cache (same pattern as V1 computeTrialBalance)
 * with stream key "gl-v2-trial-balance:<entity>:<periodStart>..<periodEnd>".
 *
 * For parity gate use: call `computeTrialBalanceV2Uncached` directly to
 * bypass the cache and compare against V1's `computeTrialBalanceUncached`.
 */
export function computeTrialBalanceV2(args: ComputeTrialBalanceV2Args): TrialBalance {
  const { output } = readWithOutputSnapshot<TrialBalance>({
    store: args.eventStore,
    streamKey: `gl-v2-trial-balance:${args.entity}:${args.periodStart}..${args.periodEnd}`,
    asOf: args.periodEnd,
    compute: () => computeTrialBalanceV2Uncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as TrialBalance,
  });
  return output;
}

// ===========================================================================
// S5 (WS-V2-AUTHORITATIVE) — entry-level + account-master V2 projections.
//
// The trial-balance fold above answers "what is the net balance per account?".
// The dashboard's /api/gl/entries and /api/gl/accounts routes need two more
// shapes that the balance-only fold cannot serve:
//
//   computeGlEntriesV2   — individually-addressable ledger entries (one per
//                          GlPostingEmitted leg), matching the V1 GlLedgerEntry
//                          shape (/api/gl/entries).
//   computeGlAccountsV2  — account-master: per-account, per-currency balances
//                          with COA name/category metadata, matching the V1
//                          /api/gl/accounts shape.
//
// Both read the SAME GlPostingEmitted stream, apply the SAME provenance filter
// and posting-date window as the trial-balance fold, and resolve COA metadata
// from the SAME chart-of-accounts.json the V1 gl-projection uses — so the V2
// read path is a true equivalent of V1, not a parallel re-implementation with
// drift. Both are output-snapshot-cached (Charter cmd 7 — deterministic replay).
//
// Authority: D-BANK-WIDE-V2-MIGRATION + D-V2-AUTHORITATIVE-FLIP-PREREQS
//            (CEO-approved 2026-06-16); D-ENGINEERING-INTEGRITY-CHARTER;
//            brief:atlas:ws-v2-authoritative-s5-v2-gl-posting-engine-expa:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).
// ===========================================================================

// ---------------------------------------------------------------------------
// COA metadata loader — reads the SAME chart-of-accounts.json as the V1
// gl-projection (platform/accounting/chart-of-accounts.json), so account
// name / category / natural-side resolve identically across V1 and V2.
// ---------------------------------------------------------------------------

interface CoaEntryV2 {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly side: "debit" | "credit";
}

interface CoaFileV2 {
  readonly items?: readonly CoaEntryV2[];
  readonly accounts?: readonly CoaEntryV2[];
}

let _coaCacheV2: Map<string, CoaEntryV2> | null = null;

function loadCoaV2(): Map<string, CoaEntryV2> {
  if (_coaCacheV2) return _coaCacheV2;
  try {
    // The COA file is resident alongside the V1 gl-projection in platform/accounting.
    const filePath = join(import.meta.dir, "..", "accounting", "chart-of-accounts.json");
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as CoaFileV2;
    const entries: readonly CoaEntryV2[] = parsed.items ?? parsed.accounts ?? [];
    _coaCacheV2 = new Map(entries.map((e) => [e.id, e]));
  } catch {
    _coaCacheV2 = new Map();
  }
  return _coaCacheV2;
}

function getCoaEntryV2(accountId: string): CoaEntryV2 {
  const coa = loadCoaV2();
  return (
    coa.get(accountId) ?? {
      id: accountId,
      name: accountId,
      category: "unknown",
      side: "debit",
    }
  );
}

// ---------------------------------------------------------------------------
// Full GlPostingEmitted leg shape needed for entry-level projection.
// (The trial-balance fold only needed accountCode / creditDebit / amount /
// postingDate; the entry-level view also surfaces description + posting rule.)
// ---------------------------------------------------------------------------

interface GlPostingLegFull {
  readonly accountCode: string;
  readonly creditDebit: "credit" | "debit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly description?: string;
  readonly postingRuleId?: string;
  readonly sourceEventId?: string;
}

// ---------------------------------------------------------------------------
// computeGlEntriesV2 — entry-level ledger projection.
//
// Returns one GlLedgerEntryV2 per GlPostingEmitted leg in the window, matching
// the V1 GlLedgerEntry shape the /api/gl/entries route surfaces. Decimal-native
// amount is the source of truth; amountMinor is derived for the legacy view.
// ---------------------------------------------------------------------------

export interface GlLedgerEntryV2 {
  /** Source GlPostingEmitted event_id (individually addressable). */
  readonly eventId: string;
  /** Source event type — always GlPostingEmitted for the V2 path. */
  readonly source: "GlPostingEmitted";
  /** ISO date this posting was made (GlPostingEmitted.postingDate). */
  readonly postedAt: string;
  /** Human-readable description (from the posting payload). */
  readonly description: string;
  /** Account this leg belongs to. */
  readonly accountId: string;
  readonly accountName: string;
  readonly accountCategory: string;
  readonly debitCredit: "debit" | "credit";
  /** Amount in minor currency units (derived from the decimal amount). */
  readonly amountMinor: number;
  /** Amount as exact decimal Money — source of truth. */
  readonly amount: Money;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Originating instrument/source event the posting was derived from. */
  readonly sourceEventId?: string;
  /** The V2 posting rule that produced this leg (e.g. PR-FX-001-V2). */
  readonly postingRuleId?: string;
}

export function computeGlEntriesV2Uncached(args: ComputeTrialBalanceV2Args): GlLedgerEntryV2[] {
  const entries: GlLedgerEntryV2[] = [];
  const provenanceFilter = defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "GlPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;

    const leg = e.payload as unknown as GlPostingLegFull;
    if (!leg.postingDate) continue;
    if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;

    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const coa = getCoaEntryV2(leg.accountCode);

    entries.push({
      eventId: e.event_id,
      source: "GlPostingEmitted",
      postedAt: leg.postingDate,
      description:
        typeof leg.description === "string" && leg.description.length > 0
          ? leg.description
          : `GL posting (${leg.postingRuleId ?? "V2"})`,
      accountId: leg.accountCode,
      accountName: coa.name,
      accountCategory: coa.category,
      debitCredit: leg.creditDebit,
      amountMinor: legMinor,
      amount: legMoney,
      currency: leg.amount.currency,
      ...(typeof leg.sourceEventId === "string" ? { sourceEventId: leg.sourceEventId } : {}),
      ...(typeof leg.postingRuleId === "string" ? { postingRuleId: leg.postingRuleId } : {}),
    });
  }

  // Sort by postedAt ascending (consistent with V1 buildGlView).
  entries.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  return entries;
}

/**
 * Cached entry-level V2 ledger projection. Mirrors the V1 buildGlView
 * ledgerEntries shape for the /api/gl/entries route.
 */
export function computeGlEntriesV2(args: ComputeTrialBalanceV2Args): GlLedgerEntryV2[] {
  const { output } = readWithOutputSnapshot<GlLedgerEntryV2[]>({
    store: args.eventStore,
    streamKey: `gl-v2-entries:${args.entity}:${args.periodStart}..${args.periodEnd}`,
    asOf: args.periodEnd,
    compute: () => computeGlEntriesV2Uncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as GlLedgerEntryV2[],
  });
  return output;
}

// ---------------------------------------------------------------------------
// computeGlAccountsV2 — account-master projection.
//
// Folds GlPostingEmitted legs into per-(account, currency) balances WITH COA
// name / category / natural-side metadata, matching the V1 /api/gl/accounts
// shape ({ accountId, name, category, balances: { [currency]: GlAccountBalance } }).
// ---------------------------------------------------------------------------

export interface GlAccountBalanceV2 {
  readonly accountId: string;
  readonly accountName: string;
  readonly accountCategory: string;
  readonly naturalSide: "debit" | "credit";
  /** Net balance in minor units (positive = balance on the account's natural side). */
  readonly balanceMinor: number;
  readonly totalDebitsMinor: number;
  readonly totalCreditsMinor: number;
}

export interface GlAccountMasterV2 {
  readonly accountId: string;
  readonly name: string;
  readonly category: string;
  /** Per-currency balances keyed by ISO 4217 code. */
  readonly balances: Record<string, GlAccountBalanceV2>;
}

export function computeGlAccountsV2Uncached(args: ComputeTrialBalanceV2Args): GlAccountMasterV2[] {
  // Outer key: accountId; inner key: currency.
  const byAccount = new Map<string, Map<string, GlAccountBalanceV2>>();
  const provenanceFilter = defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "GlPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;

    const leg = e.payload as unknown as GlPostingLegFull;
    if (!leg.postingDate) continue;
    if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;

    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const currency = leg.amount.currency;
    const coa = getCoaEntryV2(leg.accountCode);

    let byCurrency = byAccount.get(leg.accountCode);
    if (!byCurrency) {
      byCurrency = new Map<string, GlAccountBalanceV2>();
      byAccount.set(leg.accountCode, byCurrency);
    }
    const existing = byCurrency.get(currency);
    const bal: GlAccountBalanceV2 = existing ?? {
      accountId: leg.accountCode,
      accountName: coa.name,
      accountCategory: coa.category,
      naturalSide: coa.side,
      balanceMinor: 0,
      totalDebitsMinor: 0,
      totalCreditsMinor: 0,
    };

    // GlAccountBalanceV2 is readonly; rebuild with the accumulated figures.
    const isDebit = leg.creditDebit === "debit";
    const signedDelta = isDebit
      ? bal.naturalSide === "debit"
        ? legMinor
        : -legMinor
      : bal.naturalSide === "credit"
        ? legMinor
        : -legMinor;

    byCurrency.set(currency, {
      accountId: bal.accountId,
      accountName: bal.accountName,
      accountCategory: bal.accountCategory,
      naturalSide: bal.naturalSide,
      balanceMinor: bal.balanceMinor + signedDelta,
      totalDebitsMinor: bal.totalDebitsMinor + (isDebit ? legMinor : 0),
      totalCreditsMinor: bal.totalCreditsMinor + (isDebit ? 0 : legMinor),
    });
  }

  const accounts: GlAccountMasterV2[] = [];
  for (const [accountId, byCurrency] of byAccount.entries()) {
    const balances: Record<string, GlAccountBalanceV2> = {};
    // Deterministic currency ordering for replay-stable output.
    const currencies = [...byCurrency.keys()].sort((a, b) => a.localeCompare(b));
    for (const ccy of currencies) {
      const b = byCurrency.get(ccy);
      if (b) balances[ccy] = b;
    }
    const first = byCurrency.get(currencies[0] ?? "");
    const coa = getCoaEntryV2(accountId);
    accounts.push({
      accountId,
      name: first?.accountName ?? coa.name,
      category: first?.accountCategory ?? coa.category,
      balances,
    });
  }

  accounts.sort((a, b) => a.accountId.localeCompare(b.accountId));
  return accounts;
}

/**
 * Cached account-master V2 projection. Mirrors the V1 /api/gl/accounts shape.
 */
export function computeGlAccountsV2(args: ComputeTrialBalanceV2Args): GlAccountMasterV2[] {
  const { output } = readWithOutputSnapshot<GlAccountMasterV2[]>({
    store: args.eventStore,
    streamKey: `gl-v2-accounts:${args.entity}:${args.periodStart}..${args.periodEnd}`,
    asOf: args.periodEnd,
    compute: () => computeGlAccountsV2Uncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as GlAccountMasterV2[],
  });
  return output;
}
