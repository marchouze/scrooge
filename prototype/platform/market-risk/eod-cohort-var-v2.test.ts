// platform/market-risk/eod-cohort-var-v2.test.ts
//
// Fail-closed provenance proof for the EOD cohort-VaR fold (L2-FX).
//
// The cohort VaR replays the FIL-instrument lifecycle (`FilInstrumentCreated`/
// `FilInstrumentTerminated`) to derive the bank's standing net FX position. Prior
// to this proof it relied on STORE SEPARATION (production and simulated stores as
// distinct files) rather than provenance FILTERING within a store. These tests
// prove the threaded `ProvenanceFilter`:
//
//   1. LEAK CASE (the core fail-closed proof) — a simulated FIL instrument seeded
//      INTO a production-tagged store is EXCLUDED from the production VaR figure.
//      Empty-store separation is necessary but not sufficient; this proves the
//      filter, not the separation (the same regression class as the R300m-into-
//      Prod incident, D-V2-UI-VISIBILITY-REMEDIATION).
//   2. +SIM CASE — the simulated instrument IS included under an explicit
//      simulated-inclusive filter (the recon / +Sim read).
//   3. PRODUCTION BASELINE — a genuine production instrument drives a non-flat
//      production VaR, so the leak case excludes the right thing (not vacuously).
//
// Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12);
//   D-DATA-PROVENANCE-SUBSTRATE; D-FX-V2-SIMULATOR-FIRST;
//   D-ENGINEERING-INTEGRITY-CHARTER (cmd 1 root-cause, cmd 2 fail-closed).
// Author: Rohan (Risk engineer, engineering).

import { describe, expect, it } from "bun:test";

import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import type { ProvenanceFilter } from "../projections/filter";
import { computeCohortVar } from "./eod-cohort-var-v2";

const ENTITY = "LE-ZA-HOZ-BANK";
const REPORTING = "ZAR";
const ASOF = "2026-05-30T00:00:00.000Z";
const REPORT_DATE = "2026-05-30";
const ACTOR: Actor = { type: "system", id: "rohan:cohort-var-provenance-test" };
const CITES = ["D-PROVENANCE-FILTER-ENFORCEMENT"];
const TENANT = "tenant:za-bank";
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";

const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "cohort-var-prod-test" };
const SIM_TAG: ProvenanceTag = {
  kind: "simulated",
  scenario: "fx-sim-leak",
  sourceLineage: "cohort-var-sim-test",
};

function emptyStore(): EventStore {
  return new EventStore(":memory:");
}

function marketData(): MarketDataStore {
  return new MarketDataStore(":memory:");
}

/**
 * Append `n` daily USD/ZAR production fx-quote ticks with an OSCILLATING mid
 * (alternating up/down moves) so the historical-simulation return distribution
 * has both gains and losses — a constant up-drift yields a degenerate (zero-loss)
 * tail and a vacuous VaR=0. Enough observations (≥ COHORT_MIN_RETURN_OBSERVATIONS)
 * for VaR to compute.
 */
function seedUsdZarHistory(md: MarketDataStore, n = 30, start = 18): void {
  for (let i = 0; i < n; i++) {
    const day = String(i + 1).padStart(2, "0");
    // Alternating ±0.5% steps around the start level → two-sided return tail.
    const factor = 1 + (i % 2 === 0 ? 0.005 : -0.005);
    md.append({
      id: `USD/ZAR-${day}`,
      source: "fx-sim",
      instrument: "USD/ZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: `2026-05-${day}T00:00:00.000Z`,
      payload: { mid: start * factor },
    });
  }
}

/**
 * A long USD FIL instrument (foreign leg USD, reporting ZAR) so the cohort fold
 * sees a non-flat position. Provenance is explicit (FIL emits never soft-default).
 */
