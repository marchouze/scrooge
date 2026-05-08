---
agent: Zara
trigger: mlro-supervision
asOf: 2026-05-08T05:04:16.169Z
decision-required: false
---

# Zara — MLRO supervision attestation, 2026-05-08

Autonomous run of Zara's weekly MLRO-supervision attestation per `Team/Zara.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Third handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 37 Zara-owned obligations on the register (26 IN FORCE; 4 PARTIAL; 3 PLANNED) · 0 Mira snapshots (last 7d) · 0 STR candidates · RMCP version-approved: no.

## Zara-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 26 |
| PARTIAL | 4 |
| PLANNED | 3 |
| DRAFTING | 2 |
| N/A-yet | 2 |
| **Total** | **37** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Zara (or where Zara is named anywhere on the row). Counts are coarse — refines once the obligations register exposes a structured per-row API._

## Mira's outputs (last 7 days)

| Event | Count |
|---|---|
| `ObligationsRegisterSnapshot` | 0 |
| `CitationGatePassed` | 0 |
| `CitationGateFailed` | 0 |
| `AuditFinding` (compliance) | 0 |

## MLRO-domain events (last 7 days)

| Event | Count |
|---|---|
| `STRCandidate` | 0 |
| `SanctionsHit` | 0 |
| `PEPMatchExceedsThreshold` | 0 |
| `FAISConductBreachSuspected` | 0 |
| `RegulatorInquiry` | 0 |

_Build-phase posture: zero MLRO-domain events. Mira's transaction-monitoring, sanctions, and PEP screening pipelines emit these types — none yet built. Live event flow activates at commencement of trading per the build-phase model._

## RMCP and sanctions-list state

| Item | State |
|---|---|
| RMCP version approved (`RMCPVersionApproved` event) | **no — substrate gap** |
| Sanctions-list last refreshed | **never — substrate gap** |

## Substrate gaps surfaced this run

- **RMCP framework + version-cycle** — RMCP is named in Zara's spec as the curator's primary register; no `RMCPVersionApproved` event has fired. The first cycle is required pre-licence; substrate to author and version-control the RMCP is Zara's deliverable with Mira as engineer.
- **Sanctions-list refresh pipeline** — Mira's screening pipeline owns the cadence; no `SanctionsListRefreshed` event. List providers (UN-SC, OFAC, EU, UK HMT, DTI / POCDATARA) need ingestion specs. Required pre-onboarding.
- **Transaction-monitoring + STR pipeline** — Mira's substrate; not yet built. `STRCandidate` event-type registered but no producer.
- **FIC e-filing channel (gO!AML)** — closes at licence-day commencement; until then, STR / CTR / SAR / TPR submission paths are dry-rehearsal-only.
- **FAIS conduct-monitoring substrate** — Niko's sales / advice-record pipeline (paused per build-phase model); activates at licence-day.

## Zara's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own._

## Provenance

Zara-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Zara appears in any cell); Mira-output and MLRO-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; RMCP / sanctions-list state from typed event presence.
