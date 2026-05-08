---
agent: Anya
trigger: projection-drift
asOf: 2026-05-08T05:18:31.841Z
decision-required: false
---

# Anya — projection drift, 2026-05-08

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 7 |
| Persona files (/Team/*.md) | 28 |
| Procedure files (/Procedures/by-policy/*.md) | 20 |
| Obligations register rows (ORG-*) | 181 |
| Regulations index — total | 94 |
| Regulations index — POPULATED | 4 |
| Owner Inbox deliverables | 69 |
| Team Inbox — open | 0 |
| Team Inbox — actioned | 40 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-07T13:59:43.580Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 7 | 7 | 0 |
| `obligations` | 181 | 181 | 0 |
| `instruments` | 94 | 83 | +11 |
| `instrumentsAnalysed` | 4 | 4 | 0 |
| `proceduresPopulated` | 20 | 12 | +8 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own._

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/seeds/dashboard-state.json`.
