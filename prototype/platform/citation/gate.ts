// platform/citation/gate.ts
//
// CI gate: re-validates that every event in the store carries at least
// one citation (Principle 2). The append path enforces the same constraint
// via Zod, so a violation here would indicate corruption or a bypass.
//
// Run: `bun run platform/citation/gate.ts [path-to-event-db]`
//
// Author: Mira (compliance / RegTech engineer) · Atlas (platform plumbing)

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { EventStore } from "../event-store/store";
import { logger } from "../observability/logger";

const dbPath = process.argv[2] ?? process.env.BANK_EVENT_DB ?? ".local/event.db";
mkdirSync(dirname(dbPath), { recursive: true });
const store = new EventStore(dbPath);

let total = 0;
let violations = 0;

for (const event of store.replay()) {
  total++;
  if (!event.citations || event.citations.length === 0) {
    logger.error(
      { event_id: event.event_id, type: event.type },
      "P2 violation — event has no citations",
    );
    violations++;
  }
}

store.close();

logger.info(
  { total, violations, dbPath },
  violations === 0 ? "Citation gate passed" : "Citation gate failed",
);

process.exit(violations === 0 ? 0 : 1);
