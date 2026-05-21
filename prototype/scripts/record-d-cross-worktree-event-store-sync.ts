// scripts/record-d-cross-worktree-event-store-sync.ts
//
// One-shot Decision-event emit: D-CROSS-WORKTREE-EVENT-STORE-SYNC.
//
// Records the substrate decision to standardise the
// Scrooge-coordinated-in-session dispatch model on a single shared SQLite
// event store at `$HOME/.local/share/bank/event.db` (default), with the
// `BANK_HOME_EVENT_DB` env var as override. Each dispatch CLI
// (open-brief, start-run, close-run) mounts the shared store via a boot-
// time resolver (`scripts/dispatch/resolve-event-db.ts`).
//
// Three design options were considered (see brief
// `brief:atlas:cross-worktree-event-store-sync-retire-force-clo:2026-05-21`):
//   (A) shared event-store — chosen.
//   (B) snapshot + sync-on-dispatch — rejected: requires bidirectional
//       merge protocol; partial state breaks Principle 1 symmetry.
//   (C) brief-event-only seed — rejected: lifecycle events stay split
//       across N worktrees; recon topology sees only half.
//
// (A) is structurally identical to the Azure cloud target (Principle 3):
// a single canonical store; the M8 cloud lift only changes the path from
// SQLite-on-disk to Cosmos/Postgres without touching capability code or
// the dispatch CLIs.
//
// `--force-close-bypass-sync` is RETAINED as a loud-warn emergency escape
// valve: when used, it emits a `SubstrateAlert{alertClass:"integrity",
// severity:"high"}` event and stderr WARN line, so Vera's recon can drive
// the count to zero. Routine bypass becomes a recon finding, not a
// substrate workaround.
//
// Authority: CEO (build phase) per CLAUDE.md decision-authority routing
// table — "Engineering build decisions (substrate, platform, schema) →
// CEO (build phase)". Recorded via CEO session-delegation: Marc dispatched
// this brief through Scrooge with explicit "do all, sequenced as you think
// best" authorisation (round-2 item, 2026-05-21).
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-CROSS-WORKTREE-EVENT-STORE-SYNC";

const TITLE =
  "Shared SQLite event store for Scrooge-coordinated cross-worktree dispatch (retires --force-close-bypass-sync as routine cover)";
const CATEGORY = "governance" as const;
const RECOMMENDATION =
  "Adopt Option (A): a single shared SQLite event store at `$HOME/.local/share/bank/event.db` (overridable via `BANK_HOME_EVENT_DB`; `BANK_EVENT_DB` and the `--event-db` CLI flag take precedence for tests + scenarios). Each dispatch CLI (`open-brief`, `start-run`, `close-run`) mounts the shared store via `scripts/dispatch/resolve-event-db-boot` before `platform/composition` resolves its dbPath. `--force-close-bypass-sync` is retained as a loud-warn emergency escape valve — each use emits a `SubstrateAlert{alertClass:\"integrity\", severity:\"high\"}` event so the recon counter can drive routine bypass to zero.";
const RATIONALE =
  "Six `--force-close-bypass-sync true` invocations in a single session (2026-05-21) demonstrated the workaround had become routine cover, breaking `recon:dispatch-sync-integrity`'s reviewer→decider topology enforcement. The legitimate path is a single source of truth across all worktrees (Principle 1) — exactly the model the Azure cloud target uses (Principle 3, Cosmos/Postgres). Options (B) sync-on-dispatch and (C) seed-only events both introduce partial-state failure modes that Principle 1 forbids: in (B), reconciling concurrent writes to forked snapshots requires a bidirectional merge protocol SQLite's WAL+lock already solves at the file layer when (A) is used; in (C), lifecycle events stay split across N per-worktree stores so recon sees only half the topology. (A) is also the smallest substrate change — `BANK_EVENT_DB` and the resolution infrastructure are already in `platform/composition.ts`; this slice adds a boot-time resolver to the dispatch CLIs and standardises the home-default path. CI runners without `$HOME/.local/share/bank/event.db` create the file on first append (idempotent via `mkdirSync` in composition root); the fresh-runner test pattern is preserved because `tests/_setup.ts` continues to set `BANK_EVENT_DB` explicitly to a tmpdir.";
const CITATIONS = [
  "D-RMS-PHASE-1",
  "D-RMS-PHASE-2",
  "D-DISPATCH-SYNC-PRIMITIVE",
  "WS-DISPATCH-SUBSTRATE",
  "brief:atlas:cross-worktree-event-store-sync-retire-force-clo:2026-05-21",
] as const;

// Deterministic timestamps so the event store hashes the same on every CI run.
const REQUESTED_AT = "2026-05-21T10:00:00.000Z";
const APPROVED_AT = "2026-05-21T10:06:00.000Z";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const history = register.byId.get(DECISION_ID);
const alreadyRequested = !!history?.events.some((e) => e.phase === "requested");
const alreadyApproved = !!history?.events.some((e) => e.phase === "approved");

const emitted: { phase: string; eventId: string }[] = [];

if (!alreadyRequested) {
  const r = requestDecision(
    {
      decisionId: DECISION_ID,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    REQUESTED_AT,
  );
  emitted.push({ phase: "requested", eventId: r.eventId });
}

if (!alreadyApproved) {
  const a = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    APPROVED_AT,
  );
  emitted.push({ phase: "approved", eventId: a.eventId });
}

console.log(
  JSON.stringify(
    {
      level: "info",
      msg:
        emitted.length === 0
          ? `${DECISION_ID}: already requested + approved — skip`
          : `${DECISION_ID}: emitted ${emitted.length} phase event(s)`,
      emitted,
    },
    null,
    2,
  ),
);
