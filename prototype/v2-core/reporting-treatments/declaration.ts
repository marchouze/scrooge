// v2-core/reporting-treatments/declaration.ts
//
// Reporting-treatment menu — the treatment-MODULE declaration SHAPE, modelled
// on the FIL-Models declaration/registry pattern (`v2-core/fil-models/`).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Substrate Architect, engineering).
//
// WHY THIS EXISTS
// ---------------
// An approved Product composes its accounting / regulatory treatment by PICKING
// treatment MODULES from a registry — exactly as a FIL-Model declares an
// implementation of facets over a taxonomy scope. A reporting-treatment module
// is a registered, citable declaration of ONE treatment dimension (IFRS
// classification, posting-rule set, prudential treatment, tax treatment, or a
// disclosure lens) over a taxonomy scope.
//
// This is SHARED SUBSTRATE: per-asset-class fold-native verticals consume the
// registry later. This slice (S0a) lands the declaration SHAPE + the registry
// FOLD + the conflict-detection gate. It does NOT touch GL posting engines,
// `gl-projection-v2.ts`, or `GlPostingEmitted` (brief §"Out of scope").
//
// Registry key: (category, scope, version) — the SAME shape as fil-models'
// (facet, scope, version). Overlapping scope for the same (category, version)
// across different modules is a registry conflict (one treatment dimension has
// one authoritative module per scope+version — the OO single-implementation
// rule, mirrored from FIL-Models §3).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/`, or the v1 alias prefixes (enforced by
// `recon:v2-no-v1-import`). The v1-side event-type registry row is wired OUTSIDE
// this package (`platform/event-store/event-types/reporting-treatments.ts`).

import { z } from "zod";
import { citationRefSchema } from "../fil-core/primitives";
import { filScopePatternSchema, filVersionSchema } from "../fil-core/urn";

// ---------------------------------------------------------------------------
// Treatment category — the treatment DIMENSION a module declares. One module
// declares exactly one dimension; a Product composes its full treatment by
// picking one module per dimension it needs.
// ---------------------------------------------------------------------------

export const reportingTreatmentCategorySchema = z.enum([
  "ifrs-classification",
  "posting-rules",
  "prudential-treatment",
  "tax-treatment",
  "disclosure-lens",
]);

export type ReportingTreatmentCategory = z.infer<typeof reportingTreatmentCategorySchema>;

// ---------------------------------------------------------------------------
// Typed payload optionals. Each treatment dimension carries its own strongly
// typed payload fields — all optional at the schema level because a single
// module declares only the dimension(s) it owns. The resolver (S0c) reads the
// fields relevant to the module's `category`.
// ---------------------------------------------------------------------------

/**
 * IFRS-9 classification of the instrument (the `ifrs-classification` dimension).
 * The category drives the measurement basis; the fair-value hierarchy and
 * business model qualify it where applicable.
 */
export const ifrsClassificationCategorySchema = z.enum([
  "fvtpl", // fair value through profit or loss (IFRS 9 §4.1.4)
  "fvoci", // fair value through other comprehensive income (IFRS 9 §4.1.2A)
  "amortised-cost", // amortised cost (IFRS 9 §4.1.2)
]);

export type IfrsClassificationCategory = z.infer<typeof ifrsClassificationCategorySchema>;

/** IFRS 13 fair-value hierarchy level for fair-valued instruments. */
export const fairValueHierarchySchema = z.enum(["level-1", "level-2", "level-3"]);

export type FairValueHierarchy = z.infer<typeof fairValueHierarchySchema>;

/** IFRS 9 §4.1.1 business model for the holding. */
export const businessModelSchema = z.enum([
  "held-to-collect",
  "held-to-collect-and-sell",
  "other-trading",
]);

export type BusinessModel = z.infer<typeof businessModelSchema>;

/**
 * Prudential treatment optionals (the `prudential-treatment` dimension).
 * `bankingTradingBook` is the regulatory-book assignment; `regulatoryApproach`
 * names the capital approach the product's instances are measured under. Strong
 * enums, never free-text, so the resolver can dispatch on them.
 */
