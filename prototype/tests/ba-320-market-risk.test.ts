// tests/ba-310-market-risk.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — exit-criterion tests
// for BA 310 (market risk) generator + XML render.
//
// Authors: Bea + Helena + Anya.

import { describe, expect, it } from "bun:test";

import {
  BA_310_BANK_ENTITIES,
  BA_310_NAMESPACE,
  BA_310_REQUIRED_ELEMENTS,
  BA_310_XSD_URI,
  Ba310GeneratorError,
  ba310ToXmlPayload,
  generateBa310MarketRisk,
  renderSarbXml,
  validateSarbXmlStructural,
} from "../platform/reporting";
import {
  SLICE_5_MARKET_RISK_ENTRIES,
  SemanticRegistry,
  commodityRisk,
  equityPositionRisk,
  foreignExchangeRisk,
  interestRateGeneralRisk,
  interestRateSpecificRisk,
  marketRiskRwa,
} from "../platform/semantic";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";

const COMMON = {
  entity: ENTITY_BANK,
  asOf: "2026-05-31T23:59:59.999Z",
  periodId: "period:hoz-bank:month:2026-05",
  functionalCurrency: "ZAR",
};

// =====================================================================
// 1. Semantic-layer registration.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — market-risk semantic entries", () => {
  it("the six market-risk entries register without error", () => {
    const reg = SemanticRegistry.from(SLICE_5_MARKET_RISK_ENTRIES);
    expect(reg.size()).toBe(6);
    expect(reg.resolve({ id: "InterestRateGeneralRisk" })).toBeDefined();
    expect(reg.resolve({ id: "InterestRateSpecificRisk" })).toBeDefined();
    expect(reg.resolve({ id: "EquityPositionRisk" })).toBeDefined();
    expect(reg.resolve({ id: "ForeignExchangeRisk" })).toBeDefined();
    expect(reg.resolve({ id: "CommodityRisk" })).toBeDefined();
    expect(reg.resolve({ id: "MarketRiskRwa" })).toBeDefined();
  });

  it("each entry carries at least one resolved + one TBC citation per Q1", () => {
    for (const e of SLICE_5_MARKET_RISK_ENTRIES) {
      const tbc = e.citations.filter((c) => c.type === "tbc").length;
      const resolved = e.citations.filter((c) => c.type !== "tbc").length;
      expect(tbc).toBeGreaterThanOrEqual(1);
      expect(resolved).toBeGreaterThanOrEqual(1);
    }
  });

  it("each entry scopes to Hoz Bank only (bank-licence-bound)", () => {
    for (const e of SLICE_5_MARKET_RISK_ENTRIES) {
      expect(e.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    }
  });

  it("named exports match the array (export-shape coherence)", () => {
    expect(SLICE_5_MARKET_RISK_ENTRIES).toContain(interestRateGeneralRisk);
    expect(SLICE_5_MARKET_RISK_ENTRIES).toContain(interestRateSpecificRisk);
    expect(SLICE_5_MARKET_RISK_ENTRIES).toContain(equityPositionRisk);
    expect(SLICE_5_MARKET_RISK_ENTRIES).toContain(foreignExchangeRisk);
    expect(SLICE_5_MARKET_RISK_ENTRIES).toContain(commodityRisk);
    expect(SLICE_5_MARKET_RISK_ENTRIES).toContain(marketRiskRwa);
  });
});

// =====================================================================
// 2. Per-entity isolation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 310 per-entity isolation", () => {
  it("BA_310_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_310_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES", () => {
    expect(() =>
      generateBa310MarketRisk({
        ...COMMON,
        entity: ENTITY_SECURITIES,
        irGeneralMaturityLadder: [],
        irSpecificRisk: [],
        equity: [],
        fxPositions: [],
        commodity: [],
      }),
    ).toThrow(Ba310GeneratorError);
  });

  it("rejects an invalid functional currency", () => {
    expect(() =>
      generateBa310MarketRisk({
        ...COMMON,
        functionalCurrency: "ZARS",
        irGeneralMaturityLadder: [],
        irSpecificRisk: [],
        equity: [],
        fxPositions: [],
        commodity: [],
      }),
    ).toThrow(/ISO-4217/);
  });
});

