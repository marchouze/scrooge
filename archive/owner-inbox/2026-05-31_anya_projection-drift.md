---
agent: Anya
trigger: projection-drift
asOf: 2026-05-31T03:17:04.886Z
decision-required: false
---

# Anya — projection drift, 2026-05-31

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 133 |
| Obligations register rows (ORG-*) | 417 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 524 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-31T03:16:55.836Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 417 | 417 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 133 | 146 | -13 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable and refreshed nine seconds before this run, so most projections are aligned: `principles` (6), `obligations` (417) and `instrumentsAnalysed` (6) all tie out canonical-to-cached at zero drift. Two metrics drift, both pointing at derivation logic rather than staleness given how recent the cache is.

The load-bearing one is `proceduresPopulated`: canonical=133, cached=146, drift=-13. The cache is reporting *more* populated procedures than exist as files on disk, which is structurally impossible from a fresh derive of `/Procedures/` — the projector is either counting stubs as populated, double-counting, or reading from a stale manifest. That is a dashboard-derivation defect, not a refresh problem. Second, `instruments`: canonical=95, cached=83, drift=+12 — the cache is under-counting the regulations register by twelve instruments, again with a recent asOf, so the loader is filtering or missing rows rather than lagging.

Action: raise a Vera dashboard-derivation finding covering both metrics, with the `proceduresPopulated` over-count as the priority since it inflates the apparent state of the procedure estate. A simple cache refresh will not fix either — the derivation rules need inspection against the canonical file walkers.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
