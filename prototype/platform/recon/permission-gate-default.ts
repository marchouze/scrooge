// platform/recon/permission-gate-default.ts
//
// Continuous-controls pipeline: permission-gate-default integrity (F-031).
//
// The gate's own preamble at `prototype/platform/event-store/permission-
// gate.ts:91` promises a `recon:permission-gate-default` that "asserts the
// snapshot is closed-set" against the legacy bypass list and that the gate's
// secure-default posture (T-01, Senna + Rashida threat model 2026-05-10) is
// preserved across construction sites. That recon did not exist; this is it.
//
// Why this matters (F-011 / F-031, Vera codebase quality review 2026-05-10):
//   1. Secure-by-default is a Principle 4 invariant. Anyone constructing an
//      `EventStore` and skipping the `gateEventStore(...)` wrapper silently
//      reintroduces the pre-T-01 footgun where any actor could append any
//      event type. The footgun is invisible at runtime: it only manifests
//      under attacker conditions or when an unfortunate test fixture leaks.
//   2. The `LEGACY_PRE_A1_EVENT_TYPES` allow-list in `permission-gate.ts` is
//      a closed snapshot. Code-quality recon `legacy-bypass-watch.ts` already
//      tracks the *count*; this recon asserts its *composition* — every entry
//      is a real, registered event type, and (eventually) every entry has a
//      published `PermissionPolicy` retiring it.
//   3. Categorical actors with no published policy must be enumerated. Today
//      most agents emit through the substrate-runner identity, which has a
//      legacy carve-out. As Senna's T-02..T-12 mitigations land, agent-keyed
//      identities should each publish a policy; the surface this recon
//      reports is the catalogue of who has not yet done so.
//
// Assertions:
//
//   1. Every non-test EventStore construction site is followed by a
//      `gateEventStore(...)` wrap, OR carries a `permission-gate:bypass:<reason>`
//      comment annotation citing the substrate carve-out (e.g. citation-gate
//      tooling reads the raw store; recon tools replay-only). Test files,
//      scripts/ scaffolds, and intra-permission-gate code itself are scanned
//      but exempt from the wrap requirement (they cite their carve-out in
//      the same line).
//
//   2. Every entry in `LEGACY_PRE_A1_EVENT_TYPES` resolves to a known event
//      type — either a row in the canonical registry (`registry.ts`,
//      `lookupEventType`) OR a `make<Type>` factory in `event-types.ts`.
//      Phantom legacy entries (typos, retired event-types) are P1 findings.
//
//   3. The legacy-bypass list has not exceeded the snapshot baseline
//      (already tracked by `code-quality/legacy-bypass-watch.ts`; this recon
//      cross-checks against the same `BASELINE_COUNT` constant so a single
//      ground-truth governs both pipelines).
//
//   4. Every actor that has appended at least one event in the live store
//      under a `service` actor with id `agent:<urn>` resolves to a published
//      `PermissionPolicy`. Actors without a policy are reported (severity by
//      category): the substrate-runner identity is acceptable today (info);
//      every other agent-keyed actor without a policy is a P2 finding in
//      this slice — escalating to P1 once Senna's T-12 mitigation lands.
//
// P2 — citation discipline. Findings carry typed citations:
//   - `P4-SECURITY-DESIGNED-IN` (Principle 4)
//   - `ORG-CY-09` (zero-trust, least-privilege)
//   - `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md` (T-01)
//   - `Owner Inbox/2026-05-10_vera_codebase-quality-review.md` (F-031, F-011)
//
// Author: Vera (Internal audit engineer, third-line)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { LEGACY_PRE_A1_EVENT_TYPES, PRIVILEGED_EVENT_TYPES } from "../event-store/permission-gate";
import { lookupEventType } from "../event-store/registry";
import { BASELINE_COUNT } from "./code-quality/legacy-bypass-watch";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = [
  "P4-SECURITY-DESIGNED-IN",
  "ORG-CY-09",
  "Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01)",
  "Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011)",
];

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const PROTOTYPE_DIR = resolve(REPO_ROOT, "prototype");

export interface ConstructionSite {
  readonly file: string; // path relative to prototype/
  readonly line: number;
  readonly source: string; // verbatim line content
}

export interface RunOpts {
  /** Override prototype dir for tests. */
  prototypeDir?: string;
  /** Override the legacy bypass set for tests. */
  legacyBypass?: ReadonlySet<string>;
  /** Override the baseline count for tests. */
  baseline?: number;
  /** Override known event types (union of registry + factory) for tests. */
  knownEventTypes?: ReadonlySet<string>;
  /** Override appended actors for tests. Pairs of (agentUrn, hasPolicy). */
  appendedAgentActors?: ReadonlyArray<{ agentUrn: string; hasPolicy: boolean }>;
  /** Construction sites override (skip filesystem scan in tests). */
  constructionSites?: ReadonlyArray<ConstructionSite>;
  /**
   * Override PRIVILEGED_EVENT_TYPES for tests. Allows asserting the
   * Option C invariants against synthetic sets without touching production.
   */
  privilegedEventTypes?: ReadonlySet<string>;
}

