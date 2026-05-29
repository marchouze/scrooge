---
policy-parent: - Policies/trade-reporting-policy-v1.md
last-reviewed: 2026-05-22
procedureId: PROC-MK-SFTR-01
title: SFTR / repo trade reporting procedure
author: Mira (Compliance / RegTech engineer, compliance) · Tomas (Payments & settlement engineer, engineering)
date: 2026-05-22
owner: Mira (Compliance / RegTech engineer, compliance) · Tomas (Payments & settlement engineer, engineering)
status: POPULATED
version: "1.0"
last-updated: "2026-05-22"
policy-cited:
  - Policies/trade-reporting-policy-v1.md
  - Policies/securities-financing-policy-v1.md
  - Policies/regulatory-reporting-policy-v1.md
system-capability:
  - "@regulatory/jse-trr (PLANNED)"
  - "@platform/uti-assignment-engine (PLANNED)"
  - "@platform/event-store"
  - "@platform/doc-store"
citations:
  - FMA 19 of 2012 s.56–57
  - SARB/FSCA Joint Standard on trade reporting
  - JSE Trade Repository (TRR) reporting requirements
  - GMRA 2011
---

# Procedure — SFTR / repo trade reporting

**Procedure ID:** PROC-MK-SFTR-01
**Owner:** Mira (Compliance / RegTech engineer, compliance) · Tomas (Payments & settlement engineer, engineering)
**Approval:** Zara (Chief Compliance Officer, governance) — joint sign-off required on any change
**Cadence:** Continuous (event-triggered); daily valuation updates by 09:00 next business day
**Version:** v1.0 — 2026-05-22
**Status:** POPULATED

---

## 1. Source policy

The obligation chain binding this procedure:

```
Regulation (FMA 19 of 2012 s.56–57; SARB/FSCA Joint Standard on trade reporting; JSE TRR; GMRA 2011)
  → Trade Reporting Policy v1 (Policies/trade-reporting-policy-v1.md)
  → Securities Financing Policy v1 (Policies/securities-financing-policy-v1.md)
  → Regulatory Reporting Policy v1 (Policies/regulatory-reporting-policy-v1.md)
    → PROC-MK-SFTR-01 (this procedure)
      → @regulatory/jse-trr (PLANNED)
        → SftReportSubmitted / SftReportAcknowledged events
```

- **Trade Reporting Policy v1** (`Policies/trade-reporting-policy-v1.md`): establishes the bank's obligation to report all trade activity to recognised trade repositories; sets the T+1 initial-report deadline and lifecycle-event reporting requirements.
- **Securities Financing Policy v1** (`Policies/securities-financing-policy-v1.md`): governs securities financing transactions (repo, reverse repo, securities lending, buy/sell-back); mandates GMRA 2011 documentation standard; defines collateral eligibility and haircut schedule.
- **Regulatory Reporting Policy v1** (`Policies/regulatory-reporting-policy-v1.md`): sets the cross-cutting framework for all regulatory submissions; names Mira as Regulatory Reporting Owner and Zara (Chief Compliance Officer, governance) as accountable governance officer; requires BLAKE3-addressed evidence retention.

**Build-phase posture:** No live repo trades. The reporting pipeline is built and tested with synthetic trade data during the build phase. Steps referencing `@regulatory/jse-trr` are PLANNED; Tomas maintains a manual submission path via the JSE TRR portal for the build-phase validation run.

**Commencement-of-trading posture:** The pipeline fires automatically on each triggering event without manual intervention except where step-level human gates are noted.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Financial Markets Act 19 of 2012 s.56 | Requires licensed participants (including ODP-authorised banks) to report all transactions in securities to a licensed trade repository; failure to report is a regulatory offence. |
| Financial Markets Act 19 of 2012 s.57 | Empowers FSCA to prescribe the form, content, and timing of trade repository reports; authorises FSCA to issue directives on reporting standards. |
| SARB / FSCA Joint Standard on trade reporting | Operationalises the FMA s.56–57 reporting obligation; specifies the fields required for SFT reporting (LEIs, UTI, collateral ISIN, haircut, repo rate, notional, dates); sets the T+1 initial-report deadline. |
| JSE Trade Repository (TRR) reporting requirements | JSE TRR is the licensed trade repository for South African securities financing transactions; its technical specification prescribes the payload schema, UTI-generation convention, submission channel, and acknowledgement protocol. |
| GMRA 2011 (Global Master Repurchase Agreement) | The contractual framework governing repo and reverse-repo transactions; defines the economic terms (purchase price, repurchase price, margin, income payment, buy-in) that map to TRR reporting fields. |

