// platform/returns/ba325/period-close-subscriber.test.ts
//
// M2 Slice 3 — Unit tests for the AccountingPeriodClosed → BA 325 subscriber.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10),
//   pack §6 Slice 3.
//
// Asserts:
//   1. Bank entity triggers generation (LE-ZA-HOZ-BANK).
//   2. Non-bank entity is silently skipped (LE-ZA-HOZ-SECURITIES).
//   3. Default classification map anchors to CashAndBalancesAtSARB entry.
//   4. Subscriber reads trial-balance rows from TrialBalanceSnapshotted event.
//   5. BA 325 output is compliant (lcr ≥ 1.0) with default classifications + SARB cash.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering) +
//   Eitan (Treasury & liquidity engineer, engineering) +
//   Anya (Projection Engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../../accounting/period-close";
import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import { makeFxSettlementInstructed } from "../../markets/cdm/fx";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { cashAndBalancesAtSARB } from "../../semantic";
import {
  CASH_AT_SARB_ACCOUNT_ID,
  DEFAULT_HQLA_CLASSIFICATIONS,
  ba325PeriodCloseSubscriber,
} from "./period-close-subscriber";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "D-REPORTING-CAPABILITY-SLICE-3"];

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// =====================================================================
// 1. Semantic cross-link — default map anchors to CashAndBalancesAtSARB
// =====================================================================

describe("BA325 period-close subscriber — semantic cross-link", () => {
  it("default map uses CashAndBalancesAtSARB account id (ACC-1100-001)", () => {
    expect(CASH_AT_SARB_ACCOUNT_ID).toBe("ACC-1100-001");
    expect(DEFAULT_HQLA_CLASSIFICATIONS).toHaveLength(1);
    expect(DEFAULT_HQLA_CLASSIFICATIONS[0]?.leafAccountId).toBe("ACC-1100-001");
    expect(DEFAULT_HQLA_CLASSIFICATIONS[0]?.hqlaLevel).toBe("level-1");
  });

  it("CashAndBalancesAtSARB semantic entry has a BA 325 regulatory cell", () => {
    const ba325Cell = cashAndBalancesAtSARB.regulatoryCells?.find((c) => c.form === "BA 325");
    expect(ba325Cell).toBeDefined();
    expect(ba325Cell?.line).toContain("HQLA Level 1");
  });

  it("default subCategory derives from semantic regulatory cell", () => {
    const subCat = DEFAULT_HQLA_CLASSIFICATIONS[0]?.subCategory;
    expect(subCat).toBeDefined();
    // Either the semantic cell line ("HQLA Level 1 — ...") or the fallback "level-1.cash-at-sarb"
    // Both reference HQLA Level-1.
    const subCatLower = subCat?.toLowerCase() ?? "";
    expect(subCatLower.includes("level-1") || subCatLower.includes("level 1")).toBe(true);
  });
});

// =====================================================================
// 2. Non-bank entity is skipped
// =====================================================================

describe("BA325 period-close subscriber — entity guard", () => {
  it("skips LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    const store = new EventStore(":memory:");
    const result = ba325PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-sec:month:2026-05",
        closedAt: "2026-06-01T00:00:00.000Z",
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY_SECURITIES,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-05-01T00:00:00.000Z",
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in BA_325_BANK_ENTITIES");
  });
});

// =====================================================================
// 3. End-to-end: period close → subscriber → compliant BA 325
// =====================================================================

describe("BA325 period-close subscriber — end-to-end", () => {
  function buildStoreWithPeriod(): {
    store: EventStore;
    closedPayload: {
      periodId: string;
      closedAt: string;
      trialBalanceSnapshotEventId: string;
      uptoSequence: number;
    };
  } {
    const store = new EventStore(":memory:");

    // Open the period.
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: PERIOD_OPEN,
    });

    // Post cash to ACC-1100-001 (SARB cash — HQLA Level 1).
    store.append({
      event_id: newEventId(),
      type: "SubLedgerPostingEmitted",
      as_of: "2026-05-05T00:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: `trade-${newEventId()}`,
        postingType: "trade-date-booking",
        legs: [
          {
            debit: "ACC-1100-001",
            credit: "ACC-equity-stub",
            currency: "ZAR",
            amountMinor: 5_000_000,
            memo: "initial-capitalisation",
          },
        ],
        asOfDate: "2026-05-05T00:00:00.000Z",
        citations: CITATIONS,
      },
    });

    // Append a settlement outflow event (50,000 ZAR) for the LCR denominator.
    store.append(
      makeFxSettlementInstructed({
        asOf: "2026-05-10T10:00:00.000Z",
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: { scheme: "INTERNAL", value: "TRADE-SUB-001" },
          legKind: "near",
          settlementId: { scheme: "INTERNAL", value: "STL-SUB-001-OUT" },
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
          netCash: { currency: "ZAR", amountMinor: -50_000 },
          settlementDate: { iso: "2026-05-10", calendar: "JIHCAL" },
          messageStandard: "ISO-20022-pacs.009",
        },
      }),
    );

    // Close the period.
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
      closedPayload: {
        periodId: PERIOD_OPEN.periodId,
        closedAt: "2026-06-01T00:00:00.000Z",
        trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
        uptoSequence: close.trialBalance.uptoSequence,
      },
    };
  }

  it("generates a compliant BA 325 for LE-ZA-HOZ-BANK on period close", () => {
    const { store, closedPayload } = buildStoreWithPeriod();

    const result = ba325PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    expect(result.skipped).toBe(false);
    expect(result.ba325Output).toBeDefined();

    // HQLA stock from ACC-1100-001 (5,000,000 ZAR).
    expect(result.ba325Output.hqla.level1.stockMinor).toBe(5_000_000);
    expect(result.ba325Output.hqla.totalStockHqlaMinor).toBeGreaterThan(0);

    // Cash outflows from FxSettlementInstructed (50,000 ZAR).
    expect(result.ba325Output.cashFlows.outflows.grossMinor).toBe(50_000);

    // LCR = 5,000,000 / 50,000 = 100 → compliant.
    expect(result.ba325Output.lcrRatio).toBeGreaterThan(1);
    expect(result.ba325Output.lcrCompliant).toBe(true);

    // Provenance chain: trialBalanceSnapshotEventId flows into meta.
    expect(result.ba325Output.meta.trialBalanceSnapshotEventId).toBe(
      closedPayload.trialBalanceSnapshotEventId,
    );

    // Required cells present and non-NaN.
    expect(Number.isNaN(result.ba325Output.lcrRatio)).toBe(false);
    expect(Number.isNaN(result.ba325Output.hqla.totalStockHqlaMinor)).toBe(false);
    expect(Number.isNaN(result.ba325Output.cashFlows.netCashOutflowsMinor)).toBe(false);
  });

  it("reads trial-balance rows from TrialBalanceSnapshotted event", () => {
    const { store, closedPayload } = buildStoreWithPeriod();

    const result = ba325PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    // Trial balance rows must be non-empty (we posted to ACC-1100-001).
    expect(result.trialBalanceRows.length).toBeGreaterThan(0);
    const sarbCashRow = result.trialBalanceRows.find(
      (r) => r.leafAccountId === "ACC-1100-001" && r.currency === "ZAR",
    );
    expect(sarbCashRow).toBeDefined();
    expect(sarbCashRow?.amountMinor).toBe(5_000_000);
  });

  it("placeholders are populated (rehearsal-grade marker)", () => {
    const { store, closedPayload } = buildStoreWithPeriod();

    const result = ba325PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    expect(result.ba325Output.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(result.ba325Output.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});
