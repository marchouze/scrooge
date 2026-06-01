---
policy-id: RMCP-V1
title: Risk Management and Compliance Programme
version: 1
author: Zara (Chief Compliance Officer)
date: 2026-05-14
next-review: "2026-11-14"
status: draft
citations:
  - FIC-ACT-38-2001-S42
  - FIC-ACT-38-2001-S21
  - FIC-ACT-38-2001-S22
  - FIC-ACT-38-2001-S29
  - FIC-ACT-38-2001-S28A
  - FIC-ACT-38-2001-S43
  - FIC-ACT-38-2001-S23
decision-required: false
riskTaxonomy: RT-FC
binding-status: LICENCE-BIND
---

# Risk Management and Compliance Programme (RMCP) v1

> **Standing authority:** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10; W1 Workstream — AML/CFT-RMCP). This document constitutes the standalone Risk Management and Compliance Programme required by **Financial Intelligence Centre Act 38 of 2001 s.42**. It supersedes the draft RMCP at `Policies/risk-management-and-compliance-policy-v1.md` for `policy-id: RMCP-V1` purposes; the earlier file remains on record under its own `policy-id`.
>
> **Author:** Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim).
>
> **Obligations closed:** [`ORG-FC-01`](../Regulations/_obligations-register.md) (RMCP mandate); [`ORG-FC-07`](../Regulations/_obligations-register.md) (CTR filing); [`ORG-FC-08`](../Regulations/_obligations-register.md) (PAR filing); [`ORG-FC-09`](../Regulations/_obligations-register.md) (STR filing); [`ORG-FC-10`](../Regulations/_obligations-register.md) (tipping-off prohibition); [`ORG-FC-12`](../Regulations/_obligations-register.md) (training); [`ORG-FC-17`](../Regulations/_obligations-register.md) (FATF Rec. 16 wire transfers); [`ORG-FC-21`](../Regulations/_obligations-register.md) (post-greylisting remediation); [`ORG-FC-23`](../Regulations/_obligations-register.md) (PA AML/CFT/CPF Communication 1/2025).
>
> **Binding status:** LICENCE-BIND. These obligations apply in full from commencement-of-trading. This RMCP is authored and adopted now so that the substrate, procedures, and governance structures are production-grade at licence-day. Per `project_rules_bind_at_commencement.md` (memory): build-phase is preparation for compliance, not compliance.

---

## 1. Purpose and scope

### 1.1 Statutory mandate

Hoz Bank Limited (the **Bank**) adopts this Risk Management and Compliance Programme (**RMCP**) in fulfilment of its obligation under **Financial Intelligence Centre Act 38 of 2001 s.42** (`FIC-ACT-38-2001-S42`) to adopt and implement a risk management and compliance programme that complies with the requirements and standards of the Financial Intelligence Centre (**FIC** or the **Centre**). Register row [`ORG-FC-01`](../Regulations/_obligations-register.md).

The RMCP also responds to:

- **SARB Prudential Authority — AML/CFT/CPF Communication 1 of 2025 (Banks)** — post-greylisting PA banks-supervisory expectations on proliferation-financing controls and risk-based-approach calibration evidence. Register row [`ORG-FC-23`](../Regulations/_obligations-register.md). `[citation: TBC — precise § references inside the AML/CFT/CPF Communication 1/2025 PDF; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]`.
- **FATF Recommendations 1, 7, 10, 11, 12, 16, 18, 21** — the international risk-based approach standards against which SA's mutual-evaluation posture is assessed.
- **FIC General Notice 7 of 2017 — Guidance Note on the implementation of the risk-based approach** (**FIC GN 7**) — interpretive guidance on RBA periodicity and customer-typology dispatch.
- **FIC Act 38/2001 s.42A** — designation of the senior person responsible for compliance.
- **FIC Act 38/2001 s.43A** — accountable-institution registration; registration of the Bank and of Hoz Securities Limited upon FAIS-FSP authorisation (per CEO decision `D-FSP-LICENCE-NECESSITY`).

### 1.2 Accountable-institution status — FIC Act Schedule 1

The Bank is an **accountable institution** under **FIC Act Schedule 1, item 6** — a bank as defined in the Banks Act 94 of 1990. This classification follows automatically from the SARB licence-application pathway and the grant of a banking licence. The RMCP lodgment with the FIC, and the MLRO designation registration via FIC RegOnline, take effect from the date the banking licence is granted.

**Hoz Securities Limited** — accountable institution upon FAIS-FSP authorisation per `D-FSP-LICENCE-NECESSITY` (CEO-approved 2026-05-09); RMCP scope extends to Hoz Securities Limited from FSP-authorisation date.

The RMCP applies **multi-entity** across both accountable institutions. The group-level legal-entity tree is at [`Regulations/_legal-entity-tree.md`](../Regulations/_legal-entity-tree.md).

### 1.3 Programme governance and accountability

| Role | Holder | Statutory authority |
|---|---|---|
| Accountable executive (FIC Act s.42A senior person) | Triple-hatted human at licence-day (MLRO + FIC Compliance Officer + Information Officer) per `D-THIN-HUMAN-LAYER-MINIMUM`. Interim build-phase: Marc (CEO) holds formal designation; Zara (Chief Compliance Officer, governance) holds operational role. | FIC s.42A; [`ORG-FC-11`](../Regulations/_obligations-register.md) |
| MLRO | Triple-hatted licence-day human; Zara (Chief Compliance Officer, governance) interim. | FIC s.43A; [`ORG-FC-11`](../Regulations/_obligations-register.md) |
| Deputy MLRO | AC-Chair NED at licence-day (per `D-THIN-HUMAN-LAYER-MINIMUM` §4.2). | [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md) |
| FIC Compliance Officer | Same triple-hatted human as MLRO at licence-day; Zara (Chief Compliance Officer, governance) interim. | FIC s.43A |
| Compliance / RegTech engineer | Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer) | W1 engineering substrate (Slices 2–7) |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | FIC s.42(2) recon harnesses |
| POPIA cross-reference | Iris (Information Officer, governance) | POPIA ss.13, 18, 19–22 cross-reference where CDD intersects personal-information processing |

### 1.4 Board and CEO approval

This RMCP is approved at the CEO level in the build phase. At licence-day, Board Risk Committee (**BRC**) and Board approval is required per the policy register. Annual renewal is approved by the BRC, signed by Zara (Chief Compliance Officer, governance) as the FIC-named accountable person.

---

## 2. Customer identification and verification (CIV)

### 2.1 Regulatory anchors

The CIV programme implements:

- **FIC Act ss.21–21H** (`FIC-ACT-38-2001-S21`) — customer identification, verification, beneficial-ownership resolution, ongoing CDD, EDD for high-risk clients, PEP screening, foreign correspondent due diligence.
- **FIC Act s.22** (`FIC-ACT-38-2001-S22`) — record all information obtained through the CDD process.
- **FIC Act s.42(2)(b)** — the RMCP must address how CDD is conducted.
- **FATF Recommendation 10** — customer due diligence.
- **FATF Recommendation 12** — politically exposed persons.
- **FIC Guidance Note 5** — beneficial ownership.
- Register rows: [`ORG-FC-02`](../Regulations/_obligations-register.md) (CDD), [`ORG-FC-03`](../Regulations/_obligations-register.md) (EDD / PEPs), [`ORG-FC-04`](../Regulations/_obligations-register.md) (beneficial ownership), [`ORG-FC-18`](../Regulations/_obligations-register.md) (continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md) (RBA periodicity).

### 2.2 Minimum identification requirements

No client enters the client master without satisfying upfront standard CDD. Activation of a client without satisfied CDD is a Critical event under the AML/CFT Policy.

**Standard CDD steps:**

1. **Client identification.** Collect full legal name, registration number, jurisdiction of incorporation, registered address, and authorised signatories for legal-entity clients. For natural-person clients (none anticipated in the institutional-only model; procedure maintained for completeness), collect full name, date of birth, identity number, residential address.

