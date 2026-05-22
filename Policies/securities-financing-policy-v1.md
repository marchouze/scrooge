---
policy-id: securities-financing-policy
title: Securities Financing Transactions Policy v1
version: "1"
status: IN FORCE
owner: Saskia (Head of Global Markets, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990
  - Regulations Relating to Banks reg.32 (SFT capital treatment)
  - Basel III leverage ratio framework (January 2014) — SFT netting
  - ISDA GMRA (Global Master Repurchase Agreement — 2011 version)
  - ISDA GMSLA (Global Master Securities Lending Agreement — 2010 version)
  - Exchange Control Regulations (Currency and Exchanges Act 9 of 1933) — cross-border SFTs
  - JSE equity repo market conventions
  - STRATE settlement rules (CSD rules for SA)
  - BCBS Basel III leverage ratio (January 2014; revised 2017) — SFT netting and add-on
author: Saskia (Head of Global Markets, governance) + Eitan (Treasurer, governance) + Imani (Legal-as-code engineer, engineering)
date: 2026-05-22
summary: Securities Financing Transactions Policy covering SFT taxonomy, permitted purposes (liquidity buffer, short-cover, franchise only), GMRA/GMSLA legal requirement, initial margin floors by asset class, variation margin, leverage ratio, CCR treatment, open vs term governance, SARB reporting, and repo book limit. COMMENCEMENT-BIND.
decision-required: false
riskTaxonomy:
  - RT-LR
  - RT-CR
  - RT-CCR
---

# Securities Financing Transactions Policy v1

> **Authors.** Saskia (Head of Global Markets, governance) — lead; Eitan (Treasurer, governance) — co-author; Imani (Legal-as-code engineer, engineering) — co-author.
> **Status.** COMMENCEMENT-BIND. SFTs are transacted from the first day of trading book operations.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Securities Financing Transactions Policy — Overarching

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) for SFT framework; ALCO for repo book limit; Saskia for individual SFTs within approved parameters · **Cadence:** Annual policy review; ALCO oversight monthly; individual SFT approval as per §6 · **Citation:** Banks Act 94 of 1990 + Regulations Relating to Banks reg.32 + Basel III leverage ratio (2014) + ISDA GMRA (2011) + ISDA GMSLA (2010)

### Purpose

This policy governs the origination, management, and governance of Securities Financing Transactions (SFTs) at Hoz Bank Limited. SFTs are financial transactions in which securities are exchanged for cash or other securities with an agreement to reverse the transaction at a future date — including repos, reverse repos, sell/buy-backs, stock borrowing, and stock lending.

The policy ensures that: (i) SFTs are conducted only for the permitted purposes defined in §3; (ii) every SFT with a counterparty is governed by an executed GMRA (for repo/sell-buy-back) or GMSLA (for stock borrow/lend) before the first transaction; (iii) initial margin floors are applied consistently; (iv) the SFT portfolio does not create unmanaged concentration or leverage risk; (v) CCR and leverage ratio exposures from SFTs are accurately captured in the capital framework; and (vi) ALCO has oversight of the aggregate SFT book through the repo book limit.

SFTs are used by the Bank in two contexts: Treasury SFTs (Eitan's mandate — liquidity buffer management, using the HQLA portfolio per `Policies/treasury-investment-policy-v1.md` §9) and Trading desk SFTs (Saskia's mandate — client short-cover facilitation, franchise activities). Both are governed by this policy; Treasury SFTs are operationally managed by Ravi (Treasury/ALM engineer, engineering) and Trading desk SFTs by the trading desk under Saskia.

### Principles

