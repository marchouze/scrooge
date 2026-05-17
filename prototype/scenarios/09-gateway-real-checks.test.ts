// scenarios/09-gateway-real-checks.test.ts
//
// Tests for the pre-trade gateway real checks — slices 2–4.
//
// Covers:
//   Scenario A: valid institutional counterparty + within limits
//               → all three checks pass → OrderApprovedAtGateway
//
//   Scenario B: sanctioned counterparty (CP-SANCTIONED-001...)
//               → sanctions check fails → OrderRejectedAtGateway
//               with rejectingCheck === "sanctions"
//
//   Scenario C: order that breaches single-name notional limit
//               → market-risk check fails → OrderRejectedAtGateway
//               with rejectingCheck === "market-risk"
//
//   Plus:
//   - Aggregator fan-out: OrderProposed → 3 × GatewayCheckRequested
//   - Aggregator idempotency: terminal event exists → no re-emission
//   - Aggregator aggregation: incomplete checks → no-op
//   - Sanctions handler: idempotency + dry-run
//   - Eligibility handler: retail client rejection + institutional pass
//   - Risk handler: sell order always passes
//
// Authors:
//   Rohan (Market risk engineer, engineering) — market-risk tests
//   Mira (Compliance / RegTech engineer, engineering) — sanctions + eligibility tests
//   Kai (Markets engineer, engineering) — aggregator tests

import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  makeCounterpartyFaisClassified,
  makeGatewayCheckCompleted,
  makeGatewayCheckRequested,
  makeOrderProposed,
} from "../platform/event-store/event-types";
import type { GatewayCheckCompletedPayload } from "../platform/event-store/event-types/trading";
import type { Event } from "../platform/event-store/types";
import kaiPreTradeGatewayAggregator from "../runtime/agents/kai-pre-trade-gateway-aggregator";
import miraCounterpartyEligibilityCheck from "../runtime/agents/mira-counterparty-eligibility-check";
import miraSanctionsGatewayCheck from "../runtime/agents/mira-sanctions-gateway-check";
import rohanMarketRiskLimitCheck from "../runtime/agents/rohan-market-risk-limit-check";
import type { AgentRunContext } from "../runtime/types";
import {
  buildScenarioAEvents,
  buildScenarioBEvents,
  buildScenarioCEvents,
} from "./09-gateway-real-checks";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const ENTITY = BANK_ZA_001;

const ORDER_CITATIONS = ["JSE-RULES-EQUITIES", "FMA-S5"];
const FANOUT_CITATIONS = [
  "ORG-CD-01",
  "ORG-FC-08",
  "ORG-FC-13",
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "GOV-FRAMEWORK-CEO-RESERVED",
];
const SANCTIONS_CITATIONS = ["ORG-FC-08", "ORG-FC-13"];
const ELIGIBILITY_CITATIONS = ["ORG-CD-01", "GOV-FRAMEWORK-CEO-RESERVED"];
const RISK_CITATIONS = ["ORG-PR-01", "RAS-B1", "RAS-B2"];

const AGGREGATOR_ACTOR = { type: "service" as const, id: "agent:kai:pre-trade-gateway-aggregator" };
const MIRA_SANCTIONS_ACTOR = { type: "service" as const, id: "agent:mira:sanctions-gateway-check" };
const MIRA_ELIGIBILITY_ACTOR = {
  type: "service" as const,
  id: "agent:mira:counterparty-eligibility-check",
};
const ROHAN_RISK_ACTOR = { type: "service" as const, id: "agent:rohan:market-risk-limit-check" };
const NIKO_ACTOR = { type: "service" as const, id: "agent:niko:onboarding" };

const AS_OF = "2026-05-17T09:00:00.000Z";
const AS_OF_CHECKS = "2026-05-17T09:00:01.000Z";
const AS_OF_TERMINAL = "2026-05-17T09:00:02.000Z";

