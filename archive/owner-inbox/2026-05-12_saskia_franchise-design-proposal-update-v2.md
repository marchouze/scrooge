---
title: "Markets Franchise Design — Capital & ICAAP Update (v2)"
author: Saskia (Head of Markets, trading)
date: 2026-05-12
decision-required: false
supersedes: "Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md §6 and §8"
authority: D-MARKETS-CAPITAL-TIME-SHAPE
citations:
  - "[citation: D-MARKETS-CAPITAL-TIME-SHAPE]"
  - "[citation: D-MARKETS-CAPEX-OVERRUN-REVIEW]"
  - "[citation: Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md]"
  - "[citation: Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md]"
---

# Markets Franchise Design — Capital & ICAAP Update (v2)

**From:** Saskia (Head of Markets, trading)
**To:** Marc (CEO) via Owner Inbox
**Date:** 2026-05-12
**Authority:** D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12); D-MARKETS-CAPEX-OVERRUN-REVIEW (CEO-approved 2026-05-12)
**Supersedes:** §6 (CapEx / cost envelope) and §8 (capital time-shape) of `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md`. All other sections of v1 remain in force.

---

## 1. Purpose of this update

This document is a delta update to the Markets Franchise Design Proposal (v1, 2026-05-07). Three events have occurred since v1 was filed that make §6 and §8 of that document stale: (1) the CEO locked the capital time-shape under D-MARKETS-CAPITAL-TIME-SHAPE, fixing the R150m trading-book backing, ~R125m ILAAP buffer, and R5m build CapEx envelope as approved figures; (2) the R45m working-estimate CapEx figure from v1 was formally withdrawn under D-MARKETS-CAPEX-OVERRUN-REVIEW, with the R5m envelope confirmed as governing; and (3) Helena (Chief Risk Officer, governance) completed the first ICAAP/ILAAP paper run (v1, 2026-05-12), which validates the capital adequacy of the approved time-shape against the franchise design and returns confirmed Pillar 1 and ILAAP figures. v1 §6 and §8 are superseded by this document with immediate effect. All other sections of v1 — product specification, posture, JSE membership track, counterparty engagement, rehearse-to-ready discipline — remain in force and are not amended here.

---

## 2. §6 update: CapEx envelope (replaces v1 §6.1)

### 2.1 Confirmed envelope

The build CapEx envelope is **R5m over the build phase**, confirmed under D-MARKETS-CAPITAL-TIME-SHAPE and governed by Camille (CFO, finance)'s capital plan (`Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md`). The R5m is consistent with the AI-driven posture: no dealing-room buildout, no proprietary trading hardware, no physical office infrastructure beyond what is required for the statutory-minimum human layer at licence-day.

**The R45m working estimate in v1 §6.1 is formally withdrawn per D-MARKETS-CAPEX-OVERRUN-REVIEW. It is not a plan figure and must not be cited in any future franchise-design or regulatory document.** The origin of that figure was a pre-AI-posture estimate that included dealing-room infrastructure and conventional headcount; neither applies to Hoz Bank Limited's operating model.

### 2.2 Itemised breakdown

| Line item | Indicative range | Status |
|---|---|---|
| Cloud compute + storage (Anthropic API + Azure build-phase) | R1–2m | Confirmed in scope |
| Market-data subscriptions (JSE Real-Time, Bond Market, ZARONIA fixing, Bloomberg/Refinitiv curve construction) | R1–2m | Confirmed in scope |
| JSE membership application costs | ~R0.5m | Confirmed in scope |
| External legal counsel + audit fees (licence application) | R1–1.5m | Confirmed in scope |
| ISDA/GMRA template negotiation | R0.3–0.5m | Confirmed in scope |
| **Total** | **~R4–6m** | **Within R5m envelope** |

The mid-point of the range is ~R4.7m, within the R5m ceiling. The envelope contains approximately R0.3–1m of contingency for cost escalation (e.g., Azure migration beginning earlier than planned, additional JSE market-data feed licences). If any single line item escalates beyond the contingency, I will raise a new CapEx review decision card before committing.

### 2.3 Uncertain line items and resolution path

Two line items carry residual uncertainty:

1. **Market-data subscriptions (R1–2m range):** The upper bound assumes a Bloomberg terminal licence is required for curve-construction and pricing desk calibration. The lower bound assumes JSE Real-Time and ZARONIA fixing alone are sufficient for the initial product set (SAGB cash, ZAR repo, vanilla ZARONIA-IRS). Resolution: Kai (trading systems engineer) and Anya (data engineer) to confirm the minimum-viable market-data stack at the build-substrate design gate. If Bloomberg is required, it consumes the upper end of this line and compresses contingency. Kai to flag by the next franchise-design review.

2. **External legal counsel and audit fees (R1–1.5m range):** The range reflects uncertainty about how much external counsel time the licence application will require beyond the standard FSCA-licensed-bank dossier. Imani (legal-as-code engineer, legal infrastructure) owns the legal documentation gate and will refine this estimate as the ISDA/GMRA negotiation-in-principle programme advances and the scope of external counsel engagement becomes clearer.

No line item is identified as at risk of exceeding the R5m ceiling under the current plan.

---

## 3. §8 update: Capital time-shape (replaces v1 §8)

### 3.1 Confirmed figures

The following figures are locked under D-MARKETS-CAPITAL-TIME-SHAPE and must be used as the authoritative reference in all franchise-design, ICAAP, and regulatory documentation going forward:

| Bucket | Approved amount | Timing |
|---|---|---|
| Trading-book capital backing | R150,000,000 | Licence-day |
| Liquidity buffer / ILAAP | ~R125,000,000 | Licence-day |
| Operational buffer (residual) | ~R25,000,000 | Licence-day |
| **Total capital envelope (target at licence-day)** | **~R300,000,000** | Licence-day |
| Build CapEx | R5,000,000 total over build phase | Build phase |
| OpEx — people (run-rate) | R20,000,000 / year | Build phase → ongoing |

**Important:** The R300m total capital envelope is a **target for licence-day**. No real capital exists in the build phase. The R300m will be raised at or immediately before licence-day from a capital raise; the build phase is funded from a pre-licence bridging facility (working assumption: R50m, to be confirmed by Marc at the licence-application financing round). The distinction between these funding pools is load-bearing for regulatory reporting — the licence-day envelope and the build-phase facility must not be conflated.

### 3.2 ICAAP validation

Helena (Chief Risk Officer, governance) completed the first ICAAP/ILAAP paper run on 2026-05-12 (`Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md`), using the approved capital time-shape as its input basis. The key outputs that directly bear on the franchise design are:

**Pillar 1 — minimum capital charge:**

| Component | Charge |
|---|---|
| FX general market risk (8% × R40m net open position) | R3,200,000 |
| IRS general market risk (Duration Method, net 5–10yr book) | R2,700,000 |
| Credit risk (nil — no credit book at licence-day) | R0 |
| Operational risk — BIA (nil gross income) | R0 |
| **Total Pillar 1 minimum capital charge** | **R5,900,000** |
| Implied market risk RWA | R73,750,000 |

**Pillar 2A — internal capital add-ons:**

| Risk type | Pillar 2A add-on |
|---|---|
| Market risk (basis / correlation / SA-to-IMA uplift) | R3,400,000 |
| Liquidity risk (distressed HQLA mark-to-market tail) | R3,125,000 |
| Operational risk (scenario-based — AI/API dependency) | R10,200,000 |
| Concentration risk (FX correspondent + IRS counterparty) | R3,500,000 |
| Legal / compliance risk | R2,000,000 |
| Reputational risk | R1,000,000 |
| Cyber / AI risk | R4,600,000 |
| **Total Pillar 2A add-ons** | **R27,825,000** |

**Total Internal Capital Requirement:**

| Item | Amount |
|---|---|
| Pillar 1 minimum capital charge | R5,900,000 |
| Total Pillar 2A add-ons | R27,825,000 |
| RAS B2 management buffer (+1.5pp × RWA R73.75m) | R1,106,250 |
| Capital Conservation Buffer (2.5% × RWA R73.75m) | R1,843,750 |
| **Total Internal Capital Requirement** | **R36,675,000** |

