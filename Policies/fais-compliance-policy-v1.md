---
policy-id: fais-compliance-policy
title: FAIS Compliance Policy v1
version: "1"
status: IN FORCE
owner: Zara (Chief Compliance Officer, governance)
effective-from: "2026-05-13"
next-review: "2027-05-13"
citations:
  - Financial Advisory and Intermediary Services Act 37 of 2002
  - FAIS General Code of Conduct for Authorised FSPs and Representatives (Board Notice 80 of 2003, as amended)
  - Determination of Fit and Proper Requirements for Financial Services Providers 2017 (Board Notice 194 of 2017)
  - Financial Sector Regulation Act 9 of 2017
  - D-REGULATORY-READINESS-GATE-PLAN
author: Zara (Chief Compliance Officer, governance) + Mira (Regulatory intelligence engineer, compliance)
date: 2026-05-13
summary: Standalone FAIS Compliance Policy covering FSP authorisation and category scope, Key Individual fit-and-proper requirements, suitability obligations for institutional counterparties, advice record-keeping, fee and commission disclosure, complaints handling pipeline, and General Code of Conduct obligations. Closes obligations ORG-FAIS-KI, ORG-FAIS-RK-ADVICE, ORG-FAIS-RK-SUITABILITY, ORG-FAIS-RK-FEE-DISCLOSURE, ORG-FAIS-RK-COMPLAINT-HANDLING, ORG-FAIS-RK-GENERAL-CODE. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-FC
  - RT-CC
obligations:
  - ORG-CD-02
---

# FAIS Compliance Policy v1

> **Authors.** Zara (Chief Compliance Officer, governance) — lead; Mira (Regulatory intelligence engineer, compliance) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-FAIS-KI` (Key Individual designation and fit-and-proper maintenance), `ORG-FAIS-RK-ADVICE` (advice interaction record-keeping, 5-year retention), `ORG-FAIS-RK-SUITABILITY` (suitability assessment and record per interaction), `ORG-FAIS-RK-FEE-DISCLOSURE` (pre-engagement written fee/commission disclosure), `ORG-FAIS-RK-COMPLAINT-HANDLING` (complaints pipeline: capture, acknowledge, investigate, resolve, report; 5-year retention), `ORG-FAIS-RK-GENERAL-CODE` (General Code of Conduct — full compliance obligation).
> **Status.** LICENCE-BIND. The FSCA FSP authorisation is a pre-commencement gate; all FAIS obligations and GCC obligations activate on authorisation. Build-phase operationalisation is preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The compliance programme substrate (advice-record event type, complaints register, KI file management, suitability-assessment workflow) is under construction per the regulatory-readiness gate plan.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. FSP Authorisation and Regulatory Standing

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual review; triggered on product-set change, category-scope change, or KI change · **Citation:** Financial Advisory and Intermediary Services Act 37 of 2002, s.7, s.8 (FSP authorisation requirement + application conditions); Financial Sector Regulation Act 9 of 2017 (FSCA as licensing authority for FSPs); `ORG-FAIS-RK-GENERAL-CODE` (General Code of Conduct, IN FORCE)

### Purpose

This section governs the Bank's standing as an authorised Financial Services Provider (FSP) under the Financial Advisory and Intermediary Services Act 37 of 2002 (FAIS). It sets out the category scope of the authorisation, the conditions that maintain the authorisation in good standing, and the governance structure through which the Bank monitors and manages its FAIS obligations as an entity and through its Key Individual (KI).

Hoz Bank Limited is (or will be at the FSCA licence gate) an authorised FSP under FAIS s.8. The FSP authorisation entitles the Bank to provide financial advisory and intermediary services in respect of the financial products within the authorised category scope. The authorisation is granted by the FSCA and must be maintained in good standing as a condition of operating.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). The regulatory obligation (FAIS s.7–s.8) sits above; procedures under this policy operationalise how the Bank maintains its FSP licence, manages KI obligations, and executes the FAIS compliance programme; system capabilities (compliance workflow engine, KI file management, advice record store, complaints register) execute those procedures. The policy does not reproduce FAIS text; it anchors management choices above the statutory floor.

### FSP Category Scope

The Bank's FSP authorisation covers:

- **Category I** — advice on, and intermediary services in respect of, financial products falling within the classes for which the Bank is licensed. Category I authorisation permits the Bank to provide financial product advice and render intermediary services (buying/selling, arranging, facilitating) in respect of those products to institutional clients.
- **Category II** — discretionary FSP authorisation, permitting the Bank to exercise discretion in making financial product decisions for institutional clients without requiring client-specific instruction for each transaction. Category II is relevant to the Bank's discretionary trading and investment management activities on behalf of institutional counterparties.

The precise product classes and sub-categories included within the Category I and Category II scope are ratified by external counsel at the licence-application gate and recorded in the FSCA authorisation schedule. Any material change to the product set (including the addition of new product categories under the New Product Approval process per `ORG-PR-25`) must be assessed against the current FSP category scope; if the new product falls outside the existing authorisation, an FSP category amendment application must precede commencement of service.

### Maintaining Authorisation in Good Standing

The FSP authorisation is subject to ongoing conditions under FAIS s.8 and the FAIS General Code of Conduct. The Bank maintains its authorisation in good standing by:

- Retaining at least one designated KI who is fit-and-proper per the Determination of Fit and Proper Requirements 2017 (the "Fit and Proper Determination") at all times.
- Maintaining the professional indemnity insurance and fidelity guarantee arrangements required by the FSCA for authorised FSPs.
- Filing the annual FAIS compliance report with the FSCA on the prescribed date.
- Notifying the FSCA of any material change in circumstances that may affect the authorisation conditions (including KI change, product scope change, or ownership change) within the prescribed notification period.
- Complying with all FAIS GCC obligations continuously from the date of authorisation.

### Principles

- **Authorisation is a pre-commencement gate, not a formality.** FSP authorisation must be obtained from the FSCA before the Bank renders any financial service to any client. No financial advisory or intermediary service activity commences until the FSCA issues the FSP licence. The FSCA has power to suspend or withdraw authorisation; a suspension is a Critical event requiring immediate escalation to the CEO and Board.
- **Category scope governs service scope.** The Bank's authorised category scope defines the boundaries of permissible financial services. Rendering a financial service outside the authorised scope is an unlicensed activity under FAIS s.7 and a statutory offence. Zara (Chief Compliance Officer, governance) maintains a service-type-to-category-scope mapping that is reviewed against the FSP licence at each New Product Approval gate.
- **Product scope changes require pre-emptive authorisation review.** Before any new product type is offered or any new financial service is rendered, Zara assesses whether the activity falls within the existing FSP category scope. If not, an FSCA category amendment is applied for. This review is a mandatory gate in the New Product Approval workflow.
- **Annual compliance plan.** Zara authors an annual FAIS compliance plan that maps the Bank's compliance activities for the year against the GCC obligations list, the KI obligations, and any FSCA regulatory focus areas announced for the period. The compliance plan is tabled to the Audit Committee (CEO interim pending constitution) at the beginning of each compliance year.
- **FSCA relationship.** The Bank maintains an open, cooperative, and proactive relationship with the FSCA. Material regulatory queries, on-site inspection preparation, and formal FSCA correspondence are managed by Zara, with legal support from Imani (Legal-as-code engineer, engineering) and, at licence-application stage, external counsel.

### Roles

Zara (Chief Compliance Officer, governance) is the primary FAIS Compliance Officer responsible for: maintaining the FSP authorisation; owning the KI file; submitting the annual compliance report; managing FSCA correspondence; chairing the compliance monitoring cycle under the GCC obligations list. Mira (Regulatory intelligence engineer, compliance — reports to Zara) tracks FAIS legislative and regulatory developments; monitors FSCA Board Notices, Notices to FSPs, and FAIS Ombud determinations for material changes to the compliance landscape; updates the obligations register accordingly. Imani provides legal-as-code support on the FAIS regulatory chain. External counsel ratifies the category scope, KI fit-and-proper documentation, and annual compliance report at the licence-application gate.

### Breach

Loss of FSP authorisation (suspension or withdrawal by the FSCA) is a Critical event: immediate cessation of all financial advisory and intermediary services; immediate notification to the CEO and Board; engagement of external counsel; PA notification as required under the Banks Act and FAIS interaction `[citation: TBC — Imani + external counsel ratify at licence-application gate]`. A Critical event is also triggered by: a material adverse finding in an FSCA inspection; failure to file the annual compliance report by the prescribed deadline; loss of KI (all KIs simultaneously lose fit-and-proper status or depart without replacement). An Alert is triggered by: KI regulatory status change; FSCA inquiry or information request; any GCC monitoring finding of a systematic pattern of non-compliance.

---

## 2. Key Individual (KI) Obligations

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for KI designation and material KI changes · **Cadence:** Continuous; annual fit-and-proper review; triggered on KI change · **Citation:** FAIS Act 37 of 2002, s.8(1)(c) (KI requirement as an authorisation condition); Determination of Fit and Proper Requirements 2017 (Board Notice 194 of 2017) — qualifications, experience, honesty and integrity, operational ability requirements; `ORG-FAIS-KI` (Key Individual designation obligation, LICENCE-BIND)

### Purpose

The Key Individual (KI) is the natural person who is responsible for managing or overseeing the financial services activities of the Bank as an FSP. FAIS s.8(1)(c) requires that every FSP have at least one natural person who complies with the fit-and-proper requirements of the Fit and Proper Determination as a condition of authorisation. The KI is registered with the FSCA; the KI's fit-and-proper status is a continuing obligation — not a once-off assessment at authorisation.

### KI Designation

The Bank designates at least one natural person as KI. For an institutional-only FSP with a focused product set (Category I and Category II per §1.2 of this policy), a single KI is sufficient provided the KI meets all fit-and-proper requirements for the authorised category and sub-category scope. The KI designation must be:

- Approved by the Board (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`);
- Notified to and approved by the FSCA as part of the FSP authorisation application;
- Recorded in the KI file maintained by Zara;
- Confirmed as fit-and-proper on an annual basis.

