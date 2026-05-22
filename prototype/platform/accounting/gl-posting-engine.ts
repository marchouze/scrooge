// platform/accounting/gl-posting-engine.ts
//
// `bea-gl-posting-engine` — autonomous subscriber that consumes FX
// lifecycle events and emits `SubLedgerPostingEmitted` events. This is the
// production replacement for the scenario-side glue that Kai's Wave-2
// scenario (PR #663) wires today: instead of the scenario harness importing
// the posting-rule pure functions, building `SubLedgerLeg[]`, then hand-
// emitting `SubLedgerPostingEmitted`, the runtime calls `runGlPostingEngine`
// once over the lifecycle event stream and the engine does the dispatch.
//
// ─── DISPATCH MAP ─────────────────────────────────────────────────────────
//
//   FxTradeExecuted        → PR-FX-001 (fxTradeBookingJournals) →
//                            postingType "trade-booking"
//   FxPositionRevalued     → PR-FX-002 (fxRevaluationJournals) →
//                            postingType "revaluation"
//                            (zero-delta → no posting; surfaced as skipped)
//   PrincipalPayment       → PR-FX-PRIN (fxPrincipalPaymentJournals) →
//                            postingType "fx-principal-payment"
//   SettlementConfirmed    → PR-FX-LIFECYCLE-CLOSE (fxLifecycleCloseJournals) →
//                            postingType "fx-lifecycle-close"
//                            (zero realised P&L → no posting; surfaced as
//                            skipped)
//   TradeMatured  → PR-FX-003 (fxSettlementJournals) → DEPRECATED;
//                            kept for back-compat with legacy emitters →
//                            postingType "settlement"
//   FxSettlementFailed     → PR-FX-005 (fxSettlementFailedJournals) →
//                            postingType "settlement"
//                              `failureKind: "one-leg-delivered"` → 4-leg
//                              IFRS-9 §5.5.13 Stage-3 ECL posting; engine
//                              resolves the failed-receive-leg booking
//                              context from the originating FxTradeExecuted.
//                              `failureKind: "neither-delivered"` or
//                              `"operational-delay"` → no GL posting per
//                              IFRS 9 §5.5.1 (FVTPL out of ECL scope); the
//                              event is recorded in `skipped[]` with the
//                              reason so the recon pipeline can see the
//                              engine did consider it.
//   FxSettlementInstructed → PR-FX-INSTRUCT (no GL impact by design); not
//                            emitted. Recorded in `skipped[]` for transparency.
//   TradeReportSubmitted   → PR-FX-REGREPORT (no GL impact by design); not
//                            emitted. Recorded in `skipped[]` for transparency.
//
// ─── IDEMPOTENCY ──────────────────────────────────────────────────────────
//
// Each emitted `SubLedgerPostingEmitted` event carries a deterministic
// `event_id` keyed on `(sourceEventId, postingRuleId)` so re-running the
// engine over the same event stream + the same prior postings produces
// zero new emissions. The engine accepts the `priorPostings` array (the
// `SubLedgerPostingEmitted` events already in the store) and skips any
// candidate whose `event_id` is already present. This means scenarios,
// the runtime, and tests can all call `runGlPostingEngine` defensively
// without worrying about duplicate emissions.
//
// Event-id format: `gl-posting:<postingRuleId>:<sourceEventId>` —
// colon-prefixed deterministic IDs are recognised by the event-store
// registry alongside UUIDv4s (same pattern as `sicr:<partyId>:<triggerEventId>`
// in `risk/sicr-subscriber.ts`).
//
// ─── SKIPPED EVENTS ───────────────────────────────────────────────────────
//
// The `skipped[]` array carries every input event the engine considered
// but did not post for, with a machine-readable reason. This is load-
// bearing for two reasons:
//   - Recon pipelines (e.g. `recon:gl-ledger-coverage`) need to know that
//     a zero-emission outcome was intentional, not a missing handler.
//   - The dashboard's audit chain needs to display "no GL impact: <reason>"
//     for events that don't move the GL — distinguishing them from events
//     the engine never saw.
//
// ─── CITATIONS ────────────────────────────────────────────────────────────
//
//   - Kai PR #663 (the Wave-2 scenario gap this engine closes).
//   - Bea's PRs #608, #609, #616, #641, #652 (the posting-rule pack this
//     engine dispatches to).
//   - IFRS 9 §5.5.1 (FVTPL out of ECL scope); §5.5.13 (credit-impaired
//     measurement at expected cash flows).
//   - IAS 21 §23, §28 (functional-currency translation and settlement-date
//     P&L recognition).
//   - WS-MARKET-RISK-PROCEDURES (the workstream).
//   - urn:principle:1 — events are reality; the engine is a pure projection.
//   - urn:principle:6 — autonomous-by-default; this engine is the standing
//     autonomous subscriber that replaces scenario-side glue.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type {
  FxPositionRevaluedPayload,
  FxSettlementFailedPayload,
} from "../event-store/event-types/fx-accounting";
import { makeSubLedgerPostingEmitted } from "../event-store/event-types/fx-accounting";
import type { TradeMaturedFxSpotPayload } from "../event-store/event-types/trade-matured";
import type { Event } from "../event-store/types";
import type {
  FxTradeExecutedPayload,
  PrincipalPaymentPayload,
  SettlementConfirmedPayload,
} from "../markets/cdm/fx";
import type { SubLedgerLeg } from "./fx-accounting-types";
import type {
  BondInterestAccruedPayload,
  BondMaturedPayload,
  BondPositionRevaluedPayload,
  BondSoldPayload,
  BondTradeExecutedPayload,
} from "../event-store/event-types/bond-accounting";
import {
  bondBankingBookJournals,
  bondInterestAccrualJournals,
  bondMaturityJournals,
  bondRevaluationJournals,
  bondSaleJournals,
  bondTradingBookJournals,
} from "./posting-rules/bonds";
import {
  fxLifecycleCloseJournals,
  fxPrincipalPaymentJournals,
  fxRevaluationJournals,
  fxSettlementFailedJournals,
  fxSettlementJournals,
  fxTradeBookingJournals,
} from "./posting-rules/fx-spot";

