// tests/netting-sets.test.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — Tests for the netting-set register
// projection in `@platform/markets/netting-sets`.
//
// Coverage:
//   - Single `ISDACSAAssessmentCompleted` materialises one active row.
//   - Subsequent assessment supersedes the prior; only one active row.
//   - `isEnforceable` returns false when `nettingEnforceable: false`
//     and when no assessment is on file.
//   - `getNettingSetsByCounterparty` returns active sets.
//   - Round-trip into `sa-ccr/compute-and-emit.ts` confirms register
//     resolves correctly via `resolveNettingSet()`.
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20),
//   Phase 5.
//
// Author: Imani (Legal-as-code engineer, engineering).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { money } from "../platform/core/money";
import { BANK_ZA_001, ZAR, newEventId } from "../platform/core/types";
import { makeISDACSAAssessmentCompleted } from "../platform/event-store/event-types/credit-limit";
import {
  getEnforceabilityReason,
  getNettingSet,
  getNettingSetsByCounterparty,
  isEnforceable,
  listActiveNettingSets,
  listAllNettingSetEntries,
  nettingSetIdFor,
  resolveNettingSet,
} from "../platform/markets/netting-sets";
import { computeAndEmit } from "../platform/risk/sa-ccr/compute-and-emit";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "test:netting-sets" };
const CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD"];

let cpSeq = 0;
function uniqueCp(prefix: string): string {
  cpSeq += 1;
  return `${prefix}-${process.pid}-${cpSeq}`;
}

function ts(year: number, month: number, day: number, hour = 10): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `${year}-${m}-${d}T${h}:00:00.000Z`;
}

function appendAssessment(opts: {
  counterpartyId: string;
  isdaStatus?: "executed" | "in-negotiation" | "absent";
  csaThreshold?: number;
  mta?: number;
  currency?: string;
  nettingEnforceable?: boolean;
  jurisdictionOpinionRef?: string;
  asOf: string;
}): void {
  eventStore.append(
    makeISDACSAAssessmentCompleted({
      asOf: opts.asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: opts.counterpartyId,
        isdaStatus: opts.isdaStatus ?? "executed",
        csaThreshold: opts.csaThreshold ?? 10_000_000_00,
        mta: opts.mta ?? 1_000_000_00,
        currency: opts.currency ?? "ZAR",
        nettingEnforceable: opts.nettingEnforceable ?? true,
        ...(opts.jurisdictionOpinionRef !== undefined
          ? { jurisdictionOpinionRef: opts.jurisdictionOpinionRef }
          : {}),
        assessedBy: "test:imani",
        assessedAt: opts.asOf,
      },
      eventId: newEventId(),
    }),
  );
}

