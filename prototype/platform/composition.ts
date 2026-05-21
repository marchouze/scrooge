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
import { resolveEventDbPath } from "./event-store/resolve-event-db";
import { EventStore } from "./event-store/store";
import { LocalAuthenticator } from "./identity";
import { logger } from "./observability/logger";
import { LocalProjector } from "./projections";
import { resolveCompositionClock } from "./scenario-clock";

// Local event-store path. Routed through the shared resolver in
// `event-store/resolve-event-db.ts`. The composition root deliberately
// passes `excludeHomeDefault: true`, which means it never auto-adopts
// the home-default shared store — that's a CI/test isolation guard, not
// a Principle 1 statement. Callers that DO want the shared home store
// (dispatch CLIs, emission scripts) call
// `applyDispatchEventDbResolution()` at the top of the script BEFORE
// importing composition; the wrapper mutates `process.env.BANK_EVENT_DB`
// so composition picks it up via tier #1 below.
//
// Resolution precedence (high → low) seen by composition:
//
//   1. `BANK_EVENT_DB` env var (already-set ambient — tests, scenarios,
//      dispatch boot, emission boot)
//   2. `BANK_HOME_EVENT_DB` env var (custom home location)
//   3. `.local/event.db` (per-worktree fallback)
//
// Why composition does NOT auto-adopt the home store. PR #695 (Helena
// (Chief Risk Officer, governance)'s MR-1-FX IPV recalibration) prompted
// this refactor — Helena's emission script wrote to the per-worktree
// fallback while Scrooge's dispatch CLI wrote to the home store. The fix
// is to make emission scripts opt into the home store via the same
// wrapper the dispatch CLIs use, NOT to silently re-route every consumer
// of composition. CI tests preload `tests/_setup.ts` which sets
// `BANK_EVENT_DB` to a temp dir; CI backfill + recon use the
// `.local/event.db` fallback. Both stay correct under this scheme.
//
// Multi-host or cloud sharing is handled by the Postgres mirror via
// `BANK_EVENT_DB_URL` (see `scripts/event-store-sync.ts`); the local sqlite
// remains canonical-shape and is bidirectionally synced before/after each
// agent workflow. The full Azure-target store lands in later
// D-EVENT-STORE-SCALING slices (Event Hubs + Cosmos). The cloud lift swaps
// the resolved path for a Cosmos/Postgres URL without touching capability
// code.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21).
const resolvedEventDb = resolveEventDbPath({ excludeHomeDefault: true });
const dbPath = resolvedEventDb.path;
const idpKeyPath = process.env.BANK_IDP_KEY ?? ".local/keys/idp.key";
mkdirSync(dirname(dbPath), { recursive: true });

const rawEventStore = new EventStore(dbPath);

// Permission policy resolver folds the event log; the gate consults it
// per append. The publisher (used by `bun run identity:issue`) writes
// through the underlying store so policy publication itself is never
// blocked by the gate.
const permissionPolicy = new LocalPermissionPolicyPublisher({ eventStore: rawEventStore });

// Gate is **on by default** as of T-01 (Senna+Rashida threat model
// 2026-05-10). To disable for local debugging, set
// `BANK_PERMISSION_GATE_DISABLED=true`. The pre-A1 backfill allow-list
// in `permission-gate.ts` softens the flip for actors whose policy is
// not yet published — each bypass emits a low-severity `SubstrateAlert`
// (alertClass: integrity) that Vera's recon drives to zero.
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
    // Note: no `onLegacyBypass` override. The default in
    // `permission-gate.ts` emits a low-severity `SubstrateAlert`
    // (alertClass: integrity) per (agentUrn, eventType) bypass — that's
    // the canonical record-of-bypass that Vera's recon drives to zero.
    // We deliberately don't add a logger.warn here: the SubstrateAlert
    // is the typed record (Principle 1); a parallel logger call would
    // be prose-without-event drift.
  },
});

export const projector = new LocalProjector(eventStore);
export const authenticator = new LocalAuthenticator({ keyPath: idpKeyPath });

// Controlled-time substrate (D-SCENARIO-CLOCK, authorised under
// D-FIRST-DRY-RUN-SCENARIO; CEO-approved 2026-05-10). Default `WallClock`
// keeps existing call sites unchanged. Scenarios that need controlled
// time set `BANK_SCENARIO_CLOCK_MODE=simulated` (and optionally
// `BANK_SCENARIO_CLOCK_BASELINE=<iso-8601>`) at boot, OR construct a
// `SimulatedClock` directly and pass it through their own composition
// (see `prototype/platform/scenario-clock/index.ts`).
//
// Callers source `as_of` from `clock.now()` instead of `new Date().toISOString()`.
// Existing `nowUtc()` / `Date.now()` callsites are intentionally left in
// place — they remain wall-clock-bound — so this slice does not perturb
// production behaviour. Scenario-aware callers migrate over time.
export const clock = resolveCompositionClock();

export { logger, permissionPolicy };

logger.debug(
  {
    dbPath,
    dbPathSource: resolvedEventDb.source,
    dbPathShared: resolvedEventDb.shared,
    idpKeyPath,
    permissionGateEnabled: isGateEnabled(),
    clockMode: clock.mode,
  },
  "composition root wired",
);
