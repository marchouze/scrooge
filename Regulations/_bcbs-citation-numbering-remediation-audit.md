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

### Platform code — deposit-funding BA-300 (PR #1568, landed on main mid-remediation)
- `prototype/platform/returns/ba300/consolidated-lcr.ts`, `deposit-funding-sim-book.ts`, `period-close-subscriber.ts`, `deposit-funding-sim-golden.test.ts`, `period-close-subscriber.test.ts` — all LCR `BCBS D295 → BCBS D238` (§142/§47/§69/§50/§31/§17 HQLA paragraphs, LCR golden case). The NSFR `BCBS 295` (no-D form) tokens are **correct** and preserved. This BA-300 build shipped the same LCR=d295 defect AFTER the register was corrected — caught because the rebase pulled it in; the new recon gate's scan was widened to `platform/returns` so this class cannot recur unscanned.

### Platform-wide estate sweep (full prototype/ tree)

The defect was **systemic across the whole `prototype/` codebase**, not just the register. Swept and corrected (LCR `D295/-D295 → D238/-D238`; NSFR `D335/-D335 → D295/-D295`; IRRBB prose `d365 → d368`) across ~40 files incl.:
- **Engines / projections:** `platform/projections/alm-positions{,-v2}.ts`, `platform/reporting/ba-300-lcr.ts` (+ test/xml-adapter), `platform/returns/ba300/*`.
- **Semantic + registries + event-types:** `platform/semantic{,-layer}/*`, `platform/event-store/event-types/{liquidity-limit,ftp,alm,repo-mmd-ibl}.ts`, `platform/event-store/registry/{liquidity-limit,cfp-triggers}.ts` (incl. emitted `citationsHint` constants `BCBS-D238`/`BCBS-D295`).
- **Risk + recon:** `platform/risk/liquidity-limit-engine/types.ts`, `platform/recon/{ba300-deposit-funding-sim-drive,liquidity-limit-breach-unescalated,recon-liquidity-position-vs-settled-notional}.ts`, `platform/substrate/gap-register.ts`.
- **Runtime agents:** `runtime/agents/{ravi-alm-run,ravi-alm-readiness,ravi-balance-sheet-projector,eitan-liquidity-snapshot,helena-risk-appetite-watch}.ts` + `metadata/ravi.ts` (incl. emitted citation constants `BCBS-D238-LCR`/`BCBS-D295-NSFR`).
- **v2-core + generated contracts:** `v2-core/accounting/chart-of-accounts.ts`; `v2-core/regulatory-returns/gen-return-contract.py` (generator) + `ba300-contract.json` / `ba310-contract.json` (regenerated from the .py — verified byte-consistent with the hand-edit).
- **Scripts / scenarios / seeds / tests:** `scripts/{render-ba-110,party-backfill,record-d-reporting-capability-slice-1/3,record-d-regulatory-readiness-w2-slice-1,record-d-coa-currency-decoupling,sim/seed-deposit-funding-book-sim-v1,decisions/helena-bond-ras-appetite-approve}.ts`, `scenarios/{11-liquidity-ratios,_phase-d-helpers}.ts`, `seeds/agent-memory/notes.seed.json`, `prototype/tests/*` (incl. the `toContain("BCBS D238")` assertion in `tests/ba-300-lcr.test.ts` that pinned the corrected emitted citation).
- **Procedures (prototype copy):** `prototype/Procedures/by-policy/{ba-300-liquidity-risk-return,ba-310-min-reserve-liquid-assets-return}.md`.

`BCBS D396` / `BCBS-D396` (alongside NSFR) is **verified correct** against BIS — d396 is *"Basel III — The Net Stable Funding Ratio: FAQs"* (Feb 2017), a legitimate NSFR companion citation. Left unchanged.

