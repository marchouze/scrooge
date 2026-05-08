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

import { LocalPermissionPolicyPublisher } from "./agent-identity/permission-policy";
import { gateEventStore, isGateEnabled } from "./event-store/permission-gate";
import { EventStore } from "./event-store/store";
import { LocalAuthenticator } from "./identity";
import { logger } from "./observability/logger";
import { LocalProjector } from "./projections";

const dbPath = process.env.BANK_EVENT_DB ?? ".local/event.db";
const idpKeyPath = process.env.BANK_IDP_KEY ?? ".local/keys/idp.key";
mkdirSync(dirname(dbPath), { recursive: true });

const rawEventStore = new EventStore(dbPath);

// Permission policy resolver folds the event log; the gate consults it
// per append. The publisher (used by `bun run identity:issue`) writes
// through the underlying store so policy publication itself is never
// blocked by the gate.
const permissionPolicy = new LocalPermissionPolicyPublisher({ eventStore: rawEventStore });

// Gate is feature-flagged — A1.2 lands the substrate; the flip-on-day
// is M8 cloud lift per Atlas spec §3.1. Default off keeps existing
// event flows untouched.
export const eventStore = gateEventStore({
  store: rawEventStore,
  config: {
    policy: permissionPolicy,
    onDeny: ({ event, reason }) => {
      logger.error(
        { agentUrn: event.actor.id, eventType: event.type, reason },
        "permission-gate — denied",
      );
    },
  },
});

export const projector = new LocalProjector(eventStore);
export const authenticator = new LocalAuthenticator({ keyPath: idpKeyPath });
export { logger, permissionPolicy };

logger.debug(
  { dbPath, idpKeyPath, permissionGateEnabled: isGateEnabled() },
  "composition root wired",
);
