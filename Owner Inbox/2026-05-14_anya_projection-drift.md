---
agent: Anya
trigger: projection-drift
asOf: 2026-05-14T05:54:29.546Z
decision-required: false
---

# Anya — projection drift, 2026-05-14

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 3 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 0 |
| Persona files (/Team/*.md) | 30 |
| Procedure files (/Procedures/by-policy/*.md) | 62 |
| Obligations register rows (ORG-*) | 277 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 347 |
| Team Inbox — open | 2 |
| Team Inbox — actioned | 57 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-14T05:54:27.157Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 0 | 6 | -6 |
| `obligations` | 277 | 277 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 62 | 18 | +44 |

3 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own._

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
