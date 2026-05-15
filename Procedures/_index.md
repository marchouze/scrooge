# Procedures library — index

**Curators:** Domain leads · Owen (procedural-discipline custodian) · Mira (citation linkage)
**As-of:** 2026-05-06

> Master inventory of every procedure under each approved policy. Each row demonstrates the **Reg → Policy → Procedure → System Capability** chain. Status: **`POPULATED`** = procedure file authored; **`STUB`** = file scaffolded; **`PLANNED`** = identified but not yet drafted.

## Foundation & meta-policies

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Risk Management Framework | `procedures-rmf-governance.md` | Helena | PLANNED |
| Governance Framework | `procedures-board-papers.md` | Owen | PLANNED |
| Delegation of Authority | [`delegation-of-authority.md`](by-policy/delegation-of-authority.md) (PROC-GV-DOA-01 — four authority levels; Board-reserved matters; agent Level 4 limits; `EscalationRequired` path) | Owen + Devon | **POPULATED** |

## Risk

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Credit Risk Policy | `credit-origination.md` | Helena (future Head of Credit) | PLANNED |
| Market Risk Policy | [`market-risk-monitoring.md`](by-policy/market-risk-monitoring.md) (PROC-RISK-MRM-01 — daily VaR/ES limit monitoring, FRTB back-testing, PLA test, prop-trading attestation) | Helena (CRO, governance) · Rohan (market risk quant, engineering) | **POPULATED** |
| Liquidity Risk Management Policy | [`capital-ratio-monitoring.md`](by-policy/capital-ratio-monitoring.md) (covers LCR / NSFR) | Camille + Eitan | **POPULATED** |
| Liquidity Risk Management Policy | [`intraday-liquidity-funding.md`](by-policy/intraday-liquidity-funding.md) (PROC-RISK-ILF-01 — intraday liquidity position monitoring; BCBS seven metrics; correspondent bank funding facility; ALCO and ILAAP integration) | Eitan (treasury & ALM engineer) · Ravi (ALM quant engineer) · Helena (CRO, governance) | **POPULATED** |
| IRRBB Policy | [`irrbb-measurement.md`](by-policy/irrbb-measurement.md) (PROC-RISK-IRRBB-01 — monthly NII/EVE; six BCBS shock scenarios; PA outlier test; ALCO governance; ILAAP chapter) | Helena (CRO, governance) · Eitan (treasury & ALM engineer) · Ravi (ALM quant engineer) | **POPULATED** |
| Operational Risk Policy | [`rcsa-cycle.md`](by-policy/rcsa-cycle.md) (PROC-RISK-RCSA-01) | Helena + Devon | **POPULATED** |
| Operational Resilience Policy | [`severe-but-plausible-test.md`](by-policy/severe-but-plausible-test.md) (PROC-OR-SBP-01 — annual SBP scenario test; five IBS; four scenario types; tabletop facilitation; BRC + Board approval; PA self-assessment) | Devon (COO, governance) · Helena (CRO, governance) | **POPULATED** |
| Model Risk Policy | [`model-validation.md`](by-policy/model-validation.md) (PROC-RSK-MV-01 — model inventory; Tier 1/2/3 classification; annual validation cycle; production-eligibility gate; `ValidationCycleSigned` event) | Helena (CRO, governance) · Nadia (model validation engineer) | **POPULATED** |
| Stress Testing Policy | [`stress-test-cycle.md`](by-policy/stress-test-cycle.md) (PROC-RISK-ST-01 — annual baseline + adverse + reverse stress; ICAAP/ILAAP; Recovery Plan feed) | Helena (CRO, governance) · Camille (CFO, governance) | **POPULATED** |
| Climate-Related Risk | [`climate-scenario-analysis.md`](by-policy/climate-scenario-analysis.md) (PROC-RISK-CSA-01 — annual four-NGFS-scenario analysis; TCFD four-pillar disclosure; ICAAP/ILAAP integration; PA Guidance Note 3/2022) | Helena (CRO, governance) · Devon (COO, governance) | **POPULATED** |

