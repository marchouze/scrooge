// platform/recon/odp-portfolio-recon-dispute-staleness.test.ts
//
// Tests for the odp-portfolio-recon-dispute-staleness recon pipeline.
//
// Covers:
//   - Clean pass: no breaks
//   - Minor breaks: ignored (below materiality threshold)
//   - Material break resolved within deadline: pass
//   - Material break with open dispute within deadline: pass
//   - Material break with open dispute past deadline: fail
//   - Material break with no dispute, within deadline: pass
//   - Material break with no dispute, past deadline: fail
//   - Critical break escalated to CRO: treated as resolved
//   - Dispute approaching deadline: warn
//   - Break missing breakId: warn (informational)
//   - Orphaned open dispute past deadline: fail
//
// Authority:
//   ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9(d);
//   ISDA EMIR Portfolio Reconciliation, Dispute Resolution and Disclosure (2013).
//
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import { run } from "./odp-portfolio-recon-dispute-staleness";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

const NOW = new Date("2026-05-30T12:00:00Z");

// Timestamps relative to NOW
const RECENT = "2026-05-30T10:00:00Z"; // 2h ago
const PAST_MATERIAL = "2026-05-24T10:00:00Z"; // 6 days ago — past 5-cal-day window for material-terms
const PAST_VALUATION = "2026-05-19T10:00:00Z"; // 11 days ago — past 9-cal-day window for valuation
const WITHIN_MATERIAL = "2026-05-26T10:00:00Z"; // 4 days ago — still within 5-cal-day window
const WITHIN_VALUATION = "2026-05-23T10:00:00Z"; // 7 days ago — still within 9-cal-day window

// Deadline strings (past or future relative to NOW)
const PAST_DEADLINE = "2026-05-28T10:00:00Z"; // 2 days ago
const FUTURE_DEADLINE = "2026-06-05T10:00:00Z"; // future
const APPROACHING_DEADLINE = "2026-05-30T20:00:00Z"; // 8h from NOW

function breakEvent(args: {
  id: string;
  breakId: string;
  cpid: string;
  asOf: string;
  severity: "minor" | "material" | "critical";
  dimension?: string;
  disputeKind?: "material-terms" | "valuation";
}): E {
  return {
    event_id: args.id,
    type: "OdpReconBreakRaised",
    as_of: args.asOf,
    payload: {
      breakId: args.breakId,
      counterpartyId: args.cpid,
      severity: args.severity,
      dimension: args.dimension ?? "mtm-vs-gl",
      ...(args.disputeKind ? { disputeKind: args.disputeKind } : {}),
      description: "test break",
      sourceRunEventId: "550e8400-e29b-41d4-a716-446655440000",
    },
  };
}

function disputeOpened(args: {
  id: string;
  breakId: string;
  cpid: string;
  asOf: string;
  deadline: string;
  disputeKind?: "material-terms" | "valuation";
}): E {
  return {
    event_id: args.id,
    type: "OdpReconDisputeOpened",
    as_of: args.asOf,
    payload: {
      breakId: args.breakId,
      counterpartyId: args.cpid,
      dimension: "mtm-vs-gl",
      disputeKind: args.disputeKind ?? "valuation",
      openedAt: args.asOf,
      resolutionDeadline: args.deadline,
      openedBy: "Devon (COO, operations)",
    },
  };
}

