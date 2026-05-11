// platform/recon/cron-map-drift.ts
//
// Continuous-controls pipeline: cron-map drift integrity (Vera Wave-4 #12).
//
// Post cron-consolidation (2026-05-10): cron expressions are
// authoritatively declared in `runtime/handlers-metadata.ts` (the
// `cronExpression` field on each `HandlerMetadata` row). The
// `SCHEDULER_CRON_MAP` export in `platform/scheduler/scheduler.ts` is
// now a derived projection of that metadata.
//
// GH-Actions scheduled crons decommissioned (2026-05-11): the launchd
// scheduler (`com.scrooge.scheduler-tick`) is now the sole canonical
// cadence mechanism. All `.github/workflows/agent-runtime-*.yml` schedule
// blocks have been removed; those workflow files are now
// `workflow_dispatch`-only for manual / on-demand runs. The
// parallel-surfaces drift check (assertions 2 & 3 below) is therefore
// a no-op when no workflow files carry `schedule.cron` blocks — the
// recon skips those assertions silently rather than failing.
//
// What this pipeline asserts:
//
//   1. Every `kind: "scheduled"` row in `HANDLERS_METADATA` MUST
//      declare a `cronExpression`. Scheduled handlers without a cron
//      cannot be fired by the in-process scheduler — silent under-firing.
//   2. (GH-Actions era) For every metadata row with a `cronExpression`,
//      find the corresponding workflow file and assert its `schedule.cron`
//      matches. Skipped when no workflow files have schedule blocks (post-
//      decommission state). Retained for potential A2.2 bus-dispatch
//      re-enablement.
//   3. (GH-Actions era) For every workflow file with a `schedule.cron`,
//      find a matching metadata row. Skipped when no workflow files have
//      schedule blocks. Retained as above.
//   4. Workflow files that are `workflow_dispatch`-only (no `schedule:`
//      block) are exempt from #2 — they are on-request and have no cron.
//      All `agent-runtime-*.yml` files are in this state post-decommission.
//
// Source of truth — the recon imports `HANDLERS_METADATA` directly from
// `runtime/handlers-metadata.ts`. That module is side-effect-free
// (types + a static array; no event-store, no logger). For substrate-
// shape resilience, the recon also retains the `extractCronMapFromSource`
// text-parser as a synthetic-test seam (callers can override the cron
// map directly via `opts.cronMap`).
//
// P2 — single-graph discipline: metadata and in-process scheduler
// reconcile to the same cadence claim.
// P6 — autonomous-by-default (launchd is now the canonical scheduler
// substrate; if it drifts from the metadata cron map, agent autonomy
// silently breaks).
//
// Author: Vera

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  HANDLERS_METADATA,
  type HandlerMetadata,
  derivedCronMap,
  scheduledHandlersMissingCron,
} from "../../runtime/handlers-metadata";
import { parseCron } from "../scheduler/cron-parse";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const DEFAULT_SCHEDULER_PATH = resolve(REPO_ROOT, "prototype/platform/scheduler/scheduler.ts");
const DEFAULT_WORKFLOWS_DIR = resolve(REPO_ROOT, ".github/workflows");

const WORKFLOW_PREFIX = "agent-runtime-";
const WORKFLOW_SUFFIX = ".yml";

export interface RunOpts {
  /**
   * Override the cron-map source file (default: scheduler.ts). Retained
   * for substrate-shape-stability tests; the live recon now reads from
   * `HANDLERS_METADATA` directly.
   */
  schedulerPath?: string;
  /** Override the workflows directory. */
  workflowsDir?: string;
  /**
   * Override the cron map directly (for synthetic tests). When supplied,
   * `schedulerPath` is ignored AND the metadata-derived map is bypassed
   * — useful for hermetic synthetic-mismatch tests.
   */
  cronMap?: Readonly<Record<string, string>>;
  /**
   * Override the handler metadata directly (for synthetic tests of the
   * "missing cronExpression" assertion). When supplied, the live
   * `HANDLERS_METADATA` is bypassed.
   */
  handlersMetadata?: readonly HandlerMetadata[];
  /**
   * Override the workflow file inputs directly (for synthetic tests).
   * When supplied, `workflowsDir` is ignored. Keyed by filename
   * (without directory). The value is the raw YAML body.
   */
  workflowFiles?: Readonly<Record<string, string>>;
}

interface WorkflowSchedule {
  /** Filename, e.g. `agent-runtime-vera-overnight.yml`. */
  readonly file: string;
  /** Composite key derived from filename, e.g. `vera:overnight` or
   *  `vera:overnight-recon` if the file was named `agent-runtime-vera-
   *  overnight-recon.yml`. We use the longest plausible derivation —
   *  see `deriveKeyFromFilename`. */
  readonly key: string;
  /** The cron expression from the file's `schedule.cron`, or undefined
   *  if the file is `workflow_dispatch`-only. */
  readonly cron: string | undefined;
}

