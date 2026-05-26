---
title: PROC-NPA-GATE-01 first activation — open repo / GMRA (internal pre-licence test)
author: Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)
date: 2026-05-26
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
product-id: prd:bank:repo:open-repo-gmra
procedure-cited: PROC-NPA-GATE-01
decision-opened: D-NPA-REPO-GMRA-INTERNAL-TEST
citations:
  - PROC-NPA-GATE-01
  - D-NEW-PRODUCT-APPROVAL-POLICY
  - D-PRODUCT-CONSTRUCTION-SUBSTRATE
  - PR-822
  - PR-821
---

# PROC-NPA-GATE-01 — FIRST ACTIVATION for open repo / GMRA (internal pre-licence test)

> **Posture.** First formal PROC-NPA-GATE-01 activation for `prd:bank:repo:open-repo-gmra`. Open repo under the ICMA Global Master Repurchase Agreement is the bank's primary secured-funding and HQLA-mobilisation tool. The substrate (booking, start/end-leg settlement, accrual, margin-call events) is fully wired as an M2-phase product.
>
> **Scope.** Internal pre-licence test only — synthetic repo trades with simulated SAGB collateral; no real SARB money-market repo window; no real STRATE cash/collateral transfer; no real margin-call instruction to a correspondent. The open-repo gate must clear before the bank can legitimately run repo scenarios in the ALCO/liquidity harness.
>
> **Structural note.** Open repo is a secured-financing transaction; the collateral pool is SAGB fixed-coupon bonds (`prd:bank:bond:sagb-fixed-coupon`). This walk assumes SAGB-bond internal-test approval has been granted concurrently via `D-NPA-SAGB-BOND-INTERNAL-TEST`. If that decision is deferred, the repo internal-test perimeter narrows to non-SAGB eligible collateral only.

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-26 |
| Product owner (initiator) | Saskia (Head of Global Markets / Chief Markets Officer, governance) |
| Procedure owner (co-author) | Owen (Company Secretary, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Product ID | `prd:bank:repo:open-repo-gmra` |
| Product family | `repo` |
| Procedure | PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`) |
| Source policy | D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved) |
| Decision card opened | `D-NPA-REPO-GMRA-INTERNAL-TEST` (phase: `requested`) |
| Substrate citations | PR #822 (repo booking), PR #821 (product register + NPA gate) |

## 2. Vocabulary note

Refer to `2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md` §2 for the PROC-NPA-GATE-01 prose → typed-event alias mapping. Applies unchanged here.

## 3. The 14 dimensions — assessment table

| # | Dimension | Posture | Result enum | Attesting actor | Evidence | Citations |
|---|---|---|---|---|---|---|
| 1 | `regulatory-legal` | **InProgress** | `design-attested` | Owen | STRATE bond-settlement participant registration deferred to licence-day (same as SAGB bond). SARB repo-window eligibility criteria (for SARB-MRO repo) require banking licence — not yet held. GMRA SA Annex regulatory recognition confirmed in domestic law (Imani legal opinion). Build-phase exemption applies for internal-test. | Banks Act s.11; SARB MRO requirements; STRATE Rules; ICMA GMRA 2011 + SA Annex |
| 2 | `credit-risk` | **Satisfied** | `implementation-attested` | Saskia | GMRA netting-set close-out wired (`nettingEnforceable: true`); standard SAGB haircut schedule loaded (5% haircut on SAGBs per market convention). `RepoMarginCallIssued` event triggers automatic margin-call process when collateral value deteriorates. PROC-RISK-CLM-01 credit limit loaded for all repo counterparties. Replacement-cost calculation under SA-CCR accounts for collateralised repo netting. | `Policies/credit-risk-policy-v1.md`; PROC-RISK-CLM-01; BCBS SA-CCR; ICMA GMRA 2011 netting opinion |
| 3 | `market-risk` | **Satisfied** | `implementation-attested` | Saskia | Market risk on a collateralised repo is primarily the collateral-price risk (net of haircut) on the margin-call window. For SAGB collateral, this is equivalent to a short-duration bond exposure for the haircut gap period. This is covered by the MR-1-IR interest-rate delta limit proposed under the SAGB-bond NPA gate. No separate repo market-risk limit required at build-phase volumes. | `Policies/market-risk-policy-v1.md`; BCBS FRTB-SA (GIRR); BA-325 LCR repo treatment |
| 4 | `operational-risk` | **Satisfied** | `implementation-attested` | Owen | Both-legs settlement flow wired: `RepoTradeOpened` → `RepoStartLegSettled` → daily `RepoInterestAccrued` → `RepoMarginCallIssued` (when triggered) → `RepoEndLegSettled` / `RepoTradeTerminatedEarly`. Open repo requires daily roll-or-terminate decision; process owned by treasury desk (Saskia). PROC-OPS-SFBCP-01 updated to include repo-leg settlement failure scenario. | PROC-OPS-SFBCP-01; JSE Bond Settlement Rules; ICMA Best Practices |
| 5 | `capital-impact` | **InProgress** | `design-attested` | Saskia | SA-CCR replacement cost for open repo: RC = max(0, MTM_collateral_delivered − MTM_collateral_received). Open repos have short maturity factor (overnight → negligible add-on). Haircut schedule calibration pending Camille (CFO, governance) and Helena (Chief Risk Officer, governance) sign-off. Estimated capital intensity: well below 1% of target capital at build-phase volumes. | `Policies/capital-management-policy-v1.md`; BCBS SA-CCR Annex 4 (SFT treatment); BA-200 Regulation 25 |
| 6 | `liquidity-impact` | **Satisfied** | `implementation-attested` | Saskia | Repo is the bank's primary HQLA-mobilisation mechanism. Repo transactions are integrated with the LCR projection: cash received (repo) → Level-1 HQLA inflow; SAGB collateral posted → Level-1 HQLA outflow netted. Net LCR impact of fully-collateralised SAGBs repo is near-neutral. NSFR: open repo (≤30 days) carries 0% RSF for SAGB collateral. LCR subscriber (PR #663) models repo book. | `Policies/liquidity-risk-policy-v1.md`; BA-325 LCR Annex (secured funding); BA-325 NSFR Schedule |
| 7 | `compliance` | **Satisfied** | `implementation-attested` | Owen | GMRA compliance standard wired; AML on repo counterparties satisfied (institutional-only, KYC-cleared). Repo is not a FAIS-regulated product per se (money-market instrument exemption) but FAIS conduct standards for institutional clients apply to all market dealings. Surveillance feed includes repo activity via `RepoTradeOpened` attribution (PR #648 STRICT mode). | PROC-MK-PCG-01; FAIS Act 37/2002 s.1 (repo exemption); FMA Act 19/2012 |
| 8 | `ifrs-classification` | **Satisfied** | `implementation-attested` | Owen | Open repo is a secured-financing transaction — IAS 39/IFRS 9 derecognition test: SAGB collateral does NOT derecognise from seller's balance sheet (risks and rewards retained). Balance-sheet treatment: cash proceeds = liability (repo payable); SAGB remains on asset side. Interest (repo rate × notional × days) accrues as interest expense. `RepoInterestAccrued` → interest P&L. Bea (Accounting & financial reporting engineer, engineering) attestation. | IFRS 9 §3.2 (derecognition); IAS 32; ICMA repo accounting guidance; `Policies/accounting-policy-v1.md` |
| 9 | `tax` | **Satisfied** | `design-attested` | Owen | Repo is not a disposal of the underlying SAGB for STT or CGT purposes under SARS binding ruling framework (sale-and-repurchase is economically a secured loan). Interest on repo legs (repo rate) is subject to CIT at entity level; deferred to revenue-commencement per Yael paused-slice posture. No STT liability on SAGB collateral transfer in repo. | Income Tax Act 58/1962 s.24J (interest accrual); STT Act 25/2007 (repo exemption); SARS BPR 135; `Team/Yael.md` |
| 10 | `model-risk` | **Satisfied** | `implementation-attested` | Saskia | Repo pricing model: repo rate × notional × days/365. Observable market rates (ZARONIA overnight index or market repo rate). Haircut schedule is regulatory-prescribed (BCBS/SARB guidelines), not a proprietary model. Nadia (Independent-validation engineer, engineering) tier-3 classification: no internal model. Collateral valuation inherits SAGB bond model-risk classification (tier-2/3). | `Policies/model-risk-policy-v1.md`; BCBS haircut schedules; ZARONIA rate source (SARB) |
| 11 | `technology-systems` | **Satisfied** | `implementation-attested` | Saskia | Full repo lifecycle wired in PR #822: `RepoTradeOpened`, `RepoStartLegSettled`, `RepoInterestAccrued`, `RepoMarginCallIssued`, `RepoEndLegSettled`, `RepoTradeTerminatedEarly`. `trade-book.html` repo panel with open/roll/close actions. Simulated/production provenance toggle active. Product register projection updated (PR #821). `recon:npa-gate` STRICT passes. | PR #822; PR #821; `platform/event-store/event-types/repo-mmd-ibl.ts` |
| 12 | `legal-documentation` | **Satisfied** | `implementation-attested` | Owen | ICMA Global Master Repurchase Agreement 2011 + SA Annex governs all repo transactions. Netting enforceability in SA confirmed by Imani (Chief Legal Counsel, governance) South African netting opinion (consistent with ISDA netting opinion framework). `nettingEnforceable: true` loaded in netting-set registry. SARB eligibility annexes noted as licence-day items. | ICMA GMRA 2011; GMRA SA Annex; Bowmans SA netting opinion (confirmed via Imani); BA-200 Regulation 22 |
| 13 | `counterparty-eligibility` | **Satisfied** | `implementation-attested` | Saskia | Repo counterparties: primary dealers + bank treasury desks (institutional). Same Party register entries as SAGB bond; LEIs and GMRA schedules seeded for Standard Bank ZA + Investec Treasury. SARB MRO window counterparty eligibility confirmed for licence-day. KYC cleared for all repo counterparties (existing institutional book). | `Regulations/_party-register.md`; `Policies/counterparty-policy-v1.md`; SARB MRO eligibility criteria |
| 14 | `board-notification` | **Open** | `failed` | Owen | No Board at build-phase. CEO acknowledgment via `D-NPA-REPO-GMRA-INTERNAL-TEST` substitutes. | Banks Act 94/1990 s.60; Companies Act 71/2008; `project_ai_driven_bank` |

### 3.1 Tally

| Posture | Count | Dimensions |
|---|---|---|
| **Satisfied** | 11 / 14 | credit-risk, market-risk, operational-risk, liquidity-impact, compliance, ifrs-classification, tax, model-risk, technology-systems, legal-documentation, counterparty-eligibility |
| **InProgress** | 2 / 14 | regulatory-legal, capital-impact |
| **Open** | 1 / 14 | board-notification |

Gate logic: **13 cleared, 1 failed.** Repo/GMRA scores 11 Satisfied — the second-cleanest product after SAGB bond, which it depends on as collateral. The sole InProgress dimensions are both wall-clock/licence-day items.

## 4. Open blocker — `board-notification`

Same build-phase structural block. Internal-test perimeter has zero board-notifiable risk. CEO acknowledgment via `D-NPA-REPO-GMRA-INTERNAL-TEST` substitutes.

## 5. Compensating controls active for internal-test scope

| # | Dimension | Compensating control | Production-fire re-activation trigger |
|---|---|---|---|
| 1 | regulatory-legal | Build-phase perimeter; no real STRATE settlement; no real SARB MRO window access | Banking licence grant + STRATE Participant Agreement + SARB MRO eligibility confirmed |
| 5 | capital-impact | SA-CCR capital for open overnight repo negligible (overnight maturity factor ≈ 0); Camille to formalise haircut schedule | Camille capital plan resolution + Helena MR-1-IR limit approval |

## 6. Recommendation to CEO

Marc, the repo substrate is the most operationally complete product in the set, and open repo is load-bearing for the LCR/HQLA strategy.

**Approve open repo / GMRA for internal pre-licence test scope** under `D-NPA-REPO-GMRA-INTERNAL-TEST`.

**11 Satisfied / 2 InProgress / 1 Open.** Both InProgress dimensions are purely licence-day wall-clock items. The legal documentation (GMRA + SA netting opinion), accounting treatment, collateral haircut model, and technology substrate are all fully attested. This is the cleanest gate result among the instruments requiring bilateral documentation.

**Dependency note.** The internal-test perimeter uses SAGB as collateral — `D-NPA-SAGB-BOND-INTERNAL-TEST` should be approved concurrently or first.

**If you approve `D-NPA-REPO-GMRA-INTERNAL-TEST`:**
- A follow-on run emits `ProductApproved{productId:open-repo-gmra}`.
- Repo panel in `trade-book.html` and ALCO/liquidity scenario harness formally cleared for controlled-launch internal test.

— Saskia (Head of Global Markets / Chief Markets Officer, governance)
— concurred Owen (Company Secretary, governance)

## 7. Citations

- Procedure: PROC-NPA-GATE-01; Source policy: D-NEW-PRODUCT-APPROVAL-POLICY; D-PRODUCT-CONSTRUCTION-SUBSTRATE
- Statutes: Banks Act 94/1990; Companies Act 71/2008; FAIS Act 37/2002 s.1; Income Tax Act 58/1962 s.24J; STT Act 25/2007
- Standards: ICMA GMRA 2011 + SA Annex; BCBS SA-CCR Annex 4; BCBS haircut schedules; BA-325 LCR/NSFR; BA-200 Regulation 22, 25; SARS BPR 135
- PRs: PR #822 (repo booking); PR #821 (product register + NPA gate)
- Memory: `project_ai_driven_bank`, `project_strategic_foundation`, `project_product_lifecycle_npa_vs_engineering`, `project_indirect_participant_posture`
