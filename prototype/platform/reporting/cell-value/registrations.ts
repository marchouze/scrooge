// platform/reporting/cell-value/registrations.ts
//
// Side-effect import aggregator for the per-cell value engine
// (D-BA-RETURN-CELL-VALUE-ENGINE). Each seat-authored per-form leaf fold calls
// `registerLeafFold(...)` at load; importing this file registers them all. The
// detail-view route imports this for its side effects.
//
// EMPTY until a seat authors the first form. Phase 1 adds one import line per
// return as its leaf fold lands (BA 100 — Bea; BA 700 — finance; BA 320 / BA 200
// — risk; BA 300 — treasury). Until then the engine yields no granular values and
// the page shows the form-level aggregate cells (fail-closed).
//
// e.g. once authored:
//   import "./ba100-leaf-fold";

export {}; // intentionally empty — no leaf folds authored yet
