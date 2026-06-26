// platform/returns/ba300/deposit-funding-sim-golden.test.ts
//
// SIMULATOR-FIRST DEPOSIT / FUNDING / HQLA BOOK — golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// Drives the BA 300 LCR + NSFR engines AND the new BA 310 minimum-liquid-reserve
// fold to NON-ZERO outputs via the simulated deposit / funding / HQLA book, and
// asserts each lands on HAND-COMPUTED golden-case figures derived from the
// regulation (BCBS D238 LCR / BCBS 295 NSFR / SARB Reg 27 + SARB Act 90/1989) —
// a domain-truth oracle, NOT internal consistency. A consistent-but-wrong figure
// is a finding.
//
// It ALSO proves the provenance boundary (the R300m-into-Prod lesson):
//   - PRODUCTION-ONLY read of the simulated book → 0 (no positions).
//   - OPERATING-BOOK / SIMULATED-inclusive read of the same store → golden figures.
//
// All amounts are exact round numbers chosen so each engine lands on the oracle
// figures in `deposit-funding-sim-book.ts` (DEPOSIT_FUNDING_SIM_ORACLE).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   Reg 26 (LCR) / Reg 26A (NSFR) / Reg 27 (minimum liquid reserve); SARB Act 90
//   of 1989; BCBS D238 / BCBS 295; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makeCollateralInventorySnapshotted } from "../../event-store/event-types/collateral";
import {
  makeDepositTaken,
  makeFundingLineDrawn,
  makeInterbankLoanPlaced,
} from "../../event-store/event-types/repo-mmd-ibl";
import { productionTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import { computeLCR } from "../../liquidity/lcr";
import { computeNSFR } from "../../liquidity/nsfr";
import { computeALMPositionSnapshot } from "../../projections/alm-positions";
import {
  type ProvenanceFilter,
  eventMatchesProvenanceFilter,
  setDefaultProvenanceModeOverride,
} from "../../projections/filter";
import { generateBa310 } from "../../reporting/ba-310-min-reserve";
import {
  DEPOSIT_FUNDING_SIM_BOOK,
  DEPOSIT_FUNDING_SIM_ORACLE,
  DEPOSIT_FUNDING_SIM_SCENARIO,
} from "./deposit-funding-sim-book";

const ENTITY = DEPOSIT_FUNDING_SIM_BOOK.entity;
const AS_OF = DEPOSIT_FUNDING_SIM_BOOK.asOf;
const ACTOR = { type: "service" as const, id: "agent:atlas:test" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "REG-26"];

const SIM = simulatedTag({
  scenario: DEPOSIT_FUNDING_SIM_SCENARIO,
  sourceLineage: "platform/returns/ba300/deposit-funding-sim-golden.test.ts",
});

// ---------------------------------------------------------------------------
// Seed the canonical sim book into an in-memory store, with the given tag.
// ---------------------------------------------------------------------------

function seedBook(store: EventStore, provenance = SIM): void {
  for (const d of DEPOSIT_FUNDING_SIM_BOOK.deposits) {
    store.append(
      makeDepositTaken({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `EV-${d.depositId}`,
        provenance,
        payload: {
          depositId: d.depositId,
          counterpartyLei: d.counterpartyLei,
          principalZar: d.principalMinor,
          interestRateDecimal: d.interestRateDecimal,
          maturityDate: d.maturityDate,
          depositCategory: d.depositCategory,
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: d.instrumentRef,
        },
      }),
    );
  }
  for (const f of DEPOSIT_FUNDING_SIM_BOOK.fundingLines) {
    store.append(
      makeFundingLineDrawn({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `EV-${f.fundingLineId}`,
        provenance,
        payload: {
          fundingLineId: f.fundingLineId,
          drawnAmountZar: f.drawnAmountMinor,
          maturityDate: f.maturityDate,
          rateDecimal: f.rateDecimal,
        },
      }),
    );
  }
  for (const p of DEPOSIT_FUNDING_SIM_BOOK.interbankPlacements) {
    store.append(
      makeInterbankLoanPlaced({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `EV-${p.placementId}`,
        provenance,
        payload: {
          placementId: p.placementId,
          counterpartyLei: p.counterpartyLei,
          principalZar: p.principalMinor,
          rateDecimal: p.rateDecimal,
          startDate: p.startDate,
          maturityDate: p.maturityDate,
          placementType: "fixed-term",
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: p.instrumentRef,
        },
      }),
    );
  }
  const h = DEPOSIT_FUNDING_SIM_BOOK.hqla;
  store.append(
    makeCollateralInventorySnapshotted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: `EV-${h.snapshotId}`,
      provenance,
      payload: {
        snapshotId: h.snapshotId,
        asOf: AS_OF,
        totalHQLAZar: h.l1Zar + h.l2aZar + h.l2bZar,
        l1Zar: h.l1Zar,
        l2aZar: h.l2aZar,
        l2bZar: h.l2bZar,
        l2CapBreached: false,
        l2bCapBreached: false,
        securityCount: h.securityCount,
        currency: DEPOSIT_FUNDING_SIM_BOOK.functionalCurrency,
      },
    }),
  );
}

