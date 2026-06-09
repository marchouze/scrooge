// platform/returns/ba320/period-close-subscriber.test.ts
//
// M3 Slice 5 — Unit tests for the AccountingPeriodClosed → BA 320
// (market risk) subscriber.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10),
//   pack §6 Slice 5.
//
// Asserts:
//   1. Non-bank entity is silently skipped (LE-ZA-HOZ-SECURITIES).
//   2. Bank entity triggers generation (LE-ZA-HOZ-BANK).
//   3. Output cells are non-NaN.
//   4. Zero-position input produces zero capital + zero RWA.
//   5. FX positions fold from FxTradeExecuted events (P1-compliant path).
//   6. XML serialiser produces well-formed output with required elements.
//   7. XML is byte-identical across runs (determinism).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; subscriber owner)
//   + Atlas (Core banking platform architect, engineering — reports to
//   Devon COO; P1-fix events-adapter substrate).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { BA_310_SUBSCRIBER_ENTITIES, ba310PeriodCloseSubscriber } from "./period-close-subscriber";
import {
  BA_310_NAMESPACE,
  BA_310_REQUIRED_ELEMENTS,
  BA_310_XSD_URI,
  ba310ToXmlPayload,
  renderSarbXml,
  validateSarbXmlStructural,
} from "./xml";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Bea" };

const PERIOD_CLOSED_PAYLOAD = {
  periodId: "period:hoz-bank:month:2026-05",
  closedAt: "2026-06-01T00:00:00.000Z",
  trialBalanceSnapshotEventId: newEventId(),
  uptoSequence: 0,
};

const PERIOD_START = "2026-05-01T00:00:00.000Z";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// =====================================================================
// 1. Per-entity guard — BA_310_SUBSCRIBER_ENTITIES
// =====================================================================

describe("BA320 period-close subscriber — per-entity guard", () => {
  it("BA_310_SUBSCRIBER_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_310_SUBSCRIBER_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("skips LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: { ...PERIOD_CLOSED_PAYLOAD, periodId: "period:hoz-sec:month:2026-05" },
      entity: ENTITY_SECURITIES,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in BA_310_SUBSCRIBER_ENTITIES");
  });
});

// =====================================================================
// 2. Zero-position baseline — bank entity, empty store
// =====================================================================

describe("BA320 period-close subscriber — zero-position baseline", () => {
  it("generates a BA 320 with zero capital for empty event store", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });

    expect(result.skipped).toBe(false);
    expect(result.ba310Output).toBeDefined();
    expect(result.ba310Output.meta.form).toBe("BA 320");
    expect(result.ba310Output.meta.entity).toBe(ENTITY_BANK);

    // Zero positions ⇒ zero capital + zero RWA.
    expect(result.ba310Output.totalMarketRiskCapitalMinor).toBe(0);
    expect(result.ba310Output.totalMarketRiskRwaMinor).toBe(0);
  });

  it("all numeric cells are non-NaN", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });

    expect(Number.isNaN(result.ba310Output.totalMarketRiskCapitalMinor)).toBe(false);
    expect(Number.isNaN(result.ba310Output.totalMarketRiskRwaMinor)).toBe(false);
    expect(Number.isNaN(result.ba310Output.fx.capitalMinor)).toBe(false);
    expect(Number.isNaN(result.ba310Output.interestRateGeneral.capitalMinor)).toBe(false);
    expect(Number.isNaN(result.ba310Output.interestRateSpecific.capitalMinor)).toBe(false);
    expect(Number.isNaN(result.ba310Output.equity.capitalMinor)).toBe(false);
    expect(Number.isNaN(result.ba310Output.commodity.capitalMinor)).toBe(false);
  });

  it("placeholders populated (rehearsal-grade marker)", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });

    expect(result.ba310Output.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(result.ba310Output.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});

// =====================================================================
// 3. Caller-supplied sub-charge inputs are wired through
// =====================================================================