2. **Client verification.** Verify client identity against reliable, independent documentary sources. For regulated domestic financial institutions: FSCA / SARB register extract + CIPC registration certificate. For foreign entities: equivalent home-jurisdiction regulatory register + certificate of incorporation. Verification evidence is stored in the document-substrate (D-RMS-PHASE-1 Slice 1) and referenced by BLAKE3 hash from the `ClientCddCompleted` event.

3. **Purpose and nature of business relationship.** Document the intended purpose of the relationship, anticipated transaction volumes, and source of funds / wealth for the entity. For institutional counterparties: audited financial statements + regulatory filings are sufficient source-of-wealth evidence at standard tier.

4. **Sanctions screening at onboarding.** All onboarding clients (including UBOs and controlling parties) are screened against the full sanctions list set (UN SC, OFAC SDN, EU consolidated, UK HMT, POCDATARA / DTI) before a `ClientCddCompleted` event is emitted. A `SanctionsScreeningCompleted` event with `outcome: clear` is a prerequisite. True-positive matches block onboarding entirely (`SanctionsTruePositiveBlocked`); no client is admitted with an unresolved sanctions match.

5. **Risk rating assignment.** The client risk rating (high / medium / low) is computed per §8.2 methodology and embedded in the `ClientCddCompleted` event payload.

### 2.3 Beneficial ownership — FIC Act s.21B

Recursive resolution of beneficial ownership to natural persons who ultimately own or control **≥ 25%** of the legal entity, or who exercise effective control, per FIC Act s.21B and FIC Guidance Note 5. Resolution terminates at: (a) a natural person; (b) a listed company subject to disclosure requirements equivalent to SA law; (c) a state entity. Complex trust structures are resolved under the Trust Property Control Act 57 of 1988 read with FIC Act requirements; Imani (Legal-as-code engineer, engineering — reports to Devon, COO interim) owns the clause-library templates for trust-resolution documentation.

A `ClientBeneficialOwnerResolved` event is emitted for each resolved entity in the ownership chain. Unresolved beneficial ownership suspends client activation pending MLRO escalation.

### 2.4 PEP identification — FIC Act s.21A

The Bank maintains a **PEP identification process** integrated into the onboarding and continuous-KYC workflows:

1. **PEP screening at onboarding.** All clients and their UBOs / controlling parties are screened against PEP databases (commercial data feed — W1 Slice 3 substrate) as part of standard CDD.

2. **PEP identification post-onboarding.** Continuous-KYC signal sources (media monitoring, regulatory announcements, commercial PEP feeds) are processed by the continuous-KYC projection (W1 Slice 3). A PEP identification on an existing client triggers a `ClientEddTriggered` event with `trigger: pep-identified` and routes to the EDD pathway (§2.5).

3. **MLRO sign-off.** All PEP relationships (domestic and foreign) require MLRO sign-off (`MlroEddApproved` event) before establishment or continuation per the EDD-mandatory categories below.

4. **Enhanced ongoing monitoring.** PEP-rated clients are subject to annual CDD refresh and maximum-sensitivity transaction monitoring regardless of the automated risk rating.

### 2.5 Enhanced CDD — EDD-mandatory categories

Enhanced CDD (**EDD**) is applied to all clients rated **high-risk** and to all clients falling into the following EDD-mandatory categories regardless of the automated risk rating:

| Category | Additional EDD steps |
|---|---|
| Politically Exposed Persons (PEPs) — domestic and foreign (FIC Act s.21A; FATF Rec. 12) | Identify PEP status (including family members and close associates); obtain MLRO sign-off before establishing / continuing relationship; apply enhanced ongoing monitoring; re-verify source of wealth |
| Foreign correspondent banks | Assess AML/CFT controls of the correspondent institution; determine that no FATF-listed entity is involved; obtain senior management approval; monitor on an ongoing basis (see §10 correspondent banking) |
| Complex or high-risk structures (trusts, multi-layer holding structures, private wealth vehicles) | Full resolution of ownership chain; obtain evidence of trust deed / constitutional documents; identify all beneficiaries |
| Clients from high-risk jurisdictions (FATF black/grey list; EU high-risk list) | Enhanced source-of-wealth documentation; transaction-monitoring at maximum sensitivity; senior management approval |
| Clients with unresolved beneficial ownership | Escalate to MLRO; relationship suspended until BO resolved |
| Any client where transaction patterns suggest elevated ML/TF/CPF risk | Triggered by `TransactionMonitoringHit` or MLRO investigation outcome |

**EDD sign-off authority.** All EDD relationships require MLRO sign-off (`MlroEddApproved` event) before activation or continuation.

### 2.6 Simplified CDD — low-risk clients

Simplified CDD may be applied to clients meeting **all** of the following criteria:

- Risk rating: **low** per the §8.2 methodology;
- Client type: regulated domestic financial institution (SARB / FSCA registered) or SA government entity;
- No PEP, sanctions, or geographic risk flags present;
- Product: vanilla JSE equities / bonds only (no OTC derivatives, no cross-border FX).

**Simplified CDD reduces — it does not eliminate — CDD obligations.** Minimum simplified CDD scope: client identification and verification (steps 1–2 of §2.2); sanctions screening at onboarding; initial risk rating assignment. Reviewed annually; any change to client's product access, risk profile, or geographic exposure triggers upgrade to standard or enhanced CDD.

### 2.7 POPIA cross-reference

All CDD personal-information handling is routed through the POPIA substrate managed by Iris (Information Officer, governance). Collection of personal information at CDD is notified per POPIA s.18; the purpose specification (POPIA s.13) is "CDD under FIC Act 38/2001 ss.21–21H". Register cross-reference [`ORG-PR(IV)-06`](../Regulations/_obligations-register.md) (POPIA security safeguards).

---

## 3. Record-keeping — FIC Act ss.22A-23

### 3.1 Regulatory anchors

- **FIC Act s.22** (`FIC-ACT-38-2001-S22`) — retain CDD records and transaction records for at least **five years** after the end of the business relationship or the date of the transaction. Register row [`ORG-FC-05`](../Regulations/_obligations-register.md).
- **FIC Act s.22A** — the form and manner in which records must be kept.
- **FIC Act ss.23–24** (`FIC-ACT-38-2001-S23`) — records must be kept in a form usable for supervisory purposes; records of monitored transactions must be retained.
- **FIC Act s.42(2)(f)** — the RMCP must address record-keeping.
- **FATF Recommendation 11** — record-keeping.

### 3.2 Retention periods

**5-year floor (FIC Act s.22).** All CDD records and transaction records must be retained for a minimum of five years from:
- (a) the end of the business relationship; or
- (b) the date of the single transaction (for one-off transactions).

**Conservative retention default.** Where the FIC Act s.22 5-year floor intersects with a longer applicable retention floor (e.g. JSE Equities Rules 7-year trade-record retention per [`ORG-MK-15`](../Regulations/_obligations-register.md); Conduct Standard 3/2018 §12 ≥5-year OTC derivatives record-keeping), the longer floor governs. The `RETENTION_CONSERVATIVE_DEFAULT` principle is implemented in the event-store retention registry at `prototype/platform/event-store/registry.ts`.

| Record class | Retention floor | Binding instrument |
|---|---|---|
| CDD / AML events (`ClientCddCompleted`, `ClientEddCompleted`, `ClientBeneficialOwnerResolved`, etc.) | 5 years from end of relationship (`RETENTION_FIC_S22_5Y`) | FIC Act s.22 |
| Transaction records intersecting JSE trade records | 7 years from trade date (`RETENTION_JSE_TRADE_7Y`) | JSE Equities Rules sub-rules `[citation: TBC]` |
| STR / CTR / PAR filing records | 5 years from date of filing | FIC Act s.22 |
| Training attestation records | 5 years from date of attestation | FIC Act s.22 (by analogy) |

### 3.3 Format requirements — FIC Act s.22A

Records must be kept in a form that:

1. Is accessible and retrievable for supervisory review on request (FIC Act ss.23–24);
2. Is legible and usable without further processing;
3. Allows identification of the persons and accounts involved;
4. Preserves the integrity of the record against unauthorised alteration.

**Technical implementation.** All records are stored as typed events in the append-only event store (Principle 1 — events are the only source of truth). Document artefacts (PDFs, confirmations, settlement instructions) are stored in the BLAKE3 content-addressed document store (D-RMS-PHASE-1 Slice 1) with hash references embedded in the relevant event payload. The append-only architecture satisfies the integrity requirement; the content-addressed store satisfies retrievability.

