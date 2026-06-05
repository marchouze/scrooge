// tests/sla-expression.test.ts
//
// Hard unit tests for the sandboxed amount-expression evaluator
// (platform/accounting/sla/expression.ts) — the Principle-4 security boundary.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  ExpressionEvalError,
  ExpressionParseError,
  UnknownPathError,
  bigIntDivHalfEven,
  evaluateAmount,
  evaluatePredicate,
  evaluateString,
  parseExpression,
} from "../platform/accounting/sla/expression";

const scope = {
  event: {
    near: {
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { amountMinor: 1_900_000_000 },
      counterNotional: { amountMinor: 100_000_000 },
      stage: 2,
    },
    bigStr: "9007199254740993",
  },
  context: { zarRate: 19 },
};

describe("evaluator — arithmetic & functions", () => {
  it("abs / neg / min / max", () => {
    expect(evaluateAmount("abs(event.near.notional.amountMinor)", scope)).toBe(1_900_000_000n);
    expect(evaluateAmount("neg(event.near.notional.amountMinor)", scope)).toBe(-1_900_000_000n);
    expect(evaluateAmount("min(5, 3, 9)", scope)).toBe(3n);
    expect(evaluateAmount("max(5, 3, 9)", scope)).toBe(9n);
  });

  it("operator precedence: 2 + 3 * 4 == 14", () => {
    expect(evaluateAmount("2 + 3 * 4", scope)).toBe(14n);
  });

  it("parentheses override precedence: (2 + 3) * 4 == 20", () => {
    expect(evaluateAmount("(2 + 3) * 4", scope)).toBe(20n);
  });

  it("if(cond, a, b) selects the right branch", () => {
    expect(evaluateAmount("if(event.near.stage >= 2, 100, 0)", scope)).toBe(100n);
    expect(evaluateAmount("if(event.near.stage >= 3, 100, 0)", scope)).toBe(0n);
  });
});

describe("evaluator — BigInt beyond 2^53 is exact", () => {
  it("integer literal arithmetic past 2^53 stays exact", () => {
    // 2^53 = 9007199254740992; +1 would be lost in float64.
    expect(evaluateAmount("9007199254740992 + 1", scope)).toBe(9_007_199_254_740_993n);
  });

  it("string-encoded minor amounts past 2^53 coerce to exact BigInt", () => {
    expect(evaluateAmount("event.bigStr + 0", scope)).toBe(9_007_199_254_740_993n);
  });

  it("multiplication of large magnitudes is exact", () => {
    expect(evaluateAmount("1000000000000 * 1000000", scope)).toBe(1_000_000_000_000_000_000n);
  });
});

describe("evaluator — banker's half-even division", () => {
  it("rounds halves to even", () => {
    expect(bigIntDivHalfEven(5n, 2n)).toBe(2n); // 2.5 -> 2 (even)
    expect(bigIntDivHalfEven(7n, 2n)).toBe(4n); // 3.5 -> 4 (even)
    expect(bigIntDivHalfEven(9n, 2n)).toBe(4n); // 4.5 -> 4 (even)
    expect(bigIntDivHalfEven(11n, 2n)).toBe(6n); // 5.5 -> 6 (even)
  });

  it("rounds non-halves normally", () => {
    expect(bigIntDivHalfEven(7n, 3n)).toBe(2n); // 2.33 -> 2
    expect(bigIntDivHalfEven(8n, 3n)).toBe(3n); // 2.67 -> 3
  });

  it("is sign-symmetric around zero", () => {
    expect(bigIntDivHalfEven(-5n, 2n)).toBe(-2n);
    expect(bigIntDivHalfEven(-7n, 2n)).toBe(-4n);
  });

  it("exposes half-even via the / operator", () => {
    expect(evaluateAmount("5 / 2", scope)).toBe(2n);
    expect(evaluateAmount("7 / 2", scope)).toBe(4n);
  });

  it("rejects division by zero loudly", () => {
    expect(() => evaluateAmount("10 / 0", scope)).toThrow(ExpressionEvalError);
  });
});

describe("evaluator — predicates", () => {
  it("comparisons and boolean logic", () => {
    expect(evaluatePredicate("event.near.stage >= 2", scope)).toBe(true);
    expect(evaluatePredicate("event.near.stage > 5 || event.near.stage == 2", scope)).toBe(true);
    expect(evaluatePredicate("!(event.near.stage == 2)", scope)).toBe(false);
    expect(evaluatePredicate("event.near.payCurrency == 'ZAR'", scope)).toBe(true);
    expect(evaluatePredicate("event.near.payCurrency != 'USD'", scope)).toBe(true);
  });

  it("exists(...) on present vs absent paths", () => {
    expect(evaluatePredicate("exists(event.near.stage)", scope)).toBe(true);
    expect(evaluatePredicate("exists(event.near.missing)", scope)).toBe(false);
  });
});

describe("evaluator — string evaluation (currency paths)", () => {
  it("reads a currency code from a path", () => {
    expect(evaluateString("event.near.payCurrency", scope)).toBe("ZAR");
  });
});

describe("evaluator — reject loudly", () => {
  it("unknown path throws UnknownPathError (never silent 0)", () => {
    expect(() => evaluateAmount("event.does.not.exist", scope)).toThrow(UnknownPathError);
  });

  it("unknown path on a missing intermediate object", () => {
    expect(() => evaluateAmount("event.near.notional.nope", scope)).toThrow(UnknownPathError);
  });

  it("non-integer literal in money arithmetic is rejected", () => {
    expect(() => evaluateAmount("1.5 + 2", scope)).toThrow(ExpressionEvalError);
  });

  it("rejects unknown function names", () => {
    expect(() => parseExpression("sqrt(4)")).toThrow(ExpressionParseError);
  });

  it("rejects bare identifiers that are not event/context/func", () => {
    expect(() => parseExpression("globalThis")).toThrow(ExpressionParseError);
  });

  it("rejects escape sequences in string literals", () => {
    expect(() => parseExpression("event['a\\nb']")).toThrow(ExpressionParseError);
  });

  it("rejects trailing garbage", () => {
    expect(() => parseExpression("1 + 2 )")).toThrow(ExpressionParseError);
  });
});

describe("evaluator — no code execution (security boundary)", () => {
  it("cannot reach process / Bun / globals — they are unknown identifiers", () => {
    expect(() => parseExpression("process.exit(1)")).toThrow(ExpressionParseError);
    expect(() => parseExpression("Bun.spawn()")).toThrow(ExpressionParseError);
    expect(() => parseExpression("require('fs')")).toThrow(ExpressionParseError);
  });
});
