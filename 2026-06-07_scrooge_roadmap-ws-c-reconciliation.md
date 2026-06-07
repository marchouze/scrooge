# Workstream-C roadmap reconciliation — instrument analyses & procedures backlog

**Author:** Scrooge (Chief of Staff / orchestrator), recording for Marc (CEO)
**Date:** 2026-06-07
**Decision:** `D-ROADMAP-WS-C-RECONCILE`
**Authority:** CEO (Marc, marc@tgv.co.za), recorded via scrooge:session-delegation
**Workstream:** C — Regulatory chain (Obligations, policies, procedures, instruments)

## Why this record exists

Marc pointed at two Workstream-C roadmap milestone lines and asked Scrooge to "close this". On inspection both were rendered from **hardcoded snapshots in `roadmap.js`** that had drifted from the canonical `_index.md` / register counts. This record reconciles the stale roadmap text against live state, restates the open scope honestly, and records the anti-drift control that prevents recurrence.

## Stale vs live

| Item | Roadmap text (stale) | Live state (2026-06-07, derived) | Source of truth |
|---|---|---|---|
| Procedures backlog | "~103 populated → ~80 identified total, prioritised by profile" | **146 populated · 0 STUB · 0 PLANNED** — backlog target met; all STUBs promoted 2026-05-15 | `Procedures/_index.md` (via `derive.ts` `procedureStats`) |
| Instrument analyses | "drive ~45 → 0; each unlocks obligations register rows" | **76 STUB remaining · 14 populated · 6 source-wired (91 analysis-track total)** — universe grew past the "~45" written when it was ~68 instruments | `Regulations/_index.md` (via `derive.ts` `regulationStats`) |
| Obligations | "each unlocks rows" | 417 obligations registered; ~57 carry `[citation: TBC]` blocked on unanalysed instruments | `Regulations/_obligations-register.md` |

The dependency chain is unchanged and genuine: **instrument analysis → resolves `[citation: TBC]` → unlocks obligation rows → lets procedures be authored against real cite chains.** The instrument-population backlog remains the documented rate-limiter on downstream policy/procedure authoring.

## Decisions recorded

1. **Procedures-backlog item — CLOSED (target met).** Live state is 146 populated, 0 STUB, 0 PLANNED. There is no populated→identified gap left to drive. The milestone now renders as Done.
2. **Instrument-analyses item — RESTATED.** From "drive ~45 → 0" to the true scope: **drive the 76 STUB instruments → 0, markets-profile-priority subset first.** Priority subset (markets / OTC-derivative-provider profile): Excon / FinSurv (highest — FX is the live trading book), BA-returns prudential spine relevant to the trading book (BA 330 / 325 / 326 / 300 / 200 / 100), IRRBB, FSCA OTC-derivative-provider standards (margin VM/IM, trade reporting, client categorisation), repo / SFTR. Retail / out-of-profile instruments are deferred.
3. **Anti-drift control.** The roadmap's instrument / procedure / obligation counts are now **live-derived** from `/api/state` (`bank.metrics.*`) instead of hardcoded strings. `derive.ts` now exposes the per-status breakdown (`instrumentsStub`, `instrumentsPlanned`, `instrumentsSourceWired`, `proceduresStub`); `roadmap.js` renders the two milestone lines from these counts and relocates a milestone from To-do to Done when its live count reaches the closed condition.

## Honest stop condition for the restated instrument backlog

"Drive to 0" means drive the *analysable-now* markets-priority subset to POPULATED. Instruments behind auth-gated PDFs or requiring external-counsel ratification (licence-application gate) stay `[citation: TBC]` and are flagged **blocked-pending-counsel** — recorded as a substrate/roadmap item, never silently faked (Principle 2 citation discipline). The now-live roadmap shows the residual honestly.

## Follow-on

WS-INSTRUMENT-ANALYSES continues as a Scrooge-coordinated dispatch run: Mira (Compliance / RegTech engineer) leads, Imani (Legal-as-code engineer) co-authors legal sourcing, Zara (Chief Compliance Officer, governance) holds obligation-interpretation authority. One PR per instrument; each flip of `Regulations/_index.md` STUB → POPULATED now decrements the live roadmap STUB count automatically.
