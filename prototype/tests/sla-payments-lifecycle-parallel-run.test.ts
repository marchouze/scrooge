// tests/sla-payments-lifecycle-parallel-run.test.ts
//
// Full-retirement Batch 4 (the LAST family) — byte-for-byte parity regression
// (brief deliverable 3). Every payment / settlement lifecycle event is fed
// through BOTH the rules-as-data SLA interpreter (PAYMENTS_IFRS_RULES) and the
// legacy posting-rule functions (platform/accounting/posting-rules/payments.ts).
//
// Success criterion (CEO design call, Marc, 2026-06-05): legacy and interpreter
// MUST agree BYTE-FOR-BYTE at every lifecycle stage. The payment legs the legacy
// engine booked correctly are ZAR / USD (and EUR for the nostro); parity holds
// exactly for those. The cutover in runtime/agents/bea-gl-posting-engine.ts is
// only safe because this guard is green.
//
// Stages covered:
//   initiation  (PR-PAY-001): suspense ↔ nostro — ZAR / USD / EUR (nostro).
//   settlement  (PR-PAY-002): customer-payable ↔ suspense — ZAR / USD.
//   instruction (PR-SET-001): settlement-receivable ↔ suspense — ZAR / USD.
//
// Every amount is the integer `netCash` field on the triggering event (schema-
// positive), so no enrichment is supplied — matching the production cutover
// bridge, which passes none. There is no zero-skip path (the schema forbids a
// zero amount), so every stage produces a posting.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 4, CEO-approved
//            2026-06-05).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  paymentInitiatedJournals,
  paymentSettledJournals,
  settlementInstructionJournals,
} from "../platform/accounting/posting-rules/payments";
import { type InterpretResult, interpret } from "../platform/accounting/sla/interpreter";
import { PAYMENTS_IFRS_RULES } from "../platform/accounting/sla/rules/payments-index";

const ASOF = "2026-06-05T10:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

interface NormalLeg {
  accountId: string;
  debitCredit: string;
  amountMinor: number;
  currency: string;
}

function normalise(legs: ReadonlyArray<SubLedgerLeg>): NormalLeg[] {
  return legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: l.amountMinor,
    currency: l.currency,
  }));
}

function runOne(type: string, payload: unknown): InterpretResult {
  const results = interpret(
    { type, entity: ENTITY, as_of: ASOF, payload },
    PAYMENTS_IFRS_RULES,
    ["IFRS"],
    ASOF,
  );
  const r = results.find((x) => x.representation === "IFRS");
  if (!r) throw new Error(`no IFRS result for ${type}`);
  return r;
}

/** Interpreter legs as NormalLeg[] (empty when no-GL / intentional-no-impact). */
function interpLegs(r: InterpretResult): NormalLeg[] {
  if (r.outcome === "intentional-no-impact") return [];
  if (r.outcome !== "post") throw new Error(`expected post/no-impact, got ${r.outcome}`);
  return r.legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

function assertBalances(legs: NormalLeg[]): void {
  const byCcy = new Map<string, number>();
  for (const l of legs) {
    const signed = l.debitCredit === "debit" ? l.amountMinor : -l.amountMinor;
    byCcy.set(l.currency, (byCcy.get(l.currency) ?? 0) + signed);
  }
  for (const [, net] of byCcy) expect(net).toBe(0);
}

/** Assert interpreter == legacy byte-for-byte (+ balanced). */
function expectParity(
  type: string,
  payload: unknown,
  legacyLegs: ReadonlyArray<SubLedgerLeg>,
): void {
  const legacy = normalise(legacyLegs);
  const interp = interpLegs(runOne(type, payload));
  expect(interp).toEqual(legacy);
  assertBalances(interp);
}

// ---------------------------------------------------------------------------
// PR-PAY-001 — PaymentInitiated (suspense ↔ nostro)
// ---------------------------------------------------------------------------

describe("Payment initiation (PR-PAY-001) — suspense ↔ nostro parity", () => {
  function initiated(currency: string, netCash: number) {
    return {
      tradeId: "PAY-T1",
      legKind: "deliver" as const,
      paymentRef: "REF-PAY-T1",
      currency,
      netCash,
      initiatedAt: "2026-06-05T10:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    };
  }
  it("ZAR — byte-for-byte", () => {
    const p = initiated("ZAR", 1_500_000);
    expectParity("PaymentInitiated", p, paymentInitiatedJournals(p as never));
  });
  it("USD — byte-for-byte", () => {
    const p = initiated("USD", 250_000);
    expectParity("PaymentInitiated", p, paymentInitiatedJournals(p as never));
  });
});

// ---------------------------------------------------------------------------
// PR-PAY-002 — PaymentSettled (customer-payable ↔ suspense)
// ---------------------------------------------------------------------------

describe("Payment settlement (PR-PAY-002) — payable ↔ suspense parity", () => {
  function settled(currency: string, netCash: number) {
    return {
      tradeId: "PAY-T1",
      legKind: "deliver" as const,
      paymentRef: "REF-PAY-T1",
      currency,
      netCash,
      settledAt: "2026-06-05T12:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    };
  }
  it("ZAR — byte-for-byte", () => {
    const p = settled("ZAR", 1_500_000);
    expectParity("PaymentSettled", p, paymentSettledJournals(p as never));
  });
  it("USD — byte-for-byte", () => {
    const p = settled("USD", 250_000);
    expectParity("PaymentSettled", p, paymentSettledJournals(p as never));
  });
});

// ---------------------------------------------------------------------------
// PR-SET-001 — SettlementInstructionReceived (receivable ↔ suspense)
// ---------------------------------------------------------------------------

describe("Settlement instruction (PR-SET-001) — receivable ↔ suspense parity", () => {
  function instruction(currency: string, netCash: number) {
    return {
      tradeId: "PAY-T1",
      legKind: "receive" as const,
      settlementDate: "2026-06-07",
      currency,
      netCash,
      correspondent: { name: "Correspondent Bank", bic: "CORRZAJJ" },
      citations: ["PROC-PAY-RBH-01"],
    };
  }
  it("ZAR — byte-for-byte", () => {
    const p = instruction("ZAR", 3_200_000);
    expectParity("SettlementInstructionReceived", p, settlementInstructionJournals(p as never));
  });
  it("USD — byte-for-byte", () => {
    const p = instruction("USD", 480_000);
    expectParity("SettlementInstructionReceived", p, settlementInstructionJournals(p as never));
  });
});
