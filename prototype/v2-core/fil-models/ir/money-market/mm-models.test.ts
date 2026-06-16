// v2-core/fil-models/ir/money-market/mm-models.test.ts
//
// Unit tests for the Phase 3b money-market FIL models: amortised-cost
// Valuable + daily-accrual Performable for unsecured / deposit / repo.
//
// Authority: D-V1-REMOVAL-PHASE-3B.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Instant } from "../../../fil-core/primitives.ts";
import type { MarketDataSlice } from "../../../fil-facets/facets.ts";
import { mmDepositPerformable, mmDepositValuable } from "./deposit/mm-deposit-model.ts";
import { amortisedCost, dailyCarry, theta } from "./performance/mm-methodology.ts";
import { mmRepoPerformable, mmRepoValuable } from "./repo/mm-repo-model.ts";
import type {
  MoneyMarketDepositPosition,
  MoneyMarketRepoPosition,
  MoneyMarketUnsecuredPosition,
} from "./shared/mm-positions.ts";
import { mmUnsecuredPerformable, mmUnsecuredValuable } from "./unsecured/mm-unsecured-model.ts";

const ASOF = "2026-06-16T00:00:00.000Z" as Instant;
const NO_MARKS: MarketDataSlice = { asOf: ASOF, observables: {} };

// IBL placement: bank lends USD 1,000,000 at 5% p.a., 30 days accrued.
const IBL_ASSET: MoneyMarketUnsecuredPosition = {
  kind: "money-market-unsecured",
  currency: "USD",
  principal: "1000000.00",
  accrued: "4109.59", // ~ 1,000,000 × 0.05 × 30/365
  rateDecimal: 0.05,
  direction: "asset",
  maturityDate: "2026-09-16",
  reporting: "USD",
};

// Funding line drawdown: bank borrows ZAR 50,000,000 at 8% p.a.
const FUNDING_LIABILITY: MoneyMarketUnsecuredPosition = {
  kind: "money-market-unsecured",
  currency: "ZAR",
  principal: "50000000.00",
  accrued: "0.00",
  rateDecimal: 0.08,
  direction: "liability",
  maturityDate: "2026-07-16",
  reporting: "ZAR",
};

const DEPOSIT: MoneyMarketDepositPosition = {
  kind: "money-market-deposit",
  currency: "ZAR",
  principal: "10000000.00",
  accrued: "1000.00",
  rateDecimal: 0.0795,
  direction: "liability",
  maturityDate: "2026-12-16",
  reporting: "ZAR",
};

const REVERSE_REPO: MoneyMarketRepoPosition = {
  kind: "money-market-repo",
  currency: "ZAR",
  principal: "20000000.00",
  accrued: "5000.00",
  rateDecimal: 0.0825,
  direction: "asset",
  endLegSettlementDate: "2026-06-23",
  reporting: "ZAR",
};

describe("money-market amortised-cost methodology", () => {
  test("asset carrying amount = +(principal + accrued)", () => {
    const v = amortisedCost({
      principal: "1000000.00",
      accrued: "4109.59",
      direction: "asset",
      currency: "USD",
    });
    expect(v.currency).toBe("USD");
    expect(v.amount).toBe("1004109.59");
  });

  test("liability carrying amount = −(principal + accrued)", () => {
    const v = amortisedCost({
      principal: "10000000.00",
      accrued: "1000.00",
      direction: "liability",
      currency: "ZAR",
    });
    expect(v.amount).toBe("-10001000");
  });

  test("daily carry = principal × rate ÷ 365, signed by direction", () => {
    // asset: +1,000,000 × 0.05 / 365 = +136.99 (HALF_UP 2dp)
    const asset = dailyCarry({
      principal: "1000000.00",
      rateDecimal: 0.05,
      direction: "asset",
      currency: "USD",
    });
    expect(asset.amount).toBe("136.99");
    // liability: −50,000,000 × 0.08 / 365 = −10958.90
    const liab = dailyCarry({
      principal: "50000000.00",
      rateDecimal: 0.08,
      direction: "liability",
      currency: "ZAR",
    });
    expect(liab.amount).toBe("-10958.9");
  });

  test("theta = −carry", () => {
    const t = theta({
      principal: "1000000.00",
      rateDecimal: 0.05,
      direction: "asset",
      currency: "USD",
    });
    expect(t.amount).toBe("-136.99");
  });
});

describe("unsecured model (IBL asset / funding liability)", () => {
  test("IBL asset values at amortised cost in its OWN currency (USD, not ZAR)", () => {
    const rec = mmUnsecuredValuable(IBL_ASSET).value(NO_MARKS, ASOF);
    expect(rec.value.currency).toBe("USD");
    expect(rec.value.amount).toBe("1004109.59");
    expect(mmUnsecuredValuable(IBL_ASSET).valuationMethod()).toBe("amortised");
  });

  test("funding liability values negative (the bank owes)", () => {
    const rec = mmUnsecuredValuable(FUNDING_LIABILITY).value(NO_MARKS, ASOF);
    expect(rec.value.amount).toBe("-50000000");
  });

  test("amortised cost requires NO market observables", () => {
    expect(mmUnsecuredValuable(IBL_ASSET).requiredObservables()).toHaveLength(0);
  });

  test("performable: unrealised P&L is zero (amortised cost), carry is interest income", () => {
    const perf = mmUnsecuredPerformable(IBL_ASSET);
    const rec = perf.unrealisedPnl(NO_MARKS, ASOF, { currency: "USD", amount: "0" });
    expect(rec.unrealisedPnl.amount).toBe("0");
    expect(rec.carry.amount).toBe("136.99");
    expect(rec.theta.amount).toBe("-136.99");
  });
});

describe("deposit model (liability)", () => {
  test("deposit values negative amortised cost", () => {
    const rec = mmDepositValuable(DEPOSIT).value(NO_MARKS, ASOF);
    expect(rec.value.amount).toBe("-10001000");
  });

  test("deposit carry is interest expense (negative)", () => {
    const rec = mmDepositPerformable(DEPOSIT).unrealisedPnl(NO_MARKS, ASOF, {
      currency: "ZAR",
      amount: "0",
    });
    // −10,000,000 × 0.0795 / 365 = −2178.08
    expect(rec.carry.amount).toBe("-2178.08");
    expect(rec.unrealisedPnl.amount).toBe("0");
  });
});

describe("repo model (asset/liability by direction)", () => {
  test("reverse repo (asset) values positive amortised cost", () => {
    const rec = mmRepoValuable(REVERSE_REPO).value(NO_MARKS, ASOF);
    expect(rec.value.amount).toBe("20005000");
  });

  test("repo carry signed by direction (asset → positive income)", () => {
    const rec = mmRepoPerformable(REVERSE_REPO).unrealisedPnl(NO_MARKS, ASOF, {
      currency: "ZAR",
      amount: "0",
    });
    // +20,000,000 × 0.0825 / 365 = +4520.55
    expect(rec.carry.amount).toBe("4520.55");
  });
});

describe("fail-closed reporting currency (WS-MULTI-BASE-CURRENCY)", () => {
  test("an empty reporting currency throws (no silent ZAR default)", () => {
    const broken: MoneyMarketUnsecuredPosition = { ...IBL_ASSET, reporting: "" };
    expect(() => mmUnsecuredValuable(broken)).toThrow(/reporting currency is unresolved/);
  });
});
