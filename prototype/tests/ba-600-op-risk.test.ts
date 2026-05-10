// tests/ba-600-op-risk.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — exit-criterion tests
// for BA 600 (operational risk) generator + XML render.
//
// Authors: Bea + Helena + Anya.

import { describe, expect, it } from "bun:test";

import {
  BA_600_BANK_ENTITIES,
  BA_600_NAMESPACE,
  BA_600_REQUIRED_ELEMENTS,
  BA_600_XSD_URI,
  BUSINESS_LINE_BETA,
  Ba600GeneratorError,
  ba600ToXmlPayload,
  generateBa600OpRisk,
  renderSarbXml,
  validateSarbXmlStructural,
} from "../platform/reporting";
import {
  SLICE_5_OP_RISK_ENTRIES,
  SemanticRegistry,
  grossIncomeBusinessLine,
  opRiskCapitalBia,
  opRiskCapitalTsa,
  opRiskRwa,
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

describe("D-REPORTING-CAPABILITY-SLICE-5 — op-risk semantic entries", () => {
  it("the four op-risk entries register without error", () => {
    const reg = SemanticRegistry.from(SLICE_5_OP_RISK_ENTRIES);
    expect(reg.size()).toBe(4);
    expect(reg.resolve({ id: "GrossIncomeBusinessLine" })).toBeDefined();
    expect(reg.resolve({ id: "OpRiskCapitalBia" })).toBeDefined();
    expect(reg.resolve({ id: "OpRiskCapitalTsa" })).toBeDefined();
    expect(reg.resolve({ id: "OpRiskRwa" })).toBeDefined();
  });

  it("each entry carries at least one resolved + one TBC citation per Q1", () => {
    for (const e of SLICE_5_OP_RISK_ENTRIES) {
      const tbc = e.citations.filter((c) => c.type === "tbc").length;
      const resolved = e.citations.filter((c) => c.type !== "tbc").length;
      expect(tbc).toBeGreaterThanOrEqual(1);
      expect(resolved).toBeGreaterThanOrEqual(1);
    }
  });

  it("each entry scopes to Hoz Bank only", () => {
    for (const e of SLICE_5_OP_RISK_ENTRIES) {
      expect(e.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    }
  });

  it("named exports match the array", () => {
    expect(SLICE_5_OP_RISK_ENTRIES).toContain(grossIncomeBusinessLine);
    expect(SLICE_5_OP_RISK_ENTRIES).toContain(opRiskCapitalBia);
    expect(SLICE_5_OP_RISK_ENTRIES).toContain(opRiskCapitalTsa);
    expect(SLICE_5_OP_RISK_ENTRIES).toContain(opRiskRwa);
  });
});

// =====================================================================
// 2. β factors per Reg 33(4) Annex.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — TSA β factors", () => {
  it("18% bands: corporate-finance, trading-and-sales, payment-and-settlement", () => {
    expect(BUSINESS_LINE_BETA["corporate-finance"]).toBe(0.18);
    expect(BUSINESS_LINE_BETA["trading-and-sales"]).toBe(0.18);
    expect(BUSINESS_LINE_BETA["payment-and-settlement"]).toBe(0.18);
  });

  it("15% bands: commercial-banking, agency-services", () => {
    expect(BUSINESS_LINE_BETA["commercial-banking"]).toBe(0.15);
    expect(BUSINESS_LINE_BETA["agency-services"]).toBe(0.15);
  });

  it("12% bands: retail-banking, retail-brokerage, asset-management", () => {
    expect(BUSINESS_LINE_BETA["retail-banking"]).toBe(0.12);
    expect(BUSINESS_LINE_BETA["retail-brokerage"]).toBe(0.12);
    expect(BUSINESS_LINE_BETA["asset-management"]).toBe(0.12);
  });
});

// =====================================================================
// 3. Per-entity isolation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 600 per-entity isolation", () => {
  it("BA_600_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_600_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES", () => {
    expect(() =>
      generateBa600OpRisk({
        ...COMMON,
        entity: ENTITY_SECURITIES,
        grossIncome: [],
        approach: "bia",
      }),
    ).toThrow(Ba600GeneratorError);
  });
});

