// tests/expected-event-watchdog.test.ts
//
// Unit tests for the expected-event watchdog (Trusted-Figures Program,
// objective 4 — loud failure modes). Asserts:
//   - An empty store yields a gap (kind "absent") for every expectation
//     (calc-bound + 4 standalone, including the daily market-risk measure and
//     the BA-310 FX-NOP submission).
//   - A store with all expected events present yields no gaps.
//   - emitExpectedEventGapAlerts emits one SubstrateAlert{integrity} per open
//     gap and is idempotent on a second call (append-only, no duplicates).
//   - The recon manifest gate (run()) passes against the live manifest.
//   - Freshness (maxAgeBusinessDays): the MR-1-FX VaR measure is flagged as a
//     "stale" gap when older than one business day, with a date-stamped alert
//     that re-fires each stale day and stops once a fresh measure lands.
//
// Author: Atlas (Core banking platform architect, engineering); freshness
//         extension by Rohan (Risk engineer, engineering).

import { describe, expect, it } from "bun:test";

import { makeBalanceSheetProjected } from "../platform/event-store/event-types/balance-sheet";
import { makeCalculationPerformed } from "../platform/event-store/event-types/calculation";
import { makeMarketRiskMeasureComputed } from "../platform/event-store/event-types/market-risk-measure";
import { makeDailyPnLReportGenerated } from "../platform/event-store/event-types/product-control";
import { makeSarbSubmissionAttempted } from "../platform/event-store/event-types/regulatory-reporting";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { CALC_BINDINGS } from "../platform/model-registry/calculation-binding";
import {
  businessDaysBetween,
  checkExpectedEvents,
  emitExpectedEventGapAlerts,
  expectedEvents,
  gapAlertId,
  staleGapAlertId,
} from "../platform/model-registry/expected-event-watchdog";
import { run as runReconGate } from "../platform/recon/expected-event-watchdog";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:test:expected-event-watchdog" };
const AS_OF = "2026-05-29T08:00:00.000Z";

/** Append every event the watchdog expects, so the store is gap-free. */
function seedAllExpectedEvents(store: EventStore): void {
  for (const b of Object.values(CALC_BINDINGS)) {
    store.append(
      makeCalculationPerformed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [...b.citations],
        payload: {
          modelId: b.modelId,
          modelVersion: b.modelVersion,
          owningAgent: b.owningAgent,
          figure: b.figure,
          computedAsOf: AS_OF,
          inputs: [],
          output: 1.5,
          outputUnit: b.outputUnit,
          status: "ok",
          missingInputs: [],
        },
      }),
    );
  }

  store.append(
    makeDailyPnLReportGenerated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["IFRS-9-5.7.1"],
      payload: {
        reportId: "pnl-2026-05-29",
        reportDate: "2026-05-29",
        deskId: "FX-SPOT",
        totalUnrealisedPnlZarMinor: 0,
        unrealisedComplete: true,
        unmarkableLivePositions: 0,
        unmarkableLiveTradeIds: [],
        totalRealisedPnlZarMinor: 0,
        totalPnlZarMinor: 0,
        activePositions: 0,
        cancelledPositions: 0,
        byCurrency: [],
        byCounterparty: [],
        byBook: [],
        generatedAt: AS_OF,
        generatedBy: "agent:bea:product-control",
      },
    }),
  );

  store.append(
    makeBalanceSheetProjected({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["BA-326"],
      payload: {
        projectionId: "bs-2026-05-29",
        asOf: AS_OF,
        tier2CapitalZar: 0,
        unsecuredWholesaleFundingGt1yZar: 0,
        coveredBondsIssuedGt6mZar: 0,
        unencumberedRetailLoansLt1yZar: 0,
        unencumberedRetailLoansGt1yZar: 0,
        encumberedAssetsZar: 0,
        offBalanceSheetCommitmentsZar: 0,
      },
    }),
  );

  store.append(
    makeMarketRiskMeasureComputed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["D-BRC-INTERIM-MR-1-FX"],
      payload: {
        measureId: `MR-MEASURE-${ENTITY}-${AS_OF.slice(0, 10)}`,
        asOf: AS_OF,
        status: "no-positions",
        var: { present: false, reason: "flat book", expectedFrom: "live FX positions" },
        svar: { present: false, reason: "flat book", expectedFrom: "live FX positions" },
        es: { present: false, reason: "flat book", expectedFrom: "live FX positions" },
        riskFactorCount: 0,
        minObservations: 0,
        varAppetiteZar: 350_000,
      },
    }),
  );

  store.append(
    makeSarbSubmissionAttempted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["D-BA-RETURN-FORM-NUMBERING-RECON"],
      payload: {
        formId: "BA310",
        formVersion: "v0.1-rehearsal",
        institutionId: ENTITY,
        reportingPeriod: "period:hoz-bank:month:2026-05",
        submittedAt: AS_OF,
        accepted: true,
        referenceNumber: "SARB-TEST-1",
        mode: "simulator",
      },
    }),
  );
}