At commencement of trading, the Bank's KI is the natural person filling the minimum statutory human-in-the-loop seat for FAIS compliance purposes, consistent with the thin-human-layer operating model per `project_ai_driven_bank.md`. The KI is one of the 5–10 statutory human appointments at licence-day.

### Fit-and-Proper Requirements

The KI must meet all four pillars of the Fit and Proper Determination on a continuing basis:

**Qualifications.** The KI must hold the minimum qualifications prescribed by the FSCA for the product categories and sub-categories within the Bank's authorisation scope. The FSCA publishes a qualifications list that maps product sub-categories to acceptable qualifications. The KI file records the KI's qualifications, with certified copies. A change in the Bank's category scope that requires higher qualifications triggers a KI qualification review and, if necessary, KI replacement or supplementary appointment.

**Experience.** The KI must demonstrate appropriate practical experience in rendering the type of financial services the Bank provides, in the categories and sub-categories of the authorisation. The Fit and Proper Determination specifies minimum experience years by product category. The KI file records the KI's experience history with supporting verification. Experience is assessed at authorisation and rechecked on each annual review.

**Honesty and integrity.** The KI must be honest and have integrity. Honesty and integrity are assessed against a disqualification list: the KI may not have been: convicted of certain offences; found guilty by a court or tribunal of fraudulent conduct or other specified conduct; the subject of a debarment under FAIS or a prohibition under another financial-sector law; or otherwise disqualified under the Fit and Proper Determination. The honesty-and-integrity assessment is renewed annually and triggered immediately on any adverse development known to the Bank (e.g., criminal charge, regulatory finding in another jurisdiction).

**Operational ability.** The KI must be operationally able to manage and oversee the financial services activities of the FSP. Operational ability includes: demonstrated understanding of the compliance obligations; availability and time dedication to fulfil the KI function; authority within the Bank's governance structure to direct compliance actions. Operational ability is assessed at designation and reviewed annually.

### KI File Maintenance

