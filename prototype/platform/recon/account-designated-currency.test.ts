// platform/recon/account-designated-currency.test.ts
//
// Tests for recon:account-designated-currency
// (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK). The reconstructed default-to-USD
// defect shape MUST fail the gate; the post-re-book live shape MUST be green.
// Author: Bea (GL engineer, accounting).

import { describe, expect, it } from "bun:test";

import type { Event } from "../event-store/types";
import { EFFECTIVE_FROM, REBOOK_POSTING_TYPE, main } from "./account-designated-currency";

function posting(
  eventId: string,
  postingType: string,
  postedAt: string,
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
    as_of: postedAt,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: [],
    payload: { postingType, legs, postedAt, ...extra },
    provenance: { kind: "simulated", scenario: "pre-substrate-build-phase" },
  } as unknown as Event;
}

function manualJournal(
  eventId: string,
  postedAt: string,
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
    as_of: postedAt,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test:mje" },
    citations: [],
    payload: { journalId: "TEST-MJE", legs, postedAt },
    provenance: { kind: "simulated" },
  } as unknown as Event;
}

/** Reconstructed default-to-USD defect: a GBP principal-settlement leg booked
 *  into the USD-designated nostro ACC-1200-002 (the live shape until
 *  2026-06-08; fixed by D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS PR #1101). */
const DEFECT_AT = "2026-06-04T06:51:50.000Z"; // inside the historical window
function defaultToUsdDefect(eventId = "defect-1", amountMinor = 168715899): Event {
  return posting(eventId, "fx-principal-payment", DEFECT_AT, [
    { accountId: "ACC-1200-002", debitCredit: "credit", amountMinor, currency: "GBP" },
    { accountId: "ACC-2100-010", debitCredit: "debit", amountMinor, currency: "GBP" },
  ]);
}

/** The corrective re-book the remediation script emits for that defect. */
function rebookCorrection(eventId = "rebook-1", amountMinor = 168715899): Event {
  return posting(
    eventId,
    REBOOK_POSTING_TYPE,
    DEFECT_AT, // timestamp-aligned to the corrected legs
    [
      { accountId: "ACC-1200-002", debitCredit: "debit", amountMinor, currency: "GBP" },
      { accountId: "ACC-1200-004", debitCredit: "credit", amountMinor, currency: "GBP" },
    ],
    { rebookKey: "D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK:ACC-1200-002:GBP" },
  );
}

describe("recon:account-designated-currency", () => {
  it("FAILS on the reconstructed default-to-USD posting (uncompensated residual)", () => {
    const { violations } = main({ events: [defaultToUsdDefect()] });
    expect(violations.length).toBe(1);
    expect(violations[0]?.subject).toBe("ACC-1200-002:GBP");
    expect(violations[0]?.message).toContain("designated USD");
    expect(violations[0]?.message).toContain("UNCOMPENSATED");
  });

  it("is GREEN on the post-re-book live shape (defect + correction net to zero)", () => {
    const { violations, asserted } = main({
      events: [defaultToUsdDefect(), rebookCorrection()],
    });
    expect(violations).toEqual([]);
    expect(asserted).toBeGreaterThan(0);
  });

  it("treats a CFO manual-journal compensation as fixed history (FXRECON-LEGACY shape)", () => {
    const events = [
      posting("defect-tb", "trade-booking", "2026-06-05T10:20:52.000Z", [
        { accountId: "ACC-2100-002", debitCredit: "credit", amountMinor: 7_000, currency: "AUD" },
        { accountId: "ACC-2100-019", debitCredit: "debit", amountMinor: 7_000, currency: "AUD" },
      ]),
      manualJournal("mje-recon", "2026-06-07T06:33:16.419Z", [
        { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: 7_000, currency: "AUD" },
        { accountId: "ACC-2100-019", debitCredit: "credit", amountMinor: 7_000, currency: "AUD" },
      ]),
    ];
    expect(main({ events }).violations).toEqual([]);
  });

  it("flags a FRESH post-decision mismatched leg even when netted to zero (live ratchet)", () => {
    const after = "2026-06-12T00:00:00.000Z";
    expect(after > EFFECTIVE_FROM).toBe(true);
    const events = [
      posting("fresh-defect", "fx-principal-payment", after, [
        { accountId: "ACC-1200-002", debitCredit: "credit", amountMinor: 999, currency: "GBP" },
        { accountId: "ACC-1200-004", debitCredit: "debit", amountMinor: 999, currency: "GBP" },
      ]),
      // a same-day compensation zeroes the balance — the fresh booking is STILL a violation
      posting("fresh-comp", "cancellation-reversal", after, [
        { accountId: "ACC-1200-002", debitCredit: "debit", amountMinor: 999, currency: "GBP" },
        { accountId: "ACC-1200-004", debitCredit: "credit", amountMinor: 999, currency: "GBP" },
      ]),
    ];
    const { violations } = main({ events });
    // both fresh mismatched legs trip rule A; the netted residual (rule B) does not
    expect(violations.length).toBe(2);
    for (const v of violations) {
      expect(v.message).toContain("after D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK");
    }
  });

  it("exempts the designated-currency-rebook corrective posting from the live ratchet", () => {
    const after = "2026-06-12T00:00:00.000Z";
    const events = [
      defaultToUsdDefect(),
      posting(
        "late-rebook",
        REBOOK_POSTING_TYPE,
        after, // even a wall-clock-dated re-book is not a rule-A violation
        [
          {
            accountId: "ACC-1200-002",
            debitCredit: "debit",
            amountMinor: 168715899,
            currency: "GBP",
          },
          {
            accountId: "ACC-1200-004",
            debitCredit: "credit",
            amountMinor: 168715899,
            currency: "GBP",
          },
        ],
      ),
    ];
    expect(main({ events }).violations).toEqual([]);
  });

  it("exempts registry-declared multi-currency accounts via the currency field itself", () => {
    const events = [
      // suspense (ACC-2100-007), NOP memoranda (ACC-9000-*) and the build-phase
      // write-off (ACC-2105-001) OMIT `currency` in coa-registry.ts → any leg
      // currency is legitimate there.
      posting("suspense-leg", "fx-principal-payment", DEFECT_AT, [
        { accountId: "ACC-2100-007", debitCredit: "debit", amountMinor: 123, currency: "GBP" },
        { accountId: "ACC-2100-010", debitCredit: "credit", amountMinor: 123, currency: "GBP" },
      ]),
      posting("nop-leg", "trade-booking", DEFECT_AT, [
        { accountId: "ACC-9000-001", debitCredit: "debit", amountMinor: 456, currency: "CHF" },
        { accountId: "ACC-9000-002", debitCredit: "credit", amountMinor: 456, currency: "CHF" },
      ]),
      manualJournal("writeoff", "2026-06-07T07:07:43.925Z", [
        { accountId: "ACC-2105-001", debitCredit: "debit", amountMinor: 789, currency: "JPY" },
        { accountId: "ACC-2100-009", debitCredit: "credit", amountMinor: 789, currency: "JPY" },
      ]),
    ];
    expect(main({ events }).violations).toEqual([]);
  });

  it("is green on an empty store", () => {
    expect(main({ events: [] }).violations).toEqual([]);
  });
});
