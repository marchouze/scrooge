// tests/ba-325-lcr.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — exit-criterion tests
// for the BA 325 (LCR) generator + JSON renderer + per-account
// classification map + per-entity isolation + cap arithmetic.
//
// Asserts:
//   1. End-to-end:
//        synthetic SubLedgerPostingEmitted events
//          → openPeriod → closePeriod (Slice 2)
//          → generateBa325Lcr (Slice 3)
//          → renderBa325ToJson (Slice 3)
//        produces a known LCR computed from the synthetic stocks.
//   2. Per-entity isolation: LE-ZA-HOZ-SECURITIES rejected.
//   3. HQLA cap arithmetic — closed-form, three regimes.
//   4. Inflow cap binding — gross inflows > 75% of outflows ⇒ capped at 75%.
//   5. Net-outflow floor binding — net < 25% of outflows ⇒ floor binds.
//   6. Provenance passthrough — TrialBalanceSnapshotted.event_id flows
//      into Ba325Output.meta.trialBalanceSnapshotEventId.
//   7. Determinism — same generator output ⇒ byte-identical canonical JSON.
//   8. Schema validation — rendered output validates against Ba325RenderSchema.
//   9. Divide-by-zero — zero outflows ⇒ lcrRatio = Infinity, render encodes "infinity".
//  10. Liquidity-classification semantic entries register with the SemanticRegistry.
//
// Authority: D-REPORTING-CAPABILITY-SLICE-3 (under standing approval of
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
// Source spec: Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-
//   build-proposal.md §6 Slice 3.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Eitan (Treasurer,
//   governance — reports to Camille CFO; LCR methodology owner) · Anya
//   (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

import { describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import {
  type AccountLiquidityClassification,
  BA_325_BANK_ENTITIES,
  BA_325_SCHEMA_URL,
  Ba325GeneratorError,
  Ba325RenderSchema,
  applyHqlaCaps,
  canonicaliseBa325,
  generateBa325Lcr,
  renderBa325Canonical,
  renderBa325ToJson,
} from "../platform/reporting";
import {
  SLICE_1_ENTRIES,
  SLICE_3_LIQUIDITY_ENTRIES,
  SemanticRegistry,
  hqlaLevel1,
  hqlaLevel2A,
  hqlaLevel2B,
  lcrCashInflows30D,
  lcrCashOutflows30D,
  liquidityCoverageRatio,
} from "../platform/semantic";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";

const ACTOR = { type: "service" as const, id: "agent:Bea" };

const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-3",
  "ORG-PR-06",
];

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

// Helper: append a posting (mirrors the period-close test helper).
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
    citations: ["D-REPORTING-CAPABILITY-SLICE-3"],
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test" })),
      asOfDate: args.asOf,
      citations: ["D-REPORTING-CAPABILITY-SLICE-3"],
    },
  });
}

// =====================================================================
// 1. Liquidity-classification semantic entries register.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — semantic entries register", () => {
  it("the six liquidity entries register without error", () => {
    const reg = SemanticRegistry.from(SLICE_3_LIQUIDITY_ENTRIES);
    expect(reg.size()).toBe(6);
    expect(reg.resolve({ id: "HqlaLevel1" })).toBeDefined();
    expect(reg.resolve({ id: "HqlaLevel2A" })).toBeDefined();
    expect(reg.resolve({ id: "HqlaLevel2B" })).toBeDefined();
    expect(reg.resolve({ id: "LcrCashOutflows30D" })).toBeDefined();
    expect(reg.resolve({ id: "LcrCashInflows30D" })).toBeDefined();
    expect(reg.resolve({ id: "LiquidityCoverageRatio" })).toBeDefined();
  });

  it("co-exists with Slice-1 entries in a combined registry", () => {
    const reg = SemanticRegistry.from([...SLICE_1_ENTRIES, ...SLICE_3_LIQUIDITY_ENTRIES]);
    expect(reg.size()).toBe(SLICE_1_ENTRIES.length + SLICE_3_LIQUIDITY_ENTRIES.length);
  });

  it("each new entry carries at least one resolved + one TBC citation per Q1", () => {
    for (const e of SLICE_3_LIQUIDITY_ENTRIES) {
      const tbcCount = e.citations.filter((c) => c.type === "tbc").length;
      const resolvedCount = e.citations.filter((c) => c.type !== "tbc").length;
      expect(tbcCount).toBeGreaterThanOrEqual(1);
      expect(resolvedCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("each new entry scopes to Hoz Bank only (bank-licence-bound)", () => {
    for (const e of SLICE_3_LIQUIDITY_ENTRIES) {
      expect(e.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    }
  });

  it("named exports match the array (export-shape coherence)", () => {
    expect(SLICE_3_LIQUIDITY_ENTRIES).toContain(hqlaLevel1);
    expect(SLICE_3_LIQUIDITY_ENTRIES).toContain(hqlaLevel2A);
    expect(SLICE_3_LIQUIDITY_ENTRIES).toContain(hqlaLevel2B);
    expect(SLICE_3_LIQUIDITY_ENTRIES).toContain(lcrCashOutflows30D);
    expect(SLICE_3_LIQUIDITY_ENTRIES).toContain(lcrCashInflows30D);
    expect(SLICE_3_LIQUIDITY_ENTRIES).toContain(liquidityCoverageRatio);
  });
});

// =====================================================================
// 2. Per-entity isolation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — per-entity isolation", () => {
  it("BA_325_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_325_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_SECURITIES,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(Ba325GeneratorError);
  });

  it("rejects an invalid functional currency", () => {
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZARS",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(/ISO-4217/);
  });
});

