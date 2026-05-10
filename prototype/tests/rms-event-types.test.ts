// tests/rms-event-types.test.ts
//
// D-RMS-PHASE-1 Slice 2 — exit-criterion test for the seven RMS event types.
//
// Asserts:
//   - All seven RMS event types are registered in EVENT_TYPE_REGISTRY.
//   - Each carries a typed Zod payload schema.
//   - Each carries retention metadata (D-EVENT-STORE-SCALING Slice 1 binding).
//   - The typed Zod schemas accept canonical payloads (positive parse).
//   - The typed Zod schemas reject boundary violations (negative parse).
//   - The S8/RMS overlap disposition holds: the seven RMS types do not
//     collide with the S8 runtime primitives.
//
// Authority: D-RMS-PHASE-1 (CEO approved 2026-05-09); slice authorisation
//            D-RMS-PHASE-1-SLICE-2.
// Source spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  agentBriefIssuedPayloadSchema,
  agentRunCompletedPayloadSchema,
  agentRunStartedPayloadSchema,
  briefSupersededPayloadSchema,
  ceoDecisionRmsExtendedPayloadSchema,
  decisionRequestedPayloadSchema,
  feedbackPayloadSchema,
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
  makeBriefSuperseded,
  makeDecisionRequested,
  makeFeedback,
  makeRecordFiled,
  recordFiledPayloadSchema,
} from "../platform/event-store/event-types";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";

const RMS_EVENT_NAMES = [
  "AgentBriefIssued",
  "AgentRunStarted",
  "AgentRunCompleted",
  "DecisionRequested",
  "Feedback",
  "BriefSuperseded",
  "RecordFiled",
] as const;

// S8 owns these; RMS must not collide. See Scrooge ruling, 2026-05-10.
const S8_RUNTIME_PRIMITIVES = [
  "AgentRegistered",
  "AgentRetired",
  "IdentityKeyRotated",
  "PermissionPolicyPublished",
  "AgentDecision",
  "AgentEscalation",
  "AgentEscalationAcknowledged",
  "AgentEscalationDecided",
  "AgentEscalationDelegated",
  "AgentEscalationOverdue",
] as const;

const ENVELOPE = {
  asOf: "2026-05-10T12:00:00Z",
  entity: "BANK-ZA-001",
  actor: { type: "service" as const, id: "agent:Atlas" },
  citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
};

const SAMPLE_HASH = `blake3:${"0".repeat(64)}`;
const OTHER_HASH = `blake3:${"1".repeat(64)}`;

const SCROOGE_REF = {
  name: "Scrooge",
  position: "Chief of Staff / Orchestrator",
};

const ATLAS_REF = {
  name: "Atlas",
  position: "Core banking platform architect, engineering",
};

const OWEN_REF = {
  name: "Owen",
  position: "Company Secretary, governance",
};

