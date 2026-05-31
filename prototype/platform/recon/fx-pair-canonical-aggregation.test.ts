// platform/recon/fx-pair-canonical-aggregation.test.ts
//
// Unit tests for the `fx-pair-canonical-aggregation` recon — updated for
// per-currency ZAR MTM (CEO instruction 2026-05-31). Tests are driven by
// injected sources so no live event-store dependency.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { PnLByCurrency } from "../event-store/event-types/product-control";
import { assertByCurrencyPresent, run } from "./fx-pair-canonical-aggregation";

function ccyRow(currency: string, n = 1): PnLByCurrency {
  return {
    currency,
    tradeCount: n,
    unrealisedPnlZarMinor: 0,
    realisedPnlZarMinor: 0,
  };
}

describe("assertByCurrencyPresent", () => {
  it("present (non-empty array): no violations", () => {
    expect(assertByCurrencyPresent([ccyRow("USD")], true, "test")).toHaveLength(0);
  });

  it("present (empty array, no trade data): no violations", () => {
    expect(assertByCurrencyPresent([], false, "test")).toHaveLength(0);
  });

  it("undefined (missing): one fail violation (default severity)", () => {
    const violations = assertByCurrencyPresent(undefined, false, "test");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("fail");
    expect(violations[0]?.message).toContain("byCurrency");
  });

  it("undefined with info severity: one info violation", () => {
    const violations = assertByCurrencyPresent(undefined, false, "test", "info");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("info");
  });

  it("multiple currencies in array: no violations", () => {
    expect(
      assertByCurrencyPresent([ccyRow("USD"), ccyRow("EUR"), ccyRow("GBP")], true, "test"),
    ).toHaveLength(0);
  });
});

