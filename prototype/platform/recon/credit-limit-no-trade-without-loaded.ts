// platform/recon/credit-limit-no-trade-without-loaded.ts
//
// Vera continuous-controls pipeline: assert that every counterparty with a
// trade event has a prior `CreditLimitLoaded` event for that same
// counterparty.
//
// Surface set:
//   - `TradeBooked`                          (markets-trading-extended)
//   - `TradeExecuted`                        (markets-trading-extended; SA-CCR
//                                             attracts pre-settlement exposure)
//   - `FxTradeExecuted`                      (CDM FX; trade is risk-attracting
//                                             at execution before settlement)
//   - `FxTradeBooked`                        (FX accounting)
//   - `OrderFilled`                          (markets-trading-extended)
//
// `OrderAccepted` is named in the brief but does not exist in the current
// event-type registry — substrate gap noted in the brief; not enforced here.
//
// Rule: for each counterparty referenced on any of the above events with
// `as_of = T`, there must be a `CreditLimitLoaded` event for the same
// counterparty with `as_of <= T` (i.e. loaded before the first risk-attracting
// trade). A missing prior load is a Critical finding under Credit Risk Policy
// §1.4 + §7 (line 255).
//
// Empty-state correctness: no CreditLimitLoaded events have ever been emitted
// on `main`; absence-of-trades + absence-of-loads on a fresh bench returns
// `ok: true` with zero violations (matches the conduct-surveillance-coverage
// pattern).
//
// Independence: reads from the shared event store via `eventStore.replay`;
// does NOT import `@platform/risk/credit-limit-engine` (Atlas's concurrent
// build — see brief).
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
// Citations:
//   Policies/credit-risk-policy-v1.md §1.4 + §7 (line 255 — Vera escalation);
//   Procedures/by-policy/credit-risk-limit-management.md §9 (PROC-RISK-CLM-01);
//   Procedures/by-policy/credit-origination.md §9 (PROC-RISK-CO-01);
//   Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer, third-line —
//   functionally to Thandiwe (Chief Audit Executive, governance);
//   administratively through the CEO).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "credit-limit-no-trade-without-loaded";

/**
 * Risk-attracting trade event types. A counterparty named on any of these
 * MUST have a prior `CreditLimitLoaded`.
 *
 * Survey basis: platform/event-store/event-types/trading.ts +
 * markets-trading-extended.ts + fx-accounting.ts + markets/cdm/fx.ts.
 */
export const TRADE_EVENT_TYPES = [
  "TradeBooked",
  "TradeExecuted",
  "FxTradeExecuted",
  "FxTradeBooked",
  "OrderFilled",
] as const;

