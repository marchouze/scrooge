// dashboard/v2-finance-gl-view.test.ts
//
// Tests for the GL trial-balance view: ONE row per (account, currency) with a
// native-CCY Dr/Cr + a ZAR-equivalent column. The in-balance check is on the
// ZAR-equivalent (functional) totals — native minor units across currencies are
// not summable (Principle 5). A shared account holding two currencies yields TWO
// per-currency rows, NEVER a single `currency: "multi"` row.
//
// Two store fixtures:
//   - The live FX V2 simulator (books simulated FX trades + ingests production
//     marks) for the end-to-end FX book under the +Sim lens.
//   - A deterministic GlPostingEmitted fixture (production provenance) that posts
//     a shared account (realised-FX-P&L, ACC-2100-006) in BOTH USD and ZAR, to
//     prove the two-per-currency-rows / no-"multi" invariant directly.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { money } from "../platform/core/decimal-money";
import { encodeMoney } from "../platform/core/money-codec";
import type { Currency } from "../platform/core/types";
import {
  type GlPostingEmittedPayload,
  makeGlPostingEmitted,
} from "../platform/event-store/event-types/fx-accounting";
import { makePolicyVersionActivated } from "../platform/event-store/event-types/policy-activation";
import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { productionTag } from "../platform/event-store/provenance";
import { EventStore } from "../platform/event-store/store";
import type { Actor, Event } from "../platform/event-store/types";
import { MarketDataStore } from "../platform/market-data/store";
import {
  adoptDailyOfficialFxMarks,
  resolveActivePolicyVersionRef,
} from "../platform/valuation/mark-adoption-engine";
import { V2_PERIOD_END } from "../platform/projections/v2-read-window";
import { V2LiveFxDriver } from "../platform/simulation-v2-live/live-driver";
import { emitClientOnboardingLifecycle } from "../platform/simulation-v2/sim-modules/counterparty-provisioning";
import { tenantIdSchema } from "../v2-core/control-plane/tenant";
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

// The live driver now trades ONLY with in-sim onboarded FX-eligible clients
// (D-FX-SIM-LIVE-REALTIME-ONBOARDED) — no seed fallback. Onboard one simulated
// client so the driver has a counterparty; an empty store would fail-closed.
function seedOnboardedSimClient(store: EventStore): void {
  emitClientOnboardingLifecycle({
    store,
    scenarioId: "fx-v2-live",
    asOf: "2026-02-02T07:00:00.000Z",
    counterparty: {
      counterpartyId: "CP-SIM-ACME-100",
      name: "Acme Sim Bank",
      bic: "ACMEZAJJXXX",
      eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
      behaviourProfile: "reliable",
      agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
    },
  });
}

/** Activate the founding valuation policy so adoptDailyOfficialFxMarks can resolve
 *  a policy-version ref and emit OfficialMarkAdopted marks (the EOD-MTM reval reads
 *  these closing marks; missing → fail-closed). */
function seedValuationPolicy(store: EventStore): void {
  const ev = makePolicyVersionActivated({
    asOf: "2026-01-01T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:helena:cro" },
    citations: ["Policies/valuation-policy-v1.md"],
    payload: {
      policyDomain: "valuation",
      policyId: "VALUATION-POLICY-V1",
      version: "1.0",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      documentHash: `blake3:${"a".repeat(64)}`,
      supersedes: null,
      activatedBy: "agent:helena:cro",
    },
  });
  store.append({ ...ev, provenance: PROD_TAG });
}

function populatedStores(): { eventStore: EventStore; marketDataStore: MarketDataStore } {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  seedFxTreatment(eventStore);
  seedValuationPolicy(eventStore);
  seedOnboardedSimClient(eventStore);
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    config: { tradesPerTick: 2, seed: 0x9911 },
  });
  for (let i = 0; i < 5; i++) driver.tickOnce();
  // EOD-MTM closing marks for the whole production feed universe (the same daily
  // feed-marking the MTM run does) — so the settled-FCY-cash reval has an
  // event-sourced closing mark per held currency (no-silent-zero).
  const ref = resolveActivePolicyVersionRef(eventStore);
  adoptDailyOfficialFxMarks(eventStore, marketDataStore, V2_PERIOD_END, ref);
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
  seedOnboardedSimClient(eventStore);
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    config: { tradesPerTick: 2, seed: 0x9911, settlementMode: "realtime" },
  });
  driver.tickOnce();
  return { eventStore, marketDataStore };
}

