---
id: PROC-IS-KR-01
policy-parent: — Information Security and IT Governance Policy (primary)
last-reviewed: 2026-05-15
status: POPULATED
---
# Procedure — Key Rotation

**Procedure ID:** PROC-IS-KR-01
**Owner:** Rashida (Chief Information Security Officer, governance) · Devon (Chief Operating Officer)
**Approval:** BRC
**Cadence:** Scheduled (HSM root CA = annual; signing/API keys = 90 days; encryption keys = 180 days) + on-trigger (compromise, departing principal, or audit finding)
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

`Policies/information-security-it-governance-policy-v1.md` — Information Security and IT Governance Policy (primary).
Cryptographic key lifecycle (generate → activate → rotate → retire → destroy/archive) is a named control obligation within the policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-IS-01` (Banks Act 94 of 1990 s.78) | Operational risk management — adequate controls over IT systems, including cryptographic key management, to mitigate operational risk. |
| `ORG-IS-04` (PA Directive D3/2016 IT Controls) | IT governance controls for banks: key management, HSM requirements, and audit trails for cryptographic operations. |
| `ORG-IS-05` (Joint Standard 2 of 2024 — PA + FSCA Cybersecurity, s.5–7) | Cybersecurity framework: cryptographic controls, key lifecycle management, HSM usage, audit logging of all cryptographic events. |
| `ORG-PR-04` (POPIA Act 4 of 2013, s.19–22) | Security safeguards: responsible party must secure personal information against loss, damage or unlawful access — adequate encryption and key management is a required safeguard. |

## 3. Purpose

Ensure that every cryptographic key in use at the bank is rotated on schedule or on demand, that no key overstays its maximum validity period, that all key-material generation and retirement occurs within the HSM and is fully audit-trailed, and that dependent services are updated and verified before any key is retired. This procedure operationalises the cryptographic key lifecycle and feeds the key-rotation register maintained by Rashida (Chief Information Security Officer, governance). The procedure also defines the emergency rotation path for suspected key compromise, which must resolve to a confirmed `KeyRotated` event within four hours of the compromise signal.

## 4. Trigger

- **Scheduled — HSM root keys:** Annual rotation (last business day of the calendar year, or per HSM vendor attestation cycle, whichever is earlier).
- **Scheduled — signing keys (mTLS certificates, code-signing):** 90-day rotation. Automated scheduler fires at 08:00 SAST on day 85 of validity, giving a 5-day overlap window.
- **Scheduled — encryption keys (data-at-rest, backup encryption):** 180-day rotation. Automated scheduler fires at 08:00 SAST on day 170 of validity.
- **Scheduled — API service keys (external integrations, internal service-to-service):** 90-day rotation. Automated scheduler fires at 08:00 SAST on day 85 of validity.
- **On-demand — key compromise suspected:** Immediate rotation triggered by Senna on receipt of a `KeyCompromiseSuspected` alert or security-incident escalation from `incident-response.md`. All affected keys must be rotated within 4 hours.
- **On-demand — staff / agent departure:** Triggered by `EmployeeOffboarded` or `AgentRetired` events where the departing principal held access to key-material (see `access-provisioning.md` Sub-flow C, Step L3).
- **On-demand — audit finding:** Triggered by a Vera finding or external audit recommendation requiring early rotation.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Identify keys due for rotation: query the key-rotation register for keys whose `valid_until` ≤ (today + 10 days), or keys flagged `compromised`, or keys linked to a departing principal. Emit `KeyRotationScheduled { key_id, key_type, rotation_date, trigger_reason }` for each identified key. | `system` (scheduled) / `Senna` (on-demand) | `@platform/hsm/key-registry` (`PLANNED`) | For scheduled runs the agent scheduler fires this query automatically. For on-demand runs Senna initiates with a reason code. |
| 2 | Classify each identified key by type (HSM root, signing, encryption, API). Confirm rotation-policy parameters: new key algorithm, key length, validity period, HSM slot assignment, bilateral-notification flag (for API keys with external counterparty exposure). | `Senna` | `@platform/hsm/key-policy` (`PLANNED`) | Key classification determines the HSM partition and access controls for the new key material. |
| 3 | Emit `KeyRotationInitiated { key_id, key_type, rotation_reason: scheduled \| on_demand, initiated_by, initiated_at, scheduled_retirement_at }`. This event opens the rotation record; all subsequent steps must complete before `scheduled_retirement_at`. | `system` | `@platform/event-store` ✓ | For compromise rotations, `rotation_reason: on_demand` and `scheduled_retirement_at` is set to 4 hours from `initiated_at`. |
| 4 | Generate new key material inside the HSM (hardware-bound; no key material ever leaves the HSM in plaintext). Record the new key's HSM slot reference, algorithm, and validity window. Emit `KeyMaterialGenerated { new_key_id, key_type, hsm_slot_ref, algorithm, valid_from, valid_until, generated_at }`. | `system` (HSM agent) | `@platform/hsm/key-generation` (`PLANNED`) | Key generation must occur within the bank's certified HSM. For HSM root keys, a dual-control ceremony (Step 5) is required before this step is considered complete. |
| 5 | **HSM root key and code-signing key rotations only — dual-control ceremony:** Senna and Devon both authenticate into the HSM; HSM requires two-of-N authentication to activate the new root key. Ceremony is video-logged; log hash is stored in the HSM audit log and cross-referenced in the event. Emit `KeyRotationCeremonyCompleted { key_id, witnesses: ["senna", "devon"], ceremony_hash, completed_at }`. | `Senna` + `Devon` | `@platform/hsm/ceremony` (`PLANNED`) | Dual-control is a hard requirement. If either custodian is unavailable, rotation is postponed and Senna notifies EXCO. A backup custodian must be nominated before the key's `valid_until` date. |
| 6 | Update key references in the secrets store: replace the `active_key_ref` pointer for the relevant key type with the new key's HSM slot reference. Preserve the old key reference in `retiring_key_ref` for the transition (overlap) window. Default overlap windows: API keys 24 hours; signing keys 48 hours; encryption keys 72 hours; root keys 7 days. | `system` | `@platform/secrets/key-ref-update` (`PLANNED`) | The overlap window allows dependent services to pick up the new key before the old key is retired. |
| 7 | Notify dependent services of the new key reference. Each dependent service performs a health-check confirming it can decrypt/verify with the new key. Services that fail health-check within the overlap window are escalated to Devon immediately; old-key retirement is blocked until all dependent services confirm. | `system` | `@platform/secrets/service-notification` (`PLANNED`) | `dependent_services_confirmed` list is built from successful health-check responses. Incomplete confirmation = blocked retirement until resolved. |
| 8 | Emit `KeyActivated { new_key_id, key_type, activated_at, dependent_services_confirmed }`. The new key is now the active key for all operations. | `system` | `@platform/event-store` ✓ | `dependent_services_confirmed` must be non-empty; rotation may not complete without at least one confirmed service health-check. |
| 9 | **API keys with external counterparty exposure only:** Notify counterparty of the key rotation and provide the new key fingerprint / public component via the agreed secure channel. Await counterparty acknowledgement. SLA: 5 business days. If no acknowledgement, escalate to the relationship owner (Imani or Saskia). | `Senna` | Manual (bilateral notification) | Old key remains active until counterparty acknowledges. For on-demand (compromise) rotations, counterparty is notified as soon as the new key is activated; the 5-day SLA still applies to formal acknowledgement. |
| 10 | Retire the old key: mark it `retired` in the key-rotation register. Apply retirement method per key type: signing keys and API keys → schedule HSM destruction; encryption keys and root keys → move to HSM archive partition with restricted access (required to decrypt data encrypted under the old key during the retention window). Emit `KeyRetired { old_key_id, key_type, retirement_method: destroyed \| archived, retired_at }`. | `Devon` | `@platform/hsm/key-retirement` (`PLANNED`) | Encryption keys and root keys are archived, not destroyed, to support decryption of historical data. Root keys follow the HSM vendor's key-archiving procedure. |
| 11 | Update the key-rotation register: record the new key ID, validity window, rotation reason, ceremony log reference (if applicable), and links to `KeyRotationInitiated` / `KeyRetired` events. Confirm the register is consistent with the event log projection. | `Senna` | `@platform/hsm/key-registry` (`PLANNED`) | The event log is canonical (Principle 1); the register is the operational read-model derived from events. Any discrepancy between register and event log is an immediate Vera finding. |

## 6. Reconciliation

- **Events produced:**
  - `KeyRotationScheduled { key_id, key_type, rotation_date, trigger_reason }` — scheduling record.
  - `KeyRotationInitiated { key_id, key_type, rotation_reason, initiated_by, initiated_at, scheduled_retirement_at }` — rotation record opened.
  - `KeyMaterialGenerated { new_key_id, key_type, hsm_slot_ref, algorithm, valid_from, valid_until, generated_at }` — new key material created in HSM.
  - `KeyRotationCeremonyCompleted { key_id, witnesses, ceremony_hash, completed_at }` — dual-control ceremony (root/signing only).
  - `KeyActivated { new_key_id, key_type, activated_at, dependent_services_confirmed }` — new key active; all dependents confirmed.
  - `KeyRetired { old_key_id, key_type, retirement_method, retired_at }` — old key retired (destroyed or archived).
  - `KeyCompromiseSuspected { key_id, source, suspected_at }` — compromise signal opening an on-demand rotation.
- **Reconciliation invariants:**
  1. No key's `valid_until` timestamp may be exceeded without a corresponding `KeyRotationInitiated` event being open — rotation must begin before expiry, not after. Overdue rotations are Vera findings.
  2. Every `KeyRetired` event must be preceded by a `KeyActivated` event for the successor key — a key may not be retired without a confirmed active successor.
  3. Every `KeyMaterialGenerated` event for an HSM root key or code-signing key must have a corresponding `KeyRotationCeremonyCompleted` event naming two distinct custodians.
  4. Every active key in the key-rotation register must have a registered `valid_until` date — unlimited-validity keys are prohibited.
  5. The `KeyActivated` event's `dependent_services_confirmed` list must be non-empty.
  6. No raw key material (private key bytes, symmetric key bytes) may appear in any event payload; only HSM slot references and public components are permitted.
  7. Every `KeyCompromiseSuspected` event must resolve to a `KeyRetired` event for the affected key within 4 hours.
- **Failure mode:** If a dependent service fails to confirm the new key within the overlap window, old-key retirement is blocked and an incident is opened per `incident-response.md`. If HSM key generation fails, Senna is paged immediately and a manual investigation begins — no rotation is marked complete until `KeyMaterialGenerated` is emitted.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Key-rotation events (`KeyRotationInitiated`, `KeyMaterialGenerated`, `KeyActivated`, `KeyRetired`) | Event log | Permanent (Principle 1) | Critical |
| `KeyRotationCeremonyCompleted` events (root/signing) | Event log | Permanent | Critical |
| `KeyCompromiseSuspected` events and linked rotation records | Event log | Permanent | Critical |
| HSM audit log (per-ceremony and per-operation entries) | HSM vendor log store + offline archive | 7 years (PA D3/2016) | Critical |
| Key-rotation register (projection of events) | `@platform/hsm/key-registry` | 7 years | Critical |
| Dual-control ceremony video log (root key rotations) | Secure offline archive + hash in event | 7 years | Critical |
| Counterparty acknowledgement records (API key rotations) | RMS Document register (post-Phase-1) / Owner Inbox (pre-RMS) | 5 years | Restricted |
| Dependent-service health-check log | `@platform/secrets/service-notification` | 2 years | Restricted |

## 8. Manual steps

- **Step 5 (dual-control ceremony for HSM root key and code-signing keys):** Senna and Devon must both authenticate into the HSM — physically co-located or via HSM-vendor remote-authentication where supported. This step cannot be automated; dual-control is a hard regulatory requirement under PA Directive D3/2016 and JS 2/2024.
- **Step 9 (counterparty notification for API keys):** Bilateral communication with external counterparties requires Senna or the relationship owner (Imani or Saskia) to send and confirm receipt via the agreed secure channel. Cannot be fully automated until counterparties support automated key-exchange APIs.
- **On-demand compromise response (Step 3 initiated by Senna):** Senna makes the professional judgement call on compromise severity and scope before initiating emergency rotation. The platform records the outcome; the initial triage is not automatable.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Key expires without rotation initiated | Scheduled monitor: `valid_until` ≤ today without open `KeyRotationInitiated`; Vera daily key-expiry recon | Senna + Devon immediately; key must be rotated within 4 hours of expiry detection; EXCO notified if root key |
| HSM key generation failure | Missing `KeyMaterialGenerated` after `KeyRotationInitiated`; HSM error log | Senna paged; Devon investigates HSM health; incident opened per `incident-response.md`; 1 hour response; 4 hours to resolution |
| Dependent service fails health-check on new key | `dependent_services_confirmed` incomplete after overlap window | Devon investigates service; old key retirement blocked; Atlas escalated if platform issue; 4 hours to resolution |
| Dual-control ceremony quorum not met (root key) | No `KeyRotationCeremonyCompleted` event before `valid_until`; Senna reports | Rotation postponed; Senna notifies EXCO; alternative custodian nominated; emergency next-business-day unless within 48 hours of `valid_until` |
| Counterparty fails to acknowledge API key rotation within 5 business days | Senna monitors acknowledgement SLA; Vera flags open outbound notifications | Senna escalates to relationship owner (Imani or Saskia); legal review if contract requires specific notice; old key remains active until confirmed |
| Retired key found still in use by a service | Vera recon: event log shows `KeyRetired` but service still referencing old `active_key_ref` | Senna + Devon immediate investigation; service escalated to Atlas; incident filed per `incident-response.md` |
| `KeyCompromiseSuspected` not resolved within 4 hours | Vera: `KeyCompromiseSuspected` without downstream `KeyRetired` within 4-hour window | Senna → Devon → EXCO same day; incident declared critical; old key quarantined pending resolution |
| Key-rotation register out of sync with event log | Vera weekly register-recon finding | Senna reconciles within 1 business day; Devon assists if HSM partition access required |

## 10. Related procedures

- `access-provisioning.md` (PROC-IS-AP-01) — Sub-flow C (Leaver) triggers on-demand key rotation when a departing principal held key-material access.
- `incident-response.md` — escalation target for key-compromise incidents and rotation failures. `KeyCompromiseSuspected` is a named incident trigger in that procedure.
- `secure-sdlc.md` — cryptographic requirements governing key algorithm selection and minimum key lengths feed the rotation-policy parameters in Step 2.
- `change-management.md` — secrets-store updates that reference new key IDs are subject to change-management controls; the key-ref-update step (Step 6) is a named change type.
- `dr-test-execution.md` (PROC-OR-DR-01) — DR test pre-test checklist (Step 2 of that procedure) requires confirmation that HSM DR key shards are accessible; Senna co-ordinates with Devon.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Atlas (Core banking platform architect, engineering) | Initial stub; all 9 sections populated; system capabilities `PLANNED`; dual-control ceremony and 4 key types specified. |
| v0.2 | 2026-05-15 | Rashida (Chief Information Security Officer, governance) + Devon (Chief Operating Officer) | Promoted to POPULATED — reformatted to 12-section canonical template; §6 invariants expanded; §7–§12 fully authored; `KeyCompromiseSuspected` event and 4-hour SLA added; `KeyRotationScheduled` and `KeyRotationCeremonyCompleted` events added. |

## 12. Audit / assurance

- **Vera daily key-expiry recon:** queries the key-rotation register projection for any key with `valid_until` ≤ (today + 10 days) and no open `KeyRotationInitiated` event; findings surfaced to Senna by 08:00 SAST.
- **Vera weekly rotation-completeness recon:** confirms that every `KeyRotationInitiated` event in the window has downstream `KeyActivated` and `KeyRetired` events; open rotations older than their scheduled overlap window are findings.
- **Vera weekly register-vs-event-log recon:** compares the key-rotation register (operational projection) against the event log (canonical); discrepancies are findings escalated to Senna within 1 business day.
- **Vera monthly ceremony-completeness check:** confirms that every `KeyMaterialGenerated` event for an HSM root key or code-signing key has a corresponding `KeyRotationCeremonyCompleted` event naming two distinct custodians; any missing ceremony record is a critical finding.
- **BRC quarterly review:** Senna presents the key-rotation status dashboard (keys rotated on schedule, overdue rotations, on-demand rotations, compromise incidents) to BRC. BRC may direct additional rotation cadences for specific key types based on threat intelligence.
- **Annual information security assurance review:** Senna's annual IS review includes the key lifecycle as a named Tier 1 control (JS 2/2024); Devon provides HSM-vendor attestation; Vera's recon history is the primary evidence base.
- **PA supervisory inspection readiness:** all key-rotation events, HSM audit logs, and ceremony records are available for PA inspection via the event store and offline archive; retrieval SLA < 5 business days.
