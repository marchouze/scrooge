// tests/model-registry.test.ts
//
// Unit tests for the model-registry skeleton.
//
// Asserts:
//   - submit + classify + approve flow → production-eligible.
//   - withhold → not production-eligible.
//   - raise blocking finding → approval throws; not production-eligible.
//   - close finding → approval succeeds; production-eligible.
//   - submit duplicate methodologyHash → idempotent (no new event).
//   - approve / withhold / classify on unknown modelId → throws.
//   - close on unknown / already-closed finding → throws.
//   - Approval with future expiry vs past expiry → eligibility filter.
//
// Author: Nadia + Rohan (model-registry skeleton, first slice)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001 } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { LocalModelRegistry } from "../platform/model-registry";

const ROHAN_ACTOR: Actor = { type: "service", id: "agent:rohan:risk-run" };
const NADIA_ACTOR: Actor = { type: "service", id: "agent:nadia:validation" };

const CITATIONS = ["RAS-B7", "SR-11-7", "GOV-FRAMEWORK-CEO-RESERVED"];

const T0 = "2026-05-08T08:00:00.000Z";
const T1 = "2026-05-08T10:00:00.000Z";
const T2 = "2026-05-08T12:00:00.000Z";
const T3 = "2026-05-08T14:00:00.000Z";
const T4 = "2026-05-08T16:00:00.000Z";

const FUTURE_EXPIRY = "2027-05-08T00:00:00.000Z";
const PAST_EXPIRY = "2025-05-08T00:00:00.000Z";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function newRegistry(): { registry: LocalModelRegistry; store: EventStore } {
  const store = new EventStore();
  const registry = new LocalModelRegistry({ eventStore: store });
  return { registry, store };
}

describe("ModelRegistry — submit + classify + approve flow", () => {
  it("submit → classify → approve → production-eligible", () => {
    const { registry, store } = newRegistry();

    const submit = registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:var-historical-99",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 1,
      methodologyHash: HASH_A,
      description: "Historical-simulation VaR, 99% 1-day, equities + IRD.",
    });
    expect(submit.status).toBe("submitted");
    expect(submit.eventEmitted).toBe(true);

    registry.classifyTier({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: "model:var-historical-99",
      classifiedBy: "agent:nadia",
      tier: 1,
      rationale: "Capital model under Reg 39 IMA — Tier-1 by RAS § B7.",
    });

    registry.approveValidation({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: "model:var-historical-99",
      version: "v1.0",
      approvedBy: "agent:nadia",
      validationFindingsResolved: [],
      expiryDate: FUTURE_EXPIRY,
    });

    const all = registry.list();
    expect(all.length).toBe(1);
    expect(all[0]?.validationStatus).toBe("approved");
    expect(all[0]?.tier).toBe(1);
    expect(all[0]?.tierClassified).toBe(true);
    expect(all[0]?.approvalExpiryDate).toBe(FUTURE_EXPIRY);
    expect(all[0]?.openBlockingFindingsCount).toBe(0);

    const eligible = registry.productionEligible(new Date(T3));
    expect(eligible.length).toBe(1);
    expect(eligible[0]?.modelId).toBe("model:var-historical-99");

    store.close();
  });
});

describe("ModelRegistry — withhold flow", () => {
  it("withhold excludes the model from production-eligible", () => {
    const { registry, store } = newRegistry();

    registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:ecl-stage1",
      submittedBy: "agent:rohan",
      version: "v0.9",
      tier: 1,
      methodologyHash: HASH_A,
      description: "IFRS 9 ECL Stage-1 transition matrix.",
    });

    registry.withholdValidation({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: "model:ecl-stage1",
      version: "v0.9",
      withheldBy: "agent:nadia",
      reason: "Methodology not adequately documented; PIT-vs-TTC analysis missing.",
      findings: ["finding:ecl-stage1:doc-gap"],
    });

    const all = registry.list();
    expect(all[0]?.validationStatus).toBe("withheld");
    expect(all[0]?.withholdReason).toContain("PIT-vs-TTC");

    const eligible = registry.productionEligible(new Date(T2));
    expect(eligible.length).toBe(0);

    store.close();
  });
});

