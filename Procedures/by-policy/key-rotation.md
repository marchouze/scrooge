# Procedure — Key Rotation

**Procedure ID:** PROC-IS-KR-01
**Owner:** Senna (Chief Information Security Officer, governance) · Devon (Chief Operating Officer, engineering)
**Version:** v1.0 — 2026-05-13
**Status:** STUB
**Source policy:** [Information Security and IT Governance Policy v1](../../Policies/information-security-it-governance-policy-v1.md)
**Applies-at:** LICENCE-BIND

## Source regulations

| Regulation | Section | Obligation |
|------------|---------|------------|
| Banks Act 94 of 1990 | s78 | Operational risk management — adequate controls over IT systems, including cryptographic key management, to mitigate operational risk. |
| PA Directive D3/2016 | IT Controls | IT governance controls for banks: key management, HSM requirements, audit trails for cryptographic operations. |
| Joint Standard 2/2024 (PA + FSCA Cybersecurity) | s5–s7 | Cybersecurity framework: cryptographic controls, key lifecycle management, HSM usage, audit logging of cryptographic events. |
| POPIA Act 4 of 2013 | s19–s22 | Security safeguards: responsible party must secure personal information against loss, damage or unlawful access — adequate encryption and key management is a required safeguard. |

## Purpose

Ensure that every cryptographic key in use at the bank is rotated on schedule or on demand, that no key overstays its maximum validity period, that all key-material generation and retirement occurs within the HSM and is fully audit-trailed, and that dependent services are updated and verified before any key is retired. This procedure operationalises the cryptographic key lifecycle (generate → activate → rotate → retire → destroy/archive) and feeds the key-rotation register maintained by Senna (CISO, governance).

## Trigger

- **Scheduled — HSM root keys:** Annual rotation (last business day of the calendar year, or per HSM vendor attestation cycle, whichever is earlier).
- **Scheduled — signing keys (mTLS certificates, code-signing):** 90-day rotation (automated scheduler fires at 08:00 SAST on the 85th day of validity, giving a 5-day overlap window).
- **Scheduled — encryption keys (data-at-rest, backup encryption):** 180-day rotation (automated scheduler fires at 08:00 SAST on the 170th day of validity).
- **Scheduled — API keys (external counterparties, internal service-to-service):** 90-day rotation (automated scheduler fires at 08:00 SAST on the 85th day of validity).
- **On-demand — key compromise suspected:** Immediate rotation triggered by Senna on receipt of a `KeyCompromiseSuspected` alert or security-incident escalation from `incident-response.md`.
- **On-demand — staff / agent departure:** Triggered by `EmployeeOffboarded` or `AgentRetired` events where the departing principal had access to key-material (see `access-provisioning.md` Sub-flow C, Step L3).
- **On-demand — audit finding:** Triggered by a Vera finding or external audit recommendation requiring early rotation.

## Steps

