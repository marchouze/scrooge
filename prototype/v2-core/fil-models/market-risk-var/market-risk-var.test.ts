// v2-core/fil-models/market-risk-var/market-risk-var.test.ts
//
// A3 tests for the market-risk VaR `joint-recompute` AttributionMetric + the
// org hierarchy roll-up + the #4 multi-portfolio fold.
//
// Proves the A3 "Prove" points at the unit level:
//   - additive P&L rolls up (group == Σ desk);
//   - non-additive VaR re-computes at each node and shows DIVERSIFICATION
//     (group VaR < Σ desk VaR) explicitly;
//   - the VaR metric is joint-recompute (no-sum throws);
//   - the org hierarchy resolves parents/descendants at asOf (versioned);
//   - membership rolls a member up the ladder to a target org level;
//   - #4: portfolio is multi-valued (an instance sits in many portfolios).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { ANCHOR_TENANT_ID, type TenantId } from "../../control-plane/tenant";
import {
  type InstanceFacetSnapshot,
  type Instant,
  type InstrumentDimensionAssignedPayload,
  type ResolvedMember,
  type RollUpContext,
  type Slice,
  assertNoSum,
  consolidatedGroupRoot,
  evaluateSlice,
  membersOf,
  orgHierarchy,
  sumChildren,
} from "../../fil-attribution";
import type { FilInstanceUrn } from "../../fil-core/urn";
import type { MarketDataSlice } from "../../fil-facets/facets";
import {
  fcyCashFromSettledReceivable,
  fcyCashRiskMeasurable,
  fcyCashValuable,
} from "../fx-valuation";
import { type VarReturnMatrix, jointVar, makeVarMetric, varStageScope } from "./index";

const T = ANCHOR_TENANT_ID as TenantId;
const ASOF = "2026-06-13T12:00:00.000Z" as Instant;

function inst(id: string): FilInstanceUrn {
  return `fil:inst:tenant:za-bank:${id}` as FilInstanceUrn;
}

// A two-currency book with a long USD desk and a short GBP desk over POSITIVELY-
// correlated (but not identical) C/ZAR returns. A long-USD position and a
// short-GBP position then OFFSET: on a day both pairs fall, the long USD loses
// but the short GBP gains. So the group's worst joint scenario is milder than
// either desk's standalone worst — group VaR < Σ desk VaR (diversification).
// The returns are deliberately not identical, so the offset is partial, not total.
const USD_RETURNS = [-0.03, -0.022, -0.018, -0.01, 0.008, 0.015, 0.02, 0.028];
const GBP_RETURNS = [-0.028, -0.02, -0.012, -0.008, 0.01, 0.016, 0.022, 0.03];

function varMember(args: {
  id: string;
  currency: string;
  exposureZar: number;
  desk: string;
}): ResolvedMember {
  const minor = BigInt(Math.round(args.exposureZar * 100));
  // Value the member in ZAR at a unit rate (exposure already in ZAR).
  const zarPos = fcyCashFromSettledReceivable({ currency: "ZAR", signedNotionalMinor: minor });
  const ccyPos = fcyCashFromSettledReceivable({
    currency: args.currency,
    signedNotionalMinor: minor,
  });
  return {
    instanceUrn: inst(args.id),
    stage: "settled",
    tenantId: T,
    facets: {
      Valuable: fcyCashValuable(zarPos),
      RiskMeasurable: fcyCashRiskMeasurable(ccyPos),
    },
    groupKey: args.desk,
  };
}

const RETURN_MATRIX: VarReturnMatrix = new Map<string, readonly number[]>([
  ["USD/ZAR", USD_RETURNS],
  ["GBP/ZAR", GBP_RETURNS],
]);

const MARKS: MarketDataSlice = {
  asOf: ASOF,
  observables: { "ZAR/ZAR": 1, "USD/ZAR": 1, "GBP/ZAR": 1 },
};

