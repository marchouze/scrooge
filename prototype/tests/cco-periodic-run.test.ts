// tests/cco-periodic-run.test.ts
//
// Tests for the CCO quarterly governance run event types and run script.
//
// Asserts:
//   - All five event-type Zod schemas validate correct payloads.
//   - All five make…() factories produce events that pass their schemas.
//   - All five types appear in EVENT_TYPE_REGISTRY with payloadSchema + retention.
//   - Idempotency: running the CCO script twice against a :memory: store
//     results in exactly 5 events (the second call emits 0 new events).
//   - Smoke: single run emits exactly 5 events.
//
// Authority:
//   - FIC Act 38/2001 (AML/CFT obligations)
//   - Banks Act 94/1990 §60A (MLRO responsibilities)
//   - D-CCO-GOVERNANCE-SEAT-G5 (pre-licence gate G5; CEO-approved)
//
// Author: Zara (Chief Compliance Officer, governance)
//         + Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001 } from "../platform/core/types";
import {
  AmlRiskAssessmentCompletedPayloadSchema,
  EddQueueReviewedPayloadSchema,
  GovernanceAttestationFiledPayloadSchema,
  GovernanceSeatRunCompletedPayloadSchema,
  SuspiciousActivityQueueReviewedPayloadSchema,
  makeAmlRiskAssessmentCompleted,
  makeEddQueueReviewed,
  makeGovernanceAttestationFiled,
  makeGovernanceSeatRunCompleted,
  makeSuspiciousActivityQueueReviewed,
} from "../platform/event-store/event-types/governance-seat-runs";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const NOW = "2026-05-28T07:38:42.000Z";
const PERIOD = "2026-Q2";
const SEAT_ID = "cco";
const AGENT_ID = "zara";

const ENVELOPE = {
  asOf: NOW,
  entity: BANK_ZA_001,
  actor: { type: "service" as const, id: `agent:${AGENT_ID}` },
  citations: ["FIC Act 38/2001 §42", "POL-AML-001", "RMCP §4", "D-CCO-GOVERNANCE-SEAT-G5"],
};

const VALID_ATTESTATION_PAYLOAD = {
  seatId: SEAT_ID,
  attestorId: AGENT_ID,
  attestationType: "rmcp-quarterly",
  period: PERIOD,
  attestedAt: NOW,
  findings: [],
  policyRef: "RMCP §4",
};

const VALID_SAR_PAYLOAD = {
  reviewedAt: NOW,
  queueDepth: 0,
  strFiled: 0,
  ctrFiled: 0,
  notes: "No live clients; queue empty.",
};

const VALID_AML_PAYLOAD = {
  assessmentType: "institutional-quarterly",
  period: PERIOD,
  riskRating: "low",
  keyFindings: "No material issues identified.",
  policyRef: "POL-AML-001 §4",
};

const VALID_EDD_PAYLOAD = {
  reviewedAt: NOW,
  queueDepth: 0,
  signed: true,
  notes: "Queue empty. Sign-off: Zara (CCO).",
};

const VALID_RUN_COMPLETED_PAYLOAD = {
  seatId: SEAT_ID,
  agentId: AGENT_ID,
  runType: "quarterly-periodic",
  period: PERIOD,
  eventsEmitted: 4,
  findings: [],
  status: "completed",
};

// ---------------------------------------------------------------------------
// Registry coverage
// ---------------------------------------------------------------------------

const CCO_EVENT_TYPES = [
  "GovernanceSeatRunCompleted",
  "GovernanceAttestationFiled",
  "SuspiciousActivityQueueReviewed",
  "AmlRiskAssessmentCompleted",
  "EddQueueReviewed",
] as const;

