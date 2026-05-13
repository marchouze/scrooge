---
policy-id: credit-risk-policy
title: Credit Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-13"
citations:
  - Banks Act 94 of 1990
  - Regulations Relating to Banks 2012 (as amended)
  - LEX Directive D3/2022 (Large Exposures)
  - BCBS SA-CCR (March 2014, rev. 2017)
  - IFRS 9 Financial Instruments
  - PA GN-5/2013 (FX Settlement Risk)
  - ISDA Master Agreement (2002)
  - GMRA (2011)
author: Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-13
summary: Standalone Credit Risk Policy covering counterparty credit risk (OTC derivatives + repo), issuer risk, settlement risk, concentration risk, large-exposure limits under the SA LEX regime, IFRS 9 ECL governance, wrong-way risk identification, and ISDA/GMRA netting as primary mitigation. Closes obligations ORG-PR-09, ORG-PR-10, ORG-PR-16, ORG-PR-19 (partial), ORG-PR-40. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-CC
---

# Credit Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Rohan (Market risk quantitative engineer, engineering) — co-author (CCR methodology, SA-CCR, wrong-way risk).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); `D-MARKETS-SCHEMA-FOUNDATION` (CEO-approved 2026-05-07). Implements credit risk obligations identified in the FAIS GCC analysis and FSCA reg-to-policy recon pipeline per the no-pause rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-PR-09` (single-name large exposure capped at regulatory ceiling — LEX Directive D3/2022); `ORG-PR-10` (sector concentration ≤ 25% of exposure without explicit BRC approval); `ORG-PR-16` (counterparty credit exposure managed; netting under enforceable ISDA/GMRA); `ORG-PR-19` (PARTIAL — counterparty credit risk dimension of FRTB; market-risk dimension deferred to Market Risk Policy); `ORG-PR-40` (SA large-exposures regime under LEX Directive D3/2022 — single-counterparty caps, connected counterparty groups, exempt-exposures schedule).
> **Status.** COMMENCEMENT-BIND. Credit risk obligations in the institutional trading book activate at first trade. Build-phase operationalisation is the preparation for compliance, not compliance itself (per `project_rules_bind_at_commencement.md` memory, 2026-05-07). The CCR measurement substrate (SA-CCR engine, ISDA/GMRA netting-set calculator, ECL model, BA 600 generator) is under construction per the W-phase roadmap.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Credit Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change in portfolio composition, regulatory revision, or model validation finding · **Citation:** Banks Act 94 of 1990 (credit-risk management mandate) + Regulations Relating to Banks 2012 (as amended) — Reg 38 (Pillar 2 supervisory review, credit risk) `[citation: TBC — precise Reg 38 sub-clause indices for credit risk; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]` + LEX Directive D3/2022 (`ORG-PR-40`, `ORG-PR-09` — large-exposures regime; single-counterparty caps; connected counterparty groups) + BCBS SA-CCR framework (March 2014, rev. 2017, `ORG-PR-19` partial) + IFRS 9 *Financial Instruments* (ECL methodology, `ORG-PR-16` partial) + PA GN-5/2013 (FX settlement risk, `ORG-PR-48`) + ISDA Master Agreement 2002 + Global Master Repurchase Agreement 2011 (`ORG-PR-16`)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") identifies, measures, manages, and reports credit risk across all dimensions arising from the Bank's institutional trading book activities. Its purpose is to ensure the Bank holds adequate capital and collateral against its credit exposures, operates within the concentration limits mandated by the SA large-exposures regime (LEX Directive D3/2022) and the Bank's risk appetite, and maintains sound governance over counterparty credit risk (CCR), issuer risk, settlement risk, and concentration risk at all times.

The Bank is an institutional-only, global-markets trading bank. It does not engage in retail or corporate lending; it holds no residential mortgage book, no consumer credit book, and no SME lending portfolio. Credit risk under this policy arises exclusively from: (i) OTC derivative exposures to institutional counterparties (swap dealers, banks, asset managers, sovereigns, and development finance institutions); (ii) repo and reverse-repo transactions governed by GMRA; (iii) issuer risk on fixed-income securities held in the trading book; (iv) settlement exposures (pre-settlement mark-to-market risk and delivery-versus-payment settlement risk); and (v) concentration risk across names, sectors, and geographies within those exposures.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy operationalise it; and the SA-CCR engine, netting-set calculator, ECL model, and BA 600 generator are the system capabilities that execute those procedures. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

The policy applies from commencement of trading per the COMMENCEMENT-BIND status above. The build-phase obligation is to design and build the substrate to a production-grade standard so that the framework is operational on day one. Vera (internal audit engineer, reports functionally to Thandiwe (Chief Audit Executive, governance)) provides assurance that the substrate is production-grade before the pre-licence go-live readiness gate.

### Principles

