---
title: POPIA Privacy Policy v1
author: Iris (Information Officer, governance) + Zara (Compliance / legal-as-code engineer)
date: 2026-05-11
summary: Standalone Privacy Policy implementing POPIA 4/2013 and Joint Standard 2 of 2024 for Hoz Bank. Covers lawful basis for processing, data subject rights, Information Officer designation, data breach notification, retention schedules, and cross-border transfer controls. Closes 17 ORG-PR(IV)-series obligations. CORPORATE-BIND (binds now).
decision-required: false
---

# POPIA Privacy Policy v1

**Authors:** Iris (Information Officer, governance) — lead; Zara (Compliance / legal-as-code engineer) — co-author
**Date:** 2026-05-11
**Version:** 1.0
**Status:** IN FORCE (CORPORATE-BIND — binds from today; POPIA applies at corporate formation, not at licence-day)
**Approval authority:** BRC + S&E Committee (Board route); CEO interim approval pending BRC constitution at licence-day
**Review cadence:** Annual; trigger-refresh on material regulatory change or notifiable breach
**Obligation coverage:** ORG-PR(IV)-01 through ORG-PR(IV)-17 (17 obligations, 1 PARTIAL per E1 gap)

**Regulatory citations:**
- Protection of Personal Information Act 4 of 2013 (POPIA), especially ss.11–25, 34–35, 55–57, 71–72
- POPIA Regulations (GN 1383 of 2018, as amended)
- Promotion of Access to Information Act 2 of 2000 (PAIA), s.51
- Joint Standard 2 of 2024 on Cybersecurity and Cyber Resilience (PA / FSCA)
- SARB Prudential Authority Directive 3 of 2018 (cloud computing and offshoring)
- Banks Act 94 of 1990 and Regulations Relating to Banks (record-keeping and prudential obligations)
- FIC Act 38 of 2001 (record-retention floors for KYC / CDD data)

**Counterpart agents:**
- Rashida (CISO, governance) — s.19 security safeguards, Joint Standard 2 of 2024 cyber-resilience
- Senna (Security engineer) — security-safeguard substrate, breach-detection pipeline
- Owen (Company Secretary, governance) — PAIA s.51 Manual, IO lodgment procedure
- Anya (Data / analytics engineer) — minimisation enforcement in projections, DSAR pipeline
- Imani (Legal-as-code engineer) — processor agreements, cross-border clause library
- Devon (COO, governance) — cloud-residency assessment, SARB Directive 3 of 2018 coordination
- Helena (Chief Risk Officer, governance) — automated-decision-making risk appetite (s.71)
- Vera (Internal-audit / continuous-assurance engineer) — rights-workflow testability, Vera recon assertions

---

## §1 — Purpose and scope

### 1.1 Purpose

This Policy sets out how Hoz Bank Limited, Hoz Securities Limited, and Hoz Group Limited (collectively "the Bank", "we", "us", "our") process personal information, the lawful bases on which we do so, the rights of data subjects, and the safeguards we maintain to protect personal information entrusted to us.

The Policy is the Bank's primary instrument implementing the Protection of Personal Information Act 4 of 2013 (POPIA) and the Joint Standard 2 of 2024 on Cybersecurity and Cyber Resilience. It is intended to be read by all data subjects whose information the Bank processes, by all agents and contractors who process personal information on the Bank's behalf, and by the Bank's internal governance functions.

This Policy closes obligations ORG-PR(IV)-01 through ORG-PR(IV)-17 in the Bank's obligations register (`Regulations/_obligations-register.md` Domain F — Privacy). POPIA is CORPORATE-BIND: it applies from the date of corporate formation, not from commencement of banking. Compliance obligations are in force now.

### 1.2 Scope — entities

Each of the three Hoz entities is independently a "responsible party" within the meaning of POPIA s.1:

| Entity | Principal processing scope |
|---|---|
| **Hoz Bank Limited** | Banking-customer personal information — KYC/CDD/EDD records, transaction histories, account statements, financial advice records, AML monitoring outputs, breach-notification cohorts, FATCA/CRS counterparty self-certification |
| **Hoz Securities Limited** | Institutional-counterparty personal information — counterparty-eligibility data, beneficial-owner information of counterparty legal persons, trading-relationship correspondence, FATCA/CRS institutional-counterparty data |
| **Hoz Group Limited** | Holding-company minimal processing — board minutes and supporting papers, group HR personal data (activates at licence-day when human directors and officers are appointed), intra-group agreements, shareholder records |

Per `D-LEGAL-ENTITY-TREE-V0` (CEO-approved 2026-05-09) and `D-REGULATORY-PERIMETER` (CEO-approved 2026-05-09), each entity separately owes IO designation and PAIA s.51 manual obligations under POPIA ss.55–56.

### 1.3 Scope — data subjects

The Bank processes or anticipates processing personal information of the following categories of natural persons:

- **Institutional clients and their nominated contacts** — directors, authorised signatories, beneficial owners, and contact persons of institutional counterparties (COMMENCEMENT-BIND — activates at commencement of trading under licence; synthetic data only in build phase)
- **Directors and officers of the Bank** — natural persons appointed to the board, management, and key-function seats (CORPORATE-BIND — applies from appointment at licence-day; build-phase processing is limited to Marc as interim CEO and future statutory minimum human officers)
- **Employees and contractors** — activates at licence-day per `project_ai_driven_bank.md`; Sade (AgentOps) substrates; HR processing deferred
- **Job applicants** — applicable once formal recruitment commences at or approaching licence-day
- **Visitors and correspondents** — natural persons making PAIA access requests, correspondents in regulatory filings, persons identified in compliance processes
- **Agents and their substrate** — agent-substrate logs that contain natural-person identifiers where an agent's run is attributed to a natural-person instruction

**Build-phase posture.** The Bank is in build phase (per `project_ai_driven_bank.md`). No live customers, no live employees at scale, no live banking processing flows. This Policy's operational sections apply now; the volume of personal information currently processed is limited to: (a) Marc as CEO and interim director; (b) agent-substrate logs attributable to Marc's instructions; (c) synthetic personal data generated for testing purposes (which still attracts POPIA security-safeguard discipline on the substrate). Full activation of all sections occurs at licence-day and commencement of trading.

### 1.4 Relationship to other policies

This Policy is the primary privacy instrument. Counterpart policies that implement specific POPIA dimensions include:

- **Information Security Policy** — implements s.19 security safeguards and Joint Standard 2 of 2024 technical and organisational measures (owner: Rashida with Senna)
- **Incident Response Policy** — implements s.22 breach-notification workflow and cyber-incident-notification requirements under Joint Standard 2 of 2024 (owner: Rashida with Iris)
- **Cross-Border Transfer Policy** — implements s.72 cross-border-transfer discipline and SARB Directive 3 of 2018 offshoring controls (owner: Iris with Devon)
- **Data Retention and Disposal Policy** — implements s.14 retention limits and structured disposal schedules (owner: Iris with Owen)
- **Records Management Policy** — implements records-lifecycle governance across POPIA / FIC Act / Companies Act retention floors (owner: Owen with Devon) — PLANNED
- **KYC / CDD / EDD Policy** — implements s.11 lawful-basis and s.18 notice requirements in the client-onboarding context (owner: Zara with Mira)
- **Model Risk Policy** — implements s.71 automated-decision-making discipline (owner: Helena with Nadia)

Where this Policy and a counterpart policy conflict, the counterpart policy prevails on technical matters within its own domain, provided it is consistent with POPIA's requirements.

---

## §2 — Information Officer

### 2.1 Designation framework

