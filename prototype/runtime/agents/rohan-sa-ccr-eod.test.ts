// runtime/agents/rohan-sa-ccr-eod.test.ts
//
// Tests for the daily SA-CCR EOD cadence (tracked deferred gap
// `fx-sa-ccr-daily-cadence`, credit-risk dimension of prd:bank:fx:otc-vanilla):
//
//   1. Idempotency of the driver the handler wraps (`runSaCcrForFxPositions`):
//      a same-day double-run emits nothing new — every live netting set already
//      EAD-computed for the asOf date is skipped (`skippedAlreadyComputed`),
//      `computeAndEmitFor` is never reached, and the store gains zero events.
//      This is the load-bearing property the scheduled cadence (and any
//      workflow retry) relies on.
//   2. The per-netting-set staleness watchdog expectations
//      (`saCcrFxNettingSetExpectations`, reusing the #1102 expected-event
//      watchdog): live + registered netting sets are asserted fresh
//      (maxAgeBusinessDays 1); a flat book or an unregistered netting set
//      raises no expectation; ids are SubstrateAlert-alertId-safe even for
//      URN-form counterparty ids.
//
// Driven against isolated in-memory stores so the assertions do not depend on
// the composition singleton (the emit boundary, `computeAndEmitFor`, is
// deliberately never reached in these tests).
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP; D-FX-SA-CCR-BUILD-PHASE-ACTIVATION.
// Author: Rohan (Risk engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makeCcrEadComputed } from "../../platform/event-store/event-types/counterparty-credit-risk";
import { makeISDACSAAssessmentCompleted } from "../../platform/event-store/event-types/credit-limit";
import { EventStore } from "../../platform/event-store/store";
import { makeFxTradeExecuted } from "../../platform/markets/cdm/fx";
import {
  checkExpectedEvents,
  saCcrExpectationId,
  saCcrFxNettingSetExpectations,
} from "../../platform/model-registry/expected-event-watchdog";
import { setDefaultProvenanceModeOverride } from "../../platform/projections/filter";
import { runSaCcrForFxPositions } from "../../platform/risk/sa-ccr/positions-to-summaries";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:test:sa-ccr-eod" };
const CITES = ["D-FX-SA-CCR-BUILD-PHASE-ACTIVATION"];
const AS_OF = "2026-06-12T19:00:00.000Z"; // Friday, post-MTM cadence slot
// Booked the prior business day — live at AS_OF's 00:00 UTC, so the watchdog's
// first-trade-today grace does NOT apply and an absent EAD is a genuine gap.
const BOOKED_YESTERDAY = "2026-06-11T10:00:00.000Z";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

/** SubstrateAlert alertId slug shape (mirror of substrateAlertPayloadSchema). */
const ALERT_ID_RE = /^alert:[a-z]+:[a-z0-9-]+$/;

function appendFxTrade(store: EventStore, tradeId: string, cp: string, asOf = AS_OF): void {
  store.append(
    makeFxTradeExecuted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 18_000_000 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 18 },
            settlementDate: { iso: "2026-06-16", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-06-12", calendar: "JIHCAL" },
        counterparty: { partyId: cp, name: cp, role: "counterparty", jurisdiction: "ZA" },
        venue: "OTC",
        trader: "trader:test",
        bookId: "FX-BOOK",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        clientFlowRef: `cf:${tradeId}`,
      },
    }),
  );
}

function appendEad(store: EventStore, nettingSetId: string, cp: string, asOf: string): void {
  store.append(
    makeCcrEadComputed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        nettingSetId,
        counterpartyId: cp,
        rc: 0,
        pfe: 720_000,
        alpha: 1.4,
        ead: 1_008_000,
        currency: "ZAR",
        computationDate: asOf.slice(0, 10),
        methodology: "sa-ccr",
        sourceEvents: { rcEventId: `rc-${nettingSetId}-${asOf.slice(0, 10)}`, pfeComponents: 1 },
      },
    }),
  );
}

