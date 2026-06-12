// platform/governance/decision-distillation/register.test.ts
//
// Core-knowledge-base register fold coverage: latest-wins resolution,
// Decision join (title/category/latest phase), class buckets,
// unclassifiedApproved residue, and a store-backed round trip
// (tests/_setup.ts redirects the singleton store to a tmp DB).
//
// Author: Owen (Company Secretary, governance).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../../composition";
import { makeDecision } from "../../event-store/event-types/decision";
import { makeDecisionDistilled } from "../../event-store/event-types/decision-distillation";
import type { DecisionDistillationClass } from "../../event-store/event-types/decision-distillation";
import { foldCoreKnowledgeBase, readCoreKnowledgeBase } from "./register";

const ENTITY = "LE-ZA-HOZ-BANK";

function decision(
  decisionId: string,
  phase: "requested" | "approved" | "superseded",
  asOf: string,
  title = `Title for ${decisionId}`,
) {
  return makeDecision({
    asOf,
    entity: ENTITY,
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: ["D-DECISIONS-FRAMEWORK-REDESIGN"],
    payload: {
      decisionId,
      phase,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title,
      category: "governance",
      recommendation: "Approve.",
      rationale: "Test fixture.",
      sourceDocHashes: [],
      citations: ["D-DECISIONS-FRAMEWORK-REDESIGN"],
      recordedVia: "scrooge:session-delegation",
    },
  });
}

function distilled(
  decisionId: string,
  klass: DecisionDistillationClass,
  asOf: string,
  rationale = `Rationale for ${decisionId}`,
) {
  return makeDecisionDistilled({
    asOf,
    entity: ENTITY,
    actor: { type: "service", id: "agent:owen:company-secretary" },
    citations: ["D-V2-BBAAS-W1-DECISION-DISTILLATION"],
    payload: {
      decisionId,
      class: klass,
      rationale,
      citations: [],
      distilledBy: "company-secretary",
      workstream: "WS-V2-BBAAS-W1",
    },
  });
}

describe("foldCoreKnowledgeBase", () => {
  it("buckets classifications and joins Decision title/category/phase", () => {
    const register = foldCoreKnowledgeBase(
      [
        decision("D-FOUND-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-DIR-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-OBS-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-OBS-1", "superseded", "2026-06-02T00:00:00.000Z"),
      ],
      [
        distilled("D-FOUND-1", "foundational", "2026-06-12T00:00:00.000Z"),
        distilled("D-DIR-1", "directional", "2026-06-12T00:00:00.000Z"),
        distilled("D-OBS-1", "obsolete", "2026-06-12T00:00:00.000Z"),
      ],
    );
    expect(register.counts).toEqual({
      foundational: 1,
      directional: 1,
      obsolete: 1,
      total: 3,
      unclassifiedApproved: 0,
    });
    expect(register.foundational[0]?.decisionId).toBe("D-FOUND-1");
    expect(register.foundational[0]?.title).toBe("Title for D-FOUND-1");
    expect(register.foundational[0]?.category).toBe("governance");
    expect(register.foundational[0]?.latestPhase).toBe("approved");
    expect(register.obsolete[0]?.latestPhase).toBe("superseded");
    expect(register.unclassifiedApproved).toEqual([]);
  });

  it("latest DecisionDistilled per decisionId wins (re-classification)", () => {
    const register = foldCoreKnowledgeBase(
      [decision("D-RECLASS-1", "approved", "2026-06-01T00:00:00.000Z")],
      [
        distilled("D-RECLASS-1", "directional", "2026-06-12T00:00:00.000Z", "first pass"),
        distilled("D-RECLASS-1", "foundational", "2026-06-13T00:00:00.000Z", "re-classified"),
      ],
    );
    expect(register.counts.total).toBe(1);
    expect(register.directional).toHaveLength(0);
    expect(register.foundational).toHaveLength(1);
    expect(register.foundational[0]?.rationale).toBe("re-classified");
  });

  it("surfaces approved decisions without a classification as unclassifiedApproved", () => {
    const register = foldCoreKnowledgeBase(
      [
        decision("D-CLASSIFIED-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-UNCLASSIFIED-1", "approved", "2026-06-01T00:00:00.000Z"),
        // requested-only never counts as unclassified-approved.
        decision("D-REQUESTED-ONLY", "requested", "2026-06-01T00:00:00.000Z"),
      ],
      [distilled("D-CLASSIFIED-1", "foundational", "2026-06-12T00:00:00.000Z")],
    );
    expect(register.unclassifiedApproved).toEqual(["D-UNCLASSIFIED-1"]);
    expect(register.counts.unclassifiedApproved).toBe(1);
  });

  it("approved-then-superseded decisions are NOT in unclassifiedApproved", () => {
    const register = foldCoreKnowledgeBase(
      [
        decision("D-WAS-APPROVED", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-WAS-APPROVED", "superseded", "2026-06-02T00:00:00.000Z"),
      ],
      [],
    );
    expect(register.unclassifiedApproved).toEqual([]);
  });

  it("round-trips through the (tmp) event store", () => {
    eventStore.append(decision("D-STORE-ROUND-TRIP", "approved", "2026-06-01T00:00:00.000Z"));
    eventStore.append(distilled("D-STORE-ROUND-TRIP", "foundational", "2026-06-12T00:00:00.000Z"));
    const register = readCoreKnowledgeBase();
    const row = register.foundational.find((r) => r.decisionId === "D-STORE-ROUND-TRIP");
    expect(row).toBeDefined();
    expect(row?.title).toBe("Title for D-STORE-ROUND-TRIP");
    expect(register.unclassifiedApproved).not.toContain("D-STORE-ROUND-TRIP");
  });
});
