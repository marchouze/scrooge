---
title: Per-entity register scoping v0 — entity-scope vocabulary + consolidated-supervision rows (D-LEGAL-ENTITY-TREE-V0)
author: Mira (Compliance / RegTech engineer)
date: 2026-05-09
summary: Register v1.7 introduces the entity-scope vocabulary (group / bank / securities / multi-entity / consolidated-supervision) under D-LEGAL-ENTITY-TREE-V0; lands 9 sample classified rows + 8 new Domain Q consolidated-supervision URNs binding only at Hoz Group Limited. v1 substrate task surfaced for full classification of the remaining ~190 rows.
decision-required: false
---

# Per-entity register scoping v0 — entity-scope vocabulary + consolidated-supervision rows

**Author:** Mira (Compliance / RegTech engineer) under Zara (Chief Compliance Officer, governance)
**Date:** 2026-05-09
**Authority:** CEO decision `D-LEGAL-ENTITY-TREE-V0` (approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md` / PR #82). Source entity-tree: `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` (PR #80) + group-structure decision `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-group-structure.md` (PR #78).

## Context

The bank is now structured as a three-entity group: `Hoz Group Limited` (parent) + `Hoz Bank Limited` (regulated bank) + `Hoz Securities Limited` (FSP / OTC Derivative Provider). The obligations register has been bank-centric until this PR. v1.7 introduces the entity-scope vocabulary and lands the consolidated-supervision rows that bind only at the group level.

This is a **v0 scoping task**: it defines the vocabulary, demonstrates the pattern across nine sample rows, and authors the new group-level rows. Full classification of the remaining ~190 register rows is surfaced as a v1 substrate task.

## What landed

### 1. Entity-scope vocabulary (new top-level section)

A new "Entity scope" section before Domain A defines five values:

| Value | Meaning |
|---|---|
| `group` | Binds only at `Hoz Group Limited` (e.g. consolidated capital adequacy under Banks Act § 60+). |
| `bank` | Binds only at `Hoz Bank Limited` (e.g. SARB FinSurv reporting; BA returns to PA). |
| `securities` | Binds only at `Hoz Securities Limited` (e.g. FAIS Key Individual; ODP trade-reporting). |
| `multi-entity` | Binds at two or more entities — row enumerates which (e.g. FIC Act § 43A applies to bank + securities). |
| `consolidated-supervision` | Group-level discharge layered on per-entity controls (e.g. JS 1 of 2024 cyber-resilience programme). |

Default for unclassified pre-v1.7 rows is `entity-scope: bank` (provisional; v1 task formalises). Vocabulary citations: D-LEGAL-ENTITY-TREE-V0 + Banks Act § 60+ + Joint Standard 1 of 2024 + BCBS Corporate Governance Principles for Banks + IFRS 10 / IFRS 12 + IAS 24 + Companies Act 71 of 2008 — each with `[citation: TBC]` for precise sub-section references pending Imani (Legal-as-code engineer) + external counsel ratification at the licence-application gate.

### 2. Sample classified rows (9 rows demonstrating the pattern)

| Row | Scope | Anchor |
|---|---|---|
| `ORG-PR-23` (B-cluster FX-settlement concentration) | `bank` | D-FX-CORRESPONDENT-PAIR-NAMING + `project_indirect_participant_posture.md` |
| `ORG-FC-11` (MLRO designation) | `multi-entity` | FIC Act § 43A — bank + securities both Schedule 1 accountable institutions |
| `ORG-CD-04` (FAIS advice records) | `securities` | FAIS Act § 8 — FSP-licensed entity is securities |
| `ORG-CD-07` (FAIS complaint-handling) | `securities` | FAIS subordinate legislation + FSCA Conduct Standards |
| `ORG-PR(IV)-13` (POPIA Information Officer) | `multi-entity` | POPIA ss.55–56 — per-entity designation owed |
| `ORG-CY-02` (Joint Standard 1 of 2024 responsible person) | `consolidated-supervision` | JS 1 of 2024 — group programme + per-entity controls |
| `ORG-MK-08` (Excon Manual umbrella) | `bank` | SARB Authorised Dealer status at bank-entity |
| `ORG-FX-FIN-01` (FinSurv current-account-trade-payments) | `bank` | Cluster-wide tag for `ORG-FX-FIN-01..14` |
| `ORG-FAIS-KI` (FAIS Key Individual) | `securities` | FAIS Act § 8 + Determination of Fit and Proper 2017 |

### 3. New Domain Q — consolidated-supervision rows (8 net-new URNs)

Eight new rows under `urn:obligation:bank:group:*:v1`, all `corporate-bind` per `project_rules_bind_at_commencement.md`:

| URN | Citation anchor |
|---|---|
| `urn:obligation:bank:group:consolidated-cgps:v1` | BCBS Corporate Governance Principles for Banks + Banks Act § 60+ |
| `urn:obligation:bank:group:consolidated-icaap:v1` | Banks Act § 60+ + Regulations Relating to Banks + BCBS Basel III/IV |
| `urn:obligation:bank:group:consolidated-ilaap:v1` | Banks Act § 60+ + BCBS 144 + BCBS D295 / D335 |
| `urn:obligation:bank:group:consolidated-recovery-plan:v1` | Banks Act § 60+ + PA recovery-planning guidance + FSB Key Attributes |
| `urn:obligation:bank:group:consolidated-cyber-resilience:v1` | Joint Standard 1 of 2024 + BCBS Operational Resilience (2021) + POPIA s.19 |
| `urn:obligation:bank:group:consolidated-related-party-disclosure:v1` | IAS 24 + Companies Act 71 of 2008 § 75 + § 2 |
| `urn:obligation:bank:group:consolidated-financial-reporting:v1` | IFRS 10 + IFRS 12 + Companies Act § 28–30 + Banks Act § 60+ |
| `urn:obligation:bank:group:parent-of-bank-pa-notification:v1` | Banks Act § 60+ controlling-company / parent-of-bank designation |

### 4. Dashboard state re-derived

Per memory `feedback_dashboard_always_derived.md`, `prototype/seeds/dashboard-state.json` is a cache derived from canonical sources. Re-derived via `prototype/scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts` — obligations metric advances to **210**.

## v1 substrate task surfaced

**Scope:** classify the remaining ~190 register rows with explicit `entity-scope` values. The rows currently default provisionally to `entity-scope: bank`; that default is reasonable as a holding pattern but breaks Principle 5 (multi-entity from day one) until each row is explicitly classified.

**Effort estimate:**
- **Single-curator path:** ~1–2 working days for one curator (Mira). Each row needs (a) read the citation, (b) decide which entity / entities the obligation binds at, (c) write the entity-scope annotation with citation. Average ~2–3 minutes per row at scale.
- **Distributed-by-domain path:** ~4–6 hours per persona-line if distributed: Mira (Domain B financial crime + Domain C conduct + Domain G operational-cyber + Domain M ODP), Bea / Camille (Domain H accounting), Helena / Rohan (Domain A prudential + Domain F market risk), Eitan (Domain A liquidity + Domain FX FinSurv), Iris (Domain D privacy), Owen (Domain L whistleblowing + governance cluster), Yael (Domain Y tax). The distributed path lands faster wall-clock but requires coordination.

**Substrate gaps for the v1 task:**

1. **Vera recon harness** — need a `register-entity-scope-completeness.ts` recon that asserts every row has an explicit `entity-scope` field once v1 lands. Pattern: parse table rows, flag any without the `entity-scope:` token. Pre-v1.7 rows currently default to implicit-`bank`; the recon should fire as a Wave-4 finding once v1 has been authored.
2. **Schema-as-data refactor (Anya / Atlas / Mira joint)** — the obligations register is currently markdown; entity-scope as a structured field demands a schema-as-data representation (TypeScript types + a JSON / SQLite projection) so the dashboard, Vera reconciliations, and the regulator-submission pipeline can query by entity-scope. v1.7 keeps the markdown form but the v1 classification task is the natural moment to refactor.
3. **Dashboard surface for entity-scope distribution** — a metric on the dashboard ("obligations by entity-scope: group / bank / securities / multi-entity / consolidated-supervision") would expose at-a-glance whether the multi-entity discipline is real.
4. **Regulator-submission generator scoping** — once entity-scope is explicit, the BA-returns generator (Bea), the FinSurv generator (Mira), the FATCA / CRS generator (Yael), and the consolidated financial-statements generator (Bea + Camille) all need to dispatch on entity-scope to avoid filing bank-entity obligations at the group level (or vice versa).

## `[citation: TBC]` items

The following precise sub-section references are flagged TBC and ratify at the licence-application gate (per `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`):

- Banks Act 94 of 1990 § 60-series exact paragraph index for: parent-of-bank designation, group capital, group large-exposures, controlling-company / holding-company supervision, change-in-control thresholds, parent-of-bank fit-and-proper.
- Joint Standard 1 of 2024 exact clauses distinguishing group programme from entity controls.
- BCBS Corporate Governance Principles for Banks — Principle numbers 1–13 with explicit group-applicability.
- Companies Act 71 of 2008 § 2 (related and inter-related), § 3 (subsidiary relationships), § 28–30 (annual financial statements), § 75 (related-party regime).
- BCBS Sound Liquidity Risk Management (BCBS 144) group reading + BCBS D295 / D335 group LCR / NSFR.
- PA Directive on recovery planning — exact reference.
- FSB Key Attributes of Effective Resolution Regimes — group-resolution annex exact reference.
- SARB Currency and Exchanges Manual §A.1 Authorised Dealer designation — entity-eligibility sub-section.
- FIC guidance on group-MLRO arrangements (whether single-MLRO across multiple accountable institutions is permissible).
- Information Regulator guidance on group-IO appointments under POPIA ss.55–56.

These flags are honoured per Principle 2 (every action traces to a source — no inventing references).

## Cross-references

- D-LEGAL-ENTITY-TREE-V0 (CEO-approved 2026-05-09; PR #82): `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md`.
- D-GROUP-STRUCTURE (CEO-approved 2026-05-09; PR #78): `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-group-structure.md`.
- Imani-Owen entity-tree v0 (PR #80): `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md`.
- Imani external-counsel ratification gate: `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`.
- Mira prior register PRs: #42 (10-thin-human-layer-gaps), #56 (Domain FX FinSurv), #70 (Domain P FAIS Posture A).
- Memory: `feedback_dashboard_always_derived.md`, `feedback_canonical_source_registry.md`, `project_rules_bind_at_commencement.md`, `feedback_agent_name_with_position.md`.

## Reporting line

Mira (Compliance / RegTech engineer) → Zara (Chief Compliance Officer, governance) → CEO.
