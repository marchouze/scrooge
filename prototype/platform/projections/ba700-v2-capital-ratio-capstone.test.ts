// platform/projections/ba700-v2-capital-ratio-capstone.test.ts
//
// THE CAPSTONE — the first COMPLETE BA 700 capital-adequacy return against the
// simulated bank (D-BA-RETURN-SIMULATOR-FIRST Phase A).
//
// With all three RWA legs now driven — credit (CcrEad), market (BA-320 FX), and
// OPERATIONAL (the BA 400 SMA op-RWA this slice wires, the last missing leg,
// GAP-BA700-OPERATIONAL-RWA CLOSED) — plus the R300m CET1 own-funds baseline
// (D-CAPITAL-ASSET-CLASS-V1), this test assembles the full return end-to-end and
// validates the ratios against a HAND-COMPUTED golden case (Reg 38; OPE25).
//
// GOLDEN CASE (all ZAR):
//   CET1 own funds            R300,000,000   (paid-up ordinary shares)
//   credit RWA                R1,235,000,000 (CcrEad EAD proxy)
//   market RWA                R0             (no open FX position in this fixture)
//   operational RWA           R205,500,000   (12.5 × SMA ORC R16.44m)
//   ────────────────────────────────────────
//   TOTAL RWA                 R1,440,500,000
//   CET1 / Tier 1 / Total ratio = 300,000,000 / 1,440,500,000 = 20.83%
//
// The PRODUCTION lens (all events simulated-tagged) returns no-data — the
// R300m-into-Prod guard: the assembled return only paints non-zero under the
// simulated / combined lens. Both legs are proven.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CAPITAL-ASSET-CLASS-V1; OPE25; Reg 38; D-PROVENANCE-FILTER-ENFORCEMENT.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, describe, expect, test } from "bun:test";

import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import { makeCcrEadComputed } from "../event-store/event-types/counterparty-credit-risk";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { makeOperatingIncomeStatementSnapshotted } from "../event-store/event-types/operating-income-statement";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { computeBA700V2 } from "./ba700-v2";
import { setDefaultProvenanceModeOverride } from "./filter";

const ENTITY = "LE-ZA-HOZ-BANK";
const FUNCTIONAL = "ZAR" as Currency;
const AS_OF = "2026-06-26T00:00:00.000Z";
const PERIOD_END = "2026-06-30";
const ACTOR: Actor = { type: "service", id: "agent:atlas:test-capstone" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "D-CAPITAL-ASSET-CLASS-V1"];
const SIM: ProvenanceTag = simulatedTag({
  scenario: "capital-ratio-capstone-v1",
  sourceLineage: "platform/projections/ba700-v2-capital-ratio-capstone.test.ts",
});

const zar = (m: string) => encodeMoney(money(m, FUNCTIONAL));

// Golden case (minor cents).
const CET1_MINOR = 30_000_000_000; // R300,000,000
const CREDIT_RWA_MINOR = 123_500_000_000; // R1,235,000,000
const OP_RWA_MINOR = 20_550_000_000; // R205,500,000
const TOTAL_RWA_MINOR = CREDIT_RWA_MINOR + OP_RWA_MINOR; // R1,440,500,000

