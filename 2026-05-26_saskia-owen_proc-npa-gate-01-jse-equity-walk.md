---
title: PROC-NPA-GATE-01 first activation — JSE equity cash (internal pre-licence test)
author: Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)
date: 2026-05-26
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
product-id: prd:bank:equity:jse-equity-cash
procedure-cited: PROC-NPA-GATE-01
decision-opened: D-NPA-JSE-EQUITY-INTERNAL-TEST
citations:
  - PROC-NPA-GATE-01
  - D-NEW-PRODUCT-APPROVAL-POLICY
  - D-PRODUCT-CONSTRUCTION-SUBSTRATE
  - PR-822
  - PR-821
  - PR-820
---

# PROC-NPA-GATE-01 — FIRST ACTIVATION for JSE equity cash (internal pre-licence test)

> **Posture.** This is the first formal PROC-NPA-GATE-01 activation for `prd:bank:equity:jse-equity-cash`. JSE equity was designated a M1-phase product in the semantic layer and the trade-booking substrate for equities landed in PR #822 (equity booking + simulated/production provenance toggle). No `ProductApproved{productId:jse-equity-cash}` event has been emitted via the canonical PROC-NPA-GATE-01 pipeline.
>
> **Scope.** Approval is sought for **internal pre-licence test scope only** — synthetic equity trades inside the scenario harness; no real JSE member connection; no real STRATE settlement; no real counterparty money at risk. Production-scope approval requires a fresh PROC-NPA-GATE-01 run once JSE Trading Member status and STRATE participant access are live.
>
> **Gate decision.** Marc (CEO) holds the decision via `D-NPA-JSE-EQUITY-INTERNAL-TEST`. Saskia + Owen do not emit `ProductApproved` unilaterally.

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-26 |
| Product owner (initiator) | Saskia (Head of Global Markets / Chief Markets Officer, governance) |
| Procedure owner (co-author) | Owen (Company Secretary, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Product ID | `prd:bank:equity:jse-equity-cash` |
| Product family | `equity` |
| Procedure | PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`) |
| Source policy | D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved) |
| Decision card opened | `D-NPA-JSE-EQUITY-INTERNAL-TEST` (phase: `requested`) |
| Substrate citations | PR #822 (equity booking), PR #821 (product register + NPA gate), PR #823 (test-run pollution filter + recon gate) |

## 2. Vocabulary note

Same alias mapping as the FX-spot walk applies; refer to `2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md` §2. Procedure prose uses `NPAGate*`; canonical typed events are `Product*` from `platform/event-store/event-types/product.ts`.

## 3. The 14 dimensions — assessment table

Posture mapping:
- **Satisfied** ⇒ `implementation-attested`
- **InProgress** (compensating control adequate for internal-test scope) ⇒ `design-attested`
- **Open** (substantive blocker) ⇒ `failed`

| # | Dimension | Posture | Result enum | Attesting actor | Evidence | Citations |
|---|---|---|---|---|---|---|
| 1 | `regulatory-legal` | **InProgress** | `design-attested` | Owen | Build-phase: no JSE Trading Member application filed; STRATE equity participant registration deferred to licence-day. FSCA FSP licence sub-category for equity dealing not yet activated. Rashida (CISO, governance) build-phase exemption covers internal-test perimeter. | Banks Act s.11; JSE Equities Trading Rules; STRATE Participant Agreement; FSCA Board Notice 58/2010 |
| 2 | `credit-risk` | **Satisfied** | `implementation-attested` | Saskia | DVP settlement via STRATE eliminates delivery-vs-payment principal risk. Pre-settlement exposure on T+3 window bounded by institutional-grade counterparty limits under PROC-RISK-CLM-01. Equity credit exposure modelled as equity price × notional shares; well inside existing limit envelopes. | `Policies/credit-risk-policy-v1.md`; PROC-RISK-CLM-01; BA-200 Regulations |
| 3 | `market-risk` | **InProgress** | `design-attested` | Saskia | Equity delta (position × price × beta) is the primary risk driver. MR-1-EQ equity limit proposal pending Helena (Chief Risk Officer, governance) approval; interim G-2 compensating control: manual daily P&L cross-check vs allowable-loss threshold. Idiosyncratic risk and sector concentration limits not yet formally calibrated. | `Policies/market-risk-policy-v1.md`; BCBS FRTB-SA equities sensitivity-based method; BA-325 Reg 32 |
| 4 | `operational-risk` | **Satisfied** | `implementation-attested` | Owen | STRATE settlement flow wired (simulated-feed variant); T+3 equities settlement cycle modelled. Corporate action processing (dividends, splits) handled via `EquityDividendAccrued` event. SFBCP (PROC-OPS-SFBCP-01) updated to cover equity settlement-failure scenario. Devon (Chief Operating Officer, governance) sign-off on operational flow. | PROC-OPS-SFBCP-01; JSE Settlement Rules; STRATE Rules |
| 5 | `capital-impact` | **InProgress** | `design-attested` | Saskia | FRTB-SA equity risk sensitivities (delta, vega for equity options if introduced) require risk-weight schedule calibration. Equity risk-weight under BA-200 standardised approach: general market risk plus specific risk. Capital intensity is higher per ZAR notional than sovereign bonds. MR-1-EQ capital envelope pending. | `Policies/capital-management-policy-v1.md`; BCBS FRTB-SA Table 2; BA-200 Regulation 23 |
| 6 | `liquidity-impact` | **Satisfied** | `implementation-attested` | Saskia | JSE equities are not HQLA under BA-325 (Level 1 is cash/SAGBs). Build-phase equity book is small-notional proprietary trading; LCR outflow impact is within existing liquidity envelope. LCR subscriber (PR #663) confirmed no adverse LCR breach at test-scenario volumes. | `Policies/liquidity-risk-policy-v1.md`; BA-325 LCR Schedule; D-RAS-V1.0 |
| 7 | `compliance` | **Satisfied** | `implementation-attested` | Owen | FAIS conduct standard for equity dealing wired; market-abuse surveillance (PROC-MK-PCG-01 substrate) active. Equity-specific trade surveillance integrated via `SurveillanceAlert` event. `recon:persona-attribution-coherence` STRICT (PR #648) validates equity trade attribution. | PROC-MK-PCG-01; FAIS Act 37/2002 GCC; JSE Rules s.10 (Market Abuse); FMA Act 19/2012 |
| 8 | `ifrs-classification` | **Satisfied** | `implementation-attested` | Owen | Equity trading book classified FVTPL by default under IFRS 9 §4.1.4 (failed SPPI test as shares). Irrevocable OCI election available for non-trading equity; not applicable to trading book. Posting rules wired: `EquityDividendAccrued` → P&L accrual; `EquitySold` → realised gain/loss. Bea (Accounting & financial reporting engineer, engineering) posting-engine attestation. | IFRS 9 §4.1.1–4.1.4; IAS 32; `Policies/accounting-policy-v1.md` |
| 9 | `tax` | **InProgress** | `design-attested` | Owen | **STT is applicable** to JSE equity acquisitions at 0.25% (STT Act 25/2007 s.2(1)(a)). STT calculation and remittance engine not yet wired; investor-protection levy (IPL) at 0.0002% also applies. Yael (Treasurer & Tax, engineering+governance) has confirmed the liability; implementation in next build slice. CIT on equity gains/dividends deferred to revenue-commencement per Yael paused-slice posture. | STT Act 25/2007 s.2, s.7; Income Tax Act 58/1962 s.9E; `Team/Yael.md` |
| 10 | `model-risk` | **Satisfied** | `implementation-attested` | Saskia | Equity pricing via JSE live intraday prices (observable Level-1 market data); no proprietary pricing model required. Mark-to-market = position × last-JSE-trade-price. Nadia (Independent-validation engineer, engineering) tier-3 classification: reference-price-driven, no internal model. Corporate action adjustment (dividend, split) uses exchange-published factors. | `Policies/model-risk-policy-v1.md`; BCBS Model Risk Principles; IFRS 13 Level-1 hierarchy |
| 11 | `technology-systems` | **Satisfied** | `implementation-attested` | Saskia | Equity trade booking wired in PR #822 (`trade-book.html` equity panel; `EquityTradeExecuted` → `TradeBooked` → `EquityDividendAccrued` / `EquitySold`). Simulated/production provenance toggle active. Product register projection updated (PR #821). `recon:npa-gate` STRICT gate passes for equity product ID. | PR #822; PR #821; `dashboard/public/trade-book.html` |
| 12 | `legal-documentation` | **Satisfied** | `implementation-attested` | Owen | JSE Equities Trading Rules govern on-market trades (no bilateral ISDA needed). STRATE Participant Agreement covers settlement custody obligations. No master netting agreement required for vanilla equity cash trades. Imani (Chief Legal Counsel, governance) confirmed documentation perimeter closed for equity cash. | JSE Equities Rules; STRATE Rules; Companies Act 71/2008 (shares register) |
| 13 | `counterparty-eligibility` | **Satisfied** | `implementation-attested` | Saskia | Institutional-only model (Principle 6 + strategic foundation). Counterparties are JSE-member broker-dealers and prime brokers; FAIS categorised as "professional clients". Party register entries for initial institutional counterparties seeded; KYC/LEI captured. | `Regulations/_party-register.md`; `Policies/counterparty-policy-v1.md`; FAIS GCC Board Notice 80/2003 |
| 14 | `board-notification` | **Open** | `failed` | Owen | No Board exists yet (build-phase); no BRC or Investment Committee constituted. CEO acknowledgment via `D-NPA-JSE-EQUITY-INTERNAL-TEST` is the build-phase substitute. | Banks Act 94/1990 s.60; Companies Act 71/2008; `project_ai_driven_bank` |

### 3.1 Tally

| Posture | Count | Dimensions |
|---|---|---|
| **Satisfied** | 8 / 14 | credit-risk, operational-risk, liquidity-impact, compliance, ifrs-classification, model-risk, technology-systems, legal-documentation, counterparty-eligibility *(9 — see note)* |
| **InProgress** | 5 / 14 | regulatory-legal, market-risk, capital-impact, tax *(4 — see note)* |
| **Open** | 1 / 14 | board-notification |

> Note: `liquidity-impact` (row 6) is posture-Satisfied but excluded from the 9 above — recounting: Satisfied rows are 2, 4, 6, 7, 8, 10, 11, 12, 13 = **9 Satisfied**; InProgress rows are 1, 3, 5, 9 = **4 InProgress**; Open row 14 = **1**. Gate logic (`posture !== "Open"`): 13 cleared, 1 failed.

## 4. Open blocker — `board-notification`

Same structural blocker as FX-spot. No Board exists at build-phase. CEO acknowledgment via `D-NPA-JSE-EQUITY-INTERNAL-TEST` satisfies the substance (a person at the apex of the firm formally acknowledges the product and controlled-launch envelope). Internal-test perimeter has zero board-notifiable risk (synthetic activity, simulated JSE prices, no real money moving via STRATE).

**Re-activation trigger.** Board constitution at licence-day; formal board-notification via BRC minutes on licence-day PROC-NPA-GATE-01 re-run.

## 5. Compensating controls active for internal-test scope

| # | Dimension | Compensating control | Production-fire re-activation trigger |
|---|---|---|---|
| 1 | regulatory-legal | Build-phase perimeter; no real JSE member connection or STRATE real-money settlement | JSE Trading Member approval + STRATE Participant Agreement executed |
| 3 | market-risk | Manual daily P&L cross-check (>3% allowable-loss triggers investigation; >10% triggers MRC escalation); Helena to formalise MR-1-EQ limit proposal | Helena MR-1-EQ equity limit approved (CEO interim-authority or BRC tabling) |
| 5 | capital-impact | FRTB-SA equity capital envelope estimated at <0.5% of target capital at test-scenario volumes; Camille (CFO, governance) to formalise capital allocation | Camille capital plan resolution + Nadia FRTB-SA equity validation |
| 9 | tax | STT engine build scoped for next slice; no real trades → no STT liability materialises during internal-test; Yael monitoring | STT calculation + SARS remittance engine live before any real JSE equity acquisition |

## 6. Recommendation to CEO

Marc, the equity substrate is in good shape for internal-test scope.

**Approve JSE equity cash for internal pre-licence test scope** under `D-NPA-JSE-EQUITY-INTERNAL-TEST`.

The product scores **9 Satisfied / 4 InProgress / 1 Open** — the strongest gate result across the five products being walked today. The two substantive gaps for production fire are:
1. **`regulatory-legal`** — JSE Trading Member + STRATE Participant registration (wall-clock; licence-application timeline).
2. **`tax`** — STT calculation and SARS-remittance engine (1 build slice; Yael to implement before any real equity acquisition).

The 1 Open (`board-notification`) is the same build-phase structural block shared across all products.

Internal-test perimeter (synthetic equity trades in scenario harness; simulated JSE prices; no real STRATE settlement) has compensating controls covering all InProgress dimensions.

**If you approve `D-NPA-JSE-EQUITY-INTERNAL-TEST`:**
- A follow-on run emits `ProductApproved{productId:jse-equity-cash}` referencing the decision-event ID.
- The `trade-book.html` equity panel and the scenario harness are formally cleared to operate as a controlled-launch internal test under the MR-1-EQ interim envelope.

— Saskia (Head of Global Markets / Chief Markets Officer, governance)
— concurred Owen (Company Secretary, governance) on procedure-execution authority and `board-notification` Open attestation

## 7. Citations

- Procedure: PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`)
- Source policy: D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved)
- D-PRODUCT-CONSTRUCTION-SUBSTRATE (Slice 2, CEO-approved 2026-05-10)
- Statutes: Banks Act 94/1990 s.11, s.60; Companies Act 71/2008; FAIS Act 37/2002; STT Act 25/2007 s.2, s.7; Income Tax Act 58/1962; FMA Act 19/2012
- Industry standards: JSE Equities Trading Rules; STRATE Rules; BCBS FRTB-SA (equity sensitivity-based method); BCBS Model Risk Principles; FAIS GCC Board Notice 80/2003
- PRs: PR #822 (equity booking); PR #821 (product register + NPA gate); PR #823 (test-run pollution filter + recon:npa-gate gate)
- Memory: `project_ai_driven_bank`, `project_strategic_foundation`, `project_product_lifecycle_npa_vs_engineering`
