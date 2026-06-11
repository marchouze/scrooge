---
policy-id: trade-confirmation-affirmation-policy
title: Trade Confirmation and Affirmation Policy v1
version: "1"
status: COMMENCEMENT-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - FIC Act 38 of 2001 (records of transactions)
  - FSCA Conduct Standard for Banks (OTC derivatives reporting and recordkeeping)
  - ISDA OTC derivatives confirmation protocols (2002 ISDA Master Agreement)
  - Exchange Control Regulations reg.10(1)(c) (reporting of OTC derivatives to SARB)
  - Regulations Relating to Banks 2012 (as amended) reg.32 (CCR — confirmation as netting agreement prerequisite)
  - "FSCA Conduct Standard 3 of 2018: §5 (portfolio reconciliation), §6 (dispute resolution)"
  - "FSCA Conduct Standard 2 of 2018 (ODP): §9 (portfolio reconciliation — written agreement, frequencies, deemed disputes), §11 (portfolio compression)"
author: Tomas (Operations & payments engineer, engineering) + Kai (Trading systems engineer, engineering)
date: 2026-05-22
summary: Trade Confirmation and Affirmation Policy establishing confirmation timelines for FX spot/forward (T+1) and IRS/CDS (T+2), electronic confirmation platform requirements, escalation for unsigned/unconfirmed trades, daily portfolio reconciliation for active OTC counterparties, dispute definition and resolution, long-form confirmation for structured products, and settlement gate. Typed events TradeConfirmed, TradeDisputeOpened, TradeDisputeResolved. COMMENCEMENT-BIND. Closes OTC-derivative obligations ORG-CS3-002 (timely confirmation of material terms), ORG-CS3-004 (dispute-resolution procedures), ORG-ODP-COND-006 (next-business-day confirmation), and ORG-ODP-COND-008 (dispute identification and monitoring procedures).
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-CR
obligations:
  - ORG-CS3-003
  - ORG-CS3-004
  - ORG-ODP-COND-007
  - ORG-ODP-COND-009
---

# Trade Confirmation and Affirmation Policy v1

