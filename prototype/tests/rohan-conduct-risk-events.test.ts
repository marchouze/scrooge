// tests/rohan-conduct-risk-events.test.ts
//
// M3 Slice 9 — Unit tests for rohan:conduct-risk-events handler.
//
// Uses the composition-level event store (singleton) — same pattern as
// other agent handler tests (kai-pre-trade-gateway, rohan-market-risk, etc.).
// Each test uses a unique tradeId to avoid cross-test interference.
//
// Asserts:
//   1. Clean FX trade with on-market rate — emits BestExecutionVerified.
//   2. Principal (trading-book) trade — emits ConflictOfInterestDisclosed.
//   3. FAIS suitability — suitable=true for professional-client counterparty.
//   4. FAIS suitability — suitable=true for market-counterparty.
//   5. Best-execution breach — emits BestExecutionBreached + ConductObligationFlagged.
//   6. Best-execution pass (narrow spread) — emits BestExecutionVerified.
//   7. FAIS suitability concern — suitable=false + ConductObligationFlagged for retail-client.
//   8. No triggering events — handler returns ok with zero events emitted.
//   9. Idempotency — duplicate trade event does not double-emit.
//  10. Missing CounterpartyFaisClassified — FAIS check is skipped (no suitability event).
//  11. Dry-run mode — no events appended to the event store.
//  12. Factory smoke tests — new event types round-trip EventStore without error.
//
// Authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// Author: Rohan (Quant Risk Engineer, markets)

import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import {
  makeBestExecutionBreached,
  makeBestExecutionVerified,
  makeConflictOfInterestDisclosed,
  makeFaisClassificationSuitabilityChecked,
} from "../platform/event-store/event-types/conduct";
import { makeCounterpartyFaisClassified } from "../platform/event-store/event-types/customer";
import type { Event } from "../platform/event-store/types";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import handler from "../runtime/agents/rohan-conduct-risk-events";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dir, "..", "..");
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:test:rohan-conduct-risk-events" };
const CITATIONS = ["D-MARKET-CONDUCT", "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"];
const AS_OF = "2026-05-17T10:00:00.000Z";