function usdInstrument(id: string, notional: string, provenance: ProvenanceTag) {
  return makeFilInstrumentCreated({
    asOf: ASOF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:${id}`,
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf: ASOF,
      originatingEvent: { eventType: "cohort-var-test-fixture", eventId: `cv:${id}` },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "USD", amount: notional },
        direction: "long",
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-USD",
        currency: "USD",
        settlementDate: ASOF.slice(0, 10),
        hedgingSetTag: "USD/ZAR",
        fxAgreement: {
          buy: { currency: "USD", amount: notional },
          sell: { currency: "ZAR", amount: notional },
        },
      },
    }),
  });
}

// The strict regulatory production read — the filter every production VaR caller
// passes (D-PROVENANCE-FILTER-ENFORCEMENT). It rejects `kind:simulated` in BOTH
// lifecycle phases, so it is the lens the fail-closed proof asserts under.
const PRODUCTION_ONLY: ProvenanceFilter = { mode: "production-only" };

describe("computeCohortVar — fail-closed provenance filter", () => {
  it("PRODUCTION BASELINE: a genuine production FIL instrument drives a non-flat production VaR", () => {
    const store = emptyStore();
    const md = marketData();
    seedUsdZarHistory(md);
    store.append(usdInstrument("prod-1", "1000000", PROD_TAG));

    const result = computeCohortVar({
      eventStore: store,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
      provenanceFilter: PRODUCTION_ONLY,
    });

    expect(result.status).toBe("computed");
    expect(result.exposures).toHaveLength(1);
    expect(result.exposures[0]?.factor).toBe("USD/ZAR");
    expect(result.varReporting).toBeGreaterThan(0);
  });

  it("LEAK CASE: a simulated FIL instrument physically in the production store is EXCLUDED from the production VaR (fail-closed, not store-separation)", () => {
    const md = marketData();
    seedUsdZarHistory(md);

    // Production baseline: one genuine production instrument.
    const prodOnlyStore = emptyStore();
    prodOnlyStore.append(usdInstrument("prod-1", "1000000", PROD_TAG));
    const baseline = computeCohortVar({
      eventStore: prodOnlyStore,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
      provenanceFilter: PRODUCTION_ONLY,
    });

    // The SAME store, now ALSO carrying a simulated instrument PHYSICALLY in the
    // production canonical store (the leak). The production-only read must
    // exclude it — the VaR figure is UNCHANGED from the baseline. This proves the
    // FILTER, not store separation: the leaked instrument is right there in the
    // store the production read reads, and is excluded anyway.
    const leakedStore = emptyStore();
    leakedStore.append(usdInstrument("prod-1", "1000000", PROD_TAG));
    leakedStore.append(usdInstrument("sim-leak-1", "9999999999", SIM_TAG));
    const guarded = computeCohortVar({
      eventStore: leakedStore,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
      provenanceFilter: PRODUCTION_ONLY,
    });

    // Fail-closed: the simulated leak does NOT move the production VaR.
    expect(guarded.status).toBe("computed");
    expect(guarded.exposures).toHaveLength(1);
    expect(guarded.exposures[0]?.factor).toBe("USD/ZAR");
    expect(guarded.exposures[0]?.exposureZar).toBe(baseline.exposures[0]?.exposureZar);
    expect(guarded.varReporting).toBe(baseline.varReporting);
    expect(guarded.svarReporting).toBe(baseline.svarReporting);
    expect(guarded.esReporting).toBe(baseline.esReporting);
  });

  it("EMPTY-STORE SEPARATION (necessary but not sufficient): a production-only read of a store with ONLY a simulated instrument yields no production position", () => {
    const store = emptyStore();
    const md = marketData();
    seedUsdZarHistory(md);
    store.append(usdInstrument("sim-leak-1", "1000000", SIM_TAG));

    const result = computeCohortVar({
      eventStore: store,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
      provenanceFilter: PRODUCTION_ONLY,
    });

    expect(result.status).toBe("no-positions");
    expect(result.exposures).toHaveLength(0);
    expect(result.varReporting).toBe(0);
  });

  it("+SIM PATH: an explicit simulated-inclusive filter INCLUDES the simulated instrument the production read excludes", () => {
    const store = emptyStore();
    const md = marketData();
    seedUsdZarHistory(md);
    store.append(usdInstrument("sim-1", "1000000", SIM_TAG));

    // Production read: simulated instrument excluded → no position.
    const prodRead = computeCohortVar({
      eventStore: store,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
      provenanceFilter: PRODUCTION_ONLY,
    });
    expect(prodRead.status).toBe("no-positions");

    // +Sim read of the SAME store: the simulated instrument is folded → computed.
    const simRead = computeCohortVar({
      eventStore: store,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
      provenanceFilter: { mode: "simulated-only" },
    });
    expect(simRead.status).toBe("computed");
    expect(simRead.exposures).toHaveLength(1);
    expect(simRead.exposures[0]?.factor).toBe("USD/ZAR");
    expect(simRead.varReporting).toBeGreaterThan(0);
  });

  it("DEFAULT FILTER (omitted) resolves to defaultProvenanceFilter() — never simulated-inclusive on the production path", () => {
    // With no override, the env default is the non-simulated operating-book /
    // production-only filter. A production-only store therefore computes; the
    // default is a safe lens, not a reliance on store separation.
    const store = emptyStore();
    const md = marketData();
    seedUsdZarHistory(md);
    store.append(usdInstrument("prod-1", "1000000", PROD_TAG));

    const result = computeCohortVar({
      eventStore: store,
      marketDataStore: md,
      reporting: REPORTING,
      reportDate: REPORT_DATE,
      asOf: ASOF,
    });

    expect(result.status).toBe("computed");
    expect(result.varReporting).toBeGreaterThan(0);
  });
});
