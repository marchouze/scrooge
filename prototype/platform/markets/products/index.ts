// platform/markets/products/index.ts
//
// Public surface of the Product layer.
//
// Today this re-exports the semantic-layer entries authored by Anya
// ahead of Slice 1 of D-PRODUCT-CONSTRUCTION-SUBSTRATE. When Slice 1
// lands `./types.ts` (Atlas + Kai), and Slice 2 lands the 12 product-
// lifecycle event types (Atlas), this index gains the corresponding
// type and reducer re-exports.
//
// Author: Anya (data / analytics engineer) · D-PRODUCT-CONSTRUCTION-SUBSTRATE.

export type { ProductSemanticLayerEntry } from "./semantic";
export { PRODUCT_SEMANTIC_LAYER_ENTRIES } from "./semantic";
