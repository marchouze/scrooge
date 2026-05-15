// platform/recon/madge-circular-deps.ts
//
// Continuous-controls pipeline: circular-dependency gate (Vera Wave-4 F-034).
//
// Asserts zero circular dependencies in the TypeScript source tree under
// runtime/, platform/, dashboard/, and domains/. Any cycle is a `fail`-
// severity violation that blocks CI.
//
// Authority: Vera Wave-4 F-034; Principle 2 (single-graph discipline —
// a circular import is a graph topology violation).
// Author: Vera (Internal Audit Engineer) + Atlas (Core Banking Platform
// Architect, engineering)

import { spawnSync } from "node:child_process";
import { emptyResult } from "./types";
import type { ReconResult } from "./types";

const SCOPE_DIRS = ["runtime/", "platform/", "dashboard/", "domains/"];

export function run(): ReconResult {
  const result = emptyResult("madge-circular-deps");
  result.asserted = 1; // single global assertion: zero circular dependencies

  const proc = spawnSync("bunx", ["madge", "--circular", "--extensions", "ts", ...SCOPE_DIRS], {
    encoding: "utf8",
    cwd: process.cwd(),
  });

  // madge exits 1 when cycles are found; stdout still contains the list.
  // Only treat it as an infra error when stdout is empty AND exit is non-zero.
  if ((proc.status ?? 0) !== 0 && !proc.stdout?.trim()) {
    result.violations.push({
      subject: "madge",
      message: `madge invocation failed (exit ${proc.status ?? "?"}): ${proc.stderr?.trim() ?? "no output"}`,
      severity: "fail",
    });
    return { ...result, ok: false };
  }

  const cycleLines = (proc.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\)/.test(l));

  for (const line of cycleLines) {
    result.violations.push({
      subject: line,
      message: `Circular dependency detected: ${line}`,
      severity: "fail",
    });
  }

  return { ...result, ok: result.violations.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.message}\n`);
  }
  process.exit(r.ok ? 0 : 1);
}