- **Institutional-only scope.** Credit risk under this policy is trading-book CCR and issuer risk. There is no consumer or commercial lending. Every credit exposure arises from a documented, legally-enforceable transaction with an institutional counterparty operating under a signed ISDA Master Agreement or GMRA.
- **Regulatory-floor discipline.** The Bank maintains all credit-risk exposures within the SA LEX regime single-counterparty cap (25% of eligible capital per Reg 38 + LEX Directive D3/2022) at all times. Breach of the LEX cap is a Critical event per §1.4 of this policy.
- **Credit quality floor in the first trading phase.** All counterparty exposures in the first trading phase are subject to an internal credit-quality floor: investment grade or equivalent (S&P/Fitch BBB−/Baa3 Moody's or better, or the Bank's internal rating equivalent). Exposures to sub-investment-grade counterparties require BRC approval and are subject to enhanced monitoring and tighter concentration limits.
- **Netting primacy.** Credit exposure is measured net of legally enforceable netting arrangements. An ISDA Master Agreement with a Credit Support Annex (CSA) is required before the Bank transacts OTC derivatives with any counterparty. A GMRA is required before any repo or reverse-repo. No bilateral netting is recognised unless the Bank's legal team (Imani (Legal-as-code engineer, engineering), confirmed by external counsel) has validated the enforceability of the netting agreement in the relevant jurisdiction.
- **Collateral as a second line of defence.** Collateral under a CSA or GMRA is the second line of defence against counterparty default, after netting. The collateral eligibility schedule, haircut methodology, and substitution rules are set in the CCR Collateral Standards in §3 of this policy. Collateral is not a substitute for credit quality; sub-investment-grade counterparties accepted under BRC approval require enhanced collateralisation.
- **Concentration discipline.** Single-name concentration is limited to the LEX cap at the regulatory level and to internal sub-limits as set in the Credit Risk Appetite framework in §3 of this policy. Sector concentration is limited to 25% of total exposure without BRC approval per `ORG-PR-10`. Geographic concentration is monitored and subject to risk-appetite thresholds.
- **Events-first credit accounting.** Credit exposures, IFRS 9 ECL staging, and limit-utilisation are computed as queries over the event log, not as stored balances in a parallel system (Principle 1). The SA-CCR engine and netting-set calculator produce the credit-exposure-at-default (EAD) from event substrates; the ECL model produces the expected credit loss from EAD and probability-of-default (PD) / loss-given-default (LGD) parameters.
- **Independent model validation.** The SA-CCR engine, netting-set calculator, and ECL model are Tier 1 models under the Model Risk Policy (per `ORG-PR-12`). Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates each model before first use in production and annually thereafter. No model is used in regulatory capital computation without a current `ModelValidationCompleted` event in the event log.
- **Wrong-way risk identification.** Specific and general wrong-way risk (WWR) is identified, assessed, and subject to enhanced monitoring per §3.5 of this policy. Specific WWR — where the creditworthiness of a counterparty is adversely correlated with the exposure value — is a credit concentration concern; exposures exhibiting specific WWR require BRC approval regardless of size.

### Roles

Helena (Chief Risk Officer, governance) is the policy owner and chair of the Credit Risk Committee (CRC), a sub-committee of the Board Risk Committee (BRC). Helena's responsibilities under this policy include: owning the credit-risk appetite framework; approving the credit-quality floor and sector concentration limits; chairing the CRC; reviewing and approving counterparty credit-limit exception requests above the authority matrix thresholds; presenting the credit-risk dashboard to EXCO and the BRC; and owning the IFRS 9 ECL governance framework.

Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds and operates the SA-CCR engine, the netting-set calculator, and the quantitative components of the ECL model. Rohan is the first-line quantitative owner of the CCR measurement methodology and produces the `CcrExposureComputed` and `EclEstimated` typed events in the event log.

Imani (Legal-as-code engineer, engineering — reports to Helena in credit-risk context) is responsible for the enforceability assessment of netting agreements (ISDA Master + CSA, GMRA) and the legal-entity classification of counterparties within connected-counterparty groups under D3/2022. No netting benefit is recognised without Imani's sign-off and a `NettingAgreementValidated { counterpartyId, jurisdiction, enforceability: "confirmed" }` event.

Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the SA-CCR engine, netting-set calculator, and ECL model. Validation is a prerequisite for production use of each model.

Vera (internal audit engineer) provides third-line assurance that the credit-risk governance framework is being followed: limit breaches are escalated, LEX caps are respected, netting is not recognised without validation, and ECL staging is governed per the quarterly refresh cycle.

Owen (Company Secretary, governance) manages the secretarial framework for CRC and BRC meetings at which credit risk is presented.

### Breach

Breach taxonomy under this policy is three-severity:

- **Alert (Amber).** Single-name exposure within 80% of the LEX cap; or sector concentration within 80% of the 25% RAS limit; or any counterparty approaching the internal sub-limit threshold. Immediate notification to the CRC chair (Helena) and EXCO. Exposure review initiated; no new transactions with the counterparty or sector until the review concludes.
- **Hard Breach (Red).** Single-name exposure between 90% and 100% of the LEX cap without BRC approval; or sector concentration exceeding 25% without BRC approval (`ORG-PR-10`). Immediate notification to the CRC, BRC, and CEO. New transactions with the counterparty suspended pending BRC review. Remediation plan (exposure reduction or BRC-approved exception) submitted within five business days.
- **Critical (Critical-Red).** Single-name exposure exceeding the LEX cap (25% of eligible capital per Reg 38 + D3/2022) without PA approval; or netting benefit recognised for an agreement not validated by Imani; or IFRS 9 ECL Stage 3 classification delayed beyond the mandatory staging trigger. Immediate CEO notification; PA notification under the LEX Directive D3/2022 reporting obligations `[citation: TBC — exact notification-deadline provision in D3/2022; Imani + external counsel ratify at the licence-application gate]`; Board-level escalation. A `LexBreachIdentified` event is emitted immediately.

---

