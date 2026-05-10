// tests/ba-700-capital.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 — exit-criterion tests
// for the BA 700 (Capital Adequacy) generator + JSON renderer + per-account
// classification map + per-tier deductions + RWA inputs + per-entity
// isolation + buffer overlay.
//
// Asserts:
//   1. Capital-classification semantic entries register.
//   2. Per-entity isolation — Hoz Securities + Hoz Group rejected.
//   3. End-to-end:
//        synthetic SubLedgerPostingEmitted events
//          → openPeriod → closePeriod (Slice 2)
//          → generateBa700Capital (Slice 4)
//          → renderBa700ToJson (Slice 4)
//        produces known capital ratios.
//   4. Tier-stack arithmetic — netCET1 = grossCET1 − deductions; Tier 1 +
//      Total composition.
//   5. Required-minimum overlay — base + CCB + CCyB + D-SIB + Pillar-2A
//      sums correctly.
//   6. Compliance flags — strictly compares actual ≥ all-in-required.
//   7. Determinism — same generator output ⇒ byte-identical canonical JSON.
//   8. Schema validation — rendered output validates against
//      Ba700RenderSchema.
//   9. Divide-by-zero — zero RWA ⇒ ratios = Infinity, render encodes
//      "infinity"; compliant by convention.
//  10. Provenance passthrough — TrialBalanceSnapshotted.event_id flows
//      into Ba700Output.meta.trialBalanceSnapshotEventId; RWA computation
//      event_id flows into the render.
//  11. Generator boundary errors — duplicate classifications; deduction
//      currency mismatch; negative deduction; invalid buffer ratio; base-
//      ratio ordering.
//
// Authority: D-REPORTING-CAPABILITY-SLICE-4 (under standing approval of
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
// Source spec: Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-
//   build-proposal.md §6 Slice 4.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Atlas (Core
//   banking platform architect, engineering — substrate consult) · Anya
//   (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

import { describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import {
  type AccountCapitalClassification,
  BA_700_BANK_ENTITIES,
  BA_700_SCHEMA_URL,
  BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
  Ba700GeneratorError,
  Ba700RenderSchema,
  type BufferRequirements,
  type RegulatoryDeduction,
  type RwaDecomposition,
  canonicaliseBa700,
  computeRequiredMinimums,
  generateBa700Capital,
  renderBa700Canonical,
  renderBa700ToJson,
} from "../platform/reporting";
import {
  SLICE_1_ENTRIES,
  SLICE_4_CAPITAL_ENTRIES,
  SemanticRegistry,
  additionalTier1Capital,
  commonEquityTier1Capital,
  commonEquityTier1Ratio,
  regulatoryCapitalDeductions,
  riskWeightedAssets,
  tier1CapitalRatio,
  tier2Capital,
  totalCapitalRatio,
} from "../platform/semantic";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ENTITY_GROUP = "LE-ZA-HOZ-GROUP";

const ACTOR = { type: "service" as const, id: "agent:Bea" };

const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-4",
  "ORG-PR-04",
];

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

function appendPosting(
  store: EventStore,
  args: {
    entity: string;
    asOf: string;
    legs: ReadonlyArray<{
      debit: string;
      credit: string;
      currency: string;
      amountMinor: number;
    }>;
  },
): void {
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: ACTOR,
    citations: ["D-REPORTING-CAPABILITY-SLICE-4"],
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test" })),
      asOfDate: args.asOf,
      citations: ["D-REPORTING-CAPABILITY-SLICE-4"],
    },
  });
}

const FIXTURE_RWA: RwaDecomposition = {
  creditRwaMinor: 1_500_000_000,
  marketRwaMinor: 1_000_000_000,
  operationalRwaMinor: 500_000_000,
  source: "fixture-test",
};