- **Permitted purposes only.** SFTs are originated only for the permitted purposes in §3. No speculative repo book (buying securities cheap and funding them in repo to profit from the carry) is permitted. All SFT positions must be attributable to a permitted purpose; unexplained SFT positions are a conduct red alert (per `Policies/conduct-risk-policy-v1.md` MR-5 no-prop rule cross-reference).
- **GMRA/GMSLA as the mandatory legal framework.** No SFT is executed with a counterparty unless a GMRA (for repo/sell-buy-back) or GMSLA (for stock borrow/lend) is in force. Imani maintains the executed agreement register. Without an executed agreement, the close-out netting right under the ISDA framework is not available, and the CCR capital treatment deteriorates to gross exposure.
- **Initial margin floors are minimum floors, not targets.** The haircut floors in §4 are the minimum margins the Bank accepts. Eitan or Saskia may negotiate higher margins for counterparties with lower credit quality or for instruments with higher price volatility. Floors may not be reduced below the schedule in §4 without ALCO approval.
- **Events-first SFT management.** Every SFT (open, close, margin call) is a typed event in the event log. The SFT book, leverage ratio contribution, and CCR EAD from SFTs are queries over those events. Ravi and the trading systems team implement the SFT event schema per the trade lifecycle specification.
- **ALCO oversight is continuous.** The SFT book is a standing ALCO agenda item. Eitan presents the SFT repo book utilisation (vs. the repo book limit in §7) and the SFT contribution to leverage and LCR monthly.

### Roles

Saskia (Head of Global Markets, governance) is the policy owner for the trading desk SFT function. Eitan (Treasurer, governance) is the co-owner for the Treasury SFT function and chairs ALCO. Imani (Legal-as-code engineer, engineering) maintains the GMRA/GMSLA agreement register and provides legal opinions on close-out netting enforceability. Rohan (Market risk quantitative engineer, engineering — reports to Helena (Chief Risk Officer, governance)) computes the CCR capital treatment for SFTs under SA-CCR. Ravi (Treasury/ALM engineer, engineering — reports to Eitan) builds the SFT booking and event emission infrastructure and computes the SFT contribution to the leverage ratio. Camille (Chief Financial Officer, governance) integrates the leverage ratio and CCR RWA contributions from SFTs into the BA-returns.

---

## 2. SFT Taxonomy

**Owner:** Saskia (Head of Global Markets, governance) · **Cadence:** Taxonomy is stable; new SFT types require Tier 1 NPA process (§ of `Policies/new-product-approval-policy-v1.md`) · **Citation:** ISDA GMRA (2011); ISDA GMSLA (2010); STRATE rules

| SFT type | Description | Governing agreement | Direction |
|---|---|---|---|
| Classic repo | Bank sells securities and agrees to repurchase them at a future date at a specified repurchase price. Bank receives cash; counterparty receives collateral. | GMRA | Bank = repo seller (cash borrower; securities collateral provider) |
| Reverse repo | Bank buys securities and agrees to resell them at a future date. Bank provides cash; counterparty provides collateral. | GMRA | Bank = repo buyer (cash lender; collateral receiver) |
| Sell/buy-back | Simultaneous spot sale and forward purchase of the same securities; economically equivalent to a classic repo but structured as two separate transactions. | GMRA or bilateral confirmation | Bank can be either leg |
| Stock borrow (Bank borrows securities) | Bank borrows securities from a counterparty against collateral (cash or securities). Used to cover a short trading-book position. | GMSLA | Bank = borrower (delivers collateral; receives securities) |
| Stock lend (Bank lends securities) | Bank lends securities from its HQLA portfolio to a counterparty against collateral. | GMSLA | Bank = lender (delivers securities; receives collateral) — subject to `Policies/treasury-investment-policy-v1.md` §9 restrictions |

---

## 3. Permitted SFT Purposes

**Owner:** Saskia (Head of Global Markets, governance) + Eitan (Treasurer, governance) · **Approval:** Eitan for Treasury SFTs; Saskia for trading desk SFTs; ALCO for aggregate SFT book · **Citation:** `Policies/trading-mandate-v1.md` (no speculative repo book)

SFTs are permitted only for the following purposes:

### 3.1 Liquidity Buffer Management (Treasury mandate — Eitan)

The Bank may repo out HQLA instruments (SAGBs, SARB debentures) to raise short-term cash liquidity, where the Bank's LCR survival horizon requires additional liquidity. The repo is a liability of the Bank; the HQLA instruments are temporarily unavailable for the LCR buffer during the repo term. Treasury SFTs must not reduce the Bank's LCR below 110% (internal floor, per `Policies/liquidity-risk-management-policy-v1.md`).

