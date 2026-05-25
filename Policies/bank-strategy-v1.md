---
document-id: "policy:bank-strategy:v1"
title: "Hoz Bank — Institutional Strategy v1"
version: "1"
status: DRAFT — PENDING CEO APPROVAL
owner: CEO
effective-from: TBC — on CEO approval
next-review: "2027-05-22"
authors:
  - Chief of Staff (orchestration) — synthesised from governance-seat inputs
  - CRO (Chief Risk Officer, governance) — RAS, capital & risk appetite inputs
  - CFO (Chief Financial Officer, governance) — capital plan, financial targets
  - COO (Chief Operating Officer, governance) — operating model, technology
  - Head of Global Markets — product strategy, trading mandate
  - CoSec (Company Secretary, governance) — governance framework, licensing pathway
  - CCO (Chief Compliance Officer, governance) — compliance posture
  - Treasurer (governance) — capital structure, funding
date: 2026-05-22
decision-required: true
citations:
  - Banks Act 94 of 1990
  - Regulations Relating to Banks (2012, as amended)
  - Financial Markets Act 19 of 2012
  - BCBS Basel III/IV Capital Framework
  - PA Directive 5 of 2021
  - D-RAS
  - D-MARKETS-CAPITAL-TIME-SHAPE
  - D-TRADE-LIFECYCLE-IFRS-CHAIN
  - D-KYC-ONBOARDING-BUILD
  - D-FX-SALES-TRADING-FRONTEND
summary: >
  Inaugural strategy document for Hoz Bank Limited. Sets out the vision, business model,
  capital strategy, product scope, technology model, regulatory pathway, and build-phase
  milestones. Prepared for CEO review and formal approval. Closes the strategy-document
  gap identified at project inception; feeds into the pre-licence go-live readiness gate.
kind: other
---

# Hoz Bank — Institutional Strategy v1

**Author:** Chief of Staff (orchestration) — synthesised from governance-seat inputs  
**Date:** 2026-05-22  
**Status:** DRAFT — PENDING CEO APPROVAL  
**Approval authority:** CEO  
**Substrate gap noted:** No Chief Strategy Officer (CSO) on roster; this document is authored by the Chief of Staff as synthesiser of governance-seat inputs. Role Researcher to define the CSO role spec at the post-licence stage when strategic-planning headcount is warranted.

---

## 1. Executive Summary

Hoz Bank Limited is a South African bank-in-formation, pursuing a SARB licence under the Banks Act 94 of 1990. It is an AI-native institution designed to operate with a minimal statutory human headcount while deploying autonomous AI agents across all domains of banking operations, risk, compliance, finance, and technology.

The bank's business model is institutional and client-driven: it provides capital-markets access — principally JSE bonds and equities, OTC interest rate derivatives, and FX spot/forward — to institutional counterparties. It does not engage in proprietary trading, does not serve retail clients, and does not hold a direct NPS participant role. All payments route via a correspondent bank.

The bank's structural advantage is its technology model: events-first, cloud-native (Azure), and fully autonomous by design. This lowers marginal cost per trade and per compliance obligation relative to legacy-system peers, enabling a smaller but more efficient balance sheet to achieve returns commensurate with a significantly larger institution.

The bank targets R300m CET1 capital at licence-day, an institutional SA client base, and a single South African branch initially. Licence-day activates real capital, real clients, and the minimum statutory human workforce the law requires. Until then, the build phase proceeds entirely under engineering and governance substrate development.

---

## 2. Vision and Mission

### 2.1 Vision

To be South Africa's first autonomously-operated licensed bank: a precision, AI-native institution that provides institutional capital-markets services with a level of operational rigour, regulatory integrity, and technological coherence that legacy banks cannot replicate.

### 2.2 Mission

To build, licence, and operate a regulated South African bank that:

1. Serves institutional counterparties with world-class capital-markets execution across JSE bonds, equities, OTC IRD, and FX;
2. Operates its full governance, risk, compliance, finance, and operations stack via autonomous AI agents, supervised by the minimum statutory human complement the law requires;
3. Holds every financial, legal, and regulatory obligation as a first-class typed artefact in an events-first architecture, making regulatory audit a query rather than a document exercise;
4. Scales its capabilities through agent-model expansion rather than headcount growth; and
5. Demonstrates that AI-native banking is compatible with — and in key respects superior for — the regulatory expectations of the Prudential Authority and FSCA.

