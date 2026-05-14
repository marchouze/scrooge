---
agent: Vera (Internal audit engineer, third-line)
trigger: codebase-quality-review
asOf: 2026-05-10T00:00:00.000Z
decision-required: false
---

# Vera — codebase quality review, 2026-05-10

Read-only audit pass over `prototype/` requested by the CEO (Marc). Method: structural smell-grep across the whole tree, then targeted reads of the longest / highest-density files. No source changes; this deliverable is findings only.

Independence note: I report functionally to Thandiwe (Chief Audit Executive, governance) and administratively through the CEO. Findings are pitched at the principle they violate, not at the persona who wrote the code.

## 1. Summary

| Category | P0 | P1 | P2 | P3 |
|---|---:|---:|---:|---:|
| Architectural principle violations | 0 | 3 | 2 | 1 |
| Type safety | 0 | 1 | 2 | 1 |
| Test quality | 0 | 1 | 2 | 0 |
| Error handling | 0 | 2 | 1 | 0 |
| Dead code / unused | 0 | 0 | 1 | 1 |
| Comments and documentation | 0 | 0 | 2 | 1 |
| Naming and consistency | 0 | 0 | 1 | 1 |
| Coupling and god files | 0 | 2 | 1 | 0 |
| Performance hotspots | 0 | 1 | 1 | 0 |
| Security smells | 0 | 1 | 1 | 0 |
| Recon and gate coverage | 0 | 3 | 1 | 0 |
| **Totals** | **0** | **14** | **15** | **5** |

**Bottom line:** healthy codebase for its stage. No P0 violations. The dominant issue class is *deferred-substrate sprawl* — known gaps annotated in code (Date.now/new Date callsites; placeholder reconciliation harness; Phase-0 dual-write windows) that are honestly disclosed but accumulating. Most type-safety smells (`any`, `as any`) are zero or test-only. Permission gate is well-designed; the legacy bypass list is bounded (215 entries) and the 2026-05-10 closure assertion is in place. The single most concerning structural finding is **F-018**: four circular import dependencies detected by `madge` — small in count but they include the event-trigger bus, scheduler, and a runtime ↔ scrooge agent cycle, all hot-path infrastructure.

## 2. Findings

### Architectural principle violations

#### F-001 — (P1) (P1: events-as-truth) — `prototype/runtime/run.ts:850`

`alertId: \`alert:integrity:bus-tick-${Date.now()}\`` — wall-clock-derived event identifier emitted into the event store, with no ScenarioClock injection.

> ```ts
> alertId: `alert:integrity:bus-tick-${Date.now()}`,
> ```

The store's append-time `as_of` rule requires deterministic clocks (`Principles/1-events-are-truth.md`). Embedding `Date.now()` inside an `alertId` makes the same logical alert irreproducible across replays. Also makes scenarios-driven runs and recon-replays produce drift-noise.

**Recommendation:** route through the substrate-resolved `Clock` (per `platform/scenario-clock/`); for an ID, use the existing `newEventId()` or a hash of the deduplication key. Atlas (Core banking platform architect, engineering) owns clock rollout.

#### F-002 — (P1) (P1: events-as-truth) — `prototype/dashboard/agent-runs.ts:167–208`

Wall-clock-keyed in-memory cache of agent run results, never refreshed via the event log:

> ```ts
> const now = Date.now();
> ...
> cache = { fetchedAt: Date.now(), runs };
> ```

The dashboard tile presents an effectively-stored projection cache that does not derive from events. Per `Principles/1-events-are-truth.md` ("balances, positions, P&L, regulatory cells are queries, not stored state") and the project memory entry *cache-in-commit-graph anti-pattern*, this is a Phase-0-acceptable shortcut but should grow a typed projection or a "stale-after-N-seconds against the event-store sequence cursor" guard.

**Recommendation:** key the cache invalidation on `eventStore.count()` (sequence cursor), not `Date.now()`. Owner: Anya (data / analytics engineer).

