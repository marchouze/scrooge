---
policy-id: risk-management-and-compliance-policy
title: Risk Management and Compliance Programme (RMCP) v1
version: "1"
status: IN FORCE
owner: Zara (Chief Compliance Officer, governance)
effective-from: "2026-05-11"
citations:
  - FIC Act 38 of 2001 s.42
  - PA AML/CFT/CPF Communication 1/2025
  - D-POLICY-DOCUMENT-HOME
author: Mira (Compliance / RegTech engineer) + Zara (Compliance / legal-as-code engineer)
date: 2026-05-11
summary: Standalone RMCP as mandated by FIC Act 38/2001 s.42, covering risk-based approach, customer due diligence programme, record-keeping, reporting (STR/CTR), employee training, and programme review cadence. Addresses PA AML/CFT/CPF Communication 1/2025. Closes obligations ORG-FC-01, ORG-FC-07 through ORG-FC-10, ORG-FC-12, ORG-FC-17, ORG-FC-21, ORG-FC-23. LICENCE-BIND.
decision-required: false
riskTaxonomy: RT-FC
---

# Risk Management and Compliance Programme (RMCP) v1

> **Standing authority:** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10; W1 Workstream — AML/CFT-RMCP). This document implements the attestable specification at [`Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md`](2026-05-10_zara-mira_rmcp-attestable-spec.md) and constitutes the standalone policy document required by FIC Act 38 of 2001 s.42.
>
> **Authors:** Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer) lead; Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) co-author.
>
> **Obligations closed:** [`ORG-FC-01`](../Regulations/_obligations-register.md) (RMCP mandate); [`ORG-FC-07`](../Regulations/_obligations-register.md) (CTR filing); [`ORG-FC-08`](../Regulations/_obligations-register.md) (PAR filing); [`ORG-FC-09`](../Regulations/_obligations-register.md) (STR filing); [`ORG-FC-10`](../Regulations/_obligations-register.md) (tipping-off prohibition); [`ORG-FC-12`](../Regulations/_obligations-register.md) (training); [`ORG-FC-17`](../Regulations/_obligations-register.md) (FATF Rec. 16 wire transfers); [`ORG-FC-21`](../Regulations/_obligations-register.md) (post-greylisting remediation); [`ORG-FC-23`](../Regulations/_obligations-register.md) (PA AML/CFT/CPF Communication 1/2025).
>
> **Binding status:** LICENCE-BIND. These obligations apply in full from commencement-of-trading. The RMCP is authored and adopted now so that the substrate, procedures, and governance structures are production-grade at licence-day. Per `project_rules_bind_at_commencement.md` (memory): build-phase is preparation for compliance, not compliance. All substrate-side engineering described herein with "planned" designation is live work under W1 Slices 2–7.

---

## 1. Programme overview and authority

### 1.1 Statutory mandate

Hoz Bank Limited (the **Bank**) adopts this Risk Management and Compliance Programme (**RMCP**) in fulfilment of its obligation under **Financial Intelligence Centre Act 38 of 2001 s.42** to adopt and implement a risk management and compliance programme that complies with the requirements and standards of the Financial Intelligence Centre (**FIC** or the **Centre**). Register row [`ORG-FC-01`](../Regulations/_obligations-register.md).

The RMCP also responds to:

- **SARB Prudential Authority — AML/CFT/CPF Communication 1 of 2025 (Banks)** — post-greylisting PA banks-supervisory expectations on proliferation-financing controls and risk-based-approach calibration evidence. Register row [`ORG-FC-23`](../Regulations/_obligations-register.md). `urn:obligation:bank:fc:pa-amlcftcpf-comm-1-2025:v1`. `[citation: TBC — precise § references inside the AML/CFT/CPF Communication 1/2025 PDF; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate per the gate plan]`.
- **FATF Recommendations 1, 7, 10, 11, 12, 16, 18, 21** — the international risk-based approach standards against which SA's mutual-evaluation posture is assessed.
- **FIC General Notice 7 of 2017 — Guidance Note on the implementation of the risk-based approach** (**FIC GN 7**) — interpretive guidance on RBA periodicity and customer-typology dispatch.
- **FIC Act 38/2001 s.42A** — designation of the senior person responsible for compliance.
- **FIC Act 38/2001 s.43A** — accountable-institution registration; registration of the Bank and of Hoz Securities Limited upon FAIS-FSP authorisation (per CEO decision `D-FSP-LICENCE-NECESSITY`).

### 1.2 Entity scope

The RMCP applies on a **multi-entity basis** to:

- **Hoz Bank Limited** — accountable institution under FIC Schedule 1 item 6 (banks). Primary RMCP scope from commencement-of-trading.
- **Hoz Securities Limited** — accountable institution upon FAIS-FSP authorisation per `D-FSP-LICENCE-NECESSITY` (CEO-approved 2026-05-09); RMCP applies on the same multi-entity basis from FSP-authorisation date.

Group-level governance is provided by Hoz Group Limited per the legal-entity tree at [`Regulations/_legal-entity-tree.md`](../Regulations/_legal-entity-tree.md). The MLRO designation per [`ORG-FC-11`](../Regulations/_obligations-register.md) is multi-entity: one named MLRO across both accountable institutions, with the alternate-MLRO arrangement per [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md).

