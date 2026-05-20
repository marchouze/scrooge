# Procedures library — index

**Curators:** Domain leads · Owen (procedural-discipline custodian) · Mira (citation linkage)
**As-of:** 2026-05-06

> Master inventory of every procedure under each approved policy. Each row demonstrates the **Reg → Policy → Procedure → System Capability** chain. Status: **`POPULATED`** = procedure file authored; **`STUB`** = file scaffolded; **`PLANNED`** = identified but not yet drafted.

## Foundation & meta-policies

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Risk Management Framework | [`procedures-rmf-governance.md`](by-policy/procedures-rmf-governance.md) (PROC-GOV-RMF-01 — annual RMF review; BCBS alignment check; RAS re-approval; CEO attestation; PA notification assessment) | Helena (Chief Risk Officer, governance) | **POPULATED** |
| Governance Framework | [`procedures-board-papers.md`](by-policy/procedures-board-papers.md) (PROC-GOV-BP-01 — 5-business-day paper submission; Owen review; confidentiality classification; minutes approval cycle) | Owen (Company Secretary, governance) | **POPULATED** |
| Delegation of Authority | [`delegation-of-authority.md`](by-policy/delegation-of-authority.md) (PROC-GV-DOA-01 — four authority levels; Board-reserved matters; agent Level 4 limits; `EscalationRequired` path) | Owen + Devon | **POPULATED** |

## Risk

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Credit Risk Policy | [`credit-origination.md`](by-policy/credit-origination.md) (PROC-RISK-CO-01 — counterparty credit limit application; financial analysis; ISDA/CSA gate; PFE model; Reg 29 cap; annual review; breach escalation) | Helena (Chief Risk Officer, governance) | **POPULATED** |
| Credit Risk Policy | [`credit-risk-limit-management.md`](by-policy/credit-risk-limit-management.md) (PROC-RISK-CLM-01 — operationalises credit-risk-policy-v1 §2 + §7 deferred authority matrix and sub-limit schedule; rating-based limit matrix; CRO/CRC/BRC/CEO authority ladder calibrated against R300m capital base; connected-counterparty-group aggregation; exception workflow ≤ 90 days; sub-IG approval; eight Vera recons as engine build input) | Helena (Chief Risk Officer, governance) | **POPULATED** |
| Market Risk Policy | [`market-risk-monitoring.md`](by-policy/market-risk-monitoring.md) (PROC-RISK-MRM-01 — daily VaR/ES limit monitoring, FRTB back-testing, PLA test, prop-trading attestation) | Helena (CRO, governance) · Rohan (market risk quant, engineering) | **POPULATED** |
| Market Risk Policy | [`frtb-sa-capital-computation.md`](by-policy/frtb-sa-capital-computation.md) (PROC-RISK-FRTB-SA-01 — daily FRTB Standardised Approach capital: SBM across seven risk classes + DRC + RRAO + CVA-SA; FX product → risk class mapping; `FrtbSaCapitalComputed` event) | Helena (CRO, governance) · Rohan (Market risk quantitative engineer, engineering) | **POPULATED** |
| Market Risk Policy | [`backtesting-governance.md`](by-policy/backtesting-governance.md) (PROC-RISK-BACKTEST-01 — daily HPL/RTPL/VaR back-test; 250-day rolling exception count; Green/Amber/Red zones; SA-fallback on Red; 24h amber + 24h red notification; 5bd remediation; PA notification on IMA-approved Red entry) | Helena (CRO, governance) · Rohan (Market risk quantitative engineer, engineering) | **POPULATED** |
| Market Risk Policy | [`pla-test-governance.md`](by-policy/pla-test-governance.md) (PROC-RISK-PLA-01 — monthly Spearman correlation + variance ratio per IMA-candidate desk × risk class; Green/Amber/Red; SA-fallback per risk class on Red; consecutive-quarterly-failure model review by Nadia) | Helena (CRO, governance) · Rohan (Market risk quantitative engineer, engineering) | **POPULATED** |
| Market Risk Policy | [`market-risk-limit-monitoring.md`](by-policy/market-risk-limit-monitoring.md) (PROC-RISK-MRL-01 — limit register MR-1 to MR-6 + MR-4-HEDGE; MR-5 = no-prop attribution (per policy §3), MR-6 = stress scenario loss; warning 50% / amber 80% / hard breach 100%; desk-level → bank-wide aggregation; 15-min notification, 1bd MRC, 5bd remediation, PA notification on material breach; daily no-prop attribution sweep) | Helena (CRO, governance) · Rohan (Market risk quantitative engineer, engineering) | **POPULATED** |
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
| Cloud Computing | [`cloud-residency-attestation.md`](by-policy/cloud-residency-attestation.md) (PROC-IS-CRA-01 — annual cloud service inventory; data classification mapping; POPIA s.72 transfer assessment; PA Joint Standard 2 attestation; CEO sign-off) | Devon (DevOps & platform engineer) · Senna (information security & cloud engineer) | **POPULATED** |
| BCP / DR | [`dr-test-execution.md`](by-policy/dr-test-execution.md) (PROC-OR-DR-01 — annual full DR test + semi-annual component tests; five IBS with explicit RTO/RPO targets; failover → IBS verification → failback → post-test report) | Devon (COO, governance) · Senna (CISO, engineering) | **POPULATED** |
| BCP / DR | [`crisis-management-activation.md`](by-policy/crisis-management-activation.md) (PROC-OR-CMA-01 — CMT assembly; IBS impact assessment; three BCP paths; regulator-notification matrix; stand-down + post-crisis review) | Devon (COO, governance) · Helena (CRO, governance) | **POPULATED** |
| Records Management | [`records-retention-disposal.md`](by-policy/records-retention-disposal.md) (PROC-RM-RD-01) | Owen + Devon | **POPULATED** |
| Records Management | [`legal-hold.md`](by-policy/legal-hold.md) (PROC-RMS-LH-01 — litigation/regulatory/disciplinary hold trigger; automated preservation; custodian notifications; Vera daily monitoring; CEO notification for regulatory holds; hold release) | Imani (legal-as-code engineer) · Owen (Company Secretary, governance) | **POPULATED** |
| Change Management + Secure SDLC + InfoSec (Atlas Step 2 substrate) | [`agent-runtime-deploy.md`](by-policy/agent-runtime-deploy.md) | Atlas · Senna · Rashida · Vera (audit) | **POPULATED** |
| Change Management + Secure SDLC + D-NEW-PRODUCT-APPROVAL-POLICY (cross-cutting schema discipline) | [`event-schema-evolution.md`](by-policy/event-schema-evolution.md) (PROC-PLAT-EV-EVOL-01 — schema amendment after events exist in store) | Atlas · Anya · Senna · Mira (citation gate) · Vera (audit) | **POPULATED** |