## 2. Large Exposures (LEX) Regime

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for the LEX policy framework; BRC for individual LEX-level exposure exceptions · **Cadence:** Monthly BA 600 large-exposure return; quarterly BRC review of utilisation; triggered on any new counterparty approaching 15% of eligible capital · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC]` + LEX Directive D3/2022 (`ORG-PR-40`; single-counterparty cap; connected counterparty groups; exempt exposures schedule) + Basel III large-exposures framework (BCBS 283, April 2014, superseded; BCBS 346, April 2019 `[citation: TBC — precise BCBS 283/346 final standard]`) + `ORG-PR-09` (single-name large exposure capped at regulatory ceiling)

### Purpose

The SA large-exposures (LEX) regime, operationalised through LEX Directive D3/2022, limits the Bank's exposure to any single counterparty or group of connected counterparties to a maximum of 25% of the Bank's eligible capital. The LEX regime is the primary regulatory tool for preventing idiosyncratic concentration risk — the risk that the default of a single counterparty or connected group would cause the Bank to fail. This section sets out the Bank's obligations under D3/2022, the governance framework for monitoring and managing LEX utilisation, and the process for handling exempt exposures and connected-counterparty-group aggregation.

### Principles

- **LEX definition of exposure.** A large exposure is any exposure to a single counterparty or connected counterparty group that equals or exceeds 10% of the Bank's eligible capital, computed per the D3/2022 definition. All exposures — on-balance-sheet positions, OTC derivative CCR (EAD per SA-CCR), repo/reverse-repo, off-balance-sheet commitments — are aggregated within the definition. No exposure netting is permitted for LEX purposes unless the netting agreement is legally enforceable and validated per §1 of this policy.
- **Single-counterparty cap.** The Bank's exposure to any single counterparty or connected counterparty group must not exceed 25% of eligible capital at any time, per D3/2022 and `ORG-PR-09`. Eligible capital is computed per the capital adequacy framework (Tier 1 capital for LEX purposes per BCBS 346 `[citation: TBC]`). The Bank's SA-CCR engine produces the LEX-relevant EAD for each OTC derivative netting set; the netting-set calculator produces the GMRA-adjusted repo exposure.
- **Connected counterparty groups.** Counterparties are aggregated into connected counterparty groups where: (i) one counterparty directly or indirectly controls the other (control per IFRS 10 definition `[citation: TBC]`); or (ii) financial difficulties of one would cause financial difficulties in the other (interdependence test per D3/2022 `[citation: TBC — exact D3/2022 interdependence-test provision]`). Imani maintains the connected-counterparty-group register in the event log as `ConnectedCounterpartyGroupUpdated` events. The register is reviewed quarterly and on each new counterparty onboarding.
- **Exempt exposures.** The following categories of exposures are exempt from the LEX cap per D3/2022 schedule `[citation: TBC — precise D3/2022 exempt-exposure schedule reference]`: (i) exposures to the Republic of South Africa central government (sovereign); (ii) exposures to the South African Reserve Bank (SARB); (iii) exposures to multilateral development banks (MDBs) with 0% RWA treatment; (iv) intraday exposures arising from payment-and-settlement activities. Exempt exposures are still monitored and reported; they are excluded from the LEX cap computation but included in the BA 600 return in the appropriate exempt category.
- **Internal sub-limits below the LEX cap.** The Bank sets internal single-name exposure sub-limits below the 25% LEX cap, calibrated against the credit quality of the counterparty and the Bank's overall credit-risk appetite. The sub-limit schedule is maintained in `Procedures/by-policy/credit-risk-limit-management.md` (planned). Sub-limits are: investment-grade counterparties: up to 20% of eligible capital; sub-investment-grade counterparties (BRC-approved): up to 10% of eligible capital; sovereign and MDB counterparties (exempt category): monitoring only, no internal sub-limit applied at v0.
- **Monthly BA 600 return.** The Bank submits the BA 600 large-exposure return to the PA monthly, per D3/2022 reporting obligations (`ORG-PR-40`). The return is generated by the BA 600 generator from the event-log state as at the reporting date. Rohan is the system operator for the BA 600 generator; Camille (Chief Financial Officer, governance) signs off the return. A `Ba600ReturnSubmitted { reportingPeriod, submissionDate, documentHash }` event is emitted on submission.
- **LEX utilisation monitoring.** The SA-CCR engine computes LEX utilisation for each counterparty and connected-counterparty group daily. A daily `LexUtilisationComputed { counterpartyId, groupId, exposureAmount, eligibleCapital, utilisationPct }` event is emitted. Utilisation at or above 80% of the LEX cap triggers an Alert per §1.4. Utilisation at or above 100% without PA approval triggers a Critical breach.
- **LEX exceptions require BRC approval.** Any transaction that would cause LEX utilisation to exceed the internal sub-limit (but remain within the 25% regulatory cap) requires CRC approval. Any transaction requiring an exposure above the 25% regulatory cap requires PA approval under D3/2022 `[citation: TBC — D3/2022 exception process; Imani + external counsel ratify]` and Board approval. No exception transaction proceeds without a `LexExceptionApproved { approver, exceptionType, expiryDate }` event in the log.

### Roles

Helena owns the LEX policy framework and chairs the CRC for LEX utilisation reviews. Rohan operates the SA-CCR engine and BA 600 generator, and produces the daily `LexUtilisationComputed` events. Imani maintains the connected-counterparty-group register and validates netting enforceability. Camille co-signs the BA 600 return. Owen manages the BRC secretarial framework for LEX exception approvals. Vera audits LEX limit compliance: any LEX cap breach not identified within the same business day is a Vera Critical finding.

### Breach

Any single-name or group exposure breaching the 25% LEX cap without PA approval is a Critical event under §1.4. The `LexBreachIdentified` event is emitted immediately; Helena notifies the CEO and initiates PA reporting under D3/2022 within the prescribed notification timeline `[citation: TBC]`. The transaction causing the breach is unwound or hedged within the timeframe required by D3/2022, unless the PA grants a dispensation. BRC is convened within five business days.

---

## 3. Counterparty Credit Risk Standards and Limits

**Owner:** Helena (Chief Risk Officer, governance); Rohan (Market risk quantitative engineer, engineering) for SA-CCR methodology · **Approval:** Board (CEO interim) for the CCR framework; CRC for individual netting-set exceptions; BRC for sub-investment-grade counterparty approvals · **Cadence:** Daily CCR computation; monthly CCR dashboard to EXCO; quarterly to BRC · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC]` + BCBS SA-CCR (March 2014, rev. 2017; `ORG-PR-19` partial) + ISDA Master Agreement 2002 + ISDA Credit Support Annex (CSA) + GMRA 2011 + `ORG-PR-16` (counterparty credit exposure managed; netting under enforceable ISDA/GMRA)

### Purpose

Counterparty credit risk (CCR) is the risk that a counterparty to an OTC derivative or repo transaction defaults before final settlement, leaving the Bank with an uncollateralised positive mark-to-market exposure. This section establishes the Bank's CCR measurement methodology (Standardised Approach for CCR — SA-CCR), the netting and collateral mitigation framework, the collateral eligibility and haircut standards, and the limit-management structure for CCR exposures.

