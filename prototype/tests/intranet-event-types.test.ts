// tests/intranet-event-types.test.ts
//
// Tests for the three intranet event types:
//   - IntranetFeatureShipped
//   - DesignReviewComplete
//   - UXFindingRaised
//
// Covers:
//   1. Payload schema validation — valid payloads pass, invalid payloads reject.
//   2. Factory functions — each make<Type> produces a valid Event envelope.
//   3. INTRANET_EVENT_TYPES constant lists all three types.
//
// Authority: Principle 1 (events-first authoring per CLAUDE.md).
// Author: Noa (Intranet Product Owner & UI Architect, reporting to CEO)

import { describe, expect, it } from "bun:test";

import {
  INTRANET_EVENT_TYPES,
  designReviewCompletePayloadSchema,
  intranetFeatureShippedPayloadSchema,
  makeDesignReviewComplete,
  makeIntranetFeatureShipped,
  makeUXFindingRaised,
  uxFindingRaisedPayloadSchema,
} from "../platform/event-store/event-types/intranet";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["P1-EVENTS-AS-TRUTH"];
const ACTOR = { id: "agent:noa", type: "service" as const };
const AS_OF = "2026-05-15T10:00:00.000Z";

// ---------------------------------------------------------------------------
// 1. INTRANET_EVENT_TYPES constant
// ---------------------------------------------------------------------------

