---
riskTaxonomy:
  - RT-CR
  - RT-LQ
  - RT-LQ.FN
  - RT-IRRBB
  - RT-ST.EV
  - RT-LR.RC
---

# Core policies — Finance, accounting, tax, treasury

**Authors:** Camille (CFO — lead, finance); Eitan (Treasurer — lead, treasury); Bea, Yael, Ravi (engineering)
**Reviewed by:** Helena, Devon, Saskia, Owen, Vera
**Date:** 2026-05-06
**For:** Marc (CEO) — for inclusion in the next decision pack as Board-route approvals.

---

## 1. Capital Management Policy

**Owner:** Camille · **Approval:** Board (via BRC) · **Cadence:** Annual · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks; BCBS Basel III/IV; SARB PA capital framework.

### Purpose
The bank manages capital adequacy above regulatory minima, with planned headroom for stress, growth, and capital actions.

### Principles
- **Capital buffer floor (B2 deferred — pending calibration):** policy floor at PA min + Pillar 2A + capital conservation buffer + 1.5pp management buffer in CET1; trigger and escalation thresholds per RAS / RAF §B3.
- Capital is managed as a forward-looking quantity through the **Capital Plan** (separate, Board-approved); plan revised annually and on material change.
- Capital instrument issuance (AT1, T2) is Board-reserved.
- Dividend capacity is calibrated against capital plan; subject to SARB approval where required.
- Capital is a query over the event log; no parallel capital ledger.
- ICAAP (separate, Board-approved) is the integrative document tying capital, risk, and stress.

### Roles
Camille owns; Helena co-owns ICAAP; Bea engineers RWA and capital projections; Eitan co-owns capital-instrument issuance; Vera audits.

### Breach
CET1 ratio breach below trigger is a Critical event with mandatory action; below escalation, BRC + Board.

#### Pre-board review
- **Proposer:** Camille.
- **Challenged by:** Helena (capital-and-risk consistency); Eitan (capital-instrument execution feasibility); Vera (ratio-attestation testability); Owen (Board-pathway clarity for issuance).
- **Iteration:** minor — added explicit dividend-capacity language.
- **Status:** Ready ✓ (B2 calibration pending).

---

## 2. Accounting Policies (IFRS)

**Owner:** Camille (with Bea) · **Approval:** AC + Board · **Cadence:** Annual · **Citation:** IFRS 9 (financial instruments); IFRS 7 (disclosures); IFRS 13 (fair value); IFRS 15 (revenue); IFRS 16 (leases); IAS 1, IAS 12, IAS 21.

### Purpose
The bank reports under IFRS as adopted in South Africa. This policy sets the bank's accounting positions where IFRS allows judgement, and the close discipline that produces the financial statements.

### Principles
- The general ledger is a projection over the event log (Principle 1); no parallel finance ledger.
- IFRS 9 classification (amortised cost / FVOCI / FVTPL) is determined at recognition based on business model and SPPI test; documented per portfolio.
- IFRS 9 ECL governance is a separate Provisioning Policy under Helena and Bea.
- Hedge accounting (carryover IAS 39 election) under a separate Hedge Accounting Policy.
- Revenue recognition follows IFRS 15 with explicit transaction-price allocations.
- Functional currency is ZAR; presentation currency is ZAR; foreign-currency translation under IAS 21.
- The close is event-driven; reconciliation harnesses run in CI: GL ↔ event-derived balance ↔ sub-ledger projection must reconcile to zero before any sign-off.

### Roles
Camille signs financial statements; Bea engineers; Anya owns the projection runtime; Vera and the External Auditor audit.

### Breach
Material misstatement is a zero-tolerance line under the RAS (B1 approved). Restatements are events with full lineage and AC notification.

#### Pre-board review
- **Proposer:** Camille (with Bea).
- **Challenged by:** Helena (IFRS 9 ECL governance seam); Anya (projection-CI reconciliation feasibility); Vera (External Auditor interface); Owen (AC-pathway).
- **Iteration:** minor — added explicit reconciliation-harness CI gate.
- **Status:** Ready ✓

---

## 3. Tax Policy

**Owner:** Yael (under Camille) · **Approval:** AC · **Cadence:** Annual · **Citation:** Income Tax Act 58 of 1962; VAT Act 89 of 1991; Tax Administration Act 28 of 2011; SARS practice; OECD TP Guidelines.

