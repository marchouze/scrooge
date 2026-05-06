# Core policies — Information security, cyber, operations

**Authors:** Senna (interim CISO function, with Devon as accountable executive); Devon (COO — operations lead); Atlas (platform engineering)
**Reviewed by:** Helena, Iris, Zara, Owen, Camille, Tomas, Vera
**Date:** 2026-05-06
**For:** Marc (CEO) — for inclusion in the next decision pack as Board-route approvals.

---

## 1. Information Security Policy

**Owner:** Senna (interim CISO: Devon) · **Approval:** BRC + Board · **Cadence:** Annual · **Citation:** POPIA ss.19–22; ISO/IEC 27001:2022; Joint Standard 1 of 2024.

### Purpose
The bank operates a defence-in-depth information-security posture aligned with Principle 4 (security by design).

### Principles
- **Zero trust** is the default — no network position, no service identity, no operator role gets implicit trust.
- **Least privilege** for humans and machines; access is just-in-time, narrowly scoped, recorded as events.
- **Encryption** in transit and at rest; per-field encryption for sensitive data; HSM-backed keys at FIPS 140-2/3 Level 3.
- **Authentication** is strong by default — WebAuthn / FIDO2 customer auth; transaction-signing for high-risk actions; mTLS workload identity.
- **Logging** is immutable; access to PII is itself audited as events.
- **Threat modelling** is a gate on every new event type, API, workflow, or external integration.

### Roles
Senna engineers; Devon is interim accountable; Iris co-governs the POPIA dimension; Vera audits.

### Breach
Any breach of a security control material to PII or financial integrity is a Critical event triggering IR.

#### Pre-board review
- **Proposer:** Senna (with Devon).
- **Challenged by:** Iris (POPIA s.19–22 alignment); Helena (operational-risk posture); Vera (control-evidence testability); Atlas (engineering feasibility of zero-trust at platform level).
- **Iteration:** minor — clarified WebAuthn / FIDO2 phasing for customer rollout.
- **Status:** Ready ✓

---

## 2. Cyber Resilience Policy

**Owner:** Senna (interim CISO: Devon) · **Approval:** BRC + Board · **Cadence:** Annual · **Citation:** Joint Standard on Cybersecurity and Cyber Resilience (PA / FSCA Joint Standard 1 of 2024); BCBS Operational Resilience.

### Purpose
The bank's posture on cyber resilience — preparing for, withstanding, recovering from, and learning from cyber incidents.

### Principles
- The cyber severity tier-model (B6 approved) is in force: T1 minor / internal; T2 moderate / Iris pre-screen; T3 major / Regulator pre-notification; T4 critical / Regulator + customer notification.
- Severity uplift always permitted; downgrade requires CRO concurrence.
- Threat intelligence ingested continuously; ATT&CK-aligned detection coverage tracked as KPIs.
- Annual rehearsal of severe-but-plausible cyber scenarios per IBS (intersects Operational Resilience Policy).
- Patch and vulnerability management is event-driven (separate Vulnerability Management Policy).
- Joint-Standard-required submissions to PA / FSCA on cyber-resilience capability are produced as queries (P6).

### Roles
Senna engineers; Devon is interim CISO accountable executive (per A2 — CISO is open governance seat); Helena holds risk appetite; Iris on POPIA-breach interface.

### Breach
T3 / T4 incidents trigger Regulator notification per Joint Standard 1 of 2024.

#### Pre-board review
- **Proposer:** Senna (with Devon).
- **Challenged by:** Iris (POPIA-breach interaction); Zara (regulator-engagement pathway); Helena (appetite); Vera (rehearsal evidence design); Tomas (payments-incident scenarios).
- **Iteration:** minor — added ATT&CK detection-coverage KPI.
- **Status:** Ready ✓ (B6 approved 2026-05-06).

---

## 3. Incident Response Policy

**Owner:** Senna (with Iris and Zara) · **Approval:** BRC · **Cadence:** Annual · **Citation:** Joint Standard 1 of 2024; POPIA s.22; BCBS Operational Resilience.

### Purpose
Sets the bank's IR command structure, severity model, decision rights, evidence-handling, regulator and customer comms, and post-incident review.

