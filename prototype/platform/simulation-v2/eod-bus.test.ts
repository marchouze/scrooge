// platform/simulation-v2/eod-bus.test.ts
//
// Deterministic-firing tests for the EOD trigger bus (Phase 0 keystone).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { SimulatedClock } from "../scenario-clock";
import { type EodHook, type EodHookContext, EodTriggerBus } from "./eod-bus";

function recordingHook(id: string, priority: number, sink: string[]): EodHook {
  return {
    id,
    cadence: "end-of-day",
    priority,
    run(ctx: EodHookContext): void {
      sink.push(`${ctx.reportDate}:${id}`);
    },
  };
}

describe("EodTriggerBus", () => {
  test("fires EOD hooks deterministically across >= 3 simulated days", () => {
    const clock = new SimulatedClock("2026-01-05T08:00:00.000Z");
    const bus = new EodTriggerBus(clock, { eodHourUtc: 17 });
    const sink: string[] = [];
    bus.register(recordingHook("reval", 10, sink));
    bus.register(recordingHook("pnl", 20, sink));

    // Advance to mid-day on 2026-01-08 → crosses the 17:00 close of Jan 5, 6, 7.
    bus.advanceTo("2026-01-08T12:00:00.000Z");

    expect(bus.boundariesFired()).toBe(3);
    expect(sink).toEqual([
      "2026-01-05:reval",
      "2026-01-05:pnl",
      "2026-01-06:reval",
      "2026-01-06:pnl",
      "2026-01-07:reval",
      "2026-01-07:pnl",
    ]);
  });

  test("hook order is priority asc, ties break by registration order", () => {
    const clock = new SimulatedClock("2026-03-01T08:00:00.000Z");
    const bus = new EodTriggerBus(clock);
    const sink: string[] = [];
    // Register out of priority order + a tie at priority 20.
    bus.register(recordingHook("var", 30, sink));
    bus.register(recordingHook("reval", 10, sink));
    bus.register(recordingHook("pnl-a", 20, sink));
    bus.register(recordingHook("pnl-b", 20, sink));

    bus.advanceOneDay();

    expect(sink).toEqual([
      "2026-03-01:reval",
      "2026-03-01:pnl-a",
      "2026-03-01:pnl-b",
      "2026-03-01:var",
    ]);
  });

  test("re-advancing to the same instant does not double-fire (idempotent boundary)", () => {
    const clock = new SimulatedClock("2026-01-05T08:00:00.000Z");
    const bus = new EodTriggerBus(clock);
    const sink: string[] = [];
    bus.register(recordingHook("reval", 10, sink));

    const first = bus.advanceTo("2026-01-06T18:00:00.000Z");
    const second = bus.advanceTo("2026-01-06T18:00:00.000Z"); // no time passes

    expect(first.length).toBe(2); // Jan 5 + Jan 6 closes
    expect(second.length).toBe(0); // nothing new
    expect(bus.boundariesFired()).toBe(2);
  });

  test("clock lands exactly on the boundary when hooks run, then settles at final instant", () => {
    const clock = new SimulatedClock("2026-01-05T08:00:00.000Z");
    const bus = new EodTriggerBus(clock, { eodHourUtc: 17 });
    const seen: string[] = [];
    bus.register({
      id: "probe",
      cadence: "end-of-day",
      priority: 10,
      run(ctx) {
        // While the hook runs, the clock IS the boundary instant.
        seen.push(clock.now());
        expect(clock.now()).toBe(ctx.boundaryInstant);
      },
    });

    bus.advanceTo("2026-01-05T19:30:00.000Z");

    expect(seen).toEqual(["2026-01-05T17:00:00.000Z"]);
    // After the run, the clock settles at the requested final instant.
    expect(clock.now()).toBe("2026-01-05T19:30:00.000Z");
  });

  test("advanceBy fires the same boundaries as the equivalent advanceTo", () => {
    const a = new SimulatedClock("2026-01-05T08:00:00.000Z");
    const busA = new EodTriggerBus(a);
    const sinkA: string[] = [];
    busA.register(recordingHook("h", 10, sinkA));
    busA.advanceBy(3 * 24 * 60 * 60 * 1000);

    const b = new SimulatedClock("2026-01-05T08:00:00.000Z");
    const busB = new EodTriggerBus(b);
    const sinkB: string[] = [];
    busB.register(recordingHook("h", 10, sinkB));
    busB.advanceTo("2026-01-08T08:00:00.000Z");

    expect(sinkA).toEqual(sinkB);
  });

  test("rejects backwards advance and duplicate hook ids", () => {
    const clock = new SimulatedClock("2026-01-05T08:00:00.000Z");
    const bus = new EodTriggerBus(clock);
    bus.register(recordingHook("dup", 10, []));
    expect(() => bus.register(recordingHook("dup", 20, []))).toThrow(/duplicate hook id/);

    bus.advanceTo("2026-01-06T08:00:00.000Z");
    expect(() => bus.advanceTo("2026-01-05T08:00:00.000Z")).toThrow(/cannot advance backwards/);
  });
});
