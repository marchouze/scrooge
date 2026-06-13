// scripts/seed-v2-csi-blocklist.ts
//
// Pilot seed: Zara's (Chief Compliance Officer, governance) CSI blocklist
// categories as V2 S12 CsiCategoryRegistered events.
//
// Emits one CsiCategoryRegistered per canonical seed category
// (`CSI_SEED_CATEGORIES` in v2-core/cross-tenant/csi-blocklist.ts). Idempotent:
// re-running when a category is already registered is a no-op (skip). The CSI
// blocklist register is then a projection over these events (Principle 1).
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-csi-blocklist.ts
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE (CSI blocklist gate before C-tier
// go-live); D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Competition-law basis: Competition Act 89 of 1998 s.4(1) (Owen W7 note §5.1).
// Principle 1 (events are truth).
// Author: Atlas (Substrate Architect, engineering) with the category taxonomy
//         from Zara (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeCsiCategoryRegistered } from "../platform/event-store/event-types/cross-tenant-csi";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { CSI_SEED_CATEGORIES } from "../v2-core/cross-tenant/csi-blocklist";
import type { CitationRef } from "../v2-core/fil-core/primitives";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:zara:compliance-officer" };

const EVENT_CITATIONS = [
  "D-W7-VENDOR-ENTITY-STRUCTURE",
  "D-V2-TENANCY-ARCHITECTURE",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// ---------------------------------------------------------------------------
// Idempotency: which categories are already registered (and not retired)
// ---------------------------------------------------------------------------

const existingActive = new Set<string>();
for (const ev of eventStore.replay({ type: "CsiCategoryRegistered" })) {
  const p = ev.payload as { categoryId?: string };
  if (p.categoryId) existingActive.add(p.categoryId);
}
for (const ev of eventStore.replay({ type: "CsiCategoryRetired" })) {
  const p = ev.payload as { categoryId?: string };
  if (p.categoryId) existingActive.delete(p.categoryId);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const batch: Event[] = [];
const asOf = clock.now();

for (const cat of CSI_SEED_CATEGORIES) {
  if (existingActive.has(cat.categoryId)) {
    process.stdout.write(`[skip] ${cat.categoryId} — already registered\n`);
    continue;
  }

  const citations = [...EVENT_CITATIONS, "Competition Act 89 of 1998 s.4(1)"];

  batch.push(
    makeCsiCategoryRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        categoryId: cat.categoryId,
        categoryClass: cat.categoryClass,
        description: cat.description,
        lawBasis: cat.lawBasis,
        registeredBy: "Zara (Chief Compliance Officer, governance)",
        citations: citations as unknown as CitationRef[],
      },
    }),
  );

  process.stdout.write(`[queue] ${cat.categoryId} (${cat.categoryClass})\n`);
}

if (batch.length === 0) {
  process.stdout.write(
    "seed:v2-csi-blocklist — all CSI categories already registered; nothing to emit\n",
  );
  process.exit(0);
}

for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit("CsiCategoryRegistered") });
}

process.stdout.write(
  `seed:v2-csi-blocklist — registered ${batch.length} CSI categor${batch.length === 1 ? "y" : "ies"}\n`,
);
