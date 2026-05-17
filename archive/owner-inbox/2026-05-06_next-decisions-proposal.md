# Proposal — next decisions for the CEO

**Author:** Scrooge (Chief of Staff)
**Date:** 2026-05-06 (end-of-day; revised after D1 / D2 / D3 resolved same-day)
**For:** Marc (CEO)
**Status:** Proposal. Each decision can be redirected.

> **Update note (end-of-day):** D1 (interim operating posture), D2 (reporting-capability build authorisation), and D3 (CISO hire kickoff) — all three pacing-critical decisions — were resolved end-of-day. Captured in the respective decision records under `Owner Inbox/2026-05-06_ceo-decision_*`. Section 2 below (pacing-critical) is therefore retained for the audit trail; new second-order items appear in §9 (added end-of-day after the question "any other decisions needed").

> **Derivation note (Principle 6 — downward).** Every item below derives from a known artefact: the strategic foundation, the markets-franchise brief, Atlas's reporting-capability spec, the CAE first-90-days plan, Helena's follow-up RAS recalibration, the deferred decisions (B2 / B5 / E1), and the still-open shortlist beyond CAE. No new substance authored at the presentation layer.

---

## 1. The shape of the queue

The bank now has: a fixed strategic foundation, six architectural principles, a complete governance scaffolding with the CAE seat now filled, a working prototype foundation, 41 policies, 9 procedures, 178 mapped obligations, and a clear deferred-decisions list. The next-decision queue is dense but tractable — it groups into **three pacing-critical decisions** that should land in the next ~7 days, and ~15 follow-on items that flow naturally from them.

The single guiding observation: every item in the *pacing-critical* group is a decision *only you can take*; the follow-on items are decisions where the substantive work happens elsewhere first and you confirm or redirect.

## 2. Pacing-critical (this week)

These three are blocking other work.

### D1 — Interim operating posture during licence deferral *(RESOLVED end-of-day: build-only)*

**The decision.** Pick one of:
- **(a) Build-only, no live trading** until SARB licence is granted. *Lowest legal risk. Longest time-to-revenue. The bank is all infrastructure, no franchise, until the licence lands.*
- **(b) FSP-licensed dealer in interim** under FAIS Cat I/II + JSE membership. *Live revenue earlier on JSE-listed instruments and (where structure permits) OTC IRD as an FSP-authorised intermediary. Some product structures constrained pre-banking-licence (e.g. principal-balance-sheet IRD looks awkward without a banking licence). Real complexity in legal structure (FAIS-licensed entity vs banking-licensed-entity later).*
- **(c) Sponsored-access dealer** routing through an existing JSE member / bank for execution and settlement until self-licensed. *Fastest time-to-execution; commercial terms with the sponsor are real money; gives the franchise a soft-launch posture before owning the rails.*

**Why now.** This is the **pacing constraint** on Saskia's markets-franchise design (due ~2 weeks), Imani's documentation programme (ISDA / GMRA / membership), Mira's FAIS-conduct programme, and Camille's capital regime. Saskia's design will be substantially shaped by which of (a) (b) (c) you pick; deciding *after* the design adds churn.

**My recommendation.** Decide between **(a) and (b)** in your head this week, even if the formal commit waits for Saskia's proposal. (c) is rarely a destination — it's a tactic. (a) is honest and clean but the bank earns nothing until SARB licences it (timeline indicative: 18–24 months). (b) carries operational complexity but converts the build period into a franchise-warmup period.

