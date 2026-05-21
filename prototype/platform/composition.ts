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
// `event-store/resolve-event-db.ts` so every consumer of this composition
// root targets the same store as the dispatch CLIs (open-brief, start-run,
// close-run) and the `approve-d-*` / `record-d-*` / `file-*` emission
// scripts. Resolution precedence (high → low):
//
//   1. `BANK_EVENT_DB` env var (already-set ambient — tests, scenarios)
//   2. `BANK_HOME_EVENT_DB` env var (custom home location)
//   3. `$HOME/.local/share/bank/event.db` (default shared store)
//   4. `.local/event.db` (per-worktree fallback when $HOME unresolvable)
//
// Default is now the shared home store, not the per-worktree fallback.
// This eliminates the silent mis-targeting that surfaced in PR #695 (Helena
// (Chief Risk Officer, governance)'s MR-1-FX IPV recalibration emission
// landed in the wrong DB because the per-worktree fallback ran ahead of the
// home-default).
//
// To force a per-worktree or temp store, set `BANK_EVENT_DB` explicitly
// (tests + scenarios already do this via the test harness).
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
const resolvedEventDb = resolveEventDbPath();
const dbPath = resolvedEventDb.path;
const idpKeyPath = process.env.BANK_IDP_KEY ?? ".local/keys/idp.key";
mkdirSync(dirname(dbPath), { recursive: true });

if (resolvedEventDb.source === "fallback") {
  // Per-worktree fallback fires only when `$HOME` is unresolvable (unusual
  // containers, CI runners with no HOME). Log once via the structured
  // logger so any process whose event-store happens to land in a per-
  // worktree file has a single traceable record of why.
  logger.warn(
    { dbPath, source: resolvedEventDb.source },
    "composition resolved to per-worktree event-store fallback — cross-worktree visibility will not work",
  );
}

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
