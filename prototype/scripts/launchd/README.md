# `prototype/scripts/launchd/` — local cron driver for `scheduler-tick`

Slice 1 of `D-AGENT-AUTONOMY-OPERATIONAL` (CEO-approved 2026-05-11).
Brief: [`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md`](../../../Owner%20Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md).

## What this is

A local OS-level cron driver that keeps `bun run scheduler:tick` firing
every 60 seconds, surviving terminal close and dashboard-process death.

- **macOS** — a `launchd` LaunchAgent (`com.scrooge.scheduler-tick.plist`).
- **Linux** — a `systemd` user unit + timer
  (`com.scrooge.scheduler-tick.service` + `.timer`).

This is the build-phase persistent host for the agent runtime
substrate. Once installed, the scheduler-tick chain (sync → tick →
consume → inactivity-check) drives autonomously without any
foreground process.

## Clean-worktree deploy topology (D-SCHEDULER-DEPLOY-DECOUPLE)

**Authority: `D-SCHEDULER-DEPLOY-DECOUPLE` (CEO-approved 2026-06-22).**

The launchd jobs run from a **dedicated CLEAN worktree** — `.scheduler-live`,
the scheduler analogue of the dashboard's `.dashboard-live` — that a companion
`com.scrooge.scheduler-autopull` agent keeps pinned to `origin/main` every 30s
(`git fetch origin main && git reset --hard origin/main`). The interval-driven
scheduler-tick then picks up the refreshed checkout on its next tick.

This **replaces** the old in-process self-update: the tick used to
`git fetch origin main` + `git rebase origin/main` + `git pull --rebase` as a
side-effect of committing event-derived `archive/owner-inbox/*.md` renders to
the **main** worktree. Those render-commits accumulated, conflicted on rebase,
**wedged** the rebase, and stranded the fleet on STALE code until a manual
`reset --hard origin/main`. Committing event-derived markdown to git also
violates **Principle 1** (events are the only source of truth; markdown is a
render, never the canonical artefact — and RMS Phase 4 already made the RMS
registers canonical and archived the inbox dirs).

After this change the scheduler-tick performs **zero git operations** and writes
**nothing** to the main worktree:

| Job | Writes to main worktree? | What it does instead |
| --- | --- | --- |
| `com.scrooge.scheduler-tick` | **No** | Pure consumer of the autopulled checkout; emits events to the store. |
| `com.scrooge.scheduler-autopull` | **No** | `reset --hard origin/main` on the serve-only `.scheduler-live` worktree. |
| `com.scrooge.event-store-archive` | **No** | Writes only to the gitignored `~/.local/share/bank/archives/`. |
| `com.scrooge.golden-source-integrity-tick` | **No** | Emits `SubstrateAlert` events; its hash is never committed (`data/documents/*` gitignored). |

Because **no** installed job writes to main, the `BANK_ALLOW_MAIN_WORKTREE_WRITE=1`
allowlist opt-in is **no longer injected** into any plist (see the section below).

## What this is **NOT**

- This is **not** a production deployment. Per the CEO decision,
  production-grade always-on is **deferred to the Azure migration
  workstream** (Container Apps Jobs + Logic Apps target per the
  2026-05-07 substrate spec §6).
- This is **not** a replacement for the 27 GH-Actions cron workflows
  in `.github/workflows/agent-runtime-*.yml` — those continue to run
  in parallel until a separate follow-on decision retires them after
  Slice 1 has stable telemetry.
- This is **not** signed-build infrastructure. It runs whatever code
  is on disk in the prototype directory at the moment of each tick;
  treat the laptop as the trust boundary.

## Files

| File                                              | Purpose                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `com.scrooge.scheduler-tick.plist`                | macOS LaunchAgent template; `install.sh` substitutes paths and renders. Runs from `.scheduler-live`. |
| `com.scrooge.scheduler-autopull.plist`            | macOS LaunchAgent template — pins `.scheduler-live` to origin/main every 30 s (D-SCHEDULER-DEPLOY-DECOUPLE). |
| `scrooge-scheduler-autopull.sh`                   | The autopull worker the above plist invokes (`git fetch` + `reset --hard origin/main`). |
| `com.scrooge.event-store-archive.plist`           | macOS LaunchAgent — `archive:check` every 6 h (D-EVENT-STORE-SCALING-PHASE-5). |
| `com.scrooge.golden-source-integrity-tick.plist`  | macOS LaunchAgent — daily shared-store golden-source integrity assertion (see below). |
| `install.sh`                                      | macOS install script — renders the plists, bootstraps via `launchctl`, idempotent. Installs all four agents. |
| `uninstall.sh`                                     | macOS uninstall — `launchctl bootout` + `rm` for all four agents, idempotent. |
| `com.scrooge.scheduler-tick.service`              | Linux systemd user unit (one-shot worker).                                     |
| `com.scrooge.scheduler-tick.timer`                | Linux systemd user timer (60s cadence).                                        |

