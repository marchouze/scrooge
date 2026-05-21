// tests/runtime-bea-m1-ifrs-classification.test.ts
//
// Tests for Bea's M1 IFRS-classification handler under
// `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07).
//
// Asserts:
//   - SPPI gate: equities fail by shape (sppiPass = false on every emit).
//   - Business-model dispatch: trading → FVTPL, fvoci-election → FVOCI.
//   - FV hierarchy: JSE + clean → L1; thin / non-JSE → L2.
//   - FX revaluation flag: instrument.currency != ZAR → fxRevaluationRequired.
//   - Citation chain: every IfrsClassificationApplied carries IFRS-9, IFRS-13,
//     and the obligations-register row IDs (ORG-AC-01, ORG-AC-05).
//   - Sub-ledger postings: trade-date booking emits one SubLedgerPostingEmitted
//     per EquityTradeBooked; settlement-confirmation emits one per
//     EquitySettlementInstructed.
//   - Idempotency: re-firing with the same trade does not re-emit.
//   - Lifecycle anchors: CeoDecision / CdmBindingsRegenerated do not emit
//     per-event but are counted in the summary.
//   - Empty triggering set is a clean no-op.
//
// Author: Bea

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeCdmBindingsRegenerated } from "../platform/event-store/event-types-cdm";
import { makeDecision } from "../platform/event-store/event-types/decision";
import type { Event } from "../platform/event-store/types";
import { makeEquitySettlementInstructed, makeEquityTradeBooked } from "../platform/markets/cdm";
import beaM1IfrsClassificationRules, {
  classifyEquityTrade,
} from "../runtime/agents/bea-m1-ifrs-classification-rules";
import type { AgentRunContext } from "../runtime/types";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const SOURCE_ACTOR = { type: "service" as const, id: "agent:test:trade-source" };
const TRADE_CITATIONS = ["ISDA-CDM", "JSE-RULES-EQUITIES"];

function makeContext(overrides: {
  triggeringEvents: readonly Event[];
  asOf?: string;
  dryRun?: boolean;
}): AgentRunContext {
  const ownerInboxDir = mkdtempSync(join(tmpdir(), "bea-ifrs-"));
  return {
    agent: "Bea",
    trigger: {
      kind: "event-driven",
      id: "m1-ifrs-classification-rules",
      triggeringEvents: overrides.triggeringEvents,
    },
    asOf: overrides.asOf ?? "2026-05-09T00:00:00.000Z",
    repoRoot: REPO_ROOT,
    ownerInboxDir,
    dryRun: overrides.dryRun ?? false,
  };
}

function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function syntheticTrade(args: {
  tradeId: string;
  currency?: string;
  venue?: string;
  asOf?: string;
}): Event {
  return makeEquityTradeBooked({
    asOf: args.asOf ?? "2026-05-09T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: SOURCE_ACTOR,
    citations: [...TRADE_CITATIONS],
    payload: {
      tradeId: { scheme: "INTERNAL", value: args.tradeId },
      instrument: {
        identifier: { scheme: "ISIN", value: "ZAE000000001" },
        class: "listed-equity",
        venue: args.venue ?? "JSE",
        currency: args.currency ?? "ZAR",
      },
      side: "buy",
      quantity: { unit: "share", amount: 1000 },
      price: { currency: args.currency ?? "ZAR", amount: 250.0 },
      consideration: { currency: args.currency ?? "ZAR", amountMinor: 25_000_000 },
      tradeDate: { iso: "2026-05-09", calendar: "JIHCAL" },
      settlementDate: { iso: "2026-05-13", calendar: "JIHCAL" },
      counterparty: {
        partyId: "LEI-CTPY-TEST",
        name: "Test counterparty",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: args.venue ?? "JSE",
      trader: "TRADER-TEST",
      bookId: "BOOK-TEST-EQ",
    },
  });
}

function countClassificationsFor(tradeId: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type: "IfrsClassificationApplied" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string" && p.tradeId === tradeId) n += 1;
  }
  return n;
}

