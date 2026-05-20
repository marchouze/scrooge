// tests/sa-ccr.test.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — SA-CCR engine tests.
//
// Coverage:
//   - computeReplacementCost: margined + unmargined branches; floor at 0;
//     MTA+TH branch when collateral exceeds V.
//   - computeAddOn: IR notional × 0.5%; FX notional × 4%; mixed netting
//     set sums correctly; cross-currency rejected; non-wired asset class
//     throws.
//   - computeEad: α × (RC + PFE) — round-trip on a worked example.
//   - computeAndEmit: end-to-end happy path emits the
//     CcrReplacementCostComputed event with the correct payload.
//   - Round-trip with pre-deal-check.checkHeadroom: after computeAndEmit
//     fires, checkHeadroom reads the RC event (no notional-sum fallback
//     path).
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 (CEO-approved 2026-05-20);
//   Policies/credit-risk-policy-v1.md §3 (IN FORCE 2026-05-13);
//   BCBS d317 / CRE52 (SA-CCR).
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { type Money, money } from "../platform/core/money";
import { BANK_ZA_001, ZAR, newEventId } from "../platform/core/types";
import {
  makeCreditLimitApplicationSubmitted,
  makeCreditLimitApproved,
  makeCreditLimitLoaded,
} from "../platform/event-store/event-types/credit-limit";
import { checkHeadroom } from "../platform/risk/credit-limit-engine";
import {
  ALPHA_SA_CCR,
  type NettingSet,
  type TradeSummary,
  computeAddOn,
  computeAndEmit,
  computeEad,
  computeReplacementCost,
  supervisoryFactor,
} from "../platform/risk/sa-ccr";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "test:sa-ccr" };
const CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD"];

let seq = 0;
function uniqueId(prefix: string): string {
  seq += 1;
  return `${prefix}-${process.pid}-${seq}`;
}

function zar(major: number): Money {
  return money(major, ZAR);
}

function tsIso(): string {
  return "2026-05-20T10:00:00.000Z";
}

// ---------------------------------------------------------------------------
// computeReplacementCost
// ---------------------------------------------------------------------------

