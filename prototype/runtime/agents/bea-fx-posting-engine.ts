// runtime/agents/bea-fx-posting-engine.ts
//
// Bea's FX posting engine — wires FX lifecycle events to balanced
// double-entry GL postings via the three pure posting-rule functions
// in `platform/accounting/posting-rules/fx-spot.ts`.
//
// Subscriptions:
//   - FxTradeExecuted       → PR-FX-001: fxTradeBookingJournals()
//   - FxPositionRevalued    → PR-FX-002: fxRevaluationJournals()
//   - TradeMatured → PR-FX-003: fxSettlementJournals()
//
// Each posting rule returns SubLedgerLeg[]. This handler wraps each
// result in a `SubLedgerPostingEmitted` event, which the period-close
// projection (Anya / computeTrialBalance) consumes.
//
// Authority:
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - D-MARKETS-SCHEMA-FOUNDATION  (CEO-approved 2026-05-07)
//   - IFRS 9 §3.1.1, §4.1.1, §5.7.1
//   - IAS 21 §21, §28
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  fxRevaluationJournals,
  fxSettlementJournals,
  fxTradeBookingJournals,
} from "../../platform/accounting/posting-rules/fx-spot";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeSubLedgerPostingEmitted } from "../../platform/event-store/event-types/fx-accounting";
import type {
  FxPositionRevaluedPayload,
  FxTradeCancelledPayload,
  SubLedgerLeg,
} from "../../platform/event-store/event-types/fx-accounting";
import type { TradeMaturedFxSpotPayload } from "../../platform/event-store/event-types/trade-matured";
import type { FxTradeExecutedPayload } from "../../platform/markets/cdm/fx";
import type { AgentRunContext, AgentRunOutput } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:bea:fx-posting-engine",
};

const FX_POSTING_CITATIONS: readonly string[] = [
  "D-MARKETS-CAPITAL-TIME-SHAPE",
  "D-MARKETS-SCHEMA-FOUNDATION",
];

const SUBSCRIBED_TYPES = new Set<string>([
  "FxTradeExecuted",
  "FxPositionRevalued",
  "TradeMatured",
  "FxTradeCancelled",
]);

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

type IdempotencyKey = string;

