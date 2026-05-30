// platform/recon/posting-source-id-canonical.test.ts
//
// Tests for recon:posting-source-id-canonical — asserts every
// SubLedgerPostingEmitted.sourceEventId resolves to a real event or a
// documented remediation anchor.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { run } from "./posting-source-id-canonical";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

function posting(id: string, sourceEventId: string | undefined, postingType = "trade-booking"): E {
  return {
    event_id: id,
    type: "SubLedgerPostingEmitted",
    as_of: "2026-05-21T12:00:00.000Z",
    payload: {
      ...(sourceEventId ? { sourceEventId } : {}),
      postingType,
      legs: [
        { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 100, currency: "ZAR" },
        { accountId: "ACC-2100-003", debitCredit: "credit", amountMinor: 100, currency: "ZAR" },
      ],
    },
  };
}

function primary(id: string): E {
  return { event_id: id, type: "FxTradeExecuted", as_of: "2026-05-21T12:00:00.000Z", payload: {} };
}

function remediation(sourceIds: string[]): E {
  return {
    event_id: "anchor-1",
    type: "SubLedgerPostingRemediationRecorded",
    as_of: "2026-05-30T00:00:00.000Z",
    payload: { remediationId: "rem-1", remediatedSourceEventIds: sourceIds },
  };
}

describe("recon:posting-source-id-canonical", () => {
  it("passes when every sourceEventId resolves to a real event", () => {
    const events: E[] = [primary("src-1"), posting("p-1", "src-1")];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("fails on an un-remediated phantom-source posting", () => {
    const events: E[] = [posting("p-1", "retired-src")];
    const r = run({ events });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.subject).toBe("posting:p-1");
  });

  it("passes when a phantom-source posting is enumerated in a remediation anchor", () => {
    const events: E[] = [posting("p-1", "retired-src"), remediation(["retired-src"])];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    // The documented residual is reported as info (never silent).
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(infos).toHaveLength(1);
    expect(infos[0]?.message).toContain("1 posting");
  });

  it("fails on a null sourceEventId (stronger P1 violation)", () => {
    const events: E[] = [posting("p-1", undefined)];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("no sourceEventId")),
    ).toBe(true);
  });

  it("exempts remediation reversal postings (duplicate-reversal-correction) anchored to a real event", () => {
    const events: E[] = [
      remediation(["retired-src"]),
      posting("p-1", "retired-src"),
      posting("rev-1", "anchor-1", "duplicate-reversal-correction"),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
  });

  it("fails a remediation reversal whose anchor does not resolve", () => {
    const events: E[] = [posting("rev-1", "missing-anchor", "duplicate-reversal-correction")];
    const r = run({ events });
    expect(r.ok).toBe(false);
  });

  it("passes vacuously on an empty store", () => {
    const r = run({ events: [] });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(1);
  });
});
