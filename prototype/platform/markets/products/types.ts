// platform/markets/products/types.ts
//
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 1 — typed Product layer.
//
// Per Q1 resolution of the CEO decision record (2026-05-10): one
// canonical `Product` type with `family` discriminator (NOT one type
// per family). Cleanest single-graph (Vera recon walks one schema);
// per-family additions land as discriminated-union branches; matches
// the CDM posture of "one schema, many compositions".
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10)
//   - Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md
//   - Source brief: Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §2
//   - CLAUDE.md Principle 5 (multi-currency, multi-entity, multi-country
//     from day one — every Product carries `legalEntityId`, `currency`,
//     `jurisdiction` at the type level, non-optional)
//   - CLAUDE.md Principle 1 (events as truth — `lifecycle` is derived
//     from the product-lifecycle event family, never authored)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07) — CDM
//     primitives are the building blocks that compose into a Product
//
// Author: Atlas (substrate authority) · Kai (markets engineering;
// co-author per the source brief's pair-attribution).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Product family — discriminator. M-phase ordering per source brief §2.
// ---------------------------------------------------------------------------

export const productFamilySchema = z.enum([
  /** M1 — listed equity (cash). JSE primary. */
  "listed-equity",
  /** M2 — listed bonds (fixed-coupon, FRN, inflation-linked). */
  "listed-bond",
  /** M2 — repo (open + term, GMRA-framed). */
  "repo",
  /** M3 — OTC interest-rate derivatives (vanilla IRS first; Bermudan/swaption later). */
  "otc-ird",
  /** M4 — FX (spot/forward/swap/NDF; D-FX-* sub-decisions wire the variants). */
  "fx",
  /** M5+ — structured (out of scope at v1; reserved). */
  "structured",
  /** Treasury — short-term money-market funding instruments (MMD, Funding Line). */
  "money-market",
  /** Treasury — interbank loan placements (bank as lender). */
  "interbank-loan",
]);

export type ProductFamily = z.infer<typeof productFamilySchema>;

// ---------------------------------------------------------------------------
// Lifecycle stage — projection over the 12-event product-lifecycle family.
// `lifecycle` on the Product is *derived*, never authored at rest.
// ---------------------------------------------------------------------------

export const productLifecycleStageSchema = z.enum([
  "proposed",
  "conceptualised",
  "due-diligence",
  "approved-conditional",
  "controlled-launch",
  "live",
  "under-review",
  "retired",
]);

export type ProductLifecycleStage = z.infer<typeof productLifecycleStageSchema>;

// ---------------------------------------------------------------------------
// PrimitiveRef — typed reference into the CDM primitives modules.
// ---------------------------------------------------------------------------

export const primitiveRefSchema = z.object({
  /** Module path. Matches the import surface of `@platform/markets/cdm/...`. */
  module: z.enum([
    "@platform/markets/cdm/primitives",
    "@platform/markets/cdm/equity",
    "@platform/markets/cdm/bond",
    "@platform/markets/cdm/repo",
    "@platform/markets/cdm/ird",
    "@platform/markets/cdm/fx",
  ]),
  /** Symbol exported from the module — e.g. `instrumentSchema`, `moneySchema`. */
  symbol: z.string().min(1),
  /** Role this primitive plays in the composition (narrative; consumed by composeProduct). */
  role: z.string().min(1),
});

export type PrimitiveRef = z.infer<typeof primitiveRefSchema>;

// ---------------------------------------------------------------------------
// ExtensionRef — SA-specific or franchise-specific extensions to the CDM.
// Each extension carries a Principle-2 citation anchor.
// ---------------------------------------------------------------------------

export const extensionRefSchema = z.object({
  /** Display name — e.g. "JSE corporate-actions". */
  name: z.string().min(1),
  /** Module path. Free-form (extensions can live anywhere across the platform). */
  module: z.string().min(1),
  /** Obligations-register URN or other Principle-2 anchor for the extension's source. */
  citationUrn: z.string().min(1),
});

