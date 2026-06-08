// platform/accounting/sla/rules/pr-payments.ts
//
// Payment / settlement lifecycle IFRS posting rules, expressed as rules-as-data.
// The sole production posting path for payment-initiated / payment-settled /
// settlement-instruction-received; account mappings come from PAYMENT_ACCOUNTS
// (resolver.ts). The interpreter suite
// (tests/sla-payments-lifecycle-interpreter.test.ts) pins the leg footprints on
// real payment-lifecycle fixtures.
//
// This is the FIFTH and LAST product family in the full-retirement series (after
// FX, treasury, securities and IRD). After the cutover (Batch 4) every product
// family routes through an interpreter bridge; the legacy posting-rule dispatch
// arms in runtime/agents/bea-gl-posting-engine.ts are fully strangled.
//
// Coverage (one rule per posting-producing legacy function):
//   PR-PAY-001  PaymentInitiated              — payment-in-flight (suspense ↔ nostro)
//   PR-PAY-002  PaymentSettled                — correspondent confirms (payable ↔ suspense)
//   PR-SET-001  SettlementInstructionReceived — receivable recognition (receivable ↔ suspense)
//
// ─── CANONICAL EVENT TYPES ──────────────────────────────────────────────────
// The accounting event types are the three lifecycle events the legacy posting
// engine consumed (event-store/event-types/payments.ts). The other six payment
// event types (JournalEntryPosted, ReconciliationBreak, DailyReconciliationReport,
// OutboundMessageDispatched, InboundMessageReceived, MessageCorrelated) NEVER
// reached the legacy GL dispatch — they are reconciliation / messaging / report
// memos with no posting-rule. They are NOT ported as rules (the interpreter is
// only consulted for the three event types the engine routes to it); the cutover
// bridge's `PAYMENTS_INTERPRETER_EVENT_TYPES` set is exactly those three. (Were a
// memo rule ever wanted for symmetry it would be `intentional-no-impact`; but the
// legacy engine had no dispatch arm for them, so adding one would be net-new
// behaviour, not a faithful port — they stay out.)
//
// ─── NO BRANCHING ───────────────────────────────────────────────────────────
// Each legacy function emits exactly two fixed legs (a debit and a credit of the
// same `netCash`), with NO sign-branching: `netCash` is `z.number().int()
// .positive()` on all three payloads, so it is always > 0. Each rule therefore
// has two unconditional lines (`condition: always`, no per-line `when`). There is
// no zero-skip path (unlike the IRD / treasury rules) because the schema forbids a
// zero amount.
//
// ─── AMOUNTS ARE INTEGER MINOR UNITS; NO ENRICHMENT ─────────────────────────
// Every amount is `event.netCash` — an integer minor-unit field carried directly
// on the triggering event. No float multiplication, no prior-event lookup: the
// rules STAY PURE and the cutover bridge passes NO enrichment (mirroring the IRD
// family).
//
// ─── PER-CURRENCY ACCOUNT RESOLUTION ────────────────────────────────────────
// The legacy `*AccountForCurrency` helpers map per-currency: nostro ZAR/USD/EUR;
// suspense / customer-payable / settlement-receivable ZAR/USD. They THREW for any
// other currency. The resolver reproduces the ZAR/USD/EUR mapping exactly and, for
// an unmapped currency, routes the leg to the FX unresolved-currency suspense
// (ACC-2100-007) + a high-severity urgent-correction alert — the documented
// no-silent-fallback divergence (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE), identical
// in spirit to the treasury / securities / IRD families. Byte-for-byte parity
// holds for the currencies the legacy engine booked correctly.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 4, CEO-approved
//            2026-06-05); D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved
//            2026-06-05).
// Cites: IFRS 9 §3.1.1 (initial recognition); IAS 32 §11 (financial-instrument
//        recognition); PROC-PAY-RBH-01 (three-way reconciliation procedure).

