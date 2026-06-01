// platform/accounting/fx-subledger-trade-reconciliation.test.ts

import { describe, expect, test } from "bun:test";
import type { Event } from "../event-store/types";
import {
  FX_MISROUTED_RESERVE,
  FX_REMEDIATION_SUSPENSE,
  computeFxMisroutedCashRestate,
  computeFxSubledgerRebuild,
  computeFxSubledgerReconciliation,
} from "./fx-subledger-trade-reconciliation";

// --- minimal event builders (pure-function engine; no schema validation) ----

let seq = 0;
function ev(type: string, payload: unknown, provenanceKind = "simulated"): Event {
  seq += 1;
  return {
    event_id: `evt-${seq}`,
    type,
    as_of: "2026-05-31T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: [],
    payload,
    provenance: { kind: provenanceKind, sourceLineage: "test" },
  } as unknown as Event;
}

/** A GBP/ZAR booking: Dr 001 ZAR / Cr 003 ZAR (zarAmt); Dr 002 GBP / Cr 004 GBP (gbpAmt). */
function booking(tradeId: string, zarMinor: number, gbpMinor: number, prov = "simulated") {
  return ev(
    "FxTradeExecuted",
    {
      tradeId: { scheme: "internal-manual", value: tradeId },
      side: "sell",
      currencyPair: { base: "GBP", quote: "ZAR" },
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "GBP",
          notional: { currency: "ZAR", amountMinor: zarMinor },
          counterNotional: { currency: "GBP", amountMinor: gbpMinor },
          rate: { currency: "ZAR", amount: zarMinor / gbpMinor },
          settlementDate: { iso: "2026-06-02", calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: "2026-05-31", calendar: "JIHCAL" },
    },
    prov,
  );
}

function bookingPosting(
  sourceEventId: string,
  zarMinor: number,
  gbpMinor: number,
  prov = "simulated",
) {
  return ev(
    "SubLedgerPostingEmitted",
    {
      sourceEventId,
      postingType: "trade-booking",
      postedAt: "2026-05-31T00:00:00.000Z",
      legs: [
        { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: zarMinor, currency: "ZAR" },
        {
          accountId: "ACC-2100-003",
          debitCredit: "credit",
          amountMinor: zarMinor,
          currency: "ZAR",
        },
        { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: gbpMinor, currency: "GBP" },
        {
          accountId: "ACC-2100-004",
          debitCredit: "credit",
          amountMinor: gbpMinor,
          currency: "GBP",
        },
      ],
    },
    prov,
  );
}

