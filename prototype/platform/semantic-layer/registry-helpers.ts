// platform/semantic-layer/registry-helpers.ts
//
// Helper functions for querying the quantity registry.
//
// Author: Anya (Data / analytics engineer, engineering)

import { QUANTITY_REGISTRY } from "./quantities";
import type { QuantityDefinition, QuantityDomain } from "./quantities";

/**
 * Look up a single quantity by its machine-readable code.
 *
 * Returns `undefined` when the code is not found (unknown code). Callers that
 * require the quantity to exist should assert non-undefined.
 */
export function getQuantity(code: string): QuantityDefinition | undefined {
  return QUANTITY_REGISTRY.find((q) => q.code === code);
}

/**
 * Return all registered quantities as a mutable array copy.
 * Safe to sort / filter without mutating the registry.
 */
export function listQuantities(): QuantityDefinition[] {
  return [...QUANTITY_REGISTRY];
}

/**
 * Return all quantities in the given domain.
 * Returns an empty array when no quantities match the domain.
 */
export function listByDomain(domain: QuantityDomain): QuantityDefinition[] {
  return QUANTITY_REGISTRY.filter((q) => q.domain === domain);
}
