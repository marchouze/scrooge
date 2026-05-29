---
policy-parent: Voice & Communications Recording Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-MK-REC-01
title: Voice and electronic communications recording and retention
author: Saskia (Head of Global Markets, governance) · Senna (information security & cloud engineer) · Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Saskia (Head of Global Markets, governance) · Senna (information security & cloud engineer) · Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Voice & Communications Recording Policy (planned)
system-capability: "@platform/comms/recording-retention (PLANNED)"
---

# Procedure — Voice and electronic communications recording and retention

**Procedure ID:** PROC-MK-REC-01
**Owner:** Saskia (Head of Global Markets, governance) · Senna (information security & cloud engineer) · Sade (AgentOps & token efficiency engineer)
**Approval:** BRC + EXCO (Voice & Communications Recording Policy — planned)
**Cadence:** Continuous (recording); periodic integrity checks; retrieval on-trigger; annual attestation
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Voice & Communications Recording Policy (planned; Saskia + Senna + Zara (Chief Compliance Officer, governance) co-author; BRC + EXCO approval required before commencement of trading).
- Information Security Policy — recording infrastructure is subject to the bank's FIPS-Level-3 HSM, tamper-evident storage, and access-control requirements.
- POPIA Compliance Policy — communications recordings contain personal information (voice biometrics, names, account references) and are subject to POPIA processing obligations.

The obligation chain:

```
Regulation (FMCA s.6 + ODP licence conditions; FAIS Act s.17 — record-keeping; Banks Act s.73 — risk governance)
  → Voice & Communications Recording Policy (planned)
    → PROC-MK-REC-01 (this procedure)
      → @platform/comms/recording-retention (PLANNED)
        → Tamper-evident recording archive + retrieval for regulatory requests
```

