// platform/projections/ba700-v2-market-rwa.test.ts
//
// Proof for GAP-3E-002 closure: the V2 BA-700 capital-adequacy projection wires
// the BA-320 V2 FX open-position capital charge into the market-risk RWA slot as
// RWA = 12.5 × capital charge (Reg 38 / BCBS Basel III §50–§90), summed into
// totalRwa alongside credit RWA, and FAILS CLOSED (excluded, not zero-coerced)
// when the BA-320 charge is null.
//
// The two cases this pins (Definition of Done):
//   (1) Rate / charge present  → marketRwa === 12.5 × charge, summed into totalRwa,
//                                marketRwaAvailable === true, source "ba320-fx-v2".
//   (2) Charge null (no rate)  → market RWA EXCLUDED with marketRwaAvailable=false,
//                                marketRwa contributes 0 to totalRwa (NOT zero as-if
//                                complete), source "none", GAP-3E-002 fail-closed
//                                note present — the rate is never fabricated.
//
// Both cases reuse computeBA320V2 indirectly via computeBA700V2 — the BA-700
// projection does NOT recompute the FX position (Principle 2 — single derivation
// site). We assert the 12.5× relationship against computeBA320V2 run directly on
// the same store, so the test cannot drift from the BA-320 charge it consumes.
//
// Authority: D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (CEO-approved 2026-06-21);
//   D-FX-OTC-CLOSURE-BACKLOG; D-BANK-WIDE-V2-MIGRATION.
// Citations: Reg 38; Reg 28(5); BCBS Basel III §50–§90; BCBS D352 §718(xiii);
//   P1-EVENTS-AS-TRUTH.
// Author: Rohan (Risk engineer, engineering).

import { describe, expect, test } from "bun:test";

import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { mulD, roundDecimal, toDecimal, toMinorUnits } from "../core/decimal-engine";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { computeBA320V2 } from "./ba320-fx-v2";
import { computeBA700V2 } from "./ba700-v2";

const ACTOR: Actor = { type: "system", id: "rohan:ba700-v2-market-rwa-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "tenant:za-bank";
const CITES = ["D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING"];
const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "ba700-v2-market-rwa-test" };
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";
const FUNCTIONAL = "ZAR";
const AS_OF = "2026-06-21T10:00:00.000Z";
const SETTLE = "2026-06-21";

/** RWA = 12.5 × capital charge (Reg 38 / BCBS §50–§90), decimal-engine HALF_UP —
 *  the EXACT computation the BA-700 projection uses. */
function rwaFromCharge(chargeMinor: number): number {
  return Number(
    toMinorUnits(
      roundDecimal(mulD(toDecimal(String(chargeMinor)), toDecimal("12.5")), 0, "HALF_UP"),
      0,
    ),
  );
}

interface FxSeed {
  id: string;
  /** Foreign leg of the pair (the non-ZAR currency). */
  foreign: string;
  direction: "long" | "short";
  /** Notional currency — "ZAR" = functional-native (charge needs no rate); a
   *  foreign code = legacy foreign-leg shape (charge NEEDS a rate → null when absent). */
  notionalCurrency: string;
  /** Notional amount, major-unit decimal string. */
  notional: string;
}

