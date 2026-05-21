// tests/ba-325-lcr.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — exit-criterion tests
// for the BA 325 (LCR) generator + JSON renderer + per-account
// classification map + per-entity isolation + cap arithmetic.
//
// P1-fix (2026-05-12): cash flows now folded from FxSettlementInstructed /
// TradeMatured events in the event store (Principle 1 compliant).
// Tests updated to pass an event store + period window. Previously the tests
// passed account-level outflow/inflow rows; those are now replaced by
// settlement events.
//
// Asserts:
//   1. Semantic entries register with the SemanticRegistry.
//   2. Per-entity isolation: LE-ZA-HOZ-SECURITIES rejected.
//   3. HQLA cap arithmetic — closed-form, three regimes.
//   4. Inflow-cap binding — FxSettlementInstructed inflows > 75% of outflows.
//   5. Net-outflow floor binding — net < 25% of outflows.
//   6. Provenance passthrough — TrialBalanceSnapshotted.event_id flows
//      into Ba325Output.meta.trialBalanceSnapshotEventId.
//   7. Determinism — same generator output ⇒ byte-identical canonical JSON.
//   8. Schema validation — rendered output validates against Ba325RenderSchema.
//   9. Divide-by-zero — zero outflows ⇒ lcrRatio = Infinity, render encodes "infinity".
//  10. Liquidity-classification semantic entries register with the SemanticRegistry.
//  11. Deprecated outflow/inflow account entries produce a placeholder warning.
//
// Authority: D-REPORTING-CAPABILITY-SLICE-3 (under standing approval of
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Eitan (Treasurer,
//   governance — reports to Camille CFO; LCR methodology owner) · Anya
//   (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration) · Atlas (Core banking platform architect,
//   engineering — P1 fix).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { makeTradeMatured } from "../platform/event-store/event-types/trade-matured";
import { EventStore } from "../platform/event-store/store";
import { makeEquitySettlementInstructed } from "../platform/markets/cdm/equity";
import { makeFxSettlementInstructed } from "../platform/markets/cdm/fx";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  type AccountLiquidityClassification,
  BA_325_BANK_ENTITIES,
  BA_325_SCHEMA_URL,
  Ba325GeneratorError,
  Ba325RenderSchema,
  applyHqlaCaps,
  canonicaliseBa325,
  generateBa325Lcr,
  generateBa325LcrWithEvents,
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

const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";

// ---------------------------------------------------------------------------
// Provenance override — test fixture events are untagged (treated as simulated).
// D-PROVENANCE-FILTER-ENFORCEMENT changed the default to production-only, so
// unit tests that seed fixture events must opt into combined mode to see them.
// ---------------------------------------------------------------------------

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh in-memory event store for each test. */
function makeStore(): EventStore {
  return new EventStore(":memory:");
}

/** Helper: append a posting (mirrors the period-close test helper). */
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

/**
 * Append a ZAR FxSettlementInstructed event representing a cash outflow
 * (bank pays ZAR — negative netCash from bank's perspective).
 */
function appendSettlementOutflow(
  store: EventStore,
  args: { entity: string; asOf: string; amountMinor: number; tradeId: string },
): void {
  store.append(
    makeFxSettlementInstructed({
      asOf: args.asOf,
      entity: args.entity,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: args.tradeId },
        legKind: "near",
        settlementId: { scheme: "INTERNAL", value: `STL-${args.tradeId}-OUT` },
        settlementPath: "correspondent",
        settlementForm: "physical",
        correspondent: {
          partyId: "CP-001",
          name: "Test Correspondent",
          role: "settlement-agent",
          jurisdiction: "ZA",
        },
        counterparty: {
          partyId: "CP-001",
          name: "Test Counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        // Negative = bank pays (outflow).
        netCash: { currency: "ZAR", amountMinor: -args.amountMinor },
        settlementDate: { iso: "2026-05-05", calendar: "JIHCAL" },
        messageStandard: "ISO-20022-pacs.009",
      },
    }),
  );
}

/**
 * Append a ZAR FxSettlementInstructed event representing a cash inflow
 * (bank receives ZAR — positive netCash from bank's perspective).
 */
