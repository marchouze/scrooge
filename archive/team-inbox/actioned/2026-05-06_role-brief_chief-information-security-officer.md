# Role brief — Chief Information Security Officer (CISO)

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan
**Authorising decision:** D3 (CEO approval, 2026-05-06).

## 1. Role title and one-line purpose

**Chief Information Security Officer (CISO)** — heads the second-line cyber-and-information-security function; named regulatory accountability under Joint Standard 1 of 2024 and POPIA s.22; reports to the CEO.

## 2. Why this role exists (and how it differs from Senna)

Senna is the **security engineer** — she threat-models, builds the secure-SDLC, runs key-management code, codes the IR runbooks, and engineers the detection pipelines. She is part of the first / second-line *build* team under Devon (interim) until the CISO seat is filled.

The **CISO** is the named *governance accountability*. The Joint Standard on Cybersecurity and Cyber Resilience (PA / FSCA Joint Standard 1 of 2024) places legal accountability on the bank's governing body and requires a named officer; POPIA s.22 places breach-notification accountability on the Information Officer (Iris) but the operational security accountability under POPIA s.19 sits with a security function head; SARB / PA cyber-incident reporting names a contact. Splitting these responsibilities across Atlas, Senna, Mira, and Iris is a category error — none of them holds the full named accountability. The CISO does.

The CEO confirmed (2026-05-06, D3) that this is the next governance hire after CAE.

## 3. Scope of work (priority order)

1. **Information-security and cyber-resilience policy ownership.** The CISO governs the InfoSec, Cyber Resilience, and IR policies (already in force in the policy bundle); Senna implements them; the CISO signs.
2. **Joint Standard 1 of 2024 programme.** Named accountability; coverage governance; reporting to PA / FSCA; board / Risk Committee reporting.
3. **POPIA security safeguards (sections 19–22).** Operational security; partnered with Iris on breach response; POPIA breach-notification workflow integrity.
4. **Threat-model and design-review gate.** Sign-off on threat models for new event types, APIs, integrations, and material changes. Senna runs the gate; the CISO sets the standards and reviews exceptions.
5. **Cyber and operational-resilience scenario testing.** TIBER-style intelligence-led testing programme; tabletop exercises; rehearsed runbooks; post-exercise findings reported to the Board / Risk Committee.
6. **Cryptographic-key governance.** Managed cloud HSMs at FIPS 140-2/3 Level 3; key-ceremony oversight; rotation policy; attestation review. Senna operates; CISO governs.
7. **Third-party and supply-chain security governance.** Vendor security assessments, SLSA-aligned supply-chain verification, dependency / SBOM governance. Devon handles outsourcing-policy mechanics; the CISO holds the security view.
8. **Incident command and regulator interface.** Named contact for SARB / PA / FSCA cyber-incident notifications; commands material cyber incidents; signs incident reports.
9. **Customer-facing security posture.** Strong-authentication standards (WebAuthn / FIDO2), session-binding, transaction-signing, fraud-signal feedback loops with Mira's monitoring (when customer-facing surfaces come online — note: build-only posture today, so customer-facing security is a *prepared* surface, not live).
10. **Combined-assurance interface with Vera + Thandiwe.** Continuous-controls evidence on security as a primary feed; the CISO consumes Vera's pipelines and signs the second-line opinion.

## 4. Direct reports (subject to CEO confirmation)

- **Senna** — security engineer. Today reporting to Devon on interim; on CISO arrival, Senna's reporting line moves to the CISO. Devon retains the broader operational-resilience seam; the CISO and Devon co-own the operational-resilience programme (CISO leads on cyber, Devon leads on broader operational resilience).
- A future deputy-CISO / detection-engineering lead is a likely M+12 hire as the bank scales; out of scope for the initial seat.

## 5. Required expertise

