---
title: Treasurer role definition, policy/procedure map, and substrate plan
author: Eitan (Treasurer, governance)
date: 2026-06-10
workstream: WS-TREASURER-ROLE-DEFINITION
authority: D-TREASURER-ROLE-DEFINITION-REVIEW
brief: brief:eitan:treasurer-role-definition-review-consolidated-ro:2026-06-10
run: run:eitan:2026-06-10T19-24-40-279Z
status: FILED
citations:
  - D-TREASURER-ROLE-DEFINITION-REVIEW
  - D-TREASURY-GAPS-WAVE1
  - D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30
  - D-TREASURER-PROC-COMPLETION-2026-05-30
  - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL
  - Team/Eitan.md
  - Team/Ravi.md
  - Policies/liquidity-risk-management-policy-v1.md
  - Policies/asset-liability-management-policy-v1.md
  - Policies/funds-transfer-pricing-policy-v1.md
  - Policies/treasury-investment-policy-v1.md
  - Policies/collateral-management-policy-v1.md
  - Policies/irrbb-policy-v1.md
summary: >
  Consolidated Treasurer role-definition record under D-TREASURER-ROLE-DEFINITION-REVIEW:
  (A) role definition and boundary table; (B) policy universe map including the
  Contingency Funding Plan assessment; (C) procedure map and unauthored pipeline;
  (D) substrate plan in waves with build-phase vs licence-day split.
---

# Treasurer role definition and substrate plan

> **Authority.** `D-TREASURER-ROLE-DEFINITION-REVIEW` (CEO instruction, approved 2026-06-10).
> **Brief.** `brief:eitan:treasurer-role-definition-review-consolidated-ro:2026-06-10`. **Run.** `run:eitan:2026-06-10T19-24-40-279Z`.
> **Author.** Eitan (Treasurer, governance), with the engineering bench of Ravi (Treasury/ALM engineer, engineering).
> **Nature.** This is a role-definition *review*, not a new-hire cycle. The seat exists and is substantially operationalised (`D-TREASURY-GAPS-WAVE1`, 2026-05-19; `D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30`). This record consolidates the role, its policy universe, its procedure set, and its substrate plan into a single citable chain (Principle 2). Every claim below was verified at file or code level on 2026-06-10; where this review found the dispatch brief imprecise, the verified state is recorded and the deviation noted.

---

## Part A — Role definition

### A.1 Mandate

The Treasurer (Eitan, governance seat, reporting to the CEO) owns, per `Team/Eitan.md` §3:

1. **Funding strategy** — composition and tenor of the funding base; material changes escalate to ALCO → CEO (`Team/Eitan.md` §10).
2. **Intraday liquidity and correspondent settlement-account (nostro) funding** — the bank is an indirect NPS participant; it settles via its correspondent bank, never directly in SAMOS. Eitan funds the nostro position; Tomas (Operations & payments engineer, engineering) governs correspondent-instruction cut-off discipline (`D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30`).
3. **LCR / NSFR programme management** — daily ratio projections consumed from Anya (Platform & data engineer, engineering); sign-offs to Camille (Chief Financial Officer, governance).
4. **IRRBB management** — EVE / NII posture and hedge-action governance; measurement methodology co-owned with Helena (Chief Risk Officer, governance) under `Policies/irrbb-policy-v1.md`.
5. **FX position** — net-open-position governance within Excon authority (`Procedures/by-policy/fx-position-governance.md`, PROC-ALM-FXP-01).
6. **Funds Transfer Pricing** — methodology owner (`Policies/funds-transfer-pricing-policy-v1.md`); curve recalibration approved at ALCO.
7. **Capital actions (operational)** — issuance execution co-owned with Camille (PROC-CAP-CII-01); capital adequacy itself stays with Camille.
8. **Collateral and repo** — collateral inventory governance (`Policies/collateral-management-policy-v1.md`, owner) and repo-book sizing within RAS.
9. **HQLA portfolio** — investment universe and eligibility per `Policies/treasury-investment-policy-v1.md` (owner).
10. **ALCO chair** — monthly cycle per PROC-ALM-ALCO-01; pack generated, never assembled (Principle 6).

**Governance/engineering split.** Eitan is not an engineer (`Team/Eitan.md` §2): Eitan governs and signs; Ravi (Treasury/ALM engineer, engineering, reports to Eitan) runs the engines — daily ALM run, FTP curve publication and attribution, intraday stress projection, hedge designation/effectiveness engineering. The runner/measurer split is architectural: Ravi runs the book, Rohan (Risk engineer, engineering) measures it; neither can mutate the other's event streams (`Team/Ravi.md` §15).

