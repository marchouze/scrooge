---
agent: Anya
trigger: projection-drift
asOf: 2026-05-24T05:17:54.257Z
decision-required: false
---

# Anya — projection drift, 2026-05-24

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 130 |
| Obligations register rows (ORG-*) | 283 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 424 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-23T12:17:48.945Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 2026-05-23T12:17, ~17h behind this run) and matches canonical on `principles`, `obligations`, and `instrumentsAnalysed`. Two metrics drift: `instruments` (canonical=95, cached=83, +12) and `proceduresPopulated` (canonical=130, cached=144, −14). Neither is catastrophic, but the directions tell different stories and only one is consistent with a stale-cache explanation.

The `instruments` drift is the load-bearing one: canonical has grown by 12 since the dashboard last derived, which is the expected shape of cache lag — the regulatory inventory has expanded and the projection hasn't caught up. `proceduresPopulated` is the worrying one: cached exceeds canonical by 14, which a stale cache cannot produce. That points to a definitional mismatch between the dashboard's `proceduresPopulated` derivation and the canonical count of populated procedure files in `/Procedures/` — either the cache is counting stubs the canonical sweep excludes, or it's reading from a superset (drafts, archived, or a different glob). A refresh alone will not reconcile this.

Action: (1) trigger a dashboard projection refresh to clear the `instruments` lag and confirm it resolves to zero; (2) raise a Vera finding against the `proceduresPopulated` derivation rule — negative drift of −14 is a contract issue, not a freshness issue, and needs the definition pinned against the canonical `/Procedures/` enumeration before the next sweep.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
