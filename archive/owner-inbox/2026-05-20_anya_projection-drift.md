---
agent: Anya
trigger: projection-drift
asOf: 2026-05-20T06:52:20.955Z
decision-required: false
---

# Anya — projection drift, 2026-05-20

Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** dashboard cache reachable; 2 of 5 cross-checked metrics show drift between canonical sources and the cache.

## Canonical-source snapshot

| Source | Count |
|---|---|
| Principles in CLAUDE.md | 6 |
| Persona files (/Team/*.md) | 31 |
| Procedure files (/Procedures/by-policy/*.md) | 118 |
| Obligations register rows (ORG-*) | 283 |
| Regulations index — total | 95 |
| Regulations index — POPULATED | 6 |
| Owner Inbox deliverables | 380 |
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
| `proceduresPopulated` | 118 | 116 | +2 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 2026-05-20T06:27, ~25 minutes behind this run). `principles`, `obligations`, and `instrumentsAnalysed` all reconcile cleanly. Two drifts to call out: `instruments` canonical=95 vs cached=83 (+12), and `proceduresPopulated` canonical=118 vs cached=116 (+2). Both point the same direction — canonical has moved ahead of the cache — so this reads as a stale derive rather than canonical loss.

The load-bearing one is `instruments` at +12. A twelve-instrument gap on a base of 83 is large enough to materially mislead any read of regulatory coverage off the dashboard, and it sits oddly against `regulationsPopulated=6` and `instrumentsAnalysed=6` reconciling — i.e. the analytical depth metric is current but the denominator isn't, which will understate the "unanalysed instruments" backlog visible to Rownan and Reggie. `proceduresPopulated` at +2 is the same shape but small enough to be ordinary lag between a procedure landing on disk and the next derive pass.

Action: trigger a dashboard projection refresh and re-run this sweep; if the +12 on `instruments` persists after a clean rederive, I'll raise a Vera finding against the instruments-projection derivation path. Until refresh, treat the canonical counts above as authoritative for any coverage question this morning.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
