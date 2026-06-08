// tests/sla-payments-lifecycle-interpreter.test.ts
//
// Interpreter-side leg-correctness regression for the payment / settlement
// product family (PR-PAY-001 / PR-PAY-002 / PR-SET-001). This is the durable
// guard that the rules-as-data SLA interpreter (PAYMENTS_IFRS_RULES) produces the
// CORRECT double-entry legs for every payment lifecycle stage. It replaces the
// retired byte-for-byte parallel-run suite (the legacy posting-rule functions in
// platform/accounting/posting-rules/payments.ts were the dead reference oracle;
// they were retired together with the legacy GL posting engine in the SLA
// full-retirement Stage 3). The expected legs below are the interpreter's own
// output — which the now-retired parallel-run proved equal to the legacy engine
// for every currency the legacy engine booked correctly (ZAR / USD).
//
// Stages covered:
//   initiation  (PR-PAY-001): suspense ↔ nostro — ZAR / USD.
//   settlement  (PR-PAY-002): customer-payable ↔ suspense — ZAR / USD.
//   instruction (PR-SET-001): settlement-receivable ↔ suspense — ZAR / USD.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Stage 3, CEO-approved —
//            standing decision; Marc in-session 2026-06-08).

import { describe, expect, it } from "bun:test";

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

/** Assert the interpreter produces exactly `expected` legs (+ balanced). */
function expectInterpreterLegs(type: string, payload: unknown, expected: NormalLeg[]): void {
  const interp = interpLegs(runOne(type, payload));
  expect(interp).toEqual(expected);
  assertBalances(interp);
}

// ---------------------------------------------------------------------------
// PR-PAY-001 — PaymentInitiated (suspense ↔ nostro)
// ---------------------------------------------------------------------------

describe("Payment initiation (PR-PAY-001) — suspense ↔ nostro", () => {
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
  it("ZAR", () => {
    expectInterpreterLegs("PaymentInitiated", initiated("ZAR", 1_500_000), [
      { accountId: "ACC-2400-001", debitCredit: "debit", amountMinor: 1_500_000, currency: "ZAR" },
      { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 1_500_000, currency: "ZAR" },
    ]);
  });
  it("USD", () => {
    expectInterpreterLegs("PaymentInitiated", initiated("USD", 250_000), [
      { accountId: "ACC-2400-002", debitCredit: "debit", amountMinor: 250_000, currency: "USD" },
      { accountId: "ACC-1200-002", debitCredit: "credit", amountMinor: 250_000, currency: "USD" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// PR-PAY-002 — PaymentSettled (customer-payable ↔ suspense)
// ---------------------------------------------------------------------------

describe("Payment settlement (PR-PAY-002) — payable ↔ suspense", () => {
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
  it("ZAR", () => {
    expectInterpreterLegs("PaymentSettled", settled("ZAR", 1_500_000), [
      { accountId: "ACC-2200-001", debitCredit: "debit", amountMinor: 1_500_000, currency: "ZAR" },
      { accountId: "ACC-2400-001", debitCredit: "credit", amountMinor: 1_500_000, currency: "ZAR" },
    ]);
  });
  it("USD", () => {
    expectInterpreterLegs("PaymentSettled", settled("USD", 250_000), [
      { accountId: "ACC-2200-002", debitCredit: "debit", amountMinor: 250_000, currency: "USD" },
      { accountId: "ACC-2400-002", debitCredit: "credit", amountMinor: 250_000, currency: "USD" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// PR-SET-001 — SettlementInstructionReceived (receivable ↔ suspense)
// ---------------------------------------------------------------------------

describe("Settlement instruction (PR-SET-001) — receivable ↔ suspense", () => {
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
  it("ZAR", () => {
    expectInterpreterLegs("SettlementInstructionReceived", instruction("ZAR", 3_200_000), [
      { accountId: "ACC-4100-001", debitCredit: "debit", amountMinor: 3_200_000, currency: "ZAR" },
      { accountId: "ACC-2400-001", debitCredit: "credit", amountMinor: 3_200_000, currency: "ZAR" },
    ]);
  });
  it("USD", () => {
    expectInterpreterLegs("SettlementInstructionReceived", instruction("USD", 480_000), [
      { accountId: "ACC-4100-002", debitCredit: "debit", amountMinor: 480_000, currency: "USD" },
      { accountId: "ACC-2400-002", debitCredit: "credit", amountMinor: 480_000, currency: "USD" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Schema conformance — every payment rule satisfies the rules-as-data contract.
// ---------------------------------------------------------------------------

describe("PAYMENTS_IFRS_RULES schema conformance", () => {
  it("every rule carries the schema-required fields + valid enums", () => {
    for (const rule of PAYMENTS_IFRS_RULES) {
      expect(rule.rule_id.startsWith("PR-")).toBe(true);
      expect(["IFRS", "SARB-BA-RETURN", "ZA-TAX"]).toContain(rule.representation);
      expect(rule.version).toBeGreaterThanOrEqual(1);
      expect(rule.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rule.applies_to.event_type.length).toBeGreaterThan(0);
      expect(["always", "non-zero-delta", "non-zero-pnl", "intentional-no-impact"]).toContain(
        rule.condition.kind,
      );
      expect(rule.balancing).toBe("assert_zero");
      expect(rule.cites.length).toBeGreaterThan(0);
    }
  });

  it("rule ids are unique", () => {
    const ids = PAYMENTS_IFRS_RULES.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