export type ExtensionRef = z.infer<typeof extensionRefSchema>;

// ---------------------------------------------------------------------------
// CDM composition rule — primitives + extensions + narrative spec.
// ---------------------------------------------------------------------------

export const cdmCompositionSchema = z.object({
  primitives: z.array(primitiveRefSchema).min(1),
  extensions: z.array(extensionRefSchema),
  /** Narrative composition rule. Consumed by composeProduct() at Slice 3. */
  compositionRule: z.string().min(1),
});

export type CdmComposition = z.infer<typeof cdmCompositionSchema>;

// ---------------------------------------------------------------------------
// Risk profile — populated dimension by dimension by the per-dimension
// agent attestations (per Principle 6 + Q2 resolution).
// ---------------------------------------------------------------------------

export const marketRiskDimensionSchema = z.enum([
  "delta",
  "gamma",
  "vega",
  "theta",
  "rho",
  "curve",
  "basis",
]);

export const riskProfileSchema = z.object({
  marketRiskDimensions: z.array(marketRiskDimensionSchema),
  creditRiskShape: z.enum([
    "no-counterparty",
    "principal-on-settlement",
    "ongoing-bilateral-exposure",
  ]),
  liquidityClassification: z.enum([
    "hqla-eligible-l1",
    "hqla-eligible-l2a",
    "hqla-eligible-l2b",
    "non-hqla",
  ]),
  fundingProfile: z.enum(["cash-funded", "repo-funded", "uncollateralised", "csa-collateralised"]),
  /** Nadia methodology — Tier 1 highest scrutiny (RAS § B7). */
  modelRiskTier: z.enum(["tier-1", "tier-2", "tier-3"]),
});

export type RiskProfile = z.infer<typeof riskProfileSchema>;

// ---------------------------------------------------------------------------
// Accounting classification — Camille (CFO) + Bea slice.
// ---------------------------------------------------------------------------

export const accountingClassificationSchema = z.object({
  ifrs9Family: z.enum(["amortised-cost", "fvtpl", "fvoci"]),
  ifrs13FairValueHierarchy: z.enum(["level-1", "level-2", "level-3"]),
  ias21FxTreatment: z.enum(["monetary", "non-monetary", "n/a"]),
  /** BA-return line refs the product's postings flow into (e.g. "BA100.line.34"). */
  baReturnLineMapping: z.array(z.string().min(1)),
});

export type AccountingClassification = z.infer<typeof accountingClassificationSchema>;

// ---------------------------------------------------------------------------
// Legal documentation — Imani's clause library.
// ---------------------------------------------------------------------------

export const legalDocumentationSchema = z.object({
  // `"fx-bilateral"` added per Imani G-9 (PR #637, 2026-05-20) — required
  // for schema completeness even though it is not on the controlled-launch
  // counterparty whitelist. Kept in sync with
  // `legalDocumentationAgreementTypeSchema` in
  // `platform/event-store/event-types/legal-documentation.ts` (the
  // LegalDocumentationSigned instance-side enum).
  masterAgreement: z.enum([
    "isda-2002",
    "isda-2025",
    "gmra-2011",
    "gmsla-2018",
    "fx-bilateral",
    "none-listed",
  ]),
  ectaExecutionPath: z.enum(["electronic-default", "wet-signature-required", "hybrid"]),
  /** ISO-3166-1 alpha-2 codes. */
  jurisdictionMatrix: z.array(
    z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/),
  ),
});

export type LegalDocumentation = z.infer<typeof legalDocumentationSchema>;

// ---------------------------------------------------------------------------
// Operational readiness.
// ---------------------------------------------------------------------------

export const operationalReadinessSchema = z.object({
  /** Settlement path — e.g. "Strate T+3", "bilateral cash", "Strate-bond". */
  settlementPath: z.string().min(1),
  reconciliationCadence: z.enum(["intraday", "daily", "weekly"]),
  /** M-phase exit ref (e.g. "M1-exit", "M2-exit"). */
  substrateCompletenessGate: z.string().min(1),
});