describe("ModelRegistry — blocking findings prevent approval", () => {
  it("raising a blocking finding makes approveValidation throw and excludes from eligible", () => {
    const { registry, store } = newRegistry();

    registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:lcr-engine",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 1,
      methodologyHash: HASH_A,
      description: "LCR computation engine — HQLA classification + outflow weights.",
    });

    registry.raiseFinding({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      findingId: "finding:lcr:hqla-classification-error",
      modelId: "model:lcr-engine",
      raisedBy: "agent:nadia",
      severity: "blocking",
      description: "HQLA Level 2A classification miscategorises supranationals.",
    });

    expect(() =>
      registry.approveValidation({
        asOf: T2,
        entity: BANK_ZA_001,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        modelId: "model:lcr-engine",
        version: "v1.0",
        approvedBy: "agent:nadia",
        validationFindingsResolved: [],
        expiryDate: FUTURE_EXPIRY,
      }),
    ).toThrow(/open blocking finding/);

    const all = registry.list();
    expect(all[0]?.validationStatus).toBe("submitted");
    expect(all[0]?.openBlockingFindingsCount).toBe(1);

    const eligible = registry.productionEligible(new Date(T3));
    expect(eligible.length).toBe(0);

    store.close();
  });
});

describe("ModelRegistry — closing a finding unblocks approval", () => {
  it("close finding → approve → production-eligible", () => {
    const { registry, store } = newRegistry();

    registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:lcr-engine",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 1,
      methodologyHash: HASH_A,
      description: "LCR computation engine — HQLA classification + outflow weights.",
    });

    registry.raiseFinding({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      findingId: "finding:lcr:hqla-classification-error",
      modelId: "model:lcr-engine",
      raisedBy: "agent:nadia",
      severity: "blocking",
      description: "HQLA Level 2A classification miscategorises supranationals.",
    });

    registry.closeFinding({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      findingId: "finding:lcr:hqla-classification-error",
      closedBy: "agent:nadia",
      resolution: "Methodology v1.1 reclassifies supranationals to Level 1; backtest accepts.",
    });

    registry.approveValidation({
      asOf: T3,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: "model:lcr-engine",
      version: "v1.0",
      approvedBy: "agent:nadia",
      validationFindingsResolved: ["finding:lcr:hqla-classification-error"],
      expiryDate: FUTURE_EXPIRY,
    });

    const all = registry.list();
    expect(all[0]?.validationStatus).toBe("approved");
    expect(all[0]?.openBlockingFindingsCount).toBe(0);
    expect(all[0]?.findings.length).toBe(1);
    expect(all[0]?.findings[0]?.status).toBe("closed");

    const eligible = registry.productionEligible(new Date(T4));
    expect(eligible.length).toBe(1);

    store.close();
  });
});

describe("ModelRegistry — submit idempotency", () => {
  it("re-submitting an identical (modelId, methodologyHash) emits no new event", () => {
    const { registry, store } = newRegistry();

    const first = registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:var-historical-99",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 1,
      methodologyHash: HASH_A,
      description: "Historical VaR.",
    });
    expect(first.status).toBe("submitted");
    expect(first.eventEmitted).toBe(true);

    const second = registry.submit({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:var-historical-99",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 1,
      methodologyHash: HASH_A,
      description: "Historical VaR.",
    });
    expect(second.status).toBe("unchanged");
    expect(second.eventEmitted).toBe(false);

    const submittedEvents = [...store.replay({ type: "ModelSubmitted" })];
    expect(submittedEvents.length).toBe(1);

    // A different methodologyHash for the same modelId emits a fresh event.
    const third = registry.submit({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:var-historical-99",
      submittedBy: "agent:rohan",
      version: "v1.1",
      tier: 1,
      methodologyHash: HASH_B,
      description: "Historical VaR — methodology revised.",
    });
    expect(third.status).toBe("submitted");
    expect(third.eventEmitted).toBe(true);

    expect([...store.replay({ type: "ModelSubmitted" })].length).toBe(2);

    store.close();
  });
});