describe("D-RMS-PHASE-1 Slice 2 — registry coverage", () => {
  it("all seven RMS event types are registered in EVENT_TYPE_REGISTRY", () => {
    const missing = RMS_EVENT_NAMES.filter((t) => !lookupEventType(t));
    expect(missing).toEqual([]);
  });

  it("each RMS event type carries a typed Zod payload schema", () => {
    for (const name of RMS_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta).toBeDefined();
      expect(meta?.payloadSchema).toBeDefined();
    }
  });

  it("each RMS event type carries retention metadata (D-EVENT-STORE-SCALING binding)", () => {
    for (const name of RMS_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta?.retention).toBeDefined();
      expect(meta?.retention.minimumYears).toBeGreaterThanOrEqual(1);
      expect(meta?.retention.citationRef.length).toBeGreaterThan(0);
    }
  });

  it("S8/RMS overlap disposition holds — the seven RMS types do not collide with S8 primitives", () => {
    const collisions = RMS_EVENT_NAMES.filter((n) =>
      (S8_RUNTIME_PRIMITIVES as readonly string[]).includes(n),
    );
    expect(collisions).toEqual([]);
  });

  it("registry has exactly one row per RMS event type (no duplicates)", () => {
    for (const name of RMS_EVENT_NAMES) {
      const matches = EVENT_TYPE_REGISTRY.filter((m) => m.type === name);
      expect(matches.length).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Per-type schema tests — positive parse + boundary rejection.
// ---------------------------------------------------------------------------

describe("AgentBriefIssued — Zod schema", () => {
  const goodPayload = {
    briefId: "brief:atlas:rms-slice-2",
    issuedTo: ATLAS_REF,
    issuedBy: SCROOGE_REF,
    title: "Build RMS Slice 2 — event types + record helpers",
    directiveDocumentHash: SAMPLE_HASH,
    priority: "now" as const,
    expectedOutputs: [
      { kind: "deliverable-document" as const, description: "Decision record" },
      { kind: "code-pr" as const, description: "PR against main" },
    ],
  };

  it("accepts a valid payload", () => {
    expect(() => agentBriefIssuedPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("rejects malformed directiveDocumentHash", () => {
    expect(() =>
      agentBriefIssuedPayloadSchema.parse({ ...goodPayload, directiveDocumentHash: "not-a-hash" }),
    ).toThrow();
  });

  it("rejects empty expectedOutputs (briefs must declare what they target)", () => {
    expect(() =>
      agentBriefIssuedPayloadSchema.parse({ ...goodPayload, expectedOutputs: [] }),
    ).toThrow();
  });

  it("rejects an issuedTo without `position` (identity-discipline rule)", () => {
    expect(() =>
      agentBriefIssuedPayloadSchema.parse({
        ...goodPayload,
        issuedTo: { name: "Atlas" },
      }),
    ).toThrow();
  });

  it("makeAgentBriefIssued produces a valid Event", () => {
    const ev = makeAgentBriefIssued({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("AgentBriefIssued");
    expect(ev.event_id.length).toBeGreaterThan(0);
  });
});

describe("AgentRunStarted — Zod schema", () => {
  const goodPayload = {
    runId: "run:atlas:2026-05-10T12:00:00Z:abc",
    briefId: "brief:atlas:rms-slice-2",
    agent: ATLAS_REF,
    startedAt: "2026-05-10T12:00:00Z",
    substrate: "scrooge-coordinated-in-session" as const,
    worktree: "/tmp/worktree",
  };

  it("accepts a valid payload", () => {
    expect(() => agentRunStartedPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("rejects an unknown substrate value", () => {
    expect(() =>
      agentRunStartedPayloadSchema.parse({ ...goodPayload, substrate: "magic" }),
    ).toThrow();
  });

  it("makeAgentRunStarted produces a valid Event", () => {
    const ev = makeAgentRunStarted({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("AgentRunStarted");
  });
});

describe("AgentRunCompleted — Zod schema", () => {
  const goodPayload = {
    runId: "run:atlas:2026-05-10T12:00:00Z:abc",
    briefId: "brief:atlas:rms-slice-2",
    agent: ATLAS_REF,
    completedAt: "2026-05-10T13:00:00Z",
    outcome: "delivered" as const,
    deliverableDocumentHashes: [SAMPLE_HASH, OTHER_HASH],
    substrateGapsSurfaced: ["Slice 3 projection runtime not yet built"],
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    followOnRoutes: [
      { kind: "agent" as const, target: "Vera", directive: "Recon the new event types" },
    ],
  };

  it("accepts a valid payload", () => {
    expect(() => agentRunCompletedPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("rejects an unknown outcome", () => {
    expect(() =>
      agentRunCompletedPayloadSchema.parse({ ...goodPayload, outcome: "stalled" }),
    ).toThrow();
  });

  it("rejects malformed deliverable hashes", () => {
    expect(() =>
      agentRunCompletedPayloadSchema.parse({
        ...goodPayload,
        deliverableDocumentHashes: ["sha1:abc"],
      }),
    ).toThrow();
  });

  it("accepts an empty deliverableDocumentHashes (withdrawn run)", () => {
    expect(() =>
      agentRunCompletedPayloadSchema.parse({
        ...goodPayload,
        outcome: "withdrawn" as const,
        deliverableDocumentHashes: [],
      }),
    ).not.toThrow();
  });

  it("makeAgentRunCompleted produces a valid Event", () => {
    const ev = makeAgentRunCompleted({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("AgentRunCompleted");
  });
});

describe("DecisionRequested — Zod schema", () => {
  const goodPayload = {
    decisionId: "D-EXAMPLE",
    title: "Should we adopt X?",
    category: "near-term" as const,
    owner: ATLAS_REF,
    forActor: "CEO" as const,
    decisionForActor: "Approve / defer / modify the X proposal.",
    recommendation: { stance: "approve", reasoning: "Y" },
    sourceDocumentHashes: [SAMPLE_HASH],
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
  };

  it("accepts a valid payload", () => {
    expect(() => decisionRequestedPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("rejects an empty decisionForActor (the question must be present)", () => {
    expect(() =>
      decisionRequestedPayloadSchema.parse({ ...goodPayload, decisionForActor: "" }),
    ).toThrow();
  });

  it("rejects an unknown category", () => {
    expect(() =>
      decisionRequestedPayloadSchema.parse({ ...goodPayload, category: "bogus" }),
    ).toThrow();
  });

  it("makeDecisionRequested produces a valid Event", () => {
    const ev = makeDecisionRequested({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("DecisionRequested");
  });
});

describe("Feedback — Zod schema", () => {
  const goodPayload = {
    feedbackId: "feedback:marc:2026-05-10",
    from: { actor: "CEO" as const, identity: "human:marc@tgv.co.za" },
    channel: "chat" as const,
    intakeAt: "2026-05-10T12:00:00Z",
    subject: { kind: "brief" as const, ref: "brief:atlas:rms-slice-2" },
    body: "Looks good, ship it.",
    classifications: ["directive" as const],
  };

  it("accepts a valid payload", () => {
    expect(() => feedbackPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("requires at least one classification", () => {
    expect(() => feedbackPayloadSchema.parse({ ...goodPayload, classifications: [] })).toThrow();
  });

  it("rejects an unknown channel", () => {
    expect(() => feedbackPayloadSchema.parse({ ...goodPayload, channel: "telepathy" })).toThrow();
  });

  it("makeFeedback produces a valid Event", () => {
    const ev = makeFeedback({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("Feedback");
  });
});

describe("BriefSuperseded — Zod schema", () => {
  const goodPayload = {
    originalBriefId: "brief:atlas:old",
    supersededBy: "brief:atlas:new",
    reason: "scope-changed" as const,
    authorisedBy: SCROOGE_REF,
  };

  it("accepts a valid payload", () => {
    expect(() => briefSupersededPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("rejects an unknown reason", () => {
    expect(() =>
      briefSupersededPayloadSchema.parse({ ...goodPayload, reason: "i-felt-like-it" }),
    ).toThrow();
  });

  it("makeBriefSuperseded produces a valid Event", () => {
    const ev = makeBriefSuperseded({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("BriefSuperseded");
  });
});

describe("RecordFiled — Zod schema", () => {
  const goodPayload = {
    recordId: "record:decisions:D-RMS-PHASE-1-SLICE-2",
    registerKey: "decisions" as const,
    documentHash: SAMPLE_HASH,
    classification: "ceo-only" as const,
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "archive" as const,
    },
  };

  it("accepts a valid payload", () => {
    expect(() => recordFiledPayloadSchema.parse(goodPayload)).not.toThrow();
  });

  it("rejects a non-positive retention.minimumYears", () => {
    expect(() =>
      recordFiledPayloadSchema.parse({
        ...goodPayload,
        retention: { ...goodPayload.retention, minimumYears: 0 },
      }),
    ).toThrow();
  });

  it("rejects an unknown registerKey", () => {
    expect(() =>
      recordFiledPayloadSchema.parse({ ...goodPayload, registerKey: "phantoms" }),
    ).toThrow();
  });

  it("rejects an unknown classification", () => {
    expect(() =>
      recordFiledPayloadSchema.parse({ ...goodPayload, classification: "marc-only" }),
    ).toThrow();
  });

  it("makeRecordFiled produces a valid Event", () => {
    const ev = makeRecordFiled({ ...ENVELOPE, payload: goodPayload });
    expect(ev.type).toBe("RecordFiled");
  });
});

// ---------------------------------------------------------------------------
// CeoDecision RMS extension — backwards-compatible additive surface.
// ---------------------------------------------------------------------------

describe("CeoDecision — RMS additive extension", () => {
  it("accepts a legacy-shape payload (no RMS fields)", () => {
    expect(() =>
      ceoDecisionRmsExtendedPayloadSchema.parse({
        decisionId: "D-LEGACY",
        action: "approve",
        title: "Legacy decision",
        outcome: "approved",
        recordedVia: "cli:bun-run",
      }),
    ).not.toThrow();
  });

  it("accepts a payload with the new optional fields populated", () => {
    expect(() =>
      ceoDecisionRmsExtendedPayloadSchema.parse({
        decisionId: "D-NEW",
        action: "modify",
        title: "RMS-aware decision",
        outcome: "modified",
        recordedVia: "cli:bun-run",
        requestEventId: "ev_abc123",
        recordDocumentHashes: [SAMPLE_HASH],
        modifiedRecommendation: { stance: "modify", reasoning: "Adjusted for risk." },
      }),
    ).not.toThrow();
  });

  it("rejects an invalid action", () => {
    expect(() =>
      ceoDecisionRmsExtendedPayloadSchema.parse({
        decisionId: "D-X",
        action: "veto",
        title: "T",
        outcome: "O",
        recordedVia: "cli",
      }),
    ).toThrow();
  });

  it("rejects malformed recordDocumentHashes", () => {
    expect(() =>
      ceoDecisionRmsExtendedPayloadSchema.parse({
        decisionId: "D-X",
        action: "approve",
        title: "T",
        outcome: "O",
        recordedVia: "cli",
        recordDocumentHashes: ["sha256:abc"],
      }),
    ).toThrow();
  });
});

// Quick sanity: exhaustive use of the OWEN_REF / SCROOGE_REF constants so
// they don't drift to dead code if helpers stop using them.
describe("Sanity — agent ref constants exercised", () => {
  it("OWEN_REF carries name + position", () => {
    expect(OWEN_REF.name).toBe("Owen");
    expect(OWEN_REF.position.length).toBeGreaterThan(0);
  });
});
