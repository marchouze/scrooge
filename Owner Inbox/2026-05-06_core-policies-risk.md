---
riskTaxonomy:
  - RT-CR
  - RT-MK
  - RT-LQ
  - RT-OP
  - RT-OP.RE
  - RT-OP.MD
---

# Core policies — Risk

**Author:** Helena (CRO — lead) · Rohan (engineering)
**Reviewed by:** Camille, Devon, Eitan, Saskia, Zara, Senna, Vera
**Date:** 2026-05-06
**For:** Marc (CEO) — for inclusion in the next decision pack as Board-route approvals.

> **Derivation note (Principle 6).** Each policy in this bundle sits at the *policy* layer. It cites the regulatory or standard authority that creates the obligation. Standards (technical specs) and processes (coded workflows) derive from these policies. Live limits, breaches, and decisions are *data*. Pre-board reviews per policy follow the same convention as B1–B9 in the prior decision pack.

---

## 1. Risk Management Framework (RMF)

**Owner:** Helena · **Approval:** Board · **Cadence:** Annual · **Citation:** Banks Act; BCBS Corporate Governance Principles for Banks; King IV.

### Purpose
The RMF sets out *how* the bank identifies, measures, manages, monitors, and reports risk across the full taxonomy. It is the operating manual that sits between the RAS (what risk we accept) and the individual risk-domain policies (how each kind of risk is run).

### Principles
- Risk is an explicit category of decision-making at every level — appetite (Board), policy (CRO), limits (BRC), execution (first line), assurance (third line).
- The risk taxonomy is canonical: credit, market, liquidity & funding, IRRBB, operational (incl. cyber, third-party, model), conduct, financial crime, legal, regulatory, strategic, reputational, climate.
- Every risk has a named **owner** (first line), a named **second-line challenger**, and a position in the obligations register.
- Risk identification is continuous; emerging-risk register is a standing BRC item.
- Measurement is event-sourced (P1) with as-of replay; no parallel risk ledgers.
- Reporting is generated, not assembled (P6).

### Roles
First line build & operate within appetite. Second line (Helena, Zara, Iris) holds policy and challenges. Third line (Vera, future CAE) assures independently. ALCO, BRC, AC are the standing fora.

### Breach
Breach of the RMF (failure to identify, measure, or report) is a registered event escalated to the BRC. Material recurrence is a Board matter.

#### Pre-board review
- **Proposer:** Helena (with Rohan).
- **Challenged by:** Devon (operational dimension consistency); Camille (financial-reporting integration); Zara (compliance dimension); Vera (assurance hooks).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## 2. Credit Risk Policy

**Owner:** Helena · **Approval:** BRC · **Cadence:** Annual · **Citation:** Banks Act; BCBS large-exposures framework; IFRS 9.

### Purpose
Sets the bank's position on credit-risk taking — origination, measurement, concentration, provisioning, workout — within the RAS.

### Principles
- Credit is taken only on counterparties whose ability and willingness to pay is independently assessed.
- Single-name large-exposure capped below the BCBS regulatory ceiling; sector concentration ≤25% without explicit BRC approval (B8 approved); SA-majority by design.
- IFRS 9 ECL governance under a separate Provisioning Policy; stage-migration tolerances calibrated against earnings.
- New-product credit risk passes a New Product Approval gate before booking.
- Counterparty-credit risk in markets is governed via Helena+Saskia under the Counterparty Credit Risk Policy.
- Workout & recovery is a typed workflow with documented decisions; collateral realisation events are auditable.

### Roles
Origination by future Head of Credit (currently first-line via the operating model); independent assessment by second line; independent challenge by Vera. Limit framework owned by BRC.

### Breach
Limit breaches are typed events with severity (Soft / Hard / Critical) and prescribed escalation. Closure requires either restoration or a register-linked variance approved at the right authority.

#### Pre-board review
- **Proposer:** Helena.
- **Challenged by:** Camille (capital impact); Saskia (counterparty-credit overlap); Vera (limit-framework testability).
- **Iteration:** minor — clarified Counterparty Credit Risk Policy boundary with markets.
- **Status:** Ready ✓

---

## 3. Market Risk Policy

**Owner:** Helena · **Approval:** BRC · **Cadence:** Annual · **Citation:** BCBS Market Risk (FRTB / D352, D457); Banks Act.

### Purpose
Sets the bank's position on market-risk taking through the trading book and market-sensitive banking-book positions.

### Principles
- Trading is **client-driven and franchise** market-making (B5 deferred — pending refined trading mandate). No proprietary risk-taking outside warehoused franchise hedge positions.
- VaR limits per desk; calibrated against franchise size; reviewed monthly until stable, quarterly thereafter.
- Stress losses capped at a fraction of capital buffer (calibration via ICAAP).
- Position concentration and tenor concentration limits per asset class; per-counterparty limits coordinated with credit policy.
- Hedging is the default for residual basis risks; un-hedged behavioural assumptions documented and BRC-approved.
- Risk-not-in-VaR (RNIV) inventory maintained; quarterly add-on calibration.

