# Governance framework

**Author:** Helena (CRO — lead)
**Co-authors:** Owen (CoSec — governance machinery), Zara (CCO — regulatory designations), Iris (IO — privacy), Imani (corporate-law dimension)
**Contributors:** Mira, Sade, Vera, Atlas, Senna
**Date:** 2026-05-06
**For:** Marc (CEO)

> **Note on derivation (Principle 6).** This framework derives from the architectural principles in `CLAUDE.md`, the team structure, the role briefs in `Team Inbox/`, and the persona files in `/Team/`. Substantive content is sourced from regulatory instruments cited inline. The framework will become the *standard* layer that policies derive from, which presentations summarise.

---

## 1. Board

### Composition (target state, post-licence)

- Independent non-executive directors (NEDs) constituting a **majority**.
- An **independent chair**, separate from CEO.
- Executive directors: CEO and CFO at minimum; CRO observer rights in all sessions.
- Skills-and-diversity matrix covering: banking strategy, finance and capital, risk management, conduct and compliance, technology and cyber, legal, transformation / B-BBEE, customer / market.
- Tenure policy: independence cap at 9 years; staggered terms; mandatory development.

### Reserved matters (only the Board may approve)

- Risk Appetite Statement (this framework's sibling deliverable).
- Capital plan and capital actions above thresholds.
- Material acquisitions, disposals, partnerships.
- Material outsourcing under SARB Directive 3 of 2018.
- Annual financial statements.
- Remuneration policy and executive remuneration.
- Appointment / removal of executive directors, CRO, CFO, CCO, CISO, CAE, CoSec, IO, External Auditor.
- Material policy approvals (see policy taxonomy below).
- Conflicts and related-party transactions above thresholds.
- Strategic plan and budget.

### Charter, induction, evaluation

- Board charter authored by Owen, approved by the Board.
- Induction pack per director — bank's principles (`CLAUDE.md`), governance framework (this), RAS / RAF, Companies Act and Banks Act director-duty briefing.
- Annual board evaluation; triennial external evaluation.

### Conflicts and related-party transactions

- Standing register maintained by Owen as an event log: `ConflictDeclared`, `ConflictResolved`, `RelatedPartyTransactionApproved`, etc.
- Pre-meeting declarations mandatory.
- Materiality thresholds set in the Delegation of Authority (§6).

### Whistleblowing, code of conduct, code of ethics

- Whistleblowing channel — externally hosted, evidence-grade, anonymous-permissible.
- Code of conduct and code of ethics — board-approved policies, register-linked.
- Owen co-ordinates with Zara on case routing and Vera on independence.

## 2. Sub-committees — draft charters

All committees authored by Owen; risk and audit charters approved by Helena and Vera respectively pre-board-approval.

### 2.1 Risk Committee (BRC)

- **Purpose:** Oversight of risk taxonomy; approval of RAS; review of ICAAP / ILAAP; oversight of stress testing, model risk, cyber risk, financial-crime risk; recommendation to Board.
- **Composition:** Chaired by an independent NED; majority NEDs; CEO, CRO, CCO, CISO (when appointed) attend.
- **Cadence:** Monthly initially, quarterly post-licence stabilisation.
- **Authority:** Approves limit-framework changes within Board-set RAS; recommends RAS changes to Board.

### 2.2 Audit Committee (AC)

- **Purpose:** Oversight of financial reporting integrity; internal audit; external audit; internal control; fraud.
- **Composition:** Chaired by an independent NED with finance expertise; majority NEDs; CFO, CAE (when appointed), External Auditor attend.
- **Cadence:** Quarterly minimum; ad hoc as required.
- **Authority:** Recommends FS approval; approves internal audit plan; oversees External Auditor independence and effectiveness.

### 2.3 Remuneration Committee (RemCo)

- **Purpose:** Executive remuneration; alignment of remuneration to risk; malus and clawback; remuneration policy.
- **Composition:** Chaired by an independent NED; majority NEDs; CHRO (when appointed) attends.
- **Cadence:** Quarterly.
- **Authority:** Approves executive remuneration within Board-set policy; recommends policy to Board.

### 2.4 Social & Ethics Committee (S&E)

Required by Companies Act regulation 43.

- **Purpose:** Oversight of social, ethical, environmental, transformation, climate, conduct.
- **Composition:** At least one independent NED; minimum three members.
- **Cadence:** Semi-annual minimum.
- **Authority:** Approves social-and-ethics annual report; oversees climate-related-risk programme (PA Guidance Note 1 of 2024) jointly with BRC.

### 2.5 Nominations Committee (NomCo)

- **Purpose:** Board composition and succession; director fit-and-proper at appointment; skills matrix maintenance.
- **Composition:** Chaired by an independent NED (typically Board Chair); majority NEDs.
- **Cadence:** Semi-annual minimum.

### 2.6 Credit Committee (CreCo) — when needed

- Stood up when the lending book is non-trivial. Until then a Delegation of Authority chain handles credit decisions to a defined threshold.

### 2.7 Asset and Liability Committee (ALCO)

- **Purpose:** Balance-sheet management — funding, liquidity, IRRBB, FX, capital-instrument actions, FTP.
- **Composition:** Chaired by **Eitan (Treasurer)**; CFO, CRO (or risk delegate), Head of Global Markets, COO attend; Mira / Zara on AML / sanctions touchpoints to counterparties.
- **Cadence:** Weekly initially, semi-monthly stabilised.
- **Authority:** Operates within RAS / RAF limits.

## 3. Executive structure and named accountabilities

Source: `CLAUDE.md` and the role briefs. The agent fleet (Helena, Devon, Camille, Eitan, Saskia, Owen, Zara, Iris, Thandiwe, Rashida, Scrooge) is the bank's standing autonomous executive layer (Principle 7); the named *human* seats appointed at licence-day are the regulator-facing accountabilities the agent outputs flow through. The thin-human-layer composition that satisfies SA banking law at licence-day is set out in §3A below; the steady-state engineering-vs-governance split is summarised in the table that follows.

### 3A. Thin human layer at licence-day — six humans + Marc + audit firm

**Decision authority.** D-THIN-HUMAN-LAYER-MINIMUM, approved 2026-05-08 (CEO modify): tighten the original Owen+Imani draft from five to six separate humans + Marc + external audit firm. The modification adds a separate human CRO before licence-application lodgment, per Mira+Zara's Joint Standard 1 of 2024 challenge (interim-CRO-as-CEO is a structural finding under JS 1 of 2024 §6–§7, not just a SARB-precedent matter).

| # | Seat | Regulatory anchor | Human / Marc / firm | Appointment cadence |
|---|---|---|---|---|
| 1 | **Independent Chair** + Audit Committee Chair + S&E Committee independent NED | Companies Act s.66; s.94; Reg.43; Banks Act s.60; King IV | New hire — independent NED | Before licence-application lodgment |
| 2 | **NED #2** + Audit Committee member | Companies Act s.94; Banks Act s.60 | New hire — independent NED | Before licence-application lodgment |
| 3 | **NED #3** + Audit Committee member | Companies Act s.94; Banks Act s.60 | New hire — non-executive director | Before licence-application lodgment |
| 4 | **Company Secretary** | Companies Act ss.86–89 | New hire — CoSec (cannot be Marc) | Before licence-application lodgment |
| 5 | **Triple-hatted Compliance Lead** — MLRO + FIC Compliance Officer + POPIA Information Officer | FIC Act s.43A; FIC Act s.43B; POPIA s.56 | New hire — compliance lead | Before licence-application lodgment |
| 6 | **Chief Risk Officer (human seat)** — Banks Act CRO; second-line independence under JS 1 of 2024 | Banks Act s.60; Joint Standard 1 of 2024 §6–§7; BCBS Corp Gov Principles 2015 §3 | New hire — human CRO | **Before licence-application lodgment** *(NEW per D-THIN-HUMAN-LAYER-MINIMUM)* |
| Marc | **CEO** + executive director + Public Officer + interim Banks Act CFO + interim FAIS Key Individual (until counsel confirms FSP scope) | Banks Act + Companies Act + Tax Admin Act + FAIS s.8 | Marc | Already in seat |
| External | **External auditor (firm; key audit partner is auditor's named individual)** | Banks Act s.61; Companies Act s.90; Auditing Profession Act 26 of 2005 | Audit firm (PA-approved). The key audit partner is an employee of the audit firm and **not on the bank's roster** — the firm is the bank's appointment, the partner is the firm's. | Appointed at licence-application lodgment |

**Roster headline.** Six separate humans + Marc on the bank's roster; one external audit firm appointed under Banks Act s.61. The six-human composition is the regulator-facing answer to *"who, statutorily?"* in the SARB licence-application file.

**Reporting lines.**

- Independent Chair → chairs the Board; reports through Board fiduciary structure to shareholders.
- NED #2 and NED #3 → Board members; AC members.
- Company Secretary → Board; functional independence from CEO under Companies Act s.86(2)(b).
- Triple-hatted Compliance Lead → CEO administratively; **functionally to the Board / AC** for STR-escalation and POPIA-Regulator pathways (this preserves the second-line independence FIC's published RMCP guidance requires).
- Human CRO → CEO administratively; **functionally to the Board / BRC** for risk-appetite and limit-breach pathways (JS 1 of 2024 §7).

**Engineering-vs-governance reconciliation.** The agents Helena (engineering CRO), Camille (engineering CFO), Owen (engineering CoSec), Zara (engineering CCO + named MLRO of the agent fleet), Iris (engineering IO) continue to operate as standing autonomous agents. The licence-day human seats are the regulator-facing designations the agent outputs flow through (Principle 7). For the named CRO and MLRO+FIC CO+IO seats this is **load-bearing**: the human carries the legal designation, the agent carries the operational substrate.

### 3B. Alternates split (deputy-IO and MLRO-alternate)

Per D-THIN-HUMAN-LAYER-MINIMUM and Mira+Zara's §4.2 conduct-side amplification, the deputy-IO and MLRO-alternate roles are **split across two humans** rather than both falling on the CoSec:

- **Deputy POPIA Information Officer = Company Secretary** (seat #4). POPIA Regulation 4 contemplates a deputy; the CoSec carries this designation alongside the Compliance Lead's primary IO role. Lodgment with the Information Regulator follows the primary IO designation.
- **MLRO-alternate = the AC-Chair NED** (seat #1). FIC published guidance on accountable-institution governance recommends an MLRO-alternate; the AC Chair is the designated alternate on the basis that AC oversight already touches AML/CFT controls, and to avoid a single-point-of-failure at the CoSec seat. The fit-and-proper file declares this overlap explicitly per Mira+Zara §4.3.

This split supersedes any earlier draft that named the CoSec for both alternates.

### 3C. FAIS Key Individual posture

- **Steady state:** Saskia (Head of Global Markets) is the named FAIS Key Individual under FAIS Act s.8 once the human Saskia seat is hired post-licence-day.
- **Interim:** Marc retains FAIS KI accountability **only until external counsel confirms whether the bank's institutional-only / wholesale posture requires an FSP licence at all** (per `2026-05-09_imani_external-counsel-licence-application.md` §2.4 and Mira+Zara Q4). The conservative posture is to pursue an FSP licence in the categories the bank's product set requires; counsel-confirmation lands at the licence-application gate.

### 3D. Auditor and key-audit-partner separation

The **external auditor is a firm**, appointed under Banks Act s.61 and Companies Act s.90. The firm is on the bank's regulator-facing register; the **key audit partner is an employee of the audit firm**, named in the firm's engagement letter, and is **not on the bank's own thin-human-layer roster**. SARB's fit-and-proper review covers the partner-of-record because the audit firm carries that obligation; the bank's appointment obligation is to the firm.

### 3E. CEO direct reports today and named designations (steady-state)

CEO direct reports today (the agent fleet — Principle 7): Scrooge (CoS), Helena (CRO), Devon (COO), Camille (CFO), Eitan (Treasurer), Saskia (Head of Global Markets), Owen (CoSec), Zara (CCO), Iris (IO), Thandiwe (CAE — administrative line), Rashida (CISO).

Open governance seats post-licence (recommended hiring order — see §13): **General Counsel**, **CHRO**.

Named regulatory designations (steady-state agent fleet; the licence-day human seats above are the regulator-facing analogues):

| Designation | Agent (engineering seat) | Licence-day human seat | Authority |
|---|---|---|---|
| Public Officer (Companies Act / SARS) | Camille | Marc (CEO; mergeable per ORG-TX-08) | Companies Act / SARS |
| CoSec under Companies Act ss.86–89 | Owen | **Seat #4** (separate human; not Marc) | Companies Act 71 of 2008 |
| CRO under Banks Act / JS 1 of 2024 | Helena | **Seat #6** (separate human; before lodgment) | Banks Act s.60; Joint Standard 1 of 2024 |
| MLRO and FIC Compliance Officer | Zara | **Seat #5** (triple-hatted with IO) | FIC Act 38 of 2001 ss.43A–43B |
| POPIA Information Officer | Iris | **Seat #5** (triple-hatted with MLRO+FIC CO); deputy = Seat #4 (CoSec) | POPIA 4 of 2013 s.56 + Reg. 4 |
| FAIS Key Individual | Saskia (steady-state); Marc (interim, counsel-confirmed) | Saskia post-licence (or Marc-interim if FSP route) | FAIS Act 37 of 2002 s.8 |
| Operational-resilience accountable | Devon | CEO (until COO hire) | BCBS / JS 1 of 2024 |
| Cyber-resilience accountable | Rashida (CISO governance) + Senna (engineering) | Rashida — agent-substrate at licence-day; human seat not in licence-day six (deferred per JS 1 of 2024 §6 derogation argument; see §13) | Joint Standard 1 of 2024 |
| Treasury / liquidity accountable | Eitan | CEO (until Treasurer human hire) | Banks Act / BCBS |
| Trading conduct accountable | Saskia | Saskia (post-licence) | FMA / FAIS |
| External auditor (firm) | n/a | Audit firm (PA-approved); key audit partner is firm's named individual | Banks Act s.61; Companies Act s.90 |

**MLRO-alternate designation:** AC-Chair NED (seat #1), per §3B above.

## 4. Three lines of defence — operating discipline

- **First line** *builds and operates*. May not also independently challenge their own outputs. Limit breaches escalate to second line.
- **Second line** *challenges*, sets policy, holds appetite. May not build first-line controls (Mira reports to Zara — Mira engineers; Zara governs; Mira does not also challenge).
- **Third line** *assures*. Independent of both. Vera reports administratively through the CEO with functional-line dotted to Owen and a future CAE; functionally to the Audit Committee.
- Information flows upward through structured events; challenges flow through second line to BRC; assurance flows through third line to AC.

## 5. Policy taxonomy and policy governance

The bank operates a **policy library** with a single owner per policy, a board-or-committee approval pathway, a review cycle, a version, and obligations-register links (P2).

### Mandatory policies (day-one)

| Policy | Owner | Approval | Review |
|---|---|---|---|
| Risk Appetite Statement | Helena | Board | Annual |
| Capital Management | Camille | Board (via BRC) | Annual |
| Liquidity Management | Eitan | BRC | Annual |
| Credit | Helena (with future CreCo) | BRC | Annual |
| Market Risk | Helena | BRC | Annual |
| Operational Risk & Resilience | Devon (with Helena) | BRC | Annual |
| Information Security | Senna (interim CISO: Devon) | BRC | Annual |
| Privacy / POPIA | Iris | BRC + S&E | Annual |
| AML / CFT (RMCP) | Zara | BRC | Annual |
| Sanctions | Zara | BRC | Annual |
| Conduct & TCF | Zara | BRC | Annual |
| Outsourcing & Third Party (SARB Directive 3 of 2018) | Devon | BRC | Annual |
| Code of Conduct | Owen | Board | Biennial |
| Conflicts of Interest | Owen | Board | Biennial |
| Whistleblowing | Owen | AC + S&E | Biennial |
| Anti-Bribery & Corruption | Zara + Owen | Board | Biennial |
| Remuneration | (future CHRO; interim Sade + Helena) | RemCo + Board | Annual |
| Fit-and-Proper | Sade (interim) | NomCo | Annual |
| Model Risk | Helena | BRC | Annual |
| Climate-related Risk | Helena (with S&E) | BRC + S&E | Annual |

Mira curates the obligations register; the policy library and the register are linked one-to-many in both directions.

## 6. Delegation of Authority (DoA)

The DoA is **coded into the platform** — the platform refuses an action that exceeds the actor's delegation (P3, P4).

Structure:

- A typed, versioned matrix `(action_type, actor_role, threshold, dual_control_required, evidence_required)`.
- Every change to the matrix is an event with a register-linked authorisation (Board / committee resolution).
- Breach of delegation is itself a typed event consumed by Vera as continuous-controls evidence.

Indicative shape (illustrative, not exhaustive):

| Action | Single-signer threshold | Dual control above |
|---|---|---|
| Credit extension (vanilla) | Per credit policy | Above threshold → CreCo / Board |
| Treasury trade — money market | Within ALCO limits | Above limit → ALCO / BRC |
| Markets trade — vanilla | Within mandate | Above mandate → Board |
| Outsourcing contract | Per outsourcing policy | Material → Board |
| Customer onboarding (low-risk) | Automated | EDD → Zara / Mira |
| STR filing | Zara (MLRO) | n/a — judgement seat |
| Policy change | Owner + committee | Material → Board |

## 7. Information flows and meeting machinery

- Board pack composition: standing items (CEO, CFO, CRO reports), risk dashboard, breach reports, KRI heatmap, emerging-risk register, regulatory-engagement log, action tracker. **Generated**, not assembled (P6).
- Sub-committee packs: standing items per charter. Generated.
- Minutes: structured records `MinuteItem { resolution, mover, seconder, vote, action }`. Each resolution is an event under P1.
- Action tracking: open / closed events; escalation past due-date is automated.
- Board-effectiveness review: annual self-assessment + triennial external review.

## 8. Interim governance — pending board formation

Until a Board is constituted:

- **Board reserved matters** are escalated to the **CEO** with **mandatory CRO concurrence** (Helena) and, where relevant, CFO concurrence (Camille). Both signatures required on any reserved matter; both refusals are board-equivalent rejections.
- An **Interim Risk Forum** chaired by Helena, attended by CCO (Zara), CFO (Camille), COO (Devon), Treasurer (Eitan), CoSec (Owen), runs as the proxy BRC.
- An **Interim Audit Forum** chaired by Owen, attended by CFO and Vera, runs as the proxy AC. Vera's independence is preserved by the dotted-line to the future CAE; the interim AC's role is to host Vera's reporting.
- All decisions taken under interim governance are logged as events and presented to the Board for ratification once constituted.
- Material policies approved under interim governance flag as "interim approval — board ratification pending".

## 9. Climate and ESG governance

PA Guidance Note 1 of 2024 expectations:

- Climate-related risk integrated into the risk taxonomy under operational, credit, and strategic dimensions.
- BRC oversight of climate scenario analysis; S&E Committee oversight of environmental and social dimensions.
- Disclosure path aligned with TCFD and emerging local disclosure expectations.
- Helena and the S&E Committee jointly own the programme.

## 10. Outsourcing and third-party governance

SARB Directive 3 of 2018 on cloud computing and offshoring of data:

- All material outsourcing is Board-reserved.
- An **Outsourcing register** (Atlas + Senna co-owned, Devon governs) lists every cloud service, processor, sub-processor, with data residency, exit plan, and obligations-register citations.
- Iris co-reviews from POPIA s.72 cross-border-transfer perspective.

## 11. Subsidiarity vs centralisation

When new legal entities are added:

- **Centralised at group level:** RAS, framework, policy library, obligations register, semantic layer, identity, audit independence, CoSec function, IO function (POPIA Regulator engagement), CCO function (FIC liaison).
- **Replicated at entity level:** Board (where required), local fit-and-proper designations, local regulatory designations, jurisdiction-specific policy variants registered against entity-level register entries.
- Inter-entity transactions are explicit events with arm's-length pricing (P5).

## 12. Co-governance seams (specific to current team)

- **POPIA** — Iris holds the Regulator-facing designation; Zara holds the regulatory-compliance dimension; Senna implements the security safeguards under POPIA ss.19–22. The seam is: **Iris notifies; Zara responds compliance-wise; Senna runs IR.**
- **Cyber risk** — Devon is operationally accountable (interim CISO function); Senna engineers; Helena holds appetite. Future CISO inherits operational accountability from Devon.
- **Financial crime** — Zara is the named MLRO and decision-maker; Mira engineers; Helena sets appetite; Owen runs the Board pathway; Vera audits.
- **Treasury risk** — Eitan operates; Helena sets appetite; Camille reports capital and earnings impact; Saskia executes for Eitan in markets where overlap exists.
- **Legal** — Imani engineers; Owen handles corporate-law / Companies Act dimension; the future GC inherits substantive legal-risk governance.

## 13. Recommended order of remaining governance hires

Per D-THIN-HUMAN-LAYER-MINIMUM, the licence-day six (3 NEDs, CoSec, Compliance Lead, CRO) are the **before-lodgment** roster. Post-licence, the residual hires the framework names — none statutorily required at licence-day under the minimum-possible reading (per Owen+Imani §2.9):

1. **Chief Information Security Officer (CISO) — human seat.** Rashida operates as the CISO agent today and carries the JS 1 of 2024 §6 responsible-person designation through the agent fleet. The licence-application file defends the absence of a separate human CISO at lodgment by naming Rashida-as-agent-substrate plus Devon as interim operational-resilience-accountable; SARB pre-application engagement determines whether this defence holds or whether the CISO becomes a seventh human. **Hire first post-licence (or accelerate to before-lodgment if SARB engagement signals concern).**
2. **Chief Audit Executive (CAE) — human seat.** Thandiwe operates as the CAE agent today; Vera's third-line independence is preserved through the functional line into the Interim Audit Forum (Owen chair). Post-licence the human CAE seat consolidates third-line accountability. **Hire second post-licence.**
3. **General Counsel (GC).** Imani builds, but legal-risk governance — especially as counterparty agreements (ISDA, GMRA) come on stream via Saskia — needs a named seat. **Hire third.**
4. **CHRO.** People governance and remuneration sit on Sade today; the seat will be material once a Board RemCo is constituted. **Hire fourth.**
5. **Possibly COO deputy / additional executives** as scale requires.

The CRO seat that originally sat on this list is now seat #6 of the licence-day six (§3A) and is **before-lodgment**, not post-licence. Sequence may be revised as the bank approaches its SARB licence application.

## 14. Open items requiring CEO action

1. Approval of this framework (interim approval; full Board ratification pending board formation).
2. Approval of the recommended order of governance hires (§13).
3. Iris's POPIA Information Officer designation lodgment (out-of-system — CEO signature required).
4. Confirmation of the interim governance arrangement (§8).
5. **F1 resolved (CEO modify, 2026-05-06):** the framework operates at the *policy* layer of Principle 6 — it is a constitutional / meta-policy artefact. Standards are the technical and operational specifications underneath (ISO 20022 mappings, encryption schemes, screening-rule specifications); policies in the library cite this framework. The *standard*-layer reading initially proposed has been retired.
6. **D-THIN-HUMAN-LAYER-MINIMUM resolved (CEO modify, 2026-05-08):** licence-day human roster set at six separate humans + Marc + external audit firm. CRO becomes seat #6, appointed before licence-application lodgment, per Joint Standard 1 of 2024 §6–§7 challenge from Mira+Zara. Section 3A above is the canonical authoring location for the composition; section 3B codifies the alternates split (deputy-IO = CoSec; MLRO-alternate = AC-Chair NED); section 3C names the FAIS KI posture; section 3D names the auditor / key-audit-partner separation. The current paper is `2026-05-09_owen_thin-human-layer-composition-final.md`, which supersedes the original Owen+Imani draft (`2026-05-09_owen-imani_thin-human-layer-minimum-possible.md`, moved to `actioned/`).
