---
policy-parent: Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md §11 — NPA Policy; Change Management Policy; Secure SDLC Policy
last-reviewed: 2026-05-15
procedureId: PROC-PLAT-EV-EVOL-01
title: Event schema evolution
author: Atlas (Core banking platform architect) · Anya (Dashboard & projection engineer)
date: 2026-05-15
owner: Atlas (Core banking platform architect) · Anya (Dashboard & projection engineer) · Rashida (Chief Information Security Officer, governance) · Mira (Regulatory intelligence engineer) · Vera (Internal-audit / continuous-assurance engineer)
status: POPULATED
policy-cited: Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md §11 — NPA Policy; Change Management Policy; Secure SDLC Policy
system-capability: prototype/platform/event-store/schema-evolution (PLANNED)
---

# Procedure — Event schema evolution

**Procedure ID:** PROC-PLAT-EV-EVOL-01
**Owner:** Atlas (Core banking platform architect — substrate authority for event types)
**Co-actors:** Anya (Dashboard & projection engineer — projection runtime / data contracts) · Rashida (Chief Information Security Officer, governance — threat model authority and security review where amendment touches authoritative-state risk or new trust boundaries) · Senna (Security engineer, engineering — threat-model execution and security-control implementation) · Mira (Regulatory intelligence engineer — citation gate) · Vera (Internal-audit / continuous-assurance engineer — audit visibility) · the domain owner whose events are amended (e.g. Saskia for product events, Bea for accounting events, Tomas for settlement events)
**Approval:** BRC where the amendment crosses a substrate-resilience tolerance; Atlas-direct for non-material amendments under Change Management Policy + Secure SDLC Policy
**Cadence:** Per-amendment; fires on `EventSchemaAmendmentProposed`; runs continuously while amendment is active; closes on `EventSchemaAmended`
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **NPA Policy — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` § 11** (typed-event surface). The NPA policy creates and amends event types throughout the product lifecycle; this procedure is the cross-cutting schema-amendment procedure the policy depends on once events of a type exist in the store.
- Sibling parent policies: Change Management Policy + Secure SDLC Policy + Information Security Policy (via `change-management.md`, `secure-sdlc.md`, `agent-runtime-deploy.md`).
- Decision records: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md` and `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md`.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| CLAUDE.md Principle 1 | Events are the only source of truth; "as-of" replay is a first-class capability. | Procedure protects replay correctness across schema versions. |
| CLAUDE.md Principle 4 | Security designed-in; threat model on every new authoritative-state risk. | Threat-model gate at Step 2 where amendment introduces new trust boundaries. |
| BCBS 239 — Risk data aggregation and risk reporting | Data lineage / accuracy / completeness across changes. | Migration plan documents lineage from old to new schema. |
| `ORG-CY-01` (Joint Standard 2 of 2024) | Maintain cybersecurity and cyber-resilience framework. | Threat-model gate + signed builds. |
| `ORG-PR-18` (BCBS Operational Resilience) | Identify Important Business Services; severe-but-plausible scenario testing. | Substrate is an IBS once domain agents host on it. |

## 3. Purpose

Govern every amendment to an event-type schema after events of that type exist in the store. The procedure ensures: (a) **replay correctness** — events emitted under the old schema can still be replayed and projected; (b) **migration safety** — existing events are upgraded via in-place upgrade or versioned read-side adapter without loss of fidelity; (c) **downstream-projection coherence** — Anya's projections, Vera's recon harnesses, and domain handlers all consume the amended schema correctly; and (d) **citation integrity** — the amendment carries a citation chain to the parent policy or substrate decision that motivates it.

The procedure is invoked by `new-product-due-diligence.md` Step 6 (dimension 5 — operational readiness) when a new product requires new event types or amendments to existing event types. It also runs independently for non-product event-schema changes (substrate, accounting, compliance, etc.).

## 4. Trigger

- An `EventSchemaAmendmentProposed { eventType, fromVersion, toVersion, amendment, motivation, motivationCitation, asOf }` event arrives, emitted by:
  - The domain owner whose events are being amended (e.g. Saskia for `Product*` events, via `new-product-due-diligence.md` Step 6);
  - Atlas directly for substrate-level event types (e.g. `AgentRegistered`, `PermissionPolicyPublished`); or
  - Mira where a regulatory-change feed surfaces an obligation requiring a schema field change.