### Roles
Saskia (Markets) takes the risk within limits. Helena sets the limits and challenges. Rohan engineers the measurement. Eitan executes treasury hedges; Camille reports book P&L.

### Breach
VaR / sensitivity / concentration breaches are typed events; immediate notification to Helena and CRO; escalation per breach taxonomy.

#### Pre-board review
- **Proposer:** Helena (with Saskia).
- **Challenged by:** Camille (P&L volatility implications); Eitan (hedge-execution capacity); Vera (limit testability); Zara (market-abuse seam).
- **Iteration:** minor — clarified RNIV add-on cycle.
- **Status:** Ready ✓ (note: Trading Mandate (B5) under separate refinement).

---

## 4. Liquidity Risk Management Policy

**Owner:** Helena + Eitan · **Approval:** BRC + Board · **Cadence:** Annual · **Citation:** BCBS D295 (LCR); BCBS D335 (NSFR); BCBS 144; BCBS 248 (intraday); Banks Act.

### Purpose
Sets the bank's liquidity-risk posture — funding strategy, ratios, intraday discipline, contingency funding plan.

### Principles
- Stable, **textured funding**: wholesale + deposit + capital, no thin reliance on any single counterparty or tenor.
- LCR / NSFR buffer floors (B2 deferred — pending calibrated specifics): policy floor at PA min + 20pp / +15pp respectively (until ICAAP/ILAAP-calibrated values supersede).
- Intraday liquidity discipline at SAMOS-funding scale; zero-tolerance for end-of-day overdraft except under the Contingency Funding Plan (CFP).
- HQLA composition reviewed quarterly; concentration limits per HQLA category.
- Significant-currency LCR monitored separately; mismatches resolved via FX swaps within the Treasury policy.
- CFP rehearsed annually; trigger events typed and pre-positioned.

### Roles
Eitan operates within Helena's appetite. Ravi engineers measurement. ALCO chaired by Eitan; BRC oversight.

### Breach
LCR / NSFR ratio breaches are Critical-severity events; immediate ALCO + BRC + CEO notification.

#### Pre-board review
- **Proposer:** Helena + Eitan.
- **Challenged by:** Camille (capital-instrument interface); Devon (operational impact of CFP triggers); Vera (rehearsal evidence design).
- **Iteration:** minor — added quarterly HQLA-category concentration review.
- **Status:** Ready ✓ (B2 calibration pending).

---

## 5. Operational Risk Policy

**Owner:** Helena + Devon · **Approval:** BRC · **Cadence:** Annual · **Citation:** BCBS Principles for the Sound Management of Operational Risk (rev. 2021); Banks Act.

### Purpose
Sets the bank's posture on operational-risk identification, measurement, control, and reporting across people, processes, systems, and external events.

### Principles
- Operational risk is the residual of imperfect process; the bank's preference is for *coded* processes (P3) where the risk is bounded and observable.
- Risk-and-control self-assessments (RCSA) are quarterly per domain; outputs are events feeding into the BRC pack.
- Loss events captured per Basel category; threshold for reporting is low; near-misses are reported.
- KRIs cover top operational risks; thresholds are RAS-calibrated.
- Material change passes a change-management gate (separate policy) which itself is a typed control under this policy.
- Third-party operational risk addressed under the Outsourcing Policy.

### Roles
Devon owns the operational running; Helena holds the policy and limits; Vera assures.

### Breach
Material operational-loss events (above threshold) are reported to BRC immediately and to AC for the audit perspective.

#### Pre-board review
- **Proposer:** Helena + Devon.
- **Challenged by:** Senna (cyber-OR seam); Camille (loss-event accounting); Vera (RCSA testability).
- **Iteration:** minor — clarified seam with the Operational Resilience Policy.
- **Status:** Ready ✓

---

## 6. Operational Resilience Policy

**Owner:** Devon (with Helena) · **Approval:** BRC + Board · **Cadence:** Annual · **Citation:** BCBS Principles for Operational Resilience (2021); FSB; Joint Standard 1 of 2024 (cyber dimension).

### Purpose
Ensures the bank can deliver important business services through severe-but-plausible disruption, within stated impact tolerances.

### Principles
- A canonical inventory of **important business services (IBS)** maintained: customer payments, settlement (SAMOS / BankservAfrica), customer authentication, regulatory reporting, statement generation. List reviewed annually.
- Each IBS has an **impact tolerance** (max tolerable disruption duration) and an associated mapping to people, processes, technology, third parties, facilities.
- Severe-but-plausible scenarios tested at least annually per IBS; scenarios cover cyber, third-party, infrastructure, key-person.
- Resilience tests produce events; remediation is tracked through to closure.
- Vulnerabilities below tolerance trigger a remediation plan with BRC visibility.