function disputeResolved(args: {
  id: string;
  breakId: string;
  cpid: string;
  asOf: string;
  outcome?: string;
}): E {
  return {
    event_id: args.id,
    type: "OdpReconDisputeResolved",
    as_of: args.asOf,
    payload: {
      breakId: args.breakId,
      counterpartyId: args.cpid,
      disputeEventId: "550e8400-e29b-41d4-a716-446655440099",
      outcome: args.outcome ?? "agreed-bank-figure",
      resolvedAt: args.asOf,
      withinDeadline: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recon:odp-portfolio-recon-dispute-staleness", () => {
  it("passes on a clean slate (no breaks, no disputes)", () => {
    const r = run({
      breakEvents: [],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.asserted).toBe(0);
  });

  it("ignores minor severity breaks (below materiality threshold)", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-MINOR-1",
          cpid: "CP-1",
          asOf: PAST_MATERIAL,
          severity: "minor",
        }),
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    // Minor breaks are not asserted
    expect(r.asserted).toBe(0);
  });

  it("passes when a material break has been resolved", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-1",
          cpid: "CP-1",
          asOf: PAST_MATERIAL,
          severity: "material",
          disputeKind: "material-terms",
        }),
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [
        disputeResolved({
          id: "r1",
          breakId: "BREAK-1",
          cpid: "CP-1",
          asOf: WITHIN_MATERIAL,
        }),
      ],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when escalated to CRO (treated as resolved)", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-CRO",
          cpid: "CP-1",
          asOf: PAST_VALUATION,
          severity: "critical",
          disputeKind: "valuation",
        }),
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [
        disputeResolved({
          id: "r1",
          breakId: "BREAK-CRO",
          cpid: "CP-1",
          asOf: WITHIN_VALUATION,
          outcome: "escalated-to-cro",
        }),
      ],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when open dispute is within its deadline", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-OPEN",
          cpid: "CP-1",
          asOf: RECENT,
          severity: "material",
          disputeKind: "valuation",
        }),
      ],
      disputeOpenedEvents: [
        disputeOpened({
          id: "d1",
          breakId: "BREAK-OPEN",
          cpid: "CP-1",
          asOf: RECENT,
          deadline: FUTURE_DEADLINE,
        }),
      ],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("fails when open dispute is past its recorded deadline", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-OVERDUE",
          cpid: "CP-1",
          asOf: "2026-05-20T10:00:00Z",
          severity: "material",
          disputeKind: "valuation",
        }),
      ],
      disputeOpenedEvents: [
        disputeOpened({
          id: "d1",
          breakId: "BREAK-OVERDUE",
          cpid: "CP-1",
          asOf: "2026-05-20T10:00:00Z",
          deadline: PAST_DEADLINE,
        }),
      ],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    const fail0 = fails.at(0);
    expect(fail0?.subject).toBe("break:BREAK-OVERDUE");
    expect(fail0?.message).toContain("PAST ITS RESOLUTION DEADLINE");
    expect(fail0?.message).toContain("ORG-ODP-COND-007");
  });

  it("fails when material break has no dispute opened and is past implied deadline", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-NODISPUTE",
          cpid: "CP-2",
          asOf: PAST_MATERIAL,
          severity: "material",
          disputeKind: "material-terms",
          dimension: "exposure-vs-csa",
        }),
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    const fail0 = fails.at(0);
    expect(fail0?.subject).toBe("break:BREAK-NODISPUTE");
    expect(fail0?.message).toContain("NO dispute opened");
    expect(fail0?.message).toContain("CRO");
  });

  it("passes (no fail) when material break has no dispute but is within deadline", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-WITHIN",
          cpid: "CP-3",
          asOf: WITHIN_MATERIAL,
          severity: "material",
          disputeKind: "material-terms",
        }),
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("warns when open dispute is within 24h of deadline", () => {
    const r = run({
      breakEvents: [
        breakEvent({
          id: "e1",
          breakId: "BREAK-APPROACHING",
          cpid: "CP-4",
          asOf: "2026-05-25T12:00:00Z",
          severity: "material",
          disputeKind: "valuation",
        }),
      ],
      disputeOpenedEvents: [
        disputeOpened({
          id: "d1",
          breakId: "BREAK-APPROACHING",
          cpid: "CP-4",
          asOf: "2026-05-25T12:00:00Z",
          deadline: APPROACHING_DEADLINE,
        }),
      ],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(true); // warn doesn't fail
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBeGreaterThanOrEqual(1);
    expect(warns.at(0)?.message).toContain("approaching its resolution deadline");
  });

  it("warns when a break has no breakId", () => {
    const r = run({
      breakEvents: [
        {
          event_id: "e1",
          type: "OdpReconBreakRaised",
          as_of: RECENT,
          payload: {
            // breakId intentionally omitted
            counterpartyId: "CP-1",
            severity: "material",
            dimension: "mtm-vs-gl",
            description: "missing breakId",
            sourceRunEventId: "550e8400-e29b-41d4-a716-446655440000",
          },
        },
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(true);
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns).toHaveLength(1);
    expect(warns.at(0)?.message).toContain("no breakId");
  });

  it("fails when an orphaned open dispute is past its deadline", () => {
    // Dispute with no corresponding break in stream
    const r = run({
      breakEvents: [], // no breaks
      disputeOpenedEvents: [
        disputeOpened({
          id: "d1",
          breakId: "BREAK-ORPHAN",
          cpid: "CP-5",
          asOf: "2026-05-20T10:00:00Z",
          deadline: PAST_DEADLINE,
        }),
      ],
      disputeResolvedEvents: [],
      now: NOW,
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    const fail0 = fails.at(0);
    expect(fail0?.subject).toBe("dispute:BREAK-ORPHAN");
    expect(fail0?.message).toContain("PAST its recorded resolution deadline");
  });

  it("handles multiple breaks — mixed outcomes", () => {
    const r = run({
      breakEvents: [
        // Break 1: material, past deadline, no dispute opened → FAIL
        breakEvent({
          id: "e1",
          breakId: "BREAK-A",
          cpid: "CP-1",
          asOf: PAST_MATERIAL,
          severity: "material",
          disputeKind: "material-terms",
        }),
        // Break 2: critical, resolved → pass
        breakEvent({
          id: "e2",
          breakId: "BREAK-B",
          cpid: "CP-2",
          asOf: PAST_VALUATION,
          severity: "critical",
          disputeKind: "valuation",
        }),
        // Break 3: minor → ignored
        breakEvent({
          id: "e3",
          breakId: "BREAK-C",
          cpid: "CP-3",
          asOf: PAST_MATERIAL,
          severity: "minor",
        }),
      ],
      disputeOpenedEvents: [],
      disputeResolvedEvents: [
        // BREAK-B is resolved
        disputeResolved({
          id: "r2",
          breakId: "BREAK-B",
          cpid: "CP-2",
          asOf: WITHIN_VALUATION,
        }),
      ],
      now: NOW,
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails.at(0)?.subject).toBe("break:BREAK-A");
  });
});

// ---------------------------------------------------------------------------
// cadence selector tests (pure function — no I/O)
// ---------------------------------------------------------------------------

import {
  computeDisputeDeadline,
  selectOdpCadence,
} from "../event-store/event-types/odp-portfolio-recon";

describe("selectOdpCadence", () => {
  it("returns null for 0 trades", () => {
    expect(selectOdpCadence(0)).toBeNull();
  });
  it("returns quarterly for 1 trade", () => {
    expect(selectOdpCadence(1)).toBe("quarterly");
  });
  it("returns quarterly for 50 trades", () => {
    expect(selectOdpCadence(50)).toBe("quarterly");
  });
  it("returns weekly for 51 trades", () => {
    expect(selectOdpCadence(51)).toBe("weekly");
  });
  it("returns weekly for 499 trades", () => {
    expect(selectOdpCadence(499)).toBe("weekly");
  });
  it("returns daily for 500 trades", () => {
    expect(selectOdpCadence(500)).toBe("daily");
  });
  it("returns daily for 1000 trades", () => {
    expect(selectOdpCadence(1000)).toBe("daily");
  });
});

describe("computeDisputeDeadline", () => {
  it("returns 5 calendar days ahead for material-terms (approx 3 business days)", () => {
    const openedAt = "2026-05-25T10:00:00Z";
    const deadline = computeDisputeDeadline("material-terms", openedAt);
    const deadlineMs = Date.parse(deadline);
    const openedMs = Date.parse(openedAt);
    const calDays = (deadlineMs - openedMs) / 86_400_000;
    expect(calDays).toBe(5);
  });

  it("returns 9 calendar days ahead for valuation (approx 5 business days)", () => {
    const openedAt = "2026-05-25T10:00:00Z";
    const deadline = computeDisputeDeadline("valuation", openedAt);
    const deadlineMs = Date.parse(deadline);
    const openedMs = Date.parse(openedAt);
    const calDays = (deadlineMs - openedMs) / 86_400_000;
    expect(calDays).toBe(9);
  });
});
