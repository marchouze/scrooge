// tests/sla-pr-fx-001-parallel-run.test.ts
//
// Parallel-run proof (Phase-0 spec §11.3, as corrected by
// D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE): real FxTradeExecuted fixtures are fed
// through BOTH the new rules-as-data interpreter (PR_FX_001) and the legacy
// `fxTradeBookingJournals` / `runGlPostingEngine`.
//
// CORRECTED success criterion (CEO design call, Marc, 2026-06-05):
//   - ZAR and USD legs MUST match the legacy engine BYTE-FOR-BYTE — same
//     accounts, same minor amounts, same currencies, balanced. These are the
//     currencies the legacy engine books CORRECTLY.
//   - EUR / GBP / any non-ZAR/USD currency MUST DELIBERATELY DIVERGE from the
//     legacy engine: the legacy `default → USD` fallback mis-booked them into
//     the USD account (ACC-2100-002/004); the corrected interpreter routes them
//     to the FX unresolved-currency suspense account (ACC-2100-007) and raises a
//     high-severity urgent-correction alert. The test asserts the CORRECTED
//     behaviour, NOT legacy parity — that divergence is the latent default-to-USD
//     defect being fixed.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { POSTING_RULE_IDS, runGlPostingEngine } from "../platform/accounting/gl-posting-engine";
import { fxTradeBookingJournals } from "../platform/accounting/posting-rules/fx-spot";
import { interpret } from "../platform/accounting/sla/interpreter";
import { PR_FX_001 } from "../platform/accounting/sla/rules/pr-fx-001";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";

const ASOF = "2026-06-05T10:00:00.000Z";

interface FixtureSpec {
  readonly name: string;
  readonly side: "buy" | "sell";
  readonly base: string;
  readonly quote: string;
  readonly payCurrency: string;
  readonly receiveCurrency: string;
  readonly payMinor: number;
  readonly receiveMinor: number;
  readonly rate: number;
}

// Fixtures the LEGACY engine books CORRECTLY (ZAR/USD only) — byte-for-byte
// parity is the regression target for these.
const PARITY_FIXTURES: readonly FixtureSpec[] = [
  {
    name: "buy USD/ZAR (pay ZAR, receive USD)",
    side: "buy",
    base: "USD",
    quote: "ZAR",
    payCurrency: "ZAR",
    receiveCurrency: "USD",
    payMinor: 1_900_000_000,
    receiveMinor: 100_000_000,
    rate: 19.0,
  },
  {
    name: "sell USD/ZAR (pay USD, receive ZAR)",
    side: "sell",
    base: "USD",
    quote: "ZAR",
    payCurrency: "USD",
    receiveCurrency: "ZAR",
    payMinor: 50_000_000,
    receiveMinor: 945_000_000,
    rate: 18.9,
  },
];

// Fixtures the legacy engine MIS-BOOKS (non-ZAR/USD → legacy USD-slot fallback).
// The corrected interpreter routes these to suspense + raises an urgent
// correction; the test asserts DIVERGENCE from legacy, NOT parity.
const DIVERGENCE_FIXTURES: readonly FixtureSpec[] = [
  {
    name: "buy EUR/ZAR (pay ZAR, receive EUR)",
    side: "buy",
    base: "EUR",
    quote: "ZAR",
    payCurrency: "ZAR",
    receiveCurrency: "EUR",
    payMinor: 2_050_000_000,
    receiveMinor: 100_000_000,
    rate: 20.5,
  },
  {
    name: "buy GBP/EUR (pay EUR, receive GBP) — both legs non-ZAR/USD",
    side: "buy",
    base: "GBP",
    quote: "EUR",
    payCurrency: "EUR",
    receiveCurrency: "GBP",
    payMinor: 117_000_000,
    receiveMinor: 100_000_000,
    rate: 1.17,
  },
];