> **Entity-scope note.** Most Domain B (FC-prefix) register rows carry `entity-scope: [TBD]` in v1.14. This RMCP claims `multi-entity` as the working scope per §1.2. The per-row reconciliation runs under `WS-ENTITY-SCOPE-CLASSIFICATION` (Mira's curatorship workstream).

### 1.3 Accountable-institution classification

The Bank is an accountable institution under **FIC Act Schedule 1, item 6** — a bank as defined in the Banks Act 94 of 1990. This classification is not in dispute; it follows automatically from the SARB licence-application pathway and the grant of a banking licence. The MLRO registration and RMCP lodgment with the FIC take effect from the date the banking licence is granted.

### 1.4 Programme governance

| Role | Holder | Authority |
|---|---|---|
| Accountable executive (s.42A senior person) | Triple-hatted human at licence-day (MLRO + FIC Compliance Officer + Information Officer) per `D-THIN-HUMAN-LAYER-MINIMUM`. Interim build-phase: Marc (CEO) holds formal designation; Zara (Chief Compliance Officer, governance) holds operational role. | FIC s.42A; [`ORG-FC-11`](../Regulations/_obligations-register.md); [`ORG-FC-11-GLOSS-CEO-MLRO-BAR`](../Regulations/_obligations-register.md). |
| MLRO | Triple-hatted licence-day human; Zara (Chief Compliance Officer) interim. | FIC s.43A; [`ORG-FC-11`](../Regulations/_obligations-register.md). |
| MLRO-alternate | AC-Chair NED (per `D-THIN-HUMAN-LAYER-MINIMUM` §4.2). | [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md). |
| FIC Compliance Officer | Same triple-hatted human as MLRO at licence-day; Zara (Chief Compliance Officer) interim. | FIC s.43A; [`ORG-FC-SANCTIONS-SCREENING`](../Regulations/_obligations-register.md). |
| Compliance / RegTech engineer | Mira (Compliance / RegTech engineer, engineering — reports to Zara). | Engineering-substrate ownership of W1 Slices 2–7. |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance). | Recon coverage of every FIC s.42(2) sub-clause per §8.3. |
| POPIA cross-reference | Iris (Information Officer, governance). | POPIA ss.13, 18, 19–22 cross-reference where CDD handling intersects with personal-information processing. |

### 1.5 Board and CEO approval

This RMCP is approved at the CEO level in the build phase. At licence-day, Board Risk Committee (**BRC**) and Board approval is required per the policy register at [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md). Annual renewal is approved by the BRC, signed by Zara (Chief Compliance Officer) as the FIC-named accountable person.

---

## 2. Risk-based approach

### 2.1 Regulatory anchors

The Bank adopts a **risk-based approach** (RBA) to AML/CFT and counter-proliferation-financing (CPF) in fulfilment of:

- **FIC Act s.42(2)(a)** — identifying, assessing, and understanding the ML/TF/PF risks to which the Bank is exposed.
- **FATF Recommendation 1** — assessing risks and applying a risk-based approach.
- **FIC GN 7** — guidance on RBA implementation including typology categorisation and review periodicity.
- **PA AML/CFT/CPF Communication 1/2025** — explicit PA expectation of calibrated RBA evidence at supervisory engagement. Register row [`ORG-FC-23`](../Regulations/_obligations-register.md).

### 2.2 Business risk assessment

The Bank conducts a **Business Risk Assessment** (**BRA**) at the following cadence:

- **Initial BRA** — completed before commencement-of-trading. Documents the Bank's inherent ML/TF/PF risk profile given its business model, client typology, product families, delivery channels, and geographic footprint.
- **Annual refresh** — the BRA is reviewed and updated on an annual cycle (or earlier if a material change to the business model occurs) per the high-risk-institution default. South Africa's grey-list status under the FATF Mutual Evaluation (register row [`ORG-FC-21`](../Regulations/_obligations-register.md)) means the Bank applies the conservative RBA dispatch: where two risk tiers are plausible, the higher tier applies.

**BRA scope factors:**

| Risk dimension | Bank-specific read |
|---|---|
| Client typology | Institutional-only counterparties (per `project_strategic_foundation.md`): JSE members, licensed banks, asset managers, pension funds. No retail clients. |
| Product families | JSE bonds / equities spot; OTC interest-rate derivatives (IRD); FX (via sponsor / correspondent bank per `project_indirect_participant_posture.md`). No cash transactions above the CTR threshold are anticipated (institutional-only; no branch cash); the CTR obligation is retained as a control regardless. |
| Delivery channels | Electronic / algorithmic; no physical branch cash handling. |
| Geographic footprint | SA single-branch; cross-border flows via CMI-access sponsor banks (SAMOS, CLS indirect access); potential UK Bribery Act extra-territorial exposure for UK-connected counterparties. |
| Correspondent / sponsor-bank channel | Sponsor-bank FX channel carries concentration and settlement risk; AML screen runs on the pre-trade counterparty master, not only at onboarding. |
| Proliferation-financing (CPF) | FATF Rec. 7 explicit expectation (PA Communication 1/2025): the Bank screens against UN Security Council targeted-financial-sanctions lists and maintains CPF risk indicators in the transaction-monitoring rule set alongside ML/TF typologies. |

### 2.3 Client risk-rating methodology

Every client in the client master carries a risk rating of **high**, **medium**, or **low** computed from a defined typology framework. The rating is emitted as part of the `ClientCddCompleted` event (W1 Slice 3 substrate) and drives:

- The CDD tier dispatched at onboarding (§3).
- The ongoing-monitoring frequency and transaction-monitoring sensitivity (§4).
- The periodic CDD-refresh cadence per FIC GN 7 (§2.4).

**Risk-rating factors:**

| Factor | High-risk indicators | Low-risk indicators |
|---|---|---|
| Client type | PEPs and their associates; foreign correspondent banks; complex multi-layered structures with opaque beneficial ownership; clients from high-risk jurisdictions (FATF black/grey list) | Regulated domestic financial institutions; listed corporates; SA government entities |
| Product / transaction profile | High-value OTC derivative structures; cross-border wire transfers to high-risk jurisdictions; atypical-for-profile transaction patterns | Vanilla JSE equities / bonds; domestic ZAR-denominated flows |
| Geography | Jurisdictions on FATF/EU/UK/OFAC lists; sanctioned-country touch-points | SA-domiciled entities with no high-risk-jurisdiction exposure |
| Beneficial ownership | Unresolved or complex beneficial ownership; nominee directors / shareholders; trust structures without identified beneficiaries | Directly identified natural-person UBO on first-level resolution |
| Source of funds / wealth | Complex or unverifiable source-of-wealth narratives | Regulated institutional capital with audited financials |

**Override authority.** The MLRO (Zara, Chief Compliance Officer, interim) may override an automated risk rating upward or downward by signing a `ClientRiskRatingOverrideApproved` event with documented rationale. Downward overrides require a second sign-off from the AC-Chair NED (MLRO-alternate) at licence-day.

### 2.4 RBA periodicity — FIC GN 7

| Risk rating | Periodic CDD-refresh cadence | Transaction-monitoring sensitivity |
|---|---|---|
| High | Annual (12 months from last `ClientCddCompleted` event) | Maximum — all typologies active; alerts reviewed by MLRO within 5 business days |
| Medium | 24 months from last `ClientCddCompleted` event | Standard |
| Low | 36 months from last `ClientCddCompleted` event | Minimum — structural typologies only |

