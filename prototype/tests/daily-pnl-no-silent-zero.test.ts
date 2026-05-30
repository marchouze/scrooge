// tests/daily-pnl-no-silent-zero.test.ts
//
// Regression tests for the Trusted-Figures no-silent-zero extension to the
// product-control daily P&L aggregate.
//
// Defect (Marc, 2026-05-30): a LIVE FX position with no production mark
// contributed a silent 0 to the headline unrealised P&L — the figure read as
// complete while silently understating. The fix: an unmarkable LIVE position is
// EXCLUDED from `totalUnrealisedPnlZarMinor` (not folded in as 0), counted in
// `unmarkableLivePositions`, and the headline figure is surfaced as a
// FinancialInput that is `absent` (degraded) whenever ≥1 live position is
// unmarkable. The data-failures view then renders it in the global banner.
//
// Cases:
//   TC-1: a markable live position → unrealisedComplete:true, FinancialInput present,
//         total includes its mark.
//   TC-2: an unmarkable live position → unrealisedComplete:false, FinancialInput
//         absent, total EXCLUDES it (not silent 0), unmarkable trade id surfaced.
//   TC-3: mixed → total carries only the markable mark; unmarkable excluded;
//         flagged incomplete; per-row markStatus badges preserved.
//   TC-4: buildPnLDataFailuresView surfaces a degraded entry iff incomplete.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Workstream: WS-TRUSTED-FIGURES.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { makeFxPositionRevalued } from "../platform/event-store/event-types/fx-accounting";
import { EventStore } from "../platform/event-store/store";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { computeDailyPnL } from "../platform/product-control/daily-pnl";
import { buildPnLDataFailuresView } from "../platform/product-control/pnl-data-failures-view";

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["IAS-21-§28", "PR-FX-LIFECYCLE-CLOSE", "D-FX-QUOTING-CONVENTION"];
const ACTOR = { id: "agent:atlas:test", type: "service" as const };
const REPORT_DATE = "2026-05-30";

function makeLiveTrade(tradeId: string) {
  return makeFxTradeExecuted({
    asOf: REPORT_DATE,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "INTERNAL", value: tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      bookType: "trading",
      venue: "OTC",
      trader: "atlas@bank.local",
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
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: 1_850_000_000 },
          counterNotional: { currency: "USD", amountMinor: 100_000_000 },
          rate: { amount: 18.5, currency: "ZAR" },
          // Far future settlement so the trade stays LIVE (unsettled).
          settlementDate: { iso: "2026-12-31", calendar: "JIHCAL" },
        },
      ],
      bookId: "FX-SPOT-BOOK",
      clientFlowRef: `client-trade:nsz-${tradeId}`,
    },
  });
}

/** A production (markable) revaluation carrying a real unrealised P&L delta. */
function makeMark(tradeId: string, unrealisedPnlZarMinor: number) {
  return makeFxPositionRevalued({
    asOf: REPORT_DATE,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId,
      currencyPair: "USD/ZAR",
      bookRate: 18.5,
      revalRate: 18.6,
      notionalBaseMinor: 100_000_000,
      unrealisedPnlZarMinor,
      revaluedAt: `${REPORT_DATE}T12:00:00.000Z`,
      rateSource: "reuters-wm-fix",
    },
  });
}

describe("daily-pnl no-silent-zero (Trusted-Figures)", () => {
  it("TC-1: a markable live position yields a complete aggregate (present)", () => {
    const store = new EventStore(":memory:");
    store.append(makeLiveTrade("SIM-NSZ-001"));
    store.append(makeMark("SIM-NSZ-001", 5_000_000));

    const { payload, totalUnrealised } = computeDailyPnL(store, REPORT_DATE);

    expect(payload.unrealisedComplete).toBe(true);
    expect(payload.unmarkableLivePositions).toBe(0);
    expect(payload.unmarkableLiveTradeIds).toEqual([]);
    expect(payload.totalUnrealisedPnlZarMinor).toBe(5_000_000);
    expect(totalUnrealised.present).toBe(true);
    if (totalUnrealised.present) expect(totalUnrealised.value).toBe(5_000_000);
  });

  it("TC-2: an unmarkable live position is EXCLUDED, not folded as a silent 0", () => {
    const store = new EventStore(":memory:");
    // Live trade with NO FxPositionRevalued → markStatus "unavailable".
    store.append(makeLiveTrade("SIM-NSZ-002"));

    const { payload, totalUnrealised, marksUnavailableCount } = computeDailyPnL(store, REPORT_DATE);

    // The defect would have produced totalUnrealised = 0 + unrealisedComplete-looking
    // clean number. The fix: the aggregate declares itself incomplete and the
    // figure is absent (degraded), never a silent 0 presented as complete.
    expect(payload.unrealisedComplete).toBe(false);
    expect(payload.unmarkableLivePositions).toBe(1);
    expect(payload.unmarkableLiveTradeIds).toContain("SIM-NSZ-002");
    expect(marksUnavailableCount).toBe(1);
    expect(totalUnrealised.present).toBe(false);
    // The partial sum still excludes the unmarkable leg (0 here because it was
    // the only position) — but it is NOT presented as complete.
    expect(payload.totalUnrealisedPnlZarMinor).toBe(0);
  });

  it("TC-3: mixed book — total carries only the markable mark; unmarkable excluded", () => {
    const store = new EventStore(":memory:");
    store.append(makeLiveTrade("SIM-NSZ-003-MARKED"));
    store.append(makeMark("SIM-NSZ-003-MARKED", 7_000_000));
    store.append(makeLiveTrade("SIM-NSZ-003-UNMARKED")); // no reval

    const { payload, trades, totalUnrealised } = computeDailyPnL(store, REPORT_DATE);

    // Only the marked leg's P&L is in the aggregate — the unmarkable leg adds
    // nothing (not a 0). The aggregate is flagged incomplete.
    expect(payload.totalUnrealisedPnlZarMinor).toBe(7_000_000);
    expect(payload.unrealisedComplete).toBe(false);
    expect(payload.unmarkableLivePositions).toBe(1);
    expect(payload.unmarkableLiveTradeIds).toEqual(["SIM-NSZ-003-UNMARKED"]);
    expect(totalUnrealised.present).toBe(false);

    // Per-row badges preserved: marked row "live", unmarked row "unavailable".
    const marked = trades.find((t) => t.tradeId === "SIM-NSZ-003-MARKED");
    const unmarked = trades.find((t) => t.tradeId === "SIM-NSZ-003-UNMARKED");
    expect(marked?.markStatus).toBe("live");
    expect(unmarked?.markStatus).toBe("unavailable");
    expect(unmarked?.unrealisedPnlZarMinor).toBe(0); // per-row 0 with a badge, not a silent figure
  });

  it("TC-4: data-failures view surfaces a degraded entry iff incomplete", () => {
    const complete = new EventStore(":memory:");
    complete.append(makeLiveTrade("SIM-NSZ-004"));
    complete.append(makeMark("SIM-NSZ-004", 1_000_000));
    expect(buildPnLDataFailuresView(complete, REPORT_DATE)).toEqual([]);

    const incomplete = new EventStore(":memory:");
    incomplete.append(makeLiveTrade("SIM-NSZ-005"));
    const failures = buildPnLDataFailuresView(incomplete, REPORT_DATE);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.status).toBe("degraded");
    expect(failures[0]?.calcKey).toBe("product-control:daily-unrealised-pnl");
    expect(failures[0]?.missingInputs.join(" ")).toContain("SIM-NSZ-005");
  });
});
