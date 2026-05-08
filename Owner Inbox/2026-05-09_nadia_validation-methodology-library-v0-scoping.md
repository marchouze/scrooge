---
title: Validation-methodology library v0 — scoping brief
author: Nadia
date: 2026-05-09
summary: Scopes the validation-methodology library by tier (Tier-1 / Tier-2 / Tier-3); names the model-spec contract Rohan must produce so methodology is enforceable; surfaces the open questions Marc must adjudicate before substantive Tier-1 / Tier-2 / Tier-3 methodology pages land.
decision-required: false
for-input-from: Rohan, Helena
---

# Validation-methodology library v0 — scoping brief

**Author:** Nadia (Independent model-validation engineer)
**Reports through:** Helena (CRO); functionally independent of Rohan
**For:** Marc (CEO) — via Scrooge
**Pair brief:** S7-Targeted item #3 in `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2 (the substrate-completeness budget's recommended ordering: Vera Wave-4 #13 → A2.2 Phase 1 cutover → **validation-methodology authoring** → backtest harness → pre-trade gateway envelope). This brief executes the *scoping* slice that precedes substantive content.
**Date:** 2026-05-09
**Status:** Specification-only. No methodology pages are authored here; this brief defines what they *will* be, where they live, what contracts they depend on, and what Marc must adjudicate first.
**Authority:**
- CEO directive 2026-05-08 EOD authorising the IV hire (`Owner Inbox/2026-05-09_pax_independent-validation-role-brief.md`).
- RAS § B7 (model-risk tiers) — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144.
- Principle 6 (single-graph discipline) — CLAUDE.md.
- Principle 7 (autonomous-by-default) — CLAUDE.md.
- `Team/Nadia.md` §11 (registers maintained), §13 (procedures owned, planned), §16 (substrate gaps).

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it specifies how the model-risk policy (the *what*) will be discharged at the methodology layer (the *how* of validation). It cites RAS § B7, SR 11-7, SS 1/23, BCBS Corporate Governance Principles for Banks, Banks Act § 70(2A)(b). No new regulatory citations are introduced; if any are needed they route through Mira's obligations register, not invented here.

---

## 1. What the methodology library is

The validation-methodology library is the **canonical, citable record (Principle 2) of how Nadia validates each tier of model.** It is a static specification, versioned forward, that prescribes — for each tier — the validation work that must happen before a `ModelValidationApproved` event can be emitted, and the cadence at which previously-approved models are re-validated.

The library has three tiers, mirroring RAS § B7:

- **Tier-1 methodology.** Regulatory capital RWA models; IFRS 9 ECL; AML monitoring core models. Independent validation pre-deployment; **annual revalidation**; continuous monitoring. The most rigorous tier.
- **Tier-2 methodology.** Pricing engines; risk sensitivities; behavioural-deposit models. Independent validation pre-deployment; **18-month revalidation**.
- **Tier-3 methodology.** Operational analytics; customer-segmentation; non-decisioning models. Internal review; sample audit; revalidation **on material change**.

Each tier methodology page specifies, at minimum, the seven dimensions named in `Team/Nadia.md` §3 and §4:

1. **Independent re-implementation cadence** — for which model classes Nadia codes a parallel implementation against the event store, vs. relies on conceptual-soundness review only.
2. **Parallel-run cadence** — frequency at which Nadia's challenger output is run alongside Rohan's production output and the divergence is dispositioned.
3. **Benchmark / challenger expectations** — what counts as a benchmark (well-known industry baseline, simpler model class) vs. a challenger (independent reformulation by Nadia); when each is required.
4. **Sensitivity analysis** — perturbation envelope for each input; pass / restrict / withhold thresholds.
5. **Edge-case coverage** — minimum scenario set; how it is sourced; how "edge" is defined per model class.
6. **Documentation standards** — the SR 11-7 §VI artefact set the validation report must satisfy at this tier; what survives a PA on-site inspection.
7. **Sign-off authority** — which dispositions Nadia is authorised to issue (`approve` / `withhold` / `restrict-to-validated-envelope`); what triggers escalation to Helena under `Team/Nadia.md` §10.

The library is *not* a per-model document. It is a **per-tier specification** that every model in that tier inherits. Per-model validation reports cite the tier methodology version; the report records what was actually done and what was found, not what should have been done — that lives in the methodology.

