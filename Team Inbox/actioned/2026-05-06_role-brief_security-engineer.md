# Role brief — Security engineer (CISO function)

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan

## 1. Role title and one-line purpose

**Security engineer / CISO function** — owns the bank's security posture as a coded, continuously-asserted property of the platform; threat-models every design, runs the secure SDLC, and answers to the regulators on cyber resilience.

## 2. Why this role exists

Principle 4 makes security a foundational design constraint, not a layer added later. The Joint Standard on Cybersecurity and Cyber Resilience (PA / FSCA Joint Standard 1 of 2024) places legal accountability for cyber risk on the bank's governing body and requires a named person responsible. Splitting that accountability across Atlas (platform) and Mira (compliance) is a category error — Atlas builds, Mira evidences, and security must independently *challenge* both. POPIA sections 19–22 and breach-notification duties also need a single accountable owner.

## 3. Scope of work (priority order)

1. **Threat modelling as a gate.** No new event type, API, workflow, or external integration ships without an approved threat model and the controls that follow from it.
2. **Zero-trust identity and access.** Workload identity, just-in-time human access, session-binding, transaction-signing, WebAuthn / FIDO2 customer auth, key-rotation orchestration. No persistent operator credentials.
3. **Cryptographic key management.** Managed cloud HSMs at FIPS 140-2/3 Level 3 — key ceremonies, rotation, attestation, per-field encryption keys, customer-data envelope schemes.
4. **Secure SDLC.** SAST/DAST in CI, dependency and SBOM scanning, signed and reproducible builds, SLSA-aligned supply-chain verification, pre-merge security review for high-risk changes.
5. **Detection, response, and forensics.** Immutable audit logs, anomaly detection, intrusion detection, rehearsed incident-response runbooks, evidence preservation, post-incident review with register entries.
6. **Customer-facing security.** Strong authentication, fraud-signal feedback loops with Mira's monitoring, secure session and device telemetry, account-recovery design.
7. **Regulator and breach interface.** Automated POPIA breach-notification workflow (Information Regulator + data subjects), Joint Standard 1 of 2024 reporting, SARB / PA cyber-incident notifications.
8. **Continuous control assertion.** Security controls expressed as code with continuous attestation; Vera consumes the evidence as a continuous feed.

## 4. Required expertise

- Cloud-native security architecture on a major hyperscaler (AWS, Azure, or GCP) — IAM, network policy, KMS/HSM, confidential computing, private connectivity.
- Application security — threat modelling (STRIDE / LINDDUN), OWASP ASVS, secure-by-design APIs, mTLS, OAuth 2.1 / OIDC, mTLS workload identity (SPIFFE/SPIRE).
- Cryptography in production — AEAD primitives, envelope encryption, key hierarchies, HSM operations, FIPS 140-2/3 Level 3 boundary design.
- Detection engineering — SIEM/EDR/XDR, log pipelines, behavioural analytics, threat-intel ingestion, MITRE ATT&CK fluency.
- Incident response — IR command, evidence handling, regulator notification, customer comms.
- Secure SDLC and supply chain — SLSA, sigstore, SBOMs, dependency hygiene at scale.

## 5. Desirable expertise

- Prior CISO or deputy-CISO experience at a SA bank or large fintech.
- Hands-on experience with the Joint Standard on Cybersecurity (Joint Standard 1 of 2024) implementation programmes.
- POPIA breach-response leadership at a regulated entity.
- Red-team / adversary-simulation background; CBEST / TIBER-EU style intelligence-led testing.
- Experience standing up a Cyber Resilience programme aligned to BCBS 239, BCBS principles for operational resilience, and ISO/IEC 27001 / 27002.

## 6. Regulatory / certification requirements

- PA / FSCA Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience — full working knowledge.
- POPIA 4 of 2013, especially sections 19–22 and the breach-notification duty.
- BCBS principles on operational resilience and operational risk.
- ISO/IEC 27001 / 27002 / 27017 / 27018 / 27701 — designing to, not necessarily certifying.
- NIST CSF 2.0 — used as a reference framework.
- CISSP, CCSP, OSCP, or equivalent demonstrable practitioner credentials preferred.
- Fit-and-proper readiness — likely to be a "responsible person" under the Joint Standard.

## 7. Interfaces

- **Core platform architect (Atlas)** — co-designs platform primitives; security signs off on every new event type and API.
- **Compliance / RegTech engineer (Mira)** — POPIA programme, sanctions-screening integrity, financial-crime telemetry.
- **Operations & payments engineer (Tomas)** — payment-channel security, SWIFT CSP, ISO 20022 message protections.
- **Internal audit engineer (Vera)** — feeds continuous-controls evidence; Vera independently tests it.
- **HR systems engineer (Sade)** — joiner/mover/leaver, fit-and-proper, insider-risk controls.
- **Legal-as-code engineer (Imani)** — DPA / processor terms, breach-notification clauses, incident comms.

## 8. Success criteria — first 90 days

- A documented threat-model gate operating in the design review process, with at least one design rejected or revised through it.
- A workload-identity and JIT-access scheme live in the prototype, with no persistent operator credentials anywhere.
- HSM-backed key hierarchy in place for the event log and PII fields, with rotation rehearsed.
- CI gate enforcing SBOM, dependency-vulnerability budget, and signed-build provenance.
- IR runbook for a POPIA-notifiable breach rehearsed end-to-end, including the automated notification workflow.
- Joint Standard 1 of 2024 control map drafted and reconciled into Mira's obligations register.

## 9. Principle alignment

**P1 — Events as source of truth.** Security decisions (auth, authz, screening, key access) are themselves events. The security posture at any past moment is reproducible by replay. No "current security state" is stored as authoritative state.

**P2 — Traceability.** Every control links to an obligations-register entry — Joint Standard 1 of 2024, POPIA section, BCBS principle, internal policy version. The threat-model gate produces register-linked controls; otherwise the design does not pass.

**P3 — Cloud-native, no manual.** Key ceremonies, rotation, access provisioning, breach notification, and incident comms are coded workflows. Out-of-band steps are tracked exceptions with justification.

**P4 — Security by design.** This role *is* the operational expression of P4. Owns the threat-model gate, the SDLC controls, the detection-and-response pipeline, and the breach workflow.

**P5 — Multi-everything.** Identity, key residency, log residency, and breach-notification routing all dispatch on jurisdiction. Cross-border data flows have explicit security and POPIA-transfer controls. New jurisdictions add register entries; controls follow.

## 10. Sources consulted

- Prudential Authority and FSCA — Joint Standard on Cybersecurity and Cyber Resilience (Joint Standard 1 of 2024).
- SARB Prudential Authority — Directive 3 of 2018 on cloud computing and offshoring of data.
- Information Regulator — POPIA guidance and breach-notification practice.
- BCBS — Principles for Operational Resilience (2021); Principles for the Sound Management of Operational Risk (rev. 2021); BCBS 239.
- NIST — Cybersecurity Framework 2.0; SP 800-53 rev. 5; SP 800-207 (Zero Trust Architecture).
- ISO/IEC — 27001:2022, 27002:2022, 27017, 27018, 27701.
- FATF — guidance on virtual assets and supervision-relevant cyber typologies.
- SLSA framework documentation; CNCF security TAG outputs.