#### F-003 — (P1) (P1: events-as-truth) — `prototype/platform/scheduler/scheduler.ts` and `runtime/run.ts`

Multiple substrate paths still call `Date.now()` / `new Date()` directly rather than the `ScenarioClock`. Author's own comment at `platform/composition.ts:93` documents the gap ("Existing `nowUtc()` / `Date.now()` callsites are intentionally left in"). Total: **27 `Date.now()` callsites** across `platform/`, `runtime/`, `dashboard/`, `scenarios/`, `scripts/` (per `grep -rn "Date.now"`), of which ~12 are non-comment production paths (rest are test-only or doc).

**Recommendation:** stand up a recon (`recon:wall-clock-callsite-coverage`) that fails when non-clock-aware files outside the per-module rollout list contain `Date.now()` / `new Date()`. Owner: Atlas.

#### F-004 — (P2) (P6: single-graph) — `prototype/platform/recon/harness.ts:1-50`

The "harness" is a self-test, not a reconciliation pipeline; the module's own header says *"M1 placeholder: asserts the event store can round-trip a synthetic event stream"*, and *"Future: GL trial balance ↔ event-derived balance"* — the named pipeline does not exist. File is presented as if it satisfies a recon obligation but does not.

> ```ts
> // Future: GL trial balance ↔ event-derived balance ↔ sub-ledger projection
> // must reconcile to zero on every CI run (Principle 1, Principle 6).
> ```

**Recommendation:** rename to `recon-self-test.ts` to remove the implication of recon coverage; track GL trial-balance recon as a substrate gap on Anya. (Reported in §5.)

#### F-005 — (P2) (P2: citation-discipline) — `prototype/platform/recon/harness.ts:32`

Synthetic events use a single string citation `"RECON-HARNESS"`, not a typed `URN:`-prefixed citation as required by `Principles/2-citation-discipline.md` and the citation-gate. The harness only round-trips through `eventSchema.parse`, which checks `citations.length >= 1` but not citation typing.

**Recommendation:** harness fixtures should use real URN form (`URN:internal:recon-harness:v1`) to model what real consumers must produce, not a placeholder.

#### F-006 — (P3) (P5: multi-currency) — `prototype/runtime/agents/kai-m1-cdm-typescript-bindings.ts:88–93`

Hardcoded `currency: "ZAR"` triple. Acceptable as agent-fixture scaffolding but easy to copy-paste into a real flow.

**Recommendation:** replace with `BANK_BASE_CURRENCY` constant or fixture import; flag in code-review checklist for new agent stubs.

### Type safety

#### F-007 — (P1) (type-safety / boundary parsing) — `prototype/platform/rms-registers/{correspondence,briefs-dispatches,document,agent-runs,decisions,workstreams,feedback}.ts`

All seven RMS register projections decode their snapshot payload with `JSON.parse(payload) as { ... }` — no Zod re-validation:

> ```ts
> const parsed = JSON.parse(payload) as {
>   rows: Array<[string, CorrespondenceRegisterRow]>;
> };
> ```
> (`platform/rms-registers/correspondence.ts:84-87`; same shape across the other six files)

These are internal snapshots so the trust boundary is internal — but per `Principles/4-security-designed-in.md` ("zero-trust") and the project's general Zod discipline at the event layer, the snapshot decode should re-validate. A corrupt or hand-edited snapshot today silently produces a half-valid `Map`.

**Recommendation:** define a Zod schema per register row, run `decodeSnapshot` through it, and fail-closed on parse error. Owner: Owen (Company Secretary, governance) for register specs; Atlas for the parser plumbing.

#### F-008 — (P2) (type-safety) — `prototype/platform/event-store/store.ts:366`

> ```ts
> payload: JSON.parse(row.payload) as Record<string, unknown>,
> ```