## Payments and operations

> *Added 2026-05-07 by Tomas. Both policies new to the register at STUB; substrate work tracked under the operations bundle. Outstanding ask: Mira to register Domain N — Payment systems in the obligations register so NPS Act / SARB NPSD obligations carry ORG-PS-* IDs.*

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Payments Policy v0.1 (STUB) + Sponsor-Bank Operating Policy v0.1 (STUB) | [`outbound-payment-sponsor-bank-channel.md`](by-policy/outbound-payment-sponsor-bank-channel.md) | Tomas · Eitan · Mira (sanctions gate) · Imani (contract) | **POPULATED** |
| Payments Policy | [`samos-cut-off.md`](by-policy/samos-cut-off.md) (PROC-PAY-SCO-01 — internal cut-off discipline for SAMOS morning/afternoon cycles; correspondent processing buffer; calendar engine; `CutOffCheckPassed` / `CutOffDeferred` events) | Tomas (payments engineer) | **POPULATED** |
| Payments Policy | [`bankserv-cycle.md`](by-policy/bankserv-cycle.md) (PROC-PAY-BSC-01 — cycle-timing discipline for EFT credit/debit, RTC, PayShap; scheme resolution; batch vs real-time paths; `SchemeCycleCheckPassed` / `SchemeCutOffDeferred` events) | Tomas (payments engineer) | **POPULATED** |
| Payments Policy | [`reconciliation-break-handling.md`](by-policy/reconciliation-break-handling.md) (PROC-PAY-RBH-01 — three-way recon: trade-leg / payment-leg / ledger-leg + nostro-leg; break severity classification; `ReconciliationBreak` / `ReconciliationBreakResolved` events) | Tomas (payments engineer) · Bea (financial-reporting engineer) | **POPULATED** |
| Sponsor-Bank Operating Policy · Payments Policy | [`nostro-management.md`](by-policy/nostro-management.md) (PROC-PAY-NM-01 — opening balance feed → PROC-RISK-ILF-01 Step 1; intraday projection; EoD reconciliation against correspondent statement; account maintenance; `NostroOpeningBalance` / `NostroEoDReconciliationComplete` events) | Tomas (payments engineer) · Eitan (treasury & ALM engineer) | **POPULATED** |
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
| Funding Strategy | `samos-funding-daily.md` — **SUPERSEDED** by [`intraday-liquidity-funding.md`](by-policy/intraday-liquidity-funding.md) (PROC-RISK-ILF-01); samos-funding-daily.md not created; scope merged into PROC-RISK-ILF-01 | Eitan (Ravi) | SUPERSEDED / MERGED |
| FTP Methodology | [`ftp-attachment-on-product-event.md`](by-policy/ftp-attachment-on-product-event.md) (PROC-ALM-FTP-01 — event-driven FTP rate attachment at product inception; ZARONIA curve; three-component rate; daily coverage reconciliation; ALCO curve calibration) | Eitan (treasury & ALM engineer) · Anya (platform & data engineer) | **POPULATED** |
| Hedge Accounting | [`hedge-designation-test.md`](by-policy/hedge-designation-test.md) (PROC-ALM-HDT-01 — IFRS 9 fair-value and cash-flow hedge designation; prospective effectiveness test; daily 80–125% monitoring; period-end retrospective test; rebalancing; de-designation) | Eitan (treasury & ALM engineer) · Bea (financial-reporting engineer) | **POPULATED** |
| Collateral Management | [`collateral-valuation-daily.md`](by-policy/collateral-valuation-daily.md) (PROC-ALM-CVD-01 — daily EOD collateral valuation cycle; ISDA/CSA netting; net margin call calculation; eligibility + haircut; call issuance/receipt; settlement; PA Umoja reporting; links to PROC-MK-ODP-03 and PROC-MK-ODP-04) | Eitan (treasury & ALM engineer) · Saskia (markets risk engineer) | **POPULATED** |

