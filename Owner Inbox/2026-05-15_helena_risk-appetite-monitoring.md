---
title: "Risk-Appetite Monitoring — Baseline Framework"
author: Helena (Chief Risk Officer, governance)
date: 2026-05-15
decision-required: false
tags: [risk, ras, governance, monitoring]
---

# Risk-Appetite Monitoring — Baseline Framework

**Author:** Helena (Chief Risk Officer, governance)
**Date:** 2026-05-15
**Status:** Live governance document — supersedes any draft monitoring notes predating this file.

---

## 1. Purpose and Scope

This document describes how Helena monitors adherence to the bank's Risk Appetite Statement (RAS), documented at `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`. It translates the RAS's appetite lines and limits into the specific metrics tracked, the cadence at which they are observed, and the escalation chain that fires when a breach occurs or is threatened.

The framework sits in the Principle 2 policy chain at the **standard layer**: the RAS (Board-level) is the *policy* artefact; this monitoring framework is the *standard* that operationalises it; live metric values and breach records are *data*, held in the event store. No appetite line is monitored unless it is cited back to a RAS section — orphaned metrics are a finding.

Scope is **Hoz Bank Limited** (bank-entity level), consistent with the entity-scope note in the RAS (§A4). Where the Prudential Authority requires consolidated-basis assessment (group capital, group liquidity, group large-exposures), the monitoring framework captures both entity-level and consolidated-basis views, with the appetite line set at the entity level.

The autonomous monitoring substrate for this framework is the `helena-risk-appetite-watch` handler. Until `@platform/risk-appetite-monitoring` is fully built, Helena runs a governance-cycle pass against Rohan's (Risk Engineer) measurement outputs manually at each cadence tick.

---

## 2. Key Risk Metrics

The following eight metrics constitute Helena's primary monitoring set. Each is cited to the RAS risk category that governs it. Where a metric has both an entity-level and a consolidated view, both are tracked.

| # | Metric | RAS category | RAS reference | Floor / limit |
|---|---|---|---|---|
| 1 | **Capital adequacy ratio (CAR / CET1)** — common equity tier 1 as a percentage of risk-weighted assets | Credit / capital | RAS §A2 credit; RAF §B1 capital | CET1 ≥ PA minimum + stated buffer; amber at buffer − 1 pp; red at minimum |
| 2 | **Credit concentration — single-name** — largest single-obligor exposure as a percentage of CET1 | Credit | RAS §A2 credit | ≤ 25% of CET1 (large-exposures ceiling per Banks Act Regulation 29); amber at 20% |
| 3 | **Credit concentration — sector** — largest single-sector aggregate exposure as a percentage of the credit portfolio | Credit | RAS §A2 credit | Sector limit set in RAF §B2; amber at 80% of sector limit |
| 4 | **Liquidity coverage ratio (LCR)** — HQLA as a percentage of 30-day stressed net cash outflows | Liquidity / funding | RAS §A2 liquidity; RAF §B3 | LCR ≥ 100% (PA minimum); amber at 110%; red at 100% |
| 5 | **Net stable funding ratio (NSFR)** — available stable funding as a percentage of required stable funding | Liquidity / funding | RAS §A2 liquidity; RAF §B3 | NSFR ≥ 100% (PA minimum); amber at 105%; red at 100% |
| 6 | **Market risk VaR utilisation** — daily VaR as a percentage of the approved VaR limit | Market risk | RAS §A2 market risk; RAF §B4 | Utilisation ≤ 80% normal; amber at 80–100%; red at > 100% (limit breach) |
| 7 | **Counterparty credit exposure (mark-to-market)** — largest single counterparty net positive MtM as a percentage of CET1 | Credit (counterparty) | RAS §A2 credit; RAS §A2 market risk | Per-counterparty limit in RAF §B2; amber at 80% of limit |
| 8 | **Operational risk event count** — number of operational-loss events (net of recoveries) above the reporting threshold in the rolling quarter | Operational risk | RAS §A2 operational; RAF §B6 | Amber when rolling-quarter count exceeds tolerance set in RAF §B6; red when a single event breaches the material-loss threshold |