`replay()` deliberately returns the payload as `Record<string, unknown>` because the store doesn't know per-type shapes. Consumers re-parse via `validatePayload` / `<type>PayloadSchema`. Acceptable, but a 144-occurrence `Record<string, unknown>` density (per `grep -c`) across `platform/` invites consumers to skip the per-type schema.

**Recommendation:** tighten `replay()` to a discriminated union over registered types when the type filter is set; out-of-scope for this review, log as an Atlas roadmap item.

#### F-009 — (P2) (type-safety) — `prototype/tests/substrate-agent-runner-lifecycle.test.ts:119, 135, 185`

Three `as any` casts in a test that *probes* runtime enforcement of the `trigger.kind`, `substrate`, `errorClass` enums:

> ```ts
> trigger: { kind: "wallclock" as any, id: "x" },
> ...
> substrate: "azure-functions" as any,
> ...
> errorClass: "panic" as any,
> ```

The assertion is "enum is enforced at runtime by Zod even when TypeScript is bypassed". A `@ts-expect-error` would make the intent louder than `as any`.

**Recommendation:** swap `as any` for `// @ts-expect-error — runtime-enforcement probe`, matching the convention used by `tests/counterparty-eligibility.test.ts:94` and `tests/legal-entity-tree.test.ts:110`.

#### F-010 — (P3) (type-safety) — `prototype/dashboard/agent-runs.ts:154`, `dashboard/derive.ts:359, 517`, `dashboard/registry.ts:34`

Several `JSON.parse(...) as <Shape>` casts at trust boundaries (gh CLI stdout, curated seed JSON, dashboard cache file). Same pattern as F-007.

**Recommendation:** add a Zod parse — these are HTTP / shell / disk boundaries; they should fail-closed on bad input.

### Test quality

#### F-011 — (P1) (test-quality / regression-guard) — tests do not cover `LEGACY_PRE_A1_EVENT_TYPES` closure

The Atlas memo at `permission-gate.ts:90-92` says *"adding a type here after this date [2026-05-10] is a Vera finding (recon:permission-gate-default will assert the snapshot is closed-set)."* Grep for `recon:permission-gate-default` returns no implementation:

> ```bash
> $ grep -rn "permission-gate-default" prototype/platform/recon/ | wc -l
> 0
> ```

The promised recon does not exist. The legacy list grew to 215 entries; without the recon the closure assertion is untested.

**Recommendation:** ship the recon — fail when the list count differs from the snapshot; tag entries with the date they were added so adds-after-2026-05-10 are detectable. Owner: Atlas + Vera (this finding).

#### F-012 — (P2) (test-quality / weak assertion) — `prototype/tests/runtime-kai-pre-trade-gateway.test.ts:118`

> ```ts
> expect(approval).toBeDefined();
> ```

Tests pre-trade gateway approval but only asserts the result exists. Misses any actual property of the approval object.

**Recommendation:** assert specific fields (e.g. `expect(approval.outcome).toBe("approved")`).

#### F-013 — (P2) (test-quality) — `prototype/tests/scheduler.test.ts:323, 361`, `tests/scenarios-fx-end-to-end-phase-d.test.ts:89, 142`, `tests/projections-snapshot.test.ts:193`, `tests/policy-register.test.ts:223–225`

Eight `toBeDefined()` / `toBeTruthy()` assertions where a structural assertion would be cheaper to maintain and stronger. None individually critical; pattern bears mentioning.

**Recommendation:** replace with shape assertions during the next test refactor.

### Error handling

#### F-014 — (P1) (error handling — silent break) — `prototype/platform/scheduler/scheduler.ts:340–344`

> ```ts
> try {
>   fireAt = nextFireAfter(entry.parsed, cursor);
> } catch (_e) {
>   break;
> }
> ```

The scheduler catches `nextFireAfter` errors and silently `break`s the inner cron iteration. No log, no event, no metric. A bad cron (e.g. unreachable date arithmetic) becomes a silent stop — the agent simply never fires again until the next reschedule.

