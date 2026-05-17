---
agent: Mira
trigger: research-fsca-odp
asOf: 2026-05-07T09:30:00.000Z
decision-required: false
---

# Mira — FSCA OTC Derivative Provider compliance preparation

> *In-voice research output. Per CLAUDE.md Principle 7 and the AI-driven-bank reframe, this is the research run Mira's autonomous handler would produce once Claude-API + web-research are wired into the runtime. Today: Scrooge-coordinated. Substrate gap noted in Atlas's substrate-state inventory.*

## 0. Headline

OTC Derivative Provider ("**ODP**") authorisation is the **gate** that lets the bank operate live OTC interest-rate derivatives (the third leg of Saskia's franchise per `Owner Inbox/2026-05-06_strategic-foundation.md`). It is **separate from but tightly coupled to** the banking licence. Two-track sequencing is the safe default: **banking licence → bank-track ODP application (Application Index 1) → live OTC IRD trading**.

Substantive content of the regulation is largely settled (2018–2024 build-out). The remaining 2025–2027 implementation milestones — Strate trade reporting go-live, final IM phase-in, JIBAR→ZARONIA transition — are tractable from a build-phase posture: **rehearsed-readiness against synthetic flows now; live operation at licence-grant**.

Penalty for unauthorised ODP activity (FMA s.109): up to **R10m fine and/or 5 years imprisonment**. Building soft-franchise pipeline must therefore stay strictly inside the "negotiations-in-principle, no live signed agreements, no advertising" boundary that Saskia's spec already names.

## 1. Regulatory landscape — instruments and status

| ID | Instrument | Status | What it does |
|---|---|---|---|
| **FMA-2012** | Financial Markets Act 19 of 2012 | In force | Primary statute. s.6A requires authorisation for ODPs. s.109 penalties. |
| **FMA-REGS-2018** | FMA Regulations (GN R.98 of 2018) as amended | In force | Defines "OTC derivative provider"; sets framework for authorisation, reporting, risk mitigation. |
| **CS-1-2018** | Conduct Standard 1 of 2018 — Criteria for Authorisation of ODPs | In force (27 July 2018) | Operational capital, fit-and-proper, governance, risk management. |
| **CS-2-2018** | Conduct Standard 2 of 2018 — Reporting obligations re: OTC derivative transactions | In force | Trade-reporting requirements; data fields; reporting party. |
| **CS-3-2018** | Conduct Standard 3 of 2018 — Conduct Standard for authorised ODPs | In force | Confirmation, portfolio reconciliation, dispute resolution, valuation, client categorisation, trading-relationship agreements. |
| **JS-2-2020** | Joint Standard 2 of 2020 — Margin Requirements for Non-Centrally Cleared OTC Derivative Transactions (FSCA + PA), as amended 9 June 2023 | In force from 16 Aug 2021; phased | IM + VM; eligible collateral; minimum transfer amount aggregate ≤ R5m; phase-in by group notional. |
| **JN-2-2024** | Joint Notice 2 of 2024 — Determination of regulatory reporting in terms of JS 2 of 2020 | In force from 1 April 2025 | Margin information reported via PA's **Umoja** portal. |
| **STRATE-TR** | Strate (Pty) Ltd licensed Trade Data Repository | Licensed Dec 2024 | Trade reports go to Strate; aligned with EMIR / EMIR Refit principles; live by **1 March 2027** with **169 data elements** per transaction. |
| **JS-RM** | (Likely) Joint Standard on Risk Management for non-centrally cleared OTC derivatives | **Status to verify** | Some sources reference a parallel JS to JS-2-2020 covering risk-management procedures; numbering inconsistent across sources. **Open verification item.** |
| **BCBS-IOSCO** | BCBS-IOSCO Margin Framework | Foundational | South Africa's JS-2-2020 is calibrated to this G20-derived framework. |

> **Verification flag.** The "Joint Standard 1 of 2020" referenced in some commentary appears either to be a renumbered / replaced instrument or a reference inconsistency. The substantive margin standard the bank tracks is **JS 2 of 2020 as amended 9 June 2023**. External counsel (S5) to confirm there isn't a separate "JS 1 of 2020" still in force we are missing.

## 2. Bank applicability and authorisation path

### 2.1 The two application indices

The FSCA publishes two application indices:

- **Application Index 1** — for banks registered under the Banks Act 94 of 1990. Lighter touch on capital because Banks Act prudential framework covers it.
- **Application Index 2** — for non-bank ODPs. Heavier — separate capital-adequacy form (~6 months' operational expenses); fuller fit-and-proper review.

Both index packs require **Form FM6** (B and C parts), **controlling-body details**, **senior managers details**, two hard copies + memory sticks + application fee.

### 2.2 The bank's path (recommended)

Given the strategic foundation (seek SARB banking licence; institutional global-markets bank — `memory:project_strategic_foundation.md`), the bank applies as a **bank ODP via Index 1**, **after** banking-licence grant. Sequence:

1. Build phase (now → substrate-complete): rehearsed-readiness against synthetic flows. ODP substrate built; not lodged.
2. Banking-licence application lodged (S5 external counsel, capital raised, thin human layer in place).
3. Banking licence granted.
4. ODP application (Index 1) lodged immediately afterward.
5. ODP authorisation granted.
6. Live OTC IRD operation begins.

Steps 4–5 in industry practice take **12–24 months**, but the application packet is largely re-usable from the licence application; well-prepared applicants can compress this materially.

### 2.3 Build-phase boundary on soft-franchise

FMA s.6A prohibits "advertising or holding out" as an ODP without authorisation. **Saskia's soft-franchise track (negotiations-in-principle, MOUs, no signed agreements, no live execution) is currently inside the safe boundary** because:

- No transactions are executed.
- No marketing of OTC derivative products as principal.
- No "holding out" — counterparties are explicitly told the bank is in pre-licence build.

But the line can be crossed inadvertently. **Imani (legal-as-code) + external counsel (S5) review of every counterparty engagement template is required** before the soft-franchise programme widens beyond the current Tier-1 contact set.

## 3. Compliance obligations — categorised

The full register-ready entries are in §6 below. Here is the operating-shape view: 11 surfaces, ~40 obligations, mapped to bank functions.

### 3.1 Authorisation surface

- Apply via Index 1; submit Form FM6 B + C; fit-and-proper of senior management and controlling body; demonstrate operational capital (covered by Banks Act); demonstrate risk-management framework; demonstrate IT and operational capacity.
- Owner: **Camille (CFO) + Owen (CoSec) + Imani (legal-as-code)** with Saskia (Head of Global Markets) as the substantive front-office accountable executive. External counsel (S5) drafts.

### 3.2 Capital and operational resources

- For banks: covered by Banks Act 94/1990 prudential framework + ICAAP. Mira / Camille reconcile the FMA capital expectation with the Banks Act capital plan. **No double counting; no separate ODP capital pot.**
- Owner: Camille.

### 3.3 Fit-and-proper

- Senior management, controlling body, and Key Individuals carry FAIS-aligned fit-and-proper. **At licence-day, the thin human layer (S3) is the fit-and-proper population.** Owner: **Sade** (HR engineer) for substrate; Owen + Helena for governance sign-off.

### 3.4 Trading-relationship agreements

- Written agreement with every counterparty before any OTC derivative transaction. ISDA Master + South African Schedule + CSA is the template (Imani's clause library, already in build).
- Owner: Imani (substrate); Saskia (front-office sign-off); Zara (CCO) for conduct check.

### 3.5 Confirmation

- Timely confirmation of all material terms after execution. Industry best practice ≤ T+1 for standard products; ≤ T+5 for exotic. Coded into the OMS hand-off (Kai's substrate).
- Owner: Kai (substrate); Tomas (post-trade lifecycle); Imani (legal validity of confirmation channel — ECTA-compliant electronic execution).

### 3.6 Portfolio reconciliation

- At specified intervals (typically: weekly for ≥ 500 trades, monthly for 51–499, quarterly for ≤ 50 with a counterparty); identifies discrepancies in material terms and valuations.
- Owner: Tomas (reconciliation harness); Anya (data); Rohan (valuation).

### 3.7 Dispute resolution

- Procedures in place **before** transaction commencement; written; ISDA-aligned escalation. Disputes >R5m or open >5 business days require senior-level escalation.
- Owner: Imani (procedure); Saskia (front-office); Zara (CCO).

### 3.8 Margin (JS 2 of 2020 + amendments)

- **Variation Margin (VM):** daily, on a per-counterparty basis, against MTM. Eligible collateral: cash, gold, SAGB. Minimum transfer amount aggregate (IM + VM) ≤ R5m.
- **Initial Margin (IM):** phased by group notional. **September 2025 final phase: groups with > ZAR 100bn average notional (March-April-May 2025).** SIMM or schedule-based methodology; segregated.
- **Margin reporting:** via PA Umoja portal from 1 April 2025 (Joint Notice 2 of 2024).
- Owner: Ravi (treasury/ALM, collateral inventory); Eitan (governance — chair of ALCO); Bea (accounting); Imani (CSA terms); Rohan (IM calculation methodology).

### 3.9 Trade reporting (CS 2 of 2018 + Strate)

- Every OTC derivative transaction reported to Strate. **169 data elements** per transaction; live by **1 March 2027** but build now. Aligned with EMIR / EMIR Refit principles.
- Owner: Anya (data substrate, schemas); Kai (event-emit); Tomas (reporting pipeline); Mira (regulatory mapping).

### 3.10 Conduct (CS 3 of 2018)

- Client categorisation (retail / professional / counterparty); written policies; client classification documented; due diligence pre-trade; complaint handling; conflicts of interest.
- Owner: Zara (CCO); Niko (lead-to-client lifecycle, paused during build per AI-driven-bank reframe but substrate built); Mira (engineering substrate).

### 3.11 Record-keeping

- Minimum **5 years** for all OTC derivative records; tamper-evident; replayable. The bank's event-store substrate (P1) over-delivers here (event store is append-only by construction).
- Owner: Atlas (event substrate); Vera (independent assurance).

### 3.12 Cross-border / Excon

- Non-resident counterparties: Currency and Exchanges Manual for Authorised Dealers applies; SARB Financial Surveillance Department reporting; certain OTC IRD trades require approvals.
- Owner: Eitan (Treasurer) + Mira (Excon obligations); Ravi (operational).

## 4. 2025–2027 implementation milestones (industry-wide, applicable to the bank at licence-day)

| When | What | Bank-side action |
|---|---|---|
| 1 April 2025 | Margin reporting via Umoja portal goes live (JN 2/2024) | Build the Umoja-format reporting pipeline; rehearse against synthetic margin events |
| September 2025 | Final phase of IM implementation — groups with > ZAR 100bn average notional in scope | Build IM calculation engine (SIMM); integrate with collateral inventory; rehearse against synthetic counterparty |
| 1 March 2027 | Strate trade reporting go-live — **169 data elements** per OTC derivative transaction | Build trade-reporting pipeline; capture all 169 fields at trade booking; rehearse against Strate test environment when available |
| Ongoing | JIBAR → ZARONIA transition — affects all OTC IRD products | Saskia's franchise design already built ZARONIA-only; legacy JIBAR sub-book run-off plan already in place |
| TBD | General Laws Amendment Bill (Resolution Framework, Chapter 16 FSR Act) | Track; impact assessment when finalised |

## 5. Build-phase action plan (next ~10 items for the agents)

In priority order, what each agent should produce against this research:

1. **Mira:** Draft the obligations-register entries listed in §6 below; load to `Regulations/_obligations-register.md`. *(This run, follow-up.)*
2. **Mira:** Source the actual text of JS 2 of 2020 (as amended), CS 1/2/3 of 2018, FMA Regulations to `Regulations/SARB-PA/` and `Regulations/FSCA/`. *(Substrate task.)*
3. **Mira + Imani:** Draft `Procedures/by-policy/odp-authorisation-application.md` capturing the Index-1 application packet shape. *(2-3 sessions.)*
4. **Imani:** ISDA Master + South African Schedule + CSA template for the Tier-1 counterparty set; ECTA-compliant electronic-execution path. *(In progress; flagged as `WS-DOCUMENTATION` in Saskia's franchise design.)*
5. **Kai + Tomas:** Trade-confirmation pipeline coded against ISO 20022; rehearsed T+1 against synthetic flows. *(M-phase build.)*
6. **Kai + Anya:** Trade-reporting event capture — all 169 Strate fields modelled in the event schema. *(Anya's data-contract surface.)*
7. **Ravi + Bea:** Margin engine — VM daily; IM SIMM-aligned; collateral-inventory integration. *(Substrate task.)*
8. **Zara + Niko:** Client-categorisation policy + procedure; build-phase placeholder, activates at licence-day per AI-driven-bank reframe.
9. **Helena (CRO) + Rohan:** OTC IRD risk-appetite calibration in the recalibrated RAS (`WS-RAS-RECALIBRATION`). *(In flight.)*
10. **Owen + Camille:** ODP-application packet pre-assembly; co-stored with the SARB licence application packet for parallel lodgment.

## 6. Obligations register entries (delta for `Regulations/_obligations-register.md`)

Format mirrors Mira's existing register convention: `ID | Citation | Requirement | Fulfilment policy | Owner | Status`.

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-FMA-001 | FMA s.6A | Be authorised by FSCA before conducting ODP business | ODP Authorisation Policy (planned) | Camille | PRE-LICENCE |
| ORG-FMA-002 | FMA s.109 | Penalty: R10m fine / 5 years imprisonment for unauthorised ODP activity | Governance Framework + Operating-Model Boundary | Owen | IN FORCE |
| ORG-FMA-003 | FMA-REGS-2018 reg 3 | Report OTC derivative transactions to a licensed trade repository | Trade Reporting Policy (planned) | Mira | PRE-LICENCE |
| ORG-CS1-001 | CS 1/2018 §3 | Demonstrate operational capital | Capital Management Policy | Camille | COVERED-VIA-BANKS-ACT |
| ORG-CS1-002 | CS 1/2018 §4 | Fit-and-proper for senior management + controlling body | Fit-and-Proper Policy | Owen + Sade | PARTIAL |
| ORG-CS1-003 | CS 1/2018 §5 | Risk management framework — board-approved policies + procedures | Risk Management Framework (Helena) | Helena | IN FLIGHT |
| ORG-CS1-004 | CS 1/2018 §6 | IT and operational capacity demonstration | Operational Resilience Policy | Devon | IN FLIGHT |
| ORG-CS2-001 | CS 2/2018 + Strate | Report 169 data elements per OTC derivative transaction | Trade Reporting Policy + Anya data contracts | Anya | DRAFTING |
| ORG-CS3-001 | CS 3/2018 §3 | Written trading relationship agreement before any transaction | ISDA Master + Schedule + CSA template (Imani) | Imani | IN FLIGHT |
| ORG-CS3-002 | CS 3/2018 §4 | Timely confirmation of all material terms post-execution | Confirmation Procedure (Kai) | Kai | DRAFTING |
| ORG-CS3-003 | CS 3/2018 §5 | Portfolio reconciliation at specified intervals | Reconciliation Procedure (Tomas) | Tomas | DRAFTING |
| ORG-CS3-004 | CS 3/2018 §6 | Dispute-resolution procedures pre-transaction | Dispute Resolution Procedure (Imani + Zara) | Imani | DRAFTING |
| ORG-CS3-005 | CS 3/2018 §7 | Client / counterparty categorisation policy + due diligence | Client Categorisation Policy | Zara | DRAFTING |
| ORG-CS3-006 | CS 3/2018 §8 | Daily valuation; agreed valuation methodology | Valuation Procedure (Rohan) | Rohan | DRAFTING |
| ORG-CS3-007 | CS 3/2018 §9 | Conflicts-of-interest management | Conflicts Policy (Owen) | Owen | IN FORCE |
| ORG-CS3-008 | CS 3/2018 §10 | Complaints handling | TCF / Complaints Policy (Zara) | Zara | DRAFTING |
| ORG-CS3-009 | CS 3/2018 §12 | Record-keeping ≥ 5 years; tamper-evident | Event-store Substrate (Atlas) — P1 over-delivers | Atlas | IN FORCE |
| ORG-JS2-001 | JS 2/2020 §4 | Calculate + exchange Variation Margin daily on per-counterparty basis | VM Procedure (Ravi) | Ravi | DRAFTING |
| ORG-JS2-002 | JS 2/2020 §5 | Calculate + exchange Initial Margin (phased by group notional) | IM Procedure (Ravi + Rohan) | Ravi | PHASED |
| ORG-JS2-003 | JS 2/2020 §6 | Eligible collateral: cash, gold, SAGB (+ 2022 expansion) | Collateral Policy (Eitan) | Eitan | DRAFTING |
| ORG-JS2-004 | JS 2/2020 §7 | Minimum transfer amount aggregate ≤ R5m | Encoded in Eligible-Margin event constructor | Ravi | DRAFTING |
| ORG-JS2-005 | JS 2/2020 §3 | Board-approved policies + procedures sufficient for relevant transactions | Risk Management Framework + Margin Policy | Helena | IN FLIGHT |
| ORG-JS2-006 | JS 2/2020 §8 | Dispute-resolution procedures pre-transaction (margin-specific) | Margin Dispute Procedure | Imani | DRAFTING |
| ORG-JN2-2024 | JN 2/2024 | Margin reporting via PA Umoja portal from 1 April 2025 | Umoja Reporting Pipeline (Tomas + Anya) | Tomas | DRAFTING |
| ORG-EXCON-001 | Excon Manual | Non-resident OTC derivative transactions: SARB FinSurv reporting + approvals where required | Excon Procedure (Eitan + Mira) | Eitan | DRAFTING |

## 7. Policy register additions (delta for `Owner Inbox/2026-05-06_policy-register.md`)

New / amended policies under Owen's policy register, mapped to the obligations above:

- **ODP Authorisation Policy** (new) — captures the bank's stance on ODP authorisation: timing, application packet, sign-offs.
- **Trade Reporting Policy** (new) — captures the Strate reporting commitment + 169-element data discipline.
- **Margin Policy** (new; subsumed under the Risk Management Framework) — VM, IM phase-in, eligible collateral, MTA.
- **Confirmation Policy** — likely a sub-policy of OTC Trading Policy.
- **Reconciliation Policy** — sub-policy.
- **Dispute Resolution Policy** — covers OTC dispute escalation; references ISDA dispute procedure.
- **Client Categorisation Policy** — under Conduct / TCF.
- **Valuation Policy** — under Risk Management Framework.

## 8. Procedure backlog additions (delta for `/Procedures/_index.md`)

- `Procedures/by-policy/odp-authorisation-application.md` — owner: Owen.
- `Procedures/by-policy/trade-reporting-strate.md` — owner: Mira (substantive); Tomas (substrate).
- `Procedures/by-policy/margin-vm.md` — owner: Ravi.
- `Procedures/by-policy/margin-im.md` — owner: Ravi.
- `Procedures/by-policy/portfolio-reconciliation.md` — owner: Tomas.
- `Procedures/by-policy/otc-confirmation.md` — owner: Kai.
- `Procedures/by-policy/otc-dispute-resolution.md` — owner: Imani.
- `Procedures/by-policy/client-categorisation.md` — owner: Niko (paused; activates at licence-day).
- `Procedures/by-policy/excon-otc-derivatives.md` — owner: Eitan.

## 9. Substrate gaps surfaced by this research (for Atlas's gap inventory)

- **Mira's autonomous research handler does not exist yet.** Today this work was done by Scrooge-coordinated in-session research using web search; Mira's runtime has no Claude API + tool-use integration. Substrate gap. *(Mirrors gap #4 in Atlas's most-recent substrate-state report.)*
- **No coded link from obligations register to procedure to system capability for OTC derivatives surface yet.** The Reg → Policy → Procedure → System Capability chain (Principle 6, upward) needs the procedures listed in §8 to land before Vera's mandate-ownership recon can assert coverage.
- **Strate test-environment access is gated on FSCA application progress.** No way to rehearse end-to-end trade reporting against Strate during build-only without that access. Flag: this may force a real licence-application gating dependency for full rehearsed-readiness.

## 10. Open verification items (real-counsel check)

These are items where my research is not 100% certain and external counsel (S5) should confirm before the application packet is finalised:

1. **Joint Standard 1 of 2020 vs Joint Standard 2 of 2020 numbering inconsistency.** Confirm whether there is a separate Joint Standard 1 of 2020 still in force on a different aspect of OTC derivative regulation.
2. **Banks Act vs FMA capital-double-counting boundary.** Confirm the FSCA's expectation that bank-track ODPs satisfy the operational-capital requirement entirely via the Banks Act prudential framework, with no incremental ODP capital overlay.
3. **Soft-franchise boundary on FMA s.6A "advertising or holding out".** Confirm that negotiations-in-principle / MOUs / unsigned ISDA drafts during the pre-authorisation build do not breach s.6A.
4. **JIBAR fall-back specifics.** Final FSCA guidance on JIBAR fall-back language for legacy OTC IRD trades during the ZARONIA transition; Tradeweb FAQ June 2025 cited but firm-specific guidance from FSCA needed.
5. **Excon-specific ODP guidance.** Whether the SARB FinSurv Department has issued sector-specific guidance for ODPs handling non-resident counterparty OTC derivatives.
6. **Resolution Framework impact (General Laws Amendment Bill).** Tracked but final-form impact on the bank's ODP application packet to be assessed when the Bill is enacted.

## 11. Sources consulted (2026-05-07 web research)

Primary regulator + industry-counsel commentary:

- National Treasury — *Regulating over-the-counter (OTC) derivatives markets in South Africa* — https://www.treasury.gov.za/otc/Regulating%20over-the-counter%20(OTC)%20derivates%20markets%20in%20South%20Africa.pdf
- FSCA — *Application Index for ODPs (Banks)* — https://www.fsca.co.za/Notices/Application%20Index%20for%20ODPs_for%20Banks.pdf
- FSCA — *Application Index for ODPs (Non-Banks)* — https://www.fsca.co.za/Notices/Application%20Index%20for%20ODPs_for%20non%20Banks.pdf
- FSCA — *FSCA Instructions for ODP — Banks* — https://www.fsca.co.za/Notices/FSCA%20Instructions%20for%20ODP.pdf
- FSCA — *Conduct Standard 1 of 2018 — Criteria for Authorisation of ODPs* — https://www.fsca.co.za/Regulatory%20Frameworks/Documents%20for%20Consultation/Criteria%20for%20authorisation%20of%20ODPs%20(March%202018).pdf
- FSCA — *Consultation Report Conduct Standard 1 of 2018* — https://www.fsca.co.za/Notices/Consultation%20report%20Criteria%20for%20authorisation%20ODPs%2027%20July%202018.pdf
- FSCA — *Conduct Standard for authorised ODPs (CS 3 of 2018)* — https://www.fsca.co.za/Regulatory%20Frameworks/Documents%20for%20Consultation/Conduct%20Standard%20for%20authorised%20over-the-counter%20derivative%20providers%20April%202018.pdf
- FSCA — *Reporting obligations re: OTC derivatives (CS 2 of 2018)* — https://www.fsca.co.za/Regulatory%20Frameworks/Documents%20for%20Consultation/Reporting%20obligations%20in%20respect%20of%20transactions%20in%20over-the-counter%20derivatives%20April%202018.pdf
- SARB Prudential Authority — *Joint Standard 2 of 2020 (as amended 9 June 2023)* — https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2023/joint-communication-1-of-2023/Joint%20Standard%202%20of%202020%20Margin%20Requirements_as%20amended%2009%20June%202023.pdf
- SARB PA — *Joint Notice 2 of 2024 — Determination of regulatory reporting JS 2/2020* — https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-public-awareness/covid-19-response/2024/Joint%20Notice%202%20of%202024_Determination%20of%20regulatory%20reporting%20in%20terms%20of%20Joint%20Standard%202%20of%202020.pdf
- SARB — *ZARONIA methodology and policies* — https://www.resbank.co.za/en/home/what-we-do/financial-markets/south-african-overnight-index-average/ZARONIA-methodology-and-policies
- Strate — *Implementation of ZARONIA — South Africa's new reference rate* (April 2025) — https://www.strate.co.za/2025/04/22/implementation-of-zaronia-south-africas-new-reference-rate/
- Webber Wentzel — *Joint Standard on margin requirements for non-centrally cleared OTC derivative transactions published* — https://www.webberwentzel.com/News/Pages/Joint-Standard-on-margin-requirements-for-non-centrally-cleared-over-the-counter-derivative-transactions-published.aspx
- Cliffe Dekker Hofmeyr — *Ready for Margin — a closer look at the final SA Rules* — https://www.cliffedekkerhofmeyr.com/en/news/publications/2020/finance/finance-banking-alert-23-september-Ready-for-Margin-a-closer-look-at-the-final-SA-Rules.html
- Bowmans — *South Africa: Changes to OTC derivatives regulation — Key developments for 2025* — https://bowmanslaw.com/insights/south-africa-changes-to-otc-derivatives-regulation-key-developments-for-2025/
- Lexology / FRJ — *Licensing requirements for OTC Derivatives Providers published (and deadline extended)* — https://www.lexology.com/library/detail.aspx?g=04e8e377-3d20-404a-b8a7-7d76e2a8d375
- Lexology / FRJ — *OTC derivatives regulations are final and in force* — https://www.lexology.com/library/detail.aspx?g=fa242190-e547-4a49-9be6-1c34bcd0df47
- Cliffe Dekker Hofmeyr — *Good news and bad news for OTC derivatives providers* — https://www.cliffedekkerhofmeyr.com/en/news/publications/2019/finance/finance-and-banking-alert-11-march-good-news-and-bad-news-for-otc-derivatives-providers.html
- Tradeweb — *EM Risk-Free Reference Rate Transition — ZARONIA FAQ (June 2025)* — https://cdn.tradeweb.com/sites/ZARONIA/assets/pdf/Tradeweb_EM_Risk-Free_Reference_Rate_Transition_ZARONIA_-_FAQs_Final_June_2025.pdf

—Mira (research run, 2026-05-07)