The Bank uses the SA-CCR framework as the primary method for computing regulatory EAD for OTC derivative exposures, replacing the legacy Current Exposure Method (CEM). SA-CCR is the BCBS-mandated successor to CEM and provides a more risk-sensitive EAD estimate that reflects the maturity profile, asset class, and margin/collateral terms of each netting set. Rohan is responsible for the SA-CCR engine design, implementation, and ongoing operation.

### SA-CCR Methodology

The SA-CCR computes EAD as the sum of Replacement Cost (RC) and Potential Future Exposure (PFE) for each netting set, subject to a regulatory multiplier. The core components are:

- **Replacement Cost (RC).** For margined netting sets: RC = max(V − C, MTA + TH, 0), where V is the current mark-to-market of the netting set, C is the collateral held net of haircuts, MTA is the minimum transfer amount, and TH is the threshold. For unmargined netting sets: RC = max(V, 0). V and C are computed from the event-log state as at the computation date; the Replacement Cost is emitted as `CcrReplacementCostComputed { nettingSetId, rc, computationDate }`.
- **Potential Future Exposure (PFE).** PFE = multiplier × AggregatedAddOn, where the AggregatedAddOn is the sum of asset-class add-ons (interest rate, FX, credit, equity, commodity) computed per the SA-CCR rules for each trade in the netting set. The multiplier is a function of the ratio (V − C) / AggregatedAddOn and is floored at 5% per BCBS SA-CCR `[citation: TBC — precise BCBS SA-CCR document reference and section]`. PFE is emitted as `CcrPfeComputed { nettingSetId, pfe, aggregatedAddOn, computationDate }`.
- **EAD.** For regulatory capital purposes: EAD = α × (RC + PFE), where α = 1.4 (the BCBS regulatory multiplier for SA-CCR) `[citation: TBC — BCBS SA-CCR α parameter reference]`. EAD is emitted as `CcrEadComputed { nettingSetId, ead, computationDate }`. EAD is the input to the LEX utilisation calculation and to the credit-RWA computation under the Standardised Approach for credit risk.
- **Netting-set identification.** A netting set is a group of transactions between the Bank and a single counterparty subject to a single legally-enforceable netting agreement (ISDA Master Agreement) for which simultaneous close-out netting would apply on the counterparty's default. Cross-product netting across ISDA Master and GMRA is not recognised at v0; each product type has its own netting set per counterparty.

### Netting and Collateral Mitigation

- **ISDA Master Agreement requirement.** No OTC derivative transaction is executed with a counterparty without a signed, legally-enforceable ISDA Master Agreement (2002 form or later). The enforceability of the close-out netting provision in the jurisdiction of the counterparty is confirmed by Imani's legal review and recorded as a `NettingAgreementValidated { counterpartyId, agreementType: "ISDA", jurisdiction, enforceability: "confirmed" }` event before the first trade. Without this event, no netting benefit is recognised in the SA-CCR computation.
- **Credit Support Annex (CSA).** The Bank's standard CSA terms are: daily margining; threshold of zero for investment-grade counterparties (threshold may be set above zero for sovereigns and MDBs with CRC approval); minimum transfer amount (MTA) as negotiated per counterparty. The CSA governs the collateral terms that feed into the RC computation (the C term) and the eligibility of the netting set as "margined" for SA-CCR purposes.
- **GMRA requirement for repo.** No repo or reverse-repo transaction is executed with a counterparty without a signed, legally-enforceable GMRA (2011 form). Enforceability is confirmed by Imani and recorded as a `NettingAgreementValidated { counterpartyId, agreementType: "GMRA", jurisdiction, enforceability: "confirmed" }` event. Repo exposure for LEX and capital purposes is computed net of the GMRA haircut on the collateral securities.
- **Eligible collateral.** For CSA purposes, eligible collateral under the Bank's standard terms is: cash (USD, EUR, GBP, ZAR); SA government bonds (Reg 28-eligible, haircut per D3/2022 or BCBS SFT tables `[citation: TBC]`); G10 sovereign bonds (AAA to A−; haircut schedule per BCBS standardised haircut table). Non-eligible collateral posted by a counterparty does not receive recognition in the RC computation until it has been reviewed and approved by the CRC with a `CollateralEligibilityApproved` event.
- **Collateral haircuts.** The Bank applies regulatory haircuts per the BCBS standardised SFT haircut table `[citation: TBC — precise BCBS SFT haircut table reference]` for the CSA collateral portfolio. Own-estimate haircuts may be used with model-validation approval from Nadia and BRC sign-off. Haircuts are updated quarterly or on material market dislocation. The haircut schedule is maintained in `Procedures/by-policy/collateral-haircut-schedule.md` (planned).
- **Collateral dispute resolution.** Collateral calls under the CSA are made daily. If a counterparty disputes a collateral call, the dispute resolution process per the CSA terms is invoked; the disputed amount is excluded from C in the RC computation until resolution. A `CollateralDisputeOpened { counterpartyId, disputedAmount, openDate }` event triggers enhanced CRC monitoring.

### Credit Risk Appetite and Limits

- **Investment-grade floor.** All counterparty credit exposures in the first trading phase are subject to the investment-grade floor: minimum S&P/Fitch BBB−/Moody's Baa3 external rating, or Helena's internal-rating equivalent. Counterparties without an external rating require Helena's credit assessment and CRC approval before onboarding.
- **Sub-investment-grade counterparties.** Exposures to sub-investment-grade counterparties are permitted with BRC approval only. Sub-investment-grade counterparties are subject to: (i) enhanced collateralisation (threshold = 0 under the CSA, no unsecured exposure permitted); (ii) tighter LEX sub-limits (maximum 10% of eligible capital); (iii) quarterly CRC review of the exposure; and (iv) a `SubInvestmentGradeCounterpartyApproved { counterpartyId, ratingAtApproval, approvalDate, reviewDate }` event in the log.
- **Sector concentration limits.** Sector concentration is measured as the percentage of total gross CCR EAD (summed across all counterparties) allocated to a single GICS sector or equivalent. The limit is 25% without BRC approval per `ORG-PR-10`. The sectors monitored are: financial services (banks, broker-dealers, asset managers); sovereigns / central banks; energy and commodities; real estate; other. Sector concentration is reviewed monthly by the CRC.
- **Geographic concentration.** Geographic concentration of CCR exposures is monitored by the CRC. No specific regulatory limit applies at v0; the RAS carries a monitoring threshold of 40% of EAD in any single country outside South Africa. The CRC may set tighter thresholds for jurisdictions with elevated political or settlement risk.

