# Role brief — Legal-as-code engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Legal-as-code engineer** — turns the bank's legal surface (contracts, terms, disclosures, consents, corporate documents) into structured, versioned, machine-actionable artefacts that drive both the product and the legal record.

## 2. Why this role exists

Banks accumulate paper. Each piece of paper carries obligations: who owes whom, on what terms, under which jurisdiction, with which collateral. A fully online bank should treat each of those as a typed object, version-controlled, with a current state queryable by every other team. Otherwise compliance, ops, and risk are continually re-reading PDFs.

## 3. Scope of work (priority order)

1. Contract templates and clause library — modular, parameterised, with controlled variation.
2. Master agreements and protocol management — ISDA Master, CSA, GMRA, GMSLA, PB agreements; protocol adherence (e.g. ISDA fallbacks, IBOR transition residue).
3. Customer-facing terms — onboarding agreements, terms of service, fee schedules, risk disclosures, FAIS-mandated disclosures, complaints processes.
4. Consent and disclosure capture — POPIA consents, marketing opt-ins, cookie / device-data, FATCA/CRS self-certifications.
5. Corporate documents — entity register, board resolutions, delegations of authority, signing matrix, mandates.
6. Signature and execution — electronic signature under ECTA, audit-grade evidence chain.
7. Contract lifecycle — drafting, negotiation redlines, execution, renewals, breaches, terminations.
8. Legal entity hierarchy and cross-border arrangements (relevant for global-markets activity).
9. Litigation and dispute register, with privilege protections.

## 4. Required expertise

- South African contract law, banking and financial-services legal practice.
- Master-agreement architecture, particularly ISDA and GMRA mechanics.
- Document-modelling — markup, taxonomies, clause libraries, machine-readable contracts.
- Identity, signature, and evidentiary standards for electronic execution.
- Privacy law as it intersects with contract data (POPIA in particular).

## 5. Desirable expertise

- Admitted attorney with banking-and-finance practice.
- Familiarity with CLM platforms (Ironclad, Icertis, ContractPodAi, DocuSign CLM) — even when building in-house, the patterns matter.
- ISDA Common Domain Model.
- Akoma Ntoso / LegalRuleML for legislative-style structuring.

## 6. Regulatory / certification requirements

- Electronic Communications and Transactions Act 25 of 2002 — for valid electronic signature and data messages.
- POPIA — for consent and data-subject information.
- FAIS — for advice records and disclosures.
- Companies Act 71 of 2008 — for board and corporate-document obligations.
- LSSA / Legal Practice Council admission preferred where the role spans into in-house counsel.

## 7. Interfaces

- **Compliance engineer** — disclosure obligations, FAIS records, FIC consents.
- **Sales/CRM engineer** — onboarding-flow contracts and disclosures.
- **HR engineer** — employment contracts and policy library.
- **Trading systems engineer** — ISDA/CSA terms drive collateral and netting logic.
- **Operations engineer** — payment authority and signing-matrix lookups.
- **Internal audit engineer** — evidentiary chain on signed documents.

## 8. Success criteria — first 90 days

- A clause library and template inventory, versioned and queryable.
- One end-to-end customer agreement issued, executed, and stored as a structured object — not a PDF blob.
- Signing matrix and corporate-document register live.
- ISDA Master + CSA template path agreed for the trading desk.
- POPIA consent and FAIS disclosure capture wired into the onboarding flow.

## 9. Principle alignment

**P1 — Events as source of truth.** Contract state is a projection of contract events: drafted, negotiated, executed, varied, novated, terminated. The "current" version of any agreement, fee, or consent is a query at a moment; historical states are first-class. PDFs are renderings, not authoritative state.

**P2 — Traceability.** Every clause, fee, disclosure, and consent links to its source — either a regulator (FAIS, ECTA, POPIA, FIC Act, Companies Act) or a master-agreement reference (ISDA section, GMRA paragraph, internal policy version). Clause libraries are register-managed.

**P3 — Cloud-native, no manual.** Electronic signature is the default under ECTA. Wet signatures are reserved for ECTA Schedule 1 exclusions and counterparties who genuinely cannot transact electronically; each instance is a registered exception. Document storage is cloud-native, encrypted, and key-managed.

**P4 — Security by design.** Signing keys live in HSM. Document integrity is hashed and timestamped at execution. Privileged communications are stored under stricter access policy with separate keying. Negotiation redlines are themselves event-recorded — provenance is provable.

**P5 — Multi-everything.** Contract templates are parameterised by governing law and jurisdiction. The legal-entity hierarchy is canonical and shared with accounting, risk, and operations. Cross-border master agreements (cross-border ISDA + CSAs, GMRA cross-border annexes) are first-class.

## 10. Sources consulted

- Electronic Communications and Transactions Act 25 of 2002.
- Companies Act 71 of 2008.
- Protection of Personal Information Act 4 of 2013.
- FAIS General Code of Conduct.
- ISDA — Master Agreement, CSA, protocol library, Common Domain Model.
- ICMA — GMRA documentation.
- ISLA — GMSLA documentation.
- Akoma Ntoso / LegalRuleML standards for legal markup.
