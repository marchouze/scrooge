// tests/ba-210-large-exposures.test.ts
//
// WS-BA-RETURNS-FOLLOWON — exit-criterion tests for the BA 210 (Credit
// Concentration Risk / Large Exposures, LEX) generator.
//
// Asserts:
//   1. A concentrated counterparty ≥ 10% of capital → flagged a large exposure;
//      > 25% AND non-exempt → breach.
//   2. A diversified book (all obligors < 10%) → no large exposures, breach=false.
//   3. Issuer / counterparty aggregation: multiple instruments to the same
//      obligor party id sum into one large-exposure row.
//   4. Sovereign exemption (Reg 24(8)(a)) — a sovereign issuer over 25% is
//      flagged large but never breaches.
//   5. Events-first: readDebtExposures grain (bond issuer / IBL counterparty)
//      flows through to obligor aggregation; deposits excluded.
//   6. Threshold + limit constants match the cited Reg 24 / D3/2022 figures.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH;
//   brief:mira:ws-ba-returns-followon-ba-210-large-exposures-le:2026-06-09.
//
// Author: Mira (Regulatory reporting engineer, engineering).

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DebtExposure } from "../platform/accounting/ecl-engine";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import {
  makeDepositTaken,
  makeInterbankLoanMatured,
  makeInterbankLoanPlaced,
} from "../platform/event-store/event-types/repo-mmd-ibl";
import { EventStore } from "../platform/event-store/store";
import {
  LEX_HARD_LIMIT_PCT,
  LEX_LARGE_EXPOSURE_THRESHOLD_PCT,
  canonicaliseBa210,
  generateBa210LargeExposures,
  generateBa210LargeExposuresFromEvents,
  renderBa210Canonical,
  renderBa210ToJson,
} from "../platform/reporting";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:test:ba210" };
const CITATIONS = ["D-BA-RETURNS-FOLLOWON-BATCH"];
const AS_OF = "2026-05-31T00:00:00.000Z";

// R100,000,000 eligible capital base in ZAR cents — fixed for deterministic
// %-of-capital arithmetic in the pure-generator tests.
const CAPITAL = 100_000_000_00;

function exp(
  partial: Partial<DebtExposure> & Pick<DebtExposure, "instrumentId" | "eadMinor">,
): DebtExposure {
  return {
    instrumentId: partial.instrumentId,
    tradeId: partial.tradeId ?? partial.instrumentId,
    riskBucket: partial.riskBucket ?? "debt-other",
    productFamily: partial.productFamily ?? "bond",
    exposureClass: partial.exposureClass ?? "corporate",
    eadMinor: partial.eadMinor,
    currency: partial.currency ?? "ZAR",
    ...(partial.obligorPartyId ? { obligorPartyId: partial.obligorPartyId } : {}),
  };
}

function baseInput(exposures: DebtExposure[]) {
  return {
    entity: ENTITY,
    asOf: AS_OF,
    functionalCurrency: "ZAR",
    exposures,
    capitalBaseMinor: CAPITAL,
  };
}

