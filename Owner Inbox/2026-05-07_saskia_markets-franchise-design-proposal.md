# Markets franchise design — proposal

**From:** Saskia (Head of Global Markets) — *first-run output of the Saskia standing-agent*
**To:** Marc (CEO) — via Scrooge
**Cc:** Helena (CRO), Camille (CFO), Eitan (Treasurer), Zara (CCO), Owen (CoSec), Devon (COO), Rashida (CISO).
**Engineering counterparts:** Kai (trading systems), Imani (legal-as-code), Tomas (operations & payments), Ravi (treasury / ALM), Anya (data), Rohan (risk), Mira (surveillance).
**Date:** 2026-05-07
**Authority:** CEO strategic foundation (`Owner Inbox/2026-05-06_strategic-foundation.md`); CEO interim-operating-posture D1 build-only (`Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md`).
**Anchors:** `Team Inbox/actioned/2026-05-06_brief_markets-franchise-design.md`; `Team Inbox/actioned/2026-05-06_followup_saskia_build-only-posture.md`.

> Operating-model note. This is the first scheduled run of the Saskia agent. It produces (a) the franchise design and (b) the questions the agent has flagged for CEO judgement. Subsequent runs operate against the spec at `Team/Saskia.md` (companion update on this turn) and report on a fixed cadence — not on prompt.

---

## 0. Executive summary

The franchise is **JSE-listed bond trading, JSE-listed equity trading, and OTC interest-rate derivatives**, institutional-only, single SA branch, on ~R300m of committed shareholder capital, in a build-only posture until banking licence is granted.

I propose:

- A **focused product set** — SAGB cash + ZAR repo + select corporate fixed income; JSE Top-40 liquid equities + a defined ETF list; OTC IRD limited to ZARONIA-linked vanilla swaps, FRAs, OIS, basis swaps and a deliberately narrow option set (caps/floors only at outset).
- A **market-making + agency hybrid posture** on cash products, agency-only on equities at outset, market-making on the IRD line into a tightly-bounded counterparty set.
- A **directly-applied JSE membership** path (application-ready, lodged on licence-grant), with no sponsored-access fallback per D1.
- A **soft-franchise track** that turns the build phase into pipeline rather than into silence: ISDA negotiations-in-principle, MOUs, calibrated soundings, and an institutional-counterparty engagement programme run jointly with Niko and Imani.
- A **paper ICAAP / ILAAP** (with Helena, Camille, Eitan) producing regulator-credible numbers on a R300m envelope; my running view is that this envelope supports the design book at the proposed scale, with headroom for a controlled go-live ramp.
- A **rehearse-to-ready** discipline across surveillance, conduct, dealer mandate, settlement, and risk reporting — every pipeline runs end-to-end on synthetic flows.

The big open question for the CEO is **time-shape of the build**: what fraction of the R300m is committed to franchise-build (people, technology, infrastructure, soft-franchise) versus held as deferred-deployment capital backing licence-day risk-taking. I propose a working split below; it is the principal §8 question.

---

## 1. Product specification

### 1.1 JSE bonds

**Universe.**
- **South African Government Bonds (SAGB)** — full curve, vanilla nominal + inflation-linked (ILBs).
- **Corporate / SOE / parastatal bonds** — listed only; an inclusion list curated quarterly by the desk against liquidity, credit-quality, and counterparty-relevance criteria, ratified by Helena's market-credit-counterparty committee. Initial inclusion list of ~30 issuers (the typical actively-quoted set on the JSE Debt Market).
- **Repo** — yes, central. ZAR repo on SAGB only at outset; corporate repo deferred until the build is bedded.

**Agency / market-making mix.** Market-making in SAGB cash and ZAR repo (this is where the franchise earns its keep). Agency in corporate / SOE secondary at outset; market-making in select corporates is a phase-2 question.

**OTC-with-listed-references.** Out of scope at this stage. The strategic foundation is JSE-listed; off-venue corporate placements are a different franchise that we are not opening.

### 1.2 JSE equities

**Universe.** JSE Top-40 + the next layer of liquid mid-caps (a defined extension list of ~20 names) + a curated ETF list dominated by AMETF / Satrix / NewFunds flagship products. No small-caps at outset; no AltX.

**Posture.** **Agency at outset.** The conduct surface for institutional equity market-making — internalisation, best-execution, principal-trading disclosures — is materially heavier than for the cash bond book on a per-rand basis. Phase-2 review of moving to market-making once the conduct substrate has been live-tested under agency volume.