The `recon:kyc-periodicity-coverage` recon (planned, W1 Slice 3) asserts every active client has a current-cycle `ClientCddCompleted` event within the per-rating window.

### 2.5 Product and geographic risk factors

**Product risk.** OTC IRD products carry elevated ML/TF risk (complex structures; large notional values; potential for misuse of collateral flows). The pre-trade gateway (W1 Slice 4) screens every OTC IRD transaction against the client risk rating and the current sanctions lists before order approval.

**Geographic risk.** The Bank maintains a **jurisdiction risk list** — a standing register of high-risk jurisdictions based on FATF / FSRB / EU / UK HMT classifications. The list is reviewed on every published update; the review event is `JurisdictionRiskListUpdated`. Orders involving counterparties or payment flows touching high-risk jurisdictions are routed for enhanced scrutiny per the EDD pathway (§3.3).

**Proliferation-financing (CPF) risk factors.** Per PA AML/CFT/CPF Communication 1/2025 ([`ORG-FC-23`](../Regulations/_obligations-register.md)) and FATF Recommendation 7, the BRA explicitly addresses CPF. CPF risk indicators include: dual-use goods / technology sector counterparties; counterparties with UN Security Council sanctions nexus; OTC derivative structures with potential for circumventing targeted financial sanctions. CPF indicators are embedded in the transaction-monitoring rule set (W1 Slice 4) and reviewed annually alongside the BRA.

---

## 3. Customer due diligence programme

### 3.1 Regulatory anchors

The CDD programme implements:

- **FIC Act ss.21–21H** — customer identification, verification, beneficial-ownership resolution, ongoing CDD, EDD for high-risk clients, PEP screening, foreign correspondent due diligence.
- **FIC Act s.42(2)(b)** — the RMCP must address how CDD is conducted.
- **FATF Recommendation 10** — customer due diligence.
- **FATF Recommendation 12** — politically exposed persons.
- **FIC Guidance Note 5** — beneficial ownership.
- **FIC GN 7** — RBA periodicity cross-reference.
- Register rows: [`ORG-FC-02`](../Regulations/_obligations-register.md) (CDD), [`ORG-FC-03`](../Regulations/_obligations-register.md) (EDD / PEPs), [`ORG-FC-04`](../Regulations/_obligations-register.md) (beneficial ownership), [`ORG-FC-18`](../Regulations/_obligations-register.md) (continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md) (RBA periodicity).

### 3.2 Standard CDD — all clients

No client enters the client master without satisfying upfront standard CDD. Activation of a client without satisfied CDD is a Critical event under the AML/CFT Policy.

**Standard CDD steps:**

1. **Client identification.** Collect full legal name, registration number, jurisdiction of incorporation, registered address, and authorised signatories for legal-entity clients. For natural-person clients (none anticipated in the institutional-only model; procedure maintained for completeness), collect full name, date of birth, identity number, residential address.

2. **Client verification.** Verify client identity against reliable, independent documentary sources. For regulated domestic financial institutions: FSCA / SARB register extract + CIPC registration certificate. For foreign entities: equivalent home-jurisdiction regulatory register + certificate of incorporation. Verification evidence is stored in the document-substrate (D-RMS-PHASE-1 Slice 1) and referenced by BLAKE3 hash from the `ClientCddCompleted` event.

3. **Beneficial ownership resolution.** Recursive resolution to natural persons who ultimately own or control ≥ 25% of the legal entity, or who exercise effective control, per FIC Act s.21B and FIC Guidance Note 5. Resolution terminates at: (a) a natural person; (b) a listed company subject to disclosure requirements equivalent to SA law; (c) a state entity. Complex trust structures are resolved under the Trust Property Control Act 57 of 1988 read with FIC Act requirements; Imani (Legal-as-code engineer, engineering — reports to Devon, COO interim) owns the clause-library templates for trust-resolution documentation. Beneficial ownership resolution records a `ClientBeneficialOwnerResolved` event.

4. **Purpose and nature of business relationship.** Document the intended purpose of the relationship, anticipated transaction volumes, and source of funds / wealth for the entity. For institutional counterparties: audited financial statements + regulatory filings are sufficient source-of-wealth evidence at standard tier.

5. **Sanctions screening at onboarding.** All onboarding clients (including UBOs and controlling parties) are screened against the full sanctions list set (UN SC, OFAC SDN, EU consolidated, UK HMT, POCDATARA / DTI) before a `ClientCddCompleted` event is emitted. A `SanctionsScreeningCompleted` event with `outcome: clear` is a prerequisite. True-positive matches block onboarding entirely (`SanctionsTruePositiveBlocked`); no client is admitted with an unresolved sanctions match.

6. **Risk rating assignment.** The client risk rating (high / medium / low) is computed per §2.3 methodology and embedded in the `ClientCddCompleted` event payload.

**Implementing policy:** KYC / CDD / EDD Policy — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md). Client-master design at [`Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md`](2026-05-06_client-master-and-continuous-kyc.md).

### 3.3 Enhanced CDD — high-risk clients

Enhanced CDD (**EDD**) is applied to all clients rated **high-risk** and to all clients falling into the EDD-mandatory categories below, regardless of the automated risk rating. EDD triggers a `ClientEddTriggered` event and requires completion of a `ClientEddCompleted` event before the relationship is activated or continued.

**EDD-mandatory categories (FIC Act s.21A; FATF Rec. 12):**

| Category | Additional EDD steps |
|---|---|
| Politically Exposed Persons (PEPs) — domestic and foreign | Identify PEP status (including family members and close associates); obtain senior management approval (MLRO sign-off at minimum) before establishing / continuing relationship; apply enhanced ongoing monitoring; re-verify source of wealth |
| Foreign correspondent banks | Assess AML/CFT controls of the correspondent institution; determine that no FATF-listed entity is involved; obtain senior management approval; monitor on an ongoing basis |
| Complex or high-risk structures (trusts, multi-layer holding structures, private wealth vehicles) | Full resolution of ownership chain; obtain evidence of trust deed / constitutional documents; identify all beneficiaries |
| Clients from high-risk jurisdictions (FATF black/grey list; EU high-risk list) | Enhanced source-of-wealth documentation; transaction-monitoring at maximum sensitivity; senior management approval |
| Clients with unresolved beneficial ownership | Escalate to MLRO; relationship suspended until BO resolved |
| Any client where transaction patterns suggest elevated ML/TF/CPF risk | Triggered by `TransactionMonitoringHit` or MLRO investigation outcome |

