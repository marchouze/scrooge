// v2-core/fil-models/market-risk-var/index.ts
//
// MARKET-RISK VaR FIL-Model barrel — the FIRST non-additive (`joint-recompute`)
// `AttributionMetric` (V2 A3).
//
// The historical-simulation VaR methodology (ported from v1, no import), the VaR
// `AttributionMetric` that runs it over a JOINT member set, and the model
// declaration. A3 binds A1's no-sum gate to its first REAL joint-recompute
// metric and proves diversification + v1 standing-NOP parity.
//
// Author: Atlas (Core banking platform architect, engineering) ·
//         Rohan (Risk systems engineer, engineering) ·
//         Helena (Chief Risk Officer, governance — methodology accountability).

export * from "./methodology";
export * from "./var-metric";
export * from "./model";
