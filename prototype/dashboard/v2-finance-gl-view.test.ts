// dashboard/v2-finance-gl-view.test.ts
//
// Tests for the compact (1-row-per-account) GL trial-balance view with native-CCY
// + ZAR-equivalent columns. Populates a store via the live FX V2 simulator (which
// books simulated FX trades and ingests production marks), then asserts the view.

import { describe, expect, test } from "bun:test";

import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { EventStore } from "../platform/event-store/store";
import { MarketDataStore } from "../platform/market-data/store";
import { V2LiveFxDriver } from "../platform/simulation-v2-live/live-driver";
import { FX_TREATMENT_MODULES } from "../v2-core/reporting-treatments/fx-modules";
import { buildGlView } from "./v2-finance-gl-view";

const PROD_TAG = { kind: "production" as const, sourceLineage: "gl-view-test" };

/** Seed the FX reporting-treatment standing data the GL fold needs to scope FX. */
function seedFxTreatment(store: EventStore): void {
  for (const m of FX_TREATMENT_MODULES) {
    const ev = makeReportingTreatmentDeclared({
      asOf: "2026-01-01T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "system", id: "gl-view-test" },
      citations: ["D-V2-UI-VISIBILITY-REMEDIATION"],
      payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
    });
    store.append({ ...ev, provenance: PROD_TAG });
  }
}

function populatedStores(): { eventStore: EventStore; marketDataStore: MarketDataStore } {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  seedFxTreatment(eventStore);
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    config: { tradesPerTick: 2, seed: 0x9911 },
  });
  for (let i = 0; i < 5; i++) driver.tickOnce();
  return { eventStore, marketDataStore };
}

/**
 * A book with OPEN FX trades — `realtime` settlement defers settlement past the
 * sim clock, so trades stay open and their trade-date OFF-BALANCE-SHEET commitment
 * (ACC-9100-*) remains standing (it is released only on settlement,
 * D-FX-TRADE-DATE-FVTPL-OBS).
 */
function openTradeStores(): { eventStore: EventStore; marketDataStore: MarketDataStore } {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  seedFxTreatment(eventStore);
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    config: { tradesPerTick: 2, seed: 0x9911, settlementMode: "realtime" },
  });
  driver.tickOnce();
  return { eventStore, marketDataStore };
}

describe("buildGlView — compact TB + CCY/ZAR-equivalent", () => {
  test("production-only lens is honestly empty (sim is simulated provenance)", () => {
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "production-only" } });
    expect(view.dataState).toBe("empty");
    expect(view.rows.length).toBe(0);
  });

  test("+Sim lens: exactly one row per account (compact)", () => {
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });
    expect(view.dataState).toBe("live");
    expect(view.rows.length).toBeGreaterThan(0);
    const accountIds = view.rows.map((r) => r.accountId);
    // No accountId appears twice — the per-(account,currency) fold rows are collapsed.
    expect(new Set(accountIds).size).toBe(accountIds.length);
  });

  test("non-ZAR accounts carry a ZAR-equivalent; ZAR accounts are the identity", () => {
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });

    const usd = view.rows.find((r) => r.currency === "USD");
    expect(usd).toBeDefined();
    if (usd) {
      // A production USD/ZAR mark was ingested by the sim → rate available + translated.
      expect(usd.zarRateAvailable).toBe(true);
      expect(usd.zarNetFmt).toContain("R");
      // ZAR equivalent is materially larger than the USD figure (rate ≈ 18.5).
      expect(Math.abs(usd.zarNetMinor)).toBeGreaterThan(Math.abs(usd.netMinor));
    }

    const zar = view.rows.find((r) => r.currency === "ZAR");
    expect(zar).toBeDefined();
    if (zar) {
      // ZAR account: the ZAR-equivalent equals the native net (identity translation).
      expect(zar.zarNetMinor).toBe(zar.netMinor);
    }
  });

  test("native in-balance check holds; ZAR-equivalent totals are populated", () => {
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });
    expect(view.inBalance).toBe(true);
    expect(view.zarTotalDebitMinor).toBeGreaterThan(0);
    expect(view.zarTotalCreditMinor).toBeGreaterThan(0);
  });

  test("trade-date FX (open trade) lands in the OFF-BALANCE-SHEET memorandum section, excluded from on-BS totals + in-balance", () => {
    // OPEN trades: the trade-date OBS commitment is still standing (not yet released
    // by settlement). A fully-settled book releases it (covered separately below).
    const { eventStore, marketDataStore } = openTradeStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });

    // Policy A (D-FX-TRADE-DATE-FVTPL-OBS): the trade-date commitment quad lands on
    // the OBS memorandum block (ACC-9100-*), flagged off-balance-sheet, NOT the
    // on-balance-sheet FX block (ACC-2100-*).
    const obsRows = view.rows.filter((r) => r.offBalanceSheet);
    expect(obsRows.length).toBeGreaterThan(0);
    expect(obsRows.every((r) => r.accountId.startsWith("ACC-9100-"))).toBe(true);

    // The OBS section self-balances and is reported in its own totals (ZAR-equiv).
    expect(view.offBalanceSheetInBalance).toBe(true);
    expect(view.offBalanceSheetDebitMinor).toBeGreaterThan(0);
    expect(view.offBalanceSheetDebitMinor).toBe(view.offBalanceSheetCreditMinor);

    // OBS rows are EXCLUDED from the on-balance-sheet Dr/Cr totals + the in-balance
    // check (the on-BS book still balances on its own).
    expect(view.inBalance).toBe(true);
  });

  test("settled FX leaves ZERO on-BS receivable/payable AND zero residual OBS commitment (FVTPL settlement)", () => {
    // The accelerated sim settles every trade in-tick → the whole FX book is closed.
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });

    // (1) ZERO on-balance-sheet FX trading receivable/payable. The FVTPL settlement
    // recognises cash + realised P&L and never relieves a gross receivable/payable
    // (trade-date is OBS-only) — so the receivable/payable accounts carry no net.
    const recvPay = new Set(["ACC-2100-001", "ACC-2100-002", "ACC-2100-003", "ACC-2100-004"]);
    const recvPayRows = view.rows.filter((r) => recvPay.has(r.accountId) && r.zarNetMinor !== 0);
    expect(recvPayRows.length).toBe(0);

    // (2) ZERO residual OFF-BALANCE-SHEET commitment — settlement released every
    // trade-date OBS commitment (PR-FX-OBS-RELEASE-V2), so the OBS section nets to
    // zero (no standing ACC-9100-* rows remain).
    const obsRows = view.rows.filter((r) => r.offBalanceSheet && r.zarNetMinor !== 0);
    expect(obsRows.length).toBe(0);

    // (3) Realised FX P&L (ACC-2100-006) IS recognised, and the book balances.
    const realised = view.rows.find((r) => r.accountId === "ACC-2100-006");
    expect(realised).toBeDefined();
    expect(view.inBalance).toBe(true);
  });
});
