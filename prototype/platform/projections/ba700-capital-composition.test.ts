// platform/projections/ba700-capital-composition.test.ts
//
// Tests for the BA-700 / BA-100 capital-composition fold (D-CAPITAL-ASSET-CLASS-V1),
// including the R300,000,000 CET1 capital-injection DEMONSTRATION: the fold derives
// CET1 = Tier 1 = Total own funds = R300,000,000 from one capital FIL instrument.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import type {
  FilCapitalSubCategory,
  FilCapitalTier,
  FilInstrumentCreatedPayload,
} from "../../v2-core/fil-instances/events";
import {
  postCapitalIssuanceLegs,
  resolveOwnFundsAccount,
  resolveSettlementCashAccount,
} from "../../v2-core/posting-rules/capital";
import {
  type CapitalComposition,
  foldCapitalComposition,
  isOwnFundsAccount,
} from "./ba700-capital-composition";

const ENTITY = "LE-ZA-HOZ-BANK";

function capitalCreated(args: {
  instanceId: string;
  amount: string;
  tier: FilCapitalTier;
  subCategory: FilCapitalSubCategory;
  currency?: string;
}): { type: string; payload: FilInstrumentCreatedPayload } {
  const currency = args.currency ?? "ZAR";
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance: `fil:inst:${ENTITY}:${args.instanceId}`,
    type: "fil:type:capital:instrument:vanilla@1.0",
    tenant: ENTITY,
    asOf: "2026-06-21T00:00:00.000Z",
    originatingEvent: {
      eventType: "CapitalSubscriptionConfirmed",
      eventId: `o-${args.instanceId}`,
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency, amount: args.amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: `NS-CAPITAL-${args.tier.toUpperCase()}-${currency}`,
      currency,
      settlementDate: "2026-06-21",
      qualifyingCapital: { tier: args.tier, subCategory: args.subCategory },
    },
  };
  return {
    type: "FilInstrumentCreated",
    payload: payload as unknown as FilInstrumentCreatedPayload,
  };
}

describe("capital posting rules — issuance leg resolution", () => {
  test("R300m CET1 paid-up shares → Dr settlement-cash / Cr share capital, balanced", () => {
    const ev = capitalCreated({
      instanceId: "cap-cet1-300m",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });
    const legs = postCapitalIssuanceLegs(ev.payload);
    expect(legs).toHaveLength(2);

    const debit = legs.find((l) => l.creditDebit === "debit");
    const credit = legs.find((l) => l.creditDebit === "credit");
    expect(debit?.accountCode).toBe("ACC-1200-001"); // ZAR settlement-cash nostro
    expect(credit?.accountCode).toBe("ACC-5000-001"); // Share Capital — CET1
    expect(debit?.amount.amount).toBe("300000000");
    expect(credit?.amount.amount).toBe("300000000");
    expect(credit?.capitalTier).toBe("cet1");
    expect(credit?.capitalSubCategory).toBe("cet1.paid-up-ordinary-shares");
  });

  test("own-funds account resolution is fail-closed on a tier↔sub-category mismatch", () => {
    expect(() =>
      resolveOwnFundsAccount({ tier: "cet1", subCategory: "t2.subordinated-debt" }),
    ).toThrow(/does not match/);
  });

  test("settlement-cash resolution is fail-closed on an unmapped currency", () => {
    expect(() => resolveSettlementCashAccount("XAU")).toThrow(/no settlement-cash/);
  });

  test("isOwnFundsAccount distinguishes own-funds from the nostro cash leg", () => {
    expect(isOwnFundsAccount("ACC-5000-001")).toBe(true);
    expect(isOwnFundsAccount("ACC-5050-001")).toBe(true);
    expect(isOwnFundsAccount("ACC-5200-001")).toBe(true);
    expect(isOwnFundsAccount("ACC-1200-001")).toBe(false); // nostro settlement cash
  });
});

describe("capital-composition fold — R300m injection demonstration", () => {
  test("one R300m CET1 instrument → CET1 = Tier1 = Total own funds = R300m", () => {
    const comp: CapitalComposition = foldCapitalComposition(
      [
        capitalCreated({
          instanceId: "cap-cet1-300m",
          amount: "300000000",
          tier: "cet1",
          subCategory: "cet1.paid-up-ordinary-shares",
        }),
      ],
      "ZAR",
    );

    // R300,000,000 in minor units (cents) = 30,000,000,000.
    const R300M_MINOR = 30_000_000_000;
    expect(comp.cet1Minor).toBe(R300M_MINOR);
    expect(comp.at1Minor).toBe(0);
    expect(comp.tier2Minor).toBe(0);
    expect(comp.tier1Minor).toBe(R300M_MINOR); // Tier 1 = CET1 + AT1
    expect(comp.totalOwnFundsMinor).toBe(R300M_MINOR); // Total = Tier1 + Tier2
    expect(comp.lines).toHaveLength(1);
    expect(comp.lines[0]?.tier).toBe("cet1");
    expect(comp.lines[0]?.subCategory).toBe("cet1.paid-up-ordinary-shares");
    expect(comp.lines[0]?.amountMinor).toBe(R300M_MINOR);
  });

  test("full tier composition — CET1 + AT1 + Tier 2 roll up correctly", () => {
    const comp = foldCapitalComposition(
      [
        capitalCreated({
          instanceId: "shares",
          amount: "300000000",
          tier: "cet1",
          subCategory: "cet1.paid-up-ordinary-shares",
        }),
        capitalCreated({
          instanceId: "at1",
          amount: "50000000",
          tier: "at1",
          subCategory: "at1.perpetual-noncumulative",
        }),
        capitalCreated({
          instanceId: "t2",
          amount: "100000000",
          tier: "t2",
          subCategory: "t2.subordinated-debt",
        }),
      ],
      "ZAR",
    );
    expect(comp.cet1Minor).toBe(30_000_000_000);
    expect(comp.at1Minor).toBe(5_000_000_000);
    expect(comp.tier2Minor).toBe(10_000_000_000);
    expect(comp.tier1Minor).toBe(35_000_000_000); // CET1 + AT1
    expect(comp.totalOwnFundsMinor).toBe(45_000_000_000); // Tier1 + Tier2
  });

  test("non-capital instruments are ignored by the capital fold", () => {
    const fxEvent = {
      type: "FilInstrumentCreated",
      payload: {
        kind: "FilInstrumentCreated",
        instance: "fil:inst:LE-ZA-HOZ-BANK:fx-1",
        type: "fil:type:fx:spot:otc-vanilla@1.0",
        tenant: ENTITY,
        asOf: "2026-06-21T00:00:00.000Z",
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
        initialStage: "active",
        economicTerms: {
          assetClass: "fx",
          notional: { currency: "USD", amount: "1000.00" },
          direction: "long",
          counterpartyId: "CP1",
          nettingSetId: "NS-CP1-USD",
          currency: "USD",
          settlementDate: "2026-06-23",
        },
      } as unknown as FilInstrumentCreatedPayload,
    };
    const comp = foldCapitalComposition([fxEvent], "ZAR");
    expect(comp.totalOwnFundsMinor).toBe(0);
    expect(comp.legCount).toBe(0);
  });

  test("cross-currency own funds are excluded from the functional-currency composition", () => {
    const comp = foldCapitalComposition(
      [
        capitalCreated({
          instanceId: "usd-at1",
          amount: "1000000",
          tier: "at1",
          subCategory: "at1.perpetual-noncumulative",
          currency: "USD",
        }),
      ],
      "ZAR",
    );
    expect(comp.totalOwnFundsMinor).toBe(0); // USD leg excluded; ZAR-only composition
  });
});
