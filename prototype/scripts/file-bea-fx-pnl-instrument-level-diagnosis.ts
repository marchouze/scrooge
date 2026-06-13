// scripts/file-bea-fx-pnl-instrument-level-diagnosis.ts
//
// RMS Phase 3 filing — Bea's FX P&L instrument-level diagnosis. Confirms the
// account-level realised-P&L defect, quantifies the IAS 21 frozen-FCY gap and
// the (latent) double-count against the canonical book, and proposes an
// instrument-level treatment for CEO approval. DIAGNOSIS ONLY — no code change
// to any posting rule or valuation engine. Idempotent (skips if already filed).
//
// Authority: D-FX-PNL-INSTRUMENT-LEVEL-VALUATION (CEO-approved 2026-06-13);
//   D-RMS-PHASE-3.
// Brief: brief:bea:fx-p-l-instrument-level-diagnosis-value-instrume:2026-06-13.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:bea:fx-pnl-instrument-level-diagnosis:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-bea-fx-pnl-diagnosis] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# FX P&L — instrument-level diagnosis: the realised-P&L posting values an account, not an instrument

**Author:** Bea (Accounting & financial reporting engineer, engineering)
**Date:** 2026-06-13
**Authority:** D-FX-PNL-INSTRUMENT-LEVEL-VALUATION (CEO-approved 2026-06-13)
**Brief:** brief:bea:fx-p-l-instrument-level-diagnosis-value-instrume:2026-06-13
**Status:** DIAGNOSIS ONLY — proposed treatment returns to the CEO before any code change
**Audience:** Marc (CEO); Helena (Chief Risk Officer, governance); Rohan (Risk engineer, engineering)
**Reproduce:** \`BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/audit/fx-pnl-instrument-level-gap.ts\`

---

## 0. Headline

The FX realised-P&L posting rule values a **GL account**, not an **instrument**. It
debits a ZAR nostro for cash that never arrived and credits realised P&L for a
spot settlement that, by construction, realises nothing. The held foreign
currency — the actual monetary instrument whose ZAR value moves with spot — is
then frozen at its settlement-date value and never retranslated, even though it
still drives ~R499k of VaR. The correct instrument-level engine
(\`RealisedPnlRecognised\`, weighted-average-cost close-out of a CSH cash
instrument) **already exists and already computes the right number
(R-471,590.76 net realised)** — but it has no GL posting rule, so that figure
never reaches the ledger. Net: the live GL realised path is structurally wrong
**and** dormant, the correct figure is computed-but-unposted, and the carrying
value is frozen.

## 1. Independent confirmation of the four defect items (file:line evidence)

### Item 1 — realised P&L = (officialMark − bookRate) × notional, posted to a ZAR nostro — CONFIRMED

- \`platform/simulation/post-trade-lifecycle.ts:326-327\`:
  \`const rateDelta = settlementRate - bookRate;\`
  \`const realisedPnlDelta = Math.round((isBuy ? 1 : -1) * rateDelta * Math.abs(notionalBaseMinor));\`
  where \`settlementRate\` is the latest \`OfficialMarkAdopted\` on/before settlement
  (lines 285-322), **not** the contracted rate.
- \`platform/accounting/sla/rules/pr-fx-lifecycle-close.ts:42-71\`: the sole
  production posting path for \`SettlementConfirmed\` — gain branch
  \`Dr fx.nostro[ZAR] / Cr fx.realised_pnl\`, loss branch the reverse,
  \`amount = abs(event.realisedPnlDelta)\`, all ZAR.

### Item 2 — an FX spot settles at its CONTRACTED rate; the entry debits cash that never arrived — CONFIRMED (analytically)

An FX spot is an asset swap: at T+2 the bank delivers the agreed ZAR and
receives the agreed FCY, both at the **contracted** rate fixed on trade date.
No ZAR gain or loss crystallises at settlement — the bank simply now holds FCY
instead of a receivable. Pricing the settlement off an *official mark* that
differs from the contracted rate manufactures a realised gain/loss and debits
\`fx.nostro[ZAR]\` for ZAR cash that the settlement never produced. The economic
gain is the **appreciation of the held FCY**, which is unrealised until the FCY
is reconverted to ZAR.

### Item 3 — risk RETAINS settled FX in the NOP, accounting DROPS it from revaluation — CONFIRMED (both sides, in code comments)

- \`platform/projections/markets/limit-utilisation.ts:69-72, 94-95\`:
  \`deriveNetFxPositionByCurrency\` is "Settlement-RETAINED: a SettlementConfirmed
  / TradeMatured does NOT drop the position … the market risk (and the NOP)
  persists." This is the single fold the B3 limit and the VaR engine both
  consume (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP) — ~R499k VaR.
- \`platform/markets/eod/fx-revaluation.ts:186-194\` (Step 2) folds **both**
  \`TradeMatured\` and \`SettlementConfirmed\` into a \`settled\` set, and
  \`:212\` (\`if (settled.has(tradeId)) continue;\`) **skips** them from
  revaluation.
- Result: the held-FCY nostro is frozen at its settlement-date ZAR value and is
  never retranslated at the closing rate — a direct **IAS 21 §23(a)** breach
  (monetary items shall be translated at the closing rate at each reporting
  date) — while the same position still bears VaR. The two views disagree on
  whether a settled FX position is "live."

### Item 4 — realised measured from original book rate, not carrying amount; no reversal of accrued unrealised — CONFIRMED (latent in code)

- \`platform/accounting/sla/rules/pr-fx-002.ts:40-70\`: each
  \`FxPositionRevalued\` posts the accrued unrealised
  \`Dr fx.receivable[ZAR] / Cr fx.unrealised_pnl\` (gain) — measured
  \`(revalRate − bookRate) × notional\` from the **original** book rate
  (\`fx-revaluation.ts:238, 250\`).
- \`pr-fx-lifecycle-close.ts\` then posts realised \`(settlementRate − bookRate)\`
  — **also from the original book rate** — to **different** accounts
  (\`fx.nostro\` / \`fx.realised_pnl\`), with **no line reversing** the accrued
  \`fx.receivable\` / \`fx.unrealised_pnl\`. The contradiction the Calculator-3
  comment flags (\`platform/accounting/fx-calculators.ts:240-242\`: "Realised
  P&L = settled cash − carrying amount at last revaluation") is **not** what the
  production rule does. No SLA rule has \`event_type: SettlementConfirmed\` that
  reverses the unrealised accrual (only \`pr-fx-lifecycle-close.ts\` fires on it).

## 2. Quantification against the canonical book (BANK_EVENT_DB = \\$HOME/.local/share/bank/event.db)

Population: 44 \`FxTradeExecuted\`, 25 settled (\`SettlementConfirmed\`), 22 settled
with ≥1 prior \`FxPositionRevalued\`, 41 \`FxPositionRevalued\`, 14
\`RealisedPnlRecognised\`.

### (A) IAS 21 §23(a) frozen-FCY retranslation gap

| Measure | Value |
|---|---|
| Settled FCY base notional dropped from revaluation | JPY 89.13m, EUR 19.95m, GBP 14.30m, CHF 13.84m, USD 2.22m (base units) |
| Stranded accrued unrealised on settled trades — carried on \`fx.receivable\` / \`fx.unrealised_pnl\`, never derecognised or reversed | **R1,384,290.55** |

Every one of these settled positions is frozen at its last pre-settlement
revaluation rate and receives **zero** ongoing retranslation, while remaining in
the NOP/VaR basis. The R1.38m is the unrealised carrying balance now stranded;
the ongoing translation P&L (the moves *after* settlement) is structurally
unmeasured because the revaluation engine no longer looks at these positions.

### (B) Double-count

| Measure | Value |
|---|---|
| Booked double-count in the current canonical book | **R0.00 — REFUTED as a booked figure** |
| Reason | All 25 \`SettlementConfirmed.realisedPnlDelta\` = **0** |
| Status of the defect | **CONFIRMED as a latent live-code defect** (fires the moment \`post-trade-lifecycle.ts\` settles a trade with an \`OfficialMarkAdopted\` present) |

The double-count is **refuted as money currently in the ledger** but **confirmed
as a code-path defect**. Today every settlement reaches the GL via either
\`settle-matured-trades.ts:191\` (hard-coded \`realisedPnlDelta = 0\`) or the
\`post-trade-lifecycle.ts:306-310\` no-official-mark book-rate fallback (also 0).
So \`pr-fx-lifecycle-close.ts\` posts **nothing** for all 25 settlements, and the
accrued unrealised is never reversed — which is *why* the R1.38m is stranded.
But the instant a settlement runs through \`post-trade-lifecycle.ts\` *with* an
official mark, it will post \`(officialMark − bookRate) × notional\` to
\`fx.realised_pnl\` on top of the still-unreversed \`fx.unrealised_pnl\` accrual —
double-counting the trade-date→settlement move across two P&L accounts.

### (C) The correct figure is already computed — and unposted

14 \`RealisedPnlRecognised\` events exist, produced by the instrument-level CSH
close-out path (\`platform/projections/markets/currency-position.ts\` →
\`platform/product-control/daily-pnl.ts\`): realised = (disposalRate − weighted-avg
avgCost) × amountClosed, sign-correct. **Net realised = R-471,590.76.** There is
**no SLA posting rule** with \`event_type: RealisedPnlRecognised\` (confirmed: zero
matches in \`platform/accounting/\`), so this correct realised figure **never
reaches the GL**.

## 3. Proposed instrument-level treatment (for CEO approval — NOT implemented here)

The fix is to stop pricing settlement as a rate delta on an account and instead
value three distinct instruments across the lifecycle. The engine for (b)/(c)
**already exists** — the work is to make it the GL source of record and retire
the account-level path.

1. **FX trade, pre-settlement (the receivable):** a forward-style monetary claim.
   Retranslate at the closing rate each day via \`FxPositionRevalued\` →
   \`pr-fx-002\` (Dr/Cr \`fx.receivable\` / \`fx.unrealised_pnl\`). **Unchanged.**

2. **FCY cash position, post-settlement (the CSH monetary instrument):** on
   \`SettlementConfirmed\`, the receivable is **derecognised** and an FCY cash
   instrument (\`fi:csh:<CCY>:<book>\`, already modelled in \`currency-position.ts\`)
   is **recognised at the contracted ZAR cost** (no P&L at settlement — asset
   swap). This FCY cash is a monetary item and **must** be retranslated at the
   closing rate each reporting date (IAS 21 §23(a)). This closes the frozen-FCY
   gap: revaluation must value the *held FCY*, not the *trade*, after settlement.

3. **Derecognition (reconversion to ZAR):** realised P&L crystallises **only** on
   close-out = (disposalRate − weighted-avg ZAR cost) × amountClosed — exactly
   the existing \`RealisedPnlRecognised\` event. A **new SLA rule**
   \`event_type: RealisedPnlRecognised\` posts it to the GL
   (Dr \`fx.nostro[ZAR]\` / Cr \`fx.realised_pnl\` on a gain), with a paired reversal
   of the unrealised accrual on the closed portion so the move is recognised once.

4. **GL accounts are DERIVED:** \`fx.nostro\`, \`fx.realised_pnl\`, \`fx.unrealised_pnl\`
   become projections of (1)–(3) instrument valuations. No rate-delta arithmetic
   lives at the account; realised vs unrealised is a property of the **instrument
   lifecycle** (recognition → retranslation → derecognition), not an account
   posting. \`pr-fx-lifecycle-close.ts\`'s rate-delta realised line is **retired**;
   \`SettlementConfirmed\` becomes a pure derecognition/recognition swap with zero
   P&L.

5. **Reconciliation to the standing-NOP VaR basis:** the retranslated held-FCY
   cash position **is** the standing NOP that \`deriveNetFxPositionByCurrency\`
   already retains for VaR (~R499k). Under this treatment the accounting carrying
   value and the risk NOP read the *same* held-FCY instrument at the *same*
   closing rate — the §B3/VaR fold and the GL agree by construction, resolving
   the Item-3 contradiction. Helena (CRO) / Rohan (Markets) consistency check:
   one instrument, one closing rate, two derived views.

## 4. Recommended decision for the CEO

Approve, as a follow-on build (separate decision), the retirement of the
account-level realised path (\`pr-fx-lifecycle-close.ts\` rate-delta line) in favour
of: (i) recognising the FCY cash instrument at contracted cost on settlement with
zero P&L; (ii) retranslating held FCY at the closing rate (closes the IAS 21 gap
and the R1.38m stranded accrual); (iii) a new \`RealisedPnlRecognised\` GL posting
rule with paired unrealised reversal (lands the R-471,590.76 correctly and
forecloses the latent double-count). No code change is made under this diagnosis.

## 5. Substrate gaps surfaced

- **No GL posting rule for \`RealisedPnlRecognised\`** — the correct realised
  figure is computed but unposted. (Primary gap.)
- **No unrealised-reversal line on derecognition** — accrued \`fx.unrealised_pnl\`
  is never reversed when a position settles/closes, stranding R1.38m and arming
  the latent double-count.
- **Two divergent settlement emitters** — \`settle-matured-trades.ts\`
  (\`realisedPnlDelta = 0\`, correct-by-accident) vs \`post-trade-lifecycle.ts\`
  (non-zero rate-delta, defective). Convergence needed.
- **Revaluation drops settled positions** — \`fx-revaluation.ts\` Step 2 must
  instead revalue the *held FCY cash instrument* post-settlement.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-FX-PNL-INSTRUMENT-LEVEL-VALUATION",
      "D-RMS-PHASE-3",
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
      "urn:obligation:ifrs:ias21:23",
      "urn:obligation:ifrs:ias21:28",
      "urn:obligation:ifrs:ifrs9:5.7.1",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:bea:accounting-financial-reporting-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "FX P&L instrument-level diagnosis — realised-P&L values an account, not an instrument",
      path: "2026-06-13_bea_fx-pnl-instrument-level-diagnosis.md",
      category: "diagnosis",
      author: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T15:00:00.000Z",
);

console.log(
  JSON.stringify(
    { ok: true, recordId: RECORD_ID, eventId: result.eventId, documentHash: result.documentHash },
    null,
    2,
  ),
);
