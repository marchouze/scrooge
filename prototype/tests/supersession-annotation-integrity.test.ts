// tests/supersession-annotation-integrity.test.ts
//
// Unit tests for the Vera Wave-5 supersession-annotation-integrity
// recon pipeline.
//
// Asserted invariants:
//   (1) A decision with a single CeoDecision event requires no annotation
//       and passes cleanly.
//   (2) A decision with two CeoDecision events where the earlier one
//       carries `supersededBy` pointing to the later decisionId passes.
//   (3) A decision with two CeoDecision events where the earlier one
//       LACKS `supersededBy` generates a "fail" violation.
//   (4) A decision whose `supersededBy` field points to an unknown
//       decisionId generates a "warn" dangling-reference violation.
//   (5) An empty event set emits an `info`-severity "store-empty" message
//       and returns ok: true.
//   (6) A mix of clean and dirty decisions surfaces only the dirty ones.
//
// Author: Vera (Internal audit engineer, third-line)

import { describe, expect, it } from "bun:test";

import {
  type CeoDecisionEntry,
  assertAnnotations,
  run,
} from "../platform/recon/supersession-annotation-integrity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entry(
  decisionId: string,
  asOf: string,
  eventId = `evt-${decisionId}-${asOf}`,
  supersededBy?: string,
): CeoDecisionEntry {
  if (supersededBy !== undefined) {
    return { eventId, decisionId, asOf, supersededBy };
  }
  return { eventId, decisionId, asOf };
}

// ---------------------------------------------------------------------------
// assertAnnotations unit tests (pure logic, no I/O)
// ---------------------------------------------------------------------------

describe("assertAnnotations", () => {
  it("(1) single event for a decisionId — no annotation required, no violations", () => {
    const violations = assertAnnotations([entry("D-ALPHA", "2026-05-01T10:00:00.000Z")]);
    expect(violations).toHaveLength(0);
  });

  it("(2) earlier event has supersededBy — passes cleanly", () => {
    const violations = assertAnnotations([
      entry("D-BETA", "2026-05-01T10:00:00.000Z", "evt-beta-v1", "D-BETA"),
      entry("D-BETA", "2026-05-09T12:00:00.000Z", "evt-beta-v2"),
    ]);
    expect(violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("(3) earlier event lacks supersededBy — fail violation", () => {
    const violations = assertAnnotations([
      entry("D-GAMMA", "2026-05-01T10:00:00.000Z", "evt-gamma-v1"),
      entry("D-GAMMA", "2026-05-09T12:00:00.000Z", "evt-gamma-v2"),
    ]);
    const fails = violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.subject).toBe("decision:D-GAMMA@2026-05-01T10:00:00.000Z");
    expect(fails[0]?.message).toContain("supersededBy");
    expect(fails[0]?.message).toContain("evt-gamma-v1");
  });

  it("(4) supersededBy points to unknown decisionId — warn dangling reference", () => {
    const violations = assertAnnotations([
      entry("D-DELTA", "2026-05-01T10:00:00.000Z", "evt-delta-v1", "D-NONEXISTENT"),
      entry("D-DELTA", "2026-05-09T12:00:00.000Z", "evt-delta-v2"),
    ]);
    const warns = violations.filter((v) => v.severity === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.subject).toBe("decision:D-DELTA@2026-05-01T10:00:00.000Z");
    expect(warns[0]?.message).toContain("D-NONEXISTENT");
    expect(warns[0]?.message).toContain("dangling reference");
  });

  it("three events for same decisionId — first two both need annotation", () => {
    const violations = assertAnnotations([
      entry("D-TRIPLE", "2026-05-01T10:00:00.000Z", "evt-triple-v1"),
      entry("D-TRIPLE", "2026-05-05T10:00:00.000Z", "evt-triple-v2"),
      entry("D-TRIPLE", "2026-05-09T10:00:00.000Z", "evt-triple-v3"),
    ]);
    const fails = violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(2);
    const subjects = fails.map((f) => f.subject);
    expect(subjects).toContain("decision:D-TRIPLE@2026-05-01T10:00:00.000Z");
    expect(subjects).toContain("decision:D-TRIPLE@2026-05-05T10:00:00.000Z");
    // The latest (v3) must NOT appear.
    expect(subjects).not.toContain("decision:D-TRIPLE@2026-05-09T10:00:00.000Z");
  });

  it("(6) mix — one clean decision does not affect dirty decision findings", () => {
    const violations = assertAnnotations([
      // Clean: single event
      entry("D-CLEAN", "2026-05-01T10:00:00.000Z"),
      // Dirty: two events, older lacks annotation
      entry("D-DIRTY", "2026-05-01T10:00:00.000Z", "evt-dirty-v1"),
      entry("D-DIRTY", "2026-05-09T10:00:00.000Z", "evt-dirty-v2"),
    ]);
    const fails = violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.subject).toBe("decision:D-DIRTY@2026-05-01T10:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// run() integration tests (via injected events)
// ---------------------------------------------------------------------------

describe("run()", () => {
  it("(5) empty event list returns ok: true with info-severity store-empty message", () => {
    const r = run({ events: [], forceEmptyStore: true });
    expect(r.pipeline).toBe("supersession-annotation-integrity");
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("info");
    expect(r.violations[0]?.subject).toBe("supersession-annotation-integrity:store-empty");
  });

  it("single decision with proper supersededBy annotation passes", () => {
    const r = run({
      events: [
        entry("D-RMS-PHASE-1", "2026-05-07T10:00:00.000Z", "evt-rms-v1", "D-RMS-PHASE-1"),
        entry("D-RMS-PHASE-1", "2026-05-09T10:00:00.000Z", "evt-rms-v2"),
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("decision that supersedes another but earlier event has no annotation fails", () => {
    const r = run({
      events: [
        // Earlier event — no supersededBy set.
        entry("D-SUPERSEDE-TEST", "2026-05-01T00:00:00.000Z", "evt-supersede-v1"),
        // Later event — the superseding one.
        entry("D-SUPERSEDE-TEST", "2026-05-09T00:00:00.000Z", "evt-supersede-v2"),
      ],
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.subject).toBe("decision:D-SUPERSEDE-TEST@2026-05-01T00:00:00.000Z");
  });

  it("dangling supersededBy reference emits warn but ok stays true (no fails)", () => {
    const r = run({
      events: [
        entry("D-DANGLING", "2026-05-01T00:00:00.000Z", "evt-dangling-v1", "D-GHOST"),
        entry("D-DANGLING", "2026-05-09T00:00:00.000Z", "evt-dangling-v2"),
      ],
    });
    // The dangling reference is a warn — ok is false only when severity === "fail".
    // The earlier event also correctly has a supersededBy (even though it's wrong
    // value), so there's no "fail" for missing annotation, only "warn" for dangling.
    const fails = r.violations.filter((v) => v.severity === "fail");
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(fails).toHaveLength(0);
    expect(warns).toHaveLength(1);
    expect(r.ok).toBe(true);
  });

  it("asserted count equals the number of injected events", () => {
    const r = run({
      events: [
        entry("D-COUNT-A", "2026-05-01T00:00:00.000Z"),
        entry("D-COUNT-B", "2026-05-01T00:00:00.000Z"),
        entry("D-COUNT-B", "2026-05-09T00:00:00.000Z"),
      ],
    });
    expect(r.asserted).toBe(3);
  });
});
