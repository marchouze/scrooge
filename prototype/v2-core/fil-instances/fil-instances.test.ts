// v2-core/fil-instances/fil-instances.test.ts
//
// Unit tests for the FIL instance lifecycle event family + projection. Pure,
// no v1 dependency (the package is self-contained by construction).
//
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";
import { formatInstanceUrn, formatTypeUrn } from "../fil-core/urn";
import {
  type FilEconomicTerms,
  type FilInstanceLifecycleEvent,
  filInstanceLifecycleEventSchema,
  filInstrumentCreatedPayloadSchema,
} from "./events";
import { foldFilInstances, isLiveStage, liveInstances, remainingYears } from "./projection";

const TENANT = "LE-ZA-HOZ-BANK";
const FX_TYPE = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const INST = formatInstanceUrn({ tenant: TENANT, instanceId: "MAN-ABC-001" });

const TERMS: FilEconomicTerms = {
  assetClass: "fx",
  notional: { currency: "ZAR", amount: "86792786.03" },
  direction: "short",
  counterpartyId: "urn:party:legal-entity:investec-bank-za",
  nettingSetId: "NS-urn:party:legal-entity:investec-bank-za-ZAR",
  currency: "ZAR",
  settlementDate: "2026-06-12",
  hedgingSetTag: "EUR/ZAR",
};

function created(asOf: string): FilInstanceLifecycleEvent {
  return filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance: INST,
    type: FX_TYPE,
    tenant: TENANT,
    asOf,
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "ev-1" },
    initialStage: "active",
    economicTerms: TERMS,
  });
}

function terminated(asOf: string): FilInstanceLifecycleEvent {
  return filInstanceLifecycleEventSchema.parse({
    kind: "FilInstrumentTerminated",
    instance: INST,
    type: FX_TYPE,
    tenant: TENANT,
    asOf,
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "ev-1" },
    terminalStage: "settled",
  });
}

describe("FIL instance event family", () => {
  it("parses a created event and rejects a non-instance URN", () => {
    expect(() => created("2026-06-10T10:24:09.881Z")).not.toThrow();
    expect(() =>
      filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance: "not-a-urn",
        type: FX_TYPE,
        tenant: TENANT,
        asOf: "2026-06-10T10:24:09.881Z",
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "ev-1" },
        initialStage: "active",
        economicTerms: TERMS,
      }),
    ).toThrow();
  });
});

