---
agent: Zara
trigger: mlro-supervision
asOf: 2026-05-25T06:17:17.152Z
decision-required: false
---

# Zara — MLRO supervision attestation, 2026-05-25

Autonomous run of Zara's weekly MLRO-supervision attestation per `Team/Zara.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Third handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 75 Zara-owned obligations on the register (0 IN FORCE; 4 PARTIAL; 35 PLANNED) · 2 Mira snapshots (last 7d) · 0 STR candidates · RMCP version-approved: no.

## Zara-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| PARTIAL | 4 |
| PLANNED | 35 |
| DRAFTING | 3 |
| N/A-yet | 0 |
| **Total** | **75** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Zara (or where Zara is named anywhere on the row). Counts are coarse — refines once the obligations register exposes a structured per-row API._

## Mira's outputs (last 7 days)

| Event | Count |
|---|---|
| `ObligationsRegisterSnapshot` | 2 |
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

Substrate is bare. Of 75 MLRO-owned obligations, zero are IN FORCE; 4 sit at PARTIAL, 3 at DRAFTING, 35 at PLANNED. No RMCPVersionApproved event has ever fired, and no SanctionsListRefreshed event has ever fired — meaning that if Mira's pipelines surfaced an STRCandidate or SanctionsHit today, my signature would be load-bearing on a Risk Management and Compliance Programme that does not exist in approved form and on a sanctions screening substrate with no demonstrable freshness. Zero MLRO-domain events in the last seven days is consistent with build phase, not with operating assurance; the dominant signal is the gap between obligation inventory and first-STR readiness, not event flow.

Three observations rank above the rest. First, FIC Act s.42 RMCP approval is the gating control for everything else I sign — without a board-approved RMCP, s.29 reporting, s.21 CDD, and s.28A targeted financial sanctions screening have no documented internal architecture, and Joint Standard 2 of 2020 (as amended 9 June 2023) governance expectations on AML/CFT/CPF controls are unmet. Second, the sanctions list has never been refreshed in our substrate; this is a hard blocker on s.28A and on the UNSCR 1267/1373 obligations the FIC s.26A consolidated list carries — it must be live and dated before any onboarding traffic. Third, of the 35 PLANNED obligations, the subset that lands at commencement of trading (s.29 STR pipeline, s.28 cash threshold reporting, s.27 PCC reporting, FAIS General Code conduct attestations under FAIS Act 37 of 2002, and POPIA s.19 security-safeguards-on-FICA-data) cannot remain PLANNED past the go-live gate; they have to move to DRAFTING this cycle.

Next moves, concrete. (1) I will draft RMCP Part A (governance, risk assessment methodology, customer risk rating) this week and put Part B (CDD/EDD, screening, monitoring, reporting, record-keeping, training) on the following cycle, targeting board approval before any client onboarding. (2) I am commissioning Mira to build the SanctionsListRefresh pipeline against the FIC s.26A consolidated list with a daily refresh cadence and a stale-after-48-hours alarm, and a paired RMCPVersionApproved event emitter wired to Owen's board-pack workflow. (3) I am escalating to Helena for the RAS the specific obligation that the s.29 STR submission path — including the tipping-off boundary under s.29(3) and the reporter-protection posture under s.38 — is PLANNED and not yet exercisable; this belongs on the RAS as a pre-commencement red item, not as a residual risk. Banks Act 94 of 1990 prudential authorisation is Helena's seat, but the AML/CFT control set inside it is mine, and the inventory says I am not yet ready to sign.

## Provenance

Zara-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Zara appears in any cell); Mira-output and MLRO-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; RMCP / sanctions-list state from typed event presence.
