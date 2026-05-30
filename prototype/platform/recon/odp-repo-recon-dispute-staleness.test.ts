// platform/recon/odp-repo-recon-dispute-staleness.test.ts
//
// Tests for the ODP repo-recon dispute staleness recon pipeline.
//
// Authority: ORG-ODP-RPT-003; urn:regulation:odp:cs-3-2018 §6.
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import { runOdpRepoReconDisputeStaleness } from "./odp-repo-recon-dispute-staleness";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-05-30T12:00:00.000Z");
const BREAK_ID = "REPO-BREAK-20260530-TRADE-FX-001-001";
const TRADE_ID = "TRADE-FX-001";
const BREAK_TIMESTAMP = "2026-05-30T09:00:00.000Z";
// Deadline = 4 calendar days from BREAK_TIMESTAMP = 2026-06-03T09:00:00.000Z

function makeBreakEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "11111111-1111-1111-1111-111111111111",
    type: "OdpRepoReconBreakRaised",
    as_of: BREAK_TIMESTAMP,
    payload: {
      breakId: BREAK_ID,
      tradeId: TRADE_ID,
      sourceRunEventId: "00000000-0000-0000-0000-000000000001",
      breakType: "missing-in-repo",
      description: "Test break",
      resolutionDeadline: "2026-06-03T09:00:00.000Z",
      ...overrides,
    },
  };
}

function makeDisputeOpenedEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "22222222-2222-2222-2222-222222222222",
    type: "OdpRepoReconDisputeOpened",
    as_of: "2026-05-30T10:00:00.000Z",
    payload: {
      breakId: BREAK_ID,
      breakEventId: "11111111-1111-1111-1111-111111111111",
      tradeId: TRADE_ID,
      openedAt: "2026-05-30T10:00:00.000Z",
      resolutionDeadline: "2026-06-03T10:00:00.000Z",
      openedBy: "Devon (COO, operations)",
      ...overrides,
    },
  };
}

function makeDisputeResolvedEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "33333333-3333-3333-3333-333333333333",
    type: "OdpRepoReconDisputeResolved",
    as_of: "2026-05-31T09:00:00.000Z",
    payload: {
      breakId: BREAK_ID,
      disputeEventId: "22222222-2222-2222-2222-222222222222",
      tradeId: TRADE_ID,
      outcome: "resubmitted-accepted",
      resolvedAt: "2026-05-31T09:00:00.000Z",
      withinDeadline: true,
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests — empty state
// ---------------------------------------------------------------------------

describe("runOdpRepoReconDisputeStaleness", () => {
  it("passes when no breaks exist", () => {
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Tests — resolved breaks
  // ---------------------------------------------------------------------------

  it("passes when break is resolved within deadline", () => {
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [makeDisputeOpenedEvent()],
      disputeResolvedEvents: [makeDisputeResolvedEvent({ withinDeadline: true })],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("warns when break is resolved but outside deadline", () => {
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [makeDisputeResolvedEvent({ withinDeadline: false })],
      now: NOW,
    });
    expect(result.ok).toBe(true); // warn doesn't fail
    expect(result.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("passes when break is escalated-to-cco", () => {
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [makeDisputeResolvedEvent({ outcome: "escalated-to-cco" })],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Tests — open disputes
  // ---------------------------------------------------------------------------

  it("passes when dispute is open and within deadline", () => {
    // Deadline 2026-06-03; now 2026-05-30 — well within
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [makeDisputeOpenedEvent()],
      disputeResolvedEvents: [],
      now: NOW, // 2026-05-30
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("warns when dispute is approaching deadline (within 24h)", () => {
    // Deadline 2026-06-03T10:00; now 2026-06-02T15:00 — 19h before
    const approaching = new Date("2026-06-02T15:00:00.000Z");
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [makeDisputeOpenedEvent()],
      disputeResolvedEvents: [],
      now: approaching,
    });
    expect(result.ok).toBe(true); // warn doesn't fail
    expect(result.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("fails when dispute is past deadline", () => {
    // Deadline 2026-06-03T10:00; now 2026-06-04T12:00 — past deadline
    const past = new Date("2026-06-04T12:00:00.000Z");
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [makeDisputeOpenedEvent()],
      disputeResolvedEvents: [],
      now: past,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Tests — no dispute opened
  // ---------------------------------------------------------------------------

  it("passes when break has no dispute and is within deadline window", () => {
    // Break at 2026-05-30T09:00, deadline 2026-06-03; now 2026-05-30T12:00
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    // No fail violations within deadline
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("fails when break has no dispute and deadline has passed", () => {
    // Break at 2026-05-30T09:00, deadline 2026-06-03; now 2026-06-05
    const past = new Date("2026-06-05T12:00:00.000Z");
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [makeBreakEvent()],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: past,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(result.violations[0]?.message).toMatch(/investigation deadline has passed/);
  });

  // ---------------------------------------------------------------------------
  // Tests — multiple breaks
  // ---------------------------------------------------------------------------

  it("handles multiple breaks independently", () => {
    const break1 = makeBreakEvent({ breakId: "BREAK-001" });
    const break2 = makeBreakEvent({ breakId: "BREAK-002" });

    // Break-001 is resolved; break-002 has no dispute and is past deadline
    const past = new Date("2026-06-05T12:00:00.000Z");
    const result = runOdpRepoReconDisputeStaleness({
      breakEvents: [break1, break2],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [
        makeDisputeResolvedEvent({ breakId: "BREAK-001", withinDeadline: true }),
      ],
      now: past,
    });
    // BREAK-001 is resolved (no violation); BREAK-002 has no dispute + past deadline → fail
    expect(result.ok).toBe(false);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(1);
    expect(result.violations[0]?.subject).toContain("BREAK-002");
  });
});