describe("run() — pipeline assertions", () => {
  it("empty state: no events and no live bucket → asserted=0, ok=true", () => {
    const r = run({
      pnlReportEvents: [],
      skipLiveRecompute: true,
    });
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("injected liveByCurrency (empty): asserted=1, ok=true", () => {
    const r = run({
      pnlReportEvents: [],
      liveByCurrency: [],
      skipLiveRecompute: true,
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("injected liveByCurrency with rows: ok=true", () => {
    const r = run({
      pnlReportEvents: [],
      liveByCurrency: [ccyRow("USD"), ccyRow("EUR")],
      skipLiveRecompute: true,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
  });

  it("historical event WITH byCurrency: ok=true, no violations", () => {
    const r = run({
      pnlReportEvents: [
        {
          event_id: "evt:test:1",
          as_of: "2026-05-31",
          payload: {
            reportId: "pnl:2026-05-31:abc",
            reportDate: "2026-05-31",
            byCurrency: [ccyRow("USD")],
          },
        },
      ],
      liveByCurrency: [],
      skipLiveRecompute: true,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(2); // 1 live + 1 historical
    expect(r.violations).toHaveLength(0);
  });

  it("historical event WITHOUT byCurrency (pre-migration): surfaces as info, ok stays true", () => {
    const r = run({
      pnlReportEvents: [
        {
          event_id: "evt:test:1",
          as_of: "2026-05-21",
          payload: {
            reportId: "pnl:2026-05-21:abc",
            reportDate: "2026-05-21",
            // byPair present, byCurrency absent → pre-migration event
            byPair: [{ pair: "USD/ZAR", tradeCount: 1, unrealisedPnlZarMinor: 0, realisedPnlZarMinor: 0 }],
          },
        },
      ],
      liveByCurrency: [],
      skipLiveRecompute: true,
    });
    expect(r.ok).toBe(true); // info findings don't fail the gate
    expect(r.asserted).toBe(2); // 1 live (empty) + 1 historical
    expect(r.violations.some((v) => v.severity === "info")).toBe(true);
    expect(r.violations.some((v) => v.message.includes("byCurrency"))).toBe(true);
  });

  it("multiple historical reports: each asserted independently as info", () => {
    const r = run({
      pnlReportEvents: [
        {
          event_id: "evt:test:1",
          as_of: "2026-05-20",
          payload: { reportId: "pnl:1", byCurrency: [ccyRow("USD")] }, // has byCurrency
        },
        {
          event_id: "evt:test:2",
          as_of: "2026-05-21",
          payload: { reportId: "pnl:2" }, // no byCurrency (pre-migration)
        },
      ],
      liveByCurrency: [],
      skipLiveRecompute: true,
    });
    expect(r.asserted).toBe(3); // 1 live + 2 historical
    expect(r.ok).toBe(true); // historical findings are info, not fail
    expect(r.violations.filter((v) => v.severity === "info")).toHaveLength(1);
    expect(r.violations[0]?.subject).toContain("pnl:2");
  });
});

describe("EUR/USD byCurrency split test", () => {
  it("a EUR/USD trade with zarRateBase/zarRateQuote produces EUR and USD rows", () => {
    // This test exercises the computeDailyPnL path with explicit per-currency
    // rates via a store containing:
    //   - FxTradeExecuted (EUR/USD buy, 100,000 EUR)
    //   - FxPositionRevalued with zarRateBase=19.0 and zarRateQuote=17.5
    // Expected: byCurrency has both EUR and USD rows.
    // Note: this is an in-store test using EventStore(:memory:).

    const { EventStore } = require("../event-store/store");
    const { makeFxTradeExecuted } = require("../markets/cdm/fx");
    const { makeFxPositionRevalued } = require("../event-store/event-types/fx-accounting");
    const { computeDailyPnL } = require("../product-control/daily-pnl");

    const ENTITY = "LE-ZA-HOZ-BANK";
    const CITATIONS = ["IAS-21-§28", "IFRS-9-§5.7.1"];
    const ACTOR = { id: "agent:test", type: "service" as const };
    const REPORT_DATE = "2026-05-31";

    const store = new EventStore(":memory:");

    // EUR/USD BUY: 100,000 EUR base, 108,500 USD quote (rate 1.085)
    store.append(
      makeFxTradeExecuted({
        asOf: REPORT_DATE,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: { scheme: "INTERNAL", value: "TRD-EUR-USD-001" },
          productTaxonomy: "FX-spot",
          currencyPair: { base: "EUR", quote: "USD" },
          side: "buy",
          bookType: "trading",
          venue: "OTC",
          trader: "test@bank.local",
          tradeDate: { iso: REPORT_DATE, calendar: "JIHCAL" },
          settlementPath: "correspondent",
          settlementForm: "physical",
          counterparty: {
            partyId: "CP-TEST-001",
            name: "Test Counterparty",
            role: "counterparty",
            jurisdiction: "ZA",
          },
          legs: [
            {
              legKind: "near",
              payCurrency: "USD",
              receiveCurrency: "EUR",
              notional: { currency: "EUR", amountMinor: 10_000_000 }, // 100,000 EUR
              counterNotional: { currency: "USD", amountMinor: 10_850_000 }, // 108,500 USD
              rate: { amount: 1.085, currency: "USD" },
              settlementDate: { iso: "2099-12-31", calendar: "JIHCAL" },
            },
          ],
          bookId: "FX-SPOT-BOOK",
          clientFlowRef: "test:eur-usd-001",
        },
      }),
    );

    // FxPositionRevalued with per-currency ZAR rates:
    //   EUR/ZAR = 19.00 (zarRateBase), USD/ZAR = 17.50 (zarRateQuote)
    store.append(
      makeFxPositionRevalued({
        asOf: REPORT_DATE,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "TRD-EUR-USD-001",
          currencyPair: "EUR/USD",
          bookRate: 1.085,
          revalRate: 1.086, // EUR/USD cross rate
          notionalBaseMinor: 10_000_000,
          unrealisedPnlZarMinor: 15_000, // net ZAR gain
          revaluedAt: `${REPORT_DATE}T18:00:00.000Z`,
          rateSource: "reuters-wm-fix",
          zarRateBase: 19.0,
          zarRateQuote: 17.5,
        },
      }),
    );

    const { payload } = computeDailyPnL(store, REPORT_DATE);

    // byCurrency must have both EUR and USD rows.
    const currencies = payload.byCurrency.map((r: PnLByCurrency) => r.currency).sort();
    expect(currencies).toContain("EUR");
    expect(currencies).toContain("USD");

    // Total unrealised from byCurrency must equal the reval event's unrealisedPnlZarMinor.
    const totalByCcyUnrealised = payload.byCurrency.reduce(
      (sum: number, r: PnLByCurrency) => sum + r.unrealisedPnlZarMinor,
      0,
    );
    // EUR base gets the larger share (per our pro-rata split); USD quote gets remainder.
    // The sum of both must equal the total unrealised reported.
    expect(totalByCcyUnrealised).toBe(payload.totalUnrealisedPnlZarMinor);
  });
});
