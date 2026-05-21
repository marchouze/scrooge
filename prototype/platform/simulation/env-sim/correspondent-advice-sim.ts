// platform/simulation/env-sim/correspondent-advice-sim.ts
//
// CorrespondentAdviceSim — polls the event store for new PrincipalPayment
// events with legKind "receive" and emits simulated MT202 credit advices
// as InboundMessageReceived events.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-CLS-MEMBERSHIP.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { newEventId, nowUtc } from "../../core/types";
import { makeInboundMessageReceived } from "../../event-store/event-types/payments";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR = { type: "service" as const, id: "agent:env:correspondent-advice-sim" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "D-FX-CLS-MEMBERSHIP"];
const CORRESPONDENT_BIC = "SBZAZAJJXXX";
const POLL_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------
// CorrespondentAdviceSim
// ---------------------------------------------------------------------------

export class CorrespondentAdviceSim {
  private readonly store: EventStore;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastProcessedSequence = 0;

  constructor(store: EventStore) {
    this.store = store;
  }

  /** Start polling. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      this.poll();
    }, POLL_INTERVAL_MS);
  }

  /** Stop polling. Idempotent. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private poll(): void {
    const newEvents: Array<Event & { sequence?: number }> = [];
    try {
      for (const evt of this.store.replay({ fromSequence: this.lastProcessedSequence + 1 })) {
        newEvents.push(evt as Event & { sequence?: number });
      }
    } catch {
      return; // store.replay may not be available in test mocks.
    }

    for (const evt of newEvents) {
      const seq = (evt as unknown as { sequence?: number }).sequence;
      if (seq !== undefined && seq > this.lastProcessedSequence) {
        this.lastProcessedSequence = seq;
      }

      if (evt.type !== "PrincipalPayment") continue;
      const payload = evt.payload as Record<string, unknown>;
      if (payload.legKind !== "receive") continue;

      this.emitAdvice(payload);
    }
  }

  private emitAdvice(payload: Record<string, unknown>): void {
    const now = nowUtc();
    const tradeId = String(payload.tradeId ?? "SIM");
    const currency = String(payload.currency ?? "ZAR");
    const netCash = typeof payload.netCash === "number" ? Math.abs(payload.netCash) : 0;
    const settlementDate = String(payload.settlementDate ?? now.slice(0, 10));
    const correspondent = (payload.correspondent as { bic?: string } | undefined) ?? {};
    const senderBic = correspondent.bic ?? CORRESPONDENT_BIC;

    // Simulated MT202 body.
    const trn = `${tradeId.slice(-14)}-R`;
    const relatedRef = tradeId.slice(-16);
    const amountStr = (netCash / 100).toFixed(2);
    const dateTag = settlementDate.replace(/-/g, "").slice(2); // YYMMDD

    const mt202Body = [
      `{1:F01${senderBic}0000000000}`,
      "{2:I202BANKZAJJXXXXN}",
      "{4:",
      `:20:${trn.slice(0, 16)}`,
      `:21:${relatedRef.slice(0, 16)}`,
      `:32A:${dateTag}${currency}${amountStr.replace(".", ",")}`,
      `:53B:/${senderBic}`,
      ":57A:BANKZAJJXXX",
      ":58A:BANKZAJJXXX",
      ":72:/BNF/FX SETTLEMENT RECEIVE LEG",
      `//TRADE ${tradeId}`,
      "-}",
    ].join("\n");

    try {
      this.store.append(
        makeInboundMessageReceived({
          asOf: now,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId,
            messageId: `MT202-${tradeId.slice(-12)}-${newEventId().slice(-8)}`,
            messageStandard: "MT202",
            direction: "inbound",
            serialisedMessage: mt202Body,
            senderBic,
            receivedAt: now,
            citations: CITATIONS,
          },
        }),
      );
    } catch (err) {
      console.error("[CorrespondentAdviceSim] error emitting MT202:", err);
    }
  }
}