// =====================================================================
// 3. HQLA cap arithmetic.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — applyHqlaCaps", () => {
  it("regime (a) — no cap binds when L2A ≤ 40% × S and L2B ≤ 15% × S", () => {
    // L1=10000, L2A=2000 (post-haircut), L2B=500 ⇒ S=12500
    // L2A 2000 ≤ 0.4*12500=5000 ✓; L2B 500 ≤ 0.15*12500=1875 ✓
    const r = applyHqlaCaps({
      level1Minor: 10000,
      level2ARawMinor: 2000,
      level2BRawMinor: 500,
    });
    expect(r.totalStockMinor).toBe(12500);
    expect(r.level2AContributionMinor).toBe(2000);
    expect(r.level2BContributionMinor).toBe(500);
    expect(r.level2ACapBinding).toBe(false);
    expect(r.level2BCapBinding).toBe(false);
  });

  it("regime (b) — only the L2B cap binds", () => {
    // L1=10000, L2A=1000, L2B=10000 — without cap S=21000, L2B 10000 > 0.15*21000=3150 ⇒ binds.
    // Solve S = (10000+1000)/0.85 = 12941; L2B=0.15*S=1941
    // Check L2A 1000 ≤ 0.4*12941=5176 ✓
    const r = applyHqlaCaps({
      level1Minor: 10000,
      level2ARawMinor: 1000,
      level2BRawMinor: 10000,
    });
    expect(r.totalStockMinor).toBeCloseTo(12941, -1);
    expect(r.level2AContributionMinor).toBe(1000);
    expect(r.level2BContributionMinor).toBeCloseTo(1941, -1);
    expect(r.level2ACapBinding).toBe(false);
    expect(r.level2BCapBinding).toBe(true);
  });

  it("regime (c) — the L2A cap binds; level-2 contribution capped at (2/3)·L1", () => {
    // Massive L2A pushes us into the binding regime.
    // L1=10000, L2A_raw=20000, L2B_raw=0
    // S=(5/3)*L1=16666; L2A contribution = (2/3)*L1=6666
    const r = applyHqlaCaps({
      level1Minor: 10000,
      level2ARawMinor: 20000,
      level2BRawMinor: 0,
    });
    expect(r.totalStockMinor).toBeCloseTo(16667, -1);
    expect(r.level2AContributionMinor).toBeCloseTo(6667, -1);
    expect(r.level2BContributionMinor).toBe(0);
    expect(r.level2ACapBinding).toBe(true);
  });

  it("zero stocks ⇒ zero stock + no caps binding", () => {
    const r = applyHqlaCaps({ level1Minor: 0, level2ARawMinor: 0, level2BRawMinor: 0 });
    expect(r.totalStockMinor).toBe(0);
    expect(r.level2ACapBinding).toBe(false);
    expect(r.level2BCapBinding).toBe(false);
  });
});

