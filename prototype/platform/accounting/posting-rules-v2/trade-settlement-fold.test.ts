// platform/accounting/posting-rules-v2/trade-settlement-fold.test.ts
//
// BYTE-PROOF for D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 1.
//
// Proves the CEO model: an FX spot vanilla settlement decomposes into N (=2)
// UNIFORM single-asset `TradeSettlementExecuted` movements whose accumulated GL
// legs net BYTE-IDENTICAL — per `(accountCode, currency)` — to the single
// `FilFxSettlementConfirmed` (two-leg) path. Including the realised-P&L case
// (settled ≠ booked), which is exactly the (amount, cost) pairing the uniform
// movement must NOT drop.
//
// REFERENCE (golden): `postFxSettlementLegs` (the pure two-leg spot rule in
// `v2-core/posting-rules/fx-settlement.ts`) — the SAME function the live FX fold
// dispatches `FilFxSettlementConfirmed{legRole:"spot"}` to. The decomposition
// reuses that function's own per-movement primitive, so equivalence is structural.
//
// Also proves the holding-at-cost materialisation recognises each decomposed cash
// leg at its cost basis with the trade back-ref (Principle 1 / Principle 2).
//
// Authority: D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (CEO-approved 2026-06-23);
//   D-CASH-ASSET-CLASS-V1; D-ACCT-FX-IFRS-POSTING-COMPLETENESS.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import {
  type FilFxSettlementConfirmedPayload,
  filFxSettlementConfirmedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import { buildSettledHoldingPayload } from "../../../v2-core/fil-instances/holding-materialisation";
import { tradeSettlementExecutedPayloadSchema } from "../../../v2-core/fil-instances/trade-settlement";
import type { FxPostingLeg } from "../../../v2-core/posting-rules/fx";
import { postFxSettlementLegs } from "../../../v2-core/posting-rules/fx-settlement";
import {
  decomposeFxSettlementToTradeSettlements,
  postTradeSettlementListLegs,
} from "../../../v2-core/posting-rules/trade-settlement";
import { amountToMinorUnits } from "../../core/decimal-money";
import { legAmountMoney } from "../../core/money-codec";

const TENANT = "tenant:za-bank";
const ENTITY = "LE-ZA-HOZ-BANK";
const ORIG = { eventType: "FxTradeExecuted", eventId: "evt-fx-001" } as const;

function instanceUrn(id: string): string {
  return `fil:inst:${ENTITY}:${id}`;
}

/** Build the FX spot settlement payload for a USD-bought / ZAR-sold trade. */
function fxSpotSettlement(terms: {
  boughtBooked: string;
  boughtSettled: string;
  soldBooked: string;
  soldSettled: string;
}): FilFxSettlementConfirmedPayload {
  return filFxSettlementConfirmedPayloadSchema.parse({
    kind: "FilFxSettlementConfirmed",
    instance: instanceUrn("FX-SPOT-1"),
    type: "fil:type:fx:spot:otc-vanilla@1.0",
    tenant: TENANT,
    asOf: "2026-06-10T10:00:00.000Z",
    originatingEvent: ORIG,
    legRole: "spot",
    boughtBooked: { currency: "USD", amount: terms.boughtBooked },
    boughtSettled: { currency: "USD", amount: terms.boughtSettled },
    soldBooked: { currency: "ZAR", amount: terms.soldBooked },
    soldSettled: { currency: "ZAR", amount: terms.soldSettled },
  });
}

/**
 * The golden reference legs: the pure two-leg spot settlement rule applied to the
 * settlement payload's amounts (this IS the function the live fold dispatches the
 * spot leg to).
 */
function referenceLegs(s: FilFxSettlementConfirmedPayload): FxPostingLeg[] {
  return postFxSettlementLegs({
    instanceId: s.instance,
    tenantId: s.tenant,
    postingDate: s.asOf.substring(0, 10),
    boughtCurrency: s.boughtBooked.currency,
    boughtBookedAmount: s.boughtBooked.amount,
    boughtSettledAmount: s.boughtSettled.amount,
    soldCurrency: s.soldBooked.currency,
    soldBookedAmount: s.soldBooked.amount,
    soldSettledAmount: s.soldSettled.amount,
  });
}

/** Accumulate legs into per-(accountCode|currency) signed minor balances. */
function netByKey(legs: readonly FxPostingLeg[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const leg of legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const minor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    map.set(key, (map.get(key) ?? 0) + (leg.creditDebit === "debit" ? minor : -minor));
  }
  for (const [k, v] of [...map.entries()]) if (v === 0) map.delete(k);
  return map;
}

function expectByteIdenticalNet(a: readonly FxPostingLeg[], b: readonly FxPostingLeg[]): void {
  const an = netByKey(a);
  const bn = netByKey(b);
  expect([...an.keys()].sort()).toEqual([...bn.keys()].sort());
  for (const k of an.keys()) {
    expect(`${k}=${an.get(k)}`).toBe(`${k}=${bn.get(k) ?? 0}`);
  }
}

