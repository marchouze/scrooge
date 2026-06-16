// v2-core/fil-models/fx-valuation/index.ts
//
// FX VALUATION FIL-Model barrel — the SECOND FIL-Model (V2 A2).
//
// FX spot + forward as a `Valuable` (+ `Accountable`) model; FCY cash as a
// monetary `Valuable` (+ `Accountable`) model; the additive FX P&L
// `AttributionMetric` + the `book:fx-trading` slice that binds A1's empty
// metric registry to its first real metric.
//
// Author: Atlas (Core banking platform architect, engineering) ·
//         Bea (Accounting & financial reporting engineer, engineering).

export * from "./methodology";
export * from "./reporting-currency-resolver";
export * from "./fx-model";
export * from "./fcy-cash-model";
export * from "./fx-pnl-metric";
export * from "../fx/index.ts";