// =====================================================================
// 3. Sub-charge arithmetic.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 310 sub-charge arithmetic", () => {
  it("zero positions ⇒ zero capital + zero RWA", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    expect(out.totalMarketRiskCapitalMinor).toBe(0);
    expect(out.totalMarketRiskRwaMinor).toBe(0);
  });

  it("IR general — sums |long-short| across bands + adds disallowances", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [
        { band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 400 },
        { band: "1-3m", weightedLongMinor: 200, weightedShortMinor: 700 },
      ],
      irGeneralDisallowancesMinor: 50,
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    // |1000-400| + |200-700| + 50 = 600 + 500 + 50 = 1150
    expect(out.interestRateGeneral.capitalMinor).toBe(1150);
    expect(out.interestRateGeneral.maturityLadder).toHaveLength(2);
  });

  it("IR specific — gross × weight per issuer, summed", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [
        { issuerLabel: "RSA-sov", grossPositionMinor: 1_000_000, specificRiskWeight: 0 },
        { issuerLabel: "Corp-AA", grossPositionMinor: 100_000, specificRiskWeight: 0.0025 },
        { issuerLabel: "Corp-HY", grossPositionMinor: 50_000, specificRiskWeight: 0.08 },
      ],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    // 0 + 250 + 4000 = 4250
    expect(out.interestRateSpecific.capitalMinor).toBe(4250);
  });

  it("Equity — 8% net + (4% liquid|8% else) gross", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [
        {
          market: "JSE",
          netLongMinusShortMinor: 100_000,
          grossLongPlusShortMinor: 200_000,
          liquidAndDiversified: true,
        },
        {
          market: "OTC",
          netLongMinusShortMinor: 10_000,
          grossLongPlusShortMinor: 30_000,
          liquidAndDiversified: false,
        },
      ],
      fxPositions: [],
      commodity: [],
    });
    // JSE: 0.08*100000 + 0.04*200000 = 8000 + 8000 = 16000
    // OTC: 0.08*10000 + 0.08*30000  =  800 + 2400 =  3200
    // total 19200
    expect(out.equity.capitalMinor).toBe(19_200);
  });

  it("FX — 8% × max(sum-longs, sum-shorts); functional ccy excluded", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [
        { currency: "ZAR", netPositionFunctionalMinor: 999_999_999 }, // excluded — functional
        { currency: "USD", netPositionFunctionalMinor: 100_000 }, // long 100k
        { currency: "EUR", netPositionFunctionalMinor: 200_000 }, // long 200k
        { currency: "GBP", netPositionFunctionalMinor: -50_000 }, // short 50k
      ],
      commodity: [],
    });
    // sum-longs = 300k, sum-shorts = 50k ⇒ max = 300k ⇒ 8% × 300k = 24k
    expect(out.fx.sumNetLongsMinor).toBe(300_000);
    expect(out.fx.sumNetShortsMinor).toBe(50_000);
    expect(out.fx.capitalMinor).toBe(24_000);
  });

  it("Commodity — 15% × |net| + 3% × gross (simplified method)", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [{ commodity: "gold", netPositionMinor: 100_000, grossPositionMinor: 200_000 }],
    });
    // 0.15*100k + 0.03*200k = 15k + 6k = 21k
    expect(out.commodity.capitalMinor).toBe(21_000);
  });

  it("RWA = 12.5 × total capital", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 0 }],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    expect(out.totalMarketRiskCapitalMinor).toBe(1000);
    expect(out.totalMarketRiskRwaMinor).toBe(12_500);
  });

  it("rejects out-of-range specific-risk weight", () => {
    expect(() =>
      generateBa310MarketRisk({
        ...COMMON,
        irGeneralMaturityLadder: [],
        irSpecificRisk: [{ issuerLabel: "x", grossPositionMinor: 100, specificRiskWeight: 1.5 }],
        equity: [],
        fxPositions: [],
        commodity: [],
      }),
    ).toThrow(/specificRiskWeight/);
  });

  it("rejects negative weighted maturity-band positions", () => {
    expect(() =>
      generateBa310MarketRisk({
        ...COMMON,
        irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: -1, weightedShortMinor: 0 }],
        irSpecificRisk: [],
        equity: [],
        fxPositions: [],
        commodity: [],
      }),
    ).toThrow(/non-negative/);
  });

  it("placeholders array populated per Q1 (rehearsal-grade)", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    expect(out.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(out.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});

// =====================================================================
// 4. XML round-trip + structural validation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 310 XML render round-trip", () => {
  it("renders well-formed XML with declared envelope", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 0 }],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    const payload = ba310ToXmlPayload(out);
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.includes("<BA310")).toBe(true);
    expect(xml.includes(`xmlns="${BA_310_NAMESPACE}"`)).toBe(true);
    expect(xml.includes(`xsdUri="${BA_310_XSD_URI}"`)).toBe(true);
    expect(xml.includes("</BA310>")).toBe(true);
  });

  it("structural validator passes when all required elements present", () => {
    const out = generateBa310MarketRisk({
      ...COMMON,
      irGeneralMaturityLadder: [],
      irSpecificRisk: [],
      equity: [],
      fxPositions: [],
      commodity: [],
    });
    const payload = ba310ToXmlPayload(out);
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const result = validateSarbXmlStructural({
      xml,
      formId: "BA310",
      namespaceUri: BA_310_NAMESPACE,
      requiredElements: [...BA_310_REQUIRED_ELEMENTS],
    });
    expect(result.ok).toBe(true);
  });

  it("XML is byte-identical across runs (determinism)", () => {
    const input = {
      ...COMMON,
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 0 }],
      irSpecificRisk: [
        { issuerLabel: "RSA-sov", grossPositionMinor: 1_000_000, specificRiskWeight: 0 },
      ],
      equity: [],
      fxPositions: [],
      commodity: [],
    };
    const a = renderSarbXml(ba310ToXmlPayload(generateBa310MarketRisk(input)), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    const b = renderSarbXml(ba310ToXmlPayload(generateBa310MarketRisk(input)), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(a).toBe(b);
  });
});
