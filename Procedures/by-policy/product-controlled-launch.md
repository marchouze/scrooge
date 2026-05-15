---
procedureId: PROC-MK-NPA-CL-01
title: Product Controlled Launch
author: Saskia (Head of Global Markets, governance)
date: 2026-05-15
owner: Saskia (Head of Global Markets, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md
system-capability: "@platform/markets/product-register (PLANNED)"
---

# Procedure — Product Controlled Launch

**Procedure ID:** PROC-MK-NPA-CL-01
**Owner:** Saskia (Head of Global Markets, governance)
**Co-actors:** Devon (COO, governance) · Helena (CRO, governance) · Camille (CFO, governance) · Tomas (Operations & payments engineer) · Anya (platform engineer) · BRC chair (escalation point)
**Approval:** BRC primary; CEO ratification (interim, until BRC constituted)
**Cadence:** Per-product; fires on `ProductApproved` (stage 5 of the 8-stage NPA lifecycle); runs continuously through the controlled-launch window; closes on PIR
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` § 4 (lifecycle stage 5) and § 7 (controlled-launch limits).
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md`.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| BCBS Sound Practices for the Management of Operational Risk (rev. 2021) §27 | Controlled-launch envelope as part of new-product-approval discipline. | Limits set per parent policy §7; daily monitoring report. |
| FSCA Conduct Standard 3 of 2018 §§3–9 | Pre-trade dimensional coverage carried through to first transactions. | Dimensions re-checked at PIR; conduct breaches escalate immediately. |
| `ORG-CS3-001..009`, `ORG-MK-01..08`, `ORG-PR-02..19` | Markets / prudential / conduct obligations during controlled launch. | Limits sized to fraction of steady-state envelope; breaches halt new transactions. |
| Banks Act 94 of 1990 + Reg 39 | Operational risk during product introduction. | Daily monitoring report + breach escalation. |

## 3. Purpose

Operationalise stage 5 of the New Product Approval lifecycle — the controlled-launch window during which first trades occur under named, restrictive limits. The procedure administers the limit envelope, produces daily monitoring reports, escalates breaches, and gates the transition to steady-state operation through the post-implementation review (PIR).

The procedure does not author the limits themselves (BRC sets them at stage 4 approval); it administers them. Default shape and parameters are in policy §7.

## 4. Trigger

- A `ProductApproved` event arrives on the Product Register stream with a populated `controlledLaunchLimits` payload.
- Saskia confirms operational readiness with Devon (substrate green; settlement path live or simulator in build phase) and emits `ProductControlledLaunchStarted { productId, launchDate, controlledLaunchLimits, monitoringRecipients, asOf }`.
- Daily 06:00 UTC scheduler fires the daily monitoring report for every product whose status is `controlled-launch`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Confirm operational readiness pre-launch. Saskia checks with Devon (process-readiness) and Tomas (settlement path live or simulator-equivalent) before emitting the start event. | Saskia · Devon · Tomas | `@platform/markets/product-register` (PLANNED) | Per policy §4 stage 5 transition. |
| 2 | Emit `ProductControlledLaunchStarted`. The substrate registers the active limit envelope and the monitoring-recipient list. | Saskia | `@platform/markets/product-register` (PLANNED) | Recipients per policy §7 default: BRC chair, CEO, Helena, Camille, Saskia, Devon. |
| 3 | First trades execute. Each trade is checked pre-deal against the active limits (volume cap, single-trade cap, counterparty-count cap, risk envelope). Breach attempts are blocked at the OMS gate. | Kai · OMS | `@platform/markets/oms-pre-deal-gate` (PLANNED) | Pre-deal block is the first line of defence; daily report is the second. |
| 4 | Daily monitoring report. At 06:00 UTC, the substrate generates the report from the Product Register projection: day-1 flow, cap-utilisation, incidents, conditions-tracking deltas. Distributed to monitoring recipients. | system | `@platform/markets/controlled-launch-report` (PLANNED) | Generated as a query (Principle 1); never hand-assembled. |
| 5 | Breach handling. On any `ProductControlledLaunchBreach { productId, capName, observedValue, capValue, asOf }`, escalation event fires to BRC chair within the same trading day. Two breaches within the controlled-launch window halt new transactions in the product pending BRC review (`ProductControlledLaunchHalt`). | system + Saskia · BRC chair | `@platform/markets/controlled-launch-monitor` (PLANNED) | Per policy §7 — breach-trigger escalation. |
| 6 | Limit amendment (if BRC approves). Amendments to limits during the window emit `ProductControlledLaunchAmended { productId, amendedLimits, authority, asOf }`. | BRC + Saskia | `@platform/markets/product-register` (PLANNED) | Recorded with `authority` payload (BRC / CEO-interim). |
| 7 | Conditions-tracking. Conditions BRC attached at approval are tracked daily; closures, deferrals, and breaches each emit typed events on the conditions ledger. | Devon · Saskia | `@platform/markets/conditions-ledger` (PLANNED) | Each condition has an owner, deadline, and closure event. |
| 8 | Approach the PIR. At controlled-launch period end (default 90 days, BRC-extendable), Saskia + Devon convene the PIR per [`product-post-implementation-review.md`](product-post-implementation-review.md). The window does not close without a tabled PIR. | Saskia · Devon | (delegated to PIR procedure) | Mandatory per policy §7. |
| 9 | Close the window. On PIR verdict `continue` or `continue-with-amended-conditions`, emit `ProductControlledLaunchCompleted { productId, pirVerdict, finalLimits, asOf }` and transition the product to stage 7 (steady-state). On `retire`, route to [`product-retirement-migration.md`](product-retirement-migration.md). | Saskia | `@platform/markets/product-register` (PLANNED) | Closes the controlled-launch event series. |

## 6. Reconciliation

- **Events produced:** `ProductControlledLaunchStarted`, daily-report stream events (per-day projection emit), `ProductControlledLaunchBreach` (per breach), `ProductControlledLaunchHalt` (on second breach in window), `ProductControlledLaunchAmended` (per BRC amendment), `ProductControlledLaunchCompleted` (on PIR `continue` outcome).
- **Reconciliation check:** for every `ProductApproved` whose `controlledLaunchLimits` is populated, the substrate observes exactly one `ProductControlledLaunchStarted` followed by either `ProductControlledLaunchCompleted` (with PIR verdict) or `ProductRetired` (PIR `retire` outcome). Daily monitoring reports are emitted for every trading day in the window. Breach events match observed cap-utilisation in the projection.
- **Failure mode:** missing daily report, missing PIR at window end, or trades booked while a halt event is active are all findings escalating to BRC chair within the same trading day.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ProductControlledLaunchStarted` / `ProductControlledLaunchCompleted` | Event log (P1) | Indefinite | Internal |
| Daily monitoring report | Generated query over Product Register projection; archived as Owner Inbox `YYYY-MM-DD_saskia_controlled-launch-report_<productId>.md` | ≥ 5 years (Conduct Standard 3/2018 §12) | Internal |
| `ProductControlledLaunchBreach`, `ProductControlledLaunchHalt`, `ProductControlledLaunchAmended` | Event log | Indefinite | Internal |
| Conditions-tracking deltas | `@platform/markets/conditions-ledger` (PLANNED) | Indefinite | Internal |

## 8. Manual steps

- BRC chair's same-day acknowledgement of a breach escalation is human discretion captured as `AgentDecision` (or BRC-minute event once the substrate lands).
- BRC limit-amendment vote (Step 6) is a governance decision recorded with `authority: BRC` (or `authority: CEO-interim` until BRC constituted).
- Build-phase: until the OMS pre-deal gate (`@platform/markets/oms-pre-deal-gate`) lands, limit enforcement is operated by Kai's pre-deal review; this is a substrate gap tracked as a roadmap item.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| First breach of any cap | Step 5 monitor | BRC chair within same trading day; `ProductControlledLaunchBreach` event fires |
| Second breach within the window | Step 5 monitor | New transactions halted via `ProductControlledLaunchHalt`; BRC reviews before resuming |
| Missing daily report | Step 4 schedule check | Devon + Saskia same trading day |
| PIR not convened by window end | Step 8 timer | Saskia + Devon — escalation to BRC chair; product cannot exit controlled launch without tabled PIR |
| Trade booked while halt active | OMS pre-deal gate (Step 3) | Severity-1 operational incident — Senna + Devon + Saskia |
| Build-phase substrate gap blocks pre-deal enforcement | Step 3 | Atlas — gap captured as roadmap item; CEO may approve interim manual gate |

## 10. Related procedures

- [`new-product-due-diligence.md`](new-product-due-diligence.md) — stage 3; closes upstream of `ProductApproved`.
- [`npa-gate.md`](npa-gate.md) — stage 4; produces `ProductApproved` that triggers this procedure.
- [`product-post-implementation-review.md`](product-post-implementation-review.md) — stage 6; mandatory closure gate for controlled launch.
- [`product-retirement-migration.md`](product-retirement-migration.md) — stage 8; route on PIR `retire`.
- [`change-management.md`](change-management.md) — limit-amendment changes route through Devon + Atlas + Senna.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-10 | Owen (via Scrooge) | Initial draft authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval. STUB — substrate components PLANNED; binds at first `ProductApproved`. |
| v1.0 | 2026-05-15 | Saskia (via Scrooge) | Promoted to POPULATED. Added standard 12-section frontmatter and reconciliation; all substantive content carried forward from v0.1. |

## 12. Audit / assurance

- Vera consumes the controlled-launch event series as continuous-controls evidence. Findings: missing daily reports, breach events not matched by escalation events, halt events with subsequent in-flight trades, PIR-absent window closure.
- Reportable to Owen + Saskia; structural findings flow to Atlas + Devon.
- Conduct Standard 3/2018 §12 record-keeping: daily monitoring reports retained ≥ 5 years.
- Annual review of this procedure by Saskia and Devon against the NPA policy; any change to policy §7 triggers a procedural update through Owen.
