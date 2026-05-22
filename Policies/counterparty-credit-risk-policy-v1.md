---
policy-id: counterparty-credit-risk-policy
title: Counterparty Credit Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Regulations Relating to Banks reg.32 (CCR capital)
  - BCBS SA-CCR standard (March 2014; revised April 2019)
  - BCBS CVA risk framework (July 2020)
  - ISDA Credit Support Annex (CSA)
  - ISDA Master Agreement (2002)
  - FSCA OTC derivatives reporting obligations (under FMA and FSCA Conduct Standard)
  - Banks Act 94 of 1990
author: Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-22
summary: Counterparty Credit Risk Policy covering SA-CCR as the capital methodology (EAD = alpha × (RC + PFE)), replacement cost, PFE aggregation, netting set definition, margin period of risk, eligible collateral under CSA, wrong-way risk, CCR limits, CVA capital, bilateral vs centrally cleared treatment, CCP margin, close-out netting enforceability. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-MR
  - RT-CCR
---

# Counterparty Credit Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Rohan (Market risk quantitative engineer, engineering) — co-author.
> **Status.** COMMENCEMENT-BIND. CCR arises from the first OTC derivative trade; the full CCR framework is required from commencement of trading.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Counterparty Credit Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on new product type, new counterparty category, or material regulatory change · **Citation:** Regulations Relating to Banks reg.32 (CCR capital) + BCBS SA-CCR (March 2014, revised April 2019) + BCBS CVA risk framework (July 2020)

### Purpose

This policy governs how Hoz Bank Limited identifies, measures, manages, and capitalises counterparty credit risk (CCR). CCR is the risk that a counterparty to a derivative, repo, or securities financing transaction defaults before the final settlement of the transaction's cashflows. Unlike conventional credit risk (where the exposure is fixed), CCR exposure changes over time as market rates move; the Bank may be in-the-money or out-of-the-money depending on the mark-to-market value of the transaction.

The policy ensures that: (i) CCR capital is computed under the SA-CCR methodology (the BCBS standard and reg.32 requirement for the Bank's operational scale); (ii) netting sets are governed by executed ISDA Master Agreements before any OTC derivative trade; (iii) eligible collateral under CSA agreements is managed to reduce the CCR Exposure at Default (EAD); (iv) wrong-way risk (where counterparty credit quality and exposure size are correlated) is identified and managed; (v) CVA capital is computed under the CVA risk framework as part of the market risk capital framework (`Policies/market-risk-policy-v1.md` §5); and (vi) CCR limits govern the Bank's aggregate exposure to each counterparty.

### Principles

- **SA-CCR as the regulatory capital methodology.** The Standardised Approach for Counterparty Credit Risk (SA-CCR) per BCBS (March 2014, revised April 2019) and reg.32 is the Bank's CCR capital methodology. EAD = alpha × (RC + PFE) where alpha = 1.4 (the regulatory scalar), RC = Replacement Cost, and PFE = Potential Future Exposure. The Internal Models Method (IMM) is aspirational; it requires PA model approval and is not planned for the initial operating period.
- **ISDA Master Agreement as the prerequisite for netting.** No OTC derivative is traded with a counterparty that has not executed an ISDA Master Agreement (2002 form) with the Bank. Without an executed ISDA agreement, netting is not legally enforceable; the CCR capital must be computed on a gross (not net) basis, which is capital-inefficient. Imani (Legal-as-code engineer, engineering) maintains the netting set register and confirms enforceability before any net CCR computation.
- **Events-first CCR.** Every CCR measurement cycle produces typed events: `CcrExposureComputed { nettingSetId, date, rc, pfe, ead, cvaCapital }`. The CCR limit register and exposure history are queries over those events. No manual spreadsheet is the canonical CCR record.
- **Wrong-way risk is proactively identified.** Wrong-way risk (specific or general) — where the Bank's CCR exposure to a counterparty increases at the same time as the counterparty's credit quality deteriorates — is flagged by Rohan's wrong-way risk monitoring system. Specific wrong-way risk (e.g., a counterparty in the same sector as a reference entity on a CDS the Bank has sold to that counterparty) triggers a mandatory ALCO discussion.
- **CCR limits are independent of credit risk limits.** CCR limits (this policy) and credit risk limits (`Policies/credit-risk-policy-v1.md`) are calibrated and monitored separately; CCR limits cover mark-to-market exposure on derivatives, while credit risk limits cover funded credit exposure. The aggregate of both is subject to the large exposure limit under `Policies/concentration-risk-policy-v1.md` §2.

### Roles

Helena (Chief Risk Officer, governance) is the policy owner. She is responsible for: owning the CCR framework and limit structure; approving the CCR methodology elections; reviewing wrong-way risk reports; escalating material breaches to the CEO. Rohan (Market risk quantitative engineer, engineering — reports to Helena) builds and operates the SA-CCR engine, the CVA calculation, and the wrong-way risk monitoring system. Imani (Legal-as-code engineer, engineering — reports to Helena) maintains the ISDA netting set register, confirms enforceability of ISDA agreements and CSA terms, and flags close-out netting risk. Camille (Chief Financial Officer, governance) integrates CCR RWA into the BA-return suite (BA-332 CCR capital). Owen (Company Secretary, governance) manages ISDA agreement execution and filing.

---

## 2. SA-CCR Methodology

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) for methodology; PA for any IMM election · **Cadence:** Daily CCR computation; monthly BA-return; quarterly ICAAP integration · **Citation:** BCBS SA-CCR (March 2014, revised April 2019) + Regulations Relating to Banks reg.32