export type OperationalReadiness = z.infer<typeof operationalReadinessSchema>;

// ---------------------------------------------------------------------------
// Security profile — Senna threat-model + Rashida policy.
// ---------------------------------------------------------------------------

export const securityProfileSchema = z.object({
  /** Citation URN for the threat model. */
  threatModelRef: z.string().min(1),
  hsmCustodyRequired: z.boolean(),
  zeroTrustPosture: z.enum(["default", "elevated"]),
});

export type SecurityProfile = z.infer<typeof securityProfileSchema>;

// ---------------------------------------------------------------------------
// Policy attestation entry — the per-dimension agent attestations
// assemble here. One row per (policy × version × attestation cycle).
// Per Q3 resolution, the per-dimension events also carry a "result"
// flag; here we record the run-level summary.
// ---------------------------------------------------------------------------

export const policyAttestationEntrySchema = z.object({
  /** Today: only D-NEW-PRODUCT-APPROVAL-POLICY. Reserved for future policies. */
  policy: z.literal("D-NEW-PRODUCT-APPROVAL-POLICY"),
  /** Policy version (semver). */
  version: z.string().min(1),
  /** ISO-8601. */
  attestedAt: z.string().min(1),
  /** Agent or human ref — e.g. "agent:Bea" or "human:marc@tgv.co.za". */
  attestedBy: z.string().min(1),
  /** Dimension names that cleared in this cycle. */
  gatesCleared: z.array(z.string().min(1)),
  /** Conditions imposed (open list; the policy's controlled-launch limits land here). */
  conditions: z.array(z.string().min(1)),
});

export type PolicyAttestationEntry = z.infer<typeof policyAttestationEntrySchema>;

// ---------------------------------------------------------------------------
// Product scope — typed, queryable scope axes (D-FX-OTC-NPA-SCOPE-EXPANSION).
//
// Replaces the prior practice of burying instrument set / currency-pair breadth
// / counterparty eligibility / execution venue in the description narrative.
// Optional on the Product (the 8 pre-existing seeded products predate it); FX
// umbrella products carry it. Mirrored as `productScopeForEventSchema` on the
// ProductProposalRegistered / ProductApproved payloads in
// `platform/event-store/event-types/product.ts` — keep the two in sync.
// ---------------------------------------------------------------------------

/** OTC FX instrument variants the umbrella product spans (option = M5 increment). */
export const fxInstrumentVariantSchema = z.enum(["spot", "forward", "swap", "option"]);
export type FxInstrumentVariant = z.infer<typeof fxInstrumentVariantSchema>;

export const productScopeSchema = z.object({
  /** OTC vs exchange-traded execution venue. FX OTC products = "otc". */
  executionVenue: z.enum(["otc", "exchange"]),
  /** FX instrument variants in the approved scope. */
  fxInstrumentVariants: z.array(fxInstrumentVariantSchema).min(1),
  /** Currency-pair breadth: the literal "any" (pair-agnostic) or an explicit list. */
  currencyPairs: z.union([z.literal("any"), z.array(z.string().min(1)).min(1)]),
  /** Counterparty eligibility: a coarse class or an explicit list of types. */
  counterpartyEligibility: z.union([
    z.enum(["all", "institutional", "bank-only"]),
    z.array(z.string().min(1)).min(1),
  ]),
});

export type ProductScope = z.infer<typeof productScopeSchema>;

// ---------------------------------------------------------------------------
// Product — single canonical type, family-discriminated.
//
// Twelve required fields per §2 of the source brief. Multi-X discipline
// (Principle 5): `legalEntityId`, `currency`, `jurisdiction` at the type
// level, NON-OPTIONAL. The earlier brief draft used `entityScope[]` and
// `currencies[]` (arrays); resolved to the singular forms here at the
// canonical-record granularity (a Product is registered against one
// home legal-entity, with one home currency and one home jurisdiction;
// multi-entity / multi-currency / multi-jurisdiction trading on the
// product is captured at the *trade* level via the CDM primitives, not
// at the product-record level).
//
// Q1 single-type resolution: NO `EquityProduct` / `BondProduct` split —
// every family flows through this one schema.
// ---------------------------------------------------------------------------