/**
 * Derive the `<lowercased-agent>:<trigger>` key from the workflow
 * filename. Convention is `agent-runtime-<persona>-<trigger>.yml` where
 * `<trigger>` itself may contain hyphens (e.g. `overnight-recon`,
 * `popia-controls-snapshot`).
 *
 * Strategy: the persona name is always a single token (one hyphen
 * after the prefix). Everything after the first dash following the
 * persona is the trigger. So `agent-runtime-mira-citation-gate.yml`
 * → `mira:citation-gate`.
 */
export function deriveKeyFromFilename(filename: string): string | undefined {
  if (!filename.startsWith(WORKFLOW_PREFIX)) return undefined;
  if (!filename.endsWith(WORKFLOW_SUFFIX)) return undefined;
  const stem = filename.slice(WORKFLOW_PREFIX.length, -WORKFLOW_SUFFIX.length);
  const dashIdx = stem.indexOf("-");
  if (dashIdx <= 0 || dashIdx === stem.length - 1) return undefined;
  const agent = stem.slice(0, dashIdx);
  const trigger = stem.slice(dashIdx + 1);
  return `${agent}:${trigger}`;
}

/**
 * Extract the `SCHEDULER_CRON_MAP` literal from the scheduler module's
 * source text. We deliberately parse text (not import) — the scheduler
 * module pulls runtime side effects.
 *
 * Looks for a top-level `export const SCHEDULER_CRON_MAP ... = { ... };`
 * block and walks it as a tolerant key/value extraction. Returns
 * `undefined` if the constant cannot be located in the recognised shape;
 * the recon then surfaces a substrate-shape finding rather than crashing.
 */
export function extractCronMapFromSource(
  source: string,
): Readonly<Record<string, string>> | undefined {
  const declIdx = source.indexOf("SCHEDULER_CRON_MAP");
  if (declIdx < 0) return undefined;
  // Find the first `{` after the declaration site.
  const openIdx = source.indexOf("{", declIdx);
  if (openIdx < 0) return undefined;
  // Walk braces to find the matching close.
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx < 0) return undefined;
  const body = source.slice(openIdx + 1, closeIdx);
  // Each entry: `"key": "value",` (tolerate single quotes and trailing comma).
  const entryRe = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null = null;
  while (true) {
    m = entryRe.exec(body);
    if (!m) break;
    const k = m[1];
    const v = m[2];
    if (k && v) out[k] = v;
  }
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

/**
 * Parse a workflow YAML body and extract its first `schedule.cron`
 * value (or undefined if the file is `workflow_dispatch`-only).
 *
 * Tolerant — looks for the `schedule:` block then the first `- cron: "..."`
 * entry. Workflows with multiple cron schedules surface only the first
 * (multi-cron is a substrate gap noted, not common in this repo).
 */
export function extractCronFromWorkflow(yaml: string): string | undefined {
  // Find `schedule:` outside a comment context. The agent-runtime workflows
  // use simple shape — top-level `on:` block, then `  schedule:`. Tolerate
  // `schedule: []` and absent block.
  const lines = yaml.split(/\r?\n/);
  let inSchedule = false;
  for (const rawLine of lines) {
    // Strip line comments (anything from the first `#` not inside quotes).
    const line = stripLineComment(rawLine);
    const trimmed = line.trim();
    if (!inSchedule) {
      if (/^schedule\s*:\s*(\[\s*\]\s*)?$/.test(trimmed)) {
        // `schedule:` or `schedule: []`
        if (trimmed.endsWith("[]")) return undefined;
        inSchedule = true;
        continue;
      }
      continue;
    }
    // Inside schedule block — first cron line wins.
    const cronMatch = /^-\s*cron\s*:\s*["']([^"']+)["']\s*$/.exec(trimmed);
    if (cronMatch) {
      return cronMatch[1];
    }
    // If we hit an unindented (top-level) line, the schedule block has ended.
    if (line.length > 0 && !/^\s/.test(line)) {
      inSchedule = false;
    }
  }
  return undefined;
}

