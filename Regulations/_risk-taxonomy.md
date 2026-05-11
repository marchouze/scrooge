---
title: Risk Taxonomy — canonical register
owner: Helena (Chief Risk Officer, governance)
engineer: Rohan (Risk engineer)
status: v1 — Board-approval pending
date: 2026-05-11
summary: Hierarchical risk taxonomy with stable codes (RT-<level1>.<level2>.<level3>). Every policy, obligation, RAS line, control, incident, and finding maps to exactly one terminal node. Sourced from Basel III/IV, BCBS Principles for Sound Risk Management, PA Joint Standards, King IV.
---

# Risk taxonomy — canonical register

> v1 — proposed by Helena (Chief Risk Officer, governance) with Rohan
> (Risk engineer); Board-approval pending. The typed enum at
> [`prototype/platform/risk/taxonomy.ts`](../prototype/platform/risk/taxonomy.ts)
> is a derived mirror — **this register is the canonical authoring
> location** (per `feedback_canonical_source_registry.md`).

## 1. Purpose and scope

The Risk Taxonomy is the single hierarchical register against which every
*risk-bearing artefact* the bank produces is classified. Its job is to give
the single-graph discipline (Principle 2) a stable axis along which the
bank's risk position can be measured, monitored, and reported coherently.

Every:

- **Policy** in the policy register (`Owner Inbox/2026-05-06_policy-register.md`)
- **Obligation** in the obligations register (`Regulations/_obligations-register.md`)
- **RAS line** in the Risk Appetite Statement (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`)
- **Control** in the controls catalogue (forthcoming, planned)
- **Incident** in the operational-loss / breach event family
- **Finding** raised by Vera (internal audit) or external assurance

…maps to **exactly one terminal node** in this taxonomy via a typed
`riskTaxonomy: RiskTaxonomyCode` field (Phase-1 dual-render: register
markdown + event-emitted attribute; Phase-4 archive: register sole canonical).

A risk that genuinely spans two terminal nodes is **decomposed** into two
distinct risks (one per node) rather than dual-tagged — this preserves
single-graph integrity.

**Scope boundary.** This taxonomy classifies *risk types*. It does not
classify *severity* (Soft / Hard / Critical, owned by each policy's breach
section), *likelihood* (owned by the risk-register projection), or *time
horizon* (build-phase / corporate-bind / licence-bind / commencement-bind,
per `project_rules_bind_at_commencement.md`). Those are orthogonal axes.

## 2. Naming convention

**Stable code format:** `RT-<L1>.<L2>.<L3>`

- `<L1>` is a 2–3 character alpha prefix (e.g. `CR`, `MK`, `LQ`, `IRRBB`).
- `<L2>` is a 2–6 character alpha-or-alphanumeric segment (e.g. `CONC`, `WW`).
- `<L3>` is a 2–6 character segment.
- All segments uppercase; segments separated by `.` only.
- Codes match `/^RT-[A-Z]+(\.[A-Z0-9]+){0,2}$/`.

**Stability rules:**

- Codes are **never renumbered**. A retired node stays in the register with
  a `[retired: YYYY-MM-DD]` annotation pointing at the successor; the typed
  enum keeps the symbol with an `@deprecated` JSDoc tag.
- Adding a new node is a Board-approved CeoDecision (see §9 amendment process).
- Renames change `name`/`definition` in-place; the code is invariant.

## 3. Level-1 categories

Eleven top-level risk types. Each row lists code, name, definition,
regulatory anchor, primary owner (the governance seat that holds policy
authority), and exemplar level-2 subcategories. Full subcategory expansion
is in §4.

| Code | Name | Definition | Anchor | Owner |
|---|---|---|---|---|
| `RT-CR` | Credit risk | Risk that an obligor fails to meet contractual obligations as they fall due, producing a financial loss for the bank. | Banks Act + Regs Relating to Banks Reg 23; BCBS CRE (Credit Risk Standardised + IRB); IFRS 9. | Helena (CRO, governance) |
| `RT-MK` | Market risk | Risk of loss in on- and off-balance-sheet positions arising from movements in market prices (interest rate in trading book, equity, FX, commodity, credit-spread). | BCBS MAR (FRTB; D352/D457); Reg 28; Banks Act §72(1). | Helena (CRO, governance) |
| `RT-LQ` | Liquidity & funding risk | Risk that the bank cannot meet obligations as they fall due (funding-liquidity) or cannot liquidate positions without unacceptable loss (market-liquidity). | BCBS D295 (LCR); BCBS D335 (NSFR); BCBS 144; BCBS 248 (intraday); Reg 26. | Helena (CRO, governance) + Eitan (Treasurer, engineering — reports to Camille CFO) |
| `RT-IRRBB` | Interest-rate risk in the banking book | Risk to earnings (NII) and economic value (EVE) from interest-rate movements affecting banking-book positions. | BCBS D368; Reg 30; PA Directive 8/2023. | Helena (CRO, governance) |
| `RT-OP` | Operational risk | Risk of loss from inadequate or failed internal processes, people, systems, or external events. Includes cyber, third-party, model, conduct-execution; excludes strategic and reputational. | BCBS *Principles for the Sound Management of Operational Risk* (rev. 2021, BCBS d515); PA Directive 9/2021; Reg 33. | Helena (CRO, governance) co-owner with Devon (COO, governance) |
| `RT-CD` | Conduct risk | Risk that the bank's behaviour in markets or with clients produces unfair outcomes, market abuse, or breaches of conduct duties. | FAIS Act + General Code of Conduct; FSCA Conduct Standards (TCF); Market Conduct Regs; King IV Principle 2. | Zara (Chief Compliance Officer, governance) |
| `RT-FC` | Financial-crime risk | Risk that the bank is used to launder funds, finance terrorism, evade sanctions, facilitate tax evasion, or transact bribery and corruption. | FIC Act 38/2001 + Amendments; FATF 40 Recommendations; UNSC + OFAC + EU sanctions regimes; Tax Administration Act §234. | Zara (Chief Compliance Officer, governance) + future MLRO |
| `RT-LR` | Legal & regulatory risk | Risk of loss from unenforceable contracts, litigation, regulatory enforcement, or non-compliance with binding obligations. Excludes financial-crime obligations (under `RT-FC`). | Companies Act 71/2008; Banks Act; PA enforcement framework; FSR Act 9/2017; POPIA. | Owen (Company Secretary, governance) + Imani (Legal-as-code engineer, engineering — reports to Devon COO interim); future General Counsel at hire |
| `RT-ST` | Strategic & business risk | Risk to the bank's earnings or franchise from adverse business decisions, poor execution, or failure to respond to industry change. Includes earnings volatility, business-model viability, mergers, technology disruption. | King IV Principles 4 + 11; Banks Act fit-and-proper regime; BCBS *Corporate Governance Principles for Banks*. | Marc (CEO) for strategy; Camille (Chief Financial Officer, governance) for earnings dimension |
| `RT-RP` | Reputational risk | Risk that negative perception by clients, counterparties, regulators, or the public produces value erosion, funding loss, or licence threat. Treated as a *second-order* risk: each first-order taxonomy node has a reputational shadow that escalates at Critical severity. | King IV Principle 5; PA fit-and-proper; FSR Act. | Marc (CEO); CRO + CCO + CoSec co-monitor |
| `RT-CL` | Climate & ESG risk | Risk to financial position or franchise from physical and transition climate impacts, biodiversity loss, and broader ESG dimensions. Treated as a *transverse* risk: it manifests through credit, market, operational, liquidity, strategic, and reputational nodes. | PA Guidance Note 1/2024 + G3/2025 (Climate Disclosures for banks); TCFD; ISSB IFRS S1+S2; King IV Principle 4. | Helena (CRO, governance) with Marc (CEO) |

**Eleven nodes — rationale.** This is the minimum coverage to map every
Basel III/IV risk-weighted capital category (RT-CR, RT-MK, RT-OP) + the
non-Pillar-1 PA-required risks (RT-LQ, RT-IRRBB, RT-CD, RT-FC, RT-LR) + the
King IV governance risks (RT-ST, RT-RP, RT-CL). It deliberately keeps
*conduct* and *financial crime* as peer level-1 categories rather than
subsuming them under operational risk — that placement matches South
African regulatory architecture (FIC Act + FAIS are domain-specific Acts
with named obligations, not subsidiary operational disciplines) and
matches `project_thin_human_layer` mandate-holder seats (MLRO + FAIS Key
Individuals are statutory roles in their own right).

**Reputational and climate as second-order / transverse.** RT-RP and
RT-CL do not produce *primary* loss events in the bank's loss-event
taxonomy — they amplify or condition first-order events. A primary
incident is tagged at its first-order node; the RT-RP / RT-CL shadow is
recorded as a secondary classification on the same incident event. This
preserves "one risk = one terminal node" at the *primary* axis while still
making the second-order exposure measurable.

## 4. Level-2 subcategories

Each level-1 expanded with its level-2 nodes. Definitions are 1–2 sentences.

### 4.1 `RT-CR` — Credit risk

| Code | Name | Definition |
|---|---|---|
| `RT-CR.OB` | Obligor credit risk | Risk of loss from a specific obligor defaulting on a credit exposure (loan, bond, derivative receivable, settlement claim). |
| `RT-CR.CP` | Counterparty credit risk (CCR) | Risk of loss from a counterparty defaulting before final settlement of a transaction whose value is positive to the bank (OTC derivatives, repos, securities financing). |
| `RT-CR.SL` | Settlement risk | Risk of loss when the bank delivers value but does not receive the offsetting leg (Herstatt-style FX settlement, securities-vs-cash settlement). |
| `RT-CR.CC` | Credit-concentration risk | Risk from disproportionate exposure to a single name, group of connected counterparties, sector, geography, or product. |
| `RT-CR.CV` | CVA / valuation-adjustment risk | Risk of loss from changes in credit-valuation adjustments and related XVAs on derivative portfolios. |
| `RT-CR.WW` | Wrong-way risk | Risk that exposure to a counterparty is adversely correlated with the counterparty's credit quality. |

### 4.2 `RT-MK` — Market risk

| Code | Name | Definition |
|---|---|---|
| `RT-MK.IR` | Interest-rate risk (trading book) | Risk of loss in trading-book positions from interest-rate movements. (IRRBB in the banking book is `RT-IRRBB`.) |
| `RT-MK.EQ` | Equity risk | Risk of loss from movements in equity prices in the trading book (cash + derivative). |
| `RT-MK.FX` | Foreign-exchange risk | Risk of loss from movements in foreign-exchange rates affecting bank positions and earnings. |
| `RT-MK.CO` | Commodity risk | Risk of loss from movements in commodity prices in held positions. (Out-of-scope for Hoz day-one strategic foundation; node reserved.) |
| `RT-MK.CS` | Credit-spread risk | Risk of loss from movements in credit spreads (issuer or index) in the trading book. |
| `RT-MK.OP` | Options / convexity risk | Risk of loss from changes in option volatility, second-order Greeks, and convexity in non-linear positions. |
| `RT-MK.BR` | Basis risk | Risk of loss from imperfect correlation between hedging and hedged instruments. |

### 4.3 `RT-LQ` — Liquidity & funding risk

| Code | Name | Definition |
|---|---|---|
| `RT-LQ.FN` | Funding-liquidity risk | Risk that the bank cannot meet cash obligations as they fall due without producing material losses. Captured in LCR + NSFR + idiosyncratic stress. |
| `RT-LQ.MK` | Market-liquidity risk | Risk that the bank cannot liquidate positions at or near the prevailing market price (HQLA composition; trading-book exit costs). |
| `RT-LQ.IN` | Intraday-liquidity risk | Risk that the bank cannot meet payment and settlement obligations at the moment they fall due during the operating day (SAMOS-funding scale). |
| `RT-LQ.CN` | Funding-concentration risk | Risk from disproportionate reliance on a single funding counterparty, tenor, currency, or product. |
| `RT-LQ.CR` | Cross-currency funding risk | Risk of loss from FX-swap-implied funding mismatches across significant currencies. |

### 4.4 `RT-IRRBB` — Interest-rate risk in the banking book

| Code | Name | Definition |
|---|---|---|
| `RT-IRRBB.EVE` | Economic-value-of-equity risk | Risk to the present value of banking-book assets minus liabilities from interest-rate shocks. |
| `RT-IRRBB.NII` | Net-interest-income risk | Risk to forward-period net interest income from interest-rate shocks. |
| `RT-IRRBB.BH` | Behavioural-assumption risk | Risk from non-maturity-deposit, prepayment, and pipeline assumptions used in IRRBB measurement. |
| `RT-IRRBB.CSRBB` | Credit-spread risk in the banking book | Risk to banking-book economic value from changes in credit spreads on banking-book positions (per PA Prudential Communication 15/2024 field testing). |

### 4.5 `RT-OP` — Operational risk

| Code | Name | Definition |
|---|---|---|
| `RT-OP.PR` | Process risk | Risk of loss from inadequate or failed processes (execution, recording, settlement-processing, reporting failures). |
| `RT-OP.PE` | People risk | Risk of loss from human error, unauthorised activity, key-person dependency, skills gap, or insider misconduct. |
| `RT-OP.TE` | Technology resilience risk | Risk of loss from technology failure, system unavailability, capacity, performance degradation, or data integrity failure outside cyber-attack scope. |
| `RT-OP.CY` | Cyber risk | Risk of loss from cyber-attack — confidentiality, integrity, availability, or cyber-resilience failure. |
| `RT-OP.TP` | Third-party risk | Risk of loss from material outsourcing or service-provider failure, including critical cloud, market-data, and clearing dependencies. |
| `RT-OP.MD` | Model risk | Risk of loss from incorrect model outputs used in decisioning, valuation, capital, or reporting. |
| `RT-OP.LE` | Legal-execution risk | Risk of loss from defective contracting, unenforceable clauses, or improperly executed legal acts in the course of business operations. (Distinct from strategic legal-regulatory exposure under `RT-LR`.) |
| `RT-OP.EX` | External-events risk | Risk of loss from natural disasters, civil disturbance, infrastructure failure outside the bank's control. |
| `RT-OP.RE` | Operational-resilience risk | Risk that an important business service is disrupted beyond its impact tolerance through any cause (cyber, third-party, infrastructure, key-person). |
| `RT-OP.PA` | Payments & settlement processing risk | Risk of loss from failed or mis-routed payments and settlements in the operational pipeline (distinct from `RT-CR.SL` Herstatt settlement-credit risk). |

### 4.6 `RT-CD` — Conduct risk

| Code | Name | Definition |
|---|---|---|
| `RT-CD.CC` | Client-conduct risk | Risk of unfair client outcomes (mis-selling, mis-pricing, suitability failure, conflict-of-interest mis-management). |
| `RT-CD.MA` | Market-abuse risk | Risk of insider dealing, market manipulation, false-or-misleading disclosure, or other prohibited market conduct by the bank, its agents, or employees. |
| `RT-CD.TC` | Treating-customers-fairly (TCF) risk | Risk of breach of FSCA TCF Conduct Standards across the six TCF outcomes (institutional client overlay applies under wholesale licence). |
| `RT-CD.CI` | Conflict-of-interest risk | Risk of unmanaged conflicts between bank, employee, agent, and client interests. |

### 4.7 `RT-FC` — Financial-crime risk

| Code | Name | Definition |
|---|---|---|
| `RT-FC.ML` | Money-laundering risk | Risk that the bank's products, customers, or channels are used to launder proceeds of crime. |
| `RT-FC.TF` | Terrorism-financing risk | Risk that the bank's products or channels are used to finance terrorism. |
| `RT-FC.PF` | Proliferation-financing risk | Risk that the bank's products or channels are used to finance proliferation of weapons of mass destruction (per FATF Recommendation 7 + FIC Act post-Greylisting). |
| `RT-FC.SA` | Sanctions risk | Risk of breach of UNSC, OFAC, EU, UK, or domestic sanctions through transactions, customers, or counterparties. |
| `RT-FC.FR` | Fraud risk | Risk of loss from internal or external fraud (excluding cyber-enabled fraud which is `RT-OP.CY` if the primary vector is cyber). |
| `RT-FC.BC` | Bribery & corruption risk | Risk of bank, employee, or agent giving or receiving improper inducement; failure-to-prevent-bribery exposure. |
| `RT-FC.TE` | Tax-evasion-facilitation risk | Risk that the bank facilitates tax evasion by customers (Tax Administration Act §234 facilitation; FATCA / CRS reporting failures with crime-facilitation overlay). |

### 4.8 `RT-LR` — Legal & regulatory risk

| Code | Name | Definition |
|---|---|---|
| `RT-LR.RC` | Regulatory-compliance risk | Risk of breach of binding obligations in the obligations register (excluding financial-crime obligations under `RT-FC` and conduct obligations under `RT-CD`). |
| `RT-LR.LI` | Litigation risk | Risk of loss from civil, commercial, or regulatory-enforcement litigation against the bank. |
| `RT-LR.CT` | Contract-enforceability risk | Risk that contracts the bank relies on are unenforceable, frustrated, or void (netting opinions, ISDA / GMRA close-out, jurisdiction). |
| `RT-LR.IP` | Intellectual-property risk | Risk of loss from third-party IP infringement claims or failure to protect bank-owned IP. |
| `RT-LR.DP` | Data-protection risk | Risk of breach of POPIA, GDPR (where applicable to cross-border data), or sectoral data obligations. |

### 4.9 `RT-ST` — Strategic & business risk

| Code | Name | Definition |
|---|---|---|
| `RT-ST.BM` | Business-model risk | Risk that the chosen business model fails to produce sustainable earnings (wholesale institutional global-markets trading bank model). |
| `RT-ST.EV` | Earnings-volatility risk | Risk that earnings are materially volatile from period to period, eroding capital or franchise. |
| `RT-ST.MD` | Market-disruption risk | Risk from technology, competitor, or industry-structure change disrupting the bank's franchise. |
| `RT-ST.EX` | Execution risk | Risk of failure to execute a defined strategic initiative (build-phase to licence-day gate; capital raise; product launch). |
| `RT-ST.GV` | Governance-effectiveness risk | Risk that Board or management structures fail to produce sound decisions, oversight, or culture. |

### 4.10 `RT-RP` — Reputational risk

| Code | Name | Definition |
|---|---|---|
| `RT-RP.CL` | Client-perception risk | Risk of damage to the bank's franchise from adverse client or counterparty perception. |
| `RT-RP.RG` | Regulator-perception risk | Risk of damage to the bank's regulatory standing or licence position from adverse regulator perception. |
| `RT-RP.MK` | Market / media-perception risk | Risk of damage from adverse media coverage, social-media events, or analyst commentary. |

### 4.11 `RT-CL` — Climate & ESG risk

| Code | Name | Definition |
|---|---|---|
| `RT-CL.PH` | Physical climate risk | Risk of loss from acute (storm, flood, wildfire) or chronic (sea-level, temperature, water-stress) physical climate impacts affecting counterparties, collateral, or operations. |
| `RT-CL.TR` | Transition climate risk | Risk of loss from policy, technology, market, or reputational shifts in the transition to a lower-carbon economy. |
| `RT-CL.LI` | Climate-litigation risk | Risk of loss from climate-related litigation against the bank or its counterparties. |
| `RT-CL.NA` | Nature & biodiversity risk | Risk of loss from biodiversity loss, ecosystem degradation, or land-use change affecting counterparties or collateral. |
| `RT-CL.SO` | Social & governance (broader ESG) risk | Risk of loss from social-licence or broader-ESG failures (human rights, labour standards, supply chain). |

## 5. Level-3 examples (selected)

Level-3 is added only where regulatory granularity demands or where the
bank materially differentiates controls. The full taxonomy stays
deliberately shallow — depth is added through *citation* (to obligation,
control, RAS line) rather than through ever-finer subdivision.

### 5.1 `RT-OP.CY` — Cyber

| Code | Name | Definition |
|---|---|---|
| `RT-OP.CY.CF` | Confidentiality | Risk of unauthorised disclosure of bank, client, or counterparty data. |
| `RT-OP.CY.IN` | Integrity | Risk of unauthorised modification of data, transactions, or systems. |
| `RT-OP.CY.AV` | Availability | Risk of system unavailability from cyber-attack (DoS, ransomware operational disruption). |
| `RT-OP.CY.RS` | Cyber-resilience | Risk of failure to recover from a cyber incident within stated impact tolerances (per Joint Standard 2/2024). |

### 5.2 `RT-OP.TP` — Third-party

| Code | Name | Definition |
|---|---|---|
| `RT-OP.TP.CL` | Critical cloud-provider | Risk from material outage, security failure, or service degradation at the bank's critical cloud provider (Azure). |
| `RT-OP.TP.MS` | Market-services provider | Risk from market-data, index-provider, clearing-broker, or correspondent-bank failure. |
| `RT-OP.TP.IT` | IT-service provider | Risk from non-cloud IT outsourcers (managed services, software vendors). |
| `RT-OP.TP.PR` | Professional-services provider | Risk from external counsel, audit firm, consultancy dependencies. |

### 5.3 `RT-OP.MD` — Model

| Code | Name | Definition |
|---|---|---|
| `RT-OP.MD.T1` | Tier-1 model (regulatory) | Risk in models classified Tier-1 per `D-MODEL-TIERING` — regulatory capital RWA, IFRS 9 ECL, AML monitoring core. |
| `RT-OP.MD.T2` | Tier-2 model (decisioning) | Risk in Tier-2 models — pricing engines, risk sensitivities, behavioural-deposit models. |
| `RT-OP.MD.T3` | Tier-3 model (analytics) | Risk in Tier-3 models — operational analytics, customer segmentation, non-decisioning. |

### 5.4 `RT-FC.ML` — Money-laundering vectors

| Code | Name | Definition |
|---|---|---|
| `RT-FC.ML.CU` | Customer-ML risk | ML risk arising from customer profile (PEPs, complex ownership, high-risk jurisdictions). |
| `RT-FC.ML.PR` | Product-ML risk | ML risk arising from product features (cross-border payments, anonymous instruments). Note: Hoz is institutional-only — wholesale-product risk profile. |
| `RT-FC.ML.GE` | Geography-ML risk | ML risk from counterparty-geography exposure (FATF grey/black-list, sanctioned jurisdictions). |
| `RT-FC.ML.CH` | Channel-ML risk | ML risk from channel characteristics (non-face-to-face onboarding, agent intermediation). |

### 5.5 `RT-FC.SA` — Sanctions

| Code | Name | Definition |
|---|---|---|
| `RT-FC.SA.UN` | UN Security Council sanctions | Risk of breach of UNSC sanctions regimes. |
| `RT-FC.SA.US` | OFAC (US) sanctions | Risk of breach of OFAC SDN + sectoral sanctions; secondary-sanctions exposure. |
| `RT-FC.SA.EU` | EU sanctions | Risk of breach of EU restrictive measures. |
| `RT-FC.SA.UK` | UK (OFSI) sanctions | Risk of breach of UK OFSI consolidated sanctions list. |
| `RT-FC.SA.ZA` | Domestic (TPRA) sanctions | Risk of breach of South Africa's Targeted Financial Sanctions regime under POCDATARA + FIC Act §28A. |

### 5.6 `RT-CR.SL` — Settlement

| Code | Name | Definition |
|---|---|---|
| `RT-CR.SL.FX` | FX-settlement risk | Herstatt risk on FX trades not settled PvP (per Hoz indirect-participant posture — CLS via correspondent only). |
| `RT-CR.SL.SC` | Securities-settlement risk | Risk on securities-vs-cash settlement (JSE Strate; international CSDs via custodian). |

### 5.7 `RT-LQ.CN` — Funding concentration (illustrative — no level-3 yet)

*No level-3 currently. Concentration dimensions (counterparty, tenor,
currency, product) are captured as **attributes** of an RT-LQ.CN-tagged
risk, not as separate terminal nodes — adding granularity here would
fragment the appetite-line / breach-event mapping.*

## 6. Mapping rules

When a new risk surfaces (from regulatory change, product introduction,
incident, audit finding, scenario analysis), it is classified by this
algorithm:

1. **Start at level 1.** Identify which of the eleven top-level categories
   the risk primarily belongs to. Strategic risk *of* poor capital
   adequacy is `RT-ST`, not `RT-CR`; the underlying credit losses that
   create the capital pressure are `RT-CR`.
2. **Narrow to the deepest stable node.** Descend to the most specific
   level-2 (or level-3 if defined) that:
   - is a meaningful classification (not a one-of-one),
   - is stable (the risk will not migrate between sibling nodes as the
     business evolves).
3. **One risk = one terminal node.** If the risk genuinely spans two
   terminal nodes, decompose it into two distinct risks, each with its own
   classification, owner, control set, and appetite line. Dual-tagging is
   prohibited.
4. **No fit?** If no existing node accommodates the risk, **do not
   ad-hoc-add a node.** Propose a taxonomy amendment via CeoDecision (§9).
   In the interim, tag the risk against the nearest level-1 node with a
   `pendingTaxonomyAmendment: D-RT-<slug>` attribute.
5. **Cross-axis classifications.** Reputational (RT-RP) and climate
   (RT-CL) classifications attach as **secondary** axes on the primary
   risk record where they apply — they do not replace the primary
   classification.

**Worked examples.**

- A bond-trading desk's loss from a sovereign-yield jump → `RT-MK.IR`
  (trading-book interest-rate risk; *not* `RT-IRRBB.EVE` which is
  banking-book).
- A correspondent-bank failure that prevents the bank settling
  USD-clearing for a day → primary `RT-OP.TP.MS`
  (third-party-market-services); secondary `RT-LQ.IN` if the inability to
  settle creates intraday-liquidity stress; do not classify as `RT-CR.SL`
  (no settlement-credit loss occurred).
- A model used to price an exotic derivative producing wrong outputs that
  caused trading losses → `RT-OP.MD.T2` (Tier-2 pricing model). The
  market-risk loss that resulted is a separate event tagged `RT-MK` —
  the model-risk event and the market-loss event are *linked but
  distinct*.
- A sanctioned-party detected in onboarding that the bank declined →
  *not* a loss event; tagged as a sanctions-screening control hit under
  `RT-FC.SA` (control-effectiveness evidence, no incident).

## 7. Citation surface

Each level-1 anchors against one or more named regulatory instruments.
Full instrument citations live in the obligations register
(`Regulations/_obligations-register.md`) and the regulatory library
(`Regulations/_index.md`); the references below are the anchor points
only.

| Code | Regulatory anchors |
|---|---|
| `RT-CR` | Banks Act §72 + §83; Regulations Relating to Banks Reg 23 + Reg 24 (large exposures); BCBS CRE20 (standardised credit risk); BCBS CRE30+ (IRB); IFRS 9 (ECL); PA Directive 8/2023 (threshold amounts SA/IRB credit). |
| `RT-MK` | Banks Act §72(1); Regulations Relating to Banks Reg 28; BCBS MAR (FRTB; D352 minimum capital requirements for market risk, January 2019; D457 revisions February 2024 [citation: TBC — confirm final version reference]); PA Prudential Communication 18/2024 (FRTB + CVA implementation roadmap). |
| `RT-LQ` | Banks Act §72; Regulations Relating to Banks Reg 26; BCBS D295 (LCR, January 2013); BCBS D335 (NSFR, October 2014); BCBS 144 (*Principles for Sound Liquidity Risk Management and Supervision*, September 2008); BCBS 248 (*Monitoring tools for intraday liquidity management*, April 2013); PA Directive 1/2023 (NSFR matters); PA Directive 4/2021 (externally-facilitated liquidity stress simulation). |
| `RT-IRRBB` | Banks Act + Regulations Relating to Banks Reg 30; BCBS D368 (*Interest rate risk in the banking book*, April 2016); PA Directive 8/2023 (IRRBB threshold dimension); PA Prudential Communication 15/2024 (CSRBB field testing). |
| `RT-OP` | Banks Act + Regulations Relating to Banks Reg 33; BCBS *Principles for the Sound Management of Operational Risk* (rev. 2021, BCBS d515 / OPE25 in consolidated framework); PA Directive 9/2021 (PSMOR 12-principles SA adoption); PA Directive 4/2023 (operational resilience; supersedes D10/2021); BCBS *Principles for Operational Resilience* (March 2021); Joint Standard 1/2023 (IT Governance + IT Risk Management); Joint Standard 2/2024 (Cybersecurity & Cyber Resilience); SR 11-7 idiom + SS 1/23 idiom (model risk). |
| `RT-CD` | FAIS Act 37/2002 + General Code of Conduct; FSCA TCF Conduct Standards; FSCA Conduct Standard 3/2018 (Banks); Financial Sector Regulation Act 9/2017; Market Abuse provisions of Financial Markets Act 19/2012 §§78–82; King IV Principle 2. |
| `RT-FC` | FIC Act 38/2001 (as amended; post-Greylisting amendments); FATF 40 Recommendations + Recommendation 7 (PF); UNSC sanctions; OFAC SDN + sectoral; EU restrictive measures; UK OFSI sanctions; POCDATARA Act 33/2004; Tax Administration Act 28/2011 §234; FATCA IGA; CRS; AML/CFT/CPF Communication 1/2025 (Banks). |
| `RT-LR` | Companies Act 71/2008; Banks Act 94/1990 + PA enforcement framework under FSR Act 9/2017; FSR Act §§157–177 (administrative penalties + enforcement); POPIA Act 4/2013; ECTA Act 25/2002 (e-contracting); Prescription Act 68/1969 (litigation limitation); Civil Proceedings Evidence Act 25/1965. |
| `RT-ST` | King IV Principles 4 (effective leadership) + 5 (organisational ethics) + 11 (risk governance) + 12 (technology and information governance); Banks Act fit-and-proper regime (§60); BCBS *Corporate Governance Principles for Banks* (July 2015); PA Joint Standard 1/2020 (Significant Owner). |
| `RT-RP` | King IV Principle 5; Banks Act fit-and-proper regime; FSR Act §§166–170 (publication powers, reputation-shaping); PA fit-and-proper guidance. |
| `RT-CL` | PA Guidance Note 1/2024 (Climate-related risks for banks); PA Guidance Note 3/2025 (Climate Disclosures for banks, supersedes G3/2024 + G2/2024); TCFD Recommendations (2017); ISSB IFRS S1 + S2 (June 2023); King IV Principle 4; Network for Greening the Financial System (NGFS) scenarios. |

## 8. How existing artefacts cite the taxonomy

### Obligations register

Every row in `Regulations/_obligations-register.md` gains a
`riskTaxonomy: RT-<code>` field at the narrowest stable node. Existing
rows currently carry domain prefixes (`ORG-PR-*`, `ORG-MK-*`, `ORG-FC-*`,
`ORG-CY-*`, `ORG-GV-*`, `ORG-OP-*`, `ORG-RM-*`, `ORG-CR-*`) — these are
**document-organisation prefixes**, not risk classifications, and they
will continue to serve as obligation-id stable handles. Risk-taxonomy
tagging is a *new orthogonal field* assigned per row in the backfill
deliverable (planned next-tick by Mira (Compliance / RegTech engineer,
engineering — reports to Zara CCO; obligations-register curator)).

### RAS lines

The Risk Appetite Statement
(`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) tags
each line at **level 2** (e.g. `riskTaxonomy: RT-CR.CC` for the sector
concentration cap; `RT-LQ.FN` for LCR/NSFR floors; `RT-OP.RE` for the
operational-resilience-impact-tolerance line). Level-3 is reserved for
deeper appetite differentiation where introduced by Board (e.g. a
sanctions-jurisdiction-specific appetite would tag `RT-FC.SA.US`).