// ---------------------------------------------------------------------------
// Posting-rule identifiers — these drive the deterministic event_id format.
// ---------------------------------------------------------------------------

export const POSTING_RULE_IDS = {
  TRADE_BOOKING: "PR-FX-001",
  REVALUATION: "PR-FX-002",
  PRINCIPAL_PAYMENT: "PR-FX-PRIN",
  LIFECYCLE_CLOSE: "PR-FX-LIFECYCLE-CLOSE",
  SETTLEMENT_LEGACY: "PR-FX-003",
  SETTLEMENT_FAILED: "PR-FX-005",
  // Bond lifecycle posting rules
  BOND_TRADE_BANKING: "PR-BOND-001",
  BOND_TRADE_TRADING: "PR-BOND-001T",
  BOND_INTEREST: "PR-BOND-EIR",
  BOND_REVALUATION: "PR-BOND-002",
  BOND_MATURITY: "PR-BOND-MAT",
  BOND_SALE: "PR-BOND-SALE",
} as const;

export type PostingRuleId = (typeof POSTING_RULE_IDS)[keyof typeof POSTING_RULE_IDS];

/**
 * Derive a deterministic `event_id` for a SubLedgerPostingEmitted event
 * from the source business event + the posting-rule that produced it.
 * Format: `gl-posting:<postingRuleId>:<sourceEventId>`.
 */
export function deriveGlPostingEventId(args: {
  postingRuleId: PostingRuleId;
  sourceEventId: string;
}): string {
  return `gl-posting:${args.postingRuleId}:${args.sourceEventId}`;
}

// ---------------------------------------------------------------------------
// Engine input/output types
// ---------------------------------------------------------------------------

export type GlPostingActor = { type: "system" | "human" | "service"; id: string };

