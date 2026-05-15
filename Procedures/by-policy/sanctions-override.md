# Procedure — Sanctions override (MLRO exception)

**Procedure ID:** PROC-FC-SO-01
**Owner:** Zara (Chief Compliance Officer, governance) — MLRO
**Approval:** Board (Sanctions Policy is Board-reserved; override authority is statutory MLRO)
**Cadence:** Event-triggered (per override petition; expected to be rare)
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §3 — Sanctions Policy.
`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §4 — RMCP (Risk Management and Compliance Programme).
`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §4 — AML/CFT Policy.
RAS B4 (CEO approved 2026-05-06): zero appetite for sanctions exposure; production override requires MLRO signed event.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-13` (UN/OFAC/EU/UK HMT/POCDATARA + RAS B4) | Block all true-positive sanctions matches pre-execution. Override authority restricted to the named MLRO; no other actor may authorise a sanctions override. |
| `ORG-FC-14` (POCDATARA ss.25–26 + FIC Act s.26B) | Targeted Financial Sanctions (TFS) obligations: any freeze of designated-person/entity property must not be lifted by the bank on its own authority. Controlled-exit or unfreeze requires prior authorisation from DPCI/FIC; the bank cannot self-authorise a TFS override. |
| `ORG-FC-08` (FIC Act s.28A + POCDATARA s.28) | Property Association Reports: if the bank holds or controls property associated with a sanctioned entity, it must file a report with the FIC within 5 business days of becoming aware. |
| `ORG-FC-03` (FIC Act s.29(3)) | Tipping-off prohibition: the bank must not disclose to the client or a third party that an investigation or review is under way in a manner that could prejudice a criminal investigation. All override proceedings are handled under strict information-barrier controls. |

## 3. Purpose

Govern the narrow, rare set of circumstances where the MLRO concludes that a sanctions screening block (`ScreeningHit { action: BLOCK }`) produced by `sanctions-screening.md` (PROC-FC-02) requires an override. Two override types are recognised:

1. **False-positive override** — the MLRO determines, on the basis of independent identity evidence, that the matched subject is not the designated person or entity (e.g., a different individual with the same name; a data error in the list). The block is lifted for this specific transaction or onboarding event; the MLRO signs the override event.

2. **Controlled-exit override** — an existing client has become a designated party (new designation post-onboarding). The bank cannot simply freeze and walk away; it must execute a controlled relationship wind-down. Specific transactions required to return the client's own funds to a permitted account, or to close open positions in a legally compliant manner, may be authorised on a transaction-by-transaction basis. Each such authorisation requires prior DPCI/FIC notification and written confirmation (or, where FIC response time exceeds the exit timeline, documented legal-advice justification).

Override is never permissible to facilitate a new, commercially motivated transaction for a confirmed true-positive sanctioned party. This is a zero-tolerance absolute prohibition encoded in RAS B4 and enforced at the cryptographic layer — the platform refuses any `ScreeningOverride` event that is not signed by the MLRO's registered agent identity.

## 4. Trigger

Event: **`ScreeningHit { action: BLOCK }`** has been emitted by `sanctions-screening.md` (PROC-FC-02) for a specific subject (transaction counterparty, client, UBO, or onboarding candidate), AND one of the following is true:

- The screener (Mira investigator or MLRO) has determined the match may be a false positive and wishes to petition for override; OR
- An existing client has been newly designated and a controlled-exit requires individual transaction authorisations.

The override petition must be initiated by Mira (investigator) or the MLRO directly. No other actor may initiate an override petition — the platform refuses `ScreeningOverridePetitioned` events from other actor identities.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Verify a `ScreeningHit { action: BLOCK }` exists in the event log for the subject | `system` (auto-check on petition creation) | `@platform/event-store` ✓ | Override without a preceding block for the same subject is a data-integrity error; the platform rejects the petition. |
| 2 | Determine override type: false-positive or controlled-exit | `human` (Mira investigator or Zara/MLRO) | `@domains/screening/case-mgmt` (`PLANNED`) | Emit `ScreeningOverridePetitioned { case_id, subject_id, override_type: false_positive | controlled_exit, requestor, rationale_summary }`. |
| 3a | **False-positive path — evidence gathering:** MLRO (or delegated analyst under MLRO supervision) obtains at least two independent identity-verification sources confirming the subject is not the designated party | `human` (Zara/MLRO + Mira under supervision) | `@domains/onboarding/verify` (`PLANNED`) + `@platform/document-store` (`PLANNED`) | Acceptable independent sources: government biometric ID + company-registry extract; or MLRO-approved third-party identity report. Single-source evidence is insufficient. Each source is lodged as a `DocumentLodged` event citing the `case_id`. |
| 3b | **Controlled-exit path — FIC/DPCI notification:** MLRO notifies the Financial Intelligence Centre and DPCI of the designation and the bank's intended exit steps within **5 business days** of becoming aware of the designation | `human` (Zara/MLRO) | `@domains/fic-reporting` (`PLANNED`) | Notification is filed as a `FICNotificationFiled { case_id, notification_type: tfs_designation_aware, reference }` event. If FIC provides a written authorisation reference, it is recorded. |
| 4a | **False-positive — MLRO review and sign-off:** MLRO reviews the two independent sources; documents the rationale in full; signs the override | `human` (Zara/MLRO) | `@platform/event-store` ✓ + `@platform/screening/override-authority` (`PLANNED`) | Emit `ScreeningOverride { case_id, override_type: false_positive, subject_id, signed_by: mlro_identity, rationale_doc_hash, list_version_hash }`. The override is irrevocable and permanent in the event log. The platform cryptographically verifies that `signed_by` matches the MLRO's registered agent identity; any other identity is rejected at runtime. |
| 4b | **Controlled-exit — per-transaction MLRO authorisation:** for each transaction in the exit plan, MLRO individually authorises; cites the FIC reference (or legal-advice document hash if FIC response is overdue) | `human` (Zara/MLRO) | `@platform/event-store` ✓ + `@platform/screening/override-authority` (`PLANNED`) | Each transaction produces a `ScreeningOverride { case_id, override_type: controlled_exit, transaction_id, signed_by: mlro_identity, fic_reference?, legal_advice_hash? }`. No transaction may proceed without its individual override event. |
| 5 | Unblock the specific transaction or onboarding event for which the override was granted | `system` | `@platform/screening/api` (`PLANNED`) | The override lifts the block only for the cited `transaction_id` or `subject_id` context. Any subsequent transaction against the same subject requires its own screening and, if blocked, its own override. |
| 6 | **Controlled-exit: file Property Association Report (PAR) with FIC within 5 business days of first becoming aware** | `human` (Zara/MLRO) | `@domains/fic-reporting/par` (`PLANNED`) | Required by `ORG-FC-08`. Emit `FICPARFiled { case_id, fic_reference, filed_timestamp }`. |
| 7 | **Controlled-exit: close open positions and return client funds** | `system` (authorised transactions) → `human` (Zara sign-off on each) | `@domains/client/lifecycle` (`PLANNED`) | Each exit transaction is individually authorised (Step 4b). Once all positions are closed and funds returned, emit `KYCRelationshipExitTriggered { case_id, client_id, reason: sanctions_designation }`. |
| 8 | Close override case; record outcome; flag for Vera quarterly audit | `system` | `@domains/screening/case-mgmt` (`PLANNED`) | Emit `ScreeningOverrideCaseClosed { case_id, override_type, outcome }`. The closed case is automatically queued in Vera's next quarterly audit sample. |
| 9 | Post-override monitoring: if the subject appears in any subsequent screening event, the system flags the prior override context to the screener | `system` | `@platform/screening/match-engine` (`PLANNED`) | Prevents inadvertent re-screening without awareness of the override history. |

## 6. Reconciliation

- **Events produced (in-order per case):**
  1. `ScreeningHit { action: BLOCK }` — prerequisite; produced by `sanctions-screening.md`
  2. `ScreeningOverridePetitioned { case_id, subject_id, override_type, requestor, rationale_summary }` — petition opened
  3. (False-positive) `DocumentLodged { case_id, source_description }` × 2 (minimum two independent sources)
  4. (Controlled-exit) `FICNotificationFiled { case_id, notification_type: tfs_designation_aware }` — FIC/DPCI notified
  5. `ScreeningOverride { case_id, override_type, signed_by: mlro_identity, ... }` — MLRO sign-off; one per transaction for controlled-exit
  6. (Controlled-exit) `FICPARFiled { case_id }` — Property Association Report
  7. (Controlled-exit) `KYCRelationshipExitTriggered { case_id, client_id }` — relationship fully wound down
  8. `ScreeningOverrideCaseClosed { case_id, override_type, outcome }` — case closed
- **Reconciliation invariants:**
  - **Every `ScreeningOverride` must have a preceding `ScreeningHit { action: BLOCK }` for the same `subject_id`.** An override without a block is a data-integrity error; the event store rejects the event.
  - Every `ScreeningOverride` must carry a `signed_by` value that matches the MLRO's registered agent identity in the agent registry. The cryptographic gate is a CI-tested invariant.
  - Every `controlled_exit` override must have a `FICNotificationFiled` event with a timestamp no later than 5 business days after the `ScreeningHit` that established the bank's awareness.
  - Every `controlled_exit` override case must terminate in a `KYCRelationshipExitTriggered` event; a controlled-exit override that does not result in exit is a data-integrity anomaly escalated to Vera.
  - No `false_positive` override is issued for the same `subject_id` more than once in a rolling 12-month period without Vera review (repeat false-positive pattern = screening-quality investigation trigger).
- **Failure mode:** override-authority service unavailable → the block stands; no transaction can proceed; Mira notified immediately; MLRO authorises via out-of-band channel which Mira then records manually via CLI event-injection (break-glass procedure, documented in `incident-response.md`).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ScreeningOverridePetitioned` events | Event log | Permanent (Principle 1) | Critical |
| `ScreeningOverride` events (immutable) | Event log | Permanent | Critical |
| Independent identity-verification sources (false-positive path) | Document store; encrypted at rest | 5 years post-decision (FIC s.22) | High (PII) |
| MLRO rationale document (full) | Document store; field-level encrypted; BLAKE3 hash anchored in event | 7 years post-decision | Critical |
| `FICNotificationFiled` events + FIC acknowledgement references | Event log + document store | Permanent | High |
| `FICPARFiled` events + PAR acknowledgement | Event log + document store | Permanent | High |
| Controlled-exit transaction records | Event log (one `ScreeningOverride` per transaction) | Permanent | Critical |
| `ScreeningOverrideCaseClosed` events | Event log | Permanent | High |
| Tipping-off information-barrier audit trail | Operational log | 5 years | High |