### New control
- `prototype/platform/recon/bcbs-citation-number-integrity.ts` — fail-closed, harden-only gate (registered in `package.json` + the `domain` recon suite). Pins each cited BCBS number to its canonical title via high-precision forbidden-pairing apposition checks (before- AND after-token apposition, so a number directly apposed to its own title is never flagged on a multi-standard line). Scans `Policies`, `Procedures`, `Regulations`, and the **whole `prototype/` estate** (`platform`, `runtime`, `v2-core`, `scripts`, `scenarios`, `seeds`, `tests`, `Procedures`). Proven to catch the d295=LCR, d335=NSFR, d335=IRRBB, d365=IRRBB, d295=stress-testing defects and green on the corrected tree (**2602 tokens checked**). Excludes `platform/alm/*` (alm-chip scope), the generated minified contract JSON (validated via its `.py` generator), the audit file, and the gate's own source.

## 4. Flagged findings — NOT fixed here (scope exclusions / coordination)

Per Charter cmd 5 (no silent deferral), the following are recorded rather than silently dropped:

- **`BCBS-D365-IRRBB` citation constant + `platform/alm/*` d365 prose** — ✅ **RESOLVED in the Rohan finisher pass (§6 below).** The constant was renamed `BCBS-D365-IRRBB → BCBS-D368-IRRBB` across all 16 sites; the alm/engine/registry/projection prose was corrected `d365 → d368`; the recon gate's `platform/alm/*` exclusion was lifted and the gate was extended to also catch the hyphenated constant form. (The original recommendation below is retained for trail.) Original flag: the constant is a replay-sensitive event-citation identity that should become `BCBS-D368-IRRBB`; `eve.ts:236` carried `BCBS d365 §4` IRRBB prose; coupled to `platform/alm/*` (chip `task_0946bdf9`); PR #1574 had corrected only `repricing-gap.ts`.
- **`Team/Eitan.md` and `Team/Rohan.md`** — ✅ **RESOLVED in the Rohan finisher pass (§6 below).** `Team/Eitan.md:165` and `Team/Ravi.md:157` carried the WRONG assertion "6 BCBS d365 shocks" (fixed → d368). `Team/Rohan.md` carries **no** d365. The CORRECT explanatory d365 mentions in both specs ("d365 is not the NSFR/IRRBB" challenge notes) were preserved verbatim.
- **`.github/workflows/agent-runtime-ravi-balance-sheet-projector.yml:14`** — comment cites `BCBS D295/D396` and `Reg 26A`. Both BCBS numbers are correct for NSFR here (d295 = NSFR standard; d396 = NSFR FAQs). Only `Reg 26A` is stale — it was already flagged non-existent in the register v1.45 correction (correct provision: Reg 26(14)/(14)(d)). Left as a non-citation CI comment; **flag** for a Reg-numbering tidy (out of d-number scope).
- **`BCBS D196 §645–§654` (BIA op-risk) — CONFIRMED MIS-CITED against the BIS source (Rohan finisher pass); recorded, NOT fixed here — see §6.B.** Validated against bis.org: **BCBS d196 = *"Operational Risk – Supervisory Guidelines for the Advanced Measurement Approaches"* (AMA), 30 Jun 2011** (`bis.org/publ/bcbs196.pdf`). d196 is about the **AMA** and does **not** define the Basic Indicator Approach (BIA), the α = 15% factor, the business-line β factors, or the gross-income definition. Those — paragraphs **§644–§654** — originate from **Basel II: International Convergence of Capital Measurement and Capital Standards (bcbs128, Jun 2006)**, whose operational-risk section runs §644 onward (BIA at §649–§651). The repo therefore mis-attributes the BIA computation (§645–§654) and the seven loss-event categories (§644) to d196 when the correct source is **bcbs128** (and, in the consolidated framework, **OPE20** BIA / **OPE25** TSA). This is a **23-file / 63-token** cross-cutting op-RWA change including **11 emitted-citation-constant sites** (`BCBS-D196-§644`) — the same replay-sensitive class as the d365 constant. It is **out of the IRRBB/d365 dispatch scope** and requires **Helena (CRO) op-RWA co-authority decider sign-off** + a scoped replay-safety pass. **Recommendation:** a successor op-risk-scope dispatch under a fresh Decision should rename `BCBS-D196-§644 → BCBS-D128-§644` (or the OPE-chapter URN) and correct the §645–§654 prose to bcbs128/OPE, mirroring the d365 method here.

## 5. Definition of Done

