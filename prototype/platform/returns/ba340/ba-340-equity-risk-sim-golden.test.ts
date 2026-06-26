// platform/returns/ba340/ba-340-equity-risk-sim-golden.test.ts
//
// SIMULATOR-FIRST BANKING-BOOK EQUITY — Phase 2c golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// Drives the BA 340 (Equity Risk in the Banking Book) simple-risk-weight fold +
// cell-assembly to NON-ZERO outputs over a born-V2 simulated banking-book equity
// book, and asserts the engine lands on HAND-COMPUTED golden-case figures (a
// domain-truth oracle — SARB Reg 31(6)(b)(i) Table 1: 300% listed / 400% unlisted;
// Reg 38 8% min ratio — NOT internal consistency). A consistent-but-wrong charge
// is a finding.
//
// It ALSO proves:
//   (1) the provenance boundary (the R300m-into-Prod lesson): production-only
//       read → empty/zero; simulated-inclusive read → the golden figures.
//   (2) the trading/banking-book boundary: the SAME simulated banking-book book,
//       read through the BA 320 trading-book equity adapter, yields ZERO rows —
//       banking-book equity can NOT leak into BA 320 (separate event families).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   Regulations Relating to Banks Reg 31 / Reg 38; D-FRTB-TRADING-DESK-STRUCTURE;
//   D-PROVENANCE-FILTER-ENFORCEMENT.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { afterEach, describe, expect, it } from "bun:test";

import { money } from "../../core/decimal-money";
import { encodeMoney } from "../../core/money-codec";
import { ZAR } from "../../core/types";
import type { BankingBookEquityHoldingClass } from "../../event-store/event-types/banking-book-equity-holdings";
import { makeBankingBookEquityHoldingOpened } from "../../event-store/event-types/banking-book-equity-holdings";
import { simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { buildEquityRows } from "../../reporting/ba-320-equity-events-adapter";
import {
  ba340MeasuresForClass,
  foldBa340EquityRiskBankingBook,
} from "../../reporting/ba-340-equity-risk-banking-book";
import { BA340_GAP_IMA_ENGINE, assembleBa340EquityRisk } from "./ba-340-equity-risk-banking-book";

const ENTITY = "LE-ZA-HOZ-BANK";
const PE = "2026-06-30";
const BANKING_DESK = "urn:desk:treasury-desk:treasury-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:test:ba340" };
const SIM = simulatedTag({ scenario: "banking-book-equity-sim-v1", sourceLineage: "test" });

interface Spec {
  id: string;
  cls: BankingBookEquityHoldingClass;
  side: "long" | "short";
  exp: string;
}

// Same economics as scripts/sim/seed-banking-book-equity-sim-v1.ts → shared oracle.
const BOOK: readonly Spec[] = [
  { id: "listed-long", cls: "listed", side: "long", exp: "20000000" }, // R20m
  { id: "listed-short", cls: "listed", side: "short", exp: "5000000" }, // R5m
  { id: "unlisted-long", cls: "unlisted", side: "long", exp: "10000000" }, // R10m
  { id: "speculative-long", cls: "speculative-unlisted", side: "long", exp: "3000000" }, // R3m
];

// Hand-computed oracle (minor cents = major ZAR × 100), Reg 31 Table 1 + Reg 38:
//   Listed   (300%): exposure R25m → RWE R75m → cap R6m
//   Unlisted (400%): exposure R10m → RWE R40m → cap R3.2m
//   Speculative: exposure R3m, NOT Table-1-charged (RWE 0, cap 0)
//   Total exposure = R38m (ALL banking-book equity: 25 + 10 + 3); RWE / capital
//   totals are the Table-1-charged classes only (R115m / R9.2m).
const ORACLE = {
  listedExposure: 2_500_000_000, // R25m
  listedRwe: 7_500_000_000, // R75m
  listedCapital: 600_000_000, // R6m
  unlistedExposure: 1_000_000_000, // R10m
  unlistedRwe: 4_000_000_000, // R40m
  unlistedCapital: 320_000_000, // R3.2m
  speculativeExposure: 300_000_000, // R3m
  totalExposure: 3_800_000_000, // R38m — all holdings incl. speculative exposure
  totalRwe: 11_500_000_000, // R115m — Table-1 classes only
  totalCapital: 920_000_000, // R9.2m — Table-1 classes only
};

function seed(store: EventStore): void {
  for (const s of BOOK) {
    store.append(
      makeBankingBookEquityHoldingOpened({
        asOf: PE,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-31"],
        eventId: `BBSIM-${s.id}`,
        provenance: SIM,
        payload: {
          holdingId: s.id,
          instrumentId: s.id,
          instrumentName: `${s.id} (sim)`,
          holdingClass: s.cls,
          side: s.side,
          exposureValue: encodeMoney(money(s.exp, ZAR)),
          deskId: BANKING_DESK,
          bookType: "banking-treasury",
          openedDate: PE,
        },
      }),
    );
  }
}

