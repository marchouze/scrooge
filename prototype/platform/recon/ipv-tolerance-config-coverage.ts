// platform/recon/ipv-tolerance-config-coverage.ts
//
// Vera recon: assert that every traded canonical FX pair is resolvable
// against the IPV tolerance config — either by an explicit per-pair entry
// or by the default fallback.
//
// Coverage model (D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21):
//   1. Replay every `FxTradeExecuted` to enumerate canonical pairs traded
//      (via Bea's `toCanonicalPair` — same lookup the engine uses).
//   2. For each canonical pair, classify against
//      `DEFAULT_IPV_TOLERANCE_CONFIG`:
//        - HIT       → an explicit `pairs[]` row exists.
//        - DEFAULT   → no explicit row; falls through to defaults.
//   3. Surface:
//        - DEFAULT entries as **info** findings (these traded pairs are
//          covered, but a per-pair calibration may be desirable — Helena's
//          decision-card surface).
//        - Any pair that fails to canonicalise (degenerate identity, missing
//          base/quote) as a **fail** finding — engine would crash on it.
//   4. The default config invariant: `defaultBpsThreshold > 0`,
//      `defaultAbsoluteZarMinor > 0`, `cutoverDate` is a valid ISO date.
//      Violations are **fail** — engine cannot run otherwise.
//
// Empty-state correctness: zero `FxTradeExecuted` events → asserted=0 over
// the trading-pair set, plus the invariant check; pass.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 (CEO-approved 2026-05-21)
//   - brief:rohan:ipv-per-pair-tolerance-surface-and-shadow-mode-s:2026-05-21
//   - Principle 1 (event store is source of truth)
//
// Author: Rohan (Market risk engineer, engineering)

import { eventStore } from "../composition";
import { toCanonicalPair } from "../market-data/canonical-pair";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { DEFAULT_IPV_TOLERANCE_CONFIG, type IpvToleranceConfig } from "../markets/ipv-tolerance";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ipv-tolerance-config-coverage";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MinimalFxTradeExecutedEvent {
  readonly event_id: string;
  readonly payload: { currencyPair?: { base?: string; quote?: string } };
}

