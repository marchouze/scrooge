// tests/fx-otc-forward-swap-lifecycle-posting.test.ts
//
// FX OTC umbrella (prd:bank:fx:otc-vanilla) — forward/swap lifecycle posting
// regression. Pins the build-3 resolution of the `fx-forward-swap-fvtpl-posting-
// rules` deferred gap (closed, PR #1165) and the dispatch-axis design ratified
// in PR #1171:
//
//   1. IN-SCOPE FLOWS POST (the "previously-blocked flow now passes" guard).
//      Under the CEO-ratified trading-FVTPL treatment (D-FX-FORWARDS-TRADING-
//      FVTPL), forward/swap revaluation, principal settlement and realised
//      close ALREADY post through PR-FX-002 / PR-FX-PRIN / PR-FX-LIFECYCLE-
//      CLOSE: `makeFlatFxContextBuilder` stamps instrument_type "FX-spot" for
//      EVERY flat FX lifecycle event ON PURPOSE (that axis is per-currency,
//      instrument-agnostic for FX), so no rule-widen was needed. This suite
//      fails loudly (no-eligible-rule) if anyone re-points the flat builder at
//      payload.productTaxonomy — the exact regression #1171 verified breaks
//      both dispatch and resolution.
//
//   2. OUT-OF-SCOPE FLOWS STILL BLOCK. A forward/swap FxTradeExecuted books
//      NOTHING at trade date (FVTPL derivative — no gross booking; PR-FX-001
//      is deliberately spot-only), surfacing as a `rejected: no-eligible-rule`
//      under the current rule set. First real forward/swap booking is the
//      targetTrigger that revisits this (an intentional-no-impact booking memo
//      is a Bea/CFO rule-ceremony call, not improvised here).
//
//   3. SPOT-GATE CANARY. The three rules' `applies_to.instrument_type` stays
//      exactly "FX-spot". Any widening must be a NEW rule version under the
//      supersede-never-edit ceremony (versioning.ts; recon:sla-rule-versioning),
//      never an in-place edit — this canary makes a silent edit visible.
//
// Authority: D-FX-FORWARDS-TRADING-FVTPL (CEO 2026-06-10);
//            D-FX-OTC-NPA-SCOPE-EXPANSION; D-SLA-ENGINE-RULES-AS-DATA.
// Author: Rohan (Risk engineer, engineering) — Scrooge-coordinated run,
//         brief:rohan:fx-otc-umbrella-npa-build-3-rule-widen-deferred-:2026-06-10.

import { describe, expect, it } from "bun:test";

import { type InterpretResult, interpret } from "../platform/accounting/sla/interpreter";
import {
  FX_IFRS_RULES,
  PR_FX_002,
  PR_FX_LIFECYCLE_CLOSE,
  PR_FX_PRIN,
} from "../platform/accounting/sla/rules";

const ASOF = "2026-06-12T17:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

function runOne(type: string, payload: unknown): InterpretResult {
  const results = interpret(
    { type, entity: ENTITY, as_of: ASOF, payload },
    FX_IFRS_RULES,
    ["IFRS"],
    ASOF,
  );
  const r = results.find((x) => x.representation === "IFRS");
  if (!r) throw new Error(`no IFRS result for ${type}`);
  return r;
}

function legsOf(r: InterpretResult): string[] {
  if (r.outcome !== "post")
    throw new Error(`expected post, got ${r.outcome}: ${JSON.stringify(r)}`);
  return r.legs.map((l) => `${l.debitCredit} ${l.accountId} ${l.amountMinor} ${l.currency}`);
}

// ---------------------------------------------------------------------------
// Lifecycle payloads. PrincipalPayment / SettlementConfirmed are trade-level
// flat events; a forward/swap leg settling is payload-identical to spot except
// for the optional attribution field — which the dispatch axis must IGNORE.
// ---------------------------------------------------------------------------

function revalPayload(productTaxonomy?: string) {
  return {
    tradeId: "T-FWD-1",
    currencyPair: "USD/ZAR",
    bookRate: 18.5,
    revalRate: 18.7,
    notionalBaseMinor: 100_000_000,
    unrealisedPnlZarMinor: 250_000,
    revaluedAt: ASOF,
    rateSource: "test",
    ...(productTaxonomy !== undefined ? { productTaxonomy } : {}),
  };
}

function prinPayload(
  legKind: "receive" | "deliver",
  currency: string,
  netCash: number,
  productTaxonomy?: string,
) {
  return {
    tradeId: "T-SWAP-1",
    legKind,
    currencyPair: "ZAR/USD",
    currency,
    netCash,
    settlementDate: "2026-06-09",
    settlementPath: "correspondent" as const,
    correspondent: { name: "Std Bank", bic: "SBZAZAJJ" },
    citations: ["D-FX-FORWARDS-TRADING-FVTPL"],
    ...(productTaxonomy !== undefined ? { productTaxonomy } : {}),
  };
}

