---
to: Marc (CEO)
from: Atlas (lead) · Anya (projection runtime) · Vera (recon)
date: 2026-05-06
status: delivered
re: ensure dashboard is continuously kept up to date
title: Dashboard — continuous derivation now live
author: Atlas, Anya, Vera
summary: First derivation runtime — committed cache + drift recon. Superseded — committed-cache-in-commit-graph is now the anti-pattern; cache is regenerated from commit graph.
decision-required: false
superseded-by:
  - decision-id: D-EVENT-STORE-SCALING
    decision-date: 2026-05-10
    note: "D-EVENT-STORE-SCALING-SLICE-3B (cache-from-commit-graph) supersedes the committed-seeds/dashboard-state.json approach here. The cache is now regenerated, not stored in the commit graph."
  - reference: feedback_cache_in_commit_graph_anti_pattern.md
    note: "Memory feedback_cache_in_commit_graph_anti_pattern (set 2026-05-10) codifies the anti-pattern: derived projections checked into git create N² merge friction; fix is gitignore + recon-derives-fresh (PR #157)."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# Dashboard — continuous derivation now live

The bank operations dashboard at `http://localhost:3010` no longer reads a hand-curated registry. Every metric, list, and reduction is now derived on demand from canonical sources, refreshed continuously, and reconciled against the persisted file by an automated control. Hand-editing `seeds/dashboard-state.json` is no longer a supported operation — the next derivation tick will overwrite drift.

## What landed

| Deliverable | File | Notes |
| --- | --- | --- |
| Pure derivation | `prototype/dashboard/derive.ts` | `deriveState({ sources, events })` produces a full `DashboardState` from canonical inputs. Each metric tagged with a `// source:` comment naming its canonical document. |
| Curated carry-forward | `prototype/seeds/dashboard-curated.json` | Holds the parts that do not yet have an upstream canonical source: `bank.{name, operatingPosture, cloudTarget, strategicFoundation}`, the four open decision packs (S1, S3, S4, S5), pre-event resolved decisions (D1, D2, D3, R3a, R3b, R3c), the in-flight workstream catalogue, the prototype-status block, and the risks list. Each is debt to repay — the pieces marked here are the inputs to the **upstream-source backlog** below. |
| Server wiring | `prototype/dashboard/server.ts` | Boots a derivation; runs a poll every `BANK_DASHBOARD_REFRESH_MS` (default 30s); installs `fs.watch` debounced 500ms on the canonical paths; re-derives after every state-mutating POST; exposes a manual `POST /api/refresh`. Failing-closed: derivation errors leave the previous state in place and log loudly. |
| Drift recon | `prototype/platform/recon/dashboard-derivation-recon.ts` | Compares the persisted `seeds/dashboard-state.json` against a fresh derivation across 16 fields. Wired into `bun run ci` as `recon:dashboard`. |
| Tests | `prototype/tests/derive.test.ts` | 9 unit tests over fixture canonical sources. Coverage: principle parsing, top-of-house parsing (incl. Thandiwe-style annotated role), policy/obligation/instrument/procedure counts, summary-section exclusion, ORG-PR(IV)-N obligation IDs, CeoDecision reduction (latest-event-wins), seed carry-forward, WorkstreamStarted activation. |

CI status: `bun run ci` green — typecheck, lint, **48 tests pass** (9 new), citation gate, recon harness, dashboard-derivation recon (**16 assertions, 0 drift**). Mandate-ownership recon (31 assertions) and decision-event recon (20 assertions) also pass.

## Manual acceptance

- Boot the server. Touch `Owner Inbox/2026-05-06_policy-register.md` (or any other canonical source). The dashboard `asOf` advances within ~500ms of the file event; refresh the page — counts reflect the file change. Verified end-to-end on this delivery.
- Run `bun run recon:dashboard` after any direct edit of `seeds/dashboard-state.json` — the recon will report drift on every field that diverges from the canonical sources.

## Diff between hand-curated and first derived state

The first derivation surfaces the bank-state truths that had drifted in the hand-curated seed. **Each line below is a Marc-reportable correction**: the right column is what the canonical sources actually say today; the middle is what the dashboard had been claiming.

