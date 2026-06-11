// platform/payments/correspondent-connector.ts
//
// Correspondent bank connector — ISO 20022 envelope types + injection contract.
//
// W2.1 — Correspondent settlement interface stubs.
//
// The bank is an indirect NPS participant settling ZAR via a correspondent /
// sponsor bank into SAMOS (South African Multiple Option Settlement). This
// module defines the typed connector interface, the ISO 20022 message envelope
// types, and a stub implementation for the build phase.
//
// External block: correspondent / sponsor-bank selection is pending (a CEO
// decision at the licence-application moment). This module converts W2.1 to
// "wire-up only at unlock" — all types and the injection contract are in place
// so that selecting a correspondent requires only dropping in a concrete
// BICSpecificCorrespondentConnector; no interface surgery is needed.
//
// Injection contract: at correspondent/sponsor-bank selection
// (licence-application moment), replace StubCorrespondentConnector with a
// concrete BICSpecificCorrespondentConnector that wraps the correspondent's
// SWIFT gpi/CBPR+ channel. The concrete adapter must handle:
//   - SWIFT gpi tracking headers (pacs.008/009 UETR field)
//   - ISO 20022 MX envelope serialisation
//   - TLS/mTLS per the correspondent's Customer Security Programme (CSP)
//   - SAMOS settlement window cut-offs (SARB NPSD §4)
//
// ISO 20022 message families covered:
//   pacs.008 — FIToFICustomerCreditTransfer (fund nostro / client payment)
//   pacs.009 — FinancialInstitutionCreditTransfer (interbank / treasury)
//   pacs.002 — FIToFIPaymentStatusReport (status / rejection acknowledgement)
//   camt.053 — BankToCustomerStatement (EOD nostro reconciliation)
//   camt.054 — BankToCustomerDebitCreditNotification (intraday notification)
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11).
// Citations: NPS-ACT-78-1998; SARB-NPSD; ISO-20022; SWIFT-CSP-2024;
//   Banks Act 94/1990; PROC-PAY-RBH-01; Principles/1-events-are-truth.md.
// Author: Tomas (Operations & payments engineer, engineering)

// ---------------------------------------------------------------------------
// ISO 20022 message envelope types (minimal — only fields the bank needs)
// ---------------------------------------------------------------------------

/**
 * pacs.008 — FIToFICustomerCreditTransfer
 *
 * Used for outbound credit transfers: funding the nostro account at the
 * correspondent or routing a client payment via the correspondent into SAMOS.
 * ISO 20022 equivalent of SWIFT MT103.
 *
 * The concrete adapter adds the UETR (Unique End-to-end Transaction Reference,
 * UUIDv4) required for SWIFT gpi tracking.
 */
export interface Pacs008CreditTransfer {
  /** Unique message identifier (MsgId in GrpHdr; max 35 chars per ISO 20022). */
  msgId: string;
  /** IBAN of the creditor account (beneficiary). */
  creditorIBAN: string;
  /** BIC of the creditor financial institution (8 or 11 chars). */
  creditorBIC: string;
  /** Instructed amount in minor currency units (always positive; direction is credit). */
  instructedAmount: number;
  /** ISO 4217 currency code, e.g. "ZAR". */
  currency: string;
  /** ISO 8601 date (YYYY-MM-DD) — value date / interbank settlement date. */
  settlementDate: string;
  /** End-to-end reference preserved through the payment chain (max 35 chars). */
  endToEndId: string;
  /** Optional remittance information (Ustrd; max 140 chars). */
  remittanceInfo?: string;
}

/**
 * pacs.009 — FinancialInstitutionCreditTransfer
 *
 * Used for interbank / treasury financial-institution transfers: pure
 * FI-to-FI money movement without an underlying retail/client transaction.
 * ISO 20022 equivalent of SWIFT MT202.
 *
 * Typical uses: intraday nostro funding, treasury sweeps, repo/MMD funding
 * leg dispatch via correspondent.
 */
export interface Pacs009FinancialInstitutionTransfer {
  /** Unique message identifier (max 35 chars). */
  msgId: string;
  /** BIC of the creditor financial institution (8 or 11 chars). */
  creditorBIC: string;
  /** Instructed amount in minor currency units (always positive). */
  instructedAmount: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** ISO 8601 date (YYYY-MM-DD) — interbank settlement date. */
  settlementDate: string;
  /** End-to-end reference (max 35 chars). */
  endToEndId: string;
  /**
   * Purpose code (ISO 20022 Purpose/Cd element):
   *   "TREA" — treasury transfer
   *   "CORT" — commercial trade
   * Drives STP routing at the correspondent.
   */
  purpose?: "TREA" | "CORT" | string;
}

