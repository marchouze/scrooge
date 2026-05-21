// tests/ras-b2-calibration.test.ts
//
// D-REGULATORY-READINESS-W2-SLICE-2 — exit-criterion test for the RAS B2
// calibration substrate.
//
// Asserts:
//   - The pure calibration function produces the expected target /
//     trigger / escalate ratios across canonical inputs.
//   - The function rejects negative or non-finite inputs (defence-in-depth).
//   - The build-phase fixture produces the documented numerical posture.
//   - The breach-posture classification covers green / amber / red bands.
//   - The RasLineCalibrated event type is registered + schema-validated.
//   - The Zod payload schema accepts canonical payloads + rejects
//     boundary violations.
//
// Authority: D-REGULATORY-READINESS-W2-SLICE-2 (under standing approval
//            of D-REGULATORY-READINESS-GATE-PLAN, CEO-approved 2026-05-10).
// Source spec: Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-
//              gate-plan.md §3 W2 Slice 2.
//
// Authors: Helena (Chief Risk Officer, governance) +
//          Rohan (Risk engineer, engineering — under Helena) +
//          Bea (Accounting & financial reporting engineer, engineering
//               — under Camille (CFO, governance)).

import { describe, expect, it } from "bun:test";

import { newEventId } from "../platform/core/types";
import {
  makeRasLineCalibrated,
  rasLineCalibratedPayloadSchema,
} from "../platform/event-store/event-types";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";
import {
  ESCALATE_BUFFER_PCT,
  MANAGEMENT_BUFFER_PCT,
  RAS_B2_CITATIONS,
  RAS_B2_CITATION_LIST,
  RAS_B2_FIXTURE_PILLAR1,
  TRIGGER_BUFFER_PCT,
  calibrateRasB2,
  calibrateRasB2FromFixture,
} from "../platform/risk/ras-b2-calibration";

describe("RAS B2 calibration — pure function", () => {
  it("computes target / trigger / escalate from canonical inputs", () => {
    const r = calibrateRasB2({
      paCet1MinimumPct: 4.5,
      pillar2APct: 1.0,
      ccbPct: 2.5,
      liveCet1RatioPct: 12.0,
      inputSource: "test:canonical-pa-srep",
    });
    // target = 4.5 + 1.0 + 2.5 + 1.5 = 9.5
    expect(r.targetCet1RatioPct).toBeCloseTo(9.5, 9);
    // trigger = 4.5 + 0.75 = 5.25
    expect(r.triggerCet1RatioPct).toBeCloseTo(5.25, 9);
    // escalate = 4.5 + 0.25 = 4.75
    expect(r.escalateCet1RatioPct).toBeCloseTo(4.75, 9);
    // surplus = 12.0 - 9.5 = 2.5
    expect(r.surplusOverTargetPct).toBeCloseTo(2.5, 9);
    expect(r.breachPosture).toBe("green");
    expect(r.inputSource).toBe("test:canonical-pa-srep");
  });

  it("classifies breach posture across the three bands", () => {
    const baseline = {
      paCet1MinimumPct: 4.5,
      pillar2APct: 0.0,
      ccbPct: 2.5,
      inputSource: "test:posture-bands",
    };
    // green: live above trigger (5.25)
    expect(calibrateRasB2({ ...baseline, liveCet1RatioPct: 6.0 }).breachPosture).toBe("green");
    // amber-trigger: live below trigger (5.25) but above escalate (4.75)
    expect(calibrateRasB2({ ...baseline, liveCet1RatioPct: 5.0 }).breachPosture).toBe(
      "amber-trigger",
    );
    // red-escalate: live below escalate (4.75)
    expect(calibrateRasB2({ ...baseline, liveCet1RatioPct: 4.5 }).breachPosture).toBe(
      "red-escalate",
    );
    // boundary: live exactly at trigger → green (strict <)
    expect(calibrateRasB2({ ...baseline, liveCet1RatioPct: 5.25 }).breachPosture).toBe("green");
    // boundary: live exactly at escalate → amber-trigger (strict <)
    expect(calibrateRasB2({ ...baseline, liveCet1RatioPct: 4.75 }).breachPosture).toBe(
      "amber-trigger",
    );
  });

  it("can produce green posture with negative surplus when live is below target but above trigger", () => {
    // 4.5 PA + 0.0 P2A + 2.5 CCB + 1.5 mgmt = 8.5 target. Live 6.0:
    // surplus = -2.5 (under RAS B2 floor) but > trigger 5.25 → green.
    const r = calibrateRasB2({
      paCet1MinimumPct: 4.5,
      pillar2APct: 0.0,
      ccbPct: 2.5,
      liveCet1RatioPct: 6.0,
      inputSource: "test:negative-surplus-still-green",
    });
    expect(r.surplusOverTargetPct).toBeLessThan(0);
    expect(r.breachPosture).toBe("green");
  });

  it("rejects negative inputs (defence-in-depth)", () => {
    expect(() =>
      calibrateRasB2({
        paCet1MinimumPct: -1,
        pillar2APct: 0,
        ccbPct: 2.5,
        liveCet1RatioPct: 12,
        inputSource: "test:invalid",
      }),
    ).toThrow(/non-negative/);
  });

  it("rejects non-finite inputs (defence-in-depth)", () => {
    expect(() =>
      calibrateRasB2({
        paCet1MinimumPct: 4.5,
        pillar2APct: 0,
        ccbPct: Number.NaN,
        liveCet1RatioPct: 12,
        inputSource: "test:nan",
      }),
    ).toThrow(/finite/);
  });

  it("constants codify the RAS §B3 thresholds", () => {
    expect(MANAGEMENT_BUFFER_PCT).toBe(1.5);
    expect(TRIGGER_BUFFER_PCT).toBe(0.75);
    expect(ESCALATE_BUFFER_PCT).toBe(0.25);
  });
});

