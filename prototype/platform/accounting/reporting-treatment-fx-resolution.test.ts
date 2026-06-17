// platform/accounting/reporting-treatment-fx-resolution.test.ts
//
// Proof that the FX OTC Vanilla product, picking the four canonical FX
// treatment modules, resolves via `resolveProductTreatments` to the composed
// FX treatment — FVTPL classification, the three FX V2 posting-rule ids,
// trading-book prudential treatment, and the s24J / VAT-exempt tax treatment.
//
// SINGLE SOURCE: the register is folded from `FX_TREATMENT_MODULES` — the SAME
// constant the V2 anchor seed renders into the store — and the product's pick is
// `FX_TREATMENT_MODULE_IDS`, the SAME id set the seed wires onto the product. So
// this proof binds the seeded standing data, not a re-typed copy.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Bea (Financial Accountant, finance).

import { describe, expect, it } from "bun:test";
import type { V2ProductRegistered } from "../../v2-core/banking/events";
import {
  FX_TREATMENT_MODULES,
  FX_TREATMENT_MODULE_IDS,
  FX_V2_POSTING_RULE_IDS,
} from "../../v2-core/reporting-treatments/fx-modules";
import { foldReportingTreatmentRegister } from "../../v2-core/reporting-treatments/registry";
import { resolveProductTreatments } from "./reporting-treatment-dispatcher";

// Fold the canonical FX modules into the register (re-validated fail-closed by
// the fold's schema parse — proving the declarations are well-formed too).
const FX_REGISTER = foldReportingTreatmentRegister(FX_TREATMENT_MODULES);

// The FX OTC Vanilla product, exactly as the V2 anchor seed registers it (the
// menu-pick field is what the resolver reads; other fields elided to the
// resolver's `Pick`).
const FX_OTC_VANILLA: Pick<V2ProductRegistered, "reportingTreatmentModuleIds"> = {
  reportingTreatmentModuleIds: [...FX_TREATMENT_MODULE_IDS],
};

describe("FX product → composed reporting treatment (seeded standing data)", () => {
  it("folds the four FX modules with NO registry conflict", () => {
    expect(FX_REGISTER.rows).toHaveLength(4);
    expect(FX_REGISTER.conflicts).toHaveLength(0);
  });

  it("resolves to FVTPL + the three FX V2 posting rules + trading-book + tax", () => {
    const r = resolveProductTreatments(FX_OTC_VANILLA, FX_REGISTER);

    // IFRS classification dimension — FVTPL (the FX OTC FVTPL determination).
    expect(r.ifrsCategory).toBe("fvtpl");
    expect(r.fairValueHierarchy).toBe("level-2");
    expect(r.businessModel).toBe("other-trading");

    // Posting-rules dimension — the three FX V2 posting-rule ids (sorted union).
    expect(r.postingRuleIds).toEqual([...FX_V2_POSTING_RULE_IDS].sort());

    // Prudential dimension — trading book under the standardised market-risk
    // approach.
    expect(r.prudential).toEqual({
      bankingTradingBook: "trading-book",
      regulatoryApproach: "standardised-market-risk",
    });

    // Tax dimension — s24J mark-to-market basis, VAT-exempt financial supply.
    expect(r.tax).toEqual({
      incomeTaxBasis: "mark-to-market-s24jb",
      vatSupply: "exempt-financial-supply",
    });

    // Every picked module resolved — no unresolved/dangling pick (fail-closed).
    expect(r.unresolvedModuleIds).toHaveLength(0);

    // Citations are unioned across all four modules, deduplicated + sorted, and
    // every module contributes at least one real citation (no invented URNs).
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.citations).toContain("IFRS-9-§4.1.4");
    expect(r.citations).toContain("BA-320");
    expect(r.citations).toContain("urn:reg:za:income-tax-act-58-1962:s24j");
  });

  it("the FX product picks exactly one module per treatment dimension", () => {
    const categories = FX_TREATMENT_MODULE_IDS.map((id) => {
      const row = FX_REGISTER.rows.find((rr) => rr.treatmentId === id);
      if (row === undefined) throw new Error(`FX module ${id} not in register`);
      return row.category;
    });
    // Four distinct dimensions: ifrs-classification, posting-rules,
    // prudential-treatment, tax-treatment.
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories.length).toBe(4);
  });
});
