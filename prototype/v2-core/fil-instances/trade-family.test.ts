// v2-core/fil-instances/trade-family.test.ts
//
// TRADE-FAMILY grouping read-model test (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL,
// Slice 2). Proves `foldTradeFamilies` groups a trade's Create + its N
// `TradeSettlementExecuted` settlements + its materialised holdings under the
// single trade (grouping) id — the forward index the cash-cascade back-ref scan
// lacked.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { type TradeFamilyInputPayload, foldTradeFamilies, tradeFamily } from "./trade-family";

const TRADE = "fil:inst:LE-ZA-HOZ-BANK:FX-SPOT-1";
const CASH_RECEIVED = "fil:inst:LE-ZA-HOZ-BANK:FX-SPOT-1-cash-received";
const CASH_PAID = "fil:inst:LE-ZA-HOZ-BANK:FX-SPOT-1-cash-paid";
const OTHER_TRADE = "fil:inst:LE-ZA-HOZ-BANK:FX-SPOT-2";

function tradeCreate(instance: string): TradeFamilyInputPayload {
  return {
    kind: "FilInstrumentCreated",
    instance,
    type: "fil:type:fx:spot:otc-vanilla@1.0",
  };
}

function holdingCreate(instance: string, originatingTrade: string): TradeFamilyInputPayload {
  return {
    kind: "FilInstrumentCreated",
    instance,
    type: "fil:type:cash:balance:vanilla@1.0",
    economicTerms: { originatingInstrument: originatingTrade, assetClass: "cash" },
  };
}

function settlement(tradeInstance: string, holdingInstance: string): TradeFamilyInputPayload {
  return { kind: "TradeSettlementExecuted", tradeInstance, holdingInstance };
}

describe("D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL Slice 2 — foldTradeFamilies", () => {
  test("groups a trade's Create + its 2 settlements + its 2 holdings under one trade id", () => {
    const register = foldTradeFamilies([
      tradeCreate(TRADE),
      settlement(TRADE, CASH_RECEIVED),
      settlement(TRADE, CASH_PAID),
      holdingCreate(CASH_RECEIVED, TRADE),
      holdingCreate(CASH_PAID, TRADE),
    ]);

    const fam = tradeFamily(register, TRADE);
    expect(fam).toBeDefined();
    expect(fam?.trade).toBe(TRADE);
    expect(fam?.created).toBe(TRADE);
    expect([...(fam?.settlements ?? [])].sort()).toEqual([CASH_PAID, CASH_RECEIVED].sort());
    expect([...(fam?.holdings ?? [])].sort()).toEqual([CASH_PAID, CASH_RECEIVED].sort());
  });

  test("does not bleed across trades — a second trade's holdings stay in its own family", () => {
    const register = foldTradeFamilies([
      tradeCreate(TRADE),
      tradeCreate(OTHER_TRADE),
      settlement(TRADE, CASH_RECEIVED),
      holdingCreate(CASH_RECEIVED, TRADE),
    ]);
    expect(tradeFamily(register, TRADE)?.holdings).toEqual([CASH_RECEIVED]);
    expect(tradeFamily(register, OTHER_TRADE)?.holdings).toEqual([]);
    expect(tradeFamily(register, OTHER_TRADE)?.settlements).toEqual([]);
  });

  test("is order-independent + de-duplicates a repeated settlement/holding URN", () => {
    const a = foldTradeFamilies([
      holdingCreate(CASH_RECEIVED, TRADE),
      settlement(TRADE, CASH_RECEIVED),
      tradeCreate(TRADE),
    ]);
    const b = foldTradeFamilies([
      tradeCreate(TRADE),
      settlement(TRADE, CASH_RECEIVED),
      settlement(TRADE, CASH_RECEIVED), // duplicate
      holdingCreate(CASH_RECEIVED, TRADE),
      holdingCreate(CASH_RECEIVED, TRADE), // duplicate
    ]);
    expect(tradeFamily(a, TRADE)?.holdings).toEqual([CASH_RECEIVED]);
    expect(tradeFamily(a, TRADE)?.settlements).toEqual([CASH_RECEIVED]);
    expect(tradeFamily(b, TRADE)?.holdings).toEqual([CASH_RECEIVED]);
    expect(tradeFamily(b, TRADE)?.settlements).toEqual([CASH_RECEIVED]);
  });

  test("a family folded from a partial view (settlements only, no Create) has no `created`", () => {
    const register = foldTradeFamilies([settlement(TRADE, CASH_RECEIVED)]);
    const fam = tradeFamily(register, TRADE);
    expect(fam?.created).toBeUndefined();
    expect(fam?.settlements).toEqual([CASH_RECEIVED]);
  });
});
