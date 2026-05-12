---
title: Recovery and Resolution Planning Policy v1
author: Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance) + Owen (Company Secretary, governance)
date: 2026-05-11
summary: Standalone Recovery and Resolution Planning Policy establishing the bank's recovery planning framework, early-warning indicator regime, recovery option inventory, and governance pathway. Implements PA D1/2015, Banks Act ss.60-72, and FSB Key Attributes. Closes obligations ORG-PR-30, ORG-PR-35, ORG-BNK-RECOVERY-CONS. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-CR
  - RT-LQ
  - RT-ST
---

# Recovery and Resolution Planning Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Camille (Chief Financial Officer, governance) — co-author on capital-side recovery options; Owen (Company Secretary, governance) — secretarial / governance-trigger framework.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); W2 Slice 6 of the ICAAP / ILAAP / Recovery framework spec ([Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md)).
> **Obligations closed.** `ORG-PR-30` (recovery plan mandate), `ORG-PR-35` (resolution preparedness), `ORG-BNK-RECOVERY-CONS` (consolidated recovery planning).
> **Bind status.** LICENCE-BIND — obligations activate at commencement of trading under Banks Act 94 of 1990. The policy is authored now for the licence dossier; its governance, indicators, and options inventory are built to be production-grade from licence-day.
> **Triplet position.** This policy is the third leg of the ICAAP–ILAAP–Recovery triplet. It reads coherently with the ICAAP (capital) and ILAAP (liquidity) documents — shared stress scenarios, shared RAS line-set, shared governance pathway. Per §3.3 of the ICAAP / ILAAP / Recovery framework spec, every early-warning indicator in this policy is a RAS-derived metric that also appears in the ICAAP and ILAAP capital / liquidity monitoring regimes.

---

## 0. Reading order

This policy is read in three registers:

1. **Sections 1–2** — overarching policy intent, regulatory authority, and triplet coherence. Read first for context.
2. **Sections 3–5** — the substantive recovery framework: plan structure, early-warning indicators, and options inventory. The operational core.
3. **Sections 6–8** — governance, resolution preparedness, and annual review obligations. The accountability and process wrapper.

Section IDs (e.g. `§4.2.1`) are stable reference points for the planned `recon:icaap-section-coverage` harness (Vera Wave-4 follow-on).

---

## 1. Recovery and Resolution Planning Policy — Overarching

### 1.1 Policy intent

Hoz Bank Limited ("the bank") is required, as a registered bank under the Banks Act 94 of 1990 ("Banks Act"), to maintain a credible and executable recovery plan. The plan documents how the bank would restore financial soundness and viability if it encounters severe stress — before reaching the point of non-viability that would engage resolution powers. This policy establishes the governance, structure, early-warning indicators, recovery options, and annual cycle that constitute the bank's Recovery and Resolution Planning ("RRP") framework.

The bank treats recovery planning not as a regulatory compliance artefact but as an operational discipline. A plan that cannot actually be executed is a governance failure. Accordingly, every element of this policy is calibrated against the bank's actual business model, balance sheet, funding profile, and group structure as described in the ICAAP–ILAAP–Recovery triplet.

### 1.2 Regulatory authority

This policy implements the following regulatory authorities. Where exact sub-clause indices are not yet ratified (pending Imani (Legal-as-code engineer) + external counsel ratification at the licence-application gate), the obligation is marked `[citation: TBC]` per Principle 2 — no citation is invented.

| Instrument | Scope | Bind status |
|---|---|---|
| Banks Act 94 of 1990, §§ 60–72 | Recovery planning framework; recovery plan content requirements; notification obligations to the Prudential Authority (`[citation: TBC — exact section indices; Imani + external counsel ratify at the licence-application gate]`) | LICENCE-BIND |
| PA Directive D1/2015 — *Directive on Recovery Plans for Banks* | Six required plan elements; annual submission; trigger-breach notification; resolvability assessment interface | LICENCE-BIND |
| FSB *Key Attributes of Effective Resolution Regimes for Financial Institutions* (Oct 2014) | Resolvability assessment; separability; loss-absorbing capacity; resolution information pack | LICENCE-BIND (read-across from SA resolution-regime obligations) |
| Financial Sector Regulation Act 9 of 2017 ("FSRA"), Part 5 | SARB Financial Sector Resolution Authority jurisdiction; resolution powers | LICENCE-BIND |
| BCBS D295 *Stress Testing Principles* (Oct 2018) | Integration of stress testing with recovery-plan early-warning indicators | LICENCE-BIND (Pillar 2 requirement) |
| BCBS D335 *IRRBB Standards* (Apr 2016) | IRRBB-derived early-warning indicator in §4.2 | LICENCE-BIND (Pillar 2 read-across) |

The SARB recovery-planning directive `[citation: TBC — Mira (Compliance / RegTech engineer, under Zara (Chief Compliance Officer, governance)) curatorship route; no discrete SARB recovery-planning directive currently appears in the obligations register; per Principle 2, no invented citation; Mira's curatorship deliverable will add a new obligations-register row when the directive is confirmed]` will be incorporated when Mira's curatorship is complete.

### 1.3 Definitions

| Term | Definition |
|---|---|
| **Recovery** | Actions taken by the bank, under its own governance, to restore financial soundness before reaching the point of non-viability |
| **Resolution** | Actions taken by the SARB Financial Sector Resolution Authority under the FSRA to stabilise a failing bank where recovery has failed or is not credible |
| **Point of non-viability (PONV)** | The threshold at which the bank would no longer be viable without extraordinary support, triggering resolution powers; distinct from the early-warning indicator thresholds in §4 |
| **Recovery Plan** | The document produced under this policy, updated annually, that operationalises the recovery framework |
| **Early-Warning Indicator (EWI)** | A quantitative or qualitative metric that, when triggered, initiates the escalation sequence in §6.3 |
| **Recovery Committee** | The governance body activated under §6.1 when an EWI is breached at Trigger Level 2 or above |
| **Critical Economic Function (CEF)** | A function of the bank the disruption of which would cause material impact to the financial system or real economy; identified per PA D1/2015 and FSB Key Attributes |
| **RAS** | Risk Appetite Statement, as maintained under the Risk Management Framework |

---

## 2. Policy Scope and Triplet Coherence

### 2.1 Scope

This policy applies to:

- **Hoz Bank Limited** on a solo basis as the PA-regulated entity.
- **Hoz Group Limited** on a consolidated basis as the group holding company — for the purposes of the resolvability assessment (§7.2) and the group-perimeter stress analysis.
- **Hoz Securities Limited** on a look-through basis for capital and liquidity consolidation per the legal-entity tree (`D-REGULATORY-PERIMETER`, CEO-approved 2026-05-09).

