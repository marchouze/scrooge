---
policy-parent: Provisioning / IFRS 9 ECL Policy (planned, under Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md)
last-reviewed: 2026-05-15
procedureId: PROC-RSK-ECL-02
title: ECL (IFRS 9) staging cycle
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-15
owner: Helena (Chief Risk Officer, governance) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
policy-cited: Provisioning / IFRS 9 ECL Policy (planned, under Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md)
system-capability: prototype/platform/projections/ecl-staging (PLANNED)
---

# Procedure — ECL (IFRS 9) staging cycle

**Procedure ID:** PROC-RSK-ECL-02
**Owner:** Helena (Chief Risk Officer, governance) · Bea (Accounting & financial reporting engineer, engineering)
**Approval:** BRC + Audit Committee
**Cadence:** Continuous (incremental on position events); full daily refresh at 06:00 UTC; quarterly qualitative overlay review; annual model-validation reconfirmation
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

- `Provisioning / IFRS 9 ECL Policy v0.1` (planned — under `Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md` §Provisioning / IFRS 9 ECL Policy) — primary source; defines the three-stage staging discipline, SICR triggers, forward-looking overlays, and lifetime vs 12-month ECL switching rules.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` § Credit-risk appetite — ECL coverage and stage-transition tolerances.
- `Policies/capital-management-policy-v1.md` — capital adequacy treatment of ECL provisions per PA Directive D3/2023 (`ORG-PR-44`).

Obligation chain:

```
IFRS 9 § 5.5 (impairment model)
  → Provisioning / IFRS 9 ECL Policy v0.1
    → PROC-RSK-ECL-02 (this procedure)
      → @platform/projections/ecl-staging (PLANNED)
```

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-AC-02` | Recognise expected credit losses per the IFRS 9 three-stage model. |
| `ORG-AC-04` | IFRS 7 risk disclosures — quantitative + qualitative disclosures on credit-risk exposure and ECL movement. |
| `ORG-PR-21` | Three-tier model-risk classification; the ECL model (`MOD-ECL-001`) is Tier 1 — requires independent validation before live use. |
| `ORG-PR-44` | Apply PA Directive D3/2023 regulatory treatment of accounting provisions: Stage-1, Stage-2, Stage-3 ECL allocation to CET1 / Tier 2 / specific-vs-general reserve buckets, with applicable transition arrangements. |
| IFRS 9 §5.5 (direct standard) | Three-stage ECL impairment model — recognition of 12-month ECL (Stage 1), lifetime ECL for SICR (Stage 2), lifetime ECL for credit-impaired (Stage 3). |
| BCBS D350 (supervisory guidance) | Supervisory guidance on sound credit-risk practices and accounting for expected credit losses; alignment required for PA supervisory review. |

---

## 3. Purpose

Produce and maintain, on a continuous and daily-refreshed basis, the staged-exposure projection for every financial asset held at amortised cost or FVOCI that is in-scope for IFRS 9 impairment. The procedure:

1. Classifies each position into Stage 1 (performing), Stage 2 (SICR), or Stage 3 (credit-impaired) based on objective SICR triggers and qualitative overlays approved by Helena (CRO, governance).
2. Computes 12-month ECL (Stage 1) or lifetime ECL (Stages 2 and 3) for each position, drawing on the validated ECL model (`MOD-ECL-001`) and IFRS-compliant forward-looking macro assumptions.
3. Feeds the resulting ECL figures to Bea (Accounting & financial reporting engineer, engineering) for journal entry posting (`JournalEntryPosted`) and to Camille (CFO, governance) for capital-ratio monitoring and BA return preparation.
4. Maintains the evidence chain — a fully auditable log of stage assignments, SICR triggers, model inputs, and overlay decisions — required by IFRS 7 disclosures and PA supervisory inspection.

In the build phase, the procedure runs against synthetic positions. It activates on real positions at licence-day, after `MOD-ECL-001` completes independent validation (`ORG-PR-21`).

---

## 4. Trigger

