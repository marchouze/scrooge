---
title: Obligations register v1.13 — schema unification + header reconciliation (close P1 #1 + #2)
author: Mira (Compliance / RegTech engineer)
date: 2026-05-10
summary: v1.13 of the obligations register reconciles header counters to actuals (232 obligations, 23 domain prefixes) and unifies the table schema to a single 9-column shape (ID, URN, Citation, Requirement, Fulfilment policy, Owner, Status, Entity scope, Applies-at), closing audit findings P1 #1 and P1 #2.
decision-required: false
---

# Obligations register v1.13 — schema unification + header reconciliation

**Author:** Mira (Compliance / RegTech engineer), under Zara (Chief Compliance Officer)
**Date:** 2026-05-10
**Authority:** Standing register-curator mandate; no new CEO decision required.
**Audit findings closed:** P1 #1 (header counts out of sync) + P1 #2 (schema split between 6-column and 7-column rows; entity-scope encoded inline in Status cell rather than as a column).

## What this PR does (scope)

This is a **structural reconciliation** of `Regulations/_obligations-register.md`. No obligations are added, removed, or substantively re-stated. Three changes:

1. **Header counters reconciled to actuals** — the v1.12 banner stated `~224` total tracked obligations across `16 domains` and `~64 instruments`. Actuals at the time of this PR: **232 obligations across 23 distinct domain prefixes**. The header is updated to reflect actuals; the domain-prefix decision is documented below.
2. **Schema unified to 9 columns** — every obligations table row now carries the same column shape: `ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Entity scope | Applies-at`. Previously, 195 rows used a 6-cell schema (ID, Citation, Requirement, Fulfilment policy, Owner, Status — with entity-scope occasionally embedded inline in the Status cell), and 37 rows used a 7-cell schema (the 6-cell schema plus a separate `URN` column). Both are absorbed into the unified 9-column schema.
3. **Entity-scope and Applies-at promoted to first-class columns** — where the existing row encoded `entity-scope: <value>` or `applies-at: <value>` inline in the Status cell, the value is extracted into the dedicated column and the Status cell is left with only the bare status (`IN FORCE`, `DRAFTING`, `corporate-bind`, etc.). Where no value is present, the column reads `[TBD]`.

## Domain-prefix decision (P1 #1)

**Decision: expand the header to 23 prefixes; document the taxonomy. Do not consolidate.**

The 23 ID prefixes seen in IDs are: `AC, BNK, CD, CS1, CS2, CS3, CY, EL, EXCON, FAIS, FC, FMA, FX, GRP, GV, HR, JN2, JS2, MK, PR, RM, TX, WB`.

Rationale for keeping 23 (rather than collapsing to 16):

- **Stable cross-references.** Many of these prefixes are already cited from substrate code (e.g. `prototype/platform/event-store/registry.ts` cites `ORG-GV-21`, `ORG-MK-15`, `ORG-RM-01`; `prototype/platform/recon/retention-citation-coverage.ts` resolves `ORG-*` IDs as keys). Renaming to consolidate would require coordinated changes across the substrate, and would break the `mira:m1-regulator-citation-urns` Domain N cross-reference column.
- **Some prefixes are intentionally distinct.** `CS1`, `CS2`, `CS3` track FSCA Conduct Standards 1, 2, 3 of 2018 — three different instruments under the FMA / FSCA conduct framework, not a fragmented single domain. `JS2` and `JN2` track Joint Standard 2 of 2020 (margin) and Joint Notice 2 of 2024 (margin reporting) respectively — adjacent but distinct instruments. `EXCON` carries the single Excon-ODP non-resident counterparty derivative reporting row (`ORG-EXCON-ODP-001`) that has its own provenance back to the OTC-derivative-provider authorisation chain. `EL` (ECTA) is genuinely small (3 rows) but it is its own domain (Domain K — ECTA, electronic transactions, document execution).
- **`FAIS` and `RM`** map to Domain P and Domain RM respectively — both formally added to the register under v1.6 and v1.12. Their prefix character is intentional (Domain P uses `FAIS-*` IDs to make the FAIS Posture A binding scannable; Domain RM uses `RM-*` for the records-management citation seat).
- **`BNK` and `GRP`** are the two Domain Q sub-prefixes corresponding to the v1.9 reclassification under D-REGULATORY-PERIMETER: `ORG-BNK-*-CONS` rows bind on `Hoz Bank Limited` measured at consolidated level; `ORG-GRP-*` rows bind on `Hoz Group Limited` directly under Companies Act / IFRS / Banks Act § 60+. The distinction is load-bearing for the regulatory-perimeter reading.

The header therefore reads **23 domain prefixes** (not 16). The "16 domains" reading the v1.12 banner used was an artefact of an earlier version of the register where the domain count and the prefix count happened to coincide; subsequent additions (Domain FX, Domain N, Domain O, Domain P, Domain Q, Domain RM) have diverged the two counts. The canonical taxonomy is the prefix list above.

The instrument count was previously stated as `~64`; today's reading is closer to `~70+` given the v1.10/1.11/1.12 additions (Reg 39 sub-clauses, BCBS Sound Practices §27, JSE Equities Rules retention sub-rules, JSE Debt Listings Requirements, ICMA GMRA SA Schedule, ISDA CSA NY/English Law forms, FSCA Conduct Standard 3/2018 §§3–9, the 14 FinSurv categories, the 8 Domain Q reclassified rows, the 4 FAIS-record-keeping URNs). A precise instrument count requires deduplicating instruments-cited-multiple-times across rows (e.g. Banks Act 94 of 1990 is cited in `ORG-PR-*`, `ORG-MK-08`, `ORG-FC-11`, `ORG-CY-*`, `ORG-BNK-*-CONS`, `ORG-GRP-PA-PARENT`, etc.). The header is updated to `~70+ instruments` with a footnote routing precise deduplication as a follow-on workstream.

## Schema unification (P1 #2)

The unified 9-column schema:

| Position | Column | Description |
|---|---|---|
| 1 | `ID` | Stable register identifier (`ORG-<prefix>-<n>` or `ORG-<prefix>-<slug>`). |
| 2 | `URN` | Machine-readable URN slug (`urn:obligation:bank:*:v1`). For rows that previously did not carry an explicit URN, this reads `[TBD]`. The classification sprint to populate URNs is out of scope for this PR — see workstream `WS-URN-COVERAGE` below. |
| 3 | `Citation` | Instrument and section / clause (existing semantics). |
| 4 | `Requirement` | Plain-English statement of what the regulator requires (existing semantics). |
| 5 | `Fulfilment policy` | Where in the bank's policy library this obligation is met (existing semantics). |
| 6 | `Owner` | Accountable seat with engineering seat in parentheses where applicable (existing semantics). |
| 7 | `Status` | Bare lifecycle status: `IN FORCE`, `DRAFTING`, `PARTIAL`, `PLANNED`, `N/A-yet`, `corporate-bind`, `licence-bind`, `commencement-bind`, `conditional-bind`, `wave-2-deferred`, `PRE-LICENCE`, `IN FLIGHT`. The Status cell no longer carries `entity-scope:` / `applies-at:` annotations — those are extracted into columns 8 and 9. Substantive footnotes (e.g. v1.x version markers, cross-references) remain in the cell as a parenthetical tail where they were previously author-encoded; future versions will further normalise this. |
| 8 | `Entity scope` | One of `group`, `bank`, `securities`, `multi-entity`, `consolidated-supervision`, or `[TBD]`. Per the "Entity scope" section, the implicit-`bank` default applied to historical rows authored before v1.8 is preserved as `[TBD]` in this column to make the unclassified state explicit (rather than baking the implicit default into the cell value). |
| 9 | `Applies-at` | One of `entity-only`, `consolidated`, `look-through`, or `[TBD]`. Per the v1.9 vocabulary extension under D-REGULATORY-PERIMETER. |

**Domain N is exempt** — it is a citation-URN inventory (`Symbol | URN slug | Tranche | Instrument | Section | First consumed at | Confidence | Cross-references`), structurally distinct from the obligations rows. It does not carry obligations directly; it provides machine-readable handles that obligations rows cite. Its 25 rows remain in their existing 8-column shape.

**Status-summary, Entity-scope-vocabulary, and Applies-at-vocabulary tables** are also exempt — they are explanatory tables, not obligations rows.

## Substrate gaps remaining (out of scope for this PR)

These are explicitly **not** addressed in v1.13. Each is filed as a follow-on workstream / owner.

1. **`[citation: TBC]` markers (P1 #3, ~57 markers).** Workstream: `WS-INSTRUMENT-ANALYSES` (ongoing). Owner: Mira (compliance / RegTech engineer) under Zara (CCO), with Imani (legal-as-code engineer) ratifying precise sub-section indices at the licence-application gate, supported by external counsel. Each `[citation: TBC]` is a typed gap-tracker; v1.13 does not invent regulator citations (Principle 2).
2. **Entity-scope `[TBD]` resolution.** Workstream: `WS-ENTITY-SCOPE-CLASSIFICATION` (the v1 substrate task surfaced in `Owner Inbox/2026-05-09_mira_per-entity-register-scoping-v0.md`). After v1.13 every row has an explicit `Entity scope` column; ~196 of 232 rows currently read `[TBD]`. Resolving each `[TBD]` to one of `{group, bank, securities, multi-entity, consolidated-supervision}` is the classification sprint. Owner: Mira; co-input from Imani (legal-as-code engineer) for entity-tree alignment and Zara (CCO) for governance-side ratification.
3. **Applies-at `[TBD]` resolution.** Workstream: `WS-APPLIES-AT-CLASSIFICATION`. Same pattern as entity-scope; the v1.9 vocabulary extension authored a default of `entity-only` for un-classified rows. After v1.13, that default is no longer baked into the cell — it reads `[TBD]` until the row is explicitly classified. Owner: Mira; co-input from Camille (CFO, governance) for the prudential-rows-with-consolidated-reading subset.
4. **URN `[TBD]` resolution (P1 #2 follow-on).** Workstream: `WS-URN-COVERAGE`. The 195 historically-Schema-A rows now carry an explicit `URN` column with `[TBD]` where the row never had a URN. Populating URN slugs across the register under the canonical pattern `urn:obligation:bank:<domain-slug>:<row-slug>:v1` is its own pass. Owner: Mira; pattern rationale per Domain N v1.11 banner.
5. **URN-form vs ORG-form decision (P2 #5).** The register currently uses `ORG-*` IDs as the primary key with URN as a secondary handle. Whether to invert this (URN as primary, `ORG-*` as legacy alias) is a separate brief — the inversion would touch the substrate's `parseObligationsRegister()` regex in `prototype/platform/recon/retention-citation-coverage.ts` and any code that cross-references `ORG-*` IDs. Owner: Mira; cross-input from Atlas (core banking platform architect) on substrate-impact assessment.
6. **Instrument count deduplication.** Workstream: `WS-INSTRUMENT-DEDUP`. Today's `~70+ instruments` header reading is approximate; producing an exact count requires a deduplicated list of named regulator instruments across all `Citation` cells (collapsing e.g. all "Banks Act 94 of 1990 §§ X / Y / Z" mentions into one instrument with multiple section anchors). Owner: Mira; co-input from Imani for instrument canonicalisation.

## What this PR does NOT do

Per the dispatch brief's "Out of scope" list:

- Does **not** resolve the 57 `[citation: TBC]` markers (P1 #3).
- Does **not** bulk-classify entity-scope `[TBD]` placeholders.
- Does **not** touch the URN-form vs ORG-form decision (P2 #5).
- Does **not** change the obligations themselves; this is structural reconciliation only.

## Acceptance evidence

- After this PR, every obligations data row has the same 9 columns. (Domain N's 8-column citation-URN inventory and the explanatory tables remain in their distinct shapes; both are explicitly noted as exempt above.)
- Header counters reconcile to actuals: **232 obligations across 23 domain prefixes** (the domain-prefix expansion-rather-than-consolidation decision is documented above).
- All recon harnesses pass — most relevantly `prototype/platform/recon/retention-citation-coverage.ts`, which parses the register via the regex `/^\|\s*(ORG-[A-Z0-9-]+)\s*\|/`. The schema unification preserves `ORG-*` as the first cell of every obligations row, so the regex continues to match. The Domain N URN-table parser (`/^\|\s*\`([A-Z][A-Z0-9-]+)\`\s*\|/`) is untouched.
- Out-of-scope items are listed above with named workstreams and owners.

## Cross-references

- Authority basis for the 9-column schema: CLAUDE.md Principle 5 (multi-currency, multi-entity, multi-country from day one — entity-scope is a first-class field), Principle 6 (single-graph discipline — the obligations register is the operational expression of the upward chain Regulation → Policy → Procedure → System Capability), Principle 2 (every action traces to a source — every `[TBD]` is an explicit gap, never an invented value).
- Cross-references to other registers / substrate: `Owner Inbox/2026-05-06_policy-register.md`, `Owner Inbox/2026-05-06_governance-framework.md`, `Regulations/_index.md`, `prototype/platform/event-store/registry.ts`, `prototype/platform/recon/retention-citation-coverage.ts`.

—Mira (Compliance / RegTech engineer), under Zara (Chief Compliance Officer)
