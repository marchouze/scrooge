# POPIA s.19–22 walkthrough — for the CISO

**From:** Iris (Information Officer, s.56)
**To:** Rashida (CISO)
**Cc:** Senna (security engineer, prior interim counterpart); Owen (CoSec); Helena (CRO); Zara (CCO); Devon (COO); Vera (internal audit engineer).
**Date:** 2026-05-07
**Authority:** `Team Inbox/actioned/2026-05-06_brief_ciso-onboarding-senna-iris.md` (the "for Iris" handover).
**Posture context:** D1 build-only — synthetic personal data only; no live data subjects under processing yet. The s.19–22 obligations apply nonetheless, because the *processing of synthetic personal data* still attracts security-safeguard discipline on the substrate.

---

## 0. Purpose

A single document that gives you the operational-security surface POPIA s.19–22 places on the bank, with citations, current-state, the partnered-relationship I am asking you to take from Senna, and the four practical hand-shakes I need from you in your first weeks.

This is not a re-statement of my s.56 accountability. That stays with me. What changes is the **named regulator-facing counterpart for s.19–22** in the cyber path — Senna (interim) → you (permanent).

---

## 1. The four sections, in plain terms

POPIA Chapter 3, Part A — Conditions for Lawful Processing — sets the security floor. Sections 19–22 are the operational conditions the security function must satisfy. I will state each condition in its own words, then anchor it to the engineering surface.

**s.19 — Security safeguards.** A responsible party must secure the integrity and confidentiality of personal information by taking appropriate, reasonable technical and organisational measures. The measures must (a) identify reasonably foreseeable internal and external risks, (b) establish and maintain appropriate safeguards against the identified risks, (c) regularly verify that the safeguards are effectively implemented, and (d) ensure the safeguards are continually updated in response to new risks.

**s.20 — Information processed by operator (processor).** A responsible party must, by written contract, ensure any operator establishes and maintains the s.19 security measures and processes the information only with the responsible party's knowledge or authorisation.

**s.21 — Notification of security compromises.** Where there are reasonable grounds to believe that personal information has been accessed or acquired by an unauthorised person, the responsible party must notify (i) the Information Regulator and (ii) the data subject(s), unless their identity cannot be established. The notification must be in a prescribed form, as soon as reasonably possible, and contain sufficient information to enable the data subject to take protective measures.

**s.22** — Notification requirements (form, timing, content) — administered with s.21.

These four sections together produce an operational-security control set with a notification workflow attached. The control set lives in the security function. The workflow lives in mine. The seam between them is what we are formalising today.

---

## 2. Lawful-processing register — security-relevant entries

