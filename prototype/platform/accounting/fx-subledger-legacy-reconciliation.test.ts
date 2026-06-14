// platform/accounting/fx-subledger-legacy-reconciliation.test.ts
//
// Tests for the FX sub-ledger legacy-account reconciliation engine.
// Authority: D-FX-SUBLEDGER-LEGACY-RECONCILIATION (CEO session-delegation
//   2026-06-07).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { amountToMinorUnits } from "../core/decimal-money";
import {
  makeFxTradeCancelled,
  makeSubLedgerPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import { simulatedTag } from "../event-store/provenance";
import type { Event } from "../event-store/types";
import { makeFxTradeExecuted } from "../markets/cdm/fx";
import { type SubLedgerLeg, subLedgerLegFromMinor } from "./fx-accounting-types";
import { computeFxSubledgerLegacyReconciliation } from "./fx-subledger-legacy-reconciliation";

const ENTITY = "LE-ZA-HOZ-BANK";
const PROV = simulatedTag({ scenario: "test", sourceLineage: "fx-legacy-recon-test" });
const NOW = "2026-06-07T12:00:00.000Z";

/** simulated FxTradeExecuted (booking payload is well-formed for the rule sanity check). */
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

/** simulated SubLedgerPostingEmitted attributed to `sourceEventId`. */
function posting(sourceEventId: string, postingType: string, legs: SubLedgerLeg[]): Event {
  const e = makeSubLedgerPostingEmitted({
    asOf: NOW,
    entity: ENTITY,
    actor: { type: "service", id: "agent:bea:posting-engine" },
    citations: ["Principles/1-events-are-truth.md"],
    payload: { sourceEventId, postingType: postingType as never, legs, postedAt: NOW },
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

/** simulated FxTradeCancelled for `tradeId` (marks the lifecycle cancelled). */
function cancelEvent(tradeId: string, originalEventId: string): Event {
  const e = makeFxTradeCancelled({
    asOf: "2026-06-02T08:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:trader:test" },
    citations: ["[citation: TBC]"],
    payload: {
      tradeId,
      reason: "test cancellation",
      cancelledBy: "agent:trader:test",
      originalEventId,
    },
  });
  return { ...e, provenance: PROV };
}

describe("computeFxSubledgerLegacyReconciliation", () => {
  it("returns empty closing legs + no residue on an empty store", () => {
    const r = computeFxSubledgerLegacyReconciliation([], NOW);
    expect(r.closingLegs).toEqual([]);
    expect(r.suspenseResidue).toEqual([]);
    expect(r.liveTradeIds).toEqual([]);
  });

  it("relocates a live trade's GBP leg off the legacy USD-pool to ACC-2100-010/011", () => {
    // Live trade: USD legs on 002/004 (canonical), GBP legs ALSO on 002/004 (misrouted).
    const t = tradeEvent("LIVE-1");
    const p = posting(t.event_id, "trade-booking", [
      leg("ACC-2100-002", "debit", 50_439_279, "USD"),
      leg("ACC-2100-004", "credit", 50_439_279, "USD"),
      leg("ACC-2100-002", "debit", 38_135_709, "GBP"),
      leg("ACC-2100-004", "credit", 38_135_709, "GBP"),
    ]);
    const r = computeFxSubledgerLegacyReconciliation([t, p], NOW);
    expect(r.liveTradeIds).toEqual(["LIVE-1"]);
    // No residue: the live trade fully nets per currency.
    expect(r.suspenseResidue).toEqual([]);
    // GBP must move off 002/004 onto 010/011; USD untouched.
    const byKey = new Map(
      r.closingLegs.map((l) => [`${l.accountId}|${l.currency}|${l.debitCredit}`, legMinor(l)]),
    );
    expect(byKey.get("ACC-2100-002|GBP|credit")).toBe(38_135_709); // remove Dr from 002
    expect(byKey.get("ACC-2100-010|GBP|debit")).toBe(38_135_709); // add Dr to 010
    expect(byKey.get("ACC-2100-004|GBP|debit")).toBe(38_135_709); // remove Cr from 004
    expect(byKey.get("ACC-2100-011|GBP|credit")).toBe(38_135_709); // add Cr to 011
    // USD legs are already canonical → no closing leg for them.
    expect(byKey.has("ACC-2100-002|USD|debit")).toBe(false);
    expect(byKey.has("ACC-2100-004|USD|credit")).toBe(false);
    // Closing journal balances per currency.
    expectBalanced(r.closingLegs);
  });

  it("sweeps a cancelled trade's incompletely-reversed residue into ACC-2100-009", () => {
    // Cancelled trade: booking Dr/Cr 100 on legacy ZAR accounts, reversal only
    // restores 90 — 10 residue stranded. Cancelled trade ⇒ target 0 ⇒ residue
    // to suspense. (No FxTradeCancelled event needed for the residue math: a
    // trade with no live state targets 0; the residue is whatever sits on the
    // trading accounts.)
    const t = tradeEvent("CANCELLED-1");
    const c = cancelEvent("CANCELLED-1", t.event_id);
    const booking = posting(t.event_id, "trade-booking", [
      leg("ACC-2100-001", "debit", 100_00, "ZAR"),
      leg("ACC-2100-003", "credit", 100_00, "ZAR"),
    ]);
    const partialReversal = posting(c.event_id, "cancellation", [
      leg("ACC-2100-001", "credit", 90_00, "ZAR"),
      leg("ACC-2100-003", "debit", 90_00, "ZAR"),
    ]);
    const r = computeFxSubledgerLegacyReconciliation([t, c, booking, partialReversal], NOW);
    // No live trade ⇒ everything is residue.
    expect(r.liveTradeIds).toEqual([]);
    // ACC-2100-001 holds Dr 10; ACC-2100-003 holds Cr 10 → both swept to suspense.
    const byKey = new Map(
      r.closingLegs.map((l) => [`${l.accountId}|${l.currency}|${l.debitCredit}`, legMinor(l)]),
    );
    expect(byKey.get("ACC-2100-001|ZAR|credit")).toBe(10_00); // clear the Dr 10
    expect(byKey.get("ACC-2100-003|ZAR|debit")).toBe(10_00); // clear the Cr 10
    // Net ZAR delta is zero (Dr 10 removed, Cr 10 removed) ⇒ no suspense residue
    // for ZAR (it self-nets). Confirms the "fully-reversed shown gross" class.
    expect(r.suspenseResidue).toEqual([]);
    expectBalanced(r.closingLegs);
  });

  it("parks a genuine one-sided residual in suspense (write-off proposal)", () => {
    // A booking (balanced ZAR) plus a reversal that only partially restores one
    // side leaves a NET one-sided ZAR residual on the trading accounts. With no
    // live trade ⇒ target 0 ⇒ the asymmetric ZAR net is swept to suspense as a
    // write-off proposal. (Per-currency-balanced postings throughout, as the
    // SubLedgerPostingEmitted schema requires.)
    const t = tradeEvent("ORPHAN-1");
    const c = cancelEvent("ORPHAN-1", t.event_id);
    // Booking: Dr 300 ACC-2100-001 / Cr 300 ACC-2100-003 (ZAR).
    const booking = posting(t.event_id, "trade-booking", [
      leg("ACC-2100-001", "debit", 300_00, "ZAR"),
      leg("ACC-2100-003", "credit", 300_00, "ZAR"),
    ]);
    // Reversal restores only 100 on the receivable side and 100 on a DIFFERENT
    // account (ACC-2100-005), leaving the trading accounts asymmetric but the
    // ZAR currency self-netting to zero.
    const reversal = posting(c.event_id, "cancellation", [
      leg("ACC-2100-001", "credit", 100_00, "ZAR"),
      leg("ACC-2100-005", "debit", 100_00, "ZAR"),
    ]);
    const r = computeFxSubledgerLegacyReconciliation([t, c, booking, reversal], NOW);
    // Net trading-account state: 001 Dr 200, 003 Cr 300, 005 Dr 100.
    // Sum (Dr+) = 200 − 300 + 100 = 0 ⇒ ZAR self-nets ⇒ no residue, gross shown.
    const residueByCcy = new Map(r.suspenseResidue.map((s) => [s.currency, s.netDebitMinor]));
    expect(residueByCcy.size).toBe(0);
    // But closing legs DO move each account to zero (gross retired).
    const byKey = new Map(
      r.closingLegs.map((l) => [`${l.accountId}|${l.currency}|${l.debitCredit}`, legMinor(l)]),
    );
    expect(byKey.get("ACC-2100-001|ZAR|credit")).toBe(200_00);
    expect(byKey.get("ACC-2100-003|ZAR|debit")).toBe(300_00);
    expect(byKey.get("ACC-2100-005|ZAR|credit")).toBe(100_00);
    expectBalanced(r.closingLegs);
  });

  it("parks a one-sided residual (contra outside ACC-2100) in suspense as a write-off", () => {
    // The realistic orphan shape: a posting balances per currency, but its
    // CONTRA leg sits OUTSIDE the ACC-2100 trading range (here ACC-1100-001,
    // the reserve), so the trading sub-ledger carries a one-sided ZAR net that
    // does NOT self-cancel. With no live trade ⇒ target 0 ⇒ that net is the
    // write-off residue parked in suspense.
    const t = tradeEvent("ORPHAN-2");
    const c = cancelEvent("ORPHAN-2", t.event_id);
    const p = posting(c.event_id, "settlement", [
      leg("ACC-2100-001", "debit", 75_00, "ZAR"),
      leg("ACC-1100-001", "credit", 75_00, "ZAR"), // contra outside ACC-2100
    ]);
    const r = computeFxSubledgerLegacyReconciliation([t, c, p], NOW);
    const residueByCcy = new Map(r.suspenseResidue.map((s) => [s.currency, s.netDebitMinor]));
    // ACC-2100-001 Dr 75 has no ACC-2100 contra ⇒ suspense holds Dr 75 ZAR.
    expect(residueByCcy.get("ZAR")).toBe(75_00);
    const byKey = new Map(
      r.closingLegs.map((l) => [`${l.accountId}|${l.currency}|${l.debitCredit}`, legMinor(l)]),
    );
    // Clear the trading account (Cr 75) and contra into suspense (Dr 75).
    expect(byKey.get("ACC-2100-001|ZAR|credit")).toBe(75_00);
    expect(byKey.get("ACC-2100-009|ZAR|debit")).toBe(75_00);
    expectBalanced(r.closingLegs);
  });
});

/** Assert the closing journal balances (sum of signed legs) per currency. */
function expectBalanced(legs: readonly SubLedgerLeg[]): void {
  const byCcy = new Map<string, number>();
  for (const l of legs) {
    const minor = Number(amountToMinorUnits(l.amount));
    const signed = l.debitCredit === "debit" ? minor : -minor;
    byCcy.set(l.currency, (byCcy.get(l.currency) ?? 0) + signed);
  }
  for (const [, net] of byCcy) expect(net).toBe(0);
}

/** Extract minor units from a SubLedgerLeg (for test assertions). */
function legMinor(l: SubLedgerLeg): number {
  return Number(amountToMinorUnits(l.amount));
}
