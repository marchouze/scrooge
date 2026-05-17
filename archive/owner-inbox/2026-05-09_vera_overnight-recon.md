---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-09T05:29:41.374Z
decision-required: false
---

# Vera — overnight recon, 2026-05-09

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 186 assertions; 19 fail violations; 0 warn violations across 4 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 82 | 0 | 0 |
| decision-event-reconciliation | ✗ | 33 | 15 | 0 |
| dashboard-derivation-reconciliation | ✗ | 16 | 4 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 55 | 0 | 0 |

## Findings

### decision-event-reconciliation

- **[fail]** `D-THIN-HUMAN-LAYER-MINIMUM` — Registry has resolved decision D-THIN-HUMAN-LAYER-MINIMUM but no CeoDecision event in store
- **[fail]** `D-S7-TARGETED-3-5-OPEN-QUESTIONS` — Registry has resolved decision D-S7-TARGETED-3-5-OPEN-QUESTIONS but no CeoDecision event in store
- **[fail]** `D-A22-RETIRE-LEGACY` — Registry has resolved decision D-A22-RETIRE-LEGACY but no CeoDecision event in store
- **[fail]** `D-SOME-OTHER-DECISION` — Registry has resolved decision D-SOME-OTHER-DECISION but no CeoDecision event in store
- **[fail]** `D6` — Event store has CeoDecision D6 but no entry in registry decisionsResolved
- **[fail]** `D5` — Event store has CeoDecision D5 but no entry in registry decisionsResolved
- **[fail]** `D4` — Event store has CeoDecision D4 but no entry in registry decisionsResolved
- **[fail]** `D7` — Event store has CeoDecision D7 but no entry in registry decisionsResolved
- **[fail]** `D8` — Event store has CeoDecision D8 but no entry in registry decisionsResolved
- **[fail]** `D9` — Event store has CeoDecision D9 but no entry in registry decisionsResolved
- **[fail]** `S2` — Event store has CeoDecision S2 but no entry in registry decisionsResolved
- **[fail]** `D10` — Event store has CeoDecision D10 but no entry in registry decisionsResolved
- **[fail]** `D-AGENT-RUNTIME-AUTHORIZE` — Event store has CeoDecision D-AGENT-RUNTIME-AUTHORIZE but no entry in registry decisionsResolved
- **[fail]** `S1` — Event store has CeoDecision S1 but no entry in registry decisionsResolved
- **[fail]** `S4` — Event store has CeoDecision S4 but no entry in registry decisionsResolved

### dashboard-derivation-reconciliation

- **[fail]** `bank.metrics.ceoDecisionsActioned` — Drift between persisted registry and derivation at bank.metrics.ceoDecisionsActioned
- **[fail]** `decisionsResolved` — Drift between persisted registry and derivation at decisionsResolved
- **[fail]** `decisionsOpen` — Drift between persisted registry and derivation at decisionsOpen
- **[fail]** `inFlight` — Drift between persisted registry and derivation at inFlight

## Vera's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Mechanical recon results above stand on their own. Set the secret in GitHub Actions to enable narrative generation._

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (4); one `AuditFinding` per fail violation (19).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
