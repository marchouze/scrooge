// tests/ba-700-xml-adapter.test.ts
//
// Unit tests for the BA 700 (Capital Adequacy) XML adapter.
//
// Tests:
//   1. ba700ToXmlPayload() — formId is "BA700".
//   2. ba700ToXmlPayload() — formVersion, xsdUri, namespaceUri correctly set.
//   3. ba700ToXmlPayload() — body.Meta contains Form, Entity, PeriodId.
//   4. ba700ToXmlPayload() — body.CapitalStack.Cet1.NetStockMinor maps correctly.
//   5. ba700ToXmlPayload() — body.Rwa.TotalRwaMinor maps correctly.
//   6. ba700ToXmlPayload() — body.Ratios carries CET1 + Tier1 + Total fields.
//   7. ba700ToXmlPayload() — Infinite ratios serialise as "Infinity".
//   8. ba700ToXmlPayload() — LeverageRatio section absent when not supplied.
//   9. renderSarbXml() round-trip — valid XML with BA700 root element.
//  10. validateSarbXmlStructural() — passes for well-formed BA 700 XML.
//  11. validateSarbXmlStructural() — catches missing required elements.
//  12. ba700ToXmlPayload() — trialBalanceSnapshotEventId forwarded when present.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Bea (Accounting & financial reporting engineer, engineering)
//          + Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import type { Ba700Output } from "../platform/reporting/ba-700-capital";
import { generateBa700Capital } from "../platform/reporting/ba-700-capital";
import {
  BA_700_NAMESPACE,
  BA_700_REQUIRED_ELEMENTS,
  BA_700_XSD_URI,
  ba700ToXmlPayload,
} from "../platform/reporting/ba-700-xml-adapter";
import { renderSarbXml, validateSarbXmlStructural } from "../platform/reporting/xml-render";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const FUNCTIONAL_CURRENCY = "ZAR";

/** Minimal BA 700 output using the pure generator (no EventStore required). */
function makeMinimalBa700Output(): Ba700Output {
  return generateBa700Capital({
    entity: ENTITY,
    asOf: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    trialBalance: [
      {
        leafAccountId: "ACC-equity-position-stub",
        currency: "ZAR",
        amountMinor: -100_000_000_00, // credit-side equity (negative = credit per GL convention)
      },
    ],
    classifications: [
      {
        leafAccountId: "ACC-equity-position-stub",
        capitalTier: "cet1",
        subCategory: "cet1.paid-up-ordinary-shares",
      },
    ],
    deductions: [],
    rwa: {
      creditRwaMinor: 1_500_000_000,
      marketRwaMinor: 1_000_000_000,
      operationalRwaMinor: 500_000_000,
      source: "fixture-rehearsal",
    },
  });
}

