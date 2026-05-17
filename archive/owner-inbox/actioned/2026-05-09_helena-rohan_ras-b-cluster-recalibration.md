---
title: RAS B-cluster FX-settlement-concentration recalibration — proposed appetite lines (D-RAS-B-CLUSTER-CONCENTRATION-LINES)
author: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer)
date: 2026-05-09
summary: Helena (CRO) and Rohan (Risk engineer) propose five appetite lines (L-B8a-1 … L-B8a-5) anchoring the bank's FX-settlement / correspondent-bank concentration posture at the structural design produced by D-FX-CORRESPONDENT-PAIR-NAMING (Standard Bank primary; FirstRand-RMB backup; Absa + Nedbank held in reserve; no direct CLS / SAMOS membership during the build phase). The lines are deliberately calibrated **at** the named-pair posture (≤ 97% single-counterparty steady-state, top-2 ~100% by design, ≤ 100-day backup-readiness) so any drift away from the design **breaches** rather than silently normalising. Continuous-controls v0: register-row `urn:obligation:bank:risk:b-cluster-fx-settlement-concentration:v1` plus a recon-harness stub with a TODO that surfaces as a Vera substrate-gap finding. Substrate gaps named for the runtime recon, BRC-presentation cadence, and RAS version control.
decision-required: true
decision-id: D-RAS-B-CLUSTER-CONCENTRATION-LINES
---

# RAS B-cluster FX-settlement-concentration recalibration

**Authors:** Helena (Chief Risk Officer, governance) — lead · Rohan (Risk engineer)
**Date:** 2026-05-09
**For:** Marc (CEO) — ratification under D-RAS-B-CLUSTER-CONCENTRATION-LINES
**Authority chain:** D-FX-CORRESPONDENT-PAIR-NAMING (CEO-approved 2026-05-09) → D-M4-FX-SUB-DECISIONS Sub-1 (2026-05-09) → D-FX-CLS-MEMBERSHIP (2026-05-07) → D-MARKETS-SCHEMA-FOUNDATION (2026-05-07).

---

## 1. Why this is on Marc's desk

D-FX-CORRESPONDENT-PAIR-NAMING (record: `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fx-correspondent-pair-naming.md`; source proposal: `Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md`) approved a named-pair correspondent posture: Standard Bank primary; FirstRand (RMB) backup; Absa + Nedbank held in reserve. Combined with the build-phase indirect-participant operating-model decision (memory `project_indirect_participant_posture.md` — bank does not directly join CLS / SAMOS, accesses via sponsors), this produces **structural** intraday FX-settlement-rail concentration:

- Single-counterparty intraday FX-settlement notional, steady-state: **~95%**
- Top-2 cumulative: **~100% by design**
- Single-counterparty during quarterly + triggered switch-test windows: **90–95%** (the 5–10% backup-routing live test)

Helena (CRO) reviewed the read-back from Devon (COO, governance) and Tomas (Operations & payments engineer) on PR #58 and accepts that the figures are a **feature** of the named-pair design, not a control failure. The B-cluster lines below are calibrated **at** that posture — explicitly numerical, citation-anchored, and breach-detectable — so drift away from the design fires a continuous-controls finding rather than being absorbed silently.

Helena designs; CEO ratifies. Per memory `feedback_ceo_vs_board_approval.md`, this is a CEO-approval decision (not a Board approval) because it is a calibration of an existing approved RAS, not a structural change to the appetite framework.

## 2. Proposed appetite lines (full text in `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B8a)

A new sub-section **§B8a — Defaults — FX-settlement & correspondent-bank concentration (B-cluster)** is added to the RAF. The numbered lines:

| Line | Steady-state | Switch-test window | Severity | Rationale |
|---|---|---|---|---|
| **L-B8a-1** Single-counterparty intraday FX-settlement notional, % of daily total | **≤ 97%** | **≤ 99%** | `Hard` | Anchors at structural ~95% with 2pp drift-detection headroom |
| **L-B8a-2** Top-2 cumulative intraday FX-settlement notional | **≤ 100% by design** (observational) | ≤ 100% | Drift below 100% = `Critical` (signals unsanctioned third correspondent) | Top-2 = 100% IS the design |
| **L-B8a-3** Switch-test window override | n/a | window-bounded | n/a | Stops the test mechanism from firing L-B8a-1 |
| **L-B8a-4** Backup-readiness — last successful switch-test ≤ 100 days | ≤ 100 days | n/a | `Hard` | A stale backup is no backup |
| **L-B8a-5** Reserve-correspondents (Absa, Nedbank) contract status — "active-but-dormant" | active-but-dormant | n/a | `Soft` | Reserve list must remain real |