## Markets

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Trading Mandate (B5 — refining) | [`mandate-attestation.md`](by-policy/mandate-attestation.md) (PROC-MK-MA-01 — pre-session mandate pull, automated limit-utilisation check, attestation event, intraday breach alerts, EOD sign-off; `MandateAttestationEmitted` gate event) | Saskia · Helena | **POPULATED** |
| Best Execution | [`best-execution-report.md`](by-policy/best-execution-report.md) (PROC-MK-BE-01 — pre-trade venue/price assessment, execution quality monitoring, quarterly best-execution report, annual policy review; institutional-only; FAIS GCC + TCF Outcome 2) | Saskia · Zara | **POPULATED** |
| Market Abuse / Surveillance | [`surveillance-alert-triage.md`](by-policy/surveillance-alert-triage.md) (PROC-MK-SUR-01 — four-pattern engine: front-running, layering, wash trading, insider signals; Level 1 Zara triage; Level 2 Helena review; FSCA referral; FIC STR branch; PA Dealing cross-check; 5-year retention) | Zara · Saskia | **POPULATED** |
| Voice & Comms Recording | [`recording-retention.md`](by-policy/recording-retention.md) (PROC-MK-REC-01 — four channels: voice, IM, email, trading system; FIPS-Level-3 tamper-evident archive; 5 yr FMCA / 7 yr FAIS retention; regulatory retrieval pathway; annual attestation) | Saskia · Senna · Sade | **POPULATED** |
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
| ODP Authorisation Policy | [`odp-authorisation-application.md`](by-policy/odp-authorisation-application.md) — PROC-MK-ODP-01: one-shot FSCA ODP authorisation application (Index 1, banks-track); pre-assembled during build-phase, lodged at licence-day | Owen + Camille + Imani + Saskia | **POPULATED** |
| Trade Reporting Policy | [`trade-reporting-strate.md`](by-policy/trade-reporting-strate.md) — PROC-MK-ODP-02: per-transaction reporting of OTC IRD trades to STRATE Trade Repository (169 CS 3/2018 fields); daily reconciliation | Mira + Tomas + Anya + Kai | **POPULATED** |
| Margin Policy (RMF sub-policy) | [`margin-vm.md`](by-policy/margin-vm.md) — PROC-MK-ODP-03: daily variation-margin calculation and exchange per-counterparty under ISDA CSA; zero threshold; correspondent bank settlement; PA Umoja reporting | Ravi + Eitan + Imani + Bea | **POPULATED** |
| Margin Policy / IM Methodology Policy | [`margin-im.md`](by-policy/margin-im.md) — PROC-MK-ODP-04: SIMM-aligned initial-margin calculation, exchange, and custodian segregation for in-scope non-cleared OTC counterparties; phased BCBS-IOSCO applicability | Ravi + Rohan + Eitan + Imani | **POPULATED** |
| OTC Trading Policy | [`portfolio-reconciliation.md`](by-policy/portfolio-reconciliation.md) — PROC-MK-ODP-05: frequency-tiered OTC IRD portfolio reconciliation (weekly/monthly/quarterly per CS 3/2018 §5); material-break escalation and FSCA reporting | Tomas + Anya + Rohan | **POPULATED** |
| OTC Trading Policy | [`otc-confirmation.md`](by-policy/otc-confirmation.md) (PROC-MK-ODP-06 — ISO 20022 / FpML confirmation generation; ECTA dispatch; SLA tracking T+1 vanilla / T+5 exotic; counterparty-ack escalation; daily EOD reconciliation; BLAKE3 tamper-detection) | Kai + Tomas + Imani | **POPULATED** |
| OTC Trading Policy / ISDA dispute | [`otc-dispute-resolution.md`](by-policy/otc-dispute-resolution.md) (PROC-MK-ODP-07 — three-pathway resolution: MTM / material terms / margin call; R5m and 5 BD escalation thresholds; independent recalculation; senior engagement; external escalation; ISDA 2016 CSA 1-BD VM window) | Imani + Saskia + Zara | **POPULATED** |
| Client Categorisation Policy | [`client-categorisation.md`](by-policy/client-categorisation.md) (PROC-MK-ODP-08 — EC / PC / RC three-tier classification; institutional-only RC hard-decline; pre-trade gate integration; annual review cycle; material-change re-review; Party register update) | Zara + Niko (paused build-phase) | **POPULATED** |
| Excon Compliance Policy | [`excon-otc-derivatives.md`](by-policy/excon-otc-derivatives.md) (PROC-MK-ODP-09 — per-trade Excon scope screen; FinSurv pre-approval pathway; post-trade and aggregate periodic reporting; external counsel engagement pre-first-non-resident-trade; annual framework review) | Eitan + Mira + Ravi | **POPULATED** |