The recovery plan covers the bank's activities as an institutional global-markets trading bank — JSE bonds, equities, and OTC interest rate derivatives — on an indirect-participant posture (`D-INDIRECT-PARTICIPANT-POSTURE`). Client activities, if any, are excluded from the pre-licence-day scope; they activate at commencement of trading per the LICENCE-BIND discipline.

### 2.2 Triplet coherence

The Recovery and Resolution Planning Policy is the third document in the ICAAP–ILAAP–Recovery triplet. It is not authored in isolation. The coherence discipline per §1.2 of the ICAAP / ILAAP / Recovery framework spec binds here:

**Single stress scenario engine.** The stress scenarios that feed the ICAAP capital projections and the ILAAP liquidity projections are the *same scenarios* — the stress-projection engine (W2 Slice 4, Rohan (Risk engineer, under Helena)) produces a single `StressScenarioRun { scenarioId, horizon, severity }` event family that feeds all three documents. A market shock that depresses CET1 simultaneously stresses LCR; the Recovery Plan's EWIs must fire at the right point on that shared trajectory.

**Single RAS line-set.** The EWIs in §4 are derived directly from the RAS calibration:

| RAS line | ICAAP / ILAAP use | Recovery EWI use |
|---|---|---|
| B1 — CET1 ≥ regulatory minimum + Pillar 2A + CCB | ICAAP capital-adequacy floor | EWI Q1 in §4.1 |
| B2 — CET1 management buffer ≥ +1.5pp above B1 floor | ICAAP management buffer | EWI Q2 (buffer erosion) in §4.1 |
| B3 — LCR ≥ 100% (PA minimum) | ILAAP liquidity floor | EWI Q3 in §4.1 |
| B3a — LCR ≥ 110% (management buffer) | ILAAP management buffer | EWI Q4 in §4.1 |
| B4 — NSFR ≥ 100% (PA minimum) | ILAAP stable-funding floor | EWI Q5 in §4.1 |
| B4a — NSFR ≥ 105% (management buffer) | ILAAP management buffer | EWI Q6 in §4.1 |
| B5 — intraday liquidity buffer | ILAAP intraday discipline | EWI Q7 in §4.1 |

A divergent EWI set — one where the Recovery Plan's triggers do not correspond to the RAS lines used in the ICAAP / ILAAP — is a Pillar-2 add-on risk in itself. Coherent authorship here eliminates that risk at source.

**Why coherence matters for the PA.** The PA's supervisory-review reading, under Reg 38 `[citation: TBC]` and PA D1/2015, expects to see a triplet that is internally consistent. An ICAAP that models a severely-adverse stress, an ILAAP that models the same stress from the liquidity side, and a Recovery Plan whose EWIs trip at a threshold consistent with that stress — together they demonstrate that the bank's governance is calibrated to reality, not to document-hygiene.

### 2.3 Build-phase status

This policy is authored in the build phase — no real capital, customers, or active trading positions exist. The Recovery Plan itself is a licence-dossier document. It governs what would happen if, after licence-day, the bank approached the point of non-viability. The build-phase obligation is to produce a plan that is production-grade and that the PA can review as part of the licence application. The recovery options, indicator thresholds, and governance procedures are all calibrated against the bank's target operating model, not a hypothetical generic bank.

---

## 3. Recovery Plan Structure

### 3.1 Overview

Per PA D1/2015, a recovery plan must contain six required elements. This section maps each element to the substantive sections of this policy and the companion Recovery Plan document (the live, annually-updated operational artefact that this policy governs). The six elements are:

| PA D1/2015 element | Section in this policy | Owner |
|---|---|---|
| (a) Governance arrangements | §3.2, §6 | Owen (Company Secretary, governance) + Helena |
| (b) Strategic analysis | §3.3 | Helena + Camille |
| (c) Recovery options inventory | §5 | Camille (capital), Eitan (Treasurer, governance) (liquidity), Helena (overall) |
| (d) Communication and disclosure plan | §3.4 | Owen + Helena + Iris (Information Officer, governance) |
| (e) Preparatory measures | §3.5 | Devon (Chief Operating Officer, governance) + Helena |
| (f) Indicators and triggers | §4 | Helena + Rohan (Risk engineer) |

### 3.2 Governance arrangements

The recovery governance structure is described in full in §6. This sub-section provides the structural summary required under PA D1/2015 element (a).

The board of Hoz Bank Limited holds ultimate accountability for the recovery plan — its approval, its annual update, and, in extremis, the decision to activate recovery options. The Chief Risk Officer (Helena) is the accountable executive for the plan's content and the indicator regime. The Chief Financial Officer (Camille) is accountable for the capital-side recovery options. The Treasurer (Eitan) is accountable for the liquidity-side recovery options. The Company Secretary (Owen) is accountable for the governance-trigger framework — the documented escalation sequence from EWI breach to Recovery Committee activation to board resolution.

In the build phase, with the Board Risk Committee (BRC) not yet constituted, the CRO, CFO, Treasurer, and Company Secretary jointly own the plan under CEO oversight. At licence-day, the BRC becomes the standing governance forum for recovery planning.

### 3.3 Strategic analysis

The strategic analysis section of the Recovery Plan identifies:

**Business model summary.** Hoz Bank Limited is an institutional global-markets trading bank operating on a JSE bonds, equities, and OTC interest rate derivatives mandate. Client base: institutional (no retail). Balance sheet: trading-book dominant. Funding: wholesale institutional. Capital: target R300m CET1 at licence-day. Indirect participant in SAMOS and CLS via sponsor / correspondent banks.

**Critical Economic Functions.** At the scale and business model of Hoz Bank Limited at licence-day, the following functions are identified as candidate CEFs pending PA D1/2015 review:

| Function | Rationale | Separability |
|---|---|---|
| JSE-listed bond market making | Provides price discovery and liquidity to institutional clients; disruption affects market depth in SA government securities | Separable from equities and OTC IRD by asset class |
| OTC interest rate derivative intermediation | Enables institutional clients to hedge interest-rate risk; disruption affects hedging capacity in SA IRS and CCS market | Separable; book winds down to maturity without replacement |
| Institutional custody / settlement facilitation | Settlement of institutional bond and equity transactions via indirect-participant infrastructure | Separable; can transfer to direct participant |

**Group structure.** The group structure is simple — two operating subsidiaries (Hoz Bank Limited and Hoz Securities Limited) under a non-operating holding company (Hoz Group Limited). There are no cross-jurisdictional operations. Intra-group exposures are limited to the holding company's equity investment and a management services agreement. This simplicity is a recovery-positive feature — separation, if required, does not require complex cross-border coordination.

