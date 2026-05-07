---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-07T07:49:37.705Z
decision-required: false
---

# Vera — overnight recon, 2026-05-07

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 106 assertions; 15 fail violations; 0 warn violations across 4 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 35 | 0 | 0 |
| decision-event-reconciliation | ✗ | 17 | 11 | 0 |
| dashboard-derivation-reconciliation | ✗ | 16 | 4 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 38 | 0 | 0 |

## Findings

### decision-event-reconciliation

- **[fail]** `S3` — Registry has resolved decision S3 but no CeoDecision event in store
- **[fail]** `S1` — Registry has resolved decision S1 but no CeoDecision event in store
- **[fail]** `D-AGENT-RUNTIME-AUTHORIZE` — Registry has resolved decision D-AGENT-RUNTIME-AUTHORIZE but no CeoDecision event in store
- **[fail]** `D10` — Registry has resolved decision D10 but no CeoDecision event in store
- **[fail]** `S2` — Registry has resolved decision S2 but no CeoDecision event in store
- **[fail]** `D9` — Registry has resolved decision D9 but no CeoDecision event in store
- **[fail]** `D8` — Registry has resolved decision D8 but no CeoDecision event in store
- **[fail]** `D7` — Registry has resolved decision D7 but no CeoDecision event in store
- **[fail]** `D6` — Registry has resolved decision D6 but no CeoDecision event in store
- **[fail]** `D5` — Registry has resolved decision D5 but no CeoDecision event in store
- **[fail]** `D4` — Registry has resolved decision D4 but no CeoDecision event in store

### dashboard-derivation-reconciliation

- **[fail]** `bank.metrics.ceoDecisionsActioned` — Drift between persisted registry and derivation at bank.metrics.ceoDecisionsActioned
- **[fail]** `decisionsResolved` — Drift between persisted registry and derivation at decisionsResolved
- **[fail]** `decisionsOpen` — Drift between persisted registry and derivation at decisionsOpen
- **[fail]** `inFlight` — Drift between persisted registry and derivation at inFlight

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (4); one `AuditFinding` per fail violation (15).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
