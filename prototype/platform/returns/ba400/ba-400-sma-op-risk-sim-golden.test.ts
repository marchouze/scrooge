// platform/returns/ba400/ba-400-sma-op-risk-sim-golden.test.ts
//
// SIMULATOR-FIRST OPERATIONAL RISK — golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST Phase A).
//
// Drives the BA 400 SMA (Standardised Measurement Approach) engine to a NON-ZERO
// op-capital + op-RWA via a simulated operating-income statement, and asserts it
// lands on the HAND-COMPUTED golden case derived from OPE25 (BCBS SCO) — a
// domain-truth oracle, NOT internal consistency. A consistent-but-wrong figure
// is a finding.
//
// It ALSO proves:
//   - the provenance boundary (the R300m-into-Prod lesson): a PRODUCTION-only
//     read of the simulated income statement → no snapshot → op-RWA 0; the
//     SIMULATED-inclusive read → the golden figures.
//   - the BA 700 op-RWA leg is wired (computeBA700V2): the assembled return's
//     operationalRwa equals the SMA engine's op-RWA under the simulated lens and
//     0 under the production lens (the last missing BA 700 RWA leg).
//   - the SMA ILDC cap binds (a meaningful domain assertion — a wrong cap would
//     change BI).
//
// GOLDEN CASE (OPE25 §25.2–§25.7; all ZAR; the seed in
// scripts/sim/seed-operating-income-sim-v1.ts):
//   ILDC = Min(|120m − 45m|, 2.25% × 2,000m) + 5m = Min(75m, 45m) + 5m = 50m
//   SC   = Max(18m, 9m) + Max(40m, 12m) = 18m + 40m = 58m
//   FC   = |22m| + |7m| = 29m
//   BI   = 137m (Bucket 1)
//   BIC  = 12% × 137m = 16.44m;  ILM = 1 (no loss history)
//   ORC  = 16.44m;  Op-RWA = 12.5 × 16.44m = 205.5m
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CAPITAL-ASSET-CLASS-V1; OPE25 / BCBS SCO; SARB Reg 33 revised; Reg 38;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { money } from "../../core/decimal-money";
import { encodeMoney } from "../../core/money-codec";
import { makeOperatingIncomeStatementSnapshotted } from "../../event-store/event-types/operating-income-statement";
import { productionTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import { computeBA700V2 } from "../../projections/ba700-v2";
import {
  type ProvenanceFilter,
  eventMatchesProvenanceFilter,
  setDefaultProvenanceModeOverride,
} from "../../projections/filter";
import { buildBa400SmaInput } from "../../reporting/ba-400-sma-income-adapter";
import { generateBa400Sma } from "../../reporting/ba-400-sma-op-risk";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-26T00:00:00.000Z";
const PERIOD_END = "2026-06-30";
const FUNCTIONAL = "ZAR";
const ACTOR = { type: "service" as const, id: "agent:atlas:test" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "urn:reg:bcbs:ope25"];

const SIM = simulatedTag({
  scenario: "op-risk-income-sim-v1",
  sourceLineage: "platform/returns/ba400/ba-400-sma-op-risk-sim-golden.test.ts",
});

const zar = (m: string) => encodeMoney(money(m, FUNCTIONAL));

// Golden-case oracle values (minor cents = MAJOR × 100).
const GOLDEN = {
  ildcMinor: 5_000_000_000, // R50,000,000
  scMinor: 5_800_000_000, // R58,000,000
  fcMinor: 2_900_000_000, // R29,000,000
  biMinor: 13_700_000_000, // R137,000,000
  bicMinor: 1_644_000_000, // R16,440,000
  opRwaMinor: 20_550_000_000, // R205,500,000
} as const;

function seedIncome(store: EventStore, provenance = SIM): void {
  store.append(
    makeOperatingIncomeStatementSnapshotted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: "EV-OISIM-HOZ-BANK-2026-06-30",
      provenance,
      payload: {
        snapshotId: "OISIM-HOZ-BANK-2026-06-30",
        periodEnd: PERIOD_END,
        averagingYears: 3,
        interestIncome: zar("120000000"),
        interestExpense: zar("45000000"),
        interestEarningAssets: zar("2000000000"),
        dividendIncome: zar("5000000"),
        feeIncome: zar("40000000"),
        feeExpense: zar("12000000"),
        otherOperatingIncome: zar("18000000"),
        otherOperatingExpense: zar("9000000"),
        netPnlTradingBook: zar("22000000"),
        netPnlBankingBook: zar("7000000"),
      },
    }),
  );
}

