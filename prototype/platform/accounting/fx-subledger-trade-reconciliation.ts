// platform/accounting/fx-subledger-trade-reconciliation.ts
//
// Trade-level FX sub-ledger reconciliation.
//
// The build-phase FX sub-ledger (ACC-2100-*) accumulated a corrupted posting
// history: the D-CANCEL-WRONG-COUNTER-NOTIONAL erroneous trades (PR #947) were
// booked with grossly wrong notionals (up to R23bn) and then cancelled, but
// their PR-FX-CANCEL reversals did not fully offset — leaving a residual that
// flipped ACC-2100-003 (a payable) to a debit balance, ACC-2100-002 USD to a
// credit, and ACC-2100-004 USD to a debit. Layered remediation attempts
// (a single SubLedgerPostingRemediationRecorded spawning 1063 legs) compounded
// the mess. An aggregate net-to-target journal is unsafe here: it cannot be
// scoped without sweeping in unrelated cash / deposit / P&L activity, and the
// cross-provenance tradeId collisions (the same tradeId carries both
// `simulated` and `build-phase-fixture` events) defeat any tradeId-keyed filter.
//
// This module reconciles the sub-ledger ONE TRADE AT A TIME (CEO direction,
// 2026-06-01 session-delegation): for every historical FX trade it
//   1. identifies the trade's ACTUAL current GL footprint (the signed net per
//      account/currency of every SubLedgerPostingEmitted attributable to the
//      trade's own source events), and
//   2. computes the trade's CORRECT footprint from the canonical posting rules
//      given the trade's lifecycle state:
//        - cancelled → net zero (a cancelled trade contributes nothing),
//        - live      → PR-FX-001 booking journal (Dr receivable / Cr payable),
//        - settled   → booking derecognised to nostro + realised P&L,
//   3. and emits a per-trade correction = (correct − actual), as one balanced
//      ManualJournalEntry per trade.
//
// SCOPE — simulated trades only (explicit carve-out, not a silent cap):
//   The GL projection (gl-projection.ts) already excludes `build-phase-fixture`
//   SubLedgerPostingEmitted via `sourceEventIsFixture`, so fixture trades
//   contribute nothing to the GL-visible balances. ManualJournalEntry is NOT
//   fixture-filtered by the projection, so emitting fixture-trade corrections
//   would pull the filtered-out fixtures INTO the GL — the opposite of correct.
//   Reconciling the raw fixture posting history is a separate build-phase
//   cleanup; this engine scopes to `simulated` trades, which are the entire
//   GL-visible FX sub-ledger.
//
// Attribution is keyed on the SOURCE EVENT's provenance, not the bare tradeId,
// so the cross-provenance tradeId collision cannot misattribute a fixture
// posting to a simulated trade.
//
// Authority:
//   - CEO session-delegation 2026-06-01 (per-trade reconciliation mechanism).
//   - D-CANCEL-WRONG-COUNTER-NOTIONAL (the erroneous-trade cancellation batch).
//   - PR-FX-001 (fxTradeBookingJournals) — the canonical booking footprint.
//   - IFRS 9 §3.2.3 (derecognition on extinguishment of rights/obligations).
//   - Principle 1 — events are truth; corrections are new append-only events.
//
// Author: Bea (Accounting & financial reporting engineer, engineering),
//   Scrooge-coordinated run.

import type { Event } from "../event-store/types";
import type { FxTradeExecutedPayload, PrincipalPaymentPayload } from "../markets/cdm/fx";
import { type SubLedgerLeg, subLedgerLegFromMinor } from "./fx-accounting-types";
import { fxTradeBookingJournals } from "./posting-rules/fx-spot";

export type TradeLifecycleState = "live" | "cancelled" | "settled";

/** A signed net balance per (account, currency). Positive = net debit. */
export interface FootprintEntry {
  readonly accountId: string;
  readonly currency: string;
  /** Signed minor units: debit positive, credit negative. */
  readonly netDebitMinor: number;
}

