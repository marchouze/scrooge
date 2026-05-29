---
policy-parent: Owner Inbox/2026-05-06_core-policies-compliance-conduct.md §5 — Whistleblowing Policy
last-reviewed: 2026-05-15
procedureId: PROC-COND-WB-01
title: Whistleblowing case management
author: Owen (Company Secretary, governance)
date: 2026-05-15
owner: Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-06_core-policies-compliance-conduct.md §5 — Whistleblowing Policy
system-capability: prototype/domains/compliance/whistleblowing (PLANNED)
---

# Procedure — Whistleblowing case management

**Procedure ID:** PROC-COND-WB-01
**Owner:** Owen (Company Secretary, governance)
**Approval:** Board (via Audit Committee / BRC)
**Cadence:** On-trigger (per disclosure received)
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-conduct.md` §5 — Whistleblowing Policy.

The Protected Disclosures Act 26 of 2000 (PDA) as amended by the Protected Disclosures Amendment Act 5 of 2017 creates a right for employees and third parties (including contractors and suppliers) to make protected disclosures of "occupational detriment" and wrongdoing without suffering retaliation. This procedure governs how disclosures are received, assessed, investigated, and closed, and how the reporter's protected status is maintained throughout.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CND-05` (PDA s.3 as amended) | Disclosure to a designated person, employer, legal adviser, or regulatory body is a "protected disclosure" if the discloser reasonably believes it evidences impropriety (criminal offence, failure of legal obligation, miscarriage of justice, health / safety danger, environmental damage, concealment thereof). |
| `ORG-CND-06` (PDA s.4) | Employer may not subject an employee to occupational detriment for making a protected disclosure. Detriment includes dismissal, suspension, demotion, harassment, and intimidation. |
| `ORG-CND-07` (PDA s.9A as amended, 2017) | Duty to investigate: employer or designated person who receives a protected disclosure must, within 21 days, advise the discloser of the decision whether to investigate and the reasons. |
| `ORG-CND-02` (PRECCA s.34) | Where a protected disclosure reveals a corruption offence, the bank's reporting obligation under PRECCA s.34 is triggered in parallel. |
| `ORG-FC-02` (FIC Act s.28) | Where a disclosure reveals suspicious-transaction activity, MLRO escalation and possible STR filing under `str-filing.md` is required. |

## 3. Purpose

