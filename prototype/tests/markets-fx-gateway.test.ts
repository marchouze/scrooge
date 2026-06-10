// tests/markets-fx-gateway.test.ts
//
// Slice 4 tests for the FX desk order-acceptance gateway pipeline.
//
// Scope:
//   1. Happy path: approved order emits the correct event sequence
//      (OrderProposed, 7×GatewayCheckRequested, 7×GatewayCheckCompleted,
//      OrderApprovedAtGateway).
//   2. All seven checks appear in the result with outcome "approve".
//   3. Check latency values are non-negative numbers.
//   4. OrderProposed payload is well-formed (orderId, counterpartyLei 20-char,
//      instrument, side, quantity, price, priceCurrency, bookingEntity).
//   5. GatewayCheckRequested payloads carry correct orderId + checkKind.
//   6. GatewayCheckCompleted payloads carry outcome + durationMs >= 0.
//   7. OrderApprovedAtGateway payload carries orderId + passedAt + approvalCitations.
//   8. Rejection path: ineligible counterparty → counterparty-eligibility check
//      rejects, OrderRejectedAtGateway emitted, result status "rejected".
//   9. Rejection early-stop: event count stops after the rejecting check
//      (remaining check events are still emitted — all 7 checks run,
//      but the terminal event is Rejected).
//  10. GatewayOrderResult.rejectingCheck is "counterparty-eligibility" for
//      an ineligible counterparty.
//  11. rejectionReason is "counterparty not in eligibility-passing set" for
//      an ineligible counterparty.
//  12. Approved result.checks has exactly 7 entries.
//  13. Rejected result.status is "rejected" and has no "approved" events.
//  14. Idempotency: calling getExistingGatewayResult after an
//      OrderApprovedAtGateway event is present returns the approved result
//      without re-emitting events.
//  15. Idempotency: calling getExistingGatewayResult after an
//      OrderRejectedAtGateway event is present returns the rejected result
//      without re-emitting events.
//
// Author: Kai (Trading systems engineer, engineering — reports to
//         Saskia, Head of Global Markets)
//
// Citations: D-FX-SALES-TRADING-FRONTEND, D-MARKETS-SCHEMA-FOUNDATION

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { getExistingGatewayResult, routeOrderToGateway } from "../dashboard/markets-fx-gateway";
import { quoteRfq } from "../dashboard/markets-fx-trade";
import { newEventId } from "../platform/core/types";
import {
  makeCounterpartyEligibilityScreened,
  makeOrderApprovedAtGateway,
  makeOrderRejectedAtGateway,
} from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const NIKO_ACTOR: Actor = { type: "service", id: "agent:niko:eligibility-screening" };
const ELIGIBILITY_CITATIONS = [
  "FAIS-ACT-37-2002",
  "urn:obligation:bank:fais:general-code-of-conduct:v1",
  "[citation: TBC pending counsel — FAIS s.45 sub-section refs]",
];

const T_2026 = "2026-05-09T08:00:00.000Z";
const T_NOW = "2026-05-18T12:00:00.000Z";

const VALID_RFQ = {
  counterpartyId: "cp:standard-bank-za",
  currencyPair: "USD/ZAR",
  side: "buy" as const,
  notional: 1_000_000,
  valueDate: "2026-05-20",
};

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-gateway-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

function replayToArray(store: EventStore, type: string) {
  const out = [];
  for (const e of store.replay({ type })) out.push(e);
  return out;
}