The library is consumed by:

- **Nadia herself** at every `ProductionUseRequested` and at every scheduled revalidation cycle (`Team/Nadia.md` §7).
- **Vera** as the input to the continuous-controls assurance pipeline that asserts every approved model has a validation report meeting the tier methodology's documentation standards (`Team/Nadia.md` §15 — Wave-4 reportable findings).
- **Helena** as the framework-level reference she challenges at the BRC ("does Tier-1 methodology actually require re-implementation, or did we let it slip to conceptual-soundness review?").
- **Rohan** as the input that tells him what evidence he must produce for a candidate model to clear validation at its tier.
- **Thandiwe / future Audit Committee** as the artefact that demonstrates the bank's model-risk framework is operating, not aspirational.

---

## 2. Where the library lives

Two siting options, both consistent with existing register patterns.

### Option A — `Procedures/_validation-methodology-register.md`

Single register file at the Procedures root, parallel in shape to:

- `Procedures/_index.md` (the master procedures inventory).
- `Regulations/_obligations-register.md` (Mira's typed-citation register).
- `Owner Inbox/2026-05-06_policy-register.md` (Owen's policy register).

The register holds three rows — one per tier — each row pointing into the body content for the tier methodology version currently in force. New methodology versions are appended; superseded versions are retained for replay. Every row carries a citation chain to SR 11-7 / SS 1/23 / RAS § B7.

**Advantage.** Single canonical entry point; readable at a glance; matches the existing register-at-root pattern. Citation chain is one click deep.

**Disadvantage.** Three tier methodologies in one file produce a long document. Tier-1 alone is expected to be ~150–250 lines; Tier-2 + Tier-3 add another ~200. The file becomes unwieldy.

### Option B — `Procedures/validation/` directory

Per-tier files plus an index:

```
Procedures/
  validation/
    _index.md                      # Register entry-point; one row per tier
    _methodology-tier-1.md         # Tier-1 methodology v0.1 → forward
    _methodology-tier-2.md         # Tier-2 methodology v0.1 → forward
    _methodology-tier-3.md         # Tier-3 methodology v0.1 → forward
```

The `_index.md` matches the shape of `Procedures/_index.md` — register table at the top with status (`POPULATED` / `STUB` / `PLANNED`), version, citation chain. Per-tier files hold the substantive methodology content.

**Advantage.** Each tier methodology is its own file — versionable, diffable, citable per file. New tier (if a Tier-4 ever emerges, e.g. for advisory-only LLM applications) is one new file. Vera's per-tier recon pipelines can target one file at a time. Matches the directory shape Atlas uses for `prototype/platform/<capability>/`.

**Disadvantage.** Three files instead of one; slightly more navigation. Marginally redundant with the master `Procedures/_index.md`.

### Recommendation — Option B

**Adopt `Procedures/validation/`.** Rationale:

- **Tier methodologies will diverge in length and shape.** Tier-1 is heavier than Tier-3 by the nature of the discipline. Mixing them in one file blurs the rigour difference.
- **Versioning is per-tier.** A Tier-2 methodology change should not bump the Tier-1 version. Per-file versions preserve that.
- **Vera's continuous-controls integration is per-tier.** The recon pipeline that asserts "every Tier-1 model has a validation report meeting the Tier-1 methodology" needs to point at a single file; cross-file references are a known recon failure mode (Vera Wave-4 #16 prose-duplication recon).
- **Existing pattern fit.** `Procedures/by-policy/` already groups procedures by domain; `Procedures/validation/` is the same shape applied to a single owner.

Reading carefully: the master `Procedures/_index.md` (lines 27 — Risk section) already names `Procedures/by-policy/model-validation.md` as `PLANNED`, owner Helena (independent validation). That file is a *procedure* (the cycle by which a candidate model moves through validation); the methodology library is the *substance the procedure calls into* — the two are distinct but cross-reference each other. The procedure says "run the validation per the tier methodology"; the methodology says "here is what 'run the validation' means at Tier-1." They live as a pair: `Procedures/by-policy/model-validation.md` (cycle) calls into `Procedures/validation/_methodology-tier-N.md` (substance).

---

## 3. What Rohan owes Nadia — the model-spec contract

The methodology library is structurally unenforceable without a model-spec format that Rohan produces for every candidate model. Validation cannot start until the spec is in. The contract:

### 3.1 Existing substrate to cite

The model-registry skeleton already exists at `prototype/platform/model-registry/registry.ts` and the `ModelSubmitted` event is typed in `prototype/platform/event-store/event-types.ts` lines 949–1016. The submission carries:

| Field | What Rohan provides |
|---|---|
| `modelId` | Stable id (e.g. `model:var-historical-99`) |
| `submittedBy` | Strong identity of the submitter |
| `version` | Submitter's version label |
| `tier` | Submitter's proposed tier (Nadia may override via `ModelTierClassified`) |
| `methodologyHash` | SHA-256 of the methodology spec at submission — idempotency key |
| `description` | One-line purpose |

This is the *envelope*. The `methodologyHash` field references a methodology document, but the **shape of what that document must contain is not yet specified.** Rohan can submit any methodology blob today and the registry would accept it. That is the contract gap.

### 3.2 What the model-spec must contain (proposal — for Rohan to validate)

The methodology document Rohan hashes into `methodologyHash` should — at minimum — populate the following SR 11-7 §V.1 conceptual-soundness-review dimensions:

1. **Model purpose.** What decision the model supports; which output use-case (regulatory submission / accounting application / operational decision); which downstream consumers.
2. **Data inputs.** Source streams; data lineage to the event log; BCBS 239 conformance assertion (`Team/Nadia.md` §4 — risk-data-aggregation as validation precondition).
3. **Outputs.** Schema; downstream consumers; the use-case envelope.
4. **Methodology.** The mathematical / algorithmic specification — the model class, parameter set, calibration approach. Citation to any standard methodology being implemented (e.g. "Kupiec POF test for VaR backtest" → SR 11-7 §V.4 outcome analysis).
5. **Training procedure.** For statistical / ML models — training corpus, train/test split, calibration cycle. For deterministic models — parameter-source register entries (rates, vol surfaces, spreads).
6. **Validation envelope.** The asset-class / portfolio-scope / scenario-range bounds within which the model is claimed to be valid. **This is the field Nadia's `restrict-to-validated-envelope` disposition reads from** (`Team/Nadia.md` §9 — `ProductionUseBoundary` schema). Without it, every approval is necessarily binary.
7. **Deployment scope.** Which downstream consumers are authorised; which are advisory-only.

The methodology document is a typed file — a Markdown file with a frontmatter contract that Rohan's submission discipline (and Vera's recon) can assert against. Proposed name: `prototype/platform/risk/model-specs/<modelId>-spec.md`. The frontmatter shape is itself part of the contract and is co-designed with Rohan in the next slice.

### 3.3 Why this is Rohan's

Per `Team/Rohan.md` §5 ("Documents methodology before code") and §13 (`model-risk-cycle.md` — owner Rohan, planned), Rohan already commits to methodology-before-code as working style. The model-spec contract formalises what "methodology" means at submission — it does not add a new discipline, it codifies an existing one. The spec format also eliminates a recurring failure mode the IV literature names: validators retro-fitting the candidate model's framing into the validation, because no independent specification was available to validate against. SR 11-7 §V.1 ("effective challenge") is structurally weaker without it.

### 3.4 What Nadia commits to in return

In return for a complete model-spec at submission, Nadia commits to:

- Tier-classification within 5 working days (`Team/Nadia.md` §7 first-row SLA).
- Validation report within tier-stipulated window (Tier-1: 30 working days; Tier-2: 20; Tier-3: 10).
- Findings with severity, owner, and deadline assigned at the moment they are raised — no parking lot.

If the spec is incomplete at submission, Nadia withholds tier-classification with a `ValidationFindingRaised` event citing the missing dimensions. The clock does not start until the spec is complete. This is the behaviour SR 11-7 prescribes; codifying it removes ambiguity.

---

## 4. What Helena owes Nadia — the tier policy

The methodology library defers to Helena's tier definitions for the boundary between Tier-1 / Tier-2 / Tier-3. The methodology says *how* Nadia validates a Tier-1 model; it does not say *which* models are Tier-1.

### 4.1 What exists today

RAS § B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144) defines tiers by examples:

- Tier 1: regulatory capital RWA models; IFRS 9 ECL; AML monitoring core models.
- Tier 2: pricing engines; risk sensitivities; behavioural-deposit models.
- Tier 3: operational analytics; customer-segmentation; non-decisioning models.

This is a list of examples, not a rule. A novel candidate (a climate-stress-scenario model; an LLM-assisted advisory tool; a counterparty rating model) does not unambiguously land in one tier.

### 4.2 What the methodology library needs from Helena

The tier policy needs to express the **classification rule** behind the examples — the dimensions on which a model is classified, with examples demonstrating each:

- **Regulatory consequence** — does an output appear in a regulatory submission (BA returns, IFRS-disclosed numbers, FATCA / CRS XML)? → Tier-1 candidate.
- **Decisioning consequence** — does an output drive an automated customer / counterparty / trade decision? → Tier-1 / Tier-2.
- **Capital / liquidity consequence** — does an output enter capital ratios or liquidity coverage computations? → Tier-1.
- **AML / financial-crime consequence** — does an output drive transaction-monitoring alerts, sanctions screening, PEP detection? → Tier-1.
- **Advisory / operational consequence** — output is human-reviewed before action? → Tier-3.

This is the *Model Risk Policy* in the policy register (`Owner Inbox/2026-05-06_policy-register.md` — listed as `PLANNED` (B7 approved)). Tier-classification rules are a specific section of that policy; B7 is the appetite, the policy is the governance.

