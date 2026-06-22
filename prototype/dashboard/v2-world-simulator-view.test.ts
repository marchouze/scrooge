// dashboard/v2-world-simulator-view.test.ts
//
// View-level assertions for the Outside-World Simulator read-surface DTO
// (`GET /api/v2/markets/world-simulator`). The builder replays the canonical
// deterministic FX V2 scenario in-memory (no store dependency — pure replay over
// a SimulatedClock + SeededRng) and assembles the four read sections. These tests
// assert:
//   (1) all four sections are present + populated (scenario manifest, EOD
//       timeline, boundary attestation, run result);
//   (2) the boundary attestation reflects recon:fx-v2-sim-boundary green on the
//       live source tree (the load-bearing invariant);
//   (3) the run result carries the SUT cohort figures the simulator produced
//       (trades, FIL cohort, P&L / VaR / SA-CCR) — the simulator oracle, live;
//   (4) NO agent personal name leaks into the DTO (name-free policy;
//       feedback_no_agent_names_in_ui) — seat references are Titles only.
//
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { MarketDataStore } from "../platform/market-data/store";
import { buildV2WorldSimulatorView } from "./v2-world-simulator-view";

const NOW = "2026-06-21T12:00:00.000Z";

/** Roster persona first-names that must NEVER appear in a /api/v2 DTO. */
function rosterPersonaNames(): string[] {
  const repoRoot = resolve(import.meta.dir, "..", "..");
  const raw = readFileSync(resolve(repoRoot, "Team", "_team-roster.json"), "utf8");
  const parsed = JSON.parse(raw) as {
    personas?: Array<{ name?: string }>;
    ceoDirectReports?: Array<{ name?: string } | string>;
  };
  const names = new Set<string>();
  for (const p of parsed.personas ?? []) {
    if (p.name) names.add(p.name.split(/\s+/)[0]);
  }
  for (const r of parsed.ceoDirectReports ?? []) {
    const label = typeof r === "string" ? r : (r.name ?? "");
    const first = label.split(/\s+/)[0];
    if (first) names.add(first);
  }
  return [...names].filter((n) => n.length >= 3);
}

describe("buildV2WorldSimulatorView — four sections present + populated", () => {
  const view = buildV2WorldSimulatorView(NOW);

  it("Section 1 — scenario manifest is surfaced with seed, baseline, days, counterparties, market path", () => {
    expect(view.scenario.scenarioId).toBe("fx-v2-world-simulator");
    expect(view.scenario.seedHex.startsWith("0x")).toBe(true);
    expect(view.scenario.baselineInstant).toBe("2026-02-02T07:00:00.000Z");
    expect(view.scenario.dayCount).toBe(25);
    expect(view.scenario.counterparties.length).toBeGreaterThan(0);
    expect(view.scenario.counterparties[0]?.counterpartyId).toBe("CP-SIM-RELIABLE-001");
    // One USD/ZAR observation per day → 25 market-path rows.
    expect(view.scenario.marketPath.length).toBe(25);
    expect(view.scenario.marketPath[0]?.pair).toBe("USD/ZAR");
  });

  it("Section 2 — EOD timeline carries fired cadence-hook records in deterministic order", () => {
    expect(view.eodTimeline.boundariesFired).toBe(25);
    expect(view.eodTimeline.rows.length).toBeGreaterThan(0);
    // Hooks fire in ascending priority within a boundary; boundary index is monotone.
    expect(view.eodTimeline.hookIds).toContain("world-sim-pnl");
    expect(view.eodTimeline.hookIds).toContain("world-sim-var");
    const idxs = view.eodTimeline.rows.map((r) => r.boundaryIndex);
    for (let i = 1; i < idxs.length; i++) {
      expect(idxs[i]).toBeGreaterThanOrEqual(idxs[i - 1] as number);
    }
  });

  it("Section 3 — boundary attestation is GREEN on the live source tree (the binding invariant)", () => {
    expect(view.boundaryAttestation.ok).toBe(true);
    expect(view.boundaryAttestation.statusLabel).toBe("green");
    expect(view.boundaryAttestation.failCount).toBe(0);
    expect(view.boundaryAttestation.asserted).toBeGreaterThan(0);
    expect(view.boundaryAttestation.invariant.length).toBeGreaterThan(0);
  });

  it("Section 4 — run result carries the SUT cohort figures the simulator produced", () => {
    const rr = view.runResult;
    expect(rr.tradesGenerated).toBeGreaterThan(0);
    expect(rr.filCohortSize).toBeGreaterThan(0);
    // The forced fail-then-retry + settlement materialise cash + terminate the FX leg.
    expect(rr.settlementFailures).toBeGreaterThanOrEqual(1);
    expect(rr.cashLegsMaterialised).toBeGreaterThanOrEqual(2);
    expect(rr.fxTerminated).toBeGreaterThanOrEqual(1);
    // Day-1 spot booked 18.50, spot 18.60 → +500,000 ZAR MtM (the simulator oracle).
    expect(rr.dailyPnlReporting).not.toBeNull();
    expect(Math.round(rr.dailyPnlReporting as number)).toBe(500_000);
    // VaR computes on the late day (≥24 returns seeded).
    expect(rr.varStatus).toBe("computed");
    expect(rr.varReporting).not.toBeNull();
    // SA-CCR EAD ≥ RC ≥ 0 for the open FX exposure.
    expect(rr.saccrEadMinor).not.toBeNull();
    expect(rr.saccrRcMinor).not.toBeNull();
    expect(rr.saccrEadMinor as number).toBeGreaterThanOrEqual(rr.saccrRcMinor as number);
  });
});

