// v2-core/regulatory-returns/capture-capability-map.ts
//
// THE C ENGINE — derive-from-composition. The primary truth of "what return-
// data attributes does this product capture?" is DERIVED from the composition
// the product already declares: its `filTypeScopes` (the FIL-taxonomy menu
// pick) × its resolved `reportingTreatmentModuleIds` (the reporting-treatment
// menu pick, per D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). No parallel self-
// warranty list: a product cannot CLAIM to capture an attribute — it captures
// an attribute IFF its composition structurally implies the product carries it.
//
// This module is pure CODE, not stored state. `CAPTURE_CAPABILITY_MAP` is the
// append-only-by-convention table of rows; each row asserts "composition that
// matches THIS predicate → these attributes are captured, on THIS regulatory
// basis (cites)". `deriveCapturedAttributes` folds a product's composition
// through the table.
//
// THE HONEST CEILING (Engineering Charter cmd 4 — source, don't hardcode; cmd 3
// — no green by concealment). A row may ONLY assert composition→attribute where
// the implication genuinely holds for EVERY instance of the matched
// composition. Two consequences:
//   - We seed rows ONLY for attributes a product's TYPE/treatment determines
//     (fx notional/currencyPair from `fil:type:fx:*`; counterpartyId/ead/pfe
//     from `regulatoryApproach = sa-ccr`; exposureClass/pd/lgd from
//     `standardised-credit-risk`).
//   - We DELIBERATELY do NOT add a row for an attribute that is sourced at the
//     INSTANCE or CHART-OF-ACCOUNTS level rather than determined by the product
//     type — e.g. `hqlaLevel` (a CoA classification of the specific asset held).
//     Fabricating a composition mapping for such an attribute to force a gate
//     pass is a Charter cmd-4 violation; that is the D (declaration) path, and
//     `recon:product-return-capture-coherence` makes a fabricated row a loud
//     failure (it asserts a declared override is NOT C-derivable, and that every
//     row's cites resolve).
//
// FAIL-CLOSED (cmd 2 / cmd 5): an unresolved treatment pick
// (`resolved.unresolvedModuleIds` non-empty) means the product's composition is
// not fully known → the caller treats EVERY required attribute as NOT captured
// (the gate blocks or defers). We never derive a capture from a partially-
// resolved composition.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation); D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { matchesFilScope } from "../fil-core/urn";
import { type ReturnAttributeKey, returnAttributeKeySchema } from "./return-attribute";

// ---------------------------------------------------------------------------
// Row schema — parsed fail-closed at load (cmd 2).
// ---------------------------------------------------------------------------

/**
 * The composition AXIS a capability row matches on:
 *   - "fil-scope": the row matches when one of the product's `filTypeScopes`
 *     is covered by the row's `match` scope pattern (e.g. `fil:type:fx:*`).
 *   - "treatment-prudential-approach": the row matches when the product's
 *     resolved prudential `regulatoryApproach` equals the row's `match`
 *     (e.g. `sa-ccr`, `standardised-credit-risk`). The most regulatory-load-
 *     bearing axis: the capital approach a product's instances are measured
 *     under determines the credit/counterparty attributes the returns need.
 */
export const captureAxisSchema = z.enum(["fil-scope", "treatment-prudential-approach"]);
export type CaptureAxis = z.infer<typeof captureAxisSchema>;

export const captureCapabilityRowSchema = z
  .object({
    /** Stable id for the row (provenance in derivation output + recon). */
    id: z.string().min(1),
    axis: captureAxisSchema,
    /**
     * The value matched on the axis. For `fil-scope` a `fil:type:…` scope
     * pattern; for `treatment-prudential-approach` a `regulatoryApproach` enum
     * value. Non-empty; the recon asserts a `fil-scope` match is a valid
     * pattern shape.
     */
    match: z.string().min(1),
    /**
     * The return-data attributes this composition GENUINELY captures for EVERY
     * matched instance. At least one; each a grounded attribute key (the recon
     * asserts each resolves to a real authored-contract requirement).
     */
    attributes: z.array(returnAttributeKeySchema).min(1),
    /**
     * Why this composition implies these attributes — Principle-2 citations
     * (regulation / obligation / decision ids). At least one; the recon asserts
     * each resolves. NEVER empty — a row with no regulatory basis is a fabricated
     * mapping (cmd 4).
     */
    cites: z.array(z.string().min(1)).min(1),
    /** Plain-language justification — the human-readable basis for the row. */
    rationale: z.string().min(1),
  })
  .strict();
export type CaptureCapabilityRow = z.infer<typeof captureCapabilityRowSchema>;

// ---------------------------------------------------------------------------
// THE MAP — append-only-by-convention. Edits are regression-pinned (a row that
// flips a past approval = loud test failure, see capture-capability-map.test.ts).
// ---------------------------------------------------------------------------