---

## 4. IFRS 9 Expected Credit Loss Governance

**Owner:** Helena (Chief Risk Officer, governance) — ECL governance; Bea (Accounting and financial reporting engineer, engineering) — ECL computation and accounting · **Approval:** Board (CEO interim) for ECL methodology; EXCO for quarterly ECL provisions; BRC for Stage 3 classifications above materiality threshold · **Cadence:** Quarterly ECL refresh; annual ECL model review; triggered on Stage 2 → Stage 3 significant-increase-in-credit-risk (SICR) event · **Citation:** IFRS 9 *Financial Instruments* (paragraphs 5.5.1 – 5.5.17 and related guidance) + PA D3/2023 (regulatory treatment of IFRS 9 ECL provisions in CET1 and Tier 2; `ORG-PR-44`) + `ORG-PR-16` (counterparty credit exposure managed) + `ORG-PR-09` (large-exposure management — ECL governance is a downstream tool)

### Purpose

IFRS 9 requires the Bank to recognise expected credit losses (ECL) on all financial assets measured at amortised cost or fair value through other comprehensive income (FVOCI), forward-looking, and probability-weighted. For the Bank's trading-book-centric model, IFRS 9 ECL applies primarily to: (i) the fair-value-through-P&L (FVTPL) assets where impairment recognition is not required; (ii) FVOCI fixed-income holdings (sovereign and corporate bonds); (iii) margin-call receivables and settlement receivables under the GMRA. OTC derivatives at fair value through P&L (FVTPL) are subject to CCR measurement under SA-CCR rather than IFRS 9 ECL; however, the credit valuation adjustment (CVA) is the P&L analogue of ECL for derivatives.

This section establishes the ECL staging framework, the ECL model governance, the quarterly refresh cycle, and the BRC approval pathway for material Stage 3 classifications. The regulatory capital treatment of IFRS 9 ECL provisions follows PA D3/2023 (`ORG-PR-44`) as set out in the Capital Management Policy.

### IFRS 9 Staging Framework

- **Stage 1.** All financial assets on initial recognition. ECL = 12-month expected credit loss (i.e., the portion of lifetime ECL attributable to default events within 12 months). Interest is recognised on the gross carrying amount. Stage 1 ECL is computed using the PD (12-month horizon), LGD, and EAD from the Bank's ECL model, applied to the current portfolio.
- **Stage 2.** Assets where credit risk has increased significantly since initial recognition (SICR trigger). ECL = lifetime expected credit loss. Interest is still recognised on the gross carrying amount. SICR triggers are: (i) external rating downgrade by ≥ 2 notches since initial recognition; (ii) counterparty placed on the Bank's credit watchlist; (iii) counterparty EAD exceeds 80% of its LEX sub-limit; (iv) any objective evidence of deterioration short of default. Stage 2 classification is automated where the SICR trigger is a rating-based rule; qualitative SICR triggers require CRC review and a `SicrTriggered { assetId, counterpartyId, triggerType, classificationDate }` event.
- **Stage 3.** Assets where a credit loss event has occurred (i.e., the counterparty has defaulted, is in financial difficulty, or the asset is credit-impaired per IFRS 9 paragraph 5.5.1). ECL = lifetime expected credit loss; interest is recognised on the net carrying amount (gross carrying amount less ECL allowance). Stage 3 classifications are approved by the CRC for exposures below the materiality threshold and by the BRC for exposures above the materiality threshold. A `CreditLossEventIdentified { assetId, counterpartyId, eventType, classificationDate }` event is emitted on Stage 3 classification.
- **Write-off.** A financial asset is written off when the Bank has no reasonable expectation of recovery. Write-offs require BRC approval regardless of size and are recorded as `AssetWrittenOff { assetId, counterpartyId, writtenOffAmount, approvalDate }` events. Write-offs are irrevocable; subsequent recoveries are recognised in P&L as a recovery, not a reversal of the write-off.

### ECL Model Governance

- **ECL model components.** The ECL model produces PD (probability of default, 12-month and lifetime), LGD (loss given default, net of collateral recovery), and EAD (exposure at default, from the SA-CCR engine for derivatives and the GMRA calculator for repo). ECL = PD × LGD × EAD × discount factor, probability-weighted across multiple economic scenarios.
- **Forward-looking scenarios.** IFRS 9 requires ECL to be forward-looking, incorporating information about future economic conditions. The ECL model uses at least three probability-weighted macro-economic scenarios: base, adverse, and upside. The scenario weights and macro-economic variable assumptions are reviewed quarterly by Helena and Bea, and confirmed with the BRC at the quarterly ECL review. The scenario design is consistent with the stress-testing programme in the Capital Management Policy §5.
- **Quarterly ECL refresh.** The ECL model is run quarterly as part of the financial close process. The output — ECL allowance by stage and by asset — is reviewed by Helena (credit-risk sign-off) and Bea (accounting sign-off) before the ECL provision is recognised in the financial statements. A `EclRefreshCompleted { quarter, totalEcl, stageBreakdown, scenarioWeights, reviewDate }` event is emitted on approval. Cross-reference `Procedures/by-policy/ecl-stage-projection-refresh.md` (planned) for the detailed procedure.
- **ECL model validation.** The ECL model is validated by Nadia before initial production use and annually thereafter. Validation covers: PD model performance (Gini coefficient, accuracy ratio); LGD methodology; macro-economic scenario design; IFRS 9 staging rule calibration. A `ModelValidationCompleted { modelId: "ecl-model", modelVersion, findings[] }` event is a prerequisite for the first production ECL computation. Material model validation findings are disclosed to the BRC and incorporated into the ICAAP model-risk narrative.
- **PA D3/2023 regulatory treatment.** Per PA D3/2023 (`ORG-PR-44`) and the Capital Management Policy, Stage 1 and Stage 2 general ECL provisions (within the Basel transitional cap) receive Tier 2 capital credit; Stage 3 specific provisions are a CET1 deduction. The ECL provision recognised in the financial statements is the input to the capital adequacy computation; Bea produces the D3/2023 regulatory-treatment computation as part of the quarterly BA-return suite.

