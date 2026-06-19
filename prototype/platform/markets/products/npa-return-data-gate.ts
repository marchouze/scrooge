// platform/markets/products/npa-return-data-gate.ts
//
// NPA gate — RETURN-DATA obligation check (L3 binding), GENERALISED to the
// capture model (D-BA-RETURN-DATA-CONTRACT "close the loop").
//
// "So that a product, when created, knows what information it must have
//  available for the returns to be populated." (Marc's goal.)
//
// THE PROBLEM THIS REFACTOR FIXES
// -------------------------------
// The original gate (#1460) detected "captured" by reading the product's
// FX-shaped persisted `scope` object's keys. That made the "captured"
// disposition UNREACHABLE for any non-FX attribute: a credit/liquidity product
// could only `deferred` (tracked gap) or `missing` (block) — never genuinely
// pass-by-capturing. This refactor replaces that FX-shaped detector with a
// composition-grounded one, so a product earns a real "captured" for the data
// its TYPE/treatment determines.
//
// THE CAPTURE MODEL: capture = derive-from-composition (C) ∪ declared-overrides (D)
// -------------------------------------------------------------------------------
// Per required product-specific attribute, the gate classifies 4 ways:
//   - "captured-derived":  the attribute is DERIVED from the product's
//     composition (`filTypeScopes` × resolved reporting treatments) — the C
//     engine (`deriveCapturedAttributes`) says the type/treatment carries it.
//   - "captured-declared": not C-derivable, but the product DECLARED a bounded
//     capture for it (a `ProductReturnDataCaptureDeclared` event) whose
//     `valueShape` matches the L2 cell requirement.
//   - "deferred":          neither captured, but a tracked deferred gap names it
//     (on the accounting dimension OR among the declared capture gaps) → allowed
//     with an open condition ("approved subject to tracked gap").
//   - "missing":           none of the above → BLOCKS approval.
//
// FAIL-CLOSED (Engineering Charter cmd 2 / cmd 5): if the product's composition
// is not fully resolvable (`compositionUnresolved` — an unresolved treatment
// pick), the C path derives NOTHING; an attribute then only reaches captured via
// a valid declaration, else defers, else is missing. We never treat a partially-
// known product as capturing data it has not earned.
//
// HONEST BOUNDARY (unchanged from #1460): only PRODUCT-SPECIFIC required
// product-attributes (`<thisProductId>#<attr>`) are product-definition capture
// obligations. Bare (product-agnostic) refs, and GL/projection/event-field/
// reference-data requirements, are out of this gate's scope by design (the
// substrate the bank supplies, validated by `recon:ba-return-cell-contract`).
//
// COMPOSITION WITH D-NPA-GATE-POLICY-REDESIGN: a missing required attribute is a
// return-incompleteness that composes with the dimension policy exactly as a
// dimension gap does — missing with no tracked gap → BLOCK; missing with a
// tracked gap → pass WITH a condition. Never silently passes.
//
// Pure function; no event side-effects (P1 — reads the register row, the L3
// index, and the product's composition, all derivations over the log /
// reference data).
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation); D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15);
//   D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO 2026-06-18);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO 2026-06-17).
// Author: Atlas (Core banking platform architect, engineering).

import type { ReturnContract } from "../../../v2-core/regulatory-returns/cell-contract";
import {
  type ResolvedCompositionView,
  deriveCapturedAttributes,
} from "../../../v2-core/regulatory-returns/capture-capability-map";
import type { ProductReturnObligations } from "../../../v2-core/regulatory-returns/inverse-index";
import { parseProductAttributeRef } from "../../../v2-core/regulatory-returns/return-attribute";
import type { CaptureValueShape } from "../../../v2-core/regulatory-returns/return-data-capture";
import type { ProductRegisterRow } from "../../projections/products/product-register";

// ---------------------------------------------------------------------------
// Composition input (the C path's grounding for THIS product).
// ---------------------------------------------------------------------------

/**
 * The product's composition the gate needs to derive capture. `ProductRegisterRow`
 * does NOT carry `filTypeScopes` (those live on `V2ProductRegistered`), so the
 * caller (the recon) joins by productId and passes this in. A product with no
 * V2 registration / no resolvable composition is conveyed as
 * `compositionResolved: false` → FAIL-CLOSED (C derives nothing).
 */
