---
title: FinSurv ExCon Assessment for FX-Spot Internal Pre-Licence Test
record-id: record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20
author: Rashida (Chief Compliance Officer, governance)
co-author: Owen (Company Secretary, governance) — regulatory-chain sequencing of Authorised Dealer designation vs banking-licence application
date: 2026-05-20
brief: brief:rashida:finsurv-excon-assessment-for-internal-pre-licenc:2026-05-20
workstream: WS-MARKET-RISK-PROCEDURES
classification: governance-deliverable
status: FINAL
citations:
  - Regulations/SARB-FinSurv/source-docs/excon-structured.json
  - Policies/excon-compliance-policy-v1.md
  - Policies/trading-mandate-v1.md
  - Procedures/by-policy/npa-gate.md
  - Procedures/markets/pre-licence-go-live-gate.md
  - 2026-05-20_helena_fx-spot-only-market-risk-scope-review.md
  - 2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md
  - 2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md
  - Regulations/_obligations-register.md
---

# FinSurv ExCon Assessment for FX-Spot Internal Pre-Licence Test

**Author:** Rashida (Chief Compliance Officer, governance)
**Co-author (regulatory-chain sequencing):** Owen (Company Secretary, governance)
**Date:** 2026-05-20
**Brief:** `brief:rashida:finsurv-excon-assessment-for-internal-pre-licenc:2026-05-20`
**Workstream:** WS-MARKET-RISK-PROCEDURES
**Supervisory test:** This document is the bank's regulatory-scope ruling for the internal pre-licence test of FX-spot. It must be defensible to a SARB Financial Surveillance supervisor asking: "Did the entity that has not yet been licensed under the Banks Act, and has not yet been designated as an Authorised Dealer, conduct any activity in scope of the Exchange Control Regulations 1961 or of Section 3(1) of the Currency and Exchanges Manual for Authorised Dealers?"