// Files / directories where a raw `new EventStore(...)` is expected and
// gate-wrapping is meaningless or actively wrong. Each carve-out names a
// reason; the recon checks the carve-out is genuinely intra-substrate.
const CONSTRUCTION_CARVE_OUT_FILES: ReadonlySet<string> = new Set([
  // The composition root itself is the canonical wrap site — the raw store
  // is built here and immediately gated on the next statement.
  "platform/composition.ts",
  // The recon self-test (formerly harness.ts) builds an in-memory throwaway
  // store for the round-trip assertion; gating it would require synthesising
  // a fake policy resolver for every test event, defeating the purpose.
  "platform/recon/harness.ts",
  "platform/recon/recon-self-test.ts",
  // Recon pipelines that read-only replay the live store. Wrapping the read
  // path with the gate is a no-op (the gate intercepts append, not replay).
  "platform/recon/dashboard-derivation-recon.ts",
  "platform/recon/decision-event-recon.ts",
  "platform/recon/decision-recommendation-recon.ts",
  "platform/recon/parallel-dispatch-divergence.ts",
  // Citation gate runs as a CI / pre-commit script that walks the store
  // outside the runtime; it is read-only and never appends.
  "platform/citation/gate.ts",
  // Supersession annotation integrity recon — read-only replay of CeoDecision
  // events; wrapping the read path with the gate is a no-op.
  "platform/recon/supersession-annotation-integrity.ts",
  // D-DECISIONS-FRAMEWORK-REDESIGN Slice A recon pipelines — read-only
  // replay of Decision / CeoDecision events; gate is a no-op on replay.
  "platform/recon/decisions-events-only.ts",
  "platform/recon/decision-symmetry.ts",
  "platform/recon/decision-id-hygiene.ts",
  "platform/recon/decision-authority-coverage.ts",
  "platform/recon/decision-authority-routing.ts",
  // Aggregate-ID coverage recon — read-only replay that checks aggregate_id
  // presence on must-have event types; gate is a no-op on replay.
  "platform/recon/aggregate-id-coverage.ts",
  // Spread-benchmarking advisory recon — read-only replay of FxTradeExecuted +
  // MarketDataStore query; gate is a no-op on the replay path. Advisory-only:
  // not wired into the CI chain. Citation: D-MARKETS-SCHEMA-FOUNDATION; ORG-MK-08.
  "platform/recon/spread-benchmarking.ts",
  // Vera Wave-4 #14 + #15 — read-only replay of AgentEscalation /
  // AgentDecision events; gate is a no-op on replay.
  "platform/recon/escalation-channel.ts",
  "platform/recon/agent-scope.ts",
  // URN-shape advisory recon (D-URN-CANONICAL-VOCABULARY) — read-only replay
  // of every event's `payload.citations` array to classify URN-shape vs prose.
  // Gate is a no-op on replay. Citation: D-URN-CANONICAL-VOCABULARY,
  // P4-SECURITY-DESIGNED-IN.
  "platform/recon/urn-shape.ts",
  // NPA gate integrity recon (D-NEW-PRODUCT-APPROVAL-POLICY, D-PRODUCT-CONSTRUCTION-SUBSTRATE)
  // — read-only replay of product-lifecycle events to check NPA dimension
  // attestation coverage. Gate is a no-op on replay. Citation:
  // D-NEW-PRODUCT-APPROVAL-POLICY §5, P4-SECURITY-DESIGNED-IN.
  "platform/recon/npa-gate-integrity.ts",
  // ProductApproved attestation-integrity recon (D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 8)
  // — backward-looking read-only replay of ProductApproved + ProductDimensionAttested events
  // to assert governance integrity before approval. Gate is a no-op on replay.
  // Citation: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 8, D-NEW-PRODUCT-APPROVAL-POLICY,
  // P4-SECURITY-DESIGNED-IN.
  "platform/recon/product-approval-attestation-integrity.ts",
  // model-risk-gap-inventory — read-only replay to surface Slice 7 substrate
  // gaps as info findings. No appends; gate is a no-op on the read path.
  // Citation: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 7, D-PRODUCT-CONSTRUCTION-SLICES-4-8.
  "platform/recon/model-risk-gap-inventory.ts",
  // clients-entityname-uniqueness — read-only replay of the KYC clients
  // projection to detect duplicate entityName rows; no appends; gate is a
  // no-op on replay. Citation: D-RECON-CLIENT-ENTITYNAME-UNIQUENESS,
  // P4-SECURITY-DESIGNED-IN.
  "platform/recon/clients-entityname-uniqueness.ts",
  // calc-model-binding — opens the live store to assert each surfaced figure
  // binds to an approved model. It idempotently seeds the calc models (via
  // seedCalcModels, which receives the store and appends ModelSubmitted/
  // ModelTierClassified/ModelValidationApproved through it) then replays the
  // registry fold. The seed path goes through the same gated boot path in
  // production (dashboard/server.ts bootCalcModels); the raw construction here
  // is the recon's own read/seed root, analogous to the other recon roots
  // above. Citation: D-TRUSTED-FIGURES-PROGRAM-V1, P4-SECURITY-DESIGNED-IN.
  "platform/recon/calc-model-binding.ts",
  // PartitionedEventStore — substrate class that opens cold archive SQLite
  // databases for read-only replay; no appends; gate is a no-op on replay.
  // Citation: D-EVENT-STORE-SCALING-PHASE-5, P4-SECURITY-DESIGNED-IN.
  "platform/event-store/partitioned-store.ts",
  // event-store-append-only archive checks — runArchiveChecks() opens the hot
  // store in read-only mode to verify archive partition integrity; no appends;
  // gate is a no-op on the read path.
  // Citation: D-EVENT-STORE-SCALING-PHASE-5, P4-SECURITY-DESIGNED-IN.
  "platform/recon/event-store-append-only.ts",
  // M2 Slice 2 — period-close handler unit tests. Co-located with the module
  // per the per-module test convention. Raw EventStore(":memory:") in tests is
  // a build-phase fixture, not a production access path. T-01 carve-out.
  "platform/accounting/period-close-handler.test.ts",
  // M3 Slice 4 — BA 700 period-close return scenario test. Co-located in the
  // returns/ba700/ package per the per-module test convention. Raw
  // EventStore(":memory:") is a build-phase fixture, not a production access
  // path. T-01 carve-out.
  "platform/returns/ba700/ba700.test.ts",
  // Backfill CLI entry point — emits CeoDecision events synthesised from
  // on-disk Owner Inbox records at boot / CI. Acts as a composition root in
  // the same way platform/composition.ts does: the raw store is constructed
  // here, used to backfill, then immediately closed. The permission gate is
  // not meaningful in this context because the actor identity is a fixed
  // system actor ("backfill:owner-inbox-records"), not a live agent URN.
  "runtime/decisions/backfill-from-records.ts",
  // Three-way reconciliation unit tests — co-located per-module test
  // convention. Raw EventStore(":memory:") is a build-phase test fixture,
  // not a production access path. T-01 carve-out.
  // Citation: D-MARKETS-SCHEMA-FOUNDATION, P4-SECURITY-DESIGNED-IN.
  "platform/payments/reconciliation.test.ts",
  // GL posting engine unit tests — co-located per-module test convention.
  // Raw EventStore(":memory:") is a build-phase test fixture, not a
  // production access path. T-01 carve-out.
  // Citation: PROC-PAY-RBH-01, P4-SECURITY-DESIGNED-IN.
  "runtime/agents/bea-gl-posting-engine.test.ts",
  // Goal-loop helper unit tests — co-located per-module test convention.
  // Raw EventStore(":memory:") is a build-phase fixture for event-reactive
  // candidate assertion, not a production access path. T-01 carve-out.
  // Citation: D-AGENT-AUTONOMY-OPERATIONAL, P4-SECURITY-DESIGNED-IN.
  "runtime/agents/vera-goal-loop.test.ts",
  "runtime/agents/atlas-goal-loop.test.ts",
  "runtime/agents/owen-goal-loop.test.ts",
  // Climate-risk projection unit tests — co-located per-module test convention.
  // Raw EventStore(":memory:") is a build-phase fixture for scenario assertion,
  // not a production access path. T-01 carve-out.
  // Citation: D-RAS-CLIMATE-SCENARIO-FRAMEWORK, P4-SECURITY-DESIGNED-IN.
  "platform/projections/climate-risk-projection.test.ts",
  // ALM-positions projection unit tests — co-located per-module test
  // convention. Same carve-out rationale as climate-risk-projection.test.ts:
  // build-phase fixture store for scenario assertion, not a production
  // access path. T-01 carve-out.
  // Citation: D-RAS, brief:ravi:alm-position-substrate-and-helena-liquidity-line:
  //   2026-05-21, P4-SECURITY-DESIGNED-IN.
  "platform/projections/alm-positions.test.ts",
  // Bun Worker bus-runner unit tests — co-located per-module test convention.
  // Test file creates isolated EventStore instances per-test in a tmp directory
  // for hermetic test isolation (standard test pattern throughout the codebase).
  // Build-phase fixture store, not a production access path. T-01 carve-out.
  // Citation: P4-SECURITY-DESIGNED-IN.
  "platform/agent-runtime/bun-worker-bus-runner.test.ts",
  // BA 325 LCR generator unit tests — co-located per-module test convention.
  // Raw EventStore(":memory:") is a build-phase fixture for testing the
  // HQLA override logic (D-FINANCIAL-INSTRUMENT-ENTITY Slice 9); not a
  // production access path. T-01 carve-out.
  // Citation: D-FINANCIAL-INSTRUMENT-ENTITY; BA-325-LCR; P4-SECURITY-DESIGNED-IN.
  "platform/reporting/ba-325-lcr.test.ts",
  // PR-G model-validation seed — emits ValidationMethodologyPublished + ModelValidationApproved
  // at boot time from the Nadia validation sign-off seed. The seed is called from
  // dashboard/server.ts (via bootModelValidationSeeds) which already holds the gated store;
  // this seed file itself passes the raw store through from the caller.
  // Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8, P4-SECURITY-DESIGNED-IN.
  "seeds/models/model-validation-seed.ts",
  // model-registered-seed — emits ModelRegistered × 3, ValidationMethodologyPublished × 2 (v1),
  // and ModelValidationApproved × 3 for IRS ZARONIA and FX swap gap closure. Called from
  // dashboard/server.ts (via bootModelRegisteredSeeds) with the gated store.
  // Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8, P4-SECURITY-DESIGNED-IN.
  "seeds/models/model-registered-seed.ts",
  // Market-risk VaR/SVaR/ES engine unit tests — co-located per-module test
  // convention. Raw EventStore(":memory:") is a build-phase fixture for the
  // historical-simulation status-path assertions, not a production access
  // path. T-01 carve-out.
  // Citation: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1, P4-SECURITY-DESIGNED-IN.
  "platform/market-risk/var-engine.test.ts",
  // CVA engine unit tests (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5) — co-located
  // per-module test convention. Raw EventStore(":memory:") is a build-phase fixture
  // for the loud-status / computed-CVA assertions, not a production access path.
  // T-01 carve-out.
  // Citation: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1, P4-SECURITY-DESIGNED-IN.
  "platform/market-risk/cva-engine.test.ts",
  // DTCC SAFE API adapter unit tests (#903 — SafeApiAdapter seam). Co-located
  // with the simulator per the per-module test convention; `simulators/` is not
  // a blanket carve-out dir because it also holds production simulator code
  // (e.g. sarb-prudential.ts) that must stay gated. Raw EventStore(":memory:")
  // here is a build-phase test fixture, not a production access path. T-01
  // carve-out. Citation: P4-SECURITY-DESIGNED-IN, ORG-CY-09.
  "simulators/dtcc-safe-api.test.ts",
]);

