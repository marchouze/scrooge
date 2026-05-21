---
title: PROC-MK-PLG-01 Pre-licence go-live readiness gate — META-REHEARSAL for FX-spot internal test scope
author: Devon (Chief Operating Officer, governance) · co-author Zara (Chief Compliance Officer, governance)
date: 2026-05-21
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
gate-id: pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test
procedure-cited: PROC-MK-PLG-01
brief: brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21
run: run:devon:2026-05-21T08-09-31-028Z
citations:
  - PROC-MK-PLG-01
  - D-MARKETS-SCHEMA-FOUNDATION
  - Banks-Act-94-of-1990-s11
  - Banks-Act-94-of-1990-s13
  - PR-631
  - PR-634
  - PR-636
  - PR-637
  - PR-639
  - PR-640
  - PR-642
  - PR-643
  - PR-644
  - PR-645
  - PR-647
  - PR-648
  - PR-651
---

# PROC-MK-PLG-01 — META-REHEARSAL for FX-spot internal test scope

> **Posture.** This is a **rehearsal**, not a production gate fire. The actual go-live gate has never been activated and cannot fire until the bank holds a SARB banking licence. The rehearsal walks the 11 conditions of PROC-MK-PLG-01 against the live substrate to give Marc (CEO) a honest, evidence-anchored read on what would stop a production fire today.
>
> The rehearsal emits `GoLiveGateActivated` and 11× `GoLiveConditionUpdated` envelopes against a **distinct rehearsal `gateId`** (`pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test`). It does **not** emit `GoLiveReadinessAssessed` or `GoLiveReadinessConfirmed` — those require both co-chair quorum sign-offs (Devon + Zara) AND CEO authority AND a real licence in hand.

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-21 |
| Activator (procedure owner) | Devon (Chief Operating Officer, governance) |
| Compliance co-chair | Zara (Chief Compliance Officer, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Scope | FX-spot **only** (Marc declined the FX-Forward extension in dispatch) |
| Test perimeter | Internal pre-licence test — synthetic activity, no real ZAR/USD movement, no SWIFT MT300 leaves the bank, no counterparty entered into anything |
| Procedure | PROC-MK-PLG-01 (`Procedures/markets/pre-licence-go-live-gate.md`) |
| Authority | Brief `brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21`; dispatched by Scrooge (Chief of Staff) recording for CEO |
| Rehearsal gateId | `pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test` |
| Runner script | `prototype/scripts/run-pre-licence-go-live-rehearsal.ts` (run via `bun run rehearsal:pre-licence-go-live`) |

## 2. The 11 conditions — assessment table

### 2.1 NPA product-readiness conditions (5)

| # | Condition ID | Status | Evidence | Compensating control | Re-activation trigger | Sign-off |
|---|---|---|---|---|---|---|
| 1 | `NPA-fx-spot-schema-defined` | **Open** | M4_FX_SPOT_FIXTURE present in `prototype/domains/markets/products/fx-spot.ts`; exercised end-to-end by scenario PR #645 | None — substantive gap | NPA procedure (PROC-MK-NPA-01) fires for FX-spot and emits `NewProductApproved{product:'fx-spot'}` | Zara |
| 2 | `NPA-fx-spot-pricing-model-validated` | **InProgress** | PR #643 (SARB fixing ingester emits `OfficialMarkAdopted{source:'SARB',policyVersionRef:'VALUATION-POLICY-V1:v1.0'}`); Helena's G-1 + G-2 compensating-control attestations §2.1 of PR #631 | G-1: SARB daily fixing + Helena daily IPV sign-off as production-grade FX-spot rate source. G-2: FRTB-SA unvalidated → conservative-RWA proxy via dual-track manual SA-SBM-delta cross-check (>5% triggers investigation; >15% triggers MRC escalation) | Real-time Bloomberg BFIX feed lands + Nadia (Independent-validation engineer, engineering) production-validation of FRTB-SA engine for FX-spot | Zara |
| 3 | `NPA-fx-spot-risk-limits-set` | **Open** | PR #634 — Helena (Chief Risk Officer, governance) controlled-launch MR-1-FX limit proposal (ZAR 350k VaR; USD 1m EOD / USD 1.5m intraday; USD 500k per-counterparty cap; USD/ZAR only); PR #642 — Yael (Treasurer & Tax, engineering+governance) credit-limit + netting-set enrolment | Credit-limit substrate is LIVE; market-risk limit is PROPOSED — no formal approval forum | BRC (Board Risk Committee) is constituted at licence-day AND tables MR-1-FX. Interim: Marc could approve the limit proposal explicitly as a CEO interim-authority anchor (separate decision card; out of scope for this rehearsal) | Devon + Zara |
| 4 | `NPA-fx-spot-conduct-obligations-mapped` | **Satisfied** | `Procedures/markets/pre-trade-conduct-gate.md` (PROC-MK-PCG-01); PR #633 no-prop attribution XOR on `FxTradeExecuted`; `Policies/insider-trading-policy-v1.md` | n/a | n/a — Satisfied | Zara |
| 5 | `NPA-fx-spot-front-to-back-confirmed` | **Satisfied** | PR #645 — `prototype/scenarios/fx-spot-internal-pre-licence-test.ts` returns READY-FOR-CONTROLLED-LAUNCH; PR #647 — Saskia (Head of Global Markets) + Kai (Markets engineering lead, engineering) CEO end-to-end FX-trade walkthrough | n/a | n/a — Satisfied | Devon |

### 2.2 OPS-readiness conditions (6)

| # | Condition ID | Status | Evidence | Compensating control | Re-activation trigger | Sign-off |
|---|---|---|---|---|---|---|
| 6 | `OPS-trading-system-operational` | **Satisfied** | Manual booking flow at `dashboard/public/trade-book.html`; scenario PR #645 exercises happy-path + failure-path booking | n/a | n/a — Satisfied (for internal-test scope; OMS/FIX/electronic-execution is a post-licence-day extension) | Devon |
| 7 | `OPS-settlement-connectivity` | **InProgress** | PR #640 — Tomas (Correspondent banking & payments, engineering) FX settlement subscriber (simulated-feed variant) | Simulated correspondent feed — events flow, posting rules fire, failure-path classification works | Real correspondent-bank account (e.g. Standard Bank ZA as USD correspondent) opened — the correspondent will not open a nostro for an unlicensed entity, so this is a wall-clock licence-day item | Devon |
| 8 | `OPS-regulatory-reporting-pipelines` | **InProgress** | PR #644 — Rashida (Chief Information Security Officer, governance) FinSurv ExCon assessment rules the build-phase scenario activity OUTSIDE Reg 2(1)/3(1) scope; BA-325 LCR subscriber wired via Kai scenario; BA-700/600/350 capability landed in PRs #436–#444 | FinSurv production wiring deferred (Rashida ruling — outside scope until commencement-of-trading); BA-325 is live and exercised | FinSurv production-pipeline wiring + Vera (internal audit engineer, governance) audit + real SARB filing rehearsals at commencement-of-trading | Devon |
| 9 | `OPS-mandate-counterparty-registries` | **Satisfied** | PR #639 — Saskia Party register entries for Standard Bank ZA + Investec Treasury; PR #642 — Yael credit limits + netting-set enrolment; PR #637 — Imani (Chief Legal Counsel, governance) G-9 ISDA 2002 + SA Schedule decision (Bowmans 2024-04-15 SA netting opinion) | n/a | n/a — Satisfied (residual `jurisdictionOpinionRef` content-addressing is a substrate hygiene item, not a blocker) | Zara |
| 10 | `OPS-conduct-gate-tested` | **InProgress** | PROC-MK-PCG-01 Check 1 (`checkHeadroom`) LIVE via credit-limit engine PR #614 + PR #618 wire; Checks 2–5 (dealer mandate, sanctions, capacity, best-execution) PLANNED per Saskia + Kai walkthrough §6 | Runtime emits `GatewayCheckCompleted` for Check 1; scenario operates against curated whitelist where the unwired checks are precondition-true by construction | All five PROC-MK-PCG-01 checks wired into runtime + `ConductGatePassed` envelope emitted + Vera `recon:conduct-gate-coverage` pipeline added | Devon + Zara |
| 11 | `OPS-bcp-tested` | **InProgress** | PR #636 — Devon PROC-OPS-SFBCP-01 v0.3 FX settlement-failure procedure; PR #640 — Tomas settlement subscriber failure-path events (`MissedExpectedReceipt`, `FxSettlementFailed`, `SettlementFailureClassified`); scenario PR #645 Phase 3 exercises Herstatt-active failure path | Settlement-failure BCP slice exercised end-to-end; broader BCP (system outage, regional failover, ransomware drill, key-person loss) untested | Broader BCP testing — system-outage drill, regional failover drill, ransomware drill (Rashida-owned), key-person-loss drill — all wall-clock pre-licence items | Devon |

### 2.3 Summary tally

| Status | Count | Conditions |
|---|---|---|
| Satisfied | 4 / 11 | NPA-fx-spot-conduct-obligations-mapped, NPA-fx-spot-front-to-back-confirmed, OPS-trading-system-operational, OPS-mandate-counterparty-registries |
| InProgress | 5 / 11 | NPA-fx-spot-pricing-model-validated, OPS-settlement-connectivity, OPS-regulatory-reporting-pipelines, OPS-conduct-gate-tested, OPS-bcp-tested |
| Open | 2 / 11 | NPA-fx-spot-schema-defined, NPA-fx-spot-risk-limits-set |

## 3. Regulatory approvals (5 items — NOT in 11 conditions; tracked separately)

PROC-MK-PLG-01 Step 4 enumerates the regulatory approvals. None can be self-certified; all are wall-clock items, none can be emitted as `RegulatoryApprovalReceived` in this rehearsal (no authority on this machine to fabricate them).

| Approval | Authority | Status | Notes |
|---|---|---|---|
| Banks Act s.13 banking licence | SARB Prudential Authority | NotHeld | No application submitted yet. Banks Act s.11 prohibits banking business without licence; commencement-of-trading is blocked until granted. Licence application is a Saskia + Devon + Owen co-tracked workstream. |
| FAIS Act s.7 FSP licence | FSCA | NotHeld | Required before any FX-spot transaction with or for clients. Typically follows SARB banking-licence grant. |
| POPIA Information Officer registration | Information Regulator | NotHeld | IO must be registered before personal-information processing commences (POPIA s.55 + registration regulations). No IO appointed yet — appointment is a licence-day statutory-minimum hire. |
| External auditor engagement letter | External auditor (TBD) | NotHeld | Banks Act s.61. Engagement letter must be in place before licence-day. Audit Committee constitution upstream — currently substituted by Owen's Interim Audit Forum. |
| Key Individuals (FAIS) + fit-and-proper directors | FSCA + PA | NotHeld | FAIS s.8 fit-and-proper KIs (MLRO/FIC Compliance Officer; FAIS KI per category) require FSCA approval before commencement; PA fit-and-proper for directors required pre-licence-grant. Per `project_ai_driven_bank` the minimum-statutory humans (5–10) are appointed at licence-day. |

## 4. Identified blockers — what would stop a production gate fire

A production fire of PROC-MK-PLG-01 (emit `GoLiveReadinessConfirmed` against the real, non-rehearsal `gateId`) is blocked by THREE distinct kinds of item:

### 4.1 Two substantive Open conditions

1. **`NPA-fx-spot-schema-defined`** — the NPA procedure (PROC-MK-NPA-01) has never been activated for any product. No `NewProductApproved{product:'fx-spot'}` event in the store. **Dispatchable now**; not regulator-blocked.
2. **`NPA-fx-spot-risk-limits-set`** — Helena's MR-1-FX proposal (PR #634) is not BRC-tabled because BRC does not exist. **Wall-clock** for full satisfaction (Board constitution at licence-day); CEO interim-authority approval is a possible bridge but requires a separate decision card.

### 4.2 Five compensating-control-only InProgress conditions

These would NOT block an internal test (the scenario operates inside the assessment scope by construction), but they DO block a production fire:

1. **`NPA-fx-spot-pricing-model-validated`** — needs real-time Bloomberg BFIX feed + Nadia validation of FRTB-SA engine. G-1 + G-2 are internal-test bridges only.
2. **`OPS-settlement-connectivity`** — needs real correspondent-bank nostro account (wall-clock — correspondent won't open for unlicensed entity).
3. **`OPS-regulatory-reporting-pipelines`** — needs FinSurv production wiring + Vera audit + real SARB filing rehearsal at commencement.
4. **`OPS-conduct-gate-tested`** — needs all five PROC-MK-PCG-01 checks wired + `ConductGatePassed` envelope emitted + Vera recon pipeline.
5. **`OPS-bcp-tested`** — needs broader BCP testing (system-outage, regional failover, ransomware drill, key-person-loss).

### 4.3 Five regulatory wall-clock items (§3 above)

None can be self-certified; all require external regulators or contracted external parties to take action. These are the binding constraint on go-live timing.

## 5. Identified substrate gaps — engineering items the rehearsal surfaced

Five engineering gaps surfaced or were confirmed by this rehearsal. These are **NOT regulatory** — they are substrate items the engineers can act on without regulator dependency.

| # | Substrate gap | Owner | Notes |
|---|---|---|---|
| 1 | The four GoLive event types (`GoLiveGateActivated`, `GoLiveConditionUpdated`, `GoLiveReadinessAssessed`, `GoLiveReadinessConfirmed`) are NOT codified in `platform/event-store/event-types/` or `platform/event-store/registry.ts` — the rehearsal emits raw envelopes. The registry is fail-open for unknown types in the build phase (per `registry.ts` header), so envelopes append cleanly, but the typed factory + Zod schema + registry row chain is missing. | Atlas (Core banking platform architect, engineering) | One-slice job: author Zod payload schemas, `make<Type>` factories, registry rows for all four types. Surface raised by this rehearsal. |
| 2 | NPA procedure (PROC-MK-NPA-01) has never been activated for any product — there is no `NewProductApproved` event in the store for FX-spot or anything else. PROC-MK-PLG-01 Condition 1 cannot become Satisfied until NPA fires. | Saskia (Head of Global Markets) + Zara (Chief Compliance Officer, governance) | NPA is dispatchable now; it is a build-phase-no-regulator-needed gate. |
| 3 | The conduct-gate envelope (`ConductGatePassed` / `ConductGateBlocked`) wrapping the five PROC-MK-PCG-01 checks is PLANNED. Only Check 1 (`checkHeadroom`) is wired; Checks 2–5 (dealer mandate, sanctions ≤24h, counterparty capacity, best-execution) are not enforced at trade-initiation time. | Atlas + Kai (Markets engineering lead, engineering) | Multi-slice substrate piece. Should be sequenced ahead of the NPA fire for FX-spot. |
| 4 | The `recon:no-prop-attribution` pipeline (MR-5 daily sweep against the FxTradeExecuted XOR invariant) is PLANNED — explicitly listed in scenario PR #645's `substrateGaps` summary. Without it the no-prop discipline is enforced at emit-time only, with no post-hoc drift detection. | Vera (internal audit engineer, governance) | Wave-4 pipeline; queued. |
| 5 | The `jurisdictionOpinionRef` field on `ISDACSAAssessmentCompleted` carries a string identifier rather than a content-addressed RMS document reference. Imani's G-9 §5 gap 3. The Bowmans 2024-04-15 SA netting opinion is held on file but not in the RMS document store. | Imani (Chief Legal Counsel, governance) + Atlas | Substrate hygiene; not a blocker on Condition 9. |

## 6. Recommendation to CEO

Marc, my honest assessment as procedure owner is:

**The actual go-live gate cannot fire today.** Not by a stretch. Eight of the eleven conditions are either Open (2) or InProgress with a compensating control acceptable only for internal-test scope (5 — see §4.2; the InProgress condition under OPS-mandate-counterparty-registries is in fact Satisfied; total InProgress is 5 of which all are production-blockers). Plus all five regulatory approvals are wall-clock NotHeld.

What this rehearsal **does** confirm — and this is the substantive finding for you — is that the **internal-test perimeter is two substantive items away from a clean fire**:

1. Dispatch the NPA procedure for FX-spot (Saskia + Zara). This is build-phase-no-regulator-needed work. It emits `NewProductApproved{product:'fx-spot'}` and Condition 1 flips to Satisfied.
2. Decide how to handle the BRC-tabling gap for the MR-1-FX limit proposal. Options:
   - **(a)** CEO interim-authority approval of Helena's PR #634 proposal as a bridge (separate decision card).
   - **(b)** Stand the limit up against a future BRC tabling and accept that Condition 3 stays Open until then.
   - **(c)** Both — interim CEO approval now, deferred BRC ratification at constitution.

If you take options (1) and (2), the rehearsal would re-run with **0 Open, 6 InProgress (compensating-control-acceptable), 5 Satisfied** — i.e. **READY-FOR-INTERNAL-TEST**.

That's the read.

**Timeline shape to PRODUCTION fire-readiness** is governed by the wall-clock items, not the engineering items. The slowest of: (a) SARB banking-licence grant — typically 18–24 months from application; (b) FSCA FSP licence; (c) real correspondent-bank account opening; (d) statutory-human appointments (KIs, IO, auditor, directors). The engineering substrate will be ready well ahead of those; the wall-clock dominates.

**Substrate gap I would highlight specifically.** Item 1 in §5 — the four GoLive event types are not codified. This rehearsal succeeded by emitting raw envelopes through the build-phase fail-open registry. Before a production fire, Atlas needs to author the Zod schemas + factories + registry rows + handler subscriptions. One-slice job; should be queued.

This rehearsal does **NOT** emit `GoLiveReadinessAssessed` or `GoLiveReadinessConfirmed`. Those are reserved for the real fire. The rehearsal envelopes carry a distinct `gateId` so the production gate-id remains unfired.

— Devon (Chief Operating Officer, governance)
— concurred Zara (Chief Compliance Officer, governance) on compliance-dimension conditions (Condition 1 NPA-schema, Condition 2 pricing-model, Condition 4 conduct-mapping, Condition 9 registries, joint with Devon on Conditions 3 + 10)

## 7. Citations

- Procedure: PROC-MK-PLG-01 (`Procedures/markets/pre-licence-go-live-gate.md`)
- Source policy: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
- Statutes: Banks Act 94 of 1990 s.11 (licence-required), s.13 (licence-grant conditions); FAIS Act 37 of 2002 s.7 (FSP licence); POPIA s.55 (IO registration); Banks Act s.61 (auditor)
- PRs queried for substrate state:
  - PR #631 — Helena FX-spot-only market-risk scope review
  - PR #633 — Atlas no-prop attribution XOR
  - PR #634 — Helena controlled-launch MR-1-FX limit proposal
  - PR #635 — Rohan SA-CCR T+2 maturity-factor regression test
  - PR #636 — Devon PROC-OPS-SFBCP-01 v0.3
  - PR #637 — Imani ISDA 2002 + SA Schedule decision (Bowmans opinion)
  - PR #638 — Atlas schema completeness pack
  - PR #639 — Saskia Party register entries
  - PR #640 — Tomas FX settlement subscriber (simulated-feed variant)
  - PR #641 — Bea PR-FX-005 IFRS-9 default-recognition posting rule
  - PR #642 — Yael credit limits + netting-set enrolment
  - PR #643 — Atlas SARB fixing ingester (G-1 compensating control)
  - PR #644 — Rashida FinSurv ExCon assessment
  - PR #645 — Kai end-to-end FX-spot scenario (READY-FOR-CONTROLLED-LAUNCH)
  - PR #647 — Saskia + Kai CEO end-to-end FX-trade walkthrough
  - PR #648 — Vera persona-attribution-coherence recon (STRICT)
  - PR #651 — Owen CISO label drift sweep
- Memory: `project_ai_driven_bank`, `project_product_lifecycle_npa_vs_engineering`, `project_payments_correspondent_model`, `project_indirect_participant_posture`
- Brief: `brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21`
