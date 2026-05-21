// platform/projections/markets/limit-utilisation.test.ts
//
// Unit tests for LimitUtilisationProjection.
//
// Key regression: placeholder-zero bug fix (WS-MARKET-RISK-PROCEDURES /
// D-BRC-INTERIM-MR-1-FX). Before the fix, the `!row` branch in
// `getLimitUtilisations()` hardcoded `currentExposure: 0`, silently
// discarding accumulated exposure from trade events. After the fix,
// `currentExposure` surfaces the accumulated value even when no schedule
// is published.
//
// Authority: D-BRC-INTERIM-MR-1-FX (CEO-approved 2026-05-21)
// Authors: Rohan (Risk engineer, engineering) +
//          Helena (Chief Risk Officer, governance)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../core/types";
import { makeFxTradeExecuted } from "../../markets/cdm/fx";
import type { Event } from "../../event-store/types";
import { getLimitUtilisations, rebuildLimitUtilisation } from "./limit-utilisation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:rohan:risk-engine" };
const CITATIONS = ["D-BRC-INTERIM-MR-1-FX", "WS-MARKET-RISK-PROCEDURES"];
const AS_OF = "2026-05-21T10:00:00.000Z";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal FxTradeExecuted event with a ZAR notional of exactly
 * ZAR 1,000,000 (legs[0].notional.amountMinor = 1_000_000_00 cents).
 *
 * The projection fold divides amountMinor by 100 to yield ZAR 1,000,000
 * in the B3 bucket and 10% of that (ZAR 100,000) in the B1 bucket.
 */
function makeFxSpotTrade(tradeId: string): Event {
  return makeFxTradeExecuted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "internal", value: tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "sell",
      legs: [
        {
          legKind: "near",
          payCurrency: "USD",
          receiveCurrency: "ZAR",
          // 1_000_000_00 cents = ZAR 1,000,000 after ÷100
          notional: { currency: "USD", amountMinor: 1_000_000_00 },
          counterNotional: { currency: "ZAR", amountMinor: 18_500_000_00 },
          rate: { currency: "ZAR", amount: 18.5 },
          settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" as const },
        },
      ],
      tradeDate: { iso: "2026-05-21", calendar: "JIHCAL" as const },
      counterparty: {
        partyId: "urn:party:legal-entity:standard-bank-za",
        name: "Standard Bank Corporate Treasury",
        role: "counterparty" as const,
      },
      venue: "OTC",
      trader: "trader-001",
      bookId: "FX-TRADING",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      clientFlowRef: `client-trade:test-${tradeId}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests: placeholder-zero bug fix
// ---------------------------------------------------------------------------

describe("LimitUtilisationProjection — placeholder-zero bug fix", () => {
  it("B3.currentExposure = 1_000_000 after 1 FxTradeExecuted with ZAR 1m notional, even when no schedule is published", () => {
    // Regression test: before the fix, this returned currentExposure=0.
    const events: Event[] = [makeFxSpotTrade("TRADE-0001")];

    rebuildLimitUtilisation(events);
    const rows = getLimitUtilisations();

    const b3 = rows.find((r) => r.cluster === "B3");
    expect(b3).toBeDefined();
    // legs[0].notional.amountMinor = 1_000_000_00 ÷ 100 = 1_000_000
    expect(b3!.currentExposure).toBe(1_000_000);
    // No schedule → utilisationPct=0, limitValue=0, ragStatus=green
    expect(b3!.utilisationPct).toBe(0);
    expect(b3!.limitValue).toBe(0);
    expect(b3!.ragStatus).toBe("green");
    expect(b3!.limitName).toContain("no schedule published");
  });

  it("B1.currentExposure = 100_000 (10% of notional) after 1 FxTradeExecuted with ZAR 1m notional, even when no schedule is published", () => {
    // B1 accumulates 10% of notional as counterparty pre-settlement exposure.
    const events: Event[] = [makeFxSpotTrade("TRADE-0002")];

    rebuildLimitUtilisation(events);
    const rows = getLimitUtilisations();

    const b1 = rows.find((r) => r.cluster === "B1");
    expect(b1).toBeDefined();
    // 10% of 1_000_000 = 100_000
    expect(b1!.currentExposure).toBe(100_000);
    expect(b1!.utilisationPct).toBe(0);
    expect(b1!.limitValue).toBe(0);
    expect(b1!.ragStatus).toBe("green");
  });

  it("clusters with no trade events report currentExposure=0 when no schedule is published", () => {
    // B2, B4, B5 receive no FX trade contributions — they must remain at 0.
    const events: Event[] = [makeFxSpotTrade("TRADE-0003")];

    rebuildLimitUtilisation(events);
    const rows = getLimitUtilisations();

    for (const cluster of ["B2", "B4", "B5"] as const) {
      const row = rows.find((r) => r.cluster === cluster);
      expect(row).toBeDefined();
      expect(row!.currentExposure).toBe(0);
    }
  });

  it("returns 5 rows covering all clusters even with an empty event stream", () => {
    rebuildLimitUtilisation([]);
    const rows = getLimitUtilisations();

    expect(rows).toHaveLength(5);
    const clusters = rows.map((r) => r.cluster).sort();
    expect(clusters).toEqual(["B1", "B2", "B3", "B4", "B5"]);
    for (const row of rows) {
      expect(row.currentExposure).toBe(0);
      expect(row.utilisationPct).toBe(0);
      expect(row.ragStatus).toBe("green");
    }
  });
});
