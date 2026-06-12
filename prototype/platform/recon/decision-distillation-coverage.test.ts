// platform/recon/decision-distillation-coverage.test.ts
//
// Coverage-gate detection: classified + unclassified approved decisions →
// exactly the unclassified ones are findings; dangling classifications
// (pointing at nonexistent decisionIds) are findings; clean sets are green.
//
// Author: Owen (Company Secretary, governance).

import { describe, expect, it } from "bun:test";

import { makeDecision } from "../event-store/event-types/decision";
import { makeDecisionDistilled } from "../event-store/event-types/decision-distillation";
import type { DecisionDistillationClass } from "../event-store/event-types/decision-distillation";
import { findDistillationCoverageGaps } from "./decision-distillation-coverage";

const ENTITY = "LE-ZA-HOZ-BANK";

function decision(decisionId: string, phase: "requested" | "approved" | "withdrawn", asOf: string) {
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
      title: `Title for ${decisionId}`,
      category: "governance",
      recommendation: "Approve.",
      rationale: "Test fixture.",
      sourceDocHashes: [],
      citations: ["D-DECISIONS-FRAMEWORK-REDESIGN"],
      recordedVia: "scrooge:session-delegation",
    },
  });
}

function distilled(decisionId: string, klass: DecisionDistillationClass, asOf: string) {
  return makeDecisionDistilled({
    asOf,
    entity: ENTITY,
    actor: { type: "service", id: "agent:owen:company-secretary" },
    citations: ["D-V2-BBAAS-W1-DECISION-DISTILLATION"],
    payload: {
      decisionId,
      class: klass,
      rationale: `Rationale for ${decisionId}`,
      citations: [],
      distilledBy: "company-secretary",
      workstream: "WS-V2-BBAAS-W1",
    },
  });
}

describe("recon:decision-distillation-coverage", () => {
  it("green when every latest-approved decision is classified and nothing dangles", () => {
    const { findings, assertedApproved, classified } = findDistillationCoverageGaps(
      [
        decision("D-COVERED-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-COVERED-2", "approved", "2026-06-01T00:00:00.000Z"),
      ],
      [
        distilled("D-COVERED-1", "foundational", "2026-06-12T00:00:00.000Z"),
        distilled("D-COVERED-2", "directional", "2026-06-12T00:00:00.000Z"),
      ],
    );
    expect(findings).toHaveLength(0);
    expect(assertedApproved).toBe(2);
    expect(classified).toBe(2);
  });

  it("detects an approved decision with no classification", () => {
    const { findings } = findDistillationCoverageGaps(
      [
        decision("D-COVERED-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-MISSING-1", "approved", "2026-06-01T00:00:00.000Z"),
      ],
      [distilled("D-COVERED-1", "foundational", "2026-06-12T00:00:00.000Z")],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("unclassified-approved");
    expect(findings[0]?.decisionId).toBe("D-MISSING-1");
  });

  it("does NOT require classification for decisions whose latest phase is not approved", () => {
    const { findings } = findDistillationCoverageGaps(
      [
        decision("D-GONE-1", "approved", "2026-06-01T00:00:00.000Z"),
        decision("D-GONE-1", "withdrawn", "2026-06-02T00:00:00.000Z"),
      ],
      [],
    );
    expect(findings).toHaveLength(0);
  });

  it("detects a classification pointing at a nonexistent decisionId", () => {
    const { findings } = findDistillationCoverageGaps(
      [decision("D-REAL-1", "approved", "2026-06-01T00:00:00.000Z")],
      [
        distilled("D-REAL-1", "foundational", "2026-06-12T00:00:00.000Z"),
        distilled("D-PHANTOM-1", "obsolete", "2026-06-12T00:00:00.000Z"),
      ],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("dangling-classification");
    expect(findings[0]?.decisionId).toBe("D-PHANTOM-1");
  });

  it("empty store is green by construction", () => {
    const { findings } = findDistillationCoverageGaps([], []);
    expect(findings).toHaveLength(0);
  });
});
