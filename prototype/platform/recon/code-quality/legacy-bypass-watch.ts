// platform/recon/code-quality/legacy-bypass-watch.ts
//
// Code-quality recon: tracks the size of the
// `LEGACY_PRE_A1_EVENT_TYPES` allow-list (in
// `prototype/platform/event-store/permission-gate.ts`).
//
// Background — every event type in the allow-list bypasses the
// permission gate. The list is the migration window from "every emitter
// gets a published policy" to "no emitter is implicit". It must shrink
// over time (or at worst stay flat) — never grow. A new entry is a
// finding: it means an emitter was added without a corresponding policy.
//
// The baseline is a hardcoded count snapshotted on the day of recon
// authoring (2026-05-10). If the live count exceeds the baseline, the
// recon emits a finding. If the live count drops, the recon notes
// progress (info-severity). Either way the deliverable carries the
// current count as a heartbeat number.
//
// Update path: when a deliberate batch retires entries (e.g. as part of
// a permission-gate cleanup pass), update `BASELINE_COUNT` here in the
// same commit so subsequent runs use the new floor. Updating upward is
// only legitimate alongside a CEO-decision authorising the legacy
// growth — there is no such decision today.
//
// Author: Vera (third-line) · Atlas (recon plumbing for codebase-quality-review handler)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "../types";

/**
 * Baseline count of `LEGACY_PRE_A1_EVENT_TYPES` entries on the day this
 * recon was authored (2026-05-10). The list contains 215 entries today.
 * Growing past this baseline without an authorising CEO decision is a
 * finding.
 *
 * If a deliberate retirement pass shrinks the list, update this constant
 * in the same commit.
 *
 * 2026-05-14: +2 entries (AgentPerformanceEvaluated, AgentFeedbackIssued)
 * added by Sade's performance-evaluator PR. These are new AgentOps substrate
 * events; no agent has published a policy for them yet. Growth authorised by
 * Scrooge dispatch brief (agent-aba467f89147533bf) under Principle 6
 * (autonomous by default — performance management is load-bearing AgentOps).
 * Baseline bumped from 215 → 217.
 *
 * 2026-05-17: +3 entries (EquityTradeExecuted, EquitySettlementConfirmed,
 * EquityPositionRevalued) added by Kai's M3 equity lifecycle PR. These are
 * new CDM equity events extending the existing M1 equity family. Growth
 * authorised by D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).
 * Baseline bumped from 217 → 220.
 *
 * 2026-05-17: +5 entries (IrsTradeBooked, IrsCouponScheduleGenerated,
 * IrsCouponPaymentInstructed, IrsCouponSettlementConfirmed, IrsPositionRevalued)
 * added by Eitan's M5 OTC IRS lifecycle PR. New CDM IRD events completing the
 * bank's third core asset class. Growth authorised by D-MARKETS-SCHEMA-FOUNDATION
 * (CEO approved 2026-05-07). Baseline bumped from 220 → 225.
 */
export const BASELINE_COUNT = 225;

/**
 * Date the baseline was snapshotted, for the deliverable's message line.
 */
export const BASELINE_AS_OF = "2026-05-14";

export interface RunOpts {
  /** Override the permission-gate.ts path (for tests). */
  permissionGatePath?: string;
  /** Override the baseline count (for tests). */
  baseline?: number;
}

/**
 * Parse the count of entries inside the
 * `LEGACY_PRE_A1_EVENT_TYPES: ReadonlySet<string> = new Set([ … ])` block.
 * Counts string-literal lines (one entry per line) inside the block. Any
 * line beginning with optional whitespace + `"` followed by an identifier
 * + `"` is counted.
 *
 * Robustness: this is a text-level count, not a TypeScript-AST parse.
 * The convention in the source is "one entry per line, alphabetised", so
 * the count is stable. If the convention drifts (e.g. multiple entries
 * per line), the count is wrong but the recon still surfaces *something*
 * — it does not crash.
 */
export function countLegacyBypassEntries(source: string): number {
  const start = source.indexOf("LEGACY_PRE_A1_EVENT_TYPES: ReadonlySet<string> = new Set([");
  if (start < 0) return -1;
  // Walk forward to find the matching `]);` closer. Same brace-depth
  // logic as swallowed-errors but scoped to `[` / `]`.
  let i = source.indexOf("[", start);
  if (i < 0) return -1;
  let depth = 1;
  i++;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    i++;
  }
  if (depth !== 0) return -1;
  const block = source.slice(start, i);
  // Match `"<Identifier>"` at the start of a (possibly indented) line.
  const re = /^\s*"[A-Za-z][A-Za-z0-9]*"\s*,?\s*$/gm;
  return block.match(re)?.length ?? 0;
}

function findRepoRoot(start: string): string {
  let dir = start;
  for (let depth = 0; depth < 8; depth++) {
    const r = resolve(dir);
    try {
      readFileSync(resolve(r, "CLAUDE.md"), "utf8");
      return r;
    } catch {
      // climb
    }
    const parent = resolve(r, "..");
    if (parent === r) break;
    dir = parent;
  }
  // Fallback: relative to this module location (prototype/platform/recon/code-quality → up 4)
  return resolve(import.meta.dir, "..", "..", "..", "..");
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("code-quality:legacy-bypass-watch");
  const violations: ReconViolation[] = [];

  const baseline = opts.baseline ?? BASELINE_COUNT;
  const permissionGatePath =
    opts.permissionGatePath ??
    resolve(findRepoRoot(import.meta.dir), "prototype/platform/event-store/permission-gate.ts");

  let source: string;
  try {
    source = readFileSync(permissionGatePath, "utf8");
  } catch (e) {
    violations.push({
      subject: permissionGatePath,
      message: `legacy-bypass-watch: cannot read permission-gate.ts: ${(e as Error).message}.`,
      severity: "fail",
    });
    result.asserted = 1;
    result.violations = violations;
    result.ok = false;
    return result;
  }

  result.asserted = 1;
  const count = countLegacyBypassEntries(source);

  if (count < 0) {
    violations.push({
      subject: "code-quality:legacy-bypass-watch",
      message: `Could not parse LEGACY_PRE_A1_EVENT_TYPES block in permission-gate.ts. The recon's text-level parser may have drifted from the source shape.`,
      severity: "warn",
    });
  } else if (count > baseline) {
    violations.push({
      subject: "code-quality:legacy-bypass-watch",
      message: `LEGACY_PRE_A1_EVENT_TYPES has ${count} entries; baseline was ${baseline} (as of ${BASELINE_AS_OF}). New entries are tracked surfaces, not free passes — every new emitter must publish a policy under \`eventEmitAllowList\`. If the growth is deliberate, update BASELINE_COUNT in legacy-bypass-watch.ts in the same commit (and authorising CEO decision).`,
      severity: "warn",
    });
  } else if (count < baseline) {
    violations.push({
      subject: "code-quality:legacy-bypass-watch",
      message: `LEGACY_PRE_A1_EVENT_TYPES has ${count} entries; baseline was ${baseline} (as of ${BASELINE_AS_OF}). Progress — update BASELINE_COUNT to ${count} in legacy-bypass-watch.ts to lock in the lower floor.`,
      severity: "info",
    });
  } else {
    violations.push({
      subject: "code-quality:legacy-bypass-watch",
      message: `LEGACY_PRE_A1_EVENT_TYPES at baseline (${count} entries, as of ${BASELINE_AS_OF}). No drift.`,
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}