**Interdependencies.** Key operational interdependencies are: the bank's indirect-participant link to SAMOS via its settlement sponsor; the JSE membership and clearing arrangements; and the technology platform running on the bank's cloud substrate. Each is a dependency that, if severed, would impair the bank's ability to transact. Recovery preparatory measures per §3.5 address each.

### 3.4 Communication and disclosure plan

The communication plan identifies audiences, messages, timing obligations, and channels per audience for each phase of recovery — EWI watch, EWI breach, Recovery Committee activation, recovery option execution, and resolution (if recovery fails).

| Phase | Audience | Timing | Channel | Owner |
|---|---|---|---|---|
| EWI watch (Trigger Level 1) | Internal: Board, EXCO, relevant risk owners | Within 24 hours of EWI breach at Level 1 | Internal briefing note via RMS correspondence channel | Helena |
| EWI breach (Trigger Level 2+) | Internal: Board, EXCO | Within 24 hours | Recovery Committee convening notice | Owen |
| EWI breach (Trigger Level 2+) | External: Prudential Authority | Within 24 hours of board notification (PA D1/2015 obligation — `[citation: TBC — exact notification window in PA D1/2015]`) | PA supervisory channel (written notification per PA D1/2015) | Helena + Owen |
| Recovery Committee activation | Internal: all staff with operational recovery roles | Within 48 hours of activation | Internal all-hands + playbook distribution | Devon |
| Recovery option execution | External: counterparties, exchanges, clearing houses (as relevant per option selected) | Per option-specific communication plan in §5 | Bilateral + regulated-market channels | Camille / Eitan / Helena per option |
| Media / market | External: market | Only as legally required or where silence would mislead; PA consultation required before any market-facing statement | PA-coordinated | Owen + Helena + PA |
| Depositors | External: depositors (institutional only at licence-day) | If deposits are at material risk; PA-coordinated timing | Direct outreach + SARB-prescribed channel | Owen + Helena + PA |

Iris (Information Officer, governance) holds the POPIA / information-management dimension of any communication — no personal information is disclosed outside the channels and purposes authorised under POPIA.

### 3.5 Preparatory measures

Preparatory measures are actions taken in advance of any stress event, to ensure the recovery plan can be executed quickly and reliably if needed. Per PA D1/2015 element (e):

| Measure | Description | Owner | Cadence |
|---|---|---|---|
| Pre-positioning of capital instruments | AT1 and Tier 2 issuance documentation maintained in a state ready for rapid execution; legal templates reviewed annually by Imani (Legal-as-code engineer) + Owen | Owen + Camille + Imani | Annual review |
| Liquidity buffer segregation | HQLA pool maintained in segregated accounts with daily mark-to-market; drawdown authorisation procedures documented | Eitan + Ravi (Treasury / ALM engineer, under Eitan) | Daily monitoring; annual procedure review |
| Counterparty pre-notification agreements | Bilateral agreements with settlement sponsor and key counterparties that allow accelerated position close-out or novation under a named stress scenario | Helena + Imani | Annual review + material-change-triggered review |
| Recovery playbook document readiness | Detailed per-option playbooks maintained and updated by owners listed in §5; each playbook includes step-by-step execution instructions, approvals required, system actions, and counterparty contacts | Per §5 option owners | Annual refresh at plan cycle |
| Data and systems availability | All data feeds and system capabilities required for recovery option execution are available within the bank's operational-resilience standards per the Operational Resilience Policy; DR test covers recovery-scenario system availability | Devon + Atlas (Platform engineer) | Annual DR test; results filed in Recovery Plan |
| PA contact register | Current PA supervisory contact details (named relationship managers, emergency channels) maintained; tested annually | Owen | Annual update |
| Key-person contingency | Named deputies for each recovery-accountable executive; deputy-readiness tested at tabletop exercise | Devon + Helena | Annual tabletop |

---

## 4. Early-Warning Indicators

### 4.1 Quantitative indicators

Quantitative early-warning indicators are derived directly from the RAS line-set (per §2.2) and calibrated to the stress-projection engine outputs. Each indicator has two trigger levels:

- **Trigger Level 1 (Watch):** The metric is at or approaching a threshold that warrants heightened monitoring and internal escalation. No external notification yet required.
- **Trigger Level 2 (Alert):** The metric has breached a threshold that triggers Recovery Committee activation and PA notification obligations.

| EWI ID | Indicator | Level 1 threshold (Watch) | Level 2 threshold (Alert) | Measurement frequency | Data source |
|---|---|---|---|---|---|
| Q1 — CET1 ratio | CET1 capital ratio approaches PA regulatory minimum + Pillar 2A + CCB (RAS B1 floor) | CET1 within 200bp above B1 floor | CET1 within 100bp above B1 floor | Daily (reporting); on-demand under stress | RWA engine + capital-computation substrate |
| Q2 — CET1 management buffer | CET1 management buffer (RAS B2: +1.5pp above B1 floor) erosion | Buffer erosion of ≥ 50bp from the 1.5pp target | Buffer erosion of ≥ 100bp (i.e., buffer < 0.5pp) | Daily | RWA engine + RAS register projection |
| Q3 — LCR (PA minimum) | Liquidity Coverage Ratio approaches PA minimum (RAS B3 floor, 100%) | LCR 100%–110% | LCR below 100% | Daily | LCR computation feed (W2 Slice 5) |
| Q4 — LCR (management buffer) | LCR management buffer (RAS B3a floor, 110%) erosion | LCR 110%–115% | LCR below 110% | Daily | LCR computation feed |
| Q5 — NSFR (PA minimum) | Net Stable Funding Ratio approaches PA minimum (RAS B4 floor, 100%) | NSFR 100%–105% | NSFR below 100% | Quarterly (more frequent under stress) | NSFR computation feed (W2 Slice 5) |
| Q6 — NSFR (management buffer) | NSFR management buffer (RAS B4a floor, 105%) erosion | NSFR 105%–108% | NSFR below 105% | Quarterly (more frequent under stress) | NSFR computation feed |
| Q7 — Intraday liquidity | Intraday liquidity buffer below the bank's intraday reserve floor (RAS B5) | Buffer at 110%–120% of reserve floor | Buffer at or below reserve floor | Intraday (per BCBS 248 / `ORG-PR-08`) | Intraday-liquidity feed (W2 Slice 5) |
| Q8 — Leverage ratio | Leverage ratio approaches PA minimum (`[citation: TBC — PA minimum leverage ratio per Reg 38 / BCBS Basel III; Imani ratification route]`) | Within 50bp of PA minimum | At or below PA minimum | Monthly | RWA engine + leverage-ratio computation |
| Q9 — Large-exposure concentration | Single-name or sector exposure approaching BCBS large-exposure limit (`[citation: TBC — exact Reg limit; Helena + Imani route]`) | Exposure at 80% of limit | Exposure at 90% of limit | Daily | Credit-risk exposure feed |
| Q10 — IRRBB NII sensitivity | Net interest income sensitivity under a +200bp / −200bp parallel shift scenario approaching the bank's IRRBB RAS limit (`[citation: TBC — RAS IRRBB limit, calibrated under W2 Slice 2]`) per BCBS D335 | Sensitivity at 80% of RAS limit | Sensitivity at 90% of RAS limit | Monthly | IRRBB computation feed |