### 3.2 Short-Cover (Trading desk mandate — Saskia)

The Bank may borrow securities via stock borrow (GMSLA) to cover a short position in the trading book arising from legitimate client facilitation activities (short sale on behalf of a client who wishes to execute a short). Short-cover SFTs are directly attributable to a client order; no standing short position is built without a corresponding client mandate.

### 3.3 Franchise-Client Facilitation (Trading desk mandate — Saskia)

The Bank may act as repo intermediary for institutional clients that need to repo their securities portfolios for liquidity (reverse repo — Bank provides cash; client provides collateral). These franchise SFTs are booked as matched-book repos (the Bank simultaneously does a reverse repo with the client and a repo with another market participant to offset the funding), or funded within the Bank's own balance sheet capacity. Unmatched client reverse repos require ALCO approval before execution.

### 3.4 Prohibited: Speculative Repo Book

A speculative repo book — purchasing securities with the intent of funding them in repo to profit from the carry spread — is explicitly prohibited. This is a proprietary trading activity inconsistent with the Bank's franchise-only mandate (`Policies/trading-mandate-v1.md` §2 no-prop principle). Any SFT book position that is not attributable to a permitted purpose is flagged as a potential no-prop breach and reported to Helena and Saskia within 1 business day.

---

## 4. Initial Margin (Haircut) Floors by Asset Class

**Owner:** Eitan (Treasurer, governance) + Helena (Chief Risk Officer, governance) for methodology · **Approval:** ALCO approves haircut schedule; updates require ALCO approval · **Cadence:** Haircut schedule reviewed at least annually; ad hoc on market volatility spikes · **Citation:** BCBS minimum haircut standards for non-centrally cleared SFTs (Basel III framework)

The following initial margin (haircut) floors apply to all SFTs as the minimum collateral buffer the Bank accepts (as repo buyer or securities lender) or posts (as repo seller or securities borrower):

| Collateral / security type | Minimum haircut (% of market value) |
|---|---|
| SA Government Bonds (SAGBs) — residual maturity ≤ 1 year | 0.5% |
| SA Government Bonds (SAGBs) — residual maturity 1–5 years | 1.5% |
| SA Government Bonds (SAGBs) — residual maturity 5–10 years | 3.0% |
| SA Government Bonds (SAGBs) — residual maturity > 10 years | 5.0% |
| SA Government-guaranteed bonds (Level 2A) | Add 1% to corresponding SAGB maturity bucket |
| JSE-listed SA corporate bonds (investment grade) | 8.0% |
| JSE-listed SA equities (large cap, JSE Top 40) | 15.0% |
| JSE-listed SA equities (mid and small cap) | 20.0% |
| Hard currency (USD, EUR, GBP) cash collateral | 8.0% FX haircut |
| Non-SA securities (approved counterparties only) | Minimum 10%; plus country risk add-on per country risk tier |

These haircut floors may be increased by Eitan or Saskia for specific counterparties based on credit quality or instrument liquidity. Haircut floors may not be reduced below the schedule without ALCO approval and a `SftHaircutFloorAmended { instrumentType, priorFloor, newFloor, alcoRef }` event.

---

## 5. Variation Margin and Daily MTM

**Owner:** Ravi (Treasury/ALM engineer, engineering) + the trading desk operations team · **Approval:** Eitan approves operational variation margin procedures · **Cadence:** Daily MTM; variation margin calls as required · **Citation:** ISDA GMRA (2011) §4 (margin maintenance); ISDA GMSLA (2010) §5.5 (margin requirements)

All SFTs are subject to daily mark-to-market. Variation margin calls are triggered when the market value of the collateral falls below the minimum margin maintenance threshold defined in the individual GMRA or GMSLA agreement:

- **Classic repo / reverse repo (GMRA):** margin is maintained at the initial margin (haircut) floor. If the market value of the collateral security moves such that the margin ratio falls below the haircut floor by more than the minimum transfer amount (MTA) specified in the GMRA, a margin call is issued within the same business day.
- **Stock borrow / lend (GMSLA):** same daily MTM and margin maintenance logic under the GMSLA.