describe("INTRANET_EVENT_TYPES", () => {
  it("lists all three event types", () => {
    expect(INTRANET_EVENT_TYPES).toContain("IntranetFeatureShipped");
    expect(INTRANET_EVENT_TYPES).toContain("DesignReviewComplete");
    expect(INTRANET_EVENT_TYPES).toContain("UXFindingRaised");
  });

  it("has exactly three entries", () => {
    expect(INTRANET_EVENT_TYPES.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. IntranetFeatureShipped
// ---------------------------------------------------------------------------

describe("IntranetFeatureShipped", () => {
  it("payload validates correctly", () => {
    const payload = {
      featureId: "INTRANET-FEAT-001",
      title: "Fleet health card",
      description: "Adds a fleet health card to the intranet dashboard.",
      prUrl: "https://github.com/example/bank/pull/392",
      shippedBy: "noa",
      shippedAt: AS_OF,
    };
    expect(() => intranetFeatureShippedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("payload rejects missing required fields", () => {
    expect(() =>
      intranetFeatureShippedPayloadSchema.parse({
        featureId: "INTRANET-FEAT-001",
        // missing title, description, prUrl, shippedBy, shippedAt
      }),
    ).toThrow();
  });

  it("payload rejects invalid prUrl", () => {
    expect(() =>
      intranetFeatureShippedPayloadSchema.parse({
        featureId: "INTRANET-FEAT-001",
        title: "Fleet health card",
        description: "Some description",
        prUrl: "not-a-url",
        shippedBy: "noa",
        shippedAt: AS_OF,
      }),
    ).toThrow();
  });

  it("makeIntranetFeatureShipped produces a valid event envelope", () => {
    const event = makeIntranetFeatureShipped({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        featureId: "INTRANET-FEAT-001",
        title: "Fleet health card",
        description: "Adds a fleet health card to the intranet dashboard.",
        prUrl: "https://github.com/example/bank/pull/392",
        shippedBy: "noa",
        shippedAt: AS_OF,
      },
    });
    expect(event.type).toBe("IntranetFeatureShipped");
    expect(event.entity).toBe(ENTITY);
    expect(event.event_id).toBeTruthy();
    expect(event.payload.featureId).toBe("INTRANET-FEAT-001");
  });

  it("makeIntranetFeatureShipped accepts an explicit eventId", () => {
    const event = makeIntranetFeatureShipped({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId: "evt-intranet-test-001",
      payload: {
        featureId: "INTRANET-FEAT-002",
        title: "Second feature",
        description: "A second feature for testing.",
        prUrl: "https://github.com/example/bank/pull/393",
        shippedBy: "noa",
        shippedAt: AS_OF,
      },
    });
    expect(event.event_id).toBe("evt-intranet-test-001");
  });
});

// ---------------------------------------------------------------------------
// 3. DesignReviewComplete
// ---------------------------------------------------------------------------

describe("DesignReviewComplete", () => {
  it("payload validates correctly — approved", () => {
    const payload = {
      reviewId: "DESIGN-REV-001",
      featureOrComponent: "fleet-health-card",
      reviewer: "noa",
      outcome: "approved" as const,
      notes: "Design meets accessibility guidelines. Approved.",
      completedAt: AS_OF,
    };
    expect(() => designReviewCompletePayloadSchema.parse(payload)).not.toThrow();
  });

  it("payload validates correctly — approved-with-changes", () => {
    const payload = {
      reviewId: "DESIGN-REV-002",
      featureOrComponent: "agent-detail-panel",
      reviewer: "noa",
      outcome: "approved-with-changes" as const,
      notes: "Minor spacing adjustments required. Otherwise approved.",
      completedAt: AS_OF,
    };
    expect(() => designReviewCompletePayloadSchema.parse(payload)).not.toThrow();
  });

  it("payload validates correctly — rejected", () => {
    const payload = {
      reviewId: "DESIGN-REV-003",
      featureOrComponent: "settings-page",
      reviewer: "noa",
      outcome: "rejected" as const,
      notes: "Does not meet colour contrast requirements. Needs full rework.",
      completedAt: AS_OF,
    };
    expect(() => designReviewCompletePayloadSchema.parse(payload)).not.toThrow();
  });

  it("payload rejects invalid outcome", () => {
    expect(() =>
      designReviewCompletePayloadSchema.parse({
        reviewId: "DESIGN-REV-001",
        featureOrComponent: "fleet-health-card",
        reviewer: "noa",
        outcome: "pending", // not a valid enum value
        notes: "Some notes.",
        completedAt: AS_OF,
      }),
    ).toThrow();
  });

  it("makeDesignReviewComplete produces a valid event envelope", () => {
    const event = makeDesignReviewComplete({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        reviewId: "DESIGN-REV-001",
        featureOrComponent: "fleet-health-card",
        reviewer: "noa",
        outcome: "approved",
        notes: "Design approved.",
        completedAt: AS_OF,
      },
    });
    expect(event.type).toBe("DesignReviewComplete");
    expect(event.entity).toBe(ENTITY);
    expect(event.event_id).toBeTruthy();
    expect(event.payload.outcome).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// 4. UXFindingRaised
// ---------------------------------------------------------------------------

describe("UXFindingRaised", () => {
  it("payload validates correctly — low severity", () => {
    const payload = {
      findingId: "UX-FIND-001",
      component: "dashboard-home",
      description: "The loading spinner is slightly off-centre on mobile.",
      severity: "low" as const,
      raisedBy: "noa",
      raisedAt: AS_OF,
    };
    expect(() => uxFindingRaisedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("payload validates correctly — high severity", () => {
    const payload = {
      findingId: "UX-FIND-002",
      component: "fleet-health-card",
      description: "Key health metrics are not readable for colour-blind users.",
      severity: "high" as const,
      raisedBy: "noa",
      raisedAt: AS_OF,
    };
    expect(() => uxFindingRaisedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("payload rejects invalid severity", () => {
    expect(() =>
      uxFindingRaisedPayloadSchema.parse({
        findingId: "UX-FIND-001",
        component: "dashboard-home",
        description: "Some issue.",
        severity: "critical", // not in the enum
        raisedBy: "noa",
        raisedAt: AS_OF,
      }),
    ).toThrow();
  });

  it("makeUXFindingRaised produces a valid event envelope", () => {
    const event = makeUXFindingRaised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        findingId: "UX-FIND-001",
        component: "dashboard-home",
        description: "The loading spinner is slightly off-centre on mobile.",
        severity: "low",
        raisedBy: "noa",
        raisedAt: AS_OF,
      },
    });
    expect(event.type).toBe("UXFindingRaised");
    expect(event.entity).toBe(ENTITY);
    expect(event.event_id).toBeTruthy();
    expect(event.payload.severity).toBe("low");
  });

  it("makeUXFindingRaised accepts an explicit eventId", () => {
    const event = makeUXFindingRaised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId: "evt-ux-find-test-001",
      payload: {
        findingId: "UX-FIND-003",
        component: "agent-detail-panel",
        description: "Truncation on long agent names.",
        severity: "medium",
        raisedBy: "noa",
        raisedAt: AS_OF,
      },
    });
    expect(event.event_id).toBe("evt-ux-find-test-001");
  });
});
