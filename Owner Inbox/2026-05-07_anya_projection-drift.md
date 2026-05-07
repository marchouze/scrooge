---
agent: Anya
trigger: projection-drift
asOf: 2026-05-07T08:12:27.605Z
decision-required: false
---

# Anya — projection drift, 2026-05-07

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 7 |
| Persona files (/Team/*.md) | 27 |
| Procedure files (/Procedures/by-policy/*.md) | 11 |
| Obligations register rows (ORG-*) | 156 |
| Regulations index — total | 94 |
| Regulations index — POPULATED | 4 |
| Owner Inbox deliverables | 41 |
| Team Inbox — open | 0 |
| Team Inbox — actioned | 40 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-07T06:34:21.771Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 7 | 7 | 0 |
| `obligations` | 156 | 156 | 0 |
| `instruments` | 94 | 83 | +11 |
| `instrumentsAnalysed` | 4 | 4 | 0 |
| `proceduresPopulated` | 11 | 12 | -1 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/seeds/dashboard-state.json`.
