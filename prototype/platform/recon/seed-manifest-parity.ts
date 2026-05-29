// platform/recon/seed-manifest-parity.ts
//
// Vera recon: seed-manifest-parity — asserts that the boot-seed inventory in
// `seeds/manifest.ts` is in lock-step with the actual boot sequence in
// `dashboard/server.ts`'s `bootDerive()`. Objective 1 of the Trusted-Figures
// Program: a boot seed may not ship invisibly (every seed must be in the
// manifest, hence on the Seeds page) and the manifest may not list phantom
// seeds (every manifest entry must be wired into the boot sequence).
//
// Assertions (all blocking):
//   1. seedIds are unique.
//   2. Each descopable manifest entry is wired as `runSeed("<seedId>", <bootFn>)`
//      in server.ts — so it honours SeedDescoped.
//   3. Each non-descopable manifest entry's `<bootFn>` is called directly.
//   4. Every `runSeed("X", ...)` call in server.ts references a manifest seedId.
//   5. Each entry's emittedEventTypes are all registered in EVENT_TYPE_REGISTRY.
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
  const serverPath = opts.serverPath ?? resolve(repoRoot, "prototype/dashboard/server.ts");

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
    // 2 / 3. Boot wiring.
    if (entry.descopable) {
      const runSeedPattern = new RegExp(
        `runSeed\\(\\s*["']${entry.seedId}["']\\s*,\\s*${entry.bootFn}\\b`,
      );
      if (!runSeedPattern.test(src)) {
        violations.push({
          subject: entry.seedId,
          message: `descopable seed "${entry.seedId}" must be wired as runSeed("${entry.seedId}", ${entry.bootFn}) in bootDerive() so it honours SeedDescoped — not found in server.ts`,
          severity: "fail",
        });
      }
    } else {
      const directCall = new RegExp(`\\b${entry.bootFn}\\(`);
      if (!directCall.test(src)) {
        violations.push({
          subject: entry.seedId,
          message: `structural seed "${entry.seedId}" boot function ${entry.bootFn}() is not called in server.ts`,
          severity: "fail",
        });
      }
    }

    // 5. Emitted event types registered.
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

  // 4. Every runSeed("X", ...) in server.ts references a known seedId.
  const manifestIds = new Set(SEED_MANIFEST.map((e) => e.seedId));
  const runSeedCalls = [...src.matchAll(/runSeed\(\s*["']([^"']+)["']/g)];
  for (const m of runSeedCalls) {
    const id = m[1];
    if (id && !manifestIds.has(id)) {
      violations.push({
        subject: id,
        message: `server.ts calls runSeed("${id}", ...) but "${id}" has no SEED_MANIFEST entry — every boot seed must be in the manifest (Seeds page parity)`,
        severity: "fail",
      });
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
      `recon:${PIPELINE} OK — ${result.asserted} manifest seed(s) checked, all in parity with bootDerive()`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} manifest seed(s) checked, ${fails.length} parity violation(s)`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
