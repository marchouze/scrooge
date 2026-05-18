// tests/capital-metrics.test.ts
//
// Unit tests for platform/projections/capital-metrics.ts
//
// Asserts:
//   1. Build-phase baseline → green (R263.325m headroom, CET1 ~407%).
//   2. Empty event store → build-phase baseline fallback (same as above).
//   3. Amber path: R50m ≤ headroom < R100m.
//   4. Red path: headroom < R50m but ≥ TICR (non-critical red).
//   5. Critical path: headroom < TICR.
//   6. Green boundary: headroom exactly R100m → green.
//   7. Amber boundary: headroom exactly R50m → amber.
//   8. Red boundary (TICR): headroom exactly TICR → red (non-critical).
//   9. Note field includes headroom figure and CET1 ratio.
//  10. Live capital events → live mode (buildPhase: false).
//  11. Dividend payments reduce available capital.
//  12. Non-ZAR capital events are ignored (ZAR-only build phase).
//
// Authority: D-RAS (2026-05-06), D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  BUILD_PHASE_HEADROOM_MINOR,
  BUILD_PHASE_TOTAL_CAPITAL_MINOR,
  BUILD_PHASE_TOTAL_RWA_MINOR,
  THRESHOLD_BOARD_NOTIFICATION_MINOR,
  THRESHOLD_CEO_ESCALATION_MINOR,
  THRESHOLD_CRITICAL_MINOR,
  TICR_MINOR,
  computeCapitalMetrics,
} from "../platform/projections/capital-metrics";

const AS_OF = "2026-05-18T09:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:test" };
const CITATIONS = ["D-MARKETS-CAPITAL-TIME-SHAPE", "D-RAS"];

// ---------------------------------------------------------------------------
// Provenance override — tests use untagged (simulated) events.
// ---------------------------------------------------------------------------

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appendCapitalEvent(
  store: EventStore,
  kind: "equity-issuance" | "capital-injection" | "tier2-issuance" | "dividend-payment" | "buyback" | "other",
  amountMinor: number,
  currency = "ZAR",
): void {
  store.append({
    event_id: newEventId(),
    type: "CapitalEvent",
    as_of: AS_OF,
    entity: "BANK-ZA-001",
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      eventId: newEventId(),
      capitalEventKind: kind,
      amount: amountMinor,
      currency,
      effectiveDate: AS_OF,
    },
  });
}

// ---------------------------------------------------------------------------
// 1 + 2. Build-phase baseline / empty store
// ---------------------------------------------------------------------------

describe("capital-metrics — build-phase baseline", () => {
  it("empty store → build-phase fallback with green status", () => {
    const store = new EventStore(":memory:");
    const m = computeCapitalMetrics(store, AS_OF);

    expect(m.buildPhase).toBe(true);
    expect(m.availableCapitalMinor).toBe(BUILD_PHASE_TOTAL_CAPITAL_MINOR);
    expect(m.ticrMinor).toBe(TICR_MINOR);
    expect(m.accruedChargesMinor).toBe(0);
    expect(m.headroomMinor).toBe(BUILD_PHASE_HEADROOM_MINOR);
    // headroom R263.325m — well above R100m threshold → green
    expect(m.status).toBe("green");
    expect(m.critical).toBe(false);
  });

  it("build-phase headroom is R263,325,000 (263_325_000_00 cents)", () => {
    const store = new EventStore(":memory:");
    const m = computeCapitalMetrics(store, AS_OF);

    // R300m − R36.675m = R263.325m
    expect(m.headroomMinor).toBe(300_000_000_00 - 3_667_500_00);
    expect(m.headroomZar).toBeCloseTo(263_325_000, 2);
  });

  it("build-phase CET1 ratio is ~407% (R300m / R73.75m)", () => {
    const store = new EventStore(":memory:");
    const m = computeCapitalMetrics(store, AS_OF);

    const expected = BUILD_PHASE_TOTAL_CAPITAL_MINOR / BUILD_PHASE_TOTAL_RWA_MINOR;
    expect(m.cet1Ratio).toBeCloseTo(expected, 6);
    // ~407%
    expect(m.cet1Ratio).toBeGreaterThan(4.0);
    expect(m.cet1RatioPct).toMatch(/^\d+\.\d{2}%$/);
  });

  it("note field includes headroom figure and CET1 ratio", () => {
    const store = new EventStore(":memory:");
    const m = computeCapitalMetrics(store, AS_OF);

    expect(m.note).toContain("ICAAP v1");
    expect(m.note).toContain("D-MARKETS-CAPITAL-TIME-SHAPE");
    expect(m.note).toContain("headroom");
    expect(m.note).toMatch(/\d+\.\d{2}%/); // CET1 ratio
    expect(m.note).toContain("green");
  });

  it("asOf is passed through", () => {
    const store = new EventStore(":memory:");
    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.asOf).toBe(AS_OF);
  });
});

