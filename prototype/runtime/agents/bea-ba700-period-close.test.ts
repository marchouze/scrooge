// runtime/agents/bea-ba700-period-close.test.ts
//
// Unit tests for the BA 700 (Capital Adequacy) period-close runtime wiring
// (WS-RETURNS-SUBMISSION-WIRING Wave B).
//
// Asserts:
//   1. GOLDEN PATH — a closed bank period with seeded capital postings and an
//      RwaComputed event of record generates the BA 700 return and records a
//      SarbSubmissionAttempted{formId:"BA700"} submission (mode "simulator"),
//      with the RwaComputed event_id threaded for chain-of-custody and the
//      operational-RWA component an explicit named zero (GAP-RETURNS-BA700-
//      OPERATIONAL-RWA — the correct BIA value pre-commencement, so total RWA
//      equals credit + market exactly).
//   2. Without an RwaComputed event of record, the generation still succeeds
//      via the disclosed fallback path (Rwa.Source label, no event id).
//   3. Idempotency — re-running the same closed period does NOT emit a second
//      BA 700 submission.
//   4. A non-bank entity is silently skipped.
//
// Raw EventStore(":memory:") is a build-phase test fixture (permission-gate
// carve-out).
//
// Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-RWA-ENGINE-W2-SLICE-3;
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
// Brief: brief:mira:returns-submission-wiring-wave-b-wire-remaining-:2026-06-10.
// Author: Mira (Compliance / RegTech engineer, engineering) on Bea's
//   (Accounting & financial reporting engineer, engineering) return surface.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../../platform/accounting/period-close";
import { newEventId } from "../../platform/core/types";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import { makeRwaComputed } from "../../platform/event-store/event-types/regulatory-reporting";
import { EventStore } from "../../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../../platform/projections/filter";
import { ba700SubmissionExists, generateAndRecordBa700ForPeriod } from "./bea-ba700-period-close";

// Provenance override — test events are untagged (simulated).
beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const CLOSED_AT = "2026-06-01T00:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-RETURNS-SUBMISSION-WIRING-WORKSTREAM", "D-RWA-ENGINE-W2-SLICE-3"];

const CREDIT_RWA_MINOR = 1_500_000_000;
const MARKET_RWA_MINOR = 500_000_000;

/** Open + populate + close a period on the bank entity. */
function seedClosedPeriod(store: EventStore): AccountingPeriodClosedPayload {
  openPeriod({
    eventStore: store,
    entity: ENTITY_BANK,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      periodId: PERIOD_ID,
      periodKind: "month",
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-05-31T23:59:59.999Z",
      openedAt: "2026-05-01T00:00:00.000Z",
      functionalCurrency: "ZAR",
    },
  });

  // Capital injection: R2.5m paid-up shares into a CET1-classified account
  // (ACC-5000-001 Share Capital per coaToCapitalClassifications()).
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: "2026-05-02T00:00:00.000Z",
    entity: ENTITY_BANK,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      // Leg shape per the BA 700 events-adapter capital fold:
      // { accountId, debitCredit, amountMinor, currency }. Balanced pair —
      // cash debit, CET1 share-capital credit (ACC-5000-001 per
      // coaToCapitalClassifications()).
      legs: [
        {
          accountId: "ACC-1100-001",
          debitCredit: "debit",
          currency: "ZAR",
          amountMinor: 250_000_000,
          memo: "test capital injection — cash leg",
        },
        {
          accountId: "ACC-5000-001",
          debitCredit: "credit",
          currency: "ZAR",
          amountMinor: 250_000_000,
          memo: "test capital injection — share-capital leg",
        },
      ],
      asOfDate: "2026-05-02T00:00:00.000Z",
      citations: CITATIONS,
    },
  });

  closePeriod({
    eventStore: store,
    entity: ENTITY_BANK,
    periodId: PERIOD_ID,
    closedAt: CLOSED_AT,
    actor: ACTOR,
    citations: CITATIONS,
  });

  // Recover the canonical AccountingPeriodClosed payload from the store.
  for (const ev of store.replay({ entity: ENTITY_BANK, type: "AccountingPeriodClosed" })) {
    const p = ev.payload as AccountingPeriodClosedPayload;
    if (p.periodId === PERIOD_ID) return p;
  }
  throw new Error("closePeriod did not append AccountingPeriodClosed");
}

/**
 * Seed the RwaComputed event of record for the period (the W2 Slice 3 engine
 * shape — credit + market event-sourced; operational an explicit named zero,
 * gross-income-blocked pre-licence: GAP-RETURNS-BA700-OPERATIONAL-RWA).
 */
