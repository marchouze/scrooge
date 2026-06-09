// platform/returns/ba700/ba100.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 — scenario test for the
// BA 100 Capital Adequacy Return generator and period-close subscriber.
//
// This test file exercises the `returns/ba700/` package — the thin
// mission-spec overlay on top of the canonical `platform/reporting/`
// generator.  The canonical generator's own tests live at
// `tests/ba-100-capital.test.ts`.
//
// Asserts:
//   1. `generateBA700Return` produces a `BA700Return` with all required
//      sections present and non-NaN.
//   2. `capitalAdequacy.carRatio >= 0` for all build-phase scenarios.
//   3. `status` is one of the three typed values.
//   4. `placeholders` is populated (rehearsal-grade per Q1 default).
//   5. Period-close subscriber processes bank entity and returns a result.
//   6. Subscriber no-ops for non-bank entity (LE-ZA-HOZ-SECURITIES).
//   7. `replayAndGenerate` returns one result per closed period.
//
// Authority: D-REPORTING-CAPABILITY-SLICE-4 (under standing approval of
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   capital-stack accountable signer).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../../accounting/period-close";
import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import type { RwaDecomposition } from "../../reporting/ba-700-capital";
import { generateBA700Return } from "./generator";
import {
  BA_100_SUBSCRIBER_ENTITIES,
  onAccountingPeriodClosed,
  replayAndGenerate,
} from "./period-close-subscriber";

// ---------------------------------------------------------------------------
// Provenance override — test events are untagged (simulated).
// ---------------------------------------------------------------------------

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
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

/** Fixture RWA — caller-supplied at v0 (W2 Slice 3 engine is a substrate gap). */
const FIXTURE_RWA: RwaDecomposition = {
  creditRwaMinor: 1_500_000_000,
  marketRwaMinor: 500_000_000,
  operationalRwaMinor: 500_000_000,
  source: "fixture-rehearsal",
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
    citations: CITATIONS,
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test" })),
      asOfDate: args.asOf,
      citations: CITATIONS,
    },
  });
}

/**
 * Set up a store with an open + populated period + a period close.
 * Returns the store and the closed-period metadata.
 */
function setupPeriod(): {
  store: EventStore;
  periodId: string;
  closedAt: string;
  periodStart: string;
  periodEnd: string;
} {
  const store = new EventStore(":memory:");

  openPeriod({
    eventStore: store,
    entity: ENTITY_BANK,
    actor: ACTOR,
    citations: CITATIONS,
    payload: PERIOD_OPEN,
  });

  // Capital injection: R2.5m (250,000,000 cents) paid-up shares.
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

  // Retained earnings accrual: R0.5m (50,000,000 cents).
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

  closePeriod({
    eventStore: store,
    entity: ENTITY_BANK,
    periodId: PERIOD_OPEN.periodId,
    closedAt: "2026-06-01T00:00:00.000Z",
    actor: ACTOR,
    citations: CITATIONS,
  });

  return {
    store,
    periodId: PERIOD_OPEN.periodId,
    closedAt: "2026-06-01T00:00:00.000Z",
    periodStart: PERIOD_OPEN.periodStart,
    periodEnd: PERIOD_OPEN.periodEnd,
  };
}

// ---------------------------------------------------------------------------
// 1. generateBA700Return — all sections present + non-NaN
// ---------------------------------------------------------------------------

