// runtime/agents/bea-ba310-period-close.test.ts
//
// Unit tests for the BA-310 (market / position risk — FX-NOP) period-close
// runtime wiring (FX functionality domain review gap #1).
//
// Asserts:
//   1. A closed bank period generates the BA-310 return and records a
//      SarbSubmissionAttempted{formId:"BA320"} submission (mode "simulator").
//   2. Idempotency — re-running the same closed period does NOT emit a second
//      BA-310 submission (one BA-310 record per period).
//   3. A non-bank entity is silently skipped (no submission).
//   4. The submission record carries the canonical form code BA320 (not the fabricated BA310)
//      per D-BA-RETURN-FORM-NUMBERING-RECON.
//
// Raw EventStore(":memory:") + MarketDataStore(":memory:") are build-phase test
// fixtures (T-01 permission-gate carve-out, registered in
// platform/recon/permission-gate-default.ts).
//
// Authority: D-BA-RETURN-FORM-NUMBERING-RECON;
//            D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import { EventStore } from "../../platform/event-store/store";
import { MarketDataStore } from "../../platform/market-data/store";
import { ba310SubmissionExists, generateAndRecordBa310ForPeriod } from "./bea-ba310-period-close";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const PERIOD_ID = "period:hoz-bank:month:2026-05";

function makeClosedPayload(): AccountingPeriodClosedPayload {
  return {
    periodId: PERIOD_ID,
    closedAt: "2026-06-01T00:00:00.000Z",
    trialBalanceSnapshotEventId: newEventId(),
    uptoSequence: 0,
    eventSequence: 0,
  };
}

/** A market-data store with one USD/ZAR production fx-quote so the ZAR rate map resolves. */
function makeMarketData(): MarketDataStore {
  const md = new MarketDataStore(":memory:");
  md.append({
    id: newEventId(),
    source: "fx-sim",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: "2026-05-31T00:00:00.000Z",
    payload: { midRate: 18.5 },
  });
  return md;
}

function countBa310Submissions(store: EventStore): number {
  let n = 0;
  for (const ev of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = ev.payload as { formId?: string };
    if (p.formId === "BA320") n += 1;
  }
  return n;
}

describe("bea:ba310-period-close — generation + submission", () => {
  it("generates BA-310 and records a SARB submission for a closed bank period", async () => {
    const store = new EventStore(":memory:");
    const md = makeMarketData();

    const result = await generateAndRecordBa310ForPeriod({
      store,
      marketData: md,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });
    md.close();

    expect(result.submitted).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.status).toBe("submitted-accepted");
    expect(countBa310Submissions(store)).toBe(1);
    expect(ba310SubmissionExists(store, PERIOD_ID)).toBe(true);
  });

  it("records the submission with the canonical form code BA320 (not the fabricated BA310)", async () => {
    const store = new EventStore(":memory:");
    const md = makeMarketData();

    await generateAndRecordBa310ForPeriod({
      store,
      marketData: md,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });
    md.close();

    const submission = [...store.replay({ type: "SarbSubmissionAttempted" })][0];
    const payload = submission.payload as {
      formId: string;
      reportingPeriod: string;
      mode: string;
    };
    expect(payload.formId).toBe("BA320");
    expect(payload.reportingPeriod).toBe(PERIOD_ID);
    // Build-phase: generation is wired; the live SARB transport is licence-day.
    expect(payload.mode).toBe("simulator");
  });
});

describe("bea:ba310-period-close — idempotency", () => {
  it("does not emit a second BA-310 submission on re-run of the same period", async () => {
    const store = new EventStore(":memory:");
    const md = makeMarketData();

    const first = await generateAndRecordBa310ForPeriod({
      store,
      marketData: md,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });
    const second = await generateAndRecordBa310ForPeriod({
      store,
      marketData: md,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });
    md.close();

    expect(first.submitted).toBe(true);
    expect(second.submitted).toBe(false);
    expect(second.status).toBe("skipped-idempotent");
    // One BA-310 submission per period — no duplicate on the re-run.
    expect(countBa310Submissions(store)).toBe(1);
  });
});

describe("bea:ba310-period-close — per-entity scope", () => {
  it("silently skips a non-bank entity (no BA-310 submission)", async () => {
    const store = new EventStore(":memory:");
    const md = makeMarketData();

    const result = await generateAndRecordBa310ForPeriod({
      store,
      marketData: md,
      entity: ENTITY_SECURITIES,
      closedPayload: makeClosedPayload(),
    });
    md.close();

    expect(result.submitted).toBe(false);
    expect(result.status).toBe("skipped-non-bank-entity");
    expect(countBa310Submissions(store)).toBe(0);
  });
});
