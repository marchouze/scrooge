// v2-core/posture/applies-when.ts
//
// APPLIES_WHEN predicate type — the typed `AppliesToScope` discriminated union
// that captures the conditions under which a posture is active.
//
// Design principle: structured-first (D-W8-POSTURE-REGISTER-SLICE-1).
// Learned weights MAY propose a posture change; only a typed event DISPOSES it.
// Every predicate is typed, citable, and replayable (Principle 1).
//
// The `evaluateAppliesToScope` evaluator is pure — it receives the predicate
// and a `PostureContext` describing the current evaluation environment and
// returns a boolean without side effects. This keeps the posture register
// projectable over any historical event sequence.
//
// PACKAGE BOUNDARY: this file MUST NOT import from v1 (`platform/`, `runtime/`,
// `domains/`, etc.). The no-v1-import gate (`recon:v2-no-v1-import`) enforces
// this at CI. Imports are restricted to `zod` (npm) and intra-package
// relatives.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { z } from "zod";

// ---------------------------------------------------------------------------
// PostureContext
// ---------------------------------------------------------------------------

/**
 * The evaluation context passed to `evaluateAppliesToScope`. Captures the
 * environmental dimensions the predicate may test. All fields are optional —
 * a context may supply only the dimensions relevant to the posture family
 * being evaluated; unmatched dimensions fall through the `always` branch.
 *
 * At S3 this is a structural type; richer context (e.g. live entity-hierarchy
 * resolution) lands in later slices when the tenant axis (S1/S2) is wired.
 */
export interface PostureContext {
  /** ISO-3166-1 alpha-2 jurisdiction code, e.g. "ZA". */
  readonly jurisdiction?: string;
  /** Entity type string, e.g. "bank", "branch", "holding-company". */
  readonly entityType?: string;
  /** FIL taxonomy scope pattern, e.g. "fil:type:fx:*". */
  readonly filTaxonomyScope?: string;
  /** Regulatory-regime URN, e.g. "urn:reg:za:pa:d7-2023". */
  readonly regimeId?: string;
  /** Risk-class token, e.g. "RT-MK", "RT-LQ", "RT-CR". */
  readonly riskClass?: string;
}

export const postureContextSchema = z.object({
  jurisdiction: z.string().optional(),
  entityType: z.string().optional(),
  filTaxonomyScope: z.string().optional(),
  regimeId: z.string().optional(),
  riskClass: z.string().optional(),
});

// ---------------------------------------------------------------------------
// AppliesToScope — discriminated union
// ---------------------------------------------------------------------------

/**
 * Typed APPLIES_WHEN predicate (W8 brief §2). A discriminated union covering:
 *   - `jurisdiction`        — active in a specific jurisdiction
 *   - `entity-type`         — active for a specific entity type
 *   - `product-scope`       — active for a FIL taxonomy scope pattern
 *   - `regulatory-regime`   — active under a specific regulatory regime
 *   - `risk-class`          — active for a risk-class
 *   - `always`              — unconditional (active in all contexts)
 *   - `and`                 — conjunction of conditions (all must hold)
 *   - `or`                  — disjunction of conditions (at least one must hold)
 *
 * Recursive kinds (`and` / `or`) allow arbitrarily nested predicates. The
 * evaluator short-circuits: `and` stops on the first false; `or` stops on the
 * first true.
 */
export type AppliesToScope =
  | { readonly kind: "jurisdiction"; readonly jurisdiction: string }
  | { readonly kind: "entity-type"; readonly entityType: string }
  | { readonly kind: "product-scope"; readonly filTaxonomyScope: string }
  | { readonly kind: "regulatory-regime"; readonly regimeId: string }
  | { readonly kind: "risk-class"; readonly riskClass: string }
  | { readonly kind: "always" }
  | { readonly kind: "and"; readonly conditions: readonly AppliesToScope[] }
  | { readonly kind: "or"; readonly conditions: readonly AppliesToScope[] };

// Zod schema — forward-declared so the recursive `and`/`or` arms can reference
// the base schema. `z.lazy` breaks the circular reference at the Zod level.
const appliesToScopeLeafSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("jurisdiction"), jurisdiction: z.string().min(1) }),
  z.object({ kind: z.literal("entity-type"), entityType: z.string().min(1) }),
  z.object({ kind: z.literal("product-scope"), filTaxonomyScope: z.string().min(1) }),
  z.object({ kind: z.literal("regulatory-regime"), regimeId: z.string().min(1) }),
  z.object({ kind: z.literal("risk-class"), riskClass: z.string().min(1) }),
  z.object({ kind: z.literal("always") }),
]);

// Recursive schema: and/or carry arrays of AppliesToScope (which may include
// and/or themselves). Depth is bounded by the Zod recursion limit (≈ 100);
// real predicates have depth ≤ 4.
type AppliesToScopeInput =
  | z.input<typeof appliesToScopeLeafSchema>
  | {
      kind: "and";
      conditions: AppliesToScopeInput[];
    }
  | {
      kind: "or";
      conditions: AppliesToScopeInput[];
    };

export const appliesToScopeSchema: z.ZodType<AppliesToScope, z.ZodTypeDef, AppliesToScopeInput> =
  z.lazy(() =>
    z.union([
      appliesToScopeLeafSchema,
      z.object({ kind: z.literal("and"), conditions: z.array(appliesToScopeSchema).min(1) }),
      z.object({ kind: z.literal("or"), conditions: z.array(appliesToScopeSchema).min(1) }),
    ]),
  );

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * Pure predicate evaluator: returns `true` iff the `scope` predicate holds in
 * `context`. Short-circuits on `and`/`or`. Never throws — a missing context
 * field resolves as `false` for atomic predicates (i.e. a posture that APPLIES_WHEN
 * jurisdiction=ZA is inactive when the context carries no jurisdiction).
 *
 * The `always` predicate always returns `true` regardless of context.
 */
export function evaluateAppliesToScope(scope: AppliesToScope, context: PostureContext): boolean {
  switch (scope.kind) {
    case "always":
      return true;
    case "jurisdiction":
      return context.jurisdiction === scope.jurisdiction;
    case "entity-type":
      return context.entityType === scope.entityType;
    case "product-scope":
      return matchesScopePattern(context.filTaxonomyScope, scope.filTaxonomyScope);
    case "regulatory-regime":
      return context.regimeId === scope.regimeId;
    case "risk-class":
      return context.riskClass === scope.riskClass;
    case "and":
      return scope.conditions.every((c) => evaluateAppliesToScope(c, context));
    case "or":
      return scope.conditions.some((c) => evaluateAppliesToScope(c, context));
  }
}

/**
 * Simple scope-pattern match: the pattern may end with `*` as a prefix
 * wildcard. E.g. `"fil:type:fx:*"` matches `"fil:type:fx:spot:otc-vanilla@1.0"`.
 * An exact pattern matches only the exact string.
 */
function matchesScopePattern(value: string | undefined, pattern: string): boolean {
  if (value === undefined) return false;
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }
  return value === pattern;
}
