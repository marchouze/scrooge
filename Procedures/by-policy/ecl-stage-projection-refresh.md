---
status: POPULATED
---
# Procedure — ECL stage projection refresh

**Procedure ID:** PROC-RSK-EC-01
**Owner:** Rohan (model design + run) · Bea (accounting consumption — `IFRSClassificationAssigned` downstream)
**Approval:** BRC + AC (under Provisioning / IFRS 9 ECL Policy v0.1 — STUB)
**Cadence:** Continuous on incremental position events; full daily refresh at 06:00 UTC (per Rohan spec §6)
**Version:** v0.1 — 2026-05-07
**Status:** **In force (build-phase scope)** — runs against synthetic positions today; lights up on real positions at licence-day; outputs are not consumed by Bea until `MOD-ECL-001` validation is in-use

## 1. Source policy

- `Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md` § Provisioning / IFRS 9 ECL Policy v0.1 §2 (Three-stage staging discipline); §3 (SICR trigger); §4 (Forward-looking overlays).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` § Credit-risk appetite — ECL coverage and stage-transition tolerances (RAS, in-force).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-AC-02` | Recognise ECL per three-stage model. | Model `MOD-ECL-001` outputs `ifrs9_stage`, `12m_ecl`, `lifetime_ecl`. |
| `ORG-AC-04` | IFRS 7 disclosures. | Disclosure paragraphs generated from staged-position projection. |
| `ORG-PR-21` | Three-tier model-risk classification. | `MOD-ECL-001` is Tier 1 — validation gate. |
| `IFRS 9 §5.5` (direct standard) | Impairment model. | Methodology spec in `_model-registry.md`. |
| `BCBS D350` (BCBS publication) | Supervisory ECL guidance. | Methodology alignment. |

## 3. Purpose

Maintain the staged-position projection as a continuous query over the event log: every position event triggers an incremental staging recompute; the daily 06:00 UTC scheduled run is a full re-projection that catches drift. The staging projection is the input to Bea's accounting application of ECL (`IFRSClassificationAssigned`, `JournalEntryPosted` for stage-transition impairment), to Camille's capital projection, and to Helena's RAS monitoring.

In the build phase the procedure runs against synthetic positions; outputs are *not* consumed by Bea (Tier 1 model not yet validated). At licence-day, after independent validation, outputs feed Bea's posting rules per the keystone procedure `PROC-FIN-AC-01`.

## 4. Trigger

- **Incremental:** any of `TradeBooked`, `PositionAdjusted`, `CollateralUpdated`, `RatingUpdated`, `WatchlistFlagSet`, `ForbearanceFlagSet`, `30DaysPastDue` events. SLA: stage recompute within 5 minutes of event landing (per Rohan spec §6).
- **Scheduled full refresh:** daily 06:00 UTC; runs the full re-projection, catches drift, emits `RiskRunCompleted`.
- **Methodology change:** `ModelVersionPublished` for `MOD-ECL-001` triggers a full re-stage of every position under the new methodology, with side-by-side comparison against the prior version (model-monitoring obligation).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Resolve the model in-use version. Require `MOD-ECL-001` `status: in-use`; if `draft` (today), proceed but mark outputs as `non-binding` (Bea consumes only `in-use` outputs). | Rohan | `@platform/risk/model-registry` (today: markdown lookup) | Validation gate per RAS B7. |
| 2 | Read incremental events since last checkpoint. | system | `@platform/event-store` | Append-only event log; checkpoint is the projection's high-water mark. |
| 3 | For each position affected, re-evaluate the staging criteria: SICR test (PD-change + qualitative flags); credit-impairment test (default events). Output: `ifrs9_stage`. | Rohan / model | `@platform/risk/ecl-engine` (PLANNED — today: Scrooge-coordinated dry-run) | Staging is deterministic given inputs and methodology version. |
| 4 | If stage transitions, emit `StageTransition { positionId, fromStage, toStage, asOf, modelVersion }`. | system | `@platform/event-store` | Stage transitions are auditable events; Bea's posting rule `PR-ECL-*` (planned) consumes. |
| 5 | Compute 12-month and lifetime ECL using the model's PD / LGD / EAD modules. | Rohan / model | `@platform/risk/ecl-engine` | Methodology per RAS B7 + Provisioning Policy v0.1 §2. |
| 6 | Apply forward-looking macroeconomic overlay per scenario weights (Rohan-published; quarterly review). | Rohan / model | `@platform/risk/scenario-library` (PLANNED) | Overlay magnitudes are typed correlation fields on the stage event. |
| 7 | Refresh the staged-position projection (`@platform/projections/ecl-stage`). | system | `@platform/projections` (Anya — substrate) | Projection is a cache; re-derivable from events. |
| 8 | Emit `RiskRunCompleted { run, asOf, modelVersion, exceptions, citationChain }` at the end of the daily full refresh. | Rohan | `@platform/event-store` | Per Rohan spec §6, must complete by 08:00 UTC. |
| 9 | If `MOD-ECL-001` is `in-use` and a stage transition occurred, hand off to Bea via the `StageTransition` event — Bea's `PR-ECL-*` posting rule (planned) emits `IFRSClassificationAssigned` and `JournalEntryPosted` for the impairment movement. | system | `@platform/event-store` (event subscription) | The cross-domain handoff is enforced by event subscription, not by direct call. |

