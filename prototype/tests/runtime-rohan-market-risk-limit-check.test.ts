// tests/runtime-rohan-market-risk-limit-check.test.ts
//
// Unit tests for Rohan's market-risk-limit-check handler.
//
// Verifies:
//   1. Buy within limits → GatewayCheckCompleted{approve}, no AgentEscalation
//   2. Buy breaching single-name limit (RAS-B1) →
//      GatewayCheckCompleted{reject, citationToRule:"RAS-B1"} + AgentEscalation{severity:"high"}
//   3. Sell → GatewayCheckCompleted{approve}, no AgentEscalation
//
// RAS-B2 (total-book limit) is not tested in isolation here: computeCurrentExposure()
// reads instrument.id from EquityTradeBooked payloads, but the CDM schema stores the
// identifier at instrument.identifier.value — pre-seeding the book via the event store
// requires the full CDM schema which doesn't expose instrument.id. Tracked as a substrate
// gap alongside alert:integrity:fx-cancel-prin-no-reversal.
//
// Limits (from market-risk-limits-stub.json):
//   singleNameNotionalLimitZAR        = 50,000,000
//   totalEquityBookNotionalLimitZAR   = 500,000,000
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { makeGatewayCheckRequested, makeOrderProposed } from "../platform/event-store/event-types";
import type { Event } from "../platform/event-store/types";
import rohanMarketRiskLimitCheck from "../runtime/agents/rohan-market-risk-limit-check";
import type { AgentRunContext } from "../runtime/types";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const AS_OF = "2026-06-01T10:00:00.000Z";
const DATE = "2026-06-01";

const TEST_ACTOR = { type: "service" as const, id: "agent:test" };
const CITATIONS = ["TEST"];

function makeCtx(triggeringEvents: readonly Event[]): AgentRunContext {
  return {
    agent: "Rohan",
    trigger: { kind: "event-driven", id: "test", triggeringEvents },
    asOf: AS_OF,
    repoRoot: REPO_ROOT,
    ownerInboxDir: join(REPO_ROOT, "archive", "owner-inbox"),
    dryRun: false,
  };
}

function makeOrder(args: {
  orderId: string;
  instrument: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
}): { orderEvent: Event; checkEvent: Event } {
  const orderEvent = makeOrderProposed({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: TEST_ACTOR,
    citations: CITATIONS,
    payload: {
      orderId: args.orderId,
      counterpartyLei: "LEI001TESTCPTY00000A",
      instrument: args.instrument,
      side: args.side,
      quantity: args.quantity,
      price: args.price,
      priceCurrency: "ZAR",
      bookingEntity: "entity:bank-za-001",
      requestedActor: "agent:test",
    },
  });

  const checkEvent = makeGatewayCheckRequested({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: TEST_ACTOR,
    citations: CITATIONS,
    payload: {
      orderId: args.orderId,
      checkKind: "market-risk",
      sourceOrderEventId: orderEvent.event_id,
      requestedAt: AS_OF,
    },
  });

  return { orderEvent, checkEvent };
}

function gatewayResultFor(
  orderId: string,
): { outcome: string; citationToRule: string | undefined } | undefined {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as {
      orderId?: string;
      checkKind?: string;
      outcome?: string;
      citationToRule?: string;
    };
    if (p.orderId === orderId && p.checkKind === "market-risk") {
      return { outcome: p.outcome ?? "", citationToRule: p.citationToRule };
    }
  }
  return undefined;
}

function escalationsFor(orderId: string): Event[] {
  const results: Event[] = [];
  for (const e of eventStore.replay({ type: "AgentEscalation" })) {
    const p = e.payload as { escalationId?: string };
    if (p.escalationId?.includes(orderId)) results.push(e);
  }
  return results;
}

describe("rohan:market-risk-limit-check", () => {
  it("approves a buy within single-name limit — no AgentEscalation", async () => {
    const orderId = `test-within-limit-${Date.now()}`;
    // ZAR 100 × 100,000 = ZAR 10m — well within 50m single-name limit
    const { orderEvent, checkEvent } = makeOrder({
      orderId,
      instrument: "JSE:NPN",
      side: "buy",
      quantity: 100,
      price: 100_000,
    });
    eventStore.append(orderEvent);
    eventStore.append(checkEvent);

    const result = await rohanMarketRiskLimitCheck(makeCtx([checkEvent]));

    expect(result.ok).toBe(true);
    expect(gatewayResultFor(orderId)?.outcome).toBe("approve");
    expect(escalationsFor(orderId)).toHaveLength(0);
  });

  it("rejects a buy breaching single-name limit (RAS-B1) and emits AgentEscalation", async () => {
    const orderId = `test-single-name-breach-${Date.now()}`;
    // ZAR 1,000 × 60,000 = ZAR 60m — exceeds 50m single-name limit
    const { orderEvent, checkEvent } = makeOrder({
      orderId,
      instrument: `JSE:SLM-${Date.now()}`,
      side: "buy",
      quantity: 1_000,
      price: 60_000,
    });
    eventStore.append(orderEvent);
    eventStore.append(checkEvent);

    const result = await rohanMarketRiskLimitCheck(makeCtx([checkEvent]));

    expect(result.ok).toBe(true);

    const gw = gatewayResultFor(orderId);
    expect(gw?.outcome).toBe("reject");
    expect(gw?.citationToRule).toBe("RAS-B1");

    const escalations = escalationsFor(orderId);
    expect(escalations).toHaveLength(1);
    const p = escalations[0]?.payload as {
      escalationId: string;
      severity: string;
      raisedBy: string;
      routedTo: string;
      blockedBy: string;
    };
    expect(p.escalationId).toBe(`MARKET-RISK-LIMIT-BREACH-${orderId}-${DATE}`);
    expect(p.severity).toBe("high");
    expect(p.raisedBy).toBe("agent:rohan:market-risk-limit-check");
    expect(p.routedTo).toBe("agent:helena + agent:rohan");
    expect(p.blockedBy).toContain("Build-phase synthetic");
  });

  it("approves a sell order regardless of notional — no AgentEscalation", async () => {
    const orderId = `test-sell-${Date.now()}`;
    const { orderEvent, checkEvent } = makeOrder({
      orderId,
      instrument: "JSE:NPN",
      side: "sell",
      quantity: 1_000,
      price: 60_000,
    });
    eventStore.append(orderEvent);
    eventStore.append(checkEvent);

    const result = await rohanMarketRiskLimitCheck(makeCtx([checkEvent]));

    expect(result.ok).toBe(true);
    expect(gatewayResultFor(orderId)?.outcome).toBe("approve");
    expect(escalationsFor(orderId)).toHaveLength(0);
  });
});
