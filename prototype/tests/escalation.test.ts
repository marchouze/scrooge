// tests/escalation.test.ts
//
// Unit tests for A3.1 — the escalation channel substrate.
//
// Asserts:
//   - open + acknowledge + decide flow.
//   - open + delegate + decide flow.
//   - Multiple acknowledgements are permitted.
//   - Duplicate decide raises a SubstrateAlert (alertClass: integrity).
//   - Overdue detection: open + past-deadline + no decision emits
//     exactly one Overdue; second enforceOverdue is idempotent.
//   - Status query for each lifecycle state.
//   - Sealed-routing override (fraud / whistleblowing / popia-incident).
//
// Author: Atlas + Senna + Iris (A3.1)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001 } from "../platform/core/types";
import { LocalEscalationChannel, resolveSealedRouting } from "../platform/escalation";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

const RAISER_ACTOR: Actor = { type: "service", id: "agent:helena:risk-appetite-watch" };
const OVERSEER_ACTOR: Actor = { type: "human", id: "marc@tgv.co.za" };

const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "BANKS-ACT-94-1990"];

const T0 = "2026-05-08T08:00:00.000Z";
const T1 = "2026-05-08T10:00:00.000Z";
const T2 = "2026-05-08T12:00:00.000Z";

function newChannel(): { channel: LocalEscalationChannel; store: EventStore } {
  const store = new EventStore();
  const channel = new LocalEscalationChannel(store);
  return { channel, store };
}

function basePayload(escalationId: string, deadline?: string) {
  return {
    escalationId,
    raisedBy: "Helena",
    question: "Tier-1 LCR breach disposition exceeds CEO authority — escalate.",
    options: [
      "Tolerate (within RAS §B9)",
      "Remediate (require management plan)",
      "Escalate to Board + PA notification",
    ],
    blockedBy: "Tier-1 disposition reserved to Board.",
    deadline,
    severity: "blocking" as const,
    routedTo: "human:marc@tgv.co.za",
  };
}

describe("EscalationChannel — open / acknowledge / decide", () => {
  it("opens an escalation and emits a typed AgentEscalation", () => {
    const { channel, store } = newChannel();
    const r = channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:helena:lcr-1"),
    });
    expect(r.escalationId).toBe("escalation:helena:lcr-1");
    expect(r.routedTo).toBe("human:marc@tgv.co.za");

    const events = [...store.replay({ type: "AgentEscalation" })];
    expect(events.length).toBe(1);

    const open = channel.list({ status: "open" });
    expect(open.length).toBe(1);
    expect(open[0]?.escalationId).toBe("escalation:helena:lcr-1");
    expect(open[0]?.acknowledgementCount).toBe(0);
    expect(open[0]?.delegationCount).toBe(0);
    store.close();
  });

  it("acknowledge → decide: status walks open → acknowledged → decided", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:helena:lcr-2"),
    });
    expect(channel.list({ status: "open" }).length).toBe(1);

    channel.acknowledge({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:helena:lcr-2",
      acknowledgedBy: "human:marc@tgv.co.za",
    });
    expect(channel.list({ status: "open" }).length).toBe(0);
    expect(channel.list({ status: "acknowledged" }).length).toBe(1);

    const decide = channel.decide({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:helena:lcr-2",
      decidedBy: "human:marc@tgv.co.za",
      chosenOption: "Remediate (require management plan)",
      rationale: "Material risk but not yet zone of crystallisation; remediation plan suffices.",
    });
    expect(decide.integrityAlertEmitted).toBe(false);

    expect(channel.list({ status: "acknowledged" }).length).toBe(0);
    const decided = channel.list({ status: "decided" });
    expect(decided.length).toBe(1);
    expect(decided[0]?.currentResponsible).toBe("human:marc@tgv.co.za");
    store.close();
  });

  it("rejects decide with a chosenOption not in the original options", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:helena:lcr-3"),
    });
    expect(() =>
      channel.decide({
        asOf: T1,
        entity: BANK_ZA_001,
        actor: OVERSEER_ACTOR,
        citations: CITATIONS,
        escalationId: "escalation:helena:lcr-3",
        decidedBy: "human:marc@tgv.co.za",
        chosenOption: "Approve and forget", // not in options
        rationale: "n/a",
      }),
    ).toThrow(/not in the AgentEscalation's options/);
    store.close();
  });

  it("accepts a free-form chosenOption when the original options were empty", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: { ...basePayload("escalation:helena:lcr-4"), options: [] },
    });
    const r = channel.decide({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:helena:lcr-4",
      decidedBy: "human:marc@tgv.co.za",
      chosenOption: "Bespoke decision text",
      rationale: "No options enumerated; CEO drafts directly.",
    });
    expect(r.integrityAlertEmitted).toBe(false);
    store.close();
  });
});

