---
policy-parent: funds-transfer-pricing-policy-v1
last-reviewed: 2026-06-11
procedureId: PROC-ALM-FTC-01
title: FTP curve calibration — parameters, recalibration, and cadence governance
author: Ravi (Treasury/ALM engineer, engineering)
date: 2026-06-11
owner: Ravi (Treasury/ALM engineer, engineering — lead) · Eitan (Treasurer, governance — methodology owner, ALCO chair) · Anya (Platform & data engineer, engineering — market-data pipeline)
status: POPULATED
policy-cited: funds-transfer-pricing-policy-v1
system-capability: "@platform/ftp (LIVE — curve, attribution, projection) · @platform/alm/ftp-curve-publisher (LIVE — publishFtpCurveIfMissing) · prototype/runtime/agents/ravi-ftp-curve-publish.ts (LIVE — ravi:ftp-curve-publish, daily)"
---

# Procedure — FTP curve calibration

**Procedure ID:** PROC-ALM-FTC-01
**Owner:** Ravi (Treasury/ALM engineer, engineering — reports to Eitan) — lead; Eitan (Treasurer, governance) — methodology owner and ALCO chair; Anya (Platform & data engineer, engineering) — market-data pipeline.
**Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) for initial methodology; ALCO for monthly recalibration within approved parameters (FTP Policy §1).
**Cadence:** Daily (curve *publication* — `ravi:ftp-curve-publish`); monthly (parameter *recalibration* — FTP Policy §5.2); quarterly (Treasurer FTP framework *review* — `Team/Eitan.md` §6); annual (policy review).
**Version:** v0.1 — 2026-06-11
**Status:** POPULATED
**Standing authority:** `D-TREASURER-WAVE1-SUBSTRATE` (CEO-approved 2026-06-11); parent `D-TREASURER-ROLE-DEFINITION-REVIEW`; `D-MARKETS-SCHEMA-FOUNDATION` (FTP event schemas).

## 1. Source policy

- [`Policies/funds-transfer-pricing-policy-v1.md`](../../Policies/funds-transfer-pricing-policy-v1.md) — Funds Transfer Pricing Policy v1 (IN FORCE 2026-05-22, owner: Eitan (Treasurer, governance)) — specifically:
  - **§2.1 (Benchmark curve construction)** — single ZAR curve, overnight to 30Y; short end SARB repo + JIBAR; mid ZAR swap curve; long SAGB yields.
  - **§4.1 (Optionality adjustment)** — "The optionality adjustment for each product type is set in `Procedures/by-policy/ftp-curve-calibration.md` and updated monthly by Ravi under Eitan's direction." This procedure §5.1 carries those parameters.
  - **§4.2 (Basis risk allocation)** — "if the basis P&L exceeds the threshold set in `Procedures/by-policy/ftp-curve-calibration.md` for two consecutive months, the FTP curve is recalibrated." This procedure §5.2 carries that threshold.
  - **§5.2 (Monthly recalibration)** — first-business-day recalibration scope and Eitan approval step.
- [`Policies/asset-liability-management-policy-v1.md`](../../Policies/asset-liability-management-policy-v1.md) §5.3 — the behavioural-assumption basis calibrates the FTP optionality adjustment.

The obligation chain (Principle 2):

