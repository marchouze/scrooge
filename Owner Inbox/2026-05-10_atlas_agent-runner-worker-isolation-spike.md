---
title: AgentRunner worker isolation — local Bun-worker prototype (S8 §3.4)
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Substrate fix for the three 2026-05-09 worktree-isolation incidents — a Bun-worker primitive that confines an agent's filesystem visibility to its assigned worktree root via process.chdir / node:fs path-resolution overrides. Local-first prototype; cloud mapping documented; adversarial-agent gap honestly surfaced.
decision-required: false
---

# AgentRunner worker isolation — local Bun-worker prototype

**Spike under S8 (CeoDecision approved 2026-05-08, agent-runtime substrate authorisation).** Implements the substrate-side fix for the worktree-isolation lost-work incidents on 2026-05-09 (PR #74 Atlas, PR #76 Imani, PR #77 Niko). Memory: `feedback_agent_worktree_isolation`.

**Author:** Atlas (Core banking platform architect, engineering).

## 1. Why

Three Scrooge-coordinated dispatches on 2026-05-09 lost work because the dispatched agent — running in an isolated worktree — `cd`'d back to `/Users/marc/code/Bank` (the main worktree) mid-run and committed scaffold-files onto the wrong branch. The main-worktree branch was `main`-tracking; the rejected scaffold-commits were stranded.

| Incident | PR | Loss-mode |
|---|---|---|
| Atlas dispatch | #74 | Scaffold-commit landed on `main` worktree, not the dispatched branch. Re-run required. |
| Imani dispatch | #76 | Same root cause; ISDA clause-library skeleton lost mid-flow. |
| Niko dispatch | #77 | Same root cause; counterparty-eligibility scaffold lost. |

Today's mitigation is **prompt discipline** — every dispatch carries a "DO NOT cd to /Users/marc/code/Bank" clause in the brief. This is fragile by construction (the rule lives only in the prose of the brief) and has already failed three times in one day.

The substrate fix: when the AgentRunner spawns a worker per agent (per S8 spec §3.4), the worker must run with **filesystem visibility constrained to its assigned worktree root**. `cd` outside the worktree must fail at the runtime level, not at prompt-discipline level.

This spike delivers the **local-first** primitive. The cloud-side mapping (Azure Container Apps Jobs) is documented but not implemented.

## 2. Approach chosen

### 2.1 Three options considered

1. **`chroot` / OS-level filesystem namespace.** Strong isolation against adversarial agents that drop to raw syscalls. Requires root or a containerised runtime (Docker, Linux user-namespaces, macOS sandbox-exec). Heavy to set up locally, near-zero local dev ergonomics, and the cloud-side primitive is anyway a container — so paying the cost twice.
2. **Bun-worker `cwd` confinement only.** Spawn the worker with `cwd` set to the worktree root. Zero overhead. **Does not actually prevent `cd`** — the worker can still call `process.chdir("..")`. So this is no better than today's prompt-discipline mitigation; it just moves the discipline from the brief into the spawn config.
3. **Bun-worker `cwd` + chdir-override + `node:fs` path-resolution sentinel.** Spawn the worker with `cwd` set to the worktree root; on entry, monkey-patch `process.chdir` to assert the destination is under the root (typed throw on escape) and wrap `node:fs` path-resolving operations to the same. Middle ground — accident-prevention plus a clear typed escalation surface ("path escapes worktree" → typed `WorktreeBoundaryError` → `SubstrateAlert` event downstream).

### 2.2 Decision

**Option 3.** Rationale:

- The three incidents are all **accidental** escapes — the agent took a path that *seemed* like a relative path resolution but landed outside the worktree (often via a stale `cd` from a prior shell call, or via tooling like `git -C /Users/marc/code/Bank ...`). Option 3 closes 100% of *accidental* escapes.
- Adversarial-agent defence is downstream substrate work — the agent-runtime threat model (Senna + Rashida, 2026-05-10) is explicit that adversarial-prompt-injection-at-the-LLM-layer is out of scope for the substrate's defensive envelope (it's covered separately under model-risk, Nadia). The S8 substrate's job is to prevent the agent from accidentally violating its own permission policy, not to defend against a hostile agent that has dropped to raw syscalls.
- Option 3 is **OS-portable** in its accident-prevention layer (Bun, Node, any V8-flavoured runtime supports `process.chdir` interception). The cloud lift to Azure Container Apps Jobs *adds* the container's chroot-equivalent on top — it doesn't replace the chdir-override. So Option 3 is a strict subset of the cloud-day controls; nothing has to be unwound.
- Option 1 (chroot) is the right primitive for **adversarial defence**, not for accident-prevention. Pulling chroot in locally is a layering inversion — it pays the heavy cost without closing the right gap. The adversarial gap closes when (a) the cloud lift puts every worker in a Container Apps Job (sandboxed by the platform), and (b) Vera Wave-5 collusion-recon catches emergent capability creep across runs (per the threat model T-03 mitigation).