### 4.2 Qualitative indicators

Qualitative early-warning indicators capture risks that do not surface immediately in quantitative metrics but signal elevated stress:

| EWI ID | Indicator | Watch criteria | Alert criteria | Assessment owner |
|---|---|---|---|---|
| QL1 — Regulatory action | Adverse PA supervisory action or formal finding | PA issues a formal query or supervisory letter requiring a response | PA imposes a formal direction, restriction, or condition on the bank | Helena + Owen |
| QL2 — Reputational event | Material adverse media coverage, regulatory announcement, or client withdrawal | Single material adverse event in the public domain; client queries regarding bank's financial health | Pattern of adverse events; multiple institutional clients reducing exposure; adverse analyst or ratings commentary | Helena + Owen |
| QL3 — Funding market access | Deterioration in the bank's ability to access wholesale funding markets | Increase in funding spreads of ≥ 50bp above prior-month average; counterparty credit-limit reductions | Inability to roll maturing funding; more than one key wholesale funding provider terminating facilities | Eitan + Helena |
| QL4 — Key-person loss | Loss or incapacitation of a key executive in a recovery-critical role | Departure of one recovery-critical executive without named successor in place | Departure of two or more recovery-critical executives simultaneously; loss of the CRO, CFO, or CEO | Devon + Helena |
| QL5 — Cyber / operational event | Material cyber or operational event affecting the bank's ability to operate | Event degrading system availability below operational-resilience thresholds in the Operational Resilience Policy | Event causing sustained inability to execute trades, process settlements, or access liquidity-management systems | Devon + Helena |
| QL6 — Market dislocation | Severe market dislocation in the bank's primary trading markets (SA government securities, JSE equities, OTC IRD) | Spread widening or liquidity withdrawal in primary markets materially beyond historical norms | Market suspension; exchange circuit-breaker activation; inability to mark trading book at reliable prices | Saskia (Head of Markets, governance) + Helena |
| QL7 — Counterparty credit event | Material adverse credit event at a key counterparty | Public warning signs (ratings outlook change, regulatory action) at a counterparty representing ≥ 10% of trading book exposure | Default, resolution, or PA intervention at such a counterparty | Helena |

### 4.3 Indicator governance

The indicator-monitoring substrate (W2 Slice 6) emits a `RecoveryEarlyWarningTriggered { indicatorId, threshold, actualValue, triggerLevel }` event when any EWI reaches its Level 1 or Level 2 threshold. This event is the canonical artefact for the escalation sequence in §6.3.

Helena (CRO, governance) reviews the full indicator set at each Recovery Plan annual cycle and following any material change in the bank's business model, RWA composition, or balance sheet structure. Changes to thresholds require a CRO recommendation, CFO concurrence (for capital-side indicators), and Board approval at the next BRC meeting (or CEO approval in the build phase).

Nadia (Independent-validation engineer, peer-in-second-line under Helena) validates the indicator-computation models annually — both the quantitative computation feeds and the qualitative-assessment frameworks — per the Model Risk Policy (`ORG-PR-XX` `[citation: TBC — Model Risk Policy obligation row ID]`).

---

## 5. Recovery Options Inventory

### 5.1 Overview

The recovery options inventory documents every action available to the bank to restore financial soundness if the EWIs are triggered. Each option is assessed for:

- **Capacity**: the estimated quantum of capital / liquidity / balance-sheet relief the option delivers.
- **Execution time**: the realistic time from decision to effect under stress conditions.
- **Pre-conditions**: conditions that must hold for the option to be available.
- **Dependencies**: counterparty, regulatory, or operational dependencies.
- **Risks**: risks specific to exercising the option under the stress scenario.

The inventory is divided into three categories: capital actions, liquidity actions, and business actions.

### 5.2 Capital actions

| Option | Description | Capacity estimate | Execution time | Pre-conditions | Dependencies | Risks | Owner |
|---|---|---|---|---|---|---|---|
| CA1 — Rights issue | Issuance of new ordinary shares to existing shareholders | Up to the authorised but unissued share capital; calibrated against shareholder capacity at plan cycle | 4–8 weeks (rights offer with underwriting) | Board resolution; shareholder support; legal documentation pre-positioned per §3.5 | Imani (legal documentation); investment bank (underwriting) | Shareholder capacity may be impaired in severe stress; underwriter withdrawal risk | Camille + Owen |
| CA2 — AT1 capital instrument issuance | Issuance of Additional Tier 1 qualifying instruments to institutional investors | Up to the AT1 tier-1 sublimit per PA capital framework `[citation: TBC — exact AT1 sublimit per Reg 38 / Basel III; Imani route]` | 6–10 weeks for marketed issuance; 2–4 weeks for private placement | AT1 framework documentation pre-positioned; investor registry maintained | Imani + Owen (documentation); institutional investors | AT1 investor appetite may contract in severe market stress; trigger-event conversion risk is itself a market signal | Camille + Helena |
| CA3 — RWA reduction | Reduction of risk-weighted assets through position reduction, hedging, or counterparty de-risking | Dependent on portfolio composition at time of stress; estimated CET1 ratio uplift per 10% RWA reduction: approximately 100bp at target capital level | 1–4 weeks for incremental reduction; 2–6 weeks for structural book reduction | Active trading positions; counterparty willingness to transact at normal spreads | Saskia (trading-book execution); Eitan (treasury hedges); market liquidity | In severe stress, RWA reduction may incur mark-to-market losses that partially offset the ratio benefit | Helena + Camille + Saskia |
| CA4 — Asset sales | Sale of individual assets or portfolios to third parties | Dependent on asset composition; liquid sovereign bond positions are most rapidly realisable | 1 week for liquid assets; 4–12 weeks for illiquid or structured positions | Willing buyers; legal documentation; no regulatory restriction on disposal | Imani (sale documentation); market counterparties; applicable exchange / clearing rules | Fire-sale pricing in distressed markets; settlement risk on accelerated disposal | Camille + Eitan + Helena |
| CA5 — Dividend / distribution suspension | Suspension of distributions to shareholders to preserve CET1 | Full quantum of any declared but unpaid distributions | Immediate upon Board resolution | Board resolution; legal advice from Owen on existing distribution obligations | Owen (legal); existing shareholder agreements | Reputational signal; not a standalone recovery action but amplifies other options | Camille + Owen |
| CA6 — Capital injection from group | Capital contribution from Hoz Group Limited (holding company) | Dependent on Hoz Group Limited's available resources; assessed at each plan cycle | 1–2 weeks (intra-group transfer, subject to Companies Act compliance) | Hoz Group Limited must have the available capital; Companies Act ss. 44–45 solvency-and-liquidity test compliance | Camille + Owen (Companies Act); consolidated capital position | Group-level contagion risk — the stress that impairs the bank may also impair the holding company's capacity to contribute | Camille + Owen |

