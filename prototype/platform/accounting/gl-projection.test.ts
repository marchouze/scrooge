// platform/accounting/gl-projection.test.ts
//
// Unit tests for the GL projection (buildGlView).
//
// Coverage:
//   - Empty event list → balanced zero trial balance
//   - Single SubLedgerPostingEmitted with 2 legs → correct balances
//   - asOf filtering — entry after asOf is excluded
//   - ManualJournalEntry reflected correctly
//   - JournalEntryPosted reflected correctly (2-leg reconstruction)
//
// Authority: General-ledger substrate (Devon COO, engineering).

import { describe, expect, it } from "bun:test";
import type { Event } from "../event-store/types";
import { buildGlView } from "./gl-projection";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<Event> & { type: string; payload: Record<string, unknown> },
): Event {
  return {
    event_id: `evt-${Math.random().toString(36).slice(2)}`,
    type: overrides.type,
    as_of: overrides.as_of ?? "2026-05-18T10:00:00.000Z",
    entity: overrides.entity ?? "BANK-ZA-001",
    actor: overrides.actor ?? { type: "agent" as const, id: "bea" },
    citations: overrides.citations ?? ["[citation: TBC]"],
    payload: overrides.payload,
    ...(overrides.provenance ? { provenance: overrides.provenance } : {}),
  } as Event;
}

const ACCOUNT_DR = "ACC-1100-001";
const ACCOUNT_CR = "ACC-3100-001";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildGlView — empty events", () => {
  it("returns a balanced zero trial balance with no entries", () => {
    const view = buildGlView([], "2026-05-18T23:59:59Z");
    expect(view.ledgerEntries).toHaveLength(0);
    expect(view.trialBalance.totalDebits).toBe(0);
    expect(view.trialBalance.totalCredits).toBe(0);
    expect(view.trialBalance.balanced).toBe(true);
    expect(view.trialBalance.entries).toHaveLength(0);
    expect(Object.keys(view.accountBalances)).toHaveLength(0);
  });

  it("returns the correct asOf value", () => {
    const asOf = "2026-05-15T12:00:00Z";
    const view = buildGlView([], asOf);
    expect(view.asOf).toBe(asOf);
    expect(view.trialBalance.asOf).toBe(asOf);
  });
});