### A.2 Boundary table — what the Treasurer does NOT own

| Domain | Owner (governance) | Engineering bench | Boundary anchor |
|---|---|---|---|
| Risk appetite and risk measurement | Helena (Chief Risk Officer, governance) | Rohan (Risk engineer, engineering) | `Team/Eitan.md` §3/§15; `prototype/platform/risk/ras-appetite-register.ts` (Helena calibrates; Eitan operates within); `Team/Ravi.md` §15 runner/measurer split |
| Financial reporting and group capital adequacy | Camille (Chief Financial Officer, governance) | Bea (Accounting & financial reporting engineer, engineering) | `Policies/capital-management-policy-v1.md` (owner: Camille); `Policies/financial-reporting-policy-v1.md`; Eitan executes operational capital actions only (PROC-CAP-CII-01) |
| Markets execution (incl. HQLA turnover execution) | Saskia (Head of Global Markets, governance) | Kai (Trading systems engineer, engineering) | `Team/Eitan.md` §15 — Saskia executes for Eitan's HQLA turnover but owns no treasury policy; conflict registered in Owen's conflicts register |
| Payments and settlement operations | Devon (Chief Operating Officer, governance) | Tomas (Operations & payments engineer, engineering) | `Policies/payments-settlement-policy-v1.md` + `Policies/nostro-correspondent-banking-policy-v1.md` (owner: Devon); Tomas owns the correspondent channel and nostro state; Eitan/Ravi own funding-plan logic (`Team/Ravi.md` §15) |
| Regulatory-return submission | Zara (Chief Compliance Officer, governance) | Mira (Compliance / RegTech engineer, engineering) | Eitan signs LCR/NSFR/IRRBB content to Camille (`Team/Eitan.md` §9); generation and submission rails are `prototype/platform/reporting/` + `prototype/platform/returns/` (Bea/Mira) |
| Excon classification | Zara (Chief Compliance Officer, governance) | Mira (Compliance / RegTech engineer, engineering) | `Policies/excon-compliance-policy-v1.md` (owner: Zara); Eitan operates FX position *within* granted Excon authority |
| Hedge-accounting posting and IFRS 9 classification | Camille (Chief Financial Officer, governance) | Bea (Accounting & financial reporting engineer, engineering) | `Policies/hedge-accounting-policy-v1.md` (owner: Camille); Ravi owns designation + effectiveness, Bea owns posting (`Team/Ravi.md` §15) |

**First-line vs second-line.** Eitan is the first-line executive for treasury/ALM. Helena sets the appetite Eitan operates within (second line); Vera (Internal audit engineer, engineering) and Thandiwe (Chief Audit Executive, governance) test it independently (third line). `Team/Eitan.md` §15.

### A.3 Decision authority

**In-seat** (`Team/Eitan.md` §9): daily settlement-account funding plan; LCR/NSFR/IRRBB sign-offs to Camille; repo-book sizing within RAS; hedge-programme approval within RAS; ALCO chair and treasury limits within Helena's RAS; FX-position adjustments within Excon authority; FTP curve refresh within agreed methodology; collateral inventory moves with HQLA-eligibility cited. All emit typed `AgentDecision`-class events (Principle 1).

**Escalating** (`Team/Eitan.md` §10): approaching LCR/NSFR breach (Helena + Camille + CEO; PA path lit by Owen (Company Secretary, governance)); capital actions above CEO authority (Board); material funding-strategy change (ALCO → CEO/Board); Excon-affecting FX decisions requiring new authority (CEO + Imani (Legal-as-code engineer, engineering) + Mira); material treasury-counterparty default risk; IRRBB framework changes (Helena → CEO); ILAAP sign-off-blocking issues.

**Routing-table finding.** The CLAUDE.md "Decision authority routing" table carries no Treasurer row. Treasury-category decisions currently map indirectly: operational capital actions ride the CFO row; appetite calibration rides the CRO row. Recommendation: Owen (Company Secretary, governance) adds a Treasurer category row (funding plan approvals, FTP methodology refresh, hedge-programme approval, collateral/repo sizing; CEO escalation trigger = RAS-threshold or funding-strategy materiality) when the planned `recon:decision-authority-routing` pipeline lands. This is a routing-standard completeness item, not a present misattribution.