## Golden-source integrity tick (`com.scrooge.golden-source-integrity-tick`)

A daily LaunchAgent that runs `bun run recon:golden-source-integrity-tick`
(`scripts/regulatory/golden-source-integrity-tick.ts`).

`recon:regulatory-golden-source-integrity` is a **shared-store assertion**,
not a clean-CI gate (`D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION`, 2026-06-13):
golden-source bytes and the `goldenSourceHash` linkage live in the
shared/home store **by design** (Principle 1; `data/documents/*` is
gitignored). On a clean CI runner the regulatory graph is never seeded, so
the gate reads zero nodes and warns-clean — the real dangling-hash assertion
runs **nowhere in the pipeline**. This tick is the place it actually runs:

1. Seeds the regulatory graph from the **populated** shared store (the boot
   shim resolves `BANK_EVENT_DB` / `BANK_DOCUMENT_STORE` to the home pair;
   `BANK_GRAPH_DB` is the home `graph.db`).
2. Runs the gate against the seeded graph + resolved store.
3. Emits a `SubstrateAlert{alertClass:"integrity"}` (idempotent, one stable
   `alertId` per dangling node) for any golden-source hash with no blob in any
   reachable store — so a genuinely missing blob is escalated, not silent.

Fires daily (`StartInterval 86400`) — a golden-source blob does not vanish
mid-day, and `RunAtLoad` catches a missed window on next wake. Exit code is
always 0: the tick records its finding as a `SubstrateAlert` event; it does
not fail the host.

## macOS install

**Prerequisite (D-SCHEDULER-DEPLOY-DECOUPLE):** create the clean
`.scheduler-live` worktree pinned to origin/main first (once):

```bash
git -C /Users/marc/code/Bank worktree add --detach /Users/marc/code/Bank/.scheduler-live origin/main
# `.env.local` is gitignored, so copy it into the live worktree so Bun loads
# non-BANK keys (GEMINI_API_KEY / ANTHROPIC_API_KEY) at process start:
cp /Users/marc/code/Bank/prototype/.env.local /Users/marc/code/Bank/.scheduler-live/prototype/.env.local
( cd /Users/marc/code/Bank/.scheduler-live/prototype && bun install )
```

Then, from any checkout:

```bash
bash prototype/scripts/launchd/install.sh
```

The script:

1. Detects the worktree it is run from (for templates + `.env.local`).
2. Resolves `SCHEDULER_LIVE_DIR` — `<canonical-main>/.scheduler-live` by
   default (derived from `git rev-parse --git-common-dir`; override with
   `SCHEDULER_LIVE_DIR=/abs/path`). The four jobs' `WorkingDirectory` is
   `$SCHEDULER_LIVE_DIR/prototype`.
3. Resolves `bun` (override with `BUN=/path/to/bun`).
4. Creates `~/Library/Logs/scrooge/` (override with `LOG_DIR=...`).
5. Renders + bootstraps all four plists into `~/Library/LaunchAgents/`.
6. Verifies each via `launchctl print gui/$(id -u)/<label>`.

If already installed and a rendered plist matches the live one
byte-for-byte, that agent no-ops.

### macOS uninstall

```bash
bash prototype/scripts/launchd/uninstall.sh
```

(Logs at `~/Library/Logs/scrooge/` are left in place — `rm` them
manually if desired.)

### macOS verification

```bash
# Confirm the job is loaded:
launchctl print gui/$(id -u)/com.scrooge.scheduler-tick | head -40

# Tail the log (4 successful tick lines should appear within 5 minutes):
tail -f ~/Library/Logs/scrooge/scheduler-tick.log

# Force a one-off run (does not change the cadence):
launchctl kickstart -p gui/$(id -u)/com.scrooge.scheduler-tick
```

## Linux install

From the repository root:

```bash
mkdir -p ~/.config/systemd/user
sed \
  -e "s|__BUN_PATH__|$(command -v bun)|g" \
  -e "s|__WORKING_DIRECTORY__|$(pwd)/prototype|g" \
  prototype/scripts/launchd/com.scrooge.scheduler-tick.service \
  > ~/.config/systemd/user/com.scrooge.scheduler-tick.service
cp prototype/scripts/launchd/com.scrooge.scheduler-tick.timer \
  ~/.config/systemd/user/com.scrooge.scheduler-tick.timer
systemctl --user daemon-reload
systemctl --user enable --now com.scrooge.scheduler-tick.timer
```

### Linux verification

```bash
systemctl --user status com.scrooge.scheduler-tick.timer
systemctl --user list-timers com.scrooge.scheduler-tick.timer
journalctl --user -u com.scrooge.scheduler-tick.service -f
```

### Linux uninstall

```bash
systemctl --user disable --now com.scrooge.scheduler-tick.timer
rm ~/.config/systemd/user/com.scrooge.scheduler-tick.{service,timer}
systemctl --user daemon-reload
```

## Expected behaviour

Each tick runs the full chain in `prototype/scripts/scheduler-tick.ts`:

1. **`syncRegistry`** — refresh schedule entries from registered agents
   plus the runtime's `handlers-metadata.ts`.
2. **`tick`** — emit `ScheduledTrigger` events for any due entries.
3. **`consume`** — drain pending `ScheduledTrigger` events through
   `ScheduledTriggerConsumer` → `runAgent` → emit
   `SubstrateAgentRunStarted` / `Completed` / `Failed` lifecycle pairs
   (idempotent on `(eventId, handlerKey)` via `BusDispatched`).
4. **`inactivityCheck`** — emit `SubstrateAlert` for any agent whose
   last lifecycle pair exceeds its declared inactivity SLA.

Per [`Owner Inbox/2026-05-10_atlas_s8-substrate-state-v2.md`](../../../Owner%20Inbox/2026-05-10_atlas_s8-substrate-state-v2.md)
§0, a clean run on `main` produces 25 schedule entries → 79 firings
on first install (catch-up); steady-state ticks fire 0–N firings
depending on which `cronExpression` rows in `handlers-metadata.ts` are
due in the current minute.

To see which handlers will fire when, see `prototype/runtime/handlers-metadata.ts`
(`HANDLERS_METADATA` array — the `cronExpression` field on each
`scheduled` row drives the cadence).

## Acceptance criteria (Slice 1 §4 of the brief)

The substrate-side acceptance criteria are checked at PR time
(`bun run ci`). The behavioural acceptance criteria require a real
install on Marc's workstation and are verified post-merge:

1. `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.scrooge.scheduler-tick.plist`
   registers the job; `launchctl print` confirms it.
2. After 5 minutes, `~/Library/Logs/scrooge/scheduler-tick.log` shows
   ≥4 successful `scheduler:tick — done` lines (one per minute).
3. Closing `prototype/dashboard/server.ts` does NOT stop the scheduler
   tick (proves the Gap 2 build-phase fixture).
4. After 30 minutes, querying the event store shows ≥30
   `ScheduledTrigger` audit events with timestamps ≈1 min apart, and
   lifecycle-paired runs for any handler whose `cronExpression` fired.
5. `inactivityCheck()` emits `SubstrateAlert` if any agent's
   lifecycle-pair gap exceeds its declared inactivity SLA.

## Logging surface (Senna review)

The scheduler-tick log surface contains:

- Agent URNs (e.g. `agent:vera`).
- Trigger IDs (e.g. `vera-overnight-recon`).
- Firing timestamps + delay-ms.
- Dispatch outcomes (`ok` / `failed` / `unmatched`).
- Parse-failure reasons (URN + reason string).
- Inactivity-alert payloads (alertId + details).

The log surface does **not** contain credentials, signing keys, or
bearer tokens. Anything sensitive is held by sub-modules (the
identity issuer, the permission gate) and never reaches `logger.info`
on the scheduler-tick path. The `BANK_PERMISSION_GATE_ENABLED` env
var is referenced here but its value is not logged.

`launchd` does not rotate `StandardOutPath`. Acceptable build-phase
risk; if the log grows unbounded (e.g. parse-failure flood), run
`bash uninstall.sh && rm ~/Library/Logs/scrooge/*.log && bash install.sh`.

