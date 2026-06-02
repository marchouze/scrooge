// tests/ras-b6-cyber-severity-coverage.test.ts
//
// Unit tests for the RAS §B6 cyber-severity-tiers coverage recon pipeline.
//
// Smoke: runs against the live (temp-DB) event store and returns a
// structured result. Does not assert ok=true at smoke-time — the live
// state will be green only after Helena's handler has been run on the
// bench (which CI does not do by default).
//
// Synthetic: hand-rolled RiskAppetiteSnapshot events feed
// `run({ events })` and assert each coverage class is detected.
//
// Authors: Senna (CISO, engineering) ·
//          Vera (Internal audit engineer, third line of defence).

import { describe, expect, it } from "bun:test";

import { run as rasB6Coverage } from "../platform/recon/ras-b6-cyber-severity-coverage";

const CYBER_LINE_ID = "appetite:operational:cyber-severity-tiers";

function syntheticSnapshot(overrides: {
  eventId?: string;
  asOf?: string;
  lineStatuses?: Record<string, string> | null | undefined;
}) {
  return {
    event_id: overrides.eventId ?? "evt-synthetic-ras-b6-001",
    type: "RiskAppetiteSnapshot",
    as_of: overrides.asOf ?? "2026-06-02T06:00:00.000Z",
    payload: {
      lineStatuses:
        overrides.lineStatuses !== undefined
          ? overrides.lineStatuses
          : {
              [CYBER_LINE_ID]: "green",
              "appetite:liquidity:lcr": "green",
              "appetite:liquidity:nsfr": "green",
            },
    },
  };
}

describe("RAS §B6 cyber-severity coverage pipeline", () => {
  it("smoke: runs against the live event store and returns a structured result", () => {
    const r = rasB6Coverage();
    expect(r.pipeline).toBe("ras-b6-cyber-severity-coverage");
    expect(typeof r.ok).toBe("boolean");
    expect(r.asserted).toBeGreaterThan(0);
    // Surface any findings for CI visibility without failing the smoke test —
    // a fresh bench has no RiskAppetiteSnapshot events (which is an `info`
    // softening, not a failure).
    if (!r.ok) {
      console.log(
        `[ras-b6-cyber-severity-coverage] live findings (${r.violations.length}):`,
        r.violations.map((v) => `${v.subject}: ${v.message}`).join("\n  "),
      );
    }
  });

  it("info (not fail) when the event store is empty (fresh bench)", () => {
    // Empty live store → info softening; `opts.events` is NOT provided, so
    // the pipeline uses the live store. The live store is an isolated temp DB
    // (tests/_setup.ts) — zero snapshots → info-only result.
    const r = rasB6Coverage();
    // Should be ok=true with one info violation.
    expect(r.ok).toBe(true);
    const infoViolations = r.violations.filter((v) => v.severity === "info");
    expect(infoViolations.length).toBeGreaterThan(0);
  });

  it("fails when opts.events is an empty array (synthetic empty = hard fail)", () => {
    const r = rasB6Coverage({ events: [] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("No RiskAppetiteSnapshot events"),
      ),
    ).toBe(true);
  });

  it("fails when the latest snapshot has status=unmeasured for the cyber line", () => {
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          lineStatuses: {
            [CYBER_LINE_ID]: "unmeasured",
            "appetite:liquidity:lcr": "green",
          },
        }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes(CYBER_LINE_ID),
      ),
    ).toBe(true);
    expect(r.violations.some((v) => v.message.includes("unmeasured"))).toBe(true);
  });

  it("passes when the latest snapshot carries status=green for the cyber line", () => {
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          lineStatuses: { [CYBER_LINE_ID]: "green" },
        }),
      ],
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("passes when the latest snapshot carries status=amber for the cyber line", () => {
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          lineStatuses: { [CYBER_LINE_ID]: "amber" },
        }),
      ],
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("passes when the latest snapshot carries status=red for the cyber line (measured, not unmeasured)", () => {
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          lineStatuses: { [CYBER_LINE_ID]: "red" },
        }),
      ],
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails when lineStatuses map is missing entirely", () => {
    const r = rasB6Coverage({
      events: [
        {
          event_id: "evt-no-linestatuses",
          type: "RiskAppetiteSnapshot",
          as_of: "2026-06-02T06:00:00.000Z",
          payload: {},
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("lineStatuses")),
    ).toBe(true);
  });

  it("fails when the cyber line is absent from the lineStatuses map", () => {
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          lineStatuses: {
            "appetite:liquidity:lcr": "green",
            "appetite:capital:cet1-buffer": "green",
            // CYBER_LINE_ID intentionally absent
          },
        }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.message.includes(CYBER_LINE_ID) &&
          v.message.includes("missing"),
      ),
    ).toBe(true);
  });

  it("uses the most-recent snapshot when multiple snapshots are provided", () => {
    // Older snapshot has `unmeasured`; newer snapshot has `green`.
    // Pipeline should check the newer snapshot and pass.
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          eventId: "evt-older",
          asOf: "2026-06-01T06:00:00.000Z",
          lineStatuses: { [CYBER_LINE_ID]: "unmeasured" },
        }),
        syntheticSnapshot({
          eventId: "evt-newer",
          asOf: "2026-06-02T06:00:00.000Z",
          lineStatuses: { [CYBER_LINE_ID]: "green" },
        }),
      ],
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails when the most-recent snapshot has unmeasured even if an older one was green", () => {
    const r = rasB6Coverage({
      events: [
        syntheticSnapshot({
          eventId: "evt-older",
          asOf: "2026-06-01T06:00:00.000Z",
          lineStatuses: { [CYBER_LINE_ID]: "green" },
        }),
        syntheticSnapshot({
          eventId: "evt-newer",
          asOf: "2026-06-02T06:00:00.000Z",
          lineStatuses: { [CYBER_LINE_ID]: "unmeasured" },
        }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("unmeasured"))).toBe(true);
  });
});