### Principles
- IR is a **rehearsed command function**, not a runbook. Senna runs incident command for security events; Tomas for payments; Helena escalates to BRC / CEO.
- Severity tiering per Cyber Resilience Policy (B6); equivalent tiering for non-cyber operational incidents.
- Evidence-handling is forensically sound from minute one — chain of custody is a typed event.
- POPIA-notifiable breaches trigger Iris's regulator-facing workflow; tipping-off prohibitions on FIC matters preserved.
- Post-incident review (PIR) within 14 days; lessons feed change-management and policy updates.

### Roles
Senna runs cyber IR; Tomas runs payments incidents; Iris owns regulator-facing privacy-breach comms; Devon is interim CISO accountable.

### Breach
Failure to comply with IR procedures is itself a registered event subject to PIR.

#### Pre-board review
- **Proposer:** Senna (with Iris, Zara).
- **Challenged by:** Helena (escalation discipline); Owen (board-pathway in T4 scenarios); Vera (evidence-handling testability).
- **Iteration:** minor — added 14-day PIR commitment.
- **Status:** Ready ✓

---

## 4. Outsourcing & Third-Party Risk Policy

**Owner:** Devon · **Approval:** Board · **Cadence:** Annual · **Citation:** SARB Prudential Authority Directive 3 of 2018 on cloud computing and offshoring of data.

### Purpose
Sets the bank's discipline for engaging third-party providers and for outsourcing material activities — pre-engagement assessment, ongoing monitoring, exit, and regulator-notifications under Directive 3.

### Principles
- A typed **outsourcing register** maintained per Directive 3: every service, processor, sub-processor, with data residency, criticality, exit plan, and obligations-register citations.
- **Material outsourcing** is Board-reserved; non-material is delegated to BRC.
- Pre-engagement: due diligence, risk assessment, contractual safeguards (Imani drafts), security review (Senna gates), POPIA review (Iris), exit-plan documented.
- Ongoing: SLA monitoring as projections; material-incident reporting; annual re-assessment.
- Sub-processor approvals trace upward; new sub-processors require notification to Iris and the Outsourcing register.
- Regulator notification under Directive 3 timelines is a coded workflow.

### Roles
Devon owns; Senna gates security; Iris co-reviews POPIA; Imani drafts contracts; Atlas + Senna co-own the Outsourcing register.

### Breach
Engaging a material outsource without Board approval is a Critical event.

#### Pre-board review
- **Proposer:** Devon.
- **Challenged by:** Senna (security-review gate); Iris (cross-border / s.72 implications); Imani (contractual safeguards); Owen (Board-pathway clarity); Vera (register completeness).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## 5. Cloud Computing Policy

**Owner:** Devon (with Senna, Iris) · **Approval:** Board · **Cadence:** Annual · **Citation:** SARB Directive 3 of 2018; POPIA s.72; ISO/IEC 27017.

### Purpose
The bank operates cloud-natively (Principle 3). This policy sets the discipline.

### Principles
- Infrastructure is code-defined and version-controlled (IaC).
- No persistent operator credentials; access is just-in-time and audited.
- Data residency: SA-resident by default for SA customer data; Directive-3-compliant deviations registered with rationale.
- Encryption keys are bank-controlled (BYOK / HYOK) for sensitive data tiers; HSM-backed.
- Cloud egress and inter-region data flows are inventoried; cross-border transfers under s.72 are documented.
- Region failures are designed for; cross-region redundancy aligned to Operational Resilience impact tolerances.

### Roles
Devon owns; Atlas implements IaC; Senna gates security architecture; Iris on POPIA s.72.

### Breach
Unauthorised data residency change or persistent-credential creation is a Critical event.

#### Pre-board review
- **Proposer:** Devon.
- **Challenged by:** Senna (key-control architecture); Iris (POPIA s.72 mapping); Atlas (IaC discipline reality); Vera (residency-attestation testability).
- **Iteration:** minor — clarified BYOK / HYOK tiering by data classification.
- **Status:** Ready ✓

---

## 6. Business Continuity & Disaster Recovery Policy

**Owner:** Devon · **Approval:** BRC · **Cadence:** Annual · **Citation:** BCBS Operational Resilience (2021); King IV; Companies Act.

### Purpose
The bank can deliver important business services (per Operational Resilience Policy) through severe-but-plausible disruption and recover within stated impact tolerances.