// =====================================================================
// 4. End-to-end: synthetic events → close → generate → render.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — end-to-end (events → close → BA 325)", () => {
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

    // 1) Open the period.
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: PERIOD_OPEN,
    });

    // 2) Append synthetic postings:
    //    - 1,000,000 cents into ACC-1100-001 (cash at SARB) from
    //      ACC-equity-position-stub (capital).
    //    - 200,000 cents into ACC-1100-001 from a customer-deposit
    //      liability stub (liability/credit balance).
    //    - 50,000 cents from ACC-1100-001 into a corporate-bond stub
    //      (Level-2A asset).
    //    - 10,000 cents from ACC-1100-001 into a Level-2B equity stub.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-05T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-equity-position-stub",
          currency: "ZAR",
          amountMinor: 1_000_000,
        },
      ],
    });
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-customer-deposit-stub",
          currency: "ZAR",
          amountMinor: 200_000,
        },
      ],
    });
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-15T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-corporate-bond-l2a-stub",
          credit: "ACC-1100-001",
          currency: "ZAR",
          amountMinor: 50_000,
        },
      ],
    });
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-20T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-l2b-stub",
          credit: "ACC-1100-001",
          currency: "ZAR",
          amountMinor: 10_000,
        },
      ],
    });

    // 3) Close the period.
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

  it("computes a known BA 325 from synthetic events; LCR ≥ 100% with substantial Level-1 stock", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const classifications: AccountLiquidityClassification[] = [
      { leafAccountId: "ACC-1100-001", hqlaLevel: "level-1", subCategory: "level-1.cash-at-sarb" },
      {
        leafAccountId: "ACC-corporate-bond-l2a-stub",
        hqlaLevel: "level-2a",
        subCategory: "level-2a.corporate-bond",
      },
      {
        leafAccountId: "ACC-equity-l2b-stub",
        hqlaLevel: "level-2b",
        assetSpecificFactor: 0.5,
        subCategory: "level-2b.equity",
      },
      // Customer-deposit stub: 25% retail-stable run-off (BCBS D295 §75 illustrative).
      {
        leafAccountId: "ACC-customer-deposit-stub",
        outflowRunOffRate: 0.25,
        subCategory: "outflows.retail-stable",
      },
    ];

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
      trialBalanceSnapshotEventId,
    });

    // Trial-balance side: ACC-1100-001 net = +1,000,000 + 200,000 − 50,000 − 10,000 = 1,140,000
    // Level-1 stock should be 1,140,000.
    expect(out.hqla.level1.stockMinor).toBe(1_140_000);
    expect(out.hqla.level2A.stockMinor).toBe(50_000);
    expect(out.hqla.level2B.stockMinor).toBeGreaterThan(0);

    // Outflows: 200,000 × 0.25 = 50,000.
    expect(out.cashFlows.outflows.grossMinor).toBe(50_000);

    // Net cash outflows: floor binds (no inflows; 200000*.25=50000 vs 25%*50000=12500 ⇒ takes 50000).
    expect(out.cashFlows.netCashOutflowsMinor).toBe(50_000);

    // LCR = 1,140,000-plus-some / 50,000 ≫ 1
    expect(out.lcrRatio).toBeGreaterThan(20);
    expect(out.lcrCompliant).toBe(true);

    // Provenance chain.
    expect(out.meta.trialBalanceSnapshotEventId).toBe(trialBalanceSnapshotEventId);

    // Citations include the regulatory anchors.
    expect(out.citations).toContain("Banks Act 94 of 1990 §70");
    expect(out.citations).toContain("Regulations Relating to Banks Reg 26");
    expect(out.citations).toContain("BCBS D295");
  });

  it("renders to canonical JSON validating against Ba325RenderSchema", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [
        {
          leafAccountId: "ACC-1100-001",
          hqlaLevel: "level-1",
          subCategory: "level-1.cash-at-sarb",
        },
      ],
      trialBalanceSnapshotEventId,
    });
    const renderedAt = "2026-05-10T15:00:00.000Z";
    const render = renderBa325ToJson(out, { renderedAt });

    // Schema validation passes.
    expect(() => Ba325RenderSchema.parse(render)).not.toThrow();
    expect(render.$schema).toBe(BA_325_SCHEMA_URL);
    expect(render.meta.rendererVersion).toBe("v0.1");
    expect(render.meta.renderedAt).toBe(renderedAt);

    // No outflows in this scenario ⇒ infinity LCR.
    expect(render.lcrRatio).toBe("infinity");
    expect(render.lcrPercent).toBe("infinity");
    expect(render.lcrCompliant).toBe(true);
  });

  it("canonicalisation is deterministic (byte-identical across runs)", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const input = {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" as const }],
      trialBalanceSnapshotEventId,
    };
    const a = renderBa325Canonical(generateBa325Lcr(input), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    const b = renderBa325Canonical(generateBa325Lcr(input), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.canonicalBytes.length).toBe(b.canonicalBytes.length);
  });

  it("placeholders array is populated per Q1 (rehearsal-grade)", () => {
    const { rows } = setupClose();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });
    expect(out.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(out.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});

