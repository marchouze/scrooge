---
title: FX product family — variants, compositions, build placement
author: Saskia · Kai
date: 2026-05-07
summary: FX added to the canonical product taxonomy. Spot, forward, swap, NDF, vanilla and exotic options, cross-currency swap. Zero new schema primitives, zero new lifecycle event types — every variant is a composition of the ten CDM primitives over the existing 24 markets events. M3–M5 phase placement; SA FinSurv compliance front-and-centre. Markets-vs-treasury book boundary preserved.
decision-required: false
---

# FX product family — variants, compositions, build placement

**Authors:** Saskia (Head of Global Markets — markets-side franchise) · Kai (trading systems engineer)
**Coordinated with:** Eitan (Treasurer — treasury-side FX for HQLA management); Mira (FinSurv compliance + sanctions on cross-border flows); Imani (ISDA FX-Module clauses + bilateral CSA for FX); Bea (IFRS classification + hedge accounting); Rohan (FX risk + SA-CCR on FX derivatives); Tomas (SWIFT MT3xx / ISO 20022 FX settlement); Senna + Rashida (FX FIX-gateway threat surface).
**Date:** 2026-05-07
**For:** Marc (CEO)
**Authority:** Extension of the approved CDM-foundation product inventory under `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07). The original architecture proposal placed "FX swaps + repo finance integration" at M4 as a one-line entry; this document is the substantive product-family specification that the M4 (vanilla FX) and M5 (FX options) phases implement.
**Status:** **Specification only — no build.** Build follows under Kai sequenced in §10. No new architectural decision is requested; this extension of the inventory operates entirely within the schema and event vocabulary already authorised.

> **Derivation note (Principle 6 — downward).** This document sits at the *standard* layer. It cites the strategic foundation, the CDM schema decision, the A0 event-schema freeze, and the obligations register. It authors no new substance — every claim is a composition over already-approved primitives.

---

## 1. Why FX is being added now

The strategic foundation commits to JSE-listed bonds, JSE-listed equities, and OTC interest-rate derivatives. FX is implicit in three places that have already been authorised:

- **Treasury HQLA management** (Eitan's mandate). FX swaps are the standard funding-currency-rotation tool; the bank cannot run an LCR / NSFR programme on ZAR-only balance sheet without FX-swap capability.
- **Institutional client coverage** (Saskia's mandate). A SA institutional global-markets desk that does not quote ZAR FX is not an institutional global-markets desk in any meaningful market sense; large SA corporates and the financial-institutions client segment expect FX alongside rates.
- **Multi-currency Principle 5**. The bank is built multi-currency from day one — that is principle-level. Without FX, multi-currency is a type-level claim with no real flows behind it.

The right framing is that FX has always been in scope; what is being added today is the **product specification** that locates each FX variant within the canonical schema and unblocks Kai's M3–M5 work on it. There is no new product-strategy decision in this deliverable — that decision was implicit in the strategic foundation and explicit in the M4 entry of the markets architecture.

What this deliverable *does* surface (in §12) are three sub-decisions that follow from adding FX in earnest: SARB authorised-dealer posture, CLS-membership posture, and the markets-vs-treasury book boundary for FX. Each is flagged for a future decision card; none blocks the spec.

## 2. The FX product family — variants

Eight variants cover the institutional FX surface:

| # | Variant | Description | Phase |
|---|---|---|---|
| 1 | **FX Spot** | Two-currency exchange at the spot rate, T+2 standard settlement. | M4 |
| 2 | **FX Outright Forward** | Two-currency exchange at a fixed forward rate, settlement at a future date beyond spot. | M4 |
| 3 | **FX Swap** | Combined spot leg + forward leg in opposite directions. The standard treasury-funding-currency-rotation tool. | M4 |
| 4 | **NDF (Non-Deliverable Forward)** | Forward priced in two currencies but cash-settled in the reference currency at a published fixing. Used where deliverable forwards are restricted. | M4 |
| 5 | **FX Vanilla Option** | European or American call / put on a currency pair. Premium paid up-front in either currency. | M5 |
| 6 | **FX Exotic Option** | Path-dependent / barrier / digital / Asian / forward-start variants. Composed from the optionality + barrier primitives. | M5+ (franchise-pull) |
| 7 | **Cross-Currency Swap (CCS)** | Exchange of cashflows in two currencies; principal exchanges typically at start and maturity; interest legs may both be fixed, both floating, or mixed. | M3 (extension of vanilla IRS) |
| 8 | **FX-linked Structured Notes** | Notes whose coupon or principal is a payoff function over an FX path. Pure composition layer. | M5+ (franchise-pull) |

Variants 1–4 are deliverable / cash; variants 5–8 introduce optionality and cross-currency cashflows. Every variant is built from the same ten CDM primitives.

## 3. Schema fit — zero new primitives, zero new lifecycle event types

The architectural test for the CDM foundation: can a major new product family land without modifying the schema? **Yes.** Every FX variant is a composition of the ten primitives in the markets-architecture proposal §4 over the 24 markets lifecycle events in the A0 freeze §5. The mapping:

| CDM primitive | FX usage |
|---|---|
| **Asset / Underlier** | Currency pair (e.g. `ZAR/USD`, `EUR/ZAR`). The Asset primitive's `instrumentType` field carries `Currency` for spot/forward/swap/NDF; the Underlier primitive references the pair for FX options. |
| **Index / Observable** | Spot fixing rate at NDF maturity; daily FX rate for option barrier observation; reference rate for NDF (e.g. SARB ZAR FixingRate, Reuters WM/Refinitiv 4pm London Fix). |
| **Schedule** | Spot date (T+2 + currency-pair calendar intersection); forward dates; CCS coupon and principal-exchange dates; barrier-observation schedule. |
| **Cashflow / Payout** | Principal exchanges (Fixed in each currency); option premium (Fixed in premium currency); CCS interest payments (Fixed or Floating); NDF settlement amount (Contingent — payoff function of fixing rate vs strike). |
| **Optionality** | FX vanilla options (European / American); barrier triggers for knock-in / knock-out exotics; digital payoffs; Asian average-rate calculation. |
| **Leg** | CCS has two legs (one per currency); FX swap has two legs (spot + forward). FX spot / forward / NDF are single-leg in the CDM sense. |
| **Settlement** | Physical (deliverable FX — both currencies move) for spot/forward/swap/CCS; cash (settlement in reference currency only) for NDF; CLS / non-CLS path is a Settlement-primitive sub-field. |
| **Collateral / Margin** | ISDA Master + CSA (FX-Module-aware); bilateral or CCP-cleared (FX-IM rules); CLS settlement is collateral-equivalent (PvP eliminates Herstatt risk so VM treatment differs). |
| **Identification** | Currency pair + counterparty LEI + bank legal entity + jurisdiction context (per Principle 5); SARB FinSurv reporting category for ZAR-vs-foreign trades. |
| **Lifecycle Event** | Existing 24 events from A0 cover every FX state transition (see §5 below). |

Every lifecycle transition in every FX variant maps to events already in the A0 freeze:

| FX state transition | A0 event(s) used | Discriminator field |
|---|---|---|
| Trade is formed | `TradeExecuted` | `productTaxonomy: "FX-spot" / "FX-forward" / "FX-swap" / "NDF" / "FX-option" / "FX-exotic" / "CCS"` |
| NDF fixing observed | `Reset` | `fixingType: "NDF-settlement"`; `index` references the agreed NDF fixing source |
| CCS rate fixing | `Reset` | `index` references the floating leg's reference rate |
| FX barrier hit / not hit (exotic) | `BarrierObservation` | (existing field set) |
| FX option exercised | `OptionExercised` | (existing field set) |
| FX option expired worthless | `OptionExpired` | (existing field set) |
| Option premium paid | `InterestPayment` (despite the name — A0's payment event covers any periodic cash payment) | `paymentType: "option-premium"` |
| Spot or forward principal exchange | `PrincipalPayment` | `paymentType: "FX-principal-leg"`; one event per currency leg |
| CCS coupon | `InterestPayment` | (existing field set) |
| CCS principal exchange | `PrincipalPayment` | `paymentType: "CCS-principal-exchange"` |
| FX MTM | `MarkToMarketObserved` | (existing) |
| FX settlement instructed / confirmed | `SettlementInstructed` / `SettlementConfirmed` | `csd: "CLS" / "Strate-FX" / "bilateral"`; `paymentRail: "SWIFT-MT202" / "ISO-20022-pacs.009"` |
| SARB FinSurv reportable | `TradeReportSubmitted` | `regulator: "SARB-FinSurv"`; `reportFormat: "FinSurv-XML"` |

**Result:** zero new event types. The A0 freeze stands; FX adds entries to the per-event discriminator vocabulary (`productTaxonomy`, `paymentType`, `csd`, `regulator`) but no new schema files. This is the value-test the architecture passes — adding FX is a config / discriminator extension, not engineering.

## 4. Worked compositions

### 4.1 FX Spot — institutional client buys USD against ZAR

- 1× Asset (currency pair `ZAR/USD`)
- 2× Cashflow (Fixed: client pays ZAR notional × spot rate; bank pays USD notional)
- 1× Schedule (spot date = trade date + 2 business days, intersection of ZA and US calendars)
- 1× Settlement (physical, two PvP confirmations under CLS or two non-CLS bilateral confirmations)
- 1× Identification (counterparty LEI; bank entity; ZAR + USD; ZA jurisdiction; FinSurv category for the client's stated purpose)
- Lifecycle events: `TradeExecuted` → `PrincipalPayment` × 2 (one per currency leg) → `SettlementInstructed` × 2 → `SettlementConfirmed` × 2 → `TradeReportSubmitted { regulator: "SARB-FinSurv" }` → `TradeMatured`

### 4.2 FX Outright Forward — corporate hedging USD payable in 3 months

Composition identical to 4.1 except the Schedule's settlement date is +3 months (not T+2) and the price is the forward rate, not spot. CDM treats spot and forward as the same product type with different schedule terms. Lifecycle is identical.

### 4.3 FX Swap — treasury rotates ZAR HQLA into USD HQLA for 1 month

- 2× Leg (spot leg, forward leg in opposite direction)
- Spot leg (composition per 4.1)
- Forward leg (composition per 4.2 with reversed cashflow direction)
- 1× Settlement (per leg — physical, PvP)
- 1× Identification (counterparty LEI; bank entity; ZAR + USD; ZA jurisdiction; FinSurv category)
- Lifecycle events: `TradeExecuted` → spot-leg lifecycle → forward-leg lifecycle → `TradeMatured`

This is a treasury (Eitan-owned, banking-book) trade. The booking discipline differs from a markets-book trade, but the **schema and event vocabulary are identical**.

### 4.4 NDF — non-resident counterparty hedges ZAR exposure (USD-settled)

- 1× Asset (currency pair `ZAR/USD`)
- 1× Index (NDF fixing source — typically SARB ZAR FixingRate at 4pm SAST or EMTA-published)
- 1× Cashflow (Contingent — payoff = (fixing rate − strike rate) × notional, settled in USD only)
- 1× Schedule (fixing date + settlement date, settlement is fixing-date + 2 business days)
- 1× Settlement (cash-only in USD; no ZAR delivery)
- 1× Identification (counterparty LEI; bank entity; ZAR + USD; non-ZA jurisdiction on counterparty side; FinSurv category)
- Lifecycle events: `TradeExecuted` → `Reset { fixingType: "NDF-settlement" }` (records the fixing) → `PrincipalPayment` (USD-only settlement) → `SettlementInstructed` / `Confirmed` → `TradeReportSubmitted { regulator: "SARB-FinSurv" }` → `TradeMatured`

NDF demonstrates the discriminator pattern: same `Reset` event as a CCS or IRS rate fixing, distinguished by `fixingType`.

### 4.5 FX Vanilla European Option — institutional client buys USD/ZAR call

- 1× Underlier (currency pair `USD/ZAR`)
- 1× Optionality (European, strike, expiry, premium currency)
- 1× Cashflow (Fixed — premium paid by buyer at trade + 2 business days)
- 2× Cashflow (Contingent — exercise payoff in each currency if exercised; cash-settled if so agreed)
- 1× Schedule (premium-payment date, expiry date, settlement date)
- 1× Settlement (physical or cash per the contract)
- 1× Collateral (CSA terms applicable)
- 1× Identification (counterparty LEI; bank entity; USD + ZAR; FinSurv category)
- Lifecycle events: `TradeExecuted` → `InterestPayment { paymentType: "option-premium" }` (premium settles) → at expiry: `OptionExercised` (cash or physical) or `OptionExpired` → if exercised: principal payment lifecycle → `TradeMatured`

### 4.6 FX Exotic Option — knock-out USD/ZAR put with daily barrier

- Composition per 4.5, plus:
- 1× additional Optionality (knock-out barrier)
- 1× Schedule (daily barrier-observation schedule, ZA + US calendars)
- 1× Index (daily ZAR/USD spot rate at the agreed observation source / time)
- Lifecycle events: as 4.5 plus daily `BarrierObservation` events → if barrier hit: `CallRightTriggered` ("knock-out lapse" on the option holder's right) → `OptionExpired`

This is the same composition as the equity-basket Bermudan-callable structured note in the original architecture proposal §5.3. Different underlier, identical primitive shapes. The structured-product factory works for FX exactly as it works for equities.

### 4.7 Cross-Currency Swap (CCS) — fixed ZAR vs floating USD-SOFR, 5-year, with principal exchange

- 2× Leg (ZAR fixed leg; USD floating leg)
- ZAR leg: 1× Schedule (semi-annual, ZA calendar) + 1× Cashflow (Fixed at trade strike) + 1× Cashflow (PrincipalExchange — ZAR notional at start in one direction, at maturity in the other)
- USD leg: 1× Schedule (quarterly, US calendar) + 1× Index (compounded SOFR) + 1× Cashflow (Floating, rate = compounded SOFR + spread) + 1× Cashflow (PrincipalExchange — USD notional at start in one direction, at maturity in the other)
- 1× Collateral (ISDA Master + CSA, ZAR / USD eligible cash + SAGB / USTs collateral)
- 1× Identification (counterparty LEI; bank entity; ZAR + USD; ZA jurisdiction; FinSurv category)
- Lifecycle events: `TradeExecuted` → at start: `PrincipalPayment` × 2 (initial principal exchanges) → repeated `Reset` (USD floating fixings) → repeated `InterestPayment` × 2 (one per leg per period) → at maturity: `PrincipalPayment` × 2 (terminal principal re-exchange) → `TradeMatured`

CCS sits at M3 alongside vanilla IRS, not at M4, because it is structurally an IRS with FX. CCS is the most schema-stretching of the FX variants and also the most useful for SA institutional flows; placing it at M3 means the bank can quote both rates and CCS simultaneously rather than rates-then-FX.

### 4.8 FX-linked Structured Note

A note paying coupons linked to an FX path (e.g. quanto coupons referencing a USD/ZAR observation but paid in ZAR; or "double-no-touch" notes paying a fixed coupon if FX stays inside a corridor).

- Composition per the equity structured-note example in the architecture proposal §5.3, with the Underlier swapped to a currency pair and the observation source set to an FX fixing.

Identical machinery, different inputs. Confirms the structured-product composition layer (M5+) is product-agnostic.

## 5. Citation surface — FX-specific

Mira to populate / extend the obligations register with FX-specific URNs. Initial set:

| Domain | Instruments to cite |
|---|---|
| **SARB Exchange Control / FinSurv** | Currency and Exchange Manual for Authorised Dealers (the "Exchange Control Manual"); FinSurv reporting requirements (the bank as Authorised Dealer is the conduit); SARB ZAR FixingRate publication; cross-border-flow reporting categories (current account, capital account, etc.). **The FinSurv URN cluster is the largest single citation addition this product family makes.** |
| **FSCA Conduct (FX dealing)** | FSCA Conduct of Business Standards on FX dealing for institutional clients; FSCA market-abuse provisions extended to FX (FX fixing manipulation, front-running on client FX orders); Joint Standard 1 of 2024 sub-clauses on FX-system cyber-resilience. |
| **OTC derivatives — international (FX-derivatives)** | ISDA 1998 FX and Currency Option Definitions (and the 2010 update); EMTA NDF Settlement Rate Reference Documents (per emerging-market currency pair); ISDA FX Module CSA terms; ISDA SIMM treatment of FX risk factors. |
| **CLS** | CLS Bank rulebook (if the bank joins CLS); CLS-eligible currency list; CLS settlement-cycle timing (the CLS settlement window is a regulatory operational constraint). |
| **Settlement messaging** | SWIFT MT3xx (legacy FX confirmation messages) → ISO 20022 `pacs.008` / `pacs.009` (the FX-payment migration target); SWIFT FIN Y-Copy for CLS settlement. |
| **Accounting** | IFRS 9 classification (FX derivatives typically FVTPL; designated hedges under hedge-accounting model); IAS 21 (foreign-currency-translation reporting impact at group level — Camille); IFRS 13 fair-value hierarchy (FX vanilla = Level 2; FX exotics = Level 2 / 3 split). |
| **Capital + market risk** | BCBS FRTB FX risk-factor class (delta, vega, curvature); BCBS SA-CCR for FX-derivative counterparty exposure; BCBS IRRBB does not apply to FX (banking-book FX position risk is treated under structural FX rules). |
| **Financial crime + sanctions** | FIC Act CDD / EDD on cross-border counterparties; sanctions screening at increased intensity for cross-border FX flows (already handled by `sanctions-screening.md`); FATF guidance on FX-corridor financial-crime typologies; tipping-off prevention discipline on FinSurv-flagged transactions. |
| **Tax** | Fees-and-spreads VAT treatment (largely exempt as financial services); deferred-tax classification on FX MTM (IAS 12); WHT considerations on FX-linked structured notes paid to non-residents. |
| **Privacy** | POPIA s.72 cross-border data-transfer assessment for non-resident counterparty data (covered by `s72-transfer-assessment.md`, planned). |

The **FinSurv URN cluster is the largest single addition to the obligations register**. Mira should treat FinSurv as a distinct sub-domain alongside the existing FIC / FSCA clusters and curate it accordingly.

## 6. SA-specific FinSurv compliance — substantive new procedure

The Exchange Control Manual makes the bank, as Authorised Dealer, responsible for verifying the validity of every cross-border FX flow it intermediates and reporting it to SARB FinSurv with the correct category code. This is not a marginal compliance burden — it is a substantial operational discipline that turns every FX trade into a regulatory-reporting event.

A new procedure is added to the procedures library:

- **`Procedures/by-policy/finsurv-reporting.md`** — owned by Mira (engineering) and Zara (governance). Triggered on every FX-trade lifecycle event involving ZAR vs a foreign currency. Verifies: (a) underlying flow legitimacy per Exchange Control Manual; (b) FinSurv category code assignment; (c) submission of the FinSurv report; (d) reconciliation of submission acknowledgements. Cited under FSC Conduct Standards + Exchange Control Manual.

This procedure consumes the existing `TradeExecuted` event (with FX `productTaxonomy`) and emits the existing `TradeReportSubmitted` event (with `regulator: "SARB-FinSurv"`). No new event types.

The FinSurv discipline is the strongest substantive operational reason FX is materially harder than equities or bonds for an SA bank, and the most visible reason markets-led FX ≠ treasury-led FX (the FinSurv categories differ when the bank is hedging its own banking-book vs intermediating a client's flow).

## 7. Multi-currency / multi-X — FX is the test case for Principle 5

FX is the most stringent test of the bank's Principle-5 multi-currency-by-default discipline. Every FX trade has at least two currencies, and most have at least two jurisdictions. The substrate must:

- Carry currency at the type level on every Cashflow primitive (already enforced by CDM + Zod).
- Resolve FX-pair calendars (intersection of two currency-pair holiday calendars) on every Schedule (CDM provides this; Anya's calendar service must support it).
- Track jurisdiction context on both legs of a cross-border trade (already in the Identification primitive; FinSurv category is an additional jurisdictional discriminator).
- Translate the bank's reporting currency (ZAR) from each FX-trade's native currencies via IAS 21 — but never store the translated value as authoritative (it is always a query-time derivation per Principle 1).

If any of these substrate behaviours has a single-currency implicit assumption baked in, FX exposes it. Atlas + Anya should treat the FX milestones as the real Principle-5 audit; equities-only and bonds-only milestones can mask single-currency shortcuts that FX cannot.

## 8. Markets-vs-treasury book boundary

FX is the first product family to be jointly relevant to the markets book (Saskia, trading-book, FVTPL, client coverage) and the treasury book (Eitan, banking-book, hedge-accounted or structural-FX-treated, HQLA-related). The boundary discipline:

| Aspect | Markets book (Saskia) | Treasury book (Eitan) |
|---|---|---|
| Purpose | Client coverage; market-making; speculative on a contained book | HQLA management; structural-FX hedge; banking-book funding-currency rotation |
| IFRS classification | FVTPL — held for trading | FVTPL or designated hedge under IFRS 9 hedge model |
| Risk treatment | FRTB market risk (under IMA or SA-MR) — Rohan | IRRBB does not apply; structural FX treatment under PA guidance — Helena governs |
| Capital treatment | Trading-book RWA | Banking-book FX-net-position RWA |
| Reporting | Trade-reporting under FMA / FSCA Conduct Standard 1 of 2019 | FinSurv reporting still applies; trade-reporting may differ |
| Booking surface | Trading-system event log (same substrate) | Trading-system event log (same substrate) |
| Distinguishing field | Identification primitive carries `bookType: "trading"` | Identification primitive carries `bookType: "banking-treasury"` |

**Same schema. Same event vocabulary. Same substrate.** The book-type discriminator on the Identification primitive is the only schema addition the boundary needs. Bea's IFRS classification rules and Rohan's risk-method dispatching read `bookType` to apply the correct treatment.

This is the second value-test of the architecture: the markets-vs-treasury boundary, classically maintained as two separate systems at most banks, is here a discriminator on a shared schema. The bank cannot duplicate the historical industry pattern of "trading system" + "treasury system" + "spreadsheet reconciliation between them" — that pattern is forbidden by Principle 1.

## 9. Cross-persona dependencies

| Persona | What's needed for FX |
|---|---|
| **Mira** | FinSurv URN cluster populated in the obligations register; `finsurv-reporting.md` procedure authored; sanctions-screening intensification on cross-border counterparties (existing `sanctions-screening.md` extended). |
| **Eitan** | Treasury-side FX requirements specified — funding-currency-rotation cadence; HQLA composition targets in foreign currency; hedge-effectiveness testing (Bea joint). |
| **Imani** | ISDA FX-Module clause coverage in the clause library; CSA collateral-eligibility for FX (cash margin in two currencies, plus government-bond eligibility per side); CLS-membership documentation if pursued. |
| **Bea + Camille** | IFRS 9 classification rules per FX variant; IAS 21 reporting-currency translation discipline at group level; designated-hedge accounting flow for treasury hedges. |
| **Rohan** | FX risk factors (delta, vega, curvature) integrated into the FRTB framework; SA-CCR add-ons for FX derivatives; structural-FX position monitoring (banking-book). |
| **Helena** | Trading mandate B5 — FX limits, currency-pair specific caps, banking-book structural-FX appetite (joint with Eitan); model-risk governance over the FX vol-surface model used in pricing. |
| **Tomas** | SWIFT MT3xx → ISO 20022 `pacs.008` / `pacs.009` migration plan for FX confirmations and settlement; CLS connectivity if pursued; non-CLS bilateral settlement Herstatt-risk runbook. |
| **Atlas + Anya** | Calendar service supporting currency-pair-calendar intersection; ZAR FX fixing source registered in the semantic layer; vol-surface and forward-curve substrate registered as canonical market-data inputs. |
| **Senna + Rashida** | Threat model on the FX FIX gateway (the most exposed external perimeter); CLS-connectivity threat surface if pursued; sanctions-screening real-time path for FX execution must hit < 1 second to be operationally viable on G10 client flow. |
| **Saskia + Niko** | Client-onboarding adjusted for FX-derivative counterparties (suitability assessment under FAIS / FSCA Conduct Standard 1 of 2019); margin documentation; trade-confirmation flow. |

## 10. M-phase placement (refined)

The original architecture proposal placed FX at M4. Given the analysis above, the placement refines slightly:

| Phase | FX scope | Rationale |
|---|---|---|
| **M3** (with vanilla OTC IRS) | CCS (Cross-Currency Swap) | CCS is structurally an IRS with FX legs; building it alongside vanilla IRS at M3 avoids re-touching the IRS lifecycle code at M4. |
| **M4** | FX Spot, FX Outright Forward, FX Swap, NDF | Vanilla deliverable + cash-settled forwards. CLS / non-CLS settlement decision lands here. |
| **M5** (with optionality + structured products) | FX Vanilla Options (European / American); FX-linked Structured Notes (composition layer) | Optionality primitive ships at M5; FX vanilla options use it identically to rate caps / floors / swaptions. |
| **M5+ (franchise-pull)** | FX Exotic Options (knock-in / knock-out / digital / Asian / forward-start) | Franchise-demand-driven; built by composing barriers + path-dependent payoffs over the optionality + barrier-observation primitives already in M5. |

This phasing keeps M3 and M4 each at vanilla + structured deliveries respectively, with no FX-specific phase bump. The original "M4 FX swaps + HQLA repo financing" entry remains accurate; this deliverable elaborates the variants within it and places CCS at M3.

## 11. Substrate gaps (FX-specific)

What FX needs that doesn't yet exist:

- **Currency-pair calendar service** — per CDM, every FX schedule resolves against the intersection of two currency-pair calendars. Anya owns; CDM publishes the rule, Anya provides the SA / G10 / EM calendar data. Required at M3.
- **FX fixing-rate substrate** — SARB ZAR FixingRate (4pm SAST), Reuters / Refinitiv WM/Reuters Closing Spot Rates, EMTA per-currency NDF fixings. Atlas's `MarketDataIngested` event covers the schema; the actual feed integrations are operational. Required at M4.
- **CLS connectivity decision and integration** (if pursued — see §12). M4 substrate gap if approved.
- **Non-CLS bilateral settlement Herstatt-risk runbook** — Tomas owns. Required at M4 regardless of CLS decision (some currency pairs and counterparties will always be non-CLS).
- **FX vol-surface substrate** — required at M5 for FX vanilla option pricing. Internal calibration vs. vendor-feed vol surface is a sub-decision (similar to rate vol surface for swaptions).
- **FinSurv submission integration** — out-of-system submission via Authorised Dealer reporting interface. The `TradeReportSubmitted` event is the bank's emission; the regulator-side acknowledgement integration is a Mira deliverable. Required at M4.
- **Banking-book vs trading-book booking discipline** — `bookType` discriminator on the Identification primitive (small schema-vocabulary extension; not a new primitive). Required at M4.
- **Hedge-accounting designation flow** — Bea's joint-deliverable with Camille for IFRS 9 hedge model; required when treasury starts using FX swaps to hedge banking-book FX exposure (M4 onwards).
- **Pricing libraries — FX exotics** — at M5+. Build vs. vendor-licence decision deferred (same posture as for rate exotics in the original proposal).

These are operational / data integrations, not schema work. The architecture's promise — that adding a major new product family is a config + integration project, not a re-platform — holds for FX.

## 12. Sub-decisions surfaced (not blocking, flagged for future cards)

Three substantive sub-decisions follow from FX in earnest. Each is a future decision card the dashboard will surface; none blocks the spec.

| # | Decision | Recommendation (for the future card) |
|---|---|---|
| 1 | **SARB Authorised-Dealer status** — does the bank apply for full Authorised Dealer status, ADLA (limited), or use a correspondent? | **Pursue full Authorised Dealer.** Institutional FX coverage requires it; ADLA is restricted to retail forex; correspondent-routing means the bank does not actually own the FX franchise. This is a strategic-foundation amendment that touches the licence application. Owner: Saskia + Mira + Imani. |
| 2 | **CLS membership** — does the bank join CLS as a Settlement Member, use a Third-Party-Customer relationship through a CLS member, or settle bilaterally? | **Third-Party-Customer through a CLS Settlement Member.** CLS Settlement Membership is operationally heavy for an institution at the bank's scale; full bilateral settlement carries Herstatt risk that will not pass internal-audit on day one. Third-Party access via a major SA / global Settlement Member is the standard path. Owner: Eitan + Tomas + Senna. |
| 3 | **Markets-vs-treasury FX-book boundary** — exactly which FX flows belong in which book, and what migration discipline applies if a flow crosses. | **Markets-book by default; treasury-book by explicit tagging at booking, not by post-hoc reclassification.** The book-type discriminator is set at `TradeExecuted` time; reclassification is an explicit `TradeAmended` event with audit trail. Owner: Saskia + Eitan jointly; Helena governs the framework; Bea applies the IFRS dispatch. |

Each surfaces as its own decision card in due course (frontmatter `decision-required: true` on the future deliverables). They do not gate the FX spec — the spec is correct under any combination of resolutions.

## 13. Open items routed elsewhere

- **To Mira:** FinSurv URN cluster population; `finsurv-reporting.md` procedure authoring; sanctions-screening cross-border intensification.
- **To Eitan:** treasury-side FX scope confirmation; funding-currency-rotation cadence; HQLA-by-currency composition targets; hedge-effectiveness flow.
- **To Imani:** ISDA FX-Module clause-library coverage; CSA collateral terms for FX; ECTA-discipline for cross-border counterparty contracts.
- **To Bea + Camille:** IFRS classification rules per variant; IAS 21 translation discipline; hedge-accounting designation flow.
- **To Rohan:** FX risk-factor coverage in FRTB; SA-CCR FX add-ons; structural-FX banking-book monitoring.
- **To Tomas:** SWIFT MT3xx → ISO 20022 migration plan; CLS-connectivity scoping; non-CLS Herstatt-risk runbook.
- **To Atlas + Anya:** currency-pair calendar service; FX fixing-rate substrate registration; vol-surface substrate (M5 prep).
- **To Senna + Rashida:** FX FIX-gateway threat model; real-time sanctions-screening latency target on G10 flow.
- **To Helena:** trading mandate B5 — FX-pair limits + structural-FX appetite (joint with Eitan).
- **To Owen:** add `finsurv-reporting.md` to `Procedures/_index.md` under Compliance & financial crime; add `cls-membership-evaluation.md` to a new "Markets operations" section if §12 sub-decision #2 is pursued.
- **To Saskia + Niko:** institutional FX-counterparty onboarding flow under FAIS / FSCA Conduct Standard 1 of 2019.

## 14. What this does *not* do

- **No new schema work.** This is the architectural test the CDM foundation passes. The deliverable is a composition catalogue, not a schema extension.
- **No new event types in the A0 freeze.** Discriminator-vocabulary additions only.
- **No live FX trading.** Build-only operating posture remains; M3–M5 run on synthetic FX feeds and synthetic counterparties; live feeds and live FinSurv submission light up at licence approach.
- **No commitment on §12 sub-decisions.** Those land as future decision cards on Marc's dashboard. The spec is correct under any resolution.
- **No FX algorithmic-trading capability.** Market-making in client FX is in scope; quantitative algo-trading on the bank's own book is not in the strategic foundation. (If franchise-pull surfaces it, separate decision card.)

## 15. Closing

FX adds a major product family — eight variants, the largest single citation extension to the obligations register, the first joint markets-treasury product family, and the test case for Principle-5 multi-currency discipline. **The schema and event vocabulary need zero changes.** That is what the CDM foundation was chosen for, and this is the first proof that the choice was correct.

Build sequencing: CCS at M3, vanilla FX (spot / forward / swap / NDF) at M4, FX vanilla options at M5, FX exotics at M5+ on franchise-pull. Three sub-decisions surfaced for future cards (Authorised Dealer status; CLS membership; markets-vs-treasury boundary discipline) — none blocks the spec.

—Saskia (markets-side franchise) · Kai (engineering)
