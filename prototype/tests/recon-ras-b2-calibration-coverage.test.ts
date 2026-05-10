// tests/recon-ras-b2-calibration-coverage.test.ts
//
// Unit tests for the RAS B2 calibration-coverage recon (W2 Slice 2 of
// D-REGULATORY-READINESS-GATE-PLAN).
//
// Smoke: the pipeline runs against the live event store and returns a
// structured result. (We don't assert ok=true at smoke-time — the live
// state will be green only after `record-d-regulatory-readiness-w2-
// slice-2.ts` has been run, which requires a developer / CI tick.)
//
// Synthetic: hand-rolled events feed `run({ events, expectedCalibration })`
// and assert each violation class is detected.
//
// Authors: Helena (Chief Risk Officer, governance) +
//          Rohan (Risk engineer, engineering — under Helena) +
//          Bea (Accounting & financial reporting engineer, engineering
//               — under Camille (CFO, governance)).

import { describe, expect, it } from "bun:test";

import { run as rasB2CalibrationCoverage } from "../platform/recon/ras-b2-calibration-coverage";
import {
  RAS_B2_CITATIONS,
  RAS_B2_CITATION_LIST,
  RAS_B2_FIXTURE_PILLAR1,
  calibrateRasB2,
} from "../platform/risk/ras-b2-calibration";

const FULL_CITATIONS = [...RAS_B2_CITATION_LIST];

function syntheticCalibrationEvent(overrides: {
  eventId?: string;
  citations?: readonly string[];
  payload?: Record<string, unknown>;
}) {
  const calib = calibrateRasB2(RAS_B2_FIXTURE_PILLAR1);
  return {
    event_id: overrides.eventId ?? "evt-synthetic-ras-b2-001",
    type: "RasLineCalibrated",
    citations: overrides.citations ?? FULL_CITATIONS,
    payload: overrides.payload ?? {
      lineId: "B2",
      rasSection: "RAS §B3",
      calibrationDescription:
        "CET1 management buffer ≥ +1.5pp above PA min + Pillar 2A + capital conservation buffer",
      calibrationCitations: FULL_CITATIONS,
      calibrationSource: "Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md",
      standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
      obligationRowId: "ORG-PR-04",
      calibrationParameters: {
        targetCet1RatioPct: calib.targetCet1RatioPct,
        triggerCet1RatioPct: calib.triggerCet1RatioPct,
        escalateCet1RatioPct: calib.escalateCet1RatioPct,
        surplusOverTargetPct: calib.surplusOverTargetPct,
        breachPosture: calib.breachPosture,
      },
    },
  };
}