Zara maintains a KI file that records and evidences continuing fit-and-proper compliance. The KI file includes:

- Certified copies of qualifications and any Regulatory Examinations (RE1, RE5 as applicable per FSCA requirements for the authorised categories);
- Employment history and experience log;
- Honesty and integrity declaration and background-screening evidence, renewed annually;
- Evidence of operational ability assessment;
- FSCA KI registration confirmation;
- Continuing Professional Development (CPD) record (where required by FSCA);
- Log of any regulatory queries, disciplinary proceedings, or adverse developments;
- Board approval resolution for KI designation and any material KI change.

The KI file is a controlled record maintained in the Bank's document management system. Access is restricted to the CCO and, for audit purposes, Vera (internal audit engineer, reports functionally to Thandiwe (Chief Audit Executive, governance)) and the FSCA on inspection.

### KI Change Protocol

Any change in the KI — departure, incapacity, disqualification, or replacement — is a material event:

- Zara notifies the FSCA within the prescribed notification period `[citation: TBC — exact FSCA notification timeline on KI change; Imani + external counsel ratify at licence-application gate]`.
- If the departing KI is the sole KI, the Bank must appoint a replacement and obtain FSCA approval before the existing KI's functions cease or within the grace period permitted by the FSCA.
- During any period without a fully registered KI, the Bank restricts its financial services activities to the minimum necessary and implements compensating controls approved by the Board.
- The KI change event is recorded as a typed event in the event log: `KiChangeNotified { eventType, fspcaNotificationDate, replacementKiId }`.

### Principles

- **Single KI is sufficient for the institutional product set.** Given the Bank's narrow, institutional-only scope and focused category authorisation, a single KI is operationally appropriate. This assessment is ratified by external counsel at the licence-application gate and revisited if the product or category scope expands materially.
- **Annual fit-and-proper re-certification.** The KI's fit-and-proper status is re-certified annually as a formal governance event: `KiFitAndProperCertified { kiId, effectiveDate, assessmentComponents[] }`. The certification is reviewed by the Board (CEO interim) and filed in the KI file.
- **Immediate disclosure of adverse KI developments.** The Bank has a zero-tolerance policy for delayed disclosure of adverse KI developments to the FSCA. Any matter that potentially affects the KI's honesty-and-integrity standing — including a criminal charge, regulatory investigation in another jurisdiction, or civil judgment — is reported to Zara immediately and assessed within 24 hours for FSCA notification obligation.
- **KI is not a nominal appointment.** The KI must genuinely manage and oversee the financial services activities. A nominal appointment of a KI who does not functionally manage compliance activities is itself a GCC violation. The KI's functional role and authority are documented in the Bank's governance structure.
- **KI file is audited by Vera annually.** Vera includes the KI file in the annual FAIS compliance audit scope. Vera's finding that the KI file is incomplete or that fit-and-proper evidence is stale is an audit finding escalated to the CCO and the Audit Committee.

### Breach

Simultaneous loss of all fit-and-proper KIs without a replacement being immediately available is a Critical compliance event: immediate cessation or restriction of financial services; immediate Board and FSCA notification; external counsel engaged. A KI honesty-and-integrity adverse finding (criminal conviction, debarment, disqualification under another financial-sector law) is also Critical. A CPD shortfall or administrative KI file gap (missing annual certification, incomplete qualifications record) is a Hard Breach: remediated within 30 days; escalated to the Audit Committee if not remediated within 30 days.

---

