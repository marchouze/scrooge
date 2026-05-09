// platform/markets/products/semantic.ts
//
// Semantic-layer entries for the Product layer.
//
// Per CLAUDE.md Principle 1, every quantity below is a *query* over the
// canonical event log — the 12 product-lifecycle events registered in
// §4 of `Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md`
// (the source brief; D-PRODUCT-CONSTRUCTION-SUBSTRATE).
// Per Principle 2, every named quantity carries a citation chain
// (event-payload → projection rule → presentation field).
// Per Principle 6, no orphan: every entry resolves bidirectionally to
// the source brief, the parallel-stream policy proposal
// (D-NEW-PRODUCT-APPROVAL-POLICY) and the Product Register projection.
//
// Authoring location is canonical for the named quantities below
// (per `feedback_canonical_source_registry.md`); presentation surfaces
// (dashboard cells, Product Register projection rows) cite by entry id,
// never by paraphrase.
//
// The Product TypeScript type itself lands in `./types.ts` under Slice 1
// of D-PRODUCT-CONSTRUCTION-SUBSTRATE; this semantic-layer file ships
// ahead of Slice 1 so that the Product Register projection
// (D-NEW-PRODUCT-APPROVAL-POLICY follow-on) reads cleanly. Where this
// file references types that Slice 1 will introduce, the `tsType`
// field uses a string form that Slice 1 will replace with a direct
// `typeof` reference once `types.ts` lands.
//
// Author: Anya (data / analytics engineer) · D-PRODUCT-CONSTRUCTION-SUBSTRATE
//         (CEO approved 2026-05-10) · D-NEW-PRODUCT-APPROVAL-POLICY
//         (CEO approved 2026-05-10).

import type { SemanticLayerEntry as MarketsSemanticLayerEntry } from "../../projections/markets/types";

// ---------------------------------------------------------------------------
// Extended semantic-layer entry shape for the Product layer.
//
// Re-uses the markets `SemanticLayerEntry` shape (id, name, definition,
// cdmPrimitive, projectionRule, presentationField, citations[], unit) and
// adds three Product-layer specifics:
//
//   - tsType — the TypeScript type the entry resolves to. String-typed
//              today; Slice 1 (D-PRODUCT-CONSTRUCTION-SUBSTRATE) replaces
//              with a typeof reference once `./types.ts` lands.
//   - allowedValues — bounded enums where the entry is a finite set
//                     (productFamily, productLifecycleStage, attestation
//                     dimensions, ProductDimensionAttested.result).
//   - multiX — Principle 5 surface: where an entry has implicit currency
//             / entity / jurisdiction context, the entry names it.
//
// The shape extends, not replaces, so Vera's existing semantic-layer
// recon (and the markets index re-export) keeps working.
// ---------------------------------------------------------------------------

export interface ProductSemanticLayerEntry extends MarketsSemanticLayerEntry {
  /** TypeScript type reference. String form until Slice 1 lands `./types.ts`. */
  readonly tsType: string;
  /** Bounded-enum allowed values; empty array if the quantity is open-ended. */
  readonly allowedValues: readonly { readonly value: string; readonly note: string }[];
  /** Principle 5 (multi-X) surface — currency / entity / jurisdiction posture. */
  readonly multiX: {
    readonly currency: "carried-on-Product" | "n/a";
    readonly entity: "carried-on-Product" | "n/a";
    readonly jurisdiction: "carried-on-Product" | "n/a";
  };
}

// ---------------------------------------------------------------------------
// Citation slugs.
//
// `[register: route to Mira]` flags entries whose URN slugs require
// population in `Regulations/_obligations-register.md` once the parallel-
// stream policy lands (per the source brief §4 footnote on the 12 lifecycle
// events).
// ---------------------------------------------------------------------------

const C_DECISION_BRIEF =
  "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md";
const C_DECISION_RECORD =
  "Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md";
const C_POLICY_PROPOSAL = "Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md";
const C_POLICY_RECORD =
  "Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md";