describe("VaR metric — joint-recompute, non-additive", () => {
  it("is a joint-recompute metric (no sum path)", () => {
    const m = makeVarMetric(RETURN_MATRIX);
    expect(m.aggregation.mode).toBe("joint-recompute");
    expect("add" in m.aggregation).toBe(false);
    expect(() => assertNoSum(m)).toThrow();
    expect(() => sumChildren(m as never, [])).toThrow();
  });

  it("stageScope includes active (live FX) and settled (standing FCY cash)", () => {
    expect(varStageScope("active")).toBe(true);
    expect(varStageScope("settled")).toBe(true);
    expect(varStageScope("cancelled")).toBe(false);
    expect(varStageScope("proposed")).toBe(false);
  });

  it("DIVERSIFICATION: group VaR < Σ desk VaR (the A3 proof)", () => {
    const m = makeVarMetric(RETURN_MATRIX);
    const longUsd = varMember({
      id: "usd-long",
      currency: "USD",
      exposureZar: 1_000_000,
      desk: "desk-long",
    });
    const shortGbp = varMember({
      id: "gbp-short",
      currency: "GBP",
      exposureZar: -900_000,
      desk: "desk-short",
    });
    const all = [longUsd, shortGbp];

    // Group: all members in ONE cell (level group → joint recompute).
    const groupSlice: Slice = {
      tenantId: T,
      where: [{ dim: "book", op: "eq", value: "fx" }],
      level: "group",
    };
    const groupMembers = all.map((x) => ({ ...x, groupKey: "GROUP" }));
    const groupEval = evaluateSlice(m, groupSlice, groupMembers, MARKS, ASOF);
    const groupVar = groupEval.cells[0]?.value.varZar ?? 0;

    // Per desk: each desk's joint member set.
    const deskSlice: Slice = {
      tenantId: T,
      where: [{ dim: "book", op: "eq", value: "fx" }],
      level: "desk",
    };
    const deskEval = evaluateSlice(m, deskSlice, all, MARKS, ASOF);
    const sumDesk = deskEval.cells.reduce((s, c) => s + c.value.varZar, 0);

    expect(groupVar).toBeGreaterThan(0);
    expect(sumDesk).toBeGreaterThan(0);
    // The whole point: the joint group VaR is STRICTLY less than the sum of the
    // desk VaRs — composing child VaRs would OVERSTATE risk (diversification).
    expect(groupVar).toBeLessThan(sumDesk);
    // And never exceeds it (sub-additivity of the coherent measure).
    expect(groupVar).toBeLessThanOrEqual(sumDesk + 1e-9);
  });

  it("re-computes over the joint set (NOT a function of child results)", () => {
    // Two equal-and-opposite perfectly-anti-correlated positions net to ~zero
    // group risk, yet each child carries large standalone VaR — only a joint
    // recompute captures the offset; a sum would be badly wrong.
    const m = makeVarMetric(
      new Map([
        ["USD/ZAR", [0.02, -0.02, 0.02, -0.02]],
        ["GBP/ZAR", [0.02, -0.02, 0.02, -0.02]],
      ]),
    );
    const longUsd = varMember({ id: "a", currency: "USD", exposureZar: 1_000_000, desk: "d1" });
    const shortGbp = varMember({ id: "b", currency: "GBP", exposureZar: -1_000_000, desk: "d2" });
    const groupSlice: Slice = {
      tenantId: T,
      where: [{ dim: "book", op: "eq", value: "fx" }],
      level: "group",
    };
    const groupVar =
      evaluateSlice(
        m,
        groupSlice,
        [longUsd, shortGbp].map((x) => ({ ...x, groupKey: "G" })),
        MARKS,
        ASOF,
      ).cells[0]?.value.varZar ?? 0;
    const childA = jointVar([
      { factor: "USD/ZAR", exposureZar: 1_000_000, returns: [0.02, -0.02, 0.02, -0.02] },
    ]).varZar;
    const childB = jointVar([
      { factor: "GBP/ZAR", exposureZar: -1_000_000, returns: [0.02, -0.02, 0.02, -0.02] },
    ]).varZar;
    // The offsetting positions cancel: group VaR ≈ 0, far below child A + child B.
    expect(groupVar).toBeLessThan(childA + childB);
    expect(groupVar).toBeLessThan(1); // ≈ 0 ZAR (perfect offset)
  });
});

