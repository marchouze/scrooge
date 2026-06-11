---
document-id: "policy:bank-strategy:v2"
title: "Hoz Bank — Institutional Strategy v2"
version: "2"
status: DRAFT — PENDING CEO APPROVAL
owner: CEO
effective-from: TBC — on CEO approval
next-review: "2027-06-11"
supersedes: "policy:bank-strategy:v1"
authors:
  - Chief of Staff (orchestration) — synthesised from governance-seat inputs
  - CRO (Chief Risk Officer, governance) — RAS, capital & risk appetite inputs
  - CFO (Chief Financial Officer, governance) — capital plan, financial targets
  - COO (Chief Operating Officer, governance) — operating model, technology
  - Head of Global Markets — product strategy, trading mandate
  - CoSec (Company Secretary, governance) — governance framework, licensing pathway, typed-scope appendix
  - CCO (Chief Compliance Officer, governance) — compliance posture
  - Treasurer (Eitan, governance) — capital structure, funding, ALCO, contingency funding, intraday liquidity
date: 2026-06-11
decision-required: true
citations:
  - "urn:reg:za:banks-act-94-1990"
  - "urn:reg:za:fais-act-37-2002"
  - "urn:reg:za:fic-act-38-2001"
  - "urn:reg:bcbs:bcbs-248"
  - Regulations Relating to Banks (2012, as amended)
  - Financial Markets Act 19 of 2012
  - BCBS Basel III/IV Capital Framework
  - D-RAS
  - D-RAS-STRUCTURED-REGISTER
  - D-BOND-RAS-APPETITE
  - D-INTRADAY-RAS-APPETITE
  - D-TREASURER-WAVE1-SUBSTRATE
  - D-REGULATORY-LIBRARY-V1
  - D-NEW-PRODUCT-APPROVAL-POLICY
  - D-FX-OTC-NPA-SCOPE-EXPANSION
  - D-MARKETS-CAPITAL-TIME-SHAPE
  - D-TRADE-LIFECYCLE-IFRS-CHAIN
  - D-KYC-ONBOARDING-BUILD
  - D-FX-SALES-TRADING-FRONTEND
summary: >
  Strategy refresh for Hoz Bank Limited, superseding the v1 DRAFT of 2026-05-22
  (which was never approved; D-BANK-STRATEGY-V1 was never recorded). Brings the
  strategy current with substrate and governance progress to 2026-06-11 — typed
  product scope (OTC vanilla FX umbrella), 17-line structured RAS register,
  Treasurer governance substrate, regulatory library v1 — and adds a
  machine-extractable typed-scope appendix (§13) that a typed strategy register
  will encode 1:1. Pending CEO approval under decisionId D-BANK-STRATEGY-V2.
kind: other
---

# Hoz Bank — Institutional Strategy v2

**Author:** Scrooge (Chief of Staff, orchestration) — synthesised from governance-seat inputs; typed-scope appendix authored by Owen (Company Secretary, governance)  
**Date:** 2026-06-11  
**Status:** DRAFT — PENDING CEO APPROVAL  
**Approval authority:** CEO  
**Approval decisionId:** `D-BANK-STRATEGY-V2`  
**Supersedes:** `Policies/bank-strategy-v1.md` (v1 DRAFT, 2026-05-22 — never approved; `D-BANK-STRATEGY-V1` was never recorded)  
**Substrate gap noted:** No Chief Strategy Officer (CSO) on roster; this document is authored by the Chief of Staff as synthesiser of governance-seat inputs (see §11).

---

## 1. Executive Summary

Hoz Bank Limited is a South African bank-in-formation, pursuing a SARB licence under the Banks Act 94 of 1990. It is an AI-native institution designed to operate with a minimal statutory human headcount while deploying autonomous AI agents across all domains of banking operations, risk, compliance, finance, and technology.

The bank's business model is institutional and client-driven: it provides capital-markets access — principally JSE bonds, OTC interest rate derivatives, and OTC vanilla FX (spot, forward, swap) — to institutional counterparties. It does not engage in proprietary trading, does not serve retail clients, and does not hold a direct NPS participant role. All payments route via a correspondent bank.

The bank's structural advantage is its technology model: events-first, cloud-native (Azure), and fully autonomous by design. This lowers marginal cost per trade and per compliance obligation relative to legacy-system peers, enabling a smaller but more efficient balance sheet to achieve returns commensurate with a significantly larger institution.

The bank targets R300m CET1 capital at licence-day, an institutional SA client base, and a single South African branch initially. Licence-day activates real capital, real clients, and the minimum statutory human workforce the law requires. Until then, the build phase proceeds entirely under engineering and governance substrate development.

New at v2: the strategy's scope statements are now **machine-extractable**. §13 enumerates the mandated business activities, per-desk product permissions, client segments, exclusions, jurisdictions, and defined terms as typed tables keyed by canonical codes. A typed strategy register (`prototype/platform/strategy/register.ts`, built in a follow-on PR) will encode §13 1:1, making strategy-conformance a recon query rather than a document-reading exercise (Principle 2).

---

## 2. Vision and Mission

### 2.1 Vision

To be South Africa's first autonomously-operated licensed bank: a precision, AI-native institution that provides institutional capital-markets services with a level of operational rigour, regulatory integrity, and technological coherence that legacy banks cannot replicate.

### 2.2 Mission

To build, licence, and operate a regulated South African bank that:

1. Serves institutional counterparties with world-class capital-markets execution across JSE bonds, OTC IRD, and FX;
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

- South African institutional asset managers (pension funds, insurance companies, unit trusts) — `SEG-INST-ASSET-MANAGER` (§13.3);
- Corporate treasuries managing large balance-sheet FX and interest-rate exposures — `SEG-CORP-TREASURY` (§13.3);
- Banks and broker-dealers requiring bilateral OTC derivative execution or bond crossing — `SEG-BANK-BROKER-DEALER` (§13.3); and
- International institutional counterparties with South African rand or JSE-listed instrument requirements — `SEG-INTL-INSTITUTIONAL` (§13.3).

The bank does **not** serve retail clients, does not hold a retail deposit base, and does not seek a FAIS FSP licence covering advisory services to natural persons. Its FSP and banking licence positioning is institutional throughout. Counterparty eligibility is carried as a typed field on every approved product (`counterpartyEligibility: "institutional"` — see §4.2 and §13.2).

### 3.2 Competitive positioning

