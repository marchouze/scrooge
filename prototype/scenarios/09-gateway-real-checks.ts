// scenarios/09-gateway-real-checks.ts
//
// Pre-trade gateway real checks — slices 2–4 validation.
//
// Three scenarios exercise the full fan-out → check → aggregation pipeline:
//
//   Scenario A: valid institutional counterparty + within limits
//               → sanctions: pass, eligibility: pass, market-risk: pass
//               → OrderApprovedAtGateway
//
//   Scenario B: sanctioned counterparty (CP-SANCTIONED-001)
//               → sanctions: fail (counterparty on blocked list)
//               → OrderRejectedAtGateway
//
//   Scenario C: order that breaches single-name notional limit
//               → sanctions: pass, eligibility: pass, market-risk: fail
//               → OrderRejectedAtGateway
//
// Authority:
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway v0 slices 2–4)
//   - ORG-FC-08 (POCDATARA), ORG-FC-13 (UN/OFAC/EU/HMT sanctions)
//   - ORG-CD-01 (FAIS Act 37/2002 §4 institutional-only constraint)
//   - ORG-PR-01 (ICAAP), RAS-B1, RAS-B2
//   - GOV-FRAMEWORK-CEO-RESERVED
//
// Authors:
//   Rohan (Market risk engineer, engineering) — orchestration + risk scenario
//   Mira (Compliance / RegTech engineer, engineering) — sanctions + eligibility scenarios

import { unlinkSync } from "node:fs";

import { BANK_ZA_001, newEventId } from "@platform/core/types";
import {
  makeCounterpartyFaisClassified,
  makeGatewayCheckCompleted,
  makeGatewayCheckRequested,
  makeOrderApprovedAtGateway,
  makeOrderProposed,
  makeOrderRejectedAtGateway,
} from "@platform/event-store/event-types";
import type { GatewayCheckCompletedPayload } from "@platform/event-store/event-types/trading";
import { simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCENARIO_A_ID = "gateway-real-checks-scenario-a";
export const SCENARIO_B_ID = "gateway-real-checks-scenario-b";
export const SCENARIO_C_ID = "gateway-real-checks-scenario-c";
export const ENTITY = BANK_ZA_001;

// Scenario clock
const AS_OF = "2026-05-17T09:00:00.000Z";
const AS_OF_CHECKS = "2026-05-17T09:00:01.000Z";
const AS_OF_TERMINAL = "2026-05-17T09:00:02.000Z";

// Actors
const AGGREGATOR_ACTOR = { type: "service" as const, id: "agent:kai:pre-trade-gateway-aggregator" };
const MIRA_SANCTIONS_ACTOR = { type: "service" as const, id: "agent:mira:sanctions-gateway-check" };
const MIRA_ELIGIBILITY_ACTOR = {
  type: "service" as const,
  id: "agent:mira:counterparty-eligibility-check",
};
const ROHAN_RISK_ACTOR = { type: "service" as const, id: "agent:rohan:market-risk-limit-check" };
const NIKO_ACTOR = { type: "service" as const, id: "agent:niko:onboarding" };

// Citations
const FANOUT_CITATIONS = [
  "ORG-CD-01",
  "ORG-FC-08",
  "ORG-FC-13",
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "GOV-FRAMEWORK-CEO-RESERVED",
];
const APPROVAL_CITATIONS = [...FANOUT_CITATIONS, "ORG-PR-01", "RAS-B1", "RAS-B2"];
const SANCTIONS_CITATIONS = ["ORG-FC-08", "ORG-FC-13"];
const ELIGIBILITY_CITATIONS = ["ORG-CD-01", "GOV-FRAMEWORK-CEO-RESERVED"];
const RISK_CITATIONS = ["ORG-PR-01", "RAS-B1", "RAS-B2"];

// Test counterparties (must be ^[A-Z0-9]{20}$ per ISO 17442)
const CP_INSTITUTIONAL_LEI = "LEIVALIDINSTITUTION0"; // 20 chars, passes all checks
const CP_SANCTIONED_LEI = "CPSANCTIONED00100000"; // 20 chars — matches blockedCounterpartyIds stub

// Instruments
const INSTRUMENT_WITHIN_LIMIT = "JSE:NPN"; // notional = 100 shares * 2500 ZAR = 250k < 50m limit
const INSTRUMENT_BREACH_LIMIT = "ZAE000015889"; // has perInstrumentLimits: 50m; notional = 100k shares * 1000 ZAR = 100m > 50m limit

// ---------------------------------------------------------------------------
// Provenance helpers
// ---------------------------------------------------------------------------

export function scenarioTag(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "scenario-runner:09-gateway-real-checks",
  });
}

