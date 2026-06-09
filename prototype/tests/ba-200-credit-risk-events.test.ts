// tests/ba-200-credit-risk-events.test.ts
//
// WS-BA-RETURNS-FOLLOWON — exit-criterion tests for the events-first BA 200
// (Credit-Risk Loans-and-Advances) generator
// `generateBa200CreditRiskFromEvents`.
//
// Asserts:
//   1. Live IBL + bond exposures WITH an Ifrs9StageAssigned (stage 2/3 + ECL)
//      → BA 200 reflects that stage + ECL (the staging event is the source).
//   2. Exposures WITHOUT a staging event → engine Stage-1 fallback (ECL ≈ 0
//      relative to gross; positive small Stage-1 ECL, NOT a hardcoded default).
//   3. The ECL invariant holds (delegated to generateBa200CreditRisk unchanged).
//   4. NO new event type — only Ifrs9StageAssigned + lifecycle events are used.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH;
//   brief:mira:ws-ba-returns-followon-ba-200-credit-risk-events:2026-06-09.
//
// Author: Mira (Regulatory reporting engineer, engineering).

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import { makeIfrs9StageAssigned } from "../platform/event-store/event-types/ifrs9-staging";
import { makeInterbankLoanPlaced } from "../platform/event-store/event-types/repo-mmd-ibl";
import { EventStore } from "../platform/event-store/store";
import { generateBa200CreditRiskFromEvents } from "../platform/reporting";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:test:ba200" };
const CITATIONS = ["D-BA-RETURNS-FOLLOWON-BATCH"];
const AS_OF = "2026-05-31T00:00:00.000Z";

function freshStore(): EventStore {
  const dir = mkdtempSync(join(tmpdir(), "ba200-events-"));
  return new EventStore(join(dir, "event.db"));
}

function bookBond(store: EventStore, overrides: Record<string, unknown> = {}): void {
  store.append(
    makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "TRD-BOND-001",
        bondIsin: "ZAG000030108",
        side: "buy",
        nominalMinor: 10_000_000,
        cleanPricePercent: 100.0,
        accruedInterestMinor: 0,
        dirtyPricePercent: 100.0,
        settlementDate: "2026-05-27",
        portfolio: "banking-book",
        couponRate: 0.085,
        maturityDate: "2031-05-27",
        currency: "ZAR",
        counterpartyLei: "CP-LEI-001",
        executedAt: AS_OF,
        ...overrides,
      } as never,
    }),
  );
}

function placeInterbankLoan(store: EventStore, overrides: Record<string, unknown> = {}): void {
  store.append(
    makeInterbankLoanPlaced({
      asOf: AS_OF,
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

function assignStage(
  store: EventStore,
  payload: {
    tradeId: string;
    instrumentId: string;
    stage: 1 | 2 | 3;
    eclBasisPoints: number;
    eclAmountMinor: number;
    triggerReason:
      | "initial-recognition"
      | "30-dpd"
      | "manual-sicr"
      | "90-dpd"
      | "restructured"
      | "default";
  },
): void {
  store.append(
    makeIfrs9StageAssigned({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...payload,
        currency: "ZAR",
        assessedAt: AS_OF,
        assessorId: "ifrs9-engine",
        policyRef: "D-IFRS9-STAGING-V1",
      },
    }),
  );
}

describe("generateBa200CreditRiskFromEvents", () => {
  it("reflects the staged ECL when an Ifrs9StageAssigned joins the exposure", () => {
    const store = freshStore();
    // Bond staged to Stage 3 (credit-impaired) with a large lifetime ECL.
    bookBond(store);
    assignStage(store, {
      tradeId: "TRD-BOND-001",
      instrumentId: "fi:bond:ZAG000030108",
      stage: 3,
      eclBasisPoints: 5000,
      eclAmountMinor: 5_000_000, // 50% of 10m gross
      triggerReason: "default",
    });
    // Interbank placement staged to Stage 2 (SICR) with a lifetime ECL.
    placeInterbankLoan(store);
    assignStage(store, {
      tradeId: "IBL-001",
      instrumentId: "fi:ibl:IBL-001",
      stage: 2,
      eclBasisPoints: 100,
      eclAmountMinor: 250_000,
      triggerReason: "manual-sicr",
    });

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, "ZAR");

    expect(out.totalLoansAndAdvances.totalEntries).toBe(2);
    expect(out.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(35_000_000);
    // Total ECL = 5,000,000 (stage 3 bond) + 250,000 (stage 2 IBL).
    expect(out.totalLoansAndAdvances.totalEcl).toBe(5_250_000);
    expect(out.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(5_250_000);

    const stage3 = out.byStage.find((s) => s.stage === 3);
    const stage2 = out.byStage.find((s) => s.stage === 2);
    expect(stage3?.totalEcl).toBe(5_000_000);
    expect(stage3?.totalGrossCarryingAmount).toBe(10_000_000);
    expect(stage2?.totalEcl).toBe(250_000);
    expect(stage2?.totalGrossCarryingAmount).toBe(25_000_000);

    // NPL ratio = stage-3 gross / total gross = 10m / 35m.
    expect(out.nplRatio).toBeCloseTo(10_000_000 / 35_000_000, 10);
  });

  it("falls back to engine Stage-1 ECL when no staging event exists (no hardcoded default)", () => {
    const store = freshStore();
    placeInterbankLoan(store, { placementId: "IBL-NO-STAGE", principalZar: 100_000_000 });

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, "ZAR");

    expect(out.totalLoansAndAdvances.totalEntries).toBe(1);
    const stage1 = out.byStage.find((s) => s.stage === 1);
    expect(stage1?.entryCount).toBe(1);
    // Engine Stage-1 ECL for interbank-placement: PD 30 bps, LGD 4500 bps.
    // ECL = 100,000,000 × 30 × 4500 / 1e8 = 135,000. Small relative to gross,
    // but strictly positive — proving it is the computed engine value, not 0.
    expect(stage1?.totalEcl).toBe(135_000);
    expect(out.totalLoansAndAdvances.totalEcl).toBe(135_000);
  });

  it("holds the ECL invariant across mixed staged + fallback exposures", () => {
    const store = freshStore();
    bookBond(store, { tradeId: "B-STAGED", bondIsin: "ZAG000030108" });
    assignStage(store, {
      tradeId: "B-STAGED",
      instrumentId: "fi:bond:ZAG000030108",
      stage: 2,
      eclBasisPoints: 100,
      eclAmountMinor: 100_000,
      triggerReason: "manual-sicr",
    });
    placeInterbankLoan(store, { placementId: "IBL-FALLBACK", principalZar: 50_000_000 });

    // generateBa200CreditRisk asserts the invariant internally; if it threw the
    // call would reject. We additionally check the arithmetic here.
    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, "ZAR");
    const sumRelevantEcl = out.byStage.reduce((s, x) => s + x.totalEcl, 0);
    expect(out.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(sumRelevantEcl);
  });

  it("maps exposure classes to BA 200 product-category rows", () => {
    const store = freshStore();
    placeInterbankLoan(store, { placementId: "IBL-CAT" });
    bookBond(store, { tradeId: "BND-CAT", bondIsin: "ZAG000030108" });

    const out = generateBa200CreditRiskFromEvents(store, AS_OF, ENTITY, "ZAR");
    const cats = out.byCategory.map((c) => c.productCategory).sort();
    expect(cats).toContain("interbank");
    expect(cats).toContain("sovereign");
    // Categories are mapped to BA 200 rows (no classification gaps for the
    // default map).
    expect(out.classificationGaps).toEqual([]);
  });
});
