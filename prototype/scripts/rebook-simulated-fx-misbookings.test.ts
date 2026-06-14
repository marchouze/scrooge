// scripts/rebook-simulated-fx-misbookings.test.ts
//
// Unit tests for the simulated FX mis-booking re-book corrective
// (D-SLA-REBOOK-SIMULATED-MISBOOKINGS). Pure-function tests over a synthetic
// event list — no live store. Covers: discovery, provenance scoping
// (simulated-only), per-currency re-book target, balance, accounts-first
// ordering, and idempotency.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import { amountToMinorUnits } from "../platform/core/decimal-money";
import type { Event } from "../platform/event-store/types";

function legMinor(l: SubLedgerLeg): number {
  return Number(amountToMinorUnits(l.amount));
}
import {
  type MisbookedLeg,
  alreadyRebookedKeysFrom,
  buildCorrectionEvent,
  discoverMisbookedLegsFrom,
  resolveTargetAccount,
} from "./rebook-simulated-fx-misbookings";

const ENTITY = "LE-ZA-HOZ-BANK";

function posting(args: {
  eventId: string;
  postingType: string;
  legs: SubLedgerLeg[];
  provenanceKind?: "production" | "simulated" | "build-phase-fixture";
}): Event {
  const provenance =
    args.provenanceKind === undefined
      ? undefined
      : args.provenanceKind === "simulated"
        ? { kind: "simulated", scenario: "fx-sim", sourceLineage: "fx-sim-hub" }
        : args.provenanceKind === "build-phase-fixture"
          ? { kind: "build-phase-fixture", sourceLineage: "pre-substrate-backfill" }
          : { kind: "production", sourceLineage: "fx-booking" };
  return {
    event_id: args.eventId,
    type: "SubLedgerPostingEmitted",
    as_of: "2026-06-05",
    entity: ENTITY,
    actor: { type: "service", id: "agent:test" },
    citations: ["c"],
    payload: {
      sourceEventId: `src-${args.eventId}`,
      postingType: args.postingType,
      legs: args.legs,
      postedAt: "2026-06-05T00:00:00.000Z",
    },
    ...(provenance ? { provenance } : {}),
  } as unknown as Event;
}

/** A GBP booking mis-posted to the USD slots (ACC-2100-002/004). */
const GBP_MISBOOKED_LEGS: SubLedgerLeg[] = [
  { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: 50_000_000, currency: "GBP" },
  { accountId: "ACC-2100-004", debitCredit: "credit", amountMinor: 50_000_000, currency: "GBP" },
];

describe("resolveTargetAccount — per-currency home accounts", () => {
  it("GBP receivable → ACC-2100-010, payable → ACC-2100-011", () => {
    expect(resolveTargetAccount("fx.receivable", "GBP")).toBe("ACC-2100-010");
    expect(resolveTargetAccount("fx.payable", "GBP")).toBe("ACC-2100-011");
  });
  it("EUR/CHF/AUD/JPY resolve to their dedicated accounts", () => {
    expect(resolveTargetAccount("fx.receivable", "EUR")).toBe("ACC-2100-013");
    expect(resolveTargetAccount("fx.receivable", "CHF")).toBe("ACC-2100-016");
    expect(resolveTargetAccount("fx.receivable", "AUD")).toBe("ACC-2100-019");
    expect(resolveTargetAccount("fx.receivable", "JPY")).toBe("ACC-2100-022");
  });
  it("an unprovisioned currency (SGD) has no dedicated account → out of scope", () => {
    expect(resolveTargetAccount("fx.receivable", "SGD")).toBeUndefined();
  });
});

