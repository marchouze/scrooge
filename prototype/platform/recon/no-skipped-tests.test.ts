// platform/recon/no-skipped-tests.test.ts
//
// Unit tests for the no-skipped-tests Engineering-Charter gate.
// Authority: D-ENGINEERING-INTEGRITY-CHARTER.
//
// NOTE: this gate scans *.test.* files, including this one. To avoid the test
// tripping its own gate in CI, fixture tokens are assembled by concatenation
// (e.g. `"it" + "." + "skip("`) so the forbidden token never appears
// contiguously in this file's own source. This is the standard
// self-linting-linter idiom.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./no-skipped-tests";

const DOT = ".";
const SKIP_CALL = `it${DOT}skip("x", () => {});\n`;
const ONLY_CALL = `describe${DOT}only("y", () => {});\n`;
const X_CALL = `x${"it"}("z", () => {});\n`;

let tmpDirs: string[] = [];

function makeProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "charter-skip-"));
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

describe("no-skipped-tests recon", () => {
  it("clean test file → ok, zero count", () => {
    const dir = makeProto({ "platform/a.test.ts": 'it("runs", () => {});\n' });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("a skipped case over snapshot 0 → fail (non-vacuous)", () => {
    const dir = makeProto({ "platform/a.test.ts": SKIP_CALL });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("a .only narrowing is detected", () => {
    const dir = makeProto({ "platform/b.test.ts": ONLY_CALL });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("the x-prefixed form is detected", () => {
    const dir = makeProto({ "platform/c.test.ts": X_CALL });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("non-test source files are excluded", () => {
    const dir = makeProto({ "platform/a.ts": SKIP_CALL });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("a comment mentioning skip is NOT flagged", () => {
    const dir = makeProto({
      "platform/a.test.ts": `// do not use it${DOT}skip here\nit("ok", () => {});\n`,
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });
});