### 5.3 Liquidity actions

| Option | Description | Capacity estimate | Execution time | Pre-conditions | Dependencies | Risks | Owner |
|---|---|---|---|---|---|---|---|
| LA1 — Drawdown of HQLA liquidity buffer | Conversion of HQLA (Level 1 and Level 2A) to cash in the 30-day stress window | The full HQLA buffer, less the LCR floor reserve; estimated at plan cycle against the HQLA pool composition | 1–3 business days for government securities via SAMOS repo; same-day for cash | HQLA pool must be unencumbered; SAMOS indirect-participant access via settlement sponsor | Eitan + Ravi; settlement sponsor; SAMOS access | Haircut widening on Level 2A assets under severe stress; settlement sponsor credit risk | Eitan + Helena |
| LA2 — Repo / secured funding | Secured borrowing against eligible collateral (government securities, eligible corporate bonds) via bilateral repo or JSE Repo market | Collateral pool available for repo at plan cycle; amount net of haircuts | 1–2 days | Counterparty bilateral repo agreements; JSE Repo market access | Eitan + Ravi; bilateral GMRA counterparties (Imani legal documentation); JSE membership | Repo counterparty withdrawal in stress; margin calls on existing repos requiring additional collateral | Eitan + Imani |
| LA3 — Asset disposal for liquidity | Sale of liquid assets to generate cash beyond the HQLA buffer | Dependent on available liquid assets beyond HQLA; calibrated at plan cycle | 1 day (JSE-listed government bonds); 3–5 days (other assets) | Available unencumbered assets above HQLA minimum; market liquidity | Eitan + Saskia; market counterparties | Fire-sale pricing; liquidity signal to market | Eitan + Camille |
| LA4 — Contingency credit facility activation | Drawdown of pre-arranged contingency credit lines from correspondent / sponsor banks | Facility sizes agreed in credit agreements; calibrated at plan cycle | 1–3 days (subject to facility terms) | Credit facility agreements in place and undrawn; counterparty credit conditions not impaired | Eitan + Imani (facility agreements); correspondent bank credit | Facility withdrawal by lender under Material Adverse Change clause; fee and pricing implications | Eitan + Camille |
| LA5 — Intra-group liquidity support | Intra-group funding from Hoz Group Limited or Hoz Securities Limited | Hoz Securities Limited's available liquid assets; assessed at plan cycle | 1–2 business days | Intra-group loan documentation; Companies Act solvency-and-liquidity tests; PA notification if material | Eitan + Imani + Owen; consolidated liquidity position | Same group-contagion risk as CA6; FSCA supervision of Hoz Securities Limited's liquidity must not be impaired | Eitan + Owen |
| LA6 — Deposit-book management (post-licence-day) | Selective management of institutional deposit maturities to extend funding tenor | Dependent on deposit book at the time; not relevant at licence-day where deposit base is minimal | 30–90 days (subject to notice periods and deposit agreements) | Active deposit book; depositor relationship management | Eitan; depositor agreements | Reputational signal if depositors are aware of selective maturity management | Eitan + Helena |

### 5.4 Business actions

| Option | Description | Capacity estimate | Execution time | Pre-conditions | Dependencies | Risks | Owner |
|---|---|---|---|---|---|---|---|
| BA1 — Business line wind-down | Orderly wind-down of one or more trading book segments (e.g., OTC IRD or equities) to reduce RWA, operational risk, and funding requirements | RWA reduction and corresponding CET1 ratio uplift per CA3; reduction in intraday liquidity requirements | 4–12 weeks for orderly unwind of open positions to maturity or novation | Counterparty agreement to novation or close-out; clearing rules; PA notification if material | Helena + Saskia + Imani; counterparties; JSE and clearing infrastructure | Market impact of visible position reduction; key-person retention during unwind; client notification obligations | Helena + Camille + Saskia |
| BA2 — Voluntary sale of business unit | Sale of a business segment or subsidiary (e.g., Hoz Securities Limited) to an approved third-party acquirer | Capital release equal to the book value of the unit sold, plus any premium above book; removes ongoing capital consumption | 8–24 weeks (M&A process, regulatory approvals) | Board resolution; willing buyer at reasonable value; PA and FSCA change-in-control approvals `[citation: TBC — applicable change-in-control approval requirements under Banks Act + FAIS + FSRA]` | Imani + Owen (legal); PA + FSCA (regulatory approvals); Camille (valuation) | Execution risk in severe stress; price discount in distressed sale; structural complexity of carve-out | Camille + Helena + Owen + Imani |
| BA3 — Voluntary recapitalisation / restructuring | Negotiated equity recapitalisation or debt restructuring with existing creditors and shareholders, potentially including SARB support via the National Payment System Act or FSRA stability instruments | Structural; removes balance-sheet pressure through liability restructuring | 4–12 weeks (negotiated) | Creditor and shareholder cooperation; legal documentation; PA + National Treasury involvement if using public-stability instruments | Owen + Imani; PA; National Treasury; creditors | This is a near-PONV option; execution risk is high; signals to market are significant | Helena + Camille + Owen |

### 5.5 Option interaction and sequencing

In practice, recovery options are not exercised in isolation. The Recovery Committee (§6.1) will sequence options to maximise effectiveness and minimise contagion risk. The general sequencing principle is:

1. **Fastest and least-intrusive first**: dividend suspension (CA5), RWA reduction (CA3), HQLA drawdown (LA1), repo (LA2) — these can be executed quickly with minimal external signalling.
2. **Capital market actions**: rights issue (CA1), AT1 issuance (CA2) — require more preparation but are the most durable fixes.
3. **Business restructuring**: wind-down (BA1), asset sales (CA4), voluntary sale (BA2) — structural; reserved for scenarios where financial-ratio recovery alone is insufficient.
4. **Near-PONV options**: voluntary recapitalisation (BA3) — only if the above options are collectively insufficient to restore viability; at this stage, PA escalation and resolution interface become immediate.

The Recovery Committee is responsible for selecting and sequencing options at the time of activation, based on the specific stress scenario and the options then available.

---

## 6. Governance and Escalation

### 6.1 Recovery Committee

