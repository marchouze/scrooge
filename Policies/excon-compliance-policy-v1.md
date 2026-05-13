---
policy-id: excon-compliance-policy
title: Exchange Control Compliance Policy v1
version: "1"
status: IN FORCE
owner: Zara (Chief Compliance Officer, governance)
effective-from: "2026-05-13"
citations:
  - Currency and Exchanges Act 9 of 1933
  - Exchange Control Regulations 1961 (as amended)
  - Banks Act 94 of 1990
  - Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv)
  - Financial Intelligence Centre Act 38 of 2001
  - D-REGULATORY-READINESS-GATE-PLAN
author: Zara (Chief Compliance Officer, governance) + Mira (Regulatory intelligence engineer, compliance)
date: 2026-05-13
summary: Standalone Exchange Control Compliance Policy covering Authorised Dealer obligations, BoP category coding for all 14 cross-border flow classes (goods, services, income, transfers, FDI, portfolio investment, other investment, derivatives, reserve assets, gold, gifts/donations, asset swaps, exempt flows, nil-value flows), OTC derivative non-resident reporting, and SARB FinSurv reporting accuracy framework. Closes obligations ORG-FX-FIN-01 through ORG-FX-FIN-14 and ORG-EXCON-ODP-001. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-FC
  - RT-CC
  - RT-MR
---

# Exchange Control Compliance Policy v1

