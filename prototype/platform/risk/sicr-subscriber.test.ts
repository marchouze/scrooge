// platform/risk/sicr-subscriber.test.ts
//
// Fixture tests for the SICR subscriber.
//
// Covers:
//   1. `neither-delivered` failure → SicrTriggered emitted with stage-1 →
//      stage-2 transition, settlement-failure-neither-delivered trigger,
//      and the failed FxSettlementFailed event_id in evidence.
//   2. `one-leg-delivered` failure → no SICR emission (default branch
//      handled by PR-FX-005's GL credit-loss journal).
//   3. `operational-delay` failure → no SICR emission (single delay is
//      not a §5.5.3 SICR trigger).
//   4. Counterparty not resolvable → no SICR emission, substrate-gap
//      reason returned.
//   5. Replay idempotency — same trigger event always produces the same
//      `event_id` and `appendIfNew` rejects duplicates.
//   6. Stage-direction refine — a hand-constructed payload with
//      previousStage === newStage or stage-2 → stage-1 reversal is
//      rejected by the Zod schema.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  makeSicrTriggered,
  sicrTriggeredPayloadSchema,
} from "../event-store/event-types/counterparty-credit-risk";
import type { FxSettlementFailedPayload } from "../event-store/event-types/fx-accounting";
import type { Event } from "../event-store/types";
import {
  type DeriveSicrTriggeredFromFxFailInput,
  appendIfNew,
  deriveSicrEventId,
  deriveSicrTriggered,
} from "./sicr-subscriber";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "bea-sicr-subscriber" };
const TRADE_REF = "FX-TRADE-2026-05-21-001";
const PARTY_ID = "PARTY-CP-ACME-LTD";
const TRIGGER_EVENT_ID = "evt-fx-fail-001";

function makeMutualFailEvent(): {
  event_id: string;
  as_of: string;
  payload: FxSettlementFailedPayload;
} {
  return {
    event_id: TRIGGER_EVENT_ID,
    as_of: "2026-05-21T10:30:00.000Z",
    payload: {
      tradeRef: TRADE_REF,
      settlementInstructionRef: "SET-INSTR-001",
      failedAt: "2026-05-21T10:30:00.000Z",
      failureKind: "neither-delivered",
      failureReason: "Both correspondents reported non-receipt at cutoff.",
      legStatus: { payLegDelivered: false, receiveLegDelivered: false },
    },
  };
}

function makeOneLegEvent(): {
  event_id: string;
  as_of: string;
  payload: FxSettlementFailedPayload;
} {
  return {
    event_id: "evt-fx-fail-002",
    as_of: "2026-05-21T10:30:00.000Z",
    payload: {
      tradeRef: TRADE_REF,
      settlementInstructionRef: "SET-INSTR-002",
      failedAt: "2026-05-21T10:30:00.000Z",
      failureKind: "one-leg-delivered",
      failureReason: "Bank delivered USD; ZAR receive leg never arrived.",
      legStatus: { payLegDelivered: true, receiveLegDelivered: false },
    },
  };
}

function makeOperationalDelayEvent(): {
  event_id: string;
  as_of: string;
  payload: FxSettlementFailedPayload;
} {
  return {
    event_id: "evt-fx-fail-003",
    as_of: "2026-05-21T10:30:00.000Z",
    payload: {
      tradeRef: TRADE_REF,
      settlementInstructionRef: "SET-INSTR-003",
      failedAt: "2026-05-21T10:30:00.000Z",
      failureKind: "operational-delay",
      failureReason: "Correspondent intra-day delay; expected resolution T+0.",
      legStatus: { payLegDelivered: false, receiveLegDelivered: false },
    },
  };
}

const RESOLVE_TO_PARTY: DeriveSicrTriggeredFromFxFailInput["resolveCounterparty"] = (ref) =>
  ref === TRADE_REF ? PARTY_ID : null;

const RESOLVE_TO_NULL: DeriveSicrTriggeredFromFxFailInput["resolveCounterparty"] = () => null;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deriveSicrTriggered — neither-delivered (canonical SICR path)", () => {
  it("emits a Stage 1 → Stage 2 SicrTriggered event referencing the trigger event_id", () => {
    const result = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });

    expect(result.reason).toBe("emitted");
    expect(result.event).not.toBeNull();
    const evt = result.event as Event;
    expect(evt.type).toBe("SicrTriggered");

    const p = evt.payload as Record<string, unknown>;
    expect(p.partyId).toBe(PARTY_ID);
    expect(p.triggerKind).toBe("settlement-failure-neither-delivered");
    expect(p.triggerEventId).toBe(TRIGGER_EVENT_ID);
    expect(p.previousStage).toBe("stage-1");
    expect(p.newStage).toBe("stage-2");
    expect(p.watchlistTier).toBe("watch-tier-2");
    expect((p.evidence as string[]).some((e) => e === TRIGGER_EVENT_ID)).toBe(true);
    expect((p.evidence as string[]).some((e) => e.includes(TRADE_REF))).toBe(true);
    expect(typeof p.recoveryCondition).toBe("string");
    expect((p.recoveryCondition as string).length).toBeGreaterThan(0);
  });

  it("includes IFRS-9 + policy citations", () => {
    const result = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });
    const evt = result.event as Event;
    expect(evt.citations).toContain("urn:ifrs9:5.5.3");
    expect(evt.citations).toContain("urn:ifrs9:5.5.1");
    expect(evt.citations).toContain("urn:policy:credit-risk-policy-v1#165");
  });

  it("uses a CRC-approved recovery-condition override when supplied", () => {
    const result = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
      recoveryConditionOverride: "Counterparty-specific override approved by CRC 2026-05-21.",
    });
    const evt = result.event as Event;
    const p = evt.payload as Record<string, unknown>;
    expect(p.recoveryCondition).toBe("Counterparty-specific override approved by CRC 2026-05-21.");
  });
});

