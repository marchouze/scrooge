---
policy-id: TAX-POL-01
title: Tax Governance Policy v1
version: "1.0"
status: DRAFT
owner: Yael (Tax & Regulatory Compliance engineer) under Camille (CFO, governance)
effective-from: 2026-05-13
citations:
  - "Income Tax Act 58/1962: s1 (definitions), s9 (source of income), s24J (accrual — interest), s24I (forex gains/losses), s31 (transfer pricing)"
  - "Income Tax Act 58/1962: s8E (hybrid equity instruments), s8EA (third-party backed shares)"
  - "Value-Added Tax Act 89/1991: s2 (financial services exemption), s8 (enterprise definition)"
  - "Securities Transfer Tax Act 17/2007: s2 (imposition), s8 (exemptions)"
  - "FATCA IGA between USA and South Africa, 2014: Art. 2 (information to be obtained and exchanged)"
  - "OECD Common Reporting Standard — SA Regulations GN R. 640 of 2016: reg.2 (due diligence), reg.3 (reporting)"
  - "Tax Administration Act 28/2011: s30 (returns), s46 (requests for information), s223 (voluntary disclosure)"
  - "OECD Transfer Pricing Guidelines 2022: Chapter I (arm's length principle), Chapter V (documentation)"
author: Yael (Tax & Regulatory Compliance engineer)
date: 2026-05-13
summary: "Establishes the bank's tax governance framework covering corporate income tax, capital gains, VAT, STT, withholding taxes, FATCA/CRS reporting, and transfer pricing for inter-entity transactions."
decision-required: false
riskTaxonomy:
  - "TAX-001"
  - "TAX-002"
  - "FIN-003"
obligations-closed:
  - ORG-TX-01
  - ORG-TX-02
  - ORG-TX-03
  - ORG-TX-04
  - ORG-TX-05
  - ORG-TX-06
  - ORG-TX-07
  - ORG-TX-08
  - ORG-TX-09
  - ORG-AC-09
  - ORG-AC-12
  - ORG-FC-15
  - ORG-FC-16
applies-at: CORPORATE-BIND
---

# Tax Governance Policy v1

> **Policy** | TAX-POL-01 v1.0 | Owner: Yael (Tax & Regulatory Compliance engineer) under Camille (CFO, governance) | Status: DRAFT | Effective: 2026-05-13

> **Authors:** Yael (Tax & Regulatory Compliance engineer, engineering — reports to Camille, CFO, governance) as lead author; Camille (CFO, governance) as approving authority; Owen (Company Secretary, governance) as filing authority.
>
> **Obligations closed:** ORG-TX-01 through ORG-TX-09 (direct tax obligations); ORG-AC-09 (CIT provision and deferred tax accounting); ORG-AC-12 (withholding tax accounting); ORG-FC-15 (FATCA withholding agent registration); ORG-FC-16 (CRS reporting to SARS).
>
> **Binding status:** CORPORATE-BIND. These obligations bind from incorporation as a company. The tax governance framework is authored and adopted during the build phase so that the substrate, procedures, and governance structures are production-grade at licence-day. Per `project_rules_bind_at_commencement.md` (memory): banking-specific obligations (STT, certain withholding taxes) apply from commencement-of-trading; CIT, corporate governance, transfer pricing, and FATCA/CRS apply from the CORPORATE-BIND date.

---

## Purpose

This policy establishes the tax governance framework for Hoz Bank Limited and its group entities (Hoz Group Limited, Hoz Securities Limited). It defines the bank's obligations under South African direct and indirect tax legislation, international information-exchange regimes (FATCA and CRS), and the OECD transfer pricing framework. The policy ensures that the bank meets all statutory tax obligations, maintains defensible tax positions, and applies the bank's risk appetite — no aggressive tax planning — consistently across all tax heads.

---

## Principles

1. **Full compliance above planning.** The bank's primary tax objective is full legal compliance. Tax minimisation that conflicts with legislative intent or SARS guidance is prohibited.
2. **Substance over form.** Tax positions must reflect economic substance. Artificial arrangements that lack commercial rationale will not be entered into.
3. **Contemporaneous documentation.** Tax positions, elections, and filings must be documented at the time of transaction or filing, not reconstructed.
4. **Transparency with SARS.** The bank proactively discloses uncertainties via the Voluntary Disclosure Programme (TAA s.223) where material errors are identified.
5. **Single-graph traceability.** Every tax control traces upward to a statutory obligation (Principle 2 — single-graph discipline).
6. **Autonomous execution.** Yael (Tax & Regulatory Compliance engineer, engineering) runs tax-computation and filing routines autonomously on the cadence defined in §5. Camille (CFO, governance) approves material positions and provisional tax submissions.

