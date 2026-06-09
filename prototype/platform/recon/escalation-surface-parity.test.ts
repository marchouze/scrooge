// platform/recon/escalation-surface-parity.test.ts
//
// Tests for recon:escalation-surface-parity — asserts the Decision-Required
// surface stays a faithful projection of the event store.
// Spec: 2026-06-09_atlas_ceo-escalation-push-channel-spec.md §4.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type { Event } from "../event-store/types";
import { run } from "./escalation-surface-parity";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function ev(partial: Partial<Event> & { type: string; payload: Record<string, unknown> }): Event {
  return {
    event_id: partial.event_id ?? crypto.randomUUID(),
    type: partial.type,
    as_of: partial.as_of ?? "2026-06-09T10:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: ["TEST-CITE"],
    payload: partial.payload,
  };
}

const runFailed = (runId: string, agent: string) =>
  ev({
    type: "SubstrateAgentRunFailed",
    payload: {
      runId,
      agent,
      failedAt: "2026-06-09T10:00:00.000Z",
      durationMs: 1,
      errorClass: "exception",
      errorMessage: "boom",
      sequenceAtFailure: 1,
    },
  });

describe("recon:escalation-surface-parity", () => {
  it("passes (coverage + freshness) when an open qualifying event is surfaced", () => {
    const events = [runFailed("run:tomas:2026-06-09T10-00-00Z:abc", "tomas")];
    const r = run({ events, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(false);
  });

  it("passes vacuously on an empty store", () => {
    const r = run({ events: [], now: NOW });
    expect(r.ok).toBe(true);
  });

  it("warns on a failing ReconResult pipeline with no owner mapping", () => {
    const events = [
      ev({
        type: "ReconResult",
        as_of: "2026-06-09T11:00:00.000Z",
        payload: { pipeline: "some-brand-new-unmapped-pipeline", ok: false, failViolations: 1 },
      }),
    ];
    const r = run({ events, now: NOW });
    expect(r.ok).toBe(true); // warn, not fail
    expect(r.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("does not warn for a mapped failing pipeline", () => {
    const events = [
      ev({
        type: "ReconResult",
        as_of: "2026-06-09T11:00:00.000Z",
        payload: { pipeline: "rwa-computed-sourcing", ok: false, failViolations: 1 },
      }),
    ];
    const r = run({ events, now: NOW });
    expect(r.violations.some((v) => v.severity === "warn")).toBe(false);
  });
});
