---
procedureId: PROC-CRM-CIE-01
title: Counterparty institutional-eligibility screening (FAIS Posture A)
author: Niko (Sales / CRM engineer)
date: 2026-05-09
owner: Niko (Sales / CRM engineer) + governance-line: Saskia (Head of Global Markets, governance) + Zara (Chief Compliance Officer, governance)
status: STUB
policy-cited: institutional-only-FAIS-Posture-A
system-capability: prototype/platform/lifecycle/counterparty-eligibility.ts (planned)
---

# Procedure — Counterparty institutional-eligibility screening (FAIS Posture A)

**Procedure ID:** PROC-CRM-CIE-01
**Owner (engineering):** Niko (Sales / CRM engineer) — counterparty-lifecycle substrate.
**Owner (governance):** Saskia (Head of Global Markets, governance) — markets-franchise side; Zara (Chief Compliance Officer, governance) — conduct line.
**Cadence:** Per-counterparty at onboarding; annual re-eligibility cycle; trigger-based on ongoing-monitoring breach signal.
**Version:** v0 — 2026-05-09
**Status:** **STUB** — substrate (typed events + this procedure) lands in this PR. The classification module that performs the test (`prototype/platform/lifecycle/counterparty-eligibility.ts`) is named as a substrate gap and authored in a follow-on PR.

## 1. Source policy