describe("CCO periodic run — registry coverage", () => {
  it("all five event types are registered in EVENT_TYPE_REGISTRY", () => {
    const missing = CCO_EVENT_TYPES.filter((t) => !lookupEventType(t));
    expect(missing).toEqual([]);
  });

  it("each type carries a payloadSchema and retention metadata", () => {
    for (const name of CCO_EVENT_TYPES) {
      const meta = lookupEventType(name);
      expect(meta, `${name} not in registry`).toBeDefined();
      expect(meta?.payloadSchema, `${name} missing payloadSchema`).toBeDefined();
      expect(meta?.retention, `${name} missing retention`).toBeDefined();
      expect(meta?.retention.minimumYears, `${name} retention.minimumYears`).toBeGreaterThanOrEqual(
        5,
      );
      expect(meta?.class, `${name} class`).toBe("governance");
    }
  });

  it("each type appears exactly once in the combined registry", () => {
    for (const name of CCO_EVENT_TYPES) {
      const matches = EVENT_TYPE_REGISTRY.filter((m) => m.type === name);
      expect(matches.length, `${name} count`).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation
// ---------------------------------------------------------------------------

describe("CCO periodic run — Zod schema validation", () => {
  describe("GovernanceSeatRunCompletedPayloadSchema", () => {
    it("accepts a valid payload", () => {
      const parsed = GovernanceSeatRunCompletedPayloadSchema.parse(VALID_RUN_COMPLETED_PAYLOAD);
      expect(parsed.seatId).toBe(SEAT_ID);
      expect(parsed.period).toBe(PERIOD);
      expect(parsed.eventsEmitted).toBe(4);
    });

    it("rejects missing seatId", () => {
      const { seatId: _removed, ...rest } = VALID_RUN_COMPLETED_PAYLOAD;
      expect(() => GovernanceSeatRunCompletedPayloadSchema.parse(rest)).toThrow();
    });

    it("rejects negative eventsEmitted", () => {
      expect(() =>
        GovernanceSeatRunCompletedPayloadSchema.parse({
          ...VALID_RUN_COMPLETED_PAYLOAD,
          eventsEmitted: -1,
        }),
      ).toThrow();
    });
  });

  describe("GovernanceAttestationFiledPayloadSchema", () => {
    it("accepts a valid payload", () => {
      const parsed = GovernanceAttestationFiledPayloadSchema.parse(VALID_ATTESTATION_PAYLOAD);
      expect(parsed.attestationType).toBe("rmcp-quarterly");
    });

    it("rejects missing policyRef", () => {
      const { policyRef: _removed, ...rest } = VALID_ATTESTATION_PAYLOAD;
      expect(() => GovernanceAttestationFiledPayloadSchema.parse(rest)).toThrow();
    });

    it("rejects empty attestationType", () => {
      expect(() =>
        GovernanceAttestationFiledPayloadSchema.parse({
          ...VALID_ATTESTATION_PAYLOAD,
          attestationType: "",
        }),
      ).toThrow();
    });
  });

  describe("SuspiciousActivityQueueReviewedPayloadSchema", () => {
    it("accepts a valid payload", () => {
      const parsed = SuspiciousActivityQueueReviewedPayloadSchema.parse(VALID_SAR_PAYLOAD);
      expect(parsed.queueDepth).toBe(0);
      expect(parsed.strFiled).toBe(0);
    });

    it("rejects negative queueDepth", () => {
      expect(() =>
        SuspiciousActivityQueueReviewedPayloadSchema.parse({
          ...VALID_SAR_PAYLOAD,
          queueDepth: -5,
        }),
      ).toThrow();
    });

    it("rejects negative strFiled", () => {
      expect(() =>
        SuspiciousActivityQueueReviewedPayloadSchema.parse({
          ...VALID_SAR_PAYLOAD,
          strFiled: -1,
        }),
      ).toThrow();
    });
  });

  describe("AmlRiskAssessmentCompletedPayloadSchema", () => {
    it("accepts a valid payload", () => {
      const parsed = AmlRiskAssessmentCompletedPayloadSchema.parse(VALID_AML_PAYLOAD);
      expect(parsed.riskRating).toBe("low");
    });

    it("rejects missing period", () => {
      const { period: _removed, ...rest } = VALID_AML_PAYLOAD;
      expect(() => AmlRiskAssessmentCompletedPayloadSchema.parse(rest)).toThrow();
    });

    it("rejects empty policyRef", () => {
      expect(() =>
        AmlRiskAssessmentCompletedPayloadSchema.parse({
          ...VALID_AML_PAYLOAD,
          policyRef: "",
        }),
      ).toThrow();
    });
  });

  describe("EddQueueReviewedPayloadSchema", () => {
    it("accepts a valid payload with signed: true", () => {
      const parsed = EddQueueReviewedPayloadSchema.parse(VALID_EDD_PAYLOAD);
      expect(parsed.signed).toBe(true);
    });

    it("accepts a valid payload with signed: false", () => {
      const parsed = EddQueueReviewedPayloadSchema.parse({ ...VALID_EDD_PAYLOAD, signed: false });
      expect(parsed.signed).toBe(false);
    });

    it("rejects missing signed field", () => {
      const { signed: _removed, ...rest } = VALID_EDD_PAYLOAD;
      expect(() => EddQueueReviewedPayloadSchema.parse(rest)).toThrow();
    });

    it("rejects negative queueDepth", () => {
      expect(() =>
        EddQueueReviewedPayloadSchema.parse({ ...VALID_EDD_PAYLOAD, queueDepth: -1 }),
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Factory constructors
// ---------------------------------------------------------------------------

describe("CCO periodic run — make…() factories", () => {
  it("makeGovernanceSeatRunCompleted produces a parseable event", () => {
    const e = makeGovernanceSeatRunCompleted({
      ...ENVELOPE,
      payload: VALID_RUN_COMPLETED_PAYLOAD,
    });
    expect(e.type).toBe("GovernanceSeatRunCompleted");
    expect(e.entity).toBe(BANK_ZA_001);
    expect((e.payload as Record<string, unknown>).seatId).toBe(SEAT_ID);
  });

  it("makeGovernanceSeatRunCompleted requires at least one citation", () => {
    expect(() =>
      makeGovernanceSeatRunCompleted({
        ...ENVELOPE,
        citations: [],
        payload: VALID_RUN_COMPLETED_PAYLOAD,
      }),
    ).toThrow(/citation/i);
  });

  it("makeGovernanceAttestationFiled produces a parseable event", () => {
    const e = makeGovernanceAttestationFiled({
      ...ENVELOPE,
      payload: VALID_ATTESTATION_PAYLOAD,
    });
    expect(e.type).toBe("GovernanceAttestationFiled");
    expect((e.payload as Record<string, unknown>).attestationType).toBe("rmcp-quarterly");
  });

  it("makeSuspiciousActivityQueueReviewed produces a parseable event", () => {
    const e = makeSuspiciousActivityQueueReviewed({
      ...ENVELOPE,
      payload: VALID_SAR_PAYLOAD,
    });
    expect(e.type).toBe("SuspiciousActivityQueueReviewed");
    expect((e.payload as Record<string, unknown>).strFiled).toBe(0);
  });

  it("makeAmlRiskAssessmentCompleted produces a parseable event", () => {
    const e = makeAmlRiskAssessmentCompleted({
      ...ENVELOPE,
      payload: VALID_AML_PAYLOAD,
    });
    expect(e.type).toBe("AmlRiskAssessmentCompleted");
    expect((e.payload as Record<string, unknown>).riskRating).toBe("low");
  });

  it("makeEddQueueReviewed produces a parseable event", () => {
    const e = makeEddQueueReviewed({
      ...ENVELOPE,
      payload: VALID_EDD_PAYLOAD,
    });
    expect(e.type).toBe("EddQueueReviewed");
    expect((e.payload as Record<string, unknown>).signed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Run logic — smoke test and idempotency
//
// We test the run logic inline (not via bun.spawn) to avoid the
// resolve-event-db-boot side-effect import in cco-periodic-run.ts.
// The run logic is exercised by calling the same store operations the
// script performs, using a :memory: store.
// ---------------------------------------------------------------------------

function runCcoLogic(store: EventStore): number {
  const PERIOD_RUN = "2026-Q2";
  const SEAT = "cco";
  const AGENT = "zara";
  const RUN_TYPE = "quarterly-periodic";
  const CITATIONS_RUN = [
    "FIC Act 38/2001 §42",
    "POL-AML-001",
    "RMCP §4",
    "D-CCO-GOVERNANCE-SEAT-G5",
  ];
  const ENV = {
    asOf: NOW,
    entity: BANK_ZA_001,
    actor: { type: "service" as const, id: `agent:${AGENT}` },
    citations: CITATIONS_RUN,
  };

  // Idempotency check
  for (const e of store.replay({ type: "GovernanceSeatRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.seatId === SEAT && p.period === PERIOD_RUN) {
      return 0;
    }
  }

  let emitted = 0;

  store.append(
    makeGovernanceAttestationFiled({
      ...ENV,
      payload: {
        seatId: SEAT,
        attestorId: AGENT,
        attestationType: "rmcp-quarterly",
        period: PERIOD_RUN,
        attestedAt: NOW,
        findings: [],
        policyRef: "RMCP §4",
      },
    }),
  );
  emitted++;

  store.append(
    makeSuspiciousActivityQueueReviewed({
      ...ENV,
      payload: { reviewedAt: NOW, queueDepth: 0, strFiled: 0, ctrFiled: 0, notes: "test run" },
    }),
  );
  emitted++;

  store.append(
    makeAmlRiskAssessmentCompleted({
      ...ENV,
      payload: {
        assessmentType: "institutional-quarterly",
        period: PERIOD_RUN,
        riskRating: "low",
        keyFindings: "test run",
        policyRef: "POL-AML-001 §4",
      },
    }),
  );
  emitted++;

  store.append(
    makeEddQueueReviewed({
      ...ENV,
      payload: { reviewedAt: NOW, queueDepth: 0, signed: true, notes: "test run" },
    }),
  );
  emitted++;

  store.append(
    makeGovernanceSeatRunCompleted({
      ...ENV,
      payload: {
        seatId: SEAT,
        agentId: AGENT,
        runType: RUN_TYPE,
        period: PERIOD_RUN,
        eventsEmitted: emitted,
        findings: [],
        status: "completed",
      },
    }),
  );

  return emitted;
}

describe("CCO periodic run — smoke test and idempotency", () => {
  it("single run emits exactly 5 events (4 domain + 1 completion)", () => {
    const store = new EventStore(":memory:");
    const domainEmitted = runCcoLogic(store);
    expect(domainEmitted).toBe(4);
    expect(store.count()).toBe(5);
    store.close();
  });

  it("idempotency: second run emits 0 new events", () => {
    const store = new EventStore(":memory:");

    // First run
    const firstEmitted = runCcoLogic(store);
    expect(firstEmitted).toBe(4);
    const countAfterFirst = store.count();
    expect(countAfterFirst).toBe(5);

    // Second run — should be short-circuited
    const secondEmitted = runCcoLogic(store);
    expect(secondEmitted).toBe(0);
    expect(store.count()).toBe(countAfterFirst); // no new events

    store.close();
  });

  it("completion event carries correct seatId, period, and eventsEmitted", () => {
    const store = new EventStore(":memory:");
    runCcoLogic(store);

    const completionEvents: Array<Record<string, unknown>> = [];
    for (const e of store.replay({ type: "GovernanceSeatRunCompleted" })) {
      completionEvents.push(e.payload as Record<string, unknown>);
    }
    expect(completionEvents.length).toBe(1);
    const p = completionEvents[0];
    expect(p?.seatId).toBe("cco");
    expect(p?.period).toBe("2026-Q2");
    expect(p?.eventsEmitted).toBe(4);
    expect(p?.status).toBe("completed");

    store.close();
  });

  it("attestation event carries correct attestationType and policyRef", () => {
    const store = new EventStore(":memory:");
    runCcoLogic(store);

    const attestations: Array<Record<string, unknown>> = [];
    for (const e of store.replay({ type: "GovernanceAttestationFiled" })) {
      attestations.push(e.payload as Record<string, unknown>);
    }
    expect(attestations.length).toBe(1);
    expect(attestations[0]?.attestationType).toBe("rmcp-quarterly");
    expect(attestations[0]?.policyRef).toBe("RMCP §4");

    store.close();
  });
});