describe("discoverMisbookedLegsFrom — provenance scoping", () => {
  it("finds simulated foreign-currency legs on the USD slots", () => {
    const events = [
      posting({
        eventId: "p1",
        postingType: "trade-booking",
        legs: GBP_MISBOOKED_LEGS,
        provenanceKind: "simulated",
      }),
    ];
    const found = discoverMisbookedLegsFrom(events);
    expect(found.length).toBe(2);
    expect(found.map((m) => m.leg.currency)).toEqual(["GBP", "GBP"]);
    expect(found.map((m) => m.logical)).toEqual(["fx.receivable", "fx.payable"]);
  });

  it("NEVER touches production or build-phase-fixture postings", () => {
    const events = [
      posting({
        eventId: "prod",
        postingType: "trade-booking",
        legs: GBP_MISBOOKED_LEGS,
        provenanceKind: "production",
      }),
      posting({
        eventId: "fixture",
        postingType: "trade-booking",
        legs: GBP_MISBOOKED_LEGS,
        provenanceKind: "build-phase-fixture",
      }),
      posting({
        eventId: "untagged",
        postingType: "trade-booking",
        legs: GBP_MISBOOKED_LEGS,
        // no provenance
      }),
    ];
    expect(discoverMisbookedLegsFrom(events).length).toBe(0);
  });

  it("leaves USD-currency legs on the USD slot alone (correct bookings)", () => {
    const usdLegs: SubLedgerLeg[] = [
      { accountId: "ACC-2100-002", debitCredit: "debit", amountMinor: 100, currency: "USD" },
      { accountId: "ACC-2100-004", debitCredit: "credit", amountMinor: 100, currency: "USD" },
    ];
    const events = [
      posting({
        eventId: "p",
        postingType: "trade-booking",
        legs: usdLegs,
        provenanceKind: "simulated",
      }),
    ];
    expect(discoverMisbookedLegsFrom(events).length).toBe(0);
  });

  it("ignores non-booking posting types (reval/close etc.)", () => {
    const events = [
      posting({
        eventId: "p",
        postingType: "revaluation",
        legs: GBP_MISBOOKED_LEGS,
        provenanceKind: "simulated",
      }),
    ];
    expect(discoverMisbookedLegsFrom(events).length).toBe(0);
  });
});

describe("buildCorrectionEvent — reverse-out + re-book-in, balanced, accounts-first", () => {
  const m: MisbookedLeg = {
    correctsEventId: "p1",
    legIndex: 0,
    leg: GBP_MISBOOKED_LEGS[0] as SubLedgerLeg, // debit ACC-2100-002 GBP
    logical: "fx.receivable",
    provenance: { kind: "simulated", scenario: "fx-sim", sourceLineage: "fx-sim-hub" },
  };

  it("reverses the USD-slot leg and re-books into the per-currency account", () => {
    const target = resolveTargetAccount(m.logical, m.leg.currency);
    if (!target) throw new Error("no target");
    const ev = buildCorrectionEvent(m, target);
    const legs = (ev.payload as { legs: SubLedgerLeg[] }).legs;
    expect(legs.length).toBe(2);
    // (1) reverse out of USD slot — opposite side
    expect(legs[0]?.accountId).toBe("ACC-2100-002");
    expect(legs[0]?.debitCredit).toBe("credit");
    expect(legs[0] ? legMinor(legs[0]) : undefined).toBe(50_000_000);
    expect(legs[0]?.currency).toBe("GBP");
    // (2) re-book into GBP receivable — same side
    expect(legs[1]?.accountId).toBe("ACC-2100-010");
    expect(legs[1]?.debitCredit).toBe("debit");
    expect(legs[1] ? legMinor(legs[1]) : undefined).toBe(50_000_000);
    expect(legs[1]?.currency).toBe("GBP");
    // balanced within GBP
    const net = legs.reduce(
      (acc, l) => acc + (l.debitCredit === "debit" ? legMinor(l) : -legMinor(l)),
      0,
    );
    expect(net).toBe(0);
  });

  it("inherits the original simulated provenance tag", () => {
    const ev = buildCorrectionEvent(m, "ACC-2100-010");
    expect((ev.provenance as { kind?: string }).kind).toBe("simulated");
  });

  it("carries the correctsEventId + legIndex for idempotency", () => {
    const ev = buildCorrectionEvent(m, "ACC-2100-010");
    const p = ev.payload as { correctsEventId?: string; legIndex?: number; postingType?: string };
    expect(p.postingType).toBe("sla-rebook-simulated-misbooking");
    expect(p.correctsEventId).toBe("p1");
    expect(p.legIndex).toBe(0);
  });
});

describe("alreadyRebookedKeysFrom — idempotency guard", () => {
  it("recognises prior re-book corrections by correctsEventId:legIndex", () => {
    const prior = posting({
      eventId: "corr1",
      postingType: "sla-rebook-simulated-misbooking",
      legs: GBP_MISBOOKED_LEGS,
      provenanceKind: "simulated",
    });
    (prior.payload as Record<string, unknown>).correctsEventId = "p1";
    (prior.payload as Record<string, unknown>).legIndex = 0;
    const keys = alreadyRebookedKeysFrom([prior]);
    expect(keys.has("p1:0")).toBe(true);
    expect(keys.has("p1:1")).toBe(false);
  });
});
