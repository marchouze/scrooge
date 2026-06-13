// v2-core/fil-core/alias-registry.ts
//
// The SHARED FIL alias-registry — one substrate for every swappable construction
// / selection seam in the FIL kernel (WS-V2-BBAAS).
//
// ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
// The FIL kernel grows by SEAMS: a stable indirection point whose implementation
// can be swapped (a strangler / cutover) WITHOUT touching any call-site. Two such
// seams landed independently and each minted its OWN module-singleton:
//   - the S6 composition-factory alias (`composition-factory-alias.ts`): a
//     `let registered` holding the live factory, swapped via a register/restore
//     handle; and
//   - the SA-CCR alias-flip cutover: the live CCR computation routed through the
//     validated v2 FIL-Model (`computeSaCcr`).
// Re-deriving the same register / resolve / swap-and-restore / eager-default
// machinery per seam is duplication, and an ad-hoc per-seam singleton is exactly
// the kind of drift `recon:v2-alias-registry-conformance` now forbids: every
// swappable v2-core seam resolves through THIS registry, under a namespaced key.
//
// ─── THE CONTRACT ───────────────────────────────────────────────────────────
//   registerAlias(key, impl)   — register the EAGER DEFAULT for a key. Called once
//                                per seam at module load, so the alias is live from
//                                line one (never dangling). Re-registering the same
//                                key throws (a default is registered exactly once;
//                                runtime swaps go through `swapAlias`).
//   resolveAlias(key)          — return whatever is registered NOW for the key.
//                                Throws if the key was never registered (a resolve
//                                of an unknown seam is a programming error, not a
//                                silent undefined — the seam must register its
//                                default eagerly).
//   swapAlias(key, impl)       — swap the implementation behind the key (the
//                                cutover / rollback / test-isolation primitive).
//                                Returns a `restore()` handle that re-registers
//                                whatever was live before the swap. Throws if the
//                                key was never registered (you cannot swap a seam
//                                that has no default).
//
// Keys are NAMESPACED strings (`<namespace>:<seam>`, e.g.
// `fil-core:composition-factory`, `fil-models:sa-ccr`) so independent seams
// coexist in one registry without collision. The registry is generic over the
// implementation type per key (each seam wraps `resolveAlias` in a typed
// accessor, so callers never see the `unknown` boundary).
//
// NO v1 imports — pure v2-core kernel infrastructure (enforced by
// `recon:v2-no-v1-import`). NO valuation / lifecycle / risk — pure indirection.
//
// Authority: D-FIL-SHARED-ALIAS-REGISTRY (CEO-approved 2026-06-13);
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:fil-shared-alias-registry-one-substrate-migrate-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

/**
 * A handle returned by a swap, allowing the previous implementation to be
 * restored. The restore is idempotent-safe to call once (the cutover/rollback
 * and test-isolation primitive).
 */
export interface AliasRestore {
  /** Re-register the implementation that was live before the swap. */
  restore(): void;
}

// ---------------------------------------------------------------------------
// The registry singleton. Module-scoped so it is process-global within the
// package. Each key's CURRENT implementation is stored; the eager default is
// the first registration. The stored type is `unknown` — every seam wraps
// resolution in a typed accessor, so the cast is contained to the seam module.
// ---------------------------------------------------------------------------

const registry = new Map<string, unknown>();

/**
 * Register the EAGER DEFAULT implementation for a seam key. Called exactly once
 * per key, at the seam module's load time, so the alias is live before any
 * consumer resolves it. Re-registering an already-registered key throws — a
 * default is registered once; runtime swaps go through `swapAlias`.
 */
export function registerAlias<T>(key: string, impl: T): void {
  if (registry.has(key)) {
    throw new Error(
      `alias-registry: key "${key}" already has a registered default; register the default exactly once per seam (use swapAlias for runtime swaps).`,
    );
  }
  registry.set(key, impl);
}

/**
 * Resolve the implementation currently behind a seam key. Always defined for a
 * registered key; throws for an unknown key (a resolve of an unregistered seam
 * is a programming error — the seam must register its default eagerly, so the
 * alias is never dangling).
 */
export function resolveAlias<T>(key: string): T {
  if (!registry.has(key)) {
    throw new Error(
      `alias-registry: key "${key}" is not registered — the seam's eager default was never registered. Import the seam module so its registerAlias runs at load.`,
    );
  }
  return registry.get(key) as T;
}

/**
 * Swap the implementation behind a seam key (the cutover / rollback / test
 * isolation primitive). Returns a restore handle that re-registers whatever was
 * live before the swap. Throws if the key was never registered — you cannot
 * swap a seam that has no default.
 */
export function swapAlias<T>(key: string, impl: T): AliasRestore {
  if (!registry.has(key)) {
    throw new Error(
      `alias-registry: cannot swap key "${key}" — it has no registered default. Register the seam's default eagerly first.`,
    );
  }
  const previous = registry.get(key) as T;
  registry.set(key, impl);
  return {
    restore() {
      registry.set(key, previous);
    },
  };
}

/**
 * `true` iff a key has a registered implementation. Lets a seam guard its own
 * eager registration against double-import / hot-reload (register once).
 */
export function isAliasRegistered(key: string): boolean {
  return registry.has(key);
}
