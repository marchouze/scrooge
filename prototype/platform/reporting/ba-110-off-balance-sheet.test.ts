// platform/reporting/ba-110-off-balance-sheet.test.ts
//
// WS-BA-RETURNS-P1-SOURCING Phase 4 — BA 110 (Off-Balance-Sheet Activities)
// events-first generator + BA 700 leverage-ratio OBS wiring.

import { describe, expect, it } from "bun:test";

import {
  makeIrdSwapTerminated,
  makeIrdSwapTradeExecuted,
} from "../event-store/event-types/ird-accounting";
import {
  fundingLineCommitmentRecordedPayloadSchema,
  makeFundingLineDrawn,
  makeRepoEndLegSettled,
  makeRepoTradeOpened,
} from "../event-store/event-types/repo-mmd-ibl";
import { EventStore } from "../event-store/store";
import { type Actor, type Event, eventSchema } from "../event-store/types";
import {
  BA_110_DERIVATIVE_BUILD_PHASE_CCF,
  Ba110OffBalanceSheetGeneratorError,
  generateBa110OffBalanceSheetFromEvents,
} from "./ba-110-off-balance-sheet";
import { renderBa110ObsCanonical } from "./ba-110-render";
import { generateBa100CapitalFromEvents } from "./ba-700-events-adapter";

const ENTITY = "LE-ZA-HOZ-BANK";
const ASOF = "2026-05-31T00:00:00.000Z";
const CCY = "ZAR";
const ACTOR: Actor = { type: "service", id: "agent:test" };

// --- event factories --------------------------------------------------------

function liveSwap(tradeId: string, notionalMinor: number): Event {
  return makeIrdSwapTradeExecuted({
    asOf: "2026-05-01T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL"],
    payload: {
      tradeId,
      instrumentType: "irs",
      role: "pay-fixed",
      notionalMinor,
      npvMinor: 0,
      fixedRatePercent: 0.075,
      tradeDate: "2026-05-01",
      startDate: "2026-05-03",
      maturityDate: "2031-05-03",
      counterpartyLei: "SBZAZAJJXXX",
      currency: CCY,
    },
  });
}

function terminateSwap(tradeId: string): Event {
  return makeIrdSwapTerminated({
    asOf: "2026-05-15T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL"],
    payload: {
      tradeId,
      terminationPaymentMinor: 0,
      carryingNpvAtTerminationMinor: 0,
      realisedPnlMinor: 0,
      terminationDate: "2026-05-15",
      currency: CCY,
    },
  });
}

function openRepo(tradeId: string, collateralFaceValue: number): Event {
  return makeRepoTradeOpened({
    asOf: "2026-05-02T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
    payload: {
      tradeId,
      counterpartyLei: "SBZAZAJJXXX",
      startLegSettlementDate: "2026-05-02",
      endLegSettlementDate: "2026-06-02",
      startLegCashZar: collateralFaceValue,
      repurchasePriceZar: collateralFaceValue + 1_000_00,
      repoRateDecimal: 0.0825,
      collateralIsin: "ZAG000016320",
      collateralFaceValue,
      collateralHaircutPct: 2.0,
      bookId: "TREASURY",
      traderRef: "agent:treasury",
      instrumentRef: "REPO-ZAR-001",
    },
  });
}

function settleRepoEndLeg(tradeId: string): Event {
  return makeRepoEndLegSettled({
    asOf: "2026-05-20T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
    payload: {
      tradeId,
      repurchasePriceZar: 1_000_00,
    },
  });
}

function recordCommitment(facilityId: string, committedAmountMinor: number, ccf: number): Event {
  return eventSchema.parse({
    event_id: `evt-commit-${facilityId}`,
    type: "FundingLineCommitmentRecorded",
    as_of: "2026-05-01T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL", "BA110"],
    payload: fundingLineCommitmentRecordedPayloadSchema.parse({
      facilityId,
      counterpartyId: "SBZAZAJJXXX",
      committedAmountMinor,
      currency: CCY,
      maturityDate: "2027-05-01",
      facilityType: "revolving",
      creditConversionFactor: ccf,
    }),
  });
}

function drawFacility(facilityId: string, drawnAmountZar: number): Event {
  return makeFundingLineDrawn({
    asOf: "2026-05-10T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
    payload: {
      fundingLineId: facilityId,
      drawnAmountZar,
      maturityDate: "2026-08-10",
      rateDecimal: 0.085,
    },
  });
}

