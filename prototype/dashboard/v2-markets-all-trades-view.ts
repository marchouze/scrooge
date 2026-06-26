// dashboard/v2-markets-all-trades-view.ts
//
// V2 boundary DTO for the ALL-TRADES blotter surface (`/api/v2/markets/trades`).
//
// One unified, provenance-filtered view of every trade the bank has booked
// across instrument families — FX, listed equity, listed bond, and OTC IRS —
// newest first. Distinct from the per-family surfaces:
//   - /api/v2/markets/fx/trades   — FX-only history (FIL fold).
//   - /api/v2/markets/fx/blotter  — FX-only LIVE positions.
// This is the cross-family roll-up the "all trades" page reads.
//
// CANONICAL SOURCES (Charter cmd 4 — source, don't hardcode; Principle 1):
//   - FX:     FilInstrument* lifecycle via buildV2FxTradeHistoryView (FIL fold).
//   - Equity: EquityTradeBooked (markets/cdm/equity).
//   - Bond:   BondTradeExecuted (event-store/event-types/bond-accounting).
//   - IRS:    IrsTradeBooked (markets/cdm/ird).
// Every family read is provenance-filtered (eventMatchesProvenanceFilter), so a
// `production-only` lens is honestly empty pre-licence-day and `combined` admits
// the simulated cohort — never a silent clean zero (D-V2-UI-VISIBILITY-REMEDIATION).
//
// HONEST GAP (Charter cmd 5 — no silent deferral): money-market deals (call /
// term deposits, repo) are not yet a typed trade family in the event store. The
// view surfaces this as `mmNote` rather than silently omitting the asset class.
//
// NAME-FREE (feedback_no_agent_names_in_ui): counterparty ids are LEIs / sim
// identities (CP-SIM-*), not agent names; no seatTitle mapping is required.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION; D-V2-UI-OVERSIGHT-STANDARD;
//   D-MARKETS-SCHEMA-FOUNDATION; D-FINANCIAL-INSTRUMENT-ENTITY; Principle 1; Principle 6.

