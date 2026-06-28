// platform/recon/ba100-cell-values-reconcile.test.ts
//
// Tests for recon:ba100-cell-values-reconcile (D-BA-RETURN-CELL-VALUE-ENGINE
// Phase 1). The gate asserts the BA 100 events-direct leaf fold reconciles to the
// canonical CoA trial-balance oracle, per section, under the combined lens.
//
// We seed a real tmp event store (writable), append a CET1 capital raise, then run
// the gate pointed at it (read-only). The gate must PASS (reconcile + non-vacuous).
// An empty store is a flat-bench info (non-vacuous OFF) but a hard FAIL when the
// CLI vacuity guard is on.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../v2-core/fil-models/capital/types/capital-type-definitions";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { run } from "./ba100-cell-values-reconcile";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "bea:ba100-reconcile-test" };
const SIM = simulatedTag({
  scenario: "ba100-reconcile-test",
  sourceLineage: "bea:ba100-reconcile-test",
  tags: ["manual-simulation", "capital-raise"],
});

function newTmpStorePath(label: string): string {
  return join(mkdtempSync(join(tmpdir(), `ba100-reconcile-${label}-`)), "event.db");
}

function seedCet1(path: string, amount: string): void {
  const store = new EventStore(path);
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: "CET1-RECON" });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: "2026-06-21T00:00:00.000Z",
    originatingEvent: { eventType: "CapitalSubscriptionConfirmed", eventId: "CAP-RECON" },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency: "ZAR", amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: "NS-CAPITAL-CET1-ZAR",
      currency: "ZAR",
      settlementDate: "2026-06-21",
      qualifyingCapital: {
        tier: "cet1" as const,
        subCategory: "cet1.paid-up-ordinary-shares" as const,
      },
    },
  };
  store.append(
    makeFilInstrumentCreated({
      asOf: "2026-06-21T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: ["D-BA-RETURN-CELL-VALUE-ENGINE", "D-CAPITAL-ASSET-CLASS-V1"],
      provenance: SIM,
      payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
        typeof makeFilInstrumentCreated
      >[0]["payload"],
    }),
  );
  store.close();
}

describe("recon:ba100-cell-values-reconcile", () => {
  test("PASSES + reconciles + non-vacuous over a CET1-capital store", () => {
    const path = newTmpStorePath("pass");
    seedCet1(path, "300000000");

    const r = run({ eventDbPath: path, requireNonVacuous: true });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(3); // assets / liabilities / equity reconciled
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    // The fold placed at least one BA 100 line (R0040 + R0810).
    expect(r.asOf).toContain("folded BA 100 line");
  });

  test("FAILS the vacuity guard on an empty store with requireNonVacuous", () => {
    const path = newTmpStorePath("empty-fail");
    new EventStore(path).close(); // empty store, no capital events

    const r = run({ eventDbPath: path, requireNonVacuous: true });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "vacuity" && v.severity === "fail")).toBe(true);
  });

  test("an empty store is a flat-bench INFO (not a failure) when vacuity guard is off", () => {
    const path = newTmpStorePath("empty-info");
    new EventStore(path).close();

    const r = run({ eventDbPath: path, requireNonVacuous: false });
    expect(r.ok).toBe(true);
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
