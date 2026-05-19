// platform/payments/iso20022/pacs009.ts
//
// pacs.009.001.10 FinancialInstitutionCreditTransfer (FI Credit Transfer)
//
// pacs.009 is the ISO 20022 message for financial institution credit transfers
// (bank-to-bank movements). It is the ISO 20022 equivalent of SWIFT MT202,
// and is the preferred message standard for FX settlement under
// D-FX-CLS-MEMBERSHIP (migration target from MT202 to pacs.009).
//
// Structure:
//   GrpHdr — Group Header
//   CdtTrfTxInf — Credit Transfer Transaction Information
//     PmtId — Payment Identification
//     IntrBkSttlmAmt — Interbank Settlement Amount
//     IntrBkSttlmDt — Interbank Settlement Date
//     Dbtr — Debtor institution (the bank, paying leg)
//     DbtrAcct — Debtor account at correspondent
//     Cdtr — Creditor institution (counterparty / beneficiary bank)
//     CdtrAcct — Creditor account
//     UndrlygCstmrCdtTrf — Underlying customer credit transfer (optional)
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — pacs.009 as migration target for FX settlement
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   ISO-20022 — pacs.009.001.10 message specification
//   D-FX-MESSAGE-EVENTS — event-log wiring for message dispatch
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import { BANK_ZA_001 } from "@platform/core/types";
import { makeOutboundMessageDispatched } from "@platform/event-store/event-types/payments";
import type { EventStore } from "@platform/event-store/store";
import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import {
  type ActiveCurrencyAndAmount,
  type CashAccount,
  type FIIdentification,
  type FinancialInstitutionIdentification,
  type GroupHeader,
  type PaymentIdentification,
  formatIso8601Date,
  formatIso8601DateTime,
  formatIso20022Amount,
  generateUetr,
  serialiseToXml,
} from "./types";

// ---------------------------------------------------------------------------
// pacs.009 document type
// ---------------------------------------------------------------------------

export interface Pacs009CdtTrfTxInf {
  PmtId: PaymentIdentification;
  IntrBkSttlmAmt: ActiveCurrencyAndAmount;
  IntrBkSttlmDt: string;
  InstgAgt: { FinInstnId: FinancialInstitutionIdentification };
  InstdAgt: { FinInstnId: FinancialInstitutionIdentification };
  Dbtr: { FinInstnId: FinancialInstitutionIdentification };
  DbtrAcct?: CashAccount;
  Cdtr: { FinInstnId: FinancialInstitutionIdentification };
  CdtrAcct?: CashAccount;
  /** Narrative / purpose. */
  InstrForCdtrAgt?: { Cd: string; InstrInf?: string };
  Purp?: { Cd: string };
}

