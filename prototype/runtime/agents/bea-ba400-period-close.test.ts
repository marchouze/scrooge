// runtime/agents/bea-ba400-period-close.test.ts
//
// Unit tests for the BA 400 (Operational Risk, BIA) period-close runtime wiring
// (W2.2 — D-TREASURER-WAVE2-SUBSTRATE, CEO session-delegation 2026-06-11).
//
// Asserts:
//   1. GOLDEN PATH — a closed bank period generates the BA 400 return (BIA,
//      zero capital pre-commencement) and records a
//      SarbSubmissionAttempted{formId:"BA400"} submission (mode "simulator").
//   2. Pre-commencement zero capital: opRiskCapitalMinor = 0 and
//      opRiskRwaMinor = 0 — the CORRECT BIA value with no gross income, not an
//      understatement (GAP-RETURNS-BA400-GROSS-INCOME).
//   3. Idempotency — re-running the same closed period does NOT emit a second
//      BA 400 submission.
//   4. A non-bank entity is silently skipped.
//
// Raw EventStore(":memory:") is a build-phase test fixture (permission-gate
// carve-out).
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE; D-RETURNS-SUBMISSION-WIRING-WORKSTREAM;
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
// Brief: brief:bea:w2-2-wire-ba-400-operational-risk-return-bia-gro:2026-06-11
// Run: run:bea:2026-06-11T18-14-12-572Z
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../../platform/accounting/period-close";
import { newEventId } from "../../platform/core/types";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import { EventStore } from "../../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../../platform/projections/filter";
import { ba400SubmissionExists, generateAndRecordBa400ForPeriod } from "./bea-ba400-period-close";

// Provenance override — test events are untagged (simulated).
beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const CLOSED_AT = "2026-06-01T00:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-TREASURER-WAVE2-SUBSTRATE", "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM"];

/** Open + close a period on the bank entity. */
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

function ba400Submissions(store: EventStore) {
  return [...store.replay({ type: "SarbSubmissionAttempted" })].filter(
    (e) => (e.payload as { formId?: string }).formId === "BA400",
  );
}

describe("bea:ba400-period-close — golden path (pre-commencement, zero gross income)", () => {
  it("generates BA 400 from a closed period and records an accepted SARB submission", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);

    const result = await generateAndRecordBa400ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    expect(result.submitted).toBe(true);
    expect(result.status).toBe("submitted-accepted");
    expect(result.accepted).toBe(true);
    expect(ba400SubmissionExists(store, PERIOD_ID)).toBe(true);
    expect(ba400Submissions(store)).toHaveLength(1);

    const payload = ba400Submissions(store)[0]?.payload as {
      formId: string;
      reportingPeriod: string;
      mode: string;
    };
    expect(payload.formId).toBe("BA400");
    expect(payload.reportingPeriod).toBe(PERIOD_ID);
    expect(payload.mode).toBe("simulator");
  });

  it("pre-commencement: opRiskCapitalMinor = 0 and opRiskRwaMinor = 0 (GAP-RETURNS-BA400-GROSS-INCOME)", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);

    const result = await generateAndRecordBa400ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    // Zero IS the correct BIA value for a bank with no gross income since
    // incorporation — α × avg(positive annual gross income, 3y) = 0.
    // This is NOT an understatement (same reasoning as GAP-RETURNS-BA700-OPERATIONAL-RWA).
    expect(result.submitted).toBe(true);
    expect(result.opRiskCapitalMinor).toBe(0);
    expect(result.opRiskRwaMinor).toBe(0);
  });
});

describe("bea:ba400-period-close — idempotency", () => {
  it("does not emit a second BA 400 submission on re-run of the same period", async () => {
    const store = new EventStore(":memory:");
    const closedPayload = seedClosedPeriod(store);

    const first = await generateAndRecordBa400ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });
    const second = await generateAndRecordBa400ForPeriod({
      store,
      entity: ENTITY_BANK,
      closedPayload,
    });

    expect(first.submitted).toBe(true);
    expect(second.submitted).toBe(false);
    expect(second.status).toBe("skipped-idempotent");
    expect(ba400Submissions(store)).toHaveLength(1);
  });
});

describe("bea:ba400-period-close — per-entity scope", () => {
  it("silently skips a non-bank entity (no BA 400 submission)", async () => {
    const store = new EventStore(":memory:");
    const result = await generateAndRecordBa400ForPeriod({
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
    expect(ba400Submissions(store)).toHaveLength(0);
  });
});
