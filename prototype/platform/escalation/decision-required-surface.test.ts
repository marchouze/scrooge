// platform/escalation/decision-required-surface.test.ts
//
// Tests for the Decision-Required projection (CEO-escalation push channel).
// Spec: 2026-06-09_atlas_ceo-escalation-push-channel-spec.md.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type { Event } from "../event-store/types";
import {
  buildDecisionRequiredSurface,
  isDecisionRequired,
  renderDecisionRequiredDigest,
} from "./decision-required-surface";

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

/** Minimal store shim over an event array (matches the replay interface used). */
function storeOf(events: readonly Event[]) {
  return {
    replay: (filter?: { type?: string }) =>
      filter?.type ? events.filter((e) => e.type === filter.type) : events,
    // biome-ignore lint/suspicious/noExplicitAny: test shim.
  } as any;
}

const runFailed = (runId: string, agent: string, as_of = "2026-06-09T10:00:00.000Z") =>
  ev({
    type: "SubstrateAgentRunFailed",
    as_of,
    payload: {
      runId,
      agent,
      failedAt: as_of,
      durationMs: 1,
      errorClass: "exception",
      errorMessage: "boom",
      sequenceAtFailure: 1,
    },
  });

const alert = (alertId: string, severity: string) =>
  ev({
    type: "SubstrateAlert",
    payload: { alertId, alertClass: "integrity", details: "store mismatch", severity },
  });

const reconResult = (pipeline: string, ok: boolean, as_of = "2026-06-09T11:00:00.000Z") =>
  ev({ type: "ReconResult", as_of, payload: { pipeline, ok, failViolations: ok ? 0 : 2 } });

const escalation = (escalationId: string, severity: string) =>
  ev({
    type: "AgentEscalation",
    payload: {
      escalationId,
      raisedBy: "agent:rohan:markets",
      question: "Approve limit breach?",
      options: ["approve", "reject"],
      blockedBy: "x",
      severity,
      routedTo: "human:marc@tgv.co.za",
    },
  });

describe("isDecisionRequired predicate", () => {
  it("promotes SubstrateAgentRunFailed as high", () => {
    const item = isDecisionRequired(runFailed("run:tomas:2026-06-09T10-00-00Z:abc", "tomas"));
    expect(item?.source).toBe("run-failed");
    expect(item?.severity).toBe("high");
  });

  it("promotes high SubstrateAlert but not medium", () => {
    expect(isDecisionRequired(alert("alert:integrity:x", "high"))?.source).toBe("alert");
    expect(isDecisionRequired(alert("alert:integrity:y", "medium"))).toBeNull();
  });

  it("promotes failing ReconResult only", () => {
    expect(isDecisionRequired(reconResult("rwa-computed-sourcing", false))?.source).toBe("recon");
    expect(isDecisionRequired(reconResult("rwa-computed-sourcing", true))).toBeNull();
  });

  it("promotes high/blocking AgentEscalation; blocking maps to critical", () => {
    expect(isDecisionRequired(escalation("esc:1", "high"))?.severity).toBe("high");
    expect(isDecisionRequired(escalation("esc:2", "blocking"))?.severity).toBe("critical");
    expect(isDecisionRequired(escalation("esc:3", "low"))).toBeNull();
  });
});

describe("buildDecisionRequiredSurface", () => {
  it("surfaces all four trigger sources, sorted critical-first", () => {
    const events = [
      runFailed("run:tomas:2026-06-09T10-00-00Z:abc", "tomas"),
      alert("alert:integrity:store", "high"),
      reconResult("rwa-computed-sourcing", false),
      escalation("esc:1", "blocking"),
    ];
    const s = buildDecisionRequiredSurface(storeOf(events), NOW);
    expect(s.openCount).toBe(4);
    expect(s.bySeverity.critical).toBe(1);
    expect(s.items[0]?.severity).toBe("critical"); // the blocking escalation
  });

  it("drops a recon item once a later passing ReconResult clears the pipeline", () => {
    const events = [
      reconResult("rwa-computed-sourcing", false, "2026-06-09T10:00:00.000Z"),
      reconResult("rwa-computed-sourcing", true, "2026-06-09T11:00:00.000Z"),
    ];
    const s = buildDecisionRequiredSurface(storeOf(events), NOW);
    expect(s.openCount).toBe(0);
  });

  it("drops an escalation once an AgentEscalationDecided lands", () => {
    const events = [
      escalation("esc:1", "high"),
      ev({
        type: "AgentEscalationDecided",
        payload: {
          escalationId: "esc:1",
          decidedBy: "marc",
          chosenOption: "approve",
          rationale: "ok",
        },
      }),
    ];
    const s = buildDecisionRequiredSurface(storeOf(events), NOW);
    expect(s.openCount).toBe(0);
  });

  it("marks an item acknowledged when an Acknowledged event keys to its itemId", () => {
    const itemId = "decision-required:run-failed:run:tomas:2026-06-09T10-00-00Z:abc";
    const events = [
      runFailed("run:tomas:2026-06-09T10-00-00Z:abc", "tomas"),
      ev({
        type: "AgentEscalationAcknowledged",
        payload: {
          escalationId: itemId,
          acknowledgedBy: "marc",
          acknowledgedAt: NOW.toISOString(),
        },
      }),
    ];
    const s = buildDecisionRequiredSurface(storeOf(events), NOW);
    expect(s.items[0]?.status).toBe("acknowledged");
    expect(s.items[0]?.ackBy).toBe("marc");
  });
});

describe("renderDecisionRequiredDigest", () => {
  it("renders the empty-clear marker", () => {
    const s = buildDecisionRequiredSurface(storeOf([]), NOW);
    expect(renderDecisionRequiredDigest(s)).toContain("0 open");
  });

  it("renders a header count and one line per open item", () => {
    const events = [runFailed("run:tomas:2026-06-09T10-00-00Z:abc", "tomas")];
    const out = renderDecisionRequiredDigest(buildDecisionRequiredSurface(storeOf(events), NOW));
    expect(out).toContain("Decision-required (1 open");
    expect(out).toContain("tomas");
  });
});
