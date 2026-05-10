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

// Local event-store path. Default `prototype/.local/event.db` is per-worktree
// (each `.claude/worktrees/...` spawn starts with an empty store), which means
// CeoDecision events recorded in one worktree are invisible in another and
// every fresh worktree shows already-actioned decisions as "open" until back-
// filled.
//
// To share a single event store across all worktrees on this machine, set:
//
//   export BANK_EVENT_DB="$HOME/.local/share/bank/event.db"
//
// (or any absolute path under your home directory). The next process to boot
// will create the file on first append; subsequent worktrees will see the
// same events and the dashboard will reflect a consistent decision posture.
//
// Multi-host or cloud sharing is handled by the Postgres mirror via
// `BANK_EVENT_DB_URL` (see `scripts/event-store-sync.ts`); the local sqlite
// remains canonical-shape and is bidirectionally synced before/after each
// agent workflow. The full Azure-target store lands in later
// D-EVENT-STORE-SCALING slices (Event Hubs + Cosmos).
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
