---
procedureId: PROC-COND-GR-01
title: Gifts, hospitality and entertainment registration
author: Owen (Company Secretary, governance)
date: 2026-05-16
owner: Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Gifts Policy (planned) · Owner Inbox/2026-05-06_core-policies-compliance-conduct.md
system-capability: "@platform/conduct/gift-register (PLANNED)"
---

# Procedure — Gifts, hospitality and entertainment registration

**Procedure ID:** PROC-COND-GR-01
**Owner:** Owen (Company Secretary, governance)
**Approval:** Owen (individual gift approvals) · CEO (quarterly register review)
**Cadence:** On-trigger (per gift/hospitality event); quarterly (register review); annual (governance report)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Gifts Policy (planned; Owen to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_core-policies-compliance-conduct.md` §2 — Gifts and Hospitality Policy.

The obligation chain:

```
Regulation (FAIS General Code s.3A / PRECCA s.3–10 / FIC Act s.21B)
  → Gifts Policy
    → PROC-COND-GR-01 (this procedure — gift and hospitality registration)
      → @platform/conduct/gift-register (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FAIS-02` (FAIS General Code s.3A — inducements) | A representative of an FSP may not offer or accept any inducement that is likely to conflict with the duties of the representative or the FSP. Gifts that could compromise independence must be disclosed and declined. |
| `ORG-CND-01` (PRECCA s.3–10 — bribery and corruption) | Gifts above a de minimis threshold may constitute gratification under PRECCA; receipt of a bribe is a criminal offence; the duty-to-report applies. |
| `ORG-FC-02` (FIC Act s.21B — risk-based approach) | Gifts and hospitality from counterparties are a potential ABC risk vector; they must be assessed and recorded as part of the overall relationship risk-management programme. |
| `ORG-MKT-06` (FMCA s.78 — market conduct) | Persons participating in financial markets must not accept benefits that could compromise their obligations under the FMCA (e.g. insider trading controls or best execution). |

## 3. Purpose

Ensure that all gifts, hospitality, and entertainment (GHE) received or offered by any team member (human or agent) are disclosed, assessed, and either accepted with a register entry or declined with a log entry. Prevent GHE from compromising the independence, objectivity, or regulatory obligations of any team member. Comply with the FAIS General Code s.3A inducement prohibition.

**Disclosure threshold:** gifts (including hospitality) with a market value above R500 must be disclosed. Gifts below R500 need not be disclosed but must not be solicited.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `GiftReceived { recipientId, giverId, description, estimatedValue, occasion }` | GHE received registration — Steps 1–5 |
| `GiftOffered { offererId, recipientId, description, estimatedValue, occasion }` | GHE offered registration — Steps 1–4 |
| Quarterly cadence (agent tick, end-of-quarter) | Register review — Step 6 |
| Annual governance report cycle | Annual disclosure — Step 7 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Disclosure submission.** Team member who receives or offers a gift/hospitality above R500 submits a disclosure within 2 business days: giver identity, recipient identity, description of the gift, estimated market value, occasion / context, whether the gift was solicited (a PRECCA concern), and intended decision (accept / decline). Emit `GiftDisclosureSubmitted { disclosureId, type: "received" | "offered", giverId, recipientId, description, estimatedValue, occasion, solicited: boolean, intendedDecision }`. | `agent` (per team member) | `@platform/conduct/gift-register` (`PLANNED`) | Build-phase: agents are unlikely to receive or offer physical gifts. The procedure is primarily relevant at licence-day when human team members engage with market counterparties, clients, and regulators. Agent-to-counterparty hospitality (e.g. event hosting) is in scope. |
| 2 | **Value and independence assessment.** Owen assesses: (a) is the value above the R500 threshold? (b) does the gift create a real or perceived conflict of interest, compromise independence, or constitute an inducement under FAIS s.3A? (c) is the giver/recipient a public official (PRECCA risk)? (d) is the gift part of a pattern with the same giver/recipient? Emit `GiftAssessmentCompleted { disclosureId, independenceRisk, preccaRisk, patternRisk, recommendation }`. | `agent` (Owen) | `@platform/conduct/gift-register` (`PLANNED`) | Owen applies the four-factor test: value, independence impact, giver profile, pattern. Any positive PRECCA risk triggers the ABC due diligence cross-reference (`PROC-COND-ABC-DD-01`). |
| 3 | **Approval decision.** Owen approves or declines the gift: (a) low-risk, low-value (R500–R2,000): Owen approves; (b) medium-risk or mid-value (R2,000–R10,000): Owen approves with conditions (e.g. disclosure in the governance report, sharing of the hospitality with the team); (c) high-risk or high-value (> R10,000): CEO approval required; (d) public official gift: automatic decline unless CEO approves; (e) solicited gifts: automatic decline; PRECCA s.34 assessment. Emit `GiftDecisionMade { disclosureId, decision: "approved" | "declined", approvedBy, conditions[] }`. | `agent` (Owen) or `human` (CEO — high-value / public official) | `@platform/conduct/gift-register` (`PLANNED`) | The approval or decline decision is the gate. A gift may not be retained without an `GiftDecisionMade { decision: "approved" }` event. |
| 4 | **Register entry.** Owen enters the approved or declined gift in the gift register: all fields from Step 1, decision, conditions, and date. The register is an event-derived projection from `GiftDisclosureSubmitted` and `GiftDecisionMade` events. Emit `GiftRegistered { disclosureId, registeredAt }`. | `system` | `@platform/conduct/gift-register` (`PLANNED`) | Both accepted and declined gifts are registered. The declined gifts log is evidence of compliance culture. |
| 5 | **Declined gift handling.** If declined: (a) gift is returned to the giver with a courteous explanation (Owen drafts the communication); (b) if return is impractical (e.g. perishable): gift is donated to charity; (c) the communication and disposition are logged in the register. Emit `GiftDeclinedDisposed { disclosureId, disposition: "returned" | "donated" | "refused-at-source", communicationRef }`. | `agent` (Owen) | `@platform/conduct/gift-register` (`PLANNED`) | Refused-at-source means the team member declined before receiving the gift; this is the preferred outcome for obvious inducements. |
| 6 | **Quarterly register review.** Owen reviews the gift register quarterly: (a) confirms all disclosures were assessed and decided within 5 business days; (b) identifies patterns (same giver / same recipient across multiple entries); (c) flags any gifts that were accepted without proper approval. Emit `GiftRegisterReviewed { quarter, year, totalEntries, patternsIdentified, undecidedOverdue }`. | `agent` (Owen) | `@platform/conduct/gift-register` (`PLANNED`) | Patterns may indicate a systemic inducement risk; Owen escalates patterns to Zara (CCO, governance) and Helena (CRO, governance). |
| 7 | **Annual governance report disclosure.** Owen compiles the gifts and hospitality section of the annual governance report: total GHE disclosed, accepted, declined, by category and value band; any material patterns or escalations; changes to the Gifts Policy. Submitted to the Audit Forum. Emit `GiftAnnualDisclosureCompiled { year, totalDisclosures, accepted, declined, materialPatterns[], reportHash }`. | `agent` (Owen) | `@platform/conduct/gift-register` (`PLANNED`) | The annual disclosure is presented to the Interim Audit Forum (per `PROC-GOV-BP-01`) as part of the governance and compliance report. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Owen (Company Secretary, governance) | Gift register ownership; assessment; approval (within delegation); declined-gift handling; quarterly review; annual report |
| CEO | Approves high-value gifts (> R10,000) and public-official gifts; annual report recipient |
| Zara (Chief Compliance Officer, governance) | Pattern escalation; FAIS inducement assessment; PRECCA s.34 if applicable |
| Each team member | Disclosure within 2 business days; no retention without approval |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Gift from public official above R500 | Automatic decline; Owen + Zara; PRECCA s.34 assessment; CEO informed |
| Solicited gift identified | Automatic decline; Owen + Zara + CEO; investigation; potential PRECCA s.34 report |
| Pattern of gifts from same source | Owen → Zara + Helena; ABC due diligence review of the relationship |
| Gift retained without approval | Owen + CEO; immediate return or donation; Vera finding |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/conduct/gift-register` | PLANNED | Disclosure intake, assessment workflow, decision recording, register projection |
| `@platform/event-store` | ✓ live | All `Gift*` events persist here |

## 9. Quality controls

- Vera recon: every `GiftDisclosureSubmitted` has a `GiftDecisionMade` within 5 business days.
- Vera recon: every `GiftDecisionMade { decision: "approved" }` has a `GiftRegistered` entry.
- Vera recon: quarterly `GiftRegisterReviewed` event present for each quarter.
- Owen: annual Gifts Policy review; threshold review (R500 threshold is reviewed against inflation and market practice).

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `GiftDisclosureSubmitted`, `GiftAssessmentCompleted`, `GiftDecisionMade`, `GiftRegistered`, `GiftDeclinedDisposed`, `GiftRegisterReviewed`, `GiftAnnualDisclosureCompiled` events | Event log (P1) | 7 years | Confidential |
| Gift register (projection) | RMS register | 7 years | Restricted |
| Declined-gift communications | RMS document store | 7 years | Confidential |
| Annual governance report (GHE section) | RMS document store | Permanent | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Owen | Initial draft — PLANNED → POPULATED; full 11-section procedure; R500 threshold; FAIS s.3A; PRECCA; quarterly review; annual governance report. |

## 12. Audit / assurance

- **Vera (quarterly):** register review completeness; undecided-disclosure detection; pattern flagging.
- **Thandiwe (CAE, governance):** annual conduct audit including gifts and hospitality; sample testing of decisions; opinion to BRC.
- **FSCA (conduct review):** may request gifts register during FAIS conduct examination.
