---
title: Testing strategy — simulated clients, transactions, and market data through licence-day
author: Scrooge (Chief of Staff / Orchestrator)
date: 2026-05-09
summary: How the bank exercises every system capability end-to-end during build phase using synthetic data — clients, instruments, market data, transactions, regulator queries, audit evidence. The strategy distinguishes synthetic from real, prevents accidental commingling, and makes the build-phase rehearsal as substantively production-grade as the licence-day operation. Five layers of testing (unit / integration / scenario / recon / end-to-end), three classes of synthetic data (party / market / event), one boundary discipline (synthetic-only flag on every event during build phase).
decision-required: false
---

# Testing strategy — simulated data through licence-day

**Author:** Scrooge (Chief of Staff / Orchestrator), in response to the CEO's 2026-05-09 advice request.
**Reports through:** direct to CEO.
**For:** Marc (CEO).

## 1. Why this matters

Per memory `project_ai_driven_bank.md` and CLAUDE.md "Operating model — what is real, deferred, paused": the build phase ends at the pre-licence go-live readiness gate. Until that gate lights green, **no real capital, no real customers, no real employees beyond the statutory minimum**. Yet every system capability the bank will need at licence-day must run end-to-end before the gate lights green (per CLAUDE.md Principle 3 implementation sequence: "every report the reporting-capability spec lists, every regulator-submission generator, every reconciliation harness must run end-to-end locally before migration").

The bank therefore needs **synthetic data that is substantively production-grade**: synthetic clients that exercise every onboarding gate, synthetic instruments that exercise every product family, synthetic transactions that exercise every settlement path, synthetic market data that exercises every projection. The synthetic data must:

- Exercise *every* code path the licence-day operation will exercise
- Be *clearly distinguished* from real data — every event carries a `synthetic: true` flag during build phase, every recon harness asserts the flag, every API surface refuses to commingle
- Be *seeded reproducibly* — the same synthetic seed produces the same dataset, so every test (unit, integration, scenario, recon, end-to-end) is deterministic
- Be *retired cleanly* at licence-day — synthetic events do not pollute the real event log when commencement-of-trading begins

## 2. Five layers of testing

### 2.1 Unit tests

**Scope:** Individual functions, schemas, factories. Already in place via `bun test`.

**Synthetic data:** Inline test fixtures (no shared synthetic-data corpus). Each test owns its inputs; the inputs are a few-line literal.

**Owner:** Every engineer for the modules they author.

**Status:** Mature. ~250+ tests across `prototype/tests/`.

### 2.2 Integration tests

**Scope:** Module-to-module interactions. Event-store reads + writes; projection re-derivation; recon-harness assertions on pure-function outputs.

**Synthetic data:** Small per-test event-log fixtures committed under `prototype/tests/fixtures/`. Each fixture is a few hundred events at most.

**Owner:** Each engineer for their integration scope.

**Status:** Partial. Vera (Internal-audit / continuous-assurance engineer)'s recon pipelines (Wave-4 #11 #13 #16 etc.) are integration-tests against the live repo state; that's good. Other integrations (e.g. M4 FX foundation slice tests) are well-covered.

### 2.3 Scenario tests

**Scope:** Multi-event narrative flows. A single synthetic counterparty onboarded → screened → trades → settled → revaluated → reported. End-to-end *story* per scenario.

**Synthetic data:** Curated scenario decks under `prototype/scenarios/`. Each scenario carries:
- A self-contained synthetic-counterparty set
- A synthetic instrument set
- A scripted event sequence
- Expected outcomes (typed projections, recon results, regulator-submission bundles)
- A `synthetic: true` flag on every event

**Owner:** Per scenario, one or two engineers (e.g. Saskia, Head of Global Markets, governance + Kai, Trading-systems engineer for FX scenarios; Bea, Accounting engineer for accounting-flow scenarios; Mira, Compliance / RegTech engineer for AML/CFT scenarios; Niko, Sales / CRM engineer for onboarding scenarios).

**Status:** Skeleton in place at `prototype/scenarios/01-hello-bank.ts` and `02-onboard-counterparty.ts`. Need ~20–30 more before licence-day.

**Recommended near-term scenarios (build-phase priorities):**
- 03 — Institutional counterparty onboarding (eligibility-screening passes; FAIS scope set)
- 04 — Institutional counterparty onboarding (eligibility fails; remediation path)
- 05 — FX Spot trade booking + correspondent settlement (Standard Bank primary)
- 06 — FX Spot trade booking + switch-test active (FirstRand-RMB backup)
- 07 — FX Swap trade booking with two-leg cross-field validation
- 08 — NDF trade booking + cash-settlement at fixing
- 09 — IFRS 9 Stage 1 → Stage 2 migration on a synthetic bond holding
- 10 — Tier-1 model validation cycle (synthetic ECL model → ModelValidationApproved)
- 11 — Backtest harness run on synthetic Tier-1 ECL outputs
- 12 — STR detection on a synthetic suspicious transaction → FIC submission
- 13 — Daily SARB BA-return generation from a synthetic balance-sheet
- 14 — Quarterly board-pack generation from synthetic risk + finance + capital state
- 15 — Audit-evidence query on a synthetic past-period state ("as-of replay" per Principle 1)
- 16 — POPIA breach scenario (synthetic data subject; breach detected; 72-hour notification flow)
- 17 — Cyber-incident scenario (synthetic detection event → IR runbook → JS 1 of 2024 notification)
- 18 — Operational-resilience scenario (correspondent-bank outage; switch-test triggered; recon)
- 19 — Capital-adequacy stress-test on a synthetic balance-sheet (ICAAP rehearsal)
- 20 — Liquidity-stress scenario (LCR / NSFR breach; remediation flow)