export interface ProductCompositionInput {
  readonly filTypeScopes: readonly string[];
  readonly resolved: ResolvedCompositionView;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type ReturnDataDisposition =
  | "captured-derived"
  | "captured-declared"
  | "deferred"
  | "missing";

/** One product-specific required return-data attribute, with its disposition. */
export interface ReturnDataObligationCheck {
  /** The product-specific attribute key (`<attr>` from `<productId>#<attr>`). */
  readonly attribute: string;
  /** The full L3 requirement ref (`<productId>#<attr>`). */
  readonly ref: string;
  /** XSD elements of the return cells this datum feeds (provenance). */
  readonly feedsCells: readonly string[];
  /**
   * Disposition (4-way):
   *   - "captured-derived":  derived from the product's composition (C path).
   *   - "captured-declared": supplied by a valid bounded declaration (D path).
   *   - "deferred":          not captured, but a tracked gap names it.
   *   - "missing":           not captured and not tracked → blocks approval.
   */
  readonly disposition: ReturnDataDisposition;
  /** When disposition === "captured-derived", the capability-row ids that derived it. */
  readonly derivedByRowIds?: readonly string[];
  /** When disposition === "deferred", the gapId of the tracked gap. */
  readonly deferredGapId?: string;
}

export interface ReturnDataGateResult {
  /** True iff no obligation is "missing" (deferred + captured are allowed). */
  readonly ready: boolean;
  /** Every product-specific required return-data attribute that was checked. */
  readonly checks: readonly ReturnDataObligationCheck[];
  /** Attributes that BLOCK approval (not captured, not tracked). */
  readonly missing: readonly string[];
  /**
   * Attributes that are not captured but ARE tracked as a deferred gap —
   * allowed, surfaced as open conditions. Each entry is
   * `"<attribute> (deferred: <gapId>)"`.
   */
  readonly openConditions: readonly string[];
}

// ---------------------------------------------------------------------------
// L2 cell-shape lookup — map attribute → the cell value types it feeds, so a
// declaration's `valueShape` can be checked against the requirement.
// ---------------------------------------------------------------------------

/** Map an L2 `valueType` onto the declaration's `valueShape` vocabulary. */
function valueShapeForCellType(valueType: ReturnContract["cells"][number]["valueType"]): CaptureValueShape | undefined {
  switch (valueType) {
    case "money":
      return "money";
    case "ratio":
      return "decimal";
    case "count":
      return "decimal";
    case "date":
      return "date";
    case "enum":
      return "enum";
    case "text":
      return "string";
    case "hashtotal":
      return undefined; // control cell — never a product-attribute requirement
    default:
      return undefined;
  }
}

/**
 * For each product-specific attribute the product owes, the SET of value-shapes
 * the L2 cells that need it expect. A declaration is shape-valid iff its
 * `valueShape` is in this set (or the set is empty — no shape constraint
 * resolvable, conservative allow only when the cell type is genuinely
 * undeclared, which the contract schema disallows, so in practice non-empty).
 */
function attributeValueShapes(
  obligations: ProductReturnObligations,
  productId: string,
): Map<string, Set<CaptureValueShape>> {
  // Build xsdElement → valueType for every fed cell.
  const cellShape = new Map<string, CaptureValueShape | undefined>();
  for (const cell of obligations.cells) {
    cellShape.set(cell.xsdElement, valueShapeForCellType(cell.valueType));
  }
  const out = new Map<string, Set<CaptureValueShape>>();
  for (const datum of obligations.requiredData) {
    if (datum.sourceKind !== "product-attribute") continue;
    const parsed = parseProductAttributeRef(datum.ref);
    if (parsed === undefined || parsed.productId !== productId) continue;
    let shapes = out.get(parsed.attribute);
    if (!shapes) {
      shapes = new Set<CaptureValueShape>();
      out.set(parsed.attribute, shapes);
    }
    for (const xsd of datum.feedsCells) {
      const s = cellShape.get(xsd);
      if (s !== undefined) shapes.add(s);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tracked-gap detection (deferral path).
// ---------------------------------------------------------------------------

/**
 * Does any tracked deferred gap name this return-data attribute? Two attachment
 * points: the accounting dimension's `deferredGaps` (the canonical
 * return-data attachment, Camille/Bea), AND the declared capture gaps on the
 * latest `ProductReturnDataCaptureDeclared` event. A gap "names" the attribute
 * if the attribute key is a substring of its gapId or title (case-insensitive).
 * Returns the matching gapId, or undefined.
 */
function trackedDeferredGapFor(row: ProductRegisterRow, attribute: string): string | undefined {
  const needle = attribute.toLowerCase();
  const matches = (gapId: string, title: string): boolean =>
    gapId.toLowerCase().includes(needle) || title.toLowerCase().includes(needle);

  const accounting = row.attestedDimensions.get("accounting");
  if (accounting) {
    for (const gap of accounting.deferredGaps) {
      if (matches(gap.gapId, gap.title)) return gap.gapId;
    }
  }
  for (const gap of row.declaredCaptureGaps) {
    if (matches(gap.gapId, gap.title)) return gap.gapId;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/**
 * Check whether a product captures (derived OR declared), or tracks-as-deferred,
 * the PRODUCT-SPECIFIC required return-data attributes it owes, per the L3
 * inverse index and the capture model.
 *
 * @param row          the product's register row (declared captures + gaps + attestations)
 * @param obligations  the product's L3 obligations (`returnDataObligationsForProduct`)
 * @param composition  the product's composition (filTypeScopes × resolved treatments);
 *                     pass `compositionResolved:false` semantics via an unresolved view
 *                     to FAIL-CLOSED the C path for a product with no resolvable composition.
 */
export function checkReturnDataObligations(
  row: ProductRegisterRow,
  obligations: ProductReturnObligations,
  composition: ProductCompositionInput,
): ReturnDataGateResult {
  // C path — derive captured attributes from composition (fail-closed inside on
  // an unresolved treatment pick: returns an empty set).
  const derived = deriveCapturedAttributes({
    filTypeScopes: composition.filTypeScopes,
    resolved: composition.resolved,
  });
  const derivedRowIds = new Map<string, readonly string[]>();
  for (const p of derived.provenance) derivedRowIds.set(p.attribute, p.rowIds);

  // D path — declared captures keyed by attribute.
  const declared = row.declaredReturnDataCaptures;

  // L2 shape constraints per attribute (for declaration shape-matching).
  const shapeByAttr = attributeValueShapes(obligations, row.productId);

  const checks: ReturnDataObligationCheck[] = [];
  const missing: string[] = [];
  const openConditions: string[] = [];

  for (const datum of obligations.requiredData) {
    if (datum.sourceKind !== "product-attribute" || !datum.required) continue;
    const parsed = parseProductAttributeRef(datum.ref);
    if (parsed === undefined || parsed.productId !== row.productId) continue; // bare/cross-product
    const attribute = parsed.attribute;

    // 1. captured-derived (C path).
    if (derived.attributes.has(attribute)) {
      checks.push({
        attribute,
        ref: datum.ref,
        feedsCells: datum.feedsCells,
        disposition: "captured-derived",
        derivedByRowIds: derivedRowIds.get(attribute) ?? [],
      });
      continue;
    }

    // 2. captured-declared (D path) — only if the declared valueShape matches an
    //    L2 cell requirement for this attribute (fail-closed on shape mismatch:
    //    a declaration of the wrong shape does NOT count as captured).
    const decl = declared.get(attribute);
    if (decl !== undefined) {
      const expected = shapeByAttr.get(attribute);
      const shapeOk = expected === undefined || expected.size === 0 || expected.has(decl.valueShape);
      if (shapeOk) {
        checks.push({
          attribute,
          ref: datum.ref,
          feedsCells: datum.feedsCells,
          disposition: "captured-declared",
        });
        continue;
      }
      // shape mismatch → fall through to deferral / missing (not captured).
    }

    // 3. deferred — a tracked gap names it.
    const gapId = trackedDeferredGapFor(row, attribute);
    if (gapId !== undefined) {
      checks.push({
        attribute,
        ref: datum.ref,
        feedsCells: datum.feedsCells,
        disposition: "deferred",
        deferredGapId: gapId,
      });
      openConditions.push(`${attribute} (deferred: ${gapId})`);
      continue;
    }

    // 4. missing — blocks.
    checks.push({
      attribute,
      ref: datum.ref,
      feedsCells: datum.feedsCells,
      disposition: "missing",
    });
    missing.push(attribute);
  }

  return {
    ready: missing.length === 0,
    checks,
    missing,
    openConditions,
  };
}