**EDD sign-off authority.** All EDD relationships require MLRO sign-off (`MlroEddApproved` event) before activation or continuation.

**Implementing policy:** KYC / CDD / EDD Policy — IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md); PEP Policy — IN FORCE per [`ORG-FC-03`](../Regulations/_obligations-register.md).

### 3.4 Simplified CDD — low-risk clients

Simplified CDD may be applied to clients meeting **all** of the following criteria:

- Risk rating: **low** per the §2.3 methodology;
- Client type: regulated domestic financial institution (SARB / FSCA registered) or SA government entity;
- No PEP, sanctions, or geographic risk flags present;
- Product: vanilla JSE equities / bonds only (no OTC derivatives, no cross-border FX).

**Simplified CDD reduces — it does not eliminate — CDD obligations.** The minimum simplified CDD scope is: client identification and verification (steps 1–2 of §3.2); sanctions screening at onboarding; initial risk rating assignment. Beneficial ownership resolution may rely on the FSCA / SARB regulatory register as the equivalent disclosure mechanism rather than requiring full recursive resolution, subject to MLRO approval.

Simplified CDD is reviewed annually. Any change to the client's product access, risk profile, or geographic exposure triggers upgrade to standard or enhanced CDD.

### 3.5 PEP identification — FIC Act s.21A

The Bank maintains a **PEP identification process** integrated into the onboarding and continuous-KYC workflows:

1. **PEP screening at onboarding.** All clients and their UBOs / controlling parties are screened against PEP databases (commercial data feed — W1 Slice 3 substrate) as part of standard CDD.
2. **PEP identification post-onboarding.** Continuous-KYC signal sources (media monitoring, regulatory announcements, commercial PEP feeds) are processed by the continuous-KYC projection (W1 Slice 3). A PEP identification on an existing client triggers a `ClientEddTriggered` event with `trigger: pep-identified` and routes to the EDD pathway (§3.3).
3. **MLRO sign-off.** All PEP relationships (domestic and foreign) require MLRO sign-off before establishment or continuation per the EDD-mandatory category table.
4. **Enhanced ongoing monitoring.** PEP-rated clients are subject to annual CDD refresh (highest periodicity tier) and maximum-sensitivity transaction monitoring regardless of the automated risk rating.

**Implementing policy:** PEP Policy — IN FORCE per [`ORG-FC-03`](../Regulations/_obligations-register.md).

### 3.6 POPIA cross-reference

All CDD personal-information handling is routed through the POPIA substrate managed by Iris (Information Officer, governance). Collection of personal information at CDD is notified per POPIA s.18; the purpose specification (POPIA s.13) is "CDD under FIC Act 38/2001 ss.21–21H". Register cross-reference [`ORG-PR(IV)-06`](../Regulations/_obligations-register.md) (POPIA security safeguards).

---

## 4. Record-keeping programme

### 4.1 Regulatory anchors

The record-keeping programme implements:

- **FIC Act s.22** — retain CDD records and transaction records for at least **five years** after the end of the business relationship or the date of the transaction. Register row [`ORG-FC-05`](../Regulations/_obligations-register.md).
- **FIC Act ss.23–24** — records must be kept in a form usable for supervisory purposes; records of transactions that have been monitored must be retained.
- **FIC Act s.42(2)(f)** — the RMCP must address record-keeping.
- **FATF Recommendation 11** — record-keeping.

**Conservative retention default.** Where the FIC Act s.22 5-year floor intersects with a longer applicable retention floor (e.g. JSE Equities Rules 7-year trade-record retention per [`ORG-MK-15`](../Regulations/_obligations-register.md); Conduct Standard 3/2018 §12 ≥5-year OTC derivatives record-keeping), the longer floor governs. The `RETENTION_CONSERVATIVE_DEFAULT` principle is implemented in the event-store retention registry at `prototype/platform/event-store/registry.ts`.

### 4.2 Transaction records

**Scope.** Every transaction executed by or on behalf of a client is retained as a typed event in the append-only event store (Principle 1). The event payload constitutes the transaction record. CDD-derived events that interact with JSE trade records register against `RETENTION_JSE_TRADE_7Y`; pure CDD / AML events register against `RETENTION_FIC_S22_5Y`.

**Record content (FIC Act s.22).** For each transaction, records include:
- The identity of the persons or account holders involved in the transaction;
- The identity of any person acting on behalf of a client in the transaction;
- The amount, currency, and nature of the transaction;
- The date of the transaction;
- The business correspondence concerning the transaction.

All transaction records are stored in the append-only event store (Principle 1 — events are the only source of truth). Document artefacts (PDFs, confirmations, settlement instructions) are stored in the BLAKE3 content-addressed document store (D-RMS-PHASE-1 Slice 1) with hash references embedded in the relevant event payload.

### 4.3 CDD records

**Scope.** All CDD evidence collected under §3 (identification documents, verification sources, beneficial-ownership resolution documents, EDD packs, PEP-screening outputs, MLRO approval records) is retained for:

- Five years after the end of the business relationship (FIC Act s.22); or
- Seven years for trade-records intersecting with JSE Equities Rules requirements (the conservative default per `RETENTION_CONSERVATIVE_DEFAULT`).

**Retention enforcement.** The `RETENTION_FIC_S22_5Y` retention class in `prototype/platform/event-store/registry.ts` sets the no-compaction-below-this-period floor for all FC-domain CDD event types (`ClientCddCompleted`, `ClientEddCompleted`, `ClientBeneficialOwnerResolved`, `ClientKycRestricted`, `ClientRiskRatingOverrideApproved`). The append-only event-store architecture over-delivers on the 5-year floor; the retention class is the no-compaction floor for hot-storage.

**Document-substrate retention.** CDD-evidence packs in the document substrate are retained by reference from the event payload (BLAKE3 hash). The document substrate enforces the same retention floors as the event store.

### 4.4 STR / CTR / PAR records — FIC Act ss.22–24