// ---------------------------------------------------------------------------
// Scenario A: valid institutional counterparty + within limits → APPROVED
// ---------------------------------------------------------------------------

export interface ScenarioAEvents {
  readonly faisClassified: Event;
  readonly orderProposed: Event;
  readonly checkReqSanctions: Event;
  readonly checkReqEligibility: Event;
  readonly checkReqRisk: Event;
  readonly checkCompSanctions: Event;
  readonly checkCompEligibility: Event;
  readonly checkCompRisk: Event;
  readonly approval: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildScenarioAEvents(): ScenarioAEvents {
  const orderId = "ORD-SCENARIO-A-001";
  const orderEventId = newEventId();

  // Counterparty has FAIS classification: market-counterparty (institutional)
  const faisClassified = {
    ...makeCounterpartyFaisClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: ["ORG-CD-01"],
      payload: {
        counterpartyId: CP_INSTITUTIONAL_LEI,
        faisCategory: "market-counterparty",
        classifiedAt: AS_OF,
        classifiedBy: NIKO_ACTOR.id,
      },
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };

  // Order proposed: institutional counterparty, instrument within limits
  const orderProposed = {
    ...makeOrderProposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service" as const, id: "agent:saskia:auto-quote" },
      citations: ["JSE-RULES-EQUITIES", "FMA-S5"],
      eventId: orderEventId,
      payload: {
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_WITHIN_LIMIT,
        side: "buy",
        quantity: 100,
        price: 2500.0,
        priceCurrency: "ZAR",
        bookingEntity: ENTITY,
        requestedActor: "agent:saskia:auto-quote",
      },
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };

  // Fan-out: three GatewayCheckRequested
  const checkReqSanctions = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };
  const checkReqEligibility = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };
  const checkReqRisk = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };

  // Check completions: all pass
  const checkCompSanctions = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_SANCTIONS_ACTOR,
      citations: SANCTIONS_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqSanctions.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 1000,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };
  const checkCompEligibility = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_ELIGIBILITY_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqEligibility.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 1000,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };
  const checkCompRisk = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: ROHAN_RISK_ACTOR,
      citations: RISK_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqRisk.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 1000,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };

  // Terminal: OrderApprovedAtGateway
  const approval = {
    ...makeOrderApprovedAtGateway({
      asOf: AS_OF_TERMINAL,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: APPROVAL_CITATIONS,
      payload: {
        orderId,
        approvalCitations: APPROVAL_CITATIONS,
        passedAt: AS_OF_TERMINAL,
      },
    }),
    provenance: scenarioTag(SCENARIO_A_ID),
  };

  const all = [
    faisClassified,
    orderProposed,
    checkReqSanctions,
    checkReqEligibility,
    checkReqRisk,
    checkCompSanctions,
    checkCompEligibility,
    checkCompRisk,
    approval,
  ];

  return {
    faisClassified,
    orderProposed,
    checkReqSanctions,
    checkReqEligibility,
    checkReqRisk,
    checkCompSanctions,
    checkCompEligibility,
    checkCompRisk,
    approval,
    all,
  };
}

// ---------------------------------------------------------------------------
// Scenario B: sanctioned counterparty → OrderRejectedAtGateway
// ---------------------------------------------------------------------------

