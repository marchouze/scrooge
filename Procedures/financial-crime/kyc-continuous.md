---
procedureId: PROC-FC-CKKYC-01
title: Continuous KYC re-evaluation — signal-triggered between formal refresh cycles
author: Mira (Regulatory intelligence engineer, compliance) · Zara (Chief Compliance Officer)
date: 2026-05-18
owner: Zara (Chief Compliance Officer) · Mira (Regulatory intelligence engineer, compliance)
status: POPULATED
version: "1.0"
last-updated: "2026-05-18"
policy-cited: AML-CFT-POLICY-V1
system-capability: "@domains/kyc/continuous-kyc-orchestration (PLANNED) · @platform/screening · @platform/risk-rating (PLANNED)"
citations:
  - FIC-ACT-S21B
  - FIC-ACT-S21G
  - FATF-REC-10
  - BANKS-ACT-REG-39
  - D-KYC-ONBOARDING-BUILD
---

# Procedure — Continuous KYC Re-evaluation (Signal-triggered)

**Procedure ID:** PROC-FC-CKKYC-01
**Owner:** Zara (Chief Compliance Officer) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Per-signal — fires whenever a qualifying signal event arrives for an active client; not calendar-driven
**Version:** v1.0 — 2026-05-18
**Status:** POPULATED
**Authority:** D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18)

## 1. Source policy

`Policies/risk-management-and-compliance-policy-v1.md` (RMCP) — AML/CFT Policy annex, ongoing monitoring obligations.
RAS B3 (CEO-approved 2026-05-06): low appetite for financial-crime risk; continuous monitoring is a standing obligation from FIC Act commencement of trading.

The obligation chain:

```
Regulation (FIC Act s.21B ongoing monitoring; FATF Rec.10 CDD ongoing; Banks Act Reg.39)
  → AML-CFT-POLICY-V1 (continuous monitoring between formal refresh cycles)
    → PROC-FC-CKKYC-01 (this procedure)
      → @domains/kyc/continuous-kyc-orchestration (signal router — PLANNED)
      → @platform/screening (re-screen adapter)
      → @platform/risk-rating (re-rating engine — PLANNED)
      → KYCSanctionsPEPScreened / KYCRiskRated / KYCRefreshScheduled events
```

**Distinction from periodic refresh:** `kyc-recurring.md` (PROC-FC-KYC-R-01) governs calendar-driven refresh (12-monthly / 6-monthly). This procedure governs signal-triggered re-evaluation that occurs between scheduled cycles; it is complementary, not overlapping.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| FIC Act s.21B (ongoing CDD) | Accountable institutions must monitor clients throughout the relationship; update information when material changes are detected. |
| FIC Act s.21G | Enhanced scrutiny required when ongoing monitoring reveals higher-risk indicators for a PEP or high-risk client. |
| FATF Recommendation 10 | CDD is ongoing; institutions must conduct enhanced scrutiny of transactions that are inconsistent with the business profile. |
| Banks Act Regulation 39 | Risk management processes must include ongoing surveillance of client relationships; material exposures require escalation. |

## 3. Purpose

Ensure that KYC information and risk ratings remain accurate between formal refresh cycles by reacting promptly to external signals that indicate a material change in the client's risk profile. Every signal must produce a typed response event; silent re-evaluations are a Principle 1 violation. The procedure distinguishes between material-change signals (which require action) and noise (which are recorded but do not trigger re-screening).

## 4. Trigger

Any of the following signal events arriving for an active client in the KYC register:

| Signal type | Originating event | Description |
|---|---|---|
| Adverse-media hit | `AdverseMediaPublished` (existing) | New adverse media referencing client name, aliases, or associated entities |
| Jurisdictional change | `ClientJurisdictionalChangeNotified` (PLANNED) | Client notifies a change of country of residence, incorporation, or primary activity |
| Ownership / UBO change | `ClientOwnershipChangeNotified` (PLANNED) | Change in shareholder structure, UBO, or control arrangement |
| Transaction anomaly | `TransactionAnomalyFlagged` (PLANNED) | Mira's transaction-monitoring projection flags an unusual pattern for the client |
| Regulator watchlist update | `SanctionsListPublished` (existing) | New or amended sanctions / watchlist entry that may affect the client or their associates |
| Counterparty-sanctions link | `CounterpartySanctionsLinkDetected` (PLANNED) | A counterparty to one of the bank's trades with this client is added to a sanctions list |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Signal arrives via feed or event; `@domains/kyc/continuous-kyc-orchestration` (PLANNED) routes the signal to the continuous-KYC classifier | `system` | `@domains/kyc/continuous-kyc-orchestration` (`PLANNED`) | All six signal types are normalised into a common `KYCSignalIngested` (PLANNED) event with `signal_type`, `client_id`, and `signal_source`. |
| 2 | Mira (or automated classifier) determines: is this signal **material** (requires re-screening / re-rating) or **noise** (low-relevance match or duplicate of a previously-resolved signal)? | `system` (classifier) → `Mira` (reviewer for ambiguous cases) | `@domains/kyc/continuous-kyc-orchestration` (`PLANNED`) | Material-change criteria: new adverse-media with credible sourcing; jurisdictional change; UBO delta; transaction anomaly above threshold; confirmed sanctions-list addition; confirmed counterparty link. Noise: duplicate alert, historical article with no new information, minor name-similarity match. Emit `KYCSignalClassified { material: boolean, rationale }` (PLANNED). |
| 3 | **Noise path:** record `KYCSignalClassified { material: false }`; no further action; next scheduled refresh unchanged. End of procedure for this signal. | `system` | `@platform/event-store` ✓ | Noise classification is permanent record; Vera can audit classifier accuracy retrospectively. |
| 4 | **Material path:** determine which KYC elements are stale given the signal type. Examples: adverse-media hit → re-screen + risk re-rating; ownership change → UBO resolution + re-screen + risk re-rating; sanctions-list update → sanctions re-screen only | `system` | `@domains/kyc/continuous-kyc-orchestration` (`PLANNED`) | Stale elements recorded in `KYCSignalClassified` payload as `stale_elements: string[]`. Targeted re-evaluation, not a full refresh. |
| 5 | Run targeted re-screening on stale elements only: re-screen client (and new UBOs if UBO change) against all current sanctions / PEP / adverse-media lists; emit `KYCSanctionsPEPScreened` (PLANNED) for re-screen result | `system` | `@platform/screening` | If re-screen returns a PEP hit → immediately route to `pep-handling.md` (PROC-FC-PEP-01) for full EDD. If sanctions true-positive → `ClientRejected` path / STR evaluation per `str-filing.md`. |
| 6 | Risk-rating re-evaluation: run scoring engine against updated client profile; produce a new risk-band recommendation | `system` | `@platform/risk-rating` (`PLANNED`) | Emit `KYCRiskRated { client_id, prior_band, new_band, factors }` (PLANNED). |
| 7a | **Band unchanged:** emit `KYCRiskRated { band_change: false }`; update the continuous-monitoring record with signal resolved timestamp; next scheduled refresh date is unchanged. End of procedure for this signal. | `system` | `@platform/event-store` ✓ | Client remains on current refresh cadence. |
| 7b | **Band upgrade (risk increases — e.g., standard → high):** escalate to Mira and Zara for EDD; if upgrade is to PEP tier or requires EDD, invoke `pep-handling.md` or EDD branch; emit `KYCRefreshScheduled { trigger_type: "band-upgrade", client_id, due_date: <within 30d> }` (PLANNED) | `Mira` → `Zara` (MLRO) | `@domains/onboarding/edd` (`PLANNED`) · `@platform/case-management` (`PLANNED`) | Band upgrade means the client's current refresh cadence is no longer sufficient; an early refresh is mandatory before trades are permitted. Trading restriction event emitted if client is active. |
| 7c | **Material change constitutes exit trigger:** if the signal indicates the client has become a prohibited-entity category (sanctioned entity, newly-prohibited jurisdiction, confirmed fraud actor) — escalate to Zara for EXCO notification; commence relationship-exit process | `Zara` → EXCO | `@platform/case-management` (`PLANNED`) | Exit decision is EXCO-level (DOA matrix Level 2). Emit `ClientExitTriggered` (PLANNED) and route to offboarding procedure. |
| 8 | Evidence record: emit `KYCContinuousEvalCompleted { client_id, signal_event_id, outcome, response_events[] }` (PLANNED) summarising the signal and all typed response events | `system` | `@platform/event-store` ✓ | No silent re-evaluations; every continuous-KYC cycle leaves a complete evidence chain. |

## 6. Reconciliation

**Events produced (in sequence):**
- `KYCSignalIngested { client_id, signal_type, signal_source, ingested_at }` (PLANNED) — signal normalised.
- `KYCSignalClassified { client_id, signal_event_id, material, rationale, stale_elements }` (PLANNED) — noise / material determination.
- `KYCSanctionsPEPScreened { client_id, ... }` (PLANNED) — re-screen (material path, where screening is a stale element).
- `KYCRiskRated { client_id, prior_band, new_band, band_change, factors }` (PLANNED) — re-rating result.
- `KYCRefreshScheduled { client_id, trigger_type: "band-upgrade", due_date }` (PLANNED) — early refresh trigger (band upgrade path only).
- `KYCEDDInitiated` (PLANNED) — if EDD required (routes to PROC-FC-PEP-01).
- `KYCContinuousEvalCompleted { client_id, signal_event_id, outcome, response_events[] }` (PLANNED) — cycle complete.