## Compliance & financial crime

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| RMCP | [`rmcp-annual-attestation.md`](by-policy/rmcp-annual-attestation.md) (PROC-COMP-RMCP-01 — FIC Act s.42 annual RMCP attestation; control-effectiveness scoring; governance-body sign-off; FIC submission) | Zara (CCO, governance) · Mira (regulatory intelligence engineer) | **POPULATED** |
| AML / CFT Policy | [`transaction-monitoring.md`](by-policy/transaction-monitoring.md) (PROC-FC-TM-01 — continuous rule-engine scoring, alert triage, MLRO escalation) | Zara (Mira) | **POPULATED** |
| Sanctions Policy | [`sanctions-screening.md`](by-policy/sanctions-screening.md) | Zara (Mira) + Senna | **POPULATED** |
| Sanctions Policy | [`sanctions-override.md`](by-policy/sanctions-override.md) (PROC-FC-SO-01 — false-positive override + controlled-exit for newly designated clients; MLRO-only cryptographic sign-off; FIC/DPCI notification; PAR filing) | Zara (Chief Compliance Officer, governance) — MLRO | **POPULATED** |
| KYC / CDD / EDD Policy | [`kyc-onboarding.md`](by-policy/kyc-onboarding.md) | Zara (Mira) | **POPULATED** |
| KYC / CDD / EDD Policy | [`kyc-recurring.md`](by-policy/kyc-recurring.md) (PROC-FC-KYC-R-01 — annual/6-monthly/event-triggered CDD refresh; UBO re-walk; EDD for high-risk/PEP; MLRO escalation; `KYCRefreshCompleted` chain) | Zara (Mira) | **POPULATED** |
| KYC / CDD / EDD Policy | [`kyc-continuous.md`](by-policy/kyc-continuous.md) (PROC-FC-KYC-C-01 — event-triggered CDD; signal ingestion; severity classification Low/Medium/High/Critical; EDD on High/Critical; MLRO escalation; relationship-exit path) | Zara (Chief Compliance Officer, governance) · Mira (Regulatory intelligence engineer, compliance) | **POPULATED** |
| Conduct of Business / TCF Policy | [`complaints-handling.md`](by-policy/complaints-handling.md) (PROC-COMP-TCF-01 — complaint intake; FAIS General Code timelines; TCF root-cause analysis; FSCA reportable complaint; `ComplaintResolved` event) | Zara (CCO, governance) · Niko (CRM, activates licence-day) | **POPULATED** |
| FATCA / CRS Policy | [`fatca-crs-annual-submission.md`](by-policy/fatca-crs-annual-submission.md) (PROC-TX-FATCA-01 — due-diligence lifecycle + FATCA XML + CRS XML + SARS AEOI portal submission by 31 July) | Yael (Tax & treasury engineer) · Mira (Regulatory intelligence engineer) | **POPULATED** |
| Sanctions / FIC | [`str-filing.md`](by-policy/str-filing.md) (PROC-FC-STR-01 — MLRO decision, goAML submission, tipping-off controls, TPR coordination) | Zara (MLRO) | **POPULATED** |
| Sanctions / FIC | [`tpr-filing.md`](by-policy/tpr-filing.md) (PROC-FC-TPR-01 — MLRO determination, immediate property freeze, goAML TPR submission, DPCI notification, tipping-off controls) | Zara (MLRO) | **POPULATED** |
| Sanctions / FIC | [`ctr-filing.md`](by-policy/ctr-filing.md) (PROC-FC-CTR-01 — threshold detection, structuring aggregation, goAML batch submission, 15-day timeliness) | Zara (MLRO) · Mira | **POPULATED** |
| RMCP / Sanctions / FIC | [`fic-submission-cycle.md`](by-policy/fic-submission-cycle.md) | Triple-hatted compliance lead (MLRO + FIC CO + IO) — Zara (governance) + Mira (engineering) | **DRAFT v0.1** (post D-THIN-HUMAN-LAYER-MINIMUM) |