Variation margin calls that are not satisfied within the GMRA/GMSLA prescribed timeframe (typically T+1) are escalated to Eitan and Helena within 4 hours of the missed deadline. An unsatisfied margin call is a potential counterparty default signal; Helena reviews for CCR limit implications (per `Policies/counterparty-credit-risk-policy-v1.md`).

---

## 6. Leverage Ratio Treatment

**Owner:** Ravi (Treasury/ALM engineer, engineering) + Camille (Chief Financial Officer, governance) · **Approval:** ALCO monitors leverage ratio contribution from SFTs · **Cadence:** Daily leverage ratio monitoring; monthly BA-return · **Citation:** Basel III leverage ratio (January 2014, revised 2017) — SFT netting and add-on; Regulations Relating to Banks (leverage ratio return)

Under the Basel III leverage ratio framework, SFT assets may be netted against SFT liabilities where:
1. The SFTs are with the same counterparty.
2. The SFTs have the same settlement date.
3. The SFTs are subject to a master netting agreement (GMRA or GMSLA) that satisfies the Basel III leverage ratio netting criteria.
4. The Bank does not have a right of rehypothecation over the cash received under the repo (or, if it has a right of rehypothecation, the haircut-adjusted value of rehypothecable cash is excluded from netting).

The residual gross leverage exposure from SFTs (after netting) contributes to the Basel III leverage ratio exposure measure. Ravi computes the SFT contribution to the leverage ratio daily. A `LeverageRatioSftComponentComputed { date, sftGrossExposure, nettingBenefit, residualExposure }` event is the canonical record.

---

## 7. CCR Treatment Under SA-CCR

**Owner:** Rohan (Market risk quantitative engineer, engineering) · **Approval:** Helena (Chief Risk Officer, governance) · **Cadence:** Daily CCR computation; monthly BA-return integration · **Citation:** BCBS SA-CCR (April 2019) — SFT treatment; Regulations Relating to Banks reg.32

SFTs (repos, reverse repos, stock borrow/lend) are subject to CCR capital under the SA-CCR framework. The SA-CCR EAD for SFTs follows the BCBS simplified formula for SFTs where the counterparty is not a QCCP:

```
EAD (SFT) = max(RC + PFE_SFT, 0)
```

Where:
- **RC (Replacement Cost)** = fair value of collateral received minus fair value of securities posted (adjusted for eligible netting).
- **PFE_SFT** = a scaled potential future exposure add-on based on the residual maturity of the SFT and the volatility of the collateral per the BCBS SA-CCR SFT add-on formula.

Rohan integrates the SFT CCR EAD into the daily `CcrExposureComputed` events alongside the OTC derivative CCR EADs. The combined CCR EAD per counterparty (OTC derivatives + SFTs) is checked against the single-counterparty CCR limit in `Procedures/by-policy/ccr-limit-monitoring.md`.

---

## 8. Open Term vs Term Repo Governance

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO approves the open-term repo utilisation limit · **Cadence:** ALCO monthly; daily monitoring by Ravi · **Citation:** Basel III LCR (January 2013) — open-term repo funding stability

