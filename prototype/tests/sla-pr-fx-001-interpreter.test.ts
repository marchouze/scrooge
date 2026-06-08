// tests/sla-pr-fx-001-interpreter.test.ts
//
// Interpreter-side leg-correctness regression for PR-FX-001 (FX-spot trade
// booking). The durable guard that the rules-as-data interpreter books every
// provisioned currency to its dedicated per-currency trading accounts, and routes
// any still-unprovisioned currency to the FX unresolved-currency suspense account
// with a high-severity urgent-correction alert — never a silent USD fallback.
//
// It replaces the retired byte-for-byte parallel-run suite (the legacy
// `fxTradeBookingJournals` + the legacy `runGlPostingEngine` dispatcher were the
// dead reference oracle, retired with the legacy GL posting engine in SLA
// full-retirement Stage 3). The expected legs below are the interpreter's own
// output — which the now-retired parallel-run proved equal to the (corrected)
// legacy helper for every provisioned currency.
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Stage 3) +
//            D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO-approved 2026-06-05).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { interpret } from "../platform/accounting/sla/interpreter";
import { PR_FX_001 } from "../platform/accounting/sla/rules/pr-fx-001";
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

interface NormalLeg {
  accountId: string;
  debitCredit: string;
  amountMinor: number;
  currency: string;
}

// Fixtures the interpreter books to dedicated per-currency accounts — ZAR/USD
// plus the provisioned GBP/EUR/CHF/AUD/JPY (D-SLA-FX-PER-CURRENCY-ACCOUNT-
// PROVISIONING). Each fixture carries its golden expected legs.
const PARITY_FIXTURES: ReadonlyArray<FixtureSpec & { expected: NormalLeg[] }> = [
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
    expected: [
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
    ],
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
    expected: [
      { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: 50_000_000, currency: "USD" },
      {
        accountId: "ACC-2100-004",
        debitCredit: "credit",
        amountMinor: 50_000_000,
        currency: "USD",
      },
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 945_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 945_000_000,
        currency: "ZAR",
      },
    ],
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
    expected: [
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
    ],
  },
  {
    name: "buy GBP/ZAR (pay ZAR, receive GBP)",
    side: "buy",
    base: "GBP",
    quote: "ZAR",
    payCurrency: "ZAR",
    receiveCurrency: "GBP",
    payMinor: 2_400_000_000,
    receiveMinor: 100_000_000,
    rate: 24.0,
    expected: [
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 2_400_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 2_400_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-010",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "GBP",
      },
      {
        accountId: "ACC-2100-011",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "GBP",
      },
    ],
  },
  {
    name: "buy CHF/ZAR (pay ZAR, receive CHF)",
    side: "buy",
    base: "CHF",
    quote: "ZAR",
    payCurrency: "ZAR",
    receiveCurrency: "CHF",
    payMinor: 2_100_000_000,
    receiveMinor: 100_000_000,
    rate: 21.0,
    expected: [
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 2_100_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 2_100_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-016",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "CHF",
      },
      {
        accountId: "ACC-2100-017",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "CHF",
      },
    ],
  },
  {
    name: "buy AUD/ZAR (pay ZAR, receive AUD)",
    side: "buy",
    base: "AUD",
    quote: "ZAR",
    payCurrency: "ZAR",
    receiveCurrency: "AUD",
    payMinor: 1_250_000_000,
    receiveMinor: 100_000_000,
    rate: 12.5,
    expected: [
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 1_250_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 1_250_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-019",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "AUD",
      },
      {
        accountId: "ACC-2100-020",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "AUD",
      },
    ],
  },
  {
    name: "buy JPY/ZAR (pay ZAR, receive JPY) — zero-minor-unit currency",
    side: "buy",
    base: "JPY",
    quote: "ZAR",
    payCurrency: "ZAR",
    receiveCurrency: "JPY",
    payMinor: 1_240_000_000,
    receiveMinor: 1_000_000, // JPY minor unit = 0; amountMinor == major units
    rate: 0.124,
    expected: [
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 1_240_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 1_240_000_000,
        currency: "ZAR",
      },
      { accountId: "ACC-2100-022", debitCredit: "debit", amountMinor: 1_000_000, currency: "JPY" },
      { accountId: "ACC-2100-023", debitCredit: "credit", amountMinor: 1_000_000, currency: "JPY" },
    ],
  },
  {
    name: "buy GBP/EUR (pay EUR, receive GBP) — both legs provisioned non-ZAR/USD",
    side: "buy",
    base: "GBP",
    quote: "EUR",
    payCurrency: "EUR",
    receiveCurrency: "GBP",
    payMinor: 117_000_000,
    receiveMinor: 100_000_000,
    rate: 1.17,
    expected: [
      {
        accountId: "ACC-2100-013",
        debitCredit: "debit",
        amountMinor: 117_000_000,
        currency: "EUR",
      },
      {
        accountId: "ACC-2100-014",
        debitCredit: "credit",
        amountMinor: 117_000_000,
        currency: "EUR",
      },
      {
        accountId: "ACC-2100-010",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "GBP",
      },
      {
        accountId: "ACC-2100-011",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "GBP",
      },
    ],
  },
];