describe("RAS B2 calibration coverage pipeline", () => {
  it("smoke: runs against the live event store and returns a structured result", () => {
    const r = rasB2CalibrationCoverage();
    expect(r.pipeline).toBe("ras-b2-calibration-coverage");
    expect(typeof r.ok).toBe("boolean");
    expect(r.asserted).toBeGreaterThan(0);
    // Surface findings to test output for visibility but do not fail the
    // smoke test on absence of the calibration event — the
    // record-d-regulatory-readiness-w2-slice-2.ts script lands the event
    // in a separate emit step.
    if (!r.ok) {
      console.log(
        `[ras-b2-calibration-coverage] live findings (${r.violations.length}):`,
        r.violations.map((v) => `${v.subject}: ${v.message}`).join("\n  "),
      );
    }
  });

  it("ok when the synthetic event matches expected calibration + carries all required citations", () => {
    const r = rasB2CalibrationCoverage({
      events: [syntheticCalibrationEvent({})],
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails when there is no RasLineCalibrated event for B2", () => {
    const r = rasB2CalibrationCoverage({ events: [] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("No active RasLineCalibrated"))).toBe(true);
  });

  it("ignores non-B2 lines (only B2 calibration is asserted)", () => {
    const otherLine = syntheticCalibrationEvent({
      eventId: "evt-synthetic-other",
      payload: {
        lineId: "B3",
        rasSection: "RAS §B3",
        calibrationDescription: "LCR/NSFR buffer",
        calibrationCitations: FULL_CITATIONS,
        calibrationSource: "Owner Inbox/synthetic.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-06",
      },
    });
    const r = rasB2CalibrationCoverage({ events: [otherLine] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("No active RasLineCalibrated"))).toBe(true);
  });

  it("fails when obligationRowId does not match ORG-PR-04", () => {
    const wrongObligation = syntheticCalibrationEvent({
      payload: {
        lineId: "B2",
        rasSection: "RAS §B3",
        calibrationDescription: "test",
        calibrationCitations: FULL_CITATIONS,
        calibrationSource: "test.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-99",
      },
    });
    const r = rasB2CalibrationCoverage({ events: [wrongObligation] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("ORG-PR-04"))).toBe(true);
  });

  it("fails when a required citation is missing from both event.citations and payload.calibrationCitations", () => {
    // Drop the Reg 38 citation from both surfaces.
    const stripped = FULL_CITATIONS.filter((c) => c !== RAS_B2_CITATIONS.reg38);
    const ev = syntheticCalibrationEvent({
      citations: stripped,
      payload: {
        lineId: "B2",
        rasSection: "RAS §B3",
        calibrationDescription: "test",
        calibrationCitations: stripped,
        calibrationSource: "test.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-04",
      },
    });
    const r = rasB2CalibrationCoverage({ events: [ev] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes(RAS_B2_CITATIONS.reg38))).toBe(true);
  });

  it("passes when a required citation is present on calibrationCitations even if missing from event-level citations", () => {
    // Reg 38 only on payload.calibrationCitations.
    const stripped = FULL_CITATIONS.filter((c) => c !== RAS_B2_CITATIONS.reg38);
    const ev = syntheticCalibrationEvent({
      citations: stripped,
      payload: {
        lineId: "B2",
        rasSection: "RAS §B3",
        calibrationDescription: "test",
        calibrationCitations: FULL_CITATIONS,
        calibrationSource: "test.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-04",
        calibrationParameters: {
          targetCet1RatioPct: 8.5,
          triggerCet1RatioPct: 5.25,
          escalateCet1RatioPct: 4.75,
        },
      },
    });
    const r = rasB2CalibrationCoverage({ events: [ev] });
    expect(r.ok).toBe(true);
  });

  it("fails when calibrationParameters drift from the live calibration function", () => {
    const ev = syntheticCalibrationEvent({
      payload: {
        lineId: "B2",
        rasSection: "RAS §B3",
        calibrationDescription: "test",
        calibrationCitations: FULL_CITATIONS,
        calibrationSource: "test.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-04",
        calibrationParameters: {
          // Wrong target — should be 8.5, set to 9.0 to simulate drift.
          targetCet1RatioPct: 9.0,
          triggerCet1RatioPct: 5.25,
          escalateCet1RatioPct: 4.75,
        },
      },
    });
    const r = rasB2CalibrationCoverage({ events: [ev] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("Drift on calibrationParameters"))).toBe(
      true,
    );
  });

  it("supersedes-chain: prior calibration is ignored when a later one supersedes it", () => {
    const prior = syntheticCalibrationEvent({ eventId: "evt-prior" });
    const later = syntheticCalibrationEvent({
      eventId: "evt-later",
      payload: {
        lineId: "B2",
        rasSection: "RAS §B3",
        calibrationDescription: "recalibration",
        calibrationCitations: FULL_CITATIONS,
        calibrationSource: "Owner Inbox/recalibration.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-04",
        supersedesCalibrationEventId: "evt-prior",
        calibrationParameters: {
          targetCet1RatioPct: 8.5,
          triggerCet1RatioPct: 5.25,
          escalateCet1RatioPct: 4.75,
        },
      },
    });
    const r = rasB2CalibrationCoverage({ events: [prior, later] });
    expect(r.ok).toBe(true);
  });

  it("fails when there are multiple active calibrations (broken supersedes-chain)", () => {
    const a = syntheticCalibrationEvent({ eventId: "evt-a" });
    const b = syntheticCalibrationEvent({ eventId: "evt-b" });
    const r = rasB2CalibrationCoverage({ events: [a, b] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("Multiple active calibrations"))).toBe(true);
  });
});