- **Continuous trigger:** Any position-level event that changes the credit profile of a financial instrument — `PositionOpened`, `CreditRatingDowngrade`, `PaymentMissed`, `CureEventDetected`, `CreditImpairmentRecognised` — causes an incremental staging recompute for the affected instrument.
- **Daily scheduled trigger:** Full projection refresh at 06:00 UTC each banking day; catches any macro-assumption updates, forward-looking overlay changes, and events processed overnight.
- **Quarterly trigger:** Helena (CRO, governance) + Rohan (Risk engineer) qualitative overlay review; any approved changes to forward-looking macro assumptions or overlay weightings take effect from the next daily run.
- **Annual trigger:** `MOD-ECL-001` annual revalidation event (`ModelValidationCompleted`); if the model is recalibrated, the full staging projection is re-run with the new parameters and results reviewed by Helena and Bea before the next reporting period close.
- **Period-end trigger:** `MonthEndCloseCompleted` event causes a snapshot of the staging projection to be pinned as the official period-end ECL position, fed to Bea for month-end journal entries.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On any in-scope position event (or 06:00 UTC daily schedule), the staging engine ingests the current instrument record from the position projection, extracting origination date, current credit rating, days past due (DPD), last payment date, contractual cash flows, and lifetime-expected PD / LGD / EAD parameters from `MOD-ECL-001` | `system` | `@platform/projections/ecl-staging` (`PLANNED`) | Instruments in scope: financial assets held at amortised cost (loans, bonds); FVOCI debt instruments. FVTPL instruments are out of scope per IFRS 9. |
| 2 | Apply SICR assessment: compare current risk to risk at origination using the hierarchy — (a) DPD > 30 days (rebuttable presumption; bank does not rebut unless evidence of administrative delay per IFRS 9 B5.5.19), (b) credit-rating downgrade beyond internal threshold, (c) watch-list placement, (d) covenant breach, (e) forward-looking macro overlay. Any trigger → Stage 2 unless already Stage 3 | `system` | `@platform/projections/ecl-staging` (`PLANNED`) | SICR thresholds are versioned parameters governed by Helena under the quarterly overlay review (Step 11). |
| 3 | Apply Stage 3 assessment: DPD > 90 days, formal restructuring, bankruptcy filing of counterparty, or specific evidence of credit impairment (IFRS 9 Appendix A — credit-impaired definition). Stage 3 overrides Stage 2 | `system` | `@platform/projections/ecl-staging` (`PLANNED`) | Stage 3 assignments are reported to Helena immediately via `CreditImpairmentRecognised` event. |
| 4 | Compute ECL: Stage 1 → 12-month PD × LGD × EAD (discounted at EIR); Stage 2 / Stage 3 → lifetime PD × LGD × EAD (discounted at EIR per IFRS 9 §B5.5.44). Apply probability-weighted forward-looking scenario (base + upside + downside, with Helena-approved weights from the quarterly overlay review) | `system` | `@platform/projections/ecl-staging` (`PLANNED`) + `MOD-ECL-001` | PD/LGD/EAD parameters sourced from `MOD-ECL-001` (Tier 1; validated before live use). Forward-looking scenarios sourced from the macro-assumption register (Helena + Rohan). |
| 5 | Emit `ECLStagingComputed { instrument_id, as_of_date, stage, ecl_12m, ecl_lifetime, pd, lgd, ead, scenario_weights, model_version }` for each in-scope instrument | `system` | `@platform/event-store` ✓ | Event is the canonical staging record. No ECL figure exists outside this event. |
| 6 | Stage-transition logic: if stage has changed from previous period, emit `ECLStageTransitioned { instrument_id, prior_stage, new_stage, trigger, as_of_date }` | `system` | `@platform/event-store` ✓ | Stage transitions are a key disclosure item for IFRS 7; the event provides the audit trail. |
| 7 | Aggregate ECL by product class, sector, and geographic cluster; feed the aggregated provision matrix to Bea's posting-rule engine | `system` | `@platform/accounting/ecl-provision-posting` (`PLANNED`) | Bea's posting-rule engine converts the ECL projection into `JournalEntryPosted` events (debit: impairment charge P&L; credit: provision balance sheet) at period-end. |
| 8 | At `MonthEndCloseCompleted`: pin the period-end staging snapshot as the official ECL position; emit `ECLPeriodEndSnapshot { period, total_ecl_stage1, total_ecl_stage2, total_ecl_stage3, snapshot_uri }` | `system` | `@platform/event-store` ✓ + `@platform/document-store` ✓ | `snapshot_uri` is a BLAKE3-addressed artefact; immutable once emitted. This event feeds Bea's BA return input and Camille's capital-ratio projection. |
| 9 | Helena (CRO, governance) reviews the period-end ECL snapshot against the RAS credit-risk appetite limits (ECL coverage ratio, stage distribution thresholds); signs off with `ECLPeriodEndApproved { period, signatory: helena, approved_at }` | `human` (Helena) | `@platform/event-store` ✓ | If ECL coverage ratio breaches RAS threshold, Helena escalates to Camille and the BRC before sign-off. |
| 10 | Bea (Accounting & financial reporting engineer, engineering) reviews ECL figures for accounting accuracy (correct EIR, correct discount window); confirms no reconciliation breaks vs. positions projection; emits `ECLAccountingReviewed { period, reviewer: bea, issues_resolved: true }` | `human` (Bea) | `@platform/document-store` ✓ | If issues are found, Bea raises them in the tracking register; sign-off is deferred until resolved. |
| 11 | Quarterly overlay review: Helena + Rohan assess current macro environment (GDP forecast, unemployment, interest rate outlook, sector-specific risks); agree adjustments to forward-looking scenario weights; record `ECLOverlayReviewed { quarter, scenario_weights_updated, rationale, approved_by: helena }` | `human` (Helena + Rohan) | `@platform/event-store` ✓ | Overlay changes are version-controlled typed events; no overlay change outside this governance gate (except Helena emergency power under the ECL Policy). |
| 12 | Annual model revalidation: `MOD-ECL-001` back-tested against realised defaults; Nadia (Model validation engineer) issues `ModelValidationCompleted` event with outcome. If material recalibration required, re-run full projection with new parameters; Helena and Bea review before next period close | `human` (Nadia + Helena + Bea) | `@platform/model-registry` (`PLANNED`) | Tier 1 revalidation per `ORG-PR-21`. Failure to revalidate on schedule is a Vera finding escalated to Helena + BRC. |

