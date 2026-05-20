// tests/markets-fx-summary.test.ts
//
// FX desk Slice 6 — tests for the CEO oversight tile view builder.
//
// Scope (8 test cases):
//   1. Empty store → all counts zero, topCounterparties [], b3RagStatus "green"
//   2. RfqRequested events → rfqCount correct
//   3. FxTradeExecuted events → tradeCount correct
//   4. OrderApprovedAtGateway events → approvalCount correct
//   5. OrderRejectedAtGateway events → rejectionCount correct
//   6. Top counterparties: 4 trades cp-A, 2 cp-B, 1 cp-C, 1 cp-D → top 3 correct
//   7. b3UtilisationPct / b3RagStatus reflect limit-utilisation projection B3 row
//   8. GET /api/markets/fx/summary returns 200 with correct shape
//      (tested via buildFxSummaryView — same code path the endpoint calls)
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
// Author: Kai (Trading systems engineer, engineering)

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { buildFxSummaryView } from "../dashboard/markets-fx-summary";
import {
  makeOrderApprovedAtGateway,
  makeOrderRejectedAtGateway,
  makeRasLimitSchedulePublished,
  makeRfqRequested,
} from "../platform/event-store/event-types/trading";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "BANK-ZA-001";
const KAI_ACTOR: Actor = { type: "service", id: "agent:kai:fx-summary-test" };
const CITATIONS = ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"];

const T_NOW = "2026-05-18T10:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-summary-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

function appendRfq(store: EventStore, rfqId: string): void {
  store.append(
    makeRfqRequested({
      asOf: T_NOW,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        rfqId,
        counterpartyId: "cp:test-1",
        currencyPair: "USD/ZAR",
        side: "buy",
        notional: 1_000_000,
        valueDate: "2026-05-20",
        requestedAt: T_NOW,
      },
    }),
  );
}

function appendFxTrade(store: EventStore, counterpartyId: string): void {
  store.append(
    makeFxTradeExecuted({
      asOf: T_NOW,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "internal", value: `trade:${Math.random().toString(36).slice(2)}` },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "USD",
            receiveCurrency: "ZAR",
            notional: { currency: "USD", amountMinor: 100_000_00 }, // 1,000,000 USD (minor)
            counterNotional: { currency: "ZAR", amountMinor: 18_500_000_00 }, // ZAR minor
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-05-20", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-05-18", calendar: "JIHCAL" },
        counterparty: {
          partyId: counterpartyId,
          name: `Counterparty ${counterpartyId}`,
          role: "counterparty",
        },
        venue: "OTC",
        trader: "trader:kai",
        bookId: "book:fx-spot-1",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        // No-prop attribution (G-3) — client-flow fixture.
        clientFlowRef: "client-trade:markets-fx-summary-test",
      },
    }),
  );
}

function appendApproval(store: EventStore, orderId: string): void {
  store.append(
    makeOrderApprovedAtGateway({
      asOf: T_NOW,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        orderId,
        approvalCitations: CITATIONS,
        passedAt: T_NOW,
      },
    }),
  );
}

function appendRejection(store: EventStore, orderId: string): void {
  store.append(
    makeOrderRejectedAtGateway({
      asOf: T_NOW,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        orderId,
        rejectionReason: "counterparty not eligible",
        rejectingCheck: "counterparty-eligibility",
        citationToRule: "D-FX-SALES-TRADING-FRONTEND",
        rejectedAt: T_NOW,
      },
    }),
  );
}

