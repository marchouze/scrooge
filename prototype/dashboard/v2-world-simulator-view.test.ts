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
