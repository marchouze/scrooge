// platform/recon/store-inventory-coverage.ts
//
// recon:store-inventory-coverage — fail-closed coverage gate for the canonical
// store inventory (platform/config/store-inventory.ts).
//
// THE INVARIANT
// -------------
// Every persistent data store the bank runs MUST appear in `STORE_INVENTORY` so
// the V2 "Bank Config" page advertises it and it carries an explicit tier. A new
// store is introduced by adding a `BANK_*_DB` store-path env var (the resolution
// seam). This gate scans the source tree for every such env var and asserts each
// one is inventoried — so a new store cannot be added without being advertised.
//
// KNOWN NON-STORE-PATH ENV VARS
// -----------------------------
// Two `BANK_*_DB` env vars are NOT store paths and are EXPLICITLY excluded (named
// here, never silently): `BANK_HOME_EVENT_DB` is the cross-worktree event-store
// SYNC precedence pointer (it resolves to the SAME event.db the inventory already
// lists), and `BANK_TEST_USE_AMBIENT_DB` is a test-only boolean flag. Both are
// listed below so the exclusion is auditable; any NEW `BANK_*_DB` env var that is
// neither inventoried nor on this list fails the gate.
//
// ADVISORY → ENFORCING: launches ENFORCING (the tree is clean today — every
// store-path env var is inventoried). Harden-only.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25). Engineering
// Charter D-ENGINEERING-INTEGRITY-CHARTER (cmd 2 fail-closed; cmd 4 source-don't-
// hardcode; cmd 5 no-silent-deferral). Principle 2 (single-graph discipline —
// every store on one citable axis).
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { inventoryEnvVars } from "../config/store-inventory";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "store-inventory-coverage";

/**
 * `BANK_*_DB` env vars that are NOT store paths — named explicitly so the
 * exclusion is auditable (Charter cmd 5: no silent deferral). A new env var that
 * is neither inventoried nor on this list is a FAIL.
 */
const KNOWN_NON_STORE_ENV_VARS: ReadonlySet<string> = new Set([
  // Cross-worktree event-store SYNC precedence pointer — resolves to the SAME
  // canonical event.db the inventory already lists (CLAUDE.md cross-worktree
  // event-store sync). Not a distinct store.
  "BANK_HOME_EVENT_DB",
  // Test-only boolean: opt the test suite into the ambient store instead of a
  // tmpdir. Not a path.
  "BANK_TEST_USE_AMBIENT_DB",
]);

/**
 * Discovery pattern for NEW stores: the store-path env-var naming convention is
 * `BANK_*_DB`. A new store introduces a new `BANK_*_DB` token; the forward check
 * asserts each such token is inventoried. (Two inventoried stores predate the
 * convention — `BANK_DOCUMENT_STORE`, `BANK_ARCHIVE_DIR` — and are matched by
 * their literal names in the reverse check, not this pattern.)
 */
const STORE_ENV_RE = /\bBANK_[A-Z0-9_]*_DB\b/g;

/** Source subtrees scanned for store-path env vars. */
const SUBDIRS = ["platform", "v2-core", "dashboard", "runtime", "scripts"] as const;

function listTsFiles(root: string, rel: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(join(root, rel));
  } catch {
    return; // subtree absent in a partial checkout — tolerate, scan the rest.
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const childRel = rel ? join(rel, name) : name;
    const abs = join(root, childRel);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      listTsFiles(root, childRel, out);
    } else if (
      // Production resolvers only — test files mention env-var tokens for
      // fixtures/sabotage cases and are NOT real store resolvers.
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      out.push(childRel);
    }
  }
}

export interface RunOpts {
  readonly prototypeDir?: string;
}

/**
 * Reads every `.ts`/`.tsx` file under the scanned subtrees once. Returns the
 * concatenated corpus so both the discovery scan (`BANK_*_DB` tokens) and the
 * literal-reference check (inventoried env-var names) run over the same text
 * without re-reading the tree.
 */
function readCorpus(prototypeDir: string): string {
  const parts: string[] = [];
  for (const sub of SUBDIRS) {
    const files: string[] = [];
    listTsFiles(prototypeDir, sub, files);
    for (const rel of files) {
      try {
        parts.push(readFileSync(join(prototypeDir, rel), "utf-8"));
      } catch {
        // unreadable file — skip, scan the rest.
      }
    }
  }
  return parts.join("\n");
}

/** Collects every distinct `BANK_*_DB` env var token in the corpus (new-store discovery). */
export function collectStoreEnvVars(corpus: string): Set<string> {
  const found = new Set<string>();
  const matches = corpus.match(STORE_ENV_RE);
  if (matches) for (const m of matches) found.add(m);
  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { asserted: number } {
  const result = emptyResult(PIPELINE) as ReconResult & { asserted: number };
  // recon/ → platform/ → prototype/
  const prototypeDir = opts.prototypeDir ?? resolve(import.meta.dir ?? process.cwd(), "..", "..");

  const inventoried = new Set(inventoryEnvVars());
  const corpus = readCorpus(prototypeDir);
  const discovered = collectStoreEnvVars(corpus);

  const violations: ReconViolation[] = [];

  // (1) Every `BANK_*_DB` store-path env var discovered in the tree must be
  //     inventoried (or an explicitly-named non-store env var). Fail-closed —
  //     this is the load-bearing direction: a NEW store can't ship un-advertised.
  for (const envVar of discovered) {
    if (inventoried.has(envVar)) continue;
    if (KNOWN_NON_STORE_ENV_VARS.has(envVar)) continue;
    violations.push({
      subject: envVar,
      severity: "fail",
      message: `Store-path env var ${envVar} is referenced in the source tree but not in STORE_INVENTORY (platform/config/store-inventory.ts). Add a StoreDescriptor for the store it resolves, or — if it is not a store path — add it to KNOWN_NON_STORE_ENV_VARS with a reason. Authority: D-BANK-CONFIG-STORE.`,
    });
    result.asserted += 1;
  }

  // (2) Every inventoried env var must actually be referenced somewhere (no dead
  //     inventory entry). Matched by LITERAL name so the two convention-predating
  //     stores (BANK_DOCUMENT_STORE, BANK_ARCHIVE_DIR) are recognised too. Warn:
  //     a store may be inventoried ahead of its resolver landing, but a
  //     permanently-unreferenced entry is drift.
  for (const envVar of inventoried) {
    result.asserted += 1;
    if (corpus.includes(envVar)) continue;
    violations.push({
      subject: envVar,
      severity: "warn",
      message: `Inventoried store env var ${envVar} is not referenced by any resolver in the source tree — either wire its resolver or remove the stale StoreDescriptor. Authority: D-BANK-CONFIG-STORE.`,
    });
  }

  if (result.asserted === 0) result.asserted = 1;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

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
        ? `store-inventory-coverage passed (${r.asserted} env vars asserted; ${warns.length} warn)`
        : "store-inventory-coverage FAILED — an un-inventoried store-path env var was found",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