function registerNettingSet(store: EventStore, cp: string): void {
  store.append(
    makeISDACSAAssessmentCompleted({
      asOf: "2026-06-01T08:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        counterpartyId: cp,
        isdaStatus: "executed",
        csaThreshold: 0,
        mta: 0,
        currency: "ZAR",
        nettingEnforceable: true,
        assessedBy: "agent:test:sa-ccr-eod",
        assessedAt: "2026-06-01T08:00:00.000Z",
      },
    }),
  );
}

function eventCount(store: EventStore): number {
  return [...store.replay({})].length;
}

describe("rohan:sa-ccr-eod — same-day double-run idempotency", () => {
  it("skips every netting set already EAD-computed for the asOf date and emits nothing new", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, "T-SACCR-1", "CP-A");
    appendFxTrade(store, "T-SACCR-2", "CP-B");
    // Simulate run 1's output: today's EAD already on the store for both
    // live netting sets.
    appendEad(store, "NS-CP-A-ZAR", "CP-A", AS_OF);
    appendEad(store, "NS-CP-B-ZAR", "CP-B", AS_OF);

    const before = eventCount(store);
    // Run 2, same day — the workflow-retry / double-tick shape.
    const r = runSaCcrForFxPositions(store, AS_OF);

    expect(r.emitted).toEqual([]);
    expect(r.skippedAlreadyComputed.sort()).toEqual(["NS-CP-A-ZAR", "NS-CP-B-ZAR"]);
    expect(r.skippedNoNettingSet).toEqual([]);
    // Nothing new landed anywhere: with every group skipped, the emit
    // boundary (computeAndEmitFor) is never reached.
    expect(eventCount(store)).toBe(before);
    store.close();
  });

  it("keys idempotency on the computationDate — yesterday's EAD does not satisfy today", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, "T-SACCR-3", "CP-C");
    // Yesterday's computation only.
    appendEad(store, "NS-CP-C-ZAR", "CP-C", "2026-06-11T19:00:00.000Z");

    const r = runSaCcrForFxPositions(store, AS_OF);
    // NOT skipped-as-already-computed: the driver proceeds to compute for
    // today. (In this isolated store no netting set is registered on the
    // composition register, so the outcome is skippedNoNettingSet — the
    // assertion here is the date-keying of the idempotency guard.)
    expect(r.skippedAlreadyComputed).toEqual([]);
    expect(r.skippedNoNettingSet).toEqual(["NS-CP-C-ZAR"]);
    store.close();
  });
});