function seedEligibleCounterparty(store: EventStore, counterpartyId: string): void {
  store.append(
    makeCounterpartyEligibilityScreened({
      asOf: T_2026,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        counterpartyId,
        screeningId: `cp-eligibility:${counterpartyId}:2026-05-09`,
        criteria: ["SARB-licensed bank (Banks Act 94/1990)"],
        outcome: "institutional-eligible",
        evidenceRefs: ["SARB-licence-fixture"],
        asOf: T_2026,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FX Slice 4 — routeOrderToGateway (happy path)", () => {
  it("case 1: approved order emits OrderProposed + 14 check events + OrderApprovedAtGateway", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    const proposed = replayToArray(store, "OrderProposed");
    const checkRequested = replayToArray(store, "GatewayCheckRequested");
    const checkCompleted = replayToArray(store, "GatewayCheckCompleted");
    const approved = replayToArray(store, "OrderApprovedAtGateway");
    const rejected = replayToArray(store, "OrderRejectedAtGateway");

    expect(proposed).toHaveLength(1);
    expect(checkRequested).toHaveLength(7);
    expect(checkCompleted).toHaveLength(7);
    expect(approved).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("case 2: result has 7 checks all with outcome 'approve'", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    expect(result.status).toBe("approved");
    expect(result.checks).toHaveLength(7);
    for (const check of result.checks) {
      expect(check.outcome).toBe("approve");
    }
  });

  it("case 3: all check latencyMs values are non-negative numbers", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    for (const check of result.checks) {
      expect(typeof check.latencyMs).toBe("number");
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("case 4: OrderProposed payload is well-formed", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    const proposed = replayToArray(store, "OrderProposed");
    expect(proposed).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const p = proposed[0]!.payload as Record<string, unknown>;

    expect(typeof p.orderId).toBe("string");
    expect(p.orderId as string).toMatch(/^ord:/);
    // LEI must be exactly 20 uppercase alphanumeric chars
    expect(p.counterpartyLei as string).toMatch(/^[A-Z0-9]{20}$/);
    expect(typeof p.instrument).toBe("string");
    expect(p.instrument).toContain("FX-spot");
    expect(p.side).toBe("buy");
    expect(p.quantity).toBe(1_000_000);
    expect(typeof p.price).toBe("number");
    expect((p.price as number) > 0).toBe(true);
    expect(typeof p.priceCurrency).toBe("string");
    expect(p.bookingEntity).toBe("LE-ZA-HOZ-BANK");
    // orderId in result matches proposed event
    expect(p.orderId).toBe(result.orderId);
  });

  it("case 5: GatewayCheckRequested payloads carry correct orderId and checkKind", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    const checkRequested = replayToArray(store, "GatewayCheckRequested");
    expect(checkRequested).toHaveLength(7);

    const EXPECTED_KINDS = [
      "identity",
      "sanctions",
      "suitability",
      "counterparty-eligibility",
      "credit-limit",
      "capital-impact",
      "funding",
    ];
    const actualKinds = checkRequested.map(
      (e) => (e.payload as Record<string, unknown>).checkKind as string,
    );
    for (const kind of EXPECTED_KINDS) {
      expect(actualKinds).toContain(kind);
    }
    for (const event of checkRequested) {
      const p = event.payload as Record<string, unknown>;
      expect(p.orderId as string).toBe(result.orderId);
    }
  });

  it("case 6: GatewayCheckCompleted payloads carry outcome and durationMs >= 0", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    const checkCompleted = replayToArray(store, "GatewayCheckCompleted");
    expect(checkCompleted).toHaveLength(7);

    for (const event of checkCompleted) {
      const p = event.payload as Record<string, unknown>;
      expect(typeof p.outcome).toBe("string");
      expect(["approve", "reject", "timeout"]).toContain(p.outcome as string);
      expect(typeof p.durationMs).toBe("number");
      expect(p.durationMs as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("case 7: OrderApprovedAtGateway payload has orderId + passedAt + approvalCitations", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    const approved = replayToArray(store, "OrderApprovedAtGateway");
    expect(approved).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const p = approved[0]!.payload as Record<string, unknown>;

    expect(p.orderId).toBe(result.orderId);
    expect(typeof p.passedAt).toBe("string");
    expect(Array.isArray(p.approvalCitations)).toBe(true);
    expect((p.approvalCitations as string[]).length).toBeGreaterThan(0);
  });

  it("case 12: approved result.checks has exactly 7 entries", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);

    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    expect(result.checks).toHaveLength(7);
  });
});

describe("FX Slice 4 — routeOrderToGateway (rejection path)", () => {
  const INELIGIBLE_RFQ = {
    ...VALID_RFQ,
    counterpartyId: "cp:ineligible-bank",
  };

  it("case 8: ineligible counterparty → status 'rejected', OrderRejectedAtGateway emitted", () => {
    const store = freshStore();
    // Do NOT seed counterparty — it is ineligible

    const quote = quoteRfq(INELIGIBLE_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: INELIGIBLE_RFQ, quote, asOf: T_NOW });

    expect(result.status).toBe("rejected");
    const rejected = replayToArray(store, "OrderRejectedAtGateway");
    expect(rejected).toHaveLength(1);
    const approved = replayToArray(store, "OrderApprovedAtGateway");
    expect(approved).toHaveLength(0);
  });

  it("case 9: all 7 check events are emitted even on rejection, terminal event is Rejected", () => {
    const store = freshStore();

    const quote = quoteRfq(INELIGIBLE_RFQ);
    routeOrderToGateway({ store, rfqInput: INELIGIBLE_RFQ, quote, asOf: T_NOW });

    const checkRequested = replayToArray(store, "GatewayCheckRequested");
    const checkCompleted = replayToArray(store, "GatewayCheckCompleted");
    const rejected = replayToArray(store, "OrderRejectedAtGateway");

    expect(checkRequested).toHaveLength(7);
    expect(checkCompleted).toHaveLength(7);
    expect(rejected).toHaveLength(1);
  });

  it("case 10: rejectingCheck is 'counterparty-eligibility' for ineligible counterparty", () => {
    const store = freshStore();

    const quote = quoteRfq(INELIGIBLE_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: INELIGIBLE_RFQ, quote, asOf: T_NOW });

    expect(result.rejectingCheck).toBe("counterparty-eligibility");
  });

  it("case 11: rejectionReason is 'counterparty not in eligibility-passing set'", () => {
    const store = freshStore();

    const quote = quoteRfq(INELIGIBLE_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: INELIGIBLE_RFQ, quote, asOf: T_NOW });

    expect(result.rejectionReason).toBe("counterparty not in eligibility-passing set");
  });

  it("case 13: rejected result.status is 'rejected' and no OrderApprovedAtGateway emitted", () => {
    const store = freshStore();

    const quote = quoteRfq(INELIGIBLE_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: INELIGIBLE_RFQ, quote, asOf: T_NOW });

    expect(result.status).toBe("rejected");
    const approved = replayToArray(store, "OrderApprovedAtGateway");
    expect(approved).toHaveLength(0);
  });
});