```
Regulation (Banks Act 94 of 1990 ss.60–64; Regulations Relating to Banks reg.26;
            BCBS Principles for sound liquidity risk management (2008) Principle 4;
            Basel III LCR (2013) + NSFR (2014); BCBS IRRBB (April 2016))
  → Policy: funds-transfer-pricing-policy-v1 (§2 methodology; §4 optionality + basis; §5 governance)
    → PROC-ALM-FTC-01 (this procedure — parameter register, recalibration flow,
                        cadence reconciliation)
      → @platform/ftp (curve construction, attribution, portfolio projection)
      → @platform/alm/ftp-curve-publisher (idempotent daily publication)
      → FtpCurvePublished + FtpAttributionRecorded typed events
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| BCBS Principles for sound liquidity risk management and supervision (September 2008) — Principle 4 | Incorporate liquidity costs, benefits and risks in internal pricing for all significant business activities; FTP is the implementing mechanism. |
| Regulations Relating to Banks reg.26 | Liquidity risk management — internal pricing of liquidity risk under board-approved governance. |
| Basel III LCR framework (January 2013) | HQLA buffer cost attributable per product feeds the LCR liquidity premium (FTP Policy §3.1). |
| Basel III NSFR framework (October 2014) | Required-stable-funding cost feeds the NSFR premium (FTP Policy §3.2). |
| BCBS IRRBB (April 2016) / SARB Guidance Note on IRRBB | Matched-maturity transfer of rate risk to Treasury; behavioural-maturity treatment of NMDs. |
| Banks Act 94 of 1990 ss.60–64 | Liquidity governance underpinning the FTP framework's board approval. |

## 3. Purpose

The FTP Policy defers two concrete parameter sets to this procedure: the **optionality-adjustment parameters** per product type (§4.1) and the **basis-risk recalibration threshold** (§4.2). This procedure carries both, and additionally reconciles the three distinct FTP cadences that the policy, the live substrate, and the Treasurer's operating spec each name — a triple divergence flagged in the Treasurer role-definition review (`docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md` Part B.3):

| Cadence object | What it is | Frequency | Authority |
|---|---|---|---|
| **Curve publication** | Mechanical re-issue of the current curve for the day's attributions. No parameter change; same methodology, same spreads. `ravi:ftp-curve-publish` emits one `FtpCurvePublished` event each morning (05:45 UTC). | Daily | This procedure §5.3; `D-MARKETS-SCHEMA-FOUNDATION` |
| **Parameter recalibration** | Re-derivation of the curve's *inputs* — benchmark grid from updated JIBAR/swap/SAGB data, liquidity premium from current LCR/NSFR, optionality adjustments vs market volatility, basis-risk adjustment vs Treasury basis P&L. Eitan approves; ALCO reviews. | Monthly (first business day) + ad hoc on SARB repo change / material dislocation | FTP Policy §5.2 |
| **Framework review** | Treasurer-level review of the FTP framework's operation: methodology fitness, anomalous-result inventory, double-count check against IRRBB (Helena (Chief Risk Officer, governance) independent review). | Quarterly | `Team/Eitan.md` §6 |

Daily publication and monthly recalibration are different objects: the daily run *publishes* the standing calibration; the monthly run *changes* it. The quarterly review challenges the methodology itself. No artefact prior to this procedure said so.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Daily scheduler (`ravi:ftp-curve-publish`, cron `45 5 * * *` UTC) | Daily publication — §5.3 |
| First business day of month | Monthly recalibration — §5.4 |
| SARB repo rate change (any business day) | Benchmark-grid refresh — §5.4 steps 1 + 5 only (FTP Policy §2.1) |
| Treasury basis P&L exceeds §5.2 threshold for two consecutive months | Forced recalibration — §5.4 (FTP Policy §4.2) |
| New product type introduced via NPA pipeline | Optionality-adjustment review for the new type — §5.1 row added, ALCO approval (FTP Policy §4 cadence) |
| Quarterly tick (`Team/Eitan.md` §6) | Framework review — §5.5 |

## 5. Steps

### 5.1 Optionality-adjustment parameter register (FTP Policy §4.1)

The parameters below are the operative values the FTP Policy §4.1 defers to this procedure. The bank is COMMENCEMENT-BIND for FTP: no products carry FTP charges until commencement of trading, so the initial values are conservative build-phase calibrations that ALCO must ratify at the first post-commencement recalibration. Ravi updates values monthly under Eitan's direction; every change is ALCO-reviewed (FTP Policy §5.3).

| Product / optionality type | Adjustment methodology | Build-phase value | Calibration source at commencement |
|---|---|---|---|
| Prepayable fixed-rate instruments (callable bonds) | Swaption-hedge cost at matching expiry/tenor | 0 bp (no prepayable instruments in the institutional trading mandate) | Market swaption volatility surface (vendor feed — Wave 2, W2.3) |
| Demand / non-maturing deposits (NMDs) | Spread between contractual (overnight) and behavioural-maturity curve points | 0 bp (no deposits booked); behavioural maturities per ALM Policy §4.1: operational 6M, non-operational 1M | First `BehaviouralAssumptionSet`-governed calibration after deposits land (ALM Policy §4.1) |
| Committed undrawn facilities | Liquidity option value linked to the LCR committed-facility outflow rate | 0 bp (no committed facilities) | LCR outflow-rate mapping (FTP Policy §3.1) |
| OTC derivative early-termination rights | Scenario-based close-out MTM optionality estimate | 0 bp (priced in CSA margin terms for current OTC book) | Scenario analysis at first early-termination-right trade |

### 5.2 Basis-risk recalibration threshold (FTP Policy §4.2)

- **Threshold:** Treasury basis P&L (absolute) > **ZAR 250,000 in a calendar month**, sustained for **two consecutive months**, forces an off-cycle FTP curve recalibration (§5.4).
- The value is a build-phase placeholder calibrated to the bank's zero-position balance sheet; ALCO recalibrates it at the first post-commencement review (target: a value near 2% of monthly net interest income once NII is observable).
- Eitan reviews the Treasury basis P&L monthly at ALCO (FTP Policy §4.2); the threshold test is part of the standing ALCO FTP agenda item (ALM Policy §2.2 item 5).

### 5.3 Daily curve publication

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Construct the day's ZAR tenor/rate grid from the standing calibration: ZARONIA O/N short end, JIBAR mid, SAGB long end. Build phase: indicative grid calibrated to the prevailing SARB repo rate; live vendor feeds are Wave-2 substrate (W2.3). | `system` | `prototype/runtime/agents/ravi-ftp-curve-publish.ts` (`ravi:ftp-curve-publish`) | No parameter change happens here — publication re-issues the standing calibration. |
| 2 | Emit `FtpCurvePublished { curveId, currency, effectiveDate, tenors[], methodology }`. The curve id convention is `FTP-ZAR-<date>`. | `system` | `@platform/event-store` (`platform/event-store/event-types/ftp.ts`) | One curve per currency per day; `@platform/alm/ftp-curve-publisher` (`publishFtpCurveIfMissing`) keeps publication idempotent. |
| 3 | Downstream attribution: `ravi:ftp-attribution` (event-driven on `FtpCurvePublished`, `TradeBooked`, `LoanBooked`, `DepositReceived`, `FundingDrawnDown`) attributes each qualifying transaction a matched-maturity rate from the latest curve and emits `FtpAttributionRecorded`. | `system` | `@platform/ftp` (`curve.ts` interpolation; `attribution.ts`) | Attribution mechanics are governed by PROC-ALM-FTP-01 (`ftp-attachment-on-product-event.md`); listed here only as the publication consumer. |

### 5.4 Monthly recalibration (FTP Policy §5.2)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Reconstruct the ZAR benchmark grid from prior month-end JIBAR, swap, and SAGB data. | `agent` (Ravi) | `@platform/ftp` + market-data ingest handlers (`ravi:jibar-fixing-ingest`, `ravi:jibar-swap-curve-ingest`, `ravi:repo-rate-ingest` — build-phase fixtures) | Live ZARONIA/JIBAR/OIS/SAGB feeds are Wave-2 substrate (W2.3, vendor-selection phase). |
| 2 | Recalculate LCR + NSFR liquidity-premium inputs from the most recent ratio and buffer cost. | `agent` (Ravi) | `@platform/liquidity` (`lcr.ts`, `nsfr.ts`) | FTP Policy §3.1–§3.3. Contingency-reserve allocation basis is ALCO-set quarterly (§3.3). |
| 3 | Review §5.1 optionality adjustments against current market volatility; review §5.2 basis threshold against the prior month's Treasury basis P&L. | `agent` (Ravi) | this procedure §5.1 / §5.2 register | Any §5.1 value change is a curve-parameter change requiring ALCO review (FTP Policy §1 "Curve integrity is ALCO-governed"). |
| 4 | Eitan reviews and approves the recalibrated parameters before they take effect. | `agent` (Eitan) | governance record (ALCO pack item 5, ALM Policy §2.2) | Human-in-the-loop is policy-mandated: FTP Policy §5.2 — "The recalibrated curve parameters are reviewed by Eitan before approval" (P2 citation: BCBS 2008 Principle 4 ALCO oversight; FTP Policy §1 approval row). |
| 5 | Publish the recalibrated curve: the next daily `FtpCurvePublished` carries the new grid; the ALCO pack records the key changes. | `system` | `@platform/ftp` + `@platform/event-store` | The policy-named `FtpCurveRecalibrated` / `FtpCurveParameterChanged` governance events are not yet registered — see §10 substrate gaps. Until they land, the approval record is the ALCO decision + the first post-approval `FtpCurvePublished`. |
| 6 | Apply forward-only: recalibrated parameters apply to new originations from the effective date; existing fixed-rate products reprice at their next contractual repricing date. | `system` | `@platform/ftp` (`attribution.ts` uses latest curve at attribution time) | FTP Policy §5.2 — no retrospective repricing. |

### 5.5 Quarterly framework review

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Review framework operation: anomalous attributions, basis P&L trend, methodology fitness, parameter-register completeness against the live product set. | `agent` (Eitan, with Ravi analytics) | `@platform/ftp` (`projection.ts` — `buildFtpPortfolio` portfolio summary) | `Team/Eitan.md` §6 quarterly FTP review. |
| 2 | Helena (Chief Risk Officer, governance) independently reviews the FTP–IRRBB interaction to confirm rate-risk costs are not double-counted. | `agent` (Helena) | `Policies/irrbb-policy-v1.md` framework | FTP Policy §1 Roles. |
| 3 | Material methodology changes escalate to the Board (CEO interim) per FTP Policy §1 approval row. | `agent` (Eitan) → `human` (CEO) | `@platform/decisions` (`Decision` event) | P2 citation: FTP Policy §1 — Board approves methodology; ALCO approves recalibration within parameters. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Ravi (Treasury/ALM engineer, engineering — reports to Eitan) | Procedure lead; builds and runs the curve construction, publication, and attribution substrate; executes monthly recalibration; maintains §5.1/§5.2 registers |
| Eitan (Treasurer, governance) | Methodology owner; approves every recalibration before effect; presents FTP at monthly ALCO; chairs quarterly framework review |
| Anya (Platform & data engineer, engineering) | Market-data pipeline ownership (JIBAR/swap/SAGB ingestion path; vendor feed integration at W2.3) |
| Camille (Chief Financial Officer, governance) | Integrates FTP charges into management P&L attribution (FTP Policy §1 Roles) |
| Helena (Chief Risk Officer, governance) | Independent review of FTP–IRRBB interaction (double-count check) |
| ALCO (chair: Eitan) | Reviews and approves all curve parameter changes; monthly FTP standing agenda item |
| Vera (Internal audit engineer, engineering — reports to Thandiwe (Chief Audit Executive, governance)) | Annual audit of FTP framework adherence (FTP Policy §1 Roles) |

## 7. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| Daily publication missed (no `FtpCurvePublished` for a business day) | Ravi investigates; `publishFtpCurveIfMissing` backstop publishes on next platform tick; Eitan notified if a business day closes curve-less | Same business day |
| Basis P&L exceeds §5.2 threshold for two consecutive months | Forced off-cycle recalibration (§5.4); Eitan presents cause analysis at next ALCO | Recalibration within 5 business days of second month-end |
| Unauthorised curve parameter change detected (publication grid differs from approved calibration) | Principle 1 violation per FTP Policy §1 — Vera finding; Eitan + Helena notified; revert to approved parameters | Immediate |
| Product type with no §5.1 optionality row reaches attribution | Attribution proceeds at zero adjustment; Ravi raises the gap to Eitan; ALCO approves the new row at next session | Row proposed within 5 business days |
| Material market dislocation (e.g. JIBAR–repo basis regime change) | Ad-hoc recalibration under FTP Policy §2 cadence ("ad hoc on material market dislocation"); ALCO ratifies | As market conditions require |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/ftp` | ✓ live | `curve.ts` (FtpCurve, matched-maturity interpolation), `attribution.ts` (`attributeTransaction`), `projection.ts` (`buildFtpPortfolio`) |
| `@platform/alm/ftp-curve-publisher` | ✓ live | `publishFtpCurveIfMissing` — idempotent daily publication guard |
| `ravi:ftp-curve-publish` handler | ✓ live | `prototype/runtime/agents/ravi-ftp-curve-publish.ts`, scheduled daily 05:45 UTC |
| `ravi:ftp-attribution` handler | ✓ live | Event-driven consumer (PROC-ALM-FTP-01 governs) |
| `FtpCurvePublished` / `FtpAttributionRecorded` events | ✓ live | `prototype/platform/event-store/event-types/ftp.ts` |
| Market-data ingest (JIBAR fixing / swap curve / repo rate) | ✓ live (build-phase fixtures) | `ravi:jibar-fixing-ingest`, `ravi:jibar-swap-curve-ingest`, `ravi:repo-rate-ingest` — on-request; vendor feeds at W2.3 |
| Policy-named governance events (`FtpCurveRecalibrated`, `FtpCurveParameterChanged`, `FtpBenchmarkCurveUpdated`, `FtpAttachedToProduct`) | PLANNED | See §10 — not in the event-type registry; implemented surface is `FtpCurvePublished` + `FtpAttributionRecorded` |