// Counter for unique trade IDs (avoids cross-test interference in shared store)
let tradeCounter = 0;
function nextTradeId(): string {
  tradeCounter += 1;
  return `CONDUCT-TEST-${String(tradeCounter).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Minimal FX spot trade event that passes schema validation.
 * Uses CDM-correct schemas: identifierSchema, cdmDateSchema, partySchema.
 *
 * Pass `referenceRate` to test best-execution spread scenarios. When
 * omitted, the handler uses the executed rate as the reference (spread=0).
 */
function makeTestFxSpotTrade(opts: {
  tradeId: string;
  counterpartyId?: string;
  executedRate?: number;
  bookType?: "trading" | "banking-treasury";
}): Event {
  const rate = opts.executedRate ?? 18.5;
  const cpId = opts.counterpartyId ?? "cp-default";
  return makeFxTradeExecuted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      // CDM identifierSchema: { scheme, value }
      tradeId: { scheme: "internal", value: opts.tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "USD",
          receiveCurrency: "ZAR",
          notional: { currency: "USD", amountMinor: 100000_00 },
          counterNotional: { currency: "ZAR", amountMinor: Math.round(rate * 100000_00) },
          // CDM priceSchema: { currency, amount }
          rate: { currency: "ZAR", amount: rate },
          // CDM cdmDateSchema: { iso, calendar }
          settlementDate: { iso: "2026-05-19", calendar: "JIHCAL" as const },
        },
      ],
      // CDM cdmDateSchema: { iso, calendar }
      tradeDate: { iso: "2026-05-17", calendar: "JIHCAL" as const },
      // CDM partySchema: { partyId, name, role }
      counterparty: {
        partyId: cpId,
        name: `Test Counterparty ${cpId}`,
        role: "counterparty" as const,
      },
      venue: "OTC",
      trader: "trader-001",
      bookId: "FX-TRADING",
      bookType: opts.bookType ?? "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
    },
  });
}

/**
 * Same as makeTestFxSpotTrade but injects the referenceRate into the event
 * payload object directly (bypassing schema strip) for spread testing.
 *
 * The handler reads `(trade.payload as Record<string, unknown>).referenceRate`
 * after the event is stored, so injecting it post-construction is safe.
 */
function makeTestFxSpotTradeWithRef(opts: {
  tradeId: string;
  counterpartyId?: string;
  executedRate: number;
  referenceRate: number;
  bookType?: "trading" | "banking-treasury";
}): Event {
  const event = makeTestFxSpotTrade(opts);
  // Inject referenceRate into the payload object so the handler can read it.
  (event.payload as Record<string, unknown>).referenceRate = opts.referenceRate;
  return event;
}

/** Register a counterparty's FAIS classification in the shared event store. */
function registerFaisClassification(
  counterpartyId: string,
  faisCategory: "professional-client" | "retail-client" | "market-counterparty",
): void {
  eventStore.append(
    makeCounterpartyFaisClassified({
      asOf: "2026-05-01T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId,
        faisCategory,
        classifiedAt: "2026-05-01T00:00:00.000Z",
        classifiedBy: "agent:niko:onboarding",
      },
    }),
  );
}

function makeCtx(triggeringEvents: readonly Event[], dryRun = false): AgentRunContext {
  return {
    agent: "Rohan",
    trigger: {
      kind: "event-driven",
      id: "conduct-risk-events",
      triggeringEvents,
    },
    asOf: AS_OF,
    repoRoot: REPO_ROOT,
    ownerInboxDir: join(REPO_ROOT, "Owner Inbox"),
    dryRun,
  };
}

/** Count events of a given type whose `payload.tradeId` matches. */
function countByTradeId(type: string, tradeId: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type })) {
    const p = e.payload as { tradeId?: unknown };
    if (p.tradeId === tradeId) n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 1. Clean FX trade — BestExecutionVerified (zero spread)
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — clean FX trade", () => {
  it("emits BestExecutionVerified for trade with zero spread (no referenceRate override)", async () => {
    const tradeId = nextTradeId();
    const trade = makeTestFxSpotTrade({ tradeId });
    eventStore.append(trade);

    const result = await handler(makeCtx([trade]));
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBeGreaterThan(0);

    expect(countByTradeId("BestExecutionVerified", tradeId)).toBe(1);
    expect(countByTradeId("BestExecutionBreached", tradeId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. ConflictOfInterestDisclosed for principal trading-book trade
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — conflict of interest", () => {
  it("emits ConflictOfInterestDisclosed with conflictExists=true for trading-book trade", async () => {
    const tradeId = nextTradeId();
    const cpId = `cp-coi-${tradeId}`;
    const trade = makeTestFxSpotTrade({ tradeId, counterpartyId: cpId, bookType: "trading" });
    eventStore.append(trade);

    await handler(makeCtx([trade]));

    expect(countByTradeId("ConflictOfInterestDisclosed", tradeId)).toBe(1);

    // Find the specific event and check payload.
    for (const e of eventStore.replay({ type: "ConflictOfInterestDisclosed" })) {
      const p = e.payload as {
        tradeId?: string;
        bankRole?: string;
        conflictExists?: boolean;
        counterpartyId?: string;
      };
      if (p.tradeId !== tradeId) continue;
      expect(p.bankRole).toBe("principal");
      expect(p.conflictExists).toBe(true);
      expect(p.counterpartyId).toBe(cpId);
    }
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. FAIS suitability — professional-client and market-counterparty
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — FAIS suitability (eligible categories)", () => {
  it("emits FaisClassificationSuitabilityChecked suitable=true for professional-client", async () => {
    const tradeId = nextTradeId();
    const cpId = `cp-prof-${tradeId}`;
    registerFaisClassification(cpId, "professional-client");

    const trade = makeTestFxSpotTrade({ tradeId, counterpartyId: cpId });
    eventStore.append(trade);

    await handler(makeCtx([trade]));

    expect(countByTradeId("FaisClassificationSuitabilityChecked", tradeId)).toBe(1);

    for (const e of eventStore.replay({ type: "FaisClassificationSuitabilityChecked" })) {
      const p = e.payload as {
        tradeId?: string;
        suitable?: boolean;
        counterpartyFaisCategory?: string;
      };
      if (p.tradeId !== tradeId) continue;
      expect(p.suitable).toBe(true);
      expect(p.counterpartyFaisCategory).toBe("professional-client");
    }
  });

  it("emits FaisClassificationSuitabilityChecked suitable=true for market-counterparty", async () => {
    const tradeId = nextTradeId();
    const cpId = `cp-mkt-${tradeId}`;
    registerFaisClassification(cpId, "market-counterparty");

    const trade = makeTestFxSpotTrade({ tradeId, counterpartyId: cpId });
    eventStore.append(trade);

    await handler(makeCtx([trade]));

    expect(countByTradeId("FaisClassificationSuitabilityChecked", tradeId)).toBe(1);

    for (const e of eventStore.replay({ type: "FaisClassificationSuitabilityChecked" })) {
      const p = e.payload as { tradeId?: string; suitable?: boolean };
      if (p.tradeId !== tradeId) continue;
      expect(p.suitable).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Best-execution breach — spread exceeds tolerance
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — best-execution breach", () => {
  it("emits BestExecutionBreached + ConductObligationFlagged when spread > 10 bps for FX-spot", async () => {
    const tradeId = nextTradeId();
    // Rate 18.52 vs ref 18.50 → spread ≈ (18.52-18.50)/18.50 * 10000 ≈ 10.81 bps > 10 bps tolerance
    const trade = makeTestFxSpotTradeWithRef({
      tradeId,
      executedRate: 18.52,
      referenceRate: 18.5,
    });
    eventStore.append(trade);

    const result = await handler(makeCtx([trade]));
    expect(result.ok).toBe(true);

    expect(countByTradeId("BestExecutionBreached", tradeId)).toBe(1);
    expect(countByTradeId("BestExecutionVerified", tradeId)).toBe(0);

    // ConductObligationFlagged with obligationCode=best-execution
    let flagCount = 0;
    for (const e of eventStore.replay({ type: "ConductObligationFlagged" })) {
      const p = e.payload as { tradeId?: string; obligationCode?: string };
      if (p.tradeId === tradeId && p.obligationCode === "best-execution") flagCount += 1;
    }
    expect(flagCount).toBe(1);
  });

  it("emits BestExecutionVerified when spread is within 10 bps tolerance", async () => {
    const tradeId = nextTradeId();
    // Rate 18.501 vs ref 18.50 → spread ≈ 0.54 bps — within 10 bps tolerance
    const trade = makeTestFxSpotTradeWithRef({
      tradeId,
      executedRate: 18.501,
      referenceRate: 18.5,
    });
    eventStore.append(trade);

    await handler(makeCtx([trade]));

    expect(countByTradeId("BestExecutionVerified", tradeId)).toBe(1);
    expect(countByTradeId("BestExecutionBreached", tradeId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. FAIS suitability concern — retail-client counterparty
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — FAIS suitability concern (retail-client)", () => {
  it("emits FaisClassificationSuitabilityChecked suitable=false + ConductObligationFlagged[fais-suitability]", async () => {
    const tradeId = nextTradeId();
    const cpId = `cp-retail-${tradeId}`;
    registerFaisClassification(cpId, "retail-client");

    const trade = makeTestFxSpotTrade({ tradeId, counterpartyId: cpId });
    eventStore.append(trade);

    const result = await handler(makeCtx([trade]));
    expect(result.ok).toBe(true);

    expect(countByTradeId("FaisClassificationSuitabilityChecked", tradeId)).toBe(1);

    for (const e of eventStore.replay({ type: "FaisClassificationSuitabilityChecked" })) {
      const p = e.payload as {
        tradeId?: string;
        suitable?: boolean;
        counterpartyFaisCategory?: string;
      };
      if (p.tradeId !== tradeId) continue;
      expect(p.suitable).toBe(false);
      expect(p.counterpartyFaisCategory).toBe("retail-client");
    }

    // ConductObligationFlagged for fais-suitability
    let faisFlagCount = 0;
    for (const e of eventStore.replay({ type: "ConductObligationFlagged" })) {
      const p = e.payload as { tradeId?: string; obligationCode?: string; severity?: string };
      if (p.tradeId !== tradeId || p.obligationCode !== "fais-suitability") continue;
      expect(p.severity).toBe("breach");
      faisFlagCount += 1;
    }
    expect(faisFlagCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. No triggering events
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — no triggering events", () => {
  it("returns ok with zero events when triggeringEvents is empty", async () => {
    const result = await handler(makeCtx([]));
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toContain("no FxTradeExecuted events");
  });

  it("returns ok with zero events when triggeringEvents is undefined", async () => {
    const ctx: AgentRunContext = {
      agent: "Rohan",
      trigger: { kind: "event-driven", id: "conduct-risk-events" },
      asOf: AS_OF,
      repoRoot: REPO_ROOT,
      ownerInboxDir: join(REPO_ROOT, "Owner Inbox"),
      dryRun: false,
    };
    const result = await handler(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Idempotency — duplicate trade event
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — idempotency", () => {
  it("does not double-emit when the same FxTradeExecuted fires twice", async () => {
    const tradeId = nextTradeId();
    const trade = makeTestFxSpotTrade({ tradeId });
    eventStore.append(trade);

    // First run
    const r1 = await handler(makeCtx([trade]));
    expect(r1.ok).toBe(true);
    const beVerifiedAfterFirst = countByTradeId("BestExecutionVerified", tradeId);
    const conflictAfterFirst = countByTradeId("ConflictOfInterestDisclosed", tradeId);

    // Second run with the same trade
    const r2 = await handler(makeCtx([trade]));
    expect(r2.ok).toBe(true);
    expect(r2.eventsEmitted).toBe(0); // all checks idempotent

    // Counts must not grow
    expect(countByTradeId("BestExecutionVerified", tradeId)).toBe(beVerifiedAfterFirst);
    expect(countByTradeId("ConflictOfInterestDisclosed", tradeId)).toBe(conflictAfterFirst);
  });
});

// ---------------------------------------------------------------------------
// 10. Missing CounterpartyFaisClassified — FAIS check skipped
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — missing FAIS classification", () => {
  it("skips FAIS suitability check when no CounterpartyFaisClassified exists for counterparty", async () => {
    const tradeId = nextTradeId();
    const cpId = `cp-unclassified-${tradeId}`; // deliberately not registered
    const trade = makeTestFxSpotTrade({ tradeId, counterpartyId: cpId });
    eventStore.append(trade);

    const result = await handler(makeCtx([trade]));
    expect(result.ok).toBe(true);

    expect(countByTradeId("FaisClassificationSuitabilityChecked", tradeId)).toBe(0);
    // Best-execution and conflict events should still be emitted
    const beCount =
      countByTradeId("BestExecutionVerified", tradeId) +
      countByTradeId("BestExecutionBreached", tradeId);
    expect(beCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Dry-run mode — no events appended
// ---------------------------------------------------------------------------

describe("rohan:conduct-risk-events — dry-run mode", () => {
  it("does not append conduct events in dry-run mode", async () => {
    const tradeId = nextTradeId();
    const cpId = `cp-dry-${tradeId}`;
    registerFaisClassification(cpId, "professional-client");

    const trade = makeTestFxSpotTrade({ tradeId, counterpartyId: cpId });
    eventStore.append(trade);

    const storeBefore = eventStore.count();

    const result = await handler(makeCtx([trade], /* dryRun */ true));
    expect(result.ok).toBe(true);

    // No conduct risk events should be appended
    expect(eventStore.count()).toBe(storeBefore);
    expect(countByTradeId("BestExecutionVerified", tradeId)).toBe(0);
    expect(countByTradeId("FaisClassificationSuitabilityChecked", tradeId)).toBe(0);
    expect(countByTradeId("ConflictOfInterestDisclosed", tradeId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Factory smoke tests — new event types round-trip EventStore
// ---------------------------------------------------------------------------

describe("conduct risk event factory smoke tests", () => {
  it("makeBestExecutionVerified appends without error", () => {
    const tradeId = nextTradeId();
    expect(() =>
      eventStore.append(
        makeBestExecutionVerified({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId,
            verifiedAt: AS_OF,
            assetClass: "FX-spot",
            venue: "OTC",
            executedRate: 18.5,
            referenceRate: 18.5,
            spreadBps: 0,
            toleranceBps: 10,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeBestExecutionBreached appends without error", () => {
    const tradeId = nextTradeId();
    expect(() =>
      eventStore.append(
        makeBestExecutionBreached({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId,
            detectedAt: AS_OF,
            assetClass: "FX-spot",
            venue: "OTC",
            executedRate: 18.52,
            referenceRate: 18.5,
            spreadBps: 10.81,
            toleranceBps: 10,
            counterpartyId: "cp-test",
            remedialCommunicationRequired: false,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeFaisClassificationSuitabilityChecked appends without error", () => {
    const tradeId = nextTradeId();
    expect(() =>
      eventStore.append(
        makeFaisClassificationSuitabilityChecked({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId,
            checkedAt: AS_OF,
            counterpartyFaisCategory: "professional-client",
            productCode: "FX-spot",
            suitable: true,
            counterpartyId: "cp-test",
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeConflictOfInterestDisclosed appends without error", () => {
    const tradeId = nextTradeId();
    expect(() =>
      eventStore.append(
        makeConflictOfInterestDisclosed({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            tradeId,
            disclosedAt: AS_OF,
            bankRole: "principal",
            conflictExists: true,
            conflictDescription: "Bank acts as principal on trading-book trade.",
            disclosureChannel: "system-generated",
            counterpartyId: "cp-test",
          },
        }),
      ),
    ).not.toThrow();
  });
});
