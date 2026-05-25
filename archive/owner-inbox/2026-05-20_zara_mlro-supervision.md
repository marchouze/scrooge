---
agent: Zara
trigger: mlro-supervision
asOf: 2026-05-20T06:55:00.168Z
decision-required: false
---

# Zara — MLRO supervision attestation, 2026-05-20

Autonomous run of Zara's weekly MLRO-supervision attestation per `Team/Zara.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Third handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 72 Zara-owned obligations on the register (0 IN FORCE; 4 PARTIAL; 35 PLANNED) · 1 Mira snapshot (last 7d) · 0 STR candidates · RMCP version-approved: no.

## Zara-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| PARTIAL | 4 |
| PLANNED | 35 |
| DRAFTING | 3 |
| N/A-yet | 0 |
| **Total** | **72** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Zara (or where Zara is named anywhere on the row). Counts are coarse — refines once the obligations register exposes a structured per-row API._

## Mira's outputs (last 7 days)

| Event | Count |
|---|---|
| `ObligationsRegisterSnapshot` | 1 |
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

Substrate is not yet load-bearing because trading has not commenced — but it is also not yet built. Of 72 MLRO-owned obligations, zero are IN FORCE; 4 sit at PARTIAL, 3 DRAFTING, 35 PLANNED. No RMCPVersionApproved event has ever fired, and no SanctionsListRefreshed event has ever fired. That means today, if Mira's pipelines surfaced an STRCandidate or a SanctionsHit, I would have no approved RMCP under FIC Act s.42 to anchor the disposition against and no attested screening substrate to evidence the s.28A freeze decision. Mira detects; I decide — and right now there is nothing for either of us to act through.

The three observations that rank: (1) the RMCP itself — FIC Act s.42 and s.42A require a documented, board-approved programme *before* client onboarding; with commencement of trading on the horizon this is the single obligation whose PLANNED status is most load-bearing on every downstream Zara-signed event (CDD outcomes, s.29 STR filings, s.28/28A reporting). (2) Sanctions list freshness — TFS screening against the UNSC consolidated list and the FIC's TFS list has never been refreshed in-substrate; without a freshness SLA and a SanctionsListRefreshed heartbeat, any "no hit" attestation I sign at go-live is unsupported. (3) FAIS Act s.17 / General Code conduct obligations and the POPIA s.19 security-safeguards posture that underwrites CDD record retention (FIC s.22–s.24) — both at PARTIAL, both needed before first client.

Next moves, concrete: I will draft RMCP §§ on customer due diligence, ongoing monitoring, and the s.29 reporting workflow (including the tipping-off boundary under s.29(3)–(4)) this cycle, targeting a v0.1 for board tabling before any onboarding pilot. I am escalating "no sanctions-list refresh substrate" to Helena for inclusion in the RAS as a pre-trading red-line — this is a Joint Standard 2 of 2020 (as amended 9 June 2023) operational-resilience concern as much as an AML one, given the screening pipeline is a critical control. And I am commissioning from Mira: (a) a SanctionsListRefreshed pipeline with a 24-hour freshness SLA against UNSC + FIC TFS sources, and (b) an RMCPVersionApproved event emitter wired to the board-resolution artefact, so version cycle becomes observable rather than asserted. Until those two pipelines exist, my weekly attestation will continue to read "substrate gap to first STR" rather than "MLRO supervision in force."

## Provenance

Zara-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Zara appears in any cell); Mira-output and MLRO-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; RMCP / sanctions-list state from typed event presence.
