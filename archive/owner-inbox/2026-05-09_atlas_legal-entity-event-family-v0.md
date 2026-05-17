---
title: Legal-entity event family v0 — LegalEntityRegistered + LegalEntityChanged + IntraGroupArrangementSigned
author: Atlas (Core banking platform architect; reports to Devon, Chief Operating Officer, governance)
date: 2026-05-09
summary: Three typed events + canonical seed at Regulations/_legal-entity-tree.md (mirrored to prototype/seeds/legal-entity-tree.json) materialise the Hoz Group + Hoz Bank + Hoz Securities entity tree into the event log. Discharges the substrate gap surfaced in the Imani + Owen v0 spec §6 against D-LEGAL-ENTITY-TREE-V0 (PR #82) + D-REGULATORY-PERIMETER (PR #85). 16 tests; recon:runtime-handler-sync clean; citation-gate clean.
decision-required: false
---

# Legal-entity event family v0

## What landed

This PR ships the typed-event substrate for the v0 legal-entity tree, closing the substrate gap surfaced in §6 of `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` (Imani, Legal-as-code engineer + Owen, Company Secretary, governance) under the CEO-resolved D-LEGAL-ENTITY-TREE-V0 (PR #82) + D-REGULATORY-PERIMETER (PR #85).

### 1. Three typed events at `prototype/platform/event-store/event-types.ts`

- **`LegalEntityRegistered`** — entity URN, legalName, registeredForm enum (`Ltd` | `RF` | `Pty`), ISO-2 jurisdiction, registeredOffice, parentEntityId (nullable for top-of-tree), `regulatoryRegime` (typed enum `PA` | `JSE` | `FSCA` | `none-companies-act-only` | `other` + ordered regimeAnchor list per D-REGULATORY-PERIMETER), directors array, registrationDate. Replay rule: `latest-wins-per-key`.
- **`LegalEntityChanged`** — entityId + `changeType` enum (`renamed` | `parent-changed` | `director-added` | `director-removed` | `regulatory-regime-updated` | `registered-office-changed`) + priorValue + newValue + effectiveDate. Both prior/new values required (a change without those is a registration). Replay rule: `cumulative-fold`.
- **`IntraGroupArrangementSigned`** — arrangementId + arrangementType enum (`services` | `ip-licensing` | `capital-injection` | `intra-group-exposure` | `other-related-party`) + fromEntityId + toEntityId (refine: must differ — no self-arrangements) + effectiveDate + optional terminationDate + armsLengthRationale + IAS24-disclosure-ref. Replay rule: `append-only-audit`.

All three carry per-event citations on the envelope (Principle 2). Citation hints set per type in the registry (Companies Act 71 of 2008, Banks Act 94 of 1990 §§ 7 / 60 / 73, FAIS Act 37 of 2002, JSE Rules, IAS 24, OECD TP Guidelines).

### 2. Registry entries at `prototype/platform/event-store/registry.ts`

A new `LEGAL_ENTITY_EVENT_TYPES` group registers the three types as `governance`-class with `Imani` as issuer and a fan-out subscriber list covering Owen, Mira, Bea, Yael, Helena, Camille, Anya, dashboard, and Vera. Wired into `EVENT_TYPE_REGISTRY` so `lookupEventType()` and `validatePayload()` work.

### 3. Canonical seed at `Regulations/_legal-entity-tree.md`

The canonical authoring location for the three-entity tree, per `feedback_canonical_source_registry.md` (single canonical authoring location per fact-type; cross-references are typed citations, never prose copies). Mirrors out to `prototype/seeds/legal-entity-tree.json` as a derived cache the substrate reads.

### 4. Tests at `prototype/tests/legal-entity-tree.test.ts`

**16 tests passing, 39 expect() calls.** Coverage:
- Round-trip valid registration / change / arrangement events.
- Citation slot enforcement (P2): empty citations rejected.
- `regulatoryRegime.primaryRegulator` enum enforcement.
- `regimeAnchor` ≥1 anchor enforcement.
- ISO-2 jurisdiction enforcement.
- `LegalEntityChanged` requires both `priorValue` and `newValue`.
- `IntraGroupArrangementSigned` requires `fromEntityId !== toEntityId`.
- Registry round-trip (governance class, Imani issuer, schema present).
- Canonical seed JSON parses against the registered schema for all three Hoz entities.
- Tree-shape: group has `parentEntityId=null`; bank+securities point at group.

### 5. CI checks

- `bun run typecheck` — clean.
- `bun run lint` (biome) — clean against changed files.
- `bun test tests/legal-entity-tree.test.ts` — 16 / 16 pass.
- `bun run recon:runtime-handler-sync` — passed (132 assertions, 0 violations).
- `bun run citation-gate` — passed (177 events, 0 violations).
- Pre-existing failures in `tests/runtime.test.ts` (Vera overnight-recon dry-run) are present on main; not introduced by this PR.

## Substrate gaps surfaced

Per Principle 7 (substrate-gap inventory transparency).

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | Substrate-side TypeScript module that reads `seeds/legal-entity-tree.json` and emits `LegalEntityRegistered` events into the event store | Atlas (Core banking platform architect) | Follow-on after this PR |
| 2 | Auto-emit `LegalEntityRegistered` when a CIPC reservation completes (registrar substrate) | Imani (Legal-as-code engineer) + counsel | Gated on D-HOZ-DOMAIN-REGISTRATION-SET deferral state — counsel engagement deferred per PR #86 |
| 3 | Per-entity obligations-register cross-reference — Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance) extends the per-entity scoping vocabulary in `Regulations/_obligations-register.md` (v1.8 from PR #84) to cite the typed-event family | Mira | Post-event-family ship; Mira's next scheduled run |
| 4 | `RegulatoryLicenceStatusChanged` typed event (sketched in v0 spec §6.2 — for licence-grant / suspension / withdrawal) | Atlas + Mira | Pre-licence application |
| 5 | Director roster population — v0 ships an empty `directors` array on each entity. The `LegalEntityChanged` `director-added` change-type fills the gap as fit-and-proper assessments clear (Sade's HR substrate is paused-with-reshape per CLAUDE.md operating-model section). | Sade (HR systems engineer; reshaped to AgentOps in build-phase) + Owen | Pre-licence application |
| 6 | Substantive intra-group contracts — v0 §2 stubs (services / IP licensing / capital injection / intra-group exposure) drafted to substantive contracts; each emits a real `IntraGroupArrangementSigned` event when executed | Imani drafting + Owen review + entity-board approval | Pre-licence-day |
| 7 | Yael (Tax engineer; reports to Camille, Chief Financial Officer, governance) transfer-pricing substrate consumes `IntraGroupArrangementSigned` stream for arm's-length pricing analysis + IAS 24 disclosure-generator | Yael | Post-revenue (Yael's tax slice is paused for PAYE / EMP201 / IRP5 in build-phase; CIT / VAT / STT / FATCA / CRS slice activates with revenue) |

## Citation chain

- **Principle 1** (`CLAUDE.md`) — events as source of truth.
- **Principle 5** (`CLAUDE.md`) — multi-entity from day one (`jurisdiction` field carries ISO-2; tree is multi-entity by design).
- **Principle 2** (`CLAUDE.md`) — every event carries citations on the envelope; payload-internal citations marked `[citation: TBC]` rather than invented.
- **D-LEGAL-ENTITY-TREE-V0** (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md`, PR #82).
- **D-REGULATORY-PERIMETER** (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md`, PR #85).
- **Imani + Owen joint v0 spec** (`Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md`, §6 — substrate-gap source).
- **Canonical-source registry rule** (`feedback_canonical_source_registry.md`) — `Regulations/_legal-entity-tree.md` is the canonical authoring location; the seed JSON is its derived cache.
- **Handlers-metadata three-way clash** (`feedback_handlers_metadata_three_way_clash.md`) — `recon:runtime-handler-sync` run before push (clean, 0 violations).

## Reporting line

Atlas (Core banking platform architect) → Devon (Chief Operating Officer, governance) → CEO.
