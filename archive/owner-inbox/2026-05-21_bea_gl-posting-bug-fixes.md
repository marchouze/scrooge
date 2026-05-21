---
title: GL posting engine — two bug fixes (FxTradeCancelled + idempotent backfill of PR-FX-PRIN / PR-FX-LIFECYCLE-CLOSE)
author: Bea (Accounting platform engineer, engineering)
authored-on: 2026-05-21
workstream: WS-GL-POSTING-BUG-FIX
brief: brief:bea:fix-fxtradecancelled-event-name-backfill-princip:2026-05-21
citations:
  - urn:ifrs:9#3.2.3
  - urn:ifrs:9#5.7.1
  - urn:ias:21#28
  - urn:decision:D-MARKETS-SCHEMA-FOUNDATION
  - urn:decision:D-FX-SALES-TRADING-FRONTEND
  - urn:pr:616
---

# GL posting bug fixes — FxTradeCancelled handling + idempotent backfill

## §1 — Summary

Two compounding bugs in `prototype/runtime/agents/bea-gl-posting-engine.ts` had left the bank's GL with 15 FX cancellations un-reversed and zero cash legs against 8 `PrincipalPayment` / 4 CDM `SettlementConfirmed` events. Both are now fixed; the backfill (`bun run gl:backfill-postings`) is idempotent against the shared event store.

Authority: IFRS-9 §3.2.3 (derecognition); IAS-21 §28 (settlement-date FX gain/loss); D-MARKETS-SCHEMA-FOUNDATION; D-FX-SALES-TRADING-FRONTEND; PR #616.

## §2 — Bug 1 — wrong cancellation event-name

`bea-gl-posting-engine.ts:434` listened for `e.type === "TradeCancelled"`. The 15 cancellations emitted on 2026-05-19 used the FX-specific `FxTradeCancelled` event type, so the cancellation arm never fired and 15 trade-booking journals remained on the GL against trades that had been voided.

**Fix.** Extend the arm to fire on either event kind. Both payload shapes carry `tradeId: string` at the payload root — the only field the handler actually reads — so no adapter is required. `SUBSCRIBED_TYPES` and the replay set both include the new type. PR-FX-CANCEL (`fxCancellationJournals`) is unchanged.

## §3 — Bug 1B (latent) — `tradeId`-shape mismatch in the cancellation accumulator

While fixing bug 1, surfaced a second pre-existing defect in the same arm. The cancellation walks prior `SubLedgerPostingEmitted` events to reconstruct booking legs and cumulative unrealised P&L for the trade. To do so it looks up the source event's `tradeId`. `FxTradeExecuted` carries `tradeId` as an identifier object (`{scheme, value}`), but the lookup compared it as a string. The booking-leg accumulator was therefore always empty → the cancellation produced zero legs (silent skip) even when the arm fired.

**Fix.** Normalise both shapes (string and `{value}`) to the string form before comparison.

## §4 — Bug 1C (out-of-scope file, in-scope idempotency) — `bea-fx-posting-engine` reversal-double-emission

`bea-fx-posting-engine.ts:236-312` emits per-revaluation reversal postings on `FxTradeCancelled`. Its idempotency check used a synthetic key (`${event_id}:revaluation-reversal:<src>`) that did not match the persisted key (`${event_id}:reversal` — the canonical form `buildPostedKeySet` reconstructs). Every backfill re-run emitted N new reversal postings per cancellation; the shared store had drifted to 60 reversals against 15 revaluations by the time of investigation.

**Fix.** Added the canonical persisted-key check (`${event_id}:reversal`) as the outer idempotency guard on the cancellation arm, and add it to the in-memory set after the inner loop completes. The synthetic per-source key is retained as a belt-and-suspenders guard for multiple-revaluation-per-trade cases inside a single run. Backfill is now idempotent: re-runs emit 0 events.

## §5 — Bug 1D — double-undo of MTM at cancellation

After the bug-1 and bug-1C fixes, `bea-gl-posting-engine` and `bea-fx-posting-engine` both attempted to undo the cumulative MTM on cancellation: the GL engine via `fxCancellationJournals` (reverse the cumulative `ACC-2100-005` net), the fx engine via per-revaluation reversal postings. For `FxTradeCancelled` this is a double-undo. For `TradeCancelled` (non-FX), only the GL engine fires and the existing path is correct.

**Fix.** For `FxTradeCancelled` only, the GL engine sets `cumulativeUnrealisedPnlZarMinor: 0` before calling `fxCancellationJournals` — the GL engine reverses only the booking legs; the fx engine owns the MTM undo via its per-revaluation reversal postings. Net combined effect: `ACC-2100-005` back to net zero (verified in §8 after-table).

