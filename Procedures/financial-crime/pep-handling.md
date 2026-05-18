---
procedureId: PROC-FC-PEP-01
title: PEP handling — enhanced due diligence for politically exposed persons
author: Mira (Regulatory intelligence engineer, compliance) · Zara (Chief Compliance Officer, MLRO, governance)
date: 2026-05-18
owner: Zara (Chief Compliance Officer, MLRO, governance) · Mira (Regulatory intelligence engineer, compliance)
status: POPULATED
version: "1.0"
last-updated: "2026-05-18"
policy-cited: AML-CFT-POLICY-V1
system-capability: "@platform/screening · @domains/onboarding/edd · @platform/case-management (PLANNED)"
citations:
  - FIC-ACT-S21A
  - FIC-ACT-S21A3
  - FIC-ACT-S21G
  - FIC-ACT-S29-3
  - FATF-REC-12
  - POPIA-S14
  - D-KYC-ONBOARDING-BUILD
---

# Procedure — PEP Handling (Enhanced Due Diligence for Politically Exposed Persons)

**Procedure ID:** PROC-FC-PEP-01
**Owner:** Zara (Chief Compliance Officer, MLRO, governance) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Per-event — fires on any `KYCSanctionsPEPScreened` result with `pep_flag: true` or `pep_linked: true`
**Version:** v1.0 — 2026-05-18
**Status:** POPULATED
**Authority:** D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18)

## 1. Source policy

`Policies/risk-management-and-compliance-policy-v1.md` (RMCP) — AML/CFT Policy annex, EDD obligations for PEPs.
RAS B3 (CEO-approved 2026-05-06): low appetite for financial-crime risk; PEPs are a mandatory EDD category.

The obligation chain:

```
Regulation (FIC Act s.21A, s.21G; FATF Rec.12)
  → AML-CFT-POLICY-V1 (EDD mandatory for PEPs)
    → PROC-FC-PEP-01 (this procedure)
      → @platform/screening (PEP/adverse-media adapter)
      → @domains/onboarding/edd (EDD workflow)
      → @platform/case-management (MLRO sign-off gate — PLANNED)
      → KYCEDDInitiated / KYCEDDCompleted / ClientRejected events
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| FIC Act s.21A | Accountable institutions must apply enhanced measures for relationships with PEPs and their associates. |
| FIC Act s.21A(3) | Senior management approval required before establishing or continuing a relationship with a PEP. |
| FIC Act s.21G | Enhanced due diligence — source-of-wealth and source-of-funds verification required. |
| FIC Act s.29(3) | Tipping-off prohibition: where an STR is lodged or contemplated, the existence of the investigation must not be disclosed to the subject. |
| FATF Recommendation 12 | PEP classification: domestic PEP, foreign PEP, international-organisation PEP; family members and close associates treated equivalently. |
| POPIA s.14 | Processing of political opinion data (implicit in PEP classification) requires explicit justification under a lawful processing ground. |

## 3. Purpose

Ensure that no candidate whose screening returns a PEP flag is onboarded, and no existing client whose PEP status changes is maintained, without completing the full EDD chain required under FIC Act s.21A, s.21G and FATF Recommendation 12. The MLRO (Zara) is the sole authority for the final accept/reject decision; the decision must be recorded as a typed event before any `ClientAccepted` can be emitted for such a candidate.

## 4. Trigger

Event: **`KYCSanctionsPEPScreened`** (PLANNED) arriving with either `pep_flag: true` or `pep_linked: true`.

- `pep_flag: true` — the candidate themselves holds or has held a prominent public function (direct PEP).
- `pep_linked: true` — the candidate is a family member or known close associate of a PEP (linked PEP).

This procedure is also re-entered during the continuous-KYC lifecycle (`kyc-continuous.md`) if PEP status is detected after initial onboarding.

**Build-phase posture:** No live clients. The EDD workflow is exercised via the onboarding rehearsal scenario (`tests/onboarding-rehearsal.test.ts`). Production-readiness is gated by the pre-licence go-live readiness substrate.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `KYCSanctionsPEPScreened` alert; validate PEP status as direct or linked; confirm the screening hit references a real match (not a false positive) against the list version hash | `system` (alert router) → `Mira` (compliance review) | `@platform/screening` | False-positive determination documented as a typed event with match evidence. If false positive confirmed → emit `KYCPEPFalsePositiveRecorded` (PLANNED) and route back to normal onboarding flow. |
| 2 | PEP tier classification per FATF Rec.12: domestic PEP (holds SA public office), foreign PEP (holds public office in another jurisdiction), international-organisation PEP (senior role in IO) | `system` (classification engine) → `Mira` (for ambiguous cases) | `@platform/screening` | Tier recorded on the candidate record. Family-member / close-associate PEPs inherit the tier of the associated PEP. |
| 3 | Escalate to Zara (MLRO) for mandatory senior-management approval gate per FIC Act s.21A(3); create case in case-management system | `system` (case router) | `@platform/case-management` (`PLANNED`) | No further steps may proceed without Zara's explicit approval event. SLA: Zara must review within 2 business days of escalation. |
| 4 | Source-of-wealth verification: collect documentation establishing how the PEP accumulated their wealth (e.g., employment history, inheritance, business ownership); assess plausibility against public information | `Mira` (intelligence gather) → `Zara` (assessment) | `@domains/onboarding/edd` (`PLANNED`) | Required by FIC Act s.21G. Documents lodged in content-addressed document store; each document emits `DocumentLodged` with hash. |
| 5 | Source-of-funds verification: collect documentation establishing the specific funds entering the relationship (bank statements, salary slips, sale-of-asset evidence); validate provenance | `Mira` (intelligence gather) → `Zara` (assessment) | `@domains/onboarding/edd` (`PLANNED`) | Distinct from source-of-wealth; both are required under EDD. |
| 6 | Adverse-media deep-scan: run enhanced adverse-media query against candidate name, aliases, associated entities; review results for corruption, financial crime, regulatory action, reputational risk | `system` (adapter call) → `Mira` (review) | `@platform/screening` (adverse-media adapter) | Results recorded as a typed event with query parameters and result-set hash. |
| 7 | Emit `KYCEDDInitiated` (PLANNED) recording: candidate ID, PEP tier, assigned MLRO, SLA deadline, list of EDD steps initiated | `system` | `@platform/event-store` ✓ | Event emitted once all EDD steps (4–6) are underway; this is the gate event for the 5-business-day reconciliation clock. |
| 8a | **MLRO accept path:** Zara reviews the assembled EDD package (source-of-wealth + source-of-funds + adverse-media results); decides to proceed — emits MLRO sign-off event; emit `KYCEDDCompleted { mlro_sign_off_event_id, outcome: "PROCEED" }` (PLANNED) | `Zara` (MLRO) | `@platform/case-management` (`PLANNED`) · `@platform/event-store` ✓ | `KYCEDDCompleted` cannot be emitted without a valid `mlro_sign_off_event_id`. Projection gate enforces this invariant. |
| 8b | **MLRO reject path:** Zara decides the PEP relationship poses unacceptable risk; emit `KYCEDDCompleted { outcome: "REJECT" }` (PLANNED); emit `ClientRejected { reasonCode: "PEP_EDD_REJECTED" }` | `Zara` (MLRO) | `@platform/case-management` (`PLANNED`) · `@platform/event-store` ✓ | Rejection is permanent for this candidacy; the candidate may re-apply if circumstances change. Evidence package retained per Section 7. |
| 9 | If accepted: set continuous enhanced monitoring flag on client record — `monitoring_intensity: enhanced`; 6-monthly refresh cadence (PEP tier) per `kyc-recurring.md` | `system` | `@domains/onboarding/edd` (`PLANNED`) · `@domains/kyc/client-record-service` (`PLANNED`) | Enhanced monitoring means all transaction events for this client are routed through the elevated-risk monitoring tier. |
| 10 | **Tipping-off gate (FIC Act s.29(3)):** if at any point during EDD a suspicious transaction is identified and STR filing is contemplated, access to the EDD case is immediately restricted to the MLRO-named investigation set; no disclosure to the candidate or non-investigation compliance staff | `Zara` (MLRO) | `@platform/case-management` (`PLANNED`) | Restriction implemented as an access-control event on the case; standard compliance staff receive no further updates until MLRO lifts the restriction. |

## 6. Reconciliation

**Events produced (in sequence):**
- `KYCSanctionsPEPScreened { candidateId, pep_flag, pep_linked, pep_tier, list_version_hash }` (PLANNED) — trigger event (emitted by screening adapter).
- `KYCPEPFalsePositiveRecorded { candidateId, match_evidence }` (PLANNED) — false-positive branch only.
- `KYCEDDInitiated { candidateId, pep_tier, mlro_assigned, sla_deadline }` (PLANNED) — EDD opened.
- `DocumentLodged { candidateId, document_type, content_hash }` (multiple) — per EDD document received.
- `KYCEDDCompleted { candidateId, outcome, mlro_sign_off_event_id }` (PLANNED) — EDD resolved.
- `ClientAccepted` or `ClientRejected` (existing) — terminal onboarding gate.

**Reconciliation invariants:**
- Every `KYCSanctionsPEPScreened` with `pep_flag: true` or `pep_linked: true` must be followed by either `KYCEDDCompleted` or `ClientRejected` within **5 business days**. Open cases past this threshold generate a Vera alert to Zara.
- Every `KYCEDDCompleted { outcome: "PROCEED" }` must carry a non-null `mlro_sign_off_event_id`. Projection gate rejects events that violate this invariant.
- Every `ClientAccepted` for a PEP-flagged candidate must have an upstream `KYCEDDCompleted { outcome: "PROCEED" }` in the same onboarding chain.
- Tipping-off gate: any EDD case in restriction mode must have zero access by non-MLRO-set parties — enforced by case-management access-control projection.

**Failure mode:** if the EDD workflow service is unavailable, `KYCEDDInitiated` emission is blocked. The screening result is held in a pending queue; Mira is alerted immediately. Fail-closed: onboarding does not proceed.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| PEP screening result + list version hash | Event log | Permanent (P1) | Critical |
| Source-of-wealth documents | Document store (content-addressed) | Permanent (P1) — PEP EDD file | Critical (PII + political data, POPIA s.14) |
| Source-of-funds documents | Document store (content-addressed) | Permanent (P1) — PEP EDD file | Critical (PII) |
| Adverse-media scan result + query hash | Event log + document store | Permanent (P1) | High |
| MLRO sign-off event | Event log | Permanent (P1) | Critical |
| `KYCEDDCompleted` event | Event log | Permanent (P1) | Critical |
| Tipping-off restriction access-control events | Event log | Permanent (P1) | Restricted (MLRO set only) |

Retention basis: FIC Act s.22 (5 years post-relationship); for PEP EDD files, permanent retention applies given the regulatory importance of the decision record.

POPIA s.14 note: PEP classification constitutes processing of information that may imply political opinion. Lawful processing ground: compliance with a legal obligation (POPIA s.11(1)(c)) — FIC Act s.21A creates the obligation. Processing is proportionate and purpose-limited.

## 8. Manual steps

- **Step 3** — senior-management approval gate is exclusively Zara's (MLRO) discretion; cannot be delegated to the agent runtime.
- **Steps 4 and 5** — source-of-wealth and source-of-funds verification require human judgment on plausibility; Mira assembles the evidence, Zara forms the view.
- **Step 6** — adverse-media review involves human assessment of relevance and severity of findings; the adapter provides the raw scan, Mira reviews.
- **Steps 8a / 8b** — MLRO accept/reject is exclusively human discretion; the platform enforces this via `mlro_sign_off_event_id` as a required field.
- **Step 10** — tipping-off restriction is applied by Zara's explicit action; no automated restriction without MLRO initiation.

All manual steps are tracked exceptions under Principle 6; each produces a typed event with the actor identity recorded.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| EDD case open > 5 business days without resolution | Vera daily invariant check | Alert to Zara immediately; BRC notification if > 10 business days |
| `KYCEDDCompleted { outcome: "PROCEED" }` missing `mlro_sign_off_event_id` | Projection gate rejects event | Mira immediately; Zara to re-sign; event cannot be admitted without the field |
| `ClientAccepted` for PEP candidate without upstream EDD | Event-store gate / Vera recon | Automatic finding to Vera; escalated to CAE; relationship flagged for re-screening |
| Screening service unavailable at PEP alert time | Health-check on `@platform/screening` | Mira immediately; EDD blocked until screening restored (fail-closed) |
| Tipping-off restriction breached (non-MLRO access to restricted case) | Case-management access-control projection | Automatic alert to Zara + Vera; incident report to CAE |
| False-positive backlog grows beyond 20 open cases | Mira dashboard alert | Mira reviews list-quality; escalate to vendor if false-positive rate > 5% |

## 10. Related procedures

- `kyc-onboarding.md` (PROC-FC-01) — the primary onboarding flow; this procedure is invoked at Step 6 (EDD branch) of PROC-FC-01.
- `kyc-recurring.md` (PROC-FC-KYC-R-01) — periodic refresh; PEP clients use 6-monthly cadence and mandatory EDD at each refresh.
- `kyc-continuous.md` (PROC-FC-CKKYC-01) — continuous KYC; triggers this procedure if PEP status detected between refresh cycles.
- `sanctions-screening.md` — inline at PROC-FC-01 Step 3; shares `@platform/screening` adapter.
- `str-filing.md` — escalates from Step 10 if STR lodged during EDD.
- `ubo-resolution.md` (PROC-FC-UBO-01) — UBO natural persons are also PEP-screened via this procedure.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-18 | Mira (Regulatory intelligence engineer, compliance) + Zara (Chief Compliance Officer, MLRO, governance) | Initial POPULATED version — all 12 sections; authority D-KYC-ONBOARDING-BUILD. |

## 12. Audit / assurance

- **Vera quarterly sample:** select 30 random `KYCEDDCompleted` events from PEP-flagged candidates; trace back to `KYCSanctionsPEPScreened`; confirm each has source-of-wealth documents, source-of-funds documents, adverse-media scan, MLRO sign-off event, and correct `monitoring_intensity` flag on the client record. Deviations are reported to Zara and the BRC.
- **Vera daily invariant check:** all `KYCSanctionsPEPScreened` events (pep_flag or pep_linked) have a downstream `KYCEDDCompleted` or `ClientRejected` within 5 business days.
- **Annual effectiveness review:** Zara reviews the PEP screening hit rate, false-positive rate, and EDD completion times; submits summary to BRC.
- BRC receives a monthly dashboard tile: open PEP EDD cases by age band.