// Counterparties (must be ^[A-Z0-9]{20}$ per ISO 17442 LEI)
const CP_INSTITUTIONAL_LEI = "LEIVALIDINSTITUTION0"; // 20 chars, clean
const CP_SANCTIONED_LEI = "CPSANCTIONED00100000"; // 20 chars — matches blockedCounterpartyIds stub
const CP_RETAIL_LEI = "LEIRETAILCLIENTTEST0"; // 20 chars, retail-client category

// Instruments
const INSTRUMENT_OK = "JSE:NPN";
const INSTRUMENT_BREACH = "ZAE000015889"; // perInstrumentLimits: 50m ZAR

function uniqueId(prefix = "order"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeKaiCtx(args: {
  asOf: string;
  triggeringEvents: readonly Event[];
  dryRun?: boolean;
}): AgentRunContext {
  return {
    agent: "Kai",
    trigger: {
      kind: "event-driven",
      id: "pre-trade-gateway-aggregator",
      triggeringEvents: args.triggeringEvents,
    },
    asOf: args.asOf,
    repoRoot: REPO_ROOT,
    ownerInboxDir: join(REPO_ROOT, "Owner Inbox"),
    dryRun: args.dryRun ?? false,
  };
}

function makeMiraCtx(args: {
  asOf: string;
  triggeringEvents: readonly Event[];
  dryRun?: boolean;
}): AgentRunContext {
  return {
    agent: "Mira",
    trigger: {
      kind: "event-driven",
      id: "sanctions-gateway-check",
      triggeringEvents: args.triggeringEvents,
    },
    asOf: args.asOf,
    repoRoot: REPO_ROOT,
    ownerInboxDir: join(REPO_ROOT, "Owner Inbox"),
    dryRun: args.dryRun ?? false,
  };
}

function makeRohanCtx(args: {
  asOf: string;
  triggeringEvents: readonly Event[];
  dryRun?: boolean;
}): AgentRunContext {
  return {
    agent: "Rohan",
    trigger: {
      kind: "event-driven",
      id: "market-risk-limit-check",
      triggeringEvents: args.triggeringEvents,
    },
    asOf: args.asOf,
    repoRoot: REPO_ROOT,
    ownerInboxDir: join(REPO_ROOT, "Owner Inbox"),
    dryRun: args.dryRun ?? false,
  };
}

function makeOrder(args: {
  orderId: string;
  counterpartyLei: string;
  instrument: string;
  quantity: number;
  price: number;
}): Event {
  return makeOrderProposed({
    asOf: AS_OF,
    entity: ENTITY,
    actor: { type: "service" as const, id: "agent:saskia:auto-quote" },
    citations: ORDER_CITATIONS,
    payload: {
      orderId: args.orderId,
      counterpartyLei: args.counterpartyLei,
      instrument: args.instrument,
      side: "buy",
      quantity: args.quantity,
      price: args.price,
      priceCurrency: "ZAR",
      bookingEntity: ENTITY,
      requestedActor: "agent:saskia:auto-quote",
    },
  });
}

function countEventsOfType(type: string, orderId: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type })) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId) n++;
  }
  return n;
}

function countCheckRequests(orderId: string, checkKind: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === checkKind) n++;
  }
  return n;
}

function countCheckCompletions(orderId: string, checkKind: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === checkKind) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Aggregator tests
// ---------------------------------------------------------------------------