All reports filed with the FIC (STRs under s.29, CTRs under s.28, PARs under s.28A) are retained in the document substrate and in the event store:

- The STR / CTR / PAR submission packet (document substrate) — referenced by hash from the `StrFiled` / `CtrFiled` / `ParFiled` event.
- The MLRO investigation record (event: `MlroInvestigationOpened`, `MlroInvestigationDecided`) — held within the MLRO-investigation-set encryption boundary (§5.4).
- The goAML / RegOnline submission receipt (event: `GoAmlReportSubmitted`, `RegOnlineReportSubmitted`).

All STR-stream records are encrypted under the MLRO-held key envelope per the tipping-off prohibition (§5.4). Non-MLRO agents and personnel receive a typed `EncryptedEventRedacted` placeholder.

### 4.5 Supervisory access

Records must be made available to the FIC and the PA on request and in a form that is usable for supervisory purposes (FIC Act ss.23–24). The document-substrate and event-store APIs support supervisory read access via a dedicated read-path. The FIC registration number and contact details for the MLRO are maintained current per the FIC portal procedures (§5.5).

---

## 5. Reporting obligations

### 5.1 Regulatory anchors

The reporting programme implements:

- **FIC Act s.28** — Cash Threshold Reports (CTRs) for cash transactions ≥ R 24,999.99. Register row [`ORG-FC-07`](../Regulations/_obligations-register.md).
- **FIC Act s.28A** — Property Association Reports (PARs) where property is associated with a terrorist or related activities. Register row [`ORG-FC-08`](../Regulations/_obligations-register.md).
- **FIC Act s.29** — Suspicious Transaction Reports (STRs) filed as soon as possible, and in any event within 15 calendar days after the institution knows or suspects a transaction relates to ML/TF. Register row [`ORG-FC-09`](../Regulations/_obligations-register.md).
- **FIC Act s.29(3)** — Tipping-off prohibition: disclosing the existence or contemplated filing of an STR is a criminal offence. Register row [`ORG-FC-10`](../Regulations/_obligations-register.md).
- **FIC Act s.42(2)(d)** — the RMCP must address reporting obligations.

### 5.2 Suspicious Transaction Reports — FIC Act s.29

