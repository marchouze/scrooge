---
agent: Anya
trigger: projection-drift
asOf: 2026-05-16T04:45:45.803Z
decision-required: false
---

# Anya — projection drift, 2026-05-16

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 3 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 0 |
| Persona files (/Team/*.md) | 30 |
| Procedure files (/Procedures/by-policy/*.md) | 82 |
| Obligations register rows (ORG-*) | 277 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 445 |
| Team Inbox — open | 0 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-15T15:17:49.333Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 0 | 6 | -6 |
| `obligations` | 277 | 277 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 82 | 34 | +48 |

3 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Headline: dashboard cache is reachable (asOf 2026-05-15T15:17:49Z, ~13h behind this sweep) and two canonical-vs-cached drifts are load-bearing — `proceduresPopulated` is +48 and `instruments` is +12 against cache, while `principles` reads -6 because the canonical scan returned zero from CLAUDE.md. `obligations` and `instrumentsAnalysed` are clean.

The most consequential signal is `proceduresPopulated`: canonical=82, cached=34. That's not a small lag — the cache is materially under-counting populated procedure files, and anything downstream that gates on procedure coverage (Procedural Fairness reporting, control-mapping completeness) will read stale. `instruments` +12 is the same story one tier up: canonical `/Regulations/` now lists 95 instruments against 83 cached, so the regulatory surface has grown without a re-derive. The `principles` -6 is almost certainly a *canonical scanner* problem rather than a cache problem — CLAUDE.md doesn't actually contain zero principles, so the sweep's parser for `principlesInClaudeMd` is mis-counting (likely a heading/regex change in CLAUDE.md the scanner hasn't kept up with); the cached value of 6 is the trustworthy one here.

Action: trigger a dashboard projection refresh to absorb the procedure and instrument growth — that will clear the two real drifts in one pass. Separately, raise a Vera finding against the `principlesInClaudeMd` scanner in the projection-drift sweep itself: a canonical count of 0 against a known-non-zero source is a derivation bug, not drift, and should not keep firing as a false positive on every run.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
