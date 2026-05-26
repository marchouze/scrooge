// platform/recon/recon-golden-source-hardcoded-maps.ts
//
// Recon pipeline: golden-source-hardcoded-maps
//
// Enforces two assertions:
//
//   1. HARDCODED-MAP-VIOLATION (fail)
//      `dashboard/agent-runs.ts` must not contain top-level const object
//      literals whose keys match `agent-runtime-*.yml` patterns. This would
//      indicate that a workflow map has been hardcoded rather than derived
//      from the golden source (Team/_team-roster.json).
//
//   2. ROSTER-WORKFLOW-COVERAGE (warn)
//      Every `.github/workflows/agent-runtime-*.yml` file in the repository
//      should have a corresponding roster entry with either a `workflowFile`
//      field (singular — primary workflow) or an item in `workflowFiles`
//      (array — additional workflows for multi-workflow agents).
//      A missing entry means the dashboard cannot map that workflow to an
//      agent name — it will show "unknown agent".
//
// Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1 (Slice 2)
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:golden-source-hardcoded-maps";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

/**
 * Check whether the given source text contains a top-level const whose value
 * is an object literal with keys ending in `.yml` matching agent-runtime-*.
 *
 * We look for string keys of the form `"agent-runtime-*.yml":` appearing
 * inside a const block — this is the canonical fingerprint of a hardcoded
 * workflow map.
 */
function detectHardcodedYmlKeys(source: string): boolean {
  // Regex: literal string key matching the agent-runtime-*.yml pattern
  // inside what looks like an object literal value (const ... = { ... }).
  // We require the pattern to appear outside a comment.
  const lines = source.split("\n");
  for (const line of lines) {
    const trimmed = line.trimStart();
    // Skip comment lines
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    // Match: "agent-runtime-<something>.yml": within an object literal
    if (/["']agent-runtime-[^"']+\.yml["']\s*:/.test(line)) {
      return true;
    }
  }
  return false;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const repoRoot = findRepoRoot(import.meta.dir);
  const agentRunsPath = resolve(repoRoot, "prototype/dashboard/agent-runs.ts");
  const workflowsDir = resolve(repoRoot, ".github/workflows");
  const rosterPath = resolve(repoRoot, "Team/_team-roster.json");

  // ---------------------------------------------------------------------------
  // Assertion 1: no hardcoded .yml keys in dashboard/agent-runs.ts
  // ---------------------------------------------------------------------------
  result.asserted++;

  if (!existsSync(agentRunsPath)) {
    violations.push({
      subject: "dashboard/agent-runs.ts",
      severity: "fail",
      message: `dashboard/agent-runs.ts not found at expected path ${agentRunsPath}. Cannot assert golden-source compliance.`,
    });
  } else {
    const source = readFileSync(agentRunsPath, "utf8");
    if (detectHardcodedYmlKeys(source)) {
      violations.push({
        subject: "dashboard/agent-runs.ts",
        severity: "fail",
        message:
          'dashboard/agent-runs.ts contains at least one hardcoded "agent-runtime-*.yml" key in an object literal. ' +
          "This violates the golden-source discipline (D-DATA-QUALITY-GOLDEN-SOURCE-V1 Slice 2). " +
          "Remove the hardcoded map and derive it from Team/_team-roster.json via buildWorkflowMap().",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Assertion 2: every agent-runtime-*.yml has a roster entry with workflowFile
  // or an item in workflowFiles
  // ---------------------------------------------------------------------------

  let workflowFiles: string[] = [];
  if (existsSync(workflowsDir)) {
    workflowFiles = readdirSync(workflowsDir)
      .filter((f) => f.startsWith("agent-runtime-") && f.endsWith(".yml"))
      .sort();
  }

  const rosterWorkflowFiles = new Set<string>();
  if (existsSync(rosterPath)) {
    try {
      const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as {
        personas?: Array<{ workflowFile?: string; workflowFiles?: string[] }>;
      };
      for (const entry of roster.personas ?? []) {
        if (entry.workflowFile) rosterWorkflowFiles.add(entry.workflowFile);
        for (const wf of entry.workflowFiles ?? []) {
          rosterWorkflowFiles.add(wf);
        }
      }
    } catch {
      violations.push({
        subject: "Team/_team-roster.json",
        severity: "fail",
        message:
          "Team/_team-roster.json could not be parsed. Cannot assert workflow-coverage. Fix the JSON syntax.",
      });
    }
  } else {
    violations.push({
      subject: "Team/_team-roster.json",
      severity: "fail",
      message: `Team/_team-roster.json not found at ${rosterPath}. Cannot assert workflow-coverage.`,
    });
  }

  for (const wf of workflowFiles) {
    result.asserted++;
    if (!rosterWorkflowFiles.has(wf)) {
      violations.push({
        subject: `workflow:${wf}`,
        severity: "warn",
        message:
          `Workflow file "${wf}" has no matching roster entry. ` +
          `Add { "workflowFile": "${wf}", "workflowTrigger": "<trigger>" } to the relevant entry in ` +
          `Team/_team-roster.json, or append "${wf}" to that entry's "workflowFiles" array.`,
      });
    }
  }

  // Empty-state guard — keep asserted >= 1 so the harness records a run.
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();

  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;

  console.log(
    JSON.stringify({
      level: r.ok ? (warnCount > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      findings: r.violations.length,
      fails: failCount,
      warns: warnCount,
      ok: r.ok,
      msg: r.ok
        ? warnCount > 0
          ? `golden-source-hardcoded-maps: ${warnCount} warning(s) — some agent-runtime-*.yml files have no roster entry`
          : "golden-source-hardcoded-maps passed — no hardcoded workflow maps; all agent-runtime-*.yml files have roster coverage"
        : `golden-source-hardcoded-maps FAILED — ${failCount} violation(s): hardcoded workflow map or missing roster file`,
      detail: r.violations,
    }),
  );

  process.exit(r.ok ? 0 : 1);
}