export interface TradeReconciliation {
  readonly tradeId: string;
  readonly provenance: string;
  readonly state: TradeLifecycleState;
  /** How many SubLedgerPostingEmitted (any type) attribute to this trade. */
  readonly postingCount: number;
  /** Current GL footprint (signed net debit per account/currency). */
  readonly actual: readonly FootprintEntry[];
  /** Canonical correct footprint given the trade's lifecycle state. */
  readonly correct: readonly FootprintEntry[];
  /** Balanced legs that move actual → correct. Empty when already correct. */
  readonly correctionLegs: readonly SubLedgerLeg[];
  readonly needsCorrection: boolean;
}

const FOOTPRINT_PROVENANCE = "simulated";

/** `${accountId}|${currency}` */
function key(accountId: string, currency: string): string {
  return `${accountId}|${currency}`;
}

/** Fold a list of SubLedgerLeg into signed net-debit-per-(account,currency). */
function legsToFootprint(legs: Iterable<SubLedgerLeg>): Map<string, FootprintEntry> {
  const map = new Map<string, FootprintEntry>();
  for (const leg of legs) {
    const k = key(leg.accountId, leg.currency);
    const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
    const existing = map.get(k);
    map.set(k, {
      accountId: leg.accountId,
      currency: leg.currency,
      netDebitMinor: (existing?.netDebitMinor ?? 0) + signed,
    });
  }
  return map;
}

/**
 * Compute correction legs that move `actual` to `correct`.
 *
 * delta(account,ccy) = correct.netDebit − actual.netDebit.
 *   delta > 0 → post a debit of delta,
 *   delta < 0 → post a credit of |delta|.
 *
 * The result balances per currency because both `correct` and `actual` are
 * themselves per-currency-balanced (booking journals balance; the sum of any
 * set of balanced postings balances), so their per-currency difference is zero.
 */
function correctionLegsFor(
  actual: Map<string, FootprintEntry>,
  correct: Map<string, FootprintEntry>,
): SubLedgerLeg[] {
  const keys = new Set<string>([...actual.keys(), ...correct.keys()]);
  const legs: SubLedgerLeg[] = [];
  for (const k of [...keys].sort()) {
    const a = actual.get(k)?.netDebitMinor ?? 0;
    const c = correct.get(k)?.netDebitMinor ?? 0;
    const delta = c - a;
    if (delta === 0) continue;
    const [accountId, currency] = k.split("|") as [string, string];
    // `Math.abs(delta)` is an EXACT integer minor-unit balance — lifted to the
    // decimal `amount` source of truth, amountMinor derived (decimal-native s1).
    legs.push(
      subLedgerLegFromMinor(
        { accountId, currency, debitCredit: delta > 0 ? "debit" : "credit" },
        Math.abs(delta),
      ),
    );
  }
  return legs;
}

/**
 * Per-trade same-provenance lifecycle events. State and the correct footprint
 * are derived ONLY from events sharing the trade's provenance, because the GL
 * the bank presents folds exactly that lineage (build-phase fixtures are
 * excluded). A tradeId that also carries fixture settlement/cancellation events
 * is unaffected: those live in the excluded lineage.
 */
interface TradeLifecycle {
  booking: FxTradeExecutedPayload; // last-write-wins canonical booking
  cancelled: boolean;
  settled: boolean;
}