## Privacy & data protection

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| POPIA / Privacy Policy | [`popia-breach-notification.md`](by-policy/popia-breach-notification.md) | Iris + Senna + Zara | **POPULATED** |
| POPIA / Privacy Policy | [`popia-dsar.md`](by-policy/popia-dsar.md) (data subject access request) | Iris + Anya + Senna | **POPULATED** |
| POPIA / Privacy Policy | [`popia-dsar-correction.md`](by-policy/popia-dsar-correction.md) (PROC-PRIV-DSAR-COR-01 — correction / deletion; cryptographic-erasure path; FIC / Banks Act exemption handling; propagation mechanics) | Iris + Anya | **POPULATED** |
| POPIA / Privacy Policy | [`popia-io-designation.md`](by-policy/popia-io-designation.md) (PROC-PRIV-IO-DSG-01 — per-entity IO + Deputy IO designation; PAIA s.51 manual) | Iris + Owen | **POPULATED** |
| Cross-Border Transfer Policy | [`s72-transfer-assessment.md`](by-policy/s72-transfer-assessment.md) (PROC-PRIV-CBT-01 — s.72 four-gate model; adequacy check; SCCs / DPA; annual review) | Iris + Devon | **POPULATED** |
| PAIA Manual | [`paia-request-handling.md`](by-policy/paia-request-handling.md) (PROC-PAIA-RH-01 — Form C receipt; third-party notification; grounds-for-refusal; SAHRC annual report) | Iris + Owen | **POPULATED** |
| Data Retention | [`retention-disposal.md`](by-policy/retention-disposal.md) (PROC-PRIV-RD-01 — cryptographic erasure; NIST SP 800-88; legal-hold gate; PAIA-suspension gate; annual schedule review) | Iris + Owen | **POPULATED** |

## Information security & cyber

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Information Security Policy | [`access-provisioning.md`](by-policy/access-provisioning.md) (PROC-IS-AP-01 — joiner/mover/leaver lifecycle; RBAC; privileged access dual-approval; quarterly privileged + annual standard review; HSM custodian ceremony; `AccessGranted` / `AccessRevoked` / `AccessReviewCompleted` events; orphaned-account detection recon) | Senna (CISO, governance) · Devon (Chief Operating Officer, governance) | **POPULATED** |
| Information Security Policy | [`key-rotation.md`](by-policy/key-rotation.md) (PROC-IS-KR-01 — cryptographic key lifecycle: HSM root/signing/encryption/API key rotation on schedule or on-demand; dual-control ceremony; `KeyRotated` event chain; key-rotation register) | Senna (CISO, governance) · Devon (IT ops engineer) | **POPULATED** |
| Cyber Resilience Policy | [`incident-response.md`](by-policy/incident-response.md) (IR command) | Senna + Devon + Iris + Zara | **POPULATED** |
| Cyber Resilience Policy | [`cyber-incident-classification.md`](by-policy/cyber-incident-classification.md) (PROC-IS-CIC-01 — P1/P2/P3/P4 tier matrix; IBS-exposure dimension; PA/FSCA/IR notification matrix; regulator SLAs) | Senna (CISO, governance) · Iris (IO, governance) | **POPULATED** |
| Vulnerability Management | [`patch-cadence.md`](by-policy/patch-cadence.md) (PROC-IS-PC-01 — CVSS-based SLA matrix with IBS-exposure uplift; three vulnerability-signal sources; change-management integration) | Senna (CISO, governance) · Devon (COO, governance) | **POPULATED** |
| Change Management Policy | [`change-management.md`](by-policy/change-management.md) (release approval & deployment — merge-to-prod) | Devon + Atlas + Senna | **POPULATED** |
| Secure SDLC Policy | [`secure-sdlc.md`](by-policy/secure-sdlc.md) (idea-to-merge lifecycle; threat-model gate, supply chain, signed builds) | Senna + Rashida + Atlas | **POPULATED** |
| Secure SDLC Policy | [`threat-model-review.md`](by-policy/threat-model-review.md) (PROC-SDLC-TM-01 — STRIDE/DREAD; bank-context amplification; Secure SDLC gate; annual refresh) | Senna (CISO, governance) · Rashida (Cyber resilience engineer) | **POPULATED** |

