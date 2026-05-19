// platform/payments/inbound-simulator.ts
//
// FX Inbound Message Simulator
//
// Given a completed FX trade, simulate all inbound messages that the
// correspondent bank / counterparty would send back. This covers:
//
//   - MT300 confirmation (counterparty echoes the trade)
//   - MT202 receive leg (when bank is buyer, currency flows in)
//   - MT940 nostro statement (daily statement with the entry)
//   - pacs.009 receive leg (ISO 20022 equivalent of MT202)
//   - camt.053 statement (ISO 20022 equivalent of MT940)
//
// The simulator selects the appropriate message format based on the trade's
// messageStandard field from FxSettlementInstructed, or defaults to both
// SWIFT MT and ISO 20022 if messageStandard is not specified.
//
// This is a simulation layer — the messages are structurally correct but
// do not represent real correspondent bank communications. They are used
// in scenario testing, reconciliation dry-runs, and the nostro-recon
// substrate.
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   PROC-PAY-RBH-01 — three-way reconciliation procedure
//   D-FX-MESSAGE-EVENTS — event-log wiring for inbound message receipt
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import { BANK_ZA_001 } from "@platform/core/types";
import {
  makeInboundMessageReceived,
  makeMessageCorrelated,
} from "@platform/event-store/event-types/payments";
import type { EventStore } from "@platform/event-store/store";
import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import type { Camt053Entry } from "./iso20022/camt053";
import { type Camt053Document, generateCamt053 } from "./iso20022/camt053";
import { type Pacs009Document, generatePacs009 } from "./iso20022/pacs009";
import type { FIIdentification } from "./iso20022/types";
import { type Mt202Message, generateMt202 } from "./swift-mt/mt202";
import { type Mt300Message, generateMt300 } from "./swift-mt/mt300";
import { type Mt940Message, generateMt940 } from "./swift-mt/mt940";
import type { Mt940Entry } from "./swift-mt/mt940";

// ---------------------------------------------------------------------------
// InboundMessageSet
// ---------------------------------------------------------------------------

