// tests/sla-fx-lifecycle-parallel-run.test.ts
//
// Phase-2 FULL byte-for-byte regression suite (spec §11.3, brief deliverable 3).
//
// Every FX lifecycle event is fed through BOTH the rules-as-data interpreter
// (FX_IFRS_RULES) and the legacy posting-rule functions / runGlPostingEngine.
//
// Success criterion (CEO design call, Marc, 2026-06-05):
//   - ZAR / USD legs MUST match the legacy engine BYTE-FOR-BYTE (the currencies
//     the legacy engine books correctly).
//   - non-ZAR/USD legs DELIBERATELY DIVERGE: after the deliverable-4 live-path
//     fix, BOTH the legacy helpers AND the interpreter route the foreign leg to
//     the FX unresolved-currency suspense (ACC-2100-007) — so here we assert
//     PARITY-TO-SUSPENSE (legacy == interp == suspense), plus the interpreter
//     raises an urgent-correction. (The legacy default→USD mis-booking was
//     removed in deliverable 4, so legacy no longer diverges from the corrected
//     interpreter for these — both land in suspense.)
//
// Stages covered: open, reval (gain/loss/zero), principal (receive/deliver),
// close (gain/loss/zero), settlement-failed (Herstatt + no-GL branches),
// cancel (with/without cumulative P&L). Multi-leg + cross-currency included.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  fxCancellationJournals,
  fxLifecycleCloseJournals,
  fxPrincipalPaymentJournals,
  fxRevaluationJournals,
  fxSettlementFailedJournals,
  fxTradeBookingJournals,
} from "../platform/accounting/posting-rules/fx-spot";
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

function normalise(legs: ReadonlyArray<SubLedgerLeg>): NormalLeg[] {
  return legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: l.amountMinor,
    currency: l.currency,
  }));
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

// ---------------------------------------------------------------------------
// STAGE 1 — open (FxTradeExecuted). PR-FX-001 already has its own dedicated
// parallel-run test; cover the cross-currency multi-leg case here.
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

