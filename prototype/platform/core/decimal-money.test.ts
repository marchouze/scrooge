// platform/core/decimal-money.test.ts
//
// Proves the slice-1 money foundation contracts:
//   - exact decimal arithmetic (NO IEEE-754 float drift)
//   - correct per-currency rounding (JPY 0-dp, USD 2-dp, BHD 3-dp)
//   - largest-remainder penny-allocation CONSERVATION
//   - settlement rounding-difference conservation
//   - codec round-trip + no-float guard
//   - the pilot conversion end-to-end (type → codec → projection-read)
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import {
  ROUNDING,
  type RoundingContext,
  add,
  allocate,
  compare,
  convertFx,
  divideRounded,
  eq,
  isZero,
  money,
  mulScalar,
  neg,
  round,
  settleWithResidual,
  sub,
  sum,
  zeroMoney,
} from "./decimal-money";
import {
  EXPONENT_NO_MINOR_UNIT,
  ISO4217_EXPONENTS,
  hasNoMinorUnit,
  isKnownCurrency,
  scaleFor,
} from "./iso4217";
import { decodeMoney, encodeMoney, findFloatMoneyViolations, isMoneyWire } from "./money-codec";
import { buildFeeCharged, buildFxSpotBooked, readFeeAmount, readFxSpotLegs } from "./money-pilot";
import type { Currency } from "./types";

const ZAR = "ZAR" as Currency;
const USD = "USD" as Currency;
const JPY = "JPY" as Currency;
const BHD = "BHD" as Currency;
const XAU = "XAU" as Currency;

describe("exact decimal arithmetic (no float drift)", () => {
  it("0.1 + 0.2 === 0.3 exactly (the canonical float trap)", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; must be exact here.
    expect(add(money("0.1", ZAR), money("0.2", ZAR)).amount).toBe("0.3");
  });

  it("repeated addition does not accumulate drift", () => {
    let acc = zeroMoney(ZAR);
    for (let i = 0; i < 1000; i++) acc = add(acc, money("0.01", ZAR));
    expect(acc.amount).toBe("10");
  });

  it("carries full precision through subtraction", () => {
    expect(sub(money("1", ZAR), money("0.000000001", ZAR)).amount).toBe("0.999999999");
  });

  it("sum() folds a list exactly", () => {
    expect(sum([money("0.1", USD), money("0.2", USD), money("0.3", USD)], USD).amount).toBe("0.6");
  });

  it("mulScalar keeps full precision (no premature rounding)", () => {
    expect(mulScalar(money("100", USD), "0.0825").amount).toBe("8.25");
    expect(mulScalar(money("1", USD), "1.005").amount).toBe("1.005");
  });

  it("rejects cross-currency arithmetic", () => {
    expect(() => add(money("1", ZAR), money("1", USD) as never)).toThrow(/Currency mismatch/);
  });

  it("eq / compare / isZero", () => {
    expect(eq(money("1.50", USD), money("1.5", USD))).toBe(true);
    expect(compare(money("1", USD), money("2", USD))).toBe(-1);
    expect(isZero(money("0.00", USD))).toBe(true);
    expect(eq(neg(money("5", USD)), money("-5", USD))).toBe(true);
  });
});

describe("ISO 4217 boundary table", () => {
  it("covers 0-dp, 2-dp, 3-dp, 4-dp and no-minor-unit", () => {
    expect(scaleFor(JPY)).toBe(0);
    expect(scaleFor(USD)).toBe(2);
    expect(scaleFor(BHD)).toBe(3);
    expect(scaleFor("CLF" as Currency)).toBe(4);
    expect(hasNoMinorUnit(XAU)).toBe(true);
    expect(ISO4217_EXPONENTS.XAU).toBe(EXPONENT_NO_MINOR_UNIT);
  });

  it("does NOT throw on a no-minor-unit currency (policy default, not throw)", () => {
    // The legacy stub threw 'Unsupported currency'. Now → policy default.
    expect(scaleFor(XAU)).toBe(2);
  });

  it("unknown currency degrades to policy default, never throws", () => {
    expect(isKnownCurrency("ZZZ" as Currency)).toBe(false);
    expect(scaleFor("ZZZ" as Currency)).toBe(2);
  });
});

describe("per-currency rounding", () => {
  it("JPY rounds to 0 dp", () => {
    expect(round(money("1234.56", JPY), ROUNDING.SETTLEMENT).amount).toBe("1235");
  });

  it("USD rounds to 2 dp", () => {
    expect(round(money("1.005", USD), ROUNDING.SETTLEMENT).amount).toBe("1.01");
  });

  it("BHD rounds to 3 dp", () => {
    expect(round(money("1.2345", BHD), ROUNDING.SETTLEMENT).amount).toBe("1.235");
  });

  it("HALF_EVEN (interest) differs from HALF_UP at the .5 boundary", () => {
    // 2.5 → HALF_EVEN → 2 ; 3.5 → HALF_EVEN → 4
    const ctx: RoundingContext = { mode: "HALF_EVEN", scale: 0 };
    expect(round(money("2.5", USD), ctx).amount).toBe("2");
    expect(round(money("3.5", USD), ctx).amount).toBe("4");
    // HALF_UP: 2.5 → 3
    expect(round(money("2.5", USD), { mode: "HALF_UP", scale: 0 }).amount).toBe("3");
  });

  it("divideRounded rounds once at the boundary", () => {
    // 100 / 3 = 33.333... → USD 2dp HALF_UP → 33.33
    expect(divideRounded(money("100", USD), "3", ROUNDING.INTEREST).amount).toBe("33.33");
  });

  it("supports a higher working scale than the currency exponent", () => {
    // interest accrual kept at 6 dp
    const r = divideRounded(money("100", USD), "3", { mode: "HALF_EVEN", scale: 6 });
    expect(r.amount).toBe("33.333333");
  });
});

