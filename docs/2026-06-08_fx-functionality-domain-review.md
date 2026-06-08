---
title: "FX functionality — cross-domain review (audit-grade)"
date: 2026-06-08
author: "Commissioned cross-domain analyst (engaged by Scrooge, Chief of Staff, on the in-session request of Marc, CEO)"
status: review-only (no Decision recorded; findings for CEO disposition)
commissioned_by: "Marc (CEO) → Scrooge (Chief of Staff)"
verified_against: "main @ 99261cda (post WS-SLA-FULL-RETIREMENT #1094–#1098)"
domains_covered:
  - Trade lifecycle & booking
  - Accounting & sub-ledger (IFRS)
  - Market risk
  - Product control & P&L
  - Regulatory reporting
  - Settlement & operations
  - Monitoring & controls (recon substrate)
location_note: >
  Filed to docs/ (the established dated-report convention on main — e.g.
  docs/2026-05-22_eitan_ba-325-first-end-to-end-validation.md), NOT a new
  reports/ directory, because docs/ is the live convention. RMS RecordFiled
  event is a follow-on for Scrooge (this is a review render, not a deliverable
  that dispatches work).
executive_summary: >
  The bank's FX substrate is materially more complete on the booking →
  IFRS-posting → P&L → market-risk axis than on the regulatory-reporting and
  settlement-operations axes. As of main @ 99261cda the rules-as-data SLA
  interpreter is the SOLE production FX posting path (legacy gl-posting-engine.ts
  retired; the posting-engine-single-subscriber gate guards double-posting), and
  it dual-posts IFRS + SARB-NOP. FX market risk (per-currency NOP, VaR/MR-1-FX,
  RAS B1/B2/B3 feeders) is built and event-fed; daily P&L folds desk-cash IAS-21
  retranslation. The honest weak points are: (1) per-currency Chart-of-Accounts
  provisioning is ZAR/USD-only — EUR/GBP/JPY/CHF/AUD trade legs route to the
  unresolved-currency suspense ACC-2100-007, a real Principle-5 gap; (2) the BA-310
  market-risk return that carries the FX NOP exists as a generator + period-close
  subscriber but is NOT wired into runtime (inert — no daily SARB submission path);
  (3) FinSurv exchange-control reporting is a build-phase stub; (4) settlement /
  Herstatt risk is modelled in the RAS feeder but the underlying methodology
  (D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY) is still open awaiting CRO ratification,
  and there is no CLS model. Recon coverage on the booking/lifecycle/accounting axis
  is strong (10+ FX gates in ci:recon); the monitoring gap is on the reporting-
  submission and settlement-completion axes.
---

# FX functionality — cross-domain review

