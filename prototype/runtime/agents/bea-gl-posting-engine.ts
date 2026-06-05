// runtime/agents/bea-gl-posting-engine.ts
//
// Bea's universal GL posting engine — wires payment and FX trade lifecycle
// events to balanced double-entry GL postings via posting-rule functions
// in `platform/accounting/posting-rules/`.
//
// Subscriptions:
//   Payment lifecycle:
//   - PaymentInitiated              → PR-PAY-001: paymentInitiatedJournals()
//   - PaymentSettled                → PR-PAY-002: paymentSettledJournals()
//   - SettlementInstructionReceived → PR-SET-001: settlementInstructionJournals()
//   - ConfirmationMatched           → log only, no SubLedgerPostingEmitted
//   - ConfirmationMismatch          → log only, no SubLedgerPostingEmitted
//   - SettlementFailed              → log only, no SubLedgerPostingEmitted
//   - SettlementReversed            → PR-FX-REV: fxSettlementReversalJournals()
//   - TradeCancelled                → PR-FX-CANCEL: fxCancellationJournals()
//                                     (the non-FX markets-trading-extended kind;
//                                      stays on the legacy posting-rule path.)
//   - TradeAmended                  → PR-FX-AMD: fxAmendmentJournals()
//   - TradeMatured                  → PR-FX-003 (deprecated): fxSettlementJournals()
//
//   FX LIFECYCLE — CUT OVER TO THE SLA INTERPRETER (D-SLA-ENGINE-RULES-AS-DATA
//   Phase 3). The eight FX-lifecycle event types below no longer call the
//   hand-coded fx-spot.ts posting-rule functions in production; they post via
//   the rules-as-data SLA interpreter (IFRS), byte-for-byte equal to legacy
//   (proven by the permanent parallel-run regression). See
//   `bea-gl-fx-interpreter-cutover.ts` + `processFxViaInterpreter` below.
//   - FxTradeExecuted        → PR-FX-001            (trade-booking)
//   - FxPositionRevalued     → PR-FX-002            (revaluation)
//   - PrincipalPayment       → PR-FX-PRIN           (fx-principal-payment)
//   - SettlementConfirmed    → PR-FX-LIFECYCLE-CLOSE (fx-lifecycle-close)
//   - FxSettlementFailed     → PR-FX-005            (settlement)        [enrichment]
//   - FxTradeCancelled       → PR-FX-CANCEL         (cancellation)      [enrichment]
//   - FxSettlementInstructed → PR-FX-INSTRUCT       (memo; no GL)
//   - TradeReportSubmitted   → PR-FX-REGREPORT      (memo; no GL)
//   All NON-FX product families (bond/equity/IRS/repo/deposit/funding/interbank/
//   payments) remain on the legacy dispatch below, UNTOUCHED.
//
//   Bond lifecycle (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR A):
//   - BondTradeExecuted             → PR-BOND-001: bondBankingBookJournals() / bondTradingBookJournals()
//   - BondInterestAccrued           → PR-BOND-002: bondInterestAccrualJournals()
//   - BondPositionRevalued          → PR-BOND-003: bondRevaluationJournals()
//   - BondMatured                   → PR-BOND-004: bondMaturityJournals()
//   - BondSold                      → PR-BOND-005: bondSaleJournals()
//
//   Equity lifecycle (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR B):
//   - EquityTradeExecuted           → PR-EQ-001: equityTradeFvtplJournals() / equityTradeFvociJournals()
//   - EquityPositionRevalued        → PR-EQ-002: equityRevaluationJournals()
//   - EquityDividendAccrued         → PR-EQ-003: equityDividendJournals()
//   - EquitySold                    → PR-EQ-004: equitySaleJournals()
//
//   IRD swap lifecycle (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR C):
//   - IrdSwapTradeExecuted          → PR-IRS-001: irdSwapTradeBookingJournals()
//   - IrdSwapPositionRevalued       → PR-IRS-002: irdSwapRevaluationJournals()
//   - IrdSwapCouponSettled          → PR-IRS-003: irdSwapCouponJournals()
//   - IrdSwapTerminated             → PR-IRS-TERM: irdSwapTerminationJournals()
//
//   Treasury lifecycle (WS1-PR1a; IFRS 9 §3.1.1; IAS 39 §27):
//   - RepoTradeOpened               → PR-REPO-001: prRepo001()  [postingType: "repo-trade-booking"]
//   - DepositTaken                  → PR-MMD-001:  prMmd001()   [postingType: "deposit-taken"]
//   - InterbankLoanPlaced           → PR-IBL-001:  prIbl001()   [postingType: "ibl-placement"]
//
// Each posting rule returns SubLedgerLeg[]. This handler wraps each
// result in a `SubLedgerPostingEmitted` event, which the period-close
// projection (computeTrialBalance) consumes.
//
// Idempotency: a Set of "${sourceEventId}:${postingType}" keys built from
// existing SubLedgerPostingEmitted events prevents duplicate postings on
// replay. The engine replays ALL events from the store on each run
// (event-driven or on-request), not just the triggering set — this
// ensures correct idempotency even when trigger batches are partial.
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   - Banks Act 94 of 1990
//   - IFRS 9 §3.1.1 (initial recognition of financial instruments)
//   - IFRS 9 §3.2.3 (derecognition of financial instruments)
//   - IFRS 9 §5.4.1 (EIR method for amortised cost instruments)
//   - IFRS 9 §5.7.1 (FVTPL gains/losses through P&L)
//   - IAS 21 §23 (translation of monetary items at closing rate)
//   - IAS 32 §11 (recognition criteria)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  bondBankingBookJournals,
  bondInterestAccrualJournals,
  bondMaturityJournals,
  bondRevaluationJournals,
  bondSaleJournals,
  bondTradingBookJournals,
} from "../../platform/accounting/posting-rules/bonds";
import {
  equityDividendJournals,
  equityRevaluationJournals,
  equitySaleJournals,
  equityTradeBookingJournals,
} from "../../platform/accounting/posting-rules/equities";
import {
  detectUnresolvedCurrencyLegs,
  fxAmendmentJournals,
  fxCancellationJournals,
  fxSettlementJournals,
  fxSettlementReversalJournals,
} from "../../platform/accounting/posting-rules/fx-spot";
import {
  irdSwapCouponJournals,
  irdSwapRevaluationJournals,
  irdSwapTerminationJournals,
  irdSwapTradeBookingJournals,
} from "../../platform/accounting/posting-rules/ird-swaps";
import {
  paymentInitiatedJournals,
  paymentSettledJournals,
  settlementInstructionJournals,
} from "../../platform/accounting/posting-rules/payments";
import {
  prIbl001,
  prMmd001,
  prRepo001,
} from "../../platform/accounting/posting-rules/repo-mmd-ibl";
import { urgentCorrectionToSubstrateAlert } from "../../platform/accounting/sla/interpreter";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type {
  BondInterestAccruedPayload,
  BondMaturedPayload,
  BondPositionRevaluedPayload,
  BondSoldPayload,
  BondTradeExecutedPayload,
} from "../../platform/event-store/event-types/bond-accounting";
import type {
  EquityDividendAccruedPayload,
  EquitySoldPayload,
} from "../../platform/event-store/event-types/equity-accounting";
import {
  type FxSettlementFailedPayload,
  type FxTradeCancelledPayload,
  type SettlementReversedPayload,
  makeSubLedgerPostingEmitted,
} from "../../platform/event-store/event-types/fx-accounting";
import type {
  IrdSwapCouponSettledPayload,
  IrdSwapPositionRevaluedPayload,
  IrdSwapTerminatedPayload,
  IrdSwapTradeExecutedPayload,
} from "../../platform/event-store/event-types/ird-accounting";
import type {
  TradeAmendedPayload,
  TradeCancelledPayload,
} from "../../platform/event-store/event-types/markets-trading-extended";
import type {
  PaymentInitiatedPayload,
  PaymentSettledPayload,
  SettlementInstructionReceivedPayload,
} from "../../platform/event-store/event-types/payments";
import { makeSubstrateAlert } from "../../platform/event-store/event-types/platform";
import type {
  DepositTakenPayload,
  InterbankLoanPlacedPayload,
  RepoTradeOpenedPayload,
} from "../../platform/event-store/event-types/repo-mmd-ibl";
import type { TradeMaturedFxSpotPayload } from "../../platform/event-store/event-types/trade-matured";
import type {
  EquityPositionRevaluedPayload,
  EquityTradeExecutedPayload,
} from "../../platform/markets/cdm/equity";
import type { AgentRunContext, AgentRunOutput } from "../types";
import {
  FX_INTERPRETER_EVENT_TYPES,
  buildCancelEnrichment,
  interpretFxEvent,
  resolveFailedReceiveLeg,
} from "./bea-gl-fx-interpreter-cutover";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:bea:gl-posting-engine",
};

