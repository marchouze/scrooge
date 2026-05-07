---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-07T12:07:07.743Z
decision-required: false
---

# Vera — overnight recon, 2026-05-07

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 178 assertions; 1 fail violations; 0 warn violations across 4 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 65 | 0 | 0 |
| decision-event-reconciliation | ✓ | 50 | 0 | 0 |
| dashboard-derivation-reconciliation | ✗ | 16 | 1 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 47 | 0 | 0 |

## Findings

### dashboard-derivation-reconciliation

- **[fail]** `inFlight` — Drift between persisted registry and derivation at inFlight

## Vera's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Mechanical recon results above stand on their own. Set the secret in GitHub Actions to enable narrative generation._

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (4); one `AuditFinding` per fail violation (1).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
