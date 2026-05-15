// platform/semantic-layer/seed.ts
//
// Boot-time registration of all semantic-layer quantities.
//
// Emits a `SemanticLayerQuantityRegistered` event for each of the 20 core
// quantities the first time the bank's event store sees a given code. Idempotent:
// already-registered codes are silently skipped (no duplicate events).
//
// Usage:
//   import { registerAllQuantities } from "@platform/semantic-layer";
//   await registerAllQuantities(eventStore);
//
// Or from a seed script:
//   bun run platform/semantic-layer/seed.ts
//
// Authority: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator).
// Principle 1: events are the sole durable record of which quantities are
//   registered; this function is the idempotent writer.
//
// Author: Anya (Data / analytics engineer, engineering)

import { type EventStore } from "../event-store/store";
import { QUANTITY_REGISTRY } from "./quantities";
import { makeSemanticLayerQuantityRegistered } from "./event-type";

const ENTITY = "BANK-ZA-001";
const REGISTERED_AT = new Date().toISOString();

/**
 * Emit `SemanticLayerQuantityRegistered` for each quantity that has not yet
 * been registered in the event store. Idempotent — already-registered codes
 * produce no new event.
 *
 * @param eventStore  The bank's event store (passed in for testability).
 * @param asOf        ISO-8601 as-of timestamp; defaults to `new Date().toISOString()`.
 */
export async function registerAllQuantities(
  eventStore: EventStore,
  asOf?: string,
): Promise<{ registered: string[]; skipped: string[] }> {
  const asOfTs = asOf ?? REGISTERED_AT;

  // Find which codes are already registered.
  const alreadyRegistered = new Set<string>();
  for (const event of eventStore.replay({ type: "SemanticLayerQuantityRegistered" })) {
    const payload = event.payload as { code?: string };
    if (payload.code) {
      alreadyRegistered.add(payload.code);
    }
  }

  const registered: string[] = [];
  const skipped: string[] = [];

  for (const quantity of QUANTITY_REGISTRY) {
    if (alreadyRegistered.has(quantity.code)) {
      skipped.push(quantity.code);
      continue;
    }

    const event = makeSemanticLayerQuantityRegistered({
      asOf: asOfTs,
      entity: ENTITY,
      actor: { type: "service", id: "agent:anya" },
      citations: ["D-SEMANTIC-LAYER-QUANTITIES-V1"],
      payload: {
        code: quantity.code,
        name: quantity.name,
        domain: quantity.domain,
        registeredAt: asOfTs,
      },
    });

    eventStore.append(event);
    registered.push(quantity.code);
  }

  return { registered, skipped };
}