describe("kai:pre-trade-gateway-aggregator (slices 2–4)", () => {
  it("fans out three GatewayCheckRequested on OrderProposed", async () => {
    const orderId = uniqueId("agg-fanout");
    const order = makeOrder({
      orderId,
      counterpartyLei: CP_INSTITUTIONAL_LEI,
      instrument: INSTRUMENT_OK,
      quantity: 100,
      price: 2500,
    });
    eventStore.append(order);

    const result = await kaiPreTradeGatewayAggregator(
      makeKaiCtx({ asOf: AS_OF, triggeringEvents: [order] }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(3); // 3 fan-out events

    expect(countCheckRequests(orderId, "sanctions")).toBe(1);
    expect(countCheckRequests(orderId, "counterparty-eligibility")).toBe(1);
    expect(countCheckRequests(orderId, "market-risk")).toBe(1);
  });

  it("does not re-fan-out when check requests already exist", async () => {
    const orderId = uniqueId("agg-fanout-idem");
    const order = makeOrder({
      orderId,
      counterpartyLei: CP_INSTITUTIONAL_LEI,
      instrument: INSTRUMENT_OK,
      quantity: 100,
      price: 2500,
    });
    eventStore.append(order);

    // First fan-out
    await kaiPreTradeGatewayAggregator(makeKaiCtx({ asOf: AS_OF, triggeringEvents: [order] }));
    expect(countCheckRequests(orderId, "sanctions")).toBe(1);

    // Second invocation — should skip re-fan-out
    const second = await kaiPreTradeGatewayAggregator(
      makeKaiCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [order] }),
    );
    expect(countCheckRequests(orderId, "sanctions")).toBe(1); // still 1, not 2
    expect(second.ok).toBe(true);
  });

  it("emits OrderApprovedAtGateway when all 3 checks pass", async () => {
    const orderId = uniqueId("agg-approve");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    // Fan-out
    await kaiPreTradeGatewayAggregator(makeKaiCtx({ asOf: AS_OF, triggeringEvents: [order] }));

    // Find check request events to use as sourceCheckRequestEventId
    const checkReqEvents: Event[] = [];
    for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
      const p = e.payload as { orderId?: unknown };
      if (p.orderId === orderId) checkReqEvents.push(e);
    }
    expect(checkReqEvents.length).toBe(3);

    const getReq = (kind: string) =>
      checkReqEvents.find((e) => (e.payload as { checkKind: string }).checkKind === kind) ??
      (() => {
        throw new Error(`No check request found for kind: ${kind}`);
      })();

    // Append all 3 passing completions
    const makeComp = (checkKind: string, srcEventId: string): Event =>
      makeGatewayCheckCompleted({
        asOf: AS_OF_CHECKS,
        entity: ENTITY,
        actor: MIRA_SANCTIONS_ACTOR,
        citations: SANCTIONS_CITATIONS,
        payload: {
          orderId,
          checkKind: checkKind as GatewayCheckCompletedPayload["checkKind"],
          outcome: "approve",
          sourceCheckRequestEventId: srcEventId,
          completedAt: AS_OF_CHECKS,
          durationMs: 100,
        },
      });

    const comps = [
      makeComp("sanctions", getReq("sanctions").event_id),
      makeComp("counterparty-eligibility", getReq("counterparty-eligibility").event_id),
      makeComp("market-risk", getReq("market-risk").event_id),
    ];
    for (const c of comps) eventStore.append(c);

    // Aggregate
    const result = await kaiPreTradeGatewayAggregator(
      makeKaiCtx({ asOf: AS_OF_TERMINAL, triggeringEvents: comps }),
    );

    expect(result.ok).toBe(true);
    expect(countEventsOfType("OrderApprovedAtGateway", orderId)).toBe(1);
    expect(countEventsOfType("OrderRejectedAtGateway", orderId)).toBe(0);
  });

  it("emits OrderRejectedAtGateway when a check fails", async () => {
    const orderId = uniqueId("agg-reject");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_SANCTIONED_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    // Fan-out
    await kaiPreTradeGatewayAggregator(makeKaiCtx({ asOf: AS_OF, triggeringEvents: [order] }));

    const checkReqEvents: Event[] = [];
    for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
      const p = e.payload as { orderId?: unknown };
      if (p.orderId === orderId) checkReqEvents.push(e);
    }
    const getReq = (kind: string) =>
      checkReqEvents.find((e) => (e.payload as { checkKind: string }).checkKind === kind) ??
      (() => {
        throw new Error(`No check request found for kind: ${kind}`);
      })();

    // Sanctions FAILS; other two pass
    const failComp = makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_SANCTIONS_ACTOR,
      citations: SANCTIONS_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        outcome: "reject",
        sourceCheckRequestEventId: getReq("sanctions").event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 50,
        rejectionReason: "Sanctioned counterparty",
        citationToRule: "ORG-FC-13",
      },
    });
    const passComp1 = makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_ELIGIBILITY_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        outcome: "approve",
        sourceCheckRequestEventId: getReq("counterparty-eligibility").event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 60,
      },
    });
    const passComp2 = makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: ROHAN_RISK_ACTOR,
      citations: RISK_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        outcome: "approve",
        sourceCheckRequestEventId: getReq("market-risk").event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 70,
      },
    });
    for (const c of [failComp, passComp1, passComp2]) eventStore.append(c);

    const result = await kaiPreTradeGatewayAggregator(
      makeKaiCtx({ asOf: AS_OF_TERMINAL, triggeringEvents: [failComp, passComp1, passComp2] }),
    );

    expect(result.ok).toBe(true);
    expect(countEventsOfType("OrderRejectedAtGateway", orderId)).toBe(1);
    expect(countEventsOfType("OrderApprovedAtGateway", orderId)).toBe(0);

    // Check the rejecting check field
    for (const e of eventStore.replay({ type: "OrderRejectedAtGateway" })) {
      const p = e.payload as { orderId?: unknown; rejectingCheck?: unknown };
      if (p.orderId === orderId) {
        expect(p.rejectingCheck).toBe("sanctions");
        break;
      }
    }
  });

  it("is a no-op when fewer than 3 checks have completed", async () => {
    const orderId = uniqueId("agg-incomplete");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    // Fan-out
    await kaiPreTradeGatewayAggregator(makeKaiCtx({ asOf: AS_OF, triggeringEvents: [order] }));

    const checkReqEvents: Event[] = [];
    for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
      const p = e.payload as { orderId?: unknown };
      if (p.orderId === orderId) checkReqEvents.push(e);
    }
    const getReq = (kind: string) =>
      checkReqEvents.find((e) => (e.payload as { checkKind: string }).checkKind === kind) ??
      (() => {
        throw new Error(`No check request found for kind: ${kind}`);
      })();

    // Only 2 completions — not all 3
    const comp1 = makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_SANCTIONS_ACTOR,
      citations: SANCTIONS_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        outcome: "approve",
        sourceCheckRequestEventId: getReq("sanctions").event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 100,
      },
    });
    const comp2 = makeGatewayCheckCompleted({
      asOf: AS_OF_CHECKS,
      entity: ENTITY,
      actor: MIRA_ELIGIBILITY_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        outcome: "approve",
        sourceCheckRequestEventId: getReq("counterparty-eligibility").event_id,
        completedAt: AS_OF_CHECKS,
        durationMs: 120,
      },
    });
    for (const c of [comp1, comp2]) eventStore.append(c);

    const result = await kaiPreTradeGatewayAggregator(
      makeKaiCtx({ asOf: AS_OF_TERMINAL, triggeringEvents: [comp1, comp2] }),
    );

    expect(result.ok).toBe(true);
    // No terminal event yet
    expect(countEventsOfType("OrderApprovedAtGateway", orderId)).toBe(0);
    expect(countEventsOfType("OrderRejectedAtGateway", orderId)).toBe(0);
  });

  it("dry-run mode does not emit any events", async () => {
    const orderId = uniqueId("agg-dryrun");
    const order = makeOrder({
      orderId,
      counterpartyLei: CP_INSTITUTIONAL_LEI,
      instrument: INSTRUMENT_OK,
      quantity: 100,
      price: 2500,
    });

    const result = await kaiPreTradeGatewayAggregator(
      makeKaiCtx({ asOf: AS_OF, triggeringEvents: [order], dryRun: true }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(countCheckRequests(orderId, "sanctions")).toBe(0);
    expect(countEventsOfType("OrderApprovedAtGateway", orderId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sanctions check handler tests
// ---------------------------------------------------------------------------

describe("mira:sanctions-gateway-check (slice 2)", () => {
  it("emits approve for a non-sanctioned counterparty", async () => {
    const orderId = uniqueId("sanc-pass");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    const checkReq = makeGatewayCheckRequested({
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
    });
    eventStore.append(checkReq);

    const result = await miraSanctionsGatewayCheck(
      makeMiraCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);
    expect(countCheckCompletions(orderId, "sanctions")).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as { orderId?: unknown; checkKind?: unknown; outcome?: unknown };
      if (p.orderId === orderId && p.checkKind === "sanctions") {
        expect(p.outcome).toBe("approve");
        break;
      }
    }
  });

  it("emits reject for a sanctioned counterparty", async () => {
    const orderId = uniqueId("sanc-fail");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_SANCTIONED_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    const checkReq = makeGatewayCheckRequested({
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
    });
    eventStore.append(checkReq);

    const result = await miraSanctionsGatewayCheck(
      makeMiraCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as {
        orderId?: unknown;
        checkKind?: unknown;
        outcome?: unknown;
        citationToRule?: unknown;
      };
      if (p.orderId === orderId && p.checkKind === "sanctions") {
        expect(p.outcome).toBe("reject");
        expect(p.citationToRule).toBe("ORG-FC-13");
        break;
      }
    }
  });

  it("is idempotent — second invocation is a no-op", async () => {
    const orderId = uniqueId("sanc-idem");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);
    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    await miraSanctionsGatewayCheck(
      makeMiraCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );
    expect(countCheckCompletions(orderId, "sanctions")).toBe(1);

    const second = await miraSanctionsGatewayCheck(
      makeMiraCtx({ asOf: AS_OF_TERMINAL, triggeringEvents: [checkReq] }),
    );
    expect(second.eventsEmitted).toBe(0);
    expect(countCheckCompletions(orderId, "sanctions")).toBe(1);
  });

  it("dry-run mode does not emit", async () => {
    const orderId = uniqueId("sanc-dry");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);
    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "sanctions",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });

    const result = await miraSanctionsGatewayCheck(
      makeMiraCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq], dryRun: true }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(countCheckCompletions(orderId, "sanctions")).toBe(0);
  });

  it("no-op when triggeringEvents has no sanctions check requests", async () => {
    const result = await miraSanctionsGatewayCheck(
      makeMiraCtx({ asOf: AS_OF, triggeringEvents: [] }),
    );
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/nothing to check/);
  });
});

