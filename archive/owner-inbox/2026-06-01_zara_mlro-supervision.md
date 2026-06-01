---
agent: Zara
trigger: mlro-supervision
asOf: 2026-06-01T05:30:09.554Z
decision-required: false
---

# Zara — MLRO supervision attestation, 2026-06-01

Autonomous run of Zara's weekly MLRO-supervision attestation per `Team/Zara.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Third handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 99 Zara-owned obligations on the register (0 IN FORCE; 4 PARTIAL; 35 PLANNED) · 3 Mira snapshots (last 7d) · 0 STR candidates · RMCP version-approved: no.

## Zara-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| PARTIAL | 4 |
| PLANNED | 35 |
| DRAFTING | 3 |
| N/A-yet | 0 |
| **Total** | **99** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Zara (or where Zara is named anywhere on the row). Counts are coarse — refines once the obligations register exposes a structured per-row API._

## Mira's outputs (last 7 days)

| Event | Count |
|---|---|
| `ObligationsRegisterSnapshot` | 3 |
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

Substrate is empty. Zero MLRO-domain events in the last seven days is the expected build-phase reading — we have not commenced trading, no client has been onboarded, and no transaction has been monitored — but the inventory behind that quiet is the headline: 99 obligations sit on my desk, none IN FORCE, four PARTIAL, 35 PLANNED, three DRAFTING. There is no approved RMCP and no SanctionsListRefreshed event has ever fired. Mira's pipelines are not yet load-bearing on a Zara-signed event because the events that would require my signature — STR filing under FIC Act 38 of 2001 s.29, sanctions freeze decisions, FAIS Act 37 of 2002 conduct breach determinations — have no upstream detection substrate to feed them. Detection is not deferred; it does not exist.

Ranked by what binds at commencement of trading: first, the RMCP itself. FIC Act s.42 requires a documented, board-approved RMCP before we accept a client, and the absence of any RMCPVersionApproved event means the s.42(2)(a)–(o) coverage map is not yet a document I can sign. Second, the sanctions screening obligation under FIC Act s.28A and the TFS provisions of POCDATARA — "never refreshed" is not a freshness gap, it is the absence of the control; this lands the moment the first prospective client is screened. Third, Joint Standard 2 of 2020 (as amended 9 June 2023) cyber-resilience controls touching the AML / sanctions data plane sit at PARTIAL and need to be IN FORCE before the first customer record exists, because the integrity of the screening substrate is the control. The s.29 reportability test and the s.29(3) tipping-off boundary I will not be able to exercise as judgement until the candidate-event pipeline produces something for me to judge.

Next moves, concrete. (1) I will draft RMCP §§ covering client identification and verification (FIC s.21–21H), the risk-rating methodology, and the sanctions and PEP screening procedure, and table a v0.1 for board approval inside this cycle — that unblocks the RMCPVersionApproved event Mira is waiting on. (2) I am escalating "no sanctions list refresh substrate" to Helena for inclusion in the RAS as a commencement-blocking financial crime risk, not a residual one. (3) I am commissioning Mira to build the SanctionsListRefresh pipeline against the TFS consolidated list with a daily cadence and a SanctionsListRefreshed event signature, and in parallel the STRCandidate pipeline scaffold so that when the first transaction flows, the s.29 test is mine to apply rather than mine to invent. POPIA lawful-basis and Iris co-sign on the screening data flow will be handled in the RMCP client due diligence section, not separately.

## Provenance

Zara-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Zara appears in any cell); Mira-output and MLRO-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; RMCP / sanctions-list state from typed event presence.