POPIA ss.55–56 and POPIA Regulation 4 require each responsible party (being a private body) to designate an Information Officer and register that officer with the Information Regulator before commencing IO duties. The designation is **per responsible party**, not per natural person; the same individual may serve as IO of multiple responsible parties. Obligation: ORG-PR(IV)-13.

### 2.2 Current designation

Per `D-THIN-HUMAN-LAYER-MINIMUM` (CEO-approved 2026-05-08), the Bank's minimum-human-layer staffing plan designates a triple-hatted Compliance Lead (serving as MLRO + FIC Compliance Officer + Information Officer) as the Information Officer for each Hoz entity at licence-day. The Deputy Information Officer for each entity is the Company Secretary (Owen (Company Secretary, governance) seat).

| Entity | Information Officer | Deputy Information Officer |
|---|---|---|
| **Hoz Group Limited** | Triple-hatted Compliance Lead (licence-day hire) | Company Secretary (Owen seat) |
| **Hoz Bank Limited** | Triple-hatted Compliance Lead (licence-day hire) | Company Secretary (Owen seat) |
| **Hoz Securities Limited** | Triple-hatted Compliance Lead (licence-day hire) | Company Secretary (Owen seat) |

**Build-phase interim.** Until the triple-hatted Compliance Lead is appointed at licence-day, Marc (CEO) serves as interim head-of-private-body under PAIA s.55 / POPIA s.56(1) at each entity. Iris (Information Officer, governance) acts as the virtual-agent Information Officer function under this Policy during build phase. This is E1 — the lodgment of formal IO designations with the Information Regulator is deferred to licence-day (ORG-PR(IV)-13 status: PARTIAL).

### 2.3 Information Officer responsibilities

The designated Information Officer is responsible for the following under POPIA s.57 and POPIA Regulation 4 (obligation: ORG-PR(IV)-14):

1. **Encouraging compliance** — promoting, within the Bank, compliance with the conditions for the lawful processing of personal information (POPIA ss.11–25)
2. **Handling requests** — dealing with requests made to the Bank pursuant to POPIA (data subject rights) and PAIA (access to information)
3. **Regulator engagement** — working with the Information Regulator in relation to investigations under POPIA s.39
4. **Compliance framework** — ensuring the Bank has a documented compliance framework, conducts personal-information impact assessments as required, maintains the PAIA s.51 Manual, runs internal awareness programmes, and registers its processing operations with the Information Regulator as required
5. **Prior-authorisation** — identifying processing types that require prior authorisation under POPIA s.57 and obtaining such authorisation before processing commences (ORG-PR(IV)-14)
6. **Register maintenance** — maintaining the lawful-processing register and ensuring it is current and auditable

### 2.4 PAIA Manual

The Bank is required under PAIA s.51 to compile and lodge a manual describing what records the Bank holds, how data subjects and others may make access requests, and the Bank's response procedure. The PAIA s.51 Manual is maintained as a per-entity document. Obligation: ORG-PR(IV)-16.

- Requests for access to records of the Bank are lodged with the Information Officer at the address published in the PAIA Manual
- The Bank must respond within the statutory timeframe under PAIA (30 days, extendable once per PAIA s.26)
- Refusals are reasoned and grounded in PAIA exemptions; appeals route per PAIA Regulations
- Failure to respond within statutory timeframes is a registered event with potential Information Regulator engagement (ORG-PR(IV)-17)

**Substrate gap:** the PAIA Manual generator reading from the lawful-processing register and event log per Principle 1 is in development (Iris + Anya). Current manuals are authored documents; generator substrate is a v1 gap per `Team/Iris.md` §16.

### 2.5 Deputy IO and single-point-of-failure mitigation

Per `ORG-PR(IV)-13-GLOSS-DEPUTY-IO`, POPIA Regulation 4 contemplates a Deputy Information Officer. The Deputy IO (Company Secretary) acts when the IO is conflicted, unavailable, or recused. The deputy-IO designation and MLRO-alternate are split: Company Secretary carries Deputy IO; AC-Chair NED carries MLRO-alternate. This split, confirmed under `D-THIN-HUMAN-LAYER-MINIMUM`, reduces single-point-of-failure concentration in the thin-human-layer.

---

## §3 — Lawful Basis for Processing

### 3.1 The eight conditions for lawful processing

POPIA s.11 states that personal information may only be processed if one of the following conditions (lawful bases) is met. The Bank documents the applicable lawful basis for each processing purpose in the lawful-processing register. Obligation: ORG-PR(IV)-01.

The eight conditions are:

| Condition | POPIA citation | Plain description |
|---|---|---|
| **Consent** | s.11(1)(a) | The data subject has given specific, voluntary, informed consent to the processing |
| **Contractual necessity** | s.11(1)(b) | Processing is necessary for the performance of a contract to which the data subject is a party, or for pre-contractual steps taken at the data subject's request |
| **Compliance with a legal obligation** | s.11(1)(c) | The responsible party is subject to a legal obligation under any legislation, common law, or other rule of law requiring the processing |
| **Protecting vital interests** | s.11(1)(d) | Processing is necessary to protect the legitimate interests of the data subject |
| **Pursuing legitimate interests** | s.11(1)(f) | Processing is necessary for pursuing the legitimate interests of the responsible party or a third party to whom it is disclosed |
| **Carrying out a public-law duty** | s.11(1)(e) | Processing is necessary for the proper performance of a public-law duty by a public body |
| **Official authority** | s.11(1)(g) | Processing is necessary for the exercise of the powers or functions of a public body |
| **Historical / statistical / research** | ss.15–16 | Processing for historical, statistical, or research purposes with appropriate safeguards |

*Note: POPIA uses six explicit conditions in s.11(1)(a)–(f) plus conditions via ss.15–16. The Bank maps these to the eight conditions listed above for clarity; the statutory text of POPIA ss.11–16 is authoritative.*

### 3.2 Primary lawful bases by processing purpose

For each processing category the Bank operates, the lawful basis is registered in the lawful-processing register. The primary lawful bases in the Bank's anticipated processing scope are as follows.

**Institutional client KYC / CDD / EDD processing (COMMENCEMENT-BIND)**

The primary lawful basis is **contractual necessity** (s.11(1)(b)) — the Bank cannot enter into or perform the client agreement without conducting the required due diligence — reinforced by **compliance with a legal obligation** (s.11(1)(c)) — FIC Act ss.21–21H impose mandatory customer due-diligence obligations as a matter of statute. These two grounds apply cumulatively and independently; either alone is sufficient. Consent is not the primary basis for KYC/CDD processing.

**AML / sanctions screening and STR/SAR filing (COMMENCEMENT-BIND)**

**Compliance with a legal obligation** (s.11(1)(c)) is the sole operative lawful basis. FIC Act ss.28, 28A, and 29 impose mandatory monitoring, screening, and reporting obligations. The Bank has no discretion; compliance is legally compelled and does not rest on consent.

**FATCA / CRS self-certification and reporting (COMMENCEMENT-BIND)**

**Compliance with a legal obligation** (s.11(1)(c)) — FATCA and the OECD Common Reporting Standard impose mandatory collection and reporting obligations. The Tax Administration Act and SARS framework implement these obligations domestically.

**Employment / contractor processing (LICENCE-DAY)**

Primarily **contractual necessity** (s.11(1)(b)) — employment contract performance — supplemented by **compliance with a legal obligation** (s.11(1)(c)) — Labour Relations Act, Basic Conditions of Employment Act, Skills Development Act, Employment Equity Act, COIDA, UIF. Consent is not the primary basis for employment processing.

**Director / officer fit-and-proper screening (LICENCE-DAY)**

**Compliance with a legal obligation** (s.11(1)(c)) — Banks Act s.60 and the PA Fit-and-Proper Requirements impose mandatory screening of directors, prescribed officers, and key-function holders.