## Operations & technology

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Outsourcing & Third-Party Risk | [`outsourcing-due-diligence.md`](by-policy/outsourcing-due-diligence.md) (PROC-OPS-OUTS-01 — pre-engagement; 11-step DD cycle; materiality-based approval routing; Directive 3 trigger) | Devon (COO, governance) · Senna (CISO, governance) · Iris (IO, governance) · Imani · Mira | **POPULATED** |
| Outsourcing & Third-Party Risk | [`directive-3-pa-notification.md`](by-policy/directive-3-pa-notification.md) (PROC-OPS-D3-01 — PA notification of cloud/offshoring arrangements; Directive 3 §6 minimum-content; cyber attestation; POPIA s.72) | Devon (COO, governance) · Owen (CoSec, governance) · Imani · Senna (CISO, governance) · Rashida · Iris (IO, governance) | **POPULATED** |
| Cloud Computing | `cloud-residency-attestation.md` | Devon + Senna | PLANNED |
| BCP / DR | [`dr-test-execution.md`](by-policy/dr-test-execution.md) (PROC-OR-DR-01 — annual full DR test + semi-annual component tests; five IBS with explicit RTO/RPO targets; failover → IBS verification → failback → post-test report) | Devon (COO, governance) · Senna (CISO, engineering) | **POPULATED** |
| BCP / DR | [`crisis-management-activation.md`](by-policy/crisis-management-activation.md) (PROC-OR-CMA-01 — CMT assembly; IBS impact assessment; three BCP paths; regulator-notification matrix; stand-down + post-crisis review) | Devon (COO, governance) · Helena (CRO, governance) | **POPULATED** |
| Records Management | [`records-retention-disposal.md`](by-policy/records-retention-disposal.md) (PROC-RM-RD-01) | Owen + Devon | **POPULATED** |
| Records Management | `legal-hold.md` | Imani (with Owen) | PLANNED |
| Change Management + Secure SDLC + InfoSec (Atlas Step 2 substrate) | [`agent-runtime-deploy.md`](by-policy/agent-runtime-deploy.md) | Atlas · Senna · Rashida · Vera (audit) | **POPULATED** |
| Change Management + Secure SDLC + D-NEW-PRODUCT-APPROVAL-POLICY (cross-cutting schema discipline) | [`event-schema-evolution.md`](by-policy/event-schema-evolution.md) (PROC-PLAT-EV-EVOL-01 — schema amendment after events exist in store) | Atlas · Anya · Senna · Mira (citation gate) · Vera (audit) | **POPULATED** |

## Payments and operations

> *Added 2026-05-07 by Tomas. Both policies new to the register at STUB; substrate work tracked under the operations bundle. Outstanding ask: Mira to register Domain N — Payment systems in the obligations register so NPS Act / SARB NPSD obligations carry ORG-PS-* IDs.*

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Payments Policy v0.1 (STUB) + Sponsor-Bank Operating Policy v0.1 (STUB) | [`outbound-payment-sponsor-bank-channel.md`](by-policy/outbound-payment-sponsor-bank-channel.md) | Tomas · Eitan · Mira (sanctions gate) · Imani (contract) | **POPULATED** |
| Payments Policy | `samos-cut-off.md` | Tomas | PLANNED |
| Payments Policy | `bankserv-cycle.md` | Tomas | PLANNED |
| Payments Policy | `reconciliation-break-handling.md` | Tomas | PLANNED |
| Sponsor-Bank Operating Policy | `nostro-management.md` | Tomas + Eitan | PLANNED |
| SWIFT CSP | `swift-csp-attestation.md` | Tomas + Senna | PLANNED |