| Dimension | Hoz Bank positioning | Legacy bank contrast |
|---|---|---|
| Operational model | AI-native; minimal human headcount at scale | Large operations headcount; manual intervention-heavy |
| Technology stack | Events-first; Azure cloud; fully auditable by design | Legacy core banking; shadow reconciliation; siloed systems |
| Regulatory cost | Compliance as a query over the event store | Compliance as a recurring manual reporting exercise |
| Product scope | Positive enumeration; NPA gate for all additions; typed productScope fields | Broad legacy book with accumulated product complexity |
| Capital efficiency | CET1-focused; no AT1/T2 complexity at v2; tightly managed RWA | Multi-layer capital structures with legacy Tier 2 instruments |
| Client type | Institutional only; no retail | Mixed retail + institutional |

### 3.3 Geographic scope

South Africa is the sole jurisdiction at licence-day (§13.5). A single Johannesburg branch is the operational anchor. The multi-entity and multi-currency substrate (Principle 5) means the architecture supports future expansion without structural rework; geographic expansion is a licence-day-plus decision, not a build-phase decision.

---

## 4. Business Model

### 4.1 Revenue model

The bank generates revenue from:

1. **Bid-offer spread income** on JSE bond transactions for institutional clients;
2. **OTC IRD margin income** (client-driven interest rate swap and FRA intermediation);
3. **FX spread income** from institutional OTC vanilla FX flow (spot, forward, swap); and
4. **Balance sheet income** from the treasury investment portfolio and overnight cash management.

The bank does **not** take proprietary risk positions. All market-risk exposure arises from client franchise activity (warehousing, hedge management) within the limits of the Trading Mandate (trading-mandate-v1.md).

### 4.2 Product scope (positive enumeration)

The product set below reflects the typed product register at `prototype/platform/markets/products/` as at 2026-06-11. Each product carries a canonical `productId`, a `ProductFamily`, and a derived NPA lifecycle stage; scope axes (instrument variants, currency pairs, counterparty eligibility, execution venue) are carried in typed `scope` fields, not narrative prose.

| Desk | Product (canonical id) | Family | NPA lifecycle | Permissible instruments | Settlement |
|---|---|---|---|---|---|
| JSE Bond / Fixed Income Desk | `prd:bank:bond:sagb-fixed-coupon` | `listed-bond` | conceptualised | SAGB fixed-coupon bonds | T+3 (Strate bond settlement) |
| JSE Bond / Fixed Income Desk | `prd:bank:treasury:repo-sagb-term` | `repo` | conceptualised | SAGB-backed term repo / reverse repo under GMRA 2011 | Per repo term |
| OTC IRD Desk | `prd:bank:otc-ird:vanilla-irs-zar` | `otc-ird` | conceptualised | ZAR fixed/floating vanilla IRS (JIBAR/ZARONIA floating leg) under ISDA 2002 Master Agreement + ZAR Schedule; FRAs named in the desk mandate (no typed product fixture yet — see §13.6 STERM-FRA) | Net cash settlement |
| FX Desk | `prd:bank:fx:otc-vanilla` | `fx` | **approved-conditional** | OTC vanilla FX umbrella — typed scope: execution venue OTC; instrument variants **spot, forward, swap**; currency pairs **any**; counterparty eligibility **institutional**. **FX option is NOT approved** — named in target scope only, joins at v1.1 once the M5 option-pricing substrate lands | T+2 (spot) to T+N (forward/swap far leg); PvP via CLS-member correspondent where physical; cash for NDF |
| Treasury (funding) | `prd:bank:treasury:mmd-deposit` · `prd:bank:treasury:funding-line` · `prd:bank:treasury:ibl-placement` | `money-market` · `interbank-loan` | conceptualised | Wholesale money-market deposits, committed funding lines, interbank loan placements — funding instruments, not client franchise products | Per instrument |

Notes:

- The OTC vanilla FX umbrella (`prd:bank:fx:otc-vanilla`, D-FX-OTC-NPA-SCOPE-EXPANSION) supersedes the earlier single-pair FX products as the FX desk's scope-bearing product. Its `approved-conditional` lifecycle carries tracked deferred gaps under the "approved with tracked deferred gaps" NPA pattern; the legacy `prd:bank:fx:fx-spot-zar-usd` fixture remains in the register at `conceptualised`.
- The Trading Mandate (trading-mandate-v1.md) constrains operational execution within the typed product scope. FX tenor carries **no mandate cap**: outright forward and swap tenor is governed by the typed product scope (T+2 to T+N) and the RAS market-risk appetite lines (§7.1), not by a fixed tenor ceiling (CEO in-session instruction 2026-06-11; Trading Mandate aligned at v1.1).
- JSE cash equity (`prd:bank:equity:jse-equity-cash`, family `listed-equity`) is **removed from scope at v2** (CEO in-session instruction 2026-06-11). The family is reserved with zero permissions (§13.2); reactivation requires the Hoz Securities Limited JSE-membership pathway (§4.4), an NPA gate pass, and amendment of this strategy (§13.4 `EXCL-LISTED-EQUITY`).
- `structured` products (M5+) and OTC credit derivatives are reserved families — out of scope at v2 (§13.4).

**All instruments not listed above are impermissible until a New Product Approval gate is passed and this strategy document (and the Trading Mandate) are amended.**

### 4.3 Payments and settlement

The bank is **not** a direct participant in the National Payment System (NPS). All payments route via a correspondent bank. The bank does not hold a direct NPS settlement account and does not seek direct BankservAfrica membership in the build phase. This correspondent-bank model constrains settlement risk to a bilateral correspondent relationship rather than NPS-level systemic exposure. The model maps to activity codes `ACT-BANK-PAYMENT` (correspondent / sponsor-bank channel, indirect NPS participant posture) and `ACT-BANK-NOSTRO` (§13.1).

### 4.4 Legal entity structure

| Entity | Role | Status |
|---|---|---|
| Hoz Group Limited | Controlling company | Incorporated (Hoz Group Limited) |
| Hoz Bank Limited | Licensed banking entity — all trading-franchise risk | SARB licence application pending |
| Hoz Securities Limited | JSE-member entity (equities-execution pathway **deferred**) | Incorporated; JSE-membership pathway deferred |

All trading-book risk is booked on the Hoz Bank Limited balance sheet (`LE-BANK-SA` in the typed product register) during the build phase.

**Hoz Securities Limited — pathway deferred.** The entity remains incorporated, but its JSE-membership / equities-execution pathway is **deferred** at v2: JSE cash equity is removed from the strategy's mandated scope (CEO in-session instruction 2026-06-11; §13.4 `EXCL-LISTED-EQUITY`). Reactivation of the pathway requires an NPA gate pass for the equity product and amendment of this strategy. A Hoz Securities Limited trading mandate will be produced only if and when that reactivation is approved.

