# Brief — Governance framework for the bank

**Author:** Scrooge (relaying CEO directive)
**Date:** 2026-05-06
**For:** Helena (CRO — lead)
**CC:** Owen (Company Secretary — co-author of the governance machinery; will custodian the framework operationally), Zara (CCO — regulatory-designations, MLRO/FIC, FAIS, TCF dimensions), Iris (Information Officer — POPIA / privacy dimension), Imani (legal-as-code engineer — corporate-law and constitutional dimension), Mira (compliance / RegTech engineer — regulatory accountability mapping), Sade (HCM — fit-and-proper, remuneration governance, org structure interface), Vera (internal audit — third-line independence and assurance over the framework), Atlas (platform — coded enforcement of governance decisions), Senna (cyber-governance dimension)

## CEO directive

Marc has asked for a **governance framework** for the bank. This is a foundational deliverable that sits above and informs every other framework already in flight (the RAS / RAF, the org structure, the obligations register, the risk taxonomy). Where the RAS defines *appetite* and the org structure defines *seats*, the governance framework defines *how the bank is governed* — board, committees, decision-making authorities, lines of accountability, policy taxonomy, regulatory designations, and the operating discipline that ties them together.

## Why this matters now

The bank cannot apply for a SARB banking licence — and cannot operate once licensed — without a coherent governance framework. The Banks Act, the Regulations Relating to Banks, the FSR Act / Twin Peaks regime, the BCBS Corporate Governance Principles for Banks (2015), King IV, and the Companies Act 71 of 2008 all converge on a small set of structural expectations: a properly constituted board with independent oversight, sub-committees with clear charters, a named CEO, CRO, CFO, Chief Compliance Officer, Chief Audit Executive, a Company Secretary, an Information Officer, and a Money Laundering Reporting Officer / Compliance Officer under FIC. Without the framework, governance accountabilities float; with it, every design decision has a named owner and a documented escalation path.

## Required scope

The governance framework must cover, at minimum:

### 1. Board

- Composition expectations — independent non-executive directors as a majority, an independent chair, executive representation (CEO and likely CFO), skills-and-diversity matrix, tenure policy.
- Reserved matters — what only the Board may decide.
- Board charter, induction, development, and evaluation.
- Conflicts of interest and related-party-transaction policy.
- Whistleblowing, code of conduct, code of ethics.
- King IV-aligned reporting principles.

### 2. Board sub-committees (with draft charters)

At minimum:

- **Risk Committee** — chaired independently, oversight of the RAS / RAF, ICAAP / ILAAP, stress testing, model risk, cyber risk; Helena as primary executive.
- **Audit Committee** — chaired independently, oversight of financial reporting, internal control, internal audit (Vera reports here functionally), external audit, fraud.
- **Remuneration Committee** — chaired independently, executive remuneration, malus and clawback, link between remuneration and risk, fit-and-proper alignment.
- **Social & Ethics Committee** — required by Companies Act regulation 43 for companies meeting the public-interest score; covers ethics, social responsibility, climate, conduct.
- **Nominations Committee** — board composition, succession, fit-and-proper at director level.
- **Credit / Lending Committee (or delegation thereof)** — when the lending book is non-trivial; until then a delegated authority.
- **ALCO** — executive committee, asset-liability management; Ravi as secretariat, Helena as risk oversight, Bea on capital, Atlas on platform.

For each: charter (purpose, authority, composition, quorum, cadence, reporting), interaction with other committees, escalation triggers from the second line.

### 3. Executive structure and named accountabilities

