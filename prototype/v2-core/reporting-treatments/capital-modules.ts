// v2-core/reporting-treatments/capital-modules.ts
//
// The CAPITAL reporting-treatment MENU — the canonical `ReportingTreatmentDeclared`
// module declarations for the `capital` asset class, scoped `fil:type:capital:*`
// (D-CAPITAL-ASSET-CLASS-V1). These are the menu entries a capital instrument /
// product picks via `reportingTreatmentModuleIds` (resolved by
// `resolveProductTreatments`), mirroring `fx-modules.ts`.
//
// The four treatment dimensions for own funds:
//   - ifrs-classification — own funds are NOT a fair-valued trading position. CET1
//       paid-up shares / share premium are IAS 32 §22 EQUITY held at proceeds;
//       liability-classified AT1 / Tier 2 are IFRS 9 §4.2.1 amortised cost. The
//       module declares `amortised-cost` (the nearest measurement basis the enum
//       admits for own funds — own funds are not remeasured), held-to-collect
//       business model, level-1 fair-value hierarchy (proceeds are observed cash).
//   - posting-rules — the three Capital V2 posting-rule ids.
//   - prudential-treatment — capital is the bank's OWN funds (the BA-700 / BA-100
//       NUMERATOR), banking-book, regulatory approach `not-applicable` (own funds
//       are not a risk-weighted exposure; they are the capital that absorbs risk).
//   - tax-treatment — share issuance is not a taxable supply; capital raises are
//       not income. Income-tax basis `not-applicable`; VAT supply
//       `exempt-financial-supply`. The tax slice activates at revenue-start; the
//       module SHAPE is real now.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY the
// declaration shape from this package (enforced by `recon:v2-no-v1-import`).
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD
//   (CEO-approved 2026-06-17), citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
//   urn:reg:za:regs-relating-to-banks:reg38; Banks Act 94 of 1990 §70;
//   urn:reg:bcbs:rbc:20.2; urn:reg:bcbs:rbc:30.2; D5/2025 §2.1.3 (form BA 100);
//   IAS-32-§22; IFRS-9-§4.2.1. Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { z } from "zod";
import type { reportingTreatmentDeclaredSchema } from "./declaration";

/** The DECLARATION INPUT shape — `z.input` of the declaration schema (plain strings). */
export type CapitalTreatmentModuleInput = z.input<typeof reportingTreatmentDeclaredSchema>;

/** The stable `reportingTreatmentModuleIds` a capital instrument/product picks. */
export const CAPITAL_TREATMENT_MODULE_IDS = [
  "ifrs-classification:capital-own-funds",
  "posting-rules:capital",
  "prudential-treatment:capital-own-funds",
  "tax-treatment:capital",
] as const;

/** The three Capital V2 posting-rule ids (from `posting-rules/capital.ts`). */
export const CAPITAL_V2_POSTING_RULE_IDS = [
  "PR-CAP-ISSUE-001-V2",
  "PR-CAP-ADJUST-002-V2",
  "PR-CAP-REDEEM-003-V2",
] as const;

/** The four canonical capital treatment-module declarations, scoped `fil:type:capital:*`. */
export const CAPITAL_TREATMENT_MODULES: readonly CapitalTreatmentModuleInput[] = [
  // IFRS classification — own funds: IAS 32 §22 equity (CET1) / IFRS 9 §4.2.1
  // amortised-cost liability (AT1/T2). Own funds are NOT fair-valued; the module
  // declares amortised-cost + held-to-collect + level-1 (proceeds observed).
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "ifrs-classification:capital-own-funds",
    category: "ifrs-classification",
    scope: ["fil:type:capital:*"],
    version: { major: 1, minor: 0 },
    ifrsCategory: "amortised-cost",
    fairValueHierarchy: "level-1",
    businessModel: "held-to-collect",
    applicablePostingRuleIds: [],
    cites: ["urn:reg:iasb:ias-32:§22", "urn:reg:iasb:ifrs-9:§4.2.1", "ORG-PR-01"],
  },
  // Posting rules — the three Capital V2 posting-rule ids.
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "posting-rules:capital",
    category: "posting-rules",
    scope: ["fil:type:capital:*"],
    version: { major: 1, minor: 0 },
    applicablePostingRuleIds: [...CAPITAL_V2_POSTING_RULE_IDS],
    cites: ["urn:reg:iasb:ias-32:§22", "urn:reg:iasb:ias-32:§33", "urn:reg:iasb:ifrs-9:§3.1.1"],
  },
  // Prudential treatment — own funds are the capital-adequacy NUMERATOR
  // (BA-700 / BA-100), banking-book, NOT a risk-weighted exposure.
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "prudential-treatment:capital-own-funds",
    category: "prudential-treatment",
    scope: ["fil:type:capital:*"],
    version: { major: 1, minor: 0 },
    prudential: {
      bankingTradingBook: "banking-book",
      regulatoryApproach: "not-applicable",
    },
    applicablePostingRuleIds: [],
    cites: [
      "urn:reg:za:regs-relating-to-banks:reg38",
      "urn:reg:za:banks-act-94-1990:s70",
      "urn:reg:bcbs:rbc:20.2",
      "urn:reg:bcbs:rbc:30.2",
      "D5/2025 §2.1.3",
      "ORG-PR-01",
      "ORG-PR-RETURNS-002",
    ],
  },
  // Tax treatment — a capital raise is not income; share issuance is not a
  // taxable supply. Income-tax basis not-applicable; VAT exempt financial supply.
  {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "tax-treatment:capital",
    category: "tax-treatment",
    scope: ["fil:type:capital:*"],
    version: { major: 1, minor: 0 },
    tax: {
      incomeTaxBasis: "not-applicable",
      vatSupply: "exempt-financial-supply",
    },
    applicablePostingRuleIds: [],
    cites: ["urn:reg:za:vat-act-89-1991:s2(1)(f)", "ORG-TX-01"],
  },
];