### 3.4 CDD records content

For each client, CDD records include:

- Full client identification documents and verification sources;
- Beneficial ownership resolution records (`ClientBeneficialOwnerResolved` events) with supporting documentation referenced by BLAKE3 hash;
- EDD packs where applicable (`ClientEddCompleted` events);
- PEP-screening outputs and MLRO approval records;
- Risk rating assignments and override records.

### 3.5 Transaction records content — FIC Act s.22

For each transaction, records include:

- The identity of the persons or account holders involved in the transaction;
- The identity of any person acting on behalf of a client in the transaction;
- The amount, currency, and nature of the transaction;
- The date of the transaction;
- Business correspondence concerning the transaction.

### 3.6 Supervisory access

Records must be made available to the FIC and the PA on request in a form usable for supervisory purposes (FIC Act ss.23–24). The document-substrate and event-store APIs support supervisory read access via a dedicated read-path. The FIC registration number and contact details for the MLRO are maintained current per the FIC portal procedures (§4.5).

---

## 4. Suspicious transaction reporting (STR) / cash threshold reporting (CTR)

### 4.1 Regulatory anchors

- **FIC Act s.29** (`FIC-ACT-38-2001-S29`) — Suspicious Transaction Reports (STRs) filed as soon as possible, and in any event within **15 calendar days** after the institution knows or suspects a transaction relates to ML/TF. Register row [`ORG-FC-09`](../Regulations/_obligations-register.md).
- **FIC Act s.28** — Cash Threshold Reports (CTRs) for cash transactions ≥ R 24,999.99. Register row [`ORG-FC-07`](../Regulations/_obligations-register.md).
- **FIC Act s.29(3)** — Tipping-off prohibition. Register row [`ORG-FC-10`](../Regulations/_obligations-register.md).
- **FIC Act s.42(2)(d)** — the RMCP must address reporting obligations.

### 4.2 Suspicious Transaction Reports — FIC Act s.29

**Trigger.** An STR must be filed when the Bank or any of its agents **knows or suspects** that a transaction is connected to money laundering, terrorist financing, proliferation financing, or any other financial crime. Suspicion is a subjective test; the obligation arises as soon as suspicion is formed, not when certainty is achieved.

**Filing timeline.** The STR must be filed **as soon as possible and in any event within 15 calendar days** after the date on which the institution first knows or suspects the transaction relates to ML/TF/PF. The `recon:str-15-day-window` recon (planned, W1 Slice 4) asserts the wall-clock delta between `MlroInvestigationDecided` (where action = file) and `StrFiled` is ≤ 15 calendar days.

**MLRO sign-off process:**

1. **Transaction monitoring hit.** `TransactionMonitoringHit` event emitted by the monitoring engine (W1 Slice 4) with typology code and alert detail.
2. **Alert triage.** Mira (Compliance / RegTech engineer, engineering) triages automated alerts. False positives are documented in a `MonitoringAlertClosed` event with rationale. True positives or ambiguous cases escalate to the MLRO.
3. **MLRO investigation.** MLRO opens a formal investigation (`MlroInvestigationOpened` event). All investigation records are held within the MLRO-investigation-set encryption boundary (§4.4).
4. **MLRO decision.** MLRO decides to file or not file (`MlroInvestigationDecided` event with `action: file` or `action: no-file` and documented rationale).
5. **STR filing via FIC goAML.** STR submitted via the FIC goAML portal — see §4.5.

**No internal override of MLRO.** The MLRO's decision to file an STR is not subject to internal override. The Bank may not impose any sanction or adverse consequence on the MLRO for filing or for a decision not to file.

### 4.3 Cash Threshold Reports — FIC Act s.28

**Threshold.** A CTR must be filed for every **cash transaction** (or combination of related cash transactions on a single day) of an amount **equal to or exceeding R 24,999.99**, or such other amount as the Minister may prescribe.

The Bank's institutional-only model and electronic-only delivery channels mean cash CTR triggers are not anticipated in the ordinary course. The CTR pathway is maintained as a control:

- Cash-class transaction events are detected by the monitoring engine (W1 Slice 4).
- Any `Transaction*` event with `transactionClass: cash` and `amount >= 24999.99` ZAR triggers an automatic `CtrFiled` event via the CTR pipeline.
- CTR is submitted via the FIC goAML portal (`CtrFiled` event; `GoAmlReportSubmitted` event with submission reference).

### 4.4 Tipping-off prohibition — FIC Act s.29(3)

**Statutory prohibition.** It is a criminal offence under **FIC Act s.29(3)** to disclose to any person — including the client concerned — that an STR has been filed, is being filed, or is contemplated. Register row [`ORG-FC-10`](../Regulations/_obligations-register.md).

**Cryptographic enforcement.** All STR-stream events (`MlroInvestigationOpened`, `MlroInvestigationDecided`, `StrFiled`) are encrypted under an MLRO-held key envelope. Only the MLRO and Deputy MLRO identities can decrypt these events. All other agents and personnel receive a typed `EncryptedEventRedacted` placeholder. The `recon:tipping-off-isolation` recon (planned, W1 Slice 4) asserts no non-MLRO agent reads MLRO-investigation-set events.

**Inferential tipping-off guard.** No projection, dashboard, or report exposes a per-client field whose presence / absence would imply STR existence. The "client under investigation" status is held only within MLRO-key-encrypted projections.

**Staff conduct.** All staff (including AI agents with access to client-master data) are briefed on the tipping-off prohibition as part of the training programme (§6). Any inadvertent disclosure is treated as a Critical compliance event; MLRO notification and FIC engagement are triggered immediately.

### 4.5 FIC goAML submission pathway

**Status: stub — system not yet live at build-phase.** The goAML portal integration is engineering-planned under W1 Slice 6. The submission harness will generate the required goAML XML, submit via the FIC API, and record the submission reference number in the `GoAmlReportSubmitted` event payload. The harness is idempotent: repeated submission of the same report-id is a no-op at the harness layer.

**Manual fallback (build-phase).** Until the goAML harness is live, the MLRO (Zara, Chief Compliance Officer, governance) submits STRs / CTRs / PARs manually via the FIC goAML web portal. Each manual submission is recorded as a `GoAmlReportSubmitted` event with the submission reference number and timestamp immediately after submission.

**RegOnline portal.** MLRO designation lodgment (§1.3) and PAR submissions are maintained via the FIC RegOnline portal. Registration details (MLRO name, contact details, designation date) are kept current; updates within 15 business days of any change.

---

## 5. Terrorist financing reporting — FIC Act s.28A

### 5.1 Regulatory anchor

**FIC Act s.28A** (`FIC-ACT-38-2001-S28A`) — Property Association Reports (PARs) must be filed when the Bank knows or suspects that property in its possession or under its control is associated with terrorist activities or with the financing of terrorist activities, including proliferation-financing. Register row [`ORG-FC-08`](../Regulations/_obligations-register.md).

### 5.2 Immediate reporting obligation

**The PAR obligation is immediate.** Unlike STRs (15-calendar-day window), the PAR obligation under FIC Act s.28A arises as soon as the Bank knows or suspects that property is associated with terrorism or TF. There is no grace period. A `SanctionsTruePositiveBlocked` event identifying property associated with a UNSC-designated terrorist or entity triggers an immediate MLRO review and PAR filing workflow.

**Filing pathway:**

1. `SanctionsTruePositiveBlocked` event emitted by the sanctions engine (W1 Slice 4).
2. MLRO reviews immediately — no triage queue; direct MLRO escalation is required.
3. MLRO determines whether the blocked property meets the FIC Act s.28A threshold.
4. `ParFiled` event emitted with MLRO sign-off; `RegOnlineReportSubmitted` event with submission reference number and timestamp.
5. All PAR records retained per §3.2 (5-year floor, same day-of-filing) in the document-substrate and the event-store.

### 5.3 Proliferation-financing (CPF) — POCDATARA and FATF Rec. 7

