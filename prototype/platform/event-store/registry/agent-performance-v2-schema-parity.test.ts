// platform/event-store/registry/agent-performance-v2-schema-parity.test.ts
//
// Schema-parity guard for the Bucket C PILOT agent-performance migration.
//
// The v2-core package re-declares the two migrated types' payload schemas
// (`v2-core/agent-performance/events.ts`) because it cannot import the V1 schemas
// across the no-v1-import boundary. This test is the anti-drift backstop
// (Charter cmd 3: no green by concealment / weakened assertions): for each
// re-declared type, a canonical sample that the AUTHORITATIVE V1 schema accepts
// MUST also be accepted by the v2 schema, and a payload the V1 schema REJECTS
// MUST also be rejected by the v2 schema. A drift that weakens the v2 copy
// (accepting something V1 rejects, or vice-versa) fails here.
//
// This test lives on the v1 side because only v1-side code may import BOTH the V1
// schemas (under platform/) and the v2 schemas (under v2-core/) — the
// no-v1-import boundary forbids the reverse, not this direction.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Brief: brief:atlas:bucket-c-pilot-agent-performance-domain-to-v2:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import * as v2 from "../../../v2-core/agent-performance/events";
import { AGENT_PERFORMANCE_REDECLARED_TYPES } from "../../../v2-core/agent-performance/events";
import * as perfV1 from "../event-types/performance";

interface Case {
  readonly name: string;
  readonly v1: { safeParse: (p: unknown) => { success: boolean } };
  readonly v2: { safeParse: (p: unknown) => { success: boolean } };
  readonly valid: Record<string, unknown>;
  readonly invalid: Record<string, unknown>;
}

const validEvaluation: Record<string, unknown> = {
  agentId: "atlas",
  evaluationPeriod: "2026-06-17",
  evaluatedBy: "urn:agent:sade",
  runMetrics: {
    runsStarted: 4,
    runsDelivered: 3,
    runsBlocked: 1,
    runsFailed: 0,
    deliveryRate: 0.75,
  },
  qualityMetrics: {
    auditFindingsRaised: 1,
    auditFindingsResolved: 1,
    ciViolations: 0,
    worktreeViolations: 0,
  },
  strategicMetrics: {
    decisionsAdvanced: ["D-BANK-WIDE-V2-MIGRATION"],
    workstreamsProgressed: ["WS-V2-MIGRATION-BUCKET-C"],
    complianceArtifacts: 2,
    prsMerged: 3,
  },
  scores: { delivery: 0.8, quality: 0.9, strategic: 0.7, overall: 0.82 },
  tier: "meets",
  narrative: {
    strengths: ["root-cause first"],
    areasForImprovement: ["faster scaffold-commit"],
    feedbackSummary: "Solid bucket-C pilot.",
  },
};

const cases: Case[] = [
  {
    name: "AgentPerformanceEvaluated",
    v1: perfV1.agentPerformanceEvaluatedPayloadSchema,
    v2: v2.agentPerformanceEvaluatedPayloadSchema,
    valid: validEvaluation,
    // deliveryRate must be in [0,1] — 1.5 rejected by both.
    invalid: {
      ...validEvaluation,
      runMetrics: { ...(validEvaluation.runMetrics as object), deliveryRate: 1.5 },
    },
  },
  {
    name: "AgentFeedbackIssued",
    v1: perfV1.agentFeedbackIssuedPayloadSchema,
    v2: v2.agentFeedbackIssuedPayloadSchema,
    valid: {
      agentId: "atlas",
      evaluationPeriod: "2026-06-17",
      evaluationEventId: "evt:eval:1",
      deliveredVia: "rms-event",
      feedbackText: "Keep the scaffold-commit cadence.",
      issuedBy: "urn:agent:sade",
    },
    // deliveredVia not in enum → rejected by both.
    invalid: {
      agentId: "atlas",
      evaluationPeriod: "2026-06-17",
      evaluationEventId: "evt:eval:1",
      deliveredVia: "carrier-pigeon",
      feedbackText: "x",
      issuedBy: "urn:agent:sade",
    },
  },
];

describe("agent-performance v2 schema parity (anti-drift)", () => {
  test("every re-declared agent-performance type has a parity case", () => {
    const covered = new Set(cases.map((c) => c.name));
    for (const type of AGENT_PERFORMANCE_REDECLARED_TYPES) {
      expect(covered.has(type)).toBe(true);
    }
    expect(cases.length).toBe(AGENT_PERFORMANCE_REDECLARED_TYPES.length);
  });

  for (const c of cases) {
    test(`${c.name}: V1 accepts ⇒ v2 accepts`, () => {
      expect(c.v1.safeParse(c.valid).success).toBe(true);
      expect(c.v2.safeParse(c.valid).success).toBe(true);
    });
    test(`${c.name}: V1 rejects ⇒ v2 rejects`, () => {
      expect(c.v1.safeParse(c.invalid).success).toBe(false);
      expect(c.v2.safeParse(c.invalid).success).toBe(false);
    });
  }
});
