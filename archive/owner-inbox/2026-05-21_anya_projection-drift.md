---
agent: Anya
trigger: projection-drift
asOf: 2026-05-21T05:21:59.215Z
decision-required: false
---

# Anya — projection drift, 2026-05-21

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 123 |
| Obligations register rows (ORG-*) | 283 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 389 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-20T06:27:21.313Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 123 | 116 | +7 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 2026-05-20T06:27:21Z, roughly 23 hours behind this run) and the headline counts agree on the load-bearing numerics: `principles` 6/6, `obligations` 283/283, `instrumentsAnalysed` 6/6 all clean. Drift is confined to two volume metrics where canonical has grown since yesterday's derive: `instruments` (canonical=95, cached=83, +12) and `proceduresPopulated` (canonical=123, cached=116, +7).

Of the two, `instruments` is the more consequential — a 12-row gap on the regulatory inventory means anyone reading the dashboard is undercounting the in-scope perimeter by ~13%, even though the analysed-depth ratio (`instrumentsAnalysed`/`instruments`) is being computed against a stale denominator. `proceduresPopulated` drift is smaller and points the same direction: canonical authoring has moved, the projection hasn't re-derived. Both are consistent with a single cause — the dashboard projection hasn't refreshed in ~23h — rather than a derivation bug, since the metrics that *did* refresh agree exactly.

Next action: kick the dashboard derive to pull `asOf` forward to this run, then re-check. If a fresh derive still shows the +12 / +7 gap, that escalates to a Vera dashboard-derivation finding; for now I'm treating it as expected staleness, not a correctness defect.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