### 4.3 Substrate gap

**Until Model Risk Policy lands, the methodology library treats RAS § B7 as the binding tier definition and Nadia uses judgment for novel candidates** (escalating to Helena per `Team/Nadia.md` §10 — *"Novel model class outside existing tier definitions"* row). This is an acceptable build-phase posture; flagged here so the gap is visible. It binds at first novel-model registration.

---

## 5. Open questions for Marc

Five questions, in order of decision urgency.

### 5.1 Which tier methodology cuts first?

**Question.** Tier-1, Tier-2, or all three in parallel?

**Default if no decision.** Tier-1. Rationale: Tier-1 models are the licence-day bind (capital RWA, IFRS 9 ECL — Banks Act § 70 + Reg 39); Tier-2 (pricing engines) binds at commencement of trading; Tier-3 binds at first operational analytics deployment. Tier-1 is the critical path. Tier-2 and Tier-3 follow at their own cadence.

**Counter-argument.** Tier-2 methodology is also load-bearing because Rohan's pricing-engine and FRTB-sensitivity engines are mid-build (`Team/Rohan.md` §16) and need methodology at the moment of registration. Defer Tier-2 too long and the registration discipline is unenforced for Tier-2 candidates.

**Recommendation.** Sequence Tier-1 first; Tier-2 in the immediately following session; Tier-3 hygiene-only at minimum-viable depth.

### 5.2 What counts as "production" in the build phase?

**Question.** The bank has no real customers yet. Does pre-licence-day rehearsal of an ICAAP cycle (Helena § 16; Rohan § 16; `Team/Nadia.md` §16) count as "production" for validation purposes? If yes, the first IFRS 9 ECL model needs Tier-1 validation *now* before the rehearsal cycle. If no, validation activates at licence-day commencement-of-trading and build-phase rehearsals run methodology-only.

**Default if no decision.** Build-phase rehearsals run methodology-only; no `ModelValidationApproved` events for synthetic-position models. The synthetic-position outputs are not consumed downstream (`Team/Rohan.md` §16 — *"build-phase work runs against synthetic positions to validate the risk substrate end-to-end"*). The first `ModelValidationApproved` event lands at first model-with-real-consumption (per `project_rules_bind_at_commencement` memory: *"banking-specific obligations apply only from commencement-of-trading"*).

**Counter-argument.** Pre-licence supervisory engagement may want to see validation rehearsal evidence — *not* the validation itself, but the methodology operating against rehearsal models — as a readiness signal. That is also the posture the role brief §1 describes (*"substantively closing the gap before SARB Prudential Authority dialogue is a defensible posture"*).

**Recommendation.** Validation runs on synthetic positions methodology-only — no `ModelValidationApproved` events emitted. But validation *reports* are authored (and stored as Owner Inbox deliverables) so the rehearsal evidence exists when SARB engagement opens. The distinction is: methodology rehearsal produces `ValidationFindingRaised` (against synthetic data, treated as advisory) and validation-report artefacts; it does *not* produce the binding `ModelValidationApproved` event. That is reserved for first-real-position.

### 5.3 Should validation events route through the bus?

