// scripts/run-recon-suite.ts
//
// Run-all-then-aggregate runner for the recon CI suites.
//
// WHY THIS EXISTS
// ---------------
// `ci:recon:infra` and `ci:recon:domain` were single `&&` chains of
// `bun run recon:*` pipelines. The `&&` short-circuit meant the FIRST
// failing pipeline aborted every downstream pipeline. One of the infra
// pipelines — `recon:event-store-append-only` — fails LOCALLY ONLY on the
// pre-existing home-store archive-partition sequence gap
// (`~/.local/share/bank/event.db`; see `D-EVENT-STORE-SCALING-PHASE-5`).
// On a clean-store GitHub CI runner that pipeline passes, so the downstream
// gates (e.g. `recon:wall-clock-callsite-coverage`) ran on CI but never ran
// locally. On 2026-06-09 that masked two genuine wall-clock ratchet
// violations → three rounds of CI churn (PRs #1138 / #1140 / #1141).
//
// This runner runs EVERY named target regardless of individual failures,
// collects each exit code + a short failure summary, prints an aggregated
// report, and exits non-zero iff ANY target failed. So a locally-run
// `bun run ci` now surfaces the SAME failure set GitHub CI would — the
// env-only `event-store-append-only` failure no longer hides downstream
// real failures.
//
// NOTE: this runner deliberately does NOT paper over the underlying env
// gap. The home-store archive-partition gap is a separate pre-existing
// item tracked as `D-EVENT-STORE-SCALING-PHASE-5`. This runner only stops
// that (and any other env-sensitive early gate) from hiding downstream
// real failures.
//
// USAGE
// -----
//   bun run scripts/run-recon-suite.ts <suite-name>
//   bun run scripts/run-recon-suite.ts --targets recon:foo,recon:bar
//
// where <suite-name> ∈ keys of RECON_SUITES. `package.json` wires
// `ci:recon:infra` and `ci:recon:domain` to the named suites, so the
// ordered pipeline list for each suite lives here as a single source of
// truth (no duplication across package.json).
//
// Author: Atlas (Core banking platform architect)

import { spawnSync } from "node:child_process";

/**
 * The single source of truth for each CI recon suite's pipeline list.
 * Each entry is a `package.json` script name (`recon` or `recon:*`) run via
 * `bun run <name>`. Order is preserved from the legacy `&&` chains — this is
 * a control-flow change, not a coverage change.
 */
