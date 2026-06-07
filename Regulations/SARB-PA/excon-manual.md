# Currency and Exchanges Manual for Authorised Dealers (Excon Manual)

**Curator:** Mira (Compliance / RegTech engineer) · **Status:** POPULATED · **Last reviewed:** 2026-06-07 · **Governance:** Zara (Chief Compliance Officer)

## Citation

- **Title:** Currency and Exchanges Manual for Authorised Dealers (the "Authorised Dealer Manual" / "Excon Manual").
- **Issuing authority:** South African Reserve Bank — Financial Surveillance Department (FinSurv).
- **Legal anchor:** issued under the Exchange Control Regulations, 1961 (Government Notice R.1111 of 1 December 1961), made under section 9 of the **Currency and Exchanges Act 9 of 1933**. The Regulations are the binding instrument; the Manual is the operational rulebook the Treasury (delegated to FinSurv) requires Authorised Dealers to follow when intermediating exchange-control transactions (cf. Exchange Control Regulation 2(2)).
- **Version as analysed:** 2026-05-15 edition (298 pages), version-controlled by FinSurv Exchange Control Circulars (most recent in the analysed edition: Circular 17/2026). The Manual is amended frequently by Circular; the version-control sheet at the front of the document is the authoritative change log.
- **Source:** [resbank.co.za — Financial Surveillance / Authorised Dealers](https://www.resbank.co.za/en/home/what-we-do/financial-surveillance/authorised-dealers). Manual PDF: *Currency and Exchanges Manual for Authorised Dealers* (Financial Surveillance Documents).
- **Companion documents (not analysed here):** the *Currency and Exchanges Manual for ADLAs* (Authorised Dealers in foreign exchange with Limited Authority — not the bank's category); the *FinSurv Reporting System Business and Technical Specifications* and *Operations Manual* (referenced from Manual Section J), which carry the granular BoP (balance-of-payments) category-code catalogue.

> **A note on scope of citation.** This analysis cites the Manual's **Section-letter / chapter structure**, which is public and verifiable from the source PDF above. It does **not** assert the precise numeric FinSurv BoP category codes (the "BOPCUS / BOPDIR category" codes) for each obligation — those are interpretation-sensitive, live in the FinSurv Reporting System Business & Technical Specifications, and are ratified for this bank by Imani (Legal-as-code engineer) with external counsel at the licence gate (register v1.4 posture; see `_obligations-register.md`). Where this file references a BoP category it does so descriptively, by economic class, not by code.

## Scope and applicability to the bank

The bank, once licensed under the Banks Act 94 of 1990, intends to hold full **Authorised Dealer (AD)** status — the SARB FinSurv designation that authorises an institution to deal in foreign exchange and gold and to intermediate cross-border flows on behalf of clients and for its own account (Exchange Control Regulation 2; Manual Section A.2(A)).

Key applicability facts for this bank:

- **AD designation is a separate regulatory act** from the Banks Act licence. It is granted by SARB FinSurv on application and is, in practice, conditional on holding a Banks Act licence in good standing. The two applications are commonly progressed in parallel (see `2026-05-20_rashida_finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test.md` §2.1).
- The bank is **not** an *ADLA* (Authorised Dealer with Limited Authority, Manual Section A.2(B)); the ADLA Manual does not apply.
- **Bind trigger: COMMENCEMENT-BIND.** AD-Manual obligations activate when the bank first processes a **real cross-border transaction** with a real counterparty, not when the substrate emits a synthetic build-phase trade. The internal pre-licence FX-spot test is **outside** Exchange Control Regulation 2(1)/3(1) scope because it produces no client transaction, no cross-border movement, and no Treasury-reportable flow (Rashida's assessment §1; `Policies/excon-compliance-policy-v1.md` §1).
- On signing the **AD-Manual undertaking** (part of the AD application), the bank legally binds itself to the Manual's operational rules: supporting-documentation verification, BoP category coding, FinSurv reporting, and the approval-gate workflow for transactions outside concessional dealing authority.
- The bank's **indirect-participant settlement posture** (settling FX via a CLS-member correspondent) does **not** displace the FinSurv reporting obligation: the bank remains the AD of record for trades it intermediates.

The Manual binds the bank's **live FX trading book** end-to-end: trade-side conduct (permissible dealing, currency-pair envelope), supporting-documentation verification, and per-transaction FinSurv reporting at the settlement event.

## Structure of the Manual

The Manual is organised into lettered Sections A–K, each with numbered chapters (e.g. B.1, B.2) and lettered sub-parts (e.g. B.2(A)). The verbatim headings below are taken from the Table of Contents of the 2026-05-15 edition.

| Section | Verbatim heading | Bank relevance |
|---|---|---|
| **A.1** | Definitions | Core (defines "Authorised Dealer", "foreign currency", "foreign direct investment" (≥10% threshold), "Common Monetary Area", etc.) |
| **A.2** | Authorised entities | Core — AD designation; AD vs ADLA |
| **A.3** | Duties and responsibilities of Authorised Dealers | **Core conduct anchor** — procedures, documentary evidence, reporting, CMA transactions |
| **A.4** | Guidelines and procedures in respect of treasury outsourcing companies and foreign exchange brokers | Conditional (if the bank outsources treasury) |
| **B.1** | Payment for imports | Current account — trade in goods (imports) |
| **B.2** | Capital transfers | **Capital account** — incl. outward FDI (B.2(C)(i): FDI ≤ R5bn dispensation), institutional-investor macro-prudential limit (B.2(I)) |
| **B.3** | Income transfers | Current account — income (royalties, fees, income due to non-residents) |
| **B.4** | Single discretionary allowance and other miscellaneous payments for private individuals | Current account — allowances (SDA, travel) |
| **B.5** | Personal transfers by foreign nationals and immigrants | Current account — personal transfers |
| **B.6–B.9** | Embassies…; Charitable bodies…; Shipping/airline/travel agents; Freight payments and ships disbursements | Services / transfers (situational) |
| **B.10** | Insurance and pensions | Services — insurance/reinsurance premiums |
| **B.11** | Bank notes | Banknote handling |
| **B.12** | Merchanting, barter and counter trade | Trade |
| **B.13** | Buying and selling commissions | Services |
| **B.14** | Miscellaneous transfers | Services — broad catch-all |
| **B.15** | Guarantees | Cross-border guarantees |
| **B.16** | Credit and/or debit cards | Card flows |
| **B.17** | Foreign currency holdings and other foreign assets held by private individuals (natural persons) resident in South Africa | Resident foreign-asset holdings |
| **B.18–B.20** | Control of exports – general; Control of exports – miscellaneous; Acceptance of foreign bank notes and travellers cheques | Trade in goods (exports); banknote acceptance |
| **C.** | Gold | Gold dealing / Krugerrands (conditional) |
| **D.1** | Forward cover or hedging transactions between Authorised Dealers and residents | **FX derivatives** — forwards/options vs residents (≤12m, >12m) |
| **D.2** | Forward cover transactions between Authorised Dealers and non-residents | **FX derivatives** — forwards vs non-residents |
| **E.** | Non-resident Rand account, Customer Foreign Currency accounts, foreign currency accounts and foreign bank accounts | **Account types** — NRRA, CFC, FCA, foreign bank accounts |
| **F.1** | Negotiable instruments denominated in Rand and Rand notes | Cheques/drafts; import/export of Rand notes |
| **F.2** | Assignment to Treasury of the right to goods exported and imported | Export/import assignment |
| **G.** | Securities control | **Securities** — non-resident dealings, JSE, debt securities, derivatives market |
| **H.** | Inward listings on South African exchanges | Inward listings (foreign-issuer listings) |
| **I.1** | Local financial assistance to affected persons and non-residents | Lending to affected persons / non-residents |
| **I.2** | Local facilities to non-residents | Trade finance / facilities to non-residents |
| **I.3** | Borrowing abroad by residents | **Cross-border loans** — long-term loans, working-capital loans, corporate foreign-debt issuance |
| **J.** | FinSurv Reporting System | **Reporting core** — Business & Technical Specs, Operations Manual, **BoP categories for BOPCUS/BOPDIR inward (J.(F)) and outward (J.(H)) payments**, reconciliation module (J.(I)) |
| **K.** | Returns and reports | Periodic returns (insurance, immigrants, Reg 11/12 extensions) |

> **Important structural finding (drives the register-citation correction below).** In the live Manual, **foreign direct investment / outward investment is dealt with in Section B.2 (Capital transfers)** — chiefly B.2(C) (South African companies; B.2(C)(i) FDI ≤ R5bn) and B.2(E) (DTMC holding company) — **not in Section H**. Section H is "Inward listings on South African exchanges". The granular per-transaction **BoP category codes** sit in **Section J** (the FinSurv Reporting System chapter: J.(F) inward and J.(H) outward BoP categories) and, definitively, in the companion *FinSurv Reporting System Business & Technical Specifications*. The bank's existing FinSurv register rows that cited "Section H (foreign direct investment)" were imprecise; this analysis corrects the public, verifiable Section-letter part of those citations while preserving counsel-gating for the numeric BoP codes.

## Key obligations on the bank as Authorised Dealer

### Authorised-Dealer duties and conduct — Section A.3

- **A.3(B)** — Follow the procedures for administering the Exchange Control Regulations; transact only within the AD's delegated authority and refer transactions outside that authority to FinSurv for approval.
- **A.3(C)** — Obtain and retain the **documentary evidence** required before effecting a transaction (the supporting-documentation verification regime).
- **A.3(D)** — Meet the **reporting requirements for all Authorised Dealers**.
- **A.3(E)** — Apply the special treatment for transactions with **Common Monetary Area (CMA)** residents (Lesotho, Namibia, eSwatini — not "foreign currency" for many purposes per the A.1 definition).

### FinSurv reporting — Section J (with A.3(D))

- **J.(A)–(C)** — Report through the **FinSurv Reporting System** per the *Business and Technical Specifications* and the *Operations Manual*. Reporting is **per-transaction** (BOPCUS for customer flows; BOPDIR for the AD's own/direct flows), not aggregated.
- **J.(F) / J.(H)** — Apply the correct **balance-of-payments (BoP) category** to each inward (J.(F)) and outward (J.(H)) payment. *The economic class is fixed by the transaction's purpose; the precise numeric code is in the FinSurv Reporting System Specifications — counsel-gated for this bank (see citation note above).*
- **J.(D)** — Offshoring and cloud computing of the reporting function is subject to FinSurv conditions (intersects Principle 3 cloud-native posture and SARB Directive 3/2018).
- **J.(I)** — Operate the **reconciliation module**: the AD reconciles its transaction ledger against what it reported to FinSurv (continuous inspection readiness).

### Current-account flows — Section B

- **B.1** — Imports: verify import permits / requisite documentation and report payment for imports with the correct trade BoP category; comply with terms-of-payment rules.
- **B.3** — Income transfers: royalties (B.3(C)), licence/fee agreements (B.3(D)), and income due to non-residents (B.3(B)).
- **B.4** — Private-individual allowances: the **Single Discretionary Allowance** (B.4(A)) and **travel allowances** (B.4(B)); apply the per-calendar-year limits.
- **B.10** — Insurance and pensions: foreign-currency premium / reinsurance flows.
- **B.18–B.20** — Export control: export declarations, control of export proceeds, acceptance of foreign banknotes/travellers cheques.

### Capital-account flows — Section B.2

- **B.2(C)(i)** — **Outward foreign direct investment** by South African companies: Authorised Dealers may approve bona fide new outward FDI **not exceeding R5 billion per applicant company per calendar year**; amounts above the limit require FinSurv approval. FDI is defined (A.1) as a ≥ **10%** ordinary-share / voting-power interest.
- **B.2(E)** — South African holding company for African and offshore operations (DTMC dispensation).
- **B.2(H)** — South African **institutional investors** — foreign-portfolio-investment dispensations.
- **B.2(I)** — **Macro-prudential limit** for Authorised Dealers (the AD's own prudential offshore-exposure ceiling).

### FX derivatives / forward cover — Section D

- **D.1** — Forward cover / hedging between ADs and **residents**: foreign currency against Rand for forward contracts or FX option contracts **≤ 12 months** to maturity (active currency management, D.1(B)) and **> 12 months** (D.1(C)); foreign currency against foreign currency (D.1(D)); inter-AD transactions (D.1(E)); hedging operations (D.1(G)).
- **D.2** — Forward cover between ADs and **non-residents**.
- This is the AD-Manual home for the bank's FX-forward / FX-swap activity; the per-cash-flow FinSurv reporting of derivative legs still routes through Section J and cross-references the ODP regime (see `ORG-EXCON-ODP-001`).

### Cross-border loans — Section I

- **I.3(B)–(C)** — Borrowing abroad by residents; long-term and working-capital loans extended by ADs; corporate foreign-debt issuance (I.3(E)). Inward / outward loan flows are reportable with the correct other-investment BoP category.
- **I.1 / I.2** — Local financial assistance to affected persons / non-residents; facilities to non-residents (trade finance).

### Accounts — Section E

- **E.(A)** — Non-resident Rand accounts (NRRA).
- **E.(B)** — **Customer Foreign Currency (CFC) accounts** (relevant to the bank's nostro / FCY-balance administration).
- **E.(C)/(D)** — Foreign currency accounts; foreign bank accounts.

### Securities — Section G

- **G.(A)–(D)** — Control over residents' dealings in non-resident-owned securities; FinSurv requirements relating to the JSE; non-resident investment in SA debt securities; the JSE Derivatives Market (G.(N)). Relevant when the bank trades securities cross-border.

## Fulfilment in the bank's policy stack

| Manual area | Fulfilment policy / substrate | Owner |
|---|---|---|
| AD designation + AD-Manual undertaking (A.2, A.3) | Excon Compliance Policy v1 (`Policies/excon-compliance-policy-v1.md`) | Zara (CCO); Imani (legal chain) |
| Documentary-evidence verification (A.3(C)) | Excon Compliance Policy; FinSurv reporting procedure (planned: `Procedures/by-policy/finsurv-reporting.md`) | Zara (Mira) |
| FinSurv per-transaction reporting + BoP coding (Section J) | FinSurv reporting pipeline / BoP-code library (build); reconciliation engine | Zara (Mira) + Bea (engineering) |
| FX forward / swap conduct (Section D) | OTC Trading Policy (planned); Trading Mandate (`Policies/trading-mandate-v1.md`) | Saskia + Helena; Zara (CCO) |
| Net open position (separate PA return, not Manual) | Market Risk Policy; BA 125 / BA 330 returns | Helena + Camille (Bea) |
| Cross-border loans (Section I) | Excon Compliance Policy; loan-agreement clause library | Zara (Mira); Imani |
| CFC / nostro accounts (Section E) | Treasury / correspondent-banking design | Eitan + Tomas |

## Cross-references in the obligations register

Domain FX (FinSurv): `ORG-FX-FIN-01` through `ORG-FX-FIN-14`.
Plus: `ORG-MK-08` (Excon Manual generic) and `ORG-EXCON-ODP-001` (Excon + FinSurv reporting for OTC derivatives with non-resident counterparties).
See the v1.x version note in `_obligations-register.md` for the precise Section-letter citations resolved against this analysis and the BoP codes that remain counsel-gated.

## Open items / blocked-pending-counsel

- **Numeric FinSurv BoP category codes** (BOPCUS / BOPDIR) for each obligation row remain **blocked-pending-counsel** — ratified by Imani (Legal-as-code engineer) + external counsel at the licence gate. The Section-letter structure is resolved; the codes are not invented here.
- **AD designation** not yet held; obligations are designed-against and bind at COMMENCEMENT (first real cross-border transaction).
- **FinSurv Reporting System Specifications / Operations Manual** (the BoP-code catalogue referenced from Section J) not yet sourced as a structured repo document — sourcing gap (`GAP-FINSURV-SPECS`).
- **Section J.(D) offshoring/cloud** conditions to be reconciled with the Azure-migration plan (Principle 3) and SARB Directive 3/2018 at licence-readiness.

## Maintenance

- The Manual is amended **frequently** by Exchange Control Circular — watch the FinSurv Financial Surveillance Documents page and re-version on each Circular. The version-control sheet at the front of the Manual is the change log.
- On amendment: update the affected obligation-register rows and this analysis; re-confirm Section-letter citations.
- Quarterly review by Mira; annual sign-off by Zara (CCO) as the named compliance authority for the Excon programme.
