// platform/recon/fx-subledger-reconciliation.test.ts
//
// Tests for the recon:fx-subledger-reconciliation pipeline.
// Authority: D-FX-SUBLEDGER-LEGACY-RECONCILIATION (CEO session-delegation
//   2026-06-07).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { type SubLedgerLeg, subLedgerLegFromMinor } from "../accounting/fx-accounting-types";
import {
  makeFxTradeCancelled,
  makeSubLedgerPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import { simulatedTag } from "../event-store/provenance";
import type { Event } from "../event-store/types";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import { run } from "./fx-subledger-reconciliation";

const ENTITY = "LE-ZA-HOZ-BANK";
const PROV = simulatedTag({ scenario: "recon-test", sourceLineage: "fx-legacy-recon-test" });
const NOW = "2026-06-07T12:00:00.000Z";

function tradeEvent(tradeId: string): Event {
  const e = makeFxTradeExecuted({
    asOf: "2026-06-01T08:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "trader:test" },
    citations: ["Principles/1-events-are-truth.md"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "GBP", quote: "USD" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "USD",
          receiveCurrency: "GBP",
          notional: { currency: "USD", amountMinor: 50_439_279 },
          counterNotional: { currency: "GBP", amountMinor: 38_135_709 },
          rate: { currency: "USD", amount: 1.3225 },
          settlementDate: { iso: "2026-06-03", calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: "2026-06-01", calendar: "JIHCAL" },
      counterparty: {
        partyId: "urn:party:legal-entity:standard-bank-za",
        name: "Standard Bank ZA",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: "trader:test",
      bookId: "BOOK-FX-MARKETS-LP",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      finsurvCategory: "ODP-001",
      clientFlowRef: "test:flow",
    },
  });
  return { ...e, provenance: PROV };
}

function cancelEvent(tradeId: string, originalEventId: string): Event {
  const e = makeFxTradeCancelled({
    asOf: "2026-06-02T08:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:trader:test" },
    citations: ["[citation: TBC]"],
    payload: { tradeId, reason: "test", cancelledBy: "agent:trader:test", originalEventId },
  });
  return { ...e, provenance: PROV };
}

function posting(sourceEventId: string, legs: SubLedgerLeg[]): Event {
  const e = makeSubLedgerPostingEmitted({
    asOf: NOW,
    entity: ENTITY,
    actor: { type: "service", id: "agent:bea:posting-engine" },
    citations: ["Principles/1-events-are-truth.md"],
    payload: { sourceEventId, postingType: "settlement" as never, legs, postedAt: NOW },
  });
  return { ...e, provenance: PROV };
}

function leg(
  accountId: string,
  dc: "debit" | "credit",
  amountMinor: number,
  currency: string,
): SubLedgerLeg {
  return subLedgerLegFromMinor({ accountId, debitCredit: dc, currency }, amountMinor);
}

function writeoffDecision(phase: "requested" | "approved"): Event {
  return {
    event_id: `dec-${phase}`,
    type: "Decision",
    as_of: NOW,
    entity: ENTITY,
    actor: { type: "human", id: "agent:bea:cfo" },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    payload: { decisionId: "D-FX-SUBLEDGER-WRITEOFF-CFO", phase, authority: "CFO" },
  } as unknown as Event;
}

describe("recon:fx-subledger-reconciliation", () => {
  it("passes vacuously on an empty store", () => {
    const r = run({ events: [], asOf: NOW });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.asserted).toBeGreaterThanOrEqual(1);
  });

  it("FAILs when orphaned legacy gross remains on the trading accounts", () => {
    // A cancelled trade left a one-sided ZAR residual on ACC-2100-001 (contra
    // outside ACC-2100) with NO closing journal posted and no CFO decision.
    const t = tradeEvent("CANCELLED-1");
    const c = cancelEvent("CANCELLED-1", t.event_id);
    const p = posting(c.event_id, [
      leg("ACC-2100-001", "debit", 75_00, "ZAR"),
      leg("ACC-1100-001", "credit", 75_00, "ZAR"),
    ]);
    const r = run({ events: [t, c, p], asOf: NOW });
    expect(r.ok).toBe(false);
    // Both the orphaned-gross FAIL and the no-backing-decision FAIL fire.
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.subject === "ACC-2100-001|ZAR")).toBe(true);
  });

  it("WARNs (not FAIL) when residue is backed by a requested CFO decision and gross is retired", () => {
    // Same residue, but the trading account is already cleared into suspense via
    // a posted closing journal AND a requested CFO write-off decision exists.
    // Model the post-reconciliation state directly: ACC-2100-009 holds the
    // residue (one-sided), no ACC-2100 trading account carries gross.
    const t = tradeEvent("CANCELLED-2");
    const c = cancelEvent("CANCELLED-2", t.event_id);
    // Residue sits in suspense (009) only; contra outside ACC-2100.
    const p = posting(c.event_id, [
      leg("ACC-2100-009", "debit", 75_00, "ZAR"),
      leg("ACC-1100-001", "credit", 75_00, "ZAR"),
    ]);
    const r = run({ events: [t, c, p, writeoffDecision("requested")], asOf: NOW });
    // No orphaned trading-account gross (009 is suspense, excluded), residue
    // backed by a requested decision ⇒ WARN, not FAIL ⇒ ok.
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("FAILs when residue persists AFTER the CFO write-off was approved", () => {
    // The CFO approved the write-off but the clearing journal never posted, so
    // ACC-2100-009 still carries the residue. An authorised-but-unexecuted
    // write-off leaves the GL un-hygienic ⇒ FAIL (not a silent pass).
    const t = tradeEvent("CANCELLED-3");
    const c = cancelEvent("CANCELLED-3", t.event_id);
    const p = posting(c.event_id, [
      leg("ACC-2100-009", "debit", 75_00, "ZAR"),
      leg("ACC-1100-001", "credit", 75_00, "ZAR"),
    ]);
    const r = run({ events: [t, c, p, writeoffDecision("approved")], asOf: NOW });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "ACC-2100-009" && v.severity === "fail")).toBe(
      true,
    );
  });

  it("PASSes (clean) when the suspense nets to zero after the write-off cleared", () => {
    // The clearing journal posted: ACC-2100-009 holds a balanced debit+credit in
    // the currency, netting to zero, AND the CFO write-off is approved. No
    // residue, no orphaned gross ⇒ clean pass, no violations.
    const t = tradeEvent("CANCELLED-4");
    const c = cancelEvent("CANCELLED-4", t.event_id);
    const parked = posting(c.event_id, [
      leg("ACC-2100-009", "debit", 75_00, "ZAR"),
      leg("ACC-1100-001", "credit", 75_00, "ZAR"),
    ]);
    // Clearing journal: credit 009 back out to the dedicated write-off P&L line
    // (ACC-2105-001, outside the ACC-2100-* trading range the legacy engine scans).
    const cleared = posting(`${c.event_id}-clear`, [
      leg("ACC-2100-009", "credit", 75_00, "ZAR"),
      leg("ACC-2105-001", "debit", 75_00, "ZAR"),
    ]);
    const r = run({
      events: [t, c, parked, cleared, writeoffDecision("approved")],
      asOf: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });
});