describe("D-REPORTING-CAPABILITY-SLICE-4 returns/ba700 — generateBA700Return", () => {
  it("produces a BA700Return with all required sections present and non-NaN", () => {
    const { store, periodId, closedAt, periodStart, periodEnd } = setupPeriod();

    const { return: result } = generateBA700Return({
      entityId: ENTITY_BANK,
      reportingDate: closedAt,
      periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart,
      periodEnd,
      classifications: [
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
      ],
      deductions: [],
      rwa: FIXTURE_RWA,
    });

    // Meta
    expect(result.meta.form).toBe("BA 700");
    expect(result.meta.entity).toBe(ENTITY_BANK);
    expect(result.meta.reportingDate).toBe(closedAt);
    expect(result.meta.periodId).toBe(periodId);
    expect(result.meta.functionalCurrency).toBe("ZAR");

    // capitalAdequacy — all cells non-NaN
    expect(Number.isNaN(result.capitalAdequacy.tier1Capital)).toBe(false);
    expect(Number.isNaN(result.capitalAdequacy.tier2Capital)).toBe(false);
    expect(Number.isNaN(result.capitalAdequacy.rwa)).toBe(false);
    expect(Number.isNaN(result.capitalAdequacy.carRatio)).toBe(false);

    // carRatio >= 0
    expect(result.capitalAdequacy.carRatio).toBeGreaterThanOrEqual(0);

    // balanceSheet — all cells non-NaN
    expect(Number.isNaN(result.balanceSheet.totalAssets)).toBe(false);
    expect(Number.isNaN(result.balanceSheet.totalLiabilities)).toBe(false);
    expect(Number.isNaN(result.balanceSheet.equity)).toBe(false);

    // incomeStatement — all cells non-NaN
    expect(Number.isNaN(result.incomeStatement.netInterestIncome)).toBe(false);
    expect(Number.isNaN(result.incomeStatement.nonInterestIncome)).toBe(false);
    expect(Number.isNaN(result.incomeStatement.operatingExpenses)).toBe(false);
    expect(Number.isNaN(result.incomeStatement.netProfit)).toBe(false);

    // offBalanceSheet — all cells non-NaN
    expect(Number.isNaN(result.offBalanceSheet.guarantees)).toBe(false);
    expect(Number.isNaN(result.offBalanceSheet.commitments)).toBe(false);
    expect(Number.isNaN(result.offBalanceSheet.derivatives)).toBe(false);

    // status is a typed value
    expect(["compliant", "breach", "insufficient-data"]).toContain(result.status);

    // placeholders populated (rehearsal-grade per Q1 default)
    expect(result.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(result.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });

  it("carRatio is non-negative and finite (or +Infinity for zero-RWA case)", () => {
    const { store, periodId, closedAt, periodStart, periodEnd } = setupPeriod();
    const { return: result } = generateBA700Return({
      entityId: ENTITY_BANK,
      reportingDate: closedAt,
      periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart,
      periodEnd,
      classifications: [{ leafAccountId: "ACC-equity-position-stub", capitalTier: "cet1" }],
      deductions: [],
      rwa: { creditRwaMinor: 0, marketRwaMinor: 0, operationalRwaMinor: 0 },
    });
    // Zero RWA → Infinity; not NaN, not negative
    expect(result.capitalAdequacy.carRatio).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(result.capitalAdequacy.carRatio)).toBe(false);
  });

  it("returns rawOutput alongside the BA700Return", () => {
    const { store, periodId, closedAt, periodStart, periodEnd } = setupPeriod();
    const { return: ba100Return, rawOutput } = generateBA700Return({
      entityId: ENTITY_BANK,
      reportingDate: closedAt,
      periodId,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart,
      periodEnd,
      classifications: [{ leafAccountId: "ACC-equity-position-stub", capitalTier: "cet1" }],
      deductions: [],
      rwa: FIXTURE_RWA,
    });
    expect(rawOutput).toBeDefined();
    expect(rawOutput.meta.form).toBe("BA 700");
    // carRatio should equal rawOutput.ratios.totalRatio
    expect(ba100Return.capitalAdequacy.carRatio).toBe(rawOutput.ratios.totalRatio);
  });
});

// ---------------------------------------------------------------------------
// 2. status derivation
// ---------------------------------------------------------------------------

describe("D-REPORTING-CAPABILITY-SLICE-4 returns/ba700 — status", () => {
  it("status is 'insufficient-data' when RWA source is fixture-rehearsal and balance-sheet placeholder zeros", () => {
    const store = new EventStore(":memory:");
    const { return: result } = generateBA700Return({
      entityId: ENTITY_BANK,
      reportingDate: "2026-05-31T23:59:59.999Z",
      periodId: "period:hoz-bank:month:2026-05",
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-05-31T23:59:59.999Z",
      classifications: [],
      deductions: [],
      rwa: { ...FIXTURE_RWA, source: "fixture-rehearsal" },
    });
    expect(result.status).toBe("insufficient-data");
  });
});

// ---------------------------------------------------------------------------
// 3. Period-close subscriber
// ---------------------------------------------------------------------------

describe("D-REPORTING-CAPABILITY-SLICE-4 returns/ba700 — onAccountingPeriodClosed", () => {
  it("BA_100_SUBSCRIBER_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_100_SUBSCRIBER_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("processes LE-ZA-HOZ-BANK and returns processed=true with a BA700Return", () => {
    const { store, periodId, closedAt, periodStart, periodEnd } = setupPeriod();

    const result = onAccountingPeriodClosed({
      entity: ENTITY_BANK,
      periodId,
      closedAt,
      periodStart,
      periodEnd,
      functionalCurrency: "ZAR",
      eventStore: store,
      classifications: [{ leafAccountId: "ACC-equity-position-stub", capitalTier: "cet1" }],
      rwa: FIXTURE_RWA,
    });

    expect(result.processed).toBe(true);
    expect(result.ba100Return).toBeDefined();
    expect(result.ba100Return?.meta.form).toBe("BA 700");
    expect(result.ba100Return?.meta.entity).toBe(ENTITY_BANK);
    expect(result.substrateGap).toContain("substrate-gap");
  });

  it("no-ops for non-bank entity (LE-ZA-HOZ-SECURITIES)", () => {
    const store = new EventStore(":memory:");
    const result = onAccountingPeriodClosed({
      entity: ENTITY_SECURITIES,
      periodId: "period:hoz-securities:month:2026-05",
      closedAt: "2026-06-01T00:00:00.000Z",
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-05-31T23:59:59.999Z",
      functionalCurrency: "ZAR",
      eventStore: store,
      classifications: [],
      rwa: FIXTURE_RWA,
    });
    expect(result.processed).toBe(false);
    expect(result.ba100Return).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. replayAndGenerate
// ---------------------------------------------------------------------------

describe("D-REPORTING-CAPABILITY-SLICE-4 returns/ba700 — replayAndGenerate", () => {
  it("returns one result per closed period", () => {
    const { store } = setupPeriod();

    const results = replayAndGenerate({
      entity: ENTITY_BANK,
      eventStore: store,
      functionalCurrency: "ZAR",
      rwa: FIXTURE_RWA,
      classificationFactory: (_entity, _periodId) => [
        { leafAccountId: "ACC-equity-position-stub", capitalTier: "cet1" as const },
      ],
    });

    // One closed period in the store.
    expect(results.length).toBe(1);
    expect(results[0]?.processed).toBe(true);
    expect(results[0]?.ba100Return?.meta.form).toBe("BA 700");
  });

  it("returns empty array for non-bank entity", () => {
    const store = new EventStore(":memory:");
    const results = replayAndGenerate({
      entity: ENTITY_SECURITIES,
      eventStore: store,
      functionalCurrency: "ZAR",
      rwa: FIXTURE_RWA,
      classificationFactory: () => [],
    });
    expect(results).toEqual([]);
  });
});
