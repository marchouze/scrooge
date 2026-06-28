// v2-core/regulatory-returns/cell-value/engine.test.ts
//
// Phase 0 framework tests for the per-cell value engine
// (D-BA-RETURN-CELL-VALUE-ENGINE): the decimal-native derivation evaluator and
// the generic, source-agnostic `computeDerivedCells` fixpoint. Leaf values are
// supplied directly (in production they are folded from the underlying events by
// a seat-owned per-form leaf fold — not from the CoA). A synthetic 3-line "form"
// exercises leaf pass-through, subtotal evaluation to a fixpoint, and the
// fail-closed contract.

import { describe, expect, test } from "bun:test";
import { toDecimal } from "../../fil-core/decimal";
import type { ReturnContract } from "../cell-contract";
import { evaluateDerivation, referencedCells } from "./derivation-eval";
import { type LeafCellValues, computeDerivedCells } from "./engine";

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

describe("computeDerivedCells — generic leaf pass-through + subtotal fixpoint", () => {
  test("leaves pass through; the subtotal computes via the form's own formula", () => {
    const leafValues: LeafCellValues = new Map([
      ["R0010 C0010", "300000000"],
      ["R0020 C0010", "50000"],
    ]);
    const values = computeDerivedCells({
      contract: SYNTH_CONTRACT,
      leafValues,
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

  test("a subtotal stays UNFILLED when a leaf is missing (fail-closed, no partial)", () => {
    // Only R0010 supplied — the R0030 subtotal references R0020, which has no
    // value, so it must NOT resolve (a partial/wrong total).
    const leafValues: LeafCellValues = new Map([["R0010 C0010", "300000000"]]);
    const values = computeDerivedCells({
      contract: SYNTH_CONTRACT,
      leafValues,
      functionalCurrency: "ZAR",
    });
    expect(values.get("X-R0010")?.amount).toBe("300000000");
    expect(values.has("X-R0030")).toBe(false);
  });

  test("no leaves ⇒ no values (the page shows only the aggregate cells)", () => {
    const values = computeDerivedCells({
      contract: SYNTH_CONTRACT,
      leafValues: new Map(),
      functionalCurrency: "ZAR",
    });
    expect(values.size).toBe(0);
  });
});
