// tests/regulatory-source-reviewed.test.ts
//
// WS-REGULATORY-REVIEW-MARKER (Phase 1) — three-site registration + factory
// round-trip for the RegulatorySourceReviewed event type.
//
// Asserts:
//   (1) provenance-category resolves the type to a production category
//       (governance) — not "simulated" (the F-032 / three-site gotcha);
//   (2) the registry row exists with a payloadSchema attached;
//   (3) the make<Type> factory builds an Event the eventSchema accepts and
//       validatePayload succeeds for the built payload.
//
// Author: Atlas (Core Banking Platform Architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  type RegulatorySourceReviewedPayload,
  makeRegulatorySourceReviewed,
} from "../platform/event-store/event-types/regulatory";
import { categoryForEventType } from "../platform/event-store/provenance-category";
import { lookupEventType, validatePayload } from "../platform/event-store/registry";

const TYPE = "RegulatorySourceReviewed";

const validPayload: RegulatorySourceReviewedPayload = {
  slug: "bcbs-cre",
  instrumentId: "BCBS-CRE",
  reviewedAt: "2026-06-15T11:00:00.000Z",
  reviewedSourceHash: "blake3:abc123",
  method: "llm-distill",
  model: "claude-opus (co-work)",
  obligationCount: 105,
  reviewedBy: "Mira (Chief Obligations & Regulatory Officer, compliance)",
};

describe("RegulatorySourceReviewed — three-site registration", () => {
  it("resolves to the governance provenance category (production)", () => {
    expect(categoryForEventType(TYPE)).toBe("governance");
  });

  it("has a registry row with a payloadSchema", () => {
    const row = lookupEventType(TYPE);
    expect(!!row).toBe(true);
    expect(!!row?.payloadSchema).toBe(true);
    expect(row?.class).toBe("governance");
  });

  it("factory builds a valid Event and validatePayload succeeds", () => {
    const e = makeRegulatorySourceReviewed({
      asOf: "2026-06-15T11:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:mira" },
      citations: ["D-REGULATORY-LIBRARY-V1"],
      payload: validPayload,
    });
    expect(e.type).toBe(TYPE);
    expect(() => validatePayload(TYPE, e.payload)).not.toThrow();
  });

  it("rejects a negative obligationCount", () => {
    expect(() =>
      makeRegulatorySourceReviewed({
        asOf: "2026-06-15T11:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:mira" },
        citations: ["D-REGULATORY-LIBRARY-V1"],
        payload: { ...validPayload, obligationCount: -1 },
      }),
    ).toThrow();
  });
});
