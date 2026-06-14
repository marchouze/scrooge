// scripts/rebook-usd-designated-account-residuals.test.ts
//
// Tests for the USD-designated-account cross-currency residual re-book
// (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK). Pure helpers + injected-events
// runner only — no store mutation.
// Author: Bea (GL engineer, accounting).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import { amountToMinorUnits } from "../platform/core/decimal-money";
import type { Event } from "../platform/event-store/types";

function legMinor(l: SubLedgerLeg): number {
  return Number(amountToMinorUnits(l.amount));
}
import {
  REBOOK_POSTING_TYPE,
  buildRebookEvent,
  existingRebookKeysFrom,
  rebookKeyFor,
  resolveTargetAccount,
  runRebook,
} from "./rebook-usd-designated-account-residuals";

function posting(
  eventId: string,
  postingType: string,
  legs: Array<{
    accountId: string;
    debitCredit: "debit" | "credit";
    amountMinor: number;
    currency: string;
  }>,
  extra: Record<string, unknown> = {},
): Event {
  return {
    event_id: eventId,
    type: "SubLedgerPostingEmitted",
    as_of: "2026-06-04T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: [],
    payload: { postingType, legs, postedAt: "2026-06-04T00:00:00.000Z", ...extra },
    provenance: { kind: "simulated", scenario: "pre-substrate-build-phase" },
  } as unknown as Event;
}

function manualJournal(
  eventId: string,
  legs: Array<{
    accountId: string;
    debitCredit: "debit" | "credit";
    amountMinor: number;
    currency: string;
  }>,
): Event {
  return {
    event_id: eventId,
    type: "ManualJournalEntry",
    as_of: "2026-06-07T06:33:16.419Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test:mje" },
    citations: [],
    payload: { journalId: "TEST-MJE", legs, postedAt: "2026-06-07T06:33:16.419Z" },
    provenance: { kind: "simulated" },
  } as unknown as Event;
}

/** The historical defect shape: a GBP principal-settlement leg booked into the
 *  USD-designated nostro ACC-1200-002 (default-to-USD resolution defect). */
function contaminatedNostro(eventId = "defect-1", amountMinor = 168715899): Event {
  return posting(eventId, "fx-principal-payment", [
    { accountId: "ACC-1200-002", debitCredit: "credit", amountMinor, currency: "GBP" },
    { accountId: "ACC-2100-010", debitCredit: "debit", amountMinor, currency: "GBP" },
  ]);
}

describe("resolveTargetAccount", () => {
  it("resolves the per-currency home from the registry by (name, category, currency)", () => {
    expect(resolveTargetAccount("ACC-1200-002", "GBP")).toBe("ACC-1200-004");
    expect(resolveTargetAccount("ACC-1200-002", "JPY")).toBe("ACC-1200-005");
    expect(resolveTargetAccount("ACC-1200-002", "CHF")).toBe("ACC-1200-006");
    expect(resolveTargetAccount("ACC-1200-002", "EUR")).toBe("ACC-1200-003");
    expect(resolveTargetAccount("ACC-1200-002", "AUD")).toBe("ACC-1200-007");
    expect(resolveTargetAccount("ACC-2100-002", "GBP")).toBe("ACC-2100-010");
    expect(resolveTargetAccount("ACC-2100-002", "AUD")).toBe("ACC-2100-019");
    expect(resolveTargetAccount("ACC-2100-004", "GBP")).toBe("ACC-2100-011");
    expect(resolveTargetAccount("ACC-2100-004", "JPY")).toBe("ACC-2100-023");
  });

  it("throws (never silently drops) when no per-currency home exists", () => {
    expect(() => resolveTargetAccount("ACC-1200-002", "XXX")).toThrow(/suspense/);
  });

  it("throws for an account with no logical-account mapping", () => {
    expect(() => resolveTargetAccount("ACC-2100-001", "GBP")).toThrow(/LOGICAL_BY_ACCOUNT/);
  });
});

