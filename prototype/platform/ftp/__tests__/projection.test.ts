// platform/ftp/__tests__/projection.test.ts
//
// Tests for buildFtpPortfolio: fold over multiple attributions produces
// correct portfolio summary.
//
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { describe, expect, it } from "bun:test";

import { buildFtpPortfolio, emptyFtpPortfolioSummary } from "../projection";
import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Helper: fabricate minimal events
// ---------------------------------------------------------------------------

function makeCurveEvent(curveId: string, asOf: string): Event {
  return {
    event_id: `evt-curve-${curveId}`,
    type: "FtpCurvePublished",
    as_of: asOf,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:ravi:ftp-curve-publish" },
    citations: ["BANKS-ACT-94-1990"],
    payload: {
      curveId,
      currency: "ZAR",
      effectiveDate: asOf.slice(0, 10),
      tenors: [
        { tenor: "1M", rate: 0.082, basis: "JIBAR" },
        { tenor: "1Y", rate: 0.092, basis: "JIBAR" },
      ],
      methodology: "matched-maturity",
      publishedBy: "ravi",
      publishedAt: asOf,
    },
  };
}

function makeAttributionEvent(
  id: string,
  asOf: string,
  opts: {
    transactionType?: "loan" | "bond" | "swap" | "deposit" | "repo";
    notional: number;
    clientRate: number;
    ftpRate: number;
    curveId?: string;
  },
): Event {
  const spread = opts.clientRate - opts.ftpRate;
  return {
    event_id: `evt-attr-${id}`,
    type: "FtpAttributionRecorded",
    as_of: asOf,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:ravi:ftp-attribution" },
    citations: ["BANKS-ACT-94-1990"],
    payload: {
      attributionId: id,
      transactionId: `TX-${id}`,
      transactionType: opts.transactionType ?? "loan",
      currency: "ZAR",
      notional: opts.notional,
      tenor: "1Y",
      clientRate: opts.clientRate,
      ftpRate: opts.ftpRate,
      spread,
      ftpCurveId: opts.curveId ?? "FTP-ZAR-2026-05-15",
      attributedAt: asOf,
    },
  };
}

// ---------------------------------------------------------------------------
// emptyFtpPortfolioSummary
// ---------------------------------------------------------------------------

