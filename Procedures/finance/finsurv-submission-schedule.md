---
procedureId: PROC-FIN-FXFS-01
title: SARB FinSurv FX trade reporting — submission schedule and procedure
author: Mira (Compliance / RegTech Engineer) · Saskia (Chief Markets Officer, governance)
date: 2026-05-16
owner: Mira (Compliance / RegTech Engineer) · Saskia (Chief Markets Officer, governance)
status: POPULATED
version: "0.2"
last-updated: "2026-05-20"
policy-cited: Regulatory Reporting Policy (planned)
system-capability: "@regulatory/sarb-finsurv (PLANNED)"
citations:
  - D-FX-AD-STATUS
  - D-MARKETS-SCHEMA-FOUNDATION
  - Banks Act Regulation 39
---

# Procedure — SARB FinSurv FX trade reporting — submission schedule and procedure

**Procedure ID:** PROC-FIN-FXFS-01
**Owner:** Mira (Compliance / RegTech Engineer) · Saskia (Chief Markets Officer, governance)
**Approval:** CCO (Zara) — Regulatory Reporting Policy (planned); SARB FinSurv mandated
**Cadence:** T+0 same-day for FX spot trades per FinSurv circular; automated at commencement of trading
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Regulatory Reporting Policy (planned; Mira co-author; CCO/Zara approval required at commencement).
- Currency and Exchange Manual (SARB) — framework for FX transaction reporting obligations.
- SARB FinSurv reporting circulars — prescribe the specific format and timing of FX trade reports.
- Decision record: `D-FX-AD-STATUS` — confirms the bank's authorised dealer (AD) status pathway; FinSurv reporting obligations are an AD condition.

The obligation chain:

```
Regulation (Currency and Exchanges Act; SARB FinSurv circulars — FX trade reporting)
  → Regulatory Reporting Policy (planned)
    → PROC-FIN-FXFS-01 (this procedure)
      → @regulatory/sarb-finsurv (PLANNED)
        → TradeReportSubmitted events
```

**Build-phase posture (manual):** No live trades. FinSurv submission workflow is built and tested with synthetic trade data during the build phase to confirm the format, field mapping, and submission mechanics are production-ready. Manual export path (step 4) is the primary path during build phase.

**Commencement-of-trading posture (automated):** Mira's pipeline fires automatically on `FxTradeExecuted`; no manual export required.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Currency and Exchanges Act 9 of 1933 | Authorised dealers must report all FX transactions to SARB FinSurv; failure to report is a regulatory offence. |
| SARB FinSurv Circular B.2 (current) | Specifies the FX transaction reporting format: counterparty details, transaction type, currency pairs, notional, rate, settlement date, finsurvCategory. |
| Currency and Exchange Manual (SARB) | Defines the classification taxonomy for FX transactions (finsurvCategory codes); correct category mapping is a reporting compliance condition. |
| D-FX-AD-STATUS | Confirms the bank's AD status determination pathway; AD obligations including FinSurv reporting are an AD condition. |
| Banks Act 94 (Reg 39) | Trading records must support regulatory reporting; any gap in trade records that prevents accurate FinSurv submission is a Regulation 39 compliance issue. |

## 3. Purpose

1. Ensure that every FX spot trade executed by the bank is reported to SARB FinSurv on the same day (T+0) as required by FinSurv circulars.
2. During the build phase: provide a manual export and submission workflow that validates the FinSurv format and the `finsurvCategory` field population before commencement of trading.
3. At commencement of trading: provide a fully automated FinSurv reporting pipeline that fires on `FxTradeExecuted` without manual intervention.
4. Maintain an immutable `TradeReportSubmitted` event for every FinSurv submission, creating an audit trail of all regulatory reporting.
5. Manage any submission failures or rejection notices from FinSurv with a defined remediation workflow.

## 4. Trigger

