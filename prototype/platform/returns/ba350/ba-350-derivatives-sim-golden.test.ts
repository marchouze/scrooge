// platform/returns/ba350/ba-350-derivatives-sim-golden.test.ts
//
// SIMULATOR-FIRST DERIVATIVE BOOK — Phase 2b golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// Drives the BA 350 (Derivatives Instruments) inventory fold + cell-assembly to
// NON-ZERO outputs over a born-V2 simulated derivative book, and asserts the
// fold lands on HAND-COMPUTED golden-case figures (a domain-truth oracle, NOT
// internal consistency). A consistent-but-wrong inventory is a finding.
//
// It ALSO proves the provenance boundary (the R300m-into-Prod lesson):
//   - PRODUCTION-ONLY read of a store of simulated positions → empty inventory.
//   - SIMULATED-inclusive read of the same store → the golden inventory.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   Regulations Relating to Banks Reg 28 / Reg 30; D-FRTB-TRADING-DESK-STRUCTURE;
//   D-PROVENANCE-FILTER-ENFORCEMENT.
//
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { money } from "../../core/decimal-money";
import { encodeMoney } from "../../core/money-codec";
import { ZAR } from "../../core/types";
import {
  type DerivativeAssetClass,
  type DerivativeInstrumentType,
  type DerivativeMaturityBand,
  type DerivativeVenue,
  makeDerivativeTradingPositionOpened,
} from "../../event-store/event-types/derivative-book-positions";
import { simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import {
  type Ba350Book,
  ba350GrandTotal,
  ba350NetFairValueByAssetClassBook,
  ba350NotionalByAssetClassBook,
  foldBa350Derivatives,
} from "../../reporting/ba-350-derivatives-fold";
import { BA350_GAP_MATURITY_LADDER_MAPPING, assembleBa350Derivatives } from "./ba-350-derivatives";

const ENTITY = "LE-ZA-HOZ-BANK";
const PE = "2026-06-30";
const TRADING_DESK = "urn:desk:trading-desk:trading-desk-1";
const TREASURY_DESK = "urn:desk:treasury-desk:treasury-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:test:ba350" };
const SIM = simulatedTag({ scenario: "derivative-book-sim-v1", sourceLineage: "test" });

interface Spec {
  id: string;
  ac: DerivativeAssetClass;
  it: DerivativeInstrumentType;
  venue: DerivativeVenue;
  mb: DerivativeMaturityBand;
  notion: string;
  fv: string;
  book: "trading" | "banking-treasury";
}

const BOOK: readonly Spec[] = [
  {
    id: "a",
    ac: "interest-rate",
    it: "future-bought",
    venue: "exchange-traded",
    mb: "lt-1y",
    notion: "100000000",
    fv: "500000",
    book: "trading",
  },
  {
    id: "b",
    ac: "interest-rate",
    it: "future-sold",
    venue: "exchange-traded",
    mb: "1y-5y",
    notion: "60000000",
    fv: "-300000",
    book: "trading",
  },
  {
    id: "c",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    mb: "1y-5y",
    notion: "200000000",
    fv: "4000000",
    book: "trading",
  },
  {
    id: "d",
    ac: "interest-rate",
    it: "forward-fra",
    venue: "over-the-counter",
    mb: "lt-1y",
    notion: "80000000",
    fv: "120000",
    book: "trading",
  },
  {
    id: "e",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    mb: "gt-5y",
    notion: "150000000",
    fv: "-900000",
    book: "banking-treasury",
  },
  {
    id: "f",
    ac: "foreign-exchange",
    it: "forward-fra",
    venue: "over-the-counter",
    mb: "1y-5y",
    notion: "90000000",
    fv: "-600000",
    book: "trading",
  },
  {
    id: "g",
    ac: "equity",
    it: "future-bought",
    venue: "exchange-traded",
    mb: "lt-1y",
    notion: "40000000",
    fv: "200000",
    book: "trading",
  },
  {
    id: "h",
    ac: "equity",
    it: "put-option-written",
    venue: "over-the-counter",
    mb: "lt-1y",
    notion: "30000000",
    fv: "-250000",
    book: "trading",
  },
  {
    id: "i",
    ac: "commodity",
    it: "call-option-purchased",
    venue: "exchange-traded",
    mb: "1y-5y",
    notion: "20000000",
    fv: "150000",
    book: "trading",
  },
  {
    id: "j",
    ac: "credit",
    it: "credit-default-swap",
    venue: "over-the-counter",
    mb: "1y-5y",
    notion: "50000000",
    fv: "300000",
    book: "trading",
  },
];

function seed(store: EventStore): void {
  for (const s of BOOK) {
    store.append(
      makeDerivativeTradingPositionOpened({
        asOf: PE,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["c"],
        eventId: `T-${s.id}`,
        provenance: SIM,
        payload: {
          positionId: s.id,
          instrumentId: s.id,
          instrumentName: `${s.id} (sim)`,
          assetClass: s.ac,
          instrumentType: s.it,
          venue: s.venue,
          maturityBand: s.mb,
          notional: encodeMoney(money(s.notion, ZAR)),
          fairValue: encodeMoney(money(s.fv, ZAR)),
          deskId: s.book === "trading" ? TRADING_DESK : TREASURY_DESK,
          bookType: s.book,
          openedDate: PE,
          maturityDate: "2030-01-01",
        },
      }),
    );
  }
}