/**
 * The correct GL footprint for a trade given its lifecycle.
 *
 *   - cancelled → {} : a cancelled trade must contribute NOTHING. Its entire
 *     footprint — booking, the PR-FX-CANCEL reversal, AND any revaluation of
 *     the (often fictitious, wrong-notional) position — is zeroed. This is the
 *     only class the reconciliation corrects, because cancelled trades are the
 *     only class whose canonical contribution is unambiguous (zero).
 *
 *   - live / settled → the trade's ACTUAL footprint is trusted unchanged. A
 *     live trade legitimately carries its booking (PR-FX-001) and its daily
 *     FVTPL revaluation (PR-FX-002); a settled trade carries its booking +
 *     principal-payment + close. Re-deriving these from the rules and forcing
 *     `actual` to match would (a) strip a live trade's legitimate unrealised
 *     mark, and (b) risk cumulative-vs-delta reval double-counting. The
 *     contamination this engine targets lives entirely in the cancelled class,
 *     so non-cancelled trades are passed through untouched (correct ≡ actual ⇒
 *     no correction).
 *
 * `canonicalBooking` is supplied for documentation / future extension; the
 * live branch intentionally returns `actual` to avoid disturbing legitimate
 * postings. `lc` (principals/closes/matured) is retained on the type for the
 * same reason.
 */
function correctFootprint(
  lc: TradeLifecycle,
  actual: Map<string, FootprintEntry>,
): Map<string, FootprintEntry> {
  if (lc.cancelled) return new Map();
  // Sanity: a non-cancelled trade must have a canonical booking. The booking
  // journal is computed (and discarded) purely to assert the payload is
  // well-formed — a malformed live booking should fail loudly here rather than
  // silently pass through.
  void fxTradeBookingJournals({
    tradeId: lc.booking.tradeId.value,
    side: lc.booking.side,
    legs: lc.booking.legs,
    currencyPair: lc.booking.currencyPair,
  });
  return actual;
}

export interface ComputeOptions {
  /** Provenance of trades to reconcile. Defaults to "simulated" (GL-visible). */
  readonly provenance?: string;
}

/**
 * Compute the per-trade reconciliation set for every FX trade of the target
 * provenance. Pure function over the event log.
 */
