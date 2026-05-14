// tests/runtime-kai-pre-trade-gateway.test.ts
//
// Slice 1 of the v0 pre-trade gateway envelope (Saskia + Kai). Asserts:
//
//   - Aggregator emits a single OrderApprovedAtGateway for a synthetic
//     OrderProposed under the slice-1 default-approve behaviour
//     (intentional — slices 2–7 wire individual checks).
//   - Idempotency: re-firing the handler with the same OrderProposed in
//     `triggeringEvents` is a no-op (no duplicate approval; the bus's
//     (eventId, handlerKey) idempotency is exercised separately by the
//     event-trigger-bus tests).
//   - Citation chain present on every emit (Principle 2 — every action
//     traces to a source). The citation gate also runs the same check
//     globally; this test asserts the chain has the right anchors.
//   - Empty triggering set is a clean no-op.
//
// Author: Kai · Saskia. Slice 1 lands without any check handler being
// live; the gateway just emits OrderApprovedAtGateway for every order
// in this interim state per the brief §7.

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
    ownerInboxDir: join(REPO_ROOT, "Owner Inbox"),
    dryRun: args.dryRun ?? false,
  };
}

function syntheticOrderProposed(args: { orderId: string; asOf: string }): Event {
  return makeOrderProposed({
    asOf: args.asOf,
    entity: "BANK-ZA-001",
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

/** Latest OrderApprovedAtGateway for a given orderId. */
function latestApprovalFor(orderId: string): Event | undefined {
  let latest: Event | undefined;
  for (const e of eventStore.replay({ type: "OrderApprovedAtGateway" })) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId) latest = e;
  }
  return latest;
}

describe("runtime — kai:pre-trade-gateway-aggregator (slice 1)", () => {
  it("emits OrderApprovedAtGateway for a synthetic OrderProposed (slice-1 default-approve)", async () => {
    const orderId = `test-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const op = syntheticOrderProposed({ orderId, asOf: "2026-05-09T00:00:00.000Z" });
    eventStore.append(op);

    const before = countApprovalsFor(orderId);
    expect(before).toBe(0);

    const ctx = makeContext({
      asOf: "2026-05-09T00:00:00.500Z",
      triggeringEvents: [op],
    });
    const result = await kaiPreTradeGatewayAggregator(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);
    expect(countApprovalsFor(orderId)).toBe(1);

    const approval = latestApprovalFor(orderId);
    expect(approval).toBeDefined();
    // F-012: assert specific event type, not just existence.
    expect(approval?.type).toBe("OrderApprovedAtGateway");
    expect(approval?.actor.id).toBe("agent:kai:pre-trade-gateway-aggregator");

    // Citation chain present (Principle 2). Every emit MUST have at
    // least one citation; the slice-1 chain anchors to FAIS, sanctions,
    // JSE rules, FMA market integrity, and the CEO-reserved governance
    // line that locks the franchise scope.
    expect(approval?.citations.length).toBeGreaterThan(0);
    expect(approval?.citations).toContain("ORG-CD-01"); // FAIS / TCF
    expect(approval?.citations).toContain("ORG-FC-13"); // sanctions
    expect(approval?.citations).toContain("JSE-RULES-EQUITIES");
    expect(approval?.citations).toContain("FMA-S5");
    expect(approval?.citations).toContain("GOV-FRAMEWORK-CEO-RESERVED");

    const payload = approval?.payload as {
      orderId: string;
      approvalCitations: readonly string[];
      passedAt: string;
    };
    expect(payload.orderId).toBe(orderId);
    expect(payload.approvalCitations.length).toBeGreaterThan(0);
    expect(payload.passedAt).toBe("2026-05-09T00:00:00.500Z");
  });

  it("is idempotent — re-firing with the same OrderProposed is a no-op", async () => {
    const orderId = `test-order-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const op = syntheticOrderProposed({ orderId, asOf: "2026-05-09T00:01:00.000Z" });
    eventStore.append(op);

    // First fire.
    const first = await kaiPreTradeGatewayAggregator(
      makeContext({
        asOf: "2026-05-09T00:01:00.500Z",
        triggeringEvents: [op],
      }),
    );
    expect(first.eventsEmitted).toBe(1);
    expect(countApprovalsFor(orderId)).toBe(1);

    // Re-fire — handler-layer idempotency: the orderId is already
    // approved, so the aggregator emits no new event. (The bus layer
    // also dedupes on (eventId, handlerKey); this test exercises the
    // handler's own check.)
    const second = await kaiPreTradeGatewayAggregator(
      makeContext({
        asOf: "2026-05-09T00:01:01.000Z",
        triggeringEvents: [op],
      }),
    );
    expect(second.eventsEmitted).toBe(0);
    expect(countApprovalsFor(orderId)).toBe(1);
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