// =====================================================================
// 1. Capital-classification semantic entries register.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — semantic entries register", () => {
  it("the eight capital entries register without error", () => {
    const reg = SemanticRegistry.from(SLICE_4_CAPITAL_ENTRIES);
    expect(reg.size()).toBe(8);
    expect(reg.resolve({ id: "CommonEquityTier1Capital" })).toBeDefined();
    expect(reg.resolve({ id: "AdditionalTier1Capital" })).toBeDefined();
    expect(reg.resolve({ id: "Tier2Capital" })).toBeDefined();
    expect(reg.resolve({ id: "RegulatoryCapitalDeductions" })).toBeDefined();
    expect(reg.resolve({ id: "RiskWeightedAssets" })).toBeDefined();
    expect(reg.resolve({ id: "CommonEquityTier1Ratio" })).toBeDefined();
    expect(reg.resolve({ id: "Tier1CapitalRatio" })).toBeDefined();
    expect(reg.resolve({ id: "TotalCapitalRatio" })).toBeDefined();
  });

  it("co-exists with Slice-1 entries in a combined registry", () => {
    const reg = SemanticRegistry.from([...SLICE_1_ENTRIES, ...SLICE_4_CAPITAL_ENTRIES]);
    expect(reg.size()).toBe(SLICE_1_ENTRIES.length + SLICE_4_CAPITAL_ENTRIES.length);
  });

  it("each new entry carries at least one resolved + one TBC citation per Q1", () => {
    for (const e of SLICE_4_CAPITAL_ENTRIES) {
      const tbcCount = e.citations.filter((c) => c.type === "tbc").length;
      const resolvedCount = e.citations.filter((c) => c.type !== "tbc").length;
      expect(tbcCount).toBeGreaterThanOrEqual(1);
      expect(resolvedCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("each new entry scopes to Hoz Bank only (bank-licence-bound)", () => {
    for (const e of SLICE_4_CAPITAL_ENTRIES) {
      expect(e.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    }
  });

  it("named exports match the array (export-shape coherence)", () => {
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(commonEquityTier1Capital);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(additionalTier1Capital);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(tier2Capital);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(regulatoryCapitalDeductions);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(riskWeightedAssets);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(commonEquityTier1Ratio);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(tier1CapitalRatio);
    expect(SLICE_4_CAPITAL_ENTRIES).toContain(totalCapitalRatio);
  });

  it("each ratio entry maps to a BA 700 cell", () => {
    for (const e of [commonEquityTier1Ratio, tier1CapitalRatio, totalCapitalRatio]) {
      expect(e.regulatoryCells?.some((c) => c.form === "BA 700")).toBe(true);
    }
  });
});

// =====================================================================
// 2. Per-entity isolation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — per-entity isolation", () => {
  it("BA_700_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_700_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_SECURITIES,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [],
        rwa: FIXTURE_RWA,
      }),
    ).toThrow(Ba700GeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP (consolidated lands at Slice 7)", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_GROUP,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [],
        rwa: FIXTURE_RWA,
      }),
    ).toThrow(Ba700GeneratorError);
  });

  it("rejects an invalid functional currency", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZARS",
        trialBalance: [],
        classifications: [],
        deductions: [],
        rwa: FIXTURE_RWA,
      }),
    ).toThrow(/ISO-4217/);
  });

  it("rejects negative RWA components", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [],
        rwa: { creditRwaMinor: -1, marketRwaMinor: 0, operationalRwaMinor: 0 },
      }),
    ).toThrow(/RWA components.*non-negative/);
  });
});

// =====================================================================
// 3. Required-minimum overlay arithmetic.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — computeRequiredMinimums", () => {
  it("default build-phase: base + 2.5% CCB only", () => {
    const m = computeRequiredMinimums(BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS);
    // 4.5% + 2.5% = 7.0%
    expect(m.cet1).toBeCloseTo(0.07, 6);
    expect(m.tier1).toBeCloseTo(0.085, 6);
    expect(m.total).toBeCloseTo(0.105, 6);
  });

  it("with all overlays: CCB 2.5% + CCyB 1% + D-SIB 1% + Pillar 2A 0.75%", () => {
    const overlay = 0.025 + 0.01 + 0.01 + 0.0075; // 5.25%
    const buffers: BufferRequirements = {
      baseCet1Ratio: 0.045,
      baseTier1Ratio: 0.06,
      baseTotalRatio: 0.08,
      capitalConservationBufferRatio: 0.025,
      counterCyclicalBufferRatio: 0.01,
      dSibSurchargeRatio: 0.01,
      pillar2ASurchargeRatio: 0.0075,
    };
    const m = computeRequiredMinimums(buffers);
    expect(m.cet1).toBeCloseTo(0.045 + overlay, 6);
    expect(m.tier1).toBeCloseTo(0.06 + overlay, 6);
    expect(m.total).toBeCloseTo(0.08 + overlay, 6);
  });
});

