---
policy-id: complaints-handling-policy
title: Complaints Handling Policy v1
version: "1.0"
status: POPULATED
authority: CCO
owner: Zara (Chief Compliance Officer, governance)
effective-from: "2026-05-28"
next-review: "2027-05-28"
citations:
  - Financial Advisory and Intermediary Services Act 37 of 2002 (FAIS) — General Code of Conduct s.11 (TCF Principle 6)
  - Banks Act 94 of 1990 s.87 (duty to deal fairly with depositors)
  - FSCA Conduct Standard 2 of 2020 (complaints management)
  - D-POLICY-DOCUMENT-HOME
obligations:
  - ORG-CD-07
procedure-reference: PROC-CONDUCT-COMPLAINTS-01
author: Mira (Compliance / RegTech engineer, engineering)
date: 2026-05-28
summary: >
  Complaints Handling Policy establishing the bank's framework for receiving,
  acknowledging, investigating, and resolving complaints from clients and
  counterparties in accordance with FAIS TCF Principle 6 and Banks Act s.87.
  Closes obligation ORG-CD-07. LICENCE-BIND.
  Closes OTC-derivative complaints-handling obligation ORG-CS3-008.
decision-required: false
riskTaxonomy:
  - RT-CD.CC
---

# Complaints Handling Policy v1

> **Authority:** Zara (Chief Compliance Officer, governance).
> **Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance)).
> **Obligation closed:** [`ORG-CD-07`](../Regulations/_obligations-register.md) — complaints handling per FAIS + FSCA standards.
> **Procedure:** `PROC-CONDUCT-COMPLAINTS-01` — see `Procedures/by-policy/complaints-handling.md`.
> **Status:** POPULATED. Licence-day obligation; substrate to be operationalised at client-onboarding activation.

## 1. Purpose and regulatory basis

This policy establishes the bank's obligations and operational standards for handling complaints from clients, potential clients, and counterparties, in accordance with:

- **FAIS General Code of Conduct s.11** (TCF Principle 6 — clients must be able to lodge complaints and have them resolved fairly and promptly);
- **Banks Act 94 of 1990 s.87** (duty to deal fairly and equitably with depositors and to address grievances);
- **FSCA Conduct Standard 2 of 2020** (complaints management requirements for FSPs).

The bank treats every complaint as a conduct-risk signal. Patterns of complaints feed the CCO's quarterly conduct-risk review and the RAS RT-CD.CC appetite calibration.

## 2. Scope

This policy applies to all complaints received:

- by any channel (written, electronic, in-person, telephone);
- from any natural or legal person who is, or was, a client, prospective client, or counterparty of the bank;
- relating to any financial service, product, advice, or administrative act of the bank or its representatives.

Complaints by staff are governed by the Disciplinary Policy and HR Baseline. Regulatory inquiries from the FSCA, PA, or FIC are handled under the Regulatory Reporting Policy.

## 3. Receipt and acknowledgement

**3.1 Channels.** The bank designates a single complaints intake channel (electronic complaints portal or email alias) managed by the CCO function. All channels are logged in the complaints register at receipt.

**3.2 Acknowledgement.** Every complaint receives written acknowledgement within **2 business days** of receipt. The acknowledgement states: (a) the unique complaint reference number; (b) the name and contact details of the handling officer; (c) the target resolution timeline; and (d) the right to escalate to the FSCA Ombud if unresolved.

**3.3 Logging.** The complaints register is a typed `ComplaintReceived` event in the event store, capturing: complainant identity (where known), channel, date received, product/service category, complaint summary, assigned handler, and current status.

## 4. Investigation and resolution

**4.1 Investigation standard.** Complaints are investigated impartially. The investigating officer must have no direct involvement in the act complained about. Material complaints (claim > R 50,000 or pattern of three or more similar complaints within 90 days) are escalated to the CCO for direct oversight.

**4.2 Resolution timelines.** The bank targets resolution within **20 business days** of acknowledgement. Where investigation requires additional time, the complainant is notified in writing before the deadline expires, with a revised timeline not exceeding 45 business days from receipt.

**4.3 Outcome communication.** Resolution outcomes are communicated in writing. Outcomes must state: (a) the finding; (b) the remedy offered (if any); (c) the right to refer to the FSCA Ombud or Banking Adjudicator if dissatisfied; and (d) the 6-week referral window.

**4.4 Remediation.** Where a complaint is upheld, the CCO ensures that root-cause analysis is conducted and a remediation action (process fix, staff coaching, or system change) is logged as a finding against the relevant procedure.

## 5. Record-keeping

Complaints records — including intake log, investigation notes, outcome, and any remediation action — are retained for **5 years** from the date of final resolution, in accordance with Banks Act s.87 and FAIS recordkeeping requirements. Records are subject to the Records Management Policy and the PAIA Manual.

## 6. Escalation to MLRO and CCO

**6.1 MLRO escalation.** Where a complaint contains information suggestive of money laundering, fraud, or suspicious activity, the handling officer immediately escalates to the MLRO (Zara (Chief Compliance Officer, governance) acting interim). The complaint handling process is suspended or run in parallel with the STR assessment procedure under the RMCP.

**6.2 CCO escalation triggers.** The CCO reviews all complaints individually where:

- the monetary value of the claim exceeds R 50,000;
- the complaint alleges mis-selling, unsuitable advice, or TCF Principle 6 breach;
- the complaint involves a potential regulatory notification obligation; or
- the complaint is the third or more involving the same product, service, or representative within 90 days.

**6.3 Regulatory referral.** If a complaint is referred by a complainant to the FSCA Financial Services Ombud or the Ombudsman for Banking Services, the CCO acknowledges the referral, cooperates fully, and logs the external escalation as a `ComplaintEscalatedExternal` event.