const GL_POSTING_CITATIONS: readonly string[] = ["PROC-PAY-RBH-01", "D-MARKETS-SCHEMA-FOUNDATION"];

const SUBSCRIBED_TYPES = new Set<string>([
  "PaymentInitiated",
  "PaymentSettled",
  "SettlementInstructionReceived",
  "FxTradeExecuted",
  "FxPositionRevalued",
  "TradeMatured",
  // FX lifecycle (CDM) — GL-significant since 2026-05-20 (D-MARKETS-SCHEMA-FOUNDATION).
  // PR-FX-PRIN posts per-leg cash at correspondent confirmation; PR-FX-LIFECYCLE-CLOSE
  // posts the realised-P&L residual at trade close.
  "PrincipalPayment",
  "SettlementConfirmed",
  "ConfirmationMatched",
  "ConfirmationMismatch",
  "SettlementFailed",
  "SettlementReversed",
  "TradeCancelled",
  // FxTradeCancelled is the FX-specific cancellation kind. Same posting rule
  // as TradeCancelled — both carry `tradeId: string` and re-use PR-FX-CANCEL.
  // Authority: D-MARKETS-SCHEMA-FOUNDATION; PR #616.
  "FxTradeCancelled",
  "TradeAmended",
  // FX-lifecycle events newly cut over to the SLA interpreter (D-SLA-ENGINE-
  // RULES-AS-DATA Phase 3). FxSettlementFailed posts the Stage-3-ECL/Herstatt
  // journals (PR-FX-005); the two memo events are intentional-no-impact.
  "FxSettlementFailed",
  "FxSettlementInstructed",
  "TradeReportSubmitted",
  // Bond lifecycle events (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR A)
  "BondTradeExecuted",
  "BondInterestAccrued",
  "BondPositionRevalued",
  "BondMatured",
  "BondSold",
  // Equity lifecycle events (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR B)
  "EquityTradeExecuted",
  "EquityPositionRevalued",
  "EquityDividendAccrued",
  "EquitySold",
  // IRD swap lifecycle events (D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 PR C)
  "IrdSwapTradeExecuted",
  "IrdSwapPositionRevalued",
  "IrdSwapCouponSettled",
  "IrdSwapTerminated",
  // Treasury lifecycle events (WS1-PR1a; IFRS 9 §3.1.1; IAS 39 §27)
  "RepoTradeOpened",
  "DepositTaken",
  "InterbankLoanPlaced",
]);

