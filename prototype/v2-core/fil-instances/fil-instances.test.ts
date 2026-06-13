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
  notional: { currency: "ZAR", minorUnits: 8679278603n },
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
    expect(row?.economicTerms.notional.minorUnits).toBe(8679278603n);
  });

  it("derives remaining-years from settlement date at as_of (>0 before settlement, 0 after)", () => {
    expect(remainingYears("2026-06-12", "2026-06-11T17:00:00.000Z")).toBeGreaterThan(0);
    expect(remainingYears("2026-06-12", "2026-06-13T00:00:00.000Z")).toBe(0);
  });
});