import type { SlaRule } from "../generated/sla-types";

/** Product key — every payment rule resolves accounts under this product. */
const PAY = "PAY" as const;

// ---------------------------------------------------------------------------
// PR-PAY-001 — PaymentInitiated (payment instruction sent to correspondent)
//
// Legacy (paymentInitiatedJournals): two fixed legs, amount = payload.netCash.
//   DR  Payment Suspense [ccy]   netCash  — liability side of payment in flight
//   CR  Nostro [ccy]             netCash  — correspondent nostro debited
// The suspense captures the obligation until the correspondent confirms
// (PR-PAY-002 clears it). No branching; `netCash` is schema-positive.
// postingType: "payment-initiation".
// ---------------------------------------------------------------------------

export const PR_PAY_001: SlaRule = {
  rule_id: "PR-PAY-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "PaymentInitiated",
    instrument_type: PAY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail:
      "IAS 32 §11 / IFRS 9 §3.1.1 — payment-in-flight recognised when the instruction is sent; suspense ↔ nostro",
  },
  lines: [
    {
      account: { logical: "payment.suspense", product: PAY, currency: "ZAR" },
      side: "debit",
      amount: "event.netCash",
      currency: "event.currency",
    },
    {
      account: { logical: "payment.nostro", product: PAY, currency: "ZAR" },
      side: "credit",
      amount: "event.netCash",
      currency: "event.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.1.1", "urn:obligation:ifrs:ias32:11"],
};

// ---------------------------------------------------------------------------
// PR-PAY-002 — PaymentSettled (correspondent confirms cash exchange)
//
// Legacy (paymentSettledJournals): two fixed legs, amount = payload.netCash.
//   DR  Customer Payables [ccy]  netCash  — obligation to customer discharged
//   CR  Payment Suspense [ccy]   netCash  — suspense cleared (payment confirmed)
// Closes the suspense opened by PR-PAY-001. postingType: "payment-settlement".
// ---------------------------------------------------------------------------

export const PR_PAY_002: SlaRule = {
  rule_id: "PR-PAY-002",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "PaymentSettled",
    instrument_type: PAY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail:
      "IFRS 9 §3.1.1 — customer payable discharged on confirmed settlement; suspense cleared (payable ↔ suspense)",
  },
  lines: [
    {
      account: { logical: "payment.customer_payable", product: PAY, currency: "ZAR" },
      side: "debit",
      amount: "event.netCash",
      currency: "event.currency",
    },
    {
      account: { logical: "payment.suspense", product: PAY, currency: "ZAR" },
      side: "credit",
      amount: "event.netCash",
      currency: "event.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.1.1"],
};

// ---------------------------------------------------------------------------
// PR-SET-001 — SettlementInstructionReceived (trade leg arrives from counterparty)
//
// Legacy (settlementInstructionJournals): two fixed legs, amount = payload.netCash.
//   DR  Settlement Receivable [ccy]  netCash  — asset: right to receive funds
//   CR  Payment Suspense [ccy]       netCash  — offsetting suspense liability
// Trade-date recognition of the receivable (IFRS 9 §3.1.1). The suspense is
// cleared when the nostro confirms receipt. postingType: "settlement-instruction".
// ---------------------------------------------------------------------------

export const PR_SET_001: SlaRule = {
  rule_id: "PR-SET-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "SettlementInstructionReceived",
    instrument_type: PAY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail:
      "IFRS 9 §3.1.1 — trade-date recognition of the settlement receivable; suspense offset (receivable ↔ suspense)",
  },
  lines: [
    {
      account: { logical: "payment.settlement_receivable", product: PAY, currency: "ZAR" },
      side: "debit",
      amount: "event.netCash",
      currency: "event.currency",
    },
    {
      account: { logical: "payment.suspense", product: PAY, currency: "ZAR" },
      side: "credit",
      amount: "event.netCash",
      currency: "event.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.1.1"],
};
