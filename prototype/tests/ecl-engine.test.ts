// tests/ecl-engine.test.ts
//
// Unit tests for the IFRS 9 ECL computation engine (model:ecl-engine-ifrs9-v1).
//
// Test cases:
//   TC-1: empty debt book → status "degraded", reason set, ecl 0 (NO silent zero)
//   TC-2: one SAGB (ZAG) bond → status "ok", sovereign-bond bucket, ECL > 0
//   TC-3: per-exposure ECL = round(EAD × pdBps × lgdBps / 1e8)
//   TC-4: two bonds aggregate; EAD = Σ exposure EAD
//   TC-5: flat (bought then sold) position → excluded from exposure base
//   TC-6: non-sovereign ISIN → debt-other bucket (higher PD)
//
// Authority:
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29)
//   - IFRS 9 §B5.5
//
// Author: Rohan (Risk systems engineer, engineering); validated by Nadia
//   (Independent-validation engineer).

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeExposureStage1Ecl,
  computeStage1Ecl,
  readDebtExposures,
} from "../platform/accounting/ecl-engine";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import {
  makeInterbankLoanMatured,
  makeInterbankLoanPlaced,
} from "../platform/event-store/event-types/repo-mmd-ibl";
import { EventStore } from "../platform/event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-MODEL-REGISTRY-SCOPE-CLOSURE-V1"];
const ACTOR = { type: "service" as const, id: "agent:test:ecl" };

function freshStore(): EventStore {
  const dir = mkdtempSync(join(tmpdir(), "ecl-engine-"));
  return new EventStore(join(dir, "event.db"));
}

function bondPayload(overrides: Record<string, unknown> = {}) {
  return {
    tradeId: "TRD-BOND-001",
    bondIsin: "ZAG000030108",
    side: "buy" as const,
    nominalMinor: 10_000_000,
    cleanPricePercent: 100.0,
    accruedInterestMinor: 0,
    dirtyPricePercent: 100.0,
    settlementDate: "2026-05-27",
    portfolio: "banking-book" as const,
    couponRate: 0.085,
    maturityDate: "2031-05-27",
    currency: "ZAR",
    counterpartyLei: "COUNTERPARTY-LEI-001",
    executedAt: "2026-05-22T10:00:00.000Z",
    ...overrides,
  };
}

function bookBond(store: EventStore, overrides: Record<string, unknown> = {}): void {
  store.append(
    makeBondTradeExecuted({
      asOf: "2026-05-22T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: bondPayload(overrides) as never,
    }),
  );
}