describe("FX Slice 4 — idempotency guard", () => {
  it("case 14: getExistingGatewayResult returns approved result when OrderApprovedAtGateway exists", () => {
    const store = freshStore();
    const orderId = `ord:${newEventId()}`;

    // Manually append an OrderApprovedAtGateway event for this orderId
    store.append(
      makeOrderApprovedAtGateway({
        asOf: T_NOW,
        entity: ENTITY,
        actor: { type: "service", id: "agent:kai:fx-gateway" },
        citations: ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"],
        payload: {
          orderId,
          approvalCitations: ["D-FX-SALES-TRADING-FRONTEND"],
          passedAt: T_NOW,
        },
      }),
    );

    const result = getExistingGatewayResult(store, orderId);
    expect(result).not.toBeNull();
    expect(result?.status).toBe("approved");
    expect(result?.orderId).toBe(orderId);
  });

  it("case 15: getExistingGatewayResult returns rejected result when OrderRejectedAtGateway exists", () => {
    const store = freshStore();
    const orderId = `ord:${newEventId()}`;

    // Manually append an OrderRejectedAtGateway event for this orderId
    store.append(
      makeOrderRejectedAtGateway({
        asOf: T_NOW,
        entity: ENTITY,
        actor: { type: "service", id: "agent:kai:fx-gateway" },
        citations: ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"],
        payload: {
          orderId,
          rejectionReason: "counterparty not in eligibility-passing set",
          rejectingCheck: "counterparty-eligibility",
          citationToRule: "D-FX-SALES-TRADING-FRONTEND",
          rejectedAt: T_NOW,
        },
      }),
    );

    const result = getExistingGatewayResult(store, orderId);
    expect(result).not.toBeNull();
    expect(result?.status).toBe("rejected");
    expect(result?.orderId).toBe(orderId);
    expect(result?.rejectingCheck).toBe("counterparty-eligibility");
    expect(result?.rejectionReason).toBe("counterparty not in eligibility-passing set");
  });
});

// ---------------------------------------------------------------------------
// Sanctions check — wired to the blocked-list screen (D-FX-OTC-NPA-SCOPE-EXPANSION).
// A sanctioned counterparty is rejected even when otherwise eligible; the
// blocked-list hit surfaces as rejectingCheck "sanctions". A clean counterparty
// passes the sanctions check.
// ---------------------------------------------------------------------------

describe("FX gateway — sanctions screening enforcement", () => {
  // "CPSANCTIONED00100000" is on sanctions-list-stub.json blockedCounterpartyIds;
  // toSyntheticLei leaves a 20-char alnum id unchanged, so the LEI matches too.
  const SANCTIONED_RFQ = { ...VALID_RFQ, counterpartyId: "CPSANCTIONED00100000" };

  it("rejects a sanctioned counterparty at the sanctions check (even if eligible)", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, SANCTIONED_RFQ.counterpartyId); // isolate: only sanctions can reject
    const quote = quoteRfq(SANCTIONED_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: SANCTIONED_RFQ, quote, asOf: T_NOW });

    expect(result.status).toBe("rejected");
    expect(result.rejectingCheck).toBe("sanctions");
    expect(replayToArray(store, "OrderRejectedAtGateway")).toHaveLength(1);
    const sanctionsCheck = result.checks.find((c) => c.checkKind === "sanctions");
    expect(sanctionsCheck?.outcome).toBe("reject");
    expect(sanctionsCheck?.rejectionReason).toContain("sanctions blocked list");
    store.close();
  });

  it("passes the sanctions check for a clean counterparty", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, VALID_RFQ.counterpartyId);
    const quote = quoteRfq(VALID_RFQ);
    const result = routeOrderToGateway({ store, rfqInput: VALID_RFQ, quote, asOf: T_NOW });

    expect(result.status).toBe("approved");
    expect(result.checks.find((c) => c.checkKind === "sanctions")?.outcome).toBe("approve");
    store.close();
  });
});