// =====================================================================
// 4. End-to-end: synthetic events → close → generate → render.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — end-to-end (events → close → BA 700)", () => {
  function setupClose(): {
    store: EventStore;
    trialBalanceSnapshotEventId: string;
    rows: ReadonlyArray<{
      leafAccountId: string;
      currency: string;
      amountMinor: number;
    }>;
  } {
    const store = new EventStore(":memory:");

    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: PERIOD_OPEN,
    });

    // Initial capital injection: 250,000,000 cents (R2.5m) into cash from
    // ordinary-share-capital account. This establishes a CET1-classified
    // credit balance on ACC-equity-position-stub.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-02T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-equity-position-stub",
          currency: "ZAR",
          amountMinor: 250_000_000,
        },
      ],
    });
    // Retained-earnings accrual: 50,000,000 cents (R0.5m) booked to
    // retained-earnings (CET1).
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-15T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-pl-revenue-stub",
          credit: "ACC-retained-earnings-stub",
          currency: "ZAR",
          amountMinor: 50_000_000,
        },
      ],
    });

    const close = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: PERIOD_OPEN.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
    });
    return {
      store,
      trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
      rows: close.trialBalance.rows,
    };
  }

  it("computes a known BA 700 from synthetic events; ratios well above minimum", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const classifications: AccountCapitalClassification[] = [
      {
        leafAccountId: "ACC-equity-position-stub",
        capitalTier: "cet1",
        subCategory: "cet1.paid-up-ordinary-shares",
      },
      {
        leafAccountId: "ACC-retained-earnings-stub",
        capitalTier: "cet1",
        subCategory: "cet1.retained-earnings",
      },
    ];
    // Goodwill deduction: 5,000,000 cents (R50k).
    const deductions: RegulatoryDeduction[] = [
      {
        deductionTier: "cet1",
        category: "goodwill",
        amountMinor: 5_000_000,
        currency: "ZAR",
        sourceAccountId: "ACC-goodwill-stub",
      },
    ];

    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
      deductions,
      rwa: FIXTURE_RWA,
      trialBalanceSnapshotEventId,
    });

    // Gross CET1 = 250,000,000 (equity) + 50,000,000 (retained earnings) = 300,000,000
    expect(out.capitalStack.cet1.grossStockMinor).toBe(300_000_000);
    expect(out.capitalStack.cet1.totalDeductionsMinor).toBe(5_000_000);
    // Net CET1 = 295,000,000
    expect(out.capitalStack.cet1.netStockMinor).toBe(295_000_000);
    // No AT1 / T2 issuance.
    expect(out.capitalStack.at1.netStockMinor).toBe(0);
    expect(out.capitalStack.t2.netStockMinor).toBe(0);
    // Net Tier 1 = CET1 (no AT1).
    expect(out.capitalStack.netTier1Minor).toBe(295_000_000);
    expect(out.capitalStack.netTotalCapitalMinor).toBe(295_000_000);

    // RWA = 1,500m + 1,000m + 500m = 3,000m
    expect(out.rwa.totalRwaMinor).toBe(3_000_000_000);

    // CET1 ratio = 295m / 3,000m = 9.833%
    expect(out.ratios.cet1Ratio).toBeCloseTo(295 / 3000, 6);
    expect(out.ratios.tier1Ratio).toBeCloseTo(295 / 3000, 6);
    expect(out.ratios.totalRatio).toBeCloseTo(295 / 3000, 6);

    // Required-minimum overlay (default build-phase): 7% / 8.5% / 10.5%
    expect(out.ratios.cet1RatioRequiredMinimum).toBeCloseTo(0.07, 6);
    expect(out.ratios.tier1RatioRequiredMinimum).toBeCloseTo(0.085, 6);
    expect(out.ratios.totalRatioRequiredMinimum).toBeCloseTo(0.105, 6);

    // 9.833% ≥ 7% ✓; 9.833% ≥ 8.5% ✓; but 9.833% < 10.5% ✗
    expect(out.ratios.cet1Compliant).toBe(true);
    expect(out.ratios.tier1Compliant).toBe(true);
    expect(out.ratios.totalCompliant).toBe(false);

    // Provenance.
    expect(out.meta.trialBalanceSnapshotEventId).toBe(trialBalanceSnapshotEventId);

    // Citations include the regulatory anchors.
    expect(out.citations).toContain("Banks Act 94 of 1990 §70");
    expect(out.citations).toContain("Regulations Relating to Banks Reg 38");
    expect(out.citations).toContain("BCBS Basel III §50–§90");
  });

  it("renders to canonical JSON validating against Ba700RenderSchema", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [
        {
          leafAccountId: "ACC-equity-position-stub",
          capitalTier: "cet1",
          subCategory: "cet1.paid-up-ordinary-shares",
        },
      ],
      deductions: [],
      rwa: FIXTURE_RWA,
      trialBalanceSnapshotEventId,
    });
    const renderedAt = "2026-05-10T15:00:00.000Z";
    const render = renderBa700ToJson(out, { renderedAt });

    expect(() => Ba700RenderSchema.parse(render)).not.toThrow();
    expect(render.$schema).toBe(BA_700_SCHEMA_URL);
    expect(render.meta.rendererVersion).toBe("v0.1");
    expect(render.meta.renderedAt).toBe(renderedAt);
    expect(render.capitalStack.cet1.tier).toBe("cet1");
    expect(render.capitalStack.at1.tier).toBe("at1");
    expect(render.capitalStack.t2.tier).toBe("t2");
    expect(render.ratios.cet1Compliant).toBe(true);
    // Percent strings render with two-decimal precision.
    expect(render.ratios.cet1Percent.endsWith("%")).toBe(true);
    expect(render.ratios.cet1RequiredMinimumPercent).toBe("7.00%");
  });

  it("canonicalisation is deterministic (byte-identical across runs)", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const input = {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [
        {
          leafAccountId: "ACC-equity-position-stub",
          capitalTier: "cet1" as const,
        },
      ],
      deductions: [],
      rwa: FIXTURE_RWA,
      trialBalanceSnapshotEventId,
    };
    const a = renderBa700Canonical(generateBa700Capital(input), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    const b = renderBa700Canonical(generateBa700Capital(input), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.canonicalBytes.length).toBe(b.canonicalBytes.length);
  });

  it("placeholders array is populated per Q1 (rehearsal-grade)", () => {
    const { rows } = setupClose();
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [{ leafAccountId: "ACC-equity-position-stub", capitalTier: "cet1" }],
      deductions: [],
      rwa: { ...FIXTURE_RWA, source: "fixture-rehearsal" },
    });
    expect(out.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(out.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
    // RWA-source placeholder fires when source is fixture-rehearsal.
    expect(out.placeholders.some((p) => p.includes("RWA inputs are fixture-grade"))).toBe(true);
  });

  it("does NOT fire RWA-source placeholder when source is supplied (non-fixture)", () => {
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [],
      classifications: [],
      deductions: [],
      rwa: { ...FIXTURE_RWA, source: "engine:w2-slice-3" },
    });
    expect(out.placeholders.some((p) => p.includes("RWA inputs are fixture-grade"))).toBe(false);
  });
});