---

## Part B — Policies required vs existing

The required treasury policy universe for a SARB-licensed bank (Banks Act 94 of 1990 ss.60–72; Regulations Relating to Banks reg.26/26a; Basel LCR/NSFR/IRRBB standards) maps onto the existing `Policies/` register as follows. All fourteen policies named in the brief exist; owners and statuses below are verified from file frontmatter.

| # | Policy (file) | Status | Owner | Treasurer role | Obligation anchors |
|---|---|---|---|---|---|
| 1 | `Policies/liquidity-risk-management-policy-v1.md` | IN FORCE | Helena (Chief Risk Officer, governance) | Co-author; named CFP owner (§5.2); ILAAP liquidity-side co-chair (§6) | ORG-PR-06, ORG-PR-07, ORG-PR-08, ORG-PR-14, ORG-PR-15, ORG-PR-36, ORG-PR-38, ORG-PR-43 |
| 2 | `Policies/asset-liability-management-policy-v1.md` | IN FORCE | Eitan (Treasurer, governance) | **Owner** | reg.26; Banks Act s.60–64 (frontmatter citations) |
| 3 | `Policies/irrbb-policy-v1.md` | IN FORCE | Helena + Eitan (joint) | **Co-owner** (substrate + measurement methodology lead) | ORG-PR-11 |
| 4 | `Policies/funds-transfer-pricing-policy-v1.md` | IN FORCE | Eitan (Treasurer, governance) | **Owner** | BCBS Sound Liquidity Principles (2008) P4; reg.26 |
| 5 | `Policies/collateral-management-policy-v1.md` | IN FORCE | Eitan (Treasurer, governance) | **Owner** | ORG-PR-16, ORG-MK-06, ORG-MK-12, ORG-MK-13, ORG-JS2-003 |
| 6 | `Policies/treasury-investment-policy-v1.md` | IN FORCE | Eitan (Treasurer, governance) | **Owner** (HQLA universe) | reg.26 liquid assets; SARB PGN001 |
| 7 | `Policies/nostro-correspondent-banking-policy-v1.md` | COMMENCEMENT-BIND | Devon (Chief Operating Officer, governance) | Co-author; consumer (nostro funding + HQLA contribution) | FIC Act 38/2001 correspondent DD; reg.26 |
| 8 | `Policies/capital-management-policy-v1.md` | IN FORCE | Camille (Chief Financial Officer, governance) | Consumer (operational capital actions; PROC-CAP-CII-01) | ORG-PR-01…05, ORG-PR-13, ORG-PR-37, ORG-PR-44; ORG-PR-31/46 partial |
| 9 | `Policies/hedge-accounting-policy-v1.md` | IN FORCE | Camille (Chief Financial Officer, governance) | Consumer (designation/effectiveness side; PROC-ALM-HDT-01) | ORG-CS3-006, ORG-AC-03, ORG-GV-12 |
| 10 | `Policies/securities-financing-policy-v1.md` | IN FORCE | Saskia (Head of Global Markets, governance) | Co-author (repo for liquidity-buffer purpose) | reg.32 SFT |
| 11 | `Policies/payments-settlement-policy-v1.md` | COMMENCEMENT-BIND | Devon (Chief Operating Officer, governance) | Consumer (intraday liquidity interface; cut-off adherence) | NPS Act 78/1998; reg.26 |
| 12 | `Policies/excon-compliance-policy-v1.md` | IN FORCE | Zara (Chief Compliance Officer, governance) | Consumer (FX positioning within AD authority) | ORG-FX-FIN-01…14, ORG-EXCON-ODP-001 |
| 13 | `Policies/stress-testing-policy-v1.md` | **DRAFT** | Helena (Chief Risk Officer, governance) | Consumer (stressed-LCR management actions, policy §§ at lines on stressed LCR ≤120% / <100%) | ORG-PR-12 |
| 14 | `Policies/recovery-resolution-planning-policy-v1.md` | IN FORCE | Helena (Chief Risk Officer, governance) | Consumer (CFP Tier-3 ↔ Recovery EWI coupling) | ORG-PR-30, ORG-PR-35, ORG-BNK-RECOVERY-CONS |