- CEO (Marc) — with reserved decisions and accountability map.
- **CRO** (Helena) — risk governance.
- **CFO** — capital, financial reporting governance, treasury oversight (governance, not engineering). *Currently a gap.*
- **CCO / Chief Compliance Officer** — regulatory and conduct compliance governance; named **Money Laundering Reporting Officer** and **Compliance Officer** under FIC. *Currently a gap.*
- **CISO** — cyber resilience governance; named accountability under Joint Standard 1 of 2024. *Currently a gap; Senna as engineer below.*
- **General Counsel** — legal risk governance, contractual governance, regulator-engagement legal lead. *Currently a gap.*
- **Chief Audit Executive (CAE)** — third-line independence, reports functionally to Audit Committee. *Currently a gap; Vera as engineer below.*
- **CHRO / Head of HCM** — people governance, remuneration, fit-and-proper sign-off. *Currently a gap; Sade as engineer below.*
- **COO** — operational running of the bank; may or may not be needed depending on scale. *Open question for Marc.*
- **Company Secretary** — corporate governance machinery; King IV expectation; Companies Act expectation for public companies; almost universally present in SA banks. **Flag as a missing governance seat — see below.**
- **Information Officer (POPIA)** — defaults to the CEO unless designated. **Flag for designation.**

### 4. Three lines of defence (formalised)

- **First line** — risk-taking and operating engineers (Atlas, Bea, Kai, Tomas, Imani, Sade, Niko, Yael, Ravi, Anya; Senna in build-and-run capacity).
- **Second line** — independent oversight (Helena as CRO; the future CCO seat; cyber-risk oversight under the future CISO seat).
- **Third line** — independent assurance (Vera, reporting functionally to Audit Committee, in future under the CAE).
- Operating discipline — what each line does, what it does not do, how challenges flow upward, and how the lines interact without collapsing.

### 5. Policy taxonomy and governance over policies

- A **policy library** — every policy has an owner, a board-or-committee approval pathway, a review cycle, a version, and obligations-register links (P2).
- Mandatory policies on day one: code of conduct, conflicts of interest, whistleblowing, anti-bribery and corruption, sanctions, AML/CFT, market conduct, treating customers fairly, data protection / POPIA, information security, business continuity, outsourcing and third-party risk (per SARB Directive 3 of 2018 on cloud/offshoring — overlap with the platform), remuneration, fit-and-proper.
- Helena curates the *risk* policy library; Imani co-curates the *legal/contract* policies; Mira co-curates the *regulatory* policies; the framework defines the seam between them and Mira's obligations register.

### 6. Delegation of authority (DoA)

- A typed, versioned matrix — every decision, who can take it, with what monetary or qualitative threshold, what dual-control requirement, what evidence requirement.
- Coded into the platform as event-level authorisation (P3 / P4): the platform refuses an action that is not within the actor's delegation.
- Breach of delegation is an event; Vera consumes those events as continuous-controls evidence.

### 7. Regulatory designations

- Banks Act / PA designations (CEO, CRO, CFO, CCO, CISO).
- FAIS Act key individuals and representatives (when the bank carries an FSP licence).
- FIC Act — Money Laundering Reporting Officer; AML Compliance Officer.
- POPIA — Information Officer; Deputy Information Officer(s).
- Joint Standard 1 of 2024 — named cyber-risk-accountable person.
- JSE / market designations (compliance officer, settlement officer) when relevant.
- Each designation cited to the regulator instrument under P2.

### 8. Information flows and meeting machinery

- Board pack composition, cadence, generation method (queries, not spreadsheets — P3).
- Sub-committee packs likewise.
- Minutes, resolutions, action tracking — event-sourced (P1).
- Board-effectiveness review cycle.

### 9. Interim governance

- Today the bank has CEO, CRO, CoS — no board, no sub-committees, no most of the governance suite. Define **interim governance** until the board is constituted: who acts as the BRC, who acts as the AC, what is escalated to the CEO directly, what is logged for board review when it forms.
- Transition plan — sequence and timing of governance hires, board formation, sub-committee constitution.

### 10. Climate and ESG governance

- PA Guidance Note 1 of 2024 expectations on climate-related risk governance — board oversight, scenario analysis, disclosure path.
- Place within the Risk Committee and the Social & Ethics Committee.

### 11. Outsourcing and third-party governance