**Reconciliation invariants:**
- Every `KYCSignalIngested` must be followed by a `KYCSignalClassified` within **24 hours**. Unclassified signals older than 24h generate a Vera alert to Mira.
- Every material-change signal must have a `KYCContinuousEvalCompleted` event within **24 hours** of `KYCSignalIngested`.
- Every `KYCRiskRated { band_change: true }` (upgrade) must be followed by a `KYCRefreshScheduled` within the same evaluation cycle. Band upgrade without an early refresh trigger is a projection invariant violation.
- Every band-upgrade → trades for that client are restricted until `KYCEDDCompleted { outcome: "PROCEED" }` (or refresh-complete equivalent) is in the event log. Restriction enforced by the pre-trade conduct gate.

**Failure mode:** if the continuous-KYC orchestration service is unavailable, signals queue in the ingestion layer; Mira is alerted. Queue drain begins automatically on service recovery. For signals relating to active high-risk clients, Mira performs manual classification within 24h.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `KYCSignalIngested` events | Event log | Permanent (P1) | High |
| `KYCSignalClassified` events | Event log | Permanent (P1) | High |
| `KYCSanctionsPEPScreened` re-screen events | Event log | Permanent (P1) | Critical |
| `KYCRiskRated` events | Event log | Permanent (P1) | High |
| `KYCContinuousEvalCompleted` events | Event log | Permanent (P1) | High |
| Adverse-media scan results | Document store (content-addressed) | 5 years post-relationship exit (FIC Act s.22) | High |
| EDD records (if triggered) | See `pep-handling.md` Section 7 | Permanent (P1) — PEP EDD file | Critical |

## 8. Manual steps

- **Step 2** — noise / material classification is initially automated; Mira reviews all cases flagged as ambiguous by the classifier and all adverse-media hits above a configurable severity threshold.
- **Step 7b** — EDD decision (band upgrade with EDD required) is human discretion by Zara; the system routes and pre-fills, but the MLRO sign-off event is required before any `KYCEDDCompleted` is accepted.
- **Step 7c** — exit decision is EXCO-level; no automated exit may proceed without a human EXCO quorum decision event.
- **Tipping-off (FIC Act s.29(3)):** if any re-screening or re-evaluation reveals grounds for an STR, access to the re-evaluation case is immediately restricted to the MLRO-named investigation set per `str-filing.md`.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| `KYCSignalIngested` not followed by `KYCSignalClassified` within 24h | Vera daily invariant check | Alert to Mira immediately; manual classification if orchestration unavailable |
| Band-upgrade without `KYCRefreshScheduled` | Projection invariant on `KYCRiskRated` emit | Mira immediately; Zara notified; trade restriction automatically applied |
| Screening service unavailable during re-screen | Health-check on `@platform/screening` | Mira immediately; re-screen pending; trading restriction applied until resolved |
| `ClientExitTriggered` not followed by EXCO decision event within 5 business days | Case-management escalation timer | Zara → EXCO chair; relationship restricted pending EXCO |
| Exit trigger during active open trades | `ClientExitTriggered` + open trade projection check | Mira + Saskia (Head of Global Markets) immediately; unwind plan required |

## 10. Related procedures

- `kyc-onboarding.md` (PROC-FC-01) — initial CDD; this procedure monitors clients post-onboarding.
- `kyc-recurring.md` (PROC-FC-KYC-R-01) — periodic refresh; feeds into this procedure when a material-change signal triggers an early refresh.
- `pep-handling.md` (PROC-FC-PEP-01) — invoked when continuous monitoring detects PEP status or band upgrade to PEP tier.
- `sanctions-screening.md` — invoked inline at Step 5 for re-screening.
- `str-filing.md` — escalates from Step 7c or Step 10 when monitoring reveals grounds for suspicion.
- `ubo-resolution.md` (PROC-FC-UBO-01) — re-invoked at Step 4 if ownership / UBO change is the signal.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-18 | Mira (Regulatory intelligence engineer, compliance) + Zara (Chief Compliance Officer) | Initial POPULATED version — all 12 sections; authority D-KYC-ONBOARDING-BUILD. |

## 12. Audit / assurance

- **Vera weekly check:** all `KYCSignalIngested` events have a downstream `KYCSignalClassified` and `KYCContinuousEvalCompleted` within 24h. Deviations reported to Zara as findings.
- **Vera weekly check:** all band-upgrade `KYCRiskRated` events have an upstream `KYCRefreshScheduled` in the same evaluation cycle.
- **Vera quarterly sample:** select 20 random material-change signals; trace through the full evaluation chain; confirm no silent re-evaluations; confirm all EDD events for band upgrades carry MLRO sign-off.
- BRC monthly dashboard tile: signal volume by type; material-change rate; band-upgrade count; open re-evaluation cases by age band.