**Scope & method.** Verified against `main @ 99261cda`, post the WS-SLA-FULL-RETIREMENT
merge train (#1094–#1098). Every claim below is anchored to a file path, recon gate,
Decision id, regulation, or procedure. Liveness ("live/wired") is asserted only where
the wiring (server boot, runtime callable, scheduled metadata, or recon gate) was found;
otherwise the capability is marked **(b) built-inert**. Build-phase framing applies:
"production-grade substrate exercised by simulation", not live customers/capital.

**Maturity legend:** (a) built+tested · (b) built-but-inert/unwired · (c) specified-not-built · (d) not-yet-specified.

## Maturity scorecard (per domain)

| # | Domain | Dominant maturity | Single biggest gap |
|---|--------|-------------------|--------------------|
| 1 | Trade lifecycle & booking | (a) built+tested | No FX confirmation/matching posting path — `ConfirmationMatched` is log-only; no SWIFT/CLS confirmation substrate |
| 2 | Accounting & sub-ledger (IFRS) | (a) built+tested | Per-ccy CoA is ZAR/USD-only; EUR/GBP/JPY/CHF/AUD legs → suspense ACC-2100-007 (Principle 5 gap) |
| 3 | Market risk | (a) built+tested | `MarketRiskMeasureComputed` (VaR/MR-1-FX) emitter not scheduled — on-demand only; RAS B2 methodology open |
| 4 | Product control & P&L | (a) built+tested | EUR/GBP cross has no production feed → fallback mid; cross-pair MTM does not triangulate |
| 5 | Regulatory reporting | mixed: SLA SARB-NOP (a); BA-310 generator (b)-inert; FinSurv (c)-stub | BA-310 (FX NOP) period-close subscriber is NOT runtime-wired → no SARB submission path |
| 6 | Settlement & operations | (b) built-inert / (c) specified | No CLS model; Herstatt methodology (D-RAS-B2-...) open; per-ccy nostro ZAR/USD/EUR only |
| 7 | Monitoring & controls | (a) built+tested | No recon gate on reporting-submission completeness or settlement-completion (Herstatt close) |

---

## 1. Trade lifecycle & booking

**Regulations.** Banks Act 94 of 1990 + Regulations Relating to Banks; SARB Currency &
Exchanges Manual (Authorised Dealer rules, ORG-MK-08); ODP s.8 (FX confirmation T+2),
s.3 (trade-repository reporting) — `Regulations/ODP/odp-framework.md`. AD status drives
FinSurv reporting on every cross-border FX flow (D-FX-AD-STATUS).

**Policies / decisions.** `D-MARKETS-SCHEMA-FOUNDATION` (CEO 2026-05-07); FX sub-decisions
`D-FX-BOOK-BOUNDARY` (bookType required on FX `TradeExecuted` from M4), `D-FX-CLS-MEMBERSHIP`
(correspondent settlement routing), `D-FX-AD-STATUS`. Event family at
`platform/markets/cdm/fx.ts` — `FX_EVENT_TYPES = [FxTradeExecuted, FxSettlementInstructed,
PrincipalPayment, SettlementConfirmed, NdfFixingObserved, SettlementRealisedPnlCorrected]`.
Note the design choice (P1): **zero new event types** — FX rides `TradeExecuted` with the
`bookType`/`productTaxonomy` discriminator (`FX-spot|FX-forward|FX-swap|NDF`).

**Procedures.** Lifecycle registry `platform/lifecycle/trade-lifecycle-registry.ts`;
state resolver `platform/lifecycle/trade-lifecycle-state.ts` (`resolveTradeLifecycle`,
consumed by var-engine, daily-pnl, rwa-from-positions, currency-position, limit-utilisation).

**Reporting (lifecycle-state).** Booked → instructed → settled / cancelled / failed all
fold from the event stream; `trade-lifecycle-parity` and `fx-lifecycle-parity` gates close
the loop (see §7).

**Monitoring / controls.**
- `platform/recon/credit-limit-no-trade-without-loaded.ts` — **(a)** Critical finding if a
  counterparty trades without a prior loaded credit limit. In CI (`recon:credit-limit-no-trade-without-loaded`).
- FX gateway `dashboard/markets-fx-gateway.ts` — pre-trade checks include `"credit-limit"`,
  capital-impact, funding; rejection surfaces `OrderRejectedAtGateway`. Wired into
  `dashboard/server.ts` (`routeOrderToGateway`, `executeFxTrade → bookFxTrade`). **(a)** for
  the gateway path; the manual desk path (`bookFxTrade` in `trade-book-view.ts`) shares it.
- `fx-pair-direction`, `fx-quoting-convention`, `fx-rate-magnitude`, `fx-pair-canonical-aggregation` — all in CI (§7).

**Gaps.**
- **G1.1 — Confirmation/matching is log-only, no substrate.** `ConfirmationMatched` /
  `ConfirmationMismatch` produce NO `SubLedgerPostingEmitted` and there is no SWIFT/matching
  engine — `runtime/agents/bea-gl-posting-engine.ts` explicitly logs these. *Impact:* the
  ODP s.8 T+2 confirmation obligation has no operational evidence trail for FX. *Maturity:*
  (c) specified-not-built (event type exists; matching engine does not). *Close-plan:* Kai
  (trading systems engineer) + Mira — build an FX confirmation-matching capability emitting
  `ConfirmationMatched` from a (simulated) counterparty confirmation feed; add
  `fsca-confirmation-report` linkage (`platform/compliance/fsca-confirmation-report.ts`
  already consumes it). *Tracked?* No open Decision/brief found — **net-new**.
- **G1.2 — Amendment lifecycle retired with zero emitters.** `TradeAmended` (PR-FX-AMD) and
  `TradeMatured` (PR-FX-003) arms were removed in the SLA full-retirement FX tail (zero
  production emitters). *Impact:* FX trade amendment is unmodelled. *Maturity:* (d)
  not-yet-specified for a live amendment path. *Close-plan:* defer to licence-day unless a
  desk amendment workflow is prioritised. *Tracked?* Implicitly under D-SLA-ENGINE-RULES-AS-DATA retirement notes.

---

## 2. Accounting & sub-ledger (IFRS)

**Regulations / standards.** IFRS 9 §3.1.1 (trade-date recognition), §5.5 (impairment/ECL);
IAS 21 §21 (initial measurement), §28 (monetary-item retranslation through P&L). Cited
in-rule in `platform/accounting/sla/rules/pr-fx-001.ts` and `pr-fx-005.ts`.

**Policies / decisions.** `D-SLA-ENGINE-RULES-AS-DATA` (CEO 2026-06-05);
`D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE` (CEO 2026-06-05); the full-retirement train
`D-...` PRs #1094–#1098. **The rules-as-data SLA interpreter is the SOLE production FX
posting path** — verified: `runtime/agents/bea-gl-posting-engine.ts` imports **no journal
function** from `platform/accounting/posting-rules/*` (only the `FX_ACCOUNTS` constant,
line 102). The eight FX-lifecycle event types post via `processFxViaInterpreter` /
`bea-gl-fx-interpreter-cutover.ts`.

**The SLA FX rule set** (`platform/accounting/sla/rules/`):
- `pr-fx-001.ts` — IFRS booking (IFRS 9 §3.1.1 / IAS 21 §21). `representation: "IFRS"`.
- `pr-fx-002.ts` — daily revaluation (IAS 21 retranslation).
- `pr-fx-005.ts` — `FxSettlementFailed` → IFRS-9 default-recognition memo (data form of
  legacy `fxSettlementFailedJournals`).
- `pr-fx-cancel.ts` — cancellation enrichment.
- `pr-fx-lifecycle-close.ts` — `SettlementConfirmed` close.
- `pr-fx-prin.ts` — `PrincipalPayment` (per-leg cash).
- `pr-fx-memo.ts` — memo classifications (no GL).
- `pr-fx-001-ba.ts` / `pr-fx-001-ba-v2.ts` / `pr-fx-ba-lifecycle.ts` — SARB-NOP representation (see §5).

**Desk-cash `fi:csh` instrument (IAS 21 §28).** `platform/product-control/desk-cash-positions.ts`
materialises settled FCY balances as the `fi:csh:<CCY>:<book>` valuation instrument; folded
into daily P&L (§4).

**Sub-ledger reconciliation.**
- `platform/accounting/fx-subledger-trade-reconciliation.ts` — reconciles the FX trading
  sub-ledger **one trade at a time** (CEO direction 2026-06-01) against the GL trial balance.
  Uses `fxTradeBookingJournals` (from the retired-but-retained `fx-spot.ts`) **as a parity
  oracle / canonical footprint reference, NOT as a production posting path** — an important
  distinction: `fx-spot.ts` survives only as the reconciliation reference and parallel-run
  byte-for-byte oracle (`pr-fx-001.rule.json` asserts the data form matches it).
- `platform/accounting/fx-subledger-writeoff.ts` — write-off of suspense residue
  (`ACC-2100-007`), CFO-decision-gated; the reconciliation gate FAILs on a residue with no
  backing CFO decision (§7).

**Reporting (accounting).** Trial balance / GL view fed by `SubLedgerPostingEmitted`; period
close via `runtime/agents/bea-period-close.ts` (`AccountingPeriodClosed`).

**Monitoring / controls.** `recon:fx-subledger-reconciliation` (CI), `recon:gl-ledger-coverage`
(CI), `recon:coa-name-no-currency` (CI — no currency token embedded in account names),
`recon:posting-engine-single-subscriber` (in `ci:recon:infra` — guards a second production
emitter of `SubLedgerPostingEmitted`). See §7.

**Gaps.**
- **G2.1 — Per-currency CoA is ZAR/USD-only (Principle 5 gap).** `pr-fx-001.ts`: receivable
  ZAR→`ACC-2100-001`, USD→`ACC-2100-002`; payable ZAR→`ACC-2100-003`, USD→`ACC-2100-004`.
  **Any EUR/GBP/JPY/CHF/AUD leg has no dedicated account → routes to the unresolved-currency
  suspense `ACC-2100-007` + a high-severity urgent-correction alert** (never a silent USD
  fallback, which is the correct safe behaviour — but it is still a provisioning gap).
  *Impact:* every non-ZAR/USD FX trade lands a balanced-but-suspense posting requiring
  write-off/manual clearing; the IFRS sub-ledger cannot present a clean per-ccy FVTPL
  position for EUR/GBP/JPY. *Maturity:* (b) built-inert for the multi-ccy accounts (the
  suspense mechanism is (a) built+tested). *Close-plan:* Bea (Accounting & financial
  reporting engineer) — provision `ACC-2100-00x` receivable/payable pairs per traded
  currency + extend the resolver's per-ccy account map; add a recon asserting every traded
  ISO-4217 currency has a CoA pair (no suspense routing in steady state). *Tracked?* The
  suspense routing IS tracked (`D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE`) but the **completion
  of per-ccy provisioning is NOT** — net-new.

---

## 3. Market risk

**Regulations.** Banks Act Reg 28 (market/position risk, Form BA 310); Basel market-risk
standardised approach (`platform/regulatory/basel-adoption.ts`); RAS §§B1–B3.

**Policies / decisions.** RAS appetite register `platform/risk/ras-appetite-register.ts`
(CEO-approved 2026-06-08, the D-RAS-STRUCTURED-REGISTER single-source). RAS section mapping
is nuanced and worth stating precisely to avoid the brief's B-label ambiguity:
- In the **limit-utilisation projection** (`platform/projections/markets/limit-utilisation.ts`),
  the risk clusters are: **B1** = pre-settlement counterparty credit (10% of pay-leg notional,
  per-ccy); **B2** = settlement-window / **Herstatt** exposure (one leg delivered, other
  pending); **B3** = net FX position (NOP, per-ccy aggregated to ZAR). B4 = IR sensitivity,
  B5 = uncalibrated.
- In the **ras-appetite-register** the `rasSection` labels "B2"/"B3" denote concentration /
  market-risk appetite lines — a **different B-numbering axis** from the limit-utilisation
  clusters. Readers must not conflate the two.

**Procedures / engine.**
- NOP: `platform/projections/markets/currency-position.ts` + `limit-utilisation.ts`
  (`FxTradeExecuted` → B3 net position per pay-CCY + 10%-notional B1 credit;
  `PrincipalPayment{deliver}` opens B2 Herstatt; `SettlementConfirmed` closes B1+B2;
  `FxSettlementFailed{one-leg-delivered}` keeps B2 open). **(a)** event-fed.
- VaR / MR-1-FX: `platform/market-risk/var-engine.ts` (historical-simulation 99% 1-day VaR,
  SVaR, ES; no-silent-zeros per D-TRUSTED-FIGURES-PROGRAM-V1). Measure event
  `MarketRiskMeasureComputed` (`platform/event-store/event-types/market-risk-measure.ts`),
  projection `platform/projections/markets/market-risk-measure.ts`, read in `dashboard/server.ts`.

**Reporting.** `getMarketRiskMeasure` read at server; RAS register parity via `recon:ras-register-parity`.

**Monitoring / controls.** `recon:ras-cluster-feeder-coverage` (CI) — asserts every published
RAS cluster (B1–B5) has an event feeder; B2 specifically lights up for a mid-settlement
trade (the Herstatt regression). `recon:ras-b2-calibration-coverage`, `recon:ras-register-parity` (CI).

**Gaps.**
- **G3.1 — `MarketRiskMeasureComputed` (VaR/MR-1-FX) emitter is NOT scheduled.** The emitter
  lives in `scripts/market-risk-measure-run.ts` but appears in **no** `runtime/agents/metadata/*`
  cron entry. *Impact:* the VaR/MR-1-FX measure is computed on-demand (script/server) but not
  on a daily cadence — the risk figure can go stale without a scheduled tick. *Maturity:* (b)
  built-inert (engine + event + projection all exist; the daily emit is unwired). *Close-plan:*
  Rohan (risk engineer) — add a scheduled metadata entry (mirroring `rohan-daily-mtm` cron
  `43 3 * * *`) invoking the measure run; add `recon:expected-event-watchdog` coverage for a
  daily `MarketRiskMeasureComputed`. *Tracked?* No open brief found — net-new.
- **G3.2 — RAS B2 settlement-exposure methodology OPEN.** `D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY`
  is recorded `phase: "requested"`, `authority: "CRO"` via
  `scripts/emit-ras-b2-settlement-methodology-decision.ts` — awaiting Helena (CRO, governance)
  ratification (do-not-self-ratify). The **feeder** is wired (`D-RAS-B2-SETTLEMENT-EXPOSURE-FIX`,
  CEO 2026-06-07) but the *risk methodology* it implements is unratified. *Impact:* the
  Herstatt exposure number is computed but not appetite-blessed. *Maturity:* (a) feeder built;
  methodology (c) specified-pending-approval. *Close-plan:* Helena ratifies the requested card
  → flip to approved. *Tracked?* **YES** — this is the open item the brief named; confirmed open.

---

## 4. Product control & P&L

**Regulations / standards.** IAS 21 §28 (retranslation through P&L); IFRS 9 FVTPL.

**Policies / decisions.** Daily P&L attribution `pnl-attribution-fx-v1`; daily official FX
marks (decouple-from-reval) per the 2026-06-02 work; desk-cash valuation folded into P&L
(2026-06-03 work); cross-pair production ingest `D-...` (approved, see below).

**Procedures / engine.**
- `platform/product-control/daily-pnl.ts` — `computeDailyPnl`; **block 5b folds
  `computeDeskCashPositions(store, asOfBound)`** (line 522) so settled-FCY IAS-21 cash
  retranslation enters daily P&L (canonical single source — replaced the prior
  `RealisedPnlRecognised` fold to avoid double-count). **(a)**.
- Attribution `platform/product-control/pnl-attribution.ts` — market-move / rate /
  cash-retranslation legs; cash retranslation delta added to `marketMove` so attribution
  reconciles exactly (`recon:pnl-attribution-reconciles`, CI).
- Daily official marks: `OfficialMarkAdopted` + `adoptDailyOfficialFxMarks`
  (`platform/valuation/mark-adoption-engine.ts`), wired into `runtime/agents/rohan-daily-mtm.ts`
  (cron `43 3 * * *`) + `scripts/mtm-run.ts` + back-fill `scripts/adopt-daily-fx-marks.ts`.
  Marks the **whole feed universe** daily independent of positions (idempotent per pair+day). **(a)**.
- MTM cadence: `rohan-daily-mtm` emits `FxPositionRevalued` (+ `OfficialMarkAdopted`) daily;
  also folds `runEodIrsRevaluation`. **(a)** scheduled.

**Reporting.** Daily P&L report `pnl:<date>:<hash>`; P&L sign-off `pnl-signoff.ts`;
`recon:pnl-signoff-coverage`, `recon:all-asset-pnl-ipv-coverage` (CI).

**Monitoring / controls.** `recon:pnl-attribution-reconciles`, `recon:position-revalued-cites-mark`,
`recon:mtm-reversal-paired-with-reval`, `recon:mtm-vs-gl-amount-delta`, `recon:calc-no-silent-zero` (all CI).

**Gaps.**
- **G4.1 — EUR/GBP cross has no production feed; cross-pair MTM does not triangulate.**
  Production ingest (Twelve Data, `scripts/agents/fx-twelvedata-parse.ts` `TWELVE_DATA_TARGET_PAIRS`)
  covers USD/ZAR, EUR/ZAR, GBP/ZAR, JPY/ZAR, CHF/ZAR, AUD/ZAR, EUR/USD, GBP/USD. **The EUR/GBP
  cross is NOT in the list** → it relies on the hardcoded fallback mid (`EUR/GBP: 1.15` in
  `platform/simulation/fx-sim-rates.ts SEED_MID_RATES`). The cross-pair MTM does not triangulate
  via ZAR legs (the explicit rationale in the approved cross-pairs ingest decision was to ingest
  traded crosses directly rather than triangulate). *Impact:* an EUR/GBP position would mark off
  a fallback rate, not a live feed. *Maturity:* (b) for EUR/GBP specifically. *Close-plan:* Devon
  (data/ingest) — add EUR/GBP to `TWELVE_DATA_TARGET_PAIRS` if the desk trades it, OR document
  it as out-of-mandate. *Tracked?* The EUR/USD+GBP/USD crosses ARE tracked (approved ingest
  decision); EUR/GBP specifically is not — net-new (low priority unless traded).

> **Brief contradiction (see Return §d):** the brief states "EUR/GBP have no production FX feed
> → fallback rates". Precisely: **EUR/ZAR and GBP/ZAR DO have a production feed** (in
> `TWELVE_DATA_TARGET_PAIRS`, ingested daily by `runtime/agents/devon-fx-twelvedata-ingest.ts`).
> Only the **EUR/GBP cross** lacks one. The gap is narrower than stated.

