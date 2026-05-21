// tests/event-types-f032-coverage.test.ts
//
// Schema round-trip + registry-row tests for the eight event types
// closed under the F-032 substrate-hygiene slice (2026-05-10):
//
//   - EquityTradeBooked, EquitySettlementInstructed,
//     EquityCorporateActionApplied (schemas in
//     platform/markets/cdm/equity.ts)
//   - FxTradeExecuted, FxSettlementInstructed (schemas in
//     platform/markets/cdm/fx.ts; net-additional registry rows landed
//     in this PR once the recon's factory scan widened)
//   - CdmBindingsRegenerated (platform/event-store/event-types-cdm.ts)
//   - MLROAttestation, AccountingReadinessSnapshot,
//     AgentOpsReadinessSnapshot (platform/event-store/
//     event-types-readiness-snapshots.ts)
//
// Each test asserts:
//   (1) the registry row exists with a payloadSchema attached;
//   (2) the make<Type> factory builds a valid Event the eventSchema
//       accepts;
//   (3) `validatePayload(type, eventPayload)` succeeds for the built
//       payload.
//
// Citations: P1-EVENTS-AS-TRUTH, Owner Inbox/2026-05-10_vera_codebase-
// quality-review.md (F-032).
//
// Author: Atlas

import { describe, expect, it } from "bun:test";

import { makeCdmBindingsRegenerated } from "../platform/event-store/event-types-cdm";
import {
  makeAccountingReadinessSnapshot,
  makeAgentOpsReadinessSnapshot,
  makeMLROAttestation,
} from "../platform/event-store/event-types-readiness-snapshots";
import { lookupEventType, validatePayload } from "../platform/event-store/registry";

describe("F-032 closed types — registry rows", () => {
  const closedTypes = [
    "EquityTradeBooked",
    "EquitySettlementInstructed",
    "EquityCorporateActionApplied",
    "FxTradeExecuted",
    "FxSettlementInstructed",
    "CdmBindingsRegenerated",
    "MLROAttestation",
    "AccountingReadinessSnapshot",
    "AgentOpsReadinessSnapshot",
  ];

  it("every closed type has a registry row with a payloadSchema", () => {
    for (const type of closedTypes) {
      const row = lookupEventType(type);
      expect({ type, hasRow: !!row }).toEqual({ type, hasRow: true });
      expect({ type, hasSchema: !!row?.payloadSchema }).toEqual({ type, hasSchema: true });
    }
  });
});

describe("F-032 closed types — schema round-trips", () => {
  const actor = { type: "service" as const, id: "agent:test:f032" };
  const baseEnvelope = {
    asOf: "2026-05-10T12:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor,
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
  };

  it("CdmBindingsRegenerated builds + validates", () => {
    const e = makeCdmBindingsRegenerated({
      ...baseEnvelope,
      payload: {
        primitiveCount: 6,
        equityEventTypeCount: 3,
        registeredEventTypes: ["EquityTradeBooked"],
        selfTestPassed: true,
        runTrigger: "test:cdm",
      },
    });
    expect(e.type).toBe("CdmBindingsRegenerated");
    expect(() => validatePayload(e.type, e.payload as Record<string, unknown>)).not.toThrow();
  });

  it("MLROAttestation builds + validates", () => {
    const e = makeMLROAttestation({
      ...baseEnvelope,
      citations: ["FIC-ACT-38-2001"],
      payload: {
        zaraOwnedObligations: 10,
        obligationsInForce: 5,
        obligationsPartial: 1,
        obligationsPlanned: 2,
        obligationsDrafting: 1,
        obligationsNAyet: 1,
        miraSnapshotsLast7d: 0,
        miraCitationGatePassedLast7d: 1,
        miraCitationGateFailedLast7d: 0,
        miraAuditFindingsLast7d: 0,
        strCandidatesLast7d: 0,
        sanctionsHitsLast7d: 0,
        pepMatchesLast7d: 0,
        conductBreachesLast7d: 0,
        regulatorInquiriesLast7d: 0,
        rmcpVersionApproved: false,
        sanctionsListLastRefreshed: null,
        runTrigger: "test:mlro",
      },
    });
    expect(e.type).toBe("MLROAttestation");
    expect(() => validatePayload(e.type, e.payload as Record<string, unknown>)).not.toThrow();
  });

  it("AccountingReadinessSnapshot builds + validates", () => {
    const e = makeAccountingReadinessSnapshot({
      ...baseEnvelope,
      citations: ["COMPANIES-ACT-71-2008-S24"],
      payload: {
        cycleCount: 3,
        readinessReady: 1,
        readinessDrafting: 1,
        readinessSpecified: 1,
        readinessUnspecified: 0,
        beaOwnedObligations: 8,
        obligationsInForce: 4,
        obligationsPartial: 1,
        obligationsPlanned: 1,
        obligationsDrafting: 1,
        obligationsNAyet: 1,
        runTrigger: "test:bea",
      },
    });
    expect(e.type).toBe("AccountingReadinessSnapshot");
    expect(() => validatePayload(e.type, e.payload as Record<string, unknown>)).not.toThrow();
  });

  it("AgentOpsReadinessSnapshot builds + validates", () => {
    const e = makeAgentOpsReadinessSnapshot({
      ...baseEnvelope,
      payload: {
        registeredAgents: 27,
        latestRegistrationAsOf: "2026-05-09T12:00:00.000Z",
        sadeOwnedObligations: 5,
        obligationsInForce: 3,
        obligationsPartial: 0,
        obligationsPlanned: 1,
        obligationsDrafting: 1,
        obligationsNAyet: 0,
        runTrigger: "test:sade",
      },
    });
    expect(e.type).toBe("AgentOpsReadinessSnapshot");
    expect(() => validatePayload(e.type, e.payload as Record<string, unknown>)).not.toThrow();
  });

  // Equity + FX round-trip coverage lives in tests/cdm-fx.test.ts and the
  // M1 projection tests — those already exercise the makeEquity* and
  // makeFx* factories end-to-end. The presence + schema-attachment check
  // in `F-032 closed types — registry rows` above is sufficient gating.
});