**Recommendation:** log at `warn` with `agentUrn` + `triggerId` + the underlying error; emit a `SubstrateAlert` at `severity: medium`. Owner: Atlas.

#### F-015 — (P1) (error handling — non-fatal lifecycle) — `prototype/runtime/run.ts:269-274, 312-317, 347-352`

Substrate lifecycle event emissions (`SubstrateAgentRunStarted` / `Completed` / `Failed`) wrap the append in `try/catch` and log + swallow on failure. Comment says "non-fatal":

> ```ts
> } catch (err) {
>   logger.error(
>     { runId: payload.runId, agent: payload.agent, err: (err as Error).message },
>     "substrate-runner — SubstrateAgentRunStarted append failed (non-fatal)",
>   );
> }
> ```

These are the audit trail for the autonomous-runtime substrate. A silent failure means a run executed without an open/close pair in the event store — Principle 1 violation by omission. There's a defensible reason (don't crash the runner over telemetry), but the trade-off should land in the event store as a `SubstrateAlert` rather than only `logger.error`.

**Recommendation:** when the lifecycle append fails, fall back to appending a `SubstrateAlert` (a different event-type) recording the failure. If both fail, then crash. Owner: Atlas.

#### F-016 — (P2) (error handling — boundary parsing) — `prototype/runtime/agents/scrooge-ceo-decision-record.ts:104`

> ```ts
> parsed = JSON.parse(raw);
> ```

Inside a try-block (good), but the catch at line ~115 handles the parse error generically. If a malformed CEO-decision record file is encountered, the agent skips silently. Per Principle 4 (security designed in) the agent should escalate (`AgentEscalation`) — a corrupted decision record is the kind of integrity event a CEO needs to know about.

**Recommendation:** route parse failures through the escalation channel rather than the run's narrative log.

### Dead code / unused

#### F-017 — (P2) (dead code) — `prototype/platform/recon/harness.ts`

See F-004. The "future GL trial balance" comment has been there long enough to count as deferred. Either ship it or rename.

#### F-018 — (P3) (dead code candidate) — Wide `Record<string, unknown>` payload casts

144 occurrences of `Record<string, unknown>` across `prototype/`. Most are legitimate (event payload at the boundary), but a cluster in `platform/projections/` and `dashboard/derive.ts` re-shapes a typed payload back into the loose record before re-narrowing. These intermediate shapes are dead-after-write.

**Recommendation:** spot-audit during the projection refactor; non-blocking.

### Coupling and god files

#### F-019 — (P1) (coupling — circular dependencies) — 4 cycles detected

`bunx madge --circular --extensions ts platform runtime dashboard domains`:

> ```
> 1) platform/event-trigger-bus/bus.ts > platform/event-trigger-bus/index.ts
> 2) platform/event-trigger-bus/bus.ts > platform/event-trigger-bus/index.ts > platform/event-trigger-bus/scheduled-trigger-consumer.ts
> 3) runtime/handler-callables.ts > runtime/agents/scrooge-follow-on-router.ts
> 4) platform/scheduler/index.ts > platform/scheduler/scheduler.ts
> ```

Cycles 1, 2, 4 are barrel-file/sibling-import patterns inside a single module — annoying but bounded. Cycle 3 is the worrying one: `runtime/handler-callables.ts` registers handler callables, and `scrooge-follow-on-router.ts` imports back from it; this creates a load-order dependency in the runtime composition root. Initialisation order bugs of this shape are deterministic but very hard to diagnose when they bite.

**Recommendation:** invert cycle 3 — `scrooge-follow-on-router.ts` should not depend on `handler-callables.ts`; if it needs the callable map, accept it via parameter / DI from the composition root. Owner: Atlas. Also adopt madge in CI gate (Vera substrate gap).

#### F-020 — (P1) (coupling — god file) — `prototype/platform/event-store/event-types.ts` is 4960 lines