---

## 5. Regulatory reporting

**Regulations.** Banks Act Reg 28 (market/position risk → **Form BA 310**), Reg 29(3) (FX
effective net open position attestation); SARB Currency & Exchanges (FinSurv) — `Regulations/SARB-FinSurv/`
(`source-docs/excon-structured.json`); FSCA FAIS + ODP — `Regulations/FSCA/`, `Regulations/ODP/odp-framework.md`
(s.3 trade-repository reporting, s.8 confirmation timing); Basel transposition `platform/regulatory/basel-adoption.ts`.

**BA-form numbering — canonical position.** `D-BA-RETURN-FORM-NUMBERING-RECON` (recorded via
`scripts/record-d-ba-return-form-numbering-recon.ts`) is the canonical reconciliation of the
historical BA-form confusion. **Canonical for this bank: BA 310 = Market risk (position risk),
monthly, Reg 28; the FX effective net open position attestation rides BA 310 / BA 110 under
Reg 29(3).** Earlier code carried inconsistent "BA 350" / "BA 325" NOP citations — those were
the legacy churn this decision cleaned up. (Note: `pr-fx-001-ba-v2.ts` still contains residual
"BA 350" prose in its header comment — a cosmetic citation-drift remnant, see G5.3.)

> **Brief disambiguation (Return §d):** the brief refers to "BA-325 daily trading position"
> for FX. In THIS codebase **BA 325 = LCR / liquidity** (the May-22 doc
> `docs/2026-05-22_eitan_ba-325-first-end-to-end-validation.md` validated a BA-325 *LCR*
> generator; that `ba-325-lcr.ts` file no longer exists on main — LCR now lives in
> `platform/reporting/ba-110-lcr.ts`). The FX NOP return is **BA 310**, not BA 325/320.
> BA-330 = IRRBB (per `D-BA-330-REATTRIBUTION-IRRBB`), correctly NOT FX — confirmed.