/**
 * pacs.002 — FIToFIPaymentStatusReport
 *
 * The correspondent's acknowledgement / rejection response to a pacs.008
 * or pacs.009 instruction. Maps to the TxSts (Transaction Status) element.
 *
 *   ACSC — AcceptedSettlementCompleted: funds credited.
 *   RJCT — Rejected: instruction declined; rejectReason is mandatory.
 *   PDNG — Pending: accepted but settlement not yet confirmed (e.g. cut-off
 *           not yet reached, SAMOS queue position not yet resolved).
 */
export interface Pacs002StatusReport {
  /** MsgId from the original pacs.008 or pacs.009 instruction. */
  originalMsgId: string;
  /**
   * Transaction status:
   *   ACSC — Accepted Settlement Completed
   *   RJCT — Rejected
   *   PDNG — Pending
   */
  txStatus: "ACSC" | "RJCT" | "PDNG";
  /**
   * Reject reason code (ISO 20022 StsRsnInf/Rsn/Cd) — present when
   * txStatus === "RJCT". Common codes: AM04 (insufficient funds), AC01
   * (incorrect account), FF01 (invalid file format), NARR (narrative).
   */
  rejectReason?: string;
  /** ISO 8601 date (YYYY-MM-DD) of the status determination. */
  statusDate: string;
}

/**
 * camt.053 — BankToCustomerStatement
 *
 * End-of-day account statement from the correspondent for nostro
 * reconciliation. The `entries` array contains each credit/debit booking on
 * the account for the statement period.
 *
 * At licence-day this feeds:
 *   - Tomas's three-way nostro reconciliation (PROC-PAY-RBH-01)
 *   - Ravi's intraday-liquidity BCBS 248 Tool 1 (available-at-start-of-day)
 *   - Bea's nostro GL sub-ledger recon
 */
export interface Camt053AccountStatement {
  /** Account identifier at the correspondent (IBAN or proprietary). */
  accountId: string;
  /** ISO 8601 date (YYYY-MM-DD) — start of statement period. */
  fromDate: string;
  /** ISO 8601 date (YYYY-MM-DD) — end of statement period. */
  toDate: string;
  /** Opening balance in minor currency units. */
  openingBalance: number;
  /** Closing balance in minor currency units. */
  closingBalance: number;
  /** ISO 4217 currency of the account. */
  currency: string;
  /** Statement entries (bookings) for the period. */
  entries: Array<{
    /** Amount in minor currency units (always positive; direction in creditDebit). */
    amount: number;
    /** CRDT — credit (funds received); DBIT — debit (funds sent). */
    creditDebit: "CRDT" | "DBIT";
    /** ISO 8601 date the entry was booked at the correspondent. */
    bookingDate: string;
    /** ISO 8601 value date (effective date for interest / float). */
    valueDate: string;
    /** Correspondent's own reference / end-to-end ID (max 35 chars). */
    reference: string;
    /** BIC of the counterparty institution (when available). */
    counterpartyBIC?: string;
  }>;
}

/**
 * camt.054 — BankToCustomerDebitCreditNotification
 *
 * Intraday credit or debit notification from the correspondent.
 * Arrives after each settlement in SAMOS (or the correspondent's own
 * real-time notification channel).
 *
 * Used by Tomas's intraday reconciliation pass and Ravi's BCBS 248
 * intraday-liquidity monitoring.
 */
export interface Camt054CreditDebitNotification {
  /** Notification identifier (unique per message from the correspondent). */
  notificationId: string;
  /** Account identifier at the correspondent (IBAN or proprietary). */
  accountId: string;
  /** Amount in minor currency units (always positive). */
  amount: number;
  /** CRDT — credit; DBIT — debit. */
  creditDebit: "CRDT" | "DBIT";
  /** ISO 8601 value date for this credit/debit. */
  valueDate: string;
  /** End-to-end or transaction reference from the originating payment. */
  reference: string;
  /** BIC of the counterparty institution (when available). */
  counterpartyBIC?: string;
}

// ---------------------------------------------------------------------------
// Connector interface — the injection point
// ---------------------------------------------------------------------------