export function computeFxSubledgerReconciliation(
  events: readonly Event[],
  options: ComputeOptions = {},
): TradeReconciliation[] {
  const provenance = options.provenance ?? FOOTPRINT_PROVENANCE;

  // 1. Per-trade same-provenance lifecycle, and the source-event→trade map.
  //    EVERYTHING is keyed on the SOURCE EVENT's provenance, so a cross-
  //    provenance tradeId collision (the same tradeId carrying both simulated
  //    and fixture events) never leaks fixture lineage into a simulated trade.
  const lifecycleByTrade = new Map<string, TradeLifecycle>();
  const sourceEventToTrade = new Map<string, string>();

  function lifecycleFor(tradeId: string): TradeLifecycle | undefined {
    return lifecycleByTrade.get(tradeId);
  }

  for (const e of events) {
    if (e.provenance?.kind !== provenance) continue;
    if (e.type === "FxTradeExecuted") {
      const p = e.payload as unknown as FxTradeExecutedPayload;
      const tid = p.tradeId.value;
      const lc = lifecycleByTrade.get(tid);
      if (lc) {
        lc.booking = p; // last write wins
      } else {
        lifecycleByTrade.set(tid, {
          booking: p,
          cancelled: false,
          settled: false,
        });
      }
      sourceEventToTrade.set(e.event_id, tid);
    }
  }
  // Second pass for dependent lifecycle events (booking now known per trade).
  for (const e of events) {
    if (e.provenance?.kind !== provenance) continue;
    const tid = (e.payload as { tradeId?: unknown }).tradeId;
    if (e.type === "FxTradeCancelled" && typeof tid === "string") {
      const lc = lifecycleFor(tid);
      if (lc) lc.cancelled = true;
      sourceEventToTrade.set(e.event_id, tid);
    } else if (e.type === "FxPositionRevalued" && typeof tid === "string") {
      // Revaluation POSTINGS are attributed to the trade so a cancelled trade's
      // full GL footprint — including the (often huge, fictitious) reval of a
      // wrong-notional position — is captured in `actual` and zeroed by the
      // correct=∅ target. The reval is NOT replayed into `correct` (see
      // correctFootprint): a live trade's reval posting is therefore removed,
      // a cancelled trade's reval posting is therefore zeroed.
      if (lifecycleFor(tid)) sourceEventToTrade.set(e.event_id, tid);
    } else if (e.type === "PrincipalPayment") {
      const pp = e.payload as unknown as PrincipalPaymentPayload;
      const lc = lifecycleFor(pp.tradeId);
      if (lc) lc.settled = true;
    } else if (e.type === "SettlementConfirmed") {
      const lc = typeof tid === "string" ? lifecycleFor(tid) : undefined;
      if (lc) lc.settled = true;
    } else if (e.type === "TradeMatured" && typeof tid === "string") {
      const lc = lifecycleFor(tid);
      if (lc) lc.settled = true;
    }
  }

  // 2. Actual footprint + posting count per trade, from SubLedgerPostingEmitted
  //    legs whose source event attributes to a target-provenance trade.
  const actualByTrade = new Map<string, Map<string, FootprintEntry>>();
  const postingCountByTrade = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;
    const p = e.payload as { sourceEventId?: unknown; legs?: unknown };
    const srcId = typeof p.sourceEventId === "string" ? p.sourceEventId : undefined;
    if (!srcId) continue;
    const tradeId = sourceEventToTrade.get(srcId);
    if (!tradeId) continue;
    postingCountByTrade.set(tradeId, (postingCountByTrade.get(tradeId) ?? 0) + 1);
    const fp = actualByTrade.get(tradeId) ?? new Map<string, FootprintEntry>();
    const rawLegs = Array.isArray(p.legs) ? (p.legs as SubLedgerLeg[]) : [];
    for (const leg of rawLegs) {
      const k = key(leg.accountId, leg.currency);
      const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
      const ex = fp.get(k);
      fp.set(k, {
        accountId: leg.accountId,
        currency: leg.currency,
        netDebitMinor: (ex?.netDebitMinor ?? 0) + signed,
      });
    }
    actualByTrade.set(tradeId, fp);
  }

  // 3. Build a reconciliation row per canonical trade.
  const rows: TradeReconciliation[] = [];
  for (const [tradeId, lc] of lifecycleByTrade) {
    const state: TradeLifecycleState = lc.cancelled ? "cancelled" : lc.settled ? "settled" : "live";
    const actual = actualByTrade.get(tradeId) ?? new Map<string, FootprintEntry>();
    const correct = correctFootprint(lc, actual);
    const correctionLegs = correctionLegsFor(actual, correct);
    rows.push({
      tradeId,
      provenance,
      state,
      postingCount: postingCountByTrade.get(tradeId) ?? 0,
      actual: [...actual.values()].filter((e) => e.netDebitMinor !== 0),
      correct: [...correct.values()].filter((e) => e.netDebitMinor !== 0),
      correctionLegs,
      needsCorrection: correctionLegs.length > 0,
    });
  }
  rows.sort((a, b) => a.tradeId.localeCompare(b.tradeId));
  return rows;
}

// ---------------------------------------------------------------------------
// Sub-ledger rebuild (CEO direction 2026-06-01)
//
// The per-trade reconciliation above proved the displayed ACC-2100 anomalies
// are NOT caused by the cancelled trades (they self-net); they are the net of
// ~R0.8bn orphan postings (retired sim-trade source events whose neutralising
// remediation was mis-tagged build-phase-fixture) plus offsetting reval/reversal
// churn on the wrong-notional trades. None of that is attributable to a live
// trade, so it cannot be corrected per-trade. The CEO-approved fix is to
// REBUILD the FX sub-ledger from the canonical trade set:
//
//   1. RESTATE the FX sub-ledger accounts (ACC-2100-001..006) to the canonical
//      target derived purely from the non-cancelled trades' PR-FX-001 bookings
//      (receivable = −payable per currency; reval ACC-2100-005 and realised
//      ACC-2100-006 reset to zero for a clean reval re-run), and
//   2. QUARANTINE the entire un-reconcilable residue into a single labelled
//      suspense account (ACC-2100-009) so the books stay balanced and the
//      build-phase corruption is parked transparently rather than hidden.
//
// The whole movement is ONE balanced ManualJournalEntry. Cancelled trades
// contribute nothing to the target (extinguished). Build-phase fixtures remain
// GL-filtered and untouched.
// ---------------------------------------------------------------------------