describe("BA 400 SMA op-risk — simulator-first golden case", () => {
  afterEach(() => setDefaultProvenanceModeOverride(undefined));

  it("drives the SMA engine to the OPE25 golden case (ILDC cap binds)", () => {
    const store = new EventStore(":memory:");
    seedIncome(store);
    setDefaultProvenanceModeOverride("combined");

    const input = buildBa400SmaInput({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      periodId: "period:test",
      functionalCurrency: FUNCTIONAL,
      eventStore: store,
    });
    expect(input).not.toBeNull();
    if (input === null) throw new Error("unreachable");

    const out = generateBa400Sma(input);
    // The ILDC NII cap MUST bind (|120m-45m|=75m > 2.25%×2,000m=45m) — domain truth.
    expect(out.ildcNiiCapped).toBe(true);
    expect(out.ildcMinor).toBe(GOLDEN.ildcMinor);
    expect(out.scMinor).toBe(GOLDEN.scMinor);
    expect(out.fcMinor).toBe(GOLDEN.fcMinor);
    expect(out.biMinor).toBe(GOLDEN.biMinor);
    expect(out.bucket).toBe("bucket-1");
    expect(out.bicMinor).toBe(GOLDEN.bicMinor);
    expect(out.ilm).toBe("1");
    expect(out.lossesUsedForIlm).toBe(false);
    expect(out.opRiskCapitalMinor).toBe(GOLDEN.bicMinor); // ORC = BIC × 1
    expect(out.opRiskRwaMinor).toBe(GOLDEN.opRwaMinor);
  });

  it("PRODUCTION read of the simulated income statement folds op-RWA to 0", () => {
    const store = new EventStore(":memory:");
    seedIncome(store); // simulated tag
    setDefaultProvenanceModeOverride("production-only");

    const input = buildBa400SmaInput({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      periodId: "period:test",
      functionalCurrency: FUNCTIONAL,
      eventStore: store,
    });
    // Production lens excludes the simulated snapshot → no income → null.
    expect(input).toBeNull();
  });

  it("BA 700 op-RWA leg: simulated lens drives it, production lens excludes it", () => {
    const store = new EventStore(":memory:");
    seedIncome(store);

    // Simulated / combined lens — op-RWA is driven to the golden figure.
    setDefaultProvenanceModeOverride("combined");
    const sim = computeBA700V2({ eventStore: store, asOf: PERIOD_END });
    expect(sim.meta.operationalRwaAvailable).toBe(true);
    expect(sim.meta.sources.operationalRwa).toBe("ba400-sma-v2");
    expect(sim.capitalAdequacy.operationalRwa).toBe(GOLDEN.opRwaMinor);

    // Production-only lens — op-RWA excluded (the R300m-into-Prod guard).
    setDefaultProvenanceModeOverride("production-only");
    const prod = computeBA700V2({ eventStore: store, asOf: PERIOD_END });
    expect(prod.meta.operationalRwaAvailable).toBe(false);
    expect(prod.meta.sources.operationalRwa).toBe("none");
    expect(prod.capitalAdequacy.operationalRwa).toBe(0);
  });

  it("loss-driven ILM path is honoured when a Loss Component is supplied", () => {
    // OPE25 §25.7: ILM = Ln(e − 1 + (LC/BIC)^0.8). With LC = BIC, ratio=1 →
    // ILM = Ln(e − 1 + 1) = Ln(e) = 1. A clean fixed point that proves the path
    // wires without a magic constant. LC in MAJOR units = R16,440,000.
    const input = {
      entity: ENTITY,
      asOf: PERIOD_END,
      periodId: "period:test",
      functionalCurrency: FUNCTIONAL,
      interestIncome: zar("120000000"),
      interestExpense: zar("45000000"),
      interestEarningAssets: zar("2000000000"),
      dividendIncome: zar("5000000"),
      feeIncome: zar("40000000"),
      feeExpense: zar("12000000"),
      otherOperatingIncome: zar("18000000"),
      otherOperatingExpense: zar("9000000"),
      netPnlTradingBook: zar("22000000"),
      netPnlBankingBook: zar("7000000"),
      lossComponentMajor: "16440000",
    };
    const out = generateBa400Sma(input);
    expect(out.lossesUsedForIlm).toBe(true);
    expect(out.ilm).toBe("1"); // Ln(e) = 1 at the LC=BIC fixed point
    expect(out.opRiskRwaMinor).toBe(GOLDEN.opRwaMinor);
  });

  it("production-tagged income IS visible to a production read (licence-day shape)", () => {
    const store = new EventStore(":memory:");
    seedIncome(
      store,
      productionTag({ sourceLineage: "test:production-income" }),
    );
    setDefaultProvenanceModeOverride("production-only");
    const filter: ProvenanceFilter = { mode: "production-only" };
    // Sanity: the production-tagged event matches the production filter.
    let matched = 0;
    for (const ev of store.replay({ type: "OperatingIncomeStatementSnapshotted" })) {
      if (eventMatchesProvenanceFilter(ev, filter)) matched += 1;
    }
    expect(matched).toBe(1);

    const prod = computeBA700V2({ eventStore: store, asOf: PERIOD_END });
    expect(prod.meta.operationalRwaAvailable).toBe(true);
    expect(prod.capitalAdequacy.operationalRwa).toBe(GOLDEN.opRwaMinor);
  });
});