The Recovery Committee is a standing committee of the board and EXCO that is activated upon EWI Trigger Level 2 breach. It is not a permanent standing committee; it has defined composition, quorum, authorities, and termination criteria.

**Composition:**

| Member | Role | Voting |
|---|---|---|
| Board Chair (or CEO acting as Chair in build phase — Marc) | Committee Chair | Yes |
| Helena (Chief Risk Officer, governance) | Lead executive; EWI monitor; options analysis | Yes |
| Camille (Chief Financial Officer, governance) | Capital-side options; funding analysis | Yes |
| Eitan (Treasurer, governance) | Liquidity-side options; HQLA management | Yes |
| Owen (Company Secretary, governance) | Secretariat; governance-trigger management; PA notification | Yes — on governance / process matters; advisory on legal / secretarial |
| Devon (Chief Operating Officer, governance) | Operational-readiness; playbook execution | Advisory |
| Imani (Legal-as-code engineer) | Legal documentation support for capital and business actions | Advisory |

Quorum: Board Chair + Helena + Camille + one of {Eitan, Owen}.

**Activation:** Owen issues the Recovery Committee convening notice within 24 hours of the `RecoveryEarlyWarningTriggered { triggerLevel: 2 }` event being emitted by the indicator-monitoring substrate, or upon the CEO's or CRO's determination that a qualitative EWI at Level 2 warrants activation.

**Authorities:**

- Approve and initiate recovery options CA1–CA6, LA1–LA6, BA1–BA2 without further Board resolution, subject to the thresholds in each option's description and existing Board-approved delegated authorities.
- Direct Helena to notify the PA of the EWI breach and Recovery Committee activation.
- Approve the communication plan per §3.4 for each phase.
- Refer BA3 (near-PONV voluntary recapitalisation) to the full Board for separate resolution — this action is outside the Recovery Committee's standing authority.

**Termination:** The Recovery Committee dissolves when the CRO, CFO, and Board Chair jointly certify that the EWI metrics have recovered above Level 1 thresholds and are projected to remain there under the base stress scenario, or when the bank enters resolution (at which point the SARB Financial Sector Resolution Authority assumes control).

### 6.2 CEO notification obligation

The CEO (Marc, in both CEO and interim Board roles) must be notified within 24 hours of any EWI breach at Trigger Level 1 or above. The CRO (Helena) owns this notification obligation. The notification includes:

- Which EWI(s) have breached, at what threshold.
- Current metric value and trajectory.
- Proposed next steps (enhanced monitoring at Level 1; Recovery Committee activation at Level 2).
- Estimated time to potential Level 2 breach, if currently at Level 1.

This notification is a typed event in the governance event-pattern: `RecoveryCeoNotified { indicatorId, triggerLevel, notificationTimestamp }`.

### 6.3 Escalation sequence

The full escalation sequence from EWI monitoring to recovery activation is:

```
1. Indicator-monitoring substrate emits
   RecoveryEarlyWarningTriggered { indicatorId, threshold, actualValue, triggerLevel }

2. (Level 1): CRO notifies CEO within 24 hours
   RecoveryCeoNotified { indicatorId, triggerLevel: 1, ... }
   Enhanced monitoring mode activated — daily briefing to CRO + CFO

3. (Level 2): Owen issues Recovery Committee convening notice within 24 hours
   BrcEscalationConvened { triggerEventId, conveneTimestamp }
   CRO notifies PA within 24 hours of Board notification (PA D1/2015 obligation)

4. Recovery Committee first meeting: situation assessment
   Options analysis against current balance sheet and market conditions
   Communication plan activated per §3.4

5. Recovery Committee approves option(s) and initiates execution
   RecoveryPlanActivated { activationDecisionId, optionsSelected[], ... }
   Option-specific execution events per §5

6. Recovery Committee monitors option execution and EWI trajectory
   RecoveryOptionExecuted { optionId, result, effectOnIndicator }

7. Either:
   (a) EWIs recover: Recovery Committee termination per §6.1
       RecoveryPlanDeactivated { certificationTimestamp, certifiedBy[] }
   (b) Options insufficient: Board convened for BA3 resolution
       RecoveryPlanEscalatedToBoard { escalationTimestamp }
   (c) PONV reached: PA notified; SARB Financial Sector Resolution Authority interface per §7
       RecoveryPlanFailedPointOfNonViability { paNotificationTimestamp }
```

### 6.4 PA notification obligations

Helena (CRO, governance) owns the PA notification obligations under PA D1/2015. Owen (Company Secretary, governance) maintains the PA supervisory contact register per §3.5 and ensures all notifications are dispatched through the correct PA channel.

Notification obligations include (subject to confirmation of exact timing requirements in PA D1/2015 `[citation: TBC — Mira curatorship route for exact PA D1/2015 notification windows]`):

| Trigger | Content | Timing |
|---|---|---|
| EWI Trigger Level 2 breach (activation) | Identity of EWI breached; current value; Recovery Committee activation; proposed options | Within 24 hours of board notification |
| Recovery option activation (material) | Option(s) selected; expected effect; timeline | Within 48 hours of Recovery Committee approval |
| Change in recovery plan status (material change in business model, RWA composition, entity structure) | Nature of change; revised recovery plan section(s) | Within 30 days of material change |
| Annual plan submission | Complete updated Recovery Plan per §8.2 | Per PA D1/2015 annual submission calendar |

### 6.5 Board resolution authority

The following recovery-related matters require Board resolution and cannot be approved by the Recovery Committee alone:

- BA3 — voluntary recapitalisation / debt restructuring with PA and National Treasury involvement.
- Any voluntary sale of a banking subsidiary (BA2) where the consideration exceeds 20% of total assets.
- Notification to the PA that the bank has reached the point of non-viability.
- Amendment of this policy (§8.3).
- First approval of the annual Recovery Plan update (§8.2).

In the build phase, with no independent NEDs appointed, the CEO (Marc) acting as interim Board exercises these authorities and records them as `CeoDecision` events in the decision register.

---

## 7. Resolution Preparedness

### 7.1 Interface with the SARB Financial Sector Resolution Authority

Recovery and resolution are distinct phases:

- **Recovery** is what the bank does, under its own governance, to restore viability. This policy governs recovery.
- **Resolution** is what the SARB Financial Sector Resolution Authority (the "Resolution Authority", established under the Financial Sector Regulation Act 9 of 2017) does if recovery fails or is not credible. The bank does not govern resolution; it prepares for it and cooperates with the Resolution Authority.

The interface between recovery and resolution operates at the PONV trigger. If the Recovery Committee determines that the recovery options are collectively insufficient to restore viability — or if the PA determines that the bank has reached or is approaching PONV — the Resolution Authority may exercise its statutory powers under the FSRA.

The bank's obligations at the resolution interface are:

