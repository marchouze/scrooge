// platform/returns/ba600/period-close-subscriber.test.ts
//
// M3 Slice 5 — Unit tests for the AccountingPeriodClosed → BA 600
// (operational risk) subscriber.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10),
//   pack §6 Slice 5.
//
// Asserts:
//   1. Non-bank entity is silently skipped (LE-ZA-HOZ-SECURITIES).
//   2. Bank entity triggers generation (LE-ZA-HOZ-BANK).
//   3. Output cells are non-NaN.
//   4. Zero gross-income input produces zero capital + zero RWA.
//   5. BIA arithmetic: 15% × 3-year average positive gross income.
//   6. Non-positive years excluded from BIA average.
//   7. XML serialiser produces well-formed output with required elements.
//   8. XML is byte-identical across runs (determinism).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; subscriber owner)
//   + Helena (Chief Risk Officer, governance — reports to CEO; op-risk
//   methodology owner — citation).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../../event-store/store";
import {
  BA_600_NAMESPACE,
  BA_600_REQUIRED_ELEMENTS,
  BA_600_XSD_URI,
  ba600ToXmlPayload,
  renderSarbXml,
  validateSarbXmlStructural,
} from "./xml";
import {
  BA_600_SUBSCRIBER_ENTITIES,
  ba600PeriodCloseSubscriber,
} from "./period-close-subscriber";

// Keep a local store reference available for helper functions. Each test
// constructs its own (no cross-test state).
const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Bea" };

const PERIOD_CLOSED_PAYLOAD = {
  periodId: "period:hoz-bank:month:2026-05",
  closedAt: "2026-06-01T00:00:00.000Z",
  trialBalanceSnapshotEventId: "evt-tb-snapshot-test",
  uptoSequence: 0,
};

// EventStore is not used by BA 600 (gross income is caller-supplied), but
// we keep the store instantiation for structural consistency with the
// BA 325 / BA 350 pattern. The subscriber does not take eventStore; the
// store reference is kept for potential future P1-compliant income fold.
// const _store = new EventStore(":memory:");  // BA600 does not use event store (gross income is caller-supplied)

// =====================================================================
// 1. Per-entity guard
// =====================================================================

describe("BA600 period-close subscriber — per-entity guard", () => {
  it("BA_600_SUBSCRIBER_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_600_SUBSCRIBER_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("skips LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: { ...PERIOD_CLOSED_PAYLOAD, periodId: "period:hoz-sec:month:2026-05" },
      entity: ENTITY_SECURITIES,
      actor: ACTOR,
      grossIncome: [],
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in BA_600_SUBSCRIBER_ENTITIES");
  });
});

// =====================================================================
// 2. Zero gross-income baseline
// =====================================================================

describe("BA600 period-close subscriber — zero gross-income baseline", () => {
  it("generates BA 600 with zero capital for zero gross income", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [],
    });

    expect(result.skipped).toBe(false);
    expect(result.ba600Output).toBeDefined();
    expect(result.ba600Output.meta.form).toBe("BA 600");
    expect(result.ba600Output.meta.entity).toBe(ENTITY_BANK);
    expect(result.ba600Output.opRiskCapitalMinor).toBe(0);
    expect(result.ba600Output.opRiskRwaMinor).toBe(0);
  });

  it("all numeric cells are non-NaN", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [],
    });

    expect(Number.isNaN(result.ba600Output.opRiskCapitalMinor)).toBe(false);
    expect(Number.isNaN(result.ba600Output.opRiskRwaMinor)).toBe(false);
    expect(Number.isNaN(result.ba600Output.bia?.capitalMinor ?? 0)).toBe(false);
    expect(Number.isNaN(result.ba600Output.bia?.nPositiveYears ?? 0)).toBe(false);
  });

  it("placeholders populated (rehearsal-grade marker)", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [],
    });

    expect(result.ba600Output.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(result.ba600Output.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});

// =====================================================================
// 3. BIA arithmetic
// =====================================================================

