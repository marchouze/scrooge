// v2-core/regulatory-returns/cell-value/engine.test.ts
//
// Phase 0 framework tests for the per-cell value engine
// (D-BA-RETURN-CELL-VALUE-ENGINE): the decimal-native derivation evaluator and
// the attribution-driven cell-value engine. No domain data — a synthetic 3-line
// "form" exercises leaf folding, subtotal evaluation to a fixpoint, the
// fail-closed contract, and the no-double-count guard.

import { describe, expect, test } from "bun:test";
import { toDecimal } from "../../../platform/core/decimal-engine";
import type { ReturnContract } from "../cell-contract";
import { registerLineAttribution } from "./attribution";
import { evaluateDerivation, referencedCells } from "./derivation-eval";
import { type TrialBalanceAmount, computeFromAttribution } from "./engine";

describe("evaluateDerivation — decimal-native form arithmetic", () => {
  const val = new Map<string, string>([
    ["R0010 C0010", "100"],
    ["R0020 C0010", "25.5"],
  ]);
  const resolve = (_f: string, row: string, col: string) => {
    const v = val.get(`${row} ${col}`);
    return v === undefined ? null : toDecimal(v);
  };

  test("adds referenced cells", () => {
    const r = evaluateDerivation("[TF,R0010,C0010]+[TF,R0020,C0010]", "TF", resolve);
    expect(r?.toString()).toBe("125.5");
  });

  test("respects precedence and parentheses", () => {
    expect(evaluateDerivation("[TF,R0010,C0010]*2+10", "TF", resolve)?.toString()).toBe("210");
    expect(evaluateDerivation("([TF,R0010,C0010]+10)/2", "TF", resolve)?.toString()).toBe("55");
  });

  test("percentage formula (÷100)", () => {
    expect(evaluateDerivation("[TF,R0010,C0010]*8/100", "TF", resolve)?.toString()).toBe("8");
  });

  test("FAIL-CLOSED: any unresolved ref ⇒ null (never partial)", () => {
    expect(evaluateDerivation("[TF,R0010,C0010]+[TF,R9999,C0010]", "TF", resolve)).toBeNull();
  });

  test("division by zero ⇒ null (no Infinity/NaN)", () => {
    expect(evaluateDerivation("[TF,R0010,C0010]/0", "TF", resolve)).toBeNull();
  });

  test("empty / prose expression ⇒ null (leaf, not a formula)", () => {
    expect(evaluateDerivation("", "TF", resolve)).toBeNull();
    expect(
      evaluateDerivation("ba700-capital-adequacy-fold for line R0110", "TF", resolve),
    ).toBeNull();
  });

  test("referencedCells extracts the dependency set", () => {
    expect(referencedCells("[TF,R0010,C0010]+[TF,R0020,C0010]")).toEqual([
      { form: "TF", row: "R0010", column: "C0010" },
      { form: "TF", row: "R0020", column: "C0010" },
    ]);
  });
});

// A synthetic 3-line form: two leaves (R0010, R0020) and a subtotal (R0030).
const SYNTH_CONTRACT = {
  returnForm: "BA100",
  formName: "Synthetic",
  obligationId: "ORG-TEST",
  schemaSource: "test",
  cells: [
    {
      cellRef: { xsdElement: "X-R0010", row: "R0010", column: "C0010" },
      derivation: { kind: "direct", expression: "" },
      valueType: "money",
    },
    {
      cellRef: { xsdElement: "X-R0020", row: "R0020", column: "C0010" },
      derivation: { kind: "direct", expression: "" },
      valueType: "money",
    },
    {
      cellRef: { xsdElement: "X-R0030", row: "R0030", column: "C0010" },
      derivation: { kind: "sum", expression: "[BA100,R0010,C0010]+[BA100,R0020,C0010]" },
      valueType: "money",
    },
  ],
} as unknown as ReturnContract;

const TB: readonly TrialBalanceAmount[] = [
  { leafAccountId: "ACC-A", amountMinor: 30_000_000_000, currency: "ZAR" }, // 300,000,000.00
  { leafAccountId: "ACC-B", amountMinor: 5_000_000, currency: "ZAR" }, // 50,000.00
  { leafAccountId: "ACC-USD", amountMinor: 999, currency: "USD" }, // ignored (non-functional)
];

describe("computeFromAttribution — leaf fold + subtotal fixpoint", () => {
  test("leaves fold from attributed accounts; subtotal computes via the form formula", () => {
    const attribution = {
      form: "BA100" as const,
      authoredBySeat: "test",
      reconcilesTo: "test-oracle",
      entries: [
        { account: "ACC-A", row: "R0010", column: "C0010", sign: "as-is" as const },
        { account: "ACC-B", row: "R0020", column: "C0010", sign: "as-is" as const },
      ],
    };
    const values = computeFromAttribution(attribution, {
      form: "BA100",
      contract: SYNTH_CONTRACT,
      trialBalance: TB,
      functionalCurrency: "ZAR",
    });

    expect(values.get("X-R0010")).toEqual({
      amount: "300000000",
      valueType: "money",
      currency: "ZAR",
    });
    expect(values.get("X-R0020")).toEqual({ amount: "50000", valueType: "money", currency: "ZAR" });
    // Subtotal = R0010 + R0020, computed by the form's own derivation.
    expect(values.get("X-R0030")).toEqual({
      amount: "300050000",
      valueType: "money",
      currency: "ZAR",
    });
  });

  test("a subtotal stays UNFILLED when a leaf is unattributed (fail-closed, no partial)", () => {
    const attribution = {
      form: "BA100" as const,
      authoredBySeat: "test",
      reconcilesTo: "test-oracle",
      // Only R0010 attributed — R0020 has no account, so the R0030 subtotal must
      // not resolve (it would be a partial/wrong total).
      entries: [{ account: "ACC-A", row: "R0010", column: "C0010", sign: "as-is" as const }],
    };
    const values = computeFromAttribution(attribution, {
      form: "BA100",
      contract: SYNTH_CONTRACT,
      trialBalance: TB,
      functionalCurrency: "ZAR",
    });
    expect(values.get("X-R0010")?.amount).toBe("300000000");
    expect(values.has("X-R0030")).toBe(false);
  });

  test("registry rejects an account attributed to two cells (double-count guard)", () => {
    expect(() =>
      registerLineAttribution({
        form: "BA110",
        authoredBySeat: "test",
        reconcilesTo: "test-oracle",
        entries: [
          { account: "ACC-A", row: "R0010", column: "C0010", sign: "as-is" },
          { account: "ACC-A", row: "R0020", column: "C0010", sign: "as-is" },
        ],
      }),
    ).toThrow(/more than one cell/);
  });
});
