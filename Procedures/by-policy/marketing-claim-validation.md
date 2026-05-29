---
policy-parent: Marketing & Advertising Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-MK-MCV-01
title: Marketing and advertising claim validation — FAIS / TCF compliance
author: Zara (Chief Compliance Officer, governance) · Imani (legal-as-code engineer)
date: 2026-05-16
owner: Zara (Chief Compliance Officer, governance)
status: POPULATED
policy-cited: Marketing & Advertising Policy (planned)
system-capability: "@compliance/marketing-claim-validation (PLANNED)"
---

# Procedure — Marketing and advertising claim validation — FAIS / TCF compliance

**Procedure ID:** PROC-MK-MCV-01
**Owner:** Zara (Chief Compliance Officer, governance)
**Approval:** BRC (Marketing & Advertising Policy — planned)
**Cadence:** On-trigger (pre-publication review); ongoing post-publication monitoring; annual policy review
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Marketing & Advertising Policy (planned; Zara co-authors with Nolan (talent acquisition & brand) at licence-day; BRC approval required before any marketing material is published).
- FAIS Policy v0.1 (STUB, FSP-conditional) — General Code of Conduct §4 governs representations made to clients and prospective clients; all marketing claims about financial products must conform.
- Customer Treatment Policy (TCF) — Treating Customers Fairly Outcome 1 (fair products) and Outcome 3 (clear information) bind all client-facing communications.

The obligation chain:

```
Regulation (FAIS Act s.16 + GCC §4 — fair representation; TCF framework; CPA s.29 — misleading representations)
  → Marketing & Advertising Policy (planned)
    → PROC-MK-MCV-01 (this procedure)
      → @compliance/marketing-claim-validation (PLANNED)
        → Approved marketing materials register
```

**Build-phase posture:** The bank publishes no marketing materials to clients or the public during the build phase (no real clients exist until licence-day). This procedure governs all client-facing materials once the bank commences operations. Build-phase use: internal communications about the bank's products and services are reviewed under a lighter-touch version of this procedure to ensure the internal framing is consistent with what will eventually be published externally.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CD-03` (FAIS Act s.16 + GCC §4(1)(a)) | FSP must not make any statement, promise, or forecast that is fraudulent, misleading, deceptive, or unfair in relation to any financial product or service. |
| `ORG-CD-03` (GCC §4(1)(b) — comparative claims) | Comparative claims must be factually based, clearly substantiated, and not designed to denigrate competitors. |
| `ORG-CD-03` (GCC §3(2)(c) — disclosure obligations) | FSP must disclose all material information including information that may adversely affect clients' interests; marketing must not omit material facts. |
| `ORG-TCF-02` (TCF Outcome 1 — product design fairness) | Products are designed to meet the needs of identified client groups; marketing must represent products accurately in relation to their design purpose and target market. |
| `ORG-TCF-03` (TCF Outcome 3 — clear information) | Clients receive clear information about products and services; marketing materials must be written in plain language appropriate for the target institutional audience. |
| `ORG-CD-08` (Consumer Protection Act s.29 — misleading representations) | No supplier may market goods or services in a manner that is reasonably likely to mislead or deceive the consumer; applies to institutional clients in the CPA's scope. |

## 3. Purpose

1. Ensure that every marketing claim — about the bank's financial products, services, capabilities, regulatory status, and track record — is accurate, substantiated, and not misleading before publication.
2. Conduct a structured claim-by-claim compliance check against the FAIS General Code of Conduct, TCF Outcomes 1 and 3, and the CPA s.29 test.
3. Obtain legal sign-off from Imani (legal-as-code engineer) on any marketing material that makes contractual representations, performance promises, or regulatory capability claims.
4. Monitor post-publication materials for drift (factual changes that make a previously accurate claim inaccurate) and operate a rapid-withdrawal pathway for non-compliant claims.
5. Maintain a complete register of approved marketing materials so that Vera (internal audit engineer, governance) can audit marketing compliance and FSCA can inspect on demand.

## 4. Trigger