export const RECON_SUITES: Record<string, readonly string[]> = {
  infra: [
    "recon",
    "recon:runtime-handler-sync",
    "recon:posting-engine-single-subscriber",
    // WS-V2-BBAAS — SA-CCR alias-flip single-emitter gate (CCR events of record).
    "recon:ccr-single-emitter",
    "recon:dispatch-sync-integrity",
    "recon:parallel-dispatch-divergence",
    "recon:rms-event-projection-parity",
    "recon:rms-briefs-parity",
    "recon:rms-documents-parity",
    "recon:rms-document-blob-integrity",
    "recon:cron-map-drift",
    "recon:agent-spec",
    "recon:agent-spec-cross-link",
    "recon:trigger-spec-handler-symmetry",
    "recon:event-store-append-only",
    "recon:event-store-no-delete-callsite",
    // D-MONEY-DECIMAL-REDENOMINATION — decimal-money cutover gates.
    // On a fresh config-only store: trivially green (no transactional events).
    // On a populated build-phase store: advisory audit lens (no FAIL-severity).
    // recon:no-legacy-le-identity is FAIL-severity (enforcement).
    // recon:no-residual-minor-encoding is FAIL-severity (enforcement).
    // Authority: D-MONEY-DECIMAL-BUILD-PROCEED; D-MONEY-DECIMAL-REDENOMINATION;
    //            D-LEGAL-ENTITY-NAME-HOZ-BANK.
    "recon:no-transactional-sim-events",
    "recon:no-legacy-le-identity",
    "recon:no-residual-minor-encoding",
    // WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 1 — CI-visibility companion for
    // the residual-minor gate. `recon:no-residual-minor-encoding` above runs
    // against the fresh config-only CI store (no transactional *Minor events),
    // so it is trivially green and could NOT have caught the slice-4 purge
    // regression (496 transactional events / 6,212 *Minor violations survived).
    // This companion builds an EPHEMERAL tmpdir store seeded with a legacy
    // *Minor event + a clean MoneyWire event and asserts the gate FAILS on the
    // former and not the latter — making the gate load-bearing in CI regardless
    // of the ambient store. Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION.
    "recon:no-residual-minor-encoding-fixture",
    // recon:sub-ledger-leg-decimal-parity RETIRED — DROP complete per
    // D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3. SubLedgerLeg.amountMinor
    // removed from schema; the parity check is vacuously satisfied by type.
    "recon:urn-shape",
    "recon:aggregate-id-coverage",
    "recon:madge-circular-deps",
    "recon:v2-no-v1-import",
    "recon:v2-tenant-axis-present",
    "recon:v2-released-surface-clean-core",
    // WS-V2-BBAAS S16 — tier-entitlement coherence (ENFORCING): the K/R/C
    // flat-tier entitlement table stays coherent with the S5 released-surface
    // boundary — surfaceScope==tier, every capability resolves + is within
    // scope, C ⊆ R ⊆ K, flat-tier marker + no price field, anchor==K, and the
    // C-tier go-live preconditions (incl. tested second-provider fallback) are
    // present + gate go-live. The synthetic over-grant (C entitling a K-only
    // export) is caught sabotage-proof in the regression test. Authority:
    // D-V2-WAVE4-COMMERCIAL-POSTURE; D-V2-BBAAS-TIER-STRUCTURE.
    "recon:v2-tier-entitlement-coherence",
    "recon:v2-posture-register-integrity",
    // WS-V2-BBAAS S13 — eval-harness integrity (advisory). Every EvalRunCompleted
    // references a registered exam-set; exam-sets well-formed; recorded verdicts
    // reproducible by re-running the harness (engine-consistency). Authority:
    // D-W4-MODEL-LIBRARY-PILOT; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
    "recon:v2-eval-harness-integrity",
    // WS-V2-BBAAS S8 — applicability-assessment lifecycle integrity (advisory).
    "recon:v2-applicability-assessment-integrity",
    // WS-V2-BBAAS S9 — decision-impact sweep coverage (ENFORCING as of the W8
    // auto-trigger landing). Every approved Decision since the baseline MUST
    // carry a sweep (assertion 4 = fail); orphan impacts + recommendedActions
    // well-formedness asserted. The auto-trigger
    // (runtime/agents/owen-decision-impact-sweep.ts) sweeps every approved
    // Decision forward; the merge window was backfilled. Authority:
    // D-W8-DECISION-IMPACT-SWEEP.
    "recon:v2-decision-impact-sweep-coverage",
    // WS-V2-BBAAS W8 Slice D — context-pack freshness (advisory). For each
    // seat with postures, asserts a ContextPackBuilt event exists within the
    // last 30 days. Advisory: never fails CI; surfaces warn-severity findings.
    // Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE.
    "recon:context-pack-freshness",
    // WS-V2-BBAAS S1 — control-plane tenant registry (advisory in S1).
    "recon:v2-control-plane-tenant-registry",
    // WS-V2-BBAAS S14 — operational fleet integrity (advisory→enforcing): every
    // tenant has tier + surface grant; metering windows well-formed; upgrade
    // ledger consistent (no version regressions, connected chain).
    "recon:v2-fleet-integrity",
    // WS-V2-BBAAS S11 — tenant-scoped functional-seat roster parity (advisory→
    // enforcing): every anchor persona maps to exactly one anchor seat; seat
    // role/type/reportsTo/occupant consistent with Team/_team-roster.json
    // (the roster is the source — drift is a finding); no orphan seats. The
    // deterministic core is enforced sabotage-proof in the v2-core test.
    // Authority: D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-functional-seat-roster-parity",
    // WS-V2-BBAAS S6 — composition-factory seam (advisory): alias resolves +
    // no v2-core module bypasses the factory alias.
    "recon:v2-composition-factory",
    // WS-V2-BBAAS — shared FIL alias-registry conformance: every swappable
    // v2-core seam resolves through the one shared registry; no ad-hoc per-seam
    // singleton. Authority: D-FIL-SHARED-ALIAS-REGISTRY.
    "recon:v2-alias-registry-conformance",
    // WS-V2-BBAAS S10 — tenant-axis ENFORCEMENT (the S2 dark→enforced flip):
    // scoped reads isolate (synthetic cross-tenant-bleed case caught, non-vacuous),
    // routing fails closed on unknown tenant, no cross-tenant write. ENFORCING.
    // Authority: D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-tenant-isolation",
    // WS-V2-BBAAS S12 — cross-tenant CSI gate (competition-law keystone, ENFORCING).
    // No cross-tenant learning flow bypasses the CSI gate; the synthetic
    // tenant-A-position → tenant-B-posture leak is CAUGHT (sabotage-proof,
    // non-vacuous). D-W7 C-tier / multi-tenant-learning go-live precondition.
    // Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-csi-cross-tenant-gate",
    // WS-V2-BBAAS A1 — FIL attribution kernel gates (design spec §5.2). Pass
    // vacuously over the live store until A2+ binds metrics; non-vacuous on
    // fixtures (they CAN fail). attribution-additivity: children-sum == joint
    // recompute for additive metrics. attribution-nonadditive-no-sum: a
    // joint-recompute metric (VaR/ES) can NEVER be summed from child results
    // (static: no `add` member; runtime: assertNoSum + sumChildren throw).
    // Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL.
    "recon:attribution-additivity",
    "recon:attribution-nonadditive-no-sum",
    // WS-V2-BBAAS A3 — the NON-ADDITIVE proof. attribution-var-diversification:
    // the VaR `joint-recompute` AttributionMetric re-computes at each node; over
    // the LIVE standing-NOP book it proves (a) no-sum on the REAL metric, (b)
    // group VaR < Σ desk VaRs (diversification), (c) group VaR == v1 standing-NOP
    // VaR (read-only parity), (d) additive FX P&L still rolls up group == Σ desk.
    // Flat/historyless book downgrades (b)/(c) to info. v1 untouched.
    // Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3); D-VAR-EXPOSURE-INCLUDES-STANDING-NOP.
    "recon:attribution-var-diversification",
    // WS-V2-BBAAS S15 — tenant onboarding-readiness (ENFORCING). Every registered
    // tenant is `ready` ONLY when every provisioning step landed (S1 register +
    // S11 seats + S5 surface grant + S14 fleet state) AND its tier preconditions
    // are met — a C-tier tenant cannot be ready while the S16 C-go-live
    // preconditions (tested second-provider fallback, cross-tenant CSI gate) are
    // unsatisfied (selling gated). The platform can REFUSE incomplete onboarding;
    // the synthetic half-provisioned tenant is caught sabotage-proof in the
    // v2-core regression test. The anchor (K) is already-onboarded and passes
    // without re-provisioning. Authority: D-V2-WAVE4-COMMERCIAL-POSTURE;
    // D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-onboarding-readiness",
    // A2 FX Valuable FIL-Model gates. fx-settlement-continuity: value_pre ==
    // value_post on settlement (structural — value() is lifecycle-free).
    // fx-book-nop-parity: the book:fx-trading slice value reconciles to the
    // shared standing-NOP fold (deriveNetFxPositionByCurrency), read-only /
    // parallel to v1. Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2).
    "recon:fx-settlement-continuity",
    "recon:fx-book-nop-parity",
    // WS-MULTI-BASE-CURRENCY (D-MULTI-BASE-CURRENCY-FOUNDATION) — ENFORCING,
    // harden-only. Asserts no literal reporting/base currency in the V2 FX
    // valuation path; the reporting currency must resolve from the holding
    // entity's functional currency. Expected 0 violations (debt removed in PR).
    "recon:no-hardcoded-reporting-currency",
    "recon:dashboard",
    "recon:wall-clock-callsite-coverage",
    "recon:decisions-events-only",
    "recon:decision-id-hygiene",
    "recon:decision-authority-routing",
    "recon:decision-authority-coverage",
    "recon:zod-schema-coverage",
    "recon:event-type-registry-coverage",
    "recon:golden-source-hardcoded-maps",
    "recon:server-version-vs-head",
    // Engineering Charter — "no-shortcuts" gates (D-ENGINEERING-INTEGRITY-CHARTER,
    // CEO-approved 2026-06-14). Harden-only ratchets that make the most common
    // coding shortcuts fail CI: type-checker suppression (#6), skipped/narrowed
    // tests (#3), swallowed errors (#6), and untracked deferrals (#1, #5).
    // ratchet-hardening-only is the advisory meta-gate guarding the ratchets
    // themselves (#3) — warns, never fails, during its soak phase.
    "recon:no-ts-suppression",
    "recon:no-skipped-tests",
    "recon:no-swallowed-errors",
    "recon:tracked-todo",
    "recon:ratchet-hardening-only",
    // WS-DECIMAL-NATIVE-MONEY-ARITHMETIC step 4 — advisory gate (allowlist applied,
    // exits 0 today). Blocks only NEW float-money arithmetic expressions added
    // outside the decimal-engine module. The allowlist shrinks as each engine
    // file migrates to decimal-native. Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC.
    "recon:no-float-money-arithmetic",
    // D-V1-REMOVAL-PHASE-1 / D-V1-REMOVAL-PHASE-2 — V1→V2 cutover ledger + parity harness.
    // v2status-coverage: every event type must carry a v2Status field
    //   (ENFORCING — exits 1 if any entry lacks the field).
    // v1-removal-ratchet: v1-only count may not increase vs baseline
    //   (ENFORCING, HARDEN-ONLY — exits 1 if count > baseline).
    // v1-only-count-trend: advisory trend summary line; always exits 0.
    // fx-v2-parity: FX domain parity proof (ENFORCING in Phase 2;
    //   FLIP BLOCKED — see gate output for gap-closure requirements:
    //   Gap A2: daily-pnl.ts must migrate to FIL instance reads (A4);
    //   Gap A3: makeVarMetric must emit a typed production event).
    //   Fails CI intentionally until both gaps are resolved and the flip
    //   approved by CEO Decision. Authority: D-V1-REMOVAL-PHASE-2.
    "recon:v1-removal-v2status-coverage",
    "recon:v1-removal-ratchet",
    "recon:v1-only-count-trend",
    "recon:fx-v2-parity",
    // D-V1-REMOVAL-PHASE-3A — V2 GL posting engine parity gate (advisory).
    // Compares V1 SubLedgerPostingEmitted trial balance with V2 GlPostingEmitted
    // trial balance. Advisory (ok: true even with warn violations) until V2 covers
    // all 42 posting rules. V1-only accounts produce expected warn violations;
    // V2-only accounts (if any) or amount mismatches on common accounts fail.
    "recon:gl-v2-parity",
    // D-V1-REMOVAL-PHASE-3B — V2 money-market LCR-denominator parity gate (advisory).
    // Compares the BA-300 LCR net-cash-outflow denominator from the V1 ALM snapshot
    // against the same denominator folded from the V2-parallel money-market
    // lifecycle events. Advisory (ok: true with warn) until the V2 path is
    // authoritative. Authority: D-V1-REMOVAL-PHASE-3B.
    "recon:ba300-v2-parity",
    // D-V1-REMOVAL-PHASE-3C — V2 bond GL parity gate (advisory). Compares the
    // bond GL trial-balance entries from the V1 bond lifecycle events against the
    // same entries folded from the V2-parallel bond lifecycle events, per bond
    // account. Advisory (ok: true with warn) until the V2 bond path is
    // authoritative. Authority: D-V1-REMOVAL-PHASE-3C.
    "recon:bond-gl-v2-parity",
  ],
  domain: [
    "recon:prose-duplication",
    "recon:decision-recommendation",
    "recon:retention-citation-coverage",
    "recon:provenance-tag-coverage",
    "recon:provenance-lineage-registered",
    "recon:test-lineage-not-in-production",
    "recon:provenance-badge-coverage",
    "recon:operating-book-selector-coverage",
    "recon:category-policy-coverage",
    "recon:provenance-emit-discipline",
    "recon:ras-b2-calibration-coverage",
    "recon:ras-cluster-feeder-coverage",
    "recon:ras-b7-model-tier-discipline-coverage",
    "recon:liquidity-appetite-snapshot-coverage",
    "recon:ras-b6-cyber-severity-coverage",
    "recon:ras-register-parity",
    "recon:var-nop-exposure-parity",
    // D-V1-REMOVAL-PHASE2-GAP-A3 — V2 VaR parity gate (advisory).
    // Compares V1 MarketRiskMeasureComputed figures vs V2 MarketRiskVarComputed
    // figures within 1 ZAR minor-unit tolerance. Advisory until CEO-approved flip.
    "recon:var-v2-parity",
    "recon:fx-gateway-threshold-enforcement",
    "recon:permission-gate-default",
    "recon:permission-policy-coverage",
    "recon:decision-required-event-pairing",
    "recon:agent-snapshot-staleness",
    "recon:goal-loop-capability",
    "recon:goal-loop-run-lifecycle",
    "recon:risk-taxonomy-coverage",
    "recon:decision-record-event-symmetry",
    "recon:document-registration",
    "recon:fsca-reg-to-policy",
    "recon:graph-ontology",
    "recon:orphan-capability",
    "recon:completeness:inert-module-detection",
    "recon:dcam-taxonomy-coverage",
    "recon:semantic-registry-coverage",
    "recon:decision-symmetry",
    "recon:conduct-surveillance-coverage",
    "recon:counterparty-exposure-coverage",
    "recon:market-data-provenance-gate",
    "recon:credit-limit-no-trade-without-loaded",
    "recon:credit-limit-annual-review-staleness",
    "recon:lex-cap-utilisation",
    "recon:credit-limit-breach-unescalated",
    "recon:risk-register-closure",
    "recon:liquidity-limit-breach-unescalated",
    "recon:liquidity-limit-coverage",
    "recon:cfp-trigger-coverage",
    "recon:position-revalued-cites-mark",
    "recon:mtm-reversal-paired-with-reval",
    "recon:no-prop-attribution",
    "recon:persona-attribution-coherence",
    "recon:policy-next-review",
    "recon:gl-ledger-coverage",
    "recon:fx-lifecycle-parity",
    "recon:trade-lifecycle-parity",
    "recon:fx-pair-direction",
    "recon:fx-pair-canonical-aggregation",
    "recon:fx-quoting-convention",
    "recon:fx-rate-magnitude",
    "recon:entity-identity-coherence",
    "recon:procedure-event-name-coherence",
    "recon:regulatory-extraction-coverage",
    "recon:provision-tick-drift",
    "recon:decision-distillation-coverage",
    "recon:fil-conformance",
    // WS-V2-BBAAS S7-FIL — SA-CCR FIL-Model ↔ v1 engine byte-equivalence gate.
    "recon:v2-saccr-parity",
    "recon:period-close-cursor-integrity",
    "recon:ba310-submission-completeness",
    "recon:ba-returns-vs-gl-balances",
    "recon:mtm-vs-gl-amount-delta",
    "recon:liquidity-position-vs-settled-notional",
    "recon:posting-rule-stub-audit",
    "recon:golden-source-decisions",
    "recon:golden-source-schema",
    "recon:golden-source-stale-pages",
    "recon:npa-gate",
    "recon:product-approval-attestation-integrity",
    "recon:model-risk-gap-inventory",
    "recon:calc-model-binding",
    "recon:seed-manifest-parity",
    "recon:financial-constants-coverage",
    "recon:basel-constants-coverage",
    "recon:extraction-provenance",
    "recon:obligations-seed-parity",
    "recon:obligation-urn-coverage",
    "recon:obligation-divergence",
    "recon:regulator-mandate-coverage",
    "recon:requirement-objective-linkage",
    "recon:objective-policy-alignment",
    "recon:obligation-policy-coverage",
    "recon:npa-coverage",
    "recon:npa-deferred-gap-tracking",
    // D-NPA-POST-APPROVAL-FINDING-REVIEW (CEO-approved 2026-06-15): every
    // ProductPostApprovalFinding must have a ProductDimensionRetrospectiveReview
    // within SLA. BLOCKING. No licence-day deferral.
    "recon:npa-post-approval-finding-review",
    "recon:dsar-sla",
    "recon:counterparty-basel-classification-coverage",
    "recon:calc-no-silent-zero",
    "recon:pnl-attribution-reconciles",
    "recon:pnl-signoff-coverage",
    "recon:all-asset-pnl-ipv-coverage",
    "recon:expected-event-watchdog",
    "recon:clients-entityname-uniqueness",
    "recon:mandate-coverage",
    // D-DOMAIN-OWNERSHIP-MAP — Agent⟺Domain⟺Obligation ownership coherence
    // (advisory; C1 obligation→domain, C2 domain→seat→agent, C3 every top-level
    // domain owned, C4 owner alignment). Flips enforcing after Slice-3 remediation.
    "recon:domain-ownership-coherence",
    "recon:procedure-actor",
    "recon:compliance-obligation-tracing",
    "recon:posting-source-id-canonical",
    "recon:odp-portfolio-recon-dispute-staleness",
    "recon:odp-collateral-segregation-breach-staleness",
    "recon:odp-repo-recon-dispute-staleness",
    "recon:coa-name-no-currency",
    "recon:fx-supported-currency-no-suspense",
    "recon:account-designated-currency",
    "recon:valuation-adjustment-additive",
    "recon:orphan-open-runs",
    "recon:orphan-run-deliverable-state",
    "recon:sla-codegen-drift",
    "recon:sla-rule-versioning",
    "recon:sla-approval-workflow",
    "recon:ba-form-numbering",
    "recon:ba320-ir-general-weighting-basis",
    "recon:rwa-computed-sourcing",
    "recon:fx-subledger-reconciliation",
    "recon:escalation-surface-parity",
    // Shared-store assertion, NOT a clean-CI gate. On a clean runner the
    // regulatory graph is unseeded and the in-repo store has no blobs, so it
    // asserts zero nodes → ok:true (intentional; pinned by
    // regulatory-golden-source-integrity-empty-graph.test.ts). The REAL
    // dangling-hash assertion runs off-pipeline on the populated shared store
    // via the scheduled tick (recon:golden-source-integrity-tick, launchd
    // com.scrooge.golden-source-integrity-tick), which escalates any missing
    // blob as SubstrateAlert{alertClass:"integrity"}.
    // Authority: D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (CEO-approved 2026-06-13).
    "recon:regulatory-golden-source-integrity",
    "recon:regulatory-source-coverage",
    "recon:regulatory-source-extract-quality",
    // WS-REGULATORY-REVIEW-MARKER (Phase 1) — review-marker freshness (advisory).
    // For each acquired direct/transposed instrument, warn if it has never been
    // reviewed or its review is stale (source re-acquired since). Advisory:
    // never fails CI; surfaces warn-severity findings.
    "recon:regulatory-review-freshness",
    // WS-V2-BBAAS S4 — advisory gate: v2 anchor store standing-data seed parity.
    // ok=true (advisory) unless store is absent; CI never fails on this alone.
    // Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
    "recon:v2-standing-data-seed-parity",
    // WS-V2-BBAAS S10 — advisory gate: anchor migration rehearsal parity
    // (scratch-only). Asserts byte-equivalence + projection parity of a
    // scratch-migrated per-tenant store vs the source, and that the live store
    // was never written. Advisory — the live cutover is a separate gated
    // decision. Authority: D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-anchor-migration-rehearsal",
  ],
};