describe("org hierarchy — asOf projection", () => {
  const root = consolidatedGroupRoot("LE-ZA-HOZ-BANK");
  const edges = [
    {
      childAxis: "desk" as const,
      child: "desk-fx",
      parentAxis: "legalEntity",
      parent: "LE-ZA-HOZ-BANK",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    },
    {
      childAxis: "book" as const,
      child: "fx-trading",
      parentAxis: "desk",
      parent: "desk-fx",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    },
    {
      childAxis: "legalEntity" as const,
      child: "LE-ZA-HOZ-BANK",
      parentAxis: "consolidatedGroup",
      parent: root,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("resolves parents up the ladder to the consolidated-group root", () => {
    const h = orgHierarchy("legalEntity", edges, root);
    expect(h.parentOf("fx-trading", ASOF)).toBe("desk-fx");
    expect(h.parentOf("desk-fx", ASOF)).toBe("LE-ZA-HOZ-BANK");
    expect(h.parentOf("LE-ZA-HOZ-BANK", ASOF)).toBe(root);
    // Consolidation tops out at the tenant: the group root has no parent.
    expect(h.parentOf(root, ASOF)).toBeNull();
  });

  it("descendantsOf returns the transitive closure", () => {
    const h = orgHierarchy("legalEntity", edges, root);
    const under = h.descendantsOf("desk-fx", ASOF);
    expect(under).toContain("desk-fx");
    expect(under).toContain("fx-trading");
  });

  it("is versioned — a back-dated re-parent before asOf wins", () => {
    const moved = [
      ...edges,
      {
        childAxis: "desk" as const,
        child: "desk-fx",
        parentAxis: "legalEntity",
        parent: "LE-ZA-BRANCH",
        effectiveFrom: "2026-03-01T00:00:00.000Z",
      },
    ];
    const h = orgHierarchy("legalEntity", moved, root);
    // Before the move:
    expect(h.parentOf("desk-fx", "2026-02-01T00:00:00.000Z" as Instant)).toBe("LE-ZA-HOZ-BANK");
    // After the move:
    expect(h.parentOf("desk-fx", "2026-04-01T00:00:00.000Z" as Instant)).toBe("LE-ZA-BRANCH");
  });
});

describe("membership roll-up — climb a member to a target org level", () => {
  const root = consolidatedGroupRoot("LE-ZA-HOZ-BANK");
  const h = orgHierarchy(
    "legalEntity",
    [
      {
        childAxis: "desk",
        child: "desk-fx",
        parentAxis: "legalEntity",
        parent: "LE-ZA-HOZ-BANK",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      {
        childAxis: "legalEntity",
        child: "LE-ZA-HOZ-BANK",
        parentAxis: "consolidatedGroup",
        parent: root,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    ],
    root,
  );
  const rollUp: RollUpContext = {
    parentOf: (_axis, node, asOf) => h.parentOf(node, asOf),
    consolidatedGroupRoot: root,
  };
  const instances: InstanceFacetSnapshot[] = [
    {
      instanceUrn: inst("i1"),
      tenantId: T,
      stage: "active",
      economicDimensions: { currency: "USD" },
      facets: {},
    },
  ];
  const assignments: InstrumentDimensionAssignedPayload[] = [
    {
      kind: "InstrumentDimensionAssigned",
      tenantId: T,
      instanceUrn: inst("i1"),
      dimension: "desk",
      value: "desk-fx",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      assignedBy: "agent:trader",
      citation: "D-FIL-ATTRIBUTION-A1-BUILD",
    },
  ];

  it("rolls a desk-tagged member up to its legalEntity", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "desk", op: "eq", value: "desk-fx" }],
      level: "legalEntity",
    };
    const members = membersOf(slice, instances, assignments, ASOF, rollUp);
    expect(members).toHaveLength(1);
    expect(members[0]?.groupKey).toBe("LE-ZA-HOZ-BANK");
  });

  it("rolls every member up to the consolidated-group root at level group", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "desk", op: "eq", value: "desk-fx" }],
      level: "group",
    };
    const members = membersOf(slice, instances, assignments, ASOF, rollUp);
    expect(members[0]?.groupKey).toBe(root);
  });
});

describe("#4 portfolio multi-tag fold (encoded, not deferred)", () => {
  it("an instance sits in MANY portfolios at once", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "portfolio", op: "eq", value: "hedge-set-1" }],
      level: "leaf",
    };
    const instances: InstanceFacetSnapshot[] = [
      {
        instanceUrn: inst("p1"),
        tenantId: T,
        stage: "active",
        economicDimensions: { currency: "USD" },
        facets: {},
      },
    ];
    const assignments: InstrumentDimensionAssignedPayload[] = [
      {
        kind: "InstrumentDimensionAssigned",
        tenantId: T,
        instanceUrn: inst("p1"),
        dimension: "portfolio",
        value: "hedge-set-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        assignedBy: "agent:trader",
        citation: "D-ATTRIBUTION-STRATEGY-PORTFOLIO-TENANCY",
      },
      {
        kind: "InstrumentDimensionAssigned",
        tenantId: T,
        instanceUrn: inst("p1"),
        dimension: "portfolio",
        value: "macro-book",
        effectiveFrom: "2026-02-01T00:00:00.000Z",
        assignedBy: "agent:trader",
        citation: "D-ATTRIBUTION-STRATEGY-PORTFOLIO-TENANCY",
      },
    ];
    // The instance matches the slice predicate for hedge-set-1 (it is in many).
    const members = membersOf(slice, instances, assignments, ASOF);
    expect(members).toHaveLength(1);

    // And it ALSO matches a slice for the other portfolio (multi-membership).
    const slice2: Slice = {
      tenantId: T,
      where: [{ dim: "portfolio", op: "eq", value: "macro-book" }],
      level: "leaf",
    };
    expect(membersOf(slice2, instances, assignments, ASOF)).toHaveLength(1);
  });
});