function buildPostedKeySet(): Set<IdempotencyKey> {
  const keys = new Set<IdempotencyKey>();
  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as { sourceEventId?: unknown; postingType?: unknown };
    if (typeof p.sourceEventId === "string" && typeof p.postingType === "string") {
      keys.add(`${p.sourceEventId}:${p.postingType}`);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Engine (named export for on-request / backfill callers)
// ---------------------------------------------------------------------------

export async function beaFxPostingEngine(ctx: AgentRunContext): Promise<AgentRunOutput> {
  // On-request mode: replay all FX events from store.
  // Event-driven mode: use only the triggering set.
  const triggeringEvents = ctx.trigger.triggeringEvents ?? [];
  const relevant =
    triggeringEvents.length > 0
      ? triggeringEvents.filter((e) => SUBSCRIBED_TYPES.has(e.type))
      : [
          ...eventStore.replay({ type: "FxTradeExecuted" }),
          ...eventStore.replay({ type: "FxPositionRevalued" }),
          ...eventStore.replay({ type: "TradeMatured" }),
          ...eventStore.replay({ type: "FxTradeCancelled" }),
        ];

  if (relevant.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "FX posting engine: 0 posted, 0 skipped, 0 errors",
      ok: true,
    };
  }

  const postedKeys = buildPostedKeySet();

  let eventsEmitted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const e of relevant) {
    try {
      if (e.type === "FxTradeExecuted") {
        // PR-FX-001: initial recognition of the FX trade at trade date.
        if (postedKeys.has(`${e.event_id}:trade-booking`)) {
          skipped += 1;
          continue;
        }

        const payload = e.payload as FxTradeExecutedPayload;
        const legs = fxTradeBookingJournals({
          tradeId: payload.tradeId.value,
          side: payload.side,
          legs: payload.legs,
          currencyPair: payload.currencyPair,
        });

        if (legs.length === 0) {
          logger.warn(
            { eventId: e.event_id },
            "bea:fx-posting-engine — FxTradeExecuted produced zero legs; skipping (no near leg?)",
          );
          skipped += 1;
          continue;
        }

        if (!ctx.dryRun) {
          eventStore.append(
            makeSubLedgerPostingEmitted({
              asOf: ctx.asOf,
              entity: e.entity ?? "LE-ZA-HOZ-BANK",
              actor: HANDLER_ACTOR,
              citations: [...FX_POSTING_CITATIONS],
              payload: {
                sourceEventId: e.event_id,
                postingType: "trade-booking",
                legs,
                postedAt: ctx.asOf,
              },
              eventId: newEventId(),
            }),
          );
          postedKeys.add(`${e.event_id}:trade-booking`);
          eventsEmitted += 1;
        }
      } else if (e.type === "FxPositionRevalued") {
        // PR-FX-002: daily FVTPL revaluation. Zero-delta → fxRevaluationJournals
        // returns [] and we skip emission (no-op revaluation).
        if (postedKeys.has(`${e.event_id}:revaluation`)) {
          skipped += 1;
          continue;
        }

        const payload = e.payload as FxPositionRevaluedPayload;
        const legs = fxRevaluationJournals(payload);

        if (legs.length === 0) {
          // Zero-delta — no posting required (IFRS 9 §5.7.1: only changes
          // in fair value are recognised; a zero change produces no entry).
          logger.debug(
            { eventId: e.event_id, tradeId: payload.tradeId },
            "bea:fx-posting-engine — FxPositionRevalued zero-delta; no posting emitted",
          );
          skipped += 1;
          continue;
        }

        if (!ctx.dryRun) {
          eventStore.append(
            makeSubLedgerPostingEmitted({
              asOf: ctx.asOf,
              entity: e.entity ?? "LE-ZA-HOZ-BANK",
              actor: HANDLER_ACTOR,
              citations: [...FX_POSTING_CITATIONS],
              payload: {
                sourceEventId: e.event_id,
                postingType: "revaluation",
                legs,
                postedAt: ctx.asOf,
              },
              eventId: newEventId(),
            }),
          );
          postedKeys.add(`${e.event_id}:revaluation`);
          eventsEmitted += 1;
        }
      } else if (e.type === "TradeMatured") {
        // PR-FX-003: T+2 settlement — derecognises receivable/payable,
        // recognises nostro cash legs, crystallises realised P&L.
        if (postedKeys.has(`${e.event_id}:settlement`)) {
          skipped += 1;
          continue;
        }

        const payload = e.payload as TradeMaturedFxSpotPayload;
        const legs = fxSettlementJournals(payload);

        if (legs.length === 0) {
          logger.warn(
            { eventId: e.event_id, tradeId: payload.tradeId },
            "bea:fx-posting-engine — TradeMatured produced zero legs; skipping",
          );
          skipped += 1;
          continue;
        }

        if (!ctx.dryRun) {
          eventStore.append(
            makeSubLedgerPostingEmitted({
              asOf: ctx.asOf,
              entity: e.entity ?? "LE-ZA-HOZ-BANK",
              actor: HANDLER_ACTOR,
              citations: [...FX_POSTING_CITATIONS],
              payload: {
                sourceEventId: e.event_id,
                postingType: "settlement",
                legs,
                postedAt: ctx.asOf,
              },
              eventId: newEventId(),
            }),
          );
          postedKeys.add(`${e.event_id}:settlement`);
          eventsEmitted += 1;
        }
      } else if (e.type === "FxTradeCancelled") {
        // PR-FX-004: cancellation reversal — for each prior revaluation posting
        // on this trade, emit a reversing SubLedgerPostingEmitted that flips
        // every debit→credit and credit→debit. This nulls out the phantom MTM
        // movements in the GL for voided trades (IFRS 9: derecognition).
        //
        // Idempotency key: `<cancel_event_id>:revaluation-reversal:<source_event_id>`
        // so each source revaluation is reversed at most once per cancellation.

        const payload = e.payload as FxTradeCancelledPayload;
        const { tradeId } = payload;

        // Collect all FxPositionRevalued event IDs for this trade.
        const revalEventIds = new Set<string>();
        for (const re of eventStore.replay({ type: "FxPositionRevalued" })) {
          const rp = re.payload as FxPositionRevaluedPayload;
          if (rp.tradeId === tradeId) revalEventIds.add(re.event_id);
        }

        if (revalEventIds.size === 0) {
          // No revaluation postings to reverse — trade cancelled before any MTM.
          skipped += 1;
          continue;
        }

        // Idempotency guard for this cancellation event. The persisted
        // SubLedgerPostingEmitted carries `postingType: "reversal"` and
        // `sourceEventId: <cancellation_event_id>` — the same tuple is
        // re-used for every reversed revaluation under this cancellation.
        // `buildPostedKeySet` therefore collapses N reversals to a single
        // `${event_id}:reversal` key. We can't tell from the persisted form
        // alone whether some-but-not-all reversals have been emitted, so
        // the cleanest idempotency rule is: if ANY reversal posting exists
        // for this cancellation event, the cancellation has already been
        // processed — skip the whole arm. This matches the contract that
        // `bun run gl:backfill-postings` is idempotent across runs.
        //
        // Historical note: the in-memory `reversalKey` of
        // `${e.event_id}:revaluation-reversal:<src>` never matched
        // `buildPostedKeySet` (which emits `${event_id}:reversal`), so
        // every backfill run re-emitted N reversals — the source of the
        // run-away `reversal` count seen in the shared store on
        // 2026-05-21 (60 reversals against 15 revaluations).
        if (postedKeys.has(`${e.event_id}:reversal`)) {
          skipped += 1;
          continue;
        }

        // For each revaluation posting that was emitted for these events, emit
        // a reversing entry.
        for (const re of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
          const rp = re.payload as {
            sourceEventId?: string;
            postingType?: string;
            legs?: SubLedgerLeg[];
            postedAt?: string;
          };
          if (
            rp.postingType !== "revaluation" ||
            !rp.sourceEventId ||
            !revalEventIds.has(rp.sourceEventId)
          )
            continue;

          // Belt-and-suspenders: also retain the per-source synthetic key
          // for runs inside a single invocation (multiple revaluations →
          // multiple reversals before any commit to the store).
          const reversalKey = `${e.event_id}:revaluation-reversal:${rp.sourceEventId}`;
          if (postedKeys.has(reversalKey)) {
            skipped += 1;
            continue;
          }

          const reversedLegs: SubLedgerLeg[] = (rp.legs ?? []).map((leg) => ({
            ...leg,
            debitCredit: leg.debitCredit === "debit" ? "credit" : "debit",
          }));

          if (reversedLegs.length === 0) {
            skipped += 1;
            continue;
          }

          if (!ctx.dryRun) {
            eventStore.append(
              makeSubLedgerPostingEmitted({
                asOf: ctx.asOf,
                entity: e.entity ?? "LE-ZA-HOZ-BANK",
                actor: HANDLER_ACTOR,
                citations: [...FX_POSTING_CITATIONS],
                payload: {
                  sourceEventId: e.event_id,
                  postingType: "reversal",
                  legs: reversedLegs,
                  postedAt: ctx.asOf,
                },
                eventId: newEventId(),
              }),
            );
            postedKeys.add(reversalKey);
            eventsEmitted += 1;
          }
        }
        // Mark the cancellation's canonical persisted-key form once, so
        // the next backfill run's outer guard short-circuits the arm.
        postedKeys.add(`${e.event_id}:reversal`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        { eventId: e.event_id, eventType: e.type, error: msg },
        "bea:fx-posting-engine — error processing event",
      );
      errors.push(`${e.type}(${e.event_id}): ${msg}`);
    }
  }

  const ok = errors.length === 0;
  const summary = `FX posting engine: ${eventsEmitted} posted, ${skipped} skipped, ${errors.length} errors`;

  logger.info({ eventsEmitted, skipped, errors: errors.length }, "bea:fx-posting-engine — done");

  return {
    eventsEmitted,
    summary,
    ok,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

export default beaFxPostingEngine;