export interface ReconTargetResult {
  readonly target: string;
  readonly exitCode: number;
  readonly passed: boolean;
  /** Short, single-line failure summary (last non-empty stderr/stdout line). */
  readonly summary: string;
}

export interface ReconSuiteReport {
  readonly results: readonly ReconTargetResult[];
  readonly passedCount: number;
  readonly failedCount: number;
  readonly failedTargets: readonly string[];
  /** True iff every target passed. */
  readonly ok: boolean;
}

/**
 * Runs a single `bun run <target>` synchronously and captures its outcome.
 * Output is streamed live to the parent's stdout/stderr so individual
 * pipeline detail is still visible, AND captured so we can extract a short
 * failure summary line for the aggregated report.
 */
function runTarget(
  target: string,
  runner: (target: string) => { status: number | null; tail: string } = defaultRunner,
): ReconTargetResult {
  const { status, tail } = runner(target);
  const exitCode = status ?? 1;
  const passed = exitCode === 0;
  return {
    target,
    exitCode,
    passed,
    summary: passed ? "" : tail || `exited ${exitCode}`,
  };
}

function defaultRunner(target: string): { status: number | null; tail: string } {
  // stdout streams straight through (inherit) so per-pipeline detail is
  // preserved in CI logs WITHOUT buffering it in memory — some pipelines
  // emit >1MB of diagnostics, and buffering all of that across a 100-step
  // suite triggered OOM/SIGTERM reaps locally. Only stderr is captured,
  // and only its tail is used for the one-line failure summary.
  const proc = spawnSync("bun", ["run", target], {
    encoding: "utf8",
    stdio: ["inherit", "inherit", "pipe"],
  });
  const stderr = proc.stderr ?? "";
  if (stderr) process.stderr.write(stderr);
  const lastLine =
    stderr
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .pop() ?? "";
  return { status: proc.status, tail: lastLine };
}