**ETF participation.** Yes, agency at outset; authorised-participant role is a phase-2 question pending JSE-membership and issuer dialogue.

### 1.3 OTC interest-rate derivatives

**Universe at outset.**
- ZARONIA-linked vanilla **swaps** (fixed-vs-ZARONIA-OIS).
- **FRAs** (post-JIBAR, FRA market is in transition; we will quote the ZARONIA-FRA equivalent and price legacy JIBAR-FRA only on counterparty request with an explicit transition note).
- **OIS** — quote and trade.
- **Basis swaps** — ZARONIA-vs-3-month JIBAR-fallback for transition exposure; cross-currency basis is **out** at outset.
- **Caps / floors** — yes, narrow strikes, vanilla only.
- **Swaptions** — **out** at outset; phase-2 once vol-surface infrastructure is live.

**ZARONIA-aligned curve framework.** The bank's master curve is a SARB-published-ZARONIA-OIS curve, bootstrapped from OIS quotes and ZARONIA fixings. Forward-rate construction is purely OIS-based. Legacy JIBAR exposure is run as a separately-tagged sub-book with an explicit run-off plan.

**Foreign-currency leg appetite.** **None at outset.** Cross-currency books require an FX-swap and FX-forward franchise that the strategic foundation explicitly does not include. Pre-licence build assumes ZAR-only IRD; CCY-IRD is a future-franchise extension question, not a build-now item.

---

## 2. Posture

### 2.1 Market-making vs agency vs prop

| Product | Posture at outset | Phase-2 (post-licence, first 12 months) |
|---|---|---|
| SAGB cash | Market-making | Steady-state market-making |
| ZAR repo (SAGB) | Market-making | Steady-state market-making |
| Corporate / SOE bonds | Agency | Selective market-making in top-tier names |
| JSE Top-40 equities | Agency | Review market-making; conduct substrate must be live-proven |
| ETFs | Agency | Authorised-participant evaluation |
| ZARONIA IRD (swaps, FRAs, OIS, basis, caps/floors) | Market-making, narrow counterparty set | Widen counterparty set; consider swaptions |
| Cross-currency, swaptions | Out | Out at phase-2 review; later franchise question |

