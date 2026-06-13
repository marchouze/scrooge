// platform/risk/sa-ccr/fil-instance-positions.ts
//
// FIL-INSTANCE-SOURCED SA-CCR position feed (WS-V2-BBAAS, FIL-instance
// materialisation). This is the wiring that makes "FIL facets are the sole
// data-access path" (D-MODEL-BINDING-CONTRACT-V1) true for SA-CCR's trade /
// netting-set structure: instead of adapting v1 positions at the v1 boundary
// (`buildFxSaCcrTradeSummaries`), the SA-CCR v2 model's netting-set inputs are
// built from the NATIVE FIL instance projection.
//
// It implements the `RiskMeasurable.positionContribution` selection in concrete
// terms: read the FIL instance lifecycle family from the v2 anchor store, fold
// it as-of (the proper Principle-1 as-of position reconstruction), select the
// LIVE instances, and project each instance's economic terms into the v2
// `SaCcrTradeSummary` shape the methodology consumes — with remaining-maturity
// DERIVED from the instance's settlement date at the query as_of (matching the
// v1 adapter's arithmetic exactly).
//
// BOUNDARY: this is a V1-SIDE file (under `platform/`), so it MAY import v2-core
// (the permitted v1→v2 direction). v2-core never reaches back here.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   BCBS-SA-CCR-CRE52; Principle 1.
// Author: Atlas (Substrate Architect, engineering) · Rohan (Risk Engineer).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRow,
  foldFilInstances,
  liveInstances,
  remainingYears,
} from "../../../v2-core/fil-instances";
import type { SaCcrTradeSummary as V2TradeSummary } from "../../../v2-core/fil-models/sa-ccr";

// ---------------------------------------------------------------------------
// v2 anchor store resolution (mirrors the seed + S4 recon).
// ---------------------------------------------------------------------------

export function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

interface V2Row {
  type: string;
  payload: string;
}

/**
 * Read the FIL instance lifecycle event family from the v2 anchor store and
 * parse each payload into a `FilInstanceLifecycleEvent`. Money minor-units are
 * re-hydrated from the stored JSON number back to bigint (the store holds JSON;
 * the projection wants bigint). Returns [] when the store/table is absent.
 */
export function readFilInstanceEvents(dbPath = resolveV2AnchorDb()): FilInstanceLifecycleEvent[] {
  if (!existsSync(dbPath)) return [];
  let db: Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch {
    return [];
  }
  try {
    const tableExists = db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='v2_events'`,
      )
      .all();
    if (tableExists.length === 0) return [];

    const rows = db
      .query<V2Row, []>(
        `SELECT type, payload FROM v2_events
         WHERE type IN ('FilInstrumentCreated','FilInstrumentAmended','FilInstrumentTerminated')
         ORDER BY sequence ASC`,
      )
      .all();

    const events: FilInstanceLifecycleEvent[] = [];
    for (const r of rows) {
      const p = JSON.parse(r.payload) as Record<string, unknown>;
      const terms = p.economicTerms as { notional?: { minorUnits?: number | string } } | undefined;
      if (terms?.notional && terms.notional.minorUnits !== undefined) {
        terms.notional.minorUnits = BigInt(terms.notional.minorUnits) as unknown as number;
      }
      events.push(p as unknown as FilInstanceLifecycleEvent);
    }
    return events;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Project a live FIL instance row → v2 SaCcrTradeSummary. Remaining-maturity is
// derived from the static settlement date at the query as_of (identical to the
// v1 adapter's `remainingYears`).
// ---------------------------------------------------------------------------

function rowToTradeSummary(row: FilInstanceRow, asOf: string): V2TradeSummary {
  const t = row.economicTerms;
  const tradeId = row.instance.split(":").pop() ?? row.instance;
  return {
    tradeId,
    counterpartyId: t.counterpartyId,
    nettingSetId: t.nettingSetId,
    assetClass: t.assetClass,
    notional: t.notional,
    direction: t.direction,
    remainingYears: remainingYears(t.settlementDate, asOf),
    currency: t.currency,
    ...(t.hedgingSetTag !== undefined ? { hedgingSetTag: t.hedgingSetTag } : {}),
  };
}

export interface FilNettingSetGroup {
  readonly counterpartyId: string;
  readonly currency: string;
  readonly trades: V2TradeSummary[];
}

/**
 * Build SA-CCR netting-set groups from the NATIVE FIL instance projection,
 * as of `asOf`. Live instances only (Principle-1 as-of fold). Grouped by
 * netting-set id. This is the FIL-sourced analogue of the v1
 * `buildFxSaCcrTradeSummaries` adapter — the data-access path now runs through
 * the FIL instance register, not a v1-position adapter.
 */
export function buildSaCcrTradeSummariesFromFilInstances(
  asOf: string,
  events?: FilInstanceLifecycleEvent[],
): Map<string, FilNettingSetGroup> {
  const all = events ?? readFilInstanceEvents();
  const register = foldFilInstances(all, asOf);
  const groups = new Map<string, FilNettingSetGroup>();

  for (const row of liveInstances(register)) {
    const summary = rowToTradeSummary(row, asOf);
    const key = summary.nettingSetId;
    const grp = groups.get(key);
    if (grp) grp.trades.push(summary);
    else
      groups.set(key, {
        counterpartyId: summary.counterpartyId,
        // economic-terms currency is required (string); summary.currency is the
        // optional model field — use the row's required currency for the group key.
        currency: row.economicTerms.currency,
        trades: [summary],
      });
  }

  // Deterministic trade order within each group — match the v1 store-order walk
  // (FxTradeExecuted ASC). The FIL events are read in store order; liveInstances
  // iterates Map insertion order, which follows creation order. Stable.
  return groups;
}
