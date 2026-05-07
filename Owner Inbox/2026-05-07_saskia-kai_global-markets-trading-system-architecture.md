---
title: Global markets trading system — schema foundation, building blocks, build sequence
author: Saskia · Kai
date: 2026-05-07
summary: ISDA CDM (Common Domain Model) as the canonical schema for every tradeable / holdable instrument. Composable primitives (cashflow, schedule, index, optionality, settlement, collateral) compose into simple cash products and complex structured trades. M1–M5 build sequence proposed.
decision-required: true
decision-id: D-MARKETS-SCHEMA-FOUNDATION
decision-category: near-term
decision-owner: Saskia (governance) · Kai (engineering)
decision-for-ceo: Approve ISDA CDM as the canonical schema foundation for the trading system, sequenced M1 (listed cash) → M3 (OTC IRS) → M5 (FRTB-ready, structured products).
decision-recommendation: Approve. CDM is open-source, regulator-friendly, multi-asset, composable, and is the only public standard whose decomposition matches the strategic-foundation product mix (listed cash + OTC IRD).
---

# Global markets trading system — schema foundation, building blocks, build sequence

**Authors:** Saskia (Head of Global Markets — franchise & governance) · Kai (trading systems engineer — implementation)
**Date:** 2026-05-07
**For:** Marc (CEO)
**Authority:** Strategic-foundation directive of 2026-05-06 (institutional global-markets trading bank: JSE-listed bonds, JSE-listed equities, OTC interest-rate derivatives). Implements Principle 1 (events as truth), Principle 5 (multi-currency / -entity / -jurisdiction), and Principle 6 (single-graph discipline) at the markets layer.
**Status:** **Specification only — no build.** Build follows under Atlas (substrate) + Kai (markets-domain engineering) + Anya (data substrate), sequenced in §10.

> **Derivation note (Principle 6 — downward).** This document sits at the *standard* layer (technical specification of the schema product types implement). It cites the strategic foundation, the obligations register, the policy register, and the planned procedures inventory. It does not author principle-level substance independently.

---

## 1. Why a single schema

The strategic foundation today commits to JSE-listed bonds, JSE-listed equities, and OTC interest-rate derivatives. The franchise will, with high probability, need to expand from there — FX swaps for HQLA management, repo for funding, single-name credit for institutional client demand, and structured notes wrapping the IRS book. Every one of those products has been engineered separately at most banks and the result is the operational pattern Saskia wants to avoid: a vanilla-IRS booking system, a separate equities order-management system, a third settlement system for bonds, and a fourth that pretends to be the structured-notes desk. They diverge, drift, and reconcile through spreadsheets.

The bank's principles forbid that pattern:

- **Principle 1** — every position must be a query over the event log. Multiple booking systems means multiple authoritative aggregates, which is what P1 prohibits.
- **Principle 5** — multi-currency, multi-entity, multi-country is type-level. Per-product schemas duplicate this discipline poorly.
- **Principle 6** — single-graph discipline. Capabilities, procedures, regulator obligations, and accounting policies must reconcile bidirectionally; that requires every trade to be a node in the same graph.

The discipline this document asserts: **every tradeable or holdable instrument — listed cash, OTC derivative, structured product, repo, securities lending — is represented in the same canonical schema, composed from the same primitives, and emitted into the same event log.** The schema is the only place product knowledge lives. Pricing, risk, accounting, settlement, regulator reporting, and counterparty exposure are all queries over this schema.

## 2. Recommendation — ISDA Common Domain Model (CDM)

**Recommended foundation:** **ISDA Common Domain Model (CDM)** as the canonical schema, expressed in the open Rosetta DSL and consumed via the JSON / TypeScript bindings that Kai's trading agents and Anya's projection runtime will use.

CDM is the right choice for this bank because:

- **Open standard, vendor-neutral.** Maintained by ISDA, ICMA (repo), and ISLA (securities lending). Not controlled by a vendor whose interests diverge from the bank's. Fits the build-not-buy posture.
- **Multi-asset by construction.** One schema covers rates, FX, credit, equity, commodity, repo, securities lending, and structured products. The strategic foundation's product mix sits inside CDM today; the franchise's likely expansion sits inside CDM tomorrow.
- **Decomposed into primitives.** A product is *not* a class with hard-coded fields. A product is a **composition of primitives** (cashflows, schedules, indices, payouts, exercise rules). A vanilla IRS and a Bermudan callable structured note are built from the same primitives, with different combinations. That is exactly the property Marc asked for.
- **Functional decomposition.** CDM's contract model is a function `payoff(state, observable, time) → cashflow`. Pricing libraries, risk calculators, and lifecycle handlers all read this function. No product-specific code paths in the substrate.
- **Lifecycle-event-native.** CDM models trades as a sequence of typed events (formation, payment, reset, exercise, novation, partial termination, default). This is exactly Principle 1's posture; it requires no translation layer.
- **Regulator-aligned.** CDM is the basis of CFTC / EMIR / MAS / HKMA reporting standards and the ISDA SIMM model. SARB and FSCA are not yet CDM consumers, but global-bank operational practice has converged on it; using CDM positions the bank to satisfy any future SARB / FSCA reporting standard with minimal translation.

**Considered and rejected alternatives:**

| Alternative | Why rejected |
|---|---|
| **FpML (Financial Products Markup Language)** | XML; less composable than CDM at the primitive level; CDM supersedes FpML for new builds and ISDA's roadmap migrates FpML consumers to CDM. Some regulator templates still ask for FpML — handled at the export layer, not the canonical schema layer. |
| **FIX message standard** | FIX is a *message* protocol, not a product model. Excellent for execution-venue connectivity (we use it there); insufficient as a canonical product schema. Cash and listed instruments dominate FIX coverage; OTC derivatives are weakly modelled. |
| **ISO 20022** | Strong for payments and securities settlement messaging; weak as a product model for OTC derivatives. We use ISO 20022 for settlement messages (`sese.*`, `semt.*`, `pacs.*`) but not as the canonical trade schema. |
| **Custom in-house schema** | Defeats the purpose. Every bank that built its own ended up reinventing CDM badly and then paying to migrate. |
| **Vendor product model (Murex, Calypso, Summit, Adaptiv, Quantifi)** | Incompatible with the build-not-buy posture and the event-sourcing architecture. Vendors maintain authoritative aggregates, which P1 forbids. We may use vendor pricing libraries via clean interfaces; we do not adopt their product model. |

**Recommendation:** approve CDM as the foundation. Implement as a TypeScript binding under `@platform/markets/cdm/` consuming CDM's published Rosetta JSON model; Zod schemas at the event-store boundary; lifecycle event types registered with Atlas's substrate.

## 3. Product scope per the strategic foundation

The schema must cover three product families on day one and be extensible to the franchise's likely expansion path:

| Family | Strategic-foundation status | M-phase | CDM coverage |
|---|---|---|---|
| **Listed equities (JSE)** | In scope | M1 | CDM Cash Product · Equity. Requires extension for JSE-specific corporate-action types (cash dividend, scrip dividend, share split, rights issue, M&A consideration). |
| **Listed bonds (JSE)** | In scope | M2 | CDM Cash Product · Debt. Vanilla fixed-coupon + zero-coupon out-of-the-box; SAGB inflation-linked needs the inflation-index extension (already in CDM). |
| **OTC IRS (single-currency, vanilla)** | In scope | M3 | CDM Contract · InterestRatePayout. Fixed-vs-floating against ZARONIA (post-JIBAR transition) or JIBAR for the legacy book. |
| **OTC IRS (multi-curve, structured)** | Likely M5 | M5 | CDM Contract · multi-leg compositions. Caps, floors, swaptions via the OptionPayout primitive. |
| **Repo (cash and securities)** | Likely M4 (Treasury demand) | M4 | CDM Contract · Repo (ICMA extension). Used by Eitan for HQLA funding and by Saskia for inventory financing. |
| **FX swaps and forwards** | Likely M4 (HQLA hedge) | M4 | CDM Contract · ForeignExchange. |
| **Securities lending** | Optional, post-licence | M6 | CDM Contract · SecuritiesFinancing (ISLA extension). |
| **Single-name credit (CDS) and indices (CDX)** | Optional, post-licence | M7+ | CDM Contract · CreditDefaultPayout. Only if franchise demand concretises. |
| **Structured notes** | Composition layer over the above | M5+ | Built by composing the primitives. No new schema work — that is the point. |

