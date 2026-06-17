// v2-core/reporting-treatments/fx-modules.ts
//
// The FX reporting-treatment MENU — the four canonical `ReportingTreatmentDeclared`
// module declarations for the FX asset class, scoped `fil:type:fx:*`. These are
// the menu entries an FX Product picks via `reportingTreatmentModuleIds`
// (resolved by `resolveProductTreatments`).
//
// SINGLE SOURCE: the V2 anchor seed (`scripts/seed-v2-anchor-bank-standing-data.ts`)
// renders these declarations into the v2-anchor store; the resolution unit test
// asserts against the SAME constant — so the seed and the proof can never drift.
// The declarations are lifted UP to product-level modules from:
//   - Bea's M1 IFRS determination
//     (`runtime/agents/bea-m1-ifrs-classification-rules.ts`): FVTPL by SPPI-fail
//     + trading business model, IAS 21 §23 FX revaluation, IFRS 9 §5.7.1 FVTPL
//     re-measurement — matched here so the later composed fold stays
//     byte-equivalent with today's behaviour.
//   - The FX V2 posting rules (`platform/accounting/gl-posting-engine-v2.ts`):
//     PR-FX-001-V2 (initial recognition), PR-FX-REVAL-V2 (FVTPL revaluation),
//     PR-FX-CLOSE-V2 (derecognition).
//   - The FX tax vocabulary
//     (`platform/markets/products/npa-fx-tax-attestation.ts`): s24J accrual on
//     the interest-rate-differential component + VAT-exempt financial supply.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY the
// declaration shape from this package and nothing from `platform/` / `runtime/`
// (enforced by `recon:v2-no-v1-import`).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Principle 1; Principle 2.
// Author: Bea (Financial Accountant, finance).

import type { z } from "zod";
import type { reportingTreatmentDeclaredSchema } from "./declaration";

/**
 * The DECLARATION INPUT shape — `z.input` of the declaration schema, i.e. the
 * plain-string form BEFORE the schema's brand transforms (`scope` and `cites`
 * are `string[]` here, branded to `FilScopePattern[]` / `CitationRef[]` only on
 * parse). Authoring the canonical modules at the input type keeps them plain
 * literals; the fold re-parses them fail-closed, producing the branded values.
 */
export type FxTreatmentModuleInput = z.input<typeof reportingTreatmentDeclaredSchema>;

/**
 * The stable `reportingTreatmentModuleIds` the FX OTC Vanilla product picks —
 * one module per treatment dimension. Exported so the product wiring and the
 * resolution proof reference the same id set.
 */
export const FX_TREATMENT_MODULE_IDS = [
  "ifrs-classification:fx-fvtpl",
  "posting-rules:fx",
  "prudential-treatment:fx-trading-book",
  "tax-treatment:fx",
] as const;

/** The three FX V2 posting-rule ids (from `gl-posting-engine-v2.ts`). */
export const FX_V2_POSTING_RULE_IDS = ["PR-FX-001-V2", "PR-FX-REVAL-V2", "PR-FX-CLOSE-V2"] as const;

/**
 * The four canonical FX treatment-module declarations. The `scope` strings are
 * branded `FilScopePattern` at the schema boundary; here they are authored as
 * plain `fil:type:fx:*` literals (the fold re-validates them fail-closed).
 */
export const FX_TREATMENT_MODULES: readonly FxTreatmentModuleInput[] = [
  // IFRS classification — FVTPL (IFRS 9 §4.1.4: residual cash flows fail SPPI,
  // trading book → fair value through P&L), FX revaluation at the closing rate
  // (IAS 21 §23), FVTPL re-measurement (IFRS 9 §5.7.1).
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "ifrs-classification:fx-fvtpl",
    category: "ifrs-classification",
    scope: ["fil:type:fx:*"],
    version: { major: 1, minor: 0 },
    ifrsCategory: "fvtpl",
    fairValueHierarchy: "level-2",
    businessModel: "other-trading",
    applicablePostingRuleIds: [],
    cites: ["IFRS-9-§4.1.4", "IFRS-9-§5.7.1", "IAS-21-§23", "ORG-AC-01", "ORG-AC-05"],
  },
  // Posting rules — the three FX V2 posting-rule ids. This module composes the
  // SET an FX product applies; it does NOT define the postings (GL engine's job).
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "posting-rules:fx",
    category: "posting-rules",
    scope: ["fil:type:fx:*"],
    version: { major: 1, minor: 0 },
    applicablePostingRuleIds: [...FX_V2_POSTING_RULE_IDS],
    cites: ["IFRS-9-§3.1.1", "IFRS-9-§5.7.1", "IFRS-9-§3.2.3"],
  },
  // Prudential treatment — FX OTC sits in the trading book; market risk is
  // measured under the standardised approach (BA-320 alternative / simplified
  // market-risk return). Obligation row ORG-PR-19 (market-risk return family).
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "prudential-treatment:fx-trading-book",
    category: "prudential-treatment",
    scope: ["fil:type:fx:*"],
    version: { major: 1, minor: 0 },
    prudential: {
      bankingTradingBook: "trading-book",
      regulatoryApproach: "standardised-market-risk",
    },
    applicablePostingRuleIds: [],
    cites: ["BA-320", "ORG-PR-19"],
  },
  // Tax treatment — income tax on the interest-rate-differential component
  // accrues under Income Tax Act 58 of 1962 s24J; FX supplies are VAT-exempt
  // financial services (VAT Act 89 of 1991 s2(1)(f), Sch 1 items 1(f)–(g)). The
  // tax slice activates at revenue-start (build phase has no taxable income);
  // the module SHAPE is real now. Citations drawn from the established FX tax
  // vocabulary in `npa-fx-tax-attestation.ts` — a real URN set, NOT a deferred
  // gap.
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "tax-treatment:fx",
    category: "tax-treatment",
    scope: ["fil:type:fx:*"],
    version: { major: 1, minor: 0 },
    tax: {
      incomeTaxBasis: "mark-to-market-s24jb",
      vatSupply: "exempt-financial-supply",
    },
    applicablePostingRuleIds: [],
    cites: [
      "urn:reg:za:income-tax-act-58-1962:s24j",
      "urn:reg:za:vat-act-89-1991:s2(1)(f)",
      "urn:reg:za:vat-act-89-1991:sch1-item1(f)",
      "ORG-TX-01",
    ],
  },
];
