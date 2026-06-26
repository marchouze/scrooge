// v2-core/fil-models/fx-valuation/fair-value-hierarchy.ts
//
// IFRS 13 FAIR-VALUE HIERARCHY ORACLE — derives the expected hierarchy level
// from the OBSERVABILITY of an instrument's valuation inputs, rather than
// reading a declared literal (D-FX-IFRS-REVIEW-FOUNDATION, F6).
//
// WHY THIS EXISTS
// ---------------
// The FX treatment module declares `fairValueHierarchy: "level-2"` and the FX
// model's `fairValueHierarchy()` returns the literal `"level-2"`. Both are
// DECLARED, not DERIVED — nothing checks that the declared level is the level the
// instrument's actual valuation inputs imply. A historic mis-tag (the PR #643
// level-1 mis-tag) re-passes any test that only asserts `toBe("level-2")`, because
// the literal still echoes itself. This oracle derives the level from the
// valuation inputs' observability so the gate can fail closed on a wrong tag.
//
// THE IFRS 13 RULE (the domain truth this encodes)
// ------------------------------------------------
//   - LEVEL 1 (IFRS 13 §76): quoted PRICES (unadjusted) in ACTIVE markets for
//     IDENTICAL assets/liabilities that the entity can access at the measurement
//     date. The fair value IS the quoted price of the instrument itself.
//   - LEVEL 2 (IFRS 13 §81): inputs other than quoted prices included within
//     Level 1 that are OBSERVABLE for the asset/liability, either directly or
//     indirectly — e.g. quoted prices for SIMILAR instruments, observable
//     interest rates, FX spot rates, yield curves, forward points. A vanilla FX
//     forward/spot on a liquid major pair is the canonical Level-2 case: it is
//     valued from OBSERVABLE market data (spot fixing + forward points), but there
//     is no quoted price for the forward CONTRACT itself in an active market.
//   - LEVEL 3 (IFRS 13 §86): UNOBSERVABLE inputs for the asset/liability.
//
// THE DERIVATION. The valuation facet declares the `ObservableRef[]` it consumes
// (`requiredObservables()`), each tagged with a `kind`:
//   - `"price"`  → a quoted price for the instrument itself (Level 1 candidate);
//   - `"fixing"` / `"curve"` / `"surface"` → an observable market input that is
//     NOT a quoted price for the instrument (Level 2);
//   - any input flagged unobservable → Level 3.
// We map the input observability to the level by the strongest-evidence rule IFRS
// 13 §72–§90 sets out: the level of a fair-value measurement is determined by the
// LOWEST-level input that is SIGNIFICANT to the entire measurement (§73). For an
// FX vanilla forward every input is an observable market rate (Level 2) and none
// is unobservable, so the measurement is Level 2 — never Level 1 (there is no
// active-market quote for the bespoke forward) and never Level 3 (no unobservable
// input).
//
// PURE + v2-core: no v1 imports; no I/O; deterministic over the input list. The
// recon gate composes this with the declared level and fails closed on a mismatch.
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26, F6); citing
//   D-FIL-FRAMEWORK-UNIFICATION (the Valuable facet's observable contract).
//   IFRS 13 §72–§90 (fair-value hierarchy), in particular §73 (lowest significant
//   input), §76 (Level 1), §81 (Level 2), §86 (Level 3). Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering) — remediated
//   by Vera (Internal-audit engineer, third line) under WS-FX-IFRS-REVIEW-FOUNDATION.

import type { ObservableRef } from "../../fil-facets/facets";
import type { FairValueHierarchy } from "../../reporting-treatments/declaration";

/**
 * One valuation input's observability classification — the per-input evidence the
 * §73 lowest-significant-input rule aggregates over.
 *
 *   - `quoted-price-active-market` — a quoted price for the IDENTICAL instrument in
 *     an active market the entity can access (the Level-1 condition, §76).
 *   - `observable-market-input` — an observable input that is NOT a quoted price
 *     for the instrument itself (spot rate, forward points, yield curve, an
 *     observable surface): the Level-2 condition (§81).
 *   - `unobservable` — an input not observable for the asset/liability (§86): the
 *     Level-3 condition.
 */
export type FairValueInputObservability =
  | "quoted-price-active-market"
  | "observable-market-input"
  | "unobservable";

/**
 * Classify a single `ObservableRef` by its `kind`.
 *
 * IMPORTANT — `kind: "price"` is NOT automatically Level 1. A `price` observable
 * is a quoted price for the instrument itself ONLY when that price comes from an
 * ACTIVE market the entity can access for the IDENTICAL instrument (§76). For a
 * BESPOKE OTC instrument (an FX forward struck at an agreed rate) there is no such
 * active-market quote, so even a `price`-tagged input that is a price for a
 * SIMILAR/proxy instrument is Level 2 (§81). The caller therefore passes
 * `isQuotedForIdenticalInstrument` to assert the Level-1 precondition explicitly;
 * absent that, a `price` input is treated as an observable market input (Level 2),
 * which is the conservative IFRS 13 default for an OTC derivative.
 */
export function classifyObservable(
  ref: ObservableRef,
  isQuotedForIdenticalInstrument = false,
): FairValueInputObservability {
  switch (ref.kind) {
    case "price":
      // A price input is Level-1 evidence ONLY if it is the active-market quote for
      // the identical instrument; otherwise it is an observable market input (a
      // proxy / similar-instrument price), i.e. Level 2.
      return isQuotedForIdenticalInstrument
        ? "quoted-price-active-market"
        : "observable-market-input";
    case "fixing":
    case "curve":
    case "surface":
      // A fixing (spot rate), curve (rates / forward points) or surface (vol) is an
      // observable market input that is NOT a quoted price for the instrument — the
      // Level-2 building block (§81).
      return "observable-market-input";
  }
}

/**
 * Derive the IFRS 13 fair-value hierarchy level of a measurement from the
 * observability classifications of its SIGNIFICANT inputs, applying the §73
 * lowest-significant-input rule:
 *
 *   - ANY significant input `unobservable`            → Level 3 (§86);
 *   - else if EVERY significant input is a quoted price for the identical
 *     instrument in an active market                  → Level 1 (§76);
 *   - else (at least one observable market input, none unobservable)
 *                                                     → Level 2 (§81).
 *
 * Fail-closed: an EMPTY input list throws — a fair value with no inputs cannot be
 * levelled, and silently returning a default would re-introduce the declared-not-
 * derived defect this oracle exists to kill (Engineering Charter cmd 2).
 */
export function deriveFairValueHierarchy(
  inputs: readonly FairValueInputObservability[],
): FairValueHierarchy {
  if (inputs.length === 0) {
    throw new Error(
      "deriveFairValueHierarchy: cannot level a fair-value measurement with no valuation inputs (IFRS 13 §72) — a derivation over an empty input set would mask the declared-not-derived defect (F6).",
    );
  }
  if (inputs.some((i) => i === "unobservable")) return "level-3";
  if (inputs.every((i) => i === "quoted-price-active-market")) return "level-1";
  return "level-2";
}

/**
 * Derive the IFRS 13 level directly from the valuation facet's declared observable
 * refs (the `requiredObservables()` contract). For an FX vanilla spot/forward the
 * refs are the spot fixing (+ forward-points curve for a forward), all observable
 * market inputs and none quoted-for-the-identical-instrument, so this returns
 * `"level-2"` — DERIVED, not declared.
 */
export function deriveFairValueHierarchyFromObservables(
  observables: readonly ObservableRef[],
): FairValueHierarchy {
  return deriveFairValueHierarchy(observables.map((o) => classifyObservable(o)));
}
