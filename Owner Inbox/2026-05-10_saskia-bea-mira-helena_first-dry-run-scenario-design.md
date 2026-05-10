---
title: First Dry-Run Scenario — design pack (D-FIRST-DRY-RUN-SCENARIO)
author: Saskia (Head of Global Markets, governance) · Bea (Accounting & financial reporting engineer, engineering) · Mira (Compliance / RegTech engineer, engineering) · Helena (Chief Risk Officer, governance) · Atlas (Core banking platform architect, engineering — substrate consult)
date: 2026-05-10
summary: End-to-end choreography that proves the bank can operate — open simulated bank accounts, execute one simulated FX spot trade with a synthetic counterparty, settle, run a one-month period close, render IFRS financial statements (skeleton), produce BA 325 LCR (and one BA 700 IRRBB stub), produce risk reports (RAS dashboard + risk register + ICAAP narrative-data extract). Five phases A–E, each with a rendered demo Marc reviews. Cites 12+ existing substrate components; folds 9 net-new gaps into existing slice plans where possible (5 fold-in, 3 new sub-slices, 1 deferred). Smallest Phase-A dispatch set is four briefs, each embedded.
decision-required: true
decision-id: D-FIRST-DRY-RUN-SCENARIO
decision-category: medium-term
decision-owner: Saskia (Head of Global Markets) · Bea (Accounting & financial reporting engineer) · Mira (Compliance / RegTech engineer) · Helena (Chief Risk Officer)
decision-for-ceo: Approve scenario scope (Hoz Bank solo, single ZAR/USD spot trade, one-month period, generic synthetic counterparty) + phased execution plan A–E + folding/scoping of the 9 net-new gaps + Phase-A dispatch authorisation (4 briefs).
decision-recommendation: Approve as drafted. The scenario is the smallest end-to-end choreography that exercises every load-bearing seam (event-store provenance → product-construction → posting-rules → period-close → semantic-layer → render → recon). Phase A's four-brief dispatch set is sized to the Targeted budget and depends only on Provenance Slice 1 (in-flight). Defaults answer the five open questions toward the simplest viable rehearsal; expansion to multi-entity / multi-trade / wider currency pairs sequences in later workstreams (D-DRY-RUN-SCENARIO-V2).
---

# First Dry-Run Scenario — design pack

**Authors and division of labour.**
- **Saskia** (Head of Global Markets, governance) — owns §1 scope framing, §2 choreography for trade execution + settlement, §6 Phase-A FX dispatch, §7 Q1+Q3+Q5 (entity / counterparty / scale).
- **Bea** (Accounting & financial reporting engineer, engineering — reports to Camille, CFO) — owns §2 sub-ledger / period-close legs, §5 Phase-B + Phase-C, §7 Q2 (period), §8 fold-ins for posting-rules + IFRS renderer + bank-account family + account-balance projection, §9 Camille hook.
- **Mira** (Compliance / RegTech engineer, engineering — reports to Zara, CCO) — owns §2 BA-325 leg, §5 Phase-D, §8 fold-in for regulator-portal simulator, §9 Zara hook + Vera hook (recon assertions).
- **Helena** (Chief Risk Officer, governance) — owns §2 risk-reporting leg, §5 Phase-E, §8 fold-in for risk-report renderer, §9 own hook.
- **Atlas** (Core banking platform architect, engineering — substrate consult) — sanity-checks §3 gap inventory against the substrate-completeness budget, §4 standing-approved-slice mapping, §5 dependency ordering.
- **Scrooge** (Chief of Staff) — dispatched the pack; embedded in §6 dispatch briefs.