Each scenario emits a typed `ScenarioRun` event so the dashboard surfaces "what's been rehearsed" and Vera reconciles "every named system capability has at least one passing scenario".

### 2.4 Recon harness tests

**Scope:** Continuous-controls assertions over the entire repo state (events, registers, persona files, procedures, code) running on every CI cycle.

**Synthetic data:** None directly — recon reads the canonical sources. But scenario-test outputs feed recon, so the synthetic data flows transitively.

**Owner:** Vera (Internal-audit / continuous-assurance engineer) curates the recon pipelines. Currently 9+ pipelines under `prototype/platform/recon/`.

**Status:** Mature. Wave-4 backlog has 5 more in flight (B-cluster RAS-breach, named-pair contract-status, gateway-integrity, validation-cycle, parallel-dispatch-divergence — already shipped).

### 2.5 End-to-end rehearsal

**Scope:** Full operational rehearsal of a "day in the life" of the bank — onboard a counterparty, trade, settle, revalue, report — using synthetic clients, instruments, market data.

**Synthetic data:** A persistent **synthetic-bank corpus** under `prototype/seeds/synthetic-bank/`:
- 50–200 synthetic counterparties exercising every eligibility category
- 100–500 synthetic instruments across every M-phase product family
- 1–3 years of synthetic market data (FX rates, yield curves, equity prices, credit spreads)
- 100k–1M synthetic events covering a representative year of operations

Generated reproducibly via `bun run synthetic-bank:seed`. Re-generated on schema changes via the same script.

**Owner:** Atlas (Core banking platform architect) + Anya (Data / analytics engineer) for the seed substrate; per-domain engineers contribute the domain-specific generators (Saskia + Kai for markets data; Bea, Accounting engineer for opening balances; Mira for compliance/AML transactions; Senna, Security engineer for cyber-incident events).

**Status:** Not yet built. **This is the largest substrate gap** between build-phase and licence-day readiness.

## 3. Three classes of synthetic data

### 3.1 Synthetic parties

Every party (counterparty, correspondent, regulator, market-infrastructure provider, internal-staff stub) carries:

