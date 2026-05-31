// tests/calculation-provenance.test.ts
//
// Guardrail for the calc-provenance emission suite (Trusted-Figures Program).
//
// THE GAP THIS CLOSES: `emitCalculationProvenance()` in dashboard/server.ts
// (extracted to platform/model-registry/calculation-provenance.ts) emits one
// CalculationPerformed per bound figure. The `rwa` binding (model:rwa-sa-v1)
// shipped with NO emitter — a first-class governed figure with a calc-history
// gap that the expected-event watchdog reported as a high-severity integrity
// fault. Nothing asserted that every CALC_BINDINGS key had a matching emission,
// so the gap went unnoticed.
//
// This test fails if ANY Object.keys(CALC_BINDINGS) key produces no
// CalculationPerformed from emitAllCalculationProvenance() against a seeded
// store with booked trades — making a future "binding without emitter" a CI
// failure, not a silent runtime gap.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1;
//   D-RWA-LIVE-POSITIONS-PROJECTION-V1.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../platform/core/types";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { MarketDataStore } from "../platform/market-data/store";
import { CALC_BINDINGS } from "../platform/model-registry/calculation-binding";
import { emitAllCalculationProvenance } from "../platform/model-registry/calculation-provenance";
import { runPnLAttribution } from "../platform/product-control/pnl-attribution";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import { seedCalcModels } from "../seeds/models/calc-model-seed";

// Bindings NOT emitted by the boot provenance suite (emitAllCalculationProvenance):
// they are emitted by their own engine's run wrapper. The guardrail drives those
// wrappers too, so a binding wired to NEITHER path still fails. The value is the
// emitter the guardrail invokes for that key — adding a binding with no emitter
// (the gap that let `rwa` ship without one) fails the coverage assertion below.
const NON_BOOT_SUITE_EMITTERS: Record<string, "product-control-pnl-attribution"> = {
  "pnl-attribution": "product-control-pnl-attribution",
};

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T08:00:00.000Z";
const ACTOR: Actor = { type: "service", id: "agent:test:calc-provenance" };
const CITATIONS = ["D-RWA-LIVE-POSITIONS-PROJECTION-V1"];

// Tests use untagged (simulated) events — accept them through the provenance filter.
beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

/** Silent logger — the suite warns on loud skips; we don't want test noise. */
const silentLogger = { warn: (): void => {} };

/**
 * Seed a corporate (non-ZAG) bond so credit RWA is live (65% RW → credit RWA
 * > 0 → buildPhaseFallback false, RWA total > 0). One booked trade is enough to
 * exit the build-phase fallback and exercise the live RWA emission path.
 */
function seedTrades(store: EventStore): void {
  store.append(
    makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: `bond-${newEventId().slice(0, 8)}`,
        bondIsin: "XS0000000001", // non-ZAG → corporate-ig (65% RW) → credit RWA > 0
        side: "buy",
        nominalMinor: 10_000_000_00, // R10m
        cleanPricePercent: 97.5,
        accruedInterestMinor: 100_000,
        dirtyPricePercent: 98.0,
        settlementDate: "2026-06-02",
        portfolio: "banking-book",
        couponRate: 0.085,
        maturityDate: "2030-01-31",
        currency: "ZAR",
        counterpartyLei: "SBZAZAJJXXX",
        executedAt: AS_OF,
      },
    }),
  );
}