export interface GlPostingEngineInput {
  /** Lifecycle events the engine should consider (any subset; non-FX events
   *  are silently passed over). */
  readonly events: ReadonlyArray<Event>;
  /** SubLedgerPostingEmitted events already in the store. Used for
   *  idempotency: any candidate whose deterministic event_id matches a
   *  prior posting is skipped. Default: []. */
  readonly priorPostings?: ReadonlyArray<Event>;
  /** Clock function — returns ISO-8601 UTC timestamp. Used for the
   *  emitted event's `postedAt` (the engine prefers the source event's
   *  `as_of` over `now()` for posting time; `now()` is the fallback). */
  readonly now: () => string;
  /** Actor emitting the postings. Production wiring sets this to
   *  `{type:"service", id:"agent:bea:gl-posting-engine"}`. */
  readonly actor: GlPostingActor;
  /** Booking entity. Production wiring resolves this per-event from the
   *  source event's `entity` field; the engine uses this only as a
   *  fallback when the source has no entity. */
  readonly entity: string;
  /** Citations to attach to every emitted posting. Defaults to the
   *  canonical Bea-engine citation pack. */
  readonly citations?: ReadonlyArray<string>;
  /**
   * Non-trade trigger events from other domains (risk, product-control,
   * period-close). These are dispatched through NON_TRADE_HANDLERS after
   * the main trade-event loop. Currently always empty — the extension
   * point is wired so future non-trade handlers slot in without
   * restructuring the engine.
   * See platform/accounting/non-trade-trigger-spec.md for the pattern.
   */
  readonly nonTradeTriggers?: ReadonlyArray<Event>;
}

export interface EngineSkipped {
  readonly eventId: string;
  readonly eventType: string;
  readonly reason: SkipReason;
  readonly detail?: string;
}

export type SkipReason =
  | "intentional-no-gl-impact"
  | "fvtpl-out-of-ecl-scope"
  | "zero-delta-revaluation"
  | "zero-realised-pnl"
  | "duplicate-already-posted"
  | "unhandled-event-type"
  | "missing-failed-receive-leg-context"
  | "unknown-failure-kind"
  | "missing-spot-leg";

export interface GlPostingEngineResult {
  /** Newly emitted SubLedgerPostingEmitted events (ready to append to the
   *  event store). */
  readonly emittedPostings: ReadonlyArray<Event>;
  /** Events the engine considered but did not post for; one entry per
   *  source event. Used for recon transparency. */
  readonly skipped: ReadonlyArray<EngineSkipped>;
}

// ---------------------------------------------------------------------------
// Default citations attached to engine-emitted postings.
// ---------------------------------------------------------------------------

const DEFAULT_ENGINE_CITATIONS: ReadonlyArray<string> = [
  "Principles/1-events-are-truth.md",
  "Principles/6-autonomous-by-default.md",
  "Policies/ifrs9-ecl-provisioning-policy-v1.md",
  "pr:#641",
  "pr:#652",
  "pr:#663",
  "WS-MARKET-RISK-PROCEDURES",
];

// ---------------------------------------------------------------------------
// Helpers — locate the originating FxTradeExecuted for a settlement-failure
// receive-leg lookup.
// ---------------------------------------------------------------------------

function findFxTradeExecuted(events: ReadonlyArray<Event>, tradeRef: string): Event | undefined {
  for (const e of events) {
    if (e.type !== "FxTradeExecuted") continue;
    const p = e.payload as Partial<FxTradeExecutedPayload>;
    const id = p.tradeId as { value?: string } | string | undefined;
    const matchValue = typeof id === "string" ? id : id?.value;
    if (matchValue === tradeRef) return e;
  }
  return undefined;
}

/**
 * Resolve the failed-receive-leg booking context for a
 * `FxSettlementFailed{one-leg-delivered}` event. The receive-leg is the
 * leg the bank was DUE to collect — its currency/amount lives on the
 * originating FxTradeExecuted. We translate to ZAR by reading the leg's
 * `rate` field (rate is `receiveCurrency per pay-unit` per CDM fx.ts §legs).
 *
 * Returns `null` if no FxTradeExecuted is found for the tradeRef.
 *
 * Note on ZAR translation: production wiring would read the SARB fixing
 * for the failure date from the market-data projection (IAS 21 §28 —
 * settlement-date spot rate). For this engine slice, we use the agreed
 * trade rate as the ZAR-equivalent basis; this matches Kai's scenario
 * harness (PR #663) which already computes `usd × tradeRate` for the same
 * field. A market-data refinement is a follow-on slice.
 */