Each line carries a Principle-2 citation in §B8a:

- **D-FX-CORRESPONDENT-PAIR-NAMING** (decision record path above) — the named-pair authority.
- **`project_indirect_participant_posture.md`** — the operating-model basis for the structural posture.
- **BCBS Principles for Sound Management of Operational Risk (2021)** — concentration of operational dependencies. `[citation: TBC]` for the exact section number; Mira's regulatory-change pipeline will resolve the precise BCBS citation when she next runs.
- **BCBS Principles for Operational Resilience (2021)** — backup-readiness expectation underlying L-B8a-4. `[citation: TBC]`.

Pairing with §B8 (counterparty-credit concentration in markets) is explicit in the RAS body: §B8 governs credit; §B8a governs the operational-settlement rail. They share counterparties but score them on different lenses, and BRC reviews the aggregation.

## 3. Continuous-controls hookup (Rohan-led)

### 3.1 Register row (v0 substrate — landing in this PR)

A new entry under **Domain B (Financial crime, AML / CFT, sanctions)** of `Regulations/_obligations-register.md` is being added — the operational-risk concentration of payment rails sits under second-line oversight alongside Mira's sanctions-screening obligations because both share the upstream `FxSettlementInstructed` event population. The register entry uses a URN aligned to Mira's recent format (FinSurv wave-1 register PR #56 / Domain N pattern, PR #42):

- **URN:** `urn:obligation:bank:risk:b-cluster-fx-settlement-concentration:v1`
- **Owner:** Helena (CRO) (Rohan as engineer)
- **Status:** `DRAFTING` until CEO ratifies the lines, then flips to `IN FORCE` via an `ObligationStatusChanged` event.
- **Cross-references:** ORG-PR-17 (BCBS Operational Risk), ORG-PR-18 (BCBS Operational Resilience), §B8a of the RAS.

### 3.2 Recon-harness stub (v0 — TODO, surfaces as Vera finding)

The runtime concentration computation is **not** built in this PR. The pattern Rohan will follow is the backtest-harness substrate from his PR #27 plus the existing `prototype/platform/recon/` harnesses (see `dashboard-derivation-recon.ts`). The v0 stub is a register-row TODO; the real harness will:

1. Group the `FxSettlementInstructed` event population for a UTC settlement-day window by `correspondent` party.
2. Compute single-counterparty notional %, top-2 cumulative notional %, last-successful switch-test age, reserve-correspondent contract status.
3. Compare against L-B8a-1 … L-B8a-5; emit `LimitBreach` events for breaches.
4. Surface green / amber / red state on the obligations / appetite dashboard via `recon:dashboard`.

Until that lands, Vera (Internal-audit / continuous-assurance engineer) will report the runtime gap as a Wave-4 substrate-gap finding (#§5 below).

### 3.3 Switch-test window event

The override at L-B8a-3 requires Tomas (Operations & payments engineer) to file a `SwitchTestWindow { window_start, window_end, scope, reason }` event when a quarterly or triggered switch-test runs. The recon harness reads the open-window state to decide which threshold column to apply. Tomas's switch-test runbook (in proposal PR #58) is the procedure-layer authority; the event shape lives in Atlas's typed-event slice.

## 4. BRC presentation cadence

Helena chairs the BRC. Proposed cadence for §B8a:

- **First presentation:** at the next BRC tick after CEO ratification of these lines, alongside the standing limits-dashboard agenda item (per RAF §B11).
- **Standing item:** thereafter included in the monthly BRC pack as a top-cluster appetite line, with the live concentration figures and any switch-test window state.
- **Re-calibration trigger:** if D-FX-CORRESPONDENT-PAIR-NAMING is revisited (third correspondent added; direct-participant access to CLS / SAMOS approved) or if a switch-test surfaces a Hard breach of L-B8a-1 / L-B8a-4, Helena re-tables §B8a at the next BRC and proposes revised lines for CEO ratification.

(Note: today the BRC is the Interim Risk Forum until a Board is constituted — Owen [Company Secretary, governance] runs the pathway. Per memory `feedback_ceo_vs_board_approval.md` Marc currently wears both CEO and Board hats interim, so the calibration ratification and the BRC-presentation review are not in tension; the BRC presentation is the post-ratification *standing-item* commitment, not a separate approval gate.)

## 5. Substrate gaps surfaced

Captured here so the gap inventory (Scrooge / `feedback_synchronous_delegation.md`) tracks them as roadmap items rather than hidden:

1. **Vera Wave-4 backlog: B-cluster continuous-controls recon.** Daily concentration computation over `FxSettlementInstructed` events; daily backup-readiness age check; reserve-correspondent contract-status check. Owner: Rohan (engineer) under Helena (governance). Pattern: backtest-harness substrate (PR #27) + `dashboard-derivation-recon.ts`.
2. **Vera Wave-4 backlog: named-pair contract-status recon.** Independent assertion that the live-routing set never extends beyond {Standard Bank, FirstRand-RMB} except inside an open `SwitchTestWindow`. Pairs with L-B8a-2.
3. **Switch-test window event type.** `SwitchTestWindow` / `SwitchTestReport` event shapes are not yet in Atlas's typed-event slice. Owner: Atlas (Core banking platform architect) + Tomas (Operations & payments engineer); blocks 3.2.
4. **BRC-presentation cadence wiring.** No automated way today to surface §B8a as a BRC standing item — Helena tables manually until the BRC pack is generator-driven (RAF §B11 — generated, not assembled). Owner: Helena (governance) + Anya (data / analytics engineer) for the generator.
5. **RAS version control.** The RAS file `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` does not yet have a versioning convention (each amendment edits in place, with the change-log captured downstream in commit history and decision-record files). For a policy-layer document of this load-bearing weight, a versioned-file convention or a header-level changelog block would let Vera audit the line of force at any as-of date. Flagged for Owen (Company Secretary, governance) under the canonical-source registry (`feedback_canonical_source_registry.md`).
6. **Helena handover-note generator.** This note was written manually; the RAS-recalibration loop should produce these via the policy-pathway substrate (Owen's pathway tooling) once available. Per CLAUDE.md Principle 6 (presentations derive from data) the substrate is the authoritative direction of travel.

## 6. Conflict avoidance and citation anchors

- Mira's FinSurv URN cluster wave-1 (PR #56, landed) and Domain N M1-citation tranche (PR #42, landed) are cited as URN-format anchors. The new B-cluster URN follows that convention. No conflict — separate URN cluster; new register row sits in Domain B alongside the existing AML / sanctions entries.
- Devon (COO, governance) + Tomas (Operations & payments engineer) PR #58 is the source proposal for the named-pair posture; this recalibration sits **downstream** of it on the Principle-6 derivation graph (Reg / Posture → Policy / RAS → Standard / Limit-coded → Process / Recon harness → Data / Events).
- No file overlap with the in-flight Hoz application-chrome agent or the PAX 6 thin-human-layer role-research agent (separate scopes per the Scrooge dispatch brief).

## 7. Decision asked of CEO

**D-RAS-B-CLUSTER-CONCENTRATION-LINES** — Approve the five appetite lines L-B8a-1 … L-B8a-5 as drafted at §B8a of the RAS, including:

- L-B8a-1 single-counterparty cap of **≤ 97% steady-state / ≤ 99% switch-test window**.
- L-B8a-2 top-2 cumulative line as **observational at 100% by design**, with drift-below-100% as a `Critical` breach.
- L-B8a-3 switch-test window override.
- L-B8a-4 backup-readiness ≤ 100 days.
- L-B8a-5 reserve-correspondents active-but-dormant.

On approval, Mira flips the register row from `DRAFTING` → `IN FORCE` and Helena tables §B8a at the next BRC tick.

---

**End of handover note.**
