---
title: AML/CFT Policy v1
author: Mira (Compliance / RegTech engineer) + Zara (Compliance / legal-as-code engineer)
date: 2026-05-11
summary: Standalone AML/CFT Policy covering the bank's anti-money-laundering and counter-financing-of-terrorism governance, obligations framework, transaction monitoring, sanctions screening, suspicious activity escalation, and FATF-aligned risk-based approach. Closes obligations ORG-FC-02 through ORG-FC-06, ORG-FC-13, ORG-FC-14, ORG-FC-17, ORG-FC-18, ORG-FC-19. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-FC.ML
  - RT-FC.TF
  - RT-FC.SA
---

# AML/CFT Policy v1

> **Status:** IN FORCE (policy layer). Substrate-side engineering delivery tracked under W1 Slices 2–6 of `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).
>
> **Authors:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) leads; Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) co-authors and is policy owner.
>
> **RMCP relationship:** This policy is the substantive AML/CFT governance instrument. The RMCP (FIC Act s.42) is the overarching programme; this policy populates the operational content of the RMCP's AML/CFT mandate. The two are complementary. Cross-references to the RMCP cite [`Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md`](2026-05-10_zara-mira_rmcp-attestable-spec.md). Do not duplicate RMCP-specific substrate engineering in this document — this policy governs the *what* and *why*; the RMCP attestable spec governs the *substrate binding*.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | AML/CFT Policy |
| Version | v1 |
| Effective date | 2026-05-11 |
| Approval authority | Board Risk Committee (BRC) |
| Policy owner | Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) |
| Engineering owner | Mira (Compliance / RegTech engineer, engineering — reports to Zara) |
| Review cadence | Annual; triggered by regulatory change, FATF SA Mutual Evaluation updates, or a material compliance incident |
| Risk appetite anchor | RAS B1 — zero appetite for facilitating financial crime |
| LICENCE-BIND | Yes — banking-specific obligations activate at commencement of trading; this policy is built and ready for licence-day |
| Obligations closed | [`ORG-FC-02`](../Regulations/_obligations-register.md) (CDD), [`ORG-FC-03`](../Regulations/_obligations-register.md) (EDD / PEPs), [`ORG-FC-04`](../Regulations/_obligations-register.md) (beneficial ownership), [`ORG-FC-05`](../Regulations/_obligations-register.md) (record-keeping), [`ORG-FC-06`](../Regulations/_obligations-register.md) (RBA), [`ORG-FC-13`](../Regulations/_obligations-register.md) (sanctions screening — UNSC / OFAC / EU / UK HMT), [`ORG-FC-14`](../Regulations/_obligations-register.md) (POCDATARA / DTI), [`ORG-FC-17`](../Regulations/_obligations-register.md) (FATF Rec. 16 wire transfers), [`ORG-FC-18`](../Regulations/_obligations-register.md) (continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md) (RBA periodicity) |

---

## 1. AML/CFT Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's anti-money-laundering and counter-financing-of-terrorism (AML/CFT) governance framework. It sets out the bank's obligations under South African law and FATF standards, defines the risk-based approach, and prescribes the controls, responsibilities, and escalation pathways that govern day-to-day AML/CFT compliance.

The bank is an accountable institution under FIC Act 38 of 2001 Schedule 1 item 6 (banks). All FIC obligations attach from that designation. This policy is the operative AML/CFT instrument; it sits below the RMCP (which is the s.42-required overarching programme) and above the operational procedures (which translate this policy into agent-executable steps).

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Financial Intelligence Centre Act 38 of 2001 (FIC Act)**, as amended by the FIC Amendment Act 1 of 2017, in particular:
  - s.21 — identification and verification of clients before establishing a business relationship
  - s.21A — enhanced due diligence for high-risk clients
  - s.21B — verification of beneficial ownership
  - s.21C — ongoing due diligence; monitoring of business relationships and transactions
  - s.21D — re-verification on reasonable doubt
  - s.21E — politically exposed persons (PEPs): EDD and senior-management approval
  - s.21F — foreign correspondent banking relationships
  - s.21G — third-party reliance on conditions
  - s.21H — enhanced ongoing due diligence for higher-risk relationships
  - s.22 — record-keeping (5-year minimum from end of relationship or transaction date)
  - s.26B — targeted financial sanctions; freezing of property
  - s.28 — cash threshold reports (CTRs) ≥ R 24,999.99
  - s.28A — property associated with terrorist and related activities reports (PARs / TPRs)
  - s.29 — suspicious transaction / activity reports (STRs / SARs); 15-day filing obligation from date suspicion is raised
  - s.29(3) — tipping-off prohibition
  - s.42 — risk management and compliance programme
  - s.42A — designation of senior person responsible for RMCP compliance
  - s.43 — training

- **FATF Recommendations** (2012, as amended): Recommendations 1 (risk-based approach), 10 (CDD), 11 (record-keeping), 12 (PEPs), 16 (wire transfers), 18 (internal controls and compliance), 20 (reporting of suspicious transactions), 21 (confidentiality), 24/25 (beneficial ownership of legal persons and legal arrangements), 40 (other forms of international cooperation)

- **FIC Guidance Notes (binding interpretive guidance)**:
  - GN 5 — beneficial ownership
  - GN 7 — implementation of the risk-based approach (customer typologies; RBA periodicity)
  - FIC Public Compliance Communications (PCCs) as issued — including post-greylisting remediation directives

- **SARB Prudential Authority — AML/CFT/CPF Communication 1 of 2025 (Banks)** — post-FATF-greylisting supervisory expectations for banks; register row [`ORG-FC-23`](../Regulations/_obligations-register.md). Anchors the bank's proliferation-financing (CPF) obligations under FATF Recommendation 7.

- **Protection of Constitutional Democracy Against Terrorist and Related Activities Act 33 of 2004 (POCDATARA)** — Targeted Financial Sanctions; the DTI list is a mandatory screening list.

- **Financial Sector Regulation Act 9 of 2017 (FSR Act)** — supervisory architecture underpinning the PA's AML/CFT supervisory mandate.

### 1.3 Entity scope

This policy applies to:

- **Hoz Bank Limited** — accountable institution, FIC Schedule 1 item 6. Primary scope.
- **Hoz Group Limited** — group-level governance.
- **Hoz Securities Limited** — accountable institution upon FAIS-FSP authorisation (per `D-FSP-LICENCE-NECESSITY`); this policy applies on the same multi-entity basis from that point.

Group-level entity tree: [`Regulations/_legal-entity-tree.md`](../Regulations/_legal-entity-tree.md).

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner / MLRO / FIC Compliance Officer | Zara (Chief Compliance Officer, governance — acting MLRO + FIC CO interim); triple-hatted human at licence-day per `D-THIN-HUMAN-LAYER-MINIMUM`. | FIC s.42A; [`ORG-FC-11`](../Regulations/_obligations-register.md). |
| MLRO-alternate | AC-Chair NED (at licence-day); until then Zara covers. | [`ORG-FC-MLRO-ALTERNATE`](../Regulations/_obligations-register.md). |
| Engineering owner | Mira (Compliance / RegTech engineer, engineering — reports to Zara). | W1 Slices 2–6 of D-REGULATORY-READINESS-GATE-PLAN. |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance). | Third-line; annual effectiveness review; recon harnesses. |
| POPIA intersection | Iris (Information Officer, governance). | POPIA ss.13, 18, 19–22 where CDD intersects personal-information processing. |
| Board oversight | BRC (Board Risk Committee) — receives annual MLRO report; approves this policy. | Governance Framework; [`ORG-FC-11`](../Regulations/_obligations-register.md). |

**CEO-MLRO bar.** The CEO (Marc) may not hold the MLRO designation concurrently with the CEO role (register row [`ORG-FC-11-GLOSS-CEO-MLRO-BAR`](../Regulations/_obligations-register.md)) — the accountability is kept independent. Marc holds the formal interim designation only as a structural placeholder until the triple-hatted human is appointed at licence-day; Zara holds operational MLRO authority now.

### 1.5 Policy hierarchy

```
Regulation / FATF Standard
    └── RMCP (FIC s.42 — overarching programme; Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md)
        └── AML/CFT Policy (this document — substantive governance)
            └── Operational procedures (Procedures/by-policy/aml-cft-*.md)
                └── Substrate engineering (W1 Slices 2–6)