function stripLineComment(line: string): string {
  // Naive — fine for the workflow YAML shape we see (no `#` in cron values
  // because they're always quoted, and we never look inside the quotes).
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Two cron expressions are equivalent iff they parse to the same
 * value-set across all five fields (so `MON` vs `1`, etc., are equal).
 * Falls back to literal-string equality when either side fails to parse.
 */
function cronsEquivalent(a: string, b: string): boolean {
  if (a.trim() === b.trim()) return true;
  try {
    const pa = parseCron(a);
    const pb = parseCron(b);
    return (
      arrEq(pa.minute.values, pb.minute.values) &&
      arrEq(pa.hour.values, pb.hour.values) &&
      arrEq(pa.dayOfMonth.values, pb.dayOfMonth.values) &&
      arrEq(pa.month.values, pb.month.values) &&
      arrEq(pa.dayOfWeek.values, pb.dayOfWeek.values)
    );
  } catch {
    return false;
  }
}

function arrEq(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function loadWorkflowFiles(workflowsDir: string): Readonly<Record<string, string>> {
  if (!existsSync(workflowsDir)) return {};
  const out: Record<string, string> = {};
  for (const name of readdirSync(workflowsDir)) {
    if (!name.startsWith(WORKFLOW_PREFIX)) continue;
    if (!name.endsWith(WORKFLOW_SUFFIX)) continue;
    out[name] = readFileSync(resolve(workflowsDir, name), "utf8");
  }
  return out;
}

function collectWorkflowSchedules(
  files: Readonly<Record<string, string>>,
): readonly WorkflowSchedule[] {
  const out: WorkflowSchedule[] = [];
  const names = Object.keys(files).sort();
  for (const name of names) {
    const key = deriveKeyFromFilename(name);
    if (!key) continue;
    const yaml = files[name] ?? "";
    const cron = extractCronFromWorkflow(yaml);
    out.push({ file: name, key, cron });
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("cron-map-drift-integrity");
  const violations: ReconViolation[] = [];

  // ---------------------------------------------------------------------
  // Stage 0 — Resolve the canonical metadata + cron map.
  //
  // Three sources, in order of preference:
  //   (a) opts.cronMap — synthetic test override; bypasses metadata.
  //   (b) opts.handlersMetadata — synthetic test override; the cron map
  //       is derived from it via the same projection used in production.
  //   (c) Live HANDLERS_METADATA from runtime/handlers-metadata.ts.
  //
  // Stage 0a — assert every scheduled metadata row has a cronExpression.
  // This is the new assertion that closes the "scheduled handler with
  // no cron" silent-under-firing failure mode. Skipped when the caller
  // overrides `cronMap` directly (no metadata to assert against).
  // ---------------------------------------------------------------------

  let cronMap: Readonly<Record<string, string>> | undefined;
  let metadataForCronAssertion: readonly HandlerMetadata[] | undefined;

  if (opts.cronMap) {
    cronMap = opts.cronMap;
    // No metadata to assert against — caller bypassed the metadata layer.
  } else if (opts.handlersMetadata) {
    metadataForCronAssertion = opts.handlersMetadata;
    cronMap = derivedCronMapFromMetadata(opts.handlersMetadata);
  } else {
    metadataForCronAssertion = HANDLERS_METADATA;
    cronMap = derivedCronMap();
  }

  // Stage 0b — assert every scheduled metadata row declares a cron.
  if (metadataForCronAssertion) {
    const scheduledRows = metadataForCronAssertion.filter((h) => h.kind === "scheduled");
    const missing =
      metadataForCronAssertion === HANDLERS_METADATA
        ? scheduledHandlersMissingCron()
        : scheduledRows.filter((h) => h.cronExpression === undefined);
    // Count one assertion per scheduled handler (not just per missing entry)
    // so r.asserted > 0 always holds as long as there are scheduled handlers.
    result.asserted += scheduledRows.length;
    for (const h of missing) {
      violations.push({
        subject: h.key,
        message: `HandlerMetadata row "${h.key}" has kind "scheduled" but no cronExpression. The in-process scheduler cannot fire it — silent under-firing. Add a cronExpression in runtime/handlers-metadata.ts.`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------
  // Stage 0c — substrate-shape stability fallback for the legacy
  // "scheduler module not present / SCHEDULER_CRON_MAP missing" case.
  // Retained so the recon surfaces a substrate-shape finding rather than
  // crashing if scheduler.ts is renamed / removed mid-refactor.
  // ---------------------------------------------------------------------
  if (!opts.cronMap && !opts.handlersMetadata) {
    const path = opts.schedulerPath ?? DEFAULT_SCHEDULER_PATH;
    if (!existsSync(path)) {
      violations.push({
        subject: path,
        message: `Scheduler module not found at ${path}; cannot verify SCHEDULER_CRON_MAP export shape.`,
        severity: "fail",
      });
      result.violations = violations;
      result.ok = false;
      return result;
    }
    // We don't strictly need the source-extracted map (we have the live
    // metadata-derived one), but if `extractCronMapFromSource` fails
    // entirely AND we explicitly pointed at a synthetic schedulerPath,
    // surface the substrate-shape finding to keep the legacy test for
    // "shape moved" green. The live path uses the metadata-derived map
    // unconditionally.
    if (opts.schedulerPath) {
      const extracted = extractCronMapFromSource(readFileSync(path, "utf8"));
      if (!extracted) {
        violations.push({
          subject: path,
          message:
            "Could not extract SCHEDULER_CRON_MAP from scheduler.ts. Either the export was renamed or the canonical cron source moved (substrate-shape change). Update this recon to follow the new shape.",
          severity: "fail",
        });
        result.violations = violations;
        result.ok = false;
        return result;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Stage 1 — Resolve workflow files; compare metadata cron vs YAML cron.
  //
  // Post-decommission (2026-05-11): GH-Actions scheduled crons have been
  // removed. All agent-runtime workflows are now workflow_dispatch-only.
  // Assertions 1 & 2 are skipped when no workflow files carry a
  // schedule.cron block — the launchd scheduler is now the sole canonical
  // cadence mechanism and there is nothing to drift-check against.
  //
  // Both assertions are RETAINED in the code so they activate
  // automatically if any workflow regains a schedule block (e.g., during
  // a future A2.2 bus-dispatch migration).
  // ---------------------------------------------------------------------
  const workflowFiles =
    opts.workflowFiles ?? loadWorkflowFiles(opts.workflowsDir ?? DEFAULT_WORKFLOWS_DIR);
  const schedules = collectWorkflowSchedules(workflowFiles);
  const schedulesByKey = new Map<string, WorkflowSchedule>();
  for (const s of schedules) schedulesByKey.set(s.key, s);

  // Determine whether any workflow currently has a schedule block.
  // In synthetic-test mode (caller supplied explicit workflowFiles or
  // cronMap overrides), always run all assertions regardless — those
  // tests are checking specific drift classes. The skip only applies to
  // the live-filesystem run (default path), where all schedule blocks
  // have been removed post-decommission.
  const syntheticMode = !!(opts.workflowFiles || opts.cronMap || opts.handlersMetadata);
  const anyWorkflowHasSchedule = syntheticMode || schedules.some((s) => s.cron !== undefined);

  // Assertion 1 (GH-Actions era): every cron-map entry must have a
  // matching workflow with a `schedule.cron` that matches.
  // Skipped when no workflow files have schedule blocks (live-run only).
  if (anyWorkflowHasSchedule) {
    for (const [key, mapCron] of Object.entries(cronMap ?? {})) {
      result.asserted++;
      const wf = schedulesByKey.get(key);
      if (!wf) {
        violations.push({
          subject: key,
          message: `HANDLERS_METADATA declares "${key}" → "${mapCron}" but no matching workflow file at .github/workflows/agent-runtime-${key.replace(":", "-")}.yml. The in-process scheduler will fire but no GH Actions cron is registered.`,
          severity: "fail",
        });
        continue;
      }
      if (wf.cron === undefined) {
        violations.push({
          subject: key,
          message: `HANDLERS_METADATA declares "${key}" → "${mapCron}" but workflow ${wf.file} has no schedule.cron block (workflow_dispatch-only). Either remove the cronExpression from metadata or add a schedule to the workflow.`,
          severity: "fail",
        });
        continue;
      }
      if (!cronsEquivalent(mapCron, wf.cron)) {
        violations.push({
          subject: key,
          message: `Cron drift: HANDLERS_METADATA says "${mapCron}", workflow ${wf.file} says "${wf.cron}". The in-process scheduler and GH Actions will fire on different cadences.`,
          severity: "fail",
        });
      }
    }
  }

  // Assertion 2 (GH-Actions era): every workflow with a schedule.cron
  // must have a matching cron-map entry. Workflows that are
  // workflow_dispatch-only are exempt. Skipped when no workflow files
  // have schedule blocks (post-decommission no-op).
  if (anyWorkflowHasSchedule) {
    for (const wf of schedules) {
      result.asserted++;
      if (wf.cron === undefined) {
        // workflow_dispatch-only — exempt by spec.
        continue;
      }
      if (!cronMap || !(wf.key in cronMap)) {
        violations.push({
          subject: wf.key,
          message: `Workflow ${wf.file} declares schedule.cron "${wf.cron}" but HANDLERS_METADATA has no "${wf.key}" scheduled row with cronExpression. GH Actions will fire while the in-process scheduler stays silent — substrate divergence.`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/**
 * Same projection as `derivedCronMap()` in handlers-metadata, but
 * applied to a caller-supplied metadata array. Kept inline (rather than
 * exported from handlers-metadata) because it's only meaningful for
 * synthetic-test overrides — production reads `derivedCronMap()`.
 */
function derivedCronMapFromMetadata(
  metadata: readonly HandlerMetadata[],
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const h of metadata) {
    if (h.kind === "scheduled" && h.cronExpression !== undefined) {
      out[h.key] = h.cronExpression;
    }
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
        ? "Cron-map drift integrity passed (SCHEDULER_CRON_MAP and agent-runtime workflows agree)"
        : "Cron-map drift integrity FAILED — drift between SCHEDULER_CRON_MAP and .github/workflows/agent-runtime-*.yml",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