## 8. Manual steps

- **All steps involving MLRO review and sign-off (Steps 3a, 4a, 4b):** the Sanctions Policy and FIC Act prohibit any actor other than the named MLRO from authorising a sanctions override. This is a non-delegable statutory duty. The platform enforces this at the cryptographic layer (Step 4a/4b notes); the MLRO personally reviews and signs.
- **Step 3a (independent source gathering):** Mira may gather the sources under MLRO supervision; the judgement of adequacy (are these truly independent? do they conclusively differentiate the subject from the designated party?) is the MLRO's non-delegable assessment.
- **Step 3b (FIC/DPCI notification):** the MLRO personally files or directly authorises the filing. The bank has no discretion on whether to notify FIC of a TFS designation; the obligation is mandatory under `ORG-FC-14`.
- **Step 6 (PAR filing):** mandatory; no automation replaces the MLRO's review and sign-off on the Property Association Report content.
- **Step 7 (exit execution):** individual transaction-level MLRO authorisation required for each exit transaction in the controlled-exit plan.

All manual steps produce typed events with the actor's agent identity under Principle 6. No manual step is permitted to leave a gap in the event chain.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Override attempted without MLRO signature | Cryptographic gate rejects event; alert emitted | Auto-event to Vera and BRC; MLRO informed immediately; Vera investigates |
| Override without a preceding `ScreeningHit { action: BLOCK }` | Event-store invariant check rejects | Auto-event to Vera; treated as a data-integrity incident |
| FIC notification not filed within 5 business days (controlled-exit) | Projection SLA monitor | Zara (MLRO) immediately; BRC informed; legal counsel engaged if FIC is not notified in time |
| PAR not filed within 5 business days of awareness | Projection SLA monitor | MLRO immediately; Vera finding; BRC escalation |
| Override-authority service unavailable | Health-check alert | Mira immediately; break-glass procedure invoked (see `incident-response.md`); block remains in force until service restored or break-glass event recorded |
| False-positive override for same subject > 1 in 12 months | Vera quarterly audit query | Vera finding → screening quality review (Helena model-risk); BRC report |
| Strong match incorrectly overridden on re-screen by Vera | Vera periodic re-screen | Vera finding → MLRO → BRC; FIC engagement if needed; potential regulatory notification |
| Tipping-off breach (case details disclosed to subject) | Information-barrier audit log | MLRO + Senna (CISO) immediately; FSCA/PA notification if required; FIC informed |