---

## 5. Capital Strategy

### 5.1 Licence-day capital structure

| Component | Target at licence-day | Notes |
|---|---|---|
| CET1 (Common Equity Tier 1) | R300m shareholder equity | Sole capital instrument at v2; no AT1 or T2 envisaged at launch |
| AT1 (Additional Tier 1) | Nil at v2 | Issuance conditions documented in capital-management-policy-v1.md for future optionality |
| Tier 2 | Nil at v2 | Issuance conditions documented for future optionality |

R300m is the capital-plan target established by Camille (Chief Financial Officer, governance) in the founding capital plan (`capital-plan-v1.md`). This is the minimum required to support the initial balance-sheet size and RWA profile consistent with the approved Trading Mandate and risk appetite limits.

No real capital is committed or held in the build phase. The R300m target is a licence-day funding requirement; capital raising is a pre-licence gate item.

### 5.2 Capital adequacy targets

Capital appetite is now carried in the structured RAS register (`prototype/platform/risk/ras-appetite-register.ts`, D-RAS-STRUCTURED-REGISTER) — see §7.1. The capital-category lines as encoded:

| RAS line | Definition | Threshold (as encoded) |
|---|---|---|
| `appetite:capital:cet1-buffer` (tier-1) | CET1 buffer over PA minimum | Operate above PA min + Pillar 2A + CCB + 1.5pp; trigger at PA min + 0.75pp; escalate at PA min + 0.25pp |
| `appetite:capital:leverage-ratio` (tier-1) | Basel III leverage ratio (Tier-1 / total exposure) | green ≥4.5% / amber 4.0–4.5% / red 3.5–4.0% / critical <3.5% |

The CET1-dominant structure means total capital and CET1 ratios are effectively identical at v2. The bank targets significant headroom above the regulatory floor given its small balance-sheet size relative to capitalisation during the pre-client build phase.

RWA is now computed by a live engine: the `RwaComputed` event-of-record (`prototype/platform/risk/rwa-computed-engine.ts`) decomposes credit, market, and operational RWA; the BA 700 capital-adequacy return reads the event-of-record via `readRwaDecompositionOfRecord`, with `recon:rwa-computed-sourcing` guarding against fixture-rendering when a live event exists.

### 5.3 Capital governance

- **ICAAP:** Annual internal capital adequacy assessment, co-chaired by Camille (CFO) and Helena (Chief Risk Officer, governance). First annual cycle: Q3 2027 (post first full year of trading).
- **BRC review:** Quarterly Board Risk Committee review of capital position and stress results. Cycle 1: 2026-08-04.
- **Distribution controls:** No distributions that would breach the CET1 management buffer without prior Board approval. Full Maximum Distributable Amount (MDA) discipline from commencement of trading.

---

## 6. Technology and Operating Model

### 6.1 Technology architecture

The bank's technology architecture is founded on three properties that are non-negotiable across the full build phase and into live operation:

1. **Events-first (Principle 1).** Every financial, legal, operational, and regulatory artefact is a typed, immutable event appended to a shared event store. Balances, positions, and reports are projections over events — never stored state. This makes the audit trail a structural property of the system, not a reporting afterthought.

2. **Cloud-native on Azure (Principle 3).** Production infrastructure is Microsoft Azure (Entra ID for identity; Key Vault Managed HSM for key ceremonies; Cosmos DB / Postgres for the event store; Azure Container Apps for the agent runtime). All local development is built to be lift-compatible: the file-path-based local event store is structurally identical to the Azure Cosmos/Postgres target.

3. **Autonomous by default (Principle 6).** Every operational domain — risk, compliance, finance, operations, technology, audit — is run by a standing autonomous AI agent. Human intervention is reserved for the residual decisions the law requires a natural person to make (statutory director sign-offs, regulatory filings, material capital actions). This is not a cost-cutting measure; it is the bank's structural moat.

### 6.2 Agent fleet

The bank operates a fleet of 31 autonomous agents covering all functional domains (canonical source: `Team/_team-roster.json`):

| Domain | Agents |
|---|---|
| Engineering (substrate) | Atlas (platform), Bea (accounting/GL), Mira (compliance/RegTech), Kai (trading systems), Rohan (risk), Nadia (independent validation), Tomas (ops/payments), Imani (legal-as-code), Sade (AgentOps), Niko (CRM — paused), Yael (tax), Vera (audit), Senna (security), Ravi (treasury/ALM), Anya (data/analytics), Env (environment simulator), Noa (intranet), Linnea (brand & design) |
| Governance | Helena (CRO), Owen (CoSec), Zara (CCO), Iris (IO), Devon (COO), Camille (CFO), Eitan (Treasurer), Saskia (Head of Global Markets), Thandiwe (CAE), Rashida (CISO) |
| Orchestration | Scrooge (Chief of Staff) |
| Operations (support) | PAX (Role Researcher), Nolan (Recruiter) |

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

The build phase ends at the **pre-licence go-live readiness gate**, co-owned by Saskia (Head of Global Markets, governance), Devon (Chief Operating Officer, governance), and Rashida (Chief Information Security Officer, governance). Key substrate milestones as at 2026-06-11:

| Milestone | Owner | Status |
|---|---|---|
| KYC onboarding substrate (D-KYC-ONBOARDING-BUILD) | Platform / Compliance-RegTech | Complete (per v1; carried) |
| FX sales/trading frontend (D-FX-SALES-TRADING-FRONTEND) | Trading Systems / Head of Global Markets | 7/8 slices complete (per v1; not re-verified at v2) |
| Trade lifecycle + IFRS chain (D-TRADE-LIFECYCLE-IFRS-CHAIN) | Trading Systems / Accounting-GL | Complete (per v1; carried) |
| Credit-limit engine (D-CREDIT-LIMIT-ENGINE-BUILD) | Risk / CRO | Complete — live at `platform/risk/credit-limit-engine/` |
| Market data substrate | Treasury-ALM / Data-Analytics | Complete (per v1; carried) |
| RMS Phase 1–4 (records management substrate) | Platform / CoSec | Complete |
| LCR/NSFR measurement substrate | Treasury-ALM | **Live** — `platform/liquidity/lcr.ts` + `nsfr.ts` engines; BA 300 LCR/NSFR reporting adapters; RAS lines bound to `computeLCR` / `computeNSFR` |
| CET1 RWA engine | Risk / Accounting-GL | **Live** — `RwaComputed` event-of-record (`platform/risk/rwa-computed-engine.ts`); BA 700 reads `readRwaDecompositionOfRecord`; `recon:rwa-computed-sourcing` standing |
| Regulatory returns wiring | Compliance-RegTech / Treasury-ALM | **In progress** — live return subscribers under `platform/returns/` (BA 300, BA 320, BA 330, BA 400, BA 700 + climate/CMS/conduct/counterparty-exposure); Wave 2 (BA 300 NSFR component, BA 330 IRRBB subscriber) merged 2026-06-11 |
| Regulatory library v1 (D-REGULATORY-LIBRARY-V1) | Compliance-RegTech | **Complete** — 15/15 active sources acquired (`Regulations/_source-coverage.json`); `recon:regulatory-source-coverage` and golden-source integrity gates ENFORCING from 2026-06-11 |
| Treasurer Wave-1 substrate (D-TREASURER-WAVE1-SUBSTRATE) | Treasury-ALM / Treasurer | **Complete** — CFP triggers + EWI (`platform/alm/cfp-ewi.ts`, `recon:cfp-trigger-coverage`); BCBS 248 intraday metrics (`platform/alm/intraday-liquidity-metrics.ts`); intraday RAS line (§7.1) |
| Climate-risk substrate specification | CRO | Due 2026-07-15 (per v1; carried) |
| Pre-licence go-live readiness gate | Head of Global Markets · COO · CISO | Not started — pending substrate completion |

---

## 7. Risk Appetite and Governance

### 7.1 Risk appetite framework

The bank's Risk Appetite Statement (D-RAS, CEO-approved 2026-05-06) is now carried as a **structured, typed register**: `prototype/platform/risk/ras-appetite-register.ts` (D-RAS-STRUCTURED-REGISTER, CEO-approved 2026-06-08) is the single source for every appetite line — id, label, category, breach tier, structured thresholds, measurement binding, and citations. The register holds **17 typed appetite lines**: 14 extracted byte-faithfully from D-RAS, plus 2 bond-trading lines (D-BOND-RAS-APPETITE, CRO-approved 2026-06-08) and 1 intraday-liquidity line (D-INTRADAY-RAS-APPETITE, CRO-approved 2026-06-11, under D-TREASURER-WAVE1-SUBSTRATE).

The 17 lines by category and breach tier (RAS §B9 taxonomy: tier-1 / tier-2 / zero-appetite):

| Category | Line id | Label | Tier |
|---|---|---|---|
| Liquidity | `appetite:liquidity:lcr` | LCR buffer (green ≥120% / critical <105%) | tier-1 |
| Liquidity | `appetite:liquidity:nsfr` | NSFR buffer (green ≥115% / critical <103%) | tier-1 |
| Liquidity | `appetite:liquidity:intraday` | Intraday liquidity usage — BCBS 248 peak usage vs available (green <60% / red ≥80% / critical ≥100%); governed intraday HQLA floor R50m | tier-1 |
| Capital | `appetite:capital:cet1-buffer` | CET1 buffer over PA min | tier-1 |
| Capital | `appetite:capital:leverage-ratio` | Basel III leverage ratio | tier-1 |
| Credit | `appetite:credit:single-name-concentration` | Single-name credit concentration | tier-2 |
| Credit | `appetite:credit:sector-concentration` | Sector concentration | tier-2 |
| Market | `appetite:market:trading-var` | Trading-book 1-day 99% VaR | tier-2 |
| Market | `appetite:market:counterparty-concentration` | Counterparty concentration (markets) | tier-2 |
| Market | `appetite:market:bond-inventory-face-value` | Gross long bond inventory cap — trading book face value (amber R140m / red R200m) | tier-2 |
| IRRBB | `appetite:irrbb:delta-eve-outlier` | IRRBB δEVE outlier — BCBS d365 §A-3.4 supervisory test (amber 10% / red 15% of Tier-1) | tier-1 |
| Financial crime | `appetite:financial-crime:sanctions-match` | Sanctions true-positives blocked end-to-end pre-execution | zero-appetite |
| Financial crime | `appetite:financial-crime:str-filing-judgement` | STR-filing judgement — no internal override | zero-appetite |
| Operational | `appetite:operational:cyber-severity-tiers` | Cyber-incident severity tiering | tier-2 |
| Model | `appetite:model:tier-discipline` | Model-risk tier discipline | tier-2 |
| Climate | `appetite:climate:guidance-note-1-2024` | Climate-risk governance per PA GN 1 of 2024 | tier-2 |
| Conduct | `appetite:conduct:tcf` | Treating Customers Fairly — zero appetite for unfair treatment | zero-appetite |

Each line carries a measurement binding into the live substrate where one exists (e.g. `computeLCR`, `computeNSFR`, `computeIntradayLiquidityMetrics`, the `UnifiedPositionProjection` bond-inventory query, `IRRBBChecked` δEVE), and a named engineering → governance measurement-owner pair. `recon:ras-register-parity` keeps the register byte-faithful to its decision sources.

### 7.2 Governance structure

| Body | Function | Cadence |
|---|---|---|
| CEO (interim Board) | Approves all material decisions; sole Board seat in build phase | Continuous |
| Board Risk Committee (BRC) | Reviews RAS, stress results, capital adequacy | Quarterly; first cycle 2026-08-04 |
| Audit Forum (Interim; CoSec chair) | Receives internal audit findings; oversees CAE function | Periodic |
| ALCO (Treasurer chair) | Reviews capital, liquidity, ALM, FTP, and treasury positions | Monthly |

**Treasurer governance (active at v2).** Eitan (Treasurer, governance) holds an active seat with a live substrate:

- **ALCO chair** — the ALCO pack (`platform/alco/`) is generated from the event store;
- **Contingency funding plan** — CFP triggers and early-warning indicators are typed events with feed adapters (`platform/alm/cfp-ewi.ts`, `cfp-feed-adapters.ts`); `recon:cfp-trigger-coverage` enforces trigger coverage; a CFP rehearsal harness exists (`cfp-rehearsal-harness.ts`);
- **Intraday liquidity** — BCBS 248 monitoring metrics computed by `platform/alm/intraday-liquidity-metrics.ts`, governed by the tier-1 `appetite:liquidity:intraday` RAS line with a governed R50m intraday HQLA floor (D-INTRADAY-RAS-APPETITE);
- **Decision authority** — the decision-authority routing standard carries a Treasurer row: daily/term funding-plan approvals, FTP curve recalibration within agreed methodology, hedge-programme approval within RAS, collateral/repo-book sizing within RAS, and HQLA portfolio composition route to the Treasurer; approaching LCR/NSFR or RAS-threshold breaches and material funding-strategy changes escalate to CEO via ALCO.