- A pull request modifying anything under `prototype/platform/event-store/event-types.ts` for an event type that already has events in the store.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Eligibility classification.** Classify the amendment as one of: `additive-optional` (new optional field), `additive-required` (new required field), `field-rename`, `field-removal`, `type-narrowing`, `semantic-redefinition`. The class drives the migration shape. | Atlas · `system` | `@platform/event-store/schema-evolution` (`PLANNED`) | `additive-optional` is the safest; `semantic-redefinition` may require event-type fork rather than amendment. Classification emits `EventSchemaAmendmentClassified { eventType, class }`. |
| 2 | **Threat-model gate.** If the amendment introduces a new trust boundary, alters ordering / durability / replay semantics, or changes authoritative-state risk, Rashida — as CISO governance authority — together with Senna — providing security-engineering execution — lead a threat model before merge. | Rashida (Chief Information Security Officer, governance) · Senna (Security engineer, engineering) · Atlas | `@platform/secure-sdlc` (per `secure-sdlc.md`) | Per CLAUDE.md Principle 4. Threat-model result emits `ThreatModelCompleted { amendment, outcome, mitigations }`. |
| 3 | **Migration-plan authoring.** Atlas authors the migration plan: in-place upgrade vs versioned read-side adapter; backfill strategy for existing events; deprecation timeline for the old version (if read-side adapter); reconciliation harness coverage for both versions during cutover. | Atlas | `@platform/event-store/migration-plan` (`PLANNED`) | The plan is itself a typed event payload: `EventSchemaMigrationPlanRegistered { eventType, migrationPlanId, strategy, backfillStrategy, reconciliationHarness }`. |
| 4 | **Citation gate.** The amendment must carry a citation chain — to a CEO decision (e.g. `D-NEW-PRODUCT-APPROVAL-POLICY`), to a sub-policy (e.g. RAS, Sanctions Policy), to a regulator instrument, or to an internal substrate decision. Mira's `mira:citation-gate` handler asserts. | Mira (citation gate) | `@platform/citation/gate.ts` ✓ | CI-gated; failure blocks merge. |
| 5 | **Downstream-projection / recon coverage check.** Anya identifies every projection consuming the event type; Vera identifies every recon harness asserting on it. Each must be updated (or version-tolerant) before the amendment merges. | Anya · Vera · Atlas | `@platform/data/projection-registry` (`PLANNED`), `@platform/recon/*` | Dependency graph from the projection registry. Coverage-check result emits `EventSchemaDownstreamCoverageChecked { eventType, projectionsUpdated, reconHarnessesUpdated }`. |
| 6 | **Domain-owner attestation.** The domain owner whose events are amended attests the amendment preserves intent (semantic preservation). For Product events: Saskia. For Accounting events: Bea. For Settlement events: Tomas. Etc. | Domain owner | `@platform/event-store/schema-evolution` (`PLANNED`) | Captured as `EventSchemaDomainAttestation { eventType, domainOwner, attestedAt, preservationStatement }`. |
| 7 | **Bootstrap / replay test.** Run a replay of a representative event-store slice through the migration plan; assert projections produce the same observable state at the same as-of timestamps. Differences must be explained by the amendment's intent. | Atlas · CI | `bun run replay-test` (`PLANNED`) | Required before any `EventSchemaAmendmentApproved` emit. Result emits `EventSchemaReplayTestPassed { eventType, sliceRef, testRunId }`. |
| 8 | **Recon.** `bun run citation-gate` + `bun run recon:prose-duplication` + (when Wave-4 lands) `recon:agent-discipline` + `recon:event-schema-coverage` must be green. | Vera (recon) | `@platform/recon/*` | Recon failure blocks deploy. |
| 9 | **Approval.** For non-material amendments (e.g. `additive-optional` with full read-side compatibility), Atlas approves directly under Change Management Policy. For material amendments, BRC approves (CEO-interim ratifies until BRC constituted). Approval emits `EventSchemaAmendmentApproved { eventType, approvedBy, materiality, approvedAt }`. | Atlas / BRC / CEO | `@platform/governance/brc-vote` (`PLANNED`) | Materiality criteria documented in the migration plan. |
| 10 | **Deploy + close.** The amendment is merged; the substrate emits `EventSchemaAmended { eventType, fromVersion, toVersion, migrationPlanId, asOf }`; Atlas confirms the live registry reflects the new version. | Atlas | `@platform/change-management` ✓, `@platform/event-store/registry` | Closes the amendment cycle. Registry version drift after deploy is a blocking failure. |

## 6. Reconciliation