**Policies / decisions.** `D-FX-AD-STATUS` (full Authorised Dealer → FinSurv on every
cross-border flow); `D-SLA-FIRST-REPRESENTATION-SARB-BA` (CFO Camille); SARB-BA-RETURN
activated via the 3-round governance ceremony.

**The SLA SARB-NOP representation (dual-posting) — LIVE.**
`platform/accounting/sla/approval.ts`: `PRODUCTION_REPRESENTATIONS = ["IFRS", "SARB-BA-RETURN"]`.
`rules/index.ts` confirms every FX-lifecycle event posts **both** bases. The NOP memo rule
`pr-fx-001-ba.ts` (v1, NOP on receive leg) is superseded by `pr-fx-001-ba-v2.ts` (v2, NOP on
pay/sold leg, effective [2026-07-01, ∞)), versioned independently of the IFRS PR-FX-001. **(a)
built+tested + live** for the dual IFRS+SARB-NOP posting.

**BA-return generators that exist.** `platform/returns/{ba100,ba110,ba300,ba310}/` each have a
`generator`/`period-close-subscriber`; `platform/reporting/` has BA-100/110/120/200/300/310/
400/600/610 renderers. **The FX-carrying return is BA 310** — `platform/returns/ba310/period-close-subscriber.ts`
(folds FX positions directly from `FxTradeExecuted`, P1-compliant) + `platform/reporting/ba-310-market-risk.ts`
+ `platform/reporting/ba-310-fx-adapter.ts` (`fxPositionsToBa310Input`, one `FxPositionRow`
per non-functional currency).