describe("SA-CCR computeReplacementCost", () => {
  it("margined: RC = V − C when V − C > MTA + TH > 0", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-CP1-ZAR",
      counterpartyId: "CP1",
      csaPresent: true,
      threshold: zar(1_000_000), // R1m
      mta: zar(100_000), // R100k
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(10_000_000), zar(2_000_000));
    // V − C = R8m; MTA + TH = R1.1m; max = R8m.
    expect(rc.rc.amount).toBe(BigInt(8_000_000_00));
  });

  it("margined: RC = MTA + TH when V − C < MTA + TH", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-CP2-ZAR",
      counterpartyId: "CP2",
      csaPresent: true,
      threshold: zar(1_000_000),
      mta: zar(100_000),
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(2_000_000), zar(3_000_000));
    // V − C = −R1m; MTA + TH = R1.1m; max = R1.1m.
    expect(rc.rc.amount).toBe(BigInt(1_100_000_00));
  });

  it("margined: RC = 0 when V < C and MTA + TH = 0", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-CP3-ZAR",
      counterpartyId: "CP3",
      csaPresent: true,
      threshold: zar(0),
      mta: zar(0),
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(1_000_000), zar(5_000_000));
    expect(rc.rc.amount).toBe(0n);
  });

  it("unmargined: RC = V when V > 0", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-CP4-ZAR",
      counterpartyId: "CP4",
      csaPresent: false,
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(5_000_000), zar(0));
    expect(rc.rc.amount).toBe(BigInt(5_000_000_00));
  });

  it("unmargined: RC = 0 when V < 0", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-CP5-ZAR",
      counterpartyId: "CP5",
      csaPresent: false,
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(-1_000_000), zar(0));
    expect(rc.rc.amount).toBe(0n);
  });

  it("margined deep-ITM: RC = V − C unchanged", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-CP6-ZAR",
      counterpartyId: "CP6",
      csaPresent: true,
      threshold: zar(500_000),
      mta: zar(100_000),
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(100_000_000), zar(20_000_000));
    expect(rc.rc.amount).toBe(BigInt(80_000_000_00));
  });

  it("rejects margined netting set with missing threshold/mta", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-BAD",
      counterpartyId: "CP-BAD",
      csaPresent: true,
      currency: "ZAR",
    };
    expect(() => computeReplacementCost(ns, zar(1_000_000), zar(0))).toThrow();
  });

  it("rejects negative collateral", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-NEGCOL",
      counterpartyId: "CP-NEGCOL",
      csaPresent: false,
      currency: "ZAR",
    };
    expect(() =>
      computeReplacementCost(ns, zar(1_000_000), { amount: -1n, currency: zar(0).currency }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeAddOn
// ---------------------------------------------------------------------------

describe("SA-CCR computeAddOn", () => {
  it("IR trades: addOn = notional × 0.5%", () => {
    const trades: TradeSummary[] = [
      {
        counterpartyId: "CP",
        nettingSetId: "NS",
        assetClass: "ir",
        notional: zar(100_000_000), // R100m
      },
    ];
    const out = computeAddOn(trades);
    expect(out).toHaveLength(1);
    const ir = out[0];
    if (!ir) throw new Error("ir component must be present");
    expect(ir.assetClass).toBe("ir");
    expect(ir.supervisoryFactor).toBe(0.005);
    // R100m × 0.5% = R500k = 50_000_000 minor (cents).
    expect(ir.addOn.amount).toBe(BigInt(500_000_00));
  });

  it("FX trades: addOn = notional × 4%", () => {
    const trades: TradeSummary[] = [
      {
        counterpartyId: "CP",
        nettingSetId: "NS",
        assetClass: "fx",
        notional: zar(50_000_000), // R50m
      },
    ];
    const out = computeAddOn(trades);
    expect(out).toHaveLength(1);
    const fx = out[0];
    if (!fx) throw new Error("fx component must be present");
    expect(fx.assetClass).toBe("fx");
    expect(fx.supervisoryFactor).toBe(0.04);
    // R50m × 4% = R2m.
    expect(fx.addOn.amount).toBe(BigInt(2_000_000_00));
  });

  it("mixed asset classes: sums per class, result in fixed order ir → fx", () => {
    const trades: TradeSummary[] = [
      { counterpartyId: "CP", nettingSetId: "NS", assetClass: "fx", notional: zar(10_000_000) },
      { counterpartyId: "CP", nettingSetId: "NS", assetClass: "ir", notional: zar(20_000_000) },
      { counterpartyId: "CP", nettingSetId: "NS", assetClass: "ir", notional: zar(30_000_000) },
      { counterpartyId: "CP", nettingSetId: "NS", assetClass: "fx", notional: zar(40_000_000) },
    ];
    const out = computeAddOn(trades);
    expect(out).toHaveLength(2);
    const ir = out[0];
    const fx = out[1];
    if (!ir || !fx) throw new Error("ir + fx components must be present");
    expect(ir.assetClass).toBe("ir");
    // IR aggregate notional = R50m; × 0.5% = R250k.
    expect(ir.addOn.amount).toBe(BigInt(250_000_00));
    expect(fx.assetClass).toBe("fx");
    // FX aggregate notional = R50m; × 4% = R2m.
    expect(fx.addOn.amount).toBe(BigInt(2_000_000_00));
  });

  it("empty trade list: empty add-on list", () => {
    expect(computeAddOn([])).toEqual([]);
  });

  it("rejects cross-currency trade lists", () => {
    const trades: TradeSummary[] = [
      { counterpartyId: "CP", nettingSetId: "NS", assetClass: "fx", notional: zar(10_000_000) },
      {
        counterpartyId: "CP",
        nettingSetId: "NS",
        assetClass: "fx",
        notional: money(10_000_000, "USD" as never),
      },
    ];
    expect(() => computeAddOn(trades)).toThrow();
  });

  it("rejects asset classes without a wired supervisory factor (v0)", () => {
    expect(() => supervisoryFactor("credit")).toThrow();
    expect(() => supervisoryFactor("equity")).toThrow();
    expect(() => supervisoryFactor("commodity")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeEad
// ---------------------------------------------------------------------------

describe("SA-CCR computeEad", () => {
  it("EAD = α × (RC + PFE) with α = 1.4", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-EAD",
      counterpartyId: "CP-EAD",
      csaPresent: false,
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(10_000_000), zar(0));
    // RC = R10m.
    const trades: TradeSummary[] = [
      {
        counterpartyId: "CP-EAD",
        nettingSetId: "NS-EAD",
        assetClass: "ir",
        notional: zar(100_000_000),
      },
    ];
    const addOns = computeAddOn(trades);
    // PFE = R500k.
    const ead = computeEad(rc, addOns, { counterpartyId: "CP-EAD" });
    // RC + PFE = R10.5m; × 1.4 = R14.7m.
    expect(ead.alpha).toBe(ALPHA_SA_CCR);
    expect(ead.rc.amount).toBe(BigInt(10_000_000_00));
    expect(ead.pfe.amount).toBe(BigInt(500_000_00));
    expect(ead.ead.amount).toBe(BigInt(14_700_000_00));
  });

  it("EAD with zero PFE = α × RC", () => {
    const ns: NettingSet = {
      nettingSetId: "NS-EAD-NOPFE",
      counterpartyId: "CP-NOPFE",
      csaPresent: false,
      currency: "ZAR",
    };
    const rc = computeReplacementCost(ns, zar(5_000_000), zar(0));
    const ead = computeEad(rc, [], { counterpartyId: "CP-NOPFE" });
    // RC = R5m; PFE = 0; EAD = 1.4 × R5m = R7m.
    expect(ead.pfe.amount).toBe(0n);
    expect(ead.ead.amount).toBe(BigInt(7_000_000_00));
  });
});

// ---------------------------------------------------------------------------
// computeAndEmit — end-to-end + round-trip with pre-deal-check
// ---------------------------------------------------------------------------

describe("SA-CCR computeAndEmit", () => {
  it("emits CcrReplacementCostComputed with correct payload", () => {
    const cp = uniqueId("CP-EMIT");
    const ns: NettingSet = {
      nettingSetId: `NS-${cp}-ZAR`,
      counterpartyId: cp,
      csaPresent: true,
      threshold: zar(0),
      mta: zar(100_000),
      currency: "ZAR",
    };
    const result = computeAndEmit({
      nettingSet: ns,
      vMtm: zar(7_500_000),
      collateralHeld: zar(2_000_000),
      trades: [
        {
          counterpartyId: cp,
          nettingSetId: ns.nettingSetId,
          assetClass: "ir",
          notional: zar(80_000_000),
        },
        {
          counterpartyId: cp,
          nettingSetId: ns.nettingSetId,
          assetClass: "fx",
          notional: zar(20_000_000),
        },
      ],
      asOf: tsIso(),
    });
    // V − C = R5.5m; MTA + TH = R100k; max = R5.5m.
    expect(result.rc.rc.amount).toBe(BigInt(5_500_000_00));
    // IR add-on: R80m × 0.5% = R400k.
    // FX add-on: R20m × 4%   = R800k.
    // PFE = R1.2m.
    expect(result.ead.pfe.amount).toBe(BigInt(1_200_000_00));
    // EAD = 1.4 × (R5.5m + R1.2m) = R9.38m.
    expect(result.ead.ead.amount).toBe(BigInt(9_380_000_00));

    // Event shape sanity.
    expect(result.event.type).toBe("CcrReplacementCostComputed");
    const payload = result.event.payload as {
      nettingSetId: string;
      counterpartyId: string;
      rc: number;
      currency: string;
      computationDate: string;
      methodology: string;
      vMtm: number;
      collateralHeld: number;
    };
    expect(payload.nettingSetId).toBe(ns.nettingSetId);
    expect(payload.counterpartyId).toBe(cp);
    expect(payload.rc).toBe(5_500_000_00);
    expect(payload.methodology).toBe("sa-ccr");
    expect(payload.computationDate).toBe("2026-05-20");
    expect(payload.vMtm).toBe(7_500_000_00);
    expect(payload.collateralHeld).toBe(2_000_000_00);
  });

  it("round-trip with pre-deal-check.checkHeadroom — no fallback path", () => {
    const cp = uniqueId("CP-ROUND");

    // Seed the credit-limit lifecycle so checkHeadroom can compute headroom.
    const asOf = tsIso();
    eventStore.append(
      makeCreditLimitApplicationSubmitted({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          applicationId: `CL-APP-${cp}`,
          counterpartyId: cp,
          requestedLimit: 50_000_000_00,
          currency: "ZAR",
          tenor: "364D",
          productTypes: ["fx-spot"],
          tradingDesk: "FX-Sales",
          commercialRationale: "Round-trip test.",
          submittedBy: "test:rohan",
          submittedAt: asOf,
        },
        eventId: newEventId(),
      }),
    );
    eventStore.append(
      makeCreditLimitApproved({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          applicationId: `CL-APP-${cp}`,
          counterpartyId: cp,
          limit: 50_000_000_00,
          currency: "ZAR",
          tenor: "364D",
          approvedBy: "test:helena",
          approvalAuthority: "CRC",
          approvedAt: asOf,
          conditions: [],
          expiryDate: "2099-12-31",
        },
        eventId: newEventId(),
      }),
    );
    eventStore.append(
      makeCreditLimitLoaded({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cp,
          limit: 50_000_000_00,
          currency: "ZAR",
          loadedAt: asOf,
          effectiveFrom: asOf,
          loadedBy: "test:rohan",
        },
        eventId: newEventId(),
      }),
    );

    // Drive an SA-CCR computation. RC will land as an event in the store.
    const ns: NettingSet = {
      nettingSetId: `NS-${cp}-ZAR`,
      counterpartyId: cp,
      csaPresent: false,
      currency: "ZAR",
    };
    computeAndEmit({
      nettingSet: ns,
      vMtm: zar(8_000_000),
      collateralHeld: zar(0),
      trades: [],
      asOf,
    });

    // Now pre-deal-check should pick the EAD up via getCurrentExposure
    // (computeAndEmit emits CcrEadComputed alongside CcrReplacementCostComputed
    // under D-CREDIT-LIMIT-ENGINE-BUILD Phase 5; the engine prefers the EAD
    // event over RC). EAD = α × (RC + PFE) = 1.4 × (R8m + R0) = R11.2m.
    const headroom = checkHeadroom(cp, zar(1_000_000), asOf);
    expect(headroom.ok).toBe(true);
    // Limit R50m; existing EAD = R11.2m; proposed R1m → utilisation
    // = R12.2m / R50m = 24.4%.
    expect(headroom.currentExposure.amount).toBe(BigInt(11_200_000_00));
    expect(headroom.utilisationPct).toBeCloseTo(24.4, 1);
  });
});
