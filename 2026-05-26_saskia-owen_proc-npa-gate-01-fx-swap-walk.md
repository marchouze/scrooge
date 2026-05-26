---
title: PROC-NPA-GATE-01 first activation — FX swap USD/ZAR (internal pre-licence test)
author: Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)
date: 2026-05-26
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
product-id: prd:bank:fx:fx-swap-usdzar
procedure-cited: PROC-NPA-GATE-01
decision-opened: D-NPA-FX-SWAP-INTERNAL-TEST
citations:
  - PROC-NPA-GATE-01
  - D-NEW-PRODUCT-APPROVAL-POLICY
  - D-PRODUCT-CONSTRUCTION-SUBSTRATE
  - D-NPA-FX-SPOT-INTERNAL-TEST
  - PR-822
  - PR-821
---

# PROC-NPA-GATE-01 — FIRST ACTIVATION for FX swap USD/ZAR (internal pre-licence test)

> **Posture.** First formal PROC-NPA-GATE-01 activation for `prd:bank:fx:fx-swap-usdzar`. An FX swap is a simultaneous spot purchase (near leg) and forward sale (far leg) of the same notional — or vice versa — at agreed rates. It is the bank's primary short-term cross-currency funding and hedging tool. The FX swap builds directly on the FX-spot substrate (`prd:bank:fx:fx-spot-usdzar`, approved via `D-NPA-FX-SPOT-INTERNAL-TEST`).
>
> **Dependency.** This walk assumes `D-NPA-FX-SPOT-INTERNAL-TEST` has been approved. The near leg of every FX swap is economically equivalent to an FX spot transaction; all FX-spot attestations are inherited for the near leg. The incremental gate assessment here focuses on the **far (forward) leg** and its differential risk, documentation, and capital treatment.
>
> **Scope.** Internal pre-licence test only — synthetic FX swap trades with simulated spot and forward rates; no real FinSurv ExCon reporting; no real correspondent-bank instruction on either leg.

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-26 |
| Product owner (initiator) | Saskia (Head of Global Markets / Chief Markets Officer, governance) |
| Procedure owner (co-author) | Owen (Company Secretary, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Product ID | `prd:bank:fx:fx-swap-usdzar` |
| Product family | `fx` |
| Procedure | PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`) |
| Source policy | D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved) |
| Decision card opened | `D-NPA-FX-SWAP-INTERNAL-TEST` (phase: `requested`) |
| Substrate citations | PR #822 (FX swap booking), PR #821 (product register + NPA gate), FX-spot NPA walk (2026-05-21) |

## 2. Vocabulary note

Refer to `2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md` §2. Applies unchanged.

## 3. The 14 dimensions — assessment table

> Where a dimension is substantively unchanged from the FX-spot walk, this table notes the inherited attestation and records the incremental delta only.

| # | Dimension | Posture | Result enum | Attesting actor | Evidence | Citations |
|---|---|---|---|---|---|---|
| 1 | `regulatory-legal` | **InProgress** | `design-attested` | Owen | Inherited from FX-spot: build-phase outside FinSurv ExCon Reg 2/3 scope. **Incremental delta:** FX forward leg creates a forward FX contract; FinSurv ExCon reporting for forward FX transactions (Reg 6) is a separate reporting line from spot. Not yet wired; licence-day obligation. Build-phase exemption extends to forward leg for internal-test. | Banks Act s.11; ExCon Reg 2/3 (spot); ExCon Reg 6 (forward); SARB AD Manual |
| 2 | `credit-risk` | **Satisfied** | `implementation-attested` | Saskia | Near leg: inherited FX-spot attestation (correspondent bank credit limits, `ISDACSAAssessmentCompleted`). **Incremental delta (far leg):** forward leg creates a pre-settlement exposure for the tenor of the swap (typically 1 week–3 months). Pre-settlement risk covered by ISDA 2002 Master + CSA netting set. SA-CCR replacement cost accounts for both legs under the netting-set. Credit limits loaded cover the combined spot + forward FX exposure per counterparty. | `Policies/credit-risk-policy-v1.md`; PROC-RISK-CLM-01; BCBS SA-CCR; ISDA 2002 Close-out Netting |
| 3 | `market-risk` | **InProgress** | `design-attested` | Saskia | Near leg: inherited MR-1-FX delta (FX-spot walk §3, row 3). **Incremental delta (far leg):** forward points (swap points) risk = interest rate differential (ZARONIA vs USD SOFR) risk. Basis risk between ZARONIA and SOFR not yet in the MR-1-FX limit framework. Helena (Chief Risk Officer, governance) to extend MR-1-FX to include forward-basis risk bucket. G-2 compensating control from FX-spot extended to cover forward basis. | `Policies/market-risk-policy-v1.md`; BCBS FRTB-SA (FX + GIRR cross-gamma); BA-325 |
| 4 | `operational-risk` | **Satisfied** | `implementation-attested` | Owen | Near leg: inherited FX-spot Tomas (Correspondent banking & payments, engineering) settlement subscriber. **Incremental delta (far leg):** far-leg settlement date is a future date; the settlement instruction must be queued and dispatched at maturity. `RepoEndLegSettled` analogue is not applicable; FX swap far-leg uses a separate settlement trigger wired in PR #822. PROC-OPS-SFBCP-01 extended to cover FX swap far-leg settlement failure (counterparty fails to deliver on forward date). | PROC-OPS-SFBCP-01; SWIFT FIN MT300 (FX confirmation); ISDA 1998 FX Definitions |
| 5 | `capital-impact` | **InProgress** | `design-attested` | Saskia | Near leg: inherited FX-spot SA-CCR treatment (T+2 maturity factor ≈ minimal). **Incremental delta (far leg):** SA-CCR maturity factor increases for forward leg beyond T+2. For a 1-month FX swap: maturity factor ≈ √(1/12) ≈ 0.29; for 3-month: ≈ 0.50. FX swap capital add-on is materially higher than FX spot per unit notional. Camille (CFO, governance) to formalise FX-swap-specific capital envelope. | `Policies/capital-management-policy-v1.md`; BCBS SA-CCR §3 (maturity factor); BA-200 Regulation 25 |
| 6 | `liquidity-impact` | **InProgress** | `design-attested` | Saskia | Near leg: inherited FX-spot BA-325 LCR subscriber. **Incremental delta (far leg):** at inception, cash outflow on near leg creates a funding demand; the far leg creates a contingent future inflow. Net funding position depends on direction. CSA variation-margin calls on the forward leg's MTM (if CSA threshold breached) create an intraday liquidity demand — same open gap as FX-spot §5 and IRS. Intraday-liquidity monitor: PLANNED. | `Policies/liquidity-risk-policy-v1.md`; BA-325 LCR (FX swap treatment); ISDA CSA |
| 7 | `compliance` | **Satisfied** | `implementation-attested` | Owen | Inherited from FX-spot: PROC-MK-PCG-01 conduct substrate, `recon:persona-attribution-coherence` STRICT. **Incremental delta:** FX forward is an OTC derivative for conduct purposes — pre-trade disclosure + best-execution analysis applies to both legs. `BestExecutionAnalysisCompleted` event covers combined FX-swap transaction. | PROC-MK-PCG-01; FAIS Act 37/2002; Conduct Standard 3/2018; FMA Act 19/2012 s.5 |
| 8 | `ifrs-classification` | **Satisfied** | `implementation-attested` | Owen | Near leg: inherited FX-spot IFRS 9 treatment (FVTPL, delivery at T+2). **Incremental delta (far leg):** FX forward leg is an IFRS 9 derivative → FVTPL. Forward points MTM is posted as a derivative liability/asset. `SubLedgerPostingEmitted` on forward revaluation. Bea (Accounting & financial reporting engineer, engineering) attestation that near-spot + far-forward two-leg structure is treated as a single derivative contract under IAS 39/IFRS 9. | IFRS 9 §4.2.1; IAS 39 §9 (derivative definition); IAS 21 (FX); `Policies/accounting-policy-v1.md` |
| 9 | `tax` | **Satisfied** | `design-attested` | Owen | Inherited FX-spot: STT not applicable; VAT-exempt. **Incremental delta:** FX forward unrealised MTM gains/losses are subject to CIT under Income Tax Act s.24I (foreign currency gains/losses — mark-to-market for trading portfolio). Yael (Treasurer & Tax, engineering+governance) confirmed s.24I applies to far leg MTM; CIT deferred to revenue-commencement. | Income Tax Act 58/1962 s.24I (FX forward gains); STT Act 25/2007; VAT Act 89/1991 Schedule 1 |
| 10 | `model-risk` | **InProgress** | `design-attested` | Saskia | Near leg: inherited FX-spot tier-3 classification (SARB daily fixing). **Incremental delta (far leg):** forward rate = spot × (1 + ZAR rate) / (1 + USD rate) for the forward tenor. Implied forward model requires a ZAR OIS curve (ZARONIA) and a USD OIS curve (SOFR) — two rate curves, both requiring active maintenance. Nadia tier-2 classification for FX forward model (more complex than spot; less complex than IRS). Cross-currency basis risk not yet modelled. | `Policies/model-risk-policy-v1.md`; BCBS Model Risk Principles; ZARONIA/SOFR basis; ISDA 1998 FX Definitions |
| 11 | `technology-systems` | **Satisfied** | `implementation-attested` | Saskia | FX swap booking wired in PR #822: near leg uses `FxTradeExecuted` / `TradeBooked` substrate (inherited from FX-spot); far-leg settlement instruction queued with maturity date. `trade-book.html` FX swap panel with simulated/production provenance toggle. Product register updated (PR #821). `recon:npa-gate` STRICT passes. Forward-leg MTM revaluation via `FxPositionRevalued` (forward component). | PR #822; PR #821; `platform/event-store/event-types/fx-accounting.ts` |
| 12 | `legal-documentation` | **Satisfied** | `implementation-attested` | Owen | ISDA 2002 Master Agreement + CSA governs the FX swap (both legs as a single transaction). ISDA 1998 FX and Currency Option Definitions (or 2017 FX Definitions) govern the confirmation mechanics. Imani legal documentation G-9 close covers FX swap (same netting-set as FX spot; incremental confirmation template added). Bowmans netting opinion covers FX forward leg. | ISDA 2002 Master Agreement; ISDA 1998 FX Definitions (or 2017 update); ISDA CSA; Bowmans SA netting opinion |
| 13 | `counterparty-eligibility` | **Satisfied** | `implementation-attested` | Saskia | Inherited from FX-spot: same institutional counterparty universe (Standard Bank ZA + Investec Treasury); same LEIs; same ISDA/CSA documentation status. FX swap counterparties are a strict subset of FX-spot counterparties. No additional onboarding required for existing FX-spot counterparties. | `Regulations/_party-register.md`; `Policies/counterparty-policy-v1.md` |
| 14 | `board-notification` | **Open** | `failed` | Owen | No Board at build-phase. CEO acknowledgment via `D-NPA-FX-SWAP-INTERNAL-TEST` substitutes. | Banks Act 94/1990 s.60; Companies Act 71/2008; `project_ai_driven_bank` |

### 3.1 Tally

| Posture | Count | Dimensions |
|---|---|---|
| **Satisfied** | 8 / 14 | credit-risk, operational-risk, compliance, ifrs-classification, tax, technology-systems, legal-documentation, counterparty-eligibility |
| **InProgress** | 5 / 14 | regulatory-legal, market-risk, capital-impact, liquidity-impact, model-risk |
| **Open** | 1 / 14 | board-notification |

Gate logic: **13 cleared, 1 failed.** FX swap scores 8/5/1 — identical to FX-spot in tally, which is expected given its near-leg inheritance. The differential is in the *content* of the InProgress dimensions: capital-impact is more significant (maturity factor) and model-risk is higher-tier (forward curve) than FX spot.

## 4. Open blocker — `board-notification`

Same build-phase structural block. Internal-test perimeter: synthetic FX swaps; no real FinSurv reporting; no real correspondent instruction. Board-notifiable risk is zero.

## 5. Compensating controls active for internal-test scope

| # | Dimension | Compensating control | Production-fire re-activation trigger |
|---|---|---|---|
| 1 | regulatory-legal | Build-phase inside FinSurv ExCon build-phase exemption (Rashida ruling extended to forward FX); no live counterparty; no real ExCon Reg 6 reporting triggered | SARB banking-licence grant + ExCon Reg 6 reporting infrastructure wired + FinSurv production registration |
| 3 | market-risk | Helena G-2 extended: forward-basis cross-check vs Bloomberg swap points (>5% deviation → investigation; >15% → MRC escalation) | Helena MR-1-FX extended to forward-basis risk bucket OR separate MR-1-FX-FWD limit approved |
| 5 | capital-impact | SA-CCR PFE for 1-month FX swap at test-scenario notional (USD 1m) ≈ ZAR 50k add-on; well inside build-phase capital envelope | Camille FX swap capital envelope formalised + maturity-factor schedule calibrated |
| 6 | liquidity-impact | Internal-test: no real CSA calls; near-leg spot cash flows simulated; far-leg settlement is queued only | Intraday-liquidity monitor live (shared open item with FX-spot + IRS); NSFR treatment for FX swap wired |
| 10 | model-risk | Near leg: SARB daily fixing (inherited tier-3). Far leg: Helena cross-checks forward points vs Bloomberg market forward curve | Nadia tier-2 validation for FX forward model (ZARONIA/SOFR curves) before production |

## 6. Recommendation to CEO

Marc, the FX swap substrate inherits the full FX-spot implementation and adds a well-bounded set of incremental gaps — all on the forward leg — that are compensated for internal-test scope.

**Approve FX swap USD/ZAR for internal pre-licence test scope** under `D-NPA-FX-SWAP-INTERNAL-TEST`.

**Dependency.** `D-NPA-FX-SPOT-INTERNAL-TEST` must have been approved first (or approved concurrently). The near-leg attestations are inherited rather than re-attested here.

The three substantive production-fire gaps are:
1. **`regulatory-legal`** — ExCon Reg 6 forward-FX reporting (licence-day wall-clock, same as spot Reg 2/3).
2. **`capital-impact`** — SA-CCR maturity factor for forward leg is higher per notional than FX spot; Camille to set FX-swap-specific capital envelope.
3. **`model-risk`** — Nadia tier-2 validation for the forward-rate model (ZARONIA/SOFR forward curve construction). Less urgent than the IRS tier-1 validation but should follow it.

The intraday-liquidity monitor remains a shared open item across FX-spot, FX-swap, and IRS — a single build slice closes all three.

**If you approve `D-NPA-FX-SWAP-INTERNAL-TEST`:**
- A follow-on run emits `ProductApproved{productId:fx-swap-usdzar}`.
- FX swap booking panel in `trade-book.html` and the FX swap scenario harness are formally cleared for controlled-launch internal test.

— Saskia (Head of Global Markets / Chief Markets Officer, governance)
— concurred Owen (Company Secretary, governance)

## 7. Citations

- Procedure: PROC-NPA-GATE-01; Source policy: D-NEW-PRODUCT-APPROVAL-POLICY; D-PRODUCT-CONSTRUCTION-SUBSTRATE
- Predecessor: `D-NPA-FX-SPOT-INTERNAL-TEST` (FX-spot internal-test approval); `2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md`
- Statutes: Banks Act 94/1990; FAIS Act 37/2002; FMA Act 19/2012; ExCon Reg 2/3 (spot) + Reg 6 (forward); Income Tax Act 58/1962 s.24I; STT Act 25/2007; VAT Act 89/1991
- Standards: ISDA 2002 Master Agreement; ISDA 1998 FX Definitions; ISDA CSA; BCBS SA-CCR §3; BCBS FRTB-SA; BA-200 Regulation 25; BA-325 LCR; Conduct Standard 3/2018; SARB AD Manual
- PRs: PR #822 (FX swap booking); PR #821 (product register + NPA gate)
- Memory: `project_ai_driven_bank`, `project_strategic_foundation`, `project_product_lifecycle_npa_vs_engineering`, `project_indirect_participant_posture`
