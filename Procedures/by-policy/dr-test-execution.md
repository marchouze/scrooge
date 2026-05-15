# Procedure — DR Test Execution

**Procedure ID:** PROC-OR-DR-01
**Owner:** Devon (Chief Operating Officer, governance) · Senna (Chief Information Security Officer, engineering)
**Approval:** EXCO
**Cadence:** Annual (full DR test); semi-annual (component tests)
**Version:** v0.1 — 2026-05-13
**Status:** POPULATED

## 1. Source policy

`Policies/operational-resilience-policy-v1.md` — Operational Resilience Policy.
`Policies/information-security-it-governance-policy-v1.md` — Information Security and IT Governance Policy.

The Operational Resilience Policy requires the bank to maintain tested recovery capabilities for each IBS within its board-approved impact tolerance. The Information Security and IT Governance Policy requires BCP/DR to be maintained as a named IT risk treatment, tested at least annually for the full DR environment and semi-annually at component level.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-18` | Identify Important Business Services; set impact tolerances; test whether recovery capabilities can restore each IBS within tolerance (DR test is the technical validation of those capabilities). |
| `ORG-PR-45` | Comply with PA D4/2023 operational resilience framework; includes testing of recovery capabilities including failover and restoration mechanisms. |
| `ORG-CY-16` | IT risk management per PA/FSCA Joint Standard 1/2023; BCP/DR is a named IT risk treatment; annual full test and regular component tests required. |

## 3. Purpose

Validate that the bank's technical disaster-recovery capabilities can restore each Important Business Service (IBS) within its board-approved RTO and RPO targets. Distinct from the Severe-but-Plausible Scenario Test (`severe-but-plausible-test.md` PROC-OR-SBP-01):

- **SBP test** — business-level: can the IBS *remain within its impact tolerance* during a disruption scenario? Conducted as a structured tabletop exercise.
- **DR test** — technical level: do the recovery capabilities (failover, replication, backup restoration, agent-runtime restart) *actually work* and meet the RTO/RPO targets? Conducted as a controlled technical failover (full test) or targeted component exercise (component test).

Both tests are required. DR test results feed the SBP scenario assessments: if an IBS fails its DR RTO/RPO targets, the SBP assessment for that IBS must treat the technical recovery capability as unavailable.

## 4. Trigger

- **Annual (full DR test):** once per calendar year; Devon co-ordinates the test window with Senna. Window selected during a low-volume period (typically Q1 or Q3, avoiding year-end close and ICAAP deadlines). Full failover of all production systems to the DR site.
- **Semi-annual (component tests):** twice per year (off the full-test cycle); individual components tested in isolation — database replication, backup restoration, agent-runtime restart, HSM key-recovery, network-routing failover.
- **Post-incident:** any actual incident that triggered a real DR activation (full or partial) is followed within 60 days by a targeted re-test of the systems that failed in the incident.
- **Post-remediation:** if a full DR test or component test fails for any IBS, a re-test of the failing IBS is required within 90 days of the remediation action being marked complete.
- **Regulatory request:** PA may request a specific DR demonstration; Devon and Senna co-ordinate.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Schedule DR test; confirm test type (full \| component), test window, and components in scope; emit `DRTestScheduled { test_id, test_type: full \| component, window_start, window_end, components_in_scope }` | `Devon` + `Senna` | `@platform/event-store` ✓ | Test window is agreed with Atlas (engineering) and Tomas (payments) to avoid conflicting with production cycles. For full tests, key participants notified at least 10 business days in advance. |
| 2 | Pre-test checklist: (a) confirm DR site readiness (infrastructure, networking, agent-runtime images); (b) confirm data-replication lag is within RPO threshold pre-test; (c) confirm HSM DR key shards are accessible; (d) confirm all IBS owners and technical leads available for test window | `Senna` + `Atlas` | `@platform/dr/readiness-check` (`PLANNED`) | Checklist items recorded as typed events. If any item fails the readiness check, the test is postponed and Devon is notified. Do not proceed to Step 3 until all checklist items pass. |
| 3 | Initiate controlled failover: emit `DRTestInitiated { test_id, failover_start_timestamp }`; begin DR failover sequence | `Senna` + `Atlas` | `@platform/dr/failover-orchestrator` (`PLANNED`) | For full DR tests: all production systems failed over. For component tests: only the component(s) in scope. Failover sequence is scripted and version-controlled; no ad hoc manual steps permitted. |
| 4 | Execute DR failover sequence: (a) network routing switched to DR site; (b) database read replicas promoted to primary; (c) event store DR replica promoted; (d) agent runtime restarted on DR infrastructure; (e) HSM DR path activated | `system` + `Senna` | `@platform/dr/failover-orchestrator` (`PLANNED`) + `@platform/agent-runner` ✓ + `@platform/event-store` ✓ | Each sub-step emits a structured event. Agent-runtime failover uses the AgentRunner lifecycle wrapper (PR #185); HSM failover per JS 1/2023 key-management requirements. |
| 5 | Emit `DRFailoverCompleted { test_id, systems_failed_over, failover_duration_minutes }` | `system` | `@platform/event-store` ✓ | Failover is considered complete when all in-scope systems are available on the DR site. Duration is measured from `DRTestInitiated.failover_start_timestamp`. |
| 6 | Verify each IBS as operational on DR site: for each IBS, run the minimum functional smoke test (synthetic transaction, query, or report generation) that confirms the IBS is serving correctly | `system` + IBS owners | `@platform/dr/smoke-test-suite` (`PLANNED`) | Smoke-test suite is maintained by Atlas and version-controlled. IBS owners confirm functional correctness; Atlas confirms platform health. |
| 7 | Measure RTO for each IBS: time from `DRTestInitiated.failover_start_timestamp` to IBS operational confirmation; emit `IBSRestoredOnDR { test_id, ibs_id, rto_achieved_minutes, rto_target_minutes, result: pass \| fail }` | `system` | `@platform/event-store` ✓ | RTO targets: OTC derivative execution 4 hours (240 min); payment settlement 2 hours (120 min); margin management 4 hours (240 min); regulatory reporting 24 hours (1440 min); client data management 8 hours (480 min). |
| 8 | Measure RPO for each IBS: check data-replication lag at moment of failover (pre-test baseline vs. DR site data currency); emit `RPOVerified { test_id, ibs_id, rpo_achieved_minutes, rpo_target_minutes, result: pass \| fail }` | `system` + `Atlas` | `@platform/dr/replication-lag-check` (`PLANNED`) | RPO targets: OTC derivative execution 15 min; payment settlement 5 min; margin management 30 min; regulatory reporting 60 min; client data management 60 min. RPO is verified via event-log sequence number comparison between primary (last snapshot) and DR. |
| 9 | Emit overall test result for each IBS: `DRTestPassed { test_id, ibs_id }` if both RTO and RPO pass; `DRTestFailed { test_id, ibs_id, rto_target_minutes, rto_actual_minutes, rpo_target_minutes, rpo_actual_minutes, failure_dimension: rto \| rpo \| both }` if either fails | `system` | `@platform/event-store` ✓ | A test is a fail for a given IBS if RTO or RPO exceeds its target. A partial pass (some IBS pass, some fail) is a partial failure: the test is marked `DRTestCompleted { result: partial_failure }`. |
| 10 | Failback to primary: after all IBS measurements are recorded, initiate controlled failback sequence; restore production systems to primary site; verify production operational | `Senna` + `Atlas` | `@platform/dr/failback-orchestrator` (`PLANNED`) | Failback is scripted and version-controlled. Event-store replication is re-confirmed post-failback. No production transactions are processed during the test window (arranged pre-test with Devon + Tomas). |
| 11 | For each failed IBS: create remediation action within 5 business days; emit `DRRemediationActionCreated { action_id, test_id, ibs_id, failure_dimension, owner, due_date }` | `Devon` + `Senna` + IBS owner | `@platform/event-store` ✓ | Remediation action due within 30 days (ORG-CY-16). Re-test required within 90 days of remediation completion. Critical failures (payment settlement or OTC derivative execution) are EXCO-notified within 24 hours. |
| 12 | Post-test report: Senna drafts; Devon reviews; covers test scope, IBS-level RTO/RPO results, failures, remediation actions, and recommendations for DR infrastructure improvements | `Senna` + `Devon` | `@platform/dr/test-report` (`PLANNED`) | Report filed in RMS Document register. EXCO approval of the report (or a delegated sign-off for component tests) recorded as typed event. |
| 13 | Emit `DRTestCompleted { test_id, test_type, result: pass \| partial_failure \| failure, ibs_results_summary, remediation_actions_open }` | `system` | `@platform/event-store` ✓ | Cycle is complete when this event is emitted. Report must be filed in RMS before emission. |

## 6. Reconciliation

- **Events produced:**
  - `DRTestScheduled { test_id, test_type, window_start, window_end, components_in_scope }` — scheduling.
  - `DRTestInitiated { test_id, failover_start_timestamp }` — failover start.
  - `DRFailoverCompleted { test_id, systems_failed_over, failover_duration_minutes }` — failover success.
  - `IBSRestoredOnDR { test_id, ibs_id, rto_achieved_minutes, rto_target_minutes, result }` — per IBS; 5 events for a full test.
  - `RPOVerified { test_id, ibs_id, rpo_achieved_minutes, rpo_target_minutes, result }` — per IBS; 5 events for a full test.
  - `DRTestPassed { test_id, ibs_id }` or `DRTestFailed { test_id, ibs_id, ... }` — per IBS.
  - `DRRemediationActionCreated { action_id, test_id, ibs_id, failure_dimension, owner, due_date }` — per failed IBS.
  - `DRTestCompleted { test_id, test_type, result, ... }` — cycle closure.
- **Invariants:**
  - `DRTestCompleted` cannot be emitted until `IBSRestoredOnDR` and `RPOVerified` events exist for every IBS in scope.
  - Every `DRTestFailed` event must be matched by a `DRRemediationActionCreated` event within 5 business days (monitored by Vera).
  - Annual full tests must produce a `DRTestCompleted` event for every calendar year; a missing vintage is a Vera finding.
  - Semi-annual component tests must produce `DRTestCompleted` events at 6-month intervals; Vera monitors the cadence.
  - `DRFailoverCompleted` must precede `IBSRestoredOnDR` events — failover must complete before IBS verification begins.
- **Failure mode:** DR site unavailable at test initiation → test is deferred; Devon is notified; new window scheduled within 30 days. If two consecutive annual tests cannot be executed because the DR site is unavailable, this is a critical finding escalated to EXCO, the Board, and the PA.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `DRTestScheduled`, `DRTestInitiated`, `DRTestCompleted` events | Event log | 10 years (PA inspection / DR history) | Restricted |
| `IBSRestoredOnDR` + `RPOVerified` events (per IBS per test) | Event log | 10 years | Restricted |
| `DRTestFailed` + `DRRemediationActionCreated` events | Event log | 10 years | Restricted |
| Pre-test readiness-check records | Event log + RMS Document register | 10 years | Restricted |
| Smoke-test suite version and execution logs | `@platform/dr/smoke-test-suite` + RMS Document register | 10 years | Restricted |
| Post-test report | RMS Document register | 10 years | Restricted |
| EXCO sign-off on post-test report | RMS Document register | Permanent | Restricted |
| Remediation action tracker (open actions) | RMS Workstreams register | Until action closed + 7 years | Restricted |
| PA correspondence (if DR test triggered by PA request) | RMS Correspondence register | Permanent | Critical |

## 8. Manual steps

- **Step 2** — Pre-test readiness check: Senna must physically confirm HSM DR key shard access and DR-site infrastructure readiness. Platform tooling records the check outcome; it cannot substitute for Senna's physical/cryptographic verification of the HSM.
- **Step 3** — Failover initiation: the controlled failover is initiated by Senna and Atlas. While the sequence is scripted, the decision to proceed (given the readiness check, business calendar, and risk appetite) is a human call by Devon (COO) and Senna (CISO).
- **Step 6** — IBS functional confirmation: IBS owners must confirm that their service is functioning correctly on the DR site. The smoke-test suite provides automated checks; IBS owners add the expert-judgement layer (e.g. market-data quality, trade-capture accuracy).
- **Step 10** — Failback: the decision to proceed with failback (after confirming DR site results are captured and all measurements recorded) is a human call by Devon and Senna. Premature failback could invalidate test results.
- **Step 11** — Remediation action creation: Devon and the relevant IBS owner must agree the remediation approach and feasibility before the action is committed. The platform records the action; the remediation content requires professional judgement.
- **Step 12** — Post-test report: Senna and Devon must interpret RTO/RPO measurement results in context (e.g. what caused a miss, whether it is a systemic or one-off issue). This is a governance document, not a raw system output.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Annual full DR test not scheduled by Q2 | No `DRTestScheduled { test_type: full }` event by end-Q2 | Devon → EXCO; PA deadline risk assessed |
| DR site readiness check fails at Step 2 | Readiness-check event: `result: fail` | Senna + Atlas immediate; Devon defers test; new window within 30 days; two consecutive deferrals → EXCO + Board |
| Failover fails mid-sequence (Step 4) | Missing `DRFailoverCompleted` event after timeout | Senna + Atlas invoke incident-response escalation path; Devon declares test failure; production systems restored from primary |
| IBS fails RTO target | `DRTestFailed { failure_dimension: rto }` | Devon + Senna + IBS owner; remediation within 30 days; re-test within 90 days of remediation; critical IBS (payments, OTC derivative) → EXCO within 24 hours |
| IBS fails RPO target | `DRTestFailed { failure_dimension: rpo }` | Atlas (data replication team); root-cause analysis; remediation within 30 days; re-test within 90 days; payments RPO miss → EXCO same day |
| All five IBS fail their targets | `DRTestCompleted { result: failure }` | Devon + Senna + Helena → EXCO same day → Board within 3 business days; PA notified; SBP self-assessment updated to reflect unavailable recovery capabilities |
| Remediation action overdue | Tracker: due date passed without completion event | Devon → EXCO; if overdue > 30 days past due date, Board-level notification |
| Real DR activation (incident) | `incident-response.md` declares DR activation | Post-incident DR re-test required within 60 days; `DRTestScheduled` opened automatically from incident closure event |
| PA requests DR demonstration | PA letter in RMS Correspondence register | Devon + Senna + Owen respond within PA-specified timeframe; unscheduled `DRTestScheduled` opened if full demonstration required |

## 10. Related procedures

- `severe-but-plausible-test.md` (PROC-OR-SBP-01) — SBP scenario assessments use DR test results as inputs: if an IBS fails its RTO/RPO, the SBP assessment must treat that technical capability as unavailable.
- `incident-response.md` — real incidents that trigger DR activation are followed by a targeted DR re-test within 60 days. The incident-response procedure and DR test procedure share the agent-runtime failover capability.
- `stress-test-cycle.md` (PROC-RISK-ST-01) — operational risk stress (Step 7) models system-outage scenarios; DR test results validate whether those scenarios are plausible and calibrated correctly.
- `access-provisioning.md` (PROC-IS-AP-01) — DR site access provisioning must be tested at Step 2 (readiness check); Senna co-ordinates.
- `change-management.md` — the DR failover and failback scripts are production infrastructure; any changes to them go through the change-management procedure before being used in a DR test.
- `agent-runtime-deploy.md` — agent-runtime failover (Step 4(d)) uses the deployment and restart procedures defined here; Atlas maintains the DR-site agent-runtime images.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Devon + Senna (via Scrooge dispatch) | Initial populated stub. Full DR test + semi-annual component tests; 13-step cycle; five IBS with explicit RTO/RPO targets; failover → IBS verification → failback → post-test report path. Covers ORG-PR-18 + ORG-PR-45 + ORG-CY-16. |
| v0.2 | 2026-05-15 | Devon (Chief Operating Officer, governance) + Senna (Chief Information Security Officer, engineering) | Promoted to POPULATED — all 12 sections verified complete. |

## 12. Audit / assurance

- Vera periodic check: every calendar year has a `DRTestCompleted { test_type: full }` event; every IBS has `IBSRestoredOnDR` and `RPOVerified` events in scope; every `DRTestFailed` event has a matched `DRRemediationActionCreated` event within 5 business days.
- Semi-annual component test cadence is monitored by Vera: no more than 6 months between `DRTestCompleted { test_type: component }` events.
- Senna's annual information-security assurance review includes DR capability as a named control (ORG-CY-16 / JS 1/2023).
- EXCO receives the post-test report (Step 12); the Board's BRC receives an annual summary of DR test outcomes as part of the operational resilience governance cycle.
