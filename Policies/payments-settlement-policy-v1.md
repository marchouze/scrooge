---
policy-id: payments-settlement-policy
title: Payments and Settlement Policy v1
version: "1"
status: COMMENCEMENT-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 s.60 (risk management systems)
  - National Payment System Act 78 of 1998
  - SARB National Payment System Framework
  - STRATE settlement rules
  - Regulations Relating to Banks 2012 (as amended) reg.26 (liquidity)
  - Exchange Control Regulations (outbound payments)
author: Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer, engineering)
date: 2026-05-22
summary: Payments and Settlement Policy governing Hoz Bank's correspondent-bank-only payment channel, STRATE T+2 equity and bond settlement, DVP principle, settlement fail management, intraday liquidity management, SAMOS cut-off adherence, nostro-funded outbound payment authorisation, and typed events for payment and settlement lifecycle. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-LR
---

# Payments and Settlement Policy v1

> **Authors.** Devon (Chief Operating Officer, governance) — lead; Tomas (Operations & payments engineer, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements the payment and settlement risk management obligations under the National Payment System Act 78 of 1998, Banks Act 94 of 1990 s.60, and the SARB NPS Framework. The Bank's indirect-participant posture (confirmed per `project_indirect_participant_posture.md`; payments model per `project_payments_correspondent_model.md`) shapes every provision: the Bank does not directly join SAMOS, BankservAfrica, or STRATE as a direct participant — all payments route via correspondent bank; STRATE settlement is accessed through a custodian/settlement agent.
> **Obligations closed.** Payment settlement risk management (Banks Act s.60); intraday liquidity monitoring (Regulations Relating to Banks reg.26); Exchange Control payment reporting (Exchange Control Regulations).
> **Status.** COMMENCEMENT-BIND. The payment and settlement infrastructure is only operationally required from the first client transaction. Build-phase substrate (payment instruction handler, settlement confirmation handler, nostro reconciliation) is being built under `D-REGULATORY-READINESS-GATE-PLAN`. This policy is preparation for compliance, not compliance itself.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Payments and Settlement — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change to payment channels, STRATE rules, or NPS Framework · **Citation:** National Payment System Act 78 of 1998 + Banks Act 94 of 1990 s.60 + SARB NPS Framework + Regulations Relating to Banks reg.26 + Exchange Control Regulations

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") instructs, monitors, and settles payments and financial instrument transactions. Its purpose is to ensure that: (i) all payment and settlement activity is routed through approved channels; (ii) settlement risk is managed within the Bank's Risk Appetite Statement; (iii) intraday liquidity is sufficient to meet settlement obligations; (iv) settlement fails are identified promptly and resolved within prescribed timeframes; and (v) Exchange Control reporting obligations are met for all cross-border payment flows.

The policy reflects the Bank's confirmed indirect-participant operating posture. The Bank is not a direct participant in SAMOS, BankservAfrica, or the STRATE central securities depository. Payment instructions route exclusively through the Bank's approved correspondent bank channel. Settlement of JSE-listed bonds and equities occurs through STRATE, accessed via the Bank's appointed settlement agent and STRATE member. This is not a temporary constraint — it is the Bank's deliberate operating model for the institutional client franchise.

The policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). Procedures under this policy — including `Procedures/operations/settlement-failure-bcp.md`, `Procedures/by-policy/intraday-liquidity-funding.md`, and `Procedures/by-policy/samos-cut-off.md` — operationalise the principles set here. The payment instruction handler, settlement confirmation engine, and nostro reconciliation harness are the system capabilities that execute those procedures.

### Principles