## 3. Interface contract

The runner-worker primitive exposes a small TypeScript interface that the AgentRunner imports. The same interface lands on Azure Container Apps Jobs (§5) without any caller-visible change.

```ts
/**
 * A typed error thrown when an agent's runtime attempts to access a
 * filesystem path outside its assigned worktree root. Carries the
 * attempted path (resolved-absolute) and the worktree root for the
 * substrate's downstream `SubstrateAlert` emission.
 */
export class WorktreeBoundaryError extends Error {
  readonly code = "WORKTREE_BOUNDARY";
  readonly attemptedPath: string;
  readonly worktreeRoot: string;
}

/**
 * Configuration for a runner-worker bound to a specific worktree.
 * The contract is intentionally narrow — the substrate's job is to
 * enforce the worktree boundary, not to manage the agent's lifecycle
 * (the AgentRunner does that — S8 §3.4).
 */
export interface RunnerWorkerConfig {
  /** Absolute path to the worktree root. Must exist on disk. */
  readonly worktreeRoot: string;
  /**
   * Optional sink for boundary-escape events. The AgentRunner wires
   * this to the SubstrateAlert emitter; tests pass an in-memory sink.
   * Default: re-throw the error.
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
  /** The worktree root this worker is bound to. */
  readonly worktreeRoot: string;

  /**
   * Resolve a path relative to (or absolute under) the worktree root.
   * Returns the absolute, root-relative path; throws WorktreeBoundaryError
   * if the resolution lands outside the root.
   *
   * This is the canonical resolver that all worker-internal fs work
   * routes through, regardless of platform. The override of node:fs
   * helpers calls this; the chdir override calls this.
   */
  resolveWithinRoot(path: string): string;

  /**
   * Apply the worker's runtime constraints to the current process:
   *   - chdir() to worktreeRoot
   *   - replace process.chdir() with a boundary-checked version
   *   - install node:fs path-resolution sentinels (best-effort —
   *     see threat-model section on adversarial-agent gaps)
   *
   * Idempotent — re-applying is a no-op. Returns a `dispose()` handle
   * that restores the original behaviours, used for hermetic tests
   * and for reusing the host process across agent runs in the local
   * dev path.
   */
  install(): { dispose: () => void };
}

/**
 * Factory. The AgentRunner calls this once per run with the worktree
 * root chosen by the dispatch substrate. On the local path, the same
 * host process can host many workers in series (each call returns a
 * fresh, disposable instance). On Azure, each call corresponds to a
 * fresh Container App Job invocation.
 */
export function createRunnerWorker(config: RunnerWorkerConfig): RunnerWorker;
```

The interface is **stable across local and cloud**. The only thing that changes between platforms is what `install()` does under the hood — locally it monkey-patches the in-process `process.chdir` and `node:fs`; on Azure it's a no-op (the container itself enforces the boundary).

## 4. Local implementation

`prototype/platform/agent-runtime/runner-worker.ts` ships:

1. **`WorktreeBoundaryError`** — typed error class.
2. **`resolveWithinRoot(path, root)`** — pure function. Resolves `path` against `root` (via `node:path.resolve`); refuses absolute paths outside `root`; refuses any path whose normalised form starts with `..` of root. Returns the absolute path.
3. **`createRunnerWorker(config)`** — returns an object exposing `worktreeRoot`, `resolveWithinRoot`, `install`.
4. **`install()`** — wraps `process.chdir`, then wraps a small set of `node:fs` path-accepting helpers (`readFileSync`, `writeFileSync`, `readdirSync`, `existsSync`, `statSync`, `openSync`, `mkdirSync`, `rmSync`, `unlinkSync`). Each wrap calls `resolveWithinRoot()` on the first path argument before delegating to the original. Returns `dispose()` which restores all wrapped slots.

**Hermetic-test discipline.** The test file uses `mkdtempSync` to create a per-test worktree root, calls `install()`, asserts the boundary checks fire, and calls `dispose()` in `afterEach` so the test suite never leaks chdir-override into adjacent tests.

