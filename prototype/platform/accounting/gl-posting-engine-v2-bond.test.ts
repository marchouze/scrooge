// platform/accounting/gl-posting-engine-v2-bond.test.ts
//
// Unit tests for the Phase 3c V2 bond GL posting engine. Proves balanced double-
// entry, decimal-exact dirty-price booking, portfolio account selection, FVTPL
// revaluation gain/loss direction, derecognition, and currency-agnosticism off
// the V2-parallel bond lifecycle events.
//
// Authority: D-V1-REMOVAL-PHASE-3C.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { tenantIdSchema } from "../../v2-core/control-plane/tenant";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import {
  makeBondInterestAccruedV2,
  makeBondMaturedV2,
  makeBondPositionRevaluedV2,
  makeBondSoldV2,
  makeBondTradeExecutedV2,
} from "../event-store/event-types/bond-accounting-v2";
import type { GlPostingEmittedPayload } from "../event-store/event-types/fx-accounting";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { runGlV2BondEngine } from "./gl-posting-engine-v2-bond";

const ACTOR: Actor = { type: "system", id: "atlas:gl-v2-bond-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = tenantIdSchema.parse("tenant:za-bank");
const CITES = ["D-V1-REMOVAL-PHASE-3C"];
const ASOF = "2026-06-16T00:00:00.000Z";

function moneyWire(amount: string, currency: string) {
  return encodeMoney(money(amount, currency as Currency));
}

function postings(store: EventStore): GlPostingEmittedPayload[] {
  return [...store.replay({ type: "GlPostingEmitted" })].map(
    (e) => e.payload as GlPostingEmittedPayload,
  );
}

function sumByCreditDebit(legs: GlPostingEmittedPayload[]): { debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  for (const l of legs) {
    const v = Number(l.amount.amount);
    if (l.creditDebit === "debit") debit += v;
    else credit += v;
  }
  return { debit, credit };
}

describe("V2 bond GL engine — BondTradeExecutedV2 (initial recognition)", () => {
  test("buy banking-book: Dr Bond Asset Banking / Cr Nostro at dirty price (decimal-exact)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondTradeExecutedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-001",
          bondIsin: "ZAG000149037",
          side: "buy",
          nominal: moneyWire("1000000.00", "ZAR"),
          cleanPricePercent: 97.5,
          accruedInterest: moneyWire("5000.00", "ZAR"),
          dirtyPricePercent: 98.0,
          settlementDate: "2026-06-19",
          portfolio: "banking-book",
          couponRate: 0.085,
          maturityDate: "2030-06-16",
          counterpartyLei: "LEI-BOND",
          executedAt: ASOF,
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    const result = runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    expect(result.processed).toBe(1);
    const legs = postings(store);
    expect(legs).toHaveLength(2);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit);
    // dirty = 1,000,000 × 98.0 / 100 = 980,000.00
    expect(debit).toBe(980000);
    const debitLeg = legs.find((l) => l.creditDebit === "debit");
    const creditLeg = legs.find((l) => l.creditDebit === "credit");
    expect(debitLeg?.accountCode).toBe("ACC-3100-001"); // banking-book asset
    expect(creditLeg?.accountCode).toBe("ACC-1200-001"); // nostro
    expect(debitLeg?.amount.amount).toBe("980000");
    expect(debitLeg?.postingRuleId).toBe("PR-BOND-001-V2");
    expect(debitLeg?.tenantId).toBe(TENANT);
  });

  test("buy trading-book books to the FVTPL trading asset account", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondTradeExecutedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-TB",
          bondIsin: "ZAG000149037",
          side: "buy",
          nominal: moneyWire("1000000.00", "ZAR"),
          cleanPricePercent: 99.0,
          accruedInterest: moneyWire("0.00", "ZAR"),
          dirtyPricePercent: 99.0,
          settlementDate: "2026-06-19",
          portfolio: "trading-book",
          couponRate: 0.085,
          maturityDate: "2030-06-16",
          counterpartyLei: "LEI-BOND",
          executedAt: ASOF,
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs.find((l) => l.creditDebit === "debit")?.accountCode).toBe("ACC-3100-002");
  });

  test("sell flips the legs (Dr Nostro / Cr Bond Asset); foreign currency stays own currency", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondTradeExecutedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-USD",
          bondIsin: "US912828YK00",
          side: "sell",
          nominal: moneyWire("1000000.00", "USD"),
          cleanPricePercent: 100.0,
          accruedInterest: moneyWire("0.00", "USD"),
          dirtyPricePercent: 100.0,
          settlementDate: "2026-06-19",
          portfolio: "trading-book",
          couponRate: 0.04,
          maturityDate: "2030-06-16",
          counterpartyLei: "LEI-USD",
          executedAt: ASOF,
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs.every((l) => l.amount.currency === "USD")).toBe(true);
    expect(legs.find((l) => l.creditDebit === "debit")?.accountCode).toBe("ACC-1200-001"); // nostro
    expect(legs.find((l) => l.creditDebit === "credit")?.accountCode).toBe("ACC-3100-002");
  });
});

