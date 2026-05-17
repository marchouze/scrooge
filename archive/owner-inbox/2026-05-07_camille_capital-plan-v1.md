---
title: Capital plan v1 — build-phase against the approved R300m envelope
author: Camille
date: 2026-05-07
summary: First-cut capital plan operationalising the just-approved D-MARKETS-CAPITAL-TIME-SHAPE working split (R45m build CapEx · R75m/yr OpEx run-rate · R150m design-book capital · balance to liquidity buffer). Build-phase paper plan; binding inputs to Helena's RAS calibration, Eitan's funding strategy, and the paper ICAAP run.
decision-required: false
---

# Capital plan v1 — build-phase against the approved R300m envelope

**From:** Camille (CFO) — autonomous run per `Team/Camille.md` § 9 (capital-plan refresh in-scope decisions).
**To:** Marc (CEO) for awareness; Helena (CRO), Eitan (Treasurer) as primary consumers; Bea, Rohan, Saskia, Anya as engineering-bench feeds.
**Date:** 2026-05-07
**Authority:** CEO approval of `D-MARKETS-CAPITAL-TIME-SHAPE` at `2026-05-07T18:19:29.676Z` (CeoDecision event in store; outcome: working split per Saskia §6.1 approved as the desk's working view, with Camille / Eitan to reshape and Helena to challenge through the paper ICAAP / ILAAP run).
**Citations:**
- `BANKS-ACT-94-1990` (Banks Act, capital adequacy mandate)
- `BCBS-BASEL-III` (Pillar 2A add-ons; capital conservation buffer)
- `ORG-PR-01` through `ORG-PR-05` (capital-adequacy obligations, leverage)
- `ORG-PR-13` (annual ICAAP submission)
- `IFRS 9` (ECL feed; CET1 deduction logic)
- `ORG-AC-01`, `ORG-AC-02` (IFRS classification + ECL)

> v1 is the build-phase paper plan. Real capital is not yet held; the R300m is a target for licence-day, not a present balance (per `project_ai_driven_bank` operating-model memory, 2026-05-07). Numbers are sized as a planning artefact for the paper ICAAP run.

---

## 0. Plan-on-a-page

| Bucket | Working allocation | Capital quality | Owner | Activates on |
|---|---|---|---|---|
| Build CapEx (technology, infrastructure, JSE-membership readiness, market-data, vendor) | **~R45m** over the build phase | Below-the-line cash; CET1 once recognised as expensed | Atlas (substrate) + Devon (operations) + Saskia (markets) | Build phase, drawn against monthly opex schedule |
| OpEx run-rate (people across the franchise + supporting engineering) | **~R75m / year** at full build-phase headcount | Below-the-line cash; CET1 once recognised as expensed | Sade (HR substrate, paused; reactivates at licence-day) + Camille (cost steward) | Headcount approval cadence; build-phase ramp |
| Capital backing the design book on go-live | **~R150m** | **CET1 (shareholder equity)** at outset; AT1 / T2 not envisaged in v1 | Camille (issuance) + Helena (RAS calibration) + Saskia (RWA generation) | Trading-book RWA under FRTB-SA + Standardised market-risk; SA-CCR for IRD CCR (forward-load M3) |
| Liquidity buffer / operating capital | **Balance** (~R30m residual on R300m total; Eitan's discretion within ILAAP envelope) | CET1 + HQLA mix | Eitan (Treasurer) | LCR / NSFR floors; intraday liquidity buffer per BCBS 248 |

**Total committed envelope: R300m** (per CEO-set strategic foundation).

---

## 1. Plan structure and traceability

The plan is structured as a series of **typed buckets** (above) plus the citations + consumers + cadences that bind each. Per Principle 6, the plan is a **presentation derived downward** from data — the underlying data is the CEO-approved decision (`D-MARKETS-CAPITAL-TIME-SHAPE`), Saskia's franchise design (`Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md`), and the obligations register entries above. No new substantive numbers are authored at this layer; what's new is the *structure* — the bucket types, the capital-quality dispatch, the consumer routing.

### What this plan **is**

- A working capital plan for build-phase, sized against the R300m target, against which Helena calibrates the RAS, Eitan calibrates the ILAAP / funding strategy, and Rohan / Anya generate the trading-book RWA forecast feeding the paper ICAAP.
- The basis for Camille's monthly variance reporting (per `Team/Camille.md` § 6 monthly-close cadence, once that handler lands).
- The single citable home for "what we plan to do with the R300m" — referenced from Helena's RAS, Eitan's funding strategy, and the eventual paper ICAAP submission.

### What this plan is **not**

- Not a *real* capital plan for a *real* operating bank. R300m is a target for licence-day, not a present balance. There is no live RWA today (no real trades), no live ECL (no real lending exposure), no live LCR / NSFR (no real funding stack).
- Not the paper ICAAP. The ICAAP is the next-cycle output; this plan is its capital input. The paper ICAAP also produces ICAAP-internal-buffer numbers and the stressed-capital path; those don't exist yet.
- Not a dividend / capital-action policy. Dividend capacity is Camille § 9 in-scope but predicated on real distributable reserves; build-phase has none.

---

## 2. Capital-quality breakdown

| Tier | Build-phase v1 | Rationale |
|---|---|---|
| CET1 (Common Equity Tier 1) | R300m intended at licence-day (full envelope is shareholder common equity at outset) | The simplest issuance shape for licence-day. AT1 / T2 add complexity that the build phase does not need. |
| AT1 (Additional Tier 1) | Nil at outset | Considered later if Pillar 2A capital efficiency demands it. Not material to v1. |
| T2 (Tier 2) | Nil at outset | Same reasoning as AT1. |

**Pillar 2A** is set by the PA at supervisory cycle; not known until post-licence. v1 plans against the PA Pillar 1 minima + capital conservation buffer + a notional Pillar 2A placeholder of ~1.5pp (calibrated up at licence-day from the SREP-class output of the paper ICAAP).

**Management buffer (RAS B2 — currently deferred per `ORG-PR-04`)** is the calibration Helena owns. v1 reserves the working +1.5pp buffer above (PA minima + Pillar 2A + capital conservation buffer); Helena's RAS recalibration confirms or refines.

---

## 3. Capital triggers + RAS feed

The capital plan binds the **Risk Appetite Statement** through a triggers schedule. Helena's RAS recalibration (`WS-RAS-RECALIBRATION` — in flight) consumes this list and sets the action thresholds.

| Trigger | Threshold | Action | Owner |
|---|---|---|---|
| CET1 ratio approaches Pillar 1 + 2A + conservation | 50bps above floor | Alert: ALCO + BRC; escalate to CEO | Camille + Eitan + Helena |
| CET1 management buffer breach (RAS B2) | Buffer < +1.5pp above floor | Capital action consideration: defer dividends; constrain RWA growth | Camille + Helena |
| Leverage ratio approaches floor | 25bps above PA minimum | Alert: ALCO; review balance-sheet policy | Camille + Eitan |
| Stress-test under integrated scenario | Capital path crosses Pillar 1 + 2A | Reverse-stress diagnose; capital top-up consideration | Helena + Camille |
| ICAAP capital top-up trigger | ICAAP-defined | `AgentEscalation` to CEO + shareholder + Helena (Camille § 10) | Camille |

> Triggers are *plan-side* signals; the *operational* capital-ratio monitoring procedure is `Procedures/by-policy/capital-ratio-monitoring.md` (already live, co-owned with Eitan + Helena per Camille § 13).

---

## 4. Consumers + dependencies

This plan feeds and is fed by other agents' substrates. The graph:

| Agent | Direction | What flows |
|---|---|---|
| **Helena (CRO)** | ⇒ feeds | RAS B2 management buffer calibration; B5 trading-mandate envelopes; risk-taxonomy alignment. v1 carries a placeholder; Helena's recalibration is the binding output. |
| **Eitan (Treasurer)** | ⇒ feeds | Liquidity-buffer sizing within the residual ~R30m; LCR / NSFR target floors; capital-action operational execution. |
| **Saskia (Head of Global Markets)** | ⇐ consumes | The R150m design-book capital is sized against Saskia's §2.2 envelopes; trading-book RWA generated against this allocation under FRTB-SA + Standardised market-risk + SA-CCR (forward-load M3). |
| **Bea (accounting engineer)** | ⇐ consumes | IFRS 9 ECL feed deducts from CET1; classification rules (M1 brief, in flight) shape the deduction path. |
| **Rohan (risk engineer)** | ⇐ consumes | Trading-book RWA under FRTB-SA; counterparty-credit RWA under SA-CCR (forward-load); ECL stage-distribution for IFRS 9. |
| **Anya (data engineer)** | ⇐ consumes | Capital / RWA / BA-return projections (data substrate). |
| **Atlas (substrate engineer)** | ⇐ consumes | ICAAP capital engine substrate (Camille § 16, planned) — this plan is the input v1 to that engine when it lands. |
| **Owen (CoSec)** | ⇐ consumes | Reserved-matters approval pathway (CEO interim; Board at licence-day); capital-action governance (`capital-action-governance.md` procedure, planned). |

---

## 5. Cadence

- **Refresh cadence:** monthly, anchored on Camille's monthly-close cadence (per `Team/Camille.md` § 6). Each refresh = a v(n+1) of this document; supersedes the previous version; emits an `AgentDecision` event capturing the change set.
- **Trigger-based refresh:** capital-event class events (`CapitalEvent`, `RestatementProposed`, `MaterialIFRSClassificationChange`) within the SLAs declared in Camille's § 7 trigger table.
- **Annual refresh:** annual ICAAP cycle drives a structural rebuild; v1 → v2 transition will land alongside the first paper ICAAP output (Helena + Camille + Bea + Atlas's ICAAP capital engine).

---

## 6. Variance vs Saskia's §6.1 working split

| Bucket | Saskia §6.1 | Camille v1 | Variance | Note |
|---|---|---|---|---|
| Build CapEx | ~R45m | ~R45m | — | Carried forward as-is; no reshape in v1. |
| OpEx run-rate | ~R75m / yr | ~R75m / yr | — | Carried forward as-is; reshape pending Sade-substrate-reactivated headcount detail. |
| Design-book capital | ~R150m | ~R150m | — | Carried forward as-is; binding on Saskia §2.2 RWA envelopes; reshape pending Helena RAS recalibration. |
| Liquidity buffer | Balance (~R30m residual) | Balance (~R30m residual) | — | Carried forward as-is; reshape pending Eitan ILAAP run. |

**v1 does not reshape the numbers.** The Camille substrate adds *structure* — capital-quality dispatch, triggers schedule, consumer-graph traceability, cadence. v2 (next monthly close) is the first opportunity for numerical reshape, and is scoped as the first integrated Camille / Eitan / Helena pass against the paper ICAAP run.

---

## 7. Substrate gaps surfaced by this plan

Authoring this v1 surfaces the Camille § 16 substrate gaps that would land first to make v2 better than v1:

1. **ICAAP capital engine** (Helena + Camille + Bea + Atlas) — turns the static plan into a live, replayable, scenario-tested capital path. Highest priority of Camille's gaps.
2. **Capital-plan tooling** (Camille + Eitan + Atlas) — turns this hand-authored markdown into a generated artefact per Principle 6 (presentations derive from data). v2 should be generated, not authored.
3. **Auditor-correspondence register** (Camille + Owen) — needed once the auditor is engaged (statutory-trigger or licence-day per the build-phase opex register).
4. **`capital-action-governance.md` procedure** (planned, owner Camille § 13) — currently absent; needed before the first capital action.
5. **`monthly-close-sign-off.md` procedure** (planned, owner Camille § 13) — currently absent; needed for v2 cadence to be procedure-bound.

---

## 8. Decision provenance (audit trail)

- **Source decision:** `D-MARKETS-CAPITAL-TIME-SHAPE` (CeoDecision event, `2026-05-07T18:19:29.676Z`, action `approve`).
- **Source proposal:** `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` §6.1.
- **Consumer routing:** Helena (RAS recalibration); Eitan (funding strategy + ILAAP); Saskia (trading-book RWA generation); Bea (IFRS 9 ECL feed); Owen (reserved-matters governance).
- **Plan event:** `AgentDecision` with `decisionId: decision:camille:capital-plan-v1`, `decidedBy: Camille`, `chosen: "Capital plan v1 published per CEO-approved working split"`.

## 9. Provenance

Read `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` §6.1 for the source split; replayed the `D-MARKETS-CAPITAL-TIME-SHAPE` CeoDecision event to confirm action approve; cross-referenced `Regulations/_obligations-register.md` Domain A entries for the prudential-obligation set; cross-referenced `Team/Camille.md` § 6, § 9, § 13, § 16 for cadence, decision-scope, procedures, and substrate-gap inventory; cross-referenced `Finance/_opex-register.md` for the build-phase cost lines that feed the build-CapEx and OpEx buckets. Build-phase posture per `project_ai_driven_bank` memory.
