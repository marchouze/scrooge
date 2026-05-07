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
import { LocalAuthenticator } from "./identity";
import { logger } from "./observability/logger";
import { LocalProjector } from "./projections";

const dbPath = process.env.BANK_EVENT_DB ?? ".local/event.db";
const idpKeyPath = process.env.BANK_IDP_KEY ?? ".local/keys/idp.key";
mkdirSync(dirname(dbPath), { recursive: true });

export const eventStore = new EventStore(dbPath);
export const projector = new LocalProjector(eventStore);
export const authenticator = new LocalAuthenticator({ keyPath: idpKeyPath });
export { logger };

logger.debug({ dbPath, idpKeyPath }, "composition root wired");