- Institutional-only / wholesale strategic posture (`project_strategic_foundation`).
- FAIS Posture A binding under D-FSP-LICENCE-NECESSITY (CEO resolution `confirm-A-no-research`, 2026-05-09; PR #62 — `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md`).
- Customer Treatment (TCF) Policy v0.1 — outcome 4 (suitable advice) bound to institutional product-set scope.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| FAIS Act 37/2002 | Defines FSP authorisation; subordinate legislation s.45 carves out institutional / professional counterparties from the retail-conduct overlay. `[citation: TBC pending counsel — precise s.45 sub-section refs ratify at licence-application gate]` | Step 2 (apply institutional-eligibility criteria). |
| `urn:obligation:bank:fais:general-code-of-conduct:v1` (Mira PR #70 FAIS Posture A URN cluster) | FAIS General Code of Conduct — institutional carve-out scope. | Step 2 + Step 3 citations array. |
| `ORG-CD-01` (Regulations/_obligations-register.md) | TCF: six outcomes operationalised — bounds the FAIS scope-of-services to institutional product set under Posture A. | Step 6 (institutional-eligible outcome gates lifecycle entry). |
| `ORG-CD-04` (Regulations/_obligations-register.md) | FAIS General Code of Conduct — advice-records demonstrating suitability. | Reconciliation: every `Order*` event for a counterparty must trace to a current `CounterpartyEligibilityScreened` outcome of `institutional-eligible`. |

## 3. Purpose

Posture A binds every counterparty onboarded to the bank: each must clear an institutional-eligibility test before entering the lifecycle. The test anchors the FAIS scope-of-services to the institutional product set — counterparties that do not clear cannot transact under Posture A's FAIS scope, and route to senior-leadership review.

The procedure produces an immutable `CounterpartyEligibilityScreened` event keyed to a typed screening object, anchored to a structured rationale document under `Owner Inbox/<counterpartyId>/eligibility-screening-<screeningId>.md`. The event carries the criteria applied, the outcome, the evidence references, and the citations binding the criteria to FAIS s.45 + Subordinate Legislation.

## 4. Trigger

- **New counterparty onboarding.** Niko's lifecycle substrate (paused build-phase; activates licence-day) raises an onboarding intake; the procedure runs as the institutional-eligibility gate before any lifecycle entry.
- **Periodic re-eligibility.** Annual default; the cycle emits `CounterpartyEligibilityRevalidated` referencing the prior screening via `priorScreeningId`.
- **Ongoing-monitoring breach signal.** A counterparty material-change (e.g. FSP licence withdrawn, business-model change, regulatory-classification change) raises a breach signal that emits `CounterpartyEligibilityBreached`. The breach forces a fresh screening and gates further `Order*` activity for the counterparty.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Counterparty onboarded — collect entity classification (e.g. registered FSCA-licensed FSP / SARB-licensed bank / SAIA-regulated insurer / collective-investment-scheme manager / pension-fund administrator / professional-counterparty per FAIS s.45 + Subordinate Legislation). | Niko (Sales / CRM engineer) | `prototype/platform/lifecycle/counterparty-eligibility.ts` (planned) | Classification feeds Step 2; the structured rationale lives under `Owner Inbox/<counterpartyId>/eligibility-screening-<screeningId>.md`. |
| 2 | Apply institutional-eligibility criteria. The criteria are referenced as free-form strings at v0; the typed criteria taxonomy lands with the criteria-as-code substrate gap (Niko + Imani (Legal-as-code engineer) joint follow-on). Cite FAIS s.45 + Subordinate Legislation; precise sub-section refs carry `[citation: TBC pending counsel]` until counsel ratifies at the licence-application gate. | Niko (Sales / CRM engineer) | `prototype/platform/lifecycle/counterparty-eligibility.ts` (planned); criteria taxonomy at `prototype/platform/lifecycle/eligibility-criteria.ts` (planned, Imani + Niko) | Citation array must include FAIS s.45 (`[citation: TBC]`) + the Mira (Compliance / RegTech engineer) PR #70 URN reference (`urn:obligation:bank:fais:general-code-of-conduct:v1`). |
| 3 | Emit `CounterpartyEligibilityScreened` with outcome (`institutional-eligible` / `ineligible` / `indeterminate`), evidence references, citations, and `screeningId`. | Niko (Sales / CRM engineer) | `prototype/platform/event-store/event-types.ts` (factory `makeCounterpartyEligibilityScreened`) | At least one `evidenceRef` is required by the typed schema; Step 6 reconciliation checks this. |
| 4 | If outcome is `ineligible`: counterparty cannot transact under FAIS scope-of-services. Route to senior-leadership review (Saskia (Head of Global Markets, governance) + Zara (Chief Compliance Officer, governance)) via the typed escalation channel; counterparty does not enter the lifecycle. | Niko (Sales / CRM engineer) | `prototype/platform/escalation` (existing) | Escalation severity: `blocking`. |
| 5 | If outcome is `indeterminate`: route to Zara (Chief Compliance Officer, governance) + counsel before counterparty can transact; counterparty held in pre-lifecycle state pending the ratification. | Niko (Sales / CRM engineer) | `prototype/platform/escalation` (existing) | Severity: `high`. Counsel ratification feeds back as a fresh screening cycle. |
| 6 | If outcome is `institutional-eligible`: counterparty enters the lifecycle; periodic re-eligibility cycle begins (cadence: annual default, or trigger-based on ongoing-monitoring signal). Subsequent runs emit `CounterpartyEligibilityRevalidated`. | Niko (Sales / CRM engineer) | `prototype/platform/lifecycle/counterparty-eligibility.ts` (planned); scheduler integration (planned) | The annual re-eligibility cadence is registered with the scheduler at the substrate-build follow-on. |
| 7 | Ongoing-monitoring breach detection — when an external signal (FSP-licence change, business-model change, regulator-classification change) suggests the counterparty has drifted out of institutional-eligibility, emit `CounterpartyEligibilityBreached` with `breachReason` and `recommendedAction`. The breach gates further `Order*` activity until a fresh screening clears the counterparty. | system | `prototype/platform/lifecycle/counterparty-eligibility.ts` (planned) | The signal source (regulator feeds, counterparty self-disclosure, market data) is part of the substrate-build follow-on. |

## 6. Reconciliation

- **Events produced:** `CounterpartyEligibilityScreened`, `CounterpartyEligibilityRevalidated`, `CounterpartyEligibilityBreached`.
- **Per-event check:** every `CounterpartyEligibilityScreened` and `CounterpartyEligibilityRevalidated` must carry at least one `evidenceRef` (enforced at the Zod schema level).
- **Cross-domain check:** Vera (Internal-audit / continuous-assurance engineer) recon ensures no `Order*` event fires for a counterparty without a current `CounterpartyEligibilityScreened` (or `CounterpartyEligibilityRevalidated`) outcome of `institutional-eligible`. A `CounterpartyEligibilityBreached` event invalidates the prior screening — orders for the counterparty must halt until a fresh `institutional-eligible` outcome is recorded.
- **Citation check:** every event's `citations` array must include FAIS s.45 (`[citation: TBC]`) + at least one Mira (Compliance / RegTech engineer) PR #70 FAIS Posture A URN.
- **Failure mode:** rejected at Step 4 or Step 5 — no lifecycle entry; the failure surfaces as `AgentEscalation` to Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets, governance).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CounterpartyEligibilityScreened` event | event store | per FAIS retention (`[citation: TBC]`) | restricted (counterparty-confidential) |
| `CounterpartyEligibilityRevalidated` event | event store | per FAIS retention (`[citation: TBC]`) | restricted |
| `CounterpartyEligibilityBreached` event | event store | per FAIS retention (`[citation: TBC]`) | restricted |
| Screening rationale document | `Owner Inbox/<counterpartyId>/eligibility-screening-<screeningId>.md` | per counterparty-master-data retention | restricted |

## 8. Substrate gaps named (NOT built in this PR)

- **`prototype/platform/lifecycle/counterparty-eligibility.ts`** — typescript module that performs the actual classification logic + emits the events. **Owner:** Atlas (Core banking platform architect) + Niko (Sales / CRM engineer) joint follow-on PR.
- **Vera (Internal-audit / continuous-assurance engineer) Wave-4 finding-pipeline** — the `Order*`-without-current-eligibility recon (cross-domain check above). **Owner:** Vera planning task.
- **Institutional-eligibility-criteria-as-code** — typed criteria taxonomy at `prototype/platform/lifecycle/eligibility-criteria.ts`. **Owner:** Niko (Sales / CRM engineer) + Imani (Legal-as-code engineer) joint follow-on; legal-as-code engineer authors the criteria-typed definitions; CRM engineer consumes.
- **Counterparty-master-data interaction** — Niko's wider lifecycle substrate (counterparty registration, FK references, status projections). Out of scope for this v0 PR.
- **FAIS s.45 sub-section refs** — `[citation: TBC pending counsel]` until counsel ratifies at the licence-application gate. Tracked under Imani (Legal-as-code engineer)'s external-counsel scope (`Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`).