## 3. Suitability Assessment

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for suitability framework design · **Cadence:** Per client; annual counterparty-categorisation review; triggered on material client change · **Citation:** FAIS Act 37 of 2002, s.16; FAIS General Code of Conduct, s.8 (suitability; acting in client's interest; advice standard); `ORG-FAIS-RK-SUITABILITY` (suitability assessment obligation, LICENCE-BIND)

### Purpose

The FAIS GCC imposes an obligation on FSPs to act in the client's interest and to conduct a suitability assessment before rendering advice or intermediary services — understanding the client's financial situation, objectives, risk tolerance, and capacity to bear loss before recommending or executing a financial product transaction. For an institutional-only bank dealing exclusively with sophisticated professional and wholesale market counterparties, the suitability obligation is modified by the nature of the client — it is not eliminated. Counterparty categorisation (establishing the client type and the consequent regulatory treatment) is the first step in the suitability framework.

### Counterparty Categorisation

The Bank's client base is institutional: banks, asset managers, insurance companies, corporates, and other professional market participants. FAIS and the GCC distinguish between different client types, with the highest-sophistication clients (Professional Clients and Eligible Counterparties as defined under FAIS and FSCA guidance) attracting a modified suitability regime.

Before rendering any financial service to a new counterparty, the Bank establishes and records the counterparty's category:

- **Professional Client.** An entity meeting the FSCA's professional-client definition (capital/assets threshold, professional experience, or election by the client to be treated as professional). Professional Clients receive a modified suitability assessment: the Bank need not conduct a full retail-style needs analysis but must document the counterparty's financial situation, objectives, risk tolerance, and capacity to bear the relevant product risk.
- **Eligible Counterparty.** The highest-sophistication category (banks, licensed broker-dealers, regulated entities). The GCC suitability obligation is further modified for Eligible Counterparties, but counterparty categorisation must still be documented. The Bank must verify that the counterparty qualifies as an Eligible Counterparty at the outset.
- **Retail client.** The Bank does not serve retail clients. If a counterparty cannot be categorised as a Professional Client or Eligible Counterparty, the Bank does not extend the relevant financial service. A counterparty inadvertently categorised as retail triggers an immediate Zara review and, if confirmed retail, the relationship is restricted to the service types permitted for retail engagement (none, given the Bank's mandate).

Counterparty categorisation is recorded as a typed event: `CounterpartyCategoriséd { partyId, category, basis, effectiveDate }`. The categorisation is reviewed at least annually and on any material change in the counterparty's circumstances.

### Suitability Assessment — Content

For each counterparty categorised as a Professional Client or Eligible Counterparty, the Bank maintains on file a suitability record that captures:

- **Client profile.** Legal identity, domicile, regulatory status, financial standing, investment mandate, and risk governance framework (e.g., investment policy statement or risk-appetite statement).
- **Financial situation.** The counterparty's balance-sheet exposure, existing product holdings, and relevant financial metrics, to the extent disclosed by the counterparty and appropriate to the financial service.
- **Objectives.** The counterparty's stated investment or risk-management objectives in relation to the proposed financial service or product.
- **Risk tolerance.** The counterparty's declared risk tolerance and loss-bearing capacity in respect of the relevant product class.
- **Product-specific suitability.** For each product class or transaction type, a brief suitability assessment confirming why the product is appropriate given the counterparty profile, with reference to the counterparty's objectives, risk tolerance, and capacity to bear loss.

For OTC derivatives and market-making services, the suitability record is embedded in the ISDA Master Agreement documentation (Counterparty Representations and Acknowledgments sections) and the pre-trade suitability disclosure workflow. The suitability record is part of the event log (Principle 1) and is retrievable per the 5-year retention obligation at `ORG-FAIS-RK-ADVICE`.

### Principles

- **Suitability is not a retail construct.** The institutional-only posture does not eliminate suitability. The FAIS GCC applies to all FSP activities regardless of client type. The suitability framework is calibrated to the institutional context — it is efficient and proportionate — but it is not absent.
- **Counterparty categorisation precedes all services.** No financial service commences before the counterparty is categorised. The categorisation is a gateway in the client-onboarding workflow (owned by Niko (Client onboarding engineer, engineering) at licence-day). A service rendered to an uncategorised counterparty is a GCC violation.
- **Suitability is product-type-specific.** A general counterparty categorisation does not constitute suitability for all product types. A counterparty categorised as an Eligible Counterparty for rate swaps must separately confirm suitability for credit derivatives or equity-linked products if those are offered. The suitability record is product-class-scoped.
- **Suitability records are part of the event log.** Each suitability assessment produces a typed event (`SuitabilityAssessmentCompleted { partyId, productClass, basis, assessmentDate, outcome }`) in the event log. The assessment is the canonical record; any document is a render of the event.
- **Annual counterparty-categorisation review.** Counterparty categorisation is reviewed annually at minimum: the Bank confirms that the counterparty continues to meet the criteria for its current category. A material change (regulatory status change, financial difficulty, mandate change) triggers an off-cycle review. The review event: `CounterpartyCategoriséReviewed { partyId, outcome, changeIfAny }`.
- **Suitability does not substitute for trade appropriateness.** Product suitability is separate from trade appropriateness under any applicable market conduct rules (e.g., under FSCA rules for OTC derivatives or under the Financial Markets Act market-conduct framework). Both checks are required in parallel where applicable.

### Breach

A financial service rendered without a counterparty categorisation or without an adequate suitability record on file is a GCC violation reportable to the FSCA. Systematic suitability-record gaps (more than one counterparty without a current suitability record) constitute a pattern finding that Zara escalates to the Audit Committee and the FSCA in the annual compliance report. Vera's annual audit scope includes a sample of suitability records; unsatisfactory findings escalate to the CCO and the Audit Committee.

---

## 4. Advice Record-Keeping

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for record-keeping policy framework · **Cadence:** Continuous; triggered per advice interaction · **Citation:** FAIS Act 37 of 2002, s.16–s.17; FAIS General Code of Conduct, s.9 (recording of advice); Financial Intelligence Centre Act 38 of 2001 (FIC Act) — 5-year retention minimum; `ORG-FAIS-RK-ADVICE` (advice interaction record-keeping obligation, LICENCE-BIND)

### Purpose

Every recommendation or guidance given to a client in respect of a financial product — whether an explicit recommendation to buy, sell, or hold; an expression of view on suitability; or a structured market colour interaction that constitutes advice under FAIS — must be recorded, retained for 5 years, and produced to the FSCA on request. This obligation is both a GCC requirement and an FIC Act record-keeping obligation where the advice interaction is connected to a financial transaction.

The Bank's institutional trading and advisory business generates advice interactions across multiple channels: structured pre-trade communications, client market updates, trade recommendations, and portfolio guidance for Category II discretionary clients. All such interactions are captured in the event log; advice-interaction events are typed events per Principle 1.

### Advice Record Content

An advice record captures, at minimum:

- The date and time of the advice interaction;
- The identity of the client (by party register reference per the Party register at `Regulations/_party-register.md`);
- The financial product(s) or product class(es) to which the advice relates;
- The basis for the advice (factual circumstances of the client, market factors relied on, analytical basis);
- The client's stated circumstances as they were understood at the time of the advice (drawn from the suitability record per §3 of this policy);
- The advice or recommendation given;
- The outcome of the interaction (client action or no action, and the client's response).

For the Bank's institutional-market context, advice records are embedded in structured pre-trade communication flows, client-facing research and market-colour records, and trade confirmation documentation. The advice-record event type (`AdviceInteractionRecorded { partyId, productClass, adviceBasis, advice, outcome, timestamp }`) is a first-class event in the event log.

### Retention

Advice records are retained for a minimum of 5 years from the date of the advice interaction, in compliance with FAIS s.17 and the FIC Act minimum retention period. Records are stored in the Bank's BLAKE3 content-addressed document store per `D-RMS-PHASE-1`, retrievable by the FSCA on request. Retention management is governed by the Records Management Substrate (Phase 1) per the RMS framework. The 5-year retention clock is set at the `AdviceInteractionRecorded` event timestamp.

### Principles

- **Every advice interaction is a typed event.** There is no "off the record" advice in the institutional FSP context. Market colour, structured recommendations, and any communication that constitutes advice under FAIS is recorded at the time of interaction. This is both a FAIS obligation and a Principle 1 (events-are-truth) requirement.
- **Record contemporaneously.** Advice records are captured at or immediately after the interaction — not retrospectively. A record created more than 24 hours after an advice interaction is a compliance risk; Zara's monitoring includes a timestamp-lag check on advice-record submissions.
- **Advice basis must be documented.** A bare record of the advice given (without the basis) is insufficient. The factual basis — the client's circumstances, the market factors, the analytical rationale — must be captured to allow the FSCA or the FAIS Ombud to assess whether the advice was appropriate. An advice record without a basis field populated is a Hard Breach.
- **Category II discretionary-management records.** For Category II discretionary clients, the advice record framework extends to records of: discretionary decisions made on the client's behalf; the basis for each decision; and the outcome. These records satisfy both the FAIS GCC advice-record obligation and the ongoing suitability obligation for discretionary management clients.
- **5-year retention is a floor, not a ceiling.** The 5-year FAIS minimum is the floor. The Bank retains advice records for 7 years where they are also relevant to AML/CFT obligations under the FIC Act or to a pending regulatory matter. The retention schedule is owned by Zara and implemented in the RMS retention module.
- **FSCA production on request.** The Bank must be able to produce specific advice records to the FSCA within the production timeframe specified in any FSCA request. Zara maintains a production-readiness posture: the advice-record retrieval workflow (by party, by date range, by product class) is tested annually as part of the FSCA inspection readiness programme.

### Breach

Failure to record an advice interaction is a GCC violation. Systematic recording failures (a pattern of unrecorded advice interactions identified in the Vera annual audit sample) constitute a material GCC breach reported to the FSCA in the annual compliance report. Inability to produce advice records within the FSCA's requested production timeframe is an escalation to the CCO and external counsel.

---

## 5. Fee and Commission Disclosure

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for fee-disclosure framework design · **Cadence:** Per engagement, pre-engagement; annual review of disclosure templates · **Citation:** FAIS Act 37 of 2002, s.16; FAIS General Code of Conduct, s.7 (disclosure to clients — fees, remuneration, commissions); `ORG-FAIS-RK-FEE-DISCLOSURE` (pre-engagement written fee disclosure obligation, LICENCE-BIND)

### Purpose

Before the Bank renders any financial advisory or intermediary service to a client, it must disclose in writing all fees, commissions, charges, and any other form of consideration that the client will pay or that the Bank will receive in connection with the service. This obligation is both an information-transparency requirement and a conflict-of-interest management tool: clients are entitled to know the full cost of the service before committing to it, and the Bank must disclose any third-party remuneration that could create an inducement or conflict.

### Disclosure Scope

The fee and commission disclosure covers:

- **Advisory and structuring fees.** Any fee charged by the Bank for financial product advice, structuring of OTC derivative transactions, or other advisory services.
- **Intermediary commissions.** Any commission or facilitation fee charged for arranging or executing a financial product transaction on behalf of a client.
- **Spread and mark-up.** Where the Bank acts as principal in a transaction (market-making), the bid-offer spread or mark-up is the primary form of remuneration; this must be disclosed as part of the pre-trade communication to the extent required under FAIS and applicable FSCA guidance for the product class.
- **Third-party remuneration.** Any fee, commission, or benefit received by the Bank from a third party (e.g., a product originator, a structured product counterparty) in connection with the financial service rendered to the client. Third-party remuneration must be disclosed even if it is not borne directly by the client.
- **Ongoing fees.** Any fees charged on an ongoing basis (e.g., for Category II discretionary management), disclosed at the outset and updated on any change.

### Disclosure Mechanism

For the Bank's institutional-market context, fee and commission disclosure is embedded in:

- **ISDA and credit-support documentation.** The ISDA Master Agreement, Schedule, and related confirmations constitute the primary disclosure mechanism for OTC derivative transactions. The relevant fee, margin, and valuation terms are set out in the Schedule and Confirmations, which are delivered to the counterparty before the first transaction under the ISDA. The ISDA framework satisfies the pre-engagement written disclosure requirement for OTC derivative financial services.
- **Pre-trade communication flow.** For non-ISDA transactions (e.g., bond execution, advisory engagements), the pre-trade communication or engagement letter/term sheet discloses the applicable fees before execution.
- **Engagement letters.** For advisory mandates (Category I advice), the engagement letter — executed before any advice is rendered — includes the full fee schedule.

### Principles

- **Disclosure before engagement, not after.** The disclosure obligation is pre-engagement. A fee disclosure delivered after the advice is given or after the transaction is executed does not satisfy FAIS s.16 or GCC s.7. The Bank's workflow enforces pre-engagement disclosure as a system gate: no advice-interaction event is created until the fee-disclosure event is recorded for the relevant engagement.
- **Written disclosure is mandatory.** Verbal disclosure is insufficient. Written disclosure (including electronic communication that constitutes a written record) is required. The disclosure document or the relevant ISDA/engagement letter section constitutes the written disclosure; the `FeeDisclosureDelivered { partyId, engagementId, disclosureDocumentHash, deliveredAt }` typed event is the canonical record.
- **ISDA as disclosure vehicle for OTC derivatives.** The Bank treats the ISDA Master Agreement and Schedule as satisfying the FAIS pre-engagement fee disclosure requirement for the OTC derivative product scope. This approach is ratified by external counsel at the licence-application gate and documented in the FAIS compliance programme. Any deviation from the ISDA-as-disclosure-vehicle approach (e.g., for a product type not governed by ISDA) requires Zara approval and a bespoke disclosure mechanism.
- **Third-party remuneration triggers a conflict-of-interest review.** Any third-party remuneration arrangement is assessed by Zara under the conflict-of-interest management framework before the arrangement is entered into. The assessment determines whether the remuneration creates an inducement that conflicts with the client's best interests. If it does, the arrangement is restructured or the relevant service is not provided. The outcome is recorded.
- **Annual disclosure-template review.** Zara reviews all fee-disclosure templates and the ISDA schedule provisions used as disclosure vehicles annually, against the current FSCA guidance and any updates to GCC disclosure requirements. Material changes to disclosure templates require Board (CEO interim) approval.
- **No inducement contrary to client interest.** The Bank does not accept third-party remuneration that creates a conflict with the client's best interests. Zara applies a best-interest test to all remuneration structures; any structure that fails the test is prohibited regardless of its commercial value.

### Breach

A financial service rendered without prior written fee disclosure is a GCC violation. A pattern of disclosure failures is a material GCC breach escalated to the FSCA in the annual compliance report. Disclosure of incorrect fee information (materially understated fees) is also a GCC violation and may constitute a misrepresentation under FAIS s.16; Zara escalates to the CCO and external counsel immediately on discovery.

---

## 6. Complaints Handling

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for complaints framework design · **Cadence:** Continuous; annual complaints statistics review; triggered per complaint · **Citation:** FAIS Act 37 of 2002, s.16; FAIS General Code of Conduct, s.17 (complaints handling); Financial Services Ombud Schemes Act 37 of 2004 (FAIS Ombud); `ORG-FAIS-RK-COMPLAINT-HANDLING` (complaints pipeline obligation, LICENCE-BIND)

### Purpose

An authorised FSP must maintain a complaints management process that captures, acknowledges, investigates, resolves, and reports complaints from clients in relation to financial services rendered. Even where the Bank's clients are exclusively institutional, they are entitled to the FAIS complaints process and to the services of the FAIS Ombud where a complaint is not resolved at the FSP level. The Bank's complaints handling process is a governance and regulatory-standing obligation, not discretionary.

### Complaints Pipeline

The complaints pipeline operates across five stages, each recording a typed event:

**Stage 1 — Capture.** A complaint is any expression of dissatisfaction by a client (or a client's authorised representative) regarding a financial service rendered by the Bank. On receipt, the complaint is captured in the complaints register: `ComplaintReceived { complaintId, partyId, serviceType, complaintSummary, receivedAt }`. The complaints register is a projection of the complaint-event stream; it is not a standalone document.

**Stage 2 — Acknowledgment.** The Bank acknowledges receipt of every complaint in writing within 5 business days. The acknowledgment confirms that the complaint has been received, provides a reference number, names the complaints officer responsible for the complaint, and indicates the timeline for investigation and resolution. The acknowledgment event: `ComplaintAcknowledged { complaintId, acknowledgedAt, officerAssigned }`.

**Stage 3 — Investigation.** The complaint is investigated by the complaints officer, who is a member of the compliance function or a business-line officer designated by Zara and independent of the financial service that is the subject of the complaint. The investigation reviews: the advice record(s) for the relevant interaction; the fee-disclosure documentation; the suitability assessment; and any other relevant evidence. The investigation event: `ComplaintInvestigated { complaintId, investigationCompletedAt, findings }`.

**Stage 4 — Resolution.** The Bank resolves complaints within 6 weeks of receipt. If the complaint cannot be resolved within 6 weeks, the Bank notifies the complainant in writing and advises the complainant of the right to refer the complaint to the FAIS Ombud. The resolution may be: uphold (remediation provided); partial uphold; or dismiss (complaint unfounded). The resolution event: `ComplaintResolved { complaintId, resolvedAt, outcome, remediationIfAny }`.

**Stage 5 — Reporting.** Complaint statistics are reported in the annual FAIS compliance report submitted to the FSCA: total complaints received; complaints resolved within 6 weeks; complaints referred to FAIS Ombud; complaints upheld (with root-cause categorisation). Quarterly complaint statistics are reviewed by Zara and reported to the Audit Committee.

### Complaints Register

The complaints register is a live projection of the complaint event stream, showing all open complaints with their stage, assigned officer, and deadlines. Zara reviews the complaints register weekly. The 5-year retention obligation under `ORG-FAIS-RK-COMPLAINT-HANDLING` applies from the date of the `ComplaintResolved` event. Records are stored in the BLAKE3 document store per `D-RMS-PHASE-1`.

### Principles

- **Every complaint is a learning event.** Complaints are a source of compliance intelligence. Zara conducts a root-cause analysis on all upheld complaints and any systematically related complaint patterns. Root-cause findings inform the annual compliance plan and, where systemic, are disclosed in the annual compliance report.
- **No complaint is dismissed without investigation.** An FSP may not dismiss a complaint without substantive investigation. Every complaint receives a Stage 3 investigation, however brief, before resolution. A complaint dismissed without investigation is a GCC violation.
- **FAIS Ombud referral is a client right, not a failure.** The Bank facilitates FAIS Ombud referrals as a client right. Obstruction of or discouragement from FAIS Ombud referral is a GCC violation and a statutory offence under the Financial Services Ombud Schemes Act.
- **5-year retention from resolution.** Complaint records are retained for 5 years from the `ComplaintResolved` event, per FAIS and FIC Act retention obligations. Records must be retrievable by the FSCA and FAIS Ombud on request within the prescribed production timeframe.
- **6-week timeline is a hard compliance deadline.** If a complaint is not resolved within 6 weeks, the complainant must be notified in writing and advised of Ombud rights before the deadline expires. Failure to notify is a GCC violation in addition to the underlying unresolved complaint.
- **Complaints statistics in the annual report.** The annual FAIS compliance report includes complete complaints statistics in the FSCA-prescribed format. Mira monitors any FSCA guidance on complaints-statistics reporting format and updates the reporting template accordingly.
- **Institutional clients use the complaints process.** The Bank does not exclude institutional clients from the complaints process on the basis of their sophistication. All clients — regardless of categorisation — have access to the FAIS complaints process and the FAIS Ombud.

### Breach

Failure to acknowledge a complaint within 5 business days, failure to resolve or refer within 6 weeks, failure to produce complaint records to the FSCA or FAIS Ombud, or dismissal of a complaint without investigation are each GCC violations. A pattern of complaints-handling failures is a material breach reportable in the annual compliance report. Vera's annual audit scope includes a sample of complaint files; findings are escalated to the CCO and the Audit Committee.

---

## 7. General Code of Conduct (GCC) Compliance Programme

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Board (CEO interim) for annual compliance plan · **Cadence:** Continuous; annual plan and report; quarterly monitoring review · **Citation:** FAIS General Code of Conduct for Authorised FSPs and Representatives (Board Notice 80 of 2003, as amended) — full scope; `ORG-FAIS-RK-GENERAL-CODE` (GCC compliance obligation, LICENCE-BIND)

### Purpose

The FAIS General Code of Conduct (GCC) is the umbrella conduct obligation binding on every authorised FSP and every representative acting on its behalf. The GCC establishes the standards of honesty, fairness, skill, care, and diligence expected of an FSP in all its financial services activities. Sections §2 through §6 of this policy are named projections of specific GCC obligations; this section governs the GCC compliance programme that monitors, assures, and reports compliance with the GCC in its entirety.

The GCC covers, without limitation: the general standards of advice and service quality; specific disclosure obligations (§5 above); suitability standards (§3 above); advice and record-keeping standards (§4 above); conflict-of-interest management; fair treatment of clients; professional conduct and competence; complaints handling (§6 above); ongoing compliance monitoring; and the annual compliance report to the FSCA.

### Annual Compliance Plan

Zara authors an annual FAIS compliance plan at the start of each compliance year. The plan:

- Maps each GCC section to a compliance-monitoring activity (self-assessment, transaction testing, file review, or interview);
- Assigns monitoring activities to a schedule with completion deadlines;
- Identifies any GCC section where the Bank's current control environment is assessed as requiring enhancement and sets out the remediation programme;
- Incorporates any FSCA regulatory focus areas, thematic reviews, or guidance issued in the preceding 12 months;
- Is tabled to the Audit Committee (CEO interim) for approval at the start of the compliance year.

### Annual Compliance Report

Zara files an annual FAIS compliance report with the FSCA in the prescribed format and on the prescribed date. The report covers:

- A summary of the Bank's FAIS compliance programme for the year;
- KI fit-and-proper status;
- Category scope and product-type coverage;
- Compliance monitoring results (by GCC section);
- Complaints statistics (per §6.5 above);
- Material GCC breaches or regulatory actions during the year;
- Remediation programmes underway or completed.

The annual compliance report is a Board-approved document (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`). The `FaisAnnualComplianceReportFiled { reportYear, filedAt, fspcaReference }` typed event is the canonical submission record; the report document is stored in the BLAKE3 content-addressed document store per `D-RMS-PHASE-1`.

### Conflict-of-Interest Management

The GCC requires FSPs to manage conflicts of interest: between the FSP and its clients; between representatives and clients; and arising from third-party remuneration. The Bank's conflict-of-interest management framework:

- Requires identification and disclosure of material conflicts at the outset of any engagement;
- Prohibits acceptance of inducements contrary to the client's interests (per §5.6 above);
- Requires Zara to maintain a conflicts register — a projection of conflict-declaration events — reviewed quarterly;
- Requires representatives involved in a conflicted matter to withdraw from the relevant financial service decision where the conflict cannot be mitigated.

### Professional Conduct and Standards

The GCC requires FSPs and their representatives to act with the required level of skill, care, and diligence. The Bank ensures GCC professional-conduct compliance by:

- Maintaining a representative competency framework aligned to the GCC and Fit and Proper Determination requirements for each product category and sub-category;
- Requiring Continuing Professional Development (CPD) where mandated by the FSCA for the authorised categories;
- Monitoring representative conduct through the compliance-monitoring activities in the annual plan.

### Governance

Zara chairs the GCC compliance monitoring cycle. The cycle produces quarterly compliance-monitoring reports tabled to the Audit Committee. Vera provides third-line assurance through the annual FAIS compliance audit, which covers: KI file completeness; a sample of suitability records; a sample of advice records; a review of the complaints pipeline; disclosure-template review; conflict-of-interest register review. Vera's annual FAIS compliance audit report is presented to the Audit Committee and to Thandiwe (Chief Audit Executive, governance) for inclusion in the annual internal audit report.

Mira (Regulatory intelligence engineer, compliance) monitors the FAIS regulatory landscape: FSCA Board Notices, FSCA FAIS Division updates, FAIS Ombud determination trends, and any legislative amendments to FAIS or the GCC. Mira updates the obligations register and the compliance monitoring programme to reflect regulatory changes. A material regulatory change that affects the GCC obligations programme is escalated by Mira to Zara within 5 business days of publication.

### Principles

- **GCC is the conduct baseline, not a ceiling.** The GCC sets minimum conduct standards; the Bank aspires to serve institutional clients with a standard that exceeds the statutory floor. GCC compliance is an obligation; client-first conduct is a value.
- **Compliance monitoring is continuous, not annual.** The annual compliance plan structures the monitoring programme, but compliance monitoring is a continuous activity. Zara's compliance function reviews higher-risk activity types (advice interactions, complaint handling) on a monthly basis; lower-risk activity types are reviewed quarterly.
- **The annual compliance report is a public commitment.** The FSCA annual compliance report is filed on the record with the regulator. It must accurately represent the Bank's compliance status, including material breaches and remediation programmes. A compliance report that materially misrepresents the Bank's compliance status is a regulatory offence.
- **Independence of Vera's FAIS audit.** Vera's annual FAIS compliance audit is independent of Zara's compliance monitoring. Vera tests whether the monitoring programme itself is adequate, not merely whether the GCC obligations are met. Any finding that Zara's monitoring programme has systemic gaps is an audit finding escalated to the Audit Committee.
- **Regulatory change is proactive, not reactive.** The Bank monitors FAIS regulatory change through Mira's regulatory intelligence function and updates its compliance programme proactively — before the regulatory change takes effect — not reactively after a breach.

### Breach

A material GCC breach — systematic non-compliance with a GCC obligation, an FSCA enforcement action, or a FAIS Ombud adverse determination — is a Critical compliance event: CEO notification; Board (Audit Committee) notification; FSCA engagement through external counsel if required; compliance-programme remediation initiated. A single isolated GCC breach (individual transaction without disclosure; individual advice interaction not recorded) is a Hard Breach: immediate root-cause analysis; remediation within 30 days; reported in the next quarterly compliance-monitoring report.

---

## 8. Obligations Closure Table

The following obligations-register rows are closed by this policy. Status per the obligations-register convention.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-FAIS-KI` | Designate a fit-and-proper Key Individual under FAIS s.8 and Fit and Proper Determination 2017; maintain KI file; notify FSCA on KI change | **LICENCE-BIND** — closed | §2 (Key Individual Obligations — full section) |
| `ORG-FAIS-RK-ADVICE` | Record every advice interaction with basis, date/time/actor, and outcome; retain 5 years | **LICENCE-BIND** — closed | §4 (Advice Record-Keeping — full section) |
| `ORG-FAIS-RK-SUITABILITY` | Conduct and record a suitability assessment for each advice/intermediary-service interaction | **LICENCE-BIND** — closed | §3 (Suitability Assessment — full section) |
| `ORG-FAIS-RK-FEE-DISCLOSURE` | Disclose all fees, charges, commissions in writing before engagement | **LICENCE-BIND** — closed | §5 (Fee and Commission Disclosure — full section) |
| `ORG-FAIS-RK-COMPLAINT-HANDLING` | Maintain a complaint capture, acknowledge, investigate, resolve, and report pipeline; retain 5 years | **LICENCE-BIND** — closed | §6 (Complaints Handling — full section) |
| `ORG-FAIS-RK-GENERAL-CODE` | Comply with the FAIS General Code of Conduct in its entirety | **LICENCE-BIND** — closed | §7 (GCC Compliance Programme — full section); §2–§6 (named GCC projections) |

---

## 9. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream substrate slices.

### 9.1 Substrate currently under construction

- **Advice-record event type and workflow.** The `AdviceInteractionRecorded` event type and the advice-capture workflow (embedded in pre-trade communication flows) are not yet built. Discharge exit signal: advice-interaction event type in the schema; sample advice record emitted and retrieved by party and product class.
- **Complaints register projection.** The complaints register as a projection of the complaint event stream (`ComplaintReceived`, `ComplaintAcknowledged`, `ComplaintInvestigated`, `ComplaintResolved`) is not yet built. Discharge exit signal: complaint event stream active; complaints register projection live in the dashboard; 5-year retention clock wired to `ComplaintResolved` timestamp.
- **KI file management system.** The KI file management system (controlled-record store with access controls, annual certification workflow, and FSCA notification workflow) is not yet built. Discharge exit signal: `KiFitAndProperCertified` event type in schema; KI file retrievable by FSCA-production workflow test.
- **Suitability-assessment workflow.** The suitability-assessment workflow (counterparty categorisation gate in onboarding; `CounterpartyCategoriséd` event; `SuitabilityAssessmentCompleted` event) is part of Niko's onboarding substrate (licence-day activation per `project_ai_driven_bank.md`). Discharge exit signal: counterparty categorisation event type in schema; suitability assessment event emitted in the onboarding test scenario.
- **Fee-disclosure workflow.** The `FeeDisclosureDelivered` event type and the system gate (no advice-interaction event without prior fee-disclosure event for the engagement) are not yet built. Discharge exit signal: event type in schema; gate enforced in the test scenario.

### 9.2 Procedures planned but not yet authored

- `Procedures/by-policy/fais-ki-management.md` — KI designation, annual fit-and-proper review, and KI change notification procedure.
- `Procedures/by-policy/fais-advice-record.md` — advice-interaction capture and 5-year retention procedure.
- `Procedures/by-policy/fais-suitability-assessment.md` — counterparty categorisation and suitability-assessment procedure (institutional scope).
- `Procedures/by-policy/fais-complaints-pipeline.md` — complaints capture through resolution, FAIS Ombud referral, and annual reporting procedure.
- `Procedures/by-policy/fais-annual-compliance-report.md` — annual compliance report preparation, Board approval, and FSCA filing procedure.

### 9.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices or directive sub-sections are invented without verification. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify them at the licence-application gate:

1. Exact FSCA notification timeline for KI change (FAIS s.8 and FSCA FAIS guidance).
2. Exact Banks Act / FAIS interaction obligation on FSP authorisation loss — PA notification requirement `[citation: TBC]`.
3. GCC s.7 sub-sections on third-party remuneration disclosure for institutional market-making spread/mark-up.
4. FSCA guidance on ISDA-as-disclosure-vehicle for OTC derivatives (confirming ISDA Schedule satisfies pre-engagement written disclosure requirement).
5. CPD requirements for Category I and Category II KI — FSCA Board Notice or Guidance Note specifying CPD hours/format.

---

## 10. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Zara (Chief Compliance Officer, governance) + Mira (Regulatory intelligence engineer, compliance) | Initial policy authored. Nine sections: (1) FSP Authorisation and Regulatory Standing — Category I/II scope, authorisation-in-good-standing obligations, annual compliance plan framework, FSCA relationship governance; (2) Key Individual Obligations — designation framework, fit-and-proper four-pillar requirements (qualifications, experience, honesty and integrity, operational ability), KI file maintenance, KI change protocol; (3) Suitability Assessment — counterparty categorisation (Professional Client, Eligible Counterparty, retail prohibition), suitability record content, institutional-context calibration; (4) Advice Record-Keeping — record content requirements, retention (5 years), events-first implementation, Category II discretionary management records; (5) Fee and Commission Disclosure — scope (advisory, intermediary, spread, third-party, ongoing), disclosure mechanism (ISDA, pre-trade, engagement letter), pre-engagement gate; (6) Complaints Handling — five-stage pipeline (capture, acknowledge, investigate, resolve, report), 5-business-day acknowledgment, 6-week resolution, FAIS Ombud referral rights, 5-year retention; (7) General Code of Conduct Compliance Programme — annual compliance plan, annual compliance report, conflict-of-interest management, professional conduct standards, Vera third-line assurance, Mira regulatory-intelligence feed; (8) Obligations closure table: ORG-FAIS-KI, ORG-FAIS-RK-ADVICE, ORG-FAIS-RK-SUITABILITY, ORG-FAIS-RK-FEE-DISCLOSURE, ORG-FAIS-RK-COMPLAINT-HANDLING, ORG-FAIS-RK-GENERAL-CODE; (9) Substrate gaps and citation gaps. Identity discipline per CLAUDE.md "Dispatch discipline" observed throughout. |
