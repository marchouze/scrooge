// tests/substrate-agent-runner-lifecycle.test.ts
//
// Tests for the substrate-runner lifecycle wrapper landed under S8 /
// D-AGENT-RUNTIME-AUTHORIZE. Asserts:
//
//   1. The three new typed event schemas (`SubstrateAgentRunStarted`,
//      `SubstrateAgentRunCompleted`, `SubstrateAgentRunFailed`) parse
//      well-formed payloads and reject ill-formed ones.
//   2. `runId` shape is enforced — the regex matches what the runner
//      mints.
//   3. The substrate-runner actor is on the legacy-bypass list so
//      lifecycle events append cleanly when no permission policy is
//      published yet (T-01 mitigation).
//   4. The S8/RMS overlap disposition continues to hold — the new
//      `Substrate*` types do not collide with RMS or with the original
//      S8 primitives.
//   5. Permission gate authorises the substrate-runner actor for these
//      event types via the legacy-bypass path.
//
// The end-to-end test of `runAgent` itself is integration-shaped and
// would couple this file to handler implementations; we cover the
// behaviour with focused unit tests on the makers + the gate, which is
// where the slice's contracts live. Vera's Wave-4 #13 inactivity-SLA
// recon (planned) will provide the integration coverage — and that
// recon is itself enabled by this slice.
//
// Author: Atlas (S8 substrate-runner lifecycle)

import { describe, expect, it } from "bun:test";

import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import {
  makeSubstrateAgentRunCompleted,
  makeSubstrateAgentRunFailed,
  makeSubstrateAgentRunStarted,
  substrateAgentRunCompletedPayloadSchema,
  substrateAgentRunFailedPayloadSchema,
  substrateAgentRunStartedPayloadSchema,
} from "../platform/event-store/event-types";
import {
  LEGACY_PRE_A1_EVENT_TYPES,
  decideAppend,
  gateEventStore,
  isGateEnabled,
} from "../platform/event-store/permission-gate";
import { lookupEventType } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";
import type { Actor, Event } from "../platform/event-store/types";

const ENVELOPE = {
  asOf: "2026-05-10T12:00:00.000Z",
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service" as const, id: "agent:atlas:substrate-runner" } satisfies Actor,
  citations: ["GOV-FRAMEWORK-CEO-RESERVED", "D-AGENT-RUNTIME-AUTHORIZE"],
};

const RUN_ID = "run:atlas:2026-05-10T120000000Z:deadbeef";

const STARTED_GOOD = {
  runId: RUN_ID,
  agent: "Atlas",
  trigger: { kind: "scheduled" as const, id: "substrate-state-check" },
  startedAt: "2026-05-10T12:00:00.000Z",
  dryRun: false,
  substrate: "agent-runtime" as const,
  sequenceAtStart: 42,
};

const COMPLETED_GOOD = {
  runId: RUN_ID,
  agent: "Atlas",
  completedAt: "2026-05-10T12:00:01.500Z",
  durationMs: 1500,
  ok: true,
  eventsEmitted: 3,
  decisionsEmitted: 1,
  escalationsEmitted: 0,
  sequenceAtCompletion: 45,
  deliverable: "Owner Inbox/2026-05-10_atlas_assessment.md",
  summary: "Substrate state assessed; slice shipped",
};

const FAILED_GOOD = {
  runId: RUN_ID,
  agent: "Atlas",
  failedAt: "2026-05-10T12:00:02.000Z",
  durationMs: 2000,
  errorClass: "exception" as const,
  errorMessage: "handler threw: ENOENT — /tmp/missing.txt",
  sequenceAtFailure: 43,
};