### Purpose
The bank is tax-compliant and pays the right amount of tax in the right jurisdiction at the right time, transparently.

### Principles
- The bank pays tax in line with the **substance** of activities; aggressive tax planning is outside appetite.
- Tax positions are documented per material judgment; uncertain tax positions per IFRIC 23 are disclosed.
- VAT financial-services apportionment per SARS practice; methodology approved annually.
- Transfer pricing follows OECD principles even where SA TP rules technically don't reach (consistency with multi-entity readiness, P5).
- FATCA and CRS reporting under SARS BRS; classifications captured at onboarding (per client-master design).
- SARS engagement is a typed workflow; voluntary-disclosure mechanism reserved for material discovery.

### Roles
Yael owns; Camille is signed Public Officer; Bea co-engineers tax data; Mira co-engineers FATCA/CRS classification.

### Breach
Material tax non-compliance is a Critical event with AC + CEO + Board notification.

#### Pre-board review
- **Proposer:** Yael (with Camille).
- **Challenged by:** Helena (compliance-risk dimension); Bea (sub-ledger feed); Mira (FATCA/CRS classification accuracy); Vera (tax-position audit-trail).
- **Iteration:** minor — added explicit anti-aggressive-planning language.
- **Status:** Ready ✓

---

## 4. Provisioning / IFRS 9 ECL Policy

**Owner:** Helena (with Bea) · **Approval:** BRC + AC · **Cadence:** Annual · **Citation:** IFRS 9; SARB PA guidance on ECL.

### Purpose
ECL governance — staging, model selection, scenarios, post-model adjustments, governance of overlays.

### Principles
- ECL models follow the Model Risk Policy three-tier framework (B7 approved); IFRS 9 ECL is Tier 1.
- Stage migration based on significant-increase-in-credit-risk (SICR) criteria documented per portfolio.
- Forward-looking macroeconomic scenarios from the Stress Testing programme; weights approved by BRC.
- Post-model adjustments and overlays are typed events with explicit rationale; reviewed by AC.
- Stage and ECL are projections; reproducible at any past as-of date.

### Roles
Helena governs; Rohan develops models; Bea integrates into the sub-ledger; independent validation by Helena's validation function.

### Breach
Material ECL re-statement or stage-migration mis-application is Critical; AC + Board notification.

#### Pre-board review
- **Proposer:** Helena (with Bea).
- **Challenged by:** Camille (FS-impact of overlays); Rohan (model independence); Vera (validation testability).
- **Iteration:** minor — clarified overlay-event documentation.
- **Status:** Ready ✓

---

## 5. Funding Strategy Policy

**Owner:** Eitan · **Approval:** ALCO + BRC · **Cadence:** Annual · **Citation:** Banks Act; BCBS 144; SARB PA liquidity directives.

### Purpose
The bank's funding posture — sources, tenor, currency, counterparty diversity — within the Liquidity Risk Management Policy.

### Principles
- **Textured funding** by design: wholesale + deposit + capital; no thin reliance on any single counterparty or tenor.
- Deposit-funding strategy aligns with TCF and product-design discipline (no tricks to attract sticky deposits).
- Wholesale funding diversified across counterparties; concentration limits per RAS.
- Currency mix matches asset profile to the extent reasonable; mismatches resolved via FX swaps under the Treasury hedging discipline.
- Contingency Funding Plan (CFP) tested annually; trigger events typed.
- Inter-bank funding is operational, not strategic — the bank prefers structural sources.

### Roles
Eitan owns; Ravi engineers; ALCO oversees; BRC challenges.

### Breach
Funding-concentration breach or CFP-trigger event is escalated to ALCO immediately and BRC.

#### Pre-board review
- **Proposer:** Eitan.
- **Challenged by:** Helena (liquidity-appetite consistency); Camille (capital-funding seam); Saskia (wholesale-counterparty execution); Vera (CFP-rehearsal evidence).
- **Iteration:** minor — added inter-bank-vs-structural language.
- **Status:** Ready ✓

---

## 6. FTP Methodology Policy

**Owner:** Eitan (with Camille and Helena) · **Approval:** ALCO · **Cadence:** Annual · **Citation:** Internal — implements RAS and Liquidity Risk Management Policy.

### Purpose
Funds Transfer Pricing attaches a transfer-priced cost-of-funds to every product event so margin attribution is exact.

