// platform/markets/cdm/index.ts
//
// Barrel export for the CDM v1 slice. Downstream consumers (Anya
// projections, Bea IFRS classifier, Atlas substrate-state) import from
// `@platform/markets/cdm`.
//
// Author: Kai · M1 per D-MARKETS-SCHEMA-FOUNDATION.
// FX event types added at M4 (Saskia + Kai, 2026-05-09) per the FX
// product-family proposal and D-FX-* sub-decisions.

export * from "./primitives";
export * from "./equity";
export * from "./fx";
export * from "./fx-helpers";