### 2.1 EAD Calculation

The SA-CCR EAD is computed per netting set:

```
EAD = alpha × (RC + PFE)
```

Where:
- **alpha = 1.4** (the regulatory scalar per BCBS SA-CCR).
- **RC (Replacement Cost):** the current mark-to-market value of the netting set (net, where an ISDA agreement is in place; gross, where no ISDA). For margined netting sets, RC is reduced by the collateral held under the CSA, subject to the Minimum Transfer Amount and the Independent Amount.
- **PFE (Potential Future Exposure):** the potential increase in exposure over the Margin Period of Risk (MPoR), calculated using the SA-CCR PFE aggregation methodology — the sum of risk-class-level add-ons (interest rate, FX, credit, equity, commodity), aggregated across risk classes using the BCBS SA-CCR correlation framework.

### 2.2 Replacement Cost (RC)

**Unmargined netting sets:** RC = max(V − C, 0) where V = current MTM of the netting set and C = collateral posted net of collateral received.

**Margined netting sets (with CSA):** RC = max(V − C, TH + MTA − NICA, 0) where TH = threshold, MTA = minimum transfer amount, NICA = net independent collateral amount (independent amount posted by the counterparty net of independent amount posted by the Bank).

### 2.3 Potential Future Exposure (PFE) Aggregation

PFE is computed per netting set as the aggregated add-on across risk classes:

```
PFE = multiplier(V, C) × AddOn_aggregate
```

Where `multiplier` is the BCBS SA-CCR floor function that prevents the PFE from falling below a floor when the netting set is out-of-the-money, and `AddOn_aggregate` is the sum of risk-class add-ons (IR, FX, Credit, Equity, Commodity) per the SA-CCR correlation and aggregation rules.

Rohan's SA-CCR engine computes the add-ons for each risk class using the regulatory prescribed supervisory factors, correlation parameters, and maturity adjustments from the BCBS SA-CCR standard. The engine is calibrated to the Bank's OTC IRD product set (primary risk class: IR; secondary: FX).

---

## 3. Netting Sets and ISDA Requirements

**Owner:** Helena (Chief Risk Officer, governance) · **Imani (Legal-as-code engineer, engineering)** — netting set register; ISDA enforceability · **Approval:** Eitan and Helena approve any netting set structure · **Cadence:** Netting set register reviewed monthly; ISDA enforceability confirmed before each new counterparty's first trade · **Citation:** ISDA Master Agreement (2002); BCBS SA-CCR (2019) — netting set definition and requirements; Imani's ISDA legal opinion programme

### Netting Set Definition

A netting set is a group of transactions with a single counterparty that are governed by a legally enforceable bilateral close-out netting agreement (the ISDA Master Agreement). All transactions within a netting set are netted upon default: only the net claim (if the Bank is in-the-money) or net obligation (if the Bank is out-of-the-money) constitutes the CCR exposure.