// ---------------------------------------------------------------------------
// Deterministic GlPostingEmitted fixture — a SHARED account (realised-FX-P&L,
// ACC-2100-006) posted in BOTH USD and ZAR, with a balancing counter-leg in each
// currency so every currency self-balances (and therefore the ZAR-equivalent
// functional totals balance). A USD/ZAR production mark is ingested so the ZAR
// equivalent is available (honest, not a silent zero).
// ---------------------------------------------------------------------------

const ACTOR: Actor = { type: "system", id: "atlas:gl-view-multi-ccy-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["Principle-5"];
const PROD = productionTag({ sourceLineage: "atlas:gl-view-multi-ccy-test" });
const TENANT = tenantIdSchema.parse("tenant:za-bank");

function wire(amount: string, currency: string) {
  return encodeMoney(money(amount, currency as Currency));
}

function appendLeg(
  store: EventStore,
  leg: {
    accountCode: string;
    creditDebit: "debit" | "credit";
    amount: ReturnType<typeof wire>;
    postingDate: string;
    postingRuleId?: string;
  },
): void {
  const payload: GlPostingEmittedPayload = {
    creditDebit: leg.creditDebit,
    accountCode: leg.accountCode,
    amount: leg.amount,
    postingDate: leg.postingDate,
    tenantId: TENANT,
    sourceEventId: "src:gl-view-multi-ccy-test",
    iasRule: "IFRS 9 §3.1.1",
    // Non-FX (capital) rule id: the GlPostingEmitted read path serves NON-FX
    // accounts (FX is a pure fold over FIL events). A capital rule id exercises the
    // generic GlPostingEmitted projection mechanics for this fixture.
    postingRuleId: leg.postingRuleId ?? "PR-CAP-001-V2",
    description: "multi-currency shared-account fixture",
  };
  const ev = makeGlPostingEmitted({
    asOf: `${leg.postingDate}T00:00:00.000Z`,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload,
  });
  const tagged: Event = { ...ev, provenance: PROD };
  store.append(tagged);
}

/**
 * Build a store where the shared realised-FX-P&L account (ACC-2100-006) carries a
 * USD leg AND a ZAR leg, each balanced by a counter-leg in the same currency. A
 * USD/ZAR production mark is ingested so the ZAR equivalent is available.
 */
function sharedAccountTwoCurrencyStores(): {
  eventStore: EventStore;
  marketDataStore: MarketDataStore;
} {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");

  // USD/ZAR production mark so the USD leg has an honest ZAR equivalent. The view
  // reads it via lookupQuoteWithInverse(store, "USD/ZAR", { provenance: "production" }),
  // which queries { instrument: "USD/ZAR", dataType: "fx-quote" } and derives the mid.
  marketDataStore.append({
    id: "tick:usdzar:gl-view-test",
    source: "gl-view-test",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: "2026-06-10T00:00:00.000Z",
    payload: { mid: 18.5 },
  });

  // Shared account (realised FX P&L) — USD credit, balanced by a USD debit counter.
  appendLeg(eventStore, {
    accountCode: "ACC-2100-006",
    creditDebit: "credit",
    amount: wire("1000.00", "USD"),
    postingDate: "2026-06-10",
  });
  appendLeg(eventStore, {
    accountCode: "ACC-2100-027",
    creditDebit: "debit",
    amount: wire("1000.00", "USD"),
    postingDate: "2026-06-10",
  });

  // Same shared account — ZAR debit, balanced by a ZAR credit counter.
  appendLeg(eventStore, {
    accountCode: "ACC-2100-006",
    creditDebit: "debit",
    amount: wire("5000.00", "ZAR"),
    postingDate: "2026-06-10",
  });
  appendLeg(eventStore, {
    accountCode: "ACC-2100-027",
    creditDebit: "credit",
    amount: wire("5000.00", "ZAR"),
    postingDate: "2026-06-10",
  });

  return { eventStore, marketDataStore };
}

describe("buildGlView — per-(account,currency) TB + CCY/ZAR-equivalent", () => {
  test("production-only lens is honestly empty (sim is simulated provenance)", () => {
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "production-only" } });
    expect(view.dataState).toBe("empty");
    expect(view.rows.length).toBe(0);
  });

  test("+Sim lens: rows are keyed per (account, currency); NO 'multi' sentinel anywhere", () => {
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });
    expect(view.dataState).toBe("live");
    expect(view.rows.length).toBeGreaterThan(0);
    // No row carries the retired "multi" sentinel — every currency is a real ISO code.
    expect(view.rows.every((r) => r.currency !== "multi")).toBe(true);
    // Each (accountId, currency) pair is unique — no duplicate per-currency rows.
    const keys = view.rows.map((r) => `${r.accountId}|${r.currency}`);
    expect(new Set(keys).size).toBe(keys.length);
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

  test("the MULTI-trade settled ZAR TB balances PRE- AND POST-EOD-MTM (per-entry ZAR invariant; #1617 gap CLOSED)", () => {
    // IAS 21 §21: the in-balance invariant is the FUNCTIONAL (ZAR-equivalent) one,
    // asserted PER-ENTRY — every Dr/Cr pair is ZAR-equal at its own rate, so the sum
    // balances by construction (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1, CEO 2026-06-29;
    // strengthens D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1). The #1617-documented gap is
    // now CLOSED: settled FCY cash (a §23 monetary item) is revalued daily to the
    // closing official mark, the unrealised exchange-difference contra (§28) posted
    // into the GL fold — so the multi-trade functional TB nets to ZERO.
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });
    expect(view.zarTotalDebitMinor).toBeGreaterThan(0);
    expect(view.zarTotalCreditMinor).toBeGreaterThan(0);
    // `inBalance` is the functional comparison, never the native one.
    expect(view.inBalance).toBe(view.zarTotalDebitMinor === view.zarTotalCreditMinor);
    // POST-EOD-MTM: the multi-trade settled book balances to the cent (TRUE balance,
    // not the previously-documented reval gap). The settled USD + EUR nostro cash is
    // carried at SETTLE-rate cost basis and the EOD-MTM reval (ACC-1200-099 ↔
    // ACC-2100-005) carries it to the closing mark — both legs ZAR-equal, so the
    // entry self-balances. No concealment (Engineering Charter cmd 3): the residual
    // is genuinely zero because the missing reval contra is now folded.
    expect(view.zarTotalDebitMinor - view.zarTotalCreditMinor).toBe(0);
    expect(view.inBalance).toBe(true);
    // PROOF the gap-closing reval actually ran (not a vacuous zero): the §23
    // retranslation-adjustment account + the §28 unrealised-P&L contra are both
    // populated and equal-and-opposite (a balanced ZAR entry).
    const retrans = view.rows.find((r) => r.accountId === "ACC-1200-099");
    const unrealised = view.rows.find((r) => r.accountId === "ACC-2100-005");
    expect(retrans).toBeDefined();
    expect(unrealised).toBeDefined();
    if (retrans && unrealised) {
      expect(retrans.zarNetMinor).toBe(-unrealised.zarNetMinor);
      expect(retrans.zarNetMinor).not.toBe(0);
    }
  });

  test("SHARED account with USD + ZAR postings yields TWO per-currency rows, ZERO 'multi'", () => {
    const { eventStore, marketDataStore } = sharedAccountTwoCurrencyStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "production-only" } });

    // ACC-2100-006 (realised FX P&L) was posted in BOTH USD and ZAR → TWO rows.
    const shared = view.rows.filter((r) => r.accountId === "ACC-2100-006");
    expect(shared.length).toBe(2);
    const currencies = shared.map((r) => r.currency).sort();
    expect(currencies).toEqual(["USD", "ZAR"]);

    // NEVER a "multi" sentinel — across the WHOLE view, not just this account.
    expect(view.rows.some((r) => r.currency === "multi")).toBe(false);

    // Each per-currency row carries a MEANINGFUL native Dr/Cr in its own currency.
    const usdRow = shared.find((r) => r.currency === "USD");
    const zarRow = shared.find((r) => r.currency === "ZAR");
    expect(usdRow).toBeDefined();
    expect(zarRow).toBeDefined();
    if (usdRow) {
      // Posted as a net USD credit of 1000.00 → 100000 minor credit.
      expect(usdRow.creditMinor).toBe(100000);
      expect(usdRow.debitMinor).toBe(0);
      expect(usdRow.creditFmt).not.toBe("");
      // Honest ZAR equivalent at the ingested 18.5 mark.
      expect(usdRow.zarRateAvailable).toBe(true);
      expect(Math.abs(usdRow.zarNetMinor)).toBe(Math.round(100000 * 18.5));
    }
    if (zarRow) {
      // Posted as a net ZAR debit of 5000.00 → 500000 minor debit; ZAR is identity.
      expect(zarRow.debitMinor).toBe(500000);
      expect(zarRow.creditMinor).toBe(0);
      expect(zarRow.zarNetMinor).toBe(zarRow.netMinor);
    }

    // Rows are sorted by account then currency (USD before ZAR for the shared acct).
    expect(shared[0]?.currency).toBe("USD");
    expect(shared[1]?.currency).toBe("ZAR");

    // The book self-balances per currency → the ZAR functional in-balance check holds.
    expect(view.inBalance).toBe(true);
  });

  test("missing production FX rate is honest (zarRateAvailable=false), not a fake zero", () => {
    // No USD/ZAR mark ingested → the USD leg has no production rate.
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    appendLeg(eventStore, {
      accountCode: "ACC-2100-006",
      creditDebit: "credit",
      amount: wire("1000.00", "USD"),
      postingDate: "2026-06-10",
    });
    appendLeg(eventStore, {
      accountCode: "ACC-2100-027",
      creditDebit: "debit",
      amount: wire("1000.00", "USD"),
      postingDate: "2026-06-10",
    });
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "production-only" } });

    const usd = view.rows.find((r) => r.accountId === "ACC-2100-006" && r.currency === "USD");
    expect(usd).toBeDefined();
    if (usd) {
      // Native figure is preserved and meaningful…
      expect(usd.creditMinor).toBe(100000);
      // …but the ZAR equivalent is HONESTLY unavailable, never a fake R0.
      expect(usd.zarRateAvailable).toBe(false);
      expect(usd.zarNetFmt).toBe("rate n/a");
    }
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
    // OBS rows are per-currency real rows too — never "multi".
    expect(obsRows.every((r) => r.currency !== "multi")).toBe(true);

    // The OBS section self-balances and is reported in its own totals (ZAR-equiv).
    expect(view.offBalanceSheetInBalance).toBe(true);
    expect(view.offBalanceSheetDebitMinor).toBeGreaterThan(0);
    expect(view.offBalanceSheetDebitMinor).toBe(view.offBalanceSheetCreditMinor);

    // OBS rows are EXCLUDED from the on-balance-sheet in-balance check (the on-BS
    // book still balances on its own).
    expect(view.inBalance).toBe(true);
  });

  test("settled FX leaves ZERO on-BS receivable/payable AND zero residual OBS commitment (P&L-neutral settlement)", () => {
    // The accelerated sim settles every trade in-tick → the whole FX book is closed.
    const { eventStore, marketDataStore } = populatedStores();
    const view = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });

    // (1) ZERO on-balance-sheet FX trading receivable/payable. The P&L-neutral
    // settlement recognises cash + clearing and never relieves a gross
    // receivable/payable (trade-date is OBS-only) — so those accounts carry no net.
    const recvPay = new Set(["ACC-2100-001", "ACC-2100-002", "ACC-2100-003", "ACC-2100-004"]);
    const recvPayRows = view.rows.filter((r) => recvPay.has(r.accountId) && r.zarNetMinor !== 0);
    expect(recvPayRows.length).toBe(0);

    // (2) ZERO residual OFF-BALANCE-SHEET commitment — settlement released every
    // trade-date OBS commitment (PR-FX-OBS-RELEASE-V2), so the OBS section nets to
    // zero (no standing ACC-9100-* rows remain).
    const obsRows = view.rows.filter((r) => r.offBalanceSheet && r.zarNetMinor !== 0);
    expect(obsRows.length).toBe(0);

    // (3) P&L-NEUTRAL settlement (D-FX-PNL-FCY-EXPOSURE-REVALUATION): settlement
    // strikes NO realised FX P&L — the realised-P&L account (ACC-2100-006) carries
    // no net from settlement (realisation is reserved to a FCY→ZAR conversion).
    const realisedRows = view.rows.filter((r) => r.accountId === "ACC-2100-006");
    expect(realisedRows.every((r) => r.zarNetMinor === 0)).toBe(true);

    // (4) NOSTRO-TO-NOSTRO settlement (D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1): the
    // settled cash lives in the FCY/ZAR nostros (ACC-1200-*), with NO standing FX
    // settlement clearing balance (ACC-2100-027) — the remediation of Nadia's MEDIUM
    // finding. The closing-mark functional in-balance on this MULTI-trade settled
    // book is now TRUE (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1): the settled FCY cash
    // is revalued daily to the closing official mark with its §28 P&L contra, so the
    // ZAR TB nets to zero (the #1617 gap is closed — see the per-entry-invariant test
    // above).
    const clearingRows = view.rows.filter((r) => r.accountId === "ACC-2100-027");
    expect(clearingRows.every((r) => r.netMinor === 0)).toBe(true);
    const nostroRows = view.rows.filter((r) => r.accountId.startsWith("ACC-1200-"));
    expect(nostroRows.length).toBeGreaterThan(0);
    // The settled multi-trade book balances in ZAR at the closing marks (true zero).
    expect(view.inBalance).toBe(true);
    expect(view.zarTotalDebitMinor - view.zarTotalCreditMinor).toBe(0);
  });
});