**Capital headroom and adequacy conclusion:**

| Metric | Amount |
|---|---|
| Total Internal Capital Requirement | R36,675,000 |
| Total capital envelope (D-MARKETS-CAPITAL-TIME-SHAPE) | R300,000,000 |
| **Capital headroom** | **R263,325,000** |
| **Headroom as % of total envelope** | **87.8%** |

**Capital adequacy is confirmed. No escalation to CEO required.** Helena (Chief Risk Officer, governance) has confirmed this conclusion in her ICAAP paper (§3.3 and §7.3). The Total Internal Capital Requirement of R36.7m is 12.2% of the R300m envelope. The bank is substantially overcapitalised relative to the franchise-design sizing — this is appropriate for a new entrant and reflects the deliberate conservatism of the R300m envelope in providing room for initial trading-book ramp-up.

**ILAAP confirmation:**

The R125m ILAAP liquidity buffer is confirmed by Helena as sufficient. Under the combined 30-day market + idiosyncratic stress scenario calibrated in §4.1 of the ICAAP paper:

- LCR: **357%** (PA minimum: 100%; RAS B3 target: 120%)
- Net liquidity surplus at Day 30: **R87.25m**
- NSFR (structural check): **2,182%** (PA minimum: 100%)

No adjustment to the R125m ILAAP figure is required.

### 3.3 Franchise-design implications

The ICAAP/ILAAP validation produces three material implications for the franchise design:

**Implication 1 — The R150m trading-book envelope provides substantial room to scale.** The Pillar 1 market risk charge of R5.9m represents only 3.9% of the R150m envelope. Even in Helena's upside sensitivity scenario (FX net open position R200m, IRS net notional R200m across the 5–10 year bucket), the total market risk charge would reach approximately R34m — still well within the R150m ceiling. The franchise can grow its initial book materially before capital becomes a binding constraint.

**Implication 2 — The headroom profile supports phased product expansion.** The 87.8% capital headroom (R263.3m of R300m) supports controlled expansion of the product set within the approved strategic foundation — SAGB cash, ZAR repo, JSE equities, ZARONIA-linked IRD — without requiring a capital raise revision. Phase-2 product extension decisions (corporate bond market-making, swaptions, equity market-making transition, authorised-participant role) can be evaluated on their own merits without an imminent capital ceiling concern.

**Implication 3 — New asset class or jurisdiction triggers NPA and capital review.** Any material expansion beyond the approved product set (JSE bonds/equities + OTC IRD, ZAR-only, SA single-branch, institutional-only) triggers New Product Approval (`ORG-PR-25`) and, depending on the scale of the expansion, potentially a new capital time-shape decision. Helena's ICAAP is scoped to the current franchise design; a new asset class (e.g., FX forwards, structured credit, equities market-making) or new jurisdiction would require a new ICAAP increment. This constraint is not a departure from v1 — it was already stated in §8 of the original proposal; it is confirmed here as still operative.

---

## 4. Revised risk-capacity summary

This table is the single reference point for capital and cost figures as of v2. Prior v1 figures are shown for context; they are superseded.

| Metric | v1 working estimate | v2 confirmed | Source |
|---|---|---|---|
| Trading-book capital backing | TBD (§8 open question) | R150,000,000 | D-MARKETS-CAPITAL-TIME-SHAPE |
| ILAAP liquidity buffer | TBD (§8 open question) | ~R125,000,000 | D-MARKETS-CAPITAL-TIME-SHAPE; Helena ICAAP v1 (confirmed) |
| Build CapEx | ~R45m (withdrawn) | R5,000,000 | D-MARKETS-CAPEX-OVERRUN-REVIEW |
| Total capital envelope (target at licence-day) | ~R300m (working assumption) | ~R300,000,000 | D-MARKETS-CAPITAL-TIME-SHAPE |
| Pillar 1 minimum capital charge | Not calculated | R5,900,000 | Helena ICAAP/ILAAP paper v1 |
| Implied market risk RWA | Not calculated | R73,750,000 | Helena ICAAP/ILAAP paper v1 |
| Total Pillar 2A add-ons | Not calculated | R27,825,000 | Helena ICAAP/ILAAP paper v1 |
| Total Internal Capital Requirement | Not calculated | R36,675,000 | Helena ICAAP/ILAAP paper v1 |
| Capital headroom (vs R300m) | Unknown | R263,325,000 (87.8%) | Helena ICAAP/ILAAP paper v1 |
| LCR under 30-day combined stress | Not calculated | 357% | Helena ICAAP/ILAAP paper v1 |
| CET1 ratio at franchise-design scale | Not calculated | 407% (R300m / R73.75m RWA) | Helena ICAAP/ILAAP paper v1 |