Open-term repos (repos with no fixed term, callable on one day's notice) create roll-risk: the counterparty may refuse to roll the repo, requiring the Bank to find replacement funding on short notice. The Bank manages open-term repo exposure through:

- **Maximum open-term utilisation:** ALCO sets a maximum percentage of the repo book that may be in open-term transactions; this limit is maintained in `Procedures/by-policy/sft-repo-monitoring.md`. The default maximum is 30% of the repo book.
- **Tenor distribution:** Ravi monitors the term profile of all repos daily; the weighted average remaining maturity of the repo book must be ≥ 7 days at all times.
- **Counterparty roll-risk:** The concentration of open-term repos with any single counterparty must not exceed 10% of total repo book funding; Helena reviews this monthly.

Term repos (fixed-maturity) with maturities > 30 days are treated as stable funding for NSFR purposes. Eitan prefers term repos for liquidity buffer management for this reason; open-term repos are used only for short-term tactical liquidity adjustments.

---

## 9. SARB Reporting

**Owner:** Camille (Chief Financial Officer, governance) + Owen (Company Secretary, governance) · **Approval:** Camille · **Cadence:** Quarterly if SARB reporting threshold is triggered; otherwise annual in BA-returns · **Citation:** Banks Act 94 of 1990 (SARB reporting obligations); SARB BA-return suite (BA-360 or equivalent for SFTs `[citation: TBC — Imani confirms applicable BA-return sub-table for SFT reporting]`)

At commencement-of-trading scale, the Bank's SFT book is expected to be modest in absolute terms. SARB reporting of SFTs is included in the relevant BA-return sub-tables (BA-360 or equivalent). Owen confirms the specific reporting obligations with Imani at the licence-application stage. A `SftRegulatoryReturnFiled { period, returnType, totalRepoBook, sftCcrEad }` event is the canonical record of each filing.

---

## 10. Repo Book Limit and ALCO Oversight

**Owner:** Eitan (Treasurer, governance) · **Approval:** ALCO approves repo book limit; CEO approves increases above the initial approved limit · **Cadence:** Daily monitoring by Ravi; monthly ALCO oversight · **Citation:** Banks Act 94 of 1990; `Policies/liquidity-risk-management-policy-v1.md` (LCR stability)

ALCO sets the aggregate repo book limit — the maximum aggregate notional of all outstanding repos (Bank as repo seller) and reverse repos (Bank as repo buyer) combined. The repo book limit is calibrated to:
1. The LCR impact of the repo book (repos reduce the HQLA buffer; reverse repos increase it).
2. The leverage ratio headroom available for SFT exposure.
3. The CCR limit headroom available for SFT CCR EAD.
4. The funding concentration limits in `Policies/asset-liability-management-policy-v1.md` §3.

The initial repo book limit is set at ALCO before commencement of trading and recorded in `Procedures/by-policy/sft-repo-monitoring.md`. A `RepoBookLimitBreached { currentNotional, limit }` event triggers ALCO review within 2 business days.

---

## 11. Substrate Dependencies and Gaps

- **SFT booking and event emission (Ravi + trading systems team).** Automated SFT event emission (`SftOpened`, `SftMarginCalled`, `SftClosed`, `SftDefaulted`) from the booking system. Discharge exit signal: first SFT event pair on commencement of trading.
- **GMRA/GMSLA agreement execution (Imani).** All repo and securities lending counterparties must have executed agreements before the first SFT. Imani maintains the executed agreement register.
- **Leverage ratio SFT computation (Ravi + Camille).** Daily SFT leverage ratio contribution calculation. Currently in build phase; required before first SFT.
- **SA-CCR SFT add-on (Rohan).** SFT CCR EAD computation integrated into the SA-CCR engine. Currently in build phase.

---

## 12. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Saskia (Head of Global Markets, governance) + Eitan (Treasurer, governance) + Imani (Legal-as-code engineer, engineering) | Initial policy authored. Ten sections: (1) Overarching — permitted purposes only, GMRA/GMSLA requirement, haircut floors, events-first, ALCO oversight; (2) SFT Taxonomy — classic repo, reverse repo, sell/buy-back, stock borrow, stock lend; (3) Permitted SFT Purposes — liquidity buffer management, short-cover, franchise client facilitation; prohibited speculative repo book; (4) Initial Margin Floors — asset-class haircut table (SAGBs by maturity, corporate bonds, equities, FX); (5) Variation Margin and Daily MTM — GMRA/GMSLA maintenance trigger, missed call escalation; (6) Leverage Ratio Treatment — Basel III SFT netting conditions, residual exposure; (7) CCR Treatment Under SA-CCR — EAD formula for SFTs, integration with OTC derivative CCR; (8) Open Term vs Term Repo Governance — 30% open-term cap, 7-day WAM floor; (9) SARB Reporting — BA-return obligations; (10) Repo Book Limit and ALCO Oversight — limit calibration factors, breach event. COMMENCEMENT-BIND. |
