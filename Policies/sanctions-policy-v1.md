---
policy-id: sanctions-policy
title: Sanctions Policy v1
version: "1"
status: IN FORCE
owner: Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - FIC Act 38 of 2001 ss.26B, 28A
  - POCDATARA 33 of 2004
  - FATF Recommendation 7
  - PA AML/CFT/CPF Communication 1 of 2025
  - D-POLICY-DOCUMENT-HOME
author: Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim) + Mira (Compliance / RegTech engineer, engineering — reports to Zara)
date: 2026-05-17
summary: Standalone Sanctions Policy governing Hoz Bank Limited's sanctions-screening framework and targeted financial sanctions programme. Covers list maintenance, screening triggers, true-positive blocking, MLRO-signed exception events, Property Association Reports (PARs), proliferation financing (CPF) controls per FATF Rec. 7, and DTI domestic list compliance. Closes obligations ORG-FC-08, ORG-FC-13, ORG-FC-14, ORG-FC-23. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-FC.SA
  - RT-FC.SA.ZA
  - RT-FC.PF
---

# Sanctions Policy v1

> **Status:** IN FORCE (policy layer). Sanctions-screening substrate delivery tracked under W1 Slice 2 of `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).
>
> **Authors:** Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim) is policy owner and MLRO; Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) is engineering owner.
>
> **AML/CFT Policy relationship:** This policy is the dedicated sanctions instrument. The AML/CFT Policy (`Policies/aml-cft-policy-v1.md`) governs the broader ML/TF/PF programme; §5 of the AML/CFT Policy cross-references this policy as the operative sanctions governance document. Neither policy duplicates the other. Where a control requirement appears in both, this policy is the authoritative source for sanctions-specific mechanics; the AML/CFT Policy provides the programme context.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Sanctions Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board Risk Committee (BRC) |
| Policy owner | Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim) |
| Engineering owner | Mira (Compliance / RegTech engineer, engineering — reports to Zara) |
| Review cadence | Annual; triggered by new sanctions programme, FATF Rec. 7 update, PA supervisory communication, or material sanctions incident |
| Risk appetite anchor | RAS B4 — zero appetite for transacting with sanctioned parties; RAS B1 — zero appetite for facilitating financial crime (including proliferation financing) |
| LICENCE-BIND | Yes — sanctions obligations bind from commencement of trading; this policy and its substrate are built to be licence-day ready |
| Obligations closed | [`ORG-FC-08`](../Regulations/_obligations-register.md) (PAR filing — FIC Act s.28A), [`ORG-FC-13`](../Regulations/_obligations-register.md) (UNSC / OFAC SDN / EU / UK HMT — true-positive block + MLRO exception), [`ORG-FC-14`](../Regulations/_obligations-register.md) (POCDATARA / DTI targeted financial sanctions), [`ORG-FC-23`](../Regulations/_obligations-register.md) (PA AML/CFT/CPF Communication 1/2025 — proliferation financing controls per FATF Rec. 7) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's sanctions-screening and targeted financial sanctions (TFS) framework. It governs:

- The maintenance and ingestion of applicable sanctions lists (international and domestic);
- Real-time, pre-execution screening of all customers, counterparties, beneficial owners, and transactions;
- The mandatory blocking of true-positive sanctions matches, with no agent override absent an MLRO-signed exception event logged to the event store;
- Property Association Report (PAR) filing obligations under FIC Act s.28A;
- Targeted Financial Sanctions asset-freeze and FIC-notification obligations;
- Proliferation financing (CPF) controls per FATF Recommendation 7 and the PA AML/CFT/CPF Communication 1 of 2025.

This policy is the operative sanctions governance instrument. It sits within the bank's broader financial-crime programme governed by the RMCP (FIC Act s.42) and the AML/CFT Policy.

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Financial Intelligence Centre Act 38 of 2001 (FIC Act)**, as amended:
  - s.26B — targeted financial sanctions; freezing of property associated with persons designated under POCDATARA or UN Security Council resolutions
  - s.28A — Property Associated with Terrorist and Related Activities Reports (PARs); filing obligation on knowledge or suspicion of association with sanctioned property
  - s.29(3) — tipping-off prohibition (applies equally to sanctions investigations)
  - s.42 — risk management and compliance programme (RMCP)

- **Protection of Constitutional Democracy Against Terrorist and Related Activities Act 33 of 2004 (POCDATARA)**:
  - Targeted Financial Sanctions framework; the DTI/FIC domestic list is a mandatory screening list for South African accountable institutions

- **UN Security Council sanctions regime** (binding under international law; implemented domestically through POCDATARA):
  - UNSC Consolidated Sanctions List (all current sanctions committees and regimes)
  - UNSC Resolution 1718 (2006) Committee — Democratic People's Republic of Korea (DPRK) proliferation financing
  - UNSC Resolution 1267 (1999) / 1989 (2011) / 2253 (2015) Committee — Al-Qaida / Islamic State / Taliban; terrorism financing
  - UNSC Resolution 2231 (2015) — Iran proliferation financing

- **FATF Recommendation 7** — targeted financial sanctions related to proliferation of weapons of mass destruction; screening and freeze obligations

- **SARB Prudential Authority — AML/CFT/CPF Communication 1 of 2025 (Banks)** — proliferation financing controls; PA supervisory expectations on CPF screening quality and list-refresh latency; register row [`ORG-FC-23`](../Regulations/_obligations-register.md)

- **Extraterritorial sanctions programmes** (relevant due to USD-settlement correspondent banking exposure per `project_indirect_participant_posture.md`):
  - OFAC Specially Designated Nationals and Blocked Persons (SDN) List — US Treasury
  - EU Consolidated Financial Sanctions List — European Union
  - UK HMT Consolidated Sanctions List — UK Office of Financial Sanctions Implementation (OFSI)

### 1.3 Entity and personnel scope

This policy applies to:

- **Hoz Bank Limited** — primary scope; all accounts, transactions, products, and services.
- **Hoz Group Limited** — group-level governance; consolidation oversight.
- **Hoz Securities Limited** — upon FAIS-FSP authorisation (per `D-FSP-LICENCE-NECESSITY`), sanctions obligations apply on the same multi-entity basis.

All of the following are subject to screening under this policy:

- All customers (legal entities and, at licence-day, natural persons)
- All beneficial owners, controlling natural persons, and authorised representatives
- All directors, officers, and principals of counterparties
- All agents, correspondents, and introducers
- All counterparties to any transaction regardless of ticket size
- All correspondent banks and sponsor banks

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner / MLRO / sanctions decision authority | Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim) | FIC s.42A; ORG-FC-11; sole internal authority to approve MLRO-signed exception events for sanctions overrides |
| Engineering owner | Mira (Compliance / RegTech engineer, engineering — reports to Zara) | W1 Slice 2 of D-REGULATORY-READINESS-GATE-PLAN; sanctions-screening pipeline; list ingestion; resolution queue |
| Settlement substrate owner | Tomas (Payments / Settlement engineer, engineering — reports to Helena, CRO) | Executes freeze actions as typed events in the settlement substrate; no settlement override capability for sanctions blocks |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | Annual effectiveness review; recon:sanctions-* harnesses |
| Legal coordination | Imani (Legal-as-code engineer, engineering — reports to Zara CCO) | External-counsel coordination on OFAC/extraterritorial hits; clause-library hooks |
| Board oversight | BRC (Board Risk Committee) — receives quarterly exception log; approves this policy | Governance Framework |

**MLRO decision authority.** Only the MLRO (Zara) can sign an exception event that permits a sanctioned-entity match to proceed. This authority cannot be delegated to any other agent or person without a formal `MlroDelegationApproved` event co-signed by the CEO and BRC Chair.

### 1.5 Policy hierarchy

```
UN Security Council Resolutions / POCDATARA / FIC Act s.26B, s.28A
    └── RMCP (FIC s.42; Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md)
        └── AML/CFT Policy (broader financial-crime programme)
        └── Sanctions Policy (this document — dedicated sanctions governance)
            └── Operational procedures (Procedures/by-policy/sanctions-*.md)
                └── Substrate engineering (W1 Slice 2)
