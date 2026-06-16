// platform/risk/rwa-computed-engine-v2.test.ts
//
// Tests for the decimal-native V2 RWA emitter (Bucket A PILOT) — RBC condition
// 3 ("V2 has own tests"). Covers:
//   1. emitRwaComputedV2 appends a RwaComputedV2 event with MoneyWire figures;
//      decoded decimal equals the minor→major conversion.
//   2. Idempotency: a same-(entity, periodId) re-run is a no-op.
//   3. The decoded readers (V1 + V2) project onto the shared decimal shape and
//      agree when both registers carry the same period (parity invariant).
//   4. operationalRwa is the zero placeholder, decoded as "0".
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-RWA-ENGINE-W2-SLICE-3.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { decodeMoney } from "../core/money-codec";
import { newEventId } from "../core/types";
import { makeBondTradeExecuted } from "../event-store/event-types/bond-accounting";
import { makeRwaComputed } from "../event-store/event-types/regulatory-reporting";
import { productionTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import type { Ba310Output } from "../reporting/ba-320-market-risk";
import { computeRwaComputed } from "./rwa-computed-engine";
import {
  emitRwaComputedV2,
  readRwaComputedV1Decoded,
  readRwaComputedV2Decoded,
  rwaComputedV2Exists,
} from "./rwa-computed-engine-v2";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T23:59:59.000Z";
const PERIOD = "period:hoz-bank:month:2026-05";
const ACTOR: Actor = { type: "service", id: "agent:test" };

function makeStore(): EventStore {
  return new EventStore();
}

/** A production-tagged corporate bond → non-zero CRE20 credit RWA. */
function appendBond(store: EventStore, nominalMinor: number): void {
  const ev = makeBondTradeExecuted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: ["D-RWA-ENGINE-W2-SLICE-3"],
    payload: {
      tradeId: `bond-${newEventId()}`,
      bondIsin: "ZAG000000099",
      side: "buy",
      nominalMinor,
      cleanPricePercent: 100,
      accruedInterestMinor: 0,
      dirtyPricePercent: 100,
      settlementDate: AS_OF,
      portfolio: "banking-book",
      couponRate: 0.085,
      maturityDate: "2030-12-31",
      currency: "ZAR",
      counterpartyLei: "LEI-TEST-DEALER",
      executedAt: AS_OF,
      exposureClass: "corporate",
    },
  });
  store.append({ ...ev, provenance: productionTag({ sourceLineage: "test" }) });
}

/** A zero-market-risk BA 320 return for the period (full structural shape). */
function zeroMarketRisk(): Ba310Output {
  return {
    meta: {
      form: "BA 320",
      formVersion: "v0.1-rehearsal",
      entity: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD,
      functionalCurrency: "ZAR",
      generatorVersion: "v0.1",
    },
    interestRateGeneral: { maturityLadder: [], disallowancesMinor: 0, capitalMinor: 0 },
    interestRateSpecific: { issuerLines: [], capitalMinor: 0 },
    equity: { marketLines: [], capitalMinor: 0 },
    fx: { currencyLines: [], sumNetLongsMinor: 0, sumNetShortsMinor: 0, capitalMinor: 0 },
    commodity: { commodityLines: [], capitalMinor: 0 },
    totalMarketRiskCapitalMinor: 0,
    totalMarketRiskRwaMinor: 0,
    citations: ["Regulations Relating to Banks Reg 28"],
    placeholders: [],
  };
}

