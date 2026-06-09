// platform/recon/fx-supported-currency-no-suspense.test.ts
//
// Tests for recon:fx-supported-currency-no-suspense.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { Event } from "../event-store/types.ts";
import {
  deriveSupportedCurrencies,
  main,
  storeAware,
} from "./fx-supported-currency-no-suspense.ts";

const SUSPENSE = "ACC-2100-007";

function suspensePosting(
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
    type: "SubLedgerPostingEmitted",
    as_of: "2026-06-09T12:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: [],
    payload: { postingType: "fx-principal-payment", legs, postedAt: "2026-06-09T00:00:00.000Z" },
    provenance: { kind: "simulated" },
  } as unknown as Event;
}

describe("recon:fx-supported-currency-no-suspense", () => {
  it("derives the supported FX currency set from the live feed + sim seed pairs", () => {
    const currencies = deriveSupportedCurrencies();
    // The TwelveData target pairs + sim seed pairs cover ZAR + the six majors.
    for (const ccy of ["ZAR", "USD", "EUR", "GBP", "JPY", "CHF", "AUD"]) {
      expect(currencies).toContain(ccy);
    }
    // Sorted, de-duplicated.
    expect([...currencies].sort()).toEqual(currencies);
    expect(new Set(currencies).size).toBe(currencies.length);
  });

  it("passes: no supported currency routes any per-currency FX logical to suspense", () => {
    const { violations, asserted } = main();
    expect(violations).toEqual([]);
    // 7 supported currencies × 4 per-currency logicals = 28 assertions.
    expect(asserted).toBe(deriveSupportedCurrencies().length * 4);
    expect(asserted).toBeGreaterThanOrEqual(28);
  });

  describe("(B) store-aware: no supported currency stranded in suspense", () => {
    it("passes on an empty store (no suspense balances)", () => {
      const { violations, asserted } = storeAware({ events: [] });
      expect(violations).toEqual([]);
      expect(asserted).toBe(0);
    });

    it("FAILS when a supported currency (GBP) holds a non-zero suspense balance", () => {
      // A GBP nostro leg stranded on suspense, never re-booked.
      const events = [
        suspensePosting("e1", [
          { accountId: SUSPENSE, debitCredit: "debit", amountMinor: 38135709, currency: "GBP" },
          {
            accountId: "ACC-2100-010",
            debitCredit: "credit",
            amountMinor: 38135709,
            currency: "GBP",
          },
        ]),
      ];
      const { violations } = storeAware({ events });
      expect(violations).toHaveLength(1);
      expect(violations[0]?.subject).toBe(`${SUSPENSE}:GBP`);
    });

    it("passes once the stranded balance is re-booked to net zero", () => {
      const events = [
        suspensePosting("e1", [
          { accountId: SUSPENSE, debitCredit: "debit", amountMinor: 38135709, currency: "GBP" },
          {
            accountId: "ACC-2100-010",
            debitCredit: "credit",
            amountMinor: 38135709,
            currency: "GBP",
          },
        ]),
        // the corrective re-book: reverse out of suspense, into the GBP nostro.
        suspensePosting("c1", [
          { accountId: SUSPENSE, debitCredit: "credit", amountMinor: 38135709, currency: "GBP" },
          {
            accountId: "ACC-1200-004",
            debitCredit: "debit",
            amountMinor: 38135709,
            currency: "GBP",
          },
        ]),
      ];
      const { violations } = storeAware({ events });
      expect(violations).toEqual([]);
    });

    it("ignores an UNsupported currency parked in suspense (safety net is permitted)", () => {
      const events = [
        suspensePosting("e1", [
          { accountId: SUSPENSE, debitCredit: "debit", amountMinor: 5000, currency: "SGD" },
          { accountId: "ACC-2100-010", debitCredit: "credit", amountMinor: 5000, currency: "SGD" },
        ]),
      ];
      const { violations } = storeAware({ events });
      expect(violations).toEqual([]);
    });
  });
});