function resolveFailedReceiveLeg(
  events: ReadonlyArray<Event>,
  failedPayload: FxSettlementFailedPayload,
):
  | { currency: string; amountMinor: number; zarEquivalentMinor: number }
  | { error: "no-trade-found" | "no-receive-leg" } {
  const trade = findFxTradeExecuted(events, failedPayload.tradeRef);
  if (!trade) return { error: "no-trade-found" };

  const payload = trade.payload as FxTradeExecutedPayload;
  // The "receive leg" from the bank's perspective is the leg whose
  // `receiveCurrency` is the currency the bank was due to collect. For
  // an FX-spot trade there is exactly one "near" leg; we use its
  // counterNotional (= amount received) and the agreed rate to compute
  // the ZAR equivalent.
  const nearLeg = payload.legs.find((l) => l.legKind === "near");
  if (!nearLeg) return { error: "no-receive-leg" };

  const currency = nearLeg.receiveCurrency;
  const amountMinor = Math.abs(nearLeg.counterNotional.amountMinor);

  // ZAR equivalent: if either side of the pair is ZAR, use the leg's
  // notional/counterNotional in ZAR; otherwise translate using `rate`
  // (units of receiveCurrency per unit of payCurrency). For the current
  // FX-spot-only scope (USD/ZAR), the pay-side notional IS the ZAR amount,
  // which gives us an exact ZAR equivalent without rounding.
  let zarEquivalentMinor: number;
  if (nearLeg.payCurrency === "ZAR") {
    zarEquivalentMinor = Math.abs(nearLeg.notional.amountMinor);
  } else if (nearLeg.receiveCurrency === "ZAR") {
    zarEquivalentMinor = amountMinor;
  } else {
    // Cross-currency Spot (no ZAR leg) — out of MR-1 scope today. Fall
    // back to the rate-implied equivalent; the precision impact for the
    // engine's purpose (Stage-3 ECL allowance) is the receive-leg
    // notional translated by the agreed rate.
    zarEquivalentMinor = Math.round(amountMinor * nearLeg.rate.amount);
  }

  return { currency, amountMinor, zarEquivalentMinor };
}

// ---------------------------------------------------------------------------
// Per-event dispatch — pure helpers that return either legs+postingType+
// postingRuleId OR a skip reason. The outer engine wraps the return into
// a SubLedgerPostingEmitted or appends to `skipped[]`.
// ---------------------------------------------------------------------------

type DispatchResult =
  | {
      kind: "post";
      legs: SubLedgerLeg[];
      postingType:
        | "trade-booking"
        | "revaluation"
        | "settlement"
        | "fx-principal-payment"
        | "fx-lifecycle-close"
        | "bond-trade-booking"
        | "bond-interest-accrual"
        | "bond-revaluation"
        | "bond-maturity"
        | "bond-sale";
      postingRuleId: PostingRuleId;
    }
  | { kind: "skip"; reason: SkipReason; detail?: string };