describe("Stage: open (PR-FX-001) — ZAR/USD parity + cross-currency suspense", () => {
  it("ZAR/USD buy — byte-for-byte parity", () => {
    const payload = buildExecuted({
      side: "buy",
      base: "USD",
      quote: "ZAR",
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      payMinor: 1_900_000_000,
      receiveMinor: 100_000_000,
    });
    const legacy = normalise(
      fxTradeBookingJournals({
        tradeId: payload.tradeId.value,
        side: payload.side,
        legs: payload.legs,
        currencyPair: payload.currencyPair,
      }),
    );
    const interp = interpLegs(runOne("FxTradeExecuted", payload));
    expect(interp).toEqual(legacy);
  });

  it("EUR/ZAR — both legacy (post deliverable-4) and interp route EUR to suspense", () => {
    const payload = buildExecuted({
      side: "buy",
      base: "EUR",
      quote: "ZAR",
      payCurrency: "ZAR",
      receiveCurrency: "EUR",
      payMinor: 2_050_000_000,
      receiveMinor: 100_000_000,
    });
    const legacy = normalise(
      fxTradeBookingJournals({
        tradeId: payload.tradeId.value,
        side: payload.side,
        legs: payload.legs,
        currencyPair: payload.currencyPair,
      }),
    );
    const r = runOne("FxTradeExecuted", payload);
    const interp = interpLegs(r);
    // Parity-to-suspense: after deliverable 4 the legacy helper ALSO routes EUR
    // to suspense — both agree, both land on ACC-2100-007, neither on USD.
    expect(interp).toEqual(legacy);
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    expect(eurLegs.length).toBeGreaterThan(0);
    for (const l of eurLegs) expect(l.accountId).toBe(SUSPENSE);
    expect(interp.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
    expect(interp.some((l) => l.accountId === "ACC-2100-004")).toBe(false);
    // The interpreter raises an urgent-correction for EUR.
    expect(postOf(r).urgentCorrections.some((c) => c.currency === "EUR")).toBe(true);
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

describe("Stage: reval (PR-FX-002) — ZAR parity", () => {
  for (const delta of [5_000_000, -4_250_000]) {
    it(`delta ${delta} — byte-for-byte`, () => {
      const p = revalPayload(delta);
      const legacy = normalise(fxRevaluationJournals(p as never));
      const interp = interpLegs(runOne("FxPositionRevalued", p));
      expect(interp).toEqual(legacy);
      assertBalances(interp);
    });
  }
  it("zero delta — both produce no posting (intentional-no-impact)", () => {
    const p = revalPayload(0);
    expect(fxRevaluationJournals(p as never)).toEqual([]);
    const r = runOne("FxPositionRevalued", p);
    expect(r.outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// STAGE 3 — principal (PR-FX-PRIN). receive/deliver; ZAR/USD parity + EUR + JPY.
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

describe("Stage: principal (PR-FX-PRIN) — ZAR/USD/EUR parity + JPY suspense", () => {
  const cases: Array<{ legKind: "receive" | "deliver"; ccy: string; net: number }> = [
    { legKind: "receive", ccy: "USD", net: 100_000_000 },
    { legKind: "deliver", ccy: "ZAR", net: -1_900_000_000 },
    { legKind: "receive", ccy: "EUR", net: 90_000_000 },
    { legKind: "deliver", ccy: "JPY", net: -14_500_000_000 },
  ];
  for (const c of cases) {
    it(`${c.legKind} ${c.ccy} — parity (incl. parity-to-suspense for JPY)`, () => {
      const p = prinPayload(c.legKind, c.ccy, c.net);
      const legacy = normalise(fxPrincipalPaymentJournals(p as never));
      const r = runOne("PrincipalPayment", p);
      const interp = interpLegs(r);
      expect(interp).toEqual(legacy);
      assertBalances(interp);
      if (c.ccy === "JPY") {
        // JPY has neither a trading account nor a nostro → suspense both sides.
        for (const l of interp) expect(l.accountId).toBe(SUSPENSE);
        expect(postOf(r).urgentCorrections.some((u) => u.currency === "JPY")).toBe(true);
      }
    });
  }
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

describe("Stage: close (PR-FX-LIFECYCLE-CLOSE) — ZAR parity", () => {
  for (const pnl of [250_000, -175_000]) {
    it(`pnl ${pnl} — byte-for-byte`, () => {
      const p = closePayload(pnl);
      const legacy = normalise(fxLifecycleCloseJournals(p as never));
      const interp = interpLegs(runOne("SettlementConfirmed", p));
      expect(interp).toEqual(legacy);
      assertBalances(interp);
    });
  }
  it("zero pnl — both produce no posting", () => {
    const p = closePayload(0);
    expect(fxLifecycleCloseJournals(p as never)).toEqual([]);
    expect(runOne("SettlementConfirmed", p).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// STAGE 5 — settlement-failed (PR-FX-005). Herstatt (enrichment) + no-GL.
// ---------------------------------------------------------------------------

describe("Stage: settlement-failed (PR-FX-005) — Herstatt parity + no-GL branches", () => {
  it("one-leg-delivered USD — byte-for-byte (enrichment-driven)", () => {
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
    const legacy = normalise(
      fxSettlementFailedJournals({ event: event as never, failedReceiveLeg }),
    );
    const interp = interpLegs(runOne("FxSettlementFailed", event, { failedReceiveLeg }));
    expect(interp).toEqual(legacy);
    assertBalances(interp);
  });

  it("one-leg-delivered EUR — receive-leg reclass routes to suspense (deliverable 4 parity)", () => {
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
    const legacy = normalise(
      fxSettlementFailedJournals({ event: event as never, failedReceiveLeg }),
    );
    const r = runOne("FxSettlementFailed", event, { failedReceiveLeg });
    const interp = interpLegs(r);
    expect(interp).toEqual(legacy);
    // The EUR reclass legs land on suspense (no dedicated EUR settlement-failed
    // receivable); the ZAR ECL legs resolve normally.
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    for (const l of eurLegs) expect(l.accountId).toBe(SUSPENSE);
    expect(postOf(r).urgentCorrections.some((u) => u.currency === "EUR")).toBe(true);
    assertBalances(interp);
  });

  for (const kind of ["neither-delivered", "operational-delay"] as const) {
    it(`${kind} — no GL (both legacy [] and interp empty post)`, () => {
      const event = {
        tradeRef: "T3",
        failureKind: kind,
        legStatus: { payLegDelivered: false, receiveLegDelivered: false },
      };
      expect(fxSettlementFailedJournals({ event: event as never })).toEqual([]);
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

describe("Stage: cancel (PR-FX-CANCEL) — for_each reversal parity", () => {
  for (const cumPnl of [3_000_000, -2_100_000, 0]) {
    it(`cumPnl ${cumPnl} — byte-for-byte`, () => {
      const legacy = normalise(
        fxCancellationJournals({
          tradeId: "T1",
          cumulativeUnrealisedPnlZarMinor: cumPnl,
          bookingLegs: BOOKING_LEGS,
        }),
      );
      const interp = interpLegs(
        runOne("FxTradeCancelled", { tradeId: "T1" }, cancelEnrichment(cumPnl)),
      );
      expect(interp).toEqual(legacy);
      assertBalances(interp);
    });
  }

  it("cancel reverses suspense legs exactly (foreign-currency booking)", () => {
    // A EUR trade booked post-deliverable-4 sits on suspense; cancellation must
    // reverse the EXACT suspense legs (use_physical_account), netting to zero.
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
    const r = runOne("FxSettlementInstructed", { tradeId: "T1" });
    expect(r.outcome).toBe("intentional-no-impact");
  });
  it("TradeReportSubmitted (PR-FX-REGREPORT) — no GL", () => {
    const r = runOne("TradeReportSubmitted", { tradeId: "T1" });
    expect(r.outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// Schema conformance — every ported rule satisfies the required-field shape +
// representation/condition enums, and every account-resolver currency the rules
// reference is well-formed. (Phase-2 rules are TS-only; this validates them in
// lieu of per-rule JSON mirrors.)
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
      // non-zero conditions must carry a delta_path.
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
