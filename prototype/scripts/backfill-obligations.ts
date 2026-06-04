// prototype/scripts/backfill-obligations.ts
//
// Backfill the bank-obligation register into events (Plane B,
// D-REGULATORY-ARCHITECTURE-TWO-PLANE). Reads the canonical
// Regulations/_obligations-register.md and emits one ObligationAdopted event
// per ORG-* row that does not already have one. Idempotent: re-running emits
// nothing once every row is adopted.
//
// Wired into `ci:migrate` so the event-sourced obligation register is
// deterministically reconstructable in CI (the markdown is the committed origin
// during the transition; PR B replaces it with a committed JSON seed).
//
// Run from prototype/: bun run scripts/backfill-obligations.ts
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { makeObligationAdopted } from "../platform/event-store/event-types/obligation-lifecycle";
import type { ObligationAdoptedPayload } from "../platform/event-store/event-types/obligation-lifecycle";
import type { Actor } from "../platform/event-store/types";
import { parseObligationsRegister } from "../platform/regulatory/obligation-linker";

const REGISTER_PATH = resolve(import.meta.dir, "../../Regulations/_obligations-register.md");
const ADOPTED_AT = "2026-06-04T00:00:00Z"; // deterministic backfill stamp
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira:obligations-backfill" };
const CITATIONS = [
  "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

function existingAdoptedIds(): Set<string> {
  const ids = new Set<string>();
  for (const ev of eventStore.replay({ type: "ObligationAdopted" })) {
    const p = ev.payload as { obligationId?: string };
    if (p.obligationId) ids.add(p.obligationId);
  }
  return ids;
}

function main(): void {
  const md = readFileSync(REGISTER_PATH, "utf8");
  const rows = parseObligationsRegister(md);
  const already = existingAdoptedIds();

  let emitted = 0;
  for (const row of rows) {
    if (already.has(row.id)) continue;
    const payload: ObligationAdoptedPayload = {
      obligationId: row.id,
      urn: row.urn ?? "",
      domain: row.domain ?? "",
      citation: row.citation ?? "",
      requirement: row.requirement ?? "",
      fulfilmentPolicy: row.fulfilmentPolicy ?? "",
      owner: row.owner ?? "",
      status: row.reviewStatus || "legacy-unreviewed",
      adoptedAt: ADOPTED_AT,
    };
    eventStore.append(
      makeObligationAdopted({
        asOf: ADOPTED_AT,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload,
      }),
    );
    emitted++;
  }

  console.log(
    `backfill:obligations — ${rows.length} register row(s); ${emitted} ObligationAdopted emitted, ${rows.length - emitted} already present.`,
  );
}

main();