function appendSettlementInflow(
  store: EventStore,
  args: { entity: string; asOf: string; amountMinor: number; tradeId: string },
): void {
  store.append(
    makeFxSettlementInstructed({
      asOf: args.asOf,
      entity: args.entity,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: args.tradeId },
        legKind: "near",
        settlementId: { scheme: "INTERNAL", value: `STL-${args.tradeId}-IN` },
        settlementPath: "correspondent",
        settlementForm: "physical",
        correspondent: {
          partyId: "CP-001",
          name: "Test Correspondent",
          role: "settlement-agent",
          jurisdiction: "ZA",
        },
        counterparty: {
          partyId: "CP-001",
          name: "Test Counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        // Positive = bank receives (inflow).
        netCash: { currency: "ZAR", amountMinor: args.amountMinor },
        settlementDate: { iso: "2026-05-05", calendar: "JIHCAL" },
        messageStandard: "ISO-20022-pacs.009",
      },
    }),
  );
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
    const store = makeStore();
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_SECURITIES,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        eventStore: store,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(Ba325GeneratorError);
  });

  it("rejects an invalid functional currency", () => {
    const store = makeStore();
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZARS",
        eventStore: store,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
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
  function setupStore(): {
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

    // 2) Append synthetic postings for HQLA stock:
    //    - 1,000,000 cents into ACC-1100-001 (cash at SARB) from equity.
    //    - 200,000 cents into ACC-1100-001 from a customer-deposit stub.
    //    - 50,000 cents from ACC-1100-001 into a corporate-bond stub (Level-2A).
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

    // 3) Append a FxSettlementInstructed outflow — 50,000 ZAR (bank pays).
    //    This is the cash-flow denominator input per P1 fix.
    appendSettlementOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-20T10:00:00.000Z",
      amountMinor: 50_000,
      tradeId: "TRADE-E2E-001",
    });

    // 4) Close the period.
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
    const { store, trialBalanceSnapshotEventId, rows } = setupStore();
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
    ];

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: rows,
      classifications,
      trialBalanceSnapshotEventId,
    });

    // Trial-balance side: ACC-1100-001 net = +1,000,000 + 200,000 − 50,000 − 10,000 = 1,140,000
    expect(out.hqla.level1.stockMinor).toBe(1_140_000);
    expect(out.hqla.level2A.stockMinor).toBe(50_000);
    expect(out.hqla.level2B.stockMinor).toBeGreaterThan(0);

    // Outflows: 50,000 from FxSettlementInstructed (bank pays ZAR).
    expect(out.cashFlows.outflows.grossMinor).toBe(50_000);

    // No inflows in this scenario.
    expect(out.cashFlows.inflows.grossMinor).toBe(0);

    // Net cash outflows: no inflows so preFloor = 50k; floor = ceil(0.25*50k) = 12.5k → 13k;
    // preFloor (50k) > floor (13k) → floor not binding → netCashOutflows = 50k.
    expect(out.cashFlows.netCashOutflowsMinor).toBe(50_000);

    // LCR = 1,140,000-plus-some / 50,000 ≫ 1
    expect(out.lcrRatio).toBeGreaterThan(20);
    expect(out.lcrCompliant).toBe(true);

    // Provenance chain.
    expect(out.meta.trialBalanceSnapshotEventId).toBe(trialBalanceSnapshotEventId);

    // Citations include the regulatory anchors + P1-fix citations.
    expect(out.citations).toContain("Banks Act 94 of 1990 §70");
    expect(out.citations).toContain("Regulations Relating to Banks Reg 26");
    expect(out.citations).toContain("BCBS D295");
    expect(out.citations).toContain("Principles/1-events-are-truth.md");
  });

  it("renders to canonical JSON validating against Ba325RenderSchema", () => {
    const { store, trialBalanceSnapshotEventId, rows } = setupStore();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
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
  });

  it("canonicalisation is deterministic (byte-identical across runs)", () => {
    const { store, trialBalanceSnapshotEventId, rows } = setupStore();
    const input = {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
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
    const { store, rows } = setupStore();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: rows,
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });
    expect(out.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(out.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});

// =====================================================================
// 5. Inflow-cap + net-outflow-floor binding — via FxSettlement events.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — denominator caps and floors (P1-fix: event-sourced flows)", () => {
  /**
   * Build a store with:
   * - HQLA Level-1 stock from ACC-1100-001.
   * - FxSettlementInstructed outflow event for `outflowMinor` ZAR.
   * - FxSettlementInstructed inflow event for `inflowMinor` ZAR (if > 0).
   */
  function storeWithFlows(args: {
    outflowMinor: number;
    inflowMinor: number;
    cashMinor?: number;
  }): {
    store: EventStore;
    rows: Array<{ leafAccountId: string; currency: string; amountMinor: number }>;
    classifications: AccountLiquidityClassification[];
  } {
    const store = makeStore();

    // Outflow event.
    if (args.outflowMinor > 0) {
      appendSettlementOutflow(store, {
        entity: ENTITY_BANK,
        asOf: "2026-05-10T10:00:00.000Z",
        amountMinor: args.outflowMinor,
        tradeId: "TRADE-OUT-001",
      });
    }

    // Inflow event.
    if (args.inflowMinor > 0) {
      appendSettlementInflow(store, {
        entity: ENTITY_BANK,
        asOf: "2026-05-10T10:00:00.000Z",
        amountMinor: args.inflowMinor,
        tradeId: "TRADE-IN-001",
      });
    }

    const cashMinor = args.cashMinor ?? 100_000;
    return {
      store,
      rows: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: cashMinor }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" as const }],
    };
  }

  it("inflow-cap binds when gross inflows > 75% × gross outflows", () => {
    const { store, rows, classifications } = storeWithFlows({
      outflowMinor: 100_000,
      inflowMinor: 90_000,
    });
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
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
    const { store, rows, classifications } = storeWithFlows({
      outflowMinor: 100_000,
      inflowMinor: 50_000,
    });
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: rows,
      classifications,
    });
    expect(out.cashFlows.inflows.cappedMinor).toBe(50_000);
    expect(out.cashFlows.inflows.capBindingIndicator).toBe(false);
    // net = max(100k − 50k, 25k) = 50k (floor not binding)
    expect(out.cashFlows.netCashOutflowsMinor).toBe(50_000);
    expect(out.cashFlows.netCashOutflowFloorBindingIndicator).toBe(false);
  });

  it("net-outflow floor — inflow cap binds + inflows > outflows", () => {
    // Inflow cap binds at 75% AND inflows > outflows ⇒ net = 25k floor binds check.
    const { store, rows, classifications } = storeWithFlows({
      outflowMinor: 100_000,
      inflowMinor: 200_000,
    });
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: rows,
      classifications,
    });
    // 200k > 75k cap so capped at 75k. pre-floor net = 100k − 75k = 25k.
    // Floor = ceil(0.25*100k) = 25k. preFloorNet (25k) is NOT strictly < floor (25k); not binding.
    expect(out.cashFlows.netCashOutflowFloorBindingIndicator).toBe(false);
    expect(out.cashFlows.netCashOutflowsMinor).toBe(25_000);
  });

  it("zero outflows ⇒ infinite LCR; render encodes 'infinity'", () => {
    const store = makeStore();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });
    expect(out.lcrRatio).toBe(Number.POSITIVE_INFINITY);
    expect(out.lcrCompliant).toBe(true);
    const r = renderBa325ToJson(out, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(r.lcrRatio).toBe("infinity");
    expect(r.lcrPercent).toBe("infinity");
  });

  it("TradeMatured events also contribute to cash flows", () => {
    // Append a TradeMatured with a ZAR inflow and a USD outflow.
    // Only ZAR (functional ccy) leg should count; USD should be a placeholder.
    const store = makeStore();
    store.append(
      makeTradeMatured({
        asOf: "2026-05-10T12:00:00.000Z",
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productKind: "fx-spot",
          tradeId: "TRADE-CONF-001",
          currencyPair: "ZAR/USD",
          legKind: "near",
          // Bank receives ZAR 50,000 (+), pays USD 2,778 (−).
          settledBaseCurrencyMinor: 50_000, // ZAR inflow
          settledQuoteCurrencyMinor: -2_778, // USD outflow (non-functional)
          settledAt: "2026-05-10T12:00:00.000Z",
          nostroAccountBase: "ACC-1100-001",
          nostroAccountQuote: "ACC-1200-001",
          realisedPnlZarMinor: 0,
        },
      }),
    );

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    // ZAR leg counted as inflow; USD leg flagged as placeholder.
    expect(out.cashFlows.inflows.grossMinor).toBe(50_000);
    expect(out.cashFlows.outflows.grossMinor).toBe(0); // USD not counted
    expect(out.placeholders.some((p) => p.includes("foreign-currency"))).toBe(true);
  });
});

