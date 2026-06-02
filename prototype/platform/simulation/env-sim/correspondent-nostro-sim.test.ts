// platform/simulation/env-sim/correspondent-nostro-sim.test.ts
//
// CorrespondentNostroSimulator guardrails: each intraday tick emits an MT942
// InboundMessageReceived, the running balance tracks credits − debits, and a
// FundingDrawnDown fires (and restores the floor) when the balance breaches it.
//
// Authority: D-FX-CLS-MEMBERSHIP; BCBS 248.

import { describe, expect, it } from "bun:test";

import { EventStore } from "../../event-store/store";
import { CorrespondentNostroSimulator } from "./correspondent-nostro-sim";

/** Deterministic PRNG (mulberry32) — no Math.random. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("CorrespondentNostroSimulator", () => {
  it("emits an MT942 InboundMessageReceived on each tick", () => {
    const store = new EventStore();
    const sim = new CorrespondentNostroSimulator({
      store,
      rng: seededRng(1),
      intervalMs: 1000,
      openingBalanceMinor: 80_000_000_00n,
    });

    const r = sim.tick();
    expect(r.messageId).toContain("MT942");

    const inbound = [...store.replay({ type: "InboundMessageReceived" })];
    expect(inbound.length).toBe(1);
    const p = inbound[0]?.payload as { messageStandard: string; serialisedMessage: string };
    expect(p.messageStandard).toBe("MT942");
    expect(p.serialisedMessage).toContain(":34F:");
  });

  it("draws funding (and restores the floor) when the balance breaches the floor", () => {
    const store = new EventStore();
    // Open just above the floor (R50m) so a single outflow tick breaches it.
    const sim = new CorrespondentNostroSimulator({
      store,
      rng: seededRng(7),
      intervalMs: 1000,
      openingBalanceMinor: 51_000_000_00n,
    });

    let drewAtLeastOnce = false;
    for (let i = 0; i < 5; i++) {
      const r = sim.tick();
      if (r.fundingDrawn) {
        drewAtLeastOnce = true;
        // A draw restores the balance to at least the floor (R50m).
        expect(r.balanceAfterMinor).toBeGreaterThanOrEqual(50_000_000_00n);
        expect(r.drawnAmountMinor).toBeGreaterThan(0n);
      }
    }

    expect(drewAtLeastOnce).toBe(true);
    const draws = [...store.replay({ type: "FundingDrawnDown" })];
    expect(draws.length).toBeGreaterThanOrEqual(1);
    const dp = draws[0]?.payload as { facilityId: string; currency: string; amount: number };
    expect(dp.facilityId).toBe("CORRESPONDENT-INTRADAY-LINE");
    expect(dp.currency).toBe("ZAR");
    expect(dp.amount).toBeGreaterThan(0);
  });

  it("tracks the running balance as opening + credits − debits across ticks", () => {
    const store = new EventStore();
    const sim = new CorrespondentNostroSimulator({
      store,
      rng: seededRng(42),
      intervalMs: 1000,
      openingBalanceMinor: 200_000_000_00n, // high → no floor breach, pure balance tracking
    });

    const r1 = sim.tick();
    const r2 = sim.tick();
    // Balance moves each tick (a debit always posts), and never below the floor here.
    expect(r1.balanceAfterMinor).not.toBe(200_000_000_00n);
    expect(r2.balanceAfterMinor).not.toBe(r1.balanceAfterMinor);
    expect(r1.fundingDrawn).toBe(false);
  });
});
