---
status: POPULATED
---
# Procedure — Sanctions screening (pre-execution)

**Procedure ID:** PROC-FC-02
**Owner:** Zara (CCO, MLRO) · Mira (engineering) · Senna (list-integrity attestation)
**Approval:** BRC + Board (Sanctions Policy is Board-reserved)
**Cadence:** Continuous (on every screening event); list refresh per source cadence
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §3 — Sanctions Policy.
RAS B4 (CEO approved 2026-05-06): zero appetite; production override = signed Zara event.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-13` (UN/OFAC/EU/UK HMT/POCDATARA + RAS B4) | Block all true-positive sanctions matches pre-execution. |
| `ORG-FC-14` (POCDATARA + FIC Act s.26B) | Targeted Financial Sanctions screening per DTI list. |
| `ORG-FC-08` (FIC Act s.28A) | Property Association Reports on association with sanctioned property. |

## 3. Purpose

Block any transaction or onboarding event involving a sanctioned party at the earliest possible point in the workflow — pre-execution. Override authority is restricted to the named MLRO and produces a register-linked exception event.

## 4. Trigger

Multiple triggers — sanctions screening is invoked inline by upstream procedures:

- **Onboarding** (`kyc-onboarding.md` Step 3) — screen candidate, controlling parties, UBOs.
- **Payment instruction** — screen counterparty, originator, beneficiary on every cross-border or sanctions-relevant payment.
- **Counterparty onboarding (markets)** — screen at trade enablement.
- **Continuous-KYC** — screen on every `KYCSignalIngested` (sanctions-list delta).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive screening request with candidate name, identifiers, jurisdictions | `system` (caller) | `@platform/screening/api` (`PLANNED`) | Synchronous for pre-execution path. |
| 2 | Match against in-force lists (UN, OFAC, EU, UK HMT, DTI / POCDATARA) | `system` | `@platform/screening/match-engine` (`PLANNED`) | Fuzzy matching; configurable thresholds; named/ID/DOB/jurisdiction features. |
| 3 | For each match: assess match quality (confidence score) | `system` | `@platform/screening/scorer` (`PLANNED`) | Tier matches: exact / strong / weak / no-match. |
| 4 | Strong-or-better match → BLOCK (synchronous) and emit `ScreeningHit` event | `system` | `@platform/event-store` ✓ | The caller MUST treat block as authoritative — pre-execution. |
| 5 | Weak match → route to investigator review (case-management workflow) | `system` → `human` (Mira investigator) | `@domains/screening/case-mgmt` (`PLANNED`) | Investigator events: `ScreeningCaseOpened`, `ScreeningCaseDecided`. |
| 6 | True-positive confirmed → BLOCK; potentially file FIC s.28A TPR | `human` (MLRO) | `@platform/event-store` ✓ + `@domains/fic-reporting/tpr` (`PLANNED`) | TPR filing per `str-filing.md` if applicable. |
| 7 | False-positive → unblock; tune fuzzy-match threshold; record rationale | `human` (Mira) | `@domains/screening/tuning` (`PLANNED`) | Tuning is a typed event for the model-risk register. |
| 8 | List integrity attested (cryptographic hash of in-force list version) | `system` | `@platform/screening/attestation` (`PLANNED`) | Per Senna's threat-model gate; integrity attested per evaluation. |

## 6. Reconciliation

- **Events produced:**
  - `KYCSignalIngested { signal_source: 'sanctions-list', signal_type: 'list-update' }` — list ingestion.
  - `ScreeningPerformed { target_id, target_name, lists, list_version_hash, hits }` — per evaluation.
  - `ScreeningHit { match_id, list, target, confidence, action: BLOCK | REVIEW }` — per match.
  - `ScreeningCaseOpened` / `ScreeningCaseDecided` — investigator workflow.
  - `ScreeningOverride { case_id, signed_by: 'zara', justification, citation }` — production override (rare; Zara only).
- **Reconciliation check:**
  - **No transaction or onboarding can produce a terminal-success event without a matching `ScreeningPerformed` event upstream.** This is a CI-tested invariant of the projection runtime.
  - Every `ScreeningHit` with `action: BLOCK` either has a downstream `ScreeningOverride` (rare) or no terminal-success event from the original caller (ever).
  - List-integrity attestations are reproducible — the hash chain is published.
- **Failure mode:** screening service unavailable → upstream procedure halts; no transaction can proceed without screening (fail-closed). Synthetic test runs hourly.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ScreeningPerformed` events | Event log | Permanent (P1) | High |
| List-version attestations | Event log + signed manifest | Permanent | High |
| Investigator case files | Event log + document store | 5 years post-decision | High (PII) |
| Production overrides | Event log | Permanent (immutable) | Critical |

## 8. Manual steps

- **Step 5–7** (investigator review of weak matches and override decisions) is human discretion. The Sanctions Policy requires the override authority to be the MLRO; the platform refuses non-MLRO overrides at the cryptographic layer.
- Tipping-off prevention (FIC s.29(3)) restricts override-discussion access to the named MLRO investigation set.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Strong match incorrectly cleared | Vera periodic re-screen sample | Zara → BRC; FIC engagement if needed |
| List-version stale > 24h | Health-check on ingestion cadence | Senna + Mira immediately; fail-closed if stale > 48h |
| Override without MLRO signature | Cryptographic gate refuses | Auto-event to AC; Vera investigates |
| Match threshold tuned without governance | Model-risk register check | Helena (model-risk owner) + BRC |

## 10. Related procedures

- `kyc-onboarding.md` — invokes this procedure inline at Step 3.
- `payment-screening.md` (`PLANNED`) — inline screening on payment instructions.
- `counterparty-onboarding-markets.md` (`PLANNED`) — Saskia-side counterparty checks.
- `str-filing.md` — TPR filing path on confirmed sanctions hits.
- `kyc-continuous.md` — list-delta-driven re-screening of existing clients.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Mira + Zara | Initial draft, pre-board reviewed under Sanctions Policy. |

## 12. Audit / assurance

- Vera periodic sample re-screen against archived list-versions; deviations reported to AC.
- Annual independent effectiveness review of the fuzzy-match tuning (model-risk Tier 1 — annual revalidation per Model Risk Policy).
- Continuous-controls projection: percentage of in-scope events with upstream `ScreeningPerformed` reported to BRC monthly.
