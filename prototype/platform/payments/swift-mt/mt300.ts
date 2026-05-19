// platform/payments/swift-mt/mt300.ts
//
// MT300 Foreign Exchange Confirmation generator.
//
// MT300 is the SWIFT standard for confirming an FX transaction between
// two financial institutions. It contains four sequences:
//   Sequence A (:15A:) — General information (parties, operation type)
//   Sequence B (:15B:) — Transaction details (dates, rate, amounts)
//   Sequence C (:15C:) — Settlement instructions for amount sold (deliver leg)
//   Sequence D (:15D:) — Settlement instructions for amount bought (receive leg)
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent settlement via MT300 FX confirmation
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   SWIFT-MT300-SPEC — SWIFT Standards MT300 specification
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import {
  type SwiftBlock4,
  type SwiftMessage,
  formatSwiftAmount,
  formatSwiftDate,
  serialiseSwiftMessage,
} from "./types";

// ---------------------------------------------------------------------------
// MT300 block 4 type
// ---------------------------------------------------------------------------

export interface Mt300Block4 extends SwiftBlock4 {
  // List of SwiftField per the four-sequence structure.
}

export type Mt300Message = SwiftMessage<Mt300Block4> & {
  readonly serialised: string;
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate an MT300 Foreign Exchange Confirmation message.
 *
 * The message is generated from the bank's perspective (party A = bank,
 * party B = counterparty). For a "buy" trade, the bank:
 *   - Pays (sells) the pay currency (ZAR for ZAR/USD buy)
 *   - Receives (buys) the receive currency (USD)
 *
 * @param trade        The FX trade payload.
 * @param senderBic    BIC of the sending institution (the bank).
 * @param receiverBic  BIC of the receiving institution (the counterparty).
 * @param commonRef    Optional common reference; defaults to trade ID.
 */
export function generateMt300(
  trade: FxTradeExecutedPayload,
  senderBic: string,
  receiverBic: string,
  commonRef?: string,
): Mt300Message {
  const nearLeg = trade.legs[0];
  if (!nearLeg) throw new Error("MT300: trade has no near leg");

  const tradeIdValue = trade.tradeId.value;

  // Trade date and value date
  const [tradeYear, tradeMon, tradeDay] = nearLeg.settlementDate.iso
    // Use trade.tradeDate for :30T: — we need both dates
    .split("-")
    .map(Number) as [number, number, number];

  const tradeDateParts = trade.tradeDate.iso.split("-").map(Number) as [number, number, number];
  const tradeDateObj = new Date(Date.UTC(tradeDateParts[0], tradeDateParts[1] - 1, tradeDateParts[2]));

  const valueDateParts = nearLeg.settlementDate.iso.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const valueDateObj = new Date(Date.UTC(valueDateParts[0], valueDateParts[1] - 1, valueDateParts[2]));

  void tradeYear;
  void tradeMon;
  void tradeDay;

  const tradeSwiftDate = formatSwiftDate(tradeDateObj);
  const valueSwiftDate = formatSwiftDate(valueDateObj);

  // For a buy trade: bank pays payCurrency (sold), receives receiveCurrency (bought).
  const soldCurrency = nearLeg.payCurrency;
  const boughtCurrency = nearLeg.receiveCurrency;
  const soldAmountMinor = BigInt(Math.abs(nearLeg.notional.amountMinor));
  const boughtAmountMinor = BigInt(Math.abs(nearLeg.counterNotional.amountMinor));

  // Exchange rate: receiveCurrency per pay-unit (CDM convention)
  const rate = nearLeg.rate.amount.toFixed(5);

  const ref = commonRef ?? tradeIdValue.slice(0, 16);
  const seqRef = tradeIdValue.slice(-14);

  const block4: Mt300Block4 = [
    // -----------------------------------------------------------------------
    // Sequence A — General Information
    // -----------------------------------------------------------------------
    { tag: "15A", value: "" },
    { tag: "20", value: seqRef.slice(0, 16) },
    { tag: "22A", value: "NEW" },
    { tag: "94A", value: "BILA" },
    { tag: "22C", value: ref.slice(0, 16) },
    {
      tag: "82A",
      value: `${senderBic.slice(0, 11)}`,
    },
    {
      tag: "87A",
      value: `${receiverBic.slice(0, 11)}`,
    },

    // -----------------------------------------------------------------------
    // Sequence B — Transaction Details
    // -----------------------------------------------------------------------
    { tag: "15B", value: "" },
    { tag: "30T", value: tradeSwiftDate },
    { tag: "30V", value: valueSwiftDate },
    { tag: "36", value: rate },
    {
      tag: "32B",
      value: `${soldCurrency}${formatSwiftAmount(soldAmountMinor)}`,
    },
    {
      tag: "33B",
      value: `${boughtCurrency}${formatSwiftAmount(boughtAmountMinor)}`,
    },

    // -----------------------------------------------------------------------
    // Sequence C — Settlement Instructions for Amount Sold (deliver leg)
    // -----------------------------------------------------------------------
    { tag: "15C", value: "" },
    {
      tag: "57A",
      value: receiverBic.slice(0, 11),
    },
    {
      tag: "58A",
      value: trade.counterparty.partyId.slice(0, 34),
    },

    // -----------------------------------------------------------------------
    // Sequence D — Settlement Instructions for Amount Bought (receive leg)
    // -----------------------------------------------------------------------
    { tag: "15D", value: "" },
    {
      tag: "57A",
      value: senderBic.slice(0, 11),
    },
    {
      tag: "58A",
      value: senderBic.slice(0, 11),
    },
  ];

  const msg: Omit<Mt300Message, "serialised"> = {
    block1: {
      appId: "F",
      serviceId: "01",
      logicalTerminal: `${senderBic.padEnd(12, "X").slice(0, 12)}0000000000`,
      sessionNumber: "0000",
      sequenceNumber: "000000",
    },
    block2: {
      direction: "I",
      messageType: "300",
      destinationAddress: receiverBic.padEnd(12, "X").slice(0, 12),
      priority: "N",
    },
    block4,
  };

  const serialised = serialiseSwiftMessage(msg);

  return { ...msg, serialised };
}