| # | Action | Actor | System capability | Notes |
|---|--------|-------|-------------------|-------|
| KR1 | Identify keys due for rotation: query the key-rotation register for keys whose `valid_until` ≤ (today + 10 days) OR keys flagged `compromised` OR keys linked to a departing principal. | `system` | `@platform/hsm/key-registry` (`PLANNED`) | For scheduled runs, the agent scheduler fires this query automatically. For on-demand runs, Senna initiates manually with a reason code. |
| KR2 | Classify each identified key by type (HSM root, signing, encryption, API). Confirm the rotation policy parameters: new key algorithm, key length, validity period, HSM slot assignment. | Senna (agent) | `@platform/hsm/key-policy` (`PLANNED`) | Key classification determines the HSM partition and access controls for the new key material. API keys for external counterparties require bilateral-notification flag set. |
| KR3 | Emit `KeyRotationInitiated { key_id, key_type, rotation_reason, initiated_by, initiated_at, scheduled_retirement_at }` event. | `system` | `@platform/event-store` ✓ | This event opens the rotation record. Downstream steps must complete before the `scheduled_retirement_at` timestamp. |
| KR4 | Generate new key material inside the HSM (hardware-bound; no key material ever leaves the HSM in plaintext). Record the new key's HSM slot reference, algorithm, and validity window. Emit `KeyMaterialGenerated { new_key_id, key_type, hsm_slot_ref, algorithm, valid_from, valid_until, generated_at }` event. | `system` (HSM agent) | `@platform/hsm/key-generation` (`PLANNED`) | Key generation must occur within the bank's certified HSM. For root keys, a dual-control ceremony is required (Senna + Devon). The ceremony is logged in the HSM audit log. |
| KR5 | For HSM root key rotation: conduct dual-control ceremony — Senna (CISO) and Devon (IT ops engineer) are both present; HSM requires two-of-N authentication to activate the new root key. | Senna (agent) + Devon (agent) | `@platform/hsm/ceremony` (`PLANNED`) | Dual-control is a hard requirement for root key generation. The HSM records each custodian's authentication token reference. |
| KR6 | Update key references in the secrets store: replace the `active_key_ref` pointer for the relevant key type with the new key's HSM slot reference. Ensure the old key reference is preserved in `retiring_key_ref` for the transition window. | `system` | `@platform/secrets/key-ref-update` (`PLANNED`) | The transition window allows dependent services to pick up the new key before the old key is retired. Default overlap: 24 hours (API keys), 48 hours (signing keys), 72 hours (encryption keys). |
| KR7 | Notify dependent services of the new key reference. Each dependent service performs a health-check confirming it can decrypt/verify with the new key. | `system` | `@platform/secrets/service-notification` (`PLANNED`) | Services that fail health-check within the overlap window are escalated to Devon immediately. Escalation blocks retirement of the old key. |
| KR8 | Emit `KeyActivated { new_key_id, key_type, activated_at, dependent_services_confirmed }` event. The new key is now the active key for all operations. | `system` | `@platform/event-store` ✓ | `dependent_services_confirmed` lists each service that returned a successful health-check. Incomplete confirmation = blocked retirement. |
| KR9 | For API keys with external counterparty exposure: notify counterparty of the key rotation and provide the new key fingerprint / public component via the agreed secure channel. Await counterparty acknowledgement. | Senna (agent) | Manual (bilateral notification) | SLA for counterparty acknowledgement: 5 business days. If no acknowledgement, escalate to the relationship owner (Imani or Saskia). |
| KR10 | Retire the old key: mark it `retired` in the key-rotation register; if policy specifies destruction (key type: signing, API), schedule HSM destruction; if policy specifies archive (key type: encryption, root), move to the HSM archive partition with restricted access. Emit `KeyRetired { old_key_id, key_type, retirement_method, retired_at }` event. | Devon (agent) | `@platform/hsm/key-retirement` (`PLANNED`) | Encryption keys are archived (not destroyed) to support decryption of data encrypted under the old key during the retention window. Root keys follow the HSM vendor's key-archiving procedure. |
| KR11 | Update the key-rotation register: record the new key ID, validity window, rotation reason, ceremony log reference (if applicable), and link to the `KeyRotationInitiated` / `KeyRetired` events. | Senna (agent) | `@platform/hsm/key-registry` (`PLANNED`) | The register is the operational record; events are the canonical record (Principle 1). |

## Reconciliation

**Events emitted:**

- `KeyRotationInitiated { key_id, key_type, rotation_reason, initiated_by, initiated_at, scheduled_retirement_at }` — opens the rotation record.
- `KeyMaterialGenerated { new_key_id, key_type, hsm_slot_ref, algorithm, valid_from, valid_until, generated_at }` — new key material created in HSM.
- `KeyActivated { new_key_id, key_type, activated_at, dependent_services_confirmed }` — new key active; all dependents confirmed.
- `KeyRetired { old_key_id, key_type, retirement_method, retired_at }` — old key retired (destroyed or archived).

**Invariants:**