describe("calc-provenance emission suite", () => {
  it("emits a CalculationPerformed for EVERY CALC_BINDINGS key (no binding without an emitter)", () => {
    const store = new EventStore();
    seedCalcModels(store); // register + approve every bound model (else loud skip)
    seedTrades(store); // booked trades → RWA + market-risk compute live

    // Boot provenance suite — the path that emits LCR/NSFR/CET1/RWA/ECL/IRRBB/
    // market-risk/CVA. RWA is now part of this suite (the gap this PR closes).
    emitAllCalculationProvenance({
      eventStore: store,
      marketDataStore: new MarketDataStore(":memory:"),
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      logger: silentLogger,
    });

    // Non-boot-suite emitters — bindings emitted by their own engine's run
    // wrapper rather than the boot suite. Drive each so the coverage assertion
    // spans every emitter path, not just the boot suite.
    runPnLAttribution(store, () => AS_OF);

    // Collect the modelIds for which a CalculationPerformed was emitted.
    const emittedModelIds = new Set(
      [...store.replay({ type: "CalculationPerformed" })].map(
        (e) => (e.payload as { modelId: string }).modelId,
      ),
    );

    // Every bound figure MUST have produced an emission from SOME emitter path.
    // This is the guardrail: a binding key wired to no emitter — boot suite or
    // NON_BOOT_SUITE_EMITTERS — fails here (the gap that let `rwa` ship without
    // an emitter). A new binding must either join the boot suite or register its
    // emitter in NON_BOOT_SUITE_EMITTERS and have this test drive it.
    const missing = Object.values(CALC_BINDINGS)
      .filter((b) => !emittedModelIds.has(b.modelId))
      .map((b) => `${b.calcKey} (${b.modelId})`);

    expect(missing).toEqual([]);
    // Sanity: the non-boot-suite allow-list keys are real bindings.
    for (const key of Object.keys(NON_BOOT_SUITE_EMITTERS)) {
      expect(CALC_BINDINGS[key as keyof typeof CALC_BINDINGS]).toBeDefined();
    }
  });

  it("emits the RWA figure (model:rwa-sa-v1) with a live total when trades exist (status ok)", () => {
    const store = new EventStore();
    seedCalcModels(store);
    seedTrades(store);

    emitAllCalculationProvenance({
      eventStore: store,
      marketDataStore: new MarketDataStore(":memory:"),
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      logger: silentLogger,
    });

    const rwaEvents = [...store.replay({ type: "CalculationPerformed" })].filter(
      (e) => (e.payload as { modelId: string }).modelId === "model:rwa-sa-v1",
    );
    expect(rwaEvents.length).toBe(1);

    const payload = rwaEvents[0]?.payload as {
      status: string;
      output: number | null;
      inputs: { name: string; value: number | null; missing: boolean }[];
    };
    // Live path: a non-ZAG bond + FX trade → credit + market RWA → status ok,
    // real total, all section inputs present.
    expect(payload.status).toBe("ok");
    expect(payload.output).not.toBeNull();
    expect(payload.output as number).toBeGreaterThan(0);
    const inputNames = payload.inputs.map((i) => i.name).sort();
    expect(inputNames).toEqual(
      ["creditRwaMinor", "cvaRwaMinor", "marketRwaMinor", "operationalRwaMinor"].sort(),
    );
    for (const input of payload.inputs) {
      expect(input.missing).toBe(false);
    }
  });

  it("degrades the RWA figure (output null, status degraded) when no trades are booked", () => {
    const store = new EventStore();
    seedCalcModels(store); // models approved, but NO trades → build-phase fallback

    emitAllCalculationProvenance({
      eventStore: store,
      marketDataStore: new MarketDataStore(":memory:"),
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      logger: silentLogger,
    });

    const rwaEvents = [...store.replay({ type: "CalculationPerformed" })].filter(
      (e) => (e.payload as { modelId: string }).modelId === "model:rwa-sa-v1",
    );
    expect(rwaEvents.length).toBe(1);

    const payload = rwaEvents[0]?.payload as { status: string; output: number | null };
    // No silent zero: build-phase fallback → all section inputs missing →
    // status degraded (the required inputs are present-but-missing in the
    // contract sense → derive deterministically), output null.
    expect(payload.output).toBeNull();
    expect(payload.status).not.toBe("ok");

    // A SubstrateAlert{integrity} must surface the degraded figure loudly.
    const alertIds = [...store.replay({ type: "SubstrateAlert" })].map(
      (e) => (e.payload as { alertId: string }).alertId,
    );
    expect(alertIds.some((id) => id.startsWith("alert:integrity:calc-rwa-"))).toBe(true);
  });
});