describe("ECL engine — computeStage1Ecl", () => {
  it("TC-1: empty debt book → degraded, no silent zero", () => {
    const store = freshStore();
    const result = computeStage1Ecl(store);
    expect(result.status).toBe("degraded");
    expect(result.degradedReason).toBeDefined();
    expect(result.degradedReason).toContain("no in-scope debt exposures");
    expect(result.eclMinor).toBe(0);
    expect(result.exposureCount).toBe(0);
  });

  it("TC-2: one SAGB bond → ok, sovereign-bond bucket, ECL > 0", () => {
    const store = freshStore();
    bookBond(store); // 10m nominal × 100% clean = 10,000,000 EAD
    const result = computeStage1Ecl(store);
    expect(result.status).toBe("ok");
    expect(result.exposureCount).toBe(1);
    const exposure = result.exposures[0];
    expect(exposure).toBeDefined();
    expect(exposure?.riskBucket).toBe("sovereign-bond");
    expect(exposure?.eadMinor).toBe(10_000_000);
    expect(result.eadMinor).toBe(10_000_000);
    expect(result.eclMinor).toBeGreaterThan(0);
  });

  it("TC-3: per-exposure ECL = round(EAD × pd × lgd / 1e8)", () => {
    const exposure = {
      instrumentId: "fi:bond:ZAG000030108",
      tradeId: "TRD-BOND-001",
      riskBucket: "sovereign-bond",
      productFamily: "bond",
      exposureClass: "sovereign" as const,
      eadMinor: 1_000_000_000,
      currency: "ZAR",
    };
    const ecl = computeExposureStage1Ecl(exposure);
    // sovereign-bond: PD 10 bps, LGD 4500 bps
    // ECL = 1_000_000_000 × 10 × 4500 / 1e8 = 450_000
    expect(ecl.pdBps).toBe(10);
    expect(ecl.lgdBps).toBe(4500);
    expect(ecl.eclMinor).toBe(450_000);
    expect(ecl.stage).toBe(1);
  });

  it("TC-4: two bonds aggregate EAD", () => {
    const store = freshStore();
    bookBond(store, { tradeId: "B1", bondIsin: "ZAG000030108" });
    bookBond(store, {
      tradeId: "B2",
      bondIsin: "ZAG000030200",
      nominalMinor: 5_000_000,
    });
    const result = computeStage1Ecl(store);
    expect(result.exposureCount).toBe(2);
    const sumEad = result.exposures.reduce((s, e) => s + e.eadMinor, 0);
    expect(result.eadMinor).toBe(sumEad);
    expect(result.eadMinor).toBe(15_000_000);
  });

  it("TC-5: flat position (buy then sell same nominal, same ISIN) excluded", () => {
    const store = freshStore();
    bookBond(store, { tradeId: "B1", side: "buy" });
    bookBond(store, { tradeId: "B2", side: "sell" });
    const exposures = readDebtExposures(store);
    expect(exposures.length).toBe(0);
    const result = computeStage1Ecl(store);
    expect(result.status).toBe("degraded");
  });

  it("TC-6: non-sovereign ISIN → debt-other bucket (higher PD)", () => {
    const store = freshStore();
    bookBond(store, { bondIsin: "XS0000000001" });
    const result = computeStage1Ecl(store);
    const exposure = result.exposures[0];
    expect(exposure).toBeDefined();
    expect(exposure?.riskBucket).toBe("debt-other");
    expect(exposure?.pdBps).toBe(80);
  });

  it("TC-7: live interbank placement is now included in readDebtExposures", () => {
    const store = freshStore();
    placeInterbankLoan(store, { placementId: "IBL-001", principalZar: 25_000_000 });
    const exposures = readDebtExposures(store);
    expect(exposures.length).toBe(1);
    const ibl = exposures[0];
    expect(ibl?.instrumentId).toBe("fi:ibl:IBL-001");
    expect(ibl?.tradeId).toBe("IBL-001");
    expect(ibl?.riskBucket).toBe("interbank-placement");
    expect(ibl?.productFamily).toBe("interbank");
    expect(ibl?.exposureClass).toBe("bank");
    expect(ibl?.eadMinor).toBe(25_000_000);
    // It also flows through the aggregate ECL run with a positive ECL.
    const result = computeStage1Ecl(store);
    expect(result.status).toBe("ok");
    expect(result.eclMinor).toBeGreaterThan(0);
  });

  it("TC-8: matured interbank placement is derecognised (excluded)", () => {
    const store = freshStore();
    placeInterbankLoan(store, { placementId: "IBL-002", principalZar: 10_000_000 });
    store.append(
      makeInterbankLoanMatured({
        asOf: "2026-05-30T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          placementId: "IBL-002",
          principalZar: 10_000_000,
          interestReceivedZar: 50_000,
        },
      }),
    );
    const exposures = readDebtExposures(store);
    expect(exposures.length).toBe(0);
  });

  it("TC-9: bonds and interbank placements coexist in the exposure base", () => {
    const store = freshStore();
    bookBond(store, { tradeId: "B1", bondIsin: "ZAG000030108" });
    placeInterbankLoan(store, { placementId: "IBL-003", principalZar: 7_000_000 });
    const exposures = readDebtExposures(store);
    expect(exposures.length).toBe(2);
    expect(exposures.some((e) => e.productFamily === "bond")).toBe(true);
    expect(exposures.some((e) => e.productFamily === "interbank")).toBe(true);
  });
});

function placeInterbankLoan(store: EventStore, overrides: Record<string, unknown> = {}): void {
  store.append(
    makeInterbankLoanPlaced({
      asOf: "2026-05-22T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        placementId: "IBL-001",
        counterpartyLei: "BANK-LEI-001",
        principalZar: 25_000_000,
        rateDecimal: 0.0825,
        startDate: "2026-05-22",
        maturityDate: "2026-06-22",
        placementType: "fixed-term",
        bookId: "treasury",
        instrumentRef: "IBL-FT-ZAR-001",
        ...overrides,
      } as never,
    }),
  );
}