**FinSurv (exchange control).** `platform/markets/regulatory/finsurv-stub.ts` — **build-phase
stub**: emits a `pending` `TradeReportSubmitted` per `FxTradeExecuted`; "at licence-day this
module is replaced by the live FinSurv submission". **(c) stub**.

**Monitoring / controls.** `recon:ba-returns-vs-gl-balances`, `recon:regulatory-extraction-coverage`,
`recon:fsca-reg-to-policy`, `recon:compliance-obligation-tracing` (all CI). BA-310 smoke test
`returns:ba310:smoke` exists but is NOT in the default CI gate path.

**Gaps.**
- **G5.1 — BA-310 (FX NOP) period-close subscriber is NOT runtime-wired (inert).** The
  subscriber `platform/returns/ba310/period-close-subscriber.ts` exists with FX folding, but a
  repo-wide search finds **no importer** in `runtime/` or `dashboard/` (only `package.json`
  smoke-test script, `permission-gate-default.ts`, and a decision-record script reference it).
  `runtime/agents/bea-period-close.ts` emits `AccountingPeriodClosed` but does NOT invoke the
  BA-310 subscriber. *Impact:* **there is no automated SARB BA-310 / FX-NOP submission path** —
  the return is generatable on-demand only. This is the most material reporting gap. *Maturity:*
  (b) built-inert. *Close-plan:* Mira / Eitan (reporting) + Bea — wire the BA-310 period-close
  subscriber into the `AccountingPeriodClosed` stream in runtime; add `recon:expected-event-watchdog`
  for the monthly BA-310 emit. *Tracked?* No open brief found — net-new (high priority).
