// tests/fx-forward-points-accrual.test.ts
//
// IAS 21 §28 forward-points accrual — PR-FX-FWD-POINTS-ACCRUAL rule validation.
//
// Covers:
//   1. Premium slice (forward discount → bank receives more ZAR) — daily accrual posts
//      Dr fx.forward_points_deferred_income / Cr fx.forward_points_pnl.
//   2. Discount slice (forward premium → bank pays more ZAR) — daily accrual posts
//      Dr fx.forward_points_pnl / Cr fx.forward_points_deferred_expense.
//   3. Zero slice → intentional-no-impact (non-zero-delta condition).
//   4. FxForwardPointsAccrued factory enforces required fields (no hollow events).
//   5. Gap 2 (swap far-leg) is covered by PR-FX-PRIN — canary test from the
//      existing lifecycle-posting suite (referenced, not duplicated).
//   6. Swap far-leg legKind field accepted by the event schema.
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15); IAS 21 §28.
// Author: Nadia (Model validation engineer, engineering).

import { describe, expect, it } from "bun:test";

import { type InterpretResult, interpret } from "../platform/accounting/sla/interpreter";
import { FX_IFRS_RULES, PR_FX_FWD_POINTS_ACCRUAL } from "../platform/accounting/sla/rules";
import { makeFxForwardPointsAccrued } from "../platform/event-store/event-types/fx-accounting";

