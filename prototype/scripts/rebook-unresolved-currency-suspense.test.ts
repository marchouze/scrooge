// scripts/rebook-unresolved-currency-suspense.test.ts
//
// Tests for the unresolved-currency suspense re-book (pure helpers only — no
// store mutation). Author: Bea (Accounting & financial reporting engineer).

import { describe, expect, it } from "bun:test";

import { FX_UNRESOLVED_CURRENCY_SUSPENSE } from "../platform/accounting/sla/resolver";
import type { Event } from "../platform/event-store/types";
import {
  alreadyRebookedKeysFrom,
  buildCorrectionEvent,
  buildSupersedeReversalEvent,
  discoverStrandedLegsFrom,
  existingCorrectionsFrom,
  resolveTargetAccount,
} from "./rebook-unresolved-currency-suspense";

const SUSPENSE = FX_UNRESOLVED_CURRENCY_SUSPENSE; // ACC-2100-007

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
    as_of: "2026-06-09",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: [],
    payload: { postingType, legs, postedAt: "2026-06-09T00:00:00.000Z", ...extra },
    provenance: { kind: "simulated" },
  } as unknown as Event;
}

describe("rebook-unresolved-currency-suspense", () => {
  it("discovers only legs sitting on the suspense account", () => {
    const events = [
      // GBP nostro leg stranded on suspense (receive: Dr suspense / Cr receivable)
      posting("e1", "fx-principal-payment", [
        { accountId: SUSPENSE, debitCredit: "debit", amountMinor: 38135709, currency: "GBP" },
        {
          accountId: "ACC-2100-010",
          debitCredit: "credit",
          amountMinor: 38135709,
          currency: "GBP",
        },
      ]),
      // a clean posting with no suspense leg — ignored
      posting("e2", "fx-principal-payment", [
        { accountId: "ACC-1200-002", debitCredit: "debit", amountMinor: 100, currency: "USD" },
        { accountId: "ACC-2100-002", debitCredit: "credit", amountMinor: 100, currency: "USD" },
      ]),
    ];
    const stranded = discoverStrandedLegsFrom(events);
    expect(stranded).toHaveLength(1);
    expect(stranded[0]?.correctsEventId).toBe("e1");
    expect(stranded[0]?.leg.currency).toBe("GBP");
    expect(stranded[0]?.legIndex).toBe(0);
  });

  it("never re-corrects its own correction postings (loop-safe)", () => {
    const events = [
      posting("c1", "sla-rebook-unresolved-currency-suspense", [
        { accountId: SUSPENSE, debitCredit: "credit", amountMinor: 38135709, currency: "GBP" },
        { accountId: "ACC-1200-004", debitCredit: "debit", amountMinor: 38135709, currency: "GBP" },
      ]),
    ];
    expect(discoverStrandedLegsFrom(events)).toHaveLength(0);
  });

  it("resolves GBP/JPY suspense legs to their per-currency nostros", () => {
    expect(resolveTargetAccount("GBP")).toBe("ACC-1200-004");
    expect(resolveTargetAccount("JPY")).toBe("ACC-1200-005");
  });

  it("returns undefined for a genuinely unsupported currency (stays in suspense)", () => {
    // SGD has no dedicated nostro row → would route back to suspense → out of scope.
    expect(resolveTargetAccount("SGD")).toBeUndefined();
  });

  it("builds a balanced two-leg correction that clears suspense (GBP debit case)", () => {
    const stranded = discoverStrandedLegsFrom([
      posting("e1", "fx-principal-payment", [
        { accountId: SUSPENSE, debitCredit: "debit", amountMinor: 38135709, currency: "GBP" },
        {
          accountId: "ACC-2100-010",
          debitCredit: "credit",
          amountMinor: 38135709,
          currency: "GBP",
        },
      ]),
    ])[0];
    if (!stranded) throw new Error("expected stranded leg");
    const ev = buildCorrectionEvent(stranded, "ACC-1200-004");
    const legs = (
      ev.payload as {
        legs: Array<{
          accountId: string;
          debitCredit: string;
          amountMinor: number;
          currency: string;
        }>;
      }
    ).legs;
    // reverse out of suspense (credit) + re-book into nostro (debit), balanced.
    expect(legs).toHaveLength(2);
    const suspenseLeg = legs.find((l) => l.accountId === SUSPENSE);
    const nostroLeg = legs.find((l) => l.accountId === "ACC-1200-004");
    expect(suspenseLeg?.debitCredit).toBe("credit");
    expect(nostroLeg?.debitCredit).toBe("debit");
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
    // inherits simulated provenance
    expect((ev.provenance as { kind?: string }).kind).toBe("simulated");
  });

  it("builds a balanced correction for the JPY credit case (reverse direction)", () => {
    const stranded = discoverStrandedLegsFrom([
      posting("e2", "fx-principal-payment", [
        {
          accountId: "ACC-2100-023",
          debitCredit: "debit",
          amountMinor: 581571176,
          currency: "JPY",
        },
        { accountId: SUSPENSE, debitCredit: "credit", amountMinor: 581571176, currency: "JPY" },
      ]),
    ])[0];
    if (!stranded) throw new Error("expected stranded leg");
    const ev = buildCorrectionEvent(stranded, "ACC-1200-005");
    const legs = (
      ev.payload as { legs: Array<{ accountId: string; debitCredit: string; amountMinor: number }> }
    ).legs;
    const suspenseLeg = legs.find((l) => l.accountId === SUSPENSE);
    const nostroLeg = legs.find((l) => l.accountId === "ACC-1200-005");
    // original suspense leg was a credit → reversal is a debit; nostro takes the credit.
    expect(suspenseLeg?.debitCredit).toBe("debit");
    expect(nostroLeg?.debitCredit).toBe("credit");
    const debit = legs
      .filter((l) => l.debitCredit === "debit")
      .reduce((s, l) => s + l.amountMinor, 0);
    const credit = legs
      .filter((l) => l.debitCredit === "credit")
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debit).toBe(credit);
  });

  it("idempotency index keys on correctsEventId:legIndex", () => {
    const events = [
      posting(
        "c1",
        "sla-rebook-unresolved-currency-suspense",
        [
          { accountId: SUSPENSE, debitCredit: "credit", amountMinor: 1, currency: "GBP" },
          { accountId: "ACC-1200-004", debitCredit: "debit", amountMinor: 1, currency: "GBP" },
        ],
        { correctsEventId: "e1", legIndex: 0 },
      ),
    ];
    const keys = alreadyRebookedKeysFrom(events);
    expect(keys.has("e1:0")).toBe(true);
    expect(keys.has("e1:1")).toBe(false);
  });

  it("indexes existing corrections with their postedAt for supersede detection", () => {
    const events = [
      posting(
        "c1",
        "sla-rebook-unresolved-currency-suspense",
        [
          { accountId: SUSPENSE, debitCredit: "credit", amountMinor: 1, currency: "GBP" },
          { accountId: "ACC-1200-004", debitCredit: "debit", amountMinor: 1, currency: "GBP" },
        ],
        { correctsEventId: "e1", legIndex: 0 },
      ),
    ];
    const map = existingCorrectionsFrom(events);
    const c = map.get("e1:0");
    expect(c?.eventId).toBe("c1");
    expect(c?.postedAt).toBe("2026-06-09T00:00:00.000Z");
    expect(c?.legs).toHaveLength(2);
  });

  it("supersede reversal mirrors the stale legs and keeps the stale (future) postedAt", () => {
    const stale = {
      eventId: "c1",
      correctsEventId: "e1",
      legIndex: 0,
      postedAt: "2026-06-09T16:57:00.000Z", // future-dated (the bug)
      legs: [
        { accountId: SUSPENSE, debitCredit: "credit" as const, amountMinor: 100, currency: "GBP" },
        {
          accountId: "ACC-1200-004",
          debitCredit: "debit" as const,
          amountMinor: 100,
          currency: "GBP",
        },
      ],
      provenance: { kind: "simulated" },
    };
    const ev = buildSupersedeReversalEvent(stale, { kind: "simulated" });
    const p = ev.payload as {
      postedAt: string;
      legs: Array<{ accountId: string; debitCredit: string; amountMinor: number }>;
    };
    // reversal stamped with the STALE timestamp → stays paired/excluded together.
    expect(p.postedAt).toBe("2026-06-09T16:57:00.000Z");
    // legs mirrored: suspense flips credit→debit, nostro flips debit→credit.
    const suspenseLeg = p.legs.find((l) => l.accountId === SUSPENSE);
    const nostroLeg = p.legs.find((l) => l.accountId === "ACC-1200-004");
    expect(suspenseLeg?.debitCredit).toBe("debit");
    expect(nostroLeg?.debitCredit).toBe("credit");
  });
});