- **G5.2 — FinSurv exchange-control reporting is a stub.** Every cross-border FX flow under AD
  status (`D-FX-AD-STATUS`) requires FinSurv reporting; the current path emits a `pending`
  stub. *Impact:* exchange-control reporting obligation has no real submission substrate.
  *Maturity:* (c) specified-stub (correctly scoped to licence-day). *Close-plan:* Mira — live
  FinSurv connector at licence-day; build-phase, exercise the stub against `excon-structured.json`
  categories. *Tracked?* Implicitly licence-day-deferred (the stub header says so).
- **G5.3 — Residual "BA 350" citation drift.** `pr-fx-001-ba-v2.ts` header prose still says
  "SARB BA-350 (reclassified 2026-07-01)" though `D-BA-RETURN-FORM-NUMBERING-RECON` made BA 310
  canonical. *Impact:* cosmetic/citation-hygiene only. *Close-plan:* Bea — sweep the BA-350
  prose remnants. *Tracked?* Partially by the numbering-recon decision; the v2 header was missed.

---

## 6. Settlement & operations

**Regulations.** BCBS d226 (settlement risk in FX); Banks Act Reg 39 (settlement-failure
BCP / Herstatt); `D-FX-CLS-MEMBERSHIP` (correspondent routing).

**Policies / decisions.** `D-FX-CLS-MEMBERSHIP` (correspondent SWIFT MT202 / pacs.009 path);
`D-ALM-SETTLEMENT-INSTRUCTION-CORRESPONDENT` (correspondent repayment-leg settlement instructions).

