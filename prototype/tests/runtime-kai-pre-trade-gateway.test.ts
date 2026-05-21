// tests/runtime-kai-pre-trade-gateway.test.ts
//
// Gateway aggregator tests — updated for slices 2–7 multi-check fan-out.
//
// Slices 2–4 replaced the slice-1 default-approve logic with real multi-check
// aggregation. Slices 5–7 extend the fan-out from 3 to 8 checks.
// The aggregator now:
//   - Fans out 8 GatewayCheckRequested events on OrderProposed
//     (3 from slices 2–4 + 5 from slices 5–7)
//   - Emits OrderApprovedAtGateway only after all 8 checks complete and pass
//   - Emits OrderRejectedAtGateway if any check fails
//
// Tests updated accordingly:
//   - eventsEmitted=8 (fan-out) replaces eventsEmitted=3 (slices 2–4)
//   - Idempotency: second invocation with same OrderProposed skips (check requests exist)
//   - Empty triggering set is a clean no-op.
//
// Author: Kai · Saskia. Updated for slices 2–7.

import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { makeOrderProposed } from "../platform/event-store/event-types";
import type { Event } from "../platform/event-store/types";
import kaiPreTradeGatewayAggregator from "../runtime/agents/kai-pre-trade-gateway-aggregator";
import type { AgentRunContext } from "../runtime/types";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const TEST_ACTOR = {
  type: "service" as const,
  id: "agent:test:order-source",
};

const ORDER_PROPOSED_CITATIONS = ["JSE-RULES-EQUITIES", "FMA-S5", "FIC-ACT-38-2001"];

function makeContext(args: {
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
    ownerInboxDir: join(REPO_ROOT, "archive", "owner-inbox"),
    dryRun: args.dryRun ?? false,
  };
}

function syntheticOrderProposed(args: { orderId: string; asOf: string }): Event {
  return makeOrderProposed({
    asOf: args.asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: TEST_ACTOR,
    citations: [...ORDER_PROPOSED_CITATIONS],
    payload: {
      orderId: args.orderId,
      counterpartyLei: "LEI001TESTCPTY00000A",
      instrument: "JSE:NPN",
      side: "buy",
      quantity: 100,
      price: 2500.0,
      priceCurrency: "ZAR",
      bookingEntity: "entity:bank-za-001",
      requestedActor: "agent:saskia:auto-quote",
    },
  });
}

/** Count OrderApprovedAtGateway events with payload.orderId == id. */
function countApprovalsFor(orderId: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type: "OrderApprovedAtGateway" })) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId) n += 1;
  }
  return n;
}

// Total check kinds wired in the aggregator (slices 2–7).
const TOTAL_CHECK_KINDS = 8;

describe("runtime — kai:pre-trade-gateway-aggregator (slices 2–7)", () => {
  it(`fans out ${TOTAL_CHECK_KINDS} GatewayCheckRequested for a synthetic OrderProposed`, async () => {
    const orderId = `test-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const op = syntheticOrderProposed({ orderId, asOf: "2026-05-09T00:00:00.000Z" });
    eventStore.append(op);

    const ctx = makeContext({
      asOf: "2026-05-09T00:00:00.500Z",
      triggeringEvents: [op],
    });
    const result = await kaiPreTradeGatewayAggregator(ctx);

    expect(result.ok).toBe(true);
    // Slices 2–7: fan-out emits 8 GatewayCheckRequested
    expect(result.eventsEmitted).toBe(TOTAL_CHECK_KINDS);

    // No terminal approval yet — waiting for check completions
    expect(countApprovalsFor(orderId)).toBe(0);

    // Check that 8 fan-out events were emitted (one per check kind)
    let checkReqCount = 0;
    for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
      const p = e.payload as { orderId?: unknown };
      if (typeof p.orderId === "string" && p.orderId === orderId) checkReqCount++;
    }
    expect(checkReqCount).toBe(TOTAL_CHECK_KINDS);

    // Citation chain on fan-out events (Principle 2).
    for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
      const p = e.payload as { orderId?: unknown };
      if (typeof p.orderId !== "string" || p.orderId !== orderId) continue;
      expect(e.citations.length).toBeGreaterThan(0);
      expect(e.citations).toContain("ORG-CD-01");
      expect(e.citations).toContain("ORG-FC-13");
      expect(e.citations).toContain("JSE-RULES-EQUITIES");
      expect(e.citations).toContain("FMA-S5");
      expect(e.citations).toContain("GOV-FRAMEWORK-CEO-RESERVED");
      break;
    }
  });

  it("is idempotent — re-firing with the same OrderProposed is a no-op (check requests already exist)", async () => {
    const orderId = `test-order-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const op = syntheticOrderProposed({ orderId, asOf: "2026-05-09T00:01:00.000Z" });
    eventStore.append(op);

    // First fire: fan-out 8 check requests.
    const first = await kaiPreTradeGatewayAggregator(
      makeContext({
        asOf: "2026-05-09T00:01:00.500Z",
        triggeringEvents: [op],
      }),
    );
    expect(first.eventsEmitted).toBe(TOTAL_CHECK_KINDS);

    // Re-fire — check requests already exist for this orderId,
    // so the aggregator skips re-fan-out (idempotency).
    const second = await kaiPreTradeGatewayAggregator(
      makeContext({
        asOf: "2026-05-09T00:01:01.000Z",
        triggeringEvents: [op],
      }),
    );
    expect(second.eventsEmitted).toBe(0);

    // Still only 8 check requests, not 16.
    let checkReqCount = 0;
    for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
      const p = e.payload as { orderId?: unknown };
      if (typeof p.orderId === "string" && p.orderId === orderId) checkReqCount++;
    }
    expect(checkReqCount).toBe(TOTAL_CHECK_KINDS);
  });

  it("clean no-op when triggering set has no OrderProposed events", async () => {
    const ctx = makeContext({
      asOf: "2026-05-09T00:02:00.000Z",
      triggeringEvents: [],
    });
    const result = await kaiPreTradeGatewayAggregator(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/no OrderProposed/);
  });

  it("dry-run mode does not append OrderApprovedAtGateway", async () => {
    const orderId = `test-order-dry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const op = syntheticOrderProposed({ orderId, asOf: "2026-05-09T00:03:00.000Z" });
    // Note: we do NOT append the OrderProposed in this case — the
    // aggregator only consults `triggeringEvents`, not the store, for
    // its source set. The store is only walked for idempotency.

    const ctx = makeContext({
      asOf: "2026-05-09T00:03:00.500Z",
      triggeringEvents: [op],
      dryRun: true,
    });
    const result = await kaiPreTradeGatewayAggregator(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(countApprovalsFor(orderId)).toBe(0);
  });
});