---

## 6. Reconciliation

- **Events produced:**
  - `ECLStagingComputed { instrument_id, as_of_date, stage, ecl_12m, ecl_lifetime, pd, lgd, ead, scenario_weights, model_version }` — per instrument, per compute.
  - `ECLStageTransitioned { instrument_id, prior_stage, new_stage, trigger, as_of_date }` — on stage changes.
  - `ECLPeriodEndSnapshot { period, total_ecl_stage1/2/3, snapshot_uri }` — period-end pin.
  - `ECLPeriodEndApproved { period, signatory: helena, approved_at }` — CRO sign-off.
  - `ECLAccountingReviewed { period, reviewer: bea, issues_resolved }` — Bea accounting review.
  - `ECLOverlayReviewed { quarter, scenario_weights_updated, rationale, approved_by }` — quarterly overlay governance.

- **Reconciliation invariants:**
  1. Every in-scope financial instrument at period-end must have a `ECLStagingComputed` event with `as_of_date` = period-end date. Missing instruments are a Vera finding.
  2. The sum of ECL figures in `ECLPeriodEndSnapshot` must equal the sum of individual `ECLStagingComputed.ecl` values for that period. Aggregation drift is a Vera finding.
  3. Every `ECLPeriodEndSnapshot` must have a downstream `ECLPeriodEndApproved` from Helena before Bea posts the impairment journal entries. The accounting engine enforces this as a hard gate.
  4. Every `ECLStageTransitioned` in the period is reconciled to a SICR trigger event (Step 2/3). Untriggered transitions are a Vera finding (potential model anomaly).
  5. PA Directive D3/2023 (`ORG-PR-44`) capital allocation: CET1 absorbs excess of Stage-1 ECL over regulatory-general-provision floor; Tier 2 absorbs eligible general provisions; specific provisions reduce exposure. Vera reconciles this allocation quarterly against the BA 100 capital return.