A full Board (including independent NEDs) is constituted at licence-day. All Board-reserved decisions are CEO-interim in the build phase under `D-THIN-HUMAN-LAYER-MINIMUM`.

### 7.3 Three-lines-of-defence model

- **First line:** All agents in the engineering and markets domains operate within policy and procedure constraints encoded in the substrate. Risk is owned at source.
- **Second line:** Helena (CRO), Zara (Chief Compliance Officer, governance), and their engineering counterparts (Risk, Compliance-RegTech, Independent Validation) provide independent oversight, risk appetite monitoring, and compliance assurance.
- **Third line:** Thandiwe (Chief Audit Executive, governance) and Vera (internal audit engineer) provide independent audit assurance. The CAE reports functionally to the Interim Audit Forum and administratively through the CEO; third-line independence is non-negotiable.

---

## 8. Regulatory and Licensing Strategy

### 8.1 Primary regulatory framework

| Regulator / standard-setter | Act / Instrument | Primary obligations | Library state (regulatory library v1) |
|---|---|---|---|
| Prudential Authority (SARB) | Banks Act 94 of 1990; Regulations Relating to Banks; BA-return directives | Banking licence; capital adequacy; liquidity; large-exposure limits; ICAAP/ILAAP; BA returns | Objective layer live (`Regulations/ZA/SARB-PA/sarb-pa-objective-graph.json`); Banks Act, Excon Manual, large-exposures and BA-return analyses populated |
| Financial Sector Conduct Authority (FSCA) | Financial Markets Act 19 of 2012; FAIS Act 37 of 2002 | Market-conduct; FSP licence for intermediary services (institutional scope) | Objective layer live; FAIS Act source acquired (active source) |
| Financial Intelligence Centre (FIC) | FIC Act 38 of 2001 | AML/CFT; STR/CTR/TPR filing; EDD; KYC obligations | Objective layer live |
| Information Regulator | POPIA (Act 4 of 2013) | Information Officer designation; POPIA compliance; data subject rights | Objective layer live |
| BCBS | Basel III/IV consolidated framework (transposed via PA regulations) | Baseline framework layer — Pillar-1 spine catalogued at provision granularity with typed SARB-adoption edges; governs by default where SA is silent | Objective layer live; 14 BCBS standards (BCP, CAP, CRE, DIS, LCR, LEV, LEX, MAR, MGN, NSF, OPE, RBC, SCO, SRP) acquired as transposed active sources |
| IASB | IFRS (IFRS 9/7/13, IAS 1/21, etc.) | Financial reporting basis for AFS and BA returns | Objective layer live (`Regulations/INTL/IASB/iasb-objective-graph.json`) |
| JSE | JSE Equities Rules and Directives | **Deferred / inactive at v2** — no trading-member obligations while JSE cash equity is out of scope (§4.4, §13.4 `EXCL-LISTED-EQUITY`); re-activates only on the Hoz Securities Limited membership pathway | Tracked in `Regulations/_index.md`; not an active library v1 source |

**Regulatory library v1 (D-REGULATORY-LIBRARY-V1, CEO-approved 2026-06-11)** is complete: all **15 active sources** (instruments with applicability status `direct` or `transposed` — the FAIS Act plus 14 BCBS standards) are acquired as filed golden-source binaries, and both source-coverage recon gates (`recon:regulatory-source-coverage`, `recon:regulatory-golden-source-integrity`) are ENFORCING from 2026-06-11. Six regulators carry machine-readable **objective layers** (RegulatoryObjective nodes with SERVES/ALIGNS_TO edges): PA, FSCA, FIC, BCBS, IASB, and the Information Regulator — so policies align to regulator *intent*, not just requirement text, with `recon:regulator-mandate-coverage` enforcing coverage.

### 8.2 Licensing pathway

1. **Build phase (current):** Substrate development; regulatory-readiness gate preparation; pre-application engagement with SARB/PA planned.
2. **Pre-licence readiness gate:** Co-owned by Saskia (Head of Global Markets), Devon (COO), Rashida (CISO). Gate conditions: full policy/procedure/system-capability chain complete; ICAAP/ILAAP framework complete; capital raised and in custody; minimum human layer constituted; legal opinions on netting enforceability obtained (Legal as Code + external counsel).
3. **Licence application:** Submission to PA with full application pack. External legal counsel (Bowmans or equivalent) engaged at this stage. Expected to include: business plan, capital structure evidence, governance framework, RAS, ICAAP/ILAAP summary, IT security assessment (PA/FSCA Joint Standard 2 of 2024).
4. **Licence-day:** SARB grants banking licence. Real capital received. Real client onboarding begins. Minimum human workforce constituted.

### 8.3 Compliance posture

The bank's compliance model is **proactive and technology-led**: obligations are encoded as typed artefacts in the substrate; Mira (Compliance / RegTech engineer, engineering) maintains the obligations register and regulatory knowledge graph; Zara (CCO) owns the regulatory relationship. Compliance monitoring is autonomous via continuous recon pipelines (Audit + Compliance-RegTech), not periodic manual review.

Key postures:
- **AML/CFT:** Full KYC substrate live; institutional-counterparty EDD; no high-risk-jurisdiction or PEP onboarding without enhanced review; STR/CTR/TPR filing by autonomous agent under CCO oversight; STR-filing judgement and sanctions-blocking are zero-appetite RAS lines (§7.1).
- **FAIS:** Fit-and-proper policy live; conflict-of-interest policy live; TCF policy live (zero-appetite RAS line); no retail advisory; best-execution and suitability recon enforced fail-closed on the FX franchise.
- **Excon:** FX compliance per SARB Exchange Control Regulations; every cross-border ZAR flow FinSurv-reportable; ODP/AD posture typed on the FX product (ORG-EXCON-ODP-001).
- **Market conduct:** Insider trading and PA-dealing policy live; trading systems operate under surveillance hooks; conduct returns subscriber wired (`platform/returns/conduct/`).

---

## 9. Financial Targets and Build-Phase Economics

### 9.1 Build-phase cost structure

The bank's primary current cost is **Anthropic API token spend** — the largest real cash outlay in the build phase, billed monthly. CEO's time is the binding human resource. Engineering substrate is real work; the cost is compute and API usage.

