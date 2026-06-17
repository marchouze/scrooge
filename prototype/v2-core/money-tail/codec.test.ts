// v2-core/money-tail/codec.test.ts
//
// Unit tests for the money-bearing non-financial TAIL store-tee MoneyWire codecs.
// Because the money fields are data-empty in the build phase (0 ReconciliationBreak;
// the recorded DailyReconciliationReport events all carry empty breaks), the parity
// gate (recon:money-tail-v2-parity) is PASS-on-empty on the money LIFT — so the
// codecs' MINOR→MAJOR-unit + currency-source CORRECTNESS is proven HERE on a
// POSITIVE figure (the honest place to prove a transform when the production money
// population is legitimately empty; Charter cmd 3/5 — NOT a forced legacy seed).
//
// Each test asserts: (a) the optional minor-unit amount is lifted to MoneyWire with
// the exact decimal MAJOR-unit amount, (b) the currency is sourced from the payload
// (never defaulted), (c) the codec output validates against the v2 schema, (d)
// non-money fields pass through verbatim, (e) an absent amount stays absent, and
// (f) an amount present without its sibling currency FAILS CLOSED.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { isMoneyWire } from "../core/money-wire";
import {
  MONEY_TAIL_SPECS,
  MONEY_TAIL_TYPES,
  dailyReconciliationReportCodec,
  dailyReconciliationReportV2PayloadSchema,
  reconciliationBreakCodec,
  reconciliationBreakV2PayloadSchema,
} from "./events";
import { foldMoneyTailRegister } from "./projection";

describe("money-tail codecs — MINOR-unit lift; currency sourced from payload", () => {
  test("ReconciliationBreak lifts tradeAmount/paymentAmount on a positive amount break", () => {
    const out = reconciliationBreakCodec({
      tradeId: "FX-TRD-001",
      kind: "amount",
      description:
        "Amount mismatch: settlement instruction netCash=123456 but payment settled netCash=123400 (currency ZAR)",
      tradeAmount: 123456, // minor units (cents)
      paymentAmount: 123400,
      currency: "ZAR",
      detectedAt: "2026-06-17T08:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    });

    expect(isMoneyWire(out.tradeAmount)).toBe(true);
    expect(out.tradeAmount).toEqual({ __money: "v1", amount: "1234.56", currency: "ZAR" });
    expect(out.paymentAmount).toEqual({ __money: "v1", amount: "1234", currency: "ZAR" });
    // Non-money fields pass through verbatim.
    expect(out.tradeId).toBe("FX-TRD-001");
    expect(out.kind).toBe("amount");
    expect(out.detectedAt).toBe("2026-06-17T08:00:00Z");
    expect(out.currency).toBe("ZAR");
    // Validates against the v2 schema.
    expect(() => reconciliationBreakV2PayloadSchema.parse(out)).not.toThrow();
  });

  test("ReconciliationBreak: non-ZAR currency is sourced, not defaulted", () => {
    const out = reconciliationBreakCodec({
      tradeId: "FX-TRD-002",
      kind: "amount",
      description: "Amount mismatch",
      tradeAmount: 5000, // USD cents
      paymentAmount: 4999,
      currency: "USD",
      detectedAt: "2026-06-17T08:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    });
    expect(out.tradeAmount).toEqual({ __money: "v1", amount: "50", currency: "USD" });
    expect(out.paymentAmount).toEqual({ __money: "v1", amount: "49.99", currency: "USD" });
  });

  test("ReconciliationBreak: absent money fields stay absent (timing/nostro break)", () => {
    const out = reconciliationBreakCodec({
      tradeId: "FX-TRD-003",
      kind: "timing",
      description: "Ledger leg missing within 4h; self-correcting expected",
      detectedAt: "2026-06-17T08:00:00Z",
      citations: ["PROC-PAY-RBH-01"],
    });
    expect("tradeAmount" in out).toBe(false);
    expect("paymentAmount" in out).toBe(false);
    expect(() => reconciliationBreakV2PayloadSchema.parse(out)).not.toThrow();
  });

  test("ReconciliationBreak: amount present without currency FAILS CLOSED", () => {
    expect(() =>
      reconciliationBreakCodec({
        tradeId: "FX-TRD-004",
        kind: "amount",
        description: "Amount mismatch with no currency",
        tradeAmount: 100,
        detectedAt: "2026-06-17T08:00:00Z",
        citations: ["PROC-PAY-RBH-01"],
      }),
    ).toThrow(/currency must be sourced/i);
  });

  test("DailyReconciliationReport lifts amounts inside breaks[]", () => {
    const out = dailyReconciliationReportCodec({
      asOf: "2026-06-17",
      matchedCount: 2,
      breakCount: 1,
      breaks: [
        {
          tradeId: "FX-TRD-005",
          kind: "amount",
          description: "Amount mismatch (currency ZAR)",
          tradeAmount: 250000,
          paymentAmount: 249900,
          currency: "ZAR",
          detectedAt: "2026-06-17T08:00:00Z",
        },
      ],
      citations: ["PROC-PAY-RBH-01"],
    });
    const breaks = out.breaks as Array<Record<string, unknown>>;
    const firstBreak = breaks[0];
    expect(firstBreak).toBeDefined();
    expect(firstBreak?.tradeAmount).toEqual({ __money: "v1", amount: "2500", currency: "ZAR" });
    expect(firstBreak?.paymentAmount).toEqual({ __money: "v1", amount: "2499", currency: "ZAR" });
    expect(out.matchedCount).toBe(2);
    expect(() => dailyReconciliationReportV2PayloadSchema.parse(out)).not.toThrow();
  });

  test("DailyReconciliationReport: empty breaks (the build-phase shape) passes through", () => {
    const out = dailyReconciliationReportCodec({
      asOf: "2026-06-10",
      matchedCount: 0,
      breakCount: 0,
      breaks: [],
      citations: ["PROC-PAY-RBH-01", "NPS-ACT-78-1998", "BANKS-ACT-94-1990"],
    });
    expect(out.breaks).toEqual([]);
    expect(() => dailyReconciliationReportV2PayloadSchema.parse(out)).not.toThrow();
  });
});

describe("money-tail projection — decoded-decimal parity (v2 == codec(V1))", () => {
  test("V1 codec-applied register equals an as-stored v2 register", () => {
    const v1View = {
      event_id: "evt-1",
      type: "ReconciliationBreak",
      payload: {
        tradeId: "FX-TRD-006",
        kind: "amount",
        description: "Amount mismatch (currency ZAR)",
        tradeAmount: 777,
        paymentAmount: 778,
        currency: "ZAR",
        detectedAt: "2026-06-17T08:00:00Z",
        citations: ["PROC-PAY-RBH-01"],
      },
    };
    const typeSet = new Set(MONEY_TAIL_TYPES);
    const v1 = foldMoneyTailRegister([v1View], typeSet, /* applyCodec */ true);
    // The v2 store would hold exactly codec(v1 payload); fold it as-stored.
    const v2View = { ...v1View, payload: reconciliationBreakCodec(v1View.payload) };
    const v2 = foldMoneyTailRegister([v2View], typeSet, /* applyCodec */ false);
    expect(v2.rows).toEqual(v1.rows);
  });

  test("the batch manifest covers exactly the two money-tail types", () => {
    expect(MONEY_TAIL_TYPES).toEqual(["DailyReconciliationReport", "ReconciliationBreak"]);
    expect(MONEY_TAIL_SPECS.map((s) => s.type).sort()).toEqual([
      "DailyReconciliationReport",
      "ReconciliationBreak",
    ]);
  });
});