- **Failure mode:** ECL staging engine fails → `ECLStagingFailed { instrument_id, reason }` emitted. Period-end journal posting is blocked until the engine recovers. Atlas (engineering) + Bea notified immediately. Helena notified if resolution is not achievable before period-end close.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ECLStagingComputed` events (all instruments, all dates) | Event log | 7 years (IFRS 7; PA supervisory inspection SLA) | Restricted — financial / credit |
| `ECLStageTransitioned` events | Event log | 7 years | Restricted |
| `ECLPeriodEndSnapshot` events + BLAKE3-addressed snapshots | Event log + document store | 7 years | Restricted |
| `ECLPeriodEndApproved` events (Helena sign-off) | Event log | 7 years | Restricted |
| `ECLAccountingReviewed` events (Bea review) | Event log | 7 years | Restricted |
| `ECLOverlayReviewed` events (quarterly overlay governance) | Event log | 7 years | Internal — governance-restricted |
| `ModelValidationCompleted` events for `MOD-ECL-001` | Event log + model registry | Permanent | Internal — model-risk governance |
| IFRS 7 disclosure block (generated from ECL projection) | Document store (query output) | 7 years post-period | Public after filing; restricted pre-filing |

---

## 8. Manual steps

- **Step 9 — Helena CRO sign-off:** Period-end ECL approval is a governance step that requires CRO professional judgement on adequacy of the provision. This cannot be automated without exceeding the ECL Policy's risk-appetite governance framework.
- **Step 10 — Bea accounting review:** Bea's review of EIR correctness and discount-window selection requires financial expertise and knowledge of the instrument-specific terms. Manual until the posting-rule engine achieves sufficient coverage.
- **Step 11 — Quarterly overlay review:** The selection of forward-looking macro scenario weights is a professional risk-judgement step under IFRS 9 §B5.5.49–55. Helena exercises this judgement; it cannot be delegated to a model without creating a circular dependency within the ECL model itself.
- **Step 12 — Annual model revalidation:** The model-validation outcome is Nadia's independent professional judgement; independence is a prerequisite under the Model Risk Policy (`ORG-PR-21`).

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| ECL staging engine unavailable at period-end | `ECLStagingFailed` event; health check | Atlas (on-call engineering) + Bea immediately; Helena if period-end close at risk |
| SICR trigger fires unexpectedly at scale (spike in Stage 2 / Stage 3) | Vera daily staging-distribution report | Helena + Bea; BRC notification if material; PA notification if capital ratio impacted |
| Model `MOD-ECL-001` validation fails or is overdue | `ModelValidationCompleted` not emitted within annual cycle | Helena + Nadia; BRC; ECL figures continue under prior model version pending resolution |
| ECL coverage ratio breaches RAS threshold | Period-end review (Step 9) | Helena → Camille → BRC; capital-ratio-monitoring.md escalation path |
| PA D3/2023 capital-allocation mismatch | Vera quarterly reconciliation (invariant 5) | Bea + Camille; BA return restatement path if material |
| Overlay changes made outside governance gate | Vera event-sequence check | Helena; immediate reversal and formal overlay review event required |
| Period-end posting without `ECLPeriodEndApproved` | Accounting engine gate | Block posting; Atlas engineering investigation; Helena re-approval |

---

## 10. Related procedures

- [`ecl-stage-projection-refresh.md`](ecl-stage-projection-refresh.md) (PROC-RSK-EC-01) — upstream continuous staging engine; PROC-RSK-ECL-02 is the governance + period-end wrapper for the projection that PROC-RSK-EC-01 maintains.
- [`posting-rule-publication.md`](posting-rule-publication.md) — Bea's posting-rule engine converts ECL figures to `JournalEntryPosted` events.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — Helena's ECL sign-off feeds capital projections (BA 100; CET1 deductions).
- [`ba-return-generation.md`](ba-return-generation.md) (PROC-FIN-BA-01) — period-end ECL snapshot feeds BA 200 (credit RWA) and BA 100 (capital adequacy) via the BA return engine.
- [`balance-sheet-substantiation.md`](balance-sheet-substantiation.md) — impairment journal entries from this procedure feed the substantiated balance sheet.
- [`model-validation.md`](model-validation.md) — `MOD-ECL-001` Tier-1 validation is a prerequisite for live use of this procedure's computed ECL figures.
- [`ifrs10-consolidation-cycle.md`](ifrs10-consolidation-cycle.md) (PROC-ACC-IFRS10-01) — consolidated ECL figures are an input to the group consolidation cycle.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Initial draft — POPULATED. All 12 sections authored; system capabilities marked PLANNED; substrate gaps noted for v1 build. |

---

## 12. Audit / assurance

- Vera daily: staging completeness (invariant 1), aggregation parity (invariant 2), stage-transition trigger reconciliation (invariant 4).
- Vera quarterly: PA D3/2023 capital-allocation reconciliation (invariant 5); overlay governance event-sequence check.
- BRC receives quarterly ECL provision report — stage distribution, coverage ratios, overlay movements, model performance metrics.
- Annual: Audit Committee reviews `MOD-ECL-001` validation outcome; co-signed by Helena (CRO, governance) and Nadia (Model validation engineer).
- PA supervisory inspection readiness: all `ECLStagingComputed` events and `ECLPeriodEndSnapshot` artefacts available in the document store with < 5-business-day retrieval SLA.
