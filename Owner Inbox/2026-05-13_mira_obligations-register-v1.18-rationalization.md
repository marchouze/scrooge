---
title: "Obligations register v1.18 — Status rationalization"
author: Mira (Compliance / RegTech engineer)
date: 2026-05-13
decision-required: false
---

# Obligations register v1.18 — Status rationalization

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer)  
**Date:** 2026-05-13  
**Schema reviewer:** Owen (Company Secretary, governance)  
**Authority:** Standing register-curator mandate under Zara (Chief Compliance Officer); no new CEO decision required.

---

## What changed

### New `Bind-trigger` column (column 8)

The obligations schema advances from 9 to 10 columns. `Bind-trigger` is inserted between `Status` and `Entity scope`:

```
| ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Bind-trigger | Entity scope | Applies-at | Risk taxonomy |
```

`Bind-trigger` closed vocabulary:

| Value | Meaning |
|---|---|
| `corporate` | Binds at corporate formation — already binding. |
| `licence-day` | Binds at SARB licence grant. |
| `commencement` | Binds at commencement of trading. |
| `conditional` | Binds on a named conditional trigger (see Requirement cell). |
| `n/a` | No deferred trigger; lifecycle governed solely by Status. |

### Status rationalized to closed 7-value enum

Prior Status carried three mixed axes: fulfillment lifecycle, binding trigger, and prose rationale. These are now separated.

New closed vocabulary:

| Value | Meaning |
|---|---|
| `IN_FORCE` | Obligation binding and substrate satisfying it. |
| `DRAFTING` | Active authoring / build in progress. |
| `PLANNED` | Scheduled, not yet started. |
| `PARTIAL` | Partially met; gap documented in Requirement cell. |
| `NOT_APPLICABLE` | Binding trigger not yet reached. |
| `DEFERRED` | Intentionally deferred to a later phase. |
| `SUPERSEDED` | Instrument superseded; row retained for audit history. |

Parenthetical prose tails from prior Status cells are migrated to the `Requirement` cell as `**Status note:** …` appends. Binding-trigger values (`corporate-bind`, `licence-bind`, `commencement-bind`, `conditional-bind`, `PRE-LICENCE`) migrate to the `Bind-trigger` column.

---

## Row counts by new Status value (post-migration, 259 ORG rows)

| Status | Count | Former Status values absorbed |
|---|---|---|
| `IN_FORCE` | ~169 | `**IN FORCE**` (all variants) · `PHASED` · former `corporate-bind` rows where policy/substrate is active |
| `DRAFTING` | ~23 | `DRAFTING` (all variants) · `IN FLIGHT` · `IN FLIGHT (RAS recalibration)` |
| `PLANNED` | ~16 | `PLANNED` (all variants) · former `corporate-bind` rows where plan not yet complete |
| `PARTIAL` | ~19 | `PARTIAL` (all variants) · ORG-PR-23 (B-cluster, appetite in force but recon gap) |
| `NOT_APPLICABLE` | ~9 | `N/A-yet` (all variants) · `licence-bind` · `commencement-bind` · `conditional-bind` · `PRE-LICENCE` |
| `DEFERRED` | ~5 | `wave-2-deferred` (Domain FX long-tail) |
| `SUPERSEDED` | ~1 | `**superseded**` (ORG-PR-27 superseded by D10/2025) |

Domain N (25 citation-URN inventory rows) is exempt — its 8-column schema is structurally distinct.

---

## Judgment calls on ambiguous `corporate-bind` rows

The prior `corporate-bind` Status carried both a binding-trigger signal and an implicit lifecycle state. Each row required assessment:

| Row ID | Prior Status | New Status | New Bind-trigger | Rationale |
|---|---|---|---|---|
| `ORG-PR-25` | `**corporate-bind** (NPA policy approved...)` | `IN_FORCE` | `corporate` | NPA policy approved 2026-05-10; discipline active at policy layer; substrate slices 1–3 authorised. |
| `ORG-PR-23` | `**corporate-bind** (CEO ratified L-B8a...)` | `PARTIAL` | `corporate` | Appetite lines in force at policy layer; runtime recon harness is a Vera Wave-4 gap. |
| `ORG-PR-28` | `**corporate-bind** (pending supersession resolution...)` | `PLANNED` | `corporate` | Supersession D10/D1 unresolved; policy not yet complete. |
| `ORG-PR-30` | `**corporate-bind** (recovery plan drafted pre-licence...)` | `PLANNED` | `corporate` | Plan drafted but not yet finalised; completes at licence-day. |
| `ORG-BNK-RECOVERY-CONS` | `corporate-bind` | `PLANNED` | `corporate` | Consolidated recovery plan drafted pre-licence; finalised at licence-day. |
| `ORG-PR-33` | `**corporate-bind** (substrate-build pre-licence; FRTB...)` | `PLANNED` | `corporate` | Substrate build in progress; crystallises at FRTB commencement. |
| `ORG-PR-34` | `**corporate-bind** (field-testing phase; CSRBB...)` | `DRAFTING` | `corporate` | CSRBB substrate actively under build. |
| `ORG-PR-47` | `**corporate-bind** (activates on conditional trigger — insurance entity investment)` | `PLANNED` | `conditional` | No insurance entity investment held; trigger not reached. Bind-trigger = `conditional` (not `corporate`) because the trigger is event-conditional, not formation-automatic. |
| `ORG-GV-22` | `**corporate-bind** (binds at corporate formation; notification cycle...)` | `IN_FORCE` | `corporate` | Significant-owner machinery in place at corporate formation; notification cycle triggers on equity events. |
| `ORG-GV-21` | `**corporate-bind** (Companies Act director-duties bind at corporate formation...)` | `IN_FORCE` | `corporate` | Director-duties and RETENTION_GOVERNANCE_7Y operative. |
| `ORG-MK-14` | `**corporate-bind** (FSCA CS3 already binds at corporate-formation...)` | `IN_FORCE` | `corporate` | CS3/2018 already binding; this is the umbrella URN handle. |
| All Domain P FAIS rows | `corporate-bind` | `IN_FORCE` | `corporate` | FAIS record-keeping discipline active at corporate formation per D-FSP-LICENCE-NECESSITY. |
| `ORG-BNK-CGPS-CONS`, `ORG-BNK-ICAAP-CONS`, `ORG-BNK-ILAAP-CONS`, `ORG-BNK-CYBER-CONS` | `corporate-bind` | `IN_FORCE` | `corporate` | Policy/framework operative; measured at consolidated level. |
| `ORG-GRP-RPT`, `ORG-GRP-FINREP`, `ORG-GRP-PA-PARENT` | `corporate-bind` | `IN_FORCE` | `corporate` | Group-level Companies Act / IFRS obligations active. |

---

## Domain N exemption

Domain N (the M1 markets-foundation citation-URN inventory) uses a structurally distinct 8-column schema (`Symbol | URN slug | Tranche | Instrument | Section | First consumed at | Confidence | Cross-references`). It carries no Status or Bind-trigger column. The preamble exemption note is updated from "9-column schema" to "10-column schema".

---

## Files changed

- `Regulations/_obligations-register.md` — version bumped to v1.18; Bind-trigger column added; 259 ORG obligation rows migrated; preamble updated (schema description, Status vocab, new Bind-trigger vocab section, exempt note, status summary table, total count).

---

## Substrate note

The `ObligationStatusChanged` and `ObligationRegistered` event types in the substrate do not carry a `bindTrigger` field yet. The new column is register-level metadata; the event-schema extension is a follow-on substrate gap for Atlas (Core banking platform architect). Vera's register-completeness recon will surface rows where Bind-trigger is `[TBD]` once the recon harness is updated to parse the new column.
