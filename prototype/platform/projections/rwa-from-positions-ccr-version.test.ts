// platform/projections/rwa-from-positions-ccr-version.test.ts
//
// Regression: the mixed-version event store holds legacy V1 CcrEadComputed
// events (rc/pfe/ead as integer minor units) alongside V2 (MoneyWire). Read-side
// consumers MUST upcast V1 -> V2 at the read boundary rather than assume
// MoneyWire — a legacy V1 event previously crashed dashboard boot-derive
// (toDecimal(undefined) on the integer `ead`). D-DECIMAL-NATIVE-CONSUMER-MIGRATION.

import { describe, expect, test } from "bun:test";

import { moneyWireFromMinor } from "../core/money-codec";
import { normalizeCcrEadPayload } from "../event-store/event-types/counterparty-credit-risk";

const BASE = {
  nettingSetId: "NS-CP-X-ZAR",
  counterpartyId: "CP-X",
  alpha: 1.4 as const,
  currency: "ZAR",
  computationDate: "2026-06-11",
  methodology: "sa-ccr" as const,
  sourceEvents: { rcEventId: "e1", pfeComponents: 2 },
};

describe("normalizeCcrEadPayload — mixed-version upcast", () => {
  test("legacy V1 (integer ead) upcasts to V2 MoneyWire", () => {
    const v1 = { ...BASE, rc: 55_517_791, pfe: 16_917_542, ead: 101_409_466 };
    const p = normalizeCcrEadPayload(v1);
    expect(typeof p.ead).toBe("object");
    expect(p.ead).toEqual(moneyWireFromMinor(101_409_466, "ZAR"));
    expect(p.rc).toEqual(moneyWireFromMinor(55_517_791, "ZAR"));
    expect(p.nettingSetId).toBe("NS-CP-X-ZAR");
  });

  test("V2 (MoneyWire ead) passes through unchanged", () => {
    const v2 = {
      ...BASE,
      rc: moneyWireFromMinor(55_517_791, "ZAR"),
      pfe: moneyWireFromMinor(16_917_542, "ZAR"),
      ead: moneyWireFromMinor(101_409_466, "ZAR"),
    };
    expect(normalizeCcrEadPayload(v2)).toBe(v2);
  });
});