const C_MARKETS_FOUNDATION = "D-MARKETS-SCHEMA-FOUNDATION";
const C_BCBS_NEW_PRODUCT = "BCBS-195-2011"; // Sound Practices for the Management of Operational Risk
const C_REG_39_ROUTE = "[register: route to Mira — Banks Act Reg 39 sub-clauses]";
const C_DOMAIN_J_ROUTE = "[register: route to Mira — Domain J markets/trading URN slugs]";
const C_DOMAIN_N_ROUTE = "[register: route to Mira — Domain N M1 markets-foundation URN slugs]";
/** Slice 3 commit on main — Atlas + Kai composeProduct runtime + M1/M2 fixtures. */
const C_SLICE3_COMMIT = "commit:0019c07 — D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 (PR #115)";
/** Source brief §3 — composition rule + worked examples. */
const C_BRIEF_SECTION_3 =
  "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §3 (composition rule, worked examples)";
/**
 * Slice 8 substrate gap from Atlas's Slice 3 completion report — the
 * djb2-style fingerprint in `composeProduct.ts` is *deterministic*, not
 * *integrity-protected*. HSM-keyed cryptographic hash lands at Slice 8
 * (cloud lift) once Senna's HSM custody substrate is up. Recorded as a
 * structured citation so Vera's recon can detect closure.
 */
const C_SLICE8_HSM_GAP =
  "[substrate-gap: HSM-keyed integrity hash for ProductTemplate.fingerprint — Slice 8 cloud lift; today's djb2 digest is deterministic, not integrity-protected; integrity comes from the event log per Principle 1]";

// ---------------------------------------------------------------------------
// Allowed-value tables — verified against the source brief / policy
// proposal. The single source of truth for the values is the cited
// section; this table is a typed mirror, never a paraphrase.
// ---------------------------------------------------------------------------

/**
 * Product family discriminator. Source: source brief §2 `ProductFamily`.
 *
 * Note: the URN slug used in `productId` is shorter than the discriminator
 * in some cases (e.g. discriminator `listed-equity` → URN slug `equity`;
 * discriminator `otc-ird` → URN slug `ird`). The discriminator is
 * canonical here; URN-slug mapping is fixed in §3 worked examples and
 * surfaced under `productId.allowedValues` below.
 */
const PRODUCT_FAMILY_VALUES: readonly { readonly value: string; readonly note: string }[] = [
  { value: "listed-equity", note: "M1 — JSE listed cash equities; live today." },
  { value: "listed-bond", note: "M2 — listed bonds (SAGB and corporate)." },
  { value: "repo", note: "M2 — open / term repo, GMRA-framed." },
  { value: "otc-ird", note: "M3 — OTC interest-rate derivatives (vanilla IRS first)." },
  { value: "fx", note: "M4 — FX swaps, FX forwards (PvP via correspondent)." },
  { value: "structured", note: "M5+ — structured products combining primitives across families." },
];

/**
 * Product lifecycle stage. Source: source brief §2 `ProductLifecycleStage`.
 * The stage is *derived* from the 12 lifecycle events (source brief §4) —
 * never authored. The mapping below names the event whose appearance
 * causes the projection to land on that stage.
 */
