---
title: Legal-entity tree — Hoz Group + Hoz Bank + Hoz Securities (v0)
authors:
  - Imani (Legal-as-code engineer; reports to Devon, Chief Operating Officer, governance)
  - Owen (Company Secretary, governance; reports to CEO)
  - Atlas (Core banking platform architect; substrate)
date: 2026-05-09
source: D-LEGAL-ENTITY-TREE-V0 (CEO approved 2026-05-09; PR #82) + D-REGULATORY-PERIMETER (CEO approved 2026-05-09; PR #85)
proposal: Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md
---

# Legal-entity tree

Canonical, citable list of the legal entities the bank operates through.
The substrate seed at `prototype/seeds/legal-entity-tree.json` is a
typed mirror of this registry; the registry here is the canonical
authoring location and the substrate seed is its derived form (per
`feedback_canonical_source_registry.md` — single canonical authoring
location per fact-type; cross-references are typed citations, never
prose copies).

Per CLAUDE.md Principle 1 the entity tree is materialised in the event
log via the `LegalEntityRegistered`, `LegalEntityChanged`, and
`IntraGroupArrangementSigned` typed-event family in
`prototype/platform/event-store/event-types.ts`. Per Principle 5 the
tree is multi-entity from day one even though v0 ships three SA-incorporated
entities only.

## Active entities (as-of 2026-05-09)

| URN | Legal name | Form | Jurisdiction | Parent | Primary regulator |
|---|---|---|---|---|---|
| `urn:legal-entity:hoz:hoz-group:v1` | Hoz Group Limited | Ltd | ZA | (none — top of tree) | none-companies-act-only |
| `urn:legal-entity:hoz:hoz-bank:v1` | Hoz Bank Limited | Ltd | ZA | `urn:legal-entity:hoz:hoz-group:v1` | PA |
| `urn:legal-entity:hoz:hoz-securities:v1` | Hoz Securities Limited | Ltd | ZA | `urn:legal-entity:hoz:hoz-group:v1` | JSE |

## Per-entity regulatory regime (D-REGULATORY-PERIMETER)

### Hoz Group Limited

- **primaryRegulator**: `none-companies-act-only`
- **regimeAnchor** (ordered):
  1. Companies Act 71 of 2008
  2. Banks Act 94 of 1990 § 60 (consolidated-supervision look-through, not separate licence)
- **Citations** (Principle 2):
  - `[citation: TBC pending counsel verification — Companies Act 71 of 2008 § 8(2)(b) public-company]`
  - `[citation: TBC pending counsel verification — Banks Act 94 of 1990 § 60 controlling-company designation]`
  - `[citation: TBC pending counsel verification — Regulations Relating to Banks Reg 36]`

### Hoz Bank Limited

- **primaryRegulator**: `PA`
- **regimeAnchor** (ordered):
  1. Banks Act 94 of 1990 (s.7 banking licence)
  2. Joint Standards
  3. BCBS principles as applied by PA
  4. FAIS Act 37 of 2002 (where applicable per D-FSP-LICENCE-NECESSITY)
- **Citations** (Principle 2):
  - `[citation: TBC pending counsel verification — Banks Act 94 of 1990 § 7 banking-licence]`
  - `[citation: TBC pending counsel verification — Joint Standard 2 of 2024]`
  - `[citation: TBC pending counsel verification — FAIS Act 37 of 2002 § 7]`

### Hoz Securities Limited

- **primaryRegulator**: `JSE`
- **regimeAnchor** (ordered):
  1. JSE Listings Requirements
  2. JSE Equities + Bonds Membership Rules
  3. STRATE Participant Rules
  4. FAIS Act 37 of 2002 (secondary, FSCA conduct standards)
- **Citations** (Principle 2):
  - `[citation: TBC pending counsel verification — JSE Equities Rules]`
  - `[citation: TBC pending counsel verification — JSE Debt Listings Requirements]`
  - `[citation: TBC pending counsel verification — STRATE participation rules]`
  - `[citation: TBC pending counsel verification — FSCA Determination of Securities Services]`

## Registered offices (v0 placeholders)

All three entities default to Johannesburg, ZA, pending the bank's
permanent registered office. Specific street addresses are placeholders;
the `LegalEntityChanged` `registered-office-changed` change-type fills
the gap when permanent addresses are secured.

| Entity | Street | City | Country |
|---|---|---|---|
| Hoz Group Limited | `[citation: TBC pending Imani + counsel — registered-office secured]` | Johannesburg | ZA |
| Hoz Bank Limited | `[citation: TBC pending Imani + counsel — registered-office secured]` | Johannesburg | ZA |
| Hoz Securities Limited | `[citation: TBC pending Imani + counsel — registered-office secured]` | Johannesburg | ZA |

## Directors at v0

The shared-board v0 model (per Imani + Owen joint v0 spec §4) names 6
humans + Marc + audit firm across all three entities, with entity-specific
fit-and-proper clearance. The actual director roster is populated via
`LegalEntityChanged` `director-added` events as fit-and-proper assessments
clear; v0 ships an empty array on each entity until appointments are
formal.

## Intra-group arrangements (v0 stubs — not yet executed)

Per the joint v0 spec §2; substantive contracts land closer to licence-day.
Each row is a v0 stub recorded for completeness; the
`IntraGroupArrangementSigned` events will be emitted as substantive
contracts are executed.

| Arrangement | Type | From | To | Status at v0 |
|---|---|---|---|---|
| Group services agreement | `services` | Hoz Group | Hoz Bank | not-yet-executed |
| Group services agreement | `services` | Hoz Group | Hoz Securities | not-yet-executed |
| IP licensing | `ip-licensing` | Hoz Group | Hoz Bank | not-yet-executed |
| IP licensing | `ip-licensing` | Hoz Group | Hoz Securities | not-yet-executed |
| Capital injection (R300m target) | `capital-injection` | Hoz Group | Hoz Bank | not-yet-executed (licence-day target) |
| Capital injection | `capital-injection` | Hoz Group | Hoz Securities | not-yet-executed |
| Bank ↔ Securities intra-group exposure | `intra-group-exposure` | Hoz Bank | Hoz Securities | not-yet-executed |

## Substrate gaps surfaced

Per Principle 7 (substrate-gap inventory transparency).

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | Substrate-side TypeScript module that reads this seed and emits `LegalEntityRegistered` events into the event store | Atlas (Core banking platform architect) | Post-substrate-event-family ship (this PR) |
| 2 | Auto-emit `LegalEntityRegistered` when a CIPC reservation completes | Imani (Legal-as-code engineer) + counsel | Gated on D-HOZ-DOMAIN-REGISTRATION-SET deferral state — counsel engagement deferred per PR #86 |
| 3 | Per-entity obligations-register cross-reference (Mira's register scoped per-entity) | Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance) | Post-event-family ship; rebases on `Regulations/_obligations-register.md` v1.8 (PR #84) |
| 4 | `RegulatoryLicenceStatusChanged` typed event (sketched in v0 spec §6.2; deferred to licence-application work) | Atlas + Mira | Pre-licence application |

## Citation chain

- **Principle 1** (`CLAUDE.md`) — events as source of truth; entity tree is materialised in the event log.
- **Principle 5** (`CLAUDE.md`) — multi-entity from day one.
- **Principle 6** (`CLAUDE.md`) — single-graph discipline; this is a *standard*-layer artefact deriving downward from regulation + the v0 spec.
- **D-LEGAL-ENTITY-TREE-V0** (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md`, PR #82).
- **D-REGULATORY-PERIMETER** (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md`, PR #85).
- **Imani + Owen joint v0 spec** (`Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md`).
- **Canonical-source registry rule** (`feedback_canonical_source_registry.md`) — this file is the canonical authoring location; `prototype/seeds/legal-entity-tree.json` is a derived cache.
- Statutory anchors (per-clause, all `[citation: TBC]` until counsel verifies): Companies Act 71 of 2008, Banks Act 94 of 1990 (in particular § 7 banking-licence and § 60 controlling-company), Regulations Relating to Banks Reg 36, FAIS Act 37 of 2002, FSCA Determination of Securities Services, JSE Equities Rules, JSE Debt Listings Requirements, STRATE participation rules, IAS 24, BCBS Core Principles, OECD Transfer Pricing Guidelines.