The franchise begins narrow (M1–M3); the schema accommodates the broader inventory natively.

## 4. The primitive catalogue (building blocks)

CDM exposes ten primitive families. Every product in §3 is a composition of these. The catalogue below is the complete set Kai's trading agents and Anya's projection runtime read from.

| Primitive family | What it represents | Used by (examples) |
|---|---|---|
| **Asset / Underlier** | The thing the contract references — single equity, debt instrument, basket, index, fund, commodity, currency pair. | Every product. Listed-cash trades reference the asset directly; derivatives reference it via the Underlier primitive. |
| **Index / Observable** | A market-observable value that drives the contract — interest rate (ZARONIA, JIBAR, SOFR), FX rate, equity price, credit spread, inflation index. Carries source, fixing time, calculation method. | OTC IRS (rate index); FX forwards (FX index); inflation linkers (CPI index). |
| **Schedule** | A sequence of dates — calculation periods, payment dates, fixing dates, exercise dates — with business-day-convention and calendar (per Principle 5: every date carries its calendar). | Every product with periodic cashflows. |
| **Cashflow / Payout** | The amount paid or received at a time, computed from a payoff function. Three sub-types: **Fixed** (known amount), **Floating** (function of an index), **Contingent** (function of an event — barrier, knock-in, default). | All cashflows in all products. |
| **Optionality** | Exercise rights — Style (European, American, Bermudan), Strike, Expiry, Settlement (cash / physical / NDF). | Caps, floors, swaptions, callable bonds, structured notes. |
| **Leg** | A bundle of cashflows on one side of a trade (the "fixed leg" of an IRS; the "premium leg" of a CDS). Composed of Schedule + Cashflow primitives. | All bilateral derivatives. |
| **Settlement** | How the contract terminates economically — physical delivery, cash settlement, NDF (non-deliverable forward). Carries CSD (Strate for JSE), CCP (JSE Clear / LCH), or bilateral path. | Every product (one Settlement primitive per leg or per option). |
| **Collateral / Margin** | The collateral arrangement — CSA terms, IM/VM thresholds, eligible collateral, ISDA SIMM eligibility, valuation agent. | Every OTC derivative under an ISDA Master. |
| **Identification** | Who, where, what — counterparty (LEI), legal entity (the bank's own tree, per Imani), jurisdiction (multi-X per Principle 5), product taxonomy (CFI / ISIN / CUSIP / FpML category). | Every trade. Carries the Principle-5 type-level multi-X context. |
| **Lifecycle Event** | A typed change to the contract — execution, novation, exercise, partial termination, payment, reset, default, restructuring, corporate action. | Every product over its life. This is the bridge to Principle 1. |

These ten primitives cover every product in the strategic foundation and the franchise's likely expansion. New product types are not new primitives; they are new compositions.

## 5. Composition examples — simple to complex

The same primitives compose progressively complex instruments. Three worked examples:

### 5.1 Simple — JSE equity purchase

**Composition:**
- 1× Asset (the equity, by ISIN)
- 1× Cashflow (Fixed, cash leg = price × quantity)
- 1× Schedule (settlement date, T+3 SA calendar)
- 1× Settlement (physical, CSD = Strate)
- 1× Identification (counterparty LEI; bank entity; ZAR; ZA jurisdiction)
- Lifecycle events: `TradeExecuted` → `TradeSettled`

That is the entire model for an equity trade. No equity-specific code path.

### 5.2 Moderate — Vanilla 5-year ZAR fixed-vs-ZARONIA IRS

**Composition:**
- 2× Leg (Fixed leg, Floating leg)
- Fixed leg: 1× Schedule (semi-annual payment, ZA calendar) + 1× Cashflow (Fixed, rate = trade strike)
- Floating leg: 1× Schedule (quarterly payment, daily compounding) + 1× Index (ZARONIA, SARB source) + 1× Cashflow (Floating, rate = compounded ZARONIA + spread)
- 1× Settlement (cash, bilateral)
- 1× Collateral (ISDA Master + CSA, IM/VM via SIMM, ZAR cash + SAGB eligible)
- 1× Identification (counterparty LEI; bank entity; ZAR; ZA jurisdiction)
- Lifecycle events: `TradeExecuted` → repeated `Reset` (per fixing date) → repeated `InterestPayment` (per payment date) → `TradeMatured`

The IRS uses the same primitives as the equity — Schedule, Cashflow, Settlement, Identification — plus Leg, Index, Collateral.

### 5.3 Complex — Bermudan-callable structured note in ZAR

A structured note paying coupons linked to an equity basket, callable by the issuer on six annual dates, with a knock-in barrier on the worst-performing underlier.

**Composition:**
- 1× Leg (the note's coupon leg)
- Coupon leg: Schedule (annual) + Cashflow (Contingent — payoff function of basket performance and barrier observation) + 1× Optionality (knock-in barrier, observed daily)
- 1× Optionality (Bermudan call right held by issuer, six exercise dates, cash settlement)
- 1× Underlier (basket of three equities, with a worst-of operator)
- 6× Index observations (basket performance per call date)
- 1× Settlement (physical at maturity, cash on call)
- 1× Identification (counterparty LEI; bank entity; ZAR; ZA jurisdiction)
- Lifecycle events: `TradeExecuted` → daily `BarrierObservation` → annual `CallRightTriggered` (or `CallRightLapsed`) → either `EarlyRedeemed` (cash) or `CouponPaid` → eventually `TradeMatured` (physical or knock-in)

The same ten primitives. No structured-notes-specific code path. New structured products that the desk invents post-licence are new compositions, not new primitives.

This composability is the asset Marc asked for. The franchise can launch a new structured product without an engineering project — just a new combination of primitives in a Rosetta-DSL config, validated against the existing schema, registered with the substrate.

## 6. Lifecycle event model (Principle 1)

Every contract is a folded reduction over a sequence of typed lifecycle events. The event types Kai's substrate registers from day one:

| Event type | Carries | Issued by |
|---|---|---|
| `TradeProposed` | Pre-trade — RFQ received, indicative price quoted | Sales agent |
| `TradeExecuted` | Trade is legally formed; CDM Contract; counterparty; price; venue | Execution agent (Kai-managed); Saskia signs market-making book auto-trades |
| `TradeAllocated` | Block trade split across funds / sub-accounts | Allocation agent |
| `TradeNovated` | Counterparty changes (give-up, CCP novation) | Novation agent |
| `TradeAmended` | Terms change (CCP-side, MTM-driven re-papering) | Amendment agent (with Imani's clause-library backing) |
| `Reset` (per Index Observation) | Floating-rate fixing recorded | Substrate scheduler |
| `BarrierObservation` | Barrier breach / non-breach | Substrate scheduler |
| `InterestPayment`, `PrincipalPayment`, `CouponPaid` | Cash settlement of a scheduled payment | Substrate scheduler + Tomas's payments rail |
| `CallRightTriggered`, `CallRightLapsed`, `OptionExercised`, `OptionExpired` | Optionality lifecycle | Optionality agent |
| `PartialTermination`, `FullTermination` | Trade unwound before maturity | Termination agent |
| `DefaultEvent`, `Restructuring` | Counterparty / underlier credit event | Credit-event agent (with Mira on FIC implications) |
| `CorporateAction` | Cash / scrip dividend, split, M&A | Corporate-action agent (Strate feeds for SA listed) |
| `TradeMatured` | Terminal event; contract is closed | Substrate scheduler |
| `MarkToMarketObserved` | Daily MTM (for VM, accounting, P&L) | Pricing-agent (with Atlas's substrate publishing) |

Every event carries a citation slot (Principle 2) and the multi-X identification primitive (Principle 5). Replay over this stream reconstructs any position at any past point — the bank's exposure on 2026-09-30 close is a query, not a stored aggregate.

## 7. Booking, risk, settlement — projections over the trade event log

Saskia and Kai do not build separate booking, risk, or settlement systems. Each is a typed projection over the same trade-event log:

- **Trade record** — the CDM Contract itself, materialised as a projection for front-office query latency. Owned by Kai.
- **Position projection** — current holdings by instrument × legal entity × counterparty × portfolio. Owned by Anya (substrate) + Kai (markets logic).
- **Sub-ledger projection** — IFRS classification (HFT / FVTPL / FVOCI / Amortised cost), accounting hooks, recognised gains and losses. Owned by Bea, consumed by Camille for the financial close.
- **General-ledger projection** — postings generated from sub-ledger events. Owned by Bea.
- **Risk sensitivities projection** — delta, gamma, vega, theta, rho, basis, curve sensitivities. Computed from CDM payoff function + market-data substrate. Owned by Rohan, governance from Helena.
- **Counterparty exposure projection** — current exposure, potential future exposure, expected exposure, regulatory CCR (SA-CCR). Owned by Rohan.
- **Liquidity / HQLA projection** — high-quality-liquid-asset classification, eligible / ineligible, repo-eligibility, LCR / NSFR contribution. Owned by Ravi (engineering), governance from Eitan.
- **Regulatory market-risk projection** — FRTB IMA / SA-MR cell-level computations. Owned by Rohan, governance from Helena.
- **Trade-reporting projection** — venue / regulator submissions (FSCA market-abuse surveillance, future SARB OTC-derivatives reporting if mandated). Owned by Mira (compliance engineering) coordinated with Saskia.
- **Conduct / surveillance projection** — pre-trade and post-trade surveillance (best-execution, mandate adherence, market-abuse triggers). Owned by Mira + Saskia.

Every projection is reproducible from the event log at any past point. None is authoritative.

## 8. Regulator-citation surface (Principle 2)

Every product type, lifecycle event, and projection carries citations into the obligations register. Initial citation set (Mira to populate the URNs that don't yet exist):

| Domain | Instruments to cite |
|---|---|
| **Listed markets — South Africa** | JSE Equities Rules; JSE Debt Rules; JSE Derivatives Rules; FSCA Conduct of Business Standards; Financial Markets Act 19 of 2012 (FMA); FSCA Market Conduct Standards on best execution and order handling. |
| **OTC derivatives — South Africa** | FMA s.5 (OTC derivative provider conduct); FSCA Conduct Standard 1 of 2019 (OTC derivative provider conduct); SARB OTC-derivatives reporting (when finalised); FIC Act on counterparty CDD. |
| **OTC derivatives — international** | ISDA Master Agreement (1992 / 2002 forms); CSA documentation (English / NY law variants); EMIR equivalence considerations for cross-border counterparties. |
| **Market abuse + surveillance** | FMA Chapter VIII (market abuse); FSCA market-abuse regulations; insider-trading prohibitions; pre-trade and post-trade surveillance under FSCA Conduct Standards. |
| **Accounting** | IFRS 9 (classification + impairment); IFRS 13 (fair-value hierarchy); IAS 32 (financial instruments — presentation); IFRS 7 (financial instruments — disclosures); hedge accounting under IFRS 9 hedge model. |
| **Capital + market risk** | BCBS Market Risk (FRTB — d457); BCBS CCR / SA-CCR (d349); BCBS IRRBB (d368, on banking-book IRS); BCBS principles for sound liquidity-risk management (BA 325 / BA 326). |
| **Cyber / operational** | Joint Standard 1 of 2024 (cyber resilience — applies to the trading-systems estate); BCBS Operational Resilience principles. |
| **Financial crime** | FIC Act ss.21–28 on CDD / EDD on counterparties; sanctions screening per `sanctions-screening.md`; tipping-off prevention on suspicious trading patterns. |
| **Tax** | IAS 12 (deferred tax on MTM gains); FATCA / CRS (counterparty classification); STT (Securities Transfer Tax) on equity trades; VAT on financial services (largely exempt). |
| **Privacy** | POPIA s.13 (lawful purpose for counterparty data); s.71 (automated decision-making — pre-trade rejections, surveillance auto-flags). |

The schema enforces citation at append time (P2 gate). A trade event without a populated citation slot is rejected by the event store.

## 9. Architecture layers (the markets stack inside the bank)

```
┌──────────────────────────────────────────────────────────────────┐
│   Sales / Market-making / Execution agents (Saskia, Kai-managed)│
│   ─ RFQ handling, market-making engines, FIX execution venues   │
└────────────────────┬─────────────────────────────────────────────┘
                     │ CDM Trade events (with P2 citations + P5 multi-X)
┌────────────────────▼─────────────────────────────────────────────┐
│   @platform/markets/cdm — Schema & primitives (this document)    │
│   • CDM TypeScript bindings + Zod validators                     │
│   • Lifecycle event registry                                     │
│   • Product taxonomy (CFI / ISIN / CUSIP / FpML category)        │
│   • Citation enforcement (P2 gate)                               │
└────────────────────┬─────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│   @platform/event-store — append-only, replay-capable (Atlas)    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│   Projections (typed, reproducible from events) — Anya substrate │
│   ─ Trade record   ─ Sub-ledger (Bea)    ─ Liquidity (Ravi)     │
│   ─ Position       ─ General ledger (Bea) ─ Surveillance (Mira) │
│   ─ Risk sensit.   ─ Counterparty exp.    ─ Reg. reporting (Mira)│
│     (Rohan)          (Rohan)                                     │
└──────────────────────────────────────────────────────────────────┘
```

External connectivity (in/out of the substrate above):

- **Execution venues** — JSE (equities, bonds, derivatives) via FIX; Bloomberg / Refinitiv chat-driven RFQ for OTC IRS.
- **CCP / CSD** — JSE Clear (listed derivatives clearing); Strate (listed cash settlement); LCH SwapClear (if we clear OIS internationally — deferred).
- **Counterparty + reference data** — LEI feeds; ISIN / CUSIP feeds; corporate-actions feeds (Strate, Bloomberg).
- **Market data** — ZARONIA / JIBAR feeds (SARB); FX feeds (Reuters); equity prices (JSE); volatility surfaces (vendor).
- **Collateral** — TriOptima / Acadia for SIMM, CSA reconciliation.

All external connections are **adapters** at the boundary that translate to / from the canonical CDM event types. The substrate never leaks vendor-specific shapes into the event log.

## 10. Build sequence — M-phases

The schema and substrate are foundational. The build is sequenced so the bank can run scenarios end-to-end at every milestone (Principle 3 implementation sequence: full local build first; cloud lift at M8).

| Phase | Scope | Exit criterion |
|---|---|---|
| **M1 — CDM core + listed equities** (~4 weeks after authorisation) | CDM TypeScript bindings (`@platform/markets/cdm/`); core primitives (Asset, Schedule, Cashflow, Settlement, Identification); equity event types; Strate-style settlement simulator; corporate-action events for SA-listed equities; trade-record + position + sub-ledger projections | Synthetic equity book bookable end-to-end; recon harness green; sample IFRS classifications produced |
| **M2 — Listed bonds + repo basics** (~3 weeks) | Bond product type (vanilla fixed; SAGB inflation-linker); repo product type (open + term); HQLA projection; bond settlement; SAGB inflation index | Synthetic bond + repo book bookable; LCR / NSFR contributions computed; HQLA classifications correct |
| **M3 — OTC IRS (vanilla)** (~6 weeks) | Leg / Index / Collateral primitives; CDM Contract for fixed-vs-ZARONIA IRS; CSA primitive; ISDA Master clause-library hooks (Imani); MTM / Reset / InterestPayment lifecycle; risk sensitivities projection (delta, basis); SA-CCR computation | Vanilla IRS bookable; daily MTM published; CCR exposure projection green; ISDA-grade trade confirms generated |
| **M4 — FX swaps + repo finance integration** (~3 weeks) | FX product type; FX-swap composition; repo flagged for HQLA financing per Eitan's funding strategy; FATCA/CRS classification gate at counterparty level | FX-swap bookable; HQLA repo financing scenarios run end-to-end |
| **M5 — Optionality + structured products** (~6 weeks) | Optionality primitive (European / American / Bermudan); Cap / Floor / Swaption product types; Contingent cashflow primitive; barrier-observation lifecycle; structured-note composition layer; FRTB IMA prep (PnL attribution, NMRF flagging) | Caps / floors / swaptions bookable; sample structured note (callable IRS) bookable; FRTB IMA shadow-running |
| **M6 — Securities lending + multi-CCP** (~4 weeks, if franchise pulls it) | ISLA repo / sec-lend extension; multi-CCP support (JSE Clear + LCH SwapClear) | Sec-lend bookable; LCH-cleared OIS bookable |
| **M7 — Credit derivatives** (deferred — only if institutional client demand surfaces) | CreditDefaultPayout primitive; CDS / CDX product types; restructuring + credit-event lifecycle | Out of scope for licence application |
| **M8 — Azure cloud lift** (post-licence) | Substrate replacement per Atlas's `local-base-infrastructure-spec.md` and `agent-runtime-substrate-spec.md` | Production cutover |

**Resourcing.** Kai is the primary engineer. Atlas provides the substrate (event store, scheduler, agent runtime). Anya provides the projection runtime and the semantic layer mapping. Imani provides the clause library for ISDA / CSA / SA OTC documentation. Rohan provides risk-method correctness review at M3 onwards. Bea provides the IFRS classification rules at M1. Mira provides regulator-citation URN coverage at every milestone. Saskia governs scope and approves franchise readiness at each phase exit.

## 11. Cross-persona dependencies

Saskia and Kai cannot deliver this in isolation. The deliverable depends on:

- **Atlas** — agent-runtime substrate (`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`) needs A0–A2 phases live so Kai's trading agents can register and emit events. M3 is gated on A0–A2.
- **Anya** — semantic layer needs market-data primitives (ZARONIA, JIBAR, FX, equity prices) registered as canonical inputs; data contracts for the projections in §7 need to be agreed with Bea, Rohan, Eitan, Mira before each projection ships.
- **Bea** — IFRS classification rules per product family, signed off by Camille, before M1 sub-ledger projection ships. IFRS 9 hedge-accounting designation flow before M3 IRS book ships.
- **Rohan** — risk-method correctness on sensitivities, SA-CCR, FRTB; signed off by Helena. Required at M3 onwards.
- **Eitan** — FTP attribution methodology applied to every product event (per `ftp-attachment-on-product-event.md`, planned). Required at M2 (when bonds + repo turn on FTP-aware HQLA financing).
- **Imani** — ISDA Master + CSA clause library; SA OTC counterparty-onboarding documentation; legal-execution events under ECTA. Required at M3.
- **Mira** — obligations-register URNs for every regulator citation in §8; counterparty-onboarding-markets procedure; surveillance-alert-triage procedure. Required at M1 (counterparty CDD on first equity trade).
- **Tomas** — payment-rail integration for InterestPayment / PrincipalPayment / Settlement events; SAMOS / BankservAfrica / SWIFT connectors. Required at M2 onwards.
- **Senna + Rashida** — threat model on the trading systems estate (FIX gateway is the most exposed perimeter); Joint Standard 1 of 2024 controls catalogue extended to cover the markets stack. Required at M1 design freeze.
- **Vera** — continuous-controls assurance over the markets event stream — sample-tests on lifecycle correctness, citation coverage, projection reconciliation. Pipelines added under the agent-discipline assurance extension.

## 12. Substrate gaps (today)

What this spec needs that doesn't yet exist:

- **CDM TypeScript bindings** — CDM publishes Java / Kotlin / Python / Scala first-class. TypeScript bindings exist as community projects; we will likely need to maintain / extend them. ~2 weeks engineering.
- **Market-data substrate** — no SARB / Bloomberg / Reuters feed integration in the prototype. Synthetic-data discipline (per Atlas's local-base-infrastructure spec) means M1–M5 can run on synthetic feeds; live feeds light up at licence approach.
- **CCP / CSD simulators** — synthetic JSE Clear and Strate simulators needed for end-to-end scenarios; vendor-grade simulators not commercially available; Kai builds.
- **Pricing libraries** — vanilla IRS, FX, equity pricing is straightforward; structured-product pricing (Bermudan, barriers) requires tested implementations. Build vs. license-vendor-library decision deferred to M5.
- **FRTB IMA infrastructure** — FRTB-IMA is engineering-heavy (PnL attribution, NMRF, expected shortfall). Not required pre-licence; M5 prep work only. Helena and Rohan will scope.
- **Trade-confirmation generators** — ISDA-grade confirmations for OTC trades. CDM has confirmation templates; Imani's clause library wires them up. M3 deliverable.

These gaps are roadmap items, not blockers. Each phase exit-criterion in §10 names the substrate piece that must be in place for that phase to land.

## 13. Decision required from Marc

**The decision:** approve **ISDA CDM** as the canonical schema foundation for the global-markets trading system, with the M1–M5 build sequence in §10. M6 / M7 deferred to franchise-pull; M8 deferred to post-licence.

**Recommendation:** approve. Rationale:

- CDM is the only public standard whose decomposition matches the strategic-foundation product mix and the franchise's likely expansion path.
- Vendor-neutral, open-source, regulator-friendly — fits the build-not-buy posture and Principle 3 (cloud-native, code-defined).
- Composable primitives directly answer the requirement Marc set: simple or complex products from basic building blocks.
- Aligns with Principle 1 (events-as-truth — CDM is event-native), Principle 5 (multi-X — CDM types currency / entity / jurisdiction), Principle 6 (single-graph — every product is a node in the same graph).
- M-phase sequence keeps the franchise launchable at M3 (vanilla IRS) and expandable thereafter without re-platforming.

**Alternative considered (and not recommended):** a custom in-house schema. Rejected because every bank that built one ended up reinventing CDM badly and migrating later. The opportunity cost of not adopting CDM is paid forward as integration debt.

## 14. Open items routed elsewhere

- **To Atlas:** confirm A0–A2 substrate timing supports an M3 OTC-IRS go-live target.
- **To Anya:** review the ten projections in §7 and propose the data-contract evolution sequence; semantic-layer entries for each market-data primitive (ZARONIA, JIBAR, FX, equity, basket, inflation index).
- **To Imani:** confirm ISDA Master + CSA clause-library coverage for SA institutional counterparties; identify any clauses that need bespoke SA market practice.
- **To Mira:** populate the obligations register with the URNs in §8; confirm the FSCA / FMA citation surface; flag any Joint Standard 1 of 2024 sub-clauses that bear specifically on trading systems.
- **To Bea:** IFRS 9 classification rules per product family; hedge-accounting designation flow; sign-off framework with Camille.
- **To Rohan:** risk-method scope at M3 (SA-CCR, sensitivities, daily VaR); FRTB IMA scoping at M5.
- **To Helena:** trading mandate (B5, deferred — pending calibration) needs to be finalised at M3 go-live; Saskia and Helena run the calibration jointly.
- **To Eitan:** FTP attachment methodology at M2; HQLA classification rules at M2.
- **To Senna + Rashida:** threat model on the FIX-gateway perimeter and the OTC trade-confirmation pathway; CDM-event signing key custody.
- **To Camille:** capital cost overlay applied to pricing per `pricing-approval.md` populated procedure; methodology sign-off at M3 IRS go-live.
- **To Owen:** add `counterparty-onboarding-markets.md`, `npa-gate.md` (new product approval), and `mandate-attestation.md` to the procedures index ahead of M1.

—Saskia (franchise + governance) · Kai (engineering)