export interface RunOpts {
  /** Override the live FxTradeExecuted replay (test injection). */
  fxTradeExecutedEvents?: Iterable<MinimalFxTradeExecutedEvent>;
  /** Override the tolerance config under test (default: DEFAULT). */
  config?: IpvToleranceConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidIsoDate(s: string): boolean {
  // Accepts YYYY-MM-DD with a valid Date round-trip.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

function loadFxTradeExecutedEvents(opts: RunOpts): MinimalFxTradeExecutedEvent[] {
  if (opts.fxTradeExecutedEvents) return [...opts.fxTradeExecutedEvents];
  const out: MinimalFxTradeExecutedEvent[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    out.push({
      event_id: e.event_id,
      payload: { currencyPair: p.currencyPair },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Assert config invariants — required for the engine to even run.
 * Returns fail-severity violations on breach.
 */
export function assertConfigInvariants(config: IpvToleranceConfig): ReconViolation[] {
  const violations: ReconViolation[] = [];

  if (!(config.defaultBpsThreshold > 0)) {
    violations.push({
      subject: "config:defaultBpsThreshold",
      severity: "fail",
      message: `defaultBpsThreshold must be > 0 (got ${config.defaultBpsThreshold}). Engine would not breach on any divergence. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
    });
  }
  if (!(config.defaultAbsoluteZarMinor > 0)) {
    violations.push({
      subject: "config:defaultAbsoluteZarMinor",
      severity: "fail",
      message: `defaultAbsoluteZarMinor must be > 0 (got ${config.defaultAbsoluteZarMinor}). Engine ZAR-impact check would be useless. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
    });
  }
  if (!isValidIsoDate(config.cutoverDate)) {
    violations.push({
      subject: "config:cutoverDate",
      severity: "fail",
      message: `cutoverDate must be a YYYY-MM-DD ISO date (got "${config.cutoverDate}"). Required for shadow→live cutover scheduling. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
    });
  }
  // Each per-pair row must have a positive threshold.
  for (const row of config.pairs) {
    if (!(row.bpsThreshold > 0)) {
      violations.push({
        subject: `config:pairs:${row.canonicalPair}:bpsThreshold`,
        severity: "fail",
        message: `pair "${row.canonicalPair}" bpsThreshold must be > 0 (got ${row.bpsThreshold}). Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
      });
    }
    if (!(row.absoluteZarMinor > 0)) {
      violations.push({
        subject: `config:pairs:${row.canonicalPair}:absoluteZarMinor`,
        severity: "fail",
        message: `pair "${row.canonicalPair}" absoluteZarMinor must be > 0 (got ${row.absoluteZarMinor}). Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
      });
    }
  }
  // Per-pair rows must not duplicate canonical keys.
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const row of config.pairs) {
    if (seen.has(row.canonicalPair)) dup.add(row.canonicalPair);
    seen.add(row.canonicalPair);
  }
  for (const k of dup) {
    violations.push({
      subject: `config:pairs:${k}:duplicate`,
      severity: "fail",
      message: `pair "${k}" appears more than once in pairs[]. The first row would win silently; remove duplicates. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
    });
  }
  return violations;
}

/**
 * Classify each traded canonical pair against the config.
 *   - per-pair hit       → no finding.
 *   - default fallback   → info finding (calibration candidate).
 *   - canonicalise error → fail finding (engine would crash).
 */
export function assertTradedPairsCoverage(
  events: ReadonlyArray<MinimalFxTradeExecutedEvent>,
  config: IpvToleranceConfig,
): { violations: ReconViolation[]; asserted: number } {
  const violations: ReconViolation[] = [];
  const explicit = new Set(config.pairs.map((p) => p.canonicalPair));
  const seenPairs = new Set<string>();
  const reportedDefault = new Set<string>();

  for (const e of events) {
    const cp = e.payload.currencyPair;
    if (!cp || !cp.base || !cp.quote) {
      violations.push({
        subject: `FxTradeExecuted:${e.event_id}:currencyPair`,
        severity: "fail",
        message: `FxTradeExecuted event ${e.event_id} has missing base/quote — IPV engine cannot resolve a tolerance row. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
      });
      continue;
    }
    let canonicalKey: string;
    try {
      canonicalKey = toCanonicalPair(cp.base, cp.quote).pairKey;
    } catch (err) {
      violations.push({
        subject: `FxTradeExecuted:${e.event_id}:canonicalise`,
        severity: "fail",
        message: `toCanonicalPair("${cp.base}", "${cp.quote}") failed: ${(err as Error).message}. IPV engine cannot resolve a tolerance row. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
      });
      continue;
    }
    seenPairs.add(canonicalKey);
    if (!explicit.has(canonicalKey) && !reportedDefault.has(canonicalKey)) {
      reportedDefault.add(canonicalKey);
      violations.push({
        subject: `traded-pair:${canonicalKey}:default-fallback`,
        severity: "info",
        message: `canonical pair "${canonicalKey}" is traded but has no explicit per-pair tolerance row — it currently uses the default (${(config.defaultBpsThreshold * 100).toFixed(2)}% / ZAR ${(config.defaultAbsoluteZarMinor / 100).toLocaleString("en-ZA")}). Calibration candidate. Authority: D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21.`,
      });
    }
  }
  // assertedCount = distinct canonical pairs encountered.
  return { violations, asserted: seenPairs.size };
}

// ---------------------------------------------------------------------------
// Pipeline entry
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const config = opts.config ?? DEFAULT_IPV_TOLERANCE_CONFIG;
  const result = emptyResult(PIPELINE);

  // 1. Config invariants — engine cannot run without these.
  const invariantViolations = assertConfigInvariants(config);
  // One assertion per invariant check + per-pair row.
  result.asserted += 3 + config.pairs.length * 2 + 1; // defaults×3 + per-pair×2 + dup

  // 2. Traded-pair coverage.
  const events = loadFxTradeExecutedEvents(opts);
  const coverage = assertTradedPairsCoverage(events, config);
  result.asserted += coverage.asserted;

  result.violations = [...invariantViolations, ...coverage.violations];
  // `ok` reflects only fail-severity violations; info findings do not fail CI.
  result.ok = result.violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  const infoCount = r.violations.filter((v) => v.severity === "info").length;
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      info: infoCount,
      ok: r.ok,
      msg: r.ok
        ? `ipv-tolerance-config-coverage passed — config invariants hold; every traded canonical pair resolves (${infoCount} info findings on default-fallback pairs).`
        : `ipv-tolerance-config-coverage FAILED — ${failCount} fail-severity violation(s).`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