**What I need from you.** A direction (it doesn't have to be final) so the franchise design assumes one mode and not three.

### D2 — Reporting-capability build authorisation *(RESOLVED end-of-day: authorised; M2–M3 staged commit)*

**The decision.** Approve, defer, or stage the build of the reporting capability per the M-phase plan (`Owner Inbox/2026-05-06_reporting-capability-spec.md`). The spec covers AFS, BA returns, FIC submissions, SARS, FSCA, Joint Standard returns, IR submissions, internal MI, analytics — all under Anya / Bea / Mira / Camille / Eitan / Helena / Owen leadership.

**Why now.** Atlas / Anya / Bea are sitting on the spec; the foundation infra is now mature enough to support M2–M3 (semantic layer + first BA return + AFS skeleton). Without authorisation, the prototype stalls at M1.5.

**My recommendation.** Authorise **M2–M3 only** as a discrete commit (the next ~6–8 weeks of build work). M4+ can be re-authorised once M3 lands and the strategic foundation has informed the reporting prioritisation (BA 700-series market-risk returns, BA 325 large exposures rise; retail-focused returns drop). Stage the commit; don't sign the whole 8-phase plan in one go.

**What I need from you.** Yes / no / yes-with-staging.

### D3 — CISO hire kickoff *(RESOLVED end-of-day: PAX brief authored; Nolan to recruit)*

**The decision.** Direct PAX to author the CISO role brief. (The CAE was the first of the four open governance hires; CISO is next per Helena's recommended order.)

**Why now.** With the strategic foundation set and the CAE seat filled, CISO is the natural next hire — *and* it has special urgency given the bank's posture: cloud-native, event-sourced, with sensitive trading flows and JSE / SAMOS connectivity ahead. Senna currently holds the security-engineer seat under Devon on interim. Real CISO accountability under Joint Standard 1 of 2024 wants a named seat.

**My recommendation.** Approve the kickoff. Indicative cadence: PAX brief ~1 week; Nolan shortlist ~3 weeks; first interviews ~5 weeks; offer ~7 weeks; in seat ~3-month notice.

**What I need from you.** A nod, and I'll set PAX to it.

## 3. Near-term (2–4 weeks)

These will land on your desk in the noted timeframes; no action from you today, but worth knowing they're coming.

| # | Decision | Source | Expected with you |
|---|---|---|---|
| D4 | **Markets franchise design approval** (B5 trading mandate inside it) | Saskia (`Team Inbox/2026-05-06_brief_markets-franchise-design.md`) | ~2 weeks |
| D5 | **RAS recalibration** to wholesale-markets profile | Helena (follow-up to strategic foundation) | ~2–3 weeks |
| D6 | **Internal Audit Charter** approval (through Interim Audit Forum) | Thandiwe §1 of first-90-days | ~2 weeks |
| D7 | **First 12-month risk-based audit plan** approval (through IAF) | Thandiwe §2 | ~3–4 weeks |
| D8 | **E1 — POPIA IO designation lodgment** (Iris / CEO retains / Owen / future hire) | Iris options paper | ~1 week |
| D9 | **B2 — capital / liquidity buffer calibration** scoped to R300m + trading-bank profile | Helena + Camille + Eitan, ICAAP/ILAAP | ~3–4 weeks for first cut |

## 4. Medium-term (1–3 months)

Surface as decisions as the underlying work lands.

| # | Decision | Trigger | Who drafts |
|---|---|---|---|
| D10 | **JSE membership form** — direct authorised user vs sponsored access | Within Saskia's proposal | Saskia + Imani |
| D11 | **Counterparty-set ambition** — top-tier institutional only vs broader | Within Saskia's proposal | Saskia + Helena (counterparty-credit) |
| D12 | **Capital tranching** — single injection vs phased | Within Camille's capital plan | Camille |
| D13 | **Product priority within strategic foundation** — all three at once vs sequenced (e.g. SAGB + IRS first, equities later) | Within Saskia's proposal | Saskia |
| D14 | **Combined-assurance map** approval (third-line opinion-coverage map) | Thandiwe §4 first-90-days | Thandiwe |
| D15 | **External-auditor selection process** kickoff (not appointment — process scoping) | Thandiwe + Camille (joint scoping) | Thandiwe + Camille |
| D16 | **GC hire kickoff** (third governance hire after CAE → CISO) | After CISO is in flight | PAX brief on your nod |

## 5. Long-horizon (this quarter, before live trading)

These are pacing-relevant for the bank's life arc but not blocking near-term work.

| # | Decision | Comment |
|---|---|---|
| D17 | **Board formation / NED search** | Interim governance is interim. Board-reserved decisions still route through CEO + CRO + CFO concurrence. As commercial activity approaches, this gets more pressing. |
| D18 | **SARB banking licence application sequencing** | Currently deferred. The "when do we apply" is an eventual decision; ICAAP / ILAAP, capital plan, and a year-or-two of operating evidence will make the application stronger. |
| D19 | **CHRO hire kickoff** (fourth governance hire) | Sade on interim under Devon; CHRO seat pulls Sade up under it. |
| D20 | **Cloud-lift M8 sequencing** | Once M3–M5 lands, Atlas presents the M8 plan (substrate replacement, not rewrite). |
| D21 | **Customer-onboarding readiness gate** | A composite gate covering: institutional client onboarding flow, KYC tier-1 process running, ISDA / GMRA negotiation programme, dealer-mandate compliance, surveillance pipeline, settlement integration. Target: before live trading in any mode. |
| D22 | **Saskia's deputy / institutional-markets-sales engineering counterpart** | The franchise + Kai is the single critical-path engineering team. Expansion is a question for when the franchise design crystallises. |

## 6. Dependencies and sequencing

A few hard dependencies worth surfacing:

- **D1 (interim operating posture) gates D4, D5, D9, D10, D11, D13.** Saskia's franchise design and the RAS recalibration are written *for* a chosen posture. Decide D1 directionally now; the formal commit can fall out of D4.
- **D2 (reporting-capability build) gates Atlas's pace.** Without authorisation, the prototype stalls at M1.5 and the foundation infra stops earning leverage.
- **D6 → D7 sequence.** The audit charter precedes the audit plan; both go through the IAF (Owen chair). Thandiwe is running them in series, not parallel.
- **D14 (combined-assurance map) needs second-line collaboration** from Helena, Zara, Iris, Senna. Quality of the map depends on the substantive conversations Thandiwe has with each of them in the first 60 days.
- **D17 (Board formation)** is a topic, not a decision today — but a NED search has long lead times. It's worth signalling intent now even if the formal commit is later.

## 7. Decisions that are *not* on this list (and why)

- **No SARB licence application decision.** Deferred per CEO direction. Will surface when the bank's operating evidence makes the application credible (~year 2).
- **No Board AC formation as a near-term item.** Interim Audit Forum (Owen chair) is the operational substitute until a Board exists; Thandiwe's third-line independence is preserved by the IAF route.
- **No external-auditor *appointment*.** Process scoping (D15) is the right next step; appointment follows once the audit plan and AFS shape are clearer.
- **No retail or commercial-banking decisions.** Out of scope per the strategic foundation; would re-enter only via an explicit strategic-foundation amendment.

## 8. What I'd ask you to do this week

In order:

1. ~~**Direction on D1**~~ — **resolved end-of-day: build-only.**
2. ~~**D2**~~ — **resolved end-of-day: authorised, M2–M3 staged.**
3. ~~**D3**~~ — **resolved end-of-day: PAX brief authored.**

All three pacing-critical decisions are closed. The rest will land on your desk as deliverables across the next 1–3 months. See §9 below for the second-order items that surface once D1 is *build-only*.

## 9. Second-order items (added end-of-day, after D1 = build-only)

The build-only decision turns up five new items that did not appear when D1 was open. None is urgent today; each warrants thought before the markets-franchise design (D4) lands in ~2 weeks.

### S1 — Burn-rate / capital-runway plan against R300m

R300m must last the build phase + the SARB licence-application road. Indicative duration: 18–30 months. Camille should produce a first-cut burn-rate plan against the design organisation (current 19 employees + planned hires of CISO, GC, CHRO, plus any Saskia-deputy / IMS-engineer expansions). The plan should answer: at what monthly burn does R300m run dry; what is the operating runway; what triggers a capital top-up conversation with the shareholder.

**Trigger:** Camille drafts; expected within ~3 weeks. **Decision Marc takes:** approve the burn target and the capital-runway-trigger thresholds.

### S2 — Soft-franchise priority counterparties

Build-only's biggest live-revenue risk is going live without warm pipeline. The build period is for cultivating those relationships, not waiting for them. Saskia should designate priority counterparties (top SA corporates, banks, non-bank FIs) for soundings during the build, and Niko + Imani should set up a structured negotiations-in-principle programme.

**Trigger:** Saskia includes this in the franchise-design proposal (D4). **Decision Marc takes:** confirm the priority list and the engagement cadence.

### S3 — Board / NED search timing

The bank operates under interim governance until a Board is constituted. NED hunts have long lead times (6–12 months for a credible Board). With ~12 months until any plausible licence-application lodgment and ~24+ months until live trading, the latest reasonable start of the NED search is sooner than instinct suggests.

**Trigger:** Owen drafts a Board-formation roadmap. **Decision Marc takes:** when to start the NED hunt; whether to appoint an Interim Board Chair ahead of full constitution.

### S4 — Talent retention through the build

19 employees through 18–30 months of paper-only work is a real retention question. Compensation alone is unlikely to be enough; equity / long-term-incentive / mission-alignment matter. Sade (HR) on interim under Devon — but the *framework* is a CEO-level call.

**Trigger:** Sade drafts an LTI / equity scheme for the build period. **Decision Marc takes:** approve the scheme shape and the dilution / cost envelope.

### S5 — External legal counsel for SARB licence application

Imani is internal and will run the legal-as-code work. SARB licence applications conventionally engage a major-firm external counsel as partner — for application drafting, regulator engagement, and licence-condition negotiation. Engagement timing: typically 6–9 months ahead of lodgment.

**Trigger:** Imani recommends 2–3 firms with strengths-and-weaknesses notes. **Decision Marc takes:** engage / when / which firm.

—Scrooge
