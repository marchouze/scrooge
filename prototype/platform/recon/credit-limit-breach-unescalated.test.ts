// platform/recon/credit-limit-breach-unescalated.test.ts
//
// Tests for the credit-limit-breach-unescalated recon pipeline.
// Author: Vera (Internal audit engineer)

import { describe, expect, it } from "bun:test";

import { run } from "./credit-limit-breach-unescalated";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

function breach(args: {
  id: string;
  breachId: string;
  cpid: string;
  asOf: string;
}): E {
  return {
    event_id: args.id,
    type: "CreditLimitBreached",
    as_of: args.asOf,
    payload: { breachId: args.breachId, counterpartyId: args.cpid, severity: "red" },
  };
}

function disposal(args: { id: string; breachId: string; asOf: string }): E {
  return {
    event_id: args.id,
    type: "CreditLimitBreachDisposed",
    as_of: args.asOf,
    payload: { breachId: args.breachId, dispositionType: "unwound" },
  };
}

function escalation(args: {
  id: string;
  escalationId: string;
  question: string;
  asOf: string;
}): E {
  return {
    event_id: args.id,
    type: "AgentEscalation",
    as_of: args.asOf,
    payload: {
      escalationId: args.escalationId,
      question: args.question,
      raisedBy: "Helena",
      severity: "blocking",
      routedTo: "marc@tgv.co.za",
      blockedBy: "limit-breach",
      options: ["unwind", "accept"],
    },
  };
}

function paNotification(args: {
  id: string;
  asOf: string;
  notificationType: string;
  ref: string;
}): E {
  return {
    event_id: args.id,
    type: "PaNotificationSubmitted",
    as_of: args.asOf,
    payload: { notificationType: args.notificationType, regulatoryRef: args.ref },
  };
}

function exception(args: { id: string; cpid: string; approvedAt: string }): E {
  return {
    event_id: args.id,
    type: "CrcLimitExceptionApproved",
    as_of: args.approvedAt,
    payload: {
      counterpartyId: args.cpid,
      exceptionType: "temporary-cap-override",
      approvedAt: args.approvedAt,
      minutesRef: "DOC-MIN-1",
    },
  };
}

describe("recon:credit-limit-breach-unescalated", () => {
  it("passes on a fresh bench (no breaches, no exceptions)", () => {
    const r = run({
      breachEvents: [],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when a breach is disposed within the 72h window", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "b1",
          breachId: "CL-BREACH-2026-1",
          cpid: "CP-1",
          asOf: "2026-05-20T10:00:00Z",
        }),
      ],
      disposalEvents: [
        disposal({ id: "d1", breachId: "CL-BREACH-2026-1", asOf: "2026-05-20T18:00:00Z" }),
      ],
      escalationEvents: [],
      paNotificationEvents: [],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("passes when an AgentEscalation references the breachId within window", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "b1",
          breachId: "CL-BREACH-2026-2",
          cpid: "CP-2",
          asOf: "2026-05-20T10:00:00Z",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [
        escalation({
          id: "e1",
          escalationId: "ESC-1",
          question: "Limit breach CL-BREACH-2026-2 requires direction",
          asOf: "2026-05-20T11:00:00Z",
        }),
      ],
      paNotificationEvents: [],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("passes when an AgentEscalation references the counterpartyId", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "b1",
          breachId: "CL-BREACH-2026-3",
          cpid: "CP-X",
          asOf: "2026-05-20T10:00:00Z",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [
        escalation({
          id: "e1",
          escalationId: "ESC-2",
          question: "Counterparty CP-X exposure exceeded",
          asOf: "2026-05-20T12:00:00Z",
        }),
      ],
      paNotificationEvents: [],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("passes when a PaNotificationSubmitted with 'lex' type is filed within window", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "b1",
          breachId: "CL-BREACH-2026-4",
          cpid: "CP-4",
          asOf: "2026-05-20T10:00:00Z",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [
        paNotification({
          id: "p1",
          asOf: "2026-05-21T08:00:00Z",
          notificationType: "lex-cap-breach",
          ref: "PA-2026-0001",
        }),
      ],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("fails CRITICAL when a breach has no disposal, no escalation, no PA notification", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "b1",
          breachId: "CL-BREACH-2026-5",
          cpid: "CP-5",
          asOf: "2026-05-20T10:00:00Z",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("CRITICAL");
    expect(fails[0]?.message).toContain("CL-BREACH-2026-5");
  });

  it("fails when disposal is outside the 72h window", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "b1",
          breachId: "CL-BREACH-2026-6",
          cpid: "CP-6",
          asOf: "2026-05-20T10:00:00Z",
        }),
      ],
      disposalEvents: [
        // 5 days later — outside window
        disposal({ id: "d1", breachId: "CL-BREACH-2026-6", asOf: "2026-05-25T10:00:00Z" }),
      ],
      escalationEvents: [],
      paNotificationEvents: [],
      exceptionApprovedEvents: [],
    });
    expect(r.ok).toBe(false);
  });

  it("flags lapsed exceptions older than 90 days", () => {
    const r = run({
      breachEvents: [],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
      exceptionApprovedEvents: [
        exception({ id: "x1", cpid: "CP-7", approvedAt: "2025-01-01T00:00:00Z" }),
      ],
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("Lapsed");
    expect(fails[0]?.message).toContain("90-day");
  });

  it("does NOT flag fresh exceptions (<= 90 days)", () => {
    const r = run({
      breachEvents: [],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
      exceptionApprovedEvents: [
        exception({ id: "x1", cpid: "CP-8", approvedAt: "2026-04-01T00:00:00Z" }),
      ],
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });
});