**Trigger.** An STR is filed when the Bank or any of its agents (including Mira's automated transaction-monitoring engine) **knows or suspects** that a transaction is connected to money laundering, terrorist financing, proliferation financing, or any other financial crime. Suspicion is a subjective test; the obligation arises as soon as suspicion is formed, not when certainty is achieved.

**Filing timeline.** The STR must be filed **as soon as possible and in any event within 15 calendar days** after the date on which the institution first knows or suspects the transaction relates to ML/TF/PF. The `recon:str-15-day-window` recon (planned, W1 Slice 4) asserts the wall-clock delta between `MlroInvestigationDecided` (where action = file) and `StrFiled` is ≤ 15 calendar days.

**MLRO investigation pathway:**

1. **Transaction monitoring hit.** `TransactionMonitoringHit` event emitted by the monitoring engine (W1 Slice 4) with typology code and alert detail.
2. **Alert triage.** Mira (Compliance / RegTech engineer) triages automated alerts. False positives are documented in a `MonitoringAlertClosed` event with rationale. True positives or ambiguous cases escalate to the MLRO.
3. **MLRO investigation.** MLRO opens a formal investigation (`MlroInvestigationOpened` event). All investigation records are held within the MLRO-investigation-set encryption boundary (§5.4).
4. **MLRO decision.** MLRO decides to file or not file (`MlroInvestigationDecided` event with `action: file` or `action: no-file` and documented rationale).
5. **STR filing.** STR submitted via the FIC goAML portal (`StrFiled` event; `GoAmlReportSubmitted` event with submission reference number and timestamp).

**No internal override of MLRO.** The MLRO's decision to file an STR is not subject to internal override. The Bank may not impose any sanction or adverse consequence on the MLRO for filing or for a decision not to file.

### 5.3 Cash Threshold Reports — FIC Act s.28

**Trigger.** A CTR must be filed for every **cash transaction** (or combination of related cash transactions on a single day) of an amount **equal to or exceeding R 24,999.99**, or such other amount as the Minister may prescribe. The Bank's institutional-only model and electronic-only delivery channels mean cash CTR triggers are not anticipated in the ordinary course. The CTR pathway is maintained as a control:

- Cash-class transaction events are detected by the monitoring engine (W1 Slice 4).
- Any `Transaction*` event with `transactionClass: cash` and `amount >= 24999.99` ZAR triggers an automatic `CtrFiled` event via the CTR pipeline.
- CTR is submitted via the FIC goAML portal (`CtrFiled` event; `GoAmlReportSubmitted` event with submission reference).

### 5.4 Property Association Reports — FIC Act s.28A

**Trigger.** A PAR must be filed when the Bank knows or suspects that property in its possession or under its control is connected to terrorist activities or with the financing of terrorist activities, including proliferation-financing. The primary PAR trigger in the Bank's model is a `SanctionsTruePositiveBlocked` event where the matched property is identifiable under FIC Act s.28A.

**Filing pathway.** `SanctionsTruePositiveBlocked` → MLRO reviews → `ParFiled` event → `RegOnlineReportSubmitted` event with submission reference. All PAR records are retained in the document-substrate and the event-store under the same 5-year retention floor.

### 5.4 Tipping-off prohibition and MLRO confidentiality

**Statutory prohibition.** It is a criminal offence under **FIC Act s.29(3)** to disclose to any person — including the client concerned — that an STR has been filed, is being filed, or is contemplated. Register row [`ORG-FC-10`](../Regulations/_obligations-register.md).

**Cryptographic enforcement.** All STR-stream events (`MlroInvestigationOpened`, `MlroInvestigationDecided`, `StrFiled`) are encrypted under an MLRO-held key envelope. Only the MLRO and MLRO-alternate identities can decrypt these events. All other agents and personnel receive a typed `EncryptedEventRedacted` placeholder. The `recon:tipping-off-isolation` recon (planned, W1 Slice 4) asserts no non-MLRO agent reads MLRO-investigation-set events.

**Inferential tipping-off guard.** No projection, dashboard, or report exposes a per-client field whose presence / absence would imply STR existence. The "client under investigation" status is held only within MLRO-key-encrypted projections. The `recon:tipping-off-inference` recon (planned) asserts this invariant.

**Staff conduct.** All staff (including AI agents with access to client-master data) are briefed on the tipping-off prohibition as part of the training programme (§6). Any inadvertent disclosure is treated as a Critical compliance event; MLRO notification and FIC engagement are triggered immediately.

### 5.5 FIC portal procedures

**goAML portal.** STRs, CTRs, and PARs are submitted via the FIC goAML portal. The submission harness (W1 Slice 6) generates the required goAML XML, submits via the API, and records the submission reference number in the `GoAmlReportSubmitted` event payload. The harness is idempotent: repeated submission of the same report-id is a no-op at the harness layer.

**RegOnline portal.** PAR submissions and MLRO designation lodgment (§1.4) are maintained via the FIC RegOnline portal. Registration details (MLRO name, contact details, designation date) are current at all times; updates within 15 business days of any change.

**Submission record.** All FIC submissions (reference numbers, timestamps, submission packets) are held in the document-substrate and referenced from the filing event. The MLRO reviews FIC portal status monthly to confirm no outstanding queries.

---

## 6. Employee training and awareness

### 6.1 Regulatory anchors

The training programme implements:

- **FIC Act s.43** — the accountable institution must take steps to train its employees in the recognition and handling of transactions relating to ML/TF and in their obligations under the FIC Act. Register row [`ORG-FC-12`](../Regulations/_obligations-register.md).
- **FIC Act s.42(2)(h)** — the RMCP must address training.
- **FATF Recommendation 18** — internal controls, including training.

### 6.2 Training scope — AI-agent-first labour force

The Bank's labour force is **autonomous AI agents** (Principle 6 — autonomous by default). The training obligation maps to **agent-substrate-attestation**: every AML-touching agent carries a current-version attestation that its operating spec includes the relevant AML/CFT/CPF obligations and that the agent's reasoning substrate is current. This is a novel regulatory-mapping; external-counsel ratification at licence-application per the gate plan §7.

**AML-touching agents (current scope):**

| Agent | Position | AML obligation |
|---|---|---|
| Mira | Compliance / RegTech engineer, engineering | CDD substrate, transaction monitoring, reporting pipeline |
| Zara | Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim | MLRO decisions, EDD sign-off, programme governance |
| Iris | Information Officer, governance | POPIA / CDD personal-information handling |

**Agent attestation event.** `AgentTrainingAttested` — emitted by Sade (AgentOps / HR engineer, engineering) on each agent's standing cadence (at minimum annually; re-triggered on any material operating-spec update). Attestation payload: agent ID, operating-spec version hash, obligations covered, attestation date. Retained per `RETENTION_FIC_S22_5Y` floor.

The `recon:aml-training-currency` recon (planned, W1 Slice 7) asserts every AML-touching agent has a current-cycle `AgentTrainingAttested` event within 13 months (allowing one month of tolerance on the annual cycle).

### 6.3 Human training — licence-day

At licence-day, the human personnel roster includes the triple-hatted licence-day human (MLRO + FIC Compliance Officer + Information Officer) and the AC-Chair NED (MLRO-alternate). Both carry:

- A **FIC-recognised AML/CFT training certificate** from an accredited provider, completed within 12 months prior to licence-day.
- Annual renewal thereof on each anniversary of the designation.

Training records are held in the document-substrate; events `HumanTrainingCompleted`. Training completion is a **precondition** for the MLRO and MLRO-alternate designations taking effect; no designation lodgment is submitted without a current training certificate.

### 6.4 Role-based training modules

Training content is modular and role-specific:

| Module | Target | Content |
|---|---|---|
| RMCP overview | All agents and licence-day humans | FIC Act s.42 framework; accountable-institution status; reporting obligations; tipping-off prohibition |
| CDD / EDD procedures | Client-master agents (Mira); licence-day MLRO | Identification, verification, BO resolution; PEP procedures; EDD sign-off process |
| Transaction monitoring | Monitoring-engine agents (Mira); MLRO | Typology recognition; alert-triage procedure; STR decision pathway |
| Sanctions screening | Sanctions-engine agents (Mira); MLRO | List categories; true-positive identification; PAR filing |
| Tipping-off and confidentiality | All agents and licence-day humans | Criminal offence status; cryptographic enforcement; conduct obligations |
| CPF / FATF Rec. 7 | MLRO and senior governance agents | Proliferation-financing typologies; PA Communication 1/2025 expectations |

### 6.5 Attestation records

Training attestation records are maintained for all agents and human personnel for a minimum of five years from the date of attestation (FIC Act s.22 floor). For agents: `AgentTrainingAttested` events in the event-store under `RETENTION_FIC_S22_5Y`. For humans: `HumanTrainingCompleted` events with the training-certificate document referenced by BLAKE3 hash from the document-substrate.

---

## 7. Programme review and compliance assessment

### 7.1 Regulatory anchor

The annual review and compliance-assessment programme implements:

- **FIC Act s.42** — the RMCP must be maintained and kept current. The FIC expects annual review at minimum.
- **FIC Act s.42(2)** — the RMCP must address all the sub-clause requirements; annual review confirms continuing adequacy.
- **PA AML/CFT/CPF Communication 1/2025** ([`ORG-FC-23`](../Regulations/_obligations-register.md)) — PA expectation of demonstrable RBA calibration review evidence at supervisory engagement.
- **FATF SA Mutual Evaluation** — grey-list remediation track-and-respond obligation under [`ORG-FC-21`](../Regulations/_obligations-register.md); annual RMCP review is part of the remediation evidence file.

### 7.2 Annual RMCP review

The RMCP is reviewed **annually** (in any event within 12 months of the previous review or within 90 days of any material regulatory change). The review addresses:

1. **BRA refresh** (§2.2) — updated for any material change to the business model, client base, product family, or geographic footprint; updated for the latest FATF SA Mutual Evaluation and NRA findings; updated for any PA / FIC Public Compliance Communications issued since the last review.
2. **Client risk-rating methodology review** (§2.3) — typologies reviewed against current FATF / FIC guidance; any rating-model changes documented in the `RmcpTypologyReviewed` event.
3. **CDD programme adequacy** (§3) — verify that the CDD / EDD / simplified CDD thresholds remain appropriate for the current client profile; confirm PEP-screening database currency.
4. **Record-keeping review** (§4) — confirm retention classes and document-substrate integrity; run `recon:retention-citation-coverage`.
5. **Reporting statistics review** (§5) — MLRO reports to the BRC on STR / CTR / PAR filing statistics (without revealing tipping-off-protected details); review alert-disposition statistics; confirm goAML / RegOnline portal registrations are current.
6. **Training adequacy review** (§6) — confirm all agents and licence-day humans have current-cycle attestations; review training content for currency against FATF / FIC guidance updates.
7. **Sanctions list currency** (§10 of the attestable spec) — confirm all sanctions lists have been refreshed within their per-list frequency (UN SC ≤24h; OFAC SDN ≤24h; EU consolidated ≤24h; UK HMT ≤24h; POCDATARA ≤weekly).
8. **PA Communication 1/2025 compliance evidence** — document calibrated RBA evidence as required by [`ORG-FC-23`](../Regulations/_obligations-register.md); update `Procedures/by-policy/aml-cft-cpf-banks-supervisory-engagement.md` (planned per [`Owner Inbox/2026-05-10_mira-imani_pa-communications-research.md`](2026-05-10_mira-imani_pa-communications-research.md) §7).

**Review output.** The annual review is recorded as an `RmcpAnnualReviewCompleted` event (W1 Slice 2 — event-type registration). The event payload references: the updated RMCP version (BLAKE3 hash from document-substrate), the updated BRA document (BLAKE3 hash), and the MLRO sign-off. The updated RMCP is submitted to the FIC if material changes have been made.

**Review sign-off.** The annual RMCP review is signed by Zara (Chief Compliance Officer / MLRO) and reviewed by Thandiwe (Chief Audit Executive, governance) for internal-audit adequacy before submission to the BRC.

### 7.3 Independent assurance — Vera

Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance; administratively through the CEO) provides independent assurance over the RMCP via the following planned recon harnesses:

| Recon name | What it asserts | When run |
|---|---|---|
| `recon:rmcp-section-coverage` | Every FIC s.42(2)(a)-(j) sub-clause has a corresponding section in the RMCP | Continuous; on every RMCP version update |
| `recon:kyc-periodicity-coverage` | Every active client has a `ClientCddCompleted` within the per-rating RBA window | Daily |
| `recon:cdd-completion-coverage` | Every active client has a `ClientCddCompleted` before any `Order*` event is approved | Pre-trade gate; also daily retrospective |
| `recon:transaction-monitoring-coverage` | Every settled `Transaction*` event has at least one `TransactionMonitored` event paired by `transactionId` | Daily |
| `recon:str-15-day-window` | No `StrFiled` event is more than 15 calendar days after the corresponding `MlroInvestigationDecided` (file) event | Daily |
| `recon:tipping-off-isolation` | No non-MLRO agent reads MLRO-investigation-set events | Continuous; on every agent-event-access log batch |
| `recon:tipping-off-inference` | No dashboard / projection exposes a per-client field whose presence implies STR existence | Continuous; on every projection schema update |
| `recon:aml-training-currency` | Every AML-touching agent + licence-day human has a current-cycle attestation within 13 months | Monthly |
| `recon:sanctions-list-currency` | Every active sanctions list has a `SanctionsListIngested` event within its per-list refresh window | Daily |
| `recon:sanctions-zero-appetite` | Zero `OrderApproved`-after-`SanctionsTruePositiveBlocked` without paired `MlroSanctionsOverrideApproved` | Real-time; also daily retrospective |
| `recon:retention-citation-coverage` | Every FC-domain event-type's retention class has a citation pointing at the binding obligation | Continuous; on every event-type registration |
| `recon:rmcp-risk-identification-currency` | Typology register has a current-year `RmcpTypologyReviewed` event | Annual; alert if missing within 13 months |

Vera reports recon findings to Thandiwe (Chief Audit Executive) and to the BRC (at licence-day) via the Decisions / Feedback register (RMS Phase 1, D-RMS-PHASE-1).

### 7.4 PA submission cadence

The Bank engages with the PA on AML/CFT/CPF programme adequacy at the following touchpoints:

- **Annual RMCP review** — summary findings submitted to the PA on request or as part of the licence-day application pack.
- **PA supervisory engagement** — when the PA requests an AML/CFT/CPF programme walkthrough, the MLRO (Zara, Chief Compliance Officer, governance) presents the following evidence files: (a) current RMCP version and BRA; (b) Vera's recon harness outputs (summary); (c) STR / CTR / PAR filing statistics (12-month rolling); (d) training attestation records; (e) sanctions-list currency evidence; (f) CPF control evidence per PA Communication 1/2025 ([`ORG-FC-23`](../Regulations/_obligations-register.md)).
- **Post-greylisting remediation tracking** — SA's FATF grey-list status per [`ORG-FC-21`](../Regulations/_obligations-register.md) requires ongoing track-and-respond. The Bank maintains a **remediation tracker** (document-substrate artefact) updated at each annual RMCP review, recording: the FATF SA Mutual Evaluation finding, the Bank's response, the substrate / procedure that addresses it, and the status (open / addressed / addressed-under-watchlist). Submitted to PA on request.

---

## 8. Obligations closed

This RMCP closes or substantively advances the following obligations-register rows:

| Row | Statutory anchor | Obligation | Closed by |
|---|---|---|---|
| [`ORG-FC-01`](../Regulations/_obligations-register.md) | FIC Act s.42 | Adopt and maintain an RMCP | This document (§1) |
| [`ORG-FC-07`](../Regulations/_obligations-register.md) | FIC Act s.28 | CTR filing | §5.3 |
| [`ORG-FC-08`](../Regulations/_obligations-register.md) | FIC Act s.28A | PAR filing | §5.4 |
| [`ORG-FC-09`](../Regulations/_obligations-register.md) | FIC Act s.29 | STR filing | §5.2 |
| [`ORG-FC-10`](../Regulations/_obligations-register.md) | FIC Act s.29(3) | Tipping-off prohibition | §5.4 |
| [`ORG-FC-12`](../Regulations/_obligations-register.md) | FIC Act s.43 | Training | §6 |
| [`ORG-FC-17`](../Regulations/_obligations-register.md) | FATF Rec. 16 | Wire-transfer originator/beneficiary information | §3.2 (sanctions screening at onboarding); W1 Slice 4 (inline at execution — cross-reference attestable spec §4.3) |
| [`ORG-FC-21`](../Regulations/_obligations-register.md) | FATF SA Mutual Evaluation | Post-greylisting remediation | §7.4 (remediation tracker) |
| [`ORG-FC-23`](../Regulations/_obligations-register.md) | PA AML/CFT/CPF Communication 1/2025 | PA banks-supervisory expectations on CPF | §2.5 (CPF risk factors); §7.4 (PA submission cadence) |