### Policies

Each policy in `Owner Inbox/2026-05-06_core-policies-risk.md` and
sister bundles tags its **primary** level-1 (or level-2 where the policy
is narrower) in frontmatter:

```yaml
riskTaxonomy: RT-OP            # Operational Risk Policy
# or
riskTaxonomy: RT-OP.MD         # Model Risk Policy
# or
riskTaxonomy: RT-OP.RE         # Operational Resilience Policy
```

A policy may *reference* additional nodes in its body (e.g. the Stress
Testing Policy touches `RT-CR`, `RT-MK`, `RT-LQ`, `RT-OP`, `RT-IRRBB`)
but the frontmatter classification names the policy's *primary* risk it
governs.

### Incidents and findings

Operational-loss events, breach events, and internal-audit findings tag at
the **narrowest stable level**. A cyber breach is `RT-OP.CY.CF` if it is
specifically a confidentiality compromise; `RT-OP.CY` if the
confidentiality-vs-integrity-vs-availability split is not yet known at
discovery. Secondary axis (RT-RP / RT-CL) is attached where applicable.

### Controls

Controls in the (forthcoming) controls catalogue tag at the level the
control *mitigates*. A Critical-vendor recovery-point-objective control
is `RT-OP.TP.CL` (critical cloud-provider third-party risk). A
sanctions-screening engine is `RT-FC.SA`.

