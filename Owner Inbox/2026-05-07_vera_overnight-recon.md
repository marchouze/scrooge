---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-07T10:47:04.402Z
decision-required: false
---

# Vera — overnight recon, 2026-05-07

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 162 assertions; 11 fail violations; 0 warn violations across 4 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 65 | 0 | 0 |
| decision-event-reconciliation | ✗ | 34 | 6 | 0 |
| dashboard-derivation-reconciliation | ✗ | 16 | 5 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 47 | 0 | 0 |

## Findings

### decision-event-reconciliation

- **[fail]** `S4` — Event store has CeoDecision S4 but no entry in registry decisionsResolved
- **[fail]** `S5` — Event store has CeoDecision S5 but no entry in registry decisionsResolved
- **[fail]** `S8` — Event store has CeoDecision S8 but no entry in registry decisionsResolved
- **[fail]** `S7` — Event store has CeoDecision S7 but no entry in registry decisionsResolved
- **[fail]** `S6` — Event store has CeoDecision S6 but no entry in registry decisionsResolved
- **[fail]** `D-MARKETS-SCHEMA-FOUNDATION` — Event store has CeoDecision D-MARKETS-SCHEMA-FOUNDATION but no entry in registry decisionsResolved

### dashboard-derivation-reconciliation

- **[fail]** `bank.metrics.obligations` — Drift between persisted registry and derivation at bank.metrics.obligations
- **[fail]** `bank.metrics.ceoDecisionsActioned` — Drift between persisted registry and derivation at bank.metrics.ceoDecisionsActioned
- **[fail]** `decisionsResolved` — Drift between persisted registry and derivation at decisionsResolved
- **[fail]** `decisionsOpen` — Drift between persisted registry and derivation at decisionsOpen
- **[fail]** `inFlight` — Drift between persisted registry and derivation at inFlight

## Vera's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Mechanical recon results above stand on their own. Set the secret in GitHub Actions to enable narrative generation._

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (4); one `AuditFinding` per fail violation (11).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
