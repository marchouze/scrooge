---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-10T16:09:49.893Z
decision-required: false
---

# Vera — overnight recon, 2026-05-10

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** PASS — 241 assertions; 0 fail violations; 5 warn violations across 4 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 120 | 0 | 0 |
| decision-event-reconciliation | ✓ | 6 | 0 | 0 |
| dashboard-derivation-reconciliation | ✓ | 46 | 0 | 5 |
| no-prose-duplication-of-canonical-facts | ✓ | 69 | 0 | 0 |

## Findings

### dashboard-derivation-reconciliation

- **[warn]** `WS-REPORTING-M2-M3` — In-flight item WS-REPORTING-M2-M3 owner "Atlas + Anya + Bea" does not resolve to a direct report or known governance seat
- **[warn]** `WS-PROCEDURES-DRAFTING` — In-flight item WS-PROCEDURES-DRAFTING owner "Domain leads" does not resolve to a direct report or known governance seat
- **[warn]** `WS-INSTRUMENT-ANALYSES` — In-flight item WS-INSTRUMENT-ANALYSES owner "Mira" does not resolve to a direct report or known governance seat
- **[warn]** `WS-SUBSTRATE-BUDGET` — In-flight item WS-SUBSTRATE-BUDGET owner "Atlas + Anya" does not resolve to a direct report or known governance seat
- **[warn]** `WS-AGENT-RUNTIME-SUBSTRATE` — In-flight item WS-AGENT-RUNTIME-SUBSTRATE owner "Atlas + Anya" does not resolve to a direct report or known governance seat

## Vera's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Mechanical recon results above stand on their own. Set the secret in GitHub Actions to enable narrative generation._

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (4); one `AuditFinding` per fail violation (0).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