describe("deriveSicrTriggered — branches that emit no SICR event", () => {
  it("one-leg-delivered → no emission (default branch lives in PR-FX-005 GL journal)", () => {
    const result = deriveSicrTriggered({
      event: makeOneLegEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });
    expect(result.event).toBeNull();
    expect(result.reason).toBe("one-leg-delivered-default-not-sicr");
  });

  it("operational-delay → no emission (single delay is not a §5.5.3 SICR trigger)", () => {
    const result = deriveSicrTriggered({
      event: makeOperationalDelayEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });
    expect(result.event).toBeNull();
    expect(result.reason).toBe("operational-delay-no-sicr");
  });

  it("counterparty not resolvable → no emission (substrate gap, not a SICR signal)", () => {
    const result = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_NULL,
      entity: ENTITY,
      actor: ACTOR,
    });
    expect(result.event).toBeNull();
    expect(result.reason).toBe("counterparty-not-resolved");
  });
});

describe("deriveSicrTriggered — replay idempotency", () => {
  it("derives the same event_id for the same trigger event", () => {
    const r1 = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });
    const r2 = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });
    expect((r1.event as Event).event_id).toBe((r2.event as Event).event_id);
    expect((r1.event as Event).event_id).toBe(
      deriveSicrEventId({ partyId: PARTY_ID, triggerEventId: TRIGGER_EVENT_ID }),
    );
  });

  it("appendIfNew drops the duplicate on replay", () => {
    const r1 = deriveSicrTriggered({
      event: makeMutualFailEvent(),
      resolveCounterparty: RESOLVE_TO_PARTY,
      entity: ENTITY,
      actor: ACTOR,
    });
    const e1 = r1.event as Event;
    const store: readonly Event[] = [];
    const after1 = appendIfNew(store, e1);
    const after2 = appendIfNew(after1, e1);
    expect(after1.length).toBe(1);
    expect(after2.length).toBe(1);
  });
});

describe("SicrTriggered Zod schema — stage-direction refine", () => {
  it("rejects previousStage === newStage", () => {
    const parse = sicrTriggeredPayloadSchema.safeParse({
      partyId: PARTY_ID,
      triggerKind: "manual",
      triggerEventId: null,
      triggerDate: "2026-05-21T10:30:00.000Z",
      previousStage: "stage-1",
      newStage: "stage-1",
      evidence: ["manual-CRC-override"],
      recoveryCondition: "no-op",
    });
    expect(parse.success).toBe(false);
  });

  it("rejects stage-2 → stage-1 reversal (use SicrCleared)", () => {
    const parse = sicrTriggeredPayloadSchema.safeParse({
      partyId: PARTY_ID,
      triggerKind: "manual",
      triggerEventId: null,
      triggerDate: "2026-05-21T10:30:00.000Z",
      previousStage: "stage-2",
      newStage: "stage-1",
      evidence: ["manual-CRC-override"],
      recoveryCondition: "reversal",
    });
    expect(parse.success).toBe(false);
  });

  it("accepts a stage-1 → stage-3 jump (manual override with credit-impaired flag)", () => {
    const parse = sicrTriggeredPayloadSchema.safeParse({
      partyId: PARTY_ID,
      triggerKind: "manual",
      triggerEventId: null,
      triggerDate: "2026-05-21T10:30:00.000Z",
      previousStage: "stage-1",
      newStage: "stage-3",
      evidence: ["external-default-event-2026-05-21"],
      recoveryCondition: "Full settlement of overdue amount and 12 months of clean record.",
      creditImpaired: true,
    });
    expect(parse.success).toBe(true);
  });
});

describe("makeSicrTriggered — citation gate", () => {
  it("rejects empty citations", () => {
    expect(() =>
      makeSicrTriggered({
        asOf: "2026-05-21T10:30:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          partyId: PARTY_ID,
          triggerKind: "manual",
          triggerEventId: null,
          triggerDate: "2026-05-21T10:30:00.000Z",
          previousStage: "stage-1",
          newStage: "stage-2",
          evidence: ["test"],
          recoveryCondition: "test",
        },
      }),
    ).toThrow();
  });
});