- SARB Directive 3 of 2018 on cloud computing and offshoring of data — overlaps heavily with Atlas's platform and with Senna's security boundaries; the framework gives it the governance home.

## Required design properties (architectural principles)

**P1 — Events as source of truth.** Governance decisions — board approvals, committee resolutions, delegations granted and revoked, fit-and-proper attestations, policy approvals — are events. The governance posture at any past as-of date is reproducible.

**P2 — Traceability.** Every governance arrangement cites the regulator / standard / Companies Act provision / King IV principle that demands it. Internal policies also cite their authorising resolution. The framework itself is register-linked.

**P3 — Cloud-native, no manual.** Board packs are queries; minutes are structured records with actions tracked as events; delegation breaches are detected automatically. Wet-signature exceptions are reserved for the genuine ECTA Schedule 1 cases.

**P4 — Security by design.** Board-level information is among the most sensitive data the bank holds; field-level encryption, purpose-bound access, immutable audit on board-pack reads. Coordinated with Senna.

**P5 — Multi-everything.** The framework anticipates multiple legal entities (subsidiaries, branches, future foreign entities) with consolidated and entity-level governance; it anticipates multiple jurisdictions of regulation as the bank expands. New entities and jurisdictions are register changes, not framework rewrites.

## CEO decisions (2026-05-06) on the open governance seats

The CEO has resolved three of the items I flagged in the original draft of this brief:

1. **Company Secretary — hired.** Owen now holds the Company Secretary seat. Helena drafts the governance framework; Owen co-authors the machinery and takes operational custodianship once approved.
2. **Information Officer — hired.** Iris now holds the POPIA Information Officer designation. The framework should treat the IO as a filled governance seat, not a future one. Iris's designation must be lodged with the Information Regulator under POPIA Regulation 4.
3. **MLRO and FIC Compliance Officer — hired through Zara.** Zara now holds the CCO governance seat and is the named MLRO and FIC Compliance Officer. Mira continues as compliance / RegTech engineer reporting to Zara on compliance matters.
4. **Interim BRC and AC arrangement — deferred.** Helena to address in the framework draft as originally scoped.

## Specific items still for Helena to resolve in the framework draft

1. **Order of remaining governance hires.** With CRO, CoSec, CCO, and IO now in place, recommend the sequence for the still-open seats: CFO, CISO, GC, CAE, CHRO, possibly COO. Tie the recommendation to which design pressures surface first.
2. **Interim BRC and AC.** Until a board exists, propose a defensible interim arrangement. The CEO cannot mark his own homework; design accordingly. Helena and Owen to co-design.
3. **Subsidiarity vs centralisation.** When new legal entities are added, what governance is centralised at group level and what is replicated at entity level? Set the principle, not the detail.
4. **Co-governance seams.** Specify the working seam between Zara and Iris on POPIA, between Helena and Zara on the second line, between Owen and the executive team on board pathway, and between Vera and the (future) CAE.

## Deliverable

A single document into Owner Inbox, target two weeks:

- `Owner Inbox/YYYY-MM-DD_governance-framework.md`

Structured along the eleven sections above, with draft committee charters as appendices.

The draft must:

- Cite every requirement under P2.
- Map every governance arrangement to the obligations register (Mira's curation).
- List every governance hire it depends on, in priority order (your recommendation).
- Identify every design decision elsewhere in the bank that is currently blocked on a governance answer this framework will provide (so other engineers know what to expect).

## Note on coordination

Helena leads. Imani drafts the corporate-law and Companies Act dimensions. Mira drafts the regulatory-designation and obligations-register dimensions. Sade contributes the org-structure interface (her own deliverable will plug into this), the fit-and-proper regime, and the remuneration-committee mandate. Vera reviews from a third-line perspective without owning. Senna contributes the cyber-governance dimension. Atlas contributes the platform-enforcement view of delegated authority and policy-as-code.

Scrooge tracks. Marc receives the deliverable.
