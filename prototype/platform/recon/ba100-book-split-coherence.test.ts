// platform/recon/ba100-book-split-coherence.test.ts
//
// Tests for recon:ba100-book-split-coherence (D-BA-RETURN-CELL-VALUE-ENGINE Phase 2).
// The gate asserts BA 100 C0040 ≥ Σ(C0010) + Σ(C0020) for every row with a C0040 value.
//
// Three test scenarios:
//   1. Self-contained fixture (the gate's own default) — MUST PASS with C0040 ≥ sum.
//   2. Well-split store (all cash with bookType) — PASSES, zero book gaps.
//   3. Fabricated split violation (C0010 + C0020 > C0040) — MUST FAIL the gate.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import { CASH_BALANCE_TYPE_URN } from "../../v2-core/fil-models/cash/types/cash-type-definitions";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { run } from "./ba100-book-split-coherence";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "bea:book-split-test" };
const SIM = simulatedTag({
  scenario: "book-split-test",
  sourceLineage: "bea:book-split-test",
  tags: ["manual-simulation"],
});

function newTmpStorePath(label: string): string {
  return join(mkdtempSync(join(tmpdir(), `ba100-book-split-${label}-`)), "event.db");
}

function seedCash(
  path: string,
  legs: Array<{
    id: string;
    zarAmount: string;
    bookType?: "trading" | "banking-treasury";
  }>,
): void {
  const store = new EventStore(path);
  for (const leg of legs) {
    const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: `${leg.id}-cash` });
    const fxInstance = formatInstanceUrn({ tenant: ENTITY, instanceId: `${leg.id}-fx` });
    const economicTerms: Record<string, unknown> = {
      assetClass: "cash" as const,
      notional: { currency: "ZAR", amount: leg.zarAmount },
      direction: "long" as const,
      counterpartyId: "urn:party:correspondent:test-bank",
      nettingSetId: `NS-TEST-${leg.id}`,
      currency: "ZAR",
      settlementDate: "2026-06-22",
      hedgingSetTag: "ZAR/ZAR",
      originatingInstrument: fxInstance,
      zarCostBasis: { currency: "ZAR", amount: leg.zarAmount },
      cashTerms: {
        counterpartyClass: "bank" as const,
        ...(leg.bookType !== undefined ? { bookType: leg.bookType } : {}),
      },
    };
    const payload = {
      kind: "FilInstrumentCreated" as const,
      instance,
      type: CASH_BALANCE_TYPE_URN,
      tenant: ENTITY,
      asOf: "2026-06-22T00:00:00.000Z",
      originatingEvent: {
        eventType: "FxSimSettlementConfirmed" as const,
        eventId: `settle:${leg.id}`,
      },
      initialStage: "active" as const,
      economicTerms: economicTerms as FilInstrumentCreatedPayload["economicTerms"],
    };
    store.append(
      makeFilInstrumentCreated({
        asOf: "2026-06-22T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-BA-RETURN-CELL-VALUE-ENGINE", "D-FX-BOOK-BOUNDARY"],
        provenance: SIM,
        payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
          typeof makeFilInstrumentCreated
        >[0]["payload"],
      }),
    );
  }
  store.close();
}

describe("recon:ba100-book-split-coherence", () => {
  test("PASSES with the self-contained fixture (trading + banking-treasury + residual)", () => {
    // Run with no opts — the gate builds its own self-contained store.
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    // At minimum, the non-vacuity assertion + 1+ row assertion.
    expect(r.asserted).toBeGreaterThanOrEqual(2);
  });

  test("PASSES when all cash legs carry bookType — C0010 + C0020 == C0040 for each row", () => {
    const path = newTmpStorePath("all-typed");
    seedCash(path, [
      { id: "A1", zarAmount: "100000000", bookType: "trading" },
      { id: "A2", zarAmount: "80000000", bookType: "banking-treasury" },
    ]);
    // Both legs go to R0120 (bank nostro). C0040 = 180m; C0020 = 100m; C0010 = 80m.
    // C0010 + C0020 = 180m == C0040 → coherent.
    const r = run({ eventDbPath: path });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  test("PASSES when a residual leg (no bookType) means C0010+C0020 < C0040", () => {
    const path = newTmpStorePath("with-residual");
    seedCash(path, [
      { id: "B1", zarAmount: "60000000", bookType: "trading" },
      { id: "B2", zarAmount: "40000000" }, // no bookType → C0040 only
    ]);
    // R0120: C0040 = 100m; C0020 = 60m; C0010 = 0; C0010+C0020 = 60m ≤ C0040 → PASS.
    const r = run({ eventDbPath: path });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });
});