---

## 1. Scope

### 1.1 Entity scope

This policy applies to:

- **Hoz Bank Limited** — the primary tax-paying entity; holds the banking licence.
- **Hoz Group Limited** — holding company; consolidation and group-tax coordination.
- **Hoz Securities Limited** — FAIS-FSP entity; separate tax registration and CIT return required once trading commences (per `D-FSP-LICENCE-NECESSITY`).

Unless stated otherwise, "the bank" in this policy refers to the group on a consolidated basis. Where obligations differ by entity, the entity is named explicitly.

### 1.2 Tax heads in scope

| Tax head | Governing legislation | CORPORATE-BIND / COMMENCEMENT-BIND |
|---|---|---|
| Corporate income tax (CIT) | Income Tax Act 58/1962 | CORPORATE-BIND |
| Capital gains tax (CGT) | Eighth Schedule, ITA | CORPORATE-BIND |
| Dividend withholding tax (DWT) | s64E–64N, ITA | CORPORATE-BIND |
| Interest withholding tax (IWT) | s50A–50H, ITA | COMMENCEMENT-BIND |
| Royalty withholding tax | s49A–49H, ITA | CORPORATE-BIND |
| Value-added tax (VAT) | VAT Act 89/1991 | COMMENCEMENT-BIND (upon VAT registration threshold) |
| Securities transfer tax (STT) | STT Act 17/2007 | COMMENCEMENT-BIND |
| FATCA withholding / reporting | FATCA IGA 2014 | CORPORATE-BIND (GIIN registration) |
| CRS reporting | SARS CRS Regulations 2016 | CORPORATE-BIND (registration) |
| Transfer pricing | ITA s31; OECD TP Guidelines | CORPORATE-BIND |
| Provisional tax | ITA s84–s89 | CORPORATE-BIND |

### 1.3 Out of scope

- Employee taxes (PAYE, SDL, UIF) — deferred to Sade (AgentOps) on licence-day under separate procedure.
- Customs and excise — not applicable to the bank's business model.
- Foreign jurisdiction taxes — managed on a transaction-by-transaction basis under the transfer pricing framework; group tax counsel engaged for cross-border structuring.

---

## 2. Governance

### 2.1 Tax governance roles

| Role | Holder | Authority |
|---|---|---|
| Tax governance owner | Yael (Tax & Regulatory Compliance engineer, engineering) | Day-to-day computation, filing, monitoring; all tax-head routines |
| CFO approval authority | Camille (CFO, governance) | Approves provisional tax submissions, material positions, tax opinions ≥R500k exposure |
| Company Secretary | Owen (Company Secretary, governance) | Files returns with SARS; executes deferred-tax disclosures in annual financial statements |
| Internal audit | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, CAE, governance) | Independent recon of tax controls; annual tax-compliance recon |
| External tax counsel | Engaged at licence-application gate; approves legal opinions on positions with >R1m risk exposure | Material uncertain tax positions |

### 2.2 Tax opinion thresholds

| Exposure level | Required sign-off |
|---|---|
| < R100k | Yael autonomous decision |
| R100k – R500k | Yael prepares; Camille approves |
| R500k – R1m | Yael prepares; Camille approves; legal opinion optional |
| > R1m | Yael prepares; Camille approves; external tax counsel legal opinion required |
| Voluntary disclosure | Yael initiates; Camille approves; Owen executes with SARS |

### 2.3 Board and CEO approval

This policy is approved at CEO level in the build phase. Board-level Tax Committee (or the Audit Committee acting with tax oversight) reviews the annual tax report and approves the transfer pricing documentation annually at licence-day. Material uncertain tax positions (>R5m aggregate) are escalated to the Board Audit Committee per §6.2.

---

## 3. Standards and Limits

### 3.1 Corporate income tax

**3.1.1 Taxable income computation**

Taxable income is computed in accordance with ITA s1 (definition of gross income), adjusted for:
- Exempt income (ITA s10 and s10B);
- Allowable deductions (ITA s11–s20);
- Specific inclusions for financial instruments (ss24I, 24J);
- Capital allowances on qualifying assets;
- Assessed losses (ITA s20) — carry-forward subject to anti-avoidance rules.

**3.1.2 Trading stock vs capital**

The bank's financial instruments are classified at initial recognition as either:
- **Trading book** — held for short-term profit; gains and losses are revenue in nature; taxed as ordinary income under the accrual basis.
- **Banking book** — held to maturity or available for sale; capital vs revenue classification determined by facts-and-circumstances test (ITA s1 definition of gross income; intent of acquisition).