- No key's `valid_until` timestamp may be exceeded without a corresponding `KeyRotationInitiated` event being open (i.e., rotation must begin before expiry, not after).
- Every `KeyRetired` event must be preceded by a `KeyActivated` event for the successor key — a key may not be retired without a confirmed active successor.
- Every `KeyMaterialGenerated` event for an HSM root key must have a corresponding dual-control ceremony record in the HSM audit log naming two distinct custodians.
- Every active key in the key-rotation register has a registered `valid_until` date; no key is `valid_until = null` (unlimited validity is prohibited).
- The `KeyActivated` event's `dependent_services_confirmed` list must be non-empty; rotation may not complete without at least one dependent-service health-check confirmation.
- No raw key material (private key, symmetric key bytes) appears in any event payload; only HSM slot references and public components are recorded in the event log.

**Failure mode:** If a dependent service fails to confirm the new key within the overlap window, the old key retirement is blocked and an incident is opened per `incident-response.md`. If HSM key generation fails, Senna is paged immediately and a manual investigation begins — no rotation is marked complete until `KeyMaterialGenerated` is emitted.

## Evidence and artefacts

| Artefact | Format | Retention | Location |
|----------|--------|-----------|----------|
| Key-rotation events (`KeyRotationInitiated`, `KeyMaterialGenerated`, `KeyActivated`, `KeyRetired`) | Event log | Permanent (Principle 1) | `@platform/event-store` |
| HSM audit log (per-ceremony and per-operation entries) | HSM-vendor structured log | 7 years (PA D3/2016) | HSM vendor log store + offline archive |
| Key-rotation register | Structured register (markdown + event projections) | 7 years | `@platform/hsm/key-registry` |
| Dual-control ceremony record (root key rotations) | HSM log entry + Senna sign-off | 7 years | HSM audit log, cross-referenced in event store |
| Counterparty acknowledgement records (API key rotations) | Email / secure message | 5 years | Document store (`Owner Inbox/` pre-RMS; RMS document register post-Phase-1) |
| Dependent-service health-check log | Structured JSON | 2 years | `@platform/secrets/service-notification` log |

## Manual steps

- **KR5 (dual-control ceremony for HSM root key):** Senna and Devon must both be present (physically or via HSM-vendor remote-authentication where supported). This step cannot be automated.
- **KR9 (counterparty notification for API keys):** Bilateral communication with external counterparties requires Senna or the relationship owner to send and confirm receipt via the agreed channel. Cannot be fully automated until counterparties support automated key-exchange APIs.
- **On-demand (key-compromise response):** Senna makes the judgement call on compromise severity and initiates emergency rotation; this is not fully automatable.

## Failure modes and escalation

| Failure | Escalation path | SLA |
|---------|-----------------|-----|
| Key expires without rotation initiated | Scheduled monitor alerts Senna + Devon; key flagged critical in key-rotation register | Immediate — key must be rotated within 4 hours of expiry detection |
| HSM key generation failure | Senna paged; Devon investigates HSM health; incident opened per `incident-response.md` | 1 hour response; 4 hours to resolution |
| Dependent service fails health-check on new key | Devon investigates service; old key retirement blocked; escalation to Atlas if platform issue | 4 hours to resolution; old key remains active until successor confirmed |
| Dual-control ceremony quorum not met (root key) | Rotation postponed; Senna notifies EXCO; alternative custodian nominated | Next business day unless emergency |
| Counterparty fails to acknowledge API key rotation within 5 business days | Senna escalates to relationship owner (Imani / Saskia); legal review if contract requires specific notice | 5-day acknowledgement SLA; old key remains active until confirmed |
| Retired key found still in use by a service | Senna + Devon immediate investigation; service escalated to Atlas; incident filed | Immediate |
| Key-rotation register out of sync with event log | Vera finding raised; Senna reconciles within 1 business day | 1 business day |

## Related procedures

- `access-provisioning.md` — Sub-flow C (Leaver) triggers on-demand key rotation when a departing principal held key-material access.
- `incident-response.md` — escalation target for key-compromise incidents and rotation failures.
- `secure-sdlc.md` — cryptographic requirements governing key algorithm selection and minimum key lengths.
- `change-management.md` — secrets-store updates that reference new key IDs are subject to change-management controls.

## Change log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | 2026-05-13 | Atlas (Core banking platform architect, engineering) | Initial stub; all 9 sections populated; system capabilities `PLANNED`; dual-control ceremony and 4 key types specified. |