// =====================================================================
// 6. Render canonicaliser deterministic key sorting.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — canonicaliser determinism", () => {
  it("sorts object keys lexically; identical inputs ⇒ identical bytes", () => {
    const store = makeStore();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
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
  it("rejects duplicate HQLA classifications for the same account", () => {
    const store = makeStore();
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        eventStore: store,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        trialBalance: [],
        classifications: [
          { leafAccountId: "ACC-X", hqlaLevel: "level-1" },
          { leafAccountId: "ACC-X", hqlaLevel: "level-2a" },
        ],
      }),
    ).toThrow(/duplicate classification/);
  });

  it("rejects out-of-range Level-2B asset-specific factor", () => {
    const store = makeStore();
    expect(() =>
      generateBa325Lcr({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        eventStore: store,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        trialBalance: [{ leafAccountId: "ACC-X", currency: "ZAR", amountMinor: 100 }],
        classifications: [
          { leafAccountId: "ACC-X", hqlaLevel: "level-2b", assetSpecificFactor: 1.5 },
        ],
      }),
    ).toThrow(/assetSpecificFactor.*\[0,1\]/);
  });

  it("deprecated outflow/inflow entries produce a placeholder warning (not a throw)", () => {
    // Outflow/inflow account entries are now deprecated per P1 fix.
    // Generator should not throw but should surface a placeholder.
    const store = makeStore();
    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-X", currency: "ZAR", amountMinor: -100 }],
      classifications: [
        { leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" },
        // Deprecated outflow entry — should be ignored.
        { leafAccountId: "ACC-X", outflowRunOffRate: 0.25 },
      ],
    });
    // Deprecated entry does not contribute to outflows (events only now).
    expect(out.cashFlows.outflows.grossMinor).toBe(0);
    // Placeholder warning is surfaced.
    expect(out.placeholders.some((p) => p.includes("P1-fix deprecation"))).toBe(true);
  });
});