- **Events produced:** `EventSchemaAmendmentProposed`, `EventSchemaAmendmentClassified`, `EventSchemaMigrationPlanRegistered`, `EventSchemaDownstreamCoverageChecked`, `EventSchemaDomainAttestation` (one per affected domain), `EventSchemaReplayTestPassed`, `EventSchemaAmendmentApproved` (single), `EventSchemaAmended` (terminal); or `EventSchemaAmendmentWithdrawn` if withdrawn.
- **Reconciliation check:** Every `EventSchemaAmendmentProposed` resolves to either `EventSchemaAmended` or `EventSchemaAmendmentWithdrawn`. The replay-test result (`EventSchemaReplayTestPassed`) is a precondition for `EventSchemaAmendmentApproved`. Live event-store registry version matches the latest `EventSchemaAmended` version.
- **Failure mode:** replay-test fails → migration plan re-authored or amendment withdrawn. Citation gate fails → motivation citation added or amendment withdrawn. Domain attestation refused → amendment renegotiated with domain owner.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `EventSchemaAmendmentProposed` / `EventSchemaAmended` events | Event log (P1) | Indefinite | Internal |
| Migration plan | `@platform/event-store/migration-plan` (`PLANNED`); also `Owner Inbox/YYYY-MM-DD_atlas_event-schema-migration_<eventType>.md` | Indefinite | Internal |
| Threat-model evidence (where applicable) | Senna's threat-model register | Per Senna policy | Confidential — security |
| Replay-test output + `EventSchemaReplayTestPassed` event | CI logs + event log | Indefinite | Internal |
| `EventSchemaDomainAttestation` (per domain) | Event log | Indefinite | Internal |
| BRC approval (where applicable) | `@platform/governance/brc-vote` (`PLANNED`) | Indefinite | Internal |
| Citation-gate and recon run results | CI logs + event log | Indefinite | Internal |

## 8. Manual steps

- **Step 2** (Senna + Rashida threat-model decisions) — human-led; captured as typed events.
- **Step 9** (Atlas-direct vs BRC-route materiality classification) — human discretion documented in the migration plan.
- **Build-phase:** migration plans are filed as Owner Inbox deliverables until `@platform/event-store/migration-plan` lands. Replay-test substrate is partially scaffolded under Atlas's prototype; manual replay against a representative slice is acceptable with typed evidence until the full substrate lands.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Replay-test diff not explained by amendment intent | Step 7 | Atlas — re-author migration plan or withdraw amendment |
| Citation gate failure | Step 4 (Mira) | Atlas — add motivation citation or withdraw amendment |
| Domain owner refuses attestation | Step 6 | Relevant domain owner (Saskia / Bea / Tomas / etc.) — renegotiate amendment scope |
| Threat-model gate flagged | Step 2 | Rashida + Senna — pre-merge gate; amendment blocked until mitigations in place |
| Downstream projection / recon coverage missing | Step 5 | Anya + Vera — update before merge; no merge until coverage complete |
| Live registry version drift after deploy | Step 10 | Atlas — investigate; non-zero exit blocks deploy; rollback considered |
| Replay-test substrate unavailable (build-phase) | Step 7 | Atlas + Devon — interim manual replay against representative slice; substrate gap captured as roadmap item |

## 10. Related procedures

- `agent-runtime-deploy.md` — populated; substrate-event-type changes flow through that procedure too; this procedure is the schema-amendment specialisation.
- `change-management.md` — populated; parent procedure for non-material amendments.
- `secure-sdlc.md` — populated; threat-model gate at Step 2.
- `new-product-due-diligence.md` — Step 6 (dimension 5 — operational readiness) invokes this procedure when a new product requires new event types.
- `product-retirement-migration.md` — may invoke this procedure when retirement requires a terminal event type added or amended.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-10 | Owen (Company Secretary, governance, via Scrooge) | Initial STUB. Authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval. Cross-cutting schema-amendment procedure the NPA policy depends on. STUB — substrate PLANNED. |
| v1.0 | 2026-05-15 | Atlas (Core banking platform architect) · Anya (Dashboard & projection engineer) | Promoted to POPULATED: full 12-section canonical body; YAML frontmatter standardised; former §§11–14 (Citations, Substrate gaps, Change log, Audit) mapped to canonical §§ 2, 10, 11, 12 respectively; no substantive content removed. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer) consumes the schema-amendment event series — `EventSchemaAmendmentProposed` → `EventSchemaMigrationPlanRegistered` → `EventSchemaDomainAttestation`(s) → `EventSchemaReplayTestPassed` → `EventSchemaAmended` — as continuous-controls evidence.

Findings raised by Vera: amendments without replay-test evidence; citation-chain gaps; domain attestations missing on affected event types; live-registry version drift. Findings are reportable to Owen (governance custodian) and Atlas (substrate authority); structural findings flow to Devon (COO, governance — substrate ownership).

Annual schema-evolution audit: Vera reviews all `EventSchemaAmended` events from the prior year, samples three for full migration-plan + replay-test completeness, and reports to BRC.