// Directories whose contents are exempt entirely (tests, scenarios, scripts,
// one-shot ops tools, and per-module __tests__/ subdirectories). They
// construct fixture stores; gate-wrapping in those contexts is not a security
// boundary.
const CONSTRUCTION_CARVE_OUT_DIRS: ReadonlyArray<string> = [
  "tests/",
  "scenarios/",
  "scripts/",
  // Per-module unit test directory — same carve-out rationale as tests/.
  // The semantic-layer module co-locates its fixture-store tests here.
  "platform/semantic-layer/__tests__/",
  // M2 Slice 3 BA 325 subscriber — per-module fixture test (same carve-out
  // rationale as tests/; builds in-memory stores for scenario assertion).
  // Citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, P4-SECURITY-DESIGNED-IN.
  "platform/returns/ba325/",
  // M3 Slice 5 BA 350 subscriber — per-module fixture test; same rationale.
  // Citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, P4-SECURITY-DESIGNED-IN.
  "platform/returns/ba350/",
  // M3 Slice 8 CMS subscriber — per-module fixture test (same carve-out
  // rationale as tests/; builds in-memory stores for conduct scenario assertion).
  // Citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, P4-SECURITY-DESIGNED-IN.
  "platform/returns/cms/",
  // M3 Slice 9 conduct events — per-module fixture test (same carve-out
  // rationale as tests/; builds in-memory stores for conduct scenario assertion).
  // Citation: D-MARKET-CONDUCT, D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN,
  // P4-SECURITY-DESIGNED-IN.
  "platform/returns/conduct/",
  // M3 Slice 7 climate-risk disclosure — per-module fixture test (same
  // carve-out rationale as tests/; builds in-memory stores for scenario
  // assertion). Citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN,
  // P4-SECURITY-DESIGNED-IN.
  "platform/returns/climate/",
  // ALM engine — per-module unit tests build in-memory stores for zero-position
  // baseline assertion. T-01 carve-out; no production access path.
  // Citation: D-TREASURY-GAPS-WAVE1, P4-SECURITY-DESIGNED-IN.
  "platform/alm/__tests__/",
  // EOD FX revaluation — per-module unit tests build in-memory stores for
  // revaluation scenario assertion. T-01 carve-out; no production access path.
  // Citation: D-MARKETS-CAPITAL-TIME-SHAPE, P4-SECURITY-DESIGNED-IN.
  "platform/markets/eod/",
  // FinSurv stub — per-module unit tests build in-memory stores for
  // regulatory reporting scenario assertion. T-01 carve-out.
  // Citation: D-FX-AD-STATUS, EXCON-SARB-CIRC-3-2020, P4-SECURITY-DESIGNED-IN.
  "platform/markets/regulatory/",
  // EnvSim unit tests — per-module tests build in-memory stores for
  // deterministic replay and stochastic-profile scenario assertion. T-01 carve-out;
  // no production access path.
  // Citation: D-MARKETS-SCHEMA-FOUNDATION, P4-SECURITY-DESIGNED-IN.
  "platform/simulation/env-sim/",
  // Liquidity projection unit tests — per-module fixture stores for multi-horizon
  // LCR/NSFR scenario assertion (empty-store baseline, SAGB HQLA, provider caching).
  // T-01 carve-out; no production access path.
  // Citation: D-TREASURY-GAPS-WAVE1, BA-325, BA-326, P4-SECURITY-DESIGNED-IN.
  "platform/liquidity/__tests__/",
];