**POCDATARA.** The Protection of Constitutional Democracy Against Terrorist and Related Activities Act 33 of 2004 (POCDATARA) imposes domestic obligations on freezing and reporting property associated with terrorist financing and proliferation. The Bank's sanctions screening (§9) includes the DTI / POCDATARA list. A POCDATARA match triggers the same PAR pathway as a UNSC match.

**FATF Recommendation 7 / PA Communication 1/2025.** The Bank treats CPF risk as a first-class AML/CFT/CPF category per the PA AML/CFT/CPF Communication 1/2025 ([`ORG-FC-23`](../Regulations/_obligations-register.md)) and FATF Rec. 7. CPF risk indicators are embedded in the transaction-monitoring rule set (W1 Slice 4) and reviewed annually alongside the Business Risk Assessment (§8.2).

---

## 6. Training programme — FIC Act s.43

### 6.1 Regulatory anchors

- **FIC Act s.43** (`FIC-ACT-38-2001-S43`) — the accountable institution must take steps to train its employees in the recognition and handling of transactions relating to ML/TF and in their obligations under the FIC Act. Register row [`ORG-FC-12`](../Regulations/_obligations-register.md).
- **FIC Act s.42(2)(h)** — the RMCP must address training.
- **FATF Recommendation 18** — internal controls, including training.

### 6.2 Training frequency and content

**Frequency.** All AML-touching agents and human personnel must complete:

- **Onboarding training** — before assuming AML-touching responsibilities.
- **Annual renewal** — within 12 months of the previous completion.
- **Event-triggered training** — within 30 days of any material regulatory change (new FATF guidance, FIC public compliance communication, PA circular) or material change to the Bank's business model.

**Content (role-based modules):**

| Module | Target | Core content |
|---|---|---|
| RMCP overview | All agents and licence-day humans | FIC Act s.42 framework; accountable-institution status; reporting obligations; tipping-off prohibition |
| CDD / EDD procedures | Client-master agents (Mira); licence-day MLRO | Identification, verification, BO resolution; PEP procedures; EDD sign-off process |
| Transaction monitoring | Monitoring-engine agents (Mira); MLRO | Typology recognition; alert-triage procedure; STR decision pathway |
| Sanctions screening | Sanctions-engine agents (Mira); MLRO | List categories; true-positive identification; PAR filing |
| Tipping-off and confidentiality | All agents and licence-day humans | Criminal offence status; cryptographic enforcement; conduct obligations |
| CPF / FATF Rec. 7 | MLRO and senior governance agents | Proliferation-financing typologies; PA Communication 1/2025 expectations |
| Correspondent banking AML | MLRO; correspondent-banking agents | Wolfsberg Principles; nested correspondent prohibition; SWIFT KYC Registry |

### 6.3 AI-agent substrate attestation

The Bank's labour force is **autonomous AI agents** (Principle 6 — autonomous by default). The training obligation maps to **agent-substrate-attestation**: every AML-touching agent carries a current-version attestation that its operating spec includes the relevant AML/CFT/CPF obligations and that the agent's reasoning substrate is current. This is a novel regulatory-mapping; external-counsel ratification at licence-application per the gate plan.

**Agent attestation event.** `AgentTrainingAttested` — emitted by Sade (AgentOps / HR engineer, engineering) on each agent's standing cadence (at minimum annually; re-triggered on any material operating-spec update). Attestation payload: agent ID, operating-spec version hash, obligations covered, attestation date. Retained per `RETENTION_FIC_S22_5Y` floor.

**AML-touching agents (current scope):**

| Agent | Position | AML obligation |
|---|---|---|
| Mira | Compliance / RegTech engineer, engineering | CDD substrate, transaction monitoring, reporting pipeline |
| Zara | Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim | MLRO decisions, EDD sign-off, programme governance |
| Iris | Information Officer, governance | POPIA / CDD personal-information handling |

The `recon:aml-training-currency` recon (planned, W1 Slice 7) asserts every AML-touching agent has a current-cycle `AgentTrainingAttested` event within 13 months.

### 6.4 Human training — licence-day

At licence-day, the human personnel roster includes the triple-hatted MLRO + FIC Compliance Officer + Information Officer and the AC-Chair NED (Deputy MLRO). Both carry:

- A **FIC-recognised AML/CFT training certificate** from an accredited provider, completed within 12 months prior to licence-day.
- Annual renewal on each anniversary of the designation.

Training completion is a **precondition** for the MLRO and Deputy MLRO designations taking effect; no designation lodgment is submitted without a current training certificate.

### 6.5 Training record-keeping

Training attestation records are maintained for all agents and human personnel for a minimum of five years from the date of attestation. For agents: `AgentTrainingAttested` events in the event-store under `RETENTION_FIC_S22_5Y`. For humans: `HumanTrainingCompleted` events with the training-certificate document referenced by BLAKE3 hash from the document-substrate.

---

## 7. Governance and accountability

### 7.1 MLRO designation — FIC Act s.42A

The MLRO is designated as the **senior person responsible for ensuring that the Bank complies with its obligations** under the FIC Act. The MLRO holds primary accountability for:

- The day-to-day operation of the RMCP;
- All STR / CTR / PAR filing decisions;
- EDD sign-off for high-risk and PEP clients;
- Annual RMCP review (§11.2);
- MLRO registration with the FIC via RegOnline.

**Interim build-phase designation.** Marc (CEO) holds the formal FIC Act s.42A designation during the build phase. Zara (Chief Compliance Officer, governance) holds the operational MLRO role. Both role-holders are identified in the FIC RegOnline registration.

**Licence-day.** The triple-hatted human (MLRO + FIC Compliance Officer + Information Officer) per `D-THIN-HUMAN-LAYER-MINIMUM` assumes the formal designation. The transition is a precondition for commencement-of-trading.

### 7.2 Deputy MLRO

The AC-Chair NED serves as Deputy MLRO at licence-day (per `D-THIN-HUMAN-LAYER-MINIMUM` §4.2). The Deputy MLRO:

- Can authorise all MLRO functions when the MLRO is unavailable;
- Must hold equivalent AML/CFT training certification (§6.4);
- Provides a second sign-off for risk-rating downward overrides (§8.3);
- Is registered with the FIC via RegOnline alongside the primary MLRO.

The succession trigger for Deputy MLRO activation is a documented `MlroUnavailable` event; the Deputy MLRO's actions during unavailability periods are recorded under their own identity.

### 7.3 Board oversight

At licence-day, the Board Risk Committee (**BRC**) provides oversight of the RMCP through:

- Annual RMCP review and approval;
- MLRO's annual report to the BRC covering STR / CTR / PAR filing statistics, training status, sanctions-list currency, Vera recon findings, and CPF control evidence;
- Escalation of any material compliance failures or regulatory inquiries.

In the build phase, Marc (CEO) wearing both hats performs BRC-equivalent oversight.

### 7.4 FIC Compliance Officer role — FIC Act s.43A

The FIC Compliance Officer (co-designated with the MLRO at licence-day) is responsible for:

- The Bank's registration as an accountable institution via FIC RegOnline;
- Maintaining the Bank's registration details current (MLRO name, contact details, entity details);
- Submitting any material updates within 15 business days of the change;
- Liaison with the FIC on all compliance and regulatory-engagement matters.

The FIC Compliance Officer role is not supervisory; it is administrative — ensuring the Bank's registration and portal access are maintained.

### 7.5 Vera's independent assurance mandate

Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) provides independent assurance over the RMCP via the recon harnesses listed in §11.3. Vera reports findings to Thandiwe (Chief Audit Executive, governance) and to the BRC (at licence-day) via the Decisions / Feedback register (D-RMS-PHASE-1).

---

## 8. Risk assessment — FIC Act s.42(2)(a)

### 8.1 Regulatory anchors

- **FIC Act s.42(2)(a)** (`FIC-ACT-38-2001-S42`) — the RMCP must include measures to identify, assess, and understand the ML/TF/PF risks to which the Bank is exposed.
- **FATF Recommendation 1** — assessing risks and applying a risk-based approach.
- **FIC GN 7** — guidance on RBA implementation including typology categorisation and review periodicity.
- **PA AML/CFT/CPF Communication 1/2025** — explicit PA expectation of calibrated RBA evidence. Register row [`ORG-FC-23`](../Regulations/_obligations-register.md).

