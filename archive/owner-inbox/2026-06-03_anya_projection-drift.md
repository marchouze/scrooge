---
agent: Anya
trigger: projection-drift
asOf: 2026-06-03T05:44:27.088Z
decision-required: false
---

# Anya — projection drift, 2026-06-03

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
| Owner Inbox deliverables | 577 |
| Team Inbox — open | 5 |
| Team Inbox — actioned | 59 |

## Cross-check vs dashboard cache

Cache asOf: `2026-06-03T05:43:25.229Z`

| Metric | Canonical | Cached | Drift |
|---|---|---|---|
| `principles` | 6 | 6 | 0 |
| `obligations` | 417 | 417 | 0 |
| `instruments` | 95 | 83 | +12 |
| `instrumentsAnalysed` | 6 | 6 | 0 |
| `proceduresPopulated` | 133 | 146 | -13 |

2 metrics drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.

## Anya's narrative

Dashboard cache is reachable (asOf 05:43:25Z, about a minute behind this run) and aligned with canonical on `principles`, `obligations`, and `instrumentsAnalysed`. Two metrics drift: `instruments` is canonical=95 / cached=83 (+12 canonical) and `proceduresPopulated` is canonical=133 / cached=146 (−13 canonical, i.e. cache is *over*-counting). Both warrant attention; the procedures drift is the louder signal because it points the wrong way.

The `instruments` gap (+12 canonical) is the easier reading: twelve regulatory instruments have been added under `/Regulations/` since the dashboard projection last derived, and the cache hasn't picked them up. That's consistent with a stale derive and resolves on refresh. `proceduresPopulated`, however, shows the cache holding 146 against a canonical 133 — the projection is reporting thirteen procedures that the file system doesn't substantiate. Stale-cache alone doesn't explain a *negative* drift; either the derivation rule for "populated" has diverged from the canonical definition, or procedure files were removed/renamed and the cache is still counting the prior set. `instrumentsAnalysed` holding at 6/6 is worth flagging alongside: with 95 instruments now in the register and only 6 analysed, the analysis backlog is widening regardless of cache state.

Next actions: (1) trigger a dashboard projection refresh and re-check — that should close the `instruments` +12 cleanly; (2) if `proceduresPopulated` still reads 146 post-refresh, raise a Vera dashboard-derivation finding against the `proceduresPopulated` rule, since canonical-below-cached is a derivation defect, not a freshness one; (3) separately note to Devon that instrument-coverage (6/95 analysed) is drifting further from policy intent and is a substantive backlog, not a projection artefact.

## Provenance

Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).