This deliverable closes the ExCon-scope question raised against Helena (Chief Risk Officer, governance)'s FX-spot-only market-risk scope review (`2026-05-20_helena_fx-spot-only-market-risk-scope-review.md` §1.2 "Addition — ExCon (Authorised Dealer) limits"; PR #631, merged) and her controlled-launch MR-1-FX limit proposal (`2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md`; PR #634, merged), and supplies the compliance-side counterpart to Imani (Chief Legal Counsel, governance)'s G-9 close on master-agreement form (`2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md`; PR #637, merged).

The scope is **internal pre-licence test**: synthetic FX-spot trades booked end-to-end through the production substrate with no real cross-border money movement, no real client involvement, and no real Authorised Dealer status. It is **not** a regulatory-scope policy for live FX-spot activity post-licence; that wider posture is covered in Section 2 (regulatory requirements documented but not blocking build-phase) and finalised under a separate brief at the regulatory-readiness gate.

---

## Section 1 — ExCon applicability to build-phase activity

### 1.0 The question, stated precisely

The internal pre-licence test books synthetic FX-spot trades end-to-end through the production substrate:

- Two named counterparties (Standard Bank Corporate Treasury, Investec Bank Treasury) are wired into the party register at the level required for the SA-CCR and netting-set machinery to fire (`2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md` §1.1–1.2; PR #639 added Standard Bank + Investec as party-register rows). No master agreement is **executed** with either name; the master-agreement form is *recommended* in Imani's G-9 close, not signed.
- Synthetic FX-spot trades emit `FxTradeExecuted`, `FxSpotConfirmed`, `FxSettlementInstructed`, `FxSettlementSettled`, and the in-between schema events. The book valuation, MTM, IPV, and settlement-failure-BCP chains all light up.
- **No real ZAR or USD moves.** No SWIFT MT300 confirmation goes to a counterparty. No payment instruction reaches Standard Bank Corporate Treasury (the intended SWIFT correspondent). No nostro or vostro account at either counterparty receives a debit or credit. The entire flow is internally synthesised: the synthetic-counterparty-acknowledgement seeds are emitted by the test harness in place of the real SWIFT and correspondent-bank responses.
- **No client involvement.** No third party (resident or non-resident) is asked to enter into, signal consent to, or rely upon any synthetic trade. Marc (CEO) is the sole authorising principal; the substrate is the only counterparty to itself.

The question, sharpened: does this activity fall inside or outside the prohibition in **Exchange Control Regulation 2(1)** ("no person other than an authorised dealer shall buy or borrow any foreign currency or any gold from, or sell or lend any foreign currency or any gold to any person not being an authorised dealer") and the equivalent restrictions in **Regulation 3(1)** (export of currency, transfer of credit, payment outside the Republic, etc.) as operationalised in **Section 3(1) of the Currency and Exchanges Manual for Authorised Dealers**?

### 1.1 Ruling

**Outside scope.** The internal pre-licence test does not constitute "buying", "borrowing", "selling" or "lending" foreign currency within the meaning of Exchange Control Regulation 2(1), and does not constitute any of the prohibited acts in Regulation 3(1) or the operational obligations attached to those acts in the Currency and Exchanges Manual for Authorised Dealers.

This ruling is mine to defend as Chief Compliance Officer, on the regulatory-scope dimension. The substrate test may proceed under current authority. The reasoning is set out in §1.2; the limits of the ruling are set out in §1.3; the conditions that, if breached, would flip the activity into scope are set out in §1.4.

### 1.2 Reasoning

The prohibition in Exchange Control Regulation 2(1) is a prohibition on the **buying, selling, borrowing or lending of foreign currency**. The verbs are economic acts: they require a movement of consideration between two persons in which one transfers, and the other receives, a beneficial interest in foreign currency. The Regulation's structure (cf. Reg 2(2)–(5) on conditions, restrictions, and the obligation of a person other than an Authorised Dealer to apply through an Authorised Dealer) presupposes that there is a real counterparty, real consideration, and a real movement of value.

Regulation 3(1) is structured the same way. Its sub-paragraphs (a)–(f) all enumerate acts that produce a movement of money or value across the South African border, or a credit to a person resident outside the Republic, or a contingent right of such a person to receive payment. The verbs are: "take", "send", "transfer", "consign", "deliver", "make any payment to … a person resident outside the Republic", "draw or negotiate any bill of exchange or promissory note … so that a right … to receive a payment in the Republic is created or transferred", "grant any financial assistance". Each predicates on a real consequence — a payment that reaches a non-resident; a security that crosses the border; a debt that, on its face, would settle outside South Africa.

The Currency and Exchanges Manual for Authorised Dealers, Section 3 (cited in the brief as "Section 3(1)"), elaborates these prohibitions into the operational rules ADs must follow when intermediating real cross-border activity for clients — the supporting-documentation verification regime, BoP category coding, FinSurv reporting, and the approval-gate workflow for transactions outside the AD's concessional dealing authority. The Manual is enforceable against ADs in the conduct of real client transactions; it does not contemplate, or by its terms reach, internal substrate rehearsal that produces no client transaction, no cross-border movement, and no Treasury-reportable flow.

The internal pre-licence test does **none** of the things prohibited by Regulation 2(1) or Regulation 3(1):

| Statutory verb (Reg 2(1) and 3(1)) | What the test does |
|---|---|
| "buy" or "borrow" foreign currency | The test books a synthetic `FxTradeExecuted` event in the bank's own event store. No counterparty enters into a contract. No consideration passes. No USD or ZAR moves into or out of the bank's name. |
| "sell" or "lend" foreign currency | As above; the synthetic trade has no real counter-leg. |
| "take or send out of the Republic any bank notes, gold, securities or foreign currency" | Nothing is sent. No SWIFT message leaves the bank's perimeter. No nostro at a correspondent receives an instruction. |
| "transfer any securities from the Republic elsewhere" | No securities are transferred. FX spot is not a security in any event. |
| "make any payment to … a person resident outside the Republic" | No payment is made. No correspondent-bank account is debited or credited. |
| "draw or negotiate any bill of exchange or promissory note … so that a right … to receive a payment in the Republic is created or transferred" | No instrument is drawn or negotiated to anyone. The synthetic confirmation is internal to the test harness. |
| "grant any financial assistance to any person in the Republic, where as security … the person granting … in turn relies on any security … directly or indirectly furnished by … any person resident outside the Republic" | No financial assistance is granted. No counterparty relies on any external security. |

The test substrate is, in regulatory terms, **a simulation of acts**, not the acts themselves. The Exchange Control regime regulates conduct that produces a real economic consequence in the foreign-exchange domain. The test produces no such consequence.

This view is consistent with the bank's standing operating-model framing in `project_rules_bind_at_commencement.md` (Marc, 2026-05-07): banking-specific regulatory rules — including the Authorised Dealer obligations under the Currency and Exchanges Act and the Exchange Control Regulations — apply from the date of commencement of trading as a bank. Until that date the substrate is *preparing for compliance*, not *complying*. The Excon Compliance Policy v1 (`Policies/excon-compliance-policy-v1.md` §1) records the status taxonomy explicitly: AD obligations are **COMMENCEMENT-BIND** — they activate when the Bank first processes a real cross-border transaction, not when the substrate first emits a synthetic trade event into its own event store.

It is also consistent with the bank's indirect-participant operating posture (`project_indirect_participant_posture.md`, 2026-05-07): even at licence-day, the bank will hold full Authorised Dealer status while settling through a CLS-member correspondent. AD designation is the **regulatory authorisation** axis; the **operational settlement path** is independent. The pre-licence test exercises neither axis — there is no AD designation in place, and the settlement path is internal-synthetic. The two axes line up correctly: no authorisation is claimed; no real settlement is performed.

### 1.3 What this ruling does *not* cover

The ruling is narrow. It covers internal substrate rehearsal that produces no real client transaction, no cross-border movement, and no Treasury-reportable flow. It does not cover:

1. **Any real FX-spot trade with a real counterparty.** A real trade with Standard Bank Corporate Treasury, Investec Bank Treasury, or any other counterparty, irrespective of size, falls inside Regulation 2(1) and triggers the full Authorised Dealer obligation set. This is the moment at which the obligations in Section 2 of this assessment become binding. No real trade may be executed under build-phase authority.
2. **"Soft" external sequencing.** A real SWIFT message sent to a real correspondent — even one that the bank intends as a test — is an external act. If a test plan ever proposes sending real SWIFT traffic to Standard Bank Corporate Treasury or Investec Bank Treasury, this ruling does not cover it; the activity must be re-assessed before such traffic is sent, and the AD-designation pre-condition (Section 2) applies.
3. **Customer-onboarding rehearsal that names a real third party.** A KYC/CDD/EDD substrate rehearsal that uses real client identity data, real client signatures, or real client account opening — even framed as a test — engages POPIA on personal-data processing and may engage FAIS and the FIC Act before licence-day. ExCon scope is not directly implicated unless the rehearsal also instructs a real cross-border flow; but the ruling here is FX-specific and does not address those adjacent regimes.
4. **A move from "internal pre-licence test" to "controlled launch".** Helena's controlled-launch MR-1-FX limit proposal (PR #634) and Imani's G-9 close on master-agreement form (PR #637) describe the **first real trades** under a controlled-launch NPA-gate disposition. That is post-licence activity. The transition from internal pre-licence test to controlled launch crosses the COMMENCEMENT-BIND threshold and requires all of Section 2 to be discharged.

### 1.4 Conditions that, if breached, flip the activity into scope

The ruling is conditional on the following test-substrate properties being preserved throughout the internal pre-licence test. Each property maps to a verb in Regulation 2(1) / 3(1); if breached, the verb engages and the ruling does not hold.

| Test-substrate property | If breached, the verb engaged |
|---|---|
| No real ZAR or USD movement in or out of any bank account in the name of the entity. | "buy" / "sell" / "borrow" / "lend" foreign currency; "make any payment to … a person resident outside the Republic". |
| No real SWIFT MT300 (or equivalent) message dispatched to a real counterparty or correspondent. | "send … any bank notes … or foreign currency to any person for the purpose of taking, sending or removing such … foreign currency out of the Republic"; "make any payment". |
| No real counterparty signs any document or otherwise enters into any binding undertaking on the strength of a synthetic trade. | "draw or negotiate any bill of exchange or promissory note … so that a right … to receive a payment … is created". |
| Synthetic-counterparty-acknowledgement events are emitted by the test harness only, with explicit `actor.type: "service"` and explicit synthetic-flag metadata; no event is fabricated so as to misrepresent that a real counterparty acted. | Integrity of the test substrate; engages Banks Act Reg 39 conduct and Joint Standard 1 of 2024 record-keeping if breached, independently of ExCon. |
| The party-register rows for Standard Bank Corporate Treasury and Investec Bank Treasury carry a `relationship-status` that distinguishes "wired into substrate for test" from "active trading counterparty". | Identity-misrepresentation risk; POPIA s.19–22 personal-data integrity if any natural-person data is processed. |

Each of these conditions is engineering-testable. Section 5 lists the substrate gap (test-substrate property attestation) that an engineering brief should close so that a recon pipeline asserts these conditions continuously.

---

## Section 2 — Pre-licence regulatory requirements (documented, not blocking build-phase)

The following requirements must be in place **before any real FX-spot trade is executed post-licence**. They do not block the internal pre-licence test (per Section 1) but are the binding pre-conditions for transitioning to controlled launch (Helena's MR-1-FX framework). Owen (Company Secretary, governance) co-owns the regulatory-chain sequencing in this section, particularly the AD designation vs banking-licence application interaction.

### 2.1 Authorised Dealer designation (separate SARB application; sequenced with banking-licence application)

**Regulator:** SARB Financial Surveillance Department (FinSurv).
**Citation:** Currency and Exchanges Act 9 of 1933, section 9 (Treasury designation of Authorised Dealers); Exchange Control Regulations 1961, Regulation 2 (AD dealing authority); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv, as amended).
**Requirement:** AD designation is granted by SARB FinSurv on application. It is a separate regulatory act from the Banks Act 94 of 1990 banking-licence grant by the Prudential Authority (PA), but is in practice **conditional on holding a Banks Act licence in good standing** (`Policies/excon-compliance-policy-v1.md` §1: "AD status is integral to the banking licence"). The two applications are commonly progressed in parallel; AD designation is typically conferred at or shortly after Banks Act licence-grant, with a defined transition window during which the bank may not yet transact as an AD.
**Sequencing (Owen, co-author):** Owen's view on regulatory-chain sequencing is:
1. **Banks Act licence application** to the PA is the gating regulatory step. It is the long-lead-time submission and the precondition for AD designation. Saskia (Chief Markets Officer, governance) and Owen co-track the licence-application timeline at the pre-licence go-live gate.
2. **AD designation application** is submitted to SARB FinSurv either concurrently with the Banks Act application or as soon as the PA has signalled an in-principle decision. It is **not** a precondition for the banking licence; it is a precondition for the *commencement of cross-border activity* post-licence. Submitting AD-designation in parallel with the Banks Act application avoids a sequencing gap between licence-grant and first FX-spot trade.
3. **AD-Manual undertaking.** As part of the AD application, the bank signs an undertaking to comply with the Currency and Exchanges Manual for Authorised Dealers. This is the legal anchor for the Manual's operational requirements (BoP coding, supporting documentation, FinSurv reporting, approval gates).
4. **Designation publication.** SARB FinSurv publishes designations of Authorised Dealers; the bank's designation becomes effective on the date stated in the designation notice.
**Owner of the application:** Rashida (Chief Compliance Officer, governance) — lead on the AD-Manual undertaking and the FinSurv-relationship management; Owen (Company Secretary, governance) — co-author for the legal-entity and director-attestation pack accompanying the application; Imani (Chief Legal Counsel, governance) — legal-as-code support on the Currency and Exchanges Act chain.
**Expected timeline relative to Banks Act licence-application date:** AD application filed ≤30 days after Banks Act application; AD designation expected within 60–120 days of Banks Act licence-grant, subject to FinSurv processing capacity.

### 2.2 FinSurv reporting pipeline (per-trade reporting; thresholds; BoP categories)

**Regulator:** SARB FinSurv.
**Citation:** Exchange Control Regulations 1961, Regulation 19 (furnishing of information); Currency and Exchanges Manual for Authorised Dealers, Section B (current account) and Section H (capital and financial account); SARB FinSurv Reporting System Manual (BoP category codes and reporting format); obligations register rows `ORG-FX-FIN-01` through `ORG-FX-FIN-14` (BoP category obligations).
**Requirement:** Every cross-border FX-spot trade that the bank intermediates must be reported to SARB FinSurv with the correct BoP category code, the correct counterparty identification, the correct amount in transaction currency and ZAR equivalent, and the correct supporting-documentation reference. The reporting is per-transaction (not aggregated); the threshold for individual-transaction reporting is set in the AD Manual (the de-minimis threshold for the no-charge/nil-value category is captured in `ORG-FX-FIN-14`).
**Sub-components for FX-spot specifically:**
- BoP category mapping for FX-spot trades by underlying purpose (services payment, investment-income flow, FDI, portfolio-investment, etc.). FX-spot is the vehicle; the BoP code reflects the underlying economic purpose. Bea (Accounting and financial reporting engineer, engineering) builds the BoP-code mapping engine; Mira (Regulatory intelligence engineer, compliance) curates the BoP-code library.
- Supporting-documentation verification per the Manual (invoices, contracts, supplier statements, etc.). Niko (Client lifecycle agent) provides the supporting documentation through the onboarding and ongoing-due-diligence pipeline.
- Transaction-ledger-to-FinSurv reconciliation (`Policies/excon-compliance-policy-v1.md` §1: "Inspection readiness is continuous"). Bea operates the reconciliation engine; Vera (Internal audit engineer, engineering) tests it.
- Exempt-flow and no-charge-flow handling (`ORG-FX-FIN-13`, `ORG-FX-FIN-14`).
**Owner of the application:** Rashida (Chief Compliance Officer, governance) — owner of the FinSurv reporting-accuracy programme; Bea (engineering) — owner of the reporting-module build; Mira (compliance — reports to Rashida in the operating model implied by this assessment; see Section 5 substrate gap) — owner of the BoP-code library.
**Expected timeline:** Pipeline live and tested by the pre-licence go-live gate (PROC-MK-PLG-01 OPS-condition (c)). See Section 4 for what "tested" means at each stage.

### 2.3 BA-125 (FX exposure) return wiring

**Regulator:** SARB Prudential Authority (PA).
**Citation:** Banks Act 94 of 1990; Regulations Relating to Banks, Form BA 125 (gross effective open foreign currency position); SARB PA reporting framework.
**Requirement:** The bank, as a registered bank with FX exposure, files Form BA 125 to the PA on the prescribed reporting cadence (monthly; with PA-specified granularity). BA 125 reports the bank's gross and net effective open foreign currency positions by currency pair, against the PA limits (the PA's net open position limit is set as a percentage of qualifying capital). This is **separate from FinSurv flow reporting**; BA 125 is a *position* return (snapshot), FinSurv is *flow* reporting (per-transaction). Both bind.
**Sub-components for FX-spot:**
- Daily mark-to-market of the FX-spot book against the SARB daily fixing (per Helena's controlled-launch §1, the MR-1-FX limit framework, and `Policies/valuation-policy-v1.md` §3.1).
- Effective open-position computation per currency pair (USD/ZAR at controlled-launch; the live pair set when it widens), inclusive of T+2 settlement exposure (Helena's scope review §1.2 footnote).
- Aggregation against the PA net-open-position limit (a percentage of qualifying capital; Rohan (Market risk quantitative engineer, engineering) wires the engine; Camille (Chief Financial Officer, governance) signs off the capital-side input).
- Reporting cadence and template alignment with the SARB BA-125 schema.
**Owner of the application:** Camille (Chief Financial Officer, governance) — owner of the BA 125 return as a capital-reporting return; Rohan (engineering) — owner of the effective-open-position engine; Helena (CRO) — owner of the risk-limit side; Rashida (CCO) — secondary owner for the cross-tie to AD obligations.
**Expected timeline:** Wired by the pre-licence go-live gate; dry-run filing rehearsed before the first real FX-spot trade.

### 2.4 Currency-pair authorisations

**Regulator:** SARB FinSurv via the AD Manual.
**Citation:** Currency and Exchanges Manual for Authorised Dealers (currency-pair conventions); SARB FinSurv circulars on permissible currency-pairs.
**Requirement:** ADs may transact in any convertible currency under standing AD authority; the practical envelope is set by the bank's risk-appetite (Helena's scope review and trading-mandate `§2.5`) and by SARB FinSurv conventions on currency-pair reporting in the BoP framework. At controlled-launch the only authorised pair is **USD/ZAR** (Helena PR #634 §1; `Policies/trading-mandate-v1.md §2.5`). Widening to additional pairs (EUR/ZAR, GBP/ZAR) requires either a Trading Mandate amendment (Helena) or a fresh NPA gate (Saskia + Helena + Rashida), per `Procedures/by-policy/npa-gate.md`.
**Owner:** Helena (CRO) for the appetite-side enumeration; Rashida (CCO) for the regulatory-side confirmation that no SARB FinSurv prior approval is required for any currency-pair on the bank's enumerated set.
**Expected timeline:** USD/ZAR confirmed at controlled-launch; any widening triggers an NPA gate.

### 2.5 Settlement reporting (cross-border settlement notification)

**Regulator:** SARB FinSurv.
**Citation:** Exchange Control Regulations 1961, Regulation 3(1)(d) (right to receive a payment in the Republic created or transferred as consideration for receipt outside); Currency and Exchanges Manual for Authorised Dealers (settlement-side reporting conventions).
**Requirement:** Cross-border settlement of FX-spot trades — even where the bank is settling via a CLS-member correspondent rather than directly through CLS — must be reported to SARB FinSurv with the correct BoP code at the **settlement event**, not at trade-execution. The settlement-side reporting consolidates trade-side and settlement-side records via the AD's transaction ledger. The bank's indirect-participant posture (settlement through Standard Bank as CLS-member correspondent) does **not** displace this reporting obligation: the bank remains the AD of record for trades it intermediates, and the FinSurv-reportable event is the AD's settlement event, even if the operational settlement is executed by the correspondent.
**Owner:** Rashida (CCO) — reporting programme; Tomas (Payments and correspondent-banking engineer, engineering) — settlement-instruction-to-FinSurv-event mapping; Bea — reconciliation.
**Expected timeline:** Wired by the pre-licence go-live gate.

### 2.6 Excon Compliance Policy v1 — programme ownership

The Excon Compliance Policy v1 (`Policies/excon-compliance-policy-v1.md`) is in force and covers the substrate programme. The policy attributes ownership to "Zara (Chief Compliance Officer, governance)" — this assessment is filed under "Rashida (Chief Compliance Officer, governance)" per the dispatching brief. The persona-vs-policy attribution discrepancy is flagged as a substrate gap in Section 5; it is **not material to the regulatory ruling** in Section 1, which rests on the substantive scope analysis of Regulations 2(1) and 3(1) rather than on who-signs.

---

## Section 3 — NPA gate `regulatory-legal` dimension implications

The New Product Approval gate (`Procedures/by-policy/npa-gate.md`) covers 14 product-due-diligence dimensions. ExCon assessment sits in the `regulatory-legal` dimension. The evidence required to clear the dimension for FX-spot differs by lifecycle stage.

### 3.1 Internal pre-licence test — evidence required

For an FX-spot product launched into the internal pre-licence test (substrate rehearsal only), the `regulatory-legal` dimension clears on the following evidence pack:

1. **This assessment** (`record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20`) — the regulatory-scope ruling stating that internal substrate rehearsal is outside ExCon scope.
2. **Test-substrate property attestation** — the engineering attestation (per §1.4 of this assessment) that no real ZAR or USD moves, no real SWIFT messages dispatch, no real counterparty acts, and the synthetic-counterparty-acknowledgement events are explicitly flagged. The attestation is emitted by the test-substrate harness and recorded in the event store. (Substrate gap: §5 below — the attestation event type and the recon pipeline that asserts the properties continuously do not yet exist; until they do, Rashida signs the attestation manually as a `RegulatoryScopeAttestation` `RecordFiled` event.)
3. **NPA-gate `NPAGateOpinionSubmitted` event from Rashida** with `participant: 'rashida'` (or `participant: 'zara'` in the current substrate; see Section 5 substrate gap) and `opinion: approve`. The opinion-citation chain cites this assessment.

No FinSurv pipeline live-and-tested condition applies at this stage; no AD designation is required; no BA 125 live filing is required.

### 3.2 Controlled-launch (post-licence) — evidence required

For an FX-spot product moving into controlled-launch (Helena's MR-1-FX framework, PR #634), the `regulatory-legal` dimension requires the full pre-licence regulatory-requirement set in Section 2 to be discharged:

1. **AD designation in place** — SARB FinSurv designation notice (Section 2.1) — `RegulatoryApprovalReceived` event with `approvalId: AD-DESIGNATION`, `authority: SARB-FINSURV`, evidence attached.
2. **FinSurv reporting pipeline live and tested** — the BoP-code mapping engine, the per-transaction reporting subscriber, the supporting-documentation verification workflow, and the transaction-ledger-to-FinSurv reconciliation. Tested under realistic load against the controlled-launch counterparty set. (Substrate gap: §5.)
3. **BA 125 return wired** — at least one dry-run BA 125 filing rehearsed; SARB PA reporting submission template signed off. (Substrate gap: §5.)
4. **Currency-pair authorisation confirmed** — USD/ZAR at controlled-launch; no widening planned.
5. **Settlement-reporting subscriber live** — the settlement-event-to-FinSurv-event mapping live and tested.
6. **Compensating-control attestation block** — Helena's compensating-control block (PR #634) covers the manual-attestation period before the automated pipeline goes live; Rashida co-attests the ExCon slice.

### 3.3 Live (out of controlled-launch) — evidence required

For an FX-spot product moving out of controlled-launch to full live trading, the `regulatory-legal` dimension requires §3.2 plus:

7. **Operational maturity attestation** — at least N successful controlled-launch trades with zero ExCon findings; the precise N is set in Helena's controlled-launch exit criteria (PR #634 §2). Vera (Internal audit engineer, engineering) attests.
8. **Automated FinSurv submission** — the manual-attestation compensating control retires; the per-transaction FinSurv submission runs automated with exception-routing only.
9. **External-counsel ratification of the AD-Manual undertaking** — the AD-Manual undertaking signed on the AD-designation application is reviewed by external counsel against the bank's operating model; any concessional-dealing-authority ambiguities are resolved.
10. **Annual AD-Manual review cycle established** — `Policies/excon-compliance-policy-v1.md` §1 cadence (annual; triggered on each SARB FinSurv update) is in motion.

---

## Section 4 — Pre-licence go-live gate OPS-condition (c) — what "tested" means at each stage

`Procedures/markets/pre-licence-go-live-gate.md` Step 3 sets OPS-condition (c) as "Regulatory reporting pipelines live and tested (FinSurv, SARB returns)". The phrase "live and tested" requires precision for FX-spot.

### 4.1 Internal pre-licence test — what "tested" means

At the internal-pre-licence-test stage, OPS-condition (c) is **not yet engaged for FX-spot**. The test substrate is outside ExCon scope (Section 1). "Tested" at this stage means the substrate emits the events that would, on commencement of real trading, drive the FinSurv pipeline — i.e. the test-substrate property attestation confirms the substrate is wired-but-quiet:

1. `FxTradeExecuted` and downstream events flow to the BoP-classification engine; the engine produces a candidate BoP code; the candidate is logged but **no FinSurv submission is dispatched** (a real submission would require a real AD designation and a real cross-border flow, neither of which exists at this stage).
2. The BoP-code library covers the FX-spot category mappings (a sub-set of the 14 categories in `ORG-FX-FIN-01` through `ORG-FX-FIN-14`; FX-spot at this scope predominantly touches `ORG-FX-FIN-02` services, `ORG-FX-FIN-06` portfolio-investment, and `ORG-FX-FIN-08` financial-derivative cash-flows — but a real FX-spot at this stage does not exist, so coverage is theoretical).
3. The transaction-ledger-to-FinSurv-reconciliation engine runs end-to-end against synthetic trades and produces a reconciliation report.
4. The supporting-documentation verification workflow is wired and reachable from the trade-event path (it does not need to verify real documents because no real trades exist).

### 4.2 Controlled launch — what "tested" means

At controlled-launch, OPS-condition (c) is **fully engaged**. "Tested" means:

1. **AD designation in place** (Section 2.1). Without AD designation, no real FX-spot trade may execute; OPS-condition (c) cannot clear.
2. **FinSurv pipeline live**: every real FX-spot trade emits a FinSurv submission with the correct BoP category code, correct amount in transaction currency and ZAR equivalent, correct counterparty identification, and correct supporting-documentation reference, within the AD-Manual-prescribed submission window.
3. **End-to-end dry-run completed**: at least one trade-to-FinSurv-submission-to-reconciliation cycle has run against a real (or simulated-but-realistic) FinSurv test endpoint, with an external review (Vera + Rashida).
4. **BA 125 dry-run filed**: at least one BA 125 has been computed and dry-run-submitted; the SARB PA reporting submission template has been signed off; the effective-open-position engine reconciles to the GL.
5. **Settlement-reporting subscriber live**: the settlement-event-to-FinSurv-event mapping is live and reconciled.
6. **Compensating-control attestation block in place** (Helena's PR #634 framing): Rashida attests the ExCon slice manually for each trade during the controlled-launch window; the attestation is recorded as a typed event.
7. **Exception-routing live**: BoP-misclassification candidates, settlement-fail-with-FX-leg events, and supporting-documentation-missing events route to an exception queue with a defined handling SLA.

### 4.3 Live — what "tested" means

At the move out of controlled-launch to full live, OPS-condition (c) requires §4.2 plus:

8. **Continuous-load testing**: the pipeline has handled N successful controlled-launch trades with zero ExCon findings (N per Helena's exit criteria).
9. **Automated submission retiring the compensating control**: per-transaction FinSurv submission runs automated; Rashida's manual ExCon attestation retires; exception-routing only.
10. **Annual cadence established**: the annual AD-Manual review and the annual external-counsel ratification cycles are in motion (Section 3.3 #9, #10).

---

## Section 5 — Substrate gaps surfaced

The internal pre-licence test does not require any new engineering before it runs (Section 1 ruling stands on the substantive scope analysis). The gaps below are required to close before **controlled launch** for OPS-condition (c) to clear, plus operational-hygiene gaps that should close before the next dispatch cycle. Each is a candidate for a separate engineering brief; the briefs are not authored here.

### 5.1 BoP-code mapping engine for FX-spot

Build the BoP-code mapping engine that, on `FxTradeExecuted`, produces a candidate BoP category code for the underlying purpose of the trade. The engine is the front-end of the FinSurv reporting pipeline. Mira (Regulatory intelligence engineer, compliance) curates the code library; Bea (Accounting and financial reporting engineer, engineering) builds the engine. The substrate row already exists in `Policies/excon-compliance-policy-v1.md` §2; the engineering brief makes it real.

### 5.2 Per-trade FinSurv-submission subscriber

Build the subscriber that, on every real FX-spot trade post-AD-designation, dispatches a FinSurv submission with the correct payload. At controlled-launch, the subscriber dispatches into a SARB FinSurv test endpoint and a reconciliation harness; at live, into the production endpoint. The subscriber implements the per-transaction reporting requirement in `ORG-FX-FIN-01` through `ORG-FX-FIN-14`.

### 5.3 BA 125 effective-open-position return generator

Build the BA 125 return generator: daily mark-to-market computation of the FX book against the SARB daily fixing; effective-open-position aggregation per currency pair; PA-limit-check; SARB PA return-template rendering and dry-run submission. Rohan (Market risk quantitative engineer, engineering) owns the position engine; Camille (CFO) owns the return as a capital-reporting return.

### 5.4 Settlement-event-to-FinSurv-event mapping

Build the mapping that, on the settlement-side event (`FxSettlementSettled` or equivalent), emits the corresponding FinSurv settlement-side record. Tomas (Payments and correspondent-banking engineer, engineering) owns the settlement-instruction path; Bea owns the FinSurv-event mapping.

### 5.5 Test-substrate property attestation event + recon pipeline

Build the `RegulatoryScopeAttestation` event type (or equivalent) and the recon pipeline that asserts the §1.4 properties continuously throughout the internal pre-licence test:

- No real ZAR or USD moves (no settlement-side movement events without a synthetic-flag);
- No real SWIFT MT300 dispatches (the SWIFT-dispatch path is mocked behind a feature flag);
- No real counterparty action (`actor.type: "service"` only on counterparty-acknowledgement events);
- Synthetic-flag metadata present on every synthetic event.

The pipeline produces a continuous attestation that the test substrate remains within Section 1 scope. Vera (Internal audit engineer, engineering) consumes the attestation as third-line evidence.

### 5.6 Persona-attribution alignment (operational substrate gap)

The brief and dispatch addressed me as "Rashida (Chief Compliance Officer, governance)". The Team roster (`Team/_team-roster.json`) and `Team/Zara.md` attribute the CCO seat to **Zara**; `Team/Rashida.md` attributes the **CISO** seat to Rashida. The `Procedures/markets/pre-licence-go-live-gate.md` procedure (lines 4, 6, 21, 58, 65, 72, 75, 76, 78, 85, 99, 129) names Rashida as CCO; `Procedures/by-policy/npa-gate.md` (lines 4, 14, 60, 72, 78) names Zara. The `Policies/excon-compliance-policy-v1.md` policy names Zara.

This is a pre-existing substrate inconsistency, not introduced by this deliverable. The substantive regulatory ruling in Section 1 does not depend on which name holds the CCO seat. The gap should close via a Vera mandate-coverage recon pipeline assertion (Wave-4 #10 agent-spec-integrity or a sibling pipeline) and an Owen-led reconciliation across the persona roster, the NPA gate procedure, the pre-licence go-live gate procedure, and the Excon Compliance Policy v1. Until reconciled, this assessment is filed under "Rashida (Chief Compliance Officer, governance)" per the dispatching brief; downstream artefacts that consume this assessment may need to translate the attribution.

### 5.7 NPA-gate participant enumeration alignment

`Procedures/by-policy/npa-gate.md` Step 7 (line 60) names "Zara (CCO)" as the participant emitting `NPAGateOpinionSubmitted { participant: 'zara' }` for the conduct/AML/FAIS/POPIA dimensions; the procedure does not currently expose a distinct slot for ExCon under the `regulatory-legal` dimension. The procedure should be amended (in a follow-on brief) to:

1. Reconcile the participant attribution with §5.6 above;
2. Expose the `regulatory-legal` dimension explicitly with an ExCon-specific opinion slot (FinSurv-pipeline-ready check, AD-designation check, BA-125-wired check);
3. Wire the `NPAGateOpinionSubmitted` schema to cite this assessment for FX-spot.

---

## Section 6 — CEO recommendation

**Recommendation:** The internal pre-licence test of FX-spot may proceed under current substrate authority. No SARB FinSurv permission, notification, or designation is required before the test runs.

**Rationale:**

1. The internal pre-licence test does not constitute "buying", "selling", "borrowing" or "lending" foreign currency within Exchange Control Regulation 2(1), and does not constitute any of the prohibited acts in Regulation 3(1) or the operational obligations in Section 3 of the Currency and Exchanges Manual for Authorised Dealers (Section 1.1 of this assessment).
2. The activity is consistent with the bank's standing operating-model framing (`project_rules_bind_at_commencement.md`): Authorised Dealer obligations are COMMENCEMENT-BIND and activate when the bank first processes a real cross-border transaction, not when the substrate emits a synthetic trade event.
3. The §1.4 conditions are engineering-testable; the test-substrate property attestation (substrate gap §5.5) should be built in parallel with the test running, so that a recon pipeline asserts the conditions continuously. Until §5.5 lands, I (Rashida) sign the attestation manually as a `RecordFiled` event per dispatch cycle.
4. Section 2 lists the regulatory requirements binding before any **real** post-licence FX-spot trade; none of them block the internal test. The pre-licence go-live gate (PROC-MK-PLG-01) OPS-condition (c) requires the Section 2 set to be discharged before commencement-of-trading; the substrate gaps in Section 5 are the engineering work that closes that condition.

**Single clear ask to CEO:** Approve the internal pre-licence test of FX-spot to proceed under this assessment. No further regulatory action is required at the build-phase boundary. Approve also the surfacing of Section 5 substrate gaps as candidate engineering briefs, to be sequenced into the pre-licence go-live readiness gate timeline by Saskia + Owen + Devon under the standing co-chair arrangement.

---

## Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-05-20 | Rashida (Chief Compliance Officer, governance); Owen (Company Secretary, governance) for §2.1 sequencing | Initial filing. Regulatory ruling that internal pre-licence test is outside ExCon scope; Section 2 pre-licence requirements documented; Section 5 substrate gaps surfaced including the persona-attribution gap. |