function dispatchEvent(event: Event, allEvents: ReadonlyArray<Event>): DispatchResult {
  switch (event.type) {
    case "FxTradeExecuted": {
      const payload = event.payload as FxTradeExecutedPayload;
      const legs = fxTradeBookingJournals({
        tradeId: typeof payload.tradeId === "string" ? payload.tradeId : payload.tradeId.value,
        side: payload.side,
        legs: payload.legs,
        currencyPair: payload.currencyPair,
      });
      if (legs.length === 0) return { kind: "skip", reason: "missing-spot-leg" };
      return {
        kind: "post",
        legs,
        postingType: "trade-booking",
        postingRuleId: POSTING_RULE_IDS.TRADE_BOOKING,
      };
    }

    case "FxPositionRevalued": {
      const payload = event.payload as FxPositionRevaluedPayload;
      const legs = fxRevaluationJournals(payload);
      if (legs.length === 0) {
        return { kind: "skip", reason: "zero-delta-revaluation" };
      }
      return {
        kind: "post",
        legs,
        postingType: "revaluation",
        postingRuleId: POSTING_RULE_IDS.REVALUATION,
      };
    }

    case "PrincipalPayment": {
      const payload = event.payload as PrincipalPaymentPayload;
      const legs = fxPrincipalPaymentJournals(payload);
      if (legs.length === 0) {
        // Zero netCash — defensive only; per the schema netCash is non-zero.
        return { kind: "skip", reason: "zero-delta-revaluation" };
      }
      return {
        kind: "post",
        legs,
        postingType: "fx-principal-payment",
        postingRuleId: POSTING_RULE_IDS.PRINCIPAL_PAYMENT,
      };
    }

    case "SettlementConfirmed": {
      const payload = event.payload as SettlementConfirmedPayload;
      const legs = fxLifecycleCloseJournals(payload);
      if (legs.length === 0) {
        return { kind: "skip", reason: "zero-realised-pnl" };
      }
      return {
        kind: "post",
        legs,
        postingType: "fx-lifecycle-close",
        postingRuleId: POSTING_RULE_IDS.LIFECYCLE_CLOSE,
      };
    }

    case "TradeMatured": {
      // Deprecated path — PR-FX-003. Kept for back-compat with rare
      // legacy emitters (test-only). New authoring uses PR-FX-PRIN +
      // PR-FX-LIFECYCLE-CLOSE.
      const payload = event.payload as TradeMaturedFxSpotPayload;
      const legs = fxSettlementJournals(payload);
      if (legs.length === 0) {
        return { kind: "skip", reason: "zero-realised-pnl" };
      }
      return {
        kind: "post",
        legs,
        postingType: "settlement",
        postingRuleId: POSTING_RULE_IDS.SETTLEMENT_LEGACY,
      };
    }

    case "FxSettlementFailed": {
      const payload = event.payload as FxSettlementFailedPayload;

      // IFRS 9 §5.5.1 — FVTPL out of ECL scope. The neither-delivered
      // and operational-delay branches produce no GL movement; the SICR
      // memo (for neither-delivered) is emitted by sicr-subscriber, not
      // here.
      if (payload.failureKind === "neither-delivered") {
        return { kind: "skip", reason: "fvtpl-out-of-ecl-scope", detail: "neither-delivered" };
      }
      if (payload.failureKind === "operational-delay") {
        return { kind: "skip", reason: "fvtpl-out-of-ecl-scope", detail: "operational-delay" };
      }
      if (payload.failureKind !== "one-leg-delivered") {
        return {
          kind: "skip",
          reason: "unknown-failure-kind",
          detail: String((payload as { failureKind: string }).failureKind),
        };
      }

      const ctx = resolveFailedReceiveLeg(allEvents, payload);
      if ("error" in ctx) {
        return {
          kind: "skip",
          reason: "missing-failed-receive-leg-context",
          detail: ctx.error,
        };
      }

      const legs = fxSettlementFailedJournals({
        event: payload,
        failedReceiveLeg: ctx,
      });
      if (legs.length === 0) {
        // Defensive: rule should always emit 4 legs on one-leg-delivered.
        return { kind: "skip", reason: "fvtpl-out-of-ecl-scope" };
      }
      return {
        kind: "post",
        legs,
        postingType: "settlement",
        postingRuleId: POSTING_RULE_IDS.SETTLEMENT_FAILED,
      };
    }

    case "BondTradeExecuted": {
      const payload = event.payload as BondTradeExecutedPayload;
      const isTrading = payload.portfolio === "trading-book";
      const legs = isTrading
        ? bondTradingBookJournals(payload)
        : bondBankingBookJournals(payload);
      if (legs.length === 0) return { kind: "skip", reason: "missing-spot-leg" };
      return {
        kind: "post",
        legs,
        postingType: "bond-trade-booking",
        postingRuleId: isTrading
          ? POSTING_RULE_IDS.BOND_TRADE_TRADING
          : POSTING_RULE_IDS.BOND_TRADE_BANKING,
      };
    }

    case "BondInterestAccrued": {
      const payload = event.payload as BondInterestAccruedPayload;
      const legs = bondInterestAccrualJournals(payload);
      if (legs.length === 0) return { kind: "skip", reason: "zero-delta-revaluation" };
      return {
        kind: "post",
        legs,
        postingType: "bond-interest-accrual",
        postingRuleId: POSTING_RULE_IDS.BOND_INTEREST,
      };
    }

    case "BondPositionRevalued": {
      const payload = event.payload as BondPositionRevaluedPayload;
      const legs = bondRevaluationJournals(payload);
      if (legs.length === 0) return { kind: "skip", reason: "zero-delta-revaluation" };
      return {
        kind: "post",
        legs,
        postingType: "bond-revaluation",
        postingRuleId: POSTING_RULE_IDS.BOND_REVALUATION,
      };
    }

    case "BondMatured": {
      const payload = event.payload as BondMaturedPayload;
      // BondMaturedPayload does not carry a portfolio field; default to
      // "trading-book" for asset-account selection. Banking-book maturity
      // uses the same cash-in / asset-out structure — the account code
      // differs. Production wiring should resolve the originating trade's
      // portfolio from the position projection; this engine slice defaults
      // defensively to trading-book (the more common case for JSE bonds
      // in this book). Follow-on: enrich BondMaturedPayload with portfolio.
      const legs = bondMaturityJournals(payload, "trading-book");
      if (legs.length === 0) return { kind: "skip", reason: "zero-realised-pnl" };
      return {
        kind: "post",
        legs,
        postingType: "bond-maturity",
        postingRuleId: POSTING_RULE_IDS.BOND_MATURITY,
      };
    }

    case "BondSold": {
      const payload = event.payload as BondSoldPayload;
      // Same portfolio-resolution note as BondMatured above.
      const legs = bondSaleJournals(payload, "trading-book");
      if (legs.length === 0) return { kind: "skip", reason: "zero-realised-pnl" };
      return {
        kind: "post",
        legs,
        postingType: "bond-sale",
        postingRuleId: POSTING_RULE_IDS.BOND_SALE,
      };
    }

    // Memo-only event types (no GL impact by design — see fx-spot.ts
    // docblocks for PR-FX-INSTRUCT and PR-FX-REGREPORT).
    case "FxSettlementInstructed":
    case "TradeReportSubmitted":
      return { kind: "skip", reason: "intentional-no-gl-impact" };

    default:
      // The engine silently passes over non-FX events. Returning a skip
      // here is overly chatty for the typical mixed stream (the runtime
      // will pass every event in the bus to every subscriber); only
      // events whose type is recognised but produced no posting belong
      // in `skipped[]`. We model that by returning `unhandled-event-type`
      // but the engine filters these out before producing the result
      // (see runGlPostingEngine).
      return { kind: "skip", reason: "unhandled-event-type" };
  }
}

