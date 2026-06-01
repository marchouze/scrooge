---
policy-id: nostro-correspondent-banking-policy
title: Nostro and Correspondent Banking Policy v1
version: "1"
status: COMMENCEMENT-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 (risk management; correspondent banking)
  - Exchange Control Regulations (foreign correspondent banks and foreign currency accounts)
  - SWIFT membership rules and CSCF compliance
  - SARB National Payment System Framework
  - FATF Correspondent Banking Guidance (October 2016)
  - FIC Act 38 of 2001 (due diligence on correspondent banks)
  - Regulations Relating to Banks 2012 (as amended) reg.26 (liquidity — nostro as HQLA)
author: Tomas (Operations & payments engineer, engineering) + Eitan (Treasurer, governance)
date: 2026-05-22
summary: Nostro and Correspondent Banking Policy governing the approved correspondent bank list, account opening/closure governance, static data management, same-day nostro reconciliation, credit exposure monitoring, SWIFT connectivity governance, nostro HQLA contribution, and intra-group netting. Typed events NostroAccountOpened, NostroReconciliationCompleted. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-LR
  - RT-CR
---

# Nostro and Correspondent Banking Policy v1

> **Authors.** Tomas (Operations & payments engineer, engineering) — lead; Eitan (Treasurer, governance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Governs nostro account management and the correspondent banking relationships that are the Bank's sole payment channel (confirmed per `project_payments_correspondent_model.md` and `project_indirect_participant_posture.md`). Implements FIC Act 38 of 2001 correspondent bank due diligence obligations and FATF Correspondent Banking Guidance (October 2016). Complements the Payments and Settlement Policy (payment channel governance) and the AML/CFT Policy (correspondent bank AML/CFT risk assessment).
> **Obligations closed.** FIC Act s.21B (enhanced due diligence for correspondent banking relationships); FATF Recommendation 13 (correspondent banking); Exchange Control Regulations (nostro account opening and management); Regulations Relating to Banks reg.26 (nostro as potential HQLA component).
> **Status.** COMMENCEMENT-BIND. Nostro accounts and correspondent banking relationships must be operational before the first client payment or settlement instruction. Build-phase work (correspondent bank selection, SWIFT Bureau arrangement, nostro account opening governance) proceeds under `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Nostro and Correspondent Banking — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** CEO for correspondent bank additions/removals; COO for static data changes · **Cadence:** Correspondent bank due diligence annually; nostro reconciliation daily (same-day) · **Citation:** Banks Act 94 of 1990 + FIC Act 38 of 2001 + FATF Correspondent Banking Guidance (October 2016) + Regulations Relating to Banks reg.26 + Exchange Control Regulations

### Purpose

This policy governs Hoz Bank Limited's (the "Bank's") nostro account infrastructure and correspondent banking relationships. A nostro account is a foreign currency account held by the Bank at a foreign bank (or a ZAR account held at a domestic bank for correspondent-mediated NPS access (via correspondent)) in the Bank's name. The correspondent bank is the financial institution that holds the nostro account on the Bank's behalf and executes payments on the Bank's instruction.

The Bank's indirect-participant posture makes correspondent banking relationships existentially important: without an approved, operational correspondent bank, the Bank cannot process any client payment, fund any settlement, or hold any foreign currency position. The Bank therefore applies a higher standard of due diligence, monitoring, and governance to correspondent banking relationships than to ordinary counterparty relationships.

The policy applies to all nostro accounts (ZAR and foreign currency) and all correspondent banking arrangements for payment routing, settlement funding, and SWIFT connectivity.

### Principles

- **Approved correspondent bank list is CEO-controlled.** The list of approved correspondent banks — covering which banks, in which currencies, for which purposes (ZAR NPS access (via correspondent); USD; EUR; GBP; etc.) — may only be changed with CEO approval. Devon proposes additions or removals; Zara (Chief Compliance Officer, governance) confirms AML/CFT due diligence; CEO approves. A `NostroAccountOpened` or `NostroAccountClosed` typed event is the canonical record of every change.
- **Annual due diligence by Zara.** Every correspondent banking relationship is subject to an annual AML/CFT risk assessment by Zara, consistent with FIC Act s.21B enhanced due diligence requirements and FATF Correspondent Banking Guidance (October 2016). Zara issues a due diligence findings report to Devon and to the CEO. A correspondent bank that fails the annual due diligence is suspended pending remediation; continued suspension beyond 30 days triggers a CEO-level decision on termination and replacement.
- **Same-day nostro reconciliation.** The nostro balance for every active nostro account is reconciled daily, same-day, by Tomas against the SWIFT MT940/MT950 statement or equivalent electronic balance report from the correspondent bank. A `NostroReconciliationCompleted { accountId, correspondentBank, date, openingBalance, closingBalance, breakCount }` event is emitted at the end of each business day. Unreconciled items (breaks) are investigated within T+1 and escalated per the Reconciliation and Break Management Policy.
- **Nostro credit exposure is counterparty credit risk.** The nostro balance held at any correspondent bank is an unsecured credit exposure to that bank. Eitan monitors the aggregate nostro balance per correspondent bank against the credit limit assigned under the concentration risk framework (references `Policies/credit-risk-policy-v1.md`). Nostro balances in excess of the approved credit limit require Eitan's notification to Helena and an intraday reduction plan.
- **SWIFT connectivity is critical infrastructure.** The Bank's SWIFT connection (via Service Bureau) is the communications channel for all payment instructions, confirmations, and nostro statements. Any SWIFT connectivity outage is an immediate operational incident (per the Incident Response Policy); Devon is notified immediately; the BCP for SWIFT connectivity failover applies.
- **Events-first nostro accounting.** All nostro account opening, closure, reconciliation, and balance events are typed events in the event log (Principle 1). The nostro position is a projection over these events; it is not a stored balance in a separate database.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and chair of the correspondent bank governance process. Devon approves the annual due diligence schedule and escalates material due diligence findings to the CEO.

Tomas (Operations & payments engineer, engineering) is the operational lead for nostro management. Tomas owns: daily nostro reconciliation; SWIFT statement processing; break identification and escalation; static data maintenance (BIC codes, account numbers, cut-off times) pending Devon's change approval; correspondent bank operational relationship management.

Eitan (Treasurer, governance) owns nostro pool sizing (HQLA contribution and intraday liquidity buffer), credit exposure monitoring against credit limits, and intraday funding line management with correspondents. Eitan reports nostro positions to ALCO monthly and to Devon daily.

Zara (Chief Compliance Officer, governance) owns the annual AML/CFT due diligence on correspondent banks under FIC Act s.21B. Zara maintains the due diligence file and advises Devon on continued suitability of each correspondent.

Atlas (Core banking platform architect, engineering) owns the SWIFT Service Bureau technical integration and the nostro reconciliation feed in the platform.

---

## 2. Approved Correspondent Bank List

**Owner:** Devon (Chief Operating Officer, governance) — governance; Tomas — static data maintenance · **Approval:** CEO for additions/removals; COO for static data changes · **Cadence:** Annual due diligence review; additions triggered by business need · **Citation:** FIC Act 38 of 2001 s.21B + FATF Correspondent Banking Guidance (October 2016) + Exchange Control Regulations

### 2.1 Approval Process for New Correspondent Banks

To add a new correspondent bank, the following steps are required:

1. Devon identifies the business need (new currency, redundancy, better terms).
2. Tomas prepares the operational suitability assessment (SWIFT connectivity, cut-off schedule, fee schedule, ISO 20022 readiness).
3. Zara performs AML/CFT due diligence per FIC Act s.21B and FATF Correspondent Banking Guidance. Due diligence includes: (a) publicly available information on the correspondent's AML/CFT programme; (b) assessment of the correspondent's regulatory status in its home jurisdiction; (c) correspondent's SWIFT BIC registration and any associated SWIFT KYC Registry information; (d) sanctions screening of the correspondent and its beneficial owners.
4. Eitan assesses the credit exposure (the nostro balance that will be held at the correspondent) against the credit risk framework.
5. Devon presents the assessment package (operational, AML/CFT, credit) to the CEO for approval.
6. On CEO approval, Tomas onboards the correspondent bank to the platform and a `NostroAccountOpened { accountId, correspondentBank, currency, bicCode, purpose, approvedBy, approvedAt }` event is emitted.

No correspondent banking relationship may be established and no nostro account may be funded without a `NostroAccountOpened` event approved at the CEO level.

### 2.2 Annual Due Diligence

Zara conducts an annual review of every correspondent banking relationship. The review covers: (a) any material change to the correspondent's AML/CFT programme or regulatory status; (b) any adverse media, sanctions screening results, or regulatory action against the correspondent; (c) transaction activity review (is the relationship being used for intended purposes only?); (d) fee and service level review.

Zara's annual due diligence findings are reported to Devon and the CEO. A correspondent that passes the annual review continues on the approved list. A correspondent with concerns is placed under enhanced monitoring; a correspondent that fails is suspended.

### 2.3 Static Data Management

The approved correspondent bank register holds, for each correspondent: SWIFT BIC, account number, account currency, purpose, cut-off times (ZAR NPS RTGS / BankservAfrica, USD Fedwire, EUR TARGET2, etc.), fee schedule, ISDA/GMRA/GMSLA agreement status, and emergency contact details.

Static data changes (change of account number, BIC update, cut-off revision) are made by Tomas with Devon's written approval. Static data changes are not routine operational tasks; they require the same dual-approval as payment authorisation at the relevant amount tier, applied to the data change rather than a payment.

---

## 3. Nostro Reconciliation

**Owner:** Tomas (Operations & payments engineer, engineering) · **Approval:** COO for escalation threshold changes · **Cadence:** Same-day for active accounts; T+1 investigation trigger for breaks · **Citation:** Banks Act 94 of 1990 s.73 (accurate books and records) + Regulations Relating to Banks reg.39 (internal controls)

### 3.1 Daily Reconciliation Process

At the close of each business day (by 20:00 Johannesburg time), Tomas reconciles each active nostro account:

1. Download the SWIFT MT940 end-of-day statement (or MT950 balance statement) from the correspondent bank via the SWIFT Service Bureau.
2. Match each statement entry to a `PaymentInstructed` or `SettlementConfirmed` event in the event log.
3. Identify unmatched entries (breaks) in either direction (statement entry without event; event without statement entry).
4. Classify breaks: (a) timing break — payment instructed but not yet in the statement (normal intraday lag); (b) unidentified credit — credit to nostro not matched to an event; (c) unidentified debit — debit to nostro not matched to an event; (d) fee/charge — correspondent bank fee debit.
5. Emit `NostroReconciliationCompleted { accountId, date, statementBalance, internalBalance, breaks[] }` event.

### 3.2 Break Management

Timing breaks (category a) may be carried overnight if they match a same-day instruction pending settlement confirmation. All other breaks must be investigated by T+1.

Breaks not resolved by T+1 are escalated per the Reconciliation and Break Management Policy (P1 cash break classification applies to unidentified debits above ZAR 100k or USD 10k).

---

## 4. Credit Exposure and HQLA Management

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO for nostro buffer and HQLA contribution changes · **Cadence:** Daily intraday monitoring; monthly ALCO review · **Citation:** Regulations Relating to Banks reg.26 (liquidity — nostro balances as HQLA component)

### Purpose

The nostro balance at each correspondent bank is simultaneously: (i) a credit exposure to that bank (counterparty credit risk managed per the Credit Risk Policy); and (ii) a component of the Bank's high-quality liquid assets (HQLA) for LCR/NSFR purposes (per the Liquidity Risk Management Policy). These two dimensions must be managed in a coordinated way: holding large nostro balances for HQLA purposes increases credit concentration risk; minimising credit concentration by distributing balances across multiple correspondents increases operational complexity and cost.

### Principles

- **Credit limit per correspondent.** Eitan maintains an approved credit limit for each correspondent bank, calibrated to the correspondent's credit rating and the Bank's concentration risk framework. The nostro balance at any single correspondent may not exceed the approved credit limit without Devon's and Eitan's joint approval.
- **HQLA eligibility.** Nostro balances in qualifying foreign currencies at correspondent banks with credit ratings above the HQLA eligibility threshold (per the Liquidity Risk Management Policy) count towards the Bank's Level 1 HQLA. Eitan maintains the HQLA eligibility status of each nostro account and reports HQLA contribution to ALCO monthly.
- **Intra-group netting.** Where the Bank maintains multiple nostro accounts within the same banking group (e.g., ZAR account and USD account at the same correspondent group), Eitan may apply intraday netting of the gross nostro balances for credit exposure monitoring purposes, subject to the group netting rules in the Credit Risk Policy.

---

## 5. SWIFT Connectivity Governance

**Owner:** Atlas (Core banking platform architect, engineering) — technical; Devon (COO) — governance · **Approval:** COO for SWIFT connectivity changes; CISO sign-off for security controls · **Cadence:** SWIFT CSCF annual attestation; BIC management ongoing · **Citation:** SWIFT membership rules + SWIFT Customer Security Control Framework (CSCF) + PA/FSCA Joint Standard 2 of 2024 s.6

### Purpose

SWIFT connectivity is the communications backbone for all correspondent bank payment instructions, nostro statements, and trade confirmations. The Bank connects to SWIFT via a SWIFT-approved Service Bureau, consistent with the indirect-participant operating model. This section governs the SWIFT BIC registration, key ceremony, CSCF compliance, and business continuity for SWIFT connectivity.

### Principles

- **SWIFT Service Bureau governance.** The Bank's SWIFT Service Bureau is selected and contracted under the Outsourcing and Third-Party Risk Policy. The Service Bureau agreement must specify: SLA for message delivery time; BCP failover arrangements; audit right; data residency (SA or approved region per Principle 3).
- **SWIFT CSCF compliance.** The Bank attests annually to the SWIFT Customer Security Control Framework (CSCF) mandatory controls, consistent with PA/FSCA Joint Standard 2 of 2024 technology risk requirements. Senna (Cybersecurity & infrastructure engineer, engineering) is responsible for CSCF compliance; attestation is filed with SWIFT by the annual deadline.
- **BIC management.** The Bank's SWIFT BIC(s) are registered in SWIFT's BIC directory and maintained by Tomas (operational) and Atlas (technical). Any BIC change requires Devon's approval and advance notice to all correspondent banks.
- **SWIFT outage BCP.** If SWIFT connectivity fails, the Bank's BCP for payment and settlement is: (i) notify Devon and Eitan immediately; (ii) hold all pending payment instructions; (iii) communicate with correspondent banks via bilateral telephone and email (backup channel); (iv) escalate to Service Bureau for connectivity restoration; (v) process queued instructions upon restoration. Devon activates the BCP; Tomas executes.

---

## 6. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `NostroAccountOpened` | Correspondent bank added and nostro account established | Tomas (on CEO approval) |
| `NostroAccountClosed` | Correspondent bank removed and nostro account closed | Tomas (on CEO approval) |
| `NostroReconciliationCompleted` | Daily end-of-day reconciliation completed | Tomas |

---

## 7. Substrate Dependencies and Gaps

- **Correspondent bank register (Tomas + Atlas).** Machine-readable register of approved correspondents with BIC, currency, purpose, and cut-off data. Discharge exit signal: register queryable via API; `NostroAccountOpened` event drives the register.
- **SWIFT MT940 processing (Atlas).** Automated ingestion of SWIFT MT940 end-of-day statements from Service Bureau. Currently manual; automation is a roadmap item.
- **HQLA eligibility tagging (Eitan + Anya).** Nostro accounts tagged with HQLA eligibility status in the HQLA projection. Discharge exit signal: LCR calculation includes nostro balances via tagged projection.
- **Procedure pending full authoring:** `Procedures/by-policy/nostro-management.md` — referenced in §3; full content to be authored by Tomas under Devon's direction.

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Tomas (Operations & payments engineer, engineering) + Eitan (Treasurer, governance) | Initial policy authored. Five operative sections: (1) Overarching — CEO-controlled approved correspondent list, annual AML/CFT due diligence, same-day reconciliation, nostro credit exposure, SWIFT connectivity, events-first accounting; (2) Approved Correspondent Bank List — addition process, annual due diligence, static data management; (3) Nostro Reconciliation — daily T-close process, break management; (4) Credit Exposure and HQLA Management; (5) SWIFT Connectivity Governance. |