### Principles
- Multi-curve FTP: base curve (ZARONIA-first; JIBAR fall-back), liquidity premium, behavioural adjustments, basis adjustments.
- FTP attached to **every product event** at booking — no products without FTP.
- Behavioural assumptions for non-maturity deposits documented and reviewed quarterly.
- FTP is an internal price; it does not influence external customer pricing directly but is a major input to Pricing Policy.
- Methodology change requires ALCO approval and AC awareness for FS impact.

### Roles
Eitan owns; Ravi engineers; Camille signs accounting interpretation; Helena co-owns appetite alignment; Niko consumes for product pricing.

### Breach
FTP missing on product events is a Critical engineering bug requiring change-management remediation.

#### Pre-board review
- **Proposer:** Eitan.
- **Challenged by:** Camille (FS / FTP accounting); Helena (RAS consistency); Niko (commercial-pricing implications); Anya (event-level FTP feasibility).
- **Iteration:** minor — added "no products without FTP" language.
- **Status:** Ready ✓

---

## 7. Hedge Accounting Policy

**Owner:** Eitan (with Camille) · **Approval:** AC · **Cadence:** Annual · **Citation:** IFRS 9 hedge accounting (with permitted IAS 39 carryover).

### Purpose
Sets the bank's hedge-accounting election and discipline — designation, effectiveness testing, documentation.

### Principles
- The bank elects **IFRS 9** hedge accounting (CEO decision F1, 2026-05-06), applied consistently bank-wide. The election is one-way; IAS 39 carryover is not used.
- Hedge designation is at-inception, documented; discontinuation events are typed.
- Effectiveness testing is automated and run continuously; ineffectiveness is recognised in P&L per standard.
- Hedge documentation is auditable; hedge events feed the projection.

### Roles
Eitan executes hedges; Camille signs accounting position; Bea engineers; Vera audits.

### Breach
Loss of hedge-accounting designation due to documentation or effectiveness failure is a registered event with AC notification.

#### Pre-board review
- **Proposer:** Eitan + Camille.
- **Challenged by:** Bea (sub-ledger feed); Vera (designation-evidence testability); Helena (residual market-risk implications).
- **Iteration:** election resolved — CEO selected **IFRS 9** (decision F1, 2026-05-06).
- **Status:** **Ready ✓ — IFRS 9 elected, in force.**

---

## 8. Collateral Management Policy

**Owner:** Eitan (with Saskia) · **Approval:** ALCO + BRC · **Cadence:** Annual · **Citation:** BCBS; ISDA / GMRA / GMSLA market practice; SARB facilities documentation.

### Purpose
The bank's posture on collateral — eligibility, valuation, optimisation, dispute, default.

### Principles
- Eligible collateral is enumerated per use (CSA, GMRA, central counterparty, SARB facility); haircuts defined per asset class.
- Valuation is daily; disputes are typed events with timed resolution.
- Re-hypothecation rules per CSA terms; bank position on re-hypothecation transparent in counterparty negotiations.
- Concentration limits per asset class and counterparty.
- HQLA portfolio is collateralised where required; turnover via Saskia.

### Roles
Eitan owns; Saskia executes; Imani drafts CSAs / GMRAs; Anya engineers daily valuation projection; Vera audits.

### Breach
Collateral mis-valuation or unauthorised re-hypothecation is a Critical event.

#### Pre-board review
- **Proposer:** Eitan (with Saskia).
- **Challenged by:** Imani (CSA-enforceability opinion); Camille (FS-impact of collateral movements); Vera (valuation-attestation testability).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## Bundle status

| # | Policy | Status |
|---|---|---|
| 1 | Capital Management Policy | **Ready ✓** (B2 calibration pending) |
| 2 | Accounting Policies (IFRS) | **Ready ✓** |
| 3 | Tax Policy | **Ready ✓** |
| 4 | Provisioning / IFRS 9 ECL Policy | **Ready ✓** |
| 5 | Funding Strategy Policy | **Ready ✓** |
| 6 | FTP Methodology Policy | **Ready ✓** |
| 7 | Hedge Accounting Policy | **Ready ✓ subject to IFRS 9 vs IAS 39 carryover election** |
| 8 | Collateral Management Policy | **Ready ✓** |

All eight pre-board-reviewed and ready for the next decision pack. The Hedge Accounting Policy carries one flagged election for the CEO.