/** Event types this engine recognises and dispatches. Used to filter
 *  the `skipped[]` array — non-FX events the engine silently passes over
 *  do not appear in the result. */
const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "FxTradeExecuted",
  "FxPositionRevalued",
  "PrincipalPayment",
  "SettlementConfirmed",
  "TradeMatured",
  "FxSettlementFailed",
  "FxSettlementInstructed",
  "TradeReportSubmitted",
  // Bond lifecycle events
  "BondTradeExecuted",
  "BondInterestAccrued",
  "BondPositionRevalued",
  "BondMatured",
  "BondSold",
]);

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

export function runGlPostingEngine(input: GlPostingEngineInput): GlPostingEngineResult {
  const {
    events,
    priorPostings = [],
    now,
    actor,
    entity,
    citations = DEFAULT_ENGINE_CITATIONS,
  } = input;

  // Build the set of already-emitted posting event_ids for idempotency.
  const priorIds = new Set<string>();
  for (const p of priorPostings) priorIds.add(p.event_id);

  const emittedPostings: Event[] = [];
  const skipped: EngineSkipped[] = [];

  // Track event_ids emitted in this run so the same source event isn't
  // double-posted within a single call (defensive — should not happen
  // since each source-event maps to exactly one posting).
  const emittedThisRun = new Set<string>();

  for (const event of events) {
    if (!HANDLED_EVENT_TYPES.has(event.type)) continue;

    const dispatched = dispatchEvent(event, events);

    if (dispatched.kind === "skip") {
      const skipEntry: EngineSkipped =
        dispatched.detail !== undefined
          ? {
              eventId: event.event_id,
              eventType: event.type,
              reason: dispatched.reason,
              detail: dispatched.detail,
            }
          : {
              eventId: event.event_id,
              eventType: event.type,
              reason: dispatched.reason,
            };
      skipped.push(skipEntry);
      continue;
    }

    const eventId = deriveGlPostingEventId({
      postingRuleId: dispatched.postingRuleId,
      sourceEventId: event.event_id,
    });

    // Idempotency guard — skip if already in priorPostings OR emitted
    // earlier in this run.
    if (priorIds.has(eventId) || emittedThisRun.has(eventId)) {
      skipped.push({
        eventId: event.event_id,
        eventType: event.type,
        reason: "duplicate-already-posted",
        detail: eventId,
      });
      continue;
    }

    // Construct the SubLedgerPostingEmitted event. We prefer the source
    // event's `as_of` over now() for `postedAt` so the GL view shows
    // the posting at the business-time of the source event, not the
    // (often later) engine run-time. `now()` is used for the envelope
    // `asOf` so the engine's own emission lineage is timestamped at
    // run-time.
    const postedAt = event.as_of;
    const postingEvent = makeSubLedgerPostingEmitted({
      asOf: now(),
      entity: event.entity ?? entity,
      actor,
      citations: [...citations],
      payload: {
        sourceEventId: event.event_id,
        postingType: dispatched.postingType,
        legs: dispatched.legs.map((l) => ({ ...l })),
        postedAt,
      },
      eventId,
    });

    emittedPostings.push(postingEvent);
    emittedThisRun.add(eventId);
  }

  // ── Non-trade trigger extension point ────────────────────────────────────
  // Future non-trade domain events (ProvisionCalculated, BookPnlAttributed,
  // etc.) are dispatched here once their event types are defined and their
  // posting-rule pure functions are implemented. See non-trade-trigger-spec.md.
  //
  // Pattern to add a new handler:
  //   1. Define the event type schema in its domain's event-type module.
  //   2. Add a PostingRuleEntry to posting-rule-registry.ts.
  //   3. Write a pure posting-rule function in posting-rules/<domain>.ts.
  //   4. Add the handler to NON_TRADE_HANDLERS below.
  //   5. Add the event type to HANDLED_EVENT_TYPES above.
  type NonTradeHandler = (event: Event) => SubLedgerLeg[];
  const NON_TRADE_HANDLERS: Partial<Record<string, NonTradeHandler>> = {
    // "ProvisionCalculated": provisionHandler,    // future — risk domain
    // "BookPnlAttributed":   bookPnlHandler,      // future — product-control domain
  };

  for (const event of input.nonTradeTriggers ?? []) {
    const handler = NON_TRADE_HANDLERS[event.type];
    if (!handler) {
      if (HANDLED_EVENT_TYPES.has(event.type)) {
        // Already handled in the main loop above — skip silently.
        continue;
      }
      skipped.push({
        eventId: event.event_id,
        eventType: event.type,
        reason: "unhandled-event-type",
      });
      continue;
    }

    const legs = handler(event);
    if (legs.length === 0) {
      skipped.push({
        eventId: event.event_id,
        eventType: event.type,
        reason: "zero-delta-revaluation",
      });
      continue;
    }

    // Non-trade postings use "PR-NONTRADE:<eventType>" as a temporary rule ID
    // until the handler declares its canonical posting-rule ID.
    const tempRuleId = `PR-NONTRADE:${event.type}` as PostingRuleId;
    const eventId = deriveGlPostingEventId({
      postingRuleId: tempRuleId,
      sourceEventId: event.event_id,
    });

    if (priorIds.has(eventId) || emittedThisRun.has(eventId)) {
      skipped.push({
        eventId: event.event_id,
        eventType: event.type,
        reason: "duplicate-already-posted",
        detail: eventId,
      });
      continue;
    }

    const postingEvent = makeSubLedgerPostingEmitted({
      asOf: now(),
      entity: event.entity ?? entity,
      actor,
      citations: [...citations],
      payload: {
        sourceEventId: event.event_id,
        postingType: "trade-booking", // overridden by handler in real use
        legs: legs.map((l) => ({ ...l })),
        postedAt: event.as_of,
      },
      eventId,
    });

    emittedPostings.push(postingEvent);
    emittedThisRun.add(eventId);
  }

  return { emittedPostings, skipped };
}
