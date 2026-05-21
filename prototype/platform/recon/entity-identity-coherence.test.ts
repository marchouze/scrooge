// platform/recon/entity-identity-coherence.test.ts
//
// Unit tests for the entity-identity-coherence recon.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { type MinimalEvent, run } from "./entity-identity-coherence";

describe("entity-identity-coherence", () => {
  it("empty event stream → asserted=0, ok=true", () => {
    const r = run({ events: [] });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it("canonical short-id LE-ZA-HOZ-BANK → ok=true", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-1",
        type: "FxTradeExecuted",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
      },
      {
        event_id: "evt-2",
        type: "AccountingPeriodOpened",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(2);
    expect(r.violations).toHaveLength(0);
  });

  it("legacy BANK-ZA-001 short-id → ok=false with fail violation", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-legacy",
        type: "FxTradeExecuted",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "BANK-ZA-001",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("BANK-ZA-001");
    expect(r.violations[0]?.message).toContain("LE-ZA-HOZ-BANK");
  });

  it("unknown short-id → ok=false with fail violation", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-rogue",
        type: "FxTradeExecuted",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "LE-ZA-ROGUE-BANK",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.subject).toContain("evt-rogue");
  });

  it("mixed stream → asserted = total, violations = only the bad ones", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-ok-1",
        type: "FxTradeExecuted",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
      },
      {
        event_id: "evt-bad",
        type: "FxTradeExecuted",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "BANK-ZA-001",
      },
      {
        event_id: "evt-ok-2",
        type: "AccountingPeriodOpened",
        as_of: "2026-05-21T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.asserted).toBe(3);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.subject).toContain("evt-bad");
  });

  it("CLI-style integration over the real event store does not throw", () => {
    // Run with no opts — replays the live event store via composition.
    // The dispatched assertion: it must complete without throwing. The
    // ok/fail outcome depends on prior events emitted into .local/event.db
    // by the backfill pipeline; for this test we only assert the runner
    // itself returns a well-formed ReconResult.
    const r = run();
    expect(r.pipeline).toBe("entity-identity-coherence");
    expect(typeof r.ok).toBe("boolean");
    expect(typeof r.asserted).toBe("number");
    expect(Array.isArray(r.violations)).toBe(true);
  });
});