**Build-phase posture:** Recording obligations bind at commencement of trading. The recording substrate is built and tested during the build phase against synthetic communications. At licence-day, all four channels go live and recordings become regulatory artefacts. Agent actors are the default for recording lifecycle management; human review is required only for retrieval in response to regulatory requests.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-MK-01` (FMCA s.6 + ODP conduct standard — record-keeping) | ODP must retain records of all communications relating to client orders and OTC derivative transactions for a minimum of 5 years. |
| `ORG-CD-03` (FAIS Act s.17 — record-keeping) | FSP must retain records of advice given, instructions received, and transactions executed for at least 5 years. |
| `ORG-CD-03` (GCC §3(2)(b) — communication records) | FSP must record and retain client communications where the communication relates to the giving of advice or the execution of a financial product transaction. |
| `ORG-MK-04` (CS 3/2018 §8 — OTC derivative records) | ODP must retain all records relating to OTC derivative transactions, including pre-trade communications and post-trade confirmations, for 5 years. |
| `ORG-FAIS-17` (FAIS Act s.17(1)(b) — advice record retention) | Records of advice and instructions must be retained for 5 years from the date of the advice or instruction; this applies to both voice and electronic advice channels. |
| `ORG-CD-04` (POPIA s.14–19 — data subject rights + retention limits) | Personal information in recordings may be retained only as long as necessary for the stated purpose; data subjects may request access to recordings relating to them (s.23); retention limits must be documented. |

## 3. Purpose

1. Record all voice and electronic communications that relate to client orders, financial product advice, and OTC IRD or JSE transaction execution across all mandatory channels.
2. Store recordings in a tamper-evident, integrity-controlled archive that satisfies FMCA, FAIS Act, and ODP licence conditions.
3. Apply differentiated retention periods: 5 years for OTC derivatives and FMCA-regulated communications; 7 years for FAIS Act advice records (where the longer period applies).
4. Provide a structured retrieval pathway for regulatory requests (FSCA, SARB, JSE) and internal audit access, with human review and approval before any retrieval is fulfilled.
5. Conduct annual compliance attestation confirming that the recording regime is operational, all channels are covered, and no recordings have been altered or deleted ahead of their retention end date.

## 4. Trigger

- **Continuous:** Any communication on a mandatory recording channel (voice, instant messaging, email, trading system) where the subject matter relates to: (a) a client order or instruction; (b) financial product advice; (c) an OTC IRD or JSE transaction; (d) margin calls, collateral movements, or dispute-related communications.
- **Retrieval (on-trigger):** `RecordingRetrievalRequested { requestId, requestType: 'Regulatory' | 'InternalAudit' | 'Legal', requester, period, subjectMatter, requestedAt }` — triggers the retrieval workflow.
- **Integrity check (scheduled):** `RecordingIntegrityCheckScheduled { checkDate }` — monthly BLAKE3 hash verification of the recording archive.
- **Annual attestation:** `AnnualRecordingAttestationDue { year }` — triggers the annual compliance attestation.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Channel recording — voice.** All voice calls on designated trading lines are recorded automatically at call initiation; recording is mandatory and cannot be disabled by the caller or the bank-side participant; call metadata (timestamp, participants, duration, channel) is captured alongside the audio | `system` (automatic) | `@platform/comms/recording-retention` (PLANNED) | Voice recording uses a session-initiated protocol; any recording failure on a mandatory channel triggers an immediate alert to Senna + Sade. Trading on that channel is suspended until recording is restored. |
| 2 | **Channel recording — instant messaging.** All messages on bank-approved IM platforms (Bloomberg Chat, ICE Chat, Refinitiv Messenger) are captured at the platform API level; message content, metadata, and participant IDs are archived | `system` (automatic) | `@platform/comms/recording-retention` (PLANNED) | Unapproved IM platforms (WhatsApp, personal messaging apps) are blocked at the network layer for trading-related communications; attempts to use unapproved channels are flagged to Senna + Zara. |
| 3 | **Channel recording — email.** All email communications involving the bank's trading-related address domains are captured via the email security gateway; attachments are retained alongside messages | `system` (automatic) | `@platform/comms/recording-retention` (PLANNED) | Email capture covers both inbound and outbound messages; BCC to a compliance mailbox is a fallback for any gap in gateway capture. |
| 4 | **Channel recording — trading system.** All electronic orders, confirmations, and structured messages transmitted via the trading system (FIX, FpML, ISO 20022) are retained natively in the transaction database; this procedure cross-links with trade reporting (PROC-MK-ODP-02) for the OTC IRD confirmation store | `system` (automatic) | `@platform/markets/order-management` (PLANNED) | Trading-system records satisfy FMCA s.6 retention requirements natively; they are indexed in the recording archive for unified retrieval. |
| 5 | **Archive and tamper-evident storage.** Recordings are archived within 30 minutes of creation; each recording object is: (a) BLAKE3-hashed on ingest; (b) encrypted at rest using FIPS-Level-3 HSM-managed keys; (c) stored with a content-addressed reference; (d) replicated to a geographically separated secondary store | `agent` (Senna — archive pipeline) | `@platform/comms/recording-retention` (PLANNED) + FIPS-Level-3 HSM | Key rotation follows the Information Security Policy schedule; Senna owns the HSM key governance for the recording archive. |
| 6 | Emit `RecordingArchived { recordingId, channel, sessionRef, blake3Hash, encryptedStorageRef, archivedAt, retentionEndDate }` | `agent` | `@platform/event-store` | `retentionEndDate` is set at archive time: 7 years for FAIS Act advice records; 5 years for FMCA/ODP records. The differentiation logic is applied based on the communication's tagged record type. |
| 7 | **Monthly integrity check.** On `RecordingIntegrityCheckScheduled`: Senna's agent re-computes BLAKE3 hashes for a random 5 % sample of the archive; compares against the stored hash in the `RecordingArchived` event; any mismatch is a tamper alert | `agent` (Senna) | `@platform/comms/recording-retention` (PLANNED) | Full archive integrity check is annual (step 11). Monthly 5 % sampling provides continuous assurance. A tamper alert is escalated to Senna + Zara + Helena immediately. |
| 8 | **Retrieval — regulatory request.** On `RecordingRetrievalRequested { requestType: 'Regulatory' }`: Zara (CCO, governance) reviews the request; confirms the regulator's authority and the scope of the request; Senna extracts the specified recordings; Imani (legal-as-code engineer) reviews any legal privilege considerations; Zara approves the production package; the package is produced to the regulator with a chain-of-custody record | `human` (Zara — CCO, governance, lead) + `human` (Senna — extraction) + `human` (Imani — privilege) | `@platform/comms/recording-retention` (PLANNED) | Regulatory retrieval is an irreducible human step — Zara must personally approve each production to a regulator. The chain-of-custody record is filed in the regulatory correspondence store. |
| 9 | Emit `RecordingRetrievalFulfilled { requestId, retrievedRecordingIds, requestType, reviewedBy: Zara, fulfilledAt, chainOfCustodyRef }` | `agent` | `@platform/event-store` | |
| 10 | **Retrieval — internal audit.** On `RecordingRetrievalRequested { requestType: 'InternalAudit' }`: Vera (internal audit engineer, governance) or Thandiwe (CAE, governance) may request recordings for audit purposes; Sade manages extraction; Zara is notified (does not need to approve); Thandiwe reviews access logs quarterly | `agent` (Sade — extraction) | `@platform/comms/recording-retention` (PLANNED) | Internal audit access is logged with full identity + timestamp; Vera asserts completeness of the access log quarterly. |
| 11 | **Retention expiry.** When a recording's `retentionEndDate` is reached: the system flags the recording for deletion review; Zara confirms no litigation hold, regulatory hold, or open investigation applies; after confirmation, the recording is deleted and the deletion event is emitted | `agent` (Sade — scheduled check) + `human` (Zara — hold confirmation) | `@platform/comms/recording-retention` (PLANNED) | Deletion without a hold-confirmation event is a Principle 1 violation. No recording may be deleted early or without Zara's confirmation. |
| 12 | Emit `RecordingDeleted { recordingId, retentionEndDate, deletedAt, holdConfirmation: Zara, deletionReason: 'RetentionExpiry' }` | `agent` | `@platform/event-store` | The deletion event is permanent and immutable; it is the audit trail for compliance with POPIA's retention-limit obligation. |
| 13 | **Annual compliance attestation.** On `AnnualRecordingAttestationDue`: Senna confirms all four channels are operational and recording; Sade confirms archive pipeline health; Zara confirms regulatory alignment; Saskia (Head of Global Markets, governance) signs the attestation as the business owner | `human` (Senna + Sade + Zara + Saskia) | None — governance attestation | The attestation is a regulatory artefact; it is filed in the compliance evidence store and referenced in the annual FAIS compliance report. |
| 14 | Emit `AnnualRecordingAttestationEmitted { year, channelsCovered, archiveIntegrityGate: 'Pass' | 'Fail', retentionComplianceGate: 'Pass' | 'Fail', attestedBy: [Saskia, Zara, Senna, Sade], attestedAt }` | `agent` | `@platform/event-store` | A `Fail` on either gate triggers immediate remediation before the attestation is accepted as valid. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Senna (information security & cloud engineer) | Recording infrastructure; HSM key governance; archive pipeline; integrity checks; regulatory extraction |
| Sade (AgentOps & token efficiency engineer) | Archive pipeline monitoring; retention schedule management; internal audit extraction; deletion workflow |
| Saskia (Head of Global Markets, governance) | Business owner; annual attestation sign-off; channel-suspension decision on recording failure |
| Zara (Chief Compliance Officer, governance) | Regulatory retrieval approval; hold confirmation; retention alignment; annual attestation compliance sign-off |
| Imani (legal-as-code engineer) | Legal privilege review on regulatory retrievals; litigation hold management |
| Thandiwe (CAE, governance) | Internal audit access oversight; recording-retention audit |
| Vera (internal audit engineer, governance) | Access log completeness; deletion event coverage; monthly integrity-check outcome review |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Recording failure on mandatory channel | Senna + Sade + Saskia; channel suspended | Immediately |
| Tamper alert (hash mismatch) | Senna + Zara + Helena; incident declared | Immediately |
| Unapproved IM channel use | Senna + Zara; network block confirmed | Within 4 hours |
| Regulatory retrieval request | Zara leads; Imani + Helena notified | Within the regulator's response window |
| Litigation hold not applied before retention expiry | Zara + Imani + Helena; deletion suspended | Immediately on detection |
| Annual attestation `Fail` | Saskia + Zara + Helena; BRC briefed | Before attestation is filed |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/comms/recording-retention` | PLANNED | Voice capture, IM capture, archive, integrity checks, retrieval workflow, deletion management |
| `@platform/markets/order-management` | PLANNED | Trading-system records (cross-linked) |
| `@platform/event-store` | Live | All typed recording events |
| FIPS-Level-3 HSM | PLANNED (Azure Managed HSM) | Encryption key management for recording archive |
| Email security gateway | PLANNED | Email capture integration |
| `@platform/comms/channel-monitor` | PLANNED | Unapproved channel detection and blocking |

