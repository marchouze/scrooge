# Brief — WS-INSTRUMENT-ANALYSES: drive markets-profile-priority STUB instruments → POPULATED

**To:** Mira (Compliance / RegTech engineer) — lead
**Co-author:** Imani (Legal-as-code engineer) — legal sourcing & ratification
**Governance:** Zara (Chief Compliance Officer) — obligation-interpretation authority
**From:** Scrooge (Chief of Staff / orchestrator), for Marc (CEO)
**Workstream:** WS-INSTRUMENT-ANALYSES (continuous)
**Authority:** `D-ROADMAP-WS-C-RECONCILE` (CEO-approved 2026-06-07)
**Priority:** scheduled (continuous curator mandate; Excon first)

## Why

The WS-C roadmap reconciliation (`D-ROADMAP-WS-C-RECONCILE`, PR #1062) restated the instrument-analyses backlog to its true live scope: **76 STUB instruments** awaiting analysis (14 populated, 6 source-wired). The instrument-population backlog is the rate-limiter on every downstream policy/procedure draft — ~57 obligation rows carry `[citation: TBC]` blocked on unanalysed instruments. The roadmap STUB count is now live-derived from `Regulations/_index.md`, so each flip STUB → POPULATED decrements it automatically.

## Scope — markets / OTC-derivative-provider profile, in priority order

1. **Excon — Currency & Exchanges Manual for Authorised Dealers** (`SARB-PA/excon-manual.md`) — **highest priority** (FX is the live trading book). Unlocks `ORG-FX-FIN-01…-13` and the FinSurv/BoP reporting procedure cite chain.
2. **BA-returns prudential spine relevant to the trading book** — BA 330 (large exposures), BA 325 (LCR), BA 326 (NSFR), BA 300 (off-balance-sheet), BA 200, BA 100.
3. **IRRBB** (`BCBS/d368-irrbb.md`) + any SARB IRRBB directive.
4. **FSCA OTC-derivative-provider standards** — margin (VM/IM), trade reporting, client categorisation — backing the already-populated OTC-derivative procedures.
5. **Repo / SFTR** instrument basis backing `PROC-MK-REPO-01` / `PROC-MK-SFTR-01`.

Retail / out-of-profile instruments are deferred.

## Per-instrument unit of work (one PR each)

1. Source the instrument (SARB / FSCA / BIS); extract binding obligations at section granularity; populate the analysis `.md` under `Regulations/…`.
2. **Principle 2 citation discipline:** never invent a cite. Sub-sections needing external-counsel ratification (licence-application gate) stay `[citation: TBC]` and are flagged **blocked-pending-counsel** — recorded, not faked.
3. Resolve the matching `[citation: TBC]` markers in `Regulations/_obligations-register.md`; add/link new `ORG-*` rows (events-first per obligation-lifecycle; `RecordFiled` for the analysis deliverable).
4. Flip the `Regulations/_index.md` status STUB → POPULATED.
5. `citation-gate` clean → `bun run ci` green → `git fetch origin main && git rebase origin/main` → re-run ci if rebase changed anything → push (retry-on-rejection). Scaffold-commit early.

## Reviewer→decider sync

Where Imani's legal ratification runs as independent validation ahead of Zara's obligation-interpretation sign-off, bracket with the sync primitive (`--run-role-class decider --blocks-on <imani-brief>:reviewer`).

## Done condition

Drive the *analysable-now* markets-priority subset to POPULATED. The live roadmap shows the residual (counsel-gated instruments) honestly.
