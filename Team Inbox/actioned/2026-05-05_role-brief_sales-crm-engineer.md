# Role brief — Sales / CRM engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Sales / CRM engineer** — designs the lead-to-client lifecycle, FAIS-compliant advice and disclosure capture, and the pipeline that hands clean clients to compliance for onboarding.

## 2. Why this role exists

A global-markets bank acquires clients through relationships and through digital flows. Both must be captured, FAIS-compliant where advice is given, and connected to onboarding without manual re-keying. This role owns that surface so sales productivity and conduct evidence are produced together by construction.

## 3. Scope of work (priority order)

1. Lead and prospect capture — inbound digital, outbound RM-driven, partner referrals.
2. Suitability and appropriateness — risk-profiling, knowledge-and-experience capture for FAIS Category I/II as applicable.
3. Advice records — what was recommended, why, on what evidence, with what fee.
4. Fee disclosure — pre-contractual, ongoing, and at every change; aligned with FAIS conduct standards.
5. Onboarding orchestration — clean hand-off to compliance for KYC/CDD with no data re-entry.
6. Pipeline, forecasting, and attribution — for management.
7. Complaints, conflicts, and gifts-and-entertainment registers — sales-team-facing capture.
8. Marketing communications — opt-in, frequency, content approval workflow with legal and compliance.
9. Client servicing flows — change-of-mandate, fee renegotiation, off-boarding.

## 4. Required expertise

- CRM platform design (Salesforce Financial Services Cloud, Microsoft Dynamics, HubSpot — patterns matter even if we build in-house).
- FAIS conduct framework as it shows up in software (advice records, suitability, disclosures).
- Marketing-automation and consent management under POPIA.
- Pipeline and revenue analytics.
- Integration patterns into KYC/onboarding without data duplication.

## 5. Desirable expertise

- Wealth-management or institutional-sales platform experience.
- Familiarity with FSCA Conduct Standard for Banks (when finalised under COFI / current draft) and the FAIS General Code of Conduct.
- Experience with sales-incentive design that survives PA remuneration scrutiny.

## 6. Regulatory / certification requirements

- FAIS Act 37 of 2002 — General Code of Conduct, Determination of Fit and Proper Requirements.
- POPIA — Direct Marketing provisions and consent.
- Consumer Protection Act 68 of 2008 (where it applies).
- National Credit Act 34 of 2005 (only if any credit products are offered — flag with Scrooge if so).
- FSCA Conduct Standards as applicable.
- FAIS RE 5 representative qualification and product-specific qualifications for any role giving advice.

## 7. Interfaces

- **Compliance engineer** — onboarding hand-off; FAIS records consumed for monitoring.
- **Legal-as-code engineer** — client agreements, disclosures, consents.
- **Core platform architect** — customer master is the destination of qualified leads.
- **Trading systems engineer** — institutional client mandates and access entitlements.
- **HR engineer** — sales-incentive plans and rep registers.

## 8. Success criteria — first 90 days

- A documented lead-to-client lifecycle with every state, transition, and required record.
- A working suitability + disclosure capture flow that produces a FAIS-compliant advice record automatically.
- Clean onboarding hand-off to compliance with no re-entry.
- Pipeline analytics live for Marc.
- POPIA-compliant marketing-consent register live.

## 9. Principle alignment

**P1 — Events as source of truth.** Pipeline state, conversion analytics, advice records, and consent state are projections of interaction events: lead captured, contact made, advice given, suitability assessed, fee disclosed, consent granted or withdrawn. A FAIS advice record is reconstructible at any moment because every input event is immutable and time-stamped.

**P2 — Traceability.** Every disclosure, suitability question, fee statement, and marketing-consent capture cites the FAIS General Code, FSCA standard, POPIA section, or CPA provision it implements. Sales-incentive rules cite the PA remuneration directive they comply with.

**P3 — Cloud-native, no manual.** Lead capture, suitability, advice, fee disclosure, and onboarding hand-off are all in-system. No paper application forms; no out-of-band fee letters. Where a client legitimately requires a physical document, it is rendered, dispatched, and tracked as a registered exception.

**P4 — Security by design.** Prospect and client data are least-privileged by salesperson and team. Advice records are tamper-evident — once captured they cannot be silently altered. Marketing-consent state is cryptographically attributable. Anti-impersonation controls protect high-value client interactions.

**P5 — Multi-everything.** Pipeline is segmented by jurisdiction and entity. Products are only offered into jurisdictions where the bank holds the relevant licence, enforced by code. Suitability questionnaires dispatch on client jurisdiction and product. Fees are quoted in client currency.

## 10. Sources consulted

- FAIS Act 37 of 2002 and General Code of Conduct.
- FSCA Determination of Fit and Proper Requirements.
- FSCA Conduct Standards (issued and draft).
- Information Regulator — POPIA Direct Marketing guidance.
- Consumer Protection Act 68 of 2008.
- National Credit Act 34 of 2005 (if applicable).
- FSCA Banks Conduct Standard (draft / final as published).
