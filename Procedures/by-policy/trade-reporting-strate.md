---
procedureId: PROC-MK-ODP-02
title: OTC derivative trade reporting to STRATE Trade Repository
author: Kai (Trading systems engineer, engineering) · Anya (Data engineer, engineering)
date: 2026-05-16
owner: Mira (Regulatory intelligence engineer, engineering) · Tomas (Operations engineer, engineering) · Anya (Data engineer, engineering) · Kai (Trading systems engineer, engineering)
status: POPULATED
policy-cited: Policies/trade-reporting-policy-v1.md
system-capability: prototype/platform/regulatory/strate-tr-client (DRAFTING)
---

# Procedure — OTC Derivative Trade Reporting to STRATE Trade Repository

**Procedure ID:** PROC-MK-ODP-02
**Owner:** Mira (Regulatory intelligence engineer, engineering) · Tomas (Operations engineer, engineering) · Anya (Data engineer, engineering) · Kai (Trading systems engineer, engineering)
**Approval:** BRC (under the Risk Management Framework / Trade Reporting Policy)
**Cadence:** Per-transaction (live post-licence); daily reconciliation
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- `Policies/trade-reporting-policy-v1.md` — Trade Reporting Policy (PLANNED, markets bundle)

The obligation chain is:

```
Regulation (Financial Markets Act s.67A + CS 3/2018 §7)
  → Trade Reporting Policy
    → PROC-MK-ODP-02 (this procedure)
      → @platform/regulatory/strate-tr-client (DRAFTING)
      → @regulatory/strate-mapper (PLANNED)
```

