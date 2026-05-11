// platform/recon/runtime-handler-sync.ts
//
// Continuous-controls pipeline: runtime handler-sync integrity (Vera Wave-4 #11).
//
// `runtime/handlers-metadata.ts` and `runtime/handler-callables.ts` are dual
// sources of truth for the runtime handler registry. The startup-validate in
// `runtime/run.ts` throws at module load if either side is missing a key —
// but only when the runtime is actually booted. With 24 handlers and growing,
// silent drift is the failure mode: a new handler lands and only one side is
// updated, then breaks the next runtime boot rather than CI.
//
// This pipeline is the **continuous-controls assertion** — runs in CI / on
// every recon-harness invocation and asserts the two stay in sync without
// needing the runtime to boot, so drift is caught at PR time.
//
// What this pipeline asserts:
//
//   1. Every key in `HANDLERS_METADATA` has a matching key in
//      `HANDLER_CALLABLES`.
//   2. Every key in `HANDLER_CALLABLES` has a matching entry in
//      `HANDLERS_METADATA`.
//   3. The agent name in metadata resolves to a real persona file at
//      `Team/<Name>.md` (e.g. metadata.agent === "Yael" must imply
//      `Team/Yael.md` exists). Mandate-ownership integrity for runtime
//      handlers — agents must be real personas.
//   4. The (agent, trigger) pair is exposed as a runnable npm script in
//      `prototype/package.json` — `agent:<lowercased-agent>-<trigger>`.
//      The script is what GitHub Actions / cron / operators invoke; if
//      the metadata declares a handler with no script, the handler is
//      undispatchable in production.
//
// P6 — upward chain. Independent of any first-line module; reads files only
// (and pure metadata imports without runtime side-effects).
//
// Author: Vera

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { HANDLER_CALLABLES } from "../../runtime/handler-callables";
import { HANDLERS_METADATA } from "../../runtime/handlers-metadata";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const TEAM_DIR = resolve(REPO_ROOT, "Team");
const PACKAGE_JSON = resolve(REPO_ROOT, "prototype/package.json");

export interface MetadataInput {
  readonly key: string;
  readonly agent: string;
  readonly trigger: string;
  /**
   * Trigger kind. Defaults to "scheduled" for synthetic test inputs that
   * omit it. `event-driven` handlers are skipped from the npm-script
   * assertion because they are dispatched by the runtime event-bus
   * (e.g. follow-on-router), not by an operator-invoked script.
   */
  readonly kind?: "scheduled" | "event-driven" | "on-request";
}

export interface RunOpts {
  /** Override metadata source for tests. */
  metadata?: ReadonlyArray<MetadataInput>;
  /** Override callable keys for tests. */
  callableKeys?: ReadonlyArray<string>;
  /** Override package.json path for tests. */
  packageJsonPath?: string;
  /** Override Team dir for tests. */
  teamDir?: string;
}

interface PackageJson {
  scripts?: Record<string, string>;
}

function loadScripts(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as PackageJson;
  return parsed.scripts ?? {};
}

function personaFileExists(agent: string, teamDir: string): boolean {
  return existsSync(resolve(teamDir, `${agent}.md`));
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("runtime-handler-sync-integrity");
  const violations: ReconViolation[] = [];

  const metadata: ReadonlyArray<MetadataInput> =
    opts.metadata ??
    HANDLERS_METADATA.map((m) => ({
      key: m.key,
      agent: m.agent,
      trigger: m.trigger,
      kind: m.kind,
    }));
  const callableKeys = opts.callableKeys ?? Object.keys(HANDLER_CALLABLES);
  const teamDir = opts.teamDir ?? TEAM_DIR;
  const packageJsonPath = opts.packageJsonPath ?? PACKAGE_JSON;

  const callableSet = new Set(callableKeys);
  const metadataKeys = new Set(metadata.map((m) => m.key));
  const scripts = loadScripts(packageJsonPath);

  // Assertion 1: every metadata key has a callable.
  for (const m of metadata) {
    result.asserted++;
    if (!callableSet.has(m.key)) {
      violations.push({
        subject: m.key,
        message: `Metadata declares ${m.key} but HANDLER_CALLABLES has no entry. Add the callable to runtime/handler-callables.ts.`,
        severity: "fail",
      });
    }
  }

  // Assertion 2: every callable key has metadata.
  for (const key of callableKeys) {
    result.asserted++;
    if (!metadataKeys.has(key)) {
      violations.push({
        subject: key,
        message: `HANDLER_CALLABLES has ${key} but runtime/handlers-metadata.ts has no row. Add a metadata entry.`,
        severity: "fail",
      });
    }
  }

  // Assertion 3: agent name in metadata resolves to a Team/<Name>.md persona file.
  for (const m of metadata) {
    result.asserted++;
    if (!personaFileExists(m.agent, teamDir)) {
      violations.push({
        subject: m.key,
        message: `Metadata agent "${m.agent}" has no persona file at Team/${m.agent}.md. Runtime handlers must own a real persona (Principle 6 — every step has a named, accountable owner).`,
        severity: "fail",
      });
    }
  }

  // Assertion 4: the (agent, trigger) pair is exposed as an npm script —
  // skipped for event-driven handlers (dispatched by the runtime event-bus,
  // not operator-invoked).
  for (const m of metadata) {
    if (m.kind === "event-driven") continue;
    result.asserted++;
    const expectedScript = `agent:${m.agent.toLowerCase()}-${m.trigger}`;
    if (!scripts[expectedScript]) {
      violations.push({
        subject: m.key,
        message: `Metadata declares ${m.key} but prototype/package.json has no "${expectedScript}" script. Without it the handler is undispatchable from CI / GitHub Actions.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
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
        ? "Runtime handler-sync integrity passed"
        : "Runtime handler-sync integrity FAILED — drift between handlers-metadata.ts, handler-callables.ts, /Team/, and package.json",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
