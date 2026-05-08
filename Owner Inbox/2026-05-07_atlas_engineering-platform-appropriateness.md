---
title: Engineering platform — appropriateness assessment
author: Atlas (via Scrooge)
date: 2026-05-07
summary: Atlas's review of the engineering platform underlying every data flow and process the bank is developing. Verdict — appropriate for build-phase; coherent with Principles 1, 5, 6; substrate seams to Azure are clean. Three areas need active decisions soon (agent-runtime completion, Bun-vs-Node licence-day call, Neon→Azure-Postgres path). Two areas are non-negotiable replacements at licence-day (HSM, human identity).
decision-required: false
---

# Engineering platform — appropriateness assessment

**Author:** Atlas (via Scrooge) · **Date:** 2026-05-07 · **Scope:** Every substrate component the prototype runs on, evaluated against the seven principles, the strategic foundation, the AI-driven-bank reframe, and the implementation sequence

## Bottom line

**Appropriate for the build phase.** The platform is coherently shaped for what it is — a regulator-grade substrate being authored locally before it lifts to Azure. The choices are consistent with Principles 1, 5, and 6, the substrate seams for cloud lift are clean, and the recon discipline is unusually rigorous for this stage. There are no fundamental architectural mistakes; the gaps are *gaps*, not *defects*, and they are tracked.

**Not licence-day-grade today** — and shouldn't be. Five components are explicitly build-phase substitutes (HSM, human identity, scheduler, tracing, cloud event store) and need to be replaced or hardened before licence-day. None of them is hard; all of them are routine cloud-platform work.

**Three decisions are coming up that warrant attention** — agent-runtime completion (Atlas Step 2; this week), Bun-vs-Node for licence-day (a multi-year commitment), and the Neon→Azure-Postgres migration path (because the cloud target is Azure but cloud-shared today is Neon).

Detail follows.

## What we're using — inventory