---

## 3. Purpose

1. Ensure every repo, reverse-repo, and securities financing transaction (SFT) executed by the bank is reported to the JSE Trade Repository within the required T+1 timeframe, thereby satisfying the bank's FMA s.56 obligation.
2. Maintain complete lifecycle reporting for every reported SFT — covering initial report, daily valuation updates, modifications, and termination — so the TRR record accurately mirrors the economic position at all times.
3. Provide an immutable, BLAKE3-addressed audit trail of every TRR submission and acknowledgement, enabling Vera (internal audit engineer, governance) and Thandiwe (Chief Audit Executive, governance) to assert reporting completeness.
4. Detect, investigate, and remediate any TRR rejection, submission gap, or portal outage within defined SLAs so that no unreported or stale SFT position persists beyond T+2.
5. Prevent regulatory breach by escalating to Zara (Chief Compliance Officer, governance) any situation where T+2 compliance cannot be restored by normal means.

---

## 4. Trigger

This procedure fires on any of the following events from the bank's event store:

| Event | Phase | Description |
|---|---|---|
| `RepoTradeBooked { repoId, counterpartyId, collateralIsin, notional, haircut, repoRate, startDate, maturityDate, bookedAt }` | Initial report | New repo or reverse-repo trade has been booked; triggers T+1 initial TRR report |
| `RepoMarkToMarketCompleted { repoId, markDate, mtmValue, currentExposure, marginBalance, completedAt }` | Daily valuation | Daily MTM valuation has been computed; triggers next-business-day valuation report to TRR |
| `RepoClosed { repoId, closedAt, closureType: 'maturity' \| 'early-termination' }` | Termination | Repo has reached scheduled maturity or been terminated early; triggers termination report on date |
| `RepoTradeModified { repoId, modificationId, fieldChanged, newValue, modifiedAt }` | Modification | Any economic term of a live repo has been modified; triggers T+1 modification report |

---

## 5. Steps

### 5a — Initial report on `RepoTradeBooked` (T+1 deadline)

**Step 1 — Receive event and validate completeness.**
When a `RepoTradeBooked` event is ingested, Mira's pipeline validates that all mandatory TRR fields are present: `repoId`, `counterpartyId` (must resolve to a valid LEI in the Party register), `collateralIsin` (must be a recognised JSE-listed ISIN), `notional` (positive ZAR-denominated amount), `haircut` (decimal percentage), `repoRate` (annualised percentage), `startDate`, and `maturityDate`. If any mandatory field is absent or invalid, the pipeline emits `SftReportValidationFailed { repoId, failedFields, detectedAt }` and alerts Mira immediately. Mira has until T+1 09:00 to resolve field errors before the submission deadline. If resolution is not possible by T+1 09:00, Mira notifies Zara (Chief Compliance Officer, governance) immediately.

**Step 2 — Assign UTI via JSE TRR.**
The pipeline calls the JSE TRR UTI-assignment endpoint (build phase: portal manual issuance; commencement: `@platform/uti-assignment-engine` automated call). The returned UTI is stored in the event store linked to the `RepoTradeBooked.repoId` via a `SftUtiAssigned { repoId, uti, assignedAt }` event. The UTI is the persistent identifier for all subsequent lifecycle reports for this trade; it must be referenced in every downstream TRR submission for this `repoId`.

