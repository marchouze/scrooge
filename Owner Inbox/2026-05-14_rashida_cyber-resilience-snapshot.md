---
agent: Rashida
trigger: cyber-resilience-snapshot
asOf: 2026-05-14T07:49:59.100Z
decision-required: false
---

# Rashida — cyber-resilience snapshot, 2026-05-14

Autonomous run of Rashida's weekly cyber-resilience snapshot per `Team/Rashida.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Pre-attestation digest for the quarterly Joint Standard 2 of 2024 programme attestation and the second-line cyber opinion to AC.

**Headline:** 18 ORG-CY-* obligations indexed (0 citing Joint Standard 2 of 2024; 0 citing POPIA s.19–22) · 0 `SecurityIncidentRaised` events in the last 7 days · 0 threat-model gate decisions.

## Obligations-register slice

| Slice | Count |
|---|---|
| ORG-CY-* (cyber & information security) | 18 |
| Rows citing Joint Standard 2 of 2024 | 0 |
| Rows citing POPIA s.19–22 | 0 |

## Security events (last 7 days)

| Event | Count |
|---|---|
| Senna `SecuritySubstrateSnapshot` | 2 |
| `SecurityIncidentRaised` | 0 |
| `ThreatModelGateDecision` | 0 |
| `KeyRotationPerformed` | 0 |
| `SBOMAccepted` | 0 |
| `SBOMRejected` | 0 |
| `VendorSecurityReview` | 0 |
| `PersonalInformationCompromiseSuspected` | 0 |

_Build-only context: per `Team/Rashida.md` § 5 / § Build-only context, programme is rehearsed-readiness against synthetic flows. Live-incident posture activates licence-day. Zero counts here are expected and not a substrate alarm on their own._

## Programme-readiness (build-phase)

- **Joint Standard 2 of 2024 programme map** — drafted; PA / FSCA reporting cadence rehearsed against simulated endpoints (Rashida § Build-only context).
- **Threat-modelling gate** — operating; Senna runs; Rashida signs exceptions.
- **Cyber-resilience scenario test plan** — rehearsed cadence; first cycle in build-phase per § 5 first-90-days posture.
- **POPIA s.19–22 partnered cadence with Iris** — quarterly joint review; this snapshot informs Iris's `popia-controls-snapshot` digest.
- **Pre-licence security-readiness gate** — co-owned with Saskia (franchise pre-conditions) and Devon (broader OR); load-bearing for switch-to-live.

## Rashida's narrative

Cyber substrate remains posture-only: 18 ORG-CY-* obligations are registered but **zero cite Joint Standard 2 of 2024 sub-paragraphs and zero cite POPIA s.19–22 directly**. Senna ran two `SecuritySubstrateSnapshot`s this week; every other event type the inventory expects — incidents, threat-model-gate decisions, key rotations, SBOM accept/reject, vendor reviews, PI-compromise suspicions — is at zero. That is consistent with build-phase rehearsed-readiness, but it means no control on the cyber side is currently load-bearing against live risk; everything is scaffolding awaiting first exercise.

The most consequential gap is citation-level: an obligations slice of 18 rows with zero rows pinned to Joint Standard 2 of 2024 paragraphs (notably the governance, risk-management, and notification clauses) or to POPIA s.19 (security safeguards) and s.22 (notification of compromise) is not a register the Prudential Authority or the Information Regulator would accept as evidence of mapping. Second-order: the inventory anticipates `KeyRotationPerformed` and `SBOMAccepted` events on a recurring cadence — both at zero across the snapshot window means the rotation policy and SBOM-acceptance gate are documented but unexercised, and we cannot yet demonstrate the operational discipline Joint Standard 2 of 2024 requires of the cybersecurity and information-security control framework. Third: zero `ThreatModelGateDecision` events means the gate has not been driven against even synthetic flows this week — rehearsed-readiness is decaying, not accumulating.

Next hardening step, ranked: (1) populate Joint Standard 2 of 2024 and POPIA s.19, s.21, s.22 citations onto the existing 18 ORG-CY-* rows this sprint — Senna and I co-author, no new obligations, just binding the ones we have; (2) execute one rehearsed key-rotation and one synthetic threat-model-gate run before the next snapshot so the event inventory has non-zero baselines to attest against; (3) schedule the JS 2 of 2024 incident-notification rehearsal (the s.22 / regulator-notification dry-run) which is the load-bearing artefact for the pre-licence security-readiness gate co-owned with Saskia and Devon — without it, that gate cannot clear.

## Provenance

Read `Regulations/_obligations-register.md` for ORG-CY-* / Joint Standard 2 of 2024 / POPIA s.19–22 row counts. Replayed `SecuritySubstrateSnapshot`, `SecurityIncidentRaised`, `ThreatModelGateDecision`, `KeyRotationPerformed`, `SBOMAccepted`, `SBOMRejected`, `VendorSecurityReview`, `PersonalInformationCompromiseSuspected` from the host event store.
