# Procedures library — index

**Curators:** Domain leads · Owen (procedural-discipline custodian) · Mira (citation linkage)
**As-of:** 2026-05-06

> Master inventory of every procedure under each approved policy. Each row demonstrates the **Reg → Policy → Procedure → System Capability** chain. Status: **`POPULATED`** = procedure file authored; **`STUB`** = file scaffolded; **`PLANNED`** = identified but not yet drafted.

## Foundation & meta-policies

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Risk Management Framework | `procedures-rmf-governance.md` | Helena | PLANNED |
| Governance Framework | `procedures-board-papers.md` | Owen | PLANNED |
| Delegation of Authority | `delegation-of-authority.md` | Owen + Devon | PLANNED |

## Risk

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Credit Risk Policy | `credit-origination.md` | Helena (future Head of Credit) | PLANNED |
| Market Risk Policy | `market-risk-monitoring.md` | Helena (Rohan) | PLANNED |
| Liquidity Risk Management Policy | [`capital-ratio-monitoring.md`](by-policy/capital-ratio-monitoring.md) (covers LCR / NSFR) | Camille + Eitan | **POPULATED** |
| Liquidity Risk Management Policy | `intraday-liquidity-funding.md` | Eitan | PLANNED |
| IRRBB Policy | `irrbb-measurement.md` | Helena + Eitan | PLANNED |
| Operational Risk Policy | `rcsa-cycle.md` | Helena + Devon | PLANNED |
| Operational Resilience Policy | `severe-but-plausible-test.md` | Devon | PLANNED |
| Model Risk Policy | `model-validation.md` | Helena (independent validation) | PLANNED |
| Stress Testing Policy | `stress-test-cycle.md` | Helena | PLANNED |
| Climate-Related Risk | `climate-scenario-analysis.md` | Helena (with S&E) | PLANNED |

## Compliance & financial crime

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| RMCP | `rmcp-annual-attestation.md` | Zara | PLANNED |
| AML / CFT Policy | `transaction-monitoring.md` | Zara (Mira) | PLANNED |
| Sanctions Policy | [`sanctions-screening.md`](by-policy/sanctions-screening.md) | Zara (Mira) + Senna | **POPULATED** |
| Sanctions Policy | `sanctions-override.md` | Zara | PLANNED |
| KYC / CDD / EDD Policy | [`kyc-onboarding.md`](by-policy/kyc-onboarding.md) | Zara (Mira) | **POPULATED** |
| KYC / CDD / EDD Policy | `kyc-recurring.md` | Zara (Mira) | PLANNED |
| KYC / CDD / EDD Policy | `kyc-continuous.md` | Zara (Mira) | PLANNED |
| Conduct of Business / TCF Policy | `complaints-handling.md` | Zara + Niko | PLANNED |
| FATCA / CRS Policy | `fatca-crs-annual-submission.md` | Yael (Mira) | PLANNED |
| Sanctions / FIC | `str-filing.md` | Zara (MLRO) | PLANNED |
| Sanctions / FIC | `tpr-filing.md` | Zara (MLRO) | PLANNED |
| Sanctions / FIC | `ctr-filing.md` | Zara (MLRO) | PLANNED |

## Privacy & data protection

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| POPIA / Privacy Policy | [`popia-breach-notification.md`](by-policy/popia-breach-notification.md) | Iris + Senna + Zara | **POPULATED** |
| POPIA / Privacy Policy | [`popia-dsar.md`](by-policy/popia-dsar.md) (data subject access request) | Iris + Anya + Senna | **POPULATED** |
| POPIA / Privacy Policy | `popia-dsar-correction.md` (correction / deletion) | Iris | PLANNED |
| Cross-Border Transfer Policy | `s72-transfer-assessment.md` | Iris (with Devon) | PLANNED |
| PAIA Manual | `paia-request-handling.md` | Iris + Owen | PLANNED |
| Data Retention | `retention-disposal.md` | Iris + Owen | PLANNED |