describe("EscalationChannel — delegate", () => {
  it("delegate → decide: status walks open → delegated → decided", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:zara:str-1"),
    });
    channel.delegate({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:zara:str-1",
      delegatedBy: "human:marc@tgv.co.za",
      delegatedTo: "human:cae@tgv.co.za",
      reason: "Investigation discipline reserved to CAE.",
    });
    const delegated = channel.list({ status: "delegated" });
    expect(delegated.length).toBe(1);
    expect(delegated[0]?.currentResponsible).toBe("human:cae@tgv.co.za");
    expect(delegated[0]?.delegationCount).toBe(1);

    channel.decide({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: { type: "human", id: "cae@tgv.co.za" },
      citations: CITATIONS,
      escalationId: "escalation:zara:str-1",
      decidedBy: "human:cae@tgv.co.za",
      chosenOption: "Remediate (require management plan)",
      rationale: "Investigation continues; remediation plan binds in the interim.",
    });
    expect(channel.list({ status: "decided" }).length).toBe(1);
    store.close();
  });

  it("supports a chain of delegations; currentResponsible is the most recent delegatee", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:chain:1"),
    });
    channel.delegate({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:chain:1",
      delegatedBy: "human:marc@tgv.co.za",
      delegatedTo: "human:cosec@tgv.co.za",
      reason: "Companies Act question.",
    });
    channel.delegate({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: { type: "human", id: "cosec@tgv.co.za" },
      citations: CITATIONS,
      escalationId: "escalation:chain:1",
      delegatedBy: "human:cosec@tgv.co.za",
      delegatedTo: "human:gc@tgv.co.za",
      reason: "External counsel question past CoSec scope.",
    });
    const v = channel.list({ status: "delegated" })[0];
    expect(v?.delegationCount).toBe(2);
    expect(v?.currentResponsible).toBe("human:gc@tgv.co.za");
    store.close();
  });
});

describe("EscalationChannel — multiple acknowledgements", () => {
  it("permits multiple Acknowledged events from different overseers", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:multiack:1"),
    });
    channel.acknowledge({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: { type: "human", id: "cosec@tgv.co.za" },
      citations: CITATIONS,
      escalationId: "escalation:multiack:1",
      acknowledgedBy: "human:cosec@tgv.co.za",
    });
    channel.acknowledge({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:multiack:1",
      acknowledgedBy: "human:marc@tgv.co.za",
    });

    const acked = channel.list({ status: "acknowledged" });
    expect(acked.length).toBe(1);
    expect(acked[0]?.acknowledgementCount).toBe(2);
    // currentResponsible folds to the most recent ack.
    expect(acked[0]?.currentResponsible).toBe("human:marc@tgv.co.za");
    store.close();
  });
});

describe("EscalationChannel — duplicate decide raises SubstrateAlert", () => {
  it("emits a SubstrateAlert (alertClass: integrity) on a second Decided", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:dup:1"),
    });
    const first = channel.decide({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:dup:1",
      decidedBy: "human:marc@tgv.co.za",
      chosenOption: "Remediate (require management plan)",
      rationale: "First decision.",
    });
    expect(first.integrityAlertEmitted).toBe(false);

    const second = channel.decide({
      asOf: T2,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:dup:1",
      decidedBy: "human:marc@tgv.co.za",
      chosenOption: "Tolerate (within RAS §B9)",
      rationale: "Second decision — invariant violation.",
    });
    expect(second.integrityAlertEmitted).toBe(true);

    const alerts = [...store.replay({ type: "SubstrateAlert" })];
    expect(alerts.length).toBe(1);
    const alert = alerts[0];
    expect((alert?.payload as { alertClass?: string }).alertClass).toBe("integrity");
    expect((alert?.payload as { escalationId?: string }).escalationId).toBe("escalation:dup:1");
    store.close();
  });
});

