// tests/markets-fx-summary.test.ts
//
// FX desk summary panel — V2 surface (`/api/v2/markets/fx/summary`) shape +
// honesty contract. MIGRATED from the legacy `buildFxSummaryView`
// (markets-fx-summary.ts, retired in FU5) to `buildV2FxSummaryView`
// (dashboard/v2-markets-fx-view.ts), which the desk page now consumes.
//
// The V2 summary panel is FIL-sourced (live FX FIL instances + BA-320 V2 charge
// + daily-P&L V2 + promoted V2 VaR), NOT V1 RfqRequested/FxTradeExecuted counts.
// The deep VALUE derivation (positions, P&L figure, VaR) is proven by the
// underlying projections' own tests (ba320-fx-v2, daily-pnl-v2) and by
// tests/v2-markets-fx-view.test.ts; this suite guards the V2 summary panel SHAPE
// the desk page reads + the honest data-empty state (Engineering Charter cmd 3).
//
// Scope:
//   1. Empty store → honest "empty" dataState + reason; zero live trades; nested
//      pnl / var panels carry their own honest empty states.
//   2. Required shape: every field the desk summary consumes is present + typed.
//   3. Name-free: no roster persona name leaks into the panel JSON.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//            D-BANK-WIDE-V2-MIGRATION; feedback_no_agent_names_in_ui.
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { buildV2FxSummaryView } from "../dashboard/v2-markets-fx-view";
import { EventStore } from "../platform/event-store/store";
import { MarketDataStore } from "../platform/market-data/store";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T_NOW = "2026-06-19T12:00:00.000Z";

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
  return new EventStore(join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`));
}

function freshMarketData(): MarketDataStore {
  return new MarketDataStore(join(tmpDir, `md-${Math.random().toString(36).slice(2)}.db`));
}

/** All roster persona personal names — none may appear in a /api/v2 response. */
function rosterNames(): string[] {
  const repoRoot = resolve(import.meta.dir, "..", "..");
  const raw = readFileSync(resolve(repoRoot, "Team", "_team-roster.json"), "utf8");
  const parsed = JSON.parse(raw) as {
    personas?: Array<{ name?: string }>;
    topOfHouse?: { ceoDirectReports?: string[] };
  };
  const names = new Set<string>();
  for (const p of parsed.personas ?? []) if (p.name) names.add(p.name);
  for (const e of parsed.topOfHouse?.ceoDirectReports ?? []) {
    const nm = e.split("(")[0]?.trim();
    if (nm) names.add(nm);
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// 1. Empty store — honest empty state (never a silent zero)
// ---------------------------------------------------------------------------

describe("buildV2FxSummaryView — data-empty store", () => {
  it("reports an honest 'empty' dataState with a reason and zero live trades", () => {
    const view = buildV2FxSummaryView(freshStore(), freshMarketData(), T_NOW);

    expect(view.dataState).toBe("empty");
    expect(view.reason).toBeTruthy();
    expect(view.liveTradeCount).toBe(0);
    expect(view.counterpartyCount).toBe(0);
  });

  it("nested P&L and VaR panels carry their own honest empty states", () => {
    const view = buildV2FxSummaryView(freshStore(), freshMarketData(), T_NOW);

    // P&L headline — empty, never asserts completeness over nothing.
    expect(view.pnl.dataState).toBe("empty");
    expect(view.pnl.reason).toBeTruthy();

    // Promoted V2 VaR — empty (no markable V2 VaR on a flat book), reason given.
    expect(view.var.dataState).toBe("empty");
    expect(view.var.reason).toBeTruthy();
    expect(view.var.varZar).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Shape — every field the desk summary consumes is present + typed
// ---------------------------------------------------------------------------

describe("buildV2FxSummaryView — return shape", () => {
  it("returns the V2 summary panel shape with all required fields", () => {
    const view = buildV2FxSummaryView(freshStore(), freshMarketData(), T_NOW);

    expect(typeof view.dataState).toBe("string");
    expect(typeof view.functionalCurrency).toBe("string");
    expect(typeof view.liveTradeCount).toBe("number");
    expect(typeof view.counterpartyCount).toBe("number");
    // openPositionChargeMinor is number | null — never undefined.
    expect(
      view.openPositionChargeMinor === null ||
        typeof view.openPositionChargeMinor === "number",
    ).toBe(true);
    expect(typeof view.asOf).toBe("string");
    expect(view.asOf.length).toBeGreaterThan(0);

    // Nested panels are present and shaped.
    expect(typeof view.pnl).toBe("object");
    expect(typeof view.pnl.totalUnrealisedFunctionalMinor).toBe("number");
    expect(typeof view.pnl.unrealisedComplete).toBe("boolean");
    expect(typeof view.var).toBe("object");
    expect(Array.isArray(view.pnl.byCurrency)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Name-free contract
// ---------------------------------------------------------------------------

describe("buildV2FxSummaryView — name-free", () => {
  it("leaks no roster persona personal name into the summary panel JSON", () => {
    const view = buildV2FxSummaryView(freshStore(), freshMarketData(), T_NOW);
    const json = JSON.stringify(view);
    for (const name of rosterNames()) {
      const hit = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(json);
      expect(hit, `roster name "${name}" leaked into /api/v2 FX summary`).toBe(false);
    }
  });
});