describe("Substrate-runner lifecycle — payload schema parse", () => {
  describe("SubstrateAgentRunStarted", () => {
    it("accepts a well-formed payload", () => {
      expect(() => substrateAgentRunStartedPayloadSchema.parse(STARTED_GOOD)).not.toThrow();
    });

    it("rejects an empty agent", () => {
      expect(() =>
        substrateAgentRunStartedPayloadSchema.parse({ ...STARTED_GOOD, agent: "" }),
      ).toThrow();
    });

    it("rejects a malformed runId", () => {
      expect(() =>
        substrateAgentRunStartedPayloadSchema.parse({
          ...STARTED_GOOD,
          runId: "not-a-run-id",
        }),
      ).toThrow();
    });

    it("rejects an unknown trigger kind", () => {
      expect(() =>
        substrateAgentRunStartedPayloadSchema.parse({
          ...STARTED_GOOD,
          // biome-ignore lint/suspicious/noExplicitAny: deliberate runtime-enforcement probe — Zod must reject unknown trigger.kind even when TS type is bypassed
          trigger: { kind: "wallclock" as any, id: "x" },
        }),
      ).toThrow();
    });

    it("rejects a negative sequenceAtStart", () => {
      expect(() =>
        substrateAgentRunStartedPayloadSchema.parse({ ...STARTED_GOOD, sequenceAtStart: -1 }),
      ).toThrow();
    });

    it("rejects an unknown substrate enum value", () => {
      expect(() =>
        substrateAgentRunStartedPayloadSchema.parse({
          ...STARTED_GOOD,
          // biome-ignore lint/suspicious/noExplicitAny: deliberate runtime-enforcement probe — Zod must reject unknown substrate even when TS type is bypassed
          substrate: "azure-functions" as any,
        }),
      ).toThrow();
    });
  });

  describe("SubstrateAgentRunCompleted", () => {
    it("accepts a well-formed payload", () => {
      expect(() => substrateAgentRunCompletedPayloadSchema.parse(COMPLETED_GOOD)).not.toThrow();
    });

    it("accepts a payload without the optional deliverable", () => {
      const noDeliverable = { ...COMPLETED_GOOD };
      // biome-ignore lint/performance/noDelete: explicit absence
      delete (noDeliverable as { deliverable?: string }).deliverable;
      expect(() => substrateAgentRunCompletedPayloadSchema.parse(noDeliverable)).not.toThrow();
    });

    it("rejects negative duration", () => {
      expect(() =>
        substrateAgentRunCompletedPayloadSchema.parse({ ...COMPLETED_GOOD, durationMs: -5 }),
      ).toThrow();
    });

    it("rejects negative escalation / decision counts", () => {
      expect(() =>
        substrateAgentRunCompletedPayloadSchema.parse({
          ...COMPLETED_GOOD,
          escalationsEmitted: -1,
        }),
      ).toThrow();
    });

    it("rejects an empty summary", () => {
      expect(() =>
        substrateAgentRunCompletedPayloadSchema.parse({ ...COMPLETED_GOOD, summary: "" }),
      ).toThrow();
    });
  });

  describe("SubstrateAgentRunFailed", () => {
    it("accepts a well-formed payload", () => {
      expect(() => substrateAgentRunFailedPayloadSchema.parse(FAILED_GOOD)).not.toThrow();
    });

    it("rejects an unknown errorClass", () => {
      expect(() =>
        substrateAgentRunFailedPayloadSchema.parse({
          ...FAILED_GOOD,
          // biome-ignore lint/suspicious/noExplicitAny: deliberate runtime-enforcement probe — Zod must reject unknown errorClass even when TS type is bypassed
          errorClass: "panic" as any,
        }),
      ).toThrow();
    });

    it("rejects an over-long errorMessage", () => {
      expect(() =>
        substrateAgentRunFailedPayloadSchema.parse({
          ...FAILED_GOOD,
          errorMessage: "x".repeat(1025),
        }),
      ).toThrow();
    });

    it("rejects an empty errorMessage", () => {
      expect(() =>
        substrateAgentRunFailedPayloadSchema.parse({ ...FAILED_GOOD, errorMessage: "" }),
      ).toThrow();
    });
  });
});