// ---------------------------------------------------------------------------
// Counterparty eligibility check handler tests
// ---------------------------------------------------------------------------

describe("mira:counterparty-eligibility-check (slice 3)", () => {
  it("approves a market-counterparty classified counterparty", async () => {
    const orderId = uniqueId("elig-pass");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    // Emit CounterpartyFaisClassified: market-counterparty
    const faisClassified = makeCounterpartyFaisClassified({
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
    });
    eventStore.append(faisClassified);

    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    const result = await miraCounterpartyEligibilityCheck({
      ...makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
      agent: "Mira",
    });

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as { orderId?: unknown; checkKind?: unknown; outcome?: unknown };
      if (p.orderId === orderId && p.checkKind === "counterparty-eligibility") {
        expect(p.outcome).toBe("approve");
        break;
      }
    }
  });

  it("rejects a retail-client classified counterparty", async () => {
    const orderId = uniqueId("elig-retail-fail");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_RETAIL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    // Emit CounterpartyFaisClassified: retail-client (not permitted)
    const faisClassified = makeCounterpartyFaisClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: ["ORG-CD-01"],
      payload: {
        counterpartyId: CP_RETAIL_LEI,
        faisCategory: "retail-client",
        classifiedAt: AS_OF,
        classifiedBy: NIKO_ACTOR.id,
      },
    });
    eventStore.append(faisClassified);

    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    const result = await miraCounterpartyEligibilityCheck({
      ...makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
      agent: "Mira",
    });

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as {
        orderId?: unknown;
        checkKind?: unknown;
        outcome?: unknown;
        citationToRule?: unknown;
      };
      if (p.orderId === orderId && p.checkKind === "counterparty-eligibility") {
        expect(p.outcome).toBe("reject");
        expect(p.citationToRule).toBe("ORG-CD-01");
        break;
      }
    }
  });

  it("rejects counterparty with no FAIS classification", async () => {
    const orderId = uniqueId("elig-unknown");
    const orderEventId = newEventId();
    const unknownLei20 = "LEIUNKNOWN000000001A";
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: unknownLei20,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    // No CounterpartyFaisClassified emitted for this counterparty

    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "counterparty-eligibility",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    const result = await miraCounterpartyEligibilityCheck({
      ...makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
      agent: "Mira",
    });

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as { orderId?: unknown; checkKind?: unknown; outcome?: unknown };
      if (p.orderId === orderId && p.checkKind === "counterparty-eligibility") {
        expect(p.outcome).toBe("reject");
        break;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Market risk limit check handler tests
// ---------------------------------------------------------------------------

describe("rohan:market-risk-limit-check (slice 4)", () => {
  it("approves an order within the single-name notional limit", async () => {
    const orderId = uniqueId("risk-pass");
    const orderEventId = newEventId();
    // 100 shares * 2500 ZAR = 250k ZAR — well within 50m per-instrument limit
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    const result = await rohanMarketRiskLimitCheck(
      makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as { orderId?: unknown; checkKind?: unknown; outcome?: unknown };
      if (p.orderId === orderId && p.checkKind === "market-risk") {
        expect(p.outcome).toBe("approve");
        break;
      }
    }
  });

  it("rejects an order that breaches the single-name notional limit", async () => {
    const orderId = uniqueId("risk-fail");
    const orderEventId = newEventId();
    // 100,000 shares * 1,000 ZAR = 100m ZAR > 50m perInstrumentLimits["ZAE000015889"]
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_BREACH,
        quantity: 100000,
        price: 1000,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);

    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    const result = await rohanMarketRiskLimitCheck(
      makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as {
        orderId?: unknown;
        checkKind?: unknown;
        outcome?: unknown;
        citationToRule?: unknown;
      };
      if (p.orderId === orderId && p.checkKind === "market-risk") {
        expect(p.outcome).toBe("reject");
        expect(p.citationToRule).toBe("RAS-B1");
        break;
      }
    }
  });

  it("always approves sell orders (reduces exposure)", async () => {
    const orderId = uniqueId("risk-sell");
    const orderEventId = newEventId();
    // Sell order — regardless of size, sells reduce exposure
    const order = makeOrderProposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service" as const, id: "agent:saskia:auto-quote" },
      citations: ORDER_CITATIONS,
      eventId: orderEventId,
      payload: {
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_BREACH, // Large instrument
        side: "sell",
        quantity: 100000,
        price: 1000,
        priceCurrency: "ZAR",
        bookingEntity: ENTITY,
        requestedActor: "agent:saskia:auto-quote",
      },
    });
    eventStore.append(order);

    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    const result = await rohanMarketRiskLimitCheck(
      makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
      const p = e.payload as { orderId?: unknown; checkKind?: unknown; outcome?: unknown };
      if (p.orderId === orderId && p.checkKind === "market-risk") {
        expect(p.outcome).toBe("approve"); // sell → always pass
        break;
      }
    }
  });

  it("is idempotent — second invocation is a no-op", async () => {
    const orderId = uniqueId("risk-idem");
    const orderEventId = newEventId();
    const order = {
      ...makeOrder({
        orderId,
        counterpartyLei: CP_INSTITUTIONAL_LEI,
        instrument: INSTRUMENT_OK,
        quantity: 100,
        price: 2500,
      }),
      event_id: orderEventId,
    };
    eventStore.append(order);
    const checkReq = makeGatewayCheckRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: AGGREGATOR_ACTOR,
      citations: FANOUT_CITATIONS,
      payload: {
        orderId,
        checkKind: "market-risk",
        sourceOrderEventId: orderEventId,
        requestedAt: AS_OF,
      },
    });
    eventStore.append(checkReq);

    await rohanMarketRiskLimitCheck(
      makeRohanCtx({ asOf: AS_OF_CHECKS, triggeringEvents: [checkReq] }),
    );
    expect(countCheckCompletions(orderId, "market-risk")).toBe(1);

    const second = await rohanMarketRiskLimitCheck(
      makeRohanCtx({ asOf: AS_OF_TERMINAL, triggeringEvents: [checkReq] }),
    );
    expect(second.eventsEmitted).toBe(0);
    expect(countCheckCompletions(orderId, "market-risk")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario integration tests — using pre-built scenario event sets
// ---------------------------------------------------------------------------

describe("scenario 09 — gateway real checks integration", () => {
  it("Scenario A: all checks pass → OrderApprovedAtGateway", () => {
    const events = buildScenarioAEvents();

    // Append all pre-built events (the approval is included in the set)
    for (const e of events.all) eventStore.append(e);

    // Verify the terminal approval is in the scenario
    expect(events.approval.type).toBe("OrderApprovedAtGateway");
    const approvalPayload = events.approval.payload as {
      orderId?: unknown;
      approvalCitations?: unknown;
    };
    expect(approvalPayload.orderId).toBe("ORD-SCENARIO-A-001");
    expect(Array.isArray(approvalPayload.approvalCitations)).toBe(true);

    // Verify all 3 check requests were fanned out
    expect(events.checkReqSanctions.payload).toMatchObject({ checkKind: "sanctions" });
    expect(events.checkReqEligibility.payload).toMatchObject({
      checkKind: "counterparty-eligibility",
    });
    expect(events.checkReqRisk.payload).toMatchObject({ checkKind: "market-risk" });

    // Verify all 3 check completions pass
    expect((events.checkCompSanctions.payload as { outcome: string }).outcome).toBe("approve");
    expect((events.checkCompEligibility.payload as { outcome: string }).outcome).toBe("approve");
    expect((events.checkCompRisk.payload as { outcome: string }).outcome).toBe("approve");
  });

  it("Scenario B: sanctioned counterparty → OrderRejectedAtGateway[sanctions]", () => {
    const events = buildScenarioBEvents();
    for (const e of events.all) eventStore.append(e);

    expect(events.rejection.type).toBe("OrderRejectedAtGateway");
    const rejPayload = events.rejection.payload as { orderId?: unknown; rejectingCheck?: unknown };
    expect(rejPayload.orderId).toBe("ORD-SCENARIO-B-001");
    expect(rejPayload.rejectingCheck).toBe("sanctions");

    // Sanctions check must have rejected
    expect((events.checkCompSanctions.payload as { outcome: string }).outcome).toBe("reject");
  });

  it("Scenario C: limit breach → OrderRejectedAtGateway[market-risk]", () => {
    const events = buildScenarioCEvents();
    for (const e of events.all) eventStore.append(e);

    expect(events.rejection.type).toBe("OrderRejectedAtGateway");
    const rejPayload = events.rejection.payload as {
      orderId?: unknown;
      rejectingCheck?: unknown;
      citationToRule?: unknown;
    };
    expect(rejPayload.orderId).toBe("ORD-SCENARIO-C-001");
    expect(rejPayload.rejectingCheck).toBe("market-risk");
    expect(rejPayload.citationToRule).toBe("RAS-B1");

    // Market risk check must have rejected
    expect((events.checkCompRisk.payload as { outcome: string }).outcome).toBe("reject");
    expect((events.checkCompSanctions.payload as { outcome: string }).outcome).toBe("approve");
    expect((events.checkCompEligibility.payload as { outcome: string }).outcome).toBe("approve");
  });
});
