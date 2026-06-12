// platform/recon/v2-no-v1-import.ts
//
// LOAD-BEARING STRUCTURAL GATE — the no-v1-import boundary (V2 S0).
//
// The v2 core package (`v2-core/`) is a FRESH code-line with a HARD no-v1-import
// boundary (D-V2-REPO-STRATEGY-REEXAMINATION: mono-repo, two packages, v2 core
// FIL-first and entity-generic). This gate FAILS if any file under `v2-core/`
// imports from the v1 code-line: `platform/`, `runtime/`, `domains/`,
// `dashboard/`, `projections/`, `simulators/`, `scenarios/`, `seeds/`,
// `scripts/`, `tests/` — whether by a relative path escaping the package or by
// the `@platform/`/`@domains/`/`@simulators/` path aliases.
//
// WHY THIS GATE IS V1 INFRA (not inside the package): recon infrastructure
// (`./types`, `node:fs`) is v1 code; the package must not import it, so a recon
// that CHECKS v2 lives on the v1 side. The dependency direction v1→v2 is the
// permitted one (v1 is the seed tenant; v2 never reaches back). A regression
// test (`v2-no-v1-import.test.ts`) constructs a violating import string and
// asserts this gate flags it.
//
// Authority: D-V2-REPO-STRATEGY-REEXAMINATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
// (S0). Principle 2 (single-graph discipline — the boundary is a topology
// invariant).
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/** Absolute path to the v2 core package root (prototype/v2-core). */
const V2_CORE_DIR = resolve(import.meta.dir, "..", "..", "v2-core");

/**
 * The v1 code-line directory names. An import is a boundary violation if it
 * resolves into any of these. Node builtins (`node:*`), npm packages (bare
 * specifiers like `zod`), and intra-package relative imports are permitted.
 */
const V1_DIRS = [
  "platform",
  "runtime",
  "domains",
  "dashboard",
  "projections",
  "simulators",
  "scenarios",
  "seeds",
  "scripts",
  "tests",
] as const;

/** Path-alias prefixes that resolve into the v1 tree (tsconfig `paths`). */
const V1_ALIAS_PREFIXES = ["@platform/", "@domains/", "@simulators/"] as const;

const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Classify a single import specifier from a file inside `v2-core/`. Returns a
 * violation message iff the specifier reaches the v1 code-line, else null.
 */
export function classifyImport(fromFileAbs: string, specifier: string): string | null {
  // Bare specifiers: npm package or node builtin — permitted (e.g. `zod`,
  // `node:fs`). A bare specifier never reaches the v1 tree.
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    for (const alias of V1_ALIAS_PREFIXES) {
      if (specifier.startsWith(alias)) {
        return `imports v1 alias "${specifier}" — v2-core must not import the v1 code-line`;
      }
    }
    return null;
  }

  // Relative/absolute: resolve and check whether it escapes v2-core into a v1 dir.
  const resolved = resolve(fromFileAbs, "..", specifier);
  if (resolved.startsWith(`${V2_CORE_DIR}/`) || resolved === V2_CORE_DIR) {
    return null; // intra-package — permitted
  }
  // Outside the package: find which top-level repo dir it lands in.
  const repoRoot = resolve(V2_CORE_DIR, "..");
  if (resolved.startsWith(`${repoRoot}/`)) {
    const rel = resolved.slice(repoRoot.length + 1);
    const topDir = rel.split("/")[0];
    if (topDir && (V1_DIRS as readonly string[]).includes(topDir)) {
      return `imports v1 path "${specifier}" (→ ${topDir}/…) — v2-core must not import the v1 code-line`;
    }
  }
  // Escapes the package but not into a known v1 dir — still a boundary breach.
  return `import "${specifier}" escapes the v2-core package boundary`;
}

export function run(): ReconResult {
  const result = emptyResult("v2-no-v1-import");
  const files = listTsFiles(V2_CORE_DIR);
  const violations: ReconViolation[] = [];

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null = IMPORT_RE.exec(src);
    while (m !== null) {
      const specifier = m[1] ?? m[2] ?? m[3];
      if (specifier) {
        result.asserted += 1;
        const problem = classifyImport(file, specifier);
        if (problem) {
          violations.push({
            subject: file.slice(V2_CORE_DIR.length + 1),
            message: problem,
            severity: "fail",
          });
        }
      }
      m = IMPORT_RE.exec(src);
    }
  }

  result.violations = violations;
  return { ...result, ok: violations.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(
    `recon:v2-no-v1-import — asserted ${r.asserted} imports across v2-core; ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
