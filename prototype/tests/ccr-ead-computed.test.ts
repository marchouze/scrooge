// tests/ccr-ead-computed.test.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — CcrEadComputed event-type tests.
//
// Coverage:
//   - makeCcrEadComputed: round-trip through eventStore preserves payload.
//   - computeAndEmit: emits BOTH CcrReplacementCostComputed and
//     CcrEadComputed; CcrEadComputed.sourceEvents.rcEventId matches the
//     RC event's event_id.
//   - pre-deal-check.checkHeadroom: prefers CcrEadComputed over
//     CcrReplacementCostComputed when both are present; falls back to RC
//     when only RC is present.
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD Phase 5 (CEO-approved 2026-05-20);
//   Policies/credit-risk-policy-v1.md §3 line 131 (IN FORCE 2026-05-13);
//   BCBS d317 §10 (EAD = α × (RC + PFE)).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { type Money, money } from "../platform/core/money";
import { BANK_ZA_001, ZAR, newEventId } from "../platform/core/types";
import {
  type CcrEadComputedPayload,
  type CcrReplacementCostComputedPayload,
  makeCcrEadComputed,
  makeCcrReplacementCostComputed,
} from "../platform/event-store/event-types/counterparty-credit-risk";
import {
  makeCreditLimitApplicationSubmitted,
  makeCreditLimitApproved,
  makeCreditLimitLoaded,
} from "../platform/event-store/event-types/credit-limit";
import { checkHeadroom } from "../platform/risk/credit-limit-engine";
import { type NettingSet, computeAndEmit } from "../platform/risk/sa-ccr";

const ENTITY = String(BANK_ZA_001);
const ACTOR = { type: "service" as const, id: "test:ccr-ead" };
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
  return "2026-05-20T12:00:00.000Z";
}

// ---------------------------------------------------------------------------
// makeCcrEadComputed — schema round-trip
// ---------------------------------------------------------------------------