### 2.3 Operating principles

Six architectural principles govern every decision at every level of the bank. These are not aspirations — they are binding constraints on all deliverables:

| # | Principle | Summary |
|---|---|---|
| 1 | Events are the only source of truth | The event log is the single durable artefact; all positions, balances, and reports are queries over it |
| 2 | Single-graph discipline | Every artefact sits in one citable bidirectional graph; regulation → policy → procedure → system capability; no orphans |
| 3 | Cloud-native; nothing manual except where essential | IaC, coded workflows, Azure production target; full local build, single-phase migration |
| 4 | Security designed in from the start | Threat-modelled by design; zero-trust; aligned with PA/FSCA Joint Standard 2 of 2024 + POPIA |
| 5 | Multi-currency, multi-entity, multi-country from day one | Currency at the type level; entity in a versioned legal-entity tree; reporting currency is presentation, not data |
| 6 | Autonomous by default; humans oversee the residual | Every persona is a standing autonomous agent; human-in-the-loop steps carry P2 citations |

---

## 3. Market Positioning

### 3.1 Target market

Hoz Bank Limited operates in the **institutional capital-markets segment** of the South African financial system. Target counterparties include:

- South African institutional asset managers (pension funds, insurance companies, unit trusts);
- Corporate treasuries managing large balance-sheet FX and interest-rate exposures;
- Banks and broker-dealers requiring bilateral OTC derivative execution or bond/equity crossing; and
- International institutional counterparties with South African rand or JSE-listed instrument requirements.

The bank does **not** serve retail clients, does not hold a retail deposit base, and does not seek a FAIS FSP licence covering advisory services to natural persons. Its FSP and banking licence positioning is institutional throughout.

### 3.2 Competitive positioning

| Dimension | Hoz Bank positioning | Legacy bank contrast |
|---|---|---|
| Operational model | AI-native; minimal human headcount at scale | Large operations headcount; manual intervention-heavy |
| Technology stack | Events-first; Azure cloud; fully auditable by design | Legacy core banking; shadow reconciliation; siloed systems |
| Regulatory cost | Compliance as a query over the event store | Compliance as a recurring manual reporting exercise |
| Product scope | Positive enumeration; NPA gate for all additions | Broad legacy book with accumulated product complexity |
| Capital efficiency | CET1-focused; no AT1/T2 complexity at v1; tightly managed RWA | Multi-layer capital structures with legacy Tier 2 instruments |
| Client type | Institutional only; no retail | Mixed retail + institutional |

### 3.3 Geographic scope

South Africa is the sole jurisdiction at licence-day. A single Johannesburg branch is the operational anchor. The multi-entity and multi-currency substrate (Principle 5) means the architecture supports future expansion without structural rework; geographic expansion is a licence-day-plus decision, not a build-phase decision.

---

## 4. Business Model

### 4.1 Revenue model

The bank generates revenue from:

1. **Bid-offer spread income** on JSE bond and equity transactions for institutional clients;
2. **OTC IRD margin income** (client-driven interest rate swap and FRA intermediation);
3. **FX spot/forward spread income** from institutional FX flow; and
4. **Balance sheet income** from the treasury investment portfolio and overnight cash management.

The bank does **not** take proprietary risk positions. All market-risk exposure arises from client franchise activity (warehousing, hedge management) within the limits of the Trading Mandate (trading-mandate-v1.md).

### 4.2 Product scope (positive enumeration)

The bank's current approved product set — operative from commencement of trading, after each instrument's NPA gate is passed — is:

| Desk | Permissible instruments | Settlement |
|---|---|---|
| JSE Equity Desk | JSE Main Board and AltX listed equities; JSE-listed equity ETFs; rights and entitlements | T+3 (Strate equity settlement) |
| JSE Bond / Fixed Income Desk | RSA Government bonds (ILBs + nominals); SOE bonds; corporate bonds; repo/reverse-repo on eligible JSE bonds; JSE-listed bond ETFs | T+3 (Strate bond settlement) |
| OTC IRD Desk | ZAR fixed/floating interest rate swaps (IRS); forward rate agreements (FRAs) — all under ISDA 2002 Master Agreement + ZAR ISDA Schedule | T+2 cash (net settlement under CSA) |
| FX Desk | USD/ZAR, EUR/ZAR, GBP/ZAR spot (T+2); USD/ZAR, EUR/ZAR, GBP/ZAR outright forwards (≤ 12m) | T+2 / forward value date |

