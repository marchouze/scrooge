// platform/obligations/applicability.test.ts
//
// Unit tests for the W8 Slice C obligation-applicability helper: the posture
// reader, the candidate-context derivation, the assessment, and the idempotency
// id/guard. Exercises the helper against an in-memory event store seeded with
// posture events.
//
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { describe, expect, it } from "bun:test";
import { makeApplicabilityAssessmentConcluded } from "../event-store/event-types/applicability-assessment";
import { makePostureActivated, makePostureRegistered } from "../event-store/event-types/posture";
import { EventStore } from "../event-store/store";
import {
  ANCHOR_CONTEXT_REF,
  assessObligationApplicability,
  buildBankPostureContexts,
  concludedAssessmentIds,
  obligationAssessmentId,
  readPostureRegister,
} from "./applicability";

const ACTOR = { type: "service" as const, id: "agent:test" };
const CITES = ["D-W8-POSTURE-REGISTER-SLICE-1"];

/** Seed the entity.class=bank (held=true) dimension posture, registered+active. */
function seedHeldBankEntityClass(store: EventStore, asOf = "2026-06-14T00:00:00Z"): void {
  store.append(
    makePostureRegistered({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITES,
      payload: {
        postureId: "posture:entity.class:bank",
        postureClass: "jurisdiction-flag",
        description: "Entity-class posture: bank.",
        appliesToScope: { kind: "jurisdiction", jurisdiction: "ZA" },
        appliesToTier: "all",
        proposedBy: "agent:test",
        citations: CITES,
        parameters: { dimensionKey: "entity.class", dimensionValue: "bank", held: true },
      },
    }),
  );
  store.append(
    makePostureActivated({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITES,
      payload: {
        postureId: "posture:entity.class:bank",
        appliesToScope: { kind: "jurisdiction", jurisdiction: "ZA" },
        activatedAt: asOf,
        authority: "CEO",
        citations: CITES,
      },
    }),
  );
}

describe("buildBankPostureContexts", () => {
  it("derives entityType from the active held entity.class posture", () => {
    const store = new EventStore(":memory:");
    seedHeldBankEntityClass(store);
    const register = readPostureRegister(store);
    const contexts = buildBankPostureContexts(register);
    expect(contexts).toHaveLength(1);
    const ctx = contexts[0];
    if (!ctx) throw new Error("expected one context");
    expect(ctx.contextRef).toBe(ANCHOR_CONTEXT_REF);
    expect(ctx.context.jurisdiction).toBe("ZA");
    expect(ctx.context.entityType).toBe("bank");
  });

  it("falls back to 'bank' when no held entity.class posture is active", () => {
    const store = new EventStore(":memory:");
    const register = readPostureRegister(store);
    const contexts = buildBankPostureContexts(register);
    expect(contexts).toHaveLength(1);
    const ctx = contexts[0];
    if (!ctx) throw new Error("expected one context");
    expect(ctx.context.entityType).toBe("bank");
  });
});

describe("assessObligationApplicability", () => {
  it("yields 'applies' for the ZA-jurisdiction scope over the ZA-bank context", () => {
    const store = new EventStore(":memory:");
    seedHeldBankEntityClass(store);
    const contexts = buildBankPostureContexts(readPostureRegister(store));
    const { appliesToScope, result } = assessObligationApplicability(
      { obligationId: "ORG-PR-99", derivesFrom: [], domain: "A" },
      contexts,
    );
    expect(appliesToScope).toEqual({ kind: "jurisdiction", jurisdiction: "ZA" });
    expect(result.verdict).toBe("applies");
    expect(result.matches).toEqual([ANCHOR_CONTEXT_REF]);
    expect(result.rationale.length).toBeGreaterThan(0);
  });
});

describe("obligationAssessmentId + concludedAssessmentIds", () => {
  it("builds a lowercased, date-suffixed id", () => {
    expect(obligationAssessmentId("ORG-PR-99", "2026-06-14T12:34:56Z")).toBe(
      "assessment:obligation:org-pr-99:2026-06-14",
    );
  });

  it("reads concluded assessment ids from the store for the idempotency guard", () => {
    const store = new EventStore(":memory:");
    const id = obligationAssessmentId("ORG-PR-99", "2026-06-14T00:00:00Z");
    expect(concludedAssessmentIds(store).has(id)).toBe(false);
    store.append(
      makeApplicabilityAssessmentConcluded({
        asOf: "2026-06-14T00:00:00Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: ACTOR,
        citations: CITES,
        payload: {
          assessmentId: id,
          verdict: "applies",
          appliesToContexts: [ANCHOR_CONTEXT_REF],
          rationale: "test",
          concludedBy: "agent:test",
          concludedAt: "2026-06-14T00:00:00Z",
          citations: CITES,
        },
      }),
    );
    expect(concludedAssessmentIds(store).has(id)).toBe(true);
  });
});