- **Correspondent bank channel is the sole payment route.** The Bank processes all outbound and inbound payments exclusively through its approved correspondent bank(s). No direct SAMOS, SWIFT RTGS, or BankservAfrica participation. The correspondent bank list is maintained under the Nostro and Correspondent Banking Policy; any change to the approved correspondent bank for payment routing requires COO approval and a typed event.
- **DVP is the settlement principle for securities.** All securities transactions settle on a Delivery-versus-Payment (DVP) basis through STRATE. Pre-funded gross settlement applies; no net settlement of securities exposures outside of STRATE's multilateral net balance structure. The Bank does not extend or receive intraday credit for securities settlement purposes outside of the STRATE rules.
- **T+2 for equities and bonds.** Settlement of JSE-listed equities and bonds occurs on the second business day following the trade date (T+2), consistent with STRATE settlement rules and JSE Rules.
- **Intraday liquidity must cover settlement obligations.** At the start of each settlement day, Tomas (Operations & payments engineer, engineering) verifies, via the intraday liquidity position report, that the Bank's nostro balance with its correspondent is sufficient to fund all expected settlement obligations for the day, plus a buffer as defined in `Procedures/by-policy/intraday-liquidity-funding.md`. Insufficient nostro funding triggers immediate escalation to Eitan (Treasurer, governance) and Devon.
- **Settlement fails are a risk event.** Any settlement fail — whether the Bank fails to deliver or receives a failed delivery from a counterparty — is a risk event that triggers the settlement fail management procedure (§3). Settlement fails are not treated as routine operational items; every fail is investigated, classified, and resolved within prescribed timeframes. Persistent fails are escalated to Devon and reported to Helena (Chief Risk Officer, governance) as an operational risk event.
- **Events-first settlement accounting.** All payment instruction, confirmation, and settlement events are recorded as typed events (`PaymentInstructed`, `SettlementConfirmed`, `SettlementFailed`) in the event log (Principle 1). No settlement position is held as a stored balance; all positions are derived from the event log. The settlement ledger is a projection over these events.
- **Exchange Control compliance on every cross-border payment.** All outbound payments in foreign currency are pre-authorised under the Exchange Control Regulations before instruction to the correspondent bank. Tomas confirms Exchange Control compliance (category authorisation or specific approval) before generating the payment instruction. A `PaymentInstructed` event carries the Exchange Control authorisation reference.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and has ultimate accountability for payment and settlement operations. Devon approves changes to the approved correspondent bank list and authorises payments above the limits defined in §2.3 (outbound payment authorisation matrix).

Tomas (Operations & payments engineer, engineering) is the operational lead for payment and settlement. Tomas owns: the daily intraday liquidity check; payment instruction generation and validation; settlement fail identification and escalation; nostro reconciliation (per Nostro and Correspondent Banking Policy); SAMOS cut-off schedule adherence; Exchange Control compliance pre-check.

Eitan (Treasurer, governance) manages intraday funding requirements and nostro pool sizing. Eitan's ALCO reporting includes daily settlement exposure and intraday peak usage against the nostro buffer.

Bea (Accounting & financial reporting engineer, engineering) owns the settlement ledger projection and the GL reconciliation of settlement positions. Bea's `ReconciliationBreakIdentified` events trigger the break management procedure (Reconciliation and Break Management Policy).

Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance over payment controls and settlement reconciliation completeness.

---

## 2. Payment Channels and Authorisation

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for correspondent bank changes; authorisation matrix below for individual payments · **Cadence:** Correspondent bank list reviewed annually; authorisation matrix reviewed on material change · **Citation:** National Payment System Act 78 of 1998 + Exchange Control Regulations + Banks Act 94 of 1990 s.60

### 2.1 Approved Correspondent Bank Channel