describe("Substrate-runner lifecycle — event factories produce parsable Events", () => {
  it("makeSubstrateAgentRunStarted produces a typed Event with the right type", () => {
    const e = makeSubstrateAgentRunStarted({ ...ENVELOPE, payload: STARTED_GOOD });
    expect(e.type).toBe("SubstrateAgentRunStarted");
    expect(e.actor.id).toBe("agent:atlas:substrate-runner");
    expect((e.payload as { runId: string }).runId).toBe(RUN_ID);
  });

  it("makeSubstrateAgentRunCompleted produces a typed Event with the right type", () => {
    const e = makeSubstrateAgentRunCompleted({ ...ENVELOPE, payload: COMPLETED_GOOD });
    expect(e.type).toBe("SubstrateAgentRunCompleted");
    expect((e.payload as { ok: boolean }).ok).toBe(true);
  });

  it("makeSubstrateAgentRunFailed produces a typed Event with the right type", () => {
    const e = makeSubstrateAgentRunFailed({ ...ENVELOPE, payload: FAILED_GOOD });
    expect(e.type).toBe("SubstrateAgentRunFailed");
    expect((e.payload as { errorClass: string }).errorClass).toBe("exception");
  });
});

describe("Substrate-runner lifecycle — registry rows", () => {
  it("each new event type is registered with a payloadSchema", () => {
    for (const type of [
      "SubstrateAgentRunStarted",
      "SubstrateAgentRunCompleted",
      "SubstrateAgentRunFailed",
    ] as const) {
      const meta = lookupEventType(type);
      expect(meta).toBeDefined();
      expect(meta?.payloadSchema).toBeDefined();
      expect(meta?.class).toBe("runtime");
    }
  });

  it("SubstrateAgentRunFailed retains for 7y (incident-record norms)", () => {
    const meta = lookupEventType("SubstrateAgentRunFailed");
    expect(meta?.retention.minimumYears).toBeGreaterThanOrEqual(7);
  });
});

describe("Substrate-runner lifecycle — permission-gate compatibility", () => {
  it("legacy-bypass list includes the three new event types", () => {
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("SubstrateAgentRunStarted")).toBe(true);
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("SubstrateAgentRunCompleted")).toBe(true);
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("SubstrateAgentRunFailed")).toBe(true);
  });

  it("decideAppend allows the substrate-runner actor when no policy is published (legacy bypass)", () => {
    const tmp = new EventStore(":memory:");
    try {
      const policy = new LocalPermissionPolicyPublisher({ eventStore: tmp });
      const e = makeSubstrateAgentRunStarted({ ...ENVELOPE, payload: STARTED_GOOD });
      const decision = decideAppend({ event: e, policy });
      expect(decision.allowed).toBe(true);
      expect(decision.legacyBypass?.eventType).toBe("SubstrateAgentRunStarted");
      expect(decision.legacyBypass?.agentUrn).toBe("agent:atlas:substrate-runner");
    } finally {
      tmp.close();
    }
  });

  it("gated event store admits the lifecycle events end-to-end", () => {
    const tmp = new EventStore(":memory:");
    try {
      const policy = new LocalPermissionPolicyPublisher({ eventStore: tmp });
      const gated = gateEventStore({
        store: tmp,
        config: { policy, onDeny: () => {} },
      });
      gated.append(makeSubstrateAgentRunStarted({ ...ENVELOPE, payload: STARTED_GOOD }));
      gated.append(makeSubstrateAgentRunCompleted({ ...ENVELOPE, payload: COMPLETED_GOOD }));
      gated.append(makeSubstrateAgentRunFailed({ ...ENVELOPE, payload: FAILED_GOOD }));

      const types = new Set<string>();
      for (const e of gated.replay()) types.add(e.type);
      expect(types.has("SubstrateAgentRunStarted")).toBe(true);
      expect(types.has("SubstrateAgentRunCompleted")).toBe(true);
      expect(types.has("SubstrateAgentRunFailed")).toBe(true);

      // Sanity: the gate is the production default so we exercise the real path.
      // (We don't assert isGateEnabled() because env may have it disabled in
      // some local sessions — the gateEventStore wrapper is what we tested.)
      void isGateEnabled;
    } finally {
      tmp.close();
    }
  });

  it("substrate-runner actor is ALLOWED for a non-privileged event type with no policy (Option C allow-by-default)", () => {
    // D-T-01 Option C (CEO-approved 2026-05-12): internal service agents
    // (actor.type === "service", actor.id starts with "agent:") are
    // allow-by-default for non-privileged event types. The previous
    // deny-by-default posture for unrecognised types has been replaced by
    // a scoped relaxation that blocks only PRIVILEGED_EVENT_TYPES without
    // an explicit allow-list entry. This unblocks the goal-loop cohort.
    const tmp = new EventStore(":memory:");
    try {
      const policy = new LocalPermissionPolicyPublisher({ eventStore: tmp });
      const fakeEvent: Event = {
        event_id: "00000000-0000-0000-0000-000000000001",
        type: "ThisEventTypeIntentionallyNotInLegacyList",
        as_of: ENVELOPE.asOf,
        entity: ENVELOPE.entity,
        actor: ENVELOPE.actor,
        citations: [...ENVELOPE.citations],
        payload: {},
      };
      const decision = decideAppend({ event: fakeEvent, policy });
      // Non-privileged + no legacy entry + no policy → Option C allow-by-default
      expect(decision.allowed).toBe(true);
      expect(decision.legacyBypass).toBeUndefined();
    } finally {
      tmp.close();
    }
  });
});