## 9. Amendment process

Adding, retiring, renaming, or re-parenting a taxonomy node is a
**Board-approved CeoDecision** — never an ad-hoc edit.

**Procedure.**

1. Helena (CRO) proposes the amendment via a `CeoDecision` event of kind
   `D-RT-<slug>` (e.g. `D-RT-COMMODITY-RISK-ACTIVATION`).
2. The decision record includes: the proposed change, the regulatory or
   business trigger, the affected level-1 / level-2 / level-3 set, a
   migration plan for already-tagged artefacts, and a typed-enum
   diff-preview.
3. Owen (Company Secretary, governance) routes for Board approval (or
   Interim Audit Forum approval during the build phase per
   `feedback_ceo_vs_board_approval.md`).
4. On approval, Rohan (Risk engineer) updates the typed enum at
   `prototype/platform/risk/taxonomy.ts`, this register, and the
   migration plan fires.

**Recon discipline.** Vera (Internal-audit engineer, engineering —
functionally to Thandiwe CAE; administratively to CEO) Wave-5 will ship a
`taxonomy-coverage` recon pipeline that:

- asserts the typed enum is byte-for-byte derivable from this register
  (drift = finding),
- asserts every obligation row, RAS line, policy frontmatter, and
  emitted incident / breach event carries a valid `riskTaxonomy` code
  (missing = finding),
- asserts no orphan code in the typed enum (code present but no
  artefact ever cites it = stale).

The Wave-5 pipeline is a **substrate gap** at v1 — it is named here so
Vera carries it forward; it is not a blocker for v1 register publication.

**Gap log (carried forward from v1).**

- BCBS MAR D457 final reference confirmation (§7 row for `RT-MK`).
- Backfill of `riskTaxonomy` field on the 259-row obligations register
  (next-tick work by Mira).
- Backfill of `riskTaxonomy` on every RAS line (next-tick work by Helena
  with Rohan).
- Policy-frontmatter `riskTaxonomy` annotation across the eight
  risk-policy bundle + sibling policy bundles (next-tick work by Owen
  with the policy authors).
- Vera Wave-5 `taxonomy-coverage` recon pipeline (next-tick build,
  carried into Vera roadmap).
- Controls-catalogue authoring (downstream; tags against this taxonomy
  on first authoring).

## 10. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-11 | Helena (CRO) + Rohan (Risk engineer) | Initial register: 11 level-1 categories; 56 level-2 nodes; 27 level-3 nodes. Typed enum at `prototype/platform/risk/taxonomy.ts`. Board-approval pending. |