```

Every node cites upward per Principle 2 (single-graph discipline). No orphan policies; no orphan procedures.

### 1.6 Approval, review, and amendment

- **Initial approval:** Board Risk Committee, 2026-05-11.
- **Annual review:** Zara-led, no later than 12 months after the preceding approval date.
- **Triggered review:** any FATF SA mutual-evaluation update, FIC PCC or Guidance Note amendment, PA supervisory communication, or material AML/CFT compliance incident triggers a review within 30 agent-cadence days.
- **Amendment discipline:** all changes to this policy are typed `PolicyAmended` events per Principle 1 (events are the only source of truth). The markdown file is a render of the event; the event is canonical.

---

## 2. Risk-Based Approach to ML/TF and Proliferation Financing

### 2.1 Governing principle

The bank's AML/CFT framework operates on a **risk-based approach (RBA)** per FATF Recommendation 1 and FIC GN 7. Risk appetite: **zero appetite for facilitating ML/TF/PF (RAS B1).** The RBA does not imply tolerance at any risk tier — it means controls are calibrated proportionately, so the highest-risk relationships carry the most intensive controls, and the lowest-risk relationships carry controls sufficient to meet the statutory floor, not a reduced level of vigilance.

Register rows: [`ORG-FC-06`](../Regulations/_obligations-register.md) (RBA dispatch), [`ORG-FC-19`](../Regulations/_obligations-register.md) (FIC GN 7 periodicity), [`ORG-FC-23`](../Regulations/_obligations-register.md) (PA AML/CFT/CPF Communication 1/2025 — CPF extension under FATF Rec. 7).

### 2.2 National Risk Assessment alignment

The bank monitors and ingests:

- **FATF SA Mutual Evaluation Report** and subsequent FATF monitoring reports. SA was greylisted in February 2023; the bank's RBA dispatch biases to the **higher-risk tier** where two ratings are plausible, consistent with the post-greylisting supervisory environment. Register row: [`ORG-FC-21`](../Regulations/_obligations-register.md).
- **FIC National Risk Assessment (NRA) outputs** — ingested into the bank's business-wide risk assessment as typology intelligence. SA-specific ML typologies: trade-based money laundering, State-capture-adjacent flows, crypto-to-fiat layering, real-estate overlays.
- **PA AML/CFT/CPF Communication 1 of 2025 (Banks)** — supervisory-expectation anchors; cross-reference [`ORG-FC-23`](../Regulations/_obligations-register.md). Specific areas flagged: beneficial-ownership effectiveness, sanctions-screening quality, STR quality and timeliness, and risk-based-approach calibration evidence.

The MLRO (Zara) reviews NRA ingestion and FATF-update ingestion at every agent-cadence quarterly run and flags any recalibration requirement to the BRC.

### 2.3 Business-wide risk assessment (BWRA)

The bank maintains a **business-wide risk assessment (BWRA)** that identifies, assesses, and understands the ML/TF/PF risks to which the bank is exposed across:

- **Products and services:** institutional bonds/equities, OTC interest-rate derivatives (IRD), FX (B-cluster, concentrated; accessed via correspondent banks), repo. No retail products; no cash-intensive products at go-live. The institutional-only client base substantially reduces exposure to the ML typologies most prevalent in the retail channel.
- **Customer base:** institutional counterparties only (per `project_strategic_foundation.md`). No natural-person retail clients. Predominant customer types: asset managers, pension funds, corporates, financial institutions. Elevated ML concern for: foreign financial institutions in high-risk corridors, shell-company counterparties with complex beneficial-ownership structures, counterparties in FATF-identified high-risk jurisdictions.
- **Delivery channels:** no cash; no anonymous digital channels. Trades executed electronically; settlement via SAMOS (indirect access through sponsor bank per `project_indirect_participant_posture.md`); FX via correspondent.
- **Geographic exposure:** primary — South Africa. Cross-border exposure through institutional counterparties' home jurisdictions; USD settlement via correspondent (OFAC exposure). High-risk jurisdictions per FATF black/grey lists trigger EDD by default.

The BWRA is a document-substrate artefact; reviewed annually; every review cycle emits `RmcpTypologyReviewed` event per the RMCP attestable spec §2.3.

### 2.4 Customer risk classification

Every client in the client master carries a risk rating: **high / medium / low**. The rating is computed by the risk-rating typology projection (W1 Slice 3) from the following factors:

| Risk factor | High indicators | Elevated indicators |
|---|---|---|
| Customer type | Non-bank financial institutions in high-risk jurisdictions; family offices with complex BO structures; legal arrangements (trusts, foundations) with opaque beneficial ownership | Foreign financial institutions; politically connected entities |
| Beneficial ownership | Complex multi-layer structures; unresolved beneficial-ownership chain; BO in FATF-listed jurisdictions | Partial BO resolution; BO change pending refresh |
| Geography | Counterparty domiciled in FATF black/grey-listed jurisdiction; sanctions-adjacent corridor | Counterparty with significant exposure to high-risk jurisdictions |
| PEP status | Foreign PEP; domestic PEP above public-office threshold per s.21E | Former PEP; associate or family member of PEP |
| Product | Complex OTC structures with multiple-leg cross-border cash movement | Cross-border FX above concentration threshold |
| Transaction behaviour | Atypical for institutional profile; rapid-movement patterns inconsistent with declared purpose | Occasional unusual-for-profile transaction; elevated single-transaction size |
| Prior monitoring hits | Prior `TransactionMonitoringHit` unresolved; prior MLRO investigation | Prior alert closed with documented reasoning |

**Rating dispatch:**

- **High** → EDD required; annual CDD refresh (FIC GN 7); transaction monitoring at maximum sensitivity; MLRO review at onboarding.
- **Medium** → standard CDD; 24-month CDD refresh (FIC GN 7); standard transaction monitoring.
- **Low** → simplified CDD where permissible; 36-month CDD refresh (FIC GN 7); transaction monitoring at minimum sensitivity.

Post-greylisting conservative dispatch: where two risk tiers are plausible, the bank applies the higher tier. This is an explicit policy choice consistent with the PA's AML/CFT/CPF Communication 1/2025 expectations.

### 2.5 Product and geographic risk register

Mira (Compliance / RegTech engineer) maintains a standing product-and-geographic-risk register as a document-substrate artefact. The register maps each product line and each active counterparty jurisdiction to its ML/TF/PF risk score and the applicable controls calibration. Updated on: (a) each new product approval (NPA gate); (b) FATF grey/black list updates; (c) significant corridor-level concentration changes reported by Saskia (Head of Global Markets, governance).

### 2.6 Proliferation financing (PF)

Per **FATF Recommendation 7** and the PA AML/CFT/CPF Communication 1 of 2025 (`ORG-FC-23`), the bank applies targeted financial sanctions screening as the primary PF control (§5 of this policy) and applies the BWRA to PF risk on the same RBA logic. The institutional-only, non-physical-cash business model substantially reduces PF exposure relative to retail banks; the bank nonetheless maintains the screening, CDD, and MLRO-investigation infrastructure at parity with ML/TF controls.

---

## 3. Customer Due Diligence

### 3.1 CDD obligation and scope

The bank conducts customer due diligence (CDD) on every prospective client before establishing a business relationship and on existing clients on the periodicity the risk rating demands. CDD is not a one-time gate — it is a continuous process that combines initial verification with ongoing monitoring and periodic refresh.

**Statutory anchors:** FIC Act ss.21, 21A, 21B, 21C, 21D, 21E, 21F, 21G, 21H; FATF Recommendation 10.

Register rows: [`ORG-FC-02`](../Regulations/_obligations-register.md) (CDD), [`ORG-FC-03`](../Regulations/_obligations-register.md) (EDD / PEPs), [`ORG-FC-04`](../Regulations/_obligations-register.md) (beneficial ownership), [`ORG-FC-18`](../Regulations/_obligations-register.md) (continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md) (RBA periodicity).

### 3.2 Upfront CDD — minimum requirements

**No client is admitted to the client master without satisfying the applicable upfront CDD gate.** The gate is a typed `ClientCddCompleted` event (W1 Slice 3). Any `Order*` approval for a client without a current `ClientCddCompleted` event is rejected by the compliance substrate.

Minimum upfront CDD for all institutional clients:

1. **Legal entity identification.** Name; registration number; registered address; country of incorporation. Source: official company register or equivalent. For South African entities: CIPC extract. For foreign entities: home-jurisdiction company register extract.

2. **Authorised representatives.** Names and identity documents for all natural persons who have authority to act on behalf of the entity.

3. **Beneficial ownership resolution.** Recursive resolution to the natural persons who ultimately own or exercise effective control over the entity (see §3.4). No client is admitted with an unresolved BO chain.

4. **Business purpose.** Nature of the client's business; purpose of the proposed banking relationship; expected transaction types, volumes, and corridors.

5. **Sanctions and PEP screening.** Pre-admission screening against all active sanctions lists (§5) and PEP screening (§3.5). A `SanctionsScreeningCompleted` event is required before `ClientCddCompleted` is emitted.

6. **Risk rating.** The risk-rating projection (§2.4) assigns the initial risk rating. The MLRO (Zara) approves all high-risk onboardings in advance.

### 3.3 Enhanced due diligence (EDD)

EDD applies to all clients rated **high** and to all clients that fall within any of the following categories regardless of the computed risk rating:

- **High-risk jurisdictions.** Counterparties domiciled in, or with material exposure to, FATF-identified high-risk or monitored jurisdictions (including SA's own grey-list status for inbound counterparty expectations).
- **Politically Exposed Persons (PEPs).** All PEPs, their family members, and close associates per FIC s.21E and FATF Recommendation 12 (see §3.5).
- **Foreign correspondent banking relationships.** Per FIC s.21F and FATF Recommendation 13.
- **Complex structures.** Clients with four or more layers of legal-entity ownership; nominee-shareholder structures; clients whose BO is a legal arrangement (trust, foundation, fiduciary) rather than a natural person.
- **Non-face-to-face.** All clients onboarded without a physical meeting with an authorised representative. (Given the bank's institutional-only, fully digital operating model, this applies to most clients; the compensation controls are: (a) certified documents; (b) source-of-funds confirmation; (c) MLRO sign-off.)

EDD requirements (in addition to standard CDD):

1. **Senior-management approval.** The MLRO (Zara) approves EDD clients at onboarding; the BRC is notified of EDD-client additions at the following quarterly meeting.

2. **Source of wealth (SOW) and source of funds (SOF).** Documented and verified for the entity and its controlling natural persons. Where documentary verification is unavailable (e.g. unlisted entity), a reasoned narrative is recorded and the risk rating is elevated accordingly.

3. **Enhanced ongoing monitoring.** Transaction monitoring at maximum sensitivity (§4.2). Behavioural-baseline update at every annual CDD refresh.

4. **Annual CDD refresh.** Regardless of trigger events, all EDD clients are refreshed annually (FIC GN 7 high-risk periodicity).

5. **Adverse media screening.** Annual Nexis/OSINT sweep at each refresh cycle.

### 3.4 Beneficial ownership identification

**Statutory anchor:** FIC Act s.21B; FATF Recommendations 24 and 25.

Register row: [`ORG-FC-04`](../Regulations/_obligations-register.md).

The bank resolves beneficial ownership recursively until it reaches either (a) a natural person who owns > 25% of the entity's shares or voting rights, or (b) a natural person who otherwise exercises effective control, or (c) a terminal opaque structure (registered fund, listed company, government entity) below which further resolution is not practicable. Where case (c) applies, the nature and identity of the terminal structure is documented and the risk rating is adjusted accordingly.

**Process:**

1. Obtain the entity's official register of members / shareholders / beneficial owners (CIPC BCIRC extract for South African entities; equivalent for foreign entities).

2. For each legal-entity shareholder with ≥ 25% ownership or voting rights, repeat step 1 recursively.

3. Verify the identity of every identified natural-person beneficial owner (name, ID/passport, nationality, country of domicile).

4. Document the ownership structure in a diagram held in the document substrate (BLAKE3-addressed artefact referenced from `ClientBeneficialOwnerResolved` event payload).

5. Screen all identified beneficial owners for PEP status and sanctions matches before `ClientCddCompleted` is emitted.

**Trigger for re-verification:** any change in beneficial ownership above 10% triggers immediate re-verification of the BO chain and a fresh `ClientBeneficialOwnerResolved` event. Imani (Legal-as-code engineer, engineering — reports to Zara CCO) maintains the clause-library hooks that detect material BO changes from entity-registry-update feeds.

**Trusts and legal arrangements.** For trusts: identify the settlor(s), trustee(s), protector(s) (if any), beneficiaries (or class of beneficiaries), and any natural person who exercises effective control. Per FATF Recommendation 25.

### 3.5 Politically Exposed Persons (PEPs)

**Statutory anchor:** FIC Act s.21E; FATF Recommendation 12.

Register row: [`ORG-FC-03`](../Regulations/_obligations-register.md).

A PEP is an individual who is or has been entrusted with a prominent public function, including but not limited to: heads of state; senior government ministers; senior judicial officials; senior military officers; senior executives of state-owned enterprises; senior officials of political parties; senior executives of international organisations.

**Domestic PEPs.** Apply EDD per §3.3. Senior-management (MLRO) approval required at onboarding and at each annual CDD refresh.

**Foreign PEPs.** Apply EDD per §3.3. Senior-management (MLRO) approval required at all times. Enhanced transaction monitoring throughout the relationship.

**Family members and close associates.** Screened for PEP connectivity at onboarding and at each CDD refresh. Where PEP connectivity is identified, the associated natural person inherits EDD requirements.

**Former PEPs.** A former PEP carries residual elevated risk for a period commensurate with the nature and length of the prior public function. The MLRO (Zara) determines the appropriate monitoring level on a case-by-case basis, documented in the client record.

**PEP screening tooling.** Automated PEP screening is incorporated into the onboarding workflow and periodic CDD refresh; screening events emitted per the sanctions/PEP-screening substrate (W1 Slice 2). False positives are resolved through the same workflow as sanctions false positives (§5.4).

### 3.6 Ongoing CDD and continuous KYC

**Statutory anchor:** FIC Act s.21C (ongoing due diligence); FATF Recommendation 10 (ongoing monitoring).

Register rows: [`ORG-FC-18`](../Regulations/_obligations-register.md) (continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md) (RBA periodicity).

The bank operates a **two-tier continuous-KYC restriction default** per RAS B3 (CEO-approved 2026-05-06):

- **High-confidence trigger** (e.g. confirmed sanctions hit; material AML typology hit; FIC directive) → **immediate restriction** (`ClientKycRestricted` event); trading and settlement suspended pending MLRO investigation.
- **Medium-confidence trigger** (e.g. transaction-monitoring hit; adverse-media flag; BO-change notification) → **restriction on review** within 48 hours; MLRO investigation opens.

**CDD refresh periodicity (FIC GN 7):**

| Risk rating | Refresh interval |
|---|---|
| High | Annual (12 months) |
| Medium | 24 months |
| Low | 36 months |

Conservative dispatch applies: if the previous refresh was within the window but the client's risk profile has materially changed, refresh is triggered on change, not on schedule.

**CDD trigger events (independent of scheduled refresh):**

- Beneficial-ownership change above 10%
- Adverse-media hit at or above the defined sensitivity threshold
- Transaction-monitoring hit escalated to MLRO
- Sanctions screening hit (even if subsequently resolved as false positive)
- Request from regulatory authority (FIC, PA, FSCA)
- Doubt about the accuracy or completeness of existing CDD information (FIC s.21D)
- Client moves from low/medium to a higher-risk jurisdiction

### 3.7 Foreign correspondent banking

**Statutory anchor:** FIC Act s.21F; FATF Recommendation 13.

The bank's indirect CMI access posture (via sponsor / correspondent banks; per `project_indirect_participant_posture.md`) means the bank engages correspondent banks for SAMOS settlement and FX execution. These relationships carry correspondent-banking risk.

Before establishing any foreign correspondent relationship:

1. Apply EDD per §3.3.
2. Assess the respondent institution's AML/CFT programme quality — obtain and review the respondent's latest available AML/CFT attestation, regulatory rating (where public), FATF mutual-evaluation reading.
3. Document the ownership and management of the respondent institution.
4. Obtain MLRO (Zara) approval.
5. Confirm that the respondent institution is not a shell bank (no physical presence in any jurisdiction and no affiliates that are regulated).

Foreign correspondent relationships are reviewed annually against the ongoing-CDD schedule.

### 3.8 Third-party reliance

**Statutory anchor:** FIC Act s.21G; FATF Recommendation 17.

The bank may rely on CDD conducted by a third party (another accountable institution or a regulated equivalent in a comparable jurisdiction) under the following conditions:

1. The third party is subject to equivalent AML/CFT requirements.
2. The bank obtains the relevant CDD information from the third party immediately (not retrospectively).
3. The third party provides copies of identification and verification data on request without delay.
4. The bank retains ultimate accountability for CDD quality — third-party reliance does not transfer liability.
5. Third-party reliance is documented as a typed event in the client master.

The bank does not rely on third parties domiciled in or regulated by jurisdictions on the FATF high-risk or monitored list.

---

## 4. Transaction Monitoring

### 4.1 Obligation and purpose

The bank maintains a **transaction monitoring programme** that identifies, on a real-time and retrospective basis, transactions that are suspicious, atypical, or potentially indicative of ML/TF/PF activity.

**Statutory anchors:** FIC Act s.21C (ongoing CDD / transaction scrutiny); FIC Act s.29 (STR filing from suspicion); FATF Recommendation 10 (ongoing monitoring); FATF Recommendation 20 (reporting of suspicious transactions).

Register rows: [`ORG-FC-06`](../Regulations/_obligations-register.md) (RBA dispatch), [`ORG-FC-09`](../Regulations/_obligations-register.md) (STR), [`ORG-FC-17`](../Regulations/_obligations-register.md) (FATF Rec. 16 wire transfers).

### 4.2 Automated monitoring rules

The monitoring engine (W1 Slice 4 — `TransactionMonitored` and `TransactionMonitoringHit` events) runs over every `Transaction*` event from the markets substrate in real time and retrospectively over a rolling 90-day window. Rule sensitivity is calibrated to the client's risk rating per §2.4.

**Minimum monitoring scenarios (IN FORCE at go-live):**

| Scenario | Description | Risk-rating sensitivity |
|---|---|---|
| Structuring | Series of transactions below CTR threshold (R 24,999.99) that in aggregate exceed the threshold; timing indicative of intentional splitting | All tiers |
| Rapid movement | Funds received and onward-transferred within 24 hours; no obvious business purpose | All tiers; lower threshold for high-risk |
| Atypical for profile | Transaction type, size, or corridor inconsistent with client's declared business purpose and established pattern | All tiers |
| High-risk jurisdiction touch-point | Payment to or from counterparty with nexus to FATF black/grey-listed jurisdiction | All tiers; lower threshold for high-risk |
| Sanctions-adjacent flow | Transaction involving a counterparty in a country or sector adjacent to a sanctions programme (near-miss) | All tiers |
| Wire-transfer data missing | Cross-border transfer lacking originator or beneficiary information required by FATF Rec. 16 (FIC Act s.21C read with FATF R.16) | All tiers — transaction blocked pre-execution |
| Unusual counter-currency | FX leg denominated in a currency with no obvious commercial rationale given the client's declared business | Medium and high tiers |
| Dormancy followed by volume spike | Account / client relationship with extended low-activity period followed by materially higher volumes | All tiers |
| Round-amount concentration | Concentration of transactions at round amounts in excess of defined thresholds | All tiers; higher threshold for institutional baseline |
| Linked-party flow | Transactions between a client and an entity that shares beneficial owners; potential inter-party layering | High tier by default; escalated to MLRO |

Mira (Compliance / RegTech engineer) reviews and updates the rule set quarterly or on FATF/FIC typology guidance update, whichever is sooner. All rule changes are typed `TransactionMonitoringRuleUpdated` events.

### 4.3 Alert management

Every rule hit emits a `TransactionMonitoringHit` event. The alert management workflow:

1. **Triage (automated + Mira).** The monitoring substrate assigns an initial priority score (1–5) based on rule severity and client risk rating. Priority 1–2 alerts enter the MLRO queue immediately. Priority 3–5 alerts enter Mira's triage queue for initial disposition.

2. **Disposition.** Every alert is either:
   - **Escalated to MLRO** — for potential STR assessment (§6.1).
   - **Closed with documented reasoning** — Mira documents the reasoning in the `TransactionMonitoringAlertClosed` event. No silent closures. The documented reasoning must explain why the transaction does not give rise to suspicion.

3. **Timing.** Priority 1–2 alerts: MLRO notified within 2 hours of detection. Priority 3–5 alerts: triaged within one business day; escalated or closed within 5 business days.

4. **Retrospective sweep.** The monitoring engine runs a nightly retrospective sweep over the rolling 90-day window to catch patterns that only become visible in retrospect. Retrospective hits are processed through the same alert management workflow.

### 4.4 Wire transfer originator/beneficiary information (FATF Rec. 16)

**Statutory anchor:** FATF Recommendation 16; FIC Act s.21C.

Register row: [`ORG-FC-17`](../Regulations/_obligations-register.md).

All cross-border wire transfers must carry complete originator and beneficiary information:
- Originator: full name; account number; address or national identity number or date and place of birth.
- Beneficiary: full name; account number.

**Enforcement is pre-execution.** Any cross-border `Transfer*` event that lacks the required originator and beneficiary fields is **rejected by the markets substrate before execution** (not flagged post-hoc). The rejection emits a `WireTransferRejectedMissingFields` event. No exception to this rule exists; the MLRO cannot override a missing-fields rejection — the transaction must be re-submitted with complete information.

### 4.5 Monitoring effectiveness review

Vera (Internal audit / continuous-assurance engineer) conducts an **annual effectiveness review** of the transaction monitoring programme, examining:

- False-positive rate per rule category (rule tuning quality)
- False-negative rate (based on retrospective review of closed alerts and Vera-selected sample)
- Alert closure documentation quality
- Time-to-escalation compliance
- Coverage: `recon:transaction-monitoring-coverage` (planned, W1 Slice 4) asserts every settled `Transaction*` event has at least one paired `TransactionMonitored` event.

---

## 5. Sanctions Screening

### 5.1 Obligation and scope

The bank screens all clients, beneficial owners, counterparties, and transactions against applicable sanctions lists on a real-time, pre-execution basis. Zero appetite for transacting with sanctioned parties (RAS B4 — Board-approved 2026-05-06).

**Statutory anchors:** FIC Act s.26B (Targeted Financial Sanctions; freeze and report); POCDATARA 33 of 2004 (DTI list); UN Security Council sanctions regime; OFAC SDN; EU consolidated sanctions list; UK HMT consolidated sanctions list.

Register rows: [`ORG-FC-13`](../Regulations/_obligations-register.md) (RAS B4 zero-appetite), [`ORG-FC-14`](../Regulations/_obligations-register.md) (POCDATARA / DTI), [`ORG-FC-23`](../Regulations/_obligations-register.md) (PA AML/CFT/CPF Communication 1/2025 — CPF extension under FATF Rec. 7).

Cross-reference: Sanctions Policy (IN FORCE per [`ORG-FC-13`](../Regulations/_obligations-register.md)) — the Sanctions Policy is the dedicated instrument for the sanctions programme. This section of the AML/CFT Policy records the AML/CFT interface and the screening-methodology boundary.

### 5.2 Screening lists

The following lists are screened against at all times. All lists are ingested by the sanctions-screening pipeline (W1 Slice 2), which emits `SanctionsListIngested` events on each update:

| List | Issuer | Refresh frequency |
|---|---|---|
| UN Security Council Consolidated List | UN SC Sanctions Committee | ≤ 24 hours from UN publication |
| OFAC Specially Designated Nationals and Blocked Persons (SDN) | US Treasury OFAC | ≤ 24 hours from OFAC publication |
| EU Consolidated Financial Sanctions List | European Union | ≤ 24 hours from EU publication |
| UK HMT Consolidated Sanctions List | UK OFSI / His Majesty's Treasury | ≤ 24 hours from OFSI publication |
| POCDATARA / DTI Targeted Financial Sanctions List | SA DTI / FIC | ≤ 7 days from DTI publication |
| FATF High-Risk and Other Monitored Jurisdictions | FATF | On each FATF plenary update (≈ quarterly) |

Mira (Compliance / RegTech engineer) monitors for list updates and certifies each ingestion event. The `recon:sanctions-list-currency` recon (planned, W1 Slice 2) asserts every active list has a `SanctionsListIngested` event within the per-list refresh window.

### 5.3 Screening points

Sanctions screening runs at the following points:

1. **Client onboarding** — entity, all beneficial owners, all authorised representatives. Screen before `ClientCddCompleted` is emitted.
2. **Transaction pre-execution** — counterparty and correspondent. Screen on every `Transaction*` event before execution; blocking is pre-execution.
3. **Daily watchlist sweep** — all active clients screened against each newly ingested list within 24 hours of ingestion.
4. **Ad hoc** — on request of the MLRO or FIC.

### 5.4 Name-matching methodology and false-positive handling

The screening engine applies **fuzzy-matching with configurable similarity thresholds** to accommodate name variations, transliteration differences, and abbreviated names. Tuning is calibrated to minimise false positives while maintaining a false-negative rate consistent with the zero-appetite RAS B4 posture.

**True positive** — the screening engine emits `SanctionsTruePositiveBlocked`. The transaction or onboarding is blocked immediately and permanently without any agent override. The MLRO (Zara) is notified within 1 hour. Refer to §6 for STR and PAR filing obligations.

**False positive** — where a match is assessed by Mira (Compliance / RegTech engineer) or Zara (CCO) to be a false positive:
1. Mira documents the false-positive determination in a `SanctionsFalsePositiveDismissed` event, including the distinguishing factors (e.g. different date of birth; different nationality; different address).
2. Zara (CCO) reviews and approves all false-positive dismissals; MLRO approval required.
3. The client or transaction is released only after MLRO approval is recorded.
4. False-positive patterns are fed into rule-tuning (Mira; quarterly).

**No client-facing disclosure.** The tipping-off prohibition (FIC s.29(3); §6.4 of this policy) applies equally to sanctions-screening hits. No client is informed that they have been screened, that a hit has occurred, or that a PAR is being prepared.

### 5.5 Blocking and freezing obligations

On a confirmed `SanctionsTruePositiveBlocked`:

1. **Freeze funds immediately.** The bank must freeze funds and assets associated with the designated person/entity per FIC s.26B and POCDATARA. The freeze is a typed event in the event store.
2. **File a Property Associated with Terrorist and Related Activities Report (PAR/TPR)** with the FIC per FIC s.28A as soon as practicable. See §6 for the MLRO investigation and filing pathway.
3. **No release of funds** except with explicit FIC or court authorisation. Any purported override of a sanctions block is a breach of FIC s.26B and POCDATARA — it is not an internal decision the MLRO or management can make unilaterally.

### 5.6 MLRO sanctions override — narrow scope

The Sanctions Policy and this policy prohibit any production override of a true-positive sanctions block. The only permissible form of override is:

- A **written MLRO-signed exception** (`MlroSanctionsOverrideApproved` event) limited to one narrow scenario: a supervisory authority has provided written guidance that the match was incorrectly designated or that a humanitarian licence applies.
- The written authority from the supervisory body is held in the document substrate (BLAKE3 artefact) and referenced from the `MlroSanctionsOverrideApproved` event.

Overrides are reported to the BRC at the next quarterly meeting.

---

## 6. Suspicious Activity Reporting

### 6.1 STR obligation and triggering suspicion

The bank files Suspicious Transaction / Activity Reports (STRs / SARs) with the Financial Intelligence Centre (FIC) when the MLRO (Zara) has reasonable grounds to suspect that a transaction or attempted transaction relates to:

- Proceeds of unlawful activities (money laundering);
- Financing of terrorist or related activities;
- Financing of proliferation of weapons of mass destruction; or
- Any other conduct that is a financial crime under South African law.

**Statutory anchor:** FIC Act s.29 — file as soon as practicable after suspicion arises, but **in any event no later than 15 days** after the date on which suspicion was first raised.

**Suspicion threshold.** The FIC Act does not require certainty — it requires suspicion on reasonable grounds. The bank applies the following standard: suspicion is formed when a fact pattern, in the objective assessment of the MLRO, cannot be satisfactorily explained by a legitimate purpose after reasonable inquiry. The MLRO is the sole internal decision-maker on suspicion formation.

### 6.2 MLRO investigation process

When an alert is escalated to the MLRO (Zara) — whether from transaction monitoring (§4.3), sanctions screening (§5.4), continuous-KYC trigger (§3.6), or any other source — the MLRO opens a formal investigation via `MlroInvestigationOpened` event.

**Investigation steps:**

1. **Evidence assembly.** Mira (Compliance / RegTech engineer) assembles the relevant transaction records, CDD documents, monitoring-hit details, and any prior MLRO investigation history for the client. All assembled materials are stored in the document substrate.

2. **Inquiry.** Where the MLRO determines that inquiry of the client is necessary and permissible (i.e. the inquiry would not tip off the client about a potential STR), Mira conducts the inquiry. If the inquiry might alert the client to a potential STR, no inquiry is made — the investigation proceeds on available information only. This is a strict prophylactic: when in doubt, no inquiry.

3. **MLRO decision.** The MLRO (Zara) records the investigation outcome in `MlroInvestigationDecided` event with one of the following dispositions:
   - **File STR** — grounds for suspicion confirmed; proceed to §6.3.
   - **File PAR** — sanctions-related property identified; proceed to §6.5.
   - **Close — no reasonable grounds** — documented reasoning explaining why the pattern does not give rise to suspicion. This is not a silent closure.

4. **Escalation to BRC.** If the investigation reveals systemic issues in the AML/CFT controls, or if a pattern of similar alerts suggests a systematic vulnerability, the MLRO escalates to the BRC via `MlroEscalationRaised` event.

### 6.3 STR filing

On an `MlroInvestigationDecided` event with disposition **file STR**:

1. **Prepare the STR.** The STR is prepared in the format required by the FIC via the goAML system. The STR must include: full particulars of the transaction(s); the grounds for suspicion; the client identification; the date suspicion was first formed.

2. **File within 15 days.** The `recon:str-15-day-window` recon (planned, W1 Slice 4) asserts the wall-clock delta between `MlroInvestigationDecided` (file STR) and `StrFiled` is ≤ 15 calendar days. Breach of the 15-day window is a Critical event (`CriticalIncidentRaised`) with immediate notification to Vera (Internal audit / continuous-assurance engineer) and Thandiwe (Chief Audit Executive, governance).

3. **File via goAML.** The submission is effected through the bank's goAML harness (W1 Slice 6), which emits a `GoAmlReportSubmitted` event on successful transmission. Idempotent: repeated submission of the same report ID is a no-op.

4. **Record-keeping.** The STR, supporting investigation file, and submission evidence are retained in the document substrate per the FIC s.22 five-year retention floor. The event-store retention class is `RETENTION_FIC_S22_5Y`.

### 6.4 Tipping-off prohibition

**Statutory anchor:** FIC Act s.29(3).

**This is a criminal offence.** Disclosing to any person:
- that an STR has been filed, or
- that an STR is being contemplated, or
- that an investigation is underway,

is a criminal offence under FIC s.29(3). The prohibition covers all bank personnel, agents, and contractors.

**Cryptographic enforcement.** All events in the MLRO investigation set (`MlroInvestigationOpened`, `MlroInvestigationDecided`, `StrFiled`) are encrypted under an MLRO-held key envelope. No agent or system — other than the MLRO identity and the MLRO-alternate — can decrypt these events. The identity-substrate enforces this at the permission-policy layer (`prototype/platform/agent-identity/permission-policy.ts`; W1 Slice 4 / W3 Slice 6 HSM key envelope).

**Inferential tipping-off.** The bank additionally guards against inferential tipping-off: no projection or dashboard exposes a per-client field whose presence or absence would imply STR existence. A "client under investigation" flag is itself a tipping-off risk; the substrate uses MLRO-key-encrypted projections exclusively for the investigation set. Vera's `recon:tipping-off-inference` (planned) asserts this.

**No client notification.** The bank does not notify a client:
- that they have been screened for AML/CFT purposes;
- that a monitoring alert has been raised;
- that the bank is investigating their transactions;
- that an STR is being, or has been, filed.

**Limitation of liability.** Filing an STR in good faith carries statutory protection under FIC Act s.29(5) — the bank and the MLRO are not liable to any person for disclosures made in good faith.

### 6.5 Cash Threshold Reports (CTRs) and Property Association Reports (PARs)

**CTRs (FIC Act s.28).** The bank files CTRs for all cash transactions at or above R 24,999.99 (or the current prescribed threshold, whichever applies). Given the bank's institutional-only, non-cash business model, cash transactions are not expected at go-live. The CTR pipeline (`CtrFiled` events, W1 Slice 4) is built and tested via synthetic fixture before go-live to ensure readiness.

**PARs (FIC Act s.28A).** A PAR is filed when the bank knows or suspects that it has property associated with terrorist or related activities, including a confirmed sanctions hit where the matched property is identifiable. The PAR filing pipeline (W1 Slice 4 + W1 Slice 6 via `ParFiled` + `RegOnlineReportSubmitted` events) is triggered by `SanctionsTruePositiveBlocked`. Filing is as soon as practicable; no 15-day window applies (the PAR is filed immediately on identification of the property association).

### 6.6 MLRO annual report to the BRC

The MLRO (Zara) submits an annual report to the BRC covering:

- Total number of transaction-monitoring alerts; disposition breakdown
- Total number of STRs filed; total CTRs filed; total PARs filed
- Total number of MLRO investigations opened and decided
- Sanctions hits: true positives blocked; false positives dismissed
- Training completion status (§7)
- Material regulatory developments and their policy implications
- Assessment of the AML/CFT programme effectiveness
- Open findings from Vera's annual effectiveness review
- Any escalations made to the BRC during the year

The annual report is a document-substrate artefact referenced from a `MlroAnnualReportFiled` event.

---

## 7. Post-Greylisting Obligations

### 7.1 SA FATF greylisting context

South Africa was placed on the FATF grey list in February 2023 following the FATF Mutual Evaluation Review (MER). The greylisting has direct implications for the bank's AML/CFT programme:

- **PA supervisory expectations are elevated.** The PA AML/CFT/CPF Communication 1 of 2025 (`ORG-FC-23`) sets enhanced supervisory expectations for banks specifically during the post-greylisting remediation period. The bank treats these as binding for operational purposes.
- **Conservative RBA dispatch.** The bank applies the conservative (higher) risk tier where two tiers are plausible (§2.4, §2.5). This is a post-greylisting policy choice, not merely a regulatory floor.
- **STR quality.** FATF's remediation assessment includes evaluation of STR quality (timeliness, completeness, actionability). The bank designs its investigation-and-filing workflow to produce high-quality STRs from the start.

Register row: [`ORG-FC-21`](../Regulations/_obligations-register.md) (FATF SA Mutual Evaluation track-and-respond).

### 7.2 Remediation tracking

Mira (Compliance / RegTech engineer) maintains a standing **FATF remediation tracking register** as a document-substrate artefact. The register maps each FATF recommended-action item (from the SA MER and subsequent monitoring reports) to:

- The relevant obligation row in the obligations register
- The policy and procedure that addresses it
- The substrate-side engineering implementation status
- The evidence artefact (document-substrate hash) that demonstrates compliance

The register is updated at every FATF monitoring-report cycle and at every PA AML/CFT/CPF Communication issuance. Mira reports the register status to Zara (CCO) quarterly.

### 7.3 Enhanced supervisory engagement

Per the PA AML/CFT/CPF Communication 1 of 2025, the bank anticipates and prepares for enhanced supervisory engagement in the post-greylisting period, including:

- **Supervisory visits and data requests.** The bank maintains a supervisory-engagement register (document-substrate artefact) that logs all PA and FIC data requests and responses. Each response is a typed event.
- **Beneficial ownership effectiveness.** The PA has signalled heightened focus on the quality of BO resolution (not merely the completion of the process). The bank's BO resolution methodology (§3.4) is designed to produce document-quality, auditable BO chains. Vera samples BO resolution quality annually.
- **Sanctions screening quality.** The PA has signalled focus on sanctions-screening false-negative rates and name-matching methodology. Mira reports the screening effectiveness metrics (false positive rate, false negative detection rate via retrospective samples, list-refresh latency) to the MLRO quarterly.
- **EDD on high-risk corridors.** The PA has flagged high-risk cross-border corridors (including inbound flows from high-ML-risk jurisdictions). The bank's EDD provisions (§3.3) and transaction monitoring scenarios (§4.2) specifically include corridor-risk calibration.

### 7.4 Proliferation financing (CPF) controls

Per **FATF Recommendation 7** and the PA AML/CFT/CPF Communication 1 of 2025:

- The bank applies targeted financial sanctions screening as the primary CPF control; the sanctions pipeline (§5) screens all UNSC Resolutions relevant to PF (including resolutions concerning DPRK and Iran as the primary FATF Rec. 7 targets).
- The BWRA (§2.3) includes a PF risk assessment covering the bank's product set and counterparty base.
- Mira (Compliance / RegTech engineer) maintains awareness of FATF Rec. 7 implementation guidance and PF typology updates; updates to the monitoring rule set (§4.2) include PF-specific scenarios where applicable to the bank's institutional business.
- Zara (CCO) reports the bank's CPF posture to the BRC annually as part of the MLRO annual report (§6.6).

---

## 8. Record-Keeping

### 8.1 Obligation

**Statutory anchor:** FIC Act s.22; FATF Recommendation 11.

Register row: [`ORG-FC-05`](../Regulations/_obligations-register.md).

The bank retains all CDD records and transaction records for a minimum of **five years** after:
- the end of the business relationship (for CDD records); or
- the date of the transaction (for transaction records).

Where the JSE Equities Rules impose a longer retention floor (7 years, per [`ORG-MK-15`](../Regulations/_obligations-register.md)), the longer floor applies — the bank applies the conservative-retention default: where multiple applicable retention requirements overlap, the longest floor binds.

### 8.2 Retention substrate

- **Append-only event store** (Principle 1) — the canonical retention substrate for all typed events. No compaction below the applicable retention floor.
- **Document substrate** (BLAKE3 content-addressed artefacts, D-RMS-PHASE-1 Slice 1) — for identification documents, CDD-evidence packs, beneficial-ownership diagrams, STR investigation files, and submission receipts.
- Retention class `RETENTION_FIC_S22_5Y` binds all FC-domain event types in `prototype/platform/event-store/registry.ts`.

### 8.3 Records available on request

The bank must be able to furnish CDD records and transaction records to the FIC, PA, or any court within a reasonable time on request. The document-substrate architecture supports this by content-addressed retrieval; any event can locate the relevant document artefact by hash reference.

---

## 9. Training

### 9.1 Obligation

**Statutory anchor:** FIC Act s.43; FATF Recommendation 18 (training).

Register row: [`ORG-FC-12`](../Regulations/_obligations-register.md).

The bank provides AML/CFT training to all personnel (including autonomous agents) whose functions expose them to ML/TF/PF risk or to AML/CFT-relevant procedures.

### 9.2 Agent-side training attestation

The bank's labour force is predominantly autonomous AI agents (Principle 6 — autonomous by default). The FIC s.43 training obligation is fulfilled for agents through **agent-substrate attestation**: every AML-touching agent (Mira, Zara, Iris as Information Officer) carries a current-version attestation that its operating spec includes the AML/CFT obligations. Attestation event: `AgentTrainingAttested` (Sade, AgentOps engineer, governance substrate — per `D-THIN-HUMAN-LAYER-MINIMUM`).

### 9.3 Human-side training (licence-day)

At licence-day, the triple-hatted human (MLRO + FIC CO + IO) and the AC-Chair NED (MLRO-alternate) carry FIC-recognised AML/CFT training credentials. Records in document substrate; events `HumanTrainingCompleted`. The training covers:
- FIC Act obligations and the bank's RMCP
- Identification and reporting of suspicious transactions
- Tipping-off prohibition
- Sanctions obligations
- Post-greylisting context and supervisory expectations

---

## 10. Obligations closed by this policy

| Obligation ID | Obligation description | Policy section |
|---|---|---|
| [`ORG-FC-02`](../Regulations/_obligations-register.md) | CDD on all clients; identification and verification before establishing the business relationship | §3.2 |
| [`ORG-FC-03`](../Regulations/_obligations-register.md) | EDD on high-risk relationships (PEPs, foreign correspondents, complex structures) | §3.3, §3.5 |
| [`ORG-FC-04`](../Regulations/_obligations-register.md) | Beneficial ownership verification; recursive resolution to natural persons | §3.4 |
| [`ORG-FC-05`](../Regulations/_obligations-register.md) | Record retention for 5 years after end of relationship or transaction | §8 |
| [`ORG-FC-06`](../Regulations/_obligations-register.md) | Risk-based approach: dispatch CDD intensity on customer risk-rating typology | §2 |
| [`ORG-FC-13`](../Regulations/_obligations-register.md) | Sanctions screening — UNSC, OFAC SDN, EU, UK HMT; zero-appetite RAS B4; block true positives pre-execution | §5 |
| [`ORG-FC-14`](../Regulations/_obligations-register.md) | POCDATARA / DTI Targeted Financial Sanctions screening | §5.2 |
| [`ORG-FC-17`](../Regulations/_obligations-register.md) | Wire transfer originator and beneficiary information accompanies cross-border transfers (FATF Rec. 16) | §4.4 |
| [`ORG-FC-18`](../Regulations/_obligations-register.md) | Continuous-KYC two-tier restriction default (RAS B3 approved) | §3.6 |
| [`ORG-FC-19`](../Regulations/_obligations-register.md) | Recurring KYC periodicity: high → annual, medium → 24 months, low → 36 months (FIC GN 7) | §3.6 |

Cross-reference to MLRO designation obligation: [`ORG-FC-11`](../Regulations/_obligations-register.md) (MLRO designation per FIC s.42A) is closed by the Governance Framework and RMCP §8; the policy section §1.4 cross-references the designation.

---

## 11. Citations

All statutory instruments and guidance cited by exact reference:

**Legislation:**
- Financial Intelligence Centre Act 38 of 2001 ss.21, 21A, 21B, 21C, 21D, 21E, 21F, 21G, 21H, 22, 26B, 28, 28A, 29, 29(3), 29(5), 42, 42A, 43 — file: [`Regulations/FIC/fic-act.md`](../Regulations/FIC/fic-act.md)
- Protection of Constitutional Democracy Against Terrorist and Related Activities Act 33 of 2004 (POCDATARA)
- Financial Sector Regulation Act 9 of 2017
- Banks Act 94 of 1990 (cross-reference for licence-day binding)
- Companies Act 71 of 2008 (cross-reference for BO via company register)
- Trust Property Control Act 57 of 1988 (cross-reference for trust BO resolution)

**FATF Standards:**
- FATF Recommendations (2012, as updated): Recommendations 1, 7, 10, 11, 12, 13, 16, 17, 18, 20, 21, 24, 25, 40

**Guidance Notes:**
- FIC General Notice 7 of 2017 — Guidance Note on the Implementation of the Risk-Based Approach (GN 7)
- FIC Guidance Note 5 — Beneficial Ownership
- FIC Public Compliance Communications (PCCs) as issued

**Supervisory Communications:**
- SARB Prudential Authority AML/CFT/CPF Communication 1 of 2025 (Banks) — register row [`ORG-FC-23`](../Regulations/_obligations-register.md); `[citation: TBC — precise § references per the PDF; Imani (Legal-as-code engineer) + external counsel ratify at licence-application gate per Principle 2]`

**Obligations register:** [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) v1.13 — Domain B (FC-prefix) rows cited inline throughout §§1–9.

**Cross-referenced policies and documents:**
- RMCP attestable spec: [`Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md`](2026-05-10_zara-mira_rmcp-attestable-spec.md)
- Sanctions Policy (IN FORCE per [`ORG-FC-13`](../Regulations/_obligations-register.md))
- KYC / CDD / EDD Policy (IN FORCE per [`ORG-FC-02`](../Regulations/_obligations-register.md))
- PEP Policy (IN FORCE per [`ORG-FC-03`](../Regulations/_obligations-register.md))
- FATCA / CRS Policy (IN FORCE per [`ORG-FC-15`](../Regulations/_obligations-register.md), [`ORG-FC-16`](../Regulations/_obligations-register.md))
- Anti-Bribery & Corruption Policy (IN FORCE per [`ORG-FC-20`](../Regulations/_obligations-register.md))
- POPIA / Privacy Policy — Iris (Information Officer, governance)
- Core policies bundle: [`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md`](2026-05-06_core-policies-compliance-privacy.md)
- `project_strategic_foundation.md` (institutional global-markets dealer; institutional-only)
- `project_indirect_participant_posture.md` (sponsor-bank CMI access; B-cluster FX)
- `D-THIN-HUMAN-LAYER-MINIMUM` (triple-hatted human at licence-day; AC-Chair NED as MLRO-alternate)
- `D-REGULATORY-READINESS-GATE-PLAN` (W1 AML/CFT-RMCP workstream; Slices 2–6)
- `D-RMS-PHASE-1` (event-type registration; document substrate; retention)

**CLAUDE.md:** "Operating procedures" (events-first authoring; dispatch discipline); "Architectural principles" 1, 2, 4, 6.

---

## 12. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-11 | Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) | Initial version. Standalone AML/CFT Policy covering governance (§1), risk-based approach + BWRA (§2), CDD + EDD + BO + PEPs + ongoing KYC (§3), transaction monitoring (§4), sanctions screening (§5), STR / PAR / CTR + tipping-off (§6), post-greylisting obligations + CPF (§7), record-keeping (§8), training (§9). Obligations closed: ORG-FC-02 through ORG-FC-06, ORG-FC-13, ORG-FC-14, ORG-FC-17, ORG-FC-18, ORG-FC-19. LICENCE-BIND. |

---

*Mira (Compliance / RegTech engineer, engineering) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim)*