| Layer | Substrate | File / location | Build-phase fit | Licence-day fit |
|---|---|---|---|---|
| Runtime | Bun | `package.json` | ✅ fast iteration, native TS, native sqlite | 🟡 evaluate vs Node/Deno; no SARB-regulated precedent |
| Language | TypeScript strict | `tsconfig.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) | ✅ correct | ✅ correct |
| Validation | Zod | `prototype/platform/event-store/types.ts` | ✅ correct | ✅ correct |
| Lint / format | Biome | `biome.json` | ✅ correct | ✅ correct |
| Event store (local) | SQLite via `bun:sqlite`; append-only DDL; `AUTOINCREMENT` sequence; transaction-bounded | `prototype/platform/event-store/store.ts` | ✅ correct shape for P1 | 🟡 dev/test only |
| Event store (cloud-shared) | Neon Postgres (`BANK_EVENT_DB_URL`); bidirectional sync via `event-store:sync` | Atlas substrate-state §Event store | 🟡 conditional — TM-NEON-EVENT-STORE-001 with §5.1 / §5.2 hardening deferred | ❌ requires hardening; Azure-target migration plan needed |
| Projections | Pure-function fold; `Reducer<S, E>`; `Projector` interface; in-process `LocalProjector` | `prototype/platform/projections/` | ✅ correct | ✅ correct (cloud `Projector` swaps behind same interface) |
| Identity (services) | HMAC-SHA256 software-backed key, JWT-shaped tokens, `env: "LOCAL_ONLY"` header | `prototype/platform/identity/local.ts` | ✅ correct (explicitly local-only) | ❌ replaced by Azure Entra ID Workload Identity Federation + Managed HSM |
| Identity (humans) | Not implemented | — | ✅ build-phase has no humans operating against the substrate | ❌ WebAuthn / FIDO2 + Entra ID at licence-day |
| Key material | Software-backed file at `.local/keys/idp.key` mode 0600 | `prototype/platform/identity/` | ✅ build-phase | ❌ Azure Key Vault Managed HSM (FIPS 140-2/3 Level 3) per Principle 3/4 |
| Observability — logging | Pino structured | `prototype/platform/observability/logger.ts` | ✅ correct | 🟡 plus Azure Monitor / Application Insights at licence-day |
| Observability — metrics | None explicit (events themselves) | — | 🟡 acceptable; events are the audit log | 🟡 add metrics primitives at multi-process scale |
| Observability — tracing | None | — | 🟡 acceptable at single-process scale | ❌ distributed tracing required at multi-Container-App scale |
| Citation gate | Required field at event-store schema; `cite()` constructor; CI gate | `prototype/platform/citation/gate.ts` | ✅ excellent — P2 baked in, not a side-rule | ✅ same |
| Recon harness | 5 pipelines (round-trip, dashboard derivation, mandate ownership, decision-event recon, prose duplication) | `prototype/platform/recon/` | ✅ unusually strong for build-phase | ✅ extends with Wave-3/4 pipelines as Vera's published plan lands |
| Agent runtime — handlers | 11 registered (Vera, Atlas, Anya×2, Mira×2, Owen, Senna, Scrooge×3) via static `HANDLERS_METADATA` map | `prototype/runtime/run.ts` + `runtime/handlers-metadata.ts` | ✅ correct shape | ✅ same; canonical metadata source A1-resolved |
| Agent runtime — scheduler | GitHub Actions cron via 8 workflow files | `.github/workflows/agent-runtime-*.yml` | 🟡 adequate; concurrency issues hit (per `feedback_github_actions_concurrency`) | ❌ proper scheduler with at-least-once semantics required |
| Agent runtime — event bus | In-process fan-out from parent run; cross-process bus is M8 | `runtime/run.ts` | 🟡 adequate for current handler count | ❌ cloud-substrate event bus at multi-process scale |
| Agent runtime — identity | Not yet typed for agents | — | ❌ Principle 7 gap; Atlas Step 2 in flight | ❌ Entra ID Workload Identity per agent; zero-trust + least-privilege |
| Agent runtime — escalation | `AgentEscalation` event schema defined; channel not built | — | ❌ Principle 7 gap; Atlas Step 2 in flight | ✅ `AgentEscalation` is the licence-day channel too |
| Composition | Single root file; clean interfaces | `prototype/platform/composition.ts` | ✅ correct | ✅ swap-only at cloud lift |
| Dashboard | Pure derivation from canonical sources; cache at `seeds/dashboard-state.json`; HTTP server | `prototype/dashboard/` | ✅ correct (re-derivable; never hand-edited) | ✅ same; lift only the distribution layer |
| Tests + CI gates | `bun run ci`: typecheck + lint + tests + citation-gate + 3 recon pipelines | `package.json` scripts | ✅ correct shape | ✅ extends with Wave-3/4 pipelines |
| Narrative generation | Anthropic API; `tryGenerateNarrative` per handler; degrades gracefully | runtime/agents/* | 🟡 cost concern (largest current spend); not load-bearing | 🟡 evaluate cost-benefit per handler |

## Assessment by principle

### Principle 1 — events as truth: appropriate

The shape is right. SQLite append-only DDL + monotonic `sequence` + transaction-bounded writes + first-class as-of replay match Principle 1 cleanly. Storage backend swaps (SQLite → Postgres → cloud event store) without changing the contract. Stored projections are explicitly typed as caches; they re-derive from the log. The bidirectional `event-store:sync` between local SQLite and cloud Neon is a build-phase convenience that doesn't violate the principle.

**Watchpoint:** the cloud-shared store is Neon Postgres today. Postgres is a fine event store but Neon is not on Azure (the bank's licence-day cloud target). The substrate works; the *vendor* doesn't match the cloud strategy. Either (a) move to Azure Database for PostgreSQL (or Azure Postgres Flexible Server) at cloud lift, or (b) confirm Neon's Azure-region offering is acceptable. This is a small decision; making it now avoids late surprises.

### Principle 2 — citations: appropriate

Citation discipline is enforced at the event-store schema level (`.min(1)` Zod constraint with explicit "P2 violation" message), backed by a CI gate (`bun run citation-gate`), and extended to clauses, posting rules, risk-taxonomy entries, and procedure source-policies via the typed-citation arrays the substrates added today (legal / accounting / risk / sales / payments). This is structural, not aspirational.

### Principle 3 — cloud-native, no manual: appropriate (build-phase phasing honoured)

The implementation sequence ("full local build first, then migrate to cloud as a single coherent phase") is honoured: substrate seams are interfaces (`EventStore`, `Projector`, `Authenticator`, `Logger`); the composition root is a single file; cloud lift is M8 and replaces the composition root without touching capability code. This is the pattern the principle calls for.

**Two non-negotiable replacements at licence-day:**

- HSM key material (currently software file `.local/keys/idp.key` mode 0600). Azure Key Vault Managed HSM (FIPS 140-2/3 Level 3) is the licence-day replacement; private keys never leave the HSM.
- Operator credentials. Today there are none persistent; at licence-day, every operator action is just-in-time, narrowly scoped, recorded as an event.

Both are part of M8; neither blocks build-phase work.

### Principle 4 — security designed in: appropriate (with watchpoints)

What's working: zero-trust posture as default in the identity contract (every request authenticates / authorises); least-privilege scaffolding (typed `Principal.actor`); secure SDLC procedure populated; Senna threat-model gate exists for new substrate components (TM-NEON-EVENT-STORE-001 is the worked example).

**Watchpoints:**

- **Neon hardening conditions deferred** (TM-NEON-EVENT-STORE-001 §5.1 role downgrade to SELECT+INSERT, §5.2 IP allowlist). Today acceptable because no sensitive-data events flow. The moment the first FAIS advice record, sanctions hold, or KYC client master event lands in the cloud-shared store, the deferred conditions become required immediately. Trigger should be explicit in the substrate-exception register and surfaced to the dashboard.
- **No distributed tracing** at the substrate level. Single-process today is fine; at multi-Container-App scale (M8) tracing becomes load-bearing for incident response.
- **No anomaly detection** at the platform level yet. The recon pipelines catch structural drift, not operational anomalies. Add at multi-process scale.

### Principle 5 — multi-everything from day one: appropriate

This is one of the platform's strongest features. Every monetary value carries currency at the type level (branded `Money` / `Decimal` / `Currency` types in `prototype/platform/types/`). Every event header carries `entity`. The legal-entity tree, chart of accounts, posting-rule register, and ISO 20022 catalogue all declare currency / entity / jurisdiction at the type level — no implicit defaults anywhere. Adding the second of any of `{entity, currency, jurisdiction}` is a configuration change, not a project. This is what the principle asks for.

### Principle 6 — single graph: appropriate

The substrate is shaped for the graph: typed citations on every event; obligations register, policy register, procedure index, persona library are all readable and increasingly machine-readable; recon pipelines assert directional resolvability (mandate-ownership recon, decision-event recon, prose-duplication recon, dashboard-derivation recon). The graph isn't fully closed — Vera's Wave-4 pipelines extend coverage further — but the substrate the closure runs on is correct.

### Principle 7 — autonomous by default: under construction (the biggest gap)

This is the area with the most outstanding substrate work. The runtime today is a static `HANDLERS_METADATA` registry + GitHub-Actions cron + in-process fan-out. That is roughly the *shape* of an agent runtime, not a full implementation. Atlas's Step 2 spec is in flight (per `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`); it covers scheduler, event-trigger bus, agent identity & permissioning, escalation channel, and the CEO oversight UI.

Until Step 2 lands, every domain agent that doesn't have a registered handler runs via Scrooge-coordinated in-session work. That's the documented build-phase pattern (per Principle 7 transitional clause), but it's a known temporary state, not the steady state. Closing this gap is the single highest-leverage substrate move available.

## Component-by-component verdict

### Runtime layer — Bun

**Verdict:** Right for build-phase; deliberate decision required for licence-day.

Bun is fast, native-TypeScript, includes `bun:sqlite`, has good ESM ergonomics, and is improving rapidly. For build-phase iteration speed, it's the right call.

For licence-day, three considerations:

1. **Regulatory precedent.** SARB-PA does not (to public knowledge) have a regulated bank running on Bun. That is not disqualifying but is informational. Node has unambiguous precedent; Java / .NET have more.
2. **Operational maturity.** Bun's GC, observability story, and crash-recovery semantics are improving but not at Node's level. For licence-day operations on real money, this matters.
3. **Substitutability.** Almost everything in the codebase is portable Node-compatible TypeScript. The Bun-specific surfaces are: `bun:sqlite` (SQLite is local-dev only; cloud is Postgres anyway), `bun run` ergonomics, and the native test runner. Migration to Node would be roughly a week's work, not a re-architecture.

**Recommendation:** keep Bun through build-phase. Open a CEO decision card *before* the first cloud-deployed Container App ("Bun runtime — keep, evaluate, or replace at cloud lift") so the choice is explicit, not drift.

### Event store

**Verdict:** Local-SQLite is right; Neon-cloud-shared is conditional and needs an Azure-path decision.

Local SQLite is the right shape for a local-first build (durability, ordering, append-only, replay determinism, sub-millisecond writes). Neon Postgres for cloud-shared (with `BANK_EVENT_DB_URL`) is the build-phase convenience that makes agent-runtime cron in GitHub Actions work, with bidirectional sync.

**Watchpoints:**

1. The Neon exception (TM-NEON-EVENT-STORE-001) carries deferred hardening (§5.1 role downgrade, §5.2 IP allowlist) that is acceptable while no sensitive-data events flow, and triggers immediate hardening once any do. The trigger condition should be visible in the dashboard and reviewed at every workstream that introduces new event types.
2. The licence-day cloud target is Azure (per `project_cloud_target_azure`). Neon's Azure-region offering exists but the canonical Azure path is Azure Database for PostgreSQL — Flexible Server. Decide which.

### Projections

**Verdict:** Right.

Pure-function fold over the event log; Reducer / Projection types; Projector interface; in-process LocalProjector; persisted projection is explicitly a cache. This is exactly the shape Principle 1 asks for. Cloud lift swaps the Projector implementation behind the same interface.

### Identity, key material

**Verdict:** Right for build-phase; clean replacement at licence-day.

Software-backed HMAC at `.local/keys/idp.key` is correctly fenced (mode 0600, `env: "LOCAL_ONLY"` header on issued tokens — tokens cannot be confused with cloud-issued ones). The Authenticator interface is the seam Azure Entra ID + Managed HSM swaps in at M8. No human identity yet, by design.

### Agent runtime

**Verdict:** Under-built; Atlas Step 2 closes the gap.

Today's runtime is a static handler map + GitHub Actions cron + in-process fan-out. That covers the 11 registered handlers (mostly meta-agents — recon, substrate-state, citation gate, governance cycle, inbox hygiene). It does not cover the ~60 procedures the populated procedures index lists; those depend on Scrooge in-session today.

The substrate spec at `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` (which I have authored under Step 2) lays out scheduler, event-trigger bus, agent identity & permissioning, escalation channel, oversight UI. Build is in flight.

GitHub Actions concurrency is a known issue (per `feedback_github_actions_concurrency`); the per-workflow concurrency group fix is in. For licence-day, the scheduler should not be GitHub Actions — needs proper at-least-once semantics, retry policy, and dead-letter handling. Azure Container Apps Jobs + a real scheduler (Azure Logic Apps or a small custom scheduler) is the licence-day path.

### Recon harness

**Verdict:** Strong.

Five pipelines is unusually thorough for build-phase. The pattern of typed `ReconResult { pipeline, ok, asserted, violations[], asOf }` is correct. Vera's Wave-3 / Wave-4 plan extends coverage in directions the populated procedures need (clause-library recon, posting-rule recon, payments recon, advice-record recon, model-registry recon). Keep going.

### Citation gate

**Verdict:** Strong.

Cite-at-schema-level + CI gate + typed `Citation` constructor is exactly the right shape. Mira's `mira:citation-gate` handler wraps it as an on-request agent run; that closes the operational loop.

### Dashboard

**Verdict:** Right.

Pure derivation from canonical sources; cache file is explicitly a cache (per `feedback_dashboard_always_derived`); the Anya `projection-refresh` event-driven handler keeps it fresh; never hand-edited. The frontmatter convention for Owner Inbox surfaces gives it a typed handle on every deliverable. Cloud-lift swaps the distribution layer (HTTP server) for an Azure App Service or Container App; nothing else changes.

### Tests + CI gates

**Verdict:** Right for build-phase.

`bun run ci` covers typecheck + lint + tests + citation gate + 3 recon pipelines. That is meaningful coverage. Adding Vera's planned recon pipelines as they land is the natural extension. For licence-day, also add: dependency-vulnerability scanning, signed-build attestation, supply-chain verification (SLSA-aligned per Principle 4 secure SDLC).

### Narrative generation (Anthropic API)

**Verdict:** Cost-driven decision, not architectural.

Per CLAUDE.md, Anthropic API spend is the largest current cost. `tryGenerateNarrative` per handler is a pleasant feature but isn't load-bearing — handlers degrade gracefully without `ANTHROPIC_API_KEY`. Two postures are reasonable:

1. **Keep all narratives.** They're useful for human-readable context in Owner Inbox. Cost is small per run; aggregate is the question.
2. **Selective narratives.** Keep narrative-gen on handlers where the narrative is genuinely useful (CEO decision records, governance cycle prep, security substrate state). Drop it on mechanical handlers (citation gate, projection refresh, inbox hygiene) where the structured output is sufficient.

Camille should weigh in. For now, the substrate is right; the cost discipline question is open.

## Open decisions worth flagging

Three CEO-decision cards I'd suggest opening:

1. **`D-RUNTIME-LANGUAGE`** — Bun runtime: keep through licence-day, evaluate, or replace with Node at cloud lift. Open before first Container App deploy.
2. **`D-CLOUD-EVENT-STORE-PATH`** — Cloud-shared event store target: Neon-on-Azure, or Azure Database for PostgreSQL, or hybrid. Decide before sensitive-data events flow (which triggers the Neon hardening anyway).
3. **`D-NARRATIVE-COST-DISCIPLINE`** — Per-handler narrative-gen on/off. Camille-CFO question. Low-stakes; worth getting right before the spend grows.

None is urgent this week; all three become awkward if deferred past M8.

## What I'd not change

- Event sourcing as the foundation. (P1 wins this debate every time.)
- TypeScript strict + Zod + Biome.
- Markdown + JSON Schema substrate as the transitional shape for registers (clause library, chart of accounts, risk taxonomy, ISO 20022 catalogue, sponsor-bank model). Git-backed audit trail is free; typed lift to per-file registries at M2 is straightforward.
- The composition-root pattern.
- The recon-harness discipline.
- The build-phase-vs-licence-day phasing model. It's honest, it's tracked in substrate-gap notes, and it prevents premature commitment.

## What I'd watch

- Agent runtime — fastest-moving, highest-leverage; Step 2 substrate spec progress is the rate-limiting step on Principle 7.
- Neon hardening trigger — should be a structural alarm, not a memory.
- Bun ecosystem maturity — quarterly check; six months of stability shifts the licence-day posture.
- Cost of narrative generation — monthly check; if it grows, Camille's call.

## Provenance

Inventory walked: `prototype/platform/{event-store,projections,identity,observability,recon,citation,types,core,composition.ts}`, `prototype/runtime/{run.ts,handlers-metadata.ts,agents/}`, `prototype/dashboard/`, `prototype/{package.json,tsconfig.json,biome.json}`, `.github/workflows/agent-runtime-*.yml`. Cross-checked against Atlas's substrate-state run from earlier today and against the platform documents in `Owner Inbox/2026-05-05_core-platform-architecture.md` and `2026-05-05_local-prototype-plan.md`. Citation-gate and prose-duplication recon both green at time of writing.

—Atlas (via Scrooge)
