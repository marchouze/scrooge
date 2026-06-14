// platform/accounting/fx-subledger-writeoff.test.ts
//
// Tests for the FX sub-ledger build-phase residue write-off engine.
// Authority: D-FX-SUBLEDGER-WRITEOFF-CFO (CFO authority — Bea, 2026-06-07).
// Author: Bea (Chief Financial Officer, governance).

import { describe, expect, it } from "bun:test";

import { amountToMinorUnits } from "../core/decimal-money";
import { makeSubLedgerPostingEmitted } from "../event-store/event-types/fx-accounting";
import { simulatedTag } from "../event-store/provenance";
import type { Event } from "../event-store/types";
import { type SubLedgerLeg, subLedgerLegFromMinor } from "./fx-accounting-types";
import { FX_WRITEOFF_ACCOUNT, computeFxSubledgerWriteoff } from "./fx-subledger-writeoff";

const ENTITY = "LE-ZA-HOZ-BANK";
const PROV = simulatedTag({ scenario: "test", sourceLineage: "fx-writeoff-test" });
const NOW = "2026-06-07T12:00:00.000Z";
const SUSPENSE = "ACC-2100-009";

function leg(
  accountId: string,
  dc: "debit" | "credit",
  amountMinor: number,
  currency: string,
): SubLedgerLeg {
  return subLedgerLegFromMinor({ accountId, debitCredit: dc, currency }, amountMinor);
}

/** A balanced posting that lands `legs` on the GL (contra outside ACC-2100). */
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

/** Park `net` minor units (Dr positive) in ACC-2100-009 for `currency`. */
function parkResidue(id: string, currency: string, net: number): Event {
  const amount = Math.abs(net);
  return net > 0
    ? posting(id, [
        leg(SUSPENSE, "debit", amount, currency),
        leg("ACC-1100-001", "credit", amount, currency),
      ])
    : posting(id, [
        leg(SUSPENSE, "credit", amount, currency),
        leg("ACC-1100-001", "debit", amount, currency),
      ]);
}

describe("computeFxSubledgerWriteoff", () => {
  it("returns no legs on an empty store", () => {
    const r = computeFxSubledgerWriteoff([], NOW);
    expect(r.clearingLegs).toEqual([]);
    expect(r.suspenseBefore).toEqual([]);
  });

  it("returns no legs when ACC-2100-009 already nets to zero", () => {
    // Equal debit + credit in the same currency nets to zero ⇒ nothing to clear.
    const events = [parkResidue("p1", "ZAR", 100_00), parkResidue("p2", "ZAR", -100_00)];
    const r = computeFxSubledgerWriteoff(events, NOW);
    expect(r.clearingLegs).toEqual([]);
    expect(r.suspenseBefore).toEqual([]);
  });

  it("clears a net-debit residue to the write-off account, balanced per currency", () => {
    const events = [parkResidue("p1", "ZAR", 23_964_482_81)];
    const r = computeFxSubledgerWriteoff(events, NOW);
    expect(r.clearingLegs).toHaveLength(2);
    const susp = r.clearingLegs.find((l) => l.accountId === SUSPENSE);
    const wo = r.clearingLegs.find((l) => l.accountId === FX_WRITEOFF_ACCOUNT);
    // Net debit → credit out of suspense, debit the write-off P&L.
    expect(susp).toEqual(leg(SUSPENSE, "credit", 23_964_482_81, "ZAR"));
    expect(wo).toEqual(leg(FX_WRITEOFF_ACCOUNT, "debit", 23_964_482_81, "ZAR"));
  });

  it("clears a net-credit residue with the opposite sign", () => {
    const events = [parkResidue("p1", "CHF", -3_317_990_70)];
    const r = computeFxSubledgerWriteoff(events, NOW);
    const susp = r.clearingLegs.find((l) => l.accountId === SUSPENSE);
    const wo = r.clearingLegs.find((l) => l.accountId === FX_WRITEOFF_ACCOUNT);
    // Net credit → debit into suspense, credit the write-off P&L.
    expect(susp).toEqual(leg(SUSPENSE, "debit", 3_317_990_70, "CHF"));
    expect(wo).toEqual(leg(FX_WRITEOFF_ACCOUNT, "credit", 3_317_990_70, "CHF"));
  });

  it("emits a balanced 2-leg pair per non-zero currency and is per-currency balanced", () => {
    const events = [
      parkResidue("chf", "CHF", -3_317_990_70),
      parkResidue("gbp", "GBP", 1_687_158_99),
      parkResidue("jpy", "JPY", 13_832_311_43),
      parkResidue("usd", "USD", 416_557_66),
      parkResidue("zar", "ZAR", 23_964_482_81),
    ];
    const r = computeFxSubledgerWriteoff(events, NOW);
    // 5 currencies × 2 legs.
    expect(r.clearingLegs).toHaveLength(10);
    expect(r.suspenseBefore).toHaveLength(5);

    // Each currency's debits equal its credits (ManualJournalEntry balance gate).
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const l of r.clearingLegs) {
      const t = totals.get(l.currency) ?? { debit: 0, credit: 0 };
      const minor = Number(amountToMinorUnits(l.amount));
      if (l.debitCredit === "debit") t.debit += minor;
      else t.credit += minor;
      totals.set(l.currency, t);
    }
    for (const [, t] of totals) {
      expect(t.debit).toBe(t.credit);
    }
  });
});
