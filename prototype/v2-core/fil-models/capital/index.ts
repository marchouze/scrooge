// v2-core/fil-models/capital/index.ts
//
// Barrel export for the Capital FIL asset class (D-CAPITAL-ASSET-CLASS-V1).
// Capital is a first-class FIL asset class for the bank's OWN qualifying
// regulatory capital (CET1 / AT1 / Tier 2), SEPARATE from every market asset
// class. It implements the Accountable + Reportable facets (the capital-model);
// it is NOT a Valuable / RiskMeasurable market exposure — it is the
// capital-adequacy NUMERATOR (own funds), the complement of the RWA denominator.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

// Type definition + lifecycle.
export * from "./types/capital-lifecycles.ts";
export * from "./types/capital-type-definitions.ts";
// Accountable / Reportable model.
export * from "./capital-model.ts";