- [x] Numbers corrected at source (seed) + re-rendered (md/html); seed-parity holds (0 divergence).
- [x] `_risk-taxonomy.md` RT-LQ corrected; RT-IRRBB confirmed.
- [x] Library-wide audit logged (this file); no silent truncation.
- [x] New fail-closed `recon:bcbs-citation-number-integrity` gate, green + proven to catch the defect.
- [x] Ravi §18–20 re-landed with corrected numbers + §20 note.
- [x] Findings outside scope flagged, not dropped (§4).

## 6. Finisher pass — IRRBB d365 → d368 tail (Rohan)

**Author:** Rohan (Risk engineer — market & counterparty-credit risk, engineering). **Domain co-authority:** Helena (Chief Risk Officer) for the op-risk d196 call.
**Brief:** `brief:rohan:irrbb-d365-to-d368-finisher-team-specs-alm-const:2026-06-26`. **Authority:** `D-BCBS-CITATION-NUMBERING-REMEDIATION`.

This pass closes the `platform/alm/*` + constant tail that the original remediation excluded (one-dispatch-path-per-scope), plus the Team-spec IRRBB mis-assertions, and verifies the op-risk d196 flag against the BIS source.

### Premise re-validation (BIS oracle, bis.org)
- **d368** = *Interest rate risk in the banking book* (IRRBB standard, 21 Apr 2016) — `bis.org/bcbs/publ/d368.pdf`. ✓
- **d365** = *Revisions to the Basel III leverage ratio framework* — **consultative** (6 Apr 2016); **NOT** IRRBB — `bis.org/bcbs/publ/d365.htm`. ✓
- Premise **CONFIRMED.** Every d365-as-IRRBB assertion is wrong; the IRRBB standard is d368. The bank's own registered URN was already correct: `BCBS-D368-IRRBB-2016` (`runtime/agents/mira-m1-regulator-citation-urns.ts`, ORG-PR-11).

### A. Changes made

**A.1 — Event-citation CONSTANT renamed `BCBS-D365-IRRBB → BCBS-D368-IRRBB` (16 files, replay-safe — see A.4):**
`Procedures/by-policy/daily-alm-run.md`; `prototype/platform/collateral/hqla-classifier.ts`; `prototype/platform/event-store/registry/{alco.ts, markets.ts (×4)}`; `prototype/platform/markets/eod/{irs-revaluation.ts (×2), jibar-curve-seed.ts}`; `prototype/platform/projections/irrbb-delta-eve.test.ts`; `prototype/platform/risk/ras-appetite-register.ts`; `prototype/runtime/agents/{atlas-alco-pack.ts, ravi-alm-readiness.ts, ravi-alm-run.ts, ravi-ftp-attribution.ts, ravi-ftp-curve-publish.ts, rohan-daily-mtm.ts}`; `prototype/scripts/{decisions/helena-bond-ras-appetite-approve.ts, seed-v2-helena-ras-postures.ts}`. Plus the lowercase `citationsHint` variant `"BCBS-d365"` in `prototype/platform/event-store/registry/repo-mmd-ibl.ts` normalised to `"BCBS-D368-IRRBB"`.

