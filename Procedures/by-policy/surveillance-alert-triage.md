---
procedureId: PROC-MK-SUR-01
title: Market abuse surveillance alert triage and escalation
author: Zara (Chief Compliance Officer, governance) · Saskia (Head of Global Markets, governance)
date: 2026-05-16
owner: Zara (Chief Compliance Officer, governance) · Saskia (Head of Global Markets, governance)
status: POPULATED
policy-cited: Market Abuse / Surveillance Policy (planned)
system-capability: "@compliance/market-surveillance (PLANNED)"
---

# Procedure — Market abuse surveillance alert triage and escalation

**Procedure ID:** PROC-MK-SUR-01
**Owner:** Zara (Chief Compliance Officer, governance) · Saskia (Head of Global Markets, governance)
**Approval:** BRC (Market Abuse / Surveillance Policy — planned)
**Cadence:** Continuous (alert generation); daily Level 1 triage; Level 2 within 5 business days; FSCA referral within 30 days of material finding
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Market Abuse / Surveillance Policy (planned; Zara + Mira (regulatory intelligence engineer) co-author; BRC approval required before commencement of trading).
- Risk Management Framework — market integrity and conduct risk are material risk types within the RMF's non-financial risk chapter.
- FAIS Policy v0.1 (STUB, FSP-conditional) — GCC §3(1)(b) prohibits FSPs from participating in, facilitating, or concealing market abuse.

The obligation chain:

```
Regulation (FMCA Part 8 — market abuse; JSE Listings Requirements r.9; FIC Act s.28 — suspicious-activity reporting)
  → Market Abuse / Surveillance Policy (planned)
    → PROC-MK-SUR-01 (this procedure)
      → @compliance/market-surveillance (PLANNED)
        → FSCA referral / FIC STR (where applicable)
```

