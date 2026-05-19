// platform/payments/swift-mt/mt940.ts
//
// MT940 Customer Statement Message (inbound simulator).
//
// MT940 is the SWIFT message used by correspondent/custodian banks to
// deliver end-of-day nostro account statements to their clients (us).
// This module simulates the inbound MT940 that the correspondent bank
// would send after settling FX legs.
//
// Fields generated:
//   :20:  Transaction Reference Number
//   :25:  Account Identification
//   :28C: Statement Number / Sequence Number
//   :60F: Opening Balance (Final or Interim)
//   :61:  Statement Line (one per entry)
//   :86:  Information to Account Owner (narrative per :61:)
//   :62F: Closing Balance (Final)
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent bank provides nostro statements
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   SWIFT-MT940-SPEC — SWIFT Standards MT940 specification
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import {
  type SwiftBlock4,
  type SwiftField,
  type SwiftMessage,
  formatSwiftAmount,
  formatSwiftDate,
  serialiseSwiftMessage,
} from "./types";

// ---------------------------------------------------------------------------
// MT940 entry types
// ---------------------------------------------------------------------------

export interface Mt940Entry {
  /** Value date for this entry. */
  valueDate: Date;
  /** Entry date (posting date). Defaults to valueDate if not supplied. */
  entryDate?: Date;
  /** Credit/Debit mark. C = credit (funds in), D = debit (funds out). */
  creditDebitMark: "C" | "D";
  /** Amount in minor units (always positive; direction from creditDebitMark). */
  amountMinor: bigint;
  /** ISO 4217 currency code. */
  currency: string;
  /** SWIFT transaction type code (4 chars, e.g. "FXCF" for FX confirmation). */
  transactionTypeCode: string;
  /** Customer reference (up to 16 chars). */
  customerReference: string;
  /** Bank reference (up to 16 chars). */
  bankReference?: string;
  /** Narrative for :86: field (information to account owner). */
  narrative: string;
}

// ---------------------------------------------------------------------------
// MT940 block 4 type
// ---------------------------------------------------------------------------

export interface Mt940Block4 extends SwiftBlock4 {
  // List of SwiftField following the MT940 structure.
}

export type Mt940Message = SwiftMessage<Mt940Block4> & {
  readonly serialised: string;
  /** Computed closing balance in minor units. */
  readonly closingBalance: bigint;
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate an MT940 Customer Statement Message (inbound nostro statement).
 *
 * @param params.accountId        Nostro account identifier at the correspondent.
 * @param params.correspondentBic BIC of the correspondent bank (sender of the MT940).
 * @param params.statementDate    Date of the statement.
 * @param params.openingBalance   Opening balance in minor units (positive = credit).
 * @param params.entries          Statement entries (transactions).
 * @param params.currency         ISO 4217 currency of the account.
 * @param params.statementNumber  Statement number (default 1).
 * @param params.sequenceNumber   Sequence number within statement (default 1).
 * @param params.receiverBic      BIC of the receiving bank (us). Default BANKZAJJXXX.
 */
export function generateMt940(params: {
  accountId: string;
  correspondentBic: string;
  statementDate: Date;
  openingBalance: bigint;
  entries: Mt940Entry[];
  currency: string;
  statementNumber?: number;
  sequenceNumber?: number;
  receiverBic?: string;
}): Mt940Message {
  const {
    accountId,
    correspondentBic,
    statementDate,
    openingBalance,
    entries,
    currency,
    statementNumber = 1,
    sequenceNumber = 1,
    receiverBic = "BANKZAJJXXX",
  } = params;

  const stmtRef = `STMT${formatSwiftDate(statementDate)}${String(statementNumber).padStart(4, "0")}`;

  // Opening balance: positive = credit balance (Cr), negative = debit balance (Dr)
  const openingMark = openingBalance >= 0n ? "C" : "D";
  const openingAbs = openingBalance < 0n ? -openingBalance : openingBalance;
  const openingSwiftDate = formatSwiftDate(statementDate);

  // Compute closing balance = opening + net of entries
  let netMovement = 0n;
  for (const entry of entries) {
    if (entry.creditDebitMark === "C") {
      netMovement += entry.amountMinor;
    } else {
      netMovement -= entry.amountMinor;
    }
  }
  const closingBalance = openingBalance + netMovement;
  const closingMark = closingBalance >= 0n ? "C" : "D";
  const closingAbs = closingBalance < 0n ? -closingBalance : closingBalance;

  const block4Fields: SwiftField[] = [
    { tag: "20", value: stmtRef.slice(0, 16) },
    { tag: "25", value: `${accountId}/${currency}` },
    {
      tag: "28C",
      value: `${String(statementNumber).padStart(5, "0")}/${String(sequenceNumber).padStart(2, "0")}`,
    },
    {
      tag: "60F",
      value: `${openingMark}${openingSwiftDate}${currency}${formatSwiftAmount(openingAbs)}`,
    },
  ];

  // Add entry lines
  for (const entry of entries) {
    const valueDateStr = formatSwiftDate(entry.valueDate);
    const entryDateStr = entry.entryDate
      ? formatSwiftDate(entry.entryDate).slice(2) // MMDD only for entry date
      : valueDateStr.slice(2);

    const bankRef = entry.bankReference ?? "NONREF";

    // :61: format: YYMMDD[MMDD]<C/D>[<3rd currency>]<amount>N<code><customer ref>[//<bank ref>]
    const line61 = `${valueDateStr}${entryDateStr}${entry.creditDebitMark}${formatSwiftAmount(entry.amountMinor)}N${entry.transactionTypeCode.padEnd(4, " ").slice(0, 4)}${entry.customerReference.slice(0, 16)}//${bankRef.slice(0, 16)}`;

    block4Fields.push({ tag: "61", value: line61 });
    block4Fields.push({ tag: "86", value: entry.narrative.slice(0, 390) });
  }

  // Closing balance
  block4Fields.push({
    tag: "62F",
    value: `${closingMark}${openingSwiftDate}${currency}${formatSwiftAmount(closingAbs)}`,
  });

  const block4 = block4Fields as Mt940Block4;

  const msg: Omit<Mt940Message, "serialised" | "closingBalance"> = {
    block1: {
      appId: "F",
      serviceId: "01",
      logicalTerminal: `${correspondentBic.padEnd(12, "X").slice(0, 12)}0000000000`,
      sessionNumber: "0000",
      sequenceNumber: "000000",
    },
    block2: {
      direction: "O",
      messageType: "940",
      inputTime: "0700",
      mir: `${formatSwiftDate(statementDate)}${correspondentBic.slice(0, 12).padEnd(12, "X")}0000000000`,
      outputDate: formatSwiftDate(statementDate),
      outputTime: "0800",
      priority: "N",
    },
    block4,
  };

  void receiverBic;

  const serialised = serialiseSwiftMessage(msg);

  return { ...msg, serialised, closingBalance };
}
