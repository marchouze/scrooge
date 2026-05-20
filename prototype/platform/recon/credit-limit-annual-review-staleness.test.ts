// platform/recon/credit-limit-annual-review-staleness.test.ts
//
// Tests for the credit-limit-annual-review-staleness recon pipeline.
// Author: Vera (Internal audit engineer)

import { describe, expect, it } from "bun:test";

import { run } from "./credit-limit-annual-review-staleness";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

function loaded(args: { id: string; cpid: string; asOf: string }): E {
  return {
    event_id: args.id,
    type: "CreditLimitLoaded",
    as_of: args.asOf,
    payload: { counterpartyId: args.cpid },
  };
}

function review(args: { id: string; cpid: string; reviewedAt: string }): E {
  return {
    event_id: args.id,
    type: "CreditLimitAnnualReviewCompleted",
    as_of: args.reviewedAt,
    payload: { counterpartyId: args.cpid, reviewedAt: args.reviewedAt },
  };
}

function withdrawn(args: { id: string; cpid: string; asOf: string }): E {
  return {
    event_id: args.id,
    type: "CreditLimitWithdrawn",
    as_of: args.asOf,
    payload: { counterpartyId: args.cpid },
  };
}

describe("recon:credit-limit-annual-review-staleness", () => {
  it("passes on a fresh bench (no loads)", () => {
    const r = run({ loadedEvents: [], reviewEvents: [], withdrawnEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when all active limits have a review within 13 months", () => {
    const r = run({
      loadedEvents: [loaded({ id: "l1", cpid: "CP-1", asOf: "2024-01-01T00:00:00Z" })],
      reviewEvents: [review({ id: "r1", cpid: "CP-1", reviewedAt: "2026-04-01T00:00:00Z" })],
      withdrawnEvents: [],
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("skips review check when limit was loaded less than 13 months ago", () => {
    const r = run({
      loadedEvents: [loaded({ id: "l1", cpid: "CP-NEW", asOf: "2025-12-01T00:00:00Z" })],
      reviewEvents: [], // no review
      withdrawnEvents: [],
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("flags HIGH when last review is 13–15 months old", () => {
    const r = run({
      loadedEvents: [loaded({ id: "l1", cpid: "CP-1", asOf: "2024-01-01T00:00:00Z" })],
      reviewEvents: [review({ id: "r1", cpid: "CP-1", reviewedAt: "2025-04-01T00:00:00Z" })],
      withdrawnEvents: [],
      now: new Date("2026-05-20T00:00:00Z"), // ~13 months since last review
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("HIGH");
  });

  it("flags CRITICAL when last review is > 15 months old", () => {
    const r = run({
      loadedEvents: [loaded({ id: "l1", cpid: "CP-1", asOf: "2024-01-01T00:00:00Z" })],
      reviewEvents: [review({ id: "r1", cpid: "CP-1", reviewedAt: "2025-01-01T00:00:00Z" })],
      withdrawnEvents: [],
      now: new Date("2026-05-20T00:00:00Z"), // ~16 months since last review
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("CRITICAL");
  });

  it("flags CRITICAL when active limit has NO review and load is > 15 months old", () => {
    const r = run({
      loadedEvents: [loaded({ id: "l1", cpid: "CP-1", asOf: "2024-01-01T00:00:00Z" })],
      reviewEvents: [],
      withdrawnEvents: [],
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("CRITICAL");
    expect(fails[0]?.message).toContain("NO CreditLimitAnnualReviewCompleted");
  });

  it("does NOT flag withdrawn limits regardless of staleness", () => {
    const r = run({
      loadedEvents: [loaded({ id: "l1", cpid: "CP-OFF", asOf: "2023-01-01T00:00:00Z" })],
      reviewEvents: [],
      withdrawnEvents: [withdrawn({ id: "w1", cpid: "CP-OFF", asOf: "2024-01-01T00:00:00Z" })],
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });
});
