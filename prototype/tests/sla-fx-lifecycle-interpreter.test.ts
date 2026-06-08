// tests/sla-fx-lifecycle-interpreter.test.ts
//
// Interpreter-side leg-correctness regression for the FX product family. The
// durable guard that the rules-as-data SLA interpreter (FX_IFRS_RULES) produces
// the CORRECT double-entry legs for every FX lifecycle stage. It replaces the
// retired byte-for-byte parallel-run suite (the legacy fx-spot.ts posting-rule
// functions + runGlPostingEngine were the dead reference oracle, retired with the
// legacy GL posting engine in SLA full-retirement Stage 3). The expected legs
// below are the interpreter's own output — which the now-retired parallel-run
// proved equal to the legacy engine for every currency the legacy engine booked
// correctly. Per-currency provisioning is asserted directly across BOTH
// provisioning waves:
//   - D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING: GBP/EUR/CHF/AUD/JPY TRADING
//     legs book to their own dedicated accounts (ACC-2100-010..024).
//   - D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (2026-06-08): the supported FX set
//     (ZAR/USD/EUR/GBP/JPY/CHF/AUD) now ALSO has dedicated correspondent nostros
//     (ACC-1200-001..007) and settlement-failed receivables (ACC-2300), so the
//     NOSTRO + settlement-failed sub-ledger legs for those currencies no longer
//     route to the FX unresolved-currency suspense (ACC-2100-007). Suspense +
//     urgent-correction remain the last-resort ONLY for genuinely UNsupported
//     currencies.
//
// Stages covered: open, reval (gain/loss/zero), principal (receive/deliver),
// close (gain/loss/zero), settlement-failed (Herstatt + no-GL branches),
// cancel (with/without cumulative P&L). Multi-leg + cross-currency included.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Stage 3, CEO-approved —
//            standing decision; Marc in-session 2026-06-08).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  type InterpretResult,
  type ProposedPosting,
  interpret,
} from "../platform/accounting/sla/interpreter";
import { FX_IFRS_RULES } from "../platform/accounting/sla/rules";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";

const ASOF = "2026-06-05T10:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const SUSPENSE = "ACC-2100-007";

interface NormalLeg {
  accountId: string;
  debitCredit: string;
  amountMinor: number;
  currency: string;
}

function runOne(type: string, payload: unknown, enrichment?: unknown): InterpretResult {
  const results = interpret(
    { type, entity: ENTITY, as_of: ASOF, payload, enrichment },
    FX_IFRS_RULES,
    ["IFRS"],
    ASOF,
  );
  const r = results.find((x) => x.representation === "IFRS");
  if (!r) throw new Error(`no IFRS result for ${type}`);
  return r;
}

function postOf(r: InterpretResult): ProposedPosting {
  if (r.outcome !== "post")
    throw new Error(`expected post, got ${r.outcome}: ${JSON.stringify(r)}`);
  return r;
}

