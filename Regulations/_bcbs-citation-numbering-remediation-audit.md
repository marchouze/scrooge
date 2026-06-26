# BCBS d-number mis-citation — library-wide remediation audit

**Authority:** `D-BCBS-CITATION-NUMBERING-REMEDIATION` (CEO session-delegation, 2026-06-26), arising from `D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE` / `D-AGENT-DOMAIN-COMPETENCE`.
**Author:** Mira (Compliance / RegTech engineer, compliance — reports to Zara, Chief Compliance Officer).
**Domain co-authority:** Eitan (Treasurer) + Helena (Chief Risk Officer).
**Brief:** `brief:mira:remediate-systemic-bcbs-d-number-mis-citation-lc:2026-06-26`.

This is the Charter-cmd-5 audit trail (log everything swept + changed; no silent truncation) for the systemic Basel-standard d-number mis-citation remediation.

## 1. Premise validation against the domain-truth oracle (BIS)

Every BCBS document number was validated against the BIS source (bis.org), **not** against the bank's current (wrong) internal record. A consistent-but-wrong result is a finding — that is exactly how this defect survived the citation-gate.

| BCBS no. | Canonical title (BIS) | Date | BIS URL |
|---|---|---|---|
| **d238** | The Liquidity Coverage Ratio and liquidity risk monitoring tools (**LCR**) | Jan 2013 | bis.org/publ/bcbs238.htm |
| **d295** | the net stable funding ratio (**NSFR**) | Oct 2014 | bis.org/bcbs/publ/d295.htm |
| **d368** | Interest rate risk in the banking book (**IRRBB**) | Apr 2016 | bis.org/bcbs/publ/d368.htm |
| **d248** | Monitoring tools for intraday liquidity management | Apr 2013 | bis.org/publ/bcbs248.htm |
| **d144** | Principles for Sound Liquidity Risk Management | Sep 2008 | bis.org/publ/bcbs144.htm |
| **d279** | Standardised approach for counterparty credit risk (SA-CCR) | Mar 2014 | bis.org/publ/bcbs279.htm |
| **d352** | Minimum capital requirements for market risk (superseded) | Jan 2016 | bis.org/bcbs/publ/d352.htm |
| **d457** | Minimum capital requirements for market risk (FRTB) | Jan 2019 | bis.org/bcbs/publ/d457.htm |
| **d450** | Stress testing principles | Oct 2018 | bis.org/bcbs/publ/d450.htm |
| d335 | RCAP — Saudi Arabia assessment (**NOT the NSFR, NOT IRRBB**) | Sep 2015 | — |
| d365 | Revisions to the Basel III leverage-ratio framework — consultative (**NOT the IRRBB standard**) | Apr 2016 | bis.org/bcbs/publ/d365.htm |

**Premise CONFIRMED.** Every number the brief supplied was correct against BIS. The repo's `LCR = d295` and `NSFR = d335` were both wrong; `IRRBB = d368` was already correct; the brief number-map (238/295/368/248/144) is correct.

## 2. Defect families found (4)

1. **LCR mis-numbered d295** — should be **d238**. (d295 is the NSFR.)
2. **NSFR mis-numbered d335** — should be **d295**. (d335 is the RCAP Saudi Arabia assessment.)
3. **IRRBB mis-numbered d335 or d365** — should be **d368**. (d335 is RCAP Saudi Arabia; d365 is the leverage-ratio consultative document.)
4. **Stress Testing Principles mis-numbered d295** — should be **d450**. (d295 is the NSFR.)

## 3. Every change made (by file)

