---
id: PROC-PLAT-EV-EVOL-01
title: Event Schema Evolution
owner: Atlas
policy-parent: D-NEW-PRODUCT-APPROVAL-POLICY
status: STUB
last-reviewed: 2026-05-10
reconciliation-cadence: per-amendment (single cycle from `EventSchemaAmendmentProposed` to `EventSchemaAmended`)
---

# Procedure — Event Schema Evolution

**Procedure ID:** PROC-PLAT-EV-EVOL-01
**Owner:** Atlas (Core banking platform architect — substrate authority for event types)
**Co-actors:** Anya (projection runtime / data contracts) · Senna + Rashida (security review where the amendment touches authoritative-state risk or new trust boundaries) · Mira (citation gate) · Vera (audit visibility) · the domain owner whose events are amended (e.g. Saskia for product events, Bea for accounting events, Tomas for settlement events)
**Approval:** BRC where the amendment crosses a substrate-resilience tolerance; Atlas-direct for non-material amendments under Change Management Policy + Secure SDLC Policy
**Cadence:** Per-amendment; fires on `EventSchemaAmendmentProposed`; runs continuously while amendment is active; closes on `EventSchemaAmended`
**Version:** v0.1 — 2026-05-10
**Status:** **STUB** — authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval; binds at next event-schema amendment for any event type with existing events in the store

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` § 11 (typed-event surface). The NPA policy creates and amends event types throughout the product lifecycle; this procedure is the cross-cutting schema-amendment procedure the policy depends on once events of a type exist in the store.
- Sibling parent policies: Change Management Policy + Secure SDLC Policy + Information Security Policy (via [`change-management.md`](change-management.md), [`secure-sdlc.md`](secure-sdlc.md), [`agent-runtime-deploy.md`](agent-runtime-deploy.md)).
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md` (which routes this procedure to Owen) and `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md` (which scopes the construction substrate Atlas owns).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| CLAUDE.md Principle 1 | Events are the only source of truth; "as-of" replay is a first-class capability. | This procedure protects replay correctness across schema versions. |
| CLAUDE.md Principle 4 | Security designed-in; threat model on every new authoritative-state risk. | Step on threat-model gate where the amendment introduces new trust boundaries. |
| BCBS 239 — Risk data aggregation and risk reporting | Data lineage / accuracy / completeness across changes. | Migration plan documents lineage from old to new schema. |
| `ORG-CY-*` (Joint Standard 2 of 2024) | Cyber-resilient operational substrate. | Threat-model gate + signed builds. |
| `ORG-PR-18` | Operational Resilience — Important Business Services. | Substrate is itself an IBS once domain agents host on it. |

## 3. Purpose

Govern every amendment to an event-type schema after events of that type exist in the store. The procedure ensures (a) replay correctness — events emitted under the old schema can still be replayed and projected; (b) migration safety — existing events are upgraded (in-place or via a versioned read-side adapter) without loss of fidelity; (c) downstream-projection coherence — Anya's projections, Vera's recon harnesses, and domain handlers all consume the amended schema correctly; and (d) citation integrity — the amendment carries a citation chain to the parent policy or substrate decision that motivates it.

The procedure is invoked by [`new-product-due-diligence.md`](new-product-due-diligence.md) Step 6 (dimension 5 — operational readiness) when a new product requires new event types or amendments to existing event types. It also runs independently for non-product event-schema changes (substrate, accounting, compliance, etc.).

## 4. Trigger

- An `EventSchemaAmendmentProposed { eventType, fromVersion, toVersion, amendment, motivation, motivationCitation, asOf }` event arrives. The proposal mechanism is a substrate event emitted by:
  - The domain owner whose events are being amended (e.g. Saskia for `Product*` events, via [`new-product-due-diligence.md`](new-product-due-diligence.md) Step 6);
  - Atlas directly for substrate-level event types (e.g. `AgentRegistered`, `PermissionPolicyPublished`); or
  - Mira where a regulatory-change feed surfaces an obligation that requires a schema field change.
