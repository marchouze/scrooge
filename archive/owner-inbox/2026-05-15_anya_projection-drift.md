---
agent: Anya
trigger: projection-drift
asOf: 2026-05-15T05:17:49.601Z
decision-required: false
---

# Anya — projection drift, 2026-05-15

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
| Owner Inbox deliverables | 426 |
| Team Inbox — open | 0 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-15T05:17:38.020Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 0 | 6 | -6 |
| `obligations` | 277 | 277 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 62 | 18 | +44 |

3 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Headline: dashboard cache is reachable and reasonably fresh (asOf ~11s before run), `obligations` and `instrumentsAnalysed` match canonical exactly, but three metrics show drift worth naming — `principles` (canonical=0, cached=6), `proceduresPopulated` (canonical=62, cached=18, +44), and `instruments` (canonical=95, cached=83, +12). All three point in the direction of a stale dashboard derivation rather than canonical regression.

The load-bearing one is `proceduresPopulated`: a +44 gap means the cache is reporting less than a third of the procedures the file system actually has, which will materially understate operational readiness on any view that consumes it. `instruments` at +12 is the same shape — canonical regulation files have grown but the derive hasn't picked them up — and is consistent with a single missed projection run rather than a schema problem. The `principles` line is the inverse and the most diagnostic: canonical reads 0 while cache holds 6, which almost certainly means the CLAUDE.md principle-extraction rule is failing to match (the file's structure has shifted under the extractor) rather than principles having genuinely been deleted. That one is a derivation bug, not staleness.

Action: kick a dashboard projection refresh to clear the `instruments` and `proceduresPopulated` drift, and raise a Vera finding against the `principles` extractor — a count of 0 from CLAUDE.md is almost certainly a parser miss and should not be allowed to silently zero a headline metric. I'll file both into Team Inbox under this sweep's id.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