### Obligations register (seed-canonical + rendered)
- `Regulations/_obligations.seed.json` — ORG-PR-06 LCR `lineage d295 → d238` (+ v1.46 correction annotation); ORG-BNK-ILAAP-CONS `D295 (LCR) → D238`, `D335 (NSFR) → D295`. ORG-PR-07 NSFR `lineage bcbs295` **confirmed correct** (no change).
- `Regulations/_obligations-register.md` — mirrored ORG-PR-06 + ORG-BNK-ILAAP-CONS edits; v1.44 changelog resolved-chain `d295 → d238` for LCR. Seed-parity holds (614 obligations, 0 divergence).
- `Regulations/_obligations-register.html` — stale render cleared: ORG-PR-06 `BCBS D295 / BA 325 → BCBS D238 (LCR)`; ORG-PR-07 `BCBS D335 / BA 326 → BCBS D295 (NSFR)`.

### Risk taxonomy
- `Regulations/_risk-taxonomy.md` — RT-LQ line 77 + line 351: `D295 (LCR) → D238 (LCR)`, `D335 (NSFR) → D295 (NSFR)` (dates unchanged). RT-IRRBB confirmed `D368`.

### BCBS catalogue spine
- `Regulations/BCBS/lcr-liquidity-coverage.md` — issuer lineage `d295 → d238` (+ correction note + BIS URL).
- `Regulations/BCBS/nsf-net-stable-funding.md` — issuer lineage `d335 → d295` (+ correction note + BIS URL).

### Index + BA-return analyses
- `Regulations/_index.md` — catalogue stub rows `D295 — LCR / d295-lcr.md → D238 — LCR / d238-lcr.md`; `D335 — NSFR / d335-nsfr.md → D295 — NSFR / d295-nsfr.md`.
- `Regulations/SARB-PA/ba-returns/ba-110.md` — LCR `document d295 → d238` (resolved the self-contradiction with the bcbs238.htm link); stub `d295-lcr.md → d238-lcr.md`.
- `Regulations/SARB-PA/ba-returns/ba-120.md` — NSFR stub `d335-nsfr.md → d295-nsfr.md`; stale "D335 STUB tracking" note corrected (d335 is RCAP Saudi Arabia, not the NSFR).

### Policies
- `Policies/liquidity-risk-management-policy-v1.md` — all LCR `D295 → D238`, all NSFR `D335 → D295` (regulatory-hierarchy list, citation surface §11, obligation-status cells, change-log scope summary); v1.2 change-log row added.
- `Policies/capital-management-policy-v1.md` — stress-testing `D295 → d450`; IRRBB `D335 → D368`.
- `Policies/pillar-3-disclosure-policy-v1.md` — IRRBB `D335 → D368`.
- `Policies/recovery-resolution-planning-policy-v1.md` — stress-testing `D295 → D450` (×2); IRRBB `D335 → D368` (×3).
- `Policies/market-risk-policy-v1.md` — IRRBB `D335 → D368`.
- `Policies/bank-strategy-v2.md` — IRRBB narrative `d365 → d368`.

### Procedures
- `Procedures/by-policy/capital-ratio-monitoring.md` — LCR `D295 → D238`, NSFR `D335 → D295`.
- `Procedures/by-policy/liquidity-limit-management.md` — LCR `D295 → D238`, NSFR `D335 → D295`.
- `Procedures/by-policy/daily-alm-run.md` — IRRBB narrative `d365 → d368` (code-citation constant `BCBS-D365-IRRBB` left — see §4).
- `Procedures/by-policy/alm-limit-monitoring.md` — IRRBB narrative `d365 → d368`.
- `Procedures/by-policy/irrbb-measurement.md` — IRRBB narrative `d365 → d368`.

### Platform code (reporting + accounting; NOT platform/alm)
- `prototype/platform/reporting/ba-300-lcr.ts` — all LCR `BCBS D295 → BCBS D238` (comments + computed-citations array); emitted citation constant `BCBS-D295 → BCBS-D238`.
- `prototype/platform/reporting/ba-300-lcr.test.ts`, `ba-300-lcr-xml-adapter.ts`, `hqla-stock.ts`, `hqla-overrides.ts` — LCR `D295 → D238`.
- `prototype/platform/reporting/ba-330-irrbb.ts` — IRRBB narrative `d365 → d368` (no `BCBS-D365-IRRBB` constant in this file).
- `prototype/platform/accounting/coa-registry.ts`, `_chart-of-accounts.md`, `chart-of-accounts.schema.json` — LCR `D295 → D238`.

