// v2-core/regulatory-returns/capability-backlog.ts
//
// CAPABILITY BACKLOG — a projection-derived register of data requirements that
// are not yet resolvable for non-sourced BA-return cells, ranked by LEVERAGE
// (how many (form, cell) pairs share the same missing requirement). This is a
// pure read over the return-contract registry (P1-clean: recomputable from
// contracts, no events emitted, no stored state).
//
// PURPOSE: surface the highest-leverage capability gaps across all SARB BA-return
// forms so the engineering team can prioritise the build order. A gap that
// unblocks 50 cells across 5 forms has a leverage of 50 — invest there first.
//
// DESIGN (Principle 2 — single-graph discipline):
//   1. Load all return contracts from RETURN_CONTRACT_REGISTRY.
//   2. For each non-sourced cell, identify its REQUIRED dataRequirements.
//   3. Compute crossCuttingLeverage: count distinct (form, xsdElement) pairs
//      that share the same sourceKind::ref key (the missing datum reference).
//   4. Attribution: link each gap to the products that feed the cell via
//      allProductReturnObligations() from inverse-index.ts (unchanged call).
//   5. Group by first attributing product; unattributed cells form a separate
//      "entity-level" list (GL / projection / reference-data gaps).
//
// P1 — pure read, no events. P2 — all cells carry citations (asserted by the
// ba-return-cell-contract gate). V1-removal: no V1 imports.
//
// Authority: D-BA-RETURN-CAPABILITY-FIRST (CEO-approved 2026-06-22);
//   D-BA-RETURN-PER-PRODUCT-RICHNESS; D-ENGINEERING-INTEGRITY-CHARTER
//   (cmd 4 source-don't-hardcode; cmd 5 no-silent-deferral). Principle 1; 2.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import type { DataRequirement, ReturnForm } from "./cell-contract";
import { allProductReturnObligations } from "./inverse-index";
import { RETURN_CONTRACT_REGISTRY, loadReturnContract } from "./return-contracts";

// ---------------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------------

export interface CapabilityBacklogItem {
  /** The SARB BA-return form this gap appears on. */
  readonly form: ReturnForm;
  /** The XSD element code of the cell (e.g. "BA10000010"). */
  readonly xsdElement: string;
  /** The human-readable cell label. */
  readonly label: string;
  /** The data requirements that are REQUIRED but not yet resolvable. */
  readonly missingRequirements: readonly DataRequirement[];
  /**
   * Products that feed this cell (via `product-attribute` refs in the cell's
   * dataRequirements, looked up via allProductReturnObligations). Empty ⇒ the
   * gap is an entity-level capability gap (GL category / projection).
   */
  readonly attributingProducts: readonly string[];
  /**
   * How many other (form, xsdElement) pairs share at least ONE of the same
   * missing `sourceKind::ref` keys. Higher = more cross-cutting = higher
   * build priority.
   */
  readonly crossCuttingLeverage: number;
}

export interface CapabilityBacklog {
  /** Items grouped by first attributing product id (NPA-level capability gaps). */
  readonly byProduct: ReadonlyMap<string, readonly CapabilityBacklogItem[]>;
  /** Items with no attributing product (entity-level GL / projection / ref-data gaps). */
  readonly unattributed: readonly CapabilityBacklogItem[];
  /** Top-20 highest-leverage items across all groups, sorted desc by crossCuttingLeverage. */
  readonly topByLeverage: readonly CapabilityBacklogItem[];
}

// ---------------------------------------------------------------------------
// Build.
// ---------------------------------------------------------------------------

/**
 * Build the capability backlog from the current return-contract registry.
 * Pure — no events, no I/O. Call from the dashboard or a CLI to render.
 */
export function buildCapabilityBacklog(): CapabilityBacklog {
  // (1) Load all contracts.
  const allContracts = RETURN_CONTRACT_REGISTRY.map((entry) => {
    try {
      return loadReturnContract(entry.form);
    } catch {
      return null;
    }
  }).filter((c): c is NonNullable<typeof c> => c !== null);

  // (2) Build inverse index for product attribution.
  const productObligations = allProductReturnObligations(allContracts);

  // (3) For each non-sourced cell, collect required (but missing) dataRequirements.
  // A "missing" requirement is one that is `required: true` and whose sourceKind is
  // not "event-field" (event-field refs are validated elsewhere, not a build gap).
  type RawItem = {
    form: ReturnForm;
    xsdElement: string;
    label: string;
    missing: DataRequirement[];
    attributingProducts: string[];
    gapKeys: Set<string>; // sourceKind::ref for each missing req
  };

  const rawItems: RawItem[] = [];

  for (const contract of allContracts) {
    for (const cell of contract.cells) {
      if (cell.status === "sourced") continue; // already sourced — not a gap.

      const missing = cell.dataRequirements.filter(
        (d) => d.required && d.sourceKind !== "event-field",
      );
      if (missing.length === 0) continue; // no required gaps on this cell.

      // Find attributing products (cells that a product feeds via product-attribute refs).
      const attrProducts: string[] = [];
      for (const [pid, obligations] of productObligations) {
        if (
          obligations.cells.some(
            (fc) =>
              fc.xsdElement === cell.cellRef.xsdElement && fc.returnForm === contract.returnForm,
          )
        ) {
          attrProducts.push(pid);
        }
      }

      rawItems.push({
        form: contract.returnForm,
        xsdElement: cell.cellRef.xsdElement,
        label: cell.label,
        missing,
        attributingProducts: attrProducts,
        gapKeys: new Set(missing.map((d) => `${d.sourceKind}::${d.ref}`)),
      });
    }
  }

  // (4) Compute crossCuttingLeverage: for each item, count how many OTHER items
  // share at least one of the same gapKeys.
  const items: CapabilityBacklogItem[] = rawItems.map((item) => {
    let leverage = 0;
    for (const other of rawItems) {
      if (other === item) continue;
      for (const gk of item.gapKeys) {
        if (other.gapKeys.has(gk)) {
          leverage++;
          break; // count each other item once even if multiple keys overlap.
        }
      }
    }
    return {
      form: item.form,
      xsdElement: item.xsdElement,
      label: item.label,
      missingRequirements: item.missing,
      attributingProducts: item.attributingProducts,
      crossCuttingLeverage: leverage,
    };
  });

  // (5) Group by first attributing product.
  const byProduct = new Map<string, CapabilityBacklogItem[]>();
  const unattributed: CapabilityBacklogItem[] = [];

  for (const item of items) {
    if (item.attributingProducts.length > 0) {
      const pid = item.attributingProducts[0];
      if (pid === undefined) continue;
      const existing = byProduct.get(pid) ?? [];
      existing.push(item);
      byProduct.set(pid, existing);
    } else {
      unattributed.push(item);
    }
  }

  // Sort each group descending by leverage.
  for (const [, group] of byProduct) {
    group.sort((a, b) => b.crossCuttingLeverage - a.crossCuttingLeverage);
  }
  unattributed.sort((a, b) => b.crossCuttingLeverage - a.crossCuttingLeverage);

  // Top-20 cross-cutting items globally.
  const topByLeverage = [...items]
    .sort((a, b) => b.crossCuttingLeverage - a.crossCuttingLeverage)
    .slice(0, 20);

  return {
    byProduct,
    unattributed,
    topByLeverage,
  };
}