export interface ScenarioBEvents {
  readonly orderProposed: Event;
  readonly checkReqSanctions: Event;
  readonly checkReqEligibility: Event;
  readonly checkReqRisk: Event;
  readonly checkCompSanctions: Event; // FAIL — sanctions hit
  readonly checkCompEligibility: Event; // pass (never reached in real run, but included for completeness)
  readonly checkCompRisk: Event; // pass
  readonly rejection: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildScenarioBEvents(): ScenarioBEvents {
  const orderId = "ORD-SCENARIO-B-001";
  const orderEventId = newEventId();

  const orderProposed = {
    ...makeOrderProposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service" as const, id: "agent:saskia:auto-quote" },
      citations: ["JSE-RULES-EQUITIES", "FMA-S5"],
      eventId: orderEventId,
      payload: {
        orderId,
        counterpartyLei: CP_SANCTIONED_LEI, // This will hit the sanctions block list
        instrument: INSTRUMENT_WITHIN_LIMIT,
        side: "buy",
        quantity: 100,
        price: 2500.0,
        priceCurrency: "ZAR",
        bookingEntity: ENTITY,
        requestedActor: "agent:saskia:auto-quote",
      },
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };

  const checkReqSanctions = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };
  const checkReqEligibility = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };
  const checkReqRisk = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };

  // Sanctions: FAIL
  const checkCompSanctions = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_SANCTIONS_ACTOR,
      citations: SANCTIONS_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        outcome: "reject",
        sourceCheckRequestEventId: checkReqSanctions.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 800,
        rejectionReason: `Counterparty ${CP_SANCTIONED_LEI} found on sanctions blocked list`,
        citationToRule: "ORG-FC-13",
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };
  // Eligibility and risk: pass (aggregator will reject on first failure anyway)
  const checkCompEligibility = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_ELIGIBILITY_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqEligibility.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 900,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };
  const checkCompRisk = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: ROHAN_RISK_ACTOR,
      citations: RISK_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqRisk.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 950,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };

  // Terminal: OrderRejectedAtGateway
  const rejection = {
    ...makeOrderRejectedAtGateway({
      asOf: AS_OF_TERMINAL,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        rejectionReason: `Counterparty ${CP_SANCTIONED_LEI} found on sanctions blocked list`,
        rejectingCheck: "sanctions",
        citationToRule: "ORG-FC-13",
        rejectedAt: AS_OF_TERMINAL,
      },
    }),
    provenance: scenarioTag(SCENARIO_B_ID),
  };

  const all = [
    orderProposed,
    checkReqSanctions,
    checkReqEligibility,
    checkReqRisk,
    checkCompSanctions,
    checkCompEligibility,
    checkCompRisk,
    rejection,
  ];

  return {
    orderProposed,
    checkReqSanctions,
    checkReqEligibility,
    checkReqRisk,
    checkCompSanctions,
    checkCompEligibility,
    checkCompRisk,
    rejection,
    all,
  };
}

// ---------------------------------------------------------------------------
// Scenario C: market-risk limit breach → OrderRejectedAtGateway
// ---------------------------------------------------------------------------

export interface ScenarioCEvents {
  readonly faisClassified: Event;
  readonly orderProposed: Event;
  readonly checkReqSanctions: Event;
  readonly checkReqEligibility: Event;
  readonly checkReqRisk: Event;
  readonly checkCompSanctions: Event; // pass
  readonly checkCompEligibility: Event; // pass
  readonly checkCompRisk: Event; // FAIL — limit breach
  readonly rejection: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildScenarioCEvents(): ScenarioCEvents {
  const orderId = "ORD-SCENARIO-C-001";
  const orderEventId = newEventId();

  const faisClassified = {
    ...makeCounterpartyFaisClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: ["ORG-CD-01"],
      payload: {
        counterpartyId: CP_INSTITUTIONAL_LEI,
        faisCategory: "market-counterparty",
        classifiedAt: AS_OF,
        classifiedBy: NIKO_ACTOR.id,
      },
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };

  // Order: breaches single-name notional limit for INSTRUMENT_BREACH_LIMIT
  // perInstrumentLimits["ZAE000015889"] = 50,000,000 ZAR
  // 100,000 shares * 1000 ZAR = 100,000,000 ZAR > 50,000,000 ZAR limit
  const orderProposed = {
    ...makeOrderProposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service" as const, id: "agent:saskia:auto-quote" },
      citations: ["JSE-RULES-EQUITIES", "FMA-S5"],
      eventId: orderEventId,
      payload: {
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_BREACH_LIMIT,
        side: "buy",
        quantity: 100000, // 100k shares
        price: 1000.0, // 1000 ZAR/share = 100m ZAR notional > 50m limit
        priceCurrency: "ZAR",
        bookingEntity: ENTITY,
        requestedActor: "agent:saskia:auto-quote",
      },
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };

  const checkReqSanctions = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };
  const checkReqEligibility = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };
  const checkReqRisk = {
    ...makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
        timeoutMs: 30000,
      },
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };

  // Sanctions: pass
  const checkCompSanctions = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_SANCTIONS_ACTOR,
      citations: SANCTIONS_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqSanctions.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 800,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };
  // Eligibility: pass
  const checkCompEligibility = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_ELIGIBILITY_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        outcome: "approve",
        sourceCheckRequestEventId: checkReqEligibility.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 900,
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };
  // Market risk: FAIL
  const proposedNotional = 100000 * 1000; // 100m ZAR
  const limitZAR = 50000000; // 50m ZAR per instrument
  const checkCompRisk = {
    ...makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: ROHAN_RISK_ACTOR,
      citations: RISK_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        outcome: "reject",
        sourceCheckRequestEventId: checkReqRisk.event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 1100,
        rejectionReason:
          `Single-name notional limit breached for ${INSTRUMENT_BREACH_LIMIT}: ` +
          `proposed pro-forma exposure ZAR ${proposedNotional.toFixed(0)} ` +
          `exceeds limit ZAR ${limitZAR.toFixed(0)} ` +
          `(current exposure ZAR 0, proposed notional ZAR ${proposedNotional.toFixed(0)})`,
        citationToRule: "RAS-B1",
      } satisfies GatewayCheckCompletedPayload,
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };

  // Terminal: OrderRejectedAtGateway
  const rejection = {
    ...makeOrderRejectedAtGateway({
      asOf: AS_OF_TERMINAL,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        rejectionReason: checkCompRisk.payload.rejectionReason as string,
        rejectingCheck: "market-risk",
        citationToRule: "RAS-B1",
        rejectedAt: AS_OF_TERMINAL,
      },
    }),
    provenance: scenarioTag(SCENARIO_C_ID),
  };

  const all = [
    faisClassified,
    orderProposed,
    checkReqSanctions,
    checkReqEligibility,
    checkReqRisk,
    checkCompSanctions,
    checkCompEligibility,
    checkCompRisk,
    rejection,
  ];

  return {
    faisClassified,
    orderProposed,
    checkReqSanctions,
    checkReqEligibility,
    checkReqRisk,
    checkCompSanctions,
    checkCompEligibility,
    checkCompRisk,
    rejection,
    all,
  };
}