describe("FX conversion rounding", () => {
  it("rounds to the TARGET currency exponent", () => {
    // 100 USD * 18.1234 → 1812.34 ZAR (2 dp)
    expect(convertFx(money("100", USD), "18.1234", ZAR).amount).toBe("1812.34");
    // USD → JPY rounds to 0 dp
    expect(convertFx(money("10", USD), "149.876", JPY).amount).toBe("1499");
  });
});

describe("penny allocation (largest-remainder, conservation)", () => {
  it("splits a non-divisible total so slices sum EXACTLY to the total", () => {
    // 100.00 / 3 → 33.34 + 33.33 + 33.33 = 100.00
    const slices = allocate(money("100", USD), ["1", "1", "1"]);
    expect(slices.map((s) => s.amount)).toEqual(["33.34", "33.33", "33.33"]);
    expect(sum(slices, USD).amount).toBe("100");
  });

  it("conserves value across weighted slices", () => {
    const total = money("1000", USD);
    const slices = allocate(total, ["3", "5", "2"]);
    expect(sum(slices, USD).amount).toBe("1000");
    // weights 3:5:2 → 300 / 500 / 200 (exact here)
    expect(slices.map((s) => s.amount)).toEqual(["300", "500", "200"]);
  });

  it("conserves a remainder-bearing weighted split", () => {
    // 0.10 across 3 equal slices @ 2dp: 0.04 + 0.03 + 0.03
    const slices = allocate(money("0.10", USD), ["1", "1", "1"]);
    expect(sum(slices, USD).amount).toBe("0.1");
    expect(slices.map((s) => s.amount).sort()).toEqual(["0.03", "0.03", "0.04"]);
  });

  it("JPY allocation conserves at 0 dp", () => {
    const slices = allocate(money("1000", JPY), ["1", "1", "1"]);
    expect(sum(slices, JPY).amount).toBe("1000");
    expect(slices.map((s) => s.amount)).toEqual(["334", "333", "333"]);
  });

  it("rejects zero-weight total", () => {
    expect(() => allocate(money("100", USD), ["0", "0"])).toThrow(/weights sum to zero/);
  });
});

describe("settlement rounding-difference (no value leak)", () => {
  it("settled + roundingDifference === exact pre-rounding amount", () => {
    const exact = money("1.005", USD); // not representable at 2dp
    const { settled, roundingDifference } = settleWithResidual(exact);
    expect(settled.amount).toBe("1.01");
    // residual = exact − settled = -0.005
    expect(roundingDifference.amount).toBe("-0.005");
    // conservation
    expect(add(settled, roundingDifference).amount).toBe(exact.amount);
  });
});

describe("codec round-trip + no-float guard", () => {
  it("encode → decode is identity over exact decimals", () => {
    for (const s of ["1234.56", "1000", "1.234", "0.000000001", "-5", "0"]) {
      const m = money(s, USD);
      expect(decodeMoney(encodeMoney(m))).toEqual(m);
    }
  });

  it("wire amount is ALWAYS a string, never a number", () => {
    const wire = encodeMoney(money("1234.56", ZAR));
    expect(typeof wire.amount).toBe("string");
    expect(wire.__money).toBe("v1");
    expect(isMoneyWire(wire)).toBe(true);
  });

  it("decode rejects a numeric amount (float-money violation)", () => {
    const bad = { __money: "v1", amount: 1234.56, currency: "USD" };
    expect(() => decodeMoney(bad)).toThrow(/JSON number/);
  });

  it("findFloatMoneyViolations flags numeric money leaves in a payload", () => {
    const goodPayload = { amount: encodeMoney(money("1", USD)), id: "x" };
    expect(findFloatMoneyViolations(goodPayload)).toEqual([]);

    const badPayload = {
      leg: { __money: "v1", amount: 9.99, currency: "USD" },
      nested: [{ fee: { __money: "v1", amount: 1.5, currency: "ZAR" } }],
    };
    expect(findFloatMoneyViolations(badPayload).sort()).toEqual([
      "leg.amount",
      "nested[0].fee.amount",
    ]);
  });
});

describe("pilot conversion end-to-end (type → codec → projection-read)", () => {
  it("pilot A: simple amount event round-trips", () => {
    const payload = buildFeeCharged("fee-1", "cpty-9", money("123.45", ZAR));
    expect(typeof payload.amount.amount).toBe("string");
    const read = readFeeAmount(payload);
    expect(read).toEqual(money("123.45", ZAR));
  });

  it("pilot B: FX spot event derives + round-trips both legs", () => {
    const payload = buildFxSpotBooked("trade-1", money("100", USD), "18.1234", ZAR);
    const { sold, bought } = readFxSpotLegs(payload);
    expect(sold).toEqual(money("100", USD));
    // bought = 100 * 18.1234 → 1812.34 ZAR (2dp HALF_UP)
    expect(bought.amount).toBe("1812.34");
    expect(bought.currency).toBe(ZAR);
    // both legs serialise as strings
    expect(typeof payload.soldAmount.amount).toBe("string");
    expect(typeof payload.boughtAmount.amount).toBe("string");
    // no float-money violations anywhere in the payload
    expect(findFloatMoneyViolations(payload)).toEqual([]);
  });
});
