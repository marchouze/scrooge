# IRS named-tail closure — B-IRS-DISALLOWANCES + B-IRS-MULTICURVE

**Author:** Bea (Accounting & financial reporting engineer, engineering)
**Date:** 2026-06-10
**Brief:** `brief:bea:close-named-irs-tail-b-irs-disallowances-b-irs-m:2026-06-10`
**Workstream:** WS-BA-RETURNS-IRS-FAMILY-RECONCILE
**Authority:** D-QUEUE-CLOSEOUT-2026-06-10 (CEO, 2026-06-10); D-OPEN-THREADS-CLOSEOUT-2026-06-09; D-IRS-FAMILY-CONVERGE-ACCOUNTING; D-IRS-DV01-BUCKETING-CALIBRATION

## Verdict

Both named-but-not-dispatched briefs from the WS-BA-RETURNS-P1-SOURCING close are
disposed **without new build work**. No code change is required; the deliverable
is this closure record. Per the brief's own instruction: both items turned out
already-done / deferred, and this report says so plainly rather than inventing work.

| Item | Disposition | Evidence |
|---|---|---|
| B-IRS-DISALLOWANCES | **Already done** — closed by PR #1131 (merged 2026-06-09, `225bcc02`), and the IRS contribution is verified at code level to flow through the disallowance algebra | See §1 |
| B-IRS-MULTICURVE | **Deferred-verified** — explicitly deferred by recorded CEO decision; deferral tracked at three layers (decision event, code markers, live substrate-gap placeholder emission) | See §2 |

## 1. B-IRS-DISALLOWANCES — already done (PR #1131)

**Original naming context.** Named at the close of WS-BA-RETURNS-P1-SOURCING
(PRs #1117–#1130) as the residual Reg 28(3) vertical/horizontal IR-general
disallowance treatment, recorded in D-OPEN-THREADS-CLOSEOUT-2026-06-09
(scope item 1: "B-IRS-DISALLOWANCES — Reg 28(3) vertical/horizontal IR-general
disallowance algebra in the BA 320 market-risk maturity ladder").

**What closed it.** PR #1131 (Mira, Compliance / RegTech engineer, engineering;
merged 2026-06-09T13:46:49Z, merge commit `225bcc02`), brief
`brief:mira:ba-320-irs-disallowances-ba-300-110-formid-recon:2026-06-09`,
carries the brief name in its title and delivered:

- `computeIrGeneralDisallowances` + `BAND_ZONE` in
  `prototype/platform/reporting/ba-320-ir-maturity-bands.ts` — vertical 10%
  matched-per-band; horizontal within-zone 40/30/30; between-zone adjacent 40%,
  zones 1↔3 100%; standard Basel band→zone partition.
  [citation: Regulations Relating to Banks, Reg 28(3)(a)] [citation: BCBS D352 §718(iv)–(x)]
- `generateBa310MarketRisk` computes the disallowance from the signed
  weighted-nominal ladder **by default** (`irGeneralDisallowancesMinor` is an
  optional override only); the pre-#1131 defect was a caller-never-supplied
  `?? 0` silent zero.
- `recon:ba320-ir-general-weighting-basis` check (4) asserts the generator calls
  `computeIrGeneralDisallowances` and does not zero-coalesce — the silent-zero
  defect class cannot regress silently.

**IRS-specific slice — verified none remains.** The brief asked what
IRS-specific slice remains after #1131's IR-general fix. Code-level answer: none.
In `prototype/platform/returns/ba320/period-close-subscriber.ts` the IR
general-risk ladder is folded events-first from BOTH the bond ladder
(`BondTradeExecuted`) and the IRS maturity-method notional ladder
(`IrdSwapTradeExecuted` decomposed into fixed-bond + FRN notional legs via
`buildIrsIrGeneralLadder`), combined through `combineIrGeneralLadders` into the
single `irGeneralMaturityLadder` the generator receives. The disallowance
algebra runs over that combined ladder, so IRS positions participate in the
vertical/horizontal disallowance arithmetic identically to bonds — there is no
separate IRS disallowance path to build. Swaps that cannot be
maturity-method-decomposed (non-vanilla role, missing next-reset terms) are
surfaced as substrate-gap placeholders, not dropped or fabricated — zero
silent-zero paths.

## 2. B-IRS-MULTICURVE — deferred-verified (do not build)

**Recorded deferral.** D-OPEN-THREADS-CLOSEOUT-2026-06-09 (CEO
session-delegation, approved; `Decision` event present in the shared store with
phases requested + approved, as-of 2026-06-09T15:30:00Z) states: "Explicitly
deferred (reported to CEO, NOT dispatched): B-IRS-MULTICURVE (G2, single-curve
acceptable in build phase)". Building it now would bring a licence-day-deferred
item forward without CEO approval; per the dispatching brief, that is explicitly
out of scope.

**Deferral is tracked at three layers:**

1. **Decision event of record** — D-OPEN-THREADS-CLOSEOUT-2026-06-09 in the
   shared event store (`scripts/record-d-open-threads-closeout-2026-06-09.ts`).
2. **Code markers** — `prototype/platform/reporting/ba-320-market-risk.ts`
   ("curve only; multi-curve / basis (B-IRS-MULTICURVE / G2) remains out of
   scope") and `prototype/platform/reporting/ba-320-ir-maturity-bands.ts`
   ("Multi-curve / basis decomposition (B-IRS-MULTICURVE / G2) is" out of scope),
   both carried by PR #1131.
3. **Live substrate-gap surfacing** — the BA 320 period-close subscriber emits a
   placeholder for any live trading-book basis swap it cannot
   maturity-method-decompose, naming G2 as the separate brief, so a multicurve-
   shaped position can never be silently folded or dropped while the deferral
   stands.

**Re-activation trigger.** Multicurve discounting (OIS/forecast-curve basis
decomposition, G2 of D-IRS-DV01-BUCKETING-CALIBRATION) re-enters scope at
licence-day readiness or earlier by explicit CEO decision; the first booked
pay-float/receive-float basis swap would surface immediately as a BA 320
substrate-gap placeholder, forcing the conversation rather than a silent gap.

## 3. Brief hygiene

No `AgentBriefIssued` events exist for B-IRS-DISALLOWANCES or B-IRS-MULTICURVE
as standalone briefs — they were named-but-never-dispatched, so there are no
phantom open briefs to withdraw. The only brief touching this scope is the
present one (`brief:bea:close-named-irs-tail-b-irs-disallowances-b-irs-m:2026-06-10`),
closed by Scrooge (Chief of Staff, orchestration) via the run-lifecycle CLI on
return of this report. This record is filed via a `RecordFiled` event
(`scripts/file-bea-irs-tail-closure.ts`) per RMS Phase 3 (D-RMS-PHASE-3);
the markdown is a render of the event.
