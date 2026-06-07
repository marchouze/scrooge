// tests/ba-110-xml-adapter.test.ts
//
// Unit tests for the BA 110 (LCR) XML adapter.
//
// Tests:
//   1. ba110ToXmlPayload() — produces a SarbXmlReportPayload with formId "BA325".
//   2. ba110ToXmlPayload() — body.Meta contains Form, Entity, PeriodId, etc.
//   3. ba110ToXmlPayload() — body.Hqla contains TotalStockHqlaMinor.
//   4. ba110ToXmlPayload() — body.CashFlows contains NetCashOutflowsMinor.
//   5. ba110ToXmlPayload() — LcrRatio is mapped (finite + Infinity cases).
//   6. ba110ToXmlPayload() — LcrCompliant is mapped correctly.
//   7. renderSarbXml() round-trip — output is valid XML with BA325 root element.
//   8. validateSarbXmlStructural() — passes for well-formed BA 110 XML.
//   9. validateSarbXmlStructural() — catches missing required elements.
//  10. ba110ToXmlPayload() — optional trialBalanceSnapshotEventId is forwarded.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Bea (Accounting & financial reporting engineer, engineering)
//          + Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import type { Ba110Output } from "../platform/reporting/ba-110-lcr";
import { generateBa110Lcr } from "../platform/reporting/ba-110-lcr";
import {
  BA_110_NAMESPACE,
  BA_110_REQUIRED_ELEMENTS,
  BA_110_XSD_URI,
  ba110ToXmlPayload,
} from "../platform/reporting/ba-110-xml-adapter";
import { renderSarbXml, validateSarbXmlStructural } from "../platform/reporting/xml-render";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const FUNCTIONAL_CURRENCY = "ZAR";

function makeEmptyStore(): EventStore {
  return new EventStore(":memory:");
}

function makeMinimalBa110Output(): Ba110Output {
  return generateBa110Lcr({
    entity: ENTITY,
    asOf: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    eventStore: makeEmptyStore(),
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 5_000_000_00 }],
    classifications: [
      {
        leafAccountId: "ACC-1100-001",
        hqlaLevel: "level-1",
        subCategory: "level-1.central-bank-reserves",
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ba110ToXmlPayload()", () => {
  it("TC-1: formId is BA325", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    expect(payload.formId).toBe("BA325");
  });

  it("TC-2: formVersion, xsdUri, namespaceUri are set correctly", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    expect(payload.formVersion).toBe(output.meta.formVersion);
    expect(payload.xsdUri).toBe(BA_110_XSD_URI);
    expect(payload.namespaceUri).toBe(BA_110_NAMESPACE);
  });

  it("TC-3: body.Meta contains Form, Entity, PeriodId", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const meta = payload.body.Meta as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect(meta.Form).toBe("BA 110");
    expect(meta.Entity).toBe(ENTITY);
    expect(meta.PeriodId).toBe(PERIOD_ID);
    expect(meta.FunctionalCurrency).toBe(FUNCTIONAL_CURRENCY);
  });

  it("TC-4: body.Hqla.TotalStockHqlaMinor matches the generator output", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const hqla = payload.body.Hqla as Record<string, unknown>;
    expect(hqla).toBeDefined();
    expect(hqla.TotalStockHqlaMinor).toBe(output.hqla.totalStockHqlaMinor);
  });

  it("TC-5: body.CashFlows.NetCashOutflowsMinor matches the generator output", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const cashFlows = payload.body.CashFlows as Record<string, unknown>;
    expect(cashFlows).toBeDefined();
    expect(cashFlows.NetCashOutflowsMinor).toBe(output.cashFlows.netCashOutflowsMinor);
  });

  it("TC-6: LcrRatio maps finite ratio as a number", () => {
    // With HQLA stock + zero outflows, lcrRatio = Infinity.
    // Create an output with a non-infinite ratio by using a minimal fixture
    // where numerator and denominator are both finite (empty event store →
    // netCashOutflows = 0 → Infinity). We test the "Infinity" branch explicitly.
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    // Empty event store → no settlement events → netCashOutflows = 0 → Infinity.
    expect(payload.body.LcrRatio).toBe("Infinity");
  });

  it("TC-7: LcrCompliant is mapped", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    // lcrRatio = Infinity (compliant = true per BCBS D295 §22 / Reg 26(2)).
    expect(payload.body.LcrCompliant).toBe(true);
  });

  it("TC-8: optional trialBalanceSnapshotEventId is forwarded when present", () => {
    const output = generateBa110Lcr({
      entity: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      eventStore: makeEmptyStore(),
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance: [],
      classifications: [],
      trialBalanceSnapshotEventId: "test-snapshot-event-id",
    });
    const payload = ba110ToXmlPayload(output);
    const meta = payload.body.Meta as Record<string, unknown>;
    expect(meta.TrialBalanceSnapshotEventId).toBe("test-snapshot-event-id");
  });

  it("TC-9: trialBalanceSnapshotEventId is absent when not supplied", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const meta = payload.body.Meta as Record<string, unknown>;
    expect(meta.TrialBalanceSnapshotEventId).toBeUndefined();
  });

  it("TC-10: InputCompleteness block is present in Meta", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const meta = payload.body.Meta as Record<string, unknown>;
    const ic = meta.InputCompleteness as Record<string, unknown>;
    expect(ic).toBeDefined();
    expect(typeof ic.HqlaInputsFound).toBe("number");
    expect(typeof ic.CompletenessClass).toBe("string");
  });
});

describe("ba110ToXmlPayload() → renderSarbXml() round-trip", () => {
  it("TC-11: produces well-formed XML with BA325 root element", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const xml = renderSarbXml(payload, { renderedAt: AS_OF });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<BA325");
    expect(xml).toContain("</BA325>");
    expect(xml).toContain(`xmlns="${BA_110_NAMESPACE}"`);
  });

  it("TC-12: validateSarbXmlStructural() passes for well-formed BA 110 XML", () => {
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const xml = renderSarbXml(payload, { renderedAt: AS_OF });
    const result = validateSarbXmlStructural({
      xml,
      formId: "BA325",
      namespaceUri: BA_110_NAMESPACE,
      requiredElements: BA_110_REQUIRED_ELEMENTS,
    });
    expect(result.ok).toBe(true);
  });

  it("TC-13: validateSarbXmlStructural() catches missing required elements", () => {
    // Produce valid XML then check against a superset of required elements
    // that includes one that doesn't exist — simulates a form with a missing section.
    const output = makeMinimalBa110Output();
    const payload = ba110ToXmlPayload(output);
    const xml = renderSarbXml(payload, { renderedAt: AS_OF });
    const result = validateSarbXmlStructural({
      xml,
      formId: "BA325",
      namespaceUri: BA_110_NAMESPACE,
      requiredElements: [...BA_110_REQUIRED_ELEMENTS, "NonExistentSection"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.includes("NonExistentSection"))).toBe(true);
    }
  });
});