## Main-worktree write-guard opt-in — REMOVED (D-SCHEDULER-DEPLOY-DECOUPLE)

**Before 2026-06-22** these launchd jobs were the only legitimate writers to the
canonical main worktree and carried `BANK_ALLOW_MAIN_WORKTREE_WRITE=1` to pass
the fail-closed `.githooks` guard. **That is no longer true.** After the deploy
decouple, **no installed job writes to the main worktree** (see the topology
table above): scheduler-tick performs zero git ops, scheduler-autopull only
`reset --hard`s the serve-only `.scheduler-live` worktree, event-store-archive
writes only to the gitignored archives store, and golden-source-integrity-tick
emits events only.

Consequently `renderEnvironmentDictBody` in `env-extract.ts` **no longer
injects** the opt-in; any stray copy supplied via `.env.local` is **dropped**
so it cannot silently re-grant the bypass. The fail-closed git guard
(`.githooks/pre-commit`, `pre-rebase`, and the folded check in `pre-push` →
`scripts/githooks/main-worktree-guard.ts`) **stays in force** as a general
worktree-isolation control (CLAUDE.md §"Dispatch discipline → Worktree
isolation"; Engineering Charter `D-ENGINEERING-INTEGRITY-CHARTER` command 2 —
fail-closed by default). Marc's interactive shell (recognised by its TTY) is now
the **only** recognised legitimate main-worktree writer.

**Re-render step:** the installed plists under
`~/Library/LaunchAgents/com.scrooge.*.plist` are generated copies. After this
change, re-run `bash prototype/scripts/launchd/install.sh` once so the installed
copies are re-rendered **without** the now-removed
`BANK_ALLOW_MAIN_WORKTREE_WRITE` key and re-bootstrapped in place (the tracked
plist templates in this directory are the source). You cannot edit the installed
copies from a dispatched worktree — re-render is the supported path.

## Agent narrative provider (`BANK_NARRATIVE_PROVIDER`)

The per-agent narrative path (Vera's overnight recon + the `*-readiness` /
`*-snapshot` agents) is provider-agnostic: the backend is selected at call
time by the facade `runtime/narrative.ts`, **not** named at any call site.

| `BANK_NARRATIVE_PROVIDER` | Backend                | API key read     |
| ------------------------- | ---------------------- | ---------------- |
| _unset_ / `gemini`        | Gemini (default)       | `GEMINI_API_KEY` |
| `anthropic` / `claude`    | Anthropic (Claude)     | `ANTHROPIC_API_KEY` |
| anything else             | run fails closed (typed throw) | — |

**Default is Gemini** — the live `ANTHROPIC_API_KEY` is currently invalid
(401) while the Gemini key is valid (it already drives the regulation-distill
path). Flipping the whole agent fleet back to Claude is a **config change,
not a code change**: set `BANK_NARRATIVE_PROVIDER=anthropic` in `.env.local`.

`BANK_NARRATIVE_PROVIDER` is a `BANK_*` key, so it propagates through the
env-block whitelist (`env-extract.ts` / `whitelistBankKeys`) into the rendered
plists — re-run `install.sh` after changing it, same as any other `BANK_*` var.
The provider **keys** (`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) are not `BANK_*`
and are loaded by Bun from `.env.local` at process start (the scheduler tick
runs from `prototype/`); they are never written into the plist env block.

Graceful degradation is preserved per provider: if the selected provider's key
is missing/invalid the narrative is skipped and the run still completes
`ok:true` (the mechanical content stands on its own). Authority:
`D-NARRATIVE-PROVIDER-CONFIG` (CEO-approved 2026-06-22);
`D-ENGINEERING-INTEGRITY-CHARTER` (command 4 — source, don't hardcode).

## Related work

- **Brief:** [`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md`](../../../Owner%20Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md)
- **CEO decision:** `D-AGENT-AUTONOMY-OPERATIONAL` (2026-05-11). Markdown mirror under `Owner Inbox/`.
- **Threat model:** [`Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`](../../../Owner%20Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md)
- **Substrate spec (superseded):** [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](../../../Owner%20Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md)
- **The script being driven:** [`prototype/scripts/scheduler-tick.ts`](../scheduler-tick.ts)
- **What handlers fire:** [`prototype/runtime/handlers-metadata.ts`](../../runtime/handlers-metadata.ts)