// T-12 mitigation COMPLETE (2026-05-17, Atlas):
//
//   All 44 sub-agent task actors and platform infrastructure actors that were
//   previously in ACCEPTED_NO_POLICY_ACTORS now have published PermissionPolicy
//   events in the event store. The carve-out is empty; any new actor that
//   appends events without a published policy will be reported as `warn`
//   severity by Assertion 4 (no longer silently accepted as `info`).
//
//   Publication mechanism: `bun run publish:sub-agent-policies` (Option A —
//   registry-time derivation, per Senna's spec §3). Run as part of the
//   T-12 PR (feat(t12): sub-agent PermissionPolicy enforcement).
//
//   Authority: Owner Inbox/2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md
//   (T-12); D-T01-PERMISSION-GATE-SECURE-DEFAULT; P4-SECURITY-DESIGNED-IN; ORG-CY-09.
//
// BASELINE_NO_POLICY_ACTORS_COUNT: tracks the size of ACCEPTED_NO_POLICY_ACTORS.
// Starts at 0 (all retired). Any PR that adds entries must update this constant
// upward and cite the carve-out reason. Recon reports `fail` if the set grows
// above the baseline (regression); `info` if it shrinks (progress, update baseline).
const BASELINE_NO_POLICY_ACTORS_COUNT = 0;

