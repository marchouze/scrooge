// platform/recon/tracked-todo.test.ts
//
// Unit tests for the tracked-todo Engineering-Charter gate.
// Authority: D-ENGINEERING-INTEGRITY-CHARTER.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./tracked-todo";

let tmpDirs: string[] = [];

function makeProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "charter-todo-"));
  tmpDirs.push(dir);
  writeFileSync(join(dir, "CLAUDE.md"), "fixture", "utf8");
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe("tracked-todo recon", () => {
  it("clean dir → ok, zero count", () => {
    const dir = makeProto({ "platform/a.ts": "export const x = 1;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("an untracked marker over snapshot 0 → fail (non-vacuous)", () => {
    const dir = makeProto({
      "platform/a.ts": "// TODO: wire this up later\nexport const x = 1;\n",
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("a marker WITH a Decision citation is NOT flagged", () => {
    const dir = makeProto({
      "platform/a.ts": "// TODO(D-SOME-DECISION): deferred, owner assigned\nexport const x = 1;\n",
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("a marker WITH a chip task id is NOT flagged", () => {
    const dir = makeProto({ "runtime/b.ts": "// FIXME: see task_ab12cd34\nconst y = 2;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("HACK marker without a ref is flagged", () => {
    const dir = makeProto({ "dashboard/c.ts": "// HACK around the bug\nconst z = 3;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("test files are excluded", () => {
    const dir = makeProto({
      "platform/a.test.ts": "// TODO: untracked but in a test\nconst x = 1;\n",
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });
});