// Suppress unused import warning — EventStore may be needed for future tests.
const _storeRef = EventStore;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ba700ToXmlPayload()", () => {
  it("TC-1: formId is BA700", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    expect(payload.formId).toBe("BA700");
  });

  it("TC-2: formVersion, xsdUri, namespaceUri are set correctly", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    expect(payload.formVersion).toBe(output.meta.formVersion);
    expect(payload.xsdUri).toBe(BA_700_XSD_URI);
    expect(payload.namespaceUri).toBe(BA_700_NAMESPACE);
  });

  it("TC-3: body.Meta contains Form, Entity, PeriodId", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const meta = payload.body["Meta"] as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect(meta["Form"]).toBe("BA 700");
    expect(meta["Entity"]).toBe(ENTITY);
    expect(meta["PeriodId"]).toBe(PERIOD_ID);
    expect(meta["FunctionalCurrency"]).toBe(FUNCTIONAL_CURRENCY);
  });

  it("TC-4: body.CapitalStack.Cet1.NetStockMinor maps correctly", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const stack = payload.body["CapitalStack"] as Record<string, unknown>;
    const cet1 = stack["Cet1"] as Record<string, unknown>;
    expect(cet1["NetStockMinor"]).toBe(output.capitalStack.cet1.netStockMinor);
    expect(cet1["GrossStockMinor"]).toBe(output.capitalStack.cet1.grossStockMinor);
    expect(cet1["TotalDeductionsMinor"]).toBe(output.capitalStack.cet1.totalDeductionsMinor);
  });

  it("TC-5: body.Rwa.TotalRwaMinor maps correctly", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const rwa = payload.body["Rwa"] as Record<string, unknown>;
    expect(rwa["TotalRwaMinor"]).toBe(output.rwa.totalRwaMinor);
    expect(rwa["CreditRwaMinor"]).toBe(output.rwa.creditRwaMinor);
    expect(rwa["MarketRwaMinor"]).toBe(output.rwa.marketRwaMinor);
    expect(rwa["OperationalRwaMinor"]).toBe(output.rwa.operationalRwaMinor);
  });

  it("TC-6: body.Ratios carries CET1, Tier1, Total compliance fields", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const ratios = payload.body["Ratios"] as Record<string, unknown>;
    expect(ratios).toBeDefined();
    expect(typeof ratios["Cet1Ratio"]).toBe("number");
    expect(typeof ratios["Cet1RatioRequiredMinimum"]).toBe("number");
    expect(typeof ratios["Cet1Compliant"]).toBe("boolean");
    expect(typeof ratios["Tier1Ratio"]).toBe("number");
    expect(typeof ratios["Tier1Compliant"]).toBe("boolean");
    expect(typeof ratios["TotalRatio"]).toBe("number");
    expect(typeof ratios["TotalCompliant"]).toBe("boolean");
  });

  it("TC-7: infinite ratios serialise as the string 'Infinity'", () => {
    // With non-zero capital and zero RWA, ratios would be Infinity.
    const output = generateBa700Capital({
      entity: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      trialBalance: [
        { leafAccountId: "ACC-equity-stub", currency: "ZAR", amountMinor: -50_000_000_00 },
      ],
      classifications: [
        { leafAccountId: "ACC-equity-stub", capitalTier: "cet1" },
      ],
      deductions: [],
      rwa: {
        creditRwaMinor: 0,
        marketRwaMinor: 0,
        operationalRwaMinor: 0,
        source: "fixture-zero",
      },
    });
    const payload = ba700ToXmlPayload(output);
    const ratios = payload.body["Ratios"] as Record<string, unknown>;
    expect(ratios["Cet1Ratio"]).toBe("Infinity");
    expect(ratios["Tier1Ratio"]).toBe("Infinity");
    expect(ratios["TotalRatio"]).toBe("Infinity");
  });

  it("TC-8: LeverageRatio section absent when leverageExposureMeasure not supplied", () => {
    const output = makeMinimalBa700Output();
    // The minimal fixture does not supply leverageExposureMeasure.
    expect(output.leverageRatio).toBeUndefined();
    const payload = ba700ToXmlPayload(output);
    expect(payload.body["LeverageRatio"]).toBeUndefined();
  });

  it("TC-9: trialBalanceSnapshotEventId forwarded when supplied", () => {
    const output = generateBa700Capital({
      entity: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      trialBalance: [],
      classifications: [],
      deductions: [],
      rwa: { creditRwaMinor: 0, marketRwaMinor: 0, operationalRwaMinor: 0 },
      trialBalanceSnapshotEventId: "test-tb-snapshot-id",
    });
    const payload = ba700ToXmlPayload(output);
    const meta = payload.body["Meta"] as Record<string, unknown>;
    expect(meta["TrialBalanceSnapshotEventId"]).toBe("test-tb-snapshot-id");
  });
});

describe("ba700ToXmlPayload() → renderSarbXml() round-trip", () => {
  it("TC-10: produces well-formed XML with BA700 root element", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const xml = renderSarbXml(payload, { renderedAt: AS_OF });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<BA700");
    expect(xml).toContain("</BA700>");
    expect(xml).toContain(`xmlns="${BA_700_NAMESPACE}"`);
  });

  it("TC-11: validateSarbXmlStructural() passes for well-formed BA 700 XML", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const xml = renderSarbXml(payload, { renderedAt: AS_OF });
    const result = validateSarbXmlStructural({
      xml,
      formId: "BA700",
      namespaceUri: BA_700_NAMESPACE,
      requiredElements: BA_700_REQUIRED_ELEMENTS,
    });
    expect(result.ok).toBe(true);
  });

  it("TC-12: validateSarbXmlStructural() catches missing required elements", () => {
    const output = makeMinimalBa700Output();
    const payload = ba700ToXmlPayload(output);
    const xml = renderSarbXml(payload, { renderedAt: AS_OF });
    const result = validateSarbXmlStructural({
      xml,
      formId: "BA700",
      namespaceUri: BA_700_NAMESPACE,
      requiredElements: [...BA_700_REQUIRED_ELEMENTS, "PhantomSection"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.includes("PhantomSection"))).toBe(true);
    }
  });
});