describe("buildV2WorldSimulatorView — market path is GROUNDED in real production marks", () => {
  // Seed an in-memory market-data store with one real production USD/ZAR mark
  // (the live level ~16.43) + one production zaronia-rate, and assert the
  // displayed market path grounds spot + OIS from those marks (NOT the synthetic
  // 18.5) while forward points stay flagged ungrounded (no feed). Authority:
  // D-FX-V2-SIMULATOR-FIRST; Engineering-Charter cmd 4 (source, don't hardcode).
  const store = new MarketDataStore(":memory:");
  store.append({
    id: "t-usdzar-real",
    source: "twelve-data",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: "2026-06-20T17:00:00.000Z",
    payload: { pair: "USD/ZAR", mid: 16.4339 },
  });
  store.append({
    id: "t-zaronia-real",
    source: "zaronia-sarb",
    instrument: "ZARONIA",
    dataType: "zaronia-rate",
    provenance: "production",
    asOf: "2026-06-20T15:00:00+02:00",
    payload: { rate: "0.0793" },
  });
  const view = buildV2WorldSimulatorView(NOW, store);

  it("the displayed spot path is the REAL ~16.4 level, not the synthetic 18.5", () => {
    const gp = view.groundedMarketPath;
    expect(gp.observations.length).toBeGreaterThan(0);
    const anchor = gp.observations[gp.observations.length - 1];
    expect(anchor).toBeDefined();
    // Re-anchored to the seeded data window.
    expect(anchor?.date).toBe("2026-06-20");
    // Spot is the seeded real mark, grounded-from-store — not synthetic 18.5.
    expect(anchor?.spotMid).toBeCloseTo(16.4339, 4);
    expect(Math.abs((anchor?.spotMid ?? 0) - 18.5)).toBeGreaterThan(1);
    expect(anchor?.grounding.spot.grounded).toBe(true);
    expect(anchor?.grounding.spot.source).toBe("twelve-data");
    expect(anchor?.grounding.spot.asOf).toBe("2026-06-20T17:00:00.000Z");
  });

  it("forward points are flagged UNGROUNDED (no feed) on every day", () => {
    const gp = view.groundedMarketPath;
    expect(gp.summary.forwardPointsGrounded).toBe(false);
    for (const o of gp.observations) {
      expect(o.grounding.forwardPoints.grounded).toBe(false);
      expect(o.grounding.forwardPoints.reason).toBe("no-forward-points-feed");
    }
  });

  it("the ZAR OIS leg is grounded from the production zaronia-rate", () => {
    const gp = view.groundedMarketPath;
    const anchor = gp.observations[gp.observations.length - 1];
    expect(anchor?.grounding.oisRate.grounded).toBe(true);
    expect(anchor?.grounding.oisRate.source).toBe("zaronia-sarb");
    expect(anchor?.oisRate).toBeCloseTo(0.0793, 4);
  });

  it("a clean (no-store) build flags every field ungrounded — never synthetic-as-real", () => {
    const cleanView = buildV2WorldSimulatorView(NOW, undefined);
    const gp = cleanView.groundedMarketPath;
    expect(gp.summary.hasUngroundedField).toBe(true);
    for (const o of gp.observations) {
      // Spot falls back to a labelled synthetic value, but flagged ungrounded.
      expect(o.grounding.spot.grounded).toBe(false);
      expect(o.grounding.spot.reason).toBeTruthy();
    }
  });
});

describe("buildV2WorldSimulatorView — name-free policy (D-V2-UI-OVERSIGHT-STANDARD)", () => {
  it("the desk-owner reference is a seat Title, not a persona name, and no roster name leaks anywhere", () => {
    const view = buildV2WorldSimulatorView(NOW);
    // Desk owner is a non-empty Title string.
    expect(view.deskOwnerSeatTitle.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(view);
    for (const name of rosterPersonaNames()) {
      // Word-boundary match so substrings of legitimate tokens are not flagged.
      const rx = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      expect(serialized).not.toMatch(rx);
    }
  });
});
