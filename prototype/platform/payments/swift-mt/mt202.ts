// platform/payments/swift-mt/mt202.ts
//
// MT202 General Financial Institution Transfer generator.
//
// MT202 is the standard SWIFT message used between financial institutions
// for bank-to-bank transfers. In FX settlement it is used to move the
// currency leg from the bank's correspondent account to the counterparty's
// correspondent account.
//
// Fields generated:
//   :20:  Transaction Reference Number
//   :21:  Related Reference (trade ID)
//   :32A: Value Date / Currency / Interbank Settled Amount
//   :53B: Sender's Correspondent
//   :57A: Account With Institution
//   :58A: Beneficiary Institution
//   :72:  Sender to Receiver Information (narrative)
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent settlement via SWIFT MT202
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   SWIFT-MT202-SPEC — SWIFT Standards MT202 specification
//   D-FX-MESSAGE-EVENTS — event-log wiring for message dispatch
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import { BANK_ZA_001 } from "@platform/core/types";
import { makeOutboundMessageDispatched } from "@platform/event-store/event-types/payments";
import type { EventStore } from "@platform/event-store/store";
import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import {
  type SwiftBlock4,
  type SwiftMessage,
  formatSwiftAmount,
  formatSwiftDate,
  serialiseSwiftMessage,
} from "./types";

// ---------------------------------------------------------------------------
// MT202 block 4 type
// ---------------------------------------------------------------------------

export interface Mt202Block4 extends SwiftBlock4 {
  // Typed tuple isn't idiomatic — block4 is a list of SwiftField.
  // The generic constraint ensures the message carries the right shape.
}

export type Mt202Message = SwiftMessage<Mt202Block4> & {
  /** Convenience: the serialised FIN text. */
  readonly serialised: string;
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate an MT202 General Financial Institution Transfer message.
 *
 * @param trade            The FX trade payload.
 * @param leg              "deliver" (bank pays) or "receive" (bank receives).
 * @param correspondentBic The BIC of the correspondent bank handling settlement.
 * @param senderBic        The BIC of the sending institution (the bank).
 * @param sequenceRef      Optional sequence ref; defaults to trade ID + leg suffix.
 */
export function generateMt202(
  trade: FxTradeExecutedPayload,
  leg: "deliver" | "receive",
  correspondentBic: string,
  senderBic = "BANKZAJJXXX",
  sequenceRef?: string,
): Mt202Message {
  const nearLeg = trade.legs[0];
  if (!nearLeg) throw new Error("MT202: trade has no near leg");

  // Determine currency and amount for this leg.
  // For "deliver" leg: bank pays the pay currency.
  // For "receive" leg: bank receives the receive currency.
  const currency = leg === "deliver" ? nearLeg.payCurrency : nearLeg.receiveCurrency;
  const amountMinor =
    leg === "deliver" ? nearLeg.notional.amountMinor : nearLeg.counterNotional.amountMinor;

  // Settlement date
  const settlementDateIso = nearLeg.settlementDate.iso;
  const [year, month, day] = settlementDateIso.split("-").map(Number) as [number, number, number];
  const settlementDate = new Date(Date.UTC(year, month - 1, day));

  const tradeIdValue = trade.tradeId.value;
  const trn = sequenceRef ?? `${tradeIdValue.slice(-14)}-${leg === "deliver" ? "D" : "R"}`;
  const relatedRef = tradeIdValue.slice(-16);

  // Convert number to bigint safely (amounts stored as number in CDM)
  const absMinor = BigInt(Math.abs(amountMinor));

  const block4: Mt202Block4 = [
    { tag: "20", value: trn.slice(0, 16) },
    { tag: "21", value: relatedRef.slice(0, 16) },
    {
      tag: "32A",
      value: `${formatSwiftDate(settlementDate)}${currency}${formatSwiftAmount(absMinor)}`,
    },
    { tag: "53B", value: `/${correspondentBic}` },
    {
      tag: "57A",
      value: `/${trade.counterparty.partyId.slice(0, 34)}\n${correspondentBic}`,
    },
    {
      tag: "58A",
      value: `/${trade.counterparty.partyId.slice(0, 34)}\n${correspondentBic}`,
    },
    {
      tag: "72",
      value: `/RFB/${tradeIdValue.slice(0, 30)}\n/BNF/FX ${trade.productTaxonomy} ${leg.toUpperCase()}`,
    },
  ];

  const msg: Omit<Mt202Message, "serialised"> = {
    block1: {
      appId: "F",
      serviceId: "01",
      logicalTerminal: `${senderBic.padEnd(12, "X").slice(0, 12)}0000000000`,
      sessionNumber: "0000",
      sequenceNumber: "000000",
    },
    block2: {
      direction: "I",
      messageType: "202",
      destinationAddress: correspondentBic.padEnd(12, "X").slice(0, 12),
      priority: "N",
    },
    block4,
  };

  const serialised = serialiseSwiftMessage(msg);

  return { ...msg, serialised };
}

// ---------------------------------------------------------------------------
// Event-emitting wrapper
// ---------------------------------------------------------------------------

/**
 * Generate an MT202 General Financial Institution Transfer and emit an
 * OutboundMessageDispatched event to the event store (Principle 1 compliance,
 * D-FX-MESSAGE-EVENTS).
 *
 * The pure {@link generateMt202} function is called internally; its signature
 * is unchanged. This wrapper is additive.
 *
 * @param store            Event store to append to.
 * @param trade            The FX trade payload.
 * @param leg              "deliver" (bank pays) or "receive" (bank receives).
 * @param correspondentBic BIC of the correspondent bank.
 * @param asOf             ISO 8601 timestamp for the event.
 * @param senderBic        The bank's own BIC. Defaults to "BANKZAJJXXX".
 * @param sequenceRef      Optional sequence reference.
 */
export function generateAndEmitMt202(
  store: EventStore,
  trade: FxTradeExecutedPayload,
  leg: "deliver" | "receive",
  correspondentBic: string,
  asOf: string,
  senderBic = "BANKZAJJXXX",
  sequenceRef?: string,
): Mt202Message {
  const msg = generateMt202(trade, leg, correspondentBic, senderBic, sequenceRef);

  // Extract the :20: TRN field as the messageId.
  const trnField = msg.block4.find((f) => f.tag === "20");
  const messageId = trnField?.value ?? trade.tradeId.value.slice(-16);

  store.append(
    makeOutboundMessageDispatched({
      asOf,
      entity: BANK_ZA_001,
      actor: { type: "agent", id: "tomas@bank.local" },
      citations: ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"],
      payload: {
        tradeId: trade.tradeId.value,
        messageId,
        messageStandard: "SWIFT-MT202",
        direction: "outbound",
        serialisedMessage: msg.serialised,
        correspondentBic,
        dispatchedAt: asOf,
        citations: ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"],
      },
    }),
  );

  return msg;
}
