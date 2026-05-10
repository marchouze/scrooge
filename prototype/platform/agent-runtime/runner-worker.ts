// platform/agent-runtime/runner-worker.ts
//
// S8 §3.4 — AgentRunner worker isolation primitive.
//
// Substrate fix for the three 2026-05-09 lost-work incidents (PR #74
// Atlas, PR #76 Imani, PR #77 Niko) where a Scrooge-dispatched agent
// running in an isolated worktree `cd`'d back to /Users/marc/code/Bank
// (the main worktree) and committed scaffold-files onto the wrong
// branch. Today's mitigation is prompt-discipline ("DO NOT cd to
// /Users/marc/code/Bank" in every dispatch brief) — the substrate fix
// is to make filesystem accesses outside the worktree fail at runtime,
// not at brief-prose level.
//
// This module is the local-first implementation. It exposes a stable
// interface (`RunnerWorker`, `createRunnerWorker`) that the AgentRunner
// imports; the same interface lands on Azure Container Apps Jobs at
// M8 with a no-op `install()` (the container itself enforces the
// boundary). See `Owner Inbox/2026-05-10_atlas_agent-runner-worker-isolation-spike.md`.
//
// Threat coverage:
//   - Accidental escape via `process.chdir(...)` outside the worktree → blocked.
//   - Accidental escape via `node:fs.{read,write,...}Sync(<absolute outside>)` → blocked.
//   - Accidental escape via `node:fs.<*>Sync("../../...")` traversal → blocked.
//
// Threat NOT covered (downstream / cloud-day):
//   - Adversarial agent dropping to `bun:ffi` / N-API / raw syscalls.
//   - `Bun.file` / `Bun.write` / `Bun.spawn` (next slice).
//   - Child-process `cwd` policy (next slice).
//
// Author: Atlas (Core banking platform architect, engineering)

import { createRequire } from "node:module";
import { isAbsolute, relative, resolve } from "node:path";

/**
 * The fs shim patches the **CJS** view of `node:fs`. ESM namespace
 * imports (`import * as fs from "node:fs"`) are bound at import-time
 * and cannot be reassigned post-hoc — those callers escape the shim.
 *
 * This is an honest limitation of in-process accident-prevention:
 *   - The chdir override (process.chdir) is global and catches every
 *     caller regardless of import style.
 *   - The fs shim catches CJS-require callers; ESM callers route
 *     around it.
 *
 * The 2026-05-09 incidents were all chdir escapes (the agent ran a
 * `cd` shell command, or used `process.chdir`), so the chdir override
 * is the load-bearing primitive. The fs shim is a defence-in-depth
 * layer for the most-common Node-style fs callers that happen to be
 * CJS — see Owner Inbox/2026-05-10_atlas_agent-runner-worker-isolation-spike.md
 * §6.2 for the gap envelope.
 */
const fsRequire = createRequire(import.meta.url);

/**
 * Marker symbol stashed on wrapper functions so a subsequent install()
 * can unwrap defensively if a prior dispose() never ran (e.g. a test
 * threw before its `finally` block). Without this, stale wrappers
 * accumulate: the second install() would treat the first wrapper as
 * the "original" and re-wrap, producing a chain that can never be
 * fully restored. The marker lets us walk back to the genuine original.
 */
const ORIGINAL_CHDIR_MARKER: unique symbol = Symbol("runner-worker:original-chdir");
const ORIGINAL_FS_MARKER: unique symbol = Symbol("runner-worker:original-fs-call");

type ChdirWithMarker = typeof process.chdir & {
  [ORIGINAL_CHDIR_MARKER]?: typeof process.chdir;
};

type FsCallWithMarker = ((...args: unknown[]) => unknown) & {
  [ORIGINAL_FS_MARKER]?: (...args: unknown[]) => unknown;
};

/**
 * Typed error thrown when the agent's runtime attempts to access a
 * filesystem path outside its assigned worktree root. The substrate
 * downstream (AgentRunner) wires the `onBoundaryEscape` sink to a
 * `SubstrateAlert` emission so every accidental escape is observable.
 */
export class WorktreeBoundaryError extends Error {
  readonly code = "WORKTREE_BOUNDARY";
  readonly attemptedPath: string;
  readonly worktreeRoot: string;

  constructor(attemptedPath: string, worktreeRoot: string) {
    super(
      `WorktreeBoundaryError: path "${attemptedPath}" escapes worktree root "${worktreeRoot}"`,
    );
    this.name = "WorktreeBoundaryError";
    this.attemptedPath = attemptedPath;
    this.worktreeRoot = worktreeRoot;
  }
}

/**
 * Configuration for a runner-worker bound to a specific worktree root.
 * The contract is intentionally narrow — the substrate's job is to
 * enforce the worktree boundary, not to manage the agent's lifecycle
 * (the AgentRunner does that — S8 spec §3.4).
 */
