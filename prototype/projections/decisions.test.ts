// projections/decisions.test.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice A — projection unit tests.

import { describe, expect, it } from "bun:test";

import { type DecisionPayload, makeDecision } from "../platform/event-store/event-types/decision";
import type { Event } from "../platform/event-store/types";
import { type DecisionsEventSource, buildDecisionsRegister } from "./decisions";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "human" as const, id: "marc@tgv.co.za" };
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

function decisionPayload(overrides: Partial<DecisionPayload>): DecisionPayload {
  return {
    decisionId: "D-TEST-CASE",
    phase: "requested",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Test case",
    category: "governance",
    recommendation: "Approve",
    rationale: "Because.",
    sourceDocHashes: [],
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    recordedVia: "authoring-ui",
    ...overrides,
  };
}

function decisionEvent(asOf: string, payload: DecisionPayload): Event {
  return makeDecision({ asOf, entity: ENTITY, actor: ACTOR, citations: CITATIONS, payload });
}

function ceoEvent(
  asOf: string,
  decisionId: string,
  phase: "approved" | "deferred" | "requested" | "rejected" | "superseded" | "withdrawn",
  title = decisionId,
): Event {
  return makeDecision({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: decisionPayload({ decisionId, phase, title }),
  });
}

function source(decisions: Event[], ceo: Event[]): DecisionsEventSource {
  return {
    decisionEvents: () => decisions,
    ceoDecisionEvents: () => ceo,
  };
}

describe("buildDecisionsRegister", () => {
  it("returns empty register for empty source", () => {
    const r = buildDecisionsRegister(source([], []));
    expect(r.open).toHaveLength(0);
    expect(r.resolved).toHaveLength(0);
    expect(r.byId.size).toBe(0);
  });

  it("opens a decision on `requested` phase", () => {
    const evt = decisionEvent("2026-05-16T00:00:00Z", decisionPayload({ decisionId: "D-OPEN" }));
    const r = buildDecisionsRegister(source([evt], []));
    expect(r.open).toHaveLength(1);
    expect(r.open[0]?.decisionId).toBe("D-OPEN");
    expect(r.resolved).toHaveLength(0);
  });

  it("resolves a decision on terminal phase", () => {
    const opened = decisionEvent(
      "2026-05-16T00:00:00Z",
      decisionPayload({ decisionId: "D-CLOSED", phase: "requested" }),
    );
    const approved = decisionEvent(
      "2026-05-16T01:00:00Z",
      decisionPayload({ decisionId: "D-CLOSED", phase: "approved" }),
    );
    const r = buildDecisionsRegister(source([opened, approved], []));
    expect(r.open).toHaveLength(0);
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0]?.phase).toBe("approved");
    expect(r.resolved[0]?.openedAt).toBe("2026-05-16T00:00:00Z");
    expect(r.resolved[0]?.resolvedAt).toBe("2026-05-16T01:00:00Z");
  });

  it("Decision approved phase resolves correctly", () => {
    const r = buildDecisionsRegister(
      source([ceoEvent("2026-05-15T00:00:00Z", "D-LEGACY", "approved")], []),
    );
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0]?.authority).toBe("CEO");
    expect(r.resolved[0]?.phase).toBe("approved");
  });

  it("Decision deferred phase resolves correctly", () => {
    const r = buildDecisionsRegister(
      source([ceoEvent("2026-05-15T00:00:00Z", "D-DEF", "deferred")], []),
    );
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0]?.phase).toBe("deferred");
  });

  it("Decision requested phase leaves decision open", () => {
    const r = buildDecisionsRegister(
      source([ceoEvent("2026-05-15T00:00:00Z", "D-REOP", "requested")], []),
    );
    expect(r.open).toHaveLength(1);
    expect(r.open[0]?.phase).toBe("requested");
  });

  it("folds a supersede chain", () => {
    const opened = decisionEvent(
      "2026-05-14T00:00:00Z",
      decisionPayload({ decisionId: "D-CHAIN", phase: "requested" }),
    );
    const superseded = decisionEvent(
      "2026-05-15T00:00:00Z",
      decisionPayload({
        decisionId: "D-CHAIN",
        phase: "superseded",
        supersedes: [],
      }),
    );
    const r = buildDecisionsRegister(source([opened, superseded], []));
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0]?.phase).toBe("superseded");
    expect(r.byId.get("D-CHAIN")?.events).toHaveLength(2);
  });

  it("returns history per decisionId in append order", () => {
    const a = decisionEvent(
      "2026-05-14T00:00:00Z",
      decisionPayload({ decisionId: "D-HIST", phase: "requested" }),
    );
    const b = decisionEvent(
      "2026-05-15T00:00:00Z",
      decisionPayload({ decisionId: "D-HIST", phase: "deferred" }),
    );
    const r = buildDecisionsRegister(source([a, b], []));
    const hist = r.byId.get("D-HIST");
    expect(hist?.events).toHaveLength(2);
    expect(hist?.events[0]?.phase).toBe("requested");
    expect(hist?.events[1]?.phase).toBe("deferred");
    expect(hist?.head.phase).toBe("deferred");
  });

  it("decides head from latest asOf when two Decision events share id", () => {
    const approved = ceoEvent("2026-05-15T00:00:00Z", "D-MIXED", "approved");
    const requested = decisionEvent(
      "2026-05-16T00:00:00Z",
      decisionPayload({ decisionId: "D-MIXED", phase: "requested" }),
    );
    const r = buildDecisionsRegister(source([approved, requested], []));
    // requested is later → head is open
    expect(r.open).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
  });

  it("filters by authority (Decision payload carries authority)", () => {
    const ceo = decisionEvent(
      "2026-05-16T00:00:00Z",
      decisionPayload({ decisionId: "D-CEO-A", authority: "CEO" }),
    );
    const cro = decisionEvent(
      "2026-05-16T00:01:00Z",
      decisionPayload({ decisionId: "D-CRO-A", authority: "CRO" }),
    );
    const r = buildDecisionsRegister(source([ceo, cro], []));
    expect(r.open.filter((d) => d.authority === "CEO")).toHaveLength(1);
    expect(r.open.filter((d) => d.authority === "CRO")).toHaveLength(1);
  });
});

describe("Decision payload schema", () => {
  it("rejects malformed decisionId", () => {
    expect(() =>
      makeDecision({
        asOf: "2026-05-16T00:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: decisionPayload({ decisionId: "not-a-decision-id" }) as DecisionPayload,
      }),
    ).toThrow();
  });

  it("rejects empty title", () => {
    expect(() =>
      makeDecision({
        asOf: "2026-05-16T00:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: decisionPayload({ title: "" }) as DecisionPayload,
      }),
    ).toThrow();
  });

  it("rejects unknown recordedVia", () => {
    expect(() =>
      makeDecision({
        asOf: "2026-05-16T00:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: decisionPayload({
          recordedVia: "something-not-allowed",
        }) as DecisionPayload,
      }),
    ).toThrow();
  });

  it("accepts backfill:<source> recordedVia", () => {
    expect(() =>
      makeDecision({
        asOf: "2026-05-16T00:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: decisionPayload({
          recordedVia: "backfill:decisions-framework-cutover",
        }) as DecisionPayload,
      }),
    ).not.toThrow();
  });

  it("rejects too-long decisionId (>60 chars)", () => {
    const longId = `D-${"X".repeat(70)}`;
    expect(() =>
      makeDecision({
        asOf: "2026-05-16T00:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: decisionPayload({ decisionId: longId }) as DecisionPayload,
      }),
    ).toThrow();
  });
});
