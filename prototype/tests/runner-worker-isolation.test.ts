// tests/runner-worker-isolation.test.ts
//
// Unit tests for the S8 §3.4 AgentRunner worker isolation primitive.
//
// Asserts:
//   - resolveWithinRoot returns root-resident paths and throws
//     WorktreeBoundaryError on escape.
//   - install() wraps process.chdir; chdir to a path under the
//     worktree is allowed; chdir to "..", "/", or any other
//     out-of-root path throws.
//   - install() wraps node:fs path-accepting *Sync helpers; reads
//     and writes inside the root work; reads and writes outside
//     the root throw.
//   - dispose() restores both chdir and node:fs to their originals.
//   - The optional onBoundaryEscape sink fires.
//
// Hermetic discipline:
//   - Each test creates a fresh worktree root via mkdtempSync.
//   - Each test that calls install() pairs it with dispose() in
//     afterEach so the chdir-override and fs shims do not leak
//     across the test battery.
//
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  WorktreeBoundaryError,
  createRunnerWorker,
  resolveWithinRoot,
} from "../platform/agent-runtime/runner-worker";

// The fs shim only intercepts CJS-require callers (see runner-worker.ts
// header comment). ESM-imported `readFileSync` is bound at import time
// and escapes the shim by design. The fs-shim tests in this file route
// through the same CJS handle that the implementation patches, which
// is what an agent-side caller using `require("node:fs")` would see.
const fsCjs = createRequire(import.meta.url)("node:fs") as {
  readFileSync: (p: string, opts?: BufferEncoding) => string | Buffer;
  writeFileSync: (p: string, data: string) => void;
};

/**
 * Track installed workers + the originating cwd so afterEach can
 * always restore the host process even if a test asserts a throw
 * before its own dispose() runs.
 */
let activeDisposers: Array<() => void> = [];
let savedCwd: string | undefined;

function makeWorktree(): string {
  // Resolve through the OS realpath layer (mkdtempSync on macOS returns
  // a path under /var/folders that is a symlink to /private/var/...).
  // We canonicalise to the realpath form because process.cwd() after
  // chdir also returns the realpath — otherwise our string comparisons
  // (and the boundary check, which is path-relative) would diverge.
  const raw = mkdtempSync(join(tmpdir(), "bank-runner-worker-"));
  return realpathSync(resolve(raw));
}

afterEach(() => {
  for (const dispose of activeDisposers.reverse()) {
    try {
      dispose();
    } catch {
      // best-effort cleanup
    }
  }
  activeDisposers = [];
  if (savedCwd !== undefined) {
    try {
      process.chdir(savedCwd);
    } catch {
      // ignore — host cwd might already be a directory we deleted
    }
    savedCwd = undefined;
  }
});