describe("buildGlView — SubLedgerPostingEmitted", () => {
  it("folds a single balanced posting into correct account balances", () => {
    const event = makeEvent({
      type: "SubLedgerPostingEmitted",
      payload: {
        sourceEventId: "evt-trade-001",
        postingType: "trade-booking",
        postedAt: "2026-05-18T09:00:00.000Z",
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 100000, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 100000, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([event], "2026-05-18T23:59:59Z");

    expect(view.ledgerEntries).toHaveLength(2);

    const debitEntry = view.ledgerEntries.find((e) => e.debitCredit === "debit");
    const creditEntry = view.ledgerEntries.find((e) => e.debitCredit === "credit");

    expect(debitEntry?.accountId).toBe(ACCOUNT_DR);
    expect(debitEntry?.amountMinor).toBe(100000);
    expect(debitEntry?.currency).toBe("ZAR");
    expect(debitEntry?.source).toBe("SubLedgerPostingEmitted");

    expect(creditEntry?.accountId).toBe(ACCOUNT_CR);
    expect(creditEntry?.amountMinor).toBe(100000);

    // Trial balance should be balanced
    expect(view.trialBalance.totalDebits).toBe(100000);
    expect(view.trialBalance.totalCredits).toBe(100000);
    expect(view.trialBalance.balanced).toBe(true);
  });

  it("produces trial balance rows grouped by (accountId, currency)", () => {
    const event = makeEvent({
      type: "SubLedgerPostingEmitted",
      payload: {
        sourceEventId: "evt-trade-002",
        postingType: "trade-booking",
        postedAt: "2026-05-18T09:00:00.000Z",
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 50000, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 50000, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([event], "2026-05-18T23:59:59Z");
    const tbEntries = view.trialBalance.entries;
    expect(tbEntries.length).toBeGreaterThanOrEqual(2);

    const drRow = tbEntries.find((r) => r.accountId === ACCOUNT_DR);
    const crRow = tbEntries.find((r) => r.accountId === ACCOUNT_CR);

    expect(drRow?.totalDebitsMinor).toBe(50000);
    expect(drRow?.totalCreditsMinor).toBe(0);
    expect(crRow?.totalCreditsMinor).toBe(50000);
    expect(crRow?.totalDebitsMinor).toBe(0);
  });
});

describe("buildGlView — asOf filtering", () => {
  it("excludes a posting whose postedAt is after asOf", () => {
    const futureEvent = makeEvent({
      type: "SubLedgerPostingEmitted",
      payload: {
        sourceEventId: "evt-future",
        postingType: "trade-booking",
        postedAt: "2026-06-01T00:00:00.000Z", // after asOf
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 999999, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 999999, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([futureEvent], "2026-05-31T23:59:59Z");

    expect(view.ledgerEntries).toHaveLength(0);
    expect(view.trialBalance.totalDebits).toBe(0);
    expect(view.trialBalance.balanced).toBe(true);
  });

  it("includes a posting on exactly asOf", () => {
    const asOf = "2026-05-18T12:00:00.000Z";
    const event = makeEvent({
      type: "SubLedgerPostingEmitted",
      payload: {
        sourceEventId: "evt-exact",
        postingType: "trade-booking",
        postedAt: asOf,
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 1000, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 1000, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([event], asOf);
    expect(view.ledgerEntries).toHaveLength(2);
  });

  it("excludes a posting strictly after asOf", () => {
    const asOf = "2026-05-18T12:00:00.000Z";
    const event = makeEvent({
      type: "SubLedgerPostingEmitted",
      payload: {
        sourceEventId: "evt-after",
        postingType: "trade-booking",
        postedAt: "2026-05-18T12:00:01.000Z", // 1 second after
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 1000, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 1000, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([event], asOf);
    expect(view.ledgerEntries).toHaveLength(0);
  });
});

describe("buildGlView — ManualJournalEntry", () => {
  it("folds a ManualJournalEntry with correct source, journalId, and description", () => {
    const journalId = "jnl-test-001";
    const description = "Test manual accrual";

    const event = makeEvent({
      type: "ManualJournalEntry",
      payload: {
        journalId,
        description,
        postedBy: "bea@bank.local",
        postedAt: "2026-05-18T10:00:00.000Z",
        period: "2026-05",
        status: "posted",
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 200000, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 200000, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([event], "2026-05-18T23:59:59Z");

    expect(view.ledgerEntries).toHaveLength(2);
    for (const entry of view.ledgerEntries) {
      expect(entry.source).toBe("ManualJournalEntry");
      expect(entry.journalId).toBe(journalId);
      expect(entry.description).toBe(description);
    }

    expect(view.trialBalance.totalDebits).toBe(200000);
    expect(view.trialBalance.totalCredits).toBe(200000);
    expect(view.trialBalance.balanced).toBe(true);
  });

  it("excludes a ManualJournalEntry whose postedAt is after asOf", () => {
    const event = makeEvent({
      type: "ManualJournalEntry",
      payload: {
        journalId: "jnl-future",
        description: "Future journal",
        postedBy: "bea@bank.local",
        postedAt: "2026-06-01T00:00:00.000Z",
        period: "2026-06",
        status: "posted",
        legs: [
          { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 50000, currency: "ZAR" },
          { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 50000, currency: "ZAR" },
        ],
      },
    });

    const view = buildGlView([event], "2026-05-31T23:59:59Z");
    expect(view.ledgerEntries).toHaveLength(0);
    expect(view.trialBalance.balanced).toBe(true);
  });
});

describe("buildGlView — JournalEntryPosted", () => {
  it("reconstructs a 2-leg entry from JournalEntryPosted payload", () => {
    const event = makeEvent({
      type: "JournalEntryPosted",
      payload: {
        tradeId: "trade-jp-001",
        accountDebit: ACCOUNT_DR,
        accountCredit: ACCOUNT_CR,
        currency: "ZAR",
        amountMinor: 75000,
        postedAt: "2026-05-18T11:00:00.000Z",
        citations: ["[citation: TBC]"],
      },
    });

    const view = buildGlView([event], "2026-05-18T23:59:59Z");

    expect(view.ledgerEntries).toHaveLength(2);
    const debitLeg = view.ledgerEntries.find((e) => e.debitCredit === "debit");
    const creditLeg = view.ledgerEntries.find((e) => e.debitCredit === "credit");

    expect(debitLeg?.source).toBe("JournalEntryPosted");
    expect(debitLeg?.accountId).toBe(ACCOUNT_DR);
    expect(debitLeg?.amountMinor).toBe(75000);
    expect(debitLeg?.currency).toBe("ZAR");

    expect(creditLeg?.accountId).toBe(ACCOUNT_CR);
    expect(creditLeg?.amountMinor).toBe(75000);

    expect(view.trialBalance.balanced).toBe(true);
    expect(view.trialBalance.totalDebits).toBe(75000);
  });

  it("excludes a JournalEntryPosted whose postedAt is after asOf", () => {
    const event = makeEvent({
      type: "JournalEntryPosted",
      payload: {
        tradeId: "trade-future",
        accountDebit: ACCOUNT_DR,
        accountCredit: ACCOUNT_CR,
        currency: "ZAR",
        amountMinor: 10000,
        postedAt: "2026-07-01T00:00:00.000Z",
        citations: ["[citation: TBC]"],
      },
    });

    const view = buildGlView([event], "2026-05-31T23:59:59Z");
    expect(view.ledgerEntries).toHaveLength(0);
  });
});

describe("buildGlView — mixed event sources", () => {
  it("aggregates balances correctly across all three source types", () => {
    const events: Event[] = [
      makeEvent({
        type: "SubLedgerPostingEmitted",
        payload: {
          sourceEventId: "evt-sl-1",
          postingType: "trade-booking",
          postedAt: "2026-05-01T09:00:00.000Z",
          legs: [
            { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 100000, currency: "ZAR" },
            { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 100000, currency: "ZAR" },
          ],
        },
      }),
      makeEvent({
        type: "JournalEntryPosted",
        payload: {
          tradeId: "trade-jp-x",
          accountDebit: ACCOUNT_DR,
          accountCredit: ACCOUNT_CR,
          currency: "ZAR",
          amountMinor: 50000,
          postedAt: "2026-05-10T10:00:00.000Z",
          citations: ["[citation: TBC]"],
        },
      }),
      makeEvent({
        type: "ManualJournalEntry",
        payload: {
          journalId: "jnl-mixed",
          description: "Mixed test accrual",
          postedBy: "bea@bank.local",
          postedAt: "2026-05-15T11:00:00.000Z",
          period: "2026-05",
          status: "posted",
          legs: [
            { accountId: ACCOUNT_DR, debitCredit: "debit", amountMinor: 25000, currency: "ZAR" },
            { accountId: ACCOUNT_CR, debitCredit: "credit", amountMinor: 25000, currency: "ZAR" },
          ],
        },
      }),
    ];

    const view = buildGlView(events, "2026-05-31T23:59:59Z");

    // 2 + 2 + 2 legs
    expect(view.ledgerEntries).toHaveLength(6);
    expect(view.trialBalance.totalDebits).toBe(175000);
    expect(view.trialBalance.totalCredits).toBe(175000);
    expect(view.trialBalance.balanced).toBe(true);

    // Account balances should have both accounts
    expect(view.accountBalances[ACCOUNT_DR]).toBeDefined();
    expect(view.accountBalances[ACCOUNT_CR]).toBeDefined();
    expect(view.accountBalances[ACCOUNT_DR]?.ZAR?.totalDebitsMinor).toBe(175000);
    expect(view.accountBalances[ACCOUNT_CR]?.ZAR?.totalCreditsMinor).toBe(175000);
  });
});