- CISO or deputy-CISO experience at a SA bank, regulated SA financial-services entity, or comparable regulated cloud-native institution at scale.
- Joint Standard 1 of 2024 implementation experience — has authored or led a programme against this standard.
- POPIA security-safeguards (sections 19–22) at named-officer or accountable-leader level; partnered relationship with an Information Officer.
- Cloud-native security architecture on a major hyperscaler (Azure preferred given the bank's M8 target — AWS or GCP acceptable with cross-credibility) — IAM, network policy, KMS/HSM, confidential computing.
- Application security at executive level — threat modelling discipline (STRIDE / LINDDUN), OWASP ASVS, secure-by-design APIs.
- Cryptographic-key governance — FIPS 140-2/3 Level 3 boundary design, HSM operations, rotation orchestration.
- Detection-engineering oversight — SIEM/EDR/XDR, anomaly detection, threat-intel, MITRE ATT&CK; not necessarily hands-on, but credible to Senna.
- Incident command — has run a regulator-reportable incident and survived the regulator response.
- Secure SDLC and supply chain — SLSA, sigstore, SBOMs.
- Trading-floor / market-infrastructure security awareness — given the strategic foundation, JSE / SAMOS / SWIFT connectivity, surveillance-pipeline integrity, and dealer-mandate-based authorisation are part of the surface.

## 6. Desirable expertise

- CISSP, CCSP, or equivalent.
- TIBER-EU / CBEST style intelligence-led red-team programme experience.
- SAMA / FSB / FCA equivalent regulator engagement (cross-credibility for SARB / PA).
- Trading-bank / capital-markets cyber-resilience track record.
- Familiarity with event-sourced architectures and projection-based assurance — comfortable with Senna's M-phase build approach.

## 7. Regulatory / certification requirements

- **Fit and proper** under PA / FSCA standards. The CISO is a designated person under regulator engagement on cyber and information security.
- Joint Standard on Cybersecurity and Cyber Resilience (Joint Standard 1 of 2024) — named accountability.
- POPIA — partnered relationship with the Information Officer (Iris) under sections 19–22.
- Banks Act 94 of 1990 — operational risk; cyber risk implementation.
- BCBS principles on operational and cyber risk.
- King IV Code on Corporate Governance for South Africa — IT governance principle.

## 8. Interfaces

- **CEO (Marc)** — administrative + functional reporting line.
- **Risk Committee (interim: Risk Forum chaired by Helena)** — material cyber-risk reporting; Joint Standard 1 of 2024 reporting cadence.
- **Audit Committee (interim: Audit Forum chaired by Owen) and Thandiwe (CAE)** — independent assurance over the cyber-resilience programme; CISO does not advise on third-line opinions.
- **Helena (CRO)** — second-line / second-line peer; cyber risk sits within the broader risk taxonomy; co-curates the cyber RAS metric.
- **Iris (IO)** — POPIA partnered relationship; co-owns the POPIA breach-notification workflow.
- **Devon (COO)** — operational-resilience programme co-ownership; CISO leads on cyber, Devon leads on broader OR.
- **Owen (CoSec)** — board / committee secretariat for cyber-resilience reporting.
- **Camille (CFO)** — material cyber events have financial-statement disclosure implications.
- **Zara (CCO)** — surveillance-pipeline integrity; market-abuse detection has a security dimension (insider access, log integrity).
- **Saskia (Head of Global Markets)** — trading-floor security; surveillance-feed integrity; dealer-mandate authorisation.
- **Senna (engineer; reports to CISO)** — engineers the security platform the CISO governs.
- **Vera (third line; under Thandiwe)** — continuous-controls evidence of cyber posture.
- **External auditors and regulators** — Joint Standard 1 of 2024, POPIA, SARB / PA cyber-incident reporting.

## 9. Build-only context (per D1, 2026-05-06)

The bank is in build-only posture during licence deferral. The CISO arrives into a build that has:
- No live customers, no live trading, no live counterparty surfaces.
- Synthetic data and simulated regulator endpoints.
- Full cyber-resilience programme being built and rehearsed against the design surface, ready to switch on at licence grant.

The CISO's first-90-days plan therefore focuses on: programme governance maturity, cyber-resilience scenario rehearsal cadence, supply-chain governance, and pre-licensing readiness — *not* live-incident response (which has nothing to respond to yet) but rehearsed readiness.

## 10. Success criteria — first 90 days

1. **InfoSec / Cyber Resilience / IR policies re-baselined** under CISO sign-off (the policies are in force; the CISO inherits and re-asserts them).
2. **Joint Standard 1 of 2024 programme map** drafted and presented to the Risk Forum.
3. **Threat-modelling gate** operating cleanly across the build pipeline; Senna's existing review process re-baselined under the CISO's sign-off.
4. **Cyber-resilience scenario test plan** for the build phase — a rehearsed-readiness programme covering simulated incidents, supply-chain compromise, key-rotation failure, regulator-notification path.
5. **Combined-assurance interface with Thandiwe** — security evidence pipelines feeding the third-line continuous-controls programme.
6. **Customer-facing security standards document** prepared for the post-licence surface (WebAuthn / FIDO2, session-binding, transaction-signing).
7. **Pre-licence security readiness gate** documented — the security pre-conditions for the bank to switch from synthetic-flow to live-flow operation.

## 11. Principle alignment

**P1 — Events as source of truth.** Security events (auth, key-rotation, IR incidents, threat-model approvals) are typed events; security posture at any as-of date is reproducible.

**P2 — Atomic citation discipline.** Every control, every threat-model approval, every IR runbook, every key-rotation event cites the obligations register entry that justifies it.

**P3 — Cloud-native, no manual.** No persistent operator credentials; all access just-in-time and event-recorded; key ceremonies orchestrated, not manual.

**P4 — Security designed in.** This role *is* P4's executive expression.

**P5 — Multi-everything.** Security architecture is per-entity, per-jurisdiction; new entities and jurisdictions are configuration.

**P6 — Single-graph discipline.** *Downward:* security reports (Joint Standard, POPIA, board cyber-resilience packs) are generated, not authored. *Upward:* every security capability traces to a procedure, policy, and regulation; no orphan security capabilities.

## 12. Sources consulted

- Joint Standard on Cybersecurity and Cyber Resilience (PA / FSCA Joint Standard 1 of 2024).
- POPIA — sections 19–22 (security safeguards) and section 22 (breach notification).
- Banks Act 94 of 1990 and Regulations Relating to Banks — operational and cyber risk.
- BCBS — Principles for the sound management of operational risk; operational-resilience guidance.
- King IV Code on Corporate Governance for South Africa.
- ISO/IEC 27001, NIST CSF 2.0 — control frameworks the bank's posture aligns to.
- Existing security-engineer role brief (`Team Inbox/2026-05-05_role-brief_security-engineer.md`) — the engineering substrate the CISO governs.
- `Owner Inbox/2026-05-06_core-policies-infosec-ops.md` — InfoSec, Cyber Resilience, IR policies in force.
- `Owner Inbox/2026-05-06_strategic-foundation.md` — institutional global-markets bank context.
- `Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md` — build-only context.