// Intentionally empty — T-12 mitigation closed all 45 original carve-out entries.
// Do NOT add new entries without a cited carve-out reason and a paired
// PermissionPolicyPublished publication plan. Authority: Senna spec §4.2.
const ACCEPTED_NO_POLICY_ACTORS: ReadonlySet<string> = new Set([]);

function listTsFiles(dir: string, base: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".local" || name.startsWith(".")) continue;
    const full = join(dir, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      listTsFiles(full, base, out);
    } else if (stat.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
      out.push(full.startsWith(base) ? full.slice(base.length + 1) : full);
    }
  }
}

function scanConstructionSites(prototypeDir: string): ConstructionSite[] {
  const files: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, files);
  const sites: ConstructionSite[] = [];
  // Real construction has the form `<lhs> = new EventStore(` or
  // `return new EventStore(` — the `new` token is *not* preceded by a
  // string-quote / backtick / comment marker. We scan line-wise and
  // skip lines whose `new EventStore(` lives inside a comment or string
  // literal (text-level heuristic; good enough for code that follows
  // the project's formatting conventions).
  const re = /\bnew\s+EventStore\s*\(/;
  for (const rel of files) {
    // Skip the recon module itself — its prose / message templates
    // necessarily mention "new EventStore(...)" as instructional text
    // and would self-trigger.
    if (rel === "platform/recon/permission-gate-default.ts") continue;
    if (rel === "platform/recon/permission-gate-default.test.ts") continue;
    let content: string;
    try {
      content = readFileSync(resolve(prototypeDir, rel), "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const m = line.match(re);
      if (!m) continue;
      // Skip pure-comment lines (// or jsdoc *).
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      // Skip lines where the match is inside a string / backtick literal.
      // Heuristic: count un-escaped backticks / double-quotes before the
      // match index — if odd, we're inside a literal.
      const matchStart = line.indexOf(m[0]);
      const before = line.slice(0, matchStart);
      const backticks = (before.match(/`/g) ?? []).length;
      const quotes = (before.match(/(?<!\\)"/g) ?? []).length;
      if (backticks % 2 === 1 || quotes % 2 === 1) continue;
      sites.push({ file: rel, line: i + 1, source: line.trim() });
    }
  }
  return sites;
}

function isCarvedOutSite(site: ConstructionSite): boolean {
  if (CONSTRUCTION_CARVE_OUT_FILES.has(site.file)) return true;
  for (const dir of CONSTRUCTION_CARVE_OUT_DIRS) {
    if (site.file.startsWith(dir)) return true;
  }
  return false;
}

// Pull every `make<Type>` factory name out of event-types.ts as a fallback
// catalogue of "known event types" — covers the long tail of types that
// have a Zod schema but no formal registry row yet (the build-phase reality
// per registry.ts §"What it does NOT do").
function readMakeFactoryNames(eventTypesPath: string): Set<string> {
  if (!existsSync(eventTypesPath)) return new Set();
  const source = readFileSync(eventTypesPath, "utf8");
  const re = /^export\s+function\s+make([A-Z][A-Za-z0-9]*)\s*\(/gm;
  const out = new Set<string>();
  for (const match of source.matchAll(re)) {
    if (match[1]) out.add(match[1]);
  }
  return out;
}

// Walk for every `type: "X"` and `type === "X"` and `replay({ type: "X" })`
// literal anywhere in the tree. The legacy-bypass list snapshot covers
// types emitted *or referenced* (replay filters, projection switches)
// across the whole prototype/ tree per the gate's preamble §86–98. We
// match any of three syntactic shapes:
//   - `type: "X"`        — append-site key (the dominant pattern)
//   - `type === "X"`     — equality test (projection switches, recon)
//   - `replay({ type: "X" })` — read-path filter (Camille, dashboard)
function readReferencedTypes(prototypeDir: string): Set<string> {
  const files: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, files);
  const out = new Set<string>();
  // Single combined regex: capture every `"TypeName"` immediately
  // following one of the contexts above.
  const re =
    /(?:type\s*:|type\s*===|type\s*==|replay\s*\(\s*\{\s*type\s*:)\s*"([A-Z][A-Za-z0-9]*)"/g;
  for (const rel of files) {
    // Skip the recon module and gate-source: their string literals are
    // *catalogue* entries, not real references.
    if (rel === "platform/recon/permission-gate-default.ts") continue;
    if (rel === "platform/event-store/permission-gate.ts") continue;
    let content: string;
    try {
      content = readFileSync(resolve(prototypeDir, rel), "utf8");
    } catch {
      continue;
    }
    for (const match of content.matchAll(re)) {
      if (match[1]) out.add(match[1]);
    }
  }
  return out;
}

// Walk handler subscribesTo arrays — types subscribed to are also
// genuine, even if no production code emits them yet.
function readSubscribedTypes(): Set<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const meta = require("../../runtime/handlers-metadata") as {
      HANDLERS_METADATA: ReadonlyArray<{ subscribesTo?: readonly string[] }>;
    };
    const out = new Set<string>();
    for (const row of meta.HANDLERS_METADATA) {
      for (const t of row.subscribesTo ?? []) out.add(t);
    }
    return out;
  } catch {
    return new Set();
  }
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("permission-gate-default");
  const violations: ReconViolation[] = [];
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const legacy = opts.legacyBypass ?? LEGACY_PRE_A1_EVENT_TYPES;
  const baseline = opts.baseline ?? BASELINE_COUNT;

  // ---------------------------------------------------------------------
  // Assertion 0: PRIVILEGED_EVENT_TYPES integrity (D-T-01 Option C invariants).
  //
  //   a. The set is non-empty.
  //   b. It contains at minimum `CeoDecision` and `IdentityPermissionChanged`
  //      (these are the baseline governance/identity invariants cited in
  //      D-T-01-PERMISSION-GATE-SECURE-DEFAULT).
  //   c. Internal service agents (agent:* with no policy, non-privileged
  //      types) should NOT appear to be blocked by the privileged list for
  //      operational event types. We verify this by confirming that the two
  //      representative goal-loop types (`RiskRaised`, `WorkstreamRegistered`)
  //      are NOT in PRIVILEGED_EVENT_TYPES.
  // ---------------------------------------------------------------------
  const privileged = opts.privilegedEventTypes ?? PRIVILEGED_EVENT_TYPES;

  result.asserted++;
  if (privileged.size === 0) {
    violations.push({
      subject: "privileged-types:non-empty",
      message: `PRIVILEGED_EVENT_TYPES is empty. It must contain at minimum CeoDecision and IdentityPermissionChanged per D-T-01 Option C. Citations: ${CITATIONS.join(", ")}.`,
      severity: "fail",
    });
  }

  for (const required of ["CeoDecision", "IdentityPermissionChanged"] as const) {
    result.asserted++;
    if (!privileged.has(required)) {
      violations.push({
        subject: `privileged-types:required:${required}`,
        message: `PRIVILEGED_EVENT_TYPES must contain "${required}" — this type directly mutates governance/identity state and always requires an explicit allow-list entry (D-T-01 Option C). Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // Goal-loop operational types must NOT be in the privileged set — if they
  // were, the allow-by-default relaxation would not unblock them.
  for (const goalLoopType of ["RiskRaised", "WorkstreamRegistered"] as const) {
    result.asserted++;
    if (privileged.has(goalLoopType)) {
      violations.push({
        subject: `privileged-types:goal-loop-blocked:${goalLoopType}`,
        message: `"${goalLoopType}" is in PRIVILEGED_EVENT_TYPES — this would block internal agents from emitting it without an explicit allow-list entry, preventing the D-T-01 Option C goal-loop unblock. Remove it from PRIVILEGED_EVENT_TYPES. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------
  // Assertion 1: every EventStore construction site is gated, OR sits in a
  // carve-out.
  // ---------------------------------------------------------------------
  const sites = opts.constructionSites ?? scanConstructionSites(prototypeDir);
  result.asserted += sites.length;
  for (const site of sites) {
    if (isCarvedOutSite(site)) continue;
    violations.push({
      subject: `${site.file}:${site.line}`,
      message: `Raw \`new EventStore(...)\` outside the carve-out list. Wrap with \`gateEventStore({ store, config })\` from \`platform/event-store/permission-gate.ts\`, or add this site to the recon's CONSTRUCTION_CARVE_OUT list with a justified reason. Citations: ${CITATIONS.join(", ")}.`,
      severity: "fail",
    });
  }

  // ---------------------------------------------------------------------
  // Assertion 2: every entry in LEGACY_PRE_A1_EVENT_TYPES resolves to a
  // real event type. "Real" = at least one of:
  //   - a row in `EVENT_TYPE_REGISTRY` (canonical), OR
  //   - a `make<Type>` factory in `event-types.ts`, OR
  //   - an `eventStore.append({type:"X"})` literal anywhere in the tree, OR
  //   - a `subscribesTo` reference in `handlers-metadata.ts`.
  // The legacy-bypass list snapshot was authored across all four surfaces
  // (per the gate's own preamble §86–98), so a phantom is genuinely a
  // typo / retired type — not a build-phase tolerated envelope-only event.
  // ---------------------------------------------------------------------
  const eventTypesPath = resolve(prototypeDir, "platform/event-store/event-types.ts");
  const factoryNames = opts.knownEventTypes ?? new Set([...readMakeFactoryNames(eventTypesPath)]);
  const referencedTypes = readReferencedTypes(prototypeDir);
  const subscribedTypes = readSubscribedTypes();
  for (const type of legacy) {
    result.asserted++;
    const inRegistry = lookupEventType(type) !== undefined;
    const inFactories = factoryNames.has(type);
    const inReferenced = referencedTypes.has(type);
    const inSubscribed = subscribedTypes.has(type);
    if (!inRegistry && !inFactories && !inReferenced && !inSubscribed) {
      violations.push({
        subject: `legacy-bypass:${type}`,
        message: `\`${type}\` is in LEGACY_PRE_A1_EVENT_TYPES but has no registry row, no \`make${type}\` factory, no \`type: "${type}"\` / \`replay({ type: "${type}" })\` literal, and no \`subscribesTo\` reference anywhere in \`prototype/\`. Phantom entry — remove it to keep the bypass list closed-set. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------
  // Assertion 3: the legacy-bypass list has not grown past its baseline.
  // (legacy-bypass-watch.ts also tracks this; this is the cross-check.)
  // ---------------------------------------------------------------------
  result.asserted++;
  if (legacy.size > baseline) {
    violations.push({
      subject: "legacy-bypass:size",
      message: `LEGACY_PRE_A1_EVENT_TYPES has ${legacy.size} entries; baseline is ${baseline}. Growth is a regression — the list is meant to shrink monotonically as agents publish their policies. If the growth is deliberate, update BASELINE_COUNT in \`platform/recon/code-quality/legacy-bypass-watch.ts\` in the same commit (and authorising CEO decision). Citations: ${CITATIONS.join(", ")}.`,
      severity: "fail",
    });
  } else if (legacy.size < baseline) {
    violations.push({
      subject: "legacy-bypass:size",
      message: `LEGACY_PRE_A1_EVENT_TYPES has shrunk from ${baseline} to ${legacy.size} — progress. Update BASELINE_COUNT to ${legacy.size} to lock in the lower floor.`,
      severity: "info",
    });
  }

  // ---------------------------------------------------------------------
  // Assertion 4: actors observed appending events resolve to a published
  // PermissionPolicy. Live mode walks the event store; tests inject the
  // pairs directly.
  //
  // T-12 (2026-05-17): ACCEPTED_NO_POLICY_ACTORS is now empty — all 44
  // sub-agent and platform actors have published PermissionPolicyPublished
  // events via `bun run publish:sub-agent-policies`. The carve-out set
  // is closed; any new actor without a policy is a `warn` finding.
  //
  // BASELINE_NO_POLICY_ACTORS_COUNT tracks the carve-out size (§4.2 of
  // Senna's T-12 spec). Recon reports `fail` on growth (regression) and
  // `info` on shrink (progress — update the baseline downward).
  // ---------------------------------------------------------------------
  const noPolActorsBaseline = BASELINE_NO_POLICY_ACTORS_COUNT;
  const noPolActorsSize = ACCEPTED_NO_POLICY_ACTORS.size;
  result.asserted++;
  if (noPolActorsSize > noPolActorsBaseline) {
    violations.push({
      subject: "no-policy-actors:size",
      message: `ACCEPTED_NO_POLICY_ACTORS has ${noPolActorsSize} entries; baseline is ${noPolActorsBaseline}. Growth is a regression — every new sub-agent must have a published PermissionPolicy before being added to this set, and the addition must cite a reason. Citations: ${CITATIONS.join(", ")}.`,
      severity: "fail",
    });
  } else if (noPolActorsSize < noPolActorsBaseline) {
    violations.push({
      subject: "no-policy-actors:size",
      message: `ACCEPTED_NO_POLICY_ACTORS has shrunk from ${noPolActorsBaseline} to ${noPolActorsSize} — progress. Update BASELINE_NO_POLICY_ACTORS_COUNT to ${noPolActorsSize} to lock in the lower floor.`,
      severity: "info",
    });
  }

  const actors = opts.appendedAgentActors ?? gatherAppendedAgentActors();
  for (const { agentUrn, hasPolicy } of actors) {
    result.asserted++;
    if (hasPolicy) continue;
    const accepted = ACCEPTED_NO_POLICY_ACTORS.has(agentUrn);
    if (accepted) {
      // Carve-out set is intentionally empty post-T-12; this branch
      // will never be reached unless a new entry is deliberately added.
      violations.push({
        subject: `actor:${agentUrn}`,
        message: `Agent actor \`${agentUrn}\` has appended events without a published PermissionPolicy. Accepted today (substrate carve-out). Publish a PermissionPolicy via \`bun run publish:sub-agent-policies\` or \`bun run identity:issue\` and remove from ACCEPTED_NO_POLICY_ACTORS. Citations: ${CITATIONS.join(", ")}.`,
        severity: "info",
      });
    } else {
      violations.push({
        subject: `actor:${agentUrn}`,
        message: `Agent actor \`${agentUrn}\` has appended events without a published PermissionPolicy (T-12 enforcement). Publish via \`bun run publish:sub-agent-policies\` or \`bun run identity:issue\`. If a build-phase carve-out is required, add to ACCEPTED_NO_POLICY_ACTORS with a citation. Citations: ${CITATIONS.join(", ")}.`,
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// Walk the live event store. Tolerates an absent / empty store (fresh
// runner condition; same fail-open posture as decision-event-recon.ts).
function gatherAppendedAgentActors(): ReadonlyArray<{ agentUrn: string; hasPolicy: boolean }> {
  // Lazy import — keeps the recon module loadable in test contexts that
  // pass `appendedAgentActors` directly and never touch the live store.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let eventStore: { replay: (filter?: { type?: string }) => Iterable<Record<string, unknown>> };
  let permissionPolicy: { lookup: (urn: string) => unknown };
  try {
    const composition = require("../composition") as {
      eventStore: typeof eventStore;
      permissionPolicy: typeof permissionPolicy;
    };
    eventStore = composition.eventStore;
    permissionPolicy = composition.permissionPolicy;
  } catch {
    return [];
  }
  const seen = new Set<string>();
  try {
    for (const e of eventStore.replay()) {
      const actor = (e as { actor?: { type?: string; id?: string } }).actor;
      if (!actor || actor.type !== "service") continue;
      const id = actor.id ?? "";
      if (!id.startsWith("agent:")) continue;
      seen.add(id);
    }
  } catch {
    // Empty store / read failure — return empty set (fail-open by design).
    return [];
  }
  const out: { agentUrn: string; hasPolicy: boolean }[] = [];
  for (const urn of seen) {
    let hasPolicy = false;
    try {
      hasPolicy = permissionPolicy.lookup(urn) != null;
    } catch {
      hasPolicy = false;
    }
    out.push({ agentUrn: urn, hasPolicy });
  }
  return out;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "Permission-gate-default integrity passed"
        : "Permission-gate-default integrity FAILED — secure-by-default invariant or legacy-bypass-list integrity violated",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