- A pull request modifying anything under `prototype/platform/event-store/event-types.ts` for an event type that already has events in the store.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Eligibility classification. The substrate classifies the amendment as one of: `additive-optional` (new optional field), `additive-required` (new required field), `field-rename`, `field-removal`, `type-narrowing`, `semantic-redefinition`. The class drives the migration shape. | Atlas · system | `@platform/event-store/schema-evolution` (PLANNED) | `additive-optional` is the safest; `semantic-redefinition` is the most dangerous and may require event-type fork rather than amendment. |
| 2 | Threat-model gate. If the amendment introduces a new trust boundary, alters ordering / durability / replay semantics, or changes authoritative-state risk, Senna + Rashida lead a threat model before merge. | Senna · Rashida · Atlas | `@platform/secure-sdlc` (per [`secure-sdlc.md`](secure-sdlc.md)) | Per CLAUDE.md Principle 4. |
| 3 | Migration-plan authoring. Atlas authors the migration plan: in-place upgrade vs versioned read-side adapter; backfill strategy for existing events; deprecation timeline for the old version (if read-side adapter); reconciliation harness coverage for both versions during cutover. | Atlas | `@platform/event-store/migration-plan` (PLANNED) | The plan is itself a typed event payload (`EventSchemaMigrationPlanRegistered`). |
| 4 | Citation gate. The amendment must carry a citation chain — to a CEO-decision (e.g. `D-NEW-PRODUCT-APPROVAL-POLICY`), to a sub-policy (e.g. RAS, Sanctions Policy), to a regulator instrument, or to an internal substrate decision. Mira's `mira:citation-gate` handler asserts. | Mira (citation gate) | `@platform/citation/gate.ts` | CI-gated; failure blocks merge. |
| 5 | Downstream-projection / recon coverage check. Anya identifies every projection consuming the event type; Vera identifies every recon harness asserting on it. Each must be updated (or version-tolerant) before the amendment merges. | Anya · Vera · Atlas | `@platform/data/projection-registry`, `@platform/recon/*` | Dependency graph from the projection registry. |
| 6 | Domain-owner attestation. The domain owner whose events are amended attests the amendment preserves intent (semantic preservation). For Product events, Saskia attests. For Accounting events, Bea. For Settlement events, Tomas. Etc. | Domain owner | `@platform/event-store/schema-evolution` (PLANNED) | Captured as `EventSchemaDomainAttestation`. |
| 7 | Bootstrap / replay test. Run a replay of a representative event-store slice through the migration plan; assert projections produce the same observable state at the same as-of timestamps. Differences must be explained by the amendment's intent. | Atlas · CI | `bun run replay-test` (PLANNED) | Required before any `EventSchemaAmendmentApproved` emit. |
| 8 | Recon. `bun run citation-gate` + `bun run recon:prose-duplication` + (when Wave-4 lands) `recon:agent-discipline` + `recon:event-schema-coverage` (PLANNED) must be green. | Vera (recon) | `@platform/recon/*` | Recon failure blocks deploy. |
| 9 | Approval. For non-material amendments (e.g. `additive-optional` with full read-side compatibility), Atlas approves directly under Change Management Policy. For material amendments, BRC approves (CEO-interim ratifies until BRC constituted). Approval emits `EventSchemaAmendmentApproved`. | Atlas / BRC / CEO | `@platform/governance/brc-vote` (PLANNED) | Materiality criteria documented in the migration plan. |
| 10 | Deploy + close. The amendment is merged; the substrate emits `EventSchemaAmended { eventType, fromVersion, toVersion, migrationPlanId, asOf }`; Atlas confirms the live registry reflects the new version. | Atlas | `@platform/change-management`, `@platform/event-store/registry` | Closes the amendment cycle. |

## 6. Reconciliation

- **Events produced:** `EventSchemaAmendmentProposed`, `EventSchemaMigrationPlanRegistered`, `EventSchemaDomainAttestation` (one per affected domain), `EventSchemaAmendmentApproved` (single), `EventSchemaAmended` (terminal).
- **Reconciliation check:** every `EventSchemaAmendmentProposed` resolves to either `EventSchemaAmended` or an explicit `EventSchemaAmendmentWithdrawn`. The replay-test result (Step 7) is captured as a `EventSchemaReplayTestPassed` event and is a precondition for `EventSchemaAmendmentApproved`. Live event-store registry version matches the latest `EventSchemaAmended` version.
- **Failure mode:** replay-test fails (Step 7) → migration plan re-authored or amendment withdrawn. Citation gate fails (Step 4) → motivation citation added or amendment withdrawn. Domain attestation refused (Step 6) → amendment renegotiated with domain owner.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `EventSchemaAmendmentProposed` / `EventSchemaAmended` | Event log (P1) | Indefinite | Internal |
| Migration plan | `@platform/event-store/migration-plan` (PLANNED); also Owner Inbox `YYYY-MM-DD_atlas_event-schema-migration_<eventType>.md` | Indefinite | Internal |
| Threat-model evidence (where applicable) | Senna's threat-model register | Per Senna policy | Confidential — security |
| Replay-test output | CI logs + `EventSchemaReplayTestPassed` event payload | Indefinite | Internal |
| `EventSchemaDomainAttestation` (per domain) | Event log | Indefinite | Internal |
| BRC approval (where applicable) | `@platform/governance/brc-vote` (PLANNED) | Indefinite | Internal |