function buildPayload(f: FixtureSpec): FxTradeExecutedPayload {
  return {
    tradeId: { value: `T-${f.name.slice(0, 6)}`, scheme: "urn:bank:trade-id" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: f.base, quote: f.quote },
    side: f.side,
    legs: [
      {
        legKind: "near",
        payCurrency: f.payCurrency,
        receiveCurrency: f.receiveCurrency,
        notional: { currency: f.payCurrency, amountMinor: f.payMinor },
        counterNotional: { currency: f.receiveCurrency, amountMinor: f.receiveMinor },
        rate: { currency: f.quote, amount: f.rate },
        settlementDate: { iso: "2026-06-09", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-06-05", calendar: "JIHCAL" },
    counterparty: {
      partyId: "CP-TEST-001",
      name: "Test Bank",
      role: "counterparty",
      jurisdiction: "ZA",
    },
    venue: "OTC",
    trader: "test-trader",
    bookId: "FX-SPOT-BOOK",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "client-trade:sla-parallel-run",
  } as FxTradeExecutedPayload;
}

interface NormalLeg {
  accountId: string;
  debitCredit: string;
  amountMinor: number;
  currency: string;
}

function interpretPosting(payload: FxTradeExecutedPayload) {
  const event = {
    type: "FxTradeExecuted",
    entity: "LE-ZA-HOZ-BANK",
    as_of: ASOF,
    payload,
  };
  const results = interpret(event, [PR_FX_001], ["IFRS"], ASOF);
  expect(results).toHaveLength(1);
  const r = results[0];
  if (!r || r.outcome !== "post") {
    throw new Error(`interpreter did not post: ${JSON.stringify(r)}`);
  }
  return r;
}

function normaliseInterpreterLegs(payload: FxTradeExecutedPayload): NormalLeg[] {
  return interpretPosting(payload).legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

describe("PR-FX-001 parallel run (ZAR/USD) — byte-for-byte vs legacy fxTradeBookingJournals", () => {
  for (const f of PARITY_FIXTURES) {
    it(`matches byte-for-byte: ${f.name}`, () => {
      const payload = buildPayload(f);

      const legacy = fxTradeBookingJournals({
        tradeId: payload.tradeId.value,
        side: payload.side,
        legs: payload.legs,
        currencyPair: payload.currencyPair,
      }).map((l) => ({ ...l }));

      const interp = normaliseInterpreterLegs(payload);

      expect(interp).toEqual(legacy);
    });
  }
});

describe("PR-FX-001 parallel run (ZAR/USD) — byte-for-byte vs runGlPostingEngine", () => {
  for (const f of PARITY_FIXTURES) {
    it(`matches the production dispatcher's emitted legs: ${f.name}`, () => {
      const payload = buildPayload(f);
      const event = makeFxTradeExecuted({
        asOf: ASOF,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:bea:gl-posting-engine" },
        citations: ["Principles/1-events-are-truth.md"],
        payload,
      });

      const engineResult = runGlPostingEngine({
        events: [event],
        now: () => ASOF,
        actor: { type: "service", id: "agent:bea:gl-posting-engine" },
        entity: "LE-ZA-HOZ-BANK",
      });

      const booking = engineResult.emittedPostings.find(
        (p) =>
          (p.payload as { postingType?: string }).postingType === "trade-booking" &&
          p.event_id.includes(POSTING_RULE_IDS.TRADE_BOOKING),
      );
      expect(booking).toBeDefined();
      const engineLegs = (booking?.payload as { legs: NormalLeg[] }).legs.map((l) => ({
        accountId: l.accountId,
        debitCredit: l.debitCredit,
        amountMinor: l.amountMinor,
        currency: l.currency,
      }));

      const interp = normaliseInterpreterLegs(payload);
      expect(interp).toEqual(engineLegs);
    });
  }
});

describe("PR-FX-001 parallel run (non-ZAR/USD) — suspense routing + urgent correction", () => {
  for (const f of DIVERGENCE_FIXTURES) {
    it(`routes foreign leg(s) to suspense, never the USD slot: ${f.name}`, () => {
      const payload = buildPayload(f);

      // After the Phase-2 deliverable-4 live-path fix, the LEGACY helper ALSO
      // routes non-ZAR/USD legs to the FX unresolved-currency suspense
      // (ACC-2100-007) — the silent default→USD mis-booking was removed. So the
      // corrected interpreter and the corrected legacy helper now AGREE
      // (parity-to-suspense), both landing the foreign leg on suspense.
      const legacy = fxTradeBookingJournals({
        tradeId: payload.tradeId.value,
        side: payload.side,
        legs: payload.legs,
        currencyPair: payload.currencyPair,
      }).map((l) => ({ ...l }));

      const posting = interpretPosting(payload);
      const interp = posting.legs.map((l) => ({
        accountId: String(l.accountId),
        debitCredit: l.debitCredit,
        amountMinor: Number(l.amountMinor),
        currency: l.currency,
      }));

      // 1. Interpreter and (corrected) legacy now agree — both route to suspense.
      expect(interp).toEqual(legacy.map((l) => ({ ...l })));

      // 2. Every non-ZAR/USD leg routes to the suspense account, NOT the USD
      //    slot (no silent USD fallback) — in BOTH paths.
      const foreignLegs = interp.filter((l) => l.currency !== "ZAR" && l.currency !== "USD");
      expect(foreignLegs.length).toBeGreaterThan(0);
      for (const leg of foreignLegs) expect(leg.accountId).toBe("ACC-2100-007");
      expect(interp.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
      expect(interp.some((l) => l.accountId === "ACC-2100-004")).toBe(false);
      expect(legacy.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
      expect(legacy.some((l) => l.accountId === "ACC-2100-004")).toBe(false);

      // 3. An urgent-correction alert is raised per unresolved currency.
      expect(posting.urgentCorrections.length).toBeGreaterThan(0);
      for (const c of posting.urgentCorrections) {
        expect(c.suspenseAccount).toBe("ACC-2100-007");
        expect(c.alertId.startsWith("alert:integrity:sla-unresolved-currency-")).toBe(true);
      }

      // 4. The entry still balances per currency.
      const byCcy = new Map<string, number>();
      for (const leg of interp) {
        const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
        byCcy.set(leg.currency, (byCcy.get(leg.currency) ?? 0) + signed);
      }
      for (const [, net] of byCcy) expect(net).toBe(0);
    });
  }
});

describe("PR-FX-001 balance invariant (per currency) — all fixtures", () => {
  for (const f of [...PARITY_FIXTURES, ...DIVERGENCE_FIXTURES]) {
    it(`balances DR == CR per currency: ${f.name}`, () => {
      const interp = normaliseInterpreterLegs(buildPayload(f));
      const byCcy = new Map<string, number>();
      for (const leg of interp) {
        const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
        byCcy.set(leg.currency, (byCcy.get(leg.currency) ?? 0) + signed);
      }
      for (const [, net] of byCcy) expect(net).toBe(0);
    });
  }
});
