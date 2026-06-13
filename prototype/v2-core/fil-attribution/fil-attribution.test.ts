// v2-core/fil-attribution/fil-attribution.test.ts
//
// A1 kernel tests for the FIL attribution layer.
//
// Covers: the dimension origin model; the cross-desk co-sign authority (open
// question #1, CEO-approved); membership as a latest-covering-event-wins asOf
// projection (tenant-partitioned); the additive vs joint-recompute engine paths;
// and the no-sum guard (the runtime half of recon:attribution-nonadditive-no-sum).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { FilInstanceUrn } from "../fil-core/urn";
import type { Instant } from "./dimensions";
import {
  type AdditiveSemantics,
  type AttributionMetric,
  type InstanceFacetSnapshot,
  type InstrumentDimensionAssignedPayload,
  type JointRecomputeSemantics,
  type ResolvedMember,
  type Slice,
  assertNoSum,
  authoriseDimensionAssignment,
  evaluateSlice,
  isOrganisationalDimension,
  membersOf,
  sumChildren,
} from "./index";

const T = ANCHOR_TENANT_ID as TenantId;
const ASOF = "2026-06-13T12:00:00.000Z" as Instant;

function inst(id: string): FilInstanceUrn {
  return `fil:inst:tenant:za-bank:${id}` as FilInstanceUrn;
}

/** First-cell value of a single-cell evaluation (test helper; avoids `!`). */
function firstCellValue<T>(cells: readonly { readonly value: T }[]): T {
  const cell = cells.at(0);
  if (cell === undefined) throw new Error("expected at least one cell");
  return cell.value;
}

describe("dimension origin model", () => {
  it("classifies organisational vs economic dimensions", () => {
    expect(isOrganisationalDimension("book")).toBe(true);
    expect(isOrganisationalDimension("desk")).toBe(true);
    expect(isOrganisationalDimension("bookingAgent")).toBe(true);
    expect(isOrganisationalDimension("currency")).toBe(false);
    expect(isOrganisationalDimension("productType")).toBe(false);
    expect(isOrganisationalDimension("legalEntity")).toBe(false);
  });
});

describe("dimension-assignment authority (#1, CEO-approved)", () => {
  it("permits a first desk assignment (not a transfer)", () => {
    const out = authoriseDimensionAssignment(
      { dimension: "desk", value: "desk-fx" },
      { currentDesk: null, assignerDesk: "desk-fx" },
    );
    expect(out.authorised).toBe(true);
  });

  it("permits an own-desk book re-tag without a co-sign", () => {
    const out = authoriseDimensionAssignment(
      { dimension: "book", value: "fx-trading" },
      { currentDesk: "desk-fx", assignerDesk: "desk-fx" },
    );
    expect(out.authorised).toBe(true);
  });

  it("REJECTS a cross-desk transfer without a co-sign", () => {
    const out = authoriseDimensionAssignment(
      { dimension: "desk", value: "desk-rates" },
      { currentDesk: "desk-fx", assignerDesk: "desk-fx" },
    );
    expect(out.authorised).toBe(false);
    if (!out.authorised) expect(out.reason).toContain("co-sign");
  });

  it("permits a cross-desk transfer WITH a second-seat co-sign", () => {
    const out = authoriseDimensionAssignment(
      { dimension: "desk", value: "desk-rates", cosignedBy: "seat:treasurer" },
      { currentDesk: "desk-fx", assignerDesk: "desk-fx" },
    );
    expect(out.authorised).toBe(true);
  });

  it("REJECTS assigning an economic (facet-derived) dimension", () => {
    const out = authoriseDimensionAssignment(
      { dimension: "currency", value: "USD" },
      { currentDesk: null, assignerDesk: null },
    );
    expect(out.authorised).toBe(false);
  });
});

