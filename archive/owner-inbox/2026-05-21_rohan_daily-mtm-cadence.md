---
title: Daily MTM cadence — handler wired; substrate gap surfaced
author: Rohan (Market risk engineer, engineering)
date: 2026-05-21
record-kind: substrate-readiness
workstream: WS-MTM-DAILY-CADENCE
brief: brief:rohan:wire-daily-mtm-cadence-fix-reversal-without-reva:2026-05-21
authority: D-MARKETS-SCHEMA-FOUNDATION
citations:
  - "D-MARKETS-SCHEMA-FOUNDATION"
  - "D-FX-SALES-TRADING-FRONTEND"
  - "D-EVENT-VIEW-BOUNDARY-WIRE"
  - "IFRS-9-§5.7.1"
  - "IAS-21-§28"
decision-required: false
summary: |
  Wires `rohan:daily-mtm` as a scheduled handler (cron `0 18 * * 1-5` —
  18:00 UTC weekdays = after the JSE 17:00 SAST close), folds the legacy
  `scripts/mtm-run.ts` logic into the AgentRunContext shape, fixes the
  reversal-without-reval invariant via option (a) stale-mark carry-forward,
  and adds the `recon:mtm-reversal-paired-with-reval` CI gate. First
  autonomous run continues to skip until production FX ingest lands —
  surfaced via `SubstrateAlert{alertClass:"integrity",severity:"medium"}`.
---

# Daily MTM cadence — handler wired; substrate gap surfaced

## Headline

The mark-to-market substrate is now on a real cadence. The handler at
`prototype/runtime/agents/rohan-daily-mtm.ts` fires at 18:00 UTC on
weekdays via `.github/workflows/agent-runtime-rohan-daily-mtm.yml`,
emits `FxPositionRevalued` + `OfficialMarkAdopted` (Slice B.1) +
`MtmRunCompleted` against the composition-root event store (shared
across worktrees via `$HOME/.local/share/bank/event.db`), and falls
back to stale-mark carry-forward when no fresh production tick is
available — preserving the reversal-then-reval atomicity invariant.

## What changed in this PR

1. **Scheduled handler.** `rohan:daily-mtm` registered in
   `runtime/agents/metadata/rohan.ts` with `kind: "scheduled"`,
   `cadenceHours: 24`, `cronExpression: "0 18 * * 1-5"`. Callable
   map updated; `agent:rohan-daily-mtm` script added.
2. **Reversal-without-reval fix (option a).** When no fresh production
   tick is available for an open FX position, the handler carries
   yesterday's mark forward as `rateSource: "stale-mark:<original>"`
   with `unrealisedPnlZarMinor: 0` (no fair-value movement on the
   stale day). Bea's posting engine therefore never sees a reversal
   without a paired forward — the chain stays atomic by construction.
3. **`SubstrateAlert` surface.** Every stale-mark fallback day emits
   `alert:integrity:mtm-stale-mark-<date>` (severity: medium) listing
   the affected currency pairs. This is the typed surface for Vera +
   the dashboard to escalate the missing-feed posture.
4. **Recon gate.** `prototype/platform/recon/mtm-reversal-paired-with-reval.ts`
   asserts: for every position-day with a reversal posting, either a
   matching `FxPositionRevalued` exists OR the day is the trade's
   close-out day (cancellation / settlement). Wired into `bun run ci`.
5. **Honest skip messages preserved.** "no JSE price feed connected —
   skipped" (bonds), "no JSE equity feed connected — skipped"
   (equities), "no curve ingest connected — skipped" (IRD) all flow
   into `MtmRunCompleted.skippedReasons[]` so the dashboard renders
   them as substrate-gap markers, not silent skips.

## First-run posture

The handler is wired but the substrate still has no production FX
ingest. Until Reuters / Bloomberg / SARB intraday lands, every open
FX position on every business day will fall back to stale-mark
carry-forward and the integrity `SubstrateAlert` will fire daily. The
GL `ACC-2100-005 Unrealised FX P&L — FVTPL` balance therefore stays
flat at the last live-mark value (rather than collapsing to zero, as
on 2026-05-20).

The first day with live ticks will revalue all open positions in one
sweep; the recon gate's audit count
(`positionDaysWithReversalNoReval`) will drop to zero once production
data lands and prior stale-mark days are no longer being created.