### Agent spec (Ravi only — other Team/*.md excluded)
- `Team/Ravi.md` §18–§20 re-landed from `origin/worktree-agent-a8045cbc3ea547f25` with number-only corrections: LCR `d295 → d238`, NSFR `d335 → d295` (oracle table, taxonomy-cross-check row, golden-case row, §20 challenges, v1.8 change-log). Added one §20 note recording that the upstream ADC oracle carried the wrong numbers, corrected under this decision. Ravi's domain content otherwise unchanged. Clears Ravi from `recon:agent-spec-domain-competence`.

### New control
- `prototype/platform/recon/bcbs-citation-number-integrity.ts` — fail-closed, harden-only gate (registered in `package.json` + the `domain` recon suite). Pins each cited BCBS number to its canonical title via high-precision forbidden-pairing apposition checks; proven to catch the d295=LCR, d335=NSFR, d335=IRRBB, d295=stress-testing defects and green on the corrected tree (535 tokens checked).

## 4. Flagged findings — NOT fixed here (scope exclusions / coordination)

Per Charter cmd 5 (no silent deferral), the following are recorded rather than silently dropped:

- **`BCBS-D365-IRRBB` citation constant** (`prototype/platform/event-store/registry/markets.ts`, `…/alco.ts`, `prototype/platform/markets/eod/irs-revaluation.ts`, `prototype/platform/risk/ras-appetite-register.ts`, projection tests, and the `daily-alm-run.md:78` doc that mirrors it) — a replay-sensitive event-citation identity that should become `BCBS-D368-IRRBB`. **Coupled to `platform/alm/*` (chip `task_0946bdf9`, repricing-gap.ts d365 → d368).** Left untouched to avoid a one-dispatch-path-per-scope collision. The new recon gate deliberately ignores the hyphenated constant form. **Recommendation:** the alm-chip's follow-on (or a successor task) should rename the constant `BCBS-D365-IRRBB → BCBS-D368-IRRBB` across the registries and update `daily-alm-run.md:78` in the same change.
- **`Team/Eitan.md` and `Team/Rohan.md`** carry `BCBS d365` IRRBB references — out of scope (only `Team/Ravi.md` was in scope; other ADC-wave specs land independently). **Flag** for the owning dispatches.
- **`.github/workflows/agent-runtime-ravi-balance-sheet-projector.yml:14`** — comment cites `BCBS D295/D396` and `Reg 26A`. d295 is correct for NSFR here; `D396` is unverified and `Reg 26A` was already flagged non-existent in the register v1.45 correction (correct provision: Reg 26(14)/(14)(d)). Left as a non-citation CI comment; **flag** for a Reg-numbering tidy.
- **`prototype/platform/accounting/*` and `Regulations/SARB-PA/ba-returns/ba-300.md` — `BCBS D196 §645–§654` for BIA operational risk.** d196 is the AMA supervisory guidelines (Jun 2011); the §645–§654 BIA paragraphs are from the consolidated Basel II framework (bcbs128, Jun 2006). This is a possible operational-risk-domain mis-number, but it requires op-risk domain co-authority to confirm the intended source and is outside the liquidity/IRRBB remediation scope. **Flag** for an op-risk-domain follow-on.

## 5. Definition of Done

- [x] Numbers corrected at source (seed) + re-rendered (md/html); seed-parity holds (0 divergence).
- [x] `_risk-taxonomy.md` RT-LQ corrected; RT-IRRBB confirmed.
- [x] Library-wide audit logged (this file); no silent truncation.
- [x] New fail-closed `recon:bcbs-citation-number-integrity` gate, green + proven to catch the defect.
- [x] Ravi §18–20 re-landed with corrected numbers + §20 note.
- [x] Findings outside scope flagged, not dropped (§4).
