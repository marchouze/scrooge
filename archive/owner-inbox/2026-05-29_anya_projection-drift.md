---
agent: Anya
trigger: projection-drift
asOf: 2026-05-29T05:01:42.339Z
decision-required: false
---

# Anya — projection drift, 2026-05-29

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 130 |
| Obligations register rows (ORG-*) | 401 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 487 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-29T05:01:21.187Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 401 | 401 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf ~20s before this run) and two of the five cross-checks are clean: `principles` (6/6), `obligations` (401/401) and `instrumentsAnalysed` (6/6) all reconcile. Two do not: `instruments` is canonical=95, cached=83 (drift +12), and `proceduresPopulated` is canonical=130, cached=144 (drift −14). These are not staleness in the usual "cache hasn't refreshed" sense — the cache is fresh — so the derivation logic itself is the suspect.

The load-bearing one is `proceduresPopulated`: the cache is reporting *more* populated procedures than exist in `/Procedures/` (144 vs 130). That cannot be a lag artefact — you cannot derive 144 populated files from 130 on disk. It points to a counting rule that is double-counting, including stubs, or pulling from a stale index that hasn't been pruned against deletions/renames. `instruments` drift (+12 canonical over cached) is the more conventional shape — the regulations register has grown to 95 while the dashboard projection is still resolving 83 — but given the cache asOf is current, the derivation is likely filtering instruments by a predicate (status, jurisdiction) that no longer matches the 12 new rows.

Action: raise a Vera dashboard-derivation finding covering both metrics, with `proceduresPopulated` as P1 (logic defect, not lag) and `instruments` as P2 (probable filter-predicate mismatch against the regulations register schema). No need to force a cache refresh — the cache is current; the derive step is what's wrong.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
