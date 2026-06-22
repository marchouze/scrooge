// dashboard/v2-world-simulator-grounding.test.ts
//
// Unit tests for the FX V2 market-path grounding builder + honesty invariant.
//
// Asserts:
//   (1) with real production marks seeded, spot + ZAR OIS ground from those marks
//       and the window re-anchors to the data window;
//   (2) forward points are always flagged ungrounded (no feed);
//   (3) the honesty invariant holds on grounded AND clean-store paths;
//   (4) a tampered path (synthetic value without a grounding flag) is caught by
//       assertGroundingHonesty.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { MarketDataStore } from "../platform/market-data/store";
import {
  type GroundedMarketPathDto,
  assertGroundingHonesty,
  buildGroundedMarketPath,
} from "./v2-world-simulator-grounding";

function seededStore(): MarketDataStore {
  const s = new MarketDataStore(":memory:");
  s.append({
    id: "u1",
    source: "twelve-data",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: "2026-06-20T17:00:00.000Z",
    payload: { pair: "USD/ZAR", mid: 16.4339 },
  });
  s.append({
    id: "z1",
    source: "zaronia-sarb",
    instrument: "ZARONIA",
    dataType: "zaronia-rate",
    provenance: "production",
    asOf: "2026-06-20T15:00:00+02:00",
    payload: { rate: "0.0793" },
  });
  return s;
}

describe("buildGroundedMarketPath — real marks", () => {
  it("grounds spot from the production mark and re-anchors the window", () => {
    const s = seededStore();
    try {
      const p = buildGroundedMarketPath(s);
      const anchor = p.observations[p.observations.length - 1];
      expect(anchor?.date).toBe("2026-06-20");
      expect(anchor?.grounding.spot.grounded).toBe(true);
      expect(anchor?.spotMid).toBeCloseTo(16.4339, 4);
      expect(p.summary.spotGroundedDays).toBeGreaterThan(0);
      expect(p.summary.latestSpot).toBeCloseTo(16.4339, 4);
    } finally {
      s.close();
    }
  });

  it("never grounds forward points and grounds ZAR OIS from zaronia", () => {
    const s = seededStore();
    try {
      const p = buildGroundedMarketPath(s);
      for (const o of p.observations) {
        expect(o.grounding.forwardPoints.grounded).toBe(false);
        expect(o.grounding.forwardPoints.reason).toBe("no-forward-points-feed");
      }
      const anchor = p.observations[p.observations.length - 1];
      expect(anchor?.grounding.oisRate.grounded).toBe(true);
      expect(anchor?.oisRate).toBeCloseTo(0.0793, 4);
    } finally {
      s.close();
    }
  });
});

describe("buildGroundedMarketPath — clean store", () => {
  it("flags every field ungrounded with a reason, never crashes", () => {
    const p = buildGroundedMarketPath(undefined);
    expect(p.observations.length).toBeGreaterThan(0);
    for (const o of p.observations) {
      expect(o.grounding.spot.grounded).toBe(false);
      expect(o.grounding.spot.reason).toBeTruthy();
      expect(o.grounding.oisRate.grounded).toBe(false);
      expect(o.grounding.forwardPoints.grounded).toBe(false);
    }
    expect(p.summary.hasUngroundedField).toBe(true);
  });
});

describe("assertGroundingHonesty", () => {
  it("passes on a grounded path and a clean-store path", () => {
    const s = seededStore();
    try {
      expect(assertGroundingHonesty(buildGroundedMarketPath(s))).toEqual([]);
    } finally {
      s.close();
    }
    expect(assertGroundingHonesty(buildGroundedMarketPath(undefined))).toEqual([]);
  });

  it("catches a synthetic value presented without a grounding flag (tampered path)", () => {
    // Hand-craft a path where spot carries a value but is flagged grounded:false
    // WITHOUT a reason — the silently-synthetic case the invariant forbids.
    const tampered: GroundedMarketPathDto = {
      pair: "USD/ZAR",
      windowDays: 1,
      eodHourUtc: 17,
      observations: [
        {
          date: "2026-06-20",
          asOfInstant: "2026-06-20T17:00:00.000Z",
          pair: "USD/ZAR",
          spotMid: 18.5,
          forwardPoints: 0.05,
          oisRate: 0.07,
          grounding: {
            spot: { grounded: false }, // missing reason → silently-synthetic
            forwardPoints: { grounded: false, reason: "no-forward-points-feed" },
            oisRate: { grounded: false, reason: "no-production-zaronia-rate-at-or-before-instant" },
          },
        },
      ],
      summary: {
        pair: "USD/ZAR",
        observations: 1,
        spotGroundedDays: 0,
        oisGroundedDays: 0,
        forwardPointsGrounded: false,
        spotSource: null,
        latestSpot: null,
        latestSpotAsOf: null,
        latestOisRate: null,
        latestOisAsOf: null,
        hasUngroundedField: true,
        statement: "test",
      },
    };
    const violations = assertGroundingHonesty(tampered);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.subject === "2026-06-20:spot")).toBe(true);
  });

  it("catches forward points falsely flagged grounded", () => {
    const tampered: GroundedMarketPathDto = {
      pair: "USD/ZAR",
      windowDays: 1,
      eodHourUtc: 17,
      observations: [
        {
          date: "2026-06-20",
          asOfInstant: "2026-06-20T17:00:00.000Z",
          pair: "USD/ZAR",
          spotMid: 16.4,
          forwardPoints: 0.05,
          oisRate: 0.07,
          grounding: {
            spot: {
              grounded: true,
              source: "twelve-data",
              asOf: "2026-06-20T17:00:00.000Z",
              value: 16.4,
            },
            forwardPoints: { grounded: true, source: "fabricated", asOf: "x", value: 0.05 },
            oisRate: { grounded: false, reason: "no-production-zaronia-rate-at-or-before-instant" },
          },
        },
      ],
      summary: {
        pair: "USD/ZAR",
        observations: 1,
        spotGroundedDays: 1,
        oisGroundedDays: 0,
        forwardPointsGrounded: true,
        spotSource: "twelve-data",
        latestSpot: 16.4,
        latestSpotAsOf: "2026-06-20T17:00:00.000Z",
        latestOisRate: null,
        latestOisAsOf: null,
        hasUngroundedField: true,
        statement: "test",
      },
    };
    const violations = assertGroundingHonesty(tampered);
    expect(violations.some((v) => v.subject === "2026-06-20:forwardPoints")).toBe(true);
  });
});
