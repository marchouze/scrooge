// v2-core/regulatory-returns/cell-value/registrations.ts
//
// Side-effect import aggregator for the per-cell value engine
// (D-BA-RETURN-CELL-VALUE-ENGINE). Each seat-authored per-form line-attribution
// module calls `registerLineAttribution(...)` at load; importing this file
// registers them all. The detail-view route imports this for its side effects so
// the engine sees every authored attribution.
//
// EMPTY until a seat authors the first form. Phase 1 adds one import line per
// return as its attribution lands (BA 100 — Bea; BA 700 — CFO/finance; BA 320 /
// BA 200 — risk; BA 300 — treasury). Until then the engine yields no granular
// values and the page shows the form-level aggregate cells (fail-closed).
//
// e.g. once authored:
//   import "./ba100-attribution";

export {}; // intentionally empty — no attributions authored yet
