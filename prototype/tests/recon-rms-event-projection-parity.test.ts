// tests/recon-rms-event-projection-parity.test.ts
//
// CI gate for the RMS event → projection parity recon (Phase 2 Block B,
// closes Atlas's PR #465 gap #2). Asserts that every replay of the seven
// RMS register projections from event_id zero produces the same row-set
// as `buildRmsRegistersFold` (the live cache surface).
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
//            D-RMS-PHASE-2-4-AUTHORSHIP (Owen + Atlas, 2026-05-16).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { run } from "../platform/recon/rms-event-projection-parity";

describe("rms-event-projection-parity recon (Phase 2 Block B)", () => {
  it("runs over the live corpus — zero failures, all 7 registers parity-clean", () => {
    const r = run();
    expect(r.pipeline).toBe("rms-event-projection-parity");
    // Always asserts exactly 7 registers — one per RMS Phase 1 spec §6.
    expect(r.asserted).toBe(7);
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.map((v) => ({ subject: v.subject, message: v.message }))).toEqual([]);
    expect(fails.length).toBe(0);
  });

  it("returns ok=true when every projection is deterministic + cache-parity", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(0);
  });
});