// =====================================================================
// 5. Tier-stack arithmetic across all three tiers.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — full three-tier stack", () => {
  it("AT1 + T2 contribute to tier1 / total respectively", () => {
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-cet1", currency: "ZAR", amountMinor: -200_000_000 }, // credit
        { leafAccountId: "ACC-at1", currency: "ZAR", amountMinor: -50_000_000 },
        { leafAccountId: "ACC-t2", currency: "ZAR", amountMinor: -75_000_000 },
      ],
      classifications: [
        { leafAccountId: "ACC-cet1", capitalTier: "cet1", subCategory: "cet1.shares" },
        { leafAccountId: "ACC-at1", capitalTier: "at1", subCategory: "at1.pref-shares" },
        { leafAccountId: "ACC-t2", capitalTier: "t2", subCategory: "t2.sub-debt" },
      ],
      deductions: [
        { deductionTier: "cet1", category: "goodwill", amountMinor: 10_000_000, currency: "ZAR" },
        {
          deductionTier: "at1",
          category: "at1-investment",
          amountMinor: 5_000_000,
          currency: "ZAR",
        },
      ],
      rwa: { creditRwaMinor: 1_000_000_000, marketRwaMinor: 0, operationalRwaMinor: 0 },
    });

    expect(out.capitalStack.cet1.grossStockMinor).toBe(200_000_000);
    expect(out.capitalStack.cet1.netStockMinor).toBe(190_000_000); // 200 − 10
    expect(out.capitalStack.at1.netStockMinor).toBe(45_000_000); // 50 − 5
    expect(out.capitalStack.t2.netStockMinor).toBe(75_000_000); // no T2 deduction

    expect(out.capitalStack.netTier1Minor).toBe(235_000_000); // 190 + 45
    expect(out.capitalStack.netTotalCapitalMinor).toBe(310_000_000); // 235 + 75

    expect(out.ratios.cet1Ratio).toBeCloseTo(190 / 1000, 6);
    expect(out.ratios.tier1Ratio).toBeCloseTo(235 / 1000, 6);
    expect(out.ratios.totalRatio).toBeCloseTo(310 / 1000, 6);
  });

  it("net tier amount floored at 0 — deductions exceed gross stock", () => {
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-cet1", currency: "ZAR", amountMinor: -100_000_000 }],
      classifications: [{ leafAccountId: "ACC-cet1", capitalTier: "cet1" }],
      deductions: [
        { deductionTier: "cet1", category: "goodwill", amountMinor: 200_000_000, currency: "ZAR" },
      ],
      rwa: FIXTURE_RWA,
    });
    expect(out.capitalStack.cet1.netStockMinor).toBe(0);
    expect(out.ratios.cet1Compliant).toBe(false);
  });
});

