// v2-core/fil-attribution/index.ts
//
// FIL ATTRIBUTION — package surface (A1 kernel).
//
// The dimensional metric-attribution layer: every metric attributable at any
// level and any slice, computed per FIL instance (a facet output) and aggregated
// by a shared engine along any dimension/hierarchy. A book, a trader's portfolio,
// a consolidation are all NAMED SLICES over one model — not bespoke primitives.
//
// A1 = the KERNEL: dimension model + metric interface + slice/query model + the
// two new event types + the aggregation engine + an EMPTY metric registry.
// Metrics bind in later slices (A2 = FX `pnl`); no v1 touch, no consolidation
// levels, no FX `Valuable` model land here.
//
// This package sits ABOVE fil-core/composition: composition builds ONE instrument
// (intra-instrument structure); attribution aggregates ACROSS instances
// (inter-instance structure). Orthogonal axes — never conflated.
//
// TENANT = HARD OUTER PARTITION: member selection reuses the S10 tenant-axis
// enforcement (control-plane/tenant-store) + the S2 tenant axis
// (control-plane/tenant); the cross-tenant learning gate (S12) governs any
// learning flow that would cross the partition. This package does NOT invent a
// parallel tenant mechanism.
//
// PACKAGE BOUNDARY: no v1 imports (recon:v2-no-v1-import — ENFORCING).
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (CEO-approved 2026-06-13);
//   D-METRIC-ATTRIBUTION-DIMENSIONAL; D-V2-TENANCY-ARCHITECTURE;
//   D-FIL-FRAMEWORK-UNIFICATION; Principle 1; Principle 5; Principle 6.
// Brief: brief:atlas:a1-fil-attribution-kernel-dimension-metric-slice:2026-06-13.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./dimensions";
export * from "./events";
export * from "./authority";
export * from "./metric";
export * from "./slice";
export * from "./engine";
export * from "./membership";