1. **Notification.** Notify the PA immediately upon determining that recovery options are collectively insufficient; PA notifies the Resolution Authority.
2. **Cooperation.** Provide full access to books, records, data, and management to the Resolution Authority upon request.
3. **Resolution information pack** (§7.3) — maintained in a state ready for immediate delivery.

### 7.2 Resolvability assessment

Per FSB Key Attributes of Effective Resolution Regimes (2014), Key Attribute 11, banks must assess their own resolvability — the degree to which the bank's structure, operations, and intra-group dependencies support rapid and orderly resolution without contagion to the financial system.

The resolvability assessment for Hoz Bank Limited is conducted annually as part of the Recovery Plan cycle. The key dimensions:

| Dimension | Assessment | Basis |
|---|---|---|
| Group simplicity | Positive: two operating subsidiaries, no cross-jurisdictional operations, no complex intra-group chains | Legal-entity tree per `D-REGULATORY-PERIMETER` |
| Separability of critical functions | Positive: CEFs (§3.3) are separable by asset class; no operational interdependency that prevents partial resolution | CEF mapping per §3.3 |
| Intra-group financial dependencies | Moderate: holding company equity investment; management services agreement; resolution impact is bounded to group equity | Intra-group agreement register — Owen |
| Loss-absorbing capacity | Build-phase: target R300m CET1 at licence-day; TLAC framework `[citation: TBC — PA TLAC requirement, if any, for SA banks at this scale; Imani route]` | Capital Plan v1 ([Owner Inbox/2026-05-07_camille_capital-plan-v1.md](2026-05-07_camille_capital-plan-v1.md)) |
| Operational continuity in resolution | Moderate: operational continuity depends on indirect-participant infrastructure (SAMOS settlement sponsor, JSE clearing); Resolution Authority would need to maintain these relationships or transfer them to an acquirer | Operational-readiness preparatory measures per §3.5 |
| Valuation capability | Build-phase: internal mark-to-model and mark-to-market capabilities sufficient for an independent valuer; IFRS 9 / FVTPL governance per Bea (Accounting & financial reporting engineer, under Camille) | Reporting-capability spec ([Owner Inbox/2026-05-06_reporting-capability-spec.md](2026-05-06_reporting-capability-spec.md)) |
| Access to financial market infrastructure | Moderate: indirect participant — resolution would need to manage sponsor / correspondent bank relationships; direct participation is harder to maintain in resolution | Indirect-participant posture (`D-INDIRECT-PARTICIPANT-POSTURE`) |

The resolvability assessment produces a `ResolvabilityAssessmentCompleted { asOf, findings[], impediments[], remediationItems[] }` event at each annual cycle. Impediments to resolvability are escalated to the Board and, if material, notified to the PA.

### 7.3 Resolution information pack

The Resolution Authority may require the bank to maintain a resolution information pack — a structured dataset and document set enabling the Authority to undertake rapid resolution planning. The bank commits to maintaining the following minimum information set, updated at each annual Recovery Plan cycle:

| Information set | Content | Owner | Format |
|---|---|---|---|
| Legal entity map | Full legal-entity tree per `D-REGULATORY-PERIMETER`; ownership structure; regulatory licences; governing law | Owen | Event-substrate projection from `LegalEntityRegistered` events |
| Balance sheet | Consolidated and solo balance sheets; major asset and liability classes; off-balance-sheet exposures | Camille + Bea | Quarterly BA-form-series outputs |
| Trading book positions | Open positions by asset class; counterparty identity; close-out netting agreements (ISDA / GMRA) | Saskia (Head of Markets, governance) + Imani | Daily position snapshot per trading-book substrate |
| Funding profile | Liability maturity profile; funding source diversification; HQLA pool composition | Eitan + Ravi | ILAAP liquidity-side substrate output |
| Critical contracts | Settlement sponsor agreement; JSE membership agreement; SAMOS participation agreement; ISDA master agreements; GMRA agreements | Imani + Owen | Contract register — Imani Domain C |
| IT system map | System inventory; data flows; DR capability; cloud substrate architecture | Atlas (Platform engineer) + Devon | Technology register |
| Recovery Plan | Current annual Recovery Plan | Helena + Owen | This document series |
| Key personnel | Recovery Committee members; operational deputies; PA supervisory contact | Owen | Party register per `D-PARTY-REGISTER` |

### 7.4 Structural subordination readiness

Structural subordination (the practice of ensuring that resolution-absorbing liabilities are issued at the holding-company level, not the operating bank level, so that resolution can occur within the bank without touching holding-company creditors) is assessed at each annual plan cycle against the FSB Key Attributes bail-in framework.

At the bank's current scale and operating model, the primary resolution mechanism anticipated is purchase-and-assumption (transfer of assets and liabilities to a bridge bank or private acquirer) rather than bail-in. The bank's wholesale institutional funding profile (no retail deposits) means that bail-in of retail depositors is not a scenario. However, the structural subordination assessment is maintained as a readiness check:

- AT1 and Tier 2 instruments (if issued per CA2 or future capital management) are assessed for PONV write-down and conversion mechanics consistent with PA requirements `[citation: TBC — PA requirements on AT1 and T2 write-down / conversion triggers; Imani route]`.
- Any liability issuance above de minimis is assessed for bail-in eligibility at issuance stage by Imani.

---

## 8. Annual Review and PA Submission

### 8.1 Annual cycle

The Recovery Plan annual cycle is the third step in the ICAAP–ILAAP–Recovery triplet annual sequencing:

```
Step 1: ICAAP cycle (Helena lead; Camille co-chair)
        IcaapCycleStarted → ... → IcaapDocumentSubmitted
        ↓ stress-scenario data available to Recovery Plan
Step 2: ILAAP cycle (Camille chair; Eitan liquidity-side)
        IlaapCycleStarted → ... → IlaapDocumentSubmitted
        ↓ liquidity-stress data available to Recovery Plan
Step 3: Recovery Plan cycle (Helena lead; Owen secretarial)
        RecoveryPlanCycleStarted → RecoveryPlanDrafted →
        RecoveryPlanReviewed → RecoveryPlanBoardAttested →
        RecoveryPlanSubmitted
```

The Recovery Plan annual cycle event-pattern is:

| Event | Owner | Timing |
|---|---|---|
| `RecoveryPlanCycleStarted { cycleYear }` | Helena | At ICAAP document submission + 10 business days (to allow ICAAP data to flow) |
| `RecoveryPlanDrafted { draftVersion }` | Helena + Owen | Within 30 business days of cycle start |
| `RecoveryPlanReviewed { reviewerIds[], findings[] }` | Nadia (independent validation) + Vera (internal audit, Thandiwe (Chief Audit Executive, governance) line) | Within 15 business days of draft |
| `RecoveryPlanBoardAttested { attestorIds[], asOf }` | Board (CEO in build phase) | Within 10 business days of review completion |
| `RecoveryPlanSubmitted { submissionChannel, submissionTimestamp }` | Helena + Owen | Per PA D1/2015 submission deadline `[citation: TBC — Mira curatorship route for the exact PA D1/2015 submission calendar]` |

