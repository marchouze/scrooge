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
| `com.scrooge.scheduler-tick.plist`                | macOS LaunchAgent template; `install.sh` substitutes paths and renders.        |
| `com.scrooge.event-store-archive.plist`           | macOS LaunchAgent — `archive:check` every 6 h (D-EVENT-STORE-SCALING-PHASE-5). |
| `com.scrooge.golden-source-integrity-tick.plist`  | macOS LaunchAgent — daily shared-store golden-source integrity assertion (see below). |
| `install.sh`                                      | macOS install script — renders the plists, bootstraps via `launchctl`, idempotent. Installs all three agents. |
| `uninstall.sh`                                     | macOS uninstall — `launchctl bootout` + `rm` for all three agents, idempotent. |
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

From the repository root:

```bash
bash prototype/scripts/launchd/install.sh
```

The script:

1. Detects the absolute path to `prototype/`.
2. Resolves `bun` (override with `BUN=/path/to/bun`).
3. Creates `~/Library/Logs/scrooge/` (override with `LOG_DIR=...`).
4. Renders the plist template into `~/Library/LaunchAgents/com.scrooge.scheduler-tick.plist`.
5. `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.scrooge.scheduler-tick.plist`.
6. Verifies via `launchctl print gui/$(id -u)/com.scrooge.scheduler-tick`.

If already installed and the rendered plist matches the live one
byte-for-byte, the script no-ops.

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

## Related work

- **Brief:** [`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md`](../../../Owner%20Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md)
- **CEO decision:** `D-AGENT-AUTONOMY-OPERATIONAL` (2026-05-11). Markdown mirror under `Owner Inbox/`.
- **Threat model:** [`Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`](../../../Owner%20Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md)
- **Substrate spec (superseded):** [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](../../../Owner%20Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md)
- **The script being driven:** [`prototype/scripts/scheduler-tick.ts`](../scheduler-tick.ts)
- **What handlers fire:** [`prototype/runtime/handlers-metadata.ts`](../../runtime/handlers-metadata.ts)
