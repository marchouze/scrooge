---
agent: Camille
trigger: cfo-substrate-state
asOf: 2026-05-07T18:33:05.129Z
decision-required: false
---

# Camille — CFO substrate state, 2026-05-07

Autonomous run of Camille's weekly CFO-substrate-state inventory per `Team/Camille.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.

**Headline:** 1 live opex line (1 without a reading) · 1/10 CFO-domain procedure file present · 0 closes approved this week.

## Build-phase opex register

| Status | Count |
|---|---|
| LIVE | 1 |
| PROVISIONED | 0 |
| DEFERRED | 8 |
| RETIRED | 0 |
| **Total** | **9** |

_1 live line without a reading. The first formal reading is the next CFO move on `Finance/_opex-register.md`._

### Lines

| ID | Status | Cost line |
|---|---|---|
| `OPEX-COMPUTE-01` | LIVE | Anthropic API (Claude Code + Claude API for agent narratives) |
| `OPEX-INFRA-01` | DEFERRED | Microsoft Azure (target production cloud per `project_cloud_target_azure` memory) |
| `OPEX-INFRA-02` | DEFERRED | Domain registrations + DNS (bank legal-entity name + customer-facing domains) |
| `OPEX-INFRA-03` | DEFERRED | Cloud HSM (FIPS 140-2/3 Level 3 per Principle 4) |
| `OPEX-TOOLING-01` | DEFERRED | Observability stack (logs, metrics, traces — production-grade) |
| `OPEX-INFRA-04` | DEFERRED | Production data residency — SARB Directive 3/2018 + POPIA cross-border review |
| `OPEX-OTHER-01` | DEFERRED | External counsel (banking-licence application + ongoing) |
| `OPEX-OTHER-02` | DEFERRED | External auditor (Companies Act s.90 + Banks Act) |
| `OPEX-OTHER-03` | DEFERRED | Insurance (D&O, professional indemnity, cyber per JS1/2024) |

## CFO-domain procedures

Camille's spec § 13 declares 10 procedures owned or co-owned by the CFO seat; 1 present, 9 missing.

### Missing

- `Procedures/by-policy/build-phase-opex-tracking.md`
- `Procedures/by-policy/cost-reading-attestation.md`
- `Procedures/by-policy/monthly-close-sign-off.md`
- `Procedures/by-policy/ba-return-sign-off.md`
- `Procedures/by-policy/afs-sign-off.md`
- `Procedures/by-policy/capital-action-governance.md`
- `Procedures/by-policy/external-auditor-relationship.md`
- `Procedures/by-policy/tax-submission-cycle.md`
- `Procedures/by-policy/ecl-staging-cycle.md`

### Present

- `Procedures/by-policy/capital-ratio-monitoring.md`

## CFO events (last 7 days)

| Event | Count |
|---|---|
| `CloseApproved` | 0 |
| `BAReturnSigned` | 0 |
| `AFSSigned` | 0 |
| `IfrsClassificationApplied` | 0 |
| `CapitalEvent` | 0 |
| `RestatementProposed` | 0 |

_Note: under build-phase posture (no real customers, no revenue) most CFO event-types are zero today; live counts grow as Bea's M1 work and the close cycle activate. Source: `project_ai_driven_bank` memory._

## Substrate gaps (from Camille's spec § 16)

- **BA-return generator** — not yet built. Owner: Bea + Anya + Atlas.
- **AC-pack generator** — not yet built. Owner: Camille (template) + Owen (governance flow) + Atlas.
- **ICAAP capital engine** — not yet built. Owner: Helena + Camille + Bea + Atlas.
- **Capital-plan tooling** — not yet built. Owner: Camille + Eitan + Atlas.
- **Auditor-correspondence register** — concept only. Owner: Camille + Owen.

## Camille's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own._

## Provenance

Read `Finance/_opex-register.md` for the build-phase opex inventory; listed `Procedures/by-policy/*.md` for CFO-domain procedures declared in Camille's spec § 13; replayed CFO event types from the host event store over the last 7 days.