// =====================================================================
// 8. Equity settlement cash flows.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — equity settlement cash flows", () => {
  /**
   * Append an EquitySettlementInstructed outflow event.
   * netCash.amountMinor < 0 = bank pays (buys shares).
   */
  function appendEquityOutflow(
    store: EventStore,
    args: { entity: string; asOf: string; amountMinor: number; tradeId: string },
  ): void {
    store.append(
      makeEquitySettlementInstructed({
        asOf: args.asOf,
        entity: args.entity,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: { scheme: "INTERNAL", value: args.tradeId },
          settlementId: { scheme: "STRATE", value: `STRATE-${args.tradeId}` },
          // Negative = bank pays ZAR to receive shares (outflow).
          netCash: { currency: "ZAR", amountMinor: -args.amountMinor },
          netQuantity: { amount: 1_000, unit: "share" },
          settlementDate: { iso: "2026-05-10", calendar: "JIHCAL" },
          settlementVenue: "STRATE",
          counterparty: {
            partyId: "CP-JSE-001",
            name: "JSE Clearing Counterparty",
            role: "counterparty",
            jurisdiction: "ZA",
          },
        },
      }),
    );
  }

  /**
   * Append an EquitySettlementInstructed inflow event.
   * netCash.amountMinor > 0 = bank receives cash (sells shares).
   */
  function appendEquityInflow(
    store: EventStore,
    args: { entity: string; asOf: string; amountMinor: number; tradeId: string },
  ): void {
    store.append(
      makeEquitySettlementInstructed({
        asOf: args.asOf,
        entity: args.entity,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: { scheme: "INTERNAL", value: args.tradeId },
          settlementId: { scheme: "STRATE", value: `STRATE-${args.tradeId}` },
          // Positive = bank receives ZAR from selling shares (inflow).
          netCash: { currency: "ZAR", amountMinor: args.amountMinor },
          netQuantity: { amount: -1_000, unit: "share" }, // deliver
          settlementDate: { iso: "2026-05-10", calendar: "JIHCAL" },
          settlementVenue: "STRATE",
          counterparty: {
            partyId: "CP-JSE-001",
            name: "JSE Clearing Counterparty",
            role: "counterparty",
            jurisdiction: "ZA",
          },
        },
      }),
    );
  }

  it("equity outflow increases gross outflows (LCR denominator increases)", () => {
    const store = makeStore();
    // FX outflow: 20,000 ZAR.
    appendSettlementOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T10:00:00.000Z",
      amountMinor: 20_000,
      tradeId: "FX-OUT-001",
    });
    // Equity outflow: 5,000 ZAR.
    appendEquityOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T11:00:00.000Z",
      amountMinor: 5_000,
      tradeId: "EQ-OUT-001",
    });

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    // Total gross outflows = FX 20k + equity 5k = 25k.
    expect(out.cashFlows.outflows.grossMinor).toBe(25_000);
    // LCR should be lower than without equity outflow (100k HQLA / 25k vs 100k / 20k).
    expect(out.lcrRatio).toBeCloseTo(100_000 / 25_000, 3);
    expect(out.lcrCompliant).toBe(true);
  });

  it("FX-only regression guard: FX outflow alone produces correct LCR", () => {
    const store = makeStore();
    appendSettlementOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T10:00:00.000Z",
      amountMinor: 20_000,
      tradeId: "FX-ONLY-001",
    });

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    // Only FX outflow: 20k.
    expect(out.cashFlows.outflows.grossMinor).toBe(20_000);
    expect(out.lcrRatio).toBe(100_000 / 20_000);
  });

  it("equity inflow counted in inflow bucket", () => {
    const store = makeStore();
    appendSettlementOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T10:00:00.000Z",
      amountMinor: 100_000,
      tradeId: "FX-OUT-EQUTEST",
    });
    appendEquityInflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T11:00:00.000Z",
      amountMinor: 30_000,
      tradeId: "EQ-IN-001",
    });

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 200_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    // Equity inflow 30k counted; gross outflows 100k, gross inflows 30k.
    expect(out.cashFlows.outflows.grossMinor).toBe(100_000);
    expect(out.cashFlows.inflows.grossMinor).toBe(30_000);
    // net = max(100k - 30k, 25k) = 70k (inflow cap not binding: 30k < 75k).
    expect(out.cashFlows.netCashOutflowsMinor).toBe(70_000);
  });

  it("LCR < 1.0 when equity outflow drains HQLA below net outflows", () => {
    const store = makeStore();
    // HQLA = 1,000 (tiny); equity outflow = 5,000.
    appendEquityOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T10:00:00.000Z",
      amountMinor: 5_000,
      tradeId: "EQ-BREACH-001",
    });

    const out = generateBa325Lcr({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 1_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    // LCR = 1000 / 5000 = 0.20 → breached.
    expect(out.lcrRatio).toBeCloseTo(0.2, 5);
    expect(out.lcrCompliant).toBe(false);
  });
});

