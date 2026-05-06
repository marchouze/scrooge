# Role brief — Treasury / ALM engineer

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan

## 1. Role title and one-line purpose

**Treasury / ALM engineer** — runs the bank's balance sheet: funding, liquidity, interest-rate and FX positioning, collateral, and Funds Transfer Pricing (FTP); distinct from Rohan, who *measures* risk, this role *manages* it.

## 2. Why this role exists

Risk measurement and balance-sheet management are different mandates. Rohan computes IFRS 9 ECL, market-risk sensitivities, ICAAP / ILAAP capital and liquidity assessments, and operational-risk telemetry. Treasury *runs the book* against those measures: chooses funding, sets internal pricing, manages liquidity buffers, hedges, and posts/receives collateral. In a SARB-regulated bank the LCR (BA 325), NSFR (BA 326), reserving, and the SAMOS settlement-account funding sit in this seat. Without it, the bank cannot operate end-of-day.

## 3. Scope of work (priority order)

1. **Funding and liquidity operations.** Wholesale funding, deposit-funding strategy, intraday liquidity, SARB SAMOS settlement-account funding, contingency funding plan execution.
2. **Liquidity ratios.** Daily LCR (BA 325), NSFR (BA 326), HQLA composition, LCR-by-currency monitoring; liquidity stress testing aligned with ILAAP.
3. **Interest-rate risk in the banking book (IRRBB).** Repricing-gap, EVE and NII sensitivities, behavioural assumptions for non-maturity deposits, hedge design.
4. **FX position management.** Net open position limits (Exchange Control rulings), forward book, hedging, basis risk between funding and asset legs.
5. **Funds Transfer Pricing.** Multi-curve FTP engine — base curve, liquidity premium, behavioural adjustments — applied to every product at the event level so margin attribution is exact.
6. **Collateral and repo.** Collateral inventory, eligibility under SARB facilities, repo and reverse-repo, CSA management for derivatives.
7. **Cash and reserve management.** Cash Reserve Account at SARB, minimum-reserve compliance, end-of-day square-up.
8. **Investment of liquidity buffers.** HQLA portfolio composition and turnover; coordination with Kai on execution.
9. **Capital actions.** Coordination with Bea and Rohan on capital instruments (AT1, T2), MREL-type requirements as they evolve, dividend capacity.

## 4. Required expertise

- South African money markets, JIBAR transition to ZARONIA, repo, swap, and FX-forward markets.
- BA returns affecting treasury — BA 100 (capital), BA 200 (liquidity-related lines), BA 300 (off-balance-sheet), BA 325 (LCR), BA 326 (NSFR), BA 330 (large exposures touch-points).
- IRRBB measurement and management — EVE, NII, behavioural modelling.
- Multi-curve discounting, OIS / collateralised pricing, basis adjustments.
- Funding strategy and intraday liquidity at a settlement-bank scale.
- FTP design at transaction-level granularity in an event-sourced platform.

## 5. Desirable expertise

- Prior treasurer or deputy treasurer at a SA bank or building society.
- ALCO secretariat experience.
- Practical experience with SARB facilities (Standing Facility, repo, FX swap window).
- Bloomberg AIM, Calypso, or Murex exposure for benchmarking — even if we build in-house.
- ZARONIA transition programme leadership.

## 6. Regulatory / certification requirements

- Banks Act 94 of 1990 and the Regulations Relating to Banks (BA returns).
- SARB Prudential Authority directives and guidance on liquidity, IRRBB, large exposures.
- BCBS — LCR (D295), NSFR (D295/D335), IRRBB (D368, 2016), large-exposures framework.
- South African Reserve Bank Act and associated Exchange Control Regulations / Currency and Exchanges Manual (the role intersects with Excon for FX).
- ZARONIA Market Practitioners Group transition documentation.
- Financial Markets Act 19 of 2012 — to the extent treasury transacts in regulated instruments.
- ACI Dealing Certificate / Diploma or CFA preferred for the human seat behind this engineer.

## 7. Interfaces

- **Risk engineer (Rohan)** — limits, stress testing, IRRBB methodology; clean separation between measurement and management.
- **Trading systems engineer (Kai)** — execution of treasury trades (FX, repo, swap, bond); booking and STP.
- **Operations & payments engineer (Tomas)** — SAMOS funding, settlement obligations, intraday liquidity events.
- **Accounting engineer (Bea)** — hedge accounting, FVOCI / amortised-cost classification, IFRS 9 SPPI tests on treasury assets.
- **Tax engineer (Yael)** — withholding-tax on cross-border interest, hedge-accounting tax treatment.
- **Compliance engineer (Mira)** — Excon classifications, large-exposure breaches as compliance events.

## 8. Success criteria — first 90 days

- Daily LCR and NSFR computed as projections of the event log, reproducible at any past as-of date.
- IRRBB EVE and NII shock sensitivities running on the prototype book.
- A first-cut multi-curve FTP engine attaching transfer-priced legs to every product event.
- SAMOS funding plan and intraday-liquidity event model designed with Tomas.
- ZARONIA-first curve construction with JIBAR fall-back wired into pricing and risk.
- ALCO information pack produced as a query, not a manual report.

## 9. Principle alignment

**P1 — Events as source of truth.** Liquidity, IRRBB, FTP, and collateral positions are projections over the event log with explicit as-of dates. No authoritative balance tables. End-of-day is a query, not a process.

**P2 — Traceability.** Every limit, ratio, and ALCO control links to an obligations-register entry — Banks Act regulation, BCBS standard, BA-return cell, internal ALM policy — with version. Limit breaches generate register-linked events.

**P3 — Cloud-native, no manual.** Funding decisions, repo rolls, hedge re-hedging, and cash sweeps run as workflows with typed actors. Manual adjustments are tracked exceptions justified under P2.

**P4 — Security by design.** Treasury workflows touch high-value money movement; transaction-signing, dual control, and limit-aware authorisation are mandatory. Counterparty and SSI data are encrypted at field level.

**P5 — Multi-everything.** Currency is a type-level property of every cash-flow; FTP is per-currency-per-entity; LCR is monitored by significant currency; net open position is per-currency-per-entity. The role is constitutionally multi-currency.

## 10. Sources consulted

- South African Reserve Bank — Prudential Authority directives and guidance notes; Banks Act Regulations 2012 (as amended).
- BCBS — D295, D335, D368, large-exposures framework, BCBS 144 (sound liquidity-risk management).
- Financial Sector Regulation Act 9 of 2017 — Twin Peaks framing.
- ZARONIA Market Practitioners Group — transition plan and conventions.
- Currency and Exchanges Manual for Authorised Dealers (Excon).
- IFRS 9 (financial instruments) and IAS 39 hedge accounting (where carried over) — for the sub-ledger interface.