Material changes in the bank's business model, entity structure, or RWA composition trigger an out-of-cycle update per §6.4.

### 8.2 PA D1/2015 submission requirements

The annual submission to the PA under PA D1/2015 includes:

1. A signed cover letter from the CEO and CRO confirming the Recovery Plan has been reviewed and approved by the board and remains current.
2. The Recovery Plan document (this policy plus the annually-updated Recovery Plan operational document).
3. A self-assessment against the PA D1/2015 required elements checklist (§3.1 of this policy).
4. A summary of EWI indicator readings over the preceding 12 months and any Level 1 or Level 2 breaches.
5. A resolvability assessment per §7.2.
6. A summary of any material changes from the prior year's submission.

The submission is routed through Owen (Company Secretary, governance) as the PA liaison, with Helena signing the CRO certification and the CEO signing the board-level certification.

### 8.3 Policy governance

This policy is approved by the Board (CEO in build phase) and reviewed annually. Amendments require:

- A CRO recommendation (Helena) with CFO concurrence (Camille) for substantive changes.
- Board approval (CEO in build phase) for all amendments.
- A new policy version with a change-log entry per §9.3.

Vera (internal audit engineer, under Thandiwe (Chief Audit Executive, governance)) assures that the annual review cycle has occurred and that material changes have been approved at the right authority level. The assurance finding feeds into the Audit Forum (Owen chair, until a Board AC is constituted).

### 8.4 Linkage to ICAAP / ILAAP annual cycle

The three documents are submitted as a triplet to the PA:

- Where the PA requests a combined ICAAP / ILAAP / Recovery submission, the three documents are submitted together under a single cover letter co-signed by the CRO and CFO.
- Where the PA requests separate submissions, the documents are submitted sequentially in the order: ICAAP → ILAAP → Recovery, within the same regulatory year.
- Divergences between the three documents (stress scenarios, RAS thresholds, EWI calibrations) are identified and resolved before submission, under Helena's sign-off authority as CRO and triplet-coherence owner.

---

## 9. Obligations, Citations, and Change Log

### 9.1 Obligations closed by this policy

| Obligation ID | Description | Bind status | Discharge mechanism |
|---|---|---|---|
| `ORG-PR-30` | Recovery plan mandate — Banks Act §§ 60-72 and PA D1/2015 obligation to maintain a recovery plan | LICENCE-BIND | This policy + annual Recovery Plan document |
| `ORG-PR-35` | Resolution preparedness — FSB Key Attributes interface; resolvability assessment; resolution information pack | LICENCE-BIND | §7 of this policy + annual resolvability assessment |
| `ORG-BNK-RECOVERY-CONS` | Consolidated recovery planning — recovery plan must cover the group on a consolidated basis per PA D1/2015 | LICENCE-BIND | §2.1 (group scope) + §7.2 (resolvability assessment on consolidated basis) |

### 9.2 Citation surface

All regulatory citations used in this policy:

| Citation | Source | Status |
|---|---|---|
| Banks Act 94 of 1990, §§ 60-72 | Recovery and resolution planning; PA notification obligations | `[TBC — exact section indices; Imani + external counsel ratify at the licence-application gate]` |
| PA Directive D1/2015 | Directive on Recovery Plans for Banks; six required elements; annual submission requirements | `[TBC — Mira curatorship route for exact content and notification windows in PA D1/2015; title assumed from dispatch brief]` |
| Financial Sector Regulation Act 9 of 2017, Part 5 | SARB Financial Sector Resolution Authority powers | Confirmed Act name and number; Part 5 indices `[TBC — Imani route]` |
| FSB *Key Attributes of Effective Resolution Regimes for Financial Institutions* (Oct 2014) | Key Attributes 1–12; Key Attribute 11 (resolvability assessment) | Published FSB standard |
| BCBS D295 *Stress Testing Principles* (Oct 2018) | Integration of stress testing with recovery indicators | Published BCBS standard |
| BCBS D335 *Standards: IRRBB* (Apr 2016) | IRRBB-derived early-warning indicator (EWI Q10) | Published BCBS standard |
| BCBS 144 *Principles for Sound Liquidity Risk Management* (Sept 2008) | Contingency funding plan discipline; liquidity early-warning indicators | Published BCBS standard; discharged under `ORG-PR-15` |
| BCBS 248 *Monitoring tools for intraday liquidity management* (Apr 2013) | Intraday liquidity EWI (Q7) | Published BCBS standard; discharged under `ORG-PR-08` |
| `D-REGULATORY-PERIMETER` | Group structure; consolidated-basis reading | CEO-approved 2026-05-09 |
| `D-INDIRECT-PARTICIPANT-POSTURE` | Indirect-participant operating posture | CEO decision record |
| ICAAP / ILAAP / Recovery framework spec | Triplet coherence; shared stress scenarios; shared RAS line-set | [Owner Inbox/2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md](2026-05-10_helena-camille_icaap-ilaap-recovery-framework.md) |
| Capital Plan v1 | Strategic analysis; capital-side option capacity estimates | [Owner Inbox/2026-05-07_camille_capital-plan-v1.md](2026-05-07_camille_capital-plan-v1.md) |
| `D-REGULATORY-READINESS-GATE-PLAN` | Standing authority for this deliverable | CEO-approved 2026-05-10 |

Per Principle 2 (single-graph discipline), every citation in this policy traces upward to a regulatory source or bank objective. No orphaned claims.

### 9.3 Change log

| Version | Date | Authors | Change |
|---|---|---|---|
| v1.0 | 2026-05-11 | Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance) + Owen (Company Secretary, governance) | Initial standalone policy authored under W2 Slice 6 of `D-REGULATORY-READINESS-GATE-PLAN`. Establishes the recovery planning framework per Banks Act §§ 60-72 + PA D1/2015 + FSB Key Attributes. Sections: overarching policy (§1), scope and triplet coherence (§2), plan structure (§3), EWIs — 10 quantitative + 7 qualitative (§4), recovery options inventory — 6 capital + 6 liquidity + 3 business actions (§5), governance and escalation (§6), resolution preparedness and resolvability assessment (§7), annual review and PA submission (§8), obligations + citations + change log (§9). Closes `ORG-PR-30`, `ORG-PR-35`, `ORG-BNK-RECOVERY-CONS`. LICENCE-BIND. All unresolved regulatory sub-clause indices marked `[citation: TBC]` per Principle 2. |