The Bank's sole payment channel is the correspondent bank appointed under the Nostro and Correspondent Banking Policy. The correspondent bank's SWIFT BIC, account details, cut-off times, and fee schedule are held in the approved correspondent bank register (maintained by Tomas, subject to Devon's change approval).

All outbound ZAR payments route via the correspondent bank to SAMOS, which the correspondent bank accesses directly as a SAMOS participant. All outbound foreign currency payments route via the correspondent bank's correspondent network (for currency pairs where the Bank does not hold a nostro account) or via the Bank's own nostro account at a foreign correspondent, where one is maintained.

No alternative payment channel may be used without prior COO approval and an updated correspondent bank register entry.

### 2.2 SWIFT Connectivity

The Bank connects to the SWIFT network via a SWIFT Service Bureau arrangement (or equivalent FIN-connected intermediary), consistent with the indirect-participant operating model. The SWIFT connectivity governance — including BIC management, HSM key ceremonies, business continuity for SWIFT connectivity, and SWIFT CSCF compliance — is governed under the Information Security and IT Governance Policy and the Nostro and Correspondent Banking Policy.

All payment instructions to the correspondent bank are formatted as ISO 20022 messages (or SWIFT MT equivalent during the MT-to-MX migration period). Tomas owns the payment instruction formatting and validation; Atlas (Core banking platform architect, engineering) owns the SWIFT messaging integration in the platform.

### 2.3 Outbound Payment Authorisation Matrix

All outbound payment instructions require dual-authorisation. The authorisation tiers are:

| Amount (ZAR equivalent) | First authority | Second authority |
|---|---|---|
| Up to ZAR 500,000 | Tomas | Bea (independent ledger check) |
| ZAR 500,001 – ZAR 5,000,000 | Tomas | Devon |
| Above ZAR 5,000,000 | Devon | CEO |

For foreign currency payments, the ZAR equivalent is calculated at the prevailing market mid-rate at the time of instruction. The authorisation matrix is reviewed by Devon annually and on material change to the business.

Emergency payments (outside normal business hours) follow the emergency payment procedure in `Procedures/by-policy/intraday-liquidity-funding.md`; dual-authorisation is still required; Devon is always the second authority for emergency payments above ZAR 500,000.

---

## 3. Settlement Framework

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for settlement agent changes · **Cadence:** Settlement operations are continuous on JSE business days · **Citation:** STRATE settlement rules + National Payment System Act 78 of 1998

### 3.1 STRATE Settlement

All JSE-listed bond and equity transactions settle through STRATE on T+2 (second business day following trade date), consistent with STRATE rules. The Bank accesses STRATE through its appointed settlement agent, who holds a STRATE participant account on the Bank's behalf.

Settlement instructions are generated by Tomas from the trade blotter upon trade confirmation (per Trade Confirmation and Affirmation Policy). Instructions are transmitted to the settlement agent with sufficient lead time to meet STRATE's cut-off schedule. Tomas monitors STRATE's pre-settlement matching reports to identify any unmatched instructions; unmatched instructions are chased immediately to avoid a fail.

The `SettlementConfirmed { tradeId, settlementDate, amount, securityId, dvpConfirmed, stateRef }` event is emitted by Tomas on receipt of STRATE's settlement confirmation from the settlement agent. This is the canonical record of settlement; the GL projection for settled securities positions is derived from this event.

### 3.2 Settlement Fail Management

A settlement fail occurs when, at the STRATE settlement cut-off on T+2, either the Bank has failed to deliver securities (seller-fail) or has not received securities and payment has not occurred (buyer-fail). Every fail is a typed event: `SettlementFailed { tradeId, failDate, failSide, amount, counterpartyId, failReason }`.

**Fail management procedure (references `Procedures/operations/settlement-failure-bcp.md`):**
1. Tomas identifies the fail from the STRATE settlement report and emits `SettlementFailed` immediately.
2. Tomas contacts the settlement agent and counterparty operations to establish the fail reason and agree a resolution timeline.
3. Fails are classified by cause: (a) internal operational fail — Bank failed to instruct in time; (b) counterparty fail — counterparty failed to deliver; (c) funding fail — nostro insufficient; (d) securities fail — stock position shortfall.
4. Resolution deadline: T+5 (three business days after fail date). Beyond T+5, Devon is notified and the buy-in rights under STRATE rules may be exercised.
5. Buy-in rights: where the Bank is owed delivery and the counterparty has failed beyond T+5, Tomas may initiate a buy-in on the counterparty's account under STRATE's buy-in rules. Devon approves all buy-in initiations.
6. Fail charges: STRATE's fail charges accrue from T+2 on open fails; these are charged back to the counterparty where a counterparty fail applies, or absorbed as an operational risk loss event where an internal fail.
7. Every fail resolved before T+5 is recorded with a `SettlementConfirmed` event tagged with the actual settlement date. Fails resolved after T+5 additionally require a root-cause analysis filed to the operational risk register.

### 3.3 SAMOS Cut-Off Adherence

SAMOS (South African Multiple Option Settlement) operates on specific daily cut-off schedules for ZAR-denominated RTGS payments. The Bank's correspondent bank transmits ZAR payments on the Bank's behalf within these cut-off windows. Tomas maintains the SAMOS cut-off schedule (per `Procedures/by-policy/samos-cut-off.md`) and ensures all payment instructions are transmitted to the correspondent bank with sufficient lead time.

Late instructions that miss the SAMOS cut-off are queued for the next available settlement window; Tomas notifies the counterparty and Devon of any late-cut-off instruction and the reason.

---

## 4. Intraday Liquidity Management

**Owner:** Eitan (Treasurer, governance) — intraday funding strategy; Devon (COO) — oversight · **Approval:** COO for nostro buffer changes; ALCO for intraday funding strategy · **Cadence:** Daily intraday position monitoring; monthly ALCO review · **Citation:** Regulations Relating to Banks reg.26 (liquidity — intraday obligations) + Banks Act 94 of 1990 s.60

### Purpose

Intraday liquidity management ensures the Bank has sufficient nostro balances and committed intraday funding lines to meet all settlement obligations on a timely basis throughout each settlement day. A failure to settle on time is a systemic risk — both to the Bank's counterparties and to the Bank's reputation as an institutional market participant.

### Principles

- **Intraday pre-funding.** The Bank maintains its nostro account(s) pre-funded to cover the expected peak intraday settlement exposure, plus a buffer (buffer minimum defined in `Procedures/by-policy/intraday-liquidity-funding.md`). The buffer is calibrated to the Bank's 90th-percentile intraday peak over the preceding quarter, reviewed by Eitan quarterly.
- **Intraday monitoring.** Tomas monitors the nostro balance against expected settlement obligations in real-time throughout each settlement day. An automated alert (per the intraday liquidity funding procedure) fires when the nostro balance falls below 110% of the day's remaining settlement obligations.
- **Intraday funding lines.** Where the Bank's nostro balance is insufficient, Eitan may call on committed intraday funding lines with the correspondent bank. The terms of the intraday funding line are part of the correspondent bank agreement; Eitan reviews annually.
- **End-of-day reconciliation.** At the close of each settlement day, Tomas reconciles the nostro balance against all settled and failed transactions. The reconciled balance is reported in the intraday liquidity report filed as a `NostroReconciliationCompleted` event under the Nostro and Correspondent Banking Policy.

---

## 5. Exchange Control — Outbound Payments

**Owner:** Zara (Chief Compliance Officer, governance) — Exchange Control compliance; Tomas — operational execution · **Approval:** Per Exchange Control Regulations category authorisations or SARB specific approvals · **Cadence:** Pre-payment compliance check on every cross-border instruction · **Citation:** Exchange Control Regulations + Currency and Exchanges Act 9 of 1933

### Purpose

The Exchange Control Regulations impose controls on all outbound payments of South African rand or foreign currency from South Africa to non-residents. As an authorised dealer-in-formation (pending SARB Exchange Control authorisation), the Bank must ensure every cross-border payment instruction is supported by a valid category authorisation or a specific SARB approval.

### Principles

- **Pre-payment compliance check.** Before generating any cross-border payment instruction, Tomas performs a pre-payment Exchange Control compliance check: (i) identifies the applicable category authorisation (e.g., current account transactions under Exchange Control Regulations reg.6; capital account transactions under applicable Exchange Control circulars); (ii) confirms the payment amount is within the category limit; (iii) obtains the applicable transaction reference or approval code.
- **No instruction without Exchange Control reference.** A cross-border `PaymentInstructed` event must carry the Exchange Control authorisation category and reference. Tomas may not transmit a cross-border payment instruction to the correspondent bank without this reference.
- **Zara's oversight.** Zara (Chief Compliance Officer, governance) receives a daily report of all cross-border payment instructions and their Exchange Control references. Material or novel transactions (first time in a new category; amounts above the threshold in `Procedures/by-policy/excon-payment-precheck.md`) are escalated to Zara before instruction.
- **Reporting.** Exchange Control reporting obligations (BoP reports, AD system reporting) are performed by Tomas on Zara's direction, per the Exchange Control Compliance Policy.

---

## 6. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `PaymentInstructed` | Payment instruction transmitted to correspondent bank | Tomas |
| `SettlementConfirmed` | STRATE settlement confirmation received | Tomas |
| `SettlementFailed` | Settlement fail identified at STRATE cut-off | Tomas |
| `NostroReconciliationCompleted` | End-of-day nostro reconciliation complete | Tomas |

All events are appended to the shared event store (Principle 1; cross-worktree sync per `D-CROSS-WORKTREE-EVENT-STORE-SYNC`).

---

## 7. Substrate Dependencies and Gaps

- **Payment instruction handler.** Generates, validates, and transmits ISO 20022 payment instructions to the correspondent bank's SWIFT interface. Discharge exit signal: `PaymentInstructed { paymentId, amount, currency, beneficiary, correspondentRef, exconRef }` event on synthetic fixture.
- **Settlement confirmation engine.** Receives STRATE settlement confirmations from the settlement agent and emits `SettlementConfirmed` events. Gap: automated settlement agent interface (STRATE API or settlement agent report parser) — currently manual; automation is a roadmap item.
- **Intraday liquidity monitor.** Real-time nostro balance monitor with automated alert. Discharge exit signal: alert fires when nostro < 110% of remaining obligations.
- **Procedures pending full authoring:** `Procedures/operations/settlement-failure-bcp.md`, `Procedures/by-policy/intraday-liquidity-funding.md`, `Procedures/by-policy/samos-cut-off.md` — referenced herein as at the procedures layer; full content to be authored by Tomas under Devon's direction.

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer, engineering) | Initial policy authored. Six operative sections: (1) Overarching — correspondent bank as sole channel, DVP principle, T+2 settlement, intraday liquidity, fail management, events-first accounting, Exchange Control compliance; (2) Payment Channels and Authorisation — correspondent bank channel, SWIFT connectivity, outbound payment authorisation matrix; (3) Settlement Framework — STRATE T+2, settlement fail management, SAMOS cut-off adherence; (4) Intraday Liquidity Management; (5) Exchange Control — Outbound Payments; (6) Typed events. |