All other costs (legal counsel, auditor, insurance, payroll) are deferred to the licence-application moment or licence-day as appropriate.

### 9.2 Revenue and P&L (post licence-day targets)

Licence-day financial targets will be set at the pre-licence readiness gate by Camille (CFO) in the inaugural budget and ICAAP. The strategy does not prescribe specific revenue targets in the build phase; the focus is on building the substrate required to support a profitable institutional capital-markets franchise at the right capital efficiency.

Indicative framework:
- Net interest income: minimal (no retail deposit franchise; treasury book income only);
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
| Substrate completion risk | Multiple substrate milestones incomplete; readiness gate may slip | Recon pipelines continuously measure coverage gaps (completeness-audit taxonomy, inert-module gate); backlog is managed against BRC Cycle 1 deadline |
| Scope drift risk | Untyped scope language permits product/activity drift beyond approved enumeration | §13 typed-scope appendix + planned typed strategy register make scope machine-checkable; NPA gate + strategy-amendment requirement (§4.2) bind additions |
| Talent risk (statutory humans) | Finding the minimum legal minimum of humans willing to serve as directors/officers of an AI-operated bank | Build-phase recruitment planning under the Recruiter; governance framework documents the limited scope of human decision-making required |

---

## 11. Substrate Gap — Chief Strategy Officer

No Chief Strategy Officer (CSO) is currently on the team roster. This document was authored by the Chief of Staff as a synthesis of governance-seat inputs, with the typed-scope appendix authored by Owen (Company Secretary, governance). The CSO function covers:

- Multi-year strategic planning;
- Competitive landscape and product strategy;
- Strategic M&A and partnership identification;
- Investor and board narrative.

**Recommendation:** The CSO function is a licence-day-plus role. During the build phase, strategy is CEO-owned with Chief of Staff synthesis. PAX (Role Researcher) to define the CSO role spec at the appropriate point in the post-licence roadmap.

**Action:** CoSec to register this substrate gap in the governance framework. No immediate hire required.

---

## 12. Approval and Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 DRAFT | 2026-05-22 | Chief of Staff (orchestration) | Initial draft — synthesis of governance-seat inputs; submitted for CEO review and approval. Never approved; `D-BANK-STRATEGY-V1` never recorded. Superseded by v2 |
| v2 DRAFT | 2026-06-11 | Chief of Staff (orchestration); typed-scope appendix by Owen (Company Secretary, governance) | Refresh to 2026-06-11 substrate/governance state: §4.2 product table re-sourced from the typed product register (OTC vanilla FX umbrella `approved-conditional`, spot/forward/swap, option NOT approved); §6.4 milestones refreshed (LCR/NSFR live, RWA engine live via `RwaComputed`, returns wiring in progress, regulatory library v1 complete, Treasurer Wave-1 complete); §7.1 re-sourced from the 17-line structured RAS register; §7.2 Treasurer (Eitan) governance added; §8.1 aligned to regulatory library v1 (15/15 active sources, 6 objective layers); **new §13 machine-extractable typed-scope appendix** (ACT-*, product permissions, SEG-*, exclusions, jurisdictions, STERM-* defined terms). Submitted for CEO approval under `D-BANK-STRATEGY-V2` |
| v2 DRAFT rev 2 | 2026-06-11 | Owen (Company Secretary, governance), per CEO in-session instruction 2026-06-11 (Marc, CEO) | **JSE cash equity removed from scope**: §1/§2.2/§4.1 operative language; §4.2 JSE Equity Desk row removed; §4.4 Hoz Securities Limited pathway deferred (reactivation requires NPA gate + strategy amendment); §8.1 JSE regulator row deferred/inactive; §13.1 `ACT-TRADE-EQUITY` moved to not-mandated; §13.2 `listed-equity` row → reserved/zero-permission; §13.4 `EXCL-LISTED-EQUITY` added; §13.6 `STERM-JSE-LISTED-EQUITY` resolution marked excluded. **FX forward tenor cap removed**: §4.2 note + §13.2 FX row + §13.6 `STERM-FX-FORWARD` — tenor governed by typed product scope (T+2 to T+N) and RAS market-risk lines, no fixed cap. Trading Mandate aligned at v1.1 (trading-mandate-v1.md). Status remains DRAFT — PENDING CEO APPROVAL under `D-BANK-STRATEGY-V2` |

**Approval required from:** CEO  
**Approval method:** In-session CEO confirmation triggers `Decision(approved)` event via `recordDecision` with `decisionId: D-BANK-STRATEGY-V2`.  
**Approval action:** Scrooge (Chief of Staff, orchestration) records the decision, updates this document to `status: APPROVED`, and dispatches Owen (Company Secretary, governance) to register the strategy document in the governance framework register. The follow-on typed strategy register PR encodes §13 1:1.

---

## 13. Typed-scope appendix (machine-extractable)

> **Purpose.** This appendix is the machine-extractable statement of the strategy's scope. Every row is keyed by a canonical code and will be encoded 1:1 into a typed strategy register (`prototype/platform/strategy/register.ts`, follow-on PR). Where this appendix and the narrative sections diverge, the divergence is a finding; where the typed register and this appendix diverge once the register lands, the register render is regenerated from the register (Principle 2). ACT-* codes are drawn from the canonical activity taxonomy (`prototype/platform/activities/taxonomy.ts`, rendered at `Regulations/_activity-taxonomy.md`). Product family codes are the `ProductFamily` enum values in `prototype/platform/markets/products/types.ts`. SEG-* and STERM-* codes are minted here and seed the later segment and defined-term registers.

### 13.1 Mandated business activities

Business-facing activities this strategy mandates. (Supporting activities — reporting, risk, governance, technology, corporate — are obligations-driven and not strategy-mandated business lines; they are out of scope for this table.)