const PRODUCT_LIFECYCLE_STAGE_VALUES: readonly {
  readonly value: string;
  readonly note: string;
}[] = [
  {
    value: "proposed",
    note: "Stage 1 — landed via `ProductProposalRegistered`. Source brief §4 row 1.",
  },
  {
    value: "conceptualised",
    note: "Stage 2 — landed via `ProductConceptualised`. Source brief §4 row 2.",
  },
  {
    value: "due-diligence",
    note: "Stage 3 — between `ProductConceptualised` and `ProductDueDiligence(Completed|Withheld)`; the 14 `ProductDimensionAttested` events land in this window.",
  },
  {
    value: "approved-conditional",
    note: "Stage 4 — landed via `ProductApproved` with conditions[] non-empty. Source brief §4 row 6.",
  },
  {
    value: "controlled-launch",
    note: "Stage 5 — landed via `ProductLaunched`. Source brief §4 row 8.",
  },
  {
    value: "live",
    note: "Steady-state operation. Reached when controlled-launch limits expire after `ProductPostImplementationReviewCompleted` with verdict `continue` or `continue-with-amended-conditions` (policy proposal §8).",
  },
  {
    value: "under-review",
    note: "Annual review window — between `ProductReviewCompleted` events (source brief §4 row 10). Re-attestation of all 14 dimensions runs in this window.",
  },
  {
    value: "retired",
    note: "Terminal stage — landed via `ProductRetired`. Source brief §4 row 11.",
  },
];

/**
 * The 14 due-diligence dimensions from the parallel-stream policy
 * proposal `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md`
 * §5 (rows 1–14). Each dimension binds to a responsible agent (source
 * brief §5(b) mapping); this table records the dimension key, the
 * responsible governance seat, and the engineering implementer.
 *
 * The dimension key is the canonical value of `ProductDimensionAttested.dimension`.
 * Per Q2 resolution, the per-dimension agent emits its own attestation.
 */
const PRODUCT_DIMENSION_VALUES: readonly {
  readonly value: string;
  readonly note: string;
}[] = [
  {
    value: "market-risk",
    note: "Helena (CRO) governance / Rohan engineering. Sensitivity profile + Tier-classification gate. Policy §5 row 1.",
  },
  {
    value: "credit-risk",
    note: "Helena (CRO) governance / Rohan engineering. SA-CCR + concentration gate. Policy §5 row 2.",
  },
  {
    value: "liquidity-risk",
    note: "Eitan (Treasurer) governance / Ravi engineering. LCR/NSFR + HQLA + FTP gate. Policy §5 row 3.",
  },
  {
    value: "operational-risk",
    note: "Devon (COO) governance / Atlas + Tomas engineering. Process-readiness + scenario set + IBS intersection. Policy §5 row 4.",
  },
  {
    value: "operational-readiness",
    note: "Devon (COO) governance / Atlas + Tomas + Kai engineering. Substrate-completeness attestation. Policy §5 row 5.",
  },
  {
    value: "accounting",
    note: "Camille (CFO) governance / Bea engineering. IFRS 9 SPPI + IFRS 13 hierarchy + IAS 21 + sub-ledger map + BA-return cells. Policy §5 row 6.",
  },
  {
    value: "capital",
    note: "Camille (CFO) governance / Bea + Rohan engineering. RWA delta + capital headroom + Pillar 2A. Policy §5 row 7.",
  },
  {
    value: "conduct",
    note: "Zara (CCO) governance / Mira engineering. FAIS treatment + FSCA Conduct Standards 1–3 of 2018 + TCF posture. Policy §5 row 8.",
  },
  {
    value: "aml",
    note: "Zara (CCO) governance / Mira engineering. CDD pathway + sanctions + PEP + STR/CTR shape. Policy §5 row 9.",
  },
  {
    value: "model-risk",
    note: "Helena (CRO) governance / Nadia engineering. Tier-classification under Nadia methodology library. Policy §5 row 10.",
  },
  {
    value: "legal",
    note: "(interim Devon → future GC) governance / Imani engineering. Master-agreement + ECTA execution + dispute-resolution + jurisdiction matrix. Policy §5 row 11.",
  },
  {
    value: "infosec",
    note: "Rashida (CISO) governance / Senna engineering. Threat model + HSM custody + zero-trust + IBS impact. Policy §5 row 12.",
  },
  {
    value: "privacy",
    note: "Iris (IO) governance / Senna engineering. POPIA classification + cross-border + retention-schedule. Policy §5 row 13.",
  },
  {
    value: "tax",
    note: "Camille (CFO) governance / Yael engineering. VAT + STT + FATCA/CRS + transfer-pricing + s.24J. Policy §5 row 14.",
  },
];