## Customer / sales

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Customer Acceptance | (`kyc-onboarding.md` covers acceptance gate) | Niko + Zara | **POPULATED** (shared) |
| Institutional-only / FAIS Posture A (D-FSP-LICENCE-NECESSITY confirm-A, 2026-05-09; PR #62) | [`counterparty-institutional-eligibility-screening.md`](by-policy/counterparty-institutional-eligibility-screening.md) (PROC-CRM-CIE-01 — FAIS Posture A eligibility gate; institutional-client classification; `CounterpartyEligibilityApproved` event; rejection path) | Niko · Saskia (governance) · Zara (governance) | **POPULATED** |
| FAIS Policy v0.1 (STUB, FSP-conditional) + Customer Treatment (TCF) v0.1 (STUB) | [`fais-advice-record-capture.md`](by-policy/fais-advice-record-capture.md) | Niko · Zara · Sade (paused build-phase; activates licence-day) | **POPULATED** |
| Customer Treatment (TCF) | [`complaints-handling.md`](by-policy/complaints-handling.md) (PROC-COMP-TCF-01) | Niko + Zara | **POPULATED** (shared with Compliance section) |
| Marketing & Advertising | [`marketing-claim-validation.md`](by-policy/marketing-claim-validation.md) (PROC-MK-MCV-01 — pre-publication claim-by-claim check vs FAIS GCC §4 + TCF Outcomes 1 + 3 + CPA s.29; legal sign-off from Imani on contractual claims; post-publication factual-drift monitoring; withdrawal pathway; 7-year retention) | Zara · Imani | **POPULATED** |
| Pricing | [`pricing-approval.md`](by-policy/pricing-approval.md) | Niko + Helena + Eitan + Camille + Zara | **POPULATED** |

## People & HR

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Remuneration Policy | [`annual-remuneration-review.md`](by-policy/annual-remuneration-review.md) (PROC-HR-ARR-01 — annual benchmarking agent costs and human pay; variable-pay calculation; RemCo sign-off; board approval for executive remuneration; PA notification if material) | Sade · Helena (RemCo) | **POPULATED** |
| Remuneration Policy | [`malus-clawback-trigger.md`](by-policy/malus-clawback-trigger.md) (PROC-HR-MC-01 — trigger event detection; causal assessment; RemCo determination; board approval; PA notification; executed recovery) | Sade · Helena | **POPULATED** |
| Fit-and-Proper Policy | [`fit-and-proper-attestation.md`](by-policy/fit-and-proper-attestation.md) (PROC-HR-FP-01 — annual self-declaration + third-party verification; four-dimension framework; board attestation; PA s.60A notification on adverse event; fit-and-proper register) | Sade · Owen · Helena | **POPULATED** |
| Fit-and-Proper Policy + FAIS Policy v0.1 (STUB) | [`fais-ki-fit-and-proper.md`](by-policy/fais-ki-fit-and-proper.md) (PROC-FAIS-KI-FAP-01 — five-dimension FSCA Determination 2017 framework: honesty/integrity, competence, operational ability, financial soundness, oversight; composite approval gate; continuous monitoring; annual CPD cycle; FSP-licence application bundle) | Sade · Zara · Saskia (named KI) | **POPULATED** |
| Recruitment & Selection | [`recruitment-process.md`](by-policy/recruitment-process.md) (PROC-HR-REC-01 — regulatory-basis role scoping; F&P pre-screening; PA/FSCA notification; EEA non-discrimination; onboarding trigger) | Sade | **POPULATED** |
| Disciplinary | [`disciplinary-process.md`](by-policy/disciplinary-process.md) (PROC-HR-DISC-01 — LRA Schedule 8 fair procedure; preliminary investigation; formal hearing; sanction; appeal; CCMA referral; PA notification on misconduct dismissal) | Sade | **POPULATED** |
| Grievance | [`grievance-process.md`](by-policy/grievance-process.md) (PROC-HR-GRIEV-01 — informal resolution first; formal investigation; outcome determination; appeal; CCMA referral; systemic trend analysis) | Sade | **POPULATED** |
| Performance Management | [`performance-cycle.md`](by-policy/performance-cycle.md) (PROC-HR-PERF-01 — dual-track: human KPI/annual-rating cycle + active agent-performance monitoring; perf-feedback reports; variable-pay scorecard input; improvement plans; incapacity pathway) | Sade | **POPULATED** |
| EE / B-BBEE | [`ee-annual-report.md`](by-policy/ee-annual-report.md) (PROC-HR-EE-01 — workforce profile analysis; EEA2 and EEA4 compilation; CEO sign-off; DoL submission by 15 January; public display; EE plan annual review) | Sade | **POPULATED** |
| Skills Development | [`wsp-atr-cycle.md`](by-policy/wsp-atr-cycle.md) (PROC-HR-WSP-01 — FASSET registration; WSP by 30 April; ATR by 30 April; mandatory grant claim; discretionary grant applications; SDL levy reconciliation) | Sade | **POPULATED** |
| Health & Safety | [`ohs-incident.md`](by-policy/ohs-incident.md) (PROC-HR-OHS-01 — incident categorisation; DoL notification within 7 days (s.24); COIDA claim; root-cause investigation; corrective-action plan; OHS committee records) | Sade | **POPULATED** |

## Conduct & ethics

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Code of Conduct | [`code-attestation.md`](by-policy/code-attestation.md) (PROC-COND-CA-01 — annual attestation; agent attestation via AgentRunner; human attestation at licence-day; conflict disclosure; breach pathway; register) | Owen (Company Secretary, governance) · Sade (AgentOps & token efficiency engineer) | **POPULATED** |
| Conflicts of Interest | [`conflicts-declaration.md`](by-policy/conflicts-declaration.md) (per-meeting and on-arising) | Owen + Helena + Zara | **POPULATED** |
| ABC Policy | [`abc-due-diligence.md`](by-policy/abc-due-diligence.md) (PROC-COND-ABC-DD-01 — PRECCA s.34; four-band risk score; EDD for High-band; ABC contractual safeguards; annual refresh) | Owen + Zara | **POPULATED** |
| Whistleblowing | [`whistleblowing-case.md`](by-policy/whistleblowing-case.md) (PROC-COND-WB-01 — PDA s.3/9A; parallel escalation taxonomy; Board Chair independence; 6-month welfare-check; PRECCA s.34 path) | Owen | **POPULATED** |
| Gifts | [`gift-registration.md`](by-policy/gift-registration.md) (PROC-COND-GR-01 — R500 disclosure threshold; FAIS s.3A; PRECCA; quarterly review; annual governance report) | Owen (Company Secretary, governance) | **POPULATED** |
| Insider Trading / PA Dealing | [`pa-dealing-pre-clearance.md`](by-policy/pa-dealing-pre-clearance.md) (PROC-COND-PAD-01 — designated-person register; pre-clearance 24h SLA; trading window; FMCA Part 8; annual certification; activates at licence-day) | Owen (Company Secretary, governance) · Zara (compliance engineer) | **POPULATED** |
| Corporate Naming Policy v0.1 (planned by Owen) | [`naming-pre-clearance.md`](by-policy/naming-pre-clearance.md) (TM + Banks Act § 22 + CIPC + 11-language sweep) | Owen + Imani · Mira (s.22) · PAX (language sweep) · Atlas (substrate) | **POPULATED** |

## Legal

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Contracting v0.1 (STUB) + Document Execution v0.1 (STUB) | `counterparty-governing-law-clause-adoption.md` | Imani · Saskia (where soft-franchise) | **POPULATED** |
| Contracting | [`contract-execution.md`](by-policy/contract-execution.md) (PROC-LEG-CE-01 — ECTA Schedule 2 exclusion matrix; AES/wet/basic signature selection; DocuSign SA-region; ISDA/GMRA path; 5-year audit trail retention) | Imani (legal-as-code engineer) | **POPULATED** |
| Litigation | [`litigation-handling.md`](by-policy/litigation-handling.md) (PROC-LEG-LH-01 — legal hold integration; external counsel instruction; settlement authority matrix R50k/R500k/Board; filing-deadline monitoring; lessons-learned) | Imani (legal-as-code engineer) · Owen (Company Secretary, governance) | **POPULATED** |

## Audit

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Internal Audit Charter | [`audit-plan-cycle.md`](by-policy/audit-plan-cycle.md) (PROC-AUD-APC-01 — risk-based planning; audit universe scoping; Vera/Thandiwe roles; Forum approval gate; quarterly progress reporting) | Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance) | **POPULATED** |
| Internal Audit Charter | [`findings-tracking.md`](by-policy/findings-tracking.md) (PROC-AUD-FT-01 — P1-P4 classification; automated follow-up cadence; overdue escalation; Thandiwe P1/P2 closure attestation; closure verification by pipeline re-run) | Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance) | **POPULATED** |
| Combined Assurance | [`combined-assurance-map-cycle.md`](by-policy/combined-assurance-map-cycle.md) (PROC-AUD-CAM-01 — three-line assurance inventory; gap analysis; IIA Standards 2050 reliance decisions; Forum approval gate) | Vera (internal audit engineer) · Owen (Company Secretary, governance) | **POPULATED** |

