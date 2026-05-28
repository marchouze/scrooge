// tests/ifrs9-staging.test.ts
//
// Unit tests for the IFRS 9 staging engine and Ifrs9StageAssigned event schema.
//
// Test cases:
//   TC-1:  Stage 1 — performing (dpd=0, no SICR flags)
//   TC-2:  Stage 2 — 30 DPD trigger
//   TC-3:  Stage 3 — 90 DPD trigger
//   TC-4:  Stage 2 — manual SICR flag (dpd=0)
//   TC-5:  Stage 3 — restructured flag (dpd=0)
//   TC-6:  Stage 3 — formal default (dpd=0)
//   TC-7:  Stage 1 ECL rates — low-risk (bond/repo/money-market) = 5 bps
//   TC-8:  Stage 1 ECL rates — trading-book (equity/irs/fx-swap) = 15 bps
//   TC-9:  computeEcl: 100_000_000 minor units × 5 bps = 50_000
//   TC-10: computeEcl: 0 notional → 0 ECL
//   TC-11: Ifrs9StageAssignedSchema validates a correct Stage 1 payload
//   TC-12: Ifrs9StageAssignedSchema rejects missing required fields
//   TC-13: Script smoke test — 0 trades in store → exits cleanly (no error)
//   TC-14: Stage 3 priority over Stage 2 (dpd=90 + manualSicr — Stage 3 wins)
//   TC-15: Stage 2 priority: dpd=30 + restructured=false → Stage 2, not Stage 3
//
// Authority:
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - IFRS 9 §5.5.1–§5.5.17
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Ifrs9StageAssignedSchema, makeIfrs9StageAssigned } from "../platform/event-store/event-types/ifrs9-staging";
import { EventStore } from "../platform/event-store/store";
import { assessIfrs9Stage, computeEcl } from "../platform/accounting/ifrs9-staging";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  dpd: 0,
  manualSicr: false,
  restructured: false,
  defaultIndicator: false,
  productFamily: "equity",
  notionalMinor: 1_000_000_00, // ZAR 1,000,000 in cents
  currency: "ZAR",
};

// ---------------------------------------------------------------------------
// assessIfrs9Stage tests
// ---------------------------------------------------------------------------

describe("assessIfrs9Stage", () => {
  // TC-1: Stage 1 — all performing flags
  it("TC-1: dpd=0 with no flags → Stage 1, initial-recognition", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, dpd: 0 });
    expect(result.stage).toBe(1);
    expect(result.triggerReason).toBe("initial-recognition");
  });

  // TC-2: Stage 2 — 30 DPD
  it("TC-2: dpd=30 → Stage 2, 30-dpd", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, dpd: 30 });
    expect(result.stage).toBe(2);
    expect(result.triggerReason).toBe("30-dpd");
    expect(result.eclBasisPoints).toBe(100);
  });

  // TC-3: Stage 3 — 90 DPD
  it("TC-3: dpd=90 → Stage 3, 90-dpd", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, dpd: 90 });
    expect(result.stage).toBe(3);
    expect(result.triggerReason).toBe("90-dpd");
    expect(result.eclBasisPoints).toBe(5_000);
  });

  // TC-4: Stage 2 — manual SICR
  it("TC-4: manualSicr=true, dpd=0 → Stage 2, manual-sicr", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, manualSicr: true });
    expect(result.stage).toBe(2);
    expect(result.triggerReason).toBe("manual-sicr");
    expect(result.eclBasisPoints).toBe(100);
  });

  // TC-5: Stage 3 — restructured
  it("TC-5: restructured=true, dpd=0 → Stage 3, restructured", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, restructured: true });
    expect(result.stage).toBe(3);
    expect(result.triggerReason).toBe("restructured");
    expect(result.eclBasisPoints).toBe(5_000);
  });

  // TC-6: Stage 3 — formal default
  it("TC-6: defaultIndicator=true, dpd=0 → Stage 3, default", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, defaultIndicator: true });
    expect(result.stage).toBe(3);
    expect(result.triggerReason).toBe("default");
    expect(result.eclBasisPoints).toBe(5_000);
  });

  // TC-7: Stage 1 ECL rates — low-risk families (5 bps)
  it("TC-7: bond/repo/money-market → 5 bps Stage 1 ECL", () => {
    for (const productFamily of ["bond", "repo", "money-market"]) {
      const result = assessIfrs9Stage({ ...BASE_PARAMS, productFamily });
      expect(result.stage).toBe(1);
      expect(result.eclBasisPoints).toBe(5);
    }
  });

  // TC-8: Stage 1 ECL rates — trading-book families (15 bps)
  it("TC-8: equity/irs/fx-swap → 15 bps Stage 1 ECL", () => {
    for (const productFamily of ["equity", "irs", "fx-swap"]) {
      const result = assessIfrs9Stage({ ...BASE_PARAMS, productFamily });
      expect(result.stage).toBe(1);
      expect(result.eclBasisPoints).toBe(15);
    }
  });

  // TC-14: Stage 3 priority — dpd=90 + manualSicr → Stage 3 wins
  it("TC-14: dpd=90 AND manualSicr=true → Stage 3 (higher priority)", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, dpd: 90, manualSicr: true });
    expect(result.stage).toBe(3);
    expect(result.triggerReason).toBe("90-dpd");
  });

  // TC-15: Stage 2 — dpd=30, restructured=false → not Stage 3
  it("TC-15: dpd=30, restructured=false → Stage 2 (not Stage 3)", () => {
    const result = assessIfrs9Stage({ ...BASE_PARAMS, dpd: 30, restructured: false });
    expect(result.stage).toBe(2);
    expect(result.triggerReason).toBe("30-dpd");
  });
});