const RAW_CAPTURE_CAPABILITY_MAP: readonly CaptureCapabilityRow[] = [
  // --- FX (fil-scope axis) ----------------------------------------------------
  // An FX product's TYPE determines the instrument economics every FX trade
  // carries: the notional, the currency pair, and the settlement date are
  // intrinsic to a `fil:type:fx:*` instrument. (Conservative: we claim only the
  // three the FX returns universally need; not e.g. forward points, which are
  // forward/swap-variant-specific — that is a per-variant claim, deferred.)
  {
    id: "fx-instrument-economics",
    axis: "fil-scope",
    match: "fil:type:fx:*",
    attributes: ["fxNotional", "currencyPair", "settlementDate"],
    cites: ["D-BA-RETURN-DATA-CONTRACT", "fil:type:fx"],
    rationale:
      "Every FX instrument (fil:type:fx:*) carries a notional, a currency pair, and a settlement date as intrinsic type economics — the product type determines them for all instances.",
  },

  // --- Counterparty credit (SA-CCR) (treatment axis) --------------------------
  // A product measured under SA-CCR for counterparty EAD is, by that very
  // approach, one whose instances carry a counterparty identity and a
  // replacement-cost / PFE / EAD decomposition — the SA-CCR method is DEFINED
  // over those quantities. So a product whose resolved prudential approach is
  // sa-ccr captures counterpartyId / ead / pfe by construction.
  {
    id: "sa-ccr-counterparty-ead",
    axis: "treatment-prudential-approach",
    match: "sa-ccr",
    attributes: ["counterpartyIdentity", "ead", "pfe"],
    cites: ["D-BA-RETURN-DATA-CONTRACT", "BCBS-SA-CCR"],
    rationale:
      "SA-CCR is defined over a counterparty's replacement cost and potential future exposure; a product measured under sa-ccr necessarily carries counterparty identity and the EAD/PFE decomposition for every instance.",
  },

  // --- Standardised credit risk (treatment axis) ------------------------------
  // A product measured under the standardised credit-risk approach is, by that
  // approach, slotted into a regulatory exposure class and carries the risk
  // parameters the approach reads. We claim ONLY the attributes the standardised
  // approach determines at the PRODUCT-TYPE level: the regulatory exposure
  // class. PD/LGD are obligor/instance-level estimates (an IRB-flavoured input),
  // NOT determined by the standardised product type — claiming them here would
  // over-reach (cmd 4); they remain a declaration/gap concern per product.
  {
    id: "standardised-credit-exposure-class",
    axis: "treatment-prudential-approach",
    match: "standardised-credit-risk",
    attributes: ["exposureClass"],
    cites: ["D-BA-RETURN-DATA-CONTRACT", "BCBS-CRE-STANDARDISED"],
    rationale:
      "The standardised credit-risk approach slots an exposure into a regulatory exposure class determined by the product type; that class is captured for every instance of such a product. PD/LGD are obligor/instance estimates, not product-type-determined, so are NOT claimed here.",
  },
];

/**
 * The canonical capability map — parsed fail-closed at module load. A malformed
 * row throws here rather than half-loading (cmd 2). Frozen so no caller mutates
 * the derivation basis at runtime (replay determinism).
 */
export const CAPTURE_CAPABILITY_MAP: readonly CaptureCapabilityRow[] = Object.freeze(
  RAW_CAPTURE_CAPABILITY_MAP.map((r) => captureCapabilityRowSchema.parse(r)),
);

// ---------------------------------------------------------------------------
// Derivation.
// ---------------------------------------------------------------------------

/** Provenance for one derived attribute — which row(s) implied it. */
export interface DerivedAttributeProvenance {
  readonly attribute: ReturnAttributeKey;
  /** The capability-row ids that derived this attribute (sorted, deduplicated). */
  readonly rowIds: readonly string[];
}

export interface DerivedCapture {
  /** The set of attributes the composition captures (sorted, deduplicated). */
  readonly attributes: ReadonlySet<ReturnAttributeKey>;
  /** Per-attribute provenance (which rows derived it) — sorted by attribute. */
  readonly provenance: readonly DerivedAttributeProvenance[];
  /**
   * Composition the engine could not match to ANY row — surfaced, not swallowed
   * (cmd 5). Used by the recon to flag composition that no row covers (a hint
   * that a return needs a new map row or a declaration). Each entry is a
   * `<axis>:<value>` token (e.g. `treatment-prudential-approach:irb`).
   */
  readonly unmatchedComposition: readonly string[];
  /**
   * True when the product's composition was NOT fully resolvable (an unresolved
   * treatment pick). FAIL-CLOSED: when true, `attributes` is EMPTY regardless of
   * any partial match — the caller must not treat a partially-known product as
   * capturing anything.
   */
  readonly compositionUnresolved: boolean;
}