**For:** Marc (CEO).
**Date:** 2026-05-10.
**Authority:**
- CLAUDE.md "Operating model — what is real, deferred, paused" (build phase has a defined endpoint; rehearsal-grade substrate is production-shaped)
- CLAUDE.md Principles 1 (events as truth), 2 (citation discipline), 5 (multi-currency / multi-entity), 6 (single-graph), 7 (autonomous-by-default)
- `Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md` — build-only; no live data until SARB licence
- `Owner Inbox/2026-05-09_scrooge_testing-strategy-simulated-data.md` §3.3, §4 — synthetic continues post-licence; provenance discipline
- `D-DATA-PROVENANCE-SUBSTRATE` (CEO-approved 2026-05-10, Slices 1-3 standing-authorised; spec at `Owner Inbox/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md`) — every event in the dry-run carries `kind: 'simulated', scenario: 'first-dry-run-2026-Q?'`
- `D-MARKETS-SCHEMA-FOUNDATION` (CEO-approved 2026-05-07; `Owner Inbox/2026-05-07_ceo-decision_markets-schema-foundation.md`) — FX CDM at `prototype/platform/markets/cdm/fx.ts`
- `D-PRODUCT-CONSTRUCTION-SUBSTRATE` (CEO-approved 2026-05-10; `Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md`) — Slices 1-3 merged (PRs #113 / #114 / #115); Slices 4-8 standing-approved
- `D-FX-SALES-TRADING-FRONTEND` (CEO-approved 2026-05-10; `Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md`) — Slice 1 merged (PR #154); Slices 2-8 standing-approved
- `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10; `Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`) — Slice 1 merged (PR #156); Slices 2-8 standing-approved
- `D-REGULATORY-READINESS-W2-SLICE-1` (`Owner Inbox/2026-05-10_helena-camille_w2-slice-1-icaap-ilaap-recovery-framework.md`) — RAS B-cluster + ICAAP/ILAAP framework
- `D-LEGAL-ENTITY-TREE-V0` (PR #82) + `D-REGULATORY-PERIMETER` (PR #85) — Hoz Group / Hoz Bank / Hoz Securities
- `D-EVENT-STORE-SCALING` (CEO-approved 2026-05-10) — snapshot substrate the dry-run reads through
- `D-RMS-PHASE-1` (CEO-approved 2026-05-09; `Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`) — record substrate the dry-run files outputs into

**Status.** Specification only. No code lands on this brief. No new event types in this PR. Approval governs which Phase-A slice briefs Scrooge dispatches next.

> **Derivation note (Principle 6 — downward).** This pack sits at the *standard* layer. It composes already-approved standards (provenance substrate, product-construction substrate, reporting-capability plan, FX front-end plan, W2 ICAAP/ILAAP framework) into a single end-to-end choreography. It authors no principle-level substance, no policy substance, no new regulation anchors. Every step in §2 cites either an existing PR / decision or a standing-approved slice family.

---

## 1. Purpose + scope

### 1.1 Purpose

Marc (CEO) asked, once the simulation logic is in place, for an end-to-end dry-run that proves the bank can operate: open simulated bank accounts → execute a simulated FX trade with a simulated counterparty → settle and post → render IFRS financial statements → produce SARB regulatory returns → produce risk reports. **Every event in the chain carries `kind: 'simulated', scenario: 'first-dry-run-2026-Q?'`** under the typed `ProvenanceTag` (per `D-DATA-PROVENANCE-SUBSTRATE` §3.1). Outputs render with simulated badges (per the same decision §7 watermarking). This is the rehearsal that proves the substrate works end-to-end and demonstrates to Marc — and ultimately to the SARB Prudential Authority at licence-application moment — that the bank's stack composes.

### 1.2 Scope (recommended defaults — see §7 for the open questions Marc resolves)

- **One legal entity:** Hoz Bank (`LE-ZA-HOZ-BANK`). Group consolidation and Hoz Securities folded into `D-DRY-RUN-SCENARIO-V2`.
- **One trade:** ZAR/USD spot, mid-size (USD 5,000,000 notional, T+2 settlement). Single direction (Bank buys USD vs. ZAR).
- **One counterparty:** generic synthetic — `SimulatedBank Co.` (`CP-SYN-DRYRUN-001`). Avoid any real-counterparty name to eliminate confusion in screenshots / outputs.
- **One currency pair:** ZAR + USD. No NDF, no swap, no forward; spot only.
- **Scenario period:** one calendar month. Trade booked on day 1, settles T+2, sits open for the remainder. Period close at month-end.
- **One scenario id:** `first-dry-run-2026-Q1` (calendar Q-id is presentational; the scenario id is the canonical handle).

### 1.3 Non-goals (explicitly excluded from this dry-run)

- Multi-trade portfolio (deferred to V2; Phase B+ may expand if Marc approves Q5 = portfolio).
- Multi-currency basket (V2; e.g. EUR / GBP / JPY pairs).
- IRD / bond / repo / equity (out of scope; rehearsal is FX spot only).
- Real-regulator submission (regulator-portal **simulator** only; gap #7 in §3, deferred).
- Cross-entity intercompany flows (single-entity scope).
- IFRS notes 100% complete (rehearsal-grade skeleton is fine; full notes wait for Camille's formal accounting-policies sign-off at licence-day).
- Live audit-committee or Board sign-off (no human governance bodies stood up yet).
- POPIA-style synthetic-data masking (orthogonal — Iris + Mira slice per testing-strategy brief §6 #6).

---

## 2. Choreography map

ASCII timeline below; every step names the event type, the actor (the agent that emits it in the autonomous fleet), the downstream consumers (which projections / handlers fire), the provenance-tag values, and the rendered artefact (if any).

All events carry `provenance: { kind: 'simulated', scenario: 'first-dry-run-2026-Q1', sourceLineage: 'scenario-runner:03-fx-end-to-end-rehearsal' }`. Citation set per Principle 2 named in column 5.

### 2.1 Phase A — Open accounts + execute trade

```
T0  D+0 09:00  AccountOpened (LE-ZA-HOZ-BANK · ZAR · nostro at SimulatedBank Co.)        — Tomas
                consumer: AccountMasterProjection (NEW), AccountBalanceProjection (NEW, 0)
                citation: ORG-BANKS-ACT-94-1990 (capital instruments registered);
                          INTERNAL-FINANCE-CHART-OF-ACCOUNTS (cash-and-equivalents leaf)
                output: account-master register row visible in dashboard

T1  D+0 09:01  AccountOpened (LE-ZA-HOZ-BANK · USD · nostro at SimulatedBank Co.)        — Tomas
                consumer: AccountMasterProjection, AccountBalanceProjection
                same citation as T0

T2  D+0 09:02  AccountOpened (LE-ZA-HOZ-BANK · ZAR · capital account)                    — Tomas
                consumer: AccountMasterProjection, AccountBalanceProjection
                citation: ORG-BANKS-ACT-94-1990 § 70 (capital);
                          INTERNAL-FINANCE-CAPITAL-PLAN-V1 (Camille)

T3  D+0 09:03  CapitalContributionRecorded (LE-ZA-HOZ-BANK · ZAR 300,000,000)            — Bea
                consumer: AccountBalanceProjection (capital ↑); SubLedgerProjection
                citation: INTERNAL-FINANCE-CAPITAL-PLAN-V1
                output: opening balance sheet visible (capital, cash, no liabilities)

T4  D+0 10:00  CounterpartyMaster row (CP-SYN-DRYRUN-001) — pre-existing               — Niko
                substrate: prototype/scenarios/02-onboard-counterparty.ts pattern
                NB: not a new event in this scenario; we *replay* the onboarding flow
                with the dry-run scenario tag, then reference the activated CP.

T5  D+0 11:00  RfqRequested (CP-SYN-DRYRUN-001 · USD/ZAR spot · USD 5m)                  — Saskia
                consumer: RfqProjection (FX desk); pricing-model triggered
                citation: D-MARKETS-SCHEMA-FOUNDATION; INTERNAL-NPA-FX-SPOT
                output: RFQ tile visible on FX desk (PR #154 UI shell)

T6  D+0 11:01  PricingModelEvaluated (synthetic mid-rate USD/ZAR = 18.5000, ±5pip)       — Rohan
                consumer: RfqProjection (priced)
                citation: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 4 (pricing-model registration)

T7  D+0 11:02  TradeExecuted (FX spot · USD 5,000,000 · ZAR 92,500,000 · T+2 · TRADING)  — Saskia
                consumer: TradeRecordProjection, PositionProjection,
                          SubLedgerProjection (trade-date posting), RasMonitorProjection
                citation: ORG-MK-08-EXCON-AD-RULES; D-FX-BOOK-BOUNDARY (bookType=TRADING);
                          ISDA-MASTER-2002; INTERNAL-COUNTERPARTY-CREDIT-POLICY
                output: position blotter shows +USD 5m / -ZAR 92.5m visible on FX desk
```

**End-of-phase-A demo (Marc reviews):**
- Account-master register (4 rows: ZAR nostro, USD nostro, ZAR capital, sundry).
- Opening balance sheet (assets = ZAR cash 300m; equity = ZAR capital 300m).
- FX desk: one open trade ticket; position blotter shows USD long / ZAR short.
- Every screen carries the `SIMULATED · scenario: first-dry-run-2026-Q1` watermark (per provenance Slice 3).

### 2.2 Phase B — Settlement + period close

```
T8   D+2 10:00  SettlementInstructed (USD leg · pacs.009 → SimulatedBank Co.)            — Tomas
                consumer: SettlementInstructionProjection
                citation: D-FX-CLS-MEMBERSHIP (correspondent-routing);
                          ORG-MK-08-EXCON-AD-RULES
                output: outbound-MT202 stub written to scenario-output dir

T9   D+2 10:01  SettlementInstructed (ZAR leg · pacs.009 → SimulatedBank Co.)            — Tomas

T10  D+2 14:00  SettlementSettled (USD leg · ack received)                                — Tomas
                consumer: AccountBalanceProjection (USD nostro +5m);
                          SubLedgerProjection (settlement-date true-up)

T11  D+2 14:01  SettlementSettled (ZAR leg · ack received)                                — Tomas
                consumer: AccountBalanceProjection (ZAR nostro -92.5m);
                          SubLedgerProjection (settlement-date true-up)
                output: post-settlement balance sheet visible

T12  D+M 17:00  PeriodCloseInitiated (LE-ZA-HOZ-BANK · 2026-Q1-M01)                       — Bea
                consumer: PeriodCloseProjection; reporting-engine watermark
                citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 2

T13  D+M 17:01  RevaluationApplied (open USD position · spot 18.4500 → P&L unrealised)   — Rohan
                consumer: SubLedgerProjection (FX revaluation)
                citation: IFRS-9 (FVTPL); IAS-21 (FCY translation)

T14  D+M 17:02  PeriodCloseFinalised (LE-ZA-HOZ-BANK · 2026-Q1-M01 · seal hash)           — Bea
                consumer: SemanticLayerProjection (period-as-of frozen)
                output: period-close certificate (PDF stub) in scenario-output dir
```

**End-of-phase-B demo:**
- Account-balance projection: post-settlement balances correct (USD nostro +5m, ZAR nostro 207.5m).
- Sub-ledger journal: trade-date posting, settlement-date true-up, month-end revaluation — all reconcile to balance-sheet movements (Vera recon: balance-sheet-tied-to-sub-ledger assertion green).
- Period-close certificate visible: seal hash, frozen as-of, scenario tag.

### 2.3 Phase C — IFRS financial statements

```
T15  D+M 18:00  FinancialStatementGenerated (LE-ZA-HOZ-BANK · IFRS · 2026-Q1-M01)         — Bea
                consumer: SemanticLayerProjection; renders SoFP, P&L+OCI, SCE, SCF, notes-lite
                citation: IAS-1; IFRS-9; IFRS-7; IFRS-13; IAS-21; IAS-7
                output: HTML + PDF skeleton AFS in scenario-output dir
                               (Hoz Bank solo; rehearsal-grade)
```

**End-of-phase-C demo (the centrepiece for Marc):**
- Statement of Financial Position (single-entity Hoz Bank).
- Statement of Profit or Loss + OCI (one revaluation line; no revenue yet).
- Statement of Changes in Equity (capital contribution, no movement otherwise).
- Statement of Cash Flows (capital injection inflow; settlement movements).
- Notes-lite (financial-instruments classification table, fair-value-hierarchy table, FX exposure table).
- Watermarked `SIMULATED — first-dry-run-2026-Q1` on every page (per provenance Slice 3).

### 2.4 Phase D — Regulatory return (BA 325 LCR + BA 700 IRRBB stub)

```
T16  D+M 18:30  RegulatoryReturnGenerated (LE-ZA-HOZ-BANK · BA-325 · 2026-Q1-M01)         — Mira
                consumer: SemanticLayerProjection; LCR-cell extractor
                citation: SARB-BANKS-ACT-REG-26 (LCR); BCBS-238
                output: BA-325 LCR worksheet (CSV + PDF) in scenario-output dir

T17  D+M 18:31  RegulatoryReturnGenerated (LE-ZA-HOZ-BANK · BA-700 · 2026-Q1-M01)         — Mira
                consumer: SemanticLayerProjection; market-risk-cell extractor
                citation: SARB-BANKS-ACT-REG-28 (market risk); BCBS-352
                output: BA-700 market-risk worksheet (CSV + PDF), one FX delta cell
                               populated; everything else zero

T18  D+M 18:35  RegulatorPortalSubmissionSimulated (BA-325 + BA-700 · stub)                — Mira
                consumer: RegulatorSubmissionLogProjection (NEW · trivial)
                citation: SARB-RETURN-SUBMISSION-PROCEDURE (synthetic)
                output: simulated-portal receipt JSON in scenario-output dir
```

**End-of-phase-D demo:**
- BA-325 LCR worksheet showing HQLA stack (cash-only, dominated by ZAR nostro), no net cash outflows (no real customers), LCR ratio = ∞ (recon assertion: divide-by-zero handled).
- BA-700 IRRBB / market-risk worksheet with a single FX delta cell (USD 5m at spot 18.45 → ZAR equivalent in market-risk RWA).
- Simulated submission receipt with the scenario watermark.

### 2.5 Phase E — Risk reports

```
T19  D+M 19:00  RasDashboardSnapshot (LE-ZA-HOZ-BANK · 2026-Q1-M01 · all-amber-or-green)  — Helena
                consumer: RasDashboardProjection (extends PR #60 B-cluster lines)
                citation: RAS-2026 (B-cluster FX-settlement-concentration);
                          D-REGULATORY-READINESS-W2-SLICE-1
                output: RAS dashboard HTML snapshot in scenario-output dir

T20  D+M 19:01  RiskRegisterSnapshot (LE-ZA-HOZ-BANK · 2026-Q1-M01)                       — Helena
                consumer: RiskRegisterProjection (NEW; thin)
                citation: ICAAP-FRAMEWORK-V0 (W2 Slice 1)
                output: risk-register HTML snapshot

T21  D+M 19:02  IcaapNarrativeDataExtracted (LE-ZA-HOZ-BANK · 2026-Q1-M01)                — Helena
                consumer: IcaapNarrativeDataProjection
                citation: D-REGULATORY-READINESS-W2-SLICE-1; SARB-ICAAP-PA-G3-2024
                output: ICAAP narrative-data extract (JSON + HTML) — populates the
                               "Pillar-1 capital usage" + "RAS adherence" sections of
                               the ICAAP document; no narrative authored yet
```

**End-of-phase-E demo:**
- RAS dashboard: B2 (FX settlement concentration) shows the day's exposure under appetite; B-cluster otherwise empty (no other trades).
- Risk register: one entry — "USD/ZAR spot exposure, T+2, SimulatedBank Co." — with risk-rating amber (single counterparty, single product, no diversification).
- ICAAP narrative-data extract — Pillar-1 capital usage (≈0; no real RWA), RAS-adherence table (one row, green), capital adequacy ratio (∞-ish given no RWA).

### 2.6 Cross-cutting — recon assertions

Vera (Quality engineer / internal audit, third-line) runs continuous recon at every projection. The dry-run is correct iff every assertion below is green:

1. **Balance-sheet tied to sub-ledger.** SoFP totals = sum of sub-ledger account balances at period-as-of.
2. **Sub-ledger tied to events.** Sub-ledger balances = projection of event log filtered by `scenario: first-dry-run-2026-Q1`.
3. **Account balances tied to events.** AccountBalanceProjection per account = sum of credit-debit events at period-as-of.
4. **Position tied to trades.** PositionProjection per currency = sum of executed trade legs at period-as-of.
5. **BA-325 LCR cells tied to semantic-layer entries.** Every populated LCR cell traces to a semantic-layer registry row.
6. **Provenance discipline.** Every event carries `kind: 'simulated', scenario: 'first-dry-run-2026-Q1'`. No mixed-provenance reads.
7. **Cross-reference rule.** No production-tagged event references this scenario; no scenario event is referenced by a production event.

---

## 3. Gap inventory — net-new gaps

| # | Gap | Net-new because | Where it folds | Engineering owner | Effort (sessions) |
|---|---|---|---|---|---|
| 1 | Bank-account event family + AccountMaster projection | No standing decision pack. CounterpartyMaster exists; AccountMaster does not. | New small sub-decision (D-BANK-ACCOUNT-SUBSTRATE) — three event types: `AccountOpened`, `AccountClosed`, `AccountMetadataUpdated`; one projection. | Tomas (Operations & payments engineer) lead; Atlas substrate consult | 2 |
| 2 | Scenario clock substrate (controlled time for dry-runs) | Today every event uses `Date.now()`; no way to fast-forward T+2 / month-end deterministically. | New small sub-decision (D-SCENARIO-CLOCK) — `ClockTickEvent` + scenario-runner injection point; substrate-only, no policy. | Atlas (substrate) lead | 1 |
| 3 | Posting-rules engine (trade events → sub-ledger postings) | Sub-ledger projection exists (`prototype/platform/projections/markets/sub-ledger.ts`) but the rule layer that translates `TradeExecuted` → debit/credit pairs is implicit in handler code. The reporting plan §4 names `IfrsClassificationApplied` but not the posting-rules layer. | Folds into D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN as Slice 2.5 (between period-close events and single-return generator). | Bea + Atlas | 2-3 |
| 4 | AccountBalance projection | Pairs naturally with #1; can't post to an account that has no balance projection. | Folds into the same D-BANK-ACCOUNT-SUBSTRATE sub-decision as #1. | Tomas + Bea | 1 |
| 5 | IFRS financial-statement renderer (rehearsal-grade) | D-REPORTING-CAPABILITY-M2-M3 Slice 6 (AFS skeleton) is the production version; we need a rehearsal-grade skeleton earlier to feed Phase C. | Folds into D-REPORTING-CAPABILITY-M2-M3 as **Slice 3.5** — rehearsal-grade IFRS renderer (AFS skeleton, notes-lite); Slice 6 production-grade supersedes later. | Bea | 2 |
| 6 | Risk-report renderer (RAS dashboard snapshot, risk register, ICAAP narrative-data extractor) | W2 Slice 1 (ICAAP/ILAAP framework) is policy-shaped, not renderer-shaped; existing RAS B-cluster lines (PR #60) are projection-only, no rendered artefact. | Folds into D-REGULATORY-READINESS-W2 as **Slice 2** (was: "B2 calibration"; Helena re-scopes Slice 2 to bundle B2 calibration + risk-report renderer). | Helena + Rohan + Owen (CoSec — board-pack output) | 2-3 |
| 7 | Regulator-portal simulator (SARB submission stub) | Reporting plan §1.2 explicitly names mock regulator endpoints in `prototype/simulators/` but no slice scopes them. | **Deferred** — rehearsal does not depend on a live portal; file-based output suffices. Surface as substrate gap (Atlas roadmap item) for V2. | Mira lead post-V2 | 1 |
| 8 | Trade-ticket emit-button on FX desk | Implicit FX Slice 2 scope — RFQ form Slice 2 already plans the workflow. | Confirms as **D-FX-SALES-TRADING-FRONTEND Slice 2** (RFQ form + emit). No new scope. | Kai | (already in Slice 2) |
| 9 | Scenario orchestration script `prototype/scenarios/03-fx-end-to-end-rehearsal.ts` | Pattern exists (01-hello-bank, 02-onboard-counterparty); engineering work, no decision. | Engineering only — written as part of Phase-A dispatch #4 below. | Saskia + Kai + Bea (co-author script) | 1 |

**Summary:** 5 gaps fold cleanly into existing standing-approved slice plans (gaps #3, #5, #6, #8 reposition; gap #4 pairs with #1); 2 gaps need small new sub-decisions (#1 D-BANK-ACCOUNT-SUBSTRATE, #2 D-SCENARIO-CLOCK); 1 deferred (#7 portal simulator); 1 is engineering-only (#9 orchestration script).

---

## 4. Gap inventory — standing-approved slices needed

| Slice family | Standing-approved decision | Slices required for dry-run | Phase |
|---|---|---|---|
| Provenance substrate | `D-DATA-PROVENANCE-SUBSTRATE` | Slices 1 (envelope + append rule), 2 (projection-runtime mode), 3 (output watermarking) | A (Slice 1 hard blocker; Slices 2-3 by Phase C) |
| Product-construction | `D-PRODUCT-CONSTRUCTION-SUBSTRATE` | Slices 1-3 (already merged: PRs #113 / #114 / #115) — used as-is. Slice 4 (pricing-model registration) needed for T6. | A |
| FX front-end | `D-FX-SALES-TRADING-FRONTEND` | Slice 1 merged (PR #154) — used as-is. Slice 2 (RFQ form + emit) needed for T5–T7. | A |
| Reporting capability M2-M3 | `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` | Slice 1 merged (PR #156) — semantic layer. Slice 2 (period-close events). Slice 2.5 (posting-rules engine — net-new fold-in per gap #3). Slice 3 (single-return generator harness). Slice 3.5 (rehearsal-grade IFRS renderer — net-new fold-in per gap #5). | B–C |
| Regulatory-readiness W2 | `D-REGULATORY-READINESS-W2-SLICE-1` | Slice 1 merged spec; Slice 2 re-scoped to bundle B2 calibration + risk-report renderer (gap #6 fold-in). Slice 3 (RWA engine — for BA-700 stub). | D–E |
| Bank-account substrate | new `D-BANK-ACCOUNT-SUBSTRATE` (gaps #1 + #4) | Three event types + AccountMaster projection + AccountBalance projection. | A |
| Scenario clock | new `D-SCENARIO-CLOCK` (gap #2) | Single sub-slice. | A |
| Onboarding replay | existing `prototype/scenarios/02-onboard-counterparty.ts` pattern | Used as-is (T4) — replays under the dry-run scenario tag. | A |

---

## 5. Phased execution plan

### Phase A — Open accounts + execute one trade
**Entry:** Provenance Slice 1 merged (in-flight, Atlas).
**Exit:** Marc sees opening balance sheet + one open FX trade with watermarked badge; recon assertions 1–4 + 6 green.
**Slice dependencies (must land first):**
1. Provenance Slice 1 (in-flight).
2. D-BANK-ACCOUNT-SUBSTRATE (new, gap #1).
3. D-SCENARIO-CLOCK (new, gap #2).
4. D-FX-SALES-TRADING-FRONTEND Slice 2 (RFQ form + emit; standing).
5. D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 4 (pricing-model registration; standing).
6. Scenario script `03-fx-end-to-end-rehearsal.ts` Phase-A wedge (engineering only).

**Rendered demo:** Account-master register tile in dashboard (4 rows), FX desk with one open trade and position blotter, opening SoFP HTML stub. **All carry the `SIMULATED · scenario: first-dry-run-2026-Q1` watermark.**

### Phase B — Settle + period close
**Entry:** Phase A green.
**Exit:** Marc sees post-settlement balances correct + period-close certificate; recon assertions 1–4 + 6 + 7 green.
**Slice dependencies:**
1. Provenance Slice 2 (projection-runtime mode).
2. D-REPORTING-CAPABILITY-M2-M3 Slice 2 (period-close events).
3. D-REPORTING-CAPABILITY-M2-M3 Slice 2.5 (posting-rules engine; gap #3 fold-in).
4. (Tomas) settlement-instruction + settlement-settled handler wiring (folds under D-FX-CLS-MEMBERSHIP correspondent-routing).

**Rendered demo:** Settlement-instruction stubs (MT202 JSON), period-close certificate (HTML), reconciled sub-ledger journal.

### Phase C — IFRS financial statements
**Entry:** Phase B green.
**Exit:** Marc opens a five-statement HTML AFS skeleton + notes-lite for Hoz Bank solo; Camille (CFO) gives informal sign-off "this looks like a defensible rehearsal AFS".
**Slice dependencies:**
1. Provenance Slice 3 (output watermarking).
2. D-REPORTING-CAPABILITY-M2-M3 Slice 3 (single-return generator harness).
3. D-REPORTING-CAPABILITY-M2-M3 Slice 3.5 (rehearsal-grade IFRS renderer; gap #5 fold-in).

**Rendered demo:** SoFP, P&L+OCI, SCE, SCF, notes-lite (financial-instruments classification, FV hierarchy, FX exposure) — five HTML pages + a single-PDF concatenation, watermarked.

### Phase D — Regulatory return (BA-325 + BA-700 stub)
**Entry:** Phase C green.
**Exit:** Marc opens BA-325 LCR worksheet + BA-700 market-risk worksheet; Zara (CCO) gives informal sign-off "this looks like a defensible rehearsal return".
**Slice dependencies:**
1. D-REPORTING-CAPABILITY-M2-M3 Slice 4 (BA 325 LCR).
2. D-REPORTING-CAPABILITY-M2-M3 Slice 5 (BA 700 IRRBB / market-risk — first cell).
3. (deferred) regulator-portal simulator — stub the receipt JSON only.

**Rendered demo:** Two CSV+PDF pairs (BA-325, BA-700), one simulated-portal receipt JSON.

### Phase E — Risk reports
**Entry:** Phase D green.
**Exit:** Marc opens RAS dashboard snapshot + risk register + ICAAP narrative-data extract; Helena gives informal sign-off "this looks like a defensible rehearsal risk pack".
**Slice dependencies:**
1. D-REGULATORY-READINESS-W2 Slice 2 (B2 calibration + risk-report renderer; gap #6 fold-in).
2. D-REGULATORY-READINESS-W2 Slice 3 (RWA engine — first cell only, for ICAAP Pillar-1 numbers).

**Rendered demo:** RAS dashboard HTML, risk register HTML, ICAAP narrative-data JSON+HTML.

### End-of-rehearsal close-out

After Phase E, Saskia + Bea + Mira + Helena co-author a one-page "rehearsal report" that lands in `Owner Inbox/` (not decision-required) with:
- Phases A–E green / amber / red.
- Recon-assertion green-count.
- Substrate gaps surfaced during rehearsal (input to the substrate-completeness budget).
- Outputs index (links to every artefact rendered).

That report becomes the seed for the **PA licence-application demo pack** when Saskia + Rashida + Devon's pre-licence go-live readiness gate fires.

---

## 6. Smallest dispatch set for Phase A

Four briefs. All four can dispatch in parallel **after Provenance Slice 1 merges** (currently in flight under Atlas). Each is dispatch-ready as embedded below; Scrooge copies into `Team Inbox/` on Marc's approval.

### Dispatch #A1 — Bank-account event family + projections (D-BANK-ACCOUNT-SUBSTRATE)

> **To:** Tomas (Operations & payments engineer, engineering — reports to Devon, COO) lead · Atlas (Core banking platform architect, engineering — substrate) consult · Bea (Accounting & financial reporting engineer, engineering — reports to Camille, CFO) consult on chart-of-accounts mapping.
> **Worktree:** isolated; **never** `cd` to `/Users/marc/code/Bank`.
> **Brief.** Add three event types — `AccountOpened`, `AccountClosed`, `AccountMetadataUpdated` — to the event registry under the standard A0 schema-freeze gate. Build `AccountMasterProjection` + `AccountBalanceProjection` at `prototype/platform/projections/accounts/`. Wire to chart-of-accounts at `prototype/platform/accounting/_chart-of-accounts.md` (cite the leaf-account URN per opened account). Per CLAUDE.md "Dispatch discipline": scaffold-commit + push within ~10 min; push-retry on rejection; `bun run citation-gate` before push; identity discipline. CI green. PR titled `slice: Tomas+Atlas+Bea — bank-account event family + master/balance projections (D-BANK-ACCOUNT-SUBSTRATE)`.
> **Acceptance.** Three event types in registry; both projections pass recon "balance = sum of credit-debit events". Citation gate zero violations. CI green.
> **Effort.** 2 sessions.

### Dispatch #A2 — Scenario clock substrate (D-SCENARIO-CLOCK)

> **To:** Atlas (Core banking platform architect, engineering — substrate) lead.
> **Worktree:** isolated; never `cd` to main worktree.
> **Brief.** Add `ScenarioClockTick` event + scenario-runner injection point so dry-runs can fast-forward T+2 / month-end deterministically. Update `prototype/scenarios/02-onboard-counterparty.ts` to demonstrate the injection point (no behaviour change). Per CLAUDE.md "Dispatch discipline": scaffold-commit early, push-retry, citation-gate, identity. PR titled `slice: Atlas — scenario clock substrate (D-SCENARIO-CLOCK)`.
> **Acceptance.** `01-hello-bank.ts` and `02-onboard-counterparty.ts` continue passing. New `03-fx-end-to-end-rehearsal.ts` skeleton imports and uses the clock. CI green.
> **Effort.** 1 session.

### Dispatch #A3 — D-FX-SALES-TRADING-FRONTEND Slice 2 (RFQ form + emit)

> **To:** Kai (Trading systems engineer, engineering — reports to Saskia, Head of Global Markets) lead · Saskia (Head of Global Markets, governance) UX direction · Anya (Data / analytics engineer, engineering) projection-runtime support.
> **Standing approval:** D-FX-SALES-TRADING-FRONTEND CEO-approved 2026-05-10. Per CLAUDE.md no-pause rule, downstream slices dispatch without per-item confirmation.
> **Worktree:** isolated; never `cd` to main worktree.
> **Brief.** Build Slice 2 per spec: RFQ request form (counterparty, currency-pair, side, notional, value-date) → emits `RfqRequested` → fans out to pricer (synthetic mid-rate stub for the rehearsal) → emits `PricingModelEvaluated` → dealer clicks "Trade" → emits `TradeExecuted`. Wire to FX desk UI shell from PR #154. Provenance tag flows through. Per CLAUDE.md "Dispatch discipline": scaffold-commit, push-retry, citation-gate, identity. PR title per spec convention.
> **Acceptance.** RFQ tile flows end-to-end on the FX desk; emitted `TradeExecuted` event has all required CDM payload fields per `prototype/platform/markets/cdm/fx.ts`. Provenance tag carried through. CI green.
> **Effort.** 2 sessions.

### Dispatch #A4 — Phase-A scenario script wedge `03-fx-end-to-end-rehearsal.ts`

> **To:** Saskia (Head of Global Markets, governance) lead · Kai (Trading systems engineer, engineering) co-author · Bea (Accounting & financial reporting engineer, engineering) co-author.
> **Worktree:** isolated; never `cd` to main worktree.
> **Brief.** Author `prototype/scenarios/03-fx-end-to-end-rehearsal.ts` Phase-A wedge: emit T0–T7 from §2.1 above using the scenario-clock from A2, the bank-account events from A1, the existing counterparty replay pattern, and the existing FX CDM. Tag every event with `provenance: { kind: 'simulated', scenario: 'first-dry-run-2026-Q1', sourceLineage: 'scenario-runner:03-fx-end-to-end-rehearsal' }`. Pattern: `prototype/scenarios/02-onboard-counterparty.ts`. Per CLAUDE.md "Dispatch discipline": scaffold-commit, push-retry, citation-gate, identity. PR title per spec convention.
> **Acceptance.** Script runs to completion; emits the seven Phase-A events with correct payloads and provenance tags; recon assertions 1–4 + 6 green at end-of-script. CI green.
> **Effort.** 1 session.

**Total Phase-A budget: 6 sessions across 4 dispatches (parallelisable to ~2 wall-clock sessions if A1/A2/A3 fan out together; A4 sequences last).**

---

## 7. Open questions for CEO (default-approve under no-pause rule)

| # | Question | Recommended default | Rationale |
|---|---|---|---|
| Q1 | Which entity for first dry-run — Hoz Bank only, or all three? | **Hoz Bank only.** | Simpler; no consolidation mechanics; Group + Securities fold into V2. |
| Q2 | What's the simulated period — single day, week, month, quarter? | **Single calendar month.** Trade booked day 1, settles T+2, sits open; period close at month-end. | Smallest period that exercises a non-trivial period-close + a held position generating revaluation P&L. |
| Q3 | Counterparty — generic synthetic or named realistic? | **Generic synthetic** (`SimulatedBank Co.` / `CP-SYN-DRYRUN-001`). | Avoid any confusion with real counterparties in screenshots / outputs / regulator-portal stubs. |
| Q4 | Currencies — ZAR + USD only, or wider basket? | **ZAR + USD only.** | Smallest pair to exercise multi-currency; widest pair-coverage waits for V2. |
| Q5 | Scale — one trade or a small portfolio (~10 trades)? | **One trade for Phase A; expand to ~10 trades at Phase B+ if Marc wants more dynamic period-close.** | One trade is enough to exercise every seam; portfolio is presentational, not architectural. Recommend single trade for V1 to keep the demo readable. |

If Marc accepts all five defaults: approve as drafted. If any answer differs, the affected phases re-scope in a 1-page addendum (Saskia + Bea author) before Phase-A dispatch.

---

## 8. Net-new gap fold-in proposals (consolidated)

Restated from §3 with explicit fold targets:

1. **Bank-account event family** → new sub-decision **D-BANK-ACCOUNT-SUBSTRATE** (Tomas + Atlas; embedded as Phase-A dispatch #A1).
2. **Scenario clock** → new sub-decision **D-SCENARIO-CLOCK** (Atlas; embedded as Phase-A dispatch #A2).
3. **Posting-rules engine** → fold into **D-REPORTING-CAPABILITY-M2-M3 Slice 2.5** (Bea + Atlas; sequences after Slice 2 period-close events).
4. **Account-balance projection** → bundled into D-BANK-ACCOUNT-SUBSTRATE (#1).
5. **IFRS statement renderer (rehearsal-grade)** → fold into **D-REPORTING-CAPABILITY-M2-M3 Slice 3.5** (Bea; rehearsal-grade now, production-grade Slice 6 supersedes later).
6. **Risk-report renderer** → fold into **D-REGULATORY-READINESS-W2 Slice 2** re-scoped to bundle B2 calibration + risk-report renderer (Helena + Rohan + Owen).
7. **Regulator-portal simulator** → **deferred substrate-gap** (Mira lead post-V2). Rehearsal does not block on a live portal; file-based receipts suffice.
8. **Trade-ticket emit-button on FX desk** → confirmed as **D-FX-SALES-TRADING-FRONTEND Slice 2** scope (no new scope; Phase-A dispatch #A3).
9. **Scenario orchestration script** → engineering-only (Phase-A dispatch #A4).

---

## 9. Cross-cutting hooks

- **Atlas** (Core banking platform architect): substrate composition seam — the dry-run is the first end-to-end load test of the event-store + projection-runtime + provenance + RMS quartet. Surfaces any compositional gaps as substrate-completeness-budget findings.
- **Anya** (Data / analytics engineer): semantic-layer registry expansion — each return generated in Phase D adds rows; each IFRS line in Phase C adds rows. Anya's Slice-1 registry (PR #156) goes from 3 worked entries to ~50.
- **Camille** (Chief Financial Officer, governance): informal sign-off on the Phase-C IFRS skeleton — first time the bank produces a five-statement output. Camille's accounting-policies bundle (`Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`) is the citation backstop. Formal CFO sign-off comes at licence-day.
- **Zara** (Chief Compliance Officer, governance): informal sign-off on the Phase-D BA returns. Zara's W1 RMCP spec (`Owner Inbox/2026-05-10_mira-zara_w1-slice-1-rmcp-attestable-spec.md`) is the upstream framework; the BA returns are a separate (PA-prudential) channel.
- **Vera** (Quality engineer, engineering — third-line internal-audit tooling): assurance — the seven recon assertions in §2.6 become permanent recon harnesses. Vera's continuous-controls posture (per `Owner Inbox/2026-05-08_vera_*` series) means every recon failure is a finding, not a debug message.
- **Owen** (Company Secretary, governance): board-pack output — the Phase-E ICAAP narrative-data extract is the first piece of structured data that will eventually feed a Board pack. Owen's RMS substrate (`D-RMS-PHASE-1`) is the eventual filing channel.
- **Helena** (Chief Risk Officer, governance) — own work: B2 calibration in W2 Slice 2 is the first-time exercise of the FX-settlement-concentration appetite line on real (rehearsal) numbers. Surfaces calibration gaps for ICAAP §III.
- **Saskia / Rashida / Devon** (pre-licence go-live readiness gate co-owners): the rehearsal is the **proof-of-substrate** input to the gate. Each successful rehearsal advances the "demonstrable end-to-end readiness" criterion.

---

## 10. Substrate gaps surfaced beyond the 9

While designing the choreography, the four authors surfaced these additional substrate-completeness items (input to Atlas's substrate-completeness-budget at `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md`):

- **G10. Cross-projection as-of consistency.** When Phase C reads SoFP at month-end and Phase D reads BA-325 at month-end, both projections must materialise from the same event-log slice. Today, no shared "as-of" handle. Atlas: roadmap item under D-EVENT-STORE-SCALING (snapshot keys cover this once provenance lands).
- **G11. Output-artefact registry.** Phases A–E render ~15 artefacts (HTML/PDF/CSV/JSON). No registry today catalogues which artefact came from which scenario / which projection / which event-log slice. Atlas: roadmap item — small registry, RMS Phase-1 Document register may absorb.
- **G12. Recon-assertion lifecycle.** Vera's recon harnesses run continuously, but no event marks "recon assertion fired green / amber / red against scenario X at time T". Vera: roadmap item.
- **G13. Reverse-trace from output to events.** Click any cell in the BA-325 worksheet → see the events that contributed. Atlas + Anya: roadmap item under semantic-layer registry expansion.
- **G14. Scenario teardown / replay determinism.** The dry-run depends on deterministic replay (same input → same output). Today, `Date.now()` and any randomness break this. The scenario-clock substrate (#2) is one fix; the broader determinism budget is its own substrate-completeness item. Atlas: roadmap.
- **G15. Multi-scenario coexistence.** V2 (multi-trade, multi-currency, multi-entity) will run alongside V1 in the same event log. Provenance discipline handles separation, but UX for "show me only V1 outputs" is unspecified. Anya: roadmap item under provenance Slice 6 (toggle UX).

These G10–G15 are **not blockers** for V1; they are the V2-and-beyond inputs.

---

## 11. Summary for Marc

**One paragraph.** This is the smallest end-to-end rehearsal that proves the bank's substrate composes. Hoz Bank only, one synthetic counterparty, one ZAR/USD spot trade, one calendar month, one set of skeleton outputs (IFRS AFS + BA-325 LCR + BA-700 stub + RAS dashboard + risk register + ICAAP narrative-data). Every event carries the typed simulated provenance tag (`scenario: first-dry-run-2026-Q1`) and every render carries the watermark. Phase A's four-dispatch set depends only on Provenance Slice 1 (in-flight, Atlas) and lands the bank-account event family, the scenario clock, the FX RFQ→emit slice, and the orchestration script. The remaining four phases sequence on standing-approved slice plans (with three small fold-in sub-slices: posting-rules, rehearsal-grade IFRS renderer, risk-report renderer). Approving this pack authorises the four Phase-A dispatches and the three sub-slice fold-ins; the standing-approved slice families need no further authorisation.

---

**Authors (first-mention identity discipline per CLAUDE.md):**
- **Saskia** (Head of Global Markets, governance — owns the markets franchise; reports to CEO).
- **Bea** (Accounting & financial reporting engineer, engineering — reports to Camille, Chief Financial Officer).
- **Mira** (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer).
- **Helena** (Chief Risk Officer, governance — owns RAS + risk reporting; reports to CEO).
- Substrate consult: **Atlas** (Core banking platform architect, engineering — reports to Devon, Chief Operating Officer).
- Dispatched by: **Scrooge** (Chief of Staff / Orchestrator).