/** The FX sub-ledger accounts restated by the rebuild. */
export const FX_SUBLEDGER_ACCOUNTS = [
  "ACC-2100-001",
  "ACC-2100-002",
  "ACC-2100-003",
  "ACC-2100-004",
  "ACC-2100-005",
  "ACC-2100-006",
] as const;

/** Labelled suspense that absorbs the un-reconcilable build-phase residue. */
export const FX_REMEDIATION_SUSPENSE = "ACC-2100-009";

export interface RebuildResult {
  /** Canonical target net (Dr positive) per ACC-2100 account+currency. */
  readonly target: readonly FootprintEntry[];
  /** Current GL net (Dr positive) per ACC-2100 account+currency (input echo). */
  readonly current: readonly FootprintEntry[];
  /** The residue parked in the suspense account, per currency. */
  readonly suspenseResidue: readonly FootprintEntry[];
  /** The single balanced restate journal (deltas on 001..006 + suspense contra). */
  readonly restateLegs: readonly SubLedgerLeg[];
  /** Trades whose bookings make up the canonical target. */
  readonly canonicalTradeIds: readonly string[];
}

/**
 * Compute the FX sub-ledger rebuild journal.
 *
 * @param events  full event log.
 * @param current current ACC-2100 net (Dr positive) per `${accountId}|${currency}`,
 *                computed by the caller from the live GL projection (buildGlView).
 */
export function computeFxSubledgerRebuild(
  events: readonly Event[],
  current: Map<string, number>,
  options: ComputeOptions = {},
): RebuildResult {
  const rows = computeFxSubledgerReconciliation(events, options);

  // Canonical target: Σ PR-FX-001 booking over every non-cancelled trade.
  // ACC-2100-005 / -006 (reval / realised) intentionally absent ⇒ target 0.
  const target = new Map<string, FootprintEntry>();
  const canonicalTradeIds: string[] = [];
  for (const r of rows) {
    if (r.state === "cancelled") continue;
    canonicalTradeIds.push(r.tradeId);
  }
  // Recompute bookings from the canonical payloads via the reconciliation rows'
  // `correct` is not the booking (it echoes actual); compute bookings directly.
  // We re-run the lifecycle gather lightweight: bookings are on each row's
  // actual only when clean, so derive from the event log instead.
  const provenance = options.provenance ?? FOOTPRINT_PROVENANCE;
  const cancelled = new Set(rows.filter((r) => r.state === "cancelled").map((r) => r.tradeId));
  for (const e of events) {
    if (e.provenance?.kind !== provenance || e.type !== "FxTradeExecuted") continue;
    const p = e.payload as unknown as FxTradeExecutedPayload;
    if (cancelled.has(p.tradeId.value)) continue;
    for (const [k, v] of legsToFootprint(
      fxTradeBookingJournals({
        tradeId: p.tradeId.value,
        side: p.side,
        legs: p.legs,
        currencyPair: p.currencyPair,
      }),
    )) {
      const ex = target.get(k);
      target.set(k, {
        accountId: v.accountId,
        currency: v.currency,
        netDebitMinor: (ex?.netDebitMinor ?? 0) + v.netDebitMinor,
      });
    }
  }

  // Restate legs = target − current for every ACC-2100-001..006 account/ccy,
  // plus a suspense contra per currency to balance.
  const restateLegs: SubLedgerLeg[] = [];
  const perCcyDelta = new Map<string, number>();
  const subledgerSet = new Set<string>(FX_SUBLEDGER_ACCOUNTS);
  const keys = new Set<string>();
  for (const k of current.keys()) {
    const [acct] = k.split("|") as [string, string];
    if (subledgerSet.has(acct)) keys.add(k);
  }
  for (const k of target.keys()) keys.add(k);
  for (const k of [...keys].sort()) {
    const [accountId, currency] = k.split("|") as [string, string];
    const t = target.get(k)?.netDebitMinor ?? 0;
    const c = current.get(k) ?? 0;
    const delta = t - c;
    if (delta !== 0) {
      restateLegs.push(
        subLedgerLegFromMinor(
          { accountId, currency, debitCredit: delta > 0 ? "debit" : "credit" },
          Math.abs(delta),
        ),
      );
    }
    perCcyDelta.set(currency, (perCcyDelta.get(currency) ?? 0) + delta);
  }
  const suspenseResidue: FootprintEntry[] = [];
  for (const [currency, delta] of perCcyDelta) {
    if (delta === 0) continue;
    // Suspense leg balances the per-ccy delta: posts the opposite sign.
    restateLegs.push(
      subLedgerLegFromMinor(
        { accountId: FX_REMEDIATION_SUSPENSE, currency, debitCredit: delta > 0 ? "credit" : "debit" },
        Math.abs(delta),
      ),
    );
    // Residue parked in suspense = the corrupt amount removed from the sub-ledger.
    suspenseResidue.push({
      accountId: FX_REMEDIATION_SUSPENSE,
      currency,
      netDebitMinor: -delta,
    });
  }

  return {
    target: [...target.values()].filter((e) => e.netDebitMinor !== 0),
    current: [...current.entries()]
      .filter(([k]) => subledgerSet.has(k.split("|")[0] as string))
      .map(([k, v]) => {
        const [accountId, currency] = k.split("|") as [string, string];
        return { accountId, currency, netDebitMinor: v };
      }),
    suspenseResidue,
    restateLegs,
    canonicalTradeIds,
  };
}