## 9. Quality controls

| Control | Frequency | Owner |
|---|---|---|
| Curve publication completeness — every business day has exactly one `FtpCurvePublished` per active currency | Daily | Ravi (Treasury/ALM engineer, engineering) |
| Tenor-grid completeness — all canonical tenors populated, shortest-to-longest ordered (schema-enforced) | Daily (Zod parse at append) | `@platform/event-store` |
| Recalibration approval discipline — no parameter change effective without Eitan approval on record | Monthly | Eitan (Treasurer, governance) |
| §5.1/§5.2 register currency — parameter rows match the live product set | Monthly (recalibration step 3) | Ravi |
| FTP–IRRBB double-count review | Quarterly | Helena (Chief Risk Officer, governance) |
| FTP framework audit | Annual | Vera (Internal audit engineer, engineering) |

## 10. Substrate gaps

- **Policy-named governance events not registered.** The FTP Policy names `FtpAttachedToProduct`, `FtpBenchmarkCurveUpdated`, `FtpCurveRecalibrated`, and `FtpCurveParameterChanged`; the implemented event surface (per `D-MARKETS-SCHEMA-FOUNDATION`) is `FtpCurvePublished` + `FtpAttributionRecorded`. `FtpAttributionRecorded` is the implemented equivalent of `FtpAttachedToProduct`; the three curve-governance events have no equivalent yet — recalibration approvals currently ride ALCO records + the post-approval `FtpCurvePublished`. Registering the governance events (or amending the policy to the implemented names at its next review) is a named Wave-2 item.
- **Live market-data feeds.** Curve inputs are indicative (SARB repo + typical spreads); ZARONIA/JIBAR/OIS/SAGB vendor feeds land at vendor-selection (W2.3). Until then, "recalibration" exercises the flow against fixture data.
- **Liquidity-premium automation.** §5.4 step 2 reads LCR/NSFR engine outputs manually-orchestrated at recalibration; an automated premium-derivation module is a Wave-2 refinement.

## 11. Citations

- `Policies/funds-transfer-pricing-policy-v1.md` §§ 1, 2.1, 3, 4.1, 4.2, 5.2, 5.3.
- `Policies/asset-liability-management-policy-v1.md` §§ 2.2, 4.1, 5.3.
- `docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md` Part B.3 (cadence triple-divergence finding), Part C.2 (PROC-ALM-FTC-01 pipeline row).
- `D-TREASURER-WAVE1-SUBSTRATE` (CEO-approved 2026-06-11); `D-TREASURER-ROLE-DEFINITION-REVIEW`; `D-MARKETS-SCHEMA-FOUNDATION`.
- `Principles/1-events-are-truth.md`; `Principles/2-single-graph-discipline.md`; `Principles/6-autonomous-by-default.md`.
- `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11`.

## 12. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-11 | Ravi (Treasury/ALM engineer, engineering) | Initial authoring under `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11` (WS-TREASURER-WAVE1-SUBSTRATE, W1.4). Closes the dangling FTP Policy §4.1/§4.2 citations; reconciles the daily-publish / monthly-recalibrate / quarterly-review cadence divergence (role-definition record Part B.3). |
