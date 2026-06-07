// tests/sarb-prudential.test.ts
//
// Unit tests for the local SARB prudential portal simulator.
//
// Tests:
//   1. submitToSarbPortal() — accepts a valid BA 110 payload and returns ok: true.
//   2. submitToSarbPortal() — generates a referenceNumber on success.
//   3. submitToSarbPortal() — emits a SarbSubmissionAttempted event to the store (success).
//   4. submitToSarbPortal() — rejects a payload with missing formId.
//   5. submitToSarbPortal() — rejects a payload with malformed PeriodId.
//   6. submitToSarbPortal() — rejects a payload with missing Meta.
//   7. submitToSarbPortal() — emits a SarbSubmissionAttempted event on failure.
//   8. submitToSarbPortal() — mode field in emitted event is "simulator".
//   9. submitToSarbPortal() — accepts a valid BA 100 payload.
//  10. submitToSarbPortal() — rejects payload with empty namespaceUri.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Mira (Compliance / RegTech engineer, engineering)
//          + Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { generateBa100Capital } from "../platform/reporting/ba-100-capital";
import { ba100ToXmlPayload } from "../platform/reporting/ba-100-xml-adapter";
import { generateBa110Lcr } from "../platform/reporting/ba-110-lcr";
import { ba110ToXmlPayload } from "../platform/reporting/ba-110-xml-adapter";
import type { SarbXmlReportPayload } from "../platform/reporting/xml-render";
import { submitToSarbPortal } from "../simulators/sarb-prudential";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const FUNCTIONAL_CURRENCY = "ZAR";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function makeValidBa110Payload(): SarbXmlReportPayload {
  const store = makeStore();
  const output = generateBa110Lcr({
    entity: ENTITY,
    asOf: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    eventStore: store,
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
  return ba110ToXmlPayload(output);
}

function makeValidBa100Payload(): SarbXmlReportPayload {
  const output = generateBa100Capital({
    entity: ENTITY,
    asOf: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    trialBalance: [{ leafAccountId: "ACC-eq-stub", currency: "ZAR", amountMinor: -50_000_000_00 }],
    classifications: [
      { leafAccountId: "ACC-eq-stub", capitalTier: "cet1", subCategory: "cet1.paid-up-shares" },
    ],
    deductions: [],
    rwa: {
      creditRwaMinor: 1_000_000_000,
      marketRwaMinor: 500_000_000,
      operationalRwaMinor: 250_000_000,
      source: "fixture-rehearsal",
    },
  });
  return ba100ToXmlPayload(output);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("submitToSarbPortal() — valid payloads", () => {
  it("TC-1: returns ok:true for a valid BA 110 payload", async () => {
    const store = makeStore();
    const payload = makeValidBa110Payload();
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(true);
  });

  it("TC-2: generates a referenceNumber on success", async () => {
    const store = makeStore();
    const payload = makeValidBa110Payload();
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(true);
    expect(typeof result.referenceNumber).toBe("string");
    expect(result.referenceNumber?.startsWith("SARB-")).toBe(true);
  });

  it("TC-3: emits a SarbSubmissionAttempted event (success) to the store", async () => {
    const store = makeStore();
    const payload = makeValidBa110Payload();
    await submitToSarbPortal(payload, store);

    const events = [...store.replay({ type: "SarbSubmissionAttempted" })];
    expect(events.length).toBe(1);
    const evt = events[0];
    expect(evt).toBeDefined();
    if (evt) {
      const p = evt.payload as Record<string, unknown>;
      expect(p.accepted).toBe(true);
      expect(p.formId).toBe("BA325");
    }
  });

  it("TC-9: accepts a valid BA 100 payload", async () => {
    const store = makeStore();
    const payload = makeValidBa100Payload();
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(true);
    expect(result.referenceNumber?.startsWith("SARB-")).toBe(true);
  });
});

describe("submitToSarbPortal() — invalid payloads", () => {
  it("TC-4: rejects a payload with missing/invalid formId", async () => {
    const store = makeStore();
    // Use an invalid formId that doesn't match /^BA\d+$/.
    const payload: SarbXmlReportPayload = {
      formId: "INVALID-FORM",
      formVersion: "v0.1-rehearsal",
      xsdUri: "https://hoz.bank/xsd/invalid.xsd",
      namespaceUri: "https://hoz.bank/ns/invalid",
      body: {
        Meta: {
          Entity: ENTITY,
          PeriodId: PERIOD_ID,
        },
      },
    };
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.includes("formId"))).toBe(true);
  });

  it("TC-5: rejects a payload with malformed PeriodId", async () => {
    const store = makeStore();
    const payload: SarbXmlReportPayload = {
      formId: "BA325",
      formVersion: "v0.1-rehearsal",
      xsdUri: "https://hoz.bank/xsd/ba-110.xsd",
      namespaceUri: "https://hoz.bank/ns/ba-110",
      body: {
        Meta: {
          Entity: ENTITY,
          PeriodId: "bad-period-id",
        },
      },
    };
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.includes("PeriodId"))).toBe(true);
  });

  it("TC-6: rejects a payload with missing Meta", async () => {
    const store = makeStore();
    const payload: SarbXmlReportPayload = {
      formId: "BA325",
      formVersion: "v0.1-rehearsal",
      xsdUri: "https://hoz.bank/xsd/ba-110.xsd",
      namespaceUri: "https://hoz.bank/ns/ba-110",
      body: {
        // Deliberately no Meta.
        SomeOtherSection: { foo: "bar" },
      },
    };
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.toLowerCase().includes("meta"))).toBe(true);
  });

  it("TC-7: emits a SarbSubmissionAttempted event (failure) to the store", async () => {
    const store = makeStore();
    const payload: SarbXmlReportPayload = {
      formId: "NOT-A-BA-FORM",
      formVersion: "v0",
      xsdUri: "",
      namespaceUri: "",
      body: { Meta: { Entity: ENTITY, PeriodId: PERIOD_ID } },
    };
    await submitToSarbPortal(payload, store);

    const events = [...store.replay({ type: "SarbSubmissionAttempted" })];
    expect(events.length).toBe(1);
    const evt = events[0];
    if (evt) {
      const p = evt.payload as Record<string, unknown>;
      expect(p.accepted).toBe(false);
      expect(Array.isArray(p.errors)).toBe(true);
    }
  });

  it("TC-8: mode field in emitted event is 'simulator'", async () => {
    const store = makeStore();
    const payload = makeValidBa110Payload();
    await submitToSarbPortal(payload, store);

    const events = [...store.replay({ type: "SarbSubmissionAttempted" })];
    const evt = events[0];
    if (evt) {
      const p = evt.payload as Record<string, unknown>;
      expect(p.mode).toBe("simulator");
    }
  });

  it("TC-10: rejects payload with empty namespaceUri", async () => {
    const store = makeStore();
    const payload: SarbXmlReportPayload = {
      formId: "BA325",
      formVersion: "v0.1-rehearsal",
      xsdUri: "https://hoz.bank/xsd/ba-110.xsd",
      namespaceUri: "", // empty
      body: {
        Meta: {
          Entity: ENTITY,
          PeriodId: PERIOD_ID,
        },
      },
    };
    const result = await submitToSarbPortal(payload, store);
    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.includes("namespaceUri"))).toBe(true);
  });
});
