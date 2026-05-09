# Procedure — POPIA Information Officer designation (per entity)

**Procedure ID:** PROC-PRIV-IO-DSG-01
**Owner:** Iris (Information Officer, governance) · Owen (Company Secretary, governance) for designation-letter issuance · Marc (CEO, sole-director interim) until licence-day
**Approval:** CEO (build-phase); Board (post licence-day)
**Cadence:** On-trigger (entity registration; annual refresh; designation change)
**Version:** v0 stub — 2026-05-09
**Status:** STUB (POPIA designation binds at licence-day; build-phase scaffolding)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §6 — POPIA / Privacy Policy.
`Owner Inbox/2026-05-09_iris_per-entity-popia-io-designation-scoping.md` — per-entity scoping deliverable.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `[citation: TBC — POPIA s.1]` | Definition of "responsible party" — anyone (alone or jointly) determining purpose and means of processing personal information. |
| `[citation: TBC — POPIA s.55 read with PAIA s.1]` | Each private body has a "head of private body" for PAIA purposes. |
| `[citation: TBC — POPIA s.56(1)]` | Each responsible party has a designated Information Officer. |
| `[citation: TBC — POPIA s.56(a)]` | Responsible party may designate one or more Deputy Information Officers. |
| `[citation: TBC — POPIA s.56(2) read with Reg 4]` | IO must be registered with the Information Regulator before commencing duties. |
| `[citation: TBC — POPIA Reg 4(1)(a)–(g)]` | IO duties: compliance framework, PIA, PAIA s.51 manual, internal awareness, processing operations registration, data-subject request handling, regulator engagement. |

## 3. Purpose

Ensure every Hoz entity that is a POPIA responsible party (per the scoping deliverable: Group, Bank, Securities) has a current, registered IO + Deputy IO designation, and a published PAIA s.51 manual, before processing personal information at scale.

## 4. Trigger

- **Entity registration:** when CIPC reservation completes for a new entity in the legal-entity tree (`LegalEntityRegistered` event emitted by Atlas (Core banking platform architect)'s in-flight family).
- **Annual refresh:** twelve months from the prior `IODesignationFiled` event for the entity.
- **Designation change:** any of (a) IO resignation or role change, (b) Deputy IO change, (c) capacity / conflict finding by Helena (Chief Risk Officer, governance) or Thandiwe (Chief Audit Executive, governance), (d) Information Regulator direction.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Entity board (Marc-interim until licence-day) designates IO + Deputy IO via signed appointment letter, citing POPIA s.56(1) and s.56(a) | `human` (entity board / sole director) | `@domains/privacy/io-designation` (`PLANNED`) | Emits `IODesignationFiled { entityId, ioId, deputyIoId, effective_at, citations }`. |
| 2 | Iris registers IO designation with the Information Regulator per POPIA s.56(2) read with Reg 4 | `human` (Iris) via Regulator portal | `@platform/regulator/info-regulator-integration` (`PLANNED`) | Out-of-system today; portal integration future. Submission timestamp recorded as event. |
| 3 | PAIA s.51 manual published at entity level (describes how to make POPIA / PAIA requests; lists processing categories per the lawful-processing register) | `system` (generator) + `human` (Iris approves) | `@domains/privacy/paia-manual-generator` (`PLANNED`) | Emits `PAIAManualPublished { entityId, version, published_at }`. Generated from event log per Principle 1. |
| 4 | Designation refreshed annually or on change-of-person | `human` (entity board) | as above | Emits `IODesignationChanged` with prior + new designations. |

## 6. Reconciliation

- **Events produced:**
  - `IODesignationFiled { entityId, ioId, deputyIoId, effective_at, citations[] }`
  - `IODesignationChanged { entityId, prior, current, effective_at, reason }`
  - `PAIAManualPublished { entityId, version, published_at }`
- **Reconciliation checks (Vera (Internal-audit / continuous-assurance engineer) recon assertions):**
  - For every `LegalEntityRegistered` event marked as a POPIA responsible party, there exists a current `IODesignationFiled` event (no orphan entity).
  - For every `IODesignationFiled`, the referenced `entityId` resolves to a `LegalEntityRegistered` event (no orphan designation).
  - For every responsible-party entity, a current `PAIAManualPublished` event exists.
  - Annual-refresh: no `IODesignationFiled` is older than 12 months without a successor `IODesignationFiled` or `IODesignationChanged`.

## 7. Substrate gaps named

1. **Typed event family** — `IODesignationFiled` / `IODesignationChanged` / `PAIAManualPublished`. Owner: Atlas v1; cross-references the in-flight `LegalEntityRegistered` family on `claude/atlas-legal-entity-event-family-v0`.
2. **Information Regulator integration substrate** — registration portal API or out-of-system submission with timestamped event. Owner: Atlas + Iris joint v1.
3. **PAIA s.51 Manual generator** — reads from the lawful-processing register and event log per Principle 1, produces published manual + event. Owner: Iris + Anya (Data / analytics engineer) v1.
4. **Per-entity request-handling pipeline** — entity-aware routing of POPIA / PAIA requests to the correct entity-IO. Owner: Iris + Anya v1.
5. **POPIA s.22 breach-notification automation** — 72-hour Regulator-notification clock as a typed event with deadline; entity-aware extension of PROC-PRIV-01. Owner: Iris + Senna (Security engineer).

## 8. Cross-references

- Scoping deliverable: `Owner Inbox/2026-05-09_iris_per-entity-popia-io-designation-scoping.md`
- D-LEGAL-ENTITY-TREE-V0 (PR #82) — entity tree, shared-board posture
- D-REGULATORY-PERIMETER (PR #85) — group as responsible party
- D-THIN-HUMAN-LAYER-MINIMUM (PR #24) — alternates split (Deputy IO = CoSec)
- Related procedures: `popia-breach-notification.md` (PROC-PRIV-01); `popia-dsar.md` (PROC-PRIV-DSAR-01)