Provide a safe, confidential, and retaliation-free channel for employees, contractors, and third parties to report concerns about wrongdoing. Ensure every disclosure is assessed for protected status under the PDA, investigated proportionately, closed with a documented outcome, and that no reporter suffers occupational detriment as a result of their disclosure.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Disclosure received via secure whistleblowing portal | Portal disclosure — Steps 1–10 |
| Disclosure received via email to the designated recipient (Owen) | Email disclosure — Steps 1–10 |
| Disclosure received via the anonymous tip line (if active) | Anonymous disclosure — Steps 1–10 (no acknowledgement possible for anonymous) |
| Disclosure forwarded by a regulator or law-enforcement body | Regulator-forwarded disclosure — Steps 1–10, with regulator as external stakeholder |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Receive and register the disclosure.** Log the disclosure in the whistleblowing register: date received, channel, reporter identity (or anonymous flag), summary of concern, and business area implicated. Assign a unique case ID. | Owen (agent) + `system` | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingDisclosureReceived { caseId, channel, anonymousFlag, summaryCategory, impliedAreaId, receivedAt }`. Portal and email channels are encrypted end-to-end; the event payload itself is access-controlled (Owen + CEO + Board Chair only). |
| 2 | **Assess protected status.** Determine whether the disclosure meets the PDA s.3 threshold: (a) does the reporter have a reasonable belief that the information evidences impropriety? (b) has the disclosure been made to an authorised recipient (Owen as designated person, or a regulator, or the reporter's legal adviser)? Note: the disclosure need not be correct, only reasonable. | Owen (agent) | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingProtectedStatusAssessed { caseId, protectedStatus: boolean, basis, assessedAt }`. If not protected (e.g. clearly vexatious or outside scope), document reasoning; reporter is still protected from retaliation while the assessment is under way. |
| 3 | **Acknowledge receipt (non-anonymous disclosures).** Within 2 business days, notify the reporter that the disclosure has been received, a case ID has been assigned, and that a decision on whether to investigate will be communicated within 21 days (PDA s.9A). | `system` + Owen (agent) | `@platform/notification/discloser` (`PLANNED`) | Event: `WhistleblowingAcknowledgementSent { caseId, sentAt, channel }`. For anonymous disclosures, no acknowledgement is possible; the 21-day clock runs from registration. |
| 4 | **Categorise the concern.** Classify the subject matter of the disclosure against a standard taxonomy: (a) financial irregularity / fraud; (b) corruption / bribery (ABC); (c) regulatory breach; (d) health & safety; (e) harassment / bullying; (f) occupational detriment (retaliation concern); (g) other impropriety. | Owen (agent) | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingCaseCategorised { caseId, categories, impliedPolicies }`. The category drives the investigation assignment and the parallel escalation paths (Step 5). |
| 5 | **Parallel escalation (where required).** Based on the category, route the disclosure to the appropriate parallel process: (a) financial irregularity → Camille (CFO) + Vera (independent audit); (b) ABC / corruption → Zara (CCO) + PRECCA s.34 reporting assessment; (c) regulatory breach → Zara + relevant regulator; (d) STR-triggering activity → MLRO escalation and `str-filing.md`; (e) harassment → Sade (HR); (f) retaliation concern → Board Chair (bypassing management chain). | Owen (agent) | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingParallelEscalationDispatched { caseId, escalations }`. Parallel escalation does not pause the primary investigation. Owen retains case ownership throughout. |
| 6 | **Investigation assignment.** Appoint an investigator who is independent of the business area implicated: for financial / regulatory matters, Vera; for HR / conduct matters, Sade or external counsel; for senior-management matters, Board Chair or external investigator. Document the investigator's independence and terms of reference. | Owen (agent) + Board Chair (where senior-management implicated) | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingInvestigatorAssigned { caseId, investigatorId, termsOfReference, assignedAt }`. Investigation must be complete within 90 days for cases not involving external parties (extendable with Owen + Board Chair approval and reporter notice). |
| 7 | **Conduct the investigation.** The assigned investigator gathers evidence, interviews relevant parties (excluding the reporter where anonymity is required), and prepares a factual findings report. The investigator has no authority to impose disciplinary outcomes; findings are reported to Owen for disposition. | Vera / Sade / external investigator | `@domains/compliance/whistleblowing` (`PLANNED`) | Events: `WhistleblowingEvidenceGathered { caseId, evidenceRefs }`, `WhistleblowingFindingsReported { caseId, findings, findingsAt }`. The findings report is access-controlled; it is not shared with the subject of the investigation until Step 8. |
| 8 | **Determine the outcome and response.** Owen (and the Board Chair where senior management is implicated) reviews the findings and determines: (a) substantiated — disciplinary, regulatory, or remediation action taken; (b) unsubstantiated — case closed with reasons; (c) inconclusive — specific further steps required. The response is documented and filed in the case file. | Owen (agent) + Board Chair | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingOutcomeDetermined { caseId, outcome, actionsTriggered, determinedAt }`. Where disciplinary action is triggered, it routes through `disciplinary-process.md` (PLANNED). Where a regulatory filing is required, it routes through the relevant procedure. |
| 9 | **Notify the reporter (non-anonymous disclosures).** Inform the reporter of the outcome, at an appropriate level of detail that does not compromise the investigation or the subject's rights. The reporter must not be disadvantaged for having made the disclosure. | Owen (agent) + `system` | `@platform/notification/discloser` (`PLANNED`) | Event: `WhistleblowingReporterNotified { caseId, notifiedAt, outcomeLevel: "substantiated" | "unsubstantiated" | "inconclusive" }`. |
| 10 | **Close the case.** Close the case in the whistleblowing register. Archive the case file (access-controlled). Trigger a 6-month welfare check for the reporter (non-anonymous) to confirm no occupational detriment has occurred since the disclosure. | Owen (agent) + `system` | `@domains/compliance/whistleblowing` (`PLANNED`) | Event: `WhistleblowingCaseClosed { caseId, closedAt, welfareCheckScheduledAt }`. Event: `WhistleblowingWelfareCheck { caseId, checkedAt, detrimentFound: boolean }` (6 months later). |

## 6. Reconciliation

- **Events produced:** `WhistleblowingDisclosureReceived`, `WhistleblowingProtectedStatusAssessed`, `WhistleblowingAcknowledgementSent`, `WhistleblowingCaseCategorised`, `WhistleblowingParallelEscalationDispatched`, `WhistleblowingInvestigatorAssigned`, `WhistleblowingEvidenceGathered`, `WhistleblowingFindingsReported`, `WhistleblowingOutcomeDetermined`, `WhistleblowingReporterNotified`, `WhistleblowingCaseClosed`, `WhistleblowingWelfareCheck`.
- **Reconciliation checks:**
  - Every `WhistleblowingDisclosureReceived` resolves to `WhistleblowingCaseClosed` within 120 days (90 days investigation + 30 days notification and close).
  - Every non-anonymous case has a `WhistleblowingAcknowledgementSent` within 2 business days.
  - Every `WhistleblowingDisclosureReceived` has a `WhistleblowingProtectedStatusAssessed` within 21 days (PDA s.9A compliance).
  - Every `WhistleblowingCaseClosed` has a `WhistleblowingWelfareCheck` scheduled 6 months forward.
- **Failure mode:** reporter suffers detriment after disclosure → PDA s.4 violation; Board Chair + CEO immediate action; potential Labour Court application by the reporter.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Whistleblowing case event chain | Event log (P1), access-controlled (Owen + CEO + Board Chair) | 7 years post-closure | Strictly confidential |
| Original disclosure (redacted where required for anonymity) | Document store, access-controlled | 7 years post-closure | Strictly confidential |
| Investigation findings report | Document store, access-controlled | 7 years post-closure | Strictly confidential |
| `WhistleblowingOutcomeDetermined` event | Event log | 7 years | Strictly confidential |
| Welfare check records | Event log + document store | 7 years post-closure | Confidential |
| Aggregate statistics (case count by category, outcome) | Anonymised report to BRC | Permanent | Internal |

## 8. Manual steps

- **Step 2** (protected-status assessment) — Owen's legal judgement; PDA threshold is a mixed factual / legal question; Imani supports.
- **Step 5** (PRECCA s.34 reporting) — Owen + Zara + CEO; decision to report to DPCI is a senior judgement call; external legal advice recommended.
- **Step 6** (investigator assignment for senior-management matters) — Board Chair must personally assign an independent investigator; management chain cannot be involved.
- **Step 8** (outcome determination) — Owen's (and Board Chair's) judgement; any disciplinary action requires natural justice (subject notified, given opportunity to respond before outcome is finalised).
- **Step 9** (reporter notification) — Owen calibrates the level of disclosure; legal advice required where the notification could prejudice a parallel regulatory investigation.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Reporter suffers occupational detriment | Welfare check; reporter complaint | Board Chair + CEO; immediate protective action; Imani (labour law advice); potential Labour Court interdict |
| 21-day PDA s.9A decision deadline missed | Timer event on `WhistleblowingDisclosureReceived` | Owen + Board Chair; immediate notification to reporter; Vera finding |
| Confidentiality breach (identity of anonymous reporter disclosed) | Discovery of breach; reporter complaint | Owen + CEO; immediate containment; Vera investigation; POPIA breach assessment |
| Investigation interference by management | Investigator report; reporter complaint | Board Chair; external investigator appointed; potential PRECCA s.34 reporting |
| Substantiated corruption finding not reported to DPCI | Vera post-outcome recon | Zara + Owen + CEO; immediate PRECCA s.34 assessment; legal advice |

## 10. Related procedures

- `abc-due-diligence.md` (PROC-COND-ABC-DD-01) — disclosures relating to third-party corruption route through ABC assessment as a parallel escalation at Step 5.
- `str-filing.md` (PROC-FC-STR-01) — disclosures implicating suspicious transactions route to the MLRO for STR assessment in parallel.
- `conflicts-declaration.md` — retaliation concerns arising from a prior conflicts declaration should be assessed under the whistleblowing procedure.
- `popia-breach-notification.md` — where a disclosure reveals a personal-information breach, Iris is notified and `popia-breach-notification.md` runs in parallel.
- `incident-response.md` — disclosures revealing cybersecurity incidents route to Senna + Devon for incident response in parallel.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Owen (Company Secretary, governance) | Initial POPULATED draft. Full 12-section body; PDA s.3/9A compliance; parallel escalation taxonomy; Board Chair independence for senior-management matters; 6-month welfare-check; PRECCA s.34 and MLRO parallel paths. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) asserts annually:
- All cases closed within 120 days; any exceedances documented with Owen and Board Chair approval.
- 21-day PDA s.9A acknowledgement met for all cases.
- No reporter has suffered occupational detriment (welfare-check events confirm).
- Confidentiality of anonymous disclosures preserved.

Owen presents anonymised aggregate statistics (case count, category, outcome) to BRC quarterly. Board Chair receives the full case register for cases implicating senior management. The whistleblowing register is not published externally but is available to the SARB, FSCA, or Information Regulator on formal request.
