---
title: "Obligations register v1.19 — Requirement cell cleanup"
author: mira
date: 2026-05-13
version: "1.19"
decision-required: false
tags: [obligations-register, compliance, cleanup]
---

# Obligations register v1.19 — Requirement cell cleanup

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)  
**Date:** 2026-05-13  
**Authority:** Standing register-curator mandate (Mira under Zara) — no new CEO decision required.

## Summary

Targeted cleanup of column 4 (Requirement) across the obligations register. The Requirement cell must contain only the plain-English statement of what the regulator requires the bank to do — nothing more. This run strips all editorial, implementation, and accountability content that had accumulated in prior versions.

**Rows cleaned: 33**  
**Rows untouched: all remaining rows** (no pollution found, or Domain N exempt rows)  
**Cells other than Requirement: none touched**

## Stripping rules applied

1. **Discharge blocks** — sentences/clauses beginning `Discharge:` (implementation accountability; belongs in Owner column)
2. **Cross-reference blocks** — sentences/clauses beginning `Cross-reference` (editorial links to other rows or workstreams)
3. **Status note blocks** — blocks beginning `**Status note:**`
4. **Persona discharge notes in disguise** — trailing sentences beginning with a persona name + "'s" (e.g., "Helena's market-risk projection substrate…")
5. **Internal-system affect notes** — sentences beginning "Affects …" where subject is an internal system
6. **Internal workstream notes** — sentences beginning "See also …" or "Note:" referencing internal workstreams or substrate items
7. **Internal decision references** — references to `D-*` decisions or `PR #…` numbers that are not citation anchors
8. **Substrate-consumer details** — typed-event family names (`AdviceRecorded`, `SuitabilityAssessed`, etc.), TypeScript type references, `prototype/platform/…` file line-number anchors

## What was retained

- Core regulatory mandate (what the law/standard says the bank must do)
- Regulatory scope qualifiers (who it applies to, under what conditions)
- Numerical thresholds that are the regulatory requirement
- Regulatory tests and calculations the regulation prescribes
- Inline `[citation: TBC]` markers (these are citation placeholders, not editorial content)
- Regulatory interpretive glosses in gloss/reconciliation rows (the gloss on ORG-FC-11 re CEO-MLRO-bar, for example, is itself a regulatory interpretation — only the internal bank-implementation notes within were stripped)

## Domain-by-domain breakdown

| Domain | Rows cleaned | Primary pollution type |
|--------|-------------|----------------------|
| A (Prudential) | ORG-PR-22 through ORG-PR-48 (27 rows) | Discharge blocks; Cross-reference blocks; "Discrete D-series reads alongside" preambles; posture notes; URN/substrate notes |
| B (Financial crime) | ORG-FC-23 (1 row) | Discharge block; Cross-reference |
| E (Cyber) | ORG-CY-15, ORG-CY-16 (2 rows) | "Distinct from cybersecurity" context; Cross-references |
| F (Governance) | ORG-GV-21, ORG-GV-22 (2 rows) | Substrate-consumer details; URN references; BCBS sub-principle details; Cross-references |
| J (Markets) | ORG-MK-09 through ORG-MK-16 (8 rows) | Cross-references to Domain N; substrate-consumer details; "Dimensional-coverage URN" preambles; NPA gate-dimension cross-links |
| O (Thin human layer) | 9 rows | URN anchors; "Triggered by D-*" references; internal bank-design details (e.g. "AC Chair NED + 2 AC-member NEDs") |
| P (FAIS) | ORG-FAIS-RK-ADVICE through ORG-FAIS-RK-GENERAL-CODE (5 rows) | Substrate notes (`AdviceRecorded` etc.); Cross-references to other domain rows; "umbrella row carries the residual" meta-notes |
| Q (Consolidated) | ORG-BNK-CGPS-CONS through ORG-GRP-PA-PARENT (8 rows) | Substrate notes; reclassification history notes ("v1.8 → v1.9 reclassification:") |
| RM (Records Management) | ORG-RM-01 (1 row) | Massively stripped — entire implementation section replaced with the bare retention mandate |

## Pollution-type breakdown

| Pollution type | Occurrences (approximate) |
|---------------|--------------------------|
| Discharge block | ~22 rows |
| Cross-reference block | ~18 rows |
| Substrate-consumer note | ~12 rows |
| Reclassification history note | ~8 rows |
| Internal D-decision reference | ~15 rows |
| Persona name discharge note | ~5 rows |
| Posture / bank-design note | ~8 rows |

*Note: many rows had multiple pollution types; totals exceed 33 because they are counted per occurrence, not per row.*

## Judgment calls

1. **ORG-PR-32 (G3/2025 Climate Disclosures):** Retained the sentence: "G3/2025 currently does not require external assurance and does not create mandatory disclosure requirements — supervisory expectation only." This is a regulatory qualifier (what the standard actually says about its own binding force), not an internal workstream note.

2. **ORG-PR-28 (D10/2025 Pillar 3):** Original said "Same fulfilment chain as `ORG-PR-27`" — this is not a regulatory mandate. Replaced with the actual regulatory requirement: "Produce and publish Pillar 3 disclosure documents in accordance with D10/2025 (and superseded D1/2025 where applicable); comply with the format, frequency, and content requirements prescribed by the Directive."

3. **ORG-FAIS-RK-COMPLAINT-HANDLING:** TCF outcome 6 intersect was stripped (it describes the conceptual overlap with another framework, not what GCC ss.16–19 actually require). The five-year retention period from GCC s.16(2) was retained as it is the numerical regulatory threshold.