function closePayload(pnl: number, productTaxonomy?: string) {
  return {
    tradeId: "T-FWD-1",
    currencyPair: "ZAR/USD",
    settledDate: "2026-06-09",
    realisedPnlDelta: pnl,
    settlementRef: "ref",
    citations: ["D-FX-FORWARDS-TRADING-FVTPL"],
    ...(productTaxonomy !== undefined ? { productTaxonomy } : {}),
  };
}

// ---------------------------------------------------------------------------
// 1. In-scope forward/swap lifecycle flows post — identically to spot.
// ---------------------------------------------------------------------------

describe("FX OTC umbrella — forward/swap lifecycle posts via the spot-stamped dispatch axis", () => {
  it("PR-FX-002: forward and swap revaluations book the same legs as spot", () => {
    const spot = legsOf(runOne("FxPositionRevalued", revalPayload("FX-spot")));
    expect(spot.length).toBeGreaterThan(0);
    for (const taxonomy of ["FX-forward", "FX-swap"]) {
      expect(legsOf(runOne("FxPositionRevalued", revalPayload(taxonomy)))).toEqual(spot);
    }
  });

  it("PR-FX-PRIN: a forward's settlement leg (receive USD) posts the same legs as spot", () => {
    const spot = legsOf(runOne("PrincipalPayment", prinPayload("receive", "USD", 100_000_000)));
    expect(spot).toEqual(["debit ACC-1200-002 100000000 USD", "credit ACC-2100-002 100000000 USD"]);
    for (const taxonomy of ["FX-forward", "FX-swap"]) {
      expect(
        legsOf(runOne("PrincipalPayment", prinPayload("receive", "USD", 100_000_000, taxonomy))),
      ).toEqual(spot);
    }
  });

  it("PR-FX-PRIN: a swap FAR-LEG deliver posts the standard derecognition legs (old fx-swap-far-leg-posting gap)", () => {
    const legs = legsOf(
      runOne("PrincipalPayment", prinPayload("deliver", "ZAR", -1_900_000_000, "FX-swap")),
    );
    expect(legs).toEqual([
      "debit ACC-2100-003 1900000000 ZAR",
      "credit ACC-1200-001 1900000000 ZAR",
    ]);
  });

  it("PR-FX-LIFECYCLE-CLOSE RETIRED (A4): SettlementConfirmed is now rejected by the SLA engine — realised P&L is posted by PR-FX-REALISED-PNL on RealisedPnlRecognised", () => {
    // A4 retirement: PR-FX-LIFECYCLE-CLOSE removed from FX_IFRS_RULES (D-FIL-BOOK-COMPOSITE-VALUATION).
    // SettlementConfirmed now produces "rejected" (no matching IFRS rule).
    const r = runOne("SettlementConfirmed", closePayload(250_000));
    expect(r.outcome).toBe("rejected");
    for (const taxonomy of ["FX-forward", "FX-swap"]) {
      const rTax = runOne("SettlementConfirmed", closePayload(250_000, taxonomy));
      expect(rTax.outcome).toBe("rejected");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Out-of-scope flows still block.
// ---------------------------------------------------------------------------

describe("FX OTC umbrella — out-of-scope flows still block", () => {
  // FxTradeExecuted is the ONE FX lifecycle event whose context builder derives
  // instrument_type from payload.productTaxonomy (not the flat spot stamp). A
  // forward/swap booking therefore matches NO rule: under FVTPL a derivative
  // has no gross booking at trade date (D-FX-FORWARDS-TRADING-FVTPL).
  it("FxTradeExecuted for a forward/swap books NOTHING (rejected: no-eligible-rule)", () => {
    for (const taxonomy of ["FX-forward", "FX-swap"]) {
      const r = runOne("FxTradeExecuted", {
        tradeId: { value: "T-FWD-BOOK", scheme: "urn:bank:trade-id" },
        productTaxonomy: taxonomy,
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 1_870_000_000 },
            counterNotional: { currency: "USD", amountMinor: 100_000_000 },
            rate: { currency: "ZAR", amount: 18.7 },
            settlementDate: { iso: "2026-09-09", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-06-12", calendar: "JIHCAL" },
        counterparty: { partyId: "CP-1", name: "CP", role: "counterparty", jurisdiction: "ZA" },
        venue: "OTC",
        trader: "t",
        bookId: "FX-OTC-BOOK",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        clientFlowRef: "client-trade:regression",
      });
      expect(r.outcome).toBe("rejected");
      if (r.outcome === "rejected") expect(r.reason).toBe("no-eligible-rule");
    }
  });

  it("spot-gate canary: the three lifecycle rules stay FX-spot-gated (widening = version ceremony, never an edit)", () => {
    for (const rule of [PR_FX_002, PR_FX_PRIN, PR_FX_LIFECYCLE_CLOSE]) {
      expect(rule.applies_to.instrument_type).toBe("FX-spot");
      expect(rule.version).toBe(1);
    }
  });
});
