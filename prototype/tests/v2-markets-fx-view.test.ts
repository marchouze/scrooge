// tests/v2-markets-fx-view.test.ts
//
// V2 FX dashboard surface (`/api/v2/markets/fx/*`) view-module tests
// (WS-FX-OTC-CLOSURE B5). Covers the two contracts the brief makes load-bearing:
//
//   1. HONESTY (Engineering Charter cmd 3): on a data-empty store every panel
//      reports an explicit, honest dataState ("empty" | "v1-only") with a reason
//      — never a silent zero. The two panels with no V2 source (gateway
//      rejections; RAS headroom) are "v1-only" and name their legacy route.
//   2. NAME-FREE (standing policy; feedback_no_agent_names_in_ui): the desk-owner
//      seat is rendered by TITLE only ("Head of Global Markets"), never the
//      persona's personal name, and no roster name leaks into the surface JSON.
//
// The panel-by-panel VALUE derivation (BA-320 V2 positions, daily-P&L V2 figure,
// NPA attestation rows) is proven by the underlying projections' own tests
// (ba320-fx-v2, daily-pnl-v2, markets-fx-npa, markets-fx-counterparties); this
// suite tests the V2-boundary glue + the honesty/name-free invariants.
//
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { buildV2FxSurfaceView } from "../dashboard/v2-markets-fx-view";
import { EventStore } from "../platform/event-store/store";
import { MarketDataStore } from "../platform/market-data/store";

const T_NOW = "2026-06-19T12:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "v2-fx-view-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
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

describe("V2 FX surface — honesty contract on a data-empty store", () => {
  it("reports honest empty / v1-only panels with reasons — never a silent zero", () => {
    const view = buildV2FxSurfaceView(freshStore(), freshMarketData(), T_NOW);

    // Risk (BA-320 V2): no FIL FX instruments → empty with a reason, no charge.
    expect(view.risk.dataState).toBe("empty");
    expect(view.risk.reason).toBeTruthy();
    expect(view.risk.positions).toEqual([]);
    expect(view.risk.openPositionChargeMinor).toBeNull();
    expect(view.risk.coverageStatus).toBe("no-data");

    // Blotter: no live FIL FX → empty with a reason.
    expect(view.blotter.dataState).toBe("empty");
    expect(view.blotter.count).toBe(0);
    expect(view.blotter.reason).toBeTruthy();

    // P&L headline: empty, and never asserts completeness over nothing.
    expect(view.summary.pnl.dataState).toBe("empty");
    expect(view.summary.liveTradeCount).toBe(0);

    // NPA: no ProductApproved/Withheld → empty with a reason.
    expect(view.npa.dataState).toBe("empty");
    expect(view.npa.reason).toBeTruthy();

    // The two structurally-V1-only panels: explicit v1-only + legacy route named.
    expect(view.rejections.dataState).toBe("v1-only");
    expect(view.rejections.legacyRoute).toBe("GET /api/markets/fx/rejections");
    expect(view.rejections.reason).toContain("V1");
    expect(view.headroom.dataState).toBe("v1-only");
    expect(view.headroom.legacyRoute).toBe("GET /api/markets/fx/headroom");
    expect(view.headroom.reason).toBeTruthy();
  });

  it("emits a per-panel manifest tagging V2-complete vs V1-only", () => {
    const view = buildV2FxSurfaceView(freshStore(), freshMarketData(), T_NOW);
    const byPanel = new Map(view.panels.map((p) => [p.panel, p]));

    // Five V2-sourced panels.
    for (const p of ["summary", "risk", "blotter", "counterparties", "npa"]) {
      expect(byPanel.get(p)?.source).toBe("v2");
    }
    // Two V1-only panels — honestly tagged.
    expect(byPanel.get("rejections")?.source).toBe("v1-only");
    expect(byPanel.get("headroom")?.source).toBe("v1-only");

    // Every panel carries a route + a dataState.
    for (const p of view.panels) {
      expect(p.route.startsWith("/api/v2/markets/fx")).toBe(true);
      expect(["live", "empty", "v1-only"]).toContain(p.dataState);
    }
  });
});

describe("V2 FX surface — name-free (Title-only) contract", () => {
  it("renders the desk owner by seat Title, not the persona personal name", () => {
    const view = buildV2FxSurfaceView(freshStore(), freshMarketData(), T_NOW);
    expect(view.deskOwnerSeatTitle).toBe("Head of Global Markets");
    // The persona name behind the seat must NOT appear.
    expect(view.deskOwnerSeatTitle).not.toContain("Saskia");
  });

  it("leaks no roster persona personal name into the surface JSON", () => {
    const view = buildV2FxSurfaceView(freshStore(), freshMarketData(), T_NOW);
    const json = JSON.stringify(view);
    for (const name of rosterNames()) {
      // Whole-word match — avoid false positives on substrings of unrelated ids.
      const hit = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(json);
      expect(hit, `roster name "${name}" leaked into /api/v2 FX surface`).toBe(false);
    }
  });
});