**Question.** Per Principle 1 (events are the only source of truth) and Principle 7 (autonomous-by-default), validation outputs should be typed events on the event store. This is also the design in `Team/Nadia.md` §11. Should the bus *enforce* this from day one, or is markdown-deliverable + back-fill-when-substrate-lands acceptable in the build phase?

**Default if no decision.** Bus-routing from day one. The model-registry substrate already exists (`prototype/platform/model-registry/registry.ts`); the typed events `ModelSubmitted`, `ModelTierClassified`, `ModelValidationApproved`, `ModelValidationWithheld`, `ValidationFindingRaised`, `ValidationFindingClosed` are already in `event-types.ts`. The substrate exists; not using it is the deviation.

**Recommendation.** Adopt bus-routing from day one. Caveat: the events `ValidationMethodologyPublished`, `BacktestBreachDisposed`, `ModelDriftDetected`, `ProductionUseRequested`, `MethodologyChangeRequested` are *not* yet typed. Methodology version publication for the first slice (Tier-1 v0.1) lands as an Owner Inbox deliverable and is back-filled to a typed `ValidationMethodologyPublished` event in the next typed-event slice (Atlas-coordinated; routes alongside `AgentEscalation` Wave-4 #14 — see `Team/Nadia.md` §11).

### 5.4 What is the validated-envelope schema?

**Question.** The `restrict-to-validated-envelope` disposition (`Team/Nadia.md` §9) requires a typed schema describing the validated envelope (asset class, portfolio scope, scenario range). Today the schema is named `ProductionUseBoundary` in spec but not in code. Who owns the design — Nadia, Atlas (event-types.ts), or Kai (whose pre-trade gateway must enforce it)?

**Default if no decision.** Co-designed: Nadia specifies the *content* (what envelope dimensions express); Atlas types it (`prototype/platform/event-store/event-types.ts`); Kai's pre-trade gateway consumes it (`Team/Nadia.md` §16 last-but-one bullet — *"pre-trade gateway envelope enforcement"* is item #5 on Atlas's S7-Targeted ordering, immediately after the backtest harness).

**Recommendation.** Defer to slice ordering. The Tier-1 methodology v0.1 includes the envelope dimensions as prose; Atlas types the schema in slice #5; Kai consumes in the same slice. No need to over-specify here; the methodology brief lists the dimensions, the typed schema follows.

### 5.5 What goes into the obligations register?

**Question.** Several citations the methodology will lean on are not yet in `Regulations/_obligations-register.md`. From a quick search:

- `ORG-PR-21` (RAS B7 / SR 11-7 idiom — three-tier classification) is **already there** (in force).
- SR 11-7 *as a publication* is not separately registered — it is referenced via the SR 11-7 idiom row.
- SS 1/23 (BoE PRA, 2023) is not separately registered.
- BCBS *Corporate Governance Principles for Banks* — Principle 6 / Principle 8 — not separately registered.
- Banks Act § 70(2A)(b) — not separately registered (Banks Act § 70 broadly is referenced; the (2A)(b) sub-clause is not).
- IFRS 9 §5.5 — already cited in `ecl-stage-projection-refresh.md`.
- Reg 39 — referenced in role brief; verify in obligations register.

**Default if no decision.** Mira researches the gaps and either registers each citation as an obligations-register row or routes them as "methodology-only" references that bind only at first internal-models capital approval (per `project_rules_bind_at_commencement`).

**Recommendation.** Route to Mira. Methodology drafting proceeds with placeholders for any citation not yet in the register; placeholders are flagged at draft time and resolved before the methodology version is `ValidationMethodologyPublished`. **No invented citations** — this is non-negotiable per the constraints in this brief and per Principle 2.

---

## 6. Substrate gaps surfaced

The methodology library cannot fully land without the following dependencies. Each is named here so the gap is visible (CLAUDE.md operating-model section: *"the gap is a roadmap item, not something to hide"*).

