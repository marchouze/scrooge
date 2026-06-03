// platform/recon/seed-manifest-parity.ts
//
// Vera recon: seed-manifest-parity — asserts that the foundational seed
// inventory in `seeds/manifest.ts` is real and wired. Objective 1 of the
// Trusted-Figures Program: a seed may not ship invisibly (every seed must be in
// the manifest, hence on the Seeds page) and the manifest may not list phantom
// seeds (every entry must point at a real source file, and boot ingesters must
// actually be wired into the boot sequence).
//
// Assertions (all blocking):
//   1. seedIds are unique.
//   2. Every entry's `sourcePath` exists on disk.
//   3. Every entry's `dataFile` (when set) exists on disk.
//   4. `boot-ingester` entries: `bootFn` is referenced in dashboard/server.ts.
//   5. `idempotent-script` entries: a `bootFn` is NOT required (run out-of-band).
//   6. Each entry's emittedEventTypes are all registered in EVENT_TYPE_REGISTRY.
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:seed-manifest-parity`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EVENT_TYPE_REGISTRY } from "@platform/event-store/registry";
import { SEED_MANIFEST } from "../../seeds/manifest";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "seed-manifest-parity";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  /** Override the server.ts path (tests). */
  serverPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const prototypeRoot = resolve(repoRoot, "prototype");
  const serverPath = opts.serverPath ?? resolve(prototypeRoot, "dashboard/server.ts");

  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  if (!existsSync(serverPath)) {
    violations.push({
      subject: "server.ts",
      message: `dashboard/server.ts not found at ${serverPath}`,
      severity: "fail",
    });
    result.ok = false;
    result.violations = violations;
    return result;
  }

  const src = readFileSync(serverPath, "utf8");
  const registeredTypes = new Set(EVENT_TYPE_REGISTRY.map((m) => m.type));
  result.asserted = SEED_MANIFEST.length;

  // 1. Unique seedIds.
  const seen = new Set<string>();
  for (const entry of SEED_MANIFEST) {
    if (seen.has(entry.seedId)) {
      violations.push({
        subject: entry.seedId,
        message: `duplicate seedId "${entry.seedId}" in SEED_MANIFEST`,
        severity: "fail",
      });
    }
    seen.add(entry.seedId);
  }

  for (const entry of SEED_MANIFEST) {
    // 2. sourcePath exists.
    const sourceAbs = resolve(prototypeRoot, entry.sourcePath);
    if (!existsSync(sourceAbs)) {
      violations.push({
        subject: entry.seedId,
        message: `seed "${entry.seedId}" sourcePath "${entry.sourcePath}" does not exist on disk`,
        severity: "fail",
      });
    }

    // 3. dataFile exists (when declared).
    if (entry.dataFile) {
      const dataAbs = resolve(prototypeRoot, entry.dataFile);
      if (!existsSync(dataAbs)) {
        violations.push({
          subject: entry.seedId,
          message: `seed "${entry.seedId}" dataFile "${entry.dataFile}" does not exist on disk`,
          severity: "fail",
        });
      }
    }

    // 4. boot-ingester wiring: bootFn must be referenced in server.ts.
    if (entry.source === "boot-ingester") {
      if (!entry.bootFn) {
        violations.push({
          subject: entry.seedId,
          message: `boot-ingester seed "${entry.seedId}" must declare a bootFn (the ingest function wired in bootDerive())`,
          severity: "fail",
        });
      } else {
        const wired = new RegExp(`\\b${entry.bootFn}\\b`).test(src);
        if (!wired) {
          violations.push({
            subject: entry.seedId,
            message: `boot-ingester seed "${entry.seedId}" bootFn ${entry.bootFn}() is not referenced in dashboard/server.ts — it must be wired into bootDerive()`,
            severity: "fail",
          });
        }
      }
    }

    // 6. Emitted event types registered.
    for (const t of entry.emittedEventTypes) {
      if (!registeredTypes.has(t)) {
        violations.push({
          subject: entry.seedId,
          message: `seed "${entry.seedId}" declares emitted event type "${t}" which is not in EVENT_TYPE_REGISTRY`,
          severity: "fail",
        });
      }
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} manifest seed(s) checked, all sources present and wired`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} manifest seed(s) checked, ${fails.length} parity violation(s)`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
