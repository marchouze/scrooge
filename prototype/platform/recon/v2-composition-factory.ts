// platform/recon/v2-composition-factory.ts
//
// recon:v2-composition-factory (advisory) — the S6 composition-factory seam
// gate (WS-V2-BBAAS). Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
// D-MODEL-BINDING-CONTRACT-V1; D-FIL-FRAMEWORK-UNIFICATION.
//
// ─── THE INVARIANT THIS GUARDS ──────────────────────────────────────────────
// Composite-instrument construction in v2-core must flow through the FACTORY
// ALIAS (`composition-factory-alias.ts`: `buildComposite` /
// `resolveCompositionFactory`), so the construction implementation stays
// swappable behind a single seam (the strangler/cutover pattern — same shape as
// the SA-CCR alias-flip). Two failure modes are surfaced:
//
//   (1) The alias must RESOLVE — `resolveCompositionFactory()` returns a factory
//       with a non-empty `implId` (the seam is live, not dangling). Asserted by
//       importing and calling the alias.
//   (2) No v2-core module may BYPASS the seam by importing the concrete factory's
//       `build`/`defaultCompositionFactory` directly to assemble composites. The
//       only modules permitted to reference the concrete factory are the factory
//       module itself, the alias module (which wires the default), and tests.
//       Every other consumer goes through `buildComposite`.
//
// This is the construction-path analogue of `recon:ccr-single-emitter` (which
// guards the CCR emission path): one sanctioned seam, no ad-hoc bypass.
//
// ADVISORY: S6 proves the seam in isolation; the factory is not yet wired into
// the FIL-instance backfill (brief out-of-scope), so today there are no
// in-tree consumers to violate (2). The gate ships advisory so it never blocks
// CI on the absence of consumers, while standing ready to catch the FIRST
// bypass when later waves wire construction in.
//
// SOURCE OF TRUTH: a controlled static scan over `v2-core/**` (excluding tests,
// the factory module, and the alias module) + a live resolve of the alias.
// P6 — reads files + one pure import; no runtime boot.
//
// Author: Atlas (Substrate Architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-composition-factory";

/** The concrete factory module (relative to prototype/) — the bypass target. */
const CONCRETE_FACTORY_MODULE = "v2-core/fil-core/composition-factory";
/** The alias module — the sanctioned seam. */
const ALIAS_MODULE = "v2-core/fil-core/composition-factory-alias";

/**
 * Symbols whose import-from-the-CONCRETE-factory signals a bypass of the seam.
 * The concrete `build` / the `defaultCompositionFactory` instance are the
 * construction entrypoints; importing them directly (outside the alias module)
 * builds composites WITHOUT the swappable indirection.
 */
const BYPASS_SYMBOLS = ["defaultCompositionFactory", "buildComposite"] as const;

// ---------------------------------------------------------------------------
// Repo layout — walk up to prototype/ (contains platform/ + runtime/).
// ---------------------------------------------------------------------------

function findPrototypeRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "platform")) && existsSync(resolve(dir, "runtime"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate prototype root (platform/ + runtime/ not found by walking up)");
}

const PROTO_ROOT = findPrototypeRoot(import.meta.dir);
const V2_CORE_DIR = resolve(PROTO_ROOT, "v2-core");

// ---------------------------------------------------------------------------
// Scan scope — v2-core only. The seam is a v2-core construct; v1 code-line is
// out of scope (and cannot import v2-core: recon:v2-no-v1-import).
// ---------------------------------------------------------------------------

/** Files allowed to reference the concrete factory (relative to prototype/). */
const ALLOWED_CONCRETE_REFERENCES = new Set<string>([
  `${CONCRETE_FACTORY_MODULE}.ts`, // the factory module itself
  `${ALIAS_MODULE}.ts`, // the alias wires the default factory
]);

function isExcluded(rel: string): boolean {
  if (rel.endsWith(".test.ts")) return true; // tests exercise both surfaces
  return ALLOWED_CONCRETE_REFERENCES.has(rel);
}

function walkTsFiles(dir: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules") continue;
      walkTsFiles(full, acc);
    } else if (entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
}

/** Does `source` import a bypass symbol from the CONCRETE factory module? */
export function importsConcreteFactory(source: string): boolean {
  // Match an import whose specifier ends in the concrete factory module path
  // (e.g. "./composition-factory", "../fil-core/composition-factory") and which
  // is NOT the alias module (whose path ends differently: "-alias").
  const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']*composition-factory)["']/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
  while ((m = importRe.exec(source)) !== null) {
    const specifier = m[2] ?? "";
    if (specifier.endsWith("-alias")) continue; // the sanctioned seam — allowed
    const named = (m[1] ?? "").split(",").map((s) => s.trim());
    if (named.some((n) => BYPASS_SYMBOLS.some((b) => n === b || n.startsWith(`${b} `)))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Pipeline.
// ---------------------------------------------------------------------------

export async function runAsync(): Promise<ReconResult> {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) The alias resolves to a live factory with a non-empty implId.
  result.asserted += 1;
  let aliasImplId = "";
  try {
    const alias = await import("../../v2-core/fil-core/composition-factory-alias");
    const factory = alias.resolveCompositionFactory();
    aliasImplId = factory?.implId ?? "";
    if (!aliasImplId) {
      violations.push({
        subject: "alias-resolution",
        message:
          "resolveCompositionFactory() returned no factory (empty implId). The composition-factory alias is dangling — the construction seam is not live.",
        severity: "fail",
      });
    }
  } catch (e) {
    violations.push({
      subject: "alias-resolution",
      message: `failed to import/resolve the composition-factory alias: ${(e as Error).message}`,
      severity: "fail",
    });
  }

  // (2) No v2-core module bypasses the seam by importing the concrete factory.
  result.asserted += 1;
  const files: string[] = [];
  walkTsFiles(V2_CORE_DIR, files);
  const bypassers: string[] = [];
  for (const abs of files) {
    const rel = relative(PROTO_ROOT, abs);
    if (isExcluded(rel)) continue;
    const source = readFileSync(abs, "utf8");
    if (importsConcreteFactory(source)) bypassers.push(rel);
  }
  bypassers.sort();
  if (bypassers.length > 0) {
    violations.push({
      subject: "seam-bypass",
      message: `${bypassers.length} v2-core module(s) import the concrete composition factory directly, bypassing the alias seam: ${bypassers.join(
        ", ",
      )}. Composite construction must flow through \`buildComposite\` / the alias so the construction path stays swappable (D-FIL-FRAMEWORK-UNIFICATION; the strangler-seam pattern).`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `v2-composition-factory: alias implId=${aliasImplId || "UNRESOLVED"}; ${bypassers.length} seam-bypass(es) [${
    bypassers.join(", ") || "none"
  }]; scanned ${files.length} v2-core file(s).`;
  return result;
}

if (import.meta.main) {
  runAsync().then((r) => {
    for (const v of r.violations) {
      process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
    }
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
          ? "v2 composition-factory seam OK — alias resolves; no v2-core module bypasses it"
          : "v2 composition-factory seam FAILED — see violations",
      }),
    );
    process.exit(r.ok ? 0 : 1);
  });
}