const PRODUCTION_ONLY: ProvenanceFilter = { mode: "production-only" };
const OPERATING_BOOK: ProvenanceFilter = { mode: "operating-book" };

// The ALM snapshot reads through the operating-book default; pin it so the
// in-memory golden store is read under the simulated-inclusive operating book.
beforeEach(() => setDefaultProvenanceModeOverride("operating-book"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ===========================================================================
// LCR golden case (BCBS D238 / Reg 26)
//   HQLA = 950m ; net cash outflows = 170m ; LCR = 558.82%
// ===========================================================================

describe("BA300 sim — LCR golden case (BCBS D238 / Reg 26)", () => {
  it("folds the simulated book to the hand-computed HQLA / net-outflow / ratio", () => {
    const store = new EventStore(":memory:");
    seedBook(store);

    const snap = computeALMPositionSnapshot(store, AS_OF, 30, ENTITY);
    const lcr = computeLCR([...snap.hqlaPositions], [...snap.fundingPositions]);

    expect(lcr.hqlaZar).toBe(DEPOSIT_FUNDING_SIM_ORACLE.lcr.hqlaZar);
    expect(lcr.netCashOutflowsZar).toBe(DEPOSIT_FUNDING_SIM_ORACLE.lcr.netCashOutflowsZar);
    expect(lcr.lcrRatioPct).toBeCloseTo(DEPOSIT_FUNDING_SIM_ORACLE.lcr.lcrRatioPct, 6);
    expect(lcr.status).toBe(DEPOSIT_FUNDING_SIM_ORACLE.lcr.status);
  });
});

// ===========================================================================
// NSFR golden case (BCBS 295 / Reg 26A)
//   ASF = 705m ; RSF = 89.5m ; NSFR = 787.71%
// ===========================================================================

describe("BA300 sim — NSFR golden case (BCBS 295 / Reg 26A)", () => {
  it("folds the simulated book to the hand-computed ASF / RSF / ratio", () => {
    const store = new EventStore(":memory:");
    seedBook(store);

    const snap = computeALMPositionSnapshot(store, AS_OF, 365, ENTITY);
    const nsfr = computeNSFR([...snap.asfItems], [...snap.rsfItems]);

    expect(nsfr.asfZar).toBe(DEPOSIT_FUNDING_SIM_ORACLE.nsfr.asfZar);
    expect(nsfr.rsfZar).toBe(DEPOSIT_FUNDING_SIM_ORACLE.nsfr.rsfZar);
    expect(nsfr.nsfrRatioPct).toBeCloseTo(DEPOSIT_FUNDING_SIM_ORACLE.nsfr.nsfrRatioPct, 6);
    expect(nsfr.status).toBe(DEPOSIT_FUNDING_SIM_ORACLE.nsfr.status);
  });
});

// ===========================================================================
// BA 310 golden case (SARB Reg 27 / SARB Act 90 of 1989)
//   liabilities base 1,030m → R0040 1,030m → R0090 1,030m
//   R0100 reserve = 1,030m × 2.5% = 25.75m
//   R0140 level-1 required = 1,030m × 5% = 51.5m
//   R0150 level-1 held = 800m (compliant)
// ===========================================================================

describe("BA310 sim — minimum-reserve golden case (Reg 27 / SARB Act 90/1989)", () => {
  it("folds the simulated book to the hand-computed reserve + liquid-asset figures", () => {
    const store = new EventStore(":memory:");
    seedBook(store);

    const out = generateBa310({
      entity: ENTITY,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
      eventStore: store,
      filter: OPERATING_BOOK,
    });

    const o = DEPOSIT_FUNDING_SIM_ORACLE.ba310;
    expect(out.liabilitiesBaseZar).toBe(o.liabilitiesBaseZar);
    expect(out.liabilitiesReducedZar).toBe(o.liabilitiesReducedZar);
    expect(out.liabilitiesAdjustedZar).toBe(o.liabilitiesAdjustedZar);
    expect(out.minimumReserveBalanceZar).toBe(o.minimumReserveBalanceZar);
    expect(out.levelOneRequiredZar).toBe(o.levelOneRequiredZar);
    expect(out.levelOneHeldZar).toBe(o.levelOneHeldZar);
    expect(out.compliant).toBe(o.compliant);
    // The interbank PLACEMENT (R120m) is a bank asset, not a liability — the
    // base is exactly the deposit + funding-line liabilities, never the placement.
    expect(out.liabilitiesBaseZar).toBe(950_000_000 + 80_000_000);
  });
});

// ===========================================================================
// PROVENANCE BOUNDARY — the R300m-into-Prod lesson.
//   Same simulated store: production-only read → 0; operating-book → golden.
// ===========================================================================

describe("deposit-funding sim — provenance boundary (production read stays 0)", () => {
  it("BA 310: production-only read of the simulated book folds to all-zero", () => {
    const store = new EventStore(":memory:");
    seedBook(store); // tagged simulated

    const prod = generateBa310({
      entity: ENTITY,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
      eventStore: store,
      filter: PRODUCTION_ONLY,
    });

    expect(prod.liabilitiesBaseZar).toBe(0);
    expect(prod.liabilitiesReducedZar).toBe(0);
    expect(prod.liabilitiesAdjustedZar).toBe(0);
    expect(prod.minimumReserveBalanceZar).toBe(0);
    expect(prod.levelOneRequiredZar).toBe(0);
    expect(prod.levelOneHeldZar).toBe(0);
  });

  it("LCR/NSFR: every simulated book event is excluded by a production-only read", () => {
    // The ALM snapshot that feeds LCR/NSFR is intrinsically operating-book by
    // design (it answers "what is in the live operating book?"), so it has no
    // production-only mode to assert against directly. The boundary the LCR/NSFR
    // path actually relies on is the per-event provenance filter: under
    // `production-only`, EVERY simulated event fails the filter, so any
    // production-grade LCR/NSFR consumer folds nothing. We assert that structural
    // guarantee on the seeded events directly (the same predicate the BA 310
    // production fold uses, proven to yield 0 in the BA 310 test above).
    const store = new EventStore(":memory:");
    seedBook(store); // tagged simulated

    let candidates = 0;
    let admittedByProduction = 0;
    for (const ev of store.replay({ entity: ENTITY })) {
      candidates += 1;
      if (eventMatchesProvenanceFilter(ev, PRODUCTION_ONLY)) admittedByProduction += 1;
    }
    expect(candidates).toBeGreaterThan(0);
    expect(admittedByProduction).toBe(0);

    // And the same store IS visible to the operating-book read (the live drive).
    let admittedByOperatingBook = 0;
    for (const ev of store.replay({ entity: ENTITY })) {
      if (eventMatchesProvenanceFilter(ev, OPERATING_BOOK)) admittedByOperatingBook += 1;
    }
    expect(admittedByOperatingBook).toBe(candidates);
  });

  it("BA 310: a PRODUCTION-tagged book folds non-zero under production-only", () => {
    // Inverse witness: if the book were real production state, the production
    // read WOULD see it. Proves the boundary keys on provenance, not on the
    // event types being intrinsically invisible.
    const store = new EventStore(":memory:");
    seedBook(store, productionTag({ sourceLineage: "test:production-witness" }));

    const prod = generateBa310({
      entity: ENTITY,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
      eventStore: store,
      filter: PRODUCTION_ONLY,
    });

    expect(prod.liabilitiesBaseZar).toBe(DEPOSIT_FUNDING_SIM_ORACLE.ba310.liabilitiesBaseZar);
    expect(prod.levelOneHeldZar).toBe(DEPOSIT_FUNDING_SIM_ORACLE.ba310.levelOneHeldZar);
  });
});