function seedCet1(store: EventStore): void {
  const ev = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: SIM,
    payload: {
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:cap-cet1-300m`,
      type: "fil:type:capital:instrument:vanilla@1.0",
      tenant: ENTITY,
      asOf: AS_OF,
      originatingEvent: {
        eventType: "CapitalSubscriptionConfirmed",
        eventId: "o-cap-cet1-300m",
      },
      initialStage: "active",
      economicTerms: {
        assetClass: "capital",
        notional: { currency: FUNCTIONAL, amount: "300000000" },
        direction: "long",
        counterpartyId: "urn:party:capital-provider:founding-subscription",
        nettingSetId: "NS-CAPITAL-CET1-ZAR",
        currency: FUNCTIONAL,
        settlementDate: PERIOD_END,
        qualifyingCapital: { tier: "cet1", subCategory: "cet1.paid-up-ordinary-shares" },
      },
    } as unknown as FilInstrumentCreatedPayload,
  });
  store.append({ ...ev, provenance: SIM });
}

function seedCreditRwa(store: EventStore): void {
  // EAD R1,235,000,000 = α × (RC + PFE). We supply the EAD directly (the BA 700
  // credit-RWA proxy sums EAD across netting sets); RC/PFE consistent with α=1.4.
  store.append(
    makeCcrEadComputed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: "EV-CCR-EAD-CAPSTONE",
      payload: {
        nettingSetId: "NS-cp-capstone-ZAR",
        counterpartyId: "urn:party:legal-entity:capstone-cp",
        rc: zar("500000000"),
        pfe: zar("382142857.14"),
        alpha: 1.4,
        ead: zar("1235000000"),
        currency: FUNCTIONAL,
        computationDate: PERIOD_END,
        methodology: "sa-ccr",
        sourceEvents: { rcEventId: "EV-CCR-RC-CAPSTONE", pfeComponents: 1 },
      },
    }),
  );
}

function seedOpRwaIncome(store: EventStore): void {
  store.append(
    makeOperatingIncomeStatementSnapshotted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: "EV-OISIM-CAPSTONE",
      provenance: SIM,
      payload: {
        snapshotId: "OISIM-CAPSTONE",
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

describe("BA 700 capital-ratio CAPSTONE — first complete return vs the simulated bank", () => {
  afterEach(() => setDefaultProvenanceModeOverride(undefined));

  test("simulated lens: all three RWA legs assemble to the golden capital ratio", () => {
    const store = new EventStore(":memory:");
    seedCet1(store);
    seedCreditRwa(store);
    seedOpRwaIncome(store);

    setDefaultProvenanceModeOverride("combined");
    const r = computeBA700V2({
      eventStore: store,
      asOf: PERIOD_END,
      functionalCurrency: FUNCTIONAL,
    });

    // Own funds.
    expect(r.capitalAdequacy.cet1Capital).toBe(CET1_MINOR);
    expect(r.capitalAdequacy.tier1Capital).toBe(CET1_MINOR);
    expect(r.capitalAdequacy.totalCapital).toBe(CET1_MINOR);

    // Three RWA legs.
    expect(r.capitalAdequacy.creditRwa).toBe(CREDIT_RWA_MINOR);
    expect(r.capitalAdequacy.marketRwa).toBe(0); // no open FX position
    expect(r.capitalAdequacy.operationalRwa).toBe(OP_RWA_MINOR);
    expect(r.meta.operationalRwaAvailable).toBe(true);
    expect(r.meta.sources.operationalRwa).toBe("ba400-sma-v2");

    // Total RWA + the assembled ratios (the headline figures).
    expect(r.capitalAdequacy.totalRwa).toBe(TOTAL_RWA_MINOR);
    const expectedRatio = CET1_MINOR / TOTAL_RWA_MINOR;
    expect(r.capitalAdequacy.cet1Ratio).toBeCloseTo(expectedRatio, 10);
    expect(r.capitalAdequacy.tier1Ratio).toBeCloseTo(expectedRatio, 10);
    expect(r.capitalAdequacy.totalCapitalRatio).toBeCloseTo(expectedRatio, 10);
    expect(r.capitalAdequacy.carRatio).toBeCloseTo(expectedRatio, 10);
    // 20.83% — the first complete capital ratio against the simulated bank.
    expect((expectedRatio * 100).toFixed(2)).toBe("20.83");
  });

  test("production lens: the assembled return paints no-data (R300m-into-Prod guard)", () => {
    const store = new EventStore(":memory:");
    seedCet1(store);
    seedCreditRwa(store);
    seedOpRwaIncome(store);

    setDefaultProvenanceModeOverride("production-only");
    const r = computeBA700V2({
      eventStore: store,
      asOf: PERIOD_END,
      functionalCurrency: FUNCTIONAL,
    });

    expect(r.capitalAdequacy.cet1Capital).toBe(0);
    expect(r.capitalAdequacy.creditRwa).toBe(0);
    expect(r.capitalAdequacy.operationalRwa).toBe(0);
    expect(r.capitalAdequacy.totalRwa).toBe(0);
    expect(r.meta.operationalRwaAvailable).toBe(false);
    expect(r.meta.coverageStatus).toBe("no-data");
    expect(r.capitalAdequacy.cet1Ratio).toBeNull();
    expect(r.capitalAdequacy.totalCapitalRatio).toBeNull();
  });
});