**Build-phase (manual):**
- `ManualFinsurvExportRequested { date, requestedBy: Mira, requestedAt }` — Mira initiates the daily export of synthetic trade data for testing.

**Commencement-of-trading (automated):**
- `FxTradeExecuted { tradeId, counterpartyId, currencyPair, notional, rate, settlementDate, finsurvCategory, executedAt }` — triggers the automated FinSurv reporting pipeline on each trade.

**Daily batch trigger (both phases):**
- `FinsurvSubmissionWindowOpen { date, deadline: 'T+0 17:00 SAST' }` — emitted by scheduler at 16:00 SAST; signals that all pending FinSurv submissions for the day must complete before 17:00 SAST.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **finsurvCategory population check:** For each FX trade (build phase: synthetic; commencement: live), verify that the `finsurvCategory` field is populated and maps to a valid SARB FinSurv category code; if missing or invalid: emit `FinsurvCategoryMissing { tradeId, detectedAt }` and alert Mira | `agent` (Mira — Compliance / RegTech Engineer, system-assisted) | `@platform/compliance/finsurv-validator` (PLANNED) | Valid FinsurvCategory codes are maintained in the SARB FinSurv circular appendix; Mira maintains a mapping table in `@platform/compliance/finsurv-validator`. Missing category blocks submission for that trade. |
| 2 | **FinSurv submission file preparation (build-phase manual path):** Mira exports the trade data from the subledger; maps fields to the FinSurv XML/CSV format; validates the file against the FinSurv schema; resolves any validation errors before submission | `human` (Mira — Compliance / RegTech Engineer) | `@platform/compliance/finsurv-validator` (PLANNED) | Build-phase: Mira performs this step manually to validate format. Commencement: automated at step 3 (skip step 2). |
| 3 | **Automated pipeline (commencement-of-trading path):** On `FxTradeExecuted`: the FinSurv reporting pipeline automatically: (a) fetches trade data from the event store; (b) maps to FinSurv format; (c) validates the file; (d) submits to FinSurv API; (e) receives confirmation | `agent` (Mira — pipeline owner) | `@regulatory/sarb-finsurv` (PLANNED) | Pipeline must submit within 30 minutes of `FxTradeExecuted`. Submission SLA: before 17:00 SAST on trade date (T+0). |
| 4 | **FinSurv submission:** Submit the validated FinSurv file to SARB via the FinSurv submission channel (secure HTTPS API or SFTP per current SARB FinSurv technical specification); receive submission confirmation reference | `agent` (Mira — automated) | `@regulatory/sarb-finsurv` (PLANNED) | Submission channel: SARB FinSurv API (if available) or secure SFTP. Confirmation reference is stored as evidence. |
| 5 | **TradeReportSubmitted event:** On successful submission: emit `TradeReportSubmitted { submissionId, tradeIds: [tradeId], submissionDate, finsurvRef, submittedBy: Mira, submittedAt }` | `agent` | `@platform/event-store` | This event is the canonical submission record. `finsurvRef` is the SARB-issued submission reference. |
| 6 | **Confirmation stored:** The FinSurv submission confirmation is stored in the regulatory correspondence store (BLAKE3-addressed); `TradeReportSubmitted.confirmationHash` references the stored document | `agent` | `@platform/doc-store` | SARB FinSurv confirmation documents are retained for 7 years per Currency and Exchanges Act records obligations. |
| 7 | **Submission failure handling:** If submission is rejected by FinSurv: emit `TradeReportSubmissionFailed { submissionId, reason, failedAt }`; Mira investigates the rejection reason; corrects the file; resubmits before 17:00 SAST; if resubmission is not possible before 17:00, Mira notifies Zara (CCO) immediately | `human` (Mira) | `@regulatory/sarb-finsurv` (PLANNED) | Submission failures after 17:00 SAST are late submissions; Zara assesses whether a FinSurv breach notification to SARB is required. Saskia is also informed. |
| 8 | **Daily submission reconciliation:** At 17:30 SAST, Mira reconciles submitted trades against the day's `FxTradeExecuted` events; any trade without a `TradeReportSubmitted` event is a submission gap; Mira initiates a late submission with Zara's approval | `human` (Mira) | `@platform/compliance/finsurv-validator` (PLANNED) | Submission gaps are `FinsurvSubmissionGap { tradeId, gapDetectedAt }` events; Zara is notified of any gap. |
| 9 | **Daily FinSurv submission report:** Mira emits `DailyFinsurvSubmissionReport { date, tradesSubmitted, submissionFailures, gapsDetected, gapsResolved, completedAt }` at EOD; this is an input to the regulatory reporting dashboard | `agent` (Mira — automated) | `@platform/event-store` | Daily report surfaces on the regulatory dashboard. Zara reviews weekly. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Mira (Compliance / RegTech Engineer) | FinSurv pipeline ownership; finsurvCategory validation; submission; failure handling; daily reconciliation |
| Saskia (Chief Markets Officer, governance) | Ensures finsurvCategory is set correctly on all FX trades at execution time |
| Zara (Chief Compliance Officer, governance) | CCO oversight; late-submission breach notification assessment; weekly report review |
| Vera (internal audit engineer, governance) | Quarterly assertion that every `FxTradeExecuted` has a downstream `TradeReportSubmitted`; no submission gaps |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| finsurvCategory missing at trade execution | Mira → Saskia to correct at source; trade held from submission | Before 17:00 SAST |
| Submission rejected by FinSurv | Mira investigates and resubmits; Zara informed if before 17:00 | Immediate |
| Submission not completed by 17:00 SAST | Mira → Zara; late-submission process | 17:00 SAST |
| Submission gap detected at 17:30 reconciliation | Zara notified; late submission initiated | 17:30 SAST |
| SARB FinSurv API unavailable | Mira → Devon (COO); SFTP fallback; Zara notified | Immediate |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@regulatory/sarb-finsurv` | PLANNED | FinSurv API/SFTP submission interface |
| `@platform/compliance/finsurv-validator` | PLANNED | FinSurv format validation; finsurvCategory mapping |
| `@platform/doc-store` | Live | BLAKE3-addressed submission confirmation storage |
| `@platform/event-store` | Live | `TradeReportSubmitted` and related events |

## 9. Quality controls

- Every `FxTradeExecuted` must have a downstream `TradeReportSubmitted` by 17:00 SAST on the trade date. Vera asserts this quarterly with a full trade-to-submission reconciliation.
- `finsurvCategory` must be populated on every `FxTradeExecuted` event. Missing category is a blocking validation error.
- Submission failures must be resolved the same day. Unresolved same-day failures are a Vera finding.
- Daily FinSurv submission report must be emitted by 18:00 SAST.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `TradeReportSubmitted` | Event log | 7 years | Primary submission record |
| FinSurv confirmation document | Doc store (BLAKE3) | 7 years | SARB-issued confirmation |
| `TradeReportSubmissionFailed` | Event log | 7 years | Failure record |
| `FinsurvSubmissionGap` | Event log | 7 years | Gap detection record |
| `DailyFinsurvSubmissionReport` | Event log | 7 years | Daily submission summary |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — finsurvCategory check, manual export path (build phase), automated pipeline (commencement), submission, TradeReportSubmitted event, failure handling, daily reconciliation, T+0 17:00 SAST deadline; Currency and Exchange Manual + FinSurv circular sourcing; D-FX-AD-STATUS citation. |
| v0.2 | 2026-05-20 | Owen (Company Secretary, governance) | **CCO seat reconciliation.** Per `Team/_team-roster.json` canonical roster, the CCO seat is held by **Zara**, not Rashida (who holds the CISO seat). Replaced "Rashida" with "Zara" in: front-matter Approval line, §1 Source policy, steps 7/8/9, §6 Roles, and §7 Escalation. The substantive Mira-led submission flow is unchanged. |
