---
title: Governance of the bank — current state (presentation)
author: Owen
date: 2026-05-06
summary: 2-page presentation rendering of the 2026-05-06 governance position. Superseded by Owen's final-composition paper and the licence-day decisions.
decision-required: false
superseded-by:
  - decision-id: D-THIN-HUMAN-LAYER-MINIMUM
    decision-date: 2026-05-08
    note: "Licence-day human-layer composition is now codified in 2026-05-09_owen_thin-human-layer-composition-final.md."
  - decision-id: D-LEGAL-ENTITY-TREE-V0
    decision-date: 2026-05-09
    note: "Legal-entity tree (Hoz Group / Hoz Bank / Hoz Securities) supersedes the single-entity framing in this presentation."
  - reference: Owner Inbox/2026-05-09_owen_thin-human-layer-composition-final.md
    note: "Final composition paper is the canonical governance-composition record."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# Governance of the bank — current state

**Author:** Owen (Company Secretary)
**Date:** 2026-05-06
**For:** Marc (CEO)
**Length:** 2 pages

> **Note on derivation (Principle 6).** This presentation is a summarised derivation of internal documents. Every statement below cites its source in `CLAUDE.md`, the role briefs in `Team Inbox/`, or the persona files in `/Team/`. No new substance has been authored at the presentation layer.

---

## Page 1 — Where governance stands today

### The bank's governance scaffolding

Three documents hold the bank's governance position today: `CLAUDE.md` (architectural principles and roster), the brief commissioning the governance framework (`Team Inbox/2026-05-06_brief_governance-framework.md`), and Helena's RAS / RAF brief (`Team Inbox/2026-05-06_brief_risk-appetite-statement-and-framework.md`). The full governance framework is in flight; what follows is the position as of today.

### Top-of-house structure (CEO direct reports)

Source: `CLAUDE.md`, *Team structure* and *Top-of-house reporting*.

| Seat | Holder | Type | Principal accountability |
|---|---|---|---|
| Chief of Staff | Scrooge | Functional | Orchestration; never carries out work directly |
| Chief Risk Officer | Helena | Governance | All risk; RAS / RAF; ICAAP / ILAAP; BRC |
| Chief Operating Officer | Devon | Governance | Operations and engineering at executive level; operational resilience |
| Chief Financial Officer | Camille | Governance | Financial reporting; capital; treasury / ALM (operational); accounting; tax |
| Company Secretary | Owen | Governance | Governance machinery; statutory officer under Companies Act |
| Chief Compliance Officer | Zara | Governance | RMCP under FIC; named MLRO and FIC Compliance Officer; FAIS conduct |
| Information Officer | Iris | Governance | POPIA s.56; lawful-processing register; breach notification; PAIA manual |

### Three lines of defence

Source: `CLAUDE.md` and `Team Inbox/2026-05-06_brief_governance-framework.md`.

- **First line** — Atlas (platform), Bea (accounting), Kai (trading), Tomas (operations & payments), Imani (legal-as-code), Sade (HCM), Niko (sales / CRM), Yael (tax), Ravi (treasury / ALM), Anya (data / analytics), Senna (security, in build-and-run capacity).
- **Second line** — Helena (CRO governance); Zara (CCO governance); Mira (compliance / RegTech engineer reporting to Zara); Rohan (risk engineer reporting to Helena); Iris (Information Officer governance).
- **Third line** — Vera (internal audit engineer; functionally independent; administrative line through CEO with dotted line to Owen and a future CAE).

### Engineering vs governance — a structural commitment

Source: `CLAUDE.md`, *Engineering vs governance* note; memory entry on the governance-vs-engineering distinction (CEO directive 2026-05-06).

Engineers *build* coded controls, projections, and platform components. Governance seats hold *named regulatory accountability* and oversee the engineers' outputs. The two are distinct seats; conflating them collapses the lines of defence.

### Open governance seats — flagged, not yet hired

Source: `CLAUDE.md` and `Team Inbox/2026-05-06_role-brief_chief-risk-officer.md`, section 11.

- **CISO** (above Senna). Cyber resilience under Joint Standard 1 of 2024.
- **General Counsel** (above Imani). Legal risk; contractual governance.
- **Chief Audit Executive** (above Vera). Third-line independence with Audit Committee functional reporting.
- **CHRO** (above Sade). People governance; remuneration; fit-and-proper.
- **Possibly COO deputy / additional executives** as scale requires.

Helena's governance framework draft (target: two weeks) will recommend the order in which these are filled.

