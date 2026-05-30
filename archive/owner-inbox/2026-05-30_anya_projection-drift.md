---
agent: Anya
trigger: projection-drift
asOf: 2026-05-30T03:17:00.211Z
decision-required: false
---

# Anya — projection drift, 2026-05-30

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 130 |
| Obligations register rows (ORG-*) | 417 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 509 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-30T03:01:29.684Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 417 | 417 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 146 | -16 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 03:01:29Z, ~15 minutes behind this run) and two of the five cross-checked metrics show drift: `instruments` is canonical=95 vs cached=83 (+12 canonical), and `proceduresPopulated` is canonical=130 vs cached=146 (−16 canonical). `principles`, `obligations`, and `instrumentsAnalysed` are clean.

The load-bearing one is `proceduresPopulated` at −16: the cache is reporting *more* populated procedures than actually exist on disk, which is not a staleness signature — a stale cache should lag canonical, not lead it. That points at the derivation logic (probably a counting rule that's including drafts, stubs, or deleted files the canonical sweep excludes) rather than refresh latency, and it's the kind of metric Pat and Quinn read off the dashboard when they're sizing procedure coverage, so a wrong-direction number there is materially misleading. The `instruments` +12 drift is the more benign case: 83 → 95 is consistent with Rafael's recent regulatory-horizon intake landing in `/Regulations/` after the last dashboard derive, and a refresh should close it.

Action: trigger a dashboard projection refresh first and re-check — if `instruments` snaps to 95 and `proceduresPopulated` stays at 146, raise a Vera dashboard-derivation finding against the `proceduresPopulated` counting rule with both counts and the canonical file list attached. I'll hold the finding in `/Team Inbox/` pending the refresh result rather than file it speculatively.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