All instruments not listed above are impermissible until a New Product Approval gate is passed and this strategy document (and the Trading Mandate) are amended.

### 4.3 Payments and settlement

The bank is **not** a direct participant in the National Payment System (NPS). All payments route via a correspondent bank. The bank does not hold a SAMOS account and does not seek direct BankservAfrica membership in the build phase. This correspondent-bank model constrains settlement risk to a bilateral correspondent relationship rather than NPS-level systemic exposure.

### 4.4 Legal entity structure

| Entity | Role | Status |
|---|---|---|
| Hoz Group Limited | Controlling company | Incorporated (Hoz Group Limited) |
| Hoz Bank Limited | Licensed banking entity — all trading-franchise risk | SARB licence application pending |
| Hoz Securities Limited | JSE-member entity — equities execution | Incorporated; JSE member pending |

All trading-book risk is booked on the Hoz Bank Limited balance sheet during the build phase. A separate Hoz Securities Limited trading mandate will be produced when that entity's build phase approaches commencement-of-trading.

---

## 5. Capital Strategy

### 5.1 Licence-day capital structure

| Component | Target at licence-day | Notes |
|---|---|---|
| CET1 (Common Equity Tier 1) | R300m shareholder equity | Sole capital instrument at v1; no AT1 or T2 envisaged at launch |
| AT1 (Additional Tier 1) | Nil at v1 | Issuance conditions documented in capital-management-policy-v1.md for future optionality |
| Tier 2 | Nil at v1 | Issuance conditions documented for future optionality |

R300m is the capital-plan target established by the CFO in the founding capital plan (`capital-plan-v1.md`). This is the minimum required to support the initial balance-sheet size and RWA profile consistent with the approved Trading Mandate and risk appetite limits.

No real capital is committed or held in the build phase. The R300m target is a licence-day funding requirement; capital raising is a pre-licence gate item.

### 5.2 Capital adequacy targets

The bank operates a three-level capital target framework under the Risk Appetite Statement (D-RAS, CRO):

| RAS line | Definition | Target |
|---|---|---|
| B1 | CET1 ratio ≥ PA regulatory minimum + Pillar 2A + Capital Conservation Buffer + CCyB | Hard floor — breach is a Critical escalation |
| B2 | CET1 ratio ≥ B1 + 1.5pp management buffer (calibration pending W2 Slice 2) | Management buffer — breach initiates capital-action review |
| Total capital ratio | Total capital / RWA ≥ PA total capital minimum | Supporting constraint |

The CET1-dominant structure means total capital and CET1 ratios are effectively identical at v1. The bank targets significant headroom above the B1 floor given its small balance-sheet size relative to capitalisation; the current (build-phase estimate) CET1 ratio is in excess of 400% given the minimal RWA base during the pre-client build phase.

### 5.3 Capital governance

- **ICAAP:** Annual internal capital adequacy assessment, co-chaired by CFO and CRO. First annual cycle: Q3 2027 (post first full year of trading).
- **BRC review:** Quarterly Board Risk Committee review of capital position and stress results. Cycle 1: 2026-08-04.
- **Distribution controls:** No distributions that would breach B2 without prior Board approval. Full Maximum Distributable Amount (MDA) discipline from commencement of trading.

---

## 6. Technology and Operating Model

### 6.1 Technology architecture

The bank's technology architecture is founded on three properties that are non-negotiable across the full build phase and into live operation:

1. **Events-first (Principle 1).** Every financial, legal, operational, and regulatory artefact is a typed, immutable event appended to a shared event store. Balances, positions, and reports are projections over events — never stored state. This makes the audit trail a structural property of the system, not a reporting afterthought.

2. **Cloud-native on Azure (Principle 3).** Production infrastructure is Microsoft Azure (Entra ID for identity; Key Vault Managed HSM for key ceremonies; Cosmos DB / Postgres for the event store; Azure Container Apps for the agent runtime). All local development is built to be lift-compatible: the file-path-based local event store is structurally identical to the Azure Cosmos/Postgres target.