describe("computeFxSubledgerReconciliation", () => {
  test("a clean live trade needs no correction", () => {
    const b = booking("LIVE-1", 1000, 100);
    const rows = computeFxSubledgerReconciliation([b, bookingPosting(b.event_id, 1000, 100)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("live");
    expect(rows[0]?.needsCorrection).toBe(false);
  });

  test("a cancelled trade with an un-reversed booking is zeroed", () => {
    const b = booking("CANCEL-1", 1000, 100);
    const events = [
      b,
      bookingPosting(b.event_id, 1000, 100),
      ev("FxTradeCancelled", { tradeId: "CANCEL-1", reason: "test", cancelledBy: "test" }),
    ];
    const rows = computeFxSubledgerReconciliation(events);
    expect(rows[0]?.state).toBe("cancelled");
    expect(rows[0]?.needsCorrection).toBe(true);
    // correction reverses the booking: Cr 001, Dr 003, Cr 002, Dr 004
    const legs = rows[0]?.correctionLegs ?? [];
    const zar001 = legs.find((l) => l.accountId === "ACC-2100-001" && l.currency === "ZAR");
    expect(zar001?.debitCredit).toBe("credit");
    expect(zar001?.amountMinor).toBe(1000);
    // balanced per currency
    for (const ccy of ["ZAR", "GBP"]) {
      const d = legs
        .filter((l) => l.currency === ccy && l.debitCredit === "debit")
        .reduce((s, l) => s + l.amountMinor, 0);
      const c = legs
        .filter((l) => l.currency === ccy && l.debitCredit === "credit")
        .reduce((s, l) => s + l.amountMinor, 0);
      expect(d).toBe(c);
    }
  });

  test("fixture-provenance trades are out of scope (not folded into the simulated reconciliation)", () => {
    const b = booking("FIX-1", 1000, 100, "build-phase-fixture");
    const rows = computeFxSubledgerReconciliation([
      b,
      bookingPosting(b.event_id, 1000, 100, "build-phase-fixture"),
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("computeFxSubledgerRebuild", () => {
  test("restates ACC-2100 to canonical bookings and quarantines the residue, balanced per currency", () => {
    // One live trade (canonical) + one cancelled trade whose residue corrupts the book.
    const live = booking("LIVE-1", 1000, 100);
    const cancelled = booking("CANCEL-1", 5000, 500);
    const events = [
      live,
      bookingPosting(live.event_id, 1000, 100),
      cancelled,
      bookingPosting(cancelled.event_id, 5000, 500),
      ev("FxTradeCancelled", { tradeId: "CANCEL-1", reason: "test", cancelledBy: "test" }),
    ];
    // Current GL (as the projection would net it): both bookings live in the ledger.
    const current = new Map<string, number>([
      ["ACC-2100-001|ZAR", 6000],
      ["ACC-2100-003|ZAR", -6000],
      ["ACC-2100-002|GBP", 600],
      ["ACC-2100-004|GBP", -600],
      ["ACC-2100-005|ZAR", 12345], // corrupt reval residue
    ]);
    const r = computeFxSubledgerRebuild(events, current);

    // Canonical target = the LIVE booking only.
    expect(r.canonicalTradeIds).toEqual(["LIVE-1"]);
    const target = new Map(r.target.map((t) => [`${t.accountId}|${t.currency}`, t.netDebitMinor]));
    expect(target.get("ACC-2100-001|ZAR")).toBe(1000);
    expect(target.get("ACC-2100-003|ZAR")).toBe(-1000);
    expect(target.get("ACC-2100-002|GBP")).toBe(100);
    expect(target.get("ACC-2100-004|GBP")).toBe(-100);

    // Restate journal balances per currency.
    for (const ccy of ["ZAR", "GBP"]) {
      const d = r.restateLegs
        .filter((l) => l.currency === ccy && l.debitCredit === "debit")
        .reduce((s, l) => s + l.amountMinor, 0);
      const c = r.restateLegs
        .filter((l) => l.currency === ccy && l.debitCredit === "credit")
        .reduce((s, l) => s + l.amountMinor, 0);
      expect(d).toBe(c);
    }

    // Suspense absorbs the residue (current − target) per currency.
    const suspense = new Map(r.suspenseResidue.map((s) => [s.currency, s.netDebitMinor]));
    // ZAR residue on 001..006 = current(6000 + (-6000) + 12345) − target(1000 + (-1000)) = 12345
    expect(suspense.get("ZAR")).toBe(12345);
    // GBP residue = current(600 + (-600)) − target(100 + (-100)) = 0 → no GBP suspense leg
    expect(suspense.get("GBP")).toBeUndefined();

    // Suspense leg account id.
    const susLeg = r.restateLegs.find(
      (l) => l.accountId === FX_REMEDIATION_SUSPENSE && l.currency === "ZAR",
    );
    expect(susLeg?.debitCredit).toBe("debit");
    expect(susLeg?.amountMinor).toBe(12345);
  });
});

describe("computeFxMisroutedCashRestate", () => {
  function cashPosting(
    postingType: string,
    accountId: string,
    dc: "debit" | "credit",
    amt: number,
    prov = "simulated",
    oldFormat = false,
  ) {
    const leg = oldFormat
      ? dc === "credit"
        ? { debit: "ACC-stub-000", credit: accountId, amountMinor: amt, currency: "ZAR" }
        : { debit: accountId, credit: "ACC-stub-000", amountMinor: amt, currency: "ZAR" }
      : { accountId, debitCredit: dc, amountMinor: amt, currency: "ZAR" };
    return ev(
      "SubLedgerPostingEmitted",
      {
        sourceEventId: "orphan-src-not-in-store",
        postingType,
        postedAt: "2026-05-31T00:00:00.000Z",
        legs: [leg],
      },
      prov,
    );
  }

  test("sweeps new- and old-format FX residue off ACC-1100-001 to suspense, balanced", () => {
    const events = [
      cashPosting("fx-principal-payment", FX_MISROUTED_RESERVE, "credit", 1000), // new-format
      cashPosting(
        "settlement-confirmation",
        FX_MISROUTED_RESERVE,
        "credit",
        250,
        "simulated",
        true,
      ), // old-format
    ];
    const { residue, restateLegs } = computeFxMisroutedCashRestate(events);
    const zar = residue.find((r) => r.currency === "ZAR");
    expect(zar?.netDebitMinor).toBe(-1250); // both credits net to -1250
    // reserve leg debits +1250, suspense leg credits +1250 → balanced, reserve → 0
    const reserveLeg = restateLegs.find((l) => l.accountId === FX_MISROUTED_RESERVE);
    const suspenseLeg = restateLegs.find((l) => l.accountId === FX_REMEDIATION_SUSPENSE);
    // reserve holds a -1250 (credit) residue → sweep posts Dr reserve / Cr suspense.
    expect(reserveLeg?.debitCredit).toBe("debit");
    expect(reserveLeg?.amountMinor).toBe(1250);
    expect(suspenseLeg?.debitCredit).toBe("credit");
    expect(suspenseLeg?.amountMinor).toBe(1250);
  });

  test("ignores fixture-sourced postings and non-FX posting types", () => {
    const fixtureSrc = ev("SettlementConfirmed", { tradeId: "X" }, "build-phase-fixture");
    const fixtureSourcedPosting = ev(
      "SubLedgerPostingEmitted",
      {
        sourceEventId: fixtureSrc.event_id,
        postingType: "fx-principal-payment",
        legs: [
          {
            accountId: FX_MISROUTED_RESERVE,
            debitCredit: "credit",
            amountMinor: 999,
            currency: "ZAR",
          },
        ],
      },
      "simulated",
    );
    const events = [fixtureSrc, fixtureSourcedPosting];
    const { restateLegs } = computeFxMisroutedCashRestate(events);
    expect(restateLegs).toHaveLength(0);
  });
});