describe("membership — latest-covering-event-wins asOf projection", () => {
  const econ = (id: string, currency: string): InstanceFacetSnapshot => ({
    instanceUrn: inst(id),
    tenantId: T,
    stage: "active",
    economicDimensions: { currency, productType: "fil:type:fx:spot:vanilla@1.0" },
    facets: {},
  });

  const assign = (
    id: string,
    dimension: string,
    value: string,
    effectiveFrom: string,
  ): InstrumentDimensionAssignedPayload => ({
    kind: "InstrumentDimensionAssigned",
    tenantId: T,
    instanceUrn: inst(id),
    dimension,
    value,
    effectiveFrom,
    assignedBy: "agent:rohan",
    citation: "urn:cite:test",
  });

  it("selects members whose org+economic projection matches the slice predicate", () => {
    const slice: Slice = {
      sliceId: "slice:book:fx-trading",
      tenantId: T,
      where: [{ dim: "book", op: "eq", value: "fx-trading" }],
      level: "leaf",
    };
    const instances = [econ("a", "USD"), econ("b", "EUR")];
    const assignments = [
      assign("a", "book", "fx-trading", "2026-06-01T00:00:00.000Z"),
      assign("b", "book", "rates", "2026-06-01T00:00:00.000Z"),
    ];
    const members = membersOf(slice, instances, assignments, ASOF);
    expect(members.map((m) => m.instanceUrn)).toEqual([inst("a")]);
  });

  it("picks the latest effectiveFrom <= asOf (a re-book wins)", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "book", op: "eq", value: "rates" }],
      level: "leaf",
    };
    const instances = [econ("a", "USD")];
    const assignments = [
      assign("a", "book", "fx-trading", "2026-06-01T00:00:00.000Z"),
      assign("a", "book", "rates", "2026-06-10T00:00:00.000Z"), // re-book
    ];
    const members = membersOf(slice, instances, assignments, ASOF);
    expect(members.map((m) => m.instanceUrn)).toEqual([inst("a")]);
  });

  it("ignores assignments effective AFTER the asOf (back-dating honoured)", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "book", op: "eq", value: "rates" }],
      level: "leaf",
    };
    const instances = [econ("a", "USD")];
    const assignments = [
      assign("a", "book", "fx-trading", "2026-06-01T00:00:00.000Z"),
      assign("a", "book", "rates", "2026-12-31T00:00:00.000Z"), // future
    ];
    const members = membersOf(slice, instances, assignments, ASOF);
    expect(members).toHaveLength(0); // still in fx-trading at asOf
  });

  it("drops cross-tenant bleed (hard outer partition)", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "currency", op: "eq", value: "USD" }],
      level: "leaf",
    };
    const foreign: InstanceFacetSnapshot = {
      instanceUrn: "fil:inst:tenant:other:x" as FilInstanceUrn,
      tenantId: "tenant:other" as TenantId,
      stage: "active",
      economicDimensions: { currency: "USD" },
      facets: {},
    };
    const members = membersOf(slice, [econ("a", "USD"), foreign], [], ASOF);
    expect(members.map((m) => m.instanceUrn)).toEqual([inst("a")]);
  });
});

describe("engine — additive vs joint-recompute", () => {
  const member = (id: string, stage: ResolvedMember["stage"]): ResolvedMember => ({
    instanceUrn: inst(id),
    stage,
    tenantId: T,
    facets: {},
  });

  const countMetric: AttributionMetric<number> & { aggregation: AdditiveSemantics<number> } = {
    metricId: "count",
    resultKind: "scalar",
    readsFacets: [],
    stageScope: (s) => s === "active",
    aggregation: { mode: "additive", zero: 0, add: (a, b) => a + b },
    evaluate: (members) => members.length,
  };

  it("filters by stageScope and evaluates over the in-scope set", () => {
    const slice: Slice = {
      tenantId: T,
      where: [{ dim: "currency", op: "eq", value: "USD" }],
      level: "leaf",
    };
    const members = [member("a", "active"), member("b", "settled"), member("c", "active")];
    const ev = evaluateSlice(countMetric, slice, members, {} as never, ASOF);
    expect(ev.cells).toHaveLength(1);
    expect(firstCellValue(ev.cells)).toBe(2); // settled filtered out
  });

  it("rejects a member whose tenant != slice tenant (defence in depth)", () => {
    const slice: Slice = { tenantId: T, where: [], level: "leaf" };
    const bleed: ResolvedMember = { ...member("x", "active"), tenantId: "tenant:other" };
    expect(() => evaluateSlice(countMetric, slice, [bleed], {} as never, ASOF)).toThrow(
      /hard outer partition/,
    );
  });

  it("additivity: children-sum == joint recompute", () => {
    const all = [member("a", "active"), member("b", "active"), member("c", "active")];
    const slice: Slice = { tenantId: T, where: [], level: "leaf" };
    const joint = firstCellValue(evaluateSlice(countMetric, slice, all, {} as never, ASOF).cells);
    const childrenSum = sumChildren(countMetric, [
      firstCellValue(evaluateSlice(countMetric, slice, all.slice(0, 2), {} as never, ASOF).cells),
      firstCellValue(evaluateSlice(countMetric, slice, all.slice(2), {} as never, ASOF).cells),
    ]);
    expect(childrenSum).toBe(joint);
  });
});

describe("no-sum guard (joint-recompute)", () => {
  const varMetric: AttributionMetric<number> & { aggregation: JointRecomputeSemantics } = {
    metricId: "var",
    resultKind: "scalar",
    readsFacets: [],
    stageScope: () => true,
    aggregation: { mode: "joint-recompute" },
    evaluate: (members) => members.length, // stand-in
  };

  it("assertNoSum throws for a joint-recompute metric", () => {
    expect(() => assertNoSum(varMetric)).toThrow(/joint-recompute/);
  });

  it("sumChildren throws for a joint-recompute metric", () => {
    expect(() => sumChildren(varMetric, [1, 2, 3])).toThrow();
  });

  it("the type forbids `add` on joint-recompute semantics (no member to call)", () => {
    // Compile-time guarantee: `varMetric.aggregation` has no `add`. This runtime
    // assertion documents that absence (the static gate asserts it on source).
    expect("add" in varMetric.aggregation).toBe(false);
    expect("zero" in varMetric.aggregation).toBe(false);
  });
});
