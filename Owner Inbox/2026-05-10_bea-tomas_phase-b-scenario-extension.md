---
title: First Dry-Run Scenario Phase-B extension — settlement + sub-ledger + period close
author: Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO), Tomas (Operations & payments engineer, engineering — reports to Devon COO)
date: 2026-05-10
summary: Extends prototype/scenarios/03-fx-end-to-end-rehearsal.ts with Phase-B choreography per pack §2.2 (T7a, T8–T14). Phase B emits 11 net-new events that drive the FX-spot trade from execution through settlement, sub-ledger postings, account-balance updates, period open, FX revaluation, and period close (TrialBalanceSnapshotted + AccountingPeriodClosed via the canonical Slice-2 orchestrator). Three substrate gaps surfaced for the roadmap.
decision-required: false
---

# Phase B — settlement + sub-ledger + period close

## 1. Authority + scope

- **Standing decision:** `D-FIRST-DRY-RUN-SCENARIO` (CEO-approved 2026-05-10). No new CEO decision required; this is engineering-only execution under the no-pause rule (CLAUDE.md "Dispatch discipline").
- **Pack reference:** [`Owner Inbox/actioned/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`](actioned/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md) §2.2 (T8–T14) and §5 Phase B.
- **Scope:** extend the Phase-A scenario script (PR #163, merged) with Phase-B steps. Out of scope: IFRS statements (Phase C), BA returns (Phase D), risk reports (Phase E).

## 2. Files touched

| File | Change |
|---|---|
| `prototype/scenarios/03-fx-end-to-end-rehearsal.ts` | extended with `buildPhaseBPreCloseEvents()` builder + `runPhaseAandB()` runner + Phase-B factories (sub-ledger posting, account-posting-recorded). Local `SimulatedClock` shim gained `advance(ms)` + `setTo(iso)` so Phase B can jump to settlement-date and month-end deterministically. |
| `prototype/tests/scenarios-fx-end-to-end-phase-b.test.ts` | new 13-test suite — pre-close builder shape + provenance + entity binding + post-settlement balance assertions + end-to-end runner. |
| `prototype/package.json` | unchanged — `bun run scenario:dry-run-fx` continues to be the entry point, now runs Phase A + Phase B. |

The Phase-A test (`tests/scenarios-fx-end-to-end.test.ts`) is unchanged and continues to pass — Phase B is an extension, not a replacement.

## 3. Phase-B choreography (events emitted)

Total: **11 Phase-B events** appended to the event store after the Phase-A 11.

| Step | Event type | Owner | Notes |
|---|---|---|---|
| T7a | `SubLedgerPostingEmitted` (`postingType: trade-date-booking`) | Bea | Two legs — long USD (debit FX-position-stub), short ZAR (credit FX-position-stub). |
| T8  | `FxSettlementInstructed` (USD leg) | Tomas | `settlementPath: correspondent`, `messageStandard: ISO-20022-pacs.009`, `netCash: USD +5,000,000.00`. |
| T9  | `FxSettlementInstructed` (ZAR leg) | Tomas | `netCash: ZAR -92,500,000.00`. |
| T10a | `SubLedgerPostingEmitted` (`postingType: settlement-confirmation`) | Bea | USD leg true-up — debit USD nostro, credit FX-pending. |
| T10b | `AccountPostingRecorded` | Tomas | USD nostro `cashAmountMinor: +5,000,000_00`. Convention-shape event the bank-account `accountBalanceProjection` folds. |
| T11a | `SubLedgerPostingEmitted` (`postingType: settlement-confirmation`) | Bea | ZAR leg true-up — debit FX-pending, credit ZAR nostro. |
| T11b | `AccountPostingRecorded` | Tomas | ZAR nostro `cashAmountMinor: -92,500,000_00`. |
| T12 | `AccountingPeriodOpened` | Bea | `periodId: 2026-Q1-M01`, `functionalCurrency: ZAR`, emitted by the `openPeriod` orchestrator. |
| T13 | `SubLedgerPostingEmitted` (`postingType: revaluation`) | Rohan-model | USD/ZAR 18.5000 → 18.4500; ZAR 250,000 loss on long USD position; debit FX-revaluation-P&L, credit FX-position. |
| T14a | `TrialBalanceSnapshotted` | Bea | Emitted by `closePeriod` orchestrator; `snapshotKind: close`, 7 rows, per-currency totals balanced (debits = credits). |
| T14b | `AccountingPeriodClosed` | Bea | References `T14a.event_id`; `uptoSequence` = 4 (sub-ledger postings inside period). |

## 4. Observable balance changes (pre/post settlement)

The bank-account balance projection (`accountBalanceProjection` from `D-BANK-ACCOUNT-SUBSTRATE`) folds Phase A capital + Phase B settlement postings into:

| Account | Pre-Phase-B | Post-Phase-B |
|---|---|---|
| ZAR capital (`account:hoz-bank:capital:zar:share-capital`) | ZAR 300,000,000.00 (from Phase-A `CapitalContributionRecorded`) | unchanged |
| USD nostro (`ACC-USD-NOSTRO-001`) | 0 | **USD 5,000,000.00** |
| ZAR nostro (`ACC-ZAR-NOSTRO-001`) | 0 | **ZAR -92,500,000.00** |

The test `account-balance projection reflects post-settlement balances` asserts these exact values.

## 5. Period-close artefact

- **Trial-balance snapshot:** 7 rows surviving the zero-net drop, per-currency-balanced. Per-currency totals: `USD: debit 500,000,000 / credit 500,000,000`, `ZAR: debit ~9,250,250,000 / credit ~9,250,250,000` (cents, including the revaluation row).
- **EvSS Slice-2 snapshot row:** the `closePeriod` orchestrator caches the trial-balance under stream-key `BANK-ZA-001|accounting-period`. `replayFromSnapshot` consumers (Phase-C IFRS renderer, Phase-D BA-325 generator) read this snapshot.
- **Document store hash:** not emitted in Phase B (the runner omits the optional `documentStore` arg). When wired for Phase C / D, the BLAKE3 hash will land on both `TrialBalanceSnapshotted.documentHash` and `AccountingPeriodClosed.trialBalanceDocumentHash`.

## 6. Substrate gaps surfaced

Three gaps named by Phase B for the roadmap:

1. **No `FxSettlementSettled` event family.** The CDM (`@platform/markets/cdm/fx`) defines `FxSettlementInstructed` but no settlement-confirmation event. Phase B represents "ack received" semantics today via `SubLedgerPostingEmitted` (true-up) + a convention-shaped `AccountPostingRecorded` event. **Routes to:** Tomas roadmap — settlement-confirmation event family folds into a future `D-FX-SETTLEMENT-CONFIRMATION` sub-decision (or under `D-FX-CLS-MEMBERSHIP` correspondent-routing). When it lands, Phase B's two `AccountPostingRecorded` events are deleted; the projection folds the canonical confirmation event directly.
2. **No `RevaluationApplied` event family.** Month-end IAS-21 / IFRS-9 FX revaluation is an M2-territory event type (named in pack §2.2 T13 and §3 gap #5). Phase B emits the revaluation row as `SubLedgerPostingEmitted` with `postingType: "revaluation"`; the trial-balance fold treats it uniformly. **Routes to:** `D-REPORTING-CAPABILITY-M2-M3` Slice 6+ revaluation-engine slice (Bea + Atlas). When wired, the synthetic posting deletes; the revaluation engine subscribes to position events + the period-end trigger and emits the canonical event.
3. **Posting-rules engine implicit.** Phase B hand-rolls trade-date and settlement-date postings to the same double-entry shape as Bea's M1 IFRS classification handler emits for equity trades. **Routes to:** `D-REPORTING-CAPABILITY-M2-M3` Slice 2.5 (posting-rules engine — pack §3 gap #3). When that slice lands, the scenario routes the trade event through the posting-rules engine; the hand-rolled posting code deletes.

All three gaps are pre-named in the dry-run pack. Phase B has not introduced any new gap; it has exercised the named ones in production-shaped sequence.

## 7. Recon assertions covered

Per pack §2.6, Phase B exercises assertions **1, 2, 3, 6, 7**:

- **#1 Balance-sheet tied to sub-ledger.** Trial-balance is derived from `SubLedgerPostingEmitted` fold; the close orchestrator's per-currency-balanced invariant (`debits = credits` per currency) holds by construction.
- **#2 Sub-ledger tied to events.** Trial balance is a pure projection of events filtered by `entity = BANK-ZA-001` over `[periodStart, periodEnd]`; reproducibility witness is the `uptoSequence` field on `TrialBalanceSnapshotted`.
- **#3 Account balances tied to events.** `accountBalanceProjection` fold over Phase A + Phase B yields exact expected balances (asserted in test `account-balance projection reflects post-settlement balances`).
- **#6 Provenance discipline.** Every Phase-B event carries `kind: 'simulated', scenario: 'first-dry-run-2026-Q1', sourceLineage: 'scenario-runner:03-fx-end-to-end-rehearsal'` (asserted; runner provenance recon `ok=true`).
- **#7 Cross-reference rule.** No production-tagged event references Phase B; no Phase-B event references a production event. Verified by isolated event-store per run (test uses `mkdtempSync`).

Assertions #4 (PositionProjection) and #5 (BA-325 LCR cells) are out of Phase-B scope.

## 8. CI status

Run `bun run ci` from `prototype/` — green at the time of this PR.

- Typecheck: clean.
- Phase-A test: 9/9 pass (no regression).
- Phase-B test: 13/13 pass.
- Citation-gate: clean (every event in Phase B carries ≥1 citation; Principle 2).
- Recons: clean.

## 9. Acceptance + next steps

- `bun run scenario:dry-run-fx` runs Phase A + Phase B end-to-end. Output: `emitted: 22, phaseBEmitted: 11, ok: true, trialBalanceRowCount: 7`.
- Phase C (IFRS financial statements) — Bea, sequenced after Phase B merge.
- Phase D (BA 325 LCR + BA 700 IRRBB stub) — Mira, parallel-dispatched.
- Phase E (risk reports) — Helena, sequenced after Phase D.

## 10. Identity discipline

- **Bea** — Accounting & financial reporting engineer, engineering (reports to Camille, CFO).
- **Tomas** — Operations & payments engineer, engineering (reports to Devon, COO).
- **Saskia** — Head of Global Markets, governance (Phase-A trade-execution leg owner; downstream consumer).
- **Atlas** — Core banking platform architect, engineering (substrate consult on `period-close.ts` orchestrator and `D-BANK-ACCOUNT-SUBSTRATE`).
- **Anya** — Data & semantic-layer engineer, engineering (downstream Phase-C consumer of `TrialBalanceSnapshotted`).
- **Vera** — Quality engineer / internal audit, third-line (recon assertion owner).
- **Camille** — Chief Financial Officer, governance (Bea's reporting line; period-close governance owner).
- **Devon** — Chief Operating Officer, governance (Tomas's reporting line; settlement governance owner).
- **Helena** — Chief Risk Officer, governance (Phase-E owner; downstream).
- **Mira** — Compliance / RegTech engineer, engineering (Phase-D owner; downstream).
- **Rohan** — Quantitative analyst, engineering (revaluation-model service actor on T13).