describe("netting-sets/projection", () => {
  it("materialises a single active row from one ISDACSAAssessmentCompleted", () => {
    const cp = uniqueCp("CP-NS-A");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      jurisdictionOpinionRef: "DOC-OP-ZA-001",
    });

    const nsId = nettingSetIdFor(cp, "ZAR");
    const ns = getNettingSet(nsId);
    expect(ns).not.toBeNull();
    expect(ns?.counterpartyId).toBe(cp);
    expect(ns?.currency).toBe("ZAR");
    expect(ns?.csaPresent).toBe(true);
    expect(ns?.nettingEnforceable).toBe(true);
    expect(ns?.jurisdictionOpinionRef).toBe("DOC-OP-ZA-001");
    expect(ns?.lastValidatedAt).toBe(asOf);

    const all = listActiveNettingSets();
    const filtered = all.filter((n) => n.counterpartyId === cp);
    expect(filtered).toHaveLength(1);
  });

  it("supersedes a prior assessment with a newer one", () => {
    const cp = uniqueCp("CP-NS-B");
    const t1 = ts(2026, 5, 15);
    const t2 = ts(2026, 5, 20);

    appendAssessment({
      counterpartyId: cp,
      asOf: t1,
      csaThreshold: 5_000_000_00,
      mta: 500_000_00,
      jurisdictionOpinionRef: "DOC-OP-ZA-OLD",
    });
    appendAssessment({
      counterpartyId: cp,
      asOf: t2,
      csaThreshold: 20_000_000_00,
      mta: 2_000_000_00,
      jurisdictionOpinionRef: "DOC-OP-ZA-NEW",
    });

    const ns = resolveNettingSet(cp, "ZAR");
    expect(ns).not.toBeNull();
    expect(ns?.threshold.amount).toBe(20_000_000_00n);
    expect(ns?.mta.amount).toBe(2_000_000_00n);
    expect(ns?.jurisdictionOpinionRef).toBe("DOC-OP-ZA-NEW");
    expect(ns?.lastValidatedAt).toBe(t2);

    // Both rows present in full registry; exactly one active.
    const allRows = listAllNettingSetEntries().filter((r) => r.counterpartyId === cp);
    expect(allRows).toHaveLength(2);
    expect(allRows.filter((r) => r.status === "active")).toHaveLength(1);
    expect(allRows.filter((r) => r.status === "superseded")).toHaveLength(1);
  });

  it("isEnforceable returns false when nettingEnforceable: false", () => {
    const cp = uniqueCp("CP-NS-C");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      nettingEnforceable: false,
    });

    const nsId = nettingSetIdFor(cp, "ZAR");
    expect(isEnforceable(nsId)).toBe(false);
    expect(getEnforceabilityReason(nsId)).toContain("not enforceable");
  });

  it("isEnforceable returns false when no assessment is on file", () => {
    const nsId = nettingSetIdFor("CP-UNKNOWN-XYZ", "ZAR");
    expect(isEnforceable(nsId)).toBe(false);
    expect(getEnforceabilityReason(nsId)).toBe("not enforceable: no assessment on file");
  });

  it("isEnforceable returns true with a positive opinion", () => {
    const cp = uniqueCp("CP-NS-D");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      nettingEnforceable: true,
      jurisdictionOpinionRef: "DOC-OP-ZA-CLEAN",
    });

    const nsId = nettingSetIdFor(cp, "ZAR");
    expect(isEnforceable(nsId)).toBe(true);
    expect(getEnforceabilityReason(nsId)).toContain("DOC-OP-ZA-CLEAN");
  });

  it("getNettingSetsByCounterparty returns only active sets", () => {
    const cp = uniqueCp("CP-NS-E");
    const t1 = ts(2026, 5, 15);
    const t2 = ts(2026, 5, 20);

    appendAssessment({ counterpartyId: cp, asOf: t1 });
    appendAssessment({ counterpartyId: cp, asOf: t2 });

    const active = getNettingSetsByCounterparty(cp);
    expect(active).toHaveLength(1);
    expect(active[0]?.lastValidatedAt).toBe(t2);
  });

  it("csaPresent is false when isdaStatus is in-negotiation", () => {
    const cp = uniqueCp("CP-NS-F");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      isdaStatus: "in-negotiation",
    });

    const ns = resolveNettingSet(cp, "ZAR");
    expect(ns?.csaPresent).toBe(false);
  });

  it("csaPresent is false when ISDA executed but no CSA (threshold=0, mta=0) — Imani G-9 FX-spot controlled-launch posture", () => {
    const cp = uniqueCp("CP-NS-G");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      isdaStatus: "executed",
      csaThreshold: 0,
      mta: 0,
      currency: "USD",
      nettingEnforceable: true,
      jurisdictionOpinionRef: "DOC-OP-ZA-ISDA-2024-04-15",
    });

    const ns = resolveNettingSet(cp, "USD");
    expect(ns).not.toBeNull();
    expect(ns?.csaPresent).toBe(false);
    expect(ns?.nettingEnforceable).toBe(true);
    expect(ns?.threshold.amount).toBe(0n);
    expect(ns?.mta.amount).toBe(0n);
  });

  it("csaPresent is true when ISDA executed with non-zero threshold or MTA", () => {
    const cp = uniqueCp("CP-NS-H");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      isdaStatus: "executed",
      csaThreshold: 1_000_000_00,
      mta: 100_000_00,
    });

    const ns = resolveNettingSet(cp, "ZAR");
    expect(ns?.csaPresent).toBe(true);
  });
});

describe("netting-sets ↔ sa-ccr round-trip", () => {
  it("resolveNettingSet returns the shape SA-CCR computeAndEmit can consume", () => {
    const cp = uniqueCp("CP-NS-ROUND");
    const asOf = ts(2026, 5, 20);
    appendAssessment({
      counterpartyId: cp,
      asOf,
      csaThreshold: 10_000_000_00,
      mta: 1_000_000_00,
      jurisdictionOpinionRef: "DOC-OP-ZA-ROUND",
    });

    const ns = resolveNettingSet(cp, "ZAR");
    expect(ns).not.toBeNull();
    if (!ns) throw new Error("unreachable");

    // Feed the register-resolved netting set into the SA-CCR engine.
    const result = computeAndEmit({
      nettingSet: ns,
      vMtm: money(5_000_000, ZAR),
      collateralHeld: money(0, ZAR),
      trades: [],
      asOf,
    });

    expect(result.rc.nettingSetId).toBe(nettingSetIdFor(cp, "ZAR"));
    expect(result.ead.counterpartyId).toBe(cp);
    expect(result.event.type).toBe("CcrReplacementCostComputed");
  });
});