**OS portability.** The path resolution uses `node:path.resolve` + `path.relative(root, resolved).startsWith("..")`, which is OS-agnostic. The chdir override and `node:fs` shim are V8-runtime-level and work identically on macOS and Linux. The CI gate runs on Linux and exercises every test in this file — no platform-specific skip.

**What `install()` does NOT cover.**
- Bun's native `Bun.file()`, `Bun.write()`, and `Bun.spawn()` paths. These are out-of-scope for this slice — see "Substrate gaps" §8.
- Direct `node:child_process.spawn()` of a subprocess that itself does fs work. The override applies only to the current V8 isolate.
- Raw syscalls via `bun:ffi` or N-API. Adversarial-only, out of scope per §2.2.

## 5. Cloud mapping (Azure Container Apps Jobs)

Per S8 spec §3.4 Cloud column, the production runtime is **Azure Container Apps Jobs** (one per agent) or **Functions** (per-trigger). Mapping:

- Each agent run is a fresh Container App Job invocation — the container's filesystem is **already chroot-isolated** to its own image + mounted secrets (Key Vault Managed HSM-backed) + the worktree-equivalent (a checkout of the repo at the run's pinned commit).
- The `RunnerWorker` factory on Azure is a thin wrapper: `worktreeRoot` is the container's `/work` mount; `install()` is a no-op (the container provides the isolation); `resolveWithinRoot` retains its semantics so the AgentRunner code is identical across platforms.
- The `WorktreeBoundaryError` type stays the same; on Azure it's effectively unreachable in normal operation (the container kernel would `EACCES` first), but the typed error surface is part of the contract.
- `SubstrateAlert` emission for boundary-escape attempts is a wired control on both platforms — locally via `onBoundaryEscape`, on Azure via a sidecar container that scrapes the kernel audit log and emits the same event type.

The AgentRunner caller imports the interface, never the implementation; composition root selects the local or cloud factory at the platform seam (Principle 3 — substrate-replacement seam).

## 6. Threat model coverage

Cross-reference: **Senna (Chief Information Security Officer, governance) + Rashida (Authorisation engineer, engineering)**, [Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md](2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md).

### 6.1 Closed by this slice

| Threat class | Covered? | How |
|---|---|---|
| Accidental `process.chdir` escape (the three 2026-05-09 incidents) | Yes | `process.chdir` override throws `WorktreeBoundaryError`. |
| Accidental absolute-path write outside worktree (`fs.writeFileSync("/Users/marc/code/Bank/...")`) | Yes | `node:fs` shim resolves through `resolveWithinRoot`. |
| Accidental relative-path traversal (`fs.readFileSync("../../etc/passwd")`) | Yes | Same shim — relative paths resolve under the worktree, then are checked. |

### 6.2 NOT closed by this slice — adversarial gaps

| Gap | Why deferred | Where it closes |
|---|---|---|
| Agent uses `Bun.file()` / `Bun.write()` directly | Bun-specific APIs not yet shimmed; design priority is the most common Node-stdlib paths first. | Future slice — extend `install()` to wrap the Bun namespace. Tracked in §8. |
| Agent calls `bun:ffi` or N-API to make raw syscalls | The override is V8-level. Native code escapes it. | Adversarial defence — Azure Container Apps Job kernel-level isolation (M8 cloud lift). |
| Agent spawns a child process that itself escapes the worktree | Override applies only to the current isolate. Child processes inherit the OS `cwd` but not the override. | Partial mitigation: spawn child processes with `cwd: worktreeRoot` and forbid setting `cwd` outside it (future slice). Adversarial-grade closure: container-day. |
| Agent calls `git -C /some/other/path ...` | This is a subprocess; same gap as above. The original three incidents would have been caught — they used `process.chdir` not `git -C` — but a future incident could route around the override this way. | Same — child-process `cwd` policy, then container-day. |

This is the honest envelope. **Accident-prevention: covered. Adversarial defence: explicitly downstream.** The threat-model document's T-09 ("agent-runner-worker filesystem boundary") will reference this slice as the partial mitigation; full closure depends on the cloud lift (M8).

## 7. Tests

`prototype/tests/runner-worker-isolation.test.ts` covers:

### 7.1 Unit-testable in this slice

