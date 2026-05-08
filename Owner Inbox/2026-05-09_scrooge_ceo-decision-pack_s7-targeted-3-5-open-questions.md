---
title: CEO decision pack — S7-Targeted #3 / #4 / #5 open questions
author: Scrooge
date: 2026-05-09
summary: One-pass adjudication of the fifteen open questions that gate the next three S7-Targeted critical-path items — Nadia validation-methodology v0 (#3), Rohan backtest harness v0 (#4), Saskia + Kai pre-trade gateway envelope v0 (#5). Each sub-decision carries the author's recommendation, the default-if-no-decision, and any cross-brief interaction. Resolving all three unblocks slice 1 of every item; selective resolution unblocks the corresponding subset.
decision-required: true
decision-id: D-S7-TARGETED-3-5-OPEN-QUESTIONS
decision-category: near-term
decision-owner: Scrooge (orchestration) · Nadia / Rohan / Saskia + Kai (substantive owners) · Helena (CRO governance line for #3 and #4) · Devon (COO governance line for #5)
decision-for-ceo: Adjudicate the three sub-decisions (one per S7-Targeted item). For each, either approve the author's recommendation as drafted, override on a specific question, or send back a question for re-scoping. Sub-decisions can be resolved together or independently.
decision-recommendation: Approve all three author recommendation sets as drafted. Each recommendation is internally consistent; the cross-brief interactions resolve cleanly under the "Tier-1 first; v0 is shape, not depth" framing all three authors converge on; substrate gaps are surfaced (not hidden) and tracked as roadmap items.
---

# CEO decision pack — S7-Targeted #3 / #4 / #5 open questions

**Author:** Scrooge (Chief of Staff)
**Source briefs:**
- `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` (#3)
- `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md` (#4)
- `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md` (#5)
- Atlas's S7-Targeted ordering — `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2

**Authority:** D-AGENT-RUNTIME-AUTHORIZE (substrate authorised); D-FLEET-ROLLOUT-SEQUENCING (handler order); CEO approval of the S7-Targeted budget envelope.

**For:** Marc (CEO).

---

## How this pack is structured

Three sub-decisions, one per S7-Targeted item. Each sub-decision carries five questions; for each question the pack shows the author's recommendation in one line, the default-if-no-decision in one line, and (where it exists) the cross-brief interaction. **Read top-down; resolve in one pass; the dashboard `/api/decide` writes the resolution back per the standard pattern.**

> The three briefs are self-consistent and cross-consistent — the only "if you say no to X, you must also re-open Y" interactions are flagged inline. If you approve all three recommendation sets as drafted, the three slices begin in parallel under the Targeted budget without re-scoping.

---

## Sub-decision A — Nadia validation-methodology v0 (S7-Targeted #3)

Five questions, drawn verbatim from Nadia §5.

| # | Question | Nadia's recommendation | Default if no decision |
|---|---|---|---|
| A.1 | Which tier methodology cuts first? | **Tier-1 first.** Tier-2 in immediately following session; Tier-3 hygiene-only at minimum-viable depth. | Tier-1 (regulatory-capital + IFRS 9 ECL + AML core) — licence-day binding tier. |
| A.2 | What counts as "production" in the build phase? | **Methodology-only on synthetic positions.** Validation reports authored as Owner Inbox artefacts; no `ModelValidationApproved` events emitted until first real-position consumption. | Build-phase rehearsals are methodology-only; first binding validation event lands at commencement-of-trading. |
| A.3 | Should validation events route through the bus from day one? | **Yes — bus-routing from day one.** Caveat: `ValidationMethodologyPublished` and four siblings are not yet typed; first methodology-version publication is an Owner Inbox deliverable, back-filled to the typed event in Atlas's next typed-event slice. | Bus-routing for already-typed events; markdown-then-back-fill for the planned five. |
| A.4 | Who owns `ProductionUseBoundary` (validated-envelope) schema? | **Co-designed.** Nadia specifies content (envelope dimensions); Atlas types the schema in S7-Targeted slice #5; Kai's gateway consumes in the same slice. Methodology v0.1 lists the dimensions as prose. | No bespoke ownership — defer to slice ordering as above. |
| A.5 | What goes into Mira's obligations register? | **Route to Mira.** Methodology drafting proceeds with placeholders; placeholders resolve to register rows before Tier-1 v0.1 is `ValidationMethodologyPublished`. **No invented citations** (Principle 2). | Mira researches SR 11-7, SS 1/23, BCBS CG-Principles, Banks Act § 70(2A)(b), Reg 39; registers as needed. |

**Cross-brief interaction.**
- A.1 (Tier-1 first) is the same answer as Rohan's B.1 (v0 backtest = Tier-1 ECL only). Approving A.1 implies approving B.1.
- A.4 (`ProductionUseBoundary` co-design) is the substrate Saskia + Kai's gateway slice 4 (market-risk envelope check) consumes. Approving A.4 sequences cleanly with C-slice 4.

**Scrooge-side note.** Approving sub-decision A unblocks Nadia's slice-A through slice-D (tier definitions, model-spec contract co-author with Rohan, Tier-1 methodology v0.1, procedure-pair completion). Slices E–F (Tier-2 / Tier-3 methodologies) follow at their own cadence; slice G (backtest-harness contract) is the hand-off into sub-decision B.

---

## Sub-decision B — Rohan backtest harness v0 (S7-Targeted #4)

Five questions, drawn verbatim from Rohan §7.

| # | Question | Rohan's recommendation | Default if no decision |
|---|---|---|---|
| B.1 | Scope-limit v0 to Tier-1 only? | **Yes.** v0 backtests Tier-1 IFRS 9 ECL only. Tier-2 (trading-book VaR) gated on Kai's CDM bindings; Tier-3 has no backtest cadence under RAS § B7. v1 adds the second model class once steady-state. | Tier-1 ECL only — same answer as A.1. |
| B.2 | Triggering — methodology-change, cron, or both? | **Both, but cron-only for v0.** Cron path uses existing `ScheduledTrigger`; methodology-change path needs a `MethodologyChangePublished` event that doesn't exist yet. | Cron-triggered, Tier-1 annual cadence per Nadia methodology v0. |
| B.3 | Failed-backtest handling — auto-suspend or human-in-the-loop? | **Human-in-the-loop via Nadia's typed disposition.** Failed `BacktestRun` (severity = red) → input to Nadia's `BacktestBreachDisposed`. *Amber* also auto-emits `ValidationFindingRaised` (severity `medium`); *red* emits both finding (`blocking`) and waits for disposition. Auto-suspend on red would violate the model-builder / validator separation. | Red and amber both raise findings; only Nadia's disposition propagates to model-registry production-eligibility. |
| B.4 | Replay shape — per-prediction-point vs single-snapshot evolve? | **Per-prediction-point.** Methodologically correct (no future-information leakage). Performance cost is real but tractable on today's small event log; benchmarking gap noted as substrate gap §8.4. | Per-prediction-point replay with as-of `t` for each prediction. |
| B.5 | On red, emit `RiskRaised` to Helena and `AuditFinding` to Vera, or only one? | **Both, only on red.** Red is both a control failure (Vera's domain) and a crystallised model risk (Helena's domain). Two-channel discipline preserved. Amber emits `ValidationFindingRaised` only. | Red → both events; amber → finding only. |

**Cross-brief interaction.**
- B.1 ↔ A.1: same answer; one informs the other.
- B.3 (human-in-the-loop disposition by Nadia) depends on Nadia methodology v0 specifying tolerance bands that map `(observed, expected, predictionCount) → severity`. Approving A unblocks the contract B reads from.
- B.5's `RiskRaised` event type may not yet be in `event-types.ts` — flagged as a typed-event slice substrate item alongside `BacktestRequested` / `BacktestRun` / `AgentEscalation`.

**Scrooge-side note.** Approving sub-decision B unblocks Rohan's six slices (wait-for-Nadia → event types → semantic layer → harness handler → scheduled emitter → Vera integration) under the strict-ordering recommendation. Total budget: ~2 sessions if Nadia methodology v0 already exists at slice start, ~3 sessions if co-developed.

---

## Sub-decision C — Saskia + Kai pre-trade gateway envelope v0 (S7-Targeted #5)

Five questions, drawn verbatim from Saskia + Kai §6.

| # | Question | Saskia + Kai's recommendation | Default if no decision |
|---|---|---|---|
| C.1 | Hard reject vs soft warn for borderline checks? | **Hard reject by default; soft-flag is a configurable overlay** with citations in a Helena-owned register. v0 carries the overlay; day-one default for every check is hard-reject; relaxations are explicit register entries. **Saskia adds:** mandatory human-ack within 30 seconds for `unknown-rwa`, surveillance soft-flags, and PEP-review. | Hard reject for sanctions / suitability / identity / entity-routing / market-risk / credit / funding. Soft-flag with mandatory ack for capital-impact `unknown-rwa`, surveillance soft-flags, PEP-review. |
| C.2 | Synchronous (block) vs async (timeout-with-default)? | **Synchronous within budget; on timeout, default = reject** (`Rejected: timeout-{check-name}`). Per-check timeout (default 25ms; identity faster, capital-impact slower). The bank does not approve a trade because a check did not respond. | Synchronous, per-check timeout, reject-on-timeout. |
| C.3 | Asset-class scope for v0? | **JSE listed equities only (M1 alignment).** v1 = bonds + repo (M2); v2 = IRS (M3). Gateway depth tracks CDM-bindings depth. | Equities-only v0; broaden as M-phase product set lands. |
| C.4 | Human-in-the-loop carve-outs? | **Four cases require HITL in v0** — sanctions soft-match (Mira / Zara), surveillance hard-flag (Mira / Zara / Saskia), pre-deal mandate-breach escalation (Helena), override of any hard-reject (CEO via Scrooge per `AgentEscalation`). PEP escalation is a typed agent decision once Mira's PEP review substrate lands. | Four HITL cases as listed. Every HITL step is a typed `AgentEscalation` event. |
| C.5 | Override path discipline — does v0 ship with override capability? | **No.** v0 lands without override capability; hard-reject is hard. Override path is a separate substrate slice with its own controls. Re-submission is a *new* order addressing the rejection reason. | No override path in v0; rejection is terminal; override slice lands as separate substrate work. |

**Cross-brief interaction.**
- C.4 names override-of-any-hard-reject as `AgentEscalation` to CEO via Scrooge — depends on `AgentEscalation` event type landing in Atlas's next typed-event slice (already on the queue).
- The market-risk check (slice 4 in Saskia + Kai's §7 ordering) consumes the `ProductionUseBoundary` schema co-designed under A.4 — sequence holds.
- The credit-limit, market-risk, and RWA-delta engines are themselves models requiring Nadia tier-classification and validation under sub-decision A. Approving A defines the validation contract those engines satisfy.
- All seven slices gate on Vera Wave-4 #13 (parallel-dispatch-divergence recon) landing first per S7-Targeted ordering — already approved and in-flight.

**Scrooge-side note.** Approving sub-decision C unblocks Saskia + Kai's seven slices: event types + permission-policy → identity + sanctions checks → credit check → market-risk check → capital check → funding check → surveillance check → Vera gateway-integrity recon. Each slice is independently shippable and bus-canonical.

---

## Cross-decision summary

The three sub-decisions converge on one posture, expressed three ways:

> **Tier-1 first; v0 lands the shape, not the depth; substrate gaps are surfaced and roadmapped, not hidden.**

If approved as drafted, the three S7-Targeted critical-path items begin in parallel:
- **Nadia (#3)** — slice A (tier definitions locked) is done on commit; slice B (model-spec contract with Rohan) starts immediately; slice C (Tier-1 methodology v0.1) follows.
- **Rohan (#4)** — slice 1 (wait-for-Nadia methodology v0) is the explicit gating step; slices 2–6 follow strictly in order. No code lands until methodology v0 lands.
- **Saskia + Kai (#5)** — slice 1 (six event types + citation-gate coverage + permission-policy entries) starts on Vera Wave-4 #13 landing; slices 2–7 follow.

Total budget under the Targeted profile (≈3 sessions/week, ≤4M tokens/session): the three items together fit inside the ordered gap-closure Atlas authored, and stay inside the Targeted envelope.

---

## What Marc adjudicates

For each sub-decision (A, B, C), one of:

- **Approve as drafted** — the recommendation set stands; the slice begins under the Targeted budget.
- **Override on a specific question** — name the question (e.g. "B.3: prefer auto-suspend on red") and the override; the rest stand.
- **Send back for re-scoping** — name the question that needs re-scoping and the constraint that triggered it; the brief reopens for a follow-up pass.

The dashboard's `/api/decide` writes the resolution back as a CEO-decision-record under `D-S7-TARGETED-3-5-OPEN-QUESTIONS` (with sub-decision granularity preserved in the record body); Scrooge picks up automatically per the inbox-hygiene rule.

---

## Substrate gaps surfaced (informational — not adjudication items)

Each brief carries its own substrate-gap inventory; a consolidated view for completeness:

| Gap | Brief | Owner | Sequence |
|---|---|---|---|
| Model-spec format contract | Nadia §3 / §6 #1 | Rohan + Nadia | Sub-slice of S7-Targeted #3 |
| Model Risk Policy with codified tier-classification | Nadia §4 / §6 #2 | Helena (with Nadia input) | Pre-first-novel-model |
| `ValidationMethodologyPublished` + 4 siblings event types | Nadia §5.3 / §6 #3, Rohan §8.6 | Atlas | Next typed-event slice (alongside `AgentEscalation` Wave-4 #14) |
| `ProductionUseBoundary` schema (validated-envelope) | Nadia §5.4 / §6 #4, Saskia + Kai §4.2 | Atlas + Nadia + Kai | S7-Targeted slice #5 |
| `BacktestRequested` + `BacktestRun` event types | Rohan §4 / §8.1 | Atlas | Next typed-event slice |
| Six gateway event types (`OrderProposed`, `GatewayCheckRequested`, `GatewayCheckCompleted`, `OrderApprovedAtGateway`, `OrderRejectedAtGateway`, `PreTradeLimitChanged`) | Saskia + Kai §5.1 | Kai + Atlas + Senna | Gateway slice 1 |
| Anya semantic-layer entries for `BacktestRun` + gateway events | Rohan §6 / §8.2, Saskia + Kai §5.3 | Anya | Co-authored alongside event types |
| Backtest harness scratch-window benchmarking (as-of replay performance) | Rohan §8.4 | Atlas | Pre-commencement-of-trading |
| Vera continuous-controls integration (validation-cycle recon + gateway-integrity recon) | Nadia §6 #6, Saskia + Kai §5.3 | Vera | Wave-4 #11 (validation), follow-on (gateway) |
| Procedure pair `Procedures/by-policy/model-validation.md` + `Procedures/validation/_methodology-tier-N.md` | Nadia §6 #9 | Helena (cycle) + Nadia (methodology) | Tier-1 first |
| Eight planned procedures for the gateway (pre-trade-conduct-gate, pre-trade-gateway-governance, dealer-mandate-issuance, etc.) | Saskia + Kai §8 | Owen + named co-owners | Tracks gateway slice cadence |

None of these gaps require CEO adjudication today — they are roadmap items the relevant agents track and surface in their next runs.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Scrooge | Decision pack authored from the three S7-Targeted #3 / #4 / #5 scoping briefs. Surfaces fifteen open questions across three sub-decisions; each sub-decision carries the author's recommendation and the cross-brief interactions; recommends approval of all three sets as drafted. |

—Scrooge