import type { BondTradeExecutedPayload } from "../platform/event-store/event-types/bond-accounting";
import type { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import type { IrsTradeBookedPayload } from "../platform/markets/cdm/ird";
import {
  type ProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../platform/projections/filter";
import type { EquityTradeBookedEvent } from "../platform/projections/markets/types";
import { buildV2FxTradeHistoryView } from "./v2-markets-fx-trades-view";

export type TradeFamily = "fx" | "equity" | "bond" | "irs";

export type AllTradesDataState = "live" | "empty";

/** One trade in the cross-family blotter, formatted family-natively. */
export interface AllTradesRow {
  readonly family: TradeFamily;
  /** Display label for the family ("FX" / "Equity" / "Bond" / "IRS"). */
  readonly familyLabel: string;
  readonly tradeId: string;
  /** Trade (booking) date — ISO date or timestamp; used for sort + display. */
  readonly tradeDate: string;
  /** Booking legal entity (P5). "—" where the source fold does not expose it. */
  readonly entity: string;
  /** Instrument label — currency pair / ISIN / ticker / IRS index. */
  readonly instrument: string;
  /** Bank-side direction, family-native (buy/sell or pay-fixed/receive-fixed). */
  readonly side: string;
  /** Size, formatted with its native unit (notional, shares, nominal). */
  readonly quantityLabel: string;
  /** Price / rate, formatted with its native unit (rate legs, %, fixed rate). */
  readonly priceLabel: string;
  readonly currency: string;
  readonly counterpartyId: string;
  /** Lifecycle status (FX) or "booked" (point-in-time families). */
  readonly status: string;
  readonly settlementDate: string;
  /** Source event_id — audit pin ("—" for FX rows folded from the FIL register). */
  readonly sourceEventId: string;
  /** Drill-through to a detail page, when one exists for the family. */
  readonly drillHref: string | null;
}

export interface AllTradesView {
  readonly dataState: AllTradesDataState;
  readonly reason: string;
  readonly count: number;
  readonly byFamily: Record<TradeFamily, number>;
  /** Distinct statuses present, for the status filter dropdown. */
  readonly statuses: readonly string[];
  /** Distinct entities present (excluding "—"), for the entity filter dropdown. */
  readonly entities: readonly string[];
  /** Honest note on the money-market trade-family gap (Charter cmd 5). */
  readonly mmNote: string;
  readonly rows: readonly AllTradesRow[];
}

const FAMILY_LABELS: Record<TradeFamily, string> = {
  fx: "FX",
  equity: "Equity",
  bond: "Bond",
  irs: "IRS",
};

/**
 * Format a numeric amount with thousands separators and a fixed number of
 * decimal places. Locale-independent (deterministic for tests / recon).
 */
function fmtAmount(value: number, dp = 2): string {
  const fixed = value.toFixed(dp);
  const [intPart, frac] = fixed.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}

/**
 * Render a minor-unit (cents) integer money amount as major units with its
 * currency. Pure integer/string formatting — the decimal point is inserted
 * positionally (last two digits are the fractional part), never by float
 * division. Charter: no float multiply/divide on money
 * (D-DECIMAL-NATIVE-MONEY-ARITHMETIC; WS-DECIMAL-NATIVE-MONEY-ARITHMETIC).
 */
function majorFromMinor(amountMinor: number, currency: string): string {
  const raw = String(Math.trunc(amountMinor));
  const neg = raw.startsWith("-");
  const digits = (neg ? raw.slice(1) : raw).padStart(3, "0");
  const intPart = digits.slice(0, -2);
  const frac = digits.slice(-2);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}.${frac} ${currency}`;
}

export interface BuildAllTradesArgs {
  readonly eventStore: EventStore;
  readonly filter: ProvenanceFilter;
}

/** Safe replay of one event type — a family absent from the store folds to []. */
function replayTyped(store: EventStore, type: string, filter: ProvenanceFilter): Event[] {
  const out: Event[] = [];
  try {
    for (const e of store.replay({ type })) {
      if (!eventMatchesProvenanceFilter(e, filter)) continue;
      out.push(e);
    }
  } catch {
    // Family not registered in this store — conservative empty fold.
  }
  return out;
}

/**
 * Build the cross-family all-trades blotter under the active provenance lens.
 */
export function buildV2AllTradesView(args: BuildAllTradesArgs): AllTradesView {
  const { eventStore, filter } = args;
  const rows: AllTradesRow[] = [];

  // ---- FX: reuse the canonical FIL-fold history view (already prov-filtered).
  const fx = buildV2FxTradeHistoryView({ eventStore, filter });
  for (const r of fx.rows) {
    const legs =
      r.buy && r.sell
        ? `buy ${r.buy.amount} ${r.buy.currency} · sell ${r.sell.amount} ${r.sell.currency}`
        : "—";
    rows.push({
      family: "fx",
      familyLabel: FAMILY_LABELS.fx,
      tradeId: r.tradeId,
      tradeDate: r.tradeDate,
      entity: "—",
      instrument: r.pair,
      side: r.side,
      quantityLabel: `${r.notional.amount} ${r.notional.currency}`,
      priceLabel: legs,
      currency: r.notional.currency,
      counterpartyId: r.counterpartyId,
      status: r.status,
      settlementDate: r.settlementDate,
      sourceEventId: "—",
      drillHref: `/v2/markets/instrument.html?id=${encodeURIComponent(r.instance)}`,
    });
  }

  // ---- Equity: EquityTradeBooked.
  for (const e of replayTyped(eventStore, "EquityTradeBooked", filter)) {
    const p = (e as EquityTradeBookedEvent).payload;
    rows.push({
      family: "equity",
      familyLabel: FAMILY_LABELS.equity,
      tradeId: p.tradeId.value,
      tradeDate: p.tradeDate.iso,
      entity: e.entity,
      instrument: p.instrument.identifier.value,
      side: p.side,
      quantityLabel: `${fmtAmount(p.quantity.amount, 0)} sh`,
      priceLabel: `${fmtAmount(p.price.amount)} ${p.consideration.currency}`,
      currency: p.consideration.currency,
      counterpartyId: p.counterparty.partyId,
      status: "booked",
      settlementDate: p.settlementDate.iso,
      sourceEventId: e.event_id,
      drillHref: null,
    });
  }

  // ---- Bond: BondTradeExecuted (flat store-wired schema).
  for (const e of replayTyped(eventStore, "BondTradeExecuted", filter)) {
    const p = e.payload as BondTradeExecutedPayload;
    const book = p.bookDesignation ?? (p.portfolio === "trading-book" ? "trading" : "banking");
    rows.push({
      family: "bond",
      familyLabel: FAMILY_LABELS.bond,
      tradeId: p.tradeId,
      tradeDate: p.executedAt,
      entity: e.entity,
      instrument: `${p.bondIsin} · ${book} book`,
      side: p.side,
      quantityLabel: `${majorFromMinor(p.nominalMinor, p.currency)} nom`,
      priceLabel: `${fmtAmount(p.cleanPricePercent)}% clean`,
      currency: p.currency,
      counterpartyId: p.counterpartyLei,
      status: "booked",
      settlementDate: p.settlementDate,
      sourceEventId: e.event_id,
      drillHref: null,
    });
  }

  // ---- IRS: IrsTradeBooked (OTC swap).
  for (const e of replayTyped(eventStore, "IrsTradeBooked", filter)) {
    const p = e.payload as IrsTradeBookedPayload;
    rows.push({
      family: "irs",
      familyLabel: FAMILY_LABELS.irs,
      tradeId: p.tradeId.value,
      tradeDate: p.tradeDate.iso,
      entity: e.entity,
      instrument: `IRS · ${p.floatingIndex}`,
      side: p.bankPays === "fixed" ? "pay-fixed" : "receive-fixed",
      quantityLabel: majorFromMinor(p.notional.amountMinor, p.notional.currency),
      priceLabel: `${fmtAmount(p.fixedRate * 100)}% fixed`,
      currency: p.notional.currency,
      counterpartyId: p.counterparty.partyId,
      status: "booked",
      settlementDate: p.maturityDate.iso,
      sourceEventId: e.event_id,
      drillHref: null,
    });
  }

  // Newest first; tie-break on (family, tradeId) for replay determinism.
  rows.sort((a, b) => {
    if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? 1 : -1;
    if (a.family !== b.family) return a.family < b.family ? -1 : 1;
    return a.tradeId.localeCompare(b.tradeId);
  });

  const byFamily: Record<TradeFamily, number> = { fx: 0, equity: 0, bond: 0, irs: 0 };
  const statusSet = new Set<string>();
  const entitySet = new Set<string>();
  for (const r of rows) {
    byFamily[r.family] += 1;
    statusSet.add(r.status);
    if (r.entity !== "—") entitySet.add(r.entity);
  }

  const dataState: AllTradesDataState = rows.length > 0 ? "live" : "empty";
  const reason =
    dataState === "empty"
      ? filter.mode === "combined"
        ? "No trades folded under the +Sim lens — no simulated trades in this store."
        : "No real trades in the build phase (no live counterparties pre-licence-day). Switch to + Sim to view the demonstration cohort. Honest empty state, not a clean zero."
      : "";

  return {
    dataState,
    reason,
    count: rows.length,
    byFamily,
    statuses: [...statusSet].sort(),
    entities: [...entitySet].sort(),
    mmNote:
      "Money-market deals (call / term deposits, repo) are not yet a typed trade family in the event store. They will appear here once the MM trade events land — tracked gap, not a silent omission.",
    rows,
  };
}
