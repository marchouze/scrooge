// platform/recon/no-ts-suppression.test.ts
//
// Unit tests for the no-ts-suppression Engineering-Charter gate.
// Authority: D-ENGINEERING-INTEGRITY-CHARTER.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./no-ts-suppression";

let tmpDirs: string[] = [];

function makeProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "charter-ts-suppress-"));
  tmpDirs.push(dir);
  // CLAUDE.md so charter-scan's repo-root probe never escapes the fixture.
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

describe("no-ts-suppression recon", () => {
  it("clean dir → ok, zero count", () => {
    const dir = makeProto({ "platform/a.ts": "export const x = 1;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("a real @ts-ignore directive over snapshot 0 → fail (non-vacuous)", () => {
    const dir = makeProto({
      "platform/a.ts": "// @ts-ignore\nconst x: number = 'oops' as unknown as number;\n",
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("@ts-expect-error block-comment form is detected", () => {
    const dir = makeProto({ "runtime/b.ts": "/* @ts-expect-error legacy */\nconst y = z;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("prose mentioning the directive mid-comment is NOT flagged", () => {
    const dir = makeProto({
      "platform/a.ts": "// never use @ts-ignore in this file\nexport const x = 1;\n",
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("test files are excluded from the scan", () => {
    const dir = makeProto({ "platform/a.test.ts": "// @ts-ignore\nconst x = 1;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("count below snapshot → info, not fail (cleanup is allowed)", () => {
    const dir = makeProto({ "platform/a.ts": "export const x = 1;\n" });
    const r = run({ prototypeDir: dir, knownViolations: 1 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
    expect(r.violations[0]?.severity).toBe("info");
  });
});
