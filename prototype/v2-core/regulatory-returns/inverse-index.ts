// v2-core/regulatory-returns/inverse-index.ts
//
// L3 — the INVERSE INDEX. The L2 contract answers "what data does cell X
// need?". This module inverts it to answer the question the New-Product-
// Approval (NPA) process actually asks:
//
//     "If I create product P, which return cells will it feed, and therefore
//      what data must P capture for those cells to populate?"
//
// `returnDataObligationsForProduct(productId)` is the callable the NPA gate
// consumes: given a product id (or a product whose family maps onto balance-
// sheet lines), it returns the set of BA-return cells the product feeds and
// the concrete data requirements the product must satisfy. A product that
// cannot supply a required datum for a cell it feeds is a gap the NPA process
// must close before approval.
//
// HOW THE LINKAGE WORKS
// ---------------------
// A cell's `dataRequirements[]` carries `product-attribute` requirements whose
// `ref` is `<productId>#<attribute>` (a direct product link) — those are the
// authoritative product→cell edges. In addition, a cell's `applicability.
// productScope` may list product FAMILIES; we expose a family-level lookup so
// a not-yet-approved product (whose id is not yet in any cell) can still be
// assessed by its family.
//
// PRINCIPLE BINDINGS: P1 — pure read over the reference-data contract (no
// events, no stored state). P2 — every returned cell carries its citations.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19), Phase B (L3).
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import type {
  Citation,
  DataRequirement,
  ReturnCellContract,
  ReturnContract,
  ReturnForm,
  ValueType,
} from "./cell-contract";

// ---------------------------------------------------------------------------
// Result types.
// ---------------------------------------------------------------------------

/** One cell a product feeds, with the product-specific data it must capture. */
export interface FedCell {
  readonly returnForm: ReturnForm;
  readonly xsdElement: string;
  readonly label: string;
  readonly rowLabel?: string;
  readonly columnLabel?: string;
  readonly citations: readonly Citation[];
  /** The data requirements on this cell that name THIS product. */
  readonly productRequirements: readonly DataRequirement[];
  /** The cell's status (sourced | counsel-gated-TBC | licence-day-data). */
  readonly status: ReturnCellContract["status"];
  /**
   * The cell's value type (money | ratio | count | date | text | enum |
   * hashtotal). Surfaced so the NPA capture gate can shape-match a declared
   * return-data capture against the cell requirement it satisfies. Additive.
   */
  readonly valueType: ValueType;
}

/** A distinct datum the product must capture (deduplicated across cells). */
export interface RequiredDatum {
  readonly sourceKind: DataRequirement["sourceKind"];
  readonly ref: string;
  readonly description: string;
  readonly required: boolean;
  /** XSD elements of the cells that need this datum (provenance). */
  readonly feedsCells: readonly string[];
}

export interface ProductReturnObligations {
  readonly productId: string;
  /** Every cell across all loaded forms this product feeds. */
  readonly cells: readonly FedCell[];
  /** The deduplicated set of data the product must capture. */
  readonly requiredData: readonly RequiredDatum[];
  /** Forms the product touches. */
  readonly forms: readonly ReturnForm[];
}

// ---------------------------------------------------------------------------
// Core inverse walk.
// ---------------------------------------------------------------------------

/** Extract the product id from a `product-attribute` ref `<productId>#<attr>`. */
function productIdOf(ref: string): string | undefined {
  if (!ref.startsWith("prd:")) return undefined;
  const hash = ref.indexOf("#");
  return hash === -1 ? ref : ref.slice(0, hash);
}

/**
 * Build the inverse index for a single product across the supplied form
 * contracts. Pure function — pass `[ba100Contract()]` (or more forms as they
 * are authored). A product feeds a cell iff the cell has a `product-attribute`
 * dataRequirement whose ref names the product.
 */