function seedRwaComputed(store: EventStore): string {
  const event = makeRwaComputed({
    asOf: CLOSED_AT,
    entity: ENTITY_BANK,
    actor: { type: "service", id: "agent:bea:rwa-period-close" },
    citations: CITATIONS,
    payload: {
      entityId: ENTITY_BANK,
      asOf: CLOSED_AT,
      periodId: PERIOD_ID,
      functionalCurrency: "ZAR",
      creditRwaMinor: CREDIT_RWA_MINOR,
      marketRwaMinor: MARKET_RWA_MINOR,
      operationalRwaMinor: 0,
      totalRwaMinor: CREDIT_RWA_MINOR + MARKET_RWA_MINOR,
      source: "credit+market-event-sourced;op-placeholder-gross-income-blocked",
      operationalRwaIsPlaceholder: true,
      sourceEventIds: [],
      creditExposureCount: 2,
      citations: CITATIONS,
    },
  });
  store.append(event);
  return event.event_id;
}

function ba700Submissions(store: EventStore) {
  return [...store.replay({ type: "SarbSubmissionAttempted" })].filter(
    (e) => (e.payload as { formId?: string }).formId === "BA700",
  );
}

describe("bea:ba700-period-close — golden path (RwaComputed event of record)", () => {
  it("generates BA 700 from seeded events and records an accepted SARB submission", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);
    const rwaEventId = seedRwaComputed(store);

    const result = await generateAndRecordBa700ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    expect(result.submitted).toBe(true);
    expect(result.status).toBe("submitted-accepted");
    expect(result.accepted).toBe(true);
    expect(ba700SubmissionExists(store, PERIOD_ID)).toBe(true);
    expect(ba700Submissions(store)).toHaveLength(1);

    // Chain-of-custody: the RwaComputed event of record fed the denominator.
    expect(result.rwaComputationEventId).toBe(rwaEventId);
    expect(result.rwaSource).toBe(
      "credit+market-event-sourced;op-placeholder-gross-income-blocked",
    );

    const payload = ba700Submissions(store)[0]?.payload as {
      formId: string;
      reportingPeriod: string;
      mode: string;
    };
    expect(payload.formId).toBe("BA700");
    expect(payload.reportingPeriod).toBe(PERIOD_ID);
    expect(payload.mode).toBe("simulator");
  });

  it("op-RWA is the named zero deferral — total RWA equals credit + market exactly", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);
    seedRwaComputed(store);

    const result = await generateAndRecordBa700ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    // GAP-RETURNS-BA700-OPERATIONAL-RWA: pre-commencement the BIA op-RWA basis
    // (audited gross income) is genuinely zero, so the submitted total RWA is
    // NOT understated — it equals the event-sourced credit + market sum.
    expect(result.submitted).toBe(true);
    expect(result.carRatio).toBeDefined();
    const car = result.carRatio as number;
    // CET1 R2.5m over RWA R20m (minor 2e9) → 0.125 exactly; any non-zero
    // op-RWA contribution would lower it.
    expect(car).toBeCloseTo(250_000_000 / (CREDIT_RWA_MINOR + MARKET_RWA_MINOR), 10);
  });
});

describe("bea:ba700-period-close — fallback sourcing without RwaComputed", () => {
  it("still submits via the disclosed fallback path (no chain-of-custody id)", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);
    // No RwaComputed seeded.

    const result = await generateAndRecordBa700ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    expect(result.submitted).toBe(true);
    expect(result.status).toBe("submitted-accepted");
    expect(result.rwaComputationEventId).toBeUndefined();
    // The sourcing path is disclosed in the source label (live-positions
    // projection or build-phase fixture constant — never silently blank).
    expect(typeof result.rwaSource).toBe("string");
    expect((result.rwaSource as string).length).toBeGreaterThan(0);
  });
});

describe("bea:ba700-period-close — idempotency", () => {
  it("does not emit a second BA 700 submission on re-run of the same period", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);
    seedRwaComputed(store);

    const first = await generateAndRecordBa700ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });
    const second = await generateAndRecordBa700ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    expect(first.submitted).toBe(true);
    expect(second.submitted).toBe(false);
    expect(second.status).toBe("skipped-idempotent");
    expect(ba700Submissions(store)).toHaveLength(1);
  });
});

describe("bea:ba700-period-close — per-entity scope", () => {
  it("silently skips a non-bank entity (no BA 700 submission)", async () => {
    const store = new EventStore(":memory:");
    const result = await generateAndRecordBa700ForPeriod({
      store,
      entity: ENTITY_SECURITIES,
      closedPayload: {
        periodId: PERIOD_ID,
        closedAt: CLOSED_AT,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
        eventSequence: 0,
      },
    });

    expect(result.submitted).toBe(false);
    expect(result.status).toBe("skipped-non-bank-entity");
    expect(ba700Submissions(store)).toHaveLength(0);
  });
});
