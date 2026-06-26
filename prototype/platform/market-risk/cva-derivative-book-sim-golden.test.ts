// platform/market-risk/cva-derivative-book-sim-golden.test.ts
//
// SIMULATOR-FIRST CVA — Phase 2b golden-case validation (D-BA-RETURN-SIMULATOR-
// FIRST). Drives the standardised CVA engine (computeCva) + the CVA RWA leg
// (computeCvaRwaLeg) over the born-V2 simulated derivative book and asserts:
//   - the per-counterparty EAD / PD / CVA land on a HAND-COMPUTED BCBS golden
//     case (standardised BA-CVA reduced: Σ LGD × EAD × PD × discount), a
//     domain-truth oracle, NOT internal consistency;
//   - the CVA RWA leg = CVA capital × 12.5;
//   - the PROVENANCE boundary holds: a production-only read of the simulated
//     book → `no-otc-exposure` (loud zero), CVA RWA leg 0; the simulated read
//     drives both non-zero.
//
// GOLDEN CASE (LGD 0.6, discount 0.97, fallback PD bank 0.005 / corporate 0.02;
// derivative PFE add-ons IR 0.5% / FX 1% / equity 8% / credit 5%):
//   CP_BANK (bank): current exposure = +4m (swap) + 120k (FRA) + 300k (CDS) + 0
//     (banking swap −900k → 0) = R4.42m; PFE = 0.005×200m + 0.005×80m + 0.05×50m
//     + 0.005×150m = 1m + 400k + 2.5m + 750k = R4.65m; EAD = R9.07m;
//     CVA = 0.6 × 9.07m × 0.005 × 0.97 = R26,393.70.
//   CP_CORP (corporate): current exposure = 0 (both FV negative); PFE =
//     0.01×90m (FX) + 0.08×30m (equity) = 900k + 2.4m = R3.3m; EAD = R3.3m;
//     CVA = 0.6 × 3.3m × 0.02 × 0.97 = R38,412.00.
//   TOTAL CVA = R64,805.70. CVA RWA = 64,805.70 × 12.5 = R810,071.25.
//   ETD position (no counterparty) is EXCLUDED.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1
//   Slice 5; BCBS d424 MAR50; D-PROVENANCE-FILTER-ENFORCEMENT.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import { ZAR } from "../core/types";
import {
  type DerivativeAssetClass,
  type DerivativeInstrumentType,
  type DerivativeVenue,
  makeDerivativeTradingPositionOpened,
} from "../event-store/event-types/derivative-book-positions";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import type { ProvenanceFilter } from "../projections/filter";
import { computeCva } from "./cva-engine";
import { computeCvaRwaLeg } from "./cva-rwa-leg";

const ENTITY = "LE-ZA-HOZ-BANK";
const PE = "2026-06-30";
const TRADING_DESK = "urn:desk:trading-desk:trading-desk-1";
const TREASURY_DESK = "urn:desk:treasury-desk:treasury-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:test:cva" };
const SIM = simulatedTag({ scenario: "derivative-book-sim-v1", sourceLineage: "test" });
const CP_BANK = "urn:party:legal-entity:standard-bank-za";
const CP_CORP = "urn:party:legal-entity:acme-corp-ltd";

const COMBINED: ProvenanceFilter = { mode: "combined" };
const PRODUCTION: ProvenanceFilter = { mode: "production-only" };

interface Spec {
  id: string;
  ac: DerivativeAssetClass;
  it: DerivativeInstrumentType;
  venue: DerivativeVenue;
  notion: string;
  fv: string;
  book: "trading" | "banking-treasury";
  cp?: { id: string; name: string };
}

