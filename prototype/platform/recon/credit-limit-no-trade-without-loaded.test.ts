// platform/recon/credit-limit-no-trade-without-loaded.test.ts
//
// Tests for the credit-limit-no-trade-without-loaded recon pipeline.
// Author: Vera (Internal audit engineer)

import { describe, expect, it } from "bun:test";

import { extractCounterpartyId, run } from "./credit-limit-no-trade-without-loaded";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

function trade(args: {
  id: string;
  type: string;
  asOf: string;
  payload: Record<string, unknown>;
}): E {
  return { event_id: args.id, type: args.type, as_of: args.asOf, payload: args.payload };
}

function loaded(args: { id: string; cpid: string; asOf: string }): E {
  return {
    event_id: args.id,
    type: "CreditLimitLoaded",
    as_of: args.asOf,
    payload: { counterpartyId: args.cpid },
  };
}

describe("extractCounterpartyId", () => {
  it("returns direct counterpartyId when present", () => {
    expect(extractCounterpartyId({ counterpartyId: "CP-1" })).toBe("CP-1");
  });

  it("returns counterpartyLei when no direct counterpartyId", () => {
    expect(extractCounterpartyId({ counterpartyLei: "529900T8BM49AURSDO55" })).toBe(
      "529900T8BM49AURSDO55",
    );
  });

  it("returns nested counterparty.partyId for CDM partySchema events", () => {
    expect(extractCounterpartyId({ counterparty: { partyId: "CP-FX-1", role: "counterparty" } })).toBe(
      "CP-FX-1",
    );
  });

  it("returns null when no identifier is discoverable", () => {
    expect(extractCounterpartyId({})).toBeNull();
  });

  it("returns null when counterparty.partyId is missing", () => {
    expect(extractCounterpartyId({ counterparty: { role: "counterparty" } })).toBeNull();
  });
});

describe("recon:credit-limit-no-trade-without-loaded", () => {
  it("passes on a fresh bench (no trades, no loads)", () => {
    const r = run({ tradeEvents: [], loadedEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when every trade has a prior CreditLimitLoaded", () => {
    const r = run({
      tradeEvents: [
        trade({
          id: "t1",
          type: "TradeBooked",
          asOf: "2026-05-20T10:00:00Z",
          payload: { counterpartyId: "CP-1" },
        }),
        trade({
          id: "t2",
          type: "FxTradeExecuted",
          asOf: "2026-05-20T11:00:00Z",
          payload: { counterparty: { partyId: "CP-2", role: "counterparty" } },
        }),
      ],
      loadedEvents: [
        loaded({ id: "l1", cpid: "CP-1", asOf: "2026-05-01T00:00:00Z" }),
        loaded({ id: "l2", cpid: "CP-2", asOf: "2026-05-01T00:00:00Z" }),
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("fails Critical when a trade has NO CreditLimitLoaded for its counterparty", () => {
    const r = run({
      tradeEvents: [
        trade({
          id: "t1",
          type: "TradeBooked",
          asOf: "2026-05-20T10:00:00Z",
          payload: { counterpartyId: "CP-UNKNOWN" },
        }),
      ],
      loadedEvents: [loaded({ id: "l1", cpid: "CP-OTHER", asOf: "2026-05-01T00:00:00Z" })],
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("CP-UNKNOWN");
    expect(fails[0]?.message).toContain("PROC-RISK-CO-01");
  });

  it("fails Critical when CreditLimitLoaded post-dates the trade", () => {
    const r = run({
      tradeEvents: [
        trade({
          id: "t1",
          type: "TradeBooked",
          asOf: "2026-05-20T10:00:00Z",
          payload: { counterpartyId: "CP-1" },
        }),
      ],
      loadedEvents: [loaded({ id: "l1", cpid: "CP-1", asOf: "2026-05-21T00:00:00Z" })],
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("precedes the earliest CreditLimitLoaded");
  });

  it("surfaces info-only advisory when counterparty cannot be extracted", () => {
    const r = run({
      tradeEvents: [
        trade({
          id: "t1",
          type: "TradeBooked",
          asOf: "2026-05-20T10:00:00Z",
          payload: {}, // no counterparty field
        }),
      ],
      loadedEvents: [],
    });
    expect(r.ok).toBe(true); // info severity does not flip ok
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("info");
  });
});