// Fixture with a STILL-unprovisioned currency (SGD) — the foreign leg routes to
// the FX unresolved-currency suspense (ACC-2100-007) + an urgent correction;
// never the USD slot.
const DIVERGENCE_FIXTURE: FixtureSpec = {
  name: "buy SGD/ZAR (pay ZAR, receive SGD) — SGD unprovisioned",
  side: "buy",
  base: "SGD",
  quote: "ZAR",
  payCurrency: "ZAR",
  receiveCurrency: "SGD",
  payMinor: 1_400_000_000,
  receiveMinor: 100_000_000,
  rate: 14.0,
};

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
    clientFlowRef: "client-trade:sla-interpreter",
  } as FxTradeExecutedPayload;
}

function interpretPosting(payload: FxTradeExecutedPayload) {
  const event = { type: "FxTradeExecuted", entity: "LE-ZA-HOZ-BANK", as_of: ASOF, payload };
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
    accountId: String(l.accountId),
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

describe("PR-FX-001 — books each provisioned currency to its dedicated accounts", () => {
  for (const f of PARITY_FIXTURES) {
    it(`exact legs: ${f.name}`, () => {
      expect(normaliseInterpreterLegs(buildPayload(f))).toEqual(f.expected);
    });
  }
});

describe("PR-FX-001 — provisioned currencies land on dedicated accounts (not suspense, not USD)", () => {
  const EXPECTED: Record<string, { rec: string; pay: string }> = {
    GBP: { rec: "ACC-2100-010", pay: "ACC-2100-011" },
    EUR: { rec: "ACC-2100-013", pay: "ACC-2100-014" },
    CHF: { rec: "ACC-2100-016", pay: "ACC-2100-017" },
    AUD: { rec: "ACC-2100-019", pay: "ACC-2100-020" },
    JPY: { rec: "ACC-2100-022", pay: "ACC-2100-023" },
  };
  for (const f of PARITY_FIXTURES) {
    const foreign = [f.payCurrency, f.receiveCurrency].filter((c) => c in EXPECTED);
    if (foreign.length === 0) continue;
    it(`books ${foreign.join("/")} to dedicated accounts: ${f.name}`, () => {
      const interp = normaliseInterpreterLegs(buildPayload(f));
      const provisionedLegs = interp.filter((l) => l.currency in EXPECTED);
      expect(provisionedLegs.length).toBeGreaterThan(0);
      for (const leg of provisionedLegs) {
        const want = EXPECTED[leg.currency as keyof typeof EXPECTED];
        if (!want) throw new Error(`unexpected currency ${leg.currency}`);
        expect([want.rec, want.pay]).toContain(leg.accountId);
      }
      expect(interp.some((l) => l.accountId === "ACC-2100-007")).toBe(false);
      // the USD slot must not carry a non-USD leg
      for (const slot of ["ACC-2100-002", "ACC-2100-004"]) {
        const onSlot = interp.filter((l) => l.accountId === slot);
        for (const leg of onSlot) expect(leg.currency).toBe("USD");
      }
    });
  }
});

describe("PR-FX-001 — still-unprovisioned currency routes to suspense + urgent correction", () => {
  it(`routes the unprovisioned leg to suspense, never the USD slot: ${DIVERGENCE_FIXTURE.name}`, () => {
    const payload = buildPayload(DIVERGENCE_FIXTURE);
    const posting = interpretPosting(payload);
    const interp = posting.legs.map((l) => ({
      accountId: String(l.accountId),
      debitCredit: l.debitCredit,
      amountMinor: Number(l.amountMinor),
      currency: l.currency,
    }));

    // 1. Exact legs: ZAR books normally; SGD (unprovisioned) routes to suspense.
    expect(interp).toEqual([
      {
        accountId: "ACC-2100-001",
        debitCredit: "debit",
        amountMinor: 1_400_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-003",
        debitCredit: "credit",
        amountMinor: 1_400_000_000,
        currency: "ZAR",
      },
      {
        accountId: "ACC-2100-007",
        debitCredit: "debit",
        amountMinor: 100_000_000,
        currency: "SGD",
      },
      {
        accountId: "ACC-2100-007",
        debitCredit: "credit",
        amountMinor: 100_000_000,
        currency: "SGD",
      },
    ]);

    // 2. The unprovisioned (non-ZAR/USD) leg lands on suspense, never the USD slot.
    const foreignLegs = interp.filter((l) => l.currency !== "ZAR" && l.currency !== "USD");
    expect(foreignLegs.length).toBeGreaterThan(0);
    for (const leg of foreignLegs) expect(leg.accountId).toBe("ACC-2100-007");
    expect(interp.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
    expect(interp.some((l) => l.accountId === "ACC-2100-004")).toBe(false);

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
});

describe("PR-FX-001 balance invariant (per currency) — all fixtures", () => {
  for (const f of [...PARITY_FIXTURES, DIVERGENCE_FIXTURE]) {
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