/** Append one MarketRiskMeasureComputed with a chosen as_of (for freshness tests). */
function seedMarketRiskMeasure(store: EventStore, asOf: string): void {
  store.append(
    makeMarketRiskMeasureComputed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["D-BRC-INTERIM-MR-1-FX"],
      payload: {
        measureId: `MR-MEASURE-${ENTITY}-${asOf.slice(0, 10)}`,
        asOf,
        status: "no-positions",
        var: { present: false, reason: "flat book", expectedFrom: "live FX positions" },
        svar: { present: false, reason: "flat book", expectedFrom: "live FX positions" },
        es: { present: false, reason: "flat book", expectedFrom: "live FX positions" },
        riskFactorCount: 0,
        minObservations: 0,
        varAppetiteZar: 350_000,
      },
    }),
  );
}

describe("expected-event watchdog", () => {
  it("flags every expectation as a gap on an empty store", () => {
    const store = new EventStore();
    const gaps = checkExpectedEvents(store);
    expect(gaps.length).toBe(expectedEvents().length);
    // One calc-bound expectation per CALC_BINDINGS entry + 4 standalone.
    expect(gaps.length).toBe(Object.keys(CALC_BINDINGS).length + 4);
    const ids = new Set(gaps.map((g) => g.id));
    expect(ids.has("daily-pnl")).toBe(true);
    expect(ids.has("balance-sheet")).toBe(true);
    expect(ids.has("mr-1-fx-var-measure")).toBe(true);
    // On an empty store (no asOf → no freshness grading) every gap is "absent"
    // EXCEPT the BA-310 FX-NOP expectation, which carries a dated deferral and
    // surfaces as "deferred" (honest, tracked — not a silent-red fault).
    for (const g of gaps) {
      if (g.id === "ba310-fx-nop-submission") {
        expect(g.kind).toBe("deferred");
        expect(g.deferral).toBeDefined();
      } else {
        expect(g.kind).toBe("absent");
      }
    }
    for (const b of Object.values(CALC_BINDINGS)) {
      expect(ids.has(`calc-${b.calcKey}`)).toBe(true);
    }
  });

  it("surfaces the BA-310 FX-NOP expectation as a dated deferral, not a silent-red gap", () => {
    const store = new EventStore();
    const gaps = checkExpectedEvents(store);
    const ba310 = gaps.find((g) => g.id === "ba310-fx-nop-submission");
    expect(ba310).toBeDefined();
    expect(ba310?.kind).toBe("deferred");
    expect(ba310?.deferral?.since).toBe("2026-06-10");
    expect(ba310?.deferral?.reviewBy).toBeTruthy();
    expect(ba310?.deferral?.clearsWhen).toContain("AccountingPeriodClosed");
    // The rationale carries the DEFERRED disposition inline so the surface
    // reads as a tracked deferral, never an unexplained absence.
    expect(ba310?.rationale).toContain("DEFERRED");
  });

  it("does NOT raise a high-severity integrity alert for a deferred expectation", () => {
    const store = new EventStore();
    const { emitted, skipped } = emitExpectedEventGapAlerts(store, AS_OF);
    // The BA-310 deferral is skipped (no loud alert); every other absent gap
    // still alerts.
    expect(skipped).toContain("ba310-fx-nop-submission");
    expect(emitted).not.toContain("ba310-fx-nop-submission");
    const alertIds = [...store.replay({ type: "SubstrateAlert" })].map(
      (e) => (e.payload as { alertId: string }).alertId,
    );
    expect(alertIds).not.toContain(gapAlertId("ba310-fx-nop-submission"));
  });

  it("clears the BA-310 deferral once a BA-310 submission lands", () => {
    const store = new EventStore();
    expect(checkExpectedEvents(store).some((g) => g.id === "ba310-fx-nop-submission")).toBe(true);
    store.append(
      makeSarbSubmissionAttempted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-BA-RETURN-FORM-NUMBERING-RECON"],
        payload: {
          formId: "BA310",
          formVersion: "v0.1-rehearsal",
          institutionId: ENTITY,
          reportingPeriod: "period:hoz-bank:month:2026-05",
          submittedAt: AS_OF,
          accepted: true,
          referenceNumber: "SARB-TEST-1",
          mode: "simulator",
        },
      }),
    );
    // Once the trigger lands the expectation is present — the deferral is moot.
    expect(checkExpectedEvents(store).some((g) => g.id === "ba310-fx-nop-submission")).toBe(false);
  });

  it("reports no gaps when every expected event is present", () => {
    const store = new EventStore();
    seedAllExpectedEvents(store);
    expect(checkExpectedEvents(store)).toEqual([]);
  });

  it("matches calc expectations by modelId, not bare event type", () => {
    const store = new EventStore();
    // A CalculationPerformed for an unbound model must NOT satisfy any
    // calc-bound expectation — every bound figure stays a gap.
    store.append(
      makeCalculationPerformed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
        payload: {
          modelId: "model:unrelated-v1",
          modelVersion: "1.0.0",
          owningAgent: "Test",
          figure: "Unrelated",
          computedAsOf: AS_OF,
          inputs: [],
          output: 1,
          outputUnit: "pct",
          status: "ok",
          missingInputs: [],
        },
      }),
    );
    const gapIds = new Set(checkExpectedEvents(store).map((g) => g.id));
    for (const b of Object.values(CALC_BINDINGS)) {
      expect(gapIds.has(`calc-${b.calcKey}`)).toBe(true);
    }
  });

  it("emits one SubstrateAlert per non-deferred gap and is idempotent", () => {
    const store = new EventStore();
    // Deferred expectations (BA-310 FX-NOP) raise no loud alert — they are
    // skipped, surfaced only as a tracked deferral. Genuine gaps still alert.
    const deferredCount = expectedEvents().filter((e) => e.deferral).length;
    const alertableCount = expectedEvents().length - deferredCount;

    const first = emitExpectedEventGapAlerts(store, AS_OF);
    expect(first.emitted.length).toBe(alertableCount);
    expect(first.skipped.length).toBe(deferredCount);

    const alertIds = [...store.replay({ type: "SubstrateAlert" })].map(
      (e) => (e.payload as { alertId: string }).alertId,
    );
    expect(alertIds.length).toBe(alertableCount);
    for (const exp of expectedEvents()) {
      if (exp.deferral) {
        expect(alertIds).not.toContain(gapAlertId(exp.id));
      } else {
        expect(alertIds).toContain(gapAlertId(exp.id));
      }
    }

    // Second call: every genuine gap already alerted → all skipped, none
    // re-emitted (deferrals stay skipped too).
    const second = emitExpectedEventGapAlerts(store, AS_OF);
    expect(second.emitted).toEqual([]);
    expect(second.skipped.length).toBe(expectedEvents().length);
    expect([...store.replay({ type: "SubstrateAlert" })].length).toBe(alertableCount);
  });

  it("stops alerting a gap once its expected event lands", () => {
    const store = new EventStore();
    emitExpectedEventGapAlerts(store, AS_OF);
    const before = [...store.replay({ type: "SubstrateAlert" })].length;
    // Resolve every gap, then re-run — no new alerts.
    seedAllExpectedEvents(store);
    const third = emitExpectedEventGapAlerts(store, AS_OF);
    expect(third.emitted).toEqual([]);
    expect([...store.replay({ type: "SubstrateAlert" })].length).toBe(before);
  });

  it("passes the recon manifest gate", () => {
    const result = runReconGate();
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(expectedEvents().length);
  });
});

