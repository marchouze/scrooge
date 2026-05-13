# Procedure — Transaction monitoring

**Procedure ID:** PROC-FC-TM-01
**Owner:** Zara (Chief Compliance Officer, governance) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Continuous (per `TransactionInitiated` / `PaymentInstructed` event) + quarterly rule-library review
**Version:** v0.1 — 2026-05-13
**Status:** STUB

---

## 1. Source policy

`Policies/aml-cft-policy-v1.md` — AML/CFT Policy.
RMCP (Risk Management and Compliance Programme) — overarching obligation to maintain and operate a documented transaction-monitoring programme.
RAS B1–B3 (CEO approved 2026-05-06): elevated sensitivity to financial-crime risk; zero appetite for wilful non-reporting.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-01` | Adopt and maintain a Risk Management and Compliance Programme (RMCP) that includes transaction monitoring. |
| `ORG-FC-03` | Monitor transactions for unusual patterns inconsistent with the client's risk profile and business (FIC Act s.21C). |
| `ORG-FC-05` | Apply enhanced due diligence and transaction monitoring for higher-risk clients (FIC Act s.21D; FATF R.10, R.20). |
| `ORG-FC-06` | Report suspicious transactions to the FIC as soon as reasonably possible after grounds for suspicion arise (FIC Act s.29). |
| `ORG-FC-10` | File a Cash Threshold Report (CTR) for cash transactions ≥ R49,999 (FIC Act s.28). |

## 3. Purpose

Detect and triage transactions that exhibit financial-crime typologies — including structuring, layering, unusual counterparty jurisdictions, velocity anomalies, and dormant-account activation — before or immediately after settlement. Every transaction that passes through the bank's systems receives a risk score; high-scoring transactions produce alerts routed to the compliance analyst for triage, with genuine concerns escalated to the MLRO for Suspicious Transaction Report (STR) decision. The procedure also provides the threshold-detection gate for Cash Threshold Report (CTR) obligations. Fail-closed architecture ensures no transaction settles without a monitoring score.

## 4. Trigger

Any of the following events entering the core processing pipeline initiates transaction monitoring:

- `TransactionInitiated` — any debit, credit, transfer, or internal book entry instructed by or for a client.
- `PaymentInstructed` — outbound payment routed through a sponsor bank or SWIFT channel.
- `TradeSettlementInstructed` — OTC or listed-market settlement instruction (routed from Saskia's markets substrate).
- `CashDepositReceived` — physical cash or cash-equivalent instrument received (triggers CTR gate in addition to typology rules).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive transaction event from core ledger or payments pipeline; extract key fields (amount, currency, originator, beneficiary, account history, counterparty jurisdiction, product type) | `system` | `@platform/monitoring/ingestion` (`PLANNED`) | Synchronous on-event subscription; processing must complete before settlement gate. |
| 2 | Run typology-based rule library: layering patterns, structuring below CTR threshold (R49,999), unusual counterparty jurisdictions (FATF non-cooperative list + internal watchlist), velocity anomalies (count/value vs 30/90-day baseline), dormant-account activation (>6 months inactive then large credit) | `system` | `@platform/monitoring/rule-engine` (`PLANNED`) | Each matching rule emits a flag; rules are versioned and referenced by ID. |
| 3 | Compute composite risk score from rule hits, client risk rating (from KYC substrate), counterparty sanctions status, and product-risk weight | `system` | `@platform/monitoring/risk-scorer` (`PLANNED`) | Score range 0–100; thresholds: Low < 30; Medium 30–69; High ≥ 70. Emit `TransactionRiskScored { transaction_id, score, contributing_rules }`. |
| 4 | CTR gate: if transaction involves cash ≥ R49,999 (single or structured series detected by rule engine), route automatically to CTR pipeline | `system` | `@platform/monitoring/ctr-gate` (`PLANNED`) | CTR filing follows `ctr-filing.md`. CTR routing is independent of and does not replace STR routing. |
| 5 | Low or Medium score, no rule hits → allow settlement gate to proceed; record `TransactionMonitoringCompleted { outcome: cleared }` | `system` | `@platform/event-store` ✓ | Cleared transactions are still retained in the monitoring record for quarterly rule-review sampling. |
| 6 | High score OR any critical-typology rule hit → block settlement gate; emit `TransactionMonitoringAlert { transaction_id, score, rules_hit, priority: critical | high }` and open a case | `system` | `@platform/monitoring/alert-engine` (`PLANNED`) + `@platform/event-store` ✓ | Settlement gate is held; counterparty is NOT informed (tipping-off prohibition, FIC s.29(3)). |
| 7 | Alert triage: compliance analyst reviews alert, client profile, transaction context, and counterparty data | `human` (Zara / designated compliance analyst) | `@domains/compliance/case-management` (`PLANNED`) | Analyst has read-only view of client KYC record and transaction history. Triage target: < 24 h for critical, < 48 h for high. |
| 8 | False positive: analyst dismisses with documented rationale; record `TransactionMonitoringCaseDecided { outcome: dismissed, rationale, analyst }` | `human` (Zara / designated analyst) | `@platform/event-store` ✓ | Settlement gate reopens after dismissal event. Dismissed cases are sampled by Vera quarterly. |
| 9 | Genuine concern: analyst escalates to MLRO; record `TransactionMonitoringCaseDecided { outcome: escalated_to_mlro }` | `human` (Zara / designated analyst) | `@platform/event-store` ✓ | MLRO receives case file via restricted channel. |
| 10 | MLRO reviews case file and decides: file STR or close with rationale | `human` (Zara — MLRO) | `@domains/compliance/mlro-workspace` (`PLANNED`) | If STR: route to `str-filing.md`. If no-file: record `STRDecisionMade { decision: no-file, rationale }`. Either way, settlement gate decision follows (see step 11). |
| 11 | MLRO decides settlement outcome: hold, release, or escalate to freeze (FIC s.34A referral) | `human` (Zara — MLRO) | `@platform/event-store` ✓ | Freeze referral triggers separate `sanctions-screening.md` / regulatory-freeze workflow. |
| 12 | Quarterly rule-library review: Mira + Zara assess rule performance (false-positive rate, missed-typology indicators from FATF/FIC updates), approve new or retired rules, record `RuleLibraryReviewed { version, rules_added, rules_retired, approved_by }` | `human` (Mira + Zara) | `@domains/compliance/rule-governance` (`PLANNED`) | Rule changes are typed events; no rule changes outside this governance gate except for emergency additions (MLRO approval required). |

## 6. Reconciliation

- **Events produced:**
  - `TransactionRiskScored { transaction_id, score, contributing_rules, timestamp }` — emitted for every in-scope event.
  - `TransactionMonitoringAlert { transaction_id, score, rules_hit, priority }` — emitted when score ≥ 70 or critical rule hit.
  - `TransactionMonitoringCaseOpened { case_id, transaction_id, alert_id }` — case creation.
  - `TransactionMonitoringCaseDecided { case_id, outcome: STR | dismissed | escalated_to_mlro, rationale, analyst }` — case closure.
  - `TransactionMonitoringCompleted { transaction_id, outcome: cleared }` — for passing transactions.
  - `RuleLibraryReviewed { version, rules_added, rules_retired, approved_by }` — quarterly.

- **Reconciliation invariants:**
  1. Every `TransactionInitiated` or `PaymentInstructed` event must have a corresponding `TransactionRiskScored` event before any downstream settlement event. The settlement projection asserts this invariant at gate time; a missing score is treated as a monitoring failure and triggers the failure mode below.
  2. Every `TransactionMonitoringAlert` must have a downstream `TransactionMonitoringCaseDecided` within the triage SLA window. Vera runs a daily aging report on open alerts; breaches are escalated to Zara.
  3. Every `TransactionMonitoringCaseDecided { outcome: STR }` must have a downstream `STRFiled` within five business days. Vera's STR-timeliness recon (weekly) enforces this.

- **Failure mode:** Monitoring service unavailable → **fail-closed**. The settlement gate refuses to proceed until a `TransactionRiskScored` event is produced. No transaction settles without a monitoring score. Synthetic health checks run every 15 minutes; a failure fires a `MonitoringServiceDegraded` event that pages the on-call engineer and Zara.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `TransactionRiskScored` events (all) | Event log | 5 years minimum (FIC Act s.22; FICA Regulation 24) | High |
| `TransactionMonitoringAlert` events | Event log | 5 years | High |
| Case files (`TransactionMonitoringCaseOpened` + decisions + supporting analyst notes) | Event log + document store | 5 years post-case closure | High (PII; restricted) |
| Dismissed-alert rationale records | Event log | 5 years | High |
| Rule library version history (`RuleLibraryReviewed` events) | Event log | Permanent (model-risk register input) | Internal |
| MLRO no-file decisions (`STRDecisionMade { decision: no-file }`) | Event log | 5 years | Restricted (MLRO + deputies only) |

## 8. Manual steps

- **Steps 7–11** (alert triage, escalation, and MLRO decision) require human judgement. The rule engine can score and flag, but the determination of whether a pattern constitutes reasonable grounds for suspicion under FIC Act s.29 is a legal and professional judgment that the MLRO must make personally. The platform does not auto-file STRs.
- **Step 12** (rule-library governance): rule changes affect the sensitivity and specificity of the entire monitoring programme. Adding or retiring rules without review could suppress genuine alerts or flood the analyst queue. Dual approval (Mira + Zara) is required; a typed governance event is the gate.
- **Tipping-off control (FIC s.29(3)):** the platform must not surface any alert, case reference, or hold notification to the client or any party not in the named investigation set. The compliance-analyst workspace enforces role-based access; this is a design constraint, not a manual step, but humans must not route information outside the investigation set.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Monitoring service unavailable | Missing `TransactionRiskScored` before settlement gate; health check failure; `MonitoringServiceDegraded` event | Atlas (on-call engineering) + Zara immediately; settlement pipeline halted (fail-closed) |
| Alert queue aging > SLA (>24 h critical, >48 h high) | Vera daily aging report | Zara; if systemic, Devon (operational resilience) + BRC |
| STR not filed within 5 business days of case decision | Vera weekly STR-timeliness recon | Zara → MLRO (self-referral); FIC engagement if overdue |
| Rule library not reviewed in > 90 days | Vera quarterly cadence check | Zara + Mira; BRC notification |
| False-positive rate > 95 % in quarter | Quarterly rule-performance report | Mira + Helena (model risk); rule-tuning event required |
| Monitoring bypassed (settlement without `TransactionRiskScored`) | CI-tested projection invariant; Vera recon | Immediate: halt pipeline; Senna (security investigation); BRC report |
| Tipping-off breach detected | Access-log anomaly or human report | Zara → MLRO; FIC engagement (potential s.29(3) breach); Vera finding |

## 10. Related procedures

- `str-filing.md` — MLRO files STR following `TransactionMonitoringCaseDecided { outcome: STR }`.
- `ctr-filing.md` — cash transactions ≥ R49,999 route to CTR pipeline (Step 4).
- `sanctions-screening.md` — sanctions screening runs upstream (pre-execution); monitoring runs on all transactions including sanctions-cleared ones.
- `kyc-onboarding.md` — client risk rating from KYC feeds the risk-score calculation (Step 3).
- `kyc-continuous.md` — continuous KYC signals may update the client risk rating used in scoring.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Mira + Zara | Initial STUB — all 9 sections; system capabilities all PLANNED. |

## 12. Audit / assurance

- Vera daily alert-aging report; weekly STR-timeliness recon; quarterly rule-performance sampling.
- BRC receives monthly monitoring-effectiveness dashboard (alert volume, triage SLA compliance, STR rate, false-positive rate).
- Annual independent effectiveness review of the rule library (model-risk Tier 2 — annual revalidation; Helena co-signs).
- FIC Act s.45A inspection readiness: all monitoring records available in document store with < 5-business-day retrieval SLA.