/**
 * CorrespondentConnector — the single boundary between the bank's payments
 * substrate and its correspondent / sponsor bank's SAMOS settlement channel.
 *
 * All outbound settlement instructions and all inbound statement / notification
 * feeds route through this interface. Concrete implementations:
 *
 *   StubCorrespondentConnector   — build-phase stub (this file; always returns
 *                                   ACSC / empty statements).
 *   BICSpecificCorrespondentConnector — (created at correspondent selection)
 *                                   wraps the correspondent's SWIFT gpi /
 *                                   CBPR+ channel with mTLS per the CSP.
 *
 * Wire-up gate: inject the concrete adapter via the payments-gateway factory
 * at licence-application moment. The stub is used until then — no conditional
 * branching in callers required; swap the binding.
 */
export interface CorrespondentConnector {
  /**
   * Send a customer credit transfer (pacs.008) to fund nostro or route a
   * client payment via the correspondent into SAMOS.
   *
   * Returns the correspondent's synchronous status report (pacs.002). In
   * production this is typically PDNG (Pending) until SAMOS settlement
   * completes; a callback / polling path is used for ACSC.
   */
  sendCreditTransfer(msg: Pacs008CreditTransfer): Promise<Pacs002StatusReport>;

  /**
   * Send a financial institution transfer (pacs.009) for interbank / treasury
   * money movement (nostro funding, treasury sweeps, repo funding legs).
   *
   * Returns the correspondent's synchronous status report (pacs.002).
   */
  sendFITransfer(msg: Pacs009FinancialInstitutionTransfer): Promise<Pacs002StatusReport>;

  /**
   * Fetch the EOD account statement (camt.053) for `accountId` as of `asOf`
   * (ISO 8601 date). Returns null when no statement is available (e.g. cut-off
   * not yet reached, or account has no activity on that date).
   *
   * Used by Tomas's nostro reconciliation and Ravi's BCBS 248 monitoring.
   */
  fetchEodStatement(accountId: string, asOf: string): Promise<Camt053AccountStatement | null>;

  /**
   * Fetch intraday credit/debit notifications (camt.054) for `accountId`
   * since `since` (ISO 8601 datetime). Returns empty array when no
   * notifications are available since the given timestamp.
   *
   * Used by Tomas's intraday reconciliation and Ravi's intraday-liquidity
   * BCBS 248 Tool 1 monitoring.
   */
  fetchIntradayNotifications(
    accountId: string,
    since: string,
  ): Promise<Camt054CreditDebitNotification[]>;
}

// ---------------------------------------------------------------------------
// Stub implementation — build phase
// ---------------------------------------------------------------------------

/**
 * StubCorrespondentConnector — build-phase no-op implementation.
 *
 * All outbound instructions return ACSC (Accepted Settlement Completed)
 * immediately. All inbound fetch methods return null / empty. This is the
 * correct posture for the build phase: no real capital, no real SAMOS
 * connectivity, no real correspondent bank selected.
 *
 * Injection contract:
 *   At correspondent/sponsor-bank selection (licence-application moment),
 *   replace this binding with a BICSpecificCorrespondentConnector that:
 *     1. Wraps the selected correspondent's SWIFT gpi / CBPR+ channel.
 *     2. Adds the UETR (UUIDv4) to all pacs.008 / pacs.009 messages for
 *        SWIFT gpi tracker compliance.
 *     3. Serialises messages to ISO 20022 MX (XML) per the correspondent's
 *        published CSP profile.
 *     4. Opens a TLS/mTLS connection per the correspondent's CSP — no
 *        plaintext transmission of payment instructions is permitted
 *        (SWIFT-CSP-2024; PA/FSCA JS-2 §4.3).
 *     5. Honours SARB NPSD cut-off windows for SAMOS settlement
 *        (SARB NPSD §4 — settlement finality is intraday; last cycle is
 *        16:00 SAST; late instructions queue to next business day).
 *
 * Authority: D-TREASURER-WAVE2-SUBSTRATE.
 */
export class StubCorrespondentConnector implements CorrespondentConnector {
  async sendCreditTransfer(msg: Pacs008CreditTransfer): Promise<Pacs002StatusReport> {
    return {
      originalMsgId: msg.msgId,
      txStatus: "ACSC",
      statusDate: msg.settlementDate,
    };
  }

  async sendFITransfer(
    msg: Pacs009FinancialInstitutionTransfer,
  ): Promise<Pacs002StatusReport> {
    return {
      originalMsgId: msg.msgId,
      txStatus: "ACSC",
      statusDate: msg.settlementDate,
    };
  }

  async fetchEodStatement(
    _accountId: string,
    _asOf: string,
  ): Promise<Camt053AccountStatement | null> {
    return null;
  }

  async fetchIntradayNotifications(
    _accountId: string,
    _since: string,
  ): Promise<Camt054CreditDebitNotification[]> {
    return [];
  }
}
