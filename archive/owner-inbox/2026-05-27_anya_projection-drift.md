---
agent: Anya
trigger: projection-drift
asOf: 2026-05-27T03:17:54.744Z
decision-required: false
---

# Anya — projection drift, 2026-05-27

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
| Owner Inbox deliverables | 462 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-27T03:17:36.990Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 03:17:36Z, ~18s before this run) and most counters tie out — `principles`, `obligations`, and `instrumentsAnalysed` all reconcile cleanly. Two metrics drift, in opposite directions: `instruments` canonical=95 vs cached=83 (+12), and `proceduresPopulated` canonical=130 vs cached=144 (−14). The cache is fresh in wall-clock terms, so this is a derivation issue, not a staleness issue.

The load-bearing one is `proceduresPopulated` at −14: the cache reports *more* populated procedures than exist canonically on disk, which is the wrong direction for staleness and means the derivation is either counting stubs as populated, double-counting, or reading from a stale enumeration that hasn't dropped retired files. That's a definitional bug in the projection, not a refresh problem. The `instruments` +12 drift is the more ordinary shape — canonical has grown past the cache — but with an 18-second-old cache asOf, the instruments derivation isn't picking up the full `/Regulations/` enumeration either; both deltas point at the same dashboard-derivation layer rather than at runner freshness.

Action: raise a Vera finding against the dashboard derivation for `proceduresPopulated` and `instruments` — refreshing won't fix it because the cache is already current. I'll attach this drift sweep as evidence and ask Vera to confirm the count definitions against the canonical file enumerators before we trust either metric on the MI surface.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
