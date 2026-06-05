// tests/sla-fx-lifecycle-parallel-run.test.ts
//
// Phase-2 FULL byte-for-byte regression suite (spec §11.3, brief deliverable 3).
//
// Every FX lifecycle event is fed through BOTH the rules-as-data interpreter
// (FX_IFRS_RULES) and the legacy posting-rule functions / runGlPostingEngine.
//
// Success criterion (CEO design call, Marc, 2026-06-05; extended by
// D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING, CFO-approved 2026-06-05):
//   - Legacy and interpreter MUST agree BYTE-FOR-BYTE on every stage (the core
//     invariant). ZAR/USD plus the newly-provisioned GBP/EUR/CHF/AUD/JPY TRADING
//     legs now book to their own dedicated trading accounts (ACC-2100-010..024).
//   - The per-currency provisioning covers FX TRADING accounts only — NOT the
//     correspondent nostros (ACC-1200) nor the settlement-failed sub-ledger
//     (ACC-2300). So for GBP/CHF/AUD/JPY a PR-FX-PRIN NOSTRO leg, and for
//     GBP/EUR/CHF/AUD/JPY a PR-FX-005 settlement-failed-receivable leg, still
//     route to the FX unresolved-currency suspense (ACC-2100-007) + an
//     urgent-correction alert (these sub-ledgers are a follow-on provisioning).
//     Legacy and interpreter AGREE on this suspense routing.
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

  it("EUR/ZAR — both legacy and interp book EUR to its dedicated trading accounts", () => {
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
    // Parity-to-PROPER-ACCOUNTS (D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING):
    // EUR now has dedicated trading accounts; both engines agree, neither on
    // suspense nor on the USD slot, and NO urgent-correction is raised.
    expect(interp).toEqual(legacy);
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    expect(eurLegs.length).toBeGreaterThan(0);
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

describe("Stage: principal (PR-FX-PRIN) — ZAR/USD/EUR parity + JPY trading/nostro split", () => {
  const cases: Array<{ legKind: "receive" | "deliver"; ccy: string; net: number }> = [
    { legKind: "receive", ccy: "USD", net: 100_000_000 },
    { legKind: "deliver", ccy: "ZAR", net: -1_900_000_000 },
    { legKind: "receive", ccy: "EUR", net: 90_000_000 },
    { legKind: "deliver", ccy: "JPY", net: -14_500_000_000 },
  ];
  for (const c of cases) {
    it(`${c.legKind} ${c.ccy} — parity (JPY: trading→dedicated, nostro→suspense)`, () => {
      const p = prinPayload(c.legKind, c.ccy, c.net);
      const legacy = normalise(fxPrincipalPaymentJournals(p as never));
      const r = runOne("PrincipalPayment", p);
      const interp = interpLegs(r);
      expect(interp).toEqual(legacy);
      assertBalances(interp);
      if (c.ccy === "JPY") {
        // JPY now has a dedicated TRADING payable (ACC-2100-023) but NO
        // correspondent nostro — so the deliver leg splits: trading-payable on
        // the dedicated account, nostro side on suspense (+ urgent correction).
        const payableLeg = interp.find((l) => l.accountId === "ACC-2100-023");
        const nostroLeg = interp.find((l) => l.accountId === SUSPENSE);
        expect(payableLeg).toBeDefined();
        expect(nostroLeg).toBeDefined();
        // never the USD slot
        expect(interp.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
        expect(interp.some((l) => l.accountId === "ACC-2100-004")).toBe(false);
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

  it("one-leg-delivered EUR — reclass splits: trading-receivable dedicated, settlement-failed→suspense", () => {
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
    // EUR now has a dedicated TRADING receivable (ACC-2100-013) — the credit
    // leg that derecognises it resolves there. The DEBIT leg targets the
    // amortised-cost Settlement-Failed Receivable sub-ledger, which is NOT
    // provisioned for EUR (only ZAR/USD ACC-2300) → suspense + urgent
    // correction. The ZAR ECL legs resolve normally.
    const eurLegs = interp.filter((l) => l.currency === "EUR");
    expect(eurLegs.some((l) => l.accountId === "ACC-2100-013")).toBe(true);
    expect(eurLegs.some((l) => l.accountId === SUSPENSE)).toBe(true);
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