## Finance, accounting, tax, treasury

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Capital Management | [`capital-ratio-monitoring.md`](by-policy/capital-ratio-monitoring.md) (covers CET1 / leverage) | Camille (Bea) | **POPULATED** |
| Capital Management | [`capital-instrument-issuance.md`](by-policy/capital-instrument-issuance.md) (PROC-CAP-CII-01 — CET1 / AT1 / Tier 2 issuance lifecycle; Board auth gate; SARB no-objection gate; PONV clause; STRATE settlement) | Camille (CFO, governance) · Eitan (Treasury engineer, engineering) | **POPULATED** |
| Accounting Policies (IFRS) v0.1 (STUB) + Financial Reporting & Disclosure v0.1 (STUB) | [`posting-rule-publication.md`](by-policy/posting-rule-publication.md) | Bea · Atlas | **POPULATED** |
| Accounting Policies (IFRS) — IFRS 10 consolidation policy (planned by Camille; sub-policy of Accounting Policies (IFRS) v0.1 STUB + Financial Reporting & Disclosure v0.1 STUB) | [`ifrs10-consolidation-cycle.md`](by-policy/ifrs10-consolidation-cycle.md) (PROC-ACC-IFRS10-01 — three-entity group consolidation per D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER) | Bea · Camille (governance sign-off) | **POPULATED** |
| Accounting Policies (IFRS) | [`balance-sheet-substantiation.md`](by-policy/balance-sheet-substantiation.md) (PROC-FIN-BSS-01 — monthly per-account source-event trace + CFO sign-off + `BalanceSheetSubstantiationCompleted` event) | Bea (Camille sign-off) | **DRAFT v1.0** |
| Accounting Policies (IFRS) | [`month-end-close.md`](by-policy/month-end-close.md) (PROC-FIN-MC-01 — broader period-close orchestration: GL freeze, reconciliation, accruals/provisions, trial balance, CFO sign-off, `PeriodClosed` event, BA return trigger; balance sheet substantiation is a named step within it, see PROC-FIN-BSS-01) | Camille (CFO, governance) · Bea (finance/reporting engineer) | **POPULATED** |
| Regulatory Reporting Policy | [`ba-return-generation.md`](by-policy/ba-return-generation.md) (PROC-FIN-BA-01) | Camille (Bea) | **POPULATED** |
| Provisioning / IFRS 9 ECL Policy v0.1 (STUB) + RAS (in-force) | [`ecl-stage-projection-refresh.md`](by-policy/ecl-stage-projection-refresh.md) | Rohan · Bea | **POPULATED** |
| IFRS 9 ECL | [`ecl-staging-cycle.md`](by-policy/ecl-staging-cycle.md) (PROC-RSK-ECL-02 — IFRS 9 stage migration + ECL measurement cycle) | Helena (CRO, governance) · Bea (Finance / reporting engineer) | **POPULATED** |
| Tax | [`corporate-tax-filing.md`](by-policy/corporate-tax-filing.md) (PROC-TX-CIT-01 — CIT annual filing; ITR14; provisional tax; SARS e-Filing) | Yael (Tax & treasury engineer, engineering) · Camille (CFO, governance) | **POPULATED** |
| Tax | [`vat-fs-apportionment.md`](by-policy/vat-fs-apportionment.md) (PROC-TX-VAT-01 — VAT financial-services apportionment; monthly VAT201; annual ratio reconciliation) | Yael (Tax & treasury engineer, engineering) · Camille (CFO, governance) | **POPULATED** |
| Funding Strategy | `samos-funding-daily.md` | Eitan (Ravi) | PLANNED |
| FTP Methodology | `ftp-attachment-on-product-event.md` | Eitan + Anya | PLANNED |
| Hedge Accounting | `hedge-designation-test.md` | Eitan + Bea | PLANNED |
| Collateral Management | `collateral-valuation-daily.md` | Eitan + Saskia | PLANNED |

## Markets

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Trading Mandate (B5 — refining) | `mandate-attestation.md` | Saskia + Helena | PLANNED |
| Best Execution | `best-execution-report.md` | Saskia | PLANNED |
| Market Abuse / Surveillance | `surveillance-alert-triage.md` | Zara (Mira) + Saskia | PLANNED |
| Voice & Comms Recording | `recording-retention.md` | Saskia + Senna + Sade | PLANNED |
| Counterparty Onboarding (markets) | [`counterparty-onboarding-markets.md`](by-policy/counterparty-onboarding-markets.md) (PROC-MK-CO-01 — seven-gate institutional counterparty onboarding; KYC/CDD, ISDA/GMRA docs, FAIS categorisation, credit limit, collateral, settlement instructions, margin agreement; `CounterpartyEnabled` gate event) | Saskia · Imani · Zara · Eitan | **POPULATED** |
| New Product Approval (D-NEW-PRODUCT-APPROVAL-POLICY) | [`new-product-due-diligence.md`](by-policy/new-product-due-diligence.md) (PROC-MK-NPA-DD-01 — stage 3, 14-dimension cycle) | Saskia + Devon | **POPULATED** |
| New Product Approval (D-NEW-PRODUCT-APPROVAL-POLICY) | [`product-controlled-launch.md`](by-policy/product-controlled-launch.md) (PROC-MK-NPA-CL-01 — stage 5 limit administration + daily monitoring) | Saskia | **POPULATED** |
| New Product Approval (D-NEW-PRODUCT-APPROVAL-POLICY) | [`product-post-implementation-review.md`](by-policy/product-post-implementation-review.md) (PROC-MK-NPA-PIR-01 — stage 6 PIR convening) | Saskia + Devon | **POPULATED** |
| New Product Approval (D-NEW-PRODUCT-APPROVAL-POLICY) | [`product-retirement-migration.md`](by-policy/product-retirement-migration.md) (PROC-MK-NPA-RET-01 — stage 8 open-position migration) | Saskia + Imani + Tomas | **POPULATED** |
| New Product Approval | [`npa-gate.md`](by-policy/npa-gate.md) (PROC-NPA-GATE-01 — stage-4 gate; four-party opinion cycle; `NewProductApproved` gate event; controlled-launch configuration; handoff to stage 5) | Saskia · Helena · Camille · Zara | **POPULATED** |