describe("BA 340 banking-book equity-risk simulator-first golden case", () => {
  afterEach(() => setDefaultProvenanceModeOverride(undefined));

  it("simple-risk-weight method: per-class exposure → RWE → capital lands on the Reg 31 Table-1 oracle", () => {
    const store = new EventStore(":memory:");
    seed(store);
    setDefaultProvenanceModeOverride("combined");
    const inv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });

    const listed = ba340MeasuresForClass(inv, "listed");
    expect(listed).not.toBeNull();
    expect(listed?.exposureValueMinor).toBe(ORACLE.listedExposure);
    expect(listed?.riskWeightedExposureMinor).toBe(ORACLE.listedRwe);
    expect(listed?.capitalRequirementMinor).toBe(ORACLE.listedCapital);
    expect(listed?.riskWeightBps).toBe(30_000); // 300%

    const unlisted = ba340MeasuresForClass(inv, "unlisted");
    expect(unlisted?.exposureValueMinor).toBe(ORACLE.unlistedExposure);
    expect(unlisted?.riskWeightedExposureMinor).toBe(ORACLE.unlistedRwe);
    expect(unlisted?.capitalRequirementMinor).toBe(ORACLE.unlistedCapital);
    expect(unlisted?.riskWeightBps).toBe(40_000); // 400%
  });

  it("speculative-unlisted is carried for exposure but NOT Table-1-charged (routes to deduction regime)", () => {
    const store = new EventStore(":memory:");
    seed(store);
    setDefaultProvenanceModeOverride("combined");
    const inv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });
    const spec = ba340MeasuresForClass(inv, "speculative-unlisted");
    expect(spec).not.toBeNull();
    expect(spec?.exposureValueMinor).toBe(ORACLE.speculativeExposure);
    expect(spec?.riskWeightedExposureMinor).toBe(0);
    expect(spec?.capitalRequirementMinor).toBe(0);
    expect(spec?.riskWeightBps).toBeNull();
  });

  it("Table-1 totals (exposure / RWE / capital) reconcile to the oracle (speculative excluded)", () => {
    const store = new EventStore(":memory:");
    seed(store);
    setDefaultProvenanceModeOverride("combined");
    const inv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });
    expect(inv.totalExposureValueMinor).toBe(ORACLE.totalExposure);
    expect(inv.totalRiskWeightedExposureMinor).toBe(ORACLE.totalRwe);
    expect(inv.totalCapitalRequirementMinor).toBe(ORACLE.totalCapital);
    expect(inv.totalHoldings).toBe(4);
  });

  it("PRODUCTION read folds the simulated book to ZERO (the R300m-into-Prod boundary)", () => {
    const store = new EventStore(":memory:");
    seed(store);
    setDefaultProvenanceModeOverride("production-only");
    const inv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });
    expect(inv.totalHoldings).toBe(0);
    expect(inv.totalExposureValueMinor).toBe(0);
    expect(inv.totalRiskWeightedExposureMinor).toBe(0);
    expect(inv.totalCapitalRequirementMinor).toBe(0);
    expect(inv.byClass).toHaveLength(0);
  });

  it("the assembled output's grand-total lines are present (sim) and absent (prod), never fabricated", () => {
    const store = new EventStore(":memory:");
    seed(store);

    setDefaultProvenanceModeOverride("combined");
    const simInv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });
    const simOut = assembleBa340EquityRisk({
      entity: ENTITY,
      asOf: PE,
      periodId: "period:test",
      functionalCurrency: "ZAR",
      inventory: simInv,
    });
    const simCap = simOut.grandTotals.find((l) => l.cellRow === "R0360.C0030");
    expect(simCap?.value.present).toBe(true);
    expect(simCap?.value.present === true ? simCap.value.value : -1).toBe(ORACLE.totalCapital);

    setDefaultProvenanceModeOverride("production-only");
    const prodInv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });
    const prodOut = assembleBa340EquityRisk({
      entity: ENTITY,
      asOf: PE,
      periodId: "period:test",
      functionalCurrency: "ZAR",
      inventory: prodInv,
    });
    const prodCap = prodOut.grandTotals.find((l) => l.cellRow === "R0360.C0030");
    // No production holdings → explicit absent (zero by absence), never fabricated 0.
    expect(prodCap?.value.present).toBe(false);
  });

  it("the IMA column is surfaced as a tracked-absent gap (no silent zero, no fabricated figure)", () => {
    const store = new EventStore(":memory:");
    seed(store);
    setDefaultProvenanceModeOverride("combined");
    const inv = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PE,
      eventStore: store,
    });
    const out = assembleBa340EquityRisk({
      entity: ENTITY,
      asOf: PE,
      periodId: "period:test",
      functionalCurrency: "ZAR",
      inventory: inv,
    });
    expect(out.gaps).toContain(BA340_GAP_IMA_ENGINE);
    for (const line of out.internalModelsApproachSection) {
      expect(line.value.present).toBe(false);
    }
  });

  it("TRADING/BANKING-BOOK boundary: the banking-book book yields ZERO BA 320 trading-book equity rows", () => {
    const store = new EventStore(":memory:");
    seed(store);
    // Read the SAME store of banking-book equity holdings through the BA 320
    // trading-book equity adapter. It reads only EquityTradingPositionOpened — a
    // SEPARATE event family — so banking-book equity is structurally invisible to
    // BA 320. Leakage is impossible; assert it.
    setDefaultProvenanceModeOverride("combined");
    const ba320EquityRows = buildEquityRows({ entity: ENTITY, periodEnd: PE, eventStore: store });
    expect(ba320EquityRows).toHaveLength(0);
  });
});