// Idempotency key format: "${sourceEventId}:${postingType}"
type IdempotencyKey = string;

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Build a Set of idempotency keys from all existing SubLedgerPostingEmitted
 * events in the store. Called once at the start of each run — O(N) over
 * posting history but safe and correct.
 */
function buildPostedKeySet(): Set<IdempotencyKey> {
  const keys = new Set<IdempotencyKey>();
  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as {
      sourceEventId?: unknown;
      postingType?: unknown;
    };
    if (typeof p.sourceEventId === "string" && typeof p.postingType === "string") {
      keys.add(`${p.sourceEventId}:${p.postingType}`);
    }
  }
  return keys;
}

/**
 * Indexes used by the cancellation arm (PR-FX-CANCEL) to reconstruct a
 * cancelled trade's booking legs and cumulative unrealised P&L.
 *
 * Built ONCE per engine run. The previous implementation full-replayed the
 * entire event store (~124k events) once *per posting* (~3.9k) *per
 * cancellation* — an O(store²) blow-up that wedged the single-threaded event
 * loop for minutes on every booking, because the engine replays all events on
 * every run. These two flat maps make cancellation reconstruction O(postings)
 * with O(1) lookups instead.
 */
interface CancellationIndex {
  /** sourceEventId → that source event's `tradeId` (normalised to string). */
  readonly tradeIdBySourceEvent: Map<string, string>;
  /** All SubLedgerPostingEmitted events, materialised once. */
  readonly postings: readonly import("../../platform/event-store/types").Event[];
}

function normaliseTradeId(tradeId: unknown): string {
  if (typeof tradeId === "string") return tradeId;
  if (tradeId && typeof tradeId === "object" && "value" in tradeId) {
    const v = (tradeId as { value?: unknown }).value;
    return typeof v === "string" ? v : "";
  }
  return "";
}

function buildCancellationIndex(): CancellationIndex {
  // One full pass to map every event_id → its tradeId (string). This replaces
  // the per-posting `[...eventStore.replay({})].filter(...)` full-store scan.
  const tradeIdBySourceEvent = new Map<string, string>();
  for (const ev of eventStore.replay({})) {
    const tid = normaliseTradeId((ev.payload as { tradeId?: unknown }).tradeId);
    if (tid) tradeIdBySourceEvent.set(ev.event_id, tid);
  }
  const postings = [...eventStore.replay({ type: "SubLedgerPostingEmitted" })];
  return { tradeIdBySourceEvent, postings };
}

// ---------------------------------------------------------------------------
// FX-lifecycle cutover (D-SLA-ENGINE-RULES-AS-DATA Phase 3)
// ---------------------------------------------------------------------------

/**
 * Reconstruct the cancellation enrichment (prior booking legs + cumulative
 * unrealised P&L) for an FxTradeCancelled trade, from the per-run cancellation
 * index. Mirrors the legacy `TradeCancelled` reconstruction below.
 *
 * Production parity note: for the FX-specific `FxTradeCancelled` kind, the
 * per-revaluation MTM undo is owned by `bea-fx-posting-engine` (it emits
 * `reversal` postings). The legacy GL engine therefore passed
 * `cumulativeUnrealisedPnlZarMinor = 0` for FxTradeCancelled so PR-FX-CANCEL
 * emits ONLY the booking-leg reversal. We preserve that exactly: this builder
 * returns cumulative P&L = 0, and only the prior booking legs drive the
 * reversal.
 */
function buildFxCancelEnrichmentForTrade(
  tradeId: string,
  cidx: CancellationIndex,
): {
  bookingLegs: import("../../platform/accounting/fx-accounting-types").SubLedgerLeg[];
  cumulativeUnrealisedPnlZarMinor: number;
} {
  const bookingLegs: import("../../platform/accounting/fx-accounting-types").SubLedgerLeg[] = [];
  for (const p of cidx.postings) {
    const pp = p.payload as {
      postingType?: string;
      legs?: import("../../platform/accounting/fx-accounting-types").SubLedgerLeg[];
    };
    if (typeof pp.postingType !== "string" || !Array.isArray(pp.legs)) continue;
    const sourceEventId = (p.payload as { sourceEventId?: string }).sourceEventId;
    if (!sourceEventId) continue;
    const srcTradeIdValue = cidx.tradeIdBySourceEvent.get(sourceEventId);
    if (!srcTradeIdValue || srcTradeIdValue !== tradeId) continue;
    if (pp.postingType === "trade-booking") bookingLegs.push(...pp.legs);
  }
  // FX-specific kind: MTM undo owned by bea-fx-posting-engine → cumulative = 0.
  return { bookingLegs, cumulativeUnrealisedPnlZarMinor: 0 };
}

/**
 * Outcome of processing a single FX-lifecycle event through the SLA interpreter.
 */
interface FxProcessResult {
  readonly emitted: number;
  readonly skipped: number;
}

