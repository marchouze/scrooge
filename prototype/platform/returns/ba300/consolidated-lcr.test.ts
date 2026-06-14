// platform/returns/ba300/consolidated-lcr.test.ts
//
// Coverage for the consolidated BA 300 LCR engine (build-half closure of
// GAP-LCR-CONSOLIDATION-ENGINE; liquidity-risk policy §2.6 / D1/2022 §4.1.2).
//
//   1. Perimeter resolution from the PRODUCTION legal-entity tree seed:
//      only Hoz Bank (PA) is in scope; Hoz Securities (JSE) + Hoz Group
//      (holding) are excluded (ORG-PR-LCR-003).
//   2. Single-entity identity: with the current one-bank perimeter and no
//      eliminations, consolidated == solo exactly (the production case).
//   3. Golden solo-vs-consolidated reconciliation with a SYNTHETIC second
//      banking entity (TEST FIXTURE ONLY — the production tree is untouched):
//      consolidated gross flows = Σ solo gross flows − intragroup
//      eliminations (ORG-PR-LCR-005).
//   4. Entity-level HQLA cap + transferability gate (ORG-PR-LCR-004).
//   5. Group-basis 75% inflow cap (ORG-PR-LCR-006).
//   6. Validation guards (currency ORG-PR-LCR-007, perimeter, schedule).
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10;
//            Policies/liquidity-risk-management-policy-v1.md §2.6 + §11.5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import tree from "../../../seeds/legal-entity-tree.json";
import type { Ba300LcrOutput } from "../../reporting/ba-300-lcr";
import { applyHqlaCaps } from "../../reporting/ba-300-lcr";
import {
  type ConsolidatedLcrEntityInput,
  ConsolidatedLcrError,
  GROUP_INFLOW_CAP_RATIO,
  HOME_JURISDICTION_MINIMUM_LCR_RATIO,
  NET_CASH_OUTFLOW_FLOOR_RATIO,
  consolidateBa300Lcr,
  resolveLcrConsolidationPerimeter,
} from "./consolidated-lcr";
import { moneyFromMinorUnits } from "../../core/decimal-money";
import type { Currency } from "../../core/types";

const AS_OF = "2026-06-30T23:59:59.000Z";
const PERIOD_ID = "2026-06";

// ---------------------------------------------------------------------------
// Solo-output fixture builder — internally consistent with the solo
// generator's formulas (same applyHqlaCaps closed form, same floor/ceil
// rounding) so the identity assertions are exact.
// ---------------------------------------------------------------------------

function makeSoloFixture(args: {
  entity: string;
  level1Minor: number;
  level2APreCapMinor?: number;
  level2BPreCapMinor?: number;
  grossOutflowsMinor: number;
  grossInflowsMinor: number;
  functionalCurrency?: string;
}): Ba300LcrOutput {
  const l2a = args.level2APreCapMinor ?? 0;
  const l2b = args.level2BPreCapMinor ?? 0;
  const caps = applyHqlaCaps({
    level1Minor: args.level1Minor,
    level2ARawMinor: l2a,
    level2BRawMinor: l2b,
  });
  const inflowCap = Math.floor(0.75 * args.grossOutflowsMinor);
  const cappedInflows = Math.min(args.grossInflowsMinor, inflowCap);
  const preFloorNet = args.grossOutflowsMinor - cappedInflows;
  const floor = Math.ceil(0.25 * args.grossOutflowsMinor);
  const netCashOutflows = Math.max(preFloorNet, floor);
  const lcrRatio =
    netCashOutflows > 0 ? caps.totalStockMinor / netCashOutflows : Number.POSITIVE_INFINITY;
  return {
    meta: {
      form: "BA 300",
      formVersion: "v0.2-fx-enriched",
      entity: args.entity,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: args.functionalCurrency ?? "ZAR",
      generatorVersion: "v0.1",
      classificationsFingerprint: "test-fixture",
      inputCompleteness: {
        hqlaInputsFound: 1,
        outflowInputsFound: 1,
        inflowInputsFound: 1,
        excludedByFilter: 0,
        excludedReasons: {},
        completenessClass: "complete",
      },
    },
    hqla: {
      level1: { stockMinor: args.level1Minor, contributionMinor: args.level1Minor, lineItems: [] },
      level2A: {
        stockMinor: l2a,
        preCapContributionMinor: l2a,
        contributionMinor: caps.level2AContributionMinor,
        capBindingIndicator: caps.level2ACapBinding,
        lineItems: [],
      },
      level2B: {
        stockMinor: l2b,
        preCapContributionMinor: l2b,
        contributionMinor: caps.level2BContributionMinor,
        capBindingIndicator: caps.level2BCapBinding,
        lineItems: [],
      },
      totalStockHqlaMinor: caps.totalStockMinor,
    },
    cashFlows: {
      outflows: { grossMinor: args.grossOutflowsMinor, lineItems: [] },
      inflows: {
        grossMinor: args.grossInflowsMinor,
        cappedMinor: cappedInflows,
        capBindingIndicator: args.grossInflowsMinor > inflowCap,
        lineItems: [],
      },
      netCashOutflowsMinor: netCashOutflows,
      netCashOutflowFloorBindingIndicator: preFloorNet < floor,
    },
    lcrRatio,
    lcrCompliant: lcrRatio >= 1.0,
    citations: ["test-fixture"],
    placeholders: [],
  };
}