---

## 9. Input-quality flags and open items

Per Principle 2 (single-graph discipline; no invented citations):

- **`[citation: TBC]` — PA AML/CFT/CPF Communication 1/2025 precise § references.** [`ORG-FC-23`](../Regulations/_obligations-register.md) carries `[citation: TBC]` for precise § references inside the PDF. Imani (Legal-as-code engineer, engineering) + external counsel ratify at licence-application gate per the gate plan §7.
- **`[citation: TBC]` — FIC GN 7 paragraph indices.** FIC GN 7 is cited by topic ("RBA periodicity") rather than by paragraph index throughout this document. Mira (Compliance / RegTech engineer) resolves precise paragraph indices at licence-application moment.
- **`[citation: TBC]` — MLRO-alternate recommended-practice PCC reference.** [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md) carries a `[citation: TBC]` for the exact FIC PCC reference; recommended-practice expectation rather than statute.
- **Entity-scope `[TBD]`.** Most FC-prefix register rows carry `entity-scope: [TBD]` in v1.14. This RMCP works from the `multi-entity` scope per §1.2. Reconciliation under `WS-ENTITY-SCOPE-CLASSIFICATION` (Mira's curatorship workstream).
- **W1 Slices 2–7 substrate gaps.** The substrate-side engineering described in §§2–6 is largely planned (not yet built) under W1 Slices 2–7. The RMCP is the binding specification; the slices are authorised under `D-REGULATORY-READINESS-GATE-PLAN`. Substrate gaps surface as Vera findings, not as RMCP defects.

---

## 10. Authority and citations

**Statutory instruments (by exact reference):**

- Financial Intelligence Centre Act 38 of 2001 ss.21, 21A, 21B, 21C, 21H, 22, 23, 24, 26B, 28, 28A, 29, 29(3), 42, 42A, 43, 43A; Schedule 1 item 6.
- FIC General Notice 7 of 2017 — Guidance Note on the implementation of the risk-based approach (FIC GN 7).
- FIC Guidance Note 5 — beneficial ownership.
- FATF Recommendations 1, 7, 10, 11, 12, 16, 18, 21.
- FATF SA Mutual Evaluation Reports (grey-listing remediation).
- SARB Prudential Authority — AML/CFT/CPF Communication 1 of 2025 (Banks). `[citation: TBC — precise § references]`.
- UN Security Council sanctions regime.
- OFAC SDN consolidated list.
- EU consolidated sanctions list.
- UK HMT consolidated list.
- Prevention of Organised Crime Act (POCA) 121 of 1998.
- Prevention and Combating of Corrupt Activities Act (PRECCA) 12 of 2004.
- UK Bribery Act 2010 (extra-territorial exposure where applicable).
- Protection of Terrorist Activities, Related Activities and Money Laundering Act (POCDATARA) 33 of 2004 (DTI list).
- FATCA IGA (SA-US) + Tax Administration Act 28 of 2011.
- CRS (OECD Standard for Automatic Exchange of Financial Account Information).
- JSE Equities Rules trade-record retention sub-rules. `[citation: TBC — per ORG-MK-15; Imani + external counsel ratify at licence-application gate]`.

**Internal canonical sources:**

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) v1.14 — Domain B (FC-prefix) rows cited inline by ID throughout this document.
- [`Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md`](2026-05-10_zara-mira_rmcp-attestable-spec.md) — the attestable specification this document implements.
- [`Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md) — the parent gate plan authorising W1.
- [`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md`](2026-05-06_core-policies-compliance-privacy.md) — the AML/CFT Policy, KYC / CDD / EDD Policy, and Sanctions Policy that this RMCP governs and binds.
- [`Regulations/FIC/fic-act.md`](../Regulations/FIC/fic-act.md) — bank-side curated reading of FIC Act 38 of 2001.
- **D-RMS-PHASE-1** (CEO-approved 2026-05-09) — event-type registration; document-substrate; spec at [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md).
- **D-THIN-HUMAN-LAYER-MINIMUM** (CEO-approved 2026-05-08) — triple-hatted MLRO + FIC CO + IO at licence-day; AC-Chair NED as MLRO-alternate.
- **D-FSP-LICENCE-NECESSITY** (CEO-approved 2026-05-09) — FSP licence necessity for Hoz Securities Limited.
- **CLAUDE.md** — "Operating procedures" (events-first authoring; dispatch discipline; no-pause rule); "Architectural principles" 1, 2, 6.
- `project_strategic_foundation.md` (memory) — institutional global-markets dealer; institutional-only client base.
- `project_indirect_participant_posture.md` (memory) — sponsor-bank FX-channel access; indirect CMI participant posture.
- `project_ai_driven_bank.md` (memory) — build-phase posture; pre-licence go-live readiness gate.
- `feedback_agent_name_with_position.md` (memory) — name + position on first mention.

---

## 11. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-05-11 | Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) | Initial RMCP v1. Standalone policy document mandated by FIC Act 38/2001 s.42. Implements the attestable specification at `2026-05-10_zara-mira_rmcp-attestable-spec.md`. Sections: (1) Programme overview and authority; (2) Risk-based approach including business risk assessment, client risk-rating methodology, CPF; (3) Customer due diligence programme — standard CDD, EDD, simplified CDD, PEP identification; (4) Record-keeping — 5-year FIC floor, conservative retention default, CDD and transaction records; (5) Reporting — STR/CTR/PAR, tipping-off prohibition, FIC portal procedures; (6) Training — agent-substrate attestation, human licence-day training, role-based modules; (7) Programme review — annual review, Vera recon harnesses, PA submission cadence, post-greylisting remediation tracker. Closes obligations ORG-FC-01, ORG-FC-07–10, ORG-FC-12, ORG-FC-17, ORG-FC-21, ORG-FC-23. LICENCE-BIND. |

---

*Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim)*