---

## 5. Settlement Risk

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for settlement-risk policy framework; CRC for settlement-risk limit exceptions · **Cadence:** Daily settlement-risk monitoring; monthly settlement dashboard to EXCO · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC]` + PA GN-5/2013 (FX settlement risk; `ORG-PR-48`) + BCBS guidelines on failed-trade settlement `[citation: TBC — BCBS settlement risk guidance reference]`

### Purpose

Settlement risk is the risk that a counterparty fails to deliver securities or cash at the time of settlement, leaving the Bank exposed to the full value of the unsettled transaction. Settlement risk is distinct from CCR (pre-settlement mark-to-market risk): CCR is the risk of counterparty default *before* settlement (and is managed under §3); settlement risk is the risk of failure *at* the moment of settlement. For the Bank's institutional trading book, settlement risk arises from: (i) delivery-versus-payment (DVP) transactions in the bond and equity markets; (ii) free-of-payment (FOP) deliveries where market convention requires it; and (iii) FX settlement risk under PA GN-5/2013.

### Principles

- **Pre-settlement risk (mark-to-market).** The positive mark-to-market of an unsettled trade from trade date to settlement date represents pre-settlement risk. Pre-settlement risk is monitored daily as part of the CCR dashboard. For trades settling via DVP through the Central Securities Depository (CSD) — the Strate-operated settlement system — pre-settlement risk is mitigated by the CSD's failed-trade management process and the Bank's sponsor bank arrangement (per the indirect-participant operating posture at `project_indirect_participant_posture.md`).
- **DVP settlement standard.** All bond and equity settlements are conducted on a DVP basis through the Bank's CSD account (maintained via the sponsor bank) wherever the market infrastructure supports it. FOP settlement is used only where DVP is unavailable (e.g., tri-party repo arrangements) and requires CRC approval above a materiality threshold.
- **FX settlement risk (PA GN-5/2013, ORG-PR-48).** FX settlement risk — the risk of paying away one currency leg without receiving the other (the "Herstatt risk") — is managed per PA GN-5/2013. The Bank mitigates FX settlement risk through: (i) CLS Bank settlement for eligible currency pairs (via the sponsor bank's CLS membership — the Bank is an indirect CLS participant per the indirect-participant posture); (ii) bilateral netting of FX settlement flows under the ISDA Master Agreement for pairs not eligible for CLS; (iii) same-day payment matching and confirmation before release of outgoing payments. The FX settlement-risk exposure is reported monthly in the credit-risk dashboard under the PA GN-5/2013 framework.
- **Failed trades.** A failed trade is one where settlement does not occur on the contractual settlement date. The Bank's failed-trade management procedure (in `Procedures/by-policy/failed-trade-management.md`, planned) sets out the escalation, buy-in, and reporting process. Persistent failed trades with a single counterparty (three or more fails within a rolling 30-day window) are escalated to the CRC as a potential CCR signal.
- **Settlement-risk capital.** Settlement-risk capital requirements under the Regulations Relating to Banks are computed on the basis of unsettled transactions outstanding beyond the prescribed number of days `[citation: TBC — exact Reg Relating to Banks provision for settlement-risk capital; Rohan + Imani + external counsel ratify]`. The BA-return suite includes the settlement-risk capital add-on; Rohan is the system operator for this computation.

---

## 6. Wrong-Way Risk

**Owner:** Helena (Chief Risk Officer, governance); Rohan (Market risk quantitative engineer, engineering) for quantitative measurement · **Approval:** BRC for specific WWR exposures above materiality threshold · **Cadence:** Quarterly WWR review at CRC; triggered on new structured transaction with a correlated counterparty · **Citation:** BCBS SA-CCR (specific and general WWR definitions) + Regulations Relating to Banks — Reg 38 `[citation: TBC]`

### Purpose

Wrong-way risk (WWR) arises when the exposure to a counterparty is adversely correlated with the creditworthiness of that counterparty — the exposure is highest precisely when the counterparty is most likely to default. WWR inflates the CCR beyond what the SA-CCR formula captures, because SA-CCR does not account for the correlation between the counterparty's credit quality and the value of the exposures. This section establishes the identification, assessment, and management framework for specific and general wrong-way risk.

### Principles

- **Specific WWR.** Specific WWR (SWWR) arises where there is a legal, contractual, or economic link between the counterparty and the underlying risk factor driving the exposure value. Examples in the Bank's context: (i) a total return swap (TRS) with a counterparty where the reference entity is the counterparty itself or an affiliate; (ii) a put option purchased from a counterparty where the reference is the counterparty's own equity; (iii) collateral posted by a counterparty that is highly correlated with its own creditworthiness (e.g., a counterparty posting its own bonds as CSA collateral). SWWR exposures require BRC approval regardless of size and are subject to enhanced monitoring and, where feasible, structural mitigation (e.g., exclusion of correlated collateral from eligible CSA assets).
- **General WWR.** General WWR (GWWR) arises from macro-economic correlations between the Bank's overall CCR portfolio and broad market conditions. For example, an emerging-market credit stress that simultaneously depresses the ZAR (increasing the ZAR-equivalent EAD of FX-denominated netting sets) and increases counterparty default probabilities constitutes GWWR. GWWR is assessed in the ICAAP stress-test programme (§5 of the Capital Management Policy) as a portfolio-level stress scenario rather than a single-counterparty assessment.
- **SWWR identification process.** On each new transaction, the front office is required to flag any transaction with a potential SWWR characteristic. Rohan reviews flagged transactions and classifies them as SWWR or not within one business day. A `WrongWayRiskFlagged { transactionId, counterpartyId, classification: "SWWR" | "GWWR" | "none", reviewDate }` event is emitted for each reviewed transaction. SWWR-classified transactions are reported to the CRC at its next meeting.
- **SWWR capital add-on.** For SWWR transactions, the EAD for regulatory capital purposes is increased by a supervisory add-on above the SA-CCR standard EAD `[citation: TBC — BCBS SA-CCR SWWR add-on provision; Rohan + Imani + external counsel ratify]`. The add-on methodology is validated by Nadia before first use.
- **SWWR limit.** The Bank's total SWWR EAD (summed across all SWWR-classified transactions) is limited to 5% of total CCR EAD as a portfolio-level risk-appetite threshold. Breaching this threshold requires CRC approval and is reported to the BRC.

---

## 7. Credit Risk Governance and Monitoring

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for governance framework · **Cadence:** CRC monthly; BRC quarterly; ICAAP annually · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC]`

