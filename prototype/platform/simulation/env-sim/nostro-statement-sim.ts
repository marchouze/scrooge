// platform/simulation/env-sim/nostro-statement-sim.ts
//
// NostroStatementSimulator — emits simulated daily MT940 and camt.053
// nostro bank statements as InboundMessageReceived events.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-CLS-MEMBERSHIP.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { newEventId, nowUtc } from "../../core/types";
import { makeInboundMessageReceived } from "../../event-store/event-types/payments";
import type { EventStore } from "../../event-store/store";
import type { Camt053Entry } from "../../payments/iso20022/camt053";
import { generateCamt053 } from "../../payments/iso20022/camt053";
import type { Mt940Entry } from "../../payments/swift-mt/mt940";
import { generateMt940 } from "../../payments/swift-mt/mt940";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR = { type: "service" as const, id: "agent:env:nostro-statement-sim" };
const ENTITY = "BANK-ZA-001";
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "D-FX-CLS-MEMBERSHIP"];
const CORRESPONDENT_BIC = "SBZAZAJJXXX";
const NOSTRO_IBAN = "ZA00BANK0000000000000";
const NOSTRO_CURRENCY = "ZAR";
const BANK_BIC = "BANKZAJJXXX";

// ---------------------------------------------------------------------------
// NostroStatementSimulator
// ---------------------------------------------------------------------------

export class NostroStatementSimulator {
  private readonly store: EventStore;
  private readonly rng: () => number;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    store: EventStore,
    rng: () => number,
    options: { intervalMs: number },
  ) {
    this.store = store;
    this.rng = rng;
    this.intervalMs = options.intervalMs;
  }

  /** Start emitting statements. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      this.emitStatement();
    }, this.intervalMs);
  }

  /** Stop. Idempotent. */
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

  private emitStatement(): void {
    const now = nowUtc();
    const statementDate = new Date();

    // Look up settled trades since last tick.
    const settledEvents: Array<{ payload: Record<string, unknown> }> = [];
    try {
      for (const evt of this.store.replay({ type: "SettlementConfirmed" })) {
        settledEvents.push({ payload: evt.payload as Record<string, unknown> });
      }
    } catch {
      // store.replay may not be available in test mocks — emit empty statement.
    }

    // Build MT940 entries from settled trades.
    const mt940Entries: Mt940Entry[] = settledEvents.map((evt) => {
      const payload = evt.payload as Record<string, unknown>;
      const currency = typeof payload.currencyPair === "string"
        ? payload.currencyPair.split("/")[0] ?? NOSTRO_CURRENCY
        : NOSTRO_CURRENCY;
      return {
        valueDate: statementDate,
        creditDebitMark: "C" as const,
        amountMinor: 100_000_00n, // simulated receive amount
        currency,
        transactionTypeCode: "FXCF",
        customerReference: String(payload.tradeId ?? "SIM"),
        narrative: `FX settlement — trade ${String(payload.tradeId ?? "SIM")}`,
      };
    });

    // Opening balance (simulated).
    const openingBalance = BigInt(Math.floor(this.rng() * 100_000_000)) * 100n + 50_000_000_00n;

    // Generate MT940.
    const mt940 = generateMt940({
      accountId: NOSTRO_IBAN,
      correspondentBic: CORRESPONDENT_BIC,
      statementDate,
      openingBalance,
      entries: mt940Entries,
      currency: NOSTRO_CURRENCY,
      statementNumber: 1,
      sequenceNumber: 1,
      receiverBic: BANK_BIC,
    });

    // Emit MT940 as InboundMessageReceived.
    this.store.append(
      makeInboundMessageReceived({
        asOf: now,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "NOSTRO-STMT",
          messageId: `MT940-${statementDate.toISOString().slice(0, 10)}-${newEventId().slice(-8)}`,
          messageStandard: "MT940",
          direction: "inbound",
          serialisedMessage: mt940.serialised,
          senderBic: CORRESPONDENT_BIC,
          receivedAt: now,
          citations: CITATIONS,
        },
      }),
    );

    // Generate camt.053 entries.
    const camt053Entries: Camt053Entry[] = settledEvents.map((evt) => {
      const payload = evt.payload as Record<string, unknown>;
      return {
        amountMinor: 100_000_00n,
        currency: NOSTRO_CURRENCY,
        CdtDbtInd: "CRDT" as const,
        BookgDt: statementDate,
        ValDt: statementDate,
        BkTxCd: {
          Prtry: { Cd: "FXCF", Issr: "INTERNAL" },
        },
        NtryDtls: {
          TxRef: String(payload.tradeId ?? "SIM"),
          Ustrd: `FX settlement — trade ${String(payload.tradeId ?? "SIM")}`,
        },
      };
    });

    // Generate camt.053.
    const camt053 = generateCamt053({
      accountIban: NOSTRO_IBAN,
      correspondentBic: CORRESPONDENT_BIC,
      statementDate,
      openingBalance,
      entries: camt053Entries,
      currency: NOSTRO_CURRENCY,
    });

    // Emit camt.053 as InboundMessageReceived.
    this.store.append(
      makeInboundMessageReceived({
        asOf: now,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "NOSTRO-STMT",
          messageId: `CAMT053-${statementDate.toISOString().slice(0, 10)}-${newEventId().slice(-8)}`,
          messageStandard: "camt.053",
          direction: "inbound",
          serialisedMessage: camt053.serialised,
          senderBic: CORRESPONDENT_BIC,
          receivedAt: now,
          citations: CITATIONS,
        },
      }),
    );
  }
}