- A typed `partyType` (`institutional-counterparty`, `correspondent-bank`, `regulator`, `market-infrastructure`, `internal-stub`)
- A `synthetic: true` flag
- A jurisdictional context (Principle 5: every party carries jurisdiction)
- A LEI placeholder (`[LEI: TBC pending substrate]`)
- A POPIA classification (synthetic personal data must still be POPIA-compliant in handling — synthetic ID numbers must not collide with real ones; synthetic addresses must not be real persons')

**Generation:** Use a deterministic Faker-style library with a fixed seed so the same `npm run synthetic-bank:seed` produces the same dataset every time. Faker libraries available in JS: `@faker-js/faker` is the standard.

**POPIA discipline:** Even synthetic, the bank is a future POPIA-responsible-party. Synthetic data must use ID-number ranges that cannot collide with real SA ID numbers (synthetic prefix `999*`); synthetic addresses must use the documented "test-fictional" addresses (e.g. residential street numbers in 99999*); synthetic email addresses must use `*.synthetic.test.local` domains.

### 3.2 Synthetic market data

- FX rate series (every currency pair the bank trades, per business day, from a chosen start date to today)
- Yield curves (ZAR / USD / EUR / GBP at minimum; SOFR / SARB / ESTR reference)
- Equity prices (top 40 JSE constituents at minimum)
- Credit spreads (sovereign + corporate-investment-grade)
- Bond prices + accrual interest schedules

**Generation:** A combination of (a) historical data downloaded once and committed (where free + redistributable, e.g. from SARB / Stats SA / JSE public data), and (b) deterministic synthetic generation (geometric Brownian motion on the FX side; Nelson-Siegel-Svensson on the yield curve side; etc.).

**Discipline:** Every market-data point carries `source: "synthetic-bank"` or `source: "<historical-public-source>"`; Vera recon asserts no synthetic-bank market data leaks to a real-trade execution.

### 3.3 Synthetic events

Every typed event in the event log can be produced synthetically. The event-store envelope already carries `citations` and other metadata; add a `synthetic` boolean field to the envelope (Atlas, Core banking platform architect substrate task).

- **`synthetic: true`** events are produced by scenario tests, the synthetic-bank-seed, and recon-harness tests.
- **`synthetic: false`** events are produced by real operations starting at commencement-of-trading.

**Discipline:**
- During build phase, every event is `synthetic: true`. A Vera recon pipeline asserts this — any `synthetic: false` event during build phase is a finding.
- At commencement-of-trading, the synthetic data corpus is *retired* (moved to a `synthetic-archive` event log; the live event log starts fresh with real `synthetic: false` events).
- API surfaces refuse to mix: real-trade execution endpoints reject `synthetic: true` payloads at the boundary; synthetic-bank scenarios reject `synthetic: false` payloads.

## 4. Boundary discipline — preventing accidental commingling

Five guard rails:

1. **`synthetic` flag on every event.** Atlas's substrate-level addition. Recon asserts.
2. **Separate event-log file for synthetic.** During build phase, the synthetic event log lives at `prototype/seeds/synthetic-bank/events.jsonl`; the future real event log lives at `<production>/events/...`. Different stores, different retention, different access controls.
3. **Build-phase environment marker.** A top-level `BANK_PHASE = "build" | "licence-day" | "live"` env var; every API surface and scenario refuses to operate outside its declared phase. At licence-day, `BANK_PHASE = "licence-day"` flips and synthetic flows are quarantined.
4. **Senna (Security engineer)-led threat-model gate.** Before any production-substrate code path is executed against synthetic data, Senna's threat-model gate confirms no privilege escalation or data leakage from synthetic to real.
5. **Mira (Compliance / RegTech engineer)-led obligations register.** Every synthetic-data-generation pattern carries a register entry (URN cluster `urn:obligation:bank:test:synthetic-data:*`) so the synthetic posture is visible to internal audit and to the SARB pre-application engagement.

## 5. Cadence + ownership

**Build phase (now):**
- Scenario tests added incrementally as new system capabilities land. ~20–30 scenarios by licence-day.
- Synthetic-bank corpus seeded by Atlas + Anya in a single substrate-task at the next clean window.
- Recon assertions added by Vera incrementally.

**Pre-licence go-live readiness gate (Saskia, Helena, Devon, Rashida co-owned):**
- All 20–30 scenarios pass.
- Synthetic-bank end-to-end "day in the life" rehearsal succeeds repeatedly.
- Vera asserts every named system capability has ≥1 passing scenario.

**Licence-day:**
- Synthetic event log archived.
- Real event log opens; commencement-of-trading per memory `project_rules_bind_at_commencement.md`.

**Post-licence (live):**
- Synthetic-bank corpus continues to be used for regression tests + new-feature scenario tests.
- Synthetic data is never commingled with real data; the boundary discipline holds.

## 6. Substrate gaps surfaced

1. **`synthetic` envelope field.** Atlas (Core banking platform architect) v1 substrate task. Add to every event-store envelope.
2. **Synthetic-bank seed substrate.** Atlas + Anya joint substrate-task. ~50–200 counterparties, ~100–500 instruments, ~1–3 years market data, ~100k–1M events.
3. **Scenario-test coverage.** ~20–30 scenarios owed by build-phase end. Per-domain engineers contribute their slice.
4. **`BANK_PHASE` env-var gate.** Atlas v1 substrate task.
5. **Synthetic-data obligations register.** Mira (Compliance / RegTech engineer) URN cluster.
6. **POPIA-compliant synthetic-data generation patterns.** Iris (Information Officer, governance) + Mira joint specification.
7. **Senna (Security engineer) threat-model gate on synthetic-vs-real boundary.** v1 substrate task.

## 7. Recommendation to the CEO

Approve the strategy in §2–§4 and authorise the following substrate dispatches at the next clean cadence:

1. **Atlas (Core banking platform architect)** — `synthetic` envelope field + `BANK_PHASE` env-var gate (single PR; small).
2. **Atlas + Anya (Data / analytics engineer)** — synthetic-bank seed substrate (medium PR; reproducible Faker-seeded generator with deterministic output).
3. **Per-domain engineers** — 20–30 scenarios authored incrementally; one CEO-decision pack to confirm priority order at next sweep.
4. **Vera (Internal audit / continuous-assurance engineer)** — recon pipeline asserting `synthetic: true` during build phase (small PR; high leverage for boundary discipline).
5. **Mira (Compliance / RegTech engineer) + Iris (Information Officer, governance)** — synthetic-data obligations URN cluster + POPIA-compliant generation patterns (markdown deliverable + register PR).
6. **Senna (Security engineer)** — threat-model gate on the synthetic-vs-real boundary (markdown deliverable; substrate-task downstream).

Default-if-no-decision: Atlas + Anya prioritise the seed substrate at their next available window; the per-domain scenario backlog grows organically as new system capabilities land; Vera adds the boundary recon as part of Wave-4.

—Scrooge (Chief of Staff / Orchestrator)