/**
 * Process one FX-lifecycle source event via the rules-as-data SLA interpreter
 * and emit the resulting `SubLedgerPostingEmitted` (+ urgent-correction
 * `SubstrateAlert`s for any suspense leg). This is the production cutover seam
 * (deliverable 1). Idempotency keys are unchanged (no double-post on replay).
 */
async function processFxViaInterpreter(
  e: import("../../platform/event-store/types").Event,
  ctx: AgentRunContext,
  postedKeys: Set<IdempotencyKey>,
  getCancellationIndex: () => CancellationIndex,
): Promise<FxProcessResult> {
  // Build enrichment for the two rules that price off prior events.
  let enrichment: unknown;
  if (e.type === "FxTradeCancelled") {
    const payload = e.payload as FxTradeCancelledPayload;
    const cidx = getCancellationIndex();
    const recon = buildFxCancelEnrichmentForTrade(payload.tradeId, cidx);
    enrichment = buildCancelEnrichment(recon);
  } else if (e.type === "FxSettlementFailed") {
    // PR-FX-005 (one-leg-delivered) needs the originating trade's receive leg.
    const allEvents = [...eventStore.replay({ type: "FxTradeExecuted" })];
    const failedReceiveLeg = resolveFailedReceiveLeg(
      allEvents,
      e.payload as FxSettlementFailedPayload,
    );
    enrichment = failedReceiveLeg ? { failedReceiveLeg } : {};
  }

  const outcome = interpretFxEvent(e, ctx.asOf, enrichment);

  if (outcome.kind === "reject") {
    // Loud reject — never silent. Surface via logger; the caller's per-event
    // try/catch records nothing here (we do not throw), but the rejection is
    // logged at error level so recon catches a wedged FX posting.
    logger.error(
      { eventId: e.event_id, eventType: e.type, detail: outcome.detail },
      "bea:gl-posting-engine — SLA interpreter rejected FX posting",
    );
    return { emitted: 0, skipped: 1 };
  }

  if (outcome.kind === "no-gl") {
    logger.info(
      { eventId: e.event_id, eventType: e.type, detail: outcome.detail },
      "bea:gl-posting-engine — FX event has no GL impact (interpreter intentional-no-impact)",
    );
    return { emitted: 0, skipped: 1 };
  }

  // outcome.kind === "post"
  const key: IdempotencyKey = `${e.event_id}:${outcome.postingType}`;
  if (postedKeys.has(key)) {
    return { emitted: 0, skipped: 1 };
  }

  // Urgent-correction alerts for any suspense leg (loud, never silent). One
  // high-severity integrity SubstrateAlert per correction — sourced directly
  // from the interpreter's returned `urgentCorrections` (the single-sourced
  // data → event mapping; impossible to forget).
  if (!ctx.dryRun && outcome.urgentCorrections.length > 0) {
    for (const correction of outcome.urgentCorrections) {
      eventStore.append(
        urgentCorrectionToSubstrateAlert(correction, {
          asOf: ctx.asOf,
          entity: e.entity ?? "LE-ZA-HOZ-BANK",
          actor: HANDLER_ACTOR,
        }),
      );
    }
    logger.warn(
      {
        eventId: e.event_id,
        eventType: e.type,
        postingType: outcome.postingType,
        unresolvedCurrencies: outcome.urgentCorrections.map((c) => c.currency),
      },
      "bea:gl-posting-engine — FX leg(s) routed to unresolved-currency suspense; urgent-correction alert raised",
    );
  }

  if (!ctx.dryRun) {
    const postingEvent = makeSubLedgerPostingEmitted({
      asOf: ctx.asOf,
      entity: e.entity ?? "LE-ZA-HOZ-BANK",
      actor: HANDLER_ACTOR,
      citations: [...GL_POSTING_CITATIONS],
      payload: {
        sourceEventId: e.event_id,
        postingType: outcome.postingType,
        legs: outcome.legs,
        postedAt: ctx.asOf,
      },
      eventId: newEventId(),
    });
    eventStore.append(postingEvent);
    postedKeys.add(key);
  }

  return { emitted: 1, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Options for {@link beaGlPostingEngine}.
 *
 * `scopeToEventIds` — when set, the engine processes ONLY source events whose
 * `event_id` is in this set. The booking path (`bookFxTrade` and the other
 * per-product handlers) passes the single just-appended trade's `eventId` so a
 * booking posts O(1) legs for its own trade and never re-runs the institution's
 * entire posting backlog inline on the request thread.
 *
 * When unset (the default), the engine replays ALL subscribed events — the
 * correct behaviour for explicit backfill / cron / on-request reconciliation
 * runs. Idempotency (the `${sourceEventId}:${postingType}` posting-key set) is
 * built over the full store in BOTH modes, so a scoped booking run that races a
 * concurrent backfill still cannot double-post.
 */
export interface BeaGlPostingOptions {
  /** Restrict processing to these source-event ids (booking-path scoping). */
  readonly scopeToEventIds?: readonly string[];
}

export async function beaGlPostingEngine(
  ctx: AgentRunContext,
  opts: BeaGlPostingOptions = {},
): Promise<AgentRunOutput> {
  const scopeSet =
    opts.scopeToEventIds && opts.scopeToEventIds.length > 0
      ? new Set<string>(opts.scopeToEventIds)
      : undefined;

  // Replay ALL subscribed events from the store (not just triggering set) so
  // that on-request / backfill runs pick up everything, and idempotency
  // remains correct regardless of trigger batch size. When `scopeSet` is
  // present (booking path), the per-event loop below skips everything outside
  // the scope — the replay still materialises only indexed-by-type rows, so the
  // scoped path is bounded by the count of subscribed events, not the store.
  const sourceEvents = [
    ...eventStore.replay({ type: "PaymentInitiated" }),
    ...eventStore.replay({ type: "PaymentSettled" }),
    ...eventStore.replay({ type: "SettlementInstructionReceived" }),
    ...eventStore.replay({ type: "FxTradeExecuted" }),
    ...eventStore.replay({ type: "FxPositionRevalued" }),
    ...eventStore.replay({ type: "TradeMatured" }),
    // FX CDM lifecycle (PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE, since 2026-05-20).
    ...eventStore.replay({ type: "PrincipalPayment" }),
    ...eventStore.replay({ type: "SettlementConfirmed" }),
    ...eventStore.replay({ type: "ConfirmationMatched" }),
    ...eventStore.replay({ type: "ConfirmationMismatch" }),
    ...eventStore.replay({ type: "SettlementFailed" }),
    ...eventStore.replay({ type: "SettlementReversed" }),
    ...eventStore.replay({ type: "TradeCancelled" }),
    // FxTradeCancelled is the FX-specific cancellation kind (PR #616).
    ...eventStore.replay({ type: "FxTradeCancelled" }),
    ...eventStore.replay({ type: "TradeAmended" }),
    // FX-lifecycle events newly cut over to the SLA interpreter (Phase 3).
    ...eventStore.replay({ type: "FxSettlementFailed" }),
    ...eventStore.replay({ type: "FxSettlementInstructed" }),
    ...eventStore.replay({ type: "TradeReportSubmitted" }),
    // Bond lifecycle events
    ...eventStore.replay({ type: "BondTradeExecuted" }),
    ...eventStore.replay({ type: "BondInterestAccrued" }),
    ...eventStore.replay({ type: "BondPositionRevalued" }),
    ...eventStore.replay({ type: "BondMatured" }),
    ...eventStore.replay({ type: "BondSold" }),
    // Equity lifecycle events
    ...eventStore.replay({ type: "EquityTradeExecuted" }),
    ...eventStore.replay({ type: "EquityPositionRevalued" }),
    ...eventStore.replay({ type: "EquityDividendAccrued" }),
    ...eventStore.replay({ type: "EquitySold" }),
    // IRD swap lifecycle events
    ...eventStore.replay({ type: "IrdSwapTradeExecuted" }),
    ...eventStore.replay({ type: "IrdSwapPositionRevalued" }),
    ...eventStore.replay({ type: "IrdSwapCouponSettled" }),
    ...eventStore.replay({ type: "IrdSwapTerminated" }),
    // Treasury lifecycle events (WS1-PR1a)
    ...eventStore.replay({ type: "RepoTradeOpened" }),
    ...eventStore.replay({ type: "DepositTaken" }),
    ...eventStore.replay({ type: "InterbankLoanPlaced" }),
  ];

  if (sourceEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "GL posting engine: 0 posted, 0 skipped, 0 errors",
      ok: true,
    };
  }

  // Build idempotency set once — avoids N² replays.
  const postedKeys = buildPostedKeySet();

  let eventsEmitted = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Cancellation leg-reconstruction needs to look up postings by their source
  // trade and the source events behind those postings. Building these indexes
  // ONCE per run (rather than full-replaying the store per posting, per
  // cancellation — the O(store²) wedge fixed here) keeps even a full backfill
  // run bounded. Lazily built: only cancellation events touch them.
  let cancellationIndex: CancellationIndex | undefined;
  const getCancellationIndex = (): CancellationIndex => {
    if (!cancellationIndex) cancellationIndex = buildCancellationIndex();
    return cancellationIndex;
  };

  for (const e of sourceEvents) {
    if (!SUBSCRIBED_TYPES.has(e.type)) continue;
    // Booking-path scoping: when invoked for a single just-booked trade, process
    // only that trade's own event. Backfill / cron runs leave scopeSet undefined
    // and process everything.
    if (scopeSet && !scopeSet.has(e.event_id)) continue;
    // Skip build-phase-fixture source events — their postings are excluded from
    // the GL projection (gl-projection.ts sourceEventIsFixture guard) and should
    // never be emitted in the first place.
    if ((e.provenance as { kind?: string } | null)?.kind === "build-phase-fixture") {
      skipped += 1;
      continue;
    }

    try {
      // -----------------------------------------------------------------------
      // FX-LIFECYCLE CUTOVER (D-SLA-ENGINE-RULES-AS-DATA Phase 3) ─────────────
      // The eight FX-lifecycle event types post via the rules-as-data SLA
      // interpreter (IFRS), NOT the legacy fx-spot.ts posting-rule functions.
      // The cutover is byte-for-byte safe — proven by the permanent parallel-run
      // regression. Enrichment (cancel reversal legs / failed-receive-leg) is
      // reconstructed HERE by the engine (which has the event stream) and handed
      // to the pure interpreter. Non-FX product families fall through to the
      // legacy dispatch below, UNTOUCHED.
      // -----------------------------------------------------------------------
      if (FX_INTERPRETER_EVENT_TYPES.has(e.type)) {
        const handled = await processFxViaInterpreter(e, ctx, postedKeys, getCancellationIndex);
        eventsEmitted += handled.emitted;
        skipped += handled.skipped;
        continue;
      }

      // -----------------------------------------------------------------------
      // Audit/control-only events — log and record idempotency key but emit
      // no SubLedgerPostingEmitted.
      // -----------------------------------------------------------------------
      if (
        e.type === "ConfirmationMatched" ||
        e.type === "ConfirmationMismatch" ||
        e.type === "SettlementFailed"
      ) {
        const postingType =
          e.type === "ConfirmationMatched"
            ? "confirmation-matched"
            : e.type === "ConfirmationMismatch"
              ? "confirmation-mismatch"
              : "settlement-failed";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        logger.info(
          { eventId: e.event_id, eventType: e.type },
          `bea:gl-posting-engine — ${e.type}: audit/control event acknowledged, no GL posting`,
        );
        // Record idempotency key even for no-GL events so replay does not
        // log them again. We store the key in the in-memory set only (not the
        // event store) — these events have no GL footprint.
        postedKeys.add(key);
        // Count as "processed" rather than "emitted" — reflected in summary.
        skipped += 1;
        continue;
      }

      // -----------------------------------------------------------------------
      // GL-generating events
      // -----------------------------------------------------------------------
      let postingType: string;
      let legs: import("../../platform/accounting/fx-accounting-types").SubLedgerLeg[];

      if (e.type === "PaymentInitiated") {
        postingType = "payment-initiation";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as PaymentInitiatedPayload;
        legs = paymentInitiatedJournals(payload);
      } else if (e.type === "PaymentSettled") {
        postingType = "payment-settlement";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as PaymentSettledPayload;
        legs = paymentSettledJournals(payload);
      } else if (e.type === "SettlementInstructionReceived") {
        postingType = "settlement-instruction";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as SettlementInstructionReceivedPayload;
        legs = settlementInstructionJournals(payload);
      } else if (e.type === "TradeMatured") {
        // PR-FX-003 (DEPRECATED 2026-05-20): Derecognition — IFRS 9 §3.2.3.
        // Retained for back-compat with legacy test-only emitters. Production
        // lifecycle now routes through PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE.
        postingType = "settlement";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as TradeMaturedFxSpotPayload;
        legs = fxSettlementJournals(payload);
      } else if (e.type === "SettlementReversed") {
        postingType = "settlement-reversal";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as SettlementReversedPayload;
        // Look up the original TradeMatured event.
        const origEvents = [...eventStore.replay({ type: "TradeMatured" })].filter(
          (ev) => ev.event_id === payload.originalSettlementEventId,
        );
        if (origEvents.length === 0) {
          throw new Error(
            `SettlementReversed: original TradeMatured event '${payload.originalSettlementEventId}' not found in store`,
          );
        }
        const origPayload = origEvents[0]?.payload as TradeMaturedFxSpotPayload;
        legs = fxSettlementReversalJournals({
          tradeId: payload.tradeId,
          originalSettlement: origPayload,
        });
      } else if (e.type === "TradeCancelled") {
        // PR-FX-CANCEL — TradeCancelled (markets-trading-extended) only. The
        // FX-specific FxTradeCancelled kind now posts via the SLA interpreter
        // (D-SLA-ENGINE-RULES-AS-DATA Phase 3) — see processFxViaInterpreter;
        // this legacy arm is retained for the non-FX TradeCancelled kind, which
        // is NOT in the FX cutover scope. Both kinds expose `tradeId: string`
        // and use the IAS-21 §28 / IFRS-9 §3.2.3 derecognition logic.
        postingType = "cancellation";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as TradeCancelledPayload | FxTradeCancelledPayload;
        // Gather all prior SubLedgerPostingEmitted for this trade to reconstruct
        // booking legs and cumulative unrealised P&L.
        //
        // Uses the per-run cancellation index (postings materialised once;
        // sourceEventId → tradeId map built once) instead of full-replaying the
        // entire store for every posting — the O(store²) wedge that previously
        // blocked the event loop for minutes on every booking.
        const cidx = getCancellationIndex();
        // For cancellation we need to compute cumulative net unrealised P&L.
        // We do this by summing all revaluation postings linked to this tradeId.
        let cumulativeUnrealisedPnlZarMinor = 0;
        const bookingLegs: import("../../platform/accounting/fx-accounting-types").SubLedgerLeg[] =
          [];
        for (const p of cidx.postings) {
          const pp = p.payload as {
            postingType?: string;
            legs?: import("../../platform/accounting/fx-accounting-types").SubLedgerLeg[];
            tradeId?: string;
          };
          if (typeof pp.postingType !== "string" || !Array.isArray(pp.legs)) continue;
          const sourceEventId = (p.payload as { sourceEventId?: string }).sourceEventId;
          if (!sourceEventId) continue;
          // Look up the source event's tradeId via the prebuilt index. tradeId on
          // source events may be either a string (TradeCancelled,
          // FxPositionRevalued, etc.) or an identifier object with `{value}`
          // (FxTradeExecuted — see fxTradeBookingJournals call site above); the
          // index already normalised both shapes to the string form. A source
          // event not present in the index has no tradeId — skip it (same effect
          // as the previous "source event not found / no tradeId" continue).
          const srcTradeIdValue = cidx.tradeIdBySourceEvent.get(sourceEventId);
          if (!srcTradeIdValue || srcTradeIdValue !== payload.tradeId) continue;

          if (pp.postingType === "trade-booking") {
            bookingLegs.push(...pp.legs);
          } else if (pp.postingType === "revaluation") {
            // Accumulate gross unrealised P&L from ZAR legs (TradeCancelled,
            // non-FX). The UNREALISED_PNL account credit = gain, debit = loss.
            // For the non-FX TradeCancelled kind the fx-posting-engine does not
            // fire, so this accumulator is the only mechanism that undoes the
            // cumulative P&L.
            for (const leg of pp.legs) {
              if (leg.currency === "ZAR") {
                if (leg.accountId === "ACC-2100-005") {
                  cumulativeUnrealisedPnlZarMinor +=
                    leg.debitCredit === "credit" ? leg.amountMinor : -leg.amountMinor;
                }
              }
            }
          }
        }
        legs = fxCancellationJournals({
          tradeId: payload.tradeId,
          cumulativeUnrealisedPnlZarMinor,
          bookingLegs,
        });
      } else if (e.type === "TradeAmended") {
        postingType = "amendment";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as TradeAmendedPayload;
        // For rate/notional amendments, compute the delta from old/new values.
        // Values are stored as strings in the event; parse to numbers.
        let deltaZarMinor = 0;
        if (payload.field === "rate" || payload.field === "notional") {
          const oldVal = Number.parseFloat(payload.oldValue);
          const newVal = Number.parseFloat(payload.newValue);
          if (!Number.isNaN(oldVal) && !Number.isNaN(newVal)) {
            // deltaZarMinor is the difference in ZAR minor units.
            // Convention: values are already in ZAR minor units (integer).
            deltaZarMinor = Math.round(newVal - oldVal);
          }
        }
        legs = fxAmendmentJournals({
          tradeId: payload.tradeId,
          field: payload.field,
          deltaZarMinor,
        });
      } else if (e.type === "BondTradeExecuted") {
        // PR-BOND-001: Initial recognition — IFRS 9 §3.1.1, §5.1.1
        postingType = "bond-trade-booking";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as BondTradeExecutedPayload;
        legs =
          payload.portfolio === "banking-book"
            ? bondBankingBookJournals(payload)
            : bondTradingBookJournals(payload);
      } else if (e.type === "BondInterestAccrued") {
        // PR-BOND-002: EIR accrual — IFRS 9 §5.4.1
        postingType = "bond-interest-accrual";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as BondInterestAccruedPayload;
        legs = bondInterestAccrualJournals(payload);
      } else if (e.type === "BondPositionRevalued") {
        // PR-BOND-003: Trading-book FVTPL revaluation — IFRS 9 §5.7.1
        postingType = "bond-revaluation";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as BondPositionRevaluedPayload;
        legs = bondRevaluationJournals(payload);
      } else if (e.type === "BondMatured") {
        // PR-BOND-004: Derecognition at maturity — IFRS 9 §3.2.3
        postingType = "bond-maturity";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as BondMaturedPayload;
        // Portfolio tracked via position projection; default banking-book for maturity
        // (trading-book bonds are typically sold, not held to maturity)
        legs = bondMaturityJournals(payload, "banking-book");
      } else if (e.type === "BondSold") {
        // PR-BOND-005: Derecognition on sale — IFRS 9 §3.2.3
        postingType = "bond-sale";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as BondSoldPayload;
        // Portfolio comes from position state; default trading-book for sales
        legs = bondSaleJournals(payload, "trading-book");
      } else if (e.type === "EquityTradeExecuted") {
        // PR-EQ-001: Initial recognition — IFRS 9 §4.1.4 (FVTPL via CDM trading-book)
        postingType = "equity-trade-booking";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as EquityTradeExecutedPayload;
        legs = equityTradeBookingJournals(payload);
      } else if (e.type === "EquityPositionRevalued") {
        // PR-EQ-002: FVTPL → P&L (§5.7.1); FVOCI → OCI reserve (§5.7.5)
        postingType = "equity-revaluation";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as EquityPositionRevaluedPayload;
        legs = equityRevaluationJournals(payload);
      } else if (e.type === "EquityDividendAccrued") {
        // PR-EQ-003: Dividend accrual — IFRS 9 §5.7.1A; IAS 32 §35
        postingType = "equity-dividend-accrual";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as EquityDividendAccruedPayload;
        legs = equityDividendJournals(payload);
      } else if (e.type === "EquitySold") {
        // PR-EQ-004: Derecognition on sale — IFRS 9 §3.2.3; FVOCI no-recycling §5.7.5
        postingType = "equity-sale";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as EquitySoldPayload;
        legs = equitySaleJournals(payload);
      } else if (e.type === "IrdSwapTradeExecuted") {
        // PR-IRS-001: Initial recognition — IFRS 9 §4.1.4
        postingType = "ird-swap-trade-booking";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as IrdSwapTradeExecutedPayload;
        legs = irdSwapTradeBookingJournals(payload);
      } else if (e.type === "IrdSwapPositionRevalued") {
        // PR-IRS-002: FVTPL NPV re-measurement — IFRS 9 §5.7.1
        postingType = "ird-swap-revaluation";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as IrdSwapPositionRevaluedPayload;
        legs = irdSwapRevaluationJournals(payload);
      } else if (e.type === "IrdSwapCouponSettled") {
        // PR-IRS-003: Net coupon cash settlement
        postingType = "ird-swap-coupon-settlement";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as IrdSwapCouponSettledPayload;
        legs = irdSwapCouponJournals(payload);
      } else if (e.type === "IrdSwapTerminated") {
        // PR-IRS-TERM: Derecognition on termination — IFRS 9 §3.2.3
        postingType = "ird-swap-termination";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as IrdSwapTerminatedPayload;
        legs = irdSwapTerminationJournals(payload);
      } else if (e.type === "RepoTradeOpened") {
        // PR-REPO-001: Secured borrowing recognition — IAS 39 §27; IFRS 9 §3.1.1
        postingType = "repo-trade-booking";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as RepoTradeOpenedPayload;
        legs = prRepo001(payload);
      } else if (e.type === "DepositTaken") {
        // PR-MMD-001: Deposit liability recognition — IFRS 9 §3.1.1; BA 325 Table 1
        postingType = "deposit-taken";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as DepositTakenPayload;
        legs = prMmd001(payload);
      } else if (e.type === "InterbankLoanPlaced") {
        // PR-IBL-001: Due-from-banks asset recognition — IFRS 9 §3.1.1; §4.1.2
        postingType = "ibl-placement";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as InterbankLoanPlacedPayload;
        legs = prIbl001(payload);
      } else {
        // Unreachable — SUBSCRIBED_TYPES guard above.
        continue;
      }

      if (legs.length === 0) {
        logger.info(
          { eventId: e.event_id, eventType: e.type, postingType },
          "bea:gl-posting-engine — posting rule produced zero legs (expected for non-economic amendments); skipping",
        );
        postedKeys.add(`${e.event_id}:${postingType}`);
        skipped += 1;
        continue;
      }

      // ── STOP-THE-BLEEDING urgent-correction alert (deliverable 4) ──────────
      // Any leg routed to the FX unresolved-currency suspense account
      // (ACC-2100-007) is a non-ZAR/USD currency with no dedicated COA account
      // — the per-currency correction (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE)
      // that REPLACED the silent default→USD mis-booking. The entry still
      // balances; we raise ONE high-severity integrity SubstrateAlert per
      // distinct unresolved currency so the suspense routing is NEVER silent.
      // This is the loud companion to the live-path fix in fx-spot.ts.
      const unresolvedCurrencies = detectUnresolvedCurrencyLegs(legs);
      if (unresolvedCurrencies.length > 0 && !ctx.dryRun) {
        for (const ccy of unresolvedCurrencies) {
          eventStore.append(
            makeSubstrateAlert({
              asOf: ctx.asOf,
              entity: e.entity ?? "LE-ZA-HOZ-BANK",
              actor: HANDLER_ACTOR,
              citations: [
                "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
                "Principles/5-multi-currency-entity-country.md",
              ],
              payload: {
                alertId: `alert:integrity:sla-unresolved-currency-${ccy.toLowerCase()}`,
                alertClass: "integrity",
                severity: "high",
                details: `FX posting (${postingType}, source ${e.event_id}) routed a ${ccy} leg to the FX unresolved-currency suspense ACC-2100-007 because the COA has no dedicated per-currency FX account for ${ccy}. The entry balances but the leg sits in suspense. URGENT CORRECTION: provision a dedicated ${ccy} FX account (CFO COA-expansion / accounting-policy call) and re-book. The USD account is USD-only — never a fallback (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).`,
              },
            }),
          );
        }
        logger.warn(
          { eventId: e.event_id, eventType: e.type, postingType, unresolvedCurrencies },
          "bea:gl-posting-engine — FX leg(s) routed to unresolved-currency suspense; urgent-correction alert raised",
        );
      }

      // Validate balance per currency before emitting (belt-and-suspenders —
      // posting rules call assertBalanced internally, but we catch errors here).
      if (!ctx.dryRun) {
        const postingEvent = makeSubLedgerPostingEmitted({
          asOf: ctx.asOf,
          entity: e.entity ?? "LE-ZA-HOZ-BANK",
          actor: HANDLER_ACTOR,
          citations: [...GL_POSTING_CITATIONS],
          payload: {
            sourceEventId: e.event_id,
            postingType: postingType as
              | "payment-initiation"
              | "payment-settlement"
              | "settlement-instruction"
              | "trade-booking"
              | "revaluation"
              | "settlement"
              | "settlement-reversal"
              | "cancellation"
              | "amendment"
              | "bond-trade-booking"
              | "bond-interest-accrual"
              | "bond-revaluation"
              | "bond-maturity"
              | "bond-sale"
              | "equity-trade-booking"
              | "equity-revaluation"
              | "equity-dividend-accrual"
              | "equity-sale"
              | "ird-swap-trade-booking"
              | "ird-swap-revaluation"
              | "ird-swap-coupon-settlement"
              | "ird-swap-termination"
              | "fx-principal-payment"
              | "fx-lifecycle-close"
              | "repo-trade-booking"
              | "deposit-taken"
              | "ibl-placement",
            legs,
            postedAt: ctx.asOf,
          },
          eventId: newEventId(),
        });
        eventStore.append(postingEvent);
        // Add to in-memory set so subsequent events in the same run don't
        // double-post (covers re-entrant / batched runs).
        postedKeys.add(`${e.event_id}:${postingType}`);
      }

      eventsEmitted += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        { eventId: e.event_id, eventType: e.type, error: msg },
        "bea:gl-posting-engine — error processing event",
      );
      errors.push(`${e.type}(${e.event_id}): ${msg}`);
    }
  }

  const ok = errors.length === 0;
  const summary = `GL posting engine: ${eventsEmitted} posted, ${skipped} skipped, ${errors.length} errors`;

  logger.info({ eventsEmitted, skipped, errors: errors.length }, "bea:gl-posting-engine — done");

  return {
    eventsEmitted,
    summary,
    ok,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

export default beaGlPostingEngine;