74 schema exports + 73 factory functions in one file. Adding a new typed event collides on this file every dispatch (memory: *handlers-metadata three-way clash*; same shape applies here). Plain refactor target: split per-domain (markets / accounting / governance / agent-lifecycle / RMS / recon) with re-exports from the umbrella.

**Recommendation:** split `event-types.ts` into `event-types/{markets,accounting,governance,agent-lifecycle,rms,recon}.ts` with a thin barrel. Defer to Atlas to plan; landing this before fleet expansion saves merge friction. Authorising decision exists already (D-RMS-PHASE-1 §… nothing precludes this; pure substrate refactor).

#### F-021 — (P2) (coupling — long file) — `prototype/platform/event-store/registry.ts` is 2015 lines

Same pattern as F-020 at smaller scale. Lower priority; co-locating registry rows with the schemas they govern is reasonable, so the right fix is "split together with F-020".

### Comments and documentation

#### F-022 — (P2) (comments) — `prototype/scenarios/03-fx-end-to-end-rehearsal.ts:117, 156, 177, 204, 221`

Five `TODO(#A...)` markers tied to deferred substrate dispatches. CLAUDE.md *"default to no comments"* policy makes scoped TODOs acceptable when they reference an event-typed dispatch ID, but the file's TODO density is high (5 in ~1500 lines).

**Recommendation:** when D-BANK-ACCOUNT-SUBSTRATE / D-FX-SALES-TRADING-FRONTEND / D-SCENARIO-CLOCK fully land, sweep this file. Owner: Anya / Bea (Accounting policy lead, engineering — substrate).

#### F-023 — (P2) (comments) — `prototype/platform/event-store/permission-gate.ts:30, 63, 85-99`

Heavy preamble (~100 lines) on the legacy bypass list. Justified given the audit-trail value, but contains references to "T-01 mitigation date" and Atlas substrate spec sections — when those references rot, the comment becomes a maintenance liability.

**Recommendation:** keep date references typed (e.g. cite `D-EVENT-STORE-SCALING` event ID rather than "T-01 mitigation date"); link to source-of-truth memo paths.

#### F-024 — (P3) (comments — session marker) — `prototype/platform/event-store/store.ts:14-18`

> ```ts
> //   - Snapshot substrate (D-EVENT-STORE-SCALING Slice 2) — per-stream
> //     typed projection caches keyed on `(streamKey, asOf)`. M8 cloud
> //     lift swaps this implementation for Cosmos DB Core hot-tier...
> ```

Comment ties to a current-session decision and slice number. Per CLAUDE.md memory entry on session-referenced comments, this drifts when the M8 lift moves or the slice numbering changes.

**Recommendation:** prefer "see D-EVENT-STORE-SCALING" without the slice number; Slice numbers belong to the build plan, not the persistent code comment.

### Naming and consistency

#### F-025 — (P2) (naming) — `runId` vs `run_id` mixing

Codebase consistently uses `runId` (camelCase) in TypeScript, and `event_id` / `actor_type` (snake_case) in the SQLite DDL — that mapping is fine. But the snake/camel boundary is enforced ad-hoc in each `replay()` shape mapping (`store.ts:359-369`, `postgres-sync.ts:113-115`). Drift risk.

**Recommendation:** centralise the row-to-event adapter (one `rowToEvent()` function) so the snake↔camel mapping is one place, not two. Owner: Atlas.

#### F-026 — (P3) (naming) — `evt` vs `event` vs `e` in `catch (e)` vs `catch (err)`

Inconsistent: some sites use `catch (e)`, others `catch (err)`, others `catch (error)`. Cosmetic; lint-rule territory.

**Recommendation:** pick `err` (the majority); add an ESLint preference rule.

### Performance hotspots

#### F-027 — (P1) (performance — full-replay on each query) — `prototype/dashboard/derive.ts` and projection consumers