describe("RAS B2 calibration — build-phase fixture", () => {
  it("fixture produces target=8.5pp, trigger=5.25pp, escalate=4.75pp, surplus=5.5pp, posture=green", () => {
    const r = calibrateRasB2FromFixture();
    expect(r.targetCet1RatioPct).toBeCloseTo(8.5, 9);
    expect(r.triggerCet1RatioPct).toBeCloseTo(5.25, 9);
    expect(r.escalateCet1RatioPct).toBeCloseTo(4.75, 9);
    expect(r.surplusOverTargetPct).toBeCloseTo(5.5, 9);
    expect(r.breachPosture).toBe("green");
    expect(r.inputSource).toBe("fixture:ras-b2-fixture-pillar1-2026-05-10");
  });

  it("fixture matches the documented Pillar-1 inputs from Bea's reporting-capability spec", () => {
    expect(RAS_B2_FIXTURE_PILLAR1.paCet1MinimumPct).toBe(4.5);
    expect(RAS_B2_FIXTURE_PILLAR1.pillar2APct).toBe(0.0);
    expect(RAS_B2_FIXTURE_PILLAR1.ccbPct).toBe(2.5);
    expect(RAS_B2_FIXTURE_PILLAR1.liveCet1RatioPct).toBe(14.0);
  });
});

describe("RasLineCalibrated event — type registry", () => {
  it("is registered in EVENT_TYPE_REGISTRY exactly once", () => {
    const matches = EVENT_TYPE_REGISTRY.filter((m) => m.type === "RasLineCalibrated");
    expect(matches.length).toBe(1);
  });

  it("carries a typed Zod payload schema + retention metadata", () => {
    const meta = lookupEventType("RasLineCalibrated");
    expect(meta).toBeDefined();
    expect(meta?.payloadSchema).toBeDefined();
    expect(meta?.retention).toBeDefined();
    expect(meta?.retention.minimumYears).toBeGreaterThanOrEqual(7);
    expect(meta?.class).toBe("governance");
    expect(meta?.issuer).toBe("Helena");
  });

  it("citation hints include the five required RAS B2 citations", () => {
    const meta = lookupEventType("RasLineCalibrated");
    expect(meta?.citationsHint).toContain(RAS_B2_CITATIONS.banksAct);
    expect(meta?.citationsHint).toContain(RAS_B2_CITATIONS.reg38);
    expect(meta?.citationsHint).toContain(RAS_B2_CITATIONS.basel3);
    expect(meta?.citationsHint).toContain(RAS_B2_CITATIONS.rasB3);
    expect(meta?.citationsHint).toContain(RAS_B2_CITATIONS.obligation);
  });
});

describe("RasLineCalibrated event — payload schema", () => {
  const VALID_PAYLOAD = {
    lineId: "B2",
    rasSection: "RAS §B3",
    calibrationDescription:
      "CET1 management buffer ≥ +1.5pp above PA min + Pillar 2A + capital conservation buffer",
    calibrationCitations: [...RAS_B2_CITATION_LIST],
    calibrationSource: "Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md",
    standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
    obligationRowId: "ORG-PR-04",
  };

  it("accepts canonical payloads (positive parse)", () => {
    expect(() => rasLineCalibratedPayloadSchema.parse(VALID_PAYLOAD)).not.toThrow();
  });

  it("accepts payloads with calibrationParameters + supersedesCalibrationEventId", () => {
    expect(() =>
      rasLineCalibratedPayloadSchema.parse({
        ...VALID_PAYLOAD,
        supersedesCalibrationEventId: newEventId(),
        calibrationParameters: {
          targetCet1RatioPct: 8.5,
          triggerCet1RatioPct: 5.25,
        },
      }),
    ).not.toThrow();
  });

  it("rejects payloads missing lineId", () => {
    const { lineId: _lineId, ...rest } = VALID_PAYLOAD;
    expect(() => rasLineCalibratedPayloadSchema.parse(rest)).toThrow();
  });

  it("rejects payloads with empty calibrationCitations array", () => {
    expect(() =>
      rasLineCalibratedPayloadSchema.parse({ ...VALID_PAYLOAD, calibrationCitations: [] }),
    ).toThrow();
  });

  it("rejects payloads with empty supersedesCalibrationEventId", () => {
    expect(() =>
      rasLineCalibratedPayloadSchema.parse({
        ...VALID_PAYLOAD,
        supersedesCalibrationEventId: "",
      }),
    ).toThrow();
  });
});

describe("RasLineCalibrated event — maker", () => {
  it("constructs a valid Event envelope", () => {
    const e = makeRasLineCalibrated({
      asOf: "2026-05-10T13:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: [...RAS_B2_CITATION_LIST],
      payload: {
        lineId: "B2",
        rasSection: "RAS §B3",
        calibrationDescription:
          "CET1 management buffer ≥ +1.5pp above PA min + Pillar 2A + capital conservation buffer",
        calibrationCitations: [...RAS_B2_CITATION_LIST],
        calibrationSource:
          "Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md",
        standingAuthority: "D-REGULATORY-READINESS-GATE-PLAN",
        obligationRowId: "ORG-PR-04",
      },
    });
    expect(e.type).toBe("RasLineCalibrated");
    expect(e.entity).toBe("LE-ZA-HOZ-BANK");
    expect(e.citations.length).toBeGreaterThan(0);
    expect((e.payload as Record<string, unknown>).lineId).toBe("B2");
  });
});
