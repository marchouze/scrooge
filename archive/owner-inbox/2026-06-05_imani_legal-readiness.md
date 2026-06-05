---
agent: Imani
trigger: legal-readiness
asOf: 2026-06-05T07:09:40.000Z
decision-required: false
---

# Imani — Legal-readiness snapshot, 2026-06-05

Autonomous run of Imani's weekly legal-readiness snapshot per `Team/Imani.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. 14th handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 83 Imani-owned obligations on the register (0 IN FORCE; 0 IN FLIGHT; 2 PARTIAL; 64 PLANNED) · 0 master agreements signed (last 7d) · clause-library version-published: **no — substrate gap** · legal-entity tree count: 1.

## Imani-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| IN FLIGHT | 0 |
| PARTIAL | 2 |
| PLANNED | 64 |
| DRAFTING | 5 |
| **Total** | **83** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Imani (co-curated rows with Mira / Saskia / Tomas / Owen included). Coarse parser — refines once the obligations register exposes a structured per-row API._

## Legal-domain events (last 7 days)

| Event | Count |
|---|---|
| `MasterAgreementSigned` | 0 |
| `ClauseLibraryVersionPublished` | 0 |
| `LegalEntityRegistered` | 0 |
| `ECTAExecutionRecorded` | 0 |

_Build-phase posture: zero legal-domain events. The clause-library DSL, ECTA-execution engine, and CLM platform are design-only (Imani spec § 16). Live event flow activates at commencement of trading — first `MasterAgreementSigned` is gated on Niko's counterparty-onboarding pipeline activating at licence-day._

## Legal-as-code substrate state

| Item | State |
|---|---|
| Clause-library version published | **no — substrate gap (DSL design-only)** |
| Legal-entity tree count | 1 (`LE-ZA-HOZ-BANK` placeholder; no `LegalEntityRegistered` events yet) |
| ECTA-execution path exercised | **no — engine + HSM integration design-only (§ 16)** |
| Counterparty-onboarding exercised | **no — Niko paused until commencement of trading** |
| Prior `LegalReadinessSnapshot` runs (last 30d) | 1 |

## Substrate gaps surfaced this run

- **Clause-library DSL** — design only; no DSL implemented; no `ClauseLibraryVersionPublished` events. Active build-phase work; co-owned with Atlas (substrate). Targets M1 alongside ISDA / GMRA template architecture (Imani spec § 16).
- **ECTA-execution engine** — cryptographic-signature substrate not yet integrated to platform HSM (Senna's domain). Design only. Required pre-licence for Schedule-1 gating, electronic-signature evidence, and the wet-signature exception path (§ 16).
- **CLM platform** — pattern-research only; vendor-vs-build decision pending. Owners: Imani + Camille (cost) + Devon. Target: pre-licence (§ 16).
- **Legal-entity-tree as live registry** — designed in Owner Inbox notes; not yet a queryable registry; tree count today derives from a placeholder floor. Co-owned with Anya (semantic-layer integration). Target: M1 (§ 16).
- **External-counsel panel** — recommendation paper (S5) drafted; CEO decision pending. Engagement timing 6–9 months ahead of SARB licence lodgment.
- **Customer-facing terms / employment contracts / live signed counterparty agreements** — paused until licence-day per build-phase model. Soft-franchise negotiations-in-principle structured artefacts only.

## Imani's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbjhCTfyfxFE54LVTFfrM"})._

## Provenance

Imani-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Imani appears in any cell); legal-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; clause-library / legal-entity / ECTA / counterparty-onboarding state from typed event presence. Citation chain: ECTA 25 of 2002, Companies Act 71 of 2008, ISDA Master Agreement (2002 form), GMRA 2011, Banks Act 94 of 1990.
