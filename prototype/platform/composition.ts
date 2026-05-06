// platform/composition.ts
//
// Composition root. Wires interfaces (which capability code depends on) to
// their *local* implementations. The cloud lift (M8 per the reporting-
// capability spec) replaces this file's contents — it does not touch
// capability code.
//
// Per Principle 3: build full local first, migrate to cloud as a single
// coherent phase.
//
// Author: Atlas

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { EventStore } from "./event-store/store";
import { logger } from "./observability/logger";

const dbPath = process.env.BANK_EVENT_DB ?? ".local/event.db";
mkdirSync(dirname(dbPath), { recursive: true });

export const eventStore = new EventStore(dbPath);
export { logger };

logger.debug({ dbPath }, "composition root wired");