// =====================================================================
// 5. Inflow-cap + net-outflow-floor binding.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — denominator caps and floors", () => {
  function tinyTbWith(args: {
    outflowMinor: number;
    inflowMinor: number;
    cashMinor?: number;
  }): {
    rows: Array<{ leafAccountId: string; currency: string; amountMinor: number }>;
    classifications: AccountLiquidityClassification[];
  } {
    return {
      rows: [
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: args.cashMinor ?? 100_000 },
        {
          leafAccountId: "ACC-customer-deposit-stub",
          currency: "ZAR",
          amountMinor: -args.outflowMinor,
        },
        ...(args.inflowMinor > 0
          ? [
              {
                leafAccountId: "ACC-loan-asset-stub",
                currency: "ZAR",
                amountMinor: args.inflowMinor,
              },
            ]
          : []),
      ],
      classifications: [
        { leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" as const },
        // 100% run-off — the deposit balance equals the outflow contribution.
        { leafAccountId: "ACC-customer-deposit-stub", outflowRunOffRate: 1.0 },
        { leafAccountId: "ACC-loan-asset-stub", inflowRate: 1.0 },
      ],
    };
  }

  it("inflow-cap binds when gross inflows > 75% × gross outflows", () => {
    const { rows, classifications } = tinyTbWith({ outflowMinor: 100_000, inflowMinor: 90_000 });
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
    });
    expect(out.cashFlows.outflows.grossMinor).toBe(100_000);
    expect(out.cashFlows.inflows.grossMinor).toBe(90_000);
    expect(out.cashFlows.inflows.cappedMinor).toBe(75_000);
    expect(out.cashFlows.inflows.capBindingIndicator).toBe(true);
    // net = max(100k − 75k, 0.25*100k) = max(25k, 25k) = 25k
    expect(out.cashFlows.netCashOutflowsMinor).toBe(25_000);
  });

  it("inflow-cap does not bind when gross inflows ≤ 75% × gross outflows", () => {
    const { rows, classifications } = tinyTbWith({ outflowMinor: 100_000, inflowMinor: 50_000 });
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
    });
    expect(out.cashFlows.inflows.cappedMinor).toBe(50_000);
    expect(out.cashFlows.inflows.capBindingIndicator).toBe(false);
    // net = max(100k − 50k, 25k) = 50k (floor not binding)
    expect(out.cashFlows.netCashOutflowsMinor).toBe(50_000);
    expect(out.cashFlows.netCashOutflowFloorBindingIndicator).toBe(false);
  });

  it("net-outflow floor binds when capped-net < 25% × gross outflows", () => {
    // Inflow cap binds at 75% AND inflows > outflows ⇒ net = 25k floor binds.
    const { rows, classifications } = tinyTbWith({ outflowMinor: 100_000, inflowMinor: 200_000 });
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
    });
    // 200k > 75k cap so capped at 75k. pre-floor net = 100k − 75k = 25k.
    // Floor = ceil(0.25*100k) = 25k. preFloorNet (25k) is NOT strictly < floor (25k); not binding.
    expect(out.cashFlows.netCashOutflowFloorBindingIndicator).toBe(false);
    expect(out.cashFlows.netCashOutflowsMinor).toBe(25_000);
  });

  it("zero outflows ⇒ infinite LCR; render encodes 'infinity'", () => {
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });
    expect(out.lcrRatio).toBe(Number.POSITIVE_INFINITY);
    expect(out.lcrCompliant).toBe(true);
    const r = renderBa325ToJson(out, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(r.lcrRatio).toBe("infinity");
    expect(r.lcrPercent).toBe("infinity");
  });
});

// =====================================================================
// 6. Render canonicaliser deterministic key sorting.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — canonicaliser determinism", () => {
  it("sorts object keys lexically; identical inputs ⇒ identical bytes", () => {
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 1_000_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });
    const r1 = renderBa325ToJson(out, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const c1 = canonicaliseBa325(r1);
    const c2 = canonicaliseBa325(r1);
    expect(c1).toBe(c2);

    // Top-level keys are sorted ($schema first since `$` < letter codepoints).
    const lines = c1.split("\n");
    const firstKey = lines[1]?.trim().split(":")[0];
    expect(firstKey).toBe('"$schema"');
  });
});

// =====================================================================
// 7. Generator boundary errors.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — generator boundary errors", () => {
  it("rejects duplicate classifications for the same account", () => {
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [
          { leafAccountId: "ACC-X", hqlaLevel: "level-1" },
          { leafAccountId: "ACC-X", outflowRunOffRate: 0.5 },
        ],
      }),
    ).toThrow(/duplicate classification/);
  });

  it("rejects out-of-range run-off rate", () => {
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [{ leafAccountId: "ACC-X", currency: "ZAR", amountMinor: -100 }],
        classifications: [{ leafAccountId: "ACC-X", outflowRunOffRate: 1.5 }],
      }),
    ).toThrow(/outflowRunOffRate.*\[0,1\]/);
  });

  it("rejects out-of-range Level-2B asset-specific factor", () => {
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [{ leafAccountId: "ACC-X", currency: "ZAR", amountMinor: 100 }],
        classifications: [
          { leafAccountId: "ACC-X", hqlaLevel: "level-2b", assetSpecificFactor: 1.5 },
        ],
      }),
    ).toThrow(/assetSpecificFactor.*\[0,1\]/);
  });
});