## §6 — Bug 2 — PR-FX-PRIN and PR-FX-LIFECYCLE-CLOSE backfill

The arms at `bea-gl-posting-engine.ts:390` (`PrincipalPayment` → `fxPrincipalPaymentJournals`, PR-FX-PRIN) and `:401` (CDM `SettlementConfirmed` → `fxLifecycleCloseJournals`, PR-FX-LIFECYCLE-CLOSE) were promoted to GL-significant by PR #616 (2026-05-20) but had never been exercised against the shared event store. `scripts/gl/backfill-postings.ts` (which composes both Bea engines) is the existing backfill mechanism; no code change is required beyond making the engine itself correct and idempotent.

**Fix.** Backfill executed against the shared store after the bug-1 / bug-1B / bug-1C / bug-1D fixes:

| Before | After (live shared store) |
|---|---|
| `cancellation` postings: 0 | 15 |
| `fx-principal-payment` postings: 0 | 8 |
| `fx-lifecycle-close` postings: 0 | 0 (see note) |
| `reversal` postings: 15 | 15 (idempotent — fx engine guard now stable) |

**Note on `fx-lifecycle-close`.** All 4 `SettlementConfirmed` events in the shared store carry `realisedPnlDelta: 0` (settlement at book rate). `fxLifecycleCloseJournals` correctly returns `[]` when `realisedPnlDelta === 0` (IFRS-9 §5.7.1: only *changes* in fair value are recognised; a zero change produces no entry — this is intentional no-GL-impact, see [`platform/accounting/posting-rules/fx-spot.ts:818`](../../prototype/platform/accounting/posting-rules/fx-spot.ts)). The engine emits no `fx-lifecycle-close` postings for these four events; that is correct accounting behaviour, not a substrate gap. Regression test #3 covers the non-zero-PnL path.

## §7 — GL account-balance before/after table

Live shared event store at `$HOME/.local/share/bank/event.db`. All values in minor units (cents). Net DR = Debit total − Credit total; negative = net credit position.

### §7.1 Before (state as observed at brief receipt)

| Account | Ccy | DR | CR | Net DR |
|---|---|---:|---:|---:|
| ACC-1000-001 (Bank — ZAR) | ZAR | 30,000,000,000 | 0 | 30,000,000,000 |
| ACC-2100-001 (FX Trading Receivable — ZAR) | ZAR | 195,690,919,970 | 81,235,486,921 | 114,455,433,049 |
| ACC-2100-002 (FX Trading Receivable — Foreign) | EUR | 2,137,241,272 | 3,220,231,952 | −1,082,990,680 |
| ACC-2100-002 (FX Trading Receivable — Foreign) | GBP | 24,502,880 | 1,141,366,659 | −1,116,863,779 |
| ACC-2100-002 (FX Trading Receivable — Foreign) | USD | 626,353,912 | 4,253,483,493 | −3,627,129,581 |
| ACC-2100-003 (FX Trading Payable — ZAR) | ZAR | 2,627,086,620 | 117,082,519,669 | −114,455,433,049 |
| ACC-2100-004 (FX Trading Payable — Foreign) | EUR | 3,220,231,952 | 2,137,241,272 | 1,082,990,680 |
| ACC-2100-004 (FX Trading Payable — Foreign) | GBP | 1,141,366,659 | 24,502,880 | 1,116,863,779 |
| ACC-2100-004 (FX Trading Payable — Foreign) | USD | 4,253,483,493 | 626,353,912 | 3,627,129,581 |
| ACC-2100-005 (Unrealised FX P&L — FVTPL) | ZAR | 78,608,400,301 | 78,608,400,301 | 0 |
| ACC-5000-001 (Founding share capital) | ZAR | 0 | 30,000,000,000 | −30,000,000,000 |

`SubLedgerPostingEmitted` posting-type counts before: `revaluation: 15`, `reversal: 15`, `trade-booking: 25`. Cancellation, principal-payment, and lifecycle-close all at 0 (the bug).

### §7.2 After (state after applying fixes + running `bun run gl:backfill-postings`)