function latestClassificationFor(tradeId: string): Event | undefined {
  let latest: Event | undefined;
  for (const e of eventStore.replay({ type: "IfrsClassificationApplied" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string" && p.tradeId === tradeId) latest = e;
  }
  return latest;
}

function countPostingsFor(tradeId: string, postingType: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as { tradeId?: unknown; postingType?: unknown };
    if (
      typeof p.tradeId === "string" &&
      p.tradeId === tradeId &&
      typeof p.postingType === "string" &&
      p.postingType === postingType
    ) {
      n += 1;
    }
  }
  return n;
}

// --------------------------------------------------------------------------
// Pure-function tests — `classifyEquityTrade`
// --------------------------------------------------------------------------

describe("bea M1 IFRS — classifyEquityTrade pure logic", () => {
  it("trading book + JSE-listed ZAR equity → FVTPL / L1 / no-FX", () => {
    const d = classifyEquityTrade({
      tradeId: { scheme: "INTERNAL", value: "x" },
      instrument: {
        identifier: { scheme: "ISIN", value: "ZAE000000001" },
        class: "listed-equity",
        venue: "JSE",
        currency: "ZAR",
      },
      side: "buy",
      venue: "JSE",
      bookId: "B",
    });
    expect(d.category).toBe("FVTPL");
    expect(d.hierarchyLevel).toBe("L1");
    expect(d.fxRevaluationRequired).toBe(false);
    expect(d.businessModel).toBe("trading");
    expect(d.sppiPass).toBe(false);
    expect(d.citations).toContain("IFRS-9-§4.1.1");
    expect(d.citations).toContain("IFRS-13-§72-90");
    expect(d.citations).toContain("ORG-AC-01");
    expect(d.citations).toContain("ORG-AC-05");
  });

  it("FVOCI election → FVOCI category + IFRS-9 §5.7.5 citation", () => {
    const d = classifyEquityTrade({
      tradeId: { scheme: "INTERNAL", value: "x" },
      instrument: {
        identifier: { scheme: "ISIN", value: "ZAE000000001" },
        class: "listed-equity",
        venue: "JSE",
        currency: "ZAR",
      },
      side: "buy",
      venue: "JSE",
      bookId: "B",
      businessModelOverride: "fvoci-election",
    });
    expect(d.category).toBe("FVOCI");
    expect(d.citations).toContain("IFRS-9-§5.7.5");
  });

  it("thin-trading flag → L2 fallback", () => {
    const d = classifyEquityTrade({
      tradeId: { scheme: "INTERNAL", value: "x" },
      instrument: {
        identifier: { scheme: "ISIN", value: "ZAE000000099" },
        class: "listed-equity",
        venue: "JSE",
        currency: "ZAR",
      },
      side: "buy",
      venue: "JSE",
      bookId: "B",
      thinTradingFlag: true,
    });
    expect(d.hierarchyLevel).toBe("L2");
  });

  it("non-JSE venue → L2 fallback", () => {
    const d = classifyEquityTrade({
      tradeId: { scheme: "INTERNAL", value: "x" },
      instrument: {
        identifier: { scheme: "ISIN", value: "US0378331005" },
        class: "listed-equity",
        venue: "OTC",
        currency: "USD",
      },
      side: "buy",
      venue: "OTC",
      bookId: "B",
    });
    expect(d.hierarchyLevel).toBe("L2");
  });

  it("non-functional currency → fxRevaluationRequired + IAS-21 citation", () => {
    const d = classifyEquityTrade({
      tradeId: { scheme: "INTERNAL", value: "x" },
      instrument: {
        identifier: { scheme: "ISIN", value: "US0378331005" },
        class: "listed-equity",
        venue: "JSE",
        currency: "USD",
      },
      side: "buy",
      venue: "JSE",
      bookId: "B",
    });
    expect(d.fxRevaluationRequired).toBe(true);
    expect(d.citations).toContain("IAS-21-§23");
  });
});

// --------------------------------------------------------------------------
// Handler integration tests
// --------------------------------------------------------------------------

describe("runtime — bea:m1-ifrs-classification-rules", () => {
  it("clean no-op when triggering set is empty", async () => {
    const ctx = makeContext({ triggeringEvents: [] });
    try {
      const result = await beaM1IfrsClassificationRules(ctx);
      expect(result.ok).toBe(true);
      expect(result.eventsEmitted).toBe(0);
      expect(result.summary).toMatch(/no subscribed events/);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });

  it("emits IfrsClassificationApplied + SubLedgerPostingEmitted per EquityTradeBooked", async () => {
    const tradeId = uniq("trd-ifrs");
    const trade = syntheticTrade({ tradeId });
    eventStore.append(trade);

    const ctx = makeContext({ triggeringEvents: [trade] });
    try {
      const result = await beaM1IfrsClassificationRules(ctx);
      expect(result.ok).toBe(true);
      // 1 classification + 1 trade-date posting.
      expect(result.eventsEmitted).toBe(2);
      expect(result.deliverable).toMatch(/_bea_m1-ifrs-classification-rules\.md$/);

      expect(countClassificationsFor(tradeId)).toBe(1);
      expect(countPostingsFor(tradeId, "trade-date-booking")).toBe(1);

      const cls = latestClassificationFor(tradeId);
      expect(cls).toBeDefined();
      expect(cls?.actor.id).toBe("agent:bea:m1-ifrs-classification-rules");
      const payload = cls?.payload as {
        tradeId: string;
        category: string;
        hierarchyLevel: string;
        sppiPass: boolean;
        businessModel: string;
        ruleCitations: readonly string[];
        sourceEventId: string;
      };
      expect(payload.tradeId).toBe(tradeId);
      expect(payload.category).toBe("FVTPL");
      expect(payload.hierarchyLevel).toBe("L1");
      expect(payload.sppiPass).toBe(false);
      expect(payload.businessModel).toBe("trading");
      expect(payload.sourceEventId).toBe(trade.event_id);

      // Top-level citations on the event envelope (Principle 2).
      expect(cls?.citations).toContain("IFRS-9-§4.1.1");
      expect(cls?.citations).toContain("IFRS-13-§72-90");
      expect(cls?.citations).toContain("ORG-AC-01");
      expect(cls?.citations).toContain("ORG-AC-05");
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });

  it("is idempotent — re-firing with same trade does not re-emit", async () => {
    const tradeId = uniq("trd-idem");
    const trade = syntheticTrade({ tradeId });
    eventStore.append(trade);

    const ctx1 = makeContext({ triggeringEvents: [trade] });
    try {
      const r1 = await beaM1IfrsClassificationRules(ctx1);
      expect(r1.eventsEmitted).toBe(2);
    } finally {
      rmSync(ctx1.ownerInboxDir, { recursive: true, force: true });
    }

    expect(countClassificationsFor(tradeId)).toBe(1);
    expect(countPostingsFor(tradeId, "trade-date-booking")).toBe(1);

    const ctx2 = makeContext({
      triggeringEvents: [trade],
      asOf: "2026-05-09T01:00:00.000Z",
    });
    try {
      const r2 = await beaM1IfrsClassificationRules(ctx2);
      // Both classification and posting are idempotent — no new events.
      expect(r2.eventsEmitted).toBe(0);
    } finally {
      rmSync(ctx2.ownerInboxDir, { recursive: true, force: true });
    }

    expect(countClassificationsFor(tradeId)).toBe(1);
    expect(countPostingsFor(tradeId, "trade-date-booking")).toBe(1);
  });

  it("emits settlement-confirmation posting on EquitySettlementInstructed", async () => {
    const tradeId = uniq("trd-settle");
    const settle = makeEquitySettlementInstructed({
      asOf: "2026-05-13T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: SOURCE_ACTOR,
      citations: ["ISDA-CDM"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        settlementId: { scheme: "INTERNAL", value: `${tradeId}-S` },
        netCash: { currency: "ZAR", amountMinor: -25_000_000 }, // pay (buy)
        netQuantity: { unit: "share", amount: 1000 },
        settlementDate: { iso: "2026-05-13", calendar: "JIHCAL" },
        settlementVenue: "STRATE",
        counterparty: {
          partyId: "LEI-CTPY-TEST",
          name: "Test counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
      },
    });
    eventStore.append(settle);

    const ctx = makeContext({
      triggeringEvents: [settle],
      asOf: "2026-05-13T00:00:00.500Z",
    });
    try {
      const r = await beaM1IfrsClassificationRules(ctx);
      expect(r.ok).toBe(true);
      expect(r.eventsEmitted).toBe(1);
      expect(countPostingsFor(tradeId, "settlement-confirmation")).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });

  it("counts lifecycle anchors but does not emit per-event for them", async () => {
    // D-DECISIONS-FRAMEWORK-REDESIGN Slice C: migrated from raw CeoDecision
    // construction to makeDecision with the unified Decision payload.
    const ceoDecision: Event = makeDecision({
      asOf: "2026-05-07T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      eventId: newEventId(),
      payload: {
        decisionId: "D-MARKETS-SCHEMA-FOUNDATION",
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: "Markets schema foundation approval",
        category: "governance",
        recommendation: "Approved.",
        rationale: "Lifecycle anchor test fixture.",
        sourceDocHashes: [],
        citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        recordedVia: "authoring-ui",
      },
    });
    const cdmRefresh: Event = makeCdmBindingsRegenerated({
      asOf: "2026-05-09T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:kai:m1-cdm-typescript-bindings" },
      citations: ["ISDA-CDM"],
      payload: {
        primitiveCount: 6,
        equityEventTypeCount: 3,
        registeredEventTypes: [
          "EquityTradeBooked",
          "EquityCorporateActionApplied",
          "EquitySettlementInstructed",
        ],
        selfTestPassed: true,
        runTrigger: "test:bea-m1-ifrs-classification",
      },
    });
    const ctx = makeContext({ triggeringEvents: [ceoDecision, cdmRefresh] });
    try {
      const r = await beaM1IfrsClassificationRules(ctx);
      expect(r.ok).toBe(true);
      expect(r.eventsEmitted).toBe(0);
      expect(r.summary).toMatch(/2 lifecycle anchors/);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });

  it("dry-run mode does not append events", async () => {
    const tradeId = uniq("trd-dry");
    const trade = syntheticTrade({ tradeId });
    // Do NOT append the source trade — dry-run only consults triggeringEvents.

    const ctx = makeContext({ triggeringEvents: [trade], dryRun: true });
    try {
      const r = await beaM1IfrsClassificationRules(ctx);
      expect(r.ok).toBe(true);
      expect(r.eventsEmitted).toBe(0);
      expect(r.deliverable).toBeUndefined();
      expect(countClassificationsFor(tradeId)).toBe(0);
      expect(countPostingsFor(tradeId, "trade-date-booking")).toBe(0);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });

  it("FX-revaluation flag set when instrument currency != ZAR", async () => {
    const tradeId = uniq("trd-fx");
    const trade = syntheticTrade({ tradeId, currency: "USD", venue: "JSE" });
    eventStore.append(trade);

    const ctx = makeContext({ triggeringEvents: [trade] });
    try {
      const r = await beaM1IfrsClassificationRules(ctx);
      expect(r.ok).toBe(true);
      const cls = latestClassificationFor(tradeId);
      const payload = cls?.payload as { fxRevaluationRequired: boolean };
      expect(payload.fxRevaluationRequired).toBe(true);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});