/**
 * Runs every target in `targets` regardless of individual failures, then
 * returns an aggregated report. Pure orchestration — the per-target runner
 * is injectable so tests can drive it without spawning subprocesses.
 */
export function runReconSuite(
  targets: readonly string[],
  runner?: (target: string) => { status: number | null; tail: string },
): ReconSuiteReport {
  const results: ReconTargetResult[] = [];
  for (const target of targets) {
    results.push(runTarget(target, runner));
  }
  const failed = results.filter((r) => !r.passed);
  return {
    results,
    passedCount: results.length - failed.length,
    failedCount: failed.length,
    failedTargets: failed.map((r) => r.target),
    ok: failed.length === 0,
  };
}

/** Renders the aggregated report as a multi-line string. */
export function formatReport(report: ReconSuiteReport, suiteLabel: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`── recon suite [${suiteLabel}] aggregate report ──`);
  if (report.ok) {
    lines.push(`✅ ${report.passedCount} passed, 0 failed.`);
  } else {
    lines.push(
      `❌ ${report.passedCount} passed, ${report.failedCount} failed: [${report.failedTargets.join(", ")}]`,
    );
    for (const r of report.results) {
      if (!r.passed) {
        lines.push(`   • ${r.target} (exit ${r.exitCode}): ${r.summary}`);
      }
    }
  }
  return lines.join("\n");
}

/** Resolves CLI args to (label, targets). */
export function resolveTargets(argv: readonly string[]): {
  label: string;
  targets: readonly string[];
} {
  const targetsFlagIdx = argv.indexOf("--targets");
  if (targetsFlagIdx !== -1) {
    const raw = argv[targetsFlagIdx + 1];
    if (!raw) {
      throw new Error("--targets requires a comma-separated list of recon target names");
    }
    const targets = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return { label: "ad-hoc", targets };
  }
  const suiteName = argv[0];
  if (!suiteName) {
    throw new Error(
      `usage: run-recon-suite <suite-name|--targets a,b,c>; known suites: ${Object.keys(RECON_SUITES).join(", ")}`,
    );
  }
  const suite = RECON_SUITES[suiteName];
  if (!suite) {
    throw new Error(
      `unknown recon suite "${suiteName}"; known suites: ${Object.keys(RECON_SUITES).join(", ")}`,
    );
  }
  return { label: suiteName, targets: suite };
}

if (import.meta.main) {
  const { label, targets } = resolveTargets(process.argv.slice(2));
  const report = runReconSuite(targets);
  process.stdout.write(`${formatReport(report, label)}\n`);
  process.exit(report.ok ? 0 : 1);
}
