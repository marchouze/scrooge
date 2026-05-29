---
id: PROC-FC-KYC-O-01
policy-parent: §4 — KYC / CDD / EDD Policy
last-reviewed: 2026-05-06
status: POPULATED
---
# Procedure — KYC onboarding (gate before client master entry)

**Procedure ID:** PROC-FC-01
**Owner:** Zara (CCO, MLRO) · Mira (engineering)
**Approval:** BRC
**Cadence:** Per-event (each new client candidate)
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability partially `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §4 — KYC / CDD / EDD Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-02` (FIC Act ss.21–21H + FATF Rec. 10) | Conduct CDD on all clients; identify and verify before establishing relationship. |
| `ORG-FC-03` (FIC Act s.21A + GN 7) | Apply EDD to high-risk relationships. |
| `ORG-FC-04` (FIC Act s.21B + Companies Act + TPCA) | Verify beneficial ownership; recursive resolution to natural persons. |
| `ORG-FC-13` (UN/OFAC/EU/UK HMT/POCDATARA + RAS B4) | Block all true-positive sanctions matches pre-execution. |
| `ORG-PR(IV)-02` (POPIA s.13) | Process for a specific, explicit, lawful purpose; document the purpose. |

## 3. Purpose

Ensure no client is added to the client master without satisfying applicable upfront KYC under FIC Act, FATF Recommendations, FAIS where relevant, and jurisdictional dispatch (P5). The onboarding gate is the regulatory line — `ClientAccepted` is the *only* event that places a client into the master projection.

## 4. Trigger

Event: **`ClientCandidateRegistered`** arrives (e.g., from Niko's onboarding UI; from a programmatic API; from a referral integration).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Identity collection | `human` (customer-facing UI) → `system` (validation) | `@domains/onboarding/forms` (`PLANNED`) | Identity elements per legal-entity-type taxonomy. Multi-jurisdiction tags captured. |
| 2 | Identity verification (ID document, biometrics, registry lookup) | `service` (identity-verification provider) | `@domains/onboarding/verify` (`PLANNED`) | Result: `ClientIdentityVerified` event with method + score. |
| 3 | Sanctions / PEP / adverse-media screening on candidate, controlling parties, UBOs | `system` | `@platform/screening` (`PLANNED`) | True-positive sanctions match → reject path (Step 8b); PEP / adverse → continue with EDD branch. |
| 4 | Beneficial-ownership resolution per legal-entity-type | `system` (recursive) → `human` for opaque structures | `@domains/onboarding/ubo-graph` (`PLANNED`) | Recursive until natural persons or terminal opaque structures. Events: `BeneficialOwnerAsserted`. |
| 5 | Risk rating assignment | `system` | `@platform/risk-rating` (`PLANNED`) | Typology-based per RMCP. Event: `RiskRatingAssigned`. |
| 6 | EDD branch (if rating = high) | `service` (EDD specialist tooling) → `human` (Mira / Zara reviewer) | `@domains/onboarding/edd` (`PLANNED`) | Additional documents and approvals. Senior-management approval recorded as a typed event. |
| 7 | Final accept / reject decision | `system` (auto-accept low-risk passing all gates) OR `human` (`Zara` / Mira reviewer for medium / high) | `@domains/onboarding/decision` (`PLANNED`) | Decision is a typed event with reasoning. |
| 8a | On accept: emit `ClientAccepted` | `system` | `@platform/event-store` ✓ (built in walking skeleton) | The client now appears in the master projection. |
| 8b | On reject: emit `ClientRejected` with reason code | `system` | `@platform/event-store` ✓ | Candidate-only state; no master entry. Right of explanation per POPIA s.71 where automated. |
| 9 | Lawful-processing register entry created or updated | `system` | `@domains/privacy/lawful-processing` (`PLANNED`) | Iris-governed; cross-references the candidate's consent / lawful basis. |

## 6. Reconciliation

- **Events produced:**
  - `ClientCandidateRegistered` (input)
  - `ClientIdentityClaimed`, `ClientIdentityVerified`, `KYCRuleEvaluated`, `BeneficialOwnerAsserted`, `RiskRatingAssigned`, `DocumentLodged`
  - Terminal: `ClientAccepted` or `ClientRejected`
- **Reconciliation check:**
  - Every `ClientCandidateRegistered` is followed by exactly one terminal event (`ClientAccepted` or `ClientRejected`) within **30 days** (configurable). Open candidates past 30d trigger an alert.
  - Every `ClientAccepted` carries a non-empty `risk_rating` and at least one `BeneficialOwnerAsserted` chain leading to natural persons (or terminal opaque structure with documented justification).
  - **No client appears in the master projection without a corresponding `ClientAccepted` event** — enforced by the projection runtime.
- **Failure mode:** procedure stuck in middle steps → escalates to Mira on the case-management dashboard at the relevant SLA threshold.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Identity documents | Document store; field-level encrypted | 5 years post-relationship (FIC s.22) | High (PII) |
| Verification events + scores | Event log | Permanent (P1) | High (PII) |
| Sanctions / PEP screening evidence | Event log + signed list-version attestation | 5 years post-relationship | High |
| EDD documents + reviewer notes | Event log + document store | 5 years post-relationship | High (PII) |
| Acceptance / rejection decision | Event log | Permanent | High |

## 8. Manual steps

- **Step 6** (EDD review) is human discretion for high-risk cases; automation can route, score, and pre-fill but the judgement is human.
- **Step 7** (final decision) for medium / high risk is human; low-risk is automated provided all prior steps pass cleanly.
- **UBO resolution for opaque structures** (Step 4) requires human research where registries are unavailable.

These manual steps are tracked exceptions under P2; each is a typed event with the actor identity recorded.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Candidate stuck > 30d | Daily projection query | Mira → Zara if 60d |
| Sanctions list ingestion fails | Health-check alert on `KYCSignalIngested` cadence | Senna immediately; screening switched to last-known-good-list with timestamp |
| EDD reviewer SLA breach | Projection alert | Zara / MLRO; escalation to BRC if systemic |
| Beneficial-ownership unresolvable | Marked `terminal_opaque` with rationale | Zara approves or rejects; rationale registered |

## 10. Related procedures

- `kyc-recurring.md` — periodic recurring KYC.
- `kyc-continuous.md` — continuous-KYC re-evaluation on signal.
- `sanctions-screening.md` — pre-execution screening (used inline at Step 3).
- `str-filing.md` — escalates from continuous-KYC anomalies into MLRO STR judgement.
- `popia-dsar.md` — data subject access requests covering KYC data.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Mira (engineering) + Zara (governance) | Initial draft, pre-board reviewed in policy bundle. |

## 12. Audit / assurance

Vera consumes procedure-execution events as continuous-controls evidence. Quarterly sample-test by Vera: 30 random `ClientAccepted` events; trace back through the event chain to confirm every required step produced a typed event with non-empty citation and actor; deviation findings reported to AC.