## 10. Related procedures

- `sanctions-screening.md` (PROC-FC-02) — upstream procedure that produces the `ScreeningHit { action: BLOCK }` event that is the mandatory prerequisite for any override petition; owns the screening engine and list-integrity attestation.
- `kyc-continuous.md` (PROC-FC-KYC-C-01) — routes Critical-severity sanctions-hit cases to MLRO; may trigger the controlled-exit path of this procedure for newly designated existing clients.
- `str-filing.md` (PROC-FC-STR-01) — STR/TPR filing runs in parallel with override determination for confirmed true-positive cases where STR obligations are triggered; not blocked by the override proceeding.
- `incident-response.md` — break-glass procedure for override-authority service unavailability (Step 8 of this procedure).
- `kyc-onboarding.md` (PROC-FC-01) — onboarding candidates blocked by a sanctions match follow this procedure's false-positive path if the MLRO determines the match is a false positive; otherwise the candidate is rejected under `kyc-onboarding.md` Step 8b.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Zara (Chief Compliance Officer, governance) · Mira (Regulatory intelligence engineer, compliance) | Initial stub. All 9 sections drafted covering both override types (false-positive and controlled-exit). System capabilities PLANNED. Pending Board review and approval (Sanctions Policy is Board-reserved). |
| v0.2 | 2026-05-15 | Zara (Chief Compliance Officer, governance) + Mira (Regulatory intelligence engineer, compliance) | Promoted to POPULATED — all 12 sections verified complete. |

## 12. Audit / assurance

Vera (Internal audit engineer, engineering) reviews every `ScreeningOverride` event at each quarterly audit cycle. Vera's checks:

1. Confirm the `ScreeningOverride` event carries a valid MLRO cryptographic signature.
2. Confirm a `ScreeningHit { action: BLOCK }` exists in the event log for the same `subject_id` with an earlier timestamp.
3. For false-positive overrides: confirm at least two `DocumentLodged` events with distinct sources are linked to the `case_id`.
4. For controlled-exit overrides: confirm `FICNotificationFiled` timestamp is within 5 business days of the `ScreeningHit` that established awareness; confirm `FICPARFiled` is present; confirm `KYCRelationshipExitTriggered` closes the case.
5. Confirm no subsequent commercially motivated transaction succeeded for the same `subject_id` after a `controlled_exit` override.

All Vera findings from override review are reported to BRC. A pattern of overrides for the same counterparty across a 12-month window triggers a `ScreeningOverrideAuditFlagged { case_id, pattern_count }` event and a formal BRC report. A single confirmed true-positive override issued without MLRO signature, or without a preceding block, is an immediate Tier-0 incident escalated to the Board and, where required, to the Prudential Authority and FIC.
