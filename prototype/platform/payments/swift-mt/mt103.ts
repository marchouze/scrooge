// platform/payments/swift-mt/mt103.ts
//
// MT103 Single Customer Credit Transfer generator.
//
// MT103 is the SWIFT standard for customer credit transfers — used when
// a customer instructs the bank to pay to another customer at another bank.
// In the FX context this covers the customer leg of a cross-border payment.
//
// Fields generated:
//   :20:  Sender's Reference
//   :23B: Bank Operation Code (CRED)
//   :32A: Value Date / Currency / Amount
//   :50K: Ordering Customer
//   :57A: Account With Institution
//   :59:  Beneficiary Customer
//   :70:  Remittance Information
//   :71A: Details of Charges (OUR / SHA / BEN)
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   SWIFT-MT103-SPEC — SWIFT Standards MT103 specification
//   D-FX-MESSAGE-EVENTS — event-log wiring for message dispatch
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import { BANK_ZA_001 } from "@platform/core/types";
import {
  type PaymentInitiatedPayload,
  makeOutboundMessageDispatched,
} from "@platform/event-store/event-types/payments";
import type { EventStore } from "@platform/event-store/store";
import {
  type SwiftBlock4,
  type SwiftMessage,
  formatSwiftAmount,
  formatSwiftDate,
  serialiseSwiftMessage,
} from "./types";

// ---------------------------------------------------------------------------
// MT103 charge options
// ---------------------------------------------------------------------------

export type Mt103Charges = "OUR" | "SHA" | "BEN";

// ---------------------------------------------------------------------------
// MT103 block 4 type
// ---------------------------------------------------------------------------

export interface Mt103Block4 extends SwiftBlock4 {
  // List of SwiftField — typed as structural extension.
}

export type Mt103Message = SwiftMessage<Mt103Block4> & {
  readonly serialised: string;
};

// ---------------------------------------------------------------------------
// Ordering / beneficiary info for MT103
// ---------------------------------------------------------------------------

export interface Mt103PartyInfo {
  accountNumber: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate an MT103 Single Customer Credit Transfer.
 *
 * @param payment        The PaymentInitiated event payload.
 * @param senderBic      BIC of the sending bank.
 * @param receiverBic    BIC of the receiving bank.
 * @param orderingCustomer  Ordering customer details.
 * @param beneficiary    Beneficiary customer details.
 * @param charges        Charge allocation: OUR | SHA | BEN. Default "SHA".
 * @param remittanceInfo Optional remittance information for :70: field.
 */
export function generateMt103(
  payment: PaymentInitiatedPayload,
  senderBic: string,
  receiverBic: string,
  orderingCustomer: Mt103PartyInfo = {
    accountNumber: "/NOSTRO-ACCOUNT-ZA",
    name: "THE BANK ZA",
  },
  beneficiary: Mt103PartyInfo = {
    accountNumber: "/BENEFICIARY-ACCOUNT",
    name: payment.tradeId,
  },
  charges: Mt103Charges = "SHA",
  remittanceInfo = `PAYMENT REF ${payment.paymentRef}`,
): Mt103Message {
  // Settlement date from initiatedAt timestamp
  const initiatedDate = new Date(payment.initiatedAt);
  const swiftDate = formatSwiftDate(initiatedDate);

  const absMinor = BigInt(Math.abs(payment.netCash));

  const orderingName = [orderingCustomer.name, orderingCustomer.addressLine1]
    .filter(Boolean)
    .join("\n");

  const beneficiaryName = [beneficiary.name, beneficiary.addressLine1].filter(Boolean).join("\n");

  const block4: Mt103Block4 = [
    { tag: "20", value: payment.paymentRef.slice(0, 16) },
    { tag: "23B", value: "CRED" },
    {
      tag: "32A",
      value: `${swiftDate}${payment.currency}${formatSwiftAmount(absMinor)}`,
    },
    {
      tag: "50K",
      value: `${orderingCustomer.accountNumber}\n${orderingName}`.slice(0, 140),
    },
    { tag: "57A", value: receiverBic.slice(0, 11) },
    {
      tag: "59",
      value: `${beneficiary.accountNumber}\n${beneficiaryName}`.slice(0, 140),
    },
    { tag: "70", value: remittanceInfo.slice(0, 140) },
    { tag: "71A", value: charges },
  ];

  const msg: Omit<Mt103Message, "serialised"> = {
    block1: {
      appId: "F",
      serviceId: "01",
      logicalTerminal: `${senderBic.padEnd(12, "X").slice(0, 12)}0000000000`,
      sessionNumber: "0000",
      sequenceNumber: "000000",
    },
    block2: {
      direction: "I",
      messageType: "103",
      destinationAddress: receiverBic.padEnd(12, "X").slice(0, 12),
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
 * Generate an MT103 Single Customer Credit Transfer and emit an
 * OutboundMessageDispatched event to the event store (Principle 1 compliance,
 * D-FX-MESSAGE-EVENTS).
 *
 * The pure {@link generateMt103} function is called internally; its signature
 * is unchanged. This wrapper is additive.
 *
 * @param store             Event store to append to.
 * @param payment           The PaymentInitiated event payload.
 * @param senderBic         BIC of the sending bank.
 * @param receiverBic       BIC of the receiving bank.
 * @param asOf              ISO 8601 timestamp for the event.
 * @param orderingCustomer  Ordering customer details.
 * @param beneficiary       Beneficiary customer details.
 * @param charges           Charge allocation: OUR | SHA | BEN. Default "SHA".
 * @param remittanceInfo    Optional remittance information.
 */
export function generateAndEmitMt103(
  store: EventStore,
  payment: PaymentInitiatedPayload,
  senderBic: string,
  receiverBic: string,
  asOf: string,
  orderingCustomer?: Mt103PartyInfo,
  beneficiary?: Mt103PartyInfo,
  charges?: Mt103Charges,
  remittanceInfo?: string,
): Mt103Message {
  const msg = generateMt103(
    payment,
    senderBic,
    receiverBic,
    orderingCustomer,
    beneficiary,
    charges,
    remittanceInfo,
  );

  // Extract the :20: sender reference as messageId.
  const refField = msg.block4.find((f) => f.tag === "20");
  const messageId = refField?.value ?? payment.paymentRef.slice(0, 16);

  store.append(
    makeOutboundMessageDispatched({
      asOf,
      entity: BANK_ZA_001,
      actor: { type: "service", id: "tomas@bank.local" },
      citations: ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"],
      payload: {
        tradeId: payment.tradeId,
        messageId,
        messageStandard: "SWIFT-MT103",
        direction: "outbound",
        serialisedMessage: msg.serialised,
        correspondentBic: receiverBic,
        dispatchedAt: asOf,
        citations: ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"],
      },
    }),
  );

  return msg;
}