**Universe verdict:** no missing policy heads. The Treasurer-owned set (ALM, FTP, collateral-management, treasury-investment; IRRBB jointly) plus the consumed set above covers the reg.26 / Basel liquidity-IRRBB-funding obligations end to end. Two status observations: `Policies/stress-testing-policy-v1.md` remains DRAFT (next-review 2026-11-13) while every other policy in the set is IN FORCE — ratification sits with Helena; and the brief's claim that the CFP is referenced from four policies verified as **three** by name (liquidity-risk-management, asset-liability-management, stress-testing) with the recovery-resolution-planning linkage running through the Tier-3 trigger `RecoveryEarlyWarningTriggered` rather than a textual CFP reference.

### B.1 Contingency Funding Plan assessment

**Where it lives.** The CFP is fully embedded in `Policies/liquidity-risk-management-policy-v1.md` §5: three activation tiers with typed-event triggers (§5.2), funding-source hierarchy (§5.3), annual rehearsal cadence and evidence standard incl. the W2-Slice-5 rehearsal harness (§5.4). Ownership: Eitan (plan maintenance + activation), Helena (stress-framework alignment), Devon (operational execution). Regulatory basis: BCBS 144 Principle 11 + `ORG-PR-15`; Banks Act ss.60–72 / reg.26 anchor the PA's documented-and-tested expectation.

**Assessment.** Reg 26 and BCBS 144 Principle 11 require a CFP that is *documented, board-approved, tested, and rehearsed* — they do not require a standalone policy document. The embedded treatment in LRM §5 satisfies the policy-level obligation and avoids creating a duplicate policy head for the same obligation set (a Principle 2 anti-pattern: ORG-PR-15 is already closed by the LRM policy). **Recommendation: retain the embedded policy treatment; do NOT author a standalone CFP policy.** However, three *operational* artefacts the embedded section presupposes do not yet exist, and without them the CFP is policy prose rather than an executable control:

1. **Trigger substrate.** None of the typed trigger events named in LRM §5.2 — `IntradayStressDetected`, `CriticalSettlementObligationAtRisk`, `LcrRatioBreach`, `FundingConcentrationAlertTriggered`, `ExternalCreditEventDetected`, `NsfrRatioBreach`, `RecoveryEarlyWarningTriggered` — exists in the event-type registry (verified: zero matches across `prototype/platform/`). No tier can fire. → Part D Wave 1.
2. **CFP plan instance.** §5.3 defines a funding-source *hierarchy class*; the rehearsable plan needs a maintained funding-source inventory register (sources, counterparties, capacities, activation lead-times). → Part D Wave 2.
3. **Invocation + rehearsal procedure.** No `PROC-RISK-CFP-*` exists; §5.4's annual rehearsal has no governing procedure and the rehearsal harness (W2 Slice 5, assigned to Ravi in §5.4) is unbuilt. → Part C pipeline + Part D Wave 2.

### B.2 Intraday liquidity (BCBS 248) assessment

**Policy level — adequate.** LRM policy §4 carries the full intraday section: the seven BCBS 248 monitoring tools (§4.2, tool-by-tool table), intraday buffer (§4.3), end-of-day discipline (§4.4), stress response (§4.5), closing `ORG-PR-08`. The policy itself honestly flags that real-time tool 7 (timing of flows) is not live — manual end-of-day reconstruction only.

**Register and substrate level — gap.** The structured RAS register (`prototype/platform/risk/ras-appetite-register.ts`, 16 lines) contains **no intraday-liquidity appetite line at all** — `appetite:liquidity:lcr` and `appetite:liquidity:nsfr` are the only liquidity lines (the brief understated this as "line has no measurement binding"; verified: the line does not exist). The live engine `prototype/platform/alm/intraday-stress.ts` is a BCBS 248-*framed* HQLA stress projection across the 4 NPS settlement windows (BAU + 2 stress scenarios), but the seven named BCBS 248 monitoring metrics are not computed as register-bound measures. → Part D Wave 1 (metrics + appetite line, Helena calibrates).

### B.3 Other policy-universe findings

