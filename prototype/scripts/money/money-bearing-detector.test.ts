// scripts/money/money-bearing-detector.test.ts
//
// WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 1 — proves the fail-closed purge
// classifier: a money-bearing event type with NO provenance category is
// detected, so the slice-4 purge aborts instead of silently retaining
// (orphaning) it — the exact defect that left 496 transactional events in the
// canonical store after PR #1325.
//
// Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION (CEO-approved 2026-06-14, be0580ff).
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, test } from "bun:test";

import {
  type SamplePayloadSource,
  findUncategorisedMoneyTypes,
  isMoneyBearingPayload,
} from "./money-bearing-detector";

function sourceFrom(payloads: Record<string, unknown>): SamplePayloadSource {
  return {
    samplePayload(eventType: string): string | undefined {
      const p = payloads[eventType];
      return p === undefined ? undefined : JSON.stringify(p);
    },
  };
}

describe("isMoneyBearingPayload", () => {
  test("flags a legacy integer *Minor field", () => {
    expect(isMoneyBearingPayload({ nominalMinor: 4_910_000_000 })).toBe(true);
  });

  test("flags a nested *Minor field", () => {
    expect(isMoneyBearingPayload({ leg: { amountZarMinor: 100 } })).toBe(true);
  });

  test("flags a MoneyWire field", () => {
    expect(
      isMoneyBearingPayload({ consideration: { __money: "v1", amount: "1.00", currency: "ZAR" } }),
    ).toBe(true);
  });

  test("does NOT flag a string field ending in Minor (naming coincidence)", () => {
    expect(isMoneyBearingPayload({ labelMinor: "prose" })).toBe(false);
  });

  test("does NOT flag a config payload with no money", () => {
    expect(isMoneyBearingPayload({ partyId: "p1", classification: "bank" })).toBe(false);
  });
});

describe("findUncategorisedMoneyTypes — fail-closed purge guard", () => {
  // A synthetic uncategorised money-bearing type: returns <none> from the
  // category resolver but its payload carries a *Minor field.
  const SYNTHETIC = "SyntheticUncategorisedMoneyEvent";

  const categoryFor = (t: string): string | undefined =>
    // Everything resolves to undefined EXCEPT a known config type.
    t === "PartyRegistered" ? "counterparty" : undefined;

  test("(a) detects a synthetic uncategorised money-bearing type → purge would abort", () => {
    const source = sourceFrom({
      [SYNTHETIC]: { settlementId: "X", dirtyConsiderationZarMinor: 4_810_919_487 },
      PartyRegistered: { partyId: "p1" },
    });

    const offenders = findUncategorisedMoneyTypes(
      [SYNTHETIC, "PartyRegistered"],
      source,
      categoryFor,
    );

    // The synthetic money-bearing type is flagged; the categorised config type
    // is not. A non-empty list is what triggers the slice-4 ABORT.
    expect(offenders).toContain(SYNTHETIC);
    expect(offenders).not.toContain("PartyRegistered");
    expect(offenders.length).toBeGreaterThan(0);
  });

  test("a categorised money-bearing type does NOT abort the purge", () => {
    const source = sourceFrom({
      BondSettlementInstructed: { nominalMinor: 1 },
    });
    // Simulate the post-remediation category map where the type IS categorised.
    const categorised = (t: string): string | undefined =>
      t === "BondSettlementInstructed" ? "settlement" : undefined;

    const offenders = findUncategorisedMoneyTypes(
      ["BondSettlementInstructed"],
      source,
      categorised,
    );
    expect(offenders).toEqual([]);
  });

  test("a non-money uncategorised type does NOT abort the purge", () => {
    const source = sourceFrom({ SomeGovernanceNote: { text: "hello", labelMinor: "x" } });
    const offenders = findUncategorisedMoneyTypes(["SomeGovernanceNote"], source, () => undefined);
    expect(offenders).toEqual([]);
  });
});