// ---------------------------------------------------------------------------
// 3. Amber path
// ---------------------------------------------------------------------------

describe("capital-metrics — amber path (R50m ≤ headroom < R100m)", () => {
  it("headroom R75m → amber", () => {
    const store = new EventStore(":memory:");
    // Inject just enough capital: TICR + R75m
    const capital = TICR_MINOR + 75_000_000_00;
    appendCapitalEvent(store, "equity-issuance", capital);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.buildPhase).toBe(false);
    expect(m.headroomMinor).toBe(75_000_000_00);
    expect(m.status).toBe("amber");
    expect(m.critical).toBe(false);
  });

  it("headroom R50m (boundary — lower amber boundary) → amber", () => {
    const store = new EventStore(":memory:");
    const capital = TICR_MINOR + THRESHOLD_BOARD_NOTIFICATION_MINOR;
    appendCapitalEvent(store, "equity-issuance", capital);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(THRESHOLD_BOARD_NOTIFICATION_MINOR);
    expect(m.status).toBe("amber");
    expect(m.critical).toBe(false);
  });

  it("headroom just below R100m → amber, not green", () => {
    const store = new EventStore(":memory:");
    const capital = TICR_MINOR + THRESHOLD_CEO_ESCALATION_MINOR - 1;
    appendCapitalEvent(store, "equity-issuance", capital);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(THRESHOLD_CEO_ESCALATION_MINOR - 1);
    expect(m.status).toBe("amber");
  });
});

// ---------------------------------------------------------------------------
// 4. Red path (non-critical: headroom < R50m but ≥ TICR)
// ---------------------------------------------------------------------------

describe("capital-metrics — red path (TICR ≤ headroom < R50m)", () => {
  it("headroom R40m → red (non-critical)", () => {
    const store = new EventStore(":memory:");
    const capital = TICR_MINOR + 40_000_000_00;
    appendCapitalEvent(store, "equity-issuance", capital);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(40_000_000_00);
    expect(m.status).toBe("red");
    expect(m.critical).toBe(false);
  });

  it("headroom R1 (just above 0) → red (non-critical)", () => {
    const store = new EventStore(":memory:");
    const capital = TICR_MINOR + 1;
    appendCapitalEvent(store, "equity-issuance", capital);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(1);
    expect(m.status).toBe("red");
    expect(m.critical).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Critical path (headroom < TICR)
// ---------------------------------------------------------------------------

describe("capital-metrics — critical path (headroom < TICR)", () => {
  it("headroom 0 (capital = TICR exactly) → red + critical", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", TICR_MINOR);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(0);
    expect(m.status).toBe("red");
    expect(m.critical).toBe(true);
  });

  it("headroom negative (capital < TICR) → red + critical", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", TICR_MINOR - 1);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(-1);
    expect(m.status).toBe("red");
    expect(m.critical).toBe(true);
  });

  it("note mentions critical when critical=true", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", TICR_MINOR - 1_00); // R1 below TICR

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.critical).toBe(true);
    expect(m.note).toContain("critical");
  });
});

// ---------------------------------------------------------------------------
// 6–8. Boundary checks
// ---------------------------------------------------------------------------

