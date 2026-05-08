// platform/recon/cron-map-drift.ts
//
// Continuous-controls pipeline: cron-map drift integrity (Vera Wave-4 #12).
//
// A2.1's local scheduler embeds a `SCHEDULER_CRON_MAP` in
// `prototype/platform/scheduler/scheduler.ts` that mirrors the cron
// expressions declared in each `.github/workflows/agent-runtime-*.yml`.
// Two parallel sources of truth — the in-process scheduler emits
// `ScheduledTrigger` events on the cron map's cadence; GH Actions fires
// the workflow on the YAML's cadence. If the two diverge, the substrate
// silently delivers events at a different time than the workflow runs,
// double-firing or under-firing handlers.
//
// This pipeline asserts the two stay in sync and surfaces any divergence
// as a finding. Per Atlas's runtime spec philosophy (substrate-replacement-
// without-loss): both surfaces fire in parallel until A2.2's bus dispatch
// retires the GH Actions cron path. Until then, drift is the operational
// failure mode this pipeline catches.
//
// What this pipeline asserts:
//
//   1. For every key in `SCHEDULER_CRON_MAP`, find the corresponding
//      workflow file at `.github/workflows/agent-runtime-<lowercased-
//      agent>-<trigger>.yml`. Parse its `schedule.cron`. Assert the
//      two cron expressions match (normalised via `parseCron` so that
//      equivalent shapes — `MON` vs `1`, `0 2 * * *` vs `0 2 * * 0,1,2,3,4,5,6`
//      — are recognised as identical).
//   2. For every workflow file with a `schedule.cron`, find its match
//      in `SCHEDULER_CRON_MAP`. Workflow files with a schedule but no
//      cron-map entry are findings — the GH Actions cron will fire
//      while the in-process scheduler stays silent.
//   3. Workflow files that are `workflow_dispatch`-only (no `schedule:`
//      block, e.g. `mira:citation-gate`) are exempt from #1 — they are
//      on-request and have no cron. The pipeline notes them but does
//      not flag them as findings.
//
// Independence note: this pipeline parses `scheduler.ts` as **text** and
// does not import the scheduler module. The runtime scheduler has
// side-effecting imports (event-store, observability) we don't want
// pulled into a CI-time recon. Parsing the source is robust to the
// "what shape is the canonical cron source" question — if the map
// changes shape (e.g. moves to a derive-from-spec function), this
// pipeline notes the substrate gap rather than crashing.
//
// P6 — upward chain (single-graph discipline: cron-map and workflow-cron
// reconcile to the same cadence claim). P7 — autonomous-by-default
// (the scheduler is the substrate that fires agents; if it drifts from
// the workflow surface, agent autonomy depends on which surface fired).
//
// Author: Vera

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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
  /** Override the cron-map source file (default: scheduler.ts). */
  schedulerPath?: string;
  /** Override the workflows directory. */
  workflowsDir?: string;
  /**
   * Override the cron map directly (for synthetic tests). When supplied,
   * `schedulerPath` is ignored.
   */
  cronMap?: Readonly<Record<string, string>>;
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

  // 1) Resolve the cron map.
  let cronMap: Readonly<Record<string, string>> | undefined;
  if (opts.cronMap) {
    cronMap = opts.cronMap;
  } else {
    const path = opts.schedulerPath ?? DEFAULT_SCHEDULER_PATH;
    if (!existsSync(path)) {
      violations.push({
        subject: path,
        message: `Scheduler module not found at ${path}; cannot extract SCHEDULER_CRON_MAP.`,
        severity: "fail",
      });
      result.violations = violations;
      result.ok = false;
      return result;
    }
    cronMap = extractCronMapFromSource(readFileSync(path, "utf8"));
    if (!cronMap) {
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

  // 2) Resolve the workflow files.
  const workflowFiles =
    opts.workflowFiles ?? loadWorkflowFiles(opts.workflowsDir ?? DEFAULT_WORKFLOWS_DIR);
  const schedules = collectWorkflowSchedules(workflowFiles);
  const schedulesByKey = new Map<string, WorkflowSchedule>();
  for (const s of schedules) schedulesByKey.set(s.key, s);

  // Assertion 1: every cron-map entry must have a matching workflow with
  // a `schedule.cron` that matches.
  for (const [key, mapCron] of Object.entries(cronMap)) {
    result.asserted++;
    const wf = schedulesByKey.get(key);
    if (!wf) {
      violations.push({
        subject: key,
        message: `SCHEDULER_CRON_MAP declares "${key}" → "${mapCron}" but no matching workflow file at .github/workflows/agent-runtime-${key.replace(":", "-")}.yml. The in-process scheduler will fire but no GH Actions cron is registered.`,
        severity: "fail",
      });
      continue;
    }
    if (wf.cron === undefined) {
      violations.push({
        subject: key,
        message: `SCHEDULER_CRON_MAP declares "${key}" → "${mapCron}" but workflow ${wf.file} has no schedule.cron block (workflow_dispatch-only). Either remove the cron-map entry or add a schedule to the workflow.`,
        severity: "fail",
      });
      continue;
    }
    if (!cronsEquivalent(mapCron, wf.cron)) {
      violations.push({
        subject: key,
        message: `Cron drift: SCHEDULER_CRON_MAP says "${mapCron}", workflow ${wf.file} says "${wf.cron}". The in-process scheduler and GH Actions will fire on different cadences.`,
        severity: "fail",
      });
    }
  }

  // Assertion 2: every workflow with a schedule.cron must have a matching
  // cron-map entry. Workflows that are workflow_dispatch-only are exempt
  // (we surface them as info-level notes, not failures).
  for (const wf of schedules) {
    result.asserted++;
    if (wf.cron === undefined) {
      // workflow_dispatch-only — exempt by spec.
      continue;
    }
    if (!(wf.key in cronMap)) {
      violations.push({
        subject: wf.key,
        message: `Workflow ${wf.file} declares schedule.cron "${wf.cron}" but SCHEDULER_CRON_MAP has no "${wf.key}" entry. GH Actions will fire while the in-process scheduler stays silent — substrate divergence.`,
        severity: "fail",
      });
    }
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
        ? "Cron-map drift integrity passed (SCHEDULER_CRON_MAP and agent-runtime workflows agree)"
        : "Cron-map drift integrity FAILED — drift between SCHEDULER_CRON_MAP and .github/workflows/agent-runtime-*.yml",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