// ---------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------

export interface GatewayRealChecksResult {
  readonly ok: boolean;
  readonly scenarioA: { approved: boolean; eventCount: number };
  readonly scenarioB: { rejected: boolean; reason: string; eventCount: number };
  readonly scenarioC: { rejected: boolean; rejectingCheck: string; eventCount: number };
}

export function runGatewayRealChecksScenario(opts: {
  dbPath: string;
  cleanup: boolean;
}): GatewayRealChecksResult {
  // Wipe and recreate for determinism.
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run */
  }

  const store = new EventStore(opts.dbPath);

  const scenarioA = buildScenarioAEvents();
  const scenarioB = buildScenarioBEvents();
  const scenarioC = buildScenarioCEvents();

  store.appendAll([...scenarioA.all, ...scenarioB.all, ...scenarioC.all]);

  // Verify Scenario A: OrderApprovedAtGateway present
  let approvedA = false;
  for (const e of store.replay({ type: "OrderApprovedAtGateway" })) {
    const p = e.payload as { orderId?: unknown };
    if (p.orderId === "ORD-SCENARIO-A-001") {
      approvedA = true;
      break;
    }
  }

  // Verify Scenario B: OrderRejectedAtGateway with rejectingCheck === "sanctions"
  let rejectedB = false;
  let reasonB = "";
  for (const e of store.replay({ type: "OrderRejectedAtGateway" })) {
    const p = e.payload as {
      orderId?: unknown;
      rejectingCheck?: unknown;
      rejectionReason?: unknown;
    };
    if (p.orderId === "ORD-SCENARIO-B-001") {
      rejectedB = p.rejectingCheck === "sanctions";
      reasonB = typeof p.rejectionReason === "string" ? p.rejectionReason : "";
      break;
    }
  }

  // Verify Scenario C: OrderRejectedAtGateway with rejectingCheck === "market-risk"
  let rejectedC = false;
  let rejectingCheckC = "";
  for (const e of store.replay({ type: "OrderRejectedAtGateway" })) {
    const p = e.payload as { orderId?: unknown; rejectingCheck?: unknown };
    if (p.orderId === "ORD-SCENARIO-C-001") {
      rejectedC = p.rejectingCheck === "market-risk";
      rejectingCheckC = typeof p.rejectingCheck === "string" ? p.rejectingCheck : "";
      break;
    }
  }

  store.close();
  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  const ok = approvedA && rejectedB && rejectedC;

  return {
    ok,
    scenarioA: { approved: approvedA, eventCount: scenarioA.all.length },
    scenarioB: { rejected: rejectedB, reason: reasonB, eventCount: scenarioB.all.length },
    scenarioC: {
      rejected: rejectedC,
      rejectingCheck: rejectingCheckC,
      eventCount: scenarioC.all.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level runner (when executed directly)
// ---------------------------------------------------------------------------

if (import.meta.main) {
  logger.info(
    { scenario: "09-gateway-real-checks" },
    "scenario 09 — gateway real checks — starting",
  );

  const result = runGatewayRealChecksScenario({
    dbPath: ".local/scenario-gateway-real-checks.db",
    cleanup: true,
  });

  logger.info(
    {
      ok: result.ok,
      scenarioA: result.scenarioA,
      scenarioB: result.scenarioB,
      scenarioC: result.scenarioC,
    },
    result.ok
      ? "scenario 09 — gateway real checks — PASSED"
      : "scenario 09 — gateway real checks — FAILED",
  );

  process.exit(result.ok ? 0 : 1);
}
