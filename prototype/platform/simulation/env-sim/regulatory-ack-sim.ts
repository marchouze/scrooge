// platform/simulation/env-sim/regulatory-ack-sim.ts
//
// RegulatoryAckSim — polls for OutboundMessageDispatched events matching
// regulatory reports (BA-* returns or "regulatory" messages), and after a
// short delay emits a simulated SARB acknowledgement as InboundMessageReceived.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { newEventId, nowUtc } from "../../core/types";
import { makeInboundMessageReceived } from "../../event-store/event-types/payments";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR = { type: "service" as const, id: "agent:env:regulatory-ack-sim" };
const ENTITY = "BANK-ZA-001";
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION"];
const SARB_BIC = "SARB0000XXX";
const POLL_INTERVAL_MS = 1_000;
const ACK_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// RegulatoryAckSim
// ---------------------------------------------------------------------------

export class RegulatoryAckSim {
  private readonly store: EventStore;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private processedEventIds = new Set<string>();
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
    const newEvents: Event[] = [];
    try {
      for (const evt of this.store.replay({ fromSequence: this.lastProcessedSequence + 1 })) {
        newEvents.push(evt);
      }
    } catch {
      return; // store.replay may not be available in test mocks.
    }

    for (const evt of newEvents) {
      const seq = (evt as unknown as { sequence?: number }).sequence;
      if (seq !== undefined && seq > this.lastProcessedSequence) {
        this.lastProcessedSequence = seq;
      }

      if (evt.type !== "OutboundMessageDispatched") continue;
      if (this.processedEventIds.has(evt.event_id)) continue;

      const payload = evt.payload as Record<string, unknown>;
      const messageType = String(payload.messageType ?? "");
      const isRegulatory =
        messageType.startsWith("BA-") || messageType.toLowerCase().includes("regulatory");

      if (!isRegulatory) continue;

      this.processedEventIds.add(evt.event_id);
      const eventId = evt.event_id;

      // Emit after delay.
      setTimeout(() => {
        this.emitAck(eventId, messageType);
      }, ACK_DELAY_MS);
    }
  }

  private emitAck(relatedEventId: string, messageType: string): void {
    if (!this.running) return;
    const now = nowUtc();
    try {
      this.store.append(
        makeInboundMessageReceived({
          asOf: now,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId: relatedEventId,
            messageId: `SARB-ACK-${newEventId().slice(-12)}`,
            messageStandard: "REGULATORY-ACK",
            direction: "inbound",
            serialisedMessage: `ACK — SARB received message type ${messageType} (ref: ${relatedEventId})`,
            senderBic: SARB_BIC,
            receivedAt: now,
            citations: CITATIONS,
          },
        }),
      );
    } catch (err) {
      console.error("[RegulatoryAckSim] error emitting ack:", err);
    }
  }
}