A conservative presumption applies: where instrument classification is ambiguous, the revenue classification is adopted. Reclassification between books triggers a deemed disposal at market value for tax purposes.

**3.1.3 Section 24J — interest accrual**

All interest on financial instruments (including discount and premium) is recognised on the yield-to-maturity basis under ITA s24J. The accrual amount is computed daily; tax and accounting are aligned to minimise timing differences.

**3.1.4 Section 24I — forex gains and losses**

Exchange differences on foreign currency monetary items (loans, deposits, receivables, payables denominated in foreign currency) are:
- Recognised on the exchange-item basis: realised gains and losses taken to income in the year of realisation;
- Unrealised gains and losses on forward contracts and options are marked to market annually (s24I(3));
- Hedging instruments: where the underlying and hedge are matched under IFRS 9, the s24I treatment follows the hedge accounting model where permissible.

**3.1.5 Hybrid instruments — s8E and s8EA**

Dividends on hybrid equity instruments (s8E) and third-party backed shares (s8EA) that are recharacterised as income — rather than exempt dividends — are included in taxable income. The bank will not issue or hold s8E/s8EA instruments without prior tax opinion from external counsel.

**3.1.6 Capital gains tax**

CGT applies to assets held on capital account. The inclusion rate for companies is 80% of the net capital gain, taxed at the CIT rate. Trading instruments are excluded from CGT (revenue treatment applies). The annual exclusion does not apply to companies.

### 3.2 VAT

**3.2.1 Financial services exemption**

The supply of financial services by the bank (ITA s2(1)(f) exempt supplies under the VAT Act) is exempt from VAT. Exempt supplies include:
- Deposit-taking and lending;
- Trading in securities and foreign exchange;
- Interbank settlements.

**3.2.2 Partial exemption and input tax apportionment**

Where the bank makes both taxable (e.g. transaction fees, advisory fees) and exempt supplies, input VAT is apportioned using the partial-exemption method approved by SARS. The apportionment formula is reviewed annually and submitted to SARS for confirmation under VAT Act s17(1).

**3.2.3 SVAT for share transactions**

The Simplified VAT Accounting Treatment (SVAT) applies to share-transfer transactions where the bank acts as a trading counterparty. Yael maintains the SVAT register and reconciles to the STT return monthly.

**3.2.4 VAT registration threshold**

VAT registration is required when taxable turnover exceeds R1m in any 12-month rolling period. Yael monitors turnover monthly; registration is initiated 21 days before the threshold is breached.

**3.2.5 VAT return cadence**

VAT returns are filed monthly (or bi-monthly if approved by SARS for smaller taxable periods). Returns are due by the last business day of the month following the tax period. Yael files; Camille approves.

### 3.3 Securities Transfer Tax

**3.3.1 Imposition**

STT is imposed at 0.25% on the transfer of any security listed on a South African exchange (STT Act 17/2007 s2). The bank, as a participant in the JSE clearing system, is liable to account for STT on all applicable transfers.

**3.3.2 Exemptions**

The following STT exemptions apply and must be confirmed for each transaction before filing:
- **Market-maker exemption**: the bank acting as a designated market maker in the relevant security.
- **Securities-lending arrangements (SLB)**: the transfer of securities under a regulated SLB agreement is exempt; the return-leg transfer is also exempt.
- **Intra-group transfers**: exempt where the anti-avoidance conditions are met.

**3.3.3 STT accounting and return**

Yael maintains the STT ledger by transaction. Monthly STT returns are reconciled against JSE trade confirmations before filing. The return is filed and payment made by the 14th day of the following month.

### 3.4 Withholding taxes

**3.4.1 Dividend withholding tax (20%)**

DWT applies to dividends paid to non-exempt beneficial owners. The bank must:
- Withhold 20% (or reduced treaty rate where a DTA applies);
- Apply exemption certificates (s64F declarations) on file before payment;
- Remit to SARS by the last business day of the month following declaration.

**3.4.2 Interest withholding tax (15%)**

IWT applies to interest paid to non-resident beneficial owners on instruments issued by the bank after 1 March 2015. Treaty rates (typically 0%–10%) apply where a valid DTA exists and the recipient has provided a declaration. IWT is COMMENCEMENT-BIND; the bank does not issue public debt instruments before commencement-of-trading.

**3.4.3 Royalty withholding tax (15%)**

Applies to royalties paid to non-residents. Not anticipated to be material during the build phase; applicable from CORPORATE-BIND.

### 3.5 Transfer pricing

**3.5.1 Arm's length standard**