**Procedures / substrate.**
- Settlement instruction: `SettlementInstructionIssued` event; `FxSettlementInstructed`
  (`platform/markets/cdm/fx.ts`, message standard MT202/pacs.009).
- Correspondent funding: `platform/simulation/env-sim/correspondent-nostro-sim.ts` (emits
  `FundingDrawnDown` + paired `SettlementInstructionIssued` `SI-REPAY-*`),
  `correspondent-advice-sim.ts`, routing `platform/markets/correspondent-routing.ts` +
  `platform/projections/markets/correspondent-routing.ts` (USD/EUR/GBP/JPY settle via
  CLS-member correspondents). **(a)** simulated.
- Nostro per-ccy: `nostroAccountFor(currency)` (`fx-spot.ts`) returns dedicated accounts for
  **ZAR, USD, EUR only**; everything else → `ACC-2100-007` suspense.
- Herstatt / settlement-window: tracked as RAS **B2** in `limit-utilisation.ts` (opens on
  one-leg-delivered, closes on `SettlementConfirmed`, stays open on `FxSettlementFailed{one-leg-delivered}`).

**Reporting.** Settlement instructions surface in the ALM/settlement-outflows view; correspondent
MT942 generation exists (per the 2026-06-02 ALM work).

**Monitoring / controls.** `recon:ras-cluster-feeder-coverage` (B2 Herstatt feeder, CI);
`recon:liquidity-position-vs-settled-notional` (CI).

**Gaps.**
- **G6.1 — No CLS settlement model.** Correspondent routing *labels* USD/EUR/GBP/JPY as
  "CLS-member correspondent" but there is no CLS netting/PvP settlement model — settlement is
  modelled as bilateral correspondent legs. *Impact:* Herstatt mitigation that CLS PvP would
  provide is not represented; the B2 exposure overstates vs a CLS-settled world. *Maturity:*
  (c) specified-not-built. *Close-plan:* Tomas (payments/settlement) — model a CLS PvP path
  that closes B2 atomically for CLS-eligible pairs. *Tracked?* `D-FX-CLS-MEMBERSHIP` exists but
  models routing, not CLS settlement mechanics — partial; the PvP model is net-new.
- **G6.2 — Per-ccy nostro provisioning ZAR/USD/EUR only.** Same root as G2.1 — `nostroAccountFor`
  has no GBP/JPY/CHF/AUD nostro → suspense. *Impact:* settled FCY cash in those ccys cannot land
  in a dedicated nostro. *Maturity:* (b) built-inert for the missing ccys. *Close-plan:* Bea +
  Tomas — provision per-ccy nostros for every traded currency; recon asserting no nostro→suspense
  routing in steady state. *Tracked?* No — net-new.
- **G6.3 — RAS B2 / Herstatt methodology open (cross-ref G3.2).** `D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY`
  awaits CRO ratification — confirmed open.

---

## 7. Monitoring & controls (recon substrate)

All gates below are in the CI recon pipeline (`ci:recon:infra` or `ci:recon:domain` in
`prototype/package.json`) unless noted. Coverage is **strong on booking/lifecycle/accounting,
thin on reporting-submission and settlement-completion**.