export const prudentialTreatmentSchema = z.object({
  /** Banking book vs trading book (Basel / BA-form boundary). */
  bankingTradingBook: z.enum(["banking-book", "trading-book"]),
  /** Capital approach for this scope (SA-CCR for derivative counterparty EAD, etc.). */
  regulatoryApproach: z.enum([
    "sa-ccr",
    "standardised-credit-risk",
    "standardised-market-risk",
    "irb",
    "not-applicable",
  ]),
});

export type PrudentialTreatment = z.infer<typeof prudentialTreatmentSchema>;

/**
 * Tax treatment optionals (the `tax-treatment` dimension). South-African
 * mark-to-market / realisation split per the Income Tax Act; VAT-supply
 * classification for financial supplies. Build-phase: the tax slice activates
 * when revenue starts (CLAUDE.md operating model) — the module SHAPE is real now.
 */
export const taxTreatmentSchema = z.object({
  /** s.24JB mark-to-market taxation vs realisation basis. */
  incomeTaxBasis: z.enum(["mark-to-market-s24jb", "realisation", "not-applicable"]),
  /** VAT supply classification for the product's supplies (financial supplies are exempt). */
  vatSupply: z.enum(["exempt-financial-supply", "standard-rated", "zero-rated", "not-applicable"]),
});

export type TaxTreatment = z.infer<typeof taxTreatmentSchema>;

// ---------------------------------------------------------------------------
// The `ReportingTreatmentDeclared` event payload — the declaration that folds
// into a reporting-treatment registry row. The registry row IS the manifest
// (mirroring FIL-Models §2 — "no second declaration document exists to drift").
// ---------------------------------------------------------------------------

export const reportingTreatmentDeclaredSchema = z.object({
  kind: z.literal("ReportingTreatmentDeclared"),
  /** Stable treatment-module identity, e.g. `ifrs-classification:fx-fvtpl`. */
  treatmentId: z.string().min(1),
  /** The treatment DIMENSION this module declares. */
  category: reportingTreatmentCategorySchema,
  /** over: the taxonomy scope, as `fil:type:…` patterns (e.g. `fil:type:fx:*`). */
  scope: z.array(filScopePatternSchema).min(1),
  /** The module version (the `@maj.min` lattice; reused from fil-models). */
  version: filVersionSchema,
  // --- typed payload optionals (the resolver reads the ones for `category`) ---
  /** IFRS-9 classification (for `category: "ifrs-classification"`). */
  ifrsCategory: ifrsClassificationCategorySchema.optional(),
  /** IFRS 13 fair-value hierarchy level (qualifies a fair-valued classification). */
  fairValueHierarchy: fairValueHierarchySchema.optional(),
  /** IFRS 9 business model (qualifies the classification). */
  businessModel: businessModelSchema.optional(),
  /** Prudential treatment (for `category: "prudential-treatment"`). */
  prudential: prudentialTreatmentSchema.optional(),
  /** Tax treatment (for `category: "tax-treatment"`). */
  tax: taxTreatmentSchema.optional(),
  /**
   * Posting-rule ids this module references (for `category: "posting-rules"`),
   * e.g. `["PR-FX-001-V2", "PR-FX-REVAL-V2"]`. The ids reference the posting-rule
   * registry (`platform/accounting/posting-rule-registry.ts` and the V2 GL
   * engine rule ids); this module does NOT define the postings (that is the GL
   * engine's job, OUT of scope here) — it composes the SET a product applies.
   */
  applicablePostingRuleIds: z.array(z.string().min(1)),
  /** cites: implemented provisions / obligations (≥1; IMPLEMENTED_BY edge targets). */
  cites: z.array(citationRefSchema).min(1),
});

export type ReportingTreatmentDeclared = z.infer<typeof reportingTreatmentDeclaredSchema>;

// ---------------------------------------------------------------------------
// The registry KEY — (category, scope, version). One treatment dimension may
// have many modules over DISJOINT scopes; overlapping scopes for the same
// (category, version) are a registry conflict (mirrors FIL-Models §3).
// ---------------------------------------------------------------------------

export interface ReportingTreatmentRegistryKey {
  readonly category: string;
  readonly scope: string;
  readonly version: string; // formatted `maj.min`
}

export function treatmentRegistryKeyString(k: ReportingTreatmentRegistryKey): string {
  return `${k.category}::${k.scope}::${k.version}`;
}