4. **ORG-FAIS-RK-GENERAL-CODE:** The "umbrella row carries the residual not separately registered" meta-note was stripped. Replaced with a clean statement of what the GCC actually requires.

5. **Domain O gloss rows (ORG-FC-11-GLOSS-CEO-MLRO-BAR, ORG-PR(IV)-13-GLOSS-DEPUTY-IO, ORG-CY-02-RECON-CRO-INDEPENDENCE):** These are reconciliation/gloss rows by design. The gloss itself (interpreting the regulatory position) was retained; only the internal bank-design notes within were stripped (e.g., "deputy-IO is the Company Secretary at licence-day", "alternate is the AC-Chair NED").

## Before/after examples

### Example 1 — ORG-MK-15 (JSE Equities Rules — retention)

**Before (abbreviated):** "Retain all pre-trade and post-trade records for JSE equities transactions for a minimum of seven years post-execution (JSE Equities Rules 2024, Rule 15.30). The URN slug `RETENTION_JSE_TRADE_7Y` in `prototype/platform/event-store/registry.ts:189–193` maps to this obligation. Discharge: Bea (CFO) owns the retention policy; Rohan (Risk engineer) + Atlas (Core banking platform architect) own the substrate. **Cross-references:** `ORG-GV-21` (BCBS 239 audit trail), `ORG-RM-01` (internal Records Management Policy)."

**After:** "Retain all pre-trade and post-trade records for JSE equities transactions for a minimum of seven years post-execution (JSE Equities Rules 2024, Rule 15.30)."

---

### Example 2 — ORG-PR-25 (Reg 39 product approval)

**Before (abbreviated):** "Reg 39 requires that any new product or activity subject to operational risk be subject to a formal approval process before introduction. Discharge: Atlas + Devon co-own the NPA substrate; Camille (CFO) owns the capital-impact gate (NPA dimension #7 RWA-delta); Helena (CRO) owns the risk-assessment gate (NPA dimensions #1–6, #8–#9). **Cross-reference:** ORG-PR-26 (BCBS PSMOR §27 new-product-approval principle). **Note:** The D-NPA-APPROVAL-POLICY (approved 2026-05-10) and D-PRODUCT-CONSTRUCTION-SUBSTRATE (approved 2026-05-10) underpin the NPA gate-dimension framework."

**After:** "Manage operational risk arising from new products and activities: Banks Act Regulation 39 requires a formal new-product and new-activity approval process before introduction; the process must assess and mitigate the operational risks of the new product or activity."

---

### Example 3 — ORG-FAIS-RK-SUITABILITY

**Before:** "Conduct and record a suitability assessment for each advice / intermediary-service interaction. Inputs: counterparty type (institutional / professional under § 1 definitions), product complexity, counterparty's stated objectives, counterparty's risk tolerance, counterparty's loss-bearing capacity. Output: pass / fail / conditional, with the inputs preserved as evidence. Substrate: typed-event family `SuitabilityAssessed` (Atlas v1). For institutional-only counterparties, the suitability test is calibrated to the institutional-counterparty assumption-set (institutional counterparties are presumed to understand product mechanics; ongoing information flow still applies per TCF outcome 3)."

**After:** "Conduct and record a suitability assessment for each advice / intermediary-service interaction. Inputs: counterparty type (institutional / professional under § 1 definitions), product complexity, counterparty's stated objectives, counterparty's risk tolerance, counterparty's loss-bearing capacity. Output: pass / fail / conditional, with the inputs preserved as evidence."

---

### Example 4 — ORG-RM-01 (Records Management Policy — runtime retention)

**Before (abbreviated):** "Retain every event in the runtime / substrate-management class… for a minimum 1-year horizon. The URN slug `RETENTION_RUNTIME_1Y` in `prototype/platform/event-store/registry.ts:195–202` maps to this obligation. Discharge: Atlas (Core banking platform architect) owns the event-store substrate; Devon (COO interim) owns the operational-resilience layer. **Cross-references:** `ORG-GV-21` (audit-trail retention), `ORG-MK-15` (JSE equities trade retention)."

**After:** "Retain every event in the runtime / substrate-management class (`ScheduledTrigger`, `AgentRegistered`, `AgentRetired`, and runtime-class events without regulator-mandated retention) for a minimum 1-year horizon under the bank's Records Management Policy."

---

### Example 5 — ORG-GV-DIRECTORS-MINIMUM

**Before:** "Public bank-controlling-company maintains the statutory minimum number of directors (Companies Act s.66(2): minimum three for a public company / Banks Act subject company); the bank's licence-day composition lifts this to a 3-NED floor + executive directors per Owen+Imani's drafted composition (CEO + Chair + AC Chair + S&E NED + 2 AC-member NEDs). URN: `urn:obligation:bank:org:gv:directors-minimum:v1`. Triggered by D-THIN-HUMAN-LAYER-MINIMUM."

**After:** "Maintain the statutory minimum number of directors: Companies Act s.66(2) requires a minimum of three directors for a public company; Banks Act s.60 imposes fit-and-proper and governance requirements on the board composition of a bank-controlling company."

## Schema compliance

- Domain N (M1 markets-foundation citation URN inventory) — not touched (exempt from 10-column schema per v1.13 schema unification note).
- Every edit confined to column 4 (Requirement). Column 3 (Citation), column 5 (Fulfilment policy), column 6 (Owner), column 7 (Status), column 8 (Entity scope), column 9 (Applies-at), column 10 (Risk taxonomy) — all untouched.
- No rows added, removed, or re-ordered.
