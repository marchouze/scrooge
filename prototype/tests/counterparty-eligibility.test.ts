// tests/counterparty-eligibility.test.ts
//
// Unit tests for the counterparty institutional-eligibility screening
// event family (Niko, v0). PR scope: typed events + procedure stub
// under D-FSP-LICENCE-NECESSITY confirm-A (PR #62; FAIS Posture A).
//
// Asserts:
//   - Each event factory passes a Zod parse round-trip.
//   - Citation slot is enforced (≥1 citation required on the envelope).
//   - Outcome enum is enforced.
//   - CounterpartyEligibilityRevalidated requires a priorScreeningId.
//   - CounterpartyEligibilityBreached requires a breachReason.
//   - At-least-one criteria + at-least-one evidenceRef are enforced.
//   - Registry lookup returns the typed payload schema for each.
//
// Author: Niko (Sales / CRM engineer)

import { describe, expect, it } from "bun:test";

import {
  type CounterpartyEligibilityBreachedPayload,
  type CounterpartyEligibilityRevalidatedPayload,
  type CounterpartyEligibilityScreenedPayload,
  makeCounterpartyEligibilityBreached,
  makeCounterpartyEligibilityRevalidated,
  makeCounterpartyEligibilityScreened,
} from "../platform/event-store/event-types";
import { lookupEventType } from "../platform/event-store/registry";
import type { Actor } from "../platform/event-store/types";

const ENTITY = "LE-ZA-HOZ-BANK";
const T0 = "2026-05-09T08:00:00.000Z";
const T1 = "2027-05-09T08:00:00.000Z";
const T2 = "2027-08-15T10:30:00.000Z";

const NIKO_ACTOR: Actor = { type: "service", id: "agent:niko:eligibility-screening" };

const CITATIONS = [
  "FAIS-ACT-37-2002",
  "urn:obligation:bank:fais:general-code-of-conduct:v1",
  "[citation: TBC pending counsel — FAIS s.45 sub-section refs]",
];

const SCREENED_PAYLOAD: CounterpartyEligibilityScreenedPayload = {
  counterpartyId: "cp:standard-bank-za",
  screeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
  criteria: [
    "SARB-licensed bank (Banks Act 94/1990)",
    "Professional counterparty per FAIS s.45 [citation: TBC]",
  ],
  outcome: "institutional-eligible",
  evidenceRefs: [
    "SARB-licence-number-12345",
    "Owner Inbox/cp:standard-bank-za/eligibility-screening-2026-05-09.md",
  ],
  asOf: T0,
};

describe("CounterpartyEligibilityScreened — factory", () => {
  it("round-trips a valid screening event", () => {
    const event = makeCounterpartyEligibilityScreened({
      asOf: T0,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: CITATIONS,
      payload: SCREENED_PAYLOAD,
    });
    expect(event.type).toBe("CounterpartyEligibilityScreened");
    expect(event.payload.counterpartyId).toBe("cp:standard-bank-za");
    expect(event.payload.outcome).toBe("institutional-eligible");
  });

  it("rejects an envelope with empty citations (P2)", () => {
    expect(() =>
      makeCounterpartyEligibilityScreened({
        asOf: T0,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: [],
        payload: SCREENED_PAYLOAD,
      }),
    ).toThrow();
  });

  it("rejects an unknown outcome", () => {
    expect(() =>
      makeCounterpartyEligibilityScreened({
        asOf: T0,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          ...SCREENED_PAYLOAD,
          // @ts-expect-error — testing runtime enforcement of the outcome enum
          outcome: "maybe-eligible",
        },
      }),
    ).toThrow();
  });

  it("rejects a payload with zero criteria", () => {
    expect(() =>
      makeCounterpartyEligibilityScreened({
        asOf: T0,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: { ...SCREENED_PAYLOAD, criteria: [] },
      }),
    ).toThrow();
  });

  it("rejects a payload with zero evidenceRefs", () => {
    expect(() =>
      makeCounterpartyEligibilityScreened({
        asOf: T0,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: { ...SCREENED_PAYLOAD, evidenceRefs: [] },
      }),
    ).toThrow();
  });
});

describe("CounterpartyEligibilityRevalidated — factory", () => {
  const revalidatedPayload: CounterpartyEligibilityRevalidatedPayload = {
    counterpartyId: "cp:standard-bank-za",
    screeningId: "cp-eligibility:cp:standard-bank-za:2027-05-09",
    priorScreeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
    criteria: SCREENED_PAYLOAD.criteria,
    outcome: "institutional-eligible",
    evidenceRefs: SCREENED_PAYLOAD.evidenceRefs,
    asOf: T1,
  };

  it("round-trips a valid revalidation event", () => {
    const event = makeCounterpartyEligibilityRevalidated({
      asOf: T1,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: CITATIONS,
      payload: revalidatedPayload,
    });
    expect(event.type).toBe("CounterpartyEligibilityRevalidated");
    expect(event.payload.priorScreeningId).toBe("cp-eligibility:cp:standard-bank-za:2026-05-09");
  });

  it("requires a priorScreeningId — empty string rejected", () => {
    expect(() =>
      makeCounterpartyEligibilityRevalidated({
        asOf: T1,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: { ...revalidatedPayload, priorScreeningId: "" },
      }),
    ).toThrow();
  });
});

describe("CounterpartyEligibilityBreached — factory", () => {
  const breachedPayload: CounterpartyEligibilityBreachedPayload = {
    counterpartyId: "cp:standard-bank-za",
    priorScreeningId: "cp-eligibility:cp:standard-bank-za:2027-05-09",
    breachReason: "FSP licence withdrawn by FSCA — confirmed via regulator gazette",
    recommendedAction: "suspend-trading-and-rescreen",
    asOf: T2,
  };

  it("round-trips a valid breach event", () => {
    const event = makeCounterpartyEligibilityBreached({
      asOf: T2,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: CITATIONS,
      payload: breachedPayload,
    });
    expect(event.type).toBe("CounterpartyEligibilityBreached");
    expect(event.payload.recommendedAction).toBe("suspend-trading-and-rescreen");
  });

  it("requires a breachReason — empty string rejected", () => {
    expect(() =>
      makeCounterpartyEligibilityBreached({
        asOf: T2,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: { ...breachedPayload, breachReason: "" },
      }),
    ).toThrow();
  });

  it("rejects an unknown recommendedAction", () => {
    expect(() =>
      makeCounterpartyEligibilityBreached({
        asOf: T2,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          ...breachedPayload,
          // @ts-expect-error — testing runtime enforcement
          recommendedAction: "fire-and-forget",
        },
      }),
    ).toThrow();
  });
});

describe("Event-type registry — counterparty-eligibility entries", () => {
  it("registers all three types as markets-class with Niko as issuer", () => {
    for (const type of [
      "CounterpartyEligibilityScreened",
      "CounterpartyEligibilityRevalidated",
      "CounterpartyEligibilityBreached",
    ]) {
      const meta = lookupEventType(type);
      expect(meta).toBeDefined();
      expect(meta?.class).toBe("markets");
      expect(meta?.issuer).toBe("Niko");
      expect(meta?.payloadSchema).toBeDefined();
    }
  });
});
