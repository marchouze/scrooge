// platform/reporting/cell-value/leaf-fold-registry.ts
//
// Phase 0 of the per-cell value engine (D-BA-RETURN-CELL-VALUE-ENGINE): the
// per-form LEAF FOLD registry. A leaf fold reads the UNDERLYING EVENTS for a
// return and produces its leaf cell values — folded directly from the events
// with whatever dimensions they carry (instrument type, book, counterparty
// sector, maturity, currency, entity), per each cell's contract dataRequirements.
//
// This is the events-direct source the generic v2-core engine
// (computeDerivedCells) consumes — a return and the CoA trial balance are two
// SIBLING folds of the same event log (Principle 1), so the return's granularity
// is read from the events, NOT routed through the (coarser) CoA. The fold lives
// here (platform) because it reads events; the generic arithmetic stays pure in
// v2-core.
//
// DOMAIN-OWNED: each form's fold is authored + validated by its seat against the
// SARB form definition (ADC duty) and backed by a reconciliation gate (Σ folded
// lines == the canonical aggregate projection, per section). Where the events
// lack a dimension a cell needs, the fold surfaces an event/product-schema gap
// and leaves the cell unresolved — never fabricated (Charter cmd 2 / cmd 4).
//
// EMPTY until a seat authors the first form (Phase 1: BA 100 — Bea; BA 700 —
// finance; BA 320 / BA 200 — risk; BA 300 — treasury). A form with no fold yields
// no granular values (the page then shows the form-level aggregate cells).

import type { ReturnForm } from "../../../v2-core/regulatory-returns/cell-contract";
import type { LeafCellValues } from "../../../v2-core/regulatory-returns/cell-value/engine";
import type { EventStore } from "../../event-store/store";
import type { MarketDataStore } from "../../market-data/store";

/**
 * Reference-data accessor for canonical-home joins in leaf folds. Each method
 * is fail-closed: returns null (never a guessed default) when a key is unmapped.
 * Callers must handle null and, per Charter cmd 5, surface a tracked gap.
 *
 * Phase 2 surfaces the desk-book-type lookup (getDeskBookType) for the BA 100
 * banking/trading book split. Party residency + sector lookups (Phase 3) are
 * declared here to fix the shape; the data is wired in a later dispatch.
 *
 * Authority: D-BA-RETURN-CELL-VALUE-ENGINE Phase 2; D-FX-BOOK-BOUNDARY;
 *   D-ENGINEERING-INTEGRITY-CHARTER cmd 2 (fail-closed), cmd 4 (source-don't-
 *   hardcode), cmd 5 (no-silent-deferral).
 */
export interface LeafFoldReferenceData {
  /**
   * Party register: look up a counterparty's residency classification, or null
   * when the counterparty is not in the register. Fail-closed — never guesses.
   * Phase 3 wires the party-register join; returns null until then.
   */
  getCounterpartyResidency(
    counterpartyId: string,
  ): "resident" | "non-resident" | "authorised-dealer" | "sarb" | null;
  /**
   * Party register: look up a counterparty's sector classification, or null.
   * Fail-closed. Phase 3 wires the party-register join; returns null until then.
   */
  getCounterpartySector(counterpartyId: string): string | null;
  /**
   * Desk register: look up an active desk's bookType, or null when the deskId is
   * not in the canonical roster. Fail-closed (unrecognised deskId → null, never
   * a guessed "trading" default). Reads from CANONICAL_DESKS (v2-core/desk/roster.ts).
   * Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-FX-BOOK-BOUNDARY.
   */
  getDeskBookType(deskId: string): "trading" | "banking-treasury" | null;
}

/** Inputs a leaf fold reads — the event log (under the active provenance lens), plus context. */
export interface LeafFoldContext {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  /** Anchor legal-entity short-id. */
  readonly entity: string;
  /** As-of date bounding the fold. */
  readonly asOf: string;
  /** ISO-4217 functional currency. */
  readonly functionalCurrency: string;
  /**
   * Optional reference-data accessor for canonical-home joins (party register,
   * desk register). OPTIONAL now — no existing fold builds it yet; later phases
   * will populate it. Fail-closed: each accessor returns null for unknown keys.
   * Phase 2: `getDeskBookType` is the first populated method (BA 100 book split).
   * Phase 3: `getCounterpartyResidency` + `getCounterpartySector` wired (party
   * register join for BA 100 residency/sector slices).
   */
  readonly referenceData?: LeafFoldReferenceData;
}

/**
 * A per-form leaf fold: read the underlying events and return the leaf cell
 * values keyed by `"<row> <column>"` as decimal-native MAJOR-unit strings. The
 * caller pins the active provenance lens before invoking, so the fold reads under
 * Prod / +Sim transparently via the usual `defaultProvenanceFilter()`.
 */
export type ReturnLeafFold = (ctx: LeafFoldContext) => LeafCellValues;

const REGISTRY = new Map<ReturnForm, ReturnLeafFold>();

/** Register a form's leaf fold. Throws on a duplicate registration. */
export function registerLeafFold(form: ReturnForm, fold: ReturnLeafFold): void {
  if (REGISTRY.has(form)) {
    throw new Error(`leaf fold already registered for ${form}`);
  }
  REGISTRY.set(form, fold);
}

/** The leaf fold for a form, or `undefined` if none authored yet. */
export function leafFoldFor(form: ReturnForm): ReturnLeafFold | undefined {
  return REGISTRY.get(form);
}

/** Whether a form has an authored leaf fold (so the engine can fill granular cells). */
export function hasLeafFold(form: ReturnForm): boolean {
  return REGISTRY.has(form);
}
