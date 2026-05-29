// seeds/seeds-view.ts
//
// Read-side projection for the Seeds page (/api/seeds). For every entry in
// SEED_MANIFEST it reports: the manifest metadata, whether the seed is currently
// descoped (and the descope/promotion lineage), and how many events of each of
// its declared types are present in the store right now. This is what makes the
// boot-seed layer *visible* (objective 1 of D-TRUSTED-FIGURES-PROGRAM-V1).
//
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "@platform/event-store/store";
import { SEED_MANIFEST, type SeedManifestEntry } from "./manifest";

export interface SeedDescopeRecord {
  reason: string;
  actor: string;
  asOf: string;
}

export interface SeedPromotionRecord {
  replacementEventIds: string[];
  note?: string;
  asOf: string;
}

export interface SeedView extends SeedManifestEntry {
  /** True when a SeedDescoped or SeedPromotedToSimulated event exists for this seedId. */
  descoped: boolean;
  /** Latest descope record, if any. */
  descope?: SeedDescopeRecord;
  /** Latest promotion-to-simulated record, if any. */
  promotion?: SeedPromotionRecord;
  /** Count of currently-present events per declared emitted type. */
  eventCounts: Record<string, number>;
  /** Total present events across this seed's declared types. */
  totalEvents: number;
}

function countByType(store: EventStore, types: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of types) {
    let n = 0;
    try {
      for (const _ of store.replay({ type: t })) n++;
    } catch {
      n = 0;
    }
    counts[t] = n;
  }
  return counts;
}

export function buildSeedsView(store: EventStore): SeedView[] {
  // Latest descope / promotion per seedId.
  const descopes = new Map<string, SeedDescopeRecord>();
  const promotions = new Map<string, SeedPromotionRecord>();
  try {
    for (const ev of store.replay({ type: "SeedDescoped" })) {
      const p = ev.payload as { seedId?: string; reason?: string };
      if (p.seedId) {
        descopes.set(p.seedId, {
          reason: p.reason ?? "",
          actor: ev.actor?.id ?? "unknown",
          asOf: ev.as_of,
        });
      }
    }
    for (const ev of store.replay({ type: "SeedPromotedToSimulated" })) {
      const p = ev.payload as { seedId?: string; replacementEventIds?: string[]; note?: string };
      if (p.seedId) {
        promotions.set(p.seedId, {
          replacementEventIds: p.replacementEventIds ?? [],
          ...(p.note ? { note: p.note } : {}),
          asOf: ev.as_of,
        });
      }
    }
  } catch {
    // Best-effort — a degraded read shows seeds as not-descoped rather than throwing.
  }

  return SEED_MANIFEST.map((entry) => {
    const eventCounts = countByType(store, entry.emittedEventTypes);
    const totalEvents = Object.values(eventCounts).reduce((a, b) => a + b, 0);
    const descope = descopes.get(entry.seedId);
    const promotion = promotions.get(entry.seedId);
    return {
      ...entry,
      descoped: descope !== undefined || promotion !== undefined,
      ...(descope ? { descope } : {}),
      ...(promotion ? { promotion } : {}),
      eventCounts,
      totalEvents,
    };
  });
}