function foldUnder(store: EventStore, mode: "combined" | "production-only") {
  try {
    setDefaultProvenanceModeOverride(mode);
    return foldBa350Derivatives({ entity: ENTITY, periodEnd: PE, eventStore: store });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }
}

describe("BA 350 derivatives inventory — simulator-first golden case", () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore(":memory:");
    seed(store);
  });

  afterEach(() => {
    setDefaultProvenanceModeOverride(undefined);
  });

  it("folds the simulated book to the hand-computed notional oracle (per asset-class × book)", () => {
    const inv = foldUnder(store, "combined");
    const n = (ac: DerivativeAssetClass, b: Ba350Book) => ba350NotionalByAssetClassBook(inv, ac, b);
    // minor cents = major × 100.
    expect(n("interest-rate", "trading")).toBe(44_000_000_000); // R440m
    expect(n("interest-rate", "banking")).toBe(15_000_000_000); // R150m
    expect(n("foreign-exchange", "trading")).toBe(9_000_000_000); // R90m
    expect(n("equity", "trading")).toBe(7_000_000_000); // R70m
    expect(n("commodity", "trading")).toBe(2_000_000_000); // R20m
    expect(n("credit", "trading")).toBe(5_000_000_000); // R50m
  });

  it("folds the grand-total notional + net fair value to the oracle", () => {
    const inv = foldUnder(store, "combined");
    const g = ba350GrandTotal(inv);
    expect(g.notionalMinor).toBe(82_000_000_000); // R820m
    expect(g.netFairValueMinor).toBe(322_000_000); // +R3.22m
    expect(inv.totalPositions).toBe(10);
  });

  it("splits fair value into positive (asset) + negative (liability) legs summing to net", () => {
    const inv = foldUnder(store, "combined");
    // IR trading: +500k -300k +4m +120k → net +4.32m
    expect(ba350NetFairValueByAssetClassBook(inv, "interest-rate", "trading")).toBe(432_000_000);
    const g = ba350GrandTotal(inv);
    expect(g.positiveFairValueMinor + g.negativeFairValueMinor).toBe(g.netFairValueMinor);
    // grand positive: 500k+4m+120k+200k+150k+300k = 5.27m; negative: -300k-900k-600k-250k = -2.05m
    expect(g.positiveFairValueMinor).toBe(527_000_000);
    expect(g.negativeFairValueMinor).toBe(-205_000_000);
  });

  it("assembles the ETD/OTC venue split + credit Section-2 to the oracle", () => {
    const inv = foldUnder(store, "combined");
    const out = assembleBa350Derivatives({
      entity: ENTITY,
      asOf: PE,
      periodId: "p",
      functionalCurrency: "ZAR",
      inventory: inv,
    });
    const etd = out.venueSummary.find((l) => l.cellKey === "venue.exchange-traded.notional");
    const otc = out.venueSummary.find((l) => l.cellKey === "venue.over-the-counter.notional");
    expect(etd?.value.present && etd.value.value).toBe(22_000_000_000); // R220m
    expect(otc?.value.present && otc.value.value).toBe(60_000_000_000); // R600m
    const cds = out.creditDerivativeSection.find(
      (l) => l.cellKey === "section2.credit-default-swaps.notional",
    );
    expect(cds?.value.present && cds.value.value).toBe(5_000_000_000); // R50m
    // No TRS in the book → absent (zero by absence, not fabricated zero).
    const trs = out.creditDerivativeSection.find(
      (l) => l.cellKey === "section2.total-return-swaps.notional",
    );
    expect(trs?.value.present).toBe(false);
  });

  it("surfaces the deferred maturity-ladder mapping as a tracked gap", () => {
    const inv = foldUnder(store, "combined");
    const out = assembleBa350Derivatives({
      entity: ENTITY,
      asOf: PE,
      periodId: "p",
      functionalCurrency: "ZAR",
      inventory: inv,
    });
    expect(out.gaps).toContain(BA350_GAP_MATURITY_LADDER_MAPPING);
  });

  it("PROVENANCE BOUNDARY: production-only read of the simulated book is empty / absent", () => {
    const invProd = foldUnder(store, "production-only");
    expect(invProd.totalPositions).toBe(0);
    expect(ba350GrandTotal(invProd).notionalMinor).toBe(0);
    const out = assembleBa350Derivatives({
      entity: ENTITY,
      asOf: PE,
      periodId: "p",
      functionalCurrency: "ZAR",
      inventory: invProd,
    });
    // The grand-notional line is absent (zero by absence), never a fabricated 0.
    const grand = out.grandTotals.find((l) => l.cellKey === "grand.notional");
    expect(grand?.value.present).toBe(false);
  });
});