## Markets — OTC Derivative Provider (FMA / FSCA)

> *Added 2026-05-07 by Mira from `Owner Inbox/2026-05-07_mira_fsca-odp-compliance-preparation.md`. All STUB; substrate work tracked under the markets bundle.*

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| ODP Authorisation Policy | [`odp-authorisation-application.md`](by-policy/odp-authorisation-application.md) | Owen + Camille + Imani + Saskia | STUB |
| Trade Reporting Policy | [`trade-reporting-strate.md`](by-policy/trade-reporting-strate.md) | Mira + Tomas + Anya + Kai | STUB |
| Margin Policy (RMF sub-policy) | [`margin-vm.md`](by-policy/margin-vm.md) | Ravi + Eitan + Imani + Bea | STUB |
| Margin Policy / IM Methodology Policy | [`margin-im.md`](by-policy/margin-im.md) | Ravi + Rohan + Eitan + Imani | STUB |
| OTC Trading Policy | [`portfolio-reconciliation.md`](by-policy/portfolio-reconciliation.md) | Tomas + Anya + Rohan | STUB |
| OTC Trading Policy | [`otc-confirmation.md`](by-policy/otc-confirmation.md) | Kai + Tomas + Imani | STUB |
| OTC Trading Policy / ISDA dispute | [`otc-dispute-resolution.md`](by-policy/otc-dispute-resolution.md) | Imani + Saskia + Zara | STUB |
| Client Categorisation Policy | [`client-categorisation.md`](by-policy/client-categorisation.md) | Zara + Niko (paused build-phase) | STUB |
| Excon Compliance Policy | [`excon-otc-derivatives.md`](by-policy/excon-otc-derivatives.md) | Eitan + Mira + Ravi | STUB |

