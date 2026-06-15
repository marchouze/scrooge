// platform/risk/sa-ccr/fil-valuable-collateral-feed.ts
//
// FIL-MEDIATED vMtm + collateral feed for the SA-CCR v2 FIL-Model
// (WS-V2-BBAAS). This is the last data-access path the SA-CCR cutover needed:
// after #1295 (S7-FIL model) and #1296 (FIL-instance materialisation of the
// trade/netting STRUCTURE), two RC inputs remained externally pinned from the
// recorded v1 RC event-of-record — `vMtm` and `collateral`. This module sources
// BOTH from their own canonical events-of-record, FIL-mediated:
//
//   - vMtm     ← the latest `*Revalued` EVENT-OF-RECORD per trade, as-of the RC
//                date, exposed through the `Valuable` facet's `RevaluationRecord`
//                shape (W9 §3.4: a position's mark-to-market IS the output of the
//                `Valuable` facet, emitted as a `*Revalued` event). This is the
//                Principle-1 reading — the CANONICAL revaluation event, NOT the
//                drift-prone cumulative-delta walk in v1 `resolveMtm` (which sums
//                `FxPositionRevalued.unrealisedPnlZarMinor` as if it were an
//                incremental delta; it is actually the open position's full
//                unrealised P&L at each reval, so SUMMING double-counts). The
//                event-of-record reading is LATEST-PER-TRADE, last-write-wins by
//                event time, exactly as a `Valuable` implementation would answer.
//   - collateral ← the collateral-inventory register (`getCollateralInventory`,
//                Atlas's projection over `CollateralInventorySnapshotted` +
//                `CollateralUpdated`), as-of the RC date. v1 limitation retained:
//                the inventory is a bank-level ZAR pool, not yet per-netting-set
//                allocated (D-CSA-COLLATERAL-ALLOCATION, future). The feed mirrors
//                v1 `resolveCollateral` semantics so parity holds.
//
// WHY A `Valuable`-SHAPED READER (not a re-derivation): D-MODEL-BINDING-CONTRACT-
// V1 makes FIL facets the SOLE data-access path. The `Valuable` facet
// (`v2-core/fil-facets/facets.ts`) is interface-only; its `value(): Revaluation
// Record` is the typed access path to a position's mark. This module is the
// v1-side reader that MATERIALISES that facet output from the existing
// `*Revalued` events-of-record — the model reads the revaluation record through
// the facet's `RevaluationRecord` abstraction, never an ad-hoc store walk on the
// instrument. It does NOT author MtM (out of scope) — it READS the canonical
// `*Revalued` event-of-record (Principle 1).
//
// BOUNDARY: this is a V1-SIDE file (under `platform/`), so it MAY import v2-core
// (the permitted v1→v2 direction; `recon:v2-no-v1-import` forbids only v2→v1).
//
// Authority: D-MODEL-BINDING-CONTRACT-V1 (FIL facets sole data-access path);
//   D-W4-MODEL-LIBRARY-PILOT; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
//   BCBS-SA-CCR-CRE52 §52.10–52.18 (RC = f(V, C)); Principle 1.
// Author: Rohan (Risk Engineer, engineering).

import type { Instant, Money as V2Money } from "../../../v2-core/fil-core/primitives";
import type { ObservableRef, RevaluationRecord } from "../../../v2-core/fil-facets/facets";
import { getCollateralInventory } from "../../collateral/inventory";
import type { EventStore } from "../../event-store/store";
import { minorBigintToMajorString, v2MoneyToMinor } from "./v2-money-bridge";

// ---------------------------------------------------------------------------
// The trade → counterparty membership for a netting set, reconstructed from the
// booking events as-of the RC date. SA-CCR netting sets are single-currency
// (Credit Risk Policy §3 line 132); a netting set is a (counterparty, currency)
// pair, so MTM membership is the counterparty's trades in the netting-set ccy.
// ---------------------------------------------------------------------------

function counterpartyTradeIds(
  store: EventStore,
  counterpartyId: string,
  asOf: string,
): Set<string> {
  const tradeIds = new Set<string>();
  for (const t of ["IrsTradeBooked", "FxTradeExecuted"] as const) {
    for (const ev of store.replay({ type: t, asOf })) {
      const p = ev.payload as {
        tradeId?: { value?: string } | string;
        counterparty?: { partyId?: string };
      };
      if (p.counterparty?.partyId !== counterpartyId) continue;
      const tid = typeof p.tradeId === "string" ? p.tradeId : (p.tradeId?.value ?? undefined);
      if (tid) tradeIds.add(tid);
    }
  }
  return tradeIds;
}

// ---------------------------------------------------------------------------
// `Valuable`-facet materialisation: the LATEST `*Revalued` event-of-record per
// trade, as-of the RC date, projected into the facet's `RevaluationRecord`
// shape. This is the typed access path the SA-CCR model binds to for MTM.
//
// Both revaluation families carry the open position's CURRENT mark-to-market on
// the LATEST event (FX: `unrealisedPnlZarMinor` is the open position's unrealised
// P&L at the reval rate; IRS: `npvClosingMinor` is the closing NPV). The
// event-of-record answer is therefore LAST-WRITE-WINS per trade — never a sum of
// successive revals (which would double-count the cumulative mark).
// ---------------------------------------------------------------------------

/** A per-trade revaluation record sourced from the `*Revalued` event-of-record. */
export interface TradeRevaluation {
  readonly tradeId: string;
  /** The `Valuable` facet output for this trade as-of the RC date. */
  readonly record: RevaluationRecord;
}