## 8. Manual steps

- Senna + Rashida threat-model decisions are human-led; captured as typed events.
- Atlas-direct vs BRC-route classification (Step 9 materiality) is human discretion documented in the migration plan.
- Build-phase: migration plans are filed as Owner Inbox deliverables until `@platform/event-store/migration-plan` lands. Replay-test substrate is partially scaffolded under Atlas's prototype.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Replay-test diff not explained by amendment intent | Step 7 | Atlas — re-author migration plan or withdraw amendment |
| Citation gate failure | Step 4 (Mira) | Atlas — add motivation citation or withdraw |
| Domain owner refuses attestation | Step 6 | Saskia / Bea / Tomas / etc. — renegotiate amendment scope |
| Threat-model gate flagged | Step 2 | Rashida + Senna — pre-merge gate |
| Downstream projection / recon coverage missing | Step 5 | Anya + Vera — update before merge |
| Live registry version drift after deploy | Step 10 | Atlas — investigate; non-zero exit blocks deploy |
| Replay-test substrate unavailable (build-phase) | Step 7 | Atlas + Devon — interim manual replay against representative slice; substrate gap captured |

## 10. Related procedures

- [`agent-runtime-deploy.md`](agent-runtime-deploy.md) — substrate-event-type changes flow through that procedure too; this procedure is the schema-amendment specialisation.
- [`change-management.md`](change-management.md) — parent procedure for non-material amendments.
- [`secure-sdlc.md`](secure-sdlc.md) — threat-model gate at Step 2.
- [`new-product-due-diligence.md`](new-product-due-diligence.md) — Step 6 (dimension 5 — operational readiness) invokes this procedure when a new product requires new event types.
- [`product-retirement-migration.md`](product-retirement-migration.md) — may invoke this procedure when retirement requires a terminal event type added or amended.

## 11. Citations

- **[policy: D-NEW-PRODUCT-APPROVAL-POLICY]** — parent policy (covers product event types under §11 typed-event surface).
- **[policy: Change Management Policy]** — non-material amendments.
- **[policy: Secure SDLC Policy]** — threat-model gate.
- **[principle: CLAUDE.md P1]** — events are the only source of truth; replay correctness.
- **[principle: CLAUDE.md P2]** — atomic citation discipline; every amendment carries a motivation citation.
- **[principle: CLAUDE.md P4]** — security designed-in; threat-model gate.
- **[principle: CLAUDE.md P6]** — single-graph discipline; data-layer changes propagate cleanly upward to presentations.
- **[register: ORG-CY-*]** — Cybersecurity (Joint Standard 2 of 2024).
- **[register: ORG-PR-18]** — Operational Resilience.

## 12. Substrate gaps

- `@platform/event-store/schema-evolution`, `@platform/event-store/migration-plan`, `@platform/event-store/registry` (versioned), `@platform/data/projection-registry`, `@platform/recon/event-schema-coverage`, `bun run replay-test` are PLANNED. The procedure runs by Atlas-led ad-hoc cadence until the substrate components land.
- Replay-test substrate is partially scaffolded (Atlas's prototype) but not yet wired to the procedure as a CI gate.
- Citation gate (`@platform/citation/gate.ts`) is live; covers Step 4.

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-10 | Owen (via Scrooge) | Initial draft authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval. Cross-cutting schema-amendment procedure that the NPA policy depends on once events of a type exist in the store. STUB — substrate PLANNED. |

## 14. Audit / assurance

Vera consumes the schema-amendment event series — `EventSchemaAmendmentProposed` → migration-plan → domain-attestations → replay-test-passed → `EventSchemaAmended` — as continuous-controls evidence. Findings: amendments without replay-test evidence, citation-chain gaps, domain attestations missing on affected event types, live-registry version drift. Reportable to Owen + Atlas; structural findings flow to Devon (substrate ownership).