const BOOK: readonly Spec[] = [
  {
    id: "swap-bank",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    notion: "200000000",
    fv: "4000000",
    book: "trading",
    cp: { id: CP_BANK, name: "Standard Bank (sim)" },
  },
  {
    id: "fra-bank",
    ac: "interest-rate",
    it: "forward-fra",
    venue: "over-the-counter",
    notion: "80000000",
    fv: "120000",
    book: "trading",
    cp: { id: CP_BANK, name: "Standard Bank (sim)" },
  },
  {
    id: "cds-bank",
    ac: "credit",
    it: "credit-default-swap",
    venue: "over-the-counter",
    notion: "50000000",
    fv: "300000",
    book: "trading",
    cp: { id: CP_BANK, name: "Standard Bank (sim)" },
  },
  {
    id: "swap-banking-bank",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    notion: "150000000",
    fv: "-900000",
    book: "banking-treasury",
    cp: { id: CP_BANK, name: "Standard Bank (sim)" },
  },
  {
    id: "fx-corp",
    ac: "foreign-exchange",
    it: "forward-fra",
    venue: "over-the-counter",
    notion: "90000000",
    fv: "-600000",
    book: "trading",
    cp: { id: CP_CORP, name: "Acme Corp Ltd (sim)" },
  },
  {
    id: "eqopt-corp",
    ac: "equity",
    it: "put-option-written",
    venue: "over-the-counter",
    notion: "30000000",
    fv: "-250000",
    book: "trading",
    cp: { id: CP_CORP, name: "Acme Corp Ltd (sim)" },
  },
  // ETD with no counterparty — must be excluded from CVA.
  {
    id: "etd-fut",
    ac: "interest-rate",
    it: "future-bought",
    venue: "exchange-traded",
    notion: "100000000",
    fv: "500000",
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
        eventId: `CVA-${s.id}`,
        provenance: SIM,
        payload: {
          positionId: s.id,
          instrumentId: s.id,
          instrumentName: `${s.id} (sim)`,
          assetClass: s.ac,
          instrumentType: s.it,
          venue: s.venue,
          maturityBand: "1y-5y",
          notional: encodeMoney(money(s.notion, ZAR)),
          fairValue: encodeMoney(money(s.fv, ZAR)),
          deskId: s.book === "trading" ? TRADING_DESK : TREASURY_DESK,
          bookType: s.book,
          openedDate: PE,
          maturityDate: "2030-01-01",
          ...(s.cp ? { counterpartyId: s.cp.id, counterpartyName: s.cp.name } : {}),
        },
      }),
    );
  }
}

describe("CVA over the simulated derivative book — Phase 2b golden case", () => {
  let store: EventStore;
  let md: MarketDataStore;

  beforeEach(() => {
    store = new EventStore(":memory:");
    seed(store);
    md = new MarketDataStore(":memory:");
  });

  afterEach(() => {
    // no provenance-mode override used (filters passed explicitly).
  });

  it("computes CVA = R64,805.70 over 2 counterparties (BCBS standardised oracle)", () => {
    const r = computeCva({
      eventStore: store,
      marketData: md,
      asOf: PE,
      derivativeProvenanceFilter: COMBINED,
    });
    expect(r.status).toBe("computed");
    expect(r.exposedCounterparties).toBe(2);
    const bank = r.counterparties.find((c) => c.counterpartyId === CP_BANK);
    const corp = r.counterparties.find((c) => c.counterpartyId === CP_CORP);
    // CP_BANK: EAD R9.07m, PD 0.005, CVA R26,393.70.
    expect(bank?.eadZar).toBe(9_070_000);
    expect(bank?.pd).toBe(0.005);
    expect(bank?.cvaZar).toBeCloseTo(26_393.7, 2);
    // CP_CORP: EAD R3.3m, PD 0.02, CVA R38,412.00.
    expect(corp?.eadZar).toBe(3_300_000);
    expect(corp?.pd).toBe(0.02);
    expect(corp?.cvaZar).toBeCloseTo(38_412.0, 2);
    // Total.
    expect(r.cva.present && r.cva.value).toBeCloseTo(64_805.7, 2);
  });

  it("excludes the ETD (no-counterparty) position from CVA exposure", () => {
    const r = computeCva({
      eventStore: store,
      marketData: md,
      asOf: PE,
      derivativeProvenanceFilter: COMBINED,
    });
    // Only the two OTC counterparties appear — the ETD future contributes nothing.
    expect(r.counterparties.map((c) => c.counterpartyId).sort()).toEqual([CP_CORP, CP_BANK].sort());
  });

  it("CVA RWA leg = CVA capital × 12.5 (R810,071.25)", () => {
    const leg = computeCvaRwaLeg({
      eventStore: store,
      asOf: PE,
      derivativeProvenanceFilter: COMBINED,
    });
    // CVA capital R64,805.70 → 6,480,570 minor; × 12.5 = 81,007,125 minor.
    expect(leg.cvaCapitalMinor).toBe(6_480_570);
    expect(leg.cvaRwaMinor).toBe(81_007_125);
    expect(leg.report.status).toBe("computed");
  });

  it("PROVENANCE BOUNDARY: production-only read of the simulated book → no-otc-exposure, CVA RWA leg 0", () => {
    const r = computeCva({
      eventStore: store,
      marketData: md,
      asOf: PE,
      derivativeProvenanceFilter: PRODUCTION,
    });
    expect(r.status).toBe("no-otc-exposure");
    expect(r.cva.present).toBe(false);
    const leg = computeCvaRwaLeg({
      eventStore: store,
      asOf: PE,
      derivativeProvenanceFilter: PRODUCTION,
    });
    expect(leg.cvaCapitalMinor).toBe(0);
    expect(leg.cvaRwaMinor).toBe(0);
    expect(leg.report.status).toBe("no-otc-exposure");
  });
});