// --- generator tests --------------------------------------------------------

describe("BA 110 off-balance-sheet generator (events-first)", () => {
  it("rejects non-bank entities", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      generateBa110OffBalanceSheetFromEvents(store, ASOF, "LE-ZA-HOZ-GROUP", CCY),
    ).toThrow(Ba110OffBalanceSheetGeneratorError);
  });

  it("rejects non-ISO functional currency", () => {
    const store = new EventStore(":memory:");
    expect(() => generateBa110OffBalanceSheetFromEvents(store, ASOF, ENTITY, "ZA")).toThrow(
      Ba110OffBalanceSheetGeneratorError,
    );
  });

  it("empty store → zero totals, empty sections", () => {
    const store = new EventStore(":memory:");
    const out = generateBa110OffBalanceSheetFromEvents(store, ASOF, ENTITY, CCY);
    expect(out.grossTotalMinor).toBe(0);
    expect(out.ccfWeightedTotalMinor).toBe(0);
    expect(out.derivatives.lineItems).toHaveLength(0);
    expect(out.securitiesFinancing.lineItems).toHaveLength(0);
    expect(out.committedUndrawn.lineItems).toHaveLength(0);
  });

  it("folds live IRS, open repo, and partially-drawn commitment into expected totals", () => {
    const store = new EventStore(":memory:");
    // Live IRS notional R100m (1_000_000_000 cents → expressed in minor).
    const swapNotional = 100_000_000_00;
    store.append(liveSwap("IRS-001", swapNotional));
    // Open repo collateral face value R50m.
    const repoCollateral = 50_000_000_00;
    store.append(openRepo("REPO-001", repoCollateral));
    // Commitment R20m, 50% drawn (R8m), CCF 0.50.
    const committed = 20_000_000_00;
    const drawn = 8_000_000_00;
    store.append(recordCommitment("FAC-001", committed, 0.5));
    store.append(drawFacility("FAC-001", drawn));

    const out = generateBa110OffBalanceSheetFromEvents(store, ASOF, ENTITY, CCY);

    // Derivatives: gross notional, CCF 1.00 (build-phase).
    expect(out.derivatives.lineItems).toHaveLength(1);
    expect(out.derivatives.grossTotalMinor).toBe(swapNotional);
    expect(out.derivatives.lineItems[0]?.creditConversionFactor).toBe(
      BA_110_DERIVATIVE_BUILD_PHASE_CCF,
    );
    expect(out.derivatives.ccfWeightedTotalMinor).toBe(swapNotional);

    // SFT: gross collateral, no haircut at v0.
    expect(out.securitiesFinancing.grossTotalMinor).toBe(repoCollateral);
    expect(out.securitiesFinancing.ccfWeightedTotalMinor).toBe(repoCollateral);

    // Committed-undrawn: (20m − 8m) = 12m gross; × 0.50 CCF = 6m weighted.
    const undrawn = committed - drawn;
    expect(out.committedUndrawn.grossTotalMinor).toBe(undrawn);
    expect(out.committedUndrawn.ccfWeightedTotalMinor).toBe(undrawn * 0.5);

    // Grand totals.
    expect(out.grossTotalMinor).toBe(swapNotional + repoCollateral + undrawn);
    expect(out.ccfWeightedTotalMinor).toBe(swapNotional + repoCollateral + undrawn * 0.5);
  });

  it("excludes terminated swaps and settled repos", () => {
    const store = new EventStore(":memory:");
    store.append(liveSwap("IRS-LIVE", 10_000_000_00));
    store.append(liveSwap("IRS-DEAD", 99_000_000_00));
    store.append(terminateSwap("IRS-DEAD"));
    store.append(openRepo("REPO-LIVE", 5_000_000_00));
    store.append(openRepo("REPO-DONE", 7_000_000_00));
    store.append(settleRepoEndLeg("REPO-DONE"));

    const out = generateBa110OffBalanceSheetFromEvents(store, ASOF, ENTITY, CCY);

    expect(out.derivatives.lineItems).toHaveLength(1);
    expect(out.derivatives.lineItems[0]?.sourceRef).toBe("IRS-LIVE");
    expect(out.derivatives.grossTotalMinor).toBe(10_000_000_00);

    expect(out.securitiesFinancing.lineItems).toHaveLength(1);
    expect(out.securitiesFinancing.lineItems[0]?.sourceRef).toBe("REPO-LIVE");
    expect(out.securitiesFinancing.grossTotalMinor).toBe(5_000_000_00);
  });

  it("fully-drawn commitment yields zero undrawn exposure", () => {
    const store = new EventStore(":memory:");
    store.append(recordCommitment("FAC-FULL", 10_000_000_00, 0.5));
    store.append(drawFacility("FAC-FULL", 10_000_000_00));

    const out = generateBa110OffBalanceSheetFromEvents(store, ASOF, ENTITY, CCY);
    expect(out.committedUndrawn.lineItems).toHaveLength(0);
    expect(out.committedUndrawn.ccfWeightedTotalMinor).toBe(0);
  });

  it("renders deterministically (byte-identical across two runs)", () => {
    const store = new EventStore(":memory:");
    store.append(liveSwap("IRS-001", 10_000_000_00));
    store.append(recordCommitment("FAC-001", 20_000_000_00, 0.5));
    const out = generateBa110OffBalanceSheetFromEvents(store, ASOF, ENTITY, CCY);
    const a = renderBa110ObsCanonical(out, { renderedAt: "2026-05-31T12:00:00.000Z" });
    const b = renderBa110ObsCanonical(out, { renderedAt: "2026-05-31T12:00:00.000Z" });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.render.ccfWeightedTotalMinor).toBe(out.ccfWeightedTotalMinor);
  });
});