1. **Three procedures cited by in-force policies do not exist** (verified file-absent): `Procedures/by-policy/ftp-curve-calibration.md` (cited twice by `Policies/funds-transfer-pricing-policy-v1.md` — it is where the optionality-adjustment and basis-threshold parameters are *supposed to be set*), `Procedures/by-policy/alm-limit-monitoring.md` (cited by `Policies/asset-liability-management-policy-v1.md`), `Procedures/by-policy/securities-lending-monitoring.md` (cited by `Policies/treasury-investment-policy-v1.md`). Dangling policy→procedure citations; → Part C pipeline.
2. **FTP cadence triple-divergence.** The FTP policy mandates *monthly* curve recalibration (ALCO-approved); the live handler `ravi:ftp-curve-publish` *publishes* daily; `Team/Eitan.md` §6 schedules a *quarterly* FTP review. Daily publication and monthly parameter recalibration are different objects, but no artefact says so — the authored `ftp-curve-calibration.md` must reconcile the three cadences. PROC-ALM-FTP-01's known naming residual (design-era paths/event names; `Team/Eitan.md` §16) is folded into the same fix.
3. **HQLA investment-mandate vs trading-mandate boundary — documented, no gap.** `Policies/treasury-investment-policy-v1.md` (Eitan) bounds the HQLA universe; `Policies/trading-mandate-v1.md` bounds franchise trading; the execution-vs-governance line is registered (`Team/Eitan.md` §15).

---

## Part C — Procedures required vs existing

### C.1 Existing treasury procedure set (verified from `Procedures/by-policy/` frontmatter)

| Procedure id | File | Status | Owner(s) | Note |
|---|---|---|---|---|
| PROC-ALM-ALCO-01 | `alco-cycle.md` | POPULATED | Eitan · Owen (secretariat) · Helena (appetite) | Capability LIVE: `@platform/alco`, `atlas:alco-pack` |
| PROC-RISK-ILAAP-01 | `ilaap-cycle.md` | POPULATED | Eitan · Helena · Camille | Capability LIVE: `@platform/ilaap`, `atlas:ilaap-run` |
| PROC-ALM-FXP-01 | `fx-position-governance.md` | POPULATED | Eitan · Saskia · Helena | Capability LIVE: `@platform/market-risk` |
| PROC-RISK-ILF-01 | `intraday-liquidity-funding.md` | POPULATED | Eitan · Ravi · Helena | Frontmatter cites capability as PLANNED though `platform/alm/intraday-stress.ts` is live; also cites RAS "§B5" which is the financial-crime section of the archived RAS doc — stale anchor |
| PROC-RISK-LLM-01 | `liquidity-limit-management.md` | POPULATED | Eitan · Ravi · Helena | — |
| PROC-RISK-IRRBB-01 | `irrbb-measurement.md` | POPULATED | Helena · Eitan · Ravi | Frontmatter cites `@platform/alm/irrbb-engine (PLANNED)` though EVE/NII engines live |
| PROC-ALM-FTP-01 | `ftp-attachment-on-product-event.md` | POPULATED | Eitan · Anya | Known residual: cites design-era `@platform/alm/ftp-engine (PLANNED)` + design-era event names; policy-parent says "FTP Methodology (planned)" though `funds-transfer-pricing-policy-v1.md` is IN FORCE |
| PROC-ALM-CVD-01 | `collateral-valuation-daily.md` | POPULATED | Eitan · Saskia | Policy-parent "(planned)" though collateral policy IN FORCE since 2026-05-14 |
| PROC-ALM-HDT-01 | `hedge-designation-test.md` | POPULATED | Eitan · Bea | Policy-parent "(planned)" though hedge-accounting policy IN FORCE |
| PROC-CAP-CII-01 | `capital-instrument-issuance.md` | POPULATED | Camille · Eitan | — |
| PROC-PR-01 | `capital-ratio-monitoring.md` | POPULATED | Camille · Helena · Eitan · Bea | Pre-convention id (not PROC-CAP-*); 2026-05-06 vintage |
| PROC-PAY-NM-01 | `nostro-management.md` | POPULATED | Tomas · Eitan | Policy-parent cites STUB policies though `nostro-correspondent-banking-policy-v1.md` now exists |
| PROC-MK-ODP-03 / -04 | `margin-vm.md` / `margin-im.md` | POPULATED | Ravi · Eitan · Imani (+Bea / +Rohan) | Collateral side |
| PROC-MK-REPO-01 | `repo-booking.md` | POPULATED | Saskia · Bea | Eitan consumer (repo-book sizing authority §9) |

`Team/Eitan.md` §13's "Planned: none" claim holds for *Eitan-owned governing* procedures (per `D-TREASURER-PROC-COMPLETION-2026-05-30`); the unauthored pipeline below sits at the Ravi operating level plus the policy-cited gaps found in Part B.

### C.2 Unauthored pipeline (proposed ids, owners, triggers)

