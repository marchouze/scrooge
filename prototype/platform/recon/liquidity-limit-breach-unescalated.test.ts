// platform/recon/liquidity-limit-breach-unescalated.test.ts
//
// Tests for the liquidity-limit-breach-unescalated recon pipeline.
// Author: Vera (Internal audit engineer, engineering).

import { describe, expect, it } from "bun:test";

import { run } from "./liquidity-limit-breach-unescalated";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

function breach(args: {
  id: string;
  breachId: string;
  asOf: string;
  severity: "critical" | "high" | "medium" | "low";
  line?: string;
  tier?: string;
}): E {
  return {
    event_id: args.id,
    type: "LiquidityLimitBreached",
    as_of: args.asOf,
    payload: {
      breachId: args.breachId,
      severity: args.severity,
      line: args.line ?? "lcr-ratio",
      tier: args.tier ?? "tier-1",
    },
  };
}

function disposal(args: { id: string; breachId: string; asOf: string }): E {
  return {
    event_id: args.id,
    type: "LiquidityLimitBreachDisposed",
    as_of: args.asOf,
    payload: { breachId: args.breachId, disposition: "remediated" },
  };
}

function escalation(args: {
  id: string;
  question: string;
  asOf: string;
}): E {
  return {
    event_id: args.id,
    type: "AgentEscalation",
    as_of: args.asOf,
    payload: {
      escalationId: args.id,
      question: args.question,
      severity: "critical",
    },
  };
}

function paNotif(args: {
  id: string;
  notificationType: string;
  asOf: string;
  ref?: string;
}): E {
  return {
    event_id: args.id,
    type: "PaNotificationSubmitted",
    as_of: args.asOf,
    payload: {
      notificationType: args.notificationType,
      regulatoryRef: args.ref ?? "",
    },
  };
}

describe("recon:liquidity-limit-breach-unescalated", () => {
  it("passes on a fresh bench (no breaches)", () => {
    const r = run({
      breachEvents: [],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when a critical breach is disposed within 24h", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "e1",
          breachId: "B1",
          asOf: "2026-05-21T09:00:00Z",
          severity: "critical",
        }),
      ],
      disposalEvents: [disposal({ id: "d1", breachId: "B1", asOf: "2026-05-21T20:00:00Z" })],
      escalationEvents: [],
      paNotificationEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("fails when a critical breach has NO disposal/escalation/PA notif within 24h", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "e1",
          breachId: "B1",
          asOf: "2026-05-21T09:00:00Z",
          severity: "critical",
        }),
      ],
      // Disposal 48h later — outside the 24h SLA for critical.
      disposalEvents: [disposal({ id: "d1", breachId: "B1", asOf: "2026-05-23T09:00:00Z" })],
      escalationEvents: [],
      paNotificationEvents: [],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.subject).toBe("breach:B1");
  });

  it("passes when a critical breach is escalated via AgentEscalation referencing breachId", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "e1",
          breachId: "B1",
          asOf: "2026-05-21T09:00:00Z",
          severity: "critical",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [
        escalation({
          id: "esc1",
          question: "Liquidity breach B1 — tier-1 LCR red; please advise",
          asOf: "2026-05-21T10:00:00Z",
        }),
      ],
      paNotificationEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("passes when a critical breach is followed by a PA LCR notification", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "e1",
          breachId: "B1",
          asOf: "2026-05-21T09:00:00Z",
          severity: "critical",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [
        paNotif({
          id: "pa1",
          notificationType: "lcr-pa-minimum-breach",
          asOf: "2026-05-21T11:00:00Z",
        }),
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("uses the looser 72h window for high-severity breaches", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "e1",
          breachId: "B1",
          asOf: "2026-05-21T09:00:00Z",
          severity: "high",
        }),
      ],
      // Disposal 48h later — within 72h window for high.
      disposalEvents: [disposal({ id: "d1", breachId: "B1", asOf: "2026-05-23T09:00:00Z" })],
      escalationEvents: [],
      paNotificationEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("does not assert medium/low breaches", () => {
    const r = run({
      breachEvents: [
        breach({
          id: "e1",
          breachId: "BM",
          asOf: "2026-05-21T09:00:00Z",
          severity: "medium",
        }),
        breach({
          id: "e2",
          breachId: "BL",
          asOf: "2026-05-21T09:00:00Z",
          severity: "low",
        }),
      ],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
    });
    expect(r.ok).toBe(true);
  });

  it("emits an info finding when a breach event has no breachId", () => {
    const malformed: E = {
      event_id: "e1",
      type: "LiquidityLimitBreached",
      as_of: "2026-05-21T09:00:00Z",
      payload: { severity: "critical" }, // missing breachId
    };
    const r = run({
      breachEvents: [malformed],
      disposalEvents: [],
      escalationEvents: [],
      paNotificationEvents: [],
    });
    // Info severity does not flip ok to false.
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("info");
  });
});