describe("FIL instance projection", () => {
  const events = [created("2026-06-10T10:24:09.881Z"), terminated("2026-06-12T00:00:00.000Z")];

  it("folds to terminal stage at latest", () => {
    const reg = foldFilInstances(events);
    expect(reg.get(INST)?.stage).toBe("settled");
    expect(liveInstances(reg)).toHaveLength(0);
  });

  it("as-of fold reconstructs the historical live set (created before, terminated after)", () => {
    const reg = foldFilInstances(events, "2026-06-11T17:00:00.000Z");
    const row = reg.get(INST);
    expect(row?.stage).toBe("active");
    expect(isLiveStage(row?.stage ?? "settled")).toBe(true);
    expect(liveInstances(reg)).toHaveLength(1);
    // economic terms carried through
    expect(row?.economicTerms.nettingSetId).toBe(TERMS.nettingSetId);
    expect(row?.economicTerms.notional.amount).toBe("86792786.03");
  });

  it("derives remaining-years from settlement date at as_of (>0 before settlement, 0 after)", () => {
    expect(remainingYears("2026-06-12", "2026-06-11T17:00:00.000Z")).toBeGreaterThan(0);
    expect(remainingYears("2026-06-12", "2026-06-13T00:00:00.000Z")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FX agreement quad (D-FX-INSTRUMENT-BUYSELL-QUAD) — the .superRefine drops the
// required-field z.infer, so coherence is swept by TESTS, not tsc (per the brief).
// ---------------------------------------------------------------------------

describe("fxAgreement coherence (D-FX-INSTRUMENT-BUYSELL-QUAD)", () => {
  // A long USD vs ZAR position whose instrument currency is the BASE (USD).
  const longUsdBase = {
    assetClass: "fx" as const,
    notional: { currency: "USD", amount: "1000.00" },
    direction: "long" as const,
    counterpartyId: "CP1",
    nettingSetId: "NS-CP1-USD",
    currency: "USD",
    settlementDate: "2026-06-03",
    hedgingSetTag: "USD/ZAR",
  };

  it("optional — terms WITHOUT a quad parse unchanged (replay-safe)", () => {
    expect(() => filInstrumentCreatedPayloadSchema.parse(createdWith(longUsdBase))).not.toThrow();
  });

  it("accepts a coherent quad — long bought base, notional = bought-leg magnitude", () => {
    expect(() =>
      filInstrumentCreatedPayloadSchema.parse(
        createdWith({
          ...longUsdBase,
          fxAgreement: {
            buy: { currency: "USD", amount: "1000.00" },
            sell: { currency: "ZAR", amount: "18520.00" },
          },
        }),
      ),
    ).not.toThrow();
  });

  it("accepts a coherent quad on the ZAR-denominated leg (short bought quote)", () => {
    // short EUR/ZAR: bought ZAR (the quote), sold EUR. Instrument ccy = ZAR (buy leg).
    expect(() =>
      filInstanceLifecycleEventSchema.parse(
        createdWith({
          ...TERMS,
          fxAgreement: {
            buy: { currency: "ZAR", amount: "86792786.03" },
            sell: { currency: "EUR", amount: "4300000.00" },
          },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects an incoherent NOTIONAL (notional != the instrument-ccy quad leg)", () => {
    expect(() =>
      filInstrumentCreatedPayloadSchema.parse(
        createdWith({
          ...longUsdBase,
          notional: { currency: "USD", amount: "9999.00" },
          fxAgreement: {
            buy: { currency: "USD", amount: "1000.00" },
            sell: { currency: "ZAR", amount: "18520.00" },
          },
        }),
      ),
    ).toThrow(/notional/);
  });

  it("rejects an incoherent DIRECTION (long but bought the quote, not the base)", () => {
    expect(() =>
      filInstrumentCreatedPayloadSchema.parse(
        createdWith({
          ...longUsdBase,
          // direction long but buy leg is ZAR (the quote) — disagrees with bought side.
          notional: { currency: "USD", amount: "1000.00" },
          fxAgreement: {
            buy: { currency: "ZAR", amount: "18520.00" },
            sell: { currency: "USD", amount: "1000.00" },
          },
        }),
      ),
    ).toThrow(/direction/);
  });

  it("rejects a quad whose currencies are not the pair (hedgingSetTag mismatch)", () => {
    expect(() =>
      filInstrumentCreatedPayloadSchema.parse(
        createdWith({
          ...longUsdBase,
          fxAgreement: {
            buy: { currency: "USD", amount: "1000.00" },
            sell: { currency: "GBP", amount: "780.00" },
          },
        }),
      ),
    ).toThrow(/hedgingSetTag|currencies/);
  });

  it("rejects a degenerate same-currency quad", () => {
    expect(() =>
      filInstrumentCreatedPayloadSchema.parse(
        createdWith({
          ...longUsdBase,
          fxAgreement: {
            buy: { currency: "USD", amount: "1000.00" },
            sell: { currency: "USD", amount: "1000.00" },
          },
        }),
      ),
    ).toThrow(/DIFFERENT currencies/);
  });
});

function createdWith(economicTerms: unknown): unknown {
  return {
    kind: "FilInstrumentCreated",
    instance: INST,
    type: FX_TYPE,
    tenant: TENANT,
    asOf: "2026-06-01T00:00:00.000Z",
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "ev-quad" },
    initialStage: "active",
    economicTerms,
  };
}
