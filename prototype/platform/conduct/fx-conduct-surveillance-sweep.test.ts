// platform/conduct/fx-conduct-surveillance-sweep.test.ts
//
// Tests for the FX conduct surveillance sweep — the store-scanning dispatch
// path that fixes the inert event-driven handler.
//
// Author: Zara (Chief Compliance Officer, governance).

import { describe, expect, it } from "bun:test";

import { makeBestExecutionPolicySchedule } from "../event-store/event-types/conduct";
import { makeCounterpartyFaisClassified } from "../event-store/event-types/customer";
import { EventStore } from "../event-store/store";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import { sweepFxConductSurveillance } from "./fx-conduct-surveillance-sweep";
import { resolveBestExecutionSchedule } from "./fx-trade-conduct-evaluation";

const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["FAIS-ACT-37-2002", "D-MARKET-CONDUCT"];

function seedFxTrade(
  store: EventStore,
  opts: { tradeId: string; counterpartyId: string; asOf: string },
): void {
  store.append(
    makeFxTradeExecuted({
      asOf: opts.asOf,
      entity: ENTITY,
      actor: { type: "service", id: "agent:saskia:fx-trader" },
      citations: CITES,
      payload: {
        tradeId: { scheme: "INTERNAL", value: opts.tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 18_500_000_00 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000_00 },
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-05-21", calendar: "JIHCAL" },
        counterparty: {
          partyId: opts.counterpartyId,
          name: "Test Counterparty Bank",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "OTC",
        trader: "test@bank.local",
        bookId: "BOOK-FX-TEST",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        finsurvCategory: "ODP-001-cross-border-institutional",
        clientFlowRef: `client-trade:${opts.tradeId}`,
      },
    }),
  );
}

function classifyCounterparty(
  store: EventStore,
  counterpartyId: string,
  faisCategory: "professional-client" | "market-counterparty",
): void {
  store.append(
    makeCounterpartyFaisClassified({
      asOf: "2026-06-11T00:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "agent:zara:counterparty-fais-classification" },
      citations: CITES,
      payload: {
        counterpartyId,
        faisCategory,
        classifiedAt: "2026-06-11T00:00:00.000Z",
        classifiedBy: "agent:zara:chief-compliance-officer",
      },
    }),
  );
}

const ASOF = "2026-06-11T18:45:00.000Z";

describe("sweepFxConductSurveillance", () => {
  it("emits best-execution + FAIS-suitability + conflict for a classified counterparty trade", () => {
    const store = new EventStore(":memory:");
    classifyCounterparty(store, "CP-BANK-1", "market-counterparty");
    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-BANK-1", asOf: ASOF });

    const result = sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });

    expect(result.tradesScanned).toBe(1);
    expect(result.tradesProcessed).toBe(1);
    expect(result.faisUnclassifiedTradeIds).toHaveLength(0);

    const be = [...store.replay({ type: "BestExecutionVerified" })];
    const fais = [...store.replay({ type: "FaisClassificationSuitabilityChecked" })];
    const conflict = [...store.replay({ type: "ConflictOfInterestDisclosed" })];
    expect(be).toHaveLength(1);
    expect(fais).toHaveLength(1);
    expect(conflict).toHaveLength(1);
    // FAIS suitability for a market-counterparty is suitable.
    expect((fais[0]?.payload as { suitable?: boolean }).suitable).toBe(true);
    // Best-execution: reference defaults to executed rate → spread 0 → verified.
    expect((be[0]?.payload as { spreadBps?: number }).spreadBps).toBe(0);
  });

  it("is idempotent — a second sweep emits nothing", () => {
    const store = new EventStore(":memory:");
    classifyCounterparty(store, "CP-BANK-1", "market-counterparty");
    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-BANK-1", asOf: ASOF });

    sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });
    const second = sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });

    expect(second.eventsEmitted).toBe(0);
    expect(second.tradesProcessed).toBe(0);
    expect(second.tradesAlreadyCovered).toBe(1);
    expect([...store.replay({ type: "BestExecutionVerified" })]).toHaveLength(1);
  });

  it("fires best-execution + conflict but reports FAIS-skipped for an unclassified counterparty", () => {
    const store = new EventStore(":memory:");
    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-UNCLASSIFIED", asOf: ASOF });

    const result = sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });

    expect(result.faisUnclassifiedTradeIds).toEqual(["T-1"]);
    expect([...store.replay({ type: "BestExecutionVerified" })]).toHaveLength(1);
    expect([...store.replay({ type: "ConflictOfInterestDisclosed" })]).toHaveLength(1);
    // No FAIS-suitability event when the counterparty is unclassified.
    expect([...store.replay({ type: "FaisClassificationSuitabilityChecked" })]).toHaveLength(0);
  });

  it("dryRun computes but appends nothing", () => {
    const store = new EventStore(":memory:");
    classifyCounterparty(store, "CP-BANK-1", "market-counterparty");
    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-BANK-1", asOf: ASOF });

    const result = sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: true });

    expect(result.tradesScanned).toBe(1);
    expect([...store.replay({ type: "BestExecutionVerified" })]).toHaveLength(0);
    expect([...store.replay({ type: "FaisClassificationSuitabilityChecked" })]).toHaveLength(0);
  });

  it("flags a retail-client counterparty as unsuitable (institutional-only venue)", () => {
    const store = new EventStore(":memory:");
    // retail-client is not a category Zara assigns, but defend the path.
    store.append(
      makeCounterpartyFaisClassified({
        asOf: "2026-06-11T00:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:zara:counterparty-fais-classification" },
        citations: CITES,
        payload: {
          counterpartyId: "CP-RETAIL",
          faisCategory: "retail-client",
          classifiedAt: "2026-06-11T00:00:00.000Z",
          classifiedBy: "agent:zara:chief-compliance-officer",
        },
      }),
    );
    seedFxTrade(store, { tradeId: "T-RETAIL", counterpartyId: "CP-RETAIL", asOf: ASOF });

    sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });

    const fais = [...store.replay({ type: "FaisClassificationSuitabilityChecked" })];
    expect(fais).toHaveLength(1);
    expect((fais[0]?.payload as { suitable?: boolean }).suitable).toBe(false);
    // A conduct obligation is flagged at breach severity.
    const flagged = [...store.replay({ type: "ConductObligationFlagged" })];
    expect(
      flagged.some(
        (e) => (e.payload as { obligationCode?: string }).obligationCode === "fais-suitability",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BestExecutionPolicySchedule — CCO-published tolerance schedule read-path
// (closes deferred gap fx-best-execution-policy-schedule; the schedule owns
// TOLERANCE, the separate gap fx-best-execution-reference-benchmark owns
// REFERENCE).
// ---------------------------------------------------------------------------

function seedSchedule(
  store: EventStore,
  opts: {
    scheduleId: string;
    effectiveFrom: string;
    fxSpotBps?: number;
    defaultBps?: number;
  },
): string {
  const event = makeBestExecutionPolicySchedule({
    asOf: opts.effectiveFrom,
    entity: ENTITY,
    actor: { type: "service", id: "agent:zara:bestex-policy-schedule" },
    citations: ["FAIS-ACT-37-2002-S16", "CS-3-2018", "D-MARKET-CONDUCT"],
    payload: {
      scheduleId: opts.scheduleId,
      productScope: "prd:bank:fx:otc-vanilla",
      toleranceBands: [{ instrumentClass: "FX-spot", maxAdverseSpreadBps: opts.fxSpotBps ?? 10 }],
      defaultToleranceBps: opts.defaultBps ?? 20,
      referenceRateBasis: "executed-rate",
      effectiveFrom: opts.effectiveFrom,
      reviewCadence: "annual conduct-committee review",
      supersedes: null,
      publishedBy: "Zara (Chief Compliance Officer, governance)",
    },
  });
  store.append(event);
  return event.event_id;
}

describe("BestExecutionPolicySchedule read-path", () => {
  it("applies the in-force schedule tolerance to best-execution checks", () => {
    const store = new EventStore(":memory:");
    const scheduleEventId = seedSchedule(store, {
      scheduleId: "BESTEX-TEST-001",
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      fxSpotBps: 7,
    });
    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-BANK-1", asOf: ASOF });

    const result = sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });

    expect(result.bestExScheduleEventId).toBe(scheduleEventId);
    const be = [...store.replay({ type: "BestExecutionVerified" })];
    expect(be).toHaveLength(1);
    // Tolerance comes from the CCO schedule (7), not the build-phase constant (10).
    expect((be[0]?.payload as { toleranceBps?: number }).toleranceBps).toBe(7);
  });

  it("falls back to build-phase constants (and reports null schedule) when no schedule is in force", () => {
    const store = new EventStore(":memory:");
    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-BANK-1", asOf: ASOF });

    const result = sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });

    expect(result.bestExScheduleEventId).toBeNull();
    const be = [...store.replay({ type: "BestExecutionVerified" })];
    // Build-phase constant for FX-spot is 10.
    expect((be[0]?.payload as { toleranceBps?: number }).toleranceBps).toBe(10);
  });

  it("latest-effective-wins: the schedule with the greatest effectiveFrom ≤ asOf applies; future-dated schedules are ignored", () => {
    const store = new EventStore(":memory:");
    seedSchedule(store, {
      scheduleId: "BESTEX-TEST-001",
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      fxSpotBps: 5,
    });
    const laterId = seedSchedule(store, {
      scheduleId: "BESTEX-TEST-002",
      effectiveFrom: "2026-06-10T00:00:00.000Z",
      fxSpotBps: 8,
    });
    // Future-dated — must NOT apply at ASOF (2026-06-11T18:45).
    seedSchedule(store, {
      scheduleId: "BESTEX-TEST-003",
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      fxSpotBps: 99,
    });

    const resolved = resolveBestExecutionSchedule(store, ASOF);
    expect(resolved?.scheduleEventId).toBe(laterId);
    expect(resolved?.toleranceBpsByClass.get("FX-spot")).toBe(8);

    seedFxTrade(store, { tradeId: "T-1", counterpartyId: "CP-BANK-1", asOf: ASOF });
    sweepFxConductSurveillance(store, { asOf: ASOF, dryRun: false });
    const be = [...store.replay({ type: "BestExecutionVerified" })];
    expect((be[0]?.payload as { toleranceBps?: number }).toleranceBps).toBe(8);
  });

  it("uses the schedule's defaultToleranceBps for an instrument class with no explicit band", () => {
    const store = new EventStore(":memory:");
    // Schedule has an FX-spot band only; defaultBps 33 covers everything else.
    seedSchedule(store, {
      scheduleId: "BESTEX-TEST-001",
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      fxSpotBps: 7,
      defaultBps: 33,
    });
    const resolved = resolveBestExecutionSchedule(store, ASOF);
    expect(resolved).not.toBeNull();
    expect(resolved?.toleranceBpsByClass.get("FX-forward")).toBeUndefined();
    expect(resolved?.defaultToleranceBps).toBe(33);
  });
});
