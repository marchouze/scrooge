---
policy-id: COND-TCF-01
title: Conduct of Business and Treating Customers Fairly Policy v1
version: "1.0"
status: DRAFT
owner: Zara (Chief Compliance Officer, governance)
effective-from: 2026-05-13
citations:
  - "Financial Advisory and Intermediary Services Act 37/2002: General Code r.3A (fair treatment)"
  - "Financial Sector Regulation Act 9/2017: s57 (conduct of financial institutions)"
  - "FSCA TCF Framework: Treating Customers Fairly outcomes (2011, updated 2018)"
  - "Conduct Standard for Banks CS1/2020: §3-4 (conduct of business)"
  - "FAIS General Code of Conduct: r.8 (suitability)"
author: Zara (Chief Compliance Officer, governance)
date: 2026-05-13
summary: Establishes the bank's conduct of business standards and Treating Customers Fairly framework, covering fair dealing, client suitability, pricing transparency, and conduct governance for an institutional-only client base.
decision-required: false
riskTaxonomy:
  - COND-001
  - COND-002
  - GOV-002
applies-at: COMMENCEMENT-BIND
obligations-closed:
  - ORG-CD-01
  - ORG-CD-04
  - ORG-CD-06
  - ORG-CD-08
---

# Conduct of Business and Treating Customers Fairly Policy v1

> **Policy** | COND-TCF-01 v1.0 | Owner: Zara (Chief Compliance Officer, governance) | Status: DRAFT | Effective: 2026-05-13

> **Authors.** Zara (Chief Compliance Officer, governance) — lead and policy owner.
> **Standing authority.** Financial Advisory and Intermediary Services Act 37/2002 (FAIS) General Code r.3A (fair treatment); Financial Sector Regulation Act 9/2017 (FSR Act) s57 (conduct of financial institutions); FSCA TCF Framework (2011, updated 2018); Conduct Standard for Banks CS1/2020 §3-4; FAIS General Code r.8 (suitability).
> **Obligations closed.** `ORG-CD-01` (fair treatment framework); `ORG-CD-04` (client suitability — FAIS s16 KYC); `ORG-CD-06` (pricing transparency — pre-trade disclosure); `ORG-CD-08` (conduct monitoring and MI to ExCo); all COMMENCEMENT-BIND.
> **Status.** COMMENCEMENT-BIND. This policy applies from the first client interaction at commencement of trading. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). Certain build-phase actions (client classification framework, product governance integration) are load-bearing pre-conditions for licence readiness.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## Purpose

This policy governs Hoz Bank Limited's (the "Bank") conduct of business standards and its implementation of the Treating Customers Fairly (TCF) framework as mandated by the FSCA. The Bank is an institutional global-markets bank operating exclusively with professional institutional clients (banks, asset managers, pension funds, insurance companies, corporates). The conduct obligations that attach to this client profile differ from those applicable to retail financial services providers — the TCF six outcomes apply fully, but the nature of fair treatment and suitability is calibrated to a market where clients are sophisticated market participants with their own risk management capabilities.

The policy exists to ensure that:

(i) every client interaction — from onboarding through to product delivery and post-trade service — reflects fair dealing standards embedded in the FSR Act, FAIS, and the FSCA TCF framework;
(ii) the Bank does not engage in conduct that could constitute market abuse, front-running, misrepresentation, or price manipulation, as these are both conduct and criminal-law issues;
(iii) suitability and appropriateness assessments are conducted for complex OTC products before first trading, consistent with FAIS s16 know-your-client requirements;
(iv) pricing is transparent, pre-trade, and free of hidden fees or embedded charges not disclosed in the client agreement;
(v) conduct governance is formalised — monitoring outputs reviewed, MI to ExCo, FSCA engagement — so that the Bank can demonstrate an ongoing conduct culture to the regulator.

The policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). Procedures under this policy (including `Procedures/by-policy/client-onboarding-conduct.md`, `Procedures/by-policy/suitability-assessment.md`, and `Procedures/by-policy/conduct-monitoring.md`) operationalise it; the trade surveillance system, client classification register, and conduct MI dashboard are the system capabilities that execute those procedures.