3. **Autonomous by default (Principle 6).** Every operational domain — risk, compliance, finance, operations, technology, audit — is run by a standing autonomous AI agent. Human intervention is reserved for the residual decisions the law requires a natural person to make (statutory director sign-offs, regulatory filings, material capital actions). This is not a cost-cutting measure; it is the bank's structural moat.

### 6.2 Agent fleet

The bank operates a fleet of 29 autonomous agents covering all functional domains:

| Domain | Agents |
|---|---|
| Engineering (substrate) | Atlas (platform), Bea (accounting/GL), Mira (compliance/RegTech), Kai (trading systems), Rohan (risk), Nadia (independent validation), Tomas (ops/payments), Imani (legal-as-code), Sade (AgentOps), Niko (CRM), Yael (tax), Vera (audit), Senna (security), Ravi (treasury/ALM), Anya (data/analytics), Env (environment simulator), Noa (intranet) |
| Governance | CRO, CoSec, CCO, IO, COO, CFO, Treasurer, Head of Global Markets, CAE, CISO |
| Orchestration | Chief of Staff |
| Operations (support) | Role Researcher, Recruiter |

Each agent operates under a formal 17-section operating spec in `/Team/`, defining cadence, triggers, inputs, decision scope, escalation paths, outputs, and substrate gaps.

### 6.3 Human layer at licence-day

The bank targets the minimum statutory human headcount the law requires. Current estimate: **5–10 humans total**, comprising:

- At least two non-executive directors (Banks Act corporate-governance requirements);
- CEO (concurrent with the build phase);
- MLRO + FIC Compliance Officer (FIC Act requirement; statutory natural person);
- Information Officer (POPIA; may be the CEO if permitted);
- External auditor (SARB / Companies Act requirement);
- FAIS key individual(s) where required by the FSP licence scope.

Payroll, EMP201, IRP5, and employment-contracts are build-phase-paused items; they activate at licence-day when the statutory minimum human workforce is constituted.

### 6.4 Build-phase substrate milestones

The build phase ends at the **pre-licence go-live readiness gate**, co-owned by Head of Global Markets, COO, and CISO. Key substrate milestones en route:

| Milestone | Owner | Status |
|---|---|---|
| KYC onboarding substrate (D-KYC-ONBOARDING-BUILD) | Platform / Compliance-RegTech | Complete (PR #532–536) |
| FX sales/trading frontend (D-FX-SALES-TRADING-FRONTEND) | Trading Systems / Head of Global Markets | 7/8 slices complete |
| Trade lifecycle + IFRS chain (D-TRADE-LIFECYCLE-IFRS-CHAIN) | Trading Systems / Accounting-GL | Complete (PRs #549–556) |
| Credit-limit engine (D-CREDIT-LIMIT-ENGINE-BUILD) | Risk / CRO | Complete (PRs #611–624) |
| Market data substrate | Treasury-ALM / Data-Analytics | Complete (PRs #686–688) |
| RMS Phase 1–4 (records management substrate) | Platform / CoSec | Complete |
| LCR/NSFR measurement substrate | Treasury-ALM | Pending (before BRC Cycle 1) |
| CET1 RWA engine | Accounting-GL | Pending (before BRC Cycle 1) |
| Climate-risk substrate specification | CRO | Due 2026-07-15 |
| Pre-licence go-live readiness gate | Head of Global Markets · COO · CISO | Not started — pending substrate completion |

---

## 7. Risk Appetite and Governance

### 7.1 Risk appetite framework

The bank's Risk Appetite Statement (D-RAS, CEO-approved 2026-05-06) sets quantitative and qualitative limits across 13 appetite lines covering capital adequacy, liquidity, market risk, credit risk, operational risk, model risk, conduct risk, compliance risk, and ESG / climate. The RAS is the primary governance instrument anchoring all risk-taking decisions.

Key appetite lines as of D-RAS:

| Line | Metric | Threshold | Status |
|---|---|---|---|
| B1 | CET1 ratio | ≥ regulatory min + P2A + CCB + CCyB | Monitored |
| B2 | CET1 management buffer | +1.5pp above B1 (calibration pending) | Calibration pending |
| B3 | LCR | ≥ 100% | Measurement substrate pending |
| B4 | NSFR | ≥ 100% | Measurement substrate pending |
| B5 | Market risk (VaR) | Per desk limits (calibration pending BRC Cycle 1) | Trading mandate sets desk scope |
| B6 | Single counterparty credit concentration | ≤ regulatory large-exposure limit | Credit-limit engine live |

### 7.2 Governance structure

| Body | Function | Cadence |
|---|---|---|
| CEO (interim Board) | Approves all material decisions; sole Board seat in build phase | Continuous |
| Board Risk Committee (BRC) | Reviews RAS, stress results, capital adequacy | Quarterly; first cycle 2026-08-04 |
| Audit Forum (Interim; CoSec chair) | Receives internal audit findings; oversees CAE function | Periodic |
| ALCO (Treasurer chair) | Reviews capital, liquidity, ALM, and treasury positions | Monthly |

A full Board (including independent NEDs) is constituted at licence-day. All Board-reserved decisions are CEO-interim in the build phase under `D-THIN-HUMAN-LAYER-MINIMUM`.

### 7.3 Three-lines-of-defence model

- **First line:** All agents in the engineering and markets domains operate within policy and procedure constraints encoded in the substrate. Risk is owned at source.
- **Second line:** CRO, CCO, and their engineering counterparts (Risk, Compliance-RegTech, Independent Validation) provide independent oversight, risk appetite monitoring, and compliance assurance.
- **Third line:** CAE and the Audit engineer provide independent audit assurance. The CAE reports functionally to the Interim Audit Forum and administratively through the CEO; third-line independence is non-negotiable.

---

## 8. Regulatory and Licensing Strategy

### 8.1 Primary regulatory framework

| Regulator | Act / Instrument | Primary obligations |
|---|---|---|
| Prudential Authority (SARB) | Banks Act 94 of 1990; Regulations Relating to Banks | Banking licence; capital adequacy; liquidity; large-exposure limits; ICAAP/ILAAP |
| Financial Sector Conduct Authority (FSCA) | Financial Markets Act 19 of 2012; FAIS Act 37 of 2002 | Market-conduct; FSP licence for advisory/intermediary services |
| Financial Intelligence Centre (FIC) | FIC Act 38 of 2001 | AML/CFT; STR/CTR/TPR filing; EDD; KYC obligations |
| Information Regulator | POPIA (Act 4 of 2013) | Information Officer designation; POPIA compliance; data subject rights |
| JSE | JSE Equities Rules and Directives | Trading-member obligations (through Hoz Securities Limited) |

### 8.2 Licensing pathway

1. **Build phase (current):** Substrate development; regulatory-readiness gate preparation; pre-application engagement with SARB/PA planned.
2. **Pre-licence readiness gate:** Co-owned by Head of Global Markets, COO, CISO. Gate conditions: full policy/procedure/system-capability chain complete; ICAAP/ILAAP framework complete; capital raised and in custody; minimum human layer constituted; legal opinions on netting enforceability obtained (Legal as Code + external counsel).
3. **Licence application:** Submission to PA with full application pack. External legal counsel (Bowmans or equivalent) engaged at this stage. Expected to include: business plan, capital structure evidence, governance framework, RAS, ICAAP/ILAAP summary, IT security assessment (PA GN 3/FAIS Joint Standard 2).
4. **Licence-day:** SARB grants banking licence. Real capital received. Real client onboarding begins. Minimum human workforce constituted.

### 8.3 Compliance posture

The bank's compliance model is **proactive and technology-led**: obligations are encoded as typed artefacts in the substrate; the Compliance/RegTech engineer maintains the obligations register; CCO owns the regulatory relationship. Compliance monitoring is autonomous via continuous recon pipelines (Audit + Compliance-RegTech), not periodic manual review.

Key postures:
- **AML/CFT:** Full KYC substrate live; institutional-counterparty EDD; no high-risk-jurisdiction or PEP onboarding without enhanced review; STR/CTR/TPR filing by autonomous agent under CCO oversight.
- **FAIS:** Fit-and-proper policy live; conflict-of-interest policy live; TCF policy live; no retail advisory.
- **Excon:** FX compliance per SARB Exchange Control Regulations; CISO authored the Excon compliance assessment.
- **Market conduct:** Insider trading and PA-dealing policy live; Accounting-GL and Trading Systems operate under surveillance hooks.

---

## 9. Financial Targets and Build-Phase Economics

### 9.1 Build-phase cost structure

The bank's primary current cost is **Anthropic API token spend** — the largest real cash outlay in the build phase, billed monthly. CEO's time is the binding human resource. Engineering substrate is real work; the cost is compute and API usage.

All other costs (legal counsel, auditor, insurance, payroll) are deferred to the licence-application moment or licence-day as appropriate.

### 9.2 Revenue and P&L (post licence-day targets)

Licence-day financial targets will be set at the pre-licence readiness gate by the CFO in the inaugural budget and ICAAP. The strategy does not prescribe specific revenue targets in the build phase; the focus is on building the substrate required to support a profitable institutional capital-markets franchise at the right capital efficiency.

Indicative framework:
- Net interest income: minimal (no deposit franchise; treasury book income only);
- Non-interest income: spread income on JSE and OTC client flows (primary income driver);
- Operating leverage: AI-native model targets high revenue-per-head ratios; headcount is structurally capped at the statutory minimum.

### 9.3 Horizon

| Milestone | Target timing | Owner |
|---|---|---|
| Pre-licence readiness gate | To be confirmed at BRC Cycle 1 (2026-08-04) | Head of Global Markets · COO · CISO |
| Licence application submission | After readiness gate | CEO · Legal as Code · CoSec |
| SARB licence grant | Regulator-determined | PA |
| Licence-day operations | After licence grant | All agents |
| First annual ICAAP/ILAAP | Q3 2027 | CRO · CFO |
| Board constitution (full NEDs) | At or before licence-day | Recruiter · CoSec |

---

## 10. Strategic Risks and Mitigants

| Risk | Description | Mitigant |
|---|---|---|
| Licence risk | PA may require modifications to governance structure, human headcount, or capital | Proactive PA engagement at pre-application stage; CoSec leading governance framework |
| AI regulatory risk | Regulatory uncertainty around AI-operated banks; PA may require human decision-maker for specific categories | Six Principles are designed for regulatory coherence; Principle 6 explicitly identifies human-in-the-loop steps; escalation channels are first-class typed artefacts |
| Capital-raising risk | R300m target may be difficult to raise in current market conditions | Capital plan is the CEO's direct responsibility; early engagement with institutional investors post-readiness-gate |
| Technology dependency | Single AI model provider (Anthropic) creates vendor concentration risk | AgentOps monitoring token efficiency; architecture is model-agnostic at the agent-interface level; migration path documented |
| Substrate completion risk | Multiple substrate milestones incomplete; readiness gate may slip | Recon pipelines continuously measure coverage gaps; backlog is managed against BRC Cycle 1 deadline |
| Talent risk (statutory humans) | Finding the minimum legal minimum of humans willing to serve as directors/officers of an AI-operated bank | Build-phase recruitment planning under the Recruiter; governance framework documents the limited scope of human decision-making required |

---

## 11. Substrate Gap — Chief Strategy Officer

No Chief Strategy Officer (CSO) is currently on the team roster. This document was authored by the Chief of Staff as a synthesis of governance-seat inputs. The CSO function covers:

- Multi-year strategic planning;
- Competitive landscape and product strategy;
- Strategic M&A and partnership identification;
- Investor and board narrative.

**Recommendation:** The CSO function is a licence-day-plus role. During the build phase, strategy is CEO-owned with Chief of Staff synthesis. Role Researcher to define the CSO role spec at the appropriate point in the post-licence roadmap.

**Action:** CoSec to register this substrate gap in the governance framework. No immediate hire required.

---

## 12. Approval and Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 DRAFT | 2026-05-22 | Chief of Staff (orchestration) | Initial draft — synthesis of governance-seat inputs; submitted for CEO review and approval |

**Approval required from:** CEO  
**Approval method:** In-session CEO confirmation triggers `Decision(approved)` event via `recordDecision` with `decisionId: D-BANK-STRATEGY-V1`.  
**Approval action:** Chief of Staff records the decision, updates this document to `status: APPROVED`, and dispatches CoSec (Company Secretary) to register the strategy document in the governance framework register.
