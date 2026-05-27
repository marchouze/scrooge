---
title: Validation-methodology library — register
author: Nadia
date: 2026-05-09
summary: Per-tier register entry-point for the validation-methodology library. Tier-1 v0.1 populated; Tier-2 + Tier-3 planned. The library is the substantive "how-to-validate" that the model-validation cycle procedure (owned by Helena) calls into.
decision-required: false
maps-to-decision-id: D-S7-TARGETED-3-5-OPEN-QUESTIONS
---

# Validation-methodology library — register

**Curator:** Nadia (Independent model-validation engineer; reports to Helena (CRO); functionally independent of Rohan)
**As-of:** 2026-05-09
**Authority:** Sub-decision A of `D-S7-TARGETED-3-5-OPEN-QUESTIONS` (CEO-approved 2026-05-08, `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-s7-targeted-3-5-open-questions.md`); RAS § B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144); SR 11-7 §V; SS 1/23 Principle 4; BCBS *Corporate Governance Principles for Banks* Principles 6 + 8; Banks Act 94 of 1990 § 70(2A)(b).

> Per-tier register of the validation methodologies Nadia maintains. Each row points to the methodology page currently in force for that tier. The library is **per-tier**, not per-model: every model in a tier inherits the tier methodology; per-model validation reports cite the tier methodology version, not vice-versa. **Status:** `POPULATED` = methodology page authored; `PLANNED` = identified but not yet drafted.

## Register

| Artefact | Page | Version | Status | Citation chain | Slice |
|---|---|---|---|---|---|
| **Tier definitions (cross-tier anchor)** | [`_tier-definitions-v0.1.md`](_tier-definitions-v0.1.md) | v0.1 | **LOCKED-FOR-SLICE-A** | RAS § B7 · SR 11-7 §I + §V + §VI · SS 1/23 Principle 1 + Principle 4 · BCBS CG-Principles 6 + 8 · Banks Act § 70(2A)(b) | Slice A of validation-methodology library v0 |
| Tier-1 methodology | [`_methodology-tier-1.md`](_methodology-tier-1.md) | v0.1 | **POPULATED** | RAS § B7 · SR 11-7 §V + §VI · SS 1/23 Principle 4 · BCBS CG-Principles 6 + 8 · Banks Act § 70(2A)(b) · Reg 39 · IFRS 9 §5.5 · FIC Act ss.21–28 · FATF Rec. 10 | Slice C of validation-methodology library v0 |
| Tier-2 methodology | [`_methodology-tier-2.md`](_methodology-tier-2.md) | v0.1 | **POPULATED** | RAS § B7 · SR 11-7 §V + §VI · SS 1/23 Principle 4 · BCBS CG-Principles 6 + 8 | Slice E (follows Tier-1 + procedure-pair) |
| Tier-3 methodology | [`_methodology-tier-3.md`](_methodology-tier-3.md) | v0.1 | **POPULATED** | RAS § B7 · SR 11-7 §V (proportionate application) · SS 1/23 Principle 4 (proportionate) | Slice F (minimum-viable depth) |

Slice mapping per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §7.

## Procedure-pair partner

The methodology library does not stand alone — it is one half of a procedure-pair:

| Pair half | File | Owner | Says |
|---|---|---|---|
| **Cycle** (procedure) | `Procedures/by-policy/model-validation.md` | Helena (per `Procedures/_index.md` line 27, status `PLANNED`) | The cycle by which a candidate model moves from `ModelSubmitted` through tier-classification, validation-testing, and disposition (`approve` / `withhold` / `restrict-to-validated-envelope`). Step-level instruction is "**run the validation per the tier methodology**" — i.e. the cycle calls into this library. |
| **Substance** (methodology) | `Procedures/validation/_methodology-tier-N.md` | Nadia | What "run the validation" *means* at each tier: the seven dimensions (independent re-implementation, parallel-run cadence, benchmark / challenger expectations, sensitivity analysis, edge-case coverage, documentation standards, sign-off authority); the per-tier test catalogue against the backtest harness; the disposition authorities. |

The two pieces land together at minimum-viable depth (Slice C + Slice D of the validation-methodology library v0). Until Helena's cycle procedure lands, the methodology library carries the cycle's intent inline at each tier ("when invoked by the cycle, do …"); when the cycle lands, the inline references collapse to typed steps and the cycle becomes the canonical orchestrator.

## What this register does not do

- **Does not classify per-model tiers.** That is `ModelTierClassified` per model, emitted by Nadia per `Team/Nadia.md` §9, against RAS § B7 examples (Helena's Model Risk Policy carries the codified rules — `PLANNED` per `Owner Inbox/2026-05-06_policy-register.md`).
- **Does not list per-model validation reports.** Those land as Owner Inbox deliverables today (build-phase posture, sub-decision A.2) and become typed `ModelValidationApproved` / `ModelValidationWithheld` events at first real-position consumption.
- **Does not version the procedure-pair cycle.** Cycle versioning is Helena's; this register tracks methodology versions only.

## Substrate dependencies

- **Typed events** — `ValidationMethodologyPublished`, `BacktestBreachDisposed`, `ModelDriftDetected`, `ProductionUseRequested`, `MethodologyChangeRequested` are typed on the bus per PR #21 (Atlas typed-event slice). The first `ValidationMethodologyPublished` event for Tier-1 v0.1 emits at first model-validation run, not on this commit (consistent with sub-decision A.2 — no `ModelValidationApproved` until first real-position consumption).
- **Vera continuous-controls integration** — `@platform/recon/*` validation-cycle pipeline is Wave-4 #11, sequenced after Wave-4 #13 per the S7-Targeted ordering. Until live, missing methodology pages and stale revalidation cycles are not auto-detected findings.
- **`ProductionUseBoundary` schema** — typed envelope for `restrict-to-validated-envelope` dispositions; co-owned Atlas + Nadia + Kai; lands at S7-Targeted slice 5 (pre-trade gateway envelope).
- **Helena's cycle procedure** — `Procedures/by-policy/model-validation.md` (`PLANNED`, owner Helena); Slice D of the validation-methodology library v0.

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Nadia (via Scrooge) | Register opened. Tier-1 row `POPULATED` (methodology v0.1 authored as Slice C). Tier-2 + Tier-3 rows `PLANNED` (Slices E + F). Procedure-pair partner reference: `Procedures/by-policy/model-validation.md` (Helena, `PLANNED`). |
| v0.2 | 2026-05-09 | Nadia (via Scrooge) | Slice A landed: cross-tier `_tier-definitions-v0.1.md` row added at top of register, status `LOCKED-FOR-SLICE-A`. The tier-definitions file is the structural anchor (definitions, classification criteria, disambiguation, model taxonomy) the per-tier methodology pages inherit from. Procedure-pair stub created at `Procedures/by-policy/model-validation.md` (Helena, `STUB`) so the pair is discoverable in the graph. |
| v0.3 | 2026-05-27 | Nadia (via Scrooge) | Slices E + F landed: Tier-2 methodology v0.1 (`_methodology-tier-2.md`, status `POPULATED`) and Tier-3 methodology v0.1 (`_methodology-tier-3.md`, status `POPULATED`) authored as PR-G of the product-construction-slices-4-8 deliverable. Tier-2: seven dimensions; REQUIRED conceptual soundness + sensitivity + one of benchmark/challenger; 18-month approval expiry; authority D-PRODUCT-CONSTRUCTION-SLICES-4-8. Tier-3: two REQUIRED dimensions (conceptual soundness + documentation review); optional sensitivity and benchmark; 12-month approval expiry; proportionate for standard textbook models. |

—Nadia