function interpLegs(r: InterpretResult): NormalLeg[] {
  return postOf(r).legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

function assertBalances(legs: NormalLeg[]): void {
  const byCcy = new Map<string, number>();
  for (const l of legs) {
    const signed = l.debitCredit === "debit" ? l.amountMinor : -l.amountMinor;
    byCcy.set(l.currency, (byCcy.get(l.currency) ?? 0) + signed);
  }
  for (const [, net] of byCcy) expect(net).toBe(0);
}

/** Assert the interpreter produces exactly `expected` legs (+ balanced). */
function expectInterpreterLegs(
  type: string,
  payload: unknown,
  expected: NormalLeg[],
  enrichment?: unknown,
): void {
  const interp = interpLegs(runOne(type, payload, enrichment));
  expect(interp).toEqual(expected);
  assertBalances(interp);
}

// ---------------------------------------------------------------------------
// STAGE 1 — open (FxTradeExecuted). PR-FX-001 has its own dedicated suite; cover
// the cross-currency multi-leg case here (ZAR/USD + the dedicated-account EUR).
// ---------------------------------------------------------------------------

function buildExecuted(args: {
  side: "buy" | "sell";
  base: string;
  quote: string;
  payCurrency: string;
  receiveCurrency: string;
  payMinor: number;
  receiveMinor: number;
}): FxTradeExecutedPayload {
  return {
    tradeId: { value: "T-EXEC", scheme: "urn:bank:trade-id" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: args.base, quote: args.quote },
    side: args.side,
    legs: [
      {
        legKind: "near",
        payCurrency: args.payCurrency,
        receiveCurrency: args.receiveCurrency,
        notional: { currency: args.payCurrency, amountMinor: args.payMinor },
        counterNotional: { currency: args.receiveCurrency, amountMinor: args.receiveMinor },
        rate: { currency: args.quote, amount: 1 },
        settlementDate: { iso: "2026-06-09", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-06-05", calendar: "JIHCAL" },
    counterparty: { partyId: "CP-1", name: "CP", role: "counterparty", jurisdiction: "ZA" },
    venue: "OTC",
    trader: "t",
    bookId: "FX-SPOT-BOOK",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "client-trade:regression",
  } as FxTradeExecutedPayload;
}

describe("Stage: open (PR-FX-001) — ZAR/USD + EUR dedicated-account", () => {
  it("ZAR/USD buy", () => {
    const payload = buildExecuted({
      side: "buy",
      base: "USD",
      quote: "ZAR",
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      payMinor: 1_900_000_000,
      receiveMinor: 100_000_000,
    });
    expectInterpreterLegs("FxTradeExecuted", payload, [
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 1_900_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 1_900_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-002",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "USD",
      },
      {
        accountId: "ACC-2100-004",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "USD",
      },
    ]);
  });

  it("EUR/ZAR — EUR books to its dedicated trading accounts (no suspense, no USD slot, no alert)", () => {
    const payload = buildExecuted({
      side: "buy",
      base: "EUR",
      quote: "ZAR",
      payCurrency: "ZAR",
      receiveCurrency: "EUR",
      payMinor: 2_050_000_000,
      receiveMinor: 100_000_000,
    });
    const r = runOne("FxTradeExecuted", payload);
    const interp = interpLegs(r);
    expect(interp).toEqual([
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 2_050_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 2_050_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-013",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "EUR",
      },
      {
        accountId: "ACC-2100-014",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "EUR",
      },
    ]);
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    for (const l of eurLegs) expect(["ACC-2100-013", "ACC-2100-014"]).toContain(l.accountId);
    expect(interp.some((l) => l.accountId === SUSPENSE)).toBe(false);
    expect(interp.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
    expect(interp.some((l) => l.accountId === "ACC-2100-004")).toBe(false);
    expect(postOf(r).urgentCorrections.some((c) => c.currency === "EUR")).toBe(false);
    assertBalances(interp);
  });
});

// ---------------------------------------------------------------------------
// STAGE 2 — reval (PR-FX-002). All ZAR; gain/loss/zero.
// ---------------------------------------------------------------------------

function revalPayload(delta: number) {
  return {
    tradeId: "T1",
    currencyPair: "ZAR/USD",
    bookRate: 19,
    revalRate: 19.5,
    notionalBaseMinor: 100_000_000,
    unrealisedPnlZarMinor: delta,
    revaluedAt: ASOF,
    rateSource: "stub",
  };
}

describe("Stage: reval (PR-FX-002) — ZAR", () => {
  it("gain (delta +5,000,000)", () => {
    expectInterpreterLegs("FxPositionRevalued", revalPayload(5_000_000), [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 5_000_000, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 5_000_000, currency: "ZAR" },
    ]);
  });
  it("loss (delta -4,250,000)", () => {
    expectInterpreterLegs("FxPositionRevalued", revalPayload(-4_250_000), [
      { accountId: "ACC-2100-005", debitCredit: "debit", amountMinor: 4_250_000, currency: "ZAR" },
      { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 4_250_000, currency: "ZAR" },
    ]);
  });
  it("zero delta — no posting (intentional-no-impact)", () => {
    expect(runOne("FxPositionRevalued", revalPayload(0)).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// STAGE 3 — principal (PR-FX-PRIN). receive/deliver; ZAR/USD/EUR + JPY split.
// ---------------------------------------------------------------------------

function prinPayload(legKind: "receive" | "deliver", currency: string, netCash: number) {
  return {
    tradeId: "T1",
    legKind,
    currencyPair: "ZAR/USD",
    currency,
    netCash,
    settlementDate: "2026-06-09",
    settlementPath: "correspondent" as const,
    correspondent: { name: "Std Bank", bic: "SBZAZAJJ" },
    citations: ["c"],
  };
}

describe("Stage: principal (PR-FX-PRIN) — ZAR/USD/EUR + JPY trading/nostro split", () => {
  it("receive USD", () => {
    expectInterpreterLegs("PrincipalPayment", prinPayload("receive", "USD", 100_000_000), [
      {
        accountId: "ACC-1200-002",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "USD",
      },
      {
        accountId: "ACC-2100-002",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "USD",
      },
    ]);
  });
  it("deliver ZAR", () => {
    expectInterpreterLegs("PrincipalPayment", prinPayload("deliver", "ZAR", -1_900_000_000), [
      {
        accountId: "ACC-2100-003",
        debitCredit: "debit",
        amountMinor: 1_900_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-1200-001",
        debitCredit: "credit",
        amountMinor: 1_900_000_000,
        currency: "ZAR",
      },
    ]);
  });
  it("receive EUR — dedicated trading + dedicated nostro", () => {
    expectInterpreterLegs("PrincipalPayment", prinPayload("receive", "EUR", 90_000_000), [
      { accountId: "ACC-1200-003", debitCredit: "debit", amountMinor: 90_000_000, currency: "EUR" },
      {
        accountId: "ACC-2100-013",
        debitCredit: "credit",
        amountMinor: 90_000_000,
        currency: "EUR",
      },
    ]);
  });
  it("deliver JPY — trading→dedicated (ACC-2100-023), nostro→dedicated (ACC-1200-005), NO suspense, NO urgent correction", () => {
    // D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (2026-06-08): JPY now has a
    // dedicated correspondent nostro (ACC-1200-005), so the nostro leg no longer
    // account-resolution-misses to suspense.
    const r = runOne("PrincipalPayment", prinPayload("deliver", "JPY", -14_500_000_000));
    const interp = interpLegs(r);
    expect(interp).toEqual([
      {
        accountId: "ACC-2100-023",
        debitCredit: "debit",
        amountMinor: 14_500_000_000,
        currency: "JPY",
      },
      {
        accountId: "ACC-1200-005",
        debitCredit: "credit",
        amountMinor: 14_500_000_000,
        currency: "JPY",
      },
    ]);
    // never the USD slot, never suspense
    expect(interp.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
    expect(interp.some((l) => l.accountId === "ACC-2100-004")).toBe(false);
    expect(interp.some((l) => l.accountId === SUSPENSE)).toBe(false);
    expect(postOf(r).urgentCorrections.some((u) => u.currency === "JPY")).toBe(false);
    assertBalances(interp);
  });
});

// ---------------------------------------------------------------------------
// STAGE 4 — close (PR-FX-LIFECYCLE-CLOSE). All ZAR; gain/loss/zero.
// ---------------------------------------------------------------------------

function closePayload(pnl: number) {
  return {
    tradeId: "T1",
    currencyPair: "ZAR/USD",
    settledDate: "2026-06-09",
    realisedPnlDelta: pnl,
    settlementRef: "ref",
    citations: ["c"],
  };
}

describe("Stage: close (PR-FX-LIFECYCLE-CLOSE) — ZAR", () => {
  it("gain (pnl +250,000)", () => {
    expectInterpreterLegs("SettlementConfirmed", closePayload(250_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 250_000, currency: "ZAR" },
      { accountId: "ACC-2100-006", debitCredit: "credit", amountMinor: 250_000, currency: "ZAR" },
    ]);
  });
  it("loss (pnl -175,000)", () => {
    expectInterpreterLegs("SettlementConfirmed", closePayload(-175_000), [
      { accountId: "ACC-2100-006", debitCredit: "debit", amountMinor: 175_000, currency: "ZAR" },
      { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 175_000, currency: "ZAR" },
    ]);
  });
  it("zero pnl — no posting (intentional-no-impact)", () => {
    expect(runOne("SettlementConfirmed", closePayload(0)).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// STAGE 5 — settlement-failed (PR-FX-005). Herstatt (enrichment) + no-GL.
// ---------------------------------------------------------------------------

describe("Stage: settlement-failed (PR-FX-005) — Herstatt + no-GL branches", () => {
  it("one-leg-delivered USD — enrichment-driven Stage-3 ECL legs", () => {
    const event = {
      tradeRef: "T1",
      failureKind: "one-leg-delivered" as const,
      legStatus: { payLegDelivered: true, receiveLegDelivered: false },
    };
    const failedReceiveLeg = {
      currency: "USD",
      amountMinor: 100_000_000,
      zarEquivalentMinor: 1_900_000_000,
    };
    expectInterpreterLegs(
      "FxSettlementFailed",
      event,
      [
        {
          accountId: "ACC-2300-002",
          debitCredit: "debit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2100-002",
          debitCredit: "credit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2300-004",
          debitCredit: "debit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2300-003",
          debitCredit: "credit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
      ],
      { failedReceiveLeg },
    );
  });

  it("one-leg-delivered EUR — reclass splits: EUR trading-receivable + settlement-failed BOTH dedicated, NO suspense", () => {
    // D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (2026-06-08): EUR now has a
    // dedicated settlement-failed receivable (ACC-2300-005), so the defaulted-
    // claim leg no longer account-resolution-misses to suspense. The reclass
    // splits cleanly: Dr ACC-2300-005 (EUR defaulted claim) / Cr ACC-2100-013
    // (EUR trading receivable). The ZAR ECL allowance + expense remain ZAR.
    const event = {
      tradeRef: "T2",
      failureKind: "one-leg-delivered" as const,
      legStatus: { payLegDelivered: true, receiveLegDelivered: false },
    };
    const failedReceiveLeg = {
      currency: "EUR",
      amountMinor: 90_000_000,
      zarEquivalentMinor: 1_840_000_000,
    };
    const r = runOne("FxSettlementFailed", event, { failedReceiveLeg });
    const interp = interpLegs(r);
    expect(interp).toEqual([
      {
        accountId: "ACC-2300-005",
        debitCredit: "debit",
        amountMinor: 90_000_000,
        currency: "EUR",
      },
      {
        accountId: "ACC-2100-013",
        debitCredit: "credit",
        amountMinor: 90_000_000,
        currency: "EUR",
      },
      {
        accountId: "ACC-2300-004",
        debitCredit: "debit",
        amountMinor: 1_840_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2300-003",
        debitCredit: "credit",
        amountMinor: 1_840_000_000,
        currency: "ZAR",
      },
    ]);
    // EUR has a dedicated TRADING receivable (ACC-2100-013) AND a dedicated
    // settlement-failed receivable (ACC-2300-005) — neither routes to suspense.
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    expect(eurLegs.some((l) => l.accountId === "ACC-2100-013")).toBe(true);
    expect(eurLegs.some((l) => l.accountId === "ACC-2300-005")).toBe(true);
    expect(eurLegs.some((l) => l.accountId === SUSPENSE)).toBe(false);
    expect(postOf(r).urgentCorrections.some((u) => u.currency === "EUR")).toBe(false);
    assertBalances(interp);
  });

  for (const kind of ["neither-delivered", "operational-delay"] as const) {
    it(`${kind} — no GL (empty post)`, () => {
      const event = {
        tradeRef: "T3",
        failureKind: kind,
        legStatus: { payLegDelivered: false, receiveLegDelivered: false },
      };
      const r = runOne("FxSettlementFailed", event, {});
      expect(postOf(r).legs).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// STAGE 6 — cancel (PR-FX-CANCEL). Variable-length reversal via for_each.
// ---------------------------------------------------------------------------

const BOOKING_LEGS: SubLedgerLeg[] = [
  { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 1_900_000_000, currency: "ZAR" },
  { accountId: "ACC-2100-003", debitCredit: "credit", amountMinor: 1_900_000_000, currency: "ZAR" },
  { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: 100_000_000, currency: "USD" },
  { accountId: "ACC-2100-004", debitCredit: "credit", amountMinor: 100_000_000, currency: "USD" },
];

function cancelEnrichment(cumPnl: number) {
  return {
    reversalBookingLegs: BOOKING_LEGS.map((l) => ({
      accountId: l.accountId,
      debitCredit: l.debitCredit === "debit" ? "credit" : "debit",
      amountMinor: l.amountMinor,
      currency: l.currency,
    })),
    cumulativeUnrealisedPnlZarMinor: cumPnl,
  };
}

describe("Stage: cancel (PR-FX-CANCEL) — for_each reversal", () => {
  it("cumPnl +3,000,000 — booking reversal + MTM-undo gain reversal", () => {
    expectInterpreterLegs(
      "FxTradeCancelled",
      { tradeId: "T1" },
      [
        {
          accountId: "ACC-2100-001",
          debitCredit: "credit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-003",
          debitCredit: "debit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-002",
          debitCredit: "credit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2100-004",
          debitCredit: "debit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2100-005",
          debitCredit: "debit",
          amountMinor: 3_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-001",
          debitCredit: "credit",
          amountMinor: 3_000_000,
          currency: "ZAR",
        },
      ],
      cancelEnrichment(3_000_000),
    );
  });
  it("cumPnl -2,100,000 — booking reversal + MTM-undo loss reversal", () => {
    expectInterpreterLegs(
      "FxTradeCancelled",
      { tradeId: "T1" },
      [
        {
          accountId: "ACC-2100-001",
          debitCredit: "credit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-003",
          debitCredit: "debit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-002",
          debitCredit: "credit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2100-004",
          debitCredit: "debit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2100-001",
          debitCredit: "debit",
          amountMinor: 2_100_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-005",
          debitCredit: "credit",
          amountMinor: 2_100_000,
          currency: "ZAR",
        },
      ],
      cancelEnrichment(-2_100_000),
    );
  });
  it("cumPnl 0 — booking reversal only (no MTM-undo leg)", () => {
    expectInterpreterLegs(
      "FxTradeCancelled",
      { tradeId: "T1" },
      [
        {
          accountId: "ACC-2100-001",
          debitCredit: "credit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-003",
          debitCredit: "debit",
          amountMinor: 1_900_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-2100-002",
          debitCredit: "credit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
        {
          accountId: "ACC-2100-004",
          debitCredit: "debit",
          amountMinor: 100_000_000,
          currency: "USD",
        },
      ],
      cancelEnrichment(0),
    );
  });

  it("cancel reverses suspense legs exactly (historical foreign-currency booking)", () => {
    // A EUR trade HISTORICALLY booked to suspense (pre-
    // D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS); cancellation must reverse the
    // EXACT original legs verbatim (use_physical_account), netting to zero —
    // the reversal path replays stored legs and does NOT re-resolve through the
    // resolver, so it correctly reverses to suspense even though a fresh EUR
    // booking would now route to dedicated accounts.
    const eurBooking: SubLedgerLeg[] = [
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 2_050_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 2_050_000_000,
        currency: "ZAR",
      },
      { accountId: SUSPENSE, debitCredit: "debit", amountMinor: 100_000_000, currency: "EUR" },
      { accountId: SUSPENSE, debitCredit: "credit", amountMinor: 100_000_000, currency: "EUR" },
    ];
    const enrichment = {
      reversalBookingLegs: eurBooking.map((l) => ({
        accountId: l.accountId,
        debitCredit: l.debitCredit === "debit" ? "credit" : "debit",
        amountMinor: l.amountMinor,
        currency: l.currency,
      })),
      cumulativeUnrealisedPnlZarMinor: 0,
    };
    const interp = interpLegs(runOne("FxTradeCancelled", { tradeId: "T-EUR" }, enrichment));
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    expect(eurLegs.length).toBe(2);
    for (const l of eurLegs) expect(l.accountId).toBe(SUSPENSE);
    assertBalances(interp);
  });
});

// ---------------------------------------------------------------------------
// Memo rules — intentional-no-impact.
// ---------------------------------------------------------------------------

describe("Memo rules — intentional-no-impact", () => {
  it("FxSettlementInstructed (PR-FX-INSTRUCT) — no GL", () => {
    expect(runOne("FxSettlementInstructed", { tradeId: "T1" }).outcome).toBe(
      "intentional-no-impact",
    );
  });
  it("TradeReportSubmitted (PR-FX-REGREPORT) — no GL", () => {
    expect(runOne("TradeReportSubmitted", { tradeId: "T1" }).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// Schema conformance — every ported FX rule satisfies the contract.
// ---------------------------------------------------------------------------

describe("FX_IFRS_RULES schema conformance", () => {
  it("every rule carries the schema-required fields + valid enums", () => {
    for (const rule of FX_IFRS_RULES) {
      expect(typeof rule.rule_id).toBe("string");
      expect(rule.rule_id.startsWith("PR-")).toBe(true);
      expect(["IFRS", "SARB-BA-RETURN", "ZA-TAX"]).toContain(rule.representation);
      expect(rule.version).toBeGreaterThanOrEqual(1);
      expect(rule.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rule.applies_to.event_type.length).toBeGreaterThan(0);
      expect(["always", "non-zero-delta", "non-zero-pnl", "intentional-no-impact"]).toContain(
        rule.condition.kind,
      );
      if (rule.condition.kind === "non-zero-delta" || rule.condition.kind === "non-zero-pnl") {
        expect(rule.condition.delta_path).toBeDefined();
      }
      expect(rule.balancing).toBe("assert_zero");
      expect(rule.cites.length).toBeGreaterThan(0);
    }
  });

  it("rule ids are unique", () => {
    const ids = FX_IFRS_RULES.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