All transactions between connected persons (ITA s31(1) definition; extended to include OECD associated-enterprise concept) must be conducted on arm's length terms. Where actual terms differ from arm's length, the taxable income of the South African entity is adjusted upward to the arm's length amount.

**3.5.2 TP documentation — OECD three-tier**

The bank maintains transfer pricing documentation in the OECD three-tier format:

| Document | Content | Threshold |
|---|---|---|
| Master File | Group structure; business overview; intangibles; financials | Required if group revenue >R1bn (OECD Chapter V §C) |
| Local File | South Africa-specific intercompany transactions; functional analysis; comparables | Required for all material controlled transactions |
| Country-by-Country Report (CbCR) | Revenue; profit; taxes; employees by jurisdiction | Required if group consolidated revenue >R10bn (OECD BP 2015 Action 13) |

**3.5.3 Intra-group services**

Where entities provide services to each other (e.g. Hoz Group providing shared services to Hoz Bank), a Transfer Pricing Services Agreement governs the charge-out. The basis is cost-plus at an arm's length margin supported by a comparables analysis.

**3.5.4 TP governance**

Yael prepares the Local File annually. External tax counsel reviews and signs off on the Master File. CbCR (where applicable) is filed with SARS by Owen 12 months after the financial year-end.

### 3.6 FATCA

**3.6.1 FATCA status — Reporting PFFI**

Hoz Bank Limited registers as a Participating Foreign Financial Institution (PFFI) under the FATCA IGA between South Africa and the United States (2014 IGA). The bank obtains and maintains a Global Intermediary Identification Number (GIIN) from the IRS.

**3.6.2 GIIN maintenance**

GIIN is maintained current. Expiry or revocation triggers immediate re-registration. Yael monitors GIIN status quarterly.

**3.6.3 US account identification and reporting**

The bank identifies US persons (US citizens, US residents, substantial presence test) among its account holders using the IGA due diligence procedures. For each US reportable account:
- Self-certification (W-9 or W-8BEN as applicable) is collected on onboarding;
- Annual information is reported to SARS (who transmits to the IRS) via the FATCA return by 31 May each year;
- Form 1042-S is issued to US beneficial owners receiving US-source income where the bank is a withholding agent.

**3.6.4 Withholding agent obligations**

Where the bank is a withholding agent for US-source income payments (dividends, interest, royalties), it withholds at 30% (or treaty rate) and remits to the IRS. Chapter 3 and Chapter 4 withholding are reconciled on Form 1042 (annual) and 1042-S (payee-level).

### 3.7 Common Reporting Standard (CRS)

**3.7.1 CRS status — Reporting Financial Institution**

Hoz Bank Limited is a Reporting Financial Institution under SARS Common Reporting Standard Regulations (GN R. 640 of 2016), implementing the OECD Common Reporting Standard.

**3.7.2 Self-certification and due diligence**

For each account holder:
- Self-certification is collected on onboarding (Annex I, OECD CRS);
- Indicia of foreign tax residency are monitored annually;
- Pre-existing account review procedures apply per the CRS transitional rules.

**3.7.3 CRS return**

Reportable accounts are reported to SARS in the prescribed XML format by 31 May each year covering the preceding calendar year. Yael prepares; Camille approves; Owen files with SARS via eFiling.

### 3.8 Tax risk appetite

The bank's tax risk appetite is **conservative**:

- No aggressive tax planning structures (defined as arrangements that exploit unintended legislative ambiguity without genuine commercial purpose);
- No participation in listed or disclosed tax avoidance schemes;
- SARS's advance ruling mechanism is used proactively where a novel transaction raises material uncertainty;
- Uncertain tax positions (UTPs) are disclosed in the annual financial statements under IAS 12 / IFRS IC Interpretation 23.

---

## 4. Controls and Monitoring

### 4.1 Tax computation controls

| Control | Frequency | Owner |
|---|---|---|
| CIT taxable-income model reconciliation to management accounts | Quarterly | Yael |
| s24J interest-accrual ledger reconciliation | Monthly | Yael |
| s24I forex-position reconciliation | Monthly | Yael |
| STT ledger vs JSE trade-confirmation reconciliation | Monthly | Yael |
| FATCA GIIN status check | Quarterly | Yael |
| CRS indicia screening against account-holder data | Annual (+ event-triggered) | Yael |
| Transfer-pricing documentation currency | Annual | Yael + external counsel |
| Provisional tax computation review | Before each provisional tax submission | Yael + Camille |

### 4.2 Automated tax routines

