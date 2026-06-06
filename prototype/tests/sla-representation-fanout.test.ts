// tests/sla-representation-fanout.test.ts
//
// Phase 4a — the parallel-representation pillar. Proves that one FX event fanned
// out across [IFRS, SARB-BA-RETURN] yields TWO independently-balanced
// ProposedPostings, and that adding the SARB representation does NOT change the
// IFRS posting (the additivity guarantee, spec §2.2).
//
//   1. Fan-out: interpret(FxTradeExecuted, FX_ALL_REPRESENTATION_RULES,
//      ["IFRS","SARB-BA-RETURN"]) → one IFRS post + one SARB post, each balanced
//      per currency.
//   2. SARB basis differs from IFRS: SARB lands in the BA-350 NOP memo accounts
//      (ACC-9000-xxx); IFRS lands in the trading accounts (ACC-2100-xxx).
//   3. Additivity: the IFRS ProposedPosting is byte-for-byte identical whether
//      interpreted ALONE (["IFRS"]) or alongside SARB (["IFRS","SARB-BA-RETURN"]).
//   4. NOP-neutral lifecycle: reval / principal / close / settlement-failure are
//      intentional-no-impact under SARB-BA-RETURN.
//   5. Cancellation: PR-FX-CANCEL-BA unwinds the NOP memo (with NOP enrichment).
//   6. Preview shape: buildRepresentationPreview returns the side-by-side view.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { interpret } from "../platform/accounting/sla/interpreter";
import type { InterpreterEvent, ProposedPosting } from "../platform/accounting/sla/interpreter";
import { buildRepresentationPreview } from "../platform/accounting/sla/representation-preview";
import {
  FX_ALL_REPRESENTATION_RULES,
  FX_IFRS_RULES,
} from "../platform/accounting/sla/rules";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";

const ASOF = "2026-06-06T10:00:00.000Z";
const REPS = ["IFRS", "SARB-BA-RETURN"];