| Gate | Asserts | Coverage | In CI |
|------|---------|----------|-------|
| `fx-lifecycle-parity` | FAIL on a closure event (matured/settled/cancelled/failed) whose opening event is absent; advisory warn for fully-instructed-but-unsettled | FX lifecycle integrity | ✅ `ci:recon:domain` |
| `trade-lifecycle-parity` | Cross-product: orphan terminal events (closure without open) FAIL | All products incl. FX | ✅ |
| `fx-pair-direction` | Vera advisory: FX pair on-wire / in-sim is in canonical direction (warn; FAIL on schema violation) | FX pair convention | ✅ |
| `fx-pair-canonical-aggregation` | Pairs aggregate canonically (no inverse double-count) | NOP aggregation | ✅ |
| `fx-quoting-convention` | Validates `fxTradeExecutedPayloadSchema` (Zod) per emitted FX event; write-time invariant | FX quote correctness | ✅ |
| `fx-rate-magnitude` | Cross-checks magnitude relation on every FX rate (sanity band) | Rate sanity | ✅ |
| `coa-name-no-currency` | No CoA account NAME embeds a currency token | CoA hygiene | ✅ |
| `gl-ledger-coverage` | Every FX-spot lifecycle event has GL coverage (4 assertions) | FX→GL closure | ✅ |
| `fx-subledger-reconciliation` | FX trading sub-ledger reconciles to GL trial balance per-trade; orphaned closing-leg or un-CFO-decided suspense residue FAILs | Sub-ledger integrity | ✅ |
| `posting-engine-single-subscriber` | No two production callables emit `SubLedgerPostingEmitted` for the same event type (anti-double-post; #1096) | Posting single-ownership | ✅ `ci:recon:infra` |
| `credit-limit-no-trade-without-loaded` | Critical finding if a counterparty trades without a prior loaded credit limit | Pre-trade credit gating | ✅ |
| `ras-cluster-feeder-coverage` | Every RAS B1–B5 cluster has an event feeder; B2 Herstatt lights on mid-settlement trade | RAS feeder integrity | ✅ |
| `ras-register-parity` / `ras-b2-calibration-coverage` | RAS register single-source parity; B2 calibration present | RAS register | ✅ |

**Monitoring gaps (FX risks with NO gate):**
- **No gate on reporting-submission completeness.** Nothing asserts that a BA-310 (FX NOP)
  return was actually generated + submitted per period (because the subscriber is unwired —
  G5.1). *Close-plan:* `recon:expected-event-watchdog` entry for monthly BA-310 emit.
- **No gate on settlement-completion / Herstatt close.** The B2 *feeder* is gated, but nothing
  asserts that an opened settlement-window (B2) eventually closes within Herstatt tolerance
  (i.e. no perpetually-open settlement legs). *Close-plan:* Rohan — `recon:fx-settlement-window-staleness`
  (net-new) FAILing on a B2 window open beyond N business days.
- **No gate on FinSurv submission.** The stub emits `pending`; nothing asserts every
  cross-border `FxTradeExecuted` produced a (stub) FinSurv `TradeReportSubmitted`. *Close-plan:*
  `recon:finsurv-coverage` (net-new) — every AD-reportable FX flow has a report.

---

## Cross-cutting

**Multi-currency discipline (Principle 5).** Currency is at the type level (`currencyPairSchema`,
`moneySchema` in `platform/markets/cdm/fx.ts`; no default currency). **But** the executable
layer is still ZAR/USD-centric: CoA receivable/payable pairs exist only for ZAR/USD; nostros
for ZAR/USD/EUR; everything else degrades to the `ACC-2100-007` suspense (safe, but not
provisioned). Reporting currency (ZAR) is correctly presentation-only in BA-310
(`netPositionFunctionalMinor`, functional-ccy leg excluded). **Net:** type-level discipline is
(a); executable per-ccy provisioning is the live Principle-5 debt (G2.1 / G6.2).

**Market-data provenance.** `platform/market-data/store.ts` tags every tick `production |
simulated`, defaulting reads to `production` (safe default — a forgotten filter cannot leak
simulated marks into valuation). Live production FX feed: Twelve Data via
`runtime/agents/devon-fx-twelvedata-ingest.ts` (source `twelve-data`), 8 pairs (USD/ZAR,
EUR/ZAR, GBP/ZAR, JPY/ZAR, CHF/ZAR, AUD/ZAR, EUR/USD, GBP/USD). Simulation feed: `fx-sim`
source via `platform/simulation/fx-sim-rates.ts` (reseed every `RESEED_EVERY_N_TICKS=10`;
`resolveSeedMidRates` re-anchors to production ticks, excluding fx-sim). Official-mark
adoption: `adoptDailyOfficialFxMarks` marks the whole feed universe daily (idempotent), wired
into `rohan-daily-mtm` (cron). IPV: dual-feed (open-er-api primary + twelve-data secondary)
with `IpvExceptionRaised`; tolerance recalibrated per-pair.

---

## Appendix — what was verified retired vs retained (anti-overstatement)

- **`platform/accounting/gl-posting-engine.ts`** — GONE (retired #1094–#1098). Confirmed: no
  such file; `runtime/agents/bea-gl-posting-engine.ts` is the live subscriber and imports no
  legacy journal function.
- **`platform/accounting/posting-rules/fx-spot.ts`** — RETAINED but NOT a production posting
  path. Survives as (i) the `FX_ACCOUNTS` constant source (imported by the live handler), (ii)
  the parity oracle for `fx-subledger-trade-reconciliation.ts`, (iii) parallel-run byte-for-byte
  reference (`pr-fx-001.rule.json`). Its `fxSettlementJournals` (PR-FX-003) is `@deprecated`.
  **This is the brief's "buildFxSubLedger defined-but-never-wired" honesty applied: the journal
  functions exist but production posting goes through the SLA interpreter.**
- **SLA interpreter** — SOLE production FX posting path; `PRODUCTION_REPRESENTATIONS =
  ["IFRS", "SARB-BA-RETURN"]`; `posting-engine-single-subscriber` guards double-posting.
