// runtime/agents/bea-ba300-lcr-period-close.test.ts
//
// Unit tests for the BA 300 (LCR) period-close runtime wiring
// (WS-RETURNS-SUBMISSION-WIRING Wave A).
//
// Asserts:
//   1. A closed bank period generates the BA 300 LCR return and records a
//      SarbSubmissionAttempted{formId:"BA300"} submission (mode "simulator").
//   2. Idempotency — re-running the same closed period does NOT emit a second
//      BA 300 submission.
//   3. A non-bank entity is silently skipped.
//
// Raw EventStore(":memory:") is a build-phase test fixture (permission-gate
// carve-out).
//
// Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-BA300-LCR-FX-ENRICHMENT.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import { EventStore } from "../../platform/event-store/store";
import {
  ba300SubmissionExists,
  generateAndRecordBa300LcrForPeriod,
} from "./bea-ba300-lcr-period-close";

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

function countBa300Submissions(store: EventStore): number {
  let n = 0;
  for (const ev of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = ev.payload as { formId?: string };
    if (p.formId === "BA300") n += 1;
  }
  return n;
}

describe("bea:ba300-lcr-period-close — generation + submission", () => {
  it("generates BA 300 LCR and records a SARB submission for a closed bank period", async () => {
    const store = new EventStore(":memory:");
    const result = await generateAndRecordBa300LcrForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });

    expect(result.submitted).toBe(true);
    expect(result.status).toBe("submitted-accepted");
    expect(countBa300Submissions(store)).toBe(1);
    expect(ba300SubmissionExists(store, PERIOD_ID)).toBe(true);

    const submission = [...store.replay({ type: "SarbSubmissionAttempted" })].find(
      (e) => (e.payload as { formId?: string }).formId === "BA300",
    );
    const payload = submission?.payload as {
      formId: string;
      formVersion: string;
      reportingPeriod: string;
      mode: string;
    };
    expect(payload.formId).toBe("BA300");
    expect(payload.formVersion).toBe("v0.2-fx-enriched");
    expect(payload.reportingPeriod).toBe(PERIOD_ID);
    expect(payload.mode).toBe("simulator");
  });
});

describe("bea:ba300-lcr-period-close — idempotency", () => {
  it("does not emit a second BA 300 submission on re-run of the same period", async () => {
    const store = new EventStore(":memory:");
    const first = await generateAndRecordBa300LcrForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });
    const second = await generateAndRecordBa300LcrForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload: makeClosedPayload(),
    });

    expect(first.submitted).toBe(true);
    expect(second.submitted).toBe(false);
    expect(second.status).toBe("skipped-idempotent");
    expect(countBa300Submissions(store)).toBe(1);
  });
});

describe("bea:ba300-lcr-period-close — per-entity scope", () => {
  it("silently skips a non-bank entity (no BA 300 submission)", async () => {
    const store = new EventStore(":memory:");
    const result = await generateAndRecordBa300LcrForPeriod({
      store,
      entity: ENTITY_SECURITIES,
      closedPayload: makeClosedPayload(),
    });

    expect(result.submitted).toBe(false);
    expect(result.status).toBe("skipped-non-bank-entity");
    expect(countBa300Submissions(store)).toBe(0);
  });
});