const ASOF = "2026-06-15T17:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:bea:accounting" };
const CITATIONS = ["D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL", "IAS-21"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runAccrual(
  dailyAmortisedZarMinor: number,
  accruedToDateZarMinor: number,
  opts: { isFinalAccrual?: boolean; legKind?: "outright" | "far" } = {},
): InterpretResult {
  const payload = {
    tradeId: "T-FWD-ACCRUAL-1",
    legKind: opts.legKind ?? "outright",
    currencyPair: "USD/ZAR",
    contractedForwardRate: 19.5,
    spotRateAtTradeDate: 18.5,
    notionalFcyMinor: 100_000_000, // USD 1m
    totalForwardPointsZarMinor: 100_000_000, // ZAR 1m total forward points
    dailyAmortisedZarMinor,
    accruedToDateZarMinor,
    tenorCalendarDays: 90,
    settlementDate: "2026-09-13",
    isFinalAccrual: opts.isFinalAccrual ?? false,
    accrualDate: "2026-06-15",
  };

  const event = makeFxForwardPointsAccrued({
    asOf: ASOF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload,
  });

  const results = interpret(
    { type: event.type, entity: ENTITY, as_of: ASOF, payload: event.payload },
    FX_IFRS_RULES,
    ["IFRS"],
    ASOF,
  );
  const r = results.find((x) => x.representation === "IFRS");
  if (!r) throw new Error("no IFRS result");
  return r;
}

function legsOf(r: InterpretResult): string[] {
  if (r.outcome !== "post")
    throw new Error(`expected post, got ${r.outcome}: ${JSON.stringify(r)}`);
  return r.legs.map((l) => `${l.debitCredit} ${l.accountId} ${l.amount.amount} ${l.currency}`);
}

// ---------------------------------------------------------------------------
// 1. Premium slice (dailyAmortisedZarMinor > 0)
// ---------------------------------------------------------------------------

describe("PR-FX-FWD-POINTS-ACCRUAL: premium slice", () => {
  it("posts Dr deferred-income / Cr forward-points-pnl for a forward premium day", () => {
    // Forward rate > spot → premium → bank earns income on the premium
    // Daily slice: ZAR 1,111,111 (1m / 90 days, roughly)
    const r = runAccrual(1_111_111, 1_111_111);
    const legs = legsOf(r);
    expect(legs).toHaveLength(2);
    // Dr deferred-income (ACC-2100-025) — reduces the deferred income liability
    // Amount is a decimal string (MoneyWire); 1_111_111 minor = "11111.11" ZAR
    expect(legs[0]).toMatch(/debit ACC-2100-025/);
    expect(legs[0]).toMatch(/ZAR/);
    // Cr forward-points P&L (ACC-2100-006 — realised FX P&L reused)
    expect(legs[1]).toMatch(/credit ACC-2100-006/);
    expect(legs[1]).toMatch(/ZAR/);
  });

  it("rule ID is PR-FX-FWD-POINTS-ACCRUAL", () => {
    const r = runAccrual(1_000_000, 1_000_000);
    expect(r.outcome).toBe("post");
    if (r.outcome === "post") expect(r.ruleId).toBe("PR-FX-FWD-POINTS-ACCRUAL");
  });
});

// ---------------------------------------------------------------------------
// 2. Discount slice (dailyAmortisedZarMinor < 0)
// ---------------------------------------------------------------------------

describe("PR-FX-FWD-POINTS-ACCRUAL: discount slice", () => {
  it("posts Dr forward-points-pnl / Cr deferred-expense for a forward discount day", () => {
    // Forward rate < spot → discount → bank incurs cost
    const r = runAccrual(-1_111_111, -1_111_111);
    const legs = legsOf(r);
    expect(legs).toHaveLength(2);
    // Dr P&L (ACC-2100-006)
    expect(legs[0]).toMatch(/debit ACC-2100-006/);
    expect(legs[0]).toMatch(/ZAR/);
    // Cr deferred-expense (ACC-2100-026)
    expect(legs[1]).toMatch(/credit ACC-2100-026/);
    expect(legs[1]).toMatch(/ZAR/);
  });
});

// ---------------------------------------------------------------------------
// 3. Zero slice → intentional-no-impact
// ---------------------------------------------------------------------------

describe("PR-FX-FWD-POINTS-ACCRUAL: zero slice", () => {
  it("produces intentional-no-impact when dailyAmortisedZarMinor = 0", () => {
    const r = runAccrual(0, 0);
    expect(r.outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// 4. Event factory schema enforcement
// ---------------------------------------------------------------------------

describe("FxForwardPointsAccrued factory", () => {
  it("requires at least one citation", () => {
    expect(() =>
      makeFxForwardPointsAccrued({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          tradeId: "T-1",
          legKind: "outright",
          currencyPair: "USD/ZAR",
          contractedForwardRate: 19.5,
          spotRateAtTradeDate: 18.5,
          notionalFcyMinor: 100_000_000,
          totalForwardPointsZarMinor: 1_000_000,
          dailyAmortisedZarMinor: 11_111,
          accruedToDateZarMinor: 11_111,
          tenorCalendarDays: 90,
          settlementDate: "2026-09-13",
          isFinalAccrual: false,
          accrualDate: "2026-06-15",
        },
      }),
    ).toThrow();
  });

  it("rejects a negative tenorCalendarDays", () => {
    expect(() =>
      makeFxForwardPointsAccrued({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "T-1",
          legKind: "outright",
          currencyPair: "USD/ZAR",
          contractedForwardRate: 19.5,
          spotRateAtTradeDate: 18.5,
          notionalFcyMinor: 100_000_000,
          totalForwardPointsZarMinor: 1_000_000,
          dailyAmortisedZarMinor: 11_111,
          accruedToDateZarMinor: 11_111,
          tenorCalendarDays: -5,
          settlementDate: "2026-09-13",
          isFinalAccrual: false,
          accrualDate: "2026-06-15",
        },
      }),
    ).toThrow();
  });

  it("accepts legKind 'far' for FX swap far-leg (Gap 2)", () => {
    // Gap 2: swap far-leg forward-points accrual. The event schema must accept
    // legKind="far" so the close engine can distinguish outright forwards from
    // swap far-legs in its audit trail.
    expect(() =>
      makeFxForwardPointsAccrued({
        asOf: ASOF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "T-SWAP-FAR-1",
          legKind: "far",
          currencyPair: "USD/ZAR",
          contractedForwardRate: 19.5,
          spotRateAtTradeDate: 18.5,
          notionalFcyMinor: 100_000_000,
          totalForwardPointsZarMinor: 1_000_000,
          dailyAmortisedZarMinor: 11_111,
          accruedToDateZarMinor: 11_111,
          tenorCalendarDays: 90,
          settlementDate: "2026-09-13",
          isFinalAccrual: false,
          accrualDate: "2026-06-15",
        },
      }),
    ).not.toThrow();
  });

  it("swap far-leg accrual routes through PR-FX-FWD-POINTS-ACCRUAL (no-eligible-rule guard)", () => {
    // The rule must fire for legKind='far' the same as 'outright'.
    const r = runAccrual(11_111, 11_111, { legKind: "far" });
    expect(r.outcome).toBe("post");
    if (r.outcome === "post") expect(r.ruleId).toBe("PR-FX-FWD-POINTS-ACCRUAL");
  });
});

// ---------------------------------------------------------------------------
// 5. Rule-set canary: PR-FX-FWD-POINTS-ACCRUAL is in FX_IFRS_RULES
// ---------------------------------------------------------------------------

describe("FX_IFRS_RULES set canary", () => {
  it("PR-FX-FWD-POINTS-ACCRUAL is in the FX_IFRS_RULES array", () => {
    const ids = FX_IFRS_RULES.map((r) => r.rule_id);
    expect(ids).toContain("PR-FX-FWD-POINTS-ACCRUAL");
  });

  it("PR-FX-FWD-POINTS-ACCRUAL triggers on FxForwardPointsAccrued (event_type canary)", () => {
    expect(PR_FX_FWD_POINTS_ACCRUAL.applies_to.event_type).toBe("FxForwardPointsAccrued");
    expect(PR_FX_FWD_POINTS_ACCRUAL.version).toBe(1);
  });
});
