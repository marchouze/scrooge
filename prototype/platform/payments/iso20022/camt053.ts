// platform/payments/iso20022/camt053.ts
//
// camt.053.001.12 BankToCustomerStatement (End-of-Day Bank Statement)
//
// camt.053 is the ISO 20022 message for end-of-day bank statements, sent
// from the correspondent bank to the bank. It is the ISO 20022 equivalent
// of SWIFT MT940. The correspondent sends one camt.053 per account per day
// showing all entries (credits and debits) and the opening/closing balances.
//
// Structure:
//   GrpHdr — Group Header
//   Stmt — Statement (one per account)
//     Id — Statement identifier
//     Acct — Account details
//     Bal — Balance entries (opening + closing)
//     Ntry — Transaction entries (one per booking)
//       Amt — Amount
//       CdtDbtInd — Credit/Debit indicator
//       BookgDt — Booking date
//       ValDt — Value date
//       BkTxCd — Bank transaction code
//       NtryDtls — Entry details (narrative, references)
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent bank provides ISO 20022 statements
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   ISO-20022 — camt.053.001.12 message specification
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

import {
  type ActiveCurrencyAndAmount,
  type CashAccount,
  formatIso8601Date,
  formatIso8601DateTime,
  formatIso20022Amount,
  serialiseToXml,
} from "./types";

// ---------------------------------------------------------------------------
// camt.053 entry types
// ---------------------------------------------------------------------------

export interface Camt053Entry {
  /** Amount in minor units (always positive; direction from CdtDbtInd). */
  amountMinor: bigint;
  /** ISO 4217 currency. */
  currency: string;
  /** CRDT = credit (funds in), DBIT = debit (funds out). */
  CdtDbtInd: "CRDT" | "DBIT";
  /** Booking date (when posted to account). */
  BookgDt: Date;
  /** Value date (when effective). */
  ValDt: Date;
  /** Bank transaction code (domain + family + sub-family). */
  BkTxCd: {
    Domn?: { Cd: string; Fmly: { Cd: string; SubFmlyCd: string } };
    Prtry?: { Cd: string; Issr?: string };
  };
  /** Entry details — references and narrative. */
  NtryDtls?: {
    TxDtls?: Array<{
      Refs?: { EndToEndId?: string; TxId?: string };
      RmtInf?: { Ustrd?: string };
    }>;
  };
}

// ---------------------------------------------------------------------------
// camt.053 balance
// ---------------------------------------------------------------------------

export interface Camt053Balance {
  Tp: {
    CdOrPrtry: { Cd: string }; // OPBD (opening) or CLBD (closing)
  };
  Amt: ActiveCurrencyAndAmount;
  CdtDbtInd: "CRDT" | "DBIT";
  Dt: { Dt: string };
}

// ---------------------------------------------------------------------------
// camt.053 statement
// ---------------------------------------------------------------------------

export interface Camt053Statement {
  Id: string;
  StmtPgntn?: { PgNb: string; LastPgInd: boolean };
  Acct: CashAccount;
  Bal: Camt053Balance[];
  Ntry: Array<{
    Amt: ActiveCurrencyAndAmount;
    CdtDbtInd: "CRDT" | "DBIT";
    Sts: { Cd: "BOOK" };
    BookgDt: { Dt: string };
    ValDt: { Dt: string };
    BkTxCd: Camt053Entry["BkTxCd"];
    NtryDtls?: Camt053Entry["NtryDtls"];
  }>;
}

// ---------------------------------------------------------------------------
// camt.053 document
// ---------------------------------------------------------------------------

export interface Camt053GrpHdr {
  MsgId: string;
  CreDtTm: string;
  MsgRcpt?: {
    Id?: { OrgId?: { AnyBIC: string } };
  };
  MsgPgntn?: { PgNb: string; LastPgInd: boolean };
}

