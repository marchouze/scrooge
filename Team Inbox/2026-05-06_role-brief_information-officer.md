# Role brief — Information Officer (POPIA / Privacy)

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan

## 1. Role title and one-line purpose

**Information Officer** — named statutory officer under POPIA section 56; governance owner of the bank's privacy and personal-information programme; data-protection authority with direct line to the Information Regulator.

## 2. Why this role exists

POPIA (Protection of Personal Information Act 4 of 2013) section 56 designates an Information Officer with statutory duties under sections 55 and 56 and the Regulations. By default the Head of the Body (i.e. the CEO) holds the duties unless designated otherwise. POPIA Regulation 4 prescribes the responsibilities — compliance with POPIA, dealing with the Regulator, internal awareness, manual under PAIA. In a fully coded bank with field-level encryption, projection-based access patterns, and continuous-KYC ingestion of personal data, this is a substantive seat, not a designation tag-on.

The CEO has confirmed (2026-05-06) that the Information Officer is to be a separate hire rather than defaulting to the CEO. This recognises (a) the substantive workload of a privacy programme in a coded bank, (b) the conflict that arises if the same person who runs the bank's data activities also adjudicates them, and (c) regulator credibility — the Information Regulator engages a named officer who can answer them substantively.

## 3. Scope of work (priority order)

1. **POPIA programme governance.** Lawful-processing register, purpose register, retention schedule, consent and notice governance, cross-border transfer controls under section 72, lawful-processing-of-special-personal-information, processing of children's data under section 35.
2. **Information Regulator engagement.** Named contact; prior authorisation submissions where required (sections 57 / 58); breach notifications under section 22; Regulator inquiries; enforcement matters.
3. **Data-subject rights.** Process for access (section 23), correction (section 24), deletion, objection (section 11(3)), automated-decision-making rights (section 71). Operationalised as queries (P3) and event-driven workflows.
4. **PAIA manual.** The Promotion of Access to Information Act manual under section 51; coordinated with Owen (Company Secretary).
5. **Privacy-by-design gating.** Every new data flow, projection, integration, or product passes a privacy review before it ships. Iris co-gates with Senna (security) and Helena (risk).
6. **Breach-notification programme.** The automated POPIA breach-notification workflow runs out of Senna's IR programme; Iris owns the regulator-facing aspect — what counts as a notifiable breach, the timing, the content, the data-subject communication.
7. **Privacy Impact Assessments (PIAs).** PIA framework, when triggered, who participates, who signs.
8. **Vendor / processor governance.** Operator agreements under section 21, due diligence on processors, sub-processor approvals.
9. **Cross-border transfer governance.** Transfers under section 72 — adequate-protection assessments, BCRs, contractual safeguards, regulator notifications where applicable. Aligned with SARB Directive 3 of 2018 on cloud / offshoring.
10. **Privacy training and awareness.** Internal programme; coordinated with Sade for HR onboarding.

## 4. Required expertise

- POPIA Act 4 of 2013 and its Regulations — full working knowledge; sections 19–22 (security and breach), sections 23–24 (rights), sections 55–58 (Information Officer duties; prior authorisation), section 72 (cross-border).
- Information Regulator — practice, guidance notes, codes of conduct, enforcement track record.
- PAIA Act 2 of 2000 — manual obligations, requests handling.
- GDPR fluency — practical reference frame; many SA processors operate to GDPR standards.
- Privacy-by-design discipline at scale — how privacy controls live in code, projections, and pipelines.
- Cross-border transfer mechanics — BCRs, model clauses, adequacy assessments.
- Privacy-engineering literacy — pseudonymisation, differential privacy, masking, retention enforcement, lineage.
- Working understanding of POPIA's intersections with FIC Act (the FIC's lawful-processing pathway is a section 11 / 13 matter), FATCA/CRS, credit reporting, marketing, and employee data.

## 5. Desirable expertise

- Prior Information Officer / DPO at a SA bank, large fintech, or processor of significant SA personal information.
- IAPP CIPP/E and CIPM certifications (or equivalent), or LLM in privacy law.
- Track record of Regulator engagement, ideally including a notified breach handled to closure.
- Experience designing privacy programmes in event-sourced or projection-based architectures.
- Familiarity with POPIA Code of Conduct for the financial sector (BASA / FSCA pathways) when finalised.

