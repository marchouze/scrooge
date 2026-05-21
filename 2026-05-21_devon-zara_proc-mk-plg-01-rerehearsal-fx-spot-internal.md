---
title: PROC-MK-PLG-01 Pre-licence go-live readiness gate — RE-REHEARSAL (v2) for FX-spot internal test scope
author: Devon (Chief Operating Officer, governance) · co-author Zara (Chief Compliance Officer, governance)
date: 2026-05-21
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
gate-id: pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test-v2
prior-gate-id: pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test
procedure-cited: PROC-MK-PLG-01
brief: brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21
run: run:devon:2026-05-21T10-14-44-468Z
citations:
  - PROC-MK-PLG-01
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-NPA-FX-SPOT-INTERNAL-TEST
  - D-BRC-INTERIM-MR-1-FX
  - Banks-Act-94-of-1990-s11
  - Banks-Act-94-of-1990-s13
  - PR-667
  - PR-673
  - PR-674
  - PR-678
  - PR-680
---

# PROC-MK-PLG-01 — RE-REHEARSAL (v2) for FX-spot internal test scope

> **Posture.** This is the **rehearsal-of-the-rehearsal**. The first rehearsal (PR #667, gateId `pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test`) returned `BLOCKED-BY-NPA-fx-spot-schema-defined, NPA-fx-spot-risk-limits-set`. Both substantive blockers have now been cleared by Marc (CEO)'s approvals earlier today — PR #674 (D-NPA-FX-SPOT-INTERNAL-TEST) and PR #680 (D-BRC-INTERIM-MR-1-FX). This v2 walk confirms the substrate produces a clean gate-fire signal end-to-end.
>
> The v2 rehearsal emits `GoLiveGateActivated` and 11× `GoLiveConditionUpdated` envelopes against a **distinct rehearsal `gateId`** (`pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test-v2`). It does **not** emit `GoLiveReadinessAssessed` or `GoLiveReadinessConfirmed` — those require both co-chair quorum sign-offs (Devon + Zara as humans) AND CEO authority (Marc as human) AND a real licence in hand. The Phase 4 production-fire posture is not exercised by this rehearsal.

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-21 |
| Run sequence | v2 (re-rehearsal of v1; v1 deliverable at `2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md`, PR #667) |
| Activator (procedure owner) | Devon (Chief Operating Officer, governance) |
| Compliance co-chair | Zara (Chief Compliance Officer, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Scope | FX-spot **only** — unchanged from v1 (no FX-Forward extension) |
| Test perimeter | Internal pre-licence test — synthetic activity, no real ZAR/USD movement, no SWIFT MT300 leaves the bank, no counterparty entered into anything |
| Procedure | PROC-MK-PLG-01 (`Procedures/markets/pre-licence-go-live-gate.md`) |
| Authority | Brief `brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21`; dispatched by Scrooge (Chief of Staff) recording for CEO |
| Rehearsal gateId | `pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test-v2` |
| Prior rehearsal gateId | `pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test` (v1; PR #667) |
| Production gateId | unfired (and cannot fire until SARB licence held) |

### Sequence of canonical events between v1 and v2

| Time (UTC) | Event | Reference |
|---|---|---|
| 2026-05-21T08:30Z | v1 rehearsal: 4/11 Satisfied + 5/11 InProgress + 2/11 Open | PR #667 |
| 2026-05-21T09:23Z | `D-NPA-FX-SPOT-INTERNAL-TEST` requested by Saskia (Head of Global Markets) | PR #673 |
| 2026-05-21T09:28Z | `D-NPA-FX-SPOT-INTERNAL-TEST` CEO-approved; `ProductApproved{productId:"prd:bank:fx:fx-spot-usdzar", version:"0.1.0-internal-pre-licence-test"}` emitted | PR #674 |
| 2026-05-21T09:?Z | `D-BRC-INTERIM-MR-1-FX` requested by Owen (Chief Company Secretary, governance) | PR #678 |
| 2026-05-21T09:50Z | `D-BRC-INTERIM-MR-1-FX` CEO-approved Option A | PR #680 |
| 2026-05-21T10:30Z | v2 rehearsal: **6/11 Satisfied + 5/11 InProgress + 0/11 Open** | this deliverable |

## 2. The 11-condition table (v2 walk)

### NPA product-readiness for FX-spot (5 conditions)

| # | Condition | v1 status | v2 status | Evidence (v2) | Sign-off |
|---|---|---|---|---|---|
| 1 | NPA-fx-spot-schema-defined — FX-spot product schema defined and NPA-approved | Open | **Satisfied** ↑ | PR #674 — `ProductApproved{productId:"prd:bank:fx:fx-spot-usdzar", version:"0.1.0-internal-pre-licence-test"}` on main; PR #673 — Saskia PROC-NPA-GATE-01 walk closing 13/14 dimensions | Zara |
| 2 | NPA-fx-spot-pricing-model-validated — FX-spot pricing model validated and independently signed-off | InProgress | InProgress | PR #643 — SARB fixing ingester (Atlas, Core banking platform architect, engineering); Helena (Chief Risk Officer, governance) G-1 attestation §2.1 in PR #631 | Zara |
| 3 | NPA-fx-spot-risk-limits-set — FX-spot risk limits set and BRC-tabled | Open | **Satisfied** ↑ | PR #680 — D-BRC-INTERIM-MR-1-FX CEO-approved Option A 2026-05-21T09:50Z; PR #678 — Owen decision card; PR #634 — Helena MR-1-FX framework (VaR ZAR 350k; EOD USD 1m; intraday USD 1.5m; per-cpty USD 500k/day) | Devon+Zara |
| 4 | NPA-fx-spot-conduct-obligations-mapped — FX-spot conduct obligations mapped to PROC-MK-PCG-01 | Satisfied | Satisfied | `Procedures/markets/pre-trade-conduct-gate.md` (PROC-MK-PCG-01); PR #633 no-prop attribution XOR; `Policies/insider-trading-policy-v1.md` | Zara |
| 5 | NPA-fx-spot-front-to-back-confirmed — FX-spot front-to-back system capability confirmed | Satisfied | Satisfied | PR #645 — scenario `prototype/scenarios/fx-spot-internal-pre-licence-test.ts` returns READY-FOR-CONTROLLED-LAUNCH; PR #647 — Saskia + Kai walkthrough | Devon |

### OPS-readiness (6 conditions)

| # | Condition | v1 status | v2 status | Evidence (v2) | Sign-off |
|---|---|---|---|---|---|
| 6 | OPS-trading-system-operational — Trading system operational and tested | Satisfied | Satisfied | Manual booking flow at `dashboard/public/trade-book.html` (live); scenario PR #645 both paths | Devon |
| 7 | OPS-settlement-connectivity — Settlement connectivity with correspondent bank confirmed | InProgress | InProgress | PR #640 — Tomas (Correspondent banking & payments, engineering) FX settlement subscriber (LIVE-INTERNAL-VARIANT) | Devon |
| 8 | OPS-regulatory-reporting-pipelines — Regulatory reporting pipelines (FinSurv, SARB returns) live and tested | InProgress | InProgress | PR #644 — Rashida (Chief Information Security Officer, governance) FinSurv ExCon ruling; BA-325 LCR via PR #645; BA-700/600/350 via PRs #436–#444 | Devon |
| 9 | OPS-mandate-counterparty-registries — Mandate and counterparty registries populated and validated | Satisfied | Satisfied | PR #639 — Saskia Party register; PR #642 — Yael (Treasurer & Tax, engineering+governance) credit limits + netting-set; PR #637 — Imani (Chief Legal Counsel, governance) G-9 ISDA decision | Zara |
| 10 | OPS-conduct-gate-tested — Conduct gate (PROC-MK-PCG-01) tested end-to-end | InProgress | InProgress | Check 1 (`checkHeadroom`) LIVE per PR #614 + PR #618; remaining four checks PLANNED per Saskia + Kai walkthrough §6 | Devon+Zara |
| 11 | OPS-bcp-tested — BCP and settlement-failure procedure (PROC-OPS-SFBCP-01) tested | InProgress | InProgress | PR #636 — Devon authored PROC-OPS-SFBCP-01 v0.3; PR #640 — Tomas failure-path subscriber; PR #645 Phase 3 Herstatt-active exercised | Devon |

### Aggregate

| Status | v1 count | v2 count | Δ |
|---|---|---|---|
| Satisfied | 4/11 | **6/11** | +2 |
| InProgress | 5/11 | 5/11 | 0 |
| Open | 2/11 | **0/11** | −2 |

## 3. Regulatory approvals (unchanged from v1 — all wall-clock)

| # | Approval | Authority | Status |
|---|---|---|---|
| 1 | REG-SARB-BANK-LICENCE — Banks Act s.13 banking licence | SARB Prudential Authority | NotHeld |
| 2 | REG-FSCA-FSP-LICENCE — FAIS Act s.7 FSP licence | FSCA | NotHeld |
| 3 | REG-POPIA-IO — POPIA Information Officer registration | Information Regulator | NotHeld |
| 4 | REG-AUDITOR-ENGAGEMENT — Engagement letter signed | External auditor (TBD) | NotHeld |
| 5 | REG-KEY-INDIVIDUALS — FAIS KIs + fit-and-proper directors | FSCA + PA | NotHeld |

Regulatory approvals received: **0/5**. These are external, wall-clock items that cannot be self-certified and do not block the internal-test fire-readiness signal. They will block production fire of PROC-MK-PLG-01.

## 4. CEO recommendation — INTERNAL-TEST FIRE-READINESS

**INTERNAL-TEST FIRE-READINESS: READY-FOR-INTERNAL-TEST.**

Devon (Chief Operating Officer, governance), as procedure owner and v1 activator, declares the FX-spot internal-pre-licence-test perimeter ready. Zara (Chief Compliance Officer, governance) concurs as compliance co-chair. The declaration rests on:

1. **Zero substantive Open conditions** — the two v1 blockers (NPA-fx-spot-schema-defined; NPA-fx-spot-risk-limits-set) are cleared at the canonical-event level by `ProductApproved` and `Decision{D-BRC-INTERIM-MR-1-FX, phase:"approved", authority:"CEO", authorityRef:"marc@tgv.co.za"}`. Both events are in the production event store; both flow from CEO-authorised decisions filed today.
2. **The five `InProgress` conditions** (pricing-model validation; settlement connectivity; regulatory reporting pipelines; conduct gate end-to-end; BCP testing) all carry documented compensating controls acceptable for the internal-test perimeter (synthetic activity, no real ZAR/USD movement, no SWIFT leaving the bank). None of these compensating controls are acceptable for production fire — they must be retired (G-1, G-2, Bloomberg BFIX, full ConductGate envelope wiring, broader BCP testing, real correspondent-bank engagement post-licence) before any future `GoLiveReadinessConfirmed`.
3. **The five wall-clock regulatory approvals** remain NotHeld and are correctly out of internal-test scope.

### No new blocker found in v2

Devon + Zara have re-walked the substrate and the canonical event chain produced by the two approval scripts (`scripts/approve-d-npa-fx-spot-internal-test.ts` and `scripts/approve-d-brc-interim-mr-1-fx.ts`). No new blocker has surfaced since v1. The two approvals are clean, scoped correctly to internal-pre-licence-test, and carry the explicit successor-decision pointer (D-BRC-INTERIM-MR-1-FX-RETABLE) for licence-day re-tabling.

### What this declaration does NOT do

- It does NOT activate the real PROC-MK-PLG-01 gate (no `GoLiveReadinessAssessed` or `GoLiveReadinessConfirmed`).
- It does NOT clear the path to commencement-of-trading — that requires the 5 wall-clock regulatory approvals.
- It does NOT retire any of the 5 compensating controls — those remain on the blocker register for production fire.
- It does NOT authorise any real FX-spot trade with a real counterparty.

What it DOES authorise is the FX-spot internal-test perimeter being exercised against the live substrate with `ProductApproved` and CEO-approved MR-1-FX limits in force — the substrate is now end-to-end coherent for internal-test scope.

## 5. Substrate gap — GoLive event-type codification (carried from v1)

The four GoLive event types referenced by PROC-MK-PLG-01 (`GoLiveGateActivated`, `GoLiveConditionUpdated`, `GoLiveReadinessAssessed`, `GoLiveReadinessConfirmed`) remain uncodified in `platform/event-store/event-types/` and `platform/event-store/registry.ts`. The build-phase fail-open posture (per `registry.ts` header) lets the raw envelopes append cleanly, but the events flow through the store as untyped — no Zod validation, no projection-friendly factory functions, no recon coverage.

This gap was surfaced in the v1 rehearsal report (§Substrate gap, PR #667). It has not yet been picked up. Recommended dispatch: Atlas (Core banking platform architect, engineering) to author the Zod schemas + `make<Type>` factories + registry rows in a follow-on slice; Vera (Internal-audit engineer, engineering, third-line) to add a `recon:golive-event-coverage` pipeline once codified.

## 6. Substrate gap — `GoLiveInternalTestReady` declaration event does not exist

Brief Part 3 asks whether a `GoLiveInternalTestReady` event type exists, suggesting it could be emitted as an optional declaration at gate-co-owner discretion. **It does not exist** — a `grep` across `prototype/` (post-rebase) finds no references to `GoLiveInternalTestReady` outside the rehearsal runner scripts themselves.

Inventing it now as a raw envelope would create a new untyped event kind on the fly, which is the same anti-pattern §5 already flags for the four PROC-MK-PLG-01 GoLive types. The cleaner posture is to surface it as a substrate gap rather than minting it.

Recommended dispatch (combined with §5): Atlas to design + codify a `GoLiveInternalTestReady` (or named alternative — Devon + Zara have no naming preference; the type-name lives in the event-type registry) that captures the gate co-owners' declaration that internal-test fire-readiness criteria are met, with payload schema including `gateId`, `priorRehearsalGateIds`, `internalTestReady: true`, `coChairs`, and `compensatingControls` for retirement-tracking. Once codified, Devon + Zara can emit it as the canonical declaration; until then, this markdown deliverable (RecordFiled) is the canonical-form declaration of READY-FOR-INTERNAL-TEST.

## 7. Cross-references

- **First rehearsal (v1)**: `2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md` (PR #667). The 11 conditions, the 5 wall-clock regulatory approvals, and the broader substrate-state narrative are unchanged; this v2 deliverable supplements rather than supersedes.
- **NPA approval**: PR #674 (D-NPA-FX-SPOT-INTERNAL-TEST CEO-approved 2026-05-21T09:28Z); PR #673 (Saskia's PROC-NPA-GATE-01 walk).
- **MR-1-FX approval**: PR #680 (D-BRC-INTERIM-MR-1-FX CEO-approved Option A 2026-05-21T09:50Z); PR #678 (Owen's decision card); PR #634 (Helena's controlled-launch MR-1-FX limit proposal).
- **Procedure**: `Procedures/markets/pre-licence-go-live-gate.md` (PROC-MK-PLG-01).
- **Policies cited**: `Policies/market-risk-policy-v1.md` §3/§3.1/§6 (CEO interim provisions); `Policies/credit-risk-policy-v1.md`; `Policies/insider-trading-policy-v1.md`.
- **Successor decision card**: D-BRC-INTERIM-MR-1-FX-RETABLE — opens for mandatory re-tabling of MR-1-FX at Board Risk Committee constitution; pinned to production fire of PROC-MK-PLG-01.

## 8. What happens next

Devon + Zara declare READY-FOR-INTERNAL-TEST. Marc may, at his discretion, dispatch:

1. **The internal pre-licence FX-spot test itself** — the substrate is now coherent end-to-end for the internal-test perimeter; Saskia + Kai (Markets engineering lead) can exercise the scenario harness or the manual booking UI against the substrate as it stands.
2. **Retire one or more compensating controls** — G-1 / G-2 retirement, broader BCP drills, full ConductGate envelope wiring, FinSurv production wiring. Each of these is a substantive piece of pre-licence-day work and lifts a Compensating-control-only blocker off the production-fire register.
3. **Codify the GoLive event types** — close the §5 + §6 substrate gaps so that future rehearsals (and the eventual production fire) emit typed events with full Zod + projection coverage.
4. **Hold the line** — no further dispatch; v2 READY-FOR-INTERNAL-TEST stands as evidence the substrate is sound at the level of FX-spot internal-test perimeter.

---

**Signed**

- Devon (Chief Operating Officer, governance) — procedure owner; READY-FOR-INTERNAL-TEST declared.
- Zara (Chief Compliance Officer, governance) — compliance co-chair; concurs.
