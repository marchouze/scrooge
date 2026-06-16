// platform/projections/alm-positions-v2.test.ts
//
// Unit tests for the WS-V2-AUTHORITATIVE S6 dashboard-shaped V2 ALM projection.
// Proves:
//   1. getALMPositionSnapshotV2 returns the IDENTICAL ALMPositionSnapshot shape
//      as the V1 getALMPositionSnapshot — same numeric position arrays — when
//      fed equivalent V1 / V2 money-market events on an isolated store.
//   2. Build-phase (empty store) returns an empty, buildPhase:true snapshot.
//   3. A V2 position in a NON-reporting currency is NOT silently FX-converted
//      into the LCR/NSFR ratio — it is excluded and surfaced as a gap
//      (no silent cross-currency arithmetic — Engineering Charter cmd 2/4).
//
// Authority: D-BANK-WIDE-V2-MIGRATION + D-V1-REMOVAL-PHASE-3B.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { tenantIdSchema } from "../../v2-core/control-plane/tenant";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import {
  makeDepositTaken,
  makeFundingLineDrawn,
  makeInterbankLoanPlaced,
} from "../event-store/event-types/repo-mmd-ibl";
import {
  makeDepositTakenV2,
  makeFundingLineDrawnV2,
  makeInterbankLoanPlacedV2,
} from "../event-store/event-types/repo-mmd-ibl-v2";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { getALMPositionSnapshot } from "./alm-positions";
import { computeALMPositionSnapshotV2, getALMPositionSnapshotV2 } from "./alm-positions-v2";

const ACTOR: Actor = { type: "system", id: "atlas:alm-v2-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = tenantIdSchema.parse("tenant:za-bank");
const CITES = ["D-V1-REMOVAL-PHASE-3B"];
const AS_OF = "2026-06-16T00:00:00.000Z";
const HORIZON = 30;

function wire(amount: string, currency: string) {
  return encodeMoney(money(amount, currency as Currency));
}

/** Sort+JSON a snapshot's numeric arrays so order is not load-bearing. */
function shape(snap: ReturnType<typeof getALMPositionSnapshot>) {
  const s = <T extends { amountZar: number }>(arr: readonly T[]): T[] =>
    [...arr].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({
    hqla: s(snap.hqlaPositions),
    funding: s(snap.fundingPositions),
    asf: s(snap.asfItems),
    rsf: s(snap.rsfItems),
  });
}

describe("getALMPositionSnapshotV2 — shape parity with V1", () => {
  test("V1 and V2 snapshots have the IDENTICAL numeric position arrays", () => {
    const v1Store = new EventStore(":memory:");
    const v2Store = new EventStore(":memory:");

    // --- Deposit: R10,000,000.00 wholesale-non-operational, 6-month tenor ---
    v1Store.append(
      makeDepositTaken({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          depositId: "DEP-001",
          counterpartyLei: "LEI-XYZ",
          principalZar: 1_000_000_000, // R10,000,000.00 in cents
          interestRateDecimal: 0.0795,
          maturityDate: "2026-12-16",
          depositCategory: "wholesale-non-operational",
          bookId: "TREASURY",
          instrumentRef: "MMD-ZAR-001",
        },
      }),
    );
    v2Store.append(
      makeDepositTakenV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          depositId: "DEP-001",
          counterpartyLei: "LEI-XYZ",
          principal: wire("10000000.00", "ZAR"),
          interestRateDecimal: 0.0795,
          maturityDate: "2026-12-16",
          depositCategory: "wholesale-non-operational",
          bookId: "TREASURY",
          instrumentRef: "MMD-ZAR-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );

    // --- Funding line drawn: R5,000,000.00 ---
    v1Store.append(
      makeFundingLineDrawn({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          fundingLineId: "FL-001",
          drawnAmountZar: 500_000_000,
          maturityDate: "2026-09-16",
          rateDecimal: 0.085,
        },
      }),
    );
    v2Store.append(
      makeFundingLineDrawnV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          fundingLineId: "FL-001",
          drawnAmount: wire("5000000.00", "ZAR"),
          maturityDate: "2026-09-16",
          rateDecimal: 0.085,
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );

    // --- Interbank placement: R2,000,000.00, fixed-term 90 days ---
    v1Store.append(
      makeInterbankLoanPlaced({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          placementId: "IBL-001",
          counterpartyLei: "LEI-BANK",
          principalZar: 200_000_000,
          rateDecimal: 0.082,
          startDate: "2026-06-16",
          maturityDate: "2026-09-14",
          placementType: "fixed-term",
          bookId: "TREASURY",
          instrumentRef: "IBL-FT-ZAR-001",
        },
      }),
    );
    v2Store.append(
      makeInterbankLoanPlacedV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          placementId: "IBL-001",
          counterpartyLei: "LEI-BANK",
          principal: wire("2000000.00", "ZAR"),
          rateDecimal: 0.082,
          startDate: "2026-06-16",
          maturityDate: "2026-09-14",
          placementType: "fixed-term",
          bookId: "TREASURY",
          instrumentRef: "IBL-FT-ZAR-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );

    const v1 = getALMPositionSnapshot(v1Store, AS_OF, HORIZON, ENTITY);
    const v2 = getALMPositionSnapshotV2(v2Store, AS_OF, HORIZON, ENTITY);

    // The numeric arrays must be identical (prose fields legitimately differ).
    expect(shape(v2)).toBe(shape(v1));
    // Sanity: the funding fold actually produced positions (not vacuously equal).
    expect(v2.fundingPositions.length).toBeGreaterThan(0);
    expect(v2.asfItems.length).toBeGreaterThan(0);
    expect(v2.rsfItems.length).toBeGreaterThan(0);
  });
});

describe("getALMPositionSnapshotV2 — build phase + currency discipline", () => {
  test("empty store → no money-market positions; buildPhase matches V1", () => {
    const store = new EventStore(":memory:");
    const v1 = getALMPositionSnapshot(store, AS_OF, HORIZON, ENTITY);
    const v2 = getALMPositionSnapshotV2(store, AS_OF, HORIZON, ENTITY);
    // No V2 money-market events → no MM-derived funding/HQLA positions.
    expect(v2.fundingPositions).toHaveLength(0);
    expect(v2.hqlaPositions).toHaveLength(0);
    // buildPhase is driven by computeCapitalMetrics' founding-capital ASF item,
    // identically for V1 and V2 — they must agree.
    expect(v2.buildPhase).toBe(v1.buildPhase);
    expect(v2.gaps.length).toBeGreaterThan(0);
  });

  test("a NON-reporting-currency deposit is excluded and surfaced as a gap (no silent FX)", () => {
    const store = new EventStore(":memory:");
    // Anchor functional currency is ZAR; a USD deposit must NOT be FX-converted
    // into the ratio — it is excluded and flagged.
    store.append(
      makeDepositTakenV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          depositId: "DEP-USD-001",
          counterpartyLei: "LEI-USD",
          principal: wire("1000000.00", "USD"),
          interestRateDecimal: 0.045,
          maturityDate: "2026-12-16",
          depositCategory: "wholesale-non-operational",
          bookId: "TREASURY",
          instrumentRef: "MMD-USD-001",
          tenantId: TENANT,
          schemaVersion: 2,
        },
      }),
    );
    const snap = computeALMPositionSnapshotV2(store, AS_OF, HORIZON, ENTITY);
    // The USD deposit is NOT in the funding positions (no silent conversion).
    expect(snap.fundingPositions).toHaveLength(0);
    // A cross-currency gap is surfaced.
    expect(snap.gaps.some((g) => g.includes("MoneyWire currency other than"))).toBe(true);
  });
});
