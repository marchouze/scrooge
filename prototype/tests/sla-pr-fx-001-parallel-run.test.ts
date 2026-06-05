// tests/sla-pr-fx-001-parallel-run.test.ts
//
// Parallel-run proof (Phase-0 spec §11.3): real FxTradeExecuted fixtures are
// fed through BOTH the new rules-as-data interpreter (PR_FX_001) and the
// legacy `fxTradeBookingJournals` / `runGlPostingEngine`. The IFRS-representation
// legs MUST match BYTE-FOR-BYTE — same accounts, same minor amounts, same
// currencies, balanced.
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

// Real-shaped FX-spot fixtures spanning ZAR/USD both directions, EUR/ZAR, and
// a non-ZAR/USD pair (GBP/EUR) that exercises the FCY currency-pool resolver.
const FIXTURES: readonly FixtureSpec[] = [
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
    name: "buy GBP/EUR (pay EUR, receive GBP) — non-ZAR/USD, FCY pool both legs",
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

function normaliseInterpreterLegs(payload: FxTradeExecutedPayload): NormalLeg[] {
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
  return r.legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

describe("PR-FX-001 parallel run — interpreter vs legacy fxTradeBookingJournals", () => {
  for (const f of FIXTURES) {
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

describe("PR-FX-001 parallel run — interpreter vs runGlPostingEngine", () => {
  for (const f of FIXTURES) {
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

describe("PR-FX-001 balance invariant (per currency)", () => {
  for (const f of FIXTURES) {
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