export interface RunnerWorkerConfig {
  /** Absolute path to the worktree root. Must exist on disk. */
  readonly worktreeRoot: string;
  /**
   * Optional sink for boundary-escape events. The AgentRunner wires
   * this to the `SubstrateAlert` emitter; tests pass an in-memory sink.
   * If omitted, the boundary-escape error is re-thrown at the call site.
   */
  readonly onBoundaryEscape?: (err: WorktreeBoundaryError) => void;
}

/**
 * The runner-worker primitive. Bound to one worktree root for its
 * lifetime; a fresh instance is created per agent run (cheap on the
 * local Bun-worker path; equivalent to a Container App Job spin-up
 * on Azure).
 */
export interface RunnerWorker {
  /** Absolute path to the worktree root. */
  readonly worktreeRoot: string;

  /**
   * Resolve `path` against the worktree root. Returns the absolute,
   * root-resident path. Throws `WorktreeBoundaryError` if the resolved
   * path lands outside the root. This is the canonical resolver every
   * worker-internal fs access routes through; the chdir override and
   * the `node:fs` shim both call it.
   */
  resolveWithinRoot(path: string): string;

  /**
   * Apply the worker's runtime constraints to the current process:
   *   - chdir() to worktreeRoot
   *   - replace process.chdir() with a boundary-checked version
   *   - install node:fs path-resolution sentinels on the most common
   *     path-accepting helpers
   *
   * Idempotent — a second call returns a fresh dispose handle but does
   * not double-wrap. Returns a `dispose()` handle that restores the
   * original behaviours; tests rely on this for hermetic cleanup.
   */
  install(): { dispose: () => void };
}

/**
 * Pure path check — exported for tests and for callers that want the
 * boundary check without the chdir / fs side-effects.
 *
 * Resolves `inputPath` (absolute or relative) against `worktreeRoot`
 * and returns the absolute, normalised path. Throws
 * `WorktreeBoundaryError` if the resolved path is not equal to
 * `worktreeRoot` or a descendant of it.
 *
 * Symlink-following is NOT performed here — `path.resolve` is a pure
 * string operation. A future hardening tranche may add `fs.realpathSync`
 * for symlink-aware checks; today the assumption (consistent with the
 * three incidents) is that the agent is supplying logical paths, not
 * symlink-laundered ones. Adversarial symlink attacks are out of scope
 * per the threat-model envelope.
 */
export function resolveWithinRoot(inputPath: string, worktreeRoot: string): string {
  const root = resolve(worktreeRoot);
  // node:path.resolve treats relative paths as relative to process.cwd()
  // by default. We pin them explicitly to `root` so a worker bound to
  // `/A/worktree-1` always resolves "./foo" under that worktree, never
  // under whatever cwd the host process happens to have.
  const resolved = isAbsolute(inputPath)
    ? resolve(inputPath)
    : resolve(root, inputPath);
  if (resolved === root) {
    return resolved;
  }
  const rel = relative(root, resolved);
  // path.relative returns "" for equal paths (handled above), a string
  // not starting with ".." for descendants, and a string starting with
  // ".." (or an absolute path on Windows) for escapes.
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new WorktreeBoundaryError(inputPath, root);
  }
  return resolved;
}

/**
 * Internal: monkey-patches a `node:fs` method whose first argument is
 * a path. Returns the original handle for restoration in `dispose()`.
 *
 * The first-argument-is-a-path discipline is true for the helpers we
 * shim here (read*, write*, readdir*, exists*, stat*, open*, mkdir*,
 * rm*, unlink*). The shim does NOT cover `fs.copyFile` (two paths) or
 * `fs.symlink` (two paths) — those are tracked as substrate gaps in
 * the design doc §8.
 */
type FsCall = (...args: unknown[]) => unknown;

interface FsPatch {
  readonly key: string;
  readonly original: FsCall;
}

const FS_KEYS_PATCHED: readonly string[] = [
  "readFileSync",
  "writeFileSync",
  "readdirSync",
  "existsSync",
  "statSync",
  "lstatSync",
  "openSync",
  "mkdirSync",
  "rmSync",
  "unlinkSync",
  "appendFileSync",
];

/** Implementation. Local-first; the cloud variant is a separate factory. */
class LocalRunnerWorker implements RunnerWorker {
  readonly worktreeRoot: string;
  private readonly onBoundaryEscape?: (err: WorktreeBoundaryError) => void;
  private installed = false;