const HOZ_BANK: ConsolidatedLcrEntityInput = {
  entityId: "LE-ZA-HOZ-BANK",
  entityUrn: "urn:legal-entity:hoz:hoz-bank:v1",
  jurisdiction: "ZA",
  isHomeConsolidatingEntity: true,
  solo: makeSoloFixture({
    entity: "LE-ZA-HOZ-BANK",
    level1Minor: 5_000_000_00,
    grossOutflowsMinor: 4_000_000_00,
    grossInflowsMinor: 1_000_000_00,
  }),
};

/**
 * SYNTHETIC second banking entity — TEST FIXTURE ONLY. The production
 * legal-entity tree (`seeds/legal-entity-tree.json`) has exactly one banking
 * entity; no entity is fabricated into production seeds. This fixture
 * exercises the multi-entity consolidation path the engine must support from
 * day one (Principle 5).
 */
function makeSyntheticSubsidiary(
  overrides?: Partial<ConsolidatedLcrEntityInput>,
): ConsolidatedLcrEntityInput {
  return {
    entityId: "LE-MU-HOZ-BANK-MU",
    entityUrn: "urn:legal-entity:hoz:hoz-bank-mu:v1-TEST-SYNTHETIC",
    jurisdiction: "MU",
    isHomeConsolidatingEntity: false,
    jurisdictionMinimumLcrRatio: 1.0,
    solo: makeSoloFixture({
      entity: "LE-MU-HOZ-BANK-MU",
      level1Minor: 2_000_000_00,
      grossOutflowsMinor: 1_500_000_00,
      grossInflowsMinor: 500_000_00,
    }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Perimeter resolution from the production tree (ORG-PR-LCR-003)
// ---------------------------------------------------------------------------

describe("resolveLcrConsolidationPerimeter — production legal-entity tree", () => {
  it("includes only the PA-regulated (deposit-taking) entity — Hoz Bank", () => {
    const perimeter = resolveLcrConsolidationPerimeter(tree.entities);
    expect(perimeter).toHaveLength(1);
    expect(perimeter[0]?.entityUrn).toBe("urn:legal-entity:hoz:hoz-bank:v1");
    expect(perimeter[0]?.legalName).toBe("Hoz Bank Limited");
  });

  it("excludes Hoz Securities (JSE, non-deposit-taking) and Hoz Group (holding)", () => {
    const perimeter = resolveLcrConsolidationPerimeter(tree.entities);
    const urns = perimeter.map((p) => p.entityUrn);
    expect(urns).not.toContain("urn:legal-entity:hoz:hoz-securities:v1");
    expect(urns).not.toContain("urn:legal-entity:hoz:hoz-group:v1");
  });
});

// ---------------------------------------------------------------------------
// 2. Single-entity identity — the production case today
// ---------------------------------------------------------------------------

describe("consolidateBa300Lcr — single-entity perimeter (production case)", () => {
  const result = consolidateBa300Lcr({
    asOf: AS_OF,
    periodId: PERIOD_ID,
    entities: [HOZ_BANK],
    eliminations: [],
  });

  it("reproduces the solo output exactly (numerator, denominator, ratio)", () => {
    expect(result.hqla.totalStockHqlaMinor).toBe(HOZ_BANK.solo.hqla.totalStockHqlaMinor);
    expect(result.cashFlows.netCashOutflowsMinor).toBe(
      HOZ_BANK.solo.cashFlows.netCashOutflowsMinor,
    );
    expect(result.cashFlows.cappedInflowsMinor).toBe(HOZ_BANK.solo.cashFlows.inflows.cappedMinor);
    expect(result.lcrRatio).toBe(HOZ_BANK.solo.lcrRatio);
    expect(result.lcrCompliant).toBe(HOZ_BANK.solo.lcrCompliant);
  });

  it("carries consolidated-basis meta: ZAR, monthly, perimeter entity ids", () => {
    expect(result.meta.basis).toBe("consolidated");
    expect(result.meta.reportingCurrency).toBe("ZAR");
    expect(result.meta.cadence).toBe("monthly");
    expect(result.meta.perimeterEntityIds).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("home entity HQLA is never capped (ORG-PR-LCR-004 home carve-out)", () => {
    expect(result.entityDetails[0]?.entityHqlaCapBinding).toBe(false);
    expect(result.entityDetails[0]?.hqlaExcessExcludedMinor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Golden solo-vs-consolidated reconciliation (synthetic second entity)
// ---------------------------------------------------------------------------

describe("consolidateBa300Lcr — golden reconciliation, synthetic 2nd entity", () => {
  // Intragroup deposit: subsidiary holds R200,000 with the parent, stressed
  // outflow at the parent / inflow at the subsidiary inside the 30-day window.
  const ELIM = 200_000_00;
  const sub = makeSyntheticSubsidiary({
    // Excess transferability assessed so the golden case is pure summation.
    excessHqlaTransferabilityAssessed: {
      assessedTransferable: true,
      assessedBy: "agent:eitan:treasurer",
      assessmentRef: "test:transferability-assessment",
    },
  });
  const result = consolidateBa300Lcr({
    asOf: AS_OF,
    periodId: PERIOD_ID,
    entities: [HOZ_BANK, sub],
    eliminations: [
      {
        fromEntityId: "LE-ZA-HOZ-BANK",
        toEntityId: "LE-MU-HOZ-BANK-MU",
        amountMinor: ELIM,
        amount: moneyFromMinorUnits(BigInt(ELIM), "ZAR" as Currency),
        source: "test:intragroup-deposit",
      },
    ],
  });

  const sumOut =
    HOZ_BANK.solo.cashFlows.outflows.grossMinor + sub.solo.cashFlows.outflows.grossMinor;
  const sumIn = HOZ_BANK.solo.cashFlows.inflows.grossMinor + sub.solo.cashFlows.inflows.grossMinor;

  it("consolidated gross flows = Σ solo gross flows − intragroup eliminations", () => {
    expect(result.cashFlows.sumSoloGrossOutflowsMinor).toBe(sumOut);
    expect(result.cashFlows.sumSoloGrossInflowsMinor).toBe(sumIn);
    expect(result.cashFlows.eliminatedOutflowsMinor).toBe(ELIM);
    expect(result.cashFlows.eliminatedInflowsMinor).toBe(ELIM);
    expect(result.cashFlows.grossOutflowsMinor).toBe(sumOut - ELIM);
    expect(result.cashFlows.grossInflowsMinor).toBe(sumIn - ELIM);
  });

  it("denominator applies the group-basis cap + floor to the eliminated flows", () => {
    const out = sumOut - ELIM;
    const inn = sumIn - ELIM;
    const capped = Math.min(inn, Math.floor(GROUP_INFLOW_CAP_RATIO * out));
    const expected = Math.max(out - capped, Math.ceil(NET_CASH_OUTFLOW_FLOOR_RATIO * out));
    expect(result.cashFlows.netCashOutflowsMinor).toBe(expected);
  });

  it("numerator = Σ entity HQLA (both fully countable here), group caps re-applied", () => {
    expect(result.hqla.totalStockHqlaMinor).toBe(
      HOZ_BANK.solo.hqla.totalStockHqlaMinor + sub.solo.hqla.totalStockHqlaMinor,
    );
    expect(result.lcrRatio).toBe(
      result.hqla.totalStockHqlaMinor / result.cashFlows.netCashOutflowsMinor,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Entity-level HQLA cap + transferability gate (ORG-PR-LCR-004)
// ---------------------------------------------------------------------------

describe("consolidateBa300Lcr — ORG-PR-LCR-004 entity HQLA cap", () => {
  it("caps an unassessed subsidiary's HQLA at min-ratio × its net outflows", () => {
    const sub = makeSyntheticSubsidiary(); // no transferability assessment
    const result = consolidateBa300Lcr({
      asOf: AS_OF,
      periodId: PERIOD_ID,
      entities: [HOZ_BANK, sub],
      eliminations: [],
    });
    const detail = result.entityDetails.find((d) => d.entityId === "LE-MU-HOZ-BANK-MU");
    // Sub: outflows 1.5m, inflows 0.5m → net-for-cap 1.0m; min ratio 1.0 →
    // cap R1.0m. Solo HQLA R2.0m → R1.0m counted, R1.0m excess excluded.
    expect(detail?.hqlaCountedMinor).toBe(1_000_000_00);
    expect(detail?.hqlaExcessExcludedMinor).toBe(1_000_000_00);
    expect(detail?.entityHqlaCapBinding).toBe(true);
    expect(result.hqla.totalStockHqlaMinor).toBe(
      HOZ_BANK.solo.hqla.totalStockHqlaMinor + 1_000_000_00,
    );
  });

  it("applies the lower-of rule when the host minimum is below home (lower bound wins)", () => {
    const sub = makeSyntheticSubsidiary({ jurisdictionMinimumLcrRatio: 0.8 });
    const result = consolidateBa300Lcr({
      asOf: AS_OF,
      periodId: PERIOD_ID,
      entities: [HOZ_BANK, sub],
      eliminations: [],
    });
    const detail = result.entityDetails.find((d) => d.entityId === "LE-MU-HOZ-BANK-MU");
    expect(detail?.appliedMinimumLcrRatio).toBe(0.8);
    expect(detail?.hqlaCountedMinor).toBe(800_000_00); // 0.8 × R1.0m net
  });

  it("includes the excess once Eitan's transferability assessment is supplied", () => {
    const sub = makeSyntheticSubsidiary({
      excessHqlaTransferabilityAssessed: {
        assessedTransferable: true,
        assessedBy: "agent:eitan:treasurer",
        assessmentRef: "test:assessment",
      },
    });
    const result = consolidateBa300Lcr({
      asOf: AS_OF,
      periodId: PERIOD_ID,
      entities: [HOZ_BANK, sub],
      eliminations: [],
    });
    const detail = result.entityDetails.find((d) => d.entityId === "LE-MU-HOZ-BANK-MU");
    expect(detail?.hqlaCountedMinor).toBe(sub.solo.hqla.totalStockHqlaMinor);
    expect(detail?.hqlaExcessExcludedMinor).toBe(0);
  });

  it("HOME_JURISDICTION_MINIMUM_LCR_RATIO is 100% per Reg 26(2)", () => {
    expect(HOME_JURISDICTION_MINIMUM_LCR_RATIO).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 5. Group-basis 75% inflow cap (ORG-PR-LCR-006)
// ---------------------------------------------------------------------------

describe("consolidateBa300Lcr — ORG-PR-LCR-006 group inflow cap", () => {
  it("caps consolidated inflows at 75% of consolidated outflows, group basis", () => {
    // Sub is inflow-heavy: solo inflows below its own 75% cap would NOT bind
    // at entity level on these numbers — the binding happens on the group.
    const inflowHeavySub = makeSyntheticSubsidiary({
      solo: makeSoloFixture({
        entity: "LE-MU-HOZ-BANK-MU",
        level1Minor: 1_000_000_00,
        grossOutflowsMinor: 400_000_00,
        grossInflowsMinor: 5_000_000_00,
      }),
      excessHqlaTransferabilityAssessed: {
        assessedTransferable: true,
        assessedBy: "agent:eitan:treasurer",
        assessmentRef: "test:assessment",
      },
    });
    const result = consolidateBa300Lcr({
      asOf: AS_OF,
      periodId: PERIOD_ID,
      entities: [HOZ_BANK, inflowHeavySub],
      eliminations: [],
    });
    const out = result.cashFlows.grossOutflowsMinor;
    expect(result.cashFlows.cappedInflowsMinor).toBe(Math.floor(GROUP_INFLOW_CAP_RATIO * out));
    expect(result.cashFlows.inflowCapBindingIndicator).toBe(true);
    // When the 75% cap binds exactly, net lands ON the 25% floor; the
    // floor-binding indicator is strict (<), matching the solo generator.
    expect(result.cashFlows.netCashOutflowFloorBindingIndicator).toBe(false);
    // Net = 25% floor when the cap binds fully.
    expect(result.cashFlows.netCashOutflowsMinor).toBe(
      Math.ceil(NET_CASH_OUTFLOW_FLOOR_RATIO * out),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Validation guards
// ---------------------------------------------------------------------------

describe("consolidateBa300Lcr — validation", () => {
  const base = { asOf: AS_OF, periodId: PERIOD_ID };

  it("rejects an empty perimeter", () => {
    expect(() => consolidateBa300Lcr({ ...base, entities: [], eliminations: [] })).toThrow(
      ConsolidatedLcrError,
    );
  });

  it("requires exactly one home consolidating entity", () => {
    const sub = makeSyntheticSubsidiary({ isHomeConsolidatingEntity: true });
    expect(() =>
      consolidateBa300Lcr({ ...base, entities: [HOZ_BANK, sub], eliminations: [] }),
    ).toThrow(/exactly one home consolidating entity/);
  });

  it("rejects non-ZAR solo inputs (ORG-PR-LCR-007 Rand reporting)", () => {
    const usdEntity: ConsolidatedLcrEntityInput = {
      ...HOZ_BANK,
      solo: makeSoloFixture({
        entity: "LE-ZA-HOZ-BANK",
        level1Minor: 1_000_00,
        grossOutflowsMinor: 1_000_00,
        grossInflowsMinor: 0,
        functionalCurrency: "USD",
      }),
    };
    expect(() => consolidateBa300Lcr({ ...base, entities: [usdEntity], eliminations: [] })).toThrow(
      /ORG-PR-LCR-007/,
    );
  });

  it("rejects self-eliminations (ORG-PR-LCR-005)", () => {
    expect(() =>
      consolidateBa300Lcr({
        ...base,
        entities: [HOZ_BANK],
        eliminations: [
          {
            fromEntityId: "LE-ZA-HOZ-BANK",
            toEntityId: "LE-ZA-HOZ-BANK",
            amountMinor: 1,
            amount: moneyFromMinorUnits(1n, "ZAR" as Currency),
            source: "test",
          },
        ],
      }),
    ).toThrow(/self-elimination/);
  });

  it("rejects eliminations referencing entities outside the perimeter", () => {
    expect(() =>
      consolidateBa300Lcr({
        ...base,
        entities: [HOZ_BANK],
        eliminations: [
          {
            fromEntityId: "LE-ZA-HOZ-BANK",
            toEntityId: "LE-ZA-HOZ-SECURITIES",
            amountMinor: 1,
            amount: moneyFromMinorUnits(1n, "ZAR" as Currency),
            source: "test",
          },
        ],
      }),
    ).toThrow(/outside the consolidation perimeter/);
  });

  it("rejects an elimination schedule exceeding an entity's solo gross flows", () => {
    const sub = makeSyntheticSubsidiary();
    expect(() =>
      consolidateBa300Lcr({
        ...base,
        entities: [HOZ_BANK, sub],
        eliminations: [
          {
            fromEntityId: "LE-ZA-HOZ-BANK",
            toEntityId: "LE-MU-HOZ-BANK-MU",
            amountMinor: HOZ_BANK.solo.cashFlows.outflows.grossMinor + 1,
            amount: moneyFromMinorUnits(BigInt(HOZ_BANK.solo.cashFlows.outflows.grossMinor + 1), "ZAR" as Currency),
            source: "test",
          },
        ],
      }),
    ).toThrow(/exceed entity/);
  });
});
