---
policy-parent: Liquidity Risk Management Policy · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B5
last-reviewed: 2026-05-15
procedureId: PROC-RISK-ILF-01
title: Intraday liquidity and funding monitoring
author: Eitan (Treasurer) · Ravi (ALM quant engineer)
date: 2026-05-15
owner: Eitan (Treasurer) · Ravi (ALM quant engineer) · Helena (Chief Risk Officer, governance — RAS approval)
status: POPULATED
policy-cited: Liquidity Risk Management Policy · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B5
system-capability: "@platform/alm/intraday-liquidity-engine (PLANNED)"
---

# Procedure — Intraday liquidity and funding monitoring

**Procedure ID:** PROC-RISK-ILF-01
**Owner:** Eitan (Treasurer) · Ravi (ALM quant engineer) · Helena (Chief Risk Officer, governance — RAS approval)
**Approval:** ALCO (limits); BRC (appetite); PA (ILAAP chapter)
**Cadence:** Continuous (intraday real-time monitoring); daily close (settlement reconciliation); monthly (ALCO report); annual (ILAAP liquidity chapter)
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- Liquidity Risk Management Policy (planned; to be authored by Helena with Eitan; pending at licence-day pre-go-live readiness gate).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B5 — Liquidity appetite: LCR floor; NSFR floor; intraday liquidity buffer minimum; stress-survival horizon.
- Basel III Liquidity Coverage Ratio (LCR) and NSFR standards — the ILAAP liquidity section incorporates intraday liquidity management.
- BCBS January 2013 Monitoring Tools for Intraday Liquidity Management — seven monitoring metrics.

The obligation chain:
```
Regulation (Banks Act Reg 39 / PA LCR Directive / BCBS ILAAP / BCBS Intraday Liquidity Tools)
  → Liquidity Risk Management Policy
    → PROC-RISK-ILF-01 (this procedure)
      → @platform/alm/intraday-liquidity-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-11` (Banks Act s.73 / Reg 39 — liquidity risk) | Bank must measure, monitor, and control liquidity risk; intraday liquidity management is a sub-set of the overall liquidity framework. |
| `ORG-PR-15` (PA LCR Directive — BA 300 return) | LCR ≥ 100%; intraday liquidity monitoring is a PA reporting expectation under ILAAP. |
| `ORG-PR-16` (PA NSFR Directive — BA 330 return) | NSFR ≥ 100%; intraday funding is distinct from NSFR but reported in the same ILAAP framework. |
| `ORG-PR-23` (Reg 39 — ILAAP) | ILAAP must include intraday liquidity management; Pillar 2 add-on for liquidity risk where applicable. |
| `ORG-PS-01` (NPS Act — SARB oversight of payment systems) | As an indirect NPS participant (via correspondent bank), the bank must manage intraday payment obligations and ensure settlement finality; intraday liquidity is the enabling resource. |

## 3. Purpose

Monitor and manage the bank's intraday liquidity position — the real-time availability of funds to meet payment, settlement, and collateral obligations as they fall due throughout the trading day. The procedure:

1. Tracks the bank's intraday liquidity position in real-time against the intraday buffer minimum (RAS B5).
2. Monitors intraday peak usage and minimum balance against ALCO-approved limits.
3. Manages the intraday funding facility with the correspondent bank (Tomas's payments channel — `outbound-payment-sponsor-bank-channel.md`).
4. Reconciles settlement activity at end-of-day and emits confirmed position events.
5. Feeds the ILAAP liquidity chapter with the BCBS seven intraday monitoring metrics.

## 4. Trigger

**Continuous (real-time):**
- `PaymentInstructionQueued { instruction_id, value_date: today, amount, currency }` — each queued payment reduces the projected intraday position.
- `SettlementConfirmed { settlement_id, amount, currency }` — each confirmed settlement updates the realised intraday position.
- `CollateralCallReceived { call_id, amount, currency, settlement_date }` — collateral calls create intraday funding needs.

**Daily open:**
- Daily scheduler (07:00 SAST): `IntradayMonitoringStarted { date }` — Eitan reviews the opening position; BCBS metric #1 (daily maximum intraday liquidity usage) baseline set.

**Daily close:**
- Daily scheduler (18:00 SAST): `IntradayMonitoringClosed { date }` — end-of-day reconciliation; BCBS metrics calculated; `IntradayDailySummary` emitted.

**Monthly ALCO:**
- Monthly ALCO pack: Eitan reports intraday liquidity utilisation trend, peak usage vs limit, and any breaches.

**Annual ILAAP:**
- Annual scheduler (Q3): BCBS seven-metric table for the ILAAP intraday liquidity chapter.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | At 07:00 SAST: read opening balance from correspondent bank account (via Tomas's correspondent-bank feed); read scheduled payment obligations (queued outgoing payments, known incoming settlements); calculate projected intraday position | `agent` (Eitan) | `@platform/alm/intraday-liquidity-engine` (`PLANNED`) + `@platform/payments/correspondent-feed` (`PLANNED`) | Opening balance from Tomas's correspondent-bank interface; scheduled payment obligations from Kai's (OTC pre-trade) and Tomas's (payments) event feeds. |
| 2 | Emit `IntradayMonitoringStarted { date, opening_balance, projected_minimum_balance, intraday_buffer_minimum_limit }` | `system` | `@platform/event-store` ✓ | The `intraday_buffer_minimum_limit` is the RAS B5 floor; breaching it triggers an immediate escalation. |
| 3 | **Continuous monitoring.** On every `PaymentInstructionQueued`, `SettlementConfirmed`, and `CollateralCallReceived`: recalculate the current projected intraday position; emit `IntradayPositionUpdated { timestamp, current_balance, projected_minimum_remaining, utilisation_of_buffer_pct }` | `system` | `@platform/alm/intraday-liquidity-engine` (`PLANNED`) | Frequency: per event (event-driven, not polling). The engine aggregates multi-currency positions in ZAR reporting currency. |
| 4 | **Limit check on each update.** If projected minimum balance < intraday buffer minimum limit: emit `IntradayLimitBreached { date, breach_time, projected_balance, limit, shortfall, severity }` and route to Eitan immediately | `system` | `@platform/event-store` ✓ + `@platform/escalation` (existing) | Severity: Warning = < 110% of limit; Minor = < 100% limit; Major = < 80%; Critical = < 50%. |
| 5 | **Correspondent bank funding call (if needed).** If an intraday funding shortfall is projected: Eitan calls the correspondent bank funding facility; confirms amount and timing; emits `IntradayFundingDrawn { date, amount, currency, facility_ref, purpose }` | `agent` (Eitan — human call to correspondent bank) | `@platform/alm/intraday-liquidity-engine` (`PLANNED`) | The correspondent bank intraday facility is a contractual line (Tomas's correspondent-bank agreement — `outbound-payment-sponsor-bank-channel.md`); drawdown is discretionary within the agreed limit. |
| 6 | **Collateral management coordination.** Where a `CollateralCallReceived` creates an intraday liquidity need: Eitan coordinates with Ravi on eligible collateral available for delivery; emits `CollateralDeliveryInitiated { call_id, collateral_ref, settlement_date }` | `agent` (Eitan + Ravi) | `@platform/alm/intraday-liquidity-engine` (`PLANNED`) + `@platform/collateral/registry` (`PLANNED`) | Collateral availability is tracked in the collateral registry; Ravi maintains the eligible-HQLA pool. **HQLA pool sourcing:** the eligible-HQLA pool is derived from the **instrument-level position register**. For each instrument held by the bank, the SecurityMaster classification (`FinancialInstrumentClassified.hqlaLevel`) determines the HQLA tier. GL account balances are not used as a proxy for the HQLA buffer. Account-level `hqlaLevel` tags on the Chart of Accounts were a Phase-0 shortcut and are deprecated (`D-FINANCIAL-INSTRUMENT-ENTITY`, 2026-05-22; corrected 2026-05-29). |
| 7 | **End-of-day reconciliation (18:00 SAST).** Eitan reconciles the day's intraday position: actual opening balance, total payments sent, total settlements received, funding drawn, closing balance; confirms against correspondent bank statement | `agent` (Eitan) | `@platform/alm/intraday-liquidity-engine` (`PLANNED`) | Reconciliation breaks are escalated immediately to Tomas (payments) for resolution. |
| 8 | Calculate BCBS seven intraday monitoring metrics for the day: (1) daily maximum intraday liquidity usage; (2) available intraday liquidity at start of day; (3) total payments sent; (4) time-specific obligations; (5) value of customer payments made on behalf of financial institution customers; (6) intraday credit lines extended to customers; (7) timing of intraday payments | `system` (Ravi's quant engine) | `@platform/alm/intraday-liquidity-engine` (`PLANNED`) | BCBS monitoring metrics are as per January 2013 BCBS consultative document, as adopted by the PA ILAAP framework. Metrics 5–6 are zero for the bank's current business model (institutional-only, no retail customers). |
| 9 | Emit `IntradayDailySummary { date, opening_balance, closing_balance, max_intraday_usage, min_balance_intraday, funding_drawn, bcbs_metrics }` | `system` | `@platform/event-store` ✓ | This is the canonical daily record; feeds the monthly ALCO report and the annual ILAAP chapter. |
| 10 | **Monthly ALCO reporting.** Eitan compiles the intraday liquidity section of the ALCO pack: peak usage trend, limit utilisation, funding-facility utilisation, any limit breaches during the month, BCBS metric trends | `agent` (Eitan) | `@platform/reporting/alco-pack` (`PLANNED`) | ALCO reviews and approves; Helena chairs. Material changes (e.g., adjust intraday buffer limit) require a formal `ALCODecision` event. |
| 11 | **Annual ILAAP intraday chapter.** Ravi and Eitan produce the intraday liquidity section of the ILAAP: BCBS seven-metric table (annual averages + range + peak), funding-facility adequacy assessment, stress scenario results (intraday stress under a correspondent-bank disruption), Pillar 2 assessment | `agent` (Ravi + Eitan) + `human` (Helena — sign) | `@platform/reporting/ilaap-chapters` (`PLANNED`) | Helena's signature is the load-bearing governance act for the ILAAP. |

## 6. Reconciliation

- **Events produced:**
  - `IntradayMonitoringStarted { date, opening_balance, intraday_buffer_minimum_limit }`
  - `IntradayPositionUpdated { timestamp, current_balance, utilisation_of_buffer_pct }` — per payment/settlement event
  - `IntradayLimitBreached { date, severity }` — on limit breach
  - `IntradayFundingDrawn { date, amount, facility_ref }` — on correspondent funding draw
  - `CollateralDeliveryInitiated { call_id, collateral_ref }` — on collateral call response
  - `IntradayDailySummary { date, opening_balance, closing_balance, max_intraday_usage, bcbs_metrics }`
- **Reconciliation checks:**
  - Every business day has an `IntradayDailySummary` event (Vera invariant).
  - Every `IntradayLimitBreached` has a corresponding `IntradayFundingDrawn` or `ALCODecision` (breach accepted) within the day (Vera check).
  - Opening balance in `IntradayDailySummary` matches closing balance of the prior day (continuity check; Vera asserts this).
  - Closing balance in `IntradayDailySummary` reconciles to the correspondent bank statement (Tomas cross-check via `outbound-payment-sponsor-bank-channel.md`).
- **Failure mode:** intraday engine unavailable → Eitan falls back to manual spreadsheet tracking using correspondent bank's real-time balance feed. Manual tracking is flagged with `IntradayManualTracking { date, reason }` and validated by Helena before close.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `Intraday*` events | Event log | Permanent (P1) | Restricted |
| `IntradayDailySummary` time-series | Event log + liquidity dashboard projection | Permanent | Restricted |
| Correspondent bank statements (reconciliation) | Document store (Tomas's payments channel) | 7 years | Restricted |
| Monthly ALCO pack (liquidity section) | Document store | 7 years | Confidential |
| ILAAP intraday liquidity chapter | Document store | Permanent (ILAAP retention) | Confidential |
| Funding facility draw records | Document store | 7 years | Restricted |
| Collateral delivery records | Document store | 7 years | Restricted |

## 8. Manual steps

- **Step 1 — Opening balance read:** Until the correspondent bank feed is fully automated, Eitan manually reads and enters the opening balance from the correspondent bank's portal. This is a named substrate gap.
- **Step 5 — Funding facility draw:** Correspondent bank funding calls are made by phone or secure messaging by Eitan; the bank does not yet have an automated API-based drawdown channel with the correspondent bank. This is a substrate gap.
- **Step 6 — Collateral coordination:** Collateral availability decisions require Ravi's assessment of eligible collateral; the collateral registry is PLANNED; current state is managed via spreadsheet by Ravi.
- **Step 10 — ALCO reporting:** Eitan's interpretation of intraday trends and funding-facility adequacy recommendations require treasury expertise; not fully automatable.
- **Step 11 — ILAAP chapter:** Helena's Pillar 2 narrative and signature are irreducibly human governance acts.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Intraday balance hits Warning threshold (< 110% of limit) | `IntradayLimitBreached { severity: Warning }` | Eitan reviews and optionally draws funding facility; Helena informed |
| Intraday balance hits Minor breach (< 100% of limit) | `IntradayLimitBreached { severity: Minor }` | Eitan draws funding facility; Helena notified immediately; ALCO reported |
| Intraday balance hits Major breach (< 80% of limit) | `IntradayLimitBreached { severity: Major }` | Eitan + Helena; emergency funding draw; Tomas manages correspondent channel; BRC notification same day |
| Intraday balance hits Critical breach (< 50% of limit) | `IntradayLimitBreached { severity: Critical }` | Helena + CEO + BRC; emergency ALCO; correspondent bank contacted immediately; PA may require notification under ILAAP liquidity-stress protocol |
| End-of-day reconciliation break with correspondent bank | `IntradayDailySummary` vs correspondent statement mismatch | Tomas + Eitan; reconciliation break investigation per `outbound-payment-sponsor-bank-channel.md`; resolved within T+1 |
| Correspondent bank funding facility unavailable | Eitan's funding call rejected | Helena + CEO; contingency liquidity plan; BRC notification; PA notification if material |
| ILAAP intraday chapter not submitted on time | Helena's ILAAP schedule | Camille (CFO, governance) + Helena; escalate to CEO; PA deadline management |

## 10. Related procedures

- [`outbound-payment-sponsor-bank-channel.md`](outbound-payment-sponsor-bank-channel.md) — correspondent bank channel is the intraday funding and settlement vehicle; opening-balance feed and funding facility draws are managed via this channel.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — LCR/NSFR (month-end liquidity ratios) are the complement to intraday liquidity monitoring; both feed the ILAAP.
- [`irrbb-measurement.md`](irrbb-measurement.md) (PROC-RISK-IRRBB-01) — banking-book interest rate and liquidity positions are co-managed in ALCO.
- [`stress-test-cycle.md`](stress-test-cycle.md) (PROC-RISK-ST-01) — intraday liquidity stress scenarios (correspondent bank disruption) are part of the stress-testing programme.
- `collateral-valuation-daily.md` (PLANNED) — collateral valuation feeds Step 6; HQLA pool is a primary intraday liquidity buffer component.
- `nostro-management.md` (PLANNED) — nostro account management (Tomas) provides the opening balance and settlement confirmation feed.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Eitan + Ravi | Initial draft — PLANNED → POPULATED; full 12-section procedure; BCBS seven intraday monitoring metrics; correspondent bank funding path; ALCO and ILAAP integration. |
| v0.2 | 2026-05-29 | Ravi | Step 6 note added: HQLA pool is sourced from instrument-level position register (SecurityMaster × unified-position), not GL account balances. Account-level COA hqlaLevel tags deprecated. Authority: `D-FINANCIAL-INSTRUMENT-ENTITY`; `brief:ravi:fix-ba-325-hqla-stock-instrument-level-positions:2026-05-29`. |

## 12. Audit / assurance

- **Vera daily:** `IntradayDailySummary` completeness check (every business day has a record); continuity check (closing balance = next-day opening balance); reconciliation to correspondent bank statement (via Tomas's payment events).
- **Vera monthly:** limit-breach disposition check — every `IntradayLimitBreached` traces to a disposition event within the day; flag unresolved breaches to Helena and BRC.
- **Thandiwe (CAE, governance):** annual audit of the intraday liquidity management framework; sample testing of daily records vs correspondent bank statements; opinion on BCBS monitoring metric adequacy; report to AC.
- **PA SREP:** the PA reviews the ILAAP intraday liquidity chapter; supervisory stress test results for intraday scenarios are submitted annually; adverse findings trigger a supervisory engagement managed by Helena.