export type TradeEventType = (typeof TRADE_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Minimal event shapes (avoid importing full payload types — payload shapes
// across the surface set differ; we extract counterpartyId by best-effort).
// ---------------------------------------------------------------------------

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

export interface RunOpts {
  /**
   * Override the event source — used by tests to feed synthetic events
   * without touching the live event store.
   */
  tradeEvents?: Iterable<MinimalEvent>;
  /**
   * Override the loaded-event source. When provided alongside `tradeEvents`,
   * the recon is fully driven by injected data (no event-store reads).
   */
  loadedEvents?: Iterable<MinimalEvent>;
}

// ---------------------------------------------------------------------------
// Counterparty extraction — payload shapes differ across the surface set.
// ---------------------------------------------------------------------------

/**
 * Best-effort counterparty-id extraction across the trade-event surface set:
 *
 *   - `TradeBooked.payload.counterpartyId`        (markets-trading-extended)
 *   - `TradeExecuted.payload.counterpartyLei`     (markets-trading-extended)
 *   - `FxTradeExecuted.payload.counterparty.partyId` (CDM partySchema)
 *   - `FxTradeBooked.payload.counterpartyId`      (fx-accounting; best effort)
 *   - `OrderFilled.payload.counterpartyId`        (markets-trading-extended)
 *
 * Returns `null` when no counterparty identifier is discoverable; the recon
 * treats `null` as a `info`-severity advisory (cannot be asserted).
 */
export function extractCounterpartyId(payload: Record<string, unknown>): string | null {
  // Direct counterpartyId field (TradeBooked, FxTradeBooked, OrderFilled, etc.)
  const cpid = payload.counterpartyId;
  if (typeof cpid === "string" && cpid.length > 0) return cpid;

  // counterpartyLei (TradeExecuted)
  const lei = payload.counterpartyLei;
  if (typeof lei === "string" && lei.length > 0) return lei;

  // Nested counterparty.partyId (CDM partySchema — FxTradeExecuted)
  const cp = payload.counterparty;
  if (cp && typeof cp === "object") {
    const partyId = (cp as Record<string, unknown>).partyId;
    if (typeof partyId === "string" && partyId.length > 0) return partyId;
  }

  return null;
}

function loadTradeEvents(opts: RunOpts): MinimalEvent[] {
  if (opts.tradeEvents) return [...opts.tradeEvents];
  const out: MinimalEvent[] = [];
  for (const t of TRADE_EVENT_TYPES) {
    for (const e of eventStore.replay({ type: t })) {
      out.push({
        event_id: e.event_id,
        type: e.type,
        as_of: e.as_of,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
    }
  }
  return out;
}

function loadLoadedEvents(opts: RunOpts): MinimalEvent[] {
  if (opts.loadedEvents) return [...opts.loadedEvents];
  const out: MinimalEvent[] = [];
  for (const e of eventStore.replay({ type: "CreditLimitLoaded" })) {
    out.push({
      event_id: e.event_id,
      type: e.type,
      as_of: e.as_of,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pipeline run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const tradeEvents = loadTradeEvents(opts);
  const loadedEvents = loadLoadedEvents(opts);

  // -------------------------------------------------------------------------
  // Build per-counterparty list of `CreditLimitLoaded` timestamps.
  // -------------------------------------------------------------------------
  const loadedTimestamps = new Map<string, string[]>();
  for (const e of loadedEvents) {
    const cpid = e.payload.counterpartyId;
    if (typeof cpid !== "string" || cpid.length === 0) continue;
    const list = loadedTimestamps.get(cpid) ?? [];
    list.push(e.as_of);
    loadedTimestamps.set(cpid, list);
  }

  // -------------------------------------------------------------------------
  // Empty-state guard: no trades AND no loads → pass (clean bench).
  // -------------------------------------------------------------------------
  if (tradeEvents.length === 0 && loadedEvents.length === 0) {
    result.asserted = 1;
    result.ok = true;
    return result;
  }

  // -------------------------------------------------------------------------
  // For every trade event, assert a prior CreditLimitLoaded exists.
  // -------------------------------------------------------------------------
  for (const trade of tradeEvents) {
    result.asserted++;

    const cpid = extractCounterpartyId(trade.payload);
    if (cpid === null) {
      // Surface as advisory — recon cannot assert without a counterparty id.
      violations.push({
        subject: `${trade.type}:${trade.event_id}`,
        severity: "info",
        message:
          `Trade event ${trade.type}:${trade.event_id} carries no extractable counterpartyId ` +
          `(checked payload.counterpartyId, payload.counterpartyLei, payload.counterparty.partyId). ` +
          `Cannot assert credit-limit-loaded precondition. ` +
          `Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Policies/credit-risk-policy-v1.md §1.4.`,
      });
      continue;
    }

    const loaded = loadedTimestamps.get(cpid);
    if (!loaded || loaded.length === 0) {
      violations.push({
        subject: `${cpid}:${trade.type}:${trade.event_id}`,
        severity: "fail",
        message:
          `${trade.type} event ${trade.event_id} (as_of=${trade.as_of}) names counterparty ` +
          `"${cpid}" but NO CreditLimitLoaded event exists for this counterparty in the ` +
          `event store. Pre-trade limit-load is mandatory under PROC-RISK-CO-01 Step 6 ` +
          `before any risk-attracting trade may be booked. Critical finding per ` +
          `Policies/credit-risk-policy-v1.md §7 (line 255). Remediation: emit ` +
          `CreditLimitLoaded({ counterpartyId, limit, currency, effectiveFrom }) before ` +
          `the trade or unwind the trade. Authority: D-CREDIT-LIMIT-ENGINE-BUILD; ` +
          `Procedures/by-policy/credit-origination.md §9 (PROC-RISK-CO-01 Step 6).`,
      });
      continue;
    }

    // At least one load exists; assert at least one occurred at-or-before
    // the trade timestamp.
    const tradeAsOf = trade.as_of;
    const priorLoadExists = loaded.some((ts) => ts <= tradeAsOf);
    if (!priorLoadExists) {
      const earliestLoad = loaded.reduce((min, ts) => (ts < min ? ts : min), loaded[0] as string);
      violations.push({
        subject: `${cpid}:${trade.type}:${trade.event_id}`,
        severity: "fail",
        message:
          `${trade.type} event ${trade.event_id} (as_of=${tradeAsOf}) for counterparty ` +
          `"${cpid}" precedes the earliest CreditLimitLoaded (as_of=${earliestLoad}) by ` +
          `${tradeAsOf} < ${earliestLoad}. Trade booked before limit loaded — Critical ` +
          `finding under Policies/credit-risk-policy-v1.md §7 (line 255). Authority: ` +
          `D-CREDIT-LIMIT-ENGINE-BUILD; PROC-RISK-CO-01 Step 6.`,
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "credit-limit-no-trade-without-loaded passed — every trade has a prior CreditLimitLoaded for the counterparty."
        : "credit-limit-no-trade-without-loaded FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
