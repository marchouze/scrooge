---
policy-parent: Insider Trading / PA Dealing Policy (planned) · Owner Inbox/2026-05-06_core-policies-compliance-conduct.md
last-reviewed: 2026-05-16
procedureId: PROC-COND-PAD-01
title: Personal account dealing pre-clearance — insider trading controls
author: Owen (Company Secretary, governance) · Zara (Chief Compliance Officer)
date: 2026-05-16
owner: Owen (Company Secretary, governance) · Zara (Chief Compliance Officer)
status: POPULATED
policy-cited: Insider Trading / PA Dealing Policy (planned) · Owner Inbox/2026-05-06_core-policies-compliance-conduct.md
system-capability: "@platform/conduct/pa-dealing-engine (PLANNED)"
---

# Procedure — Personal account dealing pre-clearance — insider trading controls

**Procedure ID:** PROC-COND-PAD-01
**Owner:** Owen (Company Secretary, governance) · Zara (Chief Compliance Officer)
**Approval:** Zara (pre-clearance within 24h) · Owen (complex cases) · Helena (CRO, governance — breach escalation)
**Cadence:** On-trigger (per personal account dealing request); annual (designated-person register review; certification)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Insider Trading / Personal Account Dealing Policy (planned; Owen + Zara to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_core-policies-compliance-conduct.md` §4 — Insider Trading and Personal Account Dealing.

The obligation chain:

```
Regulation (FMCA Part 8 — insider trading / JSE Insider Trading Prevention Policy / Banks Act s.60)
  → Insider Trading / PA Dealing Policy
    → PROC-COND-PAD-01 (this procedure — pre-clearance)
      → @platform/conduct/pa-dealing-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-MKT-01` (FMCA s.78–82 — insider trading, Part 8) | Prohibited to deal in securities while in possession of inside information; prohibited to disclose inside information; prohibited to advise dealing based on inside information. Criminal and civil penalties. |
| `ORG-MKT-03` (JSE Listings Requirements / Insider Trading Prevention Policy) | Listed entities must maintain an insider list; no dealing during blackout periods; pre-clearance required for designated persons. |
| `ORG-FAIS-01` (FAIS General Code s.2 — honesty and integrity) | Representatives must not deal in securities in a manner that conflicts with client interests or market integrity; personal account dealing controls are required. |
| `ORG-MKT-06` (FMCA s.78 — market conduct) | Market participants must have documented controls to prevent insider trading; pre-clearance is the primary control. |

## 3. Purpose

Prevent insider trading and manage conflicts of interest arising from personal account (PA) dealing by team members who have access to material non-public information (MNPI) through their role at the bank. The procedure covers: (a) maintaining the designated-person register; (b) pre-clearance of all PA dealing requests by designated persons; (c) trading window (blackout period) management; (d) annual certification; (e) breach escalation.

**Build-phase note:** at present the bank has no designated natural persons with MNPI access (the bank is not yet licensed). The designated-person register and pre-clearance engine are built now for readiness; the procedure activates at licence-day when team members interact with live market information.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `PADealingApplicationSubmitted { applicantId, security, intendedDirection, quantity, estimatedValue, reason }` | Pre-clearance review — Steps 2–5 |
| Blackout period event (results announcement, material event) | Trading window closure — Step 3 (automated) |
| Annual scheduler (1 January): certification cycle | Annual certification — Step 7 |
| `PATradingWindowOpened` / `PATradingWindowClosed` | Window management — Step 3 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Designated-person register.** Owen maintains the register of designated persons — all team members (human and agent) with access to MNPI relating to securities the bank trades. The register includes: name, role, MNPI access categories, date added, date removed (if applicable). Emit `DesignatedPersonRegistered { personId, role, mnpiCategories[] }` on addition. | `agent` (Owen) | `@platform/conduct/pa-dealing-engine` (`PLANNED`) + `@platform/party-register` ✓ | Agents with access to pre-trade order books (Saskia — derivatives trading desk), MNPI from ISDA negotiations (Imani), or regulatory submissions (Owen, Helena) are designated persons. All agents with market-facing roles are provisionally designated. |
| 2 | **Pre-clearance application.** A designated person submits a PA dealing application: security identifier (ISIN / ticker), intended direction (buy/sell), quantity, estimated value, reason for the trade, account details. Emit `PADealingApplicationSubmitted { applicationId, applicantId, security, direction, quantity, estimatedValue, reason, submittedAt }`. | `agent` (per designated person) | `@platform/conduct/pa-dealing-engine` (`PLANNED`) | Applications may only be submitted during open trading windows. Applications outside a trading window are automatically rejected with `PADealingApplicationRejected { reason: "blackout-period" }`. |
| 3 | **Trading window check.** The PA dealing engine automatically checks whether the security is subject to a blackout period: (a) issuer results blackout (3 weeks before and 48 hours after results announcement); (b) material-event blackout (M&A, regulatory notice, material client instruction); (c) bank-specific blackout (e.g. bank's own potential regulatory action). | `system` | `@platform/conduct/pa-dealing-engine` (`PLANNED`) | Blackout periods are maintained as events: `PATradingWindowClosed { security, reason, expectedReopenDate }` and `PATradingWindowOpened { security }`. The engine queries the current window status before proceeding to Step 4. |
| 4 | **MNPI check.** Zara reviews the application: (a) does the applicant have access to MNPI relating to the security or its issuer? (b) is the bank currently holding an undisclosed material position in the security? (c) does the trade conflict with a client order the bank is executing? (d) does the trade create a front-running risk? | `agent` (Zara) | `@platform/conduct/pa-dealing-engine` (`PLANNED`) | Zara has access to the bank's order book and client mandates for the MNPI check. The check is documented in `PADealingMNPICheckCompleted { applicationId, mnpiPresent: boolean, conflictPresent: boolean, checkNotes }`. |
| 5 | **Clearance decision.** Zara approves or declines within 24 hours of application: (a) clear: no MNPI, no window issue, no conflict → `PADealingCleared { applicationId, clearedBy, clearedAt, validFor: "5 business days" }`; (b) decline: MNPI present, blackout, or conflict → `PADealingDeclined { applicationId, reason }`; (c) refer to Owen for complex cases (e.g. structured products, large size). | `agent` (Zara) or `agent` (Owen — complex) | `@platform/conduct/pa-dealing-engine` (`PLANNED`) | Clearance is valid for 5 business days from issue; if the trade is not executed within that window, a new application is required. Clearance is revoked if new MNPI arises before execution. |
| 6 | **Trade execution and reporting.** On executing a cleared PA trade: the designated person reports the execution within 2 business days: security, direction, quantity, price, date, account. Emit `PATradeExecuted { applicationId, executedAt, executionDetails }`. The PA dealing register records the completed transaction. | `agent` (per designated person) | `@platform/conduct/pa-dealing-engine` (`PLANNED`) | Post-execution reporting is mandatory even if the trade was within clearance parameters. Failure to report is treated as a breach equivalent to trading without clearance. |
| 7 | **Annual PA dealing certification.** Each designated person annually certifies: (a) all PA trades in the year are disclosed; (b) no trades were executed without pre-clearance; (c) no MNPI was used in any PA trade; (d) the PA dealing policy has been read and understood. Emit `PADealingAnnualCertification { year, personId, certifiedAt, discrepanciesReported: boolean }`. | `agent` (per designated person) | `@platform/conduct/pa-dealing-engine` (`PLANNED`) | The annual certification cross-references the PA dealing register against broker confirmations (where broker accounts are registered). Any discrepancy triggers a breach investigation. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Owen (Company Secretary, governance) | Designated-person register; complex case referrals; annual certification oversight |
| Zara (Chief Compliance Officer) | Pre-clearance review and decision (within 24h); MNPI check; breach escalation |
| Helena (Chief Risk Officer, governance) | Breach escalation receipt; BRC notification; FSCA reporting decision |
| Each designated person | Application before trading; post-trade reporting; annual certification |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Trade executed without pre-clearance | Zara + Owen immediately; Helena + CEO informed; investigation opened; FSCA notification assessment |
| MNPI used in PA trade | Zara + Owen + Helena + CEO immediately; FSCA mandatory report (FMCA s.78); suspension from PA dealing |
| Pre-clearance application rejected but trade executed | As for "trade without pre-clearance" above |
| Broker confirmation reveals undisclosed trades | Zara investigation; annual certification breach; disciplinary / operating-spec remediation |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/conduct/pa-dealing-engine` | PLANNED | Application intake, window management, MNPI check, clearance workflow, register, certification |
| `@platform/party-register` | ✓ live | Designated-person identity master |

## 9. Quality controls

- Vera recon: every `PATradeExecuted` has a preceding `PADealingCleared` within its validity window.
- Vera recon: every `PADealingApplicationSubmitted` has a `PADealingCleared` or `PADealingDeclined` within 24 hours.
- Vera recon: every designated person has a current-year `PADealingAnnualCertification` by 31 January.
- Zara: quarterly review of the PA dealing register for anomalies; pattern analysis for securities concentration.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `PADealingApplicationSubmitted`, `PADealingMNPICheckCompleted`, `PADealingCleared`, `PADealingDeclined`, `PATradeExecuted`, `PADealingAnnualCertification` events | Event log (P1) | 7 years | Legal-confidential |
| PA dealing register (projection) | RMS register | 7 years | Restricted |
| Broker confirmation records (where registered) | RMS document store | 7 years | Confidential |
| Blackout period log | Event log | 7 years | Internal |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Owen + Zara | Initial draft — PLANNED → POPULATED; full 11-section procedure; FMCA Part 8; trading window; 24h clearance SLA; annual certification; build-phase note (activates at licence-day). |

## 12. Audit / assurance

- **Vera (ongoing):** clearance-before-trade recon; 24h SLA check; certification completeness.
- **Thandiwe (CAE, governance):** annual conduct audit including PA dealing; sample testing of clearances vs broker records; opinion to BRC.
- **FSCA (market conduct):** may request PA dealing register and clearance records during a market integrity review.
