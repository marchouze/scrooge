// platform/simulation-v2/scenario-runner.test.ts
//
// Phase 0 acceptance: a no-op scenario advances across >= 3 simulated days,
// firing EOD hooks deterministically. Replaying the same manifest twice yields
// byte-identical fired-hook logs (replay-safety).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import type { EodHook } from "./eod-bus";
import type { ScenarioManifest } from "./scenario-manifest";
import { runScenario } from "./scenario-runner";

const NOOP_MANIFEST: ScenarioManifest = {
  scenarioId: "fx-v2-noop-phase0",
  description: "Phase 0 no-op: advance 4 days, fire EOD cadence with no SUT hooks.",
  seed: 0x5eed,
  baselineInstant: "2026-01-05T07:00:00.000Z",
  eodHourUtc: 17,
  counterparties: [],
  days: [
    { date: "2026-01-05", market: [] },
    { date: "2026-01-06", market: [] },
    { date: "2026-01-07", market: [] },
    { date: "2026-01-08", market: [] },
  ],
};

describe("scenario-runner — Phase 0 no-op", () => {
  test("advances >= 3 simulated days firing EOD boundaries deterministically", () => {
    const result = runScenario(NOOP_MANIFEST);
    try {
      // Four declared days → four EOD closes fired.
      expect(result.boundariesFired).toBe(4);
      expect(result.firedHooks).toEqual([]); // no SUT hooks registered (no-op)
      expect(result.finalInstant).toBe("2026-01-08T17:00:00.000Z");
    } finally {
      result.close();
    }
  });

  test("registers SUT cadence hooks and fires them once per day in order", () => {
    const fired: string[] = [];
    const hookFactory = (): readonly EodHook[] => [
      {
        id: "reval",
        cadence: "end-of-day",
        priority: 10,
        run: (ctx) => fired.push(`${ctx.reportDate}:reval`),
      },
      {
        id: "pnl",
        cadence: "end-of-day",
        priority: 20,
        run: (ctx) => fired.push(`${ctx.reportDate}:pnl`),
      },
    ];
    const result = runScenario(NOOP_MANIFEST, { cadenceHooks: hookFactory });
    try {
      expect(result.boundariesFired).toBe(4);
      expect(fired).toEqual([
        "2026-01-05:reval",
        "2026-01-05:pnl",
        "2026-01-06:reval",
        "2026-01-06:pnl",
        "2026-01-07:reval",
        "2026-01-07:pnl",
        "2026-01-08:reval",
        "2026-01-08:pnl",
      ]);
    } finally {
      result.close();
    }
  });

  test("two replays of the same manifest produce identical fired-hook logs (replay-safe)", () => {
    const a = runScenario(NOOP_MANIFEST);
    const b = runScenario(NOOP_MANIFEST);
    try {
      expect(JSON.stringify(a.firedHooks)).toBe(JSON.stringify(b.firedHooks));
      expect(a.finalInstant).toBe(b.finalInstant);
    } finally {
      a.close();
      b.close();
    }
  });

  test("rejects a manifest with non-increasing day dates", () => {
    const bad: ScenarioManifest = {
      ...NOOP_MANIFEST,
      days: [
        { date: "2026-01-06", market: [] },
        { date: "2026-01-05", market: [] },
      ],
    };
    expect(() => runScenario(bad)).toThrow(/strictly increasing/);
  });
});
