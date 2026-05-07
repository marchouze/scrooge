# Institutional client lifecycle — design proposal

**Author:** Niko (Sales / CRM engineer; reports to Devon, COO)
**Coordinators:** Saskia (counterparty engagement), Imani (legal-as-code), Mira (KYC / sanctions integration), Zara (CCO sign-off), Anya (event-sourced client master), Vera (audit seam), Senna (security review).
**Date:** 2026-05-06
**For:** Marc (CEO)
**Authority:** CEO strategic-foundation decision (2026-05-06) + build-only operating-posture decision (2026-05-06) + Round 1 client-master + continuous-KYC approvals.
**Status:** **Proposal + first domain module shipped.** Module: `prototype/domains/customer/` · Scenario: `prototype/scenarios/02-onboard-counterparty.ts` · Tests: `prototype/tests/customer.test.ts`.

> **Derivation note (Principle 6 — downward).** This proposal derives from the strategic foundation, the build-only decision, the client-master + continuous-KYC architecture (Round 1), Saskia's franchise-design brief, and Mira's existing onboarding / sanctions procedures. No new architectural substance is authored here; the proposal is the application of those to a coded institutional-client-lifecycle capability.

---

## 1. Scope (CEO-set, not for re-litigation)

- **Client base:** institutional only — large SA corporates, banks, non-bank FIs.
- **Geography:** SA, single branch.
- **Posture:** build-only. Lifecycle designed and built end-to-end against synthetic counterparties; soft-franchise track is real-world but non-contractual.
- **KYC default:** Tier-1 institutional, two-tier continuous-KYC.

## 2. Lifecycle stages

Nine stages, each with a typed actor, a system capability invocation, an event emission, and an exit condition. The stages run as an event-sourced workflow; no stage holds state outside the event log.

