// platform/payments/iso20022/pacs008.ts
//
// pacs.008.001.10 FIToFICustomerCreditTransfer (Customer Credit Transfer)
//
// pacs.008 is the ISO 20022 message for customer credit transfers between
// financial institutions. It is the ISO 20022 equivalent of SWIFT MT103.
// Used for cross-border customer payments routed via the correspondent bank.
//
// Structure:
//   GrpHdr — Group Header (message metadata, settlement info)
//   CdtTrfTxInf — Credit Transfer Transaction Information (one per transaction)
//     PmtId — Payment Identification (end-to-end, transaction IDs)
//     IntrBkSttlmAmt — Interbank Settlement Amount
//     IntrBkSttlmDt — Interbank Settlement Date
//     Dbtr — Debtor (ordering customer)
//     DbtrAcct — Debtor Account
//     Cdtr — Creditor (beneficiary)
//     CdtrAcct — Creditor Account
//     RmtInf — Remittance Information
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — ISO 20022 settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   ISO-20022 — pacs.008.001.10 message specification
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import type { PaymentInitiatedPayload } from "@platform/event-store/event-types/payments";
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
// pacs.008 document type
// ---------------------------------------------------------------------------

export interface Pacs008CdtTrfTxInf {
  PmtId: PaymentIdentification;
  IntrBkSttlmAmt: ActiveCurrencyAndAmount;
  IntrBkSttlmDt: string;
  Dbtr: { Nm: string; PstlAdr?: { Ctry: string } };
  DbtrAcct: CashAccount;
  DbtrAgt: { FinInstnId: FinancialInstitutionIdentification };
  Cdtr: { Nm: string; PstlAdr?: { Ctry: string } };
  CdtrAcct: CashAccount;
  CdtrAgt: { FinInstnId: FinancialInstitutionIdentification };
  RmtInf?: { Ustrd: string };
}

export interface Pacs008Document {
  GrpHdr: GroupHeader;
  CdtTrfTxInf: Pacs008CdtTrfTxInf[];
  /** Convenience: serialised XML. */
  readonly serialisedXml: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const PACS008_NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10";

/**
 * Generate a pacs.008.001.10 Customer Credit Transfer document.
 *
 * @param payment   The PaymentInitiated event payload.
 * @param sender    Sending financial institution (the bank).
 * @param receiver  Receiving financial institution (correspondent/beneficiary bank).
 * @param msgId     Optional message ID; defaults to paymentRef.
 */
export function generatePacs008(
  payment: PaymentInitiatedPayload,
  sender: FIIdentification,
  receiver: FIIdentification,
  msgId?: string,
): Pacs008Document {
  const initiatedDate = new Date(payment.initiatedAt);
  const settlementDate = formatIso8601Date(initiatedDate);
  const creDtTm = formatIso8601DateTime(initiatedDate);

  const messageId = msgId ?? payment.paymentRef.slice(0, 35);
  const absMinor = BigInt(Math.abs(payment.netCash));

  const grpHdr: GroupHeader = {
    MsgId: messageId,
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

  const cdtTrfTxInf: Pacs008CdtTrfTxInf = {
    PmtId: {
      InstrId: messageId,
      EndToEndId: payment.paymentRef.slice(0, 35),
      TxId: payment.paymentRef.slice(0, 35),
      UETR: generateUetr(payment.paymentRef),
    },
    IntrBkSttlmAmt: {
      Ccy: payment.currency,
      value: formatIso20022Amount(absMinor),
    },
    IntrBkSttlmDt: settlementDate,
    Dbtr: {
      Nm: sender.name ?? "THE BANK ZA",
      PstlAdr: { Ctry: sender.country ?? "ZA" },
    },
    DbtrAcct: {
      Id: {
        Othr: {
          Id: `/NOSTRO-${sender.bic}`,
          SchmeNm: { Cd: "BBAN" },
        },
      },
      Ccy: payment.currency,
    },
    DbtrAgt: {
      FinInstnId: { BICFI: sender.bic },
    },
    Cdtr: {
      Nm: receiver.name ?? payment.tradeId,
      PstlAdr: { Ctry: receiver.country ?? "ZA" },
    },
    CdtrAcct: {
      Id: {
        Othr: {
          Id: `/ACCOUNT-${receiver.bic}`,
          SchmeNm: { Cd: "BBAN" },
        },
      },
      Ccy: payment.currency,
    },
    CdtrAgt: {
      FinInstnId: { BICFI: receiver.bic },
    },
    RmtInf: {
      Ustrd: `PAYMENT ${payment.paymentRef} TRADE ${payment.tradeId}`,
    },
  };

  const docBody = { GrpHdr: grpHdr, CdtTrfTxInf: [cdtTrfTxInf] };
  const serialisedXml = serialiseToXml({ FIToFICstmrCdtTrf: docBody }, PACS008_NAMESPACE);

  return {
    GrpHdr: grpHdr,
    CdtTrfTxInf: [cdtTrfTxInf],
    serialisedXml,
  };
}