**Key conditions for netting set treatment:**
1. An executed ISDA Master Agreement (2002 form) must be in place with the counterparty.
2. The ISDA agreement must be enforceable under the counterparty's local law (Imani maintains legal opinions for each jurisdiction of counterparty incorporation; `Policies/securities-financing-policy-v1.md` §2.1 cross-reference).
3. The Bank must have legal evidence of the right to terminate and net-out all transactions in the netting set simultaneously upon counterparty default.
4. The CSA (if applicable) must be reviewed for consistency with the ISDA Master Agreement terms.

Transactions with counterparties for which no enforceable ISDA agreement exists are capitalised on a gross basis. A `NettingSetRegistered { counterpartyId, isda MasterAgreementRef, jurisdiction, enforceabilityOpinionRef, effectiveDate }` event is the canonical record of each netting set activation.

### Margin Period of Risk

For margined netting sets, the Margin Period of Risk (MPoR) determines the time horizon over which the CCR exposure can grow before margin calls are fully satisfied. Per BCBS SA-CCR:
- **Standard MPoR:** 10 business days for OTC derivatives with daily margining.
- **Extended MPoR:** 20 business days for netting sets with more than 5,000 trades; or for netting sets subject to disputed margin calls in the prior 12 months.

Rohan assigns the MPoR to each netting set and stores it as a `NettingSetMporUpdated { nettingSetId, mpor, basis }` event.

---

## 4. Eligible Collateral Under CSA

**Owner:** Helena (Chief Risk Officer, governance) · **Imani (Legal-as-code engineer, engineering)** for CSA terms · **Approval:** Helena approves eligible collateral types; Eitan for cash collateral management · **Citation:** ISDA CSA (2016 variation margin protocol or equivalent); BCBS SA-CCR (2019) — eligible collateral; `Policies/collateral-management-policy-v1.md`

Collateral received under a CSA reduces the RC component of the SA-CCR EAD. Only the following instruments are eligible as CCR collateral under the Bank's CSA agreements:

| Collateral type | SA-CCR haircut | Conditions |
|---|---|---|
| ZAR cash (SARB clearing account) | 0% | No haircut; most preferred |
| SA Government Bonds (SAGBs) | 0.5% (residual maturity ≤ 1 year); 2% (1–5 years); 4% (> 5 years) | Per BCBS SA-CCR supervisory haircuts |
| Hard currency cash (USD, EUR, GBP) | 8% FX haircut | Excon approval required for FX cash holding |
| Eligible money market instruments (T-Bills, CP rated P-1/A-1) | Residual maturity haircut per BCBS table | ALCO approval required for CP |

Non-eligible collateral (e.g., equities, non-government bonds, illiquid instruments) is not accepted as CCR collateral. Imani confirms CSA eligibility terms before execution. Collateral management is governed by `Policies/collateral-management-policy-v1.md`.

---

## 5. Wrong-Way Risk

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** ALCO for any wrong-way risk position above the threshold · **Cadence:** Daily general WWR monitoring; ad hoc specific WWR flagging · **Citation:** BCBS SA-CCR (2019) — wrong-way risk treatment; BCBS Basel III (2010) — specific wrong-way risk

### General Wrong-Way Risk

General wrong-way risk (GWWR) arises when the exposure at default is positively correlated with the general credit quality of the counterparty due to macro factors (e.g., the Bank's IRS portfolio with a bank counterparty may be positively correlated with that counterparty's credit quality during a rates downturn). Rohan monitors GWWR by running stress scenarios on the netting set portfolios under adverse rate/credit conditions. GWWR is reported to ALCO quarterly.

### Specific Wrong-Way Risk

Specific wrong-way risk (SWWR) arises when the Bank has a derivative transaction whose reference entity is closely related to the counterparty (e.g., the Bank has sold CDS protection on a reference entity that is the counterparty itself, or an affiliate). SWWR is an automatic breach flag in Rohan's monitoring system. Any SWWR identification triggers: (i) immediate notification to Helena; (ii) mandatory ALCO review within 5 business days; (iii) an `SpecificWrongWayRiskIdentified { counterpartyId, transactionId, referenceEntity, correlation }` event in the event log. Helena may require the SWWR position to be unwound or hedged.

---

## 6. CCR Limit Governance

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Helena and CEO for new CCR limits; ALCO for utilisation monitoring · **Cadence:** Daily limit monitoring; monthly ALCO review · **Citation:** `Policies/concentration-risk-policy-v1.md` (aggregate large exposure); BCBS large exposures framework (April 2014)

