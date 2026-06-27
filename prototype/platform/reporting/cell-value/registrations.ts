// platform/reporting/cell-value/registrations.ts
//
// Side-effect import aggregator for the per-cell value engine
// (D-BA-RETURN-CELL-VALUE-ENGINE). Each seat-authored per-form leaf fold calls
// `registerLeafFold(...)` at load; importing this file registers them all. The
// detail-view route imports this for its side effects.
//
// Phase 1 adds one import line per return as its leaf fold lands (BA 100 — Bea;
// BA 700 — finance; BA 320 / BA 200 — risk; BA 300 — treasury). A form with no
// leaf fold yields no granular values and the page shows the form-level aggregate
// cells (fail-closed).

// BA 100 (Balance Sheet) — Bea; D-BA-RETURN-CELL-VALUE-ENGINE Phase 1 pilot. Folds
// the capital FIL instances DIRECTLY from the event log (a return and the CoA are
// sibling folds — granularity comes from the events) onto their BA 100 SARB rows.
import "./ba100-leaf-fold";