export const productSchema = z.object({
  /**
   * Stable URN: `prd:bank:<asset-class>:<slug>`. Never reused. Per Q5
   * resolution, material changes increment `version`; new productId is
   * reserved for genuinely new products.
   */
  productId: z
    .string()
    .min(1)
    .regex(/^prd:bank:[a-z]+(-[a-z]+)*:[a-z0-9]+(-[a-z0-9]+)*$/, {
      message:
        "productId must match URN form prd:bank:<asset-class>:<slug> (e.g. prd:bank:equity:jse-equity-cash)",
    }),
  /** Family discriminator — ties to M-phase. */
  family: productFamilySchema,
  /** Semver. New `ProductVersionPublished` events bump this. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, {
    message: "version must be semver MAJOR.MINOR.PATCH",
  }),
  /** Human-readable name. */
  name: z.string().min(1),
  /** One-paragraph description. */
  description: z.string().min(1),

  /** Bounded by project_strategic_foundation.md — institutional / wholesale. */
  franchiseScope: z.enum(["institutional", "wholesale"]),

  // -------------------------------------------------------------------------
  // Multi-X discipline (Principle 5). NON-OPTIONAL.
  // -------------------------------------------------------------------------

  /** Legal-entity ID this product is registered against (Imani's tree). */
  legalEntityId: z.string().min(1),
  /** ISO 4217 home currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** ISO-3166-1 alpha-2 home jurisdiction. */
  jurisdiction: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/),

  // -------------------------------------------------------------------------
  // Composition + lifecycle.
  // -------------------------------------------------------------------------

  cdmComposition: cdmCompositionSchema,
  /** Per-trade lifecycle event types this product produces. Family-specific. */
  lifecycleEventFamily: z.array(z.string().min(1)),

  riskProfile: riskProfileSchema,
  accountingClassification: accountingClassificationSchema,
  legalDocumentation: legalDocumentationSchema,
  operationalReadiness: operationalReadinessSchema,
  securityProfile: securityProfileSchema,

  /** Run-level policy-attestation summaries. Empty array at conceptualisation. */
  policyAttestations: z.array(policyAttestationEntrySchema),

  /**
   * Typed product scope (D-FX-OTC-NPA-SCOPE-EXPANSION). Optional: pre-existing
   * single-instrument products carry it implicitly via their narrative. Umbrella
   * products (e.g. OTC vanilla FX) declare instrument set / pair breadth /
   * counterparty eligibility / venue here so the scope is queryable.
   */
  scope: productScopeSchema.optional(),

  /**
   * Current lifecycle stage. Per Principle 1, this is a *projection* over
   * the product-lifecycle event family — never authored at rest. Stored
   * here for read-convenience; the canonical state always lives in the
   * event log. Vera's slice-8 attestation-integrity recon will assert
   * this field reconciles to the event projection.
   */
  lifecycle: productLifecycleStageSchema,

  /** Principle 2 chain — non-empty enforced. */
  citations: z.array(z.string().min(1)).min(1, {
    message: "P2 violation: every Product must carry at least one obligations-register citation",
  }),
});

export type Product = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// Convenience parser — throws on invalid shape; the only sanctioned way
// to construct a Product. Mirrors the CDM-event factory pattern in
// `platform/markets/cdm/equity.ts`.
// ---------------------------------------------------------------------------

/**
 * Validate-and-parse a candidate Product. Throws on invalid shape.
 *
 * Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 1.
 */
export function parseProduct(candidate: unknown): Product {
  return productSchema.parse(candidate);
}