**Step 3 — Assemble TRR payload.**
The pipeline assembles the full TRR initial-report payload per the JSE TRR technical specification:
- **Counterparty data:** reporting-party LEI (bank's own LEI from the Party register); counterparty LEI (from `counterpartyId` → Party register lookup).
- **Transaction data:** UTI (from Step 2); transaction type (`repo` or `reverse-repo`); collateral ISIN; notional amount (ZAR); haircut (%); repo rate (annualised %); start date; maturity date; open/term indicator.
- **Collateral data:** collateral type (government bond, corporate bond, equity per ISIN class); quality classification (IG/sub-IG/unrated); current market value of collateral (from `@platform/collateral-valuation-engine` if available, else Eitan (Treasurer) provides manually for build-phase).

**Step 4 — Submit initial report to JSE TRR.**
The pipeline submits the assembled payload to the JSE TRR submission endpoint (HTTPS API; build-phase: secure portal upload by Mira). On successful submission the TRR returns an acknowledgement reference (`trrRef`). The pipeline emits `SftReportSubmitted { repoId, uti, reportType: 'initial', trrRef, submittedAt }`. The raw payload is stored in the document store (BLAKE3-addressed) and the hash recorded in `SftReportSubmitted.payloadHash`.

**Step 5 — Await and record acknowledgement.**
The JSE TRR sends a formal acknowledgement (accepted/rejected) within its defined processing window. On receipt of an `accepted` response the pipeline emits `SftReportAcknowledged { repoId, uti, reportType: 'initial', trrRef, acknowledgedAt }`. The acknowledgement receipt is stored in the document store (BLAKE3-addressed). If the TRR response is `rejected`, the pipeline emits `SftReportRejected { repoId, uti, reportType: 'initial', trrRef, rejectionCode, rejectionReason, rejectedAt }` and triggers the exception-handling flow in Section 7.

---

### 5b — Daily valuation update on `RepoMarkToMarketCompleted` (deadline: 09:00 next business day)

**Step 6 — Receive MTM event.**
When `RepoMarkToMarketCompleted` is ingested for a live repo with a confirmed `SftReportAcknowledged` initial report, Mira's pipeline prepares a daily valuation update payload. The pipeline queries `SftUtiAssigned` to retrieve the UTI for the relevant `repoId`.

**Step 7 — Assemble and submit daily valuation report.**
The pipeline assembles the valuation update per JSE TRR requirements: UTI; mark date; MTM value (ZAR); current exposure (ZAR net of margin held); margin balance (initial margin + variation margin calls settled as of mark date). The report is submitted to JSE TRR by 09:00 on the next business day following the mark date. On submission the pipeline emits `SftReportSubmitted { repoId, uti, reportType: 'valuation', trrRef, submittedAt }` with BLAKE3-addressed payload stored in the document store. Acknowledgement handling follows the same pattern as Step 5.

---

### 5c — Lifecycle events: modification and termination

**Step 8 — Modification report on `RepoTradeModified`.**
When a live repo's economic terms are modified (rate, dates, notional, collateral substitution), the pipeline assembles a modification payload referencing the UTI and the specific field changed. The modification report is submitted to JSE TRR by T+1 (one business day after the modification event). Events: `SftReportSubmitted { reportType: 'modification' }` → `SftReportAcknowledged { reportType: 'modification' }`.

**Step 9 — Termination report on `RepoClosed`.**
On maturity or early termination, the pipeline submits a termination report to JSE TRR on the close date, referencing the UTI. The report records the final settlement amount, actual close date, and closure type (`maturity` or `early-termination`). Events: `SftReportSubmitted { reportType: 'termination' }` → `SftReportAcknowledged { reportType: 'termination' }`.

---

### 5d — Daily reconciliation

**Step 10 — End-of-day submission reconciliation.**
By 17:00 each business day, Mira's pipeline runs a completeness check across all live repos in the event store. For each `RepoTradeBooked` event without a corresponding `SftReportAcknowledged { reportType: 'initial' }` within T+1, the pipeline flags a gap and emits `SftReportGapDetected { repoId, reportType, gapDetectedAt }`. For each `RepoMarkToMarketCompleted` event without a downstream `SftReportAcknowledged { reportType: 'valuation' }` by 09:00 next business day, the pipeline flags a valuation-update gap.

**Step 11 — Retry unacknowledged submissions.**
Any `SftReportSubmitted` event more than two hours old without a matching `SftReportAcknowledged` event triggers an automatic retry. The pipeline resubmits the stored payload (retrieving it from the document store via the original `payloadHash`) and emits `SftReportRetried { repoId, uti, reportType, retryCount, retriedAt }`. Up to three retries are attempted at two-hour intervals before the exception-handling flow in Section 7 applies.

**Step 12 — UTI integrity check.**
The pipeline verifies that every live `repoId` has exactly one `SftUtiAssigned` event and that the UTI appears consistently across all `SftReportSubmitted` events for that `repoId`. Any inconsistency emits `SftUtiIntegrityAlert { repoId, alertDetail, detectedAt }` and escalates to Mira and Tomas immediately.

---

## 6. Reconciliation events

The following typed events form the complete reconciliation lifecycle for SFTR reporting. Vera (internal audit engineer, governance) asserts the event topology as described in Section 16.

| Event | Emitted by | Trigger |
|---|---|---|
| `SftReportSubmitted { repoId, uti, reportType, trrRef, payloadHash, submittedAt }` | Mira pipeline / `@regulatory/jse-trr` | Successful TRR submission (any report type) |
| `SftReportAcknowledged { repoId, uti, reportType, trrRef, receiptHash, acknowledgedAt }` | Mira pipeline | TRR acceptance response received |
| `SftReportRejected { repoId, uti, reportType, trrRef, rejectionCode, rejectionReason, rejectedAt }` | Mira pipeline | TRR rejection response received |
| `SftReportRetried { repoId, uti, reportType, retryCount, retriedAt }` | Mira pipeline | Unacknowledged submission triggers retry |
| `SftPortalFallbackUsed { repoId, uti, reportType, reason, fallbackBy, fallbackAt }` | Mira (manual) | API unavailable; manual portal upload used |
| `SftReportGapDetected { repoId, reportType, gapDetectedAt }` | Mira pipeline | EOD reconciliation finds missing acknowledgement |
| `SftUtiAssigned { repoId, uti, assignedAt }` | `@platform/uti-assignment-engine` / Mira (manual build-phase) | UTI generated and linked to `repoId` |
| `SftUtiIntegrityAlert { repoId, alertDetail, detectedAt }` | Mira pipeline | UTI inconsistency detected |
| `SftReportValidationFailed { repoId, failedFields, detectedAt }` | Mira pipeline | Mandatory TRR field absent or invalid |

---

## 7. Exception handling

### TRR rejection — parse / field error

When `SftReportRejected` is emitted:

1. Mira receives an immediate alert with `rejectionCode` and `rejectionReason`.
2. Mira parses the rejection reason to identify the field error (invalid LEI, unrecognised ISIN, schema violation, duplicate UTI, etc.).
3. Mira corrects the payload in the originating event (if an event-field error, a corrected event must be authored and linked via `RepoTradeModified` or equivalent correction event; if a pipeline-mapping error, Mira patches the mapping and re-runs the assembler).
4. The corrected payload is resubmitted within two hours of the rejection. `SftReportRetried { retryCount: 1 }` is emitted.
5. If the rejection cannot be resolved by T+2 (two business days after the original `RepoTradeBooked`), Mira notifies Zara (Chief Compliance Officer, governance) immediately, who assesses whether a proactive FSCA breach notification is required under FMA s.56.

### Persistent rejection or unresolvable field error

If after three retry attempts the TRR continues to reject, or the field error cannot be resolved within T+2:

1. Mira escalates to Zara (Chief Compliance Officer, governance) with full context (rejection codes, attempts made, reason for inability to resolve).
2. Zara determines whether to proceed with the manual portal submission (if the API issue is on the TRR side) or to initiate the FSCA breach notification process.
3. Tomas (Payments & settlement engineer, engineering) is notified if the underlying issue relates to the settlement or booking layer.

### JSE TRR portal / API outage

If the JSE TRR API returns HTTP 5xx errors or is otherwise unavailable:

1. Mira detects the outage via failed submission calls and verifies by attempting a direct portal login.
2. If the outage persists for more than 30 minutes, Mira switches to the portal fallback path: manually downloads the assembled payload from the document store, logs into the JSE TRR web portal, and submits manually.
3. Mira emits `SftPortalFallbackUsed { repoId, uti, reportType, reason: 'api-outage', fallbackBy: 'Mira', fallbackAt }` for each manual submission.
4. If the portal itself is unavailable and no submission can be made within 4 hours of the deadline, Mira notifies Devon (Chief Operating Officer, governance) and the SARB operational contact (per SARB-FSCA Joint Standard operational contact register). Section 13 escalation paths apply.
5. Once the API recovers, Mira confirms that portal-submitted reports are reflected in the TRR acknowledgement feed; if not, she resubmits via API and records `SftReportRetried`.

---

## 8. Reporting / MI

### Daily

- **TRR submission status dashboard:** Mira's pipeline populates a daily TRR status summary in the bank's regulatory reporting dashboard, showing: total live repos; submitted today; acknowledged today; pending acknowledgement; rejected; gaps detected; fallbacks used.
- **EOD reconciliation log:** a `DailySftReconciliationReport { date, totalLiveRepos, initialReportsCurrent, valuationUpdatesCurrent, gaps, rejections, retriesUsed, completedAt }` event is emitted by 18:00 each business day.

### Weekly

- Mira provides a weekly SFTR completeness summary to Zara (Chief Compliance Officer, governance): submission counts by report type; rejection rates; gap count; retry rates; any open exceptions.

### Monthly

- Mira provides a monthly SFTR reporting summary to Devon (Chief Operating Officer, governance): total SFT volume; reporting completeness rate; rejection resolution SLA performance; substrate gap status; any open regulatory items.

---

## 9. Change control

- **Joint ownership:** any amendment to this procedure requires sign-off from both Mira (Compliance / RegTech engineer, compliance) and Zara (Chief Compliance Officer, governance).
- **Regulatory-change trigger:** when SARB, FSCA, or JSE TRR publish a change to the trade reporting format, field requirements, or submission protocol, Mira must assess the impact and issue an updated procedure within 30 calendar days of the effective date of the change.
- **Versioning:** all procedure changes are versioned in the change log (Section 17) with author, date, and summary of changes.
- **Citation gate:** any procedure version referencing new policy documents or decision records must pass `bun run citation-gate` before submission.

---

## 10. Evidence

The following artefacts constitute the complete evidence package for SFTR regulatory reporting:

| Artefact | Storage | BLAKE3-addressed? | Retention | Notes |
|---|---|---|---|---|
| TRR submission payloads (initial, valuation, modification, termination) | `@platform/doc-store` | Yes — `payloadHash` in `SftReportSubmitted` | 7 years | JSE TRR format; one document per submission |
| TRR acknowledgement receipts | `@platform/doc-store` | Yes — `receiptHash` in `SftReportAcknowledged` | 7 years | TRR-issued acceptance confirmation |
| UTI register | Event store — `SftUtiAssigned` events | Via event store integrity | 7 years | One `SftUtiAssigned` per `repoId`; queryable by UTI or `repoId` |
| Rejection and resolution log | Event store — `SftReportRejected` + `SftReportRetried` events | Via event store integrity | 7 years | Full rejection reason and retry history per `repoId` |
| Portal fallback log | Event store — `SftPortalFallbackUsed` events | Via event store integrity | 7 years | Date, actor, reason, and outcome of each fallback use |
| Daily reconciliation reports | Event store — `DailySftReconciliationReport` events | Via event store integrity | 7 years | End-of-day summary per business day |
| Validation failure log | Event store — `SftReportValidationFailed` events | Via event store integrity | 7 years | Field-level validation errors and resolution |

---

## 11. Manual steps

The following steps in this procedure require human execution:

| Step | Actor | Condition | Rationale |
|---|---|---|---|
| Build-phase UTI issuance (Step 2) | Mira | Build phase only; until `@platform/uti-assignment-engine` is live | API integration not yet built |
| Build-phase portal submission (Step 4) | Mira | Build phase only; until `@regulatory/jse-trr` API integration is live | API integration not yet built |
| TRR rejection investigation and payload correction (Section 7) | Mira | On `SftReportRejected`; field error cannot be auto-corrected | Regulatory accuracy requires human judgment for field corrections |
| Regulatory breach escalation decision (Section 7) | Zara (Chief Compliance Officer, governance) | When T+2 cannot be achieved; FSCA notification assessment | Material regulatory decision with legal consequences; cannot be delegated to an automated agent |
| Portal fallback submission (Section 7) | Mira | API outage persisting > 30 minutes | Human authentication required for JSE TRR web portal; automated API call not possible |
| SARB / FSCA operational contact notification (Section 7, Section 13) | Devon (Chief Operating Officer, governance) + Mira | Systemic TRR outage > 4 hours | Regulatory relationship contact; requires senior authorised officer |

---

## 12. Failure modes

| Failure mode | Detection | Immediate action | Escalation if unresolved |
|---|---|---|---|
| UTI not assigned before T+1 | `SftUtiAssigned` absent for `repoId` 2+ hours after `RepoTradeBooked` | Mira manually requests UTI via JSE TRR portal; emits `SftUtiAssigned` manually | T+1 09:00 → Zara notified; T+2 → FSCA breach assessment |
| TRR report rejected (field error) | `SftReportRejected` event | Mira investigates; corrects payload; resubmits within 2 hours | T+2 → Zara notified; Zara assesses FSCA notification |
| Report missing for a live trade (gap) | `SftReportGapDetected` at EOD reconciliation | Auto-retry initiated; Mira alerted | > T+2 → Section 13 escalation |
| Valuation update not submitted by 09:00 | `DailySftReconciliationReport` valuation-gap field > 0 | Mira submits late valuation; emits `SftReportRetried` | If not remediated same day → Zara notified |
| Portal API outage > 30 minutes | Consecutive HTTP 5xx from TRR API | Portal fallback path (Section 7); `SftPortalFallbackUsed` event | > 4 hours → Devon + SARB operational contact |
| UTI inconsistency across lifecycle reports | `SftUtiIntegrityAlert` event | Mira and Tomas investigate; identify which report used wrong UTI; issue correction | If not resolved within 2 hours → Zara notified |
| `RepoTradeBooked` missing mandatory fields | `SftReportValidationFailed` event | Mira investigates source (booking system or event authoring error); resolves and re-triggers pipeline | T+1 09:00 without resolution → Zara notified |

---

## 13. Escalation

| Trigger | Escalation path | Timing | Authority required |
|---|---|---|---|
| Any `SftReportRejected` not resolved within 2 hours | Mira → Zara (Chief Compliance Officer, governance) | 2 hours after rejection | Zara awareness |
| Unreported trade (no `SftReportAcknowledged`) beyond T+2 | Mira → Zara → Marc (CEO) | T+2 business day | Zara: FSCA notification assessment; Marc: breach authorisation |
| Systemic TRR outage persisting > 4 hours | Mira → Devon (Chief Operating Officer, governance) + SARB operational contact | 4 hours after outage confirmed | Devon: operational response; SARB contact: infrastructure escalation |
| UTI integrity failure not resolved within 2 hours | Mira + Tomas → Zara | 2 hours after `SftUtiIntegrityAlert` | Zara awareness |
| Any indication that FSCA / JSE TRR has queried the bank's reporting | Mira → Zara → Marc | Immediately | Zara owns regulator relationship; Marc informed as CEO |

---

## 14. Cross-references

| Reference | Relationship |
|---|---|
| [`Procedures/by-policy/repo-booking.md`](repo-booking.md) | Upstream: `RepoTradeBooked` event originates from the repo booking procedure; PROC-MK-SFTR-01 fires on that event |
| [`Procedures/by-policy/rr-ba-returns-monthly-cycle.md`](rr-ba-returns-monthly-cycle.md) | Downstream: outstanding SFT positions feed into the BA return cycle; PROC-MK-SFTR-01 completeness is a prerequisite for accurate BA returns |
| [`Procedures/finance/finsurv-submission-schedule.md`](../finance/finsurv-submission-schedule.md) (PROC-FIN-FXFS-01) | Sibling procedure: analogous submission-and-reconciliation pattern for SARB FinSurv FX trade reporting; share evidence-retention conventions |
| [`Procedures/by-policy/trade-reporting-strate.md`](trade-reporting-strate.md) (PROC-MK-ODP-02) | Sibling procedure: OTC IRD trade reporting to STRATE Trade Repository; same T+1 deadline; separate repository and payload schema |
| [`Procedures/by-policy/collateral-valuation-daily.md`](collateral-valuation-daily.md) (PROC-ALM-CVD-01) | Dependency: daily collateral valuations (Step 3 of PROC-MK-SFTR-01) draw on the collateral valuation pipeline; `RepoMarkToMarketCompleted` is downstream of that cycle |
| [`Procedures/by-policy/margin-vm.md`](margin-vm.md) (PROC-MK-ODP-03) | Related: variation-margin events on repo collateral may trigger `RepoTradeModified` events that feed PROC-MK-SFTR-01 modification reports |

---

## 15. Substrate gaps

The following platform capabilities are PLANNED and must be delivered before commencement of trading. Until they are live, the build-phase manual paths described in Sections 5 and 11 apply.

| Capability | Gap | Owner | Priority |
|---|---|---|---|
| `@regulatory/jse-trr` | JSE TRR API integration — HTTPS submission endpoint, acknowledgement polling, rejection-code parser | Atlas (Platform engineer, engineering) + Tomas (Payments & settlement engineer, engineering) | Pre-commencement |
| `@platform/uti-assignment-engine` | Automated UTI generation and assignment per JSE TRR convention; persistent `SftUtiAssigned` event emission; UTI uniqueness assertion | Atlas | Pre-commencement |
| Automated valuation-report generation | Pipeline to assemble daily valuation-update payloads from `RepoMarkToMarketCompleted` events and submit to TRR by 09:00; reconciliation with `@platform/collateral-valuation-engine` | Tomas + Ravi (ALM quant engineer, engineering) | Pre-commencement |
| SFT reporting dashboard tile | Dashboard tile surfacing daily TRR submission status (live count, pending, acknowledged, rejected, gaps) | Atlas + Mira | Pre-commencement |
| Automated portal-fallback detection | Circuit-breaker pattern: detect consecutive API failures → auto-switch to portal-fallback alert; avoid silent omission | Atlas + Mira | Pre-commencement |

---

## 16. Audit / assurance

### Vera (internal audit engineer, governance) — automated recon assertions

Vera runs the following assertions as part of the `recon:sftr-reporting-completeness` pipeline on each agent tick:

1. **Assertion V1 — Initial report completeness:** every `RepoTradeBooked` event has a downstream `SftReportAcknowledged { reportType: 'initial' }` within two business days. Unmatched `RepoTradeBooked` events beyond T+2 are P1 findings.
2. **Assertion V2 — Valuation update timeliness:** every `RepoMarkToMarketCompleted` event for a live repo has a downstream `SftReportAcknowledged { reportType: 'valuation' }` by 09:00 on the following business day. Gaps are P2 findings.
3. **Assertion V3 — Rejection resolution SLA:** no `SftReportRejected` event is more than 4 hours old without a downstream `SftReportRetried` or `SftReportAcknowledged` event. Violations are P2 findings.
4. **Assertion V4 — UTI uniqueness:** each `repoId` has exactly one `SftUtiAssigned` event. Duplicate UTI assignments are P1 findings.
5. **Assertion V5 — Termination report completeness:** every `RepoClosed` event has a downstream `SftReportAcknowledged { reportType: 'termination' }` within one business day. Gaps are P2 findings.
6. **Assertion V6 — Portal-fallback frequency:** `SftPortalFallbackUsed` events per calendar month are within the defined tolerance (≤ 2 per month for operational outages). Exceedance is a P3 finding flagged to Devon (Chief Operating Officer, governance) for infrastructure review.

### Thandiwe (Chief Audit Executive, governance) — annual review

Thandiwe (Chief Audit Executive, governance) reviews PROC-MK-SFTR-01 annually as part of the Internal Audit plan cycle (`PROC-AUD-APC-01`). The review covers: procedure completeness against current JSE TRR requirements; evidence-retention compliance; Vera assertion findings from the past 12 months; any regulatory enquiries received; substrate gap resolution progress.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-22 | Mira (Compliance / RegTech engineer, compliance) | Initial POPULATED — full 17-section procedure; FMA s.56–57 + SARB/FSCA Joint Standard + JSE TRR citations; event-driven flow (RepoTradeBooked → initial report; RepoMarkToMarketCompleted → daily valuation; RepoClosed → termination; RepoTradeModified → modification); UTI management; nine reconciliation events; three substrate gaps (JSE TRR API, UTI engine, valuation-report pipeline); six Vera assertions; build-phase manual paths documented |