// =====================================================================
// 6. Divide-by-zero — no RWA ⇒ infinity ratios.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — divide-by-zero RWA", () => {
  it("zero RWA ⇒ infinite ratios; render encodes 'infinity'; compliant", () => {
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-cet1", currency: "ZAR", amountMinor: -100_000_000 }],
      classifications: [{ leafAccountId: "ACC-cet1", capitalTier: "cet1" }],
      deductions: [],
      rwa: { creditRwaMinor: 0, marketRwaMinor: 0, operationalRwaMinor: 0 },
    });
    expect(out.ratios.cet1Ratio).toBe(Number.POSITIVE_INFINITY);
    expect(out.ratios.tier1Ratio).toBe(Number.POSITIVE_INFINITY);
    expect(out.ratios.totalRatio).toBe(Number.POSITIVE_INFINITY);
    expect(out.ratios.cet1Compliant).toBe(true);

    const r = renderBa700ToJson(out, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(r.ratios.cet1Ratio).toBe("infinity");
    expect(r.ratios.cet1Percent).toBe("infinity");
    expect(r.ratios.totalPercent).toBe("infinity");
  });
});

// =====================================================================
// 7. Canonicaliser determinism + key sorting.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — canonicaliser determinism", () => {
  it("sorts object keys lexically; identical inputs ⇒ identical bytes", () => {
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-cet1", currency: "ZAR", amountMinor: -1_000_000 }],
      classifications: [{ leafAccountId: "ACC-cet1", capitalTier: "cet1" }],
      deductions: [],
      rwa: FIXTURE_RWA,
    });
    const r1 = renderBa700ToJson(out, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const c1 = canonicaliseBa700(r1);
    const c2 = canonicaliseBa700(r1);
    expect(c1).toBe(c2);

    // Top-level: $schema first ($ < letters in ASCII).
    const lines = c1.split("\n");
    const firstKey = lines[1]?.trim().split(":")[0];
    expect(firstKey).toBe('"$schema"');
  });
});

// =====================================================================
// 8. Generator boundary errors.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — generator boundary errors", () => {
  it("rejects duplicate classifications for the same account", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [
          { leafAccountId: "ACC-X", capitalTier: "cet1" },
          { leafAccountId: "ACC-X", capitalTier: "at1" },
        ],
        deductions: [],
        rwa: FIXTURE_RWA,
      }),
    ).toThrow(/duplicate classification/);
  });

  it("rejects deduction in a non-functional currency", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [
          { deductionTier: "cet1", category: "goodwill", amountMinor: 1000, currency: "USD" },
        ],
        rwa: FIXTURE_RWA,
      }),
    ).toThrow(/Multi-currency deductions/);
  });

  it("rejects negative deduction amount", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [
          { deductionTier: "cet1", category: "goodwill", amountMinor: -1, currency: "ZAR" },
        ],
        rwa: FIXTURE_RWA,
      }),
    ).toThrow(/non-negative/);
  });

  it("rejects buffer ratio outside [0,1]", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [],
        rwa: FIXTURE_RWA,
        bufferRequirements: {
          ...BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
          capitalConservationBufferRatio: 1.5,
        },
      }),
    ).toThrow(/finite ratio in \[0,1\]/);
  });

  it("rejects base-ratio ordering violation", () => {
    expect(() =>
      generateBa700Capital({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
        deductions: [],
        rwa: FIXTURE_RWA,
        bufferRequirements: {
          ...BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
          baseCet1Ratio: 0.1,
          baseTier1Ratio: 0.06,
          baseTotalRatio: 0.08,
        },
      }),
    ).toThrow(/base-ratio ordering/);
  });
});

// =====================================================================
// 9. Provenance — RWA computation event chain.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-4 — RWA provenance passthrough", () => {
  it("rwaComputationEventId flows from input through render", () => {
    const out = generateBa700Capital({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-cet1", currency: "ZAR", amountMinor: -100_000_000 }],
      classifications: [{ leafAccountId: "ACC-cet1", capitalTier: "cet1" }],
      deductions: [],
      rwa: { ...FIXTURE_RWA, rwaComputationEventId: "ev-rwa-12345", source: "engine:w2-slice-3" },
    });
    expect(out.rwa.rwaComputationEventId).toBe("ev-rwa-12345");
    expect(out.rwa.source).toBe("engine:w2-slice-3");

    const r = renderBa700ToJson(out, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(r.rwa.rwaComputationEventId).toBe("ev-rwa-12345");
  });
});