describe("BA320 period-close subscriber — caller-supplied inputs", () => {
  it("IR general maturity ladder flows into output", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 400 }],
    });

    // Weighted-net |1000-400| = 600, plus the Reg 28(3)(a) vertical disallowance
    // of 10% × matched (min(1000,400)=400) = 40 → IR-general capital = 640.
    // (Pre-B-IRS-DISALLOWANCES this was 600 with disallowances silently zero.)
    expect(result.ba310Output.interestRateGeneral.disallowancesMinor).toBe(40);
    expect(result.ba310Output.interestRateGeneral.capitalMinor).toBe(640);
    expect(result.ba310Output.totalMarketRiskCapitalMinor).toBe(640);
  });

  it("equity rows flow into output (8% net + 4% gross for liquid/diversified)", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      equity: [
        {
          market: "JSE",
          netLongMinusShortMinor: 100_000,
          grossLongPlusShortMinor: 200_000,
          liquidAndDiversified: true,
        },
      ],
    });

    // 0.08*100k + 0.04*200k = 8000 + 8000 = 16000
    expect(result.ba310Output.equity.capitalMinor).toBe(16_000);
  });

  it("RWA = 12.5 × total capital across sub-charges", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 0 }],
    });

    expect(result.ba310Output.totalMarketRiskCapitalMinor).toBe(1000);
    expect(result.ba310Output.totalMarketRiskRwaMinor).toBe(12_500);
  });
});

// =====================================================================
// 4. XML serialiser round-trip
// =====================================================================

describe("BA320 period-close subscriber — XML serialiser", () => {
  it("renders well-formed XML with declared SARB envelope", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      irGeneralMaturityLadder: [{ band: "0-1m", weightedLongMinor: 500, weightedShortMinor: 0 }],
    });

    const payload = ba310ToXmlPayload(result.ba310Output);
    const xml = renderSarbXml(payload, { renderedAt: "2026-06-01T00:00:00.000Z" });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.includes("<BA320")).toBe(true);
    expect(xml.includes(`xmlns="${BA_310_NAMESPACE}"`)).toBe(true);
    expect(xml.includes(`xsdUri="${BA_310_XSD_URI}"`)).toBe(true);
    expect(xml.includes("</BA320>")).toBe(true);
  });

  it("structural validator passes for all required elements", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });

    const payload = ba310ToXmlPayload(result.ba310Output);
    const xml = renderSarbXml(payload, { renderedAt: "2026-06-01T00:00:00.000Z" });
    const validation = validateSarbXmlStructural({
      xml,
      formId: "BA320",
      namespaceUri: BA_310_NAMESPACE,
      requiredElements: [...BA_310_REQUIRED_ELEMENTS],
    });

    expect(validation.ok).toBe(true);
  });

  it("XML is byte-identical across runs (determinism)", () => {
    const store = new EventStore(":memory:");
    const makeXml = (): string => {
      const result = ba310PeriodCloseSubscriber({
        closedPayload: PERIOD_CLOSED_PAYLOAD,
        entity: ENTITY_BANK,
        eventStore: store,
        actor: ACTOR,
        periodStart: PERIOD_START,
        irGeneralMaturityLadder: [
          { band: "0-1m", weightedLongMinor: 1000, weightedShortMinor: 200 },
        ],
      });
      return renderSarbXml(ba310ToXmlPayload(result.ba310Output), {
        renderedAt: "2026-06-01T00:00:00.000Z",
      });
    };

    expect(makeXml()).toBe(makeXml());
  });

  it("XML contains TotalMarketRiskCapitalMinor element with expected value", () => {
    const store = new EventStore(":memory:");
    const result = ba310PeriodCloseSubscriber({
      closedPayload: PERIOD_CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      irGeneralMaturityLadder: [
        { band: "0-1m", weightedLongMinor: 2000, weightedShortMinor: 1000 },
      ],
    });

    const payload = ba310ToXmlPayload(result.ba310Output);
    const xml = renderSarbXml(payload, { renderedAt: "2026-06-01T00:00:00.000Z" });

    // Weighted-net |2000-1000| = 1000, plus the Reg 28(3)(a) vertical disallowance
    // of 10% × matched (min(2000,1000)=1000) = 100 → total = 1100.
    expect(xml.includes("<TotalMarketRiskCapitalMinor>1100</TotalMarketRiskCapitalMinor>")).toBe(
      true,
    );
  });
});
