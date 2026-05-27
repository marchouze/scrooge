---
policy-id: regulatory-change-management-policy
title: Regulatory Change Management Policy v1
version: "1"
status: IN FORCE
owner: Zara (Chief Compliance Officer, governance)
co-owner: Mira (Compliance / RegTech engineer, engineering)
effective-from: "2026-05-27"
next-review: "2027-05-27"
citations:
  - COFI Bill (Financial Sector Regulation Act 9 of 2017 amendments, in Parliament)
  - Financial Sector Regulation Act 9 of 2017 s.7(1)(b)
  - Banks Act 94 of 1990
  - D-POLICY-DOCUMENT-HOME
author: Zara (Chief Compliance Officer, governance)
date: 2026-05-27
summary: Regulatory Change Management Policy for Hoz Bank Limited — framework for monitoring, assessing, and implementing regulatory changes. Closes obligation ORG-CD-09. Not LICENCE-BIND (forward-compat with COFI activity-based licensing).
decision-required: false
riskTaxonomy:
  - RT-LR.RC
---

# Regulatory Change Management Policy v1

> **Status:** IN FORCE (policy layer). Regulatory change management is a standing compliance obligation under FSRA s.7(1)(b). The COFI Bill activity-based licensing provisions are forward-compatibility items; the framework binds before those provisions commence.
>
> **Author:** Zara (Chief Compliance Officer, governance); technical implementation by Mira (Compliance / RegTech engineer, engineering).

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Regulatory Change Management Policy |
| Version | v1 |
| Effective date | 2026-05-27 |
| Approval authority | CEO (interim Board) |
| Obligation closed | ORG-CD-09 |
| Legal anchor | FSRA s.7(1)(b); COFI Bill (forward-compat) |

---

## 1. Purpose

This policy establishes the framework for identifying, assessing, and implementing regulatory changes that affect the bank's obligations, systems, processes, and products.

---

## 2. Scope

Covers all regulatory instruments applicable to Hoz Bank Limited: primary legislation (Banks Act, Companies Act, FSRA, POPIA, FIC Act), secondary legislation (Regulations Relating to Banks, Conduct Standards), joint standards (PA/FSCA), guidance notes, and material changes to COFI-framework licensing conditions.

---

## 3. Monitoring and horizon-scanning

Mira (Compliance / RegTech engineer, engineering) is the regulatory horizon-scanner. Monitoring channels:
- SARB/PA notices and consultation papers (polled at Mira's scheduled tick).
- FSCA conduct standards and guidance (polled at Mira's scheduled tick).
- Government Gazette publications (tracked via _obligations-register.md).
- Parliamentary monitoring for COFI Bill progress.

On material change identification: Mira raises an `ObligationEventDetected` event and opens a workstream for assessment.

---

## 4. Assessment and impact analysis

On receiving a new or amended regulatory instrument:

1. Zara assesses impact on the bank's obligation register and risk appetite.
2. Mira updates `Regulations/_obligations-register.md` with new/amended rows.
3. Affected governance seats review their domain impact within 10 business days.
4. If a CEO or Board decision is required, Zara files a decision brief.

---

## 5. Implementation

Material regulatory changes that require substrate updates, policy revisions, or new procedures are tracked as workstreams. The `recon:fsca-reg-to-policy` pipeline enforces that every active obligation has a covering policy.

---

## 6. COFI forward-compatibility

The COFI Bill will replace existing licences with activity-based licences. Until COFI commences:
- All COFI-affected obligations are flagged `CONDITIONAL-BIND` in the obligations register.
- Mira tracks the Bill's parliamentary progress and updates bind-status on commencement.