function appendFx(store: EventStore, s: FxSeed): void {
  const ev = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:${s.id}`,
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf: AS_OF,
      originatingEvent: { eventType: "FxTradeExecuted", eventId: `evt-${s.id}` },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: s.notionalCurrency, amount: s.notional },
        direction: s.direction,
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: `NS-${s.id}`,
        currency: s.notionalCurrency,
        settlementDate: SETTLE,
        hedgingSetTag: `${s.foreign}/ZAR`,
      },
    }),
  });
  store.append({ ...ev, provenance: PROD_TAG });
}

describe("computeBA700V2 — market RWA = 12.5 × BA-320 FX charge (GAP-3E-002)", () => {
  test("rate present → marketRwa === 12.5 × BA-320 charge, summed into totalRwa", () => {
    const store = new EventStore(":memory:");
    // Functional-native (ZAR-denominated) FX position: ZAR 1,000,000.00 net long.
    // The BA-320 charge is computable from the native functional figure; a ZAR
    // rate for the foreign leg makes the display leg resolve (rateAvailable=true).
    appendFx(store, {
      id: "fx-usd-long",
      foreign: "USD",
      direction: "long",
      notionalCurrency: "ZAR",
      notional: "1000000.00",
    });

    // Run BA-320 directly on the same store + rate to get the charge BA-700 consumes.
    const ba320 = computeBA320V2({
      eventStore: store,
      asOf: AS_OF,
      entity: ENTITY,
      functionalCurrency: FUNCTIONAL,
      zarRates: { USD: 18.5 },
    });
    expect(ba320.fx.openPositionChargeMinor).not.toBeNull();
    const chargeMinor = ba320.fx.openPositionChargeMinor as number;
    // Sanity: 8% × 100,000,000 minor = 8,000,000 minor.
    expect(chargeMinor).toBe(8_000_000);

    const ba700 = computeBA700V2({
      eventStore: store,
      asOf: AS_OF,
      entity: ENTITY,
      functionalCurrency: FUNCTIONAL,
      zarRates: { USD: 18.5 },
    });

    // Market RWA is exactly 12.5 × the BA-320 charge — derived, not recomputed.
    expect(ba700.meta.marketRwaAvailable).toBe(true);
    expect(ba700.meta.sources.marketRwa).toBe("ba320-fx-v2");
    expect(ba700.capitalAdequacy.marketRwa).toBe(rwaFromCharge(chargeMinor));
    expect(ba700.capitalAdequacy.marketRwa).toBe(100_000_000); // 12.5 × 8,000,000

    // Summed into totalRwa alongside credit RWA (credit is 0 on this store).
    expect(ba700.capitalAdequacy.creditRwa).toBe(0);
    expect(ba700.capitalAdequacy.totalRwa).toBe(
      ba700.capitalAdequacy.creditRwa + ba700.capitalAdequacy.marketRwa,
    );
    expect(ba700.capitalAdequacy.totalRwa).toBe(100_000_000);

    // No fail-closed gap when the charge resolved.
    expect(ba700.gaps.some((g) => g.includes("GAP-3E-002 (FAIL-CLOSED)"))).toBe(false);
  });

  test("charge null (no rate, foreign-denominated leg) → market RWA EXCLUDED with flag, NOT zero-coerced", () => {
    const store = new EventStore(":memory:");
    // Legacy foreign-leg shape: notional in USD (NOT functional). Without a rate
    // the BA-320 charge cannot be computed → null (fail-closed).
    appendFx(store, {
      id: "fx-usd-foreign-norate",
      foreign: "USD",
      direction: "long",
      notionalCurrency: "USD",
      notional: "1000000.00",
    });

    // Confirm the BA-320 charge is null on this store with NO rate supplied.
    const ba320 = computeBA320V2({
      eventStore: store,
      asOf: AS_OF,
      entity: ENTITY,
      functionalCurrency: FUNCTIONAL,
      // no zarRates, no marketDataStore → USD position has no functional figure.
    });
    expect(ba320.fx.openPositionChargeMinor).toBeNull();

    const ba700 = computeBA700V2({
      eventStore: store,
      asOf: AS_OF,
      entity: ENTITY,
      functionalCurrency: FUNCTIONAL,
      // no rate source → fail-closed market RWA.
    });

    // EXCLUDED, not zero-as-if-complete: the flag is the signal.
    expect(ba700.meta.marketRwaAvailable).toBe(false);
    expect(ba700.meta.sources.marketRwa).toBe("none");
    // marketRwa is 0 ONLY as the additive identity for the excluded term.
    expect(ba700.capitalAdequacy.marketRwa).toBe(0);
    // totalRwa does NOT silently absorb a fabricated market figure.
    expect(ba700.capitalAdequacy.totalRwa).toBe(ba700.capitalAdequacy.creditRwa);

    // Fail-closed gap note present and visible (no fabricated rate).
    expect(ba700.gaps.some((g) => g.includes("GAP-3E-002 (FAIL-CLOSED)"))).toBe(true);
  });

  test("no open FX position → market RWA excluded (charge null), totalRwa = credit only", () => {
    const store = new EventStore(":memory:");
    // Empty store — the clean build-phase state.
    const ba700 = computeBA700V2({
      eventStore: store,
      asOf: AS_OF,
      entity: ENTITY,
      functionalCurrency: FUNCTIONAL,
    });
    expect(ba700.meta.marketRwaAvailable).toBe(false);
    expect(ba700.capitalAdequacy.marketRwa).toBe(0);
    expect(ba700.capitalAdequacy.totalRwa).toBe(ba700.capitalAdequacy.creditRwa);
  });
});