### Principles
- BCP / DR is anchored on the IBS inventory and impact tolerances.
- Recovery time / point objectives (RTO / RPO) are calibrated per IBS and tested.
- Cross-region / cross-zone redundancy is the architecture default; manual failover is an exception requiring a tracked variance.
- Annual full-scale DR test per IBS; quarterly partial tests.
- Vendor BCP capabilities are part of Outsourcing due diligence.
- BCP / DR results are events; remediation is tracked through to closure.

### Roles
Devon owns; Atlas + Tomas + Anya co-own technical implementation; Vera audits.

### Breach
Failure of DR test or material recovery beyond impact tolerance is a Critical event.

#### Pre-board review
- **Proposer:** Devon.
- **Challenged by:** Tomas (payments-IBS specifics); Atlas (architecture realism); Senna (security continuity in DR); Vera (test-evidence integrity).
- **Iteration:** minor — clarified quarterly partial-test scope.
- **Status:** Ready ✓

---

## 7. Records Management Policy

**Owner:** Owen (with Devon) · **Approval:** Board · **Cadence:** Annual · **Citation:** Companies Act 71 of 2008; FIC Act s.22; POPIA s.14; SARS Tax Administration Act; FAIS record-keeping.

### Purpose
The bank's discipline on creation, retention, retrieval, and disposal of records — corporate, customer, financial, regulatory.

### Principles
- Retention schedules per record class are codified; the longest applicable retention obligation prevails.
- Records are maintained in the bank's systems (P3) — paper or external systems are exceptions registered in the Outsourcing register.
- Disposal is a typed event with cryptographic verification where applicable.
- Legal-hold supersedes retention schedule; legal holds are typed events governed by Imani.
- Auditor and regulator access to records is provided in machine-readable form by default.

### Roles
Owen owns; Devon co-implements through the platform; Imani governs legal holds; Iris governs personal-information retention.

### Breach
Premature disposal or failure to produce a record under regulatory / legal request is a Critical event.

#### Pre-board review
- **Proposer:** Owen (with Devon).
- **Challenged by:** Imani (legal-hold consistency); Iris (POPIA retention overlap); Camille (financial-record retention under Companies Act / Tax Admin Act); Vera (auditor-access provision).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## 8. Change Management Policy

**Owner:** Devon (with Atlas) · **Approval:** BRC · **Cadence:** Annual · **Citation:** ITIL 4; BCBS Operational Risk; SRE practice.

### Purpose
Changes to the bank's systems are made deliberately, traceably, and reversibly.

### Principles
- Change is event-driven: every change is a typed event with proposer, reviewer, approver, deployment timestamp, post-deployment verification.
- Standard / normal / emergency change classes; standard changes are pre-authorised within the DoA; emergency changes require post-hoc review.
- High-risk changes (RAS-impacting, regulatory-reporting-impacting, IBS-impacting) require BRC awareness.
- Reversibility is a design property — a change that cannot be reversed is registered as a tracked deviation.
- Post-deployment verification is automated where possible; manual verification is itself a typed event.

### Roles
Devon owns; Atlas implements the change-event system; Senna gates security-relevant changes; Vera audits.

### Breach
Unapproved change or change without rollback path is a registered event escalated per severity.

#### Pre-board review
- **Proposer:** Devon (with Atlas).
- **Challenged by:** Senna (security-relevant change gating); Tomas (payments-change risk); Helena (operational-risk impact); Vera (audit-trail testability).
- **Iteration:** minor — clarified emergency-change post-hoc review timing.
- **Status:** Ready ✓

---

## Bundle status

| # | Policy | Status |
|---|---|---|
| 1 | Information Security Policy | **Ready ✓** |
| 2 | Cyber Resilience Policy | **Ready ✓** (B6 approved) |
| 3 | Incident Response Policy | **Ready ✓** |
| 4 | Outsourcing & Third-Party Risk Policy | **Ready ✓** |
| 5 | Cloud Computing Policy | **Ready ✓** |
| 6 | Business Continuity & DR Policy | **Ready ✓** |
| 7 | Records Management Policy | **Ready ✓** |
| 8 | Change Management Policy | **Ready ✓** |

All eight pre-board-reviewed and ready for the next decision pack.