// Buy USD / sell ZAR — the spec §3.2 worked example. Pay ZAR 19,000,000.00,
// receive USD 1,000,000.00 at 19.0.
function bookingPayload(): FxTradeExecutedPayload {
  return {
    tradeId: { value: "T-FANOUT-001", scheme: "urn:bank:trade-id" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: "buy",
    legs: [
      {
        legKind: "near",
        payCurrency: "ZAR",
        receiveCurrency: "USD",
        notional: { currency: "ZAR", amountMinor: 1_900_000_000 },
        counterNotional: { currency: "USD", amountMinor: 100_000_000 },
        rate: { currency: "ZAR", amount: 19.0 },
        settlementDate: { iso: "2026-06-09", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-06-06", calendar: "JIHCAL" },
    counterparty: { partyId: "CP-T", name: "T Bank", role: "counterparty", jurisdiction: "ZA" },
    venue: "OTC",
    trader: "t",
    bookId: "FX-SPOT-BOOK",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "sla-fanout",
  } as FxTradeExecutedPayload;
}

function bookingEvent(): InterpreterEvent {
  return {
    type: "FxTradeExecuted",
    entity: "LE-ZA-HOZ-BANK",
    as_of: ASOF,
    payload: bookingPayload(),
  };
}

function asPost(results: ReturnType<typeof interpret>, rep: string): ProposedPosting {
  const r = results.find((x) => x.representation === rep);
  if (!r || r.outcome !== "post") {
    throw new Error(`expected post for ${rep}, got ${JSON.stringify(r)}`);
  }
  return r;
}

function balancedPerCurrency(post: ProposedPosting): boolean {
  const net = new Map<string, bigint>();
  for (const l of post.legs) {
    const amt = BigInt(l.amountMinor);
    net.set(l.currency, (net.get(l.currency) ?? 0n) + (l.debitCredit === "debit" ? amt : -amt));
  }
  return [...net.values()].every((v) => v === 0n);
}

describe("SLA fan-out — one FX event → IFRS + SARB-BA-RETURN, each balanced", () => {
  it("yields two posts, each balanced independently per currency", () => {
    const results = interpret(bookingEvent(), FX_ALL_REPRESENTATION_RULES, REPS, ASOF);

    const ifrs = asPost(results, "IFRS");
    const sarb = asPost(results, "SARB-BA-RETURN");

    expect(ifrs.ruleId).toBe("PR-FX-001");
    expect(sarb.ruleId).toBe("PR-FX-001-BA");

    expect(balancedPerCurrency(ifrs)).toBe(true);
    expect(balancedPerCurrency(sarb)).toBe(true);
  });

  it("SARB basis differs structurally — NOP memo accounts, not the IFRS trading accounts", () => {
    const results = interpret(bookingEvent(), FX_ALL_REPRESENTATION_RULES, REPS, ASOF);
    const ifrs = asPost(results, "IFRS");
    const sarb = asPost(results, "SARB-BA-RETURN");

    // IFRS lands in the 2100 trading range.
    for (const l of ifrs.legs) {
      expect(l.accountId.startsWith("ACC-2100-")).toBe(true);
    }
    // SARB lands in the 9000 NOP memo range — a different physical range.
    const sarbAccounts = new Set(sarb.legs.map((l) => l.accountId));
    expect(sarbAccounts).toEqual(new Set(["ACC-9000-001", "ACC-9000-002"]));

    // The SARB memo is on the bought (receive-leg) currency, USD, balanced.
    for (const l of sarb.legs) expect(l.currency).toBe("USD");
    expect(sarb.legs.find((l) => l.accountId === "ACC-9000-001")?.debitCredit).toBe("debit");
    expect(sarb.legs.find((l) => l.accountId === "ACC-9000-002")?.debitCredit).toBe("credit");
  });

  it("ADDITIVITY — the IFRS posting is byte-for-byte unchanged by adding SARB", () => {
    const ifrsAlone = asPost(
      interpret(bookingEvent(), FX_IFRS_RULES, ["IFRS"], ASOF),
      "IFRS",
    );
    const ifrsWithSarb = asPost(
      interpret(bookingEvent(), FX_ALL_REPRESENTATION_RULES, REPS, ASOF),
      "IFRS",
    );

    // Same rule, same legs, same resolver decisions, same cites — byte-for-byte.
    expect(ifrsWithSarb.ruleId).toBe(ifrsAlone.ruleId);
    expect(ifrsWithSarb.ruleVersion).toBe(ifrsAlone.ruleVersion);
    expect(ifrsWithSarb.legs).toEqual(ifrsAlone.legs);
    expect(ifrsWithSarb.resolverDecisions).toEqual(ifrsAlone.resolverDecisions);
    expect(ifrsWithSarb.cites).toEqual(ifrsAlone.cites);
    expect(ifrsWithSarb.urgentCorrections).toEqual(ifrsAlone.urgentCorrections);
  });
});

describe("SARB-BA-RETURN NOP lifecycle scope", () => {
  const NOP_NEUTRAL: ReadonlyArray<{ type: string; payload: Record<string, unknown> }> = [
    { type: "FxPositionRevalued", payload: { unrealisedPnlZarMinor: 12345 } },
    { type: "PrincipalPayment", payload: { netCash: 100 } },
    { type: "SettlementConfirmed", payload: { netCash: 100 } },
    { type: "FxSettlementFailed", payload: { tradeRef: "T-1", failureKind: "one-leg-delivered" } },
  ];

  for (const ev of NOP_NEUTRAL) {
    it(`${ev.type} is intentional-no-impact under SARB-BA-RETURN`, () => {
      const results = interpret(
        { type: ev.type, entity: "LE-ZA-HOZ-BANK", as_of: ASOF, payload: ev.payload },
        FX_ALL_REPRESENTATION_RULES,
        ["SARB-BA-RETURN"],
        ASOF,
      );
      const r = results.find((x) => x.representation === "SARB-BA-RETURN");
      expect(r?.outcome).toBe("intentional-no-impact");
    });
  }

  it("FxTradeCancelled unwinds the NOP memo (PR-FX-CANCEL-BA, with enrichment)", () => {
    const results = interpret(
      {
        type: "FxTradeCancelled",
        entity: "LE-ZA-HOZ-BANK",
        as_of: ASOF,
        payload: { tradeId: { value: "T-FANOUT-001" } },
        enrichment: { nopReversal: { currency: "USD", amountMinor: 100_000_000 } },
      },
      FX_ALL_REPRESENTATION_RULES,
      ["SARB-BA-RETURN"],
      ASOF,
    );
    const sarb = asPost(results, "SARB-BA-RETURN");
    expect(sarb.ruleId).toBe("PR-FX-CANCEL-BA");
    expect(balancedPerCurrency(sarb)).toBe(true);
    // Reversal flips the booking memo: Cr nop_long / Dr nop_short.
    expect(sarb.legs.find((l) => l.accountId === "ACC-9000-001")?.debitCredit).toBe("credit");
    expect(sarb.legs.find((l) => l.accountId === "ACC-9000-002")?.debitCredit).toBe("debit");
  });
});

describe("buildRepresentationPreview — the side-by-side dry-run surface", () => {
  it("returns IFRS + SARB-BA-RETURN, each posted and balanced", () => {
    const preview = buildRepresentationPreview(bookingEvent(), ASOF);

    expect(preview.eventType).toBe("FxTradeExecuted");
    expect(preview.representations.map((r) => r.representation)).toEqual([
      "IFRS",
      "SARB-BA-RETURN",
    ]);

    const ifrs = preview.representations.find((r) => r.representation === "IFRS");
    const sarb = preview.representations.find((r) => r.representation === "SARB-BA-RETURN");

    expect(ifrs?.outcome).toBe("post");
    expect(ifrs?.balanced).toBe(true);
    expect(ifrs?.ruleId).toBe("PR-FX-001");

    expect(sarb?.outcome).toBe("post");
    expect(sarb?.balanced).toBe(true);
    expect(sarb?.ruleId).toBe("PR-FX-001-BA");
    expect(sarb?.legs.map((l) => l.accountId).sort()).toEqual(["ACC-9000-001", "ACC-9000-002"]);

    // Per-currency balance is surfaced and nets to zero.
    for (const rep of preview.representations) {
      for (const b of rep.perCurrencyBalance) {
        expect(b.balanced).toBe(true);
        expect(b.netMinor).toBe("0");
      }
    }
  });
});
