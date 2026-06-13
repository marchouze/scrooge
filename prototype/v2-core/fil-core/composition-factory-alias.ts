// v2-core/fil-core/composition-factory-alias.ts
//
// The composition-factory ALIAS — the swappable construction seam (V2 S6).
//
// ─── WHY THE SEAM EXISTS ────────────────────────────────────────────────────
// Composite-instrument construction is going to MOVE: today the default factory
// (`composition-factory.ts`) builds composites from typed specs over the S0
// algebra; later waves widen it (more instrument kinds, tenant-composed types,
// CDM-economic-terms leaves). Rather than have every call-site `import` the
// concrete factory — which would mean a wide, coordinated rewrite each time the
// construction path changes — consumers resolve the factory through this ALIAS:
// a single, stable indirection point. The implementation behind the alias can be
// swapped (a strangler/cutover) WITHOUT touching any call-site. This is the same
// seam shape as the SA-CCR alias-flip just completed (v2 became the sole live
// CCR emitter behind a single resolution boundary); here the boundary is the
// construction of composites rather than the emission of CCR events.
//
// ─── THE MECHANISM ──────────────────────────────────────────────────────────
// This seam resolves through the SHARED FIL alias-registry
// (`alias-registry.ts`), under the namespaced key `fil-core:composition-factory`.
// At module load the DEFAULT factory is registered EAGERLY as that key's default,
// so the alias is live from line one (no boot step required).
// `registerCompositionFactory(impl)` swaps it via the registry (returning a
// restore handle so a swap can be unwound — the cutover/rollback primitive);
// `resolveCompositionFactory()` returns whatever is registered NOW. The
// convenience `buildComposite(spec)` is the one-call construction surface every
// consumer uses — it resolves the alias and delegates, so it always honours the
// current implementation. The public surface is UNCHANGED by the migration onto
// the shared registry — only the internal singleton is now the shared substrate
// (no per-seam ad-hoc singleton; `recon:v2-alias-registry-conformance`).
//
// `recon:v2-composition-factory` (advisory) asserts that every composite
// construction in v2-core flows through this alias (`buildComposite` /
// `resolveCompositionFactory`), not through a direct import of the concrete
// `composition-factory` `build`, and that the alias resolves.
//
// NO valuation / lifecycle / risk — pure construction (brief out-of-scope).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.2).
// Brief: brief:atlas:v2-s6-composition-factory-behind-an-alias-prove-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import {
  type AliasRestore,
  isAliasRegistered,
  registerAlias,
  resolveAlias,
  swapAlias,
} from "./alias-registry";
import {
  type BuiltComposite,
  type CompositeSpec,
  type CompositionFactory,
  defaultCompositionFactory,
} from "./composition-factory";

/** The stable alias name — the addressable identity of the construction seam,
 * and this seam's namespaced key in the shared FIL alias-registry. */
export const COMPOSITION_FACTORY_ALIAS = "fil-core:composition-factory" as const;

// ---------------------------------------------------------------------------
// Eager default registration. The seam registers its DEFAULT factory in the
// shared registry at module load, so the alias is live from line one (never
// dangling). Guarded by `isAliasRegistered` so a double-import is a no-op
// rather than a re-register throw.
// ---------------------------------------------------------------------------

if (!isAliasRegistered(COMPOSITION_FACTORY_ALIAS)) {
  registerAlias<CompositionFactory>(COMPOSITION_FACTORY_ALIAS, defaultCompositionFactory);
}

/** A handle returned by a swap, allowing the previous implementation to be restored. */
export type CompositionFactoryRestore = AliasRestore;

/**
 * Swap the implementation behind the alias (the cutover primitive). Returns a
 * restore handle so the swap can be unwound (rollback / test isolation).
 */
export function registerCompositionFactory(impl: CompositionFactory): CompositionFactoryRestore {
  return swapAlias<CompositionFactory>(COMPOSITION_FACTORY_ALIAS, impl);
}

/** Resolve the implementation currently behind the alias. Always defined. */
export function resolveCompositionFactory(): CompositionFactory {
  return resolveAlias<CompositionFactory>(COMPOSITION_FACTORY_ALIAS);
}

/** Reset the alias to the default factory (test/teardown convenience). */
export function resetCompositionFactory(): void {
  swapAlias<CompositionFactory>(COMPOSITION_FACTORY_ALIAS, defaultCompositionFactory);
}

/**
 * The one-call construction surface. Resolves the alias and delegates — every
 * consumer builds composites THROUGH this, so the construction path is swappable
 * without touching call-sites.
 */
export function buildComposite(spec: CompositeSpec): BuiltComposite {
  return resolveCompositionFactory().build(spec);
}
