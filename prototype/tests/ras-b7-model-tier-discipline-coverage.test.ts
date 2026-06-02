// tests/ras-b7-model-tier-discipline-coverage.test.ts
//
// Unit tests for the RAS §B7 model-tier-discipline coverage recon pipeline.
//
// Pattern follows `recon-ras-b2-calibration-coverage.test.ts` and
// `tests/recon-liquidity-appetite-snapshot-coverage.test.ts`.
//
// Smoke: the pipeline runs against the live event store and returns a
// structured result without throwing.
//
// Synthetic: hand-rolled `RiskAppetiteSnapshot`-like events feed
// `run({ events })` and assert each violation class is detected.
//
// Authors: Atlas (Core banking platform architect, engineering) ·
//          Helena (Chief Risk Officer, governance).

import { describe, expect, it } from "bun:test";

import { run as rasB7Coverage } from "../platform/recon/ras-b7-model-tier-discipline-coverage";

const MODEL_TIER_LINE_ID = "appetite:model:tier-discipline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function syntheticSnapshot(overrides: {
  eventId?: string;
  asOf?: string;
  lineStatuses?: Record<string, string> | null | undefined;
  omitLineStatuses?: boolean;
}) {
  const base = {
    event_id: overrides.eventId ?? "evt-synthetic-ras-b7-001",
    type: "RiskAppetiteSnapshot",
    as_of: overrides.asOf ?? "2026-06-02T06:00:00.000Z",
    payload: {} as Record<string, unknown>,
  };
  if (!overrides.omitLineStatuses) {
    base.payload.lineStatuses =
      overrides.lineStatuses !== undefined
        ? overrides.lineStatuses
        : { [MODEL_TIER_LINE_ID]: "green" };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RAS §B7 model-tier discipline coverage pipeline", () => {
  it("smoke: runs against the live event store and returns a structured result", () => {
    const r = rasB7Coverage();
    expect(r.pipeline).toBe("ras-b7-model-tier-discipline-coverage");
    expect(typeof r.ok).toBe("boolean");
    expect(r.asserted).toBeGreaterThan(0);
    // Surface any violations for visibility (the live store may not yet have
    // a snapshot with the wired line; that's acceptable at smoke time).
    if (!r.ok) {
      console.log(
        `[ras-b7-model-tier-discipline-coverage] live findings (${r.violations.length}):`,
        r.violations.map((v) => `${v.subject}: ${v.message}`).join("\n  "),
      );
    }
  });

  it("empty store (no events array) → info softening, ok=true", () => {
    // No opts.events provided and no live store events: this path is
    // handled by the live-store branch. For a synthetic empty test, pass
    // an explicit empty array which triggers the hard-fail branch.
    // To test the `info` soft path we omit opts entirely and rely on the
    // smoke above. Here we test the explicit-empty synthetic branch.
    const r = rasB7Coverage({ events: [] });
    // Empty synthetic array = hard fail per the pattern.
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("snapshot with unmeasured for the line → fail", () => {
    const snap = syntheticSnapshot({
      lineStatuses: { [MODEL_TIER_LINE_ID]: "unmeasured" },
    });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("unmeasured"),
      ),
    ).toBe(true);
  });

  it("snapshot with green → pass", () => {
    const snap = syntheticSnapshot({
      lineStatuses: { [MODEL_TIER_LINE_ID]: "green" },
    });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("snapshot with amber → pass (measured)", () => {
    const snap = syntheticSnapshot({
      lineStatuses: { [MODEL_TIER_LINE_ID]: "amber" },
    });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.ok).toBe(true);
  });

  it("snapshot with red → pass (measured)", () => {
    const snap = syntheticSnapshot({
      lineStatuses: { [MODEL_TIER_LINE_ID]: "red" },
    });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.ok).toBe(true);
  });

  it("snapshot with n/a-build-phase → pass (build-phase carve-out)", () => {
    const snap = syntheticSnapshot({
      lineStatuses: { [MODEL_TIER_LINE_ID]: "n/a-build-phase" },
    });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.ok).toBe(true);
  });

  it("snapshot missing lineStatuses entirely → fail", () => {
    const snap = syntheticSnapshot({ omitLineStatuses: true });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("lineStatuses"),
      ),
    ).toBe(true);
  });

  it("snapshot with lineStatuses but model-tier line absent → fail", () => {
    const snap = syntheticSnapshot({
      lineStatuses: {
        "appetite:liquidity:lcr": "green",
        // model-tier line deliberately omitted
      },
    });
    const r = rasB7Coverage({ events: [snap] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" && v.message.includes(MODEL_TIER_LINE_ID),
      ),
    ).toBe(true);
  });

  it("uses the most-recent snapshot when multiple exist", () => {
    const older = syntheticSnapshot({
      eventId: "evt-older",
      asOf: "2026-06-01T06:00:00.000Z",
      lineStatuses: { [MODEL_TIER_LINE_ID]: "unmeasured" }, // stale — should be ignored
    });
    const newer = syntheticSnapshot({
      eventId: "evt-newer",
      asOf: "2026-06-02T06:00:00.000Z",
      lineStatuses: { [MODEL_TIER_LINE_ID]: "green" }, // current
    });
    const r = rasB7Coverage({ events: [older, newer] });
    expect(r.ok).toBe(true);
  });

  it("fails if most-recent snapshot is unmeasured even when an older snapshot is green", () => {
    const older = syntheticSnapshot({
      eventId: "evt-older",
      asOf: "2026-06-01T06:00:00.000Z",
      lineStatuses: { [MODEL_TIER_LINE_ID]: "green" },
    });
    const newer = syntheticSnapshot({
      eventId: "evt-newer",
      asOf: "2026-06-02T06:00:00.000Z",
      lineStatuses: { [MODEL_TIER_LINE_ID]: "unmeasured" }, // regression in latest
    });
    const r = rasB7Coverage({ events: [older, newer] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("unmeasured")),
    ).toBe(true);
  });
});
