// platform/markets/products/index.ts
//
// Public surface of the typed Product layer (D-PRODUCT-CONSTRUCTION-
// SUBSTRATE Slice 1) and the Anya-authored semantic-layer entries that
// describe its named quantities. Downstream consumers (Vera attestation-
// integrity recon, Anya semantic layer, Saskia franchise-construction
// tooling) import from `@platform/markets/products`.
//
// Authors: Atlas + Kai (typed Product layer) · Anya (semantic-layer
// entries) · D-PRODUCT-CONSTRUCTION-SUBSTRATE.

export * from "./types";
export type { ProductSemanticLayerEntry } from "./semantic";
export { PRODUCT_SEMANTIC_LAYER_ENTRIES } from "./semantic";