---

## 5. Open items and next franchise-design actions

The following items remain open in the franchise design following this v2 update. None of these items require CEO escalation at this stage; they are execution items at the respective agent level.

### 5.1 JSE membership application

The direct JSE membership track is confirmed as the approved posture per v1 §3 and CEO Decision D1. The application is application-ready and will be lodged on licence-grant. **Open item:** Devon (COO, operations) to confirm the JSE application submission timeline relative to the pre-licence go-live readiness gate. The gate sequencing (membership application vs licence application) has not yet been resolved; JSE membership and the banking licence can in principle proceed in parallel but the JSE requires confirmation of banking licence before full membership admission. Devon to confirm whether a provisional JSE membership application is possible pre-licence, and whether this is on Devon's current run list.

### 5.2 Counterparty onboarding pipeline

The soft-franchise track (ISDA negotiations-in-principle, MOUs, institutional-counterparty engagement run jointly with Niko (Client lifecycle & onboarding manager) and Imani (legal-as-code engineer, legal infrastructure)) is confirmed from v1 §5. **Open item:** no counterparty pipeline report has been filed against this mandate since v1. Niko and Imani each have franchise-relevant work in progress (Niko: rehearsal scenarios; Imani: FX-spot legal documentation gate). The next franchise-design review should include a counterparty pipeline snapshot — how many ISDA negotiations-in-principle are active, how many MOUs have been executed, and where the first expected post-licence counterparty admits stand.

### 5.3 Pre-trade gateway envelope finalisation

v1 §7.2 flagged the pre-trade gateway architecture as a Kai (trading systems engineer) deliverable. The gateway must enforce the risk-limit and dealer-mandate constraints from Helena's Capital Management Policy and the RAS before orders reach the JSE matching engine. **Open item:** the v1 brief to Kai requested confirmation of the pre-trade gateway envelope — notional limits, DV01 limits, net-open-position limits — as a substrate specification. This has not yet been filed as a standalone deliverable. Kai to include the pre-trade gateway envelope in the next trading-systems architecture brief.

### 5.4 Market-data subscription procurement timeline

As noted in §2.3 above, Kai and Anya need to confirm the minimum-viable market-data stack before the R1–2m market-data line item can be firmed up within the R5m CapEx envelope. **Open item:** Kai + Anya to produce a market-data stack specification (feeds required for JSE bonds, equities, ZARONIA, IRS pricing) with indicative licence costs by the next build-plan checkpoint. This is the remaining uncertainty that could shift the CapEx line items and compress contingency.

### 5.5 ICAAP iteration cadence

The ICAAP paper run v1 is a build-phase sizing exercise using representative portfolio positions. It must be re-run at the licence-application gate with confirmed franchise-design position sizing and, after commencement of trading, annually. **Open item:** Helena (Chief Risk Officer, governance) to schedule the next ICAAP iteration against the pre-licence go-live readiness gate calendar. The ICAAP / ILAAP annual cycle per Capital Management Policy §2 should be documented as a Helena standing-agent cadence item. GAP-01 (real portfolio data) and GAP-05 (RWA engine) from Helena's paper are the primary substrate gaps blocking live ICAAP automation; both are roadmap items for Atlas (Core banking platform architect, engineering).

---

*Saskia (Head of Markets, trading) — 2026-05-12*
*Authority: D-MARKETS-CAPITAL-TIME-SHAPE; D-MARKETS-CAPEX-OVERRUN-REVIEW*
*Status: Delta update — supersedes v1 §6 and §8 only. All other v1 sections remain in force.*
