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

import type { TrialBalance } from "../accounting/period-close";
import { amountToMinorUnits } from "../core/decimal-money";
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
