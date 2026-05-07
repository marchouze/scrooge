// tests/dashboard.test.ts
//
// Unit tests for the dashboard registry mutation. Asserts:
//   - applyDecision is pure (does not mutate input).
//   - The decision moves from open → resolved with the right shape.
//   - Missing decisions are rejected.
//   - The metric counter increments.
//
// Author: Atlas

import { describe, expect, it } from "bun:test";

import { applyDecision, startWorkstream } from "../dashboard/registry";
import type { DashboardState, InFlightItem, OpenDecision } from "../dashboard/types";

const sampleOpen: OpenDecision = {
  id: "TEST-1",
  title: "Approve test decision",
  category: "near-term",
  owner: "Test",
  trigger: "Test trigger",
  decisionForCEO: "Approve test",
  sourceDocs: ["test.md"],
};

function mk(opens: OpenDecision[] = [sampleOpen], inFlight: InFlightItem[] = []): DashboardState {
  return {
    asOf: "2026-05-06T00:00:00.000Z",
    bank: {
      name: "Test Bank",
      operatingPosture: "Build-only",
      strategicFoundation: {
        type: "Test",
        products: [],
        clients: [],
        geography: "ZA",
        capital: "R0",
        licence: "Deferred",
      },
      metrics: {
        principles: 6,
        policies: 0,
        obligations: 0,
        instruments: 0,
        instrumentsAnalysed: 0,
        proceduresPopulated: 0,
        proceduresPlanned: 0,
        ceoDecisionsActioned: 5,
        directReports: 0,
        openGovernanceSeats: 0,
      },
      cloudTarget: "Azure",
    },
    directReports: [],
    openSeats: [],
    principles: [],
    decisionsOpen: opens,
    decisionsResolved: [],
    inFlight,
    agents: [],
    ownerInboxFeed: [],
    prototype: { ciStatus: "green", tests: 0, modules: [], next: [] },
    risks: [],
  };
}

describe("dashboard.applyDecision", () => {
  it("moves a decision from open to resolved", () => {
    const state = mk();
    const { next, resolved } = applyDecision(
      state,
      "TEST-1",
      "approve",
      "Approved as drafted",
      "marc@tgv.co.za",
      undefined,
      () => "2026-05-06T12:00:00.000Z",
    );
    expect(next.decisionsOpen).toHaveLength(0);
    expect(next.decisionsResolved).toHaveLength(1);
    expect(resolved.id).toBe("TEST-1");
    expect(resolved.action).toBe("approve");
    expect(resolved.actionedBy).toBe("marc@tgv.co.za");
    expect(resolved.outcome).toBe("Approved as drafted");
  });

  it("does not mutate the input state", () => {
    const state = mk();
    const before = JSON.stringify(state);
    applyDecision(state, "TEST-1", "approve", "ok", "m", undefined, () => "x");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects an unknown decision id", () => {
    const state = mk();
    expect(() => applyDecision(state, "NOPE", "approve", "ok", "m", undefined, () => "x")).toThrow(
      /not found/,
    );
  });

  it("increments the actioned counter", () => {
    const state = mk();
    const { next } = applyDecision(state, "TEST-1", "approve", "ok", "m", undefined, () => "x");
    expect(next.bank.metrics.ceoDecisionsActioned).toBe(6);
  });

  it("captures a comment when provided", () => {
    const state = mk();
    const { resolved } = applyDecision(
      state,
      "TEST-1",
      "modify",
      "Approved with mods",
      "marc@tgv.co.za",
      "Reduce scope to phase 1",
      () => "2026-05-06T12:00:00.000Z",
    );
    expect(resolved.comment).toBe("Reduce scope to phase 1");
  });

  it("omits comment when not provided (exactOptionalPropertyTypes)", () => {
    const state = mk();
    const { resolved } = applyDecision(state, "TEST-1", "approve", "ok", "m", undefined, () => "x");
    expect("comment" in resolved).toBe(false);
  });
});

const idleItem: InFlightItem = {
  id: "WS-TEST",
  what: "Test workstream",
  owner: "Test owner",
  due: "~1 week",
  active: false,
};

const activeItem: InFlightItem = {
  id: "WS-LIVE",
  what: "Live workstream",
  owner: "Test owner",
  due: "~1 week",
  active: true,
  startedAt: "2026-05-01",
};

describe("dashboard.startWorkstream", () => {
  it("flips an idle item to active and records startedAt", () => {
    const state = mk([], [idleItem]);
    const { next, item } = startWorkstream(state, "WS-TEST", () => "2026-05-06T12:00:00.000Z");
    expect(item.active).toBe(true);
    expect(item.startedAt).toBe("2026-05-06");
    expect(next.inFlight[0]?.active).toBe(true);
    expect(next.asOf).toBe("2026-05-06T12:00:00.000Z");
  });

  it("does not mutate the input state", () => {
    const state = mk([], [idleItem]);
    const before = JSON.stringify(state);
    startWorkstream(state, "WS-TEST", () => "2026-05-06T12:00:00.000Z");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects an unknown id", () => {
    const state = mk([], [idleItem]);
    expect(() => startWorkstream(state, "WS-NOPE", () => "x")).toThrow(/not found/);
  });

  it("rejects an already-active item", () => {
    const state = mk([], [activeItem]);
    expect(() => startWorkstream(state, "WS-LIVE", () => "x")).toThrow(/already active/);
  });
});