- **Pre-publication:** `MarketingMaterialSubmittedForReview { materialId, materialType, author, targetAudience, publicationChannel, submittedAt }` — emitted when any team member submits a marketing or communications artefact for pre-publication review.
- **Post-publication monitoring:** `MarketingMaterialPublished { materialId, publicationChannel, publishedAt }` — triggers post-publication monitoring subscription.
- **Factual change alert:** `MarketingFactualDriftDetected { materialId, driftDescription, detectedAt }` — emitted when a monitored fact underlying a published claim changes.
- **Withdrawal request:** `MarketingWithdrawalRequested { materialId, reason, requestedBy, requestedAt }` — triggers the withdrawal workflow.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `MarketingMaterialSubmittedForReview`: register the material in the marketing claim validation register; assign a review workflow instance; notify Zara of receipt; confirm the material is version-controlled and the author identity is recorded | `agent` (Zara — workflow initiation) | `@compliance/marketing-claim-validation` (PLANNED) | All marketing materials must be submitted in advance of publication — no publication without a `MarketingMaterialApproved` event. Emergency/time-sensitive publications are not exempt; Zara may expedite review but cannot waive it. |
| 2 | **Claim extraction.** Parse the submitted material and extract every discrete claim: product capability claims, regulatory-status representations, pricing representations, performance records, comparative statements, and capability certifications | `agent` (Zara — claim extraction, assisted by `@compliance/marketing-claim-validation`) | `@compliance/marketing-claim-validation` (PLANNED) | Claims are catalogued in a structured checklist: claim text, claim type, substantiation source required, risk rating (Low / Medium / High). High-risk claims include performance guarantees, regulatory-approval assertions, and comparative superiority claims. |
| 3 | **Claim-by-claim compliance check.** For each extracted claim: (a) GCC §4(1)(a) — is the claim accurate and substantiated? (b) GCC §4(1)(b) — is any comparative claim factually based and not denigrating? (c) GCC §3(2)(c) — does the material omit any material facts that must be disclosed? (d) TCF Outcome 3 — is the language clear and appropriate for institutional clients? (e) CPA s.29 — is the claim reasonably likely to mislead? | `agent` (Zara — compliance assessment) | `@compliance/marketing-claim-validation` (PLANNED) | Each claim produces a compliance disposition: `Approved`, `ApprovedWithModification`, or `Rejected`. `Rejected` claims must be removed or rewritten before the material can proceed. |
| 4 | **Legal sign-off.** If the material contains: (a) contractual representations (e.g., service level commitments); (b) regulatory capability claims (e.g., ODP-authorised, FSP-licensed); (c) performance track-record statements; or (d) ISDA / GMRA capability representations — refer to Imani (legal-as-code engineer) for legal review alongside the compliance check | `human` (Imani — legal review) | None — legal judgment | Legal review runs in parallel with the compliance check (steps 2–3). Imani's legal sign-off is a prerequisite for the `MarketingMaterialApproved` event if any of the four triggers apply. |
| 5 | Emit `MarketingClaimCheckCompleted { materialId, claimsChecked, approved: number, approvedWithModification: number, rejected: number, legalSignOffRequired: boolean, completedAt }` | `agent` | `@platform/event-store` | |
| 6 | If `rejected > 0`: return the material to the author with the rejection list and required modifications; author revises and resubmits; the revised material restarts from step 1 | `agent` (notification) | `@compliance/marketing-claim-validation` (PLANNED) | Resubmission counter is tracked; a material that fails three review cycles triggers a discussion between Zara + Saskia + the author to determine whether the communication objective can be met under the regulatory constraints. |
| 7 | If all claims are `Approved` or `ApprovedWithModification` (and modifications are incorporated) AND any required legal sign-off is obtained: Zara (CCO, governance) approves the material for publication | `human` (Zara — CCO, governance) | None — irreducible governance approval | Zara's approval is mandatory; it cannot be delegated to another agent during the build phase. At licence-day, the Marketing & Advertising Policy may define a delegation matrix for lower-risk material types. |
| 8 | Emit `MarketingMaterialApproved { materialId, approvedBy: Zara, legalSignOffBy: Imani (where applicable), approvalRef, approvedAt, retentionEndDate }` | `agent` | `@platform/event-store` | `retentionEndDate` is set at 7 years (FAIS Act s.17 — records of client-facing communications). |
| 9 | **Post-publication monitoring.** On `MarketingMaterialPublished`: Zara's agent subscribes the material to a factual-drift monitoring schedule; the schedule checks all substantiation sources (regulatory status, product parameters, performance data) at the frequency set by the material's risk rating (weekly for High, monthly for Medium, quarterly for Low) | `agent` (Zara) | `@compliance/marketing-claim-validation` (PLANNED) | Factual-drift monitoring covers: (a) regulatory status changes (FSCA licence status, ODP authorisation); (b) product parameter changes (limits, terms); (c) market data references that may become stale; (d) competitive landscape changes affecting comparative claims. |
| 10 | If `MarketingFactualDriftDetected`: Zara reviews the drift; determines whether the published claim has become inaccurate; if inaccurate, the material proceeds to withdrawal or urgent amendment (step 11) | `human` (Zara — CCO, governance) | None — compliance judgment | The threshold for withdrawal vs amendment is whether the drift makes the claim materially misleading. Zara makes this determination; Helena is notified for High-risk material drift. |
| 11 | **Withdrawal pathway.** On `MarketingWithdrawalRequested` or on Zara's determination that a claim has become non-compliant: (a) Zara instructs the publication channel to remove the material immediately; (b) the material's status in the register is set to `Withdrawn`; (c) Imani reviews whether any contractual representations require client notification; (d) if client notification is required, Zara + Imani draft the correction notice | `human` (Zara — lead) + `human` (Imani — contractual review) | `@compliance/marketing-claim-validation` (PLANNED) | Withdrawal must be confirmed within 4 business hours of the decision. If the publication channel cannot confirm withdrawal within 4 hours, Helena + CEO are notified. |
| 12 | Emit `MarketingMaterialWithdrawn { materialId, withdrawnAt, withdrawalReason, clientNotificationRequired: boolean, withdrawnBy: Zara }` | `agent` | `@platform/event-store` | |
| 13 | **Annual policy review.** Zara reviews the Marketing & Advertising Policy against: (a) FSCA and FSCA enforcement actions on marketing compliance; (b) TCF Outcomes 1 and 3 supervisory guidance; (c) the prior year's compliance check outcomes (claim rejection rates, withdrawal history); (d) any GCC amendments | `human` (Zara — CCO, governance) | None — policy judgment | Review outcomes are documented in a policy review brief; BRC approval is required for any policy amendments. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Zara (Chief Compliance Officer, governance) | Pre-publication compliance check; material approval; post-publication monitoring; withdrawal decisions; annual policy review |
| Imani (legal-as-code engineer) | Legal sign-off on contractual representations and regulatory claims; withdrawal contractual review; client notification drafts |
| Saskia (Head of Global Markets, governance) | Commercial input on product capability claims; substantiation of trading capability representations |
| Helena (Chief Risk Officer, governance) | High-risk material drift notification; escalation on critical withdrawals |
| Owen (Company Secretary, governance) | Regulatory status representations (ODP, FSP) must be verified against Owen's registers before use in marketing |
| Vera (internal audit engineer, governance) | Marketing materials register completeness; withdrawal coverage; annual marketing compliance audit |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Material submitted without pre-publication review | Zara; publication blocked | Immediately |
| Three failed review cycles | Zara + Saskia + author discussion | Before fourth submission |
| Factual drift on High-risk material | Zara + Helena | Same day |
| Withdrawal not confirmed within 4 hours | Helena + CEO | Hour 4 |
| Client notification required on withdrawal | Zara + Imani + Helena | Within 24 hours of withdrawal |
| FSCA supervisory enquiry on marketing material | Zara (lead) + Imani + Helena | Within FSCA response window |
| Annual policy review overdue | Vera finding → Zara + BRC | Overdue date |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@compliance/marketing-claim-validation` | PLANNED | Claim extraction, compliance checklist, review workflow, post-publication monitoring, withdrawal tracking |
| `@platform/event-store` | Live | All typed marketing compliance events |
| Marketing materials register | `@compliance/marketing-claim-validation` (PLANNED) | Canonical register of all submitted, approved, and withdrawn materials |
| Regulatory status feeds | `@platform/officers/` (PLANNED) | FSP and ODP authorisation status for verification |

## 9. Quality controls

- **Pre-publication gate:** No `MarketingMaterialPublished` event is valid without a preceding `MarketingMaterialApproved` event for the same `materialId`. Vera asserts this invariant.
- **Review latency:** `MarketingClaimCheckCompleted` must be emitted within 5 business days of `MarketingMaterialSubmittedForReview`. Latency > 5 days is a Vera finding escalated to Zara.
- **Post-publication monitoring coverage:** Every `MarketingMaterialPublished` (status: `Active`) must have an active factual-drift monitoring subscription. Vera quarterly-audits the subscription list.
- **Withdrawal confirmation:** Every `MarketingWithdrawalRequested` must have a `MarketingMaterialWithdrawn` event within 4 business hours. Lateness is a Helena + CEO escalation.
- **Retention:** Every `MarketingMaterialApproved` event must have a `retentionEndDate` of at least 7 years. Vera asserts this at month-end.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `MarketingMaterialSubmittedForReview` | Event log | 7 years (FAIS Act) | Submission record |
| Claim-by-claim compliance checklist | Document store (BLAKE3-addressed) | 7 years | Substantiation of approval decision |
| Imani's legal sign-off note | Document store (attorney-client privilege where applicable) | 7 years | Required for contractual and regulatory claims |
| `MarketingMaterialApproved` | Event log | 7 years | Approval artefact; immutable |
| Approved marketing material (version-controlled) | Document store | 7 years | Canonical approved version |
| `MarketingMaterialWithdrawn` + withdrawal rationale | Event log + document store | 7 years | Non-compliance remediation record |
| Client correction notices (where issued) | Compliance evidence store | 7 years | FAIS Act client-communication record |
| Annual policy review brief | Document store | 7 years | Policy governance record |
| `AnnualPolicyReviewCompleted` | Event log | Permanent | |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Zara (Chief Compliance Officer, governance) · Imani (legal-as-code engineer) | Initial POPULATED — pre-publication claim-by-claim compliance check, legal sign-off pathway, Zara approval gate, post-publication factual-drift monitoring, withdrawal pathway; GCC §4 + TCF Outcomes 1 + 3 + CPA s.29 sourcing; 7-year retention. |