| # | Gap | Owner | Target | Blocks |
|---|---|---|---|---|
| 1 | Model-spec format contract (§3) | Rohan + Nadia | Next session (S7-Targeted #3 sub-slice) | Without it, validation is structurally weak; methodology cannot reference a stable input contract. |
| 2 | Model Risk Policy with codified tier-classification rules (§4) | Helena (with Nadia input) | Pre-first-novel-model | The methodology defers to RAS § B7 examples until the policy lands; novel candidates trigger escalation. |
| 3 | `ValidationMethodologyPublished` event type (§5.3) | Atlas (next typed-event slice) | Alongside `AgentEscalation` Wave-4 #14 | Until typed, methodology versions are Owner Inbox deliverables only — not bus-discoverable. |
| 4 | `ProductionUseBoundary` schema (envelope, §5.4) | Atlas + Nadia + Kai | S7-Targeted slice #5 (pre-trade gateway envelope) | Until typed and gateway-enforced, every approval is necessarily binary. |
| 5 | `BacktestBreachDisposed`, `ModelDriftDetected`, `ProductionUseRequested`, `MethodologyChangeRequested` event types | Atlas | Pre-licence go-live readiness gate | Without these, backtest cycle and methodology-change cycle have no event substrate; markdown-only operation. |
| 6 | Vera continuous-controls integration (`@platform/recon/*` validation-cycle pipeline) | Vera (build) | Wave-4 #11 (post Wave-4 #13 parallel-dispatch-divergence per S7-Targeted ordering) | Until live, missing methodology pages, missing per-model validation reports, and stale revalidation cycles are not auto-detected findings. |
| 7 | Backtest harness (S7-Targeted slice #4) | Rohan + Atlas | Pre-licence | Backtest cycle in Tier-1 methodology references a harness that does not yet exist; methodology authoring proceeds with the harness specified-but-unbuilt; first backtest cycle waits for the harness. |
| 8 | Obligations-register entries for citations the methodology relies on (§5.5) | Mira | Pre-publication of Tier-1 methodology v0.1 | Methodology drafting can proceed with placeholders; publication blocks until placeholders resolve to register rows. |
| 9 | Procedure pair: `Procedures/by-policy/model-validation.md` (cycle) + `Procedures/validation/_methodology-tier-N.md` (substance) | Helena (cycle owner per `Procedures/_index.md`) + Nadia (methodology owner) | Tier-1 first; Tier-2 / Tier-3 follow | The cycle procedure says "run the validation per the tier methodology"; without it the methodology has no enclosing cycle. Pair must land together at minimum-viable depth. |

Gaps 1–4 are critical-path for the first Tier-1 methodology page to be substantively complete. Gaps 5–9 are pre-licence; the methodology page can land with them as flagged pending-resolution.

---

## 7. Recommendation for sequencing

If Marc adopts a sequence, Nadia ships the following, in this order:

### 7.1 Slice A — Tier definitions cited and locked (this brief — done on commit)

This brief itself locks RAS § B7 as the binding tier definition for Tier-1 / Tier-2 / Tier-3 in the build phase, with the codified Model Risk Policy as the deferred-but-named successor. No further Marc-decision required to proceed; the substantive default is Tier-1 first.

### 7.2 Slice B — Model-spec format contract with Rohan (next session)

Nadia + Rohan co-author a one-page contract specifying the seven dimensions (§3.2) the methodology document hashed into `ModelSubmitted.methodologyHash` must contain. Authored as a typed Markdown file (`prototype/platform/risk/model-specs/_template.md`), with frontmatter contract that Vera's recon can assert. Sub-slice of S7-Targeted #3.

### 7.3 Slice C — Tier-1 methodology v0.1

The first substantive methodology page. `Procedures/validation/_methodology-tier-1.md`. Covers the seven dimensions (§1) for Tier-1 — capital RWA, IFRS 9 ECL, AML monitoring core. Citation chain to RAS § B7, SR 11-7 §V (validation), SR 11-7 §VI (documentation), SS 1/23 Principles 4 + 5, BCBS CG-Principles 6 + 8, Banks Act § 70(2A)(b) (with Mira-routed citation registration if not yet in the obligations register), Reg 39 (for IRB / IMM / IMA capital usage).

The methodology page is a *specification*, not a tutorial. It is consumed by Nadia (at every Tier-1 validation), Vera (recon), Helena (BRC challenge), Rohan (input requirement). It is not a textbook on model validation.

### 7.4 Slice D — Procedure-pair completion

`Procedures/by-policy/model-validation.md` (the cycle, owner Helena per `Procedures/_index.md`). Stub-then-populate; cross-references the Tier-1 methodology. This closes the procedure / methodology pair so the chain Reg → Policy → Procedure → Capability is complete from RAS § B7 through to the model-registry substrate at `prototype/platform/model-registry/registry.ts`.

### 7.5 Slice E — Tier-2 methodology v0.1

Second tier. Pricing engines, risk sensitivities, behavioural-deposit models. Same shape as Tier-1, calibrated rigour appropriate to the tier (biennial revalidation; no requirement for full re-implementation in every case; sensitivity analysis is the load-bearing test).

### 7.6 Slice F — Tier-3 methodology v0.1

Third tier. Operational analytics, segmentation, non-decisioning. Minimum-viable depth — internal review and sample-audit procedure; revalidation only on material change.

### 7.7 Slice G — Backtest harness contract (S7-Targeted #4)

Hands off to S7-Targeted item #4 (backtest harness). Nadia provides the contract: what backtest tests are required per tier (Kupiec POF for VaR Tier-1; Christoffersen independence for VaR Tier-1; staging-stability for IFRS 9 Tier-1; sensitivity-perturbation for Tier-2 pricing engines); Rohan + Atlas build the harness substrate. Backtest-cycle methodology page references both.

### 7.8 Sequence summary

**Slices A–D land the Tier-1 critical path and the procedure-pair structure.** Slices E–F broaden coverage to Tier-2 / Tier-3. Slice G hands off to S7-Targeted #4. Total scope of the validation-methodology library v0 is Slices A–F; the backtest-harness work in slice G is item #4 on Atlas's ordering and is sequenced separately from this brief's scope.

This sequencing maps to S7-Targeted item #3 (validation-methodology authoring) → item #4 (backtest harness) → item #5 (pre-trade gateway envelope), as Atlas recommends.

---

## 8. Dependencies on other personas

| Dependency | Persona | What I need from them, and by when |
|---|---|---|
| Confirmation of model-spec contract (§3) | Rohan | One-session co-author pass on the seven dimensions and the frontmatter shape. Sub-slice of S7-Targeted #3. |
| Tier-classification policy (§4) | Helena | Acknowledgement that the methodology defers to RAS § B7 in the build phase; that the Model Risk Policy with codified rules is staffed for "pre-first-novel-model" cadence. |
| `ValidationMethodologyPublished` event type (§5.3) | Atlas | Type the event in the next typed-event slice. |
| `ProductionUseBoundary` schema for envelope (§5.4) | Atlas + Kai | Co-design at S7-Targeted slice #5; methodology v0.1 lists the dimensions as prose. |
| Obligations-register entries for SR 11-7 / SS 1/23 / BCBS CG-Principles / Banks Act § 70(2A)(b) (§5.5) | Mira | Research and register before Tier-1 methodology v0.1 publication; placeholders accepted at draft time. |
| Continuous-controls assurance pipeline integration (§6 #6) | Vera | Wave-4 #11 (validation-cycle recon) sequenced after Wave-4 #13 per S7-Targeted ordering. |
| Procedure-pair completion (§7.4) | Helena | Author or stub `Procedures/by-policy/model-validation.md` (the cycle); methodology library is co-author, owner is Helena per `Procedures/_index.md`. |
| Decision routing on §5 questions | Scrooge | Surface this brief in the dashboard's Owner Inbox feed (default behaviour per `Owner Inbox/_frontmatter-convention.md`); §5 questions are *for-input-from* Rohan / Helena, not CEO-decision-required. |

---

## 9. What this brief does not do

- **Does not author Tier-1 methodology content.** That is Slice C; this brief scopes it.
- **Does not invent citations.** Every standard / regulation referenced is already in `Regulations/_obligations-register.md` or grounded in real published material (SR 11-7, SS 1/23, BCBS Corporate Governance Principles for Banks 2015 rev. 2024, Banks Act § 70). Where the citation is not yet a typed register row, Mira is named as owner and the gap is in §6.
- **Does not propose new event types.** The event types in `Team/Nadia.md` §11 are already declared planned; the typed-event slice that lands them is Atlas's, not this brief's.
- **Does not decide the §5 open questions.** Defaults are stated; the brief recommends but does not bind.

---

## 10. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Nadia (via Scrooge) | Scoping brief authored. Names siting, model-spec contract, Helena tier-policy dependency, five open questions for Marc, eight substrate gaps, and a six-slice sequence (A–F) inside this brief's scope plus hand-off slice G to S7-Targeted item #4. |

—Nadia
