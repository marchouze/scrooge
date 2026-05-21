// platform/recon/liquidity-limit-coverage.ts
//
// Vera continuous-controls pipeline: assert that every RAS B3-family
// liquidity-appetite line has at least one configured tier in the engine's
// `DEFAULT_LIMIT_CONFIGS`. Missing coverage is a Principle 2 (single-
// graph discipline) violation — a policy line with no engine projection
// is an orphan.
//
// Specifically, the recon asserts:
//
//   1. Each required RAS B3-family line (LCR, NSFR, intraday, the four
//      concentration lines, HQLA concentration) has a `LiquidityLimit-
//      Config` row with at least one tier in `DEFAULT_LIMIT_CONFIGS`.
//
//   2. Every line that emits at least one `LiquidityLimitBreached` event
//      in the event-store history is also covered (defensive recon —
//      catches the case where a downstream code path emits for a `line`
//      enum that someone forgot to wire into the config table).
//
// Failure path:
//   - Missing-tier coverage for a required line → Vera Critical finding
//     (Principle 2 — no orphan policy line; LRM Policy v1 §9.1 typed
//     event patterns must each have an engine projection).
//
// Empty-state correctness: shipping configs cover all required lines →
// `ok: true, asserted: K`.
//
// Standing authority: D-RAS; LRM Policy v1; brief:ravi:liquidity-limit-
//   engine-mirroring-credit-limit-en:2026-05-21.
//
// Citations:
//   Policies/liquidity-risk-management-policy-v1.md §9.1 + §9.2;
//   Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B3;
//   Procedures/by-policy/liquidity-limit-management.md §5.1 + §9;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer, third-line — functionally to
//   Thandiwe (Chief Audit Executive, governance); administratively
//   through the CEO).

import { eventStore } from "../composition";
import { DEFAULT_LIMIT_CONFIGS } from "../risk/liquidity-limit-engine";
import type { LiquidityLimitConfig } from "../risk/liquidity-limit-engine/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "liquidity-limit-coverage";

/**
 * The RAS B3-family lines that MUST have at least one tier configured in
 * the engine. Sourced from LRM Policy v1 §9.1 typed event patterns +
 * Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B3.
 *
 * Note: `contingent-liquidity` is omitted from the required set — it is
 * a reserved engine line with calibration deferred to Eitan's CFP-trigger
 * framework (LRM Policy §5; substrate gap captured in PROC-RISK-LLM-01
 * §10). Once the CFP slice lands, this list extends.
 */
const REQUIRED_LINES = [
  "lcr-ratio",
  "nsfr-ratio",
  "intraday-liquidity-buffer",
  "funding-concentration-counterparty",
  "funding-concentration-depositor",
  "funding-concentration-tenor",
  "hqla-concentration",
] as const;

interface MinimalEvent {
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

export interface RunOpts {
  /** Override the engine configs — used by tests. */
  configs?: readonly LiquidityLimitConfig[];
  /** Override the breach-event source — used by tests. */
  breachEvents?: Iterable<MinimalEvent>;
}

function loadEvents(type: string, override: Iterable<MinimalEvent> | undefined): MinimalEvent[] {
  if (override) return [...override];
  const out: MinimalEvent[] = [];
  try {
    for (const e of eventStore.replay({ type })) {
      out.push({
        type: e.type,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
    }
  } catch {
    // ignore
  }
  return out;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const configs = opts.configs ?? DEFAULT_LIMIT_CONFIGS;

  const coveredLines = new Set<string>(configs.map((c) => c.line));

  // -------------------------------------------------------------------------
  // Assertion 1: every required line has at least one tier configured.
  // -------------------------------------------------------------------------
  for (const line of REQUIRED_LINES) {
    result.asserted++;
    if (!coveredLines.has(line)) {
      violations.push({
        subject: `line:${line}`,
        severity: "fail",
        message: `MISSING COVERAGE: required RAS B3-family liquidity line "${line}" has no configured tier in DEFAULT_LIMIT_CONFIGS. Principle 2 violation — a policy line without an engine projection is an orphan. Required: at least one row in DEFAULT_LIMIT_CONFIGS with line="${line}". Authority: D-RAS; LRM Policy v1 §9.1; Procedures/by-policy/liquidity-limit-management.md §5.1 (PROC-RISK-LLM-01).`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 2: every line observed in a LiquidityLimitBreached event is
  //              covered. Defensive recon — catches drift between the
  //              event-payload enum and the engine config table.
  // -------------------------------------------------------------------------
  const breaches = loadEvents("LiquidityLimitBreached", opts.breachEvents);
  const observedLines = new Set<string>();
  for (const b of breaches) {
    const line = safeString(b.payload.line);
    if (line) observedLines.add(line);
  }
  for (const line of observedLines) {
    result.asserted++;
    if (!coveredLines.has(line)) {
      violations.push({
        subject: `observed-line:${line}`,
        severity: "fail",
        message: `OBSERVED-BUT-UNCOVERED: liquidity line "${line}" has appeared in at least one LiquidityLimitBreached event but has NO configured tier in DEFAULT_LIMIT_CONFIGS. This is a drift between the event-payload enum and the engine config — either remove the offending emission or extend DEFAULT_LIMIT_CONFIGS. Authority: D-RAS; LRM Policy v1 §9.2.`,
      });
    }
  }

  // Empty-state guard.
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
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
        ? "liquidity-limit-coverage passed — every RAS B3-family line covered."
        : "liquidity-limit-coverage FAILED — missing tier coverage.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
