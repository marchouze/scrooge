---
title: Risk Management and Compliance Programme (RMCP) — attestable specification
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim)
date: 2026-05-10
summary: W1 Slice 1 of D-REGULATORY-READINESS-GATE-PLAN. Single readable RMCP document mapped one-for-one to FIC s.42(2)(a)-(j) with FATF Rec. 1 + FIC GN 7 cross-references; cites the existing IN-FORCE policy stack (RMCP, KYC/CDD/EDD, PEP, AML/CFT, Sanctions, FATCA/CRS, Anti-Bribery & Corruption) by register row ID; names the substrate-side engineering each clause depends on (Slices 2–6 of W1) and the cross-cutting substrate (D-RMS-PHASE-1 event registration, document store, retention).
decision-required: false
decision-id: D-REGULATORY-READINESS-W1-SLICE-1
decision-category: substrate-foundational
decision-owner: Mira (Compliance / RegTech engineer, engineering) + Zara (Chief Compliance Officer, governance)
---

# Risk Management and Compliance Programme (RMCP) — attestable specification

> **Standing authority:** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10; CEO action: modify — approve W1 + W2, defer W3). Slice authorisation: `D-REGULATORY-READINESS-W1-SLICE-1`. No new CEO decision required — this slice executes the W1 work the parent decision authorised, per the no-pause rule (CLAUDE.md "Operating procedures").
>
> **Parent pack:** [`Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md), §3 Workstream W1 (AML/CFT-RMCP), Slice 1.
>
> **Co-authored:** Mira leads the engineering-substrate mapping per FIC s.42(2) sub-clause; Zara (also acting MLRO + FIC Compliance Officer interim) leads the policy-binding statement and the governance-pathway claims.

## 0. Purpose and reading guide

This document is the **attestable specification** of the bank's Risk Management and Compliance Programme as required by **FIC Act 38 of 2001 s.42** (read with **FATF Recommendation 1** on the risk-based approach and **FIC General Notice 7 of 2017 — Guidance Note on the implementation of the risk-based approach**). It is the single readable artefact the Prudential Authority and the Financial Intelligence Centre will read at licence-application against FIC s.42(2)(a)-(j).

It is *attestable* in the sense Zara+Helena's gate plan defines: every FIC s.42(2)(a)-(j) sub-clause has its own section, and every section names three things — (1) the binding obligation by URN + obligations-register row, (2) the policy that implements it, (3) the substrate-side engineering that operationalises it (what events fire, what projections compute, what procedures run).

The **policy stack** is already IN FORCE at the policy layer per the obligations register v1.13 (RMCP, KYC/CDD/EDD Policy, PEP Policy, AML/CFT Policy, Sanctions Policy, FATCA/CRS Policy, Anti-Bribery & Corruption Policy). What this RMCP adds is the **bound substrate-side engineering** that turns the policy stack into a coherent, attestable, regulator-readable programme — the body of this document is the binding map.

The **substrate-side engineering** is largely not yet built. W1 Slices 2–6 build it. Section §13 names each substrate by Slice and gives the dependency table. The point of writing the RMCP first is to bind the slices that follow to a single specification rather than letting the engineering drift into post-hoc reconciliation.

> **Per Principle 2 (citation discipline):** every external reference in this document is either an obligations-register row ID (e.g. `ORG-FC-01`), a statutory citation by section number, or a substrate file path under `prototype/`. No invented section indices; `[citation: TBC]` markers carry forward from the register where the underlying register row carries them. External-counsel ratification at licence-application moment per the gate plan §7.

## 1. Authority and scope

### 1.1 Statutory authority

This RMCP is adopted under:

- **Financial Intelligence Centre Act 38 of 2001 s.42** — the binding statutory requirement to adopt and maintain a Risk Management and Compliance Programme. Register row [`ORG-FC-01`](../Regulations/_obligations-register.md#L142). FIC Act file [`Regulations/FIC/fic-act.md`](../Regulations/FIC/fic-act.md).
- **FIC Act 38 of 2001 s.42A** — designation of the senior person responsible for compliance with the RMCP. The MLRO and FIC Compliance Officer designations land here.
- **FIC Act 38 of 2001 s.43A** — accountable-institution registration. `Hoz Bank Limited` and `Hoz Securities Limited` are accountable institutions under FIC Schedule 1 (item 6 — banks; and the FAIS-licensed financial-services-provider items respectively, once the FSP licence is granted per `D-FSP-LICENCE-NECESSITY` 2026-05-09).
- **FATF Recommendation 1** — Assessing Risks and Applying a Risk-Based Approach. Anchors the s.42(2)(a) risk-identification clause.
- **FIC General Notice 7 of 2017 — Guidance Note on the implementation of the risk-based approach** (FIC GN 7) — binding interpretive guidance on RBA periodicity (high-risk → annual, medium → 24 months, low → 36 months) and customer-typology dispatch. Register row [`ORG-FC-19`](../Regulations/_obligations-register.md#L160).

### 1.2 Entity scope

The RMCP applies on a **multi-entity basis** to the accountable institutions in the legal-entity tree:

- `Hoz Bank Limited` — accountable institution under FIC Schedule 1 item 6 (banks). Primary RMCP scope.
- `Hoz Securities Limited` — accountable institution upon FAIS-FSP authorisation (per `D-FSP-LICENCE-NECESSITY`); RMCP applies on the same multi-entity basis.

Group-level governance is provided by `Hoz Group Limited` per the legal-entity tree at [`Regulations/_legal-entity-tree.md`](../Regulations/_legal-entity-tree.md). The MLRO designation per [`ORG-FC-11`](../Regulations/_obligations-register.md#L152) is multi-entity (one named MLRO across both accountable institutions, with the alternate-MLRO arrangement per [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md#L475)).

> **Note on entity-scope `[TBD]`.** Per the parent pack §7, most Domain B (FC-prefix) rows carry `entity-scope: [TBD]` in v1.13. The RMCP claims `multi-entity` as the working scope; the per-row entity-scope reconciliation runs under `WS-ENTITY-SCOPE-CLASSIFICATION` (Mira's curatorship workstream).

### 1.3 Out of scope

The RMCP does **not** address:

- **Prudential supervision** (Banks Act 94 of 1990; *Regulations Relating to Banks*) — covered by the W2 ICAAP / ILAAP / Recovery framework.
- **Cyber resilience** (Joint Standard 1 of 2024) — covered by the W3 attestable programme (deferred per CEO decision on the gate plan).
- **Market conduct** (FAIS Act 37 of 2002; FSCA Conduct Standards 1, 2, 3 of 2018) — covered by the W5 Markets-Conduct / FAIS / ODP package (deferred per the gate plan).
- **Operational resilience** (Joint Standard 2 of 2024) — covered by the W4 programme (deferred per the gate plan).

The RMCP names the cross-references where the AML/CFT obligations interact with these other domains (e.g. POPIA s.18 + s.13 cross-references for personal-information handling under CDD per Iris's information-officer pathway).

### 1.4 Governance

| Role | Holder | Authority |
|---|---|---|
| Accountable executive (s.42A senior person) | Triple-hatted human at licence-day (MLRO + FIC Compliance Officer + Information Officer) per `D-THIN-HUMAN-LAYER-MINIMUM`. Interim: Marc holds the formal designation; Zara holds the operational role. | FIC s.42A; register [`ORG-FC-11`](../Regulations/_obligations-register.md#L152) + [`ORG-FC-11-GLOSS-CEO-MLRO-BAR`](../Regulations/_obligations-register.md#L474). |
| MLRO | Same triple-hatted human (licence-day); Zara interim. | FIC s.43A; [`ORG-FC-11`](../Regulations/_obligations-register.md#L152). |
| MLRO-alternate | AC-Chair NED (per `D-THIN-HUMAN-LAYER-MINIMUM` §4.2). | [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md#L475). |
| Engineering owner | Mira (Compliance / RegTech engineer, engineering — reports to Zara). | Engineering-substrate ownership of W1 Slices 2–6. |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer) reports functionally to Thandiwe (Chief Audit Executive, governance). | Recon coverage of every FIC s.42(2) sub-clause per §14. |
| POPIA cross-reference | Iris (Information Officer, governance). | POPIA s.13, s.18, ss.19–22 cross-reference where CDD handling interacts with personal-information processing. |

## 2. Risk identification and assessment — FIC s.42(2)(a)

**Statutory text (in summary).** Identify, assess, and understand the money laundering, terrorist financing, and proliferation financing risks the bank is exposed to.

### 2.1 Binding obligation

- **URN:** `urn:obligation:bank:org:fc:rmcp-risk-identification:v1` (proposed; new row authorisation under W1 Slice 1 — Mira's curatorship workstream registers; the parent register row [`ORG-FC-01`](../Regulations/_obligations-register.md#L142) carries the s.42 RMCP umbrella).
- **Anchors:** FIC s.42(2)(a); FATF Rec. 1 (risk-based approach); FIC GN 7 §1 (typology framing).

### 2.2 Implementing policy

- **RMCP** (this document, governing) — IN FORCE per [`ORG-FC-01`](../Regulations/_obligations-register.md#L142).
- **AML/CFT Policy** — IN FORCE per [`ORG-FC-06`](../Regulations/_obligations-register.md#L147) (RBA dispatch) + [`ORG-FC-21`](../Regulations/_obligations-register.md#L162) (FATF mutual-evaluation grey-listing remediation).
- **KYC / CDD / EDD Policy** — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md#L143).

### 2.3 Substrate-side engineering

- **Risk-rating typology projection.** Client-master substrate (W1 Slice 3) emits per-client risk-rating (`high` / `medium` / `low`) on `ClientCddCompleted` events. Projection lives at `prototype/runtime/projections/client-risk-rating.ts` (planned, Slice 3).
- **Risk-typology register.** Document-substrate artefact (D-RMS-PHASE-1 Slice 1 — landed) holding the bank's typology framework — institutional-only counterparties, B-cluster-FX concentration appetite per `project_indirect_participant_posture.md`, sponsor-bank channel risk, OTC IRD product family risk. Register reviewed annually per the RBA periodicity in §11.
- **National Risk Assessment ingestion.** SA NRA findings (FATF MER + FIC Public Compliance Communications) ingested into the typology register; reviewed on every PCC update per `ORG-FC-21` track-and-respond posture.
- **Recon hook.** Vera's planned `recon:rmcp-risk-identification-currency` asserts the typology register has a current-year review event (`RmcpTypologyReviewed` — registered per W1 Slice 2 event-registration discipline).

## 3. Customer due diligence — FIC s.42(2)(b)

**Statutory text (in summary).** The RMCP must address how the accountable institution conducts customer due diligence — identification, verification, beneficial-ownership resolution, ongoing monitoring.

### 3.1 Binding obligation

- **URNs:** `urn:obligation:bank:org:fc:cdd:v1` and `urn:obligation:bank:org:fc:edd:v1` and `urn:obligation:bank:org:fc:beneficial-ownership:v1` (proposed per Mira's curatorship; parent register rows below).
- **Anchors:** FIC s.21–21H (CDD, EDD, ongoing CDD, PEPs, foreign correspondents, third-party reliance); FIC s.42(2)(b); FATF Rec. 10 (CDD); FATF Rec. 12 (PEPs); FIC GN 5 (beneficial ownership); FIC GN 7 (RBA periodicity).
- **Register rows:** [`ORG-FC-02`](../Regulations/_obligations-register.md#L143) (CDD), [`ORG-FC-03`](../Regulations/_obligations-register.md#L144) (EDD / PEPs), [`ORG-FC-04`](../Regulations/_obligations-register.md#L145) (beneficial ownership), [`ORG-FC-18`](../Regulations/_obligations-register.md#L159) (RAS B3 continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md#L160) (FIC GN 7 RBA periodicity).

### 3.2 Implementing policy

- **KYC / CDD / EDD Policy** — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md#L143).
- **PEP Policy** — IN FORCE per [`ORG-FC-03`](../Regulations/_obligations-register.md#L144).
- **Client-master + continuous-KYC design** at [`Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md`](2026-05-06_client-master-and-continuous-kyc.md).

### 3.3 Substrate-side engineering

- **W1 Slice 3 (CDD/EDD substrate + continuous-KYC two-tier).** Event types: `ClientCddCompleted`, `ClientEddTriggered`, `ClientEddCompleted`, `ClientBeneficialOwnerResolved`, `ClientKycRestricted`. Registered via D-RMS-PHASE-1 event-registration discipline.
- **Beneficial-ownership recursive resolution** to natural persons per FATF Rec. 10 + FIC GN 5; clause-library hooks via Imani (Legal-as-code engineer) for trustee + beneficial-owner resolution patterns.
- **Continuous-KYC two-tier (RAS B3).** High-confidence triggers → restrict immediately; medium-confidence → restrict on review. Implemented as projection over `ClientKycRestricted` events with the per-client `restriction-reason` field carrying the trigger source.
- **POPIA cross-reference.** All CDD personal-information handling routed through Iris's POPIA s.18 (notification of collection) + s.13 (purpose specification) substrate. Register cross-reference [`ORG-PR(IV)-06`](../Regulations/_obligations-register.md#L189) (POPIA security safeguards).
- **Recon hook.** Vera's planned `recon:cdd-completion-coverage` asserts every active client has a `ClientCddCompleted` event before any `Order*` event is approved for that client.

## 4. Ongoing monitoring — FIC s.42(2)(c)

**Statutory text (in summary).** The RMCP must address ongoing monitoring of business relationships and scrutiny of transactions undertaken throughout the relationship.

### 4.1 Binding obligation

- **URN:** `urn:obligation:bank:org:fc:ongoing-monitoring:v1` (proposed).
- **Anchors:** FIC s.21C (ongoing CDD); FIC s.42(2)(c); FATF Rec. 10 (ongoing CDD); FIC GN 7 (RBA periodicity); FATF Rec. 16 (wire transfer information accompanies cross-border transfers).
- **Register rows:** [`ORG-FC-17`](../Regulations/_obligations-register.md#L158) (FATF Rec. 16 wire transfers), [`ORG-FC-18`](../Regulations/_obligations-register.md#L159) (continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md#L160) (RBA periodicity).

### 4.2 Implementing policy

- **AML/CFT Policy** — IN FORCE per [`ORG-FC-06`](../Regulations/_obligations-register.md#L147).
- **KYC / CDD / EDD Policy** — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md#L143) (the ongoing-CDD chapter).

### 4.3 Substrate-side engineering

- **W1 Slice 4 (transaction-monitoring engine).** Live monitoring against typed `Transaction*` events from the markets-substrate (M-phase). Rule engine for typology detection emits `TransactionMonitored` and (on hit) `TransactionMonitoringHit` events.
- **Wire-transfer originator/beneficiary information** per FATF Rec. 16: enforced inline at order-execution by the markets-substrate. Cross-border `Transfer*` events that lack the required originator + beneficiary fields are rejected pre-execution.
- **Continuous-KYC scoring.** The same `ClientKycRestricted` projection used for §3 also re-scores on inbound transaction-monitoring hits — a hit raises the per-client risk-score and may trigger an `ClientEddTriggered` event under the RBA-trigger rules.
- **Recon hook.** Vera's planned `recon:transaction-monitoring-coverage` asserts every settled `Transaction*` event has at least one `TransactionMonitored` event paired by `transactionId`.

## 5. Reporting to the Centre — FIC s.42(2)(d)

**Statutory text (in summary).** The RMCP must address the institution's reporting obligations to the Centre — STR (s.29), CTR (s.28), TPR / PAR (s.28A), and any other reportable matters.

### 5.1 Binding obligation

- **URNs:** `urn:obligation:bank:org:fc:str:v1`, `urn:obligation:bank:org:fc:ctr:v1`, `urn:obligation:bank:org:fc:par:v1`.
- **Anchors:** FIC s.28 (CTR — cash transactions ≥R24,999.99); FIC s.28A (TPR / PAR — property associated with terrorist activities); FIC s.29 (STR — file ASAP, in any event ≤15 days after suspicion); FIC s.42(2)(d).
- **Register rows:** [`ORG-FC-07`](../Regulations/_obligations-register.md#L148) (CTR), [`ORG-FC-08`](../Regulations/_obligations-register.md#L149) (PAR), [`ORG-FC-09`](../Regulations/_obligations-register.md#L150) (STR).

### 5.2 Implementing policy

- **RMCP** (this document) — defines the report-generation pathway, the MLRO-investigation set boundary, and the goAML / RegOnline submission harness.
- **AML/CFT Policy** — IN FORCE per [`ORG-FC-06`](../Regulations/_obligations-register.md#L147).
- **Sanctions Policy** — IN FORCE per [`ORG-FC-13`](../Regulations/_obligations-register.md#L154) (anchors PAR via the sanctions-screening pipeline).

### 5.3 Substrate-side engineering

- **W1 Slice 4 (STR / CTR / PAR pipeline).** Event types: `StrFiled`, `CtrFiled`, `ParFiled`, `MlroInvestigationOpened`, `MlroInvestigationDecided`. STR generation triggered by `TransactionMonitoringHit` + MLRO investigation outcome; CTR generation triggered automatically on cash-class `Transaction*` events ≥R24,999.99; PAR generation triggered by `SanctionsTruePositiveBlocked` (W1 Slice 2) where the matched property is identifiable.
- **W1 Slice 6 (goAML / RegOnline submission harness).** Submission events: `GoAmlReportSubmitted`, `RegOnlineReportSubmitted`. Idempotent harness — repeated submission of the same report-id is a no-op at the harness layer; FIC-side de-duplication is the regulator's responsibility.
- **15-day STR clock.** Enforced by a recon (`recon:str-15-day-window`, planned) that asserts the wall-clock delta between `MlroInvestigationDecided` (where action = file) and `StrFiled` is ≤ 15 calendar days.
- **Cross-reference.** STR-stream events are encrypted under MLRO-key envelope per §6 (tipping-off prohibition).

## 6. Tipping-off prohibition and confidentiality — FIC s.42(2)(e)

**Statutory text (in summary).** The RMCP must address how the institution prevents tipping-off (FIC s.29(3)) and maintains the confidentiality of reports made to the Centre.

### 6.1 Binding obligation

- **URN:** `urn:obligation:bank:org:fc:tipping-off:v1` (proposed); the cryptographic-enforcement substrate is novel enough to merit its own URN even though the parent register row already exists.
- **Anchors:** FIC s.29(3) — disclosing the existence of (or contemplated) STR is a criminal offence; FIC s.42(2)(e); FATF Rec. 21 (confidentiality of reports).
- **Register rows:** [`ORG-FC-10`](../Regulations/_obligations-register.md#L151) (tipping-off prohibition; cryptographic enforcement of MLRO investigation set).

### 6.2 Implementing policy

- **RMCP** (this document) — names the cryptographic-enforcement substrate and the MLRO-investigation-set boundary.
- **Information Security Policy** — IN FORCE per the cyber-resilience policy stack (cross-reference Domain G; W3 deferred).

### 6.3 Substrate-side engineering

- **MLRO-investigation-set encryption boundary.** STR-stream events (`MlroInvestigationOpened`, `MlroInvestigationDecided`, `StrFiled`) are encrypted under an MLRO-held key envelope (cross-link to W3 Slice 6 HSM key envelope; pre-W3, a software key under Senna's local key-rotation harness suffices for the substrate-shape attestation).
- **Read-side enforcement.** Only the MLRO and MLRO-alternate identities can decrypt the STR-stream; all other agents and humans receive a typed `EncryptedEventRedacted` placeholder. Identity-substrate enforces via the agent-identity permission policy (`prototype/platform/agent-identity/permission-policy.ts`).
- **Tipping-off recon.** Vera's planned `recon:tipping-off-isolation` asserts no non-MLRO agent reads MLRO-investigation-set events; runs over the agent-event-access log emitted by the identity-substrate.
- **Inferential-tipping-off guard.** A second-order recon (`recon:tipping-off-inference`, planned) asserts no projection or dashboard exposes a per-client field whose presence/absence would imply STR existence (e.g. a "client under investigation" flag would itself tip off — the substrate uses MLRO-key-encrypted projections to avoid this).

## 7. Record-keeping — FIC s.42(2)(f)

**Statutory text (in summary).** The RMCP must address the institution's record-keeping obligations under FIC s.22 (CDD records and transaction records retained for at least 5 years after the end of the relationship or the date of the transaction).

### 7.1 Binding obligation

- **URN:** carried by the existing retention infrastructure; the FIC s.22 binding is anchored at register row [`ORG-FC-05`](../Regulations/_obligations-register.md#L146).
- **Anchors:** FIC s.22 (5-year retention); FIC s.42(2)(f); FATF Rec. 11 (record-keeping); cross-reference JSE Equities Rules trade-record retention sub-rules per [`ORG-MK-15`](../Regulations/_obligations-register.md#L326) (the 7-year JSE floor wins as the strongest applicable retention floor under `RETENTION_CONSERVATIVE_DEFAULT`).
- **Register rows:** [`ORG-FC-05`](../Regulations/_obligations-register.md#L146).

### 7.2 Implementing policy

- **Records Management Policy** — referenced in the policy register; substrate is the RMS Phase 1 build per `D-RMS-PHASE-1`.
- **KYC / CDD / EDD Policy** — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md#L143) (the records chapter).

### 7.3 Substrate-side engineering

- **Append-only event store** — the foundational record. Per Principle 1 the event log is the canonical retention substrate; the FIC s.22 5-year floor binds at the no-compaction-below-this-period level.
- **D-EVENT-STORE-SCALING Slice 1 (landed) — retention metadata.** Per-event-type retention horizons live at `prototype/platform/event-store/registry.ts`. The planned `RETENTION_FIC_S22_5Y` retention class anchors all CDD-events and transaction-record events to the FIC s.22 5-year floor; W1 Slice 3's CDD events and Slice 4's transaction-monitoring events register against this class.
- **Document substrate (D-RMS-PHASE-1 Slice 1 — landed).** BLAKE3 content-addressed document store at `prototype/platform/document-store/`. Identification documents, CDD-evidence packs, and STR submission packets reference content by hash from the relevant event payload.
- **Recon hook.** The `recon:retention-citation-coverage` recon (live, ran 78 warnings closed at PR #141) asserts every event-type's retention class has a citation pointing at the binding obligation. The FIC s.22 anchoring extends this to FC-domain event types as Slice 3 + Slice 4 register them.

## 8. Internal compliance arrangements — FIC s.42(2)(g)

**Statutory text (in summary).** The RMCP must address the institution's internal arrangements for compliance — designation of the senior person responsible for compliance (s.42A), reporting lines, the role of the MLRO, internal escalation, board reporting.

### 8.1 Binding obligation

- **URN:** `urn:obligation:bank:org:fc:internal-compliance:v1` (proposed).
- **Anchors:** FIC s.42A (senior person designation); FIC s.43A (accountable-institution registration); FIC s.42(2)(g); FATF Rec. 18 (internal controls).
- **Register rows:** [`ORG-FC-11`](../Regulations/_obligations-register.md#L152) (MLRO designation, multi-entity), [`ORG-FC-11-GLOSS-CEO-MLRO-BAR`](../Regulations/_obligations-register.md#L474) (CEO-MLRO bar gloss), [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md#L475) (MLRO-alternate), [`ORG-FC-SANCTIONS-SCREENING`](../Regulations/_obligations-register.md#L477) (FIC CO operational accountability).

### 8.2 Implementing policy

- **RMCP** (this document) — §1.4 names the governance roles.
- **Governance Framework** — referenced in the policy register; the multi-entity governance read against `D-THIN-HUMAN-LAYER-MINIMUM` (interim) and the licence-day six-seat composition per `D-COMP-FRAMEWORK-SIX-SEATS`.
- **Fit-and-Proper Policy** — referenced in the policy register; the MLRO + MLRO-alternate fit-and-proper attestations bind here. AgentOps-side fit-and-proper analogue per W1 Slice 7.

### 8.3 Substrate-side engineering

- **W1 Slice 6 (MLRO designation lodgment).** Designation event lodged with FIC; document-substrate artefact. Designation event types: `MlroDesignated`, `MlroAlternateDesignated`. Lodgment evidence stored in document-substrate.
- **Fit-and-proper attestation pipeline.** The triple-hatted human (MLRO + FIC CO + IO) carries fit-and-proper attestations recorded as `FitAndProperAttested` events. AgentOps-side analogue per W1 Slice 7 covers AML-touching agents (Mira, Zara, Iris).
- **Board / governance escalation.** MLRO escalation events (`MlroEscalationRaised`, `MlroEscalationActioned`) into the Decisions register (RMS Phase 1 Decisions register per `D-RMS-PHASE-1`) — the AC-Chair NED reads MLRO escalations in their MLRO-alternate capacity.

## 9. Reporting employees and training — FIC s.42(2)(h)

**Statutory text (in summary).** The RMCP must address how the institution trains its employees on the RMCP and on AML/CFT obligations under s.43.

### 9.1 Binding obligation

- **URN:** `urn:obligation:bank:org:fc:training:v1` (proposed).
- **Anchors:** FIC s.43 (training); FIC s.42(2)(h); FATF Rec. 18 (training).
- **Register rows:** [`ORG-FC-12`](../Regulations/_obligations-register.md#L153) (training).

### 9.2 Implementing policy

- **AML/CFT Policy** — IN FORCE per [`ORG-FC-06`](../Regulations/_obligations-register.md#L147).
- **HR Training** — referenced in the policy register; the human-side training is Sade's reshape (AgentOps; HR slice activates at licence-day).

### 9.3 Substrate-side engineering

- **AgentOps fit-and-proper analogue (W1 Slice 7).** The bank's labour force is autonomous AI agents (Principle 7). The training obligation maps to **agent-substrate-attestation**: every AML-touching agent (Mira, Zara, Iris) carries a current-version attestation that its operating spec includes the AML/CFT obligations. Attestation event: `AgentTrainingAttested` (Sade's AgentOps substrate per `D-THIN-HUMAN-LAYER-MINIMUM`).
- **Human-side training (licence-day).** The triple-hatted human (MLRO + FIC CO + IO) plus the AC-Chair NED (MLRO-alternate) carry FIC-recognised AML/CFT training credentials at licence-day. Records held in the document-substrate; events `HumanTrainingCompleted`.
- **Recon hook.** Vera's planned `recon:aml-training-currency` asserts every AML-touching agent + the licence-day human roster has a current-cycle attestation.

## 10. Sanctions, targeted financial sanctions, and PRECCA — FIC s.42(2)(i)

**Statutory text (in summary).** The RMCP must address the institution's screening, blocking, and reporting obligations under sanctions regimes — UN Security Council sanctions, POCDATARA / DTI list, and any other applicable sanctions regimes.

### 10.1 Binding obligation

- **URN:** `urn:obligation:bank:org:fc:sanctions-screening:v1` (existing per [`ORG-FC-SANCTIONS-SCREENING`](../Regulations/_obligations-register.md#L477)).
- **Anchors:** FIC s.26B (Targeted Financial Sanctions; freeze property); FIC s.28A (PAR — Property Associated with terrorist or related activities); FIC s.42(2)(i); UN Security Council sanctions regime; OFAC SDN; EU consolidated; UK HMT; POCDATARA 33 of 2004 (DTI list); PRECCA 12 of 2004 (anti-bribery extension); UK Bribery Act 2010 (extra-territorial).
- **Register rows:** [`ORG-FC-13`](../Regulations/_obligations-register.md#L154) (RAS B4 zero-appetite), [`ORG-FC-14`](../Regulations/_obligations-register.md#L155) (POCDATARA / DTI), [`ORG-FC-20`](../Regulations/_obligations-register.md#L161) (PRECCA), [`ORG-FC-22`](../Regulations/_obligations-register.md#L163) (UK Bribery Act extra-territorial), [`ORG-FC-SANCTIONS-SCREENING`](../Regulations/_obligations-register.md#L477) (operational accountability).

### 10.2 Implementing policy

- **Sanctions Policy** — IN FORCE per [`ORG-FC-13`](../Regulations/_obligations-register.md#L154).
- **AML/CFT Policy** — IN FORCE per [`ORG-FC-06`](../Regulations/_obligations-register.md#L147).
- **Anti-Bribery & Corruption Policy** — IN FORCE per [`ORG-FC-20`](../Regulations/_obligations-register.md#L161) + [`ORG-FC-22`](../Regulations/_obligations-register.md#L163).
- **Whistleblowing Policy** — referenced in the policy register; PRECCA reporting pathway.
- **Procedure** [`Procedures/by-policy/sanctions-screening.md`](../Procedures/by-policy/sanctions-screening.md) (referenced from `ORG-FC-SANCTIONS-SCREENING`).

### 10.3 Substrate-side engineering

- **W1 Slice 2 (sanctions-screening pipeline + RAS B4 zero-appetite enforcement).** Live screening engine ingesting UN SC, OFAC SDN, EU consolidated, UK HMT, POCDATARA / DTI lists. Event types: `SanctionsListIngested`, `SanctionsScreeningCompleted`, `SanctionsTruePositiveBlocked`, `MlroSanctionsOverrideApproved`. Production override only by signed MLRO event with register-linked exception.
- **RAS B4 enforcement.** Recon `recon:sanctions-zero-appetite` (planned) asserts zero `OrderApproved`-after-`SanctionsTruePositiveBlocked` events without a paired `MlroSanctionsOverrideApproved`.
- **PAR pipeline (cross-reference §5).** `SanctionsTruePositiveBlocked` is the trigger for `ParFiled` (where the matched property is identifiable).
- **PRECCA / UK Bribery Act extension.** Anti-bribery screening as a parallel rule-set in the same engine; bribery-typology hits emit `BriberyTypologyHit` events into the MLRO-investigation-set encryption boundary (§6) and route to STR (s.29) under the same investigation pathway.
- **Recon hook.** Vera's planned `recon:sanctions-list-currency` asserts every active sanctions list has a `SanctionsListIngested` event within the per-list refresh window (UN SC ≤24h, OFAC SDN ≤24h, EU + UK HMT ≤24h, POCDATARA ≤weekly).

## 11. FATCA, CRS, and cross-border reporting — FIC s.42(2)(j)

**Statutory text (in summary).** The RMCP must address any other matter relevant to the institution's compliance with the FIC Act, including cross-border reporting obligations that interact with the AML/CFT framework.

> **Note.** s.42(2)(j) is the catch-all sub-clause. The bank reads it to include FATCA / CRS reporting (which is anchored in the Tax Administration Act 28 of 2011 + the FATCA IGA + the CRS standard, but interacts directly with CDD and the institutional client-master that the AML/CFT framework operates on) and the FATF Rec. 16 cross-border wire-transfer obligations. The reading is consistent with the obligations-register placement of [`ORG-FC-15`](../Regulations/_obligations-register.md#L156), [`ORG-FC-16`](../Regulations/_obligations-register.md#L157), and [`ORG-FC-17`](../Regulations/_obligations-register.md#L158) in the FC domain.

### 11.1 Binding obligation

- **URNs:** `urn:obligation:bank:org:fc:fatca:v1`, `urn:obligation:bank:org:fc:crs:v1`, `urn:obligation:bank:org:fc:fatf-r16-wire:v1`.
- **Anchors:** FATCA IGA (SA-US); CRS (OECD Standard for Automatic Exchange of Financial Account Information in Tax Matters); Tax Administration Act 28 of 2011 (SA-side implementing legislation for both); FATF Rec. 16 (wire-transfer originator + beneficiary information); FIC s.42(2)(j).
- **Register rows:** [`ORG-FC-15`](../Regulations/_obligations-register.md#L156) (FATCA), [`ORG-FC-16`](../Regulations/_obligations-register.md#L157) (CRS), [`ORG-FC-17`](../Regulations/_obligations-register.md#L158) (FATF R.16); cross-reference [`ORG-TX-06`](../Regulations/_obligations-register.md#L277) + [`ORG-TX-07`](../Regulations/_obligations-register.md#L278) in Domain T (tax).

### 11.2 Implementing policy

- **FATCA / CRS Policy** — IN FORCE (annual cycle) per [`ORG-FC-15`](../Regulations/_obligations-register.md#L156) + [`ORG-FC-16`](../Regulations/_obligations-register.md#L157).
- **Tax Policy** — referenced in the policy register; Yael (Tax engineer under Camille) co-owner of the annual-cycle.
- **KYC / CDD / EDD Policy** — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md#L143) (the cross-border / wire-transfer chapter).
- **AML/CFT Policy** — IN FORCE per [`ORG-FC-06`](../Regulations/_obligations-register.md#L147).

### 11.3 Substrate-side engineering

- **W1 Slice 5 (FATCA + CRS XML generators + SARS-submission harness).** XML generators schema-validate against IRS / OECD published XSDs. Event types: `FatcaXmlGenerated`, `CrsXmlGenerated`, `SarsFatcaSubmitted`, `SarsCrsSubmitted`. Annual-cycle scheduling per the SARS deadlines.
- **Wire-transfer originator/beneficiary information (FATF Rec. 16).** Enforced inline at execution by the markets-substrate (cross-reference §4) — cross-border `Transfer*` events that lack the required fields are rejected pre-execution.
- **Reportable-account projection.** Reads from the client-master substrate (W1 Slice 3) — projects per-client FATCA + CRS reportability by tax-residency. Event type: `ClientTaxResidencyClassified`.
- **Recon hook.** Vera's planned `recon:fatca-crs-coverage` asserts every reportable account in the client-master has a current-year XML row.

## 12. Risk-based-approach periodicity — applies across §§2–11

A single substrate enforces the RBA periodicity defined by FIC GN 7 and FATF Rec. 1 across all the substantive sections above:

- **High-risk clients** — annual CDD refresh; transaction-monitoring rules at maximum sensitivity; sanctions-screening on every transaction.
- **Medium-risk clients** — 24-month CDD refresh; transaction-monitoring rules at standard sensitivity.
- **Low-risk clients** — 36-month CDD refresh; transaction-monitoring rules at minimum sensitivity.

**Substrate.** The continuous-KYC two-tier substrate (W1 Slice 3, RAS B3) holds the per-client risk-rating; the RBA-periodicity recon (`recon:kyc-periodicity-coverage`, planned) asserts every active client has a CDD-completion within the per-rating window. Register row [`ORG-FC-19`](../Regulations/_obligations-register.md#L160).

**FATF mutual-evaluation track-and-respond.** SA's grey-list status per [`ORG-FC-21`](../Regulations/_obligations-register.md#L162) means the RBA dispatch is biased to the higher-risk tier where two ratings are plausible — the bank applies the conservative dispatch by default, consistent with the regulatory-change-management posture.

## 13. Substrate dependencies — what W1 Slices 2–6 will build

This RMCP is *attestable* in the sense that every clause names the substrate that operationalises it. The substrate is largely not yet built; this table is the binding map between sections of this document and the W1 slices that follow. Each substrate is named by the slice that builds it (per the parent pack §3 W1 slices).

| RMCP § | FIC s.42(2) | Substrate name | Built by | Key event types | Slice exit criterion (planned) |
|---|---|---|---|---|---|
| §2 | (a) | Risk-typology register | W1 Slice 1 (this doc) + `RmcpTypologyReviewed` event in W1 Slice 2 registration | `RmcpTypologyReviewed` | Typology register has a current-year review event |
| §3 | (b) | CDD/EDD substrate + continuous-KYC two-tier | W1 Slice 3 | `ClientCddCompleted`, `ClientEddTriggered`, `ClientEddCompleted`, `ClientBeneficialOwnerResolved`, `ClientKycRestricted` | Every active client has a `ClientCddCompleted` within the per-rating periodicity window |
| §4 | (c) | Transaction-monitoring engine | W1 Slice 4 | `TransactionMonitored`, `TransactionMonitoringHit` | Every settled `Transaction*` event has at least one `TransactionMonitored` paired by `transactionId` |
| §5 | (d) | STR / CTR / PAR pipeline + goAML / RegOnline harness | W1 Slice 4 + W1 Slice 6 | `StrFiled`, `CtrFiled`, `ParFiled`, `MlroInvestigationOpened`, `MlroInvestigationDecided`, `GoAmlReportSubmitted`, `RegOnlineReportSubmitted` | 15-day STR window recon green; goAML harness lands at least one synthetic-fixture file |
| §6 | (e) | MLRO-investigation-set encryption boundary | W1 Slice 4 (event-shape) + cross-link to W3 Slice 6 (HSM key envelope) | (encrypted) | No non-MLRO agent reads MLRO-investigation-set events |
| §7 | (f) | Append-only event-store retention + document-substrate | D-EVENT-STORE-SCALING Slice 1 (landed) + D-RMS-PHASE-1 Slice 1 (landed) | (retention metadata) | `recon:retention-citation-coverage` covers FC-domain event types |
| §8 | (g) | MLRO designation lodgment + AgentOps fit-and-proper | W1 Slice 6 + W1 Slice 7 | `MlroDesignated`, `MlroAlternateDesignated`, `FitAndProperAttested`, `AgentTrainingAttested` | Designation lodgment evidence in document substrate |
| §9 | (h) | AgentOps training attestation + human-side training records | W1 Slice 7 + (licence-day human-side) | `AgentTrainingAttested`, `HumanTrainingCompleted` | Every AML-touching agent + licence-day human roster has current-cycle attestation |
| §10 | (i) | Sanctions-screening pipeline + RAS B4 zero-appetite enforcement | W1 Slice 2 | `SanctionsListIngested`, `SanctionsScreeningCompleted`, `SanctionsTruePositiveBlocked`, `MlroSanctionsOverrideApproved` | Zero `OrderApproved`-after-`SanctionsTruePositiveBlocked` without paired `MlroSanctionsOverrideApproved` |
| §11 | (j) | FATCA + CRS XML generators + SARS-submission harness | W1 Slice 5 | `FatcaXmlGenerated`, `CrsXmlGenerated`, `SarsFatcaSubmitted`, `SarsCrsSubmitted`, `ClientTaxResidencyClassified` | FATCA + CRS XML schema-validate against IRS / OECD published XSDs |
| §12 | (a)+(b)+(c) | RBA-periodicity recon | W1 Slice 3 | (none new — projection over `ClientCddCompleted`) | Every active client has CDD-completion within per-rating window |

### Cross-cutting substrate (all W1 slices)

- **D-RMS-PHASE-1 (Owen + Atlas — co-curators).** Slice 2 (event-type registration, in flight) is the discipline through which all the W1 event types above register. The RMS event-types `BriefDispatched`, `RecordOfRunFiled`, `FeedbackCaptured`, `WorkstreamUpdated`, `DocumentReferenced`, `CorrespondenceLogged`, `CeoDecision` (existing) are the seven typed events landed in PR #144; the W1 event types extend the registry on the same discipline.
- **D-EVENT-STORE-SCALING (Atlas — substrate).** Slice 1 (retention metadata in `registry.ts`; landed PR #141) carries the per-event-type retention horizons. FC-domain event types register against `RETENTION_FIC_S22_5Y` (the FIC s.22 5-year floor); CDD-derived events that interact with JSE trade-records register against the broader `RETENTION_JSE_TRADE_7Y` per the conservative-default rule.
- **Document substrate (D-RMS-PHASE-1 Slice 1 — landed PR #142).** BLAKE3 content-addressed document store at `prototype/platform/document-store/`. This RMCP itself, the CDD-evidence packs, the STR submission packets, the FATCA + CRS XML files, and the MLRO designation lodgment evidence all live as document-substrate artefacts referenced by hash from the relevant event payload.

### Input-quality flags carried from the parent pack

- **Entity-scope `[TBD]`.** Most FC-domain register rows carry `entity-scope: [TBD]` in v1.13. This RMCP claims `multi-entity` as the working scope per §1.2; the per-row reconciliation runs under `WS-ENTITY-SCOPE-CLASSIFICATION` (Mira's curatorship workstream).
- **`[citation: TBC]` on FIC GN 7 sub-clauses.** GN 7 is cited by topic ("RBA periodicity") not by paragraph index. Mira's curatorship workstream resolves the precise GN 7 paragraph indices at licence-application moment per Principle 2 (no invented citations).
- **No SARB Recovery directive cited here** — that citation belongs in W2 (ICAAP / ILAAP / Recovery framework), not in this RMCP.

## 14. Vera assurance — recon coverage

Per the parent pack §3 W1 Slice 1 acceptance criterion, the recon `recon:rmcp-section-coverage` (planned) asserts every FIC s.42(2)(a)-(j) sub-clause has a corresponding section in this document. The recon shape, named here so Vera (Internal audit / continuous-assurance engineer) can build it as a follow-on, is:

```
recon:rmcp-section-coverage
  read this document (Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md)
  for each FIC s.42(2) sub-clause in {a, b, c, d, e, f, g, h, i, j}:
    assert: a markdown section exists whose body cites that sub-clause
    assert: the section names: (1) URN(s), (2) implementing policy, (3) substrate-side engineering
  emit warning if any sub-clause is missing
```

**Filed as a Vera follow-on, not built in this slice** per the parent-pack scope. Vera's existing `recon:retention-citation-coverage` (live, ran 78 warnings closed at PR #141) provides the precedent recon-shape.

## 15. Authority

Citations (no invented references):

- **CLAUDE.md** "Operating procedures" (events-first authoring; dispatch discipline; no-pause rule); "Architectural principles" 1, 2, 6, 7.
- **Parent pack** [`Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md) §3 W1 Slice 1 (this slice's scope + exit + acceptance), §6 (substrate dependencies), §7 (input-quality flags).
- **FIC Act** [`Regulations/FIC/fic-act.md`](../Regulations/FIC/fic-act.md) — bank-side curated reading of FIC Act 38 of 2001 ss.21–43A.
- **Obligations register** [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) v1.13 — Domain B (FC-prefix) rows cited inline by ID throughout §§2–11.
- **D-RMS-PHASE-1** (CEO-approved 2026-05-09) — event-type registration discipline; document-substrate; spec at [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md).
- **D-EVENT-STORE-SCALING** — retention metadata in `prototype/platform/event-store/registry.ts`; design at [`Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md`](2026-05-10_atlas_event-store-scaling-design.md).
- **D-THIN-HUMAN-LAYER-MINIMUM** (CEO-approved 2026-05-08) — triple-hatted MLRO + FIC CO + IO at licence-day; AC-Chair NED as MLRO-alternate.
- **D-FSP-LICENCE-NECESSITY** (CEO-approved 2026-05-09) — FSP licence necessity for `Hoz Securities Limited`; corporate-bind for FAIS-anchored AML obligations.
- **`project_strategic_foundation.md`** (memory) — institutional global-markets dealer; institutional-only client base.
- **`project_indirect_participant_posture.md`** (memory) — sponsor-bank access to CMI; B-cluster-FX concentration appetite.
- **`project_ai_driven_bank.md`** (memory) — build-phase posture; pre-licence go-live readiness gate.
- **`feedback_no_pause_rule.md`** (memory) — standing CEO decisions authorise downstream dispatch.
- **`feedback_agent_name_with_position.md`** (memory) — name + position on first mention.

**Statutory instruments named by exact reference.** Financial Intelligence Centre Act 38 of 2001 ss.21, 21A, 21B, 21C, 21D, 21E, 21F, 21G, 21H, 22, 26B, 28, 28A, 29, 29(3), 42, 42A, 43, 43A; FIC General Notice 7 of 2017 (RBA implementation guidance); FATF Recommendations 1, 10, 11, 12, 16, 18, 21; FIC Guidance Note 5 (beneficial ownership); FIC Public Compliance Communications (sanctions-screening operational expectations) `[citation: TBC — exact PCC reference per ORG-FC-SANCTIONS-SCREENING]`; UN Security Council sanctions regime; OFAC SDN; EU consolidated sanctions list; UK HMT consolidated list; POCDATARA 33 of 2004 (DTI list); PRECCA 12 of 2004 (anti-bribery); UK Bribery Act 2010 (extra-territorial); FATCA IGA (SA-US); CRS (OECD Standard for Automatic Exchange of Financial Account Information); Tax Administration Act 28 of 2011; JSE Equities Rules trade-record retention sub-rules `[citation: TBC — per ORG-MK-15]` (cross-reference to demonstrate the conservative-retention-default reading).

## 16. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v0.1 | 2026-05-10 | Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) | W1 Slice 1 of D-REGULATORY-READINESS-GATE-PLAN. RMCP attestable spec mapped one-for-one to FIC s.42(2)(a)-(j); each section names URN + register row + implementing policy + substrate-side engineering. Substrate dependencies table (§13) names what W1 Slices 2–6 will build. Vera assurance recon `recon:rmcp-section-coverage` filed as follow-on (not built in this slice per parent-pack scope). |

—Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim)
