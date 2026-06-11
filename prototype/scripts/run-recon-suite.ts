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
    "recon:urn-shape",
    "recon:aggregate-id-coverage",
    "recon:madge-circular-deps",
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
    "recon:counterparty-basel-classification-coverage",
    "recon:calc-no-silent-zero",
    "recon:pnl-attribution-reconciles",
    "recon:pnl-signoff-coverage",
    "recon:all-asset-pnl-ipv-coverage",
    "recon:expected-event-watchdog",
    "recon:clients-entityname-uniqueness",
    "recon:mandate-coverage",
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
    "recon:regulatory-golden-source-integrity",
    "recon:regulatory-source-coverage",
    "recon:regulatory-source-extract-quality",
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
