---
agent: Anya
trigger: projection-drift
asOf: 2026-05-28T05:57:52.095Z
decision-required: false
---

# Anya — projection drift, 2026-05-28

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
| Owner Inbox deliverables | 475 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-28T05:57:32.914Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 05:57:32Z, ~20s before this run) and three of five cross-checks tie out cleanly: `principles` 6=6, `obligations` 283=283, `instrumentsAnalysed` 6=6. Two metrics drift, in opposite directions, and both are load-bearing for how we read the regulatory surface.

The consequential one is `instruments`: canonical 95, cached 83, drift +12. Canonical has grown — twelve instruments have been added to `/Regulations/` since the dashboard last derived — and the cache hasn't caught up. That matters because `instrumentsAnalysed` is still 6 on both sides, so the *analysed* ratio the dashboard is showing (6/83 ≈ 7.2%) overstates our coverage versus the canonical reality (6/95 ≈ 6.3%); anyone reading the cache will think we're closer to done on the regulatory inventory than we are. The second drift, `proceduresPopulated` canonical 130 vs cached 144 (−14), is the more suspicious direction: the cache claims *more* populated procedures than canonical does. Procedure files don't typically vanish, so this is almost certainly a definitional mismatch in the dashboard's derivation rule (e.g. counting stub or archived files as populated) rather than a true canonical regression — and it's been quietly inflating the headline number.

Next action: refresh the dashboard projection to clear the `instruments` lag, and if `proceduresPopulated` still reads 144 after the refresh, raise a Vera dashboard-derivation finding against the procedure-population predicate — canonical is authoritative and the cache rule needs to be reconciled to it, not the other way round.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
