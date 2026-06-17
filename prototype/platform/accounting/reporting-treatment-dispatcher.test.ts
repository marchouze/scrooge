// platform/accounting/reporting-treatment-dispatcher.test.ts
//
// Unit tests for the reporting-treatment resolver helpers (S0c). Pure functions
// over a registry + a fixture event store — no live composition, no emission.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17).
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";
import type { V2ProductRegistered } from "../../v2-core/banking/events";
import { foldReportingTreatmentRegister } from "../../v2-core/reporting-treatments/registry";
import {
  type TreatmentEventLookup,
  type TreatmentLookupEvent,
  resolveInstanceTreatment,
  resolveProductTreatments,
} from "./reporting-treatment-dispatcher";

// --- fixtures --------------------------------------------------------------

const REGISTER = foldReportingTreatmentRegister([
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "ifrs-classification:fx-fvtpl",
    category: "ifrs-classification",
    scope: ["fil:type:fx"],
    version: { major: 1, minor: 0 },
    ifrsCategory: "fvtpl",
    fairValueHierarchy: "level-2",
    businessModel: "other-trading",
    applicablePostingRuleIds: [],
    cites: ["IFRS9-4.1.4"],
  },
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "posting-rules:fx-spot",
    category: "posting-rules",
    scope: ["fil:type:fx:spot"],
    version: { major: 1, minor: 0 },
    applicablePostingRuleIds: ["PR-FX-001-V2", "PR-FX-REVAL-V2"],
    cites: ["IFRS9-3.1.1"],
  },
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "prudential-treatment:fx-trading-saccr",
    category: "prudential-treatment",
    scope: ["fil:type:fx"],
    version: { major: 1, minor: 0 },
    prudential: { bankingTradingBook: "trading-book", regulatoryApproach: "sa-ccr" },
    applicablePostingRuleIds: [],
    cites: ["BCBS-SA-CCR"],
  },
]);

/** A minimal fixture store implementing the narrow TreatmentEventLookup. */
function fixtureStore(events: TreatmentLookupEvent[]): TreatmentEventLookup {
  return {
    *replay(opts: { type?: string }): Iterable<TreatmentLookupEvent> {
      for (const ev of events) {
        if (opts.type === undefined || ev.type === opts.type) yield ev;
      }
    },
  };
}

const PRODUCT: V2ProductRegistered = {
  kind: "V2ProductRegistered",
  productId: "v2:prd:fx:otc-vanilla",
  name: "FX OTC Vanilla",
  ifrs9Family: "fx-spot",
  filTypeScopes: ["fil:type:fx:spot:otc-vanilla@1.0"] as V2ProductRegistered["filTypeScopes"],
  currencies: ["ZAR", "USD"],
  legalEntityIds: ["LE-ZA-HOZ-BANK"],
  jurisdictions: ["ZA"],
  franchiseScope: "treasury-own-book",
  citations: ["prd:bank:fx:otc-vanilla"],
  reportingTreatmentModuleIds: [
    "ifrs-classification:fx-fvtpl",
    "posting-rules:fx-spot",
    "prudential-treatment:fx-trading-saccr",
  ],
};

// --- resolveProductTreatments ----------------------------------------------

describe("resolveProductTreatments", () => {
  it("composes IFRS, posting-rules and prudential dimensions from the menu pick", () => {
    const r = resolveProductTreatments(PRODUCT, REGISTER);
    expect(r.ifrsCategory).toBe("fvtpl");
    expect(r.fairValueHierarchy).toBe("level-2");
    expect(r.businessModel).toBe("other-trading");
    expect(r.postingRuleIds).toEqual(["PR-FX-001-V2", "PR-FX-REVAL-V2"]);
    expect(r.prudential).toEqual({
      bankingTradingBook: "trading-book",
      regulatoryApproach: "sa-ccr",
    });
    expect(r.citations).toEqual(["BCBS-SA-CCR", "IFRS9-3.1.1", "IFRS9-4.1.4"]);
    expect(r.unresolvedModuleIds).toHaveLength(0);
  });

  it("resolves an absent menu pick to an empty composed treatment (additive default)", () => {
    const r = resolveProductTreatments({ reportingTreatmentModuleIds: undefined }, REGISTER);
    expect(r.ifrsCategory).toBeUndefined();
    expect(r.postingRuleIds).toHaveLength(0);
    expect(r.citations).toHaveLength(0);
    expect(r.unresolvedModuleIds).toHaveLength(0);
  });

  it("surfaces an unknown pick in unresolvedModuleIds (no silent drop)", () => {
    const r = resolveProductTreatments(
      { reportingTreatmentModuleIds: ["ifrs-classification:fx-fvtpl", "ghost-module"] },
      REGISTER,
    );
    expect(r.ifrsCategory).toBe("fvtpl");
    expect(r.unresolvedModuleIds).toEqual(["ghost-module"]);
  });
});

// --- resolveInstanceTreatment ----------------------------------------------

describe("resolveInstanceTreatment", () => {
  const instance = { originatingEvent: { eventType: "FxTradeExecuted", eventId: "ev-trade-1" } };

  it("resolves via originating trade → productId → product → composed treatment", () => {
    const store = fixtureStore([
      {
        event_id: "ev-trade-1",
        type: "FxTradeExecuted",
        // S0d deferred field present on the trade payload (optional-read path).
        payload: { productId: "v2:prd:fx:otc-vanilla" },
      },
      {
        event_id: "ev-prod-1",
        type: "V2ProductRegistered",
        payload: PRODUCT as unknown as Record<string, unknown>,
      },
    ]);
    const r = resolveInstanceTreatment(instance, store, REGISTER);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.productId).toBe("v2:prd:fx:otc-vanilla");
      expect(r.ifrsCategory).toBe("fvtpl");
      expect(r.postingRuleIds).toEqual(["PR-FX-001-V2", "PR-FX-REVAL-V2"]);
    }
  });

  it("fails closed with no-product-binding when the trade carries no productId (S0d deferred)", () => {
    const store = fixtureStore([
      { event_id: "ev-trade-1", type: "FxTradeExecuted", payload: { tradeId: "T-1" } },
    ]);
    const r = resolveInstanceTreatment(instance, store, REGISTER);
    expect(r.resolved).toBe(false);
    if (!r.resolved) {
      expect(r.reason).toBe("no-product-binding");
      expect(r.detail).toContain("no productId");
    }
  });

  it("fails closed with originating-event-missing when the trade event is absent", () => {
    const store = fixtureStore([]);
    const r = resolveInstanceTreatment(instance, store, REGISTER);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("originating-event-missing");
  });

  it("fails closed with product-not-registered when the bound product is unknown", () => {
    const store = fixtureStore([
      {
        event_id: "ev-trade-1",
        type: "FxTradeExecuted",
        payload: { productId: "v2:prd:unknown" },
      },
    ]);
    const r = resolveInstanceTreatment(instance, store, REGISTER);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("product-not-registered");
  });
});
