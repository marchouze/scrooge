// platform/recon/lex-cap-utilisation.test.ts
//
// Tests for the lex-cap-utilisation recon pipeline.
// Author: Vera (Internal audit engineer)

import { describe, expect, it } from "bun:test";

import { AMBER_THRESHOLD_PCT, RED_THRESHOLD_PCT, run } from "./lex-cap-utilisation";

interface E {
  event_id: string;
  as_of: string;
  payload: {
    counterpartyId: string;
    connectedGroupId?: string;
    totalExposure: number;
    eligibleCapital: number;
    currency: string;
    utilisationPct: number;
    computedAt: string;
  };
}

function lex(args: {
  id: string;
  cpid: string;
  groupId?: string;
  utilPct: number;
  computedAt: string;
}): E {
  return {
    event_id: args.id,
    as_of: args.computedAt,
    payload: {
      counterpartyId: args.cpid,
      ...(args.groupId ? { connectedGroupId: args.groupId } : {}),
      totalExposure: Math.round((args.utilPct / 100) * 1_000_000_000),
      eligibleCapital: 1_000_000_000,
      currency: "ZAR",
      utilisationPct: args.utilPct,
      computedAt: args.computedAt,
    },
  };
}

describe("recon:lex-cap-utilisation", () => {
  it("threshold constants align with regulatory cap and policy band", () => {
    expect(RED_THRESHOLD_PCT).toBe(25);
    expect(AMBER_THRESHOLD_PCT).toBe(20);
  });

  it("passes on a fresh bench (no LexUtilisationComputed events)", () => {
    const r = run({ events: [] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when all counterparties are below 20%", () => {
    const r = run({
      events: [
        lex({ id: "u1", cpid: "CP-1", utilPct: 12.5, computedAt: "2026-05-20T00:00:00Z" }),
        lex({ id: "u2", cpid: "CP-2", utilPct: 19.99, computedAt: "2026-05-20T00:00:00Z" }),
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("flags AMBER when 20% ≤ utilisation < 25%", () => {
    const r = run({
      events: [lex({ id: "u1", cpid: "CP-1", utilPct: 21.5, computedAt: "2026-05-20T00:00:00Z" })],
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("AMBER");
  });

  it("flags RED when utilisation ≥ 25%", () => {
    const r = run({
      events: [lex({ id: "u1", cpid: "CP-1", utilPct: 28.0, computedAt: "2026-05-20T00:00:00Z" })],
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("RED");
    expect(fails[0]?.message).toContain("RRB Regulation 23");
  });

  it("uses the latest computedAt when multiple snapshots for one counterparty", () => {
    const r = run({
      events: [
        lex({ id: "u1", cpid: "CP-1", utilPct: 30, computedAt: "2026-05-19T00:00:00Z" }),
        lex({ id: "u2", cpid: "CP-1", utilPct: 10, computedAt: "2026-05-20T00:00:00Z" }),
      ],
    });
    // latest is 10% → no findings
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("emits a separate snapshot for connected-group when present", () => {
    const r = run({
      events: [
        lex({
          id: "u1",
          cpid: "CP-1",
          groupId: "GRP-A",
          utilPct: 26,
          computedAt: "2026-05-20T00:00:00Z",
        }),
      ],
    });
    // One Red on the counterparty + one Red on the group.
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(2);
    expect(fails.some((v) => v.subject === "cp:CP-1")).toBe(true);
    expect(fails.some((v) => v.subject === "group:GRP-A")).toBe(true);
  });
});