> **Authors.** Tomas (Operations & payments engineer, engineering) — lead; Kai (Trading systems engineer, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements FIC Act 38 of 2001 transaction record requirements and the FSCA conduct standards for OTC derivatives confirmation. Aligns with ISDA confirmation protocols and the CCR framework under Regulations Relating to Banks reg.32 (netting recognition prerequisite). Complements `Policies/trading-mandate-v1.md` (defines what may be traded) and the Payments and Settlement Policy (settlement gate depends on confirmed trade).
> **Obligations closed.** FIC Act s.22–s.24 (records of transactions for five years); FSCA Conduct Standard (OTC confirmation timelines and recordkeeping); Exchange Control Regulations reg.10(1)(c) (reporting of OTC derivatives).
> **Status.** COMMENCEMENT-BIND. Confirmation and affirmation obligations are only operationally required from the first client trade. Build-phase substrate (confirmation platform integration, portfolio reconciliation engine, dispute tracker) is under construction per `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Trade Confirmation and Affirmation — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change to product range, ISDA protocols, or FSCA standards · **Citation:** FIC Act 38 of 2001 + FSCA Conduct Standard + ISDA 2002 Master Agreement confirmation protocols + Regulations Relating to Banks reg.32 + Exchange Control Regulations reg.10(1)(c)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") confirms, affirms, and documents every trade executed in its institutional client franchise. Its purpose is to ensure that: (i) every trade has a complete, signed, and legally binding confirmation within the prescribed timeline; (ii) portfolio reconciliation with counterparties identifies discrepancies before they become settlement fails; (iii) disputes are resolved promptly; and (iv) confirmation completeness serves as a prerequisite gate before settlement instructions are issued.

Trade confirmation is the process by which the Bank and its counterparty exchange and agree the economic terms of a transaction — price, quantity, settlement date, and contractual specifics. For OTC derivatives, confirmation is also the legal instrument that binds the parties under the ISDA Master Agreement (or equivalent bilateral agreement); without a signed confirmation, netting under the ISDA Master Agreement may not be recognised for CCR capital purposes (Regulations Relating to Banks reg.32), which could materially increase the Bank's capital requirement.

The policy applies to all asset classes in the Bank's trading mandate: JSE-listed bonds and equities (exchange-confirmed via JSE clearing and STRATE); FX spot and forward (bilateral OTC); interest rate swaps and other OTC IRD (ISDA-confirmed); and structured products.

### Principles

- **Confirmation completeness before settlement.** No settlement instruction may be generated for any trade unless the trade has a complete, affirmed confirmation. Tomas's settlement instruction workflow is gated on confirmation status: `TradeConfirmed { tradeId, confirmationMethod, confirmedAt, counterpartyRef }` must exist in the event log before `PaymentInstructed` or STRATE settlement instruction is generated.
- **Electronic confirmation is the standard.** The Bank uses an electronic confirmation platform (MarkitWIRE, DTCC Deriv/SERV, or equivalent ISDA-compliant electronic matching service) for OTC derivatives confirmations. Bilateral SWIFT MT300/MT320/MT360/MT362 messaging is the fallback where the counterparty is not connected to the electronic platform. Paper confirmations are not acceptable except as a temporary measure pending electronic onboarding; any paper confirmation is subject to escalated dual-authorisation and a 30-day transition plan to electronic.
- **ISDA netting recognition.** All OTC derivatives are confirmed under an executed ISDA Master Agreement (2002 edition or agreed variation) with a Schedule and a Credit Support Annex (CSA) where margin is exchanged. The Bank does not enter into OTC derivative transactions with any counterparty without an executed ISDA Master Agreement and a `CounterpartyISDAConfirmed` event in the event log. Imani (Legal-as-code engineer, engineering) maintains the ISDA Master Agreement register.
- **Exchange-traded instruments confirm via exchange.** JSE equities and bonds confirmed through JSE clearing and STRATE's matching process are deemed confirmed upon JSE trade confirmation; no separate bilateral confirmation is required. The `TradeConfirmed` event is generated automatically from the JSE clearing confirmation.
- **Portfolio reconciliation reduces settlement risk.** Daily portfolio reconciliation with active OTC counterparties identifies position discrepancies before they accumulate into settlement fails or dispute events. The reconciliation is performed by Tomas using the electronic confirmation platform's portfolio reconciliation module or bilateral SWIFT reconciliation messages.
- **Events-first confirmation accounting.** All confirmation, dispute, and resolution events are typed events in the event log (Principle 1). The confirmation register is a projection over `TradeConfirmed`, `TradeDisputeOpened`, and `TradeDisputeResolved` events; it is not a separate database.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and chairs the escalation path for unresolved disputes beyond the prescribed timeline.

Tomas (Operations & payments engineer, engineering) is the operational lead for confirmation. Tomas owns: the confirmation workflow for all asset classes; electronic confirmation platform management; portfolio reconciliation (daily for active counterparties); dispute identification and first-level resolution; escalation to Devon and Kai for unresolved disputes.

Kai (Trading systems engineer, engineering) owns the trading system integration with the confirmation platform and the automated `TradeConfirmed` event generation for exchange-confirmed instruments. Kai also builds the confirmation-completeness gate in the settlement instruction workflow.

Imani (Legal-as-code engineer, engineering) owns the ISDA Master Agreement register and the long-form confirmation library for structured products. Imani provides legal sign-off on novel confirmation terms.

Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) audits confirmation completeness and aged unconfirmed trade reports quarterly.

---

## 2. Confirmation Timelines

**Owner:** Tomas (Operations & payments engineer, engineering) · **Approval:** COO for timeline changes · **Cadence:** Timelines apply on every trade date · **Citation:** FSCA Conduct Standard + ISDA confirmation protocols + Regulations Relating to Banks reg.32

### 2.1 Standard Confirmation Deadlines

| Asset class | Confirmation deadline | Standard | Escalation trigger |
|---|---|---|---|
| FX spot | T+1 (day after trade date) by 17:00 | T+1 affirmation | Unconfirmed at T+1 → Tomas escalates to Devon |
| FX forward (< 1 year) | T+1 by 17:00 | T+1 affirmation | Unconfirmed at T+1 → escalate |
| Interest rate swap | T+2 by 17:00 | T+2 affirmation | Unconfirmed at T+2 → escalate |
| Credit default swap | T+2 by 17:00 | T+2 affirmation | Unconfirmed at T+2 → escalate |
| JSE bonds (exchange) | T+0 (exchange confirmation) | Exchange-confirmed | N/A — exchange confirms |
| JSE equities (exchange) | T+0 (exchange confirmation) | Exchange-confirmed | N/A — exchange confirms |
| Complex/structured OTC | T+3 by 17:00 | T+3 affirmation | Unconfirmed at T+3 → escalate to Devon + Imani |

"T" is the trade date (date the transaction is executed). "By 17:00" means by 17:00 Johannesburg time on the deadline day.

### 2.2 Escalation for Unconfirmed Trades

An unconfirmed trade that has passed its confirmation deadline without a `TradeConfirmed` event triggers the following escalation:

1. **T+confirmation deadline + 0.** Tomas flags the trade in the confirmation tracker and contacts the counterparty's operations team directly to establish the reason for non-confirmation.
2. **T+confirmation deadline + 1.** If still unconfirmed, Tomas escalates to Devon and to the front-office desk head who executed the trade. Devon decides whether to continue to chase or to close out the position if the trade terms are disputed.
3. **T+confirmation deadline + 3.** If still unconfirmed without a clear resolution path, Devon escalates to the CEO. Imani reviews the legal position on the unconfirmed trade. External counsel may be engaged for trades above ZAR 5,000,000 equivalent.

The unconfirmed trade report is produced by Tomas daily and reviewed by Devon each morning.

---

## 3. Portfolio Reconciliation

**Owner:** Tomas (Operations & payments engineer, engineering) · **Approval:** COO for reconciliation frequency changes · **Cadence:** Daily for active OTC counterparties; weekly for dormant · **Citation:** ISDA OTC portfolio reconciliation standards + Regulations Relating to Banks reg.32 (CCR dispute reduction)

### 3.1 Reconciliation Frequency

Portfolio reconciliation is the process of comparing the Bank's record of outstanding OTC positions with the counterparty's record. Discrepancies identified early are resolved before they crystallise into settlement fails, margin disputes, or capital recognition issues.

| Counterparty category | Reconciliation frequency | Method |
|---|---|---|
| Active (≥ 1 new trade in the preceding month) | Daily | Electronic platform (MarkitWIRE / DTCC) or SWIFT |
| Dormant (no new trade in the preceding month) | Weekly | Bilateral SWIFT or email-based reconciliation |
| New counterparty (first 3 months) | Daily regardless of activity | Electronic platform |

### 3.2 Discrepancy Management

Any position discrepancy identified during portfolio reconciliation that exceeds the materiality threshold (ZAR 100,000 notional equivalent for any single trade) is classified as a reconciliation break and escalated per the Reconciliation and Break Management Policy. Position discrepancies below the materiality threshold are investigated and resolved by Tomas within T+1; if unresolved, they are escalated to Devon.

The reconciliation compares **material terms and valuations** (CS 3/2018 §5): both term discrepancies (notional, dates, rates, direction) and valuation discrepancies (mark-to-market differences beyond the agreed tolerance) are in scope.

### 3.3 ODP Portfolio-Reconciliation Conditions — CS 2/2018 §9

**Citation:** FSCA Conduct Standard 2 of 2018 §9(1)–(5); register obligation `ORG-ODP-COND-007`; FSCA Conduct Standard 3 of 2018 §5; register obligation `ORG-CS3-003`.

Once the Bank conducts OTC-derivative business as an authorised OTC Derivative Provider, the following CS 2/2018 §9 conditions apply on top of §§3.1–3.2:

1. **Written agreement before first trade.** The Bank agrees **in writing** with each counterparty and client on the portfolio-reconciliation arrangements (frequency, method, data set, dispute deeming) **before** entering into any OTC derivative contract with that party. The agreement forms part of the onboarding documentation pack under the Counterparty Onboarding Policy (ISDA Schedule or bilateral side letter); onboarding is not complete without it.
2. **Prescribed minimum frequencies.** The Bank's daily/weekly schedule (§3.1) exceeds the CS 2/2018 §9 prescribed minima, which remain the regulatory floor: counterparties — daily at ≥ 500 outstanding trades, weekly at 51–499, quarterly at 1–50; clients — quarterly at ≥ 101 outstanding trades, annually at 1–100. Any future relaxation of §3.1 may not breach these floors.
3. **Resolution clocks.** Material-term discrepancies are resolved within **three business days** of identification; valuation discrepancies within **five business days** (mirrored in the §4.2 dispute-resolution timelines).
4. **Deemed disputes.** A discrepancy not resolved within its clock is **deemed a dispute**: Tomas emits `TradeDisputeOpened` automatically at clock expiry, and §4 applies.
5. **Written policies and procedures.** This section, with §§3.1–3.2 and `Procedures/by-policy/otc-dispute-resolution.md`, constitutes the written portfolio-reconciliation policies and procedures CS 2/2018 §9 requires.

### 3.4 Portfolio Compression — CS 2/2018 §11

**Citation:** FSCA Conduct Standard 2 of 2018 §11(1)–(3); register obligation `ORG-ODP-COND-009`.

1. **Twice-yearly compression analysis.** Where the Bank has **500 or more** non-centrally-cleared OTC derivative transactions outstanding with other providers, Tomas analyses — at least **twice a year** — the possibility of conducting bilateral or multilateral portfolio compression, and tables the analysis to Devon. Fully offsetting transactions identified by the analysis are terminated.
2. **Records.** A complete and accurate record of each bilateral offset and each bilateral or multilateral compression exercise is kept as typed events (`TradeCancelled` / compression-batch reference) in the event store, retained per the Records Management Policy.
3. **FSCA explanation.** Where a compression exercise is assessed as not appropriate (e.g. portfolio heterogeneity, residual-risk distortion, counterparty unwillingness), the analysis records a reasonable and valid explanation, available to the FSCA on request.
4. **Build-phase posture.** The Bank's OTC portfolio is far below the 500-trade threshold; the analysis obligation is dormant until the threshold is reached, but the monitoring of the trade count against the threshold is live in the position projections from commencement of ODP business.

---

## 4. Dispute Definition and Resolution

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for dispute settlements above ZAR 1,000,000; CEO for above ZAR 5,000,000 · **Cadence:** Dispute tracker reviewed daily by Tomas · **Citation:** ISDA 2002 Master Agreement provisions on dispute resolution + `Procedures/by-policy/otc-dispute-resolution.md`

### 4.1 Definition of Dispute

A trade dispute is any situation where the Bank and its counterparty disagree on the economic terms of an executed trade, the valuation of an OTC derivative, or the margin calculation under a CSA. A dispute is formalised when:
- A `TradeDisputeOpened { tradeId, counterpartyId, disputeType, amount, openedAt }` event is emitted by Tomas after establishing that a material discrepancy cannot be resolved within one business day.
- Dispute types: (a) economic terms dispute — disagreement on trade price, notional, or settlement date; (b) valuation dispute — disagreement on mark-to-market value of an OTC derivative; (c) margin dispute — disagreement on the margin call amount under a CSA.

### 4.2 Resolution Timeline

| Dispute type | Target resolution | Escalation if unresolved |
|---|---|---|
| Economic terms dispute | 3 business days from open | Devon → CEO (above ZAR 5m); legal review by Imani |
| Valuation dispute | 5 business days from open | Helena (valuation methodology review); Nadia (model validation) if model-related |
| Margin dispute | 2 business days from open | Eitan (treasury funding impact); Devon (operational escalation) |

Resolution is confirmed by a `TradeDisputeResolved { tradeId, counterpartyId, resolvedAt, resolution }` event. If resolution requires a trade amendment or cancellation, Kai processes the trade system update and a new `TradeConfirmed` event is emitted.

Unresolved disputes beyond 10 business days are reported to Devon and to Helena as an operational risk event. Disputes involving regulatory reporting obligations (Exchange Control, FSCA transaction reporting) are escalated to Zara (Chief Compliance Officer, governance) immediately on opening.

---

## 5. Long-Form Confirmations for Structured Products

**Owner:** Imani (Legal-as-code engineer, engineering) — documentation; Tomas — operational execution · **Approval:** Imani for standard long-form templates; Devon + Imani for novel structures · **Cadence:** Long-form confirmation required before execution of any structured product · **Citation:** ISDA 2002 Master Agreement + ISDA definitions (2006 ISDA Definitions for IRD; 2014 ISDA Credit Derivatives Definitions) + FIC Act s.22

### Purpose

Structured products — including barrier options, accrual products, complex cross-currency swaps, and instruments not covered by standard ISDA short-form confirmations — require long-form confirmations that fully specify all economic terms, payment schedules, barrier conditions, and governing law provisions. Standard short-form confirmations are not sufficient for these instruments.

### Principles

- **Long-form template library.** Imani maintains a library of approved long-form confirmation templates for structured product types. Only templates in the approved library may be used without further sign-off. Novel structures not covered by an existing template require Imani's ad-hoc drafting and Devon's approval before execution.
- **Pre-execution review.** For any trade that requires a long-form confirmation, Imani reviews the draft confirmation before the trade is executed. No structured product trade may be executed unless Imani has reviewed and approved the long-form confirmation terms. This is not a post-trade process; it is a pre-trade gate.
- **Counterparty legal review.** Imani negotiates any changes to the long-form confirmation requested by the counterparty. Counterparty changes that alter the Bank's economic risk profile, termination rights, or collateral provisions are escalated to Devon.

---

## 6. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `TradeConfirmed` | Trade confirmation received and matched | Tomas / Kai (exchange-confirmed) |
| `TradeDisputeOpened` | Material discrepancy identified after T+1 investigation | Tomas |
| `TradeDisputeResolved` | Dispute resolution agreed and documented | Tomas |

---

## 7. Substrate Dependencies and Gaps

- **Confirmation platform integration (Kai).** Electronic confirmation matching for OTC derivatives via MarkitWIRE or DTCC Deriv/SERV. Auto-generation of `TradeConfirmed` events on electronic match. Gap: platform selection and API integration pending commencement-of-trading build.
- **Confirmation-completeness gate (Kai).** Settlement instruction workflow blocked if `TradeConfirmed` event not present for trade. Discharge exit signal: STRATE instruction rejected at code level for unconfirmed trade.
- **Portfolio reconciliation engine (Tomas).** Automated daily reconciliation against electronic platform data. Currently manual; automation is a roadmap item.
- **Procedure pending full authoring:** `Procedures/by-policy/otc-dispute-resolution.md` — referenced herein; full content to be authored by Tomas under Devon's direction.

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Tomas (Operations & payments engineer, engineering) + Kai (Trading systems engineer, engineering) | Initial policy authored. Five operative sections: (1) Overarching — confirmation completeness gate, electronic platform standard, ISDA netting recognition, events-first accounting; (2) Confirmation Timelines — T+1 FX, T+2 IRS/CDS, T+3 complex, exchange-confirmed; (3) Portfolio Reconciliation — daily active, weekly dormant; (4) Dispute Definition and Resolution — three dispute types, resolution timelines, typed events; (5) Long-form Confirmations. |
| v1.1 | 2026-06-10 | Zara (Chief Compliance Officer, governance) | Obligation-policy coverage gap triage (WS-OBLIGATION-POLICY-MAPPING, brief `brief:zara:triage-close-30-obligation-policy-coverage-gaps-:2026-06-10`). §3.2 extended to state material-terms + valuation scope (CS 3/2018 §5 — closes `ORG-CS3-003`; §4 dispute framework closes `ORG-CS3-004` per CS 3/2018 §6). New §3.3 ODP portfolio-reconciliation conditions (CS 2/2018 §9 — written agreement before first trade, prescribed frequency floors, 3/5-day resolution clocks, deemed disputes — closes `ORG-ODP-COND-007`). New §3.4 portfolio compression (CS 2/2018 §11 — twice-yearly analysis at ≥500 trades, offset termination, records, FSCA explanation — closes `ORG-ODP-COND-009`). Added CS 3/2018 + CS 2/2018 frontmatter citations and `obligations:` frontmatter list so the graph IMPLEMENTED_BY fold derives the edges. |
