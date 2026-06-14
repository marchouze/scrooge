// platform/recon/no-swallowed-errors.test.ts
//
// Unit tests for the no-swallowed-errors Engineering-Charter gate.
// Authority: D-ENGINEERING-INTEGRITY-CHARTER.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./no-swallowed-errors";

let tmpDirs: string[] = [];

function makeProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "charter-swallow-"));
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

describe("no-swallowed-errors recon", () => {
  it("clean dir → ok, zero count", () => {
    const dir = makeProto({ "platform/a.ts": "try { f(); } catch (e) { log(e); }\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("empty catch over snapshot 0 → fail (non-vacuous)", () => {
    const dir = makeProto({ "platform/a.ts": "try { f(); } catch {}\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("empty catch with binding `catch (e) {}` is detected", () => {
    const dir = makeProto({ "runtime/b.ts": "try { f(); } catch (e) {}\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("multi-line empty catch is detected", () => {
    const dir = makeProto({ "platform/a.ts": "try {\n  f();\n} catch (e) {\n}\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("a catch containing a comment is NOT flagged (documented intent)", () => {
    const dir = makeProto({
      "platform/a.ts": "try { f(); } catch {\n  // genuinely nothing to do here\n}\n",
    });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("test files are excluded", () => {
    const dir = makeProto({ "platform/a.test.ts": "try { f(); } catch {}\n" });
    const r = run({ prototypeDir: dir, knownViolations: 0 });
    expect(r.count).toBe(0);
    expect(r.ok).toBe(true);
  });
});
