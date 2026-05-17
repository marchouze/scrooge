---
title: Agent-runtime fleet rollout — A1 → A4 sequencing + first-three handlers
author: Atlas · Scrooge
date: 2026-05-08
summary: Consolidated build sequence from A1 (registry + identity) through A4 (fleet rollout) under the approved D-AGENT-RUNTIME-AUTHORIZE. Names Helena, Devon, Zara as the first three handlers to write next, with rationale and exit criteria. Confirms persona-spec rollout has converged (28/28); gating now concentrates in substrate-component build + handler-writing.
decision-required: true
decision-id: D-FLEET-ROLLOUT-SEQUENCING
decision-category: near-term
decision-owner: Atlas (substrate build) · Scrooge (fleet coordination) · Devon (governance)
decision-for-ceo: Approve the proposed first-three handler order (Helena → Devon → Zara) and the A1 → A2 → A3 substrate-build sequence, so handler-writing begins concretely while substrate components proceed in parallel.
decision-recommendation: Approve as proposed. The first-three can be written against today's substrate (handlers-metadata + GitHub Actions cron + in-process fan-out) and re-bind cleanly to A1–A2 components when those land — no rework.
---

# Agent-runtime fleet rollout — A1 → A4 sequencing + first-three handlers

**Authors:** Atlas (Core banking platform architect) · Scrooge (Chief of Staff)
**For:** Marc (CEO)
**Date:** 2026-05-08
**Authority:**
- `D-AGENT-RUNTIME-AUTHORIZE` (resolved 2026-05-07; substrate spec approved as drafted)
- `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07; A0 schema freeze landed jointly)
- Principle 7 (Autonomous by default; humans oversee the residual)
- Persona-agent-spec rollout dated 2026-05-07

**Status:** Sequencing plan. Implements an approved decision; sub-decision asked is the first-three ordering and the parallelisation rule.

> **Derivation note (Principle 6 — downward).** This document sits at the *standard* layer — it sequences the build of an approved spec into phases. No new principle-level substance. Cites the runtime substrate spec, the persona rollout, the substrate-state from 2026-05-07, and `prototype/runtime/handlers-metadata.ts`.

---

## 1. Where we are today (delta since 2026-05-07)

| Item | 2026-05-07 state | 2026-05-08 state |
|---|---|---|
| Persona agent-spec coverage | 4/26 vanguard upgraded; 22 sequenced | **28/28 personas** carry §6–§17 operating-spec sections (incl. Linnea) |
| Runtime handlers registered | 11 across 8 personas | **11 across 8 personas** (Vera, Atlas, Anya×2, Mira×2, Owen, Scrooge×3, Senna) |
| Substrate-component build (A1–A3) | A0 schemas frozen | **A0 frozen; A1+ not started** |
| Event store | Cloud-shared via Neon (build-phase exception `TM-NEON-EVENT-STORE-001`) | unchanged |
| Cross-process event bus | In-process fan-out only; cross-workflow deferred to M8 | unchanged |
| Decisions resolved this week | D-AGENT-RUNTIME-AUTHORIZE, D-MARKETS-SCHEMA-FOUNDATION, A0 schema freeze | unchanged; today asks for D-FLEET-ROLLOUT-SEQUENCING |

The headline shift is that **persona-spec rollout has effectively converged**. The original four-tranche plan in `2026-05-07_persona-agent-spec-rollout.md` collapsed into a faster pass — every persona file in `/Team/` now has the 17-section operating-spec form. The gating that remains is engineering, not authorship: build A1–A3 substrate components, and write handlers for the **20 personas that have specs but no handler yet**.

### 1.1 Personas with handlers (8 of 28)

| Persona | Trigger(s) | Kind | Cadence |
|---|---|---|---|
| Vera | `overnight-recon` | scheduled | 24h |
| Atlas | `substrate-state` | scheduled | weekly |
| Anya | `projection-drift` · `projection-refresh` | scheduled · event-driven | 24h · on-event |
| Mira | `obligations-snapshot` · `citation-gate` | scheduled · on-request | weekly · ad-hoc |
| Owen | `governance-cycle-prep` | scheduled | weekly |
| Scrooge | `inbox-hygiene` · `ceo-decision-record` · `follow-on-router` | scheduled · on-request · event-driven | 24h · ad-hoc · on-event |
| Senna | `security-substrate-state` | scheduled | weekly |

### 1.2 Personas without handlers (20 of 28)

Helena, Zara, Camille, Devon, Eitan, Saskia, Thandiwe, Rashida, Iris (governance, 9), Rohan, Bea, Yael, Tomas, Imani, Sade, Kai, Niko, Ravi (engineering, 9), PAX, Nolan, Linnea (meta, 3 — Niko paused per build-phase model so 19 active blockers).

---

## 2. A1 — agent registry + identity issuer

> Atlas-engineering-effort estimate: **~2 weeks of focused build**. Local-first per CEO directive of 2026-05-06.

### 2.1 A1.1 — Agent registry (week 1 of A1)

**Goal:** Every persona file in `/Team/<Name>.md` becomes a registered agent with a stable URN identity and a published permission policy derived from its `§12 System capabilities called` and event emit/subscribe lists.

| Component | File path | Acceptance |
|---|---|---|
| `AgentRegistry` interface | `prototype/platform/agent-runtime/registry.ts` | `register(spec)`, `lookup(urn)`, `list()` typed |
| `AgentRegistered` event handler | `prototype/platform/event-store/agent-runtime-events.ts` (already in A0) | Append on registration; replayable |
| Persona-spec parser | `prototype/platform/agent-runtime/spec-parser.ts` | Reads §6–§17 from `/Team/<Name>.md`; produces `AgentSpec` |
| Registration handler | `prototype/runtime/agents/atlas-agent-registry-sync.ts` | Idempotent: re-registers diffs; emits `PermissionPolicyPublished` |

**Exit criterion:** Running `bun run agent:atlas:agent-registry-sync` registers all 28 personas; replay produces 28 `AgentRegistered` + 28 `PermissionPolicyPublished` events.

**Substitutes:** today's `prototype/runtime/handlers-metadata.ts` (11 entries, hand-curated). After A1.1, that file becomes a *cache*; the registry is canonical.

### 2.2 A1.2 — Identity issuer + permission enforcement (week 2 of A1)

**Goal:** Every event append carries a signed `agentId`. The event store rejects appends that violate the appending agent's permission policy.

| Component | File path | Acceptance |
|---|---|---|
| `AgentIdentityIssuer` | `prototype/platform/agent-identity/issuer.ts` | Software-backed Ed25519 keypair per agent; rotation event |
| `IdentityKeyRotated` event handler | A0 schema (already frozen) | Append-only; replayable |
| Event-store permission gate | `prototype/platform/event-store/permission-gate.ts` | Blocks appends violating agent's permission policy |
| Vera read-only carve-out | enforced at gate | Vera identity reads any stream; cannot write |

**Exit criterion:** Vera registers, signs, reads every stream, cannot append to streams outside her allow-list. Gate rejection produces a `SubstrateAlert`.

**Architectural seam:** `@platform/agent-identity/AgentIdentityIssuer` (Atlas spec §3.1). M8 cloud lift swaps to Azure Entra ID workload identity + Key Vault Managed HSM with no interface change.

---

## 3. A2 — scheduler + event-trigger bus

> Atlas-engineering-effort estimate: **~3 weeks of focused build**.

### 3.1 A2.1 — Scheduler as a substrate component (~1.5 weeks)

Today the "scheduler" is GitHub Actions cron files. After A2.1 it's a Bun-process scheduler emitting typed `ScheduledTrigger` events at the SQLite-stored cadence.

| Component | File path | Acceptance |
|---|---|---|
| `Scheduler` | `prototype/platform/scheduler/index.ts` | `register`, `tick`, `inactivityCheck` |
| Schedule registry | derived from registry §6 cadence | Re-derived on every registration diff |
| Calendar awareness | `prototype/platform/calendar/sa.ts` (extensible per P5) | SA holidays; tested |
| `ScheduledTrigger` event handler | A0 schema | Already frozen |
| Inactivity-SLA emitter | scheduler component | Emits `SubstrateAlert` if `AgentRunCompleted` doesn't land within SLA |

**Exit criterion:** Vera's overnight-recon, Atlas's substrate-state, Anya's projection-drift run via the scheduler — `.github/workflows/agent-runtime-*.yml` cron files become thin shims that just invoke the scheduler tick (or are retired entirely).

### 3.2 A2.2 — Event-trigger bus as a substrate component (~1.5 weeks)

Today event-driven dispatch is **in-process fan-out from a parent run** (`runtime/run.ts` lines 132–199). After A2.2 it's a separate substrate listener subscribing to the event store's change stream and dispatching cross-process.

| Component | File path | Acceptance |
|---|---|---|
| `EventTriggerBus` | `prototype/platform/event-trigger-bus/index.ts` | `subscribe`, `dispatch` |
| Subscription registry | derived from registry §7 triggers | Auto-rebuilds on registration diff |
| Backpressure / per-agent in-flight cap | bus component | Excess deliveries queued; depth threshold → `SubstrateAlert` |

**Exit criterion:** Anya's `projection-refresh` (event-driven, subscribes to 4 event types) fires from a *different* parent process than the one that emitted the event. Validates cross-process dispatch. Fully cross-workflow dispatch still requires a shared queue substrate, deferred to M8.

---

## 4. A3 — escalation channel + oversight UI v1

> Atlas-engineering-effort estimate: **~5 weeks** (channel: 2; UI v1: 3). Highest-value sub-phase for CEO experience.

### 4.1 A3.1 — Typed escalation lifecycle

Today escalations land in `/Owner Inbox/` as `.md` files (1 `AgentEscalation` event in the store; everything else is file-only). After A3.1 the lifecycle is event-typed end-to-end.

| Component | File path | Acceptance |
|---|---|---|
| Escalation-channel core | `prototype/platform/escalation/channel.ts` | Typed append + routing per `targetOverseer` |
| Lifecycle events (5) | A0 schema (frozen) | `AgentEscalation`, `Acknowledged`, `Decided`, `Delegated`, `Overdue` |
| Sealed-escalation routing | channel core | `fraud` / `whistleblowing` / `popia-incident` route to scoped overseers only |
| Owner Inbox sink (legacy) | sink shim | Renders escalation event into a markdown file for current CEO workflow; retires when UI lands |
| Deadline enforcer | scheduler-coupled | Emits `AgentEscalationOverdue` if deadline passes without `Decided` |

**Exit criterion:** Helena (once her handler ships) escalates an out-of-appetite breach via the typed channel; Marc decides via a typed `AgentEscalationDecided` event; the agent's next run consumes the decision.

### 4.2 A3.2 — Oversight UI v1 (inbox view)

Single-page view in the existing dashboard. Three surfaces: open escalations, fleet status, decision drill-down.

| Surface | Source | Acceptance |
|---|---|---|
| Open escalations sorted by deadline | `AgentEscalation` events not yet `Decided`/`Delegated` | One-click decision actions |
| Fleet status (per agent: last/next run, in-flight, pending escalations) | substrate event streams + handler-metadata | Updates on event append |
| Decision drill-down | `AgentDecision` events with citation chain | Opens the procedure that authorised it |
| POPIA s.71 surface (per Iris's standing template) | flagged on automated decisions falling under s.71 | Subject-rights affordances first-class |

**Exit criterion:** Marc decides one real escalation through the UI without opening a markdown file.

---

## 5. A4 — fleet rollout (rolling)

The 20 personas without handlers, prioritised by (a) operational urgency, (b) substrate-readiness today, (c) governance-line completeness.

### 5.1 First three handlers to write next (this is the decision asked)

**Recommendation: Helena → Devon → Zara, in order.** Rationale below.

#### 1. Helena — `risk-appetite-watch` (scheduled, daily)

- **Why first.** CRO line is currently silent in the runtime. Helena's spec already specifies daily continuous cadence; vanguard-four spec is most rigorous. Risk Appetite Statement & Framework is approved (D-RAS, 2026-05-06). Without Helena, breaches sit unobserved.
- **Inputs (today, all available).** RAS thresholds register; substrate-state snapshots; dashboard-state; obligations-snapshot.
- **Outputs.** `RiskAppetiteSnapshot` event (per appetite metric: limit, current, headroom, status). `AgentEscalation` when a metric crosses amber/red — once A3.1 ships, typed; before then, Owner Inbox file with escalation frontmatter.
- **Substrate-readiness today.** Can run against the existing event store + dashboard-state. Will re-bind cleanly to A1 (registration), A2 (scheduling), A3 (escalation) when those land — no rework.
- **Substrate gap declared at first run.** Rohan's projection-substrate isn't built; Helena will run in degraded mode reading what's available and flagging the missing measurement substrate as the gap. That gap becomes Rohan's roadmap item, not Helena's blocker.

#### 2. Devon — `operational-resilience-snapshot` (scheduled, weekly)

- **Why second.** COO line is the reports-to anchor for **5 engineering personas** (Atlas, Tomas, Anya, Niko, plus Imani + Sade interim). Devon's roll-up turns the existing engineering substrate-state outputs into a coherent COO view. Currently those outputs are produced and never aggregated.
- **Inputs (today, all available).** Atlas's substrate-state (weekly); Anya's projection-drift (daily); Senna's security-substrate-state (weekly); the substrate-exception register (`Owen's 2026-05-07_owen_substrate-exception-register.md`).
- **Outputs.** `OperationalResilienceSnapshot` event per BCP / DR scope item; weekly COO pack to Owner Inbox; `AgentEscalation` on degraded-state crossings (RTO/RPO breaches once defined).
- **Substrate-readiness today.** All upstream feeds exist. The roll-up is mechanical aggregation — no new measurement substrate required.
- **Substrate gap declared at first run.** Formal RTO/RPO definitions per service tier are not yet authored — Devon's first run flags this; Atlas and Senna co-author at the next governance cycle.