### 8.2 Business Risk Assessment (BRA)

The Bank conducts a **Business Risk Assessment (BRA)** at the following cadence:

- **Initial BRA** — completed before commencement-of-trading. Documents the Bank's inherent ML/TF/PF risk profile given its business model, client typology, product families, delivery channels, and geographic footprint.
- **Annual refresh** — reviewed and updated within 12 months of the previous review, or within 90 days of any material change. South Africa's grey-list status under the FATF Mutual Evaluation (register row [`ORG-FC-21`](../Regulations/_obligations-register.md)) means the Bank applies the conservative RBA dispatch: where two risk tiers are plausible, the higher tier applies.

**BRA scope factors:**

| Risk dimension | Bank-specific read |
|---|---|
| Client typology | Institutional-only counterparties (per `project_strategic_foundation.md`): JSE members, licensed banks, asset managers, pension funds. No retail clients. |
| Product families | JSE bonds / equities spot; OTC interest-rate derivatives (IRD); FX (via sponsor / correspondent bank per `project_indirect_participant_posture.md`). No cash transactions above CTR threshold anticipated (institutional-only; no branch cash); CTR control maintained regardless. |
| Delivery channels | Electronic / algorithmic; no physical branch cash handling. |
| Geographic footprint | SA single-branch; cross-border flows via CMI-access sponsor banks (NPS RTGS / BankservAfrica via correspondent, CLS indirect access); potential UK Bribery Act extra-territorial exposure for UK-connected counterparties. |
| Correspondent / sponsor-bank channel | Sponsor-bank FX channel carries concentration and settlement risk; AML screen runs on the pre-trade counterparty master, not only at onboarding. |
| CPF risk | FATF Rec. 7 explicit expectation (PA Communication 1/2025): the Bank screens against UN Security Council targeted-financial-sanctions lists and maintains CPF risk indicators in the transaction-monitoring rule set alongside ML/TF typologies. |

### 8.3 Customer risk rating methodology

Every client in the client master carries a risk rating of **high**, **medium**, or **low** computed from a defined typology framework. The rating is emitted as part of the `ClientCddCompleted` event and drives:

- The CDD tier dispatched at onboarding (§2).
- The ongoing-monitoring frequency and transaction-monitoring sensitivity.
- The periodic CDD-refresh cadence per FIC GN 7 (§8.4).

**Risk-rating factors:**

| Factor | High-risk indicators | Low-risk indicators |
|---|---|---|
| Client type | PEPs and their associates; foreign correspondent banks; complex multi-layered structures; clients from high-risk jurisdictions (FATF black/grey list) | Regulated domestic financial institutions; listed corporates; SA government entities |
| Product / transaction profile | High-value OTC derivative structures; cross-border wire transfers to high-risk jurisdictions; atypical-for-profile transaction patterns | Vanilla JSE equities / bonds; domestic ZAR-denominated flows |
| Geography | Jurisdictions on FATF/EU/UK/OFAC lists; sanctioned-country touch-points | SA-domiciled entities with no high-risk-jurisdiction exposure |
| Beneficial ownership | Unresolved or complex beneficial ownership; nominee directors / shareholders; trust structures without identified beneficiaries | Directly identified natural-person UBO on first-level resolution |
| Source of funds / wealth | Complex or unverifiable source-of-wealth narratives | Regulated institutional capital with audited financials |

**Override authority.** The MLRO (Zara, Chief Compliance Officer, governance) may override an automated risk rating upward or downward by signing a `ClientRiskRatingOverrideApproved` event with documented rationale. Downward overrides require a second sign-off from the Deputy MLRO (AC-Chair NED at licence-day).

### 8.4 RBA periodicity — FIC GN 7

| Risk rating | Periodic CDD-refresh cadence | Transaction-monitoring sensitivity |
|---|---|---|
| High | Annual (12 months from last `ClientCddCompleted` event) | Maximum — all typologies active; alerts reviewed by MLRO within 5 business days |
| Medium | 24 months from last `ClientCddCompleted` event | Standard |
| Low | 36 months from last `ClientCddCompleted` event | Minimum — structural typologies only |

### 8.5 Enhanced due diligence triggers

The following events trigger automatic escalation to EDD regardless of the standing risk rating:

- `SanctionsScreeningHit` (any hit on any list) — EDD triggered pending MLRO investigation;
- `TransactionMonitoringHit` with severity `high` — EDD triggered on the client associated with the alert;
- `ClientJurisdictionRiskUpgraded` — client's jurisdiction moves onto FATF/EU/UK HMT high-risk list;
- `ClientPepIdentified` — PEP identified post-onboarding (continuous-KYC trigger);
- MLRO discretion — MLRO may trigger EDD at any time by emitting `ClientEddTriggered` with documented rationale.

### 8.6 Product and geographic risk factors

**Product risk.** OTC IRD products carry elevated ML/TF risk (complex structures; large notional values; potential for misuse of collateral flows). The pre-trade gateway (W1 Slice 4) screens every OTC IRD transaction against the client risk rating and current sanctions lists before order approval.

**Geographic risk.** The Bank maintains a **jurisdiction risk list** — a standing register of high-risk jurisdictions based on FATF / FSRB / EU / UK HMT classifications. The list is reviewed on every published update; the review event is `JurisdictionRiskListUpdated`. Orders involving counterparties or payment flows touching high-risk jurisdictions are routed for enhanced scrutiny per the EDD pathway.

---

## 9. Sanctions screening

### 9.1 Regulatory anchors

- **UN Security Council Resolutions** — targeted financial sanctions (TFS) including UNSC Resolution 1267 (Al-Qaida), UNSC Resolution 1718 (DPRK), and successor resolutions. Implemented in SA under POCDATARA 33 of 2004 (DTI list).
- **OFAC** — U.S. Office of Foreign Assets Control Specially Designated Nationals (SDN) consolidated list; extra-territorial application to USD-clearing flows.
- **EU Consolidated Financial Sanctions List** — EU Council Regulations implementing UNSC and EU autonomous sanctions.
- **UK HMT Consolidated List** — UK Office of Financial Sanctions Implementation (OFSI); UK Sanctions and Anti-Money Laundering Act 2018.
- **POCDATARA 33 of 2004 (DTI list)** — domestic implementation of UNSC targeted-financial-sanctions obligations; proliferation-financing (CPF) component per FATF Rec. 7.
- **FIC Act s.26B** — prohibition on transacting with designated persons.
- **PA AML/CFT/CPF Communication 1/2025** ([`ORG-FC-23`](../Regulations/_obligations-register.md)) — PA expectation of CPF sanctions-screening controls.

### 9.2 Sanctions screening scope

All of the following are screened against the full sanctions list set at every applicable trigger event:

- New clients at onboarding (pre-`ClientCddCompleted`);
- Existing clients on continuous-KYC refresh (any list update triggers a re-screen of the full client master);
- UBOs and controlling parties (at onboarding and on beneficial ownership resolution update);
- Counterparties to every transaction (pre-trade, pre-settlement);
- Correspondent banks and sponsor banks (at relationship establishment and annually);
- Any new person or entity added to the client master or the counterparty master.

### 9.3 List refresh frequency

| Sanctions list | Maximum refresh interval |
|---|---|
| UN Security Council consolidated list (UNSC/POCDATARA) | ≤ 24 hours from publication of any update |
| OFAC SDN consolidated list | ≤ 24 hours from publication of any update |
| EU consolidated financial sanctions list | ≤ 24 hours from publication of any update |
| UK HMT consolidated list (OFSI) | ≤ 24 hours from publication of any update |

The `recon:sanctions-list-currency` recon (planned, W1 Slice 4) asserts every active sanctions list has a `SanctionsListIngested` event within its per-list refresh window.

### 9.4 Hit resolution — zero-tolerance posture

**Zero-tolerance.** The Bank's sanctions risk appetite is zero: no transaction is executed, and no business relationship is maintained, with a sanctioned person or entity. The `recon:sanctions-zero-appetite` recon (planned) asserts zero `OrderApproved`-after-`SanctionsTruePositiveBlocked` without a paired `MlroSanctionsOverrideApproved`.