describe("runRebook (injected events)", () => {
  it("re-books an uncompensated foreign-currency residual out of the USD nostro", () => {
    const result = runRebook({ apply: false, events: [contaminatedNostro()] });
    expect(result.emitted).toBe(1);
    const item = result.plan[0];
    expect(item?.residual.accountId).toBe("ACC-1200-002");
    expect(item?.residual.currency).toBe("GBP");
    expect(item?.residual.netMinor).toBe(-168715899);
    expect(item?.targetAccountId).toBe("ACC-1200-004");

    const payload = item?.event.payload as {
      postingType: string;
      rebookKey: string;
      postedAt: string;
      legs: SubLedgerLeg[];
    };
    expect(payload.postingType).toBe(REBOOK_POSTING_TYPE);
    expect(payload.rebookKey).toBe(rebookKeyFor("ACC-1200-002", "GBP"));
    // Net credit residual → reverse with a DEBIT on the contaminated account,
    // CREDIT into the per-currency home; balanced within GBP.
    expect(payload.legs[0]?.accountId).toBe("ACC-1200-002");
    expect(payload.legs[0]?.debitCredit).toBe("debit");
    expect(payload.legs[0] ? legMinor(payload.legs[0]) : undefined).toBe(168715899);
    expect(payload.legs[0]?.currency).toBe("GBP");
    expect(payload.legs[1]?.accountId).toBe("ACC-1200-004");
    expect(payload.legs[1]?.debitCredit).toBe("credit");
    expect(payload.legs[1] ? legMinor(payload.legs[1]) : undefined).toBe(168715899);
    // Timestamp-aligned to the contaminating leg, never wall-clock-now.
    expect(payload.postedAt).toBe("2026-06-04T00:00:00.000Z");
    // Provenance inherited from the contaminated posting (same plane).
    expect((item?.event as { provenance?: { kind?: string } }).provenance?.kind).toBe("simulated");
  });

  it("nets multiple defect legs per (account, currency) into ONE correction", () => {
    const events = [
      contaminatedNostro("defect-1", 100_000),
      // an offsetting debit leg in the same pair — net 60,000 credit
      posting("defect-2", "cancellation-reversal", [
        { accountId: "ACC-1200-002", debitCredit: "debit", amountMinor: 40_000, currency: "GBP" },
        { accountId: "ACC-2100-010", debitCredit: "credit", amountMinor: 40_000, currency: "GBP" },
      ]),
    ];
    const result = runRebook({ apply: false, events });
    expect(result.emitted).toBe(1);
    expect(result.plan[0]?.residual.netMinor).toBe(-60_000);
  });

  it("treats a residual fully compensated by a later ManualJournalEntry as fixed (re-book-aware)", () => {
    // The FXRECON-LEGACY-20260607 shape: the defect parked GBP on the USD
    // trading receivable, a later CFO-authority MJE compensated it exactly.
    const events = [
      posting("defect-tb", "trade-booking", [
        { accountId: "ACC-2100-002", debitCredit: "credit", amountMinor: 5_000, currency: "GBP" },
        { accountId: "ACC-2100-010", debitCredit: "debit", amountMinor: 5_000, currency: "GBP" },
      ]),
      manualJournal("mje-recon", [
        { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: 5_000, currency: "GBP" },
        { accountId: "ACC-2100-010", debitCredit: "credit", amountMinor: 5_000, currency: "GBP" },
      ]),
    ];
    const result = runRebook({ apply: false, events });
    expect(result.emitted).toBe(0);
    expect(result.compensatedAlready).toBe(1);
  });

  it("is idempotent: its own correction zeroes the fold, a second run emits nothing", () => {
    const first = runRebook({ apply: false, events: [contaminatedNostro()] });
    expect(first.emitted).toBe(1);
    const correction = first.plan[0]?.event as Event;
    const second = runRebook({ apply: false, events: [contaminatedNostro(), correction] });
    expect(second.emitted).toBe(0);
    expect(second.compensatedAlready).toBe(1);
  });

  it("never double-books under an existing rebookKey when NEW contamination arrives post-rebook", () => {
    const first = runRebook({ apply: false, events: [contaminatedNostro()] });
    const correction = first.plan[0]?.event as Event;
    // fresh contamination AFTER the correction landed
    const fresh = contaminatedNostro("defect-new", 777);
    const result = runRebook({ apply: false, events: [contaminatedNostro(), correction, fresh] });
    expect(result.emitted).toBe(0);
    expect(result.skippedExistingKey).toBe(1);
  });

  it("ignores accounts outside the decision scope and matching-currency legs", () => {
    const events = [
      // USD into the USD nostro — designated currency, fine.
      posting("ok-usd", "fx-principal-payment", [
        { accountId: "ACC-1200-002", debitCredit: "debit", amountMinor: 999, currency: "USD" },
        { accountId: "ACC-2100-002", debitCredit: "credit", amountMinor: 999, currency: "USD" },
      ]),
      // GBP into the GBP nostro — out of scope (not a USD-designated account).
      posting("ok-gbp", "fx-principal-payment", [
        { accountId: "ACC-1200-004", debitCredit: "debit", amountMinor: 555, currency: "GBP" },
        { accountId: "ACC-2100-010", debitCredit: "credit", amountMinor: 555, currency: "GBP" },
      ]),
    ];
    const result = runRebook({ apply: false, events });
    expect(result.emitted).toBe(0);
    expect(result.scanned).toBe(0);
  });
});

