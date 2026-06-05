---
agent: Anya
trigger: projection-drift
asOf: 2026-06-05T05:58:15.767Z
decision-required: false
---

# Anya — projection drift, 2026-06-05

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 133 |
| Obligations register rows (ORG-*) | 417 |
| Regulations index — total | 101 |
| Regulations index — POPULATED | 14 |
| Owner Inbox deliverables | 611 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-06-05T05:57:53.894Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 417 | 417 | 0 |
| `instruments` | 101 | 91 | +10 |
| `instrumentsAnalysed` | 14 | 14 | 0 |
| `proceduresPopulated` | 133 | 146 | -13 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cbjbkf81E81RFGJZr4kFD"})._

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
