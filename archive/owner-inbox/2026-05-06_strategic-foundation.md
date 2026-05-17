# Strategic foundation

**Author:** Scrooge (Chief of Staff)
**Date:** 2026-05-06
**For:** Marc (CEO) — record of decision; circulated to all governance seats and engineering leads.
**Status:** **CEO decision (2026-05-06).** Sets the bank's product, client, geographic and capital scope; supersedes any prior assumption that the bank was undefined-scope.

> **Derivation note (Principle 6).** This document is a presentation-layer record of a CEO decision. The substance was authored at the data layer (the CEO's verbal directive, captured here as an event) and propagates upward to policy and procedure refinements. No new architectural substance is authored here.

---

## 1. The decision

The bank is a **global-markets trading bank** with the following scope:

| Dimension | Scope |
|---|---|
| **Product set** | JSE-listed bond trading · JSE-listed equity trading · OTC interest-rate derivatives |
| **Client base** | Large SA corporates · banks · non-bank financial institutions (institutional-only) |
| **Geography** | South Africa; **single branch** |
| **Capital** | **~R300m**, to be provided by the shareholder |
| **Licence sequencing** | **Banking licence application deferred.** Interim operating posture is a CEO follow-up (see §5). |

## 2. What this is — and what it is not

**Is.** A wholesale, market-facing dealer franchise: market-making and risk-taking in JSE-listed cash bonds and equities, plus a ZAR (and selectively foreign-currency) interest-rate-derivative book with institutional counterparties.

**Is not.**
- **Not a retail bank.** No retail current accounts, retail credit cards, retail mortgages, retail savings, branch network beyond the single registered office.
- **Not a commercial / SME bank.** No general-purpose corporate lending or transactional banking.
- **Not a payments service provider.** Settlement infrastructure is for the bank's own trading and (later) its institutional clients' settlement of the bank's products — not a payments rail offered to third parties.
- **Not multi-jurisdiction at first.** SA-only, single-branch. *Principle 5 still binds the architecture* — multi-currency, multi-entity, multi-country must be configurable from day one — but only one entity, one jurisdiction, and one branch will be active in steady state until a deliberate expansion decision.

## 3. Implications by governance seat

Each seat reviews their domain against this scope and surfaces refinements in their next pack.

| Seat | Headline implication |
|---|---|
| **Saskia (Head of Global Markets)** | The franchise is now her primary deliverable. Markets-mandate paper (deferred B5) becomes the central forward decision. Required: product specification (which JSE bonds — govt + SAGB + corporate?), market-making vs agency posture, OTC IRD product set (vanilla swaps, FRAs, OIS, swaptions?), ZARONIA-aligned curve framework, JSE membership / authorised-user status, ISDA / GMRA / CSA documentation programme, prime-broker / sponsored-access decisions, counterparty set sizing. **Brief routed (`Team Inbox/2026-05-06_brief_markets-franchise-design.md`).** |
| **Helena (CRO)** | Risk profile narrows sharply: market risk dominates (JSE bond duration, equity beta, IRD DV01); counterparty credit risk concentrated and netted under ISDA / CSA; operational risk skews to settlement and trade-capture; very limited credit risk (no loan book). RAS to be tuned to wholesale-markets profile. ICAAP scoped to a trading-bank profile. B2 (capital / liquidity buffer calibration) becomes urgent against the **R300m capital envelope** rather than a notional placeholder. |
| **Camille (CFO)** | R300m total capital is the binding constraint. Capital plan against this — required CET1, leverage exposure under Basel III leverage ratio (when licensed), market-risk RWA under the Standardised Approach (no IMA), CCR EAD under SA-CCR. IFRS reporting for a markets bank: trading-book fair-value through profit-or-loss, IFRS 9 ECL minimal (limited credit exposure), IFRS 13 fair-value disclosure substantial. |
| **Eitan (Treasurer)** | ZAR-funded balance sheet; secured funding via repo (SAGB, corporate) is the natural anchor; ZARONIA-based FTP. LCR / NSFR scoped to a trading-bank profile (HQLA dominated by SAGB; outflows limited to wholesale counterparties). FX position from foreign-currency IRD book; collateral management central. SAMOS access (when licensed) for ZAR settlement; sponsored access in interim. |
| **Zara (CCO)** | AML/CFT scope contracts: institutional clients only, no retail, no cash. Continuous-KYC tiering simplifies (Tier-1 institutional defaults). Sanctions screening remains absolute zero appetite. Conduct: market-abuse / insider-trading regime under FMA 19 of 2012 becomes the central conduct surface (versus retail-fairness which now does not apply). FAIS scope: institutional advice / intermediary services to FSP-eligible counterparties. |
| **Iris (IO)** | POPIA scope simplifies — no retail PII; only institutional-counterparty contact data and authorised-trader records. Cross-border transfer envelope shrinks. PAIA manual scope shrinks. |
| **Owen (CoSec)** | Governance Framework already accommodates this scope; Markets Committee (sub-committee of the Risk Committee) becomes a near-term agenda item. Reserved-matters list reviewed for trading-bank specifics (e.g. trading mandate sign-off, large counterparty exposures). |
| **Devon (COO)** | Operating model concentrates around: trade capture (Kai), settlement (Tomas), reconciliation, surveillance feeds, market-data ingestion, observability. No retail channels, no branch operations, no cash handling. |

## 4. Implications by engineering seat

| Seat | Headline implication |
|---|---|
| **Atlas (platform)** | Foundation substrate unchanged in shape; product-domain modules concentrate in `domains/markets/` (Kai), `domains/treasury/` (Ravi), `domains/credit/` shrinks to counterparty exposure only. Storage & throughput sizing: trading volumes drive event-store load; MD ingestion is the heaviest write path. |
| **Kai (trading systems)** | The single critical-path engineering seat for go-live. Required: OMS/EMS, order-routing to JSE (FIX / colo questions), trade-capture, position-keeping, market-data ingestion (JSE level 1/2, ZARONIA, indicative IRD curves), real-time risk feeds. Greatly simplifies vs a multi-asset global build — JSE + ZAR IRD only. |
| **Rohan (risk engineer)** | Market-risk engine (VaR + sensitivities + stress) primary; IFRS 9 ECL minimal scope; counterparty-credit (PFE / EAD) for IRD exposures; concentration-risk on counterparty set. |
| **Ravi (treasury)** | Liquidity-risk projections, repo book engine, FX-position engine, FTP engine, collateral inventory & optimisation. |
| **Mira (compliance)** | RMCP narrows to institutional. Sanctions/PEP unchanged (zero appetite). Surveillance: market-abuse (front-running, layering, spoofing, insider-trading) becomes primary surveillance focus. |
| **Tomas (operations)** | STRATE settlement (T+3 bonds, equities), SAMOS for ZAR cash leg (sponsored interim, direct post-licence), SWIFT for cross-border IRD legs, ISO 20022 message flows. No BankservAfrica retail rails. |
| **Bea (accounting)** | Trading-book accounting: daily P&L, mark-to-market, FVTPL primary, hedge accounting (IFRS 9, already elected) for the IRD book where designated. BA returns scoped to a trading bank. |
| **Yael (tax)** | VAT FS apportionment for a wholly-financial-services entity. IAS 12 deferred-tax for trading-book valuation differences. FATCA / CRS for institutional counterparties. STT (Securities Transfer Tax) operationalised for equity trades. |
| **Anya (data)** | Market-data substrate (JSE feeds, IRD curves), trade-store projections, position-keeping projections, surveillance event store. |
| **Senna (security)** | Trading-floor surveillance integrity, OMS access controls, market-data integrity attestation, dealer-mandate-based authorisation. |
| **Niko (sales/CRM)** | Institutional client lifecycle (onboarding, KYC tier-1, mandate-letter signing, ISDA negotiation tracking), no retail funnel. |
| **Imani (legal-as-code)** | ISDA Master + Schedule + CSA library, GMRA for repo, sponsored-access agreements, JSE membership documentation. |
| **Vera (audit)** | Continuous controls scoped to trading-bank-specific risks: market-abuse surveillance assurance, mark-to-market integrity, dealer-mandate compliance, counterparty-limit assurance. |
| **Sade (HR)** | Fit-and-proper register concentrates on FSCA-registered key individuals + JSE-registered authorised users + Senior Manager Function holders. Smaller headcount than retail bank profile. |

## 5. Open questions for CEO (next decision pack)

These flow directly from the strategic foundation and need CEO direction.

1. ~~**Interim operating posture**~~ **— RESOLVED 2026-05-06: build-only, no live trading until SARB licence is granted.** Per `Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md`. Build proceeds end-to-end against synthetic flows; full design + soft-franchise relationship-building during the build period; switch to live is a configuration change at licence-grant.
2. **Product priority within scope.** All three (JSE bonds, JSE equities, OTC IRD) at once, or sequenced (e.g. start with SAGB + IRS, add corporate bonds + equities subsequently)? Sequencing materially changes the M-phase build plan.
3. **Capital tranches & timing.** R300m total — single injection at licence, or tranched (seed / pre-licence / licence-day / post-licence)? Affects ICAAP and B2 calibration.
4. **Counterparty-set ambition.** Top-tier institutional only, or full SA institutional universe? Influences counterparty-credit framework, ISDA negotiation programme, KYC volume.
5. **JSE membership form.** Direct membership (own equity / bond authorised user) vs sponsored access in interim. Saskia + Imani propose; Marc decides.

## 6. What changes immediately

- **Saskia** receives a markets-franchise-design brief (`Team Inbox/2026-05-06_brief_markets-franchise-design.md`).
- **B5 (trading mandate)** moves from "deferred — ~2 weeks" to "primary forward decision". Saskia chairs the drafting.
- **B2 (capital / liquidity buffer calibration)** is now scoped against R300m capital and a trading-bank profile — Helena + Camille + Eitan, urgent.
- **Project memory** updated (`project_strategic_foundation.md`).
- **Reporting capability spec** unchanged in shape but the prioritisation will tilt: BA returns relevant to a trading bank (BA 700-series market-risk returns, BA 325 large exposures) rise; retail-focused returns drop in priority.
- **Procedures library** — drafting backlog tilts to markets-bank procedures; retail-only procedures are de-scoped (recorded as out-of-scope under Principle 6 — upward chain — rather than orphan-flagged).

## 7. What does *not* change

- All six architectural principles (CLAUDE.md) are unchanged in shape (the strategic foundation does not move principles; it concentrates the bank's product and client scope).
- Governance Framework is unchanged in shape.
- Multi-currency / multi-entity / multi-country architecture (Principle 5) is **still binding**; a single jurisdiction at start is configuration, not a code branch.
- Cloud target (Azure) unchanged.
- Build sequencing (full local first; cloud lift M8) unchanged.

## 8. Co-dependencies (sources)

- CEO verbal directive (2026-05-06; captured in this document).
- `CLAUDE.md` — Principles 1–7; Saskia / Helena / Camille / Eitan / Zara / Owen / Devon mandates.
- `/Team/Saskia.md`, `/Team/Helena.md`, `/Team/Camille.md`, `/Team/Eitan.md` — mandate boundaries.
- `Owner Inbox/2026-05-06_governance-framework.md` — Markets Committee placeholder.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` — to be tuned to trading-bank profile.
- `Team Inbox/actioned/2026-05-06_ceo-decisions.md` — B2, B5 deferrals (now activated).
- Banks Act 94 of 1990; FMA 19 of 2012; FAIS Act 37 of 2002 (relevant external instruments — no instrument-level analysis yet; Mira's regulatory-change-management cadence will populate).
