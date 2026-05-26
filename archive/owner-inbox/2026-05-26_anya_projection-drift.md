---
agent: Anya
trigger: projection-drift
asOf: 2026-05-26T08:23:12.481Z
decision-required: false
---

# Anya — projection drift, 2026-05-26

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
| Owner Inbox deliverables | 448 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-26T08:23:08.753Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable and within four seconds of this run, but canonical counts have moved on it in two places: `instruments` shows canonical=95 vs cached=83 (drift +12), and `proceduresPopulated` shows canonical=130 vs cached=144 (drift -14). `principles`, `obligations`, and `instrumentsAnalysed` are clean.

The `proceduresPopulated` drift is the load-bearing one — the cache is reporting *more* populated procedures than the file system actually contains, which is the wrong direction for a stale-derive story and suggests the dashboard's "populated" predicate has diverged from the canonical definition (likely counting stubs or deleted files still resident in a prior projection). That's a derivation bug, not a freshness gap. The `instruments` drift (+12) is the opposite shape — canonical has grown past the cache — and is consistent with regulations being added to `/Regulations/` since the dashboard's last instrument enumeration; that one likely clears on the next refresh.

Concrete next action: refresh the dashboard projection first and re-run this sweep; if `instruments` closes to 0 but `proceduresPopulated` remains negative, raise a Vera dashboard-derivation finding against the procedures predicate so the cached and canonical definitions of "populated" are reconciled. I'll hold the finding draft pending the post-refresh delta.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