describe("BA600 period-close subscriber — BIA arithmetic", () => {
  it("3 positive years ⇒ 15% × average; RWA = 12.5 × capital", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
        { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: 2_000_000 },
        { fiscalYear: "2022", businessLine: "trading-and-sales", grossIncomeMinor: 3_000_000 },
      ],
      approach: "bia",
    });

    expect(result.ba600Output.bia?.nPositiveYears).toBe(3);
    expect(result.ba600Output.bia?.averagePositiveMinor).toBe(2_000_000);
    expect(result.ba600Output.bia?.capitalMinor).toBe(300_000); // 15% × 2m
    expect(result.ba600Output.opRiskCapitalMinor).toBe(300_000);
    expect(result.ba600Output.opRiskRwaMinor).toBe(3_750_000); // 12.5×
  });

  it("non-positive years excluded from BIA average", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
        { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: -500_000 },
        { fiscalYear: "2022", businessLine: "trading-and-sales", grossIncomeMinor: 3_000_000 },
      ],
      approach: "bia",
    });

    // Only 2024 (1m) and 2022 (3m) are positive. Average = 2m. Capital = 15% × 2m = 300k.
    expect(result.ba600Output.bia?.nPositiveYears).toBe(2);
    expect(result.ba600Output.bia?.averagePositiveMinor).toBe(2_000_000);
    expect(result.ba600Output.bia?.capitalMinor).toBe(300_000);
    expect(
      result.ba600Output.placeholders.some((p) => p.includes("2 positive years")),
    ).toBe(true);
  });

  it("BIA aggregates gross income across business lines per year", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 600_000 },
        { fiscalYear: "2024", businessLine: "retail-banking", grossIncomeMinor: 400_000 },
      ],
      approach: "bia",
    });

    // 600k + 400k = 1m total in 2024. BIA capital = 15% × 1m = 150k.
    expect(result.ba600Output.bia?.averagePositiveMinor).toBe(1_000_000);
    expect(result.ba600Output.bia?.capitalMinor).toBe(150_000);
  });

  it("default approach is BIA when not specified", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
      ],
      // approach not specified — should default to "bia"
    });

    expect(result.ba600Output.meta.approach).toBe("bia");
  });
});

// =====================================================================
// 4. XML serialiser round-trip
// =====================================================================

describe("BA600 period-close subscriber — XML serialiser", () => {
  it("renders well-formed XML with declared SARB envelope", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
      ],
    });

    const payload = ba600ToXmlPayload(result.ba600Output);
    const xml = renderSarbXml(payload, { renderedAt: "2026-06-01T00:00:00.000Z" });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.includes("<BA600")).toBe(true);
    expect(xml.includes(`xmlns="${BA_600_NAMESPACE}"`)).toBe(true);
    expect(xml.includes(`xsdUri="${BA_600_XSD_URI}"`)).toBe(true);
    expect(xml.includes("</BA600>")).toBe(true);
  });

  it("structural validator passes for all required elements", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [],
    });

    const payload = ba600ToXmlPayload(result.ba600Output);
    const xml = renderSarbXml(payload, { renderedAt: "2026-06-01T00:00:00.000Z" });
    const validation = validateSarbXmlStructural({
      xml,
      formId: "BA600",
      namespaceUri: BA_600_NAMESPACE,
      requiredElements: [...BA_600_REQUIRED_ELEMENTS],
    });

    expect(validation.ok).toBe(true);
  });

  it("XML is byte-identical across runs (determinism)", () => {
    const makeXml = (): string => {
      const result = ba600PeriodCloseSubscriber({
        closedPayload: PERIOD_CLOSED_PAYLOAD,
        entity: ENTITY_BANK,
        actor: ACTOR,
        grossIncome: [
          { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
          { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: 2_000_000 },
        ],
      });
      return renderSarbXml(ba600ToXmlPayload(result.ba600Output), {
        renderedAt: "2026-06-01T00:00:00.000Z",
      });
    };

    expect(makeXml()).toBe(makeXml());
  });

  it("XML contains OpRiskCapitalMinor element with expected value", () => {
    const result = ba600PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      actor: ACTOR,
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 1_000_000 },
        { fiscalYear: "2023", businessLine: "trading-and-sales", grossIncomeMinor: 2_000_000 },
        { fiscalYear: "2022", businessLine: "trading-and-sales", grossIncomeMinor: 3_000_000 },
      ],
      approach: "bia",
    });

    const payload = ba600ToXmlPayload(result.ba600Output);
    const xml = renderSarbXml(payload, { renderedAt: "2026-06-01T00:00:00.000Z" });

    // 15% × avg(1m, 2m, 3m) = 15% × 2m = 300k
    expect(xml.includes("<OpRiskCapitalMinor>300000</OpRiskCapitalMinor>")).toBe(true);
  });
});