### Interim governance — pending board formation

The bank does not yet have a Board, sub-committees, or external NEDs. Helena has been asked, in the framework brief, to design defensible interim governance until the board is constituted (the CEO cannot mark his own homework). This is one of three deferred questions explicitly held over for her draft (`Team Inbox/2026-05-06_brief_governance-framework.md`, *Specific items still for Helena to resolve*).

---

## Page 2 — How the bank governs itself: principles, framework, and forward work

### The six architectural principles

Source: `CLAUDE.md`, *Architectural principles*. These bind every team member and every deliverable; no role is exempt.

1. **Events are the only source of truth.** Balances, positions, capital, liquidity ratios, regulatory-return cells — all are queries over the event log. Stored projections are caches, never authority. As-of replay is first-class.
2. **Every action traces to a source.** A shared, versioned obligations register holds typed citations to regulator instruments and internal policy. Code or process without a citation is by definition unjustified.
3. **Cloud-native; nothing manual or physical except where essential.** Infrastructure, workflows, customer interaction, and documents are coded by default. Manual or physical steps are exceptions, justified and tracked.
4. **Security designed in from the start.** Threat modelling per design, zero trust, HSM-backed keys, secure SDLC, immutable audit, rehearsed incident response. Aligned with PA / FSCA Joint Standard 1 of 2024.
5. **Multi-currency, multi-entity, multi-country from day one.** Every monetary value carries currency; every event carries entity and jurisdiction; presentation currency is a query. Adding the second of any of these is a configuration change, not a project.
6. **Single source of truth; presentations derive from data.** `Data → Process → Standard → Policy → Presentation`. External artefacts are summarised derivations of the stack — never independent authorship. This presentation is itself an instance of P6.

### Governance framework — in flight, two-week target

Source: `Team Inbox/2026-05-06_brief_governance-framework.md`. Helena leads; Owen co-authors the machinery; Zara, Iris, Imani, Mira, Sade, Vera, Atlas, Senna contribute.

**Scope of the forthcoming framework:**

- Board composition, reserved matters, charter, conflicts and related-party governance.
- Sub-committee charters — Risk, Audit, Remuneration, Social & Ethics (Companies Act regulation 43), Nominations, Credit, ALCO.
- Executive structure and named regulatory designations (Banks Act, FIC Act, FAIS, POPIA, Joint Standard 1 of 2024).
- Three lines of defence formalised.
- Policy taxonomy and policy governance.
- Delegation of authority — coded into the platform as event-level authorisation.
- Information flows and meeting machinery — board packs as queries (Principle 6).
- Interim governance until the board is constituted.
- Climate / ESG governance (PA Guidance Note 1 of 2024).
- Outsourcing and third-party governance (SARB Directive 3 of 2018).

### Governance work currently in flight

Source: `Team Inbox/`.

| Deliverable | Lead | Target | Brief |
|---|---|---|---|
| Governance framework | Helena | 2 weeks | `2026-05-06_brief_governance-framework.md` |
| Risk Appetite Statement & Framework | Helena | 2 weeks | `2026-05-06_brief_risk-appetite-statement-and-framework.md` |
| Org structure (HCM) | Sade | 3 working days | `2026-05-06_brief_org-structure.md` |
| Client master + continuous KYC | Mira (lead), Anya, Imani | 1 week | `2026-05-06_brief_client-master-and-continuous-kyc.md` |

### CEO decisions recorded today

Source: brief annotations dated 2026-05-06.

- Customer base perimeter — primarily South African (multi-jurisdiction work principally for clients with foreign exposure).
- Continuous-KYC signal sources — non-paid first; pipeline source-pluggable for later paid integrations.
- Continuous-KYC restriction default — deferred to the CRO and the RAS / RAF.
- Governance roles — distinct from engineering roles; the CRO is the first explicit case.
- Information Officer (POPIA) — separately hired, not defaulted to the CEO; designation to be lodged with the Information Regulator under POPIA Regulation 4.
- Chief Compliance Officer — separately hired; named MLRO and FIC Compliance Officer; Mira reports up to Zara.
- COO and CFO — both report to the CEO; COO governs operations and platform engineering; CFO governs finance.
- Principle 6 — codified.

### What the next governance milestone looks like

Helena delivers the governance framework draft to this inbox. Sade delivers the org structure to this inbox. Mira delivers the client master + continuous KYC design to this inbox. Helena delivers the RAS / RAF to this inbox. From those four artefacts, the bank's second-cut governance presentation will be a generated summary — by Principle 6.