describe("V2 bond GL engine — interest accrual + FVTPL revaluation", () => {
  test("BondInterestAccruedV2 → Dr Accrued Interest Receivable / Cr Interest Income (EIR)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondInterestAccruedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-001",
          bondIsin: "ZAG000149037",
          accrualDate: "2026-06-16",
          accruedInterest: moneyWire("2328.77", "ZAR"),
          eirRate: 0.0873,
          openingCarryingAmount: moneyWire("980000.00", "ZAR"),
          closingCarryingAmount: moneyWire("982328.77", "ZAR"),
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs).toHaveLength(2);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit);
    expect(legs.find((l) => l.creditDebit === "debit")?.accountCode).toBe("ACC-3100-003");
    expect(legs.find((l) => l.creditDebit === "credit")?.accountCode).toBe("ACC-4101-001");
  });

  test("zero-amount accrual emits no posting (V1 non-zero-delta skip)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondInterestAccruedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-001",
          bondIsin: "ZAG000149037",
          accrualDate: "2026-06-16",
          accruedInterest: moneyWire("0.00", "ZAR"),
          eirRate: 0.0873,
          openingCarryingAmount: moneyWire("980000.00", "ZAR"),
          closingCarryingAmount: moneyWire("980000.00", "ZAR"),
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    const result = runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    expect(result.processed).toBe(1);
    expect(result.emitted).toBe(0);
    expect(postings(store)).toHaveLength(0);
  });

  test("FVTPL gain → Dr Asset Trading / Cr Unrealised P&L; loss flips the legs", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondPositionRevaluedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-TB",
          bondIsin: "ZAG000149037",
          revalDate: "2026-06-16",
          bookCleanPricePercent: 99.0,
          currentCleanPricePercent: 99.5,
          unrealisedPnl: moneyWire("5000.00", "ZAR"),
          modifiedDuration: 3.42,
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    // A loss event for the same book.
    store.append(
      makeBondPositionRevaluedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-TB",
          bondIsin: "ZAG000149037",
          revalDate: "2026-06-17",
          bookCleanPricePercent: 99.5,
          currentCleanPricePercent: 99.0,
          unrealisedPnl: moneyWire("-5000.00", "ZAR"),
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs).toHaveLength(4);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit);
    // gain leg: debit asset trading, credit unrealised P&L.
    const gain = legs.filter((l) => l.postingRuleId === "PR-BOND-002-V2").slice(0, 2);
    expect(gain.find((l) => l.creditDebit === "debit")?.accountCode).toBe("ACC-3100-002");
    expect(gain.find((l) => l.creditDebit === "credit")?.accountCode).toBe("ACC-3100-005");
  });
});

describe("V2 bond GL engine — derecognition (maturity + sale)", () => {
  test("BondMaturedV2 → Dr Nostro (principal + coupon) / Cr Asset Banking + Cr Accrued Interest", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondMaturedV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-001",
          bondIsin: "ZAG000149037",
          maturityDate: "2030-06-16",
          nominalRepaid: moneyWire("1000000.00", "ZAR"),
          finalCoupon: moneyWire("42500.00", "ZAR"),
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs).toHaveLength(4); // principal pair + coupon pair
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit);
    expect(debit).toBe(1042500);
    const accounts = new Set(legs.map((l) => l.accountCode));
    expect(accounts.has("ACC-3100-001")).toBe(true); // banking asset derecognised
    expect(accounts.has("ACC-3100-003")).toBe(true); // accrued interest settled
  });

  test("BondSoldV2 at a gain → Dr Nostro, Cr Asset Trading, Cr Realised P&L (balanced)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondSoldV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-TB",
          bondIsin: "ZAG000149037",
          side: "sell",
          saleProceeds: moneyWire("995000.00", "ZAR"),
          carryingAmountAtSale: moneyWire("980000.00", "ZAR"),
          realisedPnl: moneyWire("15000.00", "ZAR"),
          settlementDate: "2026-06-19",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs).toHaveLength(3);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit); // 995000 = 980000 + 15000
    const realised = legs.find((l) => l.accountCode === "ACC-3100-006");
    expect(realised?.creditDebit).toBe("credit"); // gain
  });

  test("BondSoldV2 at a loss puts realised P&L on the debit side", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeBondSoldV2({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "BOND-TB",
          bondIsin: "ZAG000149037",
          side: "sell",
          saleProceeds: moneyWire("970000.00", "ZAR"),
          carryingAmountAtSale: moneyWire("980000.00", "ZAR"),
          realisedPnl: moneyWire("-10000.00", "ZAR"),
          settlementDate: "2026-06-19",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2BondEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit); // 970000 + 10000 = 980000
    const realised = legs.find((l) => l.accountCode === "ACC-3100-006");
    expect(realised?.creditDebit).toBe("debit"); // loss
  });
});