**True-positive pathway:**

1. `SanctionsTruePositiveBlocked` event emitted — transaction or relationship blocked.
2. MLRO immediate review (no triage queue for true positives).
3. For terrorist-financing / POCDATARA matches: PAR filed immediately (§5.2).
4. For all true positives: `FrozenPropertyRegistered` event if property is frozen under POCDATARA; `ClientSanctionedBlocked` event if the client is designated.
5. No `MlroSanctionsOverrideApproved` is issued for a confirmed true positive against a designated person or entity — this is a hard block.

**False-positive resolution.** False positives are documented in a `SanctionsScreeningFalsePositiveConfirmed` event with rationale; the client or transaction is unblocked. The MLRO reviews all false-positive resolutions weekly.

### 9.5 Domestic UN implementation — POCDATARA

POCDATARA 33 of 2004 is the primary domestic instrument implementing UNSC-targeted financial sanctions in SA. The DTI list (maintained by the Department of Trade, Industry and Competition under POCDATARA) is included in the Bank's screening scope. The Bank screens against the DTI list at the same ≤ 24-hour refresh frequency as the UNSC consolidated list.

Any POCDATARA match triggers:
- Immediate property freezing under POCDATARA s.12 (asset freeze);
- Immediate PAR filing (§5.2);
- FIC notification as required by POCDATARA.

---

## 10. Correspondent banking

### 10.1 Regulatory anchors

- **FATF Recommendations 13 and 18** — correspondent banking due diligence; Wolfsberg Principles.
- **FIC Act s.21G** — enhanced CDD for foreign financial institution clients.
- **FIC Act s.21H** — wire-transfer obligations; FATF Recommendation 16 (travel rule).
- Register row [`ORG-FC-17`](../Regulations/_obligations-register.md) (FATF Rec. 16 wire transfers).
- **Wolfsberg Group — Correspondent Banking Principles (2023)** — interpretive guidance on correspondent due diligence standards.

The Bank accesses critical market infrastructure (NPS RTGS via correspondent, CLS) via **sponsor / correspondent banks** (per `project_indirect_participant_posture.md`). This posture means the Bank is both a **respondent bank** (receiving correspondent services) and may act as a **correspondent bank** for certain clients. Both relationships are governed by this section.

### 10.2 Due diligence on correspondent institutions

Before establishing or continuing a correspondent banking relationship, the Bank applies mandatory EDD under FIC Act s.21G:

1. **AML/CFT programme assessment.** Obtain and review the correspondent institution's AML/CFT policy and procedures; assess the adequacy of its sanctions screening, CDD, and training programmes.
2. **Regulatory standing.** Confirm the correspondent institution is licensed and in good standing with its home-jurisdiction supervisor; confirm no FATF-listed entity status.
3. **Beneficial ownership / ownership structure.** Identify the correspondent institution's ownership structure and confirm no sanctioned or high-risk-jurisdiction ownership.
4. **SWIFT KYC Registry.** Use the SWIFT KYC Registry (where the correspondent is a SWIFT member) to obtain standardised KYC data and baseline AML/CFT documentation. SWIFT KYC Registry data supplements but does not replace the Bank's own due diligence.
5. **MLRO sign-off.** All correspondent banking relationships require `MlroEddApproved` before establishment or renewal.
6. **Senior management approval.** Correspondent banking relationships require senior management approval (CEO or CCO level) in addition to MLRO sign-off.

### 10.3 Wolfsberg Principles

The Bank applies the **Wolfsberg Group Correspondent Banking Principles (2023)** as the benchmark for correspondent due diligence. Key Wolfsberg commitments:

- Document the purpose and expected volume of the correspondent relationship;
- Understand the correspondent's client base and confirm that the respondent bank does not offer services to clients the Bank would not service directly;
- Assess the jurisdiction risk of the correspondent institution's home country;
- Confirm that the correspondent institution has in place AML/CFT policies and controls that meet or exceed FATF standards.

### 10.4 Nested correspondent prohibition

The Bank prohibits **nested correspondent arrangements** — arrangements where a correspondent institution uses the Bank's accounts to provide services to third-party financial institutions not directly known to the Bank. This prohibition is absolute and is embedded in the Bank's standard correspondent banking agreement terms (Imani, Legal-as-code engineer, engineering — clause-library template `CB-NESTED-PROHIB-01`).

Any attempt to establish a nested arrangement is treated as a Critical compliance event; the relationship is suspended pending MLRO investigation.

### 10.5 SWIFT KYC Registry

The Bank participates in the **SWIFT KYC Registry** for all SWIFT-connected correspondent banking relationships. The SWIFT KYC Registry provides:

- Standardised KYC documentation exchange (bank information files);
- Baseline AML/CFT attestation data;
- Ongoing monitoring of any material changes to correspondent institutions' profiles.

SWIFT KYC Registry data is reviewed at relationship establishment and on any published profile update. A `CorrespondentKycRegistryReviewed` event is emitted on each review.

### 10.6 Wire-transfer obligations — FATF Recommendation 16

For wire transfers executed through correspondent / sponsor-bank channels, the Bank complies with the FATF Recommendation 16 (travel rule) requirements:

- Originator information (name, account number, address or date/place of birth, identity number) is included in all wire transfers;
- Beneficiary information (name, account number) is included in all wire transfers;
- Wire transfers missing required originator / beneficiary information are rejected or returned;
- Records of originator and beneficiary information are retained per §3 (5-year floor).

The wire-transfer obligation is partially a sponsor-bank obligation (for NPS RTGS / CLS indirect access via correspondent); the Bank contractually requires its sponsor banks to comply with FATF Rec. 16 as a condition of the correspondent agreement.

---

## 11. Non-compliance escalation

### 11.1 Internal disciplinary procedures

**Scope.** Non-compliance with this RMCP by any agent or human personnel is a disciplinary matter. Non-compliance categories:

| Severity | Examples | Consequence |
|---|---|---|
| Critical | Failure to file an STR within the 15-day window; tipping-off (criminal); transacting with a sanctioned entity; activating a client without completed CDD | Immediate suspension of relevant system access; MLRO investigation; regulatory breach notification (§11.3); potential criminal referral |
| High | Failure to complete annual training within the required window; EDD not triggered when required; risk-rating override without documented rationale | MLRO investigation; corrective action plan; BRC reporting |
| Medium | Incomplete CDD documentation; record-keeping gaps; failure to refresh a sanctions list within the required window | Corrective action plan; Vera finding; recon follow-up |

**AI-agent non-compliance.** Non-compliance by an AI agent is surfaced as a Vera finding and escalated to Sade (AgentOps / HR engineer, engineering) for operating-spec update or agent suspension. The MLRO reviews all agent non-compliance findings within 5 business days.

**Human non-compliance.** Non-compliance by human personnel (licence-day humans) is addressed under the Bank's disciplinary procedure (Sade, AgentOps / HR engineer, engineering — employment-contracts slice, activates at licence-day). In the build phase, Marc (CEO) makes disciplinary determinations for any identified human non-compliance.

### 11.2 FIC voluntary disclosure

Where the Bank identifies a breach of its FIC Act obligations before the FIC or PA does, the Bank considers **voluntary disclosure** to the FIC under FIC Act s.45C (penalty mitigation). Voluntary disclosure:

- Is an MLRO decision (not delegable);
- Requires documentation of the breach, the root-cause analysis, the remediation steps, and the proposed penalty-mitigation case;
- Is executed via the FIC RegOnline portal or direct FIC engagement.

The MLRO consults with Zara (Chief Compliance Officer, governance) and Imani (Legal-as-code engineer, engineering) before making a voluntary disclosure recommendation. External counsel engagement (at licence-day) is required for any voluntary disclosure that may carry criminal implications.

### 11.3 Regulatory breach notification

**Mandatory notification.** Certain breaches require notification to the regulator without awaiting the outcome of an internal investigation:

| Breach type | Regulator | Timeline | Instrument |
|---|---|---|---|
| Failure to file an STR (confirmed, post-investigation) | FIC | As soon as reasonably practicable | FIC goAML / RegOnline |
| Tipping-off breach | FIC + SAPS | Immediately | FIC RegOnline + SAPS report |
| POCDATARA / property-freezing failure | FIC + DTI | Immediately | FIC RegOnline + DTI notification |
| Material RMCP control failure (PA supervisory obligation) | PA | Within timeframe specified by PA supervisory communication or within 30 days if no specific timeframe | PA secure channel |
| POPIA personal-information breach where CDD records are affected | IOCSA (Information Regulator) + FIC | Within 72 hours to Information Regulator (POPIA s.22); FIC notification by MLRO | Information Regulator breach notification portal |

All breach notifications are documented as `RegulatoryBreachNotified` events with the regulator name, notification timestamp, breach reference, and the MLRO's signed rationale.

### 11.4 Non-compliance register

The MLRO maintains a **non-compliance register** (document-substrate artefact; `Recon:NonComplianceRegister` projection — planned, W1 Slice 2) recording:

- All identified breaches (internal and regulatory);
- Severity classification;
- Root-cause analysis;
- Remediation steps and timelines;
- Status (open / remediated / regulatory-notified / closed).

The non-compliance register is presented to the BRC annually (at licence-day) and to the PA on supervisory request.

---

## 12. Programme review and compliance assessment

### 12.1 Annual RMCP review

The RMCP is reviewed **annually** (in any event within 12 months of the previous review or within 90 days of any material regulatory change). The review addresses:

1. **BRA refresh** (§8.2) — updated for any material change to the business model, client base, product family, or geographic footprint; updated for the latest FATF SA Mutual Evaluation and NRA findings; updated for any PA / FIC Public Compliance Communications issued since the last review.
2. **Client risk-rating methodology review** (§8.3) — typologies reviewed against current FATF / FIC guidance.
3. **CDD programme adequacy** (§2) — verify CDD / EDD / simplified CDD thresholds remain appropriate; confirm PEP-screening database currency.
4. **Record-keeping review** (§3) — confirm retention classes and document-substrate integrity; run `recon:retention-citation-coverage`.
5. **Reporting statistics review** (§4–5) — MLRO reports to the BRC on STR / CTR / PAR filing statistics (without revealing tipping-off-protected details); review alert-disposition statistics; confirm goAML / RegOnline portal registrations are current.
6. **Training adequacy review** (§6) — confirm all agents and licence-day humans have current-cycle attestations; review training content for currency.
7. **Sanctions list currency** (§9) — confirm all sanctions lists have been refreshed within their per-list frequency.
8. **Correspondent banking review** (§10) — confirm SWIFT KYC Registry data is current; confirm no nested correspondent arrangements; review correspondent risk ratings.
9. **Non-compliance register review** (§11.4) — review all open items; confirm remediation timelines are being met.
10. **CPF control evidence** — document calibrated RBA evidence per PA Communication 1/2025 ([`ORG-FC-23`](../Regulations/_obligations-register.md)).

**Review output.** The annual review is recorded as an `RmcpAnnualReviewCompleted` event (W1 Slice 2 — event-type registration). The event payload references the updated RMCP version (BLAKE3 hash from document-substrate), the updated BRA document (BLAKE3 hash), and the MLRO sign-off.

**Review sign-off.** The annual RMCP review is signed by Zara (Chief Compliance Officer, governance — MLRO) and reviewed by Thandiwe (Chief Audit Executive, governance) for internal-audit adequacy before submission to the BRC.

### 12.2 Vera's recon harnesses — FIC s.42(2) coverage

Vera (Internal audit / continuous-assurance engineer, engineering) provides independent assurance over the RMCP via the following planned recon harnesses:

| Recon name | What it asserts | Cadence |
|---|---|---|
| `recon:rmcp-section-coverage` | Every FIC s.42(2)(a)-(j) sub-clause has a corresponding RMCP section | Continuous; on every RMCP version update |
| `recon:kyc-periodicity-coverage` | Every active client has a `ClientCddCompleted` within the per-rating RBA window | Daily |
| `recon:cdd-completion-coverage` | Every active client has a `ClientCddCompleted` before any `Order*` event is approved | Pre-trade gate; also daily retrospective |
| `recon:transaction-monitoring-coverage` | Every settled `Transaction*` event has at least one `TransactionMonitored` event paired by `transactionId` | Daily |
| `recon:str-15-day-window` | No `StrFiled` event is more than 15 calendar days after the corresponding `MlroInvestigationDecided` (file) event | Daily |
| `recon:tipping-off-isolation` | No non-MLRO agent reads MLRO-investigation-set events | Continuous |
| `recon:tipping-off-inference` | No dashboard / projection exposes a per-client field whose presence implies STR existence | Continuous; on every projection schema update |
| `recon:aml-training-currency` | Every AML-touching agent + licence-day human has a current-cycle attestation within 13 months | Monthly |
| `recon:sanctions-list-currency` | Every active sanctions list has a `SanctionsListIngested` event within its per-list refresh window | Daily |
| `recon:sanctions-zero-appetite` | Zero `OrderApproved`-after-`SanctionsTruePositiveBlocked` without paired `MlroSanctionsOverrideApproved` | Real-time; also daily retrospective |
| `recon:retention-citation-coverage` | Every FC-domain event-type's retention class has a citation pointing at the binding obligation | Continuous; on every event-type registration |
| `recon:rmcp-risk-identification-currency` | Typology register has a current-year `RmcpTypologyReviewed` event | Annual; alert if missing within 13 months |
| `recon:correspondent-kyc-currency` | Every active correspondent institution has a `CorrespondentKycRegistryReviewed` event within 12 months | Annual; alert if missing |
| `recon:non-compliance-register-open-items` | All open non-compliance register items have a remediation-action-due date that is not overdue | Weekly |

### 12.3 PA submission cadence

The Bank engages with the PA on AML/CFT/CPF programme adequacy at the following touchpoints:

- **Annual RMCP review** — summary findings submitted to the PA on request or as part of the licence-day application pack.
- **PA supervisory engagement** — MLRO (Zara, Chief Compliance Officer, governance) presents: (a) current RMCP version and BRA; (b) Vera's recon harness outputs (summary); (c) STR / CTR / PAR filing statistics (12-month rolling); (d) training attestation records; (e) sanctions-list currency evidence; (f) CPF control evidence per PA Communication 1/2025.
- **Post-greylisting remediation tracking** — SA's FATF grey-list status per [`ORG-FC-21`](../Regulations/_obligations-register.md) requires ongoing track-and-respond. The Bank maintains a **remediation tracker** updated at each annual RMCP review, recording the FATF SA Mutual Evaluation finding, the Bank's response, the substrate / procedure that addresses it, and the status (open / addressed / addressed-under-watchlist).

---

## 13. Obligations closed

This RMCP closes or substantively advances the following obligations-register rows:

| Row | Statutory anchor | Obligation | Closed by |
|---|---|---|---|
| [`ORG-FC-01`](../Regulations/_obligations-register.md) | FIC Act s.42 | Adopt and maintain an RMCP | This document (§1) |
| [`ORG-FC-02`](../Regulations/_obligations-register.md) | FIC Act ss.21–21H | Standard CDD | §2.2 |
| [`ORG-FC-03`](../Regulations/_obligations-register.md) | FIC Act s.21A | EDD / PEPs | §§2.4–2.5 |
| [`ORG-FC-04`](../Regulations/_obligations-register.md) | FIC Act s.21B | Beneficial ownership | §2.3 |
| [`ORG-FC-05`](../Regulations/_obligations-register.md) | FIC Act s.22 | Record-keeping 5-year floor | §3.2 |
| [`ORG-FC-07`](../Regulations/_obligations-register.md) | FIC Act s.28 | CTR filing | §4.3 |
| [`ORG-FC-08`](../Regulations/_obligations-register.md) | FIC Act s.28A | PAR filing (terrorist financing) | §5 |
| [`ORG-FC-09`](../Regulations/_obligations-register.md) | FIC Act s.29 | STR filing | §4.2 |
| [`ORG-FC-10`](../Regulations/_obligations-register.md) | FIC Act s.29(3) | Tipping-off prohibition | §4.4 |
| [`ORG-FC-12`](../Regulations/_obligations-register.md) | FIC Act s.43 | Training | §6 |
| [`ORG-FC-17`](../Regulations/_obligations-register.md) | FATF Rec. 16 | Wire-transfer travel rule | §10.6 |
| [`ORG-FC-21`](../Regulations/_obligations-register.md) | FATF SA Mutual Evaluation | Post-greylisting remediation | §12.3 (remediation tracker) |
| [`ORG-FC-23`](../Regulations/_obligations-register.md) | PA AML/CFT/CPF Communication 1/2025 | CPF banks-supervisory expectations | §§5.3, 8, 12.3 |

