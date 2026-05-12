// platform/recon/document-registration.ts
//
// Vera continuous-controls pipeline: document-registration.
//
// Asserts that every `Policies/*.md` file in the repository has a
// corresponding `DocumentRegistered` event in the event store whose
// `contentHash` matches the file's current BLAKE3 hash. Any file
// without a matching event — or with an event whose hash does not match
// the file's current content — is reported as a `fail` violation.
//
// **Purpose.** This is the "auto-emit on commit" CI gate from
// D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12). It enforces
// Principle 1: every canonical policy document has a typed event on the
// event log. Prose-without-event is a P1 violation.
//
// **How it works:**
//   1. Scan `Policies/*.md` from the repo root (non-recursive; README.md
//      is skipped by convention — it is not a policy document).
//   2. Compute the BLAKE3 hash of each file's current content.
//   3. Query the event store for `DocumentRegistered` events whose
//      `filePath` matches the repo-relative path.
//   4. For each file:
//      - If no `DocumentRegistered` event exists → `fail` violation.
//      - If a `DocumentRegistered` event exists but its `contentHash`
//        does not match the current file hash → `fail` violation.
//      - If a matching event exists with a matching hash → pass.
//
// **Empty-store posture.** On a fresh runner with no `.local/event.db`
// (GitHub Actions, first boot), the store has no `DocumentRegistered`
// events. A missing-event finding is still a real violation: the
// backfill script must be run before CI can pass. This is intentional —
// the CI gate is only green once the events are in the store.
//
// **Advisory vs enforcing.** This pipeline is `enforcing` by default:
// `fail`-severity violations flip `ok` to `false`. The `mode` option
// allows callers (tests) to soften to `advisory` (findings at `warn`,
// `ok: true`).
//
// P1 — events are the only source of truth: every policy document must
//   have a backing DocumentRegistered event with a matching content hash.
// P2 — single-graph discipline: the document is a node in the policy →
//   obligation → procedure → capability chain; the event is the typed
//   anchor for that node.
//
// Authority: D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
// Author: Vera (Internal audit engineer, engineering — functionally to
//         Thandiwe (Chief Audit Executive, governance); administratively
//         through the CEO).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { hashContent } from "../document-store/hash";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "document-registration";

// Files in Policies/ that are infrastructure, not policy documents.
const SKIP_BASENAMES = new Set(["README.md"]);

// ---------------------------------------------------------------------------
// Repo-root resolver
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up from recon dir)");
}

// ---------------------------------------------------------------------------
// Run options (for test overrides)
// ---------------------------------------------------------------------------

export interface DocumentRegistrationRunOpts {
  /**
   * When `"advisory"`, violations are emitted at `warn` severity and
   * `ok` is always `true`. Default: `"enforcing"` (violations at `fail`,
   * `ok` flips to `false`).
   */
  readonly mode?: "enforcing" | "advisory";
  /**
   * Test override: map of repo-relative path → file content. Skips
   * real filesystem reads for the matched paths.
   */
  readonly fileOverrides?: ReadonlyMap<string, string>;
  /**
   * Test override: map of repo-relative path → DocumentRegistered event
   * payload (content hash only needed). If provided, bypasses the live
   * event store for matching paths.
   */
  readonly eventOverrides?: ReadonlyMap<string, string | null>; // path → hash or null
}

// ---------------------------------------------------------------------------
// Main pipeline export
// ---------------------------------------------------------------------------