describe("D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL Slice 1 — decomposition byte-equivalence", () => {
  test("FX spot decomposes into exactly 2 single-asset settlements (received + paid)", () => {
    const s = fxSpotSettlement({
      boughtBooked: "1000000",
      boughtSettled: "1000000",
      soldBooked: "18500000",
      soldSettled: "18500000",
    });
    const settlements = decomposeFxSettlementToTradeSettlements({ settlement: s });
    expect(settlements.length).toBe(2);
    // Received leg: +movement (long cash), bought ccy.
    const received = settlements[0];
    expect(received?.movement.currency).toBe("USD");
    expect(received?.movement.amount.startsWith("-")).toBe(false);
    expect(received?.holdingAssetClass).toBe("cash");
    expect(received?.tradeInstance).toBe(s.instance);
    // Paid leg: −movement (short cash), sold ccy.
    const paid = settlements[1];
    expect(paid?.movement.currency).toBe("ZAR");
    expect(paid?.movement.amount.startsWith("-")).toBe(true);
    // Both reparse cleanly (schema-validated payloads).
    for (const st of settlements) {
      expect(() => tradeSettlementExecutedPayloadSchema.parse(st)).not.toThrow();
    }
  });

  test("no realised P&L (settled == booked): N settlements net == single FX settlement", () => {
    const s = fxSpotSettlement({
      boughtBooked: "1000000",
      boughtSettled: "1000000",
      soldBooked: "18500000",
      soldSettled: "18500000",
    });
    const golden = referenceLegs(s);
    const decomposed = postTradeSettlementListLegs(
      decomposeFxSettlementToTradeSettlements({ settlement: s }),
    );
    expectByteIdenticalNet(golden, decomposed);
  });

  test("realised P&L (settled != booked on BOTH legs): N settlements net == single FX settlement", () => {
    // Bought USD: booked 1,000,000 / settled 1,010,000 (10k USD gain).
    // Sold  ZAR: booked 18,500,000 / settled 18,400,000 (100k ZAR gain).
    const s = fxSpotSettlement({
      boughtBooked: "1000000",
      boughtSettled: "1010000",
      soldBooked: "18500000",
      soldSettled: "18400000",
    });
    const golden = referenceLegs(s);
    const decomposed = postTradeSettlementListLegs(
      decomposeFxSettlementToTradeSettlements({ settlement: s }),
    );
    // Non-vacuity: the golden actually carries a realised-P&L (ACC-2100-006) leg.
    expect(golden.some((l) => l.accountCode === "ACC-2100-006")).toBe(true);
    expectByteIdenticalNet(golden, decomposed);
  });

  test("realised loss case (settled < booked): N settlements net == single FX settlement", () => {
    // Bought USD: booked 1,000,000 / settled 990,000 (10k USD loss).
    // Sold  ZAR: booked 18,500,000 / settled 18,600,000 (100k ZAR loss).
    const s = fxSpotSettlement({
      boughtBooked: "1000000",
      boughtSettled: "990000",
      soldBooked: "18500000",
      soldSettled: "18600000",
    });
    const golden = referenceLegs(s);
    const decomposed = postTradeSettlementListLegs(
      decomposeFxSettlementToTradeSettlements({ settlement: s }),
    );
    expect(golden.some((l) => l.accountCode === "ACC-2100-006")).toBe(true);
    expectByteIdenticalNet(golden, decomposed);
  });
});

describe("D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL Slice 1 — holding-at-cost materialisation", () => {
  test("each decomposed cash leg recognises a holding at cost with the trade back-ref", () => {
    const s = fxSpotSettlement({
      boughtBooked: "1000000",
      boughtSettled: "1010000",
      soldBooked: "18500000",
      soldSettled: "18400000",
    });
    const [received, paid] = decomposeFxSettlementToTradeSettlements({ settlement: s });
    const ctx = {
      counterpartyId: "urn:party:legal-entity:standard-bank-za",
      nettingSetId: "NS-test-ZAR",
      reporting: "ZAR",
    };
    if (received === undefined || paid === undefined) throw new Error("decomposition incomplete");

    const recvHolding = buildSettledHoldingPayload(received, ctx);
    // RECEIVE → long cash, recognised at cost (settled magnitude), USD.
    expect(recvHolding.payload.economicTerms.assetClass).toBe("cash");
    expect(recvHolding.payload.economicTerms.direction).toBe("long");
    expect(recvHolding.payload.economicTerms.notional).toEqual({
      currency: "USD",
      amount: "1010000",
    });
    expect(recvHolding.payload.economicTerms.originatingInstrument).toBe(s.instance);

    const paidHolding = buildSettledHoldingPayload(paid, ctx);
    // PAY → short cash, recognised at cost (settled magnitude, positive), ZAR.
    expect(paidHolding.payload.economicTerms.direction).toBe("short");
    expect(paidHolding.payload.economicTerms.notional).toEqual({
      currency: "ZAR",
      amount: "18400000",
    });
    expect(paidHolding.payload.economicTerms.originatingInstrument).toBe(s.instance);
  });
});