### Purpose

This section sets out the governance structure for credit risk management: the Credit Risk Committee (CRC), the authority matrix for credit-limit approvals and exceptions, the credit-risk dashboard and reporting, and the limit-breach escalation framework.

### Credit Risk Committee

The Credit Risk Committee (CRC) is a sub-committee of the BRC. Helena chairs the CRC. The CRC meets monthly and on an ad hoc basis for limit-breach decisions and exception approvals. The CRC is the first-line governance forum for all material credit-risk decisions below the BRC materiality threshold. CRC deliberations are recorded as `CrcMinutesApproved { meetingDate, resolutions[] }` events in the event log; Owen manages the secretarial framework.

### Credit-Limit Authority Matrix

The credit-limit authority matrix is maintained in `Procedures/by-policy/credit-risk-limit-management.md` (planned). The authority structure at v0 is:

- **Below internal sub-limit:** executed by the front office within existing approved limits; reported to CRC at the next monthly meeting.
- **Sub-limit exception (above sub-limit but below 25% LEX cap):** CRC approval required; `CrcLimitExceptionApproved` event emitted before transaction proceeds.
- **LEX cap exception (above 25% regulatory cap):** PA approval + Board approval required; `LexExceptionApproved` event emitted; `PaLexApprovalConfirmed` event emitted after PA confirmation.
- **Sub-investment-grade counterparty:** BRC approval required; `SubInvestmentGradeCounterpartyApproved` event emitted before onboarding.

### Credit Risk Reporting

- **Daily.** The CCR dashboard — EAD by counterparty, LEX utilisation, SWWR flags, collateral received and posted — is produced daily by Rohan's SA-CCR engine and distributed to Helena and the CRC chair. A `CcrDashboardPublished { date, totalEad, lexUtilisationTop5[] }` event is emitted.
- **Monthly.** The credit-risk dashboard is presented to EXCO. The monthly dashboard includes: CCR EAD by counterparty and sector; LEX utilisation against caps; IFRS 9 ECL stage movements; failed trades; new SWWR-classified transactions; netting-agreement coverage. Camille (Chief Financial Officer, governance) receives the credit-risk component for capital-adequacy integration.
- **Quarterly.** The credit-risk portfolio report is presented to the BRC. The quarterly report includes: stress-test results (credit-stress component per the Capital Management Policy §5); ECL model performance review; back-testing of PD and LGD estimates; sector and geographic concentration analysis; forward-looking credit outlook. Helena presents; Rohan authors the quantitative sections.
- **Annually.** The ICAAP narrative includes a credit-risk chapter authored by Helena and Rohan. The ICAAP credit chapter covers: CCR methodology review; Pillar 2A concentration-risk add-on self-assessment; ECL model validation status; LEX utilisation historical trends; IFRS 9 staging history.

---

## 8. Exceptions and Escalation

**Owner:** Helena (Chief Risk Officer, governance) · **Cadence:** Event-triggered · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks — Reg 38 `[citation: TBC]` + LEX Directive D3/2022 (`ORG-PR-40`) + `ORG-PR-09`, `ORG-PR-10`, `ORG-PR-16`

### Principles

- **Exception documentation.** Every exception to a credit-risk limit or policy requirement is documented as a typed event in the event log before the excepted transaction proceeds (or, for retrospective breach identification, within one business day of identification). No exception is oral-only; every exception has a reference event.
- **Time-limited exceptions.** All credit-risk limit exceptions are time-limited. The maximum exception duration is 90 days without BRC renewal. Exceptions not renewed at expiry are automatically treated as lapsed; the CRC is notified.
- **Escalation to the PA.** LEX cap breaches and any other regulatory limit breaches are reported to the PA within the timeframe prescribed by the applicable directive or the Regulations Relating to Banks `[citation: TBC]`. Helena is responsible for PA notification; Owen manages the formal notification letter. The `PaNotificationSubmitted { notificationType, notificationDate, regulatoryRef }` event is emitted on submission.
- **Recovery from breach.** Following a credit-risk limit breach, Helena produces a remediation plan — identifying the cause, the corrective action (exposure reduction, hedging, or exception approval), and the timeline — within five business days of the breach date. The remediation plan is reviewed by the BRC and recorded as a `RemediationPlanApproved { breachEventId, remediationActions[], targetDate }` event.
- **Vera reporting of unescalated breaches.** Vera audits the event log for credit-risk limit breaches that were not escalated per the escalation matrix above. An unescalated breach is a Vera Critical finding reported to Thandiwe and the BRC.

---

## 9. Obligations Closure Table