---

## Principles

- **Fair treatment is not optional for institutional clients.** The TCF six outcomes apply to the Bank's institutional client dealings. Sophistication of the counterparty does not negate the obligation; it changes the texture of what fair treatment looks like (e.g., suitability is appropriateness-based rather than the full retail suitability test, but it still applies).
- **Conduct is a first-line responsibility.** The trading desks and the relationship teams are the first line of conduct defence. Zara is the second-line monitor and the FSCA relationship owner. Vera provides third-line assurance. No conduct obligation is Zara's to execute operationally; it is Zara's to define, monitor, and enforce.
- **No front-running.** The Bank does not trade on client order information for its own account ahead of client execution. This is both a conduct prohibition (TCF Outcome 6 — no post-sale barriers) and a market abuse prohibition (Financial Markets Act 19/2012). The prohibition is absolute.
- **No misrepresentation.** No client is misled about the nature of a product, its risks, its pricing, the Bank's capacity in which it is acting (principal vs. agent), or any material term of the transaction.
- **Best execution effort.** The Bank uses reasonable efforts to obtain the best available execution for client orders, given the client's instructions, the market conditions, and the Bank's role (market-maker or agent). Best execution is a conduct obligation and an operational discipline; it is monitored by Zara via trade surveillance.
- **Events-first conduct accounting.** Conduct assessments, suitability sign-offs, pricing disclosures, surveillance findings, and MI events are typed events in the event log, not spreadsheet records (Principle 1). The canonical conduct record is a `ConductEventRecorded { type, clientId, productType, finding, disposition }` event.

---

## 1. Scope

This policy applies to:

- All client-facing activities of the Bank from commencement of trading: OTC interest-rate derivative transactions, JSE bond and equity facilitation, and any future product categories approved through the New Product Approval (NPA) gate.
- All personnel and agents acting in a client-facing capacity on behalf of the Bank (trading desks, relationship management, treasury, settlement).
- All client categories (the Bank serves institutional clients only — see §3.1 for client categorisation).
- All channels of client interaction: OTC (voice and electronic), JSE-listed execution, post-trade service and reporting.

This policy does not cover:

- Internal transactions between Bank legal entities (no client conduct obligation arises on intragroup transactions).
- Market conduct obligations in the context of market infrastructure participation (governed separately under the Financial Markets Act 19/2012 and JSE Rules).

---

## 2. Governance

**Policy owner:** Zara (Chief Compliance Officer, governance) — owns the conduct and TCF framework; holds the FSCA relationship; reviews trade surveillance outputs; tables quarterly conduct MI to ExCo.
**First line:** Trading desk heads — responsible for day-to-day compliance with this policy; conduct incidents are reported to Zara within one business day.
**Legal support:** Imani (Legal-as-code engineer, engineering) — advises on FAIS, FSR Act, and Conduct Standard for Banks interpretation; integrates conduct obligations into the legal-entity contract library.
**Product governance:** Conduct implications of new products are assessed at the NPA gate; Zara reviews and approves the conduct section of each NPA submission.
**Training:** Sade (AgentOps, engineering) administers the annual conduct training programme; records are kept in the HR system (AgentOps substrate); Zara sets the curriculum.
**Third-line assurance:** Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) provides annual assurance over the conduct monitoring framework, TCF implementation, and conduct MI accuracy.
**Secretariat:** Owen (Company Secretary, governance) files conduct committee minutes and governance events.

### 2.1 Conduct Oversight Forum

The Conduct Oversight Forum (sub-committee of the ExCo) oversees the conduct and TCF framework. Membership: Zara (chair), the trading desk heads (first line), Imani. CEO attends for any material FSCA engagement or remediation plan. Vera attends to present audit findings. Standing agenda: (i) trade surveillance MI — alerts, dispositions; (ii) conduct incident register; (iii) FSCA inspection status and regulatory engagement; (iv) new product conduct sign-offs (NPA gate outputs); (v) training completion; (vi) upcoming regulatory developments.

### 2.2 FSCA Engagement