**Build-phase posture:** Market abuse obligations under FMCA Part 8 bind at commencement of trading. The surveillance substrate is built now so that monitoring is live from day one of trading. Build-phase testing uses anonymised synthetic scenarios; no live alerts are generated during build phase.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-MK-03` (FMCA Part 8 s.78–84 — market abuse) | Prohibits insider trading (s.78), market manipulation (s.80), and front-running (s.83); imposes a duty on market participants to not engage in or facilitate any of these. |
| `ORG-MK-04` (FMCA s.6 + ODP conduct standard) | ODP must have documented surveillance procedures and must demonstrate to FSCA that surveillance is operational before ODP licence is granted. |
| `ORG-MK-JSE-01` (JSE Listings Requirements r.9 — market integrity) | JSE member banks must have market abuse detection procedures; the JSE Market Regulation Division may request surveillance records. |
| `ORG-CD-05` (FIC Act s.28 — STR obligation) | If a market abuse alert constitutes a suspicious activity that may involve proceeds of crime or terrorist financing, the bank must file a Suspicious Transaction Report with the FIC; MLRO (Zara) leads STR filings. |
| `ORG-FAIS-12` (FAIS GCC §3(1)(b)) | FSP must act with honesty, integrity, and in the interests of fair markets; must not participate in conduct that constitutes market abuse. |

## 3. Purpose

1. Detect in real time or near-real-time trading patterns that may constitute front-running, layering, wash trading, or insider-trading-adjacent behaviour across the bank's OTC IRD and JSE desks.
2. Triage each alert through a structured two-level review process (Level 1 by Zara (CCO, governance), Level 2 by Helena (CRO, governance)) to determine disposition: no action, monitoring, investigation, or FSCA referral.
3. Refer material findings to FSCA within the required window and, where an STR obligation arises, to the FIC via the MLRO.
4. Maintain a 5-year immutable record of every alert, triage decision, and referral.
5. Link to the PA Dealing pre-clearance procedure (PROC-IS-PA-DC-01 or equivalent) to cross-check whether any alert involves personnel who have submitted or should have submitted a PA Dealing notification.

## 4. Trigger

- **Real-time (primary):** `SurveillanceAlertGenerated { alertId, alertType, desk, tradeIds, counterpartyId, signalStrength: 'Low' | 'Medium' | 'High', detectedAt }` — emitted by the surveillance engine on pattern detection.
- **Daily batch:** `SurveillanceDailyBatchRun { runDate, alertsGenerated, alertsSuppressed }` — end-of-day summary; confirms the engine ran and produced its expected output.
- **Manual referral:** `ManualSurveillanceAlertRaised { raisedBy, description, relatedTradeIds, raisedAt }` — any team member who observes suspicious behaviour may raise a manual alert; these follow the same triage path.
- **Regulatory trigger:** `FscaEnquiryReceived { enquiryId, subject, relatedPeriod }` — inbound FSCA enquiry may require retrospective surveillance review.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Pattern detection.** Surveillance engine continuously evaluates executed trades and order-book activity against four pattern libraries: (a) front-running — orders placed ahead of known client flow; (b) layering — rapid placement and cancellation of non-bona-fide orders; (c) wash trading — matched buy/sell between related parties; (d) insider-trading signals — abnormal positioning ahead of material announcements | `agent` (Mira — regulatory intelligence engineer — pattern library maintenance) | `@compliance/market-surveillance` (PLANNED) | Pattern thresholds calibrated by Mira + Ravi (market risk quant engineer); reviewed quarterly; false-positive suppression rules documented in the Market Abuse / Surveillance Policy. |
| 2 | On `SurveillanceAlertGenerated`: classify alert by type and signal strength; assign to Zara's Level 1 triage queue; notify Zara immediately for `signalStrength: 'High'`; notify Zara within 4 business hours for `Medium`; batch notification for `Low` | `agent` (alert router) | `@compliance/market-surveillance` (PLANNED) | High-signal alerts always warrant same-day Level 1 triage. |
| 3 | **Level 1 triage (Zara, CCO, governance).** Zara reviews the alert: (a) reviews trading context (product, counterparty, desk, timing, position rationale from Saskia); (b) checks PA Dealing register for any pre-clearance obligation on involved personnel; (c) assesses whether the pattern is consistent with bona-fide market activity; (d) assigns a Level 1 disposition | `human` (Zara — CCO, governance) | `@compliance/market-surveillance` (PLANNED) for context data | Level 1 dispositions: `NoActionRequired` (false positive — documented rationale), `MonitoringRequired` (pattern noted; no escalation yet), `EscalateToLevel2` (material concern), `ImmediateHalt` (egregious concern — halt involved desk pending Level 2). |
| 4 | Emit `Level1TriageCompleted { alertId, disposition, rationaleRef, triageBy: Zara, triageAt }` | `agent` | `@platform/event-store` | `rationaleRef` is the BLAKE3 hash of Zara's triage rationale note in the document store. |
| 5 | If `disposition: 'ImmediateHalt'`: Saskia (Head of Global Markets, governance) is notified immediately; trading on the involved desk is suspended pending Level 2; the CEO is briefed within 1 hour | `agent` (notification) + `human` (Saskia — desk governance) | `@platform/markets/mandate-attestation` (PLANNED — session-lock capability) | Desk suspension is a material operational event; CEO briefing is mandatory. |
| 6 | **Level 2 review (Helena, CRO, governance).** On `EscalateToLevel2` or `ImmediateHalt`: Helena reviews Zara's Level 1 analysis and the underlying trading data; seeks factual input from Saskia (trading context) and Mira (regulatory pattern analysis); within 5 business days produces a Level 2 disposition | `human` (Helena — CRO, governance) | None — senior risk judgment | Level 2 dispositions: `NoFurtherAction` (alert resolved with documented rationale), `InternalInvestigationOpened`, `FscaReferralRequired`, `FicStrRequired`. |
| 7 | Emit `Level2ReviewCompleted { alertId, disposition, rationaleRef, reviewedBy: Helena, reviewedAt }` | `agent` | `@platform/event-store` | |
| 8 | **Internal investigation (if `InternalInvestigationOpened`).** Imani (legal-as-code engineer) leads the investigation under legal privilege; Zara supports compliance analysis; Mira provides data analysis; findings are reported to Helena + CEO within 20 business days | `human` (Imani + Zara + Mira) | `@compliance/market-surveillance` (PLANNED — data retrieval) | Investigation findings are attorney-client privileged where Imani determines privilege applies; privilege determination is Imani's call. |
| 9 | **FSCA referral (if `FscaReferralRequired`).** Zara prepares a referral package (alert detail, triage records, trade data, internal investigation summary); Helena approves; Owen (Company Secretary, governance) countersigns for governance; referral is submitted to FSCA within 30 days of the Level 2 disposition | `human` (Zara — CCO, lead) + `human` (Helena — approval) + `human` (Owen — CoSec countersign) | `@regulatory/fsca-market-abuse-portal` (PLANNED) | Referral is a regulatory submission; all referral artefacts are filed in the regulatory correspondence store. The 30-day window is a hard deadline; Vera monitors. |
| 10 | Emit `FscaMarketAbuseReferralMade { alertId, referralId, submittedAt, referralPackageRef }` | `agent` | `@platform/event-store` | |
| 11 | **FIC STR (if `FicStrRequired`).** Zara (MLRO + CCO) determines whether a Suspicious Transaction Report is required under FIC Act s.28; if required, Zara files the STR within the FIC-mandated window. Mira (regulatory intelligence engineer, compliance) prepares the underlying evidence pack from the surveillance alert. | `human` (Zara — MLRO/CCO, governance, lead) + `agent` (Mira — supporting evidence) | `@regulatory/fic-goaml` (PLANNED) | STR filing is an MLRO obligation; per `Team/_team-roster.json` the MLRO seat is held by Zara (CCO). It runs in parallel with FSCA referral. The STR is confidential; tipping-off prohibition applies. |
| 12 | **PA Dealing cross-check.** On any alert involving internal personnel: query the PA Dealing pre-clearance register; confirm whether the person had an open pre-clearance at the time of the flagged trade; if a pre-clearance gap is identified, escalate immediately to Owen + Zara + Helena | `agent` (Zara — automated cross-check) | `@compliance/pa-dealing-register` (PLANNED) | PA Dealing cross-check is mandatory on every alert involving a named individual; it may be run in parallel with steps 3–4. |
| 13 | **Ongoing monitoring.** For `MonitoringRequired` dispositions: Mira's surveillance engine applies enhanced monitoring parameters for the flagged desk/counterparty/pattern for 90 days; any re-trigger within the monitoring window is automatically elevated to `EscalateToLevel2` | `agent` (Mira) | `@compliance/market-surveillance` (PLANNED) | Enhanced monitoring is documented in the alert record with start and expected end date. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Mira (regulatory intelligence engineer) | Surveillance engine maintenance; pattern library calibration; data analysis on escalated alerts |
| Ravi (market risk quant engineer) | Pattern threshold co-calibration; quantitative analysis for Level 2 reviews |
| Zara (Chief Compliance Officer, governance) | Level 1 triage (all alerts); FSCA referral preparation and lead; PA Dealing cross-check authority |
| Helena (Chief Risk Officer, governance) | Level 2 review; final disposition authority; approves FSCA referrals |
| Saskia (Head of Global Markets, governance) | Trading context for alert review; desk suspension execution; PA Dealing register |
| Imani (legal-as-code engineer) | Internal investigation lead (where opened); legal privilege determination; investigation report |
| Owen (Company Secretary, governance) | FSCA referral governance countersign; Audit Committee briefing |
| Zara (MLRO, governance — concurrent with CCO seat) | STR determination and filing under FIC Act s.28; tipping-off compliance |
| Vera (internal audit engineer, governance) | Alert coverage completeness; FSCA referral deadline monitoring; annual surveillance audit |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| `signalStrength: 'High'` alert | Zara same-day Level 1 | Same business day |
| Level 1 `ImmediateHalt` | Saskia + CEO | Within 1 hour |
| Level 1 alert unactioned > 4 business days | Vera finding → Helena | Day 4 |
| Level 2 disposition `FscaReferralRequired` | Zara leads referral, Helena + Owen sign | 30 days |
| FSCA referral deadline approaching (< 5 days) | Vera alert → Zara + Helena | Day 25 |
| STR filing overdue | Zara + CEO | Per FIC Act deadline |
| Three or more `EscalateToLevel2` dispositions in a quarter | BRC briefed; surveillance policy review | Next BRC meeting |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@compliance/market-surveillance` | PLANNED | Pattern detection, alert generation, Level 1/2 workflow, monitoring parameters |
| `@compliance/pa-dealing-register` | PLANNED | PA Dealing pre-clearance records for cross-check |
| `@platform/event-store` | Live | All typed surveillance events |
| `@regulatory/fsca-market-abuse-portal` | PLANNED | FSCA referral submission |
| `@regulatory/fic-goaml` | PLANNED | FIC STR filing via goAML platform |
| `@platform/markets/mandate-attestation` | PLANNED | Desk session lock on ImmediateHalt disposition |

