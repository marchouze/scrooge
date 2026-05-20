// tests/seed-fx-spot-controlled-launch-limits.test.ts
//
// WS-MARKET-RISK-PROCEDURES — tests for the FX-spot controlled-launch
// seed script (`prototype/scripts/seed-fx-spot-controlled-launch-limits.ts`).
//
// Coverage:
//   (1) Running the seed emits four events on a fresh bench: two
//       `CreditLimitLoaded` (one per counterparty) and two
//       `ISDACSAAssessmentCompleted` (one per counterparty's USD
//       netting set).
//   (2) Running the seed twice is idempotent — the second run emits
//       zero new events and skips all four.
//   (3) After seeding, the netting-set projection exposes both
//       counterparties with `csaPresent: false`, `nettingEnforceable:
//       true`, USD currency, and `jurisdictionOpinionRef` set.
//   (4) After seeding, the Vera recon
//       `recon:credit-limit-no-trade-without-loaded` passes (`ok: true`)
//       when fed each counterparty's `FxTradeBooked` trade event —
//       confirming the load is recognised as a prior precondition for
//       any subsequent trade booking.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved
//   2026-05-20); WS-MARKET-RISK-PROCEDURES.
//
// Author: Yael (Treasurer & Tax, engineering+governance).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { resolveNettingSet } from "../platform/markets/netting-sets";
import { run as runNoTradeWithoutLoaded } from "../platform/recon/credit-limit-no-trade-without-loaded";
import {
  COUNTERPARTIES,
  EFFECTIVE_FROM,
  ISDA_SA_OPINION_REF,
  USD_500K_MINOR,
  main as runSeed,
} from "../scripts/seed-fx-spot-controlled-launch-limits";

// ---------------------------------------------------------------------------
// Helper: replay both event kinds for a counterparty against the live store.
// ---------------------------------------------------------------------------

function countLoadedForCounterparty(counterpartyId: string): number {
  let count = 0;
  for (const e of eventStore.replay({ type: "CreditLimitLoaded" })) {
    const p = e.payload as { counterpartyId?: string; effectiveFrom?: string };
    if (p.counterpartyId === counterpartyId && p.effectiveFrom === EFFECTIVE_FROM) {
      count += 1;
    }
  }
  return count;
}

function countAssessmentForCounterparty(counterpartyId: string): number {
  let count = 0;
  for (const e of eventStore.replay({ type: "ISDACSAAssessmentCompleted" })) {
    const p = e.payload as {
      counterpartyId?: string;
      assessedAt?: string;
      currency?: string;
    };
    if (
      p.counterpartyId === counterpartyId &&
      p.currency === "USD" &&
      p.assessedAt?.startsWith("2026-05-20")
    ) {
      count += 1;
    }
  }
  return count;
}

describe("seed-fx-spot-controlled-launch-limits", () => {
  // Run the seed once at the top of the describe — subsequent expects read
  // from the live store. The script is idempotent so this is safe under
  // bun:test's shared-store regime.
  it("emits CreditLimitLoaded + ISDACSAAssessmentCompleted for both counterparties", () => {
    runSeed();

    for (const cp of COUNTERPARTIES) {
      expect(countLoadedForCounterparty(cp.counterpartyId)).toBe(1);
      expect(countAssessmentForCounterparty(cp.counterpartyId)).toBe(1);
    }
  });

  it("is idempotent — a second run emits zero new events", () => {
    // First run already executed in the previous test.
    const beforeLoaded = [...eventStore.replay({ type: "CreditLimitLoaded" })].length;
    const beforeAssess = [...eventStore.replay({ type: "ISDACSAAssessmentCompleted" })].length;

    runSeed();

    const afterLoaded = [...eventStore.replay({ type: "CreditLimitLoaded" })].length;
    const afterAssess = [...eventStore.replay({ type: "ISDACSAAssessmentCompleted" })].length;

    expect(afterLoaded).toBe(beforeLoaded);
    expect(afterAssess).toBe(beforeAssess);
  });

  it("CreditLimitLoaded payload carries USD 500k + USD currency for each counterparty", () => {
    for (const cp of COUNTERPARTIES) {
      const matches = [...eventStore.replay({ type: "CreditLimitLoaded" })].filter((e) => {
        const p = e.payload as { counterpartyId?: string; effectiveFrom?: string };
        return p.counterpartyId === cp.counterpartyId && p.effectiveFrom === EFFECTIVE_FROM;
      });
      expect(matches).toHaveLength(1);
      const p = matches[0]?.payload as {
        limit: number;
        currency: string;
        loadedBy: string;
      };
      expect(p.limit).toBe(USD_500K_MINOR);
      expect(p.currency).toBe("USD");
      expect(p.loadedBy).toBe("agent:yael:treasurer-tax");
    }
  });

  it("netting-set projection exposes csaPresent=false + nettingEnforceable=true for both counterparties", () => {
    for (const cp of COUNTERPARTIES) {
      const ns = resolveNettingSet(cp.counterpartyId, "USD");
      expect(ns).not.toBeNull();
      if (!ns) throw new Error("unreachable");
      expect(ns.csaPresent).toBe(false);
      expect(ns.nettingEnforceable).toBe(true);
      expect(ns.currency).toBe("USD");
      expect(ns.threshold.amount).toBe(0n);
      expect(ns.mta.amount).toBe(0n);
      expect(ns.jurisdictionOpinionRef).toBe(ISDA_SA_OPINION_REF);
      expect(ns.nettingSetId).toBe(`NS-${cp.counterpartyId}-USD`);
    }
  });

  it("recon:credit-limit-no-trade-without-loaded passes for trades against either seeded counterparty", () => {
    // Synthesize a trade event for each counterparty with as_of after the
    // load effective date. Inject directly via the recon's RunOpts so
    // we don't pollute the shared event store.
    const trades = COUNTERPARTIES.map((cp, idx) => ({
      event_id: `test-trade-${idx}`,
      type: "FxTradeBooked",
      as_of: "2026-05-21T09:00:00.000Z",
      payload: { counterpartyId: cp.counterpartyId },
    }));

    // Pull the live CreditLimitLoaded events from the store and pass
    // them through alongside the synthetic trades. This mirrors how
    // the production recon reads from the shared store.
    const loadedEvents = [...eventStore.replay({ type: "CreditLimitLoaded" })].map((e) => ({
      event_id: e.event_id,
      type: e.type,
      as_of: e.as_of,
      payload: e.payload as Record<string, unknown>,
    }));

    const result = runNoTradeWithoutLoaded({
      tradeEvents: trades,
      loadedEvents,
    });

    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });
});
