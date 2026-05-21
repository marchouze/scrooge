---
procedureId: PROC-FC-UBO-01
title: UBO resolution — recursive beneficial ownership identification per FIC Act s.21(1)(b)
author: Mira (Regulatory intelligence engineer, compliance) · Zara (Chief Compliance Officer)
date: 2026-05-18
owner: Zara (Chief Compliance Officer) · Mira (Regulatory intelligence engineer, compliance)
status: POPULATED
version: "1.0"
last-updated: "2026-05-18"
policy-cited: AML-CFT-POLICY-V1
system-capability: "@domains/onboarding/ubo-graph (PLANNED) · @domains/onboarding/verify (DHA adapter — PLANNED)"
citations:
  - FIC-ACT-S21-1-B
  - FIC-ACT-S21-2
  - FIC-ACT-SCHEDULE-3A
  - COMPANIES-ACT-S56
  - POPIA-S14
  - D-KYC-ONBOARDING-BUILD
---

# Procedure — UBO Resolution (Recursive Beneficial Ownership Identification)

**Procedure ID:** PROC-FC-UBO-01
**Owner:** Zara (Chief Compliance Officer) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** BRC
**Cadence:** Per-event — called from PROC-FC-01 Step 4 on every legal-entity onboarding candidate; re-invoked by `kyc-continuous.md` on ownership-change signals
**Version:** v1.0 — 2026-05-18
**Status:** POPULATED
**Authority:** D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18)

## 1. Source policy

`Policies/risk-management-and-compliance-policy-v1.md` (RMCP) — AML/CFT Policy annex, beneficial ownership requirements.
RAS B3 (CEO-approved 2026-05-06): low appetite for financial-crime risk; UBO resolution is a mandatory pre-acceptance gate.

The obligation chain:

```
Regulation (FIC Act s.21(1)(b) + s.21(2); FIC Act Schedule 3A; Companies Act s.56; POPIA s.14)
  → AML-CFT-POLICY-V1 (UBO must be resolved to natural persons pre-acceptance)
    → PROC-FC-UBO-01 (this procedure)
      → @domains/onboarding/ubo-graph (recursive ownership walker — PLANNED)
      → @domains/onboarding/verify (DHA / passport verification adapter — PLANNED)
      → KYCUBOResolved event
```

**Build-phase posture:** No live clients. The UBO graph walker is in `PLANNED` status; the procedure is exercised via the onboarding rehearsal scenario (`tests/onboarding-rehearsal.test.ts`) with test entity structures. Production-readiness gated by the pre-licence go-live readiness substrate.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| FIC Act s.21(1)(b) | Accountable institutions must identify the beneficial owner of an account or relationship. |
| FIC Act s.21(2) | "Beneficial owner" means the natural person who ultimately owns or controls the client, or on whose behalf the transaction is conducted. |
| FIC Act Schedule 3A | Sets the ownership-or-control threshold for beneficial ownership determination; default 25% for SA legal entities. |
| Companies Act s.56 | Beneficial interest in securities: disclosure requirements; CIPC beneficial ownership register (effective from Companies Act Amendment Act 2023). |
| POPIA s.14 | Personal information of UBO natural persons (ID numbers, nationality, control basis) must be processed under a lawful basis with purpose limitation. |

## 3. Purpose