| Field | Hand-curated | Derived (truth) | Reading |
| --- | --- | --- | --- |
| `policies` | 41 | 112 | The 41 figure was the "core policies approved Round 2" subset. The full register, in its 14 numbered domain sections, lists 112 distinct policy rows. The dashboard now reports the full inventory; if you want the "core / approved" subset surfaced separately, that is a new metric (`corePolicies`) sitting beside this one. |
| `obligations` | 178 | 153 | The 178 figure was approximate. The obligations register has 153 `ORG-*` rows today (incl. the `ORG-PR(IV)-NN` Pillar IV variants). |
| `instruments` | 64 | 83 | The regulator-instrument index has grown since the seed was set; 83 instruments listed today, of which **4** are populated (matches the seed). |
| `proceduresPopulated` | 9 | 11 | Two more procedures populated since the seed: the index now lists 11 rows tagged `**POPULATED**`. |
| `proceduresPlanned` | 70 | 76 | Six more procedures added to the index since the seed. |
| `ceoDecisionsActioned` | 37 | 13 | The 37 figure was hand-set and overstated. The truth is: **8 distinct dashboard-actioned decisions** in the event store (D4, D5, D6, D7, D8, D9, S2 plus a handful of duplicate events from the same UI flow) **+ 6 historical decisions** carried forward from the curated seed (D1, D2, D3, R3a, R3b, R3c) that pre-date the event store and therefore have no `CeoDecision` event. The dashboard now counts the union (13). The 24-decision gap was cosmetic. |
| `directReports` | 10 | 11 | Rashida (CISO) is now in seat per CLAUDE.md `Top-of-house reporting` — the seed had not picked this up. |
| `openGovernanceSeats` | 3 (CISO, GC, CHRO) | 2 (GC, CHRO) | Same correction — CISO is no longer open. |

`principles` (6), `instrumentsAnalysed` (4), and the principle / role lists themselves agree across both reads.

## What the dashboard does **not** yet derive (debt to repay)

These are the carry-forward fields living in `seeds/dashboard-curated.json`. Each is gated on an upstream canonical source that does not yet exist or is not yet a structured document. **None should be authored at the dashboard layer** — the right move is to create the upstream source and have the derivation read it.

1. **`bank.strategicFoundation`** — could be derived from `Owner Inbox/2026-05-06_strategic-foundation.md`, but only if that file is restructured into front-matter or a designated table. Currently it is prose. Owner: Camille / Saskia.
2. **`bank.{name, operatingPosture, cloudTarget}`** — three constants. The cleanest home is a small `bank-config.md` (or front-matter on CLAUDE.md). Owen could own as part of the constitutional layer. Lowest priority of the debts.
3. **`decisionsOpen[]` (full briefs)** — currently four open packs (S1, S3, S4, S5) carry their briefs nested inside the curated JSON. The right home is one Markdown file per open decision under a designated location (e.g. `Owner Inbox/decisions/<id>.md`), front-mattered, indexed; the derivation reads the directory. Owner: Owen (decision-pack discipline) + the decision owner.
4. **`prototype.{tests, modules, next}`** — currently hand-set. `tests` should derive from `bun test --ci-output` summary; `modules` from a manifest like `prototype/manifest.json`; `next` from a `prototype/BACKLOG.md`. Owner: Atlas.
5. **`risks[]`** — should be derived from the Risk Appetite Statement / RAS-RAF top-risks register once that register is structured (today it is prose). Owner: Helena (with Rohan).

A backlog ticket per item is reasonable; we suggest **Item 4 first** (mechanical, fully under Atlas), **then Item 3** (this is what makes the upcoming flow of decision packs land in the dashboard automatically rather than via a one-off seed update each time), then 1, 5, 2.

## Operational rule (now in force)

- `seeds/dashboard-state.json` is a generated cache. Hand-editing it is forbidden; the recon will detect drift and the next tick will overwrite the change.
- Bank-state changes propagate to the dashboard by editing the canonical source (CLAUDE.md, the policy register, the obligations register, the regulations index, the procedures index) — never the dashboard registry.
- New metrics require a declared canonical source. Atlas + Anya will not add a metric whose value is hand-set; if a metric matters and no canonical source exists, the source is created first.

## Substrate-replacement seam (M8 cloud lift)

The local Bun.serve + `fs.watch` + SQLite implementation is replaced by:

- HTTP surface → Azure Container App (unchanged API).
- File watcher → Event Grid notifications on the storage paths backing the registers.
- SQLite event store → the production event store on Azure (selection deferred to `prototype/infra/azure/`).
- `deriveState()` itself does **not** change — it reads paths and an `EventSource`, both injectable.

## Where to look

- Code: `prototype/dashboard/{derive.ts,server.ts}`, `prototype/platform/recon/dashboard-derivation-recon.ts`, `prototype/seeds/dashboard-curated.json`.
- Tests: `prototype/tests/derive.test.ts` (and the existing `dashboard.test.ts` for the registry-mutation pure functions).
- CI: `bun run ci` (now includes `recon:dashboard`).
- Run dashboard: `bun run dashboard`. Override the poll interval with `BANK_DASHBOARD_REFRESH_MS=…`. Manual refresh via `POST /api/refresh`.
- Memory rule (binding): `feedback_dashboard_always_derived.md`.

— Atlas · Anya · Vera, on Scrooge's brief 2026-05-06.