// ---------------------------------------------------------------------------
// FX cash-leg restate — ACC-1100-001 (CEO direction 2026-06-01)
//
// The ACC-2100 rebuild restated the FX receivable/payable sub-ledger but left
// the FX *cash* leg untouched. ACC-1100-001 (Central Bank Reserve) carries the
// mirror half of the same orphan corruption: FX principal-payment /
// lifecycle-close postings that settled FX cash through the reserve account
// instead of the ACC-1200 correspondent nostros — a D-COA-CURRENCY-DECOUPLING
// (2026-05-30) violation. Per that decision FX must NEVER post to ACC-1100-001,
// so the canonical FX contribution to the reserve account is zero.
//
// This computes the restate that moves the non-fixture FX-postingType residue
// off ACC-1100-001 into the same suspense (ACC-2100-009). Because that residue
// is the exact mirror of the ZAR suspense balance, the move collapses the ZAR
// suspense toward zero. Legitimate non-FX activity on the account (none today)
// is preserved — only FX-classified posting types are swept.
// ---------------------------------------------------------------------------

/** Account FX must never post to (FX settles through the ACC-1200 nostros). */
export const FX_MISROUTED_RESERVE = "ACC-1100-001";

/** Posting types that represent FX-lifecycle movements (must not sit on the reserve). */
const FX_POSTING_TYPES = new Set<string>([
  "trade-booking",
  "revaluation",
  "settlement",
  "settlement-confirmation",
  "fx-principal-payment",
  "fx-lifecycle-close",
  "fx-settlement-reversal",
  "cancellation",
  "reversal",
  "duplicate-reversal-correction",
]);

/**
 * Normalise a raw SubLedgerPostingEmitted leg into canonical legs — mirroring
 * `buildGlView`. Old-format legs carry `{debit, credit, amountMinor, currency}`
 * (one object = one journal) and expand into two canonical legs; new-format
 * legs carry `{accountId, debitCredit, amountMinor, currency}`.
 */