| # | Stage | Trigger | Actor | System capability | Event emitted | Exit |
|---|---|---|---|---|---|---|
| 1 | Sounding | Saskia / Niko initiates | human (Saskia / Niko) | `@domains/customer/sounding` | `CounterpartySoundingOpened` | Mutual interest expressed (no contractual force). |
| 2 | Prospect onboarding | Sounding converts to formal prospect | system + human (Niko) | `@domains/customer/prospect` | `CounterpartyProspectRegistered` | Prospect ready for KYC. |
| 3 | Tier-1 KYC | Prospect registered | system (`@domains/compliance/kyc`) | Mira's `kyc-onboarding.md` procedure | `KycCompleted` (Tier-1 institutional) | KYC passed; sanctions cleared. |
| 4 | Documentation negotiation | KYC passed | human + system (Imani's clause library) | `@domains/legal/master-agreements` | `DocumentationDrafted` → `DocumentationReadyToExecute` | All required masters at ready-to-execute state. |
| 5 | Authorised-signatory record | Documentation finalising | human (counterparty + Niko) + system | `@domains/customer/signatory-book` | `AuthorisedSignatoryAdded` (per person) | At least one authorised trader and one authorised signatory recorded. |
| 6 | Mandate / appetite assignment | Documentation ready + signatories recorded | human (Saskia within Helena's RAS envelope) | `@domains/markets/mandates` | `MandateAssigned` | Mandate within RAS; counterparty entitled to specified products / limits. |
| 7 | Operational go-live | Build-only: switch at licence-grant | system (configuration switch) | `@domains/customer/lifecycle` | `CounterpartyActivated` | Counterparty transactable. **Not exercised during build phase.** |
| 8 | Continuous KYC | Recurring + signal-driven | system (`kyc-recurring.md`, `kyc-continuous.md`) | Mira's screening pipelines | `KycReviewCompleted` / `KycSignalRaised` | Tier remains valid or escalation. |
| 9 | Off-boarding | Counterparty exit / mandate termination | human + system | `@domains/customer/lifecycle` | `MandateRevoked` → `CounterpartyOffboarded` | Position run-off complete; record archived but events retained per records policy. |

The build-phase posture: stages 1–6 and 8 run end-to-end against synthetic counterparties in `prototype/simulators/counterparties/`. Stage 7 is the licence-day configuration switch. Stage 9 exists but does not exercise (no live counterparties to off-board).

## 3. Event-sourced client master

Per Principle 1 the client master is a projection. The canonical events:

| Event type | Emitter | Payload |
|---|---|---|
| `CounterpartySoundingOpened` | sales | counterpartyId, channel, intro source |
| `CounterpartyProspectRegistered` | sales | counterpartyId, legalName, jurisdiction, sector |
| `KycCompleted` | compliance | counterpartyId, tier, pep, sanctions, jurisdictionalRisk, citations |
| `DocumentationDrafted` | legal | counterpartyId, agreementType (ISDA / GMRA / CSA), version |
| `DocumentationReadyToExecute` | legal | counterpartyId, agreementType, ready-pkg-hash |
| `AuthorisedSignatoryAdded` | sales | counterpartyId, personId, scope (signatory / authorised trader), evidence |
| `AuthorisedSignatoryRemoved` | sales | counterpartyId, personId, reason |
| `MandateAssigned` | markets | counterpartyId, products, limits, RAS envelope reference |
| `MandateRevised` | markets | counterpartyId, productsΔ, limitsΔ, reason |
| `CounterpartyActivated` | system | counterpartyId, activatedAt, configSwitchEventId |
| `KycReviewCompleted` | compliance | counterpartyId, tier, periodicity, findings |
| `KycSignalRaised` | compliance | counterpartyId, signalType, severity, evidence |
| `MandateRevoked` | markets | counterpartyId, reason |
| `CounterpartyOffboarded` | system | counterpartyId, finalSettlementHash |

Every event carries:
- `entity`: `BANK-ZA-001` (Principle 5 — multi-entity-ready).
- `actor`: typed Principal (system / human / service) — matches `@platform/identity`.
- `citations`: at least one obligations-register entry. Onboarding cites `FIC-S21` (CDD) and the FIC GN 7 RBA; documentation cites the relevant ISDA / GMRA standard versions; mandate cites the bank's RAS / RAF and the counterparty-credit policy.

Projections (cached views of the event log):
- **Counterparty master** — `(counterpartyId) → { legalName, jurisdiction, sector, currentTier, currentMandate, status }`.
- **ISDA negotiation tracker** — `(counterpartyId, agreementType) → status`.
- **Authorised-signatory book** — `(counterpartyId) → list<{ personId, scope }>`.
- **Mandate book** — `(counterpartyId) → currentMandate + history`.

## 4. ISDA negotiation tracker

The tracker is a projection of `DocumentationDrafted` / `DocumentationReadyToExecute` events keyed by (counterpartyId, agreementType). States it surfaces:

`Sounding → InPrinciple → Drafted → Reviewed → ReadyToExecute → Executed`

The build-only posture caps the tracker at `ReadyToExecute` for live counterparties; `Executed` is reachable only via the `CounterpartyActivated` configuration-switch path at licence-grant.

The tracker integrates with Imani's clause-library-as-code at the `Drafted` transition: drafting calls Imani's library to produce the structured master-agreement document; the tracker stores the document hash and version, not the document body.

## 5. Tier-1 KYC default

Per Round 1, the bank's continuous-KYC default for the institutional client base is Tier-1: enhanced due diligence at onboarding (UBO chain, PEP screen, sanctions check, adverse-media search, jurisdictional-risk score) plus continuous re-evaluation on signals. Mira's existing procedures (`kyc-onboarding.md`, `sanctions-screening.md`) are the operational substrate. The lifecycle invokes these procedures at stage 3; the procedures emit their existing events; the customer module reads them as inputs to `KycCompleted`.

## 6. Soft-franchise track

The soft-franchise track is captured at stage 1 (`CounterpartySoundingOpened`) without forcing a `CounterpartyProspectRegistered` event. The tracker projection includes a "soundings book" view distinct from the prospect / client books, so Saskia has visibility on relationships that have not yet converted to prospects, and the audit trail does not falsely report "onboarding" before contract.

## 7. Conduct & FAIS context

Build-only posture means no FSP licence is pursued during the build. The FAIS conduct surface (advice records, intermediary records, suitability assessments) is therefore part of the *built and rehearsed* programme — every FAIS-required artefact has a coded generator that runs against synthetic flows; switch-to-live at licence-grant does not require new build, only configuration.

## 8. Out of scope

- Retail flows; SME / commercial flows; cash handling; branch onboarding.
- Anything that introduces a payments-rail offering to third parties.
- Customer-facing PII storage during the build (synthetic only; clearly labelled `SIMULATED`).

## 9. First domain module — shipped today

Per the brief, alongside this proposal:

- **Module:** `prototype/domains/customer/` — event types, sounding & onboarding flow, counterparty-master projection, authorised-signatory-book projection, ISDA-tracker projection, public surface.
- **Scenario:** `prototype/scenarios/02-onboard-counterparty.ts` — end-to-end synthetic onboarding from sounding → activation, with citations.
- **Tests:** `prototype/tests/customer.test.ts` — round-trip of all event types; projection idempotence under as-of replay; soft-franchise vs prospect separation; KYC tier integration.

Status: **CI-green at first ship.** The module imports only `@platform/*` interfaces; the cloud lift swaps substrates without touching the domain code.

## 10. Dependencies and follow-ups

- **Saskia's franchise design (D4)** will name priority counterparties (S2) — those become the synthetic counterparties seeded into the lifecycle.
- **Imani's clause-library-as-code** is required to populate the `Drafted` transition at stage 4. In the interim, the module emits `DocumentationDrafted` with a placeholder `package: "imani-clause-library:pending"` payload.
- **Mira's KYC tier-1 procedure** is referenced as a citation at stage 3; the procedure is populated; the engineering substrate (continuous-KYC pipeline) lands at M4+ in the reporting-capability M-phase plan.
- **Vera's continuous-controls programme** assures this module's citation integrity, mandate-ownership integrity, and orphan-detection. Coordinated at design time per the brief.

## 11. Open questions for CEO (none today)

The proposal does not surface any decisions that need CEO action today; it operates within the strategic-foundation envelope and the build-only posture. Decisions that *will* surface:

- Priority-counterparty list (lands inside D4 / S2).
- Mandate-revision authority delegation (within the Delegation-of-Authority procedure, planned).
- Soft-franchise contact-cadence governance (Saskia and Niko to propose).

—Niko