/**
 * `ProductDimensionAttested.result` allowed values. Source: Q3 resolution
 * in `[C_DECISION_RECORD]` — typed events with the design-vs-implementation
 * distinction.
 */
const PRODUCT_DIMENSION_RESULT_VALUES: readonly {
  readonly value: string;
  readonly note: string;
}[] = [
  {
    value: "design-attested",
    note: "Dimension is design-clear; underlying substrate not yet built (M2-M4 design-attestations). Source: Q3 resolution.",
  },
  {
    value: "implementation-attested",
    note: "Dimension is implementation-clear; substrate exists and the gate is runtime-clear. Source: Q3 resolution.",
  },
];

// ---------------------------------------------------------------------------
// Product-layer semantic entries.
//
// Six entry-groups:
//   1. productId
//   2. productFamily
//   3. productVersion
//   4. productLifecycleStage
//   5. Per-dimension attestation surface — 14 dimensions + the `dimension`
//      and `result` enum entries that bound the `ProductDimensionAttested`
//      payload.
//   6. Composition-runtime surface (Slice 3 follow-on) —
//      productTemplate (the composeProduct() output) + compositionFingerprint
//      (the deterministic stable-hash field on ProductTemplate). Both
//      land here as Anya's follow-on to Atlas (Core banking platform
//      architect) Slice 3 PR #115; gap surfaced in the Slice 3 completion
//      report.
// ---------------------------------------------------------------------------