Per Principle 6: in every procedure below the default actor of every step is an agent; any human-in-the-loop step carries a P2 citation to the obligation that mandates it.

| Proposed id | File | Owner(s) | Why / trigger | Wave |
|---|---|---|---|---|
| PROC-ALM-FTC-01 | `ftp-curve-calibration.md` | Ravi (lead) · Eitan · Anya | **Required now** — cited twice by in-force FTP policy; must carry the optionality/basis parameters and reconcile the daily-publish vs monthly-recalibration vs quarterly-review cadences (B.3) | Wave 1 |
| PROC-ALM-LIM-01 | `alm-limit-monitoring.md` | Ravi · Helena | **Required now** — cited by in-force ALM policy; ALM limit framework has no operating procedure | Wave 1 |
| PROC-ALM-DAR-01 | `daily-alm-run.md` | Ravi | Handler `ravi:alm-run` runs daily with no governing procedure; named in `Team/Ravi.md` §13 since v1.0 | Wave 1 |
| PROC-RISK-CFP-01 | `cfp-invocation-and-rehearsal.md` | Eitan · Ravi · Helena | Part B.1 recommendation — CFP invocation, tier governance, annual rehearsal evidence standard (LRM §5.4) | Wave 2 |
| PROC-INV-SLM-01 | `securities-lending-monitoring.md` | Eitan · Saskia | Cited by in-force treasury-investment policy; activates with securities-lending activity | Wave 2 |
| PROC-ALM-COL-01 | `collateral-management.md` | Ravi · Tomas | Operating procedure for inventory moves / substitution / rehypothecation control (PROC-ALM-CVD-01 covers only daily valuation + margin calls) | Wave 2 |
| PROC-ALM-HPE-01 | `hedge-programme-execution.md` | Ravi · Bea | Execution procedure distinct from designation/effectiveness (PROC-ALM-HDT-01); gated on first hedge designation | Wave 3 |

**Folded, not authored:** `intraday-liquidity-watch.md` and `ilaap-execution.md` from `Team/Ravi.md` §13's planned list are already covered by live PROC-RISK-ILF-01 and PROC-RISK-ILAAP-01; `ftp-attribution-cycle.md` is covered by live PROC-ALM-FTP-01. Ravi's §13 is corrected in this PR (spec drift, see Part E).

---

## Part D — Substrate plan

### D.1 Live today (verified at code level, 2026-06-10)

| Substrate | Code | Handler(s) | One-line state |
|---|---|---|---|
| ALM engine (repricing gap, ΔEVE 6 BCBS shocks, ΔNII) | `prototype/platform/alm/` (`repricing-gap.ts`, `eve.ts`, `nii.ts`) | `ravi:alm-run` (scheduled; `prototype/runtime/agents/metadata/ravi.ts`) | Live; zero-position build-phase posture |
| Intraday HQLA-stress projection | `prototype/platform/alm/intraday-stress.ts` | `ravi:intraday-stress` (scheduled) | Live; BAU + 2 BCBS 248 stress scenarios × 4 NPS windows |
| LCR / NSFR computation | `prototype/platform/liquidity/` (`lcr.ts`, `nsfr.ts`, `projection.ts`) | `anya:liquidity-projection` (scheduled; `prototype/runtime/agents/metadata/anya.ts`) | Live; event-store-backed provider |
| FTP curve + attribution | `prototype/platform/ftp/` (`curve.ts`, `attribution.ts`, `projection.ts`) | `ravi:ftp-curve-publish` (scheduled, daily) + `ravi:ftp-attribution` (event-driven) | Live with indicative rates (SARB repo + spreads); vendor feeds pending |
| Collateral inventory + HQLA classifier | `prototype/platform/collateral/` (`hqla-classifier.ts`, `inventory.ts`) | `atlas:collateral-snapshot` | Live; LCR HQLA levels L1/L2a/L2b; zero positions in build phase |
| ILAAP engine (4 stress scenarios + survival horizon) | `prototype/platform/ilaap/` (`stress-scenarios.ts`, `summary.ts`) | `atlas:ilaap-run` | Live |
| ALCO pack generator | `prototype/platform/alco/` (`pack.ts`, `serialise.ts`) | `atlas:alco-pack` | Live; pack generated from live projection events |
| RAS appetite lines (liquidity) | `prototype/platform/risk/ras-appetite-register.ts` | — | `appetite:liquidity:lcr` (binding `computeLCR`) + `appetite:liquidity:nsfr` (binding `computeNSFR`), both tier-1, measurement owner "Ravi (eng) → Eitan (Treasurer)" |
| BA-return generation (treasury-relevant) | `prototype/platform/reporting/` (`ba-300-lcr.ts`, `ba-300-nsfr.ts`, `ba-320-*.ts`, `ba-700-*.ts`) | period-close subscribers in `prototype/runtime/agents/` (e.g. `bea-ba300-lcr-period-close.ts`, registered via `callables/bea.ts`) | Generators live; submission-layer wiring tracked under the returns-submission workstream (`docs/2026-06-10_scrooge_returns-submission-wiring-workstream-scoping.md`) |
| Goal-loop instrumentation | — | `eitan:liquidity-snapshot` (`metadata/eitan.ts`), `ravi:alm-readiness` (`metadata/ravi.ts`) | Live; daily liquidity rollup + build-phase ALM readiness attestation |