describe("generateBa210LargeExposures (pure)", () => {
  it("flags an obligor ≥ 10% of capital as a large exposure", () => {
    // 12% of R100m capital = R12m exposure.
    const out = generateBa210LargeExposures(
      baseInput([
        exp({
          instrumentId: "fi:bond:CORP-A",
          obligorPartyId: "lei:CORP-A",
          eadMinor: 12_000_000_00,
        }),
      ]),
    );
    expect(out.largeExposureCount).toBe(1);
    const row = out.largeExposures[0];
    expect(row?.obligorPartyId).toBe("lei:CORP-A");
    expect(row?.isLargeExposure).toBe(true);
    expect(row?.exposurePctOfCapital).toBeCloseTo(0.12, 10);
    expect(row?.isBreach).toBe(false); // 12% < 25%
    expect(out.breach).toBe(false);
  });

  it("flags an obligor > 25% of capital as a breach", () => {
    // 30% of R100m = R30m — over the 25% hard limit.
    const out = generateBa210LargeExposures(
      baseInput([
        exp({
          instrumentId: "fi:bond:CORP-B",
          obligorPartyId: "lei:CORP-B",
          eadMinor: 30_000_000_00,
        }),
      ]),
    );
    expect(out.breach).toBe(true);
    expect(out.breachedObligors).toEqual(["lei:CORP-B"]);
    expect(out.largeExposures[0]?.isBreach).toBe(true);
    expect(out.largeExposures[0]?.exposurePctOfCapital).toBeCloseTo(0.3, 10);
  });

  it("a diversified book under 10% yields no large exposures and no breach", () => {
    const out = generateBa210LargeExposures(
      baseInput([
        exp({ instrumentId: "fi:bond:D1", obligorPartyId: "lei:D1", eadMinor: 5_000_000_00 }), // 5%
        exp({ instrumentId: "fi:bond:D2", obligorPartyId: "lei:D2", eadMinor: 8_000_000_00 }), // 8%
        exp({ instrumentId: "fi:ibl:D3", obligorPartyId: "lei:D3", eadMinor: 9_990_000_00 }), // 9.99%
      ]),
    );
    expect(out.largeExposureCount).toBe(0);
    expect(out.largeExposures).toEqual([]);
    expect(out.breach).toBe(false);
    expect(out.aggregateLargeExposureMinor).toBe(0);
  });

  it("aggregates multiple instruments to the same obligor into one row", () => {
    // Two bond lines + one IBL all to lei:BIGBANK: 6% + 6% + 14% = 26% → breach.
    const out = generateBa210LargeExposures(
      baseInput([
        exp({ instrumentId: "fi:bond:X1", obligorPartyId: "lei:BIGBANK", eadMinor: 6_000_000_00 }),
        exp({ instrumentId: "fi:bond:X2", obligorPartyId: "lei:BIGBANK", eadMinor: 6_000_000_00 }),
        exp({
          instrumentId: "fi:ibl:X3",
          obligorPartyId: "lei:BIGBANK",
          exposureClass: "bank",
          eadMinor: 14_000_000_00,
        }),
      ]),
    );
    expect(out.largeExposureCount).toBe(1);
    const row = out.largeExposures[0];
    expect(row?.obligorPartyId).toBe("lei:BIGBANK");
    expect(row?.exposureMinor).toBe(26_000_000_00);
    expect(row?.exposurePctOfCapital).toBeCloseTo(0.26, 10);
    expect(row?.contributingInstruments).toEqual(["fi:bond:X1", "fi:bond:X2", "fi:ibl:X3"]);
    expect(row?.isBreach).toBe(true);
    expect(out.breach).toBe(true);
  });

  it("exempts a sovereign issuer over 25% from the breach test (Reg 24(8)(a))", () => {
    // 40% of capital to the RSA sovereign issuer — large, but exempt → no breach.
    const out = generateBa210LargeExposures(
      baseInput([
        exp({
          instrumentId: "fi:bond:ZAG000030108",
          obligorPartyId: "issuer:sovereign:RSA",
          exposureClass: "sovereign",
          eadMinor: 40_000_000_00,
        }),
      ]),
    );
    expect(out.largeExposureCount).toBe(1);
    const row = out.largeExposures[0];
    expect(row?.isLargeExposure).toBe(true);
    expect(row?.isExempt).toBe(true);
    expect(row?.isBreach).toBe(false);
    expect(out.breach).toBe(false);
    // Exempt obligors are excluded from the aggregate large-exposure cap base.
    expect(out.aggregateLargeExposureMinor).toBe(0);
  });

  it("falls back to instrumentId grain when an exposure has no obligorPartyId", () => {
    const out = generateBa210LargeExposures(
      baseInput([exp({ instrumentId: "fi:bond:NOOBLIGOR", eadMinor: 15_000_000_00 })]),
    );
    expect(out.largeExposures[0]?.obligorPartyId).toBe("fi:bond:NOOBLIGOR");
    expect(out.largeExposures[0]?.isLargeExposure).toBe(true);
  });

  it("rejects a non-bank entity and a non-positive capital base", () => {
    expect(() =>
      generateBa210LargeExposures({ ...baseInput([]), entity: "LE-ZA-HOZ-SECURITIES" }),
    ).toThrow(/bank-licence-bound/);
    expect(() => generateBa210LargeExposures({ ...baseInput([]), capitalBaseMinor: 0 })).toThrow(
      /positive finite amount/,
    );
  });

  it("threshold + hard-limit constants match the cited Reg 24 / D3/2022 figures", () => {
    expect(LEX_LARGE_EXPOSURE_THRESHOLD_PCT).toBe(0.1); // Reg 24(7)(a) + Reg 24(6)(f)
    expect(LEX_HARD_LIMIT_PCT).toBe(0.25); // Reg 24(6)–(8); D3/2022
  });
});

// ---------------------------------------------------------------------------
// Events-first
// ---------------------------------------------------------------------------

function freshStore(): EventStore {
  const dir = mkdtempSync(join(tmpdir(), "ba210-events-"));
  return new EventStore(join(dir, "event.db"));
}

function bookBond(store: EventStore, overrides: Record<string, unknown> = {}): void {
  store.append(
    makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: "TRD-BOND-001",
        bondIsin: "ZAG000030108",
        side: "buy",
        nominalMinor: 40_000_000_00,
        cleanPricePercent: 100.0,
        accruedInterestMinor: 0,
        dirtyPricePercent: 100.0,
        settlementDate: "2026-05-27",
        portfolio: "banking-book",
        couponRate: 0.085,
        maturityDate: "2031-05-27",
        currency: "ZAR",
        counterpartyLei: "CP-LEI-001",
        executedAt: AS_OF,
        ...overrides,
      } as never,
    }),
  );
}