describe("Substrate-runner lifecycle — runId shape", () => {
  // Mirror of the regex in event-types.ts substrateRunIdSchema. Keep in sync.
  const RUN_ID_RE = /^run:[a-z0-9-]+:[0-9TZ-]+:[a-z0-9]+$/;

  it("matches the runner's mint format", () => {
    expect(RUN_ID).toMatch(RUN_ID_RE);
    expect("run:vera:2026-05-10T120001234Z:abcd1234").toMatch(RUN_ID_RE);
    expect("run:helena-cro:2026-05-10T120001234Z:ff00").toMatch(RUN_ID_RE);
  });

  it("rejects ids missing the run: prefix", () => {
    expect("atlas:2026-05-10T120000000Z:deadbeef").not.toMatch(RUN_ID_RE);
  });

  it("rejects uppercase agent slugs", () => {
    expect("run:Atlas:2026-05-10T120000000Z:deadbeef").not.toMatch(RUN_ID_RE);
  });
});

describe("Substrate-runner lifecycle — S8/RMS overlap continues to hold", () => {
  // The S8/RMS overlap disposition (Scrooge ruling, 2026-05-10) names the
  // RMS-owned event types and the S8 primitives. The new Substrate*
  // primitives must not collide with either.
  const RMS_NAMES = [
    "AgentBriefIssued",
    "AgentRunStarted",
    "AgentRunCompleted",
    "DecisionRequested",
    "Feedback",
    "BriefSuperseded",
    "RecordFiled",
  ];
  const NEW_S8_LIFECYCLE = [
    "SubstrateAgentRunStarted",
    "SubstrateAgentRunCompleted",
    "SubstrateAgentRunFailed",
  ];

  it("new S8 lifecycle types do not collide with RMS event types", () => {
    const collisions = NEW_S8_LIFECYCLE.filter((n) => RMS_NAMES.includes(n));
    expect(collisions).toEqual([]);
  });

  it("new S8 lifecycle types are distinct from each other (no name reuse)", () => {
    expect(new Set(NEW_S8_LIFECYCLE).size).toBe(NEW_S8_LIFECYCLE.length);
  });
});
