// scripts/backfill-entity-functional-currency.ts
//
// Event-sources the IAS-21 FUNCTIONAL currency of each legal entity / branch
// from the legal-entity tree (WS-MULTI-BASE-CURRENCY). Emits one
// `EntityFunctionalCurrencyAssigned` per tree entity that does not yet have one
// — the FIRST assignment carries `priorFunctionalCurrency: null`. The anchor
// bank (`urn:legal-entity:hoz:hoz-bank:v1`, short-id LE-ZA-HOZ-BANK) is assigned
// functional ZAR; the group + securities entities likewise (all ZA-jurisdiction).
//
// Principle 1: the functional-currency axis is a typed event, NOT a silent seed
// edit. The seed `seeds/legal-entity-tree.json` carries `functionalCurrency` as
// source data; this script is its event-sourced render. Idempotent on entityId:
// re-running when an entity already has a (latest) assignment is a no-op.
//
// Authority: D-MULTI-BASE-CURRENCY-FOUNDATION (CEO-approved 2026-06-16);
//   IAS-21; D-LEGAL-ENTITY-TREE-V0; Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeEntityFunctionalCurrencyAssigned } from "../platform/event-store/event-types/legal-entity";
import { provenanceForEmit } from "../platform/event-store/provenance";
import legalEntityTree from "../seeds/legal-entity-tree.json";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:atlas:core-banking-platform-architect" };

const CITATIONS = ["D-MULTI-BASE-CURRENCY-FOUNDATION", "IAS-21", "D-LEGAL-ENTITY-TREE-V0"];

interface TreeFile {
  readonly entities: ReadonlyArray<{
    readonly entityId: string;
    readonly legalName: string;
    readonly functionalCurrency?: string;
  }>;
}

const tree = legalEntityTree as TreeFile;

// Idempotency: entityIds that already carry a functional-currency assignment.
const alreadyAssigned = new Set<string>();
for (const ev of eventStore.replay({ type: "EntityFunctionalCurrencyAssigned" })) {
  const p = ev.payload as { entityId?: string };
  if (p.entityId) alreadyAssigned.add(p.entityId);
}

const asOf = clock.now();
let emitted = 0;

for (const entity of tree.entities) {
  if (entity.functionalCurrency === undefined || entity.functionalCurrency.trim() === "") {
    throw new Error(
      `backfill-entity-functional-currency: tree entity "${entity.entityId}" has no functionalCurrency (source defect). WS-MULTI-BASE-CURRENCY.`,
    );
  }
  if (alreadyAssigned.has(entity.entityId)) {
    process.stdout.write(`[skip] ${entity.entityId} — functional currency already assigned\n`);
    continue;
  }
  const ev = makeEntityFunctionalCurrencyAssigned({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      entityId: entity.entityId,
      functionalCurrency: entity.functionalCurrency,
      priorFunctionalCurrency: null,
      effectiveDate: asOf,
      rationale: `Initial IAS-21 functional-currency assignment for ${entity.legalName} (${entity.functionalCurrency}) — primary economic environment, sourced from the legal-entity tree. WS-MULTI-BASE-CURRENCY.`,
    },
  });
  eventStore.append(ev, { provenance: provenanceForEmit("EntityFunctionalCurrencyAssigned") });
  emitted += 1;
  process.stdout.write(`[emit] ${entity.entityId} → ${entity.functionalCurrency}\n`);
}

process.stdout.write(
  `backfill-entity-functional-currency — ${emitted} assignment(s) emitted, ${alreadyAssigned.size} already present\n`,
);