describe("ModelRegistry — error paths", () => {
  it("classifyTier on unknown modelId throws", () => {
    const { registry, store } = newRegistry();
    expect(() =>
      registry.classifyTier({
        asOf: T0,
        entity: BANK_ZA_001,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        modelId: "model:nonexistent",
        classifiedBy: "agent:nadia",
        tier: 1,
        rationale: "n/a",
      }),
    ).toThrow(/no prior ModelSubmitted/);
    store.close();
  });

  it("approveValidation on unknown modelId throws", () => {
    const { registry, store } = newRegistry();
    expect(() =>
      registry.approveValidation({
        asOf: T0,
        entity: BANK_ZA_001,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        modelId: "model:nonexistent",
        version: "v1.0",
        approvedBy: "agent:nadia",
        validationFindingsResolved: [],
        expiryDate: FUTURE_EXPIRY,
      }),
    ).toThrow(/no prior ModelSubmitted/);
    store.close();
  });

  it("withholdValidation on unknown modelId throws", () => {
    const { registry, store } = newRegistry();
    expect(() =>
      registry.withholdValidation({
        asOf: T0,
        entity: BANK_ZA_001,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        modelId: "model:nonexistent",
        version: "v1.0",
        withheldBy: "agent:nadia",
        reason: "n/a",
        findings: [],
      }),
    ).toThrow(/no prior ModelSubmitted/);
    store.close();
  });

  it("closeFinding on unknown findingId throws", () => {
    const { registry, store } = newRegistry();
    expect(() =>
      registry.closeFinding({
        asOf: T0,
        entity: BANK_ZA_001,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        findingId: "finding:nonexistent",
        closedBy: "agent:nadia",
        resolution: "n/a",
      }),
    ).toThrow(/no prior ValidationFindingRaised/);
    store.close();
  });

  it("closeFinding on already-closed finding throws", () => {
    const { registry, store } = newRegistry();

    registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:test",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 2,
      methodologyHash: HASH_A,
      description: "Test.",
    });
    registry.raiseFinding({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      findingId: "finding:test:1",
      modelId: "model:test",
      raisedBy: "agent:nadia",
      severity: "medium",
      description: "Doc gap.",
    });
    registry.closeFinding({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      findingId: "finding:test:1",
      closedBy: "agent:nadia",
      resolution: "Doc added.",
    });

    expect(() =>
      registry.closeFinding({
        asOf: T3,
        entity: BANK_ZA_001,
        actor: NADIA_ACTOR,
        citations: CITATIONS,
        findingId: "finding:test:1",
        closedBy: "agent:nadia",
        resolution: "Already closed.",
      }),
    ).toThrow(/already closed/);

    store.close();
  });
});

describe("ModelRegistry — approval expiry", () => {
  it("an approved model with a past expiry is not production-eligible", () => {
    const { registry, store } = newRegistry();

    registry.submit({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: ROHAN_ACTOR,
      citations: CITATIONS,
      modelId: "model:lapsed",
      submittedBy: "agent:rohan",
      version: "v1.0",
      tier: 2,
      methodologyHash: HASH_A,
      description: "Lapsed approval test.",
    });
    registry.approveValidation({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: NADIA_ACTOR,
      citations: CITATIONS,
      modelId: "model:lapsed",
      version: "v1.0",
      approvedBy: "agent:nadia",
      validationFindingsResolved: [],
      expiryDate: PAST_EXPIRY,
    });

    const all = registry.list();
    expect(all[0]?.validationStatus).toBe("approved");

    // Eligibility check uses the configured `now` — past expiry excludes.
    const eligible = registry.productionEligible(new Date("2026-01-01T00:00:00.000Z"));
    expect(eligible.length).toBe(0);

    store.close();
  });
});

describe("ModelRegistry — empty registry", () => {
  it("list() and productionEligible() are empty when no events have been emitted", () => {
    const { registry, store } = newRegistry();
    expect(registry.list().length).toBe(0);
    expect(registry.productionEligible().length).toBe(0);
    store.close();
  });
});