### D.2 Gaps, sequenced into waves

**Wave 1 — build-phase, dispatchable now**

| Item | What | Owner | Trigger / dependency | Completion evidence (recon gate) |
|---|---|---|---|---|
| W1.1 CFP trigger substrate | Register the 7 typed trigger events of LRM §5.2 (B.1) + an EWI monitor handler that evaluates LCR/NSFR projections and funding-concentration against tier thresholds | Ravi (Treasury/ALM engineer, engineering) | None — events + thresholds fully specified in LRM §5.2 | New `recon:cfp-trigger-coverage` — every §5.2 trigger name resolves to a registered event type with at least one production emitter |
| W1.2 Intraday BCBS 248 metrics + RAS line | Compute the seven BCBS 248 monitoring metrics from settlement/nostro events; add `appetite:liquidity:intraday` line with measurement binding (Helena (Chief Risk Officer, governance) calibrates thresholds) | Ravi + Helena | Builds on `intraday-stress.ts`; nostro event streams exist | `recon:ras-register-parity` (line lands byte-faithful) + `recon:ras-cluster-feeder-coverage` (binding wired) |
| W1.3 Procedure↔policy frontmatter reconciliation | Fix stale "(planned)" policy-parents and capability paths in PROC-ALM-FTP-01 / -CVD-01 / -HDT-01, PROC-RISK-ILF-01 / -IRRBB-01, PROC-PAY-NM-01 (C.1 notes), incl. the ILF "§B5" mis-anchor | Ravi + Anya (Platform & data engineer, engineering) | None | `bun run citation-gate` zero violations; orphan-procedure recon stays green |
| W1.4 Wave-1 procedure authoring | PROC-ALM-FTC-01, PROC-ALM-LIM-01, PROC-ALM-DAR-01 (C.2) | Ravi (Eitan signs) | W1.3 fixes land first to avoid double-touch | Policy→procedure citations resolve; procedures register POPULATED |

**Wave 2 — pre-licence gate (mandatory before go-live readiness green)**

| Item | What | Owner | Trigger / dependency | Completion evidence |
|---|---|---|---|---|
| W2.1 Correspondent settlement interface | Build the designed-not-built connector; Ravi specifies funding-plan logic | Tomas (Operations & payments engineer, engineering) + Ravi | Correspondent/sponsor-bank selection (licence-application moment) | `Team/Ravi.md` §16 entry closes; settlement-state events flow end-to-end in rehearsal |
| W2.2 Treasury returns submission wiring | Wire BA 300 (LCR/NSFR), BA 330 (IRRBB), BA 700 (capital) generators into the submission layer | Mira (Compliance / RegTech engineer, engineering) + Bea (Accounting & financial reporting engineer, engineering) | Returns-submission workstream scoping (`docs/2026-06-10_scrooge_returns-submission-wiring-workstream-scoping.md`) | Completeness-audit inert-module gate green for treasury returns (WS-COMPLETENESS-AUDIT taxonomy) |
| W2.3 FTP live market-data feeds | ZARONIA / JIBAR / OIS / SAGB feeds replace indicative curve inputs | Ravi + Atlas (Core banking platform architect, engineering) | Vendor-selection phase | `FtpCurvePublished` events carry vendor-sourced curve provenance |
| W2.4 NSFR full balance-sheet scope | `BalanceSheetProjected` event closes the full BA 300-series NSFR scope (currently partial via CapitalEvent + DepositTaken + InterbankLoanPlaced) | Ravi + Bea | GL/event coverage of all balance-sheet classes | NSFR engine consumes `BalanceSheetProjected`; `Team/Ravi.md` §16 entry closes |
| W2.5 Non-trade contractual outflows | `SettlementInstructionIssued` event class folds non-trade contractual outflows into LCR denominator (today only buy-side trades with explicit `settlementDate` fold, per `buildSettlementOutflows` in `prototype/platform/projections/alm-positions.ts`) | Ravi + Atlas | W2.1 settlement-instruction stream helps | LCR recon asserts outflow completeness against instruction stream |
| W2.6 CFP plan instance + rehearsal harness + PROC-RISK-CFP-01 | Funding-source inventory register; W2-Slice-5 rehearsal harness (LRM §5.4); first full rehearsal | Eitan + Ravi (Helena aligns stress framework) | W1.1 trigger substrate | Rehearsal evidence pack per LRM §5.4 standard; annual cadence scheduled |

