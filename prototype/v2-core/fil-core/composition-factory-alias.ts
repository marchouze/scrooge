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
// A module-singleton holds the currently-registered factory. At module load the
// DEFAULT factory is registered, so the alias is live from line one (no boot
// step required). `registerCompositionFactory(impl)` swaps it (returning a
// restore handle so a swap can be unwound — the cutover/rollback primitive);
// `resolveCompositionFactory()` returns whatever is registered NOW. The
// convenience `buildComposite(spec)` is the one-call construction surface every
// consumer uses — it resolves the alias and delegates, so it always honours the
// current implementation.
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
  type BuiltComposite,
  type CompositeSpec,
  type CompositionFactory,
  defaultCompositionFactory,
} from "./composition-factory";

/** The stable alias name — the addressable identity of the construction seam. */
export const COMPOSITION_FACTORY_ALIAS = "fil-core:composition-factory" as const;

// ---------------------------------------------------------------------------
// The registry singleton. Module-scoped so it is process-global within the
// package; the default is registered eagerly so the alias is never unresolved.
// ---------------------------------------------------------------------------

let registered: CompositionFactory = defaultCompositionFactory;

/** A handle returned by a swap, allowing the previous implementation to be restored. */
export interface CompositionFactoryRestore {
  /** Re-register the implementation that was live before the swap. */
  restore(): void;
}

/**
 * Swap the implementation behind the alias (the cutover primitive). Returns a
 * restore handle so the swap can be unwound (rollback / test isolation).
 */
export function registerCompositionFactory(impl: CompositionFactory): CompositionFactoryRestore {
  const previous = registered;
  registered = impl;
  return {
    restore() {
      registered = previous;
    },
  };
}

/** Resolve the implementation currently behind the alias. Always defined. */
export function resolveCompositionFactory(): CompositionFactory {
  return registered;
}

/** Reset the alias to the default factory (test/teardown convenience). */
export function resetCompositionFactory(): void {
  registered = defaultCompositionFactory;
}

/**
 * The one-call construction surface. Resolves the alias and delegates — every
 * consumer builds composites THROUGH this, so the construction path is swappable
 * without touching call-sites.
 */
export function buildComposite(spec: CompositeSpec): BuiltComposite {
  return resolveCompositionFactory().build(spec);
}