The following obligations-register rows are closed or partially closed by this policy.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-PR-09` | Single-name large exposure capped at regulatory ceiling (LEX Directive D3/2022) | **IN FORCE** — closed | §2 (LEX Regime — single-counterparty cap principle), §3 (Credit Risk Appetite — internal sub-limits), §1.4 (Breach taxonomy — Critical at cap breach) |
| `ORG-PR-10` | Sector concentration ≤ 25% of exposure without explicit BRC approval | **IN FORCE** — closed | §3 (Sector concentration limits principle), §7 (CRC authority matrix), §8 (Exceptions and Escalation) |
| `ORG-PR-16` | Counterparty credit exposure managed; netting under enforceable ISDA/GMRA | **IN FORCE** — closed | §1 (Netting primacy and Collateral principles), §3 (ISDA/GMRA requirement, SA-CCR methodology), §4 (ECL governance) |
| `ORG-PR-19` | PARTIAL — counterparty credit risk dimension of FRTB | **PARTIAL** (CCR-SA-CCR dimension closed; FRTB market-risk dimension deferred to Market Risk Policy) — partially closed | §3 (SA-CCR methodology — full section), §6 (WWR — SWWR capital add-on) |
| `ORG-PR-40` | SA large-exposures regime under LEX Directive D3/2022: single-counterparty caps, connected counterparty groups, exempt exposures, BA 600 reporting | **IN FORCE** — closed | §2 (LEX Regime — full section) |

---

## 10. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream delivery phases.

### 10.1 Substrate currently under construction

- **SA-CCR engine (Rohan, Market risk quantitative engineer, engineering).** Produces RC, PFE, and EAD per SA-CCR for each ISDA netting set. Discharge exit signal: `CcrEadComputed { nettingSetId, ead }` event on a synthetic fixture netting set; recon `recon:sa-ccr-ead-validation` green.
- **Netting-set calculator (Rohan).** Identifies netting sets, aggregates trades by ISDA Master, and computes net mark-to-market for RC computation. Discharge: `NettingSetIdentified { counterpartyId, nettingSetId, trades[] }` event on synthetic counterparty fixture.
- **ECL model (Rohan + Bea).** Produces 12-month and lifetime PD, LGD, and ECL allowance by stage. Discharge: `EclRefreshCompleted { quarter }` event on synthetic portfolio fixture; model validated by Nadia.
- **BA 600 generator (Rohan + Camille).** Produces the monthly BA 600 large-exposure return in SARB-published schema from LEX utilisation events. Discharge: `Ba600ReturnGenerated { reportingPeriod }` event; recon `recon:ba600-schema-validation` green.
- **Connected-counterparty-group register (Imani).** Typed register of counterparty groups under the D3/2022 interdependence test, maintained as `ConnectedCounterpartyGroupUpdated` events. Discharge: at least one synthetic group registered with three constituent counterparties.

### 10.2 Procedures planned but not yet authored

- `Procedures/by-policy/credit-risk-limit-management.md` — authority matrix, sub-limit schedule, breach procedure.
- `Procedures/by-policy/ecl-stage-projection-refresh.md` — quarterly ECL model-run procedure.
- `Procedures/by-policy/collateral-haircut-schedule.md` — eligible collateral list and haircut schedule.
- `Procedures/by-policy/failed-trade-management.md` — failed-trade escalation and buy-in process.
- `Procedures/by-policy/lex-exception-process.md` — PA approval pathway for LEX cap exceptions per D3/2022.

### 10.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani + external counsel ratify at the licence-application gate:

1. Reg 38 sub-clause indices for credit-risk management governance.
2. LEX Directive D3/2022 — precise notification-deadline provision for LEX cap breaches; exempt-exposure schedule reference; interdependence-test provision for connected counterparty groups.
3. BCBS SA-CCR — precise document reference, α parameter section, SWWR add-on provision, PFE multiplier floor reference.
4. BCBS SFT haircut table reference for eligible collateral haircuts.
5. BCBS 346 (April 2019 large-exposures standard) — final standard reference and Tier 1 capital definition for LEX purposes.
6. IFRS 10 control definition cross-reference for connected-counterparty-group determination.
7. Regulations Relating to Banks — settlement-risk capital provision reference.

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Initial policy authored. Ten sections: (1) Overarching Policy — Banks Act + Reg 38 + D3/2022 + BCBS SA-CCR citations, nine principles (institutional-only scope, LEX floor, credit-quality floor, netting primacy, collateral, concentration, events-first, model validation, WWR), roles, three-severity breach taxonomy; (2) LEX Regime — D3/2022 full treatment, single-counterparty cap, connected-counterparty groups, exempt-exposure schedule, internal sub-limits, BA 600 monthly return, daily utilisation monitoring; (3) CCR Standards and Limits — SA-CCR methodology (RC + PFE + EAD computation), ISDA/GMRA netting requirements, CSA terms, eligible collateral, haircut framework, credit-risk-appetite limit schedule (investment-grade floor, sub-IG BRC approval, sector and geographic limits); (4) IFRS 9 ECL Governance — Stage 1/2/3 framework, SICR triggers, write-off process, ECL model components (PD/LGD/EAD), forward-looking scenarios, quarterly refresh, model validation, PA D3/2023 regulatory treatment; (5) Settlement Risk — DVP standard, CLS FX settlement risk mitigation, failed-trade management, settlement-risk capital; (6) Wrong-Way Risk — SWWR/GWWR distinction, SWWR identification process, capital add-on, portfolio SWWR limit (5% of total EAD); (7) Governance and Monitoring — CRC charter, authority matrix, daily/monthly/quarterly/annual reporting cadence; (8) Exceptions and Escalation — documentation, time limits, PA notification, remediation, Vera audit; (9) Obligations closure table: ORG-PR-09, ORG-PR-10, ORG-PR-16, ORG-PR-19 (partial), ORG-PR-40; (10) Substrate dependencies, planned procedures, and citation gaps explicitly named per Principle 2. COMMENCEMENT-BIND. Identity discipline per CLAUDE.md "Dispatch discipline" observed throughout. |