describe("emptyFtpPortfolioSummary", () => {
  it("returns a summary with zero counts", () => {
    const s = emptyFtpPortfolioSummary();
    expect(s.totalAttributions).toBe(0);
    expect(s.totalNotional).toBe(0);
    expect(s.weightedAvgSpread).toBe(0);
    expect(s.activeCurveId).toBeNull();
    expect(s.byTransactionType).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Empty event stream
// ---------------------------------------------------------------------------

describe("buildFtpPortfolio — empty event stream", () => {
  it("returns empty summary for an empty event array", () => {
    const s = buildFtpPortfolio([]);
    expect(s.totalAttributions).toBe(0);
    expect(s.totalNotional).toBe(0);
    expect(s.weightedAvgSpread).toBe(0);
    expect(s.activeCurveId).toBeNull();
    expect(Object.keys(s.byTransactionType)).toHaveLength(0);
  });

  it("ignores unrelated events", () => {
    const events: Event[] = [
      {
        event_id: "evt-001",
        type: "AuditFinding",
        as_of: "2026-05-15T00:00:00Z",
        entity: "BANK-ZA-001",
        actor: { type: "human", id: "marc@tgv.co.za" },
        citations: ["SOME-REG"],
        payload: { findingId: "F-001", summary: "test" },
      },
      {
        event_id: "evt-002",
        type: "RiskRaised",
        as_of: "2026-05-15T00:00:00Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:helena" },
        citations: ["SOME-REG"],
        payload: { riskId: "R-001" },
      },
    ];
    const s = buildFtpPortfolio(events);
    expect(s.totalAttributions).toBe(0);
    expect(s.activeCurveId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Curve-only events
// ---------------------------------------------------------------------------

describe("buildFtpPortfolio — FtpCurvePublished events only", () => {
  it("tracks the most recently published curve", () => {
    const events: Event[] = [
      makeCurveEvent("FTP-ZAR-2026-05-14", "2026-05-14T05:45:00Z"),
      makeCurveEvent("FTP-ZAR-2026-05-15", "2026-05-15T05:45:00Z"),
      makeCurveEvent("FTP-ZAR-2026-05-13", "2026-05-13T05:45:00Z"),
    ];
    const s = buildFtpPortfolio(events);
    expect(s.activeCurveId).toBe("FTP-ZAR-2026-05-15");
    expect(s.totalAttributions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Single attribution
// ---------------------------------------------------------------------------

describe("buildFtpPortfolio — single attribution", () => {
  it("accumulates totals correctly for one loan", () => {
    const events: Event[] = [
      makeCurveEvent("FTP-ZAR-2026-05-15", "2026-05-15T05:45:00Z"),
      makeAttributionEvent("ATTR-001", "2026-05-15T06:00:00Z", {
        transactionType: "loan",
        notional: 100_000_000,
        clientRate: 0.105,
        ftpRate: 0.092,
      }),
    ];
    const s = buildFtpPortfolio(events);
    expect(s.totalAttributions).toBe(1);
    expect(s.totalNotional).toBe(100_000_000);
    // spread = 0.105 - 0.092 = 0.013 → in bps = 130
    expect(s.weightedAvgSpread).toBeCloseTo(130, 4);
    expect(s.activeCurveId).toBe("FTP-ZAR-2026-05-15");
    expect(s.byTransactionType["loan"]).toBeDefined();
    expect(s.byTransactionType["loan"]!.count).toBe(1);
    expect(s.byTransactionType["loan"]!.totalNotional).toBe(100_000_000);
    expect(s.byTransactionType["loan"]!.avgSpread).toBeCloseTo(130, 4);
  });
});

// ---------------------------------------------------------------------------
// Multiple attributions
// ---------------------------------------------------------------------------

describe("buildFtpPortfolio — multiple attributions", () => {
  const events: Event[] = [
    makeCurveEvent("FTP-ZAR-2026-05-15", "2026-05-15T05:45:00Z"),
    // Loan: 100M notional, spread = +130 bps
    makeAttributionEvent("ATTR-001", "2026-05-15T06:00:00Z", {
      transactionType: "loan",
      notional: 100_000_000,
      clientRate: 0.105,
      ftpRate: 0.092,
    }),
    // Bond: 200M notional, spread = +50 bps
    makeAttributionEvent("ATTR-002", "2026-05-15T06:01:00Z", {
      transactionType: "bond",
      notional: 200_000_000,
      clientRate: 0.097,
      ftpRate: 0.092,
    }),
    // Deposit: 50M notional, spread = -20 bps (below FTP, bank loses)
    makeAttributionEvent("ATTR-003", "2026-05-15T06:02:00Z", {
      transactionType: "deposit",
      notional: 50_000_000,
      clientRate: 0.090,
      ftpRate: 0.092,
    }),
  ];

  const s = buildFtpPortfolio(events);

  it("counts total attributions", () => {
    expect(s.totalAttributions).toBe(3);
  });

  it("sums total notional", () => {
    expect(s.totalNotional).toBe(350_000_000);
  });

  it("computes notional-weighted average spread correctly", () => {
    // Notional-weighted spread:
    //   (100M × 0.013 + 200M × 0.005 + 50M × (-0.002)) / 350M
    //   = (1_300_000 + 1_000_000 - 100_000) / 350_000_000
    //   = 2_200_000 / 350_000_000 = 0.006285... → 62.85... bps
    const expectedBps = ((100_000_000 * 0.013 + 200_000_000 * 0.005 + 50_000_000 * (-0.002)) / 350_000_000) * 10_000;
    expect(s.weightedAvgSpread).toBeCloseTo(expectedBps, 2);
  });

  it("breaks down by transaction type", () => {
    expect(Object.keys(s.byTransactionType).sort()).toEqual(["bond", "deposit", "loan"]);

    expect(s.byTransactionType["loan"]!.count).toBe(1);
    expect(s.byTransactionType["bond"]!.count).toBe(1);
    expect(s.byTransactionType["deposit"]!.count).toBe(1);

    expect(s.byTransactionType["loan"]!.totalNotional).toBe(100_000_000);
    expect(s.byTransactionType["bond"]!.totalNotional).toBe(200_000_000);
    expect(s.byTransactionType["deposit"]!.totalNotional).toBe(50_000_000);

    // Avg spreads per type (in bps)
    expect(s.byTransactionType["loan"]!.avgSpread).toBeCloseTo(130, 4);
    expect(s.byTransactionType["bond"]!.avgSpread).toBeCloseTo(50, 4);
    expect(s.byTransactionType["deposit"]!.avgSpread).toBeCloseTo(-20, 4);
  });

  it("sets activeCurveId to the most recently published curve", () => {
    expect(s.activeCurveId).toBe("FTP-ZAR-2026-05-15");
  });

  it("sets lastUpdated to the latest event timestamp", () => {
    expect(s.lastUpdated).toBe("2026-05-15T06:02:00Z");
  });
});

// ---------------------------------------------------------------------------
// Multiple attributions across same transaction type
// ---------------------------------------------------------------------------

describe("buildFtpPortfolio — multiple attributions of the same type", () => {
  it("aggregates counts and notionals within a type", () => {
    const events: Event[] = [
      makeAttributionEvent("A1", "2026-05-15T06:00:00Z", {
        transactionType: "loan",
        notional: 100_000_000,
        clientRate: 0.10,
        ftpRate: 0.092,
      }),
      makeAttributionEvent("A2", "2026-05-15T06:01:00Z", {
        transactionType: "loan",
        notional: 50_000_000,
        clientRate: 0.11,
        ftpRate: 0.092,
      }),
    ];
    const s = buildFtpPortfolio(events);
    expect(s.totalAttributions).toBe(2);
    expect(s.byTransactionType["loan"]!.count).toBe(2);
    expect(s.byTransactionType["loan"]!.totalNotional).toBe(150_000_000);

    // Weighted avg spread for loans:
    // (100M × 0.008 + 50M × 0.018) / 150M = (800K + 900K) / 150M = 1700K / 150M
    // = 0.01133... → 113.33 bps
    const expectedBps = ((100_000_000 * 0.008 + 50_000_000 * 0.018) / 150_000_000) * 10_000;
    expect(s.byTransactionType["loan"]!.avgSpread).toBeCloseTo(expectedBps, 2);
  });
});