export const PRODUCT_SEMANTIC_LAYER_ENTRIES: readonly ProductSemanticLayerEntry[] = [
  // ---- 1. productId -------------------------------------------------------
  {
    id: "product-id",
    name: "Product ID",
    definition:
      "Stable URN identifying a product across versions. Format: `prd:bank:<asset-class>:<slug>`. Per Q5 resolution, a material change to a product increments `productVersion` on the same `productId`; a new `productId` is reserved for genuinely new products.",
    cdmPrimitive: "ProductProposalRegistered.productId (issued at stage 1; immutable thereafter)",
    projectionRule:
      "markets.product-register — folds `ProductProposalRegistered.productId` into the Product Register key; stable across all 12 lifecycle events for the same product.",
    presentationField: "Markets ▸ Product Register ▸ Product ID",
    citations: [C_DECISION_BRIEF, C_DECISION_RECORD, C_MARKETS_FOUNDATION, C_DOMAIN_J_ROUTE],
    unit: "urn",
    tsType: "string /* Slice 1: Product['productId'] */",
    allowedValues: [
      {
        value: "prd:bank:equity:jse-equity-cash",
        note: "M1 — JSE listed cash equities. Source brief §3.1.",
      },
      {
        value: "prd:bank:bond:sagb-fixed-coupon",
        note: "M2 — vanilla fixed-coupon SAGB bond. Source brief §3.2.",
      },
      {
        value: "prd:bank:repo:open-repo-gmra",
        note: "M2 — open repo, GMRA-framed. Source brief §3.3.",
      },
      {
        value: "prd:bank:ird:vanilla-zar-fix-zaronia",
        note: "M3 — vanilla ZAR fixed-vs-ZARONIA IRS. Source brief §3.4.",
      },
      {
        value: "prd:bank:fx:fx-swap-usdzar",
        note: "M4 — FX swap (USD/ZAR). Source brief §3.5.",
      },
    ],
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },

  // ---- 2. productFamily ---------------------------------------------------
  {
    id: "product-family",
    name: "Product family",
    definition:
      "Discriminator on the canonical `Product` discriminated union (Q1 resolution — one canonical type with `family` discriminator). Bounded enum; ties each product to its M-phase sequencing per the source brief §6.",
    cdmPrimitive:
      "ProductConceptualised.cdmComposition (bound to family at conceptualisation; immutable thereafter unless the product retires and a successor product is registered)",
    projectionRule:
      "markets.product-register — folds the family discriminator from `ProductConceptualised`; stable across versions; presented as a column for filtering and grouping.",
    presentationField: "Markets ▸ Product Register ▸ Family",
    citations: [C_DECISION_BRIEF, C_DECISION_RECORD, C_MARKETS_FOUNDATION],
    unit: "enum",
    tsType: "ProductFamily /* Slice 1: discriminated-union tag in ./types.ts */",
    allowedValues: PRODUCT_FAMILY_VALUES,
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },

  // ---- 3. productVersion --------------------------------------------------
  {
    id: "product-version",
    name: "Product version",
    definition:
      "Monotonic non-decreasing version identifier per `productId`. Per Q5 resolution, incremented on `ProductVersionPublished` for material changes (e.g. M1 adds JSE-ETF support); a new `productId` is reserved for genuinely new products. The brief uses semver in §2; this entry binds to the `version` payload field on `ProductVersionPublished` and the version stamp on `ProductApproved`.",
    cdmPrimitive:
      "ProductVersionPublished.newVersion (post-publication); ProductApproved.version (latest approved)",
    projectionRule:
      "markets.product-register — folds `ProductVersionPublished` into the per-product version sequence; the projection's `currentVersion` row is the most-recent published version; the projection's `approvedVersion` row is the most-recent `ProductApproved` for that product.",
    presentationField: "Markets ▸ Product Register ▸ Version",
    citations: [C_DECISION_BRIEF, C_DECISION_RECORD],
    unit: "semver",
    tsType: "string /* semver — Slice 1: Product['version'] */",
    allowedValues: [],
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },

  // ---- 4. productLifecycleStage ------------------------------------------
  {
    id: "product-lifecycle-stage",
    name: "Product lifecycle stage",
    definition:
      "Bounded enum derived from the 12-event lifecycle family (source brief §4). The stage is a *projection* over the event stream — never authored. Each value names the event whose appearance lands the product on that stage.",
    cdmPrimitive:
      "Derived from the 12 lifecycle events: ProductProposalRegistered, ProductConceptualised, ProductDueDiligenceCompleted, ProductDueDiligenceWithheld, ProductDimensionAttested, ProductApproved, ProductWithheld, ProductLaunched, ProductPostImplementationReviewCompleted, ProductReviewCompleted, ProductRetired, ProductVersionPublished.",
    projectionRule:
      "markets.product-register — fold(state, event): each stage-boundary event transitions the lifecycle stage per source brief §5 worked example. Replay-fold rule `append-only-audit` per source brief §4. The Product's *current state* is a projection — never stored as authoritative (Principle 1).",
    presentationField: "Markets ▸ Product Register ▸ Lifecycle stage",
    citations: [C_DECISION_BRIEF, C_DECISION_RECORD, C_BCBS_NEW_PRODUCT, C_REG_39_ROUTE],
    unit: "enum",
    tsType: "ProductLifecycleStage /* Slice 1: enum in ./types.ts */",
    allowedValues: PRODUCT_LIFECYCLE_STAGE_VALUES,
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },

  // ---- 5. Per-dimension attestation surface ------------------------------
  // 5a — the ProductDimensionAttested event shape (the surface itself).
  {
    id: "product-dimension-attestation",
    name: "Product dimension attestation",
    definition:
      "Typed attestation by the responsible agent that a single due-diligence dimension is cleared for a product version. Per Q2 resolution, the per-dimension agent emits its own attestation (Principle 7); per Q3 resolution, attestations are typed events with `result` distinguishing design vs implementation. A `ProductApproved` event cannot validly fire until all 14 `ProductDimensionAttested` events have landed for the same `productId @ version` (source brief §5(d)); Vera's slice-8 recon asserts this discipline.",
    cdmPrimitive:
      "ProductDimensionAttested { productId, version, dimension, result, attestedBy, attestedAt, citationChain }",
    projectionRule:
      "markets.product-register — fold(state, event): for each `ProductDimensionAttested`, set the per-product per-version per-dimension cell to the attestation tuple; the projection asserts 14-of-14 coverage before a `ProductApproved` may land.",
    presentationField: "Markets ▸ Product Register ▸ Attestations ▸ <dimension>",
    citations: [
      C_DECISION_BRIEF,
      C_DECISION_RECORD,
      C_POLICY_PROPOSAL,
      C_POLICY_RECORD,
      C_DOMAIN_J_ROUTE,
      C_DOMAIN_N_ROUTE,
    ],
    unit: "tuple",
    tsType:
      "ProductDimensionAttestedPayload /* Slice 2: registered in event-types.ts; payload defined in ./types.ts */",
    allowedValues: [],
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },
  // 5b — the `dimension` field enum (the 14 dimensions).
  {
    id: "product-dimension",
    name: "Product dimension (attestation key)",
    definition:
      "Bounded enum naming the 14 due-diligence dimensions of the New Product Approval Policy (policy proposal §5 rows 1–14). Each value is the canonical attestation key — the `dimension` field on `ProductDimensionAttested`. The brief's §5(b) dispatch table maps each dimension to its responsible governance seat and engineering implementer; the `note` field on each allowed value records that mapping inline so the Product Register projection can render the attestation grid without re-deriving it.",
    cdmPrimitive: "ProductDimensionAttested.dimension",
    projectionRule:
      "markets.product-register — used as the second key in the per-product per-version attestation map; presented as a fixed grid of 14 columns on the Product Register dashboard.",
    presentationField: "Markets ▸ Product Register ▸ Attestation grid (column header)",
    citations: [C_POLICY_PROPOSAL, C_POLICY_RECORD, C_DECISION_BRIEF, C_DECISION_RECORD],
    unit: "enum",
    tsType: "ProductDimension /* Slice 1/2: union of the 14 string literals */",
    allowedValues: PRODUCT_DIMENSION_VALUES,
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },
  // 5c — the `result` field enum (design vs implementation).
  {
    id: "product-dimension-attestation-result",
    name: "Product dimension attestation result",
    definition:
      'Bounded enum on the `result` field of `ProductDimensionAttested`. Per Q3 resolution, M2-M4 design-attestations are persisted as typed events with `result: "design-attested"`; substrate-built dimensions attest with `result: "implementation-attested"`. The design→implementation transition becomes a typed event-pair under one `productId @ version`.',
    cdmPrimitive: "ProductDimensionAttested.result",
    projectionRule:
      "markets.product-register — folded into the per-dimension cell as the second tuple element; the projection's coverage check accepts either value (gate is *attestation existence*, not implementation completeness — but Vera's recon flags products where >0 dimensions are still `design-attested` at controlled-launch start).",
    presentationField: "Markets ▸ Product Register ▸ Attestation grid (cell badge)",
    citations: [C_DECISION_RECORD, C_DECISION_BRIEF],
    unit: "enum",
    tsType: "ProductDimensionAttestationResult /* Slice 1/2 */",
    allowedValues: PRODUCT_DIMENSION_RESULT_VALUES,
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },

  // ---- 6. Composition-runtime surface (Slice 3 follow-on) ----------------
  // 6a — productTemplate (the composeProduct() output).
  {
    id: "product-template",
    name: "Product template",
    definition:
      "The runtime-resolved view of a Product's composition: validated CDM primitives + family-specific extensions + composition rule + deterministic fingerprint, produced by `composeProduct(primitives, extensions, compositionRule)` (or the convenience overload `composeFromProduct(product)`). Same input → identical ProductTemplate every time (sorted by stable address; serialisable as JSON). Per Q1 single-type discipline, this is the only composition path — M1 listed-equity, M2 SAGB-bond, M2 repo, M3 IRS, M4 FX swap all flow through this one function.",
    cdmPrimitive:
      "composeProduct(primitives, extensions, compositionRule) → ProductTemplate; convenience overload composeFromProduct(product) reads product.cdmComposition.{primitives, extensions, compositionRule}. Source: prototype/platform/markets/products/composeProduct.ts §lines 67–82 (productTemplateSchema), §lines 102–142 (composeProduct).",
    projectionRule:
      "Not directly persisted. ProductTemplate is a *derived view* over the Product record — recomputable from `product.cdmComposition` at any point in time (Principle 1). Downstream slices (Slice 4 policy-attestation runtime; the Product Register projection) will fold composition fingerprints into per-product per-version cells; the template itself is not stored as authoritative state.",
    presentationField: "Markets ▸ Product Register ▸ Composition (drill-down view)",
    citations: [
      C_DECISION_BRIEF,
      C_DECISION_RECORD,
      C_BRIEF_SECTION_3,
      C_SLICE3_COMMIT,
      C_DOMAIN_J_ROUTE,
    ],
    unit: "object",
    tsType:
      "ProductTemplate /* z.infer<typeof productTemplateSchema> from @platform/markets/products/composeProduct (composeProduct.ts:84) */",
    allowedValues: [],
    // Multi-X (Principle 5):
    //
    // [verify: ProductTemplate does NOT directly carry legalEntityId,
    // currency, jurisdiction — those live on the upstream `Product`
    // record (types.ts §lines 285, 287, 292) which the template is
    // derived from. The template's fields are
    // `{primitives, extensions, compositionRule, fingerprint}` only.]
    //
    // The triple is therefore *carried-on-Product* (not on the template
    // itself); a ProductTemplate is meaningful only in the context of
    // its source Product, which carries the singular
    // legalEntityId/currency/jurisdiction. Multi-X compliance is
    // satisfied at the Product layer; the template inherits it by
    // reference. If a future Slice extends ProductTemplate to carry the
    // triple inline (e.g. for cross-entity composition), the multiX
    // values below must be revisited.
    multiX: {
      currency: "carried-on-Product",
      entity: "carried-on-Product",
      jurisdiction: "carried-on-Product",
    },
  },
  // 6b — compositionFingerprint (the deterministic stable hash on ProductTemplate).
  {
    id: "composition-fingerprint",
    name: "Composition fingerprint",
    definition:
      'Deterministic stable digest over a ProductTemplate\'s canonicalised primitives + extensions + composition rule. Same inputs → identical fingerprint every time. Recomputable from event-log replay (Principle 1) — given a Product\'s `cdmComposition` payload at any point in time, `composeProduct(...)` reproduces the same fingerprint. v1 form: `pt-v1-<8-hex-djb2>-len<canonical-json-length>` per `computeFingerprint` in composeProduct.ts §lines 160–193. Today\'s digest is *deterministic*, not *integrity-protected*; integrity is supplied by the event log itself.',
    cdmPrimitive:
      "ProductTemplate.fingerprint — composeProduct.ts:81 (`fingerprint: z.string().min(1)` on productTemplateSchema); produced by computeFingerprint(resolvedPrimitives, resolvedExtensions, compositionRule) at composeProduct.ts:160.",
    projectionRule:
      "markets.product-register (planned, Slice 4 follow-on) — folds the fingerprint into the per-product per-version composition cell as the stable identity of a unique composition. Equality test: equal `compositionFingerprint` across two `ProductTemplate` instances ⇒ equal substantive composition (modulo metadata). The projection's drift-detector flags any Product whose recomputed fingerprint diverges from the fingerprint embedded in its `ProductProposed` / `ProductVersionPublished` event payload — that divergence is a Vera-recon finding (composition-integrity invariant).",
    presentationField: "Markets ▸ Product Register ▸ Composition fingerprint (cell badge)",
    citations: [
      C_DECISION_BRIEF,
      C_DECISION_RECORD,
      C_BRIEF_SECTION_3,
      C_SLICE3_COMMIT,
      C_SLICE8_HSM_GAP,
    ],
    unit: "digest",
    tsType:
      'string /* ProductTemplate["fingerprint"] — z.string().min(1); v1 format `pt-v1-<8-hex>-len<n>`. Slice 8 may swap to a Brand<string, "CompositionFingerprint"> once HSM-keyed substrate lands. */',
    allowedValues: [],
    // Multi-X (Principle 5): n/a at the fingerprint level — the
    // fingerprint is a content hash over the composition payload only,
    // not a record carrying entity / currency / jurisdiction. The
    // Product the fingerprint identifies carries the triple; the
    // fingerprint itself is jurisdiction-agnostic by design (the same
    // composition cited for two legal entities yields the same
    // fingerprint, which is the desired property — composition identity
    // is independent of entity-scope).
    multiX: {
      currency: "n/a",
      entity: "n/a",
      jurisdiction: "n/a",
    },
  },
];