**Prop trading is out, full stop.** Risk-taking is in service of franchise (residual market-making inventory and the book's natural directionality from client flow), not as a standalone strategy. This is also a conduct-frame statement.

### 2.2 Risk-taking appetite envelope (input to Helena's RAS)

Headline numbers I would propose for Helena to calibrate against. These are the **desk's view** of what the franchise needs; the **bank's appetite** is Helena's to set.

- **Trading-book Value-at-Risk (1-day, 99%, historical, 250-day window).** Working envelope ~R8–12m at full design-book size. Phase-1 (build) operates against a synthetic-trade VaR; phase-2 (live) ramps from ~25% of the envelope on day-one to full envelope over six months under explicit ramp-gates.
- **IR01 (rates) at the IRD desk.** Working envelope ~R2.0–2.5m per bp at full design-book size. Bond-cash IR01 is held on the cash desk separately under Eitan's HQLA framework where applicable.
- **Single-name concentration.** SAGB excluded (sovereign exposure governed via Helena's credit framework); corporate / SOE single-name exposure capped per-issuer at a percentage of the corporate sub-book's gross.
- **Counterparty CCR (IRD).** SA-CCR computed per counterparty; concentration capped at top-tier institutional set (initial mandate target: ~12–15 counterparties at outset).
- **Stressed loss appetite.** A defined set of stress scenarios (1995 EM crisis, 2008 GFC, 2013 taper tantrum, 2020 COVID, Nene-fire 2015, ZAR liquidity squeeze 2022) — the desk's running view is that the franchise should size to a worst-case loss within capital headroom set by Camille / Helena.

I am explicitly not setting these numbers in this paper; I am surfacing the *framework* and the *order-of-magnitude* so Helena can calibrate the RAS against a real franchise rather than against a placeholder.

### 2.3 Counterparty-set ambition

**Top-tier institutional only at outset.** Targets:

- **Banks:** the four locally-significant SA banks (Standard Bank, FirstRand, Absa, Nedbank), plus Investec, plus the global-bank SA branches active in ZAR (Citi, JPM, HSBC, Bank of America, Deutsche, BNP Paribas, RBC, Standard Chartered).
- **Non-bank financials:** the Tier-1 SA asset managers (PIC, Coronation, Allan Gray, Ninety One, STANLIB, etc.), the major life insurers, and a tightly-bounded set of hedge-fund managers.
- **Corporates:** the top SA corporate treasurers (those with active rate-hedging programmes — typically Top-40 issuers).

Broader counterparty ambition is a phase-3 question after live operation is bedded.

---

## 3. Documentation programme (with Imani)

**Build-phase deliverable: drafted, internally approved, parked. No live signed agreements.**

| Document | Counterparty set | State at end of build phase |
|---|---|---|
| ISDA Master + ZA Schedule | Banks; insurers; large asset managers; hedge funds | Master + South-Africa-specific Schedule template approved; counterparty-by-counterparty negotiations-in-principle pursued |
| CSA (English-law, ISDA 2016 VM CSA, ZAR-collateral first) | Same as ISDA set | Template approved; CSA-economics negotiations-in-principle |
| GMRA (ICMA) | Banks; asset managers | Template approved; counterparty negotiations-in-principle |
| GMSLA (securities lending) | Phase-2 only | Out of scope at build phase |
| Client-onboarding institutional pack (with Niko) | All counterparties | Drafted; soft-franchise pipeline processes onboarding in-principle |
| JSE-membership documentation | JSE only | Application-ready; lodged on licence-grant (per D1) |
| ECTA-aligned electronic-signing protocol (Imani) | All | Built; rehearsed |

**Soft-franchise documentation.** Negotiations-in-principle output is a structured artefact (counterparty + clauses-agreed-in-principle + open-points + my-side signatory + their-side counterparty representative + version chain). Imani builds this as a typed object so it lifts cleanly into a live agreement at licence-grant.

---

## 4. Market access (D1: build-only, single mode)

**JSE membership.** Direct authorised-user route. Application is **application-ready**, not lodged. The application file, supporting submissions, fitness-and-propriety packs (Sade), capital evidence (Camille), conduct framework (Zara), and IT readiness (Devon, Kai) are kept current quarterly so lodgment on licence-grant is administrative, not engineering.

**Sponsored access.** **Out** under D1. Removed from the design.

**Trading-venue connectivity.**
- **FIX** — JSE FIX gateway integration built; tested against JSE conformance test environment; certified-ready, not certified-live (certification is licence-day).
- **Colocation** — design provisioned (rack space, cross-connects, latency budget); contract option-agreed with the JSE Cape Town colo, lodged on licence-grant.
- **Market-data subscriptions** — JSE Real-Time Data, JSE Bond Market data, ETF data; subscriptions structured as **build-licence** during build phase, **live-licence** on go-live.

**ZARONIA + reference-rate sourcing.**
- ZARONIA fixings ingested directly from SARB feeds (Anya).
- OIS reference quotes from Refinitiv / Bloomberg + a panel of bank quotes; consensus build per Anya's rate-source standard with a designated authoritative source per curve point.
- Legacy JIBAR fallback ingestion maintained for transition-book run-off.

**Bond-market connectivity.**
- JSE Debt Market (interest-rate market) FIX connectivity built.
- Repo workflow over BESA Settlement Authority / Strate, with Tomas's settlement substrate.

---

## 5. Technology & operations dependencies

These are the engineering items the franchise stands on. They are agent-owned (Kai, Tomas, Anya, Mira, Senna, Rohan, Bea); I describe what I require, with the procedure each capability discharges.

### 5.1 OMS / EMS (Kai)

- Multi-asset booking model (cash bonds, repo, equities, IRD), event-sourced under P1.
- Pre-trade limit checks against Helena's risk engine (Rohan), against credit lines (per-counterparty CCR), against dealer mandate (Helena + Saskia), against conduct rules (Mira).
- ISO 20022 confirmation generation for OTC IRD; Strate / SBL settlement-instruction generation for cash; ETF creation/redemption hooks (phase-2).
- Replayable: every order, amendment, cancel, fill is an event; the book at any point in time is a query.

### 5.2 STP to settlement (Tomas)

- SAMOS for high-value ZAR settlement (high-value cash leg and CCP-style margin movements).
- BankservAfrica RTC for low-value retail-rail (limited use; mostly fees and small-value flows).
- Strate for equities and bond settlement.
- Collateral management workflow (CSA call/return events, GMRA margin events).
- Reconciliation harness — every settlement event reconciled against the trade event and the cash event; breaks are events themselves.

### 5.3 Surveillance feeds and market-abuse posture (Mira / Senna)

- Trade-level surveillance: front-running, layering, spoofing, marking-the-close, ramping, wash-trades.
- Order-book surveillance: layering / spoofing detection over JSE order events.
- E-comms surveillance: voice (calibrated against the dealing room's recording substrate), e-mail, chat (Bloomberg, Symphony if used), structured against FMA 19 of 2012 prohibitions.
- Market-abuse register: every alert is an event; every closure is an event with reason codes.
- Senna's threat-model gate has approved the order-tap design; Rashida's standard re-baselines.

### 5.4 Real-time risk feed to Rohan

- Position events streamed to Rohan's risk engine; VaR, sensitivities, and stress-scenario re-computation per Anya's projection cadence (intraday for sensitivities, EOD for full VaR with intraday "watch-VaR" approximations).
- Dealer-mandate-breach alerts as events; my desk receives them, Helena receives them, the breach-runbook lights up.

### 5.5 Position-keeping and EOD P&L flow to Bea

- Position projection drives sub-ledger postings under Bea's accounting policy.
- IFRS 9 classification is per-instrument and is part of the booking event (FVTPL for the trading book; HTC for treasury; covered by Bea's accounting-policy register).
- IFRS 13 fair-value hierarchy classification per instrument — Level 1 (JSE-quoted equities, SAGB), Level 2 (corporate bonds with observable inputs, IRD with observable curve inputs), Level 3 (any illiquid corporate where inputs need significant adjustment) — emitted as part of valuation events.
- P&L decomposition: market-making P&L, residual-risk P&L, FX P&L (zero in build phase), funding P&L, fees & commissions — all derived projections under P1 / P6.

---

## 6. Capital, funding, collateral

### 6.1 R300m envelope — proposed working split (the §8 question for the CEO)

| Bucket | Proposed allocation | Rationale |
|---|---|---|
| Build CapEx (technology, infrastructure, JSE-membership readiness, market-data, vendor) | ~R45m over the build phase | Hardware-light, software-heavy; mostly people + cloud + market-data + audit + legal |
| OpEx (people across the franchise + supporting engineering) | ~R75m / year run-rate at full build-phase headcount | Headcount detail in Sade's substrate; figure here is order-of-magnitude |
| Capital backing the design book on go-live | ~R150m | Sized to support the trading-book RWA implied by §2.2 envelopes under SA-CCR + Standardised Approach market-risk + a credit-RWA budget for repo |
| Liquidity buffer / operating capital | Balance | At Eitan's discretion; covers ILAAP run-up |

These numbers are my desk's working view, not a committed allocation. Camille and Eitan will reshape; Helena will challenge; the §8 question is the resulting split.

### 6.2 Standardised Approach market-risk RWA

For build-phase paper ICAAP, I propose Standardised Approach market-risk RWA over the design book (no IMA at outset). Rohan models the RWA against the §2.2 envelopes; Helena ratifies; Camille feeds it into the capital plan.

### 6.3 SA-CCR for IRD CCR

Counterparty-credit risk on the IRD book runs through SA-CCR. Top-tier institutional counterparty set keeps add-ons concentrated; netting agreements (ISDA + CSA at full enforceability) drop EAD materially. CSAs are standardised on ZAR cash collateral, daily VM, threshold = 0, MTA = R5m at outset.

### 6.4 Repo book sizing for funding

Repo is core to funding the cash-bond inventory and to managing intraday HQLA turnover for Eitan. Sizing is a joint exercise with Eitan; the desk's working view is a repo book of R3–5bn gross (reverse + repo) at full build-phase operation, sized against the inventory the market-making mandate produces.

### 6.5 Collateral inventory & CSA terms

- **CSA standardisation:** ZAR cash, daily VM, no threshold, MTA = R5m, dispute resolution per ISDA 2016 standard.
- **Collateral inventory:** Eitan's substrate; my role is a consumer of the inventory and a contributor to it through the cash-bond book.
- **GMRA terms:** ICMA 2011 with SA-specific schedule; haircut grid per Helena's credit framework.

---

## 7. Conduct & surveillance

### 7.1 Market-abuse regime under FMA 19 of 2012

Surveillance scope statement (with Mira), keyed to FMA prohibitions:

- **Insider trading (s.78):** dealing-room "wall" controls; PA-dealing pre-clearance gate (every personal-account trade by dealing-room staff requires pre-clearance event with insider-list check); periodic surveillance of staff trading vs. firm trading.
- **Prohibited trading practices (s.80):** front-running, layering, spoofing, marking-the-close, ramping, churning — surveillance rules per practice; alerts as events.
- **False, misleading or deceptive statements (s.81):** e-comms surveillance; sales-narrative review; research-substantiation discipline (when research starts).
- **Disclosure of false / misleading information (s.82):** market-abuse register entries on alerts.

### 7.2 Personal-account-dealing policy reach

Dealing-room staff (and any person on the insider-list at any time) is in scope for PA-dealing pre-clearance, holding-period rules, and quarterly disclosure. Substrate is Sade's HR + a workflow event-set; Helena's standard, my enforcement, Sade's substrate.

### 7.3 Dealer-mandate framework

Per-dealer mandate covering: products, currencies, tenor, sensitivities, single-name caps, intraday loss tolerance, escalation thresholds. Mandate is a typed object; breaches are events; escalation runs to me and to Helena. Dealer-mandate review cadence is monthly during build (rehearsal), quarterly live.

### 7.4 Trading-conduct posture

- Best-execution policy for client-facing flow (where applicable to institutional clients under FMA / FAIS overlap).
- Pre-trade transparency commitments per JSE rulebook.
- Internalisation policy (governs whether and how client orders interact with desk inventory).
- Allocation policy (per-fund, per-counterparty, per-account).
- All policies map back to Owen's policy register; my role is enforcement, not drafting.

---

## 8. Open questions for the CEO

1. **Time-shape of the build envelope.** Confirm or adjust the proposed split in §6.1 — particularly the build-CapEx + OpEx line versus the deferred-deployment capital line.
2. **Phase-2 expansion appetite.** Confirm that **cross-currency, swaptions, securities lending, AltX, and broader market-making** are deliberately deferred to a phase-2 review (post-licence, after first-year live operation), not to a "soon" track.
3. **Soft-franchise visibility.** During the build phase, do you want institutional counterparties to know the bank exists and is preparing? My recommendation is yes (calibrated, MOU-led, no commercial commitments). The alternative is silent build, which materially increases franchise-launch risk.
4. **Equity market-making timing.** Confirm agency-only at outset on equities. Phase-2 review of market-making is the working assumption; flagging because some shareholder views may differ.
5. **Authorised-participant role for ETFs.** Decide whether the ETF-AP path is in or out at phase-2 (it changes the technology and inventory shape).
6. **Foreign-currency-leg IRD.** Confirm CCY-IRD is **out** at outset and a future-franchise question, not a phase-2 question.
7. **Risk-appetite calibration cycle.** The §2.2 numbers are the desk's view. Confirm the cycle for Helena's calibration and your sign-off — my proposal is: Helena's first calibration with this franchise design as an input within four weeks; CEO approval of the resulting RAS within eight weeks.
8. **Pre-licence go-live readiness gate.** Confirm the gate is co-owned by me (franchise readiness) and the CISO (security pre-conditions), with Devon (operational resilience), Camille (capital), and Helena (risk) as required co-signatories. Owen records.

---

## 9. Pre-licence go-live readiness gate (build → live)

The conditions that must hold for the bank to flip from build to live trading. Each is an event-evidenced state.

| Domain | Condition | Owner | Evidence |
|---|---|---|---|
| Regulatory | Banking licence granted; JSE membership granted; FAIS Cat I/II/IIA where required | Marc / Owen / Zara | Regulator decision events |
| Capital | Final ICAAP / ILAAP ratified by SARB PA at licence-grant levels | Helena / Camille / Eitan | ICAAP / ILAAP event, PA letter |
| Risk | RAS calibrated to live envelopes; dealer mandates issued | Helena | RAS event; mandate events |
| Technology | OMS / EMS certified-live; FIX certified-live; market-data licences live; surveillance pipeline switched from synthetic to live | Kai / Anya / Mira | Certification events |
| Settlement | SAMOS / Strate / BankservAfrica live connections; collateral workflow live | Tomas / Eitan | Connection events; first-flow rehearsal |
| Conduct | PA-dealing live; surveillance alerts triaged; insider list live | Zara / Saskia / Mira | Surveillance events |
| Documentation | Tier-1 counterparties: signed ISDA + CSA (institutional minimum threshold) | Imani / Saskia / Niko | Signed-agreement events |
| Security | CISO standard cleared for live operation; HSM live; key ceremony complete; IR runbooks live-tested | Rashida / Senna | Security-readiness events |
| Operational resilience | DR rehearsed against live targets; cyber-resilience rehearsals current | Devon / Rashida | Resilience events |
| Audit | CAE / Vera evidence cycle covers full design-book at synthetic level | Thandiwe / Vera | CCM evidence events |
| Governance | Board (or Interim Audit Forum until Board sits), AC, BRC composition aligned to live operation; CEO sign-off of go-live | Marc / Owen | Governance events |

Each domain is a binary gate — not a scoring exercise. Live operation begins on the gate that lights green last.

---

## 10. Soft-franchise track (build-phase pipeline programme)

The risk D1 mitigates against silent build. The programme:

- **Counterparty engagement:** ~24 priority counterparties across banks, insurers, asset managers, corporates. Quarterly engagement cadence: who-we-are, what-we-will-do, when-we-go-live, what-we-want-to-do-with-you.
- **ISDA / CSA negotiations-in-principle:** Imani's negotiations-in-principle workspace produces structured artefacts per counterparty. Goal: at licence-grant, the institutional minimum threshold of counterparties is signed within four weeks of go-live.
- **MOUs:** non-binding letters of intent capturing in-principle counterparty interest; covers at minimum the Tier-1 SA banks and the largest two insurers and three asset managers.
- **Soundings:** calibrated, no-pricing, no-firm-quote interactions to keep market awareness; logged as events with a strict no-front-run / no-IOI gate.
- **Industry presence:** ACI SA membership; selected industry-body presence; conference visibility on the schedule SAQUC/STERSA/PSG calendar (*marker — the relevant SA fixed-income / derivatives industry-body calendar, to be confirmed by Niko*).
- **Talent pipeline:** the build phase is also the hire phase; Sade and Nolan run the dealing-room and sales talent map against the franchise design.

The programme is a Niko-co-owned standing capability with Imani providing the documentation substrate.

---

## 11. Mapping to Principle 6

**Upward — capabilities trace to procedures, policies, regulations.**

Every capability named in §§ 5, 7, and 9 traces to a procedure (existing or to-be-drafted), which traces to a policy (in Owen's register), which cites the regulation in Mira's obligations register. A representative slice:

| Capability | Procedure | Policy | Regulation |
|---|---|---|---|
| Pre-trade dealer-mandate check | `mandate-breach-handling.md` | Trading conduct policy | FMA 19 of 2012 + bank's risk-appetite framework |
| Order-book surveillance | `market-abuse-monitoring.md` | Market-abuse policy | FMA s.80, FSCA market-abuse provisions |
| PA-dealing pre-clearance | `pa-dealing.md` | Personal-account-dealing policy | FAIS, FMA s.78, FSCA TCF |
| ISO 20022 IRD confirmation | `otc-confirmation.md` | OTC trading policy | FMI Act 2022, ISDA, ISO 20022 |
| SAMOS settlement | `samos-settlement.md` | Payments & settlement policy | NPS Act, SARB Directives |
| ICAAP paper run | `icaap.md` | Capital management policy | SARB PA Directives, BCBS framework |

**Downward — presentations derive from data.** Every number in this proposal is derivable from a coded source: position events for §6, screening register entries for §7, RWA computations for §6.2/§6.3, surveillance events for §7. The franchise design is a presentation; the substance lives in the events and policies it cites.

---

## 12. What the Saskia agent does next, on its own

This proposal is the agent's first scheduled run. Without further prompt, on its standing cadence:

- **Weekly:** ingest new obligations-register entries (Mira), updated curve data (Anya), dealer-mandate-breach events (Rohan), surveillance-register changes (Mira); refresh the §2.2 envelopes with current sensitivities; emit a desk-state event.
- **Monthly:** run the soft-franchise pipeline review with Niko + Imani; refresh the counterparty list and the negotiations-in-principle status; emit a pipeline-state event.
- **Quarterly:** refresh the corporate-issuer inclusion list against Helena's credit framework; refresh the §2 posture against any phase-2 questions answered; refresh §10 against industry-body and conference calendars.
- **On trigger:** licence-grant event lights up the pre-licence readiness gate (§9); a Helena-initiated RAS calibration event lights up the §2.2 ratification cycle; a CEO-decision event on §8 questions feeds back into the proposal as a versioned update.
- **Escalation:** any §8-class question that arises mid-cycle is surfaced to Marc through Scrooge before the next scheduled report.

Companion update: `Team/Saskia.md` is amended in the same turn to specify these triggers, decisions, escalations, outputs, and the system capabilities the agent calls.

—Saskia (standing-agent first run, 2026-05-07)