describe("CcrEadComputed event factory", () => {
  it("round-trips a valid payload through the event store", () => {
    const cp = uniqueId("CP-EAD");
    const rcId = newEventId();
    const payload: CcrEadComputedPayload = {
      nettingSetId: `NS-${cp}-ZAR`,
      counterpartyId: cp,
      rc: 5_500_000_00,
      pfe: 1_200_000_00,
      alpha: 1.4,
      ead: 9_380_000_00,
      currency: "ZAR",
      computationDate: "2026-05-20",
      methodology: "sa-ccr",
      sourceEvents: {
        rcEventId: rcId,
        pfeComponents: 2,
      },
    };

    const event = makeCcrEadComputed({
      asOf: tsIso(),
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });

    expect(event.type).toBe("CcrEadComputed");
    eventStore.append(event);

    let observed: CcrEadComputedPayload | undefined;
    for (const e of eventStore.replay({ type: "CcrEadComputed" })) {
      const p = e.payload as CcrEadComputedPayload;
      if (p.counterpartyId === cp) observed = p;
    }
    expect(observed).toBeDefined();
    expect(observed?.rc).toBe(5_500_000_00);
    expect(observed?.pfe).toBe(1_200_000_00);
    expect(observed?.ead).toBe(9_380_000_00);
    expect(observed?.alpha).toBe(1.4);
    expect(observed?.methodology).toBe("sa-ccr");
    expect(observed?.sourceEvents.rcEventId).toBe(rcId);
    expect(observed?.sourceEvents.pfeComponents).toBe(2);
  });

  it("rejects negative ead via the zod schema", () => {
    expect(() =>
      makeCcrEadComputed({
        asOf: tsIso(),
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          nettingSetId: "NS-X-ZAR",
          counterpartyId: "CP-X",
          rc: 0,
          pfe: 0,
          alpha: 1.4,
          ead: -1,
          currency: "ZAR",
          computationDate: "2026-05-20",
          methodology: "sa-ccr",
          sourceEvents: { rcEventId: "evt-1", pfeComponents: 0 },
        },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeAndEmit — emits BOTH RC and EAD; chain link is intact
// ---------------------------------------------------------------------------

describe("SA-CCR computeAndEmit — RC + EAD emission", () => {
  it("emits CcrReplacementCostComputed AND CcrEadComputed; sourceEvents.rcEventId matches", () => {
    const cp = uniqueId("CP-RC-EAD");
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

    // Locate both events for this counterparty.
    let rcEvent: { event_id: string; payload: CcrReplacementCostComputedPayload } | undefined;
    for (const e of eventStore.replay({ type: "CcrReplacementCostComputed" })) {
      const p = e.payload as CcrReplacementCostComputedPayload;
      if (p.counterpartyId === cp) rcEvent = { event_id: e.event_id, payload: p };
    }
    let eadEvent: { event_id: string; payload: CcrEadComputedPayload } | undefined;
    for (const e of eventStore.replay({ type: "CcrEadComputed" })) {
      const p = e.payload as CcrEadComputedPayload;
      if (p.counterpartyId === cp) eadEvent = { event_id: e.event_id, payload: p };
    }

    expect(rcEvent).toBeDefined();
    expect(eadEvent).toBeDefined();

    // RC = R5.5m. PFE = R240k (v1 SA-CCR: margined MF=0.2, multiplier=1.0
    //   because V−C ≫ 0 — see sa-ccr.test.ts for the per-asset-class
    //   add-on breakdown). EAD = 1.4 × (R5.5m + R240k) = R8.036m.
    expect(rcEvent?.payload.rc).toBe(5_500_000_00);
    expect(eadEvent?.payload.rc).toBe(5_500_000_00);
    expect(eadEvent?.payload.pfe).toBe(240_000_00);
    expect(eadEvent?.payload.ead).toBe(8_036_000_00);
    expect(eadEvent?.payload.alpha).toBe(1.4);
    expect(eadEvent?.payload.methodology).toBe("sa-ccr");
    expect(eadEvent?.payload.currency).toBe("ZAR");
    expect(eadEvent?.payload.computationDate).toBe("2026-05-20");

    // Chain link: CcrEadComputed.sourceEvents.rcEventId === RC event_id.
    expect(eadEvent?.payload.sourceEvents.rcEventId).toBe(rcEvent?.event_id ?? "");
    // Two add-on components (IR + FX).
    expect(eadEvent?.payload.sourceEvents.pfeComponents).toBe(2);

    // computeAndEmit return shape matches the emitted EAD figures.
    expect(result.ead.ead.amount).toBe(BigInt(8_036_000_00));
  });

  it("emits CcrEadComputed with pfeComponents = 0 when netting set has no trades", () => {
    const cp = uniqueId("CP-NOTRADES");
    const ns: NettingSet = {
      nettingSetId: `NS-${cp}-ZAR`,
      counterpartyId: cp,
      csaPresent: false,
      currency: "ZAR",
    };
    computeAndEmit({
      nettingSet: ns,
      vMtm: zar(3_000_000),
      collateralHeld: zar(0),
      trades: [],
      asOf: tsIso(),
    });

    let eadEvent: CcrEadComputedPayload | undefined;
    for (const e of eventStore.replay({ type: "CcrEadComputed" })) {
      const p = e.payload as CcrEadComputedPayload;
      if (p.counterpartyId === cp) eadEvent = p;
    }
    expect(eadEvent).toBeDefined();
    expect(eadEvent?.pfe).toBe(0);
    // EAD = 1.4 × R3m = R4.2m.
    expect(eadEvent?.ead).toBe(4_200_000_00);
    expect(eadEvent?.sourceEvents.pfeComponents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pre-deal-check — prefers CcrEadComputed over RC
// ---------------------------------------------------------------------------

describe("pre-deal-check prefers CcrEadComputed", () => {
  function seedLimit(cp: string, limitMinor: number, asOf: string): void {
    eventStore.append(
      makeCreditLimitApplicationSubmitted({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          applicationId: `CL-APP-${cp}`,
          counterpartyId: cp,
          requestedLimit: limitMinor,
          currency: "ZAR",
          tenor: "364D",
          productTypes: ["fx-spot"],
          tradingDesk: "FX-Sales",
          commercialRationale: "Test.",
          submittedBy: "test:atlas",
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
          limit: limitMinor,
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
          limit: limitMinor,
          currency: "ZAR",
          loadedAt: asOf,
          effectiveFrom: asOf,
          loadedBy: "test:atlas",
        },
        eventId: newEventId(),
      }),
    );
  }

  it("uses EAD when present (which is RC × α + PFE × α, i.e. greater than RC alone)", () => {
    const cp = uniqueId("CP-PREFER-EAD");
    const asOf = tsIso();

    seedLimit(cp, 50_000_000_00, asOf);

    // Emit RC = R8m and a corresponding EAD = R11.2m (1.4 × R8m, zero PFE).
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

    // checkHeadroom should now read the EAD, not the RC.
    const headroom = checkHeadroom(cp, zar(1_000_000), asOf);
    expect(headroom.ok).toBe(true);
    // Expect EAD = R11.2m, not RC = R8m.
    expect(headroom.currentExposure.amount).toBe(BigInt(11_200_000_00));
  });

  it("falls back to RC when only CcrReplacementCostComputed is observed", () => {
    const cp = uniqueId("CP-RC-ONLY");
    const asOf = tsIso();

    seedLimit(cp, 50_000_000_00, asOf);

    // Manually emit ONLY a CcrReplacementCostComputed event (no EAD).
    eventStore.append(
      makeCcrReplacementCostComputed({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          nettingSetId: `NS-${cp}-ZAR`,
          counterpartyId: cp,
          rc: 6_000_000_00,
          currency: "ZAR",
          computationDate: "2026-05-20",
          methodology: "sa-ccr",
          vMtm: 6_000_000_00,
          collateralHeld: 0,
        },
        eventId: newEventId(),
      }),
    );

    const headroom = checkHeadroom(cp, zar(1_000_000), asOf);
    expect(headroom.ok).toBe(true);
    // RC-fallback: exposure = R6m (RC), not α × RC.
    expect(headroom.currentExposure.amount).toBe(BigInt(6_000_000_00));
  });
});