---

## Status summary

| Status | Count | Note |
|---|---|---|
| **POPULATED** | 104 | KYC onboarding · Sanctions screening · Capital ratio monitoring · POPIA breach notification · IR command · Conflicts declaration · POPIA DSAR · Change management · Pricing approval · Secure SDLC · Counterparty governing-law clause adoption · Posting-rule publication · ECL stage projection refresh · FAIS advice-record capture · Outbound payment sponsor-bank channel · Agent-runtime deploy · **Transaction monitoring (PROC-FC-TM-01, 2026-05-15)** · **STR filing (PROC-FC-STR-01, 2026-05-15)** · **CTR filing (PROC-FC-CTR-01, 2026-05-15)** · **TPR filing (PROC-FC-TPR-01, 2026-05-15)** · **Market risk monitoring (PROC-RISK-MRM-01, 2026-05-15)** · **Stress test cycle (PROC-RISK-ST-01, 2026-05-15)** · **KYC recurring refresh (PROC-FC-KYC-R-01, 2026-05-15)** · **Delegation of authority (PROC-GV-DOA-01, 2026-05-15)** · **Severe-but-plausible test (PROC-OR-SBP-01, 2026-05-15)** · **DR test execution (PROC-OR-DR-01, 2026-05-15)** · **KYC continuous monitoring (PROC-FC-KYC-C-01, 2026-05-15)** · **Sanctions override (PROC-FC-SO-01, 2026-05-15)** · **NPA gate (PROC-NPA-GATE-01, 2026-05-15)** · **Counterparty onboarding markets (PROC-MK-CO-01, 2026-05-15)** · **Key rotation (PROC-IS-KR-01, 2026-05-15)** · **Month-end close (PROC-FIN-MC-01, 2026-05-15)** · **BA return generation (PROC-FIN-BA-01, 2026-05-15)** · **IFRS 10 consolidation cycle (PROC-ACC-IFRS10-01, 2026-05-15)** · **ECL staging cycle (PROC-RSK-ECL-02, 2026-05-15)** · **Corporate tax filing (PROC-TX-CIT-01, 2026-05-15)** · **FATCA / CRS annual submission (PROC-TX-FATCA-01, 2026-05-15)** · **VAT financial-services apportionment (PROC-TX-VAT-01, 2026-05-15)** · **Capital instrument issuance (PROC-CAP-CII-01, 2026-05-15)** · **POPIA IO designation (PROC-PRIV-IO-DSG-01, Batch C 2026-05-15)** · **Records retention disposal (PROC-RM-RD-01, Batch C 2026-05-15)** · **Naming pre-clearance (PROC-CORP-NC-01, Batch C 2026-05-15)** · **Event schema evolution (PROC-PLAT-EV-EVOL-01, Batch C 2026-05-15)** · **POPIA DSAR correction/deletion (PROC-PRIV-DSAR-COR-01, Batch C 2026-05-15)** · **POPIA s.72 transfer assessment (PROC-PRIV-CBT-01, Batch C 2026-05-15)** · **PAIA request handling (PROC-PAIA-RH-01, Batch C 2026-05-15)** · **Data retention and disposal (PROC-PRIV-RD-01, Batch C 2026-05-15)** · **ABC due diligence (PROC-COND-ABC-DD-01, Batch C 2026-05-15)** · **Whistleblowing case management (PROC-COND-WB-01, Batch C 2026-05-15)** · **RCSA cycle (PROC-RISK-RCSA-01, 2026-05-15)** · **Model validation (PROC-RSK-MV-01, 2026-05-15)** · **Counterparty institutional eligibility screening (PROC-CRM-CIE-01, 2026-05-15)** · **RMCP annual attestation (PROC-COMP-RMCP-01, 2026-05-15)** · **Complaints handling (PROC-COMP-TCF-01, 2026-05-15)** · **IRRBB measurement (PROC-RISK-IRRBB-01, 2026-05-15)** · **Intraday liquidity funding (PROC-RISK-ILF-01, 2026-05-15)** · **Climate scenario analysis (PROC-RISK-CSA-01, 2026-05-15)** · **New product due diligence (PROC-MK-NPA-DD-01, 2026-05-15)** · **Product controlled launch (PROC-MK-NPA-CL-01, 2026-05-15)** · **Product post-implementation review (PROC-MK-NPA-PIR-01, 2026-05-15)** · **Product retirement migration (PROC-MK-NPA-RET-01, 2026-05-15)** · **Outsourcing due diligence (PROC-OPS-OUTS-01, 2026-05-15)** · **Directive 3 PA notification (PROC-OPS-D3-01, 2026-05-15)** · **Cyber incident classification (PROC-IS-CIC-01, 2026-05-15)** · **Patch cadence (PROC-IS-PC-01, 2026-05-15)** · **Threat model review (PROC-SDLC-TM-01, 2026-05-15)** · **Crisis management activation (PROC-OR-CMA-01, 2026-05-15)** · **Access provisioning (PROC-IS-AP-01, 2026-05-15)** · **FTP rate attachment (PROC-ALM-FTP-01, Batch H 2026-05-16)** · **Hedge designation and effectiveness test (PROC-ALM-HDT-01, Batch H 2026-05-16)** · **Daily collateral valuation (PROC-ALM-CVD-01, Batch H 2026-05-16)** · **Trading mandate attestation (PROC-MK-MA-01, Batch I 2026-05-16)** · **Best execution monitoring (PROC-MK-BE-01, Batch I 2026-05-16)** · **Market abuse surveillance triage (PROC-MK-SUR-01, Batch I 2026-05-16)** · **Voice/comms recording retention (PROC-MK-REC-01, Batch I 2026-05-16)** · **Marketing claim validation (PROC-MK-MCV-01, Batch I 2026-05-16)** · **Annual remuneration review (PROC-HR-ARR-01, Batch J 2026-05-16)** · **Malus-clawback trigger (PROC-HR-MC-01, Batch J 2026-05-16)** · **Fit-and-proper attestation — non-KI (PROC-HR-FP-01, Batch J 2026-05-16)** · **Recruitment process (PROC-HR-REC-01, Batch J 2026-05-16)** · **Disciplinary process (PROC-HR-DISC-01, Batch J 2026-05-16)** · **Grievance process (PROC-HR-GRIEV-01, Batch J 2026-05-16)** · **Performance cycle (PROC-HR-PERF-01, Batch J 2026-05-16)** · **EE annual report (PROC-HR-EE-01, Batch J 2026-05-16)** · **WSP/ATR cycle (PROC-HR-WSP-01, Batch J 2026-05-16)** · **OHS incident (PROC-HR-OHS-01, Batch J 2026-05-16)** · **RMF governance (PROC-GOV-RMF-01, Batch K 2026-05-16)** · **Board papers (PROC-GOV-BP-01, Batch K 2026-05-16)** · **Credit origination (PROC-RISK-CO-01, Batch K 2026-05-16)** · **Cloud residency attestation (PROC-IS-CRA-01, Batch K 2026-05-16)** · **Legal hold (PROC-RMS-LH-01, Batch K 2026-05-16)** · **Code attestation (PROC-COND-CA-01, Batch K 2026-05-16)** · **Gift registration (PROC-COND-GR-01, Batch K 2026-05-16)** · **PA dealing pre-clearance (PROC-COND-PAD-01, Batch K 2026-05-16)** · **Contract execution (PROC-LEG-CE-01, Batch K 2026-05-16)** · **Litigation handling (PROC-LEG-LH-01, Batch K 2026-05-16)** · **Audit plan cycle (PROC-AUD-APC-01, Batch K 2026-05-16)** · **Findings tracking (PROC-AUD-FT-01, Batch K 2026-05-16)** · **Combined assurance map (PROC-AUD-CAM-01, Batch K 2026-05-16)** · **Credit risk limit management (PROC-RISK-CLM-01, 2026-05-20)** · **FRTB SA capital computation (PROC-RISK-FRTB-SA-01, 2026-05-20)** · **Back-testing governance (PROC-RISK-BACKTEST-01, 2026-05-20)** · **PLA test governance (PROC-RISK-PLA-01, 2026-05-20)** · **Market risk limit monitoring (PROC-RISK-MRL-01, 2026-05-20)** |
| **DRAFT** | 1 | **Balance sheet substantiation (Bea 2026-05-12; PROC-FIN-BSS-01)** |
| **STUB** | 0 | — all STUBs promoted to POPULATED 2026-05-15 |
| SUPERSEDED / MERGED | 1 | **samos-funding-daily.md** — scope merged into PROC-RISK-ILF-01 (`intraday-liquidity-funding.md`); file not created |
| PLANNED | ~1 | **swift-csp-attestation.md** — deferred; BIC application not yet lodged; CSP attestation cycle starts at first BIC (pre-licence milestone, Senna + Tomas) |
| **Total identified procedures** | **~91** across 14 domains |

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