describe("EscalationChannel — enforceOverdue", () => {
  it("emits an Overdue event for past-deadline open escalations and is idempotent", () => {
    const { channel, store } = newChannel();
    const pastDeadline = "2026-05-07T00:00:00.000Z";
    channel.open({
      asOf: "2026-05-06T00:00:00.000Z",
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:overdue:1", pastDeadline),
    });

    const now = new Date("2026-05-08T09:00:00.000Z");
    const r1 = channel.enforceOverdue(now);
    expect(r1.walked).toBe(1);
    expect(r1.emitted).toEqual(["escalation:overdue:1"]);
    expect(r1.skipped.length).toBe(0);

    const overdueEvents = [...store.replay({ type: "AgentEscalationOverdue" })];
    expect(overdueEvents.length).toBe(1);
    const overdueView = channel.list({ status: "overdue" });
    expect(overdueView.length).toBe(1);
    expect(overdueView[0]?.overdue).toBe(true);

    // Second call → idempotent: no new Overdue event emitted.
    const r2 = channel.enforceOverdue(now);
    expect(r2.emitted.length).toBe(0);
    expect(r2.skipped).toEqual(["escalation:overdue:1"]);
    expect([...store.replay({ type: "AgentEscalationOverdue" })].length).toBe(1);
    store.close();
  });

  it("does not emit Overdue for an escalation already Decided", () => {
    const { channel, store } = newChannel();
    const pastDeadline = "2026-05-07T00:00:00.000Z";
    channel.open({
      asOf: "2026-05-06T00:00:00.000Z",
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:resolved:1", pastDeadline),
    });
    channel.decide({
      asOf: "2026-05-06T12:00:00.000Z",
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:resolved:1",
      decidedBy: "human:marc@tgv.co.za",
      chosenOption: "Tolerate (within RAS §B9)",
      rationale: "Decided before deadline; deadline is moot.",
    });

    const r = channel.enforceOverdue(new Date("2026-05-08T09:00:00.000Z"));
    expect(r.walked).toBe(1);
    expect(r.emitted.length).toBe(0);
    expect([...store.replay({ type: "AgentEscalationOverdue" })].length).toBe(0);
    store.close();
  });

  it("does nothing for escalations without a deadline", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: "2026-05-06T00:00:00.000Z",
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:nodeadline:1"), // deadline omitted
    });
    const r = channel.enforceOverdue(new Date("2026-05-08T09:00:00.000Z"));
    expect(r.emitted.length).toBe(0);
    store.close();
  });

  it("does nothing for escalations whose deadline is in the future", () => {
    const { channel, store } = newChannel();
    const futureDeadline = "2027-01-01T00:00:00.000Z";
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:future:1", futureDeadline),
    });
    const r = channel.enforceOverdue(new Date("2026-05-08T09:00:00.000Z"));
    expect(r.emitted.length).toBe(0);
    store.close();
  });
});

describe("EscalationChannel — sealed routing", () => {
  it("overrides routedTo for sealed=fraud", () => {
    const { channel, store } = newChannel();
    const r = channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: {
        ...basePayload("escalation:fraud:1"),
        sealed: { reason: "fraud" as const },
      },
    });
    expect(r.routedTo).toBe(resolveSealedRouting({ reason: "fraud" }));
    expect(r.routedTo).toContain("cae");
    expect(r.routedTo).toContain("ceo");
    expect(r.routedTo).toContain("cosec");
    store.close();
  });

  it("overrides routedTo for sealed=whistleblowing", () => {
    const { channel, store } = newChannel();
    const r = channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: {
        ...basePayload("escalation:whistle:1"),
        sealed: { reason: "whistleblowing" as const },
      },
    });
    expect(r.routedTo).toBe("human:cae");
    store.close();
  });

  it("overrides routedTo for sealed=popia-incident", () => {
    const { channel, store } = newChannel();
    const r = channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: {
        ...basePayload("escalation:popia:1"),
        sealed: { reason: "popia-incident" as const },
      },
    });
    expect(r.routedTo).toContain("io");
    expect(r.routedTo).toContain("ceo");
    store.close();
  });
});

describe("EscalationChannel — list by status", () => {
  it("partitions escalations by computed status", () => {
    const { channel, store } = newChannel();
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:list:open"),
    });
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:list:acked"),
    });
    channel.acknowledge({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:list:acked",
      acknowledgedBy: "human:marc@tgv.co.za",
    });
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:list:delegated"),
    });
    channel.delegate({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:list:delegated",
      delegatedBy: "human:marc@tgv.co.za",
      delegatedTo: "human:cae@tgv.co.za",
      reason: "Test.",
    });
    channel.open({
      asOf: T0,
      entity: BANK_ZA_001,
      actor: RAISER_ACTOR,
      citations: CITATIONS,
      payload: basePayload("escalation:list:decided"),
    });
    channel.decide({
      asOf: T1,
      entity: BANK_ZA_001,
      actor: OVERSEER_ACTOR,
      citations: CITATIONS,
      escalationId: "escalation:list:decided",
      decidedBy: "human:marc@tgv.co.za",
      chosenOption: "Tolerate (within RAS §B9)",
      rationale: "Test.",
    });

    expect(channel.list({ status: "open" }).map((v) => v.escalationId)).toEqual([
      "escalation:list:open",
    ]);
    expect(channel.list({ status: "acknowledged" }).map((v) => v.escalationId)).toEqual([
      "escalation:list:acked",
    ]);
    expect(channel.list({ status: "delegated" }).map((v) => v.escalationId)).toEqual([
      "escalation:list:delegated",
    ]);
    expect(channel.list({ status: "decided" }).map((v) => v.escalationId)).toEqual([
      "escalation:list:decided",
    ]);
    store.close();
  });
});