describe("sa-ccr staleness watchdog — per live netting set", () => {
  it("derives one freshness expectation per LIVE + REGISTERED netting set", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, "T-W-1", "CP-A", BOOKED_YESTERDAY); // live + registered → expectation
    registerNettingSet(store, "CP-A");
    appendFxTrade(store, "T-W-2", "CP-B", BOOKED_YESTERDAY); // live but UNregistered → none
    registerNettingSet(store, "CP-FLAT"); // registered but flat book → none

    const exps = saCcrFxNettingSetExpectations(store, AS_OF);
    expect(exps.map((e) => e.id)).toEqual([saCcrExpectationId("NS-CP-A-ZAR")]);
    expect(exps[0]?.eventType).toBe("CcrEadComputed");
    expect(exps[0]?.maxAgeBusinessDays).toBe(1);
    store.close();
  });

  it("flags a missing EAD as an absent gap and a stale EAD as a stale gap; fresh is clean", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, "T-W-3", "CP-A", BOOKED_YESTERDAY);
    registerNettingSet(store, "CP-A");
    const expectationId = saCcrExpectationId("NS-CP-A-ZAR");

    // No CcrEadComputed at all → absent.
    const absent = checkExpectedEvents(store, AS_OF).filter((g) => g.id === expectationId);
    expect(absent.map((g) => g.kind)).toEqual(["absent"]);

    // EAD from Tuesday checked on Friday (3 business days) → stale.
    appendEad(store, "NS-CP-A-ZAR", "CP-A", "2026-06-09T19:00:00.000Z");
    const stale = checkExpectedEvents(store, AS_OF).filter((g) => g.id === expectationId);
    expect(stale.map((g) => g.kind)).toEqual(["stale"]);

    // Fresh same-day EAD → no gap.
    appendEad(store, "NS-CP-A-ZAR", "CP-A", AS_OF);
    const clean = checkExpectedEvents(store, AS_OF).filter((g) => g.id === expectationId);
    expect(clean).toEqual([]);
    store.close();
  });

  it("is scoped per netting set — one fresh EAD does not mask another set's staleness", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, "T-W-4", "CP-A", BOOKED_YESTERDAY);
    appendFxTrade(store, "T-W-5", "CP-B", BOOKED_YESTERDAY);
    registerNettingSet(store, "CP-A");
    registerNettingSet(store, "CP-B");
    appendEad(store, "NS-CP-A-ZAR", "CP-A", AS_OF); // fresh
    // NS-CP-B-ZAR has no EAD.

    const gaps = checkExpectedEvents(store, AS_OF);
    expect(gaps.some((g) => g.id === saCcrExpectationId("NS-CP-B-ZAR"))).toBe(true);
    expect(gaps.some((g) => g.id === saCcrExpectationId("NS-CP-A-ZAR"))).toBe(false);
    store.close();
  });

  it("grants a first-trade-today grace — no expectation before the EOD run has had a chance", () => {
    const store = new EventStore(":memory:");
    // First trade lands TODAY (intraday, before the 19:00 EOD slot) and the
    // netting set has no EAD history → no expectation yet (an intraday
    // "absent" would be a false-positive high alert).
    appendFxTrade(store, "T-W-7", "CP-NEW", "2026-06-12T10:00:00.000Z");
    registerNettingSet(store, "CP-NEW");
    expect(saCcrFxNettingSetExpectations(store, "2026-06-12T12:00:00.000Z")).toEqual([]);

    // The NEXT business day the grace has lapsed: the set was live at 00:00,
    // so a still-missing EAD is a genuine absent gap.
    const nextDay = saCcrFxNettingSetExpectations(store, "2026-06-15T12:00:00.000Z");
    expect(nextDay.map((e) => e.id)).toEqual([saCcrExpectationId("NS-CP-NEW-ZAR")]);

    // And once ANY EAD history exists, the freshness window governs even on
    // the first day (no grace needed).
    appendEad(store, "NS-CP-NEW-ZAR", "CP-NEW", "2026-06-12T11:00:00.000Z");
    const withHistory = saCcrFxNettingSetExpectations(store, "2026-06-12T12:00:00.000Z");
    expect(withHistory.map((e) => e.id)).toEqual([saCcrExpectationId("NS-CP-NEW-ZAR")]);
    store.close();
  });

  it("presence-only contract (no asOf) skips the store-derived expectations", () => {
    const store = new EventStore(":memory:");
    appendFxTrade(store, "T-W-6", "CP-A");
    registerNettingSet(store, "CP-A");
    const gaps = checkExpectedEvents(store);
    expect(gaps.some((g) => g.id.startsWith("sa-ccr-fx-ead-"))).toBe(false);
    store.close();
  });

  it("expectation ids are SubstrateAlert-alertId-safe, including URN-form counterparty ids", () => {
    const urnNs = "NS-urn:party:legal-entity:investec-bank-za-ZAR";
    const id = saCcrExpectationId(urnNs);
    expect(id).toBe("sa-ccr-fx-ead-ns-urn-party-legal-entity-investec-bank-za-zar");
    expect(ALERT_ID_RE.test(`alert:integrity:expected-event-${id}`)).toBe(true);
    expect(ALERT_ID_RE.test(`alert:integrity:expected-event-stale-${id}-2026-06-12`)).toBe(true);
  });
});