describe("rwa-computed-engine-v2", () => {
  it("emitRwaComputedV2 appends a RwaComputedV2 with MoneyWire figures matching the minor decode", () => {
    const store = makeStore();
    appendBond(store, 100_000_000_00); // R100m corporate → 65% CRE20 weight

    const expected = computeRwaComputed(store, {
      entityId: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD,
      functionalCurrency: "ZAR",
      marketRisk: zeroMarketRisk(),
    });
    expect(expected.creditRwaMinor).toBeGreaterThan(0);

    const { emitted, eventId } = emitRwaComputedV2(store, {
      entityId: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD,
      functionalCurrency: "ZAR",
      marketRisk: zeroMarketRisk(),
    });
    expect(emitted).toBe(true);

    const ev = [...store.replay({ type: "RwaComputedV2" })].find((e) => e.event_id === eventId);
    expect(ev).toBeDefined();
    const p = ev?.payload as Record<string, unknown>;
    // MoneyWire shape — amount is a STRING (never a number).
    const credit = decodeMoney(p.creditRwa);
    expect(typeof (p.creditRwa as { amount: unknown }).amount).toBe("string");
    expect(String(credit.currency)).toBe("ZAR");
    // Decoded V2 decimal == minor / 100 (ZAR scale 2), value-preserving.
    expect(Number(credit.amount)).toBe(expected.creditRwaMinor / 100);
    expect(Number(decodeMoney(p.totalRwa).amount)).toBe(expected.totalRwaMinor / 100);
    // Operational RWA is the zero placeholder.
    expect(decodeMoney(p.operationalRwa).amount).toBe("0");
    expect(p.operationalRwaIsPlaceholder).toBe(true);
  });

  it("emitRwaComputedV2 is idempotent per (entity, periodId)", () => {
    const store = makeStore();
    appendBond(store, 50_000_000_00);
    const input = {
      entityId: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD,
      functionalCurrency: "ZAR",
      marketRisk: zeroMarketRisk(),
    };
    const first = emitRwaComputedV2(store, input);
    expect(first.emitted).toBe(true);
    expect(rwaComputedV2Exists(store, ENTITY, PERIOD)).toBe(true);
    const second = emitRwaComputedV2(store, input);
    expect(second.emitted).toBe(false);
    expect(second.eventId).toBe(first.eventId);
    const count = [...store.replay({ type: "RwaComputedV2" })].length;
    expect(count).toBe(1);
  });

  it("decoded V1 and V2 readers agree on the shared register (parity invariant)", () => {
    const store = makeStore();
    appendBond(store, 100_000_000_00);

    // V2 via the production emit path.
    emitRwaComputedV2(store, {
      entityId: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD,
      functionalCurrency: "ZAR",
      marketRisk: zeroMarketRisk(),
    });

    // A historical V1 RwaComputed for the SAME period + figures (replay-readable
    // schema; this stands in for a backfilled historical event).
    const expected = computeRwaComputed(store, {
      entityId: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD,
      functionalCurrency: "ZAR",
      marketRisk: zeroMarketRisk(),
    });
    const v1 = makeRwaComputed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...expected.citations],
      payload: {
        entityId: expected.entityId,
        asOf: expected.asOf,
        periodId: expected.periodId,
        functionalCurrency: expected.functionalCurrency,
        creditRwaMinor: expected.creditRwaMinor,
        marketRwaMinor: expected.marketRwaMinor,
        operationalRwaMinor: expected.operationalRwaMinor,
        totalRwaMinor: expected.totalRwaMinor,
        source: expected.source,
        operationalRwaIsPlaceholder: expected.operationalRwaIsPlaceholder,
        sourceEventIds: [...expected.sourceEventIds],
        creditExposureCount: expected.creditExposureCount,
        citations: [...expected.citations],
      },
    });
    store.append({ ...v1, provenance: productionTag({ sourceLineage: "test-v1-historical" }) });

    const filter = { mode: "combined" as const };
    const v1Rows = readRwaComputedV1Decoded(store, { provenanceFilter: filter });
    const v2Rows = readRwaComputedV2Decoded(store, { provenanceFilter: filter });
    expect(v1Rows).toHaveLength(1);
    expect(v2Rows).toHaveLength(1);
    expect(v1Rows[0]?.totalRwa).toBe(v2Rows[0]?.totalRwa);
    expect(v1Rows[0]?.creditRwa).toBe(v2Rows[0]?.creditRwa);
    expect(Number(v2Rows[0]?.totalRwa)).toBeGreaterThan(0);
  });
});