// --- BA 700 leverage wiring -------------------------------------------------

describe("BA 700 leverage ratio reflects BA 110 off-balance-sheet exposure", () => {
  function baseCapitalInput(foldObs: boolean) {
    return {
      entity: ENTITY,
      asOf: ASOF,
      periodId: "period:hoz-bank:month:2026-05",
      functionalCurrency: CCY,
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: ASOF,
      classifications: [
        {
          leafAccountId: "ACC-3000-001",
          capitalTier: "cet1" as const,
        },
      ],
      deductions: [],
      rwa: {
        creditRwaMinor: 0,
        marketRwaMinor: 0,
        operationalRwaMinor: 0,
        source: "fixture-rehearsal",
      },
      // On-balance-sheet exposure supplied; OBS comes from BA 110 fold.
      leverageExposureMeasure: {
        onBalanceSheetExposureMinor: 100_000_000_00,
        derivativeExposureMinor: 0,
        sftExposureMinor: 0,
        offBalanceSheetExposurePostCcfMinor: 0,
        source: "test",
      },
      foldBa110OffBalanceSheet: foldObs,
    };
  }

  it("OBS exposure pushes the leverage denominator above on-balance-sheet alone", () => {
    const store = new EventStore(":memory:");
    // R30m Tier-1 capital contribution.
    store.append(
      eventSchema.parse({
        event_id: "evt-cap-001",
        type: "CapitalContributionRecorded",
        as_of: "2026-05-01T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-RAS"],
        payload: {
          accountId: "ACC-3000-001",
          currency: CCY,
          amountMinor: 30_000_000_00,
        },
      }),
    );
    // Off-balance-sheet: committed-undrawn R20m × 0.50 CCF = R10m post-CCF.
    store.append(recordCommitment("FAC-001", 20_000_000_00, 0.5));

    const withoutObs = generateBa100CapitalFromEvents(store, baseCapitalInput(false));
    const withObs = generateBa100CapitalFromEvents(store, baseCapitalInput(true));

    const denomWithout = withoutObs.leverageRatio?.exposureMeasure.totalExposureMeasureMinor ?? 0;
    const denomWith = withObs.leverageRatio?.exposureMeasure.totalExposureMeasureMinor ?? 0;

    // OBS slot picked up the R10m post-CCF exposure.
    expect(withObs.leverageRatio?.exposureMeasure.offBalanceSheetExposurePostCcfMinor).toBe(
      10_000_000_00,
    );
    // Denominator is strictly larger once OBS is folded in.
    expect(denomWith).toBe(denomWithout + 10_000_000_00);
    expect(denomWith).toBeGreaterThan(100_000_000_00); // > on-balance-sheet alone
    // Ratio falls because the denominator grew.
    expect(withObs.leverageRatio?.leverageRatio).toBeLessThan(
      withoutObs.leverageRatio?.leverageRatio ?? Number.POSITIVE_INFINITY,
    );
  });
});