The register holds every processing purpose with: legal basis (s.11), processing categories (special / children's / general), data flows, retention schedule, cross-border path (if any), and the s.19 safeguards applied. Each entry cites the obligations register so the chain back to POPIA is testable.

Security-relevant categories already registered (synthetic data only today — same shape live):

| Purpose | Special category? | Cross-border? | s.19 safeguard summary |
|---|---|---|---|
| Customer onboarding (institutional KYC) | Identity-document data is special | No | Field-encryption with HSM-bound keys; access-by-purpose; audit events on every read |
| AML / sanctions screening | Sanctions-list match flags | No (lists are pulled in; no PI sent out) | Read-only enclave; result events do not carry source PI |
| FATCA / CRS reporting | Tax-residency self-cert | Yes (SARS → US IRS / OECD CTS) | Encrypted at rest; transmission over SARS eFiling; cross-border path registered |
| Employee data (Sade's substrate) | Yes (health, race for EE, biometrics if used) | No (today) | Per-field encryption; segregation from customer data; separate key-domain |
| Director / FAP fit-and-proper | Yes (fingerprints / criminal-record checks) | No | Same as employee, plus regulator-disclosure events |
| Marketing / direct-marketing | No | No (today) | Consent events; opt-out is a state on the data subject |
| Customer-service interactions | Voice (special, if biometric) | No | Recording is event-bound; transcription happens in enclave |

Items I would like your view on as part of the walkthrough:

- The cross-border FATCA / CRS path under SARB Directive 3 of 2018 — the technical encryption-in-transit and signing controls sit in your standard; the legal-basis chain sits in mine.
- The enclave-vs-purpose model for sanctions screening — Mira's design relies on the enclave. I want your standard recorded against it.

---

## 3. Breach-notification workflow (s.21 / s.22) — what is built

The workflow is automated end-to-end. The trigger is a `personal-information.compromise.suspected` event raised either by the detection pipeline (Senna's substrate, soon yours) or by a human actor (any operator, customer-service, or external party reporting an incident).

The workflow then runs the following coded steps:

1. **Severity-and-scope assessment.** A typed actor (today: me + Senna; future: me + you, with the security path as the technical lead) evaluates whether there are reasonable grounds. Outcome event: `compromise.assessment.complete`.
2. **Containment & forensic preservation.** This is your path. The workflow waits for `containment.confirmed` and `forensic-snapshot.taken` events from your function before proceeding to notification.
3. **Information Regulator notification (s.22).** The workflow generates the prescribed-form notification from structured data (no manual assembly — Principle 6 downward). I sign it as Information Officer; Owen co-witnesses.
4. **Data-subject notification (s.22).** Generated per affected subject from the same structured data; channel is the registered communication channel for the subject; an event is emitted on dispatch and on delivery confirmation.
5. **Post-incident reconciliation.** The combined-assurance record is closed only when the s.21 timing requirement, the data-subject coverage requirement, and the s.19 corrective-action requirement are all evidenced as events.

Procedure file: `Procedures/popia-breach-notification.md`. Joint-tabletop log: 2026-04. Co-owners: Iris (workflow) + Senna (containment/forensics) — handing the second seat to Rashida.

**The two clocks the workflow tracks separately.**

- *POPIA s.21 clock.* "As soon as reasonably possible" after grounds for belief. We measure this from `compromise.assessment.complete` to dispatch — and surface delays explicitly with cause.
- *Joint Standard 1 of 2024 clock.* Regulator notifications under JS 1/2024 (PA / FSCA cyber-incident reporting) run on a parallel path — your function is the named owner, mine is the witness. The two paths share the same incident record so the narrative reconciles.

---

## 4. Cross-border transfer governance

Two regimes apply simultaneously and must both be satisfied before any cross-border processing.

**POPIA s.72** — restrictions on transfer of personal information outside the Republic. Permissible only if (a) the recipient is subject to a law / binding corporate rules / binding agreement providing an adequate level of protection, (b) the data subject consents, (c) the transfer is necessary for the performance of a contract, (d) the transfer is for the benefit of the data subject and consent is impractical, or (e) the transfer is necessary for performance of a contract concluded in the data subject's interest.

**SARB PA Directive 3 of 2018** — cloud computing and offshoring of data. Notification, risk assessment, contractual provisions on data-access by foreign authorities, exit-plan, and continued PA access to data and systems for supervisory purposes.

Current cases on the register (synthetic data only):

- **FATCA / CRS submissions.** SARS is the primary recipient; onward flow to IRS / partner CRS jurisdictions is on the OECD framework. POPIA basis: s.72 — necessary for performance of a legal obligation. Directive 3 status: pre-licence registration with PA prepared, lodged on licence-grant. Security: encryption-in-transit with SARS-published certificates; signing per SARS spec; audit events on every submission.
- **Cloud target — Microsoft Azure (production).** POPIA s.72 path: contractual + adequacy + Microsoft's BCR-style commitments + technical safeguards (Customer-Managed Keys, Confidential Computing, region-pinning to South Africa-North primary with paired secondary). Directive 3: full cloud-and-offshoring submission lodged on licence-grant; PA exit-plan in the runbook.

I would like your standard recorded against the cloud-target case in particular — the technical safeguards listed above are mine to assert; the *adequacy of those safeguards* against your view of the threat model is yours to assert.

---

## 5. The operational-security control set you are inheriting

These are the controls I, as Information Officer, have been treating as sitting in the security function — i.e. controls whose evidence I rely on but whose ownership is yours. The interim arrangement with Senna covered these informally; the handover formalises them.

| Control | What I rely on for my s.19 statement | Current evidence form |
|---|---|---|
| Encryption at rest, per-field for sensitive PI | Coverage of all special-category fields | Schema-registry attribute + key-bind event |
| Encryption in transit, every internal hop | mTLS everywhere; no plaintext PI on the wire | Service-mesh enforcement events |
| Key-domain segregation by purpose | No cross-purpose key reuse | Key-issuance events with purpose tag |
| Access-by-purpose | Read of sensitive PI requires a typed purpose declaration | Access events carry purpose; misuse is detectable |
| Audit-log integrity | Events are tamper-evident; cannot be silently rewritten | Hash-chained event log + periodic third-party witness |
| Network segmentation | Sensitive-data zones are isolated; egress controlled | IaC policy-as-code + observed flows |
| Workstation hygiene | DLP + EDR on operator endpoints | Endpoint events into the detection pipeline |
| Vendor / processor security under s.20 | s.20 written-contract pack is template + register | Contract-register events; vendor-onboarding gate |

For each row, the control is in place on synthetic substrate. What I would like from you is a standard against which the *adequacy* of the control is asserted — not the existence.

---

## 6. The four hand-shakes I need from you

1. **A 60-minute walkthrough**, jointly with me — already scheduled per the brief — using §§ 2, 3, 4, 5 above as the agenda.
2. **A standing quarterly s.19–22 review.** Rashida + Iris + Senna. Output is a register entry for the cycle; combined-assurance record updated.
3. **A breach-event protocol** that lights up automatically when `personal-information.compromise.suspected` is raised — your function on the operational-security command path, mine on the data-subject and Information-Regulator notification path, both feeding the same incident record with shared timestamps.
4. **Joint sign-off on the cross-border safeguards** for the Azure cloud target (§4) — your standard recorded against my legal-basis chain — so that the lift from local to Azure does not surface a fresh adequacy debate.

E1 — POPIA Information Officer designation lodgment with the Information Regulator — is unaffected by this handover. My options paper to the CEO (who designates) covers the s.56 question (CEO retains / Iris / Owen / future hire). The s.19–22 partnered relationship is independent of the s.56 designation outcome.

---

## 7. What does not change

- s.56 Information Officer accountability — mine.
- Lawful-processing register, DSAR pathway, PAIA manual, cross-border governance authoring — mine.
- Workflow ownership (breach notification, data-subject rights, regulator engagement on POPIA matters) — mine.

What changes is the **named technical counterpart** on the s.19–22 surface. Senna remains the engineering substrate owner; you become the named CISO standard-setter and regulator-facing counterpart on the cyber path.

—Iris
