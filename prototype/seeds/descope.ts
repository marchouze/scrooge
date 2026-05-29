// seeds/descope.ts
//
// Reads the SeedDescoped / SeedPromotedToSimulated event streams and returns the
// set of seedIds the operator has chosen to stop booting (objective 1 of
// D-TRUSTED-FIGURES-PROGRAM-V1). `bootDerive()` consults this before each
// descopable boot call.
//
// Reversible by absence: there is no "re-scope" event. Removing the descope
// (only possible by editing the store, not via the UI) lets the seed boot again.
// A SeedPromotedToSimulated also implies descope — the seed has been replaced by
// author-driven simulated events, so re-booting it would double-count.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "@platform/event-store/store";

/**
 * Returns the set of descoped seedIds. Best-effort: a replay failure returns an
 * empty set (boot proceeds with all seeds) rather than throwing — a degraded
 * descope read must never block boot.
 */
export function loadDescopedSeedIds(store: EventStore): Set<string> {
  const descoped = new Set<string>();
  try {
    for (const ev of store.replay({ type: "SeedDescoped" })) {
      const p = ev.payload as { seedId?: string };
      if (p.seedId) descoped.add(p.seedId);
    }
    for (const ev of store.replay({ type: "SeedPromotedToSimulated" })) {
      const p = ev.payload as { seedId?: string };
      if (p.seedId) descoped.add(p.seedId);
    }
  } catch {
    return new Set<string>();
  }
  return descoped;
}
