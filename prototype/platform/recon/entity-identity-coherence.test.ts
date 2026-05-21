// platform/recon/entity-identity-coherence.test.ts
//
// Unit tests for the entity-identity-coherence recon.
//
// Coverage matrix (post Vera PR #679 + boundary semantics):
//   1. Empty stream → ok.
//   2. Active short-id post-boundary → ok.
//   3. Retired short-id post-boundary → fail (live drift).
//   4. Retired short-id pre-boundary → warn (defensible historical).
//   5. Unregistered short-id at any timestamp → fail.
//   6. Mixed stream — total asserted, only the bad ones violate; warn
//      severity does NOT flip `ok` to false (warn-class is observational).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK,
  type MinimalEvent,
  run,
} from "./entity-identity-coherence";

// Anchor timestamps either side of the boundary.
const POST_BOUNDARY = "2026-05-21T10:00:00.000Z"; // > boundary
const PRE_BOUNDARY = "2026-05-20T12:00:00.000Z"; // < boundary

describe("entity-identity-coherence", () => {
  it("empty event stream → asserted=0, ok=true", () => {
    const r = run({ events: [] });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it("canonical short-id LE-ZA-HOZ-BANK post-boundary → ok=true", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-1",
        type: "FxTradeExecuted",
        as_of: POST_BOUNDARY,
        entity: "LE-ZA-HOZ-BANK",
      },
      {
        event_id: "evt-2",
        type: "AccountingPeriodOpened",
        as_of: POST_BOUNDARY,
        entity: "LE-ZA-HOZ-BANK",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(2);
    expect(r.violations).toHaveLength(0);
  });

  it("retired BANK-ZA-001 post-boundary → ok=false with fail (live drift)", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-drift",
        type: "FxTradeExecuted",
        // Intentional legacy literal — this test exercises the
        // recon's rejection path for live drift.
        as_of: POST_BOUNDARY,
        entity: "BANK-ZA-001",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("BANK-ZA-001");
    expect(r.violations[0]?.message).toContain("live drift");
  });

  it("retired BANK-ZA-001 pre-boundary → warn (defensible historical), ok=true", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-historical",
        type: "FxTradeExecuted",
        // Intentional legacy literal — exercises the pre-boundary
        // historical-warn path (Principle 1 immutability).
        as_of: PRE_BOUNDARY,
        entity: "BANK-ZA-001",
      },
    ];
    const r = run({ events });
    // Warn-class does NOT fail the recon — historical events are
    // immutable per Principle 1 and must not block CI.
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("defensible historical");
    expect(r.violations[0]?.message).toContain(MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK);
  });

  it("unknown short-id pre-boundary → ok=false with fail (rogue at any time)", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-rogue-pre",
        type: "FxTradeExecuted",
        as_of: PRE_BOUNDARY,
        entity: "LE-ZA-ROGUE-BANK",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.subject).toContain("evt-rogue-pre");
  });

  it("unknown short-id post-boundary → ok=false with fail (rogue)", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-rogue-post",
        type: "FxTradeExecuted",
        as_of: POST_BOUNDARY,
        entity: "LE-ZA-ROGUE-BANK",
      },
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
  });

  it("mixed stream — active + post-boundary drift + pre-boundary historical + rogue", () => {
    const events: MinimalEvent[] = [
      {
        event_id: "evt-ok-1",
        type: "FxTradeExecuted",
        as_of: POST_BOUNDARY,
        entity: "LE-ZA-HOZ-BANK",
      },
      {
        event_id: "evt-drift",
        type: "FxTradeExecuted",
        // Intentional legacy literal — drift sample.
        as_of: POST_BOUNDARY,
        entity: "BANK-ZA-001",
      },
      {
        event_id: "evt-historical",
        type: "FxTradeExecuted",
        // Intentional legacy literal — historical sample.
        as_of: PRE_BOUNDARY,
        entity: "BANK-ZA-001",
      },
      {
        event_id: "evt-rogue",
        type: "FxTradeExecuted",
        as_of: POST_BOUNDARY,
        entity: "LE-ZA-UNKNOWN",
      },
      {
        event_id: "evt-ok-2",
        type: "AccountingPeriodOpened",
        as_of: POST_BOUNDARY,
        entity: "LE-ZA-HOZ-BANK",
      },
    ];
    const r = run({ events });
    expect(r.asserted).toBe(5);
    // One warn (historical) + two fails (drift + rogue).
    expect(r.violations).toHaveLength(3);
    expect(r.ok).toBe(false);
    const drift = r.violations.find((v) => v.subject.includes("evt-drift"));
    expect(drift?.severity).toBe("fail");
    const historical = r.violations.find((v) => v.subject.includes("evt-historical"));
    expect(historical?.severity).toBe("warn");
    const rogue = r.violations.find((v) => v.subject.includes("evt-rogue"));
    expect(rogue?.severity).toBe("fail");
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