Yael's agent substrate executes:
- **Daily**: s24J accrual calculation on all interest-bearing instruments; s24I mark-to-market on open FX positions.
- **Monthly**: VAT apportionment computation; STT ledger aggregation; DWT reconciliation; provisional tax tracking.
- **Annual**: CIT taxable-income computation; CRS return generation; FATCA return data extraction; TP documentation trigger.

### 4.3 Tax provision and deferred tax

The bank records a current-tax provision and deferred-tax asset/liability in accordance with IAS 12 at each reporting date. Deferred tax reflects temporary differences between tax bases and carrying amounts (s24J timing differences, assessed losses, CGT step-up). The deferred-tax calculation is Yael's responsibility; reviewed by Camille; disclosed by Owen in the annual financial statements (obligation ORG-AC-09).

### 4.4 Withholding tax register

Yael maintains a withholding tax register covering all DWT, IWT, and royalty-withholding transactions. The register records: beneficial owner; instrument; payment date; gross amount; withholding rate; treaty applied; DTA declaration on file; remittance date. Reconciled monthly against the general ledger (obligation ORG-AC-12).

### 4.5 Independent assurance

Vera (Internal audit / continuous-assurance engineer, engineering) performs:
- Annual tax-compliance recon covering all tax heads in scope;
- CRS and FATCA completeness test (account population vs reported population);
- STT exemption eligibility check (sample-based);
- Transfer-pricing documentation completeness check.

Findings are reported to Thandiwe (CAE, governance) and escalated to Camille (CFO) where material.

---

## 5. Reporting

### 5.1 Tax calendar

| Filing / event | Deadline | Filed by | Approved by |
|---|---|---|---|
| Provisional tax — 1st payment (6-month) | Last day of 6th month of financial year (August for March year-end) | Yael | Camille |
| Provisional tax — 2nd payment (12-month) | Last day of financial year (February for March year-end) | Yael | Camille |
| Provisional tax — top-up (optional; avoids interest) | 6 months after year-end (August for March year-end) | Yael | Camille |
| Annual CIT return (ITR14) | 12 months after financial year-end | Yael | Camille; Owen files |
| VAT return | Last business day of month following tax period | Yael | Camille |
| STT return | 14th day of month following transfer | Yael | Camille |
| DWT payment and declaration | Last business day of month following declaration | Yael | Camille |
| FATCA return to SARS | 31 May (covering prior calendar year) | Yael | Camille; Owen files |
| CRS return to SARS | 31 May (covering prior calendar year) | Yael | Camille; Owen files |
| CbCR (where applicable) | 12 months after financial year-end | Yael | External counsel; Owen files |
| TP Local File | Completed by CIT return deadline | Yael | Camille |

### 5.2 Tax board reporting

Camille (CFO, governance) presents a tax report to the Board Audit Committee (or interim CEO) annually, covering:
- Effective tax rate analysis vs statutory rate (28%);
- Uncertain tax positions and their financial statement impact;
- FATCA/CRS compliance status;
- SARS audit activity and resolution;
- Transfer pricing update.

### 5.3 SARS audit and dispute management

Where SARS initiates a verification query, audit, or dispute:
- Yael coordinates the response within the SARS-prescribed timeline;
- Camille is notified immediately for exposures >R500k;
- External tax counsel is engaged for disputed assessments >R1m;
- Objection and appeal rights (TAA s104–s130) are exercised where justified;
- Settlement discussions are approved by Camille; material settlements (>R5m) require CEO approval.

---

## 6. Exceptions and Escalation

### 6.1 Exception requests

Any proposed tax position, transaction, or arrangement that:
- Deviates from arm's length pricing without documented justification;
- Relies on an untested or novel interpretation of the Income Tax Act;
- Would attract a General Anti-Avoidance Rule (GAAR; s80A–s80L) challenge;

must be escalated to Camille (CFO) with a written tax opinion from Yael before execution. Positions >R1m exposure require an external tax counsel opinion.

### 6.2 Escalation to Board

The following are escalated to the Board Audit Committee:
- Aggregate uncertain tax positions >R5m;
- Material SARS audit findings affecting prior-period financial statements;
- Significant restatement of deferred-tax balances;
- Any voluntary disclosure of material errors to SARS.

### 6.3 Non-compliance incidents

Failure to file or pay by statutory deadline is a reportable incident under the Operational Risk Policy. Yael reports the failure to Camille within 24 hours of identification. Interest and penalties under TAA s89–s90 are quantified and disclosed. SARS is informed proactively via the Voluntary Disclosure Programme where material errors are identified (TAA s223; obligation ORG-TX-05).

---

*Policy TAX-POL-01 v1.0 — Authored by Yael (Tax & Regulatory Compliance engineer) | Approved by Camille (CFO, governance) | Effective 2026-05-13*
