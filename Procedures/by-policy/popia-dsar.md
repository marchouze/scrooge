---
status: POPULATED
---
# Procedure — POPIA Data Subject Access Request (DSAR)

**Procedure ID:** PROC-PRIV-02
**Owner:** Iris (Information Officer) · Anya (engineering of cohort + projection access) · Senna (security)
**Approval:** BRC
**Cadence:** On-trigger (per request)
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §6 — POPIA / Privacy Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR(IV)-08` (POPIA s.23) | Data-subject right of access. |
| `ORG-PR(IV)-09` (POPIA s.24) | Data-subject right of correction / deletion. |
| `ORG-PR(IV)-10` (POPIA s.71) | Limit automated decision-making; right to challenge. |
| `ORG-PR(IV)-04` (POPIA s.15) | Further-processing limitation context. |
| `ORG-PR(IV)-13` (POPIA Reg. 4) | Information Officer addresses data-subject requests. |

## 3. Purpose

Receive, authenticate, fulfil, and respond to data-subject requests under POPIA s.23 (access), s.24 (correction / deletion), and s.71 (automated decision challenge), within statutory timing and with privacy and security discipline.

## 4. Trigger

A `DataSubjectRequestReceived` event from any authorised channel:

- Self-service portal (post customer onboarding).
- Email to a published privacy address.
- PAIA / POPIA written request.
- Information Regulator forwarding a request.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Capture the request with type (access / correction / deletion / objection / automated-decision-challenge) | `system` (channel intake) → `human` (Iris triage) | `@domains/privacy/dsar-intake` (`PLANNED`) | Event: `DataSubjectRequestReceived { subject_id, request_type, channel, received_at }`. |
| 2 | Authenticate the data subject (proportionate to the sensitivity of the request) | `system` + `human` (Iris) | `@platform/identity/dsar-auth` (`PLANNED`) | Strong auth for active customers; doc-based verification for non-customers. Event: `DataSubjectAuthenticated`. |
| 3 | Identify cohort: every record across the bank that contains personal information about this subject | `system` query | `@domains/privacy/affected-cohort` (`PLANNED`) | Cohort spans: client master, transactions, KYC docs, complaints, employee record (if applicable), marketing logs, e-comms recordings. |
| 4 | Compile response per request type: access → record summary; correction → applied event; deletion → deletion event subject to retention exceptions; objection → processing-stop event; automated-decision-challenge → human-review pathway | `system` + `human` (Iris) | `@domains/privacy/response-compiler` (`PLANNED`) | Each response produces typed events and the response artefact. |
| 5 | Apply lawful exemptions where applicable (legal-hold, FIC retention obligation under s.22, regulatory tipping-off restriction) | `human` (Iris with Imani) | (decision events) | Event: `DSARExemptionApplied { request_id, basis, citation }`. |
| 6 | Generate the response artefact (PDF / structured data) — derived from the cohort projection (P6) | `system` | `@domains/privacy/response-renderer` (`PLANNED`) | Generated, not authored. Hash recorded. |
| 7 | Iris reviews and signs off the response | `human` (Iris) | (signature event) | Event: `DSARResponseApproved`. |
| 8 | Deliver to the data subject through the verified channel | `system` | `@platform/notification/data-subject` (`PLANNED`) | Event: `DSARResponseDelivered { request_id, delivered_at, channel }`. |
| 9 | If the request was a correction or deletion → propagate through projections | `system` | `@platform/event-store` ✓ + `@domains/privacy/propagation` (`PLANNED`) | Consent-withdrawal-style propagation; downstream projections respect the new state. |
| 10 | Close the request | `system` | (closure event) | Event: `DSARClosed { resolution, satisfaction_signal }`. |
| 11 | If the data subject is dissatisfied or escalates to the Regulator → engagement workflow opens | `human` (Iris) | `@domains/privacy/regulator-engagement` (`PLANNED`) | Cross-procedure to `regulator-engagement.md`. |

## 6. Reconciliation

- **Events produced:**
  - `DataSubjectRequestReceived`, `DataSubjectAuthenticated`, `DSARCohortIdentified`.
  - `DSARExemptionApplied` (per exemption invoked).
  - `DSARResponseApproved`, `DSARResponseDelivered`, `DSARClosed`.
  - For correction / deletion: typed correction or deletion events + `ConsentWithdrawn` (where applicable).
- **Reconciliation check:**
  - Every `DataSubjectRequestReceived` is followed by `DSARClosed` within statutory timing (POPIA: "as soon as reasonably possible", typically 30 days from receipt, configurable per Regulator guidance).
  - Every `DSARClosed { resolution: 'access' }` has a corresponding `DSARResponseDelivered` event.
  - Every correction / deletion event has propagated to all relevant projections (confirmed by a CI invariant that the projection state matches the event state at the as-of date).
  - Exemptions invoked are register-linked.
- **Failure mode:** statutory timing missed → escalate to Iris's deputy and CEO; potential Regulator complaint; remediation event.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Request intake events | Event log | Permanent (P1) | High (PII) |
| Authentication evidence | Event log + auth-system audit | 7 years | High |
| Cohort identification + projection snapshot | Event log + signed snapshot | Permanent | Critical (PII) |
| Response artefact (PDF / data export) | Document store with hash in event log | 5 years post-closure | High (PII) |
| Exemption decisions and reasoning | Event log | Permanent | High |
| Regulator-engagement records | Document store + event log | Permanent | High |

## 8. Manual steps

- **Step 2** (authentication) — Iris's judgement on proportionality.
- **Step 4** (response compilation) — automated where possible; human curation for complex requests.
- **Step 5** (exemption assessment) — Iris with Imani (legal); judgement on lawful exemption.
- **Step 7** (Iris sign-off) — required for every response (regulator credibility).
- **Step 11** (Regulator engagement) — diplomatic; cross-functional with Zara.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Authentication fails repeatedly | Auth-system events | Risk-based denial; documented; appeal pathway via Iris |
| Cohort identification incomplete | Iris's review | Anya engineering escalation; over-scope-and-redact the response |
| Exemption mis-applied | Vera review or Regulator complaint | Iris + Imani + Zara; potential remediation event |
| Statutory deadline missed | Timer event | CEO + Helena; Regulator engagement |
| Correction / deletion fails to propagate | CI invariant | Atlas + Anya; consent-withdrawal-style replay |
| Tipping-off concern (FIC overlap) | Zara's case-routing | Restricted disclosure per FIC Act s.29(3) |

## 10. Related procedures

- `popia-breach-notification.md` — adjacent privacy procedure.
- `paia-request-handling.md` (`PLANNED`) — PAIA pathway for non-personal-information records.
- `consent-management.md` (`PLANNED`) — consent capture and withdrawal at customer level.
- `retention-disposal.md` (`PLANNED`) — interaction with deletion requests.
- `model-validation.md` (`PLANNED`) — automated-decision-challenge interaction with Tier 1 model validation.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Iris + Anya + Senna | Initial draft, pre-board reviewed under POPIA / Privacy Policy. |

## 12. Audit / assurance

- Vera samples DSAR responses quarterly; cohort completeness, exemption discipline, and timing all tested.
- Annual rehearsal of a DSAR including correction and deletion variants.
- Continuous-controls projection: median time-to-respond and exemption-invocation rate reported to BRC and S&E quarterly.
