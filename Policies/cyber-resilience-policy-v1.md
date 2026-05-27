---
policy-id: cyber-resilience-policy
title: Cyber Resilience Policy v1
version: "1"
status: IN FORCE
owner: Senna (Security / CISO function, engineering)
co-owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-27"
next-review: "2027-05-27"
citations:
  - Joint Standard 2 of 2024 (PA + FSCA — Cybersecurity and Cyber Resilience)
  - NIST Cybersecurity Framework 2.0
  - POPIA Information Officer obligations (s.55)
  - D-POLICY-DOCUMENT-HOME
  - secure-sdlc-policy-v1.md
author: Senna (Security substrate engineer, engineering)
date: 2026-05-27
summary: Cyber Resilience Policy for Hoz Bank Limited — establishes the bank's cybersecurity framework under Joint Standard 2 of 2024 (PA + FSCA), aligned to NIST CSF 2.0 Govern/Identify/Protect/Detect/Respond/Recover functions. Closes obligation ORG-CY-10. Not LICENCE-BIND — Joint Standard 2 of 2024 commenced 1 June 2025.
decision-required: false
riskTaxonomy:
  - RT-OP.CY
---

# Cyber Resilience Policy v1

> **Status:** IN FORCE. Joint Standard 2 of 2024 (PA + FSCA) commenced 1 June 2025. This policy binds from that date. The Secure SDLC Policy (`secure-sdlc-policy-v1.md`) provides the engineering implementation standard.
>
> **Author:** Senna (Security substrate engineer, engineering); oversight by Helena (CRO, governance).

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Cyber Resilience Policy |
| Version | v1 |
| Effective date | 2026-05-27 |
| Approval authority | Board (Reserved Matter per ORG-GV-17); interim: CEO |
| Obligation closed | ORG-CY-10 |
| Legal anchor | Joint Standard 2 of 2024; NIST CSF 2.0 |

---

## 1. Purpose

This policy establishes the bank's cyber resilience objectives, governance structure, and control framework. It operationalises the requirements of Joint Standard 2 of 2024 (the "Cyber Standard") across the NIST CSF six functions.

---

## 2. Cyber resilience functions

### 2.1 Govern
- The Board approves the cyber-risk framework annually (Reserved Matter per ORG-GV-17).
- Helena (CRO) holds the risk-appetite mandate; Senna holds the technical implementation mandate.
- Cyber risk is embedded in the bank's RAS as RT-OP.CY.

### 2.2 Identify
- Asset inventory: all bank systems, data, and third-party connections catalogued in Senna's asset register.
- Threat modelling: per Secure SDLC Policy § threat-modelling gate.
- Vulnerability management: continuous scanning; critical/high findings escalated within 24 hours.

### 2.3 Protect
- Access controls: zero-trust architecture; MFA on all privileged access; RBAC per agent identity.
- Cryptography: FIPS 140-3 Level 3 for key material; BLAKE3 for document hashes.
- Secure SDLC: gated per `secure-sdlc-policy-v1.md`.

### 2.4 Detect
- Security event logging: all access, API calls, and admin actions logged to the event store.
- SIEM: ingestion from all substrates; alerts on anomalous patterns.
- Intrusion detection: network + host-based.

### 2.5 Respond
- Cyber incident response plan owned by Senna; activated by Senna on detection.
- Regulatory notification: Joint Standard 2 of 2024 §12 — notify PA within 24 hours of material cyber incident.
- Crisis management: escalate to COO and CEO for service-affecting incidents.

### 2.6 Recover
- RTO/RPO targets defined in the Operational Resilience Policy.
- Post-incident review within 5 business days; findings fed back to Identify/Protect controls.

---

## 3. Build-phase gaps (substrate roadmap)

| Gap | Owner | Activation |
|---|---|---|
| SIEM integration with Azure Sentinel | Senna | Pre-licence (cloud migration M8) |
| Formal cyber-risk appetite calibration in RAS | Helena + Senna | Pre-licence |
| PA notification runbook | Senna | Pre-licence |