export interface InboundMessageSet {
  tradeId: string;
  /** MT300 trade confirmation (counterparty echoes the trade). */
  mt300Confirmation?: Mt300Message;
  /**
   * MT202 receive leg — when the bank is the buyer, the correspondent sends
   * an MT202 confirming that the bought currency has been credited.
   */
  mt202ReceiveLeg?: Mt202Message;
  /** MT940 daily nostro statement with the trade entry. */
  mt940Statement?: Mt940Message;
  /** pacs.009 receive leg (ISO 20022 equivalent of MT202). */
  pacs009ReceiveLeg?: Pacs009Document;
  /** camt.053 end-of-day statement (ISO 20022 equivalent of MT940). */
  camt053Statement?: Camt053Document;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Default correspondent BIC used when none is provided. */
const DEFAULT_CORRESPONDENT_BIC = "SBZAZAJJXXX";

/** Default bank BIC. */
const BANK_BIC = "BANKZAJJXXX";

/** Default nostro IBAN template. */
const NOSTRO_IBAN_TEMPLATE = "ZA00BANK0000000000000";

/**
 * Determine which currency the bank receives in a trade.
 * For a "buy" trade: bank receives the receiveCurrency of the near leg.
 * For a "sell" trade: bank receives the payCurrency of the near leg (the
 *   "counter" currency in the pair).
 */
function receivedCurrency(trade: FxTradeExecutedPayload): string {
  const nearLeg = trade.legs[0];
  if (!nearLeg) throw new Error("simulateInboundMessages: trade has no near leg");
  return nearLeg.receiveCurrency;
}

/**
 * Determine the amount the bank receives, in minor units (positive bigint).
 */
function receivedAmountMinor(trade: FxTradeExecutedPayload): bigint {
  const nearLeg = trade.legs[0];
  if (!nearLeg) throw new Error("simulateInboundMessages: trade has no near leg");
  return BigInt(Math.abs(nearLeg.counterNotional.amountMinor));
}

// ---------------------------------------------------------------------------
// Main simulator
// ---------------------------------------------------------------------------

/**
 * Simulate all inbound messages the correspondent/counterparty would send
 * back after an FX trade is agreed and settled.
 *
 * When `opts.store` and `opts.asOf` are provided, each simulated message
 * is recorded as an InboundMessageReceived event, and a MessageCorrelated
 * event is emitted linking the message to the trade's outbound message
 * (Principle 1 compliance, D-FX-MESSAGE-EVENTS).
 *
 * @param trade             The FX trade payload (from FxTradeExecuted event).
 * @param settledAt         The date/time settlement is confirmed.
 * @param nostroBalance     The opening nostro balance in minor units (positive = credit).
 * @param correspondentBic  BIC of the correspondent bank. Defaults to SBZAZAJJXXX.
 * @param nostroAccountId   Nostro account identifier at the correspondent.
 * @param bankBic           The bank's own BIC.
 * @param opts.store        Optional event store to emit InboundMessageReceived
 *                          and MessageCorrelated events to.
 * @param opts.asOf         ISO 8601 timestamp used for emitted events.
 * @param opts.outboundMessageId  The messageId from the corresponding
 *                          OutboundMessageDispatched event (used for correlation).
 */
export function simulateInboundMessages(
  trade: FxTradeExecutedPayload,
  settledAt: Date,
  nostroBalance: bigint,
  correspondentBic: string = DEFAULT_CORRESPONDENT_BIC,
  nostroAccountId: string = NOSTRO_IBAN_TEMPLATE,
  bankBic: string = BANK_BIC,
  opts?: {
    store?: EventStore;
    asOf?: string;
    outboundMessageId?: string;
  },
): InboundMessageSet {
  const tradeId = trade.tradeId.value;
  const nearLeg = trade.legs[0];
  if (!nearLeg) throw new Error("simulateInboundMessages: trade has no near leg");

  const receiveCcy = receivedCurrency(trade);
  const receiveMinor = receivedAmountMinor(trade);

  // -------------------------------------------------------------------------
  // MT300 — FX Trade Confirmation (counterparty echoes back the trade)
  // The counterparty sends this as their confirmation of the agreed terms.
  // From their perspective, senderBic and receiverBic are swapped.
  // -------------------------------------------------------------------------
  const mt300Confirmation = generateMt300(
    trade,
    correspondentBic, // counterparty sends
    bankBic, // to us
  );

  // -------------------------------------------------------------------------
  // MT202 — Receive Leg (correspondent credits our nostro with bought CCY)
  // Only relevant when bank is the buyer (has a receive leg with positive flow).
  // -------------------------------------------------------------------------
  const mt202ReceiveLeg = generateMt202(
    trade,
    "receive",
    bankBic, // correspondent sends to bank
    correspondentBic, // sender BIC is correspondent
  );

  // -------------------------------------------------------------------------
  // MT940 — Nostro Statement
  // The correspondent sends this at end-of-day showing the credit entry.
  // -------------------------------------------------------------------------
  const mt940Entry: Mt940Entry = {
    valueDate: settledAt,
    creditDebitMark: "C", // bank receives (credit to nostro)
    amountMinor: receiveMinor,
    currency: receiveCcy,
    transactionTypeCode: "FXCF", // FX confirmation
    customerReference: tradeId.slice(0, 16),
    bankReference: `${correspondentBic}-${tradeId.slice(0, 8)}`,
    narrative: `FX ${trade.productTaxonomy} RECEIVE LEG TRADE ${tradeId}`,
  };

  const mt940Statement = generateMt940({
    accountId: nostroAccountId,
    correspondentBic,
    statementDate: settledAt,
    openingBalance: nostroBalance,
    entries: [mt940Entry],
    currency: receiveCcy,
  });

  // -------------------------------------------------------------------------
  // pacs.009 — ISO 20022 equivalent of MT202 (receive leg)
  // -------------------------------------------------------------------------
  const counterpartyFI: FIIdentification = {
    bic: correspondentBic,
    name: "Correspondent Bank",
    country: "ZA",
  };
  const bankFI: FIIdentification = {
    bic: bankBic,
    name: "THE BANK ZA",
    country: "ZA",
  };

  // pacs.009 from counterparty's perspective: they are delivering the receive leg to us
  // We model the receive leg as if the counterparty is the sender
  const pacs009ReceiveLeg = generatePacs009(trade, "receive", counterpartyFI, bankFI, settledAt);

  // -------------------------------------------------------------------------
  // camt.053 — ISO 20022 equivalent of MT940 (nostro statement)
  // -------------------------------------------------------------------------
  const camt053Entry: Camt053Entry = {
    amountMinor: receiveMinor,
    currency: receiveCcy,
    CdtDbtInd: "CRDT",
    BookgDt: settledAt,
    ValDt: settledAt,
    BkTxCd: {
      Prtry: {
        Cd: "FXCF",
        Issr: correspondentBic,
      },
    },
    NtryDtls: {
      TxDtls: [
        {
          Refs: {
            EndToEndId: tradeId.slice(0, 35),
            TxId: tradeId.slice(0, 35),
          },
          RmtInf: {
            Ustrd: `FX ${trade.productTaxonomy} RECEIVE LEG TRADE ${tradeId}`,
          },
        },
      ],
    },
  };

  // Use the IBAN if it looks like one, otherwise construct a plausible IBAN
  const accountIban = nostroAccountId.startsWith("ZA")
    ? nostroAccountId
    : `ZA00${bankBic.slice(0, 4)}${nostroAccountId.replace(/\//g, "").slice(0, 20)}`;

  const camt053Statement = generateCamt053({
    accountIban,
    correspondentBic,
    statementDate: settledAt,
    openingBalance: nostroBalance,
    entries: [camt053Entry],
    currency: receiveCcy,
  });

  const result: InboundMessageSet = {
    tradeId,
    mt300Confirmation,
    mt202ReceiveLeg,
    mt940Statement,
    pacs009ReceiveLeg,
    camt053Statement,
  };

  // -------------------------------------------------------------------------
  // Event emission — when an event store is provided, record each inbound
  // message and correlate it back to the outbound dispatch (D-FX-MESSAGE-EVENTS).
  // -------------------------------------------------------------------------
  if (opts?.store && opts.asOf) {
    const { store, asOf, outboundMessageId } = opts;
    const outboundRef = outboundMessageId ?? tradeId.slice(-16);
    const CITATIONS = ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"];
    const SYSTEM_ACTOR = { type: "agent" as const, id: "tomas@bank.local" };

    // Helper: emit InboundMessageReceived + MessageCorrelated pair.
    function emitInbound(
      messageId: string,
      messageStandard: string,
      serialisedMessage: string,
      correlationType: "confirmation" | "receive-leg" | "statement-entry",
    ): void {
      store.append(
        makeInboundMessageReceived({
          asOf,
          entity: BANK_ZA_001,
          actor: SYSTEM_ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId,
            messageId,
            messageStandard,
            direction: "inbound",
            serialisedMessage,
            senderBic: correspondentBic,
            receivedAt: asOf,
            citations: CITATIONS,
          },
        }),
      );
      store.append(
        makeMessageCorrelated({
          asOf,
          entity: BANK_ZA_001,
          actor: SYSTEM_ACTOR,
          citations: CITATIONS,
          payload: {
            outboundMessageId: outboundRef,
            inboundMessageId: messageId,
            tradeId,
            correlationType,
            correlatedAt: asOf,
            citations: CITATIONS,
          },
        }),
      );
    }

    // MT300 — FX trade confirmation (counterparty confirms the trade terms)
    if (mt300Confirmation) {
      const trnField = mt300Confirmation.block4.find((f) => f.tag === "20");
      const mt300Id = trnField?.value ?? `${tradeId.slice(-12)}-MT300-CONF`;
      emitInbound(mt300Id, "MT300", mt300Confirmation.serialised, "confirmation");
    }

    // MT202 — receive leg credit to nostro
    if (mt202ReceiveLeg) {
      const trnField = mt202ReceiveLeg.block4.find((f) => f.tag === "20");
      const mt202Id = trnField?.value ?? `${tradeId.slice(-12)}-MT202-RCV`;
      emitInbound(mt202Id, "MT202", mt202ReceiveLeg.serialised, "receive-leg");
    }

    // MT940 — nostro statement entry
    if (mt940Statement) {
      const refField = mt940Statement.block4.find((f) => f.tag === "28C");
      const mt940Id = refField?.value ?? `${tradeId.slice(-12)}-MT940-STMT`;
      emitInbound(mt940Id, "MT940", mt940Statement.serialised, "statement-entry");
    }

    // pacs.009 — receive leg (ISO 20022)
    if (pacs009ReceiveLeg) {
      const pacs009Id = pacs009ReceiveLeg.GrpHdr.MsgId;
      emitInbound(pacs009Id, "pacs.009", pacs009ReceiveLeg.serialisedXml, "receive-leg");
    }

    // camt.053 — end-of-day statement (ISO 20022)
    if (camt053Statement) {
      const camt053Id =
        camt053Statement.Stmt[0]?.Id ?? `${tradeId.slice(-12)}-CAMT053-STMT`;
      emitInbound(camt053Id, "camt.053", camt053Statement.serialisedXml ?? "", "statement-entry");
    }
  }

  return result;
}