**Wave 3 — licence-day and after**

| Item | What | Owner | Trigger / dependency | Completion evidence |
|---|---|---|---|---|
| W3.1 Hedge-accounting posting boundary | Wire Ravi's designation/effectiveness events into Bea's GL posting path; `HedgeExecuted` / `HedgeAccountingClassified` typed events do not exist in the registry today (only `HedgeIneffective`, in `prototype/platform/event-store/event-types/markets-trading-extended.ts`) — register both + PROC-ALM-HPE-01 | Ravi + Bea | Gated on first hedge designation (post-licence per `Team/Ravi.md` §16) | Posting-engine single-subscriber gate stays green with the new emitter; hedge postings reconcile |
| W3.2 Live funding base activation | Real capital, real deposits, real HQLA buffer; intraday discipline at live correspondent scale; securities-lending monitoring (PROC-INV-SLM-01) activates | Eitan + Ravi | Licence-day | Daily funding events on real balances; LCR/NSFR on real positions |

**Build-phase vs licence-day split.** Wave 1 is pure build-phase engineering (no real money touched; per CLAUDE.md "Operating model" no real capital or customers exist pre-licence). Wave 2 must be green at the pre-licence go-live readiness gate (Saskia's substrate, co-owned with Rashida and Devon). Wave 3 binds at or after licence-day and is intentionally gated on real activity, not built speculatively.

---

## Part E — Spec drift corrected in this PR

Verified drift between `Team/Eitan.md` / `Team/Ravi.md` and the codebase, corrected in this PR with §17 changelog lines dated 2026-06-10:

1. **`Team/Eitan.md` §12** listed liquidity-projection engine, ALM engine, collateral inventory, and ALCO-pack generator as "planned" while its own §16 records all four closed 2026-05-19 (`D-TREASURY-GAPS-WAVE1`). §12 now points at the live code paths; correspondent settlement interface stays planned (true state).
2. **`Team/Eitan.md` §16** review-stamp said 2026-05-17 despite 2026-05-30 entries; restamped 2026-06-10 with the open-gap set from Part D (the section previously read as all-closed, which was itself drift). Superseded BA-form numbers in the collateral entry ("BA 325 Annex 1") re-anchored per `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` (LCR return = BA 300).
3. **`Team/Ravi.md` §12** listed ALM engine, FTP engine, and collateral inventory as "planned" — all live; corrected. Multi-curve engine and hedge-accounting boundary remain planned (true state).
4. **`Team/Ravi.md` §13** listed six planned procedure files, three of which are covered by live procedures under different names (C.2 "folded" note); reconciled to the real pipeline with proposed ids.
5. **`Team/Ravi.md` §16** superseded BA-form numbers ("LCR (BA 325)", "NSFR (BA 326)", "BA 325 Annex 1", "BA 326 full scope") re-anchored to BA 300 / BA 300-series per `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`; review-stamp updated to 2026-06-10.

**Residuals noted, not corrected here** (outside §12/§13/§16/§17 or owned by standing workstreams): persona-prose BA numbering in `Team/Eitan.md` §2/§4 and `Team/Ravi.md` §2/§4 (belongs to the replay-safe BA-renumber sweep under `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`); stale `Team Inbox/` role-brief paths in both §3s (post-RMS-Phase-4 they live at `archive/team-inbox/2026-05-06_role-brief_treasurer.md` and `..._treasury-alm-engineer.md`; an archive-path sweep should fix all personas at once); PROC-PR-01's pre-convention id (rename is a register-wide replay-safe operation).
