// platform/markets/settlement/fx-maturity-gate.ts
//
// SUT-side FX VALUE-DATE maturity gate — the unsettled-commitment carry.
//
// An FX OUTRIGHT FORWARD is an agreement struck on the TRADE DATE to exchange
// currency on a FUTURE VALUE DATE (settlementDate > spot). Between trade date and
// value date the trade is carried as an UNSETTLED COMMITMENT: the FX FIL
// instrument is `active` (it stands as an open position that the EOD revaluation
// marks to the forward curve), but NO cash has changed hands — settlement, and
// the Cash-materialisation it triggers, MUST NOT fire until the value date.
//
// The spot pilot's settlement primitive (`settleFxLeg`) is value-date-AGNOSTIC:
// it materialises cash the moment an `FxSimSettlementConfirmed` exists, with no
// regard for the trade's own value date. That is correct for spot (T+2, settled
// once) but WRONG for a forward driven through the same primitive — a forward
// would settle the instant a confirmation is produced, collapsing the carry and
// recognising cash months before the value date.
//
// This module is the missing gate: a PURE, store-reading predicate that answers
// "has this FX instrument reached its value date as-of <date>?" by reading the
// instrument's OWN `economicTerms.settlementDate` (the static maturity anchor —
// the value date, NOT the trade date). The settlement driver asks this gate
// before driving settlement; a forward that has not reached its value date is
// carried (no settlement, no cash), exactly as the spot pilot's primitives
// generalise once a future value date is honoured.
//
// FAIL-CLOSED: an instrument whose value date cannot be read (missing/garbled
// `settlementDate`) is treated as NOT matured — the bank never recognises a
// settlement it cannot date. A spot and a forward run through the SAME gate; the
// only difference is the value date each carries.
//
// BOUNDARY: SUT-side platform file. Reads the v2 FIL economic terms off the
// shared event store; emits NOTHING (a pure read). No v1 import; no new event
// type. Reuses the spot pilot's settlement + Cash-materialisation primitives —
// this gate only decides WHEN they may fire for a future-value-date trade.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1 (maturity → cash materialisation is product-driven);
//   D-FIL-FRAMEWORK-UNIFICATION; Principle 1 (events are truth).
// Author: Kai (Trading systems engineer, engineering).

import type { EventStore } from "../../event-store/store";

/** ISO-8601 calendar date (YYYY-MM-DD). The value-date comparison is by date. */
export type IsoDate = string;

/**
 * The maturity facts of one open FX instrument, read off its FIL economic terms.
 * `valueDate` is the instrument's OWN `economicTerms.settlementDate` — the static
 * maturity anchor (the forward value date), never the trade date.
 */
export interface FxInstrumentMaturity {
  /** The FX FIL instance URN. */
  readonly instance: string;
  /** The originating trade id (the instance-id portion of the URN). */
  readonly tradeId: string;
  /** The value date (settlement/maturity date) read off the instrument. */
  readonly valueDate: IsoDate;
  /** Whether the instrument is still open (created, not yet terminated). */
  readonly open: boolean;
}

/**
 * Reduce an arbitrary ISO date-or-instant to its calendar date (YYYY-MM-DD). The
 * value-date comparison is a DATE comparison (a trade matures ON its value date,
 * irrespective of the intraday settlement instant). Returns `undefined` for an
 * unparseable input so the caller fails closed (never matures an undateable
 * trade).
 */
export function toCalendarDate(isoDateOrInstant: string): IsoDate | undefined {
  const trimmed = isoDateOrInstant.trim();
  if (trimmed.length === 0) return undefined;
  // A bare YYYY-MM-DD is taken verbatim; an instant is truncated at the T.
  const datePart = trimmed.includes("T") ? trimmed.slice(0, trimmed.indexOf("T")) : trimmed;
  // Validate the date is real (Date.parse on the date part, UTC-anchored).
  if (Number.isNaN(Date.parse(`${datePart}T00:00:00.000Z`))) return undefined;
  // Canonical YYYY-MM-DD shape check (fail closed on anything else).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return undefined;
  return datePart;
}

