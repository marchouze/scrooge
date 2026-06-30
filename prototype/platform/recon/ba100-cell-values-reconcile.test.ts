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
import { filFxSettlementConfirmedPayloadSchema } from "../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../v2-core/fil-models/capital/types/capital-type-definitions";
import { CASH_BALANCE_TYPE_URN } from "../../v2-core/fil-models/cash/types/cash-type-definitions";
import { FX_SPOT_TYPE } from "../../v2-core/fil-models/fx/types/fx-type-definitions";
import {
  makeFilFxSettlementConfirmed,
  makeFilInstrumentCreated,
} from "../event-store/event-types/fil-instances";
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

/**
 * Seed a settled FX SPOT (USD bought / ZAR sold) the way the live store does:
 *   - a `FilFxSettlementConfirmed` the CoA ORACLE folds into the nostros
 *     (Dr USD-nostro at boughtSettled, Cr ZAR-nostro at soldSettled — the FCY
 *     exposure lives as the nostro cash, P&L-neutral PvP);
 *   - the matching settled-cash FIL instances (USD received long, ZAR paid short)
 *     the LEAF FOLD reads — DELIBERATELY WITHOUT cashTerms, so the fold must DERIVE
 *     counterpartyClass "bank" via Tier 2 (the ~R490m fix). Both legs carry the
 *     same ZAR cost basis (the soldSettled ZAR amount), so the USD-received leg's
 *     ZAR carrying amount == the ZAR-paid leg's, and the leaf fold's R0120 net is
 *     zero (long + short) — exactly as the oracle's functional-currency net is zero
 *     (the trade is a change of FORM, not a realisation). The reconciliation
 *     therefore holds WITH the Tier-2-derived cash present, and the gross R0120
 *     placement proves the settled cash is no longer dropped.
 */
function seedSettledFxSpotNoCashTerms(
  path: string,
  args: { id: string; usdBought: string; zarSold: string },
): void {
  const store = new EventStore(path);
  const fxInstance = formatInstanceUrn({ tenant: ENTITY, instanceId: `${args.id}-fx` });

  // (1) The settlement-of-record the ORACLE folds into the nostros.
  const settlement = filFxSettlementConfirmedPayloadSchema.parse({
    kind: "FilFxSettlementConfirmed",
    instance: fxInstance,
    type: FX_SPOT_TYPE.urn,
    tenant: ENTITY,
    asOf: "2026-06-22T00:00:00.000Z",
    originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: `settle:${args.id}` },
    legRole: "spot",
    boughtBooked: { currency: "USD", amount: args.usdBought },
    boughtSettled: { currency: "USD", amount: args.usdBought },
    soldBooked: { currency: "ZAR", amount: args.zarSold },
    soldSettled: { currency: "ZAR", amount: args.zarSold },
  });
  store.append(
    makeFilFxSettlementConfirmed({
      asOf: settlement.asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE"],
      provenance: SIM,
      payload: settlement,
    }),
  );

  // (2) The two settled-cash FIL instances the LEAF FOLD reads — NO cashTerms.
  const cashLeg = (suffix: string, ccy: string, amount: string, direction: "long" | "short") => {
    const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: `${args.id}-cash-${suffix}` });
    const payload = {
      kind: "FilInstrumentCreated" as const,
      instance,
      type: CASH_BALANCE_TYPE_URN,
      tenant: ENTITY,
      asOf: "2026-06-22T00:00:00.000Z",
      // FX settlement origin → Tier-2 derivable "bank" nostro (no explicit class).
      originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: `settle:${args.id}` },
      initialStage: "active" as const,
      economicTerms: {
        assetClass: "cash" as const,
        notional: { currency: ccy, amount },
        direction,
        counterpartyId: "CP-FX-001",
        nettingSetId: "NS-CP-FX-001-ZAR",
        currency: ccy,
        settlementDate: "2026-06-22",
        hedgingSetTag: `${ccy}/ZAR`,
        originatingInstrument: fxInstance,
        // Both legs carry the SAME ZAR cost basis (the ZAR sold amount) — the
        // USD-received leg's IAS 21 §21 ZAR carrying amount == the ZAR-paid leg's.
        zarCostBasis: { currency: "ZAR", amount: args.zarSold },
        // cashTerms DELIBERATELY ABSENT — Tier-2 derivation must place it.
      },
    };
    store.append(
      makeFilInstrumentCreated({
        asOf: "2026-06-22T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE"],
        provenance: SIM,
        payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
          typeof makeFilInstrumentCreated
        >[0]["payload"],
      }),
    );
  };
  cashLeg("received", "USD", args.usdBought, "long"); // USD received → +ZAR basis
  cashLeg("paid", "ZAR", args.zarSold, "short"); // ZAR paid → −ZAR basis

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

  test("RECONCILES with Tier-2-derived settled FX cash (no explicit cashTerms) — the ~R490m fix", () => {
    // D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE: a settled FX cash leg WITHOUT
    // counterpartyClass used to be dropped (#1620 fail-closed-to-blank). It is now
    // DERIVED as a "bank" nostro (Tier 2) and placed on R0120 (in the 10–530 recon
    // range). The store also carries the matching CoA settlement postings, so the
    // events-direct leaf fold and the CoA oracle still reconcile per section.
    const path = newTmpStorePath("tier2");
    seedCet1(path, "300000000"); // a balanced sheet to reconcile against.
    seedSettledFxSpotNoCashTerms(path, {
      id: "FX-TIER2",
      usdBought: "7000000",
      zarSold: "129954790",
    });

    const r = run({ eventDbPath: path, requireNonVacuous: true });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
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