> **Authors.** Zara (Chief Compliance Officer, governance) — lead; Mira (Regulatory intelligence engineer, compliance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-FX-FIN-01` (merchandise-trade BoP reporting), `ORG-FX-FIN-02` (services BoP reporting), `ORG-FX-FIN-03` (investment-income BoP reporting), `ORG-FX-FIN-04` (current-account transfers BoP reporting), `ORG-FX-FIN-05` (FDI flows — BoP reporting + SARB approval gates for outward FDI), `ORG-FX-FIN-06` (portfolio-investment flows BoP reporting), `ORG-FX-FIN-07` (other-investment flows BoP reporting), `ORG-FX-FIN-08` (financial-derivative cash-flows BoP reporting), `ORG-FX-FIN-09` (reserve-asset flows BoP reporting), `ORG-FX-FIN-10` (gold-account flows BoP reporting), `ORG-FX-FIN-11` (gifts/donations BoP reporting), `ORG-FX-FIN-12` (SARB-approved asset-swap transaction reporting), `ORG-FX-FIN-13` (Excon-exempt flow reporting with exempt-flow attestation code), `ORG-FX-FIN-14` (no-charge/nil-value cross-border flow reporting), `ORG-EXCON-ODP-001` (non-resident counterparty OTC derivative transactions: AD compliance + FinSurv reporting).
> **Status.** COMMENCEMENT-BIND. Authorised Dealer obligations under the Currency and Exchanges Act and the Exchange Control Regulations activate when the Bank first processes a cross-border transaction. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The Excon compliance programme substrate (BoP-code mapping library, FinSurv reporting workflow, approval-gate workflow, transaction ledger-to-FinSurv reconciliation) is under construction per the regulatory-readiness gate plan.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Authorised Dealer Status and Regulatory Standing

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual review; triggered on material business-model or regulatory change · **Citation:** Currency and Exchanges Act 9 of 1933, s.9 (designation of Authorised Dealers); Exchange Control Regulations 1961 (as amended) — Regulation 2 (AD dealing authority); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv, as amended); Banks Act 94 of 1990 (banking licence as a prerequisite for AD designation)

### Purpose

This section governs Hoz Bank Limited's standing as an Authorised Dealer (AD) under the Currency and Exchanges Act 9 of 1933 and the Exchange Control Regulations 1961 (as amended). AD status entitles the Bank to deal in foreign exchange and to facilitate cross-border transactions for clients on behalf of the South African Reserve Bank (SARB). AD status is granted by SARB FinSurv (the Financial Surveillance Department of SARB) and is a condition of the banking licence; it activates on commencement of banking operations.

Hoz Bank Limited is (or will be, upon commencement of banking operations) an Authorised Dealer as defined in the Currency and Exchanges Act. As an AD, the Bank operates as an agent of SARB in the administration of exchange control: it ensures that cross-border transactions comply with exchange control requirements, maintains required documentation, and reports all cross-border flows to SARB FinSurv with the correct Balance of Payments (BoP) category codes.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). The regulatory obligation (Currency and Exchanges Act + Exchange Control Regulations + AD Manual) sits above; procedures under this policy operationalise how the Bank fulfils its AD obligations; system capabilities (BoP-code mapping engine, FinSurv reporting module, transaction ledger, approval-gate workflow) execute those procedures. The policy does not reproduce the AD Manual; it anchors management choices above the statutory floor.

### AD Obligations Overview

As an Authorised Dealer, the Bank's primary obligations are:

- To process cross-border transactions only in accordance with the Exchange Control Regulations and the AD Manual;
- To verify supporting documentation before executing cross-border payments;
- To report all cross-border flows to SARB FinSurv with the correct BoP category code;
- To implement approval-gate workflows for transaction types requiring prior SARB approval;
- To maintain records of all cross-border transactions and supporting documentation for 5 years (FIC Act minimum);
- To cooperate with SARB FinSurv inspections;
- To ensure that the FinSurv reporting schema is updated whenever SARB amends the BoP category framework or reporting format.

### Maintaining AD Status in Good Standing

AD status is maintained in good standing by:

- Holding a banking licence in good standing (the precondition for AD designation);
- Continuously complying with the Exchange Control Regulations and the AD Manual;
- Submitting accurate and timely FinSurv reports for all cross-border flows;
- Maintaining required supporting documentation;
- Cooperating with SARB FinSurv on reporting queries, reconciliation requests, and inspections;
- Notifying SARB FinSurv of any material operational change affecting the Bank's cross-border transaction processing capability.

### Principles

- **AD status is integral to the banking licence.** The Bank cannot process cross-border transactions without AD status. Loss of AD status (suspension or revocation by SARB FinSurv) is a Critical event requiring immediate cessation of cross-border activity, CEO and Board notification, and engagement of external counsel. AD status revocation also triggers a potential PA reporting obligation under the Banks Act.
- **AD is an agent of SARB, not a principal.** The Bank acts as an agent of SARB in administering exchange control on cross-border transactions. The Bank does not make independent policy judgments about exchange control permissibility; it applies the Exchange Control Regulations and the AD Manual. Where a transaction falls outside the AD's concessional dealing authority, prior SARB approval is required.
- **FinSurv reporting is a primary compliance obligation.** Accurate, timely FinSurv reporting is the core of exchange control compliance. BoP misclassification is an Excon offence. The Bank treats FinSurv reporting accuracy with the same priority as capital-adequacy reporting and AML/CFT transaction monitoring.
- **Annual AD Manual review.** Zara (Chief Compliance Officer, governance) reviews the Currency and Exchanges Manual for Authorised Dealers annually and on each SARB FinSurv update. Mira (Regulatory intelligence engineer, compliance) tracks SARB FinSurv circular updates and Excon regulatory amendments; material changes to the AD Manual are incorporated into the BoP-code mapping library and the FinSurv reporting module within the PA-prescribed implementation timeline.
- **Inspection readiness is continuous.** SARB FinSurv conducts periodic on-site inspections of ADs. The Bank maintains continuous inspection readiness: supporting documentation retrievable within the production timeframe; FinSurv submission records reconciled against the transaction ledger; BoP-code mapping library current. Zara conducts a pre-inspection readiness review annually.

### Roles

Zara (Chief Compliance Officer, governance) is the AD compliance programme owner: responsible for the annual AD Manual review; the FinSurv reporting accuracy programme; the approval-gate governance framework; the supporting-documentation verification policy; and SARB FinSurv relationship management. Mira (Regulatory intelligence engineer, compliance — reports to Zara) tracks Excon regulatory change, SARB FinSurv circulars, and updates to the BoP reporting schema; updates the obligations register and the BoP-code mapping library. Bea (Accounting and financial reporting engineer, engineering — reports to Camille (Chief Financial Officer, governance)) builds and operates the FinSurv reporting module and the transaction ledger-to-FinSurv reconciliation engine. Imani (Legal-as-code engineer, engineering) provides legal-as-code support on the Currency and Exchanges Act chain. External counsel ratifies the approval-gate framework and the supporting-documentation verification protocols at the licence-application gate.

### Breach

Loss of AD status (suspension or revocation by SARB FinSurv) is a Critical event: immediate cessation of cross-border transaction processing; immediate CEO, Board, and PA notification; external counsel engaged. A BoP misclassification identified by SARB FinSurv — single transaction — is a Hard Breach: immediate root-cause analysis; correction and resubmission within the SARB-prescribed timeframe; reported to Zara and the Audit Committee. A systematic BoP misclassification pattern (same transaction type incorrectly coded across multiple submissions) is a Critical event: immediate voluntary disclosure to SARB FinSurv; remediation programme; Audit Committee notification.

---

## 2. BoP Classification Framework

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for BoP-code mapping library and updates · **Cadence:** Continuous per transaction; annual framework review; updated on each SARB FinSurv schema amendment · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv) — BoP category definitions; SARB Balance of Payments Reporting Guidelines (as amended); `ORG-FX-FIN-01` through `ORG-FX-FIN-14` (BoP category reporting obligations, COMMENCEMENT-BIND)

### Purpose

Every cross-border flow intermediated by the Bank must be reported to SARB FinSurv with the correct Balance of Payments (BoP) category code. The BoP classification framework divides all cross-border flows into two high-level accounts — the Current Account and the Capital and Financial Account — with sub-categories for each type of economic transaction. The AD bears statutory responsibility for correct BoP categorisation; a misclassification is an Excon offence regardless of whether the underlying transaction was otherwise permissible.

This section sets out the Bank's BoP classification framework, the governance of the BoP-code mapping library, and the principles by which each of the 14 reportable cross-border flow classes is categorised and reported.

### BoP Account Structure

The BoP is structured in two accounts:

**Current Account.** Records flows related to goods, services, income, and current transfers between residents and non-residents. The Current Account has four sub-categories:
- Goods (merchandise trade): `ORG-FX-FIN-01`
- Services: `ORG-FX-FIN-02`
- Investment income (dividends, interest, profit): `ORG-FX-FIN-03`
- Current transfers (remittances, gifts, donations, government transfers): `ORG-FX-FIN-04`, `ORG-FX-FIN-11`

**Capital and Financial Account.** Records flows related to capital transfers and the acquisition and disposal of financial assets and liabilities between residents and non-residents. The Capital and Financial Account has five sub-categories:
- Direct investment (FDI): `ORG-FX-FIN-05`
- Portfolio investment: `ORG-FX-FIN-06`
- Other investment (loans, deposits, trade credits, other): `ORG-FX-FIN-07`
- Financial derivatives: `ORG-FX-FIN-08`
- Reserve assets (in narrow agency/custody cases): `ORG-FX-FIN-09`

**Special category flows.** Gold account flows (`ORG-FX-FIN-10`), SARB-approved asset swaps (`ORG-FX-FIN-12`), Excon-exempt flows (`ORG-FX-FIN-13`), and no-charge/nil-value cross-border flows (`ORG-FX-FIN-14`) are reported in dedicated reporting streams outside the standard Current/Capital Account structure.

### BoP-Code Mapping Library

The Bank maintains a BoP-code mapping library that maps each transaction type processed by the Bank to the correct SARB FinSurv BoP category code and sub-code. The mapping library:

- Covers all 14 reportable flow classes (`ORG-FX-FIN-01` through `ORG-FX-FIN-14` and `ORG-EXCON-ODP-001`);
- Is structured as a typed data artefact in the Bank's system capabilities (not a spreadsheet or prose document) to enable automated BoP-code assignment at transaction level;
- Is updated within the PA-prescribed implementation timeline whenever SARB amends the BoP category framework or reporting schema;
- Is reviewed by Zara annually and on each SARB FinSurv update;
- Is validated by Vera in the annual Excon compliance audit scope;
- Is the canonical source for BoP categorisation — no ad hoc categorisation outside the mapping library is permitted.

The BoP-code mapping library is a Principle 2 canonical-source artefact. All FinSurv reporting, transaction-ledger BoP fields, and reconciliation tooling derive from the mapping library; no shadow categorisation or duplicated mapping is maintained.

### Principles

- **BoP categorisation is determined at transaction level, not account level.** Each cross-border flow event is individually categorised. The BoP code is assigned to the transaction at the point of processing, based on the transaction's economic nature, the supporting documentation, and the mapping library. Batch categorisation (applying a single code to a group of transactions of mixed economic nature) is prohibited.
- **Supporting documentation determines categorisation.** The BoP category code follows the economic nature of the transaction as evidenced by the supporting documentation (commercial invoice for goods; service agreement for services; loan agreement for loans; ISDA confirmation for derivatives). A mismatch between the supporting documentation and the BoP code assigned is a categorisation error.
- **Misclassification is an Excon offence.** The Bank treats BoP misclassification with the same regulatory severity as an AML/CFT transaction-reporting failure. A misclassification is not a mere administrative error; it is a statutory offence under the Currency and Exchanges Act. The Bank's zero-tolerance policy for deliberate misclassification extends to good-faith misclassification: if the Bank becomes aware of a misclassification, it corrects and resubmits to SARB FinSurv within the SARB-prescribed timeframe.
- **The mapping library is the single categorisation authority.** No BoP code is assigned to a cross-border flow by any means other than the mapping library. Manual overrides of the mapping library are prohibited without Zara approval and a mapping-library update; every override is a typed event (`BopCodeMappingOverride { transactionId, originalCode, overrideCode, basis, authorisedBy }`).
- **Schema updates are time-critical.** SARB FinSurv periodically updates the BoP reporting schema. The Bank must incorporate schema updates within the implementation timeline prescribed by SARB. Mira monitors SARB FinSurv circulars for schema updates; Bea (Accounting and financial reporting engineer, engineering) implements updates in the FinSurv reporting module; the updated mapping library is in production before the effective date of the schema change.

---

## 3. Current Account Flows

**Owner:** Zara (Chief Compliance Officer, governance) · **Cadence:** Per transaction · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv) — Current Account sections; `ORG-FX-FIN-01` through `ORG-FX-FIN-04`; `ORG-FX-FIN-11`

### Purpose

Current Account flows — goods, services, investment income, and current transfers — are the highest-volume cross-border flow types for an institutional trading and markets bank. For each Current Account flow, the Bank must: verify supporting documentation; assign the correct BoP category code from the mapping library; report the flow to SARB FinSurv; and retain supporting documentation for 5 years. This section sets out the standards and principles for each Current Account sub-category.

### 3.1 Goods (Merchandise Trade) — ORG-FX-FIN-01

Cross-border payments for goods (imports and exports of physical merchandise) are reported under the merchandise-trade sub-category of the Current Account. Supporting documentation: commercial invoice; bill of lading or equivalent shipping document; customs entry (SAD 500 or equivalent). The BoP code maps the direction of trade (import/export) and, where required by the SARB FinSurv schema, the commodity type. The Bank verifies that the value in the commercial invoice matches the payment instruction before executing the transaction.

For an institutional trading bank, merchandise-trade flows arise primarily in the context of commodity-finance transactions and structured trade-finance facilities. The commodity nature of the goods determines the BoP sub-code; Zara maintains a commodity-to-BoP-sub-code mapping within the mapping library for the Bank's commodity-finance product scope.

### 3.2 Services — ORG-FX-FIN-02

Cross-border payments for services (financial services, professional services, royalties, freight, travel, and other services) are reported under the services sub-category of the Current Account. Supporting documentation: services agreement or contract; invoice; evidence of service delivery. The BoP code distinguishes the type of service; the Bank's BoP-code mapping library maps service types to the correct SARB FinSurv services sub-codes.

For the Bank's institutional mandate, services flows include: payments for financial services received from international counterparties (custody, correspondent banking, prime brokerage); payments of management fees to or from related entities; payments under service-level agreements with non-resident technology or professional-service providers. Each service type has a designated BoP sub-code in the mapping library.

### 3.3 Investment Income — ORG-FX-FIN-03

Cross-border investment income flows — dividends paid to or received from non-resident shareholders; interest paid on cross-border borrowings or received on cross-border placements; profit remittances — are reported under the investment-income sub-category of the Current Account. Supporting documentation: dividend declaration; loan agreement; interest calculation statement; profit computation. The BoP code distinguishes the income class (dividend, interest, profit).

For the Bank's institutional markets business, investment-income flows include: interest paid on non-resident deposits held at the Bank; interest received on cross-border money-market placements; interest payments under cross-border OTC derivative collateral arrangements (where treated as income rather than derivative cash flow). Zara's BoP-code mapping library distinguishes these from capital-account derivative flows (`ORG-FX-FIN-08`).

### 3.4 Current Transfers — ORG-FX-FIN-04

Current transfers — remittances, government transfers, and other unilateral transfers not constituting capital — are reported under the transfers sub-category of the Current Account. Supporting documentation varies by transfer type; the Bank verifies that the transfer is genuinely a current transfer (not a capital transfer or disguised capital movement) before assigning the current-transfers BoP code.

### 3.5 Gifts and Donations — ORG-FX-FIN-11

Cross-border gifts and donation flows are reported under the gifts/donations BoP category. Supporting documentation: written declaration of gift; evidence of recipient identity; donor authorisation. The Bank processes gift and donation flows within the Exchange Control Regulations' concessional allowances where applicable. Flows exceeding concessional limits require prior SARB approval (per §6 — Approval Gates).

---

## 4. Capital and Financial Account Flows

**Owner:** Zara (Chief Compliance Officer, governance) · **Cadence:** Per transaction · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv) — Capital and Financial Account sections; `ORG-FX-FIN-05` through `ORG-FX-FIN-10`; `ORG-EXCON-ODP-001`

### Purpose

Capital and Financial Account flows — direct investment, portfolio investment, other investment, financial derivatives, and reserve assets — are the flows most directly relevant to the Bank's institutional markets mandate. These flows attract heightened Excon scrutiny; several sub-categories (notably outward FDI and certain portfolio-investment flows) require prior SARB approval. This section sets out the standards and principles for each Capital and Financial Account sub-category.

### 4.1 Foreign Direct Investment — ORG-FX-FIN-05

FDI flows — cross-border equity investments representing a lasting interest and significant influence or control — are reported under the FDI sub-category of the Capital and Financial Account. The BoP code distinguishes the direction (inward or outward FDI) and the instrument type (equity, reinvested earnings, other capital).

**Inward FDI.** Non-resident equity investment into South African entities is reported as inward FDI. The Bank may facilitate inward FDI transactions within its AD authority, subject to supporting documentation (share subscription agreement, proof of non-resident status of investor, CIPC records). Inward FDI flows do not require prior SARB approval in most cases; the AD verifies compliance with the Exchange Control Regulations and reports to FinSurv.

**Outward FDI.** South African resident equity investment into foreign entities (outward direct investment) requires prior SARB approval through the Excon approval-gate process (per §6 — Approval Gates). The Bank must obtain SARB approval before facilitating outward FDI flows on behalf of resident clients. The approval event (`SarbApprovalObtained { transactionId, approvalType: "outward-FDI", approvalReference, approvedAt }`) is recorded in the event log before the transaction is executed. Supporting documentation: business plan or investment rationale; legal structure of the offshore investment; SARB approval letter.

### 4.2 Portfolio Investment — ORG-FX-FIN-06

Portfolio investment flows — cross-border transactions in equity securities, debt securities, and collective investment scheme units not qualifying as FDI — are reported under the portfolio-investment sub-category of the Capital and Financial Account. The BoP code distinguishes the asset type (equity, long-term debt, short-term debt, other) and the direction (asset or liability side of the non-resident's balance sheet).

For the Bank's institutional markets business, portfolio-investment flows are a primary flow type: secondary-market trading in foreign bonds and equities on behalf of resident institutional clients; non-resident investment in South African bonds and equities facilitated by the Bank as an AD. The Bank's BoP-code mapping library maps each security type and transaction direction to the correct SARB FinSurv portfolio-investment sub-code.

South African residents' outward portfolio investment is subject to Exchange Control Regulations allowances (institutional investors' foreign investment allowances, individual foreign capital allowances). The Bank verifies that resident portfolio-investment outflows are within approved allowances before processing. Where an allowance has been exhausted or a specific approval is required, the approval-gate process (§6) is triggered.

### 4.3 Other Investment — ORG-FX-FIN-07

Other investment flows — cross-border loans, deposits, trade credits, and other financial claims and liabilities not classified as FDI, portfolio investment, derivatives, or reserve assets — are reported under the other-investment sub-category. The BoP code distinguishes the instrument type (loan, deposit, trade credit, other) and the sector of the counterparty.

For the Bank's institutional markets business, other-investment flows include: cross-border interbank deposits (nostro/vostro); cross-border term loans to or from non-resident financial institutions; trade-credit flows on commodity-finance transactions; cross-border collateral postings under CSAs that constitute deposits rather than derivative cash flows. The mapping library distinguishes other-investment deposits from portfolio-investment debt securities and from derivative collateral flows.

### 4.4 Financial Derivatives — ORG-FX-FIN-08

Financial derivative cash flows — premiums, settlements, margin calls, and other cash movements in respect of OTC and listed derivative transactions with non-resident counterparties — are reported under the financial-derivatives sub-category of the Capital and Financial Account. The BoP code distinguishes the derivative type (foreign exchange, interest rate, credit, equity, commodity) where required by the SARB FinSurv schema.

For the Bank's institutional OTC derivatives business, derivatives-class BoP reporting (`ORG-FX-FIN-08`) is a primary flow type. Every cash movement in respect of an OTC derivative transaction with a non-resident counterparty — initial margin, variation margin, premium payment, final settlement — is reported to SARB FinSurv with the correct derivatives-class BoP code. This obligation runs in parallel with (and is not subsumed by) trade-reporting to the Strate TR (`ORG-FMA-003`) or margin reporting under PA/FSCA Joint Standard 2 of 2024 (`ORG-JN2-2024`); the three reporting streams are distinct and each must be fully satisfied.

Derivative BoP reporting for non-resident counterparties is also the subject of `ORG-EXCON-ODP-001` (per §5 of this policy), which addresses the AD compliance framework for non-resident OTC derivative transactions more broadly.

### 4.5 Reserve Assets — ORG-FX-FIN-09

Reserve-asset flows are reported by the Bank only in narrow agency or custody cases where the Bank holds or transacts reserve assets on behalf of SARB or another authorised entity. The Bank does not hold reserve assets on its own balance sheet. Where reserve-asset flows arise in the context of agency/custody relationships, the Bank reports them to SARB FinSurv with the reserve-asset BoP code and in the format specified by SARB for the relevant transaction type.

### 4.6 Gold Account Flows — ORG-FX-FIN-10

Gold account flows — cross-border movements of monetary gold or gold-related financial instruments — are reported to SARB FinSurv in the dedicated gold-flow reporting stream. Supporting documentation: gold transfer documentation; gold account statements; physical-delivery documentation if applicable. The Bank's exposure to gold-flow reporting arises primarily in the context of gold-related OTC derivative and structured product transactions with non-resident counterparties. The gold-flow BoP code is distinct from the commodity-goods code for physical gold merchandise trade.

---

## 5. OTC Derivatives with Non-Resident Counterparties — ORG-EXCON-ODP-001

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for non-resident derivative transaction framework · **Cadence:** Per transaction; quarterly compliance review · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv) — OTC derivative non-resident provisions; `ORG-EXCON-ODP-001` (non-resident counterparty OTC derivative AD compliance + FinSurv reporting, COMMENCEMENT-BIND)

### Purpose

OTC derivative transactions with non-resident counterparties are subject to a specific exchange control compliance framework under the Exchange Control Regulations and the AD Manual. The Bank, as an Authorised Dealer, must: verify that non-resident counterparty OTC derivative transactions are within the Bank's AD authority; ensure that all cash flows (premiums, settlements, margin) are reported to SARB FinSurv as derivatives-class BoP flows per `ORG-FX-FIN-08`; and maintain supporting documentation (ISDA Master Agreement, Confirmations, CSA) for each non-resident counterparty relationship.

### AD Authority for Non-Resident Derivative Transactions

The Bank's AD authority covers OTC derivative transactions with non-resident counterparties in the product classes within the Bank's licensed scope. The following principles govern AD authority for non-resident OTC derivative transactions:

- Transactions within the Bank's AD concessional authority (per the AD Manual for the relevant product class) are executed within the Bank's own authority, subject to FinSurv reporting.
- Transactions that exceed the Bank's AD concessional authority (e.g., transactions that would result in a net offshore derivative exposure exceeding the FinSurv-prescribed threshold for the relevant product class) require prior SARB approval through the approval-gate process (§6).
- The Bank does not rely on general concessional authority without verifying, per transaction type, that the transaction falls within the relevant AD concessional provision in the AD Manual.

### Non-Resident Counterparty Identification

Before entering into an OTC derivative transaction with a non-resident counterparty, the Bank:

- Verifies the non-resident status of the counterparty through the ISDA onboarding documentation and the party register (per `Regulations/_party-register.md`);
- Records the counterparty's non-resident classification (`NonResidentStatusVerified { partyId, basisOfVerification, effectiveDate }`) in the event log;
- Confirms that the transaction type is within the Bank's AD authority for non-resident derivative counterparties.

### FinSurv Reporting for Derivative Cash Flows

Every cash flow in respect of a non-resident counterparty OTC derivative transaction is reported to SARB FinSurv with the derivatives-class BoP code per `ORG-FX-FIN-08`. This includes:

- **Premium payments.** Initial premium paid or received on option transactions.
- **Variation margin.** Daily variation margin flows under a CSA or ISDA margin protocol (where margin is characterised as a settlement flow and not a deposit).
- **Initial margin.** Initial margin posted to or received from non-resident counterparties or non-resident CCPs acting as intermediaries.
- **Final settlement.** Net or gross settlement on OTC derivative maturity or early termination.
- **Close-out payments.** Any close-out netting payment on termination of the ISDA Master Agreement.

Each derivative cash flow generates a `DerivativeCashFlowReported { transactionId, partyId, flowType, bopCode, amount, currency, reportedAt }` typed event in the event log. The event is the canonical record; the FinSurv submission is a render of the event stream.

### Interaction with Trade Reporting and Margin Reporting

The `ORG-EXCON-ODP-001` Excon/FinSurv reporting obligation is separate from and runs in parallel with:

- **Trade reporting (`ORG-FMA-003`).** Under the Financial Markets Act 19 of 2012 and FSCA rules, OTC derivative transactions above the reporting threshold must be reported to the Strate Trade Repository. Trade reporting captures transaction economics (notional, tenor, rate, counterparty identity); it does not satisfy the Excon FinSurv BoP-flow reporting obligation.
- **Margin reporting (`ORG-JN2-2024`).** Under PA/FSCA Joint Standard 2 of 2024 on margin requirements for non-centrally cleared OTC derivatives, margin-flow data must be reported in the prescribed format. Margin reporting captures risk-management data; it does not satisfy the Excon FinSurv BoP-flow reporting obligation.

All three reporting streams must be independently satisfied for each eligible transaction. Zara's compliance monitoring includes a quarterly cross-check confirming that every non-resident OTC derivative cash flow reported in the trade repository and margin reporting system has a corresponding FinSurv BoP submission.

### Principles

- **Non-resident OTC derivative transactions are exchange-control-regulated.** Every OTC derivative transaction with a non-resident counterparty is subject to the Exchange Control Regulations, regardless of whether the derivative is hedging an underlying exposure or is a standalone structured product. There is no carve-out for derivatives from the FinSurv reporting obligation.
- **All cash flows are reportable, including margin.** Initial margin, variation margin, and settlement flows are all reportable to SARB FinSurv as derivatives-class BoP flows. Margin flows are not classified as deposits for BoP purposes unless the SARB FinSurv schema specifically requires margin to be reported under the other-investment deposits sub-code; Zara resolves any ambiguity with SARB FinSurv before the relevant product type is activated.
- **Three parallel reporting obligations are not interchangeable.** Trade reporting (Strate TR), margin reporting (PA/FSCA Joint Standard 2 of 2024), and Excon FinSurv BoP reporting are three distinct legal obligations with three distinct regulators (FSCA, PA, SARB FinSurv). Compliance with one does not satisfy the others.
- **Non-resident status is verified pre-transaction, not post.** The Bank verifies counterparty non-resident status before entering into the ISDA Master Agreement and before each transaction where a change in non-resident status is possible. A transaction with a misidentified counterparty (resident treated as non-resident or vice versa) is an Excon compliance failure.
- **ISDA documentation is the supporting document for derivative FinSurv reporting.** The ISDA Master Agreement, Schedule, Confirmations, and CSA constitute the supporting documentation for derivative cash-flow FinSurv reporting. These documents are retained for 5 years from the termination date of the relevant ISDA Master Agreement.

### Breach

A derivative cash flow reported to the Strate TR or recorded in margin reporting but not reported to SARB FinSurv is a compliance gap: identified in the quarterly cross-check; corrected within 10 business days; root cause documented. A systematic pattern of unreported derivative cash flows is a Critical Excon compliance event: voluntary disclosure to SARB FinSurv; remediation programme; CEO and Audit Committee notification.

---

## 6. Approval Gates — Prior SARB Approval Requirements

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for approval-gate framework design · **Cadence:** Per transaction requiring prior approval; annual framework review · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv) — prior-approval provisions; `ORG-FX-FIN-05` (outward FDI approval gate)

### Purpose

Certain cross-border transactions are not within the Bank's AD concessional authority and require prior approval from SARB FinSurv before the Bank may execute or facilitate them. The approval-gate framework ensures that the Bank identifies such transactions pre-execution, obtains the required SARB approval, and records the approval before executing the transaction.

### Categories Requiring Prior Approval

The following cross-border flow types require prior SARB approval in the general case (subject to specific concessional provisions in the AD Manual that Zara maintains in the BoP-code mapping library):

- **Outward FDI.** Outward direct investment by South African residents into foreign entities generally requires SARB approval through the Exchange Control Regulations approval process, unless it falls within a specific AD concessional provision. Refer §4.1.
- **Capital account flows above concessional thresholds.** Portfolio investment outflows by resident institutional investors in excess of the foreign investment allowance approved by the SARB for the relevant entity class require specific SARB approval or a Board of Directors' resolution confirming the allowance basis. The Bank verifies the resident investor's available allowance before processing.
- **Certain OTC derivative transactions.** Non-resident counterparty derivative transactions that result in net offshore derivative exposure exceeding the Bank's AD concessional threshold require prior SARB approval per §5.3.
- **Asset swaps.** SARB-approved asset-swap transactions (`ORG-FX-FIN-12`) are transactions that have been specifically approved by SARB under the asset-swap mechanism; the Bank may process approved asset swaps and must report them in the dedicated asset-swap reporting stream.
- **Other capital-account flows.** Any capital-account flow that does not fall within a clearly applicable AD concessional provision in the AD Manual triggers an approval-gate assessment: Zara assesses the transaction against the AD Manual and, if prior approval is required, initiates the SARB approval application.

### Approval-Gate Workflow

The approval-gate workflow operates as follows:

1. **Identification.** The transaction is flagged as potentially requiring prior SARB approval, either by the BoP-code mapping library (which tags transaction types that require approval-gate assessment) or by the relationship or trading team.
2. **Assessment.** Zara assesses the transaction against the AD Manual within 2 business days of the flagging. The assessment determines: does the transaction require prior SARB approval? Is there an applicable AD concessional provision? What supporting documents are required?
3. **Application (if required).** If prior approval is required, Zara prepares and submits the SARB approval application through the FinSurv approval channel, with full supporting documentation. The application event: `SarbApprovalApplicationSubmitted { transactionId, approvalType, submittedAt }`.
4. **Approval receipt.** SARB FinSurv's approval is received in writing. The approval event: `SarbApprovalObtained { transactionId, approvalType, approvalReference, approvedAt, conditions[] }`.
5. **Conditions compliance.** Any conditions attached to the SARB approval are implemented before transaction execution. Zara confirms conditions compliance and records: `SarbApprovalConditionsMetConfirmed { transactionId, approvalReference, confirmedAt }`.
6. **Execution gate.** The transaction is executed only after the `SarbApprovalObtained` event (and, if applicable, `SarbApprovalConditionsMetConfirmed`) is in the event log. No transaction requiring prior approval is executed without the approval event on record.
7. **Post-execution reporting.** The executed transaction is reported to SARB FinSurv with the correct BoP code and the SARB approval reference number in the reporting submission.

### Principles

- **No execution before approval.** A transaction requiring prior SARB approval is not executed until the approval is obtained and recorded in the event log. The execution gate (step 6 above) is a hard system gate: the trade-processing workflow checks for the `SarbApprovalObtained` event before allowing execution on flagged transaction types.
- **Approval-gate assessment is not optional.** Any transaction flagged by the BoP-code mapping library as requiring approval-gate assessment must complete the assessment process, even if the assessment concludes that no approval is required. The assessment outcome — `ApprovalGateAssessmentCompleted { transactionId, requiresApproval: true | false, basis }` — is recorded in the event log for every flagged transaction.
- **SARB approval conditions are binding.** Conditions attached to a SARB approval are binding compliance obligations, not suggestions. Zara monitors conditions compliance throughout the life of the approved transaction.
- **Expired approvals are not re-used.** SARB approvals are time-limited. An expired SARB approval may not be applied to a subsequent transaction of the same type; a fresh application is required. Zara's approval-management workflow tracks approval expiry dates.
- **Approval-gate assessment results feed the mapping library.** The outcome of each approval-gate assessment — specifically, the identification of a transaction type that consistently requires approval — is used to update the BoP-code mapping library to flag that transaction type for approval-gate assessment in future. The library is a living document.

### Breach

Execution of a cross-border transaction that required prior SARB approval without obtaining that approval is a serious Excon offence under the Currency and Exchanges Act. On discovery: immediate cessation of further transactions of the same type pending review; voluntary disclosure to SARB FinSurv within the shortest practical timeframe; remediation programme; CEO, Board, and external-counsel notification.

---

## 7. Supporting Documentation and Verification

**Owner:** Zara (Chief Compliance Officer, governance) · **Cadence:** Per transaction · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv) — documentation requirements; Financial Intelligence Centre Act 38 of 2001 — 5-year retention minimum

### Purpose

Before executing a cross-border payment or facilitating a cross-border transaction, the Bank as an AD must verify that supporting documentation is on file, is consistent with the nature of the transaction, and supports the BoP categorisation assigned. The supporting-documentation verification obligation is both an exchange-control requirement (verifying that the transaction is permissible) and an AML/CFT requirement (verifying the economic purpose of the payment).

### Documentation Standards by Flow Type

The Bank maintains a supporting-documentation standards matrix that maps each flow type to the required documentation. The matrix is consistent with the AD Manual documentation requirements and is maintained in the Bank's BoP-code mapping library:

| Flow type | Primary supporting document | Secondary document (where required) |
|---|---|---|
| Merchandise trade (goods) | Commercial invoice | Bill of lading; customs entry (SAD 500 or equivalent) |
| Services | Services agreement or invoice | Evidence of service delivery |
| Investment income | Dividend declaration / loan agreement / interest statement | Board resolution (for dividends) |
| Current transfers | Declaration of transfer purpose | Identity verification of recipient |
| FDI (inward) | Share subscription agreement | CIPC records; proof of non-resident status |
| FDI (outward) | SARB approval letter; share subscription agreement | Business plan or investment rationale |
| Portfolio investment | Trade confirmation; broker records; custodian statement | Allowance verification documentation |
| Other investment (loans) | Loan agreement | Repayment schedule |
| Other investment (deposits) | Deposit instruction; account agreement | — |
| Financial derivatives | ISDA Master Agreement; Confirmation; CSA | Non-resident status verification |
| Reserve assets | SARB instruction or custodian mandate | — |
| Gold | Gold transfer documentation; gold account statements | Physical-delivery documentation (if applicable) |
| Asset swaps | SARB approval letter; swap agreement | — |
| Exempt flows | Exempt-category attestation | Applicable threshold verification |
| No-charge flows | No-charge declaration | Description of basis for no-charge flow |

### Verification Process

Documentation verification is performed by the Bank's operations or compliance function before execution:

1. The transaction instruction is received with supporting documentation.
2. The operations function checks that the required documents per the standards matrix are present and complete.
3. The compliance function (or the operations function under a Zara-approved delegation) verifies that the documents are consistent with the transaction: the amount matches the invoice; the parties match the agreement; the document is dated appropriately; the document is genuine.
4. The BoP code is assigned based on the verified documentation.
5. A `DocumentationVerified { transactionId, documentTypes[], verifiedBy, verifiedAt }` typed event is recorded.
6. The transaction is released for execution.

### Retention

All supporting documentation is retained for a minimum of 5 years from the date of the transaction, per the FIC Act minimum. Documentation is stored in the BLAKE3 content-addressed document store per `D-RMS-PHASE-1`, retrievable by SARB FinSurv on inspection request within the production timeframe. Zara conducts an annual supporting-documentation retrieval test as part of the SARB inspection-readiness programme.

### Principles

- **No execution without verified documentation.** The documentation verification step (step 3 above) is a hard gate: no cross-border payment instruction is released without a `DocumentationVerified` event in the event log. This principle is enforced at the system level in the transaction-processing workflow.
- **Documentation must match the transaction.** A commercial invoice that does not match the payment amount or the counterparty name on the payment instruction is not adequate supporting documentation; it is a documentation-verification failure that halts execution pending resolution. Zara investigates mismatches immediately.
- **5-year retention is a floor.** The Bank retains supporting documentation for the period required by the applicable obligation: FIC Act (5 years from transaction date); SARB AD Manual (5 years from transaction date); FAIS GCC (5 years from advice interaction — if the payment is also an advice-related flow). The longest applicable retention period governs.
- **Exempt flows require positive attestation.** Excon-exempt flows (`ORG-FX-FIN-13`) are not omitted from FinSurv reporting; they are reported with the exempt-flow attestation code. The Bank must verify that the flow qualifies for the claimed exemption (threshold verification; eligible recipient verification) before assigning the exempt code.
- **No-charge flows are reported, not omitted.** Nil-value or no-charge cross-border flows (`ORG-FX-FIN-14`) — transfers of assets without cash consideration, intra-group flows at nil value, or flows where the economic value is embedded in another transaction — are reported to SARB FinSurv with the no-charge BoP category code and a declaration of the basis for the no-charge characterisation. Omission of no-charge flows from FinSurv reporting is an Excon breach.

---

## 8. FinSurv Reporting and Reconciliation

**Owner:** Bea (Accounting and financial reporting engineer, engineering) — FinSurv reporting system; Zara (Chief Compliance Officer, governance) — compliance oversight and reconciliation sign-off · **Cadence:** Per transaction (real-time or batch per SARB FinSurv schema); monthly reconciliation · **Citation:** Exchange Control Regulations 1961 (as amended); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv); SARB BoP Reporting Guidelines; `ORG-FX-FIN-01` through `ORG-FX-FIN-14`; `ORG-EXCON-ODP-001`

### Purpose

FinSurv reporting is the mechanism by which the Bank fulfils its AD BoP reporting obligations. Every cross-border flow intermediated by the Bank is reported to SARB FinSurv in the format and within the timeline prescribed by the AD Manual. This section governs the FinSurv reporting module, the reporting timeline, and the monthly reconciliation between the Bank's transaction ledger and FinSurv submissions.

### Reporting Module

The FinSurv reporting module is a system capability operated by Bea (Accounting and financial reporting engineer, engineering). The module:

- Consumes the transaction event stream from the Bank's core banking and trading systems;
- Applies the BoP-code mapping library to assign the correct BoP category code to each transaction;
- Formats the FinSurv submission in the SARB-prescribed schema (as updated by SARB from time to time);
- Submits FinSurv reports to SARB FinSurv within the prescribed reporting timeline;
- Records the submission as a typed event: `FinSurvReportSubmitted { reportId, batchId, transactionIds[], submittedAt, finsurv Acknowledgment }`.

The FinSurv reporting module is a canonical system capability: no parallel or shadow FinSurv reporting is maintained. All FinSurv submissions derive from the transaction event stream; no manual FinSurv submissions are permitted without Zara approval and a `ManualFinSurvSubmission { transactionId, basis, authorisedBy }` typed event.

### Reporting Timeline

The Bank reports cross-border flows to SARB FinSurv within the timelines prescribed by the AD Manual for each flow type. The mapping library records the applicable reporting timeline for each flow type. Where the AD Manual is silent on a specific timeline, the Bank reports within 5 business days of the transaction date as a conservative default. Mira monitors the AD Manual for timeline changes and updates the mapping library accordingly.

### Monthly Reconciliation

The Bank performs a monthly reconciliation between:

- The transaction ledger: all cross-border flow events recorded in the event log for the relevant month;
- The FinSurv submissions: all `FinSurvReportSubmitted` events for the relevant month.

The reconciliation confirms that:

- Every transaction-ledger entry has a corresponding FinSurv submission;
- The BoP code in the FinSurv submission matches the code in the BoP-code mapping library for the transaction type;
- The reported amount and currency match the transaction-ledger entry;
- No FinSurv submission references a transaction not in the transaction ledger (phantom submission).

The reconciliation is performed by Bea and reviewed by Zara. The reconciliation outcome: `FinSurvReconciliationCompleted { month, openItems[], resolvedItems[], signedOffBy, signedOffAt }`. Open items are resolved within 10 business days; unresolved items at 20 business days are escalated to Zara and the Audit Committee.

### Principles

- **Real-time or batch per schema, not delayed.** The Bank reports FinSurv data within the prescribed timeline. Delayed reporting — even where the underlying transaction was fully compliant — is an Excon breach.
- **Monthly reconciliation is mandatory.** The reconciliation between the transaction ledger and FinSurv submissions is not a discretionary management control; it is a mandatory compliance control. A month without a completed `FinSurvReconciliationCompleted` event is a compliance gap escalated to Zara immediately.
- **Schema updates are tested before deployment.** When SARB FinSurv updates the BoP reporting schema, Bea tests the updated FinSurv reporting module against a synthetic fixture before deploying it to production. Deployment to production without a passed test is not permitted. The test event: `FinSurvSchemaUpdateTested { schemaVersion, testDate, passedAt }`.
- **Manual submissions are exception events.** A manual FinSurv submission (a submission not generated by the reporting module) is an exception event recorded in the event log. Manual submissions arise only in system-outage scenarios; they are subject to Zara approval and reconciled into the monthly reconciliation as open items until confirmed.
- **SARB FinSurv inspection readiness.** The Bank maintains SARB FinSurv inspection readiness at all times: FinSurv submission records retrievable by transaction date, BoP code, and counterparty; supporting documentation retrievable within the SARB-prescribed production timeframe; monthly reconciliation records available for the prior 5 years.

---

## 9. Obligations Closure Table

The following obligations-register rows are closed by this policy. Status per the obligations-register convention.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-FX-FIN-01` | Report cross-border goods payments to SARB FinSurv with correct merchandise-trade BoP category code | **COMMENCEMENT-BIND** — closed | §2 (BoP Classification Framework), §3.1 (Goods) |
| `ORG-FX-FIN-02` | Report cross-border services payments with correct services BoP category code | **COMMENCEMENT-BIND** — closed | §2 (BoP Classification Framework), §3.2 (Services) |
| `ORG-FX-FIN-03` | Report cross-border investment-income flows with correct income-class BoP category code | **COMMENCEMENT-BIND** — closed | §2 (BoP Classification Framework), §3.3 (Investment Income) |
| `ORG-FX-FIN-04` | Report current-account transfers with correct transfer-class BoP category code | **COMMENCEMENT-BIND** — closed | §2 (BoP Classification Framework), §3.4 (Current Transfers) |
| `ORG-FX-FIN-05` | Report FDI flows with correct FDI-class BoP code; apply SARB approval gates for outward FDI | **COMMENCEMENT-BIND** — closed | §4.1 (FDI), §6 (Approval Gates) |
| `ORG-FX-FIN-06` | Report portfolio-investment flows with correct portfolio-investment-class BoP code | **COMMENCEMENT-BIND** — closed | §4.2 (Portfolio Investment) |
| `ORG-FX-FIN-07` | Report other-investment flows (loans, deposits, trade credits) with correct other-investment-class BoP code | **COMMENCEMENT-BIND** — closed | §4.3 (Other Investment) |
| `ORG-FX-FIN-08` | Report financial-derivative cash-flows with correct derivatives-class BoP code | **COMMENCEMENT-BIND** — closed | §4.4 (Financial Derivatives), §5 (OTC Derivatives Non-Resident) |
| `ORG-FX-FIN-09` | Report reserve-asset category flows in narrow agency/custody cases | **COMMENCEMENT-BIND** — closed | §4.5 (Reserve Assets) |
| `ORG-FX-FIN-10` | Report gold-account flows to SARB FinSurv | **COMMENCEMENT-BIND** — closed | §4.6 (Gold Account Flows) |
| `ORG-FX-FIN-11` | Report gift/donation flows with correct BoP category code | **COMMENCEMENT-BIND** — closed | §3.5 (Gifts and Donations) |
| `ORG-FX-FIN-12` | Report SARB-approved asset-swap transactions | **COMMENCEMENT-BIND** — closed | §6 (Approval Gates — asset swaps) |
| `ORG-FX-FIN-13` | Report flows under Excon-exempt categories with exempt-flow attestation code | **COMMENCEMENT-BIND** — closed | §7 (Supporting Documentation — exempt flows) |
| `ORG-FX-FIN-14` | Report no-charge/nil-value cross-border flows with no-charge category code | **COMMENCEMENT-BIND** — closed | §7 (Supporting Documentation — no-charge flows) |
| `ORG-EXCON-ODP-001` | Non-resident counterparty OTC derivative transactions: AD compliance + FinSurv reporting | **COMMENCEMENT-BIND** — closed | §5 (OTC Derivatives with Non-Resident Counterparties — full section) |

---

## 10. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream substrate slices.

### 10.1 Substrate currently under construction

- **BoP-code mapping library (as typed system capability).** The mapping library is described in this policy as a typed data artefact; it does not yet exist as a deployed system capability. Discharge exit signal: mapping library as a structured data schema; automated BoP-code assignment in the transaction-processing workflow; `BopCodeAssigned { transactionId, bopCode }` event type active.
- **FinSurv reporting module.** The FinSurv reporting module (consuming the transaction event stream, applying the mapping library, formatting SARB submissions) is not yet built. Discharge exit signal: `FinSurvReportSubmitted` event type active; monthly reconciliation recon live; schema-update test harness passing on synthetic fixture.
- **Approval-gate workflow.** The approval-gate workflow (transaction flagging, assessment, SARB application, approval recording, execution gate) is not yet built. Discharge exit signal: `ApprovalGateAssessmentCompleted` and `SarbApprovalObtained` event types active; execution gate enforced on test scenario.
- **Supporting-documentation verification gate.** The `DocumentationVerified` event type and the documentation-verification gate in the transaction-processing workflow are not yet built. Discharge exit signal: event type active; transaction-processing workflow blocked without `DocumentationVerified` event for cross-border payment types.
- **Monthly reconciliation engine.** The reconciliation engine (transaction ledger vs FinSurv submissions, `FinSurvReconciliationCompleted` event) is not yet built. Discharge exit signal: reconciliation event type active; monthly reconciliation run in test scenario; open-item escalation workflow wired.

### 10.2 Procedures planned but not yet authored

- `Procedures/by-policy/excon-bop-categorisation.md` — BoP categorisation procedure: mapping-library update, transaction-level code assignment, documentation verification.
- `Procedures/by-policy/excon-finsurv-reporting.md` — FinSurv reporting procedure: submission timeline, schema-update protocol, monthly reconciliation.
- `Procedures/by-policy/excon-approval-gate.md` — SARB approval-gate procedure: transaction flagging, assessment, application, receipt, conditions compliance, execution gate.
- `Procedures/by-policy/excon-inspection-readiness.md` — SARB FinSurv inspection readiness procedure: annual pre-inspection review, documentation retrieval test, reconciliation record review.

### 10.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices or directive sub-sections are invented without verification. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify them at the licence-application gate:

1. Exact Exchange Control Regulations regulation numbers for: outward FDI approval requirement; portfolio-investment allowance framework; OTC derivative AD concessional threshold.
2. Current SARB FinSurv BoP reporting schema version and applicable circular reference.
3. AD Manual section references for: non-resident derivative transaction authority; asset-swap approval mechanism; exempt-category list.
4. Precise FinSurv reporting timeline (real-time vs batch vs next-business-day) per flow type — AD Manual schedule.
5. FIC Act retention provisions for cross-border payment documentation — precise section reference for 5-year minimum.

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Zara (Chief Compliance Officer, governance) + Mira (Regulatory intelligence engineer, compliance) | Initial policy authored. Ten sections: (1) Authorised Dealer Status and Regulatory Standing — AD designation, AD obligations overview, maintaining AD status in good standing, SARB relationship, inspection readiness; (2) BoP Classification Framework — Current Account and Capital & Financial Account structure, BoP-code mapping library as Principle 2 canonical-source artefact; (3) Current Account Flows — goods (ORG-FX-FIN-01), services (ORG-FX-FIN-02), investment income (ORG-FX-FIN-03), current transfers (ORG-FX-FIN-04), gifts/donations (ORG-FX-FIN-11); (4) Capital and Financial Account Flows — FDI inward/outward (ORG-FX-FIN-05), portfolio investment (ORG-FX-FIN-06), other investment (ORG-FX-FIN-07), financial derivatives (ORG-FX-FIN-08), reserve assets (ORG-FX-FIN-09), gold (ORG-FX-FIN-10); (5) OTC Derivatives with Non-Resident Counterparties (ORG-EXCON-ODP-001) — AD authority framework, non-resident identification, derivative cash-flow reporting (premium, VM, IM, settlement, close-out), three-reporting-stream independence principle; (6) Approval Gates — outward FDI, above-threshold flows, non-resident derivatives, asset swaps; seven-step approval workflow; execution gate; (7) Supporting Documentation and Verification — documentation standards matrix by flow type; five-step verification process; exempt-flow attestation; no-charge flow reporting obligation; (8) FinSurv Reporting and Reconciliation — reporting module, reporting timeline, monthly reconciliation framework, schema-update test gate, inspection readiness; (9) Obligations closure table: ORG-FX-FIN-01 through ORG-FX-FIN-14 and ORG-EXCON-ODP-001; (10) Substrate gaps and citation gaps. Identity discipline per CLAUDE.md "Dispatch discipline" observed throughout. |
