---
policy-parent: Owner Inbox/2026-05-06_core-policies-compliance-conduct.md §3 — ABC Policy
last-reviewed: 2026-05-15
procedureId: PROC-COND-ABC-DD-01
title: Anti-bribery and corruption third-party due diligence
author: Owen (Company Secretary, governance) · Zara (Chief Compliance Officer, governance)
date: 2026-05-15
owner: Owen (Company Secretary, governance) · Zara (Chief Compliance Officer, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-conduct.md §3 — ABC Policy
system-capability: prototype/domains/compliance/abc-due-diligence (PLANNED)
---

# Procedure — Anti-bribery and corruption third-party due diligence

**Procedure ID:** PROC-COND-ABC-DD-01
**Owner:** Owen (Company Secretary, governance) · Zara (Chief Compliance Officer, governance)
**Approval:** BRC
**Cadence:** On-trigger (per third-party engagement); annual refresh for existing relationships
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-conduct.md` §3 — Anti-Bribery and Corruption (ABC) Policy.

Third parties — service providers, consultants, agents, introducers, joint venture partners — are the primary vector through which bribery and corruption risk reaches the bank. This procedure governs the pre-engagement and ongoing due diligence requirements that must be satisfied before any third-party relationship is authorised, and the annual refresh cycle for existing relationships.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CND-01` (Prevention and Combating of Corrupt Activities Act 12 of 2004 — PRECCA s.3–10) | Wide definition of corruption offences; "associated person" liability where a third party acting on behalf of the organisation commits a corruption offence. |
| `ORG-CND-02` (PRECCA s.34) | Duty to report knowledge or suspicion of corruption to DPCI (Hawks); reporting obligation binds the bank. |
| `ORG-CND-03` (UK Bribery Act 2010 s.7 — where applicable) | "Adequate procedures" defence requires documented third-party due diligence; relevant where the bank has UK-nexus counterparties. |
| `ORG-FC-02` (FIC Act s.21B) | Risk-based approach to business relationships; ABC risk is a component of the overall relationship risk assessment. |
| `ORG-FC-22` (FIC Act s.22) | Record-keeping obligations apply to the due-diligence file for a business relationship. |

## 3. Purpose

Identify and manage bribery and corruption risk associated with third parties acting on behalf of, or in a business relationship with, the bank. The procedure ensures every third-party relationship is assessed against ABC risk factors before engagement commences, that high-risk relationships are subject to enhanced diligence and senior approval, and that ongoing monitoring detects changes in risk profile between annual refreshes.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `ThirdPartyEngagementProposed` event (from `outsourcing-due-diligence.md` or `counterparty-onboarding-markets.md`) | New ABC assessment — Steps 1–7 |
| Annual cadence (agent tick, 1 January) | Refresh assessment for all active third parties — Steps 3–7 |
| Material adverse intelligence event (media / sanctions alert from Mira) | Out-of-cycle review — Steps 3–7 expedited |
| Third-party role, ownership, or geography changes | Triggered refresh — Steps 3–7 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Third-party profile.** Compile the third-party profile: legal name, jurisdiction, beneficial ownership, nature of services, counterparts who will interact with public officials, geographic exposure, and the commercial rationale for the relationship. | Devon (agent) + `system` | `@platform/party-register` ✓ + `@domains/compliance/abc-due-diligence` (`PLANNED`) | Event: `ABCDueDiligenceOpened { engagementId, thirdPartyId, jurisdictions, services, rationaleSummary }`. |
| 2 | **Identify public-official exposure.** Determine whether the third party's role involves interaction with public officials (PRECCA s.1 definition) in any jurisdiction where the bank or the third party operates, and whether the third party is itself a public official or state-owned entity. | Owen (agent) + Zara (agent) | `@domains/compliance/abc-due-diligence` (`PLANNED`) | Event: `PublicOfficialExposureAssessed { engagementId, publicOfficialContact: boolean, stateOwnedEntity: boolean, jurisdictions }`. High exposure triggers enhanced-diligence path (Step 3b). |
| 3 | **ABC risk score.** Compute a composite ABC risk score from: (a) jurisdiction Transparency International CPI score (Mira-maintained index); (b) sector / industry ABC risk (construction, government contracting, extractives = elevated); (c) third-party ownership structure (opaque ownership = elevated); (d) public-official exposure (Step 2); (e) value and duration of engagement. Score bands: Low / Medium / High / Prohibited. | `system` + Mira (agent) | `@domains/compliance/abc-risk-scoring` (`PLANNED`) | Event: `ABCRiskScoreAssigned { engagementId, score, band, components }`. Prohibited band triggers immediate block and escalation to Zara + Owen + CEO. |
| 4 | **Enhanced due diligence (for High-band).** For High-band third parties: (a) obtain independent adverse-media check (Mira); (b) conduct PEP / sanctions check (integration with `sanctions-screening.md`); (c) request third-party ABC certification / self-disclosure questionnaire; (d) verify UBO against external registry sources. | Mira (agent) + Zara (agent) | `@domains/compliance/abc-edd` (`PLANNED`) | Event: `ABCEnhancedDueDiligenceCompleted { engagementId, adverseMediaClean, pepSanctionsClean, certificationReceived, uboVerified }`. Any adverse finding escalates to Zara (CCO) for disposition. |
| 5 | **Contractual safeguards.** For all third parties above Low band, include ABC contractual provisions: (a) ABC representation and warranty clause; (b) audit right clause (right to inspect third-party records relating to the engagement); (c) immediate-termination right on ABC violation; (d) obligation to cooperate with investigations. Imani drafts; standard clause library at `@domains/legal/clause-library`. | Imani (Legal-as-code engineer) + Owen (agent) | `@domains/legal/contract-execution` (`PLANNED`) | Event: `ABCContractualSafeguardsExecuted { engagementId, clausesApplied, signedAt, documentRef }`. For Low-band engagements below a materiality threshold, standard T&Cs incorporating the ABC clause are sufficient; Imani confirms adequacy. |
| 6 | **Approval.** Low-band: Owen approves. Medium-band: Zara approves. High-band: CFO or CEO approves (per `delegation-of-authority.md` Level 3/4). Approval event is the gate; engagement must not commence before it fires. | Owen / Zara / Camille / CEO (governance) | `@domains/compliance/abc-due-diligence` (`PLANNED`) | Event: `ABCEngagementApproved { engagementId, approvedBy, approvedAt, band, conditions }`. Conditions (e.g. contractual milestones, monitoring frequency) are embedded in the approval event. |
| 7 | **Ongoing monitoring and annual refresh.** At each agent tick: (a) re-run adverse-media check (Mira); (b) check sanctions / PEP status changes; (c) re-score risk if jurisdiction CPI index has materially changed. Annual refresh re-runs Steps 1–6 in full. Changes that materially increase risk trigger an out-of-cycle Step 6 approval. | Mira (agent) + Zara (agent) | `@domains/compliance/abc-monitoring` (`PLANNED`) | Event: `ABCRefreshCompleted { engagementId, refreshedAt, outcome: "no-change" | "risk-elevated" | "suspended" | "terminated" }`. |

## 6. Reconciliation

- **Events produced:** `ABCDueDiligenceOpened`, `PublicOfficialExposureAssessed`, `ABCRiskScoreAssigned`, `ABCEnhancedDueDiligenceCompleted` (High-band), `ABCContractualSafeguardsExecuted`, `ABCEngagementApproved`, `ABCRefreshCompleted`.
- **Reconciliation checks:**
  - Every active third-party engagement has a current `ABCEngagementApproved` event that has not been revoked.
  - Every High-band engagement has a `ABCEnhancedDueDiligenceCompleted` event predating its `ABCEngagementApproved`.
  - Every third-party engagement above Low band has an `ABCContractualSafeguardsExecuted` event.
  - Annual refreshes completed for all active engagements by 28 February each year.
- **Failure mode:** engagement with a third party without a current `ABCEngagementApproved` event → immediate suspension, Vera finding, Zara and Owen notification.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| ABC due-diligence event chain per third party | Event log (P1) | 7 years post relationship end | Confidential |
| Third-party ABC questionnaire / certification | Document store; hash in `ABCEnhancedDueDiligenceCompleted` | 7 years post relationship end | Confidential |
| Adverse-media check results | Document store | 7 years | Confidential |
| ABC contractual provisions (clause schedule) | Document store; hash in `ABCContractualSafeguardsExecuted` | Contract period + 7 years | Legal-confidential |
| Approval events (`ABCEngagementApproved`) | Event log | Permanent | Internal |
| Annual refresh records | Event log + document store | 7 years | Confidential |

## 8. Manual steps

- **Step 2** (public-official exposure assessment) — Owen's judgement on whether interaction meets PRECCA s.1 "public official" threshold in each jurisdiction; Imani supports on non-SA jurisdictions.
- **Step 3** (Prohibited-band block) — Zara + Owen + CEO confirm; escalation to FIC / DPCI may be required under PRECCA s.34.
- **Step 5** (contractual negotiation) — Imani leads; counterparty may resist audit-right or immediate-termination clause; escalation to Zara if material ABC clause is refused.
- **Step 6** (High-band approval) — requires CFO or CEO sign-off; cannot be delegated further.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Third party engages public official on bank's behalf without prior disclosure | Adverse-media alert; whistleblowing report | Zara + Owen + CEO; potential PRECCA s.34 reporting obligation; DPCI notification if corruption suspected |
| ABC certification is false or misleading | Audit exercise; adverse-media check | Immediate suspension; Imani (contract termination); Zara (regulatory notification); potential DPCI referral |
| Annual refresh overdue | Calendar trigger; Vera recon on `ABCRefreshCompleted` events | Zara + Owen; immediate refresh; Vera finding |
| Prohibited-band third party identified post-engagement | Mira intelligence update; risk-score change | Immediate suspension; Zara + Owen + CEO; consider PRECCA s.34 reporting; Imani contract termination |
| Contractual audit right refused by counterparty | Step 5 negotiation breakdown | Zara + Owen; consider whether engagement can proceed without audit right; High-band requires CEO approval to waive |

## 10. Related procedures

- `outsourcing-due-diligence.md` — ABC due diligence is a mandatory component of the outsourcing due-diligence gate; this procedure is invoked as a sub-procedure.
- `counterparty-onboarding-markets.md` (PROC-MK-CO-01) — ABC risk is assessed at Gate 2 (KYC/CDD) for institutional counterparties; this procedure provides the detailed ABC mechanics.
- `conflicts-declaration.md` — ABC risk often intersects with conflicts of interest (gift, hospitality, relationship with public official); Vera monitors the interaction.
- `sanctions-screening.md` — ABC EDD (Step 4) includes a PEP / sanctions check routed through the sanctions screening system.
- `whistleblowing-case.md` (PROC-COND-WB-01) — internal ABC reports from employees or contractors are ingested through the whistleblowing procedure; this procedure governs the downstream third-party response.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Owen (Company Secretary, governance) · Zara (Chief Compliance Officer, governance) | Initial POPULATED draft. Full 12-section body; PRECCA s.34 reporting duty; four-band risk score; EDD for High-band; ABC contractual safeguards; annual refresh cycle; UK Bribery Act s.7 "adequate procedures" defence noted. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts annually:
- Every active third-party engagement has a current `ABCEngagementApproved` event.
- All High-band engagements have EDD documentation and senior approval on file.
- Annual refreshes are complete for all active third parties by 28 February.
- No engagement with a third party assessed as Prohibited-band.

Zara presents the ABC due-diligence register to BRC annually as part of the compliance programme report. PRECCA s.34 reportable events are logged separately and reported to the CEO immediately on identification.