describe("capital-metrics — boundary values", () => {
  it("headroom exactly R100m → green (not amber)", () => {
    const store = new EventStore(":memory:");
    const capital = TICR_MINOR + THRESHOLD_CEO_ESCALATION_MINOR;
    appendCapitalEvent(store, "equity-issuance", capital);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.headroomMinor).toBe(THRESHOLD_CEO_ESCALATION_MINOR);
    expect(m.status).toBe("green");
    expect(m.critical).toBe(false);
  });

  it("headroom exactly TICR → red (non-critical, not critical)", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", TICR_MINOR + THRESHOLD_CRITICAL_MINOR);
    // headroom = TICR_MINOR + THRESHOLD_CRITICAL_MINOR − TICR = THRESHOLD_CRITICAL_MINOR = TICR
    // i.e. capital is 2*TICR, headroom = TICR
    const m = computeCapitalMetrics(store, AS_OF);
    // headroom = capital - TICR = THRESHOLD_CRITICAL_MINOR = TICR_MINOR
    expect(m.headroomMinor).toBe(THRESHOLD_CRITICAL_MINOR);
    // headroomMinor = TICR_MINOR = THRESHOLD_CRITICAL_MINOR; condition is headroom < THRESHOLD_CRITICAL
    // which is false, so non-critical red
    expect(m.status).toBe("red");
    expect(m.critical).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Live capital events → live mode
// ---------------------------------------------------------------------------

describe("capital-metrics — live mode", () => {
  it("CapitalEvent equity-issuance → buildPhase: false", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", BUILD_PHASE_TOTAL_CAPITAL_MINOR);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.buildPhase).toBe(false);
    expect(m.availableCapitalMinor).toBe(BUILD_PHASE_TOTAL_CAPITAL_MINOR);
  });

  it("note says 'Live capital position' in live mode", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", BUILD_PHASE_TOTAL_CAPITAL_MINOR);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.note).toContain("Live capital position");
    expect(m.note).not.toContain("ICAAP v1");
  });
});

// ---------------------------------------------------------------------------
// 11. Dividend payments reduce available capital
// ---------------------------------------------------------------------------

describe("capital-metrics — live mode with outflows", () => {
  it("equity-issuance minus dividend reduces headroom", () => {
    const store = new EventStore(":memory:");
    // Inject R300m then pay R250m dividend → available = R50m
    appendCapitalEvent(store, "equity-issuance", 300_000_000_00);
    appendCapitalEvent(store, "dividend-payment", 250_000_000_00);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.availableCapitalMinor).toBe(50_000_000_00);
    // headroom = R50m − TICR (R36.675m) = R13.325m → red (non-critical)
    expect(m.headroomMinor).toBe(50_000_000_00 - TICR_MINOR);
    expect(m.status).toBe("red");
    expect(m.critical).toBe(false);
  });

  it("outflows exceeding inflows → availableCapital floored at 0", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", 10_000_000_00);
    appendCapitalEvent(store, "dividend-payment", 50_000_000_00);

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.availableCapitalMinor).toBe(0);
    // headroom = 0 − TICR → negative → critical
    expect(m.critical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Non-ZAR events are ignored
// ---------------------------------------------------------------------------

describe("capital-metrics — non-ZAR events ignored", () => {
  it("USD capital event not folded into ZAR metrics (falls back to build-phase)", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", 300_000_000_00, "USD");

    // No ZAR CapitalEvent → build-phase fallback
    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.buildPhase).toBe(true);
    expect(m.availableCapitalMinor).toBe(BUILD_PHASE_TOTAL_CAPITAL_MINOR);
  });

  it("ZAR event present alongside USD → ZAR-only live computation", () => {
    const store = new EventStore(":memory:");
    appendCapitalEvent(store, "equity-issuance", 300_000_000_00, "ZAR");
    appendCapitalEvent(store, "equity-issuance", 999_999_999_00, "USD"); // must be ignored

    const m = computeCapitalMetrics(store, AS_OF);
    expect(m.buildPhase).toBe(false);
    expect(m.availableCapitalMinor).toBe(300_000_000_00);
  });
});