- **Path resolution under root.** `resolveWithinRoot("./sub/file.ts")` returns `<root>/sub/file.ts`.
- **Absolute path under root.** `resolveWithinRoot("<root>/sub/file.ts")` returns the same path normalised.
- **Absolute path escape — explicit.** `resolveWithinRoot("/etc/passwd")` throws `WorktreeBoundaryError`.
- **Relative path escape via `..`.** `resolveWithinRoot("../../../etc/passwd")` throws `WorktreeBoundaryError`.
- **`process.chdir` override — to root.** `chdir(root)` is allowed.
- **`process.chdir` override — to subdir.** `chdir("<root>/sub")` is allowed.
- **`process.chdir` override — escape via "..".** `chdir("..")` throws `WorktreeBoundaryError`.
- **`process.chdir` override — escape via absolute.** `chdir("/")` throws `WorktreeBoundaryError`.
- **`node:fs` shim — read inside.** `readFileSync("<root>/file.txt")` works.
- **`node:fs` shim — read outside.** `readFileSync("/etc/passwd")` throws `WorktreeBoundaryError`.
- **`node:fs` shim — write outside.** `writeFileSync("/tmp/escape.txt", ...)` throws `WorktreeBoundaryError`.
- **`dispose()` restores.** After `dispose()`, `process.chdir("/")` works again, and `readFileSync` no longer routes through the shim.
- **`onBoundaryEscape` sink fires.** When configured, the sink receives the typed error.

All tests use `mkdtempSync` for the worktree root and `afterEach` `dispose()` for cleanup.

### 7.2 Needs real-process integration test (NOT in this slice)

- Boundary-escape via `node:child_process.spawn()` cwd. Requires forking a real subprocess; tracked under §8.
- Boundary-escape via `Bun.spawn()` with absolute path. Same.
- Boundary-escape via `git -C /elsewhere ...` — same as above.

These are documented gaps; deferred to the next runner-worker slice (substrate roadmap item).

## 8. Substrate gaps surfaced

These are roadmap items, not blockers for the spike:

1. **Bun namespace not shimmed.** `Bun.file`, `Bun.write`, `Bun.spawn`. Owner: Atlas; tranche: next runner-worker slice.
2. **Child-process `cwd` policy.** Subprocesses spawned from the worker need their `cwd` clamped to the worktree root and rejected if the policy disagrees. Owner: Atlas; tranche: next runner-worker slice.
3. **`SubstrateAlert` event-type wiring.** `onBoundaryEscape` callback exists, but the event-type schema for "worker-boundary-escape" is not yet drafted. Owner: Atlas + Senna; depends on the substrate-alert event family being canonicalised (currently informal across handlers).
4. **AgentRunner top-level integration.** The runner's `runOnce(agentId, trigger)` path needs to call `createRunnerWorker(...)` and `install()` before invoking the agent's handler, and `dispose()` after. Out of scope here per the dispatch brief (a parallel Atlas dispatch is auditing the agent-runtime directory and shipping a different slice; collision avoidance is critical — `runner-worker.ts` is the only file this spike adds to that directory).
5. **Adversarial-agent kernel-level isolation.** Closes at the Azure cloud lift (M8) where every run is a fresh Container App Job. Local-first is `cwd` + override + recon for emergent collusion (Vera Wave-5).
6. **Cross-platform integration test runner.** The CI gate runs Linux only; macOS-specific behaviours are not covered. The override and resolver are OS-portable, but a Linux-only assumption shouldn't lock in. Owner: Atlas; tranche: when Marc's macOS dev box stops being the only macOS surface.

## 9. Authority + dispatch discipline

- **CEO authority:** S8 (CeoDecision, approved 2026-05-08). No new CEO decision required (this is a spike inside the approved S8 scope, per the no-pause rule).
- **Worktree:** authored in `agent-a94742d3aea6f21ac` per CLAUDE.md "Dispatch discipline" worktree-isolation rule. No `cd` to `/Users/marc/code/Bank/`.
- **Identity discipline:** Atlas (Core banking platform architect, engineering); Senna (Chief Information Security Officer, governance); Rashida (Authorisation engineer, engineering); Vera (Internal audit engineer, engineering); Marc (CEO).
- **Concurrency:** a parallel Atlas dispatch is auditing `prototype/platform/agent-runtime/`. This spike adds **only** `runner-worker.ts` to that directory. No edits to `registry.ts`, `spec-parser.ts`, or any other agent-runtime file.

## 10. Citations

- `S8` — CEO decision, agent-runtime substrate authorisation, 2026-05-08.
- `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` §3.4 — the AgentRunner architectural seam.
- `Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md` — threat envelope.
- `JOINT-STANDARD-2-2024` — cyber resilience / zero-trust posture (worker isolation is part of the same control family as the permission gate).
- `Principle 3` — cloud-native; substrate-replacement seams.
- `Principle 4` — security designed in.
- `Principle 7` — autonomous-by-default; agents oversee their own boundary; substrate fails-closed on accidental escape.

—Atlas