## Cron choice — 18:00 UTC weekdays

| Field | Value | Why |
|---|---|---|
| Hour | 18:00 UTC (≈20:00 SAST) | After JSE 17:00 SAST equity / bond close + post-FX-Joburg-window dampening. EOD prints are settled by then. |
| Day of week | `1-5` (Mon–Fri) | No JSE close on Sat/Sun → no fresh marks; the daily reversal cascade would only chew stale-mark events. Operator-triggered weekend runs available via `bun run agent:rohan-daily-mtm`. |
| Concurrency | `group: ${{ github.workflow }}` | Per CLAUDE.md operating procedure — per-workflow concurrency, queue depth 1. |

## Reversal-reval fix — option (a) chosen, option (b) rejected

The brief gave two options:

- **Option (a) — stale-mark carry-forward.** When no fresh tick, carry
  yesterday's mark with `provenance: "stale-mark"` and unrealisedPnl
  delta = 0. Keeps the GL position alive at the last live-mark value.
- **Option (b) — skip the reversal.** When no fresh tick, neither
  reverse the prior day nor revalue; let Bea's reversal sit idle.

Choice: **option (a)**. Three reasons:

1. **GL coherence.** Option (b) leaves the balance flat *only by
   coincidence* — the reversal still fires when the cancellation /
   settlement event lands; we'd just be deferring the integrity gap,
   not closing it. Option (a) keeps `ACC-2100-005` carrying a
   meaningful position-day value every business day.
2. **Audit trail.** Option (a) emits an `FxPositionRevalued` event
   with an explicit `stale-mark:` source — Vera / IFRS-13 disclosure
   / Helena's RAS read can all see *why* the mark was carried. Option
   (b) leaves a gap in the daily event stream that downstream
   consumers can't distinguish from "no positions today".
3. **Closes the invariant by construction.** Under option (a) the
   reversal-then-reval pair is always atomic — every position-day has
   exactly one forward event (live or stale-mark). The recon gate
   then becomes a structural assertion rather than a tolerated drift.

## Recon gate invariant

`recon:mtm-reversal-paired-with-reval` asserts (advisory severity
while production FX feed is missing):

```
for every (tradeId, day) where SubLedgerPostingEmitted.postingType = "reversal":
    FxPositionRevalued exists for (tradeId, day)
  OR
    day = close-out-day(tradeId)  -- the trade was cancelled/settled
```

Tightens to `fail` severity once production FX ingest lands — at that
point a missing forward revaluation is a genuine substrate fault, not
a feed-absence symptom.

## Substrate gaps surfaced

Out-of-scope for this PR; recommended next briefs:

- **WS-MTM-PROD-FX-FEED** — wire Reuters WM-Fix or Bloomberg BFIX as
  the production FX rate source. Highest priority; gates everything
  downstream of `daily-mtm`.
- **WS-MTM-JSE-BOND-FEED** — JSE EOD bond-price ingest. Unblocks
  bond MTM.
- **WS-MTM-JIBAR-CURVE-INGEST** — JIBAR + ZAR-OIS curve ingest.
  Unblocks IRD MTM.
- **WS-MTM-JSE-EQUITY-FEED** — JSE EOD equity-price ingest. Unblocks
  equity MTM.

Additionally surfaced for separate dispatch (out of scope here):

- Bea's `e.type === "TradeCancelled"` should be `"FxTradeCancelled"`
  in the FX domain branch of `bea-gl-posting-engine.ts` — a separate
  bug routing brief.

## Provenance

- Handler logic at `prototype/runtime/agents/rohan-daily-mtm.ts`.
- Metadata at `prototype/runtime/agents/metadata/rohan.ts`.
- Callable wire at `prototype/runtime/agents/callables/rohan.ts`.
- GH Actions workflow at `.github/workflows/agent-runtime-rohan-daily-mtm.yml`.
- Recon at `prototype/platform/recon/mtm-reversal-paired-with-reval.ts`,
  wired into `bun run ci` between `recon:position-revalued-cites-mark`
  and `recon:no-prop-attribution`.
- Brief: `brief:rohan:wire-daily-mtm-cadence-fix-reversal-without-reva:2026-05-21`.

— Rohan