CCR limits are set per counterparty (netting set level) and expressed as maximum EAD under normal market conditions. The limit structure is maintained in `Procedures/by-policy/ccr-limit-monitoring.md`. Key governance rules:

- **CCR limits are set before the first trade.** No OTC derivative is executed with a counterparty that does not have an approved CCR limit in the limit register.
- **CCR EAD + credit exposure ≤ large exposure limit.** The sum of the CCR EAD and any funded credit exposure to the same counterparty must not exceed the large exposure limit under `Policies/concentration-risk-policy-v1.md` (25% of qualifying capital or the internal 20% management trigger).
- **Limit breach escalation.** A CCR EAD exceeding 80% of the approved limit triggers an amber alert (Helena notified, desk head notified). A breach of the approved CCR limit is a hard breach; ALCO is convened within 1 business day; the position is reduced or the limit increased (CEO approval required for limit increase).

All CCR limit breach events are recorded as `CcrLimitBreached { counterpartyId, nettingSetId, ead, limit, escalationPath }` events.

---

## 7. Centrally Cleared vs Bilateral OTC Derivatives

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Eitan and Helena for clearing arrangements · **Cadence:** Annual review of clearing strategy; triggered on new clearing mandate from FSCA · **Citation:** BCBS SA-CCR (2019) — CCP treatment; Banks Act 94 of 1990 + FSCA OTC derivatives clearing mandate

### Centrally Cleared Transactions

Transactions cleared through a qualifying central counterparty (QCCP) receive preferential CCR capital treatment under SA-CCR: the trade exposure to a QCCP attracts a 2% risk weight (per the BCBS framework for banks' exposures to CCPs). The Bank accesses CCPs as an indirect participant (clearing member: one of the Bank's approved clearing members; per the Bank's indirect participant operating posture). Ravi computes the initial margin (IM) and variation margin (VM) requirements for centrally cleared OTC IRD using the CCP's prescribed margin methodology (SPAN or equivalent); initial margin posted to the CCP is treated as a CCR exposure with the clearing member as the counterparty (exposure capped at the IM amount; default fund contributions receive the BCBS-prescribed treatment).

### Bilateral OTC Derivatives

Bilateral (non-cleared) OTC derivatives are capitalised under the full SA-CCR framework (§2). The Bank's trading mandate (`Policies/trading-mandate-v1.md`) limits the types of bilateral OTC derivatives to standard ZAR-denominated IRS and cross-currency swaps where no clearing mandate is in force. Exotic OTC derivatives that attract higher CCR PFE add-ons require prior Helena approval and a product-level CCR assessment before trading.

---

## 8. Substrate Dependencies and Gaps

- **SA-CCR engine (Rohan).** Automated SA-CCR EAD computation per netting set: RC, PFE aggregation, multiplier, alpha scaling. Discharge exit signal: `CcrExposureComputed { nettingSetId, date, rc, pfe, ead }` event on daily schedule.
- **Netting set register (Imani + Rohan).** Legal opinion coverage for all active counterparty jurisdictions. Currently being built; required before the first OTC trade.
- **Wrong-way risk monitor (Rohan).** Automated SWWR flag and GWWR stress runner. Discharge exit signal: daily GWWR report event; SWWR flag event on identification.
- **CVA-SA engine (Rohan).** Integrated with `Policies/market-risk-policy-v1.md` §5; discharges under that policy.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Initial policy authored. Seven sections: (1) Overarching — SA-CCR methodology, ISDA prerequisite, events-first CCR, wrong-way risk identification, CCR vs credit risk limit distinction; (2) SA-CCR Methodology — EAD formula, RC (margined and unmargined), PFE aggregation with multiplier; (3) Netting Sets and ISDA — netting set definition, enforceability conditions, MPoR; (4) Eligible Collateral — haircut table, ineligible collateral; (5) Wrong-Way Risk — general (macro) vs specific (reference entity) WWR; (6) CCR Limit Governance — pre-trade limit requirement, large exposure interaction, breach escalation; (7) Centrally Cleared vs Bilateral — QCCP treatment, indirect participant access, bilateral bilateral OTC constraints. COMMENCEMENT-BIND. |
