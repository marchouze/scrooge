// platform/recon/v2-alias-registry-conformance.ts
//
// recon:v2-alias-registry-conformance — the SHARED FIL alias-registry
// conformance gate (WS-V2-BBAAS). Authority: D-FIL-SHARED-ALIAS-REGISTRY
// (CEO-approved 2026-06-13); D-FIL-FRAMEWORK-UNIFICATION;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
//
// ─── THE INVARIANT THIS GUARDS ──────────────────────────────────────────────
// Every swappable seam in v2-core resolves through the ONE shared alias-registry
// (`v2-core/fil-core/alias-registry.ts`), under a namespaced key. No v2-core
// module mints its OWN ad-hoc alias singleton (a module-level mutable holding a
// swappable implementation, with a bespoke register / swap / restore surface).
// Two failure modes are surfaced:
//
//   (1) The shared registry RESOLVES every known seam — the composition-factory
//       alias and the SA-CCR model alias both resolve to a live implementation
//       (the seams are migrated and live, not dangling). Asserted by importing
//       and resolving each alias accessor.
//   (2) No v2-core module mints an ad-hoc alias singleton: a module that
//       declares a module-scope mutable (`let`/`var`) reassigned inside an
//       exported function that returns a `restore()` handle — the swap-seam
//       shape — WITHOUT importing the shared `alias-registry`. The only module
//       permitted to hold the swap mutable is the shared registry itself.
//
// This is the alias-substrate analogue of `recon:v2-composition-factory` (which
// guards one specific seam's bypass) and `recon:ccr-single-emitter` (which
// guards the CCR emission path): one sanctioned substrate, no ad-hoc per-seam
// singleton.
//
// SOURCE OF TRUTH: a controlled static scan over `v2-core/**` (excluding tests
// and the shared registry module) + a live resolve of each known seam alias.
// P6 — reads files + pure imports; no runtime boot.
//
// Author: Atlas (Substrate Architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-alias-registry-conformance";

/** The shared alias-registry module (relative to prototype/) — the one substrate. */
const SHARED_REGISTRY_MODULE = "v2-core/fil-core/alias-registry.ts";

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
// Scan scope — v2-core only. The shared registry is a v2-core construct; v1
// code-line is out of scope (and cannot import v2-core: recon:v2-no-v1-import).
// ---------------------------------------------------------------------------

function isExcluded(rel: string): boolean {
  if (rel.endsWith(".test.ts")) return true; // tests legitimately mint sentinel impls
  if (rel === SHARED_REGISTRY_MODULE) return true; // the substrate itself holds the mutable
  return false;
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

/** Does `source` import from the shared alias-registry module? */
export function importsSharedRegistry(source: string): boolean {
  // Any import whose specifier path ends in `alias-registry` (e.g.
  // "./alias-registry", "../../fil-core/alias-registry").
  return /from\s+["'][^"']*\/?alias-registry["']/.test(source);
}

/**
 * Does `source` mint an AD-HOC alias singleton — the swap-seam shape WITHOUT the
 * shared registry? The signal is the conjunction of:
 *   - a module-scope mutable holding the swappable impl (`let ` / `var ` at the
 *     left margin — not inside a function body), AND
 *   - an exported swap surface that returns a `restore()` handle (the cutover /
 *     rollback primitive — `restore()` is the seam's tell).
 * A module that exhibits BOTH but does not import the shared registry is minting
 * its own singleton. (A module that imports the shared registry is conformant by
 * construction — it delegates the mutable to the substrate.)
 */
export function mintsAdHocAliasSingleton(source: string): boolean {
  if (importsSharedRegistry(source)) return false; // delegates to the substrate
  const hasModuleScopeMutable = /^(?:let|var)\s+\w+/m.test(source);
  const hasRestoreHandle = /\brestore\s*\(\s*\)/.test(source);
  return hasModuleScopeMutable && hasRestoreHandle;
}

// ---------------------------------------------------------------------------
// Pipeline.
// ---------------------------------------------------------------------------

export async function runAsync(): Promise<ReconResult> {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Every known seam resolves through the shared registry.
  const seamResolutions: string[] = [];
  result.asserted += 1;
  try {
    const cf = await import("../../v2-core/fil-core/composition-factory-alias");
    const factory = cf.resolveCompositionFactory();
    const implId = factory?.implId ?? "";
    if (!implId) {
      violations.push({
        subject: "composition-factory-resolution",
        message:
          "resolveCompositionFactory() returned no factory (empty implId) — the composition-factory seam does not resolve through the shared alias-registry.",
        severity: "fail",
      });
    } else {
      seamResolutions.push(`fil-core:composition-factory=${implId}`);
    }
  } catch (e) {
    violations.push({
      subject: "composition-factory-resolution",
      message: `failed to import/resolve the composition-factory alias via the shared registry: ${(e as Error).message}`,
      severity: "fail",
    });
  }

  result.asserted += 1;
  try {
    const saccr = await import("../../v2-core/fil-models/sa-ccr/model-alias");
    const fn = saccr.resolveSaCcrModel();
    if (typeof fn !== "function") {
      violations.push({
        subject: "sa-ccr-model-resolution",
        message:
          "resolveSaCcrModel() did not return a function — the SA-CCR model seam does not resolve through the shared alias-registry.",
        severity: "fail",
      });
    } else {
      seamResolutions.push(`fil-models:sa-ccr=${saccr.SA_CCR_MODEL_ALIAS}`);
    }
  } catch (e) {
    violations.push({
      subject: "sa-ccr-model-resolution",
      message: `failed to import/resolve the SA-CCR model alias via the shared registry: ${(e as Error).message}`,
      severity: "fail",
    });
  }

  // (2) No v2-core module mints its own ad-hoc alias singleton.
  result.asserted += 1;
  const files: string[] = [];
  walkTsFiles(V2_CORE_DIR, files);
  const offenders: string[] = [];
  for (const abs of files) {
    const rel = relative(PROTO_ROOT, abs);
    if (isExcluded(rel)) continue;
    const source = readFileSync(abs, "utf8");
    if (mintsAdHocAliasSingleton(source)) offenders.push(rel);
  }
  offenders.sort();
  if (offenders.length > 0) {
    violations.push({
      subject: "ad-hoc-alias-singleton",
      message: `${offenders.length} v2-core module(s) mint an ad-hoc alias singleton (a module-scope swap mutable + a restore() handle) WITHOUT resolving through the shared alias-registry: ${offenders.join(
        ", ",
      )}. Every swappable seam must register its default + resolve through \`v2-core/fil-core/alias-registry.ts\` (D-FIL-SHARED-ALIAS-REGISTRY — one substrate, no per-seam singleton).`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `v2-alias-registry-conformance: seams resolved [${
    seamResolutions.join(", ") || "none"
  }]; ${offenders.length} ad-hoc singleton(s) [${
    offenders.join(", ") || "none"
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
          ? "v2 alias-registry conformance OK — every seam resolves through the shared registry; no ad-hoc singleton"
          : "v2 alias-registry conformance FAILED — see violations",
      }),
    );
    process.exit(r.ok ? 0 : 1);
  });
}