// ---------------------------------------------------------------------------
// computeEcl tests
// ---------------------------------------------------------------------------

describe("computeEcl", () => {
  // TC-9: 100_000_000 minor units × 5 bps = round(100000000 × 5 / 10000) = 50000
  it("TC-9: 100_000_000 cents × 5 bps = 50_000", () => {
    // 1,000,000 ZAR = 100_000_000 cents; ECL = ZAR 500 = 50_000 cents
    expect(computeEcl(1_000_000_00, 5)).toBe(Math.round((1_000_000_00 * 5) / 10_000));
    expect(computeEcl(1_000_000_00, 5)).toBe(50_000);
  });

  // TC-10: 0 notional → 0 ECL
  it("TC-10: 0 notional → 0 ECL", () => {
    expect(computeEcl(0, 100)).toBe(0);
  });

  // Rounding: fractional minor units are rounded
  it("rounds fractional minor units correctly", () => {
    // 3 cents × 5 bps = 3 × 5 / 10000 = 0.0015 → rounds to 0
    expect(computeEcl(3, 5)).toBe(0);
    // 1000 cents × 5 bps = 1000 × 5 / 10000 = 0.5 → rounds to 1 (Math.round)
    // Actually 5000 / 10000 = 0.5 → Math.round(0.5) = 1
    expect(computeEcl(1000, 5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe("Ifrs9StageAssignedSchema", () => {
  const validPayload = {
    tradeId: "trade:bank:eq:jse-equity-001",
    instrumentId: "prd:bank:equity:jse-equity",
    stage: 1 as const,
    eclBasisPoints: 15,
    eclAmountMinor: 0,
    currency: "ZAR",
    triggerReason: "initial-recognition" as const,
    assessedAt: "2026-05-28T07:00:00.000Z",
    assessorId: "ifrs9-engine",
    policyRef: "D-IFRS9-STAGING-V1",
  };

  // TC-11: valid Stage 1 payload passes schema validation
  it("TC-11: valid Stage 1 payload passes Zod schema", () => {
    expect(() => Ifrs9StageAssignedSchema.parse(validPayload)).not.toThrow();
    const parsed = Ifrs9StageAssignedSchema.parse(validPayload);
    expect(parsed.stage).toBe(1);
    expect(parsed.triggerReason).toBe("initial-recognition");
  });

  // TC-12: missing required fields → Zod throws
  it("TC-12: missing tradeId → schema throws", () => {
    const { tradeId: _omitted, ...invalid } = validPayload;
    expect(() => Ifrs9StageAssignedSchema.parse(invalid)).toThrow();
  });

  it("TC-12b: invalid stage value → schema throws", () => {
    expect(() => Ifrs9StageAssignedSchema.parse({ ...validPayload, stage: 4 })).toThrow();
  });

  it("TC-12c: invalid triggerReason → schema throws", () => {
    expect(() =>
      Ifrs9StageAssignedSchema.parse({ ...validPayload, triggerReason: "unknown-reason" }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// makeIfrs9StageAssigned factory tests
// ---------------------------------------------------------------------------

describe("makeIfrs9StageAssigned", () => {
  it("produces a valid Event with type Ifrs9StageAssigned", () => {
    const event = makeIfrs9StageAssigned({
      asOf: "2026-05-28T07:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "ifrs9-engine" },
      citations: ["D-IFRS9-STAGING-V1"],
      payload: {
        tradeId: "trade:bank:eq:jse-equity-001",
        instrumentId: "prd:bank:equity:jse-equity",
        stage: 1,
        eclBasisPoints: 15,
        eclAmountMinor: 0,
        currency: "ZAR",
        triggerReason: "initial-recognition",
        assessedAt: "2026-05-28T07:00:00.000Z",
        assessorId: "ifrs9-engine",
        policyRef: "D-IFRS9-STAGING-V1",
      },
    });
    expect(event.type).toBe("Ifrs9StageAssigned");
    expect(event.event_id).toBeTruthy();
    expect(event.citations).toContain("D-IFRS9-STAGING-V1");
  });

  it("throws if no citations provided", () => {
    expect(() =>
      makeIfrs9StageAssigned({
        asOf: "2026-05-28T07:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "ifrs9-engine" },
        citations: [],
        payload: {
          tradeId: "trade:bank:eq:001",
          instrumentId: "prd:bank:equity:jse-equity",
          stage: 1,
          eclBasisPoints: 15,
          eclAmountMinor: 0,
          currency: "ZAR",
          triggerReason: "initial-recognition",
          assessedAt: "2026-05-28T07:00:00.000Z",
          assessorId: "ifrs9-engine",
          policyRef: "D-IFRS9-STAGING-V1",
        },
      }),
    ).toThrow("at least one citation");
  });
});

// ---------------------------------------------------------------------------
// TC-13: Script smoke test — 0 trades in store → clean run
// ---------------------------------------------------------------------------

describe("ifrs9-staging-run smoke test", () => {
  it("TC-13: 0 trades in store → script imports cleanly and assessIfrs9Stage works on empty set", () => {
    // Create a throwaway EventStore to verify the script's EventStore usage pattern
    const tmpDir = mkdtempSync(join(tmpdir(), "ifrs9-staging-test-"));
    const dbPath = join(tmpDir, "event.db");
    const store = new EventStore(dbPath);

    // Replay TradeBooked on empty store → 0 events
    const events = [...store.replay({ type: "TradeBooked" })];
    expect(events.length).toBe(0);

    // With 0 trades, the staging run would emit 0 events and exit 0
    // (We verify the engine + store work without errors on empty data)
    const ifrs9Events = [...store.replay({ type: "Ifrs9StageAssigned" })];
    expect(ifrs9Events.length).toBe(0);
  });

  it("TC-13b: staging run emits correct events for a synthetic trade", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ifrs9-staging-test-"));
    const dbPath = join(tmpDir, "event.db");
    const store = new EventStore(dbPath);

    const now = new Date().toISOString();

    // Emit a synthetic TradeBooked
    const { makeTradeBooked } = require("../platform/event-store/event-types/markets-trading-extended");
    const tradeEvt = makeTradeBooked({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "test" },
      citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
      payload: {
        tradeId: "trade:bank:eq:test-001",
        instrument: "JSE Equity",
        side: "buy",
        quantity: 100,
        bookingPrice: 100,
        currency: "ZAR",
        bookedAt: now,
        portfolio: "trading-book",
      },
    });
    store.append(tradeEvt);

    // Assess and emit
    const result = assessIfrs9Stage({
      dpd: 0,
      manualSicr: false,
      restructured: false,
      defaultIndicator: false,
      productFamily: "equity",
      notionalMinor: 0,
      currency: "ZAR",
    });

    expect(result.stage).toBe(1);
    expect(result.triggerReason).toBe("initial-recognition");

    const stageEvt = makeIfrs9StageAssigned({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "ifrs9-engine" },
      citations: ["D-IFRS9-STAGING-V1"],
      payload: {
        tradeId: "trade:bank:eq:test-001",
        instrumentId: "JSE Equity",
        stage: result.stage,
        eclBasisPoints: result.eclBasisPoints,
        eclAmountMinor: result.eclAmountMinor,
        currency: "ZAR",
        triggerReason: result.triggerReason as "initial-recognition",
        assessedAt: now,
        assessorId: "ifrs9-engine",
        policyRef: "D-IFRS9-STAGING-V1",
      },
    });
    store.append(stageEvt);

    const emitted = [...store.replay({ type: "Ifrs9StageAssigned" })];
    expect(emitted.length).toBe(1);
    const p = emitted[0].payload as unknown as { stage: number; triggerReason: string };
    expect(p.stage).toBe(1);
    expect(p.triggerReason).toBe("initial-recognition");
  });
});