## Customer / sales

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Customer Acceptance | (`kyc-onboarding.md` covers acceptance gate) | Niko + Zara | **POPULATED** (shared) |
| Institutional-only / FAIS Posture A (D-FSP-LICENCE-NECESSITY confirm-A, 2026-05-09; PR #62) | [`counterparty-institutional-eligibility-screening.md`](by-policy/counterparty-institutional-eligibility-screening.md) (PROC-CRM-CIE-01 — FAIS Posture A eligibility gate; institutional-client classification; `CounterpartyEligibilityApproved` event; rejection path) | Niko · Saskia (governance) · Zara (governance) | **POPULATED** |
| FAIS Policy v0.1 (STUB, FSP-conditional) + Customer Treatment (TCF) v0.1 (STUB) | [`fais-advice-record-capture.md`](by-policy/fais-advice-record-capture.md) | Niko · Zara · Sade (paused build-phase; activates licence-day) | **POPULATED** |
| Customer Treatment (TCF) | [`complaints-handling.md`](by-policy/complaints-handling.md) (PROC-COMP-TCF-01) | Niko + Zara | **POPULATED** (shared with Compliance section) |
| Marketing & Advertising | `marketing-claim-validation.md` | Niko + Zara | PLANNED |
| Pricing | [`pricing-approval.md`](by-policy/pricing-approval.md) | Niko + Helena + Eitan + Camille + Zara | **POPULATED** |

## People & HR

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Remuneration Policy | `annual-remuneration-review.md` | Sade + Helena (RemCo) | PLANNED |
| Remuneration Policy | `malus-clawback-trigger.md` | Sade + Helena | PLANNED |
| Fit-and-Proper Policy | `fit-and-proper-attestation.md` | Sade + Owen + Helena | PLANNED |
| Fit-and-Proper Policy + FAIS Policy v0.1 (STUB) | [`fais-ki-fit-and-proper.md`](by-policy/fais-ki-fit-and-proper.md) (PROC-FAIS-KI-FAP-01 — five-dimension Determination 2017 framework) | Sade · Zara · Saskia (named KI) | STUB |
| Recruitment & Selection | `recruitment-process.md` | Sade | PLANNED |
| Disciplinary | `disciplinary-process.md` | Sade | PLANNED |
| Grievance | `grievance-process.md` | Sade | PLANNED |
| Performance Management | `performance-cycle.md` | Sade | PLANNED |
| EE / B-BBEE | `ee-annual-report.md` | Sade | PLANNED |
| Skills Development | `wsp-atr-cycle.md` | Sade | PLANNED |
| Health & Safety | `ohs-incident.md` | Sade | PLANNED |

## Conduct & ethics

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Code of Conduct | `code-attestation.md` (annual) | Owen + Sade | PLANNED |
| Conflicts of Interest | [`conflicts-declaration.md`](by-policy/conflicts-declaration.md) (per-meeting and on-arising) | Owen + Helena + Zara | **POPULATED** |
| ABC Policy | [`abc-due-diligence.md`](by-policy/abc-due-diligence.md) (PROC-COND-ABC-DD-01 — PRECCA s.34; four-band risk score; EDD for High-band; ABC contractual safeguards; annual refresh) | Owen + Zara | **POPULATED** |
| Whistleblowing | [`whistleblowing-case.md`](by-policy/whistleblowing-case.md) (PROC-COND-WB-01 — PDA s.3/9A; parallel escalation taxonomy; Board Chair independence; 6-month welfare-check; PRECCA s.34 path) | Owen | **POPULATED** |
| Gifts | `gift-registration.md` | Owen | PLANNED |
| Insider Trading / PA Dealing | `pa-dealing-pre-clearance.md` | Owen + Zara | PLANNED |
| Corporate Naming Policy v0.1 (planned by Owen) | [`naming-pre-clearance.md`](by-policy/naming-pre-clearance.md) (TM + Banks Act § 22 + CIPC + 11-language sweep) | Owen + Imani · Mira (s.22) · PAX (language sweep) · Atlas (substrate) | **POPULATED** |

## Legal

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Contracting v0.1 (STUB) + Document Execution v0.1 (STUB) | `counterparty-governing-law-clause-adoption.md` | Imani · Saskia (where soft-franchise) | **POPULATED** |
| Contracting | `contract-execution.md` (incl. ECTA discipline) | Imani | PLANNED |
| Litigation | `litigation-handling.md` | Imani + Owen | PLANNED |

## Audit

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Internal Audit Charter (post-CAE) | `audit-plan-cycle.md` | future CAE (Vera) | PLANNED |
| Internal Audit Charter | `findings-tracking.md` | future CAE (Vera) | PLANNED |
| Combined Assurance | `combined-assurance-map-cycle.md` | future CAE + Owen | PLANNED |

---

## Status summary

| Status | Count | Note |
|---|---|---|
| **POPULATED** | 68 | KYC onboarding · Sanctions screening · Capital ratio monitoring · POPIA breach notification · IR command · Conflicts declaration · POPIA DSAR · Change management · Pricing approval · Secure SDLC · Counterparty governing-law clause adoption · Posting-rule publication · ECL stage projection refresh · FAIS advice-record capture · Outbound payment sponsor-bank channel · Agent-runtime deploy · **Transaction monitoring (PROC-FC-TM-01, 2026-05-15)** · **STR filing (PROC-FC-STR-01, 2026-05-15)** · **CTR filing (PROC-FC-CTR-01, 2026-05-15)** · **TPR filing (PROC-FC-TPR-01, 2026-05-15)** · **Market risk monitoring (PROC-RISK-MRM-01, 2026-05-15)** · **Stress test cycle (PROC-RISK-ST-01, 2026-05-15)** · **KYC recurring refresh (PROC-FC-KYC-R-01, 2026-05-15)** · **Delegation of authority (PROC-GV-DOA-01, 2026-05-15)** · **Severe-but-plausible test (PROC-OR-SBP-01, 2026-05-15)** · **DR test execution (PROC-OR-DR-01, 2026-05-15)** · **KYC continuous monitoring (PROC-FC-KYC-C-01, 2026-05-15)** · **Sanctions override (PROC-FC-SO-01, 2026-05-15)** · **NPA gate (PROC-NPA-GATE-01, 2026-05-15)** · **Counterparty onboarding markets (PROC-MK-CO-01, 2026-05-15)** · **Key rotation (PROC-IS-KR-01, 2026-05-15)** · **Month-end close (PROC-FIN-MC-01, 2026-05-15)** · **BA return generation (PROC-FIN-BA-01, 2026-05-15)** · **IFRS 10 consolidation cycle (PROC-ACC-IFRS10-01, 2026-05-15)** · **ECL staging cycle (PROC-RSK-ECL-02, 2026-05-15)** · **Corporate tax filing (PROC-TX-CIT-01, 2026-05-15)** · **FATCA / CRS annual submission (PROC-TX-FATCA-01, 2026-05-15)** · **VAT financial-services apportionment (PROC-TX-VAT-01, 2026-05-15)** · **Capital instrument issuance (PROC-CAP-CII-01, 2026-05-15)** · **POPIA IO designation (PROC-PRIV-IO-DSG-01, Batch C 2026-05-15)** · **Records retention disposal (PROC-RM-RD-01, Batch C 2026-05-15)** · **Naming pre-clearance (PROC-CORP-NC-01, Batch C 2026-05-15)** · **Event schema evolution (PROC-PLAT-EV-EVOL-01, Batch C 2026-05-15)** · **POPIA DSAR correction/deletion (PROC-PRIV-DSAR-COR-01, Batch C 2026-05-15)** · **POPIA s.72 transfer assessment (PROC-PRIV-CBT-01, Batch C 2026-05-15)** · **PAIA request handling (PROC-PAIA-RH-01, Batch C 2026-05-15)** · **Data retention and disposal (PROC-PRIV-RD-01, Batch C 2026-05-15)** · **ABC due diligence (PROC-COND-ABC-DD-01, Batch C 2026-05-15)** · **Whistleblowing case management (PROC-COND-WB-01, Batch C 2026-05-15)** · **RCSA cycle (PROC-RISK-RCSA-01, 2026-05-15)** · **Model validation (PROC-RSK-MV-01, 2026-05-15)** · **Counterparty institutional eligibility screening (PROC-CRM-CIE-01, 2026-05-15)** · **RMCP annual attestation (PROC-COMP-RMCP-01, 2026-05-15)** · **Complaints handling (PROC-COMP-TCF-01, 2026-05-15)** · **IRRBB measurement (PROC-RISK-IRRBB-01, 2026-05-15)** · **Intraday liquidity funding (PROC-RISK-ILF-01, 2026-05-15)** · **Climate scenario analysis (PROC-RISK-CSA-01, 2026-05-15)** · **New product due diligence (PROC-MK-NPA-DD-01, 2026-05-15)** · **Product controlled launch (PROC-MK-NPA-CL-01, 2026-05-15)** · **Product post-implementation review (PROC-MK-NPA-PIR-01, 2026-05-15)** · **Product retirement migration (PROC-MK-NPA-RET-01, 2026-05-15)** · **Outsourcing due diligence (PROC-OPS-OUTS-01, 2026-05-15)** · **Directive 3 PA notification (PROC-OPS-D3-01, 2026-05-15)** · **Cyber incident classification (PROC-IS-CIC-01, 2026-05-15)** · **Patch cadence (PROC-IS-PC-01, 2026-05-15)** · **Threat model review (PROC-SDLC-TM-01, 2026-05-15)** · **Crisis management activation (PROC-OR-CMA-01, 2026-05-15)** · **Access provisioning (PROC-IS-AP-01, 2026-05-15)** |
| **DRAFT** | 1 | **Balance sheet substantiation (Bea 2026-05-12; PROC-FIN-BSS-01)** |
| **STUB** | 0 | — all STUBs promoted to POPULATED 2026-05-15 |
| PLANNED | ~22 | Drafting queue under domain leads, coordinated by Owen |
| **Total identified procedures** | **~90** across 14 domains |

The chain `Reg → Policy → Procedure → System Capability` is now wired:

- **Reg → Policy:** via the obligations register (`Regulations/_obligations-register.md`).
- **Policy → Procedure:** via this index and the per-procedure source-policy reference.
- **Procedure → System Capability:** via the per-procedure step table naming the platform component (`@platform/...`).

Each system capability the procedures reference is either built (in `prototype/platform/`) or marked `PLANNED`. As Atlas's prototype expands, procedures' `PLANNED` capability references resolve to real components. The chain becomes fully testable when every procedure's system-capability column is non-`PLANNED`.

## How to extend

1. Pick a `PLANNED` procedure from this index.
2. Copy `templates/procedure-template.md` into `by-policy/<name>.md`.
3. Fill in fields per the template; cite the source policy and obligations-register IDs.
4. Submit through Owen for procedural-discipline review; the policy owner approves substantively.
5. Update this index row to `POPULATED`.
6. If the procedure references a not-yet-built system capability, flag it to Atlas / Devon for the prototype roadmap.