export function run(opts: DocumentRegistrationRunOpts = {}): ReconResult {
  const mode = opts.mode ?? "enforcing";
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // ---------------------------------------------------------------------------
  // 1. Locate repo root and Policies/ directory
  // ---------------------------------------------------------------------------
  const repoRoot = findRepoRoot(import.meta.dir);
  const policiesDir = resolve(repoRoot, "Policies");

  if (!existsSync(policiesDir)) {
    // Policies/ does not exist yet — no files to check, no violations.
    return { ...result, ok: true, asserted: 0, violations: [] };
  }

  // ---------------------------------------------------------------------------
  // 2. Enumerate Policies/*.md files
  // ---------------------------------------------------------------------------
  let policyFiles: string[];
  try {
    policyFiles = readdirSync(policiesDir)
      .filter((f) => f.endsWith(".md") && !SKIP_BASENAMES.has(f))
      .filter((f) => {
        try {
          return statSync(resolve(policiesDir, f)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    policyFiles = [];
  }

  if (policyFiles.length === 0) {
    return { ...result, ok: true, asserted: 0, violations: [] };
  }

  // ---------------------------------------------------------------------------
  // 3. Build index of DocumentRegistered events keyed by filePath
  //    (repo-relative, e.g. "Policies/liquidity-risk-management-policy-v1.md")
  //    Latest-wins: if multiple events exist for the same filePath, use
  //    the one with the highest sequence (replay order).
  // ---------------------------------------------------------------------------
  const registeredHashByPath = new Map<string, string>();

  if (opts.eventOverrides) {
    // Test-path: use the overrides directly.
    for (const [path, hash] of opts.eventOverrides) {
      if (hash !== null) registeredHashByPath.set(path, hash);
    }
  } else {
    // Production-path: fold the live event store.
    for (const e of eventStore.replay({ type: "DocumentRegistered" })) {
      const payload = e.payload as Record<string, unknown>;
      const fp = payload.filePath;
      const ch = payload.contentHash;
      if (typeof fp === "string" && typeof ch === "string") {
        // replay() returns events in ascending sequence order — each
        // iteration therefore overwrites the previous value, giving us
        // the latest-wins semantics we want.
        registeredHashByPath.set(fp, ch);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Assert each Policies/*.md file
  // ---------------------------------------------------------------------------
  const failSeverity: ReconViolation["severity"] = mode === "advisory" ? "warn" : "fail";

  for (const basename of policyFiles) {
    const absPath = resolve(policiesDir, basename);
    const repoRelPath = `Policies/${basename}`;
    asserted += 1;

    // Read file content (test override or real filesystem).
    let content: string;
    if (opts.fileOverrides?.has(repoRelPath)) {
      content = opts.fileOverrides.get(repoRelPath) ?? "";
    } else {
      try {
        content = readFileSync(absPath, "utf8");
      } catch {
        violations.push({
          subject: repoRelPath,
          message: `Could not read file at ${absPath}`,
          severity: failSeverity,
        });
        continue;
      }
    }

    const currentHash = hashContent(content);
    const registeredHash = registeredHashByPath.get(repoRelPath);

    if (registeredHash === undefined) {
      violations.push({
        subject: repoRelPath,
        message:
          `No DocumentRegistered event found for ${repoRelPath}. ` +
          `Run \`bun run scripts/backfill-document-registered-2026-05-12.ts\` ` +
          `to emit the missing event, then re-run CI.`,
        severity: failSeverity,
      });
      continue;
    }

    if (registeredHash !== currentHash) {
      violations.push({
        subject: repoRelPath,
        message:
          `DocumentRegistered event exists for ${repoRelPath} but its ` +
          `contentHash (${registeredHash}) does not match the current file ` +
          `hash (${currentHash}). The file was changed after the event was ` +
          `emitted — emit a new DocumentRegistered event for the updated content.`,
        severity: failSeverity,
      });
    }
    // else: matching event + matching hash → pass (no violation)
  }

  const hasFailures = violations.some((v) => v.severity === "fail");
  return {
    pipeline: PIPELINE,
    ok: !hasFailures,
    asserted,
    violations,
    asOf: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint — invoked by `bun run recon:document-registration`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const statusLabel = result.ok ? "PASS" : "FAIL";
  console.log(
    `[${PIPELINE}] ${statusLabel} — ${result.asserted} asserted, ` +
      `${result.violations.length} violation(s)`,
  );
  if (result.violations.length > 0) {
    for (const v of result.violations) {
      const prefix = v.severity === "fail" ? "  FAIL" : v.severity === "warn" ? "  WARN" : "  INFO";
      console.log(`${prefix}  ${v.subject}: ${v.message}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}