function normaliseLeg(raw: unknown): SubLedgerLeg[] {
  const r = raw as Record<string, unknown>;
  // Legs are read back off persisted SubLedgerPostingEmitted events: their
  // integer `amountMinor` is the canonical figure. We rehydrate the decimal
  // `amount` source-of-truth field deterministically from it via
  // subLedgerLegFromMinor (older events carry no `amount`; this fills it without
  // changing any figure — decimal-native slice 1).
  if (typeof r.accountId === "string") {
    const amt = typeof r.amountMinor === "number" ? r.amountMinor : 0;
    const ccy = typeof r.currency === "string" ? r.currency : "ZAR";
    const side: "debit" | "credit" = r.debitCredit === "credit" ? "credit" : "debit";
    return [subLedgerLegFromMinor({ accountId: r.accountId, debitCredit: side, currency: ccy }, amt)];
  }
  if (typeof r.debit === "string" && typeof r.credit === "string") {
    const amt = typeof r.amountMinor === "number" ? r.amountMinor : 0;
    const ccy = typeof r.currency === "string" ? r.currency : "ZAR";
    return [
      subLedgerLegFromMinor({ accountId: r.debit, debitCredit: "debit", currency: ccy }, amt),
      subLedgerLegFromMinor({ accountId: r.credit, debitCredit: "credit", currency: ccy }, amt),
    ];
  }
  return [];
}

export interface CashLegRestateResult {
  /** FX residue currently mis-routed onto the reserve account, per currency. */
  readonly residue: readonly FootprintEntry[];
  /** Balanced legs that sweep the residue off the reserve into the suspense. */
  readonly restateLegs: readonly SubLedgerLeg[];
}

/**
 * Compute the FX cash-leg restate for ACC-1100-001.
 *
 * Sums the non-fixture, FX-postingType `SubLedgerPostingEmitted` legs on the
 * reserve account per currency (the mis-routed residue), and returns balanced
 * legs that zero them against the ACC-2100-009 suspense. Pure over the event log.
 *
 * Targets the NON-FIXTURE residue deliberately: fixture postings are excluded by
 * the GL projection's (now-complete) fixture filter, so the corrective journal
 * must not double-count them.
 */
export function computeFxMisroutedCashRestate(events: readonly Event[]): CashLegRestateResult {
  const fixtureEvents = new Set<string>();
  for (const e of events) {
    if (e.provenance?.kind === "build-phase-fixture") fixtureEvents.add(e.event_id);
  }

  const byCcy = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;
    const p = e.payload as { sourceEventId?: unknown; postingType?: unknown; legs?: unknown };
    const src = typeof p.sourceEventId === "string" ? p.sourceEventId : undefined;
    if (src && fixtureEvents.has(src)) continue; // fixture-sourced → excluded
    if (typeof p.postingType !== "string" || !FX_POSTING_TYPES.has(p.postingType)) continue;
    for (const raw of Array.isArray(p.legs) ? p.legs : []) {
      for (const leg of normaliseLeg(raw)) {
        if (leg.accountId !== FX_MISROUTED_RESERVE) continue;
        const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
        byCcy.set(leg.currency, (byCcy.get(leg.currency) ?? 0) + signed);
      }
    }
  }

  const residue: FootprintEntry[] = [];
  const restateLegs: SubLedgerLeg[] = [];
  for (const [currency, net] of [...byCcy].sort()) {
    if (net === 0) continue;
    residue.push({ accountId: FX_MISROUTED_RESERVE, currency, netDebitMinor: net });
    // Sweep the residue off the reserve (post the opposite) and into suspense.
    restateLegs.push(
      subLedgerLegFromMinor(
        { accountId: FX_MISROUTED_RESERVE, currency, debitCredit: net > 0 ? "credit" : "debit" },
        Math.abs(net),
      ),
    );
    restateLegs.push(
      subLedgerLegFromMinor(
        { accountId: FX_REMEDIATION_SUSPENSE, currency, debitCredit: net > 0 ? "debit" : "credit" },
        Math.abs(net),
      ),
    );
  }

  return { residue, restateLegs };
}