| Account | Ccy | DR | CR | Net DR |
|---|---|---:|---:|---:|
| ACC-1000-001 (Bank — ZAR) | ZAR | 30,000,000,000 | 0 | 30,000,000,000 |
| **ACC-1100-001 (Nostro — ZAR)** | ZAR | 20,142,552,655 | 415,450,036 | **19,727,102,619** |
| **ACC-1100-002 (Nostro — Foreign)** | GBP | 0 | 701,534,597 | **−701,534,597** |
| **ACC-1100-002 (Nostro — Foreign)** | USD | 22,146,375 | 0 | **22,146,375** |
| **ACC-1100-003 (Nostro — Foreign)** | EUR | 306,967 | 200,342,024 | **−200,035,057** |
| ACC-2100-001 (FX Trading Receivable — ZAR) | ZAR | 196,711,076,434 | 186,507,861,234 | 10,203,215,200 |
| ACC-2100-002 (FX Trading Receivable — Foreign) | EUR | 4,929,747,519 | 5,357,473,224 | −427,725,705 |
| ACC-2100-002 (FX Trading Receivable — Foreign) | GBP | 177,373,128 | 1,156,041,915 | −978,668,787 |
| ACC-2100-002 (FX Trading Receivable — Foreign) | USD | 4,844,041,982 | 4,827,605,220 | 16,436,762 |
| ACC-2100-003 (FX Trading Payable — ZAR) | ZAR | 88,172,358,314 | 118,102,676,133 | −29,930,317,819 |
| ACC-2100-004 (FX Trading Payable — Foreign) | EUR | 5,557,508,281 | 4,929,747,519 | 627,760,762 |
| ACC-2100-004 (FX Trading Payable — Foreign) | GBP | 1,857,576,512 | 177,373,128 | 1,680,203,384 |
| ACC-2100-004 (FX Trading Payable — Foreign) | USD | 4,805,458,845 | 4,844,041,982 | −38,583,137 |
| ACC-2100-005 (Unrealised FX P&L — FVTPL) | ZAR | 78,608,400,301 | 78,608,400,301 | 0 |
| ACC-5000-001 (Founding share capital) | ZAR | 0 | 30,000,000,000 | −30,000,000,000 |

`SubLedgerPostingEmitted` posting-type counts after: `revaluation: 15`, `reversal: 15`, `trade-booking: 25`, `cancellation: 15` (new), `fx-principal-payment: 8` (new).

### §7.3 What changed and why

1. **`ACC-1100-xxx` Nostro accounts now show real cash movements.** Eight `PrincipalPayment` events (4 trades × 2 legs each) now post per-leg cash to the correspondent's nostro account at confirmation. This is the IFRS-9 §3.2.3 derecognition leg the bank was missing.
2. **`ACC-2100-001` (FX Trading Receivable — ZAR) net dropped from 114,455,433,049 to 10,203,215,200.** The 15 cancellations reversed the receivable accruals against the voided trades; the 4 fully-cycled trades' receivables drained against the principal-payment cash legs.
3. **`ACC-2100-005` (Unrealised FX P&L) stays at net 0.** The fx-engine reversal postings (per-revaluation MTM undo) already netted to zero before the fix; the cancellation arm correctly suppresses its own cumulative-P&L undo for FxTradeCancelled (§5) so the account is not double-credited.
4. **`ACC-1000-001` (Bank — ZAR) unchanged at 30b.** PR-FX-PRIN posts to the *correspondent* nostro account (`ACC-1100-xxx`), not the bank's primary operating-cash account. The brief's expectation that ACC-1000-001 would move was based on a chart-of-accounts convention the engine does not implement — the correspondent-routing model in `D-FX-CLS-MEMBERSHIP` and `fxPrincipalPaymentJournals` (`fx-spot.ts:727`) is unambiguous: cash hits the nostro, not the operating account. The R300m founding share capital remains the sole entry against ACC-1000-001.

## §8 — Tests

Four new regression tests in `runtime/agents/bea-gl-posting-engine.test.ts`:

1. **`FxTradeCancelled produces a 'cancellation' posting`** — would have caught bug 1.
2. **`PrincipalPayment produces an 'fx-principal-payment' posting`** — integration-style with a tmpdir EventStore.
3. **`CDM SettlementConfirmed (non-zero PnL) produces an 'fx-lifecycle-close' posting`** — same shape; non-zero PnL path.
4. **`Idempotency — running the engine twice emits 0 new postings on the second run`** — covers the canonical contract `bun run gl:backfill-postings` must satisfy.

All 30 tests in the file pass (26 existing + 4 new). Full `bun run ci` from `prototype/` is green.

## §9 — Out of scope (intentional)

- Anything else in `bea-gl-posting-engine.ts` (bond / equity / IRD branches stay untouched).
- Helena's RAS measurement engines (separate brief).
- Production FX rate feed ingest (separate brief, candidate `WS-MTM-PROD-FX-FEED`).
- The chart-of-accounts convention for the bank's primary operating-cash account (ACC-1000-001 vs ACC-1100-xxx nostros) — flagged in §7.3 note 4; not changed by this PR.
