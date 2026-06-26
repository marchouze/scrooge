// platform/recon/recon-ba-returns-vs-gl-balances.test.ts
//
// Tests for recon:ba-returns-vs-gl-balances — the GL ↔ BA 700 tier2Capital
// cross-domain reconciliation, NOW ACTIVE because the BA 700 return-of-record
// (`ReportGenerated.ba700Figures.tier2Capital`) is persisted as an event
// (D-BA-RETURN-OF-RECORD-EVENT-FAMILY). Before this family landed the recon's
// BA 700 lookup hard-returned `undefined` and the assertion never fired.
//
// Proves:
//   1. With a persisted ReportGenerated whose tier2Capital MATCHES the GL T2
//      fold, the recon asserts (asserted=1) and finds NOTHING (within tolerance).
//   2. With a persisted ReportGenerated whose tier2Capital DIVERGES from the GL
//      T2 fold beyond tolerance, the recon FIRES A FINDING (fail-closed) — proof
//      the assertion is real, not vacuous.
//   3. With NO ReportGenerated for the period, the recon records a non-blocking
//      substrate-gap note (0 findings).
//
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../accounting/period-close";
import { newEventId } from "../core/types";
import { makeReportGenerated } from "../event-store/event-types/return-of-record";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import { run } from "./recon-ba-returns-vs-gl-balances";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const CLOSED_AT = "2026-06-01T00:00:00.000Z";
const ACTOR: Actor = { type: "service", id: "agent:Bea" };
const CITES = ["D-BA-RETURN-OF-RECORD-EVENT-FAMILY", "D-DATA-QUALITY-CROSS-DOMAIN-V1"];

// R5,000,000 of qualifying Tier 2 (general provisions, ACC-5200-002) — minor
// units 500_000_000; decimal-native major units "5000000".
const T2_MINOR = 500_000_000;
const T2_MAJOR = "5000000";

/** Open + post a balanced T2 credit + close a period on the bank entity. */
function seedClosedPeriodWithT2(store: EventStore): void {
  openPeriod({
    eventStore: store,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: {
      periodId: PERIOD_ID,
      periodKind: "month",
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-05-31T23:59:59.999Z",
      openedAt: "2026-05-01T00:00:00.000Z",
      functionalCurrency: "ZAR",
    },
  });

  // Balanced posting: cash debit + Tier 2 general-provisions credit
  // (ACC-5200-002 per coaToCapitalClassifications() T2 set).
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: "2026-05-10T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: [
        {
          accountId: "ACC-1100-001",
          debitCredit: "debit",
          currency: "ZAR",
          amountMinor: T2_MINOR,
          memo: "test T2 provision — cash leg",
        },
        {
          accountId: "ACC-5200-002",
          debitCredit: "credit",
          currency: "ZAR",
          amountMinor: T2_MINOR,
          memo: "test T2 provision — qualifying general provisions",
        },
      ],
      asOfDate: "2026-05-10T00:00:00.000Z",
      citations: CITES,
    },
  });

  closePeriod({
    eventStore: store,
    entity: ENTITY,
    periodId: PERIOD_ID,
    closedAt: CLOSED_AT,
    actor: ACTOR,
    citations: CITES,
  });
}

/** Persist a BA 700 return-of-record with a given tier2Capital major-unit string. */
function seedReportGenerated(store: EventStore, tier2Major: string): void {
  store.append(
    makeReportGenerated({
      asOf: CLOSED_AT,
      entity: ENTITY,
      actor: { type: "service", id: "bea:ba700-period-close" },
      citations: CITES,
      payload: {
        entity: ENTITY,
        formId: "BA700",
        formVersion: "v0.1-rehearsal",
        reportingPeriod: PERIOD_ID,
        generatedAt: CLOSED_AT,
        functionalCurrency: "ZAR",
        ba700Figures: {
          cet1Capital: { currency: "ZAR", amount: "0" },
          at1Capital: { currency: "ZAR", amount: "0" },
          tier2Capital: { currency: "ZAR", amount: tier2Major },
          totalRwa: { currency: "ZAR", amount: "20000000" },
          cet1Ratio: "0",
          tier1Ratio: "0",
          totalRatio: "0.25",
        },
        contentHash: `blake3:${"0".repeat(64)}`,
        sourceEventIds: [],
        citations: CITES,
      },
    }),
  );
}

describe("recon:ba-returns-vs-gl-balances — GL ↔ BA 700 tier2 (now active)", () => {
  it("asserts and PASSES when the persisted BA 700 tier2 matches the GL T2 fold", () => {
    const store = new EventStore(":memory:");
    seedClosedPeriodWithT2(store);
    seedReportGenerated(store, T2_MAJOR); // matches GL fold

    const result = run(store);

    expect(result.assertedCount).toBe(1);
    expect(result.substrateGapCount).toBe(0);
    expect(result.findings).toBe(0);
    const r = result.periodResults[0];
    expect(r?.glTier2Minor).toBe(T2_MINOR);
    expect(r?.ba700Tier2Minor).toBe(T2_MINOR);
    expect(r?.withinTolerance).toBe(true);
  });

  it("FIRES A FINDING when the persisted BA 700 tier2 diverges from the GL T2 fold (fail-closed)", () => {
    const store = new EventStore(":memory:");
    seedClosedPeriodWithT2(store);
    // BA 700 attests R4,000,000 of T2 but the GL fold is R5,000,000 — a R1m gap
    // far beyond the 1-cent tolerance.
    seedReportGenerated(store, "4000000");

    const result = run(store);

    expect(result.assertedCount).toBe(1);
    expect(result.findings).toBe(1);
    const r = result.periodResults[0];
    expect(r?.glTier2Minor).toBe(T2_MINOR);
    expect(r?.ba700Tier2Minor).toBe(400_000_000);
    expect(r?.deltaMinor).toBe(100_000_000);
    expect(r?.withinTolerance).toBe(false);
  });

  it("records a non-blocking substrate-gap note when NO ReportGenerated exists for the period", () => {
    const store = new EventStore(":memory:");
    seedClosedPeriodWithT2(store);
    // No ReportGenerated seeded.

    const result = run(store);

    expect(result.substrateGapCount).toBe(1);
    expect(result.findings).toBe(0);
    expect(result.periodResults[0]?.substrateGapNote).toBeDefined();
  });
});
