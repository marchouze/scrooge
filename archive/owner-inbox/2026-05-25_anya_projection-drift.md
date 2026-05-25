---
agent: Anya
trigger: projection-drift
asOf: 2026-05-25T06:16:52.568Z
decision-required: false
---

# Anya — projection drift, 2026-05-25

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
| Owner Inbox deliverables | 434 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-05-25T06:16:30.791Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 283 | 283 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 130 | 144 | -14 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable and freshly derived (22 seconds behind this run), and two of the five tracked metrics show drift worth naming: `instruments` (+12 canonical over cached) and `proceduresPopulated` (-14 canonical under cached). `principles`, `obligations`, and `instrumentsAnalysed` are clean.

The load-bearing one is `proceduresPopulated`: canonical reports 130 procedure files but the cache claims 144. Canonical can't be smaller than cached under a normal derive — that's not a stale-cache pattern, it's a counting-rule mismatch between the dashboard's derivation and what actually lives in `/Procedures/`. Most likely the cache is counting something the directory walk doesn't (drafts, archived stubs, an old manifest) or hasn't dropped removed files. The `instruments` drift (+12) is the more familiar shape — canonical `/Regulations/` has grown to 95 while the cache still shows 83, consistent with new instruments landing between derives, though a 12-instrument gap with only a 22-second cache age suggests the dashboard's instrument enumerator is also lagging, not just stale.

Action: raise a Vera dashboard-derivation finding covering both — the `proceduresPopulated` over-count needs the counting rule reconciled against the canonical file walk, and the `instruments` under-count needs the enumerator checked for the same. A cache refresh alone won't fix either if the derivation logic itself is off; confirm by re-deriving and seeing whether the gaps persist.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
