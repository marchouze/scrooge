---
title: Per-entity POPIA s.55-56 Information Officer designation scoping
author: Iris (Information Officer, governance)
date: 2026-05-09
summary: Per-entity POPIA Information Officer + Deputy IO designation plan across the three Hoz entities (Group, Bank, Securities). Scopes designation procedure PROC-PRIV-IO-DSG-01 and names build-phase substrate gaps.
decision-required: false
---

# Per-entity POPIA s.55-56 Information Officer designation scoping

**Author:** Iris (Information Officer, governance)
**Date:** 2026-05-09
**Status:** v0 scoping deliverable
**Cross-references:**
- D-LEGAL-ENTITY-TREE-V0 (PR #82) — three-entity tree, shared-board posture
- D-REGULATORY-PERIMETER (PR #85) — group is responsible party though not separately regulated
- D-THIN-HUMAN-LAYER-MINIMUM (PR #24) — alternates split (deputy-IO = CoSec; MLRO-alt = AC-Chair NED)
- `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` — joint v0 entity-tree spec

---

## §1 — POPIA s.55-56 framework

POPIA imposes a per-responsible-party designation duty:

| Provision | Requirement |
|---|---|
| POPIA s.1 | Defines "responsible party" — anyone (alone or jointly with others) determining the purpose and means of processing personal information `[citation: TBC — POPIA s.1 definition]`. |
| POPIA s.55 | Each responsible party that is a private body has a "head of private body" for PAIA purposes `[citation: TBC — PAIA s.1 read with POPIA s.55]`. |
| POPIA s.56(1) | Each responsible party automatically has the head of the private body as its Information Officer until a separate designation is made `[citation: TBC — POPIA s.56(1)]`. |
| POPIA s.56(a) | A responsible party may designate one or more Deputy Information Officers `[citation: TBC — POPIA s.56(a)]`. |
| POPIA s.56(2) read with Reg 4 | The IO must be registered with the Information Regulator before commencing IO duties `[citation: TBC — POPIA Reg 4 GG 42110]`. |

The IO is responsible for:
- Encouraging compliance with the eight POPIA conditions for lawful processing.
- Dealing with requests made to the body under POPIA and PAIA.
- Working with the Information Regulator on investigations (s.39).
- Ensuring a compliance framework, personal-information impact assessments, the PAIA s.51 manual, internal awareness, and processing operations registration are in place `[citation: TBC — POPIA Reg 4(1)(a)–(g)]`.

**Implication for the Hoz group.** The duty attaches *per responsible party*, not per natural person or per regulated entity. Each of the three Hoz entities is independently a responsible party (see §2) and therefore independently owes a POPIA s.56(1) IO designation and a separate PAIA s.55 head-of-private-body designation.

---

## §2 — Per-entity responsible-party assessment

| Entity | Responsible-party? | Processing scope (build-phase → licence-day) |
|---|---|---|
| **Hoz Group Limited** | **YES** | Holding-company minimal processing: board minutes, group HR data when human directors / officers are appointed at licence-day, group-level vendor agreements, intra-group agreements, shareholder records. Per D-REGULATORY-PERIMETER, group is a responsible party even though not separately prudentially regulated. |
| **Hoz Bank Limited** | **YES** | Banking-customer processing — KYC/CDD/EDD records, transaction histories, statements, advice records (FAIS), AML monitoring outputs, breach-notification cohorts. **Highest data-subject volume** of the three entities at and after licence-day. |
| **Hoz Securities Limited** | **YES** | Institutional-counterparty processing — counterparty-eligibility screening per Niko (Sales / CRM engineer)'s `PROC-CRM-CIE-01` (PR #77), trading data tied to counterparty-natural-person beneficial owners, market-counterparty correspondence, FATCA/CRS counterparty data. |

Each entity therefore independently owes IO + Deputy IO designations under POPIA s.56(1) / s.56(a) and a head-of-private-body designation under PAIA s.55 `[citation: TBC]`.

---

## §3 — Designated IO per entity

Per the shared-board posture confirmed in D-LEGAL-ENTITY-TREE-V0, and the alternates split confirmed in D-THIN-HUMAN-LAYER-MINIMUM, the designations are:

| Entity | Information Officer | Deputy Information Officer |
|---|---|---|
| **Hoz Group Limited** | Triple-hatted Compliance Lead (MLRO + FIC Compliance Officer + IO per D-THIN-HUMAN-LAYER-MINIMUM) | CoSec (Owen (Company Secretary, governance) seat) |
| **Hoz Bank Limited** | Triple-hatted Compliance Lead | CoSec |
| **Hoz Securities Limited** | Triple-hatted Compliance Lead | CoSec |

**Same human across all three entity-roles; entity-specific designation under POPIA s.56(1).** POPIA permits this — the designation is *per responsible party* not *per natural person*. The same individual may serve as IO of multiple responsible parties simultaneously, provided each responsible party makes its own designation and registers it with the Information Regulator `[citation: TBC — POPIA s.56(1) read with Reg 4]`.

**Conflict / capacity considerations.**
- Capacity: triple-hatting MLRO + FIC CO + IO across three entities is concentrated load on a single human. Conflict-of-interest assessment and a capacity-monitoring control are pre-conditions of formal designation at licence-day. Helena (Chief Risk Officer, governance) and Thandiwe (Chief Audit Executive, governance) review at the next CEO-decision pass on thin-human-layer staffing.
- The Deputy IO (CoSec — Owen) provides operational backup and acts when the IO is conflicted, unavailable, or recused.

---

## §4 — PAIA s.55 head-of-private-body

Each entity also has a PAIA "head-of-private-body" designation. Under PAIA, the default head is the most senior officer of the body — typically the CEO or managing director of each entity `[citation: TBC — PAIA s.1 definition of "head"]`.

| Entity | Head-of-private-body (PAIA s.55) |
|---|---|
| **Hoz Group Limited** | Marc (CEO, interim sole director) until human directors are appointed at licence-day; thereafter the Group MD/CEO. |
| **Hoz Bank Limited** | Same — Marc-interim, then Bank MD/CEO at licence-day. |
| **Hoz Securities Limited** | Same — Marc-interim, then Securities MD/CEO at licence-day. |

The PAIA head and the POPIA IO are distinct designations; the head may delegate IO duties to the designated IO. A PAIA s.51 manual is published per entity, describing how to make POPIA / PAIA requests (template generated from event log per Principle 1; see substrate gaps §7).

---

## §5 — Build-phase posture

The bank is in build phase (per memory `project_ai_driven_bank.md` and `project_rules_bind_at_commencement.md`):

- **No real customers** — Niko (Sales / CRM engineer)'s lifecycle activates at licence-day.
- **No real employees** beyond statutory minimum — no payroll, no HR personal data at scale.
- **No live banking processing** — KYC, transactions, statements, advice records all activate at commencement-of-trading.

Therefore POPIA processing volumes are minimal in build phase (Marc as data subject; agent-substrate logs which are not personal information). Formal IO designations land at licence-day, not now. Build-phase work is:

1. **Scope the designation procedure** — this deliverable + the procedure stub at `Procedures/by-policy/popia-io-designation.md` (PROC-PRIV-IO-DSG-01).
2. **IO-handover-from-Marc-interim cadence** — per-entity designation refreshed at (a) entity registration, (b) annually thereafter, (c) on any change of designated person. The handover from Marc-interim to the triple-hatted Compliance Lead lands as part of the thin-human-layer hire batch at pre-licence go-live readiness gate (Saskia (Head of Global Markets, governance) substrate, co-owned with Rashida (CISO, governance) and Devon (COO, governance)).
3. **Procedure-substrate that supports IO duties** — DSAR pipeline (already POPULATED via PROC-PRIV-DSAR-01), breach-notification (POPULATED via PROC-PRIV-01), regulator-engagement, PAIA Manual generator. See §7.

---

## §6 — Designation procedure (stub — PROC-PRIV-IO-DSG-01)

Authored at `Procedures/by-policy/popia-io-designation.md`. Summary:

**Trigger:** at entity registration (CIPC reservation completes); refreshed annually; refreshed on any change of designated person (resignation, role change, capacity finding).

**Steps:**

| # | Action | Actor | System capability |
|---|---|---|---|
| 1 | Entity board / sole director (Marc-interim until licence-day) designates IO + Deputy IO via signed appointment letter, citing POPIA s.56(1) and s.56(a) `[citation: TBC]` | `human` (entity board) | `@domains/privacy/io-designation` (`PLANNED`) — emits `IODesignationFiled` typed event |
| 2 | IO designation registered with the Information Regulator per POPIA s.56(2) read with Reg 4 `[citation: TBC]` | `human` (Iris) via Regulator portal | `@platform/regulator/info-regulator-integration` (`PLANNED`) |
| 3 | PAIA s.51 manual published at entity level, describing how to make POPIA / PAIA requests `[citation: TBC]` | `system` (PAIA Manual generator) + `human` (Iris approves) | `@domains/privacy/paia-manual-generator` (`PLANNED`) — emits `PAIAManualPublished` |
| 4 | On any change of designated person, repeat steps 1–3 within statutory timing | `human` (entity board) | as above — emits `IODesignationChanged` |

**Reconciliation:**
- Every entity has a current `IODesignationFiled` event in the event log keyed by `entityId`.
- Vera (Internal-audit / continuous-assurance engineer) recon assertion: no entity in `LegalEntityRegistered` lacks a current `IODesignationFiled` (no orphan entity; no orphan designation).
- PAIA s.51 manual reconciliation: every entity has a current `PAIAManualPublished` event referencing the entity's processing scope per the lawful-processing register.

**Substrate gaps named** (also §7):

1. Typed event family `IODesignationFiled` / `IODesignationChanged` / `PAIAManualPublished` — Atlas (Core banking platform architect) v1, cross-references Atlas's in-flight `LegalEntityRegistered` family on `claude/atlas-legal-entity-event-family-v0`.
2. Information Regulator integration substrate (registration portal API or out-of-system submission with timestamped event) — Atlas + Iris joint v1.
3. PAIA s.51 Manual generator reading from the lawful-processing register and event log per Principle 1 — Iris + Anya (Data / analytics engineer) v1.
4. Per-entity request-handling pipeline (PAIA + POPIA requests routed to correct entity-IO) — Iris + Anya v1.
5. POPIA s.22 breach-notification automation (72-hour Regulator notification clock per `[citation: TBC — POPIA s.22(1)]` is a typed event with deadline) — extension of `PROC-PRIV-01` to be entity-aware.

---

## §7 — Cross-references + substrate gaps

**Decision-record references:**
- `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md` (PR #82, merged) — entity tree; shared-board posture.
- `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` (PR #85, merged) — group as responsible party though not separately regulated.
- `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` — joint v0 entity-tree spec.
- D-THIN-HUMAN-LAYER-MINIMUM (PR #24) — alternates split, triple-hat structure.

**Atlas event-family cross-reference:** Atlas's `LegalEntityRegistered` family (in flight on `claude/atlas-legal-entity-event-family-v0`) is the upstream event for IO designation. `IODesignationFiled` carries an `entityId` that resolves to a `LegalEntityRegistered` event. Recon assertion: cross-event referential integrity.

**Owen coordination:** Owen (Company Secretary, governance) authors the per-entity-statutory-officer table in his governance-framework update and surfaces these designations in the governance pack. This scoping deliverable provides the substantive POPIA-side analysis; Owen's governance-framework table provides the cross-statute officer index.

**Substrate gaps inventory (5):**

| # | Gap | Owner | Phase |
|---|---|---|---|
| 1 | Typed event family `IODesignationFiled` / `IODesignationChanged` / `PAIAManualPublished` | Atlas | v1 (cross-refs `claude/atlas-legal-entity-event-family-v0`) |
| 2 | Information Regulator integration substrate (registration + correspondence) | Atlas + Iris | v1 (joint) |
| 3 | PAIA s.51 Manual generator from event log + lawful-processing register | Iris + Anya | v1 |
| 4 | Per-entity POPIA / PAIA request-handling pipeline (entity-aware routing) | Iris + Anya | v1 |
| 5 | POPIA s.22 breach-notification automation (72-hour clock as typed event) | Iris + Senna | extension of PROC-PRIV-01 |

---

## §8 — Completion note

**Landed in this PR:**
- This scoping deliverable (`Owner Inbox/2026-05-09_iris_per-entity-popia-io-designation-scoping.md`).
- New procedure stub `Procedures/by-policy/popia-io-designation.md` (PROC-PRIV-IO-DSG-01).
- New row in `Procedures/_index.md` under "Privacy & data protection".

**v1 substrate task list (queued for next runs / handoff to named owners):**
1. Atlas — extend `LegalEntityRegistered` family with `IODesignationFiled` / `IODesignationChanged` / `PAIAManualPublished` typed events.
2. Atlas + Iris — Information Regulator integration substrate (registration + ongoing correspondence; events with timestamps).
3. Iris + Anya — PAIA s.51 Manual generator reading from lawful-processing register + event log per Principle 1.
4. Iris + Anya — per-entity request-handling pipeline (entity-aware POPIA / PAIA request routing).
5. Iris + Senna (Security engineer) — POPIA s.22 breach-notification automation extension on PROC-PRIV-01 (72-hour clock).
6. Owen — surface per-entity-statutory-officer table in next governance-framework refresh, cross-referencing this scoping.
7. Helena + Thandiwe — capacity / conflict-of-interest assessment of the triple-hat plus three IO designations on a single human at thin-human-layer staffing review.

All seven tasks bind at licence-day; build-phase work is scaffolding.

---

*Reporting line: Iris → CEO directly. Authored 2026-05-09.*
