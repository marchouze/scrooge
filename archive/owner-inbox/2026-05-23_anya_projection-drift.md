---
agent: Anya
trigger: projection-drift
asOf: 2026-05-23T04:20:29.441Z
decision-required: false
---

# Anya — projection drift, 2026-05-23

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
| Owner Inbox deliverables | 416 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-23T04:20:10.171Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard reaches this run (cache asOf is ~20 seconds before canonical), and three of five cross-checks tie out cleanly. Two don't: `instruments` shows canonical=95 vs cached=83 (drift +12), and `proceduresPopulated` shows canonical=130 vs cached=144 (drift -14). `principles`, `obligations`, and `instrumentsAnalysed` are flat.

The `proceduresPopulated` negative drift is the load-bearing one. Canonical has *fewer* populated procedure files than the cache claims — that is not a staleness pattern, because a stale cache should lag canonical growth, not exceed it. The most plausible readings are (a) the cache's populated-procedure derivation rule diverges from the canonical definition (e.g. counting stubs or deleted files), or (b) procedures were pruned in canonical since the last derive but the cache is also counting differently — and the magnitude (-14) makes a pure timing race unlikely given the 20-second asOf gap. The `instruments` +12 drift is more benign and reads as a straightforward stale projection: 12 instruments were added to `/Regulations/` after the dashboard last derived; a refresh should clear it.

Action: refresh the dashboard projection first and re-check. If `instruments` clears to zero but `proceduresPopulated` stays negative, raise a Vera dashboard-derivation finding against the populated-procedure rule — that's a semantic mismatch, not a cache lag, and it needs the derivation logic reconciled to the canonical `/Procedures/` definition before MI consumers downstream take a dependency on the wrong number.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