export function returnDataObligationsForProduct(
  productId: string,
  contracts: readonly ReturnContract[],
): ProductReturnObligations {
  const cells: FedCell[] = [];
  const datumByKey = new Map<string, RequiredDatum & { feedsCells: string[] }>();
  const forms = new Set<ReturnForm>();

  for (const contract of contracts) {
    for (const cell of contract.cells) {
      const productReqs = cell.dataRequirements.filter(
        (d) => d.sourceKind === "product-attribute" && productIdOf(d.ref) === productId,
      );
      if (productReqs.length === 0) continue;

      forms.add(contract.returnForm);
      const fed: FedCell = {
        returnForm: contract.returnForm,
        xsdElement: cell.cellRef.xsdElement,
        label: cell.label,
        citations: cell.citations,
        productRequirements: productReqs,
        status: cell.status,
        valueType: cell.valueType,
        // Optional labels added below only when present (exactOptionalPropertyTypes).
        ...(cell.cellRef.rowLabel !== undefined ? { rowLabel: cell.cellRef.rowLabel } : {}),
        ...(cell.cellRef.columnLabel !== undefined
          ? { columnLabel: cell.cellRef.columnLabel }
          : {}),
      };
      cells.push(fed);

      // Surface the cell's requirements that are THIS product's data surface:
      // (a) every non-product requirement (GL category / projection / reference
      // data / counsel-TBC) the cell depends on, and (b) this product's OWN
      // product-attribute requirements. A DIFFERENT product's product-attribute
      // (a co-feeder) is excluded — it is that product's obligation, not this
      // one's. This keeps `requiredData` the precise NPA checklist for P.
      for (const d of cell.dataRequirements) {
        if (d.sourceKind === "product-attribute") {
          const pid = productIdOf(d.ref);
          if (pid !== undefined && pid !== productId) continue; // co-feeder — skip
        }
        const key = `${d.sourceKind}::${d.ref}`;
        const existing = datumByKey.get(key);
        if (existing) {
          if (!existing.feedsCells.includes(cell.cellRef.xsdElement)) {
            existing.feedsCells.push(cell.cellRef.xsdElement);
          }
          // required is sticky-true: if any feeding cell requires it, it's required.
          if (d.required && !existing.required) {
            datumByKey.set(key, { ...existing, required: true });
          }
        } else {
          datumByKey.set(key, {
            sourceKind: d.sourceKind,
            ref: d.ref,
            description: d.description,
            required: d.required,
            feedsCells: [cell.cellRef.xsdElement],
          });
        }
      }
    }
  }

  const requiredData: RequiredDatum[] = [...datumByKey.values()]
    .map((d) => ({
      sourceKind: d.sourceKind,
      ref: d.ref,
      description: d.description,
      required: d.required,
      feedsCells: [...d.feedsCells].sort(),
    }))
    .sort((a, b) =>
      a.sourceKind === b.sourceKind
        ? a.ref.localeCompare(b.ref)
        : a.sourceKind.localeCompare(b.sourceKind),
    );

  return {
    productId,
    cells: cells.sort((a, b) => a.xsdElement.localeCompare(b.xsdElement)),
    requiredData,
    forms: [...forms].sort(),
  };
}

// ---------------------------------------------------------------------------
// Family-level lookup (for not-yet-approved products at NPA time).
// ---------------------------------------------------------------------------

/**
 * The set of distinct product ids that appear as `product-attribute` refs
 * across the supplied contracts — i.e. the products the cell set already knows
 * how to source. Used by the recon to assert every referenced product is real.
 */
export function productsReferencedByContracts(
  contracts: readonly ReturnContract[],
): readonly string[] {
  const ids = new Set<string>();
  for (const contract of contracts) {
    for (const cell of contract.cells) {
      for (const d of cell.dataRequirements) {
        if (d.sourceKind === "product-attribute") {
          const pid = productIdOf(d.ref);
          if (pid) ids.add(pid);
        }
      }
    }
  }
  return [...ids].sort();
}

/**
 * Inverse index for ALL referenced products at once — `productId →
 * obligations`. The NPA process consults this map; the dashboard renders it.
 */
export function allProductReturnObligations(
  contracts: readonly ReturnContract[],
): ReadonlyMap<string, ProductReturnObligations> {
  const out = new Map<string, ProductReturnObligations>();
  for (const pid of productsReferencedByContracts(contracts)) {
    out.set(pid, returnDataObligationsForProduct(pid, contracts));
  }
  return out;
}