## Information security & cyber

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Information Security Policy | `access-provisioning.md` (joiner / mover / leaver) | Senna + Sade | PLANNED |
| Information Security Policy | `key-rotation.md` | Senna | PLANNED |
| Cyber Resilience Policy | [`incident-response.md`](by-policy/incident-response.md) (IR command) | Senna + Devon + Iris + Zara | **POPULATED** |
| Cyber Resilience Policy | `cyber-incident-classification.md` (severity tiering) | Senna + Iris | PLANNED |
| Vulnerability Management | `patch-cadence.md` | Senna | PLANNED |
| Change Management Policy | [`change-management.md`](by-policy/change-management.md) (release approval & deployment — merge-to-prod) | Devon + Atlas + Senna | **POPULATED** |
| Secure SDLC Policy | [`secure-sdlc.md`](by-policy/secure-sdlc.md) (idea-to-merge lifecycle; threat-model gate, supply chain, signed builds) | Senna + Rashida + Atlas | **POPULATED** |
| Secure SDLC Policy | `threat-model-review.md` (sub-procedure of Step 1) | Senna | PLANNED |

## Operations & technology

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Outsourcing & Third-Party Risk | `outsourcing-due-diligence.md` (pre-engagement) | Devon + Senna + Iris + Imani | PLANNED |
| Outsourcing & Third-Party Risk | `directive-3-pa-notification.md` | Devon | PLANNED |
| Cloud Computing | `cloud-residency-attestation.md` | Devon + Senna | PLANNED |
| BCP / DR | `dr-test-execution.md` | Devon | PLANNED |
| BCP / DR | `crisis-management-activation.md` | Devon + Helena | PLANNED |
| Records Management | `records-retention-disposal.md` | Owen + Devon | PLANNED |
| Records Management | `legal-hold.md` | Imani (with Owen) | PLANNED |
| Change Management + Secure SDLC + InfoSec (Atlas Step 2 substrate) | [`agent-runtime-deploy.md`](by-policy/agent-runtime-deploy.md) | Atlas · Senna · Rashida · Vera (audit) | **POPULATED** |

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
| Capital Management | `capital-instrument-issuance.md` | Camille + Eitan | PLANNED |
| Accounting Policies (IFRS) v0.1 (STUB) + Financial Reporting & Disclosure v0.1 (STUB) | [`posting-rule-publication.md`](by-policy/posting-rule-publication.md) | Bea · Atlas | **POPULATED** |
| Accounting Policies (IFRS) | `month-end-close.md` | Camille (Bea) | PLANNED |
| Accounting Policies (IFRS) | `ba-return-generation.md` | Bea | PLANNED |
| Provisioning / IFRS 9 ECL Policy v0.1 (STUB) + RAS (in-force) | [`ecl-stage-projection-refresh.md`](by-policy/ecl-stage-projection-refresh.md) | Rohan · Bea | **POPULATED** |
| IFRS 9 ECL | `ecl-staging-cycle.md` | Helena (Bea) | PLANNED |
| Tax | `corporate-tax-filing.md` | Yael | PLANNED |
| Tax | `vat-fs-apportionment.md` | Yael | PLANNED |
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
| Counterparty Onboarding (markets) | `counterparty-onboarding-markets.md` | Saskia + Imani + Eitan | PLANNED |
| New Product Approval | `npa-gate.md` | Saskia + Helena + Camille + Zara | PLANNED |

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
| FAIS Policy v0.1 (STUB, FSP-conditional) + Customer Treatment (TCF) v0.1 (STUB) | [`fais-advice-record-capture.md`](by-policy/fais-advice-record-capture.md) | Niko · Zara · Sade (paused build-phase; activates licence-day) | **POPULATED** |
| Customer Treatment (TCF) | `complaints-handling.md` | Niko + Zara | PLANNED |
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
| ABC Policy | `abc-due-diligence.md` (third parties) | Owen + Zara | PLANNED |
| Whistleblowing | `whistleblowing-case.md` | Owen | PLANNED |
| Gifts | `gift-registration.md` | Owen | PLANNED |
| Insider Trading / PA Dealing | `pa-dealing-pre-clearance.md` | Owen + Zara | PLANNED |

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
| **POPULATED** | 16 | KYC onboarding · Sanctions screening · Capital ratio monitoring · POPIA breach notification · IR command · Conflicts declaration · POPIA DSAR · Change management · Pricing approval · Secure SDLC · Counterparty governing-law clause adoption (Imani 2026-05-07) · Posting-rule publication (Bea 2026-05-07) · ECL stage projection refresh (Rohan 2026-05-07) · FAIS advice-record capture (Niko 2026-05-07; FSP-conditional) · Outbound payment sponsor-bank channel (Tomas 2026-05-07) · **Agent-runtime deploy (Atlas Step 2, 2026-05-07)** |
| PLANNED | ~64 | Drafting queue under domain leads, coordinated by Owen |
| **Total identified procedures** | **~80** across 14 domains |

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