Identify, verify, and record every natural person who ultimately owns or controls a legal-entity client at or above the applicable threshold (25% for SA entities; lower if the client's jurisdiction sets a stricter threshold). Where the ownership structure is opaque, document the structure, reasons for opacity, and the mitigating controls applied. The output — `KYCUBOResolved` — is a mandatory precondition for `ClientAccepted`.

**Definition applied:** A natural person is a UBO if they:
1. Directly or indirectly own ≥25% of the equity or voting rights of the client entity (or the applicable jurisdictional threshold if lower); **or**
2. Exercise effective control by other means (board appointment rights, veto rights, trust beneficiary status, nominee arrangement).

## 4. Trigger

Event: **`KYCIdentityCollected`** (PLANNED) — emitted by Step 4 of PROC-FC-01 after the initial identity documents for a legal-entity candidate are collected.

Also triggered by:
- `ClientOwnershipChangeNotified` (PLANNED) — re-invoked by `kyc-continuous.md` Step 4 on ownership-change signals.
- `KYCRefreshInitiated` with `stale_elements` containing `ubo_chain` — re-invoked by `kyc-recurring.md` Step 5 on periodic refresh.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Obtain the candidate's ownership structure: request a CIPC beneficial interest extract for SA companies; for foreign entities, request the applicable registry extract (Companies House, BVI Registry, etc.) and a client-executed ownership declaration | `system` (CIPC API adapter) → `Mira` (for foreign registries) | `@domains/onboarding/ubo-graph` (`PLANNED`) | CIPC extract provides the starting layer of the ownership graph. For foreign entities, the client declaration is required where registry data is unavailable. Emit `KYCOwnershipDocumentCollected { candidateId, source, doc_hash }` (PLANNED) per source. |
| 2 | Walk the ownership graph recursively, layer by layer, using the UBO graph walker. For each layer: identify all shareholders/controllers at ≥25% (or applicable threshold); if an owner is a legal entity, walk into it; continue until only natural persons or terminal opaque structures remain | `system` | `@domains/onboarding/ubo-graph` (`PLANNED`) | Maximum recursion depth: **5 layers**. If the natural-person terminus has not been reached by layer 5, emit `KYCUBOLayerLimitReached` (PLANNED) and flag as opaque structure requiring Mira escalation. Graph state persisted after each layer; resumable if service interruption occurs. |
| 3 | For each identified natural-person UBO, collect and record: full legal name; SA ID number (for SA residents) or passport number + nationality (for foreign nationals); country of residence; ownership percentage; basis of control (equity, voting rights, effective control); relationship to the client entity | `system` (graph walker) → `Mira` (for ambiguous control arrangements) | `@domains/onboarding/ubo-graph` (`PLANNED`) | All UBO records are held as typed events with field-level encryption on PII per Principle 4. POPIA s.14 applies to political-affiliation data if present. |
| 4 | For each SA-ID UBO: run DHA (Department of Home Affairs) identity verification call — confirm ID number, name match, date of birth, liveness (where applicable) | `system` | `@domains/onboarding/verify` (`PLANNED`) | Result: `KYCIdentityVerified { ubo_id, method: "DHA", score, verified_at }` (PLANNED) per UBO. DHA verification records retained 5 years post-relationship (FIC Act s.22). |
| 5 | For each foreign-national UBO: record passport verification as attempted (passport document lodged in document store); note that in-country registry confirmation is required for high-value relationships | `Mira` | `@domains/onboarding/verify` (`PLANNED`) | Foreign-UBO verification result: `KYCIdentityVerified { ubo_id, method: "passport-lodged", verified_at }` (PLANNED). For high-risk jurisdictions, enhanced verification (apostille, notarised copy) required. |
| 6 | **Complex-structure flag:** if any layer of the ownership chain includes a trust, foundation, nominee arrangement, bearer shares, or any structure where the beneficial interest is not transparently registered — document the structure type, reason for the structure (legitimate tax planning / asset protection is acceptable with documented rationale), and the mitigating control applied | `Mira` (escalation required) | `@domains/onboarding/ubo-graph` (`PLANNED`) | Flag `ubo_opaque_structure: true` on the UBO record. Mira must confirm the structure is legitimate before the chain can be resolved. Zara (MLRO) co-sign required if the opaque-structure layer cannot be resolved to natural persons within the 5-layer limit. |
| 7 | Concentration check: if any single UBO holds ≥25%, record the percentage for the counterparty-exposure register | `system` | `@domains/onboarding/ubo-graph` (`PLANNED`) | Concentration flag noted in the `KYCUBOResolved` payload as `concentration_flag: true`. This feeds Helena's (Chief Risk Officer, governance) counterparty-concentration monitoring. |
| 8 | PEP/sanctions screen each identified UBO: invoke `@platform/screening` for each natural-person UBO; results feed into Step 3 of PROC-FC-01 screening pipeline | `system` | `@platform/screening` | If any UBO returns a PEP hit → route to `pep-handling.md` (PROC-FC-PEP-01) for full EDD on the candidate. If any UBO returns a sanctions true-positive → `ClientRejected` path. |
| 9 | Emit `KYCUBOResolved { candidateId, ubo_chain: UBORecord[], ubo_opaque_structure, concentration_flag, resolved_at, resolved_by }` (PLANNED) — the canonical output of this procedure | `system` | `@platform/event-store` ✓ | `ubo_chain` must contain at least one natural person, OR `ubo_opaque_structure: true` with a Zara sign-off event ID. A `KYCUBOResolved` with an empty `ubo_chain` and no opaque-structure exception is rejected by the projection gate. |

**UBO record schema (within `ubo_chain`):**

```typescript
interface UBORecord {
  partyRef: string;           // Party URN (links to Party register — D-PARTY-REGISTER)
  fullName: string;           // Legal name (PII — field-level encrypted)
  idType: "SA-ID" | "passport";
  idNumber: string;           // Encrypted; SA ID or passport number
  nationality: string;        // ISO 3166-1 alpha-2
  countryOfResidence: string; // ISO 3166-1 alpha-2
  ownershipPct: number;       // Direct + indirect, through this chain
  controlBasis: "equity" | "voting-rights" | "effective-control" | "trust-beneficiary" | "nominee";
  layerDepth: number;         // 1 = direct owner; 2+ = indirect via legal entity
  dhaVerificationEventId?: string; // For SA-ID UBOs
  passportDocHash?: string;   // For foreign-national UBOs
  pepScreeningEventId: string; // ID of KYCSanctionsPEPScreened event for this UBO
}
```

## 6. Reconciliation

**Events produced (in sequence):**
- `KYCOwnershipDocumentCollected { candidateId, source, doc_hash }` (PLANNED) — per ownership document received.
- `KYCUBOLayerLimitReached { candidateId, depth }` (PLANNED) — if 5-layer limit reached without natural-person terminus.
- `KYCIdentityVerified { ubo_id, method, score, verified_at }` (PLANNED) — per UBO identity verification (DHA or passport).
- `KYCSanctionsPEPScreened { ubo_id, pep_flag, pep_linked, ... }` (PLANNED) — per UBO PEP/sanctions screen.
- `KYCUBOResolved { candidateId, ubo_chain, ubo_opaque_structure, concentration_flag, resolved_at }` (PLANNED) — UBO chain finalised.

**Reconciliation invariants:**
- Every `ClientAccepted` must have an upstream `KYCUBOResolved` with `ubo_chain` containing at least one natural person, OR `ubo_opaque_structure: true` with a documented Zara sign-off event ID. A `ClientAccepted` without upstream `KYCUBOResolved` is a projection invariant violation.
- Every natural-person UBO in `ubo_chain` must have an associated `KYCIdentityVerified` event (DHA method for SA-ID UBOs; passport-lodged method for foreign nationals).
- Every natural-person UBO must have an associated `KYCSanctionsPEPScreened` event. UBO without screening is a projection invariant violation.
- Every `ubo_opaque_structure: true` resolution must carry a Zara sign-off event ID in the `KYCUBOResolved` payload.

**Failure mode:** if CIPC API is unavailable, the client-executed ownership declaration is used as the interim source; Mira flags for CIPC cross-check once the API recovers. If DHA is unavailable, SA-ID verification is deferred with an automatic retry; onboarding is not blocked for ≤48h DHA outage, but the `KYCIdentityVerified` event must arrive before `ClientAccepted` can be emitted.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| CIPC / registry extracts | Document store (content-addressed) | Permanent (P1) — UBO chain evidence | High (entity data) |
| Client ownership declarations | Document store (content-addressed) | Permanent (P1) — UBO chain evidence | High (PII) |
| `KYCUBOResolved` events | Event log | Permanent (P1) | Critical |
| DHA verification records + results | Document store + event log | 5 years post-relationship exit (FIC Act s.22) | Critical (PII) |
| Passport verification documents | Document store (content-addressed) | 5 years post-relationship exit | Critical (PII) |
| Opaque-structure documentation + Zara sign-off | Event log + document store | Permanent (P1) | Critical |
| PEP/sanctions screening results per UBO | Event log | Permanent (P1) | Critical |

POPIA s.14 note: UBO personal information (ID numbers, nationality, country of residence) is PII processed under a legal obligation (FIC Act s.21). Processing is proportionate, purpose-limited to AML/CFT compliance, and retained for the prescribed period. Field-level encryption applied at rest; access controlled by need-to-know.

## 8. Manual steps

- **Step 1** — for foreign entities where no API is available, Mira manually requests registry extracts and client declarations; document collection is tracked via `KYCOwnershipDocumentCollected` events.
- **Step 2** — recursion into opaque structures (trusts, foundations) requires Mira to assess the legitimacy of the structure and document the rationale.
- **Step 6** — opaque-structure documentation and Zara sign-off is exclusively human discretion; the platform enforces this via the `zara_sign_off_event_id` requirement on `KYCUBOResolved` where `ubo_opaque_structure: true`.
- **Steps 4 / 5** — foreign UBO enhanced verification (apostille, notarised copy) requires Mira to coordinate with the client's counsel or the applicable foreign registry.
- Tipping-off (FIC Act s.29(3)): if any UBO is under an active STR investigation, access to that UBO's records is restricted to the MLRO-named investigation set; UBO resolution records for that candidate are not disclosed to standard onboarding staff.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| `ClientAccepted` without upstream `KYCUBOResolved` | Projection invariant check on `ClientAccepted` emit | Event rejected; Mira immediately; UBO resolution must complete before acceptance |
| UBO in `ubo_chain` without `KYCIdentityVerified` | Projection invariant on `KYCUBOResolved` emit | Event rejected; Mira; DHA retry or passport lodgement required |
| UBO in `ubo_chain` without `KYCSanctionsPEPScreened` | Projection invariant on `KYCUBOResolved` emit | Event rejected; Mira; screening must complete before resolution event accepted |
| CIPC API unavailable > 48h | Health-check alert | Mira → Zara; manual extract fallback; CIPC cross-check queued for recovery |
| DHA unavailable > 48h | Health-check alert | Mira → Zara; verification deferred; `ClientAccepted` blocked until DHA confirms |
| 5-layer limit reached without natural-person terminus | `KYCUBOLayerLimitReached` event emitted | Mira immediately; escalate to Zara; opaque-structure treatment or rejection |
| Opaque-structure without Zara sign-off | `KYCUBOResolved` event rejected by projection gate | Mira; Zara sign-off required; event cannot be admitted without the event ID |
| UBO PEP hit detected | `KYCSanctionsPEPScreened` with pep_flag or pep_linked | Route to `pep-handling.md` (PROC-FC-PEP-01) immediately; onboarding paused |

## 10. Related procedures

- `kyc-onboarding.md` (PROC-FC-01) — this procedure is invoked at Step 4 of PROC-FC-01; `KYCUBOResolved` feeds back into Step 3 (PEP/sanctions screen).
- `pep-handling.md` (PROC-FC-PEP-01) — invoked when a UBO PEP hit is detected at Step 8 of this procedure.
- `kyc-continuous.md` (PROC-FC-CKKYC-01) — re-invokes this procedure on ownership-change signals.
- `kyc-recurring.md` (PROC-FC-KYC-R-01) — re-invokes UBO chain re-walk at Step 5 of the periodic refresh.
- `sanctions-screening.md` — invoked inline at Step 8 for each UBO.
- `popia-dsar.md` — data subject access requests covering UBO PII stored in this procedure's evidence chain.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-18 | Mira (Regulatory intelligence engineer, compliance) + Zara (Chief Compliance Officer) | Initial POPULATED version — all 12 sections; authority D-KYC-ONBOARDING-BUILD. |

## 12. Audit / assurance

- **Vera quarterly sample:** select 30 random `ClientAccepted` events for legal-entity clients; trace back to `KYCUBOResolved`; confirm each natural-person UBO has a `KYCIdentityVerified` event (DHA or passport) and a `KYCSanctionsPEPScreened` event; confirm opaque-structure exceptions carry Zara sign-off. Deviations reported to Zara and BRC.
- **Vera quarterly check:** confirm no `ClientAccepted` exists without an upstream `KYCUBOResolved` in the same onboarding chain — projection invariant summary exported to Vera.
- **Annual effectiveness review:** Zara reviews CIPC API reliability, DHA uptime, and the rate of opaque-structure exceptions; submits summary to BRC.
- BRC receives a monthly dashboard tile: open UBO resolution cases by age band; opaque-structure exception count by client tier.