The Trade Reporting Policy mandates per-transaction reporting of every OTC derivative executed by the bank (as principal) to STRATE, the FSCA-designated Trade Data Repository (TDR). The policy requires all 169 prescribed data elements to be reported within the regulatory deadline (T+1 for most fields; real-time for specific lifecycle events). Mira (Regulatory intelligence engineer, engineering) owns the field-mapping specification; Anya (Data engineer, engineering) owns the schema; Tomas (Operations engineer, engineering) owns the submission pipeline.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FMA-003` (Financial Markets Act s.67A) | Every person who enters into an OTC derivative transaction must report it to an FSCA-approved Trade Repository within the prescribed period. |
| `ORG-CS3-001` (CS 3/2018 §7(1)) | The reporting counterparty (the bank, as the ODP) must report all 169 prescribed fields to STRATE TR; EMIR-Refit-aligned schema; live by 1 March 2027. |
| `ORG-CS3-002` (CS 3/2018 §7(2)) | Lifecycle events (amendments, terminations, novations, compressions) must be reported within T+1 of the event. |
| `ORG-CS3-004` (CS 3/2018 §7(4)) | Unique Trade Identifier (UTI) assigned and agreed with counterparty before submission; LEIs for all counterparties mandatory. |
| `ORG-FMA-004` (Financial Markets Act s.68) | Failure to report is a regulatory contravention; the FSCA may impose penalties and/or suspend the ODP authorisation. |

---

## 3. Purpose

The purpose of this procedure is to:

1. Report every OTC IRD trade executed by the bank (as principal) to STRATE's Trade Repository, with all 169 prescribed CS 3/2018 data elements, within the regulatory deadline.
2. Assign a Unique Trade Identifier (UTI) and agree it with the counterparty before submission, ensuring no duplicate or orphan reports.
3. Report all lifecycle events (amendments, terminations, novations, compressions) within T+1.
4. Conduct a daily reconciliation of submitted reports against the bank's internal trade records to detect missed, duplicate, or incorrect submissions before the next business day.
5. Escalate late or failed submissions immediately to Mira (Regulatory intelligence engineer, engineering) and Zara (Chief Compliance Officer, governance) so that regulatory notification and remediation can occur within the FSCA's prescribed window.

---

## 4. Trigger

**Per-transaction trigger:**
- `OtcTradeExecuted { tradeId, counterpartyLei, product, notional, currency, maturity, executionTimestamp, rate }` — emitted by Kai's (Trading systems engineer, engineering) OMS/EMS on trade booking. Triggers the reporting pipeline immediately.
- `OtcTradeAmended { tradeId, fieldChanged, newValue, amendTimestamp }` — triggers lifecycle amendment report.
- `OtcTradeTerminated { tradeId, terminationDate, terminationAmount }` — triggers termination report.
- `OtcTradeNovated { tradeId, originalCounterparty, newCounterparty, novationDate }` — triggers novation report.

**Daily reconciliation trigger:**
- Daily reconciliation tick (ZAR market calendar close) — Tomas (Operations engineer, engineering) runs the submitted-vs-executed reconciliation.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Capture all 169 mandatory CS 3/2018 fields at trade booking; validate completeness at emission — missing mandatory fields fail the booking and raise `OtcTradeBookingFailed { tradeId, missingFields }` | `system` (Kai's OMS/EMS) | `@trading/oms` (PLANNED) | All fields validated at booking time; downstream reporting cannot add missing source-data. UTI assigned at this step using the bank's LEI-based UTI namespace. |
| 2 | Emit `OtcTradeExecuted { tradeId, uti, counterpartyLei, productClassification, notional, currency, maturity, executionTimestamp, price, rate, reportingCounterparty: bank }` to the event log | `system` | `@platform/event-store` | Canonical trade record. Downstream systems subscribe to this event. |
| 3 | Agree UTI with counterparty via ISDA UTI generation logic (hierarchy: bank generates if it is the reporting counterparty); exchange via counterparty confirmation | `agent` (Tomas) | `@settlement/uti-exchange` (PLANNED) | UTI must be agreed before submission to STRATE. Short window: aim to agree within same-day. |
| 4 | Transform `OtcTradeExecuted` fields to STRATE TR submission schema (169 elements, EMIR-Refit-aligned); validate transformed record against Anya's schema definition | `system` | `@regulatory/strate-mapper` (PLANNED) | Field-by-field mapping table maintained by Mira (Regulatory intelligence engineer, engineering) + Anya (Data engineer, engineering). Transformation failures raise `STRATEMappingFailed { tradeId, reason }`. |
| 5 | Submit transformed record to STRATE TR API; receive ACK or NACK response | `system` | `@regulatory/strate-tr-client` (DRAFTING) | Submission must occur within T+1 of trade execution. ACK from STRATE TR includes the STRATE trade-report ID (`strateId`). NACK triggers immediate retry with corrected record. |
| 6 | Emit `TradeReported { tradeId, uti, strateId, submittedAt, fields: [...169...], ack: true }` to the event log | `system` | `@platform/event-store` | Canonical proof of submission. BLAKE3 hash of the submitted payload is stored for audit replay. |
| 7 | For each lifecycle event (`OtcTradeAmended`, `OtcTradeTerminated`, `OtcTradeNovated`): run Steps 4–6 with the appropriate STRATE action code (MODI, EROR, TERM, NOVA, COMP) within T+1 | `system` | `@regulatory/strate-mapper` (PLANNED) + `@regulatory/strate-tr-client` (DRAFTING) | CS 3/2018 §7(2) — lifecycle events are mandatory. Failure to report a termination is a separate contravention from failure to report the original trade. |
| 8 | Daily reconciliation: compare the set of `OtcTradeExecuted` events in the event log against the set of `TradeReported` events for the same calendar day | `agent` (Tomas) | `@platform/recon` | Runs at end-of-day. Discrepancies: (a) executed but not reported — `MissedTradeReport { tradeId, executedAt }`; (b) reported but no matching execution event — `OrphanTradeReport { strateId }`. |
| 9 | For each `MissedTradeReport`: submit a late report to STRATE TR immediately; emit `LateTradeReported { tradeId, strateId, lateBy }` | `agent` (Tomas) | `@regulatory/strate-tr-client` (DRAFTING) | Late reports must note the reason for lateness in STRATE submission metadata. |
| 10 | Escalate any `MissedTradeReport` or `STRATEMappingFailed` unresolved after 1 hour to Mira + Zara (Chief Compliance Officer, governance) | `system` | `@platform/escalation` (PLANNED) | Late submission carries regulatory penalty risk; Zara assesses whether FSCA self-notification is required under Financial Markets Act s.68. |
| 11 | Weekly: Mira produces a TR completeness summary for BRC — count of trades reported, late reports, rejections, corrections | `agent` (Mira) | `@platform/recon` | BRC oversight of trade-reporting compliance. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `OtcTradeExecuted` | Step 2 — on trade booking | `tradeId`, `uti`, `counterpartyLei`, `productClassification`, `notional`, `currency`, `maturity`, `executionTimestamp`, `rate` |
| `TradeReported` | Step 6 — on STRATE ACK | `tradeId`, `uti`, `strateId`, `submittedAt`, `payloadHash` (BLAKE3), `ack: true` |
| `LateTradeReported` | Step 9 — late submission | `tradeId`, `strateId`, `lateBy` |
| `MissedTradeReport` | Step 8 — daily recon gap | `tradeId`, `executedAt` |
| `OrphanTradeReport` | Step 8 — report without execution | `strateId` |
| `STRATEMappingFailed` | Step 4 — schema validation fail | `tradeId`, `reason` |

### Invariants (CI-tested)

1. **Reporting completeness:** `∀ OtcTradeExecuted(tradeId) → ∃ TradeReported(tradeId)` — every executed trade must have a corresponding `TradeReported` event. Vera asserts nightly; any gap is a P1 finding.
2. **Timeliness:** `TradeReported.submittedAt − OtcTradeExecuted.executionTimestamp ≤ T+1` — submissions more than one business day late are a P2 finding escalated to Zara.
3. **No orphans:** `∀ TradeReported(strateId) → ∃ OtcTradeExecuted(tradeId)` — a reported trade without an execution event is a data-integrity finding.
4. **ODP gate:** no `OtcTradeExecuted` event may exist without a prior `ODPAuthorisationReceived` event (enforced jointly with PROC-MK-ODP-01).

### Failure mode

If the STRATE TR API is unavailable for more than 2 hours during a trading day, Tomas (Operations engineer, engineering) switches to the STRATE offline submission channel (batch upload via SFTP) and notifies Mira (Regulatory intelligence engineer, engineering). A `STRATEAPIUnavailable { start, duration }` event is emitted. If the API is unavailable at end-of-day and trades remain unreported, Zara (Chief Compliance Officer, governance) assesses whether FSCA notification is required.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `TradeReported` event (BLAKE3 payload hash) | Event log | 7 years (Financial Markets Act) | Restricted |
| `OtcTradeExecuted` event | Event log | 7 years | Restricted |
| STRATE TR ACK receipts (strateId) | Document store (linked from `TradeReported`) | 7 years | Restricted |
| Daily reconciliation output (`MissedTradeReport`, `OrphanTradeReport`) | Event log + recon register | 7 years | Restricted |
| Late report submissions and reasons | Document store + event log | 7 years | Restricted |
| Weekly TR completeness summary (Mira) | Document store | 5 years | Internal |

---

## 8. Manual steps

The following steps require human action or professional judgement in the current substrate:

1. **UTI agreement with counterparty (Step 3):** While UTI generation is automated under ISDA rules, confirming agreement with a counterparty that disputes the UTI requires Tomas (Operations engineer, engineering) to communicate directly. Automated UTI exchange is a PLANNED substrate gap.
2. **FSCA self-notification assessment (Step 10):** The decision whether a late or missed submission requires self-notification to the FSCA under Financial Markets Act s.68 involves legal and regulatory judgement. Zara (Chief Compliance Officer, governance) makes this assessment; it cannot be automated.
3. **STRATE offline submission (failure mode):** Batch upload via SFTP to STRATE's offline channel requires manual file preparation and upload by Tomas (Operations engineer, engineering). This step is a substrate gap flagged in the build-phase posture.
4. **Schema mapping updates (Step 4):** When STRATE TR publishes schema updates (e.g. EMIR-Refit alignment changes), Mira (Regulatory intelligence engineer, engineering) and Anya (Data engineer, engineering) must review and update the mapping table. Automated schema-drift detection is a PLANNED substrate gap.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| STRATE TR API returns NACK for a submission | `STRATENACKReceived { tradeId, reason }` event | Tomas + Anya immediately; corrected record resubmitted within 1 hour; unresolved → Mira + Zara |
| STRATE TR API unavailable > 2 hours | Health-check monitor | Tomas switches to offline channel; Mira notified; Zara assesses FSCA notification |
| Trade mapping schema mismatch (CS 3/2018 update) | `STRATEMappingFailed` event | Mira + Anya within 1 hour; schema updated; all failed submissions re-queued |
| Missing UTI at submission (counterparty dispute) | `UTIDisputeOpen { tradeId }` event | Tomas + counterparty Ops; resolved within T+1; Mira monitors |
| End-of-day recon shows > 5 unreported trades | `MissedTradeReport` count threshold | Mira + Zara immediately; Zara assesses FSCA notification; BRC notified same day |
| `OtcTradeExecuted` without prior `ODPAuthorisationReceived` | Vera P1 gate | Owen + Zara + CEO immediately; trading halted pending authorisation |

---

## 10. Related procedures

- [`odp-authorisation-application.md`](odp-authorisation-application.md) — PROC-MK-ODP-01; ODP authorisation is a pre-condition for `OtcTradeExecuted`; the reporting pipeline is part of the IT-capacity evidence pack.
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) — counterparty LEI is captured at onboarding; it is a mandatory field in the STRATE TR submission.
- [`portfolio-reconciliation.md`](portfolio-reconciliation.md) — PROC-MK-ODP-05; the set of open trades in the TR submission is reconciled against the counterparty portfolio.
- [`excon-otc-derivatives.md`](excon-otc-derivatives.md) — Excon reporting obligations for cross-border OTC derivatives are related to but distinct from STRATE TR reporting; both procedures run in parallel for cross-currency IRDs.
- [`event-schema-evolution.md`](event-schema-evolution.md) — changes to the `OtcTradeExecuted` event schema require co-ordination with Anya to ensure the STRATE mapper still captures all 169 fields.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Mira (Regulatory intelligence engineer, engineering) | Initial STUB — 7-section skeleton; steps and build-phase posture documented. |
| v0.2 | 2026-05-16 | Kai (Trading systems engineer, engineering) · Anya (Data engineer, engineering) | STUB → POPULATED: full 12-section structure; YAML frontmatter added; steps expanded to 11 rows; events, invariants, evidence table, manual steps, failure modes, and audit sections added. |

---

## 12. Audit / assurance

- **Vera nightly:** assert `∀ OtcTradeExecuted → ∃ TradeReported`; any gap is a P1 finding reported to Zara and the BRC.
- **Vera nightly:** timeliness check — flag any `TradeReported.submittedAt > executionTimestamp + 1 BD` as a P2 finding.
- **Vera weekly:** produce a TR completeness report for Mira's BRC summary — count of trades, lifecycle events, late submissions, rejections.
- **Thandiwe (Chief Audit Executive, governance) annual audit:** sample `TradeReported` events against STRATE TR download; verify all 169 fields are populated and accurate; review late-submission log for systematic issues.
- **FSCA supervisory examination:** FSCA may request a full download of the bank's STRATE TR submissions for any period. The event log + document store (BLAKE3-addressed payloads) support full point-in-time reconstruction of every submitted report.