Many dashboard tiles call `eventStore.replay()` (full-table scan) per request. Snapshot substrate exists (`store.ts:401-`) but consumers haven't adopted it. Acceptable today (the store has thousands of events, not millions); a forecastable cliff at 10⁵ events.

**Recommendation:** track snapshot-adoption per projection in the recon harness; flag any projection that does a full replay > 10× per minute. Owner: Anya (snapshots) + Atlas (recon).

#### F-028 — (P2) (performance — synchronous I/O) — multiple `readFileSync` callsites in agent handlers

475 `readFileSync` / `writeFileSync` / `existsSync` callsites across `prototype/`. Most are scripts and recon walks — fine. A handful in `runtime/agents/*.ts` are on the critical path of an agent run (e.g. `runtime/agents/anya-projection-drift.ts:128`, `runtime/agents/owen-governance-cycle-prep.ts:70`, `runtime/agents/senna-security-substrate-state.ts:73`).

**Recommendation:** non-blocking; flagged for the cloud-lift (Principle 3) when blob storage replaces local FS reads.

### Security smells

#### F-029 — (P1) (security / input-validation) — Dashboard server input parsing

`prototype/dashboard/server.ts:568` and surrounds — HTTP server route handlers. Dashboard is local-only today (per the Phase-0 posture), but Principle 4 ("security designed in from the start") binds during the build phase too. Spot-check shows JSON body parsing without explicit Zod validation on at least the SSE / refresh endpoints.

**Recommendation:** Zod-parse every request body before the handler trusts it; 401/403 path on bad input. Owner: Senna (Cyber security architect, engineering / governance).

#### F-030 — (P2) (security / process.env) — 90 `process.env` reads across `prototype/`

Includes `BANK_PERMISSION_GATE_DISABLED`, `BANK_SCENARIO_CLOCK_MODE`, `ANTHROPIC_API_KEY`, `BANK_ENABLE_PROVENANCE_SUBSTRATE`, etc. No central registry; an env-var typo silently defaults to "off" or "wall".

**Recommendation:** centralise in a `platform/env.ts` Zod-parsed config singleton; fail at boot on misconfig. Owner: Atlas.

### Recon and gate coverage

#### F-031 — (P1) (recon-coverage gap) — no `recon:permission-gate-default`

Cited in F-011. The gate's own preamble names a recon that does not exist.

**Recommendation:** ship before the legacy list grows beyond 215.

#### F-032 — (P1) (recon-coverage gap) — no event-type registry coverage recon

There is no recon asserting that "every event-type emitted in `prototype/` (via `make<Type>` or string-typed append) has a row in `event-store/registry.ts` AND a Zod schema in `event-types.ts`". The 215-entry legacy list and 73 typed factories are not cross-checked.

**Recommendation:** ship `recon:event-type-registry-coverage`. Owner: Atlas + Vera. Walk every `eventStore.append({ type: "X", ... })` callsite; assert `lookupEventType("X")` returns non-null and that a `make<X>` factory exists in `event-types.ts`.

#### F-033 — (P1) (recon-coverage gap) — no decision-required → CeoDecision recon

Owner Inbox files with `decision-required: true` should pair with a `CeoDecision` event when actioned; today the dashboard derives this implicitly. No recon asserts that an actioned-and-archived decision-required file has a matching CeoDecision event in the store.

**Recommendation:** ship `recon:decision-required-event-pairing`. Owner: Vera.

#### F-034 — (P2) (recon-coverage gap) — no madge-circular-deps gate

F-019 was found by hand. Should be in CI.

**Recommendation:** add `bunx madge --circular --extensions ts ...` to the CI gate matrix; failure = PR blocker.

## 3. Skipped scope

Per dispatch brief, the following are being edited in parallel by Anya (data / analytics engineer) and were not read:

- `prototype/dashboard/public/index.html`
- `prototype/dashboard/public/app.js`
- `prototype/dashboard/public/styles.css`
- `prototype/dashboard/derive.ts` *(referenced indirectly via JSON-parse boundary findings F-010, F-027 — but no read of the file itself)*

Also intentionally out of scope:

- `prototype/node_modules/`
- `prototype/.local/` (runtime DB)

Files I sampled but did not read end-to-end (token budget):

- `prototype/platform/event-store/event-types.ts` — read only first ~100 lines + grep counts (4960 lines total).
- `prototype/platform/event-store/registry.ts` — not read; size cited from `wc -l`.
- `prototype/scenarios/03-fx-end-to-end-rehearsal.ts` — partial; TODO markers grep'd from the whole file.
- `prototype/runtime/run.ts` — partial reads at lines 260–360 and 540–620 only.
- Most files under `runtime/agents/*.ts` — sampled by grep, not read.

## 4. Recommended follow-ons

Highest leverage first. Vera does not dispatch — these are routing recommendations for Scrooge.

1. **F-019** (P1, coupling cycles) → Atlas. Inverting `runtime/handler-callables.ts` ↔ `runtime/agents/scrooge-follow-on-router.ts` removes a deterministic init-order trap.
2. **F-031 + F-032 + F-033** (P1, recon coverage) → Atlas + Vera. Three missing recons are cheap (each <100 LOC) and close the loop on the legacy bypass list, the typed-event surface, and the CEO decision pairing. Bundle as one dispatch.
3. **F-020** (P1, god file) → Atlas. Splitting `event-types.ts` per domain unblocks the next ten dispatches that touch it.
4. **F-015** (P1, lifecycle telemetry) → Atlas. Substrate audit trail with `try/catch + log + swallow` is a Principle 1 weakness; route to `SubstrateAlert` with hard-fail backstop.
5. **F-014** (P1, scheduler silent break) → Atlas. Single-line fix; observability win.
6. **F-007** (P1, RMS register snapshot decode without Zod) → Owen + Atlas. Seven files, same pattern; ~1 hour of work.
7. **F-029** (P1, dashboard server input validation) → Senna. Principle 4 alignment.
8. **F-001 + F-002 + F-003** (P1 cluster, Date.now sprawl) → Atlas. Continuation of in-flight scenario-clock rollout.
9. **F-034** (P2, madge in CI) → Devon (DevOps engineer, engineering). Mechanical CI gate.
10. **F-011** (P1, regression-guard for legacy bypass) → Vera. Tied to F-031.

## 5. Substrate gaps surfaced by this run

Principle 7 ("autonomous by default"). Gaps that prevented this audit from being a fully-autonomous Vera run:

1. **No standing code-quality recon harness.** This review was a dispatched in-session run; nothing today walks `prototype/` for `any`-density, file-size outliers, circular deps, or `Date.now` callsites and emits findings. Roadmap item: `recon:code-quality-metrics` (Vera).
2. **No CODEOWNERS file.** Routing findings to the right persona was manual cross-reference against `Team/_team-roster.json`. A `.github/CODEOWNERS` keyed on file path → persona would make routing mechanical.
3. **No `recon:permission-gate-default`** — claimed in the gate's source comment but not implemented (F-011 / F-031).
4. **No `recon:event-type-registry-coverage`** — F-032.
5. **No `recon:decision-required-event-pairing`** — F-033.
6. **No `recon:circular-deps`** — F-034. `madge` is invokable today; CI doesn't gate on it.
7. **No `recon:wall-clock-callsite-coverage`** — F-003. The author's own comment at `platform/composition.ts:93` notes the rollout is per-module; no recon enforces the rollout.
8. **No central `platform/env.ts` config schema** — F-030. 90 ad-hoc env reads.
9. **No GL trial-balance reconciliation harness** — `recon/harness.ts` self-describes the gap.

The harness would let me re-run this review autonomously and surface drift; today every quality check is a fresh in-session dispatch.

— Vera, third-line, 2026-05-10.
