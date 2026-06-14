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

/**
 * Seed a generic held dimension posture (registered + active). `held` controls
 * whether the bank holds the value; only held=true dimensions enter the context.
 */
function seedDimensionPosture(
  store: EventStore,
  postureId: string,
  dimensionKey: string,
  dimensionValue: string,
  held: boolean,
  asOf = "2026-06-14T00:00:00Z",
): void {
  store.append(
    makePostureRegistered({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITES,
      payload: {
        postureId,
        postureClass: "jurisdiction-flag",
        description: `dimension posture ${dimensionKey}=${dimensionValue} held=${held}`,
        appliesToScope: { kind: "jurisdiction", jurisdiction: "ZA" },
        appliesToTier: "all",
        proposedBy: "agent:test",
        citations: CITES,
        parameters: { dimensionKey, dimensionValue, held },
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
        postureId,
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

  it("maps each HELD posture's dimensionKey→dimensionValue into context.dimensions and OMITS not-held keys", () => {
    const store = new EventStore(":memory:");
    seedHeldBankEntityClass(store);
    // SA credit-rwa held; advanced-irb NOT held; supervisory permission NOT held.
    seedDimensionPosture(
      store,
      "posture:approach.credit-rwa:standardised-approach",
      "approach.credit-rwa",
      "standardised-approach",
      true,
    );
    seedDimensionPosture(
      store,
      "posture:approach.credit-rwa:advanced-irb",
      "approach.credit-rwa",
      "advanced-irb",
      false,
    );
    seedDimensionPosture(
      store,
      "posture:permission.supervisory:irb-permission",
      "permission.supervisory",
      "irb-permission",
      false,
    );
    const contexts = buildBankPostureContexts(readPostureRegister(store));
    const ctx = contexts[0];
    if (!ctx) throw new Error("expected one context");
    // held SA value present; entity.class present
    expect(ctx.context.dimensions?.["approach.credit-rwa"]).toBe("standardised-approach");
    expect(ctx.context.dimensions?.["entity.class"]).toBe("bank");
    // not-held dimensionKey is OMITTED entirely (no held value for it)
    expect(ctx.context.dimensions?.["permission.supervisory"]).toBeUndefined();
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

  it("DEMONSTRATION: an IRB-chapter obligation resolves to 'does-not-apply' against a standardised-approach bank", () => {
    const store = new EventStore(":memory:");
    seedHeldBankEntityClass(store);
    // The bank holds the STANDARDISED credit-rwa approach (not IRB).
    seedDimensionPosture(
      store,
      "posture:approach.credit-rwa:standardised-approach",
      "approach.credit-rwa",
      "standardised-approach",
      true,
    );
    const contexts = buildBankPostureContexts(readPostureRegister(store));
    // Obligation derived from a BCBS IRB chapter → extractor emits a restricting
    // dimension scope requiring approach.credit-rwa=advanced-irb.
    const { appliesToScope, result } = assessObligationApplicability(
      { obligationId: "ORG-PR-IRB", derivesFrom: ["bcbs-cre32"], domain: "B" },
      contexts,
    );
    expect(appliesToScope).toEqual({
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "dimension", dimensionKey: "approach.credit-rwa", dimensionValue: "advanced-irb" },
      ],
    });
    expect(result.verdict).toBe("does-not-apply");
    expect(result.matches).toEqual([]);
  });

  it("DEMONSTRATION: a generic ZA obligation resolves to 'applies'", () => {
    const store = new EventStore(":memory:");
    seedHeldBankEntityClass(store);
    seedDimensionPosture(
      store,
      "posture:approach.credit-rwa:standardised-approach",
      "approach.credit-rwa",
      "standardised-approach",
      true,
    );
    const contexts = buildBankPostureContexts(readPostureRegister(store));
    const { appliesToScope, result } = assessObligationApplicability(
      { obligationId: "ORG-PR-GENERIC", derivesFrom: ["banks-d7-2020-s2"], domain: "A" },
      contexts,
    );
    expect(appliesToScope).toEqual({ kind: "jurisdiction", jurisdiction: "ZA" });
    expect(result.verdict).toBe("applies");
  });

  it("an explicit appliesToScope WINS over the extractor", () => {
    const store = new EventStore(":memory:");
    seedHeldBankEntityClass(store);
    const contexts = buildBankPostureContexts(readPostureRegister(store));
    // derivesFrom would route to an IRB scope via the extractor, but the explicit
    // scope (jurisdiction ZA) overrides it → applies.
    const { appliesToScope, result } = assessObligationApplicability(
      {
        obligationId: "ORG-PR-OVERRIDE",
        derivesFrom: ["bcbs-cre30"],
        domain: "B",
        appliesToScope: { kind: "jurisdiction", jurisdiction: "ZA" },
      },
      contexts,
    );
    expect(appliesToScope).toEqual({ kind: "jurisdiction", jurisdiction: "ZA" });
    expect(result.verdict).toBe("applies");
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