function fxObservable(currencyPair: string): ObservableRef {
  return { observableId: `fx:fixing:${currencyPair}`, kind: "fixing" };
}

function irObservable(currency: string): ObservableRef {
  return { observableId: `ir:curve:${currency}`, kind: "curve" };
}

/**
 * Materialise the `Valuable` facet output (a `RevaluationRecord`) for each trade
 * in a netting set, reading the LATEST `*Revalued` event-of-record per trade
 * as-of the RC date. FX revaluations only contribute to ZAR netting sets
 * (`FxPositionRevalued` is ZAR-denominated by schema); IRS revaluations
 * contribute only when their `currency` matches the netting-set currency
 * (single-currency netting set). Returns one record per trade that has a
 * revaluation as-of the date.
 */
export function materialiseNettingSetRevaluations(
  store: EventStore,
  args: { counterpartyId: string; currency: string; asOf: string },
): TradeRevaluation[] {
  const { counterpartyId, currency, asOf } = args;
  const tradeIds = counterpartyTradeIds(store, counterpartyId, asOf);
  if (tradeIds.size === 0) return [];

  // Latest event-of-record per trade, keyed by trade. We hold the FULL record
  // (mark + as_of + observables) so the facet output carries its lineage.
  const latest = new Map<string, RevaluationRecord>();

  // IRS — `npvClosingMinor` is the signed closing NPV (event-of-record mark).
  for (const ev of store.replay({ type: "IrdSwapPositionRevalued", asOf })) {
    const p = ev.payload as { tradeId?: string; npvClosingMinor?: number; currency?: string };
    const tid = typeof p.tradeId === "string" ? p.tradeId : undefined;
    if (!tid || !tradeIds.has(tid)) continue;
    if (typeof p.npvClosingMinor !== "number") continue;
    if (p.currency !== currency) continue; // single-currency netting set
    // replay is sequence-ordered (monotone in as_of for revaluations) ⇒
    // last assignment is the latest event-of-record.
    latest.set(tid, {
      value: { currency, amount: minorBigintToMajorString(BigInt(Math.round(p.npvClosingMinor))) },
      asOf: ev.as_of as Instant,
      observablesUsed: [irObservable(currency)],
    });
  }

  // FX — `unrealisedPnlZarMinor` is the open position's unrealised P&L at the
  // reval rate (a FULL mark, NOT a delta). ZAR netting sets only.
  if (currency === "ZAR") {
    for (const ev of store.replay({ type: "FxPositionRevalued", asOf })) {
      const p = ev.payload as {
        tradeId?: string;
        unrealisedPnlZarMinor?: number;
        currencyPair?: string;
      };
      const tid = typeof p.tradeId === "string" ? p.tradeId : undefined;
      if (!tid || !tradeIds.has(tid)) continue;
      if (typeof p.unrealisedPnlZarMinor !== "number") continue;
      latest.set(tid, {
        value: {
          currency: "ZAR",
          amount: minorBigintToMajorString(BigInt(Math.round(p.unrealisedPnlZarMinor))),
        },
        asOf: ev.as_of as Instant,
        observablesUsed: [fxObservable(p.currencyPair ?? "?/ZAR")],
      });
    }
  }

  const out: TradeRevaluation[] = [];
  for (const [tradeId, record] of latest) out.push({ tradeId, record });
  // Deterministic order (tradeId) — independent of store-walk order.
  out.sort((a, b) => a.tradeId.localeCompare(b.tradeId));
  return out;
}

/**
 * Source the per-netting-set `vMtm` from the `Valuable` feed — the SUM of the
 * latest per-trade `*Revalued` event-of-record marks, as-of the RC date. This
 * is the FIL-mediated MTM the SA-CCR v2 model consumes, replacing the externally
 * pinned recorded-RC value.
 */
export function sourceVMtmFromValuableFeed(
  store: EventStore,
  args: { counterpartyId: string; currency: string; asOf: string },
): V2Money {
  const revals = materialiseNettingSetRevaluations(store, args);
  let total = 0n;
  for (const r of revals) total += v2MoneyToMinor(r.record.value);
  return { currency: args.currency, amount: minorBigintToMajorString(total) };
}

// ---------------------------------------------------------------------------
// Collateral feed — read the collateral-inventory register as-of the RC date.
// Mirrors v1 `resolveCollateral`: the build-phase inventory is a bank-level ZAR
// pool (per-netting-set CSA allocation is D-CSA-COLLATERAL-ALLOCATION, future),
// so the haircut-adjusted ZAR total is returned for ZAR netting sets, zero
// otherwise. The inventory carries MAJOR-currency rand; SA-CCR uses minor.
// ---------------------------------------------------------------------------

/**
 * Source the per-netting-set `collateral` from the collateral register, as-of
 * the RC date. FIL-mediated: the register (a Principle-1 projection over the
 * collateral events) is the SA-CCR model's `collateral-inventory` reference data.
 */
export function sourceCollateralFromRegister(args: {
  currency: string;
  asOf: string;
}): V2Money {
  const { currency, asOf } = args;
  if (currency !== "ZAR") return { currency, amount: "0" };
  const inv = getCollateralInventory(asOf);
  const minorUnits = BigInt(Math.round(inv.totalHQLAZar * 100)); // major rand → minor cents
  return { currency, amount: minorBigintToMajorString(minorUnits) };
}