**Direct marketing (where applicable, COMMENCEMENT-BIND)**

**Consent** (s.11(1)(a)) is the required lawful basis for electronic direct marketing under POPIA s.69. An opt-in consent event is required before sending direct marketing by electronic means. Consent is separately recorded per s.69(2); withdrawal is a typed event propagated through the consent-register projection.

**Agent-substrate processing (CORPORATE-BIND, now)**

Processing of personal information in agent-substrate logs (e.g. logs attributable to Marc as the instructing natural person) relies on **legitimate interests** (s.11(1)(f)) — the Bank's legitimate interest in operating and auditing its engineering substrate and maintaining the integrity and auditability of its operating logs, tempered by data-minimisation requirements (§5 of this Policy).

### 3.3 Purpose limitation and compatibility assessment (ORG-PR(IV)-02, ORG-PR(IV)-04)

Under POPIA ss.13–14, personal information must be collected for a specific, explicitly defined, and lawful purpose, and may not be processed in a manner incompatible with that purpose. Obligation: ORG-PR(IV)-02.

Further processing is permissible only if compatible with the original collection purpose (POPIA s.15). The Bank conducts a compatibility assessment before using personal information for a purpose not recorded at time of collection. The assessment considers: (a) the link between the original and new purpose; (b) the nature of the information and whether it is sensitive; (c) the likely consequences for the data subject; (d) the manner in which the information was collected; (e) whether the data subject has consented. Obligation: ORG-PR(IV)-04.

**Process:** every processing purpose is registered in the lawful-processing register with: legal basis (s.11 condition), data categories, data flows, processing agents (internal and external), retention schedule, cross-border path, and s.19 safeguards applied. New purposes require a register entry and compatibility assessment before activation. The register is an event-sourced record; each entry emits a `ProcessingPurposeApproved` event.

### 3.4 Special categories of personal information (ORG-PR(IV)-11)

POPIA s.26 defines "special personal information" as information concerning a data subject's religious or philosophical beliefs, race or ethnic origin, trade union membership, political persuasion, health or sex life or biometric information, and criminal behaviour. Special personal information may only be processed under the restricted grounds in POPIA s.27–32:

- **Religious or philosophical beliefs** (s.28) — data subject consent (written); specified statutory grounds; for educational purposes
- **Race or ethnic origin** (s.29) — compliance with affirmative-action legislation; historical and statistical research
- **Trade union membership** (s.30) — consent; employment contract; statutory ground
- **Political persuasion** (s.31) — consent; research
- **Health or sex life; biometric information** (s.32) — data subject consent (written); medical necessity; employment contract; statutory ground; insurance contract
- **Criminal behaviour** (s.33) — consent; statutory ground; compliance investigations

**Banking context.** The Bank processes special personal information in the following circumstances:
- *Biometric data* — director/officer fit-and-proper processing (fingerprints / criminal-record checks) — POPIA s.32 applies; ground: compliance with a legal obligation (Banks Act fit-and-proper requirements). Every biometric processing is registered separately in the lawful-processing register with its specific s.32 ground.
- *Health data* — employee records (activates at licence-day, Sade substrate) — ground: employment contract; statutory ground (COIDA).
- *Race / ethnic origin* — employment equity reporting (activates at licence-day) — ground: compliance with Employment Equity Act.
- *Criminal behaviour* — KYC/AML investigations, director fit-and-proper checks — ground: compliance with legal obligation (FIC Act / Banks Act); the result of a criminal-record check is a separate access-controlled record.

Obligation: ORG-PR(IV)-11.

### 3.5 Children's personal information (ORG-PR(IV)-12)

POPIA s.35 prohibits processing children's personal information without the prior consent of a competent person (parent / guardian) and prohibits processing such information for the purpose of advertising directly to children, creating user profiles of children, or linking children's information across platforms.

