---
title: PROC-NPA-GATE-01 first activation — SAGB fixed-coupon bond (internal pre-licence test)
author: Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)
date: 2026-05-26
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
product-id: prd:bank:bond:sagb-fixed-coupon
procedure-cited: PROC-NPA-GATE-01
decision-opened: D-NPA-SAGB-BOND-INTERNAL-TEST
citations:
  - PROC-NPA-GATE-01
  - D-NEW-PRODUCT-APPROVAL-POLICY
  - D-PRODUCT-CONSTRUCTION-SUBSTRATE
  - PR-822
  - PR-821
---

# PROC-NPA-GATE-01 — FIRST ACTIVATION for SAGB fixed-coupon bond (internal pre-licence test)

> **Posture.** First formal PROC-NPA-GATE-01 activation for `prd:bank:bond:sagb-fixed-coupon`. SAGB bond substrate (booking, coupon accrual, MTM, maturity events) was built as an M2-phase product. No `ProductApproved{productId:sagb-fixed-coupon}` event has been emitted via the canonical pipeline.
>
> **Scope.** Internal pre-licence test only — synthetic bond trades with simulated yield curves; no real JSE Bond Market connection; no real STRATE bond settlement. South African Government Bonds are the bank's primary HQLA vehicle and repo collateral pool; the internal-test perimeter exercises that function via the scenario harness.
>
> **Gate decision.** Marc (CEO) holds the decision via `D-NPA-SAGB-BOND-INTERNAL-TEST`.

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-26 |
| Product owner (initiator) | Saskia (Head of Global Markets / Chief Markets Officer, governance) |
| Procedure owner (co-author) | Owen (Company Secretary, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Product ID | `prd:bank:bond:sagb-fixed-coupon` |
| Product family | `bond` |
| Procedure | PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`) |
| Source policy | D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved) |
| Decision card opened | `D-NPA-SAGB-BOND-INTERNAL-TEST` (phase: `requested`) |
| Substrate citations | PR #822 (bond booking), PR #821 (product register + NPA gate) |

## 2. Vocabulary note

Refer to `2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md` §2 for the PROC-NPA-GATE-01 prose → typed-event alias mapping. Applies unchanged here.

## 3. The 14 dimensions — assessment table

| # | Dimension | Posture | Result enum | Attesting actor | Evidence | Citations |
|---|---|---|---|---|---|---|
| 1 | `regulatory-legal` | **InProgress** | `design-attested` | Owen | No JSE Bond Market Debt Member application filed; STRATE bond participant registration deferred to licence-day. Debt-dealer licence sub-category under FSCA not yet activated. Build-phase exemption applies for internal-test scope. | Banks Act s.11; JSE Debt Market Rules; STRATE Participant Agreement; FSCA Board Notice 58/2010 |
| 2 | `credit-risk` | **Satisfied** | `implementation-attested` | Saskia | SAGBs carry 0% risk weight under BA-200 standardised approach (sovereign ZAR-denominated debt). Pre-settlement risk on T+3 settlement window is nominal. PROC-RISK-CLM-01 credit limit framework covers the institutional counterparty (primary dealer) for settlement exposure. | `Policies/credit-risk-policy-v1.md`; PROC-RISK-CLM-01; BA-200 Regulation 23 (sovereign risk weight) |
| 3 | `market-risk` | **InProgress** | `design-attested` | Saskia | Primary risk driver is GIRR (General Interest Rate Risk): DV01/BPV sensitivity along the SAGB yield curve. MR-1-IR interest-rate delta limit proposal pending Helena (Chief Risk Officer, governance) review. Interim compensating control: daily DV01 P&L cross-check; >5% deviation triggers investigation. Convexity risk is a secondary effect at build-phase position sizes. | `Policies/market-risk-policy-v1.md`; BCBS FRTB-SA GIRR sensitivity-based method; BA-325 Reg 31 |
| 4 | `operational-risk` | **Satisfied** | `implementation-attested` | Owen | STRATE bond settlement flow wired (simulated-feed variant); T+3 settlement cycle modelled. Coupon payment calendar (semi-annual for most SAGBs) handled via `BondInterestAccrued` event. Maturity processing via `BondMatured`. Devon (Chief Operating Officer, governance) PROC-OPS-SFBCP-01 updated to cover bond settlement-failure and coupon-payment-failure scenarios. | PROC-OPS-SFBCP-01; JSE Bond Settlement Rules; STRATE Rules |
| 5 | `capital-impact` | **InProgress** | `design-attested` | Saskia | FRTB-SA GIRR sensitivity calibration pending. Note: SAGB fixed-coupon is the most capital-efficient product in the approved set — 0% credit-risk weight under standardised approach; GIRR capital charge is driven by duration bucket sensitivity, not obligor risk. MR-1-IR limit envelope will anchor the capital model. | `Policies/capital-management-policy-v1.md`; BCBS FRTB-SA GIRR risk weights (Table 1); BA-200 Regulation 23 |
| 6 | `liquidity-impact` | **Satisfied** | `implementation-attested` | Saskia | SAGBs qualify as **Level 1 HQLA** at 100% value under BA-325 LCR rules — the strongest possible HQLA classification. SAGB holdings directly strengthen the bank's LCR numerator. LCR subscriber (PR #663) updated: bond inventory projects as Level-1 HQLA buffer. NSFR: SAGBs attract 0% RSF factor (stable HQLA). | `Policies/liquidity-risk-policy-v1.md`; BA-325 LCR Schedule items 1–3; BA-325 NSFR Schedule |
| 7 | `compliance` | **Satisfied** | `implementation-attested` | Owen | Bond-market conduct standard wired; FAIS institutional conduct obligations satisfied. Market-abuse surveillance (PROC-MK-PCG-01) includes bond market trade-surveillance feed. `recon:persona-attribution-coherence` STRICT validates bond trade attribution (PR #648). No short-selling constraints flagged for SAGB outright. | PROC-MK-PCG-01; FAIS Act 37/2002 GCC; FMA Act 19/2012 s.78 (market abuse) |
| 8 | `ifrs-classification` | **Satisfied** | `implementation-attested` | Owen | SAGB bonds held in trading book: FVTPL (IFRS 9 §4.1.4 — held for trading; SPPI test moot for equity-like instruments). Hold-to-collect option would qualify (SPPI passed for fixed-coupon SAGB) but not applicable to trading book. Posting rules wired: `BondInterestAccrued` → interest income; `BondPositionRevalued` → unrealised MTM; `BondSold` → realised gain/loss. Bea (Accounting & financial reporting engineer, engineering) attestation. | IFRS 9 §4.1.1–4.1.2 (SPPI + business model); IAS 21 (ZAR domestic); `Policies/accounting-policy-v1.md` |
| 9 | `tax` | **Satisfied** | `design-attested` | Owen | **STT does not apply** to government bonds — SAGB transfers are exempt under STT Act 25/2007 Schedule 1. Interest income on SAGBs is subject to withholding tax at source (DTT for non-resident; domestic income at CIT entity level). CIT on interest deferred to revenue-commencement. Yael confirmed no STT liability for any SAGB trade. | STT Act 25/2007 Schedule 1 (exemptions); Income Tax Act 58/1962 s.37I (bond withholding tax); `Team/Yael.md` |
| 10 | `model-risk` | **Satisfied** | `implementation-attested` | Saskia | SAGB pricing via JSE Bond Market published yield curve (observable Level-2 market data). Duration-based DV01 calculation is a standard closed-form calculation, not a proprietary model. Nadia (Independent-validation engineer, engineering) tier-2/3 classification: yield-curve interpolation is standard; no internal valuation model. | `Policies/model-risk-policy-v1.md`; BCBS Model Risk Principles; IFRS 13 Level-2 hierarchy |
| 11 | `technology-systems` | **Satisfied** | `implementation-attested` | Saskia | Bond booking wired in PR #822: `BondTradeExecuted` → `TradeBooked` → coupon accrual schedule; `BondPositionRevalued` MTM; `BondMatured` at maturity. `trade-book.html` bond panel with simulated/production provenance toggle. Product register projection updated (PR #821). `recon:npa-gate` STRICT passes. | PR #822; PR #821; `dashboard/public/trade-book.html` |
| 12 | `legal-documentation` | **Satisfied** | `implementation-attested` | Owen | Outright SAGB trades governed by JSE Bond Market Rules and STRATE settlement rules — no bilateral master agreement required. For repo of SAGBs: GMRA SA Annex applies (covered separately under `prd:bank:repo:open-repo-gmra`). Imani (Chief Legal Counsel, governance) confirmed documentation perimeter closed for outright SAGB cash. | JSE Debt Market Rules; STRATE Rules; National Treasury Bond Programme prospectus |
| 13 | `counterparty-eligibility` | **Satisfied** | `implementation-attested` | Saskia | Institutional-only model. Counterparties are JSE Bond Market primary dealers (Standard Bank, Investec, FirstRand, Nedbank, Absa) — FAIS categorised professional clients. Party register entries seeded; LEIs captured. No retail counterparty eligibility required. | `Regulations/_party-register.md`; `Policies/counterparty-policy-v1.md`; National Treasury Primary Dealer Rules |
| 14 | `board-notification` | **Open** | `failed` | Owen | No Board exists at build-phase. CEO acknowledgment via `D-NPA-SAGB-BOND-INTERNAL-TEST` substitutes. | Banks Act 94/1990 s.60; Companies Act 71/2008; `project_ai_driven_bank` |

### 3.1 Tally

| Posture | Count | Dimensions |
|---|---|---|
| **Satisfied** | 10 / 14 | credit-risk, operational-risk, liquidity-impact, compliance, ifrs-classification, tax, model-risk, technology-systems, legal-documentation, counterparty-eligibility |
| **InProgress** | 3 / 14 | regulatory-legal, market-risk, capital-impact |
| **Open** | 1 / 14 | board-notification |

Gate logic (`posture !== "Open"`): **13 cleared, 1 failed.** SAGB fixed-coupon is the cleanest product in the approved set — 10 fully attested dimensions reflects the product's structural simplicity and its centrality to the bank's HQLA and funding strategy.

## 4. Open blocker — `board-notification`

Same build-phase structural block as all products. CEO acknowledgment via this decision card satisfies the substance. Internal-test perimeter has zero board-notifiable risk.

**Re-activation trigger.** Board constitution at licence-day.

## 5. Compensating controls active for internal-test scope

| # | Dimension | Compensating control | Production-fire re-activation trigger |
|---|---|---|---|
| 1 | regulatory-legal | Build-phase perimeter; no real JSE Bond Market connection or STRATE real-money bond settlement | JSE Debt Market Member approval + STRATE Participant Agreement executed |
| 3 | market-risk | Daily DV01 P&L cross-check (>5% deviation → investigation; >15% → MRC escalation); Helena to formalise MR-1-IR delta limit proposal | Helena MR-1-IR approved (CEO interim-authority or BRC tabling) |
| 5 | capital-impact | FRTB-SA GIRR capital for SAGB is the lowest in the product set; estimated <0.2% of target capital at test-scenario DV01; Camille to formalise | Camille capital plan resolution + Nadia FRTB-SA GIRR validation |

## 6. Recommendation to CEO

Marc, SAGB fixed-coupon is the bank's most capital-efficient and operationally straightforward product, and its substrate is the most complete.

**Approve SAGB fixed-coupon for internal pre-licence test scope** under `D-NPA-SAGB-BOND-INTERNAL-TEST`.

**10 Satisfied / 3 InProgress / 1 Open.** The only substantive production-fire gap is JSE Debt Market Member registration (wall-clock, licence-application timeline) and the MR-1-IR interest-rate delta limit. No tax complexity (STT exempt); accounting is clean; HQLA classification is the highest possible. SAGBs underpin the repo book and the LCR buffer — approving them here enables the full treasury and collateral strategy.

**If you approve `D-NPA-SAGB-BOND-INTERNAL-TEST`:**
- A follow-on run emits `ProductApproved{productId:sagb-fixed-coupon}`.
- Bond booking panel in `trade-book.html` and scenario harness are formally cleared for controlled-launch internal test.

— Saskia (Head of Global Markets / Chief Markets Officer, governance)
— concurred Owen (Company Secretary, governance)

## 7. Citations

- Procedure: PROC-NPA-GATE-01; Source policy: D-NEW-PRODUCT-APPROVAL-POLICY; D-PRODUCT-CONSTRUCTION-SUBSTRATE
- Statutes: Banks Act 94/1990; Companies Act 71/2008; FAIS Act 37/2002; STT Act 25/2007 Schedule 1; Income Tax Act 58/1962 s.37I; FMA Act 19/2012
- Standards: JSE Debt Market Rules; STRATE Rules; BCBS FRTB-SA (GIRR); National Treasury Primary Dealer Rules
- PRs: PR #822 (bond booking); PR #821 (product register + NPA gate)
- Memory: `project_ai_driven_bank`, `project_strategic_foundation`, `project_product_lifecycle_npa_vs_engineering`