/**
 * Read every FX FIL instrument's maturity facts off the store. Folds
 * `FilInstrumentCreated` (assetClass "fx") for the value date + open state, and
 * `FilInstrumentTerminated` to close the open flag. Instruments with no readable
 * value date are DROPPED here (the caller never sees an undateable instrument as
 * matured — fail closed).
 */
export function readFxInstrumentMaturities(store: EventStore): FxInstrumentMaturity[] {
  const terminated = new Set<string>();
  for (const e of store.replay({ type: "FilInstrumentTerminated" })) {
    const instance = (e.payload as { instance?: string }).instance;
    if (instance) terminated.add(instance);
  }

  const out: FxInstrumentMaturity[] = [];
  for (const e of store.replay({ type: "FilInstrumentCreated" })) {
    const payload = e.payload as {
      instance?: string;
      economicTerms?: { assetClass?: string; settlementDate?: string };
    };
    const instance = payload.instance;
    const econ = payload.economicTerms;
    if (!instance || !econ || econ.assetClass !== "fx") continue;
    if (typeof econ.settlementDate !== "string") continue;
    const valueDate = toCalendarDate(econ.settlementDate);
    if (!valueDate) continue; // fail closed — never mature an undateable trade.
    out.push({
      instance,
      tradeId: tradeIdFromInstance(instance),
      valueDate,
      open: !terminated.has(instance),
    });
  }
  return out;
}

/**
 * Has the FX instrument reached its value date as-of `asOfDate`? An instrument
 * matures ON its value date — i.e. `asOfDate >= valueDate` (date comparison). A
 * forward booked on its trade date with a future value date is NOT matured (and
 * so must be CARRIED as an unsettled commitment) until `asOfDate` reaches the
 * value date. A spot (T+2) is matured on its T+2 value date the same way.
 *
 * PURE — string date comparison (ISO dates sort lexicographically).
 */
export function hasReachedValueDate(maturity: FxInstrumentMaturity, asOfDate: IsoDate): boolean {
  const asOf = toCalendarDate(asOfDate);
  if (!asOf) return false; // fail closed — cannot date the as-of → never matured.
  return asOf >= maturity.valueDate;
}

/**
 * The set of OPEN FX instrument ids that have reached their value date as-of
 * `asOfDate` — i.e. those the settlement driver MAY now settle. A forward whose
 * value date is still in the future is excluded (carried as an unsettled
 * commitment); a spot whose T+2 value date has arrived is included. Already-
 * terminated (settled) instruments are excluded (idempotent — no double-settle).
 */
export function maturedOpenFxTradeIds(store: EventStore, asOfDate: IsoDate): Set<string> {
  const ids = new Set<string>();
  for (const m of readFxInstrumentMaturities(store)) {
    if (!m.open) continue;
    if (hasReachedValueDate(m, asOfDate)) ids.add(m.tradeId);
  }
  return ids;
}

/**
 * Is the given trade an OPEN forward (or any FX instrument) that has NOT yet
 * reached its value date as-of `asOfDate` — i.e. is it still carried as an
 * unsettled commitment? Useful for asserting the carry directly (a forward
 * before its value date is `true`; on/after, `false`).
 */
export function isCarriedUnsettledCommitment(
  store: EventStore,
  tradeId: string,
  asOfDate: IsoDate,
): boolean {
  for (const m of readFxInstrumentMaturities(store)) {
    if (m.tradeId !== tradeId) continue;
    return m.open && !hasReachedValueDate(m, asOfDate);
  }
  return false;
}

/** Recover the trade id (instance-id) from a `fil:inst:<tenant>:<instanceId>` URN. */
function tradeIdFromInstance(instance: string): string {
  const lastColon = instance.lastIndexOf(":");
  return lastColon >= 0 ? instance.slice(lastColon + 1) : instance;
}
