# Role brief — Trading systems engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Trading systems engineer** — designs and operates the OMS/EMS, market-data, exchange connectivity, and pre-/post-trade pipeline for the bank's global-markets activities.

## 2. Why this role exists

A global-markets bank lives or dies on its ability to price, route, execute, and book trades correctly and quickly across asset classes, with risk and P&L computed in real time and every action captured for regulators. This role owns the trading stack end-to-end from market data through to settlement hand-off.

## 3. Scope of work (priority order)

1. OMS / EMS — order capture, validation, pre-trade risk, routing, child-order handling, allocations.
2. Market data — JSE, Bloomberg, Refinitiv (LSEG), exchange direct feeds; normalisation, snap-and-replay, latency budgets.
3. FIX 4.4 and 5.0 / ISO 20022 connectivity — exchanges, ECNs, brokers, prime brokers, clients.
4. Asset coverage — at minimum: ZAR rates, FX (G10 + ZAR pairs), JSE equities, listed derivatives, OTC FX forwards/swaps, vanilla IRS, government bonds. Defined in priority order with the head of trading.
5. Pre-trade controls — limit checks (notional, delta, exposure, concentration), suitability, restricted lists.
6. Post-trade booking — STP into the core ledger, lifecycle events (fixings, resets, novations, exercise).
7. Trade and order audit trail — millisecond-stamped, immutable, query-friendly for regulators and surveillance.
8. Market-abuse surveillance hooks — feeds for the compliance team's surveillance models.
9. Best-execution evidence — per FSCA conduct standards.

## 4. Required expertise

- FIX protocol and exchange connectivity in production.
- OMS/EMS architecture, low-latency design where it matters and pragmatic where it doesn't.
- Multi-asset trade lifecycle and the differences between the asset classes' booking quirks.
- Real-time risk and P&L (Greeks, DV01, FX position, settlement exposure).
- STP design into core ledger and downstream risk.
- Market-data licensing constraints and entitlement enforcement.

## 5. Desirable expertise

- Experience at a JSE-member firm or SA primary dealer.
- LSEG/Refinitiv RTDS, Bloomberg B-PIPE, exchange co-lo.
- ISDA/CDM (Common Domain Model) knowledge for derivatives.
- Murex / Calypso / Front Arena / in-house equivalents.

## 6. Regulatory / certification requirements

- JSE rules and directives for member firms; equities, equity derivatives, and interest-rate-market rulebooks.
- FSCA conduct standards on best execution and order handling.
- Financial Markets Act 19 of 2012 — market-abuse provisions, reporting obligations.
- SARB Exchange Control Regulations (Currency and Exchanges Manual) for cross-border FX.
- BCBS market-risk capital framework (FRTB) — interfaces with the risk engineer.

## 7. Interfaces

- **Core platform architect** — booking events into the ledger.
- **Risk engineer** — real-time positions, sensitivities, VaR inputs.
- **Operations & payments engineer** — settlement instructions, CLS, custody.
- **Compliance engineer** — surveillance feeds, best-execution evidence, restricted lists.
- **Tax engineer** — STT, dividends-tax, withholding tax on cross-border flows.

## 8. Success criteria — first 90 days

- Documented target stack and asset-coverage roadmap agreed with Marc.
- One asset class live end-to-end in test (pricing → order → execute → book → risk).
- FIX connectivity to at least one venue or simulator with a clean conformance run.
- Pre-trade risk gateway design agreed with the risk engineer.
- Audit-trail format agreed with internal audit and compliance.

## 9. Principle alignment

**P1 — Events as source of truth.** Order state, position, P&L, sensitivities, and exposure are projections of order, execution, market-data, and lifecycle events. There is no authoritative position table — only the event log and projections from it. Audit reconstruction of any trade or any order book at any millisecond is a query, not an investigation.

**P2 — Traceability.** Pre-trade controls, best-execution rules, restricted-list checks, surveillance hooks, and booking rules each cite the JSE rule, FSCA conduct standard, FMA section, or internal policy they enforce. Reasons captured at the time of a control firing carry the same citation.

**P3 — Cloud-native, no manual.** No paper tickets, no out-of-band confirmations. Voice channels, where legitimately required (illiquid blocks, certain OTC products), are recorded and ingested as events. Confirmations and allocations flow electronically over FIX or ISO 20022. Co-located venue access is consumed via cloud-region partnerships, not self-managed cages, where commercially viable.

**P4 — Security by design.** Pre-trade risk gateway is non-bypassable. Market-data integrity is attested. FIX sessions use mTLS or scheme-equivalent. Surveillance feeds are tamper-evident. Trader entitlements are least-privilege by desk and instrument.

**P5 — Multi-everything.** Multi-asset across multiple venues and jurisdictions. FX positions and settlement risk are first-class. Instrument reference data carries jurisdictional regulator, listing venue, and applicable trade-reporting regime. Calendars are venue-specific and holiday-aware.

## 10. Sources consulted

- JSE rules and directives — equities, equity derivatives, interest-rate-market, currency-derivatives.
- Financial Markets Act 19 of 2012.
- FSCA conduct standards and joint standards on market conduct in financial markets.
- SARB Currency and Exchanges Manual for Authorised Dealers.
- BCBS — Minimum capital requirements for market risk (FRTB).
- FIX Trading Community specifications (4.4, 5.0 SP2).
- ISDA Common Domain Model.
