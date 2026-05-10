// tests/scenario-clock.test.ts
//
// D-SCENARIO-CLOCK substrate tests. Asserts:
//   - WallClock.now() / nowMs() delegate to Date.now() and produce ISO-8601.
//   - WallClock mutators are no-ops (production behaviour unchanged).
//   - SimulatedClock initialises to its baseline and `now()` returns
//     ISO-8601 of that instant.
//   - SimulatedClock.advance() shifts time deterministically.
//   - SimulatedClock.setTo() pins to an arbitrary instant.
//   - SimulatedClock.freeze() / unfreeze() block / unblock mutation.
//   - resolveCompositionClock() honours BANK_SCENARIO_CLOCK_MODE +
//     BANK_SCENARIO_CLOCK_BASELINE.
//   - Bad inputs (unparseable ISO, non-finite numbers) throw with a
//     useful message.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
  SCENARIO_CLOCK_BASELINE_ENV,
  SCENARIO_CLOCK_MODE_ENV,
  SimulatedClock,
  T_PLUS_TWO_MS,
  WallClock,
  resolveCompositionClock,
  resolveScenarioClockMode,
} from "../platform/scenario-clock";

describe("WallClock — production default", () => {
  it("reports mode 'wall'", () => {
    expect(new WallClock().mode).toBe("wall");
  });

  it("now() returns an ISO-8601 string near Date.now()", () => {
    const before = Date.now();
    const iso = new WallClock().now();
    const after = Date.now();
    const parsed = Date.parse(iso);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
    // Round-trip: ISO → Date → same ms.
    expect(new Date(parsed).toISOString()).toBe(iso);
  });

  it("nowMs() returns a finite number near Date.now()", () => {
    const before = Date.now();
    const ms = new WallClock().nowMs();
    const after = Date.now();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  it("mutators are no-ops; frozen always false", () => {
    const c = new WallClock();
    c.advance(ONE_DAY_MS);
    c.setTo("2030-01-01T00:00:00.000Z");
    c.freeze();
    c.unfreeze();
    expect(c.frozen).toBe(false);
    // Still wall-clock-bound: now() is roughly Date.now().
    const skew = Math.abs(c.nowMs() - Date.now());
    expect(skew).toBeLessThan(1_000);
  });
});

describe("SimulatedClock — controlled-time substrate", () => {
  const BASELINE_ISO = "2026-05-10T08:00:00.000Z";
  const BASELINE_MS = Date.parse(BASELINE_ISO);

  it("reports mode 'simulated' and starts at baseline (ISO input)", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    expect(c.mode).toBe("simulated");
    expect(c.now()).toBe(BASELINE_ISO);
    expect(c.nowMs()).toBe(BASELINE_MS);
    expect(c.frozen).toBe(false);
  });

  it("starts at baseline (numeric epoch-ms input)", () => {
    const c = new SimulatedClock(BASELINE_MS);
    expect(c.now()).toBe(BASELINE_ISO);
    expect(c.nowMs()).toBe(BASELINE_MS);
  });

  it("rejects unparseable ISO baseline", () => {
    expect(() => new SimulatedClock("not-a-date")).toThrow(/not a valid ISO-8601 timestamp/);
  });

  it("rejects non-finite numeric baseline", () => {
    expect(() => new SimulatedClock(Number.NaN)).toThrow(/finite/);
    expect(() => new SimulatedClock(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it("advance() shifts time deterministically (single + accumulated)", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    c.advance(ONE_HOUR_MS);
    expect(c.now()).toBe("2026-05-10T09:00:00.000Z");
    c.advance(ONE_DAY_MS);
    expect(c.now()).toBe("2026-05-11T09:00:00.000Z");
    c.advance(2 * ONE_MINUTE_MS);
    expect(c.now()).toBe("2026-05-11T09:02:00.000Z");
  });

  it("T+2 helper composes cleanly for settlement-day rehearsals", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    c.advance(T_PLUS_TWO_MS);
    expect(c.now()).toBe("2026-05-12T08:00:00.000Z");
  });

  it("advance() accepts negative durations (rewind to earlier baseline)", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    c.advance(-ONE_HOUR_MS);
    expect(c.now()).toBe("2026-05-10T07:00:00.000Z");
  });

  it("advance() rejects non-finite durations", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    expect(() => c.advance(Number.NaN)).toThrow(/finite/);
    expect(() => c.advance(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it("setTo() pins clock to an arbitrary instant", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    c.setTo("2026-05-31T17:00:00.000Z");
    expect(c.now()).toBe("2026-05-31T17:00:00.000Z");
    // Subsequent advance() proceeds from the pinned instant.
    c.advance(ONE_HOUR_MS);
    expect(c.now()).toBe("2026-05-31T18:00:00.000Z");
  });

  it("setTo() rejects unparseable ISO", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    expect(() => c.setTo("month-end")).toThrow(/not a valid ISO-8601 timestamp/);
  });

  it("freeze() blocks advance() and setTo(); unfreeze() restores", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    c.freeze();
    expect(c.frozen).toBe(true);
    expect(() => c.advance(ONE_HOUR_MS)).toThrow(/frozen/);
    expect(() => c.setTo("2026-05-11T00:00:00.000Z")).toThrow(/frozen/);
    // now() still works while frozen — it returns the pinned instant.
    expect(c.now()).toBe(BASELINE_ISO);

    c.unfreeze();
    expect(c.frozen).toBe(false);
    c.advance(ONE_HOUR_MS);
    expect(c.now()).toBe("2026-05-10T09:00:00.000Z");
  });

  it("unfreeze() is a no-op when not frozen", () => {
    const c = new SimulatedClock(BASELINE_ISO);
    c.unfreeze();
    expect(c.frozen).toBe(false);
    c.advance(ONE_HOUR_MS);
    expect(c.now()).toBe("2026-05-10T09:00:00.000Z");
  });
});

describe("resolveCompositionClock — env-var wiring", () => {
  it("returns WallClock when env unset", () => {
    const clock = resolveCompositionClock({});
    expect(clock.mode).toBe("wall");
  });

  it("returns WallClock when MODE=wall (explicit)", () => {
    const clock = resolveCompositionClock({
      [SCENARIO_CLOCK_MODE_ENV]: "wall",
    });
    expect(clock.mode).toBe("wall");
  });

  it("returns WallClock when MODE is unrecognised (safe default)", () => {
    const clock = resolveCompositionClock({
      [SCENARIO_CLOCK_MODE_ENV]: "garbage",
    });
    expect(clock.mode).toBe("wall");
  });

  it("returns SimulatedClock when MODE=simulated; baseline drives now()", () => {
    const clock = resolveCompositionClock({
      [SCENARIO_CLOCK_MODE_ENV]: "simulated",
      [SCENARIO_CLOCK_BASELINE_ENV]: "2026-05-10T08:00:00.000Z",
    });
    expect(clock.mode).toBe("simulated");
    expect(clock.now()).toBe("2026-05-10T08:00:00.000Z");
  });

  it("returns SimulatedClock pinned to ~now() when MODE=simulated without baseline", () => {
    const before = Date.now();
    const clock = resolveCompositionClock({
      [SCENARIO_CLOCK_MODE_ENV]: "simulated",
    });
    const after = Date.now();
    expect(clock.mode).toBe("simulated");
    expect(clock.nowMs()).toBeGreaterThanOrEqual(before);
    expect(clock.nowMs()).toBeLessThanOrEqual(after);
  });
});

describe("resolveScenarioClockMode — env parsing", () => {
  it("returns 'wall' for unset / empty / unrecognised values", () => {
    expect(resolveScenarioClockMode({})).toBe("wall");
    expect(resolveScenarioClockMode({ [SCENARIO_CLOCK_MODE_ENV]: "" })).toBe("wall");
    expect(resolveScenarioClockMode({ [SCENARIO_CLOCK_MODE_ENV]: "production" })).toBe("wall");
  });

  it("returns 'simulated' only for the exact literal 'simulated'", () => {
    expect(resolveScenarioClockMode({ [SCENARIO_CLOCK_MODE_ENV]: "simulated" })).toBe("simulated");
    // Case-sensitive — typo defaults safely.
    expect(resolveScenarioClockMode({ [SCENARIO_CLOCK_MODE_ENV]: "Simulated" })).toBe("wall");
  });
});

describe("ScenarioClock — usage pattern for scenario-runner injection", () => {
  it("scenario-style: callers source as_of from clock.now() and advance between steps", () => {
    const clock = new SimulatedClock("2026-05-10T08:00:00.000Z");

    const events: Array<{ as_of: string; step: string }> = [];

    // T0 — RFQ requested
    events.push({ as_of: clock.now(), step: "RfqRequested" });
    clock.advance(2 * ONE_MINUTE_MS);

    // T0+2min — pricing model evaluated
    events.push({ as_of: clock.now(), step: "PricingModelEvaluated" });
    clock.advance(30 * 1_000);

    // T0+2min30s — trade executed
    events.push({ as_of: clock.now(), step: "TradeExecuted" });

    // Fast-forward to T+2 settlement
    clock.advance(T_PLUS_TWO_MS);
    events.push({ as_of: clock.now(), step: "SettlementCompleted" });

    expect(events.map((e) => e.as_of)).toEqual([
      "2026-05-10T08:00:00.000Z",
      "2026-05-10T08:02:00.000Z",
      "2026-05-10T08:02:30.000Z",
      "2026-05-12T08:02:30.000Z",
    ]);
  });
});