function placeIbl(store: EventStore, overrides: Record<string, unknown> = {}): void {
  store.append(
    makeInterbankLoanPlaced({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        placementId: "IBL-001",
        counterpartyLei: "BANK-LEI-001",
        principalZar: 30_000_000_00,
        rateDecimal: 0.0825,
        startDate: "2026-05-22",
        maturityDate: "2026-06-22",
        placementType: "fixed-term",
        bookId: "treasury",
        instrumentRef: "IBL-FT-ZAR-001",
        exposureClass: "bank",
        ...overrides,
      } as never,
    }),
  );
}

describe("generateBa210LargeExposuresFromEvents", () => {
  it("aggregates a bond issuer (sovereign-exempt) and an IBL counterparty by obligor grain", () => {
    const store = freshStore();
    bookBond(store); // R40m sovereign bond → 40% of R100m, exempt
    placeIbl(store); // R30m IBL to BANK-LEI-001 → 30% of R100m, breach

    const out = generateBa210LargeExposuresFromEvents(store, AS_OF, ENTITY, "ZAR", CAPITAL);

    expect(out.largeExposureCount).toBe(2);

    const sovereign = out.largeExposures.find((l) => l.obligorPartyId === "issuer:sovereign:RSA");
    expect(sovereign?.exposureMinor).toBe(40_000_000_00);
    expect(sovereign?.isExempt).toBe(true);
    expect(sovereign?.isBreach).toBe(false);

    const bank = out.largeExposures.find((l) => l.obligorPartyId === "lei:BANK-LEI-001");
    expect(bank?.exposureMinor).toBe(30_000_000_00);
    expect(bank?.isExempt).toBe(false);
    expect(bank?.isBreach).toBe(true);

    expect(out.breach).toBe(true);
    expect(out.breachedObligors).toEqual(["lei:BANK-LEI-001"]);
  });

  it("excludes deposits (liabilities) and matured placements from the exposure base", () => {
    const store = freshStore();
    // A deposit — the bank is the obligor; must NOT appear as a debt asset.
    store.append(
      makeDepositTaken({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          depositId: "DEP-001",
          counterpartyLei: "DEPOSITOR-LEI",
          principalZar: 80_000_000_00,
          interestRateDecimal: 0.07,
          maturityDate: "2026-11-20",
          depositCategory: "wholesale-non-operational",
          bookId: "retail",
          instrumentRef: "DEP-CALL-001",
        } as never,
      }),
    );
    // A placement that has since matured — derecognised, excluded.
    placeIbl(store, { placementId: "IBL-MATURED", principalZar: 30_000_000_00 });
    store.append(
      makeInterbankLoanMatured({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          placementId: "IBL-MATURED",
          principalZar: 30_000_000_00,
          interestReceivedZar: 200_000_00,
        } as never,
      }),
    );

    const out = generateBa210LargeExposuresFromEvents(store, AS_OF, ENTITY, "ZAR", CAPITAL);
    expect(out.largeExposureCount).toBe(0);
    expect(out.breach).toBe(false);
  });

  it("derives the capital base from getEligibleCapital when none is supplied", () => {
    const store = freshStore();
    placeIbl(store, { principalZar: 30_000_000_00 });
    const out = generateBa210LargeExposuresFromEvents(store, AS_OF, ENTITY, "ZAR");
    // Build-phase eligible capital is the ICAAP envelope; the generator must
    // surface a positive base and the source label.
    expect(out.meta.capitalBaseMinor).toBeGreaterThan(0);
    expect(out.meta.capitalBaseSource).toContain("getEligibleCapital");
  });
});

describe("renderBa210 — deterministic JSON", () => {
  it("renders + canonicalises byte-identically for a fixed renderedAt", () => {
    const out = generateBa210LargeExposures(
      baseInput([
        exp({
          instrumentId: "fi:bond:CORP-C",
          obligorPartyId: "lei:CORP-C",
          eadMinor: 30_000_000_00,
        }),
        exp({
          instrumentId: "fi:bond:ZAG000030108",
          obligorPartyId: "issuer:sovereign:RSA",
          exposureClass: "sovereign",
          eadMinor: 40_000_000_00,
        }),
      ]),
    );
    const opts = { renderedAt: "2026-05-31T12:00:00.000Z" };
    const render = renderBa210ToJson(out, opts);
    expect(render.meta.form).toBe("BA 210");
    expect(render.breach).toBe(true);
    // Sorted descending by exposure: R40m sovereign first, R30m corporate second.
    expect(render.largeExposures[0]?.exposurePctOfCapitalPercent).toBe("40.00%");
    const corp = render.largeExposures.find((l) => l.obligorPartyId === "lei:CORP-C");
    expect(corp?.exposurePctOfCapitalPercent).toBe("30.00%");
    expect(corp?.isBreach).toBe(true);
    expect(render.thresholdPctPercent).toBe("10.00%");
    expect(render.hardLimitPctPercent).toBe("25.00%");

    const a = canonicaliseBa210(render);
    const b = renderBa210Canonical(out, opts).canonicalJson;
    expect(a).toBe(b);
    // Idempotent across two independent renders.
    expect(renderBa210Canonical(out, opts).canonicalJson).toBe(a);
  });
});