describe("expected-event watchdog — freshness (maxAgeBusinessDays)", () => {
  // The MR-1-FX VaR measure carries maxAgeBusinessDays: 1. These tests exercise
  // the freshness extension (FX functionality domain review gap #4 watchdog).

  it("businessDaysBetween counts Mon–Fri only and skips weekends", () => {
    // Fri 2026-06-05 → Mon 2026-06-08 is ONE business day (Sat/Sun skipped).
    expect(
      businessDaysBetween(
        new Date("2026-06-05T00:00:00.000Z"),
        new Date("2026-06-08T18:30:00.000Z"),
      ),
    ).toBe(1);
    // Mon 2026-06-08 → Wed 2026-06-10 is two business days.
    expect(
      businessDaysBetween(
        new Date("2026-06-08T00:00:00.000Z"),
        new Date("2026-06-10T18:30:00.000Z"),
      ),
    ).toBe(2);
    // Same instant → 0.
    expect(
      businessDaysBetween(
        new Date("2026-06-08T18:30:00.000Z"),
        new Date("2026-06-08T18:30:00.000Z"),
      ),
    ).toBe(0);
    // Later before earlier → 0.
    expect(
      businessDaysBetween(
        new Date("2026-06-09T00:00:00.000Z"),
        new Date("2026-06-08T00:00:00.000Z"),
      ),
    ).toBe(0);
  });

  it("does NOT flag a same-day MarketRiskMeasureComputed as stale", () => {
    const store = new EventStore();
    const asOf = "2026-06-08T18:30:00.000Z"; // Monday
    seedMarketRiskMeasure(store, asOf);
    const gap = checkExpectedEvents(store, asOf).find((g) => g.id === "mr-1-fx-var-measure");
    expect(gap).toBeUndefined();
  });

  it("does NOT flag a measure one business day old (within the window)", () => {
    const store = new EventStore();
    // Measure as_of Friday; check as_of Monday — exactly 1 business day (weekend skipped).
    seedMarketRiskMeasure(store, "2026-06-05T18:30:00.000Z");
    const gap = checkExpectedEvents(store, "2026-06-08T18:30:00.000Z").find(
      (g) => g.id === "mr-1-fx-var-measure",
    );
    expect(gap).toBeUndefined();
  });

  it("flags a measure older than one business day as a STALE gap", () => {
    const store = new EventStore();
    // Measure as_of Monday; check as_of Thursday — 3 business days old > window 1.
    seedMarketRiskMeasure(store, "2026-06-08T18:30:00.000Z");
    const asOf = "2026-06-11T18:30:00.000Z";
    const gap = checkExpectedEvents(store, asOf).find((g) => g.id === "mr-1-fx-var-measure");
    expect(gap).toBeDefined();
    expect(gap?.kind).toBe("stale");
    expect(gap?.latestAsOf).toBe("2026-06-08T18:30:00.000Z");
  });

  it("presence-only check (no asOf) treats a stale measure as present", () => {
    const store = new EventStore();
    seedMarketRiskMeasure(store, "2026-06-08T18:30:00.000Z");
    // No asOf → freshness window is not evaluated; the figure is present.
    const gap = checkExpectedEvents(store).find((g) => g.id === "mr-1-fx-var-measure");
    expect(gap).toBeUndefined();
  });

  it("emits a date-stamped stale alert that re-fires on a later stale day", () => {
    const store = new EventStore();
    seedMarketRiskMeasure(store, "2026-06-08T18:30:00.000Z");

    // Thursday: stale → one stale alert, date-stamped for that day.
    const thu = "2026-06-11T18:30:00.000Z";
    const r1 = emitExpectedEventGapAlerts(store, thu);
    expect(r1.emitted).toContain("mr-1-fx-var-measure");
    const alertIds1 = [...store.replay({ type: "SubstrateAlert" })].map(
      (e) => (e.payload as { alertId: string }).alertId,
    );
    expect(alertIds1).toContain(staleGapAlertId("mr-1-fx-var-measure", thu));

    // Same day re-run: idempotent — the date-stamped stale alert is skipped.
    const r1b = emitExpectedEventGapAlerts(store, thu);
    expect(r1b.emitted).not.toContain("mr-1-fx-var-measure");
    expect(r1b.skipped).toContain("mr-1-fx-var-measure");

    // Friday: still stale, NEW day → a fresh date-stamped stale alert fires.
    const fri = "2026-06-12T18:30:00.000Z";
    const r2 = emitExpectedEventGapAlerts(store, fri);
    expect(r2.emitted).toContain("mr-1-fx-var-measure");
    const alertIds2 = [...store.replay({ type: "SubstrateAlert" })].map(
      (e) => (e.payload as { alertId: string }).alertId,
    );
    expect(alertIds2).toContain(staleGapAlertId("mr-1-fx-var-measure", fri));
  });

  it("stops alerting once a fresh measure lands", () => {
    const store = new EventStore();
    seedMarketRiskMeasure(store, "2026-06-08T18:30:00.000Z");
    const stale = "2026-06-11T18:30:00.000Z";
    emitExpectedEventGapAlerts(store, stale);
    const before = [...store.replay({ type: "SubstrateAlert" })].length;
    // A fresh measure lands for the check day — no longer stale.
    seedMarketRiskMeasure(store, stale);
    const after = emitExpectedEventGapAlerts(store, stale);
    expect(after.emitted).not.toContain("mr-1-fx-var-measure");
    // No new stale alert for mr-1-fx-var-measure (other gaps may still alert,
    // but the freshly-marked measure must not).
    const staleAlerts = [...store.replay({ type: "SubstrateAlert" })]
      .map((e) => (e.payload as { alertId: string }).alertId)
      .filter((id) => id.startsWith("alert:integrity:expected-event-stale-mr-1-fx-var-measure"));
    expect(staleAlerts.length).toBe(1); // only the one from the stale day
    expect(before).toBeGreaterThan(0);
  });
});