export interface Pacs009Document {
  GrpHdr: GroupHeader;
  CdtTrfTxInf: Pacs009CdtTrfTxInf[];
  /** Convenience: serialised XML. */
  readonly serialisedXml: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const PACS009_NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.10";

/**
 * Generate a pacs.009.001.10 Financial Institution Credit Transfer.
 *
 * @param trade    The FX trade payload.
 * @param leg      "deliver" (bank pays pay-currency) or "receive" (bank receives receive-currency).
 * @param sender   Sending financial institution.
 * @param receiver Receiving financial institution (counterparty's correspondent).
 * @param settledAt  Optional settlement timestamp; defaults to now.
 */
export function generatePacs009(
  trade: FxTradeExecutedPayload,
  leg: "deliver" | "receive",
  sender: FIIdentification,
  receiver: FIIdentification,
  settledAt?: Date,
): Pacs009Document {
  const nearLeg = trade.legs[0];
  if (!nearLeg) throw new Error("pacs.009: trade has no near leg");

  // Determine currency and amount for this leg
  const currency = leg === "deliver" ? nearLeg.payCurrency : nearLeg.receiveCurrency;
  const amountMinor =
    leg === "deliver" ? nearLeg.notional.amountMinor : nearLeg.counterNotional.amountMinor;
  const absMinor = BigInt(Math.abs(amountMinor));

  const settlementDateIso = nearLeg.settlementDate.iso;
  const now = settledAt ?? new Date();
  const creDtTm = formatIso8601DateTime(now);

  const tradeIdValue = trade.tradeId.value;
  const txId = `${tradeIdValue.slice(0, 28)}-${leg === "deliver" ? "D" : "R"}`;
  const msgId = txId.slice(0, 35);

  const grpHdr: GroupHeader = {
    MsgId: msgId,
    CreDtTm: creDtTm,
    NbOfTxs: "1",
    SttlmInf: { SttlmMtd: "CLRG" },
    InstgAgt: {
      FinInstnId: {
        BICFI: sender.bic,
        ...(sender.name !== undefined ? { Nm: sender.name } : {}),
      },
    },
    InstdAgt: {
      FinInstnId: {
        BICFI: receiver.bic,
        ...(receiver.name !== undefined ? { Nm: receiver.name } : {}),
      },
    },
  };

  const cdtTrfTxInf: Pacs009CdtTrfTxInf = {
    PmtId: {
      InstrId: msgId,
      EndToEndId: txId.slice(0, 35),
      TxId: txId.slice(0, 35),
      UETR: generateUetr(txId),
    },
    IntrBkSttlmAmt: {
      Ccy: currency,
      value: formatIso20022Amount(absMinor),
    },
    IntrBkSttlmDt: formatIso8601Date(new Date(`${settlementDateIso}T00:00:00Z`)),
    InstgAgt: {
      FinInstnId: { BICFI: sender.bic },
    },
    InstdAgt: {
      FinInstnId: { BICFI: receiver.bic },
    },
    Dbtr: {
      FinInstnId: {
        BICFI: sender.bic,
        ...(sender.name !== undefined ? { Nm: sender.name } : {}),
      },
    },
    DbtrAcct: {
      Id: {
        Othr: {
          Id: `/NOSTRO-${sender.bic}-${currency}`,
          SchmeNm: { Cd: "BBAN" },
        },
      },
      Ccy: currency,
    },
    Cdtr: {
      FinInstnId: {
        BICFI: receiver.bic,
        ...(receiver.name !== undefined ? { Nm: receiver.name } : {}),
      },
    },
    CdtrAcct: {
      Id: {
        Othr: {
          Id: `/ACCOUNT-${receiver.bic}-${currency}`,
          SchmeNm: { Cd: "BBAN" },
        },
      },
      Ccy: currency,
    },
    InstrForCdtrAgt: {
      Cd: "PHOB",
      InstrInf: `FX ${trade.productTaxonomy} ${leg.toUpperCase()} LEG TRADE ${tradeIdValue}`,
    },
    Purp: { Cd: "FXNT" },
  };

  const docBody = { GrpHdr: grpHdr, CdtTrfTxInf: [cdtTrfTxInf] };
  const serialisedXml = serialiseToXml({ FICdtTrf: docBody }, PACS009_NAMESPACE);

  return {
    GrpHdr: grpHdr,
    CdtTrfTxInf: [cdtTrfTxInf],
    serialisedXml,
  };
}

// ---------------------------------------------------------------------------
// Event-emitting wrapper
// ---------------------------------------------------------------------------

/**
 * Generate a pacs.009.001.10 Financial Institution Credit Transfer and emit
 * an OutboundMessageDispatched event to the event store (Principle 1
 * compliance, D-FX-MESSAGE-EVENTS).
 *
 * The pure {@link generatePacs009} function is called internally; its signature
 * is unchanged. This wrapper is additive.
 *
 * @param store      Event store to append to.
 * @param trade      The FX trade payload.
 * @param leg        "deliver" or "receive".
 * @param sender     Sending financial institution.
 * @param receiver   Receiving financial institution.
 * @param asOf       ISO 8601 timestamp for the event.
 * @param settledAt  Optional settlement timestamp.
 */
export function generateAndEmitPacs009(
  store: EventStore,
  trade: FxTradeExecutedPayload,
  leg: "deliver" | "receive",
  sender: FIIdentification,
  receiver: FIIdentification,
  asOf: string,
  settledAt?: Date,
): Pacs009Document {
  const doc = generatePacs009(trade, leg, sender, receiver, settledAt);

  const messageId = doc.GrpHdr.MsgId;

  store.append(
    makeOutboundMessageDispatched({
      asOf,
      entity: BANK_ZA_001,
      actor: { type: "service", id: "tomas@bank.local" },
      citations: ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"],
      payload: {
        tradeId: trade.tradeId.value,
        messageId,
        messageStandard: "ISO-20022-pacs.009",
        direction: "outbound",
        serialisedMessage: doc.serialisedXml,
        correspondentBic: receiver.bic,
        dispatchedAt: asOf,
        citations: ["D-FX-MESSAGE-EVENTS", "D-FX-CLS-MEMBERSHIP", "urn:bank:principle:1"],
      },
    }),
  );

  return doc;
}