function seedRasSchedule(store: EventStore): void {
  store.append(
    makeRasLimitSchedulePublished({
      asOf: T_NOW,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        scheduleId: "sched:test-summary-1",
        publishedBy: "helena@bank",
        effectiveFrom: T_NOW,
        limits: [
          {
            cluster: "B1",
            limitName: "Counterparty Credit Risk",
            limitValue: 50_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B2",
            limitName: "Issuer Concentration Risk",
            limitValue: 30_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B3",
            limitName: "Market Risk (FX + Equity)",
            limitValue: 100_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B4",
            limitName: "Liquidity Risk",
            limitValue: 20_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
          {
            cluster: "B5",
            limitName: "Operational Risk Capital",
            limitValue: 10_000_000,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
        ],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. Empty store — all counts zero
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — empty store", () => {
  it("returns all-zero counts, empty topCounterparties, and b3RagStatus green", () => {
    const store = freshStore();
    const view = buildFxSummaryView(store);

    expect(view.rfqCount).toBe(0);
    expect(view.tradeCount).toBe(0);
    expect(view.approvalCount).toBe(0);
    expect(view.rejectionCount).toBe(0);
    expect(view.topCounterparties).toEqual([]);
    expect(view.b3RagStatus).toBe("green");
    expect(view.b3UtilisationPct).toBe(0);
    expect(typeof view.asOf).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 2. RfqRequested events → rfqCount correct
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — RfqRequested counting", () => {
  it("counts 3 RfqRequested events correctly", () => {
    const store = freshStore();
    appendRfq(store, "rfq:1");
    appendRfq(store, "rfq:2");
    appendRfq(store, "rfq:3");

    const view = buildFxSummaryView(store);
    expect(view.rfqCount).toBe(3);
    // Other counts unaffected
    expect(view.tradeCount).toBe(0);
    expect(view.approvalCount).toBe(0);
    expect(view.rejectionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. FxTradeExecuted events → tradeCount correct
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — FxTradeExecuted counting", () => {
  it("counts 2 FxTradeExecuted events correctly", () => {
    const store = freshStore();
    appendFxTrade(store, "cp:alpha");
    appendFxTrade(store, "cp:beta");

    const view = buildFxSummaryView(store);
    expect(view.tradeCount).toBe(2);
    expect(view.rfqCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. OrderApprovedAtGateway events → approvalCount correct
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — OrderApprovedAtGateway counting", () => {
  it("counts 4 OrderApprovedAtGateway events correctly", () => {
    const store = freshStore();
    appendApproval(store, "ord:1");
    appendApproval(store, "ord:2");
    appendApproval(store, "ord:3");
    appendApproval(store, "ord:4");

    const view = buildFxSummaryView(store);
    expect(view.approvalCount).toBe(4);
    expect(view.rejectionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. OrderRejectedAtGateway events → rejectionCount correct
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — OrderRejectedAtGateway counting", () => {
  it("counts 2 OrderRejectedAtGateway events correctly", () => {
    const store = freshStore();
    appendRejection(store, "ord:r1");
    appendRejection(store, "ord:r2");

    const view = buildFxSummaryView(store);
    expect(view.rejectionCount).toBe(2);
    expect(view.approvalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Top counterparties: 4 cp-A, 2 cp-B, 1 cp-C, 1 cp-D → top 3
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — top counterparties", () => {
  it("returns top-3 counterparties by trade count, descending; first is cp-A with 4", () => {
    const store = freshStore();
    // cp-A: 4 trades
    appendFxTrade(store, "cp-A");
    appendFxTrade(store, "cp-A");
    appendFxTrade(store, "cp-A");
    appendFxTrade(store, "cp-A");
    // cp-B: 2 trades
    appendFxTrade(store, "cp-B");
    appendFxTrade(store, "cp-B");
    // cp-C: 1 trade
    appendFxTrade(store, "cp-C");
    // cp-D: 1 trade
    appendFxTrade(store, "cp-D");

    const view = buildFxSummaryView(store);

    // At most 3 entries
    expect(view.topCounterparties.length).toBeLessThanOrEqual(3);
    expect(view.topCounterparties.length).toBe(3);

    // First entry must be cp-A with 4 trades
    expect(view.topCounterparties[0]?.counterpartyId).toBe("cp-A");
    expect(view.topCounterparties[0]?.tradeCount).toBe(4);

    // Second entry must be cp-B with 2 trades
    expect(view.topCounterparties[1]?.counterpartyId).toBe("cp-B");
    expect(view.topCounterparties[1]?.tradeCount).toBe(2);

    // Third entry is either cp-C or cp-D (both have 1)
    expect(view.topCounterparties[2]?.tradeCount).toBe(1);
  });

  it("returns empty array when no FxTradeExecuted events", () => {
    const store = freshStore();
    appendRfq(store, "rfq:no-trades");
    const view = buildFxSummaryView(store);
    expect(view.topCounterparties).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. b3UtilisationPct / b3RagStatus reflect limit-utilisation projection B3
// ---------------------------------------------------------------------------

describe("buildFxSummaryView — B3 utilisation", () => {
  it("b3UtilisationPct is 0 and b3RagStatus is green with no trades", () => {
    const store = freshStore();
    seedRasSchedule(store);
    const view = buildFxSummaryView(store);
    expect(view.b3UtilisationPct).toBe(0);
    expect(view.b3RagStatus).toBe("green");
  });

  it("b3UtilisationPct > 0 and b3RagStatus is set after FxTradeExecuted with active RAS schedule", () => {
    const store = freshStore();
    seedRasSchedule(store);
    appendFxTrade(store, "cp:ras-test");

    const view = buildFxSummaryView(store);
    // The projection accumulates notional / 100 into B3 exposure; with a
    // 100,000,000 ZAR limit and 10,000 USD notional contribution (after
    // minor-unit division), utilisationPct should be > 0.
    expect(view.b3UtilisationPct).toBeGreaterThan(0);
    expect(["green", "amber", "red"]).toContain(view.b3RagStatus);
  });
});

// ---------------------------------------------------------------------------
// 8. GET /api/markets/fx/summary shape — tested via buildFxSummaryView
//    (same code path the server endpoint calls; avoids spawning a full server)
// ---------------------------------------------------------------------------

describe("GET /api/markets/fx/summary shape (via buildFxSummaryView)", () => {
  it("returns a valid FxSummaryView shape with all required fields", () => {
    const store = freshStore();
    appendRfq(store, "rfq:shape-check-1");
    appendFxTrade(store, "cp:shape-check-1");
    appendApproval(store, "ord:shape-check-1");
    appendRejection(store, "ord:shape-check-r1");

    const view = buildFxSummaryView(store);

    // Required numeric fields
    expect(typeof view.rfqCount).toBe("number");
    expect(typeof view.tradeCount).toBe("number");
    expect(typeof view.approvalCount).toBe("number");
    expect(typeof view.rejectionCount).toBe("number");
    expect(typeof view.b3UtilisationPct).toBe("number");

    // Required string fields
    expect(typeof view.b3RagStatus).toBe("string");
    expect(["green", "amber", "red"]).toContain(view.b3RagStatus);
    expect(typeof view.asOf).toBe("string");
    expect(view.asOf.length).toBeGreaterThan(0);

    // Required array field
    expect(Array.isArray(view.topCounterparties)).toBe(true);
    expect(view.topCounterparties.length).toBeLessThanOrEqual(3);

    // Verify counts match what was appended
    expect(view.rfqCount).toBe(1);
    expect(view.tradeCount).toBe(1);
    expect(view.approvalCount).toBe(1);
    expect(view.rejectionCount).toBe(1);

    // Top counterparties shape
    if (view.topCounterparties.length > 0) {
      const first = view.topCounterparties[0];
      expect(typeof first?.counterpartyId).toBe("string");
      expect(typeof first?.tradeCount).toBe("number");
    }
  });
});