```

Every node cites upward per Principle 2 (single-graph discipline).

### 1.6 Approval, review, and amendment

- **Initial approval:** Board Risk Committee, 2026-05-17.
- **Annual review:** Zara-led, no later than 12 months after the preceding approval date.
- **Triggered review:** any new UNSC sanctions regime, material OFAC/EU/HMT designation list change, PA supervisory communication on CPF, FATF Rec. 7 revision, or material sanctions incident triggers a policy review within 20 agent-cadence days.
- **Amendment discipline:** all policy amendments are typed `PolicyAmended` events (Principle 1). The markdown is a render of the event; the event is canonical.

---

## 2. Sanctions Lists and List Maintenance

### 2.1 Active screening lists

The following lists are mandatory screening lists. All are ingested by Mira's sanctions-screening pipeline (W1 Slice 2). On each update the pipeline emits a `SanctionsListPublished` event (event-type registered in `prototype/platform/event-store/registry.ts`). Receipt of a `SanctionsListPublished` event automatically triggers re-screening of the full client book and any open transactions.

| List | Issuer | Category | Refresh window |
|---|---|---|---|
| UN Security Council Consolidated Sanctions List | UN SC Sanctions Committees (all) | International sanctions + proliferation financing | ≤ 24 hours from UN publication |
| UNSC 1718 Committee List (DPRK) | UN SC 1718 Committee | Proliferation financing — DPRK | ≤ 24 hours from UN publication |
| UNSC 1267/1989/2253 Committee List (Al-Qaida/IS/Taliban) | UN SC 1267 Committee | Terrorism financing + sanctions | ≤ 24 hours from UN publication |
| UNSC 2231 Annex (Iran) | UN SC 2231 Committee | Proliferation financing — Iran | ≤ 24 hours from UN publication |
| OFAC Specially Designated Nationals (SDN) and Blocked Persons | US Treasury OFAC | Extraterritorial; USD-settlement risk | ≤ 24 hours from OFAC publication |
| EU Consolidated Financial Sanctions List | European Union | Extraterritorial; EUR and EU counterparty exposure | ≤ 24 hours from EU publication |
| UK HMT / OFSI Consolidated Sanctions List | UK OFSI / His Majesty's Treasury | Extraterritorial; GBP and UK counterparty exposure | ≤ 24 hours from OFSI publication |
| POCDATARA / DTI Domestic TFS List | SA DTI / FIC | Domestic mandatory; POCDATARA designations | ≤ 24 hours from DTI/FIC publication |
| FATF High-Risk and Other Monitored Jurisdictions (black/grey lists) | FATF | Jurisdiction-level risk; used in EDD calibration + CPF screening | On each FATF plenary update (approximately quarterly) |

### 2.2 List version tracking

Every list update must be captured as a `SanctionsListPublished` event with:
- `listName` — the canonical list identifier
- `listVersion` — the issuer's version stamp or publication date
- `ingestionTimestamp` — when the pipeline ingested the update
- `recordCount` — count of designated entities in the updated list
- `contentHash` — BLAKE3 hash of the raw list file, stored in the document substrate

Mira (Compliance / RegTech engineer) certifies each ingestion event. The `recon:sanctions-list-currency` recon (W1 Slice 2) asserts that every active list has a `SanctionsListPublished` event within the per-list refresh window. Breach of the refresh window is a **High** finding reported to the MLRO and Vera within 4 hours.

### 2.3 CPF-specific list maintenance

Proliferation financing lists (UNSC 1718/DPRK, UNSC 1267/Al-Qaida, UNSC 2231/Iran) are maintained separately within the sanctions-screening pipeline with a dedicated CPF flag on each designated-entity record. This enables Mira and Vera to produce CPF-specific screening metrics for the MLRO annual report and for the PA AML/CFT/CPF Communication 1/2025 supervisory evidence package.

### 2.4 Extraterritorial list rationale

The bank does not operate under US, EU, or UK jurisdiction. However:

- **USD correspondent settlement** creates OFAC nexus: any USD-denominated transaction processed through a US correspondent is subject to OFAC jurisdiction regardless of the bank's domicile. Failure to screen against SDN before USD payments is an OFAC violation exposure for the correspondent — and the correspondent's sanctions clauses in the correspondent banking agreement require the bank to certify pre-screening.
- **EUR and GBP transactions** create equivalent EU and UK OFSI nexus respectively.
- **Correspondent banking agreement obligations:** the bank's correspondent banking agreements (governed by Tomas (Payments / Settlement engineer) and Imani (Legal-as-code engineer)) include sanctions warranties. Breach of those warranties is a default event that would suspend correspondent access and directly impair trading capability.

On this basis, OFAC, EU, and UK HMT lists are maintained and screened as if mandatory — consistent with the zero-appetite RAS B4 posture.

---

## 3. Sanctions Screening Framework

### 3.1 Screening obligation

The bank screens all customers, beneficial owners, counterparties, and transactions on a real-time, pre-execution basis. **No transaction reaches execution state without a current `SanctionsScreeningCompleted` event confirming no unresolved true-positive match.**

Register rows: [`ORG-FC-13`](../Regulations/_obligations-register.md), [`ORG-FC-14`](../Regulations/_obligations-register.md), [`ORG-FC-23`](../Regulations/_obligations-register.md).

### 3.2 Screening triggers

Sanctions screening runs at the following points, each emitting a `SanctionsScreeningInitiated` event followed by a `SanctionsScreeningCompleted` event (or `SanctionsTruePositiveBlocked` on a true-positive hit):

| Trigger | Scope | Timing |
|---|---|---|
| Customer / counterparty onboarding | Entity + all beneficial owners + all authorised representatives + all directors | Before `ClientCddCompleted` is emitted; admission to client master is blocked absent a clean screen |
| List update (on `SanctionsListPublished` event) | Full client book re-screen against updated list | Within 24 hours of the `SanctionsListPublished` event timestamp |
| Material change to counterparty record | The changed entity + related natural persons | Within 24 hours of the change event (e.g. `ClientBeneficialOwnerChanged`) |
| Transaction pre-execution | Counterparty (payer + payee + correspondent chain) | Real-time; blocking is pre-execution; no transaction is executed with an unresolved screen |
| Ad hoc | Any entity or transaction on MLRO request or FIC directive | Within the timeframe specified in the request |
| Periodic full-book sweep | All active clients | At a minimum, weekly; configurable by Mira |

### 3.3 Name-matching methodology

The screening engine applies **fuzzy-matching with configurable similarity thresholds** to accommodate:
- Name transliteration differences (e.g. Arabic, Cyrillic, Chinese)
- Name-component ordering differences (surname-first vs given-name-first)
- Abbreviated and shortened names
- Historical and alias names (including maiden names, prior trading names, and AKAs on the sanctioned-entity record)
- Entity-type variants (Ltd vs Limited vs LLC)

**Tuning discipline.** The similarity threshold is a calibrated parameter managed by Mira. It is set to a level that:
- Produces a false-negative rate consistent with the zero-appetite RAS B4 posture (i.e. if in doubt, flag);
- Manages the false-positive volume to a level the resolution queue can clear within the per-SLA windows (§3.5).

Threshold changes are typed `SanctionsScreeningRuleUpdated` events, approved by the MLRO before taking effect.

### 3.4 True-positive match: mandatory block

When the screening engine identifies a true-positive match, it emits `SanctionsTruePositiveBlocked`. The following consequences are automatic and immediate:

1. **Transaction or onboarding blocked.** The event triggers an automatic pre-execution block in the markets substrate and the onboarding substrate. No further processing occurs until the block is explicitly lifted by the MLRO-signed exception pathway (§3.6) or resolved as a false positive (§3.5).

2. **MLRO notification.** Zara (MLRO) is notified by `SanctionsTruePositiveBlocked` within 1 hour. Notification is a typed event; no unstructured messaging channel substitutes.

3. **Freeze action.** Where the sanctioned party holds or has associated funds at the bank, Tomas (Payments / Settlement engineer) executes an asset freeze via a typed `SanctionsFreezeApplied` event in the settlement substrate. The freeze is irreversible without either:
   - An MLRO-signed exception event (§3.6), or
   - Written FIC or court authorisation.

4. **PAR initiation.** Zara opens a PAR investigation via `ParInvestigationOpened` event. See §4 for the PAR filing workflow.

5. **No client disclosure.** The tipping-off prohibition (FIC s.29(3)) applies. No agent, system, or person informs the affected client of the block, the screening hit, or the PAR investigation.

**Absolute rule:** no human or agent override of a true-positive block is permitted except via the MLRO-signed exception pathway in §3.6. Any code path, workflow, or instruction that bypasses this rule is a Critical security and compliance incident (`CriticalIncidentRaised`), reported immediately to Vera, Thandiwe, and the BRC Chair.

### 3.5 False-positive resolution

Where Mira (Compliance / RegTech engineer) or Zara (MLRO) determines that a match is a false positive:

1. **Mira prepares a false-positive determination.** The determination documents:
   - The entity screened and the matching sanctioned-entity record
   - The distinguishing factors that confirm the match is not the same person/entity (e.g. different date of birth; different nationality; different country of incorporation; different address; different name spelling confirmed by identity documentation)
   - Supporting documentary evidence held in the document substrate (BLAKE3 artefact reference)

2. **MLRO review and approval.** Zara (MLRO) reviews Mira's determination and either:
   - Approves: emits `SanctionsFalsePositiveDismissed` event; the block is lifted; the client or transaction proceeds.
   - Escalates: treats the match as a true positive; proceeds under §3.4.

3. **SLA.** False-positive resolution must be completed within **1 business day** of the initial `SanctionsTruePositiveBlocked` event. Breach of this SLA is a High finding to Vera.

4. **Pattern tracking.** Mira logs false-positive patterns quarterly. Where a pattern indicates systematic over-screening, Mira proposes a threshold adjustment (typed `SanctionsScreeningRuleUpdated` event; MLRO approval required before any change takes effect).

5. **No client disclosure.** Even on false-positive resolution, the tipping-off prohibition (FIC s.29(3)) applies.

### 3.6 MLRO-signed exception — narrow scope

The absolute block rule (§3.4) has one and only one permissible exception pathway:

**Permissible exception scenario:** a supervisory authority (FIC, PA, OFAC, OFSI, or competent EU authority) has provided **written guidance** confirming that:
- the matched entity was incorrectly designated, or
- a specific humanitarian or governmental licence applies and covers the proposed transaction.

**Exception process:**
1. Zara (MLRO) obtains the written supervisory authority guidance; the document is uploaded to the document substrate and its BLAKE3 hash is recorded.
2. Zara emits a `MlroSanctionsOverrideApproved` event citing:
   - The `SanctionsTruePositiveBlocked` event ID being overridden
   - The `listName` and `designatedEntityId` of the matched record
   - The BLAKE3 hash of the supervisory authority document
   - The narrow scope of the exception (specific transaction ID or onboarding ID only; not a blanket override)
   - The MLRO's digital-identity signature (per the identity substrate)
3. Tomas (Payments / Settlement engineer) can only lift the freeze or permit the transaction on receipt of the `MlroSanctionsOverrideApproved` event with a valid MLRO signature. No unsigned or text-only instruction is accepted by the settlement substrate.
4. The exception is reported to the BRC at the next quarterly meeting.

**No emergency override.** There is no emergency, time-pressure, or business-urgency exception to the above pathway. Loss of revenue from a blocked transaction is not a permissible justification for bypassing the process.

---

## 4. Property Association Reports (PARs)

### 4.1 PAR obligation

**Statutory anchor:** FIC Act s.28A.

Register row: [`ORG-FC-08`](../Regulations/_obligations-register.md).

The bank files a Property Associated with Terrorist and Related Activities Report (PAR) with the Financial Intelligence Centre (FIC) when it knows or suspects that it holds, controls, or is in any way associated with property linked to terrorist or related activities — including property associated with a UNSC-designated or POCDATARA/DTI-designated person or entity.

**Trigger for PAR filing:** a confirmed `SanctionsTruePositiveBlocked` event where the screened entity is associated with funds, securities, or other property held by or on behalf of the bank.

### 4.2 PAR filing workflow

On a confirmed `SanctionsTruePositiveBlocked` event that triggers PAR filing:

1. **PAR investigation opens.** Zara opens `ParInvestigationOpened` event. Mira assembles the relevant records: client identity; account details; value and nature of the property; history of the banking relationship; the `SanctionsTruePositiveBlocked` event record.

2. **PAR preparation.** The PAR is prepared in the format required by the FIC (goAML format). The PAR must include:
   - Full particulars of the property, its holder, and its location in the bank's custody/control
   - The grounds for the association finding
   - The list name(s) and designated-entity record(s) that triggered the hit
   - Date the association was identified

3. **Filing window.** The PAR is filed with the FIC **as soon as practicable** and **within 5 business days** of the bank forming the knowledge or suspicion of the property association. The `recon:par-5-day-window` recon (W1 Slice 4) asserts the delta between `SanctionsTruePositiveBlocked` and `ParFiled` is ≤ 5 business days. Breach is a Critical compliance incident.

4. **Filing via goAML.** The PAR is submitted through the bank's goAML harness, which emits a `GoAmlReportSubmitted` event on successful transmission. Idempotent submission: the same PAR reference may not be submitted twice.

5. **FIC acknowledgement.** The FIC's acknowledgement reference number is stored in the event payload and in the document substrate.

6. **Record-keeping.** The PAR, its supporting investigation file, and the goAML submission receipt are retained for a minimum of 5 years per FIC s.22. Retention class: `RETENTION_FIC_S22_5Y`.

### 4.3 Tipping-off prohibition — PAR

As with STR investigations (per the AML/CFT Policy §6.4), the tipping-off prohibition (FIC s.29(3)) applies to all PAR investigations and to all sanctions blocks that trigger a PAR. No agent, system, or person discloses to the affected client:

- That their account or funds have been blocked
- That a sanctions hit has occurred
- That a PAR investigation has been opened
- That a PAR has been filed with the FIC

All events in the PAR investigation set (`ParInvestigationOpened`, `ParFiled`, `GoAmlReportSubmitted` for PARs) are encrypted under the MLRO-held key envelope (identity substrate; same envelope as MLRO STR investigations). Vera's `recon:tipping-off-inference` asserts no projection or dashboard exposes inference of a PAR investigation.

---

## 5. Targeted Financial Sanctions

### 5.1 TFS obligation and framework

**Statutory anchors:** FIC Act s.26B; POCDATARA 33 of 2004; UNSC resolutions (implemented via POCDATARA domestically).

Register rows: [`ORG-FC-14`](../Regulations/_obligations-register.md), [`ORG-FC-13`](../Regulations/_obligations-register.md).

Targeted Financial Sanctions (TFS) are the mandatory freeze-and-report obligations that apply on designation of an individual or entity by a competent authority (UNSC, DTI, FIC, or equivalent extraterritorial authority). TFS is distinct from general sanctions screening in that:

- **General sanctions screening** (§3) identifies matches pre-transaction to prevent execution.
- **TFS** applies to existing customers and assets already in the bank's custody — an existing client who becomes designated during the banking relationship must have their assets frozen immediately on the `SanctionsListPublished` event that carries the new designation.

### 5.2 TFS asset-freeze procedure

On detection of a designation event for an existing client (triggered by the list-update re-screen in §3.2):

1. **`SanctionsTruePositiveBlocked` emitted** for the existing client; all accounts, credit facilities, and pending transactions blocked.

2. **Freeze action.** Tomas (Payments / Settlement engineer) emits `SanctionsFreezeApplied` in the settlement substrate. The freeze applies to:
   - All cash balances held by or on behalf of the designated person/entity
   - All securities positions held in custody for the designated person/entity
   - Any pending settlement legs for the designated person/entity

3. **Freeze is permanent** until either:
   - An MLRO-signed exception event (§3.6) supported by supervisory written authority, or
   - A formal de-listing of the entity from the applicable sanctions list (typed `SanctionsListPublished` event removing the designation), confirmed by Mira, or
   - A court order lifting the freeze.

4. **FIC notification.** On any TFS freeze action, the bank notifies the FIC within **24 hours** as required under FIC s.26B. The notification is a typed `FicTfsNotificationFiled` event with the submission reference number stored in the document substrate.

5. **PAR filing.** Where the frozen property represents a confirmed association with terrorist or related activities, a PAR is filed in parallel per §4.

### 5.3 TFS POCDATARA / DTI list

The POCDATARA/DTI domestic list is a domestic-law mandatory screening list. All SA accountable institutions must screen against it. Processing rules are identical to §5.2 for any DTI-listed entity. The bank gives the DTI list the same priority as UNSC lists in terms of refresh windows and screening triggers.

**DTI list refresh note.** The DTI list is published irregularly. Mira monitors the DTI/FIC portal for updates; any gap > 7 days without a `SanctionsListPublished` event for the DTI list triggers a manual check and a High finding to Vera.

---

## 6. Proliferation Financing Controls

### 6.1 CPF obligation

**Statutory anchor:** FATF Recommendation 7; PA AML/CFT/CPF Communication 1 of 2025.

Register row: [`ORG-FC-23`](../Regulations/_obligations-register.md).

Proliferation financing (PF / CPF) is the financing of the proliferation of weapons of mass destruction (WMDs), including nuclear, chemical, biological, and radiological weapons. FATF Recommendation 7 requires banks to implement Targeted Financial Sanctions related to proliferation financing. The PA AML/CFT/CPF Communication 1 of 2025 sets supervisory expectations for South African banks on the quality and completeness of their CPF controls.

The bank's risk appetite for proliferation financing is **zero** — identical to the zero appetite for sanctions violations generally (RAS B4).

### 6.2 CPF screening lists

CPF screening runs in parallel with the general sanctions screening pipeline. The dedicated CPF lists are:

| List | Regime | Proliferation nexus |
|---|---|---|
| UNSC 1718 Committee List | DPRK | Primary FATF Rec. 7 target; nuclear, ballistic missile, and WMD proliferation |
| UNSC 1267/1989/2253 Committee List | Al-Qaida / Islamic State / Taliban | Terrorism financing with proliferation nexus |
| UNSC 2231 Annex (Iran) | Iran | Nuclear proliferation financing; ballistic missile programme |
| OFAC SDN (proliferation-designated entities) | US Treasury OFAC | OFAC-designated proliferation financing networks |
| EU Consolidated (proliferation-designated entities) | European Union | EU-designated proliferation financing networks |

Every entity in the CPF lists is also in the general sanctions lists (§2.1). The separate CPF flag enables:
- CPF-specific reporting metrics for the MLRO and BRC
- CPF-specific supervisory evidence for PA AML/CFT/CPF Communication 1/2025

### 6.3 CPF-specific controls

In addition to the general sanctions-screening controls (§3), the following CPF-specific controls apply:

1. **CPF typology awareness.** The transaction-monitoring rules (AML/CFT Policy §4.2) include CPF-specific scenarios as advised by FATF guidance on PF typologies (dual-use goods sectors, freight forwarding, commodity trading, financial intermediation for high-risk jurisdictions). Mira updates the CPF-typology rule set on each FATF Rec. 7 guidance update.

2. **BWRA CPF module.** The Business-Wide Risk Assessment (AML/CFT Policy §2.3) includes a CPF risk assessment module covering the bank's product set, counterparty base, and geographic corridors. The institutional-only model substantially reduces CPF exposure; the assessment is nonetheless maintained and updated annually.

3. **EDD on CPF-relevant counterparties.** Any counterparty with nexus to a FATF-identified CPF high-risk jurisdiction (DPRK, Iran, or FATF-designated equivalent) triggers EDD per the AML/CFT Policy §3.3 regardless of the computed risk rating. Zara approves all such EDD onboardings.

4. **Annual CPF review.** Zara includes CPF-specific metrics in the MLRO annual report to the BRC: number of CPF-specific screening hits; false-positive and true-positive resolution rates for CPF lists; any CPF typology intelligence updates ingested during the year.

5. **FATF Rec. 7 evidence package.** Mira (Compliance / RegTech engineer) maintains a standing FATF Rec. 7 evidence package as a document-substrate artefact. The package maps each FATF Rec. 7 criterion to the bank's control, the substrate implementation status, and the evidence artefact. Updated at each FATF Rec. 7 guidance update and each PA Communication.

---

## 7. Controls and Monitoring

### 7.1 Automated screening controls

Mira's sanctions-screening module (W1 Slice 2) provides the following automated controls:

- **Real-time pre-execution screening** on every `Transaction*` event
- **Daily full-book sweep** of all active clients
- **24-hour re-screen** triggered by each `SanctionsListPublished` event
- **List version tracking** with `recon:sanctions-list-currency` asserting refresh-window compliance
- **Alert queue** for all fuzzy-match results above the false-positive threshold; presented to Mira for triage

### 7.2 MLRO monthly review

Zara (MLRO) conducts a monthly review of:

- The exception event log (`MlroSanctionsOverrideApproved` events) — verifying that each exception is within the narrow permissible scope (§3.6)
- The false-positive resolution log — reviewing Mira's dismissal determinations for quality
- The PAR and TFS notification log — verifying filing windows are met
- Screening effectiveness metrics: false-positive rate per list, resolution SLA compliance, list-refresh latency

The monthly review is a typed `MlroSanctionsMonthlyReview` event. Material concerns are escalated to the BRC.

### 7.3 Vera independent assurance

Vera (Internal audit / continuous-assurance engineer) conducts an **annual effectiveness review** of the sanctions programme, examining:

- List currency: `recon:sanctions-list-currency` findings
- Pre-execution screening coverage: `recon:sanctions-screening-coverage` asserts every executed `Transaction*` event has a paired `SanctionsScreeningCompleted` event with no unresolved true-positive flag
- Exception quality: every `MlroSanctionsOverrideApproved` event is reviewed for compliance with §3.6
- PAR filing timeliness: `recon:par-5-day-window` findings
- TFS notification timeliness: `recon:fic-tfs-notification-24h` asserts FicTfsNotificationFiled within 24 hours of SanctionsFreezeApplied
- Tipping-off inference: `recon:tipping-off-inference` asserts no projection exposes PAR or sanctions-hit state

### 7.4 Key metrics and SLAs

| Metric | SLA / target | Breached-SLA classification |
|---|---|---|
| List refresh window | ≤ 24 hours (all non-DTI lists); ≤ 24 hours (DTI) | High finding; MLRO notification within 4 hours |
| Post-list-update client re-screen | ≤ 24 hours | High finding |
| True-positive MLRO notification | ≤ 1 hour from `SanctionsTruePositiveBlocked` | Critical finding |
| False-positive resolution | ≤ 1 business day | High finding |
| PAR filing | ≤ 5 business days from knowledge/suspicion | Critical finding |
| TFS FIC notification | ≤ 24 hours from `SanctionsFreezeApplied` | Critical finding |

---

## 8. Escalation

### 8.1 True-positive escalation

On confirmed `SanctionsTruePositiveBlocked`:

1. **MLRO (Zara) — immediately** (within 1 hour). Zara leads the investigation, PAR filing determination, and freeze co-ordination with Tomas.

2. **CEO (Marc) — same business day** if the true positive involves a material counterparty or systemic exposure (e.g. a major counterparty is designated; the freeze impacts a significant proportion of trading positions).

3. **BRC Chair — within 24 hours** of any true positive that results in a PAR filing or TFS freeze action.

### 8.2 OFAC / extraterritorial jurisdiction escalation

A confirmed OFAC/EU/HMT true positive additionally triggers:

1. **External counsel notification** — Imani (Legal-as-code engineer) coordinates. Extraterritorial sanctions carry direct liability for the correspondent bank (which may suspend correspondent access); external counsel advice is required within 24 hours.
2. **Correspondent bank notification protocol** — Tomas (Payments / Settlement engineer) reviews whether any pending USD/EUR/GBP settlement legs require urgent correspondent notification per the sanctions warranty provisions of the correspondent banking agreement.

### 8.3 Systemic exposure

If the MLRO (Zara) determines that a sanctions-list update reveals systemic exposure (i.e. multiple clients or significant portions of the loan/trading book are potentially designated):

1. **CEO notification — immediate.**
2. **BRC emergency session** — convened within 2 business days.
3. **Vera escalation** — Vera initiates an urgent review of the screening programme and produces a findings report within 5 business days.

### 8.4 Material list change

On any FATF plenary update that moves a significant jurisdiction on/off the grey or black list:

1. Mira ingests the updated FATF list within the refresh window.
2. Mira briefs Zara (MLRO) on the implications for the client book (jurisdictions represented in the counterparty base, EDD requirements, CPF risk).
3. Where the change affects more than 5% of active counterparties' jurisdiction status, Zara briefs the CEO.

---

## 9. Related documents

### 9.1 Cross-referenced policies

- **AML/CFT Policy v1** (`Policies/aml-cft-policy-v1.md`) — the broader financial-crime programme; §5 of the AML/CFT Policy cross-references this Sanctions Policy as the operative sanctions instrument.
- **KYC / CDD / EDD Policy** (per [`ORG-FC-02`](../Regulations/_obligations-register.md)) — CDD procedures for sanctions-flagged onboarding.
- **RMCP** (`Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md`) — the overarching s.42 risk management and compliance programme; this policy is a subsidiary instrument.
- **Governance Framework** — BRC approval authority; MLRO designation.

### 9.2 Procedures

- `Procedures/by-policy/sanctions-screening-procedure.md` — step-by-step agent-executable procedure for list ingestion, pre-execution screening, true-positive block, false-positive resolution (planned, W1 Slice 2)
- `Procedures/by-policy/sanctions-par-filing-procedure.md` — PAR investigation opening, preparation, and goAML submission (planned, W1 Slice 4 + Slice 6)
- `Procedures/by-policy/sanctions-tfs-freeze-procedure.md` — TFS freeze action, FIC notification, and freeze-lift conditions (planned, W1 Slice 2)

### 9.3 Obligations register

All obligations closed by this policy are recorded in [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md):

| Obligation ID | Obligation description | Sections in this policy |
|---|---|---|
| [`ORG-FC-08`](../Regulations/_obligations-register.md) | Property Association Reports — FIC Act s.28A — file within 5 days of association discovery | §4 |
| [`ORG-FC-13`](../Regulations/_obligations-register.md) | Sanctions screening — UNSC / OFAC SDN / EU / UK HMT — block all true positives pre-execution; MLRO-signed exception event for override | §2, §3 |
| [`ORG-FC-14`](../Regulations/_obligations-register.md) | POCDATARA + FIC Act — Targeted Financial Sanctions per DTI list | §5 |
| [`ORG-FC-23`](../Regulations/_obligations-register.md) | PA AML/CFT/CPF Communication 1 of 2025 — proliferation financing controls per FATF Rec. 7; CPF screening | §6 |

### 9.4 Citations

**Legislation:**
- Financial Intelligence Centre Act 38 of 2001 ss.26B, 28A, 29(3), 42, 42A — [`Regulations/FIC/fic-act.md`](../Regulations/FIC/fic-act.md)
- Protection of Constitutional Democracy Against Terrorist and Related Activities Act 33 of 2004 (POCDATARA)
- Financial Sector Regulation Act 9 of 2017
- Banks Act 94 of 1990 (cross-reference for licence-day binding)

**FATF Standards:**
- FATF Recommendation 7 (targeted financial sanctions related to proliferation of WMDs)
- FATF Guidance on Proliferation Financing Risk Assessment and Mitigation (2021, updated)

**UNSC Resolutions:**
- UNSC Resolution 1267 (1999), 1989 (2011), 2253 (2015) — Al-Qaida / Islamic State / Taliban
- UNSC Resolution 1718 (2006) — DPRK
- UNSC Resolution 2231 (2015) — Iran (JCPOA framework)

**Supervisory Communications:**
- SARB Prudential Authority AML/CFT/CPF Communication 1 of 2025 (Banks) — register row [`ORG-FC-23`](../Regulations/_obligations-register.md) — `[citation: TBC — precise § references per the PDF; Imani (Legal-as-code engineer) + external counsel ratify at licence-application gate per Principle 2]`

**Extraterritorial programmes (reference only; no SA-law force, but binding via correspondent agreements):**
- OFAC SDN programme — 31 CFR Chapter V
- EU Financial Sanctions framework — Council Regulations as applicable
- UK OFSI / HMT sanctions framework — Sanctions and Anti-Money Laundering Act 2018

**Decisions:**
- `D-POLICY-DOCUMENT-HOME` — canonical home for policy documents
- `D-REGULATORY-READINESS-GATE-PLAN` — W1 Slice 2 (sanctions-screening substrate)
- `D-RMS-PHASE-1` — event-type registration; document substrate; retention

**Obligations register:** [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — Domain B (FC-prefix) rows cited inline throughout.

**CLAUDE.md:** "Operating procedures" (events-first authoring; dispatch discipline); "Architectural principles" 1, 2, 4, 6.

---

## 10. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim) + Mira (Compliance / RegTech engineer, engineering — reports to Zara) | Initial version. Standalone Sanctions Policy covering governance (§1), list maintenance (§2), screening framework (§3), PARs (§4), TFS (§5), CPF / FATF Rec. 7 controls (§6), controls and monitoring (§7), escalation (§8), related documents (§9). Obligations closed: ORG-FC-08, ORG-FC-13, ORG-FC-14, ORG-FC-23. LICENCE-BIND. |

---

*Zara (Chief Compliance Officer, governance — acting MLRO + FIC Compliance Officer interim) + Mira (Compliance / RegTech engineer, engineering — reports to Zara)*