## 6. Regulatory / certification requirements

- POPIA Information Officer designation lodged with the Information Regulator under POPIA Regulation 4(1)(a).
- Fit-for-purpose assessment under POPIA — sufficiently senior, sufficient resource, direct line to executive leadership.
- IAPP CIPP/E and/or CIPM strongly preferred.
- Working PAIA practitioner literacy.

## 7. Interfaces

- **CEO (Marc)** — appoints; the Information Officer's designation must be lodged with the Regulator.
- **Zara (CCO)** — POPIA-as-regulatory-compliance lives partly in Zara's seat; Iris and Zara co-govern, with Iris as the named Information Officer and Zara as the broader compliance authority.
- **Helena (CRO)** — privacy risk feeds into the risk taxonomy.
- **Senna (security engineer)** — security safeguards under sections 19–22; the IR pipeline; field-level encryption; the breach-notification workflow.
- **Anya (data / analytics engineer)** — data-minimisation, purpose binding, retention enforcement, lineage; Iris approves Anya's projection designs from a privacy lens.
- **Mira (compliance engineer)** — KYC / CDD personal-information dimension; section 11 / 13 lawful-processing pathway for AML purposes; cross-border transfer of compliance data to FATF-listed jurisdictions.
- **Imani (legal-as-code engineer)** — operator agreements, processor agreements, consent and notice clauses.
- **Owen (Company Secretary)** — PAIA manual; board reporting; Information Officer designation logistics.
- **Vera (internal audit engineer)** — independent third-line testing of the privacy programme.
- **Niko (sales / CRM engineer)** — consent capture, marketing preferences, customer-facing privacy notices.
- **Sade (HCM)** — employee personal-information; privacy training programme.

## 8. Success criteria — first 90 days

- Information Officer designation lodged with the Information Regulator.
- PAIA manual published and lodged.
- Lawful-processing register stood up; every existing personal-information processing activity entered with purpose, lawful basis, retention, recipients, transfers, and security safeguards.
- Data-subject-rights workflow live in the prototype: access, correction, deletion, objection.
- Breach-notification workflow rehearsed end-to-end with Senna.
- Privacy-by-design gate operating on new data flows; first design either approved with conditions or revised through it.
- Cross-border transfer assessment for the cloud-platform footprint completed (intersects SARB Directive 3 of 2018).
- Privacy training programme rolled out with Sade.
- Privacy-related obligations register entries signed off with Mira.

## 9. Principle alignment

**P1 — Events as source of truth.** Consents, notices, processing activities, data-subject requests, retention deletions, breach events — all events. Privacy posture at any past as-of date is reproducible. Consent withdrawal is an event with downstream propagation (Anya's projections respect it on replay).

**P2 — Traceability.** Every processing purpose, every retention period, every transfer mechanism cites the POPIA section and the lawful basis. The privacy programme is fully register-linked.

**P3 — Cloud-native, no manual.** Data-subject requests, retention enforcement, masking, lineage queries — coded workflows. PAIA requests handled as case-managed events. Manual response is a tracked exception.

**P4 — Security by design.** Iris and Senna co-own the data-protection / security boundary. Field-level encryption keys sized to retention obligations; access-audit projections are themselves a privacy artefact.

**P5 — Multi-everything.** Privacy regimes are jurisdictional — POPIA, GDPR, and others as the bank expands. The lawful-processing register dispatches on the data subject's jurisdiction, the controller's jurisdiction, and the processing location. New regimes enter as register entries.

## 10. Sources consulted

- POPIA Act 4 of 2013 and POPIA Regulations (2018).
- Information Regulator — guidance notes, codes of conduct, enforcement decisions, breach-notification practice.
- PAIA Act 2 of 2000 — manual requirements.
- IAPP — privacy-officer practice frameworks (CIPP/E, CIPM bodies of knowledge).
- GDPR — Articles 5, 6, 9, 13, 14, 17, 20, 25, 28, 32–34, 35, 44–49 — used as reference frame.
- SARB Prudential Authority — Directive 3 of 2018 on cloud computing and offshoring of data.
- BASA / FSCA — financial-sector POPIA Code of Conduct (where promulgated).
- BCBS / FATF — to the extent privacy interfaces with prudential and AML regimes.