#### 3. Zara — `mlro-supervision` (scheduled, weekly)

- **Why third.** CCO line. Mira (engineering) is the most-active runtime persona — emits obligations-snapshot weekly, citation-gate on-request. Zara is Mira's reports-to (memory: governance vs engineering); without Zara registered, Mira has nowhere typed to escalate STR/CTR drafting decisions to. The MLRO signing-authority split is currently informal; this handler makes it event-typed.
- **Inputs (today, all available).** Mira's obligations-snapshot; Mira's citation-gate findings; `AuditFinding` events; suspicious-activity drafts (when Mira starts emitting them).
- **Outputs.** `MLROAttestation` events (weekly: confirms Mira's outputs reviewed; sanctions-list freshness checked); `STRDecision` events (on-request: confirms STR draft reviewed and signs to file); escalates fit-and-proper or commencement-of-trading triggers per Principle 7.
- **Substrate-readiness today.** All upstream feeds exist. Reads Mira's outputs + the obligations register.
- **Substrate gap declared at first run.** No FIC e-filing channel yet — Zara's STR signing produces a typed event but the actual filing route to FIC waits for licence-day commencement of trading.

### 5.2 Next six (after first three land)

| Order | Persona | Trigger | Why this position |
|---|---|---|---|
| 4 | Camille (CFO) | `financial-position-snapshot` (weekly) | CFO line; Bea & Yael's reports-to; consumes accounting events when they start |
| 5 | Rohan (Risk eng) | `risk-projection-build` (event-driven on market data) | Builds Helena's measurement substrate — closes Helena's first-run gap |
| 6 | Thandiwe (CAE) | `audit-committee-prep` (weekly) | Aggregates Vera's findings into AC-ready pack; Vera's functional reports-to |
| 7 | Rashida (CISO) | `cyber-resilience-snapshot` (weekly) | Senna's reports-to; Joint Standard 1 of 2024 attestation |
| 8 | Iris (IO) | `popia-controls-snapshot` (weekly) | POPIA s.56 standing duties; lawful-basis register integrity |
| 9 | Eitan (Treasurer) | `liquidity-snapshot` (daily, but degraded until commencement) | ALCO chair; LCR / NSFR substrate; degraded mode acceptable in build phase |

### 5.3 Remaining (rolling thereafter)

Saskia, Bea, Yael, Tomas, Imani, Sade, Kai, Ravi, PAX, Nolan, Linnea (11 personas). Sequence determined at the time each becomes operationally urgent — most are activity-gated (Bea on first accounting event, Niko on licence-day, Linnea on brand-build deliverables). Each handler-write is a single Atlas/owner-engineer ticket, not a substrate change.

---

## 6. Critical-path summary

```
A0 (frozen)
  │
  ├── A1.1 registry ──── A1.2 identity ──── A2.1 scheduler ──── A2.2 trigger-bus ──── A3.1 escalation ──── A3.2 oversight UI
  │       (week 1)         (week 2)            (week 3.5)         (week 5)            (week 7)            (week 10)
  │
  └── Fleet rollout (parallel from now)
          │
          ├── Helena (risk-appetite-watch)        ← today
          ├── Devon  (operational-resilience-snapshot)
          ├── Zara   (mlro-supervision)
          ├── ... 6 more (§5.2)
          └── ... 11 remaining (§5.3)
```

**Key observation:** fleet rollout does **not** wait on A1–A3. Each new handler today registers via `prototype/runtime/handlers-metadata.ts` and runs via the existing GitHub Actions + in-process bus. When A1 ships, the registration moves to the registry — a one-line change per handler. When A2 ships, the cron file becomes a thin shim. When A3 ships, escalation events route to the typed channel instead of Owner Inbox. **No rework** because the agent code is the same against both substrates — the seam is in the runtime, not the handler.

**Hard dependencies that cannot be parallelised:**
1. **A3.1 escalation channel** must land before any agent in scope can emit a *binding* escalation (regulator-relevant, deadline-bearing). Until then, escalations are advisory — Marc reads them in Owner Inbox.
2. **Cross-workflow event bus (M8)** blocks event-driven dispatch where parent and child handlers run in different GitHub Actions workflows. Workaround today: schedule parent and child in the same workflow, or convert child to scheduled.
3. **A1 permission policy** must land before any agent emits events that touch capital, customer, or sealed-escalation streams. Build-phase events (substrate-state, recon, governance-prep) are non-sensitive and don't gate.

---

## 7. Substrate-gap inventory (current — supersedes Atlas's 2026-05-07 snapshot)

| # | Gap | Owner | Closes at |
|---|---|---|---|
| 1 | Agent registry + permission-policy enforcement | Atlas | A1.2 |
| 2 | Scheduler as substrate component (not GitHub Actions) | Atlas | A2.1 |
| 3 | Cross-process event-trigger bus | Atlas | A2.2 |
| 4 | Cross-workflow event bus (Azure Event Hubs / Service Bus) | Atlas | M8 (post-licence) |
| 5 | Typed escalation lifecycle (5 events end-to-end) | Atlas + Senna + Iris | A3.1 |
| 6 | Oversight UI v1 (inbox + fleet + drill-down) | Atlas + Anya | A3.2 |
| 7 | Auto-derived substrate-gap register (Vera Wave-4 #13) | Vera | After A1 |
| 8 | RTO/RPO definitions per service tier | Devon + Atlas + Senna | First Devon run flags; closes at next governance cycle |
| 9 | Risk-projection measurement substrate | Rohan | Handler #5 (after first-three) |
| 10 | Helena's independent-validation function | PAX research / Nolan hire | Nolan tranche |
| 11 | FIC e-filing channel | Zara + Mira | Licence-day commencement |
| 12 | Hardening conditions §5.1, §5.2 on Neon event store | Atlas + Senna | Before any sensitive-data event flows |

Gaps 1–6 are **substrate gaps** (engineering work to land A1–A3); gaps 7–12 are **domain gaps** that surface as agents start running and depend on pieces that aren't yet built.

---

## 8. What this plan does *not* cover

- **Production SLAs.** Local-deployment runs at laptop scale with best-effort SLAs. Production SLAs land at M8.
- **Multi-tenant isolation.** Single tenant; not in scope.
- **Inter-agent orchestration beyond pub-sub.** Workflow-shaped coordination (e.g. KYC onboarding spans Niko + Mira + Imani + Senna) is domain engineering, not substrate.
- **Agent decision-quality monitoring.** Drift / model-risk on agent decisions sits in Helena's model-risk envelope (once Rohan + the second-line build it), not in the substrate.
- **Niko's lifecycle activation.** Paused per build-phase model; activates at commencement of trading.

---

## 9. The decision asked

**D-FLEET-ROLLOUT-SEQUENCING — approve the proposed first-three (Helena → Devon → Zara) and the substrate-build sequence.**

If approved as drafted:
1. Atlas opens A1.1 build (agent registry); commits a tracking issue on the local roadmap.
2. Scrooge instructs Helena, Devon, Zara to draft their handler implementations (own files under `prototype/runtime/agents/`); first runs targeted within the next agent-cadence tick for each.
3. Vera's Wave-4 #11 recon pipeline gets a planned-vs-actual handler-coverage assertion that will turn green as the fleet rollout progresses.
4. The substrate-gap inventory in §7 becomes the canonical roadmap until Vera's auto-derived register lands.

If different first-three are preferred (e.g., Camille earlier for the financial-statements line, or Thandiwe earlier for the audit programme), Atlas + Scrooge re-sequence and re-publish.

---

## 10. Open items routed elsewhere

- **To Senna + Rashida:** A1.2 permission-policy gate threat model — needed before A1.2 build commences (already in flight per the substrate spec § 11).
- **To Vera:** confirm `MLROAttestation`, `RiskAppetiteSnapshot`, `OperationalResilienceSnapshot` event shapes are sufficient for Wave-4 #14/#15 audit hooks before first-three handlers ship.
- **To Owen:** add the three new procedure files (`risk-appetite-monitoring.md`, `operational-resilience-monitoring.md`, `mlro-supervision.md`) at the next IAF reading; bind to existing source policies.
- **To Iris:** POPIA-by-design review of the oversight UI before A3.2 build (Atlas spec §11 carry-forward).
- **To Devon:** confirm operational-resilience treatment of the substrate (severity tier, BCP/DR scope) — Atlas spec carry-forward.
- **To Helena:** confirm the appetite-metric set Helena's first run will check against; flag any that depend on substrate Rohan hasn't built yet.

—Atlas · Scrooge
