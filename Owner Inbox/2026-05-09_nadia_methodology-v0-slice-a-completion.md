---
title: Validation-methodology library v0 — Slice A completion note
author: Nadia
date: 2026-05-09
summary: Slice A of validation-methodology library v0 is locked. Tier-1 / Tier-2 / Tier-3 definitions, classification criteria, boundary disambiguation rules, and the taxonomy of what counts as a "model" for tier purposes are bound at `Procedures/validation/_tier-definitions-v0.1.md` (status `locked-for-slice-A`). Slice B (model-spec contract co-author with Rohan) is unblocked. Slice D (Helena's cycle procedure) is now `STUB` discoverable. Substrate gaps (Mira citations; Helena policy + cycle; Vera unregistered-model recon; `ProductionUseBoundary` schema) inventoried. No invented citations — all gaps flagged `[citation: TBC]` per Principle 2.
decision-required: false
maps-to-decision-id: D-S7-TARGETED-3-5-OPEN-QUESTIONS
---

# Validation-methodology library v0 — Slice A completion note

**Author:** Nadia (Independent model-validation engineer)
**Reports through:** Helena (CRO); functionally independent of Rohan
**For:** Marc (CEO) — via Scrooge
**Decision authority:** Sub-decision A of `D-S7-TARGETED-3-5-OPEN-QUESTIONS` (CEO-approved 2026-05-08, `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-s7-targeted-3-5-open-questions.md`); scoping brief `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md`.

## What landed in Slice A

| Artefact | Path | Status |
|---|---|---|
| Tier definitions (substance) | [`Procedures/validation/_tier-definitions-v0.1.md`](../Procedures/validation/_tier-definitions-v0.1.md) | `locked-for-slice-A` |
| Validation-library register update | [`Procedures/validation/_index.md`](../Procedures/validation/_index.md) | Cross-tier row added at top; v0.2 change-log entry |
| Procedure-pair partner stub | [`Procedures/by-policy/model-validation.md`](../Procedures/by-policy/model-validation.md) | `STUB` — awaiting Helena population (Slice D) |
| Master procedures-index update | [`Procedures/_index.md`](../Procedures/_index.md) | `model-validation.md` flipped `PLANNED` → `STUB` with Nadia cross-link |

The Slice A artefact contains:

- **§1** — Tier-1 / Tier-2 / Tier-3 definitions (model classes; severity; cadence pre-deployment + revalidation + monitoring; who validates; evidence required; disposition authority; RAS § B7 anchor; methodology-page pointer).
- **§2** — Classification criteria (the rule behind the RAS § B7 examples): four Tier-1 criteria (regulatory submission · capital/liquidity ratio · financial-statement provision · AML decision); three Tier-2 criteria (customer/counterparty pricing · risk sensitivities non-capital-bound · behavioural/forecast driving ALM); two Tier-3 criteria (human-reviewed-before-action · strictly informational).
- **§3** — Disambiguation rules at the boundaries: Tier-1 vs Tier-2 worked examples (eight rows including FRTB sensitivity engine, OTC IRD pricing engine variants, IFRS 9 PD, behavioural-deposit decay variants, customer-segmentation variants, AML rule-engine); Tier-2 vs Tier-3 worked examples; build-phase synthetic-position carve-out per sub-decision A.2; novel-model escalation rule.
- **§4** — Taxonomy of what counts as a "model" for tier purposes (statistical/ML; deterministic quantitative methods; rule-based algorithms; hybrid systems; LLM-assisted decisioning) and what does not (pure ETL; reporting layouts; static configuration; software bugs).

Reconciled a cadence inconsistency: Tier-2 revalidation is **biennial** per RAS § B7; the scoping brief's "18-month" is non-substantive editorial drift, now bound to biennial.

## What is deferred (Slices B and C and beyond)

| Slice | Scope | Owner | Sequencing |
|---|---|---|---|
| **B — model-spec contract** | The seven dimensions (purpose · data inputs · outputs · methodology · training procedure · validation envelope · deployment scope) + frontmatter contract for `prototype/platform/risk/model-specs/<modelId>-spec.md`. The template `_template.md` already exists per PR #20; Slice B is a co-author reconciliation pass with Rohan, not a fresh authoring. | Nadia + Rohan | **Unblocked by this PR.** Target cadence: one session co-author pass after Slice A merges, before any Tier-N methodology version-up. Rohan is gated on Slice A landing per CEO follow-on route. |
| **C — Tier-1 methodology v0.1** | Substantive Tier-1 methodology — already landed via PR #25. May be patched in a v0.2 minor revision once Slice A's locked definitions are fully reconciled with the Tier-1 page (a follow-on housekeeping pass; not a substantive change). | Nadia | After Slice B. |
| **D — procedure-pair completion** | Helena populates `Procedures/by-policy/model-validation.md` (currently `STUB`). Nadia's Slice A gives Helena the substance-side anchor to call into. | Helena | After Slice A (this PR). |
| **E — Tier-2 methodology v0.1** | Substantive Tier-2: pricing engines, FRTB sensitivities, behavioural-deposit. | Nadia | After Slices B and (ideally) D. |
| **F — Tier-3 methodology v0.1** | Substantive Tier-3 minimum-viable depth: sample-audit + on-material-change revalidation. | Nadia | After Slices B and (ideally) D. |
| **G — backtest-harness contract hand-off** | Per-tier test catalogue feeds S7-Targeted item #4 (Rohan-led; harness already in flight per PR #27 ECL Tier-1 harness). | Nadia → Rohan + Atlas | Sequenced separately from Slices A–F per scoping brief §7.7. |

## Slice B model-spec contract — co-author cadence with Rohan

Per the CEO decision record's follow-on routes, Rohan's harness work is gated on Nadia's methodology v0; Slice B itself is gated on Slice A landing. The handshake:

1. **Slice A merges** — this PR.
2. **Nadia drafts the model-spec contract delta** against the existing `prototype/platform/risk/model-specs/_template.md` (PR #20). Slice B is a *reconciliation* of the existing template against §3.2 of the scoping brief (the seven dimensions), not a fresh authoring.
3. **Rohan reviews** the seven dimensions and the frontmatter shape; one co-author pass produces the binding contract.
4. **Contract becomes binding on next `ModelSubmitted`.**

Target turnaround: one session pass between Nadia and Rohan, sequenced after this PR merges and before any further Tier-N methodology version-up.

## Substrate gaps surfaced by Slice A

Inventoried in detail at `Procedures/validation/_tier-definitions-v0.1.md` §6. Summary:

| # | Gap | Owner | Blocks |
|---|---|---|---|
| 1 | Model Risk Policy with codified tier-classification rules | Helena | First novel-model-class candidate (methodology defers to Slice A's §2 criteria until policy lands). |
| 2 | Helena's cycle procedure (now `STUB`, awaiting population) | Helena | Canonical cycle orchestration. |
| 3 | Model-spec contract (Slice B) | Rohan + Nadia | Validation rigour at submission time. |
| 4 | Obligations-register entries for SR 11-7 §I, SS 1/23 Principle 1, Banks Act § 70(2A)(b), Reg 39 explicit row, IFRS 13, BCBS Basel III output floor adoption status, SARB Directive 5/2017 | Mira (S3 follow-on) | Citation-chain closure for Slices C / E / F. Slice A binds with `[citation: TBC]` markers. |
| 5 | Vera continuous-controls recon for unregistered-models / EUC detection | Vera | Detection of spreadsheet-driven models meeting C1.1 — C1.4 but lacking `ModelSubmitted`. |
| 6 | `ProductionUseBoundary` schema | Atlas + Nadia + Kai | Typed envelope for `restrict-to-validated-envelope`. S7-Targeted slice 5. |

## Citations needing resolution by Marc / Helena / Rohan / Mira

All `[citation: TBC]` markers in the Slice A artefact route to **Mira** (obligations-register curator). They do not block Slice A locking — they block publication of Slices C / E / F at substantive depth, and the existing Tier-1 methodology v0.1 (`_methodology-tier-1.md`) carries the same `[register: route to Mira]` markers (already routed). The Mira-owned items, none of which require Marc / Helena / Rohan adjudication:

- Explicit obligations-register row for **SR 11-7 §I** (definition of "model").
- Explicit obligations-register row for **SS 1/23 Principle 1** (model identification).
- Explicit obligations-register row for **Banks Act § 70(2A)(b)** sub-clause.
- Explicit obligations-register row for **Reg 39** (currently referenced indirectly).
- Explicit obligations-register row for **IFRS 13** (fair-value measurement).
- Explicit obligations-register row for **BCBS Basel III output floor adoption status** in SA.
- Explicit obligations-register row for **SARB Directive 5/2017** (IFRS 9 expectations).

These are tracking items, not blockers. Mira's S3 follow-on cycle covers them.

**One Helena-routed item** — the BCBS *Corporate Governance Principles for Banks* register-row IDs (`ORG-GV-10` and `ORG-GV-18`) referenced in Slice A's authority chain need a quick verification pass against the live obligations register before Slices C / E / F republish; if the IDs have shifted, the Slice A authority chain is non-substantively edited. Not a content issue.

## Independence posture

This Slice A artefact was authored by Nadia without Rohan's input on the §2 classification criteria — that segregation is intentional. The §2 criteria are the second-line's call on tier classification; Rohan's input on Slice B (the model-spec contract he submits *to* the validation discipline) is a different segregation boundary. Helena's governance input on the tier policy lands separately (Slice D's cycle authoring; Model Risk Policy when it stands up).

## What is not in this PR

- **No Slice B work.** Model-spec contract is gated on this slice landing; co-author session with Rohan follows.
- **No Slice C revisions.** The Tier-1 methodology v0.1 page (PR #25) stands as-is; a v0.2 housekeeping pass to fully reconcile with Slice A's locked definitions is a separate follow-on.
- **No event emission.** `ValidationMethodologyPublished` is not emitted on this commit (consistent with sub-decision A.2 of the CEO decision pack — methodology versions emit at first model-validation run).
- **No Helena cycle authoring.** The `Procedures/by-policy/model-validation.md` file is created only as a `STUB` cross-link; the substance is `[awaiting Helena: procedure-pair completion per follow-on route]`.
- **No Atlas event-typing.** Slice A has zero substrate footprint; the typed-event work for `ProductionUseBoundary` and any LLM-model-tracking events is Atlas's separate Wave dispatch.
- **No Anya semantic-layer entries.** Same — separate dispatch.

## Authority

- **CEO decision** — `D-S7-TARGETED-3-5-OPEN-QUESTIONS` (sub-decision A approved as drafted, 2026-05-08).
- **Source brief** — `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §7.1.
- **CLAUDE.md** — Principles 2 (citation discipline), 6 (single-graph), 7 (autonomous-by-default).
- **RAS § B7** — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144.

—Nadia
