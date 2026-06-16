// platform/accounting/gl-posting-engine-v2-mm.test.ts
//
// Unit tests for the Phase 3b V2 money-market GL posting engine.
// Proves balanced double-entry + correct account/currency resolution off the
// V2-parallel lifecycle events.
//
// Authority: D-V1-REMOVAL-PHASE-3B.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { tenantIdSchema } from "../../v2-core/control-plane/tenant";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import type { GlPostingEmittedPayload } from "../event-store/event-types/fx-accounting";
import {
  makeDepositTakenV2,
  makeFundingLineDrawnV2,
  makeInterbankLoanPlacedV2,
  makeRepoTradeOpenedV2,
} from "../event-store/event-types/repo-mmd-ibl-v2";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { runGlV2MoneyMarketEngine } from "./gl-posting-engine-v2-mm";

const ACTOR: Actor = { type: "system", id: "atlas:gl-v2-mm-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = tenantIdSchema.parse("tenant:za-bank");
const CITES = ["D-V1-REMOVAL-PHASE-3B"];

function moneyWire(amount: string, currency: string) {
  return encodeMoney(money(amount, currency as "ZAR"));
}

/** Collect emitted GlPostingEmitted legs from the store. */
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

describe("V2 money-market GL engine — DepositTakenV2", () => {
  test("emits balanced Dr Cash / Cr Deposit Liability in the deposit currency", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeDepositTakenV2({
        asOf: "2026-06-16T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          depositId: "DEP-001",
          counterpartyLei: "LEI-XYZ",
          principal: moneyWire("10000000.00", "ZAR"),
          interestRateDecimal: 0.0795,
          maturityDate: "2026-12-16",
          depositCategory: "wholesale-non-operational",
          bookId: "TREASURY",
          instrumentRef: "MMD-ZAR-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );

    const result = runGlV2MoneyMarketEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    expect(result.processed.deposit).toBe(1);
    const legs = postings(store);
    expect(legs).toHaveLength(2);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit); // balanced
    const debitLeg = legs.find((l) => l.creditDebit === "debit");
    const creditLeg = legs.find((l) => l.creditDebit === "credit");
    expect(debitLeg?.accountCode).toBe("ACC-1100-001"); // cash
    expect(creditLeg?.accountCode).toBe("ACC-6100-004"); // wholesale-non-operational liability
    expect(debitLeg?.amount.currency).toBe("ZAR");
    expect(debitLeg?.postingRuleId).toBe("PR-MMD-001-V2");
    expect(debitLeg?.tenantId).toBe(TENANT);
  });

  test("foreign-currency deposit posts in its OWN currency (no ZAR coercion)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeDepositTakenV2({
        asOf: "2026-06-16T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          depositId: "DEP-USD",
          counterpartyLei: "LEI-USD",
          principal: moneyWire("500000.00", "USD"),
          interestRateDecimal: 0.04,
          maturityDate: "2026-09-16",
          depositCategory: "retail-stable",
          bookId: "TREASURY",
          instrumentRef: "MMD-USD-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    runGlV2MoneyMarketEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    const legs = postings(store);
    expect(legs.every((l) => l.amount.currency === "USD")).toBe(true);
    expect(legs.find((l) => l.creditDebit === "credit")?.accountCode).toBe("ACC-6100-001");
  });
});

describe("V2 money-market GL engine — funding / repo / IBL recognition", () => {
  test("FundingLineDrawnV2 → Dr Cash / Cr Funding Liability (balanced)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeFundingLineDrawnV2({
        asOf: "2026-06-16T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          fundingLineId: "FL-001",
          drawnAmount: moneyWire("50000000.00", "ZAR"),
          maturityDate: "2026-07-16",
          rateDecimal: 0.08,
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    const result = runGlV2MoneyMarketEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    expect(result.processed.funding).toBe(1);
    const { debit, credit } = sumByCreditDebit(postings(store));
    expect(debit).toBe(credit);
    expect(debit).toBe(50000000);
  });

  test("RepoTradeOpenedV2 → secured-borrowing recognition (balanced, IAS 39 §27)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeRepoTradeOpenedV2({
        asOf: "2026-06-16T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          tradeId: "REPO-001",
          counterpartyLei: "LEI-REPO",
          startLegSettlementDate: "2026-06-16",
          endLegSettlementDate: "2026-06-23",
          startLegCash: moneyWire("20000000.00", "ZAR"),
          repurchasePrice: moneyWire("20031780.82", "ZAR"),
          repoRateDecimal: 0.0825,
          collateralIsin: "ZAG000000001",
          collateralFaceValue: moneyWire("21000000.00", "ZAR"),
          collateralHaircutPct: 2.0,
          bookId: "TREASURY",
          traderRef: "trader-1",
          instrumentRef: "REPO-ZAR-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    const result = runGlV2MoneyMarketEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    expect(result.processed.repo).toBe(1);
    const legs = postings(store);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit);
    expect(legs.find((l) => l.creditDebit === "credit")?.accountCode).toBe("ACC-5100-002");
  });

  test("InterbankLoanPlacedV2 (fixed-term asset) → Dr Due-from-Banks / Cr Cash", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeInterbankLoanPlacedV2({
        asOf: "2026-06-16T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          placementId: "IBL-001",
          counterpartyLei: "LEI-BANK",
          principal: moneyWire("30000000.00", "ZAR"),
          rateDecimal: 0.0825,
          startDate: "2026-06-16",
          maturityDate: "2026-07-16",
          placementType: "fixed-term",
          bookId: "TREASURY",
          instrumentRef: "IBL-FT-ZAR-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    const result = runGlV2MoneyMarketEngine({ eventStore: store, actor: ACTOR, entity: ENTITY });
    expect(result.processed.ibl).toBe(1);
    const legs = postings(store);
    const { debit, credit } = sumByCreditDebit(legs);
    expect(debit).toBe(credit);
    expect(legs.find((l) => l.creditDebit === "debit")?.accountCode).toBe("ACC-7100-002");
    expect(legs.find((l) => l.creditDebit === "credit")?.accountCode).toBe("ACC-1100-001");
  });
});