### Roles
Devon is the named accountable executive (under interim CISO function until CISO hired). Helena holds appetite. Senna engineers cyber dimensions. Tomas owns payments-resilience first-line. Vera assures.

### Breach
Disruption beyond impact tolerance is a Critical event: immediate CEO + CRO notification; Regulator notification under Joint Standard 1 of 2024 if cyber-induced.

#### Pre-board review
- **Proposer:** Devon (with Helena).
- **Challenged by:** Tomas (payments-IBS realism); Senna (cyber-scenario calibration); Iris (POPIA breach interaction); Vera (rehearsal evidence).
- **Iteration:** minor — added settlement-resilience as standing scenario.
- **Status:** Ready ✓

---

## 7. Model Risk Policy

**Owner:** Helena · **Approval:** BRC · **Cadence:** Annual · **Citation:** SR 11-7 / SS 1/23 idiom; BCBS; IFRS 9 ECL; B7 (CEO approved 2026-05-06).

### Purpose
Governs the development, validation, deployment, monitoring, and decommissioning of models used in decisioning, reporting, or risk measurement.

### Principles
- Three-tier model classification (per B7):
  - **Tier 1** — regulatory capital RWA, IFRS 9 ECL, AML monitoring core models. Independent validation pre-deployment + annual revalidation; continuous monitoring.
  - **Tier 2** — pricing engines, risk sensitivities, behavioural deposit models. Independent validation pre-deployment + biennial revalidation.
  - **Tier 3** — operational analytics, customer segmentation, non-decisioning models. Internal review; sample audit.
- **Validators do not also build** (segregation enforced by HR + access control).
- Every model has a model-card: purpose, owner, training data, validation evidence, monitoring metrics, retirement criteria.
- Model performance monitored as projections; drift triggers re-validation.

### Roles
Rohan develops; an **independent validation function** reports to Helena. Vera audits independence.

### Breach
Use of an unvalidated model in a decisioning context is a Critical event; immediate suspension and BRC notification.

#### Pre-board review
- **Proposer:** Helena (with Rohan).
- **Challenged by:** Camille (IFRS 9 ECL governance consistency); Devon (validator-cannot-build segregation operationally); Vera (independence testability).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## 8. Stress Testing Policy

**Owner:** Helena · **Approval:** BRC · **Cadence:** Annual · **Citation:** Banks Act; PA stress-testing guidance; BCBS.

### Purpose
Sets the design, governance, and use of stress tests across capital, liquidity, market-risk, credit-risk, and operational-resilience dimensions.

### Principles
- Stress-testing programme is integrated, not domain-fragmented — capital and liquidity stresses run on consistent scenarios.
- Severities calibrated annually: baseline, adverse, severely adverse; reverse stress tests run on key vulnerabilities (what would break the bank).
- Stress-test results feed ICAAP / ILAAP and inform RAS revisions.
- Climate scenario analysis included from year one (per PA Guidance Note 1 of 2024).
- Stress tests are queries over the event log + scenario inputs; results are events with full lineage.

### Roles
Helena owns the programme. Rohan engineers; Camille and Eitan supply capital and liquidity inputs; Saskia and Mira contribute trading-book and financial-crime perspectives. Independent validation by Helena's validation function.

### Breach
Failure to execute a planned stress test is reportable to BRC; failure of a severely-adverse stress (i.e., the bank fails) is a Board matter.

#### Pre-board review
- **Proposer:** Helena.
- **Challenged by:** Camille (ICAAP integration); Eitan (ILAAP integration); Devon (operational-resilience scenarios); Vera (process testability).
- **Iteration:** minor — added reverse-stress-test cadence.
- **Status:** Ready ✓

---

## Bundle status

| # | Policy | Status |
|---|---|---|
| 1 | Risk Management Framework | **Ready ✓** |
| 2 | Credit Risk Policy | **Ready ✓** |
| 3 | Market Risk Policy | **Ready ✓** (Trading Mandate B5 separately) |
| 4 | Liquidity Risk Management Policy | **Ready ✓** (B2 calibration pending) |
| 5 | Operational Risk Policy | **Ready ✓** |
| 6 | Operational Resilience Policy | **Ready ✓** |
| 7 | Model Risk Policy | **Ready ✓** |
| 8 | Stress Testing Policy | **Ready ✓** |

All eight policies are pre-board-reviewed and ready. Each will appear as a Board-route decision in the next decision pack for CEO approval (on behalf of CEO + interim NEDs).