## 9. Quality controls

- **Coverage completeness:** Every trade session must produce `RecordingArchived` events covering all four channels for any communication relating to a transaction. Missing coverage is a Vera finding.
- **Archive latency:** `RecordingArchived` must be emitted within 30 minutes of the communication end. Latency > 30 min is a Senna operational alert.
- **Monthly integrity sampling:** `RecordingIntegrityCheckScheduled` must produce a result within 2 business days. Any hash mismatch is an immediate tamper alert.
- **Retention schedule accuracy:** `retentionEndDate` in each `RecordingArchived` event must match the record type's retention rule. Vera quarterly-audits a random 10 % sample.
- **Deletion gate:** No `RecordingDeleted` event is valid without a preceding `RecordingRetrievalFulfilled { requestType: 'RetentionReview' }` or equivalent hold-confirmation. Vera asserts this invariant.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `RecordingArchived` | Event log | Permanent (Principle 1 — event is the record) | Contains BLAKE3 hash + storage ref |
| Recording files (voice, IM, email, trading system) | FIPS-Level-3 encrypted archive (BLAKE3-addressed) | 5 years (FMCA/ODP) or 7 years (FAIS advice records) | Retention period set per record type at archive time |
| Monthly integrity check results | Event log (`RecordingIntegrityCheckCompleted`) | 3 years (operational) | Hash-comparison outcomes |
| Regulatory retrieval packages | Regulatory correspondence store + event log | 7 years | Chain-of-custody record required |
| `RecordingDeleted` | Event log | Permanent | Immutable deletion audit trail |
| `AnnualRecordingAttestationEmitted` | Event log + compliance evidence store | 7 years (FAIS Act) | Regulatory attestation artefact |
| Access log (internal audit retrievals) | `@platform/comms/recording-retention` access log | 5 years | Quarterly Vera review |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Saskia (Head of Global Markets, governance) · Senna (information security & cloud engineer) · Sade (AgentOps & token efficiency engineer) | Initial POPULATED — four-channel recording (voice, IM, email, trading system), FIPS-Level-3 tamper-evident archive, differentiated retention (5 yr FMCA / 7 yr FAIS), retrieval pathways (regulatory + internal audit), deletion gate, annual attestation; POPIA processing obligations documented. |