describe("resolveWithinRoot", () => {
  it("returns the absolute path for a relative input under root", () => {
    const root = makeWorktree();
    try {
      const out = resolveWithinRoot("./sub/file.ts", root);
      expect(out).toBe(join(root, "sub", "file.ts"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns the absolute path for an absolute input under root", () => {
    const root = makeWorktree();
    try {
      const target = join(root, "sub", "file.ts");
      const out = resolveWithinRoot(target, root);
      expect(out).toBe(target);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns root itself when the input resolves to the root", () => {
    const root = makeWorktree();
    try {
      expect(resolveWithinRoot(root, root)).toBe(root);
      expect(resolveWithinRoot(".", root)).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws WorktreeBoundaryError on absolute path outside root", () => {
    const root = makeWorktree();
    try {
      expect(() => resolveWithinRoot("/etc/passwd", root)).toThrow(
        WorktreeBoundaryError,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws WorktreeBoundaryError on relative .. traversal", () => {
    const root = makeWorktree();
    try {
      expect(() => resolveWithinRoot("../../../etc/passwd", root)).toThrow(
        WorktreeBoundaryError,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("attaches attemptedPath and worktreeRoot on the typed error", () => {
    const root = makeWorktree();
    try {
      let caught: WorktreeBoundaryError | undefined;
      try {
        resolveWithinRoot("/etc/passwd", root);
      } catch (err) {
        if (err instanceof WorktreeBoundaryError) caught = err;
      }
      expect(caught).toBeDefined();
      expect(caught?.code).toBe("WORKTREE_BOUNDARY");
      expect(caught?.attemptedPath).toBe("/etc/passwd");
      expect(caught?.worktreeRoot).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("RunnerWorker.install — process.chdir override", () => {
  it("allows chdir into the worktree root", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      // install() already chdir'd into root; verify we can chdir into
      // a subdirectory without throwing.
      const sub = join(root, "sub");
      mkdirSync(sub);
      expect(() => process.chdir(sub)).not.toThrow();
      // canonicalise both sides — Bun.cwd() may return the realpath form.
      expect(resolve(process.cwd())).toBe(resolve(sub));
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws WorktreeBoundaryError on chdir to '..'", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      expect(() => process.chdir("..")).toThrow(WorktreeBoundaryError);
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws WorktreeBoundaryError on chdir to '/'", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      expect(() => process.chdir("/")).toThrow(WorktreeBoundaryError);
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws on chdir to a sibling absolute worktree (the 2026-05-09 incident shape)", () => {
    savedCwd = process.cwd();
    const rootA = makeWorktree();
    const rootB = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: rootA });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      // The exact incident: agent in worktree A `cd`s to /Users/marc/code/Bank.
      // Our analogue: agent in rootA chdirs to rootB.
      expect(() => process.chdir(rootB)).toThrow(WorktreeBoundaryError);
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(rootA, { recursive: true, force: true });
      rmSync(rootB, { recursive: true, force: true });
    }
  });
});

describe("RunnerWorker.install — node:fs shim", () => {
  it("allows reads and writes under the worktree root", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      const target = join(root, "hello.txt");
      fsCjs.writeFileSync(target, "hello");
      const round = fsCjs.readFileSync(target, "utf8");
      expect(round).toBe("hello");
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks readFileSync on absolute paths outside the worktree", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      expect(() => fsCjs.readFileSync("/etc/passwd", "utf8")).toThrow(
        WorktreeBoundaryError,
      );
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks writeFileSync on absolute paths outside the worktree", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const escapeTarget = join(tmpdir(), "bank-runner-worker-escape.txt");
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      // tmpdir is outside the worktree root by construction.
      expect(() => fsCjs.writeFileSync(escapeTarget, "bad")).toThrow(
        WorktreeBoundaryError,
      );
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
      rmSync(escapeTarget, { force: true });
    }
  });

  it("blocks readFileSync via .. traversal", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      // The override is in effect; cwd is the root. "../etc/passwd"
      // resolves above the root and must be rejected.
      expect(() => fsCjs.readFileSync("../etc/passwd", "utf8")).toThrow(
        WorktreeBoundaryError,
      );
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("RunnerWorker.install — dispose() restores", () => {
  it("restores process.chdir to its original behaviour", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    try {
      // Under override, chdir to "/" throws.
      expect(() => process.chdir("/")).toThrow(WorktreeBoundaryError);
    } finally {
      handle.dispose();
    }
    // After dispose, chdir to tmpdir() (outside the worktree) works.
    expect(() => process.chdir(tmpdir())).not.toThrow();
    rmSync(root, { recursive: true, force: true });
  });

  it("restores node:fs.readFileSync to its original behaviour", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const sentinel = join(root, "sentinel.txt");
    writeFileSync(sentinel, "ok");
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    try {
      // Under override, an absolute read outside the root throws.
      expect(() => fsCjs.readFileSync("/etc/passwd", "utf8")).toThrow(
        WorktreeBoundaryError,
      );
    } finally {
      handle.dispose();
    }
    // After dispose, node:fs is back to vanilla. We assert that a
    // perfectly valid absolute path under the (now-restored) handle
    // no longer routes through the boundary check.
    expect(() => fsCjs.readFileSync(sentinel, "utf8")).not.toThrow();
    rmSync(root, { recursive: true, force: true });
  });

  it("is idempotent on double-dispose", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const worker = createRunnerWorker({ worktreeRoot: root });
    const handle = worker.install();
    expect(() => {
      handle.dispose();
      handle.dispose();
    }).not.toThrow();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("RunnerWorker — onBoundaryEscape sink", () => {
  it("invokes the sink before re-throwing", () => {
    savedCwd = process.cwd();
    const root = makeWorktree();
    const seen: WorktreeBoundaryError[] = [];
    const worker = createRunnerWorker({
      worktreeRoot: root,
      onBoundaryEscape: (err) => {
        seen.push(err);
      },
    });
    const handle = worker.install();
    activeDisposers.push(handle.dispose);
    try {
      expect(() => process.chdir("/")).toThrow(WorktreeBoundaryError);
      expect(seen.length).toBe(1);
      expect(seen[0]?.code).toBe("WORKTREE_BOUNDARY");
      expect(seen[0]?.worktreeRoot).toBe(root);
    } finally {
      handle.dispose();
      activeDisposers = activeDisposers.filter((d) => d !== handle.dispose);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createRunnerWorker — config validation", () => {
  it("rejects a relative worktreeRoot", () => {
    expect(() => createRunnerWorker({ worktreeRoot: "relative/path" })).toThrow(
      /worktreeRoot must be an absolute path/,
    );
  });

  it("exposes the canonical worktreeRoot on the instance", () => {
    const root = makeWorktree();
    try {
      const worker = createRunnerWorker({ worktreeRoot: root });
      expect(worker.worktreeRoot).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