export interface Camt053Document {
  GrpHdr: Camt053GrpHdr;
  Stmt: Camt053Statement[];
  /** Convenience: serialised XML. */
  readonly serialisedXml: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const CAMT053_NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:camt.053.001.12";

/**
 * Generate a camt.053.001.12 End-of-Day Bank Statement (inbound nostro statement).
 *
 * @param params.accountIban      IBAN of the nostro account at the correspondent.
 * @param params.correspondentBic BIC of the correspondent bank (sender).
 * @param params.statementDate    Date of the statement.
 * @param params.openingBalance   Opening balance in minor units (positive = credit).
 * @param params.entries          Statement entries.
 * @param params.currency         ISO 4217 currency of the account.
 * @param params.statementId      Optional statement ID; defaults to date-based ref.
 */
export function generateCamt053(params: {
  accountIban: string;
  correspondentBic: string;
  statementDate: Date;
  openingBalance: bigint;
  entries: Camt053Entry[];
  currency: string;
  statementId?: string;
}): Camt053Document {
  const {
    accountIban,
    correspondentBic,
    statementDate,
    openingBalance,
    entries,
    currency,
    statementId,
  } = params;

  const dateStr = formatIso8601Date(statementDate);
  const stmtId = statementId ?? `${correspondentBic}-${dateStr}-001`;
  const msgId = `MSG-${stmtId}`.slice(0, 35);
  const creDtTm = formatIso8601DateTime(statementDate);

  // Compute closing balance
  let netMovement = 0n;
  for (const entry of entries) {
    if (entry.CdtDbtInd === "CRDT") {
      netMovement += entry.amountMinor;
    } else {
      netMovement -= entry.amountMinor;
    }
  }
  const closingBalance = openingBalance + netMovement;

  const openingMark: "CRDT" | "DBIT" = openingBalance >= 0n ? "CRDT" : "DBIT";
  const closingMark: "CRDT" | "DBIT" = closingBalance >= 0n ? "CRDT" : "DBIT";
  const openingAbs = openingBalance < 0n ? -openingBalance : openingBalance;
  const closingAbs = closingBalance < 0n ? -closingBalance : closingBalance;

  const grpHdr: Camt053GrpHdr = {
    MsgId: msgId,
    CreDtTm: creDtTm,
  };

  const balances: Camt053Balance[] = [
    {
      Tp: { CdOrPrtry: { Cd: "OPBD" } },
      Amt: { Ccy: currency, value: formatIso20022Amount(openingAbs) },
      CdtDbtInd: openingMark,
      Dt: { Dt: dateStr },
    },
    {
      Tp: { CdOrPrtry: { Cd: "CLBD" } },
      Amt: { Ccy: currency, value: formatIso20022Amount(closingAbs) },
      CdtDbtInd: closingMark,
      Dt: { Dt: dateStr },
    },
  ];

  const ntryList: Camt053Statement["Ntry"] = entries.map((entry) => ({
    Amt: {
      Ccy: entry.currency,
      value: formatIso20022Amount(entry.amountMinor),
    },
    CdtDbtInd: entry.CdtDbtInd,
    Sts: { Cd: "BOOK" },
    BookgDt: { Dt: formatIso8601Date(entry.BookgDt) },
    ValDt: { Dt: formatIso8601Date(entry.ValDt) },
    BkTxCd: entry.BkTxCd,
    NtryDtls: entry.NtryDtls,
  }));

  const stmt: Camt053Statement = {
    Id: stmtId,
    Acct: {
      Id: {
        IBAN: accountIban,
      },
      Ccy: currency,
      Nm: `NOSTRO ${correspondentBic}`,
    },
    Bal: balances,
    Ntry: ntryList,
  };

  const docBody = { GrpHdr: grpHdr, Stmt: [stmt] };
  const serialisedXml = serialiseToXml({ BkToCstmrStmt: docBody }, CAMT053_NAMESPACE);

  return {
    GrpHdr: grpHdr,
    Stmt: [stmt],
    serialisedXml,
  };
}
