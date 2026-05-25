---
agent: Anya
trigger: projection-drift
asOf: 2026-05-22T04:45:36.511Z
decision-required: false
---

# Anya — projection drift, 2026-05-22

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 124 |
| Obligations register rows (ORG-*) | 283 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 404 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-22T04:45:22.182Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 124 | 138 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 04:45:22Z, ~14s behind this run) and aligns with canonical on `principles` (6), `obligations` (283), and `instrumentsAnalysed` (6). Two metrics are drifting and both point at the dashboard derivation, not the canonical store.

The load-bearing one is `proceduresPopulated`: canonical=124, cached=138, drift=-14. The cache is reporting *more* populated procedures than exist on disk — that's not a staleness signature (staleness would show cached behind canonical), it's a derivation defect, likely a counter that hasn't been updated after procedure consolidation or that's counting something other than populated `/Procedures/` files. Second is `instruments`: canonical=95, cached=83, drift=+12. Canonical has grown by twelve instruments that the dashboard projection hasn't picked up; given the cache is fresh (14s old), this is almost certainly a derive-path gap rather than a stale refresh — the projector isn't seeing the new `/Regulations/` entries.

Concrete next action: raise a Vera dashboard-derivation finding covering both metrics, with `proceduresPopulated` as the primary (over-count is harder to explain away than under-count and undermines trust in the cache more broadly). In the interim, treat the canonical counts as authoritative for any MI consumed off this run, and re-run the drift sweep after the next dashboard projection rebuild to confirm whether the `instruments` gap closes on its own or needs a code fix alongside `proceduresPopulated`.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
