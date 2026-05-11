# `prototype/scripts/`

CLI entry-points and one-shot helpers for the Bank substrate. Most of
these are wired through `package.json` `scripts:` and invoked via
`bun run <name>`; see that file for the canonical list.

## Subdirectories

- **[`launchd/`](./launchd/README.md)** — local cron driver that keeps
  `bun run scheduler:tick` firing every 60 seconds, surviving terminal
  close. macOS `launchd` plist + Linux `systemd` user unit.
  Slice 1 of `D-AGENT-AUTONOMY-OPERATIONAL` (CEO-approved 2026-05-11).
  Install (macOS): `bash prototype/scripts/launchd/install.sh`.

## Categories of scripts in this directory

- **Scheduler / runtime drivers** — `scheduler-tick.ts`, `bus-tick.ts`.
- **Backfills + record-handlers** — `record-d-*.ts`, `backfill-*.ts`,
  `record-decisions-*.ts`, `register-fleet.ts`.
- **Renderers** — `render-ba-*.ts`, `render-ifrs-statements.ts`.
- **Derivers / sync** — `derive-dashboard-state-*.ts`,
  `regen-dashboard-cache.ts`, `event-store-sync.ts`,
  `agent-registry-sync.ts`.
- **Identity / fleet** — `identity-issue.ts`, `register-fleet.ts`,
  `model-registry-list.ts`.

Most scripts are date-stamped and one-shot — once their backfill or
record-emission has landed on `main`, they remain in-tree as audit
breadcrumbs (Principle 1: events are truth; the script is the
provenance for how the events arrived in the store).