// ---------------------------------------------------------------------------
// Multi-X compliance (Principle 5).
//
// The Product object itself carries `currencies[]` (ISO 4217), `entityScope[]`
// (Imani's legal-entity tree IDs), and `legalDocumentation.jurisdictionMatrix[]`
// (ISO-3166-1 alpha-2). Those arrays are first-class fields on the Product
// type (source brief §2) — not on the entries above, which are *identity*
// quantities (productId / family / version / lifecycle / attestation
// surface). The currency / entity / jurisdiction surface is therefore
// `n/a` at the per-entry level and `carried-on-Product` at the Product
// level. When Slice 1 lands, this file gains three further entries
// (`product-currencies`, `product-entity-scope`, `product-jurisdiction-matrix`)
// each with `multiX.<dim>: "carried-on-Product"`. Tracked as a substrate
// gap below.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Substrate gaps surfaced.
//
// 1. The `Product` TypeScript type itself — Slice 1 of
//    D-PRODUCT-CONSTRUCTION-SUBSTRATE — has not yet landed; this file
//    references types (`ProductFamily`, `ProductLifecycleStage`,
//    `ProductDimension`, `ProductDimensionAttestedPayload`,
//    `ProductDimensionAttestationResult`) by string until Slice 1 lands
//    `prototype/platform/markets/products/types.ts`. The `tsType` field
//    on each entry above is the rebind point.
// 2. The 12 product-lifecycle event types — Slice 2 of
//    D-PRODUCT-CONSTRUCTION-SUBSTRATE — are not yet registered in
//    `event-types.ts` / `registry.ts`. The `cdmPrimitive` fields above
//    name the events that will appear once Slice 2 lands.
// 3. The Product Register projection — downstream of slices 1-2 and the
//    policy-attestation runtime (Slice 4) — is not yet built. The
//    `projectionRule` fields above describe the projection
//    `markets.product-register` will implement; the projection itself
//    is a separate authorisation card.
// 4. URN-slug routing — `Domain J markets/trading` and `Domain N M1
//    markets-foundation` URN slugs require population in
//    `Regulations/_obligations-register.md` (per source brief §4
//    register-route footnote and policy proposal §5 tax-row note); flagged
//    `[register: route to Mira]` in the citation chains above.
// 5. Banks Act Reg 39 sub-clauses on product approval — flagged in source
//    brief §10; route to Mira.
// 6. Multi-X identity entries (`product-currencies`, `product-entity-scope`,
//    `product-jurisdiction-matrix`) — land alongside Slice 1 since they
//    bind directly to fields on the `Product` type.
// 7. HSM-keyed integrity hash for `ProductTemplate.fingerprint` —
//    surfaced by Atlas (Core banking platform architect) in the Slice 3
//    completion report. Slice 8 (cloud lift) will swap the v1 djb2
//    digest in `composeProduct.ts:160` for an HSM-keyed cryptographic
//    hash once Senna's HSM-custody substrate lands. The semantic-layer
//    `composition-fingerprint` entry above carries `C_SLICE8_HSM_GAP`
//    in its citation chain so Vera's recon can detect closure when
//    the upgrade lands.
// ---------------------------------------------------------------------------
