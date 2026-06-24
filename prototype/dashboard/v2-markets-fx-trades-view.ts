// dashboard/v2-markets-fx-trades-view.ts
//
// V2 boundary DTO for the FX TRADE HISTORY surface (`/api/v2/markets/fx/trades`).
// Unlike the live blotter (positions.html → /api/v2/markets/fx/blotter, which
// shows only LIVE/open FIL FX instances), this is the full trade history: every FX
// trade ever booked — open, settled, cancelled — folded from the FIL register,
// newest first, with its lifecycle status and the symmetric buy/sell quad.
//
// CANONICAL SOURCE (Charter cmd 4): the FIL instance lifecycle family
// (FilInstrumentCreated / …Amended / …Terminated) folded by `foldFilInstances`
// (v2-core/fil-instances) — the SAME replay-derived register the blotter, BA-320,
// and daily-P&L engines read (Principle 1). Provenance-filtered: a `production-only`
// lens is honestly empty pre-licence; `combined` admits the simulated cohort.
//
// NAME-FREE (feedback_no_agent_names_in_ui): counterparty ids (CP-SIM-*) are
// simulated identities, not agent names; no `seatTitle` mapping is required.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION; D-V2-UI-OVERSIGHT-STANDARD;
//   D-FX-INSTRUMENT-BUYSELL-QUAD; Principle 1; Principle 6.

import type { EventStore } from "../platform/event-store/store";
import {
  type ProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../platform/projections/filter";
import { type FilInstanceRow, foldFilInstances } from "../v2-core/fil-instances/projection";

export type FxTradeHistoryDataState = "live" | "empty";

/** A money leg of the symmetric FX agreement quad. */
export interface FxLeg {
  readonly currency: string;
  readonly amount: string;
}

/** One FX trade in the history (open / settled / cancelled). */
export interface FxTradeHistoryRow {
  readonly tradeId: string;
  readonly instance: string;
  /** Trade (booking) date — the creation event's asOf. */
  readonly tradeDate: string;
  readonly counterpartyId: string;
  readonly pair: string;
  /** Bank-side direction: buy (long the base) / sell (short the base). */
  readonly side: "buy" | "sell";
  /** Base-currency notional (the instrument currency). */
  readonly notional: FxLeg;
  /** Bought leg of the agreement quad (D-FX-INSTRUMENT-BUYSELL-QUAD), when present. */
  readonly buy: FxLeg | null;
  /** Sold leg of the agreement quad, when present. */
  readonly sell: FxLeg | null;
  readonly settlementDate: string;
  /** Lifecycle status: open / settled / cancelled / matured / terminated. */
  readonly status: string;
  /** Raw FIL stage. */
  readonly stage: string;
}

export interface FxTradeHistoryView {
  readonly dataState: FxTradeHistoryDataState;
  readonly reason: string;
  readonly count: number;
  readonly openCount: number;
  readonly settledCount: number;
  readonly otherCount: number;
  readonly rows: readonly FxTradeHistoryRow[];
}

const FX_LIFECYCLE_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

/** Map a FIL lifecycle stage to a trade-history status label. */
function statusOf(stage: string): string {
  if (stage === "active") return "open";
  return stage; // settled | cancelled | matured | terminated
}

function legOf(money: { currency?: string; amount?: string } | undefined): FxLeg | null {
  if (!money || typeof money.currency !== "string" || typeof money.amount !== "string") return null;
  return { currency: money.currency, amount: money.amount };
}

export interface BuildFxTradeHistoryArgs {
  readonly eventStore: EventStore;
  readonly filter: ProvenanceFilter;
}

/**
 * Build the FX trade-history view under the active provenance lens. Folds the FIL
 * lifecycle family (provenance-filtered) into the full register, keeps the FX
 * instances (open + closed), and maps each to a history row, newest trade first.
 */
export function buildV2FxTradeHistoryView(args: BuildFxTradeHistoryArgs): FxTradeHistoryView {
  const { eventStore, filter } = args;

  const payloads: unknown[] = [];
  for (const type of FX_LIFECYCLE_EVENT_TYPES) {
    try {
      for (const e of eventStore.replay({ type })) {
        if (!eventMatchesProvenanceFilter(e, filter)) continue;
        payloads.push(e.payload);
      }
    } catch {
      // Family not registered in this store — fold what we have (conservative).
    }
  }

  const register = foldFilInstances(payloads as never);
  const fxRows: FilInstanceRow[] = [...register.values()].filter(
    (r) => r.economicTerms.assetClass === "fx",
  );

  const rows: FxTradeHistoryRow[] = fxRows.map((r) => {
    const t = r.economicTerms as typeof r.economicTerms & {
      fxAgreement?: {
        buy?: { currency?: string; amount?: string };
        sell?: { currency?: string; amount?: string };
      };
    };
    const tradeId = r.instance.split(":").pop() ?? r.instance;
    return {
      tradeId,
      instance: r.instance,
      tradeDate: r.createdAsOf,
      counterpartyId: t.counterpartyId ?? "—",
      pair: t.hedgingSetTag ?? t.currency,
      side: t.direction === "long" ? "buy" : "sell",
      notional: { currency: t.notional.currency, amount: t.notional.amount },
      buy: legOf(t.fxAgreement?.buy),
      sell: legOf(t.fxAgreement?.sell),
      settlementDate: t.settlementDate ?? "—",
      status: statusOf(r.stage),
      stage: r.stage,
    };
  });

  // Newest trade first; tie-break on tradeId for determinism.
  rows.sort((a, b) =>
    a.tradeDate < b.tradeDate
      ? 1
      : a.tradeDate > b.tradeDate
        ? -1
        : a.tradeId.localeCompare(b.tradeId),
  );

  const openCount = rows.filter((r) => r.status === "open").length;
  const settledCount = rows.filter((r) => r.status === "settled").length;
  const otherCount = rows.length - openCount - settledCount;

  const dataState: FxTradeHistoryDataState = rows.length > 0 ? "live" : "empty";
  const reason =
    dataState === "empty"
      ? filter.mode === "combined"
        ? "No FX trades folded under the +Sim lens — no simulated FX trades in this store."
        : "No real FX trades in the build phase (no live counterparties pre-licence-day). Switch to + Sim to view the demonstration FX cohort. Honest empty state, not a clean zero."
      : "";

  return {
    dataState,
    reason,
    count: rows.length,
    openCount,
    settledCount,
    otherCount,
    rows,
  };
}