## 9. Quality controls

- **Daily engine health:** `SurveillanceDailyBatchRun` must be emitted every business day. Missing run is a Vera finding escalated to Mira + Zara.
- **Alert triage latency:** Every `SurveillanceAlertGenerated` must have a `Level1TriageCompleted` within 5 business days. Latency > 5 days is a Vera finding.
- **Level 2 latency:** Every `EscalateToLevel2` must have a `Level2ReviewCompleted` within 5 business days of the Level 1 event. Lateness is a Vera finding escalated to Helena.
- **FSCA referral deadline:** Every `FscaReferralRequired` disposition must have a `FscaMarketAbuseReferralMade` within 30 days. Vera monitors daily and fires a T−5 day alert.
- **PA Dealing cross-check completeness:** Every alert involving a named individual must have a documented PA Dealing cross-check result within the Level 1 record.
- **Alert suppression audit:** Vera quarterly reviews all `NoActionRequired` dispositions for pattern (systematic false positives may indicate threshold miscalibration requiring Mira + Ravi attention).

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `SurveillanceAlertGenerated` | Event log | 5 years (FMCA r.78 records) | Immutable alert record |
| `Level1TriageCompleted` + Zara's rationale note | Event log + document store | 5 years | Level 1 compliance decision artefact |
| `Level2ReviewCompleted` + Helena's rationale | Event log + document store | 5 years | Level 2 risk governance record |
| Internal investigation report | Document store (attorney-client privilege flag where applicable) | 5 years (or longer if litigation hold) | Imani manages privilege |
| `FscaMarketAbuseReferralMade` + referral package | Event log + regulatory correspondence store | 7 years (regulatory submission) | FSCA submission artefact |
| STR filing receipt (via goAML) | Regulatory correspondence store | 7 years (FIC Act retention) | Confidential; tipping-off prohibition |
| PA Dealing cross-check results | `@compliance/pa-dealing-register` + alert record | 5 years | |
| `SurveillanceDailyBatchRun` | Event log | 1 year (operational log) | Engine health audit |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Zara (Chief Compliance Officer, governance) · Saskia (Head of Global Markets, governance) | Initial POPULATED — four-pattern surveillance engine, two-level triage, FSCA referral pathway, FIC STR branch, PA Dealing cross-check, 5-year retention; FMCA Part 8 + FIC Act sourcing. |
| v0.2 | 2026-05-20 | Owen (Company Secretary, governance) | **MLRO seat reconciliation.** Per `Team/_team-roster.json` canonical roster, the MLRO seat is held concurrently with the CCO seat by **Zara**, not Rashida (who holds the CISO seat). Replaced "Rashida (MLRO)" with "Zara (MLRO)" in §3 obligation row, step 11 FIC STR, §6 Roles, §7 Escalation. Mira (regulatory intelligence engineer) named as the agent assembling the underlying STR evidence pack, consistent with §3 Compliance & financial crime ownership pattern in `Procedures/_index.md` (STR / TPR / CTR all owned by Zara as MLRO). |