// =====================================================================
// 9. LCR event emission via generateBa325LcrWithEvents.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-3 — LCRRatioProjection + HQLACompositionDrift event emission", () => {
  it("emits LCRRatioProjection event after computing LCR", async () => {
    const store = makeStore();
    appendSettlementOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T10:00:00.000Z",
      amountMinor: 10_000,
      tradeId: "TRADE-EVENT-001",
    });

    const out = await generateBa325LcrWithEvents({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100_000 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    // The generator result is unchanged.
    expect(out.lcrRatio).toBeGreaterThan(1.0);
    expect(out.lcrCompliant).toBe(true);

    // LCRRatioProjection event must be in the store.
    let found = false;
    for (const event of store.replay({ type: "LCRRatioProjection" })) {
      found = true;
      const payload = event.payload as { lcrRatioPct: number; status: string };
      expect(payload.lcrRatioPct).toBeGreaterThan(100);
      expect(payload.status).toBe("above-minimum");
    }
    expect(found).toBe(true);
  });

  it("LCR < 1.0 emits LCRRatioProjection with status=below-minimum", async () => {
    const store = makeStore();
    appendSettlementOutflow(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T10:00:00.000Z",
      amountMinor: 10_000,
      tradeId: "TRADE-BREACH-001",
    });

    const out = await generateBa325LcrWithEvents({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      // HQLA = 500 < outflows 10k → LCR < 1.
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 500 }],
      classifications: [{ leafAccountId: "ACC-1100-001", hqlaLevel: "level-1" }],
    });

    expect(out.lcrCompliant).toBe(false);

    let found = false;
    for (const event of store.replay({ type: "LCRRatioProjection" })) {
      found = true;
      const payload = event.payload as { status: string };
      expect(payload.status).toBe("below-minimum");
    }
    expect(found).toBe(true);
  });

  it("emits HQLACompositionDrift when Level-1 share drops below 85%", async () => {
    // Level-1 = 70k (70%), Level-2A = 30k raw → 0.85*30k = 25.5k.
    // Post-cap total ≈ 95.5k. Level-1 share ≈ 73% → |73% - 90%| = 17pp > 5pp → drift alert.
    const store = makeStore();

    const out = await generateBa325LcrWithEvents({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [
        { leafAccountId: "ACC-L1", currency: "ZAR", amountMinor: 70_000 },
        { leafAccountId: "ACC-L2A", currency: "ZAR", amountMinor: 30_000 },
      ],
      classifications: [
        { leafAccountId: "ACC-L1", hqlaLevel: "level-1", subCategory: "level-1.cash-at-sarb" },
        {
          leafAccountId: "ACC-L2A",
          hqlaLevel: "level-2a",
          subCategory: "level-2a.corporate-bond",
        },
      ],
    });

    // Level-1 fraction < 85% — drift event expected.
    const l1Share = out.hqla.level1.contributionMinor / out.hqla.totalStockHqlaMinor;
    expect(l1Share).toBeLessThan(0.85);

    let driftFound = false;
    for (const event of store.replay({ type: "HQLACompositionDrift" })) {
      driftFound = true;
      const payload = event.payload as { severity: string; l1HQLAPct: number };
      expect(["warn", "breach"]).toContain(payload.severity);
      expect(payload.l1HQLAPct).toBeLessThan(85);
    }
    expect(driftFound).toBe(true);
  });

  it("no HQLACompositionDrift when Level-1 share is within ±5pp of baseline", async () => {
    // Level-1 = 92k, Level-2A = 0 → Level-1 share = 100% → |100% - 90%| = 10pp > 5pp actually triggers.
    // Use 87% which is 90% ± 3pp (within threshold).
    // Level-1 = 87k, Level-2A raw 13k → pre-cap = 0.85*13k = 11.05k.
    // Total ≈ 98.05k; Level-1 share ≈ 88.7% → |88.7% - 90%| = 1.3pp < 5pp → no drift.
    const store = makeStore();

    await generateBa325LcrWithEvents({
      entity: ENTITY_BANK,
      asOf: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [
        { leafAccountId: "ACC-L1", currency: "ZAR", amountMinor: 87_000 },
        { leafAccountId: "ACC-L2A", currency: "ZAR", amountMinor: 13_000 },
      ],
      classifications: [
        { leafAccountId: "ACC-L1", hqlaLevel: "level-1", subCategory: "level-1.cash-at-sarb" },
        {
          leafAccountId: "ACC-L2A",
          hqlaLevel: "level-2a",
          subCategory: "level-2a.corporate-bond",
        },
      ],
    });

    // No drift event should appear.
    let driftFound = false;
    for (const _event of store.replay({ type: "HQLACompositionDrift" })) {
      driftFound = true;
    }
    expect(driftFound).toBe(false);
  });
});