  constructor(config: RunnerWorkerConfig) {
    if (!isAbsolute(config.worktreeRoot)) {
      throw new Error(
        `RunnerWorker: worktreeRoot must be an absolute path; got "${config.worktreeRoot}"`,
      );
    }
    // Resolve to canonical form so later comparisons in resolveWithinRoot
    // are stable irrespective of trailing slashes / "." segments.
    this.worktreeRoot = resolve(config.worktreeRoot);
    // exactOptionalPropertyTypes: only assign the field when defined.
    if (config.onBoundaryEscape !== undefined) {
      this.onBoundaryEscape = config.onBoundaryEscape;
    }
  }

  resolveWithinRoot(path: string): string {
    return resolveWithinRoot(path, this.worktreeRoot);
  }

  install(): { dispose: () => void } {
    if (this.installed) {
      // Idempotent re-install — return a no-op disposer so callers can
      // pair install() / dispose() defensively without double-restoring.
      return { dispose: () => {} };
    }
    this.installed = true;

    // 1. Capture the truly-original chdir BEFORE we modify the host.
    //    If a stale wrapper from a prior aborted install() is still in
    //    place (test-suite hygiene), unwrap it first via the marker.
    const currentChdir = process.chdir as ChdirWithMarker;
    const originalChdir: typeof process.chdir =
      currentChdir[ORIGINAL_CHDIR_MARKER] ?? currentChdir.bind(process);

    // 2. chdir into the worktree root using the *original* implementation
    //    (so stale wrappers don't reject a valid root). The next chdir
    //    after we install our wrapper will be checked.
    originalChdir(this.worktreeRoot);

    // 3. Wrap process.chdir.
    const root = this.worktreeRoot;
    const onEscape = (err: WorktreeBoundaryError): never => {
      if (this.onBoundaryEscape) {
        this.onBoundaryEscape(err);
      }
      throw err;
    };
    const wrappedChdir: ChdirWithMarker = ((target: string) => {
      try {
        const safe = resolveWithinRoot(target, root);
        originalChdir(safe);
      } catch (err) {
        if (err instanceof WorktreeBoundaryError) {
          onEscape(err);
        }
        throw err;
      }
    }) as ChdirWithMarker;
    // Stash the original on the wrapper so a subsequent install() can
    // unwrap defensively if dispose() never ran (test-suite hygiene).
    wrappedChdir[ORIGINAL_CHDIR_MARKER] = originalChdir;
    process.chdir = wrappedChdir;

    // 3. Wrap a curated set of node:fs path-accepting helpers. Each
    //    wrapper validates the first argument (the path) through
    //    resolveWithinRoot and then delegates to the original.
    //
    //    Note: only the *Sync helpers are patched here. Async / promise
    //    fs APIs are tracked as a substrate gap in the design doc;
    //    the three incidents all used sync APIs (Bash + git + scaffold
    //    file writes), so the *Sync surface is the immediate priority.
    const patches: FsPatch[] = [];
    // Patch the CJS view of node:fs. ESM-namespace callers escape this
    // shim by design (see comment at top of file).
    const fsAny = fsRequire("node:fs") as Record<string, FsCall>;
    for (const key of FS_KEYS_PATCHED) {
      const current = fsAny[key] as FsCallWithMarker | undefined;
      if (typeof current !== "function") {
        // Some helpers may be absent on stripped runtimes — skip
        // silently rather than fail install().
        continue;
      }
      // Walk back to the genuine original via the marker (defensive
      // against stale wrappers from a prior aborted install()).
      const original: FsCall = current[ORIGINAL_FS_MARKER] ?? current;
      patches.push({ key, original });
      const wrapped: FsCallWithMarker = ((...args: unknown[]): unknown => {
        const first = args[0];
        if (typeof first === "string") {
          try {
            args[0] = resolveWithinRoot(first, root);
          } catch (err) {
            if (err instanceof WorktreeBoundaryError) {
              return onEscape(err);
            }
            throw err;
          }
        }
        // If the first arg is a Buffer, URL, or fd, we let it through
        // unchecked. fd-based fs calls have already passed through an
        // openSync (which we shim), so the boundary check fires there.
        return original(...args);
      }) as FsCallWithMarker;
      wrapped[ORIGINAL_FS_MARKER] = original;
      fsAny[key] = wrapped;
    }

    return {
      dispose: () => {
        if (!this.installed) return;
        process.chdir = originalChdir;
        for (const patch of patches) {
          fsAny[patch.key] = patch.original;
        }
        this.installed = false;
      },
    };
  }
}

/**
 * Factory. The AgentRunner calls this once per run with the worktree
 * root chosen by the dispatch substrate. On the local Bun-worker path,
 * the same host process can host many workers in series; on Azure each
 * call corresponds to a fresh Container App Job invocation.
 */
export function createRunnerWorker(config: RunnerWorkerConfig): RunnerWorker {
  return new LocalRunnerWorker(config);
}