---

## 14. Input-quality flags and open items

Per Principle 2 (single-graph discipline; no invented citations):

- **`[citation: TBC]` — PA AML/CFT/CPF Communication 1/2025 precise § references.** [`ORG-FC-23`](../Regulations/_obligations-register.md) carries `[citation: TBC]` for precise § references inside the PDF. Imani (Legal-as-code engineer, engineering) + external counsel ratify at licence-application gate.
- **`[citation: TBC]` — FIC GN 7 paragraph indices.** Cited by topic rather than paragraph index throughout. Mira (Compliance / RegTech engineer, engineering) resolves precise paragraph indices at licence-application moment.
- **`[citation: TBC]` — JSE Equities Rules sub-rule references.** `RETENTION_JSE_TRADE_7Y` references pending Imani + external counsel ratification.
- **`[citation: TBC]` — MLRO-alternate recommended-practice PCC reference.** [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md) carries a `[citation: TBC]` for the exact FIC PCC reference.
- **Entity-scope `[TBD]`.** Most FC-prefix register rows carry `entity-scope: [TBD]` in v1.14. This RMCP works from the `multi-entity` scope per §1.2. Reconciliation under `WS-ENTITY-SCOPE-CLASSIFICATION` (Mira's curatorship workstream).
- **W1 Slices 2–7 substrate gaps.** The substrate-side engineering described in §§2–12 is largely planned (not yet built) under W1 Slices 2–7. The RMCP is the binding specification; the slices are authorised under `D-REGULATORY-READINESS-GATE-PLAN`. Substrate gaps surface as Vera findings.
- **goAML API integration.** FIC goAML submission pathway (§4.5) is a stub pending W1 Slice 6 engineering. Manual submission fallback documented.
- **Wolfsberg clause-library template `CB-NESTED-PROHIB-01`.** Referenced in §10.4; template authoring is a W1 substrate gap for Imani (Legal-as-code engineer, engineering).

---

## 15. Authority and citations

**Statutory instruments:**

- Financial Intelligence Centre Act 38 of 2001 ss.21, 21A, 21B, 21C, 21G, 21H, 22, 22A, 23, 24, 26B, 28, 28A, 29, 29(3), 42, 42A, 43, 43A, 45C; Schedule 1 item 6.
- FIC General Notice 7 of 2017 — Guidance Note on the implementation of the risk-based approach (FIC GN 7).
- FIC Guidance Note 5 — beneficial ownership.
- FATF Recommendations 1, 7, 10, 11, 12, 13, 16, 18, 21.
- FATF SA Mutual Evaluation Reports (grey-listing remediation).
- SARB Prudential Authority — AML/CFT/CPF Communication 1 of 2025 (Banks). `[citation: TBC — precise § references]`.
- UN Security Council sanctions regime (UNSC Resolutions 1267, 1718, and successor resolutions).
- OFAC SDN consolidated list.
- EU consolidated financial sanctions list.
- UK HMT consolidated list (OFSI); UK Sanctions and Anti-Money Laundering Act 2018.
- Protection of Constitutional Democracy Against Terrorist and Related Activities Act (POCDATARA) 33 of 2004 (DTI list; s.12 asset freeze).
- Prevention of Organised Crime Act (POCA) 121 of 1998.
- Prevention and Combating of Corrupt Activities Act (PRECCA) 12 of 2004.
- UK Bribery Act 2010 (extra-territorial exposure where applicable).
- Trust Property Control Act 57 of 1988 (trust beneficial-ownership resolution).
- FATCA IGA (SA-US) + Tax Administration Act 28 of 2011.
- CRS (OECD Standard for Automatic Exchange of Financial Account Information).
- JSE Equities Rules trade-record retention sub-rules. `[citation: TBC]`.
- Wolfsberg Group — Correspondent Banking Principles (2023).
- Protection of Personal Information Act 4 of 2013 (POPIA) ss.13, 18, 19–22 (CDD personal-information cross-reference).

**Internal canonical sources:**

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — Domain B (FC-prefix) rows cited inline throughout.
- [`Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md`](../Owner%20Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md) — the attestable specification this document implements.
- [`Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](../Owner%20Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md) — the parent gate plan authorising W1.
- [`Owner Inbox/2026-05-11_mira-zara_rmcp-v1.md`](../Owner%20Inbox/2026-05-11_mira-zara_rmcp-v1.md) — the prior Mira + Zara RMCP co-authored 2026-05-11; incorporated by reference.
- [`Policies/risk-management-and-compliance-policy-v1.md`](risk-management-and-compliance-policy-v1.md) — prior policy file (policy-id: risk-management-and-compliance-policy); this RMCP supersedes for RMCP-V1 purposes.
- [`Regulations/FIC/fic-act.md`](../Regulations/FIC/fic-act.md) — bank-side curated reading of FIC Act 38 of 2001.
- **D-RMS-PHASE-1** (CEO-approved 2026-05-09) — event-type registration; document-substrate.
- **D-THIN-HUMAN-LAYER-MINIMUM** (CEO-approved 2026-05-08) — triple-hatted MLRO + FIC CO + IO at licence-day; AC-Chair NED as Deputy MLRO.
- **D-FSP-LICENCE-NECESSITY** (CEO-approved 2026-05-09) — FSP licence necessity for Hoz Securities Limited.
- **D-REGULATORY-READINESS-GATE-PLAN** (CEO-approved 2026-05-10) — W1 workstream authorising this RMCP.
- **CLAUDE.md** — "Operating procedures" (events-first authoring; dispatch discipline; no-pause rule); "Architectural principles" 1, 2, 6.
- `project_strategic_foundation.md` (memory) — institutional global-markets dealer; institutional-only client base.
- `project_indirect_participant_posture.md` (memory) — sponsor-bank FX-channel access; indirect CMI participant posture.
- `project_ai_driven_bank.md` (memory) — build-phase posture; pre-licence go-live readiness gate.
- `feedback_agent_name_with_position.md` (memory) — name + position on first mention.

---

## 16. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-05-14 | Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) | Initial RMCP v1 under policy-id RMCP-V1. Authored as a standalone FIC Act s.42 compliant Risk Management and Compliance Programme covering: (1) Purpose and scope — accountable-institution status; (2) CIV — FIC Act ss.21-22, beneficial ownership, PEP identification, EDD; (3) Record-keeping — FIC Act ss.22A-23, 5-year retention, format requirements; (4) STR/CTR — FIC Act s.29, 15-day window, MLRO sign-off, goAML pathway (stub); (5) TF reporting — FIC Act s.28A, immediate PAR obligation, POCDATARA, CPF; (6) Training — FIC Act s.43, agent attestation, human licence-day training, role-based modules; (7) Governance — MLRO designation, Deputy MLRO, board oversight, FIC CO role, Vera assurance; (8) Risk assessment — FIC Act s.42(2)(a), BRA, customer risk rating, EDD triggers, product/geographic risk; (9) Sanctions screening — UNSC, OFAC, EU, UK HMT, POCDATARA, zero-tolerance posture; (10) Correspondent banking — Wolfsberg Principles, nested correspondent prohibition, SWIFT KYC Registry, travel rule; (11) Non-compliance escalation — internal disciplinary, FIC voluntary disclosure, regulatory breach notification; (12) Programme review — annual RMCP review, Vera recon harnesses, PA submission cadence. Closes obligations ORG-FC-01 through ORG-FC-23. LICENCE-BIND. Incorporates prior work from 2026-05-11_mira-zara_rmcp-v1.md. |

---

*Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim)*