## 6. Reconciliation

- **Events produced:** `RiskRunCompleted`, `StageTransition` (per transition), optionally `LimitUtilisationCheckpoint` if the staged ECL impacts a credit-limit metric.
- **Reconciliation check:** at every full daily refresh, sum-of-(per-position lifetime ECL) reconciles to the `_ecl_total` projection cell within materiality tolerance. The projection is fully replayable from the event log per Principle 1 — replay-divergence is itself a finding.
- **Cross-domain check:** every `StageTransition` for an `in-use` model version produces a downstream `IFRSClassificationAssigned` from Bea within the same business day; orphan transitions are findings (Vera Wave-3 risk-cycle pipeline).
- **Failure mode:** a model that fails the validation gate (Step 1) does not propagate to Bea; the projection still updates but is flagged `non-binding` until validation lands.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `RiskRunCompleted` event | Event log | Indefinite (P1) | Internal |
| `StageTransition` event | Event log | Indefinite | Counterparty-confidential |
| Staged-position projection | `@platform/projections/ecl-stage` (cache) | Re-derivable | Internal |
| Model-version evidence | Model-registry entry + `ModelVersionPublished` event | Indefinite | Internal |

## 8. Manual steps

- **Step 1 (model-in-use check)** is hand-validated today against the registry markdown; substrate-grade gate runs at M2 with the registry substrate.
- **Step 6 (overlay application)** runs against the prototyped scenario library; the runtime overlay engine is Rohan Substrate Gap §5 (stress-test engine, target pre-licence).
- **Step 9 (cross-domain handoff)** runs through Scrooge today; lands on Atlas's A2 (event-trigger bus) when the runtime substrate is live.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Model not validated but stage transitions affect Bea posting | Step 1 gate | Helena — model-validation finding; pre-next-use; Rohan spec §10 |
| Replay divergence beyond materiality | Step 6 reconciliation check | Rohan — investigate; if methodology defect, supersede model version |
| Material P&L impact from methodology change | Step 6 model-monitoring | Helena + Camille; pre-adoption gate per Rohan spec §10 |
| Approaching capital-ratio breach via ECL surge | Limit-utilisation projection | Helena + Camille → CEO; same business day per Rohan spec §10 |
| New SICR trigger required (e.g., new product) | RiskRaised event | Helena → Owen (governance route) per Rohan spec §10 |

## 10. Related procedures

- `Procedures/by-policy/posting-rule-publication.md` — **populated (Bea-owned)** — Bea's keystone, consumes `StageTransition` events to fire `PR-ECL-*` rules (planned).
- `Procedures/by-policy/ifrs9-ecl-methodology.md` — **planned (Bea + Rohan co-owned)** — model-version cycle; supersedes models that drive this procedure.
- `Procedures/by-policy/daily-risk-run.md` — **planned (Rohan-owned)** — the daily aggregate run; this procedure is one of its inputs.
- `Procedures/by-policy/model-risk-cycle.md` — **planned (Rohan-owned)** — independent validation cycle; gates the in-use status referenced in Step 1.
- `Procedures/by-policy/capital-ratio-monitoring.md` — **populated (Camille + Rohan co-owned)** — consumes the lifetime ECL roll-up for capital projections.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Rohan (via Scrooge) | Initial draft as keystone of Rohan's first end-to-end Reg→Policy→Procedure→Capability chain demonstration. |

## 12. Audit / assurance

Vera's planned Wave-3 risk-cycle pipeline asserts: (a) every `StageTransition` for an `in-use` model produces a Bea `IFRSClassificationAssigned` within the same business day; (b) replay yields the same staging result for the same as-of date and model version; (c) the staged-position projection reconciles to the event-log fold; (d) the model-validation gate is honoured. Findings flow to Rohan and (where accounting-impacting) Bea + Helena.
