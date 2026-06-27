// v2-core/regulatory-returns/cell-value/attribution.ts
//
// Phase 0 of the per-cell value engine (D-BA-RETURN-CELL-VALUE-ENGINE): the
// line-attribution registry — the DOMAIN-TRUTH artefact that says which GL
// account (or instrument / product) feeds which SARB form cell (row, column).
//
// WHY a registry and not a CoA field, and why this is DOMAIN-OWNED:
//   - The chart-of-accounts is COARSER than the SARB form lines (e.g. BA 100
//     rows R0130–R0230 all fold to `category:asset-receivable`), so a
//     category-level fold double-counts. A per-ACCOUNT → per-LINE attribution
//     is the sound key (each account contributes to exactly one line, so the
//     section subtotals never double-count).
//   - One account can map to DIFFERENT lines in different returns, so the
//     attribution is per-(form, account), not a single CoA tag.
//   - WHICH SARB line an account belongs to is a regulatory-accounting judgement
//     that the OWNING SEAT authors and validates against the published SARB form
//     definition (the ADC duty, D-AGENT-DOMAIN-COMPETENCE). The orchestrator does
//     NOT assert it. Bea (Accounting & financial reporting engineer) owns BA 100 /
//     BA 120; CFO/finance owns BA 700; risk owns BA 200 / BA 320; treasury owns
//     BA 300.
//
// This module is the TYPES + registry plumbing only. The per-form attribution
// data is authored in sibling files (e.g. `ba100-attribution.ts`) by the seat,
// and validated by a reconciliation gate (Σ attributed line values == the
// canonical aggregate projection, per section). Until a form's attribution is
// authored, the engine simply yields no granular values for it (the page falls
// back to the form-level aggregate cells) — fail-closed, never a guess.

import type { ReturnForm } from "../cell-contract";

/**
 * One attribution: a GL account contributes to a single SARB form cell. The
 * `sign` lets a credit-balance account (liability/equity) present as a positive
 * line magnitude when the form reports magnitudes, matching the canonical
 * generator's convention.
 */
export interface LineAttribution {
  /** GL account id (e.g. "ACC-1000-001"). */
  readonly account: string;
  /** Target SARB row coordinate (e.g. "R0040"). */
  readonly row: string;
  /** Target SARB column coordinate (e.g. "C0040"). */
  readonly column: string;
  /**
   * How the account's signed trial-balance amount maps onto the line:
   *   - "as-is"     : use the signed amount (debit positive).
   *   - "magnitude" : use |amount| (the form reports a positive line magnitude;
   *                   the canonical BA-100 generator's convention for credit-side
   *                   lines).
   */
  readonly sign: "as-is" | "magnitude";
}

/** The authored attribution for one return form. */
export interface ReturnLineAttribution {
  readonly form: ReturnForm;
  /**
   * Author + reviewer provenance — the seat that validated this against the SARB
   * form definition (surfaced for audit; the ADC duty).
   */
  readonly authoredBySeat: string;
  /** The canonical aggregate the per-line sums reconcile to (recon oracle name). */
  readonly reconcilesTo: string;
  readonly entries: readonly LineAttribution[];
}

/**
 * The registry of authored per-form attributions. EMPTY until a seat authors a
 * form (Phase 1 per return). The engine reads this; a form not present yields no
 * granular values (the aggregate cells still fill — see HEADLINE_CELLS).
 */
const REGISTRY = new Map<ReturnForm, ReturnLineAttribution>();

/** Register a form's authored attribution. Throws on a duplicate registration. */
export function registerLineAttribution(attribution: ReturnLineAttribution): void {
  if (REGISTRY.has(attribution.form)) {
    throw new Error(`line attribution already registered for ${attribution.form}`);
  }
  // Fail-closed: an account may feed at most ONE cell per form (else the section
  // subtotals would double-count — the whole reason this registry exists).
  const seenAccounts = new Set<string>();
  for (const e of attribution.entries) {
    if (seenAccounts.has(e.account)) {
      throw new Error(
        `account ${e.account} attributed to more than one cell in ${attribution.form} — double-count risk; an account feeds exactly one line per form.`,
      );
    }
    seenAccounts.add(e.account);
  }
  REGISTRY.set(attribution.form, attribution);
}

/** The authored attribution for a form, or `undefined` if none yet. */
export function lineAttributionFor(form: ReturnForm): ReturnLineAttribution | undefined {
  return REGISTRY.get(form);
}

/** Whether a form has an authored attribution (so the engine can fill granular cells). */
export function hasLineAttribution(form: ReturnForm): boolean {
  return REGISTRY.has(form);
}
