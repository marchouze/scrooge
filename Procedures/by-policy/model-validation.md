# Procedure — Model validation cycle

**Procedure ID:** PROC-RSK-MV-01
**Owner:** Helena (CRO governance — owns the cycle's outcome) · Nadia (independent-validation engineer — methodology authority) · Rohan (model owner / first-line for in-scope models, escalation target only)
**Approval:** BRC (interim: Interim Risk Forum + CEO concurrence per `ORG-GV-17`)
**Cadence:** Continuous on `ModelVersionPublished` and `ModelMaterialChange` events; scheduled cycle per tier (Tier 1 annual, Tier 2 biennial, Tier 3 hygiene-only) — tiers and cadences canonical per Nadia's methodology page (see §3 / §5)
**Version:** v0.1 — 2026-05-09
**Status:** Stub — companion-of-pair under construction. Methodology authority (`Methodology/validation/tier-definitions-v0.1.md`) authored by Nadia in parallel under S7-Targeted #3 sub-decision A; this cycle procedure stubs the CRO-side accountability and the cycle's reconciliation / evidence shape.

## 1. Source policy

- Model Risk Policy [citation: TBC — codified Model Risk Policy with tier classification is a pending policy artefact named in `D-S7-TARGETED-3-5-OPEN-QUESTIONS` decision pack §"Decisions surfaced for follow-on" row "Model Risk Policy with codified tier-classification"; owner Helena with Nadia input; target pre-first-novel-model.]
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` § B7 — three-tier model-risk classification with independent-validation pre-deployment for Tier 1 and Tier 2.
- `Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md` — model-risk-management policy excerpt cited by upstream procedures (e.g. `ecl-stage-projection-refresh.md` §1).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-PR-21` | Three-tier model risk classification; independent validation pre-deployment for Tier 1 + 2. | Tier definitions and validation gate per Nadia methodology page; cycle cadence per §4. |
| RAS B7 (CEO approved) | Internal three-tier model-risk regime per SR 11-7 idiom. | Cycle cadence dispatch on tier; model-registry production-eligibility flag. |
| SR 11-7 (US Federal Reserve / OCC) — used as reference | Independent validation, effective challenge, ongoing monitoring. | Methodology authority (Nadia); cycle outcome (Helena). |
| SS 1/23 (PRA — UK) — used as reference | Model-risk management principles aligned to SR 11-7. | Methodology authority (Nadia). |
| BCBS Corporate Governance Principles for Banks (2015) Principle 2 | Risk function independent; CRO accountable for the framework. | CRO ownership of cycle outcome per §4. |
| Banks Act 94 of 1990 § 70(2A)(b) [citation: TBC — exact subsection pending Mira register row per `D-S7-TARGETED-3-5-OPEN-QUESTIONS` sub-decision A.5] | Risk-management framework — model-risk subset. | Cycle is the operative procedure under the framework. |
| Regulations Relating to Banks Reg 39 [citation: TBC — Reg 39 cross-reference pending Mira register row] | Risk-management framework requirements. | Cycle integrates into the RMF. |

## 3. Purpose

The cycle is the bank's standing discipline for ensuring every in-scope model — Tier 1 and Tier 2 for sure; Tier 3 to a hygiene-only depth — has been independently validated against the methodology in force *before* its outputs are consumed by accounting, capital, or production decisioning. This procedure owns the **cycle**: triggers, accountabilities, reconciliation, evidence. It does **not** own the methodology (the criteria, the test design, the tolerance bands, the tier definitions). The methodology authority is Nadia's page — `Methodology/validation/tier-definitions-v0.1.md` (or wherever Nadia lands it) `[awaiting Nadia: methodology-v0 slice A]`.

The cycle and the methodology are a procedure-pair: the cycle cites the methodology for what to test; the methodology cites the cycle for when and how the test runs and who signs.

## 4. Trigger

- **Continuous (event-driven):**
  - `ModelVersionPublished` — new model or new version of an in-scope model. Cycle runs pre-deployment for Tier 1 and Tier 2; Tier 3 hygiene-only.
  - `ModelMaterialChange` — methodology change, input-data scope change, or production-use-boundary change to an existing in-use model. Re-validation required per tier rules in Nadia's methodology page.
  - `ValidationFindingRaised` (severity ≥ amber) from Rohan's backtest harness — see `D-S7-TARGETED-3-5-OPEN-QUESTIONS` sub-decision B; amber raises a finding, red also emits `RiskRaised` (Helena) and `AuditFinding` (Vera).
- **Scheduled (cadence-driven):**
  - Tier 1 annual full validation cycle [citation: per Nadia methodology page; band TBC pending v0.1 publication].
  - Tier 2 biennial full validation cycle [citation: per Nadia methodology page; band TBC].
  - Tier 3 hygiene-only check at minimum-viable depth [citation: per Nadia methodology page].
- **Escalation-driven:**
  - Supervisory letter or PA finding addressed at a named model — opens an *ad hoc* validation cycle outside the scheduled cadence. Owner: Helena; methodology authority: Nadia.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Resolve methodology in force.** Read the version-stamped methodology page for the model's tier (`Methodology/validation/tier-definitions-v0.1.md` for tier definitions; per-tier methodology files for the test designs and tolerance bands `[awaiting Nadia: methodology-v0 slice A + slice C for Tier-1 v0.1]`). | `agent` (Nadia) | `@platform/risk/methodology-registry` (`PLANNED`; today: markdown lookup) | Methodology authority is Nadia's page; the cycle never authors methodology inline. |
| 2 | **Read the model spec contract** for the in-scope model — version, tier classification, scope, intended use, validated envelope dimensions. | `agent` (Nadia) | `@platform/risk/model-registry` (`PLANNED`; today: markdown lookup) | Model-spec format contract is co-authored by Rohan + Nadia under S7-Targeted #3 slice B. |
| 3 | **Run the validation tests** named by the methodology page — backtests, conceptual-soundness review, ongoing-monitoring metrics, sensitivity / stability analysis, outcome-analysis where applicable. | `agent` (Nadia, as validator); first-line (Rohan) supports under effective-challenge discipline; first-line never validates first-line | `@platform/risk/backtest-harness` (S7-Targeted #4 — Rohan builds; Nadia consumes); `@platform/risk/validation-runner` (`PLANNED`) | Tests defined in Nadia's methodology page; cycle does not redefine. SR 11-7 effective-challenge discipline preserved by validator-vs-builder separation. |
| 4 | **Classify findings.** Each finding receives a severity per the methodology page's tolerance bands (red / amber / green). | `agent` (Nadia) | `@platform/risk/validation-runner` | Severity bands are Nadia's authority; cycle consumes the classification. |
| 5 | **Emit validation events.** `ValidationCycleStarted`, per-finding `ValidationFindingRaised { severity, model, methodology-version, citation-chain }`, `ValidationCycleCompleted` at end of cycle. Red findings additionally emit `RiskRaised` (to Helena) and `AuditFinding` (to Vera) per `D-S7-TARGETED-3-5-OPEN-QUESTIONS` sub-decision B.5. | `system` | `@platform/event-store`; `@platform/runtime/handlers/validation-cycle` (`PLANNED` — typed events `ValidationMethodologyPublished`, `ValidationCycleStarted`, `ValidationCycleCompleted`, `ValidationFindingRaised`, `ProductionUseBoundary` per Atlas next typed-event slice) | Bus-routing from day one (sub-decision A.3). Event types not yet typed at v0.1 publication; back-fill in Atlas slice. |
| 6 | **CRO-side disposition of red findings.** Helena reviews red findings; chooses among (i) block production-use until remediated, (ii) accept with named compensating control and timed remediation plan, (iii) escalate to BRC / CEO if material. Disposition is `BacktestBreachDisposed` (for backtest-derived reds; per sub-decision B.3) or `ValidationFindingDisposed` (general). | `agent` (Helena, governance) | `@platform/risk/dispositions` (`PLANNED`) | This is the **CRO-side accountability** — Helena owns the cycle's outcome, not the methodology. Auto-suspend on red is forbidden (would violate model-builder / validator separation per sub-decision B.3). |
| 7 | **Update model-registry production-eligibility.** On green or on disposed-amber, the model's `production-eligibility` flag flips to `eligible-within-envelope`; the validated envelope (dimensions per Nadia §5.4) is a typed `ProductionUseBoundary` consumed by Kai's pre-trade gateway under S7-Targeted #5. On red without disposition, eligibility remains `not-eligible`. | `system` | `@platform/risk/model-registry` | Model-registry is the canonical state; eligibility is event-derived. |
| 8 | **Sign and publish the cycle outcome.** Helena signs the cycle's published outcome (markdown artefact in `Owner Inbox/` for build-phase rehearsals; typed `ValidationCycleSigned` event for licence-day binding cycles per sub-decision A.2). | `agent` (Helena, governance) | `@platform/event-store`; `Owner Inbox/` for rehearsals | Build-phase posture: methodology-only on synthetic positions; first binding `ModelValidationApproved` event at commencement-of-trading per sub-decision A.2. |
| 9 | **Hand off to downstream consumers.** Bea's posting rules (where Tier-1 model in scope) gate on `production-eligibility = eligible`; Kai's pre-trade gateway (S7-Targeted #5) gates on the `ProductionUseBoundary`; Vera's continuous-controls pipeline (Wave-4 #11) consumes the cycle events for recon. | `system` (event subscription) | `@platform/event-store` | Cross-domain handoff via event subscription, not direct call (Principle 1). |

## 6. Reconciliation

- **Events produced:** `ValidationCycleStarted`, `ValidationFindingRaised` (per finding, with severity), `ValidationCycleCompleted`, `ValidationFindingDisposed` (Helena), `ValidationCycleSigned` (Helena), `ProductionUseBoundary` (where applicable). Red findings additionally emit `RiskRaised` (to Helena) and `AuditFinding` (to Vera).
- **Reconciliation check:** every model with `production-eligibility = eligible-within-envelope` has, in the event log, a `ValidationCycleSigned` for the model version currently in use, with a `ProductionUseBoundary` whose dimensions are consumed by Kai's gateway. Missing link = procedural breach surfaced by Vera Wave-4 #11 validation-cycle recon.
- **Cross-domain check:** every Tier-1 `StageTransition` (from `ecl-stage-projection-refresh.md`) for an in-use model must reconcile to a `ValidationCycleSigned` for that model version; orphan transitions are findings.
- **CeoDecision escalation path:** if Helena's disposition (Step 6) escalates to BRC / CEO, the escalation is a typed `AgentEscalation` (Wave-4 #14, planned) carrying the finding, options considered, and the constraint that prevented an autonomous CRO-disposition. The CEO's resolution emits a `CeoDecision` event linking the disposition decision-id to this cycle's run-id.
- **Failure mode:** a model whose cycle completes red with no disposition within the methodology page's stated SLA produces `ValidationCycleStalled`; surfaces as a Vera finding and an open Helena task. Production-eligibility remains `not-eligible` until disposed.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Validation report (methodology results, findings, severity classifications) | Authored by Nadia per methodology page; `Owner Inbox/` for rehearsals; attested artefact registry at licence-day | Permanent (linked to model version) | High |
| Helena disposition record (per red finding) | Event log + register | Permanent | High |
| Cycle-signed outcome | Event log (`ValidationCycleSigned`) | Permanent (P1) | High |
| `ProductionUseBoundary` envelope | Event log (typed event per Atlas slice) | Permanent (linked to model version) | High |
| Model-registry state (production-eligibility flag) | Cache; re-derivable from cycle events | n/a (cache) | High |
| Cycle events stream | Event log | Permanent (P1) | High |

## 8. Manual steps

- **Step 1** (resolve methodology in force) — Nadia exercises judgement on whether a previously-published methodology version still applies to a new model variant, or whether a methodology-page update is needed first.
- **Step 6** (disposition of red findings) — Helena's governance judgement; not automatable by definition.
- **Step 8** (sign and publish) — Helena's signature is the load-bearing governance act; the human CRO replaces Helena at licence-application lodgment per `D-THIN-HUMAN-LAYER-MINIMUM` and the CRO-seat criteria note `2026-05-09_helena_cro-seat-fit-and-proper-criteria.md`.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Methodology page stale vs model in scope | Vera Wave-4 #11 recon; Nadia's substrate-state run | Nadia + Helena; methodology page updated before cycle proceeds |
| Validator-builder separation breach (Rohan validates own model) | Vera continuous-controls pipeline (mandate-ownership check) | Helena (governance) + Thandiwe (CAE for third-line independence finding) |
| Red finding without Helena disposition past SLA | `ValidationCycleStalled` event | Vera finding; Owen secretariat surfaces to BRC / Interim Risk Forum |
| Production model without `ValidationCycleSigned` | Vera Wave-4 #11 recon | Critical — Helena + Vera + Thandiwe; production-eligibility flipped to `not-eligible` immediately |
| Auto-suspend triggered on red without Helena disposition | Cycle-handler audit | Senna + Helena — protocol breach (sub-decision B.3 forbids auto-suspend) |

## 10. Related procedures

- [`ecl-stage-projection-refresh.md`](ecl-stage-projection-refresh.md) (`PROC-RSK-EC-01`) — consumes Tier-1 ECL model validation outcome; gates on `production-eligibility`.
- `Methodology/validation/tier-definitions-v0.1.md` (Nadia, in flight under S7-Targeted #3 slice A) — methodology authority for tier classification. `[awaiting Nadia: methodology-v0 slice A]`
- `Methodology/validation/tier-1-methodology-v0.1.md` (Nadia, S7-Targeted #3 slice C) — Tier-1 test designs and tolerance bands. `[awaiting Nadia: methodology-v0 slice C]`
- `posting-rule-publication.md` (Bea) — downstream consumer for Tier-1 ECL model production-eligibility.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Helena (with Nadia methodology cross-references) | Initial stub — CRO-side accountability and cycle's reconciliation / evidence shape, per `D-S7-TARGETED-3-5-OPEN-QUESTIONS` follow-on route to Helena. Methodology authority (Nadia's page) authored in parallel under S7-Targeted #3 sub-decision A. Procedure-pair completion contingent on Nadia's slice-A and slice-C landing. |

## 12. Audit / assurance

- **Vera Wave-4 #11** validation-cycle recon — primary instrument. Tests:
  - Every model with `production-eligibility = eligible-within-envelope` has a `ValidationCycleSigned` for the model version in use.
  - Every red finding reconciles to either a `ValidationFindingDisposed` (Helena) or a `ValidationCycleStalled` (SLA-breached).
  - Validator-builder separation: no `ValidationCycleSigned` whose validator-id matches the model's builder-id.
- **Thandiwe (CAE)** consumes Vera's evidence for the third-line opinion to the (Interim) Audit Forum.
- **Helena** consumes the same evidence for the second-line opinion to the (Interim) Risk Forum, and for ICAAP / ILAAP model-risk narrative.
- **Annual independent review** of the cycle's integrity is a Vera Wave-4 deliverable; external assessor optional under SR 11-7 idiom.

## 13. Substrate gaps surfaced by this stub

- **Methodology-page cross-references** marked `[awaiting Nadia: methodology-v0 slice A]` and `[awaiting Nadia: methodology-v0 slice C]` resolve when Nadia's parallel work lands.
- **`[citation: TBC]`** markers in §1 (Model Risk Policy) and §2 (Banks Act § 70(2A)(b); Reg 39) resolve when Mira's obligations-register row additions land per `D-S7-TARGETED-3-5-OPEN-QUESTIONS` sub-decision A.5.
- **Typed events** (`ValidationMethodologyPublished`, `ValidationCycleStarted`, `ValidationCycleCompleted`, `ValidationFindingRaised`, `ProductionUseBoundary`, `ValidationCycleSigned`, `ValidationCycleStalled`, `ValidationFindingDisposed`) are not yet defined in the event-type catalogue; back-fill in Atlas's next typed-event slice per `D-S7-TARGETED-3-5-OPEN-QUESTIONS` follow-on routes.
- **`@platform/risk/methodology-registry`**, **`@platform/risk/model-registry`** (production-eligibility flag), **`@platform/risk/validation-runner`**, **`@platform/risk/dispositions`** are PLANNED capabilities; today the registry is markdown-lookup and the dispositions are Owner Inbox artefacts.
- **CRO-seat handover** — at human-CRO appointment (per `D-THIN-HUMAN-LAYER-MINIMUM`), Step 6 and Step 8 signatory transitions from Helena to the human CRO; the cycle procedure does not change, only the named owner. Touch-time edit at handover.