**A.2 — IRRBB PROSE `d365 → d368` across the live tree (engine + registries + projections + returns + runtime + scripts):**
`prototype/platform/alm/{eve.ts (×2: §185, §236), nii.ts (×2), index.ts (×2), __tests__/{repricing-gap.test.ts, nii.test.ts}}`; `prototype/platform/alco/pack.ts`; `prototype/platform/event-store/event-types/{alco.ts, index.ts (×4)}`; `prototype/platform/event-store/registry/{alco.ts, index.ts (×3), missing-types.ts (×2), repo-mmd-ibl.ts}`; `prototype/platform/projections/{irrbb-delta-eve.ts (×6), irrbb-delta-eve.test.ts (§A-3.4 prose ×2)}`; `prototype/platform/recon/liquidity-appetite-snapshot-coverage.ts`; `prototype/platform/returns/ba330/period-close-subscriber.ts (×5)`; `prototype/platform/risk/ras-appetite-register.ts (prose ×4)`; `prototype/runtime/agents/{atlas-alco-pack.ts, metadata/{atlas.ts, ravi.ts}, mira-ba330-period-close.ts (×3)}`; `prototype/scripts/seed-v2-helena-ras-postures.ts (×3)`. (The brief's named subset was a floor — the defect was wider; swept the whole live tree.)

**A.3 — Team specs (surgical — wrong assertions fixed, correct explanatory mentions preserved):**
- `Team/Eitan.md:165` — "ΔEVE (6 BCBS d365 shocks)" → **d368**. Preserved verbatim: §191 + §244 challenge notes (which correctly explain *d365 is NOT the NSFR/IRRBB*).
- `Team/Ravi.md:157` — "ΔEVE (6 BCBS d365 shocks)" → **d368**. Preserved verbatim: §181 / §233 / §234 challenge notes (*d365 is not IRRBB*). Updated the now-stale §237 live-code finding to RESOLVED (repricing-gap.ts fixed in #1574; the alm tail fixed here).
- `Team/Rohan.md` — no d365 present.

**A.4 — Recon gate extended** (`prototype/platform/recon/bcbs-citation-number-integrity.ts`): the `platform/alm/*` exclusion is **lifted** (alm now scanned), and a dedicated `CONSTANT_RE` was added so the hyphenated `BCBS-D<nnn>-<TAG>` constant form is checked too (the TAG is the title in apposition). Re-injecting `BCBS d365` IRRBB prose **and** a `BCBS-D365-IRRBB` constant into `platform/alm/eve.ts` was proven to FAIL the gate (2 findings); reverting returns green. Token count 2600 → 2747.

### A.4 (replay-safety determination on the constant) — **SAFE**
The `BCBS-D365-IRRBB` rename is **replay-safe**; it is a citation LABEL, not an event discriminator/type or hash-key:
- Event identity (`event_id`) is **not** derived from citation content; `citations`/`citationsHint` are free `string[]` metadata passed straight through `makeIRRBBChecked` etc. (the discriminator is `type: "IRRBBChecked"`).
- The only gate over `citations` (`platform/citation/gate.ts`) asserts **non-emptiness** only — no exact-string/hash parity against the stored log.
- No parity/snapshot recon compares the literal `BCBS-D365-IRRBB` against persisted home-store events; tests using it (`irrbb-delta-eve.test.ts`) seed their **own in-memory** store, so input and expectation move together.
- The canonical registered URN was already `BCBS-D368-IRRBB-2016`; the `D365` label never matched it — the rename moves the loose label **toward** canonical.
- **Principle 1 (append-only):** historical events already in the store are **NOT** rewritten; the rename is "correct going forward" only. The `archive/owner-inbox/*` rendered records that mirror old emissions are left untouched.

### B. Op-risk d196 / BIA §645–§654 — VERDICT: **CONFIRMED MIS-CITED; flagged, not fixed (out of scope)**
Validated against the BIS source (Helena co-authority domain call):
- **BCBS d196** = *"Operational Risk – Supervisory Guidelines for the Advanced Measurement Approaches"*, **30 Jun 2011** (`bis.org/publ/bcbs196.pdf`) — an **AMA** guideline. It does **NOT** define the BIA, the α = 15% factor, business-line β factors, or the gross-income definition.
- The **§644–§654** paragraphs (seven loss-event categories §644; BIA computation, α, β, gross income §645–§654) are from **Basel II: International Convergence (bcbs128, Jun 2006)** — operational risk §644 onward; in the consolidated framework, **OPE20** (BIA) / **OPE25** (TSA).
- **Conclusion:** the repo's `BCBS D196 §645–§654` / `BCBS-D196-§644` citations are **mis-attributed** — the correct source is **bcbs128 / OPE**.
- **Not fixed here.** Per flag-don't-invent + one-dispatch-path-per-scope: this is a **23-file / 63-token** op-RWA change including **11 emitted-citation-constant sites** (`BCBS-D196-§644`, same replay-sensitive class), outside the IRRBB/d365 dispatch scope, and it needs **Helena (CRO) op-RWA decider sign-off** under a fresh Decision. Recommendation recorded in §4.

### C. Verification
- `recon:bcbs-citation-number-integrity` — **green** (2747 tokens), re-injection-proven (prose + constant, in alm).
- Full `bun run ci` (full `tsc --noEmit` + recon suite) — green. `bun run citation-gate` — zero violations.
