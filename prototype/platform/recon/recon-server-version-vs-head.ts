// platform/recon/recon-server-version-vs-head.ts
//
// Recon pipeline: server-version-vs-head
//
// Static CI-safe gate that asserts the stale-server prevention
// infrastructure has not been accidentally removed:
//
//   1. .githooks/post-merge exists and is executable — the hook that warns
//      developers to restart the server after a merge.
//   2. prototype/dashboard/server.ts contains the /api/version handler —
//      the endpoint the hook and operators query to inspect the running
//      server's git commit.
//
// This gate does NOT require a live server. It reads source files only and
// is safe to run in CI (GitHub Actions, no server present).
//
// For the live check (does the running server match HEAD?), run:
//   curl http://localhost:3010/api/version
//
// Authority:
//   - D-STALE-SERVER-PREVENTION
//
// Author: Atlas (Core banking platform architect, engineering)

import * as fs from "node:fs";
import * as path from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:server-version-vs-head";

// ---------------------------------------------------------------------------
// Main

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const thisFile = import.meta.dir ?? process.cwd();
  const protoDir = path.resolve(thisFile, "..", "..");
  const repoRoot = path.resolve(protoDir, "..");

  // ── Check 1: .githooks/post-merge exists and is executable ──────────────
  result.asserted++;
  const hookPath = path.join(repoRoot, ".githooks", "post-merge");
  if (!fs.existsSync(hookPath)) {
    violations.push({
      subject: ".githooks/post-merge",
      severity: "fail",
      message:
        ".githooks/post-merge does not exist. This hook warns developers to restart the dashboard server after a merge. Restore it from D-STALE-SERVER-PREVENTION.",
    });
  } else {
    const mode = fs.statSync(hookPath).mode;
    const isExecutable = !!(mode & 0o111);
    if (!isExecutable) {
      violations.push({
        subject: ".githooks/post-merge",
        severity: "fail",
        message:
          ".githooks/post-merge exists but is not executable. Run: chmod +x .githooks/post-merge",
      });
    }
  }

  // ── Check 2: server.ts contains /api/version handler ────────────────────
  result.asserted++;
  const serverPath = path.join(protoDir, "dashboard", "server.ts");
  if (!fs.existsSync(serverPath)) {
    violations.push({
      subject: "prototype/dashboard/server.ts",
      severity: "fail",
      message: `server.ts not found at expected path "${serverPath}". Cannot verify /api/version handler.`,
    });
  } else {
    const serverSrc = fs.readFileSync(serverPath, "utf-8");
    if (!serverSrc.includes('"/api/version"')) {
      violations.push({
        subject: "prototype/dashboard/server.ts",
        severity: "fail",
        message:
          "server.ts does not contain a /api/version handler. This endpoint is required so the post-merge hook and operators can inspect which git commit the running server was built from. Restore it from D-STALE-SERVER-PREVENTION.",
      });
    }
    if (!serverSrc.includes("GIT_HASH")) {
      violations.push({
        subject: "prototype/dashboard/server.ts",
        severity: "fail",
        message:
          "server.ts does not capture GIT_HASH at startup. The /api/version endpoint requires this constant to report the running server's git commit. Restore it from D-STALE-SERVER-PREVENTION.",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint

if (import.meta.main) {
  const r = run();

  const fails = r.violations.filter((v) => v.severity === "fail");
  const warns = r.violations.filter((v) => v.severity === "warn");

  console.log(
    JSON.stringify({
      level: r.ok ? (warns.length > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      findings: r.violations.length,
      fails: fails.length,
      warns: warns.length,
      ok: r.ok,
      msg: r.ok
        ? "server-version-vs-head check passed — stale-server prevention infrastructure is in place."
        : `server-version-vs-head check FAILED — ${fails.length} finding(s). Stale-server prevention infrastructure is missing or broken.`,
      detail: r.violations,
    }),
  );

  process.exit(r.ok ? 0 : 1);
}