// =====================================================================
// 4. BIA arithmetic.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 600 BIA arithmetic", () => {
  it("zero years ⇒ zero capital + zero RWA + n=0 placeholder", () => {
    const out = generateBa600OpRisk({ ...COMMON, grossIncome: [], approach: "bia" });
    expect(out.bia?.nPositiveYears).toBe(0);
    expect(out.opRiskCapitalMinor).toBe(0);
    expect(out.opRiskRwaMinor).toBe(0);
    expect(out.placeholders.some((p) => p.includes("0 positive years"))).toBe(true);
  });

  it("3 positive years ⇒ 15% × average; n=3", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
        { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: 2_000_000 },
        { fiscalYear: "2022", businessLine: "trading-and-sales", grossIncomeMinor: 3_000_000 },
      ],
      approach: "bia",
    });
    expect(out.bia?.nPositiveYears).toBe(3);
    expect(out.bia?.averagePositiveMinor).toBe(2_000_000);
    expect(out.bia?.capitalMinor).toBe(300_000); // 15% × 2m
    expect(out.opRiskCapitalMinor).toBe(300_000);
    expect(out.opRiskRwaMinor).toBe(3_750_000); // 12.5×
  });

  it("non-positive years are excluded from average + denominator", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
        { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: -500_000 },
        { fiscalYear: "2022", businessLine: "trading-and-sales", grossIncomeMinor: 3_000_000 },
      ],
      approach: "bia",
    });
    expect(out.bia?.nPositiveYears).toBe(2);
    expect(out.bia?.averagePositiveMinor).toBe(2_000_000);
    expect(out.bia?.capitalMinor).toBe(300_000);
    expect(out.placeholders.some((p) => p.includes("2 positive years"))).toBe(true);
  });

  it("BIA aggregates gross income across business lines per year", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 600_000 },
        { fiscalYear: "2024", businessLine: "retail-banking", grossIncomeMinor: 400_000 },
      ],
      approach: "bia",
    });
    expect(out.bia?.nPositiveYears).toBe(1);
    expect(out.bia?.averagePositiveMinor).toBe(1_000_000);
    expect(out.bia?.capitalMinor).toBe(150_000);
  });
});

// =====================================================================
// 5. TSA arithmetic.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 600 TSA arithmetic", () => {
  it("single trading-and-sales year (β=18%)", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
      ],
      approach: "tsa",
    });
    // year-weighted = 0.18*1m = 180k. Average over 3 (single-year sample) = 180k/3 = 60k.
    expect(out.tsa?.capitalMinor).toBe(60_000);
    expect(out.opRiskCapitalMinor).toBe(60_000);
  });

  it("year with negative weighted sum is floored at zero before averaging", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        // Year 2024 produces a negative aggregate via a single negative line.
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: -1_000_000 },
        // Year 2023 produces 180k weighted.
        { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
      ],
      approach: "tsa",
    });
    // Years floored: 2024 -> 0, 2023 -> 180k. Average over 3 = 180k/3 = 60k.
    expect(out.tsa?.capitalMinor).toBe(60_000);
  });

  it("RWA = 12.5 × selected approach", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
      ],
      approach: "tsa",
    });
    expect(out.opRiskRwaMinor).toBe(12.5 * 60_000);
  });
});

// =====================================================================
// 6. XML round-trip + structural validation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-5 — BA 600 XML round-trip", () => {
  it("renders well-formed XML with declared envelope", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
      ],
      approach: "bia",
    });
    const payload = ba600ToXmlPayload(out);
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.includes("<BA600")).toBe(true);
    expect(xml.includes(`xmlns="${BA_600_NAMESPACE}"`)).toBe(true);
    expect(xml.includes(`xsdUri="${BA_600_XSD_URI}"`)).toBe(true);
    expect(xml.includes("</BA600>")).toBe(true);
  });

  it("structural validator passes when all required elements present", () => {
    const out = generateBa600OpRisk({
      ...COMMON,
      grossIncome: [],
      approach: "bia",
    });
    const payload = ba600ToXmlPayload(out);
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const result = validateSarbXmlStructural({
      xml,
      formId: "BA600",
      namespaceUri: BA_600_NAMESPACE,
      requiredElements: [...BA_600_REQUIRED_ELEMENTS],
    });
    expect(result.ok).toBe(true);
  });

  it("XML is byte-identical across runs (determinism)", () => {
    const input = {
      ...COMMON,
      grossIncome: [
        {
          fiscalYear: "2024",
          businessLine: "trading-and-sales" as const,
          grossIncomeMinor: 1_000_000,
        },
      ],
      approach: "bia" as const,
    };
    const a = renderSarbXml(ba600ToXmlPayload(generateBa600OpRisk(input)), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    const b = renderSarbXml(ba600ToXmlPayload(generateBa600OpRisk(input)), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(a).toBe(b);
  });
});