describe("buildRebookEvent / existingRebookKeysFrom", () => {
  it("round-trips the rebookKey through the emitted payload", () => {
    const result = runRebook({ apply: false, events: [contaminatedNostro()] });
    const correction = result.plan[0]?.event as Event;
    const keys = existingRebookKeysFrom([correction]);
    expect(keys.has(rebookKeyFor("ACC-1200-002", "GBP"))).toBe(true);
  });

  it("emits a schema-valid balanced posting (debits == credits per currency)", () => {
    const result = runRebook({ apply: false, events: [contaminatedNostro()] });
    const payload = result.plan[0]?.event.payload as { legs: SubLedgerLeg[] };
    const totals = new Map<string, number>();
    for (const leg of payload.legs) {
      totals.set(
        leg.currency,
        (totals.get(leg.currency) ?? 0) +
          (leg.debitCredit === "debit" ? legMinor(leg) : -legMinor(leg)),
      );
    }
    for (const [, net] of totals) expect(net).toBe(0);
  });

  it("reverses a net DEBIT residual with a credit out / debit in (CHF shape)", () => {
    const events = [
      posting("defect-chf", "fx-principal-payment", [
        {
          accountId: "ACC-1200-002",
          debitCredit: "debit",
          amountMinor: 331799070,
          currency: "CHF",
        },
        {
          accountId: "ACC-2100-016",
          debitCredit: "credit",
          amountMinor: 331799070,
          currency: "CHF",
        },
      ]),
    ];
    const result = runRebook({ apply: false, events });
    const payload = result.plan[0]?.event.payload as { legs: SubLedgerLeg[] };
    expect(result.plan[0]?.targetAccountId).toBe("ACC-1200-006");
    expect(payload.legs[0]?.accountId).toBe("ACC-1200-002");
    expect(payload.legs[0]?.debitCredit).toBe("credit");
    expect(payload.legs[0] ? legMinor(payload.legs[0]) : undefined).toBe(331799070);
    expect(payload.legs[0]?.currency).toBe("CHF");
    expect(payload.legs[1]?.accountId).toBe("ACC-1200-006");
    expect(payload.legs[1]?.debitCredit).toBe("debit");
    expect(payload.legs[1] ? legMinor(payload.legs[1]) : undefined).toBe(331799070);
  });
});