Zero-tolerance metrics (regulatory breach, financial-crime facilitation, material data breach) are binary and do not carry amber thresholds — any occurrence is immediately Tier 1 red. They are reported separately in the Conduct & Financial-Crime dashboard owned by Zara (Chief Compliance Officer, governance) and Mira (Financial-Crime Risk Officer, governance), with Helena holding cross-governance oversight.

---

## 3. Monitoring Cadence

Monitoring frequency is proportionate to the volatility and time-to-breach profile of each metric.

### Daily (automated, every business day)

The `helena-risk-appetite-watch` handler executes the daily pass. It ingests measurement events from Rohan's (Risk Engineer) pipelines and emits a `RiskAppetiteRollup` event to the event store. Metrics monitored daily:

- Market risk VaR utilisation (Metric 6) — intraday VaR updated by Saskia's (Market Risk Engineer) end-of-day run; Helena receives the daily roll.
- Counterparty credit exposure (Metric 7) — MtM netted from the position store; updated daily post-close.
- Operational risk event tally (Metric 8) — new events surfaced by Devon's (Chief Operating Officer, governance) operational risk intake; Helena's handler reads the running tally.

Quiet > 24h on the `helena-risk-appetite-watch` output stream is a substrate alert (inactivity SLA per Section 6 of Helena's agent spec).

### Weekly (Helena governance review)

- LCR and NSFR (Metrics 4–5) — Ravi (Liquidity and IRRBB Engineer) produces the weekly liquidity report; Helena reviews and confirms no breach.
- Credit concentration — single-name (Metric 2) — Rohan's weekly credit dashboard; Helena reviews top-10 obligors.

### Monthly (formal limit-pack review)

- Credit concentration — sector (Metric 3) — Rohan's monthly sector-concentration report; Helena reviews against RAF §B2 sector limits.
- Capital adequacy ratio (Metric 1) — Camille (Chief Financial Officer, governance) produces the monthly regulatory capital computation; Helena reviews and confirms adequacy above the amber threshold.

### Quarterly (BRC reporting cycle)

All eight metrics roll into the quarterly Board Risk Committee (BRC) pack. Helena owns the risk section of the BRC pre-read, produced three weeks ahead of the BRC session. Until the Board is constituted, the BRC function is exercised by the CEO (interim dual-hat); the process and documentation standard are the same.

ICAAP and ILAAP run on an annual cycle; the monitoring framework feeds directly into Sections 3 (capital adequacy) and 4 (liquidity risk) of each.

---

## 4. Breach Escalation

Breaches are tiered by severity. The three-tier model maps onto the appetite lines and thresholds in Section 2 above.

### Tier 3 — Amber Watch

**Definition:** A metric crosses its amber threshold but has not reached its red limit.

**SLA:** Helena acknowledges and logs within 24 hours; the `helena-risk-appetite-watch` handler emits an `AppetiteWatch` event; Rohan is notified for root-cause commentary.

**Notification:** Helena (internally); Scrooge (Chief of Staff, governance coordination) for routing visibility; no mandatory escalation to CEO unless the watch persists beyond two consecutive monitoring cycles.

**Disposition options:** tolerate (with documented rationale); remediate (first-line action triggered); or monitor and escalate if the watch persists.

### Tier 2 — Red Breach

**Definition:** A metric crosses its red limit; or an amber watch has persisted for two consecutive monitoring cycles without improvement.

**SLA:** Helena acknowledges and logs within 4 hours; the `helena-risk-appetite-watch` handler emits an `AppetiteBreach` event; Rohan, Eitan (Treasurer, finance), and Camille are notified immediately.

**Notification:** Helena + Rohan + Eitan + Camille (for capital/liquidity breaches) or Zara (for conduct/financial-crime breaches) + Scrooge for routing.

**Disposition:** Helena emits `AppetiteBreachDisposed` event within the 4-hour window documenting: breach tier, root cause, disposition (tolerate with documented exception / remediate / escalate), and owner of remediation action if applicable. CEO is notified; Board notification depends on whether the breach is also Tier 1 (see below).

### Tier 1 — Crisis / Prudential Breach

**Definition:** A breach with prudential implications — i.e., a metric used in regulatory reporting or supervisory filings (CET1, LCR, NSFR, large-exposures ceiling) has breached the PA-set minimum; or a zero-tolerance event (regulatory breach, financial-crime facilitation, material data breach) has occurred.

**SLA:** Helena acknowledges within 1 hour; `AgentEscalation` event emitted immediately (sealed channel for PA-relevant matters).

**Notification:** Helena + CEO + Owen (Company Secretary, governance) + Camille + Thandiwe (Chief Audit Executive, governance; third-line awareness). For PA-threshold breaches: PA notification via Owen within the Banks Act-required window. For financial-crime-linked events: Mira + Zara + the MLRO function.

**Disposition:** The CEO decides; Helena advises. The `AgentEscalation` event carries the breach details, the prudential implication, and Helena's recommended disposition. Board notification (interim: CEO dual-hat) is mandatory for Tier 1.

---

## 5. Substrate Gaps

The monitoring framework described above has a number of capabilities that are planned but not yet fully operational. These are surfaced as roadmap items, not as deficiencies that prevent governance — Helena runs compensating manual oversight against Rohan's outputs until each substrate capability lands.

| Gap | Planned capability | Owner | Status |
|---|---|---|---|
| Automated appetite-monitoring projection | `@platform/risk-appetite-monitoring` — consumes Rohan's measurement events, compares against RAS limits, emits `AppetiteWatch` / `AppetiteBreach` / `RiskAppetiteRollup` events continuously | Rohan (Risk Engineer) + Atlas (Platform Engineer) | Planned; `helena-risk-appetite-watch` handler spec drafted |
| ICAAP / ILAAP assembly engine | `@platform/icaap-ilaap-engine` — assembles the ICAAP and ILAAP from event-derived inputs (capital, liquidity, stress outputs) with Helena as sign-off authority | Rohan + Ravi (Liquidity and IRRBB Engineer) | Planned; annual cycle design not yet started |
| Stress-testing substrate | `@platform/stress-testing` — runs approved scenarios against the event store; feeds Metrics 1, 4–7 under stress conditions | Rohan + Saskia (Market Risk Engineer) | Planned; scenario-approval workflow not yet wired |
| Board Risk Committee pack generator | `@platform/board-papers-generator` — queries the policy and measurement layers and renders BRC-ready packs; eliminates manual assembly | Atlas + Owen (Company Secretary, governance) | Planned; BRC workflow not yet designed |
| Model-risk pipeline (independent validation) | Automated model-validation pipeline that emits `ModelRiskDecisionRequired` events; triggers Helena's model-risk governance decisions | Rohan (independent validation function) | Planned |

Until these substrates land, Helena's governance-cycle pass produces this document and associated manual reviews as the compensating control. Each substrate gap is a roadmap item for Rohan, Saskia, Ravi, and Atlas; they are not blockages to the governance framework being operative.

---

## 6. Next Scheduled Review

This document is reviewed at Helena's next quarterly governance-cycle run. At that run Helena will:

1. Confirm that all eight metrics in Section 2 remain cited to current RAS lines (no drift since any RAS amendment).
2. Update the substrate-gaps table (Section 5) with the status of each planned capability.
3. Produce a brief for Scrooge if any metric threshold needs revision (triggering a `RiskPolicyChangeProposal` event and BRC routing).
4. Confirm the monitoring cadence (Section 3) remains proportionate given the bank's growth since the prior review.

The first quarterly review is scheduled at Helena's next cadence tick following the next BRC pack cycle. If a Tier 1 breach occurs before the quarterly review, this document is updated immediately as part of the breach-disposition record.

---

*Helena (Chief Risk Officer, governance) — Hoz Bank Limited — 2026-05-15*
