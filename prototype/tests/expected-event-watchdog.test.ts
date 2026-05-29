// tests/expected-event-watchdog.test.ts
//
// Unit tests for the expected-event watchdog (Trusted-Figures Program,
// objective 4 — loud failure modes). Asserts:
//   - An empty store yields a gap for every expectation (3 calc-bound + 2
//     standalone = 5).
//   - A store with all expected events present yields no gaps.
//   - emitExpectedEventGapAlerts emits one SubstrateAlert{integrity} per open
//     gap and is idempotent on a second call (append-only, no duplicates).
//   - The recon manifest gate (run()) passes against the live manifest.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { makeBalanceSheetProjected } from "../platform/event-store/event-types/balance-sheet";
import { makeCalculationPerformed } from "../platform/event-store/event-types/calculation";
import { makeDailyPnLReportGenerated } from "../platform/event-store/event-types/product-control";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { CALC_BINDINGS } from "../platform/model-registry/calculation-binding";
import {
  checkExpectedEvents,
  emitExpectedEventGapAlerts,
  expectedEvents,
  gapAlertId,
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
        totalRealisedPnlZarMinor: 0,
        totalPnlZarMinor: 0,
        activePositions: 0,
        cancelledPositions: 0,
        byPair: [],
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
}

describe("expected-event watchdog", () => {
  it("flags every expectation as a gap on an empty store", () => {
    const store = new EventStore();
    const gaps = checkExpectedEvents(store);
    expect(gaps.length).toBe(expectedEvents().length);
    // 3 calc-bound (one per CALC_BINDINGS entry) + 2 standalone.
    expect(gaps.length).toBe(Object.keys(CALC_BINDINGS).length + 2);
    const ids = new Set(gaps.map((g) => g.id));
    expect(ids.has("daily-pnl")).toBe(true);
    expect(ids.has("balance-sheet")).toBe(true);
    for (const b of Object.values(CALC_BINDINGS)) {
      expect(ids.has(`calc-${b.calcKey}`)).toBe(true);
    }
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

  it("emits one SubstrateAlert per gap and is idempotent", () => {
    const store = new EventStore();
    const first = emitExpectedEventGapAlerts(store, AS_OF);
    expect(first.emitted.length).toBe(expectedEvents().length);
    expect(first.skipped).toEqual([]);

    const alertIds = [...store.replay({ type: "SubstrateAlert" })].map(
      (e) => (e.payload as { alertId: string }).alertId,
    );
    expect(alertIds.length).toBe(expectedEvents().length);
    for (const exp of expectedEvents()) {
      expect(alertIds).toContain(gapAlertId(exp.id));
    }

    // Second call: every gap already alerted → all skipped, none re-emitted.
    const second = emitExpectedEventGapAlerts(store, AS_OF);
    expect(second.emitted).toEqual([]);
    expect(second.skipped.length).toBe(expectedEvents().length);
    expect([...store.replay({ type: "SubstrateAlert" })].length).toBe(expectedEvents().length);
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