| Code | Label (per taxonomy) | Strategy §ref | Scope note |
|---|---|---|---|
| `ACT-TRADE-FX` | FX dealing | §4.1, §4.2 | OTC vanilla only: spot, forward, swap (deliverable + NDF); option excluded (§13.4) |
| `ACT-TRADE-BOND` | Bond trading | §4.1, §4.2 | JSE/OTC bond trading incl. repo / reverse repo on eligible bonds (GMRA 2011) — no dedicated repo ACT code exists; repo resolves here + family `repo` (§13.6 STERM-REPO) |
| `ACT-TRADE-OTC-IRD` | OTC interest rate derivatives | §4.1, §4.2 | Vanilla ZAR IRS (+ FRA per desk mandate); Bermudan/swaption reserved (M3+) |
| `ACT-CLIENT-ONBOARD` | Client onboarding (KYC/CDD/EDD) | §3.1, §8.3 | Institutional counterparties only |
| `ACT-CLIENT-CATEGORISE` | Client categorisation & suitability | §3.1 | Categorisation enforces the institutional-only franchise (no retail) |
| `ACT-BANK-DEPOSIT` | Deposit-taking | §4.2 (Treasury), §5 | Wholesale/institutional funding only (money-market deposits); **no retail deposit base** (§13.4) |
| `ACT-BANK-PAYMENT` | Payment processing | §4.3 | Correspondent / sponsor-bank channel; indirect NPS participant posture |
| `ACT-BANK-NOSTRO` | Nostro & correspondent management | §4.3 | Multi-currency nostro estate under the correspondent-bank model |

Activities explicitly **not** mandated at v2 (taxonomy codes reserved or excluded): `ACT-TRADE-EQUITY` (JSE cash equity removed from scope per CEO in-session instruction 2026-06-11 — see §13.4 `EXCL-LISTED-EQUITY`), `ACT-TRADE-OTC-CREDIT` (reserved M5+), `ACT-CLIENT-ADVICE` (no FAIS advisory to natural persons; institutional intermediary scope only — see §13.4).

### 13.2 Product permissions per desk

Consistent with §4.2. Family codes are `ProductFamily` enum values. "Mandate cap" = operative Trading Mandate v1 constraint where the typed product scope is broader.

| Desk | Family code | Canonical product id | Permitted variants | Currency pairs / currencies | Tenor cap | Underlying classes | Master agreement | Settlement |
|---|---|---|---|---|---|---|---|---|
| JSE Bond / Fixed Income Desk | `listed-bond` | `prd:bank:bond:sagb-fixed-coupon` | Fixed-coupon SAGB | ZAR | Per instrument maturity | RSA Government bonds | none (listed market rules) | T+3 Strate |
| JSE Bond / Fixed Income Desk | `repo` | `prd:bank:treasury:repo-sagb-term` | Term repo / reverse repo | ZAR | Per repo term | SAGB collateral | GMRA 2011 | Per term |
| OTC IRD Desk | `otc-ird` | `prd:bank:otc-ird:vanilla-irs-zar` | Vanilla fixed/floating IRS; FRA (desk mandate; no typed fixture yet) | ZAR | Per mandate calibration | ZAR rates (JIBAR/ZARONIA) | ISDA 2002 + ZAR Schedule | Net cash |
| FX Desk | `fx` | `prd:bank:fx:otc-vanilla` | **spot, forward, swap** (deliverable + NDF); **option NOT permitted** | **any** (typed scope) | Typed scope: T+2 to T+N; **no tenor cap** — tenor risk governed by RAS market-risk lines (§7.1) | Currency pairs vs ZAR and cross | ISDA 2002 | T+2/T+N; PvP via CLS-member correspondent; cash for NDF |
| Treasury | `money-market` | `prd:bank:treasury:mmd-deposit`, `prd:bank:treasury:funding-line` | Wholesale MMD; committed funding line | ZAR (multi-ccy capable per Principle 5) | Short-term | Cash funding instruments | none (bilateral) | Per instrument |
| Treasury | `interbank-loan` | `prd:bank:treasury:ibl-placement` | Interbank placement (bank as lender) | ZAR (multi-ccy capable) | Short-term | Interbank credit | none (bilateral) | Per instrument |
| — | `listed-equity` | — | **None — reserved family, no permissions at v2** (removed from scope per CEO in-session instruction 2026-06-11; `EXCL-LISTED-EQUITY`, §13.4) | — | — | — | — | — |
| — | `structured` | — | **None — reserved family, no permissions at v2** | — | — | — | — | — |

All counterparty eligibility is **institutional** across every row (typed `counterpartyEligibility`/`franchiseScope` fields). Execution venue for the FX umbrella is **OTC only** (typed `executionVenue: "otc"`).

### 13.3 Client segments

SEG-* codes minted here for the four §3.1 institutional classes; these seed the later segment register.

| Code | Definition |
|---|---|
| `SEG-INST-ASSET-MANAGER` | South African institutional asset managers — pension funds, insurance companies, unit trusts and their management companies |
| `SEG-CORP-TREASURY` | Corporate treasuries managing large balance-sheet FX and interest-rate exposures |
| `SEG-BANK-BROKER-DEALER` | Banks and broker-dealers requiring bilateral OTC derivative execution or bond crossing |
| `SEG-INTL-INSTITUTIONAL` | International institutional counterparties with South African rand or JSE-listed instrument requirements |

No segment outside these four is in scope at v2. Retail / natural-person clients are not a segment (§13.4).

### 13.4 Exclusions (negative enumeration)

| Code | Exclusion | Strategy §ref |
|---|---|---|
| `EXCL-RETAIL-CLIENT` | No retail clients; no services to natural persons as clients | §3.1 |
| `EXCL-RETAIL-DEPOSIT` | No retail deposit base | §3.1, §9.2 |
| `EXCL-RETAIL-ADVICE` | No FAIS advisory services to natural persons; FSP positioning institutional throughout | §3.1, §8.3 |
| `EXCL-PROP-TRADING` | No proprietary trading — all market risk arises from client franchise activity within Trading Mandate limits | §4.1 |
| `EXCL-NPS-DIRECT` | No direct NPS participation; no direct NPS settlement account; no direct BankservAfrica membership in the build phase | §4.3 |
| `EXCL-FX-OPTION` | No FX options — named in the FX umbrella's target scope but not approved; requires the M5 option-pricing substrate, an NPA gate pass, and amendment of this strategy | §4.2 |
| `EXCL-LISTED-EQUITY` | No JSE cash-equity trading at v2 — removed from scope per CEO in-session instruction 2026-06-11; family `listed-equity` reserved with zero permissions; deferred until the Hoz Securities Limited JSE-membership pathway is reactivated, an NPA gate is passed, and this strategy is amended | §4.2, §4.4 |
| `EXCL-STRUCTURED` | No structured products — `structured` family reserved, zero permissions | §4.2, §13.2 |
| `EXCL-OTC-CREDIT` | No OTC credit derivatives — `ACT-TRADE-OTC-CREDIT` reserved (M5+) | §13.1 |
| `EXCL-NON-ZA-BOOKING` | No booking outside South Africa; ZA is the sole jurisdiction at licence-day | §3.3, §13.5 |

