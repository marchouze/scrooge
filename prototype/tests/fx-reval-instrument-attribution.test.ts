// tests/fx-reval-instrument-attribution.test.ts
//
// Instrument-level attribution for FX revaluation (task_4b5a0be3 /
// D-FX-OTC-NPA-SCOPE-EXPANSION). FxPositionRevalued now carries the originating
// `productTaxonomy` so projections/reports can split FX P&L by instrument.
//
// Two guarantees:
//   1. The field round-trips through the event factory (schema accepts it).
//   2. The SLA dispatch axis is instrument-AGNOSTIC for FX: an FxPositionRevalued
//      books the SAME legs (accounts + amounts) regardless of productTaxonomy
//      (FX-spot / FX-forward / FX-swap / NDF), because FX rules + the resolver are
//      per-currency, not per-instrument. So adding the attribution field has NO
//      posting impact — instrument_type stays "FX-spot" on the dispatch axis;
//      attribution lives on the event payload.
//
// Author: Bea (Accounting policy engineer, finance) — Scrooge-coordinated session.

import { describe, expect, it } from "bun:test";

import { interpret } from "../platform/accounting/sla/interpreter";
import { FX_IFRS_RULES } from "../platform/accounting/sla/rules";
import { makeFxPositionRevalued } from "../platform/event-store/event-types/fx-accounting";

const ASOF = "2026-06-12T17:00:00.000Z";

function revalEvent(productTaxonomy: string) {
  return {
    type: "FxPositionRevalued",
    entity: "LE-ZA-HOZ-BANK",
    as_of: ASOF,
    payload: {
      tradeId: "T-ATTR",
      currencyPair: "USD/ZAR",
      bookRate: 18.5,
      revalRate: 18.7,
      notionalBaseMinor: 100_000_000,
      unrealisedPnlZarMinor: 250_000,
      revaluedAt: ASOF,
      rateSource: "test",
      productTaxonomy,
    },
  };
}

function postedLegs(productTaxonomy: string) {
  const results = interpret(revalEvent(productTaxonomy), FX_IFRS_RULES, ["IFRS"], ASOF);
  const r = results.find((x) => x.outcome === "post");
  if (!r || r.outcome !== "post") throw new Error(`expected a post for ${productTaxonomy}`);
  return r.legs.map((l) => `${l.debitCredit} ${l.accountId} ${l.amountMinor} ${l.currency}`);
}

describe("FX revaluation — instrument attribution", () => {
  it("event factory accepts and carries productTaxonomy", () => {
    const ev = makeFxPositionRevalued({
      asOf: ASOF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:bea:accounting" },
      citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
      payload: revalEvent("FX-forward").payload,
    });
    expect((ev.payload as { productTaxonomy?: string }).productTaxonomy).toBe("FX-forward");
  });

  it("dispatch is instrument-agnostic: spot/forward/swap/NDF book identical legs", () => {
    const spot = postedLegs("FX-spot");
    expect(spot.length).toBeGreaterThan(0);
    for (const taxonomy of ["FX-forward", "FX-swap", "NDF"]) {
      expect(postedLegs(taxonomy)).toEqual(spot);
    }
  });

  it("a legacy event without productTaxonomy still books the same legs (fallback)", () => {
    const ev = {
      type: "FxPositionRevalued",
      entity: "LE-ZA-HOZ-BANK",
      as_of: ASOF,
      payload: {
        tradeId: "T-LEGACY",
        currencyPair: "USD/ZAR",
        bookRate: 18.5,
        revalRate: 18.7,
        notionalBaseMinor: 100_000_000,
        unrealisedPnlZarMinor: 250_000,
        revaluedAt: ASOF,
        rateSource: "test",
      },
    };
    const results = interpret(ev, FX_IFRS_RULES, ["IFRS"], ASOF);
    const r = results.find((x) => x.outcome === "post");
    if (!r || r.outcome !== "post") throw new Error("expected a post for legacy event");
    expect(r.legs.map((l) => `${l.debitCredit} ${l.accountId} ${l.amountMinor}`)).toEqual(
      postedLegs("FX-spot").map((s) => s.split(" ").slice(0, 3).join(" ")),
    );
  });
});
