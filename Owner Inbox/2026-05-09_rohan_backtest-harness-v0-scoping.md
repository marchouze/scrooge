---
title: Backtest harness v0 — scoping brief
author: Rohan
date: 2026-05-09
summary: Architecture, sequence dependencies, and open questions for the typed backtest engine that replays a model over the event log and emits a BacktestRun event. Item #4 on Atlas's CEO-approved S7-Targeted critical path; this brief scopes — does not implement.
decision-required: false
for-input-from: Nadia, Atlas, Anya
---

# Backtest harness v0 — scoping brief

**Author:** Rohan (risk engineer; reports to Helena (CRO))
**Date:** 2026-05-09
**Status:** Scoping. No code lands on this brief alone.
**Position in plan:** Item #4 on Atlas's S7-Targeted critical path (`Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2). Sits *after* Vera Wave-4 #13 (parallel-dispatch-divergence recon), A2.2 Phase 1 cutover code, and Nadia's validation-methodology v0 — sequencing matters and is the brief's load-bearing point.
**Operating-spec authority:** `Team/Rohan.md` §11 (events), §12 (capabilities), §16 (substrate gaps). Co-curatorship with `Team/Nadia.md` §11–§12.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it specifies how the backtest engine consumes data (Principle 1 event log) and produces a typed result that policy and presentation layers (BRC pack, Audit Committee findings, regulator-facing model-risk evidence) will derive from. No new principle-level substance.

---

## 1. What the harness is

A typed engine that, given a registered model and a historical window of the event log, **replays the model's prediction-as-of every relevant point in the window** and compares prediction against realised outcome.

Operating contract:

- **Input.** A `BacktestRequested` event carrying: `modelId` (must resolve in the model registry — `prototype/platform/model-registry/registry.ts`), `windowStart` / `windowEnd` (ISO 8601), `predictionGranularity` (e.g. `daily`, `monthly`, `per-event`), `outcomeMetric` (e.g. `realised-loss`, `realised-staging`, `pnl-vs-var`), and the citation chain that justifies the run (under Principle 2 — typically: SR 11-7 § V *Outcomes Analysis*; SS 1/23 Principle 4; RAS § B7; the methodology version under test).
- **Process.** For each prediction-point `t` in the window, the harness reconstructs the model's input state by replaying the event log to `as-of t` (Principle 1 — "as-of replay is a first-class capability"), runs the model deterministically against that state, captures the prediction, then folds the realised outcome from the event log over the prediction horizon. The harness does not store intermediate state — every comparison is a query against the log at two distinct as-of timestamps.
- **Output.** A single `BacktestRun` event carrying: `modelId`, `version`, `windowStart`, `windowEnd`, `comparisonMetric` (Kupiec / Christoffersen / traffic-light for VaR; staging-stability / migration-matrix for ECL; coverage tests for ES), `expectedExceptions`, `observedExceptions`, `severity` (per the comparison metric's tolerance band), `methodologyHash` (so re-running on a methodology change produces a new event, not an update), and the input-citation chain unchanged.
- **Audit-trail invariant.** A backtest is reproducible from `(modelId, version, windowStart, windowEnd)` alone — the event log contents at that as-of are deterministic, and the harness is a pure function over them.

**What the harness is not.** It is not a model-output cache; it is not a parallel record-keeping system. Per Principle 1, the backtest comparison is a query over the event log, computed each time. Cached projections of `BacktestRun` payloads are presentation-layer; the canonical answer is always the replay.

## 2. Architecture sketch

The harness fits into Atlas's bus-canonical model. D-A22-RETIRE-LEGACY Phase 1 has just landed (legacy-shadow flag live; `Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md`); Phase 2 — the path the harness assumes — is gated on Vera Wave-4 #13 (`parallel-dispatch-divergence` recon).

```
BacktestRequested  ──►  bus.dispatch  ──►  rohan:backtest-harness handler
                                                │
                                                ├── eventStore.replay({ as-of: t })  ── (per prediction-point)
                                                ├── modelRegistry.resolve(modelId, version)
                                                ├── compute prediction(t) deterministically
                                                ├── eventStore.replay({ as-of: t + horizon })  ── outcome
                                                ├── fold(comparisonMetric)
                                                │
                                                ▼
                                           emit BacktestRun
                                                │
                                                ├── Vera continuous-controls  ──►  AuditFinding (failed-backtest)
                                                ├── Nadia validation-cycle    ──►  BacktestBreachDisposed
                                                └── Anya semantic layer       ──►  dashboard surfacing
```

Substrate touchpoints:

- **Event store reads.** `eventStore.replay({ type, ..., asOf })` — already canonical; cited at `prototype/platform/event-store/` (the same path Rohan's existing risk-run handler uses, see `prototype/runtime/agents/rohan-risk-run.ts:106-108`).
- **Bus dispatch.** `BacktestRequested` is an event the harness subscribes to; bus dispatch follows the `BusDispatched` discipline already in production (`prototype/platform/event-store/event-types.ts:875–946`). Idempotency key `(eventId, handlerKey)` — re-firing the same `BacktestRequested` is a no-op.
- **Cron-triggerability.** Nadia's tier-cycle backtest cadence (Tier-1 annual, Tier-2 18-month — `Team/Nadia.md` §6) requires the harness to fire on a `ScheduledTrigger` (`event-types.ts:608-669`). Implementation: a thin scheduled handler reads the model registry, finds models due for backtest under their tier-cadence, and emits the `BacktestRequested` event the harness subscribes to. The scheduled handler is Nadia's; the harness is the substrate she calls.
- **Vera integration.** A failed `BacktestRun` (severity ≥ tier tolerance) is an input to Vera's continuous-controls layer; Vera emits an `AuditFinding` and Nadia emits a `BacktestBreachDisposed` (`Team/Nadia.md` §11). The harness itself stays narrow — it produces the typed result; the disposition is Nadia's authority surface (`Team/Nadia.md` §9 row "Backtest-tolerance breach disposition").
- **Permission policy.** `rohan:backtest-harness` registers under A1.1; its permission policy (A1.2) lists `BacktestRequested` on subscribe-allow-list and `BacktestRun` on emit-allow-list; capability tokens `@platform/event-store`, `@platform/model-registry`, `@platform/citation/gate.ts`. Today the gate is feature-flagged off (per `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §6.2); that is acceptable for v0 — the policy is published advisory, the gate flips when the fleet is fully assembled.

The harness is **a pure consumer of the substrate** — it reads, computes, emits one event. No projections it owns; no register it maintains beyond what the model registry and the `BacktestRun` stream already provide.

## 3. Which models first

The build phase has zero real positions, zero real customers, and zero real loss data. Backtesting requires **realised outcomes**; no outcomes exist for capital RWA (no portfolio) or AML monitoring (no customers). The model classes have very different "as-of replay against synthetic outcomes" profiles:

| Model class | Replay-able today? | Outcome data | Recommended ordering |
|---|---|---|---|
| IFRS 9 ECL — staging stability, migration-matrix backtest | Yes — synthetic counterparty events drive staging transitions deterministically | Synthetic `IFRSClassificationAssigned` events (Bea owns the schema) provide outcomes; no real losses needed for staging-stability metric | **First** |
| Trading-book VaR — Kupiec / traffic-light against synthetic P&L | Partially — gates on Kai's M1 CDM bindings (in flight under D-MARKETS-SCHEMA-FOUNDATION); first VaR fires when first CDM contract is booked | Synthetic P&L from synthetic positions; observation count is small until commencement of trading | Second |
| Capital RWA — RWA-attribution stability under regime change | Replay-able structurally; no real RWA today | No realised RWA changes — synthetic only | Third |
| AML transaction monitoring | Not yet — no customers, no transactions | No outcome data; backtest is methodology-rehearsal at best | **Defer** until commencement of trading |
| Behavioural-deposit / IRRBB models (Eitan / Ravi) | Not yet — no deposit-base events | No outcomes | Defer |

**Recommendation.** ECL backtest first. It is the purest replay-able model class: staging is a deterministic function of counterparty events the bank can synthetically generate at any tier, the comparison metric (staging-stability, migration-matrix) does not require realised losses, and the methodology surface is shared with Bea (`Team/Rohan.md` §15 — IFRS 9 ECL co-ownership boundary). It also exercises every substrate seam the harness needs: event-store replay; model-registry resolve; deterministic compute; typed-event emit; semantic-layer surfacing; Vera consumption.

Capital RWA second — it tests the harness against a richer outcome metric (RWA attribution under regime change) and confirms the harness scales across model classes.

VaR third, gated on Kai's CDM bindings.

AML and IRRBB deferred to commencement-of-trading.

## 4. What does Atlas owe me

Two new typed event types in `prototype/platform/event-store/event-types.ts` (and registered in `registry.ts`), plus their factories on the same Zod-schema discipline as the existing `ModelSubmitted` / `ModelValidationApproved` family (`event-types.ts:947–1156`).

### 4.1 `BacktestRequested`

```yaml
modelId:               string  # must resolve in model registry
version:               string  # must match a registered version for modelId
windowStart:           ISO8601
windowEnd:             ISO8601
predictionGranularity: enum(daily, monthly, per-event)
outcomeMetric:         enum(kupiec, christoffersen, traffic-light, staging-stability, migration-matrix, coverage-test, custom)
requestedBy:           string  # agent:rohan, agent:nadia, scheduler — strong identity
methodologyHash:       sha256-hex  # locks the methodology version under test
```

Citations the type **must** carry on every emit (Principle 2):
- `SR-11-7-2011` — model-risk-management framework (US Federal Reserve / OCC)
- `SS-1-23-2023` — PRA Model Risk Management Principles (esp. Principle 4 *Validation*)
- `BANKS-ACT-94-1990` — § 70(2A)(b) risk-management process
- The model's own methodology citation chain (resolved via `methodologyHash`)

### 4.2 `BacktestRun`

```yaml
backtestRunId:        string  # convention: backtest:<modelId>:<short-slug>
modelId:              string
version:              string
windowStart:          ISO8601
windowEnd:            ISO8601
comparisonMetric:     same enum as BacktestRequested.outcomeMetric
expectedExceptions:   number  # under-the-null per metric
observedExceptions:   number
severity:             enum(within-tolerance, amber, red)  # per metric's traffic-light bands
methodologyHash:      sha256-hex
predictionCount:      number  # observation count for power
runDurationMs:        number  # observability
sourceRequestEventId: string  # event_id of the BacktestRequested that produced this
```

Citations on emit: same chain as `BacktestRequested` plus the comparison-metric-specific reference (e.g. `KUPIEC-1995`, `CHRISTOFFERSEN-1998`, `BCBS-VAR-BACKTEST-1996` for the Basel traffic-light).

Both types fold latest-wins-per-key on the model's stream for "most recent backtest" queries; the full history stays append-only in the log (Principle 1). The schemas are co-evolved with Nadia's validation-event family (`Team/Nadia.md` §11, §16) — the `BacktestRun` is exactly the input to Nadia's `BacktestBreachDisposed`, so the field names must align.

**Sequence dependency:** the type schemas land in Atlas's next typed-event slice, alongside `AgentEscalation` Wave-4 #14 and the Nadia validation-event family that is already partly landed. The harness handler does **not** start until the schemas are merged.

## 5. What does Nadia owe me

The validation-methodology v0 (item #3 on the S7-Targeted critical path; `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2 row 3). The methodology specifies, per tier:

- The **comparison metric** for each model class. The harness's `outcomeMetric` enum must enumerate exactly the metrics Tier-1 / Tier-2 methodologies prescribe — no more, no less. If methodology v0 says "ECL backtest uses migration-matrix stability with χ² test," then the harness's `outcomeMetric` includes that metric *and* its traffic-light tolerance bands.
- The **tolerance bands** that map `(expectedExceptions, observedExceptions, predictionCount)` to `severity ∈ {within-tolerance, amber, red}`. These bands are methodology decisions, not engineering decisions; they bind every consumer of `BacktestRun`.
- The **revalidation cadence** that the scheduled-trigger backtest handler runs against (Tier-1 annual, Tier-2 18-month — `Team/Nadia.md` §6 names the cadence in prose; methodology v0 makes it a typed table).
- The **input-schema contract** the harness's output must satisfy: every field Nadia's `BacktestBreachDisposed` reads from `BacktestRun` is named in methodology v0, so the harness's output schema is shaped by Nadia's input schema, not by Rohan's preference.

**Sequence dependency.** Without methodology v0, the harness's output schema is shaped to a guess. The S7-Targeted ordering puts Nadia at #3 and the harness at #4 for exactly this reason — the methodology contract precedes the engine that produces against it. If methodology v0 slips, the harness slips equally.

This is also the clean independence boundary (`Team/Nadia.md` §15, §2): the methodology is Nadia's; the engine that runs against the methodology is Rohan's; the validation disposition that consumes the engine's output is Nadia's again. Three distinct events; one co-evolved schema; no shared state.

## 6. What does Anya owe me

Semantic-layer entries for every named quantity the harness emits (Principle 6 — single-graph; CLAUDE.md):

- `BacktestRun.comparisonMetric` — definition by metric (Kupiec, Christoffersen, traffic-light, migration-matrix, etc.); each entry cites the methodology-paper canonical reference and the policy that adopts it for the bank's model-risk framework.
- `BacktestRun.expectedExceptions` — definition under-the-null hypothesis for each metric (Kupiec: `predictionCount × confidenceLevel`; etc.).
- `BacktestRun.observedExceptions` — definition: count of prediction-points where the realised outcome falls outside the model's prediction's tolerance band.
- `BacktestRun.severity` — definition of `within-tolerance | amber | red` per metric, citing the tolerance-band table from Nadia's methodology v0.
- `BacktestRun.predictionCount` — observation count; load-bearing for power calculations on Kupiec / Christoffersen.

Without these entries, the dashboard surfacing of `BacktestRun` is undefined — Vera's recon for "every named quantity in an emitted event resolves to the semantic layer" (Principle 6) flags `BacktestRun` as orphaned. Anya's slice is small but real: ~5–7 semantic-layer entries co-authored from Nadia's methodology v0 prose.

## 7. Open questions for Marc

I want to keep this list short. Five questions, all binding on the harness's shape; nothing cosmetic.

### Q1 — Scope-limit v0 to Tier-1 only?

**Recommendation: yes.** v0 should backtest only the Tier-1 ECL model. Tier-2 trading-book VaR is gated on Kai's CDM bindings; Tier-3 doesn't carry a backtest cadence under RAS § B7. Adding Tier-2 / Tier-3 to v0 doubles the schema surface and the methodology surface for no marginal gain — methodology v0 covers Tier-1 only by Nadia's design. v1 of the harness adds the second model class once the first is producing in steady state.

### Q2 — `BacktestRequested` fires on every methodology change, on a cron, or both?

**Recommendation: both, but cron-only for v0.** Methodology-change-triggered backtests require an event the methodology layer doesn't emit yet (`MethodologyChangePublished` or similar). Cron-triggered backtests use the existing `ScheduledTrigger` substrate. The cron path is the steady-state path that satisfies Tier-1 annual revalidation — it's where most volume sits and what Nadia's methodology v0 prescribes. The methodology-change-triggered path is small additional substrate that lands when a methodology actually changes; it doesn't gate v0.

### Q3 — What happens when a model fails its backtest? Auto-suspend, or human-in-the-loop?

**Recommendation: human-in-the-loop, via Nadia's typed disposition event.** A failed `BacktestRun` (severity = red) becomes an input to Nadia's `BacktestBreachDisposed` event (`Team/Nadia.md` §9, §11). Nadia's disposition is one of `tolerate` / `remediate-by-deadline` / `withdraw-validation`. The withdraw-validation disposition then propagates to the model registry (the model's production-eligibility flips to false) — that propagation is automatic; Nadia's authoring of the disposition is the human-in-the-loop step. Auto-suspend on red would be a Rohan→production-state edit, which violates the model-builder / validator separation in `Team/Nadia.md` §15. Nadia is the authority surface, not the harness.

The narrow exception worth Marc's adjudication: should *amber* (single observation just outside tolerance) auto-emit a `ValidationFindingRaised` so the finding shows up in the queue, or only red? My preference is yes — amber raises a finding (severity `medium`); red raises a finding (severity `blocking`) and waits for `BacktestBreachDisposed`. The harness's authority surface is "raise the finding"; the disposition stays Nadia's.

### Q4 — Per-prediction-point as-of replay, or a single "snapshot at windowStart, evolve forward" replay?

**Recommendation: per-prediction-point.** Per-prediction-point replay is the methodologically correct shape — the model at prediction-point `t` only sees information available at `t`, no leakage. A single "snapshot at windowStart" replay leaks future information into earlier predictions. The performance cost is real: a 1-year daily backtest with a 1-year horizon is ~365 replays of an event log that grows over the window. Today's event log is small (~few thousand events); at v0 this is tractable. At licence-day (~weeks of customer events) the harness needs scratch-window benchmarking — that is a substrate gap (§8.4) that I want to call out now, not discover later.

### Q5 — Do failed backtests auto-emit `RiskRaised` to Helena's risk-cycle, or only `AuditFinding` to Vera's pipeline?

**Recommendation: both, but only on red.** A red `BacktestRun` is *both* a procedural finding (Vera's domain — controls failed) and a risk (Helena's domain — model risk crystallised). Emitting both on red preserves the two-channel discipline. Amber emits only the `ValidationFindingRaised` per Q3. The two emits are not duplicates — they target different consumers and different cycles.

## 8. Substrate gaps surfaced

Not hidden. Listed for Atlas, Anya, and Senna+Rashida to catalogue under their respective substrate-state runs.

### 8.1 Missing event types

`BacktestRequested` and `BacktestRun` are not yet in `prototype/platform/event-store/event-types.ts` or `registry.ts`. Owner: Atlas. Sequence: lands in the next typed-event slice. Without these, the harness has no contract.

### 8.2 Missing semantic-layer entries

The five-to-seven entries in §6 are not yet in Anya's semantic layer. Owner: Anya. Sequence: co-authored from Nadia's methodology v0 prose; lands in the same Targeted-cadence session as the harness handler.

### 8.3 No historical-replay test fixture

The harness's correctness depends on `eventStore.replay({ asOf: t })` being deterministic for any `t` in the past. Today this is asserted by integration tests on small event sets; there is no fixture of "1 year of synthetic ECL-relevant events" against which a backtest run can be regression-tested. Owner: Rohan + Atlas. Sequence: builds alongside the harness handler — without it, no green CI on the backtest path.

### 8.4 No scratch-window for as-of-replay performance benchmarking

Per Q4, the per-prediction-point replay cost grows linearly with window length and event-log density. There is no benchmarking harness today that exercises this at licence-day-realistic densities; performance cliffs would surface in production. Owner: Atlas (substrate observability). Sequence: not v0-blocking; lands before commencement-of-trading. Catalogue as a substrate gap now to avoid late discovery.

### 8.5 Model-registry production-eligibility wiring

The model registry already supports approve / withhold (`event-types.ts:1077–1156`). Q3's "auto-flip production-eligibility on `BacktestBreachDisposed: withdraw-validation`" requires the registry's `productionEligible()` query to consume `BacktestBreachDisposed` events as a withdrawal trigger. Today the registry consumes `ModelValidationApproved` / `ModelValidationWithheld` only. Owner: Rohan + Nadia. Sequence: lands alongside the harness and methodology v0, not before.

### 8.6 No `MethodologyChangePublished` event for methodology-change-triggered backtests

Per Q2, the cron-triggered path is sufficient for v0; the methodology-change-triggered path is deferred until a `MethodologyChangePublished` event exists in the schema. Owner: Atlas (schema) + Nadia (methodology authority surface). Sequence: not v0-blocking.

## 9. Recommendation for sequencing

Strict ordering. Each step gates the next; no parallel work cuts.

1. **Wait for Nadia methodology v0.** Item #3 on S7-Targeted. The harness's output schema is shaped by methodology v0's input schema; without it, the harness is shaped to a guess.
2. **Land event types via Atlas.** `BacktestRequested` + `BacktestRun` in `event-types.ts` and `registry.ts`, on the same Zod / factory discipline as the existing typed-event family. One slice; small.
3. **Co-author semantic-layer entries with Anya.** Five-to-seven entries derived from methodology v0's prose. Lands inside the same session as #2.
4. **Build harness handler against ECL only.** `rohan:backtest-harness` registered under A1.1; subscribes to `BacktestRequested`; emits `BacktestRun`. Includes the synthetic-ECL test fixture (§8.3). Tier-2 / Tier-3 deferred per Q1.
5. **Wire scheduled-trigger backtest emitter (Nadia-side).** A thin handler that walks the model registry on its tier-cadence and emits `BacktestRequested`. Owner: Nadia (authority); Atlas (substrate).
6. **Vera integration last.** Vera's continuous-controls pipeline consumes `BacktestRun` events; failed backtests emit `AuditFinding`. The pipeline lands once the harness has produced enough runs to assert against — not before.

Item 1 must complete before item 2. Item 2 before item 3. Items 4–6 sequence in that order; no item can land before its predecessor without producing schema drift.

Total slice count: six. Total token budget under S7-Targeted: ~2 sessions if methodology v0 already exists at slice start; ~3 sessions if v0 is co-developed.

The only honest framing: this brief is the small front-loaded artefact; methodology v0 is the load-bearing one. Without it, the harness is unscoped.

—Rohan