The Bank does not intend to process children's personal information in its institutional-client / trading-bank context. In the event processing of a child's personal information becomes unavoidable (e.g. an inheritance matter requiring a minor's identification), the specific s.35 compliance requirements apply and must be satisfied before processing commences. The lawful-processing register carries a specific entry for any such case. Obligation: ORG-PR(IV)-12.

---

## §4 — Data Subject Rights

### 4.1 Rights overview

POPIA grants data subjects the following rights in respect of their personal information held by the Bank:

| Right | POPIA citation | Obligation |
|---|---|---|
| Right of access | s.23 | ORG-PR(IV)-08 |
| Right to correction and deletion | s.24 | ORG-PR(IV)-09 |
| Right to object | s.11(3) | ORG-PR(IV)-01 |
| Right in respect of automated decision-making | s.71 | ORG-PR(IV)-10 |

### 4.2 Right of access (POPIA s.23, ORG-PR(IV)-08)

A data subject is entitled to request:
- Confirmation of whether the Bank holds personal information about them
- A description of the personal information held
- Information about the third parties or categories of third parties to whom the Bank has or will disclose the information
- A record of the personal information held

**Process (Data Subject Access Request — DSAR):**
1. Request is lodged in writing with the Information Officer (or via the digital channel published in the PAIA Manual)
2. The Bank verifies the identity of the requestor (identity-verification step — scripted, not yet productised; substrate gap per `Team/Iris.md` §16)
3. The Bank locates the personal information across all relevant projection-surfaces (DSAR pipeline: projection-walk scripted by Anya)
4. The Bank responds within 30 days of receiving the request (extendable once on written notice under PAIA s.26)
5. A `DSARReceived` event is emitted at intake; a `DSARClosed` event is emitted on resolution
6. If the Bank is unable to comply with a right, it provides written reasons citing the ground for refusal
7. The data subject may lodge a complaint with the Information Regulator if not satisfied with the response

**Fees:** PAIA s.54 permits a prescribed fee for requests to private bodies; the PAIA Manual published by the Bank sets the applicable fee schedule.

**Substrate gap:** DSAR pipeline is partially productised (projection-walk scripted; identity-verification step not yet productised; see `Team/Iris.md` §16). Until productised, DSARs are handled manually with typed events (`DSARReceived`, `DSARClosed`) emitted for each step.

### 4.3 Right to correction and deletion (POPIA s.24, ORG-PR(IV)-09)

A data subject has the right to request the Bank to:
- Correct or delete personal information that is inaccurate, irrelevant, excessive, out of date, incomplete, misleading, or unlawfully obtained
- Destroy or delete personal information about the data subject that the Bank is no longer authorised to retain under this Policy or applicable law

**Process:**
1. Request is lodged with the Information Officer with sufficient detail to identify the information at issue
2. The Bank assesses whether the ground for correction / deletion is made out
3. Where the Bank agrees: correction is made and a `PersonalInformationCorrected` event is emitted; deletion is effectuated and a `PersonalInformationDeleted` event is emitted
4. Where the Bank is unable to comply (e.g. the retention period has not yet expired; a competing legal obligation requires continued processing): written reasons are provided within the statutory timeframe
5. Where the Bank is unable to agree that the information is inaccurate / irrelevant: it attaches to the information a note to that effect
6. The Bank notifies third parties to whom the information was previously disclosed of the correction / deletion where feasible

**Event-sourced deletion (Principle 1 compatibility):** the Bank's event-store architecture (Principle 1 — events are the only source of truth) means that "deletion" in the s.24 sense operates on the current-state projection, not on the immutable historical event log. The deletion of personal information from a projection satisfies s.24's requirement in operational terms; the underlying historical log is subject to POPIA s.14 retention-only-as-long-as-necessary, which is discharged through the retention schedule at §5 of this Policy. The Bank maintains a `PersonalInformationDeleted` event that marks the effective deletion date and records which projection-surfaces have been cleared; this is the canonical record of the deletion act. Retention periods in the event log are enforced via the retention-class system in `prototype/platform/event-store/registry.ts`.

### 4.4 Right to object (POPIA s.11(3))

A data subject may, on reasonable grounds, object at any time to the processing of personal information. Where the lawful basis is **legitimate interests** (s.11(1)(f)), the data subject may object and the Bank must cease processing unless the Bank can demonstrate compelling legitimate grounds that override the data subject's interests. Where the lawful basis is **consent**, the data subject may withdraw consent at any time; the Bank ceases processing based on that consent upon withdrawal.

**Process:**
1. Objection / consent withdrawal lodged with the Information Officer
2. The Bank assesses the objection against the lawful-basis used and the strength of the Bank's grounds
3. `ConsentWithdrawn` event (or `ProcessingObjectionReceived` event) is emitted at intake
4. Withdrawal-propagation through relevant projections: Anya's consent-withdrawal-propagation projection is in development (substrate gap per `Team/Iris.md` §16); until productised, withdrawals propagate via manual process with event trail
5. The Bank notifies the data subject of the outcome within 30 days

### 4.5 Right in respect of automated decision-making (POPIA s.71, ORG-PR(IV)-10)

POPIA s.71 provides that a data subject may not be subject to a decision that has legal or similar significant effects, and that is based solely on automated processing of personal information. The data subject has the right to request that such a decision be reviewed by a person, express their point of view, and challenge the decision.

**Banking-context application.** The Bank uses automated processing in the following contexts where s.71 may be engaged:
- **Credit-risk scoring** — any credit-decision based solely on an automated score engages s.71
- **AML alert disposition** — where an automated alert results in a restriction on a client account (B3 approved: high-confidence triggers → restrict immediately), s.71 rights apply; the data subject is informed and may seek human review
- **KYC risk-rating** — continuous-KYC risk-tier assignment that triggers account restriction is subject to s.71 if the restriction has legal effect

**Controls (jointly with Helena and Nadia):**
- Every automated decision with significant legal effect on a natural person produces a typed `AutomatedDecisionMade` event with the inputs, model used, and the decision outcome
- The data subject is informed of the automated decision and their right to seek human review
- A review path via the Information Officer is available; the reviewer has access to the full decision record
- Helena (Chief Risk Officer, governance) and Nadia (Independent-validation engineer) maintain the automated-decision model inventory; every model producing legally significant decisions for natural persons is registered

Obligation: ORG-PR(IV)-10. Counterpart policy: Model Risk Policy.

### 4.6 Response standards and escalation

The Bank commits to the following service levels for data-subject rights requests:

| Request type | Initial acknowledgment | Substantive response |
|---|---|---|
| DSAR (right of access) | 3 business days | 30 days (extendable once under PAIA s.26 with notice) |
| Correction / deletion | 3 business days | 30 days |
| Objection / consent withdrawal | 3 business days | 30 days |
| Automated-decision review | 3 business days | 30 days |

Failure to respond within the statutory timeframe is a registered event (`DSARTimeLimitBreached`) with immediate escalation to the Information Officer and mandatory compliance-breach reporting. Persistent failure to respond may constitute a violation reportable to the Information Regulator.

---

## §5 — Data Minimisation and Retention

### 5.1 Data minimisation principle (POPIA s.12, ORG-PR(IV)-02)

The Bank collects and processes only that personal information which is necessary for the purposes described in the lawful-processing register. "Necessary" means:
- The personal information is required to achieve the stated purpose
- No less privacy-invasive alternative is available to achieve that purpose
- The volume of data collected is proportionate to the purpose

Data minimisation is enforced at the engineering layer by Anya (Data / analytics engineer) in projection design: sensitive personal information fields are not replicated into derived projections unless required; the projection references only the attributes it needs from the canonical event record. Schema annotations on the event-type registry carry a `privacy: sensitive | special | general` classification, and projections that materialise sensitive or special fields require explicit purpose-tag in the field-access event.

### 5.2 Retention schedule

Under POPIA s.14, personal information must not be retained longer than necessary for the purpose for which it was collected unless:
- Continued retention is required by contract; or
- Required by law to do so

The following retention schedule applies across the Bank's principal data categories. The retention floor is the strongest applicable legal requirement (the "no-shorter" floor); actual retention may be longer where a competing legal obligation requires.

Obligation: ORG-PR(IV)-03.

| Data category | Primary retention floor | Primary citation | Maximum permitted retention |
|---|---|---|---|
| Customer KYC / CDD records | 5 years after relationship ends | FIC Act s.22 | Indefinite in event log (Principle 1 architecture); hot-storage compaction not before 5-year floor expires; structured deletion of personal-information fields from projections at 5-year floor unless extended by legal obligation |
| Customer transaction records | 5 years after transaction | FIC Act s.22 | As above; market-infrastructure rules (JSE) impose 7-year floor for trade records per ORG-MK-15 — 7-year floor governs for JSE-reported trades |
| FATCA / CRS counterparty data | 5 years | SARS Tax Administration Act s.29 + FATCA IGA | As above |
| Accounts and financial statements | 7 years | Companies Act s.24; Banks Act s.60 | As above |
| KYC / fit-and-proper screening records (directors / officers) | 7 years | Banks Act s.60; PA Fit-and-Proper Requirements | As above |
| Employee personal data (HR records) | 5 years post-employment | Basic Conditions of Employment Act s.29 | As above; specific records (payslips, IRP5) may be longer per SARS requirements |
| Employment equity records | 5 years | Employment Equity Act s.21 | As above |
| Biometric data (fingerprints / criminal checks) | For fit-and-proper process; destruction after assessment is complete unless statutory retention applies | POPIA s.32 — data-subject consent or statutory ground; special category | Personal biometric record deleted from projection on completion of fit-and-proper assessment; evidence of assessment retained under Banks Act / Companies Act 7-year floor |
| Agent-substrate logs (personal-information attributable to Marc as instructing person) | 1 year operational minimum | Bank Records Management Policy (PLANNED) | Indefinite in event log per Principle 1 architecture; personal-information fields pseudonymised on next annual review |
| PAIA access-request correspondence | 3 years | PAIA Regulations | As above |
| AML investigation records and STR / SAR records | 5 years (FIC Act s.22) | FIC Act s.22 | Indefinite in event log; structured deletion of personal-information fields from projections at 5-year floor unless legal obligation extends |
| Marketing consent records | For duration of consent + 1 year after withdrawal | POPIA s.69; ECT Act | Consent withdrawal event marks the end of the retention period |

**Retention-class enforcement.** The retention schedule is implemented via named retention classes in `prototype/platform/event-store/registry.ts`:
- `RETENTION_FIC_5Y` — FIC Act s.22 floor (KYC, transactions, AML records)
- `RETENTION_JSE_TRADE_7Y` — JSE Equities Rules 7-year floor (trade records)
- `RETENTION_GOVERNANCE_7Y` — Companies Act / Banks Act 7-year floor (governance and director-decision records)
- `RETENTION_RUNTIME_1Y` — Bank Records Management Policy 1-year floor (operational substrate events)

The append-only event-store architecture (Principle 1) means the canonical log is indefinite at the log-of-record layer; retention-class compaction floors are the constraints on when hot-storage may be reduced. **Structured deletion** under POPIA s.14 operates at the projection layer: a `PersonalInformationDeleted` event marks the effective deletion date; downstream projections discard the relevant personal-information fields on encountering this event.

### 5.3 Disposal

At the end of the applicable retention period, personal information must be:
- **Destroyed** — irreversibly deleted (projection fields cleared; encryption keys for those records rotated and the superseded key destroyed)
- **De-identified** — rendered anonymous to a standard where re-identification is not reasonably likely, if continued retention in anonymised form is required for statistical or research purposes

**Process:** the Bank's retention-clock projection monitors expiry dates per data-subject per data-category. On expiry, a `RetentionPeriodExpired` event is emitted, triggering the disposal workflow. Disposal is evidenced by a `PersonalInformationDisposed` event carrying the data category, the retention period applied, and the disposal method. The event provides the audit trail for POPIA s.14 compliance.

**Substrate gap:** automated retention-clock projection and disposal workflow are in development (Atlas + Iris). Until productised, retention-period monitoring is a manual process with typed events emitted for each step.

---

## §6 — Security Safeguards

### 6.1 Obligation framework

POPIA s.19 requires the Bank, as responsible party, to secure the integrity and confidentiality of personal information by taking appropriate and reasonable technical and organisational measures. The s.19 obligation requires the Bank to:

(a) Identify reasonably foreseeable internal and external risks to personal information
(b) Establish and maintain appropriate safeguards against identified risks
(c) Regularly verify that safeguards are effectively implemented
(d) Ensure safeguards are continually updated in response to new risks or information

Obligation: ORG-PR(IV)-06. Counterpart policy: Information Security Policy (Rashida lead; Senna substrate).

### 6.2 Joint Standard 2 of 2024 alignment

The Bank's security-safeguard framework is co-anchored on the Joint Standard 2 of 2024 on Cybersecurity and Cyber Resilience (PA / FSCA), which is a binding prudential standard on Hoz Bank Limited as a banks-act-regulated institution. Joint Standard 2 of 2024 requirements sit alongside and reinforce the POPIA s.19 obligation. Where Joint Standard 2 of 2024 imposes a more demanding standard than POPIA s.19, the higher standard governs. Obligation: ORG-BNK-CYBER-CONS.

### 6.3 Technical safeguards

The following technical safeguards are in place at the current substrate level (synthetic data only in build phase; same controls apply to live personal data from licence-day onwards):

| Control | Description | Substrate evidence form |
|---|---|---|
| **Encryption at rest — per-field** | Every special-category personal-information field is encrypted at rest using HSM-bound keys. General personal-information fields are encrypted at the storage-layer. Key domain segregation by processing purpose — no cross-purpose key reuse | Schema-registry attribute + key-binding event per field; `prototype/platform/event-store/registry.ts` field-classification annotations |
| **Encryption in transit** | All internal service-to-service communication is encrypted via mTLS; no plaintext personal information on the wire. External-facing APIs use TLS 1.3 minimum | Service-mesh enforcement events; certificate-rotation event log |
| **Key-domain segregation by purpose** | Encryption keys are scoped to processing purpose; a key for customer-onboarding data cannot be used to decrypt AML-investigation data | Key-issuance events carry purpose tag; cross-purpose access produces a security event |
| **Access-by-purpose** | Read access to sensitive personal information requires a typed purpose declaration at the access layer; access events carry purpose attribute for detection of access-pattern anomalies | Access events; projection-layer access-gate |
| **Audit-log integrity** | Event log is tamper-evident; events are append-only and hash-chained; silent rewrite is not possible | Hash-chained event log (`prototype/platform/event-store/`); periodic third-party-witness protocol (Atlas + Senna) |
| **Network segmentation** | Sensitive-data zones (customer PI, AML investigation data, fit-and-proper records) are isolated network segments; egress is controlled | IaC policy-as-code; observed-flows report per sprint |
| **Zero-trust identity** | Every service, agent, and user authenticates before accessing any resource; no implicit trust based on network position. Entra ID (Azure production target) for identity federation | Service-identity events; agent-identity binding events per `AgentRegistered` |
| **FIPS Level 3 HSM** | Cryptographic key operations for personal-information encryption use FIPS Level 3 hardware security modules (Azure Key Vault Managed HSM in production). Build-phase uses software-HSM equivalent | Key-operation events; HSM-attestation events |
| **DLP + EDR on operator endpoints** | Data loss prevention and endpoint detection and response on all operator (human and agent) endpoints | Endpoint events ingested into detection pipeline (Senna's IR infrastructure) |

### 6.4 Organisational safeguards

| Control | Description |
|---|---|
| **Operator agreements** | Every processor handling personal information on the Bank's behalf is subject to a written operator agreement per POPIA s.20 (§8 of this Policy) |
| **Access-control policy** | Role-based access control; principle of least privilege; access is revoked immediately on termination of role or service relationship |
| **Security awareness** | All agents (human and AI) with access to personal information receive briefing on POPIA obligations and the Bank's security-safeguard standards |
| **Threat modelling** | Per-design threat modelling on all systems processing personal information (Senna + Rashida); formal threat model produced before each new system or feature that involves personal information |
| **Periodic s.19 review** | Quarterly joint review: Iris (IO) + Rashida (CISO) + Senna (Security engineer). Output: register entry for the cycle; combined-assurance record updated |
| **Vendor security assessment** | Processors and sub-processors subject to security due-diligence assessment before onboarding; annual re-assessment (§8 of this Policy) |

### 6.5 Adequacy of safeguards — joint attestation framework

The Information Officer (Iris) is responsible for asserting that POPIA s.19 security safeguards are in place. The CISO (Rashida) is responsible for attesting to the adequacy of those safeguards against the threat model and Joint Standard 2 of 2024 requirements. These are distinct accountabilities: Iris asserts existence and legal sufficiency; Rashida attests adequacy against the technical standard. The seam between them is formalised via the quarterly s.19–22 joint review protocol (per `Owner Inbox/2026-05-07_iris_popia-s19-s22-walkthrough-for-rashida.md`).

---

## §7 — Data Breach Notification

### 7.1 Obligation framework

POPIA s.22 requires that where there are reasonable grounds to believe that personal information has been accessed or acquired by an unauthorised person, the responsible party must notify:
1. The Information Regulator
2. The affected data subject(s) (unless the data subject's identity cannot be established)

Notification must be in the prescribed form, as soon as reasonably possible, and contain sufficient information to allow the data subject to take protective measures.

Obligations: ORG-PR(IV)-07 (s.22 notification); ORG-PR(IV)-06 (ss.19–22 security safeguards).

**72-hour target.** Whilst POPIA s.22 uses the standard "as soon as reasonably possible", the Bank adopts a 72-hour-from-grounds-for-belief notification target to the Information Regulator as its operating standard, consistent with comparative international frameworks and the Bank's Joint Standard 2 of 2024 cyber-incident-notification obligations (which run in parallel — see §7.5). The two notification paths share the same incident record.

### 7.2 Trigger — what constitutes a notifiable compromise

A "security compromise" within the meaning of POPIA s.22 arises when:
- There are **reasonable grounds to believe** (not proof beyond doubt) that personal information held by the Bank has been accessed, acquired, or was at risk of access or acquisition by an **unauthorised person**
- The compromise includes: data-exfiltration incidents, ransomware events where personal information was exposed to encryption or copying, misconfigured access controls exposing personal information, credential theft where personal information was accessible, insider access to personal information without a registered purpose

**Not every security incident is a notifiable breach.** An incident affecting systems that do not hold personal information, or affecting personal information that was fully encrypted and where the key material was not exposed, may not rise to the level of "reasonable grounds". The assessment is mandatory and is documented in every case.

### 7.3 Breach-response workflow

The breach-notification workflow is automated end-to-end. The trigger event is `PersonalInformationCompromiseSuspected`, raised by the detection pipeline (Senna's IR infrastructure / Rashida's function), or by any operator, customer-service, or external party reporting an incident.

**Step 1 — Detection and initial triage**
- `PersonalInformationCompromiseSuspected` event is emitted by the detection pipeline or entered manually
- Immediate notification to: CISO (Rashida), Information Officer (Iris), and MLRO/CCO (Zara) is triggered
- A dedicated incident record is opened in the event store; all subsequent events reference this incident-record ID

**Step 2 — Severity and scope assessment**
- Iris (IO) + Rashida (CISO) + Senna (Security engineer) conduct the assessment: are there reasonable grounds for belief?
- Assessment evaluates: nature of the information (special category, financial, general); volume of data subjects affected; likelihood of harm; encryption status at time of compromise; whether attacker had key material
- Outcome event: `CompromiseAssessmentCompleted { incidentId, groundsForBelief: boolean, specialCategoryInvolved: boolean, dataSubjectsAffected: number | 'unknown', assessedSeverity: 'critical' | 'high' | 'medium' | 'low' }`

**Step 3 — Containment and forensic preservation**
- Rashida / Senna own this step: isolation, containment, forensic snapshot
- Workflow pauses for `ContainmentConfirmed` and `ForensicSnapshotTaken` events from the security function
- Forensic preservation ensures that the notification-content requirements can be met from the forensic record

**Step 4 — Information Regulator notification (s.22)**
- Initiated as soon as `CompromiseAssessmentCompleted` event shows `groundsForBelief: true`
- The workflow generates the prescribed-form notification from structured data (no manual template assembly)
- Notification is signed by the Information Officer (Iris); Owen (Company Secretary, governance) co-witnesses
- A `BreachNotificationDispatched { recipient: 'information-regulator', dispatchTimestamp, incidentId }` event is emitted
- **72-hour clock** is tracked from `CompromiseAssessmentCompleted.timestamp` to `BreachNotificationDispatched.timestamp`; any delay beyond 72 hours is surfaced with cause (the statutory standard is "as soon as reasonably possible"; the 72-hour target is the Bank's operating standard)

**Step 5 — Data-subject notification (s.22)**
- Generated per affected data subject from the same structured data as the Regulator notification
- Channel is the data subject's registered communication channel; format is plain language meeting s.22(3) content requirements
- `BreachNotificationDispatched { recipient: 'data-subject', dataSubjectId, dispatchTimestamp, incidentId }` event emitted per data subject
- Where data-subject identity cannot be established, this is recorded with reasons; the Information Regulator is informed

**Step 6 — Post-incident reconciliation and closure**
- The incident record is closed only when all three are evidenced as events: (a) s.22 timing requirement met; (b) data-subject coverage complete (or documented exemption); (c) s.19 corrective-action requirement satisfied (Rashida attests)
- `IncidentClosed { incidentId, timingRequirementMet: boolean, coverageComplete: boolean, correctiveActionCompleted: boolean }` event is emitted
- The incident record feeds the combined-assurance record for the quarterly s.19–22 joint review
- Vera (Internal-audit / continuous-assurance engineer) recon assertion: every `PersonalInformationCompromiseSuspected` event has a downstream `IncidentClosed` event within the expected window

**Procedure reference:** `Procedures/popia-breach-notification.md`.

**Substrate gap:** s.22 breach-notification automation (72-hour clock as typed event; data-subject notification dispatch) is not yet fully productised per `Team/Iris.md` §16. Until productised, steps 4–5 are manually executed with typed events emitted at each step.

### 7.4 Notification content requirements (POPIA s.22(3))

The notification to the Information Regulator and to data subjects must contain:
- Particulars of the security compromise (description of the incident)
- Whether the Bank knows or can reasonably confirm whether the information was actually acquired by an unauthorised person
- The personal information involved (categories and approximate volume)
- Identity of the person(s) who may have unlawfully accessed the information (if known)
- Measures the Bank has taken or intends to take to prevent further loss of information
- Guidance on protective steps the data subject can take (for data-subject notifications)
- Whether the Bank has reported the compromise to the South African Police Service

All notifications are generated from structured data in the incident record; no narrative assembly independent of the structured data.

### 7.5 Parallel notification path — Joint Standard 2 of 2024

Cyber-incident reporting obligations under Joint Standard 2 of 2024 (PA / FSCA) run in parallel to the POPIA s.22 path. The Bank maintains a single incident record for each event; both notification paths reference the same record and timestamps are derived from the same events. Rashida (CISO) owns the Joint Standard 2 / cyber-incident-notification path; Iris (IO) owns the POPIA s.22 path. The combined-assurance record closes the incident only when both paths are complete.

---

## §8 — Cross-Border Transfers

### 8.1 Obligation framework

POPIA s.72 restricts transfers of personal information outside the Republic of South Africa to recipients who are not subject to the requirements of POPIA. A transfer is permissible only if one of the following conditions is met:

| Condition | POPIA s.72 reference |
|---|---|
| **Adequate law or binding agreement** — the recipient's jurisdiction provides an adequate level of protection by reason of domestic law or a binding agreement that includes the POPIA equivalent conditions | s.72(1)(a) |
| **Consent** — the data subject consents to the transfer | s.72(1)(b) |
| **Contractual necessity** — the transfer is necessary for the performance of a contract to which the data subject is party, or pre-contractual steps at the data subject's request | s.72(1)(c) |
| **Benefit of the data subject** — the transfer is for the benefit of the data subject, and it is not reasonably practicable to obtain consent and the data subject would likely consent | s.72(1)(d) |
| **Contract in data subject's interest** — the transfer is necessary for the conclusion or performance of a contract concluded in the interest of the data subject between the Bank and a third party | s.72(1)(e) |

Obligation: ORG-PR(IV)-15.

**SARB Directive 3 of 2018 overlap.** Cross-border data flows that constitute "cloud computing and offshoring" within the meaning of SARB PA Directive 3 of 2018 also require: prior notification to the Prudential Authority, risk assessment and contractual provisions on data-access by foreign authorities, exit-plan documentation, and continued PA access to data and systems for supervisory purposes. Both regimes apply simultaneously; the more demanding requirement governs each aspect.

### 8.2 Adequacy assessment process

Before any cross-border transfer, the Bank conducts an adequacy assessment that considers:
1. The law in force in the recipient country as it relates to processing of personal information
2. International obligations entered into by the recipient country regarding personal information
3. Whether binding corporate rules, model clauses, or POPIA-equivalent binding agreements govern the transfer
4. The technical safeguards applied to the transferred data (encryption at rest and in transit; access controls; key management)
5. Contractual provisions: data-processing agreement, sub-processor controls, data-subject rights pass-through, foreign-authority-access provisions (per Directive 3 of 2018 requirements), audit rights, breach notification obligations, exit provisions

**Processor involvement:** where the cross-border transfer is to a processor (operator in POPIA terminology), the operator agreement (§9 of this Policy) must address the cross-border safeguards.

**Register:** all approved cross-border transfers are recorded in the cross-border-transfer register (a named sub-register in the lawful-processing register) with: jurisdictions involved, data categories, transfer mechanism (lawful basis condition), technical safeguards, contractual safeguards, periodic review date. Each approval emits a `CrossBorderTransferApproved` event.

### 8.3 Current cross-border transfer register

**FATCA / CRS submissions (COMMENCEMENT-BIND)**

| Attribute | Detail |
|---|---|
| Jurisdictions | South Africa (SARS) → United States (IRS, via SARS eFiling under SA-US FATCA IGA) + OECD partner CRS jurisdictions via SARS CTS |
| Data categories | Tax-residency self-certification data; counterparty-NI data; account-balance and payment data for reportable accounts |
| Lawful basis (POPIA s.72) | s.72(1)(a) — transfer is necessary for performance of a legal obligation; SA-US FATCA IGA is a binding international agreement; OECD CRS is implemented domestically via Tax Administration Act |
| Technical safeguards | Encryption at rest; transmission over SARS eFiling (published SARS certificates and signing specifications); audit events on every submission |
| SARB Directive 3 of 2018 status | Pre-licence registration with PA prepared; lodged on licence-grant |

**Microsoft Azure (cloud target — production) (CORPORATE-BIND, now as infrastructure; data processing at licence-day)**

| Attribute | Detail |
|---|---|
| Jurisdictions | Primary: Azure South Africa North (Johannesburg); Paired secondary: Azure South Africa West (Cape Town). Cross-border element: Azure global backbone for management plane and replication traffic |
| Data categories | All personal information categories held by the Bank, as primary cloud-processing environment |
| Lawful basis (POPIA s.72) | s.72(1)(a) — Microsoft's binding corporate rules (BCR) / standard contractual commitments equivalent; technical safeguards including Customer-Managed Keys (CMK), Azure Confidential Computing, and region-pinning to South Africa primary achieve equivalent protection; POPIA s.72(1)(b) consent supplements for specific processing categories |
| Technical safeguards | Customer-Managed Keys in Azure Key Vault Managed HSM (FIPS Level 3); Confidential Computing for sensitive workloads; region-pinning; TLS 1.3 in transit; mTLS for service-to-service |
| SARB Directive 3 of 2018 status | Full cloud-and-offshoring submission lodged on licence-grant; PA exit-plan in runbook; PA access to data and systems provision included in Microsoft Data Processing Agreement; foreign-authority-access-notification clause negotiated |

**Anthropic API (AI processing — build phase and beyond)**

| Attribute | Detail |
|---|---|
| Jurisdictions | Anthropic Inc. (San Francisco, United States) |
| Data categories | Content of prompts submitted to the Anthropic Claude API — including agent run inputs, policy-drafting context, and any personal information contained in prompts in the ordinary course of build-phase operations |
| Lawful basis (POPIA s.72) | s.72(1)(a) — Anthropic's Data Processing Addendum (DPA) provides POPIA-equivalent contractual protections; the Bank has executed (or will execute) the DPA prior to any processing of personal information via the API; s.72(1)(c) — contractual necessity for performance of the Bank's AI-driven operating model; s.72(1)(b) — where the content of a prompt relates to a data subject (e.g. a named director's biographical information submitted in a governance context), that data subject's legitimate interest in the Bank's AI-driven operations |
| Technical safeguards | No Anthropic model training on API data under the DPA; data treated as confidential; in-transit encryption; the Bank's prompt-engineering practice avoids embedding unnecessary personal information in API calls; the data-minimisation principle (§5.1) applies to prompt content |
| SARB Directive 3 of 2018 status | Anthropic API is a cloud-offshoring arrangement; PA notification and risk-assessment prepared; lodged on licence-grant. Build-phase processing is minimal (Marc as data subject; build-phase agent coordination) |

### 8.4 Prohibited transfers

The Bank does not transfer personal information to a jurisdiction or recipient that does not meet any of the POPIA s.72 conditions. Any proposed transfer that cannot be brought within an approved condition is escalated to the Information Officer before processing commences.

---

## §9 — Third-Party Processors (Operators)

### 9.1 Operator agreements (POPIA s.20, s.21, ORG-PR(IV)-06)

POPIA s.20 requires the Bank, as responsible party, to ensure that any operator (a person who processes personal information on behalf of the Bank under a written contract) establishes and maintains the security safeguards required by POPIA s.19. Processing by an operator without a written contract is prohibited.

Every processor engaged by the Bank to process personal information on its behalf must have in place a written operator agreement (Data Processing Agreement or DPA) that:
1. Authorises the processor to process only for the purposes specified in the agreement and only as directed by the Bank
2. Requires the processor to implement the s.19 security safeguards (or Joint Standard 2 of 2024 equivalent, whichever is more demanding)
3. Imposes an obligation on the processor to notify the Bank immediately on becoming aware of any actual or suspected security compromise affecting the Bank's personal information
4. Gives the Bank the right to audit the processor's security safeguards, either directly or through an independent third party
5. Prohibits the processor from engaging sub-processors without the Bank's prior written consent; where sub-processors are engaged, the operator agreement must flow down to sub-processors
6. Requires the processor to return or destroy the Bank's personal information at the end of the agreement; confirms the Bank's ability to audit the destruction
7. Addresses cross-border transfer provisions where the processor is outside South Africa (§8 of this Policy)

Obligation: ORG-PR(IV)-06 (ss.19–20 security safeguards and operator accountability).

**Operator agreement template.** The standard operator agreement template is authored and maintained by Imani (Legal-as-code engineer) under the clause-library substrate (`Owner Inbox/2026-05-07_imani_clause-library-v0-and-fix-a-demonstration.md`). Every onboarded processor is issued an agreement from the template; derogations require Information Officer and General Counsel / CCO sign-off.

### 9.2 Processor due diligence

Before engaging any processor that will handle personal information, the Bank conducts a processor due-diligence review that covers:

1. **Security posture** — review of the processor's information-security certifications (ISO 27001, SOC 2 Type II, or equivalent); confirmation of encryption at rest and in transit; access control; incident-response capability
2. **Sub-processor mapping** — identification of all sub-processors the processor engages; confirmation of flow-down obligations
3. **Cross-border assessment** — if the processor is outside South Africa, completion of the s.72 adequacy assessment (§8.2)
4. **SARB Directive 3 compliance** (for cloud / offshoring processors) — completion of Directive 3 notification / risk assessment requirements
5. **Breach-notification responsiveness** — evidence that the processor can detect and notify the Bank of a compromise within the timeframe required by this Policy's §7 workflow
6. **Contractual sign-off** — the operator agreement is executed by Imani (contract drafting) and the Information Officer (Information Officer) before first processing commences

Annual re-assessment is conducted for material processors (processors handling large volumes of personal information or special-category personal information).

### 9.3 Processor register

All approved processors are recorded in the processor register (a sub-register of the vendor / outsourcing register maintained by Devon (COO, governance) and Imani). The processor register carries: processor identity, processing scope, data categories, geographic location, sub-processors approved, agreement date, agreement expiry, next due-diligence date.

Each onboarded processor emits a `ProcessorOnboarded` event in the event store; each re-assessment emits a `ProcessorRe-assessed` event.

**Counterpart procedure:** `Procedures/by-policy/vendor-processor-onboarding.md` (Imani + Devon).

### 9.4 Anthropic API — primary processor

The Anthropic API is the Bank's largest current personal-information processing flow in build phase. Anthropic Inc. acts as an operator within the meaning of POPIA s.20 in respect of any personal information contained in prompt content submitted to the API.

**Controls in place:**
- The Bank's Anthropic API usage is governed by Anthropic's DPA, which includes data-processing terms covering confidentiality, no-training-on-API-data commitments, security safeguards, and incident notification
- The data-minimisation principle is applied to prompt content: agents are designed to avoid embedding unnecessary personal information in API calls; structured data is preferred over natural-language personal-information references in prompts
- Personal information in prompts is limited to what is strictly necessary for the task being performed by the agent
- The cross-border-transfer register carries Anthropic as an approved transfer (§8.3)
- The processor due-diligence review for Anthropic is maintained on the processor register; annual re-assessment is conducted

Iris and Zara jointly oversee the Anthropic DPA; Senna attests to technical-safeguard adequacy; Atlas (Core banking platform architect) owns the engineering-side prompt-design controls.

### 9.5 Liability and indemnification

Where a processor causes a POPIA breach (access, loss, destruction, or unauthorised disclosure of personal information), the Bank remains the responsible party vis-à-vis the Information Regulator and affected data subjects. The operator agreement must therefore include: (a) the processor's indemnification of the Bank for losses arising from the processor's breach of its POPIA obligations; (b) the Bank's right of action against the processor in respect of data-subject claims; (c) insurance requirements sufficient to make the indemnification meaningful.

---

## §10 — Governance, Review, and Enforcement

### 10.1 Policy governance

This Policy is owned by Iris (Information Officer, governance), co-authored by Zara (Compliance / legal-as-code engineer), and approved by the BRC and S&E Committee (interim CEO approval pending BRC constitution at licence-day). It is reviewed annually and on any material change in POPIA, related regulations, or the Bank's processing activities.

Material changes requiring an out-of-cycle review include:
- Commencement of a new material processing purpose
- Enactment of new POPIA regulations, codes of conduct, or Information Regulator guidance
- A notifiable breach
- Structural change to the Bank's group structure or legal-entity tree
- Acquisition of a new processor or material change to an existing processor's scope

### 10.2 Compliance monitoring

Iris's weekly `POPIAControlsSnapshot` autonomous run monitors:
- Obligations register status (ORG-PR(IV) domain) — all obligations in-force / PARTIAL / PLANNED
- DSAR queue — outstanding requests, age, overdue items
- Breach-notification events — any open `PersonalInformationCompromiseSuspected` events
- Consent-withdrawal propagation — any withdrawn consents not yet propagated
- Cross-border-transfer gate — any proposed transfers awaiting approval
- Processor register — any processors in re-assessment overdue

Output is filed to `Owner Inbox/` on each run; `decision-required: true` frontmatter lifts into the Decisions dashboard for CEO attention where applicable.

The quarterly s.19–22 joint review (Iris + Rashida + Senna) produces a combined-assurance record that feeds the Audit Committee's continuous-controls package (Thandiwe (Chief Audit Executive, governance) function).

### 10.3 Breach and escalation

A violation of this Policy (including an unauthorised cross-border transfer, a failure to maintain an operator agreement, a failure to respond to a DSAR within the statutory timeframe, or a breach of the data-minimisation principle) is:
- A `PolicyBreachRegistered` event emitted immediately on detection
- Escalated to the Information Officer, CISO (Rashida), and CCO (Zara) within 24 hours
- Evaluated by Iris for reportability to the Information Regulator
- Reported to the BRC / CEO at the next governance cycle (or immediately for Critical-severity events)

Vera (Internal-audit / continuous-assurance engineer) performs continuous recon assertions on POPIA obligations per Wave-4 planned pipeline; findings are surfaced as recon events with Iris and Zara as named addressees.

### 10.4 Information Regulator engagement

The Information Regulator of South Africa is the statutory regulator with jurisdiction over POPIA and PAIA compliance. The Bank's interaction with the Information Regulator is managed by the Information Officer (Iris / triple-hatted Compliance Lead at licence-day). All correspondence with the Information Regulator is logged as a `InformationRegulatorInquiry` event in the event store.

**Contact:** Information Regulator (South Africa), JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001; `inforeg@justice.gov.za`.

---

## §11 — Obligations closure table

This Policy is the primary implementing instrument for the following 17 obligations in the obligations register (`Regulations/_obligations-register.md`, Domain F):

| Obligation | POPIA / PAIA citation | Status | Policy section |
|---|---|---|---|
| ORG-PR(IV)-01 | POPIA s.11 — lawful basis | IN FORCE | §3 |
| ORG-PR(IV)-02 | POPIA s.13 — purpose documentation | IN FORCE | §3.3 |
| ORG-PR(IV)-03 | POPIA s.14 — retention schedule | IN FORCE | §5.2 |
| ORG-PR(IV)-04 | POPIA s.15 — further processing | IN FORCE | §3.3 |
| ORG-PR(IV)-05 | POPIA s.18 — notice to data subjects | IN FORCE | §3 (data-subject notice is addressed in the lawful-processing register per processing purpose; a dedicated Consent and Notice Policy is a planned counterpart instrument) |
| ORG-PR(IV)-06 | POPIA ss.19–22 — security safeguards | IN FORCE | §6, §7, §9 |
| ORG-PR(IV)-07 | POPIA s.22 — breach notification | IN FORCE | §7 |
| ORG-PR(IV)-08 | POPIA s.23 — right of access | IN FORCE | §4.2 |
| ORG-PR(IV)-09 | POPIA s.24 — correction and deletion | IN FORCE | §4.3 |
| ORG-PR(IV)-10 | POPIA s.71 — automated decision-making | IN FORCE | §4.5 |
| ORG-PR(IV)-11 | POPIA s.34 — special personal information | IN FORCE | §3.4 |
| ORG-PR(IV)-12 | POPIA s.35 — children's information | IN FORCE | §3.5 |
| ORG-PR(IV)-13 | POPIA ss.55–56 + Reg. 4 — IO designation | PARTIAL (E1 gap — formal lodgment deferred to licence-day) | §2 |
| ORG-PR(IV)-14 | POPIA s.57 — prior authorisation; IO duties | IN FORCE | §2.3 |
| ORG-PR(IV)-15 | POPIA s.72 — cross-border transfer | IN FORCE | §8 |
| ORG-PR(IV)-16 | PAIA s.51 — PAIA Manual | IN FORCE | §2.4 |
| ORG-PR(IV)-17 | PAIA — respond to PAIA requests | IN FORCE | §4.2 |
| ORG-PR(IV)-13-GLOSS-DEPUTY-IO | POPIA ss.55–56; POPIA Reg. 4 (deputy IO) | PARTIAL (lodgment at licence-day) | §2.5 |

---

## §12 — Substrate gaps summary

The following substrate gaps are tracked against this Policy. Each gap is a `PLANNED` item with named owner; the Policy obligations above are IN FORCE at the policy layer pending substrate productisation.

| # | Gap description | Owner | Phase |
|---|---|---|---|
| 1 | DSAR pipeline — identity-verification step and full projection-walk productisation | Iris + Anya | v1 |
| 2 | Automated breach-notification workflow — s.22 72-hour clock as typed event; data-subject notification dispatch automation | Iris + Senna | Extension of PROC-PRIV-01 |
| 3 | Consent-withdrawal-propagation projection — propagation of `ConsentWithdrawn` through all affected projections | Anya (spec'd; not yet built) | v1 |
| 4 | Cross-border-transfer gate — vendor / outsourcing pipeline pause for Iris adequacy sign-off as a typed gate | Imani + Iris | v1 |
| 5 | PAIA Manual generator — reading from lawful-processing register and event log per Principle 1 | Iris + Anya | v1 |
| 6 | Retention-clock projection and disposal workflow — automated retention-period monitoring and `RetentionPeriodExpired` → `PersonalInformationDisposed` workflow | Atlas + Iris | v1 |
| 7 | IO designation typed event family — `IODesignationFiled` / `IODesignationChanged` / `PAIAManualPublished` | Atlas | v1 (cross-refs `claude/atlas-legal-entity-event-family-v0`) |
| 8 | Lawful-processing register as a dedicated substrate — currently co-located in `Regulations/_obligations-register.md`; dedicated projection is a tracked gap | Anya + Iris | v1 |
| 9 | Per-entity POPIA / PAIA request-handling pipeline (entity-aware routing) | Iris + Anya | v1 |

---

*Policy authored: 2026-05-11. Authors: Iris (Information Officer, governance) + Zara (Compliance / legal-as-code engineer). Review authority: BRC + S&E Committee (interim CEO approval). Next review: 2027-05-11 or on material trigger.*
