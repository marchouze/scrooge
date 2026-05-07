---
to: Atlas (lead) · Anya (projection runtime)
from: Scrooge (Chief of Staff)
date: 2026-05-06
priority: standard
status: open
---

# Brief — Dashboard must continuously reflect current bank state

## Why

CEO instruction (2026-05-06): "ensure dashboard is continuously kept up to date".

`prototype/seeds/dashboard-state.json` is currently a hand-curated seed. Under **Principle 1** (events / canonical sources are the only source of truth) and **Principle 6** (presentations derive downward from data), the dashboard registry is a *cache / projection* — never authored. It must be re-derived from canonical sources whenever the bank evolves.

## Outcome required

The bank dashboard at `http://localhost:3010` must always show current truth. A reader refreshing the page sees the same metrics that a fresh derivation from canonical sources would produce — within seconds of any change to those sources.

## Canonical sources → metrics

| Field | Canonical source |
| --- | --- |
| `bank.metrics.principles` | Count of `### Principle N — ` headings in `CLAUDE.md` |
| `bank.metrics.policies` | Count of policy entries in `Owner Inbox/2026-05-06_policy-register.md` (or its successor) |
| `bank.metrics.obligations` | Count of register rows in `Regulations/_obligations-register.md` |
| `bank.metrics.instruments`, `instrumentsAnalysed` | Walked from `/Regulations/` (total instrument folders / those with completed analysis) |
| `bank.metrics.proceduresPopulated`, `proceduresPlanned` | Walked from `/Procedures/` (populated `.md` files vs index entries in `Procedures/README.md`) |
| `bank.metrics.ceoDecisionsActioned` | `count(events where type == 'CeoDecision')` from the event store |
| `bank.metrics.directReports` | Persona files in `/Team/` flagged as direct reports + governance framework executive structure |
| `bank.metrics.openGovernanceSeats` | Governance framework "open seats" + `openSeats` in CLAUDE.md team table |
| `directReports[]`, `openSeats[]` | Same canonical sources as above |
| `principles[]` | `### Principle N — ` headings + first-paragraph summaries from `CLAUDE.md` |
| `decisionsResolved[]` | Reduced from `CeoDecision` events in the event store (registry must reconcile to events) |
| `decisionsOpen[]` | Open-decisions doc(s) in `Owner Inbox/` minus those resolved in events |
| `inFlight[]` | Active workstreams; reduced from `WorkstreamStarted` events + Team Inbox open briefs |
| `prototype.tests`, `prototype.modules`, `prototype.next` | `bun test` count; module manifest; backlog file (define a single canonical location) |
| `risks[]` | Curated risks doc (define canonical location; do not author here) |

If a metric has no canonical source today, **do not invent one** — flag it back to Scrooge so the source is created first (presentations don't author substance under P6).

## Required deliverables

1. **`prototype/dashboard/derive.ts`**
   - Pure function `deriveState(opts): DashboardState` that reads canonical sources and produces the full `DashboardState` shape (`prototype/dashboard/types.ts`).
   - Each metric tagged with a `// source:` comment naming the canonical document path.
   - Unit tests covering each canonical source with fixture inputs.

2. **Integration into `prototype/dashboard/server.ts`**
   - Run `deriveState()` on startup and write `seeds/dashboard-state.json`.
   - Re-derive on a poll (default 30s; configurable via `BANK_DASHBOARD_REFRESH_MS`).
   - Add a `fs.watch` on the canonical paths (`CLAUDE.md`, `Owner Inbox/`, `Regulations/`, `Procedures/`, `Team/`, `.local/events/` if that's the event-store path) that triggers a debounced re-derivation.
   - The existing `/api/state` endpoint stays as-is (returns the registry) — but the registry it reads is now always fresh.
   - Optional: add `GET /api/state/sse` server-sent-events stream that pushes the new state on every re-derivation, so the browser doesn't need to poll. Stretch goal — defer if it adds friction.

3. **Drift recon** — extend `prototype/platform/recon/` with `dashboard-derivation-recon.ts`:
   - Compare `deriveState()` output against persisted `seeds/dashboard-state.json`.
   - Any divergence is a reportable finding (per Principle 6: registry must reconcile to canonical sources).
   - Wire into `npm run ci` via the existing `recon` script.

4. **Anya — semantic-layer entries**
   - For each derived metric, register a definition in the semantic layer with: name, canonical source path, derivation rule, owner. This is the place future readers learn "where does `obligations: 178` come from?" without reverse-engineering code.

## Constraints

- No hand-editing of `seeds/dashboard-state.json` after this lands. The file becomes a regenerable artefact (consider gitignoring or marking it generated).
- Every metric needs a citation under Principle 2 (source path is the citation here). If you can't cite it, escalate to Scrooge.
- Debounce file-watch (≥500ms) — editor saves often fire multiple events.
- Hot-reload safety: derivation must be idempotent; partial reads (mid-write source files) must fail closed and log, not write garbage state.
- Substrate seam: when this lifts to Azure (M8), the file substrate becomes blob storage and the watcher becomes Event Grid — design the derivation-trigger interface so the swap is mechanical.

## Acceptance

- Manual: edit `Owner Inbox/2026-05-06_policy-register.md` (add a fake row), wait ≤ 2s, refresh dashboard — the policy count increments. Revert; count reverts.
- Automated: `bun run recon` passes; new derivation tests pass; CI green.
- Confirm back to Scrooge with the diff between the previous hand-curated state and the first derived state — any deltas are bank-state truth corrections that should be flagged to Marc.

## Reporting

Acknowledge receipt; flag scope concerns within 24h. Report when (1) the derivation lands, (2) the watcher lands, (3) recon lands. Owner Inbox deliverable when complete: `Owner Inbox/2026-05-06_dashboard-continuous-derivation.md`.