/**
 * The NARROW, package-boundary-safe view of a product's resolved composition the
 * C engine reads. The full `ResolvedProductTreatments` lives in `platform/`
 * (which `v2-core/` may not import — `recon:v2-no-v1-import`); the gate adapts
 * the resolver's output into this shape at the v1↔v2 boundary. We read only the
 * facets that ground a capability row: the prudential regulatory approach and
 * whether any treatment pick failed to resolve.
 */
export interface ResolvedCompositionView {
  /**
   * The product's resolved prudential regulatory approach (e.g. "sa-ccr",
   * "standardised-credit-risk"), or `undefined` if no prudential treatment is
   * composed. Matched on the `treatment-prudential-approach` axis.
   */
  readonly regulatoryApproach: string | undefined;
  /**
   * Treatment-module ids that were picked but did NOT resolve against the
   * registry. Non-empty ⇒ composition not fully known ⇒ fail-closed (derive
   * nothing).
   */
  readonly unresolvedModuleIds: readonly string[];
}

/** The composition inputs the C engine derives from. */
export interface ProductComposition {
  /** The product's declared FIL-taxonomy scope patterns. */
  readonly filTypeScopes: readonly string[];
  /** The product's RESOLVED reporting treatments (narrow boundary-safe view). */
  readonly resolved: ResolvedCompositionView;
}

const EMPTY_DERIVED_CAPTURE: DerivedCapture = {
  attributes: new Set<ReturnAttributeKey>(),
  provenance: [],
  unmatchedComposition: [],
  compositionUnresolved: true,
};

/**
 * Derive the captured return-data attributes a product's composition implies.
 *
 * FAIL-CLOSED: if the resolved treatments carry any `unresolvedModuleIds`, the
 * composition is not fully known and we return an EMPTY capture with
 * `compositionUnresolved: true` — never a partial derivation.
 *
 * Otherwise we fold every capability row whose axis predicate the composition
 * satisfies, unioning the attributes and recording provenance. Composition that
 * matched no row is surfaced in `unmatchedComposition` (not an error — it just
 * means no attribute is derivable from that facet).
 */
export function deriveCapturedAttributes(composition: ProductComposition): DerivedCapture {
  const { filTypeScopes, resolved } = composition;

  // Fail-closed: an unresolved treatment pick means we do not know the
  // product's full composition. Derive nothing.
  if (resolved.unresolvedModuleIds.length > 0) {
    return EMPTY_DERIVED_CAPTURE;
  }

  const attrRows = new Map<ReturnAttributeKey, Set<string>>();
  const matchedAxisValues = new Set<string>();
  const seenAxisValues = new Set<string>();

  // Record every composition axis-value the product exhibits, so we can compute
  // the unmatched remainder afterwards.
  for (const scope of filTypeScopes) seenAxisValues.add(`fil-scope:${scope}`);
  if (resolved.regulatoryApproach !== undefined) {
    seenAxisValues.add(`treatment-prudential-approach:${resolved.regulatoryApproach}`);
  }

  for (const row of CAPTURE_CAPABILITY_MAP) {
    let matched = false;
    if (row.axis === "fil-scope") {
      // A row matches if ANY of the product's declared scopes is covered by the
      // row's pattern. Product scopes are themselves `fil:type:…@maj.min` URNs
      // (or patterns); the row pattern is the prefix family (`fil:type:fx:*`).
      for (const scope of filTypeScopes) {
        if (matchesFilScope(row.match, scope)) {
          matched = true;
          matchedAxisValues.add(`fil-scope:${scope}`);
        }
      }
    } else {
      // treatment-prudential-approach
      if (resolved.regulatoryApproach !== undefined && resolved.regulatoryApproach === row.match) {
        matched = true;
        matchedAxisValues.add(`treatment-prudential-approach:${row.match}`);
      }
    }
    if (!matched) continue;

    for (const attr of row.attributes) {
      let rows = attrRows.get(attr);
      if (!rows) {
        rows = new Set<string>();
        attrRows.set(attr, rows);
      }
      rows.add(row.id);
    }
  }

  const attributes = new Set<ReturnAttributeKey>(attrRows.keys());
  const provenance: DerivedAttributeProvenance[] = [...attrRows.entries()]
    .map(([attribute, rows]) => ({ attribute, rowIds: [...rows].sort() }))
    .sort((a, b) => a.attribute.localeCompare(b.attribute));

  const unmatchedComposition = [...seenAxisValues]
    .filter((v) => !matchedAxisValues.has(v))
    .sort();

  return {
    attributes,
    provenance,
    unmatchedComposition,
    compositionUnresolved: false,
  };
}