Zara is the Bank's primary liaison with the FSCA on conduct matters. All FSCA correspondence relating to conduct supervision, inspection findings, and enforcement actions is routed through Zara. Owen manages the formal filing of FSCA correspondence as typed events (`RegulatorCorrespondenceReceived { regulator: "FSCA", type, subject, date }`, `RegulatorCorrespondenceDispatched { ... }`).

---

## 3. Standards & Limits

### 3.1 Client Categorisation

The Bank serves institutional clients only. For the purposes of this policy and FAIS, institutional clients are classified as:

**Professional clients / Sophisticated investors.** All of the Bank's clients fall into this category: banks, registered broker-dealers, licensed asset managers, pension funds (registered under the Pension Funds Act), insurance companies (licensed under the Insurance Act), and large corporates meeting the FAIS General Code's financial sophistication threshold. The Bank does not onboard retail clients; any prospective client that cannot be classified as a professional client / sophisticated investor is declined at onboarding.

**Classification process.** At onboarding, the compliance team (under Zara's oversight) obtains the documentary evidence required to confirm professional client classification (FSCA licence confirmation, financial statement evidence, board resolution, key individual confirmation as applicable). A `ClientClassificationConfirmed { clientId, category: "professional", evidenceSummary[] }` event is the canonical classification record; it must be in the event log before any trade is executed with the client.

**Classification review.** Client classification is reviewed at least annually (or upon any material change in the client's regulatory status or financial condition). A lapsed classification triggers an immediate trading suspension for that client until reclassification is confirmed.

### 3.2 TCF Six Outcomes — Institutional Client Mapping

The FSCA's TCF framework defines six outcomes. Their application in the Bank's institutional context:

| TCF Outcome | FSCA Description | Institutional Application |
|---|---|---|
| 1. Culture | Clients can be confident the fair treatment of customers is central to the firm's culture | Evidenced by: conduct policy, training, ExCo MI, CEO sign-off of conduct risk appetite |
| 2. Products designed for target market | Products are designed to meet the needs of identified customer groups | Addressed via NPA gate — product governance validates institutional client fit before launch |
| 3. Clear information | Clients are provided with clear and timely information | Pre-trade: term sheet, pricing disclosure, risk disclosure. Post-trade: confirmations, valuations on request |
| 4. Suitability | Advice and transactions are suitable for the client's circumstances | Appropriateness assessment for complex OTC products (§3.3 below); no advice given without FAIS s16 KYC |
| 5. Performance as expected | Products perform as clients have been led to expect | No misrepresentation of product characteristics; P&L explanations on request; no hidden charges |
| 6. No post-sale barriers | Clients do not face post-sale barriers to switching, claims, or complaints | Clear complaint process; no lock-in beyond agreed terms; novation and assignment facilitated per ISDA master |

A `TcfOutcomeAssessment { outcome, period, evidenceSummary, gaps[] }` event is filed annually by Zara for each of the six outcomes, as the basis for the annual TCF review tabled to the Conduct Oversight Forum and ExCo.

### 3.3 Suitability and Appropriateness

**Suitability vs. appropriateness.** FAIS distinguishes advice (requiring a full suitability assessment) from execution-only dealing (requiring appropriateness). The Bank primarily provides execution and market-making services to professional institutional clients — this is execution-only dealing, not financial advice. Appropriateness is the applicable standard for complex OTC products. For products that are not complex (e.g., vanilla JSE bond execution), appropriateness is a lighter-touch confirmation that the client has the requisite knowledge and experience.

**Appropriateness assessment for complex OTC products.** Before executing the first transaction of a new complex OTC product type with a client (e.g., a bespoke interest-rate swap structure outside the plain-vanilla IRS category), Zara's team conducts an appropriateness assessment. The assessment considers:
- The client's experience with the product type (self-declaration + trading history).
- The client's understanding of the risks (rate risk, credit risk, liquidity risk, mark-to-market volatility).
- The client's operational capacity to manage the product (ISDA master agreement, CSA, collateral management capability).

A `AppropriatenessAssessmentCompleted { clientId, productType, outcome: "appropriate" | "inappropriate" | "warning", date }` event is the canonical record. If the assessment returns "inappropriate," no transaction of that product type may be executed with that client. If "warning," the client must acknowledge in writing the unsuitability risk before the transaction; the written acknowledgement is filed as a `ClientWarningAcknowledged { clientId, productType, date }` event.

**FAIS s16 Know-Your-Client (KYC).** The Bank complies with FAIS s16 KYC requirements. For institutional clients, the KYC scope includes: financial situation (balance sheet capacity, leverage); investment objectives (hedging, asset/liability management, proprietary risk); risk appetite (rate risk tolerance, credit risk limits); product knowledge and experience. KYC is conducted at onboarding and reviewed annually. A `KycRecordUpdated { clientId, date, keyChanges[] }` event marks each KYC refresh cycle.

### 3.4 Pricing Transparency

**Pre-trade price disclosure.** Before executing any OTC transaction, the Bank provides the client with a price indication (bid or offer, or mid plus bid-offer spread) in a form that allows the client to make an informed decision to trade. For voice-executed transactions, the price indication is captured in the call recording (which is a `CallRecordingMade { transactionRef, clientId, date }` event reference). For electronically-executed transactions, the price indication is logged in the electronic trading system.

**Bid-offer spreads.** The Bank's bid-offer spreads on OTC products reflect: market liquidity conditions, credit risk of the client (where applicable), and the Bank's own risk management cost. Spreads are not artificially widened to extract value at the expense of the client. Zara monitors spread patterns via trade surveillance; systematic spread widening relative to market benchmarks without documented rationale is a conduct finding.

**No hidden fees.** The Bank does not charge fees, commissions, or embedded charges beyond the bid-offer spread, unless the client has agreed in writing to a separate fee arrangement (e.g., a structuring fee for a complex bespoke transaction, disclosed in the term sheet). All fee arrangements are documented in the client master agreement or a signed fee letter; a `ClientFeeArrangementConfirmed { clientId, productType, feeStructure, date }` event is the canonical record.

**Mark-to-market transparency.** For OTC derivatives under an ISDA CSA, the Bank provides mid-market valuations on request (or on the agreed reporting frequency). Valuations are produced by the risk system (independent of the trading desk) and disclosed without adjustment for own-credit risk unless specifically agreed with the client.

### 3.5 Fair Dealing Standards

**No front-running.** The Bank does not execute proprietary trades — whether for its own account or for a related party — based on knowledge of a pending client order. The no-prop trading rule (`Policies/market-risk-policy-v1.md` — MR-5; `Policies/trading-mandate-v1.md`) is the structural control. The trade surveillance system monitors for temporal patterns between client order receipt and warehoused position changes; any detected pattern is investigated by Zara. A confirmed front-running incident is a Critical conduct event requiring immediate CEO and BRC notification, regulatory self-reporting to FSCA, and (as applicable) notification to the FSCA and the Financial Markets Act enforcement authority.

**No misrepresentation.** No client, counterparty, or market participant is provided with materially false or misleading information about: the nature, risks, or terms of a product; the Bank's capacity (principal vs. agent); the Bank's credit quality; pricing or valuations; or any other material fact. This prohibition applies to all communication channels (voice, written, electronic). A `ConductIncident { type: "misrepresentation", clientId, description, disposition }` event is the canonical record of any alleged misrepresentation; Zara manages the investigation.

**Best execution effort.** For client orders executed on a non-principal (agent) basis — e.g., JSE equity and bond execution where the Bank is acting as agent — the Bank uses reasonable efforts to obtain the best available execution given the client's instructions (size, timing, anonymity preference) and the prevailing market conditions. Best execution is not guaranteed; it is a reasonable-efforts standard appropriate for an institutional market. The trade surveillance system monitors execution quality (executed price vs. mid-market at time of execution); systematic adverse execution is a conduct finding. Zara tables best-execution MI to the Conduct Oversight Forum quarterly.

**Market abuse prevention.** The Bank operates a market abuse prevention programme as a stand-alone control, referenced here as it is a material component of conduct risk. Zara co-owns the market abuse programme with Helena (for the risk framework dimension). The programme includes: pre-trade surveillance (position monitoring against material non-public information lists), post-trade surveillance (execution pattern analysis), Chinese wall procedures between the trading desk and any advisory capacity, and FMA reporting obligations for suspicious transaction and order reports (STORs).

### 3.6 Product Governance

The NPA gate (New Product Approval, per `Policies/trading-mandate-v1.md`) includes a mandatory conduct review. Zara reviews the conduct section of every NPA submission before product launch. The conduct section must address:

- Target client category (must be institutional / professional).
- TCF Outcome 2 assessment — product fit with institutional client needs.
- Appropriateness assessment process for the product type (complex vs. non-complex determination).
- Pricing transparency mechanism (how price is disclosed pre-trade for this product).
- Post-sale service obligations (valuation frequency, confirmation standards, dispute resolution).
- Known conduct risks and proposed mitigants.

Zara signs off the conduct section; her sign-off is a precondition for NPA approval. A `ConductNpaSignOff { productType, date, conditions[] }` event is the canonical record.

### 3.7 Conflicts of Interest

This policy is read alongside the Conflicts of Interest Policy (COI-POL-01 — planned). The COI-POL-01 governs the identification, management, and disclosure of conflicts. Key intersections with this policy:

- Front-running is both a conduct issue (this policy) and a conflict-of-interest issue (COI-POL-01).
- Proprietary trading restrictions (no-prop rule) prevent the principal category of conflicts between Bank proprietary interests and client interests.
- Zara reviews potential conflicts before approving any new product or client arrangement that could create a structural conflict (e.g., Bank acting as market-maker and execution agent for the same client in the same instrument).

Until COI-POL-01 is authored, this section serves as the conflict-of-interest placeholder for conduct purposes.

### 3.8 Training

The following training is mandatory:

| Training | Frequency | Audience | Record |
|---|---|---|---|
| Annual conduct and TCF training | Annual | All client-facing personnel | `TrainingCompletionRecorded { course: "conduct-tcf-annual", employeeId, date }` via Sade (AgentOps) |
| FAIS General Code familiarisation | At onboarding; annual refresh | All FAIS representatives | Same record type |
| Market abuse awareness | Annual | Trading desk heads, relationship management | Same record type |
| New product conduct training | Before first trade in new product | Relevant desk heads | `ConductNpaTrainingCompleted { productType, date }` |

Sade (AgentOps, engineering) administers training records and produces completion MI for Zara's quarterly ExCo report. Incomplete training within 30 days of the due date is a conduct finding; Zara escalates to the relevant desk head and to Helena (as CRO, governance) for risk-consequence assessment.

---

## 4. Controls & Monitoring

### 4.1 Trade Surveillance

Zara reviews trade surveillance outputs on a weekly basis (automated alerts are generated daily; Zara reviews the alert queue and dispositions). The surveillance system monitors for:

- Front-running patterns (temporal correlation between client order receipt and Bank position changes).
- Best execution outliers (executed price systematically adverse to mid-market benchmark).
- Spread anomalies (bid-offer spread widening relative to market benchmark without documented rationale).
- Market abuse indicators (wash trades, layering, spoofing, suspicious timing relative to corporate events or regulatory announcements).

Each surveillance alert is dispositioned as: (i) false positive (documented rationale); (ii) conduct finding (investigation initiated; `ConductIncident` event filed); or (iii) regulatory referral (STOR filed with FSCA/FMA under the FMA). A `SurveillanceAlertDispositioned { alertId, disposition, date, dispositionedBy }` event is the canonical record.

### 4.2 Client Complaint Handling

The Bank maintains a client complaint register. All formal complaints from clients relating to conduct (unfair dealing, pricing dispute, misrepresentation, post-sale service failure) are logged by Zara's team within one business day of receipt. A `ClientComplaintReceived { clientId, complaintType, description, date }` event initiates the complaint process.

Complaints are investigated and responded to within 20 business days; complex complaints within 45 business days. All complaints and dispositions are reported to the Conduct Oversight Forum. Material complaints (potential regulatory significance, financial redress > R100,000, pattern suggesting systemic conduct failure) are escalated to the CEO and the BRC.

### 4.3 Annual TCF Self-Assessment

Zara conducts an annual self-assessment of the Bank's TCF implementation, mapped to the six TCF outcomes (§3.2 above). The self-assessment is reviewed by the Conduct Oversight Forum and tabled to ExCo. Key findings are addressed in a remediation plan with timelines; Vera reviews the prior year's remediation plan status as part of her annual conduct assurance review.

### 4.4 Regulatory Monitoring

Zara monitors FSCA conduct regulatory publications (notices, directives, guidance documents, enforcement actions) as they are issued. Material regulatory developments affecting this policy are tabled to the Conduct Oversight Forum within 30 days of publication; policy updates (if required) are proposed by Zara and approved by the CEO within 90 days. An urgent regulatory change (enforcement action with immediate effect) is addressed within the timeframe specified by the FSCA.

---

## 5. Reporting

| Report | Frequency | Author | Recipients | Canonical Event |
|---|---|---|---|---|
| Conduct MI report (surveillance, incidents, complaints) | Quarterly | Zara | ExCo, BRC | `ConductMiReportFiled { period, alertCount, incidentCount, complaintCount, findings[] }` |
| TCF self-assessment | Annual | Zara | ExCo, BRC, FSCA (on request) | `TcfSelfAssessmentCompleted { period, outcomeAssessments[], gaps[] }` |
| FSCA conduct inspection pack | As required | Zara + Imani | FSCA | `RegulatorCorrespondenceDispatched { regulator: "FSCA", type: "inspection-pack" }` |
| Training completion report | Quarterly | Sade (AgentOps) | Zara, ExCo | (AgentOps training registry) |
| Client complaint summary | Quarterly | Zara | Conduct Oversight Forum, ExCo | (integrated into Conduct MI report) |
| NPA conduct sign-off log | Per NPA cycle | Zara | NPA Forum | `ConductNpaSignOff { productType, date }` events |

---

## 6. Exceptions & Escalation

### 6.1 Exception Process

Any deviation from this policy (e.g., executing a transaction without a completed appropriateness assessment for a complex product, pricing an OTC transaction without pre-trade disclosure, a training obligation not completed within the required period) is documented as a `ConductPolicyException { exception, reason, remediationPlan, approver }` event. Zara approves exceptions; material exceptions (affecting a client's ability to make an informed decision, or involving a potential regulatory obligation breach) require CEO approval. Vera is notified of all exceptions.

### 6.2 Escalation Ladder

| Condition | Escalation | Timeframe |
|---|---|---|
| Confirmed front-running incident | Zara → CEO → BRC → FSCA + FMA | Immediate; STOR within regulatory timeframe |
| Confirmed misrepresentation — material | Zara → CEO → BRC; client remediation plan | Immediate CEO/BRC; client contact within 2 days |
| Systematic best-execution failure pattern | Zara → CEO; remediation plan | 5 days from finding |
| Client complaint — material (§4.2) | Zara → CEO → BRC | Within 1 day of complaint receipt |
| FSCA inspection initiated | Zara → CEO; inspection coordination | Per FSCA timeframe |
| FSCA enforcement action | Zara → CEO → BRC; legal counsel | Immediate |
| Training completion < 80% at quarter-end | Zara → relevant desk head → Helena | 10 days post quarter-end |
| TCF self-assessment gap — material | Zara → CEO → BRC; remediation plan | 30 days from assessment completion |

---

## 7. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-CD-01` | Fair treatment framework — FSCA TCF, FSR Act s57 | **DRAFT** (COMMENCEMENT-BIND) — closed | §3.2 (TCF six outcomes mapping), §3.5 (fair dealing standards), §4.3 (annual TCF self-assessment) |
| `ORG-CD-04` | Client suitability — FAIS s16 KYC; appropriateness for complex OTC | **DRAFT** (COMMENCEMENT-BIND) — closed | §3.3 (suitability and appropriateness) |
| `ORG-CD-06` | Pricing transparency — pre-trade price disclosure; no hidden fees | **DRAFT** (COMMENCEMENT-BIND) — closed | §3.4 (pricing transparency) |
| `ORG-CD-08` | Conduct monitoring and quarterly conduct MI to ExCo | **DRAFT** (COMMENCEMENT-BIND) — closed | §4.1 (trade surveillance), §5 (reporting) |

---

## 8. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are named explicitly — not hidden.

### 8.1 Substrate under construction

- **Trade surveillance system (engineering substrate, under Zara's oversight).** Automated pattern detection: front-running, spread anomaly, best-execution outlier, market-abuse indicators. Discharge exit signal: `SurveillanceAlertDispositioned` events generated against a synthetic fixture; `recon:conduct-surveillance-coverage` green.
- **Client classification register (part of Party register substrate, per D-PARTY-REGISTER).** Institutional client classification evidence per §3.1. Discharge exit signal: `ClientClassificationConfirmed` events for all onboarded clients; classification register projection derivable from event log.
- **Conduct MI dashboard.** Zara's real-time view of alert queue, incident register, complaint register, training completion. Discharge exit signal: projection derived from event log, rendering the four conduct MI dimensions without manual spreadsheet.
- **AgentOps training registry (Sade, engineering).** Records and tracks conduct training completion. Discharge exit signal: `TrainingCompletionRecorded` events; `recon:training-completion` green.

### 8.2 Procedures planned but not yet authored

- `Procedures/by-policy/client-onboarding-conduct.md` — classification evidence, KYC conduct scope, appropriateness baseline for each product category.
- `Procedures/by-policy/suitability-assessment.md` — appropriateness assessment process for complex OTC products; warning acknowledgement workflow.
- `Procedures/by-policy/conduct-monitoring.md` — weekly surveillance review cadence, alert disposition workflow, complaint handling steps.
- `Procedures/by-policy/npa-conduct-review.md` — conduct section requirements for NPA submissions; Zara sign-off gate.

### 8.3 Policy dependencies (planned)

- `COI-POL-01` (Conflicts of Interest Policy) — conflict identification and management; referenced in §3.7.
- `Policies/trading-mandate-v1.md` — no-prop rule (MR-5) provides the structural conduct control referenced in §3.5.
- `RISK-MRP-01` (Model Risk Policy) — valuation model integrity underpins pricing transparency (§3.4).

### 8.4 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate:

1. FAIS General Code — precise sub-rule references for r.3A (fair treatment) and r.8 (suitability / appropriateness).
2. FSR Act s57 — precise sub-section references for conduct obligations on financial institutions.
3. Conduct Standard for Banks CS1/2020 — precise §3 and §4 sub-provision references for conduct standards.
4. FSCA TCF Framework — current version reference; confirmation that 2018 update is the operative version.
5. Financial Markets Act 19/2012 — STOR reporting obligation timing and format; market abuse definition references.
6. FAIS General Code r.8 — professional client / sophisticated investor financial threshold for institutional classification.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-13 | Zara (Chief Compliance Officer, governance) | Initial policy. Nine sections: Purpose; Principles (six, including no front-running, no misrepresentation, best execution, events-first); (1) Scope — institutional clients only, OTC + JSE; (2) Governance — Conduct Oversight Forum, FSCA liaison, Zara as owner, Sade training records; (3) Standards — client categorisation (professional only), TCF six outcomes mapped to institutional context, suitability/appropriateness (complex OTC appropriateness assessment + FAIS s16 KYC), pricing transparency (pre-trade disclosure, bid-offer spreads, no hidden fees, MtM transparency), fair dealing (no front-running, no misrepresentation, best execution, market abuse), product governance (NPA gate conduct sign-off), conflicts of interest link (COI-POL-01 placeholder), training table; (4) Controls — trade surveillance (weekly review, alert disposition), complaint handling, annual TCF self-assessment, regulatory monitoring; (5) Reporting — six report types with canonical events; (6) Exceptions and escalation; (7) Obligations closure: ORG-CD-01/04/06/08; (8) Substrate and citation gaps. COMMENCEMENT-BIND. |
