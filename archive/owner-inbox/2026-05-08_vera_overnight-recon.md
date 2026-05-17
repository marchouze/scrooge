---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-08T04:47:01.361Z
decision-required: false
---

# Vera — overnight recon, 2026-05-08

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 176 assertions; 11 fail violations; 0 warn violations across 4 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 65 | 0 | 0 |
| decision-event-reconciliation | ✗ | 47 | 7 | 0 |
| dashboard-derivation-reconciliation | ✗ | 16 | 4 | 0 |
| no-prose-duplication-of-canonical-facts | ✓ | 48 | 0 | 0 |

## Findings

### decision-event-reconciliation

- **[fail]** `D-FOLLOW-ON-ROUTER-TEST` — Registry has resolved decision D-FOLLOW-ON-ROUTER-TEST but no CeoDecision event in store
- **[fail]** `D-BRAND-DESIGN-HIRE` — Registry has resolved decision D-BRAND-DESIGN-HIRE but no CeoDecision event in store
- **[fail]** `D-OI-PAX-BRAND-DESIGN-ROLE-BRIEF` — Registry has resolved decision D-OI-PAX-BRAND-DESIGN-ROLE-BRIEF but no CeoDecision event in store
- **[fail]** `D-SAMOS-NON-CLEARING` — Registry has resolved decision D-SAMOS-NON-CLEARING but no CeoDecision event in store
- **[fail]** `D-FX-CLS-MEMBERSHIP` — Registry has resolved decision D-FX-CLS-MEMBERSHIP but no CeoDecision event in store
- **[fail]** `D-FX-BOOK-BOUNDARY` — Registry has resolved decision D-FX-BOOK-BOUNDARY but no CeoDecision event in store
- **[fail]** `D-FX-AD-STATUS` — Registry has resolved decision D-FX-AD-STATUS but no CeoDecision event in store

### dashboard-derivation-reconciliation

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