The general rule binds over and above this list: **anything not positively enumerated in §4.2 / §13.2 is impermissible until an NPA gate is passed and this strategy document is amended** (§4.2).

### 13.5 Jurisdictions

| Code | Jurisdiction | Status |
|---|---|---|
| `ZA` | South Africa | Sole jurisdiction at licence-day. Single Johannesburg branch. All products carry `jurisdiction: "ZA"`; legal entity `LE-BANK-SA`. Geographic expansion is a licence-day-plus decision (§3.3) |

### 13.6 Defined terms (seeds the STERM-* register)

Every load-bearing scope phrase used in this document, with its definitive resolution into canonical codes.

| Term id | Term | Definition | Resolves to |
|---|---|---|---|
| `STERM-OTC-IRD` | OTC interest rate derivatives ("OTC IRD") | Bilaterally-negotiated interest-rate derivative contracts under ISDA 2002 + ZAR Schedule; at v2: vanilla ZAR fixed/floating IRS and FRAs | `ACT-TRADE-OTC-IRD`; family `otc-ird`; product `prd:bank:otc-ird:vanilla-irs-zar`; variants: vanilla IRS, FRA |
| `STERM-IRS` | Interest rate swap (IRS) | ZAR fixed/floating vanilla swap, JIBAR/ZARONIA floating leg, ISDA 2002 | `ACT-TRADE-OTC-IRD`; family `otc-ird`; product `prd:bank:otc-ird:vanilla-irs-zar` |
| `STERM-FRA` | Forward rate agreement (FRA) | Single-period forward-starting interest-rate contract, cash-settled against JIBAR/ZARONIA; in the OTC IRD desk mandate; **no typed product fixture yet** (gap noted) | `ACT-TRADE-OTC-IRD`; family `otc-ird`; variant: FRA |
| `STERM-FX-SPOT` | FX spot | FX exchange for value T+2, any currency pair, OTC, institutional counterparties | `ACT-TRADE-FX`; family `fx`; product `prd:bank:fx:otc-vanilla`; variant `spot` |
| `STERM-FX-FORWARD` | FX forward (outright forward) | FX exchange for value beyond T+2 (deliverable or NDF); **no tenor cap** — tenor risk governed by RAS market-risk lines (§7.1) and the typed product scope | `ACT-TRADE-FX`; family `fx`; product `prd:bank:fx:otc-vanilla`; variant `forward` |
| `STERM-FX-SWAP` | FX swap | Simultaneous near-leg and far-leg FX exchange (2 cashflow legs) on the same pair | `ACT-TRADE-FX`; family `fx`; product `prd:bank:fx:otc-vanilla`; variant `swap` |
| `STERM-FX-OPTION` | FX option | Option on an FX pair (Garman-Kohlhagen / vol-surface substrate, M5) — **excluded at v2** (`EXCL-FX-OPTION`) | family `fx`; variant `option` — NOT permitted |
| `STERM-NDF` | Non-deliverable forward (NDF) | Cash-settled FX forward, no principal exchange; within the FX umbrella's deliverable + non-deliverable scope | `ACT-TRADE-FX`; family `fx`; product `prd:bank:fx:otc-vanilla`; variants `forward`/`swap`, cash settlement |
| `STERM-JSE-LISTED-EQUITY` | JSE-listed equity | Equity securities admitted to listing on the JSE, traded cash (spot) — **excluded at v2** (`EXCL-LISTED-EQUITY`) | family `listed-equity`; product `prd:bank:equity:jse-equity-cash` — **NOT permitted** (removed from scope per CEO in-session instruction 2026-06-11) |
| `STERM-SAGB` | South African Government bond (SAGB) | RSA Government fixed-coupon bond (nominals; ILBs per desk mandate extension) | `ACT-TRADE-BOND`; family `listed-bond`; product `prd:bank:bond:sagb-fixed-coupon` |
| `STERM-REPO` | Repo / reverse repo | Sale-and-repurchase (and reverse) of eligible bonds under GMRA 2011; booked on the bond / fixed-income desk | `ACT-TRADE-BOND`; family `repo`; product `prd:bank:treasury:repo-sagb-term` |
| `STERM-MMD` | Money-market deposit (MMD) | Wholesale short-term deposit taken by the bank as a funding instrument (no retail deposits) | `ACT-BANK-DEPOSIT`; family `money-market`; product `prd:bank:treasury:mmd-deposit` |
| `STERM-FUNDING-LINE` | Committed funding line | Committed wholesale borrowing facility available to the bank | `ACT-BANK-DEPOSIT` (wholesale funding); family `money-market`; product `prd:bank:treasury:funding-line` |
| `STERM-IBL` | Interbank placement | Short-term loan placed by the bank with another bank (bank as lender) | family `interbank-loan`; product `prd:bank:treasury:ibl-placement` |
| `STERM-INSTITUTIONAL-COUNTERPARTY` | Institutional counterparty | A counterparty in one of the four approved segments (§13.3); never a natural person acting as retail client; enforced by typed `counterpartyEligibility: "institutional"` on every product | `SEG-INST-ASSET-MANAGER`, `SEG-CORP-TREASURY`, `SEG-BANK-BROKER-DEALER`, `SEG-INTL-INSTITUTIONAL`; `ACT-CLIENT-CATEGORISE` |
| `STERM-CORRESPONDENT-BANK-MODEL` | Correspondent-bank model | All payments route via a correspondent bank; no direct NPS settlement account or BankservAfrica membership; PvP FX settlement via CLS-member correspondent | `ACT-BANK-PAYMENT`, `ACT-BANK-NOSTRO`; `EXCL-NPS-DIRECT` |
| `STERM-NPA-GATE` | New Product Approval (NPA) gate | The typed product-approval gate (D-NEW-PRODUCT-APPROVAL-POLICY) every instrument must pass before becoming permissible; approval binds to GREEN completeness recon; passing the gate additionally requires amendment of this strategy (§4.2) | NPA lifecycle stages in `prototype/platform/markets/products/types.ts`; `npa-gate.ts` |
| `STERM-POSITIVE-ENUMERATION` | Positive enumeration | The scope rule that only instruments explicitly listed in §4.2/§13.2 are permissible; everything else is impermissible until an NPA gate is passed and this strategy is amended | §4.2 rule sentence; `EXCL-*` rows (§13.4) |

---

*End of document. §13 is the machine-extractable scope statement; the follow-on typed strategy register PR (WS-STRATEGY-TRACEABILITY) encodes it 1:1 and stands up the recon gate that keeps this render and the register in parity.*
